/**
 * Matching for the search boxes: the dependency picker, the command palette, the file explorer.
 *
 * A query matches a text when it is a substring of it, or — failing that — when its letters
 * appear in order and mostly at the starts of words or next to each other ("sdj" → **S**pring
 * **D**ata **J**PA, "sprweb" → **Spr**ing **Web**). Letters scattered through a word are not a
 * match: that is what makes a fuzzy search feel random. Several words must each match.
 *
 * No library: this is ~100 lines and the app is deployed offline.
 */
export interface FuzzyMatch {
  /** Higher is better. Exact > prefix > start of a word > inside a word > letters in order. */
  score: number
  /** Matched stretches of the text as [start, end) pairs, sorted and not overlapping. */
  ranges: [number, number][]
}

const SCORE_EXACT = 100
const SCORE_PREFIX = 90
const SCORE_WORD_START = 80
const SCORE_INSIDE = 70
/** Letters in order score between these two, by how tidy the match is. */
const SCORE_FUZZY_MIN = 10
const SCORE_FUZZY_SPAN = 50
/** Below this average bonus per letter, letters in order are a coincidence, not a match. Initials
 *  alone score 0.8 a letter; one word start followed by letters from the middle of a word ("gen" in
 *  "Go to Backend") scores 0.6, and reads as noise in a result list. */
const FUZZY_QUALITY_MIN = 0.7

const BONUS_CONSECUTIVE = 1
const BONUS_WORD_START = 0.8
const PENALTY_GAP = 0.01

function isWordStart(text: string, i: number): boolean {
  if (i === 0) return true
  const prev = text[i - 1]
  const ch = text[i]
  if (/[\s\-_./:()[\]]/.test(prev)) return true
  // camelCase and letter→digit boundaries: "webFlux", "oauth2".
  return (/[a-z]/.test(prev) && /[A-Z]/.test(ch)) || (/[a-zA-Z]/.test(prev) && /[0-9]/.test(ch))
}

/** One word of the query against the text. */
function matchToken(token: string, text: string, lower: string): FuzzyMatch | null {
  const at = lower.indexOf(token)
  if (at >= 0) {
    // Prefer an occurrence at the start of a word over an earlier one inside a word.
    let best = at
    for (let i = at; i >= 0; i = lower.indexOf(token, i + 1)) {
      if (isWordStart(text, i)) { best = i; break }
    }
    const score =
      token.length === lower.length ? SCORE_EXACT
        : best === 0 ? SCORE_PREFIX
          : isWordStart(text, best) ? SCORE_WORD_START
            : SCORE_INSIDE
    // A shorter text is the closer match of two that both start with the query.
    return { score: score - Math.min(text.length, 200) / 1000, ranges: [[best, best + token.length]] }
  }
  return matchInOrder(token, text, lower)
}

/**
 * The best way to find the token's letters in order. `ending[i][j]` is the best score with
 * letter i matched at position j; `upTo[i][j]` the best with letter i matched at or before j —
 * the usual two-table recurrence, O(letters × length).
 */
function matchInOrder(token: string, text: string, lower: string): FuzzyMatch | null {
  const m = token.length
  const n = lower.length
  if (m > n) return null
  // Cheap refusal first: most texts do not even hold the letters in order.
  for (let i = 0, j = 0; i < m; i++, j++) {
    j = lower.indexOf(token[i], j)
    if (j < 0) return null
  }

  const NONE = -Infinity
  const ending: number[][] = []
  const upTo: number[][] = []
  for (let i = 0; i < m; i++) {
    const e = new Array<number>(n).fill(NONE)
    const u = new Array<number>(n).fill(NONE)
    let best = NONE
    for (let j = 0; j < n; j++) {
      if (lower[j] === token[i]) {
        const bonus = isWordStart(text, j) ? BONUS_WORD_START : 0
        if (i === 0) {
          e[j] = bonus
        } else if (j > 0) {
          const afterGap = upTo[i - 1][j - 1] + bonus
          const consecutive = ending[i - 1][j - 1] + BONUS_CONSECUTIVE
          e[j] = Math.max(afterGap, consecutive)
        }
      }
      best = Math.max(e[j], best === NONE ? NONE : best - PENALTY_GAP)
      u[j] = best
    }
    ending.push(e)
    upTo.push(u)
  }

  const total = upTo[m - 1][n - 1]
  if (total === NONE || total / m < FUZZY_QUALITY_MIN) return null

  // Walk back to find which positions were used.
  const positions = new Array<number>(m)
  let consecutiveNext = false
  for (let i = m - 1, j = n - 1; i >= 0; i--) {
    for (; j >= 0; j--) {
      const here = ending[i][j]
      if (here !== NONE && (consecutiveNext || here === upTo[i][j])) {
        consecutiveNext = i > 0 && j > 0 && here === ending[i - 1][j - 1] + BONUS_CONSECUTIVE
        positions[i] = j--
        break
      }
    }
  }

  const ranges: [number, number][] = []
  for (const p of positions) {
    const last = ranges[ranges.length - 1]
    if (last && last[1] === p) last[1] = p + 1
    else ranges.push([p, p + 1])
  }
  const quality = Math.min(1, total / m)
  return { score: SCORE_FUZZY_MIN + SCORE_FUZZY_SPAN * quality, ranges }
}

function mergeRanges(ranges: [number, number][]): [number, number][] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const out: [number, number][] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else out.push([r[0], r[1]])
  }
  return out
}

/**
 * Matches `query` against `text`, ignoring case. An empty query matches everything with no
 * ranges. With several words, every word must match and the weakest one sets the score.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { score: 0, ranges: [] }
  const lower = text.toLowerCase()
  // The whole query as one phrase beats its words found apart.
  if (tokens.length > 1) {
    const phrase = tokens.join(' ')
    const whole = matchToken(phrase, text, lower)
    if (whole && whole.score >= SCORE_INSIDE - 1) return whole
  }
  let score = Infinity
  const ranges: [number, number][] = []
  for (const token of tokens) {
    const m = matchToken(token, text, lower)
    if (!m) return null
    score = Math.min(score, m.score)
    ranges.push(...m.ranges)
  }
  return { score, ranges: mergeRanges(ranges) }
}

/** Plain substring ranges, for long text (descriptions) where letters-in-order would be noise. */
export function substringMatch(query: string, text: string): FuzzyMatch | null {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { score: 0, ranges: [] }
  const lower = text.toLowerCase()
  const ranges: [number, number][] = []
  for (const token of tokens) {
    const at = lower.indexOf(token)
    if (at < 0) return null
    ranges.push([at, at + token.length])
  }
  return { score: 1, ranges: mergeRanges(ranges) }
}
