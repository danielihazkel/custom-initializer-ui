import type { GuideSection } from './guide-types'

export const GUIDE_SECTIONS: GuideSection[] = [
  // ─────────────────────────────────────────────────────────────────
  // 1. SYSTEM OVERVIEW
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'overview',
    title: 'System Overview',
    icon: 'info',
    topics: [
      {
        id: 'overview-what',
        title: 'What Is This Tool?',
        description: 'A high-level picture of what Menora Spring Initializr does.',
        content: `### Purpose
This tool is an internal developer portal for generating Spring Boot project skeletons that follow Menora engineering standards. Engineers fill in the project metadata (Group ID, Artifact ID, Java version, dependencies), click **Generate**, and receive a ready-to-compile ZIP that already contains:

- A properly structured Maven project (parent POM or single-module)
- Company-standard Artifactory repositories wired into the POM
- Log4j2 configured and the default Logback excluded
- A \`Dockerfile\`, \`Jenkinsfile\`, \`k8s/values.yaml\`, and \`entrypoint.sh\`
- Per-dependency configuration files (e.g. \`application.yaml\` with Kafka bootstrap servers, Java config classes for JPA/Security/RQueue)
- An \`.editorconfig\` and a \`VERSION\` file

### Why Not start.spring.io?
The public Spring Initializr knows nothing about Menora's Artifactory mirror, internal libraries (RQueue, mail-sampler), company file templates, or required Maven exclusions. This backend adds all of that on top of the same Spring Initializr framework that powers start.spring.io.

### Admin vs. Application
The **application** (what developers use) is the main page — it renders the project form and generates ZIPs. The **admin** (Config tab) is the control plane — everything you configure there changes what gets injected into generated projects. This guide covers the admin.`,
      },
      {
        id: 'overview-pipeline',
        title: 'Generation Pipeline',
        description: 'How a ZIP is assembled from admin configuration at request time.',
        content: `### Request Flow
When a developer clicks Generate, the following happens:

1. **HTTP request** arrives at \`/starter.zip\` with query parameters: \`groupId\`, \`artifactId\`, \`dependencies\`, \`javaVersion\`, sub-option params like \`opts-kafka=consumer-example\`, etc.
2. **Filter** (\`InitializrWebConfiguration\`) runs first — injects a default \`configurationFileFormat=properties\`, sanitizes the \`X-Forwarded-Port\` header, and reads sub-option selections into a per-thread context object.
3. **Framework** spins up a child Spring context for the request and calls every registered \`ProjectGenerationConfiguration\`.
4. **\`DynamicProjectGenerationConfiguration\`** (the only one registered) reads the database and contributes three things:
   - **File contributor** — iterates every \`FileContributionEntity\` for the selected dependencies (plus \`__common__\`), filters by Java version and sub-option, then writes/merges/deletes files in the output directory.
   - **Delete contributor** — runs last (lowest precedence) to delete framework-generated files that Menora doesn't want (e.g. \`application.properties\`).
   - **Build customizer** — applies \`BuildCustomizationEntity\` records to the Maven build object (adds dependencies, exclusions, and repositories).
5. **ZIP** is assembled and returned to the browser.

### Key Insight: The DB is the Source of Truth
Nothing about what goes into a generated project is hardcoded in Java — it is all in the database. Add a file, change a template, add a dependency: it all flows through admin configuration. After any change, call **Refresh** (top-right button in the admin) to reload the in-memory metadata cache without restarting the server.`,
        callouts: [
          {
            type: 'info',
            text: 'The `__common__` dependency ID is a special sentinel. File contributions and build customizations assigned to `__common__` are applied to every generated project, regardless of which dependencies the user selected.'
          }
        ]
      },
      {
        id: 'overview-refresh',
        title: 'The Refresh Button',
        description: 'When and why to call /admin/refresh.',
        content: `### Why Refresh Exists
The backend caches the full dependency metadata (groups, entries, compatibility ranges) in memory so it doesn't hit the database on every generation request. After you make any change through the admin UI, that cache is stale.

### When to Click Refresh
Click **Refresh** (the circular arrow icon in the top-right of the admin) after:
- Creating, editing, or deleting a **Dependency Group** or **Dependency Entry**
- Changing a **compatibility range** on a dependency
- Any change that should be reflected in the main project-generator UI (the dependency picker)

You do **not** need to restart the server. Refresh is instant and safe to run at any time.

### What Refresh Does NOT Affect
File contributions and build customizations are read fresh from the database on every generation request — they are not cached. So changes to those take effect immediately with no Refresh needed.`,
        callouts: [
          {
            type: 'warning',
            text: 'If you add a new dependency entry but forget to click Refresh, the dependency will not appear in the UI dependency picker until the cache is invalidated.'
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 2. FRONTEND GENERATOR (React + TS + Vite + FSD)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'frontend-generator',
    title: 'Frontend Generator',
    icon: 'web',
    topics: [
      {
        id: 'fe-what',
        title: 'What Is the Frontend Generator?',
        description: 'A second generator that scaffolds React + TypeScript + Vite projects using Feature-Slice Design.',
        content: `### Purpose
The same DB-driven catalog that produces Spring Boot backends also produces **React + TypeScript + Vite** frontends laid out with [Feature-Slice Design](https://feature-sliced.design/). Developers pick a project name, an npm scope, dependencies, sub-options, and click Generate — the response is a zipped frontend project ready to \`pnpm install && pnpm dev\`.

A new top-level **Frontend** tab in the main UI sits beside **Backend / Training / Guide / Config**. The same admin panel manages both catalogs side by side.

### Why a Second Path Instead of Reusing the Spring One?
The Spring Initializr framework is Maven/Gradle-hardcoded — it can't emit \`package.json\` or \`vite.config.ts\`. So the FE path skips the framework entirely. \`FrontendStarterController\` is a plain Spring REST controller that calls a new \`FrontendProjectGenerator\` service, which builds a temp directory exactly like the backend does, then zips it.

Crucially, the FE path **reuses** everything that's not build-tool-specific: \`DependencyConfigService\`, the \`FileContributionEntity\` table (with all four types — STATIC_COPY, TEMPLATE, YAML_MERGE, DELETE), \`ProjectOptionsContext\` for sub-options, the \`InitializrWebConfiguration\` servlet filter, and the same Mustache engine with the same context conventions (\`has<Dep>\`, \`opt<Dep><Option>\`).

### The ProjectKind Discriminator
Every row in the six catalog tables now has a \`project_kind\` column (\`BACKEND\` or \`FRONTEND\`). Backend and frontend catalogs live in the same H2 database but never see each other — \`DependencyConfigService\` filters by kind at query time. Existing rows default to \`BACKEND\` so this is fully backwards-compatible.`,
        callouts: [
          {
            type: 'info',
            text: 'The FE path **does not** go through the Spring Initializr framework. Endpoints live under `/frontend/*`, separate from `/starter.zip`. The Frontend tab in the UI talks to `/frontend/metadata` and `/frontend/starter.zip`.'
          }
        ]
      },
      {
        id: 'fe-using',
        title: 'Using the Frontend Tab',
        description: 'What a developer sees and fills in when generating a React project.',
        content: `### Left Column — Project + Stack
- **Project Name** — folder name and \`package.json "name"\`. Auto-derives the App Title in title case.
- **Scope** (optional) — npm scope without the \`@\`. \`menora\` + \`my-app\` becomes \`@menora/my-app\` in \`package.json\`.
- **App Title** — appears in \`<title>\` and the sample \`HomePage\`.
- **Description** — \`package.json "description"\`.
- **React** — version dropdown (18 / 19), default from \`application.yml\`.
- **Node** — version dropdown (18 / 20 / 22).
- **Package Manager** — pill toggle: \`npm\` or \`pnpm\`. Shapes the README run instructions via the \`isNpm\` / \`isPnpm\` Mustache flags.
- **Base Path** — Vite's \`base\` config for sub-path deploys (defaults to \`/\`).

### Right Column — Dependencies
Same chip + grouped-list pattern as the backend tab. Each dependency can expose sub-options that surface as nested checkboxes after the parent is selected. Filter box at the top searches across id, name, and description.

### Generate
The Generate button on the FrontendView is wired to \`/frontend/starter.zip\` with all the form values + the selected dependencies and per-dep \`opts-{depId}\` lists. The file streams to the browser as \`{projectName}.zip\`.

### State Persistence
Every change to the form, selections, or sub-options is written to \`localStorage\` under \`frontendInitializrState\` — refresh the page and the state restores. The "Reset to defaults" link clears it.`,
        callouts: [
          {
            type: 'tip',
            text: 'The Frontend tab does **not** share state, presets, or recents with the Backend tab. They are independent. Backend continues to use `useProjectState`; frontend uses the parallel `useFrontendState` hook.'
          }
        ]
      },
      {
        id: 'fe-admin-pill',
        title: 'Admin: The Backend ⇄ Frontend Pill',
        description: 'How the admin header toggle scopes every tab to one catalog.',
        content: `### Where to Find It
Open Config (Admin). The header now has a small pill toggle: **Backend** | **Frontend**. The current kind is persisted to \`localStorage\` so it survives a page reload.

### What It Affects
Six tabs filter their rows by the current pill value and stamp \`projectKind\` on every new entry:
- **Dep Groups** — categories shown in the picker
- **Dependencies** — the catalog entries
- **File Contribs** — STATIC_COPY / TEMPLATE / YAML_MERGE / DELETE rows
- **Build Customizations** — including the two new FE-only types below
- **Sub-Options** — gated per-dep selections
- **Compatibility** — REQUIRES / CONFLICTS / RECOMMENDS rules

### What It Doesn't Affect
- **Overview** and **Activity** show data across both kinds.
- **Templates** (starter bundles) and **Modules** (multi-module) are backend-only in v1.

### Legacy Rows
Existing rows without a \`projectKind\` are treated as \`BACKEND\` by the client filter (the DB default takes care of the same on the server side). No backfill needed.`,
        callouts: [
          {
            type: 'warning',
            text: 'If you create a row under the wrong pill — say you add `state-zustand` while the pill is on Backend — it will appear in `/metadata/client` (Spring catalog) and break the backend pipeline at generation time. Always confirm the pill before clicking **New Entry**.'
          }
        ]
      },
      {
        id: 'fe-build-types',
        title: 'Three New Build Customization Types',
        description: 'ADD_NPM_DEPENDENCY, ADD_NPM_SCRIPT, and ADD_VITE_PLUGIN — reusing existing fields with new meanings.',
        content: `### Schema Reuse
Rather than adding a new entity, the existing \`BuildCustomizationEntity\` gained three enum values. Its columns are **reinterpreted** based on the \`projectKind\` + \`customizationType\` combination. Field meaning per row:

| Type | Field reinterpretation |
|---|---|
| \`ADD_NPM_DEPENDENCY\` | \`mavenArtifactId\` = npm package name (e.g. \`react-router-dom\`); \`version\` = semver range (e.g. \`^6.26.0\`); \`scope\` = \`"dev"\` → goes to \`devDependencies\`, anything else → \`dependencies\` |
| \`ADD_NPM_SCRIPT\` | \`mavenArtifactId\` = script name (e.g. \`lint:fix\`); \`version\` = command (e.g. \`eslint . --fix\`). Later rows with the same name override earlier ones, so admins can replace baseline scripts without editing the template |
| \`ADD_VITE_PLUGIN\` | \`mavenGroupId\` = import path (e.g. \`@vitejs/plugin-react\`); \`mavenArtifactId\` = import binding (e.g. \`react\`); \`version\` = call expression (e.g. \`react()\`) |

### How They're Applied
- **\`PackageJsonBuilder\`** loads the baseline \`templates/frontend/fe-package-base.mustache\`, renders it through Mustache, parses to Jackson tree, then walks all \`ADD_NPM_DEPENDENCY\` rows (into \`dependencies\` / \`devDependencies\`) and \`ADD_NPM_SCRIPT\` rows (into \`scripts\`). Keys are alphabetised within each block for stable diffs.
- **\`ViteConfigBuilder\`** loads \`templates/frontend/fe-vite-config.mustache\`, collects unique imports and the plugin-call list from \`ADD_VITE_PLUGIN\` rows, exposes them as \`{{vitePluginImports}}\` and \`{{vitePluginCalls}}\` in the Mustache context, and renders.

### Always-On Packages & Scripts
The \`__common__\` dependency carries the baseline npm deps every project gets — \`react\`, \`react-dom\`, \`typescript\`, \`vite\`, \`@vitejs/plugin-react\`, plus the always-on quality stack (\`eslint\`, \`prettier\`, \`husky\`, \`lint-staged\`, and friends). It also seeds the universally-useful scripts \`lint:fix\`, \`format:check\`, and \`typecheck\` via \`ADD_NPM_SCRIPT\` rows. The \`@vitejs/plugin-react\` row is the single \`__common__\` \`ADD_VITE_PLUGIN\` row.

### Kind-Aware Admin Form
The **Build Customizations** drawer now reads the Backend ⇄ Frontend pill. In Frontend mode the type dropdown only offers the three FE types and the field labels match the domain — *Package Name*, *Script Name*, *Command*, *Import Path*, *Import Binding*, *Plugin Call* — instead of the underlying \`mavenArtifactId\` / \`mavenGroupId\` columns. The DB row is unchanged; only the form translates.`,
        callouts: [
          {
            type: 'tip',
            text: 'Adding a new npm package via the admin is one row: switch the pill to **Frontend**, open **Build Customizations → New Customization**, pick `ADD_NPM_DEPENDENCY`, fill **Package Name** and **Version**, tick **devDependency?** if it belongs in `devDependencies`. Hit Save, then `POST /admin/refresh`.'
          }
        ]
      },
      {
        id: 'fe-structure',
        title: 'What Gets Generated',
        description: 'Every project ships with these files — regardless of dependency selection.',
        content: `### Baseline Layout
Every generated frontend project includes:

- **Build & config** — \`package.json\`, \`vite.config.ts\`, \`tsconfig.json\`, \`tsconfig.node.json\` with \`@app/@pages/@widgets/@features/@entities/@shared\` path aliases mapped in both Vite and TypeScript.
- **Entry** — \`index.html\` (\`{{appTitle}}\` substituted), \`src/main.tsx\` mounting \`<App/>\` from \`@app/App\`, and a working \`HomePage\` under \`src/pages/home/ui/\` so \`pnpm dev\` shows something the moment install finishes.
- **Quality** — \`eslint.config.js\` (flat config, TS + React + react-hooks + react-refresh), \`.prettierrc.json\`, \`.husky/pre-commit\` running \`lint-staged\`. Always on.
- **CI / deploy** — multi-stage \`Dockerfile\` (node → nginx), \`nginx.conf\` with SPA fallback, \`Jenkinsfile\`, \`.dockerignore\`.
- **All 6 FSD layers** — \`src/app\`, \`src/pages\`, \`src/widgets\`, \`src/features\`, \`src/entities\`, \`src/shared\` — each with a barrel \`index.ts\` and a short \`README.md\` explaining the layer's place in the FSD import hierarchy.

### Dependency-Driven Files
- **\`style-tailwind\`** → \`tailwind.config.js\`, \`postcss.config.js\`, \`src/index.css\` with the three \`@tailwind\` directives. \`src/main.tsx\` conditionally imports the CSS via \`{{#hasStyleTailwind}}…{{/hasStyleTailwind}}\`.
- **\`test-vitest-rtl\`** → \`vitest.config.ts\`, \`src/test-setup.ts\`. \`package.json\` gains \`test\`, \`test:ui\`, \`coverage\` scripts gated on \`{{#hasTestVitestRtl}}\`.
- Everything else is currently npm-deps-only — the user wires the library into \`App.tsx\` themselves. Adding generated wiring is a per-dep file-contribution row away.`,
        callouts: [
          {
            type: 'info',
            text: 'Mustache and JSX both use `{{` as a token opener — inline-style objects like `style={{ color: "red" }}` collide. The seeded `HomePage.tsx` lifts inline styles to a top-level `const`, which is the cleanest workaround. If you author a TEMPLATE row that needs JSX double braces, use the same pattern.'
          }
        ]
      },
      {
        id: 'fe-curl',
        title: 'API Reference (curl)',
        description: 'Calling /frontend/metadata and /frontend/starter.zip directly.',
        content: `### Metadata
\`\`\`bash
curl http://localhost:8080/frontend/metadata | python -m json.tool | head -60
\`\`\`

Returns the form defaults, the React/Node/package-manager dropdowns, the pinned TS/Vite versions, and the FRONTEND-kind catalog (groups → entries → sub-options).

### Generate
\`\`\`bash
curl -o demo.zip "http://localhost:8080/frontend/starter.zip?\\
projectName=demo&appTitle=Demo&scope=menora&\\
reactVersion=18&nodeVersion=20&packageManager=pnpm&\\
dependencies=router-react-router,state-zustand,style-tailwind,test-vitest-rtl&\\
opts-state-zustand=sample-store&\\
opts-router-react-router=lazy-routes,sample-routes"

unzip -l demo.zip
\`\`\`

Sub-options follow the same \`opts-{depId}=opt1,opt2\` convention as the backend path; the existing \`InitializrWebConfiguration\` servlet filter populates \`ProjectOptionsContext\` for every request that hits the app, so frontend endpoints get sub-options for free.`,
      },
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 3. DEPENDENCY GROUPS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'dep-groups',
    title: 'Dependency Groups',
    icon: 'folder',
    topics: [
      {
        id: 'dep-groups-what',
        title: 'What Are Groups?',
        description: 'Groups organize dependencies into labeled categories in the UI.',
        content: `### Purpose
Dependency groups are purely organizational — they do not affect what gets generated. They exist to group related dependencies under a heading in the dependency picker (e.g. "Data", "Messaging", "Security").

### Out-of-the-Box Groups
The system seeds the following groups on first startup: **Menora Standards**, **Web**, **Data**, **Messaging**, **Security**, **Observability**, **Logging**, and **Communication**.

### Ordering
Groups appear in the dependency picker in \`sortOrder\` ascending order. Use the **drag-to-reorder** feature in the Dependency Groups admin tab — drag a row to the desired position, then click **Save Order**.`,
        fields: [
          { name: 'name', type: 'string', required: true, description: 'Display name shown as a section heading in the dependency picker. Must be unique.', example: 'Data' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'Ascending sort order. Lower values appear first. Managed via drag-to-reorder.', example: '2' }
        ]
      },
      {
        id: 'dep-groups-manage',
        title: 'Creating & Deleting Groups',
        description: 'How to add, edit, reorder, and safely delete groups.',
        content: `### Creating a Group
1. Go to **Config → Dependency Groups** tab.
2. Click **+ Add Group**.
3. Enter the **name** and an optional initial sort order.
4. Click **Save**.
5. Click **Refresh** so the new group appears in the metadata.

### Editing a Group
Click the pencil icon on any row to open the edit drawer. Change the name, save, then click **Refresh**.

### Reordering Groups
Click and drag the grip handle (⠿) on the left of any row to reorder. A **Save Order** button appears — click it to persist the new sequence.

### Deleting a Group
Click the trash icon. If the group contains dependencies, you will see a **conflict warning** listing the orphaned entries. You can either:
- **Cancel** and delete or move the dependencies first, or
- Check **Force delete** to cascade-delete all child dependencies (and their associated file contributions, build customizations, etc.).`,
        callouts: [
          {
            type: 'warning',
            text: 'Force-deleting a group permanently removes all its child dependencies and every file contribution, build customization, and sub-option attached to them. This cannot be undone.'
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 3. DEPENDENCY ENTRIES
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'dep-entries',
    title: 'Dependency Entries',
    icon: 'widgets',
    topics: [
      {
        id: 'dep-entries-what',
        title: 'What Are Dependencies?',
        description: 'Dependencies are the selectable items in the project generator.',
        content: `### Role in the System
A dependency entry represents a selectable library or feature in the project generator. When a developer selects "Kafka", they are selecting the entry with \`depId = "kafka"\`. That ID is then used as the foreign key for:

- **File Contributions** — files to write into the project
- **Build Customizations** — Maven dependency/repository additions
- **Sub-Options** — optional extras within this dependency
- **Compatibility Rules** — relationships with other dependencies

### Maven Coordinates Are Optional
Not every dependency entry needs Maven coordinates. Sometimes a dependency is just a configuration trigger — it causes files and build customizations to be injected but doesn't itself add a Maven artifact. In that case leave \`mavenGroupId\` / \`mavenArtifactId\` blank.

### The Dependency Picker
Entries appear in the dependency picker grouped by their parent group. The user's selection is the set of \`depId\` values sent in the generation request as the \`dependencies\` query parameter.`
      },
      {
        id: 'dep-entries-fields',
        title: 'Field Reference',
        description: 'Every field on a dependency entry explained.',
        content: `### All Fields`,
        fields: [
          { name: 'depId', type: 'string', required: true, description: 'Unique machine-readable identifier. Used as the foreign key in file contributions, build customizations, sub-options, and compatibility rules. Must be lowercase, no spaces. Cannot be changed after creation without re-linking all related records.', example: 'kafka' },
          { name: 'name', type: 'string', required: true, description: 'Human-readable display name shown in the dependency picker.', example: 'Apache Kafka' },
          { name: 'description', type: 'string', required: false, description: 'Short description shown as a tooltip or sub-text in the dependency picker.', example: 'Distributed event streaming via Apache Kafka' },
          { name: 'group', type: 'DependencyGroup', required: true, description: 'The group this dependency belongs to. Determines which section of the picker it appears in.', example: 'Messaging' },
          { name: 'mavenGroupId', type: 'string', required: false, description: 'Maven group ID. If provided, this artifact will be added to the generated pom.xml.', example: 'org.springframework.kafka' },
          { name: 'mavenArtifactId', type: 'string', required: false, description: 'Maven artifact ID.', example: 'spring-kafka' },
          { name: 'version', type: 'string', required: false, description: 'Explicit Maven version. Leave blank to rely on Spring Boot BOM version management.', example: '3.1.0' },
          { name: 'scope', type: 'string', required: false, description: 'Maven scope. Leave blank for compile (default). Options: runtime, provided, test, import.', example: 'runtime' },
          { name: 'repository', type: 'string', required: false, description: 'Repository ID if the artifact is not in Maven Central. Must match a repository ID defined in application.yml or via a BuildCustomization ADD_REPOSITORY.', example: 'menora-release' },
          { name: 'compatibilityRange', type: 'string', required: false, description: 'Spring Boot version range. If set, the dependency is hidden in the UI when the selected Boot version is outside this range. Blank means compatible with all versions.', example: '[3.2.0,4.0.0)' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'Display order within the group. Lower values appear first.', example: '0' }
        ],
        codeExamples: [
          {
            title: 'Compatibility Range Syntax',
            language: 'text',
            code: `[3.2.0,4.0.0)   Boot >= 3.2.0 AND < 4.0.0  (inclusive lower, exclusive upper)
3.2.0           Boot >= 3.2.0              (open upper bound)
[3.2.0,3.3.0]   Boot >= 3.2.0 AND <= 3.3.0 (inclusive both ends)
                (blank)  Compatible with all Boot versions`
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 4. FILE CONTRIBUTIONS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'file-contributions',
    title: 'File Contributions',
    icon: 'description',
    topics: [
      {
        id: 'file-contrib-types',
        title: 'File Types',
        description: 'The four modes a file contribution can operate in.',
        content: `### STATIC_COPY
Writes the content verbatim to the target path. No modification, no substitution (even if substitutionType is set). Used for binary-compatible text files that should always be identical regardless of project settings.

**Example use cases:** \`.editorconfig\`, \`entrypoint.sh\`, \`settings.xml\`, \`log4j2-spring.xml\`

### YAML_MERGE
Deep-merges the YAML content into the target file. If the target file doesn't exist yet, it is created. If it already has content (from a previous contribution or the framework), the new YAML is merged into it key-by-key, with nested maps recursively merged and scalar values overwritten.

This is the primary way multiple dependencies each contribute their section to \`application.yaml\` without overwriting each other.

**Example use cases:** Kafka bootstrap-servers section, JPA datasource section, management endpoints config.

### TEMPLATE
Applies variable substitution to the content, then writes it to the target path. When \`substitutionType\` is MUSTACHE, the content is rendered through a real Mustache engine (\`com.samskivert:jmustache\`), giving you both variable substitution and conditional sections (see below).

**Example use cases:** \`Dockerfile\` (needs artifactId), \`KafkaConfig.java\` (needs package name), \`k8s/values.yaml\` (needs groupId).

### DELETE
Marks a file for deletion. The delete contributor runs at the lowest priority (after all writes), so it removes files that the framework or earlier contributors wrote. No \`content\` field is needed.

**Example use case:** The Spring Initializr framework always writes \`application.properties\`. Menora projects use \`application.yaml\`, so a DELETE contribution removes the unwanted \`application.properties\`.`,
        callouts: [
          {
            type: 'tip',
            text: 'Use YAML_MERGE for all application.yaml config. This lets multiple dependencies each contribute their own section without conflicting — the merge engine handles combining them.'
          }
        ]
      },
      {
        id: 'file-contrib-substitution',
        title: 'Template Substitution (Mustache)',
        description: 'Variables, sections, and conditional content available in TEMPLATE file contributions.',
        content: `### Substitution Types

\`TEMPLATE\` contributions are rendered through a real Mustache engine (\`com.samskivert:jmustache\`, with HTML escaping disabled). The \`substitutionType\` field has two values:

- **NONE** — no substitution. Content is written verbatim. Use for binary-identical files (log4j2 XML, .editorconfig, entrypoint.sh).
- **MUSTACHE** — content is rendered through jmustache with the unified context below. This is the default for any template with variables or conditional blocks.

### The Unified Context
Every MUSTACHE template receives the same context. **Variables** render as text; **sections** (\`{{#name}}…{{/name}}\`) render their body only when the named value is truthy; **inverted sections** (\`{{^name}}…{{/name}}\`) render only when it is falsy/absent.

**Project variables:**
- \`{{artifactId}}\` — project artifact ID (e.g. \`demo\`)
- \`{{groupId}}\` — project group ID (e.g. \`com.menora\`)
- \`{{version}}\` — project version (e.g. \`0.0.1-SNAPSHOT\`)
- \`{{packageName}}\` — base package (e.g. \`com.menora.demo\`)
- \`{{packagePath}}\` — package name with dots replaced by slashes (e.g. \`com/menora/demo\`)
- \`{{javaVersion}}\` — the JDK the user picked, e.g. \`17\` or \`21\`
- \`{{packaging}}\` — \`jar\` or \`war\`

**Dependency booleans** — \`has\` + PascalCase(depId). Hyphens, underscores, and dots are word separators:
- \`{{#hasKafka}}…{{/hasKafka}}\` — dep id \`kafka\`
- \`{{#hasSecurity}}…{{/hasSecurity}}\` — dep id \`security\`
- \`{{#hasMailSampler}}…{{/hasMailSampler}}\` — dep id \`mail-sampler\`

**Sub-option booleans** — \`opt\` + PascalCase(depId) + PascalCase(optionId):
- \`{{#optKafkaConsumerExample}}…{{/optKafkaConsumerExample}}\` — kafka + \`consumer-example\` sub-option
- \`{{#optMailSamplerSendMail}}…{{/optMailSamplerSendMail}}\` — mail-sampler + \`send-mail\` sub-option

### Target Path Variables
The **target path** (not just the content) may contain \`{{packagePath}}\`, which is the package name with dots replaced by slashes. This places Java source files in the correct directory regardless of the user's package choice.

**Example:** target path \`src/main/java/{{packagePath}}/config/KafkaConfig.java\` becomes \`src/main/java/com/menora/demo/config/KafkaConfig.java\` for package \`com.menora.demo\`.

### Why Conditional Sections Matter
Before Mustache sections, each variation needed its own file contribution row. A class that emits \`@EnableAsync\` only when the async sub-option was selected required two rows with the same \`targetPath\` — one with the annotation, one without. Mustache sections collapse these into one row, keeping the DB catalog simpler and easier to maintain.`,
        codeExamples: [
          {
            title: 'Variables — Dockerfile example',
            language: 'dockerfile',
            code: `FROM eclipse-temurin:{{javaVersion}}-jre-alpine
WORKDIR /app
COPY target/{{artifactId}}-{{version}}.jar app.jar
LABEL org.opencontainers.image.vendor="{{groupId}}"
ENTRYPOINT ["java", "-jar", "app.jar"]`
          },
          {
            title: 'Dependency gate — MessagingConfig.java',
            language: 'java',
            code: `package {{packageName}}.config;

import org.springframework.context.annotation.Configuration;
{{#hasKafka}}
import org.springframework.kafka.annotation.EnableKafka;
{{/hasKafka}}

@Configuration
{{#hasKafka}}
@EnableKafka
{{/hasKafka}}
public class MessagingConfig {
    {{^hasKafka}}
    // Kafka not selected — no messaging infrastructure wired.
    {{/hasKafka}}
}`
          },
          {
            title: 'Sub-option gate — conditional @KafkaListener example',
            language: 'java',
            code: `package {{packageName}}.kafka;

{{#optKafkaConsumerExample}}
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class KafkaConsumerExample {
    @KafkaListener(topics = "demo-topic", groupId = "{{artifactId}}")
    public void listen(String message) {
        System.out.println("Received: " + message);
    }
}
{{/optKafkaConsumerExample}}
{{^optKafkaConsumerExample}}
// Enable the "Consumer Example" sub-option to generate a sample @KafkaListener.
{{/optKafkaConsumerExample}}`
          },
          {
            title: 'application.yaml — combine dep gates + variables',
            language: 'yaml',
            code: `spring:
  application:
    name: {{artifactId}}
{{#hasDataJpa}}
  datasource:
    url: jdbc:h2:mem:{{artifactId}}
    username: sa
{{/hasDataJpa}}
{{#hasActuator}}
management:
  endpoints:
    web:
      exposure:
        include: health,info{{#hasSecurity}},metrics{{/hasSecurity}}
{{/hasActuator}}

# Generated for {{packaging}} packaging on Java {{javaVersion}}.`
          }
        ],
        callouts: [
          {
            type: 'tip',
            text: 'Unknown variables render as empty strings — a typo in {{hasKafak}} silently produces nothing. Grep your templates when onboarding a new dep to sanity-check references.'
          },
          {
            type: 'info',
            text: 'Standalone section tags ({{#name}} / {{/name}} on their own line) strip surrounding whitespace by Mustache spec, keeping generated Java clean. Put content on the same line as the tag if you need a literal newline preserved.'
          }
        ]
      },
      {
        id: 'file-contrib-common',
        title: 'The __common__ Dependency',
        description: 'How to contribute files to every generated project.',
        content: `### What __common__ Means
When a file contribution's \`dependencyId\` is set to \`__common__\`, it is injected into **every** generated project, regardless of which dependencies the developer selected.

This is how Menora ensures all projects always have:
- \`Dockerfile\` (templated with artifactId, version-specific per JDK)
- \`Jenkinsfile\` (templated with project metadata)
- \`k8s/values.yaml\` (templated with groupId/artifactId)
- \`entrypoint.sh\` (static copy)
- \`.editorconfig\` (static copy)
- \`VERSION\` (templated with version)
- \`log4j2-spring.xml\` (static copy)
- Deletion of \`application.properties\` (DELETE type)

### When to Use __common__
Use \`__common__\` when the file should exist in every project. Use a specific \`depId\` when the file is only relevant when that dependency is selected.`,
        callouts: [
          {
            type: 'info',
            text: 'Build customizations (add dependency, add repository) also support __common__. This is how the Artifactory repositories and the log4j2 dependency replacement are added to all projects.'
          }
        ]
      },
      {
        id: 'file-contrib-filtering',
        title: 'Java Version & Sub-Option Filtering',
        description: 'How to make a file conditional on Java version or a sub-option.',
        content: `### javaVersion Field
If a file contribution has a non-blank \`javaVersion\`, it will only be included when the project's selected Java version matches exactly.

This allows you to have multiple versions of the same file for different JDKs. For example, the \`Dockerfile\` uses a Java 17 base image vs. a Java 21 base image.

**How to set up version-specific files:**
1. Create one contribution with \`targetPath = "Dockerfile"\`, \`javaVersion = "17"\`, and the Java 17 image content.
2. Create another with the same \`targetPath\`, \`javaVersion = "21"\`, and the Java 21 image content.
3. Leave \`javaVersion\` blank if you want a file for all versions.

### subOptionId Field
If a file contribution has a non-blank \`subOptionId\`, it will only be included when the user has selected that sub-option for the parent dependency.

**Example:** The \`KafkaConsumerExample.java\` file has \`subOptionId = "consumer-example"\` and \`dependencyId = "kafka"\`. It only appears when the user selects the "Consumer Example" sub-option under the Kafka dependency.`,
        fields: [
          { name: 'dependencyId', type: 'string', required: true, description: 'The depId of the parent dependency, or `__common__` for all projects.', example: 'kafka' },
          { name: 'fileType', type: 'FileType', required: true, description: 'How the content is handled: STATIC_COPY, YAML_MERGE, TEMPLATE, or DELETE.', example: 'YAML_MERGE' },
          { name: 'targetPath', type: 'string', required: true, description: 'Output path within the generated project. May contain {{packagePath}} for Java source files.', example: 'src/main/java/{{packagePath}}/config/KafkaConfig.java' },
          { name: 'content', type: 'text', required: false, description: 'File content. Not needed for DELETE type. For TEMPLATE type, use substitution variables.', example: 'package {{packageName}}.config;' },
          { name: 'substitutionType', type: 'SubstitutionType', required: false, description: 'Variable substitution mode: NONE (content written verbatim) or MUSTACHE (renders with jmustache — variables {{artifactId}}, {{groupId}}, {{version}}, {{packageName}}, {{packagePath}}, {{javaVersion}}, {{packaging}}, and boolean sections such as {{#hasKafka}}…{{/hasKafka}} or {{#optKafkaConsumerExample}}…{{/optKafkaConsumerExample}}).', example: 'MUSTACHE' },
          { name: 'javaVersion', type: 'string', required: false, description: 'If set, this contribution only applies when the project Java version matches. Leave blank for all versions.', example: '21' },
          { name: 'subOptionId', type: 'string', required: false, description: 'If set, this contribution only applies when the user selects this sub-option under the parent dependency.', example: 'consumer-example' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'Processing order. Matters when multiple contributions target the same file (e.g. multiple YAML_MERGE into the same application.yaml).', example: '0' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 5. BUILD CUSTOMIZATIONS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'build-customizations',
    title: 'Build Customizations',
    icon: 'build',
    topics: [
      {
        id: 'build-custom-types',
        title: 'Customization Types',
        description: 'The three types of Maven pom.xml modifications.',
        content: `### ADD_DEPENDENCY
Adds a Maven \`<dependency>\` entry to the generated \`pom.xml\`. Requires \`mavenGroupId\` and \`mavenArtifactId\`. Version and scope are optional (BOM-managed dependencies don't need a version).

**Example use cases:**
- Adding \`spring-boot-starter-log4j2\` as a replacement for Logback
- Adding \`lombok\` to every project
- Adding \`spring-boot-starter-mail\` when the mail-sampler dependency is selected

### EXCLUDE_DEPENDENCY
Adds a Maven \`<exclusion>\` to an existing dependency. Used to remove transitive dependencies that conflict with your additions.

Requires:
- \`excludeFromGroupId\` + \`excludeFromArtifactId\` — the artifact to add the exclusion to
- \`mavenGroupId\` + \`mavenArtifactId\` — the transitive dependency to exclude

**Example use case:** Excluding \`spring-boot-starter-logging\` (Logback) from \`spring-boot-starter\` so it doesn't conflict with Log4j2.

### ADD_REPOSITORY
Adds a Maven \`<repository>\` entry to the generated \`pom.xml\`. The \`repoId\` must be unique and is used as the XML \`<id>\`.

**Example use case:** Adding the Menora Artifactory release and snapshot repositories so the generated project can resolve internal artifacts.`,
        fields: [
          { name: 'dependencyId', type: 'string', required: true, description: 'The depId of the parent dependency, or `__common__` to apply to all projects.', example: '__common__' },
          { name: 'customizationType', type: 'CustomizationType', required: true, description: 'ADD_DEPENDENCY, EXCLUDE_DEPENDENCY, or ADD_REPOSITORY.', example: 'ADD_DEPENDENCY' },
          { name: 'mavenGroupId', type: 'string', required: false, description: 'For ADD_DEPENDENCY: the artifact group. For EXCLUDE_DEPENDENCY: the group of the transitive dependency to exclude.', example: 'org.springframework.boot' },
          { name: 'mavenArtifactId', type: 'string', required: false, description: 'For ADD_DEPENDENCY: the artifact ID. For EXCLUDE_DEPENDENCY: the artifact ID of the dependency to exclude.', example: 'spring-boot-starter-log4j2' },
          { name: 'version', type: 'string', required: false, description: 'Maven version for ADD_DEPENDENCY. Leave blank if managed by the Spring Boot BOM.', example: '' },
          { name: 'excludeFromGroupId', type: 'string', required: false, description: 'EXCLUDE_DEPENDENCY only: group ID of the artifact to add the exclusion block to.', example: 'org.springframework.boot' },
          { name: 'excludeFromArtifactId', type: 'string', required: false, description: 'EXCLUDE_DEPENDENCY only: artifact ID to add the exclusion block to.', example: 'spring-boot-starter' },
          { name: 'repoId', type: 'string', required: false, description: 'ADD_REPOSITORY: unique repository ID (used as <id> in pom.xml).', example: 'menora-release' },
          { name: 'repoName', type: 'string', required: false, description: 'ADD_REPOSITORY: human-readable repository name.', example: 'Menora Artifactory Releases' },
          { name: 'repoUrl', type: 'string', required: false, description: 'ADD_REPOSITORY: repository URL.', example: 'https://repo.menora.co.il/artifactory/libs-release' },
          { name: 'snapshotsEnabled', type: 'boolean', required: false, description: 'ADD_REPOSITORY: whether to enable snapshot resolution from this repository. Default: false.', example: 'false' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'Processing order within customizations for the same dependency.', example: '0' }
        ],
        codeExamples: [
          {
            title: 'Example: Replace Logback with Log4j2 (two records needed)',
            language: 'text',
            code: `Record 1 — EXCLUDE_DEPENDENCY
  dependencyId:         __common__
  excludeFromGroupId:   org.springframework.boot
  excludeFromArtifactId: spring-boot-starter
  mavenGroupId:         org.springframework.boot
  mavenArtifactId:      spring-boot-starter-logging

Record 2 — ADD_DEPENDENCY
  dependencyId:         __common__
  mavenGroupId:         org.springframework.boot
  mavenArtifactId:      spring-boot-starter-log4j2`
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 6. SUB-OPTIONS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'sub-options',
    title: 'Sub-Options',
    icon: 'tune',
    topics: [
      {
        id: 'sub-options-what',
        title: 'What Are Sub-Options?',
        description: 'Optional feature flags within a dependency.',
        content: `### Concept
Sub-options let users select optional extras when they pick a dependency. For example, selecting Kafka reveals checkboxes for "Consumer Example" and "Producer Example" — these generate sample consumer/producer classes in the project.

Sub-options are purely additive: they gate additional file contributions. They do not add Maven artifacts on their own (though you could attach build customizations to the same \`depId\` if needed, using the file contribution's \`subOptionId\` to conditionally trigger them — though typically the gate is only on the file side).

### URL Convention
Sub-options are passed to the generation endpoint as query parameters:

\`opts-{depId}=opt1,opt2\`

For example: \`opts-kafka=consumer-example,producer-example\`

The frontend automatically constructs these parameters when the user checks sub-option boxes.

### How Sub-Options Gate Files
In a file contribution, set \`subOptionId\` to the \`optionId\` of the sub-option. That file will only be written if the corresponding \`opts-{depId}\` parameter includes that optionId.`,
        fields: [
          { name: 'dependencyId', type: 'string', required: true, description: 'The depId of the parent dependency this sub-option belongs to.', example: 'kafka' },
          { name: 'optionId', type: 'string', required: true, description: 'Unique identifier for this sub-option within the dependency. Used in URL params and as the foreign key in file contributions.', example: 'consumer-example' },
          { name: 'label', type: 'string', required: true, description: 'Display label shown next to the checkbox in the UI.', example: 'Consumer Example' },
          { name: 'description', type: 'string', required: false, description: 'Tooltip or help text explaining what this sub-option generates.', example: 'Generates a sample @KafkaListener class' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'Display order among sub-options for the same dependency.', example: '0' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 7. COMPATIBILITY RULES
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'compatibility',
    title: 'Compatibility Rules',
    icon: 'compare_arrows',
    topics: [
      {
        id: 'compat-types',
        title: 'Rule Types',
        description: 'REQUIRES, CONFLICTS, and RECOMMENDS explained.',
        content: `### REQUIRES
Source dependency **requires** the target dependency. When the user selects the source, the target is automatically added. The user cannot deselect the target while the source is selected.

**Example:** \`rqueue REQUIRES data-jpa\` — RQueue needs JPA to manage its message queues in the database.

### CONFLICTS
Source and target dependencies are **mutually exclusive**. The UI prevents the user from selecting both simultaneously.

**Example:** \`web CONFLICTS webflux\` — You can't use traditional Servlet-based Spring MVC alongside reactive WebFlux in the same project.

### RECOMMENDS
Source dependency **recommends** the target. The UI shows a suggestion to the user, but they are free to ignore it.

**Example:** \`data-jpa RECOMMENDS postgresql\` — JPA needs a database driver; PostgreSQL is the company standard.`,
        fields: [
          { name: 'sourceDepId', type: 'string', required: true, description: 'The depId of the dependency that defines the rule (the "source").', example: 'rqueue' },
          { name: 'targetDepId', type: 'string', required: true, description: 'The depId of the dependency the rule applies to (the "target").', example: 'data-jpa' },
          { name: 'relationType', type: 'RelationType', required: true, description: 'REQUIRES, CONFLICTS, or RECOMMENDS.', example: 'REQUIRES' },
          { name: 'description', type: 'string', required: false, description: 'Human-readable explanation of why this rule exists. Shown in the Compatibility graph tooltip.', example: 'RQueue uses JPA to persist message queue state' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'Display order in the admin list and graph.', example: '0' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 8. STARTER TEMPLATES
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'starter-templates',
    title: 'Starter Templates',
    icon: 'view_cozy',
    topics: [
      {
        id: 'starter-what',
        title: 'What Are Starter Templates?',
        description: 'Pre-configured project blueprints for the Quick Start section.',
        content: `### Purpose
Starter templates are one-click project presets that appear in the **Quick Start** section of the generator. Clicking a template pre-fills the project form with a curated set of dependencies (and sub-options). The user can still adjust the selection before generating.

### Out-of-the-Box Templates
- **REST API Service** — Spring Web, JPA, PostgreSQL, Actuator
- **Event-Driven Service** — Kafka (with consumer + producer examples), JPA
- **Microservice (Full Stack)** — Web, Kafka, JPA, Security, Actuator, Prometheus

### Template vs. Direct Generation
A template only pre-selects dependencies. If the user changes the dependency selection after clicking a template, the generated output reflects their final selection, not the template definition.`,
        fields: [
          { name: 'templateId', type: 'string', required: true, description: 'Unique machine-readable identifier. Shown in the URL when sharing a template link.', example: 'rest-api' },
          { name: 'name', type: 'string', required: true, description: 'Display name shown on the template card.', example: 'REST API Service' },
          { name: 'description', type: 'string', required: false, description: 'Short description shown below the template name.', example: 'Spring Web + JPA + PostgreSQL + Actuator' },
          { name: 'icon', type: 'string', required: false, description: 'Material Symbols icon name (e.g. "api", "bolt", "hub"). See Material Symbols library for available names.', example: 'api' },
          { name: 'color', type: 'string', required: false, description: 'Hex color code for the template card accent color.', example: '#4CAF50' },
          { name: 'bootVersion', type: 'string', required: false, description: 'Override the default Spring Boot version for this template. Leave blank to use the system default.', example: '' },
          { name: 'javaVersion', type: 'string', required: false, description: 'Override the default Java version for this template.', example: '21' },
          { name: 'packaging', type: 'string', required: false, description: 'Override the default packaging (jar/war) for this template.', example: 'jar' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'Display order of template cards in the Quick Start section.', example: '0' }
        ]
      },
      {
        id: 'starter-deps',
        title: 'Template Dependencies',
        description: 'How to attach dependencies (with sub-options) to a template.',
        content: `### Template Dependency Records
Each dependency in a template is a separate record linking the template to a \`depId\`. You can also specify sub-options to pre-select.

### Managing Template Dependencies
In the **Starter Templates** admin tab, click the pencil icon on a template. In the edit drawer, scroll to the **Template Dependencies** section. Use the **+ Add Dependency** button to attach a dependency entry. Optionally enter comma-separated \`subOptions\` (matching optionId values from the Sub-Options table).

### Example
Template: "Event-Driven Service"
- \`depId = kafka\`, \`subOptions = "consumer-example,producer-example"\`
- \`depId = data-jpa\`

When a developer clicks this template, Kafka is pre-selected with both example sub-options checked, and JPA is also pre-selected.`,
        fields: [
          { name: 'template', type: 'StarterTemplate', required: true, description: 'The parent template this record belongs to.', example: 'rest-api' },
          { name: 'depId', type: 'string', required: true, description: 'The dependency to include in this template.', example: 'kafka' },
          { name: 'subOptions', type: 'string', required: false, description: 'Comma-separated optionId values to pre-select for this dependency. Must match sub-options registered for the depId.', example: 'consumer-example,producer-example' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 9. MODULE TEMPLATES
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'module-templates',
    title: 'Module Templates',
    icon: 'account_tree',
    topics: [
      {
        id: 'module-what',
        title: 'Multi-Module Projects',
        description: 'How the multi-module generation feature works.',
        content: `### What Is Multi-Module Generation?
By enabling the **Multi-Module** toggle in the generator UI, the developer can produce a Maven multi-module project — a parent POM plus two or more sub-modules (e.g. \`myapp-api\`, \`myapp-core\`, \`myapp-persistence\`).

### How It Works
1. The developer enables the toggle and selects which modules to include.
2. The backend generates each module independently using the standard single-module pipeline.
3. For each module, the system resolves which dependencies to include from the **Module-Dependency Mappings** table (plus any globally selected dependencies).
4. Only the module with \`hasMainClass = true\` gets \`@SpringBootApplication\` and the test class. Other modules have those files removed.
5. A parent \`pom.xml\` is generated with \`<packaging>pom</packaging>\` and a \`<modules>\` section listing all sub-module artifact IDs.
6. Everything is zipped together under the top-level project directory.

### Module Artifact IDs
Each module's artifact ID = \`{project artifactId}{module suffix}\`

For a project with \`artifactId = "myapp"\` and a module with \`suffix = "-api"\`, the module artifact ID is \`myapp-api\`.`,
        callouts: [
          {
            type: 'warning',
            text: 'Exactly one module should have hasMainClass = true. If none do, the generated project will not have a main Spring Boot entry point. If multiple do, each sub-module will have a redundant main class.'
          }
        ]
      },
      {
        id: 'module-fields',
        title: 'Module Template Fields',
        description: 'Configuring individual module templates.',
        content: `### Module Template Entity`,
        fields: [
          { name: 'moduleId', type: 'string', required: true, description: 'Unique identifier for this module. Used as the foreign key in module-dependency mappings.', example: 'api' },
          { name: 'label', type: 'string', required: true, description: 'Display name shown in the module selector UI.', example: 'API Layer' },
          { name: 'description', type: 'string', required: false, description: 'Brief explanation of this module\'s role.', example: 'REST controllers, DTOs, web layer' },
          { name: 'suffix', type: 'string', required: true, description: 'Appended to the project artifactId to form this module\'s artifact ID.', example: '-api' },
          { name: 'packaging', type: 'string', required: true, description: 'Maven packaging type for this module. Usually jar. Use war only for web-layer modules in certain deployment scenarios.', example: 'jar' },
          { name: 'hasMainClass', type: 'boolean', required: true, description: 'Set to true for the one module that should contain @SpringBootApplication. All other modules must be false.', example: 'true' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'Display order in the module selector.', example: '0' }
        ]
      },
      {
        id: 'module-mappings',
        title: 'Module-Dependency Mappings',
        description: 'Assigning dependencies to specific modules.',
        content: `### Purpose
Module-dependency mappings control which dependencies are automatically included in each module's generated \`pom.xml\`.

For example:
- **api** module → \`web\`, \`security\`, \`actuator\` (REST controllers need these)
- **persistence** module → \`data-jpa\`, \`postgresql\` (database layer needs these)
- **core** module → \`logging\` (shared utilities)

### How to Configure
In the **Module Templates** admin tab, each template row shows a **Dependency Mappings** section. Use **+ Add Mapping** to create a new module-dependency association.

### Global vs. Module-Specific Dependencies
Dependencies the developer selects in the generator UI are applied to all modules. Module-dependency mappings are additional dependencies that are automatically included only in the specified module. The final dependency list for a module = (user-selected deps) ∪ (module-specific mappings).`,
        fields: [
          { name: 'dependencyId', type: 'string', required: true, description: 'The depId of the dependency to include in this module.', example: 'data-jpa' },
          { name: 'moduleId', type: 'string', required: true, description: 'The moduleId of the module to assign this dependency to.', example: 'persistence' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'Processing order. Typically 0 for all mappings.', example: '0' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 10. SQL → JPA ENTITY WIZARD
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'sql-wizard',
    title: 'SQL Entity Wizard',
    icon: 'auto_fix_high',
    topics: [
      {
        id: 'sql-wizard-what',
        title: 'What the Wizard Does',
        description: 'Paste CREATE TABLE scripts and get JPA entities in the generated project.',
        content: `### Purpose
When the developer selects a relational DB driver dependency (PostgreSQL, MSSQL, Oracle, DB2, H2, MySQL), a **"Generate entities from SQL…"** button appears on that driver's card in the selected-dependencies panel. Clicking it opens a drawer where the developer pastes one or more \`CREATE TABLE\` scripts. When they hit Generate, the backend parses the DDL and writes ready-to-use JPA \`@Entity\` classes — plus optional \`JpaRepository\` interfaces — directly into the output ZIP.

This removes the tedious step of hand-writing entity classes after project generation.

### Which Drivers Are Eligible
The UI calls \`GET /metadata/sql-dialects\` at page load to learn which dep IDs the backend can handle. The button only appears on dep cards present in that response. Adding a new JDBC driver to the dependency catalog that matches a known dialect automatically surfaces the wizard for it — no admin-side configuration is needed for the wizard itself.

MongoDB is excluded because it has no DDL contract.

### Flow At a Glance
1. Developer selects a DB driver dep (e.g. \`postgresql\`) plus \`data-jpa\`.
2. Clicks **Generate entities from SQL…** on the dep's card.
3. Pastes \`CREATE TABLE users (...); CREATE TABLE orders (...);\`.
4. Detected tables appear as a list with a **Generate repository** checkbox per row (default on).
5. Optional: change the sub-package (default \`entity\`).
6. Save → the drawer closes and the dep card shows a small badge (✓ N tables).
7. Click **Generate** or **Explore** — the UI switches to POST \`/starter-wizard.zip\` / \`/starter-wizard.preview\` with a JSON body, and entities/repositories appear in the downloaded project and file tree.`,
        callouts: [
          {
            type: 'info',
            text: 'Developers who do not use the wizard are unaffected — when sqlByDep is empty, the UI keeps using the regular GET /starter.zip flow. Lombok is only added to generated projects when SQL is attached.'
          }
        ]
      },
      {
        id: 'sql-wizard-mapping',
        title: 'Dialect-Aware Type Mapping',
        description: 'How SQL column types become Java field types.',
        content: `### Mapping Rules
Each column in a parsed \`CREATE TABLE\` becomes a field on the entity. The Java type is chosen based on the raw SQL type, precision/scale where applicable, and the selected dialect. Highlights:

| SQL Type | Java Type | Notes |
|---|---|---|
| \`VARCHAR\`, \`CHAR\`, \`TEXT\`, \`CLOB\`, \`NVARCHAR\`, \`VARCHAR2\` | \`String\` | \`length\` → \`@Column(length=...)\` |
| \`INT\`, \`INTEGER\` | \`Integer\` | |
| \`BIGINT\`, \`BIGSERIAL\`, \`SERIAL\` | \`Long\` | SERIAL/BIGSERIAL also gets \`@GeneratedValue(IDENTITY)\` |
| \`BOOLEAN\`, \`BIT\` (MSSQL), \`TINYINT(1)\` (MySQL) | \`Boolean\` | |
| \`DATE\` / \`TIMESTAMP\` / \`TIME\` | \`LocalDate\` / \`LocalDateTime\` / \`LocalTime\` | |
| \`NUMERIC(p,s)\`, \`DECIMAL(p,s)\` | \`BigDecimal\` | precision/scale copied to \`@Column\` |
| \`NUMBER(p,0)\` (Oracle) | \`Integer\` / \`Long\` | ≤9 → Integer, else Long |
| \`UUID\` (PG), \`UNIQUEIDENTIFIER\` (MSSQL) | \`UUID\` | |
| \`JSON\`, \`JSONB\` (PG) | \`String\` | |
| \`BYTEA\`, \`BLOB\` | \`byte[]\` | |

### Naming Conventions
- Table \`user_orders\` → class \`UserOrders\`
- Column \`created_at\` → field \`createdAt\` + \`@Column(name = "created_at")\`
- Primary key → \`@Id\`; composite PK → \`@IdClass\` with a generated companion record
- \`BIGSERIAL\` / \`SERIAL\` / \`AUTO_INCREMENT\` / \`IDENTITY\` → \`@GeneratedValue(strategy = IDENTITY)\`

### Foreign Keys
The FK column is kept as a scalar field with a \`// TODO: map as @ManyToOne\` comment. v1 never auto-generates associations — cardinality and fetch strategy are deferred to the developer.

### Lombok
Generated entities use \`@Data\`, \`@NoArgsConstructor\`, and \`@AllArgsConstructor\`. The build customizer adds \`org.projectlombok:lombok\` (scope \`annotationProcessor\`) to the Maven build **only** when SQL is attached.`,
        callouts: [
          {
            type: 'warning',
            text: '@Data generates equals/hashCode across every field, which can surprise managed JPA entities with lazy associations. Since v1 does not generate associations, this is a safe default — revisit if you extend the wizard to emit @ManyToOne.'
          }
        ]
      },
      {
        id: 'sql-wizard-api',
        title: 'REST API',
        description: 'POST endpoints and companion metadata.',
        content: `### Endpoints

| Method | Path | Purpose |
|---|---|---|
| \`GET\` | \`/metadata/sql-dialects\` | Dep-id → dialect name map (only catalog-present deps) |
| \`POST\` | \`/starter-wizard.zip\` | Generate ZIP with entities/repositories (shared with the OpenAPI wizard; both payloads can coexist) |
| \`POST\` | \`/starter-wizard.preview\` | File tree + contents (same shape as \`/starter.preview\`) |

### Why a New POST Endpoint
\`/starter.zip\` is a GET whose query string carries all generation inputs. A few \`CREATE TABLE\` statements easily exceed typical URL length limits (~2–8 KB). A sibling POST endpoint that accepts the same fields plus \`sqlByDep\` / \`sqlOptions\` (and \`specByDep\` / \`openApiOptions\` for the OpenAPI wizard) is the cleanest answer — no server-side session state, and the GET flow stays untouched for users who don't need the wizard.`,
        codeExamples: [
          {
            title: 'Generate a project with a users entity and its repository',
            language: 'bash',
            code: `curl -o demo.zip -X POST http://localhost:8080/starter-wizard.zip \\
  -H "Content-Type: application/json" \\
  -d '{
    "groupId":"com.menora","artifactId":"demo","name":"demo",
    "packageName":"com.menora.demo","type":"maven-project","language":"java",
    "bootVersion":"3.2.1","packaging":"jar","javaVersion":"21",
    "dependencies":["postgresql","data-jpa","web"],
    "sqlByDep":{"postgresql":"CREATE TABLE users (id BIGSERIAL PRIMARY KEY, email VARCHAR(200) NOT NULL);"},
    "sqlOptions":{"postgresql":{"subPackage":"entity","tables":[{"name":"users","generateRepository":true}]}}
  }'
unzip -p demo.zip demo/src/main/java/com/menora/demo/entity/Users.java`
          }
        ],
        fields: [
          { name: 'sqlByDep', type: 'object', required: false, description: 'Map of depId → raw SQL script containing one or more CREATE TABLE statements.', example: '{ "postgresql": "CREATE TABLE users (...);" }' },
          { name: 'sqlOptions', type: 'object', required: false, description: 'Map of depId → { subPackage, tables[] }. tables[].generateRepository toggles repository emission per table; subPackage defaults to "entity".', example: '{ "postgresql": { "subPackage": "entity", "tables": [ { "name": "users", "generateRepository": true } ] } }' },
          { name: 'opts', type: 'object', required: false, description: 'Same sub-option map as used with /starter.zip\'s opts-{depId} query params — e.g. primary/secondary DB selection.', example: '{ "postgresql": ["pg-primary"] }' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 10b. OPENAPI → CONTROLLER/DTO WIZARD
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'openapi-wizard',
    title: 'OpenAPI Wizard',
    icon: 'integration_instructions',
    topics: [
      {
        id: 'openapi-wizard-what',
        title: 'What the Wizard Does',
        description: 'Paste an OpenAPI 3.x spec and get @RestController classes + DTO records.',
        content: `### Purpose
When the developer selects a web stack dependency (\`web\` or \`webflux\`), an **"OpenAPI…"** button appears on that card in the selected-dependencies panel. Clicking it opens a drawer where the developer pastes an OpenAPI 3.x spec (YAML or JSON). When they hit Generate, the backend parses the spec and writes \`@RestController\` classes plus DTO \`record\`s — already wired up with Spring MVC annotations, parameter binding, and validation.

This is the symmetrical twin of the SQL wizard for API-first teams. It removes the boilerplate of hand-writing controller signatures and request/response DTOs after generation.

### Which Dependencies Are Eligible
The UI calls \`GET /metadata/openapi-capable-deps\` at page load — the button only appears on dep cards present in the response (currently \`web\` and \`webflux\`, intersected with deps actually in the catalog).

### Flow At a Glance
1. Developer selects a web stack dep (e.g. \`web\`).
2. Clicks **OpenAPI…** on the dep's card.
3. Pastes or uploads an OpenAPI 3.x spec (\`.yaml\`, \`.yml\`, or \`.json\`).
4. A live **Detected Operations** list appears (debounced 400ms) showing entries like \`GET /pets\`, \`POST /pets/{id}\`.
5. Optional: change the sub-packages (default \`api\` for controllers, \`dto\` for records).
6. Save → the dep card shows an attachment badge.
7. Click **Generate** or **Explore** — the UI sends POST \`/starter-wizard.zip\` / \`/starter-wizard.preview\` with a JSON body, and the generated controllers/records appear in the ZIP and the file tree. The endpoint is shared with the SQL wizard — a single request can carry both \`specByDep\` and \`sqlByDep\`.`,
        callouts: [
          {
            type: 'info',
            text: 'Method bodies always throw UnsupportedOperationException. The goal of v1 is a compiling skeleton — developers fill in the business logic after generation.'
          },
          {
            type: 'info',
            text: 'The SQL and OpenAPI wizards are composable — both share POST /starter-wizard.zip, so a single request can carry sqlByDep (attached to a JPA dep) and specByDep (attached to a web dep) together. Empty maps are a no-op.'
          }
        ]
      },
      {
        id: 'openapi-wizard-mapping',
        title: 'Schema → Java Type Mapping',
        description: 'How OpenAPI schemas become Java records and types.',
        content: `### Type Mapping
The wizard maps OpenAPI types (and their \`format\` hints) to Java types directly on the generated record fields and controller signatures.

| OpenAPI Schema | Java Type | Notes |
|---|---|---|
| \`string\` | \`String\` | |
| \`string\`, \`format: date\` | \`LocalDate\` | |
| \`string\`, \`format: date-time\` | \`LocalDateTime\` | |
| \`string\`, \`format: uuid\` | \`UUID\` | |
| \`string\`, \`format: binary\` | \`byte[]\` | |
| \`integer\` | \`Integer\` | |
| \`integer\`, \`format: int64\` | \`Long\` | |
| \`number\` / \`number\`, \`format: float\` | \`Double\` / \`Float\` | |
| \`number\`, \`format: double\` | \`Double\` | |
| \`boolean\` | \`Boolean\` | |
| \`array\` | \`List<T>\` | recurses on \`items\` |
| \`object\` with \`$ref\` | referenced record name | |
| \`allOf\` / \`oneOf\` / \`anyOf\` | \`Object\` | with \`// TODO\` comment |

### Controllers
Operations are grouped by their **first tag** (untagged operations go to \`DefaultController\`). One method is emitted per operation:

- Class name: \`{Tag}Controller\` (e.g. \`PetsController\`)
- Class-level annotation: \`@RestController\`, \`@Validated\`
- Method annotation: \`@GetMapping\`, \`@PostMapping\`, \`@PutMapping\`, \`@DeleteMapping\`, \`@PatchMapping\`
- Parameters: \`@PathVariable\`, \`@RequestParam\`, \`@RequestHeader\`, \`@RequestBody\` (with \`@Valid\`)
- Body: \`throw new UnsupportedOperationException("TODO: implement ...")\`
- Duplicate \`operationId\`s within a tag are disambiguated by appending \`_2\`, \`_3\`, …

### Records
Every entry under \`components.schemas.*\` becomes a Java \`record\` with one component per property. Required fields keep their raw Java type; optional fields do too (nullability is deferred to the developer — v1 does not wrap optionals in \`Optional<T>\`).

### Packages
- Controllers → \`{packageName}.{apiSubPackage}\` (default \`api\`)
- Records → \`{packageName}.{dtoSubPackage}\` (default \`dto\`)`,
      },
      {
        id: 'openapi-wizard-api',
        title: 'REST API',
        description: 'POST endpoints and companion metadata.',
        content: `### Endpoints

| Method | Path | Purpose |
|---|---|---|
| \`GET\` | \`/metadata/openapi-capable-deps\` | Dep IDs eligible for the wizard (intersected with deps in the catalog) |
| \`POST\` | \`/starter-wizard.zip\` | Generate ZIP with controllers and DTO records (shared with the SQL wizard) |
| \`POST\` | \`/starter-wizard.preview\` | File tree + contents (same shape as \`/starter.preview\`) |
| \`POST\` | \`/starter-wizard.detect-paths\` | Server-side parse: \`{ spec }\` → \`["GET /pets", "POST /pets/{id}", ...]\` for the drawer's live preview |

### Why a New POST Endpoint
OpenAPI specs regularly exceed typical URL length limits (~2–8 KB) — even the Petstore example is ~2 KB of YAML. Using a sibling POST endpoint that accepts the same generation fields plus \`specByDep\` and \`openApiOptions\` keeps the wizard decoupled from the GET flow and side-steps URL size ceilings entirely.

### Parse Errors
If the spec is malformed, the backend returns HTTP 400 with a body like \`{ "error": "...", "messages": ["attribute info.version is missing", ...] }\`. The drawer surfaces those messages in a yellow banner and disables the Save button until the spec parses cleanly.`,
        codeExamples: [
          {
            title: 'Generate a project from a tiny Petstore spec',
            language: 'bash',
            code: `curl -o demo.zip -X POST http://localhost:8080/starter-wizard.zip \\
  -H "Content-Type: application/json" \\
  -d '{
    "groupId":"com.menora","artifactId":"demo","name":"demo",
    "packageName":"com.menora.demo","type":"maven-project","language":"java",
    "bootVersion":"3.2.1","packaging":"jar","javaVersion":"21",
    "dependencies":["web"],
    "specByDep":{"web":"openapi: 3.0.3\\ninfo: { title: Petstore, version: 1.0.0 }\\npaths:\\n  /pets/{id}:\\n    get:\\n      tags: [pets]\\n      operationId: getPetById\\n      parameters: [{ name: id, in: path, required: true, schema: { type: integer, format: int64 } }]\\n      responses: { 200: { content: { application/json: { schema: { $ref: \\"#/components/schemas/Pet\\" } } } } }\\ncomponents:\\n  schemas:\\n    Pet: { type: object, properties: { id: { type: integer, format: int64 }, name: { type: string } }, required: [id, name] }"},
    "openApiOptions":{"web":{"apiSubPackage":"api","dtoSubPackage":"dto"}}
  }'
unzip -p demo.zip demo/src/main/java/com/menora/demo/api/PetsController.java`
          },
          {
            title: 'Example Petstore OpenAPI spec (YAML)',
            language: 'yaml',
            code: `openapi: 3.0.3
info:
  title: Petstore
  version: 1.0.0
paths:
  /pets:
    get:
      tags: [pets]
      operationId: listPets
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/Pet' }
    post:
      tags: [pets]
      operationId: createPet
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/Pet' }
      responses:
        '201': { description: Created }
  /pets/{id}:
    get:
      tags: [pets]
      operationId: getPetById
      parameters:
        - { name: id, in: path, required: true, schema: { type: integer, format: int64 } }
      responses:
        '200':
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Pet' }
components:
  schemas:
    Pet:
      type: object
      required: [id, name]
      properties:
        id:   { type: integer, format: int64 }
        name: { type: string }
        tag:  { type: string }`
          },
          {
            title: 'Generated PetsController.java',
            language: 'java',
            code: `package com.menora.demo.api;

import com.menora.demo.dto.Pet;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@Validated
public class PetsController {

    @GetMapping("/pets")
    public List<Pet> listPets() {
        throw new UnsupportedOperationException("TODO: implement listPets");
    }

    @PostMapping("/pets")
    public void createPet(@Valid @RequestBody Pet body) {
        throw new UnsupportedOperationException("TODO: implement createPet");
    }

    @GetMapping("/pets/{id}")
    public Pet getPetById(@PathVariable Long id) {
        throw new UnsupportedOperationException("TODO: implement getPetById");
    }
}`
          }
        ],
        fields: [
          { name: 'specByDep', type: 'object', required: false, description: 'Map of depId → raw OpenAPI 3.x spec text (YAML or JSON). swagger-parser detects the format automatically.', example: '{ "web": "openapi: 3.0.3\\n..." }' },
          { name: 'openApiOptions', type: 'object', required: false, description: 'Map of depId → { apiSubPackage, dtoSubPackage }. Controllers go to apiSubPackage (default "api"); records go to dtoSubPackage (default "dto").', example: '{ "web": { "apiSubPackage": "api", "dtoSubPackage": "dto" } }' },
          { name: 'dependencies', type: 'array', required: true, description: 'The usual dep-id array. Only deps listed in /metadata/openapi-capable-deps will have their entries in specByDep processed.', example: '[ "web" ]' }
        ]
      },
      {
        id: 'openapi-wizard-limits',
        title: 'Notes & Limitations (v1)',
        description: 'What this generation does, what it does not, and why.',
        content: `### What v1 Produces
- One \`{Tag}Controller\` class per tag (operations without a tag go to \`DefaultController\`).
- One Java \`record\` per entry in \`components.schemas.*\`.
- Method bodies always throw \`UnsupportedOperationException\` — the project compiles; the logic is yours to fill in.

### What v1 Does Not Produce
- **No client stubs** — Feign, WebClient, and RestTemplate-based clients are out of scope.
- **No polymorphism** — \`allOf\`, \`oneOf\`, \`anyOf\` fall back to \`Object\` with a \`// TODO\` comment.
- **No inline schemas** — only named schemas under \`components.schemas.*\` become records. Inline response/request schemas also fall back to \`Object\`.
- **No OpenAPI annotation emission** — Springdoc / springfox annotations are not added. Add \`springdoc-openapi-starter-webmvc-ui\` as a dependency if you want a live Swagger UI.

### Why These Choices
The goal of v1 is to kill boilerplate without opinionating the implementation. Polymorphism, null semantics, and client generation are all design decisions that different teams handle differently — forcing a choice here creates more work for teams that wanted the other answer. Keep v1 tight, iterate on real feedback.`,
        callouts: [
          {
            type: 'tip',
            text: 'If you want interactive API docs, add springdoc-openapi-starter-webmvc-ui as a regular dependency (not via the wizard). It scans your controllers at runtime and reconstructs a Swagger UI — no annotation work needed for simple cases.'
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 10b. SOAP WIZARD
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'soap-wizard',
    title: 'SOAP Wizard',
    icon: 'hub',
    topics: [
      {
        id: 'soap-wizard-what',
        title: 'What the Wizard Does',
        description: 'Paste a WSDL and get @Endpoint stubs, a WebServiceTemplate client, or both.',
        content: `### Purpose
When the developer selects the \`web-services\` dependency (Spring Web Services starter), a **"SOAP…"** button appears on that card. Clicking it opens a drawer where the developer pastes a WSDL 1.1 document. On Generate, the backend drops the WSDL into \`src/main/resources/wsdl/\`, configures the JAX-WS Maven plugin to generate JAXB payload classes at build time, and emits one of three things — server \`@Endpoint\` stubs, a \`WebServiceGatewaySupport\` client, or both — depending on the chosen mode.

This is the symmetrical twin of the OpenAPI wizard for SOAP teams. It removes the boilerplate for both contract-first SOAP servers and SOAP consumers.

### Which Dependencies Are Eligible
The UI calls \`GET /metadata/soap-capable-deps\` at page load — the button only appears on dep cards present in the response (currently just \`web-services\`, intersected with deps actually in the catalog).

### Flow At a Glance
1. Developer selects \`web-services\` from the catalog.
2. Clicks **SOAP…** on the dep's card.
3. Pastes or uploads a WSDL (\`.wsdl\` or \`.xml\`).
4. A live **Detected Services** list appears (debounced 400ms) showing entries like \`CountryService.CountryPort: getCountry, listCountries\`.
5. Picks a mode — **Endpoints**, **Client**, or **Both** — and (optionally) overrides sub-packages, the servlet context path (endpoint mode), and the base URL property (client mode).
6. Save → the dep card shows a "WSDL attached" badge.
7. Click **Generate** or **Explore** — the UI sends POST \`/starter-wizard.zip\` / \`/starter-wizard.preview\` with a JSON body. The endpoint is shared with the SQL and OpenAPI wizards — a single request can carry \`wsdlByDep\`, \`specByDep\`, and \`sqlByDep\` together.`,
        callouts: [
          {
            type: 'info',
            text: 'JAXB request/response classes are not written into the ZIP. They are generated at build time by the JAX-WS Maven plugin from the embedded XSD inside the WSDL. The first mvn compile produces them under target/generated-sources/jaxws/. IDEs detect this folder automatically.'
          },
          {
            type: 'info',
            text: 'The SQL, OpenAPI, and SOAP wizards are all composable — POST /starter-wizard.zip accepts sqlByDep, specByDep, and wsdlByDep simultaneously. Empty maps are a no-op.'
          }
        ]
      },
      {
        id: 'soap-wizard-modes',
        title: 'Generation Modes',
        description: 'What gets emitted for ENDPOINTS, CLIENT, and BOTH.',
        content: `### Modes
The wizard exposes three modes; each controls which Java classes the generator writes (the WSDL itself and the JAX-WS plugin in \`pom.xml\` are emitted in all modes).

| Mode | Files emitted besides the WSDL + the JAX-WS plugin |
|---|---|
| \`ENDPOINTS\` | \`{Service}Endpoint.java\` (\`@Endpoint\`, one method per operation) + \`WebServiceConfig.java\` (\`MessageDispatcherServlet\` at \`contextPath\`, \`SimpleWsdl11Definition\` exposing the WSDL) |
| \`CLIENT\` | \`{Service}Client.java\` (\`WebServiceGatewaySupport\` subclass) + \`SoapClientConfig.java\` (\`Jaxb2Marshaller\` + \`WebServiceTemplate\` reading \`\${baseUrlProperty}\`) + \`application.yaml\` fragment with the base URL |
| \`BOTH\` | All of the above. Endpoints and client share the same JAXB-generated payload classes. |

### Endpoint Methods
For each WSDL operation:

- One method per operation, one \`@PayloadRoot(namespace = ..., localPart = ...)\` per method
- \`namespace\` comes from the request element's namespace (or the WSDL \`targetNamespace\` if the part has no element reference)
- \`localPart\` comes from the request element's local name (or the operation name as a fallback)
- Method signature uses the JAXB-generated payload classes by name; they will resolve once \`mvn compile\` runs the JAX-WS plugin
- Body throws \`UnsupportedOperationException\`

### Client Methods
For each WSDL operation:

- One method per operation, with the JAXB request type as the parameter and the JAXB response type as the return type
- Body delegates to \`getWebServiceTemplate().marshalSendAndReceive(request)\`
- The \`WebServiceTemplate\` and \`Jaxb2Marshaller\` beans are configured in \`SoapClientConfig\` with \`contextPath\` set to the generated package

### Packages
- WSDL → \`src/main/resources/wsdl/{kebab-cased-service-name}.wsdl\`
- Endpoints → \`{packageName}.{endpointSubPackage}\` (default \`endpoint\`)
- Client → \`{packageName}.{clientSubPackage}\` (default \`client\`)
- JAXB payloads → \`{packageName}.{payloadSubPackage}\` (default \`generated\`) — generated at build time by JAX-WS plugin`,
      },
      {
        id: 'soap-wizard-api',
        title: 'REST API',
        description: 'POST endpoints and companion metadata.',
        content: `### Endpoints

| Method | Path | Purpose |
|---|---|---|
| \`GET\` | \`/metadata/soap-capable-deps\` | Dep IDs eligible for the wizard (intersected with deps in the catalog) |
| \`POST\` | \`/starter-wizard.zip\` | Generate ZIP with endpoints/clients (shared with the SQL and OpenAPI wizards) |
| \`POST\` | \`/starter-wizard.preview\` | File tree + contents (same shape as \`/starter.preview\`) |
| \`POST\` | \`/starter-wizard.detect-services\` | Server-side parse: \`{ wsdl }\` → \`["CountryService.CountryPort: getCountry, listCountries"]\` for the drawer's live preview |

### Why a New POST Endpoint
WSDL documents routinely run into tens of kilobytes once the embedded XSD is non-trivial — well past typical URL length limits. Reusing the same wizard POST endpoint that already exists for SQL and OpenAPI keeps the wire shape consistent and side-steps URL size ceilings.

### Parse Errors
If the WSDL is malformed, the backend returns HTTP 400 with a body like \`{ "error": "Invalid WSDL", "messages": ["WSDLException: faultCode=PARSER_ERROR: ..."] }\`. The drawer surfaces those messages in a yellow banner.`,
        codeExamples: [
          {
            title: 'Generate a project from a tiny CountryService WSDL (BOTH mode)',
            language: 'bash',
            code: `curl -o demo.zip -X POST http://localhost:8080/starter-wizard.zip \\
  -H "Content-Type: application/json" \\
  -d '{
    "groupId":"com.menora","artifactId":"demo","name":"demo",
    "packageName":"com.menora.demo","type":"maven-project","language":"java",
    "bootVersion":"3.2.1","packaging":"jar","javaVersion":"21",
    "dependencies":["web-services"],
    "wsdlByDep":{"web-services":"<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>\\n<wsdl:definitions xmlns:wsdl=\\"http://schemas.xmlsoap.org/wsdl/\\" xmlns:xsd=\\"http://www.w3.org/2001/XMLSchema\\" xmlns:soap=\\"http://schemas.xmlsoap.org/wsdl/soap/\\" xmlns:tns=\\"http://example.com/country\\" targetNamespace=\\"http://example.com/country\\">..."},
    "soapOptions":{"web-services":{"mode":"BOTH"}}
  }'
unzip -p demo.zip demo/src/main/java/com/menora/demo/endpoint/CountryServiceEndpoint.java`
          },
          {
            title: 'Example CountryService WSDL (XML)',
            language: 'xml',
            code: `<?xml version="1.0" encoding="UTF-8"?>
<wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"
                  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
                  xmlns:tns="http://example.com/country"
                  targetNamespace="http://example.com/country">
  <wsdl:types>
    <xsd:schema targetNamespace="http://example.com/country" elementFormDefault="qualified">
      <xsd:element name="getCountryRequest">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="name" type="xsd:string"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="getCountryResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="population" type="xsd:int"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </wsdl:types>
  <wsdl:message name="getCountryRequest">
    <wsdl:part name="parameters" element="tns:getCountryRequest"/>
  </wsdl:message>
  <wsdl:message name="getCountryResponse">
    <wsdl:part name="parameters" element="tns:getCountryResponse"/>
  </wsdl:message>
  <wsdl:portType name="CountryPort">
    <wsdl:operation name="getCountry">
      <wsdl:input  message="tns:getCountryRequest"/>
      <wsdl:output message="tns:getCountryResponse"/>
    </wsdl:operation>
  </wsdl:portType>
  <wsdl:binding name="CountryBinding" type="tns:CountryPort">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <wsdl:operation name="getCountry">
      <soap:operation soapAction=""/>
      <wsdl:input><soap:body use="literal"/></wsdl:input>
      <wsdl:output><soap:body use="literal"/></wsdl:output>
    </wsdl:operation>
  </wsdl:binding>
  <wsdl:service name="CountryService">
    <wsdl:port name="CountryPort" binding="tns:CountryBinding">
      <soap:address location="http://localhost:8080/ws"/>
    </wsdl:port>
  </wsdl:service>
</wsdl:definitions>`
          },
          {
            title: 'Generated CountryServiceEndpoint.java',
            language: 'java',
            code: `package com.menora.demo.endpoint;

import com.menora.demo.generated.GetCountryRequest;
import com.menora.demo.generated.GetCountryResponse;
import org.springframework.ws.server.endpoint.annotation.Endpoint;
import org.springframework.ws.server.endpoint.annotation.PayloadRoot;
import org.springframework.ws.server.endpoint.annotation.RequestPayload;
import org.springframework.ws.server.endpoint.annotation.ResponsePayload;

@Endpoint
public class CountryServiceEndpoint {

    @PayloadRoot(namespace = "http://example.com/country", localPart = "getCountryRequest")
    @ResponsePayload
    public GetCountryResponse getCountry(@RequestPayload GetCountryRequest request) {
        throw new UnsupportedOperationException("TODO: implement getCountry");
    }
}`
          },
          {
            title: 'Generated CountryServiceClient.java',
            language: 'java',
            code: `package com.menora.demo.client;

import com.menora.demo.generated.GetCountryRequest;
import com.menora.demo.generated.GetCountryResponse;
import org.springframework.ws.client.core.support.WebServiceGatewaySupport;

public class CountryServiceClient extends WebServiceGatewaySupport {

    public GetCountryResponse getCountry(GetCountryRequest request) {
        return (GetCountryResponse) getWebServiceTemplate().marshalSendAndReceive(request);
    }
}`
          }
        ],
        fields: [
          { name: 'wsdlByDep', type: 'object', required: false, description: 'Map of depId → raw WSDL 1.1 document text. wsdl4j parses on the server.', example: '{ "web-services": "<?xml version=\\"1.0\\"?>..." }' },
          { name: 'soapOptions', type: 'object', required: false, description: 'Map of depId → { mode, endpointSubPackage, clientSubPackage, payloadSubPackage, baseUrlProperty, contextPath }. mode is one of ENDPOINTS, CLIENT, BOTH (default ENDPOINTS).', example: '{ "web-services": { "mode": "BOTH", "endpointSubPackage": "endpoint", "clientSubPackage": "client" } }' },
          { name: 'dependencies', type: 'array', required: true, description: 'The usual dep-id array. Only deps listed in /metadata/soap-capable-deps will have their entries in wsdlByDep processed.', example: '[ "web-services" ]' }
        ]
      },
      {
        id: 'soap-wizard-limits',
        title: 'Notes & Limitations (v1)',
        description: 'What this generation does, what it does not, and why.',
        content: `### What v1 Produces
- The WSDL itself, dropped verbatim into \`src/main/resources/wsdl/{kebab-service-name}.wsdl\`.
- The JAX-WS Maven plugin (\`com.sun.xml.ws:jaxws-maven-plugin:4.0.2\`) wired to \`generate-sources\` in \`pom.xml\` — generates JAXB payload classes from the embedded XSD on every \`mvn compile\`.
- One \`{Service}Endpoint.java\` and/or \`{Service}Client.java\` per \`<wsdl:service>\`, one method per operation.
- A \`WebServiceConfig.java\` (endpoint mode) and/or \`SoapClientConfig.java\` (client mode).
- An \`application.yaml\` fragment with the base URL property (client mode only) — deep-merged into the existing \`application.yaml\`.

### What v1 Does Not Produce
- **No JAXB classes in the ZIP.** They live in \`target/generated-sources/jaxws/\` after \`mvn compile\` runs the plugin. IDEs pick this up automatically.
- **No WSDL 2.0 support** — wsdl4j parses WSDL 1.1 only.
- **No standalone XSD input** — the wizard expects a WSDL with embedded or referenced schemas.
- **No SOAP 1.2 binding override** — both 1.1 and 1.2 address bindings are detected for the live preview, but the generated code uses the default \`MessageFactory\` (SOAP 1.1). Switch to SOAP 1.2 in \`SoapClientConfig\` after generation if needed.
- **No mTLS / WS-Security wiring** — the generated client is plain HTTP. Wire interceptors (\`Wss4jSecurityInterceptor\`, custom \`HttpComponents5MessageSender\`) yourself.

### Why These Choices
JAXB code generation is a complex, well-solved problem; reimplementing it inside the wizard would be a poor use of effort and would constantly drift from the JDK's reference behavior. Delegating to the JAX-WS Maven plugin gives the developer the *exact* classes they would have generated by hand from the WSDL, with no surprises — the wizard's value is the Spring wiring around those classes, not the classes themselves.`,
        callouts: [
          {
            type: 'tip',
            text: 'After generation, run mvn -DskipTests compile once to materialize the JAXB payload classes. The generated Endpoint and Client classes will not resolve in the IDE until that runs at least once.'
          },
          {
            type: 'tip',
            text: 'For WS-Security or mTLS, add interceptors / a custom WebServiceMessageSender in SoapClientConfig after generation. The wizard intentionally stays out of security policy — that varies too much per service.'
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 11. EXPORT / IMPORT
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'export-import',
    title: 'Export & Import',
    icon: 'swap_horiz',
    topics: [
      {
        id: 'export-import-how',
        title: 'Configuration Backup & Migration',
        description: 'How to export and import the full admin configuration.',
        content: `### Exporting
Click the **Export** button (download icon) in the top-right of the admin. This downloads a JSON file containing all database records: dependency groups, entries, file contributions, build customizations, sub-options, compatibility rules, starter templates, module templates, and all mappings.

Use this to:
- **Back up** the current configuration before making major changes
- **Migrate** configuration from a staging instance to production
- **Version-control** the configuration by committing the JSON to your repository

### Importing
Click the **Import** button (upload icon), select a previously exported JSON file, and confirm. The import **merges** records — it adds or updates records based on their IDs, but does not delete records that exist in the database but are absent from the JSON.

**A confirmation dialog appears before import** — review the summary of what will be changed before clicking Confirm.

### Recommendation
Export the full configuration to \`data/config-backup-YYYY-MM-DD.json\` before any significant changes. Keep at least the last 3 backups.`,
        callouts: [
          {
            type: 'warning',
            text: 'Import does not delete existing records — it only adds or updates. To do a full replacement, you would need to manually delete conflicting records first, or use the database directly.'
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 11. ACTIVITY & AUDIT
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'activity',
    title: 'Activity & Audit',
    icon: 'monitoring',
    topics: [
      {
        id: 'activity-what',
        title: 'Generation Audit Log',
        description: 'See what teams actually generate, how fast, and how often generation fails.',
        content: `### What It Records
Every call to a \`/starter*\` endpoint (ZIP download, preview, SQL wizard, multi-module) is recorded with: timestamp, endpoint, artifact/group IDs, Boot version, Java version, packaging, language, selected dependencies, duration in milliseconds, outcome (SUCCESS/FAILURE), and optional client IP.

The audit filter runs asynchronously on the response path — a database hiccup never breaks project generation.

### Where to Find It
Open the admin and click the **Activity** tab in the sidebar. You'll see:
- **Four summary cards** — total generations, success rate, p50 duration, p95 duration.
- **Top Dependencies** — which deps are actually selected most, with a horizontal bar chart.
- **Boot Versions** — distribution of Boot versions in use.
- **Recent Events table** — the last 50 generations with full detail (artifact ID, deps selected, duration, status).

### Time Window
The toggle at the top right switches the rollup between **1 day**, **7 days**, **30 days** (default), and **90 days**. Summary cards, top lists, and the recent-events table all re-fetch when you change it.

### Why This Matters
- **Spot drift** — if teams keep generating the same 10 deps together, make a starter template for them.
- **Debug failures** — the recent events table flags failed generations with the error message, so you don't need to tail server logs.
- **Capacity planning** — the p95/p99 timers tell you whether generation has slowed after a catalog change.`,
        callouts: [
          {
            type: 'info',
            text: 'The `POST /starter-wizard.zip` endpoint uses a JSON body, so its audit record captures endpoint/status/duration/remote-addr but not the SQL/OpenAPI wizard parameters. That is a deliberate trade-off — query-param capture would miss the wizards entirely.'
          }
        ]
      },
      {
        id: 'activity-api',
        title: 'REST API & Metrics',
        description: 'Hit the endpoints directly for dashboards, scripts, or Prometheus scrapes.',
        content: `### REST Endpoints
Both endpoints require admin auth (\`Authorization: Bearer <token>\`).

\`GET /admin/activity/recent?limit=50\` — most recent events, newest first.

\`GET /admin/activity/summary?days=30\` — rollup for the given window, returning total count, success rate, p50/p95/p99 durations, top 10 dependencies, and Boot-version distribution.

### Micrometer Metrics
The filter also publishes to Micrometer, exposed on \`/actuator/metrics\`:

- \`menora.generation.count\` — counter tagged by \`status=success|failure\`
- \`menora.generation.duration\` — timer tagged by status, with p50/p95/p99 percentile histograms

Point a Prometheus scraper at \`/actuator/prometheus\` (add \`prometheus\` to the exposure list first) if you want to ship these to a dashboard.

### Privacy Toggle
Client IPs are recorded by default. To disable (e.g. for GDPR compliance), set in \`application.yml\`:

\`\`\`
menora:
  audit:
    log-remote-addr: false
\`\`\`

Existing rows are unaffected; only new events skip the field.`,
        codeExamples: [
          {
            title: 'Pull the last 50 events',
            language: 'bash',
            code: `curl -H "Authorization: Bearer $TOKEN" \\
  http://localhost:8080/admin/activity/recent?limit=50`
          },
          {
            title: 'Get a 7-day summary',
            language: 'bash',
            code: `curl -H "Authorization: Bearer $TOKEN" \\
  http://localhost:8080/admin/activity/summary?days=7`
          },
          {
            title: 'Check the Micrometer counter',
            language: 'bash',
            code: `curl http://localhost:8080/actuator/metrics/menora.generation.count`
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 12. COMMON WORKFLOWS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'workflows',
    title: 'Common Workflows',
    icon: 'checklist',
    topics: [
      {
        id: 'workflow-new-dep',
        title: 'Add a New Dependency End-to-End',
        description: 'Full walkthrough for adding a new internal library to the catalog.',
        content: `Follow these steps to add a new dependency to the system so developers can select it in the generator.`,
        workflowSteps: [
          {
            title: 'Create a Dependency Group (if needed)',
            description: 'Go to Config → Dependency Groups. If your new dependency belongs to a new category, click + Add Group, enter a name, save. Skip this step if using an existing group.'
          },
          {
            title: 'Create the Dependency Entry',
            description: 'Go to Config → Dependencies. Click + Add Dependency. Fill in: depId (unique, lowercase), name, description, group, Maven coordinates (groupId + artifactId; leave version blank if managed by Spring Boot BOM). Set compatibilityRange if the library only works with certain Boot versions.'
          },
          {
            title: 'Add File Contributions',
            description: 'Go to Config → File Contributions. For each file to inject (e.g. application-mylib.yml for YAML config, MyLibConfig.java for a Java config class), click + Add. Set dependencyId to your new depId, fileType (YAML_MERGE for YAML, TEMPLATE for Java), targetPath, content, substitutionType (MUSTACHE for Java files), and sortOrder.'
          },
          {
            title: 'Add Build Customizations (if needed)',
            description: 'Go to Config → Build Customizations. If the library requires extra Maven dependencies (beyond the main entry) or exclusions, add them here. Set dependencyId to your new depId and customizationType to ADD_DEPENDENCY or EXCLUDE_DEPENDENCY.'
          },
          {
            title: 'Add Sub-Options (if applicable)',
            description: 'If the dependency has optional generated content (e.g. example classes), go to Config → Sub-Options. Add sub-option records with dependencyId = your depId. Then go back to File Contributions and set subOptionId on the conditional file contributions.'
          },
          {
            title: 'Add Compatibility Rules (if applicable)',
            description: 'Go to Config → Compatibility. Add REQUIRES, CONFLICTS, or RECOMMENDS rules. For example, if your library requires JPA, add a REQUIRES rule: sourceDepId = your depId, targetDepId = data-jpa.'
          },
          {
            title: 'Click Refresh',
            description: 'In the admin top-right, click the Refresh button. This reloads the metadata cache so your new dependency appears in the main generator UI.'
          },
          {
            title: 'Test It',
            description: 'Go to the main generator (click the Spring Initializr logo), find your new dependency in the picker, select it, click Generate, and unzip to verify all expected files are present and correctly populated.'
          }
        ]
      },
      {
        id: 'workflow-common-file',
        title: 'Add a File to Every Project',
        description: 'How to inject a file into all generated projects using __common__.',
        content: `Use this workflow when you want every generated project to contain a specific file — regardless of which dependencies the developer selects.`,
        workflowSteps: [
          {
            title: 'Go to File Contributions',
            description: 'Config → File Contributions → click + Add.'
          },
          {
            title: 'Set dependencyId to __common__',
            description: 'Type exactly: __common__ (two underscores on each side). This is the sentinel value that means "apply to all projects".'
          },
          {
            title: 'Choose the File Type',
            description: 'STATIC_COPY for a fixed file, TEMPLATE for a file with project variables, YAML_MERGE to add entries to application.yaml for all projects, DELETE to remove a framework-generated file.'
          },
          {
            title: 'Set Target Path and Content',
            description: 'Enter the target path within the generated project (e.g. scripts/setup.sh). For TEMPLATE type, use substitution variables like {{artifactId}} and set substitutionType to MUSTACHE.'
          },
          {
            title: 'Save and Test',
            description: 'Save the record. No Refresh needed — file contributions take effect on the next generation request. Generate a test project and verify the file is present.'
          }
        ]
      },
      {
        id: 'workflow-version-dockerfile',
        title: 'Version-Specific Dockerfiles',
        description: 'How to have different Dockerfiles for Java 17 vs Java 21.',
        content: `This pattern uses the javaVersion field to serve different file content based on the selected Java version.`,
        workflowSteps: [
          {
            title: 'Create the Java 17 Dockerfile Contribution',
            description: 'Go to File Contributions → + Add. Set: dependencyId = __common__, fileType = TEMPLATE, targetPath = Dockerfile, substitutionType = MUSTACHE, javaVersion = 17. Write the Dockerfile content using eclipse-temurin:17-jre-alpine base image. Include {{artifactId}} in the COPY command.'
          },
          {
            title: 'Create the Java 21 Dockerfile Contribution',
            description: 'Create a second record with identical settings except javaVersion = 21 and the Dockerfile content uses eclipse-temurin:21-jre-alpine.'
          },
          {
            title: 'Verify Targeting',
            description: 'The system picks exactly one contribution based on the project\'s selected Java version. Generate a Java 17 project and a Java 21 project, inspect each Dockerfile to confirm the correct base image is used.'
          }
        ],
        callouts: [
          {
            type: 'info',
            text: 'If you also want a fallback Dockerfile for unlisted Java versions, create a third record with javaVersion left blank. It will be used for any Java version that doesn\'t have an explicit match.'
          }
        ]
      },
      {
        id: 'workflow-sub-option',
        title: 'Add a Sub-Option to an Existing Dependency',
        description: 'How to add an optional example class or config to an existing dependency.',
        content: `Use this when you want to give developers an optional extra within an existing dependency — for example, an example service class or a secondary data source configuration.`,
        workflowSteps: [
          {
            title: 'Define the Sub-Option',
            description: 'Go to Config → Sub-Options → + Add. Set: dependencyId = the existing depId (e.g. postgresql), optionId = a unique short ID (e.g. pg-readonly), label = display name (e.g. "Read-Only DataSource"), description = tooltip text.'
          },
          {
            title: 'Create the Gated File Contribution',
            description: 'Go to Config → File Contributions → + Add. Set: dependencyId = same depId, fileType = TEMPLATE (or YAML_MERGE), targetPath = the file to generate, content = the template content, subOptionId = the optionId you just created (e.g. pg-readonly).'
          },
          {
            title: 'Test the Sub-Option',
            description: 'In the main generator, select the parent dependency. The sub-option checkbox should appear. Check it, generate a project, and verify the gated file is present. Then generate without the sub-option checked and verify the file is absent.'
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 13. AGENT CONTRACT (AI SCAFFOLDING)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'agent',
    title: 'Agent Contract (AI)',
    icon: 'smart_toy',
    topics: [
      {
        id: 'agent-what',
        title: 'What the Agent Contract Is',
        description: 'A small HTTP surface designed for AI agents and headless clients.',
        content: `### Purpose
The agent contract is a parallel surface to the browser UI, designed for AI agents (Claude, GPT, in-house) and any HTTP client that prefers JSON file trees over binary ZIPs. The flow is: an agent calls the contract to scaffold a Spring Boot project, then keeps editing the generated tree with its own business logic.

### Three Pieces
1. **\`GET /agent/manifest\`** — single-shot discovery of every dep, sub-option, starter/module template, and wizard capability. Replaces seven separate \`/metadata/*\` round-trips.
2. **\`POST /agent/scaffold\`** — same generation pipeline as \`/starter-wizard.zip\`, but returns a JSON file tree (utf-8 + base64) plus a manifest. No binary handling required.
3. **\`.menora-init.json\`** — manifest dropped at the project root, listing inputs and per-file SHA-256 checksums. Lets agents distinguish scaffold-owned files from agent-edited ones in subsequent passes.

### Why Not the Existing Endpoints?
\`/starter.zip\` and \`/starter-wizard.zip\` work fine for browsers but force agents to handle binary ZIPs and stitch together discovery from multiple endpoints. The agent contract collapses both into JSON, making it usable from any LLM tool-call layer with two HTTP requests.

### Authentication
Currently unauthenticated, matching the existing public endpoints. A bearer-token layer can be added later if the surface is exposed publicly.`,
        callouts: [
          {
            type: 'info',
            text: 'The agent contract is additive — the browser UI continues to use /starter.zip and /starter-wizard.zip exactly as before. Nothing about the existing surface changes.'
          },
          {
            type: 'tip',
            text: 'Discovery is cacheable. If your agent makes many scaffolding calls in a row, fetch /agent/manifest once and reuse it.'
          }
        ]
      },
      {
        id: 'agent-discovery',
        title: 'GET /agent/manifest — Discovery',
        description: 'Single endpoint exposing the full catalog the agent needs before scaffolding.',
        content: `### Returned Shape
A \`AgentManifestResponse\` JSON containing every catalog the agent needs to construct a valid scaffold request: dependencies (with sub-options inlined and Boot compatibility ranges), starter templates, module templates, compatibility rules, the four \`SingleSelectCapability\` lists (boot/java/language/packaging), and a \`wizards\` block with the capable deps for SQL, OpenAPI, and SOAP.

### Why It's One Call
The browser UI calls \`/metadata/client\`, \`/metadata/extensions\`, \`/metadata/compatibility\`, \`/metadata/starter-templates\`, \`/metadata/module-templates\`, \`/metadata/openapi-capable-deps\`, \`/metadata/soap-capable-deps\`, and \`/metadata/sql-dialects\` separately. An agent has no UI to optimize for; one request keeps the prompt simple.

### Validation Hint For Agents
Before calling \`/agent/scaffold\`, an agent should:
- Pick a \`bootVersion\` from \`bootVersions\` (default available as \`defaultBootVersion\`).
- Filter \`dependencies[]\` by \`compatibilityRange\` against the chosen Boot version (an agent that picks an incompatible dep will get a 4xx).
- Look up valid sub-option ids per dep in \`dependencies[].subOptions\`.`,
        codeExamples: [
          {
            title: 'Discovery — curl',
            language: 'bash',
            code: `curl http://localhost:8080/agent/manifest | jq '{
  bootVersions, javaVersions,
  depCount: (.dependencies | length),
  sqlDeps: .wizards.sql.capableDeps
}'`
          },
          {
            title: 'Discovery — TypeScript SDK',
            language: 'typescript',
            code: `import { InitializrClient } from "@menora/initializr-client";

const client = new InitializrClient({ baseUrl: "http://localhost:8080" });
const cap = await client.manifest();
console.log(cap.dependencies.length, "deps available");
console.log("Boot defaults to", cap.defaultBootVersion);`
          }
        ]
      },
      {
        id: 'agent-scaffold',
        title: 'POST /agent/scaffold — Generation',
        description: 'JSON-in, JSON-out generation that returns the project tree as files (utf-8 or base64).',
        content: `### Request Shape
The body is a superset of the existing \`/starter-wizard.zip\` shape, plus a \`mode\` flag and a \`modules\` array. All wizard fields (\`sqlByDep\`, \`specByDep\`, \`wsdlByDep\`, etc.) are accepted exactly as in the wizard endpoint.

### Mode Selector
| Mode | Behavior |
|---|---|
| \`wizard\` (default) | Single project; SQL/OpenAPI/SOAP wizard fields are honored. |
| \`starter\` | Single project; equivalent to \`wizard\` with empty wizard fields. |
| \`multimodule\` | Returns HTTP 501 — use \`GET /starter-multimodule.zip\` for now. JSON-mode multi-module is on the roadmap. |

### Response Shape
\`\`\`json
{
  "manifest": { /* parsed .menora-init.json — see next topic */ },
  "files": [
    { "path": "pom.xml",                  "encoding": "utf-8",  "content": "<project>...", "sha256": "abc..." },
    { "path": "src/main/java/.../App.java","encoding": "utf-8", "content": "package ...;",  "sha256": "def..." },
    { "path": ".mvn/wrapper/mvn-wrapper.jar","encoding": "base64","content": "UEsD...",     "sha256": "789..." }
  ]
}
\`\`\`

### Encoding Rules
Files with text-typical extensions (\`.java\`, \`.xml\`, \`.yaml\`, \`.properties\`, \`.json\`, \`.md\`, \`.sh\`, \`.gitignore\`, \`Dockerfile\`, \`mvnw\`, etc.) are inlined as UTF-8. Anything else, plus binary detection (NUL byte in the first 4 KB), falls back to base64. The \`sha256\` field always reflects the raw file bytes — useful for cross-checking against the manifest's per-file checksums.

### Error Handling
Wizard parse errors (bad WSDL/OpenAPI/SQL) surface as structured 400 responses, identical to \`/starter-wizard.zip\`:
\`\`\`json
{ "error": "Invalid OpenAPI spec", "messages": ["..."] }
{ "error": "Invalid WSDL",         "messages": ["..."] }
{ "error": "Invalid SQL",          "dep": "postgresql", "detail": "..." }
\`\`\``,
        codeExamples: [
          {
            title: 'Minimal scaffold',
            language: 'bash',
            code: `curl -s -X POST http://localhost:8080/agent/scaffold \\
  -H 'Content-Type: application/json' \\
  -d '{
    "groupId": "com.acme",
    "artifactId": "svc",
    "bootVersion": "3.2.1",
    "javaVersion": "21",
    "packaging": "jar",
    "language": "java",
    "dependencies": ["web", "actuator"]
  }' | jq '.files | map(.path)'`
          },
          {
            title: 'With SQL wizard',
            language: 'bash',
            code: `curl -s -X POST http://localhost:8080/agent/scaffold \\
  -H 'Content-Type: application/json' \\
  -d '{
    "bootVersion": "3.2.1",
    "dependencies": ["postgresql","data-jpa"],
    "opts": { "postgresql": ["pg-primary"] },
    "sqlByDep": {
      "postgresql": "CREATE TABLE users (id BIGSERIAL PRIMARY KEY, email VARCHAR(200) NOT NULL);"
    },
    "sqlOptions": {
      "postgresql": {
        "subPackage": "entity",
        "tables": [{ "name": "users", "generateRepository": true }]
      }
    }
  }' | jq '.files[].path' | grep entity`
          },
          {
            title: 'Through the SDK',
            language: 'typescript',
            code: `import { InitializrClient } from "@menora/initializr-client";

const client = new InitializrClient();
const project = await client.scaffold({
  bootVersion: "3.2.1",
  dependencies: ["web", "data-jpa", "postgresql"],
  opts: { postgresql: ["pg-primary"] },
});

for (const file of project.files) {
  const bytes = file.encoding === "base64"
    ? Buffer.from(file.content, "base64")
    : Buffer.from(file.content, "utf-8");
  // write \`bytes\` under your target path
}`
          }
        ]
      },
      {
        id: 'agent-manifest',
        title: '.menora-init.json — Provenance',
        description: 'Manifest at the project root that tracks scaffold-owned files.',
        content: `### What's In It
\`\`\`json
{
  "schemaVersion": 1,
  "generator": {
    "name": "menora-initializr",
    "version": "1.0.0-SNAPSHOT",
    "generatedAt": "2026-04-27T12:34:56.789Z"
  },
  "inputs": {
    "mode": "wizard",
    "groupId": "com.acme", "artifactId": "svc",
    "bootVersion": "3.2.1", "javaVersion": "21",
    "packaging": "jar", "language": "java",
    "dependencies": ["web","data-jpa","postgresql"],
    "modules": [],
    "opts": { "postgresql": ["pg-primary"] },
    "wizards": null
  },
  "files": [
    { "path": "pom.xml",                  "sha256": "abc..." },
    { "path": "src/main/java/.../App.java","sha256": "def..." }
  ]
}
\`\`\`

### Why Per-File Checksums
After scaffolding, the agent edits files. Some of those edits will be on scaffold-owned files (e.g. adding routes to \`pom.xml\`); some will be brand-new files (e.g. business logic). When the agent (or a future re-scaffold pass) wants to know which is which, it diffs the working tree against the manifest:

| Working-tree state | Meaning |
|---|---|
| Path in manifest, sha matches | Untouched scaffold |
| Path in manifest, sha differs | Agent edited a scaffold file |
| Path not in manifest | Agent added a new file |
| Path in manifest, file missing | Agent deleted a scaffold file |

This makes safe re-scaffolding tractable: future iterations can compute a 3-way diff (old scaffold → new scaffold → agent edits) instead of clobbering the agent's work.

### Computing the SHA Yourself
\`\`\`bash
# Text file
echo -n "$(cat pom.xml)" | sha256sum
# Or in any language:
node -e 'console.log(require("crypto").createHash("sha256").update(require("fs").readFileSync("pom.xml")).digest("hex"))'
\`\`\``,
        callouts: [
          {
            type: 'info',
            text: 'The manifest itself is excluded from its own files[] list — its sha would change every time the manifest is written, which would defeat the purpose.'
          }
        ]
      },
      {
        id: 'agent-openapi',
        title: 'OpenAPI Spec & Swagger UI',
        description: 'Auto-generated documentation for the /agent/* endpoints.',
        content: `### Endpoints
- **\`GET /v3/api-docs\`** — full OpenAPI 3 JSON spec, scoped to \`com.menora.initializr.agent\` only.
- **\`GET /swagger-ui.html\`** — interactive Swagger UI for the same spec.

### Why The Scope Filter
The browser-facing wizard controllers transitively reference legacy \`javax.xml.bind\` types via \`swagger-parser\` and \`wsdl4j\`. Letting springdoc introspect those would blow up the spec at runtime. We scope the scan to \`com.menora.initializr.agent\` so the spec stays focused, healthy, and aligned with the contract agents actually use.

### Generating an SDK
Point any OpenAPI-aware codegen at \`/v3/api-docs\` and you get a typed client for free:
\`\`\`bash
npx openapi-typescript http://localhost:8080/v3/api-docs -o agent-types.ts
\`\`\`
The bundled TypeScript SDK in \`clients/typescript/\` is hand-written for ergonomic Anthropic SDK integration, but you can replace or augment it with codegen if you prefer.`,
      },
      {
        id: 'agent-sdk',
        title: 'TypeScript SDK',
        description: '@menora/initializr-client — typed wrappers + Anthropic tool definitions.',
        content: `### Where It Lives
\`clients/typescript/\` in the monorepo. Built with vanilla \`tsc\`; no bundler. Uses \`globalThis.fetch\` so it runs unmodified in Node 18+, browsers, Bun, Deno, and Cloudflare Workers.

### Two Surfaces
1. **\`InitializrClient\`** — typed wrappers for the agent endpoints. Methods: \`manifest()\`, \`scaffold(req)\`, \`detectOpenApiPaths(spec)\`, \`detectWsdlServices(wsdl)\`. Errors throw \`InitializrApiError\` with status + parsed body.
2. **\`anthropicTools()\` + \`executeAgentTool()\`** — ready-to-use Anthropic tool definitions matching the \`Anthropic.Messages.Tool\` shape, plus a dispatch helper that routes \`tool_use\` blocks back to the right backend call. Drop into any \`messages.create({ tools })\` flow.

### Configuration
- \`new InitializrClient({ baseUrl })\` — defaults to the \`MENORA_INITIALIZR_URL\` environment variable, falling back to \`http://localhost:8080\`.
- \`{ fetch }\` and \`{ timeoutMs }\` overrides for non-default runtimes.`,
        codeExamples: [
          {
            title: 'Anthropic SDK integration',
            language: 'typescript',
            code: `import Anthropic from "@anthropic-ai/sdk";
import {
  InitializrClient, anthropicTools, executeAgentTool,
} from "@menora/initializr-client";

const claude = new Anthropic();
const menora = new InitializrClient();

const response = await claude.messages.create({
  model: "claude-opus-4-7",
  max_tokens: 4096,
  tools: anthropicTools(),                  // 4 tools, full schemas
  messages: [{
    role: "user",
    content: "Scaffold a Spring Boot 3.2.1 project with Spring Web and JPA.",
  }],
});

for (const block of response.content) {
  if (block.type === "tool_use") {
    const result = await executeAgentTool(block.name, block.input, menora);
    // ...feed result back into the next messages.create() call
  }
}`
          },
          {
            title: 'Plain client usage',
            language: 'typescript',
            code: `import { InitializrClient } from "@menora/initializr-client";

const client = new InitializrClient();

const cap = await client.manifest();
const project = await client.scaffold({
  bootVersion: cap.defaultBootVersion!,
  dependencies: ["web", "data-jpa", "postgresql"],
  opts: { postgresql: ["pg-primary"] },
});

console.log(\`generated \${project.files.length} files\`);
console.log("manifest:", project.manifest.inputs);`
          }
        ]
      },
      {
        id: 'agent-mcp',
        title: 'MCP Server (Claude Code)',
        description: 'Model Context Protocol server fronting the agent contract.',
        content: `### Where It Lives
\`mcp-server/\` in the monorepo. Thin Node project that wraps the TypeScript SDK as MCP tools so Claude Code (and any MCP client) can drive scaffolding natively.

### Setup
\`\`\`bash
cd mcp-server
npm install
npm run build
claude mcp add menora-initializr -- node /abs/path/to/mcp-server/dist/index.js
\`\`\`

Set \`MENORA_INITIALIZR_URL\` if the backend isn't on \`http://localhost:8080\`.

### Tools Exposed

| Tool | Backing endpoint |
|---|---|
| \`list_capabilities\` | \`GET /agent/manifest\` |
| \`scaffold_project\` | \`POST /agent/scaffold\` |
| \`detect_openapi_paths\` | \`POST /starter-wizard.detect-paths\` |
| \`detect_wsdl_services\` | \`POST /starter-wizard.detect-services\` |

### Using From Claude Code
Once registered, prompts like the following work without any extra context:

> "Use menora-initializr to scaffold a Spring Boot 3.2.1 service with web, data-jpa, and postgresql."

Claude Code will call \`list_capabilities\` to validate inputs, then \`scaffold_project\`, then write the files to disk and continue the task.

### Transport
Stdio only in v1. SSE/HTTP for remote agents is on the roadmap; for now, run the MCP server alongside the agent (or in the same container).`,
        callouts: [
          {
            type: 'tip',
            text: 'The MCP server uses the local TypeScript SDK via "@menora/initializr-client": "file:../clients/typescript". Edits to the SDK are picked up after rebuilding both packages.'
          }
        ]
      },
      {
        id: 'agent-workflow',
        title: 'End-to-End: AI Agent Builds a Project',
        description: 'Walkthrough of an agent scaffolding then continuing with business logic.',
        content: `Use this workflow as a reference for how an agent should drive the contract end-to-end.`,
        workflowSteps: [
          {
            title: 'Discovery',
            description: 'Agent calls list_capabilities (or GET /agent/manifest). Caches the response. Picks a Boot version from bootVersions, filters dependencies[] by compatibilityRange, and resolves any sub-option ids it needs.'
          },
          {
            title: 'Optional Wizard Validation',
            description: 'If the agent has an OpenAPI spec or WSDL to feed in, it calls detect_openapi_paths / detect_wsdl_services first. A 400 here means the spec is broken — the agent fixes it before scaffolding rather than getting a partial project.'
          },
          {
            title: 'Scaffold',
            description: 'Agent calls scaffold_project with the resolved inputs. The response includes a manifest plus a JSON file tree.'
          },
          {
            title: 'Write Files to Disk',
            description: 'Agent walks files[] and writes each one under its target directory, decoding base64 entries first. The .menora-init.json sits at the project root.'
          },
          {
            title: 'Continue With Business Logic',
            description: 'Agent edits/adds files freely. The manifest at the root tells it which files came from the scaffold (and at what sha) versus which it added itself.'
          },
          {
            title: 'Compile & Test',
            description: 'Standard mvn verify or equivalent. The scaffold ships a working pom.xml, so the agent should not need to touch the build before its first compile.'
          }
        ]
      }
    ]
  }
]
