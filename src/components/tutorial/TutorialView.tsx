import { useState, useEffect, useRef } from 'react';
import { BookOpen, Code2, Terminal, ChevronRight, Menu, X, Layers, Search, Command } from 'lucide-react';
import { CURRICULUM } from './tutorial-constants';
import { CURRICULUM_HE } from './tutorial-constants-he';
import { UI_STRINGS, type Lang } from './tutorial-i18n';
import { Module, Lesson } from './tutorial-types';
import ArchitectureVisualizer from './visualizers/ArchitectureVisualizer';
import ProjectScaffolder from './visualizers/ProjectScaffolder';
import MockApiPlayground from './visualizers/MockApiPlayground';
import BeanLifecycleVisualizer from './visualizers/BeanLifecycleVisualizer';
import SecurityFilterVisualizer from './visualizers/SecurityFilterVisualizer';
import JpaEntityMapper from './visualizers/JpaEntityMapper';
import MicroservicesTopology from './visualizers/MicroservicesTopology';

interface TutorialViewProps {
  onClose?: () => void;
}

export function TutorialView(_props: TutorialViewProps) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('tutorial-lang') as Lang) ?? 'en');
  const [activeModule, setActiveModule] = useState<Module>(CURRICULUM[0]);
  const [activeLesson, setActiveLesson] = useState<Lesson>(CURRICULUM[0].lessons[0]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showArchitecture, setShowArchitecture] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const curriculum = lang === 'he' ? CURRICULUM_HE : CURRICULUM;
  const ui = UI_STRINGS[lang];
  const isRtl = lang === 'he';

  // Keep active module/lesson in sync by id when language changes
  useEffect(() => {
    const matchedModule = curriculum.find(m => m.id === activeModule.id) ?? curriculum[0];
    const matchedLesson = matchedModule.lessons.find(l => l.id === activeLesson.id) ?? matchedModule.lessons[0];
    setActiveModule(matchedModule);
    setActiveLesson(matchedLesson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Scoped keyboard shortcut — only fires when tutorial container is focused
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered curriculum based on search query
  const filteredCurriculum = searchQuery.trim() === ''
    ? curriculum
    : curriculum.map(module => ({
      ...module,
      lessons: module.lessons.filter(lesson =>
        lesson.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lesson.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        module.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(module => module.lessons.length > 0);

  // Helper to parse basic markdown for rich text rendering
  const parseMarkdown = (text: string) => {
    let parsed = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-on-surface font-semibold">$1</strong>');
    parsed = parsed.replace(/`([^`]+)`/g, '<code class="bg-surface-container-high border border-outline-variant px-1.5 py-0.5 rounded text-primary text-sm font-mono"><bdi>$1</bdi></code>');
    parsed = parsed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-primary hover:underline"><bdi>$1</bdi></a>');
    return parsed;
  };

  const renderContent = (content: string) => {
    return content.split('\n\n').map((block, index) => {
      const trimmed = block.trim();

      if (trimmed.startsWith('### ')) {
        const lines = trimmed.split('\n');
        const heading = lines[0];
        const rest = lines.slice(1);

        return (
          <div key={index}>
            <h3 className="text-xl font-bold text-on-surface mt-8 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary rounded-full inline-block"></span>
              {heading.replace('### ', '')}
            </h3>
            {rest.length > 0 && (
              <p
                className="text-on-surface-variant leading-7 mb-4 text-base"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(rest.join('\n')) }}
              />
            )}
          </div>
        );
      }

      if (trimmed.startsWith('- ')) {
        const items = trimmed.split('\n').map(line => line.replace(/^- /, '').trim());
        return (
          <ul key={index} className={`list-disc ${isRtl ? 'pr-6' : 'pl-6'} mb-6 space-y-2 text-on-surface-variant`}>
            {items.map((item, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: parseMarkdown(item) }} />
            ))}
          </ul>
        );
      }

      if (/^\d+\. /.test(trimmed)) {
        const items = trimmed.split('\n').map(line => line.replace(/^\d+\. /, '').trim());
        return (
          <ol key={index} className={`list-decimal ${isRtl ? 'pr-6' : 'pl-6'} mb-6 space-y-2 text-on-surface-variant`}>
            {items.map((item, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: parseMarkdown(item) }} />
            ))}
          </ol>
        );
      }

      return (
        <p
          key={index}
          className="text-on-surface-variant leading-7 mb-4 text-base"
          dangerouslySetInnerHTML={{ __html: parseMarkdown(trimmed) }}
        />
      );
    });
  };

  // Syntax highlighting helper
  const highlightCode = (code: string) => {
    let safeCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const placeholders: string[] = [];
    const pushPlaceholder = (text: string) => {
      placeholders.push(text);
      return `___PLACEHOLDER_${placeholders.length - 1}___`;
    };

    safeCode = safeCode.replace(/("[^"]*")/g, (match) => pushPlaceholder(`<span class="text-tertiary">${match}</span>`));
    safeCode = safeCode.replace(/(\/\/.*)/g, (match) => pushPlaceholder(`<span class="text-secondary italic">${match}</span>`));
    safeCode = safeCode.replace(/(&lt;!--[\s\S]*?--&gt;)/g, (match) => pushPlaceholder(`<span class="text-secondary italic">${match}</span>`));
    safeCode = safeCode.replace(/\b(public|private|protected|class|interface|record|enum|return|if|else|void|new|final|static|package|import|throws|try|catch|extends|implements)\b/g, '<span class="text-primary font-semibold">$1</span>');
    safeCode = safeCode.replace(/\b(String|Long|Integer|Boolean|List|Optional|LocalDate|BigDecimal|ResponseEntity|ProblemDetail|HttpStatus|User|UserDTO|OrderDTO|OrderRequest|UserRepository|Component|Service|RestController|RestControllerAdvice|GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|PathVariable|RequestBody|Autowired|Bean|Scope|SecurityFilterChain|HttpSecurity|SessionCreationPolicy|DataSource|MailConfig|Document|Map|ConcurrentHashMap|Mono|Flux|StepVerifier|Container|PostgreSQLContainer|JoinPoint|ProceedingJoinPoint|Aspect|Before|Around|ApplicationEventPublisher|EventListener|Async|Scheduled|Cacheable|CacheEvict|Flyway|RestClient|WebClient|HealthIndicator|Health|RouteLocator|RouteLocatorBuilder|CircuitBreaker|RabbitListener|OrderEvent|KafkaListener|UserEvent|MessageMapping|SendTo|ChatMessage|Operation|ApiResponses|ApiResponse|QueryMapping|SchemaMapping|Argument|Book|MongoRepository|Id|Step|JobRepository|PlatformTransactionManager|StepBuilder)\b/g, '<span class="text-on-surface font-semibold">$1</span>');
    safeCode = safeCode.replace(/(@\w+)/g, '<span class="text-tertiary font-semibold">$1</span>');
    safeCode = safeCode.replace(/(&lt;\/?[a-z][a-z0-9\-\.:]*)/g, '<span class="text-primary">$1</span>');

    placeholders.forEach((content, index) => {
      safeCode = safeCode.replace(`___PLACEHOLDER_${index}___`, content);
    });

    return safeCode;
  };

  const handleModuleSelect = (module: Module) => {
    setActiveModule(module);
    setActiveLesson(module.lessons[0]);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleLessonSelect = (lesson: Lesson, module: Module) => {
    setActiveModule(module);
    setActiveLesson(lesson);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleLangToggle = () => {
    setLang(l => {
      const next: Lang = l === 'en' ? 'he' : 'en';
      localStorage.setItem('tutorial-lang', next);
      return next;
    });
    setSearchQuery('');
  };

  // suppress unused warning for handleModuleSelect (kept for potential future use)
  void handleModuleSelect;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      dir={isRtl ? 'rtl' : 'ltr'}
      className="flex bg-background text-on-background overflow-hidden font-sans outline-none"
      style={{ height: 'calc(100vh - 4rem)' }}
    >
      {/* Mobile Sidebar Toggle */}
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
        <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-container rounded-lg flex items-center justify-center shadow-lg shadow-primary/30">
              <span className="font-bold text-on-primary text-lg">S</span>
            </div>
            <h1 className="font-bold text-lg tracking-tight text-on-surface">{ui.sidebarTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLangToggle}
              className="px-2.5 py-1 rounded-md text-xs font-bold border border-outline-variant text-secondary hover:text-on-surface hover:border-primary/40 transition-colors"
              title={ui.langToggleTitle}
            >
              {ui.langToggleLabel}
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-secondary">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-outline-variant/50">
          <div className="relative group">
            <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors`} size={14} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={ui.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-background border border-outline-variant rounded-lg py-2 ${isRtl ? 'pr-9 pl-10' : 'pl-9 pr-10'} text-xs text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all`}
            />
            <div className={`absolute ${isRtl ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-variant border border-outline text-[10px] text-secondary font-medium pointer-events-none`}>
              <Command size={8} />
              <span>K</span>
            </div>
          </div>
        </div>

        <div className="p-4 overflow-y-auto tutorial-scroll" style={{ height: 'calc(100% - 130px)' }}>
          <div className="space-y-8">
            {filteredCurriculum.length > 0 ? (
              filteredCurriculum.map((module) => (
                <div key={module.id}>
                  <h3 className="text-[11px] font-bold text-secondary uppercase tracking-widest mb-3 px-2 flex items-center gap-2">
                    {module.title}
                  </h3>
                  <div className="space-y-0.5">
                    {module.lessons.map((lesson) => (
                      <button
                        key={lesson.id}
                        onClick={() => handleLessonSelect(lesson, module)}
                        className={`w-full ${isRtl ? 'text-right' : 'text-left'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-between group ${activeLesson.id === lesson.id
                            ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'}`}
                      >
                        {isRtl ? (
                          <>
                            {activeLesson.id === lesson.id && <ChevronRight size={14} className="opacity-100 shrink-0 rotate-180" />}
                            <span className="truncate">{lesson.title}</span>
                          </>
                        ) : (
                          <>
                            <span className="truncate">{lesson.title}</span>
                            {activeLesson.id === lesson.id && <ChevronRight size={14} className="opacity-100 shrink-0" />}
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center">
                <div className="w-12 h-12 bg-surface-variant rounded-full flex items-center justify-center mx-auto mb-3 border border-outline-variant">
                  <Search size={20} className="text-secondary" />
                </div>
                <p className="text-sm text-secondary">{ui.noLessonsFound}</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-primary hover:underline mt-2"
                >
                  {ui.clearSearch}
                </button>
              </div>
            )}
          </div>

          <div className="mt-10 mb-6 p-4 glass-panel rounded-xl">
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-background">

        {/* Top Navigation Bar */}
        <header className="h-16 glass-header flex items-center justify-between px-6 z-10 shrink-0 sticky top-0">
          <div className="flex items-center gap-3 ml-10 md:ml-0 overflow-hidden">
            <span className="text-secondary text-sm whitespace-nowrap">{activeModule.title}</span>
            <ChevronRight size={14} className={`text-secondary ${isRtl ? 'rotate-180' : ''}`} />
            <span className="text-primary font-medium text-sm truncate">{activeLesson.title}</span>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setShowArchitecture(!showArchitecture)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${showArchitecture ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface-container text-secondary border-outline-variant hover:border-outline'}`}
            >
              <Layers size={14} />
              {showArchitecture ? ui.hideArchitecture : ui.showArchitecture}
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left/Center: Lesson Content */}
          <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 scroll-smooth tutorial-scroll">

            <div className="max-w-4xl mx-auto space-y-8 pb-10">
              {/* Hero Section of Lesson */}
              <div className="space-y-4 border-b border-outline-variant pb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                  <BookOpen size={12} />
                  {activeModule.title}
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-on-surface tracking-tight leading-tight">{activeLesson.title}</h1>
                <p className="text-lg text-on-surface-variant leading-relaxed max-w-3xl">{activeLesson.description}</p>
              </div>

              {/* Main Explanation */}
              <div className="space-y-4">
                {renderContent(activeLesson.content)}
              </div>

              {/* Code Snippet */}
              {activeLesson.codeSnippet && (
                <div className="mt-8 space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-sm font-semibold text-secondary flex items-center gap-2">
                      <Code2 size={16} />
                      {ui.implementationExample}
                    </h4>
                    <span className="text-xs text-secondary font-mono">
                      {activeLesson.id.startsWith('maven') ? 'pom.xml' : 'Java 17+'}
                    </span>
                  </div>
                  <div dir="ltr" className="glass-card rounded-xl overflow-hidden shadow-2xl group border border-outline-variant">
                    <div className="flex items-center justify-between px-4 py-3 bg-surface-variant/50 border-b border-outline-variant">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5 mr-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-error/80"></div>
                          <div className="w-2.5 h-2.5 rounded-full bg-orange-400"></div>
                          <div className="w-2.5 h-2.5 rounded-full bg-primary/80"></div>
                        </div>
                        <span className="text-xs font-mono text-secondary opacity-60">
                          {activeLesson.id.startsWith('maven') ? 'Maven POM' : 'SpringContext.java'}
                        </span>
                      </div>
                      <div className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface text-secondary border border-outline-variant">{ui.readOnly}</div>
                    </div>
                    <div className="relative p-6 overflow-x-auto bg-surface/50 tutorial-scroll">
                      <pre className="font-mono text-sm leading-6 text-on-surface-variant">
                        <code dangerouslySetInnerHTML={{ __html: highlightCode(activeLesson.codeSnippet) }} />
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Project Scaffolder */}
              {activeLesson.dependencies && activeLesson.dependencies.length > 0 && (
                <div className="mt-12">
                  <ProjectScaffolder dependencies={activeLesson.dependencies} />
                </div>
              )}

              {/* Mock API Playground */}
              {activeLesson.mockApi && (
                <div className="mt-12">
                  <MockApiPlayground mockApi={activeLesson.mockApi} />
                </div>
              )}

              {/* Bean Lifecycle Visualizer */}
              {activeLesson.showLifecycleVisualizer && (
                <div className="mt-12">
                  <BeanLifecycleVisualizer />
                </div>
              )}

              {/* Security Filter Chain Visualizer */}
              {activeLesson.showSecurityVisualizer && (
                <div className="mt-12">
                  <SecurityFilterVisualizer />
                </div>
              )}

              {/* JPA Entity-to-Table Mapper */}
              {activeLesson.showJpaMapper && (
                <div className="mt-12">
                  <JpaEntityMapper />
                </div>
              )}

              {/* Microservices Topology View */}
              {activeLesson.showTopologyVisualizer && (
                <div className="mt-12">
                  <MicroservicesTopology />
                </div>
              )}

              {/* Interactive Architecture View (Mobile/Tablet inline) */}
              <div className="xl:hidden">
                {showArchitecture && (
                  <div className="my-8">
                    <ArchitectureVisualizer activeStage={activeLesson.architectureHighlight} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Architecture (Desktop) */}
          <div className={`hidden xl:flex w-[420px] bg-surface-container-low border-${isRtl ? 'r' : 'l'} border-outline-variant flex-col shrink-0`}>
            <div className="p-6 h-full overflow-y-auto tutorial-scroll">
              {showArchitecture ? (
                <ArchitectureVisualizer activeStage={activeLesson.architectureHighlight} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-secondary space-y-4">
                  <div className="w-16 h-16 rounded-full bg-surface container flex items-center justify-center border border-outline-variant">
                    <Terminal size={24} className="opacity-40" />
                  </div>
                  <p className="text-sm">{ui.architectureHidden}</p>
                  <button
                    onClick={() => setShowArchitecture(true)}
                    className="text-xs text-primary hover:text-primary-container transition-colors border-b border-primary/30 pb-0.5"
                  >
                    {ui.showVisualizer}
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
