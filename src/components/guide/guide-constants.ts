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
  // 2. DEPENDENCY GROUPS
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
Applies variable substitution to the content, then writes it to the target path. The type of substitution depends on the \`substitutionType\` field (see below). The file extension \`.mustache\` is cosmetic only — no real Mustache engine is used.

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
        title: 'Template Substitution',
        description: 'Variables available in TEMPLATE file contributions.',
        content: `### Substitution Types

**NONE** — no substitution is performed. The content is written exactly as stored.

**PROJECT** — replaces the following variables with project metadata:
- \`{{artifactId}}\` — the project artifact ID
- \`{{groupId}}\` — the project group ID
- \`{{version}}\` — the project version (e.g. \`0.0.1-SNAPSHOT\`)

**PACKAGE** — replaces:
- \`{{packageName}}\` — the base package name (e.g. \`com.menora.demo\`)

### Target Path Variables
The **target path** (not just the content) can also use the variable \`{{packagePath}}\`, which is the package name with dots replaced by slashes. This is used to place Java source files in the correct directory.

**Example:** A \`KafkaConfig.java\` template with target path \`src/main/java/{{packagePath}}/config/KafkaConfig.java\` gets written to \`src/main/java/com/menora/demo/config/KafkaConfig.java\` for a project with package \`com.menora.demo\`.`,
        codeExamples: [
          {
            title: 'PROJECT substitution — Dockerfile example',
            language: 'dockerfile',
            code: `FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY target/{{artifactId}}-*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]`
          },
          {
            title: 'PACKAGE substitution — Java config class example',
            language: 'java',
            code: `package {{packageName}}.config;

import org.springframework.context.annotation.Configuration;

@Configuration
public class KafkaConfig {
    // Kafka configuration for {{packageName}}
}`
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
          { name: 'substitutionType', type: 'SubstitutionType', required: false, description: 'Variable substitution mode: NONE (default), PROJECT (artifactId/groupId/version), PACKAGE (packageName).', example: 'PACKAGE' },
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
7. Click **Generate** or **Explore** — the UI switches to POST \`/starter-sql.zip\` / \`/starter-sql.preview\` with a JSON body, and entities/repositories appear in the downloaded project and file tree.`,
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
| \`POST\` | \`/starter-sql.zip\` | Generate ZIP with entities/repositories |
| \`POST\` | \`/starter-sql.preview\` | File tree + contents (same shape as \`/starter.preview\`) |
| \`POST\` | \`/starter-sql.tables\` | Server-side parse: \`{ sql }\` → \`["users", "orders", ...]\` |

### Why a New POST Endpoint
\`/starter.zip\` is a GET whose query string carries all generation inputs. A few \`CREATE TABLE\` statements easily exceed typical URL length limits (~2–8 KB). A sibling POST endpoint that accepts the same fields plus \`sqlByDep\` / \`sqlOptions\` is the cleanest answer — no server-side session state, and the GET flow stays untouched for users who don't need the wizard.`,
        codeExamples: [
          {
            title: 'Generate a project with a users entity and its repository',
            language: 'bash',
            code: `curl -o demo.zip -X POST http://localhost:8080/starter-sql.zip \\
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
  // 11. COMMON WORKFLOWS
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
            description: 'Go to Config → File Contributions. For each file to inject (e.g. application-mylib.yml for YAML config, MyLibConfig.java for a Java config class), click + Add. Set dependencyId to your new depId, fileType (YAML_MERGE for YAML, TEMPLATE for Java), targetPath, content, substitutionType (PACKAGE for Java files), and sortOrder.'
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
            description: 'Enter the target path within the generated project (e.g. scripts/setup.sh). For TEMPLATE type, use substitution variables like {{artifactId}} and set substitutionType to PROJECT.'
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
            description: 'Go to File Contributions → + Add. Set: dependencyId = __common__, fileType = TEMPLATE, targetPath = Dockerfile, substitutionType = PROJECT, javaVersion = 17. Write the Dockerfile content using eclipse-temurin:17-jre-alpine base image. Include {{artifactId}} in the COPY command.'
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
  }
]
