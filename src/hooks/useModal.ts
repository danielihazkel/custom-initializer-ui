import { useEffect, useRef, type RefObject } from 'react'

/**
 * What a modal owes the keyboard, in one place: Escape closes it, Tab stays inside it, the page
 * behind does not scroll, and focus goes back to whatever opened it.
 *
 * The dialogs each used to wire Escape by hand and none trapped Tab, so tabbing from a drawer or
 * the file explorer walked into the page underneath. Modals stack (a confirm over a drawer): only
 * the top one answers Escape and Tab.
 */
interface ModalOptions {
  /** Called on Escape. Leave out (or pass undefined while busy) to ignore Escape. */
  onClose?: () => void
  /** False while the modal is not shown — for a component that stays mounted when closed. */
  active?: boolean
  /** Move focus inside on opening, unless something inside already has it (`autoFocus`). */
  initialFocus?: boolean
  lockScroll?: boolean
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ')

/** The elements Tab can reach inside `root`, in order. */
export function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => {
    if (el.closest('[hidden], [inert]')) return false
    // A collapsed block is still in the DOM, but the browser will not focus into it.
    // (jsdom has no checkVisibility: everything counts as visible there.)
    return typeof el.checkVisibility === 'function'
      ? el.checkVisibility({ visibilityProperty: true })
      : true
  })
}

/** Open modals, bottom first. */
const stack: { token: symbol; ref: RefObject<HTMLElement | null> }[] = []

/**
 * Whether the modal drawn in `root` is the one the keyboard belongs to: the top of the stack, with
 * no modal dialog on the page but the ones it lies over. For a modal with keys of its own — the
 * layout designer's shortcuts, a drawer's Ctrl+Enter — which must stay quiet under another one.
 * A dialog that is not on this stack (a tour's card) takes the keys from it too.
 */
export function ownsKeyboard(root: HTMLElement | null): boolean {
  if (!root || stack[stack.length - 1]?.ref.current !== root) return false
  const mine = stack.map(m => m.ref.current)
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).every(d => mine.includes(d))
}
let scrollLocks = 0
let overflowBefore = ''

function lockScroll(): () => void {
  if (scrollLocks++ === 0) {
    overflowBefore = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  return () => {
    if (--scrollLocks === 0) document.body.style.overflow = overflowBefore
  }
}

export function useModal(
  ref: RefObject<HTMLElement | null>,
  { onClose, active = true, initialFocus = true, lockScroll: shouldLock = true }: ModalOptions = {},
): void {
  // Read through a ref so a new inline `onClose` per render does not re-open the modal's effect
  // (which would steal focus back to the first control on every parent render).
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // What had focus when the modal opened, read while rendering: by the time an effect runs, an
  // `autoFocus` inside the modal has already taken focus, and the opener would be lost.
  const openerRef = useRef<HTMLElement | null>(null)
  const activeRef = useRef(false)
  if (active && !activeRef.current && typeof document !== 'undefined') {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }
  activeRef.current = active

  useEffect(() => {
    if (!active) return
    const token = Symbol('modal')
    stack.push({ token, ref })
    const unlock = shouldLock ? lockScroll() : undefined

    const root = ref.current
    if (initialFocus && root && !root.contains(document.activeElement)) {
      const first = focusablesIn(root)[0]
      ;(first ?? root).focus({ preventScroll: true })
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (stack[stack.length - 1]?.token !== token) return
      const el = ref.current
      if (!el) return
      if (e.key === 'Escape') {
        // An inner widget (a picker, an editor panel) that used Escape itself marks the event.
        if (e.defaultPrevented || !closeRef.current) return
        e.preventDefault()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const list = focusablesIn(el)
      if (list.length === 0) {
        e.preventDefault()
        el.focus({ preventScroll: true })
        return
      }
      const first = list[0]
      const last = list[list.length - 1]
      const current = document.activeElement
      const outside = !el.contains(current)
      if (e.shiftKey ? current === first || outside : current === last || outside) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const at = stack.findIndex(m => m.token === token)
      if (at >= 0) stack.splice(at, 1)
      unlock?.()
      // StrictMode runs this cleanup once right after mounting, with the modal still open and on
      // screen: that is not a close, and moving focus out then would break the modal it tests.
      const closed = !activeRef.current || !(root?.isConnected ?? false)
      if (!closed) return
      // Back to the opener — unless focus has already been put somewhere else on purpose.
      const opener = openerRef.current
      const now = document.activeElement
      const lost = !now || now === document.body || (root?.contains(now) ?? false)
      if (opener && lost && opener.isConnected) opener.focus({ preventScroll: true })
    }
    // `ref` is stable; the options above are read at open time on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
