import type { Language } from 'prism-react-renderer'

export function detectLanguage(filename: string): Language {
  if (filename.endsWith('.java'))                              return 'java'
  if (filename.endsWith('.xml') || filename === 'pom.xml')    return 'markup'
  if (filename.endsWith('.yml') || filename.endsWith('.yaml')) return 'yaml'
  if (filename === 'Dockerfile')                               return 'docker' as Language
  if (filename.endsWith('.properties') ||
      filename === '.editorconfig' ||
      filename === '.gitignore')                               return 'properties' as Language
  if (filename.endsWith('.sh') || filename === 'Jenkinsfile' ||
      filename === 'gradlew')                                  return 'bash'
  if (filename.endsWith('.json'))                              return 'json'
  if (filename.endsWith('.md'))                                return 'markdown'
  if (filename.endsWith('.css'))                               return 'css'
  if (filename.endsWith('.ts') || filename.endsWith('.tsx'))   return 'tsx'
  if (filename.endsWith('.js') || filename.endsWith('.jsx'))   return 'jsx'
  return 'markup'
}
