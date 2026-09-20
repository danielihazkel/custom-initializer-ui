import { describe, it, expect } from 'vitest'
import { entityCodeFiles } from './entityCode'
import type { FullstackEntityDef, PreviewFile } from '../../types'

const entity = (name: string): FullstackEntityDef => ({
  name, fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }],
})

const f = (path: string): PreviewFile => ({ path, content: `// ${path}` })

const files: PreviewFile[] = [
  f('backend/pom.xml'),
  f('backend/src/main/java/com/menora/demo/entity/User.java'),
  f('backend/src/main/java/com/menora/demo/repository/UserRepository.java'),
  f('backend/src/main/java/com/menora/demo/dto/UserDto.java'),
  f('backend/src/main/java/com/menora/demo/service/UserService.java'),
  f('backend/src/main/java/com/menora/demo/controller/UserController.java'),
  f('backend/src/test/java/com/menora/demo/controller/UserControllerTest.java'),
  // A different entity whose name merely starts with "User" — must not be claimed.
  f('backend/src/main/java/com/menora/demo/entity/UserGroup.java'),
  f('backend/src/main/java/com/menora/demo/controller/UserGroupController.java'),
  f('frontend/src/entities/user/model/types.ts'),
  f('frontend/src/entities/user/api/useUser.ts'),
  f('frontend/src/entities/user/index.ts'),
  f('frontend/src/features/user-form/ui/UserForm.tsx'),
  f('frontend/src/features/user-form/model/validate.ts'),
  f('frontend/src/pages/user/ui/UserPage.tsx'),
  f('frontend/src/pages/user-group/ui/UserGroupPage.tsx'),
  f('frontend/src/shared/ui/Table.tsx'),
]

describe('entityCodeFiles', () => {
  it('collects the entity’s backend stack and frontend slices, and nothing else', () => {
    const paths = entityCodeFiles(entity('User'), files).map(c => c.path)
    expect(paths).toContain('backend/src/main/java/com/menora/demo/entity/User.java')
    expect(paths).toContain('frontend/src/pages/user/ui/UserPage.tsx')
    expect(paths).not.toContain('backend/pom.xml')
    expect(paths).not.toContain('frontend/src/shared/ui/Table.tsx')
  })

  it('does not let a name prefix claim another entity’s files', () => {
    const paths = entityCodeFiles(entity('User'), files).map(c => c.path)
    expect(paths.some(p => p.includes('UserGroup'))).toBe(false)
    expect(paths.some(p => p.includes('/pages/user-group/'))).toBe(false)

    // ...and the longer name still finds its own.
    const group = entityCodeFiles(entity('UserGroup'), files).map(c => c.path)
    expect(group).toContain('backend/src/main/java/com/menora/demo/entity/UserGroup.java')
    expect(group).toContain('frontend/src/pages/user-group/ui/UserGroupPage.tsx')
    expect(group.some(p => p.endsWith('/User.java'))).toBe(false)
  })

  it('orders the backend stack entity → repository → dto → service → controller → test', () => {
    const names = entityCodeFiles(entity('User'), files).filter(c => c.side === 'backend').map(c => c.name)
    expect(names).toEqual([
      'User.java', 'UserRepository.java', 'UserDto.java',
      'UserService.java', 'UserController.java', 'UserControllerTest.java',
    ])
  })

  it('puts the whole backend stack before the frontend slices', () => {
    const sides = entityCodeFiles(entity('User'), files).map(c => c.side)
    expect(sides.indexOf('frontend')).toBeGreaterThan(sides.lastIndexOf('backend'))
  })

  it('tags each file with the half of the project it came from', () => {
    const byName = new Map(entityCodeFiles(entity('User'), files).map(c => [c.name, c.side]))
    expect(byName.get('UserController.java')).toBe('backend')
    expect(byName.get('UserPage.tsx')).toBe('frontend')
  })

  it('returns nothing without a preview, or for an unnamed entity', () => {
    expect(entityCodeFiles(entity('User'), undefined)).toEqual([])
    expect(entityCodeFiles(entity('User'), [])).toEqual([])
    expect(entityCodeFiles(entity('  '), files)).toEqual([])
  })

  it('matches a multi-word entity through its kebab slice folders', () => {
    const multi = [
      f('backend/src/main/java/com/menora/demo/entity/PurchaseOrder.java'),
      f('frontend/src/entities/purchase-order/model/types.ts'),
      f('frontend/src/features/purchase-order-form/index.ts'),
    ]
    const paths = entityCodeFiles(entity('PurchaseOrder'), multi).map(c => c.path)
    expect(paths).toHaveLength(3)
  })

  it('finds the composite-key class when one is generated', () => {
    const withKey = [...files, f('backend/src/main/java/com/menora/demo/entity/UserId.java')]
    const names = entityCodeFiles(entity('User'), withKey).map(c => c.name)
    expect(names[0]).toBe('User.java')
    expect(names[1]).toBe('UserId.java')
  })
})

/**
 * A real `POST /starter-fullstack.preview` payload's file list, for a three-entity model whose
 * names deliberately overlap: `User`, `UserGroup` and `PurchaseOrder`. Captured from the running
 * backend (Boot 3.2.1, `spring-jpa-crud` + `react-tailwind-crud`, `tests` opt on).
 *
 * This is the fixture that matters: the unit tests above encode what the matcher is *meant* to do,
 * and this one checks that against the paths the generator actually emits. If the template sets
 * move a file, this is what notices.
 */
const REAL_PREVIEW_PATHS = [
  '.gitignore',
  'README.md',
  'backend/.editorconfig',
  'backend/.gitattributes',
  'backend/.gitignore',
  'backend/Dockerfile',
  'backend/HELP.md',
  'backend/VERSION',
  'backend/entrypoint.sh',
  'backend/k8s/Jenkinsfile',
  'backend/k8s/values.yaml',
  'backend/pom.xml',
  'backend/settings.xml',
  'backend/src/main/java/com/menora/codepeek/CodepeekApplication.java',
  'backend/src/main/java/com/menora/codepeek/config/CorsConfig.java',
  'backend/src/main/java/com/menora/codepeek/controller/PurchaseOrderController.java',
  'backend/src/main/java/com/menora/codepeek/controller/UserController.java',
  'backend/src/main/java/com/menora/codepeek/controller/UserGroupController.java',
  'backend/src/main/java/com/menora/codepeek/dto/PurchaseOrderDto.java',
  'backend/src/main/java/com/menora/codepeek/dto/UserDto.java',
  'backend/src/main/java/com/menora/codepeek/dto/UserGroupDto.java',
  'backend/src/main/java/com/menora/codepeek/entity/PurchaseOrder.java',
  'backend/src/main/java/com/menora/codepeek/entity/User.java',
  'backend/src/main/java/com/menora/codepeek/entity/UserGroup.java',
  'backend/src/main/java/com/menora/codepeek/repository/PurchaseOrderRepository.java',
  'backend/src/main/java/com/menora/codepeek/repository/UserGroupRepository.java',
  'backend/src/main/java/com/menora/codepeek/repository/UserRepository.java',
  'backend/src/main/java/com/menora/codepeek/service/PurchaseOrderService.java',
  'backend/src/main/java/com/menora/codepeek/service/UserGroupService.java',
  'backend/src/main/java/com/menora/codepeek/service/UserService.java',
  'backend/src/main/java/com/menora/codepeek/web/ApiExceptionHandler.java',
  'backend/src/main/java/com/menora/codepeek/web/ResourceConflictException.java',
  'backend/src/main/java/com/menora/codepeek/web/ResourceNotFoundException.java',
  'backend/src/main/java/com/menora/codepeek/web/ValidationExceptionHandler.java',
  'backend/src/main/resources/application.yaml',
  'backend/src/main/resources/detailedLogFormat.json',
  'backend/src/main/resources/log4j2-spring.xml',
  'backend/src/main/resources/logFormat.json',
  'backend/src/test/java/com/menora/codepeek/CodepeekApplicationTests.java',
  'backend/src/test/java/com/menora/codepeek/controller/PurchaseOrderControllerTest.java',
  'backend/src/test/java/com/menora/codepeek/controller/UserControllerTest.java',
  'backend/src/test/java/com/menora/codepeek/controller/UserGroupControllerTest.java',
  'frontend/.dockerignore',
  'frontend/.editorconfig',
  'frontend/.env.development',
  'frontend/.env.example',
  'frontend/.env.production',
  'frontend/.gitignore',
  'frontend/.husky/pre-commit',
  'frontend/.prettierrc.json',
  'frontend/Dockerfile',
  'frontend/README.md',
  'frontend/VERSION',
  'frontend/entrypoint.sh',
  'frontend/eslint.config.js',
  'frontend/index.html',
  'frontend/k8s/Jenkinsfile',
  'frontend/k8s/values.yaml',
  'frontend/nginx/nginx.conf',
  'frontend/package.json',
  'frontend/public/logo.png',
  'frontend/settings.xml',
  'frontend/src/app/App.tsx',
  'frontend/src/app/README.md',
  'frontend/src/app/index.ts',
  'frontend/src/entities/README.md',
  'frontend/src/entities/index.ts',
  'frontend/src/entities/purchase-order/api/usePurchaseOrder.ts',
  'frontend/src/entities/purchase-order/index.ts',
  'frontend/src/entities/purchase-order/model/types.ts',
  'frontend/src/entities/user-group/api/useUserGroup.ts',
  'frontend/src/entities/user-group/index.ts',
  'frontend/src/entities/user-group/model/types.ts',
  'frontend/src/entities/user/api/useUser.ts',
  'frontend/src/entities/user/index.ts',
  'frontend/src/entities/user/model/types.ts',
  'frontend/src/features/README.md',
  'frontend/src/features/index.ts',
  'frontend/src/features/purchase-order-form/index.ts',
  'frontend/src/features/purchase-order-form/model/validate.ts',
  'frontend/src/features/purchase-order-form/ui/PurchaseOrderDetail.tsx',
  'frontend/src/features/purchase-order-form/ui/PurchaseOrderForm.tsx',
  'frontend/src/features/user-form/index.ts',
  'frontend/src/features/user-form/model/validate.ts',
  'frontend/src/features/user-form/ui/UserDetail.tsx',
  'frontend/src/features/user-form/ui/UserForm.tsx',
  'frontend/src/features/user-group-form/index.ts',
  'frontend/src/features/user-group-form/model/validate.ts',
  'frontend/src/features/user-group-form/ui/UserGroupDetail.tsx',
  'frontend/src/features/user-group-form/ui/UserGroupForm.tsx',
  'frontend/src/index.css',
  'frontend/src/main.tsx',
  'frontend/src/pages/README.md',
  'frontend/src/pages/dashboard/index.ts',
  'frontend/src/pages/dashboard/ui/DashboardPage.tsx',
  'frontend/src/pages/index.ts',
  'frontend/src/pages/purchase-order/index.ts',
  'frontend/src/pages/purchase-order/ui/PurchaseOrderPage.tsx',
  'frontend/src/pages/user-group/index.ts',
  'frontend/src/pages/user-group/ui/UserGroupPage.tsx',
  'frontend/src/pages/user/index.ts',
  'frontend/src/pages/user/ui/UserPage.tsx',
  'frontend/src/shared/README.md',
  'frontend/src/shared/api/client.ts',
  'frontend/src/shared/api/index.ts',
  'frontend/src/shared/api/useOptions.ts',
  'frontend/src/shared/api/useResource.ts',
  'frontend/src/shared/i18n/index.ts',
  'frontend/src/shared/i18n/strings.ts',
  'frontend/src/shared/index.ts',
  'frontend/src/shared/ui/Alert.tsx',
  'frontend/src/shared/ui/Badge.tsx',
  'frontend/src/shared/ui/CalendarView.tsx',
  'frontend/src/shared/ui/CardGrid.tsx',
  'frontend/src/shared/ui/ConfirmDialog.tsx',
  'frontend/src/shared/ui/DetailDrawer.tsx',
  'frontend/src/shared/ui/EmptyState.tsx',
  'frontend/src/shared/ui/Field.tsx',
  'frontend/src/shared/ui/FilterBar.tsx',
  'frontend/src/shared/ui/FormDrawer.tsx',
  'frontend/src/shared/ui/KanbanBoard.tsx',
  'frontend/src/shared/ui/Skeleton.tsx',
  'frontend/src/shared/ui/Table.tsx',
  'frontend/src/shared/ui/index.ts',
  'frontend/src/shared/ui/useTheme.ts',
  'frontend/src/vite-env.d.ts',
  'frontend/src/widgets/README.md',
  'frontend/src/widgets/index.ts',
  'frontend/tsconfig.json',
  'frontend/tsconfig.node.json',
  'frontend/vite.config.ts',
]

describe('entityCodeFiles \u2014 against a real preview payload', () => {
  const files = REAL_PREVIEW_PATHS.map(p => ({ path: p, content: '// ' + p }))
  const names = ['User', 'UserGroup', 'PurchaseOrder']

  it('gives every entity its full backend stack', () => {
    for (const name of names) {
      const matched = entityCodeFiles(entity(name), files).filter(c => c.side === 'backend').map(c => c.name)
      expect(matched).toEqual([
        name + '.java', name + 'Repository.java', name + 'Dto.java',
        name + 'Service.java', name + 'Controller.java', name + 'ControllerTest.java',
      ])
    }
  })

  it('gives every entity its three frontend slices', () => {
    for (const name of names) {
      const fe = entityCodeFiles(entity(name), files).filter(c => c.side === 'frontend').map(c => c.path)
      expect(fe.some(p => p.includes('/entities/'))).toBe(true)
      expect(fe.some(p => p.includes('-form/'))).toBe(true)
      expect(fe.some(p => p.includes('/pages/'))).toBe(true)
    }
  })

  it('never lets two entities claim the same file', () => {
    const owner = new Map<string, string>()
    for (const name of names) {
      for (const file of entityCodeFiles(entity(name), files)) {
        expect(owner.get(file.path)).toBeUndefined()
        owner.set(file.path, name)
      }
    }
    // `User` must not have swallowed anything belonging to `UserGroup`.
    const userFiles = entityCodeFiles(entity('User'), files).map(c => c.path)
    expect(userFiles.some(p => p.toLowerCase().includes('group'))).toBe(false)
  })

  it('claims every per-entity file the generator emitted, and no shared one', () => {
    const claimed = new Set(names.flatMap(n => entityCodeFiles(entity(n), files).map(c => c.path)))
    // `pages/dashboard/` is shaped like an entity slice but is the project-level home page — it
    // belongs to no entity, so no card should claim it.
    const perEntity = REAL_PREVIEW_PATHS.filter(p =>
      !p.includes('/pages/dashboard/')
      && (/\/(entities|features|pages)\/[a-z0-9-]+\//.test(p)
        || /\/(entity|repository|dto|service|controller)\/[A-Z]\w*\.java$/.test(p)))
    expect([...perEntity].filter(p => !claimed.has(p))).toEqual([])
    // Shared plumbing stays out.
    expect(claimed.has('backend/pom.xml')).toBe(false)
    expect([...claimed].some(p => p.includes('/shared/'))).toBe(false)
    expect([...claimed].some(p => p.includes('/pages/dashboard/'))).toBe(false)
  })
})
