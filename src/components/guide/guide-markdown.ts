/** Minimal inline-markdown → HTML used by the guide pages (bold, code, links). Lives in its
 *  own module so GuideCallout/GuideFieldTable don't have to import it back from GuideView
 *  (which imports them — a circular dependency). */
export const parseMarkdown = (text: string) => {
  let parsed = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-on-surface font-semibold">$1</strong>')
  parsed = parsed.replace(/`([^`]+)`/g, '<code class="bg-surface-container-high border border-outline-variant px-1.5 py-0.5 rounded text-primary text-sm font-mono"><bdi>$1</bdi></code>')
  parsed = parsed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-primary hover:underline"><bdi>$1</bdi></a>')
  return parsed
}
