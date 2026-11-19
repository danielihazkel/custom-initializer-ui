import { Fragment, type ReactNode } from 'react'

/**
 * A translated sentence with code in it: the parts between backticks are drawn as `<code>` (left
 * to right, in either language), the rest as text. So a hint keeps its code styling and is still
 * one text to translate — `t('Paste one or more `CREATE TABLE` statements')`.
 */
export function codeText(text: string, codeClassName = 'text-primary'): ReactNode {
  const parts = text.split('`')
  return parts.map((part, i) => i % 2 === 1
    ? <code key={i} className={codeClassName}>{part}</code>
    : <Fragment key={i}>{part}</Fragment>)
}
