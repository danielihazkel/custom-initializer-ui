import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Last-resort boundary around the whole app. Without it a render-time throw
 * (e.g. a corrupt localStorage value) leaves a blank page with no way back.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack)
  }

  private resetLocalData = (): void => {
    try { localStorage.clear() } catch { /* ignore */ }
    try { sessionStorage.clear() } catch { /* ignore */ }
    window.location.replace(window.location.pathname)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div role="alert" className="bg-surface-container border border-error-container rounded-xl p-8 max-w-md text-center space-y-4">
          <h2 className="text-lg font-bold text-on-surface">Something went wrong</h2>
          <p className="text-sm text-secondary">
            The page hit an unexpected error. Reloading usually fixes it; if it keeps happening,
            reset the locally saved project data.
          </p>
          <code className="block text-xs text-error bg-surface-container-lowest rounded p-3 break-words text-left">
            {this.state.error.message}
          </code>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-outline-variant hover:bg-surface-container-high transition-colors"
            >
              Reload
            </button>
            <button
              onClick={this.resetLocalData}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-on-primary hover:opacity-90 transition-opacity"
            >
              Reset local data
            </button>
          </div>
        </div>
      </div>
    )
  }
}
