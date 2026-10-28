import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { DesignKitSummary, EntityTemplateSetSummary } from '../../../types'
import { FrontendSettings, type FrontendAppearance } from './FrontendSettings'

const set = (setKey: string, name: string): EntityTemplateSetSummary => ({
  setKey, name, description: null, kind: 'FRONTEND_REACT', defaultDeps: [], designSystem: null,
  bootVersion: null, javaVersion: null, defaultPaletteId: null,
})
const kit = (key: string, name: string, baseSetKey: string, latestVersion: number): DesignKitSummary => ({
  key, name, description: `${name} look`, baseSetKey, builtIn: false, enabled: true, sortOrder: 0, defaultPaletteId: null,
  clonedFrom: null, latestVersion, hasDraft: false, paletteAware: true, defaults: null,
})

function appearance(extra: Partial<FrontendAppearance> = {}): FrontendAppearance {
  return {
    frontendSets: [set('react-tailwind-crud', 'Tailwind CRUD'), set('react-other', 'Other set')],
    frontendSet: 'react-tailwind-crud', setFrontendSet: vi.fn(),
    setsLoading: false, setsError: null, loadTemplateSets: () => {},
    designKits: [kit('tailwind-default', 'Menora default', 'react-tailwind-crud', 1), kit('acme', 'Acme', 'react-tailwind-crud', 3)],
    designKit: null, pickDesignKit: vi.fn(), clearDesignKit: vi.fn(),
    palettes: [], feError: null, reloadFe: () => {},
    effectivePalette: '', setDefaultPalette: '', colorPalette: '', setColorPalette: () => {},
    locale: 'en', dashboardTitle: '', dashboardOverview: '', artifactId: 'demo', updateMeta: () => {},
    rtl: false, toggleRtl: () => {},
    ...extra,
  }
}

afterEach(cleanup)

describe('FrontendSettings — design kits', () => {
  it('offers the kits, and the sets no kit restyles', () => {
    const a = appearance()
    render(<FrontendSettings appearance={a} hasPages={false} />)
    expect(screen.getByRole('radiogroup', { name: 'Design kit' })).toBeTruthy()
    expect(document.querySelector('[data-design-kit="acme"]')).toBeTruthy()
    // react-tailwind-crud is covered by a kit; react-other is not, so it is still offered bare.
    expect(document.querySelector('[data-frontend-set="react-tailwind-crud"]')).toBeNull()
    fireEvent.click(document.querySelector('[data-frontend-set="react-other"]')!)
    expect(a.setFrontendSet).toHaveBeenCalledWith('react-other')
    fireEvent.click(document.querySelector('[data-design-kit="acme"]')!)
    expect(a.pickDesignKit).toHaveBeenCalledWith(a.designKits[1])
  })

  it('offers the newer version of a pinned kit', () => {
    const a = appearance({ designKit: { key: 'acme', version: 1 } })
    a.currentKit = a.designKits[1]
    render(<FrontendSettings appearance={a} hasPages={false} />)
    expect(document.querySelector('[data-design-kit="acme"]')!.getAttribute('aria-checked')).toBe('true')
    expect(document.querySelector('[data-kit-upgrade]')!.textContent).toContain('Acme v3 is available — this model uses v1.')
    fireEvent.click(screen.getByRole('button', { name: 'Use v3' }))
    expect(a.pickDesignKit).toHaveBeenCalledWith(a.designKits[1], 3)
  })

  it('warns when the pinned kit is gone', () => {
    const a = appearance({ designKit: { key: 'gone', version: 2 } })
    render(<FrontendSettings appearance={a} hasPages={false} />)
    expect(document.querySelector('[data-kit-missing]')!.textContent).toContain('gone')
    fireEvent.click(screen.getByRole('button', { name: "Use the set's look" }))
    expect(a.clearDesignKit).toHaveBeenCalled()
  })
})
