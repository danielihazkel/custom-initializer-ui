# CLAUDE.md — ui

React + Vite single-page app. Mirrors the start.spring.io experience, backed by the Spring Initializr backend in `../backend/` running on port 8080.

## Commands

```bash
npm install       # first time only
npm run dev       # dev server at http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve dist/ locally
```

## Dev Proxy

`vite.config.js` proxies these paths to `http://localhost:8080`:

| Path prefix | Purpose |
|---|---|
| `/metadata` | Dependency catalog + form defaults |
| `/starter.zip` | Project ZIP download |
| `/actuator` | Health check |

All component code uses relative paths — no hardcoded backend URL anywhere.

## Component Map

```
src/
├── main.jsx                      React root
├── App.jsx                       Layout, global state, orchestrates all components
├── App.css                       All styles — Menora navy (#003366) theme, two-column grid, no CSS framework
├── hooks/
│   └── useMetadata.js            GET /metadata/client → { metadata, loading, error }
└── components/
    ├── ProjectForm.jsx            groupId / artifactId / name / description / packageName text fields
    │                              packageName auto-derives from groupId + artifactId
    ├── OptionsPanel.jsx           Spring Boot version + Java version dropdowns; Language / Build / Packaging pill toggles
    │                              All options populated from metadata (not hardcoded)
    ├── DependencySelector.jsx     Search input, grouped checkboxes, removable chips for selected deps
    └── GenerateButton.jsx         Builds /starter.zip?... URL, triggers native browser download (no fetch/blob)
```

## Fullstack editor (`src/components/fullstack/`)

`FullstackView.tsx` owns the whole editor state and wires: `FullstackPresets` (built-in example models
from `examples.ts` — every example must pass `validateEntities`, pinned by `examples.test.ts` — plus
saved presets/recents via `hooks/useFullstackPresets`), an **undo stack** (`undo.ts`; every destructive
edit — remove entity/field via `EntitiesEditor.onDestructive`, import-replace, reset, loading a
preset/example — pushes a `FullstackSnapshot` first; the sticky bar's Undo and Ctrl+Z outside inputs pop
it), the in-app `ConfirmDialog` for Reset (no `window.confirm`), **collapsible entity cards** (uids in
`collapsed`, error-count badge on every header, Collapse/Expand all), a clickable issue count that
jumps to the first problem (`#fs-meta`/`[data-entity-index]` + `[aria-invalid]`/`[data-error]`), and a
**share link**: the editor state is written to the `?fs=` param (`shareLink.ts`, base64url JSON,
debounced) so the header's Share button reproduces the model; on load `?fs=` beats localStorage.
`snapshot.ts` defines `FullstackSnapshot`/`ProjectMeta` (uids stripped) — the unit presets, recents,
undo and share links carry.

## Data Flow

1. `useMetadata` fetches `/metadata/client` → raw Initializr metadata JSON
2. `App` reads defaults from metadata (bootVersion.default, language.default, etc.) and seeds form state
3. User edits form / selects dependencies
4. `GenerateButton` constructs `/starter.zip` URL with all params and triggers `<a download>` click

## Metadata Response Shape

```json
{
  "dependencies": { "values": [ { "name": "Web", "values": [{ "id": "web", "name": "Spring Web", "description": "..." }] } ] },
  "bootVersion":  { "values": [...], "default": "3.2.1" },
  "language":     { "values": [...], "default": "java" },
  "javaVersion":  { "values": [...], "default": "21" },
  "type":         { "values": [...], "default": "maven-project" },
  "packaging":    { "values": [...], "default": "jar" }
}
```

## Styling

Plain CSS custom properties — no framework. Key variables in `App.css`:
- `--menora-navy: #003366` — header, active pills, chips, generate button
- `--menora-accent: #0066cc` — focus rings, group headers
- Two-column grid: left = ProjectForm + OptionsPanel, right = DependencySelector (sticky)
- Sticky bottom bar for the Generate button
