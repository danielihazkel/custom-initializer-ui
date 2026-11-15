import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ModuleSelector } from './ModuleSelector'
import type { ModuleTemplate } from '../types'

const modules = [
  { moduleId: 'api', label: 'API', suffix: '-api', description: '', packaging: 'jar', hasMainClass: true, dependencyIds: ['web'] },
  { moduleId: 'core', label: 'Core', suffix: '-core', description: '', packaging: 'jar', hasMainClass: false, dependencyIds: [] },
] as unknown as ModuleTemplate[]

describe('ModuleSelector', () => {
  it('says the ticked modules are not generated while a dependency has a wizard set up', () => {
    // Generate goes to the wizard endpoint then, which writes one module. It used to drop the
    // modules without saying anything.
    const { container, rerender } = render(
      <ModuleSelector modules={modules} selectedModules={['api', 'core']} onChange={() => {}} wizardDeps={['postgresql']} />,
    )
    const notice = container.querySelector('[data-modules-unused]')
    expect(notice).not.toBeNull()
    expect(notice?.getAttribute('role')).toBe('status')
    expect(notice?.textContent).toContain('These modules will not be generated.')
    expect(notice?.textContent).toContain('postgresql has a wizard set up')

    rerender(<ModuleSelector modules={modules} selectedModules={['api']} onChange={() => {}} wizardDeps={['web', 'kafka']} />)
    expect(container.querySelector('[data-modules-unused]')?.textContent).toContain('web, kafka have a wizard set up')
  })

  it('says nothing when no module is ticked or no wizard is set up', () => {
    const { container, rerender } = render(
      <ModuleSelector modules={modules} selectedModules={[]} onChange={() => {}} wizardDeps={['postgresql']} />,
    )
    expect(container.querySelector('[data-modules-unused]')).toBeNull()

    rerender(<ModuleSelector modules={modules} selectedModules={['api']} onChange={() => {}} wizardDeps={[]} />)
    expect(container.querySelector('[data-modules-unused]')).toBeNull()

    rerender(<ModuleSelector modules={modules} selectedModules={['api']} onChange={() => {}} />)
    expect(container.querySelector('[data-modules-unused]')).toBeNull()
    // The modules themselves are still listed.
    expect(screen.getByText('API')).toBeTruthy()
  })
})
