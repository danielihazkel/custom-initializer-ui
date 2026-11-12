import { describe, expect, it } from 'vitest'
import { fuzzyMatch, substringMatch } from './fuzzy'

/** The matched letters, bracketed — easier to read than index pairs. */
function marked(query: string, text: string): string | null {
  const m = fuzzyMatch(query, text)
  if (!m) return null
  let out = ''
  let at = 0
  for (const [from, to] of m.ranges) {
    out += text.slice(at, from) + '[' + text.slice(from, to) + ']'
    at = to
  }
  return out + text.slice(at)
}

const score = (query: string, text: string) => fuzzyMatch(query, text)?.score ?? -1

describe('fuzzyMatch', () => {
  it('finds a substring, whatever the case, and says where', () => {
    expect(marked('kafka', 'Spring for Apache Kafka')).toBe('Spring for Apache [Kafka]')
    expect(marked('JPA', 'Spring Data jpa')).toBe('Spring Data [jpa]')
  })

  it('prefers the start of a word to the inside of an earlier one', () => {
    // "web" is inside "Cobweb" first, and starts a word later.
    expect(marked('web', 'Cobweb Web')).toBe('Cobweb [Web]')
  })

  it('ranks exact over prefix over word start over inside over letters in order', () => {
    const exact = score('web', 'Web')
    const prefix = score('web', 'Web Services')
    const wordStart = score('web', 'Spring Web')
    const inside = score('web', 'Cobwebs')
    const inOrder = score('sprweb', 'Spring Web')
    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(wordStart)
    expect(wordStart).toBeGreaterThan(inside)
    expect(inside).toBeGreaterThan(inOrder)
    expect(inOrder).toBeGreaterThan(0)
  })

  it('puts the shorter of two prefix matches first', () => {
    expect(score('spring', 'Spring Web')).toBeGreaterThan(score('spring', 'Spring Boot Actuator Extras'))
  })

  it('matches initials and the starts of words in order', () => {
    expect(marked('sdj', 'Spring Data JPA')).toBe('[S]pring [D]ata [J]PA')
    expect(marked('sprweb', 'Spring Web')).toBe('[Spr]ing [Web]')
    expect(marked('wf', 'webFlux')).toBe('[w]eb[F]lux')
  })

  it('does not match letters merely scattered through the text', () => {
    // p…g…k and r…n…w are all there in order, but inside words: a coincidence.
    expect(fuzzyMatch('pgk', 'Spring Kafka')).toBeNull()
    expect(fuzzyMatch('rnw', 'Spring Web')).toBeNull()
    expect(fuzzyMatch('xyz', 'Spring Web')).toBeNull()
    // One word start, then letters from inside words.
    expect(fuzzyMatch('gen', 'Go to Backend')).toBeNull()
    expect(fuzzyMatch('kfk', 'Kafka')).toBeNull()
    expect(fuzzyMatch('websocket', 'Web')).toBeNull()
  })

  it('needs every word of the query, in any order, and merges what they hit', () => {
    expect(marked('jpa data', 'Spring Data JPA')).toBe('Spring [Data] [JPA]')
    expect(fuzzyMatch('data mongo', 'Spring Data JPA')).toBeNull()
    // The words as one phrase win over the words apart.
    expect(marked('data jpa', 'Spring Data JPA')).toBe('Spring [Data JPA]')
  })

  it('matches everything on an empty query, with nothing marked', () => {
    expect(fuzzyMatch('', 'Anything')).toEqual({ score: 0, ranges: [] })
    expect(fuzzyMatch('   ', 'Anything')).toEqual({ score: 0, ranges: [] })
  })
})

describe('substringMatch', () => {
  it('takes plain substrings only', () => {
    expect(substringMatch('mvc', 'Build web applications with Spring MVC')?.ranges).toEqual([[35, 38]])
    expect(substringMatch('sdj', 'Spring Data JPA')).toBeNull()
  })
})
