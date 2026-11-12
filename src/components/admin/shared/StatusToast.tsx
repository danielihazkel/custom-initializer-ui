import type { Toast } from '../../../types'
import { useToastProp } from '../../../toast'
import { Toaster } from '../../Toaster'

interface StatusToastProps {
  toast: Toast | null
  onClear: () => void
}

/**
 * The admin tabs' and the Fullstack tab's toast, shown through the app's one toast stack
 * (`src/toast.ts`, drawn by `Toaster`) — the same stack `AppToast` feeds, so two messages at once
 * queue up instead of drawing over each other. A toast with an `action` ("Undo") stays up longer.
 */
export function StatusToast({ toast, onClear }: StatusToastProps) {
  useToastProp(toast, onClear)
  return <Toaster />
}
