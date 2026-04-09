import type { GuideWorkflowStep } from './guide-types'

interface GuideWorkflowStepperProps {
  steps: GuideWorkflowStep[]
}

export function GuideWorkflowStepper({ steps }: GuideWorkflowStepperProps) {
  return (
    <div className="my-6 space-y-0">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-4">
          {/* Left: number + connector line */}
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-primary/15 border-2 border-primary/40 flex items-center justify-center shrink-0 z-10">
              <span className="text-xs font-bold text-primary">{i + 1}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-0.5 bg-primary/15 flex-1 my-1" style={{ minHeight: '24px' }} />
            )}
          </div>
          {/* Right: content */}
          <div className={`pb-6 ${i === steps.length - 1 ? '' : ''}`}>
            <h4 className="text-sm font-semibold text-on-surface mb-1">{step.title}</h4>
            <p className="text-sm text-on-surface-variant leading-relaxed">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
