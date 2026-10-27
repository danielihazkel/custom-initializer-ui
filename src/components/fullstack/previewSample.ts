import type { FullstackFieldDef } from '../../types'
import { enumLabel } from './enumLabels'
import { fieldLabel } from './uiPreview'

/**
 * Made-up rows for the layout preview: values that read like the entity's own data — a person's
 * name in a customer's `name`, an e-mail in `email`, a price in `price`, a date a few days back —
 * instead of "Name 1". Everything is deterministic (the same entity, field and row always give
 * the same value), so the canvas does not shuffle on every keystroke, and dates count back from
 * `today` so they look current.
 */

export type SampleLocale = 'en' | 'he'

export interface SampleContext {
  locale: SampleLocale
  /** The entity the field belongs to: `name` reads as a person, a company or a product by it. */
  entity: string
  /** "Now" for relative dates; tests pin it. */
  today?: Date
}

/** A value as the generated API would send it: dates as ISO strings. */
export type SampleRaw = string | number | boolean

/** A small deterministic generator (mulberry32 over a string hash). */
export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0
  return h
}

// ── Word lists ──────────────────────────────────────────────────────────────

const WORDS = {
  en: {
    first: ['Noa', 'Daniel', 'Maya', 'Ethan', 'Tamar', 'Lior', 'Sarah', 'Omer', 'Rachel', 'Yoni', 'Dana', 'Adam'],
    last: ['Cohen', 'Levi', 'Mizrahi', 'Peretz', 'Biton', 'Friedman', 'Katz', 'Shapiro', 'Avraham', 'Dahan'],
    company: ['Northwind Ltd', 'Blue Harbor Inc', 'Cedar Systems', 'Orion Logistics', 'Galil Foods', 'Summit Health', 'Keren Media', 'Atlas Supply'],
    product: ['Desk lamp', 'Office chair', 'Notebook A5', 'Wireless mouse', 'Coffee beans 1kg', 'Water bottle', 'USB-C cable', 'Standing desk'],
    place: ['Tel Aviv', 'Haifa', 'Jerusalem', 'Beersheba', 'Netanya', 'Eilat', 'Herzliya', 'Ashdod'],
    country: ['Israel', 'Germany', 'France', 'United States', 'Japan', 'Italy', 'Canada', 'Spain'],
    street: ['Herzl St', 'Rothschild Blvd', 'Ben Yehuda St', 'Dizengoff St', 'Jaffa Rd', 'Allenby St'],
    category: ['Operations', 'Sales', 'Finance', 'Support', 'Marketing', 'Research', 'Logistics', 'Legal'],
    project: ['Website relaunch', 'Mobile app', 'Data migration', 'Customer portal', 'Billing upgrade', 'Q4 campaign'],
    codename: ['Alpha', 'Beacon', 'Cedar', 'Delta', 'Ember', 'Falcon', 'Granite', 'Harbor'],
    title: ['Renew the annual contract', 'Fix the login timeout', 'Prepare the monthly report', 'Call back about the invoice',
      'Update the shipping address', 'Review the new design', 'Order more stock', 'Plan the team offsite'],
    sentence: ['Waiting for the customer to confirm.', 'Follow up next week.', 'Delivered on time, no issues.',
      'Needs a second review before approval.', 'Discussed by phone; details in the attachment.', 'Priority raised after the outage.'],
    status: ['Active', 'Pending', 'On hold', 'Closed'],
    color: ['Blue', 'Green', 'Red', 'Black', 'White', 'Yellow'],
  },
  he: {
    first: ['נועה', 'דניאל', 'מאיה', 'איתן', 'תמר', 'ליאור', 'שרה', 'עומר', 'רחל', 'יוני', 'דנה', 'אדם'],
    last: ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'פרידמן', 'כץ', 'שפירא', 'אברהם', 'דהן'],
    company: ['צפון בע״מ', 'נמל כחול', 'ארז מערכות', 'אוריון לוגיסטיקה', 'מזון הגליל', 'פסגה בריאות', 'קרן מדיה', 'אטלס אספקה'],
    product: ['מנורת שולחן', 'כיסא משרדי', 'מחברת A5', 'עכבר אלחוטי', 'פולי קפה 1 ק״ג', 'בקבוק מים', 'כבל USB-C', 'שולחן עמידה'],
    place: ['תל אביב', 'חיפה', 'ירושלים', 'באר שבע', 'נתניה', 'אילת', 'הרצליה', 'אשדוד'],
    country: ['ישראל', 'גרמניה', 'צרפת', 'ארצות הברית', 'יפן', 'איטליה', 'קנדה', 'ספרד'],
    street: ['הרצל', 'שדרות רוטשילד', 'בן יהודה', 'דיזנגוף', 'דרך יפו', 'אלנבי'],
    category: ['תפעול', 'מכירות', 'כספים', 'תמיכה', 'שיווק', 'מחקר', 'לוגיסטיקה', 'משפטי'],
    project: ['השקת האתר', 'אפליקציה', 'הסבת נתונים', 'פורטל לקוחות', 'שדרוג חיובים', 'קמפיין רבעון 4'],
    codename: ['אלפא', 'מגדלור', 'ארז', 'דלתא', 'גחלת', 'בז', 'גרניט', 'נמל'],
    title: ['חידוש החוזה השנתי', 'תיקון ניתוק בכניסה', 'הכנת הדוח החודשי', 'לחזור ללקוח בעניין החשבונית',
      'עדכון כתובת המשלוח', 'סקירת העיצוב החדש', 'הזמנת מלאי', 'תכנון יום צוות'],
    sentence: ['ממתינים לאישור הלקוח.', 'לחזור בשבוע הבא.', 'נמסר בזמן, ללא תקלות.',
      'דרושה בדיקה נוספת לפני אישור.', 'סוכם בטלפון, הפרטים בקובץ המצורף.', 'העדיפות הועלתה אחרי התקלה.'],
    status: ['פעיל', 'ממתין', 'מושהה', 'סגור'],
    color: ['כחול', 'ירוק', 'אדום', 'שחור', 'לבן', 'צהוב'],
  },
} as const

// Latin names for e-mail addresses and user names, in either language.
const LATIN_FIRST = WORDS.en.first
const LATIN_LAST = WORDS.en.last

// ── Name heuristics ─────────────────────────────────────────────────────────

const has = (name: string, ...parts: string[]) => parts.some(p => name.includes(p))

/** What an entity's own `name` / `title` holds, read from the entity's name. */
function entityKind(entity: string): 'person' | 'company' | 'product' | 'place' | 'category' | 'project' | undefined {
  const e = entity.toLowerCase()
  if (has(e, 'customer', 'client', 'employee', 'user', 'person', 'contact', 'agent', 'member', 'student',
    'author', 'owner', 'assignee', 'patient', 'teacher', 'driver', 'staff', 'applicant', 'candidate')) return 'person'
  if (has(e, 'company', 'supplier', 'vendor', 'organization', 'organisation', 'partner', 'account', 'tenant', 'insurer')) return 'company'
  if (has(e, 'product', 'item', 'article', 'sku', 'part', 'asset', 'equipment')) return 'product'
  if (has(e, 'warehouse', 'store', 'branch', 'location', 'site', 'office', 'city', 'region', 'room')) return 'place'
  if (has(e, 'category', 'tag', 'department', 'team', 'group', 'type', 'segment', 'center', 'centre')) return 'category'
  if (has(e, 'project', 'campaign', 'program', 'course')) return 'project'
  return undefined
}

const MONEY = ['price', 'amount', 'total', 'cost', 'salary', 'balance', 'fee', 'budget', 'revenue', 'payment', 'premium', 'sum']

function numberRange(name: string, decimal: boolean): [number, number] {
  if (has(name, 'qty', 'quantity', 'count', 'stock', 'units', 'items')) return [1, 60]
  if (has(name, 'age')) return [18, 70]
  if (has(name, 'year')) return [2018, 2026]
  if (has(name, 'rating', 'score', 'priority', 'level', 'rank', 'stars')) return [1, 5]
  if (has(name, 'percent', 'pct', 'rate', 'discount')) return [0, 100]
  if (has(name, ...MONEY)) return [20, 4800]
  return decimal ? [5, 900] : [1, 500]
}

/** A field whose date lies ahead rather than behind. */
const FUTURE = ['due', 'deadline', 'until', 'expires', 'expiry', 'end', 'planned', 'scheduled', 'next', 'deliver']

// ── Values ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function dateFor(name: string, row: number, rand: () => number, today: Date): Date {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (has(name, 'birth', 'dob')) return new Date(1970 + Math.floor(rand() * 30), Math.floor(rand() * 12), 1 + Math.floor(rand() * 28))
  const days = row * 3 + Math.floor(rand() * 3)
  d.setDate(d.getDate() + (has(name, ...FUTURE) ? days : -days))
  return d
}

function uuid(rand: () => number): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('')
  return `${hex(8)}-${hex(4)}-4${hex(3)}-8${hex(3)}-${hex(12)}`
}

/** A string for a text field, by its name and the entity it belongs to; undefined when nothing fits. */
function textFor(f: FullstackFieldDef, row: number, ctx: SampleContext, pick: <T>(list: readonly T[], shift?: number) => T): string | undefined {
  const w = WORDS[ctx.locale]
  const n = f.name.toLowerCase()
  const person = () => `${pick(w.first)} ${pick(w.last, 3)}`
  const latin = () => [pick(LATIN_FIRST), pick(LATIN_LAST, 3)].map(s => s.toLowerCase())
  if (f.email || has(n, 'email', 'mail')) return `${latin().join('.')}@example.com`
  if (has(n, 'phone', 'mobile', 'tel', 'fax')) {
    const tail = String(1000000 + ((hash(`${ctx.entity}:${f.name}`) + row * 7919) % 9000000)).slice(1)
    return ctx.locale === 'he' ? `05${row % 10}-${tail}` : `(555) 01${row % 10}-${tail.slice(0, 4)}`
  }
  // Who a row is assigned to is a user id, as the SSO header carries it.
  if (has(n, 'username', 'login', 'handle', 'userid', 'assignee')) return latin().join('.')
  if (has(n, 'firstname', 'givenname') || n === 'first') return pick(w.first)
  if (has(n, 'lastname', 'surname', 'familyname') || n === 'last') return pick(w.last)
  if (has(n, 'fullname', 'contact', 'person', 'manager', 'owner', 'author', 'agent')) return person()
  if (has(n, 'company', 'supplier', 'vendor', 'organization', 'organisation', 'employer', 'insurer')) return pick(w.company)
  if (has(n, 'city', 'town')) return pick(w.place)
  if (has(n, 'country', 'nation')) return pick(w.country)
  if (has(n, 'address', 'street')) return `${pick(w.street)} ${(row * 13) % 90 + 2}`
  if (has(n, 'zip', 'postal', 'postcode')) return String(10000 + ((hash(f.name) + row * 4721) % 89999))
  if (has(n, 'url', 'website', 'link', 'site')) return `example.com/${ctx.entity.toLowerCase()}/${row}`
  if (has(n, 'sku', 'code', 'ref', 'serial', 'number', 'barcode') && !has(n, 'phone')) {
    const prefix = ctx.entity.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'REF'
    return `${prefix}-${1000 + row * 7}`
  }
  if (has(n, 'description', 'notes', 'note', 'body', 'comment', 'details', 'content', 'remarks', 'reason', 'summary', 'text')) return pick(w.sentence)
  if (has(n, 'title', 'subject', 'headline', 'topic', 'task')) {
    const kind = entityKind(ctx.entity)
    return kind === 'project' ? pick(w.project) : kind === 'product' ? pick(w.product) : pick(w.title)
  }
  if (has(n, 'status', 'state')) return pick(w.status)
  if (has(n, 'colo')) return pick(w.color)
  if (has(n, 'name', 'label')) {
    switch (entityKind(ctx.entity)) {
      case 'person': return person()
      case 'company': return pick(w.company)
      case 'product': return pick(w.product)
      case 'place': return pick(w.place)
      case 'category': return pick(w.category)
      case 'project': return pick(w.project)
      default: return pick(w.codename)
    }
  }
  return undefined
}

/** Whether `value` passes the field's own `pattern` (anchored, as the generated check is). */
function fitsPattern(f: FullstackFieldDef, value: string): boolean {
  if (!f.pattern) return true
  try {
    return new RegExp(`^(?:${f.pattern})$`).test(value)
  } catch {
    return true
  }
}

/** Row `row` (from 1) of field `f`, as the API would send it. */
export function sampleRaw(f: FullstackFieldDef, row: number, ctx: SampleContext): SampleRaw {
  const rand = seeded(`${ctx.entity}:${f.name}:${row}`)
  const base = hash(`${ctx.entity}:${f.name}`)
  // Consecutive rows take consecutive words, so three rows never repeat one.
  const pick = <T,>(list: readonly T[], shift = 0): T => list[(base + shift + row - 1) % list.length]
  const today = ctx.today ?? new Date()
  if (f.primaryKey) return f.type === 'UUID' ? uuid(rand) : f.type === 'LONG' || f.type === 'INTEGER' ? row : `${f.name.toUpperCase().slice(0, 3)}-${row}`
  // The first row shows what a new record starts with.
  if (row === 1 && f.defaultValue != null && f.defaultValue !== '') {
    const v = f.defaultValue
    if (f.type === 'BOOLEAN') return v === 'true'
    if (f.type === 'LONG' || f.type === 'INTEGER' || f.type === 'BIG_DECIMAL') return Number(v)
    return v
  }
  switch (f.type) {
    case 'BOOLEAN': return row % 2 === 1
    case 'ENUM': {
      const values = f.enumValues ?? []
      return values.length ? values[(row - 1) % values.length] : ''
    }
    case 'LONG':
    case 'INTEGER':
    case 'BIG_DECIMAL': {
      const decimal = f.type === 'BIG_DECIMAL'
      let [lo, hi] = numberRange(f.name.toLowerCase(), decimal)
      if (f.min != null && Number.isFinite(Number(f.min))) lo = Number(f.min)
      if (f.max != null && Number.isFinite(Number(f.max))) hi = Number(f.max)
      if (f.min != null && f.max == null && hi < lo) hi = lo + 100
      if (f.max != null && f.min == null && lo > hi) lo = Math.min(0, hi)
      if (hi < lo) [lo, hi] = [hi, lo]
      const v = lo + rand() * (hi - lo)
      return decimal ? Math.round(v * 100) / 100 : Math.round(v)
    }
    case 'LOCAL_DATE': return isoDate(dateFor(f.name.toLowerCase(), row, rand, today))
    case 'LOCAL_DATE_TIME': {
      const d = dateFor(f.name.toLowerCase(), row, rand, today)
      return `${isoDate(d)}T${pad(8 + Math.floor(rand() * 10))}:${pad(Math.floor(rand() * 4) * 15)}:00`
    }
    case 'UUID': return uuid(rand)
    default: {
      const fallback = `${fieldLabel(f)} ${row}`
      const text = textFor(f, row, ctx, pick)
      const value = text != null && fitsPattern(f, text) ? text : fallback
      return f.length != null && f.length > 0 ? value.slice(0, f.length) : value
    }
  }
}

/** A value as a generated list cell shows it: an enum's label, anything else as the API sent it
 *  (`String(value)` — ISO dates, `true`/`false`, plain numbers). */
export function cellText(f: FullstackFieldDef, raw: SampleRaw): string {
  if (f.type === 'ENUM' && typeof raw === 'string') return raw ? enumLabel(f, raw) : '—'
  return String(raw)
}

/** A value as the generated details (drawer, record page, review) show it: booleans worded,
 *  dates and date-times in the app's locale. */
export function detailText(f: FullstackFieldDef, raw: SampleRaw, locale: SampleLocale, words: { yes: string; no: string }): string {
  if (f.type === 'BOOLEAN') return raw === true || raw === 'true' ? words.yes : words.no
  if (f.type === 'LOCAL_DATE' && typeof raw === 'string') {
    const d = new Date(`${raw}T00:00:00`)
    return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString(locale)
  }
  if (f.type === 'LOCAL_DATE_TIME' && typeof raw === 'string') {
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? raw : d.toLocaleString(locale)
  }
  return cellText(f, raw)
}

/** An audit timestamp (`createdAt` / `updatedAt`) of row `row`, as the generated list shows it. */
export function auditText(row: number, updated: boolean, locale: SampleLocale, today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - row * (updated ? 1 : 4), 9 + row, updated ? 40 : 5)
  return d.toLocaleString(locale)
}
