import type { EntityTemplateSetSummary } from '../../types'

export type FullstackLocale = 'en' | 'he'

/**
 * What picking a frontend template set implies for the settings that only affect the generated
 * SPA. The Menora Digital set is the Hebrew customer-site brand, so choosing it turns on Hebrew
 * chrome strings and the RTL layout — mirroring the standalone Frontend tab, which flips RTL on
 * for the same design system. Applied only on an explicit pick (never on restore), and the user
 * can turn either back off afterwards.
 */
export function frontendSetDefaults(set: EntityTemplateSetSummary | undefined): { locale?: FullstackLocale; rtl?: boolean } {
  if (set?.designSystem === 'MENORA_DIGITAL') return { locale: 'he', rtl: true }
  return {}
}
