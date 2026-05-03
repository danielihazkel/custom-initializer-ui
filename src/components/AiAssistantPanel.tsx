import { useState } from 'react'
import type { AiPanelState } from '../types'

interface Props {
  state: AiPanelState
  hasDependencies: boolean
  onToggle: () => void
  onPromptChange: (prompt: string) => void
  onGenerate: () => void
  onTogglePath: (path: string) => void
}

export function AiAssistantPanel({
  state,
  hasDependencies,
  onToggle,
  onPromptChange,
  onGenerate,
  onTogglePath,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const generateDisabled = !hasDependencies || state.loading || state.prompt.trim().length === 0
  const keptCount = state.keptPaths.length
  const totalCount = state.generatedFiles.length

  const toggleExpand = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <div className="glass-panel rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 id="ai-panel-label" className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-1.5">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>auto_awesome</span>
            AI File Assistant
          </h3>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            Describe extra files for an AI to add to your project
          </p>
        </div>
        <button
          role="switch"
          aria-checked={state.enabled}
          aria-labelledby="ai-panel-label"
          onClick={onToggle}
          className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${state.enabled ? 'bg-primary' : 'bg-surface-container-high'}`}
          aria-label="Toggle AI File Assistant"
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${state.enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {state.enabled && (
        <div className="space-y-3">
          <textarea
            value={state.prompt}
            onChange={e => onPromptChange(e.target.value)}
            placeholder={
              hasDependencies
                ? 'e.g. "Add a HelloController returning a friendly greeting and a small utility class for date formatting."'
                : 'Pick at least one dependency before describing AI files.'
            }
            disabled={!hasDependencies || state.loading}
            rows={3}
            className="w-full text-sm rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 resize-y"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={onGenerate}
              disabled={generateDisabled}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {state.loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>
                  Asking AI…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>auto_awesome</span>
                  Generate AI files
                </>
              )}
            </button>
            {!hasDependencies && (
              <span className="text-[11px] text-on-surface-variant">Select dependencies first.</span>
            )}
          </div>

          {state.error && (
            <div className="rounded-lg border border-error-container bg-error-container/30 px-3 py-2 text-xs text-on-surface flex items-start gap-2">
              <span className="material-symbols-outlined text-error" style={{ fontSize: '16px' }}>error</span>
              <div>
                <div className="font-medium text-error">AI request failed</div>
                <div className="text-on-surface-variant break-words">{state.error}</div>
              </div>
            </div>
          )}

          {totalCount > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-secondary flex items-center justify-between">
                <span>Generated files</span>
                <span className="text-on-surface-variant normal-case tracking-normal">
                  {keptCount} of {totalCount} will be added
                </span>
              </div>
              <ul className="rounded-lg border border-outline-variant divide-y divide-outline-variant bg-surface-container-lowest max-h-72 overflow-y-auto">
                {state.generatedFiles.map(file => {
                  const kept = state.keptPaths.includes(file.path)
                  const isExpanded = expanded.has(file.path)
                  return (
                    <li key={file.path} className={kept ? '' : 'opacity-50'}>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button
                          onClick={() => toggleExpand(file.path)}
                          className="text-secondary hover:text-on-surface transition-colors"
                          aria-label={isExpanded ? 'Collapse content' : 'Expand content'}
                          title={isExpanded ? 'Hide content' : 'Show content'}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                            {isExpanded ? 'expand_more' : 'chevron_right'}
                          </span>
                        </button>
                        <code className="flex-1 text-xs font-mono text-on-surface truncate" title={file.path}>
                          {file.path}
                        </code>
                        <button
                          onClick={() => onTogglePath(file.path)}
                          className="p-1 rounded text-secondary hover:text-error transition-colors"
                          aria-label={kept ? 'Remove file from project' : 'Restore file'}
                          title={kept ? 'Remove from project' : 'Restore'}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                            {kept ? 'close' : 'undo'}
                          </span>
                        </button>
                      </div>
                      {isExpanded && (
                        <pre className="text-[11px] font-mono bg-surface-container px-3 py-2 max-h-60 overflow-auto whitespace-pre-wrap break-words">
                          {file.content}
                        </pre>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
