import { NextSteps } from '../shared/NextSteps'

/** What the Backend tab's last successful Generate produced — in memory only. */
export interface BackendRun {
  artifactId: string
  dependencyCount: number
  /** The dependency ids: the services compose.yaml starts follow from them. */
  dependencies?: string[]
  /** Dependencies whose wizard (SQL, OpenAPI, WSDL, AsyncAPI) contributed code. */
  wizardCount: number
  /** Modules of a multi-module project; 0 for a single module. */
  moduleCount: number
  /** `ProjectRequest.key` of what was generated, to tell when the setup has moved on. */
  key: string
}

interface Props {
  run: BackendRun
  /** The setup on screen no longer generates what was downloaded. */
  stale: boolean
  onDismiss: () => void
  onSavePreset: () => void
  onCopyCurl: () => void
  onShareLink: () => void
  onExplore: () => void
  onCopied?: (ok: boolean, what: string) => void
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Dependencies the generated compose.yaml starts a container for (the backend's LocalRun.SERVICES). */
const COMPOSE_SERVICES = ['postgresql', 'oracle', 'mssql', 'mongodb', 'redis', 'kafka']

/**
 * The Spring profiles that point the project at its compose services, or null when it has none
 * (no compose.yaml is generated then).
 */
export function composeProfiles(dependencies: string[] | undefined): string | null {
  if (!dependencies?.some(d => COMPOSE_SERVICES.includes(d))) return null
  return dependencies.some(d => d === 'ldap-auth' || d === 'ldap-auth-rest') ? 'compose,local' : 'compose'
}

/**
 * The Backend tab's card after a successful Generate. Lazy: it exists only once a project has
 * been generated.
 */
export function BackendNextSteps({ run, stale, onDismiss, onSavePreset, onCopyCurl, onShareLink, onExplore, onCopied }: Props) {
  const folder = run.artifactId || 'project'
  const made = [
    plural(run.dependencyCount, 'dependency', 'dependencies'),
    run.moduleCount > 0 ? plural(run.moduleCount, 'module') : '',
    run.wizardCount > 0 ? plural(run.wizardCount, 'wizard') : '',
  ].filter(Boolean).join(', ')
  const profiles = composeProfiles(run.dependencies)
  // A multi-module project's compose file is at its root; the run command is its own business.
  const runCommand = profiles && run.moduleCount === 0 ? `mvn spring-boot:run -Dspring-boot.run.profiles=${profiles}` : 'mvn spring-boot:run'

  return (
    <NextSteps
      title={`${folder}.zip is downloaded — ${made}`}
      hint={<>
        The project keeps its own <span className="font-mono">menora-model.json</span>: import it here
        later to change the project and download an update instead of generating again.
      </>}
      stale={stale}
      commands={[
        { label: 'Unpack', cmd: `unzip ${folder}.zip -d ${folder} && cd ${folder}` },
        ...(profiles ? [{ label: 'Services', cmd: 'docker compose up -d' }] : []),
        { label: 'Run', cmd: runCommand },
        { label: 'Test', cmd: 'mvn test' },
      ]}
      actionsLabel="Keep this setup:"
      actions={[
        { id: 'preset', label: 'Save as preset', icon: 'bookmark_add', onClick: onSavePreset },
        { id: 'curl', label: 'Copy as curl', icon: 'terminal', onClick: onCopyCurl },
        { id: 'link', label: 'Copy share link', icon: 'link', onClick: onShareLink },
        { id: 'explore', label: 'Explore the files', icon: 'folder_open', onClick: onExplore },
      ]}
      onDismiss={onDismiss}
      onCopied={onCopied}
    />
  )
}
