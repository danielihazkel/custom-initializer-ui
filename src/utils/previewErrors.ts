import type { PreviewError } from '../types'

export async function readErrorBody(res: Response): Promise<PreviewError> {
  const fallback: PreviewError = { message: `HTTP ${res.status}` }
  try {
    const body = await res.json() as {
      error?: string; detail?: string; dep?: string;
      snippet?: string; statementIndex?: number; messages?: string[]
    } | null
    if (!body) return fallback
    const messages = Array.isArray(body.messages) && body.messages.length > 0
      ? body.messages.join('; ')
      : null
    return {
      message: body.detail ?? messages ?? body.error ?? fallback.message,
      kind: body.error,
      dep: body.dep,
      snippet: body.snippet,
      statementIndex: body.statementIndex,
    }
  } catch {
    return fallback
  }
}
