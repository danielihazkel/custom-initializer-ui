import type { GuideSection } from './guide-types'

export const GUIDE_SECTIONS: GuideSection[] = [
  // ─────────────────────────────────────────────────────────────────
  // SYSTEM OVERVIEW
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
This tool is Menora's internal project generator. Developers describe a project, click **Generate**, and get a ZIP that builds against Menora's Artifactory and follows the company's standards. Three tabs make three kinds of project:

- **Backend** — a Spring Boot service (Maven, Java 17 or 21, Boot 3.2 or 3.5), single-module or multi-module. Four wizards can write code into it: entities from a SQL schema or a live database, controllers and clients from an OpenAPI document, SOAP endpoints and clients from a WSDL, and Kafka producers and listeners from an AsyncAPI document.
- **Frontend** — a React + TypeScript + Vite application.
- **Fullstack** — a working CRUD application, Spring backend and React frontend together, from an entity model: pages and dashboards, workflows, access rules, generated tests.

### What Every Backend Contains
- The Artifactory repositories and \`settings.xml\`
- Log4j2 with Menora's JSON log formats (Logback excluded), and Lombok
- A \`Dockerfile\` for the selected Java version, \`k8s/Jenkinsfile\`, \`k8s/values.yaml\` and \`entrypoint.sh\`
- A local Vault connection: a \`vault-local\` profile that turns on when \`VAULT_TOKEN\` is set in the environment or in the git-ignored \`.env\`
- Per-dependency configuration (\`application.yaml\` sections, config classes, sample code behind sub-options)
- A \`compose.yaml\` and a \`compose\` profile when a dependency needs a service (a database, Kafka, Redis, MongoDB)
- \`menora-model.json\` — the request the project was made from, so the generator can reopen it and produce an update later
- \`.editorconfig\` and \`VERSION\`

### Why Not start.spring.io?
The public Spring Initializr knows nothing about Menora's Artifactory, internal libraries, file templates, required exclusions, Vault or deployment files, and it has no wizards, no fullstack generator and no way to update a project it made. This backend adds all of that on top of the same Spring Initializr framework that powers start.spring.io.

### Admin vs. Application
The **application** is what developers use: the three tabs, plus this Guide and Training. The **admin** (Config) is the control plane: what is configured there decides what goes into generated projects, and its History and Activity tabs show who changed the catalog and what was generated. This guide is written for admins, with the generator tabs explained where an admin needs them.`,
      },
      {
        id: 'overview-pipeline',
        title: 'Generation Pipeline',
        description: 'How a ZIP is assembled from admin configuration at request time.',
        content: `### Request Flow
When a developer clicks Generate on the Backend tab, the following happens:

1. **HTTP request** — \`GET /starter.zip\` with query parameters (\`groupId\`, \`artifactId\`, \`dependencies\`, \`bootVersion\`, \`javaVersion\`, sub-options as \`opts-kafka=consumer-example\`…). A request with wizard documents goes to \`POST /starter-wizard.zip\`, one with modules to \`GET /starter-multimodule.zip\`; the fullstack and frontend tabs have endpoints of their own. Every one of them builds the same kind of project request, with the defaults from the metadata, so an unknown Boot or Java version is a 400 everywhere.
2. **Filters** — when the access gate is on, a request without the \`userinfo\` header is refused (403). \`InitializrWebConfiguration\` fills in the \`configurationFileFormat\` some clients leave out, reads the sub-options, and applies the **compatibility rules**: a dependency another one REQUIRES is added, and two that CONFLICT are a 400 naming both and the reason.
3. **Framework** starts a child Spring context for the request and calls the three registered \`ProjectGenerationConfiguration\`s:
   - **\`DynamicProjectGenerationConfiguration\`** reads the catalog from the database: the **file contributor** writes, merges and templates every file contribution of the selected dependencies (plus \`__common__\`), filtered by Java version and sub-option; the **delete contributor** runs last and removes files Menora does not want (\`application.properties\`, the Maven wrapper); the **build customizer** adds dependencies, exclusions, repositories and BOMs, each row filtered by its sub-option and Boot range. The four wizards write their code here too, and \`menora-model.json\` is written last.
   - **\`FullstackProjectGenerationConfiguration\`** adds the entity code of a fullstack request (and does nothing otherwise).
   - **\`LocalRunGenerationConfiguration\`** writes \`compose.yaml\` and the \`compose\` profile for the dependencies that need a service.
4. **ZIP** is assembled and returned. The generation is recorded in the audit, off the request thread.

### What the Database Decides, and What a Release Does
Everything an admin edits is a database row: dependencies and their groups, file contributions, build customizations, sub-options, compatibility rules, starter and module templates, the fullstack template sets and examples, palettes, versions, departments, schema sources. A change saved in the admin reaches the next generation without a restart.

Some output is shipped with the application instead and changes only with a release: the wizards' code templates, the compose services, the fullstack Flyway migrations, \`menora-model.json\` and the rules a fullstack request is checked against. Catalog rows that nobody has edited also follow a release — see **Catalog Sync** under Admin Operations.`,
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
        description: 'What Refresh Data is for now that admin saves refresh the catalog themselves.',
        content: `### The Catalog Cache
The backend keeps the dependency metadata (groups, entries, sub-options, compatibility ranges, versions) in memory, so the generator's form does not read the database on every request.

### Saves Refresh It for You
Every change made through the admin screens — a group, an entry, a sub-option, a compatibility rule, a palette, a version, an import, an undo or restore from History — reloads that cache as part of the save. The dependency picker shows the change on its next load; nothing needs clicking.

### When to Click Refresh Data
**Refresh Data** (top right of the admin, \`POST /admin/refresh\`) is for changes the admin screens did not make — rows edited directly in the database. It reloads the catalog and reports any dependency it had to skip (a bad compatibility range, an unknown scope…): such a row would otherwise just vanish from the picker. No restart is needed.

### What Is Never Cached
File contributions and build customizations are read from the database on every generation, so a change to one reaches the next project generated.`,
        callouts: [
          {
            type: 'tip',
            text: 'If a dependency you added does not show in the picker, click Refresh Data and read its answer: a dependency that fails to load is listed there with the reason.'
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // DEPENDENCY GROUPS
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
The system seeds the following groups on first startup: **Menora Standards**, **Web**, **Data**, **Messaging**, **Security**, **Observability**, **Communication** and **Utilities**.

Groups and dependency entries are seeded once, into an empty database. Unlike file contributions and build customizations, they do not follow a release afterwards (see **Catalog Sync**): a dependency a new release ships is added by an admin, or by importing a configuration.

### Ordering
Groups appear in the dependency picker in \`sortOrder\` ascending order. Use the **drag-to-reorder** feature in the Dep Groups admin tab — drag a row to the desired position, then click **Save Order**.`,
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
1. Go to **Config → Dep Groups**.
2. Click **New Group**.
3. Enter the **name** and an optional initial sort order.
4. Click **Save**. The group is in the generator's catalog at once.

### Editing a Group
Click the pencil icon on any row to open the edit drawer, change the name and save.

### Reordering Groups
Click and drag the grip handle (⠿) on the left of any row to reorder. A **Save Order** button appears — click it to persist the new sequence.

### Deleting a Group
Click the trash icon. If the group contains dependencies, you will see a **conflict warning** listing the orphaned entries. You can either:
- **Cancel** and delete or move the dependencies first, or
- Check **Force delete** to cascade-delete all child dependencies (and their associated file contributions, build customizations, etc.).`,
        callouts: [
          {
            type: 'warning',
            text: 'Force-deleting a group removes all its child dependencies and every file contribution, build customization, sub-option and rule attached to them. Every row removed is recorded in the History tab, where the whole delete can be undone as one request.'
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // DEPENDENCY ENTRIES
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

### Three Kinds of Entry
- **A Spring Boot starter** — leave the Maven coordinates blank and the Spring Initializr framework adds \`org.springframework.boot:spring-boot-starter-<depId>\` (\`web\`, \`data-jpa\`, \`actuator\`…), its version managed by Spring Boot. Only name an entry this way when that starter exists.
- **A library** — fill in \`mavenGroupId\`/\`mavenArtifactId\` (and a version when the Boot BOM does not manage it); the artifact goes into the pom.
- **A file-only option** — tick **File-only option** (\`starter: false\`): nothing is added to the pom, and selecting the entry only brings its file contributions, build customizations and sub-options. \`ldap-auth\`, \`ldap-auth-rest\`, \`logging\`, \`file-handler-utils\` and \`mail-sampler\` work this way (\`mail-sampler\`'s build customization adds \`spring-boot-starter-mail\`). The form warns when a build customization adds a pom dependency for the id, which is what \`mail-sampler\` wants.

### The Dependency Picker
Entries appear in the dependency picker grouped by their parent group, hidden when the selected Boot version is outside their \`compatibilityRange\`. The user's selection is the set of \`depId\` values sent in the generation request as the \`dependencies\` parameter; the server then applies the compatibility rules to it (see **Compatibility Rules**).

### Backend and Frontend Catalogs
Each entry belongs to one catalog (\`projectKind\`: BACKEND or FRONTEND). The pill at the top of the admin switches every catalog tab between the two.`
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
          { name: 'starter', type: 'boolean', required: false, description: 'The form\'s File-only option, inverted: false means nothing is added to the pom for this entry. Default true.', example: 'false' },
          { name: 'compatibilityRange', type: 'string', required: false, description: 'Spring Boot version range (for a frontend entry, a React range). If set, the dependency is hidden in the UI when the selected version is outside this range. Blank means compatible with all versions.', example: '[3.2.0,4.0.0)' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'Display order within the group. Lower values appear first.', example: '0' },
          { name: 'projectKind', type: 'BACKEND | FRONTEND', required: true, description: 'Which catalog the entry belongs to — set by the admin pill when the entry is created.', example: 'BACKEND' }
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
  // FILE CONTRIBUTIONS
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

**Example use cases:** \`.editorconfig\`, \`entrypoint.sh\`, \`settings.xml\`

### YAML_MERGE
Deep-merges the YAML content into the target file. If the target file doesn't exist yet, it is created. If it already has content (from a previous contribution or the framework), the new YAML is merged into it key-by-key, with nested maps recursively merged and scalar values overwritten.

This is the primary way multiple dependencies each contribute their section to \`application.yaml\` without overwriting each other.

**Example use cases:** Kafka bootstrap-servers section, JPA datasource section, management endpoints config.

### TEMPLATE
Applies variable substitution to the content, then writes it to the target path. When \`substitutionType\` is MUSTACHE, the content is rendered through a real Mustache engine (\`com.samskivert:jmustache\`), giving you both variable substitution and conditional sections (see below).

**Example use cases:** \`Dockerfile\` (needs artifactId), \`KafkaConfig.java\` (needs package name), \`k8s/values.yaml\` and \`log4j2-spring.xml\` (need the department).

### DELETE
Marks a file for deletion. The delete contributor runs at the lowest priority (after all writes), so it removes files that the framework or earlier contributors wrote. No \`content\` field is needed.

**Example use case:** The Spring Initializr framework always writes \`application.properties\` and the Maven wrapper. Menora projects use \`application.yaml\` and build with \`mvn\` and \`settings.xml\`, so DELETE contributions remove \`application.properties\`, \`mvnw\`, \`mvnw.cmd\` and the wrapper's properties file.

### Checked When Saved
Saving a contribution checks its content by the target's extension (Java, YAML, XML, JSON, SQL, properties). A TEMPLATE, or a YAML_MERGE rendered with MUSTACHE, is first rendered with every section switched on, so a template that breaks only under one combination of dependencies is caught too. The target path is checked when a project is generated: a path that would leave the project folder (\`../\`) is refused.`,
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

- **NONE** (the default) — no substitution. Content is written verbatim. Use for files that are the same in every project (.editorconfig, entrypoint.sh, settings.xml).
- **MUSTACHE** — content is rendered through jmustache with the unified context below. Choose it for any template with variables or conditional blocks.

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
- \`{{department}}\`, \`{{departmentUpper}}\`, \`{{departmentName}}\` — the department the developer picked (else the default row of **Config → Departments**), e.g. \`lts\` / \`LTS\`; the k8s values, log4j2 configuration and Vault namespace use them

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
Before Mustache sections, each variation needed its own file contribution row. A class that emits \`@EnableAsync\` only when the async sub-option was selected required two rows with the same \`targetPath\` — one with the annotation, one without. Mustache sections collapse these into one row, keeping the DB catalog simpler and easier to maintain.

### Going Deeper
This page is the quick intro. For the full variable catalog across all three render contexts (backend dependency, fullstack entity, frontend), the path-vs-content rules, and authoring walkthroughs, see the **Mustache Templating** section.`,
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
- \`src/main/resources/application.yaml\` — the base file (TEMPLATE, \`sortOrder\` -1, so every YAML_MERGE lands on it)
- \`Dockerfile\` (TEMPLATE, one row per Java version)
- \`k8s/Jenkinsfile\` and \`k8s/values.yaml\` (TEMPLATE)
- \`entrypoint.sh\`, \`.editorconfig\`, \`settings.xml\` (STATIC_COPY)
- \`VERSION\` (TEMPLATE)
- \`log4j2-spring.xml\`, \`logFormat.json\`, \`detailedLogFormat.json\` (TEMPLATE)
- The local Vault connection: \`.env\`, \`application-vault-local.yaml\`, \`config/VaultLocalEnvironmentPostProcessor.java\` and the \`META-INF/spring.factories\` that registers it (TEMPLATE)
- Deletion of \`application.properties\`, \`mvnw\`, \`mvnw.cmd\` and \`.mvn/wrapper/maven-wrapper.properties\` (DELETE)

### When to Use __common__
Use \`__common__\` when the file should exist in every project. Use a specific \`depId\` when the file is only relevant when that dependency is selected.`,
        callouts: [
          {
            type: 'info',
            text: 'Build customizations also support __common__. That is how every project gets the Artifactory repositories, Log4j2 in place of Logback (with its JSON layout), Lombok, the spring-cloud BOM (one row per Boot range) and the Vault starter.'
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
          { name: 'javaVersion', type: 'string', required: false, description: 'If set, this contribution only applies when the project Java version matches. Leave blank for all versions. (Backend rows.)', example: '21' },
          { name: 'nodeVersion', type: 'string', required: false, description: 'The frontend counterpart of javaVersion: the row only applies when the selected Node version matches. The frontend Dockerfile has one row per Node version. Set in the catalog files or by import; the admin form shows Java Version only.', example: '20' },
          { name: 'subOptionId', type: 'string', required: false, description: 'If set, this contribution only applies when the user selects this sub-option under the parent dependency.', example: 'consumer-example' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'Processing order. Matters when multiple contributions target the same file (e.g. multiple YAML_MERGE into the same application.yaml).', example: '0' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // BUILD CUSTOMIZATIONS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'build-customizations',
    title: 'Build Customizations',
    icon: 'build',
    topics: [
      {
        id: 'build-custom-types',
        title: 'Customization Types',
        description: 'The four backend (pom.xml) types and the three frontend (package.json, Vite) types.',
        content: `### ADD_DEPENDENCY
Adds a Maven \`<dependency>\` entry to the generated \`pom.xml\`. Requires \`mavenGroupId\` and \`mavenArtifactId\`. The version is optional (BOM-managed dependencies don't need one).

When the build already holds a dependency with the same coordinates — the catalog entry itself — the row **replaces** it instead of adding a second one. That is how one dependency gets another version on another Spring Boot line: \`openapi\` (springdoc) has a row ranged \`[3.4.0,4.0.0)\` that swaps in 2.8.x on Boot 3.4 and later.

**Example use cases:**
- Adding \`spring-boot-starter-log4j2\` as a replacement for Logback
- Adding \`lombok\` to every project
- Adding \`spring-boot-starter-mail\` when the mail-sampler dependency is selected

### EXCLUDE_DEPENDENCY
Adds a Maven \`<exclusion>\` to a dependency. Used to remove transitive dependencies that conflict with your additions.

Requires:
- \`excludeFromGroupId\` + \`excludeFromArtifactId\` — the artifact to add the exclusion to
- \`mavenGroupId\` + \`mavenArtifactId\` — the transitive dependency to exclude

The row writes the "exclude from" artifact itself, so it **adds that artifact when the build does not have it yet**. That is how every project gets \`spring-cloud-starter-vault-config\` (without \`httpclient5\`).

**Example use case:** Excluding \`spring-boot-starter-logging\` (Logback) from \`spring-boot-starter\` so it doesn't conflict with Log4j2.

### ADD_REPOSITORY
Adds a Maven \`<repository>\` entry to the generated \`pom.xml\`. The \`repoId\` must be unique and is used as the XML \`<id>\`.

**Example use case:** Adding the Menora Artifactory release and snapshot repositories so the generated project can resolve internal artifacts.

### ADD_BOM
Imports a BOM into \`<dependencyManagement>\` (\`<type>pom</type><scope>import</scope>\`). Requires \`mavenGroupId\`, \`mavenArtifactId\` and \`version\`. The version is written to a pom property named after the artifact — \`spring-cloud-dependencies\` → \`<spring-cloud.version>\` — and the BOM refers to it.

**Example use case:** Importing \`spring-cloud-dependencies\` so \`spring-cloud-starter-vault-config\` (the local Vault connection every backend ships) needs no version of its own. There are three such rows, one per Boot range (2023.0.3 for 3.2–3.3, 2024.0.3 for 3.4, 2025.0.3 for 3.5).

### Which Rows Apply
A row applies when its dependency is selected (or it is \`__common__\`), and:
- it has no \`subOptionId\`, or that sub-option is selected (the frontend catalog uses this to add a package only with an option);
- it has no \`compatibilityRange\`, or the project's Spring Boot version is inside it.

### Frontend Types
With the admin pill on **Frontend**, the tab manages the frontend catalog's rows, which reuse the same columns:
- **ADD_NPM_DEPENDENCY** — a \`package.json\` dependency: \`mavenArtifactId\` = package name, \`version\` = semver range, \`scope\` = \`dev\` for \`devDependencies\`.
- **ADD_VITE_PLUGIN** — a plugin in \`vite.config.ts\`: \`mavenGroupId\` = import path, \`mavenArtifactId\` = binding, \`version\` = the call expression.
- **ADD_NPM_SCRIPT** — a \`package.json\` script: \`mavenArtifactId\` = name, \`version\` = command.

Build customizations are read on every generation; a saved row reaches the next project.`,
        fields: [
          { name: 'dependencyId', type: 'string', required: true, description: 'The depId of the parent dependency, or `__common__` to apply to all projects.', example: '__common__' },
          { name: 'customizationType', type: 'CustomizationType', required: true, description: 'Backend: ADD_DEPENDENCY, EXCLUDE_DEPENDENCY, ADD_REPOSITORY, ADD_BOM. Frontend: ADD_NPM_DEPENDENCY, ADD_VITE_PLUGIN, ADD_NPM_SCRIPT.', example: 'ADD_DEPENDENCY' },
          { name: 'compatibilityRange', type: 'string', required: false, description: 'Spring Boot range the row applies to; blank = every version. The form offers it for ADD_DEPENDENCY and ADD_BOM.', example: '[3.4.0,4.0.0)' },
          { name: 'subOptionId', type: 'string', required: false, description: 'The row applies only when this sub-option of its dependency is selected. The admin form shows it for frontend rows; backend rows honour it too.', example: 'comp-dialog' },
          { name: 'scope', type: 'string', required: false, description: 'Frontend npm rows: dev puts the package in devDependencies.', example: 'dev' },
          { name: 'mavenGroupId', type: 'string', required: false, description: 'For ADD_DEPENDENCY: the artifact group. For EXCLUDE_DEPENDENCY: the group of the transitive dependency to exclude.', example: 'org.springframework.boot' },
          { name: 'mavenArtifactId', type: 'string', required: false, description: 'For ADD_DEPENDENCY: the artifact ID. For EXCLUDE_DEPENDENCY: the artifact ID of the dependency to exclude.', example: 'spring-boot-starter-log4j2' },
          { name: 'version', type: 'string', required: false, description: 'Maven version for ADD_DEPENDENCY (leave blank if managed by a BOM), or the BOM version for ADD_BOM.', example: '' },
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
  // SUB-OPTIONS
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

Sub-options are purely additive: they gate file contributions and build customizations that carry their \`optionId\` as \`subOptionId\`, and they set \`opt<Dep><Option>\` flags that templates read. Three kinds are seeded:
- **Sample code** — Kafka's consumer/producer/streams examples, \`web\`'s REST controller and exception handler, \`security\`'s JWT scaffold, and so on.
- **Datasource roles** — every database (\`postgresql\`, \`mssql\`, \`oracle\`, \`db2\`, \`h2\`, \`mongodb\`) has \`<db>-primary\` and \`<db>-secondary\`, which choose its datasource config class. The starter templates select a primary one.
- **Frontend options** — in the frontend catalog, e.g. the shadcn components (\`comp-dialog\`, \`comp-toast\`…), each adding its npm package.

### URL Convention
Sub-options are passed to the generation endpoint as query parameters:

\`opts-{depId}=opt1,opt2\`

For example: \`opts-kafka=consumer-example,producer-example\`

The frontend automatically constructs these parameters when the user checks sub-option boxes.

### How Sub-Options Gate Files and Build Rows
In a file contribution or a build customization, set \`subOptionId\` to the \`optionId\` of the sub-option. The row then only applies if the corresponding \`opts-{depId}\` parameter includes that optionId.

Sub-options are seeded once, like dependency entries: a new option a release ships is added by an admin or an import.`,
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
  // COMPATIBILITY RULES
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
Source dependency **requires** the target dependency. The Backend tab shows a banner offering to add the target. The server adds it to any request that has the source and not the target (when the target is offered for the request's Boot version). Requirements chain: \`ldap-auth-rest\` brings \`web\`, and anything \`web\` required would follow.

**Examples:** \`rqueue REQUIRES data-jpa\`, \`security REQUIRES web\`, \`tracing REQUIRES actuator\`, \`ldap-auth-rest REQUIRES web\`.

### CONFLICTS
Source and target dependencies are **mutually exclusive**. The Backend tab warns while both are selected; the server refuses such a request with a 400 that names both and the rule's description. It never drops one silently: that would generate a project other than the one asked for. A conflict a requirement brings in counts too — \`webflux\` + \`security\` fails, because \`security\` requires \`web\`.

**Examples:** \`web CONFLICTS webflux\`, \`ldap-auth-rest CONFLICTS ldap-auth\`.

### RECOMMENDS
Source dependency **recommends** the target. The UI shows a suggestion, and nothing changes the request.

**Example:** \`data-jpa RECOMMENDS postgresql\` — JPA needs a database driver; PostgreSQL is the company standard.

### Where the Rules Hold
On every backend endpoint — \`/starter.zip\`, the wizard, multi-module (once, over what was asked for, not per module) and fullstack — whether the request came from the UI, curl, IntelliJ or a hand-edited share link. The frontend catalog's rules are applied by the frontend generator, which fixes a selection silently instead. Rules are seeded once; a release's new rules are added by an admin or an import.`,
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
  // STARTER TEMPLATES
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
Backend:
- **REST API Service** — Spring Web, JPA, DB2 (primary datasource), Actuator, Kafka Log Shipping
- **Event-Driven Service** — Kafka (with consumer + producer examples), JPA, PostgreSQL (primary), Actuator, Kafka Log Shipping
- **Microservice (Full Stack)** — Web, Kafka, JPA, PostgreSQL (primary), Security, Actuator, Prometheus, Kafka Log Shipping

The Frontend tab has its own (\`fe-dashboard\`, \`fe-marketing\`, \`fe-saas-app\`); the admin pill switches the Templates tab between the two.

### Template vs. Direct Generation
A template only pre-selects dependencies. If the user changes the dependency selection after clicking a template, the generated output reflects their final selection, not the template definition.

### Templates vs. Team Presets
Starter templates are curated by admins here. Developers can also save a whole Backend-tab setup — form, dependencies, options, modules and wizard documents — as a **team preset** that everyone sees on the Presets strip's Team tab. Team presets are not catalog rows: they are not in the admin, the History or the configuration export.`,
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
In the **Templates** admin tab, the dependencies of every template are a separate **Template Dependencies** table below the templates. **New Dep Mapping** attaches a dependency entry to a template. Optionally enter comma-separated \`subOptions\` (matching optionId values from the Sub-Options table).

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
  // MODULE TEMPLATES
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
1. The developer enables the toggle and selects which modules to include (\`GET /starter-multimodule.zip?modules=api,core,persistence&…\`).
2. The compatibility rules are applied once, to the dependencies the developer selected.
3. The backend generates each module independently using the standard single-module pipeline, with the module's own dependencies from the **Module Dependency Mappings** table plus every selected dependency.
4. Only the module with \`hasMainClass = true\` gets \`@SpringBootApplication\` and the test class. Other modules have those files removed.
5. A parent \`pom.xml\` is generated with \`<packaging>pom</packaging>\` and a \`<modules>\` section listing all sub-module artifact IDs.
6. The project root gets \`menora-model.json\` (one for the whole project), \`.gitattributes\` and — when a dependency needs a service — \`compose.yaml\`, with the \`compose\` profile in the entry module.
7. Everything is zipped together under the top-level project directory.

A request naming no known module is a 400.

### Modules and the Wizards
A request with a wizard document (SQL, OpenAPI, WSDL or AsyncAPI) goes to the wizard endpoint, which always writes **one** module: the wizard's code has no module to go into. The Backend tab warns above the module list while modules are ticked and a selected dependency has a wizard set up; the modules are then not generated.

### Module Artifact IDs
Each module's artifact ID = \`{project artifactId}{module suffix}\`

For a project with \`artifactId = "myapp"\` and a module with \`suffix = "-api"\`, the module artifact ID is \`myapp-api\`.`,
        callouts: [
          {
            type: 'warning',
            text: 'Exactly one module should have hasMainClass = true. If none do, the generated project will not have a main Spring Boot entry point (and gets no compose profile). If several do, each keeps a main class and the first is treated as the entry point.'
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
In the **Modules** admin tab, the mappings are the **Module Dependency Mappings** table below the module templates. **New Mapping** creates a module-dependency association.

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
  // VERSIONS, DEPARTMENTS & PALETTES
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'versions-departments',
    title: 'Versions, Departments & Palettes',
    icon: 'numbers',
    topics: [
      {
        id: 'versions-what',
        title: 'The Version Lists',
        description: 'Which Java, Spring Boot, React, Node and package-manager versions the generator offers.',
        content: `### What They Are
**Config → Versions** holds every version list the three tabs offer, one row per version: \`JAVA\` (21, 17), \`BOOT\` (3.2.1, 3.5.16), \`REACT\` (18, 19), \`NODE\` (20, 22, 18) and \`PACKAGE_MANAGER\` (pnpm, npm). One row per kind is the **default**: what a form opens with, and what an API request that names no version gets (\`/starter.zip\`, the wizard, multi-module and fullstack endpoints alike). A version a request names that is not in the list is a 400.

### Moving a Version On
To follow a newer patch release that Artifactory mirrors, edit the row (e.g. \`3.5.16\` → \`3.5.17\`). A Boot version decides which ranged rows apply — the dependency entries' and build customizations' \`compatibilityRange\` — so check those ranges when adding a new line. A React row carries the npm ranges written into \`package.json\` (\`npmSemver\`, \`typesSemver\`).

New versions a release ships are added on start; a row an admin has edited is kept.`,
        fields: [
          { name: 'kind', type: 'JAVA | BOOT | REACT | NODE | PACKAGE_MANAGER', required: true, description: 'Which list the row belongs to.', example: 'BOOT' },
          { name: 'versionId', type: 'string', required: true, description: 'The value sent in requests and written into projects.', example: '3.5.16' },
          { name: 'displayName', type: 'string', required: true, description: 'What the selector shows.', example: 'Node 20 (LTS)' },
          { name: 'isDefault', type: 'boolean', required: false, description: 'The default of its kind (one per kind).', example: 'true' },
          { name: 'enabled', type: 'boolean', required: false, description: 'A disabled row is not offered.', example: 'true' },
          { name: 'npmSemver / typesSemver', type: 'string', required: false, description: 'React rows: the ranges for react/react-dom and their @types packages.', example: '^18.3.1' }
        ]
      },
      {
        id: 'departments-what',
        title: 'Departments',
        description: 'The department list behind the department variables of every template.',
        content: `### What They Are
**Config → Departments** is the list developers pick their department from on every tab. The department is written into generated projects through \`{{department}}\`, \`{{departmentUpper}}\` and \`{{departmentName}}\`: the k8s values, the log configuration and the Vault namespace (\`<department>/int-lan-01\`) use it. A request that names no department, or one not in the list, gets the **default** row (\`lts\` is seeded). The department is also recorded in the generation audit, where the Activity tab breaks generations down by it.`
      },
      {
        id: 'palettes-what',
        title: 'Color Palettes',
        description: 'The color schemes generated frontends can be built with.',
        content: `### What They Are
**Config → Palettes** (shown with the admin pill on **Frontend**) lists the color schemes the Frontend and Fullstack tabs offer: primary, secondary, and optional accent and error colors. The chosen palette reaches frontend templates as \`{{palette.*}}\` (with HSL forms for CSS variables). One palette is the default. The Menora Digital design system ignores the palette's brand colors (they are its fixed tokens) but still takes its accent and error.`
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // MUSTACHE TEMPLATING (deep reference — mirrors backend/docs/MUSTACHE_GUIDE.md)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'mustache-templating',
    title: 'Mustache Templating',
    icon: 'data_object',
    topics: [
      {
        id: 'mustache-overview',
        title: 'How Rendering Works',
        description: 'The engine, the supported syntax, path-vs-content substitution, and the three contexts.',
        content: `### The Engine
Templates are rendered with **jmustache** (\`com.samskivert:jmustache\`), compiled once per file with HTML escaping **off** (\`Mustache.compiler().escapeHTML(false)\`). The same setup is used on every render path — backend dependency templates, frontend templates, and fullstack entity templates.

Because escaping is off, we emit Java, YAML, Dockerfile, and TypeScript verbatim — characters like \`<\`, \`>\`, \`&\`, \`"\` pass through untouched. One practical consequence: **\`{{{triple}}}\` and \`{{double}}\` braces are equivalent here.** Use double braces.

### Supported Syntax
- \`{{var}}\` — interpolate a value. A **missing key renders as an empty string, not an error.**
- \`{{#flag}}…{{/flag}}\` — section. Renders the body when \`flag\` is truthy (\`true\`, a non-empty list, a non-null non-false value).
- \`{{^flag}}…{{/flag}}\` — inverted section. Renders the body when \`flag\` is falsy (\`false\`, \`null\`, empty list). This is the "else" branch.
- \`{{#list}}…{{/list}}\` — iterate. The body renders once per element, with the element's own keys in scope.
- \`{{.}}\` — the current element itself, inside a list of scalars.
- \`{{!comment}}\` — a comment; not rendered.

### Path vs. Content — Two Different Substitutions
A file contribution has a **target path** and a **content body**, and they are rendered with different rules:
- **Content** is rendered with the full context (when \`substitutionType = MUSTACHE\`).
- **Target path** gets a narrow, hardcoded substitution — backend paths honor only \`{{packagePath}}\`; frontend paths only \`{{projectName}}\`. Fullstack entity-template paths are the exception: the path **is** rendered through the full entity context.

So \`{{javaVersion}}\` works inside a backend file's content but **not** in its target path.

### Three Contexts, Not One
There is no single global context. Three independent builders each produce a variable map, and which one runs depends on which file you are editing — backend dependency templates, fullstack entity templates, or frontend templates. The next pages document each one.`,
        codeExamples: [
          {
            title: 'Section + inverted section (the if/else pattern)',
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
    // Kafka not selected — nothing wired here.
    {{/hasKafka}}
}`
          }
        ],
        callouts: [
          {
            type: 'warning',
            text: 'A missing or misspelled key renders empty, silently — no error. If a value comes out blank in the generated file, suspect a typo in the variable name and check it against the catalog pages.'
          },
          {
            type: 'info',
            text: 'HTML escaping is off everywhere, so {{{triple}}} braces are never needed — {{double}} braces already emit raw text.'
          }
        ]
      },
      {
        id: 'mustache-which-context',
        title: 'Which Context Am I In?',
        description: 'Find the file you are editing to know which variables are available.',
        content: `### Pick by the file you are editing
The available variables depend entirely on which render path the file belongs to:

- **\`catalog/file-contributions.json\` content** (backend dependency files, e.g. \`templates/h2-config-primary.mustache\`) → **Backend Dependency Context** only.
- **\`catalog/frontend/file-contributions.json\` content** (frontend dependency files) → **Frontend Context** only.
- **\`templates/fullstack/<backend-set>/\` files** (e.g. \`spring-jpa-crud\`) → **Fullstack Entity Context** (plus \`optScaffold*\` flags and \`hasValidation\`).
- **\`templates/fullstack/<frontend-set>/\` files** (e.g. \`react-tailwind-crud\`) → **Fullstack Entity Context merged with Frontend Context** — these templates see both entity variables and the frontend dep/palette/version variables.

### Universal flags
One convention spans every context: for each selected dependency, a boolean \`has<Dep>\` is set; for each selected sub-option, \`opt<Dep><Option>\`. These are the "is X selected?" checks everywhere. The department variables (\`department\`, \`departmentUpper\`, \`departmentName\`) are in every context too.

### Not editable here
The wizards' code (\`templates/wizard/**\` — SQL entities, OpenAPI controllers and clients, SOAP endpoints, Kafka producers and listeners, the multi-module parent POM) is Mustache too, but these are files shipped with the application, not catalog rows: they are written against a Java view-model an admin edit could not follow, so they change only with a release.`
      },
      {
        id: 'mustache-backend-context',
        title: 'Backend Dependency Context',
        description: 'Variables for every backend TEMPLATE file (buildBaseContext).',
        content: `### Source
\`DynamicProjectGenerationConfiguration.buildBaseContext(...)\`. This is the context for every backend \`TEMPLATE\` file declared in \`catalog/file-contributions.json\`, including the H2/Oracle/Postgres datasource config classes.

### Dependency & sub-option flags
For every **selected** dependency a boolean \`has<Dep>\` is set to true; for every selected sub-option, \`opt<Dep><Option>\`. Unselected deps have no key at all (so \`{{#hasKafka}}\` is simply false when kafka isn't picked). The id → flag transform is PascalCase, treating \`-\`, \`_\`, and \`.\` as word separators:

- \`kafka\` → \`hasKafka\`
- \`mail-sampler\` → \`hasMailSampler\`
- \`spring-boot-starter\` → \`hasSpringBootStarter\`
- sub-option \`consumer-example\` of \`kafka\` → \`optKafkaConsumerExample\`

### The ds* family (scaffolded datasource)
\`hasScaffoldedEntities\`, \`dsEntityPackage\`, and \`dsRepositoryPackage\` exist so a per-driver datasource config can scan **where generated entities actually live** instead of a hardcoded \`<packageName>.<driver>\` convention. They are populated only when the request scaffolds entities (fullstack **or** the SQL wizard); otherwise \`hasScaffoldedEntities\` is false and the two package keys are null. That is exactly why the H2 template pairs a \`{{#hasScaffoldedEntities}}\` branch with a \`{{^hasScaffoldedEntities}}\` fallback — see the H2Config walkthrough.

A fullstack project also puts entities outside those two packages (attachments, saved views, change history, the events outbox). \`dsExtraPackages\` lists them and \`dsHasExtraPackages\` says whether there are any; every \`*-config-primary\` template must scan them too, or the application does not start.`,
        fields: [
          { name: '{{artifactId}}', type: 'String', required: true, description: 'Project artifact id.', example: 'demo' },
          { name: '{{groupId}}', type: 'String', required: true, description: 'Project group id.', example: 'com.menora' },
          { name: '{{version}}', type: 'String', required: true, description: 'Project version.', example: '0.0.1-SNAPSHOT' },
          { name: '{{packageName}}', type: 'String', required: true, description: 'Base package, dotted form.', example: 'com.menora.demo' },
          { name: '{{packagePath}}', type: 'String', required: true, description: 'packageName with dots replaced by slashes. The one placeholder also allowed in target paths.', example: 'com/menora/demo' },
          { name: '{{javaVersion}}', type: 'String', required: true, description: 'Selected JDK version.', example: '21' },
          { name: '{{packaging}}', type: 'String', required: false, description: 'Packaging id; null if unset.', example: 'jar' },
          { name: '{{department}} / departmentUpper / departmentName', type: 'String', required: true, description: 'The department the request named, else the default row of Config → Departments.', example: 'lts / LTS / LTS' },
          { name: 'has<Dep>', type: 'boolean', required: false, description: 'True for each selected dependency (PascalCased id). Absent when not selected.', example: 'hasKafka' },
          { name: 'opt<Dep><Option>', type: 'boolean', required: false, description: 'True for each selected sub-option (PascalCased dep + option).', example: 'optKafkaConsumerExample' },
          { name: '{{hasScaffoldedEntities}}', type: 'boolean', required: true, description: 'True when the request scaffolds entities (fullstack or SQL wizard).', example: 'true' },
          { name: '{{dsEntityPackage}}', type: 'String', required: false, description: 'Package the generated entities land in; null unless hasScaffoldedEntities.', example: 'com.menora.demo.entity' },
          { name: '{{dsRepositoryPackage}}', type: 'String', required: false, description: 'Package the generated repositories land in; null unless hasScaffoldedEntities.', example: 'com.menora.demo.repository' },
          { name: '{{dsExtraPackages}} / dsHasExtraPackages', type: 'List / boolean', required: true, description: 'Further packages holding a fullstack project\'s own entities and repositories (attachments, views, history, events); empty otherwise.', example: '{{#dsExtraPackages}}, "{{.}}"{{/dsExtraPackages}}' }
        ],
        codeExamples: [
          {
            title: 'Datasource gate — scan scaffolded packages or fall back',
            language: 'java',
            code: `@EnableJpaRepositories(
    basePackages = "{{#hasScaffoldedEntities}}{{dsRepositoryPackage}}{{/hasScaffoldedEntities}}{{^hasScaffoldedEntities}}{{packageName}}.h2.repository{{/hasScaffoldedEntities}}"
)`
          }
        ]
      },
      {
        id: 'mustache-fullstack-context',
        title: 'Fullstack Entity Context',
        description: 'Variables for entity template sets (EntityScaffoldContext): project, per-entity, fields, relations.',
        content: `### Source
\`EntityScaffoldContext\`, built in two stages — \`buildProjectContext\` (project-wide) and \`buildEntityContext\` (project-wide plus one entity). The view-model itself is split by area into classes beside it: \`EntityViewModel\`, \`FieldViewModel\`, \`RelationViews\`, \`FeatureContext\`, \`PageContext\`, \`DashboardContext\`, \`TemplateText\`, \`SchemaNames\`. A \`perEntity: true\` file renders once per user entity; a \`perPage: true\` file once per page of the layout; any other file once with the project context (and can loop all entities via \`{{#entities}}\`).

### Layer packages (project-wide)
Each also has a \`…Path\` slash-form variant: \`entityPackage\` / \`entityPackagePath\`, \`repositoryPackage\`, \`dtoPackage\`, \`servicePackage\`, \`controllerPackage\`, all derived from \`domainPackage\` (defaults to \`packageName\`). The \`fields\` table below lists the per-entity keys.

### Per-field variables (inside {{#fields}}, {{#pkFields}}, …)
\`name\`, \`Name\` (PascalCase), \`column\`, \`javaType\`, \`tsType\`, \`enumTypeName\`; predicates \`isPrimaryKey\`, \`isGenerated\`, \`isRequired\`, \`isUnique\`, \`isString\`, \`isNumeric\`, \`isIntegral\`, \`isBigDecimal\`, \`isBoolean\`, \`isTemporal\`, \`isDate\`, \`isDateTime\`, \`isEnum\`, \`isReadOnly\`; constraints \`hasLength\`/\`length\`, \`hasMin\`/\`min\`, \`hasMax\`/\`max\`, \`hasPattern\`/\`pattern\`/\`patternEscaped\`, \`isEmail\`; \`enumValues\` (each with its \`label\`); defaults (\`hasDefault\`, \`defaultJava\`, \`defaultTs\`); and iteration flags \`first\`/\`last\`.

### Relations — three lists
- \`{{#relations}}\` — the **foreign keys** (MANY_TO_ONE): \`fieldName\`, \`FieldName\`, \`fkFieldName\`, \`joinColumn\`, \`targetEntity\` (+ \`Camel\`/\`Kebab\`/\`KebabPlural\`), \`targetPkName\`/\`targetPkJavaType\`/\`targetPkTsType\`, \`targetLabelField\`/\`hasTargetLabel\`, \`required\`, \`last\`.
- \`{{#collections}}\` / \`hasCollections\` — MANY_TO_MANY links through a join table.
- \`{{#childLists}}\` / \`hasChildLists\` — ONE_TO_MANY: the rows of another entity that point at this one (a \`composition\` one is edited in this entity's form).

### Scaffold options
Every value of the request's \`opts.scaffold\` becomes an \`optScaffold<Option>\` flag on both render paths, from one list (\`ScaffoldOption\`): \`audit\`, \`softDelete\`, \`csvExport\`, \`bulkDelete\`, \`bulkUpdate\`, \`tests\`, \`csvImport\`, \`optimisticLocking\`, \`inlineEdit\`, \`xlsxExport\`, \`savedViews\`, \`history\`, \`events\` (all of these per entity too, through the entity's \`opts\` overrides), \`inverseCollections\`, \`openapi\`, \`seedData\`. \`secured\` is retired: access is now each entity's \`access\` levels, enforced whenever an ldap-auth dependency is on the build. Templates mostly read the derived per-entity flags rather than the raw option — \`auditApplicable\`, \`softDeleteApplicable\`, \`lockingApplicable\`, \`importApplicable\`… — which also account for read-only entities, views and composite keys. Plus \`hasValidation\` on the backend path.

### Page layouts
The frontend context also carries the layout (\`pages\`, \`navPages\`, \`routePages\`, the per-page view-model a \`perPage\` file renders with, widget lists…). It is large and changes with each round; \`backend/docs/MUSTACHE_GUIDE.md\` (§4f) lists it.`,
        fields: [
          { name: '{{EntityName}} / entityName / entity_name / entityNameKebab', type: 'String', required: true, description: 'Entity name in Pascal / camel / snake / kebab case. Plural variants exist for each.', example: 'OrderItem / orderItem / order_item / order-item' },
          { name: '{{tableName}}', type: 'String', required: true, description: 'Table name override or plural snake fallback.', example: 'order_items' },
          { name: '{{entityPackage}} / entityPackagePath', type: 'String', required: true, description: 'Entity layer package (and slash form). Same pattern for repository/dto/service/controller.', example: 'com.menora.demo.entity' },
          { name: '{{fields}} / nonPkFields / pkFields / stringFields', type: 'List', required: true, description: 'Field view-models to iterate; pkField is the single-PK shortcut (may be null).', example: '{{#fields}}…{{/fields}}' },
          { name: '{{hasCompositePk}} / keyClassName / pkType / pkPath', type: 'mixed', required: true, description: 'Composite-key flag, generated <Entity>Id class name, id type, and REST path segment.', example: '/{orderId}/{lineNo}' },
          { name: '{{relations}} / hasRelations', type: 'List / boolean', required: true, description: 'MANY_TO_ONE foreign-key relations.', example: '{{#relations}}…{{/relations}}' },
          { name: '{{collections}} / hasCollections', type: 'List / boolean', required: true, description: 'MANY_TO_MANY links through a join table.', example: '{{#collections}}…{{/collections}}' },
          { name: '{{childLists}} / hasChildLists', type: 'List / boolean', required: true, description: 'ONE_TO_MANY lists of the child rows that point at this entity (including the one inverseCollections derives).', example: '{{#childLists}}…{{/childLists}}' },
          { name: 'has*Fields aggregates', type: 'boolean', required: true, description: 'hasEnumFields, hasStringFields, hasNotNullFields, hasSizeFields, hasMinFields, hasMaxFields, hasDecimalMinFields, hasDecimalMaxFields, hasPatternFields, hasEmailFields — true iff some field needs that import.', example: 'hasEmailFields' },
          { name: 'optScaffold<Option>', type: 'boolean', required: false, description: 'One flag per opts.scaffold value (ScaffoldOption), resolved per entity against its overrides.', example: 'optScaffoldAudit' },
          { name: '<feature>Applicable', type: 'boolean', required: false, description: 'Whether an option really applies to this entity (writable, table-backed, single key… as the option needs).', example: 'softDeleteApplicable' },
          { name: '<key>Ts / <key>Attr / <key>Jsx / <key>Comment', type: 'String', required: false, description: 'User-typed text (labels, dashboard title and overview) escaped for a TS string, a JSX attribute, JSX children or a comment. Frontend templates use these, never the raw {{label}}.', example: '{{entityLabelTs}}' }
        ],
        codeExamples: [
          {
            title: 'Manifest entry — gate a file with gatedBy',
            language: 'json',
            code: `{
  "source": "EntityApiTest.java.mustache",
  "path": "src/test/java/{{controllerPackagePath}}/{{EntityName}}ApiTest.java",
  "perEntity": true,
  "substitutionType": "MUSTACHE",
  "fileType": "TEMPLATE",
  "sortOrder": 62,
  "gatedBy": "apiTestApplicable"
}`
          },
          {
            title: 'Entity template — iterate fields',
            language: 'java',
            code: `public class {{EntityName}}Dto {
{{#fields}}
    private {{javaType}} {{name}};
{{/fields}}
}`
          }
        ],
        callouts: [
          {
            type: 'warning',
            text: 'Labels are whatever the user typed, Hebrew quotes and apostrophes included. A frontend template that splices {{label}}, {{entityLabel}}, {{entityLabelPlural}}, {{dashboardTitle}} or {{dashboardOverview}} raw can produce a project that does not compile; use the escaped forms (…Ts, …Attr, …Jsx). A test in the backend fails on a raw splice in a shipped template; one edited in the admin is not checked.'
          },
          {
            type: 'info',
            text: 'gatedBy accepts any truthy context flag — an opt-in like optScaffoldTests or a derived flag like hasCompositePk (used by the EntityId.java row) or apiTestApplicable.'
          }
        ]
      },
      {
        id: 'mustache-frontend-context',
        title: 'Frontend Context',
        description: 'Variables for frontend TEMPLATE files (FrontendMustacheContext).',
        content: `### Source
\`FrontendMustacheContext.build(...)\`. Feeds every frontend \`TEMPLATE\` file in \`catalog/frontend/file-contributions.json\`, and is merged onto the entity context for fullstack frontend templates.

### Dependency / palette flags
Same \`has<Dep>\` / \`opt<Dep><Option>\` PascalCase convention as the backend (e.g. \`hasRouterReactRouter\`, \`optAuthMsalInitConfig\`). The color palette is a nested \`palette\` map — \`palette.primary\`, \`palette.secondary\`, \`palette.accent\`, \`palette.error\`, plus \`*Hsl\` forms for CSS variables — gated by \`hasPaletteAccent\` / \`hasPaletteError\`.

### Language and direction
\`isRtl\` is true for a right-to-left frontend. In a fullstack frontend, \`locale\` (\`en\` or \`he\`) and \`isHebrew\` choose the generated app's own words. The department variables are here too.

### Node-version gating
The mirror of backend \`javaVersion\` gating: a frontend file contribution with a \`nodeVersion\` is skipped unless it matches the selected Node version. A row with no \`nodeVersion\` applies to all versions. This lets one target path (e.g. \`Dockerfile\`) resolve to a different content row per Node version — and a version with no matching row generates no file at all.`,
        fields: [
          { name: '{{projectName}} / appTitle / packageJsonName', type: 'String', required: true, description: 'Project identity; packageJsonName is scoped or plain.', example: '@menora/demo-ui' },
          { name: '{{reactVersion}} / reactPackageVersion / reactTypesVersion', type: 'String', required: true, description: 'React and @types versions.', example: '^19.0.0' },
          { name: '{{nodeVersion}}', type: 'String', required: true, description: 'Selected Node major version.', example: '20' },
          { name: '{{packageManager}} / isNpm / isPnpm', type: 'String / boolean', required: true, description: 'Package manager and convenience flags.', example: 'npm' },
          { name: '{{typescriptVersion}} / viteVersion / basePath', type: 'String', required: true, description: 'Tooling versions and app base path.', example: '/' },
          { name: '{{apiBaseUrl}} / backendArtifactId / hasBackendPair / hasBackendArtifactId', type: 'mixed', required: true, description: 'Paired-backend info; hasBackendPair is true when apiBaseUrl is set.', example: 'http://localhost:8080' },
          { name: '{{palette.*}}', type: 'Map', required: true, description: 'id, name, primary, secondary, accent, error, and *Hsl forms for CSS variables.', example: '{{palette.primary}}' },
          { name: '{{hasPaletteAccent}} / hasPaletteError', type: 'boolean', required: true, description: 'Gates for the optional accent/error colors.', example: 'true' },
          { name: 'has<Dep> / opt<Dep><Option>', type: 'boolean', required: false, description: 'Same selection-flag convention as the backend context.', example: 'hasRouterReactRouter' }
        ]
      },
      {
        id: 'mustache-h2-walkthrough',
        title: 'Walkthrough: Decoding H2Config',
        description: 'Reading the real h2-config-primary.mustache line by line.',
        content: `### The template
\`templates/h2-config-primary.mustache\` is a backend dependency template (Backend Dependency Context), shown below.

### Reading it
- \`{{#hasScaffoldedEntities}}…{{/hasScaffoldedEntities}}\` — the **section** renders only when entities were scaffolded (a fullstack request, or the SQL wizard). In that branch it emits \`{{dsRepositoryPackage}}\` / \`{{dsEntityPackage}}\` — the packages where the generated repositories/entities actually landed (\`<domainPackage>.repository\` / \`<domainPackage>.entity\`).
- \`{{^hasScaffoldedEntities}}…{{/hasScaffoldedEntities}}\` — the **inverted section** is the "else": when nothing was scaffolded those two keys are null, so the template falls back to the legacy convention \`{{packageName}}.h2.repository\` / \`{{packageName}}.h2\`.

- \`{{#dsExtraPackages}}, "{{.}}"{{/dsExtraPackages}}\` — a **list section**: once per further package a fullstack project holds entities in, it appends that package. \`basePackages\` becomes an array (\`{ … }\`) only when there are any (\`dsHasExtraPackages\`), so a plain project keeps its single string.

So a plain (non-fullstack) project gets \`com.menora.demo.h2.repository\`; a fullstack project gets the real scaffolded package plus its support packages. The keys are set together in \`buildBaseContext\`. The Oracle, PostgreSQL, SQL Server and DB2 configs follow the same pattern.`,
        codeExamples: [
          {
            title: 'h2-config-primary.mustache (excerpt)',
            language: 'java',
            code: `@Configuration
@EnableJpaRepositories(
        basePackages = {{#dsHasExtraPackages}}{ {{/dsHasExtraPackages}}"{{#hasScaffoldedEntities}}{{dsRepositoryPackage}}{{/hasScaffoldedEntities}}{{^hasScaffoldedEntities}}{{packageName}}.h2.repository{{/hasScaffoldedEntities}}"{{#dsExtraPackages}}, "{{.}}"{{/dsExtraPackages}}{{#dsHasExtraPackages}} }{{/dsHasExtraPackages}},
        entityManagerFactoryRef = "h2EntityManagerFactory",
        transactionManagerRef = "h2TransactionManager"
)
public class H2Config {
    // ...
    em.setPackagesToScan("{{#hasScaffoldedEntities}}{{dsEntityPackage}}{{/hasScaffoldedEntities}}{{^hasScaffoldedEntities}}{{packageName}}.h2{{/hasScaffoldedEntities}}"{{#dsExtraPackages}}, "{{.}}"{{/dsExtraPackages}});
}`
          }
        ]
      },
      {
        id: 'mustache-authoring',
        title: 'Walkthrough: Add & Gate Templates',
        description: 'Author a new TEMPLATE file, gate content, and version-gate a file.',
        content: `### Gating levers (coarsest to finest)
1. **Whole file by dependency** — a row's \`dependencyId\` scopes it to that dep (\`__common__\` = every project).
2. **Whole file by sub-option** — set \`subOptionId\` on the row; written only when that sub-option is selected (this is how Kafka's \`KafkaConsumerExample.java\` carries \`subOptionId: "consumer-example"\`).
3. **A block inside a file** — gate with a section using \`has<Dep>\` / \`opt<Dep><Option>\`. For fullstack entity templates the file-level gate is the manifest's \`gatedBy\` flag.

### Version-gated files
One \`targetPath\`, different content per runtime: the framework picks the row whose \`javaVersion\` (backend) or \`nodeVersion\` (frontend) matches; a null column means "all versions". E.g. two rows both targeting \`Dockerfile\`, one \`javaVersion: "17"\` and one \`"21"\`.

### Two ways in
- **In the admin** — **Config → File Contribs → New Contribution**: the row is live for the next generation. It is your row: a later release does not overwrite it.
- **In the release** — add the template file and a row in \`catalog/file-contributions.json\`. A fresh database is seeded with it, and an existing one gets it from the **catalog sync** when the release starts (a new shipped row is added; a shipped row nobody edited follows the new content).`,
        workflowSteps: [
          { title: 'Author the content', description: 'Create src/main/resources/templates/my-feature-config.mustache using Backend Dependency Context variables ({{packageName}}, {{artifactId}}, {{javaVersion}}, has<Dep> sections).' },
          { title: 'Register the row', description: 'Add an entry to catalog/file-contributions.json: depId, fileType TEMPLATE, contentResource, targetPath with {{packagePath}}, substitutionType MUSTACHE.' },
          { title: 'Or add it live', description: 'For a running instance without a release: Config → File Contribs → New Contribution with the same fields (or POST /admin/file-contributions). No refresh is needed.' },
          { title: 'Verify', description: 'curl the starter.zip with the relevant dependency and unzip the target file to confirm the rendered output.' }
        ],
        codeExamples: [
          {
            title: 'file-contributions.json — a new TEMPLATE row',
            language: 'json',
            code: `{ "depId": "security", "fileType": "TEMPLATE", "contentResource": "templates/my-feature-config.mustache", "targetPath": "src/main/java/{{packagePath}}/config/MyFeatureConfig.java", "substitutionType": "MUSTACHE", "sortOrder": 10 }`
          },
          {
            title: 'Version gating — two rows, one Dockerfile',
            language: 'json',
            code: `{ "depId": "__common__", "fileType": "TEMPLATE", "contentResource": "templates/Dockerfile-java17.mustache", "targetPath": "Dockerfile", "substitutionType": "MUSTACHE", "javaVersion": "17", "sortOrder": 5 }
{ "depId": "__common__", "fileType": "TEMPLATE", "contentResource": "templates/Dockerfile-java21.mustache", "targetPath": "Dockerfile", "substitutionType": "MUSTACHE", "javaVersion": "21", "sortOrder": 6 }`
          }
        ],
        callouts: [
          {
            type: 'tip',
            text: 'Block-gating with {{#hasSecurity}}…{{/hasSecurity}} collapses what used to need several near-duplicate rows into one template.'
          }
        ]
      },
      {
        id: 'mustache-gotchas',
        title: 'Gotchas & Source Map',
        description: 'Sharp edges to remember, and where each context is built in the backend.',
        content: `### Gotchas
- **{{{ }}} equals {{ }}** — HTML escaping is off; you never need triple braces.
- **A missing/typo'd key renders empty, silently** — no error. A blank in the output usually means a misspelled variable name.
- **Path substitution is not content substitution** — backend target paths only honor {{packagePath}}, frontend only {{projectName}}; fullstack entity paths honor the full entity context.
- **__-prefixed keys are internal** (__entitySummaries, __inverseRelations…) — not for templates.
- **New entity variables go in the view-model** — \`EntityScaffoldContext\` or the class for the variable's area (\`EntityViewModel\`, \`FieldViewModel\`, \`RelationViews\`, \`FeatureContext\`, \`PageContext\`, \`DashboardContext\`). There is nowhere else to wire them.
- **A new scaffold option is one \`ScaffoldOption\` constant** — it sets the flag on both render paths and appears in the editor's schema.
- **Never splice user text raw in a frontend template** — use the \`…Ts\` / \`…Attr\` / \`…Jsx\` forms.
- **A new package holding a JPA entity** must be added to the scaffold's support packages, or the datasource configs do not scan it.
- **pkField can be null** — guard with {{#pkField}}…{{/pkField}} for entities with no primary key.
- **An edited template set row is yours** — the template sync keeps it (\`seedHash = custom\`) and it stops following the shipped file; a reset of the set takes the shipped files back.

### Source map (backend)
- Backend dep context — \`extension/dynamic/DynamicProjectGenerationConfiguration.java\` (buildBaseContext, toPascalCase, resolveTargetPath), \`config/DepartmentResolver.java\`
- Fullstack entity context — \`fullstack/EntityScaffoldContext.java\` and the area classes beside it; \`fullstack/ScaffoldOption.java\`
- Frontend context — \`extension/frontend/FrontendMustacheContext.java\`, \`FrontendProjectGenerator.java\`
- Wizard templates — \`templates/wizard/**\`, \`config/WizardTemplates.java\`
- Row model — \`db/entity/FileContributionEntity.java\`, \`db/entity/EntityTemplateFileEntity.java\`
- Full written reference — \`backend/docs/MUSTACHE_GUIDE.md\``,
        callouts: [
          {
            type: 'info',
            text: 'backend/docs/MUSTACHE_GUIDE.md is the full reference (every key, with where it is derived). This guide keeps what an admin editing a template needs; when a variable changes in the backend, update both.'
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // SQL → JPA ENTITY WIZARD
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'sql-wizard',
    title: 'SQL Entity Wizard',
    icon: 'auto_fix_high',
    topics: [
      {
        id: 'sql-wizard-what',
        title: 'What the Wizard Does',
        description: 'Paste a schema, or read one from a database, and get JPA entities — and optionally a REST API — in the generated project.',
        content: `### Purpose
When the developer selects a relational database driver (PostgreSQL, SQL Server, Oracle, DB2, H2, MySQL), a **Generate entities from SQL…** button appears on that driver's card in the Selected panel. It opens a drawer where the developer pastes (or uploads, or reads from a live database) a schema script. On Generate, the backend parses it and writes JPA \`@Entity\` classes, \`JpaRepository\` interfaces and — when asked — a service, DTOs and a REST controller per table, straight into the project.

### Which Drivers Are Eligible
The UI calls \`GET /metadata/sql-dialects\` at page load to learn which dependency ids the backend can parse for. The button only appears on those cards. A new JDBC driver added to the catalog under a known dialect gets the wizard with no further setup. MongoDB has no DDL and is not offered.

### Flow At a Glance
1. The developer selects a driver (e.g. \`postgresql\`) plus \`data-jpa\`.
2. Clicks **Generate entities from SQL…** on the driver's card.
3. Pastes \`CREATE TABLE …\` statements (\`ALTER TABLE … ADD CONSTRAINT\` too), drops a \`.sql\` file, or clicks **Read from a database…** (see **Reading From a Live Database**).
4. The detected tables are listed, each with **Generate repository** (on by default).
5. Optional: the sub-package (default \`entity\`) and the **API mode** (entities only, or a REST API over them).
6. Under **With the project's other dependencies**: *Use this script as the Flyway baseline* (on by default, used when \`flyway\` is selected), *Generate controller tests* (needs a REST API mode), and a line on what selecting \`validation\` adds.
7. Save → the card shows a badge (✓ N tables).
8. **Generate** or **Explore** send \`POST /starter-wizard.zip\` / \`/starter-wizard.preview\` with a JSON body.`,
        callouts: [
          {
            type: 'info',
            text: 'Projects without a wizard document still use the plain GET /starter.zip, byte for byte. With one, the script and the wizard\'s options are written into the project\'s menora-model.json, so the project can be updated later from a changed script.'
          },
          {
            type: 'warning',
            text: 'The documents pasted into the wizards of one request (SQL, OpenAPI, WSDL, AsyncAPI) may total 5 MB (menora.wizard.max-documents-size); past that the request is a 400.'
          }
        ]
      },
      {
        id: 'sql-wizard-mapping',
        title: 'What Is Read, and What It Becomes',
        description: 'Type mapping, keys, constraints, foreign keys and enums.',
        content: `### Type Mapping
Each column becomes a field. The Java type is chosen from the SQL type, its precision and scale, and the dialect:

| SQL Type | Java Type | Notes |
|---|---|---|
| \`VARCHAR\`, \`CHAR\`, \`TEXT\`, \`CLOB\`, \`NVARCHAR\`, \`VARCHAR2\` | \`String\` | \`length\` → \`@Column(length=…)\` |
| \`INT\`, \`INTEGER\` | \`Integer\` | |
| \`BIGINT\`, \`BIGSERIAL\`, \`SERIAL\` | \`Long\` | SERIAL/BIGSERIAL also get \`@GeneratedValue(IDENTITY)\` |
| \`BOOLEAN\`, \`BIT\` (SQL Server), \`TINYINT(1)\` (MySQL) | \`Boolean\` | |
| \`DATE\` / \`TIMESTAMP\` / \`TIME\` | \`LocalDate\` / \`LocalDateTime\` / \`LocalTime\` | |
| \`NUMERIC(p,s)\`, \`DECIMAL(p,s)\` | \`BigDecimal\` | precision/scale copied to \`@Column\` |
| \`NUMBER(p,0)\` (Oracle) | \`Integer\` / \`Long\` | ≤9 → Integer, else Long |
| \`UUID\` (PostgreSQL), \`UNIQUEIDENTIFIER\` (SQL Server) | \`UUID\` | |
| \`JSON\`, \`JSONB\` (PostgreSQL) | \`String\` | |
| \`BYTEA\`, \`BLOB\` | \`byte[]\` | |

### Names
- Table \`user_orders\` → class \`UserOrders\`; column \`created_at\` → field \`createdAt\` with \`@Column(name = "created_at")\`.
- Mixed-case and quoted names keep their spelling: Spring Boot's naming strategy would rewrite them, so the wizard writes them in a form it leaves alone, and adds a naming-strategy class to the project when a quoted name needs one.
- A schema-qualified table (\`hr.employees\`) gets \`@Table(schema = "hr")\`.

### Keys
- Primary key → \`@Id\`; \`BIGSERIAL\` / \`SERIAL\` / \`AUTO_INCREMENT\` / \`IDENTITY\` → \`@GeneratedValue(strategy = IDENTITY)\`.
- Composite key → \`@IdClass\` with a key class beside the entity (Lombok \`@Data\`, \`Serializable\`).
- Keys declared by \`ALTER TABLE … ADD [CONSTRAINT x] PRIMARY KEY | FOREIGN KEY | UNIQUE\` are read like inline ones — that is how pg_dump, SSMS and most exports write them.
- A table without a primary key is written without \`@Entity\` (JPA needs an id), with a TODO, and gets no repository.

### Foreign Keys
- A foreign key to a table **in the same script** — declared on the table, on the column (\`team_id BIGINT REFERENCES teams(id)\`) or by \`ALTER TABLE\` — becomes a \`@ManyToOne(fetch = LAZY)\` association with its \`@JoinColumn\`.
- A key column that is also a foreign key stays a scalar \`@Id\`, with a read-only association beside it on the same column.
- A foreign key to a table not in the script stays a scalar field with a \`// TODO: map as @ManyToOne\`.

### Constraints and Enums
- \`NOT NULL\` → \`@Column(nullable = false)\`; one-column \`UNIQUE\` → \`@Column(unique = true)\`, several columns → \`@UniqueConstraint\` on the table.
- \`CHECK (col IN ('A','B'))\` → a Java enum (\`<Table><Column>\`) stored with \`@Enumerated(EnumType.STRING)\` — only when every value is already a valid Java name, since the database holds the values as they are; otherwise the column stays a \`String\`.
- With the \`validation\` starter: \`@NotNull\` (never on a generated key), \`@Size(max)\` from a text column's length, required foreign keys — on the DTO, or on the entity when it is exposed directly.

### Indexes
- \`CREATE INDEX idx ON books (title, published_on DESC)\` → \`@Table(indexes = @Index(name = "idx", columnList = "title, published_on DESC"))\`.
- A unique index over plain columns is a unique constraint, as above.
- An index JPA cannot describe — partial (\`WHERE …\`), over an expression (\`lower(email)\`), or of another kind (\`USING gin\`, bitmap) — is written as a comment above the entity, so the class says the database has it.

### Views
- \`CREATE VIEW v AS SELECT …\` (also \`OR REPLACE\`, \`MATERIALIZED\`, a column list) → a read-only entity over the view by its name: \`@Immutable\` and \`@Subselect("SELECT * FROM v")\`, with GET-only endpoints in the API modes. The statement stays in the Flyway baseline.
- A bare \`SELECT\` → the same kind of entity over the query itself, named after its first table. It is not part of the baseline.
- A field takes the type of what it selects: a column of a table (or of an earlier view) of the same script, a \`CAST(x AS type)\`, \`count(…)\` (a \`Long\`), \`min\` / \`max\` of a column. \`SELECT *\` stands for the table's columns. Anything else is a \`String\` with a TODO to set the type.
- The first column is the \`@Id\` — a view has no key of its own. Change it in source when another column identifies a row.
- A view whose columns cannot be named — \`SELECT *\` from a table the script does not create, an expression without an alias — is a 400 that says so; a column list (\`CREATE VIEW v (a, b) AS …\`) settles it.

### Lombok
Entities use \`@Data\`, \`@NoArgsConstructor\` and \`@AllArgsConstructor\`. Lombok is a \`__common__\` build row, so every project has it. Associations are marked \`@EqualsAndHashCode.Exclude\` and \`@ToString.Exclude\`, so \`equals\`, \`hashCode\` and \`toString\` never load the row they point at.`,
        codeExamples: [
          {
            title: 'Generated from: orders(id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), status VARCHAR(20) CHECK (status IN (\'OPEN\',\'PAID\')))',
            language: 'java',
            code: `@Entity
@Table(name = "orders")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Orders {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(nullable = false)
    private Long id;

    @EqualsAndHashCode.Exclude
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private Users user;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private OrdersStatus status;

}`
          }
        ],
        callouts: [
          {
            type: 'info',
            text: 'Projects generated before November 2026 have the association inside @Data\'s equals, hashCode and toString, which load the lazy row (and fail outside a transaction). Add @EqualsAndHashCode.Exclude and @ToString.Exclude to each association there by hand: an update of the project carries model changes, not template changes.'
          }
        ]
      },
      {
        id: 'sql-wizard-api-modes',
        title: 'API Modes, Flyway and Tests',
        description: 'How much code is written over the entities, and what the project\'s other dependencies add.',
        content: `### API Mode (\`sqlOptions.<dep>.apiMode\`)
| Mode | What is written per table |
|---|---|
| \`NONE\` (default) | The entity and, when ticked, its repository |
| \`ENTITY_DIRECT\` | + a service and a REST controller that expose the entity itself |
| \`INLINE_DTO\` | + a record DTO with hand-written \`from(entity)\` / \`toEntity()\`, used by the service and controller |
| \`MAPSTRUCT_DTO\` | + a record DTO and a MapStruct \`@Mapper\` (the \`mapstruct\` dependency is added) |

An unknown mode is a 400.

### Flyway Baseline (\`flywayBaseline\`, default true)
With the \`flyway\` dependency selected, the pasted script becomes \`src/main/resources/db/migration/V1__init.sql\` in place of the dependency's placeholder: every statement as written except SELECTs. It is in the dialect it was pasted in, so it runs on that database. With several SQL payloads only the first is the baseline. \`false\` keeps the placeholder.

### Controller Tests (\`generateTests\`)
With a REST API mode, a \`@WebMvcTest\` per controller.

### The Starters It Needs
\`data-jpa\` and the driver come from the developer's selection; a REST API mode needs \`web\`.`
      },
      {
        id: 'sql-wizard-live',
        title: 'Reading From a Live Database',
        description: 'Read tables and views from PostgreSQL, SQL Server, Oracle or DB2 instead of pasting DDL — and the Schema sources admins set up for it.',
        content: `### For the Developer
**Read from a database…** beside the SQL box (and **From a database** in the Fullstack tab's DDL import) connects to a database, lists its schemas and then its tables and views (views marked), and reads the ticked ones. What was read becomes the script a person would have pasted — a \`CREATE TABLE\` per table with its key, NOT NULL, UNIQUE and CHECK-list constraints, the foreign keys between the tables read as \`ALTER TABLE … ADD FOREIGN KEY\`, the indexes as \`CREATE INDEX\`, column defaults, comments as \`COMMENT ON\`, and a \`SELECT\` per view that casts each column to its type (how the wizard types the view's fields) — and replaces the SQL box, with **Undo**. The developer can read and edit it before generating; the wizard then generates exactly what that script pasted would.

The database is either a **source** an admin set up, picked by name, or — while the server allows it — one typed in by hand (host, port, database / service name / DB2 library, user, password). A typed password is sent with each call and kept nowhere, not on the server and not in the browser.

### For the Admin: Config → Schema sources
A source holds where a database is (type, host, port, database or service name, DB2 library) and the user. **The password is never stored**: *Password from* names where the server reads it — an environment variable \`SCHEMA_SOURCE_…\` or a property \`menora.live-schema.secrets.…\`; any other name is refused. The list shows whether that password is actually set on this server. **Test connection** tries the form, saved or not, and reports the schema count or the driver's error. Sources are recorded in History and are **not** part of the configuration export (they name this environment's databases).

### Server Settings
| Property | Default | Meaning |
|---|---|---|
| \`menora.live-schema.typed-connections\` | \`true\` | Whether anyone may type in a database. Off: the admins' sources only. |
| \`menora.live-schema.allowed-hosts\` | empty (any) | Comma-separated host patterns a typed connection may name (\`*.menora.co.il\`, \`10.20.*\`). Worth setting per environment: with typed connections on, the server connects wherever it is told. Sources are not limited by it. |
| \`menora.live-schema.max-tables\` | \`300\` | Tables and views one read may take. |
| \`menora.live-schema.max-concurrent-reads\` | \`4\` | Reads at once; the rest wait 5 s, then get a 429. |
| \`menora.live-schema.catalog-queries\` | \`true\` | Keys and indexes are read with one catalog query per schema. \`false\` asks the JDBC driver table by table instead — slower on a large schema, and what a read falls back to by itself when a database refuses a query. |

A connection is read-only, opened for one call, with a 10 s login and 30 s statement timeout. Each read is logged with the source or host, the schema, the count and the user — never the password.

### Drivers
The PostgreSQL, SQL Server, Oracle and DB2 for IBM i (jt400) drivers ship with the application. A database type whose driver a build leaves out is shown as "no driver on this server".

### Limits
Sequences and triggers are not read. A default that is an expression (a function call, a sequence) is not copied into the script: a comment beside the column says what the database has. A partial index, one over an expression and one of another kind (hash, GIN, bitmap) are a comment too. SQL Server has no \`COMMENT ON\`, so its descriptions are comments of the script. A view's binary columns, and columns of a type the reader does not know, are not cast: the SQL wizard writes those as \`String\` with a TODO. A PostgreSQL enum column becomes a CHECK-limited text column. DB2 for IBM i has not been read from a real server.`
      },
      {
        id: 'sql-wizard-api',
        title: 'REST API',
        description: 'The generation endpoints and the live-schema endpoints.',
        content: `### Endpoints

| Method | Path | Purpose |
|---|---|---|
| \`GET\` | \`/metadata/sql-dialects\` | Dep-id → dialect name map (only catalog-present deps) |
| \`POST\` | \`/starter-wizard.zip\` | Generate the ZIP (shared by all four wizards; their payloads can be combined) |
| \`POST\` | \`/starter-wizard.preview\` | File tree + contents (same shape as \`/starter.preview\`) |
| \`GET\` | \`/metadata/live-schema/options\` | Enabled sources (not where they are), whether typed connections are allowed, installed drivers, default ports |
| \`POST\` | \`/metadata/live-schema/schemas\` | \`{connection}\` → \`{schemas, defaultSchema}\` |
| \`POST\` | \`/metadata/live-schema/tables\` | \`{connection, schema}\` → \`{tables: [{name, kind}], truncated}\` |
| \`POST\` | \`/metadata/live-schema/ddl\` | \`{connection, schema, tables, qualify?}\` → \`{dialect, sql, tables, views, warnings}\` |

\`connection\` is \`{source}\` or \`{dialect, host, port?, database?, library?, user, password, trustServerCertificate?}\`. Live-schema errors are \`{error, detail}\`: 400 for a bad part, an unknown table, a failed connection or a missing driver; 403 when typed connections are off or the host is not allowed; 404 for an unknown source; 429 when busy.

### Why a POST Endpoint
\`/starter.zip\` is a GET whose query string carries every input. A few \`CREATE TABLE\` statements exceed typical URL limits (~2–8 KB), so the wizards take the same fields plus their documents as a JSON body.`,
        codeExamples: [
          {
            title: 'Generate a project with two entities, their repositories and a REST API',
            language: 'bash',
            code: `curl -o demo.zip -X POST http://localhost:8080/starter-wizard.zip \\
  -H "Content-Type: application/json" \\
  -d '{
    "groupId":"com.menora","artifactId":"demo","packageName":"com.menora.demo",
    "javaVersion":"21",
    "dependencies":["postgresql","data-jpa","web","flyway"],
    "opts":{"postgresql":["pg-primary"]},
    "sqlByDep":{"postgresql":"CREATE TABLE users (id BIGSERIAL PRIMARY KEY, email VARCHAR(200) NOT NULL UNIQUE); CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id));"},
    "sqlOptions":{"postgresql":{"subPackage":"entity","apiMode":"INLINE_DTO","generateTests":true}}
  }'
unzip -l demo.zip | grep -E "entity|repository|V1__init"`
          }
        ],
        fields: [
          { name: 'sqlByDep', type: 'object', required: false, description: 'Map of depId → the SQL script (CREATE TABLE, ALTER TABLE … ADD constraints).', example: '{ "postgresql": "CREATE TABLE users (...);" }' },
          { name: 'sqlOptions', type: 'object', required: false, description: 'Map of depId → { subPackage (default "entity"), tables[] ({name, generateRepository}), apiMode (NONE | ENTITY_DIRECT | INLINE_DTO | MAPSTRUCT_DTO), flywayBaseline (default true), generateTests }.', example: '{ "postgresql": { "apiMode": "INLINE_DTO", "generateTests": true } }' },
          { name: 'opts', type: 'object', required: false, description: 'Same sub-option map as /starter.zip\'s opts-{depId} query params — e.g. the primary/secondary datasource role.', example: '{ "postgresql": ["pg-primary"] }' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // OPENAPI → CONTROLLER/CLIENT WIZARD
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'openapi-wizard',
    title: 'OpenAPI Wizard',
    icon: 'integration_instructions',
    topics: [
      {
        id: 'openapi-wizard-what',
        title: 'What the Wizard Does',
        description: 'Paste an OpenAPI 3.x document and get controllers, a client, or both, with typed records.',
        content: `### Purpose
When the developer selects a web stack dependency (\`web\` or \`webflux\`), a **Generate from OpenAPI spec…** button appears on that card in the Selected panel. It opens a drawer where the developer pastes or uploads an OpenAPI 3.x document (YAML or JSON). On Generate, the backend writes the server side, a client, or both — with a Java record per schema, Spring MVC mappings, parameter binding and, with the \`validation\` starter, Bean Validation.

### Which Dependencies Are Eligible
\`GET /metadata/openapi-capable-deps\` (today \`web\` and \`webflux\`, intersected with the catalog).

### The Drawer
1. Paste or upload the document. A live **Detected operations** list appears (\`GET /pets\`, \`POST /pets/{id}\`…); a document that does not parse shows the parser's messages.
2. **Generate**: Controllers, Client, or Both (\`mode\`).
3. With a server side, **Server code as**: **Interfaces** (the default for a new setup) or **Classes** — see the next topic.
4. With a client, what it calls through: **RestTemplate** (default) or **RestClient**, and the property holding the base URL (default \`openapi.client.base-url\`).
5. Sub-packages (controllers \`api\`, records \`dto\`, client \`client\`) and **Keep the spec in the project** (\`src/main/resources/openapi/<dep>.yaml\`).
6. Save → the card shows a badge. Generate and Explore post to \`/starter-wizard.zip\` / \`.preview\`; the payload can be combined with the other wizards'.

### The Starters It Needs
The server adds what the generated code needs and the developer left out: \`web\` when neither \`web\` nor \`webflux\` is selected, and \`openapi\` (springdoc, a Swagger UI at \`/swagger-ui.html\`) beside generated controllers.`,
        callouts: [
          {
            type: 'warning',
            text: 'The document must be self-contained. A $ref to another file or a URL, or a $id, is refused with a 400 naming it — the server never fetches or reads anything a pasted document points at. Bundle a multi-file spec into one file first.'
          }
        ]
      },
      {
        id: 'openapi-wizard-styles',
        title: 'Interfaces or Classes',
        description: 'Why a new setup generates an Api interface per tag plus a controller that is the team\'s.',
        content: `### Interfaces (\`apiStyle: "interfaces"\`)
Per tag, two files:
- **\`<Tag>Api\`** — an interface with every mapping. Each method is a \`default\` that answers **501 Not Implemented**. Generated whole, every time.
- **\`<Tag>Controller implements <Tag>Api\`** — the team's class. It starts empty; the team overrides an operation to implement it, with the signature alone (the mapping, bindings and constraints stay on the interface).

When the document changes and the project is updated (**Download update**), the interface is rewritten and the controller is never touched: a new operation answers 501 until someone overrides it. That is why a new setup starts here.

### Classes (\`apiStyle: "classes"\`, or absent)
One \`<Tag>Controller\` per tag whose methods throw \`UnsupportedOperationException\` until filled in. Simpler to read, but the team's code then lives in a generated file, so an update of a changed document patches code the team has written. Setups saved before the choice existed keep this style.

Operations without a tag go to \`Default\`.`,
        codeExamples: [
          {
            title: 'Interfaces — generated PetsApi.java (abridged)',
            language: 'java',
            code: `public interface PetsApi {

    @GetMapping("/pets")
    default List<Pet> listPets() {
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "listPets is not implemented");
    }

    @PostMapping("/pets")
    @ResponseStatus(HttpStatus.CREATED)
    default void createPet(@RequestBody Pet body) {
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "createPet is not implemented");
    }

    @GetMapping("/pets/{id}")
    default Pet getPetById(@PathVariable("id") Long id) {
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "getPetById is not implemented");
    }

}`
          },
          {
            title: 'Interfaces — generated PetsController.java (the team\'s)',
            language: 'java',
            code: `@RestController
@Validated
public class PetsController implements PetsApi {
}`
          }
        ]
      },
      {
        id: 'openapi-wizard-mapping',
        title: 'Schema → Java Type Mapping',
        description: 'How OpenAPI schemas, parameters and bodies become Java.',
        content: `### Types
| OpenAPI Schema | Java Type | Notes |
|---|---|---|
| \`string\` | \`String\` | |
| \`string\`, \`format: date\` | \`LocalDate\` | |
| \`string\`, \`format: date-time\` | \`OffsetDateTime\` | |
| \`string\`, \`format: uuid\` | \`UUID\` | |
| \`string\`, \`format: binary\` | \`byte[]\` | (\`MultipartFile\` in a multipart body) |
| \`string\` with \`enum\` | a Java enum | keeps each wire value (\`@JsonValue\`); in a property it is named after its place (\`Pet.status\` → \`PetStatus\`). A **parameter** of an enum type stays \`String\`. |
| \`integer\` / \`format: int64\` | \`Integer\` / \`Long\` | |
| \`number\` / \`format: float\` / \`format: double\` | \`Double\` / \`Float\` / \`Double\` | |
| \`boolean\` | \`Boolean\` | |
| \`array\` | \`List<T>\` | |
| \`object\` with \`additionalProperties\` | \`Map<String, V>\` | |
| \`$ref\` to an object schema | the record | |
| \`allOf\` | one merged record | |
| \`oneOf\` / \`anyOf\` over objects | a sealed interface | \`@JsonTypeInfo\` by the discriminator (its \`mapping\` honoured), or deduction without one. A choice between non-objects stays \`Object\`. |

A named schema that is not an object (a string with a format, an array, a map) is not a type of its own: a reference to it is the type it stands for. An object written in place becomes a record named after its place (\`<Operation>Request\`, \`<Operation>Response\`). OpenAPI 3.1's \`type: [string, 'null']\` is read.

### Records
Every object schema becomes a Java \`record\`. A property whose Java name differs from its wire name gets \`@JsonProperty\` (\`first_name\` → \`firstName\`); a Java keyword gets a suffix (\`class_\`). A schema named like a type the generated code uses (\`List\`, \`Valid\`…) becomes \`<Name>Dto\`.

### Operations
- \`@GetMapping\` … \`@PatchMapping\`, plus HEAD and OPTIONS operations.
- Parameters are bound by their names on the wire: \`@PathVariable("id")\`, \`@RequestParam\`, \`@RequestHeader("X-Request-Id")\`, \`@CookieValue\`; dates with \`@DateTimeFormat(iso = …)\`; path-level parameters too.
- A JSON body is \`@RequestBody\` — optional only when the document says \`required: false\`. A multipart or form-urlencoded body binds its properties as parameters (files as \`MultipartFile\`).
- The declared success status — the lowest 2xx, then \`2XX\`, then \`default\` — becomes \`@ResponseStatus\` where it is not 200, and decides the return type.
- With the \`validation\` starter: \`@NotNull\`, \`@Size\`, \`@Pattern\`, \`@Email\`, \`@Min\`/\`@Max\`, \`@DecimalMin\`/\`@DecimalMax\` and \`@Valid\` on record components and parameters.

### Security Schemes
The document's security schemes are declared for springdoc (\`@SecuritySchemes\`, \`@SecurityRequirement\`), and a generated client sends the credentials from properties (API keys, bearer tokens, basic). An OAuth2 client-credentials scheme gets a token of its own: set \`client-id\` and \`client-secret\` and the client asks the token endpoint, keeps the token until it expires and asks again after a 401 (without a client id, a configured \`token\` is sent). When an operation accepts several kinds of credentials, the first one configured is sent. They are documented, not enforced: the server code checks nothing.

### Clients
\`<Tag>Client\` with a method per operation, the same parameter names, the path expanded in the path's own order. RestTemplate or RestClient, configured by a generated config class reading the base-URL property.`
      },
      {
        id: 'openapi-wizard-api',
        title: 'REST API',
        description: 'Endpoints, the request fields and a worked example.',
        content: `### Endpoints

| Method | Path | Purpose |
|---|---|---|
| \`GET\` | \`/metadata/openapi-capable-deps\` | Dep ids eligible for the wizard |
| \`POST\` | \`/starter-wizard.zip\` | Generate the ZIP (shared by all four wizards) |
| \`POST\` | \`/starter-wizard.preview\` | File tree + contents |
| \`POST\` | \`/starter-wizard.detect-paths\` | \`{ spec }\` → \`["GET /pets", "POST /pets/{id}", …]\` for the drawer |

### Parse Errors
A document that does not parse — or refers outside itself — is a 400 \`{ "error": "...", "messages": ["attribute info.version is missing", ...] }\`, from detect-paths and from generation alike. The drawer shows the messages.`,
        codeExamples: [
          {
            title: 'Generate a project from a tiny Petstore spec',
            language: 'bash',
            code: `curl -o demo.zip -X POST http://localhost:8080/starter-wizard.zip \\
  -H "Content-Type: application/json" \\
  -d '{
    "groupId":"com.menora","artifactId":"demo","packageName":"com.menora.demo",
    "javaVersion":"21",
    "dependencies":["web"],
    "specByDep":{"web":"openapi: 3.0.3\\ninfo: { title: Petstore, version: 1.0.0 }\\npaths:\\n  /pets/{id}:\\n    get:\\n      tags: [pets]\\n      operationId: getPetById\\n      parameters: [{ name: id, in: path, required: true, schema: { type: integer, format: int64 } }]\\n      responses: { 200: { content: { application/json: { schema: { $ref: \\"#/components/schemas/Pet\\" } } } } }\\ncomponents:\\n  schemas:\\n    Pet: { type: object, properties: { id: { type: integer, format: int64 }, name: { type: string } }, required: [id, name] }"},
    "openApiOptions":{"web":{"mode":"CONTROLLERS","apiStyle":"interfaces"}}
  }'
unzip -p demo.zip demo/src/main/java/com/menora/demo/api/PetsApi.java`
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
            title: 'Classes — generated PetsController.java (imports left out)',
            language: 'java',
            code: `@RestController
@Validated
@RequestMapping
public class PetsController {

    @GetMapping("/pets")
    public List<Pet> listPets() {
        throw new UnsupportedOperationException("TODO: implement listPets");
    }

    @PostMapping("/pets")
    @ResponseStatus(HttpStatus.CREATED)
    public void createPet(@RequestBody Pet body) {
        throw new UnsupportedOperationException("TODO: implement createPet");
    }

    @GetMapping("/pets/{id}")
    public Pet getPetById(@PathVariable("id") Long id) {
        throw new UnsupportedOperationException("TODO: implement getPetById");
    }

}`
          }
        ],
        fields: [
          { name: 'specByDep', type: 'object', required: false, description: 'Map of depId → the OpenAPI 3.x document (YAML or JSON), self-contained.', example: '{ "web": "openapi: 3.0.3\\n..." }' },
          { name: 'openApiOptions.<dep>.mode', type: 'string', required: false, description: 'CONTROLLERS (default), CLIENT or BOTH.', example: 'BOTH' },
          { name: 'openApiOptions.<dep>.apiStyle', type: 'string', required: false, description: 'interfaces, or classes (also when absent). Only matters with a server side.', example: 'interfaces' },
          { name: 'openApiOptions.<dep>.clientKind', type: 'string', required: false, description: 'restTemplate (default) or restClient.', example: 'restClient' },
          { name: 'openApiOptions.<dep>.baseUrlProperty', type: 'string', required: false, description: 'The property the client reads its base URL from.', example: 'openapi.client.base-url' },
          { name: 'openApiOptions.<dep>.apiSubPackage / dtoSubPackage / clientSubPackage', type: 'string', required: false, description: 'Where controllers, records and the client go (defaults api, dto, client).', example: 'api' },
          { name: 'openApiOptions.<dep>.copySpec', type: 'boolean', required: false, description: 'Keep the document at src/main/resources/openapi/<dep>.yaml|json.', example: 'true' },
          { name: 'dependencies', type: 'array', required: true, description: 'The usual dep-id array. Only deps listed in /metadata/openapi-capable-deps have their specByDep entry processed.', example: '[ "web" ]' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // SOAP WIZARD
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
When the developer selects the \`web-services\` dependency (Spring Web Services starter), a **Generate from WSDL…** button appears on that card. Clicking it opens a drawer where the developer pastes a WSDL 1.1 document. On Generate, the backend drops the WSDL into \`src/main/resources/wsdl/\`, configures the JAX-WS Maven plugin to generate JAXB payload classes at build time, and emits one of three things — server \`@Endpoint\` stubs, a \`WebServiceGatewaySupport\` client, or both — depending on the chosen mode.

This is the symmetrical twin of the OpenAPI wizard for SOAP teams. It removes the boilerplate for both contract-first SOAP servers and SOAP consumers.

### Which Dependencies Are Eligible
The UI calls \`GET /metadata/soap-capable-deps\` at page load — the button only appears on dep cards present in the response (currently just \`web-services\`, intersected with deps actually in the catalog).

### Flow At a Glance
1. Developer selects \`web-services\` from the catalog.
2. Clicks **Generate from WSDL…** on the dep's card.
3. Pastes or uploads a WSDL (\`.wsdl\` or \`.xml\`).
4. A live **Detected Services** list appears (debounced 400ms) showing entries like \`CountryService.CountryPort: getCountry, listCountries\`.
5. Picks a mode — **Endpoints**, **Client**, or **Both** — and (optionally) overrides sub-packages, the servlet context path (endpoint mode), and the base URL property (client mode).
6. Save → the dep card shows a "WSDL attached" badge.
7. Click **Generate** or **Explore** — the UI sends POST \`/starter-wizard.zip\` / \`/starter-wizard.preview\` with a JSON body. The endpoint is shared with the other wizards — a single request can carry \`wsdlByDep\`, \`specByDep\`, \`sqlByDep\` and \`asyncApiByDep\` together.

If the developer forgot \`web-services\`, a request with a WSDL gets it added.`,
        callouts: [
          {
            type: 'info',
            text: 'JAXB request/response classes are not written into the ZIP. They are generated at build time by the JAX-WS Maven plugin from the embedded XSD inside the WSDL. The first mvn compile produces them under target/generated-sources/jaxws/. IDEs detect this folder automatically.'
          },
          {
            type: 'info',
            text: 'The four wizards are composable — POST /starter-wizard.zip accepts sqlByDep, specByDep, wsdlByDep and asyncApiByDep simultaneously. Empty maps are a no-op.'
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
| \`POST\` | \`/starter-wizard.zip\` | Generate ZIP with endpoints/clients (shared by all four wizards) |
| \`POST\` | \`/starter-wizard.preview\` | File tree + contents (same shape as \`/starter.preview\`) |
| \`POST\` | \`/starter-wizard.detect-services\` | Server-side parse: \`{ wsdl }\` → \`["CountryService.CountryPort: getCountry, listCountries"]\` for the drawer's live preview |

### Why a New POST Endpoint
WSDL documents routinely run into tens of kilobytes once the embedded XSD is non-trivial — well past typical URL length limits. Reusing the same wizard POST endpoint that already exists for SQL and OpenAPI keeps the wire shape consistent and side-steps URL size ceilings.

### Parse Errors
If the WSDL is malformed, the backend returns HTTP 400 with a body like \`{ "error": "Invalid WSDL", "messages": ["WSDLException: faultCode=PARSER_ERROR: ..."] }\` — from detect-services as well (also for a WSDL with no \`<service>\`), so the drawer shows the messages instead of an empty list.

A WSDL that refers to another file — \`wsdl:import\`, or \`xsd:import\` / \`include\` / \`redefine\` with a \`schemaLocation\` — is a 400 naming each reference. The server never opens a file or URL a pasted document points at; the schemas must be inside the WSDL.`,
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
        title: 'Notes & Limitations',
        description: 'What this generation does, what it does not, and why.',
        content: `### What It Produces
- The WSDL itself, dropped verbatim into \`src/main/resources/wsdl/{kebab-service-name}.wsdl\`.
- The JAX-WS Maven plugin (\`com.sun.xml.ws:jaxws-maven-plugin:4.0.2\`) wired to \`generate-sources\` in \`pom.xml\` — generates JAXB payload classes from the embedded XSD on every \`mvn compile\`.
- One \`{Service}Endpoint.java\` and/or \`{Service}Client.java\` per \`<wsdl:service>\`, one method per operation.
- A \`WebServiceConfig.java\` (endpoint mode) and/or \`SoapClientConfig.java\` (client mode).
- An \`application.yaml\` fragment with the base URL property (client mode only) — deep-merged into the existing \`application.yaml\`.

### What It Does Not Produce
- **No JAXB classes in the ZIP.** They live in \`target/generated-sources/jaxws/\` after \`mvn compile\` runs the plugin. IDEs pick this up automatically.
- **No WSDL 2.0 support** — wsdl4j parses WSDL 1.1 only.
- **No standalone XSD input, no multi-file WSDLs** — the wizard expects one WSDL with its schemas embedded; a reference to another file is refused.
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
          },
          {
            type: 'warning',
            text: 'The JAX-WS plugin and its dependencies are not known to be in the offline Maven repository, so SOAP output has not been built for real here — check that Artifactory carries com.sun.xml.ws:jaxws-maven-plugin before relying on it.'
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // EVENTS WIZARD (AsyncAPI → Kafka)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'events-wizard',
    title: 'Events Wizard (AsyncAPI)',
    icon: 'sync_alt',
    topics: [
      {
        id: 'events-wizard-what',
        title: 'What the Wizard Does',
        description: 'Paste an AsyncAPI document and get Kafka producers and listeners with typed payloads.',
        content: `### Purpose
When the developer selects \`kafka\`, a **Generate from AsyncAPI…** button appears on its card. It opens a drawer where the developer pastes or uploads an AsyncAPI document (2.x or 3.x, YAML or JSON). On Generate, the backend writes a Kafka producer for each channel the application sends on, a listener for each it receives on, and a record per payload schema.

### Which Dependencies Are Eligible
\`GET /metadata/events-capable-deps\` — today \`kafka\`. A request with an AsyncAPI document and no \`kafka\` gets it added.

### Who Sends What
The two AsyncAPI versions describe direction in opposite words (2.x's \`publish\`/\`subscribe\` are a client's view; 3.x's \`send\`/\`receive\` the application's own). The wizard reads both as **what the described application does**.

### The Drawer
- The detected channels, each with **Produce** and **Consume** boxes. Untouched, they show what the application the document describes does, and **no channel list is saved**, so the project keeps following the document. **The other party** flips every channel — the way to generate a consumer of someone else's events. Any change by hand saves the list.
- A channel that cannot be a Kafka topic (a parameterized address such as \`users.{id}.inbox\`) is disabled with the reason.
- Sub-packages (default \`events\` and \`events.model\`), the consumer group, and **Generate tests**.

### What Is Written
- **\`<Channel>Producer\`** — \`send(key, payload)\` over the project's \`KafkaTemplate\`; several kinds of message on one channel give a method each.
- **\`<Channel>Listener\`** — a \`@KafkaListener\` that reads the payload and calls \`handle(key, payload)\`, a stub for the team. The group is the drawer's, else \`spring.kafka.consumer.group-id\`.
- **Payload records**, written by the OpenAPI wizard's type mapping (enums, \`allOf\`, sealed unions, constraints with \`validation\`).
- Each topic name as a property, \`app.events.topics.<channel>\`, set to the channel's address in \`application.yaml\`.
- JSON messages travel as text, converted with the application's \`ObjectMapper\` (\`spring-boot-starter-json\` is added when nothing else brings Jackson).
- With **Generate tests**: per producer, a payload sent through a mocked template and read back; per listener, a record in. No broker is needed.`,
        callouts: [
          {
            type: 'info',
            text: 'Kafka only: the document\'s servers are not read, nor its bindings but a message\'s Kafka key. Like OpenAPI documents, an AsyncAPI document must be self-contained.'
          }
        ]
      },
      {
        id: 'events-wizard-avro',
        title: 'Avro Payloads',
        description: 'Channels whose messages are Avro: schemas, the build plugin, and messages without a schema registry.',
        content: `### When It Applies
A message whose \`schemaFormat\` is \`application/vnd.apache.avro…\` (\`+json\`, \`+yaml\`) is Avro; its schema may be written in place, referenced, or given as JSON text. A channel is all Avro or all JSON — a mix is the channel's problem. The drawer marks Avro channels with an **Avro** badge.

### What Is Written
- Each Avro schema as \`src/main/avro/<full name>.avsc\`.
- The build gets \`org.apache.avro:avro\` 1.11.4 and the \`avro-maven-plugin\`, which makes the Java classes from the \`.avsc\` files at build time.
- \`AvroKafkaConfig\`: a \`KafkaTemplate<String, byte[]>\` and a listener factory built from the project's own Kafka settings (servers, SASL). The String beans stay for JSON channels.
- Producers send the record as bytes in Avro's single-object encoding; listeners decode it. Several kinds of message on one channel are told apart by the schema fingerprint.

### No Schema Registry
The topic carries the schema's fingerprint, not a registry id, so producer and consumer must hold the same schema. A consumer that must read an older schema adds it to its decoder by hand (the generated \`AvroKafkaConfig\` says how).

### Or Through Confluent's Schema Registry
**Avro through → Confluent schema registry** (\`eventOptions.<dep>.schemaRegistry: confluent\`) sends the records with Confluent's \`KafkaAvroSerializer\` and reads them as the generated classes. The registry is \`SCHEMA_REGISTRY_URL\` (default \`http://localhost:8081\`, with \`SCHEMA_REGISTRY_USER_INFO\` for basic auth); the application registers no schema (\`SCHEMA_REGISTRY_AUTO_REGISTER\`) except in the local run, whose \`compose.yaml\` starts a registry beside Kafka. The build gets \`io.confluent:kafka-avro-serializer\` for the project's Spring Boot line, from \`menora.events.confluent-repository\`.

### Keys and Headers (JSON and Avro)
A message's \`headers\` (with its traits'), a \`correlationId\` in a header and a UUID \`bindings.kafka.key\` are read: \`<Message>Headers\` (a typed record), \`send(key, payload, headers)\` beside \`send(key, payload)\` — a correlation id left empty is a new UUID — and \`handle(key, payload, headers)\` on a listener of one kind of message.`,
        callouts: [
          {
            type: 'warning',
            text: 'The avro-maven-plugin is not in the offline Maven repository: Artifactory must carry it before an Avro project builds. Payloads must be records; .avpr / .avdl files and schemas outside the document are not read.'
          }
        ]
      },
      {
        id: 'events-wizard-api',
        title: 'REST API',
        description: 'Endpoints and request fields.',
        content: `### Endpoints

| Method | Path | Purpose |
|---|---|---|
| \`GET\` | \`/metadata/events-capable-deps\` | Dep ids eligible for the wizard (\`["kafka"]\`) |
| \`POST\` | \`/starter-wizard.detect-channels\` | \`{ spec }\` → \`[{name, address, sends, receives, messages, format, problem, key, headers}]\` for the drawer |
| \`POST\` | \`/starter-wizard.zip\` / \`.preview\` | Generate, with \`asyncApiByDep\` and \`eventOptions\` |

A document that cannot be used is a 400 \`{ "error": "Invalid AsyncAPI document", "messages": [...] }\`, with the reason: no \`asyncapi\` field, a version other than 2.x/3.x, no channels, an unsupported \`schemaFormat\`, a \`$ref\` out of the document. Asking for a channel that does not exist, or twice, or ending up with nothing to generate, is a 400 too.`,
        fields: [
          { name: 'asyncApiByDep', type: 'object', required: false, description: 'Map of depId → the AsyncAPI document.', example: '{ "kafka": "asyncapi: 3.0.0\\n..." }' },
          { name: 'eventOptions.<dep>.channels', type: 'array', required: false, description: '[{name, produce, consume}] — exactly these channels in these directions. Absent: what the document describes.', example: '[{ "name": "orderPlaced", "produce": false, "consume": true }]' },
          { name: 'eventOptions.<dep>.subPackage / payloadSubPackage', type: 'string', required: false, description: 'Where producers/listeners and payload types go (defaults events, events.model).', example: 'events' },
          { name: 'eventOptions.<dep>.groupId', type: 'string', required: false, description: 'The listeners\' consumer group.', example: 'billing' },
          { name: 'eventOptions.<dep>.generateTests', type: 'boolean', required: false, description: 'A test per producer and listener, without a broker.', example: 'true' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // FRONTEND GENERATOR (React + TS + Vite + FSD)
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
The same DB-driven catalog that produces Spring Boot backends also produces **React + TypeScript + Vite** frontends laid out with [Feature-Slice Design](https://feature-sliced.design/). Developers pick a project name, an npm scope, dependencies and sub-options, and click Generate — the response is a zipped frontend project ready to install and run.

The **Frontend** tab sits beside **Backend** and **Fullstack** in the main UI. The same admin panel manages both catalogs; its Backend ⇄ Frontend pill switches between them.

### Why a Second Path Instead of Reusing the Spring One?
The Spring Initializr framework writes Maven projects — it can't emit \`package.json\` or \`vite.config.ts\`. So the frontend path skips the framework: \`FrontendStarterController\` calls \`FrontendProjectGenerator\`, which builds a temp directory the way the backend does and zips it.

It **reuses** everything that is not build-tool-specific: \`DependencyConfigService\`, the file contributions (all four types), sub-options, the \`InitializrWebConfiguration\` filter, and the same Mustache engine and conventions (\`has<Dep>\`, \`opt<Dep><Option>\`, the department variables).

### The ProjectKind Discriminator
Dependency groups, entries, file contributions, build customizations, sub-options, compatibility rules, starter templates and palettes carry a \`projectKind\` (\`BACKEND\` or \`FRONTEND\`). Both catalogs live in the same database and never see each other.`,
        callouts: [
          {
            type: 'info',
            text: 'The frontend path does not go through the Spring Initializr framework. Its endpoints live under `/frontend/*` (`/frontend/metadata`, `/frontend/starter.zip`, `/frontend/starter.preview`), separate from `/starter.zip`.'
          }
        ]
      },
      {
        id: 'fe-using',
        title: 'Using the Frontend Tab',
        description: 'What a developer sees and fills in when generating a React project.',
        content: `### Project
- **Scope** (optional) — npm scope without the \`@\`. \`menora\` + \`my-app\` becomes \`@menora/my-app\` in \`package.json\`.
- **Project Name** — folder name and \`package.json "name"\`. Auto-derives the App Title.
- **App Title** — the browser tab's \`<title>\` and the sample \`HomePage\`.
- **Description** — \`package.json "description"\`.
- **Department** — from **Config → Departments**; written into the deployment files.

### Options
- **React**, **Node** and **Package Manager** — the lists of **Config → Versions** (React 18 / 19, Node 20 / 22 / 18, pnpm / npm), opening on their defaults.
- **Design System** — none, shadcn, MUI, Chakra, Mantine or Menora Digital; the palette picker appears for the themed ones (MUI, Chakra, Mantine).
- **Base Path** — Vite's \`base\` for sub-path deploys (default \`/\`).
- **RTL layout** — \`dir="rtl"\` on the page.
- **Paired Backend** (optional) — the backend's URL and artifact id, for the dev proxy and the API client.

### Dependencies
Same chip + grouped-list pattern as the Backend tab: Routing, State Management, Data Fetching, Styling, Design System, Forms & Validation, Animation, Testing, Quality (on by default), Extras, API Integration. A dependency can expose sub-options after it is selected.

### Generate
Generate calls \`/frontend/starter.zip\` with the form, the dependencies and per-dependency \`opts-{depId}\` lists; Explore shows the files first. The tab has its own presets and its own stored state — nothing is shared with the Backend tab.`
      },
      {
        id: 'fe-admin-pill',
        title: 'Admin: The Backend ⇄ Frontend Pill',
        description: 'How the admin header toggle scopes the catalog tabs to one catalog.',
        content: `### Where to Find It
Open Config (Admin). The header has a pill toggle: **Backend** | **Frontend**. The current kind is remembered in the browser.

### What It Affects
These tabs show the rows of the current kind and stamp \`projectKind\` on every new row: **Dep Groups**, **Dependencies**, **File Contribs**, **Build Custom.**, **Sub-Options**, **Compatibility** and **Templates** (starter templates).

### Tabs Shown for One Kind Only
- Backend only: **Modules**, **Entity CRUD**, **Fullstack Examples**, **Schema sources**.
- Frontend only: **Palettes**.
- Both, across both kinds: **Overview**, **Activity**, **History**, **Versions**, **Departments**.`,
        callouts: [
          {
            type: 'warning',
            text: 'If you create a row under the wrong pill — say you add `state-zustand` while the pill is on Backend — it appears in the Spring catalog and breaks backend generation for anyone who picks it. Check the pill before clicking New.'
          }
        ]
      },
      {
        id: 'fe-build-types',
        title: 'Frontend Build Customization Types',
        description: 'ADD_NPM_DEPENDENCY, ADD_NPM_SCRIPT, and ADD_VITE_PLUGIN — reusing existing fields with new meanings.',
        content: `### Schema Reuse
Rather than adding a new entity, \`BuildCustomizationEntity\` has three frontend types whose columns are **reinterpreted**:

| Type | Field reinterpretation |
|---|---|
| \`ADD_NPM_DEPENDENCY\` | \`mavenArtifactId\` = npm package name (e.g. \`react-router-dom\`); \`version\` = semver range (e.g. \`^6.26.0\`); \`scope\` = \`"dev"\` → \`devDependencies\`, anything else → \`dependencies\`; optional \`subOptionId\` gate |
| \`ADD_NPM_SCRIPT\` | \`mavenArtifactId\` = script name (e.g. \`lint:fix\`); \`version\` = command (e.g. \`eslint . --fix\`). Later rows with the same name override earlier ones |
| \`ADD_VITE_PLUGIN\` | \`mavenGroupId\` = import path (e.g. \`@vitejs/plugin-react\`); \`mavenArtifactId\` = import binding (e.g. \`react\`); \`version\` = call expression (e.g. \`react()\`) |

### How They're Applied
- **\`PackageJsonBuilder\`** renders \`templates/frontend/fe-package-base.mustache\` (which already holds \`react\` and \`react-dom\` at the selected React version), then adds every \`ADD_NPM_DEPENDENCY\` and \`ADD_NPM_SCRIPT\` row. Keys are alphabetised for stable diffs.
- **\`ViteConfigBuilder\`** renders \`templates/frontend/fe-vite-config.mustache\` with the imports and plugin calls of the \`ADD_VITE_PLUGIN\` rows (\`{{vitePluginImports}}\`, \`{{vitePluginCalls}}\`).

### Always-On Packages & Scripts
The \`__common__\` rows give every project \`typescript\`, \`vite\`, \`@vitejs/plugin-react\`, \`@fontsource/inter\` and the quality stack (\`eslint\`, \`@eslint/js\`, \`typescript-eslint\`, \`eslint-plugin-react-hooks\`, \`eslint-plugin-react-refresh\`, \`globals\`, \`prettier\`, \`husky\`, \`lint-staged\`), plus the scripts \`lint:fix\`, \`format:check\` and \`typecheck\`. The \`@vitejs/plugin-react\` row is the single \`__common__\` \`ADD_VITE_PLUGIN\` row.

### Kind-Aware Admin Form
With the pill on Frontend, the **Build Custom.** form offers only the three frontend types, with labels that match — *Package Name*, *Script Name*, *Command*, *Import Path*, *Import Binding*, *Plugin Call* — instead of the underlying Maven columns.`,
        callouts: [
          {
            type: 'tip',
            text: 'Adding a new npm package via the admin is one row: switch the pill to **Frontend**, open **Build Custom. → New Customization**, pick `ADD_NPM_DEPENDENCY`, fill **Package Name** and **Version**, tick **devDependency?** if it belongs in `devDependencies`, and save. Build customizations are read on every generation, so the next project has it.'
          }
        ]
      },
      {
        id: 'fe-structure',
        title: 'What Gets Generated',
        description: 'What every project ships with, and what the dependencies add.',
        content: `### Baseline Layout
Every generated frontend project includes:

- **Build & config** — \`package.json\`, \`vite.config.ts\`, \`tsconfig.json\`, \`tsconfig.node.json\` with \`@app/@pages/@widgets/@features/@entities/@shared\` path aliases in both Vite and TypeScript; \`src/vite-env.d.ts\`; \`.env.development\` and \`.env.example\`.
- **Entry** — \`index.html\` (\`{{appTitle}}\`, and \`dir="rtl"\` when asked), \`src/main.tsx\` mounting \`<App/>\`, and a working \`HomePage\` under \`src/pages/home/ui/\`.
- **Quality** — \`eslint.config.js\` (flat config), \`.prettierrc.json\`, \`.husky/pre-commit\` running \`lint-staged\`. Always on.
- **CI / deploy** — a multi-stage \`Dockerfile\` per Node version (node → nginx), \`nginx/nginx.conf\` with SPA fallback listening on \`\${PORT}\` (3000, what the k8s values expect), \`entrypoint.sh\` that substitutes it and the API upstream, \`k8s/Jenkinsfile\`, \`k8s/values.yaml\`, \`settings.xml\`, \`VERSION\`, \`.editorconfig\`, \`.dockerignore\`.
- **All 6 FSD layers** — \`src/app\`, \`src/pages\`, \`src/widgets\`, \`src/features\`, \`src/entities\`, \`src/shared\` — each with a barrel \`index.ts\` and a short \`README.md\`.

### Dependency-Driven Files
Most dependencies add files, not only packages: the routers (routes and a layout), Zustand and Redux Toolkit (a store), TanStack Query (a client and provider), shadcn (its components, per sub-option), MUI, Chakra and Mantine (a themed provider), Menora Digital (the design system's tokens, components and logo), MSAL (the auth configuration), Storybook, react-hook-form, the OpenAPI client, Playwright, Tailwind (\`tailwind.config.js\`, \`postcss.config.js\`, \`src/index.css\`), and Vitest + Testing Library (\`vitest.config.ts\`, \`src/test-setup.ts\`, a \`HomePage\` test and a CI workflow).`,
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

Returns the form defaults, the React/Node/package-manager lists, the pinned TypeScript/Vite versions, the palettes and the FRONTEND catalog (groups → entries → sub-options).

### Generate
\`\`\`bash
curl -o demo.zip "http://localhost:8080/frontend/starter.zip?\\
projectName=demo&appTitle=Demo&scope=menora&department=lts&\\
reactVersion=18&nodeVersion=20&packageManager=pnpm&\\
dependencies=router-react-router,state-zustand,style-tailwind,test-vitest-rtl&\\
opts-state-zustand=sample-store&\\
opts-router-react-router=lazy-routes,sample-routes"

unzip -l demo.zip
\`\`\`

Other parameters: \`description\`, \`basePath\`, \`colorPalette\`, \`rtl\`, \`apiBaseUrl\`, \`backendArtifactId\`. \`/frontend/starter.preview\` takes the same and answers the file tree. Sub-options follow the backend's \`opts-{depId}=opt1,opt2\` convention.`,
      },
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // FULLSTACK CRUD GENERATOR
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'fullstack-generator',
    title: 'Fullstack CRUD Generator',
    icon: 'dynamic_form',
    topics: [
      {
        id: 'fs-what',
        title: 'What Is the Fullstack Generator?',
        description: 'Describe the entities, get a working Spring Boot backend and React frontend wired together in one ZIP.',
        content: `### Purpose
The **Fullstack** tab takes an entity model — entities with fields and relations, plus pages, workflows, access rules and options — and generates one ZIP holding a working Spring Boot backend (\`backend/\`) and React frontend (\`frontend/\`), already wired together. Each entity gets an entity, repository, DTO, service and REST controller (paging, sorting, search, filters, a \`/stats\` endpoint for charts) and its list, form and detail screens.

Most internal Menora systems being rewritten are "tables with CRUD and a few screens around them". This turns each new one from days of glue into minutes.

### How It Is Built
- **Backend** runs through the standard Spring Initializr pipeline, so the dependency catalog applies as usual; \`FullstackProjectGenerationConfiguration\` adds the per-entity code from the backend **template set**.
- **Frontend** is the Frontend generator's project laid down first, with the frontend template set rendered over it (the CRUD screens, the shell, the shared UI and its styling).
- The root gets \`README.md\`, \`.gitignore\`, \`.gitattributes\`, \`compose.yaml\` and \`menora-model.json\`.

### What the Model Can Say
- **Field types**: text, long text, Markdown, whole numbers, decimals, money with a currency, yes/no, date, time, date-time, instant, UUID, enum (with labels), file and image attachments.
- **Relations**: many-to-one (a foreign key), many-to-many (a join table — and the other entity can declare its **other side**, so both show, filter and edit the same links), one-to-many (the rows that point here — optionally edited inside the parent's form, a **composition**). A many-to-many is also a bulk change, a cell edited in place, a wizard step, and filled in the demo rows.
- **Access**: who may read and who may write each entity, enforced by the backend.
- **Workflows**: a status moved only by named transitions, with roles, an assignee, a due date, an inbox, a log of moves and e-mails.
- **Rules**: checks over several fields, fields shown only when a condition holds, computed fields, unique keys, help text.
- **Pages**: dashboards, lists, records, reports, wizards, boards, calendars and more — see **Frontend Pages**.`,
        callouts: [
          {
            type: 'info',
            text: 'The Fullstack tab is independent of the Backend and Frontend tabs. It posts a JSON body to `/starter-fullstack.zip` (Explore to `/starter-fullstack.preview`), and the server checks the whole request — a 400 says where in the model the problem is, and the editor opens that place.'
          }
        ]
      },
      {
        id: 'fs-using',
        title: 'Using the Fullstack Tab',
        description: 'From an example or a schema to a working, downloaded project.',
        content: `### Start From Something
- **Examples** — Blog, Orders, Tickets, Inventory, Course enrolments, Sales reporting, Project planning and Approvals, each showing a different part of the model (admins manage them under **Config → Fullstack Examples**).
- **Presets and recents** (this browser), **Team** models (shared on the server), **Import JSON** (an export, or a generated project's \`menora-model.json\`).
- **Import from DDL** — pasted SQL, a \`.sql\` file, a live database or a SELECT view (see **Import From DDL**).

### The Editor's Sections
**Project metadata**, **Backend** (the backend template set), **Frontend** (a summary; its look is edited in the layout designer's Appearance view), **Options** (the scaffold options), **Dependencies** (pre-checked from the backend set's defaults), **Entities** and **Pages**. A section with problems shows a red dot in the section bar; Explore and Generate say how many problems there are and jump to the first.

### An Entity Card
- The fields table: name, label, type, and flags for key, generated, required, unique. Each row's **More** panel holds the constraints (length, min/max, pattern, e-mail), the default value, **help text**, **show when** and **computed as**.
- **Relations** — kind, target, label; a one-to-many names the link it reads and may be edited in the form.
- **Settings** — labels, table and schema, a SELECT view, **who may read / write**, **unique together**, **rules**.
- **Workflow** — the status field, transitions (with roles, required fields and e-mails), assignee and due date.
- **Overrides** — the scaffold options for this entity alone; **Preview UI** — a mock of its list and form.
- Suggestions (amber) offer one-click fixes; everything is undoable (Ctrl+Z), and the model can be shared as a link.

### Generate, Then Run
Generate posts the model to \`/starter-fullstack.zip\`; a card then shows the next steps. Unzip, then either:
- \`docker compose up --build\` and open http://localhost:3000; or
- \`cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=local\` (the \`local\` profile gives the developer \`dev-user\` and its roles without LDAP), and \`cd frontend && npm install && npm run dev\` → http://localhost:5173.

### Later Changes
Keep the project in git. After changing the model, **Download update** gives a patch to apply to the project rather than a new ZIP to copy over — see **Updating a Project**.`,
        callouts: [
          {
            type: 'tip',
            text: 'Switching the backend template set keeps the dependencies the developer added. Reset (in the sticky action bar) restores the whole editor to the stock model, and can be undone.'
          }
        ]
      },
      {
        id: 'fs-model',
        title: 'Access, Workflows and Rules',
        description: 'What the model enforces in the generated backend, and what it does not.',
        content: `### Access
With an ldap-auth dependency on the build — \`ldap-auth-rest\` is in both backend sets' defaults — every endpoint is checked against the caller's roles. Each entity says who may **read** and who may **write** it: anyone signed in, users, or admins (default: users read, admins write; an admin is a user too). Groups come from the LDAP REST service; on a developer's machine the \`local\` profile gives \`dev-user\` its roles. The generated frontend follows: it offers New, Edit, Delete, Import and bulk changes only to a caller who may write, and shows only the pages the caller may open. Page \`roles\` restrict a page as well.

**Rows can belong to users.** In an entity's Settings, *Whose rows* limits users to their own: either they see and change only their own rows (anyone else gets "not found"), or they see every row and change only their own. *A row belongs to* says who owns one: whoever created it (this turns the audit columns on for the entity) and/or text fields holding a user id — a workflow's assignee, a "reviewer". A row is yours when any of them names you; an owner field left empty on a new row is filled with whoever creates it. Admins always see and change everything. Lists, exports, statistics, the change history, uploaded files and the rows edited inside a parent's form all follow the same limit, and a link to a row you may not see is refused. In the request it is \`access: {owners: ["createdBy", "assignee"], rows: "OWN"}\` (or \`"OWN_WRITES"\`). Ownership by LDAP group or by team is not offered. On a developer's machine \`dev-user\` is an admin and sees every row — give it \`USER\` in \`application-local.yaml\` to see the limit at work.

### Workflows
An entity may carry a workflow: its status changes only through named **transitions** (\`POST /api/x/{id}/transitions/{name}\`), each limited to roles and possibly asking for fields; an **assignee** to claim, release and (admins) reassign; a **due date**; an **inbox** page with "mine / unassigned / open" queues. **Keep a log of moves** adds a History section to the record. A transition's **e-mails** notify the assignee, the creator (needs the audit option), admins or users — sent only once the generated app is configured (\`app.events.mail.enabled: true\` and \`spring.mail.host\`).

### Rules, Show-When, Computed Fields
- **Rules** — checks over several fields in a small expression language (\`endsOn >= startsOn\`, \`when status == 'DONE': not isEmpty(estimate)\`), checked by the form and by the backend before every save. An empty value makes a rule hold.
- **Show when** — a field shown only while a condition holds, cleared by the backend while it does not.
- **Several files** — a FILE or IMAGE field can hold a list of files (up to 50): the form takes several at once, the list shows the first picture or the names, the details every file.
- **Linked rows** — a rule, show-when or formula can read a field of the row a link points at (\`amount <= costCenter.budget\`); the form fetches that row when the link is picked, and the server checks it on every save.
- **Rows inside a form** — rows edited in their parent's form (a composition) keep their own rules, show-when conditions and computed fields; saving the parent checks every row.
- **A record that reads its rows** — a parent's rule or computed field can read the rows saved with it: \`sum(lines.lineTotal)\`, \`count(lines) > 0\`, \`min\`, \`max\`, \`avg\`. The form follows the rows as they are edited, and a row changed on its own page runs the parent's rules again. A record with such rows always checks that nobody else saved it in between (turn *Optimistic locking* off on the entity to opt out).
- **Computed as** — a stored column the backend sets from a formula on every save, read-only in the form.
- **Unique together** — a constraint over several fields and links, answered with a 409 that names them.

The editor checks every expression as it is typed, with the same rules as the server.`
      },
      {
        id: 'fs-options',
        title: 'Scaffold Options',
        description: 'The project-wide options, each of which an entity can override.',
        content: `### The Options
| Option | What the generated app gets |
|---|---|
| \`tests\` (on for a new model) | An API test per entity over the real controller, service and an in-memory H2, plus Vitest tests of each form and list page |
| \`audit\` | Created/updated when **and by whom**; a "Changed by me" filter |
| \`history\` | Every change to a row kept, with before/after values; an admin can restore an earlier version |
| \`events\` | Each change written to an outbox and sent to a Kafka topic per entity (with \`kafka\`), to signed webhooks, and to open browsers, which refresh at once |
| \`softDelete\` | Deleted rows kept and restorable (Undo on delete) |
| \`optimisticLocking\` | A version column; a stale save is a 409 the form offers to reload or overwrite |
| \`csvExport\` / \`xlsxExport\` | Export of the filtered list as CSV / an Excel workbook |
| \`csvImport\` | Upload a CSV, checked row by row, all or nothing |
| \`bulkDelete\` / \`bulkUpdate\` | Select rows and delete them or set a field on all |
| \`inlineEdit\` | Table cells edited in place |
| \`savedViews\` | Named views of a list (search, filters, sort, columns) kept on the server per user |
| \`inverseCollections\` | A parent shows a count of its children |
| \`openapi\` | springdoc annotations and a Swagger UI |
| \`seedData\` | Eight demo rows per entity on first start |

\`secured\` is retired (access is per entity now); a model that names it still validates. An entity's **Overrides** panel turns an option off (or on) for it alone; the editor says when an option cannot apply to an entity (a view, a composite key, a read-only entity).`
      },
      {
        id: 'fs-pages',
        title: 'Frontend Pages',
        description: 'Shape the generated frontend as pages — dashboards, lists, tabs, master–detail, records, reports, wizards, forms, inboxes, calendars, boards, trees, content, import and search — instead of the fixed classic shell.',
        content: `### Classic shell or a layout
Without a layout the generated app has a dashboard plus one list page per entity. The **Frontend pages** section (below Entities) replaces that with pages of your own. **Start from my entities** seeds a dashboard and a list per entity, the Examples ship layouts to learn from, and **Use classic layout** drops the layout again (undoable).

### The layout designer
The section is a card: the layout as a small sitemap, its problems, and **Open designer**. The designer fills the screen:
- **Library** (left) — page types, suggestions for your entities, your saved page templates, **team templates**, widgets (with suggestions for the entity you are working on) and whole-layout templates. Drag a card where it should go, or click it to add it at the end. On a tabs, report, record or wizard page the library offers that page's **parts** instead.
- **Canvas** (middle) — the page strip over a live preview of the selected page, with sample data. Click a widget to edit it, drag it to move or resize it, double-click a title to rename it. Zoom, Mobile and Tablet widths, and a Data · Empty · Loading · Error switch.
- **Play mode** (\`P\`) walks the layout as the generated app would: rows open their record page, New opens the form, a chart drills into its list.
- **Inspector** (right) — the selected widget's settings, or the page's **Basics**, **Layout** and **Access**, and a **Code** tab with the files the page generates.
- **Appearance** sets the app's look: the frontend template set, colour palette, language, right-to-left, and the classic dashboard's heading.
- **Sitemap** renames and reorders the navigation's sections and sets the menu style and the header tools; **Page flow** draws how pages lead to each other and marks the ones nothing leads to.
- Widgets copy, cut and paste (Ctrl+C / X / V), move to another dashboard, and can be saved or shared with the team. **Export spec** writes the whole layout as one offline HTML file.

### The page types
- **Dashboard** — widgets on a four-column grid: number tiles (optionally with a trend line or a comparison with the previous period), breakdown, donut and stacked charts, trends, recent rows, top lists, progress to a target, gauges, funnels, time in state, pivots, an activity feed, an embedded list, links to other pages and text notes. A period picker and up to four **filters** apply to every widget they fit; a widget can **drill to** a list or report.
- **List** — one entity's table, cards, board, calendar or **gallery** (with an image field). It can open filtered, with chosen columns, sort, view and page size, open rows in a drawer, a side pane or the record page, and **hide actions** (New, Edit, Delete, Export, Import, bulk).
- **Tabs** — two to six other pages side by side.
- **Master–detail** — a parent list beside the selected parent's child rows, optionally with the parent's card.
- **Record** — one row, with related lists as tabs, number tiles above them and, when asked, a Print button.
- **Report** — an entity's filter bar, one to four charts (bar, donut, stacked, line, area or a totals table) and grouped totals.
- **Wizard** — a create (and edit) form split into steps, with a review before saving.
- **Form** — an entity's whole form on a page of its own; it takes over New and Edit.
- **Inbox** — a workflow's tasks in queues (mine, unassigned, all open), with their moves.
- **Calendar** — rows by a date, as a month, week, agenda or timeline.
- **Board** — cards in lanes of an enum or yes/no field, moved by drag or menu; through the workflow when the lanes are its states.
- **Tree** — an entity that points at itself, as an outline.
- **Content** — a page of text with links to other pages.
- **Import** — CSV upload into one entity, checked before anything is saved.
- **Search** — one search box over several entities.

### How the navigation is built
- The first page in the navigation is the **start page**.
- Pages sharing a **group** are listed together as one section. The menu is a sidebar or a top bar, and the header can carry a **user menu**, a **notification bell** (from the workflows' queues) and a **command palette** (Ctrl+K).
- A **hidden** page is out of the navigation (a list hidden this way shows up only as a tab; a hidden wizard or form is still a route).
- **Roles** (ADMIN, USER) restrict a page; they need an ldap-auth dependency.

### Problems and warnings
Red problems block Generate: a stale entity or field, a missing tab target, an id used twice. Amber **warnings** do not block — they name dead ends: a hidden page nothing embeds, a chart with no list to drill into, an entity no page lets anyone create. Most carry a **Fix**; **Fix all** applies every fix as one undo step.`,
        callouts: [
          {
            type: 'tip',
            text: 'The editor validates a layout exactly as the server does on Generate, so a green section means the request will pass. If the server still rejects a page, the editor opens it and highlights the problem.'
          }
        ]
      },
      {
        id: 'fs-import-ddl',
        title: 'Import From DDL',
        description: 'Pre-fill the entity editor from SQL, a live database or a SELECT view.',
        content: `### When to Use
You already have a schema and don't want to type each field. The drawer reads it and lists the entities it found; tick the ones to import (a relation to an unticked entity is shown struck through), then **Import N of M**. If the editor already has entities, choose Replace or Append.

### Three Sources
- **Paste SQL** (or drop a \`.sql\` file) — \`CREATE TABLE\` statements, with a dialect. A \`CREATE VIEW\` (or a \`SELECT\` among the statements) becomes a read-only view entity, its fields typed by the tables it reads. \`POST /metadata/fullstack/import-ddl\`.
- **From a database** — the live-schema panel (see the SQL wizard's **Reading From a Live Database**): a source or a typed connection, a schema, the tables and views. \`POST /metadata/fullstack/import-live\`. Views come back read-only, with their columns typed.
- **A SELECT** — one query becomes a read-only view entity (\`@Subselect\`). \`POST /metadata/fullstack/import-select\`.

### What Is Kept
- Types: \`BIGSERIAL\` → LONG + generated, \`NUMERIC(p,s)\` → BIG_DECIMAL, \`UUID\` → UUID, \`TIME\` → LOCAL_TIME, a zoned timestamp → INSTANT, \`TEXT\` → TEXT.
- Primary keys (composite too), lengths, NOT NULL, column-level UNIQUE.
- A foreign key to a table in the same import → a **many-to-one relation** (the column leaves the fields).
- \`CHECK (col IN ('A','B'))\` → an **enum**.
- The column and table names exactly as the database spells them, so the entity maps onto the existing schema.

### Lossy By Design
| Source | Becomes | Why |
|---|---|---|
| \`SMALLINT\` | INTEGER | No short type |
| \`FLOAT\` / \`DOUBLE\` | BIG_DECIMAL | Closest numeric type |
| \`BYTEA\` / \`BLOB\` | STRING | Use a FILE or IMAGE field for uploads |
| a composite foreign key, or one to a table not imported | a plain field | A relation needs a single-key target in the model |

### Parse Errors
Invalid DDL returns a 400 naming the statement; the drawer shows it inline and keeps what you typed.`,
        codeExamples: [
          {
            title: 'Example — PostgreSQL, with a relation and an enum',
            language: 'sql',
            code: `CREATE TABLE customers (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(200) NOT NULL UNIQUE,
    full_name VARCHAR(120)
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('OPEN', 'PAID', 'CANCELLED')),
    placed_at TIMESTAMPTZ,
    total NUMERIC(10,2)
);`
          }
        ]
      },
      {
        id: 'fs-deps-and-defaults',
        title: 'Dependencies & Per-Set Defaults',
        description: 'How the dependency list is seeded, and what the generator adds by itself.',
        content: `### Wire Semantics
| Request | Behavior |
|---|---|
| **\`dependencies\` omitted** | The backend set's default dependencies |
| **\`dependencies: []\`** | No extras |
| **\`dependencies: [...]\`** | That list — the set's defaults are not merged in |

Whatever the list, the compatibility rules then apply (a REQUIRES adds its target, a CONFLICTS is a 400), and some options bring what they need: \`openapi\` adds springdoc, a workflow e-mail adds the mail starter, \`tests\` runs on an in-memory H2 in test scope.

### Where Defaults Come From
Each backend set carries default dependencies (\`entity_template_set_default_dep\`). Both shipped sets have \`data-jpa, web, h2, validation, actuator, ldap-auth-rest\` — \`ldap-auth-rest\` because access rules, page roles and workflow roles need it. To change them: **Config → Entity CRUD → edit the set → Default Dependencies**.

### A Real Database
Replace \`h2\` with the database (\`postgresql\`, \`mssql\`, \`oracle\`, \`db2\`) rather than adding it beside — with both, H2 stays the application's datasource. Add \`flyway\` too: the model is then the first migration (\`V1__init.sql\`, written for that database) and Hibernate only validates the schema. Without Flyway, an application on a real database starts with no tables.`,
        callouts: [
          {
            type: 'warning',
            text: 'Without an ldap-auth dependency nothing is checked: every endpoint is open, and access rules and page roles have no effect (roles are a 400 then). Keep ldap-auth-rest unless the app is deliberately open.'
          }
        ]
      },
      {
        id: 'fs-generated',
        title: 'The Generated Project',
        description: 'What a fullstack ZIP holds, and how a team builds, runs, tests and configures it.',
        content: `### Layout
\`backend/\` (a Maven project, with everything a Backend-tab project has: Dockerfile, k8s files, Vault profile…), \`frontend/\` (Vite + React), and at the root \`README.md\`, \`compose.yaml\`, \`menora-model.json\`, \`.gitignore\`, \`.gitattributes\`.

### Run
- **Everything in Docker**: \`docker compose up --build\`, then http://localhost:3000 (the API is on :8080). The database, if any, comes up with it.
- **For development**: the database alone with \`docker compose up -d <db>\`, the backend with the \`local\` profile (plus \`compose\` to point at that database), the frontend with \`npm run dev\` on :5173, which proxies \`/api\` to the backend.

### Test
- \`mvn package\` runs the generated API tests on an in-memory H2 (the \`test\` profile), whatever the application's database — no database needs to be running.
- \`mvn test -Pdb-tests\` runs the same tests on the real database, on the schema Flyway makes (Docker needed).
- \`npm test\` runs the frontend's Vitest tests.

### Migrations
With \`flyway\`, \`backend/src/main/resources/db/migration/V1__init.sql\` is the model, for the chosen database. An update of the model adds \`V<timestamp>__model_update.sql\`: what the model adds runs as it is; what it removes or tightens is written commented out, for a person to review.

### Settings the Team Owns
- **Uploaded files** (with FILE/IMAGE fields): \`app.attachments.storage\` = \`database\` (default), \`filesystem\` or \`s3\`; uploads no record keeps are deleted after \`app.attachments.keep-unattached\` (24h). A file is read with its record's read level.
- **Events** (\`events\` option): \`app.events.*\` — the Kafka topic prefix, webhooks with their HMAC secret and the event types each wants.
- **E-mails** (workflow \`notify\`): off until \`app.events.mail.enabled: true\` and \`spring.mail.host\` are set; addresses from \`app.events.mail.users\`, the LDAP REST service or a mail domain.
- **CORS** is off: the frontend calls \`/api\` on its own origin (Vite proxy in development, nginx in its container).

The project's README covers each of these.`
      },
      {
        id: 'fs-template-sets',
        title: 'Template Sets',
        description: 'How the generated files are organised, and where their variables are documented.',
        content: `### Anatomy
A template set is a DB-backed bundle of Mustache files keyed by \`set_key\` and tagged with a \`kind\`. Four ship:

| Set | Kind | Notes |
|---|---|---|
| \`spring-jpa-crud\` | BACKEND_JAVA | The default backend |
| \`spring-jpa-crud-lombok\` | BACKEND_JAVA | Lombok entities; borrows every other file from \`spring-jpa-crud\` |
| \`react-tailwind-crud\` | FRONTEND_REACT | The default frontend (Tailwind 4) |
| \`react-menora-digital-crud\` | FRONTEND_REACT | The same app in the Menora Digital design system; borrows most files from \`react-tailwind-crud\` |

Backend files are rendered inside the Initializr pipeline by \`FullstackProjectGenerationConfiguration\`; frontend files by \`FullstackRenderer\` over the Frontend generator's project.

### File Rows
- **pathTemplate** — Mustache-rendered with the full context, so \`src/main/java/{{entityPackagePath}}/{{EntityName}}.java\` becomes one file per entity.
- **content** — Mustache (\`MUSTACHE\`) or verbatim (\`NONE\`).
- **perEntity** — once per entity; **perPage** — once per page of the layout; neither — once per project.
- **gatedBy** — a context flag that must be true for the file to be written (\`apiTestApplicable\`, \`hasCompositePk\`, \`hasWidgets\`…).
- **sourceSet** (manifest only) — borrow the file's content from another set.
- **seedHash** — the template sync's record of the shipped content (see **Admin: Managing Template Sets**).

### Variables
The context is large — project, entity, field, relation, page and widget variables. The **Mustache Templating → Fullstack Entity Context** topic has the essentials; \`backend/docs/MUSTACHE_GUIDE.md\` lists them all.

### Generated API Conventions
Lists take \`?page\`, \`?size\`, \`?sort\` (whitelisted per controller; default all key columns), \`?q\` (a case-insensitive search over text fields) and each filter; errors are RFC-7807 problem details (404, 409, 400 with the field errors).`,
        callouts: [
          {
            type: 'info',
            text: 'Mustache and JSX both use `{{` as an opener. The shipped templates avoid `pagination={{ … }}` (which Mustache would try to parse as a tag) by lifting the object to a `const` and passing `pagination={pagination}`.'
          }
        ]
      },
      {
        id: 'fs-admin',
        title: 'Admin: Managing Template Sets',
        description: 'The Entity CRUD tab — sets, their files and default dependencies — and how sets follow a release.',
        content: `### Where to Find It
**Config → Entity CRUD**. Two panes:
1. **Sets** (top) — \`setKey\`, \`name\`, \`kind\`, enabled, sort order.
2. **Files in Selected Set** (bottom) — after you click a set. \`pathTemplate\`, \`perEntity\`, file type, substitution type, sort order.

### Editing a Set
The drawer has the set's fields plus **Default Dependencies** (backend sets only). Saving PUTs the dependency ids to \`/admin/entity-template-sets/{id}/default-deps\` (full replace).

### Editing a File
The drawer uses the same code editor as File Contributions. The \`pathTemplate\` is Mustache-rendered with the entity context; \`perEntity\` chooses once per entity or once per project.

### Template Sync: Sets Follow the Release
On every start, each shipped file row is compared with what the database holds:
- a row nobody edited (its content still matches its \`seedHash\`) is brought up to the release's file;
- a row an admin edited is **kept** and logged (\`seedHash = "custom"\`), and no longer follows the release;
- a file the release adds is added; a shipped file an admin deleted is put back.

\`POST /admin/entity-template-sets/reset\` takes every set back to the shipped files, discarding edits (there is no button for it). \`initializr.fullstack.template-sync=off\` turns the sync off. The **Fullstack Examples** follow the same rule (an edited example is kept), except that a deleted example is not added back.

### Fullstack Examples
**Config → Fullstack Examples** manages the Start-from examples: entities, an optional page layout and editor settings. Every save is checked like a generation request, so a stored example always generates; a Team model's entities can be copied in.

### Export / Import
The configuration export carries the sets, their files and default dependencies, and the fullstack examples. It does not carry team models, team templates or team presets.

### Deleting a Dependency
A dependency a set's defaults name is flagged by the orphan check; a forced delete (\`DELETE /admin/dependency-entries/{id}?force=true\`) removes it from every set's defaults too.`
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // WORKING WITH GENERATED PROJECTS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'generated-projects',
    title: 'Updating & Running Projects',
    icon: 'difference',
    topics: [
      {
        id: 'update-what',
        title: 'Updating a Project Instead of Regenerating',
        description: 'Every project keeps the model it was made from; a changed model comes back as a patch.',
        content: `### The Model File
Every project the generator makes — plain, wizard, multi-module and fullstack — has a \`menora-model.json\` at its root: the request it was generated from (for a wizard project, the pasted documents and their options too) and a hash of what generated it (\`generator.catalogHash\` for a backend, \`generator.templatesHash\` for fullstack). Developers should commit it with the project.

### Why Not Generate Again?
A team edits the code after generating. Generating again and copying the new files over loses those edits. Instead, the generator makes **both** versions — the project as the old model generates it and as the new model does — and answers with only the difference, as a patch git merges into the team's code (\`git apply --3way\`). Where the team changed the same lines, git leaves conflict markers to resolve, as after a merge.

### Updates Bring the Generator's Fixes Too
The model file also names the project's files (\`generator.snapshot\`), and the server keeps the files of every download for two years from their last use. An update then compares the new model, generated today, with **the files the project was actually generated with** — so the patch carries the model's change *and* everything the generator writes differently since: fixes to its templates, its catalog and the code behind them. \`UPDATE.md\` starts with "Where it starts" when this is the case, and the update's toast says so.

Applying an update replaces the project's model file with one naming the result, and **Mark as applied** remembers it, so the next update starts from there.

### When the Files Are Not Kept
A project generated before the server kept files — or whose files went unused past the retention — is updated the old way: both sides are generated **today**, with today's catalog and templates, so the patch is the change the **model** makes only, not the improvements since. \`UPDATE.md\` then says whether the catalog (or the templates) moved since, from the hash in the project's model file.

### Changes Generated Code Survives Best
- OpenAPI projects on **Interfaces**: an update rewrites the \`<Tag>Api\` interfaces and never touches the controller the team implemented.
- Fullstack projects with \`flyway\`: what the model adds to the schema arrives as \`V<timestamp>__model_update.sql\`; what it removes or tightens is written commented out, for a person to review before running.`
      },
      {
        id: 'update-how',
        title: 'Downloading and Applying an Update',
        description: 'The update panels on the Backend and Fullstack tabs, and what to do with the ZIP.',
        content: `### Backend Tab
**Import model…** (above the form) loads a project's \`menora-model.json\`: the form, dependencies, options, modules and wizard documents are set from it. Once the setup differs from it — for the same artifact — the **Update the project you already have** panel offers:
- **Download update** — \`POST /starter.patch\`, saved as \`<artifact>-update.zip\`;
- **Mark as applied** — the current setup becomes the base for later updates;
- **Forget** — stop tracking the project.

A Generate also remembers what it generated, so the panel appears as soon as that setup is changed.

### Fullstack Tab
The same, with **Import JSON** for the project's \`menora-model.json\`, and **Preview changes** to compare the two generations file by file before downloading.

### The Update ZIP
\`<artifact>-update/\` holds:
- \`UPDATE.md\` — what changed, how to apply it, what the patch cannot carry;
- \`update.patch\` — the change, for git;
- \`files/\` — every added and changed file whole (for a file git cannot merge);
- \`DELETED.txt\` — the files the change removes (only when there are any).

### Applying It
From the project's root, with the team's work committed:
1. \`git apply --3way --whitespace=nowarn path/to/update.patch\`
2. Copy \`menora-model.json\` (and any file \`UPDATE.md\` lists as not in the patch) from \`files/\`.
3. \`git status\`: resolve "both modified" files, review with \`git diff HEAD\`, build, test, commit.

If git answers "repository lacks the necessary blob", the files were never committed as generated: apply with \`--reject\` and finish from \`files/\`, or copy those files over.`,
        callouts: [
          {
            type: 'tip',
            text: 'Agents do this end to end with the menora-initializr skill: mi update <dir> fetches and reviews the update, mi update <dir> --use <update> --apply applies it with git and reports conflicts. See Agent Skill (AI).'
          }
        ]
      },
      {
        id: 'update-api',
        title: 'Update REST API',
        description: '/starter.patch and /starter-fullstack.patch.',
        content: `### Endpoints
| Method | Path | Body |
|---|---|---|
| \`POST\` | \`/starter.patch\` | \`{ base, target, baseCatalogHash? }\` — each side a backend model file as it is, or just its \`request\` (a \`/starter-wizard.zip\` body, plus \`modules\` for multi-module) |
| \`POST\` | \`/starter-fullstack.patch\` | \`{ base, target, baseTemplatesHash? }\` — each side a \`/starter-fullstack.zip\` body |

The answer is the update ZIP, with headers \`X-Update-Added\`, \`X-Update-Changed\` and \`X-Update-Deleted\`. A side that cannot be generated is a 400 that says which: \`{ "error": "Invalid model", "side": "target", "detail": "bootVersion '9.9.9' is not a known version" }\` (fullstack errors also carry the \`path\` in the model).

Both are recorded in the Activity tab as **patch** actions.`,
        codeExamples: [
          {
            title: 'Add Kafka to a generated project',
            language: 'bash',
            code: `curl -o demo-update.zip -X POST http://localhost:8080/starter.patch \\
  -H "Content-Type: application/json" \\
  -d '{
    "base":   {"artifactId":"demo","groupId":"com.menora","dependencies":["web","data-jpa","postgresql"]},
    "target": {"artifactId":"demo","groupId":"com.menora","dependencies":["web","data-jpa","postgresql","kafka"]}
  }'
unzip -l demo-update.zip   # UPDATE.md, update.patch, files/...`
          }
        ]
      },
      {
        id: 'local-run',
        title: 'Running a Project Locally',
        description: 'compose.yaml, the compose profile, Testcontainers.',
        content: `### compose.yaml and the compose Profile
A backend whose dependencies need a service — PostgreSQL, Oracle, SQL Server, MongoDB, Redis, Kafka — gets a \`compose.yaml\` with those containers and an \`application-compose.yaml\` profile pointing the application at them:

\`\`\`bash
docker compose up -d
mvn spring-boot:run -Dspring-boot.run.profiles=compose
\`\`\`

A multi-module project has one \`compose.yaml\` at its root and the profile in its entry module. A fullstack project's \`compose.yaml\` also builds and starts its backend and frontend. DB2 here is IBM i, which has no container image, so it gets none.

### Images
Images are pulled through \`menora.containers.hub-prefix\` (default the \`repo.menora.co.il/dockerhub/\` proxy) — set it on the generator if the proxy moves.

### Tests on Real Databases
- The \`testcontainers\` dependency adds a sample test that starts the application on its databases in Docker (skipped where Docker is not running).
- A fullstack backend with the \`tests\` option has a \`db-tests\` Maven profile: \`mvn test -Pdb-tests\` runs its API tests on the real database.

The Backend and Fullstack tabs' next-steps cards show these commands after a Generate.`
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // TEAM SHARING
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'team-sharing',
    title: 'Team Sharing',
    icon: 'groups',
    topics: [
      {
        id: 'team-what',
        title: 'Presets, Models, Templates and Links',
        description: 'What developers share with each other on the server, outside the admin catalog.',
        content: `### What Can Be Shared
| What | Where | Endpoint |
|---|---|---|
| **Team presets** — a whole Backend-tab setup (form, dependencies, options, modules, wizard documents) | Backend tab → Presets strip → **Team**; the save prompt's *For the team* box | \`/metadata/backend/presets\` |
| **Team models** — a Fullstack-tab model | Fullstack tab → presets → **Team**; the save prompt's *Team* destination | \`/metadata/fullstack/models\` |
| **Team templates** — a page or a dashboard widget of the layout designer | the designer's library (*Team templates*, *Team widgets*); *Share with team* in the inspector | \`/metadata/fullstack/templates\` |
| **Share links** — the current setup in the URL | the header's Share button | the \`bs\` (Backend) and \`fs\` (Fullstack) parameters |

### How They Behave
- Anyone who can open the generator can read, save and delete them — they are not behind the admin login. A delete asks for confirmation, since it removes the item for everyone.
- Names are unique within each kind, ignoring case: a taken name is refused, or offered as an overwrite.
- The \`userinfo\` header names who saved each one.
- Team models are limited to 1 MB, templates to 64 KB.

### What They Are Not
They are not catalog rows: they do not appear in the admin, in History or in the configuration export, and an import does not touch them. Back them up with the database. The admin-curated equivalents are **Starter Templates** (Backend tab Quick Start) and **Fullstack Examples**.

### Share Links
A Backend link carries the form, dependencies and options as plain parameters; when the setup has modules or wizard documents it adds \`bs\` (the whole setup, encoded) — left out past 60 000 characters, and the tab says the link carries only the project and its dependencies. A Fullstack link carries the model in \`fs\`; opening one over unsaved work asks before replacing it.`
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // ADMIN OPERATIONS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'admin-operations',
    title: 'Admin Operations',
    icon: 'admin_panel_settings',
    topics: [
      {
        id: 'admin-signin',
        title: 'Signing In to the Admin',
        description: 'Single sign-on with an LDAP group, and the shared password.',
        content: `### Two Ways In
- **Sign in as <user>** — when the SSO gateway names the user (the \`userinfo\` header) and Menora's LDAP REST service lists a group containing the admin group among theirs. The service is asked at \`{ADMIN_LDAP_REST_BASE_URL}/employee/findGroupsByCn/{user}\`; the answer is kept a minute.
- **The shared password** — while \`admin.password-login\` is true (the default). Its holder is recorded as "<user> (password)" when the gateway names them, else "password".

\`ADMIN_LDAP_REST_BASE_URL\` and \`ADMIN_GROUP\` have **no defaults**: until they are set for an environment, only the password signs in.

### Tokens
A sign-in returns a signed token that carries its own expiry (\`admin.token-ttl\`, 12 hours) and the admin's name, so any instance behind a load balancer accepts it. Changing the password or \`admin.token-secret\` signs everyone out. The header shows who is signed in.

### Protection
- The password is compared in constant time. After \`admin.login.max-failures\` (10) wrong passwords from one address within \`admin.login.window\` (5 minutes), that address gets 429 until the window passes. Behind a proxy, set \`server.forward-headers-strategy\` or all admins share one count.
- A warning is logged at start while the password is still \`changeme\`.
- The H2 console is off in the shipped configuration (it is a SQL prompt on the catalog); a developer turns it on with \`--spring.h2.console.enabled=true\`.`
      },
      {
        id: 'admin-history',
        title: 'History: Who Changed the Catalog',
        description: 'Every catalog change, with who made it and the row before and after — and undo.',
        content: `### What Is Recorded
Every catalog row created, changed or deleted — through the admin screens, an import, the catalog sync, a template reset or a release's start-up sync — with when, who, the source, the request it came in, and the row before and after. Tracked: groups, entries, file contributions, build customizations, sub-options, compatibility rules, starter templates and their dependencies, module templates and mappings, entity template sets, files and default dependencies, palettes, versions, departments, fullstack examples and schema sources. Not tracked: team presets, models and templates, and the generation audit.

### The History Tab
- **Changes** — filter by table, source, who and text; a change opens a drawer with its fields before and after (changed ones marked).
- **Requests** — the changes grouped by the request that made them (an import is one request), each with **Show changes** and **Undo**.

### Going Back
- **Undo this change** — the row as it was before (a deleted row comes back with its own id).
- **Restore this version** — the row as this change left it.
- **Its whole request** — every change of one request, last first, in one transaction (undo a whole import).

Undo first checks that nobody changed the row since; otherwise it lists the rows and fields changed since, and **Undo anyway** overwrites them. The catalog cache is rebuilt after a restore.

### Limits
The log is kept forever. A shipped template file the release re-seeds comes back on the next start whatever an undo did. Undoing a row whose parent is gone fails — undo the parent first, or the whole request.`
      },
      {
        id: 'catalog-sync',
        title: 'Catalog Sync: Rows That Follow a Release',
        description: 'How file contributions and build customizations move with the release, and how an admin keeps their own.',
        content: `### What Follows a Release
| Catalog | On start |
|---|---|
| File contributions, build customizations | **Catalog sync**: a shipped row nobody edited is rewritten to the release's version; a new shipped row is added; an edited row is left alone and reported |
| Fullstack template sets | **Template sync**: unedited files follow, edited ones are kept, deleted shipped files come back |
| Fullstack examples | Unedited examples follow; edited ones are kept; deleted ones stay deleted |
| Versions | New shipped versions are added |
| Groups, entries, sub-options, compatibility rules, starter and module templates | Seeded once, into an empty database — never changed by a release |

### The First Start of an Existing Database
The first time a database meets the catalog sync, it cannot tell an admin's edit from an older release's content, so **that start changes nothing**: it records every shipped row, and logs a warning with how many differ or are missing. From then on, rows follow as above.

### Reviewing and Taking Shipped Rows
In the admin panel, **Catalog sync** lists the rows that differ from the release or are missing, for the catalog (Backend / Frontend) the sidebar shows. Status chips narrow the list (Kept and In step rows are there too). Tick rows and choose **Take shipped** or **Keep mine** — a kept row is no longer reported and never replaced, and **Follow the release again** undoes that. **Compare** opens a row: its fields here beside the shipped ones, and its content as a diff. **Take every shipped row** applies the release to every row of both catalogs that differs or is missing, after asking.

The same is open to scripts, behind the admin login:
- \`GET /admin/catalog-sync\` — every shipped row with its status: \`IN_STEP\`, \`DIFFERS\`, \`MISSING\`, \`KEPT\`, \`DELETED\` (\`?status=DIFFERS,MISSING\` to narrow).
- \`GET /admin/catalog-sync/{key}\` — the shipped and current row side by side.
- \`POST /admin/catalog-sync/apply\` \`{keys: […]}\` or \`{all: true}\` — take the shipped version (never of a row marked kept or deleted unless named).
- \`POST /admin/catalog-sync/keep\` \`{keys: […]}\` — mark rows as the admin's own: no longer reported, never replaced (\`kept: false\` undoes it).

\`initializr.catalog.sync=off\` turns it off. Everything the sync writes is in History (source "catalog-sync" or "release-sync").`,
        callouts: [
          {
            type: 'warning',
            text: 'After upgrading an existing installation, open Admin → Catalog sync: fixes a release made to shipped rows (Dockerfiles, nginx, datasource configs) reach that database only once an admin applies them.'
          }
        ]
      },
      {
        id: 'export-import-how',
        title: 'Export & Import',
        description: 'Back up the catalog, or move it between environments.',
        content: `### Exporting
**Export** (top right of the admin) downloads \`initializr-config-YYYY-MM-DD.json\` with the whole catalog: dependency groups and entries, file contributions, build customizations, sub-options, compatibility rules, starter templates and their dependencies, module templates and mappings, entity template sets with their files and default dependencies, palettes, versions, departments and fullstack examples.

Not in it: team presets, models and templates; schema sources (they name this environment's databases and secrets); the History and the generation audit.

### Importing
**Import** (top right), pick an exported file, confirm. The import **replaces** the catalog: every catalog table is cleared and filled from the file. The file's fullstack examples are checked before anything is deleted. An older export without versions, departments or fullstack examples leaves those three tables as they are.

The whole import is one request in **History**, so it can be undone as one. Imported rows that equal what a release last shipped keep following releases; others are reported by the catalog sync as differing.

### Recommendation
Export before any significant change, and keep the last few exports.`,
        callouts: [
          {
            type: 'warning',
            text: 'Import replaces — rows that exist in the database but not in the file are deleted. Undo it from History → Requests if it was the wrong file.'
          }
        ]
      },
      {
        id: 'activity-what',
        title: 'Activity: What Was Generated',
        description: 'The generation audit — every download, update and preview, with its kind, department, user and failure reason.',
        content: `### What a Row Records
Every call to a generation endpoint — \`/starter…\` and \`/frontend/starter…\` ending in \`.zip\` (a **download**), \`.patch\` (an **update**) or \`.preview\` (a **preview**). Each row has: when, the kind (backend, wizard, multimodule, fullstack, frontend), the artifact, Boot and Java versions, the dependencies the generation actually used, the wizards used, the number of entities, the department, the user (\`userinfo\`), the address (unless \`menora.audit.log-remote-addr: false\`), the duration, success or failure, and for a failure the error's own message.

Not recorded: the wizards' detection calls, and previews marked \`X-Preview-Intent: live\` (the Backend tab's file dock asks for those as the setup changes).

Rows are written by a background writer (a database hiccup never breaks a generation) and deleted after \`menora.audit.retention-days\` (365) by a nightly job.

### The Activity Tab
- Periods: 1, 7, 30, 90 or 365 days.
- Five cards: generations, previews, success rate, P50 and P95 duration.
- A per-day chart, stacked by kind.
- Breakdowns by kind, department, user, dependency, Boot version and endpoint; a kind, department or user narrows the events.
- Failures grouped by reason, with **Show events**.
- The events table with date, kind, action, status, department, user and text filters, paging and **Export CSV**.

### Why This Matters
- **Spot drift** — dependencies always picked together are a starter template waiting to be made.
- **Debug failures** — the reason is in the row, no server log needed.
- **Adoption** — which departments and teams use what.`
      },
      {
        id: 'activity-api',
        title: 'Activity REST API & Metrics',
        description: 'The endpoints behind the tab, and the Micrometer metrics.',
        content: `### REST Endpoints
All require an admin token (\`Authorization: Bearer <token>\`).

- \`GET /admin/activity/summary?days=30\` — generations (downloads and updates) counted apart from previews: totals, success rate, percentiles, per day by kind, by kind, endpoint, department and user, top dependencies and Boot versions, failures by reason.
- \`GET /admin/activity/events?from&to&kind&action&status&department&username&q&page&size\` — events, newest first, paged (at most 200 a page); dates are days, \`to\` inclusive; \`action=generation\` is downloads and updates.
- \`GET /admin/activity/events.csv\` — the same filter as CSV (at most 10 000 rows).
- \`GET /admin/activity/recent?limit=50\` — the latest events.

### Micrometer Metrics
On \`/actuator/metrics\`:
- \`menora.generation.count\` — counter tagged by \`status=success|failure\`
- \`menora.generation.duration\` — timer tagged by status

The generator itself does not include a Prometheus registry; to scrape these, add \`micrometer-registry-prometheus\` to its build and \`prometheus\` to the actuator exposure.`,
        codeExamples: [
          {
            title: 'Failed generations of the last week, as CSV',
            language: 'bash',
            code: `curl -H "Authorization: Bearer $TOKEN" \\
  "http://localhost:8080/admin/activity/events.csv?from=2026-11-11&status=FAILURE" -o failures.csv`
          },
          {
            title: 'Check the Micrometer counter',
            language: 'bash',
            code: `curl http://localhost:8080/actuator/metrics/menora.generation.count`
          }
        ]
      },
      {
        id: 'service-settings',
        title: 'Service Settings',
        description: 'The generator\'s own settings an operator sets per environment.',
        content: `### Access Gate
\`menora.access.require-user-header\` (env \`MENORA_ACCESS_REQUIRE_USER_HEADER\`, default false): when true, a request without the SSO gateway's user header (\`userinfo\`, \`menora.audit.user-header\`) is answered **403** with \`code: "USERINFO_REQUIRED"\`, and the UI shows a "No access" screen. \`menora.access.open-paths\` (default \`/actuator/**\`) stays open for the Kubernetes probes. Turn it on where the generator sits behind the gateway.

### Admin
\`admin.password\`, \`admin.password-login\`, \`admin.token-secret\`, \`admin.token-ttl\`, \`ADMIN_LDAP_REST_BASE_URL\`, \`ADMIN_GROUP\`, \`admin.login.max-failures\`, \`admin.login.window\` — see **Signing In to the Admin**. Every replica must share the password and secret.

### Limits on What a Request Can Do
- \`menora.wizard.max-documents-size\` (5MB) — the wizard documents of one request together, and each detect/import document.
- Artifact ids, frontend project names and wizard map keys must be plain names; a path built from a request, the catalog or a template that would leave the project folder is a 400.
- Pasted OpenAPI/AsyncAPI documents and WSDLs may not refer to files or URLs.

### Live Database Reads
\`menora.live-schema.typed-connections\`, \`allowed-hosts\`, \`max-tables\`, \`max-concurrent-reads\`, and the source passwords (\`SCHEMA_SOURCE_…\` / \`menora.live-schema.secrets.…\`) — see the SQL wizard's **Reading From a Live Database**.

### Audit
\`menora.audit.retention-days\` (365; 0 keeps all), \`retention-cron\` (03:30), \`async\` (true), \`log-remote-addr\` (true).

### Syncs and Containers
\`initializr.catalog.sync\` and \`initializr.fullstack.template-sync\` (\`off\` disables them), \`menora.containers.hub-prefix\` (where generated \`compose.yaml\` files pull images).

### One Database per Instance
Each start rewrites shipped rows nobody edited and applies the generator's own migrations, so two builds sharing a database file take turns rewriting each other's templates. Give each environment — and each branch on a developer's machine — its own database.`
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // COMMON WORKFLOWS
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
            description: 'Go to Config → Dep Groups. If your new dependency belongs to a new category, click New Group, enter a name, save. Skip this step if using an existing group.'
          },
          {
            title: 'Create the Dependency Entry',
            description: 'Go to Config → Dependencies. Click New Entry. Fill in: depId (unique, lowercase), name, description, group, and the Maven coordinates (groupId + artifactId; leave the version blank if the Spring Boot BOM manages it) — or tick File-only option for an entry that only brings files. Set compatibilityRange if the library only works with certain Boot versions.'
          },
          {
            title: 'Add File Contributions',
            description: 'Go to Config → File Contribs. For each file to inject (e.g. a YAML section for application.yaml, MyLibConfig.java for a Java config class), click New Contribution. Set dependencyId to your new depId, fileType (YAML_MERGE for YAML, TEMPLATE for Java), targetPath, content, substitutionType (MUSTACHE for Java files), and sortOrder.'
          },
          {
            title: 'Add Build Customizations (if needed)',
            description: 'Go to Config → Build Custom. If the library requires extra Maven dependencies (beyond the main entry) or exclusions, add them here. Set dependencyId to your new depId and customizationType to ADD_DEPENDENCY or EXCLUDE_DEPENDENCY.'
          },
          {
            title: 'Add Sub-Options (if applicable)',
            description: 'If the dependency has optional generated content (e.g. example classes), go to Config → Sub-Options (New Sub-Option). Add sub-option records with dependencyId = your depId. Then go back to File Contributions and set subOptionId on the conditional file contributions.'
          },
          {
            title: 'Add Compatibility Rules (if applicable)',
            description: 'Go to Config → Compatibility (New Rule). Add REQUIRES, CONFLICTS, or RECOMMENDS rules — the server enforces REQUIRES and CONFLICTS on every request. For example, if your library requires JPA, add a REQUIRES rule: sourceDepId = your depId, targetDepId = data-jpa.'
          },
          {
            title: 'Test It',
            description: 'Open the Backend tab, find your new dependency in the picker, select it, and check the file dock (Project files) or Explore for the expected files before generating. Every change you made is in History, should you need to undo it.'
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
            description: 'Config → File Contribs → New Contribution.'
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
            description: 'Go to File Contribs → New Contribution. Set: dependencyId = __common__, fileType = TEMPLATE, targetPath = Dockerfile, substitutionType = MUSTACHE, javaVersion = 17. Write the Dockerfile content using eclipse-temurin:17-jre-alpine base image. Include {{artifactId}} in the COPY command.'
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
            description: 'Go to Config → Sub-Options → New Sub-Option. Set: dependencyId = the existing depId (e.g. postgresql), optionId = a unique short ID (e.g. pg-readonly), label = display name (e.g. "Read-Only DataSource"), description = tooltip text.'
          },
          {
            title: 'Create the Gated File Contribution',
            description: 'Go to Config → File Contribs → New Contribution. Set: dependencyId = same depId, fileType = TEMPLATE (or YAML_MERGE), targetPath = the file to generate, content = the template content, subOptionId = the optionId you just created (e.g. pg-readonly).'
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
  // AGENT SKILL (AI)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'agent',
    title: 'Agent Skill (AI)',
    icon: 'smart_toy',
    topics: [
      {
        id: 'agent-skill',
        title: 'Driving the Generator From an AI Agent',
        description: 'The menora-initializr skill: one script over the public REST API, for Claude Code and other agents.',
        content: `### What It Is
An AI agent drives the generator through the same REST API the browser uses. There is no separate agent endpoint. The **menora-initializr** skill packages that for an agent: a \`SKILL.md\` the agent reads, one dependency-free Node script (\`scripts/mi.mjs\`, Node 18 or later) and reference pages on the fullstack request, the API and the generated projects. It lives in its own repository and is installed under \`.claude/skills/menora-initializr/\`.

### What an Agent Can Do With It
- **Discover** what this server offers: Boot and Java versions, every dependency id with its sub-options, the wizards, modules, template sets and fullstack examples (\`mi meta\`, \`mi meta deps <text>\`).
- **Preview and generate** every kind of project: plain, multi-module, the four wizards (SQL, OpenAPI, SOAP, AsyncAPI), frontend and fullstack, from an example, pasted DDL or a live database. The project is unpacked into a folder, and the agent gets the next steps for it.
- **Open team presets and models** as ready requests.
- **Update a project** it generated before, from its \`menora-model.json\`: fetch the update, review it, then apply it with \`git apply --3way\`, with conflicts and untracked files reported and never deleted.

### Settings
| Variable | Meaning |
|---|---|
| \`MENORA_INITIALIZR_URL\` | The generator's address (default \`http://localhost:8080\`) |
| \`MENORA_USERINFO\` | The user's login, sent as the \`userinfo\` header — needed when the service requires it (\`USERINFO_REQUIRED\`), and it names the user in the generation audit |
| \`MENORA_DB_PASSWORD\` | The password for a typed live-database connection; never written to a file |

### What It Means for an Admin
Nothing to set up on the server: the skill uses the public endpoints, so everything in this guide (the catalog, the access gate, the audit) applies to it. Its generations appear in the Activity tab like any other. A new endpoint or request field reaches agents only when the skill's references and script are updated too.`,
        codeExamples: [
          {
            title: 'A service, then an update',
            language: 'bash',
            code: `mi health
mi generate --artifact billing --deps web,data-jpa,postgresql,flyway --into billing
cd billing && git init && git add -A && git commit -m "Generated"
mi update . --add-deps kafka --out ../billing-update   # review UPDATE.md there
mi update . --use ../billing-update --apply`
          }
        ]
      }
    ]
  }
]
