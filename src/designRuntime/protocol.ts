/**
 * postMessage protocol between a host (the generator's layout designer, the Design Studio) and the
 * sandboxed preview runtime. The host keeps a verbatim copy (ui/src/designRuntime/protocol.ts);
 * PROTOCOL_VERSION pins the pair, and `ready` tells the host which version it is talking to.
 *
 * v2: the runtime runs the **whole generated frontend** — every `src/**` file the generator wrote
 * for the model (POST /starter-fullstack.preview), entry `src/main.tsx` — against an in-memory
 * backend built from the model, so the preview is the app that ships, not a re-implementation.
 */
export const PROTOCOL_VERSION = 2

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

export interface CompileError { path: string; message: string }

export type RuntimeMessage =
  | { type: 'ready'; protocol: number; selfCheck: Record<string, string> }
  | { type: 'compiled'; ref: string; ok: boolean; errors: CompileError[]; ms: { modules: number; tailwind: number; total: number }; files: number; cssBytes: number }
  /** The app's route changed (a click inside it, or a `navigate`). */
  | { type: 'route'; hash: string }
  /** Something threw while the app ran (render, effect, event handler). */
  | { type: 'runtimeError'; message: string; path?: string }
