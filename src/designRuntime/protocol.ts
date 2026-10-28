/**
 * postMessage protocol between a host (the generator's layout designer, the Design Studio) and the
 * sandboxed preview runtime. The host keeps a verbatim copy (ui/src/designRuntime/protocol.ts);
 * PROTOCOL_VERSION pins the pair, and `ready` tells the host which version it is talking to.
 *
 * v2: the runtime runs the **whole generated frontend** — every `src/**` file the generator wrote
 * for the model (POST /starter-fullstack.preview), entry `src/main.tsx` — against an in-memory
 * backend built from the model, so the preview is the app that ships, not a re-implementation.
 *
 * v3: design mode. With a `design` state the runtime stops the app's own clicks and draws an
 * editing layer over it (rings, a widget toolbar, resize handles, drop lines, in-place rename);
 * what the user does there comes back as intents (`pick`, `rename`, `reorder`, …) for the host
 * to apply to the model — the app is then generated again.
 *
 * v4: every part the layout designer edits is a part (period picker, filters, charts, tab
 * strips, header numbers, steps, lanes, list columns, …), titles of tabs, steps and header
 * numbers rename in place, a page part from the library drops among its kind (`drag.slot`), the
 * host passes the page's words (`texts`), and `snapshot` returns the screen as static markup.
 */
export const PROTOCOL_VERSION = 4

export type DataState = 'data' | 'empty' | 'loading' | 'error'

export interface AppAsset {
  /** Generated-project path: `public/logo.png` (served at `/logo.png`) or `src/assets/**`. */
  path: string
  type: string
  data: ArrayBuffer
}

export interface AppPayload {
  /** Identifies the payload; loading the same ref again restarts the app without recompiling. */
  ref: string
  /** The generated frontend's text files, keyed by their path in the project (`src/main.tsx`,
   *  `src/index.css`, `index.html`, …). */
  files: Record<string, string>
  /** `menora-model.json` as written into the zip: an editor snapshot (`{entities, …}`) or
   *  `{format: "menora-fullstack-request/1", request: {entities, …}}`. Seeds the mock backend. */
  model: unknown
  assets?: AppAsset[]
}

/** The editing layer's inputs. Controls are the layout designer's `data-control` keys:
 *  `title`, `description`, `widget.<i>` (a deeper key such as `widget.2.field` marks its widget),
 *  `dateRange`, `filters`, `chart.groupBy`, `tabs`, `tabs.<i>.title`, `headerStats`, `steps`, … */
export interface DesignState {
  /** The page on screen's type: which parts it has. */
  pageType: string
  /** The selected part, or null for the page itself. */
  selected: string | null
  /** Problems by control: their parts get a red ring and the message as a tooltip. */
  problems: Record<string, string>
  /** Something dragged in from the host's library: a widget (its span for the placeholder), or a
   *  page part (`slot`: `tab`, `chart`, `child-tab`, `header-stat`, `step-field`); else null. */
  drag: { span: number; slot?: string } | null
  /** The page's words by control (`title`, `description`, `tabs.0.title`, …): the description is
   *  told from other text by them, and a rename starts from them. */
  texts?: Record<string, string>
}

export interface Rect { x: number; y: number; w: number; h: number }

export type HostMessage =
  | { type: 'init'; protocol: number }
  /** Compile and start an app. `hash` opens a route (`#/orders`); omitted, the app's own start. */
  | { type: 'load'; app: AppPayload; hash?: string; dataState?: DataState; dark?: boolean; css?: string }
  /** Open a route in the running app. */
  | { type: 'navigate'; hash: string }
  /** Extra CSS laid over the compiled stylesheet (live token edits: `:root{--color-brand:…}`). */
  | { type: 'css'; css: string }
  | { type: 'theme'; dark: boolean }
  /** Answer every read with sample rows, nothing, a request that never ends, or a 500 — then
   *  restart the app so each screen shows that state. */
  | { type: 'dataState'; state: DataState }
  /** Forget the sample data's edits and the app's stored settings, and restart. */
  | { type: 'reset' }
  /** Edit (a state) or use (null) the app. Kept across loads. */
  | { type: 'design'; design: DesignState | null }
  /** The screen on show as static markup, once its data has arrived (answered by `snapshot`). */
  | { type: 'snapshot'; id: string }

export interface CompileError { path: string; message: string }

export type RuntimeMessage =
  | { type: 'ready'; protocol: number; selfCheck: Record<string, string> }
  | { type: 'compiled'; ref: string; ok: boolean; errors: CompileError[]; ms: { modules: number; tailwind: number; total: number }; files: number; cssBytes: number }
  /** The app's route changed (a click inside it, or a `navigate`). */
  | { type: 'route'; hash: string }
  /** Something threw while the app ran (render, effect, event handler). */
  | { type: 'runtimeError'; message: string; path?: string }
  /** Design mode: a part was clicked (null: somewhere else on the page). */
  | { type: 'pick'; control: string | null }
  /** Design mode: one of the app's own page links was clicked. */
  | { type: 'pickPage'; hash: string }
  /** A title renamed in place: the page's (`title`, `description`) or a part's (`tabs.1.title`, …). */
  | { type: 'rename'; control: string; value: string }
  /** A widget dragged to another place: it ends up at index `to`. */
  | { type: 'reorder'; from: number; to: number }
  | { type: 'resize'; index: number; span: number }
  /** The library's widget or page part dropped: insert it at `at` (a wizard field: onto step `at`). */
  | { type: 'drop'; at: number }
  /** The screen as markup with its stylesheet, images inlined, no scripts (a host's spec sheet). */
  | { type: 'snapshot'; id: string; html: string; css: string; lang: string; dir: string }
  /** A widget toolbar button; `rect` (viewport px of the runtime) anchors a host menu. */
  | { type: 'tool'; action: 'duplicate' | 'kind'; index: number; rect: Rect }
  /** Design mode: a key pressed while the app had the focus, for the host's own shortcuts
   *  (undo, delete, …) — the host replays it on the frame element. */
  | { type: 'key'; key: string; code: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }
