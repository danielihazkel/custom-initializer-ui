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

The original skeleton, kept for orientation — the app is now TypeScript (`.tsx`) with Tailwind v4; see the
sections below for what each area holds today.

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

`FullstackView.tsx` owns the whole editor state and wires: `FullstackPresets` (example models from
`hooks/useFullstackExamples` → `GET /metadata/fullstack/examples`, admin-managed under Admin → Fullstack
Examples (`components/admin/fullstack-examples/`, which runs `validateEntities` before saving and can copy a
Team model's entities). `__fixtures__/fullstack-examples.json` is the backend seed
(`catalog/fullstack-examples.json`) in the public `GET /metadata/fullstack/examples` shape — `exampleId` renamed to `id`,
no `sortOrder`/`enabled` — and `examples.test.ts`/`lint.test.ts` pin that every seeded example passes
`validateEntities` and raises no `lint.ts` warnings; regenerate it when the seed changes
(`node -e` over the seed: `({ exampleId, sortOrder, enabled, ...rest }) => ({ id: exampleId, ...rest })`). Plus saved presets/recents via `hooks/useFullstackPresets`,
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
**Layout designer** (`designer/`, the Fullstack tab's `#fs-pages`): `PagesSection` takes `PagesEditor`'s props and
renders a card (the layout as a sitemap of page chips — each chip's title is `describePage` — its problem count,
the server issue, Start from my entities / a template, Use classic layout) that opens `LayoutDesigner`, a
full-screen portal dialog (`role="dialog" aria-modal`, body scroll lock, Tab loop, focus back to the opener):
`DesignerLibrary` (page types, suggestions, My templates, widgets grouped Numbers/Charts/Lists/Other with the
`widgetKindDisabledReason` shown, whole-layout templates), `PageStrip` over the canvas (`LayoutPreview` at
`CANVAS_ZOOM`, `narrow` for the Mobile switch) and `DesignerInspector` (a widget: `WidgetCard bare`; a page:
Basics `PageBasicsFields` / Layout `PageTypeForm widgetsOnCanvas` / Access `RolesField`), plus `IssuesPanel` and
`SitemapView` (nav sections via `GroupChip`, page moves via the `pages` drag list, nav style). Library cards drag
with `dragPayload.ts` (`LibraryDrag`, kept in designer state; the event carries it too): widgets onto
`LayoutPreview`'s `widgetDrop` (before/after the widget under the pointer, or the end slot), pages into the strip.
The palette's page actions and Generate's jump to an error open the designer (`DesignerTarget`). Every change goes
through `pages/usePagesModel.ts`, which `PagesEditor` uses too — the admin examples form keeps the inline editor.
The page forms use container queries (`@sm:` etc., `@container` on the hosts) so they stack in the 22rem
inspector. Designer keys (`/`, Delete, Alt+←/→, Alt+Shift+←/→, Esc) are in `FULLSTACK_SHORTCUTS`. A third view,
**Appearance** (`AppearanceView` + `FrontendSettings`), holds the generated app's look — frontend template set
(radio cards with a shell sketch), palette (`PalettePicker`), language, RTL and the classic dashboard heading —
beside the live preview (the classic `seedLayout` shell when there are no pages). The values stay in
`FullstackView` (snapshot, undo, share links) and reach the designer as one `FrontendAppearance` bundle via
`PagesSection`'s `appearance` prop; the Setup panel's `#fs-frontend` is now a one-row summary whose *Edit in
designer* (and the frontend setup chips) bump `designerRequest` to open Appearance. Parity with the
inline editor and canvas tools: the Tabs card opens the shared `pages/NewTabsForm` (which pages, title,
hide) instead of picking for the user; Ctrl/⌘-click and Shift-click on strip chips pick pages
(`pickedAfterClick`) for the shared `BulkPageBar`; a chip's right-click / Shift+F10 opens a
`DesignerMenu` (open, start page, hide, duplicate, move, pick, delete) and Delete / Alt+←/→ on a focused
chip remove or move its page. The canvas `LayoutPreview` takes `problems` (`validation.byPage`): every
`Editable` whose `previewPartOf` matches a control with a problem is ringed and names it. The issues
sheet's **Fix all** runs `fixAllProblems` (pageLayout.ts — re-validates after each fix, since fixes are
index-based, and skips one that does not reduce the problems) as one undo step. The header's history
button lists `history.undoEntries`/`redoEntries` and jumps through `onJump` (`FullstackView.jumpHistory`
→ `undo.ts` `stepMany`). The canvas has a zoom (`ZoomControl`, `ZOOM_LEVELS`), a Tablet width, and the
library/inspector panes fold away; zoom and panes persist in `localStorage` `fullstack:designerView`
(a canvas click or `/` reopens the pane it needs). **Play mode** (the canvas bar's Design/Play switch, or `P`)
walks the layout as the generated app would: `playLinks.ts` `buildPlayLinks` resolves each page's click
targets with the generator's own lookups (`pageLinks` mirrors `EntityScaffoldContext.PageLinks`: record
page, first visible list, home, wizard) — list/calendar/board rows → the record page (or a note: drawer,
side pane), New → the wizard, dashboard cards → `drillTo` else the list, link tiles, recent rows, a
record's Back → its home and related rows → their record page, a wizard's Save → the new row's page, a
report chart → its list, search matches, content page links. `LayoutPreview` takes `play` (a context):
`Editable` drops its edit overlay and `playLink` makes parts links (`data-play-link`). The designer keeps a
trail of row keys (Back, crumbs); the page walked to is the selected page, so Esc / `P` resumes editing
there. Pinned by `designer/LayoutDesigner.test.tsx` and `playLinks.test.ts`. The library's Widgets tab
opens with **Suggested for <entity>** (the "New widgets read" entity): `pageLayout.ts` `suggestWidgets`
builds a count, a total of the entity's money (else first number) column, a donut by its first
enum/boolean, a monthly trend over its first date, a top list by its first relation and its latest rows,
drops any the dashboard already shows (`widgetShape`: kind with bar ≈ donut, entity, resolved grouping,
aggregate, field) and any the validator rejects on that dashboard. A suggestion drags with its settings
(`LibraryDrag` `def`) and lands through `usePagesModel.addWidgetDef`. Pinned by `widgetSuggestions.test.ts`. The Sitemap view's
**Page flow** switch draws `PageFlowMap`: `pageFlow.ts` `buildPageFlow` turns the menu, header search,
tabs and every Play-mode link (`buildPlayLinks`, plus content page links) into one edge per page pair with
its kinds, lays pages out in columns by clicks from the menu (breadth first) and puts the pages nothing
leads to in a last, red-dashed column. Edges are SVG under absolutely placed page buttons; hovering or
focusing a page lights its edges, a click opens it in Design, and the menu edges can be hidden. Pinned by
`pageFlow.test.ts`. On a tabs, report, record or wizard page the library's Widgets tab becomes **Parts**
(`pageParts.ts` `pageParts`): pages to embed, a chart per groupable field/relation, related lists and
their counts, the wizard's fields (each with a step picker). A card drags onto the canvas (`LibraryDrag`
`part`; `LayoutPreview` `partDrop` → drop lines on the tab strip, beside a chart, on the record's tabs or
number row, onto a wizard step or a "New step" slot) or clicks in at the end; a page chip dragged from the
strip drops onto a tabs page too (`PageStrip` `onChipDrag`). `placePart` applies the inspector's rules
(caps, nothing twice, the record's default tabs/tiles written out first, a step a field leaves empty
dropped) and `usePagesModel.placePart` files it as one labelled undo step; a refusal shows in the notice.
Pinned by `pageParts.test.ts`. The page inspector's **Code** tab (`designer/PageCode.tsx`, only when the
host passes `codeRequest` — `FullstackView` hands its `buildBody`; the admin form does not) posts the request
to `/starter-fullstack.preview` on opening and again `PAGE_CODE_DEBOUNCE_MS` after each edit (not while the
layout has problems), keeps the last answer dimmed meanwhile and shows `pageCode.ts` `pageCodeFiles`: the
page's `src/app/screens/<PascalId>Screen.tsx` (the backend's `Naming.toPascalCase`, mirrored by
`naming.ts`), the screens a tabs page embeds, the entity pages it draws, then `App.tsx`/`route.ts`. Its own
fetch, not the Explore preview — Explore opens the file-tree modal. Pinned by `pageCode.test.ts`.
**Widget clipboard** (`widgetClipboard.ts`): Ctrl+C copies the selected widget (none selected: every widget
of the dashboard), Ctrl+X cuts it, Ctrl+V pastes after the selected widget or at the end (design mode only;
not in a field or with text selected — the browser's copy wins). The copy lives in `sessionStorage`
(`fullstack:widgetClipboard`), so it outlives the designer; the library shows it as a Clipboard card. The
widget inspector adds Copy, **Move to…** (another dashboard, one undo step, `usePagesModel.moveWidgetTo`) and
**Save as widget** (`localStorage` `fullstack:widgetTemplates`, the library's "My widgets", with Forget).
Every pasted, moved or saved widget goes through `fitWidget` first (its entity must exist; links and a
`drillTo` to pages that are gone are dropped) and `pasteWidgets` stops at `MAX_WIDGETS`, naming what it
left out. Pinned by `widgetClipboard.test.ts`.
**Team templates** (`hooks/useTeamTemplates.ts`, backend `/metadata/fullstack/templates` — see *Team
templates* in `backend/CLAUDE.md`): the designer lists them once on opening. The library's Pages tab has
"Team templates" (click or drag — `LibraryDrag` `team-template` — through `pageFromTemplate`, like My
templates) and the dashboard Widgets tab "Team widgets" (fitted by `fitWidget`, so one naming a missing
entity is disabled with the reason). Share from the page inspector's header (`data-share-page`), the widget
inspector ("Share with team") or a My templates / My widgets card; sharing under a name the team already
has (same kind, ignoring case) PUTs over it, and the button says "Update". Deleting asks for a second
click, since it removes it for everyone. Pinned by `useTeamTemplates.test.ts` and the designer's
"team templates" tests.
**Designer round 3 (2026-10).** *Canvas:* a widget reorders along the row (`rowProps(…, 'x')`; a phone's
single column still flows down) and the grid shows its four columns while one moves or resizes (a resize
badges the width); the hover bar adds Duplicate (also Ctrl+D) and a kind menu (`widgetTools` prop →
the designer's fixed `DesignerMenu`, reasons from `widgetKindDisabledReason`, applied by
`retargetWidgetAt`). Double-click (or F2) renames a title in place — the page's, a widget's, a tab's, a
wizard step's, a record header number's: `LayoutPreview` `onRename` with a `Rename` context, `RenameSlot`
marks the text (`data-rename`), `Editable`/tab/step buttons start it (`renameFrom`, the slot under the
pointer), Enter/blur saves, Escape cancels, focus returns via `data-rename-owner`; the model side is
`pageParts.ts` `renamePart` (writes out dealt steps / default numbers first) and `usePagesModel.renamePart`
(`retitle` for the page). `reveal` skips focusing the inspector while a rename input has focus. *Preview:*
sample rows come from `previewSample.ts` (`sampleRaw` — name/entity heuristics, en/he words, min/max,
default on row 1, dates around `today`; `cellText` = what the generated table prints, `detailText` = the
details' formatting), so lists show raw ISO dates and `true`/`false` like the app. The canvas bar's
**Data · Empty · Loading · Error** switch (`DataStateSwitch`, prefs `dataState`) sets `LayoutPreview`
`dataState` (a `DataState` context: `StateNote`, `ListState`, `WidgetState`) in the generated app's words
(`preview.strings.states`). Under the Menora skin the canvas uses Assistant (`@fontsource/assistant`,
imported in `src/fonts.css`), lavender chips for enum cells, end-aligned numbers (`PreviewTable.kinds`) and
yellow discs for a links widget; import steps, Export, calendar view names and activity times use the app's
en/he strings (designer prompts stay English). *Advice:* `collectWarnings` adds crowded-nav (fix: groups by
`adviceGroup`), crowded-dashboard, wide-list (fix: first 6 columns), duplicate-list (fix: remove),
entity-without-page (only an entity nothing mentions or links to) and pivot-dead-end; thresholds in
`ADVICE`. *Tour:* `designer/DesignerTour.tsx` (six steps on existing `data-*` anchors, skipping hidden
ones), once per browser (`fullstack:designerTour`), again from the header's help menu. *Spec sheet:* the
header's Export spec builds one offline HTML file — `specSnapshot.tsx` renders each page's
`LayoutPreview` and the `PageFlowMap` into detached roots (`staticMarkup`, icons and edit overlays
removed) and inlines the app's own CSS without fonts or urls (`collectAppCss`); `specSheet.ts`
`buildSpecSheet` lays out cover, navigation, flow and one print page per screen (`html.light`). Pinned by
`previewSample.test.ts`, `LayoutPreviewStates.test.tsx`, `LayoutPreviewSkin.test.tsx`,
`pageLayoutAdvice.test.ts`, `designer/specSheet.test.tsx`, `pageParts.test.ts` and the designer tests.
**Generator round 8 (2026-10)** — the editor side of *Round 8* in `backend/CLAUDE.md`. *KPI trend:* `WidgetCard`'s
"Trend line" select sets a kpi's `trend`; `pageLayout.ts` `trendDateField` mirrors the generator's date choice,
`retargetWidget` drops the trend (named) when the kind changes, and the preview draws a seeded `Sparkline`. *Form
page:* `pages/FormPageForm.tsx`; `createsRows` (wizard or form) is what a hidden page may still be (reachable
by New), a form and a wizard of one entity are mutually exclusive in `validatePages` and `newPageChoices`, Play's
New goes to the form, and the preview draws `FormScreen` with the entity's form sections. *Workflow:* a fifth
entity panel, `WorkflowPanel.tsx` (status/assignee/due pickers and a transitions list; roles are disabled
without ldap-auth, with an "Add ldap-auth-rest" shortcut). `workflow.ts` holds the rules — `workflowProblem`
(the validator's mirror, also run by `validation.ts`), `syncWorkflow` (follows field and enum renames like
`syncFormSections`), and `openStates`/`finalStates`/`unreachableStates`/`ambiguousMoves`. `lint.ts` adds
`workflow-unreachable` (info), `workflow-ambiguous` and `workflow-roles` (fix: add ldap-auth-rest). `summary.ts`
lists the transition/claim/release endpoints. *Inbox page:* `pages/InboxForm.tsx`, `newPageTypes.ts`
(`INBOX_QUEUES`, `hasInbox`, `defaultInboxFields`, `checkInbox`; "No workflow with an assignee" in the chooser),
and the preview's `InboxScreen` (queue tabs, chips, an overdue row, the first moves). *Approvals* is in the
fixture. `examples.test.ts` validates every example's own layout — no problems and no warnings, so an example
never opens on advice to fix (Tickets, Inventory and Sales reporting were adjusted for it) — and the fixture lint check runs
with `ldap-auth-rest`, the sets' default. The layout templates open a wide entity's list on its first six
columns (`narrowColumns`, the wide-list fix). Pinned by `pageLayoutKpiTrend.test.ts`,
`pageLayoutFormPage.test.ts`, `workflow.test.tsx` and `pageLayoutInbox.test.ts`.

**Generator round 9 (2026-11)** — the editor side of *Round 9* in `backend/CLAUDE.md`.
- *One schema.* `schema/fullstack-schema.json` is the backend's `GET /metadata/fullstack/schema`, checked in; `schema/index.ts` exposes it (`LIMITS`, `CHOICES`, `NAME_RULES`, field types, scaffold options) and `pageLayout.ts`, `validation.ts`, `workflow.ts`, `formSections.ts`, `newPageTypes.ts` and `scaffoldOptions.ts` derive their constants from it — only the TS unions stay hand-written. `npm run sync:schema` (`scripts/sync-backend-fixtures.mjs`) rewrites it and the examples fixture from `../backend`; `fixturesInSync.test.ts` fails when either copy is stale, `schemaParity.test.ts` when a union and the schema disagree. Do not hand-edit either JSON.
- *Server errors land where they belong.* `serverIssue.ts` reads the 400's `path` (`parseServerPath`) and `FullstackView` keeps one `serverIssue`, cleared when the model changes: an entity card shows it (`EntityServerIssue`, `[data-server-issue]`), a page problem opens that page. Generate reads failures with `readErrorBody`, like Explore.
- *Field types.* `fieldTypes.ts` holds the predicates (`isTextualType`, `isNumericType`, `isDateType`, …) every other module asks instead of comparing type names; the four new scalar types, a currency box for MONEY and FILE/IMAGE are in the type select, `quickAdd.ts` takes the schema's aliases, and the UI mock and layout preview draw them.
- *Relations have a kind* (`RelationsEditor`): Many-to-one (join column), Many-to-many (join table; never required; not to itself; not from a composite key) and One-to-many (a "Linked by" pick over the target's many-to-ones to this entity — `childLists.ts` `linksBetween`/`resolveLink`, the validator's `linkBehind` mirrored; nothing to pick when there is one). `types.ts` `FullstackRelationType` and `joinTable`/`inverseJoinColumn`/`mappedBy`. Every place that means "a foreign key" filters `r.type === 'MANY_TO_ONE'` (form sections, workflow step fields, page-layout columns/grouping, the column-uniqueness check); a one-to-many is also out of the form preview and the filters. The link index reaches each memoized card as one deferred string (`linkIndexKey` → `parseLinkIndex`), like `entityNames`. Renames follow: an entity's into every relation's target (`relationRefs.ts`), a many-to-one's into the one-to-manys that name it (`renameLinkInChildLists`), each in the rename's own undo step. `EntityRelationGraph` marks a many-to-many edge (⋈) and names a one-to-many on its own box instead of drawing the foreign key twice. `lint.ts` `join-entity-to-m2m` (info): an entity that is only a generated key and two required links, with nothing pointing at it, can be a many-to-many — the fix keeps its table and column names. "Add a join entity…" stays, for links that carry columns of their own.
- *Updating a project.* `updateBaseline.ts`: the model a project was made from, in `localStorage` `fullstack:baseline` — set by a successful Generate (with the response's `X-Templates-Hash`) and by Import JSON of a project's own `menora-model.json` (`parseExportedModel` reports `fromProject`/`templatesHash` from its `generator` block; a plain export sets nothing). While the editor's model differs from it and the artifact id is the same, `UpdatePanel` offers Preview changes (`useFullstackPreview.fetchComparison`: both generations fetched, then shown in the existing file preview with the old one as "previous"), Download update (`POST /starter-fullstack.patch`, body from `updateRequest`), Mark as applied (the current model becomes the baseline) and Forget. A rejected update goes onto the card it is about when the problem is in the current model (`sideOfPath`), and names the stored model otherwise. `snapshot.ts` `requestFromSnapshot` is the one request builder — `FullstackView.buildBody` is `requestFromSnapshot(currentSnapshot)`. A new backend endpoint needs a line in `vite.config.ts`' proxy.
- Admin → Build Customizations has the Boot-range field.

Pinned by `schemaParity.test.ts`, `fixturesInSync.test.ts`, `serverIssue.test.ts`, `RelationsEditor.test.tsx`, `childLists.test.ts`, `updateBaseline.test.ts`, and the "offers an update" / "puts an update the server rejects" cases of `FullstackView.test.tsx`.

**Generator round 10, phase 1 (2026-11)** — the editor side of the fix sweep in `backend/CLAUDE.md`.
- *Relation labels:* a relation row has a Label input (`FullstackRelationDef.label`, ≤ `LIMITS.maxRelationLabel`); `naming.ts` `relationLabel` (label, else the field name in words) names it in the layout preview, the UI mock and the list-column picker.
- *Workflow assignee:* locked like the status. `workflow.ts`: a required field is not an assignee choice and `workflowProblem` flags one; `requirableNames` leaves it out. `pageLayout.ts`: `wizardFields` / `defaultWizardSteps` skip it and a step naming it is flagged. `summary.ts` lists `POST /{id}/assign`.
- *Formatting:* the preview's list cells read like the details (`layoutPreviewModel` `cell` → `detailText`), since the generator writes cells, details and cards with one function.
- *Sorting:* `fieldTypes.ts` `isSortableType` (not long text, not a file) decides `listColumns().sortable` and the recent widget's "Newest by" choices; a recent list sorted by one is flagged.

**Generator round 10, phase 3 (2026-11)** — the editor side of *wizard depth* in `backend/CLAUDE.md`. The SQL drawer (`components/SqlWizardDrawer.tsx`) has a "With the project's other dependencies" box: *Use this script as the Flyway baseline* (on by default; says whether `flyway` is selected), *Generate controller tests* (needs a REST API mode) and a line on what selecting `validation` adds. The OpenAPI drawer (`OpenApiWizardDrawer.tsx`) offers what a client calls through (RestTemplate / RestClient, only where a client is generated) and *Keep the spec in the project*. `SqlWizardEntry.flywayBaseline`/`generateTests` and `OpenApiWizardEntry.clientKind`/`copySpec` are optional and are stored and sent (`projectUtils.buildWizardBody`) only where they differ from the server's defaults, so entries saved before keep their shape. The starters a wizard needs (`web`, `openapi`, `web-services`) are added by the server. Pinned by `SqlWizardDrawer.test.tsx`, `OpenApiWizardDrawer.test.tsx` and `projectUtils.test.ts`.

**Generator round 10, phase 4 (2026-11)** — the events wizard's drawer (*Round 10, phase 4* in `backend/CLAUDE.md`). A dependency listed by `GET /metadata/events-capable-deps` (`hooks/useEventsCapable.ts`; today `kafka`) gets *Generate from AsyncAPI…* in `DependencySelector`, opening `components/EventsWizardDrawer.tsx`: the document (paste or upload), sub-packages, consumer group, *Generate tests*, and — from `POST /starter-wizard.detect-channels`, debounced and aborted like the OpenAPI drawer's detection — the channels, each with Produce / Consume boxes. `choices === null` means nothing was chosen by hand: the boxes show what the application the document describes does (`asDescribed`), and **no channel list is saved**, so the server keeps following the document; *the other party* flips every channel (`asOtherParty`); any change by hand saves every channel code can be written for, so one left out is left out on purpose. A channel whose messages are Avro (`format: 'avro'`, 2026-11) carries an *Avro* badge (`data-channel-avro`) and the drawer adds a note on how Avro messages travel (`data-events-avro-note`). A channel with a `problem` is disabled with the reason; a refused document shows the server's `messages`. The entry is `EventsWizardEntry` in `eventsByDep` — state, persistence and reset in `useProjectState` (`normalizeEventsByDep`), in snapshots and presets only when there is one (`captureSnapshot`), dropped with its dependency, sent by `buildWizardBody`'s seventh argument only when present (`asyncApiByDep` + `eventOptions`). The props are optional down `InitializrView` → `DependencySelector`. `vite.config.ts` proxies the endpoint. `normalizeOpenApiByDep` now keeps `clientKind`/`copySpec` (a reload used to drop them). Pinned by `EventsWizardDrawer.test.tsx`, `projectUtils.test.ts` and the "wizard entries across a reload" case of `useProjectState.test.ts`.

**Generator round 10, phase 5 (2026-11)** — the Backend tab reopens and updates a project (*Round 10, phase 5* in `backend/CLAUDE.md`). `components/backend/`: `backendModel.ts` is the one mapping between the tab's `ProjectSnapshot` and a model's `request` — `requestOfSnapshot` (what Generate sends, via `buildWizardBody`; `modules` when the project is multi-module and no wizard is in play, as on Generate), `snapshotOfRequest`, `parseBackendModel` (a `menora-model.json` or a bare request; a fullstack model is refused with a pointer to its tab; the server's `REST_CLIENT` reads as `restClient`) and `sameProject`. `backendBaseline.ts` keeps the model a project was generated or imported from (`localStorage` `backend:baseline`, with the file's `catalogHash`); `updateOffered` is true for the same artifact whose **request** has changed — edits that do not reach the request are no change. `useBackendUpdate` (import, remember a generation, `POST /starter.patch`, mark applied, forget) feeds `BackendModelBar`, mounted above `InitializrView` in `App.tsx`: *Import model…* and, while an update is on offer, `BackendUpdatePanel`. `App.downloadProject` calls `rememberGenerated`. `vite.config.ts` proxies `/starter.patch`. The fullstack tab's own baseline and panel (`fullstack/updateBaseline.ts`, `UpdatePanel`) are separate; `countsOf`/`describeCounts` are shared from there. Pinned by `backendModel.test.ts` and `BackendModelBar.test.tsx`.

**Generator round 10, phase 10 (2026-11)** — new visuals (*Round 10, phase 10* in `backend/CLAUDE.md`).
- *Move log:* `WorkflowPanel` has **Keep a log of moves** (`FullstackWorkflow.trackMoves`; switched off it is no setting at all), and `summary.ts` lists the two endpoints it adds.
- *Widgets:* `funnel`, `gauge` and `timeInState` join the kind union, `WIDGET_KINDS` and the library's groups. `pageLayout.ts`: `funnelStageFields` (an entity's enums, its workflow's status first), the validator's rules mirrored (a funnel's stages are an enum and it counts or sums; a gauge needs a target; time in state needs the workflow's log and takes nothing that measures or filters — with a fix that drops the extras), `widgetKindDisabledReason`, `newWidget`, `retargetWidget` and the dashboard's summary line. `WidgetCard` has a Stages select for a funnel and the Target box for a gauge. The canvas draws them with the shapes it has: a gauge as a progress tile, a funnel and time in state as bars.

- *Gallery view:* `FullstackListView` gains `gallery`; `summary.ts` offers it where the entity has an IMAGE field (the view's `by`), the entity card's Views row and `viewDisabledReason` say "needs an image field", `lint.ts` `view-dropped` covers it, and the canvas draws it as tiles.

- *Tree page:* `'tree'` joins `FullstackPageType`. `pageLayout.ts`: `selfLinks` (an entity's many-to-ones to itself), `treeReason` (why an entity cannot have one — the page gallery's entity chooser shows it), the validator mirrored in `validatePages` (no link; several and none named, with a fix that takes the first; a `via` that is not such a link), `blankPage`/`newPageChoices`, `PAGE_TYPE_META` and `DEFAULT_NAV_ICON`. `pages/TreeForm.tsx` (entity, and the Parent link select when there is a choice); `newPageTypes.ts` words its summary; the canvas draws a small sample outline (`data-preview-tree`).

Pinned by `pageLayoutFlowWidgets.test.ts`, `galleryView.test.ts`, `pageLayoutTree.test.ts` and the "log of moves" case of `workflow.test.tsx`.

**Generator round 10, phase 9 (2026-11)** — saved views (*Round 10, phase 9* in `backend/CLAUDE.md`): `savedViews` is a scaffold option like any other (`scaffoldOptions.ts`, `FULLSTACK_ENTITY_OPT_KEYS`, `summary.ts`). Nothing else in the editor changes — the menu and its endpoints follow the option. The Tickets example has it on.

**Generator round 10, phase 8 (2026-11)** — the shell's tools (*Round 10, phase 8* in `backend/CLAUDE.md`). `FullstackNav` gains `userMenu`, `notifications` and `commandPalette`. `navTools.ts` is the one place that knows them: `NAV_TOOLS`, `navToolDisabledReason` (the bell needs an entity whose workflow has an assignee — the validator's rule), `cleanNav` (what an edit leaves: the default style and switched-off flags out, `undefined` when nothing is left — **every nav edit goes through it**, the style radios and the Collapsible box included, so one setting never drops another), `hasNavSettings` and `requestNav` (a bell whose workflow has since gone is left out of the request rather than sent to be refused). `pages/NavTools.tsx` `NavToolsFields` draws the three switches in the pages editor's navigation strip and the Sitemap view's side panel — for both skins (`data-nav-tools`; the style row, `data-nav-options`, is still tailwind only). The Approvals example has all three on. Not drawn: the canvas does not show the tools. Pinned by `navTools.test.ts` and the "header’s tools" case of `PagesEditor.test.tsx`.

**Generator round 10, phase 7 (2026-11)** — rich fields and output (*Round 10, phase 7* in `backend/CLAUDE.md`). `xlsxExport` is a scaffold option like any other (`scaffoldOptions.ts`, `FULLSTACK_ENTITY_OPT_KEYS`, `summary.ts` lists `GET …/export.xlsx`), and counts as an export for a list page's hidden actions (`pageLayout.ts`). A record page has **Offer Print** (`RecordForm`, `FullstackPageDef.printable`; `retargetPage` keeps it only on a record page and names it when dropped). The Markdown editor, card pictures and the attachment drop zone need nothing from the editor: they follow the field's type.

**Generator round 10, phase 6 (2026-11)** — composition in the editor (*Round 10, phase 6* in `backend/CLAUDE.md`). A one-to-many row in `RelationsEditor` has *Edit the rows in this form* (`FullstackRelationDef.composition`; cleared when the kind changes). `childLists.ts` `compositionProblem(parent, rel, mappedBy, entities)` mirrors the server's `checkComposition` rule for rule (required link, single generated key, writable, no workflow, no attachment, no lists of its own, one owner — the first composition of a child in the model's order), and `validation.ts` reports it as the relation's `composition` error once the link is settled. The Orders example composes its lines. Not drawn: the canvas and the form mock do not show the rows editor, nor the step a wizard gains for it. Pinned by `childLists.test.ts` and `RelationsEditor.test.tsx`.

*Uncreatable entities:* `collectWarnings` raises a layout-level `uncreatable:<entity>` warning when a writable entity has no page that creates it, but an entity the layout does create needs it through a required `MANY_TO_ONE`. The message reads "No page creates Customer rows — Order needs one, so it cannot be saved either", and the fix is `addListPage`. These count as creating:
- a reachable list page that keeps New;
- a form, wizard, import or calendar page;
- either side of a master-detail page (the generated parent list has New);
- a record page's related tab;
- a list widget.

The preview's master-detail screen shows the parent's New (`parentNew`). Pinned by `pageLayoutWarnings.test.ts`.
**Frontend pages** (`PagesEditor.tsx` + `pageLayout.ts`): the layout the request
sends as `pages`. Empty means the classic shell (a dashboard plus one list page per entity), and
*Start from my entities* (`seedLayout`) materializes exactly that as an editable starting point;
*Use classic layout* drops it again (undoable). Pages are added from a type gallery (dashboard,
list, tabs, master–detail, record), reordered by drag (`useDragReorder`), hidden from the nav,
and configured in per-type forms; a page id follows its title (`slugify`) until it is typed by
hand. `validatePages` mirrors `FullstackPageValidator` and returns both inline messages per control
(`byPage[index][field]`) and the problem sentences the error count reads. Entity and field renames
are followed into every reference (`renameEntityInPages`/`renameFieldInPages`, driven by a uid map
in `FullstackView`); a *deleted* entity is deliberately left flagged rather than silently dropped.
Relation renames follow into a master-detail's `via` (`renameRelationInPages`), a page id change
follows into the tabs that embed it (`renamePageIdInPages`), and removing a page that is a tab asks
first and drops the tab with it. Pages carry no uid (they go to the server verbatim), so rows are
keyed by `rowKeys.ts` (`useStableKeys`: same object → same id → same position) — never by index.
`validation.issues` carries page + control for every problem; the problem list and the sticky bar's
jump (`revealRequest`) open the page and focus the `[data-control="…"]` element named by it. An issue
with one obvious repair also carries a `fix` (`PageFix`: a stale entity reference removes the page /
widget / tab / tile, an ambiguous master-detail link takes the first relation, a wizard adds the
required fields it forgot to its last step); the problem list shows it as a "Fix: …" button, applied
through `onChange` after `pushUndo`. A **list page** says how it opens (`EntityListForm`): `columns`
(toggle chips in table order, draggable — the `columns:<page>` drag list — with "All columns
(default)"), `sort` (a sortable column + direction), `view` (radios over the four views, disabled with
the reason from `viewDisabledReason` when the entity does not offer one — `enabledListViews` reads
`summarizeEntity`) and `pageSize`. The audit columns exist only with the `audit` opt, so
`validatePages` takes `{ scaffoldOpts }` (`FullstackView` passes `scaffoldOpts`, the admin form the
example's `settings.scaffold`) and `listColumns`/`sortableKeys`/`auditOn` derive from it; the preview
draws the chosen columns and a cards / board / calendar wireframe for the view. Switching a page's
entity or parent goes through a `retarget*` helper (`retargetEntityList`, `retargetMasterDetail`,
`retargetMasterDetailChild`, `retargetRecord`, `stripDateRange` for the period picker) that keeps
what still fits and names what it dropped in the `lossy` notice. The Roles field is always shown;
without an LDAP dep (`ldapAuth === false`) its boxes are disabled and an "Add ldap-auth-rest"
shortcut calls `onAddDep`. A dashboard with four or more widgets opens its cards collapsed to one
summary line each (Expand/Collapse all; a new or re-kinded widget and the card a problem points at
open — `expandRequest`). Wizard steps and record tabs have "Reset to default" buttons; the setup
panel disables Dashboard Title/Overview once a layout exists (`hasPages`).
Beside the list sits a **layout preview** (`LayoutPreview.tsx`, model in `layoutPreviewModel.ts` —
not `layoutPreview.ts`, which collides with the component on Windows' case-insensitive FS): a
wireframe of the generated shell (dark sidebar, or the Menora top bar when the frontend set is
`MENORA_DIGITAL`) with seeded sample data and titles that mirror `EntityScaffoldContext`'s defaults
in en/he; clicking a part of it opens that control. The add gallery also offers `suggestPages`
(master-detail/record where relations exist, a report, a trend dashboard). The admin examples form
reuses `PagesEditor` (`layout="stacked"`) with a JSON fallback. A nav page can take a **group** and an
**icon** (`NavFields`; `NAV_ICONS` maps the backend's lucide whitelist to look-alike Material Symbols,
`DEFAULT_NAV_ICON` is the type's own); `navSections` groups the nav exactly as the generated shell
does (a group gathered where it first appears), and hiding a page drops both. Dashboards have a
**period picker** (`dateRange`) and per-widget options behind the row's tune button (`WidgetOptions`:
width/`span`, `presetFilter` via the shared `PresetFilters`, recent `sortBy`, period `dateField`);
widget kinds include `top` (ranked by `rankableKeys` — groupable fields or MANY_TO_ONE relations) and
`progress` (`target`), and a kpi can `compare` with the previous period (needs the picker). Reports
edit a list of charts (`reportCharts` reads either spelling; one chart is written back as `chart`,
several as `charts`), each under its own control keys (`chartControl`: `chart.*`, `chart2.*`…).

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
`description`; the palette picker gets the same error banner + Retry as the sets (`useFrontendMetadata.reload`). `ImportFromDdlDrawer` takes a `.sql`
file (button or drop on the textarea); the team-conflict dialog has **Rename…** (reopens the save
prompt pre-filled via `saveRequest.draft`; closing the prompt keeps the draft); `validateMeta` checks
`name`/`version`; Copy as curl warns past `MAX_ENCODED_LENGTH`. **Enum labels:** `FullstackFieldDef.enumLabels`
(`Record<constant, label>`, additive — old presets/links lack it) is edited per chip in
`EnumValuesEditor` (`labels`/`onLabelsChange`; the draft accepts `OPEN:Open`), pruned when a value
goes (`enumLabels.ts` `pruneLabels`), mirrored by `quickAdd` `values="OPEN:Open|CLOSED"`, shown by
the UI mock (`enumLabel` = explicit else `humanizeConstant`, mirroring `EntityScaffoldContext`) and
validated like the server's `canonicalEnumLabels` (key must be a value, non-blank, ≤ 80 chars, ENUM only). The tickets example carries labels so the path is exercised.

## Round 11 (2026-11) — the site's own UX, speed first

The plan is `~/.claude/plans/stay-on-the-same-temporal-matsumoto.md` (nine phases, 0–8). Its rules hold
for every phase: **no new npm packages**, new surfaces are `lazy()` chunks, **no new framer-motion
usage** (CSS transitions, `@starting-style`, View Transitions), no new `backdrop-filter` surfaces, no
`infinite` animations, nothing waits on an animation.

**Phase 0 — baseline.**
- `npm run build:check` builds and runs `scripts/check-bundle-budget.mjs`: it prints what first paint
  downloads (entry, react, motion, CSS — raw and gzip) and **fails when the entry chunk passes
  `ENTRY_BUDGET`** (112 800 bytes). Raise the budget deliberately, never to turn a build green.
- The entry had grown to 235 KB because `backend/useBackendUpdate.ts` imported `countsOf`/`describeCounts`
  from `fullstack/updateBaseline.ts`, which imports `snapshot.ts` → `pageLayout.ts` (91 KB) and friends.
  They live in `utils/updateCounts.ts` now (re-exported from `updateBaseline.ts`). **Nothing the Backend
  tab renders at first paint may import from `components/fullstack/`.** To see what a chunk holds:
  `npx vite build --sourcemap --outDir <scratch>` and read which `sources` its map names.
- The dependency catalog is off framer-motion: `DependencyCard` is a plain `<label>` (accent bar = a
  `scale-y` transition, tick = the `check-pop` keyframe), and a group collapses with `.collapse-rows`
  (`grid-template-rows: 1fr ↔ 0fr` + `visibility`, in `index.css`) instead of a measured `height: auto`
  animation — in `DependencySelector` and `frontend/AvailableDependenciesFE`. The Selected ("cart") list
  keeps its framer animations: it is a handful of rows.

**Phase 1 — foundation.**
- *Theme.* `@custom-variant dark (&:where(.dark, .dark *))` in `index.css`: `dark:` follows the app's
  class, not the OS. Glows come from the token (`.glow-primary`, `.glow-primary-soft`), warnings from
  `text-warning` / `bg-warning/10` — never a literal violet or `yellow-*`. `hooks/useTheme.ts`
  `useIsDark()` reads the `html` class (a `MutationObserver` store); the two CodeMirror hosts
  (`ReadOnlyCodeViewer`, admin `CodeEditor`) pass it as their `theme`.
- *Focus.* One `:focus-visible` ring (`--focus-ring`: primary, tertiary in light) at zero specificity,
  and `label:has(input.sr-only:focus-visible)` rings the label of every custom checkbox, radio and pill.
  `.collapse-rows > *` is padded 4px and pulled back so a ring at the edge is not clipped.
- *Toasts.* `src/toast.ts` is the one stack (`showToast` / `dismissToast`, at most three, 3 s — 6 s with
  an action — paused while hovered); `components/Toaster.tsx` draws it bottom centre. `AppToast` and
  `admin/shared/StatusToast` are adapters (`useToastProp`) that keep their `toast` / `onClear` props, so
  no caller changed; each renders a `Toaster` and only the first mounted one draws. New code calls
  `showToast` directly. `src/test/setup.ts` runs `resetToasts()` between tests.
- *Modals.* `hooks/useModal.ts(ref, { onClose, active, initialFocus, lockScroll })`: Escape (top modal
  only, skipped when an inner widget `preventDefault`ed it), a real Tab trap, counted scroll lock, focus
  back to the opener (read at render time — an `autoFocus` inside runs before effects — and not during
  StrictMode's test unmount). Used by `ConfirmDialog`, `ShortcutsOverlay`, `AdminFormDrawer`,
  `TemplateCompare`, `ProjectPreview`. A new dialog uses it rather than its own `keydown` listener.
- *Shell.* `App.tsx` `NAV` is the one list of tabs: a row with `aria-current` from `lg`, a
  `shared/PopoverMenu` below it; Share / Reset / animations / theme are in the row from `xl` and a
  "more" `PopoverMenu` below. `shared/PageHeader` is the heading of all three generator tabs (the
  Backend one sits in `BackendModelBar`'s row, which takes it as `children`). `BackendUnreachable`
  (lazy) replaces the dead "Cannot reach backend" card: Retry, and an automatic retry after 2, 4, 8, 15,
  30 s while the tab is visible — `useMetadata` gained `reload` / `retrying`. Its sibling
  `AccessBlocked` (lazy) is shown when the backend's access gate refused the catalog — a 403 whose
  body carries `code: "USERINFO_REQUIRED"` (`useMetadata`'s `blocked`; *Access gate* in
  `backend/CLAUDE.md`): "No access", the backend's words, a Try again button and no automatic
  retry. Pinned by `components/AccessBlocked.test.tsx`. `CommandPalette`,
  `ConfirmDialog` and `BackendUnreachable` are lazy in `App.tsx` (the palette's chunk is fetched on idle).
- *Narrow windows.* The Backend body is `grid-cols-1 lg:grid-cols-12` (twelve tracks with 40px gaps were
  440px wide before any content). The two dependency panels sit side by side, pinned, from `lg` — every
  desktop width — and below it Selected comes first, capped at 45vh. **A picked dependency's options and
  wizard buttons are in the Selected panel, so it must be in sight while picking**: this round first
  stacked the panels below `xl` with the catalog on top, which put them a screen below the fold on a
  1280px window (a 1920px monitor at 150% scaling). Pinned by `DependencySelector.test.tsx`.
- The Frontend tab's Reset uses `ConfirmDialog`, not `window.confirm`.

Pinned by `toast.test.tsx`, `hooks/useModal.test.tsx` and `components/BackendUnreachable.test.tsx`.

**Phase 2 — keyboard, palette, dependency search.**
- *Matching.* `utils/fuzzy.ts` `fuzzyMatch(query, text)` → `{score, ranges}`: a substring (exact > prefix
  > start of a word > inside), else the letters in order when they sit at word starts or run on
  (`sdj` → **S**pring **D**ata **J**PA; quality below `FUZZY_QUALITY_MIN` is no match, so `gen` does not
  hit "Go to Backend"). `substringMatch` is for prose (descriptions). `shared/Highlight` draws the ranges
  as `mark.search-hit`. In-house — no library.
- *Commands.* `commands.ts` is **scoped**: `registerCommands(list, scope = 'view')`, scopes merged with
  `global` last. Whoever owns a piece of state registers the actions on it: `App` (`global`: the tabs,
  theme, animations, share; `backend`: Generate, Explore, Compare, multi-module, Reset, shortcuts),
  `DependencySelector` (`backend-deps`: search, and the wizard of each selected dependency),
  `PresetPicker` (`backend-presets`: save, load each preset / recent), `BackendModelBar`
  (`backend-model`), `FrontendView` and `FullstackView` (`view`). **An effect that registers must not
  depend on a callback prop** — registering re-renders `App`, a subscriber — read it through a ref.
- *Palette* (`CommandPalette.tsx`, lazy): no query → "Recent" (`localStorage` `palette:recent`, last 8),
  then everything under its group heading; a query → ranked across groups, the title's match marked. At
  most `MAX_ROWS` (50) rows are drawn, with a "Showing 50 of N" footer. `role="combobox"` /
  `listbox` / `option` with `aria-activedescendant`. The catalog items (dependencies, templates, settings)
  are offered on the Backend tab only.
- *Keys.* `hooks/useHotkeys(bindings, enabled)`: a chord (Ctrl/⌘) fires while typing, a bare key only
  outside a field, nothing under a modal. Backend: Ctrl+Enter, Ctrl+Shift+E, `?` (`App`), `/`
  (`DependencySelector`), Ctrl+S (`PresetPicker`). Frontend: the same but Ctrl+S. `ShortcutsOverlay`
  takes `shortcuts` (`BACKEND_SHORTCUTS`, `FRONTEND_SHORTCUTS` beside `FULLSTACK_SHORTCUTS`) — **a new
  binding goes into its list too**. The Fullstack tab keeps its own handler.
- *Dependency picker.* Search is `fuzzyMatch` on the name, `substringMatch` on the description, a
  substring of the id; the catalog keeps its order. From the search box ↓ enters the results, ↑/↓ move
  between cards (`input[data-dep-card]`, open groups only), Enter toggles the first result, Escape clears.
  A card shows a **wizard badge** (`SQL` / `OpenAPI` / `WSDL` / `AsyncAPI`) before it is selected and a
  star (`hooks/useDepFavorites`, `localStorage` `depFavorites`). **Quick picks** above the catalog:
  favourites, then the dependencies of recent projects (`InitializrView` → `recentDepIds`), then the
  most used here (`hooks/usePopularDeps` → `GET /metadata/popular-deps`, through `catalogCache`; empty
  when it fails).
- `BackendUpdatePanel` and `ModuleSelector` are lazy. The entry budget was re-based once, to 120 000
  bytes, when the picker's search and keyboard code (first-paint code) used up the first one — the
  history is in `scripts/check-bundle-budget.mjs`.

Pinned by `utils/fuzzy.test.ts`, `components/CommandPalette.test.tsx` (palette, the registry's scopes,
`useHotkeys`) and `components/DependencySelector.test.tsx`.

**Phase 3 — Generate, and what comes after it.**
- *One request builder.* `projectUtils.ts` `buildProjectRequest(target, form, selected, …)` →
  `{url, init, kind, key}` for `'zip'` or `'preview'`: a POST to the wizard endpoint when a selected
  dependency carries a wizard payload, else a GET (the multi-module endpoint when modules are ticked).
  `triggerDownload`, `useProjectPreview`, "Copy as curl" (`utils/curl.ts` `curlFor`) and the file dock
  all go through it — it used to be written out three times. `key` identifies the project a snapshot
  generates (the staleness check and the dock's cache use it).
- *Every download is a `fetch`.* The plain path was an `<a download>` click: the page could show no
  progress and a server error was saved as a broken zip. `triggerDownload(…, signal)` now rejects with
  the server's words, or an `AbortError`.
- *While it builds.* `App.downloadProject` keeps `generating` (the button reads "Building…", a second
  click does nothing) and shows **Cancel** once it has taken 700 ms. `utils/busy.ts` `useBusy(active)`
  sets `html[data-busy]` (counted) — the three generator tabs call it for their generate and preview
  requests — and `index.css` runs the header's conveyor and gears **only under that attribute**. That
  is the one sanctioned `infinite` animation: it is bounded by a request.
- *Next steps.* `shared/NextSteps` is the card (title, hint, command rows with Copy, an action row, a
  stale notice, children); `fullstack/NextStepsPanel` wraps it and keeps its `data-next-steps*` hooks.
  The Backend tab shows `backend/BackendNextSteps` (lazy) from `App`'s `lastRun` — unpack / run / test,
  Save as preset (`runCommand('backend-save-preset')`: `commands.ts` `runCommand(id)` runs another
  owner's registered action), Copy as curl, Copy share link, Explore — stale once
  `buildProjectRequest('zip', …).key` differs from the run's. The Frontend tab renders `NextSteps`
  itself, with the run command in the project's package manager.

Pinned by `utils/projectRequest.test.ts` (builder, download, curl) and `shared/NextSteps.test.tsx`
(card, Backend card, `useBusy`, `runCommand`).

**Phase 4 — Explore as a small IDE** (`ProjectPreview.tsx`, shared by all three tabs; a lazy chunk).
- *Tree.* `explore/FileTree.tsx` — **no editor import**, so the file dock can draw it on the page. Rows
  are computed flat (`visibleRows(tree, collapsed, filter)`): `role="tree"` / `treeitem`, one Tab stop,
  ↑ ↓ Home End, → opens or steps in, ← closes or goes to the parent, Enter selects. A `filter` narrows to
  matching files under their (opened) directories — `fuzzyMatch` on the name, a substring of the path, so
  a breadcrumb can filter to `src/main/`. `fileStatuses` / `changedDirs` mark a diff, `flash` a new path.
- *Modal.* Left column: **Files** (filter box; `/` or Ctrl+P) or **Search** (Ctrl+Shift+F —
  `utils/searchFiles.ts`, a scan of the in-memory files, two letters at least, `MAX_SEARCH_HITS` lines,
  each hit cut around its match). The column is resizable (drag the separator, or ← → on it;
  `localStorage` `explore:treeWidth`). The bar over the file: breadcrumbs (a folder filters the tree to
  it), wrap (`explore:wrap`), copy path, copy file, download file. It opens on `initialPath`, else the
  file looked at last (`sessionStorage` `explore:lastPath`), else the first. `useModal` gives Escape and
  the Tab trap; a filter's own Escape clears it first.
- *Diff.* `utils/diffRows.ts` is the model, apart from the drawing: `diffRows` (rows name lines by
  number), `foldUnchanged` (runs of 8+ unchanged lines fold, three lines of context kept beside a
  change), `hunkStarts` (Previous / Next change), `pairRows` (side by side: removed beside added, the
  shorter side padded). `DiffContentViewer` draws unified or side by side (`explore:diffMode`).
- *Colour without an editor.* `utils/highlightCode.ts` `tokenizeLines(code, languageExtensions)` runs the
  grammar `lang-from-path.ts` already loaded through `@lezer/highlight`'s `classHighlighter`; `index.css`
  colours the `tok-*` classes under `.code-tokens` per theme (`--tok-keyword`…). `@lezer/highlight` was
  already installed as CodeMirror's dependency; it is listed in `package.json` (and the lockfile's root)
  only so the import is explicit.

Pinned by `explore/FileTree.test.tsx` (rows, tree, the diff model, `searchFiles`, `tokenizeLines`).

**Phase 5 — the file dock** (Backend tab): the tree of files the setup on screen generates, kept
current as it changes, with what the last change did ("Kafka adds 4 files, changes 2").
- `backend/FileDock.tsx` (lazy; its tree is `FileTree`, so no editor on the page). Closed it is a
  "Project files" button at the bottom right; open, a 300px panel at the right edge — a column of its
  own from 1440px (`App`'s `<main>` gets `min-[1440px]:pr-[300px]`), and below that a **drawer**: a
  scrim over the page (`data-file-dock-scrim`, hidden by CSS from 1440px), closed by a click beside it
  or Escape. It must never lie over the dependency panels unasked — it once did, hiding the catalog's
  wizard badges — so a stored "open" is honoured only from 1440px. `App` owns `dockOpen`
  (`localStorage` `backend:fileDock`; open by default only from 1600px) and `previewRequest`
  (`buildProjectRequest('preview', …)`, null while the form cannot generate). Added files flash
  (`.tree-flash`) and are marked against the previous answer; `describeChange` words the change, naming
  the dependency when exactly one was added or removed between the two.
- **When it may ask the backend** — `hooks/useLiveProjectTree.ts`: only while the dock is open *and* the
  tab is visible; `LIVE_DEBOUNCE_MS` (500) after the last change, the call in flight aborted; never for a
  request key it already holds (`utils/livePreviewCache.ts`, the last 8, so ticking a dependency off and
  on is instant); with the header `X-Preview-Intent: live`, which keeps it out of the generation audit
  (*Round 11* in `backend/CLAUDE.md`). Refresh asks again. **Do not relax these**: the dock is the one
  part of the site that calls the backend without being asked.
- A click on a file opens Explore on the preview the dock holds (`useProjectPreview.showPreview`,
  `ProjectPreview`'s `initialPath`); the Explore button does the same when the dock already has exactly
  that request (`livePreviewFor(key)`), so neither costs a call.

Pinned by `hooks/useLiveProjectTree.test.tsx` (the hook's rules, the cache, `describeChange`, the dock).

**Phase 6 — motion, without script.**
- `utils/viewTransition.ts` `withViewTransition(update, { name?, origin? })` runs a state update inside
  `document.startViewTransition` (the update is `flushSync`ed — the browser snapshots when the callback
  returns), sets `html[data-transition=<name>]` for its length, and simply runs the update where the API
  is missing or motion is off. `App` uses it for a tab switch (`goTo`, the "Go to" commands) and the
  theme toggle. In `index.css`: the page cross-fades in 160 ms; `.glass-header` is its own layer
  (`view-transition-name: app-header`) so it does not fade; **`.nav-indicator`** — the line under the
  active tab, rendered only in that tab — carries a `view-transition-name`, which is what slides it
  between tabs; `data-transition="theme"` reveals the new theme in a circle from `--vt-x`/`--vt-y`.
- `dialog-enter` (confirm, shortcuts, tour card), `panel-enter` (Explore, Compare), `dock-enter`,
  `toast-enter`, `next-steps-enter` are one-shot keyframes. `shared/CopyButton` turns into a tick for a
  moment after copying (the next-steps commands, Explore's copy path / copy file), so a copy answers
  where it was clicked; the toast is kept for a refused copy.

**Phase 7 — guidance.**
- `shared/CoachTour` is the tour (spotlight, card, Back / Next / Skip, arrows, Escape, once per browser
  under `storageKey`), generalised from `designer/DesignerTour.tsx`, which is now a wrapper with the same
  exports. It looks its anchors up **after mounting** — a part rendered in the same pass is not in the
  document during render. `components/tours.tsx` (lazy) holds the Backend, Frontend and Fullstack tours;
  their stops are parts marked `data-tour="…"` (`quick-start`, `project-setup`, `dep-search`,
  `selected-deps`, `file-dock`, `actions`, `fe-deps`, `fs-start`, plus `#fs-entities` / `#fs-pages`).
  A renamed or removed anchor silently drops its stop.
- `App` opens a tab's tour by itself once (`localStorage` `tour:<backend|frontend|fullstack>` — read
  directly, so the tours chunk is not loaded to learn one was seen): it waits for the tab's
  `TOUR_READY` anchor, never opens over a dialog, and not at all on a share link (a query beyond `tab`).
- The header's **Help** menu (`PopoverMenu`): Take the tour, Keyboard shortcuts (the Backend sheet, or
  `runCommand('fe-shortcuts' | 'fs-shortcuts')`), Guide, Training. `data-tip="…"` is a CSS-only tooltip
  (hover and keyboard focus, 0.35 s delay) on the header's icon buttons, in place of `title`.
- Empty states act: the empty cart says "press /" and has a Search button; "No results" has Clear search.

**Phase 8 — one visual language** (deliberately small).
- `html.dark { color-scheme: dark }` / `html.light { color-scheme: light }`: what the browser draws
  itself — a native `<select>`'s list, scrollbars, date pickers, number spinners — follows the app's
  theme. It was always light before.
- `.surface-toolbar` and `.surface-panel` (`index.css`) are the flat surfaces of the dense tools — no
  blur. The designer's header, Explore's, Compare's and the Config sidebar's head use `surface-toolbar`.
- Not done: restyling the designer's and Config's cards and native selects beyond that; replacing
  Lucide in Guide / Training; the inline icon `fontSize` styles.

Pinned by `shared/CoachTour.test.tsx` (the tour, the tab tours' keys, `CopyButton`, `withViewTransition`).

**Where the round left first paint.** Entry chunk 235 KB → 113 KB raw (66.6 → 32 KB gzip), with every
new surface a lazy chunk: `CommandPalette`, `ConfirmDialog`, `BackendUnreachable`, `BackendUpdatePanel`,
`ModuleSelector`, `BackendNextSteps`, `FileDock` (+ `FileTree`), `tours`, the shortcuts sheet.

**Looking at the site without the Chrome extension.** Start the backend on a scratch database and
`npx vite`; a headless Chromium can then be driven over its DevTools port from a ~150-line Node script
(Node 24 has a global `WebSocket`): `Page.navigate`, `Runtime.evaluate`, `Input.dispatchMouseEvent` /
`dispatchKeyEvent`, `Emulation.setDeviceMetricsOverride`, `Emulation.setEmulatedMedia` for the colour
scheme, `Page.captureScreenshot`. Unlike `--screenshot`, it can click, type and resize.

**Round 12 (2026-11)** — the UI side of *Round 12* in `backend/CLAUDE.md`. `projectUtils.ts` `wizardDepIds(selected, …)` names the selected dependencies that carry a wizard payload — the condition under which `buildProjectRequest` goes to the wizard endpoint, which writes one module whatever the multi-module switch says. `InitializrView` hands the list to `ModuleSelector` (`wizardDeps`), which shows a warning (`data-modules-unused`, `role="status"`) above the modules while any is ticked: the modules used to be dropped without a word. `admin/AdminLogin` shows the server's message for a 429 (too many wrong passwords) instead of "Invalid password". Pinned by `ModuleSelector.test.tsx` and `utils/projectRequest.test.ts`.

**Enforced access (2026-11)** — the editor side of *Enforced access* in `backend/CLAUDE.md`. `fullstack/access.ts` is the one place that knows an entity's access levels: `ACCESS_LEVELS` / `DEFAULT_ACCESS` (from the schema document), `readLevel` / `writeLevel`, `cleanAccess` (a level equal to its default is not written, so an untouched entity keeps its shape — **every edit goes through it**), `accessProblem` (the server's rule: write not open to more people than read) and `accessSummary`. `EntitySettingsPanel` has *Who may read* / *Who may write* (`data-entity-access`); `validation.ts` reports the problem as `EntityErrors.access`, which forces the panel open; `lint.ts` `access-needs-ldap` (fix: add ldap-auth-rest) replaces `secured-needs-ldap`. `secured` is `retired` in `scaffoldOptions.ts`: still listed (the schema names it) and no longer offered. Pinned by `access.test.tsx`, `lint.test.ts` and `scaffoldOptions.test.ts`.

**Generated tests (2026-11)** — the editor side of *Generated tests* in `backend/CLAUDE.md`. A new model starts with the `tests` option on (`FullstackView` `DEFAULT_SCAFFOLD_OPTS`, also what Reset restores); a stored draft keeps what it chose. The option is labelled *Tests* in `scaffoldOptions.ts`, and `entityCode.ts` shows an entity's `<Entity>ApiTest.java` after its controller. Pinned by the "a new model" case of `FullstackView.test.tsx`, `scaffoldOptions.test.ts` and `entityCode.test.ts`.

**Local run (2026-11).** The next-steps cards name the compose commands: the Fullstack card a *Docker* row (`docker compose up --build`, then :3000), the Backend card a *Services* row (`docker compose up -d`) and the `compose` profile in its *Run* command when a selected dependency has a container — `composeProfiles` in `backend/BackendNextSteps.tsx` keeps the backend's `LocalRun.SERVICES` list; `BackendRun.dependencies` carries the ids. The `testcontainers` dependency comes from the catalog like any other.

**Read from a database (2026-11).** This is the editor side of *SQL wizard from a live database* in `backend/CLAUDE.md`.

- `components/liveSchema/liveSchemaApi.ts` holds the types, `useLiveSchemaOptions` (the catalog cache, cleared by any admin write, so a new source shows) and `postLive`/`fetchSchemas`/`fetchTables`/`fetchDdl`; an error carries the server's `{error, detail}`.
- `LiveSchemaPanel` is the shared panel: a database type (unless fixed), *Connect to* (the sources of that type, then *Another database…* when typed connections are allowed), the typed form (host, port with the default as placeholder, database / service name / DB2 library, user, password, SQL Server's *Trust the server's certificate*), Connect, the schema picker, the filterable table list (views marked), *Keep the schema name*, and the read button whose words the host gives. Any change to the connection forgets what was listed through it.
- **The password stays in the panel's state only**: never stored, never in a snapshot or share link, and sent with each call. A missing driver is said instead of the form.
- `SqlWizardDrawer` has *Read from a database…* beside the SQL box, with the dialect fixed to the dependency's. The script read replaces the box, with a status line (`data-live-read`: counts, the server's warnings) and **Undo**.
- `ImportFromDdlDrawer` (DDL variant) switches between *Paste SQL* and *From a database* (`data-ddl-source`). From a database, the panel reads through `/metadata/fullstack/import-live` straight into the existing preview, and the primary button imports as before. The mapping to editor entities is `toEditorEntities`, shared with Parse.
- Admin → **Schema sources** (`admin/schema-sources/SchemaSourcesTab.tsx`, backend only): the list (where, user, whether the password reference is set on the server), a form whose *Password from* takes a reference, never a password (`PASSWORD_REF` mirrors the server), and *Test connection* on the unsaved form.

Pinned by `liveSchema/LiveSchema.test.tsx`.

## Performance rules

- **The entry chunk has a budget** — `npm run build:check` (see *Round 11, phase 0*). What is not needed
  to paint the Backend tab is a `lazy()` chunk.
- **Catalog lists are fetched once per session.** `useMetadata` (`getMetadata`) and `hooks/catalogCache.ts`
  (`useCatalog`, behind `useCompatibility`, `useStarterTemplates`, `useFrontendMetadata`, `useSqlDialects`,
  `useExtensions`, `useModuleTemplates`, `useOpenApiCapable`, `useSoapCapable`) share one promise per URL.
  `invalidateCatalog()` runs on every admin write (`adminFetch` non-GET) and from `invalidateMetadata()`
  (refresh/import); `src/test/setup.ts` clears it between tests. Team models/templates stay live.
- **Admin tabs, grammars and the relation graph are lazy.** `AdminPage` lazy-loads each tab
  (`TAB_LOADERS`) and prefetches the rest on idle; `lang-from-path.ts` loads one CodeMirror grammar per
  language (`useLanguage`); React and framer-motion are their own chunks (`vite.config.ts` `manualChunks`).
- **The entity editor is memoized per card.** `EntitiesEditor` is `memo`, and each card is the memoized
  `EntityCard`, whose handlers come through one stable `api` object that forwards to the editor's latest
  helpers — a card that skipped a render must never edit the list it last saw (pinned by
  `EntitiesEditor.test.tsx` "memoized cards"). Props handed to the editor from `FullstackView` must keep their
  identity (`useStableCallback`, memoized objects); a new inline arrow or object there re-renders every card.
  The shared relation-target list (`entityNames`) is a deferred value.
- **Draw-only data trails the input.** `useDrawnPages` (`pages/usePagesModel.ts`) feeds the canvas preview and
  the suggestion lists a render behind while the layout keeps its shape; validation is never deferred.
  Snapshots compare through `snapshotKey` (JSON cached per snapshot object — never mutate a snapshot), and the
  big Fullstack drafts persist through `usePersistThrottled` (at most every 400 ms, flushed on pagehide).

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

Tailwind v4 (`@import "tailwindcss"` + `@theme` in `src/index.css`) with Material 3 token names
(`bg-surface-container-lowest`, `text-on-surface`, `border-outline-variant`, `text-primary`…). Dark is the
`@theme` default; `html.light` overrides it (toggled in `App.tsx`, pre-paint script in `index.html`), and in
light mode `text-primary` is remapped to the tertiary blue because gold text on white is unreadable. Fonts
(Geist) and icons (Material Symbols) are bundled via `src/fonts.css` — the deployed UI is
offline, never add a CDN link. The icon font is **not** the package's 4 MB variable font: it is
`src/assets/fonts/material-symbols-outlined.woff2` (~1.4 MB), built by `scripts/instance-material-symbols.py`
(fontTools), which keeps every glyph (admins type free icon names) and the `opsz` axis but pins FILL/GRAD and
cuts `wght` to 400–700. Rerun it after upgrading `material-symbols`; an icon weight outside 400–700 needs the
script changed first. `index.html` preloads it. The backdrop (grid, blobs, pipes, conveyor, gears) is drawn
still — looping it kept the CPU busy on an idle page — so don't add `infinite` decorative animations back. Container queries (`@container` / `@sm:`) are used where a form must stack
by its column's width rather than the window's (the page forms in the layout designer's inspector).

**OpenAPI drawer: Server code as (2026-11).** With a server side (Controllers or Both) the drawer offers *Interfaces* (an `Api` interface per tag, regenerated, and a controller class that is the team's) or *Classes*. A new setup (`initial === null`) starts on Interfaces; an entry saved before the choice existed reads as Classes (`styleOf`). The entry keeps `apiStyle: 'interfaces'` only; `buildWizardBody` sends it only with a server side; `backendModel` imports the server's `INTERFACES`; `useProjectState` keeps it in the stored draft.

**Activity tab (2026-11).** `admin/activity/ActivityTab.tsx` over `hooks/useActivity.ts` (`useActivity(days)` the summary, `useActivityEvents(filter, page, size, tick)` a page of events — 250 ms after the last filter change — and `downloadActivityCsv(filter)`, a fetch with the admin token turned into a download). Periods 1/7/30/90/365 days; five cards (generations, previews, success rate, P50, P95); a per-day bar chart stacked by kind (`KINDS`, plain divs, a day's breakdown in its tooltip); six lists (kind, department, users, dependencies, Boot versions, endpoints) — a kind, department or user row narrows the events; failures by reason with *Show events*; the events table with date, kind, action, status, department, user and text filters, paging and *Export CSV*. Pinned by `ActivityTab.test.tsx`.

**Admin sign-in and History (2026-11).** `AdminLogin` asks `/admin/login/options`: *Sign in as &lt;user&gt;* (`POST /admin/login/sso`) when single sign-on is set up and the gateway named the user, the password form while it is allowed; `onSuccess(token, user)`, the name kept in `sessionStorage.adminUser` (dropped on logout and on a 401) and shown in the header (*Signed in as*, `/admin/me` for a token from before). `admin/history/HistoryTab.tsx` (sidebar *History*): Changes (filters by table, source, who, text; a request's changes) and Requests (each with *Show changes* and *Undo*); a change opens a drawer with its fields before and after (changed ones marked) and *Undo this change*, *Restore this version*, *Its whole request*; a 409 opens *Changed since* with the rows, and *Undo anyway* resends with `force`. A successful restore drops the admin and metadata caches. Pinned by `history/HistoryTab.test.tsx`.

**Who changed what (2026-11).** This is the editor side of *Who changed what* in `backend/CLAUDE.md`.
- `audit` is labelled *Audit (who and when)*, and `history` (*Change history*) is a per-entity scaffold option (`scaffoldOptions.ts`, `FULLSTACK_ENTITY_OPT_KEYS`).
- `summary.ts` gates `history` like soft delete (writable, single key) and lists its two endpoints.
- A list page's columns and sort accept `createdBy`/`updatedBy` with audit (`pageLayout.ts` `listColumns`, `fieldOptions.ts`).
- The canvas does not draw the history panel or the *Changed by me* toggle.

**Entity events and notifications (2026-11).** This is the editor side of *Entity events and notifications* in `backend/CLAUDE.md`.
- `events` is a per-entity scaffold option (`scaffoldOptions.ts`, `FULLSTACK_ENTITY_OPT_KEYS`), gated in `summary.ts` like `history`. It adds no per-entity endpoint (the stream is the app's).
- `WorkflowPanel` has an *e-mails* row on each step (`data-workflow-notify`): Assignee (disabled without an *Assigned to* field), Creator, Admins, Users → `FullstackTransition.notify`, left out when empty. `workflow.ts` `NOTIFY_RECIPIENTS`; `workflowProblem` mirrors the server (an assignee needs the field; a creator needs audit — `validation.ts` passes `audited`, the entity's override else the project option); `syncWorkflow` drops `assignee` from the e-mails when the assignee field goes.
- Pinned by the "workflow e-mails" cases of `workflow.test.tsx` and `summary.test.ts`.
