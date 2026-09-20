import type { EntityTemplateSetSummary } from '../../types'
import type { FeColorPalette } from '../../hooks/useFrontendMetadata'
import type { ProjectMeta } from './snapshot'

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
    title: `Maven coordinates — groupId ${meta.groupId || '(unset)'}, artifactId ${meta.artifactId || '(unset)'}`,
  })

  chips.push({
    key: 'versions', target: 'fs-meta', icon: 'coffee',
    label: `Java ${meta.javaVersion} · Boot ${meta.bootVersion}`,
    title: `Java ${meta.javaVersion}, Spring Boot ${meta.bootVersion}, ${meta.packaging} packaging`,
  })

  chips.push({
    key: 'backendSet', target: 'fs-backend', icon: 'dns',
    label: currentBackendSet?.name ?? backendSet,
    title: `Backend template set: ${backendSet}`,
  })

  const palette = palettes.find(p => p.id === effectivePalette)
  chips.push({
    key: 'frontendSet', target: 'fs-frontend', icon: 'web',
    label: currentFrontendSet?.name ?? frontendSet,
    title: `Frontend template set: ${frontendSet}`
      + (palette ? ` · palette ${palette.name}${paletteIsExplicit ? '' : ' (set default)'}` : ''),
    swatch: palette?.primary,
  })

  // Language only earns a chip when it is not the default — an "English" chip on every project
  // is noise, but a Hebrew project must say so from the collapsed state.
  if (meta.locale && meta.locale !== 'en') {
    chips.push({
      key: 'locale', target: 'fs-frontend', icon: 'translate',
      label: LOCALE_NAMES[meta.locale] ?? meta.locale,
      title: `Generated app's chrome language: ${LOCALE_NAMES[meta.locale] ?? meta.locale}`,
    })
  }

  chips.push({
    key: 'deps', target: 'fs-deps', icon: 'inventory_2',
    label: `${selectedDeps.length} ${selectedDeps.length === 1 ? 'dependency' : 'dependencies'}`,
    title: selectedDeps.length ? selectedDeps.join(', ') : 'No dependencies selected',
  })

  if (scaffoldOpts.length > 0) {
    chips.push({
      key: 'opts', target: 'fs-options', icon: 'toggle_on',
      label: `${scaffoldOpts.length} ${scaffoldOpts.length === 1 ? 'option' : 'options'}`,
      title: scaffoldOpts.join(', '),
    })
  }

  return chips
}
