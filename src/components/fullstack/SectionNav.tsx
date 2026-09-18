import { scrollToElement } from './scroll'

export interface NavSection {
  id: string
  label: string
  /** Validation errors inside this section — rendered as a red dot. */
  errors?: number
}

/**
 * Jump list for the page's sections (Project · Backend · Frontend · Options · Dependencies ·
 * Entities). The page is long by design; this keeps it navigable without turning it into a
 * wizard. A section with errors shows a dot so the user knows where the sticky bar's count lives.
 */
export function SectionNav({ sections }: { sections: NavSection[] }) {
  function jump(id: string) {
    scrollToElement(document.getElementById(id), 'start')
  }
  return (
    <nav aria-label="Page sections" className="flex items-center gap-1 flex-wrap" data-section-nav>
      {sections.map(s => (
        <button
          key={s.id}
          type="button"
          onClick={() => jump(s.id)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-secondary hover:text-primary hover:bg-primary/5 transition-colors"
          title={s.errors ? `${s.label}: ${s.errors} issue${s.errors === 1 ? '' : 's'}` : `Jump to ${s.label}`}
        >
          {s.label}
          {s.errors ? <span className="h-1.5 w-1.5 rounded-full bg-error" aria-label={`${s.errors} issues`} /> : null}
        </button>
      ))}
    </nav>
  )
}
