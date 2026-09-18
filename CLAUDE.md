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
from `examples.ts` — every example must pass `validateEntities` and raise no `lint.ts` warnings,
pinned by `examples.test.ts`/`lint.test.ts` — plus saved presets/recents via `hooks/useFullstackPresets`,
**Team** models via `hooks/useTeamModels` (server-side `/metadata/fullstack/models`, same export shape;
the save prompt has a This browser / Team destination, a 409 name clash asks to Overwrite, delete is
confirmed in-app because it affects everyone), and **Export JSON / Import JSON / Copy as curl**
— `snapshot.ts` `toExportedModel`/`parseExportedModel`), **undo/redo** (`undo.ts` `History` — every
snapshot change is recorded automatically, coalescing a typing burst into one entry labelled by
`describeSnapshotChange`; destructive actions push an explicit label via `pushUndoEntry` and the change
they cause is skipped through `silentFromRef`; Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y outside inputs), the
in-app `ConfirmDialog` for Reset and for a preset/example load that would discard unsaved edits
(`hasUnsavedWork`: not the stock model, not the last-loaded baseline, not already a preset/recent),
**collapsible entity cards** (uids in `collapsed`, persisted; error-count badge; Collapse/Expand all),
a clickable issue count that jumps to the first problem (`#fs-meta`/`[data-entity-index]` +
`[aria-invalid]`/`[data-error]`), and a **share link**: the editor state is written to the `?fs=` param
(`shareLink.ts`, base64url JSON, debounced; `writeShareToLocation` returns `too-large` when it can't
fit, which the sticky bar reports) so the header's Share button reproduces the model; on load `?fs=`
beats localStorage, `App.tsx` keeps `?tab=fullstack` in step and strips `fs` when leaving the tab.
`snapshot.ts` defines `FullstackSnapshot`/`ProjectMeta` (uids stripped; `colorPalette` optional) — the
unit presets, recents, undo, share links, team models and JSON files carry. `DEFAULT_PROJECT_META` +
`normalizeMeta` fill in keys older stored models predate (name/description/version/packaging/`locale`),
`stripUids` also drops `sourceSql` (the imported DDL stays in memory only — it was blowing the storage
quota and the share-link length), and `describeSnapshotChange` names reorders.

Settings are grouped Project Metadata (group/artifact, name, description, version, packaging, packages,
Boot/Java — a version no longer in the catalog is kept as an "(unknown)" option and flagged by
`validateMeta`) / Backend / Frontend (frontend template set, `PalettePicker` from `components/shared/`,
dashboard title/overview, **Language** en/he + RTL — `frontendSetDefaults.ts` turns both on when the
Menora Digital set is picked) / Options (the `SCAFFOLD_OPTIONS`; `requiresAnyDep` warns inline when e.g.
`secured` lacks an ldap-auth dep). `lint.ts` + `ModelLintPanel` (Entities header) list non-blocking
**suggestions** with undoable one-click fixes: relation targets without a text field, search boxes that
would vanish, ticked views the generator drops, key-only entities, unique+default, overrides that can't
apply, `secured`/`openapi` vs the dependency list. `FullstackDepPicker` renders the BACKEND
compatibility rules via `useDependencyCompatibility`. Explore and Generate both have a Cancel
(`useFullstackPreview.cancel`, an AbortController in `generate`). The tab registers its ⌘K actions through
`src/commands.ts` (`registerCommands` / `useRegisteredCommands`); on this tab `CommandPalette` lists
those instead of the Backend catalog.

`EntitiesEditor` rows carry `data-row-uid` so `focus.ts` can focus a freshly added entity/field/relation;
entities, fields and relations reorder by arrow buttons or **drag-and-drop** (`useDragReorder.ts` — native
HTML5 DnD, one hook keyed per list, only the grip handle is draggable, `reorder.ts` `moveItem` applies
it); "Paste fields…" parses one field per line (`quickAdd.ts` — types/flags/`key=value`, incl.
`default=`); a **SELECT view** checkbox turns an entity into a `@Subselect` view (`viewQuery: ''` until
typed — validation blocks a blank query); each card shows a derived summary line plus a "Generates"
`<details>` with every endpoint (`summary.ts` `endpoints`/`opts` + `naming.ts`, which mirrors
`gen/Naming.java` — keep them in step); an "Overrides" panel sets per-entity `opts`
(`FULLSTACK_ENTITY_OPT_KEYS` in `types.ts`, inherit/on/off vs the project opts; `entityOptApplicability`
says "Has no effect" next to a switch the entity can't carry) and the constraints panel carries a
type-aware **Default value** (`validation.defaultValueError` mirrors the server check; a type change keeps
it across STRING↔TEXT / LONG↔INTEGER via `carryDefaultAcrossTypes`, otherwise clears it with a toast;
integral min/max must be whole). `RelationsEditor` shows the inverse collection name when
`inverseCollections` is on. `EntityRelationGraph.tsx` is the toggleable @ManyToOne diagram (d3-force,
deterministic, click = jump to card). `ImportFromDdlDrawer` is two-step: Parse → preview (tick which
entities to import; FK-derived relation chips, struck through when their target is unticked; dialects
from `useSqlDialects`) → Import N of M.

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
