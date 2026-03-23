
export interface Dependency {
  groupId: string;
  artifactId: string;
  version?: string;
  scope?: 'compile' | 'test' | 'provided' | 'runtime';
  description: string;
}

export interface MockApi {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  requestBody?: string;
  responseBody: string;
  status: number;
  description: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string; // Markdown-like or raw text
  codeSnippet?: string;
  architectureHighlight?: 'gateway' | 'client' | 'controller' | 'service' | 'repository' | 'database' | 'security' | 'cache' | 'event-bus' | 'broker' | 'test' | 'graphql' | 'none';
  dependencies?: Dependency[];
  mockApi?: MockApi;
  showLifecycleVisualizer?: boolean;
  showSecurityVisualizer?: boolean;
  showJpaMapper?: boolean;
  showTopologyVisualizer?: boolean;
}

export interface Module {
  id: string;
  title: string;
  icon: string;
  lessons: Lesson[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum AppView {
  LEARN = 'LEARN',
  PRACTICE = 'PRACTICE',
  ARCHITECT = 'ARCHITECT'
}
