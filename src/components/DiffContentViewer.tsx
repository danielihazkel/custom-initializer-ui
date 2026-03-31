import { useMemo } from 'react'
import { diffLines } from 'diff'
import type { FileStatus } from '../types'

interface Props {
  status:     FileStatus
  newContent: string
  oldContent: string
}

export function DiffContentViewer({ status, newContent, oldContent }: Props) {
  const rows = useMemo(() => {
    if (status === 'added') {
      return newContent.split('\n').map((line, i) => ({
        type: 'added' as const,
        oldLine: null as number | null,
        newLine: i + 1,
        text: line,
      }))
    }

    if (status === 'removed') {
      return oldContent.split('\n').map((line, i) => ({
        type: 'removed' as const,
        oldLine: i + 1,
        newLine: null as number | null,
        text: line,
      }))
    }

    // modified — compute unified diff
    const changes = diffLines(oldContent, newContent)
    const result: { type: 'added' | 'removed' | 'unchanged'; oldLine: number | null; newLine: number | null; text: string }[] = []
    let oldLine = 1
    let newLine = 1

    for (const change of changes) {
      const lines = change.value.split('\n')
      // diffLines includes a trailing empty string if value ends with \n
      if (lines[lines.length - 1] === '') lines.pop()

      for (const text of lines) {
        if (change.added) {
          result.push({ type: 'added', oldLine: null, newLine: newLine++, text })
        } else if (change.removed) {
          result.push({ type: 'removed', oldLine: oldLine++, newLine: null, text })
        } else {
          result.push({ type: 'unchanged', oldLine: oldLine++, newLine: newLine++, text })
        }
      }
    }

    return result
  }, [status, newContent, oldContent])

  return (
    <pre className="text-xs font-mono leading-5 m-0 p-0" style={{ background: 'transparent' }}>
      {rows.map((row, i) => {
        const bg =
          row.type === 'added'   ? 'bg-green-500/10' :
          row.type === 'removed' ? 'bg-red-500/10'   : ''
        const marker =
          row.type === 'added'   ? '+' :
          row.type === 'removed' ? '-' : ' '
        const markerColor =
          row.type === 'added'   ? 'text-green-500' :
          row.type === 'removed' ? 'text-red-400'   : 'text-secondary/40'

        return (
          <div key={i} className={`flex min-w-0 ${bg}`}>
            {/* old line number */}
            <span className="text-secondary/40 select-none text-right px-2 flex-shrink-0 w-10 border-r border-outline-variant/20">
              {row.oldLine ?? ''}
            </span>
            {/* new line number */}
            <span className="text-secondary/40 select-none text-right px-2 flex-shrink-0 w-10 border-r border-outline-variant/20">
              {row.newLine ?? ''}
            </span>
            {/* +/- marker */}
            <span className={`select-none px-1.5 flex-shrink-0 border-r border-outline-variant/20 ${markerColor}`}>
              {marker}
            </span>
            {/* content */}
            <span className="px-4 whitespace-pre">{row.text}</span>
          </div>
        )
      })}
    </pre>
  )
}
