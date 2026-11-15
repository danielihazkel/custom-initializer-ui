import { Fragment } from 'react'

interface Props {
  text: string
  /** [start, end) pairs, sorted and not overlapping — what `utils/fuzzy` returns. */
  ranges?: [number, number][]
}

/** `text` with the matched stretches of a search marked. No ranges: the text as it is. */
export function Highlight({ text, ranges }: Props) {
  if (!ranges || ranges.length === 0) return <>{text}</>
  const parts: React.ReactNode[] = []
  let at = 0
  ranges.forEach(([from, to], i) => {
    if (from > at) parts.push(<Fragment key={`t${i}`}>{text.slice(at, from)}</Fragment>)
    parts.push(<mark key={`m${i}`} className="search-hit">{text.slice(from, to)}</mark>)
    at = to
  })
  if (at < text.length) parts.push(<Fragment key="tail">{text.slice(at)}</Fragment>)
  return <>{parts}</>
}
