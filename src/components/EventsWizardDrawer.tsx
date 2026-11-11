import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminFormDrawer } from './admin/shared/AdminFormDrawer'
import { CodeEditor } from './admin/file-contributions/CodeEditor'
import type { EventsChannelChoice, EventsWizardEntry } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  depId: string
  depName: string
  initial: EventsWizardEntry | null
  onSave: (entry: EventsWizardEntry | null) => void
}

/** A channel of the document, as `POST /starter-wizard.detect-channels` describes it. */
export interface DetectedChannel {
  name: string
  address: string
  /** The application the document describes sends to it / receives from it. */
  sends: boolean
  receives: boolean
  messages: string[]
  /** Why no code can be written for it (a parameterized address), or null. */
  problem: string | null
}

type Choices = Record<string, { produce: boolean; consume: boolean }>

const INPUT = 'w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all'
const LABEL = 'block text-xs font-bold uppercase tracking-widest text-secondary mb-2'

/** What the document's own application does: a producer where it sends, a listener where it receives. */
function asDescribed(channels: DetectedChannel[]): Choices {
  return Object.fromEntries(channels.map(c => [c.name, { produce: c.sends && !c.problem, consume: c.receives && !c.problem }]))
}

/** The other party: it consumes what that application sends, and sends what it receives. */
function asOtherParty(channels: DetectedChannel[]): Choices {
  return Object.fromEntries(channels.map(c => [c.name, { produce: c.receives && !c.problem, consume: c.sends && !c.problem }]))
}

function toChoices(stored: EventsChannelChoice[]): Choices | null {
  if (stored.length === 0) return null
  return Object.fromEntries(stored.map(c => [c.name, { produce: c.produce, consume: c.consume }]))
}

export function EventsWizardDrawer({ isOpen, onClose, depId, depName, initial, onSave }: Props) {
  const [spec, setSpec] = useState<string>(initial?.spec ?? '')
  const [subPackage, setSubPackage] = useState<string>(initial?.subPackage ?? 'events')
  const [payloadSubPackage, setPayloadSubPackage] = useState<string>(initial?.payloadSubPackage ?? 'events.model')
  const [groupId, setGroupId] = useState<string>(initial?.groupId ?? '')
  const [generateTests, setGenerateTests] = useState<boolean>(initial?.generateTests ?? false)
  // null: nothing chosen by hand — the project is the application the document describes.
  const [choices, setChoices] = useState<Choices | null>(() => toChoices(initial?.channels ?? []))
  const [channels, setChannels] = useState<DetectedChannel[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Re-seed drawer state when it re-opens for a different dep
  useEffect(() => {
    if (isOpen) {
      setSpec(initial?.spec ?? '')
      setSubPackage(initial?.subPackage ?? 'events')
      setPayloadSubPackage(initial?.payloadSubPackage ?? 'events.model')
      setGroupId(initial?.groupId ?? '')
      setGenerateTests(initial?.generateTests ?? false)
      setChoices(toChoices(initial?.channels ?? []))
      setChannels([])
      setParseError(null)
    }
  }, [isOpen, depId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced channel detection. An in-flight request is aborted when the document changes
  // again, so a slow earlier answer can never overwrite a newer one.
  useEffect(() => {
    const trimmed = spec.trim()
    if (!trimmed) {
      setChannels([])
      setParseError(null)
      return
    }
    const controller = new AbortController()
    const handle = setTimeout(() => {
      fetch('/starter-wizard.detect-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: trimmed }),
        signal: controller.signal,
      })
        .then(async res => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({} as Record<string, unknown>))
            const msgs = (body as { messages?: unknown }).messages
            setParseError(Array.isArray(msgs) ? msgs.join('; ') : 'Invalid AsyncAPI document')
            setChannels([])
            return
          }
          const data = await res.json() as DetectedChannel[]
          setChannels(Array.isArray(data) ? data : [])
          setParseError(null)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setParseError('Could not reach backend to read the document')
          setChannels([])
        })
    }, 400)
    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [spec])

  // What each channel gets: the hand-made choice, else what the document says. A channel the
  // stored choices do not know (the document changed since) follows the document too.
  const described = useMemo(() => asDescribed(channels), [channels])
  const effective = (name: string) => choices?.[name] ?? described[name] ?? { produce: false, consume: false }
  const chosen = channels.filter(c => effective(c.name).produce || effective(c.name).consume).length

  function toggle(name: string, side: 'produce' | 'consume') {
    setChoices(prev => {
      const base = { ...described, ...(prev ?? {}) }
      const current = base[name] ?? { produce: false, consume: false }
      return { ...base, [name]: { ...current, [side]: !current[side] } }
    })
  }

  async function handleSave(): Promise<void> {
    const trimmed = spec.trim()
    if (!trimmed) {
      onSave(null)
    } else {
      // Nothing chosen by hand: no list — the server follows the document. Otherwise every
      // channel the document has, so one left out is left out on purpose.
      const list: EventsChannelChoice[] = choices === null
        ? []
        : (channels.length > 0
            ? channels.filter(c => !c.problem).map(c => ({ name: c.name, ...effective(c.name) }))
            : Object.entries(choices).map(([name, c]) => ({ name, ...c })))
      onSave({
        spec: trimmed,
        subPackage: subPackage.trim() || 'events',
        payloadSubPackage: payloadSubPackage.trim() || 'events.model',
        groupId: groupId.trim(),
        channels: list,
        generateTests,
      })
    }
    onClose()
  }

  function handleClear() {
    setSpec('')
    setChannels([])
    setChoices(null)
    setParseError(null)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result
      if (typeof text === 'string') setSpec(text)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <AdminFormDrawer
      title={`Events — ${depName}`}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saving={false}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-xs text-primary">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>cell_tower</span>
          <span>
            Paste an AsyncAPI 2.x or 3.x document (YAML or JSON). Each channel becomes a
            {' '}<span className="font-bold">producer</span>, a <span className="font-bold">listener</span> or both,
            and each payload a record. Messages travel as JSON.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL} htmlFor="events-sub-package">Sub-package</label>
            <input id="events-sub-package" type="text" value={subPackage} onChange={e => setSubPackage(e.target.value)}
              placeholder="events" className={INPUT} />
          </div>
          <div>
            <label className={LABEL} htmlFor="events-payload-package">Payload sub-package</label>
            <input id="events-payload-package" type="text" value={payloadSubPackage}
              onChange={e => setPayloadSubPackage(e.target.value)} placeholder="events.model" className={INPUT} />
          </div>
          <div className="col-span-2">
            <label className={LABEL} htmlFor="events-group-id">Consumer group</label>
            <input id="events-group-id" type="text" value={groupId} onChange={e => setGroupId(e.target.value)}
              placeholder="the application's own (spring.kafka.consumer.group-id)" className={INPUT} />
          </div>
        </div>

        <label className="flex items-start gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={generateTests} onChange={e => setGenerateTests(e.target.checked)}
            className="mt-0.5 accent-primary" />
          <span>
            <span className="font-semibold text-on-surface">Generate tests</span>
            <span className="block text-[10px] text-on-surface-variant leading-relaxed">
              A unit test per producer and listener: a payload out as JSON and back. No broker needed.
            </span>
          </span>
        </label>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-widest text-secondary">AsyncAPI document</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="text-[10px] text-secondary hover:text-on-surface transition-colors">
                Upload file…
              </button>
              {spec.length > 0 && (
                <button type="button" onClick={handleClear}
                  className="text-[10px] text-secondary hover:text-error transition-colors">
                  Clear
                </button>
              )}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".yaml,.yml,.json" className="hidden" onChange={handleFile} />
          <CodeEditor value={spec} onChange={setSpec} targetPath="asyncapi.yaml" />
          <p className="text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
            Producers and listeners go to <code className="text-primary">{subPackage || 'events'}</code>, payload
            types to <code className="text-primary">{payloadSubPackage || 'events.model'}</code>. Each topic is a
            property, <code className="text-primary">app.events.topics.&lt;channel&gt;</code>, set to the channel's
            address. The <code className="text-primary">{depId}</code> dependency's own configuration is left as it is.
          </p>
        </div>

        {parseError && (
          <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 leading-relaxed"
            data-events-error>
            {parseError}
          </div>
        )}

        {channels.length > 0 && (
          <div data-events-channels>
            <div className="flex items-center justify-between mb-2 gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-secondary">Channels</label>
              <span className="text-[10px] font-bold py-0.5 px-2 bg-primary/10 text-primary rounded-full">
                {chosen} of {channels.length}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2 text-[10px]">
              <span className="text-on-surface-variant">This project is</span>
              <button type="button" onClick={() => setChoices(null)} aria-pressed={choices === null}
                className={'rounded-full border px-2 py-0.5 font-bold transition-all ' + (choices === null
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-outline-variant text-on-surface-variant hover:border-primary/60')}>
                the application described
              </button>
              <button type="button" onClick={() => setChoices(asOtherParty(channels))}
                className="rounded-full border border-outline-variant px-2 py-0.5 font-bold text-on-surface-variant hover:border-primary/60 transition-all">
                the other party
              </button>
            </div>
            <div className="space-y-2 border border-outline-variant rounded-lg p-3 bg-surface-container-lowest">
              {channels.map(c => {
                const state = effective(c.name)
                return (
                  <div key={c.name} className="flex items-start justify-between gap-3 text-xs" data-channel={c.name}>
                    <div className="min-w-0">
                      <div className="font-mono font-semibold text-on-surface truncate">{c.address}</div>
                      <div className="text-[10px] text-on-surface-variant leading-relaxed">
                        {c.name !== c.address && <>{c.name} · </>}
                        {c.messages.length > 0 ? c.messages.join(', ') : 'no message declared'}
                        {' · '}
                        {c.sends && c.receives ? 'sent and received' : c.sends ? 'sent' : c.receives ? 'received' : 'no operation'}
                        {' by the application'}
                      </div>
                      {c.problem && (
                        <div className="text-[10px] text-yellow-600 dark:text-yellow-400 leading-relaxed">
                          No code can be written for it: {c.problem}.
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {(['produce', 'consume'] as const).map(side => (
                        <label key={side} className={'flex items-center gap-1 text-[10px] font-medium '
                          + (c.problem ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
                          <input type="checkbox" checked={state[side]} disabled={!!c.problem}
                            onChange={() => toggle(c.name, side)} className="accent-primary"
                            aria-label={`${side === 'produce' ? 'Produce to' : 'Consume from'} ${c.name}`} />
                          {side === 'produce' ? 'Produce' : 'Consume'}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            {chosen === 0 && (
              <p className="text-[10px] text-yellow-600 dark:text-yellow-400 mt-1.5 leading-relaxed" data-events-none>
                No channel is chosen: tick what this project produces to or consumes from.
              </p>
            )}
          </div>
        )}
      </div>
    </AdminFormDrawer>
  )
}
