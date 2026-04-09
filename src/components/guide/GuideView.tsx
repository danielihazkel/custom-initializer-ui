import { useState, useRef, useEffect } from 'react'
import { Search, Command, ChevronRight, Menu, X } from 'lucide-react'
import { GUIDE_SECTIONS } from './guide-constants'
import { GUIDE_SECTIONS_HE } from './guide-constants-he'
import { UI_STRINGS, type Lang } from './guide-i18n'
import type { GuideSection, GuideTopic } from './guide-types'
import { GuideFieldTable } from './GuideFieldTable'
import { GuideCallout } from './GuideCallout'
import { GuideCodeBlock } from './GuideCodeBlock'
import { GuideWorkflowStepper } from './GuideWorkflowStepper'

interface GuideViewProps {
  onClose?: () => void
}

const parseMarkdown = (text: string) => {
  let parsed = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-on-surface font-semibold">$1</strong>')
  parsed = parsed.replace(/`([^`]+)`/g, '<code class="bg-surface-container-high border border-outline-variant px-1.5 py-0.5 rounded text-primary text-sm font-mono">$1</code>')
  parsed = parsed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-primary hover:underline">$1</a>')
  return parsed
}

const renderContent = (content: string) => {
  return content.split('\n\n').map((block, index) => {
    const trimmed = block.trim()
    if (!trimmed) return null

    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={index} className="text-xl font-bold text-on-surface mt-8 mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-primary rounded-full inline-block" />
          {trimmed.replace('### ', '')}
        </h3>
      )
    }

    if (trimmed.startsWith('- ')) {
      const items = trimmed.split('\n').map(line => line.replace(/^- /, '').trim())
      return (
        <ul key={index} className="list-disc pl-6 mb-6 space-y-2 text-on-surface-variant">
          {items.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: parseMarkdown(item) }} />
          ))}
        </ul>
      )
    }

    if (/^\d+\. /.test(trimmed)) {
      const items = trimmed.split('\n').map(line => line.replace(/^\d+\. /, '').trim())
      return (
        <ol key={index} className="list-decimal pl-6 mb-6 space-y-2 text-on-surface-variant">
          {items.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: parseMarkdown(item) }} />
          ))}
        </ol>
      )
    }

    return (
      <p
        key={index}
        className="text-on-surface-variant leading-7 mb-4 text-base"
        dangerouslySetInnerHTML={{ __html: parseMarkdown(trimmed) }}
      />
    )
  })
}

export function GuideView(_props: GuideViewProps) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('guide-lang') as Lang) ?? 'en')
  const [activeSection, setActiveSection] = useState<GuideSection>(GUIDE_SECTIONS[0])
  const [activeTopic, setActiveTopic] = useState<GuideTopic>(GUIDE_SECTIONS[0].topics[0])
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const sections = lang === 'he' ? GUIDE_SECTIONS_HE : GUIDE_SECTIONS
  const ui = UI_STRINGS[lang]
  const isRtl = lang === 'he'

  // Keep active topic in sync when language changes
  useEffect(() => {
    const matchedSection = sections.find(s => s.id === activeSection.id) ?? sections[0]
    const matchedTopic = matchedSection.topics.find(t => t.id === activeTopic.id) ?? matchedSection.topics[0]
    setActiveSection(matchedSection)
    setActiveTopic(matchedTopic)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [])

  const filteredSections = searchQuery.trim() === ''
    ? sections
    : sections.map(section => ({
        ...section,
        topics: section.topics.filter(topic =>
          topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          topic.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          section.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(section => section.topics.length > 0)

  const handleTopicSelect = (topic: GuideTopic, section: GuideSection) => {
    setActiveSection(section)
    setActiveTopic(topic)
    if (window.innerWidth < 768) setIsSidebarOpen(false)
  }

  const handleLangToggle = () => {
    setLang(l => {
      const next: Lang = l === 'en' ? 'he' : 'en'
      localStorage.setItem('guide-lang', next)
      return next
    })
    setSearchQuery('')
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      dir={isRtl ? 'rtl' : 'ltr'}
      className="flex bg-background text-on-background overflow-hidden font-sans outline-none"
      style={{ height: 'calc(100vh - 4rem)' }}
    >
      {/* Mobile sidebar toggle */}
      {!isSidebarOpen && (
        <button
          className="fixed top-20 left-4 z-50 p-2 glass-panel rounded-md border border-outline-variant md:hidden shadow-lg"
          onClick={() => setIsSidebarOpen(true)}
        >
          <Menu size={20} />
        </button>
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 ${isRtl ? 'right-0' : 'left-0'} z-40 w-80 bg-surface-container border-${isRtl ? 'l' : 'r'} border-outline-variant transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full'}`}
        style={{ top: '4rem', height: 'calc(100vh - 4rem)' }}
      >
        {/* Header */}
        <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-tertiary to-tertiary-container rounded-lg flex items-center justify-center shadow-lg shadow-tertiary/30">
              <span className="material-symbols-outlined text-on-tertiary" style={{ fontSize: '18px' }}>menu_book</span>
            </div>
            <h1 className="font-bold text-lg tracking-tight text-on-surface">{ui.sidebarTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <button
              onClick={handleLangToggle}
              className="px-2.5 py-1 rounded-md text-xs font-bold border border-outline-variant text-secondary hover:text-on-surface hover:border-primary/40 transition-colors"
              title={isRtl ? 'Switch to English' : 'עבור לעברית'}
            >
              {ui.langToggleLabel}
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-secondary">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-outline-variant/50">
          <div className="relative group">
            <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors`} size={14} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={ui.searchPlaceholder}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full bg-background border border-outline-variant rounded-lg py-2 ${isRtl ? 'pr-9 pl-10' : 'pl-9 pr-10'} text-xs text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all`}
            />
            <div className={`absolute ${isRtl ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-variant border border-outline text-[10px] text-secondary font-medium pointer-events-none`}>
              <Command size={8} />
              <span>K</span>
            </div>
          </div>
        </div>

        {/* Nav list */}
        <div className="p-4 overflow-y-auto" style={{ height: 'calc(100% - 130px)' }}>
          <div className="space-y-6">
            {filteredSections.length > 0 ? filteredSections.map(section => (
              <div key={section.id}>
                <h3 className={`text-[11px] font-bold text-secondary uppercase tracking-widest mb-2 px-2 flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{section.icon}</span>
                  {section.title}
                </h3>
                <div className="space-y-0.5">
                  {section.topics.map(topic => (
                    <button
                      key={topic.id}
                      onClick={() => handleTopicSelect(topic, section)}
                      className={`w-full text-${isRtl ? 'right' : 'left'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-between group ${
                        activeTopic.id === topic.id
                          ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'
                      }`}
                    >
                      {isRtl ? (
                        <>
                          {activeTopic.id === topic.id && <ChevronRight size={14} className="opacity-100 shrink-0 rotate-180" />}
                          <span className="truncate">{topic.title}</span>
                        </>
                      ) : (
                        <>
                          <span className="truncate">{topic.title}</span>
                          {activeTopic.id === topic.id && <ChevronRight size={14} className="opacity-100 shrink-0" />}
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )) : (
              <div className="py-10 text-center">
                <div className="w-12 h-12 bg-surface-variant rounded-full flex items-center justify-center mx-auto mb-3 border border-outline-variant">
                  <Search size={20} className="text-secondary" />
                </div>
                <p className="text-sm text-secondary">{ui.noTopicsFound}</p>
                <button onClick={() => setSearchQuery('')} className="text-xs text-primary hover:underline mt-2">
                  {ui.clearSearch}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        {/* Top bar */}
        <header className="h-16 glass-header flex items-center px-6 z-10 shrink-0 sticky top-0 gap-3 ml-10 md:ml-0">
          <span className="text-secondary text-sm flex items-center gap-1.5">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{activeSection.icon}</span>
            {activeSection.title}
          </span>
          <ChevronRight size={14} className={`text-secondary ${isRtl ? 'rotate-180' : ''}`} />
          <span className="text-primary font-medium text-sm truncate">{activeTopic.title}</span>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 tutorial-scroll">
          <div className="max-w-3xl mx-auto pb-16 space-y-2">
            {/* Hero */}
            <div className="space-y-3 border-b border-outline-variant pb-8 mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{activeSection.icon}</span>
                {activeSection.title}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-on-surface tracking-tight leading-tight">{activeTopic.title}</h1>
              <p className="text-lg text-on-surface-variant leading-relaxed">{activeTopic.description}</p>
            </div>

            {/* Content */}
            <div className="space-y-2">
              {renderContent(activeTopic.content)}
            </div>

            {/* Callouts */}
            {activeTopic.callouts?.map((callout, i) => (
              <GuideCallout key={i} callout={callout} labels={ui} />
            ))}

            {/* Field table */}
            {activeTopic.fields && activeTopic.fields.length > 0 && (
              <GuideFieldTable fields={activeTopic.fields} labels={ui} />
            )}

            {/* Code examples */}
            {activeTopic.codeExamples?.map((ex, i) => (
              <GuideCodeBlock key={i} example={ex} />
            ))}

            {/* Workflow stepper */}
            {activeTopic.workflowSteps && activeTopic.workflowSteps.length > 0 && (
              <GuideWorkflowStepper steps={activeTopic.workflowSteps} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
