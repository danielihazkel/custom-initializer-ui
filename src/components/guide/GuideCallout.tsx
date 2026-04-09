import type { GuideCalloutData } from './guide-types'

interface GuideCalloutProps {
  callout: GuideCalloutData
}

const CALLOUT_STYLES = {
  info: {
    container: 'bg-primary/8 border-primary/30',
    icon: 'info',
    iconColor: 'text-primary',
    titleColor: 'text-primary',
    title: 'Note'
  },
  warning: {
    container: 'bg-error/8 border-error/30',
    icon: 'warning',
    iconColor: 'text-error',
    titleColor: 'text-error',
    title: 'Warning'
  },
  tip: {
    container: 'bg-tertiary/8 border-tertiary/30',
    icon: 'lightbulb',
    iconColor: 'text-tertiary',
    titleColor: 'text-tertiary',
    title: 'Tip'
  }
}

export function GuideCallout({ callout }: GuideCalloutProps) {
  const style = CALLOUT_STYLES[callout.type]
  return (
    <div className={`my-6 flex gap-3 p-4 rounded-xl border ${style.container}`}>
      <span className={`material-symbols-outlined mt-0.5 shrink-0 ${style.iconColor}`} style={{ fontSize: '20px' }}>
        {style.icon}
      </span>
      <div>
        <span className={`text-xs font-bold uppercase tracking-wider ${style.titleColor} block mb-1`}>{style.title}</span>
        <p className="text-sm text-on-surface-variant leading-relaxed">{callout.text}</p>
      </div>
    </div>
  )
}
