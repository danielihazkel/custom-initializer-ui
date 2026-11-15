import { CoachTour, type TourStep } from './shared/CoachTour'

/**
 * The generator tabs' tours — a handful of stops each, on parts marked `data-tour="…"`. A tab
 * opens its tour by itself once per browser (see `shouldAutoTour`), and the header's Help menu
 * runs it again. A lazy chunk: the first paint of a tab never waits for it.
 */
export type TourId = 'backend' | 'frontend' | 'fullstack'

const TOURS: Record<TourId, { label: string; storageKey: string; steps: TourStep[] }> = {
  backend: {
    label: 'Backend tour',
    storageKey: 'tour:backend',
    steps: [
      {
        anchor: '[data-tour="quick-start"]',
        title: 'Start from a template',
        body: 'A template ticks a working set of dependencies in one click. Save your own setups as presets right below, and compare templates side by side.',
      },
      {
        anchor: '[data-tour="project-setup"]',
        title: 'Name the project',
        body: 'Group, artifact and package, the Spring Boot and Java versions. A field that would stop Generate says so here.',
      },
      {
        anchor: '[data-tour="dep-search"]',
        title: 'Pick dependencies',
        body: 'Press / and type — initials work ("sdj" finds Spring Data JPA). Enter adds the first result. Star the ones you use; they stay on top as quick picks.',
      },
      {
        anchor: '[data-tour="selected-deps"]',
        title: 'Options and wizards',
        body: 'What you picked, with its options. A dependency with a wizard badge can generate code from a SQL script, an OpenAPI spec, a WSDL or an AsyncAPI document.',
      },
      {
        anchor: '[data-tour="file-dock"]',
        title: 'Watch the files',
        body: 'The project’s file tree, updated as you tick dependencies, with what each one adds. Click a file to read it.',
      },
      {
        anchor: '[data-tour="actions"]',
        title: 'Explore, then Generate',
        body: 'Explore shows every file before you download — and what changed since the last look. Generate downloads the ZIP (Ctrl+Enter). Ctrl+K reaches everything; ? lists the keys.',
      },
    ],
  },
  frontend: {
    label: 'Frontend tour',
    storageKey: 'tour:frontend',
    steps: [
      {
        anchor: '[data-tour="quick-start"]',
        title: 'Start from a template',
        body: 'A template picks a router, state, styling and tooling that work together. Change anything afterwards.',
      },
      {
        anchor: '[data-tour="fe-deps"]',
        title: 'Pick the tooling',
        body: 'Press / to search. A badge says which React versions a library supports; conflicts are flagged as you pick.',
      },
      {
        anchor: '[data-tour="actions"]',
        title: 'Explore, then Generate',
        body: 'Explore shows the files first. Generate downloads the ZIP (Ctrl+Enter); the card that follows has the commands to run it.',
      },
    ],
  },
  fullstack: {
    label: 'Fullstack tour',
    storageKey: 'tour:fullstack',
    steps: [
      {
        anchor: '[data-tour="fs-start"]',
        title: 'Start from an example',
        body: 'Each example is a complete model — entities, relations and pages. Open one and change it, or load a preset, a team model or a project’s own menora-model.json.',
      },
      {
        anchor: '#fs-entities',
        title: 'Describe the entities',
        body: 'Fields, relations and options per entity; the outline on the side jumps between them. Problems that would stop Generate are counted and one click away.',
      },
      {
        anchor: '#fs-pages',
        title: 'Lay out the app',
        body: 'Open the layout designer to arrange dashboards, lists, records and forms on a live canvas — or keep the classic one-list-per-entity shell.',
      },
      {
        anchor: '[data-tour="actions"]',
        title: 'Explore, then Generate',
        body: 'One ZIP with a Spring Boot backend and a React frontend, wired together. Ctrl+K lists every action on this tab; ? lists the keys.',
      },
    ],
  },
}

export function storageKeyOf(tour: TourId): string {
  return TOURS[tour].storageKey
}

export function Tour({ tour, onClose }: { tour: TourId; onClose: () => void }) {
  const { label, storageKey, steps } = TOURS[tour]
  return <CoachTour root={document} steps={steps} storageKey={storageKey} label={label} scrollIntoView onClose={onClose} />
}
