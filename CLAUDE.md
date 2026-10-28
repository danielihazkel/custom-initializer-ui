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

### Design kits (`designKits.ts`)

A design kit (backend `design/`, see `../DESIGN_STUDIO_PLAN.md`) is the look of the generated frontend on top of one frontend set. `useDesignKits()` lists the published kits (`/metadata/design/kits`, catalog cache); when there are any, the Appearance view's Look group (`designer/FrontendSettings.tsx`) offers them instead of the bare sets they restyle (a set no kit covers is still offered bare). Picking a kit pins `{key, version}` (`FullstackSnapshot.designKit`, persisted as `fullstack:designKit`), switches `frontendSet` to the kit's `baseSetKey` and applies the kit's `defaults` (locale/RTL); picking a bare set clears the pin. The request sends `designKit: "key@version"`, so a model keeps its look until the user takes a newer version from the upgrade notice (`kitStatus`: `upgrade` / `missing`). Examples may name `settings.designKit`. The sketch (`LayoutPreview`) takes the kit's `color-brand`/`color-gold` tokens (`kitPreviewPalette`, palette references resolved); the Appearance view and Play show the real app (below). `designContract.test.ts` pins `NAV_ICONS`, `WIDGET_KINDS` and `PAGE_TYPE_META` against `__fixtures__/design-contract.json`, which the backend's `DesignContractSnapshotTest -Ddesign.contract.update=true` writes — never edit it by hand.

### The generated app on the canvas (`src/designRuntime/`, `designer/AppCanvas.tsx`)

The layout designer's **Design** and **Play** modes and its **Appearance** view run the *generated frontend itself*: `useAppPreview(request)` asks `POST /starter-fullstack.preview?assets=true` for the model as it stands (the inspector's Code-tab request, `codeRequest`; not while the layout has problems; debounced, last 4 cached), `payloadFromPreview` turns the answer into the runtime's payload, and `PreviewFrame` runs it in the design preview runtime — `<iframe sandbox="allow-scripts allow-forms" src="/design-runtime/index.html">`, served by the backend (built in the `design-studio` repo; the Vite proxy forwards `/design-runtime`, and **a deployment must route it to the backend like `/metadata`**). The runtime answers the app's `/api` calls from sample rows built from the model, so clicks, saves and workflow moves behave as in the shipped app. `AppCanvas` lays the app out at a device's window width (`APP_VIEWPORT`: 1280/820/390 — the shells switch layout at lg) scaled to the canvas, keeps **the sketch on screen until the app has compiled once**, and falls back to it (with the reason) when there is no request, the generator refuses the model, or the runtime does not answer within `READY_TIMEOUT_MS` or speaks another `PROTOCOL_VERSION`. The app's route changes follow into the designer (Play's trail, Appearance's page), and the designer's page/data-state switches go to the app (`navigate` only when the page differs, so the app's own record ids and tabs survive). Once an app has run, a model that cannot be generated (problems to fix) or a failed request keeps it on screen, marked as the last one that generated.

**Design mode on the app** (protocol v3). `AppCanvas`'s `design` prop sends the runtime a `DesignState` — page type, the selected part (`widget.<i>` or null), the page's problems by control, and a library widget drag in progress — and the runtime's editing layer stops the app's own clicks and keys, rings the parts (title, description, a dashboard's widgets: hover, selected, problem with its message), shows a widget toolbar (move, duplicate, change kind) and a resize handle, renames the title/description in place on double-click, and shows where a dragged library widget lands. Its gestures come back as intents that `LayoutDesigner.onDesignIntent` applies like the sketch's: `pick` → `reveal(…, false)` (no focus pull, so a double-click can rename), `pickPage` (an app nav link) → select that page, `rename` → `renamePart`, `reorder`/`resize`, `drop` (the library drag is kept in `lastWidgetDrag`, because its dragend arrives before the runtime's drop), `tool` (the kind menu opens under `anchor(rect)`, a fixed element over the runtime's toolbar). Keys pressed in the app are replayed on the frame element, so undo and the designer's shortcuts work after a click in the canvas. The model then regenerates (~1 s) and the app reloads at the same scroll. The toolbar's **App | Sketch** switch (`prefs.canvas`, default app) keeps the sketch one click away — it is the only canvas that edits a list's columns, tabs, record tabs, wizard steps and the other per-type parts — and the sketch takes the canvas by itself while a page *part* is dragged from the library (it has no drop target in the app). Playwright note: element boxes inside the scaled frame ignore its CSS scale; map coordinates through the iframe's box and scale. `protocol.ts` is a verbatim copy of `design-studio/runtime/src/protocol.ts` (that repo's tests compare them); `designRuntime.test.tsx` pins `PROTOCOL_VERSION` to the contract fixture's `runtimeProtocol`. In jsdom the runtime never starts, so tests see the sketch.

## Performance rules

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
