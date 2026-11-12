import type { Toast } from '../types'
import { useToastProp } from '../toast'
import { Toaster } from './Toaster'

interface Props {
  toast: Toast | null
  onClear: () => void
}

/**
 * The toast a view keeps in its own state, shown through the app's one toast stack
 * (`src/toast.ts`, drawn by `Toaster`). `onClear` is called once the toast has left by itself.
 */
export function AppToast({ toast, onClear }: Props) {
  useToastProp(toast, onClear)
  return <Toaster />
}
