import type { EntityTemplateSetSummary } from '../../types'
import type { FeColorPalette } from '../../hooks/useFrontendMetadata'
import type { ProjectMeta } from './snapshot'
import { t, tn } from '../../i18n'

/**
 * The one-line description of a collapsed Setup panel.
 *
 * The panel holds ten-odd controls that are set once and then left alone, so it closes by
 * default — but "closed" must not mean "invisible": every chip here names something the user
 * chose, and clicking it reopens the panel at that section. Anything a chip cannot express is a
 * sign the control does not belong in the collapsed state.
 */
export interface SetupChip {
  /** Stable key, also the analytics-free test hook (`data-setup-chip`). */
  key: string
  /** Section id to scroll to when the chip is clicked. */
  target: 'fs-meta' | 'fs-backend' | 'fs-frontend' | 'fs-options' | 'fs-deps'
  icon: string
  label: string
  /** Tooltip spelling out what the short label stands for. */
  title: string
  /** A palette's primary colour, rendered as a swatch ahead of the label. */
  swatch?: string
}

export interface DescribeSetupInput {
  meta: ProjectMeta
  backendSet: string
  frontendSet: string
  currentBackendSet?: EntityTemplateSetSummary
  currentFrontendSet?: EntityTemplateSetSummary
  palettes: FeColorPalette[]
  /** The palette in force — the explicit choice, else the set's default. */
  effectivePalette: string
  /** True when the user picked the palette rather than inheriting the set's. */
  paletteIsExplicit: boolean
  selectedDeps: string[]
  scaffoldOpts: string[]
}

const LOCALE_NAMES: Record<string, string> = { en: 'English', he: 'עברית' }

export function describeSetup({
  meta, backendSet, frontendSet, currentBackendSet, currentFrontendSet,
  palettes, effectivePalette, paletteIsExplicit, selectedDeps, scaffoldOpts,
}: DescribeSetupInput): SetupChip[] {
  const chips: SetupChip[] = []

  const coords = `${meta.groupId || '—'}:${meta.artifactId || '—'}`
  chips.push({
    key: 'coords', target: 'fs-meta', icon: 'package_2', label: coords,
    title: t('Maven coordinates — groupId {groupId}, artifactId {artifactId}', {
      groupId: meta.groupId || t('(unset)'), artifactId: meta.artifactId || t('(unset)'),
    }),
  })

  chips.push({
    key: 'versions', target: 'fs-meta', icon: 'coffee',
    label: `Java ${meta.javaVersion} · Boot ${meta.bootVersion}`,
    title: t('Java {java}, Spring Boot {boot}, {packaging} packaging', { java: meta.javaVersion, boot: meta.bootVersion, packaging: meta.packaging }),
  })

  chips.push({
    key: 'backendSet', target: 'fs-backend', icon: 'dns',
    label: currentBackendSet?.name ?? backendSet,
    title: t('Backend template set: {set}', { set: backendSet }),
  })

  const palette = palettes.find(p => p.id === effectivePalette)
  chips.push({
    key: 'frontendSet', target: 'fs-frontend', icon: 'web',
    label: currentFrontendSet?.name ?? frontendSet,
    title: !palette ? t('Frontend template set: {set}', { set: frontendSet })
      : paletteIsExplicit ? t('Frontend template set: {set} · palette {palette}', { set: frontendSet, palette: palette.name })
        : t('Frontend template set: {set} · palette {palette} (set default)', { set: frontendSet, palette: palette.name }),
    swatch: palette?.primary,
  })

  // Language only earns a chip when it is not the default — an "English" chip on every project
  // is noise, but a Hebrew project must say so from the collapsed state.
  if (meta.locale && meta.locale !== 'en') {
    chips.push({
      key: 'locale', target: 'fs-frontend', icon: 'translate',
      label: LOCALE_NAMES[meta.locale] ?? meta.locale,
      title: t("Generated app's chrome language: {language}", { language: LOCALE_NAMES[meta.locale] ?? meta.locale }),
    })
  }

  chips.push({
    key: 'deps', target: 'fs-deps', icon: 'inventory_2',
    label: tn(selectedDeps.length, '{n} dependency', '{n} dependencies'),
    title: selectedDeps.length ? selectedDeps.join(', ') : t('No dependencies selected'),
  })

  if (scaffoldOpts.length > 0) {
    chips.push({
      key: 'opts', target: 'fs-options', icon: 'toggle_on',
      label: tn(scaffoldOpts.length, '{n} option', '{n} options'),
      title: scaffoldOpts.join(', '),
    })
  }

  return chips
}
