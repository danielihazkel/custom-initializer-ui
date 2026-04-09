export interface GuideField {
  name: string
  type: string
  required: boolean
  description: string
  example?: string
}

export interface GuideCodeExample {
  title: string
  language: string
  code: string
}

export interface GuideCalloutData {
  type: 'info' | 'warning' | 'tip'
  text: string
}

export interface GuideWorkflowStep {
  title: string
  description: string
}

export interface GuideTopic {
  id: string
  title: string
  description: string
  content: string
  fields?: GuideField[]
  codeExamples?: GuideCodeExample[]
  callouts?: GuideCalloutData[]
  workflowSteps?: GuideWorkflowStep[]
}

export interface GuideSection {
  id: string
  title: string
  icon: string
  topics: GuideTopic[]
}
