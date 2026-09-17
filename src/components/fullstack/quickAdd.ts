import type { FullstackFieldDef, FullstackFieldType } from '../../types'
import { newUid } from './uid'

/**
 * Parser behind "Paste fields": one field per line, so a 20-column entity is one paste instead of
 * sixty clicks. Grammar (tokens are whitespace-separated; a quoted value keeps its spaces):
 *
 *   name [TYPE] [pk] [gen] [req] [uniq] [lock] [email] [nosearch] [nofilter]
 *        [len=N] [min=N] [max=N] [pattern=RE] [values=A|B|C] [label="Shown name"] [default=V]
 *
 * `name:TYPE` and `name TYPE(N)` are accepted too. Type aliases follow the backend's lenient
 * `FieldType.forWireString` (int, bool, date, datetime, decimal, text, guid, …). `values=` implies
 * ENUM. Blank lines and `#`/`//` comments are skipped. Errors name the line; good lines still parse.
 */
export interface QuickAddResult {
  fields: FullstackFieldDef[]
  errors: { line: number; message: string }[]
}

const TYPE_ALIASES: Record<string, FullstackFieldType> = {
  string: 'STRING', str: 'STRING', varchar: 'STRING', char: 'STRING',
  text: 'TEXT', longtext: 'TEXT', clob: 'TEXT',
  long: 'LONG', bigint: 'LONG',
  int: 'INTEGER', integer: 'INTEGER', short: 'INTEGER',
  bool: 'BOOLEAN', boolean: 'BOOLEAN',
  date: 'LOCAL_DATE', localdate: 'LOCAL_DATE', local_date: 'LOCAL_DATE',
  datetime: 'LOCAL_DATE_TIME', timestamp: 'LOCAL_DATE_TIME', localdatetime: 'LOCAL_DATE_TIME', local_date_time: 'LOCAL_DATE_TIME',
  decimal: 'BIG_DECIMAL', numeric: 'BIG_DECIMAL', bigdecimal: 'BIG_DECIMAL', big_decimal: 'BIG_DECIMAL', number: 'BIG_DECIMAL', double: 'BIG_DECIMAL', float: 'BIG_DECIMAL',
  uuid: 'UUID', guid: 'UUID',
  enum: 'ENUM',
}

const FLAGS: Record<string, (f: FullstackFieldDef) => void> = {
  pk: f => { f.primaryKey = true },
  id: f => { f.primaryKey = true },
  gen: f => { f.generated = true },
  generated: f => { f.generated = true },
  auto: f => { f.generated = true },
  req: f => { f.required = true },
  required: f => { f.required = true },
  notnull: f => { f.required = true },
  '!': f => { f.required = true },
  uniq: f => { f.unique = true },
  unique: f => { f.unique = true },
  lock: f => { f.readOnly = true },
  locked: f => { f.readOnly = true },
  readonly: f => { f.readOnly = true },
  email: f => { f.email = true },
  nosearch: f => { f.searchable = false },
  nofilter: f => { f.filterable = false },
}

function resolveType(raw: string): FullstackFieldType | undefined {
  return TYPE_ALIASES[raw.toLowerCase().replace(/-/g, '_')]
}

/** Splits on whitespace but keeps `key="a b"` / `"a b"` together (quotes stripped). */
function tokenize(line: string): string[] {
  const tokens: string[] = []
  const re = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) tokens.push(m[0].replace(/"([^"]*)"|'([^']*)'/g, (_s, a, b) => a ?? b ?? ''))
  return tokens
}

export function parseQuickAdd(text: string): QuickAddResult {
  const fields: FullstackFieldDef[] = []
  const errors: QuickAddResult['errors'] = []
  const lines = text.split(/\r?\n/)
  lines.forEach((rawLine, i) => {
    const lineNo = i + 1
    let line = rawLine.trim().replace(/[,;]$/, '').replace(/^[-*]\s+/, '')
    if (!line || line.startsWith('#') || line.startsWith('//')) return
    const tokens = tokenize(line)
    if (tokens.length === 0) return

    // First token: `name`, `name:TYPE`, or `name:TYPE(N)`.
    let [head, ...rest] = tokens
    let inlineType: string | undefined
    const colon = head.indexOf(':')
    if (colon > 0) { inlineType = head.slice(colon + 1); head = head.slice(0, colon) }
    if (inlineType) rest = [inlineType, ...rest]

    const field: FullstackFieldDef = { uid: newUid(), name: head, type: 'STRING' }
    let typeSet = false
    const problems: string[] = []

    for (const token of rest) {
      const lower = token.toLowerCase()
      // TYPE or TYPE(N)
      const typeMatch = /^([a-z_]+)(?:\((\d+)\))?$/i.exec(token)
      if (!typeSet && typeMatch && resolveType(typeMatch[1])) {
        field.type = resolveType(typeMatch[1])!
        typeSet = true
        if (typeMatch[2]) field.length = Number(typeMatch[2])
        continue
      }
      if (FLAGS[lower]) { FLAGS[lower](field); continue }
      const kv = /^([a-z_]+)=(.*)$/i.exec(token)
      if (kv) {
        const key = kv[1].toLowerCase(); const value = kv[2]
        switch (key) {
          case 'len': case 'length': case 'max_length': field.length = Number(value); break
          case 'min': field.min = Number(value); break
          case 'max': field.max = Number(value); break
          case 'pattern': case 'regex': field.pattern = value; break
          case 'label': field.label = value; break
          case 'default': field.defaultValue = value; break
          case 'values': case 'enum': case 'options':
            field.enumValues = value.split(/[|,]/).map(v => v.trim()).filter(Boolean)
            field.type = 'ENUM'; typeSet = true
            break
          case 'type': {
            const t = resolveType(value)
            if (t) { field.type = t; typeSet = true } else problems.push(`unknown type '${value}'`)
            break
          }
          default: problems.push(`unknown option '${key}'`)
        }
        if (['len', 'length', 'max_length', 'min', 'max'].includes(key) && Number.isNaN(Number(value))) {
          problems.push(`'${key}' needs a number`)
        }
        continue
      }
      if (typeMatch && !typeSet) problems.push(`unknown type '${typeMatch[1]}'`)
      else problems.push(`unexpected '${token}'`)
    }

    if (field.type !== 'STRING' && field.length != null && !typeSet) field.length = undefined
    if (problems.length > 0) {
      errors.push({ line: lineNo, message: `${head}: ${problems.join(', ')}` })
      return
    }
    fields.push(field)
  })
  return { fields, errors }
}
