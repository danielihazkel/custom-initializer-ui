import { t } from '../i18n'

/**
 * What the team shares on the server — team models, team presets, team templates — is changed or
 * deleted only by whoever saved it or by a signed-in admin (`config/TeamDataAccess` on the server).
 * These are the two things the screens need for that.
 */

/**
 * The headers of a call for team data: the admin's token when one is signed in on this browser, so
 * the server knows an admin is asking (its `canEdit` answers follow, and an admin's change goes
 * through). Read straight from where the Config tab keeps it — its code is not loaded for this.
 */
export function teamHeaders(json = false): Record<string, string> {
  let token: string | null = null
  try {
    token = sessionStorage.getItem('adminToken')
  } catch {
    // Storage refused (a locked-down browser): nobody is signed in, as far as this call goes.
  }
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/**
 * Why a row is not the caller's to change — the tooltip of its disabled Delete or Overwrite;
 * `undefined` when it is theirs. A server from before the rule sends no `canEdit`: every row was
 * everyone's then.
 */
export function notYours(row: { canEdit?: boolean; createdBy?: string | null }): string | undefined {
  if (row.canEdit !== false) return undefined
  return row.createdBy
    ? t('Saved by {user} — only they or a signed-in admin can change or delete it', { user: row.createdBy })
    : t('Only whoever saved it or a signed-in admin can change or delete it')
}
