import type { FullstackEntityDef, FullstackNav, FullstackPageDef, FullstackStarterRequest } from '../../../types'
import type { PageLayoutValidation } from '../pageLayout'
import type { PagesPreviewSettings } from './usePagesModel'

/**
 * What a host hands the pages card and the layout designer: the layout and its entities, how to
 * change it, and what the host has around it (undo, the navigation, a request builder). The
 * Fullstack tab gives all of it; the Admin examples form what an example has.
 */
export interface PagesHostProps {
  pages: FullstackPageDef[]
  entities: FullstackEntityDef[]
  /** Opens the guide on a topic — the help buttons. Absent (the admin form): no button. */
  onOpenGuide?: (topicId: string) => void
  /** The generated shell's navigation for the layout; the preview follows it. */
  nav?: FullstackNav
  /** Present, the Sitemap view offers the shell's navigation settings. */
  onNavChange?: (nav: FullstackNav | undefined) => void
  /** From validatePages — inline messages per control plus the problem list. */
  validation: PageLayoutValidation
  onChange: (next: FullstackPageDef[]) => void
  /** Records a labelled undo entry before a change that would be annoying to retype. */
  pushUndo: (label: string) => void
  /** Drops the layout, back to the classic shell. */
  onClear: () => void
  previewSettings?: PagesPreviewSettings
  /** Bumped by the caller to open the first page with a problem and focus the control. */
  revealRequest?: number
  /** Bumped by the caller (the command palette) to open the designer on its page library. */
  addRequest?: number
  /** Bumped by the caller (the command palette) to open the designer on the canvas. */
  previewRequest?: number
  /** Bumped by the caller (the command palette's "Find page…") to focus the page search. */
  findRequest?: number
  /** Keys of the dismissed layout warnings, and how to change them. Omitted (the admin example
   *  form): warnings cannot be dismissed. */
  dismissedWarnings?: string[]
  onDismissedWarningsChange?: (keys: string[]) => void
  /** Builds the generate request for the model as it stands. Present, the designer's inspector
   *  has a Code tab with the selected page's generated screen; absent (the admin form): none. */
  codeRequest?: () => FullstackStarterRequest
  /** The editor's undo/redo, offered in the header too (the entities toolbar is far below). */
  history?: {
    undoLabel: string | null
    redoLabel: string | null
    onUndo: () => void
    onRedo: () => void
    /** The edits undo walks back through, oldest first, and redo forward through, furthest first
     *  (the history's own order). With `onJump`, the designer lists them to jump several at once. */
    undoEntries?: string[]
    redoEntries?: string[]
    /** Undoes (negative) or redoes (positive) that many edits in one step. */
    onJump?: (steps: number) => void
  }
  /** A 400 from Generate that names a page of this layout — listed with the problems and revealed. */
  serverIssue?: { page: number; message: string } | null
  /** Whether an LDAP auth dependency (ldap-auth-rest or ldap-auth) is selected, so pages can be
   *  restricted to roles. `false` disables the role boxes and offers to add the dependency;
   *  undefined (the admin form, which has no dependency list) leaves them enabled. */
  ldapAuth?: boolean
  /** Adds a backend dependency to the selection — the "Add ldap-auth-rest" shortcut under Roles. */
  onAddDep?: (dep: string) => void
}
