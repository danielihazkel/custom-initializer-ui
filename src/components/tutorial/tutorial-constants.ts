
import { Module } from './tutorial-types';

export const CURRICULUM: Module[] = [
  {
    id: 'core',
    title: 'Core Fundamentals',
    icon: 'Cpu',
    lessons: [
      {
        id: 'ioc',
        title: 'Inversion of Control (IoC)',
        description: 'Deep dive into the ApplicationContext, Dependency Injection patterns, and common pitfalls.',
        content: `### 1. The Spring Container
At the heart of Spring is the **ApplicationContext**, usually referred to as the Spring Container. In a traditional Java application, you (the developer) control the creation and wiring of objects. You create a \`new User()\`, then a \`new Order()\`, and manage their relationships manually. This leads to code that is tightly coupled and hard to test.

**IoC (Inversion of Control)** flips this. You give up control of object creation. You tell Spring: *"I need a User Service, and it relies on a Repository"*. Spring creates the repository, creates the service, and puts them together.

### 2. Dependency Injection Variants
There are three main ways to inject dependencies. Knowing which to use distinguishes a junior developer from a senior one.

- **Constructor Injection (Recommended)**: Dependencies are passed to the constructor. This allows fields to be marked \`final\`, ensuring immutability. It also prevents the class from being instantiated in a "broken" state (without its required dependencies).
- **Setter Injection**: Useful only for optional dependencies that might be swapped out at runtime.
- **Field Injection (@Autowired on fields)**: The "Old Way". It is concise but harmful. It hides dependencies, makes testing hard (you have to use reflection to inject mocks), and allows circular dependencies to go unnoticed until runtime.

### 3. Circular Dependencies
A circular dependency happens when Bean A needs Bean B, but Bean B needs Bean A.
- With **Constructor Injection**, Spring will throw a \`BeanCurrentlyInCreationException\` at startup, failing fast. This is good! It tells you your design is flawed.
- With **Field Injection**, Spring might solve this via proxies, but it leaves you with a spaghetti design.`,
        codeSnippet: `// ❌ BAD: Field Injection
// - Can't be immutable (final)
// - Hard to unit test (need reflection)
// - Hides complexity
@Service
public class BadService {
    @Autowired
    private UserRepository userRepo;
}

// ✅ GOOD: Constructor Injection
// - Dependencies are clear
// - Immutable state
// - Trivial to unit test
@Service
public class GoodService {
    
    private final UserRepository userRepo;
    private final EmailService emailService;

    // @Autowired is optional in Spring 4.3+ if there's one constructor
    public GoodService(UserRepository userRepo, EmailService emailService) {
        this.userRepo = userRepo;
        this.emailService = emailService;
    }
}`,
        architectureHighlight: 'service',
        dependencies: [
          { groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter', description: 'Core Spring Boot starter, including auto-configuration support, logging and YAML.' }
        ],
        mockApi: {
          endpoint: '/api/v1/health',
          method: 'GET',
          responseBody: `{
  "status": "UP",
  "components": {
    "db": { "status": "UP", "details": { "database": "PostgreSQL", "validationQuery": "isValid()" } },
    "diskSpace": { "status": "UP", "details": { "total": 536870912000, "free": 412345678901, "threshold": 10485760 } }
  }
}`,
          status: 200,
          description: 'Check the health status of the Spring Boot application and its components.'
        }
      },
      {
        id: 'beans',
        title: 'Beans & Scopes',
        description: 'Understanding Singleton internals, Prototype use cases, and Web Scopes.',
        content: `### 1. What is a Bean?
A Bean is simply an object that is instantiated, assembled, and managed by a Spring IoC container. They are the backbone of your application.

### 2. Singleton Scope (The Default)
When you define a bean, Spring creates **one single instance** per container. Every request to \`userService\` returns the exact same object reference.
- **Concurrency**: Because the instance is shared, it must be **stateless**. Do not store user data (like "current user" or "shopping cart items") in fields of a Singleton bean.
- **Performance**: High, as creation happens only once at startup.

### 3. Prototype Scope
Spring creates a **new instance** every time the bean is requested.
- Use this for stateful objects that are not shared between threads.
- **Note**: Spring does *not* manage the complete lifecycle of a prototype bean. It creates it, but typically doesn't destroy it. You are responsible for cleanup.

### 4. Web Scopes
In a web application, you often need data tied to a specific interaction:
- **Request Scope**: One instance per HTTP request. Useful for logging context.
- **Session Scope**: One instance per HTTP User Session. Useful for Shopping Carts or User Profiles.`,
        codeSnippet: `// SCENARIO 1: Singleton (Default)
// Shared by all threads. MUST be stateless.
@Service 
public class PaymentService {
    public void process(Order order) { ... }
}

// SCENARIO 2: Prototype
// New instance every time it is injected.
@Component
@Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
public class ReportGenerator {
    private List<String> temporaryLogs = new ArrayList<>();
    // Safe to use fields here
}

// SCENARIO 3: Session Scope
// Tied to a user's browser session.
// ScopedProxyMode is needed because we are likely injecting 
// this short-lived bean into a long-lived Singleton Controller.
@Component
@SessionScope(proxyMode = ScopedProxyMode.TARGET_CLASS)
public class UserCart {
    private List<Item> items = new ArrayList<>();
}`,
        architectureHighlight: 'none'
      },
      {
        id: 'lifecycle',
        title: 'Bean Lifecycle',
        description: 'Mastering the order of execution: Construction, Setting Properties, and Initialization.',
        content: `### 1. The Startup Order
It is crucial to understand that a constructor is not enough. When the constructor runs, the dependencies are injected, but configuration properties (like \`@Value\`) might not be fully processed, and AOP proxies aren't applied yet.

**The Flow:**
1. **Instantiation**: Java Constructor runs.
2. **Populate Properties**: Dependency Injection happens.
3. **Pre-Initialization**: \`BeanPostProcessor.postProcessBeforeInitialization\` runs.
4. **AfterPropertiesSet**: \`@PostConstruct\` runs.
5. **Post-Initialization**: AOP Proxies are created here.

### 2. @PostConstruct
This is the standard place to run initialization logic. For example, if you need to load data from a database into a cache map, do it here. You cannot do it in the constructor because the JPA Repository might not be injected yet.

### 3. @PreDestroy
Runs when the \`ApplicationContext\` is closing. Use this to close open files, stop background threads, or flush buffers to disk.`,
        codeSnippet: `@Component
public class DatabaseConnectionPool {

    // 1. Constructor runs first
    public DatabaseConnectionPool() {
        System.out.println("1. Object Created");
    }

    // 2. Dependencies injected
    @Autowired
    public void setConfig(DbConfig config) {
        System.out.println("2. Dependencies Injected");
    }

    // 3. Initialization logic
    @PostConstruct
    public void init() {
        System.out.println("3. Pool warmed up. Ready for requests.");
    }

    // 4. Shutdown logic
    @PreDestroy
    public void cleanup() {
        System.out.println("4. Connections closed.");
    }
}`,
        architectureHighlight: 'service',
        showLifecycleVisualizer: true
      }
    ]
  },
  {
    id: 'advanced-core',
    title: 'Advanced Core',
    icon: 'Layers',
    lessons: [
      {
        id: 'aop',
        title: 'Aspect Oriented Programming',
        description: 'How Spring uses Proxies to handle Cross-Cutting Concerns like Logging and Security.',
        content: `### 1. The Proxy Pattern
Have you ever wondered how \`@Transactional\` works? You write a plain method, but somehow a database transaction opens and closes automatically.

Spring does this via **AOP Proxies**. When you ask Spring for your \`UserService\`, it doesn't give you the actual object. It gives you a **Proxy** (a wrapper) that points to your object.
1. The Proxy intercepts the call.
2. It opens the transaction.
3. It calls your actual method.
4. It commits the transaction.

### 2. Key Terminology
- **Aspect**: The "Concern" (e.g., Logging).
- **Advice**: The logic (e.g., "Print to console").
- **Pointcut**: The expression defining *where* to apply the advice (e.g., "All methods in Service package").

### 3. The "Self-Invocation" Pitfall
Because AOP works via proxies, if a method in your class calls *another* method in the *same* class, the call uses \`this.method()\`. It **bypasses** the proxy. The second method's \`@Transactional\` annotation will be ignored!`,
        codeSnippet: `@Aspect
@Component
public class PerformanceAspect {

    // Define where this applies: Any method in 'service' package
    @Around("execution(* com.app.service..*(..))")
    public Object measureTime(ProceedingJoinPoint joinPoint) throws Throwable {
        long start = System.currentTimeMillis();
        
        // Continue to the actual method
        Object result = joinPoint.proceed();
        
        long end = System.currentTimeMillis();
        System.out.println(joinPoint.getSignature() + " took " + (end - start) + "ms");
        
        return result;
    }
}

// PITFALL EXAMPLE
@Service
public class UserService {
    public void importUsers() {
        // ❌ This bypasses the proxy! Transaction will NOT work.
        this.saveUser(new User()); 
    }

    @Transactional
    public void saveUser(User u) { ... }
}`,
        architectureHighlight: 'service',
        dependencies: [
          { groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-aop', description: 'Starter for using Spring AOP and AspectJ.' }
        ]
      },
      {
        id: 'events',
        title: 'Spring Events',
        description: 'Decoupling architecture using the Observer Pattern. Synchronous vs Async events.',
        content: `### 1. Why Events?
In a monolithic application, services often become tightly coupled. \`UserService\` shouldn't need to know about \`EmailService\`, \`AnalyticsService\`, and \`AuditService\`.
Instead, \`UserService\` should just say: *"A User was created"*. The other services can listen and react.

### 2. Synchronous Events (Default)
By default, \`ApplicationEventPublisher\` is synchronous. The listener runs in the **same thread** and **same transaction** as the publisher.
- **Pro**: Consistency. If the listener fails, the main transaction can rollback.
- **Con**: Latency. The user has to wait for the email to be sent before the HTTP request completes.

### 3. Asynchronous Events
By annotating the listener with \`@Async\`, it runs in a separate thread.
- **Pro**: Fast response to the user.
- **Con**: Error handling is harder. If the email fails, the user is already created.

### 4. Transactional Events
Use \`@TransactionalEventListener\`. This creates a listener that only runs *after* the database transaction successfully commits. This prevents sending an email for a user that was rolled back due to a database error.`,
        codeSnippet: `// 1. The Event (Java Record)
public record UserCreatedEvent(String email, Long userId) {}

// 2. The Publisher
@Service
public class UserService {
    @Autowired ApplicationEventPublisher publisher;

    @Transactional
    public void register(String email) {
        User user = repo.save(new User(email));
        // Publish event
        publisher.publishEvent(new UserCreatedEvent(email, user.getId()));
    }
}

// 3. The Listeners
@Component
public class UserEventListeners {

    // Scenario A: Critical Logic (Runs in same transaction)
    @EventListener
    public void createAuditLog(UserCreatedEvent event) {
        auditRepo.save(new AuditLog(event.userId()));
    }

    // Scenario B: Side Effects (Runs only if Tx commits)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async // Run in background thread
    public void sendWelcomeEmail(UserCreatedEvent event) {
        emailService.send(event.email());
    }
}`,
        architectureHighlight: 'event-bus'
      },
      {
        id: 'scheduling',
        title: 'Async & Scheduling',
        description: 'Managing background tasks, thread pools, and distributed locking.',
        content: `### 1. Asynchronous Processing
Annotating a method with \`@Async\` tells Spring to execute it in a separate thread.
**Crucial**: By default, Spring uses a \`SimpleAsyncTaskExecutor\`, which creates a *new thread for every task*. In production, this can kill your server. You **must** configure a custom \`ThreadPoolTaskExecutor\` to limit the number of threads.

### 2. Scheduled Tasks
\`@Scheduled\` allows you to run tasks periodically.
- **fixedRate**: Runs every X ms, measured from start time. (Tasks can overlap).
- **fixedDelay**: Runs X ms *after* the previous task finishes. (No overlap).
- **cron**: Complex Unix-style scheduling (e.g., "Every weekday at 9am").

### 3. Distributed Scheduling
In a cluster (multiple instances of your app), \`@Scheduled\` runs on *every* node. You often only want *one* node to run the job. You need a library like **ShedLock** to ensure only one node acquires the lock in the database.`,
        codeSnippet: `@Configuration
@EnableScheduling
@EnableAsync
public class AsyncConfig {
    
    // Always define a custom pool!
    @Bean
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("MyAsync-");
        executor.initialize();
        return executor;
    }
}

@Service
public class ReportingService {

    // Runs every 10 minutes, ensuring previous run finished
    @Scheduled(fixedDelay = 600000)
    public void syncData() {
        // ...
    }

    // Async method using the custom executor
    @Async("taskExecutor")
    public CompletableFuture<String> generateReport() {
        // Heavy calculation
        return CompletableFuture.completedFuture("Done");
    }
}`,
        architectureHighlight: 'service'
      }
    ]
  },
  {
    id: 'maven',
    title: 'Maven Mastery',
    icon: 'Package',
    lessons: [
      {
        id: 'maven-pom',
        title: 'POM & Coordinates',
        description: 'Understanding Project Object Model, GAV coordinates, and Snapshots.',
        content: `### 1. What is Maven?
Maven is a build automation and dependency management tool. It uses a **Project Object Model (POM)** file, \`pom.xml\`, to describe the project structure, dependencies, and build process.

### 2. GAV Coordinates
Every artifact in the Maven ecosystem is uniquely identified by three coordinates:
- **GroupId**: usually a reversed domain name (e.g., \`com.example\`).
- **ArtifactId**: the name of the project (e.g., \`my-app\`).
- **Version**: the specific release (e.g., \`1.0.0\`).

### 3. Snapshot vs Release
- **1.0.0-SNAPSHOT**: A work in progress. Maven checks for updates periodically. Used during active development.
- **1.0.0**: A stable release. Immutable. Once deployed to a repo, it should never change.`,
        codeSnippet: `<project>
    <modelVersion>4.0.0</modelVersion>
    
    <!-- The Coordinates -->
    <groupId>com.learn.spring</groupId>
    <artifactId>spring-masterclass</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    
    <properties>
        <java.version>17</java.version>
    </properties>
</project>`,
        architectureHighlight: 'none'
      },
      {
        id: 'maven-deps',
        title: 'Dependencies & Scopes',
        description: 'Managing libraries, transitive dependencies, and exclusion.',
        content: `### 1. Dependency Scopes
Not all jars are needed at all times.
- **compile** (Default): Available everywhere (compilation, testing, running).
- **test**: Only for tests (e.g., JUnit, Mockito). Not included in the final JAR.
- **provided**: Needed for compilation but provided by the runtime (e.g., Lombok, Servlet API).
- **runtime**: Not needed for compilation, but needed to run (e.g., MySQL Driver implementation).

### 2. Transitive Dependencies
If you depend on \`Spring Web\`, and \`Spring Web\` depends on \`Jackson\`, Maven automatically downloads \`Jackson\` for you. This is the "Dependency Tree".

### 3. Exclusion
Sometimes a transitive dependency conflicts with another library. You can explicitly exclude it.`,
        codeSnippet: `<dependencies>
    <!-- 1. Standard Compile Scope -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- 2. Test Scope (Not in final JAR) -->
    <dependency>
        <groupId>org.junit.jupiter</groupId>
        <artifactId>junit-jupiter</artifactId>
        <scope>test</scope>
    </dependency>

    <!-- 3. Provided Scope -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <scope>provided</scope>
    </dependency>
</dependencies>`,
        architectureHighlight: 'none'
      },
      {
        id: 'maven-lifecycle',
        title: 'Build Lifecycle',
        description: 'Clean, Compile, Package, Install, and Deploy.',
        content: `### 1. The Standard Lifecycle
Maven has a rigid lifecycle. Running a later phase automatically runs all previous ones.
1. **validate**: Check if project is correct.
2. **compile**: Compile source code.
3. **test**: Run unit tests (can be skipped with \`-DskipTests\`).
4. **package**: bundle code into JAR/WAR.
5. **verify**: Integration tests.
6. **install**: Save JAR to local repository (\`~/.m2/repository\`).
7. **deploy**: Upload JAR to remote Nexus/Artifactory.

### 2. Plugins
Maven itself does nothing. All work is done by plugins.
- \`maven-compiler-plugin\`: Compiles Java.
- \`maven-surefire-plugin\`: Runs tests.
- \`maven-jar-plugin\`: Builds JARs.`,
        codeSnippet: `<build>
    <plugins>
        <!-- Standard Compiler Plugin -->
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-compiler-plugin</artifactId>
            <version>3.11.0</version>
            <configuration>
                <source>17</source>
                <target>17</target>
            </configuration>
        </plugin>
    </plugins>
</build>`,
        architectureHighlight: 'none'
      },
      {
        id: 'maven-multimodule',
        title: 'Multi-Module Projects',
        description: 'Managing large monoliths with Parent POMs and Modules.',
        content: `### 1. The Parent POM
A parent POM defines common settings (versions, plugins) for children to inherit. This reduces duplication.

### 2. Dependency Management
**Crucial Concept**: In the parent, use \`<dependencyManagement>\`. This defines *versions* but doesn't actually add the dependency.
Child modules then add the dependency *without* the version. This ensures all modules use the exact same version of libraries.

### 3. Aggregation
The root POM contains a \`<modules>\` section. Building the root builds all modules in the correct order.`,
        codeSnippet: `<!-- PARENT POM -->
<packaging>pom</packaging>
<modules>
    <module>api-service</module>
    <module>inventory-service</module>
</modules>

<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>2023.0.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>`,
        architectureHighlight: 'none'
      },
      {
        id: 'maven-spring',
        title: 'Spring Boot Plugin',
        description: 'Repackaging and running Spring Boot apps.',
        content: `### 1. The Executable JAR
A standard JAR contains only your classes. It cannot run by itself if it has dependencies.
The \`spring-boot-maven-plugin\` performs **repackaging**:
1. It copies all dependency JARs into \`BOOT-INF/lib\`.
2. It adds a special ClassLoader to read them.
3. It sets the Main-Class to Spring's launcher.

### 2. Goals
- \`spring-boot:run\`: Starts the app directly from source.
- \`spring-boot:repackage\`: Creates the executable JAR (runs automatically during package phase).
- \`spring-boot:build-image\`: Creates a Docker image using Cloud Native Buildpacks.`,
        codeSnippet: `<build>
    <plugins>
        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
            <configuration>
                <excludes>
                    <exclude>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok</artifactId>
                    </exclude>
                </excludes>
            </configuration>
        </plugin>
    </plugins>
</build>`,
        architectureHighlight: 'none'
      }
    ]
  },
  {
    id: 'microservices',
    title: 'Microservices & Cloud',
    icon: 'Cloud',
    lessons: [
      {
        id: 'gateway',
        title: 'Spring Cloud Gateway',
        description: 'Routing, Filtering, and the API Gateway pattern.',
        content: `### 1. The Gateway Pattern
In a microservices world, the frontend should not know about 50 different microservices. It should talk to one entry point: the **Gateway**.
The Gateway handles:
- **Routing**: Forwarding \`/users\` to the User Service and \`/orders\` to the Order Service.
- **Cross-cutting concerns**: Authentication, Rate Limiting, SSL termination, and Logging.

### 2. Predicates and Filters
Spring Cloud Gateway uses reactive programming (WebFlux).
- **Predicates**: Match the request (e.g., "Path is /api/**" or "Header X-Mobile exists").
- **Filters**: Modify the request/response (e.g., "Add Auth Header", "Strip Prefix", "Retry").`,
        codeSnippet: `@Bean
public RouteLocator routes(RouteLocatorBuilder builder) {
    return builder.routes()
        // Route 1: User Service
        .route("user_route", r -> r.path("/api/users/**")
            .filters(f -> f
                .rewritePath("/api/users/(?<segment>.*)", "/users/$\{segment}") // Strip /api
                .addResponseHeader("X-Powered-By", "Spring Gateway")
                .circuitBreaker(c -> c.setName("userBreaker").setFallbackUri("forward:/fallback"))
            )
            .uri("lb://user-service")) // Load Balanced (Eureka/K8s)
            
        // Route 2: Legacy System
        .route("legacy_route", r -> r.path("/old/**")
            .uri("http://legacy-server.com"))
        .build();
}`,
        architectureHighlight: 'gateway',
        dependencies: [
          { groupId: 'org.springframework.cloud', artifactId: 'spring-cloud-starter-gateway', description: 'Starter for using Spring Cloud Gateway.' },
          { groupId: 'org.springframework.cloud', artifactId: 'spring-cloud-starter-circuitbreaker-resilience4j', description: 'Starter for using Resilience4j with Spring Cloud Circuit Breaker.' }
        ],
        mockApi: {
          endpoint: '/api/users/123',
          method: 'GET',
          responseBody: `{
  "id": 123,
  "username": "spring_master",
  "email": "master@spring.io",
  "roles": ["STUDENT", "DEVELOPER"],
  "metadata": {
    "routedBy": "SpringCloudGateway",
    "circuitBreaker": "CLOSED"
  }
}`,
          status: 200,
          description: 'Simulate a request through the API Gateway to the User Microservice.'
        },
        showTopologyVisualizer: true
      },
      {
        id: 'resilience',
        title: 'Resilience (Circuit Breaker)',
        description: 'Stopping cascading failures with Resilience4j.',
        content: `### 1. The Problem
Microservice A calls Microservice B. If B goes down or becomes slow, A's threads will hang waiting for B. Eventually, A runs out of threads and crashes. This chain reaction can take down the whole platform.

### 2. The Circuit Breaker Pattern
It works like an electrical circuit breaker.
- **Closed (Normal)**: Requests go through. We count errors.
- **Open (Tripped)**: Too many errors occurred. We *immediately* fail incoming requests without calling B. This gives B time to recover.
- **Half-Open**: We let a few requests through to test if B is back online.

### 3. Fallbacks
When the circuit is open, or a call fails, we execute a **Fallback** method. This allows us to return default data (e.g., "Pricing currently unavailable") instead of an error page.`,
        codeSnippet: `@Service
public class CatalogService {

    private final RestClient restClient;

    // Monitor 'inventory' circuit.
    // If it fails, call 'getLocalInventory'.
    @CircuitBreaker(name = "inventory", fallbackMethod = "getLocalInventory")
    @Retry(name = "inventory") // Retry 3 times before failing
    @RateLimiter(name = "inventory") // Limit calls per second
    public Inventory getInventory(String id) {
        return restClient.get()
            .uri("/inventory/" + id)
            .retrieve()
            .body(Inventory.class);
    }

    // Fallback must have same signature + Exception param
    public Inventory getLocalInventory(String id, Throwable t) {
        log.warn("Inventory service down, returning cached data");
        return new Inventory(id, 0); // Default to 0 stock
    }
}`,
        architectureHighlight: 'service',
        dependencies: [
          { groupId: 'io.github.resilience4j', artifactId: 'resilience4j-spring-boot3', description: 'Resilience4j starter for Spring Boot 3.' },
          { groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-actuator', description: 'Starter for using Spring Boot Actuator (required for monitoring resilience).' }
        ],
        mockApi: {
          endpoint: '/api/inventory/item-456',
          method: 'GET',
          responseBody: `{
  "itemId": "item-456",
  "stock": 0,
  "status": "FALLBACK_MODE",
  "message": "Inventory service is currently unavailable. Returning cached fallback data."
}`,
          status: 200,
          description: 'Simulate a service failure where Resilience4j triggers the fallback method.'
        }
      },
      {
        id: 'tracing',
        title: 'Distributed Tracing',
        description: 'Visualizing requests across microservices using Micrometer & Zipkin.',
        content: `### 1. The Observability Challenge
A user clicks "Buy". The request hits the Gateway -> Order Service -> Inventory Service -> Payment Service.
If the request takes 5 seconds, which service is slow? Logs on individual servers won't tell you the full story.

### 2. Trace ID & Span ID
**Micrometer Tracing** (formerly Spring Cloud Sleuth) automatically injects headers into HTTP and Message calls.
- **Trace ID**: A unique ID for the entire journey (e.g., the user click).
- **Span ID**: A unique ID for a specific step (e.g., Order Service processing).

### 3. Log Correlation
Spring Boot automatically adds these IDs to your console logs (via MDC).
\`INFO [order-service, trace-123, span-456] : Processing order...\`
You can then export these traces to visualization tools like **Zipkin**, **Jaeger**, or **Grafana Tempo** to see a waterfall graph of your request.`,
        codeSnippet: `// build.gradle / pom.xml dependencies:
// 1. Micrometer Tracing Bridge (Brave or OpenTelemetry)
// 2. Zipkin Reporter (to send traces)

// application.yml
management:
  tracing:
    sampling:
      probability: 1.0 # Sample 100% of requests (Dev only)
  zipkin:
    tracing:
      endpoint: "http://localhost:9411/api/v2/spans"

// Java usage:
// Usually automatic, but you can create custom spans
@Service
public class CustomTraceService {
    @Autowired Tracer tracer;

    public void heavyWork() {
        Span span = tracer.nextSpan().name("heavy-calculation").start();
        try (Tracer.SpanInScope ws = tracer.withSpan(span)) {
             // Do work...
        } finally {
             span.end();
        }
    }
}`,
        architectureHighlight: 'none',
        dependencies: [
          { groupId: 'io.micrometer', artifactId: 'micrometer-tracing-bridge-brave', description: 'Micrometer Tracing bridge to Brave.' },
          { groupId: 'io.zipkin.reporter2', artifactId: 'zipkin-reporter-brave', description: 'Zipkin reporter for Brave.' }
        ]
      }
    ]
  },
  {
    id: 'messaging',
    title: 'Messaging & Async',
    icon: 'MessageSquare',
    lessons: [
      {
        id: 'rabbitmq',
        title: 'RabbitMQ (Spring AMQP)',
        description: 'Exchanges, Queues, Routing Keys, and Dead Letter Handling.',
        content: `### 1. Concepts
- **Producer**: Sends a message.
- **Exchange**: The "Post Office". It receives messages and decides where to send them based on routing keys.
- **Queue**: The mailbox. Messages sit here until consumed.
- **Consumer**: Reads from the queue.

### 2. Exchange Types
- **Direct**: Exact match of routing key.
- **Fanout**: Broadcast to all queues (Pub/Sub).
- **Topic**: Pattern matching (e.g., \`orders.*\`).

### 3. Reliability (DLQ)
What if a consumer throws an exception? If you just catch and log it, the message is lost.
Spring AMQP supports **Dead Letter Queues (DLQ)**. If a message fails processing X times, it is automatically moved to a \`.dlq\` queue, where it can be inspected manually or replayed later.`,
        codeSnippet: `// 1. Consumer
@Component
public class OrderConsumer {

    // Automatic JSON deserialization
    @RabbitListener(queues = "orders.queue")
    public void receive(OrderDTO order) {
        log.info("Processing order: " + order.id());
        if (order.amount() < 0) {
            throw new InvalidOrderException(); // Will go to DLQ if configured
        }
    }
}

// 2. Configuration (Declarative)
@Configuration
public class RabbitConfig {
    @Bean
    public Queue orderQueue() {
        return QueueBuilder.durable("orders.queue")
            .withArgument("x-dead-letter-exchange", "orders.dlx") // Setup DLQ
            .build();
    }
    
    @Bean
    public Jackson2JsonMessageConverter converter() {
        return new Jackson2JsonMessageConverter();
    }
}`,
        architectureHighlight: 'broker',
        dependencies: [
          { groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-amqp', description: 'Starter for using Spring AMQP and RabbitMQ.' }
        ]
      },
      {
        id: 'kafka',
        title: 'Apache Kafka',
        description: 'Event Streaming, Partitions, Consumer Groups, and Avro.',
        content: `### 1. Kafka vs RabbitMQ
RabbitMQ is a "smart broker, dumb consumer". It manages queue state.
Kafka is a "dumb broker, smart consumer". It is a distributed commit log. Messages are not removed when read; they are just appended. Consumers track their own "offset" (position).

### 2. Consumer Groups
This is how Kafka scales. If you have a topic with 10 partitions, you can spin up 10 instances of your application (Consumer Group). Kafka will automatically assign 1 partition to each instance, allowing parallel processing.

### 3. Serialization
In production, sending JSON strings is inefficient and fragile. We typically use **Avro** with a **Schema Registry**. This enforces a schema (contract) so producers can't send bad data that breaks consumers.`,
        codeSnippet: `// 1. Producer
@Service
public class KafkaProducer {
    @Autowired KafkaTemplate<String, Object> template;

    public void sendEvent(UserClickedEvent event) {
        // Send to topic 'clicks', partition by 'userId'
        // Partitioning ensures all events for one user go to the same shard
        template.send("clicks", event.getUserId(), event);
    }
}

// 2. Consumer
@Component
public class KafkaConsumer {

    @KafkaListener(
        topics = "clicks", 
        groupId = "analytics-service", // Consumer Group
        concurrency = "3" // Threads per instance
    )
    public void listen(ConsumerRecord<String, UserClickedEvent> record) {
        log.info("Offset: " + record.offset());
        log.info("Value: " + record.value());
    }
}`,
        architectureHighlight: 'broker',
        dependencies: [
          { groupId: 'org.springframework.kafka', artifactId: 'spring-kafka', description: 'Starter for using Apache Kafka with Spring.' }
        ]
      },
      {
        id: 'websockets',
        title: 'WebSockets (STOMP)',
        description: 'Real-time bidirectional communication with STOMP and SockJS.',
        content: `### 1. Beyond HTTP
HTTP is stateless and request-response. For a chat app or live stock ticker, you need a persistent connection.
**WebSockets** provide a full-duplex TCP channel over a single HTTP connection.

### 2. STOMP (Simple Text Oriented Messaging Protocol)
Raw WebSockets are just a stream of bytes. Spring uses STOMP to define a structure (like HTTP verbs for sockets).
- **SUBSCRIBE**: Client wants to listen to a topic.
- **SEND**: Client sends a message to the server.

### 3. The Message Broker
Spring has a simple in-memory broker, or it can relay messages to an external broker (RabbitMQ/ActiveMQ) for clustering support.`,
        codeSnippet: `@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic"); // Outbound prefixes
        config.setApplicationDestinationPrefixes("/app"); // Inbound prefixes
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").withSockJS(); // Fallback for old browsers
    }
}

@Controller
public class ChatController {
    
    // Client sends to /app/chat
    @MessageMapping("/chat")
    // Server broadcasts to all subscribers of /topic/messages
    @SendTo("/topic/messages")
    public ChatMessage send(ChatMessage message) {
        return new ChatMessage("Server", "Hello " + message.getFrom());
    }
}`,
        architectureHighlight: 'gateway',
        dependencies: [
          { groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-websocket', description: 'Starter for building WebSocket applications with Spring.' }
        ]
      }
    ]
  },
  {
    id: 'config',
    title: 'Configuration',
    icon: 'Settings',
    lessons: [
      {
        id: 'config-props',
        title: 'Type-Safe Configuration',
        description: 'Why @ConfigurationProperties is superior to @Value.',
        content: `### 1. The @Value Problem
Using \`@Value("\${property}")\` is common but problematic:
- String-based keys are prone to typos.
- No type validation (is the timeout negative?).
- Scattered across the codebase.

### 2. The Solution: @ConfigurationProperties
This binds a hierarchy of properties to a Java object.
- **Type Safety**: Automatic conversion to Lists, Maps, Durations, and Data Sizes.
- **Validation**: Supports JSR-303 (\`@NotNull\`, \`@Min\`).
- **Metadata**: Generates JSON metadata so IDEs (IntelliJ/VS Code) give autocomplete in \`application.properties\`.

### 3. Java Records
Spring Boot 2.6+ supports binding to Java Records, creating immutable configuration objects.`,
        codeSnippet: `// application.yml
// app:
//   feature:
//     enabled: true
//     max-retries: 5
//     api-key: secret

// 1. Define the properties object
@ConfigurationProperties(prefix = "app.feature")
@Validated // Enable validation
public record FeatureConfig(
    boolean enabled,
    
    @Min(1) @Max(10)
    int maxRetries,
    
    @NotBlank
    String apiKey
) {}

// 2. Enable it (or scan for it)
@Configuration
@EnableConfigurationProperties(FeatureConfig.class)
public class AppConfig {}

// 3. Inject it
@Service
public class FeatureService {
    private final FeatureConfig config;
    
    public FeatureService(FeatureConfig config) {
        this.config = config;
    }
}`,
        architectureHighlight: 'none'
      },
      {
        id: 'profiles',
        title: 'Profiles & Environments',
        description: 'Managing configuration across Local, Dev, and Prod environments.',
        content: `### 1. Multi-Environment Config
You rarely run the same config in Dev and Prod.
- **Dev**: H2 Database, Debug Logging, Mock Payment Gateway.
- **Prod**: PostgreSQL, Info Logging, Real Stripe Gateway.

### 2. Profile Specific Files
Spring loads \`application.properties\` first, then overrides it with \`application-{profile}.properties\`.
Example: \`application-prod.properties\` overrides default values.

### 3. Conditional Beans
Use \`@Profile\` to control bean creation.
- \`@Profile("dev")\`: Only in dev.
- \`@Profile("!prod")\`: In any profile EXCEPT prod.
- \`@Profile("cloud & postgres")\`: Boolean logic supported.`,
        codeSnippet: `// Interface defines the contract
public interface StorageService {
    void uploadFile(File f);
}

// Implementation A: Local Filesystem (Dev)
@Service
@Profile("dev")
public class LocalStorageService implements StorageService {
    public void uploadFile(File f) {
        System.out.println("Writing to C:/temp/...");
    }
}

// Implementation B: S3 Bucket (Prod)
@Service
@Profile("prod")
public class S3StorageService implements StorageService {
    public void uploadFile(File f) {
        System.out.println("Uploading to AWS S3...");
    }
}`,
        architectureHighlight: 'none'
      }
    ]
  },
  {
    id: 'web',
    title: 'RESTful Web Services',
    icon: 'Globe',
    lessons: [
      {
        id: 'rest-controller',
        title: 'REST Controllers',
        description: 'Building proper REST APIs: Verbs, Status Codes, and DTOs.',
        content: `### 1. HTTP Verbs Matter
Don't just use \`@PostMapping\` for everything.
- **GET**: Idempotent, Safe. Retrieve data.
- **POST**: Not Idempotent. Create new resource.
- **PUT**: Idempotent. Replace entire resource.
- **PATCH**: Not Idempotent. Partial update.
- **DELETE**: Idempotent. Remove resource.

### 2. DTOs (Data Transfer Objects)
**NEVER** expose your Database Entities (@Entity) directly in the API.
- **Security Risk**: You might accidentally expose password hashes.
- **Coupling**: Changing your DB schema breaks the API clients.
Always map Entity -> DTO before returning.

### 3. Status Codes
Return the correct code, not just 200 OK for everything.
- 201 Created (after POST)
- 204 No Content (after DELETE)
- 400 Bad Request (Validation fail)
- 404 Not Found`,
        codeSnippet: `// The Contract (DTO)
public record UserDTO(String username, String email) {}

@RestController
@RequestMapping("/api/users")
public class UserController {

    // ✅ Good: Returns DTO, correct status
    @PostMapping
    public ResponseEntity<UserDTO> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserDTO created = service.create(request);
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(created);
    }

    // ❌ Bad: Returns Entity, exposes internals
    @GetMapping("/{id}")
    public UserEntity getUser(@PathVariable Long id) {
        return repo.findById(id).get(); 
    }
}`,
        architectureHighlight: 'controller',
        mockApi: {
          endpoint: '/api/users',
          method: 'POST',
          requestBody: `{ "username": "new_user", "email": "user@example.com" }`,
          responseBody: `{
  "username": "new_user",
  "email": "user@example.com",
  "createdAt": "2024-03-01T12:00:00Z",
  "status": "ACTIVE"
}`,
          status: 201,
          description: 'Create a new user and receive a 201 Created status with the DTO response.'
        }
      },
      {
        id: 'exceptions',
        title: 'Global Exception Handling',
        description: 'Using @ControllerAdvice and RFC 7807 Problem Details.',
        content: `### 1. The Try-Catch Nightmare
Do not write try-catch blocks in every controller method. It makes code unreadable and error handling inconsistent.

### 2. ControllerAdvice
This is an AOP interceptor for Controllers. It catches exceptions thrown anywhere in the controller layer and transforms them into proper HTTP responses.

### 3. Problem Details (RFC 7807)
Spring Boot 3 natively supports this standard. Instead of inventing your own error JSON format \`{ "err": "msg" }\`, use the standard \`ProblemDetail\` which provides fields for type, title, status, detail, and instance.`,
        codeSnippet: `@RestControllerAdvice
public class GlobalErrorHandler extends ResponseEntityExceptionHandler {

    // Handle custom exception
    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleNotFound(ResourceNotFoundException e) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND, 
            e.getMessage()
        );
        problem.setTitle("Resource Missing");
        problem.setType(URI.create("https://api.my.com/errors/not-found"));
        return problem;
    }

    // Handle generic unchecked exceptions
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleAll(Exception e) {
        return ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR, 
            "An unexpected error occurred."
        );
    }
}`,
        architectureHighlight: 'controller',
        mockApi: {
          endpoint: '/api/users/999',
          method: 'GET',
          responseBody: `{
  "type": "https://api.my.com/errors/not-found",
  "title": "Resource Missing",
  "status": 404,
  "detail": "Resource with the specified ID was not found in our system.",
  "instance": "/api/users/999"
}`,
          status: 404,
          description: 'Simulate a 404 error handled by the Global Exception Handler using RFC 7807 Problem Details.'
        }
      },
      {
        id: 'openapi',
        title: 'OpenAPI (Swagger)',
        description: 'Documentation as Code using SpringDoc.',
        content: `### 1. Documentation is Critical
An API is useless if no one knows how to use it. Keeping a separate Word doc or Wiki updated is impossible.
**OpenAPI (Swagger)** is a standard specification for describing REST APIs.

### 2. SpringDoc
The \`springdoc-openapi-starter-webmvc-ui\` dependency automatically scans your application at startup.
- It finds all \`@RestController\` classes.
- It analyzes request/response bodies and types.
- It generates a JSON definition at \`/v3/api-docs\`.
- It serves a UI at \`/swagger-ui.html\`.

### 3. Enhancing Docs
You can add descriptions, example values, and error codes using annotations like \`@Operation\` and \`@Schema\`.`,
        codeSnippet: `public record LoginRequest(
    @Schema(description = "User email", example = "john@doe.com")
    String email,
    @Schema(description = "Password", example = "secret123")
    String password
) {}

@RestController
public class AuthController {

    @Operation(summary = "Login User", description = "Returns a JWT token")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Success"),
        @ApiResponse(responseCode = "401", description = "Invalid credentials")
    })
    @PostMapping("/login")
    public Token login(@RequestBody LoginRequest req) {
        // ...
    }
}`,
        architectureHighlight: 'controller'
      },
      {
        id: 'graphql',
        title: 'Spring for GraphQL',
        description: 'Flexible queries, Schema Mapping, and avoiding the N+1 problem.',
        content: `### 1. REST vs GraphQL
In REST, you might have to call \`/users/1\`, then \`/users/1/posts\`, then \`/posts/5/comments\`. This is "Under-fetching" (too many requests).
Or you call \`/users/1\` and get back a huge JSON with fields you don't need ("Over-fetching").
**GraphQL** lets the client ask for exactly what it needs in a single request.

### 2. Spring Integration
Spring Boot 2.7+ introduced official support. You define a schema file (\`.graphqls\`) and map controller methods to fields.

### 3. The N+1 Problem
If you fetch 10 books, and for each book you invoke a separate SQL query to fetch the Author, you run 1 + 10 = 11 queries.
In GraphQL, this is solved with **BatchLoader** (or \`@BatchMapping\` in Spring). It collects all the Author IDs and fetches them in one single query.`,
        codeSnippet: `// schema.graphqls
// type Query {
//   bookById(id: ID): Book
// }
// type Book {
//   id: ID
//   title: String
//   author: Author
// }

@Controller
public class BookController {

    // Maps to top-level Query 'bookById'
    @QueryMapping
    public Book bookById(@Argument String id) {
        return bookRepo.findById(id);
    }

    // Maps to the 'author' field of the 'Book' type.
    // Solves N+1 by batching lookups for multiple books.
    @BatchMapping
    public Map<Book, Author> author(List<Book> books) {
        return authorService.getAuthorsForBooks(books);
    }
}`,
        architectureHighlight: 'graphql'
      }
    ]
  },
  {
    id: 'data',
    title: 'Data Access',
    icon: 'Database',
    lessons: [
      {
        id: 'jpa-repo',
        title: 'JPA Repositories',
        description: 'Derived Queries, JPQL, and Pagination.',
        content: `### 1. Spring Data Magic
You write an interface extending \`JpaRepository\`, and Spring generates the implementation bytecode at runtime.

### 2. Derived Queries
Spring parses the method name to generate SQL.
- \`findByEmail(String email)\` -> \`SELECT ... WHERE email = ?\`
- \`countByActiveTrue()\`
- \`deleteByLastLoginBefore(Date date)\`

### 3. @Query (JPQL & Native)
For complex joins or reports, method names get too long. Use JPQL (Java Persistence Query Language) which operates on *Entities*, not tables.
Or use \`nativeQuery = true\` to write raw SQL (specific to Postgres/MySQL).

### 4. Pagination
Never return a \`List\` of all records. It will crash your server if the table grows. Use \`Pageable\` to fetch chunks.`,
        codeSnippet: `public interface OrderRepo extends JpaRepository<Order, Long> {

    // 1. Derived Query
    List<Order> findByStatusAndCreatedDateAfter(String status, LocalDate date);

    // 2. Custom JPQL
    @Query("SELECT o FROM Order o JOIN o.items i WHERE i.price > :price")
    Page<Order> findExpensiveOrders(@Param("price") BigDecimal price, Pageable page);

    // 3. Native SQL
    @Query(value = "SELECT * FROM orders WHERE json_data ->> 'type' = 'VIP'", nativeQuery = true)
    List<Order> findVipOrders();
}`,
        architectureHighlight: 'repository',
        showJpaMapper: true
      },
      {
        id: 'transactions',
        title: 'Transaction Management',
        description: 'Propagation, Isolation, and Rollback rules.',
        content: `### 1. ACID Properties
A transaction guarantees Atomicity, Consistency, Isolation, and Durability.
In Spring, \`@Transactional\` wraps your method. If the method finishes, it commits. If it throws a RuntimeException, it rolls back.

### 2. Checked Exceptions
**Gotcha**: By default, Spring converts unchecked exceptions (RuntimeException) to rollbacks, but **ignores** Checked Exceptions (e.g., \`IOException\`).
**Fix**: Always use \`@Transactional(rollbackFor = Exception.class)\` if you throw checked exceptions.

### 3. Propagation
What happens if Service A (Transactional) calls Service B (Transactional)?
- **REQUIRED (Default)**: B joins A's transaction. If B fails, A rolls back too.
- **REQUIRES_NEW**: B suspends A, runs in its own transaction, commits/rolls back independently. A resumes afterwards.`,
        codeSnippet: `@Service
public class OrderService {

    @Autowired PaymentService paymentService;

    // Default propagation: REQUIRED
    @Transactional
    public void checkout(Order order) {
        repo.save(order);
        
        try {
            // If this throws, does order save rollback?
            // YES, if paymentService joins the transaction.
            paymentService.charge(order);
        } catch (Exception e) {
            // ...
        }
    }
}

@Service
public class PaymentService {
    // If this fails, we don't want to rollback the Order log
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void charge(Order order) {
        // ...
    }
}`,
        architectureHighlight: 'service'
      },
      {
        id: 'caching',
        title: 'Caching Abstraction',
        description: 'Boost performance with Redis/Caffeine using @Cacheable.',
        content: `### 1. Why Cache?
Database calls, API requests, and complex calculations are slow. Caching stores the result in memory (Map or Redis) so subsequent calls are instant.

### 2. Annotations
- **@Cacheable**: Looks in cache. If found, returns it. If not, runs method and stores result.
- **@CachePut**: Runs method and updates cache (for updates).
- **@CacheEvict**: Removes item from cache (for deletes).

### 3. Keys and Conditions
You don't always want to cache everything.
- **Key**: Define what makes the request unique (e.g., \`#userId\`).
- **Condition**: Only cache if \`#result != null\` or \`#a > 10\`.`,
        codeSnippet: `@Service
public class ProductService {

    // Cache Name: 'products'
    // Key: The 'id' parameter
    @Cacheable(value = "products", key = "#id")
    public Product getById(Long id) {
        simulateSlowDb();
        return repo.findById(id).orElse(null);
    }

    // Clear cache when data changes
    @CacheEvict(value = "products", key = "#id")
    public void updateProduct(Long id, ProductDTO dto) {
        repo.update(id, dto);
    }

    // Complex key generation
    @Cacheable(value = "search", key = "{#category, #price}")
    public List<Product> search(String category, BigDecimal price) {
        return repo.search(category, price);
    }
}`,
        architectureHighlight: 'cache'
      }
    ]
  },
  {
    id: 'testing',
    title: 'Testing Best Practices',
    icon: 'CheckCircle',
    lessons: [
      {
        id: 'sliced-testing',
        title: 'Sliced Testing',
        description: 'Unit vs Integration Tests using Test Slices.',
        content: `### 1. The Pyramid
- **Unit Tests**: Fast. Mock everything. Test logic in isolation.
- **Integration Tests**: Slower. Test interaction between components.
- **E2E Tests**: Slowest. Test full system.

### 2. @SpringBootTest
This loads the **entire** application context. It's heavy and slow. Use it sparingly (e.g., for happy path smoke tests).

### 3. Test Slices
Spring provides annotations to load only *part* of the context.
- **@WebMvcTest**: Loads Controllers, ControllerAdvice, Json Converters. Mocks Services. Great for testing HTTP contracts.
- **@DataJpaTest**: Loads Repositories, Entities, Hibernate. Configures in-memory DB. Great for testing queries.
- **@JsonTest**: Tests JSON serialization/deserialization only.`,
        codeSnippet: `// 1. Controller Test (Fast)
@WebMvcTest(UserController.class)
class UserControllerTest {
    @Autowired MockMvc mvc;
    @MockBean UserService service; // Mock the dependency

    @Test
    void testGet() throws Exception {
        when(service.get(1L)).thenReturn(new User("Alice"));
        
        mvc.perform(get("/users/1"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.name").value("Alice"));
    }
}

// 2. Integration Test (Slower, Real DB)
@DataJpaTest
class RepoTest {
    @Autowired UserRepo repo;

    @Test
    void testQuery() {
        repo.save(new User("Bob"));
        assertTrue(repo.findByName("Bob").isPresent());
    }
}`,
        architectureHighlight: 'test'
      },
      {
        id: 'testcontainers',
        title: 'Testcontainers',
        description: 'Integration testing with real infrastructure (Docker).',
        content: `### 1. The H2 Trap
Using H2 (In-memory DB) for tests but PostgreSQL for production is risky.
- H2 might allow SQL syntax that Postgres rejects.
- H2 doesn't support JSONB or specific Postgres features.

### 2. Testcontainers
This library spins up **real Docker containers** for your test dependencies (Postgres, Redis, Kafka, Elasticsearch) during the test phase.
- It waits for the container to be healthy.
- It injects the dynamic port/URL into Spring properties.
- It destroys the container after tests.

### 3. Singleton Pattern
Spinning up a container takes time (2-5s). For a suite of 100 tests, that's too slow.
Best practice is to use the **Singleton Container Pattern**: Start the container once in a static block or abstract base class, and share it across all tests.`,
        codeSnippet: `@Testcontainers
@SpringBootTest(webEnvironment = RANDOM_PORT)
class FullIntegrationTest {

    // Starts a real Postgres 15 in Docker
    @Container
    static PostgreSQLContainer<?> postgres = 
        new PostgreSQLContainer<>("postgres:15");

    // Overrides application.properties with dynamic container URL
    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
    
    @Test
    void contextLoads() {
        // Runs against real DB!
    }
}`,
        architectureHighlight: 'test'
      }
    ]
  },
  {
    id: 'security',
    title: 'Spring Security',
    icon: 'ShieldCheck',
    lessons: [
      {
        id: 'security-chain',
        title: 'Security Filter Chain',
        description: 'Authentication, Authorization, and the Filter Chain architecture.',
        content: `### 1. How it works
Spring Security is essentially a chain of Servlet Filters.
Request -> Filter 1 (Auth) -> Filter 2 (CORS) -> Filter 3 (CSRF) -> ... -> DispatcherServlet -> Controller.

### 2. Modern Configuration
Gone is the \`WebSecurityConfigurerAdapter\`. We now define a \`SecurityFilterChain\` bean.
You typically need to configure:
- **CSRF**: Disable for stateless REST APIs (enable for server-side HTML).
- **Session**: Set to STATELESS for JWT-based APIs.
- **Authorize Requests**: Define which paths are public vs protected.

### 3. UserDetailsService
This is the core interface for loading user data. You implement \`loadUserByUsername()\`, fetch the user from DB, and return a \`UserDetails\` object containing password and authorities (roles).`,
        codeSnippet: `@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        // 1. Disable CSRF (using JWTs)
        .csrf(csrf -> csrf.disable())
        
        // 2. Stateless session (don't store cookies)
        .sessionManagement(sess -> sess.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        
        // 3. Define Access Rules
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/auth/**", "/public/**").permitAll()
            .requestMatchers("/api/admin/**").hasRole("ADMIN")
            .anyRequest().authenticated()
        )
        
        // 4. Add custom JWT Filter before the standard auth filter
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
        .build();
}`,
        architectureHighlight: 'security',
        showSecurityVisualizer: true
      },
      {
        id: 'oauth2-resource',
        title: 'OAuth2 Resource Server',
        description: 'Securing APIs with JWTs from Auth0, Keycloak, or Google.',
        content: `### 1. Resource Server Pattern
In modern apps, the backend doesn't handle login forms. The Frontend (React) redirects the user to an Identity Provider (Auth0/Google). The user logs in there.
The Provider gives the Frontend a **JWT (JSON Web Token)**.
The Frontend sends this token to your Spring Boot Backend in the \`Authorization: Bearer <token>\` header.

### 2. Token Validation
Your backend acts as a **Resource Server**. It validates the token:
- Is the signature valid? (Check against Provider's Public Key).
- Is it expired?
- Is the issuer correct?

### 3. Role Mapping
The JWT contains "Claims" (data). You might need a converter to map a claim like \`"groups": ["admin"]\` to Spring Security's \`ROLE_ADMIN\`.`,
        codeSnippet: `// 1. Minimal Config
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) {
    return http
        .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
        // Validate tokens using JWK Set URI from properties
        .oauth2ResourceServer(oauth2 -> oauth2.jwt()) 
        .build();
}

// 2. application.yml
// spring:
//   security:
//     oauth2:
//       resourceserver:
//         jwt:
//           issuer-uri: https://dev-xyz.us.auth0.com/
//           jwk-set-uri: https://dev-xyz.us.auth0.com/.well-known/jwks.json`,
        architectureHighlight: 'security'
      }
    ]
  }
];

export const ARCHITECTURE_STEPS = [
  { id: 'client', label: 'Client' },
  { id: 'gateway', label: 'API Gateway' },
  { id: 'security', label: 'Security Filter' },
  { id: 'controller', label: 'REST / GraphQL' },
  { id: 'cache', label: 'Cache (Redis)' },
  { id: 'service', label: 'Service (Tx Boundary)' },
  { id: 'event-bus', label: 'Event Bus' },
  { id: 'repository', label: 'JPA / Mongo' },
  { id: 'database', label: 'Database' },
  { id: 'broker', label: 'Message Broker' }
];

export const BEAN_LIFECYCLE_STEPS = [
  { 
    id: 'instantiation', 
    label: 'Instantiation', 
    description: 'The JVM creates the object instance using the constructor.',
    details: 'Dependencies are NOT yet injected. Fields are null or default values.'
  },
  { 
    id: 'populate', 
    label: 'Populate Properties', 
    description: 'Spring injects dependencies via @Autowired or setters.',
    details: 'Setter injection and field injection happen here. Constructor injection happened in step 1.'
  },
  { 
    id: 'aware', 
    label: 'Aware Interfaces', 
    description: 'Spring calls methods on beans that implement "Aware" interfaces.',
    details: 'BeanNameAware, BeanFactoryAware, ApplicationContextAware are notified.'
  },
  { 
    id: 'pre-init', 
    label: 'Pre-Initialization', 
    description: 'BeanPostProcessors are called before initialization.',
    details: 'postProcessBeforeInitialization() is executed for all registered BPPs.'
  },
  { 
    id: 'init', 
    label: 'Initialization', 
    description: 'The @PostConstruct method or InitializingBean.afterPropertiesSet() is called.',
    details: 'The bean is now fully configured and ready for custom initialization logic.'
  },
  { 
    id: 'post-init', 
    label: 'Post-Initialization', 
    description: 'BeanPostProcessors are called after initialization.',
    details: 'This is where AOP proxies (like @Transactional) are typically created.'
  },
  { 
    id: 'ready', 
    label: 'Ready for Use', 
    description: 'The bean is now fully managed and available in the ApplicationContext.',
    details: 'Other beans can now receive this bean as a dependency.'
  },
  { 
    id: 'destroy', 
    label: 'Destruction', 
    description: 'The @PreDestroy method or DisposableBean.destroy() is called.',
    details: 'Triggered when the ApplicationContext is closed (e.g., app shutdown).'
  }
];

export const SECURITY_FILTERS = [
  {
    id: 'cors',
    name: 'CorsFilter',
    description: 'Handles Cross-Origin Resource Sharing (CORS) preflight requests.',
    role: 'Infrastructure'
  },
  {
    id: 'csrf',
    name: 'CsrfFilter',
    description: 'Protects against Cross-Site Request Forgery by validating tokens.',
    role: 'Protection'
  },
  {
    id: 'jwt',
    name: 'JwtAuthenticationFilter',
    description: 'Custom filter to extract and validate JWT from Authorization header.',
    role: 'Authentication'
  },
  {
    id: 'basic',
    name: 'BasicAuthenticationFilter',
    description: 'Processes HTTP Basic authentication headers.',
    role: 'Authentication'
  },
  {
    id: 'username-password',
    name: 'UsernamePasswordAuthenticationFilter',
    description: 'Processes form-based login submissions.',
    role: 'Authentication'
  },
  {
    id: 'exception',
    name: 'ExceptionTranslationFilter',
    description: 'Translates Spring Security exceptions into HTTP responses.',
    role: 'Error Handling'
  },
  {
    id: 'authorization',
    name: 'AuthorizationFilter',
    description: 'Final check to ensure user has required roles for the resource.',
    role: 'Authorization'
  }
];

export const JPA_MAPPING_SCENARIOS = [
  {
    id: 'basic',
    title: 'Basic Entity',
    javaCode: `@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(unique = true)
    private String email;

    @Transient
    private String tempToken;
}`,
    tableName: 'users',
    columns: [
      { name: 'id', type: 'BIGINT', constraints: 'PK, AUTO_INC' },
      { name: 'name', type: 'VARCHAR(255)', constraints: 'NOT NULL' },
      { name: 'email', type: 'VARCHAR(255)', constraints: 'UNIQUE' }
    ],
    explanation: 'Basic mapping: @Id becomes Primary Key, @Column defines constraints, @Transient is ignored by the database.'
  },
  {
    id: 'one-to-many',
    title: 'One-to-Many Relationship',
    javaCode: `@Entity
public class Customer {
    @Id private Long id;
    
    @OneToMany(mappedBy = "customer")
    private List<Order> orders;
}

@Entity
public class Order {
    @Id private Long id;
    
    @ManyToOne
    @JoinColumn(name = "customer_id")
    private Customer customer;
}`,
    tableName: 'orders',
    columns: [
      { name: 'id', type: 'BIGINT', constraints: 'PK' },
      { name: 'customer_id', type: 'BIGINT', constraints: 'FK (customers.id)' }
    ],
    explanation: 'The @ManyToOne side owns the relationship. @JoinColumn creates the Foreign Key column in the "orders" table.'
  },
  {
    id: 'inheritance',
    title: 'Inheritance (Single Table)',
    javaCode: `@Entity
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "type")
public abstract class Payment {
    @Id private Long id;
    private BigDecimal amount;
}

@Entity
public class CreditCardPayment extends Payment {}

@Entity
public class PaypalPayment extends Payment {}`,
    tableName: 'payment',
    columns: [
      { name: 'id', type: 'BIGINT', constraints: 'PK' },
      { name: 'amount', type: 'DECIMAL', constraints: '' },
      { name: 'type', type: 'VARCHAR', constraints: 'DISCRIMINATOR' },
      { name: 'card_number', type: 'VARCHAR', constraints: 'NULLABLE' },
      { name: 'paypal_email', type: 'VARCHAR', constraints: 'NULLABLE' }
    ],
    explanation: 'SINGLE_TABLE strategy puts all fields from subclasses into one table. A "discriminator" column tells Hibernate which subclass to instantiate.'
  }
];

export const TOPOLOGY_DATA = {
  nodes: [
    { id: 'client', label: 'Client App', type: 'client', description: 'React/Mobile Frontend' },
    { id: 'gateway', label: 'API Gateway', type: 'infrastructure', description: 'Spring Cloud Gateway - Entry point, Security, Routing' },
    { id: 'eureka', label: 'Service Registry', type: 'infrastructure', description: 'Netflix Eureka - Service Discovery' },
    { id: 'config', label: 'Config Server', type: 'infrastructure', description: 'Spring Cloud Config - Centralized configuration' },
    { id: 'auth-service', label: 'Auth Service', type: 'service', description: 'JWT Issuance, User Authentication' },
    { id: 'order-service', label: 'Order Service', type: 'service', description: 'Manages customer orders' },
    { id: 'inventory-service', label: 'Inventory Service', type: 'service', description: 'Stock management' },
    { id: 'payment-service', label: 'Payment Service', type: 'service', description: 'Third-party payment integration' },
    { id: 'broker', label: 'Message Broker', type: 'infrastructure', description: 'RabbitMQ/Kafka - Async communication' },
    { id: 'database', label: 'Database', type: 'database', description: 'PostgreSQL/MongoDB' }
  ],
  links: [
    { source: 'client', target: 'gateway', label: 'HTTPS' },
    { source: 'gateway', target: 'auth-service', label: 'Auth Check' },
    { source: 'gateway', target: 'order-service', label: 'Route' },
    { source: 'order-service', target: 'inventory-service', label: 'gRPC/REST' },
    { source: 'order-service', target: 'payment-service', label: 'REST' },
    { source: 'order-service', target: 'broker', label: 'Event' },
    { source: 'inventory-service', target: 'broker', label: 'Listen' },
    { source: 'all-services', target: 'eureka', label: 'Register', special: true },
    { source: 'all-services', target: 'config', label: 'Fetch Config', special: true },
    { source: 'all-services', target: 'database', label: 'Persist', special: true }
  ]
};
