import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { FullstackPresets } from './FullstackPresets'
import { DEFAULT_PROJECT_META, type FullstackSnapshot } from './snapshot'
import type { TeamModelSummary } from '../../types'

const snapshot: FullstackSnapshot = {
  meta: { ...DEFAULT_PROJECT_META },
  entities: [], selectedDeps: [], scaffoldOpts: [], backendSet: 'spring-jpa-crud', frontendSet: 'react-tailwind-crud',
}
const model: TeamModelSummary = {
  id: 3, name: 'Claims domain', description: 'Claims + adjusters', entityCount: 4,
  createdBy: 'noa', createdAt: '2026-09-01T10:00:00Z', updatedAt: new Date().toISOString(),
}

function renderStrip(over: Partial<Parameters<typeof FullstackPresets>[0]> = {}) {
  const props = {
    presets: [], recents: [], currentSnapshot: snapshot,
    onLoad: vi.fn(), onLoadExample: vi.fn(), onSave: vi.fn(), onDeletePreset: vi.fn(), onDeleteRecent: vi.fn(),
    onExportJson: vi.fn(), onImportJson: vi.fn(), onCopyCurl: vi.fn(),
    teamModels: [model], teamLoading: false, teamError: null,
    onRefreshTeam: vi.fn(), onLoadTeam: vi.fn(), onSaveTeam: vi.fn(), onDeleteTeam: vi.fn(),
    ...over,
  }
  render(<FullstackPresets {...props} />)
  return props
}

describe('FullstackPresets — Team tab', () => {
  it('lists the team models with their description and count, loads on click, delegates delete', () => {
    const props = renderStrip()
    fireEvent.click(screen.getByRole('button', { name: /^Team/ }))
    expect(screen.getByText('Claims domain')).toBeTruthy()
    expect(screen.getByText('Claims + adjusters')).toBeTruthy()
    expect(screen.getByText('4 entities')).toBeTruthy()
    fireEvent.click(screen.getByText('Claims domain'))
    expect(props.onLoadTeam).toHaveBeenCalledWith(model)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Claims domain for everyone' }))
    // The parent confirms first — the strip only reports the intent.
    expect(props.onDeleteTeam).toHaveBeenCalledWith(model)
  })

  it('saves to the team with a description when that destination is picked', () => {
    const props = renderStrip()
    fireEvent.click(screen.getByText('Save this model…'))
    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'Shared billing' } })
    // Button names carry the icon glyph text ("groups Team"), hence the loose match.
    fireEvent.click(within(screen.getByRole('group', { name: 'Save to' })).getByRole('button', { name: /Team/ }))
    fireEvent.change(screen.getByLabelText('Team model description'), { target: { value: 'For the billing squad' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(props.onSaveTeam).toHaveBeenCalledWith('Shared billing', 'For the billing squad', snapshot)
    expect(props.onSave).not.toHaveBeenCalled()
  })

  it('shows the failure and a retry when the listing could not be fetched', () => {
    const props = renderStrip({ teamModels: [], teamError: 'HTTP 503' })
    fireEvent.click(screen.getByRole('button', { name: /^Team/ }))
    expect(screen.getByText(/Couldn't load the team models/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }))
    expect(props.onRefreshTeam).toHaveBeenCalled()
  })
})
