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

**Scaling to larger models.** `SectionNav` (page header) jumps to `#fs-meta` / `#fs-backend` /
`#fs-frontend` / `#fs-options` / `#fs-deps` / `#fs-entities` with a red dot per section that has
errors. From four entities up (or once the ⌘K "Find entity…" action pins it) `EntityNavigator`
renders beside the cards — a sticky outline with per-entity error/suggestion badges, a filter
(`entityMatches`: name, labels, table, field names) that also narrows the cards
(`EntitiesEditor.visibleUids`), ↑/↓/Enter navigation and a highlight on the card in view
(`useActiveEntity`, IntersectionObserver, no-op in jsdom). The field table has a **density** toggle
(`fullstack:density`): Lock / Search / Filter left the columns for each row's **More** panel
(`FieldMorePanel`: constraints + default + a Behaviour row), and everything set inside it shows as
chips on the row (`FieldChips.fieldChips`, click = open); Compact also drops the Label column (the
label moves into the panel and shows as a chip). The entity header keeps Views / Read-only /
Overrides and puts labels, schema/table, the **SELECT view** tick + query and the imported DDL behind
**Settings** (`EntitySettingsPanel`, summarised by `settingsSummary` when closed; forced open while
the query is blank — that state is `EntityErrors.viewQuery`, counted like an error but rendered as
an amber `data-pending` hint, and ticking the box focuses the textarea via `focusWithinRow`). Each
card also has **Preview UI** (`EntityUiPreview`, view-model in `uiPreview.ts` `buildUiPreview`): a
static mock of the generated list toolbar/table header and create form — labels, control per type,
required marks, defaults, locked fields, relation selects, audit columns, selection/export affordances,
Hebrew chrome and `dir="rtl"` — derived from the same rules as `summary.ts`, no server call. Only one
of Settings / Overrides / Preview is open per card (`panelFor`). The lint panel is controlled by the
view (`lintOpen` / `lintFilterUid`) so a card's amber badge opens it on that entity's issues.

**Safety nets.** Duplicate entity/field/relation names are uniquified (`naming.uniqueName`: `XCopy`,
`XCopy2`, …) so cloning twice never trips the duplicate validator; the last remaining list view is
disabled with a tooltip rather than silently ignored; Explore / Generate stay clickable with errors
(the click toasts the count and jumps to the first one); `persist()` reports a refused localStorage
write and the sticky bar shows a storage-full notice (`data-storage-full`), a `beforeunload` guard
arms while that is true and there is unsaved work, and `useFullstackPresets.savePreset` returns
`persisted` so the toast never claims a save that only lives in memory; deleting a browser preset
toasts an **Undo** (`Toast.action`, `restorePreset`); the import drawer keeps a parsed preview after
an edit, marks it stale (`data-stale`) and re-parses on the primary button, keeping unticked entities
by name; Import JSON offers Replace / Append when a model is already loaded (`ConfirmDialog`
`secondaryLabel`); undo bursts only coalesce edits with the same `snapshotChangeKey` (row-level), so
three quick ticks on three fields stay three steps. Examples include a composite-key model
("Course enrolments") and a SELECT-view model ("Sales reporting").

**Jumping around the page.** `App.tsx`'s `<main>` is `overflow-hidden` (it clips the ambient
blobs, one of which hangs below it), so it has hidden scrollable overflow. `element.scrollIntoView()`
and a plain `focus()` scroll *that* box as well as the window, and the wheel can never scroll it back
— the page then looks stuck part-way down. Every jump in the editor therefore goes through
`scroll.ts` (`scrollToElement` scrolls the window only and resets any clipped ancestor;
`focusWithoutClipping` focuses with `preventScroll`). Do not reintroduce `scrollIntoView` here.

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

**Share-link guard, lint for foreign keys, next steps, shortcuts, one option source.** A `?fs=`
link no longer wins unconditionally: `resolveInitialModel` (top of `FullstackView.tsx`) compares the
stored draft with the link through `shareGuard.ts` `draftHasUnsavedWork` (not the stock model, not the
link itself, not kept as a preset/recent — `useFullstackPresets.readStoredPresetSnapshots` reads
those synchronously) and, when the draft has unsaved work, starts from the draft with the link held
as `pendingLoad: { kind: 'shared' }` — the same ConfirmDialog as presets, "Replace my draft" (undoable)
/ "Keep mine" (`clearShareFromLocation`). `lint.ts` rule `fk-lookalike`: a non-key LONG/INTEGER/UUID
field named `<entity>Id` / `<entity>_id` beside an entity of that name (single PK of the same type,
not a view) warns, with a "Convert … to a relation" fix that swaps the field for a `MANY_TO_ONE`
(`required` carried; no fix when the camel-cased name collides with a field). A successful Generate
sets `lastGenerated` (`GeneratedRun`, memory only) and renders `NextStepsPanel` above the sticky
bar: unpack/run commands with Copy, the endpoint list per entity (`summarizeEntity`), Save as preset
/ Save to Team (`saveRequest` prop on `FullstackPresets` opens its prompt on that target), Copy as
curl and Copy share link (`copyShareLink`); it goes stale (`snapshotsEqual` vs the current snapshot)
rather than disappearing. Keyboard: one window `keydown` effect reads handlers through `commandRef` —
Ctrl+Enter Generate, Ctrl+Shift+E Explore, Ctrl+S Save preset (chords fire while typing, so Ctrl+S
beats the browser dialog), Ctrl+Z/Y undo/redo and `?` (the cheat sheet, `ShortcutsOverlay.tsx`,
`FULLSTACK_SHORTCUTS`) only outside fields; any `[role="dialog"][aria-modal]` other than the sheet
itself (`data-shortcuts`) mutes the chords. The ⌘K actions carry the same `shortcut` hints, and the
sticky bar has a keyboard button. `scaffoldOptions.ts` is the single description of the opts
(`SCAFFOLD_OPTIONS` with `perEntity`/`entityHint`/`requiresAnyDep`, `OPTIONS_SECTION`, `RTL_OPTION`,
`PROJECT_ONLY_OPTS`, `ENTITY_OPT_LABELS` derived from it — a test pins the keys to
`FULLSTACK_ENTITY_OPT_KEYS`); under each checked per-entity option `OptionCoverage` says "Applies to
N of M entities" with a chip per excluded entity (`optCoverage`: Off override / view / composite key,
click = `revealRow`), project-only options are tagged, and the Overrides panel ends with the
project-only flags and their current value plus "Go to Options" (`onGoToOptions`).
`FullstackView.test.tsx` is the first test that mounts the whole view (fetch stubbed to 404,
`framer-motion` mocked, `URL.createObjectURL` stubbed): share-link precedence, Generate success /
failure, Ctrl+S and `?`.

**Editor safety nets, join entities, enum labels.** `revealRow(uid, { focus? })` is the one way to
bring a card on screen: it clears the outline filter when `visibleUids` hides the card, expands it,
then scrolls/focuses two frames later — `jumpToFirstError`, the diagram, lint "Show", coverage chips
and every add/duplicate/restore (`EntitiesEditor.onRowAdded`) go through it, so a row is never
created or pointed at off screen. Removals (entity, field, relation — `RelationsEditor.onRemoved`)
and a type change that clears attributes toast through `onNotice(message, action)` with an **Undo**
that re-inserts *that* row (`restoreEntity`/`restoreField`/`restoreRelation` read the latest list via
`entitiesRef`, so later edits survive); recents get the same (`useFullstackPresets.restoreRecent`).
Undo/redo call `applySnapshot(s, true)`: `uid.ts` `reconcileUids` re-uses the current uids by name
then position, so `collapsed` (intersected with the survivors), open panels and expanded field rows
stay put; `flushBurst` also updates `historyRef` synchronously so Ctrl+Z right after typing works.
Storage: `persistFailedKeys` is per key (a successful meta write no longer hides the storage-full
notice while the entity list is unsaved); a `storage` event for `fullstack:entities` that this tab
did not write (`lastWrittenEntitiesRef`) shows a "changed in another browser tab" banner with Load
theirs (undoable) / Keep mine — never a silent overwrite. `RelationsEditor` offers "Many-to-many? Add a
join entity…" (`joinEntity.ts`: `<Owner><Target>`, generated id, two required MANY_TO_ONEs; lint's
`only-keys` rule skips entities that have relations). Template-set pickers show the set's
`description` and, with 2+ sets of a kind, a `SetCompare` grid; the palette picker gets the same
error banner + Retry as the sets (`useFrontendMetadata.reload`). `ImportFromDdlDrawer` takes a `.sql`
file (button or drop on the textarea); the team-conflict dialog has **Rename…** (reopens the save
prompt pre-filled via `saveRequest.draft`; closing the prompt keeps the draft); `validateMeta` checks
`name`/`version`; Copy as curl warns past `MAX_ENCODED_LENGTH`. **Enum labels:** `FullstackFieldDef.enumLabels`
(`Record<constant, label>`, additive — old presets/links lack it) is edited per chip in
`EnumValuesEditor` (`labels`/`onLabelsChange`; the draft accepts `OPEN:Open`), pruned when a value
goes (`enumLabels.ts` `pruneLabels`), mirrored by `quickAdd` `values="OPEN:Open|CLOSED"`, shown by
the UI mock (`enumLabel` = explicit else `humanizeConstant`, mirroring `EntityScaffoldContext`) and
validated like the server's `canonicalEnumLabels` (key must be a value, non-blank, ≤ 80 chars, ENUM only). The tickets example carries labels so the path is exercised.

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
