
import { Module } from './tutorial-types';

export const CURRICULUM_HE: Module[] = [
  {
    id: 'core',
    title: 'יסודות הליבה',
    icon: 'Cpu',
    lessons: [
      {
        id: 'ioc',
        title: 'היפוך שליטה (IoC)',
        description: 'צלילה לעומק ה-ApplicationContext, דפוסי Dependency Injection ומלכודות נפוצות.',
        content: `### 1. ה-Container של Spring
בליבו של Spring נמצא ה-**ApplicationContext**, המוכר בשם Spring Container. באפליקציית Java מסורתית, אתה (המפתח) שולט ביצירה ובחיבור של אובייקטים. אתה יוצר \`new User()\`, אחר כך \`new Order()\`, ומנהל ידנית את הקשרים ביניהם. זה מוביל לקוד מצומד חזק ו-קשה לבדיקה.

**IoC (היפוך שליטה)** הופך את זה. אתה מוותר על השליטה ביצירת אובייקטים. אתה אומר ל-Spring: *"אני צריך שירות משתמשים, והוא תלוי ב-Repository"*. Spring יוצר את ה-Repository, יוצר את השירות, ומחבר אותם יחד.

### 2. וריאנטים של Dependency Injection
יש שלוש דרכים עיקריות להזריק תלויות. הידיעה באיזו להשתמש מבדילה בין מפתח ג'וניור למפתח בכיר.

- **Constructor Injection (מומלץ)**: התלויות מועברות ל-constructor. זה מאפשר לסמן שדות כ-\`final\`, ומבטיח חוסר-שינוי. זה גם מונע מהמחלקה להיווצר במצב "שבור" (ללא התלויות הנדרשות).
- **Setter Injection**: שימושי רק לתלויות אופציונליות שעשויות להיות מוחלפות בזמן ריצה.
- **Field Injection (@Autowired על שדות)**: "הדרך הישנה". היא תמציתית אך מזיקה. היא מסתירה תלויות, מקשה על הבדיקות (צריך reflection להזריק mocks), ומאפשרת ל-circular dependencies להסתתר עד זמן ריצה.

### 3. Circular Dependencies
תלות מעגלית מתרחשת כאשר Bean A צריך את Bean B, אבל Bean B צריך את Bean A.
- עם **Constructor Injection**, Spring יזרוק \`BeanCurrentlyInCreationException\` בעלייה, ונכשל מהר. זה טוב! זה אומר לך שהעיצוב שלך פגום.
- עם **Field Injection**, Spring עשוי לפתור זאת עם proxies, אבל אתה נשאר עם עיצוב ספגטי.`,
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
          { groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter', description: 'Starter הליבה של Spring Boot, כולל תמיכה ב-auto-configuration, logging ו-YAML.' }
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
          description: 'בדיקת מצב הבריאות של אפליקציית Spring Boot ורכיביה.'
        }
      },
      {
        id: 'beans',
        title: 'Beans ו-Scopes',
        description: 'הבנת הפנימיות של Singleton, מקרי שימוש של Prototype, ו-Web Scopes.',
        content: `### 1. מהו Bean?
Bean הוא פשוט אובייקט שנוצר, מורכב ומנוהל על ידי Spring IoC container. הם עמוד השדרה של האפליקציה שלך.

### 2. Singleton Scope (ברירת המחדל)
כאשר אתה מגדיר Bean, Spring יוצר **מופע יחיד** לכל container. כל בקשה ל-\`userService\` מחזירה בדיוק את אותה הפניית אובייקט.
- **Concurrency**: מכיוון שהמופע משותף, הוא חייב להיות **חסר-מצב (stateless)**. אל תאחסן נתוני משתמש (כמו "משתמש נוכחי" או "פריטי עגלה") בשדות של Bean יחיד.
- **ביצועים**: גבוהים, כי היצירה קורית רק פעם אחת בעלייה.

### 3. Prototype Scope
Spring יוצר **מופע חדש** בכל פעם שה-Bean מתבקש.
- השתמש בזה לאובייקטים בעלי-מצב שאינם משותפים בין threads.
- **הערה**: Spring *אינו* מנהל את מחזור החיים המלא של prototype bean. הוא יוצר אותו, אך בדרך כלל לא משמיד אותו. אתה אחראי לניקוי.

### 4. Web Scopes
באפליקציית ווב, לעתים קרובות אתה צריך נתונים הקשורים לאינטראקציה ספציפית:
- **Request Scope**: מופע אחד לכל בקשת HTTP. שימושי להקשר logging.
- **Session Scope**: מופע אחד לכל session משתמש. שימושי לעגלות קניות או פרופילי משתמש.`,
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
        title: 'מחזור החיים של Bean',
        description: 'שליטה בסדר הריצה: יצירה, הגדרת Properties, ואתחול.',
        content: `### 1. סדר העלייה
חשוב להבין ש-constructor אינו מספיק. כאשר ה-constructor רץ, התלויות מוזרקות, אך מאפייני תצורה (כמו \`@Value\`) עשויים שלא להיות מעובדים במלואם, ו-AOP proxies עדיין לא הוחלו.

**הזרימה:**
1. **יצירה**: ה-constructor של Java רץ.
2. **Populate Properties**: Dependency Injection קורה.
3. **Pre-Initialization**: \`BeanPostProcessor.postProcessBeforeInitialization\` רץ.
4. **AfterPropertiesSet**: \`@PostConstruct\` רץ.
5. **Post-Initialization**: AOP Proxies נוצרים כאן.

### 2. @PostConstruct
זה המקום הסטנדרטי להריץ לוגיקת אתחול. לדוגמה, אם אתה צריך לטעון נתונים ממסד נתונים ל-cache map, עשה זאת כאן. אתה לא יכול לעשות זאת ב-constructor כי JPA Repository עדיין לא הוזרק.

### 3. @PreDestroy
רץ כאשר ה-\`ApplicationContext\` נסגר. השתמש בזה לסגור קבצים פתוחים, לעצור threads רקע, או להשליך buffers לדיסק.`,
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
    title: 'ליבה מתקדמת',
    icon: 'Layers',
    lessons: [
      {
        id: 'aop',
        title: 'תכנות מונחה-פנים (AOP)',
        description: 'כיצד Spring משתמש ב-Proxies לטיפול בדאגות-חוצות כמו Logging ו-Security.',
        content: `### 1. תבנית ה-Proxy
האם אי פעם תהית איך \`@Transactional\` עובד? אתה כותב מתודה פשוטה, אך איכשהו טרנזקציית מסד נתונים נפתחת ונסגרת אוטומטית.

Spring עושה זאת דרך **AOP Proxies**. כאשר אתה מבקש מ-Spring את ה-\`UserService\` שלך, הוא לא נותן לך את האובייקט האמיתי. הוא נותן לך **Proxy** (עטיפה) שמצביעה לאובייקט שלך.
1. ה-Proxy מיירט את הקריאה.
2. הוא פותח את הטרנזקציה.
3. הוא קורא למתודה האמיתית שלך.
4. הוא עושה commit לטרנזקציה.

### 2. מונחי מפתח
- **Aspect**: ה"דאגה" (למשל, Logging).
- **Advice**: הלוגיקה (למשל, "הדפס לקונסול").
- **Pointcut**: הביטוי שמגדיר *היכן* להחיל את ה-advice (למשל, "כל המתודות בחבילת Service").

### 3. מלכודת ה-"Self-Invocation"
מכיוון ש-AOP עובד דרך proxies, אם מתודה במחלקה שלך קוראת ל*מתודה אחרת* ב*אותה* מחלקה, הקריאה משתמשת ב-\`this.method()\`. זה **עוקף** את ה-proxy. האנוטציה \`@Transactional\` של המתודה השנייה תתעלם!`,
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
          { groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-aop', description: 'Starter לשימוש ב-Spring AOP ו-AspectJ.' }
        ]
      },
      {
        id: 'events',
        title: 'Spring Events',
        description: 'ניתוק ארכיטקטורה באמצעות תבנית Observer. אירועים סינכרוניים מול אסינכרוניים.',
        content: `### 1. למה אירועים?
באפליקציה מונוליטית, שירותים לעתים קרובות הופכים מצומדים חזק. \`UserService\` לא אמור לדעת על \`EmailService\`, \`AnalyticsService\`, ו-\`AuditService\`.
במקום זאת, \`UserService\` פשוט אומר: *"נוצר משתמש"*. השירותים האחרים יכולים להקשיב ולהגיב.

### 2. אירועים סינכרוניים (ברירת מחדל)
כברירת מחדל, \`ApplicationEventPublisher\` הוא סינכרוני. ה-listener רץ ב**אותו thread** וב**אותה טרנזקציה** כמו המפרסם.
- **יתרון**: עקביות. אם ה-listener נכשל, הטרנזקציה הראשית יכולה לעשות rollback.
- **חיסרון**: השהייה. המשתמש צריך לחכות שהמייל יישלח לפני שבקשת ה-HTTP מסתיימת.

### 3. אירועים אסינכרוניים
על ידי הוספת האנוטציה \`@Async\` ל-listener, הוא רץ ב-thread נפרד.
- **יתרון**: תגובה מהירה למשתמש.
- **חיסרון**: טיפול בשגיאות קשה יותר. אם המייל נכשל, המשתמש כבר נוצר.

### 4. Transactional Events
השתמש ב-\`@TransactionalEventListener\`. זה יוצר listener שרץ רק *אחרי* שהטרנזקציה במסד הנתונים הסתיימה בהצלחה. זה מונע שליחת מייל עבור משתמש שנעשה לו rollback בגלל שגיאת מסד נתונים.`,
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
        title: 'Async ו-Scheduling',
        description: 'ניהול משימות רקע, thread pools ו-distributed locking.',
        content: `### 1. עיבוד אסינכרוני
הוספת האנוטציה \`@Async\` למתודה אומרת ל-Spring לבצע אותה ב-thread נפרד.
**קריטי**: כברירת מחדל, Spring משתמש ב-\`SimpleAsyncTaskExecutor\`, שיוצר *thread חדש לכל משימה*. בפרודקשן, זה יכול להרוג את השרת שלך. אתה **חייב** להגדיר \`ThreadPoolTaskExecutor\` מותאם אישית כדי להגביל את מספר ה-threads.

### 2. Scheduled Tasks
\`@Scheduled\` מאפשר לך להריץ משימות מחזוריות.
- **fixedRate**: רץ כל X ms, נמדד מזמן ההתחלה. (משימות יכולות להתנגש).
- **fixedDelay**: רץ X ms *אחרי* שהמשימה הקודמת הסתיימה. (ללא התנגשות).
- **cron**: תזמון בסגנון Unix מורכב (למשל, "כל יום חול ב-9 בבוקר").

### 3. תזמון מבוזר
באשכול (מופעים מרובים של האפליקציה), \`@Scheduled\` רץ על *כל* node. לעתים קרובות אתה רוצה שרק *node אחד* יריץ את המשימה. אתה צריך ספרייה כמו **ShedLock** כדי להבטיח שרק node אחד לוכד את הנעילה במסד הנתונים.`,
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
    title: 'שליטה ב-Maven',
    icon: 'Package',
    lessons: [
      {
        id: 'maven-pom',
        title: 'POM וקואורדינטות',
        description: 'הבנת Project Object Model, קואורדינטות GAV ו-Snapshots.',
        content: `### 1. מהו Maven?
Maven הוא כלי לאוטומציית בנייה וניהול תלויות. הוא משתמש בקובץ **Project Object Model (POM)**, \`pom.xml\`, כדי לתאר את מבנה הפרויקט, התלויות ותהליך הבנייה.

### 2. קואורדינטות GAV
כל ארטיפקט באקוסיסטם של Maven מזוהה באופן ייחודי על ידי שלוש קואורדינטות:
- **GroupId**: בדרך כלל שם דומיין הפוך (למשל, \`com.example\`).
- **ArtifactId**: שם הפרויקט (למשל, \`my-app\`).
- **Version**: המהדורה הספציפית (למשל, \`1.0.0\`).

### 3. Snapshot מול Release
- **1.0.0-SNAPSHOT**: עבודה בתהליך. Maven בודק עדכונים מעת לעת. בשימוש במהלך פיתוח פעיל.
- **1.0.0**: מהדורה יציבה. בלתי-משתנה. לאחר שהוטמעה ב-repo, היא לעולם לא צריכה להשתנות.`,
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
        title: 'תלויות ו-Scopes',
        description: 'ניהול ספריות, תלויות transitive והחרגות.',
        content: `### 1. Dependency Scopes
לא כל ה-jars נדרשים בכל הזמנים.
- **compile** (ברירת מחדל): זמין בכל מקום (קומפילציה, בדיקות, ריצה).
- **test**: רק לבדיקות (למשל, JUnit, Mockito). לא כלול ב-JAR הסופי.
- **provided**: נדרש לקומפילציה אך מסופק על ידי הסביבה (למשל, Lombok, Servlet API).
- **runtime**: לא נדרש לקומפילציה, אך נדרש לריצה (למשל, MySQL Driver implementation).

### 2. Transitive Dependencies
אם אתה תלוי ב-\`Spring Web\`, ו-\`Spring Web\` תלוי ב-\`Jackson\`, Maven אוטומטית מוריד עבורך את \`Jackson\`. זה "עץ התלויות".

### 3. החרגה
לפעמים תלות transitive מתנגשת עם ספרייה אחרת. אתה יכול במפורש להחריג אותה.`,
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
        title: 'מחזור הבנייה',
        description: 'Clean, Compile, Package, Install ו-Deploy.',
        content: `### 1. מחזור החיים הסטנדרטי
ל-Maven מחזור חיים קשיח. הרצת שלב מאוחר יותר אוטומטית מריצה את כל השלבים הקודמים.
1. **validate**: בדוק אם הפרויקט תקין.
2. **compile**: הדר קוד מקור.
3. **test**: הרץ בדיקות יחידה (ניתן לדלג איתן \`-DskipTests\`).
4. **package**: ארוז קוד ל-JAR/WAR.
5. **verify**: בדיקות אינטגרציה.
6. **install**: שמור JAR ל-repository המקומי (\`~/.m2/repository\`).
7. **deploy**: העלה JAR ל-Nexus/Artifactory מרוחק.

### 2. Plugins
Maven עצמו לא עושה כלום. כל העבודה נעשית על ידי plugins.
- \`maven-compiler-plugin\`: מהדר Java.
- \`maven-surefire-plugin\`: מריץ בדיקות.
- \`maven-jar-plugin\`: בונה JARs.`,
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
        title: 'פרויקטים רב-מודולריים',
        description: 'ניהול מונוליטים גדולים עם Parent POMs ומודולים.',
        content: `### 1. ה-Parent POM
Parent POM מגדיר הגדרות משותפות (גרסאות, plugins) שהילדים יורשים. זה מפחית כפילות.

### 2. Dependency Management
**מושג קריטי**: ב-parent, השתמש ב-\`<dependencyManagement>\`. זה מגדיר *גרסאות* אך לא באמת מוסיף את התלות.
מודולי הילד מוסיפים את התלות *ללא* הגרסה. זה מבטיח שכל המודולים ישתמשו באותה גרסה מדויקת של הספריות.

### 3. צבירה
ה-POM הראשי מכיל סקציית \`<modules>\`. בניית השורש בונה את כל המודולים בסדר הנכון.`,
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
        title: 'Plugin של Spring Boot',
        description: 'אריזה מחדש והרצה של אפליקציות Spring Boot.',
        content: `### 1. ה-JAR הניתן להרצה
JAR סטנדרטי מכיל רק את המחלקות שלך. הוא לא יכול לרוץ בעצמו אם יש לו תלויות.
ה-\`spring-boot-maven-plugin\` מבצע **אריזה מחדש**:
1. הוא מעתיק את כל JARs של התלויות ל-\`BOOT-INF/lib\`.
2. הוא מוסיף ClassLoader מיוחד לקרוא אותם.
3. הוא מגדיר את ה-Main-Class ל-launcher של Spring.

### 2. Goals
- \`spring-boot:run\`: מפעיל את האפליקציה ישירות מהמקור.
- \`spring-boot:repackage\`: יוצר את ה-JAR הניתן להרצה (רץ אוטומטית בשלב package).
- \`spring-boot:build-image\`: יוצר image של Docker באמצעות Cloud Native Buildpacks.`,
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
    title: 'Microservices וענן',
    icon: 'Cloud',
    lessons: [
      {
        id: 'gateway',
        title: 'Spring Cloud Gateway',
        description: 'Routing, Filtering ותבנית ה-API Gateway.',
        content: `### 1. תבנית ה-Gateway
בעולם ה-microservices, ה-frontend לא אמור להכיר 50 microservices שונים. הוא אמור לדבר עם נקודת כניסה אחת: ה-**Gateway**.
ה-Gateway מטפל ב:
- **Routing**: העברת \`/users\` ל-User Service ו-\`/orders\` ל-Order Service.
- **דאגות חוצות**: Authentication, Rate Limiting, הפסקת SSL ו-Logging.

### 2. Predicates ו-Filters
Spring Cloud Gateway משתמש בתכנות ריאקטיבי (WebFlux).
- **Predicates**: מתאימים לבקשה (למשל, "Path הוא /api/**" או "כותרת X-Mobile קיימת").
- **Filters**: משנים את הבקשה/תגובה (למשל, "הוסף Auth Header", "הסר Prefix", "Retry").`,
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
          { groupId: 'org.springframework.cloud', artifactId: 'spring-cloud-starter-gateway', description: 'Starter לשימוש ב-Spring Cloud Gateway.' },
          { groupId: 'org.springframework.cloud', artifactId: 'spring-cloud-starter-circuitbreaker-resilience4j', description: 'Starter לשימוש ב-Resilience4j עם Spring Cloud Circuit Breaker.' }
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
          description: 'דמה בקשה דרך ה-API Gateway אל ה-User Microservice.'
        },
        showTopologyVisualizer: true
      },
      {
        id: 'resilience',
        title: 'עמידות (Circuit Breaker)',
        description: 'עצירת כשלים מדורגים עם Resilience4j.',
        content: `### 1. הבעיה
Microservice A קורא ל-Microservice B. אם B נופל או מאט, ה-threads של A יתלו בהמתנה ל-B. בסופו של דבר, ל-A נגמרים ה-threads והוא קורס. תגובת השרשרת הזו יכולה להפיל את כל הפלטפורמה.

### 2. תבנית Circuit Breaker
זה עובד כמו מפסק חשמלי.
- **Closed (רגיל)**: בקשות עוברות. אנחנו סופרים שגיאות.
- **Open (מופעל)**: שגיאות רבות מדי קרו. אנחנו *מיד* מכשילים בקשות נכנסות מבלי לקרוא ל-B. זה נותן ל-B זמן להתאושש.
- **Half-Open**: אנחנו נותנים לכמה בקשות לעבור כדי לבדוק אם B חזר לפעולה.

### 3. Fallbacks
כאשר המעגל פתוח, או שקריאה נכשלת, אנחנו מבצעים מתודת **Fallback**. זה מאפשר לנו להחזיר נתוני ברירת מחדל (למשל, "תמחור לא זמין כרגע") במקום דף שגיאה.`,
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
          { groupId: 'io.github.resilience4j', artifactId: 'resilience4j-spring-boot3', description: 'Starter של Resilience4j ל-Spring Boot 3.' },
          { groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-actuator', description: 'Starter לשימוש ב-Spring Boot Actuator (נדרש למוניטורינג של עמידות).' }
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
          description: 'דמה כשל של שירות שבו Resilience4j מפעיל את מתודת ה-fallback.'
        }
      },
      {
        id: 'tracing',
        title: 'Tracing מבוזר',
        description: 'הדמיית בקשות על פני microservices באמצעות Micrometer ו-Zipkin.',
        content: `### 1. אתגר ה-Observability
משתמש לוחץ "קנייה". הבקשה מגיעה ל-Gateway -> Order Service -> Inventory Service -> Payment Service.
אם הבקשה לוקחת 5 שניות, איזה שירות איטי? Logs על שרתים בודדים לא יגידו לך את הסיפור המלא.

### 2. Trace ID ו-Span ID
**Micrometer Tracing** (לשעבר Spring Cloud Sleuth) אוטומטית מזריק כותרות לקריאות HTTP ו-Message.
- **Trace ID**: מזהה ייחודי למסע כולו (למשל, הקליק של המשתמש).
- **Span ID**: מזהה ייחודי לצעד ספציפי (למשל, עיבוד של Order Service).

### 3. Log Correlation
Spring Boot אוטומטית מוסיף את ה-IDs האלה ל-logs בקונסול (דרך MDC).
\`INFO [order-service, trace-123, span-456] : Processing order...\`
אתה יכול לייצא את ה-traces האלה לכלי ויזואליזציה כמו **Zipkin**, **Jaeger**, או **Grafana Tempo** כדי לראות גרף מפל של הבקשה שלך.`,
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
          { groupId: 'io.micrometer', artifactId: 'micrometer-tracing-bridge-brave', description: 'Bridge של Micrometer Tracing ל-Brave.' },
          { groupId: 'io.zipkin.reporter2', artifactId: 'zipkin-reporter-brave', description: 'Reporter של Zipkin עבור Brave.' }
        ]
      }
    ]
  },
  {
    id: 'messaging',
    title: 'Messaging ו-Async',
    icon: 'MessageSquare',
    lessons: [
      {
        id: 'rabbitmq',
        title: 'RabbitMQ (Spring AMQP)',
        description: 'Exchanges, Queues, Routing Keys וטיפול ב-Dead Letter.',
        content: `### 1. מושגים
- **Producer**: שולח הודעה.
- **Exchange**: "משרד הדואר". מקבל הודעות ומחליט לאן לשלוח אותן לפי routing keys.
- **Queue**: תיבת הדואר. ההודעות יושבות כאן עד שהן נצרכות.
- **Consumer**: קורא מה-queue.

### 2. סוגי Exchange
- **Direct**: התאמה מדויקת של routing key.
- **Fanout**: שידור לכל ה-queues (Pub/Sub).
- **Topic**: התאמת תבניות (למשל, \`orders.*\`).

### 3. אמינות (DLQ)
מה אם consumer זורק חריגה? אם אתה רק תופס אותה ורושם ב-log, ההודעה אבודה.
Spring AMQP תומך ב-**Dead Letter Queues (DLQ)**. אם הודעה נכשלת בעיבוד X פעמים, היא אוטומטית עוברת ל-queue \`.dlq\`, שם ניתן לבדוק אותה ידנית או להפעיל אותה מחדש מאוחר יותר.`,
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
          { groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-amqp', description: 'Starter לשימוש ב-Spring AMQP ו-RabbitMQ.' }
        ]
      },
      {
        id: 'kafka',
        title: 'Apache Kafka',
        description: 'Event Streaming, Partitions, Consumer Groups ו-Avro.',
        content: `### 1. Kafka מול RabbitMQ
RabbitMQ הוא "broker חכם, consumer טיפש". הוא מנהל את מצב ה-queue.
Kafka הוא "broker טיפש, consumer חכם". זה לוג commit מבוזר. הודעות לא מוסרות כשקוראים אותן; הן רק נוספות. Consumers עוקבים אחרי ה-"offset" שלהם (המיקום).

### 2. Consumer Groups
ככה Kafka מתרחב. אם יש לך topic עם 10 partitions, אתה יכול להרים 10 מופעים של האפליקציה (Consumer Group). Kafka יקצה אוטומטית partition אחד לכל מופע, מה שמאפשר עיבוד מקבילי.

### 3. Serialization
בפרודקשן, שליחת מחרוזות JSON לא יעילה ושברירית. אנחנו בדרך כלל משתמשים ב-**Avro** עם **Schema Registry**. זה אוכף schema (חוזה) כך ש-producers לא יכולים לשלוח נתונים רעים שישברו consumers.`,
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
          { groupId: 'org.springframework.kafka', artifactId: 'spring-kafka', description: 'Starter לשימוש ב-Apache Kafka עם Spring.' }
        ]
      },
      {
        id: 'websockets',
        title: 'WebSockets (STOMP)',
        description: 'תקשורת דו-כיוונית בזמן אמת עם STOMP ו-SockJS.',
        content: `### 1. מעבר ל-HTTP
HTTP הוא חסר-מצב ומבוסס בקשה-תגובה. לאפליקציית צ'אט או טיקר מניות חי, אתה צריך חיבור מתמשך.
**WebSockets** מספקים ערוץ TCP דו-כיווני מלא על חיבור HTTP יחיד.

### 2. STOMP (Simple Text Oriented Messaging Protocol)
WebSockets גולמיים הם רק זרם של bytes. Spring משתמש ב-STOMP כדי להגדיר מבנה (כמו פעלי HTTP ל-sockets).
- **SUBSCRIBE**: הלקוח רוצה להאזין ל-topic.
- **SEND**: הלקוח שולח הודעה לשרת.

### 3. ה-Message Broker
ל-Spring יש broker פשוט בזיכרון, או שהוא יכול להעביר הודעות ל-broker חיצוני (RabbitMQ/ActiveMQ) לתמיכה באשכולות.`,
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
          { groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-websocket', description: 'Starter לבניית אפליקציות WebSocket עם Spring.' }
        ]
      }
    ]
  },
  {
    id: 'config',
    title: 'תצורה',
    icon: 'Settings',
    lessons: [
      {
        id: 'config-props',
        title: 'תצורה בטוחה-טיפוס',
        description: 'למה @ConfigurationProperties עדיף על @Value.',
        content: `### 1. הבעיה עם @Value
השימוש ב-\`@Value("\${property}")\` נפוץ אך בעייתי:
- מפתחות מבוססי-מחרוזת נוטים לטעויות הקלדה.
- אין אימות טיפוס (האם ה-timeout שלילי?).
- מפוזר על פני קוד הבסיס.

### 2. הפתרון: @ConfigurationProperties
זה קושר היררכיה של properties לאובייקט Java.
- **בטיחות טיפוס**: המרה אוטומטית ל-Lists, Maps, Durations ו-Data Sizes.
- **אימות**: תומך ב-JSR-303 (\`@NotNull\`, \`@Min\`).
- **Metadata**: מייצר JSON metadata כך ש-IDEs (IntelliJ/VS Code) נותנים autocomplete ב-\`application.properties\`.

### 3. Java Records
Spring Boot 2.6+ תומך בקשירה ל-Java Records, יוצר אובייקטי תצורה בלתי-משתנים.`,
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
        title: 'Profiles וסביבות',
        description: 'ניהול תצורה על פני סביבות Local, Dev ו-Prod.',
        content: `### 1. תצורה רב-סביבתית
לעתים רחוקות אתה מריץ את אותה תצורה ב-Dev וב-Prod.
- **Dev**: מסד נתונים H2, Debug Logging, Mock Payment Gateway.
- **Prod**: PostgreSQL, Info Logging, Stripe Gateway אמיתי.

### 2. קבצים ספציפיים ל-Profile
Spring טוען \`application.properties\` קודם, אחר כך דורס אותו עם \`application-{profile}.properties\`.
דוגמה: \`application-prod.properties\` דורס ערכי ברירת מחדל.

### 3. Beans מותנים
השתמש ב-\`@Profile\` כדי לשלוט ביצירת Beans.
- \`@Profile("dev")\`: רק ב-dev.
- \`@Profile("!prod")\`: בכל profile חוץ מ-prod.
- \`@Profile("cloud & postgres")\`: לוגיקה בוליאנית נתמכת.`,
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
    title: 'שירותי ווב RESTful',
    icon: 'Globe',
    lessons: [
      {
        id: 'rest-controller',
        title: 'REST Controllers',
        description: 'בניית APIs נכונים של REST: פעלים, קודי סטטוס ו-DTOs.',
        content: `### 1. פעלי HTTP חשובים
אל תשתמש ב-\`@PostMapping\` לכל דבר.
- **GET**: Idempotent, בטוח. שליפת נתונים.
- **POST**: לא Idempotent. יצירת משאב חדש.
- **PUT**: Idempotent. החלפת משאב שלם.
- **PATCH**: לא Idempotent. עדכון חלקי.
- **DELETE**: Idempotent. הסרת משאב.

### 2. DTOs (אובייקטי העברת נתונים)
**לעולם** אל תחשוף את ישויות מסד הנתונים שלך (@Entity) ישירות ב-API.
- **סיכון אבטחה**: אתה עלול לחשוף בטעות hashes של סיסמאות.
- **צימוד**: שינוי ה-schema של ה-DB שובר את לקוחות ה-API.
תמיד מפה Entity -> DTO לפני החזרה.

### 3. קודי סטטוס
החזר את הקוד הנכון, לא רק 200 OK לכל דבר.
- 201 Created (אחרי POST)
- 204 No Content (אחרי DELETE)
- 400 Bad Request (אימות נכשל)
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
          description: 'יצירת משתמש חדש וקבלת סטטוס 201 Created עם תגובת ה-DTO.'
        }
      },
      {
        id: 'exceptions',
        title: 'טיפול גלובלי בחריגות',
        description: 'שימוש ב-@ControllerAdvice וב-RFC 7807 Problem Details.',
        content: `### 1. סיוט ה-Try-Catch
אל תכתוב בלוקי try-catch בכל מתודת controller. זה הופך את הקוד לבלתי-קריא ואת הטיפול בשגיאות ללא-עקבי.

### 2. ControllerAdvice
זה interceptor AOP ל-Controllers. הוא תופס חריגות שנזרקות בכל מקום בשכבת ה-controller והופך אותן לתגובות HTTP נכונות.

### 3. Problem Details (RFC 7807)
Spring Boot 3 תומך בסטנדרט זה באופן טבעי. במקום להמציא פורמט JSON שגיאות משלך \`{ "err": "msg" }\`, השתמש ב-\`ProblemDetail\` הסטנדרטי שמספק שדות ל-type, title, status, detail ו-instance.`,
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
          description: 'דמה שגיאת 404 שמטופלת על ידי Global Exception Handler באמצעות RFC 7807 Problem Details.'
        }
      },
      {
        id: 'openapi',
        title: 'OpenAPI (Swagger)',
        description: 'תיעוד כקוד באמצעות SpringDoc.',
        content: `### 1. תיעוד הוא קריטי
API הוא חסר-תועלת אם אף אחד לא יודע להשתמש בו. לשמור על מסמך Word או Wiki נפרד מעודכן זה בלתי-אפשרי.
**OpenAPI (Swagger)** היא מפרט סטנדרטי לתיאור APIs של REST.

### 2. SpringDoc
התלות \`springdoc-openapi-starter-webmvc-ui\` סורקת אוטומטית את האפליקציה שלך בעלייה.
- היא מוצאת את כל מחלקות \`@RestController\`.
- היא מנתחת את בקשות/תגובות ה-body והטיפוסים.
- היא מייצרת הגדרת JSON ב-\`/v3/api-docs\`.
- היא מגישה UI ב-\`/swagger-ui.html\`.

### 3. העשרת תיעוד
אתה יכול להוסיף תיאורים, ערכי דוגמה וקודי שגיאה באמצעות אנוטציות כמו \`@Operation\` ו-\`@Schema\`.`,
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
        description: 'שאילתות גמישות, Schema Mapping והימנעות מבעיית N+1.',
        content: `### 1. REST מול GraphQL
ב-REST, אתה עשוי להיות צריך לקרוא ל-\`/users/1\`, אחר כך \`/users/1/posts\`, אחר כך \`/posts/5/comments\`. זה "Under-fetching" (יותר מדי בקשות).
או שאתה קורא ל-\`/users/1\` ומקבל חזרה JSON ענק עם שדות שאתה לא צריך ("Over-fetching").
**GraphQL** מאפשר ללקוח לבקש בדיוק את מה שהוא צריך בבקשה אחת.

### 2. אינטגרציה עם Spring
Spring Boot 2.7+ הציג תמיכה רשמית. אתה מגדיר קובץ schema (\`.graphqls\`) וממפה מתודות controller לשדות.

### 3. בעיית ה-N+1
אם אתה שולף 10 ספרים, ולכל ספר אתה מפעיל שאילתת SQL נפרדת לשלוף את המחבר, אתה מריץ 1 + 10 = 11 שאילתות.
ב-GraphQL, זה נפתר עם **BatchLoader** (או \`@BatchMapping\` ב-Spring). הוא אוסף את כל מזהי המחברים ומביא אותם בשאילתה אחת.`,
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
    title: 'גישה לנתונים',
    icon: 'Database',
    lessons: [
      {
        id: 'jpa-repo',
        title: 'JPA Repositories',
        description: 'Derived Queries, JPQL ו-Pagination.',
        content: `### 1. הקסם של Spring Data
אתה כותב ממשק שמרחיב את \`JpaRepository\`, ו-Spring מייצר את ה-bytecode של המימוש בזמן ריצה.

### 2. Derived Queries
Spring מפרק את שם המתודה כדי ליצור SQL.
- \`findByEmail(String email)\` -> \`SELECT ... WHERE email = ?\`
- \`countByActiveTrue()\`
- \`deleteByLastLoginBefore(Date date)\`

### 3. @Query (JPQL ו-Native)
לצירופים מורכבים או דוחות, שמות המתודות נהיים ארוכים מדי. השתמש ב-JPQL (Java Persistence Query Language) שעובד על *Entities*, לא טבלאות.
או השתמש ב-\`nativeQuery = true\` כדי לכתוב SQL גולמי (ספציפי ל-Postgres/MySQL).

### 4. Pagination
לעולם אל תחזיר \`List\` של כל הרשומות. זה יקרוס את השרת שלך אם הטבלה תגדל. השתמש ב-\`Pageable\` כדי להביא chunks.`,
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
        title: 'ניהול טרנזקציות',
        description: 'Propagation, Isolation וחוקי Rollback.',
        content: `### 1. תכונות ACID
טרנזקציה מבטיחה Atomicity, Consistency, Isolation ו-Durability.
ב-Spring, \`@Transactional\` עוטף את המתודה שלך. אם המתודה מסתיימת, היא עושה commit. אם היא זורקת RuntimeException, היא עושה rollback.

### 2. Checked Exceptions
**מלכודת**: כברירת מחדל, Spring ממיר חריגות unchecked (RuntimeException) ל-rollbacks, אך **מתעלם** מ-Checked Exceptions (למשל, \`IOException\`).
**תיקון**: תמיד השתמש ב-\`@Transactional(rollbackFor = Exception.class)\` אם אתה זורק checked exceptions.

### 3. Propagation
מה קורה אם Service A (Transactional) קורא ל-Service B (Transactional)?
- **REQUIRED (ברירת מחדל)**: B מצטרף לטרנזקציה של A. אם B נכשל, גם A עושה rollback.
- **REQUIRES_NEW**: B משעה את A, רץ בטרנזקציה משלו, עושה commit/rollback עצמאית. A ממשיך אחר כך.`,
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
        title: 'אבסטרקציית Caching',
        description: 'שיפור ביצועים עם Redis/Caffeine באמצעות @Cacheable.',
        content: `### 1. למה Cache?
קריאות למסד נתונים, בקשות API וחישובים מורכבים הם איטיים. Caching שומר את התוצאה בזיכרון (Map או Redis) כך שקריאות עוקבות הן מיידיות.

### 2. אנוטציות
- **@Cacheable**: מחפש ב-cache. אם נמצא, מחזיר. אם לא, מריץ מתודה ושומר תוצאה.
- **@CachePut**: מריץ מתודה ומעדכן את ה-cache (לעדכונים).
- **@CacheEvict**: מסיר פריט מה-cache (למחיקות).

### 3. Keys ותנאים
אתה לא תמיד רוצה לשמור ב-cache את הכל.
- **Key**: הגדר מה הופך את הבקשה לייחודית (למשל, \`#userId\`).
- **Condition**: שמור ב-cache רק אם \`#result != null\` או \`#a > 10\`.`,
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
    title: 'שיטות עבודה מומלצות לבדיקות',
    icon: 'CheckCircle',
    lessons: [
      {
        id: 'sliced-testing',
        title: 'בדיקות פרוסות',
        description: 'בדיקות יחידה מול אינטגרציה באמצעות Test Slices.',
        content: `### 1. הפירמידה
- **בדיקות יחידה**: מהירות. Mock לכל דבר. בדיקת לוגיקה בבידוד.
- **בדיקות אינטגרציה**: איטיות יותר. בדיקת אינטראקציה בין רכיבים.
- **בדיקות E2E**: האיטיות ביותר. בדיקת המערכת המלאה.

### 2. @SpringBootTest
זה טוען את **כל** ה-context של האפליקציה. זה כבד ואיטי. השתמש בו במשורה (למשל, לבדיקות smoke של נתיב מאושר).

### 3. Test Slices
Spring מספק אנוטציות כדי לטעון רק *חלק* מה-context.
- **@WebMvcTest**: טוען Controllers, ControllerAdvice, Json Converters. מעשה Mock ל-Services. מעולה לבדיקת חוזי HTTP.
- **@DataJpaTest**: טוען Repositories, Entities, Hibernate. מגדיר DB בזיכרון. מעולה לבדיקת שאילתות.
- **@JsonTest**: בודק serialization/deserialization של JSON בלבד.`,
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
        description: 'בדיקות אינטגרציה עם תשתית אמיתית (Docker).',
        content: `### 1. מלכודת ה-H2
שימוש ב-H2 (DB בזיכרון) לבדיקות אך PostgreSQL לפרודקשן זה מסוכן.
- H2 עשוי לאפשר syntax של SQL ש-Postgres דוחה.
- H2 לא תומך ב-JSONB או בתכונות ספציפיות של Postgres.

### 2. Testcontainers
הספרייה הזו מרימה **containers אמיתיים של Docker** לתלויות הבדיקה שלך (Postgres, Redis, Kafka, Elasticsearch) במהלך שלב הבדיקה.
- היא ממתינה שה-container יהיה בריא.
- היא מזריקה את ה-port/URL הדינמי ל-properties של Spring.
- היא משמידה את ה-container אחרי הבדיקות.

### 3. תבנית Singleton
הרמת container לוקחת זמן (2-5 שניות). לחבילה של 100 בדיקות, זה איטי מדי.
התרגול המומלץ הוא להשתמש ב-**תבנית Singleton Container**: הפעל את ה-container פעם אחת בבלוק static או במחלקת בסיס מופשטת, ושתף אותו בכל הבדיקות.`,
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
        description: 'Authentication, Authorization וארכיטקטורת ה-Filter Chain.',
        content: `### 1. איך זה עובד
Spring Security הוא בעיקרו שרשרת של Servlet Filters.
Request -> Filter 1 (Auth) -> Filter 2 (CORS) -> Filter 3 (CSRF) -> ... -> DispatcherServlet -> Controller.

### 2. תצורה מודרנית
הלך ה-\`WebSecurityConfigurerAdapter\`. אנחנו עכשיו מגדירים Bean של \`SecurityFilterChain\`.
בדרך כלל אתה צריך להגדיר:
- **CSRF**: בטל ל-APIs stateless של REST (הפעל ל-HTML בצד שרת).
- **Session**: הגדר ל-STATELESS ל-APIs מבוססי JWT.
- **Authorize Requests**: הגדר אילו נתיבים ציבוריים מול מוגנים.

### 3. UserDetailsService
זה הממשק הליבה לטעינת נתוני משתמש. אתה ממש את \`loadUserByUsername()\`, שולף את המשתמש מה-DB, ומחזיר אובייקט \`UserDetails\` המכיל סיסמה והרשאות (roles).`,
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
        description: 'אבטחת APIs עם JWTs מ-Auth0, Keycloak או Google.',
        content: `### 1. תבנית Resource Server
באפליקציות מודרניות, ה-backend לא מטפל בטפסי התחברות. ה-Frontend (React) מפנה את המשתמש ל-Identity Provider (Auth0/Google). המשתמש מתחבר שם.
ה-Provider נותן ל-Frontend **JWT (JSON Web Token)**.
ה-Frontend שולח את ה-token הזה ל-Spring Boot Backend שלך בכותרת \`Authorization: Bearer <token>\`.

### 2. אימות Token
ה-backend שלך פועל כ-**Resource Server**. הוא מאמת את ה-token:
- האם החתימה תקפה? (בדוק מול המפתח הציבורי של ה-Provider).
- האם הוא פג?
- האם ה-issuer נכון?

### 3. מיפוי Roles
ה-JWT מכיל "Claims" (נתונים). אתה עשוי להזדקק ל-converter כדי למפות claim כמו \`"groups": ["admin"]\` ל-\`ROLE_ADMIN\` של Spring Security.`,
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
