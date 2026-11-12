/** A search stops listing here: past it, the words typed are too common to be a search. */
export const MAX_SEARCH_HITS = 200

export interface SearchHit {
  path: string
  /** 1-based. */
  line: number
  /** The line, cut around the match when it is long. */
  text: string
  /** Where in `text` the words were found. */
  from: number
  to: number
}

/**
 * Every line of every file that holds `query` (ignoring case), in file order, up to `max` — the
 * Explore modal's "search in files". The files are already in memory (a preview is the whole
 * project), so this is a plain scan; two letters at least, or it would list every line.
 */
export function searchFiles(
  files: { path: string; content: string }[],
  query: string,
  max = MAX_SEARCH_HITS,
): { hits: SearchHit[]; more: boolean } {
  const q = query.trim().toLowerCase()
  const hits: SearchHit[] = []
  if (q.length < 2) return { hits, more: false }
  for (const file of files) {
    if (!file.content.toLowerCase().includes(q)) continue
    const lines = file.content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const at = lines[i].toLowerCase().indexOf(q)
      if (at < 0) continue
      if (hits.length >= max) return { hits, more: true }
      // A long line is cut around the match, so the hit is always on screen.
      const start = Math.max(0, at - 40)
      const lead = start > 0 ? '…' : ''
      const text = lead + lines[i].slice(start, at + q.length + 80).trimEnd()
      const from = at - start + lead.length
      hits.push({ path: file.path, line: i + 1, text, from, to: from + q.length })
    }
  }
  return { hits, more: false }
}
