import type { ReactNode } from 'react'
import { t } from '../i18n'

/** "5m ago", "3d ago", or the date: when a preset was saved. */
export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('just now')
  if (mins < 60) return t('{n}m ago', { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('{n}h ago', { n: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t('{n}d ago', { n: days })
  return new Date(ts).toLocaleDateString()
}

/** A small figure on a preset card (dependencies, modules). */
export function PresetChip({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-secondary bg-surface-container-high px-1.5 py-0.5 rounded">
      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{icon}</span>
      {children}
    </span>
  )
}
