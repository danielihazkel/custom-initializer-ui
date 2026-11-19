import type { FullstackEntityDef, FullstackFieldDef } from '../../types'
import { LIMITS } from './schema'

/**
 * The model's expression language, as the editor checks it while a rule is typed — a mirror of
 * the backend's fullstack/expr (Expr.parse + ExprCheck), which has the last word when the project
 * is generated. One line over the row's own fields: `endsOn >= startsOn`, `status == 'REJECTED'`,
 * `not isEmpty(reason)`, `quantity * unitPrice > 100` — and, one step through a MANY_TO_ONE, the
 * linked row's: `amount <= costCenter.budget`.
 */

export type ExprType = 'NUMBER' | 'TEXT' | 'BOOL' | 'DATE' | 'DATETIME' | 'INSTANT' | 'TIME' | 'ENUM' | 'ANY'

export const EXPR_FUNCTIONS = ['isEmpty', 'today', 'now', 'daysBetween', 'length', 'abs', 'round', 'date'] as const
export const MAX_EXPRESSION = LIMITS.maxExpression

type Node =
  | { k: 'lit'; value: number | string | boolean; at: number }
  | { k: 'ref'; name: string; at: number }
  | { k: 'unary'; op: '-' | 'not'; operand: Node; at: number }
  | { k: 'binary'; op: string; left: Node; right: Node; at: number }
  | { k: 'call'; fn: string; args: Node[]; at: number }

export class ExprError extends Error {
  constructor(message: string, readonly at: number) {
    super(message)
  }

  describe(): string {
    return this.message + (this.at >= 0 ? ` (at character ${this.at + 1})` : '')
  }
}

type Token = { kind: 'num' | 'text' | 'name' | 'op' | 'end'; text: string; value?: number | string; at: number }

/** The tokens of an expression (exported for renaming a field inside rules). */
export function lex(s: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) { i++; continue }
    if (/\d/.test(c) || (c === '.' && /\d/.test(s[i + 1] ?? ''))) {
      const start = i
      while (i < s.length && /[\d.]/.test(s[i])) i++
      const text = s.slice(start, i)
      if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) throw new ExprError(`'${text}' is not a number`, start)
      out.push({ kind: 'num', text, value: Number(text), at: start })
      continue
    }
    if (c === "'" || c === '"') {
      const start = i++
      let value = ''
      for (;;) {
        if (i >= s.length) throw new ExprError(`A text is not closed with ${c}`, start)
        let d = s[i++]
        if (d === c) break
        if (d === '\\' && i < s.length) d = s[i++]
        value += d
      }
      out.push({ kind: 'text', text: s.slice(start, i), value, at: start })
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      const start = i
      const name = () => { while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) i++ }
      name()
      // One step through a link: costCenter.budget.
      if (s[i] === '.' && /[A-Za-z_]/.test(s[i + 1] ?? '')) {
        i++
        name()
        if (s[i] === '.' && /[A-Za-z_]/.test(s[i + 1] ?? '')) throw new ExprError('A link is followed one step only (like costCenter.budget)', i)
      }
      out.push({ kind: 'name', text: s.slice(start, i), at: start })
      continue
    }
    const two = s.slice(i, i + 2)
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(two)) {
      out.push({ kind: 'op', text: two, at: i })
      i += 2
      continue
    }
    if ('+-*/()<>=!,'.includes(c)) {
      out.push({ kind: 'op', text: c, at: i })
      i++
      continue
    }
    throw new ExprError(`'${c}' is not part of the language`, i)
  }
  out.push({ kind: 'end', text: 'the end', at: s.length })
  return out
}

export function parse(text: string): Node {
  if (!text.trim()) throw new ExprError('The expression is empty', -1)
  if (text.length > MAX_EXPRESSION) throw new ExprError(`The expression is over ${MAX_EXPRESSION} characters`, -1)
  const tokens = lex(text)
  let pos = 0
  const peek = () => tokens[pos]
  const isOp = (...ops: string[]) => {
    const t = peek()
    if (t.kind === 'op') return ops.includes(t.text)
    if (t.kind === 'name') return ops.includes(t.text.toLowerCase())
    return false
  }
  const expect = (op: string) => {
    if (!isOp(op)) throw new ExprError(`Expected '${op}' but found '${peek().text}'`, peek().at)
    pos++
  }
  const COMPARE = ['==', '=', '!=', '<', '<=', '>', '>=']
  function or(): Node {
    let left = and()
    while (isOp('or', '||')) { const t = tokens[pos++]; left = { k: 'binary', op: 'or', left, right: and(), at: t.at } }
    return left
  }
  function and(): Node {
    let left = not()
    while (isOp('and', '&&')) { const t = tokens[pos++]; left = { k: 'binary', op: 'and', left, right: not(), at: t.at } }
    return left
  }
  function not(): Node {
    if (isOp('not', '!')) { const t = tokens[pos++]; return { k: 'unary', op: 'not', operand: not(), at: t.at } }
    return compare()
  }
  function compare(): Node {
    const left = sum()
    if (isOp(...COMPARE)) {
      const t = tokens[pos++]
      const right = sum()
      if (isOp(...COMPARE)) throw new ExprError("Comparisons do not chain: join them with 'and'", peek().at)
      return { k: 'binary', op: t.text === '=' ? '==' : t.text, left, right, at: t.at }
    }
    return left
  }
  function sum(): Node {
    let left = product()
    while (isOp('+', '-')) { const t = tokens[pos++]; left = { k: 'binary', op: t.text, left, right: product(), at: t.at } }
    return left
  }
  function product(): Node {
    let left = unary()
    while (isOp('*', '/')) { const t = tokens[pos++]; left = { k: 'binary', op: t.text, left, right: unary(), at: t.at } }
    return left
  }
  function unary(): Node {
    if (isOp('-')) { const t = tokens[pos++]; return { k: 'unary', op: '-', operand: unary(), at: t.at } }
    return primary()
  }
  function primary(): Node {
    const t = tokens[pos++]
    if (t.kind === 'num' || t.kind === 'text') return { k: 'lit', value: t.value!, at: t.at }
    if (t.kind === 'name') {
      const word = t.text.toLowerCase()
      if (word === 'true' || word === 'false') return { k: 'lit', value: word === 'true', at: t.at }
      if (['and', 'or', 'not'].includes(word)) throw new ExprError(`Expected a value but found '${t.text}'`, t.at)
      if (isOp('(')) {
        if (t.text.includes('.')) throw new ExprError(`'${t.text}' is not a function`, t.at)
        pos++
        const args: Node[] = []
        if (!isOp(')')) {
          args.push(or())
          while (isOp(',')) { pos++; args.push(or()) }
        }
        expect(')')
        return { k: 'call', fn: t.text, args, at: t.at }
      }
      return { k: 'ref', name: t.text, at: t.at }
    }
    if (t.kind === 'op' && t.text === '(') {
      const inner = or()
      expect(')')
      return inner
    }
    if (t.kind === 'end') throw new ExprError('The expression ends too early', t.at)
    throw new ExprError(`Expected a value but found '${t.text}'`, t.at)
  }
  const node = or()
  if (peek().kind !== 'end') throw new ExprError(`Unexpected '${peek().text}'`, peek().at)
  return node
}

/** The expression type of a field, or null for one an expression reads only with isEmpty. */
export function typeOfField(f: FullstackFieldDef): ExprType | null {
  switch (f.type) {
    case 'INTEGER': case 'LONG': case 'BIG_DECIMAL': case 'MONEY': return 'NUMBER'
    case 'STRING': case 'TEXT': case 'MARKDOWN': return 'TEXT'
    case 'BOOLEAN': return 'BOOL'
    case 'LOCAL_DATE': return 'DATE'
    case 'LOCAL_DATE_TIME': return 'DATETIME'
    case 'INSTANT': return 'INSTANT'
    case 'LOCAL_TIME': return 'TIME'
    case 'ENUM': return 'ENUM'
    default: return null
  }
}

const DESCRIBE: Record<ExprType, string> = {
  NUMBER: 'a number', TEXT: 'a text', BOOL: 'a yes/no condition', DATE: 'a date', DATETIME: 'a date and time',
  INSTANT: 'an instant', TIME: 'a time of day', ENUM: 'an enum value', ANY: 'a value',
}

/** What a MANY_TO_ONE leads to, by the relation's name, among `entities`. */
function linksOf(entity: FullstackEntityDef, entities: readonly FullstackEntityDef[]): Map<string, FullstackEntityDef> {
  const out = new Map<string, FullstackEntityDef>()
  for (const r of entity.relations ?? []) {
    if (r.type !== 'MANY_TO_ONE' || !r.fieldName.trim()) continue
    const target = entities.find(e => e.name.trim().toLowerCase() === r.targetEntity.trim().toLowerCase())
    if (target) out.set(r.fieldName, target)
  }
  return out
}

/**
 * The row's own fields an expression reads, in order; throws {@link ExprError} when it does not fit
 * the entity or is not `expected`. A linked row's field (`costCenter.budget`) is looked up in
 * `entities` — the whole model (FullstackRequestValidator's links).
 */
export function checkExpr(text: string, entity: FullstackEntityDef, expected: ExprType | null = 'BOOL',
                          entities: readonly FullstackEntityDef[] = []): string[] {
  const root = parse(text)
  const fields = new Map(entity.fields.map(f => [f.name, f]))
  const links = linksOf(entity, entities)
  const linked = new Map<string, FullstackFieldDef>()
  const refs: string[] = []
  const fieldOf = (name: string) => (name.includes('.') ? linked.get(name) : fields.get(name))!
  const path = (n: { name: string; at: number }): ExprType => {
    const [relation, name] = n.name.split('.')
    const target = links.get(relation)
    if (!target) {
      const loose = [...links.keys()].find(k => k.toLowerCase() === relation.toLowerCase())
      throw new ExprError(`'${relation}' is not a link of this entity (a MANY_TO_ONE)${
        loose ? ` (did you mean '${loose}'?)` : links.size ? ` \u2014 its links are ${[...links.keys()].join(', ')}` : ''}`, n.at)
    }
    const f = target.fields.find(x => x.name === name)
    if (!f) {
      const loose = target.fields.find(x => x.name.toLowerCase() === name.toLowerCase())
      throw new ExprError(`'${name}' is not a field of ${target.name}${loose ? ` (did you mean '${loose.name}'?)` : ''}`, n.at)
    }
    const t = typeOfField(f)
    if (t == null || f.type === 'TEXT' || f.type === 'MARKDOWN') {
      throw new ExprError(`'${n.name}' (${f.type}) cannot be read through a link: only a short value can`, n.at)
    }
    linked.set(n.name, f)
    return t
  }
  const need = (actual: ExprType, wanted: ExprType, at: number, what: string) => {
    if (actual !== wanted) throw new ExprError(`${what} takes ${DESCRIBE[wanted]}, not ${DESCRIBE[actual]}`, at)
  }
  const enumLiteral = (enumSide: Node, textSide: Node) => {
    if (textSide.k !== 'lit' || enumSide.k !== 'ref') return
    const f = fieldOf(enumSide.name)
    const text = String(textSide.value)
    if (!(f.enumValues ?? []).some(v => v.toLowerCase() === text.toLowerCase())) {
      throw new ExprError(`'${text}' is not one of ${f.name}'s values (${(f.enumValues ?? []).join(', ')})`, textSide.at)
    }
  }
  function type(n: Node, emptiness = false): ExprType {
    switch (n.k) {
      case 'lit': return typeof n.value === 'number' ? 'NUMBER' : typeof n.value === 'boolean' ? 'BOOL' : 'TEXT'
      case 'ref': {
        if (n.name.includes('.')) return path(n)
        const f = fields.get(n.name)
        if (!f) {
          const loose = entity.fields.find(x => x.name.toLowerCase() === n.name.toLowerCase())
          throw new ExprError(`'${n.name}' is not a field of this entity${loose ? ` (did you mean '${loose.name}'?)` : ''}`, n.at)
        }
        if (!refs.includes(f.name)) refs.push(f.name)
        const t = typeOfField(f)
        if (t == null) {
          if (emptiness) return 'ANY'
          throw new ExprError(`'${f.name}' (${f.type}) can only be tested with isEmpty()`, n.at)
        }
        return t
      }
      case 'unary': {
        const t = type(n.operand)
        if (n.op === '-') { need(t, 'NUMBER', n.operand.at, "'-'"); return 'NUMBER' }
        need(t, 'BOOL', n.operand.at, "'not'")
        return 'BOOL'
      }
      case 'binary': {
        const l = type(n.left)
        const r = type(n.right)
        switch (n.op) {
          case 'and': case 'or':
            need(l, 'BOOL', n.left.at, `'${n.op}'`); need(r, 'BOOL', n.right.at, `'${n.op}'`)
            return 'BOOL'
          case '==': case '!=': case '<': case '<=': case '>': case '>=': {
            const ordered = !['==', '!='].includes(n.op)
            if ((l === 'ENUM' && r === 'TEXT') || (l === 'TEXT' && r === 'ENUM')) {
              if (l === 'ENUM') enumLiteral(n.left, n.right); else enumLiteral(n.right, n.left)
              if (ordered) throw new ExprError('Enum values are not ordered: compare with == or !=', n.at)
              return 'BOOL'
            }
            if (l !== r) throw new ExprError(`Cannot compare ${DESCRIBE[l]} with ${DESCRIBE[r]}`, n.at)
            if (ordered && (l === 'BOOL' || l === 'ENUM')) throw new ExprError(`${DESCRIBE[l]} is not ordered: compare with == or !=`, n.at)
            return 'BOOL'
          }
          case '+':
            if (l === 'NUMBER' && r === 'NUMBER') return 'NUMBER'
            if (l === 'TEXT' && r === 'TEXT') return 'TEXT'
            if ((l === 'DATE' && r === 'NUMBER') || (l === 'NUMBER' && r === 'DATE')) return 'DATE'
            throw new ExprError(`'+' adds two numbers, joins two texts, or adds days to a date — not ${DESCRIBE[l]} and ${DESCRIBE[r]}`, n.at)
          case '-':
            if (l === 'NUMBER' && r === 'NUMBER') return 'NUMBER'
            if (l === 'DATE' && r === 'NUMBER') return 'DATE'
            throw new ExprError(`'-' takes two numbers, or days from a date (daysBetween(a, b) is the days between two dates) — not ${DESCRIBE[l]} and ${DESCRIBE[r]}`, n.at)
          default:
            need(l, 'NUMBER', n.left.at, `'${n.op}'`); need(r, 'NUMBER', n.right.at, `'${n.op}'`)
            return 'NUMBER'
        }
      }
      case 'call': {
        const fn = EXPR_FUNCTIONS.find(x => x.toLowerCase() === n.fn.toLowerCase())
        if (!fn) throw new ExprError(`'${n.fn}' is not a function (there are ${EXPR_FUNCTIONS.join(', ')})`, n.at)
        const arity = (count: number) => {
          if (n.args.length !== count) {
            throw new ExprError(`${fn} takes ${count === 0 ? 'no arguments' : count === 1 ? 'one argument' : `${count} arguments`}`, n.at)
          }
        }
        switch (fn) {
          case 'isEmpty': arity(1); type(n.args[0], true); return 'BOOL'
          case 'today': arity(0); return 'DATE'
          case 'now': arity(0); return 'DATETIME'
          case 'daysBetween': {
            arity(2)
            const a = type(n.args[0])
            const b = type(n.args[1])
            if (a !== b || !['DATE', 'DATETIME', 'INSTANT'].includes(a)) {
              throw new ExprError(`daysBetween takes two dates, or two dates and times — not ${DESCRIBE[a]} and ${DESCRIBE[b]}`, n.at)
            }
            return 'NUMBER'
          }
          case 'length': {
            arity(1)
            const a = type(n.args[0])
            if (a !== 'TEXT' && a !== 'ENUM') need(a, 'TEXT', n.args[0].at, 'length')
            return 'NUMBER'
          }
          case 'abs': arity(1); need(type(n.args[0]), 'NUMBER', n.args[0].at, 'abs'); return 'NUMBER'
          case 'round': {
            arity(2)
            need(type(n.args[0]), 'NUMBER', n.args[0].at, 'round')
            const places = n.args[1]
            if (places.k !== 'lit' || typeof places.value !== 'number' || !Number.isInteger(places.value) || places.value < 0 || places.value > 10) {
              throw new ExprError("round's second argument is a whole number of decimal places, 0 to 10", places.at)
            }
            return 'NUMBER'
          }
          default: {
            arity(1)
            const arg = n.args[0]
            if (arg.k !== 'lit' || typeof arg.value !== 'string') throw new ExprError("date takes a date written out: date('2025-01-31')", n.at)
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(arg.value)
            const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null
            if (!m || !d || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
              throw new ExprError(`'${arg.value}' is not a date (year-month-day, like 2025-01-31)`, arg.at)
            }
            return 'DATE'
          }
        }
      }
    }
  }
  const t = type(root)
  if (expected && t !== expected) throw new ExprError(`This must be ${DESCRIBE[expected]}, but it is ${DESCRIBE[t]}`, root.at)
  return refs
}

/** Why an expression does not fit, or undefined. */
export function exprProblem(text: string, entity: FullstackEntityDef, expected: ExprType | null = 'BOOL',
                            entities: readonly FullstackEntityDef[] = []): string | undefined {
  try {
    checkExpr(text, entity, expected, entities)
    return undefined
  } catch (e) {
    if (e instanceof ExprError) return e.describe()
    throw e
  }
}

/** The text with every reading of field `from` renamed to `to` (names inside texts and functions are left alone). */
export function renameInExpr(text: string, from: string, to: string): string {
  return renameNamesInExpr(text, name => (name === from ? to : name))
}

/** The text with each name read (a field, or `link.field`) passed through `rename`. */
export function renameNamesInExpr(text: string, rename: (name: string) => string): string {
  let tokens: Token[]
  try {
    tokens = lex(text)
  } catch {
    return text
  }
  let out = ''
  let last = 0
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const call = tokens[i + 1]?.kind === 'op' && tokens[i + 1].text === '('
    if (t.kind !== 'name' || call) continue
    const to = rename(t.text)
    if (to !== t.text) {
      out += text.slice(last, t.at) + to
      last = t.at + t.text.length
    }
  }
  return out + text.slice(last)
}
