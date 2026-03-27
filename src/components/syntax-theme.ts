import type { PrismTheme } from 'prism-react-renderer'

export const md3SyntaxTheme: PrismTheme = {
  plain: {
    color: 'var(--color-on-surface)',
    backgroundColor: 'transparent',
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: { color: 'var(--color-secondary)' },
    },
    {
      types: ['keyword', 'operator', 'builtin'],
      style: { color: 'var(--color-primary)' },
    },
    {
      types: ['string', 'char', 'attr-value', 'template-string'],
      style: { color: 'var(--color-tertiary)' },
    },
    {
      types: ['number', 'boolean', 'constant'],
      style: { color: 'var(--color-error)' },
    },
    {
      types: ['function', 'class-name'],
      style: { color: 'var(--color-primary-fixed-dim)' },
    },
    {
      types: ['tag', 'selector'],
      style: { color: 'var(--color-primary)' },
    },
    {
      types: ['attr-name'],
      style: { color: 'var(--color-tertiary-fixed-dim)' },
    },
    {
      types: ['punctuation'],
      style: { color: 'var(--color-on-surface-variant)' },
    },
    {
      types: ['namespace'],
      style: { color: 'var(--color-on-surface-variant)', opacity: 0.7 },
    },
    {
      types: ['annotation'],
      style: { color: 'var(--color-primary-container)' },
    },
  ],
}
