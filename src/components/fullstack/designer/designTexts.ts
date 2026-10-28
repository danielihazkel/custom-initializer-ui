import type { PreviewScreen } from '../layoutPreviewModel'

/**
 * The page's words as the generated app shows them, by design-mode control: the runtime tells the
 * description from other lines by them, and an in-place rename starts from them.
 */
export function designTexts(screen: PreviewScreen | undefined): Record<string, string> {
  if (!screen) return {}
  const texts: Record<string, string> = { title: screen.title }
  if ('description' in screen && screen.description) texts.description = screen.description
  if (screen.type === 'tabs') screen.tabs.forEach((t, i) => { texts[`tabs.${i}.title`] = t.label })
  if (screen.type === 'wizard') screen.steps.slice(0, -1).forEach((t, i) => { texts[`steps.${i}.title`] = t })
  if (screen.type === 'record') screen.stats.forEach((t, i) => { texts[`headerStats.${i}.title`] = t.title })
  return texts
}
