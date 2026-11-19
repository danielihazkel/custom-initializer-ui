import { NextSteps } from '../shared/NextSteps'
import { t, tn } from '../../i18n'

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
    tn(run.dependencyCount, '{n} dependency', '{n} dependencies'),
    run.moduleCount > 0 ? tn(run.moduleCount, '{n} module', '{n} modules') : '',
    run.wizardCount > 0 ? tn(run.wizardCount, '{n} wizard', '{n} wizards') : '',
  ].filter(Boolean).join(', ')
  const profiles = composeProfiles(run.dependencies)
  // A multi-module project's compose file is at its root; the run command is its own business.
  const runCommand = profiles && run.moduleCount === 0 ? `mvn spring-boot:run -Dspring-boot.run.profiles=${profiles}` : 'mvn spring-boot:run'

  return (
    <NextSteps
      title={t('{file} is downloaded — {made}', { file: `${folder}.zip`, made })}
      hint={<>
        {t('The project keeps its own')} <span className="font-mono">menora-model.json</span>{t(': import it here later to change the project and download an update instead of generating again.')}
      </>}
      stale={stale}
      commands={[
        { label: t('Unpack'), cmd: `unzip ${folder}.zip -d ${folder} && cd ${folder}` },
        ...(profiles ? [{ label: t('Services'), cmd: 'docker compose up -d' }] : []),
        { label: t('Run'), cmd: runCommand },
        { label: t('Test'), cmd: 'mvn test' },
      ]}
      actionsLabel={t('Keep this setup:')}
      actions={[
        { id: 'preset', label: t('Save as preset'), icon: 'bookmark_add', onClick: onSavePreset },
        { id: 'curl', label: t('Copy as curl'), icon: 'terminal', onClick: onCopyCurl },
        { id: 'link', label: t('Copy share link'), icon: 'link', onClick: onShareLink },
        { id: 'explore', label: t('Explore the files'), icon: 'folder_open', onClick: onExplore },
      ]}
      onDismiss={onDismiss}
      onCopied={onCopied}
    />
  )
}
