import type { GuideCodeExample } from './guide-types'

interface GuideCodeBlockProps {
  example: GuideCodeExample
}

function highlightCode(code: string, language: string): string {
  let safe = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  if (language === 'java') {
    const placeholders: string[] = []
    const push = (text: string) => { placeholders.push(text); return `___P${placeholders.length - 1}___` }
    safe = safe.replace(/("[^"]*")/g, m => push(`<span class="text-tertiary">${m}</span>`))
    safe = safe.replace(/(\/\/.*)/g, m => push(`<span class="text-secondary italic">${m}</span>`))
    safe = safe.replace(/\b(public|private|class|interface|return|if|else|void|new|final|static|package|import)\b/g, '<span class="text-primary font-semibold">$1</span>')
    safe = safe.replace(/(@\w+)/g, '<span class="text-tertiary font-semibold">$1</span>')
    placeholders.forEach((c, i) => { safe = safe.replace(`___P${i}___`, c) })
  } else if (language === 'yaml') {
    const placeholders: string[] = []
    const push = (text: string) => { placeholders.push(text); return `___P${placeholders.length - 1}___` }
    safe = safe.replace(/(#.*)/g, m => push(`<span class="text-secondary italic">${m}</span>`))
    safe = safe.replace(/(\{\{[^}]+\}\})/g, m => push(`<span class="text-tertiary font-semibold">${m}</span>`))
    safe = safe.replace(/^(\s*)([\w-]+):/gm, '$1<span class="text-primary">$2</span>:')
    placeholders.forEach((c, i) => { safe = safe.replace(`___P${i}___`, c) })
  } else if (language === 'dockerfile') {
    safe = safe.replace(/^(FROM|RUN|COPY|WORKDIR|ENTRYPOINT|ENV|EXPOSE|CMD|ARG|LABEL)(\s)/gm, '<span class="text-primary font-semibold">$1</span>$2')
    safe = safe.replace(/(#.*)/g, '<span class="text-secondary italic">$1</span>')
    safe = safe.replace(/(\{\{[^}]+\}\})/g, '<span class="text-tertiary font-semibold">$1</span>')
  } else {
    // text / generic — highlight template variables
    safe = safe.replace(/(\{\{[^}]+\}\})/g, '<span class="text-tertiary font-semibold">$1</span>')
    safe = safe.replace(/(\/\/.*)/g, '<span class="text-secondary italic">$1</span>')
  }

  return safe
}

export function GuideCodeBlock({ example }: GuideCodeBlockProps) {
  return (
    <div className="my-6 space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className="material-symbols-outlined text-secondary" style={{ fontSize: '16px' }}>code</span>
        <span className="text-sm font-semibold text-secondary">{example.title}</span>
      </div>
      <div className="glass-card rounded-xl overflow-hidden border border-outline-variant shadow-lg">
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface-variant/50 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-error/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-orange-400/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-primary/70" />
            </div>
          </div>
          <span className="text-[10px] font-mono text-secondary uppercase tracking-wider">{example.language}</span>
        </div>
        <div className="p-5 overflow-x-auto bg-surface/30">
          <pre className="font-mono text-sm leading-6 text-on-surface-variant whitespace-pre">
            <code dangerouslySetInnerHTML={{ __html: highlightCode(example.code, example.language) }} />
          </pre>
        </div>
      </div>
    </div>
  )
}
