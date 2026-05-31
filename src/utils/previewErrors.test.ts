import { describe, it, expect } from 'vitest'
import { readErrorBody } from './previewErrors'

/** Builds a minimal stand-in for a fetch Response with the bits readErrorBody touches. */
function fakeResponse(status: number, json: () => Promise<unknown>): Response {
  return { status, json } as unknown as Response
}

describe('readErrorBody', () => {
  it('prefers detail over messages and error', async () => {
    const res = fakeResponse(400, async () => ({
      error: 'SqlParseException',
      detail: 'near "FROO": syntax error',
      messages: ['first', 'second'],
    }))
    const out = await readErrorBody(res)
    expect(out.message).toBe('near "FROO": syntax error')
    expect(out.kind).toBe('SqlParseException')
  })

  it('falls back to joined messages when detail is absent', async () => {
    const res = fakeResponse(400, async () => ({ messages: ['a', 'b'] }))
    const out = await readErrorBody(res)
    expect(out.message).toBe('a; b')
  })

  it('falls back to error when detail and messages are absent', async () => {
    const res = fakeResponse(409, async () => ({ error: 'Duplicate' }))
    const out = await readErrorBody(res)
    expect(out.message).toBe('Duplicate')
  })

  it('passes through dep, snippet and statementIndex', async () => {
    const res = fakeResponse(400, async () => ({
      error: 'SqlParseException',
      detail: 'bad',
      dep: 'data-jpa',
      snippet: 'CREATE TABL',
      statementIndex: 2,
    }))
    const out = await readErrorBody(res)
    expect(out.dep).toBe('data-jpa')
    expect(out.snippet).toBe('CREATE TABL')
    expect(out.statementIndex).toBe(2)
  })

  it('falls back to HTTP {status} when body is null', async () => {
    const res = fakeResponse(503, async () => null)
    const out = await readErrorBody(res)
    expect(out.message).toBe('HTTP 503')
  })

  it('falls back to HTTP {status} when the body is not JSON', async () => {
    const res = fakeResponse(500, async () => { throw new Error('not json') })
    const out = await readErrorBody(res)
    expect(out.message).toBe('HTTP 500')
  })
})
