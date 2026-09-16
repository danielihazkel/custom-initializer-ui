/** Escapes the three characters that would otherwise be parsed as markup when a code
 *  snippet is injected via `dangerouslySetInnerHTML` — without it, generics such as
 *  `List<Order>` are swallowed as unknown HTML tags. Run this *before* wrapping tokens
 *  in `<span>`s. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
