import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { EventsWizardDrawer, type DetectedChannel } from './EventsWizardDrawer'
import type { EventsWizardEntry } from '../types'

// The drawer's chrome and the CodeMirror editor are not what is under test.
vi.mock('./admin/shared/AdminFormDrawer', () => ({
  AdminFormDrawer: ({ children, onSave, isOpen }: { children: ReactNode; onSave: () => void; isOpen: boolean }) =>
    isOpen ? <div>{children}<button onClick={onSave}>Save</button></div> : null,
}))
vi.mock('./admin/file-contributions/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) =>
    <textarea aria-label="document" value={value} onChange={e => onChange(e.target.value)} />,
}))

const CHANNELS: DetectedChannel[] = [
  { name: 'orderCreated', address: 'orders.created', sends: true, receives: false, messages: ['OrderCreated'], problem: null },
  { name: 'orderEvents', address: 'orders.events', sends: false, receives: true, messages: ['Shipped', 'Cancelled'], problem: null },
  { name: 'inbox', address: 'users.{id}.inbox', sends: false, receives: true, messages: [], problem: 'its address has a parameter' },
]

const entry: EventsWizardEntry = {
  spec: 'asyncapi: 3.0.0',
  subPackage: 'events',
  payloadSubPackage: 'events.model',
  groupId: '',
  channels: [],
  generateTests: false,
}

function stubDetect(response: { ok: boolean; body: unknown }) {
  const fetchMock = vi.fn(async () => ({ ok: response.ok, json: async () => response.body }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function open(initial: EventsWizardEntry | null) {
  const onSave = vi.fn()
  render(<EventsWizardDrawer isOpen onClose={() => {}} depId="kafka" depName="Kafka" initial={initial} onSave={onSave} />)
  return onSave
}

const box = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EventsWizardDrawer', () => {
  it('lists the channels the document has, ticked as its application uses them', async () => {
    const fetchMock = stubDetect({ ok: true, body: CHANNELS })
    const onSave = open(entry)
    await screen.findByText('orders.created')
    expect(fetchMock).toHaveBeenCalledWith('/starter-wizard.detect-channels', expect.objectContaining({
      body: JSON.stringify({ spec: 'asyncapi: 3.0.0' }),
    }))
    // It sends orderCreated and receives orderEvents.
    expect(box(/Produce to orderCreated/).checked).toBe(true)
    expect(box(/Consume from orderCreated/).checked).toBe(false)
    expect(box(/Consume from orderEvents/).checked).toBe(true)
    // A channel no code can be written for says why and cannot be ticked.
    expect(box(/Consume from inbox/).disabled).toBe(true)
    expect(box(/Consume from inbox/).checked).toBe(false)
    expect(screen.getByText(/its address has a parameter/)).toBeTruthy()
    expect(screen.getByText('2 of 3')).toBeTruthy()

    // Nothing chosen by hand: no channel list is saved — the server follows the document.
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(entry)
  })

  it('saves the channels once one is chosen by hand', async () => {
    stubDetect({ ok: true, body: CHANNELS })
    const onSave = open(entry)
    await screen.findByText('orders.created')
    fireEvent.click(box(/Consume from orderCreated/))
    fireEvent.click(box(/Consume from orderEvents/))
    fireEvent.click(screen.getByLabelText(/Generate tests/))
    fireEvent.change(screen.getByLabelText('Consumer group'), { target: { value: ' billing ' } })
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith({
      ...entry,
      groupId: 'billing',
      generateTests: true,
      // Every channel code can be written for, so one left out is left out on purpose.
      channels: [
        { name: 'orderCreated', produce: true, consume: true },
        { name: 'orderEvents', produce: false, consume: false },
      ],
    })
  })

  it('flips every channel for the other party, and back', async () => {
    stubDetect({ ok: true, body: CHANNELS })
    const onSave = open(entry)
    await screen.findByText('orders.created')
    fireEvent.click(screen.getByText('the other party'))
    expect(box(/Produce to orderCreated/).checked).toBe(false)
    expect(box(/Consume from orderCreated/).checked).toBe(true)
    expect(box(/Produce to orderEvents/).checked).toBe(true)
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenLastCalledWith({
      ...entry,
      channels: [
        { name: 'orderCreated', produce: false, consume: true },
        { name: 'orderEvents', produce: true, consume: false },
      ],
    })
    fireEvent.click(screen.getByText('the application described'))
    expect(box(/Produce to orderCreated/).checked).toBe(true)
  })

  it('opens on the choices saved before, and says when none is left', async () => {
    stubDetect({ ok: true, body: CHANNELS })
    open({ ...entry, channels: [{ name: 'orderCreated', produce: false, consume: false }, { name: 'orderEvents', produce: false, consume: false }] })
    await screen.findByText('orders.created')
    expect(box(/Produce to orderCreated/).checked).toBe(false)
    expect(screen.getByText(/No channel is chosen/)).toBeTruthy()
  })

  it('marks the Avro channels and says how their messages travel', async () => {
    stubDetect({ ok: true, body: [
      { ...CHANNELS[0], format: 'avro' },
      { ...CHANNELS[1], format: 'json' },
    ] })
    const { container } = render(<EventsWizardDrawer isOpen onClose={() => {}} depId="kafka" depName="Kafka" initial={entry} onSave={vi.fn()} />)
    await screen.findByText('orders.created')
    expect(container.querySelectorAll('[data-channel-avro]')).toHaveLength(1)
    expect(container.querySelector('[data-channel="orderCreated"] [data-channel-avro]')).not.toBeNull()
    expect(container.querySelector('[data-events-avro-note]')?.textContent).toContain('no schema registry')
  })

  it('says nothing of Avro for a JSON-only document', async () => {
    stubDetect({ ok: true, body: CHANNELS })
    const { container } = render(<EventsWizardDrawer isOpen onClose={() => {}} depId="kafka" depName="Kafka" initial={entry} onSave={vi.fn()} />)
    await screen.findByText('orders.created')
    expect(container.querySelector('[data-channel-avro]')).toBeNull()
    expect(container.querySelector('[data-events-avro-note]')).toBeNull()
  })

  it('shows why a document is refused', async () => {
    stubDetect({ ok: false, body: { error: 'Invalid AsyncAPI document', messages: ['The AsyncAPI document declares no channels'] } })
    open(entry)
    expect(await screen.findByText('The AsyncAPI document declares no channels')).toBeTruthy()
    expect(screen.queryByText('Channels')).toBeNull()
  })

  it('removes the entry when the document is cleared', () => {
    stubDetect({ ok: true, body: [] })
    const onSave = open(entry)
    fireEvent.click(screen.getByText('Clear'))
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(null)
  })
})
