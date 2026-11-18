import type { GuideSection } from './guide-types'

export const GUIDE_SECTIONS_HE: GuideSection[] = [
  // ─────────────────────────────────────────────────────────────────
  // SYSTEM OVERVIEW
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'overview',
    title: 'סקירת המערכת',
    icon: 'info',
    topics: [
      {
        id: 'overview-what',
        title: 'מה הכלי הזה?',
        description: 'תמונה כללית של מה שמערכת Menora Spring Initializr עושה.',
        content: `### מטרה
כלי זה הוא מחולל הפרויקטים הפנימי של Menora. מפתחים מתארים פרויקט, לוחצים **Generate**, ומקבלים קובץ ZIP שנבנה מול ה-Artifactory של Menora ועומד בסטנדרטים של החברה. שלוש לשוניות מייצרות שלושה סוגי פרויקטים:

- **Backend** — שירות Spring Boot (Maven, Java 17 או 21, Boot 3.2 או 3.5), מודול בודד או multi-module. ארבעה אשפים יכולים לכתוב לתוכו קוד: ישויות מסכמת SQL או ממסד נתונים חי, controllers ו-clients ממסמך OpenAPI, נקודות קצה ו-clients של SOAP מ-WSDL, ו-producers ו-listeners של Kafka ממסמך AsyncAPI.
- **Frontend** — אפליקציית React + TypeScript + Vite.
- **Fullstack** — אפליקציית CRUD עובדת, backend של Spring ו-frontend של React יחד, ממודל ישויות: עמודים ודשבורדים, workflows, כללי גישה, בדיקות שנוצרות.

### מה כל Backend מכיל
- מאגרי ה-Artifactory ו-\`settings.xml\`
- Log4j2 עם פורמטי הלוג ב-JSON של Menora (Logback מוצא), ו-Lombok
- \`Dockerfile\` לגרסת ה-Java שנבחרה, \`k8s/Jenkinsfile\`, \`k8s/values.yaml\` ו-\`entrypoint.sh\`
- חיבור Vault מקומי: פרופיל \`vault-local\` שנדלק כאשר \`VAULT_TOKEN\` מוגדר בסביבה או בקובץ \`.env\` שמוחרג מ-git
- קונפיגורציה לכל תלות (מקטעי \`application.yaml\`, מחלקות config, קוד לדוגמה מאחורי אפשרויות משניות)
- \`compose.yaml\` ופרופיל \`compose\` כאשר תלות צריכה שירות (מסד נתונים, Kafka, Redis, MongoDB)
- \`menora-model.json\` — הבקשה שממנה נוצר הפרויקט, כדי שהמחולל יוכל לפתוח אותו מחדש ולהפיק לו עדכון בהמשך
- \`.editorconfig\` ו-\`VERSION\`

### מדוע לא start.spring.io?
מערכת Spring Initializr הציבורית אינה יודעת דבר על ה-Artifactory של Menora, ספריות פנימיות, תבניות קבצים, הוצאות (exclusions) נדרשות, Vault או קבצי פריסה, ואין לה אשפים, מחולל fullstack או דרך לעדכן פרויקט שהיא יצרה. ה-backend הזה מוסיף את כל אלו על גבי אותה מסגרת Spring Initializr שמפעילה את start.spring.io.

### אדמין מול אפליקציה
**האפליקציה** היא מה שמפתחים משתמשים בו: שלוש הלשוניות, ובנוסף המדריך הזה ו-Training. **האדמין** (Config) הוא לוח הבקרה: מה שמוגדר שם קובע מה נכנס לפרויקטים שנוצרים, והלשוניות History ו-Activity שלו מראות מי שינה את הקטלוג ומה נוצר. המדריך הזה נכתב לאדמינים, ולשוניות המחולל מוסברות בו היכן שאדמין צריך אותן.`,
      },
      {
        id: 'overview-pipeline',
        title: 'תהליך יצירת הפרויקט',
        description: 'כיצד קובץ ZIP מורכב מקונפיגורציית האדמין בזמן הבקשה.',
        content: `### זרימת הבקשה
כאשר מפתח לוחץ Generate בלשונית Backend, מתרחש הבא:

1. **בקשת HTTP** — \`GET /starter.zip\` עם פרמטרי query (\`groupId\`, \`artifactId\`, \`dependencies\`, \`bootVersion\`, \`javaVersion\`, אפשרויות משניות בצורה \`opts-kafka=consumer-example\`…). בקשה עם מסמכי אשף הולכת ל-\`POST /starter-wizard.zip\`, בקשה עם מודולים ל-\`GET /starter-multimodule.zip\`; ללשוניות fullstack ו-frontend יש endpoints משלהן. כל אחד מהם בונה את אותו סוג של בקשת פרויקט, עם ברירות המחדל מהמטה-דאטה, כך שגרסת Boot או Java לא מוכרת היא 400 בכל מקום.
2. **פילטרים** — כאשר שער הגישה פעיל, בקשה ללא הכותרת \`userinfo\` נדחית (403). \`InitializrWebConfiguration\` משלים את \`configurationFileFormat\` שחלק מהלקוחות משמיטים, קורא את האפשרויות המשניות, ומיישם את **כללי התאימות**: תלות שתלות אחרת דורשת (REQUIRES) מתווספת, ושתיים שמתנגשות (CONFLICTS) הן 400 שמציין את שתיהן ואת הסיבה.
3. **המסגרת** מפעילה קונטקסט Spring ילד לבקשה וקוראת לשלושת ה-\`ProjectGenerationConfiguration\` הרשומים:
   - **\`DynamicProjectGenerationConfiguration\`** קורא את הקטלוג ממסד הנתונים: **תורם הקבצים** כותב, ממזג ומרנדר כל תרומת קובץ של התלויות הנבחרות (בתוספת \`__common__\`), מסוננת לפי גרסת Java ואפשרות משנית; **תורם המחיקות** רץ אחרון ומסיר קבצים ש-Menora לא רוצה (\`application.properties\`, ה-Maven wrapper); **מתאם ה-build** מוסיף תלויות, הוצאות, מאגרים ו-BOMs, כשכל שורה מסוננת לפי האפשרות המשנית וטווח ה-Boot שלה. ארבעת האשפים כותבים את הקוד שלהם כאן גם כן, ו-\`menora-model.json\` נכתב אחרון.
   - **\`FullstackProjectGenerationConfiguration\`** מוסיף את קוד הישויות של בקשת fullstack (ולא עושה דבר אחרת).
   - **\`LocalRunGenerationConfiguration\`** כותב את \`compose.yaml\` ואת פרופיל \`compose\` עבור התלויות שצריכות שירות.
4. **ZIP** מורכב ומוחזר. היצירה נרשמת ב-audit, מחוץ ל-thread של הבקשה.

### מה מסד הנתונים קובע, ומה release עושה
כל מה שאדמין עורך הוא שורה במסד הנתונים: תלויות והקבוצות שלהן, תרומות קבצים, תצורות build, אפשרויות משניות, כללי תאימות, תבניות starter ותבניות מודולים, סטי התבניות והדוגמאות של fullstack, פלטות, גרסאות, מחלקות, מקורות סכמה. שינוי שנשמר באדמין מגיע ליצירה הבאה ללא הפעלה מחדש.

חלק מהפלט נשלח עם האפליקציה עצמה ומשתנה רק עם release: תבניות הקוד של האשפים, שירותי ה-compose, ה-migrations של Flyway ב-fullstack, \`menora-model.json\` והכללים שבקשת fullstack נבדקת מולם. גם שורות קטלוג שאיש לא ערך עוקבות אחרי release — ראו **סנכרון קטלוג** תחת **פעולות ניהול**.`,
        callouts: [
          {
            type: 'info',
            text: 'מזהה התלות `__common__` הוא סנטינל מיוחד. תרומות קבצים ותצורות build המשויכות ל-`__common__` מיושמות על כל פרויקט שנוצר, ללא קשר לתלויות שהמשתמש בחר.'
          }
        ]
      },
      {
        id: 'overview-refresh',
        title: 'כפתור Refresh',
        description: 'למה משמש Refresh Data, עכשיו ששמירות באדמין מרעננות את הקטלוג בעצמן.',
        content: `### מטמון הקטלוג
ה-backend מחזיק את מטה-דאטה התלויות (קבוצות, רשומות, אפשרויות משניות, טווחי תאימות, גרסאות) בזיכרון, כדי שטופס המחולל לא יקרא את מסד הנתונים בכל בקשה.

### שמירות מרעננות אותו בשבילכם
כל שינוי שנעשה דרך מסכי האדמין — קבוצה, רשומה, אפשרות משנית, כלל תאימות, פלטה, גרסה, ייבוא, ביטול או שחזור מ-History — טוען מחדש את המטמון כחלק מהשמירה. בוחר התלויות מציג את השינוי בטעינה הבאה שלו; אין צורך ללחוץ על דבר.

### מתי ללחוץ Refresh Data
**Refresh Data** (בפינה הימנית-עליונה של האדמין, \`POST /admin/refresh\`) מיועד לשינויים שמסכי האדמין לא עשו — שורות שנערכו ישירות במסד הנתונים. הוא טוען מחדש את הקטלוג ומדווח על כל תלות שנאלץ לדלג עליה (טווח תאימות שגוי, scope לא מוכר…): שורה כזו הייתה אחרת פשוט נעלמת מהבוחר. אין צורך בהפעלה מחדש.

### מה לעולם לא נשמר במטמון
תרומות קבצים ותצורות build נקראות ממסד הנתונים בכל יצירה, כך ששינוי באחת מהן מגיע לפרויקט הבא שנוצר.`,
        callouts: [
          {
            type: 'tip',
            text: 'אם תלות שהוספתם אינה מופיעה בבוחר, לחצו Refresh Data וקראו את התשובה: תלות שנכשלת בטעינה מופיעה שם עם הסיבה.'
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
    title: 'קבוצות תלויות',
    icon: 'folder',
    topics: [
      {
        id: 'dep-groups-what',
        title: 'מה הן קבוצות?',
        description: 'קבוצות מארגנות תלויות לקטגוריות מסומנות בממשק.',
        content: `### מטרה
קבוצות תלויות הן ארגוניות בלבד — הן אינן משפיעות על מה שנוצר. הן קיימות כדי לקבץ תלויות קשורות תחת כותרת בבוחר התלויות (למשל "Data", "Messaging", "Security").

### קבוצות מובנות
המערכת זורעת את הקבוצות הבאות בהפעלה הראשונה: **Menora Standards**, **Web**, **Data**, **Messaging**, **Security**, **Observability**, **Communication** ו-**Utilities**.

קבוצות ורשומות תלות נזרעות פעם אחת, לתוך מסד נתונים ריק. בניגוד לתרומות קבצים ולתצורות build, הן אינן עוקבות אחרי release לאחר מכן (ראו **סנכרון קטלוג**): תלות ש-release חדש כולל מתווספת על ידי אדמין, או בייבוא קונפיגורציה.

### סדר תצוגה
קבוצות מופיעות בבוחר התלויות בסדר עולה של \`sortOrder\`. השתמשו בתכונת **גרירה לסדר מחדש** בלשונית Dep Groups באדמין — גררו שורה למיקום הרצוי, ולאחר מכן לחצו **Save Order**.`,
        fields: [
          { name: 'name', type: 'string', required: true, description: 'שם תצוגה המוצג ככותרת מקטע בבוחר התלויות. חייב להיות ייחודי.', example: 'Data' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר מיון עולה. ערכים נמוכים יותר מופיעים ראשונים. מנוהל דרך גרירה לסדר מחדש.', example: '2' }
        ]
      },
      {
        id: 'dep-groups-manage',
        title: 'יצירה ומחיקה של קבוצות',
        description: 'כיצד להוסיף, לערוך, לסדר מחדש ולמחוק קבוצות בבטחה.',
        content: `### יצירת קבוצה
1. לכו ל-**Config → Dep Groups**.
2. לחצו **New Group**.
3. הזינו **שם** וסדר מיון ראשוני אופציונלי.
4. לחצו **Save**. הקבוצה נכנסת לקטלוג של המחולל מיד.

### עריכת קבוצה
לחצו על סמל העיפרון בכל שורה כדי לפתוח את מגירת העריכה, שנו את השם ושמרו.

### סדר מחדש של קבוצות
לחצו וגררו את ידית האחיזה (⠿) בצד שמאל של כל שורה כדי לסדר מחדש. מופיע כפתור **Save Order** — לחצו עליו כדי לשמור את הרצף החדש.

### מחיקת קבוצה
לחצו על סמל האשפה. אם הקבוצה מכילה תלויות, תראו **אזהרת קונפליקט** המפרטת את הרשומות שיתייתמו. תוכלו:
- ללחוץ **Cancel** (ביטול) ולמחוק או להעביר תחילה את התלויות, או
- לסמן **Force delete** למחיקה מדורגת של כל תלויות הבנות (ותרומות הקבצים, תצורות ה-build וכו׳ המשויכות להן).`,
        callouts: [
          {
            type: 'warning',
            text: 'מחיקה בכוח של קבוצה מסירה את כל תלויות הבנות שלה וכל תרומת קובץ, תצורת build, אפשרות משנית וכלל המחוברים אליהן. כל שורה שהוסרה נרשמת בלשונית History, שם ניתן לבטל את המחיקה כולה כבקשה אחת.'
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
    title: 'רשומות תלויות',
    icon: 'widgets',
    topics: [
      {
        id: 'dep-entries-what',
        title: 'מה הן תלויות?',
        description: 'תלויות הן הפריטים הניתנים לבחירה במחולל הפרויקטים.',
        content: `### תפקיד במערכת
רשומת תלות מייצגת ספרייה או תכונה הניתנת לבחירה במחולל הפרויקטים. כאשר מפתח בוחר "Kafka", הוא בוחר את הרשומה עם \`depId = "kafka"\`. מזהה זה משמש לאחר מכן כמפתח זר עבור:

- **תרומות קבצים** — קבצים לכתיבה לפרויקט
- **תצורות Build** — הוספות תלות/מאגר Maven
- **אפשרויות משניות** — תוספות אופציונליות בתוך תלות זו
- **כללי תאימות** — קשרים עם תלויות אחרות

### שלושה סוגי רשומות
- **Spring Boot starter** — השאירו את קואורדינטות ה-Maven ריקות, ומסגרת Spring Initializr מוסיפה את \`org.springframework.boot:spring-boot-starter-<depId>\` (\`web\`, \`data-jpa\`, \`actuator\`…), כשהגרסה שלו מנוהלת על ידי Spring Boot. תנו לרשומה שם כזה רק כאשר ה-starter הזה קיים.
- **ספרייה** — מלאו \`mavenGroupId\`/\`mavenArtifactId\` (וגרסה כאשר ה-BOM של Boot אינו מנהל אותה); ה-artifact נכנס ל-pom.
- **אפשרות של קבצים בלבד** — סמנו **File-only option** (\`starter: false\`): דבר אינו מתווסף ל-pom, ובחירת הרשומה מביאה רק את תרומות הקבצים, תצורות ה-build והאפשרויות המשניות שלה. \`ldap-auth\`, \`ldap-auth-rest\`, \`logging\`, \`file-handler-utils\` ו-\`mail-sampler\` עובדות כך (תצורת ה-build של \`mail-sampler\` מוסיפה את \`spring-boot-starter-mail\`). הטופס מזהיר כאשר תצורת build מוסיפה תלות pom עבור ה-id, וזה בדיוק מה ש-\`mail-sampler\` צריכה.

### בוחר התלויות
רשומות מופיעות בבוחר התלויות מקובצות לפי הקבוצה האב שלהן, ומוסתרות כאשר גרסת ה-Boot הנבחרת מחוץ ל-\`compatibilityRange\` שלהן. בחירת המשתמש היא הסט של ערכי \`depId\` הנשלחים בבקשת היצירה כפרמטר \`dependencies\`; השרת מיישם עליה לאחר מכן את כללי התאימות (ראו **כללי תאימות**).

### קטלוגי Backend ו-Frontend
כל רשומה שייכת לקטלוג אחד (\`projectKind\`: BACKEND או FRONTEND). ה-pill בראש האדמין מחליף כל לשונית קטלוג בין השניים.`
      },
      {
        id: 'dep-entries-fields',
        title: 'עזר שדות',
        description: 'כל שדה ברשומת תלות מוסבר.',
        content: `### כל השדות`,
        fields: [
          { name: 'depId', type: 'string', required: true, description: 'מזהה ייחודי קריא למכונה. משמש כמפתח זר בתרומות קבצים, תצורות build, אפשרויות משניות וכללי תאימות. חייב להיות באותיות קטנות, ללא רווחים. לא ניתן לשנות לאחר היצירה מבלי לחבר מחדש את כל הרשומות הקשורות.', example: 'kafka' },
          { name: 'name', type: 'string', required: true, description: 'שם תצוגה קריא לאדם המוצג בבוחר התלויות.', example: 'Apache Kafka' },
          { name: 'description', type: 'string', required: false, description: 'תיאור קצר המוצג כטולטיפ או כטקסט משנה בבוחר התלויות.', example: 'Distributed event streaming via Apache Kafka' },
          { name: 'group', type: 'DependencyGroup', required: true, description: 'הקבוצה אליה שייכת תלות זו. קובעת באיזה מקטע של הבוחר היא מופיעה.', example: 'Messaging' },
          { name: 'mavenGroupId', type: 'string', required: false, description: 'מזהה קבוצת Maven. אם סופק, ה-artifact הזה יתווסף ל-pom.xml שנוצר.', example: 'org.springframework.kafka' },
          { name: 'mavenArtifactId', type: 'string', required: false, description: 'מזהה artifact של Maven.', example: 'spring-kafka' },
          { name: 'version', type: 'string', required: false, description: 'גרסת Maven מפורשת. השאירו ריק כדי לסמוך על ניהול הגרסאות של ה-BOM של Spring Boot.', example: '3.1.0' },
          { name: 'scope', type: 'string', required: false, description: 'scope של Maven. השאירו ריק עבור compile (ברירת מחדל). אפשרויות: runtime, provided, test, import.', example: 'runtime' },
          { name: 'repository', type: 'string', required: false, description: 'מזהה מאגר אם ה-artifact אינו ב-Maven Central. חייב להתאים למזהה מאגר המוגדר ב-application.yml או דרך BuildCustomization מסוג ADD_REPOSITORY.', example: 'menora-release' },
          { name: 'starter', type: 'boolean', required: false, description: 'האפשרות File-only option של הטופס, בהיפוך: false פירושו שדבר אינו מתווסף ל-pom עבור רשומה זו. ברירת מחדל true.', example: 'false' },
          { name: 'compatibilityRange', type: 'string', required: false, description: 'טווח גרסאות Spring Boot (לרשומת frontend, טווח React). אם מוגדר, התלות מוסתרת בממשק כאשר הגרסה הנבחרת מחוץ לטווח. ריק פירושו תואם לכל הגרסאות.', example: '[3.2.0,4.0.0)' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר תצוגה בתוך הקבוצה. ערכים נמוכים יותר מופיעים ראשונים.', example: '0' },
          { name: 'projectKind', type: 'BACKEND | FRONTEND', required: true, description: 'לאיזה קטלוג שייכת הרשומה — נקבע על ידי ה-pill של האדמין בעת יצירת הרשומה.', example: 'BACKEND' }
        ],
        codeExamples: [
          {
            title: 'תחביר טווח תאימות',
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
    title: 'תרומות קבצים',
    icon: 'description',
    topics: [
      {
        id: 'file-contrib-types',
        title: 'סוגי קבצים',
        description: 'ארבעת המצבים שתרומת קובץ יכולה לפעול בהם.',
        content: `### STATIC_COPY
כותב את התוכן כפי שהוא לנתיב היעד. ללא שינוי, ללא תחלופה (גם אם substitutionType מוגדר). משמש לקבצי טקסט תואמי בינארי שאמורים להיות זהים תמיד, ללא קשר להגדרות הפרויקט.

**דוגמאות לשימוש:** \`.editorconfig\`, \`entrypoint.sh\`, \`settings.xml\`

### YAML_MERGE
ממזג עמוק את תוכן ה-YAML לקובץ היעד. אם קובץ היעד אינו קיים עדיין, הוא נוצר. אם כבר יש בו תוכן (מתרומה קודמת או מהמסגרת), ה-YAML החדש ממוזג אליו מפתח אחר מפתח, כשמפות מקוננות ממוזגות רקורסיבית וערכים סקלריים נדרסים.

זוהי הדרך העיקרית שבה תלויות מרובות תורמות כל אחת את המקטע שלה ל-\`application.yaml\` מבלי לדרוס זו את זו.

**דוגמאות לשימוש:** מקטע ה-bootstrap-servers של Kafka, מקטע ה-datasource של JPA, קונפיגורציית נקודות הקצה של management.

### TEMPLATE
מיישם תחלופת משתנים על התוכן, ואז כותב אותו לנתיב היעד. כאשר \`substitutionType\` הוא MUSTACHE, התוכן עובר רינדור דרך מנוע Mustache אמיתי (\`com.samskivert:jmustache\`), מה שנותן לכם גם תחלופת משתנים וגם מקטעים מותנים (ראו להלן).

**דוגמאות לשימוש:** \`Dockerfile\` (צריך artifactId), \`KafkaConfig.java\` (צריך שם חבילה), \`k8s/values.yaml\` ו-\`log4j2-spring.xml\` (צריכים את המחלקה).

### DELETE
מסמן קובץ למחיקה. תורם המחיקות רץ בעדיפות הנמוכה ביותר (לאחר כל הכתיבות), ולכן הוא מסיר קבצים שהמסגרת או תורמים קודמים כתבו. אין צורך בשדה \`content\`.

**דוגמת שימוש:** מסגרת Spring Initializr תמיד כותבת \`application.properties\` ואת ה-Maven wrapper. פרויקטי Menora משתמשים ב-\`application.yaml\` ונבנים עם \`mvn\` ו-\`settings.xml\`, ולכן תרומות DELETE מסירות את \`application.properties\`, \`mvnw\`, \`mvnw.cmd\` ואת קובץ המאפיינים של ה-wrapper.

### נבדק בשמירה
שמירת תרומה בודקת את התוכן שלה לפי הסיומת של היעד (Java, YAML, XML, JSON, SQL, properties). TEMPLATE, או YAML_MERGE שמרונדר עם MUSTACHE, מרונדר תחילה כשכל המקטעים דלוקים, כך שגם תבנית שנשברת רק תחת צירוף אחד של תלויות נתפסת. נתיב היעד נבדק בעת יצירת פרויקט: נתיב שהיה יוצא מתיקיית הפרויקט (\`../\`) נדחה.`,
        callouts: [
          {
            type: 'tip',
            text: 'השתמשו ב-YAML_MERGE לכל קונפיגורציית application.yaml. כך כל אחת מהתלויות יכולה לתרום את המקטע שלה מבלי להתנגש — מנוע המיזוג מטפל בשילוב שלהן.'
          }
        ]
      },
      {
        id: 'file-contrib-substitution',
        title: 'תחלופת תבניות (Mustache)',
        description: 'משתנים, מקטעים ותוכן מותנה הזמינים בתרומות קבצים מסוג TEMPLATE.',
        content: `### סוגי תחלופה

תרומות \`TEMPLATE\` עוברות רינדור דרך מנוע Mustache אמיתי (\`com.samskivert:jmustache\`, עם HTML escaping מושבת). לשדה \`substitutionType\` יש שני ערכים:

- **NONE** (ברירת המחדל) — ללא תחלופה. התוכן נכתב כפי שהוא. השתמשו בו לקבצים שזהים בכל פרויקט (.editorconfig, entrypoint.sh, settings.xml).
- **MUSTACHE** — התוכן עובר רינדור דרך jmustache עם ההקשר המאוחד שלהלן. בחרו בו לכל תבנית עם משתנים או בלוקים מותנים.

### ההקשר המאוחד
כל תבנית MUSTACHE מקבלת את אותו ההקשר. **משתנים** מרונדרים כטקסט; **מקטעים** (\`{{#name}}…{{/name}}\`) מרנדרים את הגוף שלהם רק כאשר הערך בשם זה אמיתי (truthy); **מקטעים הפוכים** (\`{{^name}}…{{/name}}\`) מרונדרים רק כאשר הוא שקרי או חסר.

**משתני פרויקט:**
- \`{{artifactId}}\` — מזהה ה-artifact של הפרויקט (למשל \`demo\`)
- \`{{groupId}}\` — מזהה הקבוצה של הפרויקט (למשל \`com.menora\`)
- \`{{version}}\` — גרסת הפרויקט (למשל \`0.0.1-SNAPSHOT\`)
- \`{{packageName}}\` — חבילת הבסיס (למשל \`com.menora.demo\`)
- \`{{packagePath}}\` — שם החבילה עם נקודות מוחלפות בסלשים (למשל \`com/menora/demo\`)
- \`{{javaVersion}}\` — ה-JDK שהמשתמש בחר, למשל \`17\` או \`21\`
- \`{{packaging}}\` — \`jar\` או \`war\`
- \`{{department}}\`, \`{{departmentUpper}}\`, \`{{departmentName}}\` — המחלקה שהמפתח בחר (אחרת שורת ברירת המחדל של **Config → Departments**), למשל \`lts\` / \`LTS\`; ערכי ה-k8s, קונפיגורציית ה-log4j2 וה-namespace של Vault משתמשים בהם

**בוליאני תלויות** — \`has\` + PascalCase(depId). מקפים, קווים תחתונים ונקודות הם מפרידי מילים:
- \`{{#hasKafka}}…{{/hasKafka}}\` — מזהה תלות \`kafka\`
- \`{{#hasSecurity}}…{{/hasSecurity}}\` — מזהה תלות \`security\`
- \`{{#hasMailSampler}}…{{/hasMailSampler}}\` — מזהה תלות \`mail-sampler\`

**בוליאני אפשרויות משניות** — \`opt\` + PascalCase(depId) + PascalCase(optionId):
- \`{{#optKafkaConsumerExample}}…{{/optKafkaConsumerExample}}\` — kafka + האפשרות המשנית \`consumer-example\`
- \`{{#optMailSamplerSendMail}}…{{/optMailSamplerSendMail}}\` — mail-sampler + האפשרות המשנית \`send-mail\`

### משתני נתיב יעד
**נתיב היעד** (לא רק התוכן) יכול להכיל \`{{packagePath}}\`, שהוא שם החבילה עם נקודות מוחלפות בסלשים. זה ממקם קבצי מקור Java בתיקייה הנכונה ללא קשר לחבילה שהמשתמש בחר.

**דוגמה:** נתיב היעד \`src/main/java/{{packagePath}}/config/KafkaConfig.java\` הופך ל-\`src/main/java/com/menora/demo/config/KafkaConfig.java\` עבור החבילה \`com.menora.demo\`.

### למה מקטעים מותנים חשובים
לפני מקטעי Mustache, כל וריאציה דרשה שורת תרומת קובץ משלה. מחלקה שפולטת \`@EnableAsync\` רק כאשר האפשרות המשנית של async נבחרה דרשה שתי שורות עם אותו \`targetPath\` — אחת עם ה-annotation ואחת בלעדיה. מקטעי Mustache מאחדים אותן לשורה אחת, ומשאירים את קטלוג ה-DB פשוט יותר וקל יותר לתחזוקה.

### העמקה
עמוד זה הוא המבוא המהיר. לקטלוג המשתנים המלא בכל שלושת הקשרי הרינדור (תלות backend, ישות fullstack, frontend), לכללי נתיב-מול-תוכן ולמדריכי כתיבה — ראו את הסעיף **Mustache Templating**.`,
        codeExamples: [
          {
            title: 'משתנים — דוגמת Dockerfile',
            language: 'dockerfile',
            code: `FROM eclipse-temurin:{{javaVersion}}-jre-alpine
WORKDIR /app
COPY target/{{artifactId}}-{{version}}.jar app.jar
LABEL org.opencontainers.image.vendor="{{groupId}}"
ENTRYPOINT ["java", "-jar", "app.jar"]`
          },
          {
            title: 'שער תלות — MessagingConfig.java',
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
            title: 'שער אפשרות משנית — דוגמת @KafkaListener מותנית',
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
            title: 'application.yaml — שילוב שערי תלות ומשתנים',
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
            text: 'משתנים לא ידועים מרונדרים כמחרוזת ריקה — טעות הקלדה ב-{{hasKafak}} לא תפיק דבר, בשקט. הריצו grep על התבניות כשמוסיפים תלות חדשה כדי לבדוק את ההפניות.'
          },
          {
            type: 'info',
            text: 'תגי מקטע עצמאיים ({{#name}} / {{/name}} בשורה משלהם) מקצצים את הרווח הלבן שסביבם לפי מפרט Mustache, ושומרים על Java שנוצר נקי. שימו את התוכן באותה שורה של התג אם אתם צריכים לשמור שורה חדשה מפורשת.'
          }
        ]
      },
      {
        id: 'file-contrib-common',
        title: 'תלות __common__',
        description: 'כיצד לתרום קבצים לכל פרויקט שנוצר.',
        content: `### מה __common__ אומר
כאשר \`dependencyId\` של תרומת קובץ מוגדר ל-\`__common__\`, היא מוזרקת ל**כל** פרויקט שנוצר, ללא קשר לתלויות שהמפתח בחר.

כך Menora מבטיחה שלכל הפרויקטים תמיד יש:
- \`src/main/resources/application.yaml\` — קובץ הבסיס (TEMPLATE, \`sortOrder\` -1, כך שכל YAML_MERGE נוחת עליו)
- \`Dockerfile\` (TEMPLATE, שורה אחת לכל גרסת Java)
- \`k8s/Jenkinsfile\` ו-\`k8s/values.yaml\` (TEMPLATE)
- \`entrypoint.sh\`, \`.editorconfig\`, \`settings.xml\` (STATIC_COPY)
- \`VERSION\` (TEMPLATE)
- \`log4j2-spring.xml\`, \`logFormat.json\`, \`detailedLogFormat.json\` (TEMPLATE)
- חיבור ה-Vault המקומי: \`.env\`, \`application-vault-local.yaml\`, \`config/VaultLocalEnvironmentPostProcessor.java\` וה-\`META-INF/spring.factories\` שרושם אותו (TEMPLATE)
- מחיקה של \`application.properties\`, \`mvnw\`, \`mvnw.cmd\` ו-\`.mvn/wrapper/maven-wrapper.properties\` (DELETE)

### מתי להשתמש ב-__common__
השתמשו ב-\`__common__\` כאשר הקובץ אמור להיות בכל פרויקט. השתמשו ב-\`depId\` ספציפי כאשר הקובץ רלוונטי רק כאשר אותה תלות נבחרת.`,
        callouts: [
          {
            type: 'info',
            text: 'גם תצורות build תומכות ב-__common__. כך כל פרויקט מקבל את מאגרי ה-Artifactory, את Log4j2 במקום Logback (עם ה-layout של JSON), את Lombok, את ה-BOM של spring-cloud (שורה אחת לכל טווח Boot) ואת ה-starter של Vault.'
          }
        ]
      },
      {
        id: 'file-contrib-filtering',
        title: 'סינון לפי גרסת Java ואפשרות משנית',
        description: 'כיצד להפוך קובץ למותנה בגרסת Java או באפשרות משנית.',
        content: `### שדה javaVersion
אם לתרומת קובץ יש \`javaVersion\` שאינו ריק, היא תיכלל רק כאשר גרסת ה-Java הנבחרת של הפרויקט תואמת בדיוק.

זה מאפשר לכם להחזיק מספר גרסאות של אותו קובץ עבור JDKs שונים. למשל, ה-\`Dockerfile\` משתמש ב-image בסיס של Java 17 לעומת image בסיס של Java 21.

**כיצד להגדיר קבצים ספציפיים לגרסה:**
1. צרו תרומה אחת עם \`targetPath = "Dockerfile"\`, \`javaVersion = "17"\`, ותוכן ה-image של Java 17.
2. צרו תרומה נוספת עם אותו \`targetPath\`, \`javaVersion = "21"\`, ותוכן ה-image של Java 21.
3. השאירו את \`javaVersion\` ריק אם אתם רוצים קובץ לכל הגרסאות.

### שדה subOptionId
אם לתרומת קובץ יש \`subOptionId\` שאינו ריק, היא תיכלל רק כאשר המשתמש בחר את האפשרות המשנית הזו עבור התלות האב.

**דוגמה:** לקובץ \`KafkaConsumerExample.java\` יש \`subOptionId = "consumer-example"\` ו-\`dependencyId = "kafka"\`. הוא מופיע רק כאשר המשתמש בוחר את האפשרות המשנית "Consumer Example" תחת התלות Kafka.`,
        fields: [
          { name: 'dependencyId', type: 'string', required: true, description: 'ה-depId של התלות האב, או `__common__` לכל הפרויקטים.', example: 'kafka' },
          { name: 'fileType', type: 'FileType', required: true, description: 'כיצד התוכן מטופל: STATIC_COPY, YAML_MERGE, TEMPLATE או DELETE.', example: 'YAML_MERGE' },
          { name: 'targetPath', type: 'string', required: true, description: 'נתיב הפלט בתוך הפרויקט שנוצר. עשוי להכיל {{packagePath}} עבור קבצי מקור Java.', example: 'src/main/java/{{packagePath}}/config/KafkaConfig.java' },
          { name: 'content', type: 'text', required: false, description: 'תוכן הקובץ. לא נדרש לסוג DELETE. בסוג TEMPLATE, השתמשו במשתני תחלופה.', example: 'package {{packageName}}.config;' },
          { name: 'substitutionType', type: 'SubstitutionType', required: false, description: 'מצב תחלופת המשתנים: NONE (התוכן נכתב כפי שהוא) או MUSTACHE (מרונדר עם jmustache — המשתנים {{artifactId}}, {{groupId}}, {{version}}, {{packageName}}, {{packagePath}}, {{javaVersion}}, {{packaging}}, ומקטעים בוליאניים כגון {{#hasKafka}}…{{/hasKafka}} או {{#optKafkaConsumerExample}}…{{/optKafkaConsumerExample}}).', example: 'MUSTACHE' },
          { name: 'javaVersion', type: 'string', required: false, description: 'אם מוגדר, תרומה זו חלה רק כאשר גרסת ה-Java של הפרויקט תואמת. השאירו ריק לכל הגרסאות. (שורות backend.)', example: '21' },
          { name: 'nodeVersion', type: 'string', required: false, description: 'המקביל של javaVersion ב-frontend: השורה חלה רק כאשר גרסת ה-Node הנבחרת תואמת. ל-Dockerfile של ה-frontend יש שורה אחת לכל גרסת Node. מוגדר בקבצי הקטלוג או בייבוא; טופס האדמין מציג רק את Java Version.', example: '20' },
          { name: 'subOptionId', type: 'string', required: false, description: 'אם מוגדר, תרומה זו חלה רק כאשר המשתמש בוחר את האפשרות המשנית הזו תחת התלות האב.', example: 'consumer-example' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר העיבוד. חשוב כאשר תרומות מרובות מכוונות לאותו קובץ (למשל כמה YAML_MERGE לאותו application.yaml).', example: '0' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // BUILD CUSTOMIZATIONS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'build-customizations',
    title: 'תצורות Build',
    icon: 'build',
    topics: [
      {
        id: 'build-custom-types',
        title: 'סוגי תצורות',
        description: 'ארבעת הסוגים של ה-backend (pom.xml) ושלושת הסוגים של ה-frontend (package.json, Vite).',
        content: `### ADD_DEPENDENCY
מוסיף רשומת Maven \`<dependency>\` ל-\`pom.xml\` שנוצר. דורש \`mavenGroupId\` ו-\`mavenArtifactId\`. הגרסה אופציונלית (תלויות שמנוהלות על ידי BOM אינן צריכות גרסה).

כאשר ה-build כבר מכיל תלות עם אותן קואורדינטות — רשומת הקטלוג עצמה — השורה **מחליפה** אותה במקום להוסיף שנייה. כך תלות אחת מקבלת גרסה אחרת בקו אחר של Spring Boot: ל-\`openapi\` (springdoc) יש שורה בטווח \`[3.4.0,4.0.0)\` שמחליפה אותה ב-2.8.x ב-Boot 3.4 ואילך.

**דוגמאות לשימוש:**
- הוספת \`spring-boot-starter-log4j2\` כתחליף ל-Logback
- הוספת \`lombok\` לכל פרויקט
- הוספת \`spring-boot-starter-mail\` כאשר התלות mail-sampler נבחרת

### EXCLUDE_DEPENDENCY
מוסיף Maven \`<exclusion>\` לתלות. משמש להסרת תלויות טרנסיטיביות המתנגשות עם ההוספות שלכם.

דורש:
- \`excludeFromGroupId\` + \`excludeFromArtifactId\` — ה-artifact שאליו מוסיפים את ההוצאה
- \`mavenGroupId\` + \`mavenArtifactId\` — התלות הטרנסיטיבית שמוציאים

השורה כותבת בעצמה את ה-artifact של "exclude from", ולכן היא **מוסיפה את ה-artifact הזה כאשר ה-build עדיין לא מכיל אותו**. כך כל פרויקט מקבל את \`spring-cloud-starter-vault-config\` (ללא \`httpclient5\`).

**דוגמת שימוש:** הוצאת \`spring-boot-starter-logging\` (Logback) מ-\`spring-boot-starter\` כדי שלא יתנגש עם Log4j2.

### ADD_REPOSITORY
מוסיף רשומת Maven \`<repository>\` ל-\`pom.xml\` שנוצר. ה-\`repoId\` חייב להיות ייחודי ומשמש כ-\`<id>\` ב-XML.

**דוגמת שימוש:** הוספת מאגרי ה-release וה-snapshot של Menora Artifactory, כדי שהפרויקט שנוצר יוכל לפתור artifacts פנימיים.

### ADD_BOM
מייבא BOM לתוך \`<dependencyManagement>\` (\`<type>pom</type><scope>import</scope>\`). דורש \`mavenGroupId\`, \`mavenArtifactId\` ו-\`version\`. הגרסה נכתבת למאפיין pom שנקרא על שם ה-artifact — \`spring-cloud-dependencies\` → \`<spring-cloud.version>\` — וה-BOM מפנה אליו.

**דוגמת שימוש:** ייבוא \`spring-cloud-dependencies\` כך ש-\`spring-cloud-starter-vault-config\` (חיבור ה-Vault המקומי שכל backend כולל) אינו צריך גרסה משלו. יש שלוש שורות כאלה, אחת לכל טווח Boot (2023.0.3 ל-3.2–3.3, 2024.0.3 ל-3.4, 2025.0.3 ל-3.5).

### אילו שורות חלות
שורה חלה כאשר התלות שלה נבחרה (או שהיא \`__common__\`), וגם:
- אין לה \`subOptionId\`, או שהאפשרות המשנית הזו נבחרה (קטלוג ה-frontend משתמש בזה כדי להוסיף חבילה רק עם אפשרות);
- אין לה \`compatibilityRange\`, או שגרסת ה-Spring Boot של הפרויקט נמצאת בתוכו.

### סוגי Frontend
כאשר ה-pill של האדמין על **Frontend**, הלשונית מנהלת את שורות קטלוג ה-frontend, שמשתמשות מחדש באותן עמודות:
- **ADD_NPM_DEPENDENCY** — תלות ב-\`package.json\`: \`mavenArtifactId\` = שם החבילה, \`version\` = טווח semver, \`scope\` = \`dev\` עבור \`devDependencies\`.
- **ADD_VITE_PLUGIN** — plugin ב-\`vite.config.ts\`: \`mavenGroupId\` = נתיב ה-import, \`mavenArtifactId\` = ה-binding, \`version\` = ביטוי הקריאה.
- **ADD_NPM_SCRIPT** — סקריפט ב-\`package.json\`: \`mavenArtifactId\` = השם, \`version\` = הפקודה.

תצורות build נקראות בכל יצירה; שורה שנשמרה מגיעה לפרויקט הבא.`,
        fields: [
          { name: 'dependencyId', type: 'string', required: true, description: 'ה-depId של התלות האב, או `__common__` להחלה על כל הפרויקטים.', example: '__common__' },
          { name: 'customizationType', type: 'CustomizationType', required: true, description: 'ב-Backend: ADD_DEPENDENCY, EXCLUDE_DEPENDENCY, ADD_REPOSITORY, ADD_BOM. ב-Frontend: ADD_NPM_DEPENDENCY, ADD_VITE_PLUGIN, ADD_NPM_SCRIPT.', example: 'ADD_DEPENDENCY' },
          { name: 'compatibilityRange', type: 'string', required: false, description: 'טווח ה-Spring Boot שהשורה חלה עליו; ריק = כל גרסה. הטופס מציע אותו עבור ADD_DEPENDENCY ו-ADD_BOM.', example: '[3.4.0,4.0.0)' },
          { name: 'subOptionId', type: 'string', required: false, description: 'השורה חלה רק כאשר האפשרות המשנית הזו של התלות שלה נבחרה. טופס האדמין מציג אותו לשורות frontend; גם שורות backend מכבדות אותו.', example: 'comp-dialog' },
          { name: 'scope', type: 'string', required: false, description: 'בשורות npm של frontend: dev מכניס את החבילה ל-devDependencies.', example: 'dev' },
          { name: 'mavenGroupId', type: 'string', required: false, description: 'עבור ADD_DEPENDENCY: הקבוצה של ה-artifact. עבור EXCLUDE_DEPENDENCY: הקבוצה של התלות הטרנסיטיבית שמוציאים.', example: 'org.springframework.boot' },
          { name: 'mavenArtifactId', type: 'string', required: false, description: 'עבור ADD_DEPENDENCY: מזהה ה-artifact. עבור EXCLUDE_DEPENDENCY: מזהה ה-artifact של התלות שמוציאים.', example: 'spring-boot-starter-log4j2' },
          { name: 'version', type: 'string', required: false, description: 'גרסת Maven עבור ADD_DEPENDENCY (השאירו ריק אם מנוהלת על ידי BOM), או גרסת ה-BOM עבור ADD_BOM.', example: '' },
          { name: 'excludeFromGroupId', type: 'string', required: false, description: 'EXCLUDE_DEPENDENCY בלבד: מזהה הקבוצה של ה-artifact שאליו מוסיפים את בלוק ההוצאה.', example: 'org.springframework.boot' },
          { name: 'excludeFromArtifactId', type: 'string', required: false, description: 'EXCLUDE_DEPENDENCY בלבד: מזהה ה-artifact שאליו מוסיפים את בלוק ההוצאה.', example: 'spring-boot-starter' },
          { name: 'repoId', type: 'string', required: false, description: 'ADD_REPOSITORY: מזהה מאגר ייחודי (משמש כ-<id> ב-pom.xml).', example: 'menora-release' },
          { name: 'repoName', type: 'string', required: false, description: 'ADD_REPOSITORY: שם מאגר קריא לאדם.', example: 'Menora Artifactory Releases' },
          { name: 'repoUrl', type: 'string', required: false, description: 'ADD_REPOSITORY: כתובת ה-URL של המאגר.', example: 'https://repo.menora.co.il/artifactory/libs-release' },
          { name: 'snapshotsEnabled', type: 'boolean', required: false, description: 'ADD_REPOSITORY: האם לאפשר פתרון snapshots ממאגר זה. ברירת מחדל: false.', example: 'false' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר העיבוד בין התצורות של אותה תלות.', example: '0' }
        ],
        codeExamples: [
          {
            title: 'דוגמה: החלפת Logback ב-Log4j2 (נדרשות שתי רשומות)',
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
    title: 'אפשרויות משניות',
    icon: 'tune',
    topics: [
      {
        id: 'sub-options-what',
        title: 'מה הן אפשרויות משניות?',
        description: 'דגלי תכונות אופציונליים בתוך תלות.',
        content: `### מושג
אפשרויות משניות מאפשרות למשתמשים לבחור תוספות אופציונליות כאשר הם בוחרים תלות. למשל, בחירת Kafka מציגה תיבות סימון עבור "Consumer Example" ו-"Producer Example" — אלו מייצרות מחלקות consumer/producer לדוגמה בפרויקט.

אפשרויות משניות הן תוספות בלבד: הן פותחות (gate) תרומות קבצים ותצורות build שנושאות את ה-\`optionId\` שלהן כ-\`subOptionId\`, והן מדליקות דגלי \`opt<Dep><Option>\` שהתבניות קוראות. שלושה סוגים נזרעים:
- **קוד לדוגמה** — דוגמאות ה-consumer/producer/streams של Kafka, ה-REST controller וה-exception handler של \`web\`, שלד ה-JWT של \`security\`, וכן הלאה.
- **תפקידי datasource** — לכל מסד נתונים (\`postgresql\`, \`mssql\`, \`oracle\`, \`db2\`, \`h2\`, \`mongodb\`) יש \`<db>-primary\` ו-\`<db>-secondary\`, שבוחרות את מחלקת קונפיגורציית ה-datasource שלו. תבניות ה-starter בוחרות אחת ראשית.
- **אפשרויות Frontend** — בקטלוג ה-frontend, למשל רכיבי shadcn (\`comp-dialog\`, \`comp-toast\`…), שכל אחד מהם מוסיף את חבילת ה-npm שלו.

### מוסכמת URL
אפשרויות משניות מועברות לנקודת הקצה של היצירה כפרמטרי query:

\`opts-{depId}=opt1,opt2\`

לדוגמה: \`opts-kafka=consumer-example,producer-example\`

ה-frontend בונה פרמטרים אלו אוטומטית כאשר המשתמש מסמן תיבות של אפשרויות משניות.

### כיצד אפשרויות משניות פותחות קבצים ושורות build
בתרומת קובץ או בתצורת build, הגדירו \`subOptionId\` ל-\`optionId\` של האפשרות המשנית. השורה חלה אז רק אם פרמטר ה-\`opts-{depId}\` המתאים כולל את ה-optionId הזה.

אפשרויות משניות נזרעות פעם אחת, כמו רשומות תלות: אפשרות חדשה ש-release כולל מתווספת על ידי אדמין או בייבוא.`,
        fields: [
          { name: 'dependencyId', type: 'string', required: true, description: 'ה-depId של התלות האב שאליה שייכת אפשרות משנית זו.', example: 'kafka' },
          { name: 'optionId', type: 'string', required: true, description: 'מזהה ייחודי לאפשרות משנית זו בתוך התלות. משמש בפרמטרי URL וכמפתח זר בתרומות קבצים.', example: 'consumer-example' },
          { name: 'label', type: 'string', required: true, description: 'תווית תצוגה המוצגת ליד תיבת הסימון בממשק.', example: 'Consumer Example' },
          { name: 'description', type: 'string', required: false, description: 'טולטיפ או טקסט עזרה המסביר מה אפשרות משנית זו מייצרת.', example: 'Generates a sample @KafkaListener class' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר תצוגה בין האפשרויות המשניות של אותה תלות.', example: '0' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // COMPATIBILITY RULES
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'compatibility',
    title: 'כללי תאימות',
    icon: 'compare_arrows',
    topics: [
      {
        id: 'compat-types',
        title: 'סוגי כללים',
        description: 'REQUIRES, CONFLICTS ו-RECOMMENDS מוסברים.',
        content: `### REQUIRES
תלות המקור **דורשת** את תלות היעד. לשונית Backend מציגה באנר שמציע להוסיף את היעד. השרת מוסיף אותו לכל בקשה שיש בה את המקור ולא את היעד (כאשר היעד מוצע עבור גרסת ה-Boot של הבקשה). דרישות משתרשרות: \`ldap-auth-rest\` מביאה את \`web\`, וכל מה ש-\`web\` דורשת היה מגיע בעקבותיה.

**דוגמאות:** \`rqueue REQUIRES data-jpa\`, \`security REQUIRES web\`, \`tracing REQUIRES actuator\`, \`ldap-auth-rest REQUIRES web\`.

### CONFLICTS
תלויות המקור והיעד הן **בלעדיות הדדית**. לשונית Backend מזהירה כל עוד שתיהן נבחרות; השרת דוחה בקשה כזו עם 400 שמציין את שתיהן ואת התיאור של הכלל. הוא לעולם לא משמיט אחת מהן בשקט: זה היה מייצר פרויקט שונה מזה שהתבקש. גם התנגשות שדרישה מביאה נחשבת — \`webflux\` + \`security\` נכשל, כי \`security\` דורשת את \`web\`.

**דוגמאות:** \`web CONFLICTS webflux\`, \`ldap-auth-rest CONFLICTS ldap-auth\`.

### RECOMMENDS
תלות המקור **ממליצה** על היעד. הממשק מציג הצעה, ודבר אינו משנה את הבקשה.

**דוגמה:** \`data-jpa RECOMMENDS postgresql\` — JPA זקוק לדרייבר מסד נתונים; PostgreSQL הוא הסטנדרט של החברה.

### היכן הכללים חלים
בכל endpoint של backend — \`/starter.zip\`, האשף, multi-module (פעם אחת, על מה שהתבקש, לא לכל מודול) ו-fullstack — בין אם הבקשה הגיעה מהממשק, מ-curl, מ-IntelliJ או מקישור שיתוף שנערך ידנית. כללי קטלוג ה-frontend מיושמים על ידי מחולל ה-frontend, שבמקום זאת מתקן את הבחירה בשקט. הכללים נזרעים פעם אחת; כללים חדשים של release מתווספים על ידי אדמין או בייבוא.`,
        fields: [
          { name: 'sourceDepId', type: 'string', required: true, description: 'ה-depId של התלות המגדירה את הכלל (ה"מקור").', example: 'rqueue' },
          { name: 'targetDepId', type: 'string', required: true, description: 'ה-depId של התלות שהכלל חל עליה (ה"יעד").', example: 'data-jpa' },
          { name: 'relationType', type: 'RelationType', required: true, description: 'REQUIRES, CONFLICTS או RECOMMENDS.', example: 'REQUIRES' },
          { name: 'description', type: 'string', required: false, description: 'הסבר קריא לאדם מדוע כלל זה קיים. מוצג בטולטיפ של גרף התאימות.', example: 'RQueue uses JPA to persist message queue state' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר תצוגה ברשימת האדמין ובגרף.', example: '0' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // STARTER TEMPLATES
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'starter-templates',
    title: 'תבניות Starter',
    icon: 'view_cozy',
    topics: [
      {
        id: 'starter-what',
        title: 'מה הן תבניות Starter?',
        description: 'תכניות פרויקט מוגדרות מראש למקטע Quick Start.',
        content: `### מטרה
תבניות Starter הן הגדרות פרויקט מוכנות בלחיצה אחת, המופיעות במקטע **Quick Start** של המחולל. לחיצה על תבנית ממלאת מראש את טופס הפרויקט בסט תלויות אצור (ובאפשרויות משניות). המשתמש עדיין יכול לשנות את הבחירה לפני היצירה.

### תבניות מובנות
Backend:
- **REST API Service** — Spring Web, JPA, DB2 (datasource ראשי), Actuator, Kafka Log Shipping
- **Event-Driven Service** — Kafka (עם דוגמאות consumer ו-producer), JPA, PostgreSQL (ראשי), Actuator, Kafka Log Shipping
- **Microservice (Full Stack)** — Web, Kafka, JPA, PostgreSQL (ראשי), Security, Actuator, Prometheus, Kafka Log Shipping

ללשונית Frontend יש תבניות משלה (\`fe-dashboard\`, \`fe-marketing\`, \`fe-saas-app\`); ה-pill של האדמין מחליף את לשונית Templates בין השתיים.

### תבנית לעומת יצירה ישירה
תבנית רק בוחרת תלויות מראש. אם המשתמש משנה את בחירת התלויות לאחר לחיצה על תבנית, הפלט שנוצר משקף את הבחירה הסופית שלו, ולא את הגדרת התבנית.

### תבניות לעומת Team Presets
תבניות Starter נאצרות כאן על ידי אדמינים. מפתחים יכולים גם לשמור הגדרה שלמה של לשונית Backend — טופס, תלויות, אפשרויות, מודולים ומסמכי אשף — כ-**team preset** שכולם רואים בלשונית Team של רצועת ה-Presets. Team presets אינם שורות קטלוג: הם אינם באדמין, ב-History או בייצוא הקונפיגורציה.`,
        fields: [
          { name: 'templateId', type: 'string', required: true, description: 'מזהה ייחודי קריא למכונה. מוצג בכתובת ה-URL בעת שיתוף קישור לתבנית.', example: 'rest-api' },
          { name: 'name', type: 'string', required: true, description: 'שם תצוגה המוצג על כרטיס התבנית.', example: 'REST API Service' },
          { name: 'description', type: 'string', required: false, description: 'תיאור קצר המוצג מתחת לשם התבנית.', example: 'Spring Web + JPA + PostgreSQL + Actuator' },
          { name: 'icon', type: 'string', required: false, description: 'שם אייקון של Material Symbols (למשל "api", "bolt", "hub"). ראו את ספריית Material Symbols לשמות הזמינים.', example: 'api' },
          { name: 'color', type: 'string', required: false, description: 'קוד צבע hex לצבע ההדגשה של כרטיס התבנית.', example: '#4CAF50' },
          { name: 'bootVersion', type: 'string', required: false, description: 'דריסת גרסת Spring Boot של ברירת המחדל עבור תבנית זו. השאירו ריק כדי להשתמש בברירת המחדל של המערכת.', example: '' },
          { name: 'javaVersion', type: 'string', required: false, description: 'דריסת גרסת Java של ברירת המחדל עבור תבנית זו.', example: '21' },
          { name: 'packaging', type: 'string', required: false, description: 'דריסת האריזה של ברירת המחדל (jar/war) עבור תבנית זו.', example: 'jar' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר התצוגה של כרטיסי התבניות במקטע Quick Start.', example: '0' }
        ]
      },
      {
        id: 'starter-deps',
        title: 'תלויות תבנית',
        description: 'כיצד לצרף תלויות (עם אפשרויות משניות) לתבנית.',
        content: `### רשומות תלות של תבנית
כל תלות בתבנית היא רשומה נפרדת המקשרת את התבנית ל-\`depId\`. ניתן גם לציין אפשרויות משניות לבחירה מראש.

### ניהול תלויות התבנית
בלשונית האדמין **Templates**, התלויות של כל התבניות הן טבלה נפרדת, **Template Dependencies**, מתחת לתבניות. **New Dep Mapping** מצרף רשומת תלות לתבנית. הזינו אופציונלית \`subOptions\` מופרדות בפסיקים (התואמות לערכי optionId מטבלת האפשרויות המשניות).

### דוגמה
תבנית: "Event-Driven Service"
- \`depId = kafka\`, \`subOptions = "consumer-example,producer-example"\`
- \`depId = data-jpa\`

כאשר מפתח לוחץ על תבנית זו, Kafka נבחר מראש עם שתי אפשרויות הדוגמה מסומנות, וגם JPA נבחר מראש.`,
        fields: [
          { name: 'template', type: 'StarterTemplate', required: true, description: 'התבנית האב שאליה שייכת רשומה זו.', example: 'rest-api' },
          { name: 'depId', type: 'string', required: true, description: 'התלות שנכללת בתבנית זו.', example: 'kafka' },
          { name: 'subOptions', type: 'string', required: false, description: 'ערכי optionId מופרדים בפסיקים לבחירה מראש עבור תלות זו. חייבים להתאים לאפשרויות המשניות הרשומות עבור ה-depId.', example: 'consumer-example,producer-example' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // MODULE TEMPLATES
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'module-templates',
    title: 'תבניות מודולים',
    icon: 'account_tree',
    topics: [
      {
        id: 'module-what',
        title: 'פרויקטים מרובי מודולים',
        description: 'כיצד תכונת יצירת הפרויקטים מרובי המודולים עובדת.',
        content: `### מה זה יצירת פרויקט מרובה מודולים?
על ידי הפעלת מתג **Multi-Module** בממשק המחולל, המפתח יכול לייצר פרויקט Maven מרובה מודולים — POM הורה ועוד שניים או יותר תת-מודולים (למשל \`myapp-api\`, \`myapp-core\`, \`myapp-persistence\`).

### כיצד זה עובד
1. המפתח מפעיל את המתג ובוחר אילו מודולים לכלול (\`GET /starter-multimodule.zip?modules=api,core,persistence&…\`).
2. כללי התאימות מוחלים פעם אחת, על התלויות שהמפתח בחר.
3. ה-backend מייצר כל מודול באופן עצמאי באמצעות צינור המודול הבודד הסטנדרטי, עם התלויות של המודול עצמו מטבלת **Module Dependency Mappings** (מיפויי תלות-מודול) ועוד כל תלות שנבחרה.
4. רק המודול עם \`hasMainClass = true\` מקבל \`@SpringBootApplication\` ואת מחלקת הבדיקה. משאר המודולים הקבצים האלה מוסרים.
5. נוצר \`pom.xml\` הורה עם \`<packaging>pom</packaging>\` ומקטע \`<modules>\` המפרט את כל מזהי ה-artifact של תת-המודולים.
6. שורש הפרויקט מקבל \`menora-model.json\` (אחד לכל הפרויקט), \`.gitattributes\` ו — כשתלות צריכה שירות — \`compose.yaml\`, עם פרופיל \`compose\` במודול הכניסה.
7. הכל נדחס יחד תחת ספריית הפרויקט ברמה העליונה.

בקשה שלא נוקבת באף מודול מוכר היא 400.

### מודולים והאשפים
בקשה עם מסמך אשף (SQL, OpenAPI, WSDL או AsyncAPI) הולכת ל-endpoint של האשף, שתמיד כותב מודול **אחד**: לקוד של האשף אין מודול להיכנס אליו. לשונית ה-Backend מציגה אזהרה מעל רשימת המודולים כל עוד מודולים מסומנים ולתלות שנבחרה מוגדר אשף; במקרה כזה המודולים לא נוצרים.

### מזהי Artifact של מודולים
מזהה ה-artifact של כל מודול = \`{project artifactId}{module suffix}\`

עבור פרויקט עם \`artifactId = "myapp"\` ומודול עם \`suffix = "-api"\`, מזהה ה-artifact של המודול הוא \`myapp-api\`.`,
        callouts: [
          {
            type: 'warning',
            text: 'בדיוק מודול אחד צריך לקבל hasMainClass = true. אם אף אחד לא מקבל, לפרויקט שנוצר לא תהיה נקודת כניסה ראשית של Spring Boot (וגם לא פרופיל compose). אם כמה מקבלים, כל אחד מהם שומר מחלקת main והראשון נחשב לנקודת הכניסה.'
          }
        ]
      },
      {
        id: 'module-fields',
        title: 'שדות תבנית מודול',
        description: 'קונפיגורציה של תבניות מודולים בודדות.',
        content: `### ישות תבנית מודול`,
        fields: [
          { name: 'moduleId', type: 'string', required: true, description: 'מזהה ייחודי למודול זה. משמש כמפתח זר במיפויי תלות-מודול.', example: 'api' },
          { name: 'label', type: 'string', required: true, description: 'שם התצוגה המוצג בממשק בוחר המודולים.', example: 'API Layer' },
          { name: 'description', type: 'string', required: false, description: 'הסבר קצר על תפקיד מודול זה.', example: 'REST controllers, DTOs, web layer' },
          { name: 'suffix', type: 'string', required: true, description: 'מצורף ל-artifactId של הפרויקט ליצירת מזהה ה-artifact של מודול זה.', example: '-api' },
          { name: 'packaging', type: 'string', required: true, description: 'סוג אריזת Maven למודול זה. בדרך כלל jar. השתמשו ב-war רק עבור מודולי שכבת web בתרחישי פריסה מסוימים.', example: 'jar' },
          { name: 'hasMainClass', type: 'boolean', required: true, description: 'הגדירו ל-true עבור המודול האחד שצריך להכיל @SpringBootApplication. כל שאר המודולים חייבים להיות false.', example: 'true' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר התצוגה בבוחר המודולים.', example: '0' }
        ]
      },
      {
        id: 'module-mappings',
        title: 'מיפויי תלות-מודול',
        description: 'הקצאת תלויות למודולים ספציפיים.',
        content: `### מטרה
מיפויי תלות-מודול קובעים אילו תלויות נכללות אוטומטית ב-\`pom.xml\` שנוצר לכל מודול.

לדוגמה:
- מודול **api** → \`web\`, \`security\`, \`actuator\` (ה-controllers של REST צריכים אותן)
- מודול **persistence** → \`data-jpa\`, \`postgresql\` (שכבת מסד הנתונים צריכה אותן)
- מודול **core** → \`logging\` (כלי עזר משותפים)

### כיצד להגדיר
בלשונית האדמין **Modules**, המיפויים הם הטבלה **Module Dependency Mappings** שמתחת לתבניות המודולים. **New Mapping** יוצר שיוך תלות-מודול.

### תלויות גלובליות לעומת ספציפיות למודול
תלויות שהמפתח בוחר בממשק המחולל מוחלות על כל המודולים. מיפויי תלות-מודול הם תלויות נוספות הנכללות אוטומטית רק במודול שצוין. רשימת התלויות הסופית של מודול = (תלויות שהמשתמש בחר) ∪ (מיפויים ספציפיים למודול).`,
        fields: [
          { name: 'dependencyId', type: 'string', required: true, description: 'ה-depId של התלות שיש לכלול במודול זה.', example: 'data-jpa' },
          { name: 'moduleId', type: 'string', required: true, description: 'ה-moduleId של המודול שאליו משייכים את התלות.', example: 'persistence' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר העיבוד. בדרך כלל 0 לכל המיפויים.', example: '0' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // VERSIONS, DEPARTMENTS & PALETTES
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'versions-departments',
    title: 'גרסאות, מחלקות ולוחות צבעים',
    icon: 'numbers',
    topics: [
      {
        id: 'versions-what',
        title: 'רשימות הגרסאות',
        description: 'אילו גרסאות של Java, Spring Boot, React, Node ומנהל החבילות המחולל מציע.',
        content: `### מה הן
**Config → Versions** מחזיק כל רשימת גרסאות ששלוש הלשוניות מציעות, שורה לכל גרסה: \`JAVA\` (21, 17), \`BOOT\` (3.2.1, 3.5.16), \`REACT\` (18, 19), \`NODE\` (20, 22, 18) ו-\`PACKAGE_MANAGER\` (pnpm, npm). שורה אחת מכל סוג היא **ברירת המחדל**: מה שטופס נפתח איתו, ומה שמקבלת בקשת API שלא נוקבת בגרסה (\`/starter.zip\`, האשף, ה-endpoints של multi-module ו-fullstack כאחד). גרסה שבקשה נוקבת בה ואינה ברשימה היא 400.

### קידום גרסה
כדי לעבור ל-patch release חדש יותר ש-Artifactory משקף, ערכו את השורה (למשל \`3.5.16\` → \`3.5.17\`). גרסת Boot קובעת אילו שורות עם טווח חלות — ה-\`compatibilityRange\` של רשומות התלות ושל תצורות ה-build — לכן בדקו את הטווחים האלה כשמוסיפים קו גרסאות חדש. שורת React נושאת את טווחי ה-npm שנכתבים ל-\`package.json\` (\`npmSemver\`, \`typesSemver\`).

גרסאות חדשות ש-release מביא נוספות בעלייה; שורה שאדמין ערך נשמרת.`,
        fields: [
          { name: 'kind', type: 'JAVA | BOOT | REACT | NODE | PACKAGE_MANAGER', required: true, description: 'לאיזו רשימה השורה שייכת.', example: 'BOOT' },
          { name: 'versionId', type: 'string', required: true, description: 'הערך שנשלח בבקשות ונכתב לפרויקטים.', example: '3.5.16' },
          { name: 'displayName', type: 'string', required: true, description: 'מה שהבוחר מציג.', example: 'Node 20 (LTS)' },
          { name: 'isDefault', type: 'boolean', required: false, description: 'ברירת המחדל של הסוג שלה (אחת לכל סוג).', example: 'true' },
          { name: 'enabled', type: 'boolean', required: false, description: 'שורה מושבתת אינה מוצעת.', example: 'true' },
          { name: 'npmSemver / typesSemver', type: 'string', required: false, description: 'שורות React: הטווחים של react/react-dom ושל חבילות ה-@types שלהן.', example: '^18.3.1' }
        ]
      },
      {
        id: 'departments-what',
        title: 'מחלקות',
        description: 'רשימת המחלקות שמאחורי משתני המחלקה בכל תבנית.',
        content: `### מה הן
**Config → Departments** היא הרשימה שממנה מפתחים בוחרים את המחלקה שלהם בכל לשונית. המחלקה נכתבת לפרויקטים שנוצרים דרך \`{{department}}\`, \`{{departmentUpper}}\` ו-\`{{departmentName}}\`: ערכי ה-k8s, קונפיגורציית הלוגים ו-namespace ה-Vault (\`<department>/int-lan-01\`) משתמשים בה. בקשה שלא נוקבת במחלקה, או נוקבת במחלקה שאינה ברשימה, מקבלת את שורת **ברירת המחדל** (\`lts\` מוזרעת). המחלקה נרשמת גם ב-audit של היצירה, שם לשונית ה-Activity מפלחת לפיה את היצירות.`
      },
      {
        id: 'palettes-what',
        title: 'לוחות צבעים',
        description: 'ערכות הצבעים שאפשר לבנות איתן frontends שנוצרים.',
        content: `### מה הם
**Config → Palettes** (מוצג עם תווית האדמין ב-**Frontend**) מפרט את ערכות הצבעים שלשוניות ה-Frontend וה-Fullstack מציעות: צבע ראשי, משני, וצבעי accent ו-error אופציונליים. לוח הצבעים שנבחר מגיע לתבניות ה-frontend כ-\`{{palette.*}}\` (עם צורות HSL למשתני CSS). לוח אחד הוא ברירת המחדל. מערכת העיצוב Menora Digital מתעלמת מצבעי המותג של הלוח (אצלה הם tokens קבועים) אבל עדיין לוקחת ממנו את ה-accent וה-error.`
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
        title: 'איך הרינדור עובד',
        description: 'המנוע, התחביר הנתמך, החלפת נתיב-מול-תוכן, ושלושת ההקשרים.',
        content: `### המנוע
התבניות מרונדרות עם **jmustache** (\`com.samskivert:jmustache\`), מקומפלות פעם אחת לכל קובץ עם בריחת HTML **כבויה** (\`Mustache.compiler().escapeHTML(false)\`). אותה הגדרה משמשת בכל נתיבי הרינדור — תבניות תלות backend, תבניות frontend, ותבניות ישות fullstack.

מכיוון שהבריחה כבויה, אנו פולטים Java, YAML, Dockerfile ו-TypeScript מילולית — תווים כמו \`<\`, \`>\`, \`&\`, \`"\` עוברים כמו שהם. תוצאה מעשית אחת: **\`{{{triple}}}\` ו-\`{{double}}\` שקולים כאן.** השתמשו בסוגריים כפולים.

### תחביר נתמך
- \`{{var}}\` — הזרקת ערך. **מפתח חסר מרונדר כמחרוזת ריקה, לא כשגיאה.**
- \`{{#flag}}…{{/flag}}\` — מקטע. מרנדר את הגוף כאשר \`flag\` אמיתי (\`true\`, רשימה לא ריקה, ערך לא-null ולא-false).
- \`{{^flag}}…{{/flag}}\` — מקטע הפוך. מרנדר את הגוף כאשר \`flag\` שקרי (\`false\`, \`null\`, רשימה ריקה). זהו ענף ה-"else".
- \`{{#list}}…{{/list}}\` — איטרציה. הגוף מרונדר פעם לכל איבר, עם המפתחות של אותו איבר בהיקף.
- \`{{.}}\` — האיבר הנוכחי עצמו, בתוך רשימת סקלרים.
- \`{{!comment}}\` — הערה; לא מרונדרת.

### נתיב מול תוכן — שתי החלפות שונות
לתרומת קובץ יש **נתיב יעד** ו**גוף תוכן**, והם מרונדרים בכללים שונים:
- **תוכן** מרונדר עם ההקשר המלא (כאשר \`substitutionType = MUSTACHE\`).
- **נתיב יעד** מקבל החלפה צרה וקשיחה — נתיבי backend מכבדים רק את \`{{packagePath}}\`; נתיבי frontend רק את \`{{projectName}}\`. נתיבי תבניות ישות fullstack הם היוצא מן הכלל: הנתיב **כן** מרונדר דרך הקשר הישות המלא.

לכן \`{{javaVersion}}\` עובד בתוך התוכן של קובץ backend אבל **לא** בנתיב היעד שלו.

### שלושה הקשרים, לא אחד
אין הקשר גלובלי יחיד. שלושה בנאים נפרדים יוצרים כל אחד מפת משתנים, ואיזה מהם רץ תלוי באיזה קובץ אתם עורכים — תבניות תלות backend, תבניות ישות fullstack, או תבניות frontend. העמודים הבאים מתעדים כל אחד.`,
        codeExamples: [
          {
            title: 'מקטע + מקטע הפוך (תבנית ה-if/else)',
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
            text: 'מפתח חסר או מאוית שגוי מרונדר ריק, בשקט — ללא שגיאה. אם ערך יוצא ריק בקובץ שנוצר, חשדו בשגיאת כתיב בשם המשתנה ובדקו אותו מול עמודי הקטלוג.'
          },
          {
            type: 'info',
            text: 'בריחת HTML כבויה בכל מקום, כך שסוגריים {{{triple}}} אף פעם לא נחוצים — סוגריים {{double}} כבר פולטים טקסט גולמי.'
          }
        ]
      },
      {
        id: 'mustache-which-context',
        title: 'באיזה הקשר אני נמצא?',
        description: 'מצאו את הקובץ שאתם עורכים כדי לדעת אילו משתנים זמינים.',
        content: `### בחרו לפי הקובץ שאתם עורכים
המשתנים הזמינים תלויים לחלוטין בנתיב הרינדור שהקובץ שייך אליו:

- **תוכן \`catalog/file-contributions.json\`** (קבצי תלות backend, למשל \`templates/h2-config-primary.mustache\`) → **הקשר תלות Backend** בלבד.
- **תוכן \`catalog/frontend/file-contributions.json\`** (קבצי תלות frontend) → **הקשר Frontend** בלבד.
- **קבצי \`templates/fullstack/<backend-set>/\`** (למשל \`spring-jpa-crud\`) → **הקשר ישות Fullstack** (בתוספת דגלי \`optScaffold*\` ו-\`hasValidation\`).
- **קבצי \`templates/fullstack/<frontend-set>/\`** (למשל \`react-tailwind-crud\`) → **הקשר ישות Fullstack ממוזג עם הקשר Frontend** — תבניות אלה רואות גם משתני ישות וגם משתני dep/palette/version של frontend.

### דגלים אוניברסליים
מוסכמה אחת חוצה כל הקשר: לכל תלות שנבחרה נקבע בוליאני \`has<Dep>\`; לכל אפשרות משנה שנבחרה, \`opt<Dep><Option>\`. אלה הבדיקות "האם X נבחר?" בכל מקום. משתני המחלקה (\`department\`, \`departmentUpper\`, \`departmentName\`) נמצאים גם הם בכל הקשר.

### לא ניתן לעריכה כאן
הקוד של האשפים (\`templates/wizard/**\` — ישויות SQL, controllers ו-clients של OpenAPI, endpoints של SOAP, producers ו-listeners של Kafka, ה-POM ההורה של multi-module) הוא גם Mustache, אבל אלה קבצים שמגיעים עם האפליקציה, לא שורות קטלוג: הם כתובים מול view-model של Java שעריכת אדמין לא הייתה יכולה לעקוב אחריו, ולכן הם משתנים רק עם release.`
      },
      {
        id: 'mustache-backend-context',
        title: 'הקשר תלות Backend',
        description: 'משתנים לכל קובץ TEMPLATE של backend (buildBaseContext).',
        content: `### מקור
\`DynamicProjectGenerationConfiguration.buildBaseContext(...)\`. זהו ההקשר לכל קובץ \`TEMPLATE\` של backend המוצהר ב-\`catalog/file-contributions.json\`, כולל מחלקות קונפיגורציית ה-datasource של H2/Oracle/Postgres.

### דגלי תלות ואפשרות משנה
לכל תלות **שנבחרה** נקבע בוליאני \`has<Dep>\` ל-true; לכל אפשרות משנה שנבחרה, \`opt<Dep><Option>\`. לתלויות שלא נבחרו אין מפתח כלל (כך ש-\`{{#hasKafka}}\` פשוט שקרי כש-kafka לא נבחר). ההמרה id → דגל היא PascalCase, כשהתווים \`-\`, \`_\` ו-\`.\` הם מפרידי מילים:

- \`kafka\` → \`hasKafka\`
- \`mail-sampler\` → \`hasMailSampler\`
- \`spring-boot-starter\` → \`hasSpringBootStarter\`
- אפשרות המשנה \`consumer-example\` של \`kafka\` → \`optKafkaConsumerExample\`

### משפחת ה-ds* (datasource מבונה)
\`hasScaffoldedEntities\`, \`dsEntityPackage\` ו-\`dsRepositoryPackage\` קיימים כדי שקונפיגורציית datasource לכל דרייבר תסרוק **היכן הישויות שנוצרו באמת נמצאות** במקום מוסכמת \`<packageName>.<driver>\` קשיחה. הם מאוכלסים רק כשהבקשה מבנה ישויות (fullstack **או** אשף ה-SQL); אחרת \`hasScaffoldedEntities\` שקרי ושני מפתחות החבילה הם null. זו בדיוק הסיבה שתבנית ה-H2 מזווגת ענף \`{{#hasScaffoldedEntities}}\` עם נפילה-לאחור \`{{^hasScaffoldedEntities}}\` — ראו את ההדרכה על H2Config.

פרויקט fullstack שם ישויות גם מחוץ לשתי החבילות האלה (קבצים מצורפים, תצוגות שמורות, היסטוריית שינויים, ה-outbox של האירועים). \`dsExtraPackages\` מפרט אותן ו-\`dsHasExtraPackages\` אומר אם יש כאלה; כל תבנית \`*-config-primary\` חייבת לסרוק גם אותן, אחרת האפליקציה לא עולה.`,
        fields: [
          { name: '{{artifactId}}', type: 'String', required: true, description: 'ה-artifact id של הפרויקט.', example: 'demo' },
          { name: '{{groupId}}', type: 'String', required: true, description: 'ה-group id של הפרויקט.', example: 'com.menora' },
          { name: '{{version}}', type: 'String', required: true, description: 'גרסת הפרויקט.', example: '0.0.1-SNAPSHOT' },
          { name: '{{packageName}}', type: 'String', required: true, description: 'חבילת הבסיס, בצורה מנוקדת.', example: 'com.menora.demo' },
          { name: '{{packagePath}}', type: 'String', required: true, description: 'packageName עם נקודות שהוחלפו בסלשים. ההצבה היחידה המותרת גם בנתיבי יעד.', example: 'com/menora/demo' },
          { name: '{{javaVersion}}', type: 'String', required: true, description: 'גרסת ה-JDK שנבחרה.', example: '21' },
          { name: '{{packaging}}', type: 'String', required: false, description: 'מזהה ה-packaging; null אם לא הוגדר.', example: 'jar' },
          { name: '{{department}} / departmentUpper / departmentName', type: 'String', required: true, description: 'המחלקה שהבקשה נקבה בה, אחרת שורת ברירת המחדל של Config → Departments.', example: 'lts / LTS / LTS' },
          { name: 'has<Dep>', type: 'boolean', required: false, description: 'true לכל תלות שנבחרה (id ב-PascalCase). נעדר כשלא נבחרה.', example: 'hasKafka' },
          { name: 'opt<Dep><Option>', type: 'boolean', required: false, description: 'true לכל אפשרות משנה שנבחרה (dep + option ב-PascalCase).', example: 'optKafkaConsumerExample' },
          { name: '{{hasScaffoldedEntities}}', type: 'boolean', required: true, description: 'true כשהבקשה מבנה ישויות (fullstack או אשף SQL).', example: 'true' },
          { name: '{{dsEntityPackage}}', type: 'String', required: false, description: 'החבילה שאליה נוחתות הישויות שנוצרו; null אלא אם hasScaffoldedEntities.', example: 'com.menora.demo.entity' },
          { name: '{{dsRepositoryPackage}}', type: 'String', required: false, description: 'החבילה שאליה נוחתים ה-repositories שנוצרו; null אלא אם hasScaffoldedEntities.', example: 'com.menora.demo.repository' },
          { name: '{{dsExtraPackages}} / dsHasExtraPackages', type: 'List / boolean', required: true, description: 'חבילות נוספות שמחזיקות את הישויות וה-repositories של פרויקט fullstack עצמו (קבצים מצורפים, תצוגות, היסטוריה, אירועים); ריק בכל מקרה אחר.', example: '{{#dsExtraPackages}}, "{{.}}"{{/dsExtraPackages}}' }
        ],
        codeExamples: [
          {
            title: 'שער datasource — סריקת חבילות מבונות או נפילה-לאחור',
            language: 'java',
            code: `@EnableJpaRepositories(
    basePackages = "{{#hasScaffoldedEntities}}{{dsRepositoryPackage}}{{/hasScaffoldedEntities}}{{^hasScaffoldedEntities}}{{packageName}}.h2.repository{{/hasScaffoldedEntities}}"
)`
          }
        ]
      },
      {
        id: 'mustache-fullstack-context',
        title: 'הקשר ישות Fullstack',
        description: 'משתנים לערכות תבניות ישות (EntityScaffoldContext): פרויקט, לכל-ישות, שדות, יחסים.',
        content: `### מקור
\`EntityScaffoldContext\`, נבנה בשני שלבים — \`buildProjectContext\` (כלל-פרויקט) ו-\`buildEntityContext\` (כלל-פרויקט בתוספת ישות אחת). ה-view-model עצמו מפוצל לפי תחום למחלקות שלידו: \`EntityViewModel\`, \`FieldViewModel\`, \`RelationViews\`, \`FeatureContext\`, \`PageContext\`, \`DashboardContext\`, \`TemplateText\`, \`SchemaNames\`. קובץ \`perEntity: true\` מרונדר פעם לכל ישות משתמש; קובץ \`perPage: true\` פעם לכל עמוד ב-layout; כל קובץ אחר פעם אחת עם הקשר הפרויקט (ויכול לעבור על כל הישויות דרך \`{{#entities}}\`).

### חבילות שכבה (כלל-פרויקט)
לכל אחת יש גם וריאנט בצורת סלש \`…Path\`: \`entityPackage\` / \`entityPackagePath\`, \`repositoryPackage\`, \`dtoPackage\`, \`servicePackage\`, \`controllerPackage\`, כולן נגזרות מ-\`domainPackage\` (ברירת מחדל \`packageName\`). טבלת ה-\`fields\` למטה מפרטת את המפתחות לכל-ישות.

### משתנים לכל-שדה (בתוך {{#fields}}, {{#pkFields}}, …)
\`name\`, \`Name\` (PascalCase), \`column\`, \`javaType\`, \`tsType\`, \`enumTypeName\`; פרדיקטים \`isPrimaryKey\`, \`isGenerated\`, \`isRequired\`, \`isUnique\`, \`isString\`, \`isNumeric\`, \`isIntegral\`, \`isBigDecimal\`, \`isBoolean\`, \`isTemporal\`, \`isDate\`, \`isDateTime\`, \`isEnum\`, \`isReadOnly\`; אילוצים \`hasLength\`/\`length\`, \`hasMin\`/\`min\`, \`hasMax\`/\`max\`, \`hasPattern\`/\`pattern\`/\`patternEscaped\`, \`isEmail\`; \`enumValues\` (כל אחד עם ה-\`label\` שלו); ערכי ברירת מחדל (\`hasDefault\`, \`defaultJava\`, \`defaultTs\`); ודגלי איטרציה \`first\`/\`last\`.

### יחסים — שלוש רשימות
- \`{{#relations}}\` — **המפתחות הזרים** (MANY_TO_ONE): \`fieldName\`, \`FieldName\`, \`fkFieldName\`, \`joinColumn\`, \`targetEntity\` (+ \`Camel\`/\`Kebab\`/\`KebabPlural\`), \`targetPkName\`/\`targetPkJavaType\`/\`targetPkTsType\`, \`targetLabelField\`/\`hasTargetLabel\`, \`required\`, \`last\`.
- \`{{#collections}}\` / \`hasCollections\` — קישורי MANY_TO_MANY דרך טבלת join.
- \`{{#childLists}}\` / \`hasChildLists\` — ONE_TO_MANY: השורות של ישות אחרת שמצביעות על ישות זו (אחת מסוג \`composition\` נערכת בטופס של ישות זו).

### אפשרויות scaffold
כל ערך ב-\`opts.scaffold\` של הבקשה הופך לדגל \`optScaffold<Option>\` בשני נתיבי הרינדור, מרשימה אחת (\`ScaffoldOption\`): \`audit\`, \`softDelete\`, \`csvExport\`, \`bulkDelete\`, \`bulkUpdate\`, \`tests\`, \`csvImport\`, \`optimisticLocking\`, \`inlineEdit\`, \`xlsxExport\`, \`savedViews\`, \`history\`, \`events\` (כל אלה גם לכל ישות, דרך דריסות ה-\`opts\` של הישות), \`inverseCollections\`, \`openapi\`, \`seedData\`. \`secured\` הוצא משימוש: הגישה היא עכשיו רמות ה-\`access\` של כל ישות, נאכפות בכל פעם שתלות ldap-auth נמצאת ב-build. התבניות קוראות בעיקר את הדגלים הנגזרים לכל ישות ולא את האפשרות הגולמית — \`auditApplicable\`, \`softDeleteApplicable\`, \`lockingApplicable\`, \`importApplicable\`… — שמביאים בחשבון גם ישויות לקריאה בלבד, views ומפתחות מורכבים. בנוסף \`hasValidation\` בנתיב ה-backend.

### Layouts של עמודים
הקשר ה-frontend נושא גם את ה-layout (\`pages\`, \`navPages\`, \`routePages\`, ה-view-model לכל עמוד שקובץ \`perPage\` מרונדר איתו, רשימות ווידג׳טים…). הוא גדול ומשתנה בכל סבב; \`backend/docs/MUSTACHE_GUIDE.md\` (§4f) מפרט אותו.`,
        fields: [
          { name: '{{EntityName}} / entityName / entity_name / entityNameKebab', type: 'String', required: true, description: 'שם הישות ב-Pascal / camel / snake / kebab. לכל אחד קיים גם וריאנט ברבים.', example: 'OrderItem / orderItem / order_item / order-item' },
          { name: '{{tableName}}', type: 'String', required: true, description: 'דריסת שם הטבלה או נפילה-לאחור ל-snake ברבים.', example: 'order_items' },
          { name: '{{entityPackage}} / entityPackagePath', type: 'String', required: true, description: 'חבילת שכבת הישות (וצורת הסלש). אותה תבנית ל-repository/dto/service/controller.', example: 'com.menora.demo.entity' },
          { name: '{{fields}} / nonPkFields / pkFields / stringFields', type: 'List', required: true, description: 'view-models של שדות לאיטרציה; pkField הוא קיצור ה-PK היחיד (עשוי להיות null).', example: '{{#fields}}…{{/fields}}' },
          { name: '{{hasCompositePk}} / keyClassName / pkType / pkPath', type: 'mixed', required: true, description: 'דגל מפתח מורכב, שם מחלקת ה-<Entity>Id שנוצרת, טיפוס ה-id, ומקטע נתיב ה-REST.', example: '/{orderId}/{lineNo}' },
          { name: '{{relations}} / hasRelations', type: 'List / boolean', required: true, description: 'יחסי מפתח זר MANY_TO_ONE.', example: '{{#relations}}…{{/relations}}' },
          { name: '{{collections}} / hasCollections', type: 'List / boolean', required: true, description: 'קישורי MANY_TO_MANY דרך טבלת join.', example: '{{#collections}}…{{/collections}}' },
          { name: '{{childLists}} / hasChildLists', type: 'List / boolean', required: true, description: 'רשימות ONE_TO_MANY של שורות הילד שמצביעות על ישות זו (כולל זו ש-inverseCollections גוזר).', example: '{{#childLists}}…{{/childLists}}' },
          { name: 'has*Fields aggregates', type: 'boolean', required: true, description: 'hasEnumFields, hasStringFields, hasNotNullFields, hasSizeFields, hasMinFields, hasMaxFields, hasDecimalMinFields, hasDecimalMaxFields, hasPatternFields, hasEmailFields — true אם ורק אם שדה כלשהו זקוק לאותו import.', example: 'hasEmailFields' },
          { name: 'optScaffold<Option>', type: 'boolean', required: false, description: 'דגל אחד לכל ערך של opts.scaffold (ScaffoldOption), נפתר לכל ישות מול הדריסות שלה.', example: 'optScaffoldAudit' },
          { name: '<feature>Applicable', type: 'boolean', required: false, description: 'האם אפשרות באמת חלה על ישות זו (ניתנת לכתיבה, מגובה בטבלה, מפתח יחיד… לפי מה שהאפשרות צריכה).', example: 'softDeleteApplicable' },
          { name: '<key>Ts / <key>Attr / <key>Jsx / <key>Comment', type: 'String', required: false, description: 'טקסט שהמשתמש הקליד (תוויות, כותרת וסקירה של הדשבורד) עם בריחה למחרוזת TS, ל-attribute של JSX, לילדי JSX או להערה. תבניות frontend משתמשות באלה, לעולם לא ב-{{label}} הגולמי.', example: '{{entityLabelTs}}' }
        ],
        codeExamples: [
          {
            title: 'רשומת manifest — שער קובץ עם gatedBy',
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
            title: 'תבנית ישות — איטרציה על שדות',
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
            text: 'תוויות הן מה שהמשתמש הקליד, כולל גרשיים וגרש בעברית. תבנית frontend ששותלת {{label}}, {{entityLabel}}, {{entityLabelPlural}}, {{dashboardTitle}} או {{dashboardOverview}} גולמיים עלולה לייצר פרויקט שלא מתקמפל; השתמשו בצורות עם הבריחה (…Ts, …Attr, …Jsx). בדיקה ב-backend נכשלת על שתילה גולמית בתבנית שמגיעה עם המוצר; תבנית שנערכה באדמין לא נבדקת.'
          },
          {
            type: 'info',
            text: 'gatedBy מקבל כל דגל הקשר אמיתי — אפשרות opt-in כמו optScaffoldTests או דגל נגזר כמו hasCompositePk (בשימוש שורת EntityId.java) או apiTestApplicable.'
          }
        ]
      },
      {
        id: 'mustache-frontend-context',
        title: 'הקשר Frontend',
        description: 'משתנים לקבצי TEMPLATE של frontend (FrontendMustacheContext).',
        content: `### מקור
\`FrontendMustacheContext.build(...)\`. מזין כל קובץ \`TEMPLATE\` של frontend ב-\`catalog/frontend/file-contributions.json\`, וממוזג להקשר הישות עבור תבניות frontend של fullstack.

### דגלי תלות / palette
אותה מוסכמת \`has<Dep>\` / \`opt<Dep><Option>\` ב-PascalCase כמו ב-backend (למשל \`hasRouterReactRouter\`, \`optAuthMsalInitConfig\`). לוח הצבעים הוא מפת \`palette\` מקוננת — \`palette.primary\`, \`palette.secondary\`, \`palette.accent\`, \`palette.error\`, בתוספת צורות \`*Hsl\` למשתני CSS — ומגודר על ידי \`hasPaletteAccent\` / \`hasPaletteError\`.

### שפה וכיווניות
\`isRtl\` הוא true ל-frontend מימין לשמאל. ב-frontend של fullstack, \`locale\` (\`en\` או \`he\`) ו-\`isHebrew\` בוחרים את המילים של האפליקציה שנוצרת עצמה. גם משתני המחלקה נמצאים כאן.

### שערוּר לפי גרסת Node
המקבילה לשערוּר \`javaVersion\` ב-backend: תרומת קובץ frontend עם \`nodeVersion\` מדולגת אלא אם היא תואמת לגרסת ה-Node שנבחרה. שורה ללא \`nodeVersion\` חלה על כל הגרסאות. זה מאפשר לנתיב יעד אחד (למשל \`Dockerfile\`) להיפתר לשורת תוכן שונה לכל גרסת Node — וגרסה ללא שורה תואמת לא מייצרת קובץ כלל.`,
        fields: [
          { name: '{{projectName}} / appTitle / packageJsonName', type: 'String', required: true, description: 'זהות הפרויקט; packageJsonName הוא scoped או רגיל.', example: '@menora/demo-ui' },
          { name: '{{reactVersion}} / reactPackageVersion / reactTypesVersion', type: 'String', required: true, description: 'גרסאות React ו-@types.', example: '^19.0.0' },
          { name: '{{nodeVersion}}', type: 'String', required: true, description: 'גרסת ה-major של Node שנבחרה.', example: '20' },
          { name: '{{packageManager}} / isNpm / isPnpm', type: 'String / boolean', required: true, description: 'מנהל החבילות ודגלי נוחות.', example: 'npm' },
          { name: '{{typescriptVersion}} / viteVersion / basePath', type: 'String', required: true, description: 'גרסאות הכלים ונתיב הבסיס של האפליקציה.', example: '/' },
          { name: '{{apiBaseUrl}} / backendArtifactId / hasBackendPair / hasBackendArtifactId', type: 'mixed', required: true, description: 'מידע על ה-backend המזווג; hasBackendPair הוא true כש-apiBaseUrl מוגדר.', example: 'http://localhost:8080' },
          { name: '{{palette.*}}', type: 'Map', required: true, description: 'id, name, primary, secondary, accent, error, וצורות *Hsl למשתני CSS.', example: '{{palette.primary}}' },
          { name: '{{hasPaletteAccent}} / hasPaletteError', type: 'boolean', required: true, description: 'שערים לצבעי ה-accent/error האופציונליים.', example: 'true' },
          { name: 'has<Dep> / opt<Dep><Option>', type: 'boolean', required: false, description: 'אותה מוסכמת דגלי בחירה כמו בהקשר ה-backend.', example: 'hasRouterReactRouter' }
        ]
      },
      {
        id: 'mustache-h2-walkthrough',
        title: 'הדרכה: פענוח H2Config',
        description: 'קריאת h2-config-primary.mustache האמיתי שורה אחר שורה.',
        content: `### התבנית
\`templates/h2-config-primary.mustache\` היא תבנית תלות backend (הקשר תלות Backend), מוצגת למטה.

### קריאתה
- \`{{#hasScaffoldedEntities}}…{{/hasScaffoldedEntities}}\` — ה**מקטע** מרונדר רק כשישויות בונו (בקשת fullstack, או אשף ה-SQL). בענף הזה הוא פולט \`{{dsRepositoryPackage}}\` / \`{{dsEntityPackage}}\` — החבילות שבהן ה-repositories/הישויות שנוצרו באמת נחתו (\`<domainPackage>.repository\` / \`<domainPackage>.entity\`).
- \`{{^hasScaffoldedEntities}}…{{/hasScaffoldedEntities}}\` — ה**מקטע ההפוך** הוא ה-"else": כששום דבר לא בונה, שני המפתחות האלה הם null, אז התבנית נופלת-לאחור למוסכמה הישנה \`{{packageName}}.h2.repository\` / \`{{packageName}}.h2\`.

- \`{{#dsExtraPackages}}, "{{.}}"{{/dsExtraPackages}}\` — **מקטע רשימה**: פעם לכל חבילה נוספת שפרויקט fullstack מחזיק בה ישויות, הוא מוסיף את אותה חבילה. \`basePackages\` הופך למערך (\`{ … }\`) רק כשיש כאלה (\`dsHasExtraPackages\`), כך שפרויקט רגיל שומר על המחרוזת היחידה שלו.

כך פרויקט רגיל (לא-fullstack) מקבל \`com.menora.demo.h2.repository\`; פרויקט fullstack מקבל את החבילה המבונה האמיתית ועוד חבילות התמיכה שלו. המפתחות נקבעים יחד ב-\`buildBaseContext\`. הקונפיגורציות של Oracle, PostgreSQL, SQL Server ו-DB2 בנויות באותה תבנית.`,
        codeExamples: [
          {
            title: 'h2-config-primary.mustache (קטע)',
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
        title: 'הדרכה: הוספה ושערוּר של תבניות',
        description: 'כתבו קובץ TEMPLATE חדש, שערו תוכן, ושערו קובץ לפי גרסה.',
        content: `### מנופי שערוּר (מהגס לעדין)
1. **קובץ שלם לפי תלות** — ה-\`dependencyId\` של שורה משייך אותה לאותה תלות (\`__common__\` = כל פרויקט).
2. **קובץ שלם לפי אפשרות משנה** — קבעו \`subOptionId\` בשורה; הקובץ נכתב רק כשאותה אפשרות משנה נבחרת (כך \`KafkaConsumerExample.java\` של Kafka נושא \`subOptionId: "consumer-example"\`).
3. **בלוק בתוך קובץ** — שערו עם מקטע באמצעות \`has<Dep>\` / \`opt<Dep><Option>\`. עבור תבניות ישות fullstack, השער ברמת הקובץ הוא דגל ה-\`gatedBy\` ב-manifest.

### קבצים משוערים לפי גרסה
\`targetPath\` אחד, תוכן שונה לכל runtime: ה-framework בוחר את השורה שה-\`javaVersion\` (backend) או ה-\`nodeVersion\` (frontend) שלה תואם; עמודה null משמעה "כל הגרסאות". למשל שתי שורות שמכוונות שתיהן ל-\`Dockerfile\`, אחת \`javaVersion: "17"\` ואחת \`"21"\`.

### שתי דרכים להכניס
- **באדמין** — **Config → File Contribs → New Contribution**: השורה פעילה כבר ביצירה הבאה. היא השורה שלכם: release מאוחר יותר לא דורס אותה.
- **ב-release** — הוסיפו את קובץ התבנית ושורה ב-\`catalog/file-contributions.json\`. מסד נתונים חדש מוזרע איתה, ומסד קיים מקבל אותה מ**סנכרון הקטלוג** כשה-release עולה (שורה חדשה שמגיעה עם המוצר מתווספת; שורה כזו שאיש לא ערך עוקבת אחרי התוכן החדש).`,
        workflowSteps: [
          { title: 'כתבו את התוכן', description: 'צרו src/main/resources/templates/my-feature-config.mustache באמצעות משתני הקשר תלות Backend ({{packageName}}, {{artifactId}}, {{javaVersion}}, מקטעי has<Dep>).' },
          { title: 'רשמו את השורה', description: 'הוסיפו רשומה ל-catalog/file-contributions.json: depId, fileType TEMPLATE, contentResource, targetPath עם {{packagePath}}, substitutionType MUSTACHE.' },
          { title: 'או הוסיפו אותה בזמן ריצה', description: 'למופע רץ, בלי release: Config → File Contribs → New Contribution עם אותם שדות (או POST /admin/file-contributions). אין צורך ב-refresh.' },
          { title: 'אימות', description: 'בצעו curl ל-starter.zip עם התלות הרלוונטית ופרסו את קובץ היעד כדי לאמת את הפלט המרונדר.' }
        ],
        codeExamples: [
          {
            title: 'file-contributions.json — שורת TEMPLATE חדשה',
            language: 'json',
            code: `{ "depId": "security", "fileType": "TEMPLATE", "contentResource": "templates/my-feature-config.mustache", "targetPath": "src/main/java/{{packagePath}}/config/MyFeatureConfig.java", "substitutionType": "MUSTACHE", "sortOrder": 10 }`
          },
          {
            title: 'שערוּר לפי גרסה — שתי שורות, Dockerfile אחד',
            language: 'json',
            code: `{ "depId": "__common__", "fileType": "TEMPLATE", "contentResource": "templates/Dockerfile-java17.mustache", "targetPath": "Dockerfile", "substitutionType": "MUSTACHE", "javaVersion": "17", "sortOrder": 5 }
{ "depId": "__common__", "fileType": "TEMPLATE", "contentResource": "templates/Dockerfile-java21.mustache", "targetPath": "Dockerfile", "substitutionType": "MUSTACHE", "javaVersion": "21", "sortOrder": 6 }`
          }
        ],
        callouts: [
          {
            type: 'tip',
            text: 'שערוּר בלוקים עם {{#hasSecurity}}…{{/hasSecurity}} מכווץ את מה שפעם דרש כמה שורות כמעט-זהות לתבנית אחת.'
          }
        ]
      },
      {
        id: 'mustache-gotchas',
        title: 'מלכודות ומפת מקור',
        description: 'קצוות חדים שכדאי לזכור, והיכן כל הקשר נבנה ב-backend.',
        content: `### מלכודות
- **{{{ }}} שווה ל-{{ }}** — בריחת HTML כבויה; אף פעם לא צריך סוגריים משולשים.
- **מפתח חסר/מאוית שגוי מרונדר ריק, בשקט** — ללא שגיאה. ריק בפלט בדרך כלל אומר שם משתנה מאוית שגוי.
- **החלפת נתיב אינה החלפת תוכן** — נתיבי יעד של backend מכבדים רק {{packagePath}}, של frontend רק {{projectName}}; נתיבי ישות fullstack מכבדים את הקשר הישות המלא.
- **מפתחות עם התחילית __ הם פנימיים** (__entitySummaries, __inverseRelations…) — לא לתבניות.
- **משתני ישות חדשים נכנסים ל-view-model** — \`EntityScaffoldContext\` או המחלקה של התחום של המשתנה (\`EntityViewModel\`, \`FieldViewModel\`, \`RelationViews\`, \`FeatureContext\`, \`PageContext\`, \`DashboardContext\`). אין מקום אחר לחווט אותם.
- **אפשרות scaffold חדשה היא קבוע \`ScaffoldOption\` אחד** — הוא קובע את הדגל בשני נתיבי הרינדור ומופיע בסכמה של העורך.
- **לעולם אל תשתלו טקסט משתמש גולמי בתבנית frontend** — השתמשו בצורות \`…Ts\` / \`…Attr\` / \`…Jsx\`.
- **חבילה חדשה שמחזיקה ישות JPA** חייבת להתווסף לחבילות התמיכה של ה-scaffold, אחרת קונפיגורציות ה-datasource לא סורקות אותה.
- **pkField יכול להיות null** — הגנו עם {{#pkField}}…{{/pkField}} לישויות ללא מפתח ראשי.
- **שורת ערכת תבניות שנערכה היא שלכם** — סנכרון התבניות שומר אותה (\`seedHash = custom\`) והיא מפסיקה לעקוב אחרי הקובץ שמגיע עם המוצר; איפוס של הערכה מחזיר את הקבצים של המוצר.

### מפת מקור (backend)
- הקשר תלות backend — \`extension/dynamic/DynamicProjectGenerationConfiguration.java\` (buildBaseContext, toPascalCase, resolveTargetPath), \`config/DepartmentResolver.java\`
- הקשר ישות fullstack — \`fullstack/EntityScaffoldContext.java\` ומחלקות התחום שלידו; \`fullstack/ScaffoldOption.java\`
- הקשר frontend — \`extension/frontend/FrontendMustacheContext.java\`, \`FrontendProjectGenerator.java\`
- תבניות האשפים — \`templates/wizard/**\`, \`config/WizardTemplates.java\`
- מודל השורה — \`db/entity/FileContributionEntity.java\`, \`db/entity/EntityTemplateFileEntity.java\`
- המדריך הכתוב המלא — \`backend/docs/MUSTACHE_GUIDE.md\``,
        callouts: [
          {
            type: 'info',
            text: 'backend/docs/MUSTACHE_GUIDE.md הוא המדריך המלא (כל מפתח, ומאיפה הוא נגזר). המדריך הזה שומר את מה שאדמין שעורך תבנית צריך; כשמשתנה משתנה ב-backend, עדכנו את שניהם.'
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
    title: 'אשף ישויות SQL',
    icon: 'auto_fix_high',
    topics: [
      {
        id: 'sql-wizard-what',
        title: 'מה האשף עושה',
        description: 'הדביקו סכמה, או קראו אחת ממסד נתונים, וקבלו ישויות JPA — ואם תרצו גם REST API — בפרויקט שנוצר.',
        content: `### מטרה
כאשר המפתח בוחר דרייבר של מסד נתונים רלציוני (PostgreSQL, SQL Server, Oracle, DB2, H2, MySQL), כפתור **Generate entities from SQL…** מופיע על הכרטיסיה של אותו דרייבר בפאנל התלויות שנבחרו (**Selected**). הוא פותח מגירה שבה המפתח מדביק סקריפט סכמה (או מעלה אותו, או קורא אותו ממסד נתונים חי). כשלוחצים על Generate, ה-backend מנתח אותו וכותב מחלקות \`@Entity\` של JPA, ממשקי \`JpaRepository\` ו — כשמבקשים — service, DTOs ו-REST controller לכל טבלה, ישירות לתוך הפרויקט.

### אילו דרייברים זכאים
ה-UI קורא ל-\`GET /metadata/sql-dialects\` בטעינת הדף כדי ללמוד עבור אילו מזהי תלות ה-backend יודע לנתח. הכפתור מופיע רק על הכרטיסיות האלה. דרייבר JDBC חדש שנוסף לקטלוג תחת דיאלקט מוכר מקבל את האשף בלי שום הגדרה נוספת. ל-MongoDB אין DDL, ולכן הוא לא מוצע.

### הזרימה במבט כולל
1. המפתח בוחר דרייבר (למשל \`postgresql\`) בתוספת \`data-jpa\`.
2. לוחץ על **Generate entities from SQL…** בכרטיסיית הדרייבר.
3. מדביק משפטי \`CREATE TABLE …\` (וגם \`ALTER TABLE … ADD CONSTRAINT\`), גורר קובץ \`.sql\`, או לוחץ על **Read from a database…** (ראו **קריאה ממסד נתונים חי**).
4. הטבלאות שזוהו מופיעות ברשימה, כל אחת עם **Generate repository** (דלוק כברירת מחדל).
5. אופציונלי: תת-החבילה (ברירת מחדל \`entity\`) ו-**API mode** (ישויות בלבד, או REST API מעליהן).
6. תחת **With the project's other dependencies**: *Use this script as the Flyway baseline* (דלוק כברירת מחדל, בשימוש כאשר \`flyway\` נבחר), *Generate controller tests* (דורש מצב REST API), ושורה שמסבירה מה מוסיפה בחירת \`validation\`.
7. שמירה → הכרטיסיה מציגה תווית (✓ N tables).
8. **Generate** או **Explore** שולחים \`POST /starter-wizard.zip\` / \`/starter-wizard.preview\` עם גוף JSON.`,
        callouts: [
          {
            type: 'info',
            text: 'פרויקטים בלי מסמך אשף עדיין משתמשים ב-GET /starter.zip הרגיל, בית אחר בית. כשיש מסמך, הסקריפט ואפשרויות האשף נכתבים ל-menora-model.json של הפרויקט, כך שאפשר לעדכן את הפרויקט מאוחר יותר מסקריפט שהשתנה.'
          },
          {
            type: 'warning',
            text: 'המסמכים שמודבקים לאשפים של בקשה אחת (SQL, OpenAPI, WSDL, AsyncAPI) יכולים להגיע יחד עד 5 MB (menora.wizard.max-documents-size); מעבר לזה הבקשה נענית ב-400.'
          }
        ]
      },
      {
        id: 'sql-wizard-mapping',
        title: 'מה נקרא, ולמה הוא הופך',
        description: 'מיפוי טיפוסים, מפתחות, אילוצים, מפתחות זרים ו-enums.',
        content: `### מיפוי טיפוסים
כל עמודה הופכת לשדה. טיפוס ה-Java נבחר לפי טיפוס ה-SQL, ה-precision וה-scale שלו, והדיאלקט:

| טיפוס SQL | טיפוס Java | הערות |
|---|---|---|
| \`VARCHAR\`, \`CHAR\`, \`TEXT\`, \`CLOB\`, \`NVARCHAR\`, \`VARCHAR2\` | \`String\` | \`length\` → \`@Column(length=…)\` |
| \`INT\`, \`INTEGER\` | \`Integer\` | |
| \`BIGINT\`, \`BIGSERIAL\`, \`SERIAL\` | \`Long\` | SERIAL/BIGSERIAL גם מקבלים \`@GeneratedValue(IDENTITY)\` |
| \`BOOLEAN\`, \`BIT\` (SQL Server), \`TINYINT(1)\` (MySQL) | \`Boolean\` | |
| \`DATE\` / \`TIMESTAMP\` / \`TIME\` | \`LocalDate\` / \`LocalDateTime\` / \`LocalTime\` | |
| \`NUMERIC(p,s)\`, \`DECIMAL(p,s)\` | \`BigDecimal\` | precision/scale מועתקים ל-\`@Column\` |
| \`NUMBER(p,0)\` (Oracle) | \`Integer\` / \`Long\` | ≤9 → Integer, אחרת Long |
| \`UUID\` (PostgreSQL), \`UNIQUEIDENTIFIER\` (SQL Server) | \`UUID\` | |
| \`JSON\`, \`JSONB\` (PostgreSQL) | \`String\` | |
| \`BYTEA\`, \`BLOB\` | \`byte[]\` | |

### שמות
- טבלה \`user_orders\` → מחלקה \`UserOrders\`; עמודה \`created_at\` → שדה \`createdAt\` עם \`@Column(name = "created_at")\`.
- שמות באותיות מעורבות ושמות במירכאות שומרים על הכתיב שלהם: אסטרטגיית השמות של Spring Boot הייתה משכתבת אותם, ולכן האשף כותב אותם בצורה שהיא משאירה כמות שהיא, ומוסיף לפרויקט מחלקת naming strategy כששם במירכאות צריך אותה.
- טבלה עם שם סכמה (\`hr.employees\`) מקבלת \`@Table(schema = "hr")\`.

### מפתחות
- מפתח ראשי → \`@Id\`; \`BIGSERIAL\` / \`SERIAL\` / \`AUTO_INCREMENT\` / \`IDENTITY\` → \`@GeneratedValue(strategy = IDENTITY)\`.
- מפתח מורכב → \`@IdClass\` עם מחלקת מפתח לצד הישות (Lombok \`@Data\`, \`Serializable\`).
- מפתחות שמוגדרים ב-\`ALTER TABLE … ADD [CONSTRAINT x] PRIMARY KEY | FOREIGN KEY | UNIQUE\` נקראים כמו מפתחות inline — כך כותבים אותם pg_dump, SSMS ורוב כלי הייצוא.
- טבלה בלי מפתח ראשי נכתבת בלי \`@Entity\` (JPA צריך id), עם TODO, ולא מקבלת repository.

### מפתחות זרים
- מפתח זר לטבלה **באותו סקריפט** — בין שהוגדר על הטבלה, על העמודה (\`team_id BIGINT REFERENCES teams(id)\`) או ב-\`ALTER TABLE\` — הופך לאסוציאציית \`@ManyToOne(fetch = LAZY)\` עם ה-\`@JoinColumn\` שלה.
- עמודת מפתח שהיא גם מפתח זר נשארת \`@Id\` סקלרי, ולצידה אסוציאציה לקריאה בלבד על אותה עמודה.
- מפתח זר לטבלה שאינה בסקריפט נשאר שדה סקלרי עם \`// TODO: map as @ManyToOne\`.

### אילוצים ו-enums
- \`NOT NULL\` → \`@Column(nullable = false)\`; \`UNIQUE\` על עמודה אחת → \`@Column(unique = true)\`, על כמה עמודות → \`@UniqueConstraint\` על הטבלה.
- \`CHECK (col IN ('A','B'))\` → enum של Java (\`<Table><Column>\`) שנשמר עם \`@Enumerated(EnumType.STRING)\` — רק כשכל ערך הוא כבר שם Java תקין, כי מסד הנתונים מחזיק את הערכים כמו שהם; אחרת העמודה נשארת \`String\`.
- עם ה-starter של \`validation\`: \`@NotNull\` (אף פעם לא על מפתח שנוצר אוטומטית), \`@Size(max)\` מהאורך של עמודת טקסט, ומפתחות זרים שהם חובה — על ה-DTO, או על הישות כשהיא נחשפת ישירות.

### Lombok
ישויות משתמשות ב-\`@Data\`, \`@NoArgsConstructor\` ו-\`@AllArgsConstructor\`. Lombok היא שורת build מסוג \`__common__\`, כך שהיא קיימת בכל פרויקט. אסוציאציות מסומנות ב-\`@EqualsAndHashCode.Exclude\` וב-\`@ToString.Exclude\`, כך ש-\`equals\`, \`hashCode\` ו-\`toString\` לעולם לא טוענים את השורה שהן מצביעות עליה.`,
        codeExamples: [
          {
            title: 'נוצר מתוך: orders(id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), status VARCHAR(20) CHECK (status IN (\'OPEN\',\'PAID\')))',
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
            text: 'בפרויקטים שנוצרו לפני נובמבר 2026 האסוציאציה נכללת ב-equals, ב-hashCode וב-toString של @Data, שטוענים את השורה העצלה (ונכשלים מחוץ לטרנזקציה). הוסיפו שם ידנית @EqualsAndHashCode.Exclude ו-@ToString.Exclude לכל אסוציאציה: עדכון של הפרויקט מביא שינויי מודל, לא שינויי תבניות.'
          }
        ]
      },
      {
        id: 'sql-wizard-api-modes',
        title: 'מצבי API, Flyway ובדיקות',
        description: 'כמה קוד נכתב מעל הישויות, ומה מוסיפות שאר התלויות של הפרויקט.',
        content: `### מצב API (\`sqlOptions.<dep>.apiMode\`)
| מצב | מה נכתב לכל טבלה |
|---|---|
| \`NONE\` (ברירת מחדל) | הישות, וכשמסומן — גם ה-repository שלה |
| \`ENTITY_DIRECT\` | + service ו-REST controller שחושפים את הישות עצמה |
| \`INLINE_DTO\` | + record DTO עם \`from(entity)\` / \`toEntity()\` כתובים ביד, שבו משתמשים ה-service וה-controller |
| \`MAPSTRUCT_DTO\` | + record DTO ו-\`@Mapper\` של MapStruct (התלות \`mapstruct\` מתווספת) |

מצב לא מוכר נענה ב-400.

### Flyway baseline (\`flywayBaseline\`, ברירת מחדל true)
כשהתלות \`flyway\` נבחרה, הסקריפט שהודבק הופך ל-\`src/main/resources/db/migration/V1__init.sql\` במקום ה-placeholder של התלות: כל משפט כפי שנכתב, מלבד SELECT-ים. הוא בדיאלקט שבו הודבק, ולכן הוא רץ על אותו מסד נתונים. כשיש כמה payloads של SQL, רק הראשון הוא ה-baseline. \`false\` משאיר את ה-placeholder.

### בדיקות controller (\`generateTests\`)
במצב REST API, \`@WebMvcTest\` לכל controller.

### ה-starters שהוא צריך
\`data-jpa\` והדרייבר מגיעים מהבחירה של המפתח; מצב REST API צריך \`web\`.`
      },
      {
        id: 'sql-wizard-live',
        title: 'קריאה ממסד נתונים חי',
        description: 'קריאת טבלאות ו-views מ-PostgreSQL, SQL Server, Oracle או DB2 במקום הדבקת DDL — ומקורות הסכמה (Schema sources) שאדמינים מגדירים לשם כך.',
        content: `### למפתח
**Read from a database…** ליד תיבת ה-SQL (ו-**From a database** בייבוא ה-DDL של לשונית **Fullstack**) מתחבר למסד נתונים, מציג את הסכמות שלו ואז את הטבלאות וה-views שלו (ה-views מסומנים), וקורא את אלה שסומנו. מה שנקרא הופך לסקריפט שאדם היה מדביק — \`CREATE TABLE\` לכל טבלה עם המפתח שלה ואילוצי NOT NULL, UNIQUE ו-CHECK-list, המפתחות הזרים בין הטבלאות שנקראו כ-\`ALTER TABLE … ADD FOREIGN KEY\`, ו-\`SELECT\` לכל view — ומחליף את תיבת ה-SQL, עם **Undo**. המפתח יכול לקרוא ולערוך אותו לפני היצירה; האשף מייצר אז בדיוק את מה שהסקריפט הזה היה מייצר אילו הודבק.

מסד הנתונים הוא או **מקור** (source) שאדמין הגדיר, שנבחר לפי שם, או — כל עוד השרת מאפשר זאת — מסד שהוקלד ידנית (host, port, database / service name / DB2 library, user, password). סיסמה שהוקלדה נשלחת עם כל קריאה ולא נשמרת בשום מקום, לא בשרת ולא בדפדפן.

### לאדמין: Config → Schema sources
מקור מחזיק היכן נמצא מסד הנתונים (סוג, host, port, database או service name, DB2 library) ואת המשתמש. **הסיסמה לעולם לא נשמרת**: *Password from* מציין מאיפה השרת קורא אותה — משתנה סביבה \`SCHEMA_SOURCE_…\` או property \`menora.live-schema.secrets.…\`; כל שם אחר נדחה. הרשימה מראה אם הסיסמה הזו אכן מוגדרת בשרת הזה. **Test connection** מנסה את הטופס, שמור או לא, ומדווח את מספר הסכמות או את השגיאה של הדרייבר. מקורות נרשמים ב-History והם **אינם** חלק מייצוא התצורה (הם מציינים את מסדי הנתונים של הסביבה הזו).

### הגדרות שרת
| Property | ברירת מחדל | משמעות |
|---|---|---|
| \`menora.live-schema.typed-connections\` | \`true\` | האם כל אחד רשאי להקליד מסד נתונים. כבוי: רק המקורות של האדמינים. |
| \`menora.live-schema.allowed-hosts\` | ריק (כל host) | תבניות host מופרדות בפסיקים שחיבור מוקלד רשאי לציין (\`*.menora.co.il\`, \`10.20.*\`). כדאי להגדיר לכל סביבה: כשחיבורים מוקלדים מותרים, השרת מתחבר לאן שאומרים לו. מקורות אינם מוגבלים על ידי ההגדרה הזו. |
| \`menora.live-schema.max-tables\` | \`300\` | מספר הטבלאות וה-views שקריאה אחת יכולה לקחת. |
| \`menora.live-schema.max-concurrent-reads\` | \`4\` | קריאות בו-זמנית; השאר ממתינות 5 s ואז מקבלות 429. |

חיבור הוא לקריאה בלבד, נפתח לקריאה אחת, עם timeout של 10 s ל-login ו-30 s למשפט. כל קריאה נרשמת בלוג עם המקור או ה-host, הסכמה, המספר והמשתמש — לעולם לא הסיסמה.

### דרייברים
הדרייברים של PostgreSQL, SQL Server ו-Oracle מגיעים עם האפליקציה. DB2 for IBM i (jt400) אינו במאגר האופליין: בנו את האפליקציה עם \`mvn package -Pdb2-driver\` כדי לכלול אותו; בלעדיו DB2 מוצג כ-"no driver on this server".

### מגבלות
אינדקסים, ערכי ברירת מחדל, הערות, sequences ו-triggers אינם נקראים. באשף ה-SQL השדות של view הם \`String\` (הייבוא של fullstack נותן להם טיפוסים). עמודת enum של PostgreSQL הופכת לעמודת טקסט שמוגבלת ב-CHECK. DB2 for IBM i לא נקרא עדיין משרת אמיתי.`
      },
      {
        id: 'sql-wizard-api',
        title: 'REST API',
        description: 'נקודות הקצה ליצירה ונקודות הקצה של הסכמה החיה.',
        content: `### נקודות קצה

| שיטה | נתיב | מטרה |
|---|---|---|
| \`GET\` | \`/metadata/sql-dialects\` | מפת dep-id → שם דיאלקט (רק תלויות שקיימות בקטלוג) |
| \`POST\` | \`/starter-wizard.zip\` | יצירת ה-ZIP (משותף לכל ארבעת האשפים; אפשר לשלב את ה-payloads שלהם) |
| \`POST\` | \`/starter-wizard.preview\` | עץ קבצים + תוכן (אותה צורה כמו \`/starter.preview\`) |
| \`GET\` | \`/metadata/live-schema/options\` | המקורות הפעילים (בלי היכן הם נמצאים), האם חיבורים מוקלדים מותרים, הדרייברים המותקנים, פורטי ברירת המחדל |
| \`POST\` | \`/metadata/live-schema/schemas\` | \`{connection}\` → \`{schemas, defaultSchema}\` |
| \`POST\` | \`/metadata/live-schema/tables\` | \`{connection, schema}\` → \`{tables: [{name, kind}], truncated}\` |
| \`POST\` | \`/metadata/live-schema/ddl\` | \`{connection, schema, tables, qualify?}\` → \`{dialect, sql, tables, views, warnings}\` |

\`connection\` הוא \`{source}\` או \`{dialect, host, port?, database?, library?, user, password, trustServerCertificate?}\`. שגיאות של הסכמה החיה הן \`{error, detail}\`: 400 לחלק שגוי, לטבלה לא מוכרת, לחיבור שנכשל או לדרייבר חסר; 403 כשחיבורים מוקלדים כבויים או שה-host אינו מותר; 404 למקור לא מוכר; 429 כשהשרת עמוס.

### למה נקודת קצה POST
\`/starter.zip\` היא GET ששורת השאילתה שלה נושאת כל קלט. כמה משפטי \`CREATE TABLE\` חורגים ממגבלות URL טיפוסיות (~2–8 KB), ולכן האשפים מקבלים את אותם שדות בתוספת המסמכים שלהם כגוף JSON.`,
        codeExamples: [
          {
            title: 'יצירת פרויקט עם שתי ישויות, ה-repositories שלהן ו-REST API',
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
          { name: 'sqlByDep', type: 'object', required: false, description: 'מפת depId → סקריפט ה-SQL (CREATE TABLE, ALTER TABLE … ADD constraints).', example: '{ "postgresql": "CREATE TABLE users (...);" }' },
          { name: 'sqlOptions', type: 'object', required: false, description: 'מפת depId → { subPackage (ברירת מחדל "entity"), tables[] ({name, generateRepository}), apiMode (NONE | ENTITY_DIRECT | INLINE_DTO | MAPSTRUCT_DTO), flywayBaseline (ברירת מחדל true), generateTests }.', example: '{ "postgresql": { "apiMode": "INLINE_DTO", "generateTests": true } }' },
          { name: 'opts', type: 'object', required: false, description: 'אותה מפת אפשרויות משנה כמו פרמטרי השאילתה opts-{depId} של /starter.zip — למשל תפקיד ה-datasource, ראשי או משני.', example: '{ "postgresql": ["pg-primary"] }' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // OPENAPI → CONTROLLER/CLIENT WIZARD
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'openapi-wizard',
    title: 'אשף OpenAPI',
    icon: 'integration_instructions',
    topics: [
      {
        id: 'openapi-wizard-what',
        title: 'מה האשף עושה',
        description: 'הדביקו מסמך OpenAPI 3.x וקבלו controllers, client או את שניהם, עם records בעלי טיפוסים.',
        content: `### מטרה
כאשר המפתח בוחר תלות של web stack (\`web\` או \`webflux\`), כפתור **Generate from OpenAPI spec…** מופיע על הכרטיסיה שלה בפאנל התלויות שנבחרו. הוא פותח מגירה שבה המפתח מדביק או מעלה מסמך OpenAPI 3.x (YAML או JSON). כשלוחצים על Generate, ה-backend כותב את צד השרת, client, או את שניהם — עם record של Java לכל סכמה, מיפויי Spring MVC, binding של פרמטרים, ועם ה-starter של \`validation\` גם Bean Validation.

### אילו תלויות זכאיות
\`GET /metadata/openapi-capable-deps\` (כיום \`web\` ו-\`webflux\`, בחיתוך עם הקטלוג).

### המגירה
1. הדביקו או העלו את המסמך. רשימת **Detected operations** חיה מופיעה (\`GET /pets\`, \`POST /pets/{id}\`…); מסמך שלא מתנתח מציג את ההודעות של ה-parser.
2. **Generate**: Controllers, Client, או Both (\`mode\`).
3. עם צד שרת, **Server code as**: **Interfaces** (ברירת המחדל להגדרה חדשה) או **Classes** — ראו את הנושא הבא.
4. עם client, דרך מה הוא קורא: **RestTemplate** (ברירת מחדל) או **RestClient**, וה-property שמחזיק את ה-base URL (ברירת מחדל \`openapi.client.base-url\`).
5. תתי-חבילות (controllers \`api\`, records \`dto\`, client \`client\`) ו-**Keep the spec in the project** (\`src/main/resources/openapi/<dep>.yaml\`).
6. שמירה → הכרטיסיה מציגה תווית. Generate ו-Explore שולחים POST ל-\`/starter-wizard.zip\` / \`.preview\`; אפשר לשלב את ה-payload עם אלה של האשפים האחרים.

### ה-starters שהוא צריך
השרת מוסיף את מה שהקוד שנוצר צריך והמפתח השמיט: \`web\` כשלא נבחר לא \`web\` ולא \`webflux\`, ו-\`openapi\` (springdoc, Swagger UI ב-\`/swagger-ui.html\`) לצד controllers שנוצרו.`,
        callouts: [
          {
            type: 'warning',
            text: 'המסמך חייב להיות עצמאי (self-contained). $ref לקובץ אחר או ל-URL, או $id, נדחים ב-400 שמציין אותם — השרת לעולם לא מוריד או קורא שום דבר שמסמך מודבק מצביע עליו. אחדו (bundle) spec מרובה קבצים לקובץ אחד קודם.'
          }
        ]
      },
      {
        id: 'openapi-wizard-styles',
        title: 'Interfaces או Classes',
        description: 'למה הגדרה חדשה מייצרת interface מסוג Api לכל tag, ולצידו controller ששייך לצוות.',
        content: `### Interfaces (\`apiStyle: "interfaces"\`)
לכל tag, שני קבצים:
- **\`<Tag>Api\`** — interface עם כל המיפויים. כל מתודה היא \`default\` שעונה **501 Not Implemented**. נוצר במלואו, בכל פעם.
- **\`<Tag>Controller implements <Tag>Api\`** — המחלקה של הצוות. היא מתחילה ריקה; הצוות דורס (override) פעולה כדי לממש אותה, עם החתימה בלבד (המיפוי, ה-bindings והאילוצים נשארים על ה-interface).

כשהמסמך משתנה והפרויקט מתעדכן (**Download update**), ה-interface נכתב מחדש וב-controller לא נוגעים לעולם: פעולה חדשה עונה 501 עד שמישהו דורס אותה. לכן הגדרה חדשה מתחילה כאן.

### Classes (\`apiStyle: "classes"\`, או כשהוא חסר)
\`<Tag>Controller\` אחד לכל tag, שהמתודות שלו זורקות \`UnsupportedOperationException\` עד שממלאים אותן. פשוט יותר לקריאה, אבל הקוד של הצוות חי אז בקובץ שנוצר, כך שעדכון של מסמך שהשתנה עושה patch לקוד שהצוות כתב. הגדרות שנשמרו לפני שהבחירה הזו הייתה קיימת שומרות על הסגנון הזה.

פעולות בלי tag הולכות ל-\`Default\`.`,
        codeExamples: [
          {
            title: 'Interfaces — PetsApi.java שנוצר (מקוצר)',
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
            title: 'Interfaces — PetsController.java שנוצר (של הצוות)',
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
        title: 'מיפוי סכמה → טיפוס Java',
        description: 'כיצד סכמות, פרמטרים וגופי בקשה של OpenAPI הופכים ל-Java.',
        content: `### טיפוסים
| סכמת OpenAPI | טיפוס Java | הערות |
|---|---|---|
| \`string\` | \`String\` | |
| \`string\`, \`format: date\` | \`LocalDate\` | |
| \`string\`, \`format: date-time\` | \`OffsetDateTime\` | |
| \`string\`, \`format: uuid\` | \`UUID\` | |
| \`string\`, \`format: binary\` | \`byte[]\` | (\`MultipartFile\` בגוף multipart) |
| \`string\` עם \`enum\` | enum של Java | שומר כל ערך כפי שהוא ב-wire (\`@JsonValue\`); ב-property הוא נקרא על שם המקום שלו (\`Pet.status\` → \`PetStatus\`). **פרמטר** מטיפוס enum נשאר \`String\`. |
| \`integer\` / \`format: int64\` | \`Integer\` / \`Long\` | |
| \`number\` / \`format: float\` / \`format: double\` | \`Double\` / \`Float\` / \`Double\` | |
| \`boolean\` | \`Boolean\` | |
| \`array\` | \`List<T>\` | |
| \`object\` עם \`additionalProperties\` | \`Map<String, V>\` | |
| \`$ref\` לסכמת object | ה-record | |
| \`allOf\` | record ממוזג אחד | |
| \`oneOf\` / \`anyOf\` על objects | sealed interface | \`@JsonTypeInfo\` לפי ה-discriminator (תוך כיבוד ה-\`mapping\` שלו), או deduction כשאין discriminator. בחירה בין טיפוסים שאינם objects נשארת \`Object\`. |

סכמה בעלת שם שאינה object (string עם format, array, map) אינה טיפוס בפני עצמו: הפניה אליה היא הטיפוס שהיא מייצגת. object שנכתב במקום (inline) הופך ל-record שנקרא על שם המקום שלו (\`<Operation>Request\`, \`<Operation>Response\`). \`type: [string, 'null']\` של OpenAPI 3.1 נקרא.

### Records
כל סכמת object הופכת ל-\`record\` של Java. property שהשם שלו ב-Java שונה מהשם שלו ב-wire מקבל \`@JsonProperty\` (\`first_name\` → \`firstName\`); מילה שמורה של Java מקבלת סיומת (\`class_\`). סכמה שנקראת כמו טיפוס שהקוד שנוצר משתמש בו (\`List\`, \`Valid\`…) הופכת ל-\`<Name>Dto\`.

### פעולות
- \`@GetMapping\` … \`@PatchMapping\`, וגם פעולות HEAD ו-OPTIONS.
- פרמטרים נקשרים לפי השמות שלהם ב-wire: \`@PathVariable("id")\`, \`@RequestParam\`, \`@RequestHeader("X-Request-Id")\`, \`@CookieValue\`; תאריכים עם \`@DateTimeFormat(iso = …)\`; גם פרמטרים ברמת ה-path.
- גוף JSON הוא \`@RequestBody\` — אופציונלי רק כשהמסמך אומר \`required: false\`. גוף multipart או form-urlencoded קושר את ה-properties שלו כפרמטרים (קבצים כ-\`MultipartFile\`).
- סטטוס ההצלחה המוצהר — ה-2xx הנמוך ביותר, אחריו \`2XX\`, אחריו \`default\` — הופך ל-\`@ResponseStatus\` כשהוא אינו 200, וקובע את טיפוס ההחזרה.
- עם ה-starter של \`validation\`: \`@NotNull\`, \`@Size\`, \`@Pattern\`, \`@Email\`, \`@Min\`/\`@Max\`, \`@DecimalMin\`/\`@DecimalMax\` ו-\`@Valid\` על רכיבי record ועל פרמטרים.

### Security schemes
ה-security schemes של המסמך מוצהרים עבור springdoc (\`@SecuritySchemes\`, \`@SecurityRequirement\`), ו-client שנוצר שולח את פרטי ההזדהות מתוך properties (API keys, טוקני bearer/OAuth2, basic). הם מתועדים, לא נאכפים: קוד השרת לא בודק דבר.

### Clients
\`<Tag>Client\` עם מתודה לכל פעולה, אותם שמות פרמטרים, וה-path מורחב לפי הסדר של ה-path עצמו. RestTemplate או RestClient, שמוגדרים על ידי מחלקת config שנוצרת וקוראת את ה-property של ה-base URL.`
      },
      {
        id: 'openapi-wizard-api',
        title: 'REST API',
        description: 'נקודות קצה, שדות הבקשה ודוגמה מלאה.',
        content: `### נקודות קצה

| שיטה | נתיב | מטרה |
|---|---|---|
| \`GET\` | \`/metadata/openapi-capable-deps\` | מזהי התלויות שזכאים לאשף |
| \`POST\` | \`/starter-wizard.zip\` | יצירת ה-ZIP (משותף לכל ארבעת האשפים) |
| \`POST\` | \`/starter-wizard.preview\` | עץ קבצים + תוכן |
| \`POST\` | \`/starter-wizard.detect-paths\` | \`{ spec }\` → \`["GET /pets", "POST /pets/{id}", …]\` עבור המגירה |

### שגיאות ניתוח
מסמך שלא מתנתח — או שמפנה אל מחוץ לעצמו — נענה ב-400 \`{ "error": "...", "messages": ["attribute info.version is missing", ...] }\`, גם מ-detect-paths וגם מהיצירה. המגירה מציגה את ההודעות.`,
        codeExamples: [
          {
            title: 'יצירת פרויקט מ-spec קטן של Petstore',
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
            title: 'spec לדוגמה של Petstore ב-OpenAPI (YAML)',
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
            title: 'Classes — PetsController.java שנוצר (בלי ה-imports)',
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
          { name: 'specByDep', type: 'object', required: false, description: 'מפת depId → מסמך OpenAPI 3.x (YAML או JSON), עצמאי.', example: '{ "web": "openapi: 3.0.3\\n..." }' },
          { name: 'openApiOptions.<dep>.mode', type: 'string', required: false, description: 'CONTROLLERS (ברירת מחדל), CLIENT או BOTH.', example: 'BOTH' },
          { name: 'openApiOptions.<dep>.apiStyle', type: 'string', required: false, description: 'interfaces, או classes (גם כשהשדה חסר). רלוונטי רק כשיש צד שרת.', example: 'interfaces' },
          { name: 'openApiOptions.<dep>.clientKind', type: 'string', required: false, description: 'restTemplate (ברירת מחדל) או restClient.', example: 'restClient' },
          { name: 'openApiOptions.<dep>.baseUrlProperty', type: 'string', required: false, description: 'ה-property שממנו ה-client קורא את ה-base URL שלו.', example: 'openapi.client.base-url' },
          { name: 'openApiOptions.<dep>.apiSubPackage / dtoSubPackage / clientSubPackage', type: 'string', required: false, description: 'לאן הולכים ה-controllers, ה-records וה-client (ברירות מחדל api, dto, client).', example: 'api' },
          { name: 'openApiOptions.<dep>.copySpec', type: 'boolean', required: false, description: 'שמירת המסמך ב-src/main/resources/openapi/<dep>.yaml|json.', example: 'true' },
          { name: 'dependencies', type: 'array', required: true, description: 'מערך ה-dep-id הרגיל. רק עבור תלויות שרשומות ב-/metadata/openapi-capable-deps רשומת ה-specByDep מעובדת.', example: '[ "web" ]' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // SOAP WIZARD
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'soap-wizard',
    title: 'אשף SOAP',
    icon: 'hub',
    topics: [
      {
        id: 'soap-wizard-what',
        title: 'מה האשף עושה',
        description: 'הדבקה של WSDL ויצירת @Endpoint stubs, client מבוסס WebServiceTemplate, או שניהם.',
        content: `### מטרה
כאשר המפתח בוחר את התלות \`web-services\` (Spring Web Services starter), כפתור **Generate from WSDL…** מופיע על אותה כרטיסייה. לחיצה עליו פותחת מגירה שבה המפתח מדביק מסמך WSDL 1.1. בלחיצה על Generate, ה-backend שומר את ה-WSDL ב-\`src/main/resources/wsdl/\`, מגדיר את ה-plugin של JAX-WS Maven ליצור מחלקות payload של JAXB בזמן build, ופולט אחד משלושה — stubs של \`@Endpoint\` בצד שרת, client מסוג \`WebServiceGatewaySupport\`, או שניהם — בהתאם למצב הנבחר.

זהו התאום הסימטרי של אשף OpenAPI לצוותי SOAP. הוא מסיר את הבויילרפלייט גם לשרתי SOAP בגישת contract-first וגם לצרכני SOAP.

### אילו תלויות זכאיות
ה-UI קורא ל-\`GET /metadata/soap-capable-deps\` בטעינת הדף — הכפתור מופיע רק על כרטיסיות תלות שנוכחות בתגובה (כרגע רק \`web-services\`, בחיתוך עם התלויות הקיימות בפועל בקטלוג).

### זרימה במבט מהיר
1. המפתח בוחר \`web-services\` מהקטלוג.
2. לוחץ **Generate from WSDL…** על כרטיסיית התלות.
3. מדביק או מעלה WSDL (\`.wsdl\` או \`.xml\`).
4. רשימה חיה של **Detected Services** (שירותים שזוהו) מופיעה (debounced 400ms) עם ערכים כגון \`CountryService.CountryPort: getCountry, listCountries\`.
5. בוחר מצב — **Endpoints**, **Client**, או **Both** — ואופציונלית מחליף sub-packages, את ה-context path של ה-servlet (במצב endpoint), ואת מאפיין ה-base URL (במצב client).
6. שמירה → כרטיסיית התלות מציגה תווית "WSDL attached".
7. לחיצה על **Generate** או **Explore** — ה-UI שולח POST \`/starter-wizard.zip\` / \`/starter-wizard.preview\` עם גוף JSON. ה-endpoint משותף עם שאר האשפים — בקשה אחת יכולה לשאת \`wsdlByDep\`, \`specByDep\`, \`sqlByDep\` ו-\`asyncApiByDep\` ביחד.

אם המפתח שכח את \`web-services\`, בקשה עם WSDL מקבלת אותה בתוספת.`,
        callouts: [
          {
            type: 'info',
            text: 'מחלקות JAXB request/response לא נכתבות לתוך ה-ZIP. הן נוצרות בזמן build על ידי ה-plugin של JAX-WS Maven מתוך ה-XSD המוטמע ב-WSDL. ה-mvn compile הראשון מייצר אותן תחת target/generated-sources/jaxws/. סביבות פיתוח מזהות את התיקייה הזאת אוטומטית.'
          },
          {
            type: 'info',
            text: 'ארבעת האשפים ניתנים לשילוב — POST /starter-wizard.zip מקבל את sqlByDep, specByDep, wsdlByDep ו-asyncApiByDep יחדיו. מפות ריקות הן no-op.'
          }
        ]
      },
      {
        id: 'soap-wizard-modes',
        title: 'מצבי יצירה',
        description: 'מה נפלט עבור ENDPOINTS, CLIENT, ו-BOTH.',
        content: `### מצבים
האשף חושף שלושה מצבים; כל אחד שולט באילו מחלקות Java המחולל כותב (ה-WSDL עצמו וה-plugin של JAX-WS ב-\`pom.xml\` נפלטים בכל המצבים).

| מצב | קבצים נפלטים בנוסף ל-WSDL ול-plugin של JAX-WS |
|---|---|
| \`ENDPOINTS\` | \`{Service}Endpoint.java\` (\`@Endpoint\`, מתודה אחת לכל פעולה) + \`WebServiceConfig.java\` (\`MessageDispatcherServlet\` ב-\`contextPath\`, \`SimpleWsdl11Definition\` שחושף את ה-WSDL) |
| \`CLIENT\` | \`{Service}Client.java\` (תת-מחלקה של \`WebServiceGatewaySupport\`) + \`SoapClientConfig.java\` (\`Jaxb2Marshaller\` + \`WebServiceTemplate\` הקורא את \`\${baseUrlProperty}\`) + מקטע \`application.yaml\` עם ה-base URL |
| \`BOTH\` | כל הנ״ל. ה-endpoints וה-client חולקים את אותן מחלקות payload שנוצרות על ידי JAXB. |

### מתודות Endpoint
לכל פעולת WSDL:

- מתודה אחת לפעולה, \`@PayloadRoot(namespace = ..., localPart = ...)\` אחד לכל מתודה
- \`namespace\` נלקח מ-namespace של ה-element של ה-request (או מ-\`targetNamespace\` של ה-WSDL אם ל-part אין הפניה ל-element)
- \`localPart\` נלקח מהשם המקומי של ה-element של ה-request (או משם הפעולה כ-fallback)
- חתימת המתודה משתמשת בשמות מחלקות ה-payload של JAXB; הם יבוצעו resolve כש-\`mvn compile\` יריץ את ה-plugin של JAX-WS
- הגוף זורק \`UnsupportedOperationException\`

### מתודות Client
לכל פעולת WSDL:

- מתודה אחת לפעולה, עם טיפוס ה-request של JAXB כפרמטר וטיפוס ה-response של JAXB כערך החזרה
- הגוף מאציל ל-\`getWebServiceTemplate().marshalSendAndReceive(request)\`
- ה-beans של \`WebServiceTemplate\` ו-\`Jaxb2Marshaller\` מוגדרים ב-\`SoapClientConfig\` עם \`contextPath\` המכוון ל-package שנוצר

### חבילות
- WSDL → \`src/main/resources/wsdl/{kebab-cased-service-name}.wsdl\`
- Endpoints → \`{packageName}.{endpointSubPackage}\` (ברירת מחדל \`endpoint\`)
- Client → \`{packageName}.{clientSubPackage}\` (ברירת מחדל \`client\`)
- payloads של JAXB → \`{packageName}.{payloadSubPackage}\` (ברירת מחדל \`generated\`) — נוצרים בזמן build על ידי ה-plugin של JAX-WS`,
      },
      {
        id: 'soap-wizard-api',
        title: 'REST API',
        description: 'נקודות קצה POST ומטא-נתונים נלווים.',
        content: `### נקודות קצה

| Method | Path | מטרה |
|---|---|---|
| \`GET\` | \`/metadata/soap-capable-deps\` | מזהי תלות זכאים לאשף (בחיתוך עם התלויות בקטלוג) |
| \`POST\` | \`/starter-wizard.zip\` | יצירת ZIP עם endpoints/clients (משותף לכל ארבעת האשפים) |
| \`POST\` | \`/starter-wizard.preview\` | עץ קבצים + תוכן (אותה צורה כמו \`/starter.preview\`) |
| \`POST\` | \`/starter-wizard.detect-services\` | פרסור בצד השרת: \`{ wsdl }\` → \`["CountryService.CountryPort: getCountry, listCountries"]\` עבור התצוגה החיה במגירה |

### למה נקודת קצה POST חדשה
מסמכי WSDL נכנסים בקלות לעשרות קילובייטים כשה-XSD המוטמע אינו טריוויאלי — הרבה מעבר למגבלות אורך URL טיפוסיות. שימוש חוזר באותה נקודת קצה POST של האשף שכבר קיימת עבור SQL ו-OpenAPI שומר על אחידות הצורה ב-wire ועוקף תקרות גודל URL.

### שגיאות פרסור
אם ה-WSDL פגום, ה-backend מחזיר HTTP 400 עם גוף כגון \`{ "error": "Invalid WSDL", "messages": ["WSDLException: faultCode=PARSER_ERROR: ..."] }\` — גם מ-detect-services (וגם עבור WSDL ללא \`<service>\`), כך שהמגירה מציגה את ההודעות במקום רשימה ריקה.

WSDL שמפנה לקובץ אחר — \`wsdl:import\`, או \`xsd:import\` / \`include\` / \`redefine\` עם \`schemaLocation\` — מקבל 400 שמציין כל הפניה. השרת לעולם לא פותח קובץ או URL שמסמך מודבק מצביע עליו; ה-schemas חייבים להיות בתוך ה-WSDL.`,
        codeExamples: [
          {
            title: 'יצירת פרויקט מ-WSDL קטן של CountryService (מצב BOTH)',
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
            title: 'דוגמת WSDL של CountryService (XML)',
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
            title: 'CountryServiceEndpoint.java שנוצר',
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
            title: 'CountryServiceClient.java שנוצר',
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
          { name: 'wsdlByDep', type: 'object', required: false, description: 'מפה של depId → טקסט מסמך WSDL 1.1 גולמי. wsdl4j מפרסר בצד השרת.', example: '{ "web-services": "<?xml version=\\"1.0\\"?>..." }' },
          { name: 'soapOptions', type: 'object', required: false, description: 'מפה של depId → { mode, endpointSubPackage, clientSubPackage, payloadSubPackage, baseUrlProperty, contextPath }. mode הוא אחד מ-ENDPOINTS, CLIENT, BOTH (ברירת מחדל ENDPOINTS).', example: '{ "web-services": { "mode": "BOTH", "endpointSubPackage": "endpoint", "clientSubPackage": "client" } }' },
          { name: 'dependencies', type: 'array', required: true, description: 'מערך ה-dep-id הרגיל. רק תלויות הרשומות ב-/metadata/soap-capable-deps יעובדו עם הרשומות שלהן ב-wsdlByDep.', example: '[ "web-services" ]' }
        ]
      },
      {
        id: 'soap-wizard-limits',
        title: 'הערות ומגבלות',
        description: 'מה היצירה הזו עושה, מה לא, ומדוע.',
        content: `### מה האשף מפיק
- ה-WSDL עצמו, נכתב verbatim ל-\`src/main/resources/wsdl/{kebab-service-name}.wsdl\`.
- ה-plugin של JAX-WS Maven (\`com.sun.xml.ws:jaxws-maven-plugin:4.0.2\`) מחובר ל-\`generate-sources\` ב-\`pom.xml\` — מייצר מחלקות payload של JAXB מה-XSD המוטמע בכל \`mvn compile\`.
- \`{Service}Endpoint.java\` ו/או \`{Service}Client.java\` אחד לכל \`<wsdl:service>\`, מתודה אחת לכל פעולה.
- \`WebServiceConfig.java\` (מצב endpoint) ו/או \`SoapClientConfig.java\` (מצב client).
- מקטע \`application.yaml\` עם מאפיין ה-base URL (מצב client בלבד) — ממוזג עמוק ל-\`application.yaml\` הקיים.

### מה האשף לא מפיק
- **אין מחלקות JAXB ב-ZIP.** הן נמצאות ב-\`target/generated-sources/jaxws/\` אחרי ש-\`mvn compile\` מריץ את ה-plugin. סביבות פיתוח קולטות את זה אוטומטית.
- **אין תמיכה ב-WSDL 2.0** — wsdl4j מפרסר WSDL 1.1 בלבד.
- **אין קלט XSD עצמאי ואין WSDL מרובה קבצים** — האשף מצפה ל-WSDL אחד עם ה-schemas מוטמעים בו; הפניה לקובץ אחר נדחית.
- **אין דריסת SOAP 1.2 binding** — קישורי כתובת של 1.1 ושל 1.2 מזוהים שניהם בתצוגה החיה, אך הקוד שנוצר משתמש ב-\`MessageFactory\` ברירת המחדל (SOAP 1.1). עברו ל-SOAP 1.2 ב-\`SoapClientConfig\` אחרי היצירה אם נדרש.
- **אין חיווט mTLS / WS-Security** — ה-client שנוצר הוא HTTP פשוט. חברו interceptors (\`Wss4jSecurityInterceptor\`, \`HttpComponents5MessageSender\` מותאם) בעצמכם.

### מדוע הבחירות האלה
יצירת קוד JAXB היא בעיה מורכבת ופתורה היטב; מימוש מחדש שלה בתוך האשף יהיה שימוש לא יעיל במאמץ ויסטה ללא הרף מהתנהגות הייחוס של ה-JDK. האצלה ל-plugin של JAX-WS Maven נותנת למפתח את המחלקות *המדויקות* שהיה מייצר ידנית מה-WSDL, ללא הפתעות — הערך של האשף הוא חיווט Spring סביב המחלקות האלה, לא המחלקות עצמן.`,
        callouts: [
          {
            type: 'tip',
            text: 'אחרי היצירה, הריצו mvn -DskipTests compile פעם אחת כדי לייצר את מחלקות ה-payload של JAXB. מחלקות ה-Endpoint וה-Client שנוצרו לא יבוצעו resolve ב-IDE עד שזה ירוץ לפחות פעם אחת.'
          },
          {
            type: 'tip',
            text: 'עבור WS-Security או mTLS, הוסיפו interceptors / WebServiceMessageSender מותאם ב-SoapClientConfig אחרי היצירה. האשף נשאר במכוון מחוץ למדיניות אבטחה — היא משתנה יותר מדי משירות לשירות.'
          },
          {
            type: 'warning',
            text: 'לא ידוע שה-plugin של JAX-WS והתלויות שלו נמצאים במאגר ה-Maven האופליין, ולכן פלט ה-SOAP לא נבנה כאן באמת — בדקו ש-Artifactory מכיל את com.sun.xml.ws:jaxws-maven-plugin לפני שמסתמכים עליו.'
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
    title: 'אשף אירועים (AsyncAPI)',
    icon: 'sync_alt',
    topics: [
      {
        id: 'events-wizard-what',
        title: 'מה האשף עושה',
        description: 'הדביקו מסמך AsyncAPI וקבלו producers ו-listeners של Kafka עם payloads בעלי טיפוסים.',
        content: `### מטרה
כאשר המפתח בוחר \`kafka\`, כפתור **Generate from AsyncAPI…** מופיע על הכרטיסיה שלה. הוא פותח מגירה שבה המפתח מדביק או מעלה מסמך AsyncAPI (2.x או 3.x, YAML או JSON). כשלוחצים על Generate, ה-backend כותב producer של Kafka לכל channel שהאפליקציה שולחת בו, listener לכל channel שהיא מקבלת בו, ו-record לכל סכמת payload.

### אילו תלויות זכאיות
\`GET /metadata/events-capable-deps\` — כיום \`kafka\`. לבקשה עם מסמך AsyncAPI ובלי \`kafka\`, התלות מתווספת.

### מי שולח מה
שתי הגרסאות של AsyncAPI מתארות כיוון במילים הפוכות (\`publish\`/\`subscribe\` של 2.x הם נקודת המבט של client; \`send\`/\`receive\` של 3.x הם של האפליקציה עצמה). האשף קורא את שתיהן כ**מה שהאפליקציה המתוארת עושה**.

### המגירה
- ה-channels שזוהו, כל אחד עם תיבות **Produce** ו-**Consume**. כל עוד לא נוגעים בהן, הן מראות מה עושה האפליקציה שהמסמך מתאר, ו**שום רשימת channels לא נשמרת**, כך שהפרויקט ממשיך לעקוב אחרי המסמך. **The other party** הופך את הכיוון של כל channel — הדרך לייצר צרכן של אירועים של מישהו אחר. כל שינוי ידני שומר את הרשימה.
- channel שאינו יכול להיות topic של Kafka (כתובת עם פרמטרים כמו \`users.{id}.inbox\`) מושבת, עם הסיבה.
- תתי-חבילות (ברירת מחדל \`events\` ו-\`events.model\`), ה-consumer group, ו-**Generate tests**.

### מה נכתב
- **\`<Channel>Producer\`** — \`send(key, payload)\` מעל ה-\`KafkaTemplate\` של הפרויקט; כמה סוגי הודעות על channel אחד נותנים מתודה לכל סוג.
- **\`<Channel>Listener\`** — \`@KafkaListener\` שקורא את ה-payload וקורא ל-\`handle(key, payload)\`, stub שהצוות ממלא. ה-group הוא זה שהוגדר במגירה, אחרת \`spring.kafka.consumer.group-id\`.
- **Payload records**, שנכתבים לפי מיפוי הטיפוסים של אשף OpenAPI (enums, \`allOf\`, sealed unions, אילוצים עם \`validation\`).
- כל שם topic כ-property, \`app.events.topics.<channel>\`, שמוגדר לכתובת של ה-channel ב-\`application.yaml\`.
- הודעות JSON עוברות כטקסט ומומרות עם ה-\`ObjectMapper\` של האפליקציה (\`spring-boot-starter-json\` מתווסף כששום דבר אחר לא מביא את Jackson).
- עם **Generate tests**: לכל producer, payload שנשלח דרך template מדומה (mock) ונקרא בחזרה; לכל listener, רשומה נכנסת. לא נדרש broker.`,
        callouts: [
          {
            type: 'info',
            text: 'Kafka בלבד: ה-bindings וה-servers של המסמך עצמו אינם נקראים. גם headers של הודעות, סכמות של key, correlation ids ו-traits אינם נקראים. כמו מסמכי OpenAPI, גם מסמך AsyncAPI חייב להיות עצמאי.'
          }
        ]
      },
      {
        id: 'events-wizard-avro',
        title: 'Payloads של Avro',
        description: 'channels שההודעות שלהם הן Avro: סכמות, ה-plugin של ה-build, והודעות בלי schema registry.',
        content: `### מתי זה חל
הודעה שה-\`schemaFormat\` שלה הוא \`application/vnd.apache.avro…\` (\`+json\`, \`+yaml\`) היא Avro; הסכמה שלה יכולה להיות כתובה במקום, מופנית, או ניתנת כטקסט JSON. channel הוא כולו Avro או כולו JSON — ערבוב נרשם כבעיה של ה-channel. המגירה מסמנת channels של Avro בתווית **Avro**.

### מה נכתב
- כל סכמת Avro כ-\`src/main/avro/<full name>.avsc\`.
- ה-build מקבל את \`org.apache.avro:avro\` 1.11.4 ואת ה-\`avro-maven-plugin\`, שמייצר את מחלקות ה-Java מקבצי ה-\`.avsc\` בזמן ה-build.
- \`AvroKafkaConfig\`: \`KafkaTemplate<String, byte[]>\` ו-listener factory שנבנים מהגדרות ה-Kafka של הפרויקט עצמו (servers, SASL). ה-beans של String נשארים עבור channels של JSON.
- producers שולחים את הרשומה כבתים ב-single-object encoding של Avro; listeners מפענחים אותה. כמה סוגי הודעות על channel אחד מובחנים לפי ה-fingerprint של הסכמה.

### בלי schema registry
ה-topic נושא את ה-fingerprint של הסכמה, לא id של registry, ולכן ה-producer וה-consumer חייבים להחזיק באותה סכמה. consumer שצריך לקרוא סכמה ישנה יותר מוסיף אותה ל-decoder שלו ידנית (ה-\`AvroKafkaConfig\` שנוצר מסביר איך).`,
        callouts: [
          {
            type: 'warning',
            text: 'ה-avro-maven-plugin אינו במאגר ה-Maven האופליין: Artifactory חייב להחזיק אותו לפני שפרויקט Avro ייבנה. payloads חייבים להיות records; קבצי .avpr / .avdl וסכמות מחוץ למסמך אינם נקראים.'
          }
        ]
      },
      {
        id: 'events-wizard-api',
        title: 'REST API',
        description: 'נקודות קצה ושדות הבקשה.',
        content: `### נקודות קצה

| שיטה | נתיב | מטרה |
|---|---|---|
| \`GET\` | \`/metadata/events-capable-deps\` | מזהי התלויות שזכאים לאשף (\`["kafka"]\`) |
| \`POST\` | \`/starter-wizard.detect-channels\` | \`{ spec }\` → \`[{name, address, sends, receives, messages, format, problem}]\` עבור המגירה |
| \`POST\` | \`/starter-wizard.zip\` / \`.preview\` | יצירה, עם \`asyncApiByDep\` ו-\`eventOptions\` |

מסמך שאי אפשר להשתמש בו נענה ב-400 \`{ "error": "Invalid AsyncAPI document", "messages": [...] }\`, עם הסיבה: אין שדה \`asyncapi\`, גרסה שאינה 2.x/3.x, אין channels, \`schemaFormat\` שאינו נתמך, \`$ref\` אל מחוץ למסמך. בקשה ל-channel שלא קיים, או לאותו channel פעמיים, או מצב שבו לא נשאר מה לייצר, נענים גם הם ב-400.`,
        fields: [
          { name: 'asyncApiByDep', type: 'object', required: false, description: 'מפת depId → מסמך ה-AsyncAPI.', example: '{ "kafka": "asyncapi: 3.0.0\\n..." }' },
          { name: 'eventOptions.<dep>.channels', type: 'array', required: false, description: '[{name, produce, consume}] — בדיוק ה-channels האלה, בכיוונים האלה. כשחסר: מה שהמסמך מתאר.', example: '[{ "name": "orderPlaced", "produce": false, "consume": true }]' },
          { name: 'eventOptions.<dep>.subPackage / payloadSubPackage', type: 'string', required: false, description: 'לאן הולכים ה-producers/listeners וטיפוסי ה-payload (ברירות מחדל events, events.model).', example: 'events' },
          { name: 'eventOptions.<dep>.groupId', type: 'string', required: false, description: 'ה-consumer group של ה-listeners.', example: 'billing' },
          { name: 'eventOptions.<dep>.generateTests', type: 'boolean', required: false, description: 'בדיקה לכל producer ולכל listener, בלי broker.', example: 'true' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // FRONTEND GENERATOR (React + TS + Vite + FSD)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'frontend-generator',
    title: 'מחולל Frontend',
    icon: 'web',
    topics: [
      {
        id: 'fe-what',
        title: 'מה זה מחולל ה-Frontend?',
        description: 'מחולל שני שמייצר פרויקטי React + TypeScript + Vite בארכיטקטורת Feature-Slice Design.',
        content: `### מטרה
אותו קטלוג מבוסס-DB שמייצר backend של Spring Boot מייצר גם פרויקטי frontend של **React + TypeScript + Vite** בארכיטקטורת [Feature-Slice Design](https://feature-sliced.design/). המפתח בוחר שם פרויקט, npm scope, תלויות ואפשרויות משנה, ולוחץ Generate — התשובה היא פרויקט frontend מכווץ, מוכן להתקנה ולהרצה.

לשונית **Frontend** יושבת ליד **Backend** ו-**Fullstack** בממשק הראשי. אותו פאנל אדמין מנהל את שני הקטלוגים; ה-pill של Backend ⇄ Frontend בו עובר ביניהם.

### למה נתיב שני במקום שימוש חוזר בנתיב של Spring?
מסגרת Spring Initializr כותבת פרויקטי Maven — היא לא יכולה לייצר \`package.json\` או \`vite.config.ts\`. לכן נתיב ה-frontend עוקף את המסגרת: \`FrontendStarterController\` קורא ל-\`FrontendProjectGenerator\`, שבונה תיקייה זמנית כמו שה-backend עושה ומכווץ אותה.

הוא **משתמש מחדש** בכל מה שלא תלוי בכלי הבנייה: \`DependencyConfigService\`, תרומות הקבצים (כל ארבעת הסוגים), אפשרויות המשנה, הפילטר \`InitializrWebConfiguration\`, ואותו מנוע Mustache עם אותן הסכמות (\`has<Dep>\`, \`opt<Dep><Option>\`, משתני המחלקה).

### דיסקרימינטור ProjectKind
קבוצות תלויות, רשומות, תרומות קבצים, build customizations, אפשרויות משנה, חוקי תאימות, starter templates ופלטות נושאים \`projectKind\` (\`BACKEND\` או \`FRONTEND\`). שני הקטלוגים חיים באותו מסד נתונים ולעולם לא רואים זה את זה.`,
        callouts: [
          {
            type: 'info',
            text: 'נתיב ה-frontend אינו עובר דרך מסגרת Spring Initializr. נקודות הקצה שלו נמצאות תחת `/frontend/*` (`/frontend/metadata`, `/frontend/starter.zip`, `/frontend/starter.preview`), בנפרד מ-`/starter.zip`.'
          }
        ]
      },
      {
        id: 'fe-using',
        title: 'שימוש בלשונית Frontend',
        description: 'מה מפתח רואה וממלא בעת יצירת פרויקט React.',
        content: `### פרויקט
- **Scope** (אופציונלי) — npm scope בלי ה-\`@\`. \`menora\` + \`my-app\` הופך ל-\`@menora/my-app\` ב-\`package.json\`.
- **Project Name** — שם התיקייה וערך \`package.json "name"\`. ה-App Title נגזר ממנו אוטומטית.
- **App Title** — ה-\`<title>\` של לשונית הדפדפן וה-\`HomePage\` לדוגמה.
- **Description** — ערך \`package.json "description"\`.
- **Department** — מתוך **Config → Departments**; נכתב לקבצי הפריסה.

### אפשרויות
- **React**, **Node** ו-**Package Manager** — הרשימות של **Config → Versions** (React 18 / 19, Node 20 / 22 / 18, pnpm / npm), נפתחות על ברירות המחדל שלהן.
- **Design System** — ללא, shadcn, MUI, Chakra, Mantine או Menora Digital; בוחר הפלטה מופיע עבור אלה שיש להם theme (MUI, Chakra, Mantine).
- **Base Path** — ה-\`base\` של Vite לפריסות תחת תת-נתיב (ברירת מחדל \`/\`).
- **RTL layout** — \`dir="rtl"\` על הדף.
- **Paired Backend** (אופציונלי) — ה-URL וה-artifact id של ה-backend, עבור ה-dev proxy ו-API client.

### תלויות
אותה תבנית של chips + רשימה מקובצת כמו בלשונית ה-Backend: Routing, State Management, Data Fetching, Styling, Design System, Forms & Validation, Animation, Testing, Quality (פעיל כברירת מחדל), Extras, API Integration. תלות יכולה לחשוף אפשרויות משנה אחרי שנבחרה.

### Generate
Generate קורא ל-\`/frontend/starter.zip\` עם הטופס, התלויות ורשימות \`opts-{depId}\` לכל תלות; Explore מציג קודם את הקבצים. ללשונית יש presets משלה ו-state שמור משלה — שום דבר לא משותף עם לשונית ה-Backend.`
      },
      {
        id: 'fe-admin-pill',
        title: 'אדמין: ה-Pill של Backend ⇄ Frontend',
        description: 'איך הטוגל בכותרת האדמין מגביל את לשוניות הקטלוג לקטלוג אחד.',
        content: `### איפה למצוא
פתחו Config (Admin). בכותרת יש pill toggle: **Backend** | **Frontend**. ה-kind הנוכחי נשמר בדפדפן.

### על מה זה משפיע
הלשוניות האלה מציגות את השורות של ה-kind הנוכחי ומסמנות \`projectKind\` על כל שורה חדשה: **Dep Groups**, **Dependencies**, **File Contribs**, **Build Custom.**, **Sub-Options**, **Compatibility** ו-**Templates** (starter templates).

### לשוניות שמוצגות ל-kind אחד בלבד
- Backend בלבד: **Modules**, **Entity CRUD**, **Fullstack Examples**, **Schema sources**.
- Frontend בלבד: **Palettes**.
- שניהם, על פני שני ה-kinds: **Overview**, **Activity**, **History**, **Versions**, **Departments**.`,
        callouts: [
          {
            type: 'warning',
            text: 'אם יוצרים שורה תחת ה-pill הלא נכון — למשל מוסיפים `state-zustand` כשה-pill על Backend — היא מופיעה בקטלוג של Spring ושוברת את יצירת ה-backend לכל מי שבוחר בה. בדקו את ה-pill לפני שלוחצים New.'
          }
        ]
      },
      {
        id: 'fe-build-types',
        title: 'סוגי Build Customization של Frontend',
        description: 'ADD_NPM_DEPENDENCY, ADD_NPM_SCRIPT ו-ADD_VITE_PLUGIN — שימוש חוזר בשדות קיימים עם משמעויות חדשות.',
        content: `### שימוש חוזר בסכמה
במקום להוסיף ישות חדשה, ל-\`BuildCustomizationEntity\` יש שלושה סוגי frontend שהעמודות שלהם **מתפרשות מחדש**:

| Type | פרשנות השדות |
|---|---|
| \`ADD_NPM_DEPENDENCY\` | \`mavenArtifactId\` = שם חבילת npm (למשל \`react-router-dom\`); \`version\` = טווח semver (למשל \`^6.26.0\`); \`scope\` = \`"dev"\` → \`devDependencies\`, כל ערך אחר → \`dependencies\`; שער \`subOptionId\` אופציונלי |
| \`ADD_NPM_SCRIPT\` | \`mavenArtifactId\` = שם הסקריפט (למשל \`lint:fix\`); \`version\` = פקודה (למשל \`eslint . --fix\`). שורות מאוחרות עם אותו שם דורסות קודמות |
| \`ADD_VITE_PLUGIN\` | \`mavenGroupId\` = נתיב import (למשל \`@vitejs/plugin-react\`); \`mavenArtifactId\` = שם ה-binding של ה-import (למשל \`react\`); \`version\` = ביטוי קריאה (למשל \`react()\`) |

### איך הם מיושמים
- **\`PackageJsonBuilder\`** מבצע render ל-\`templates/frontend/fe-package-base.mustache\` (שכבר מכיל את \`react\` ו-\`react-dom\` בגרסת ה-React שנבחרה), ואז מוסיף כל שורת \`ADD_NPM_DEPENDENCY\` ו-\`ADD_NPM_SCRIPT\`. המפתחות ממוינים אלפביתית לדיפים יציבים.
- **\`ViteConfigBuilder\`** מבצע render ל-\`templates/frontend/fe-vite-config.mustache\` עם ה-imports וקריאות ה-plugin של שורות \`ADD_VITE_PLUGIN\` (\`{{vitePluginImports}}\`, \`{{vitePluginCalls}}\`).

### חבילות וסקריפטים שתמיד פעילים
שורות \`__common__\` נותנות לכל פרויקט את \`typescript\`, \`vite\`, \`@vitejs/plugin-react\`, \`@fontsource/inter\` ואת ערימת האיכות (\`eslint\`, \`@eslint/js\`, \`typescript-eslint\`, \`eslint-plugin-react-hooks\`, \`eslint-plugin-react-refresh\`, \`globals\`, \`prettier\`, \`husky\`, \`lint-staged\`), וגם את הסקריפטים \`lint:fix\`, \`format:check\` ו-\`typecheck\`. שורת \`@vitejs/plugin-react\` היא שורת ה-\`ADD_VITE_PLUGIN\` היחידה ב-\`__common__\`.

### טופס אדמין מודע ל-Kind
כשה-pill על Frontend, הטופס של **Build Custom.** מציע רק את שלושת סוגי ה-frontend, עם תוויות מתאימות — *Package Name*, *Script Name*, *Command*, *Import Path*, *Import Binding*, *Plugin Call* — במקום עמודות ה-Maven שמתחת.`,
        callouts: [
          {
            type: 'tip',
            text: 'הוספת חבילת npm חדשה דרך האדמין היא שורה אחת: העבירו את ה-pill ל-**Frontend**, פתחו **Build Custom. → New Customization**, בחרו `ADD_NPM_DEPENDENCY`, מלאו **Package Name** ו-**Version**, סמנו **devDependency?** אם היא שייכת ל-`devDependencies`, ושמרו. build customizations נקראות בכל יצירה, כך שהפרויקט הבא כבר יקבל אותה.'
          }
        ]
      },
      {
        id: 'fe-structure',
        title: 'מה נוצר',
        description: 'מה כל פרויקט מקבל, ומה התלויות מוסיפות.',
        content: `### מבנה בסיסי
כל פרויקט frontend שנוצר כולל:

- **בנייה וקונפיגורציה** — \`package.json\`, \`vite.config.ts\`, \`tsconfig.json\`, \`tsconfig.node.json\` עם aliases של נתיבים \`@app/@pages/@widgets/@features/@entities/@shared\` גם ב-Vite וגם ב-TypeScript; \`src/vite-env.d.ts\`; \`.env.development\` ו-\`.env.example\`.
- **כניסה** — \`index.html\` (\`{{appTitle}}\`, ו-\`dir="rtl"\` כשביקשו), \`src/main.tsx\` שמרכיב את \`<App/>\`, ו-\`HomePage\` עובד תחת \`src/pages/home/ui/\`.
- **איכות** — \`eslint.config.js\` (flat config), \`.prettierrc.json\`, \`.husky/pre-commit\` שמריץ \`lint-staged\`. תמיד פעיל.
- **CI / פריסה** — \`Dockerfile\` רב-שלבי לכל גרסת Node (node → nginx), \`nginx/nginx.conf\` עם SPA fallback שמאזין על \`\${PORT}\` (3000, מה שה-values של k8s מצפים לו), \`entrypoint.sh\` שמציב אותו ואת ה-upstream של ה-API, \`k8s/Jenkinsfile\`, \`k8s/values.yaml\`, \`settings.xml\`, \`VERSION\`, \`.editorconfig\`, \`.dockerignore\`.
- **כל 6 שכבות ה-FSD** — \`src/app\`, \`src/pages\`, \`src/widgets\`, \`src/features\`, \`src/entities\`, \`src/shared\` — לכל אחת barrel \`index.ts\` ו-\`README.md\` קצר.

### קבצים תלויי תלות
רוב התלויות מוסיפות קבצים, לא רק חבילות: ה-routers (routes ו-layout), Zustand ו-Redux Toolkit (store), TanStack Query (client ו-provider), shadcn (הרכיבים שלו, לפי אפשרות משנה), MUI, Chakra ו-Mantine (provider עם theme), Menora Digital (ה-tokens, הרכיבים והלוגו של מערכת העיצוב), MSAL (קונפיגורציית ה-auth), Storybook, react-hook-form, ה-OpenAPI client, Playwright, Tailwind (\`tailwind.config.js\`, \`postcss.config.js\`, \`src/index.css\`), ו-Vitest + Testing Library (\`vitest.config.ts\`, \`src/test-setup.ts\`, בדיקה של \`HomePage\` ו-workflow של CI).`,
        callouts: [
          {
            type: 'info',
            text: 'גם Mustache וגם JSX משתמשים ב-`{{` כפותח טוקן — אובייקטי inline-style כמו `style={{ color: "red" }}` מתנגשים. ה-`HomePage.tsx` הזרוע מעביר את הסגנונות ל-`const` ברמת המודול, וזה הפתרון הנקי ביותר. אם אתם כותבים שורת TEMPLATE שזקוקה לסוגריים כפולים של JSX, השתמשו באותו דפוס.'
          }
        ]
      },
      {
        id: 'fe-curl',
        title: 'API Reference (curl)',
        description: 'קריאה ישירה ל-/frontend/metadata ו-/frontend/starter.zip.',
        content: `### Metadata
\`\`\`bash
curl http://localhost:8080/frontend/metadata | python -m json.tool | head -60
\`\`\`

מחזיר את ברירות המחדל של הטופס, את רשימות React/Node/package-manager, את גרסאות TypeScript/Vite המקובעות, את הפלטות ואת קטלוג ה-FRONTEND (קבוצות → רשומות → אפשרויות משנה).

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

פרמטרים נוספים: \`description\`, \`basePath\`, \`colorPalette\`, \`rtl\`, \`apiBaseUrl\`, \`backendArtifactId\`. \`/frontend/starter.preview\` מקבל את אותם פרמטרים ומחזיר את עץ הקבצים. אפשרויות משנה עוקבות אחר ההסכמה של ה-backend, \`opts-{depId}=opt1,opt2\`.`,
      },
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // FULLSTACK CRUD GENERATOR
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'fullstack-generator',
    title: 'מחולל CRUD מלא',
    icon: 'dynamic_form',
    topics: [
      {
        id: 'fs-what',
        title: 'מה זה המחולל המלא?',
        description: 'מתארים את הישויות ומקבלים backend עובד ב-Spring Boot ו-frontend ב-React, מחוברים יחדיו, ב-ZIP אחד.',
        content: `### מטרה
לשונית **Fullstack** מקבלת מודל ישויות — ישויות עם שדות וקשרים, ועוד עמודים, workflows, כללי גישה ואפשרויות — ומייצרת ZIP אחד שמכיל backend עובד של Spring Boot (\`backend/\`) ו-frontend של React (\`frontend/\`), כבר מחוברים יחדיו. כל ישות מקבלת entity, repository, DTO, service ו-REST controller (דפדוף, מיון, חיפוש, מסננים, endpoint של \`/stats\` לתרשימים) ואת מסכי הרשימה, הטופס והפרטים שלה.

רוב המערכות הפנימיות של מנורה שנכתבות מחדש הן "טבלאות עם CRUD וכמה מסכים סביבן". המחולל הופך כל מערכת חדשה כזו מימים של קוד דבק לכמה דקות.

### איך זה בנוי
- **Backend** עובר דרך ה-pipeline הסטנדרטי של Spring Initializr, כך שקטלוג התלויות חל כרגיל; \`FullstackProjectGenerationConfiguration\` מוסיף את הקוד פר-ישות מ**סט התבניות** של ה-backend.
- **Frontend** הוא הפרויקט של מחולל ה-Frontend, שנפרש ראשון, וסט התבניות של ה-frontend מרונדר מעליו (מסכי ה-CRUD, המעטפת, רכיבי ה-UI המשותפים והעיצוב שלהם).
- ב-root נוספים \`README.md\`, \`.gitignore\`, \`.gitattributes\`, \`compose.yaml\` ו-\`menora-model.json\`.

### מה המודל יכול לתאר
- **טיפוסי שדה**: טקסט, טקסט ארוך, Markdown, מספרים שלמים, מספרים עשרוניים, כסף עם מטבע, כן/לא, תאריך, שעה, תאריך-ושעה, instant, UUID, enum (עם תוויות), וקבצים ותמונות מצורפים.
- **קשרים**: רבים-לאחד (foreign key), רבים-לרבים (טבלת קישור), אחד-לרבים (השורות שמצביעות לכאן — ואפשר לערוך אותן בתוך הטופס של האב, **composition**).
- **גישה**: מי רשאי לקרוא ומי רשאי לכתוב בכל ישות, נאכף ע״י ה-backend.
- **Workflows**: סטטוס שמשתנה רק דרך מעברים בעלי שם, עם תפקידים, אחראי (assignee), תאריך יעד, תיבת משימות (inbox), יומן מעברים ומיילים.
- **כללים**: בדיקות על כמה שדות, שדות שמוצגים רק כשתנאי מתקיים, שדות מחושבים, מפתחות ייחודיים, טקסט עזרה.
- **עמודים**: דשבורדים, רשימות, רשומות, דוחות, אשפים, לוחות, לוחות שנה ועוד — ראו **עמודי הפרונטאנד**.`,
        callouts: [
          {
            type: 'info',
            text: 'לשונית Fullstack בלתי תלויה בלשוניות Backend ו-Frontend. היא שולחת גוף JSON ל-`/starter-fullstack.zip` (ו-Explore ל-`/starter-fullstack.preview`), והשרת בודק את הבקשה כולה — תשובת 400 אומרת היכן במודל נמצאת הבעיה, והעורך פותח את המקום הזה.'
          }
        ]
      },
      {
        id: 'fs-using',
        title: 'שימוש בלשונית Fullstack',
        description: 'מדוגמה או מסכמה ועד פרויקט עובד שהורד.',
        content: `### מתחילים ממשהו
- **Examples** (דוגמאות) — Blog, Orders, Tickets, Inventory, Course enrolments, Sales reporting, Project planning ו-Approvals, וכל אחת מהן מציגה חלק אחר של המודל (מנהלים מנהלים אותן תחת **Config → Fullstack Examples**).
- **Presets ו-recents** (בדפדפן הזה), מודלים של **Team** (משותפים בשרת), **Import JSON** (קובץ ייצוא, או \`menora-model.json\` של פרויקט שנוצר).
- **Import from DDL** — SQL מודבק, קובץ \`.sql\`, מסד נתונים חי או view מסוג SELECT (ראו **ייבוא מ-DDL**).

### מקטעי העורך
**Project metadata**, **Backend** (סט התבניות של ה-backend), **Frontend** (סיכום; המראה שלו נערך בתצוגת Appearance של מעצב הפריסה), **Options** (אפשרויות ה-scaffold), **Dependencies** (מסומנות מראש לפי ברירות המחדל של סט ה-backend), **Entities** ו-**Pages**. מקטע עם בעיות מציג נקודה אדומה בסרגל המקטעים; Explore ו-Generate אומרים כמה בעיות יש וקופצים לראשונה שבהן.

### כרטיס ישות
- טבלת השדות: שם, תווית, טיפוס, ודגלים ל-key, generated, required, unique. פאנל **More** של כל שורה מכיל את האילוצים (אורך, min/max, תבנית, דוא״ל), ערך ברירת המחדל, **help text**, **show when** ו-**computed as**.
- **Relations** — סוג, יעד, תווית; קשר אחד-לרבים מציין את הקישור שהוא קורא דרכו, ואפשר לערוך אותו בטופס.
- **Settings** — תוויות, טבלה וסכמה, view מסוג SELECT, **who may read / write**, **unique together**, **rules**.
- **Workflow** — שדה הסטטוס, מעברים (עם תפקידים, שדות חובה ומיילים), אחראי ותאריך יעד.
- **Overrides** — אפשרויות ה-scaffold לישות הזו בלבד; **Preview UI** — הדמיה של הרשימה והטופס שלה.
- הצעות (בכתום) מציעות תיקונים בלחיצה אחת; כל פעולה ניתנת לביטול (Ctrl+Z), ואפשר לשתף את המודל כקישור.

### Generate, ואז הרצה
Generate שולח את המודל ל-\`/starter-fullstack.zip\`; אחר כך כרטיס מציג את הצעדים הבאים. פותחים את ה-ZIP, ואז אחת משתי הדרכים:
- \`docker compose up --build\` ופותחים את http://localhost:3000; או
- \`cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=local\` (הפרופיל \`local\` נותן למפתח את \`dev-user\` ואת התפקידים שלו בלי LDAP), ו-\`cd frontend && npm install && npm run dev\` → http://localhost:5173.

### שינויים בהמשך
שמרו את הפרויקט ב-git. אחרי שינוי במודל, **Download update** נותן patch להחלה על הפרויקט, במקום ZIP חדש להעתיק מעליו — ראו **עדכון פרויקט במקום יצירה מחדש**.`,
        callouts: [
          {
            type: 'tip',
            text: 'החלפת סט התבניות של ה-backend שומרת את התלויות שהמפתח הוסיף. Reset (בסרגל הפעולות הנעוץ) מחזיר את כל העורך למודל ההתחלתי, ואפשר לבטל אותו.'
          }
        ]
      },
      {
        id: 'fs-model',
        title: 'גישה, Workflows וכללים',
        description: 'מה המודל אוכף ב-backend שנוצר, ומה לא.',
        content: `### גישה
כשתלות ldap-auth נמצאת ב-build — \`ldap-auth-rest\` נמצאת בברירות המחדל של שני סטי ה-backend — כל endpoint נבדק מול התפקידים של הקורא. כל ישות מגדירה מי רשאי **לקרוא** בה ומי רשאי **לכתוב** בה: כל מי שמחובר, משתמשים, או מנהלים (ברירת מחדל: משתמשים קוראים, מנהלים כותבים; מנהל הוא גם משתמש). הקבוצות מגיעות משירות ה-LDAP REST; במחשב של מפתח, הפרופיל \`local\` נותן ל-\`dev-user\` את התפקידים שלו. ה-frontend שנוצר הולך בעקבות זה: הוא מציע New, Edit, Delete, Import ושינויים מרוכזים רק לקורא שרשאי לכתוב, ומציג רק את העמודים שהקורא רשאי לפתוח. גם \`roles\` של עמוד מגבילים אותו.

הגישה היא לפי תפקיד, לא לפי שורה: "רק השורות שאני יצרתי" הוא קוד שהצוות מוסיף.

### Workflows
ישות יכולה לשאת workflow: הסטטוס שלה משתנה רק דרך **מעברים** (transitions) בעלי שם (\`POST /api/x/{id}/transitions/{name}\`), שכל אחד מהם מוגבל לתפקידים ואולי מבקש שדות; **אחראי** (assignee) שאפשר לקחת, לשחרר ו(מנהלים) להעביר לאחר; **תאריך יעד**; עמוד **inbox** עם התורים "mine / unassigned / open" (שלי / לא משויכות / פתוחות). **Keep a log of moves** מוסיף לרשומה מקטע History. ה-**e-mails** של מעבר מודיעים לאחראי, ליוצר (דורש את אפשרות ה-audit), למנהלים או למשתמשים — והם נשלחים רק אחרי שהאפליקציה שנוצרה הוגדרה (\`app.events.mail.enabled: true\` ו-\`spring.mail.host\`).

### כללים, Show-When, שדות מחושבים
- **Rules** — בדיקות על כמה שדות בשפת ביטויים קטנה (\`endsOn >= startsOn\`, \`when status == 'DONE': not isEmpty(estimate)\`), שנבדקות ע״י הטופס וע״י ה-backend לפני כל שמירה. ערך ריק גורם לכלל להתקיים.
- **Show when** — שדה שמוצג רק כל עוד תנאי מתקיים, ומנוקה ע״י ה-backend כל עוד התנאי לא מתקיים.
- **Computed as** — עמודה שמורה שה-backend קובע מנוסחה בכל שמירה, לקריאה בלבד בטופס.
- **Unique together** — אילוץ על כמה שדות וקישורים, שנענה ב-409 שמציין אותם.

העורך בודק כל ביטוי תוך כדי הקלדה, באותם כללים כמו השרת.`
      },
      {
        id: 'fs-options',
        title: 'אפשרויות Scaffold',
        description: 'האפשרויות ברמת הפרויקט, שכל ישות יכולה לדרוס כל אחת מהן.',
        content: `### האפשרויות
| אפשרות | מה האפליקציה שנוצרת מקבלת |
|---|---|
| \`tests\` (דולקת במודל חדש) | בדיקת API לכל ישות מול ה-controller וה-service האמיתיים ו-H2 בזיכרון, ועוד בדיקות Vitest לכל טופס ועמוד רשימה |
| \`audit\` | מתי נוצר/עודכן **ומי עשה זאת**; מסנן "Changed by me" |
| \`history\` | כל שינוי בשורה נשמר, עם הערכים לפני ואחרי; מנהל יכול לשחזר גרסה קודמת |
| \`events\` | כל שינוי נכתב ל-outbox ונשלח ל-topic של Kafka לכל ישות (עם \`kafka\`), ל-webhooks חתומים ולדפדפנים הפתוחים, שמתרעננים מיד |
| \`softDelete\` | שורות שנמחקו נשמרות וניתנות לשחזור (Undo במחיקה) |
| \`optimisticLocking\` | עמודת גרסה; שמירה מיושנת היא 409, והטופס מציע לטעון מחדש או לדרוס |
| \`csvExport\` / \`xlsxExport\` | ייצוא הרשימה המסוננת כ-CSV / כחוברת Excel |
| \`csvImport\` | העלאת CSV, נבדק שורה אחר שורה, הכל או כלום |
| \`bulkDelete\` / \`bulkUpdate\` | בחירת שורות ומחיקתן, או קביעת ערך של שדה בכולן |
| \`inlineEdit\` | עריכת תאי טבלה במקום |
| \`savedViews\` | תצוגות בעלות שם של רשימה (חיפוש, מסננים, מיון, עמודות) שנשמרות בשרת לכל משתמש |
| \`inverseCollections\` | אב מציג ספירה של הילדים שלו |
| \`openapi\` | אנוטציות springdoc ו-Swagger UI |
| \`seedData\` | שמונה שורות דמו לכל ישות בהפעלה הראשונה |

\`secured\` הוצאה משימוש (הגישה מוגדרת עכשיו לכל ישות); מודל שמציין אותה עדיין עובר אימות. פאנל **Overrides** של ישות מכבה (או מדליק) אפשרות עבורה בלבד; העורך אומר מתי אפשרות לא יכולה לחול על ישות (view, מפתח מורכב, ישות לקריאה בלבד).`
      },
      {
        id: 'fs-pages',
        title: 'עמודי הפרונטאנד',
        description: 'לעצב את הפרונטאנד שנוצר כעמודים — דשבורדים, רשימות, לשוניות, אב-פרט, רשומות, דוחות, אשפים, טפסים, תיבות משימות, לוחות שנה, לוחות, עצים, תוכן, ייבוא וחיפוש — במקום המעטפת הקלאסית הקבועה.',
        content: `### מעטפת קלאסית או פריסה
בלי פריסה, האפליקציה שנוצרת מכילה דשבורד ועמוד רשימה אחד לכל ישות. הסעיף **Frontend pages** (מתחת ל-Entities) מחליף זאת בעמודים משלכם. **Start from my entities** זורע דשבורד ורשימה לכל ישות, הדוגמאות מגיעות עם פריסות ללמוד מהן, ו-**Use classic layout** מוותר על הפריסה (ניתן לביטול).

### מעצב הפריסה
הסעיף הוא כרטיס: הפריסה כמפת אתר קטנה, הבעיות שלה, והכפתור **Open designer**. המעצב ממלא את המסך:
- **Library** (ספרייה, משמאל) — סוגי עמודים, הצעות לפי הישויות שלכם, תבניות העמוד השמורות שלכם, **team templates** (תבניות צוות), ווידג'טים (עם הצעות לישות שעליה אתם עובדים) ותבניות פריסה שלמות. גררו כרטיס למקום שבו הוא צריך להיות, או לחצו עליו כדי להוסיף אותו בסוף. בעמוד tabs, report, record או wizard הספרייה מציעה במקום זאת את ה-**parts** (החלקים) של אותו עמוד.
- **Canvas** (קנבס, באמצע) — פס העמודים מעל תצוגה חיה של העמוד הנבחר, עם נתוני דוגמה. לחיצה על ווידג'ט עורכת אותו, גרירה מזיזה אותו או משנה את גודלו, ולחיצה כפולה על כותרת משנה את שמה. זום, רוחב Mobile ו-Tablet, ומתג Data · Empty · Loading · Error.
- **Play mode** (\`P\`) עובר על הפריסה כפי שהאפליקציה שנוצרת הייתה מתנהגת: שורות פותחות את עמוד הרשומה שלהן, New פותח את הטופס, ותרשים צולל אל הרשימה שלו.
- **Inspector** (מפקח, מימין) — הגדרות הווידג'ט הנבחר, או ה-**Basics**, ה-**Layout** וה-**Access** של העמוד, ולשונית **Code** עם הקבצים שהעמוד מייצר.
- **Appearance** קובע את מראה האפליקציה: סט התבניות של הפרונטאנד, פלטת הצבעים, השפה, ימין-לשמאל, וכותרת הדשבורד הקלאסי.
- **Sitemap** משנה שמות וסדר של מקטעי הניווט וקובע את סגנון התפריט ואת כלי הכותרת; **Page flow** משרטט איך עמודים מובילים זה לזה ומסמן את אלה ששום דבר לא מוביל אליהם.
- ווידג'טים מועתקים, נגזרים ומודבקים (Ctrl+C / X / V), עוברים לדשבורד אחר, ואפשר לשמור אותם או לשתף אותם עם הצוות. **Export spec** כותב את כל הפריסה כקובץ HTML אחד שעובד offline.

### סוגי העמודים
- **Dashboard** — ווידג'טים על רשת של ארבע עמודות: אריחי מספר (אופציונלית עם קו מגמה או השוואה לתקופה הקודמת), תרשימי התפלגות, דונאט ומוערם, מגמות, שורות אחרונות, רשימות מובילים, התקדמות ליעד, מדי מחוג, משפכים, זמן במצב, טבלאות pivot, פיד פעילות, רשימה מוטמעת, קישורים לעמודים אחרים והערות טקסט. בורר תקופה ועד ארבעה **filters** (מסננים) חלים על כל ווידג'ט שהם מתאימים לו; ווידג'ט יכול **drill to** (לצלול אל) רשימה או דוח.
- **List** — הטבלה של ישות אחת, או כרטיסים, לוח, לוח שנה או **gallery** (גלריה, עם שדה תמונה). אפשר לפתוח אותה מסוננת, עם עמודות נבחרות, מיון, תצוגה וגודל עמוד, לפתוח שורות במגירה, בחלונית צד או בעמוד הרשומה, ולהפעיל **hide actions** (הסתרת הפעולות New, Edit, Delete, Export, Import, bulk).
- **Tabs** — שניים עד שישה עמודים אחרים זה לצד זה.
- **Master–detail** — רשימת אב לצד שורות הבן של האב הנבחר, אופציונלית עם הכרטיס של האב.
- **Record** — שורה אחת, עם הרשימות הקשורות כלשוניות, אריחי מספר מעליהן, ולפי בקשה כפתור Print.
- **Report** — סרגל הסינון של ישות, אחד עד ארבעה תרשימים (עמודות, דונאט, מוערם, קו, שטח או טבלת סיכומים) וסיכומים מקובצים.
- **Wizard** — טופס יצירה (ועריכה) מפוצל לשלבים, עם סקירה לפני השמירה.
- **Form** — הטופס המלא של ישות בעמוד משלו; הוא מחליף את New ואת Edit.
- **Inbox** — המשימות של workflow בתורים (שלי, לא משויכות, כל הפתוחות), עם המעברים שלהן.
- **Calendar** — שורות לפי תאריך, כחודש, שבוע, סדר יום או ציר זמן.
- **Board** — כרטיסים בנתיבים לפי שדה enum או כן/לא, שמוזזים בגרירה או בתפריט; דרך ה-workflow כשהנתיבים הם המצבים שלו.
- **Tree** — ישות שמצביעה על עצמה, כמתאר היררכי.
- **Content** — עמוד טקסט עם קישורים לעמודים אחרים.
- **Import** — העלאת CSV לישות אחת, שנבדקת לפני שדבר נשמר.
- **Search** — תיבת חיפוש אחת על כמה ישויות.

### איך הניווט נבנה
- העמוד הראשון בניווט הוא **עמוד הפתיחה**.
- עמודים שחולקים **קבוצה** מוצגים יחד כמקטע אחד. התפריט הוא סרגל צד או סרגל עליון, והכותרת יכולה לשאת **תפריט משתמש**, **פעמון התראות** (מהתורים של ה-workflows) ו-**לוח פקודות** (Ctrl+K).
- עמוד **מוסתר** נמצא מחוץ לניווט (רשימה שהוסתרה כך מופיעה רק כלשונית; אשף או טופס מוסתרים הם עדיין נתיב).
- **תפקידים** (ADMIN, USER) מגבילים עמוד; הם דורשים תלות ldap-auth.

### בעיות ואזהרות
בעיות אדומות חוסמות את Generate: ישות או שדה שכבר לא קיימים, יעד לשונית חסר, מזהה שמשמש פעמיים. **אזהרות** כתומות אינן חוסמות — הן מציינות מבואות סתומים: עמוד מוסתר שאף עמוד לא מטמיע, תרשים בלי רשימה לצלול אליה, ישות שאף עמוד לא מאפשר לאף אחד ליצור. לרובן יש **Fix**; **Fix all** מחיל את כל התיקונים כצעד ביטול אחד.`,
        callouts: [
          {
            type: 'tip',
            text: 'העורך מאמת פריסה בדיוק כפי שהשרת מאמת אותה ב-Generate, כך שסעיף ירוק פירושו שהבקשה תעבור. אם השרת בכל זאת דוחה עמוד, העורך פותח אותו ומדגיש את הבעיה.'
          }
        ]
      },
      {
        id: 'fs-import-ddl',
        title: 'ייבוא מ-DDL',
        description: 'ממלאים את עורך הישויות מראש מ-SQL, ממסד נתונים חי או מ-view מסוג SELECT.',
        content: `### מתי להשתמש
כבר יש לכם סכמה ואתם לא רוצים להקליד כל שדה. ה-drawer קורא אותה ומציג את הישויות שמצא; סמנו את אלה שיש לייבא (קשר לישות שלא סומנה מוצג מחוק בקו), ואז **Import N of M**. אם בעורך כבר יש ישויות, בחרו Replace או Append.

### שלושה מקורות
- **Paste SQL** (או גרירת קובץ \`.sql\`) — הצהרות \`CREATE TABLE\`, עם דיאלקט. \`POST /metadata/fullstack/import-ddl\`.
- **From a database** — פאנל הסכמה החיה (ראו **קריאה ממסד נתונים חי** של אשף ה-SQL): מקור או חיבור מוקלד, סכמה, הטבלאות וה-views. \`POST /metadata/fullstack/import-live\`. ה-views חוזרים לקריאה בלבד, עם טיפוסים לעמודות שלהם.
- **A SELECT** — שאילתה אחת הופכת לישות view לקריאה בלבד (\`@Subselect\`). \`POST /metadata/fullstack/import-select\`.

### מה נשמר
- טיפוסים: \`BIGSERIAL\` → LONG + generated, \`NUMERIC(p,s)\` → BIG_DECIMAL, \`UUID\` → UUID, \`TIME\` → LOCAL_TIME, timestamp עם אזור זמן → INSTANT, \`TEXT\` → TEXT.
- מפתחות ראשיים (גם מורכבים), אורכים, NOT NULL, UNIQUE ברמת עמודה.
- foreign key לטבלה באותו ייבוא → **קשר רבים-לאחד** (העמודה יוצאת מרשימת השדות).
- \`CHECK (col IN ('A','B'))\` → **enum**.
- שמות העמודות והטבלאות בדיוק כפי שמסד הנתונים מאיית אותם, כך שהישות ממופה על הסכמה הקיימת.

### מאבד מידע בכוונה
| מקור | הופך ל | למה |
|---|---|---|
| \`SMALLINT\` | INTEGER | אין טיפוס short |
| \`FLOAT\` / \`DOUBLE\` | BIG_DECIMAL | הטיפוס המספרי הקרוב ביותר |
| \`BYTEA\` / \`BLOB\` | STRING | להעלאות השתמשו בשדה FILE או IMAGE |
| foreign key מורכב, או כזה שמפנה לטבלה שלא יובאה | שדה רגיל | קשר במודל צריך יעד עם מפתח יחיד |

### שגיאות פרסור
DDL לא תקין מחזיר 400 שמציין את ההצהרה; ה-drawer מציג אותה inline ושומר את מה שהקלדתם.`,
        codeExamples: [
          {
            title: 'דוגמה — PostgreSQL, עם קשר ו-enum',
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
        title: 'תלויות וברירות מחדל פר-סט',
        description: 'איך רשימת התלויות מאותחלת, ומה המחולל מוסיף מעצמו.',
        content: `### סמנטיקת ה-Wire
| בקשה | התנהגות |
|---|---|
| **\`dependencies\` חסר** | תלויות ברירת המחדל של סט ה-backend |
| **\`dependencies: []\`** | בלי תוספות |
| **\`dependencies: [...]\`** | הרשימה הזו — ברירות המחדל של הסט לא ממוזגות אליה |

תהיה הרשימה אשר תהיה, כללי התאימות חלים אחר כך (REQUIRES מוסיף את היעד שלו, CONFLICTS הוא 400), וחלק מהאפשרויות מביאות את מה שהן צריכות: \`openapi\` מוסיפה את springdoc, מייל של workflow מוסיף את ה-mail starter, ו-\`tests\` רץ על H2 בזיכרון ב-scope של test.

### מאיפה ברירות המחדל מגיעות
כל סט backend נושא תלויות ברירת מחדל (\`entity_template_set_default_dep\`). בשני הסטים שמגיעים עם המערכת יש \`data-jpa, web, h2, validation, actuator, ldap-auth-rest\` — \`ldap-auth-rest\` כי כללי גישה, תפקידי עמודים ותפקידי workflow צריכים אותה. כדי לשנות אותן: **Config → Entity CRUD → edit the set → Default Dependencies**.

### מסד נתונים אמיתי
החליפו את \`h2\` במסד הנתונים (\`postgresql\`, \`mssql\`, \`oracle\`, \`db2\`) במקום להוסיף אותו לצידו — כששניהם קיימים, H2 נשאר ה-datasource של האפליקציה. הוסיפו גם \`flyway\`: אז המודל הוא ה-migration הראשון (\`V1__init.sql\`, שנכתב עבור מסד הנתונים הזה) ו-Hibernate רק מאמת את הסכמה. בלי Flyway, אפליקציה על מסד נתונים אמיתי עולה בלי טבלאות.`,
        callouts: [
          {
            type: 'warning',
            text: 'בלי תלות ldap-auth שום דבר לא נבדק: כל endpoint פתוח, ולכללי גישה ולתפקידי עמודים אין השפעה (תפקידים הם אז 400). השאירו את ldap-auth-rest אלא אם האפליקציה פתוחה בכוונה.'
          }
        ]
      },
      {
        id: 'fs-generated',
        title: 'הפרויקט שנוצר',
        description: 'מה יש ב-ZIP של fullstack, ואיך צוות בונה, מריץ, בודק ומגדיר אותו.',
        content: `### מבנה
\`backend/\` (פרויקט Maven, עם כל מה שיש לפרויקט מלשונית Backend: Dockerfile, קבצי k8s, פרופיל Vault…), \`frontend/\` (Vite + React), וב-root \`README.md\`, \`compose.yaml\`, \`menora-model.json\`, \`.gitignore\`, \`.gitattributes\`.

### הרצה
- **הכל ב-Docker**: \`docker compose up --build\`, ואז http://localhost:3000 (ה-API על :8080). מסד הנתונים, אם יש, עולה יחד איתו.
- **לפיתוח**: מסד הנתונים לבדו עם \`docker compose up -d <db>\`, ה-backend עם הפרופיל \`local\` (ועוד \`compose\` כדי להצביע על מסד הנתונים הזה), וה-frontend עם \`npm run dev\` על :5173, שמעביר (proxy) את \`/api\` ל-backend.

### בדיקות
- \`mvn package\` מריץ את בדיקות ה-API שנוצרו על H2 בזיכרון (הפרופיל \`test\`), יהיה מסד הנתונים של האפליקציה אשר יהיה — לא צריך מסד נתונים רץ.
- \`mvn test -Pdb-tests\` מריץ את אותן בדיקות על מסד הנתונים האמיתי, על הסכמה ש-Flyway יוצר (נדרש Docker).
- \`npm test\` מריץ את בדיקות ה-Vitest של ה-frontend.

### Migrations
עם \`flyway\`, \`backend/src/main/resources/db/migration/V1__init.sql\` הוא המודל, עבור מסד הנתונים שנבחר. עדכון של המודל מוסיף \`V<timestamp>__model_update.sql\`: מה שהמודל מוסיף רץ כמו שהוא; מה שהוא מסיר או מהדק נכתב בהערה, כדי שאדם יסקור אותו.

### הגדרות שבידי הצוות
- **קבצים שהועלו** (עם שדות FILE/IMAGE): \`app.attachments.storage\` = \`database\` (ברירת מחדל), \`filesystem\` או \`s3\`; העלאות שאף רשומה לא מחזיקה נמחקות אחרי \`app.attachments.keep-unattached\` (24h). קובץ נקרא ברמת הקריאה של הרשומה שלו.
- **Events** (האפשרות \`events\`): \`app.events.*\` — הקידומת של ה-topics ב-Kafka, webhooks עם סוד ה-HMAC שלהם וסוגי האירועים שכל אחד מהם רוצה.
- **מיילים** (\`notify\` של workflow): כבויים עד שמגדירים \`app.events.mail.enabled: true\` ו-\`spring.mail.host\`; הכתובות מגיעות מ-\`app.events.mail.users\`, משירות ה-LDAP REST או מדומיין מייל.
- **CORS** כבוי: ה-frontend קורא ל-\`/api\` באותו origin שלו (Vite proxy בפיתוח, nginx בקונטיינר שלו).

ה-README של הפרויקט מכסה כל אחד מאלה.`
      },
      {
        id: 'fs-template-sets',
        title: 'סטי תבניות',
        description: 'איך הקבצים שנוצרים מאורגנים, והיכן המשתנים שלהם מתועדים.',
        content: `### אנטומיה
סט תבניות הוא חבילה מבוססת-DB של קבצי Mustache עם מפתח \`set_key\` ותגית \`kind\`. ארבעה מגיעים עם המערכת:

| סט | Kind | הערות |
|---|---|---|
| \`spring-jpa-crud\` | BACKEND_JAVA | ה-backend של ברירת המחדל |
| \`spring-jpa-crud-lombok\` | BACKEND_JAVA | ישויות Lombok; שואל כל קובץ אחר מ-\`spring-jpa-crud\` |
| \`react-tailwind-crud\` | FRONTEND_REACT | ה-frontend של ברירת המחדל (Tailwind 4) |
| \`react-menora-digital-crud\` | FRONTEND_REACT | אותה אפליקציה במערכת העיצוב Menora Digital; שואל את רוב הקבצים מ-\`react-tailwind-crud\` |

קבצי backend מרונדרים בתוך ה-pipeline של Initializr ע״י \`FullstackProjectGenerationConfiguration\`; קבצי frontend ע״י \`FullstackRenderer\` מעל הפרויקט של מחולל ה-Frontend.

### שורות קבצים
- **pathTemplate** — מרונדר ב-Mustache עם ההקשר המלא, כך ש-\`src/main/java/{{entityPackagePath}}/{{EntityName}}.java\` הופך לקובץ אחד לכל ישות.
- **content** — Mustache (\`MUSTACHE\`) או verbatim (\`NONE\`).
- **perEntity** — פעם אחת לכל ישות; **perPage** — פעם אחת לכל עמוד בפריסה; אף אחד מהם — פעם אחת לפרויקט.
- **gatedBy** — דגל בהקשר שחייב להיות true כדי שהקובץ ייכתב (\`apiTestApplicable\`, \`hasCompositePk\`, \`hasWidgets\`…).
- **sourceSet** (במניפסט בלבד) — שאילת תוכן הקובץ מסט אחר.
- **seedHash** — הרישום של סנכרון התבניות לתוכן שנשלח עם המערכת (ראו **ניהול: ניהול סטי תבניות**).

### משתנים
ההקשר גדול — משתני פרויקט, ישות, שדה, קשר, עמוד ווידג'ט. בנושא **Mustache Templating → הקשר ישות Fullstack** נמצאים העיקריים; \`backend/docs/MUSTACHE_GUIDE.md\` מפרט את כולם.

### מוסכמות ה-API שנוצר
רשימות מקבלות \`?page\`, \`?size\`, \`?sort\` (רשימה מותרת לכל controller; ברירת מחדל: כל עמודות המפתח), \`?q\` (חיפוש ללא תלות ברישיות על שדות הטקסט) וכל מסנן; שגיאות הן problem details לפי RFC-7807 (404, 409, 400 עם שגיאות השדות).`,
        callouts: [
          {
            type: 'info',
            text: 'Mustache ו-JSX משתמשים שניהם ב-`{{` כפותח. התבניות שמגיעות עם המערכת נמנעות מ-`pagination={{ … }}` (ש-Mustache היה מנסה לפרסר כתג) ע״י הוצאת האובייקט ל-`const` והעברת `pagination={pagination}`.'
          }
        ]
      },
      {
        id: 'fs-admin',
        title: 'ניהול: ניהול סטי תבניות',
        description: 'לשונית Entity CRUD — סטים, הקבצים שלהם ותלויות ברירת המחדל — ואיך סטים הולכים בעקבות release.',
        content: `### היכן למצוא
**Config → Entity CRUD**. שתי חלוניות:
1. **Sets** (למעלה) — \`setKey\`, \`name\`, \`kind\`, enabled, סדר.
2. **Files in Selected Set** (למטה) — אחרי לחיצה על סט. \`pathTemplate\`, \`perEntity\`, סוג קובץ, סוג substitution, סדר.

### עריכת סט
ה-drawer מכיל את שדות הסט ועוד **Default Dependencies** (לסטי backend בלבד). השמירה שולחת PUT עם מזהי התלויות אל \`/admin/entity-template-sets/{id}/default-deps\` (החלפה מלאה).

### עריכת קובץ
ה-drawer משתמש באותו עורך קוד כמו File Contributions. ה-\`pathTemplate\` מרונדר ב-Mustache עם הקשר הישות; \`perEntity\` בוחר בין פעם לכל ישות לבין פעם לפרויקט.

### סנכרון תבניות: סטים הולכים בעקבות ה-release
בכל הפעלה, כל שורת קובץ שנשלחה עם המערכת מושווית למה שמסד הנתונים מחזיק:
- שורה שאף אחד לא ערך (התוכן שלה עדיין תואם ל-\`seedHash\` שלה) מעודכנת לקובץ של ה-release;
- שורה שמנהל ערך **נשמרת** ונרשמת ביומן (\`seedHash = "custom"\`), ומפסיקה ללכת בעקבות ה-release;
- קובץ שה-release מוסיף מתווסף; קובץ שנשלח ושמנהל מחק מוחזר.

\`POST /admin/entity-template-sets/reset\` מחזיר כל סט לקבצים שנשלחו ומוותר על עריכות (אין לזה כפתור). \`initializr.fullstack.template-sync=off\` מכבה את הסנכרון. ה-**Fullstack Examples** פועלות לפי אותו כלל (דוגמה שנערכה נשמרת), חוץ מזה שדוגמה שנמחקה לא מוחזרת.

### Fullstack Examples
**Config → Fullstack Examples** מנהל את הדוגמאות שמהן מתחילים: ישויות, פריסת עמודים אופציונלית והגדרות עורך. כל שמירה נבדקת כמו בקשת יצירה, כך שדוגמה שמורה תמיד מייצרת; אפשר להעתיק פנימה את הישויות של מודל Team.

### ייצוא / ייבוא
ייצוא התצורה נושא את הסטים, הקבצים שלהם ותלויות ברירת המחדל, ואת דוגמאות ה-fullstack. הוא לא נושא מודלים של הצוות, תבניות צוות או presets של הצוות.

### מחיקת תלות
תלות שברירות המחדל של סט מציינות מסומנת ע״י בדיקת היתומים; מחיקה בכוח (\`DELETE /admin/dependency-entries/{id}?force=true\`) מסירה אותה גם מברירות המחדל של כל סט.`
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // WORKING WITH GENERATED PROJECTS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'generated-projects',
    title: 'עדכון והרצה של פרויקטים',
    icon: 'difference',
    topics: [
      {
        id: 'update-what',
        title: 'עדכון פרויקט במקום יצירה מחדש',
        description: 'כל פרויקט שומר את המודל שממנו נוצר; מודל שהשתנה חוזר כ-patch.',
        content: `### קובץ המודל
לכל פרויקט שהמחולל יוצר — רגיל, אשף, multi-module ו-fullstack — יש \`menora-model.json\` בשורש: הבקשה שממנה נוצר (בפרויקט אשף, גם המסמכים שהודבקו והאפשרויות שלהם) ו-hash של מה שיצר אותו (\`generator.catalogHash\` ל-backend, \`generator.templatesHash\` ל-fullstack). מפתחים צריכים לעשות לו commit יחד עם הפרויקט.

### למה לא פשוט ליצור שוב?
צוות עורך את הקוד אחרי היצירה. יצירה מחדש והעתקת הקבצים החדשים מעל הישנים מאבדת את העריכות האלה. במקום זה, המחולל מייצר את **שתי** הגרסאות — הפרויקט כפי שהמודל הישן מייצר אותו וכפי שהמודל החדש מייצר אותו — ומחזיר רק את ההבדל, כ-patch ש-git ממזג לתוך הקוד של הצוות (\`git apply --3way\`). איפה שהצוות שינה את אותן שורות, git משאיר conflict markers לפתרון, כמו אחרי merge.

### מה עדכון אינו
שני הצדדים נוצרים **היום**, עם הקטלוג והתבניות של היום. לכן ה-patch הוא השינוי שה**מודל** עושה — תלות, שדה, ישות או דף חדשים — ולא השיפורים שהקטלוג או התבניות קיבלו מאז שהפרויקט נוצר לראשונה. \`UPDATE.md\` אומר אם הקטלוג (או התבניות) זזו מאז, לפי ה-hash שבקובץ המודל של הפרויקט.

### שינויים שקוד שנוצר שורד הכי טוב
- פרויקטי OpenAPI על **Interfaces**: עדכון כותב מחדש את ממשקי \`<Tag>Api\` ולעולם לא נוגע ב-controller שהצוות מימש.
- פרויקטי Fullstack עם \`flyway\`: מה שהמודל מוסיף לסכמה מגיע כ-\`V<timestamp>__model_update.sql\`; מה שהוא מסיר או מהדק נכתב בהערה, כדי שאדם יעבור עליו לפני ההרצה.`
      },
      {
        id: 'update-how',
        title: 'הורדה והחלה של עדכון',
        description: 'פאנלי העדכון בלשוניות Backend ו-Fullstack, ומה עושים עם ה-ZIP.',
        content: `### לשונית Backend
**Import model…** (מעל הטופס) טוען את ה-\`menora-model.json\` של פרויקט: הטופס, התלויות, האפשרויות, המודולים ומסמכי האשף נקבעים ממנו. ברגע שההגדרה שונה ממנו — עבור אותו artifact — הפאנל **Update the project you already have** (עדכון הפרויקט שכבר יש לכם) מציע:
- **Download update** — \`POST /starter.patch\`, נשמר כ-\`<artifact>-update.zip\`;
- **Mark as applied** — ההגדרה הנוכחית הופכת לבסיס של עדכונים הבאים;
- **Forget** — הפסקת המעקב אחרי הפרויקט.

גם Generate זוכר מה הוא יצר, כך שהפאנל מופיע ברגע שההגדרה הזו משתנה.

### לשונית Fullstack
אותו דבר, עם **Import JSON** ל-\`menora-model.json\` של הפרויקט, ו-**Preview changes** להשוואת שתי היצירות קובץ אחר קובץ לפני ההורדה.

### ה-ZIP של העדכון
\`<artifact>-update/\` מכיל:
- \`UPDATE.md\` — מה השתנה, איך להחיל, ומה ה-patch לא יכול לשאת;
- \`update.patch\` — השינוי, עבור git;
- \`files/\` — כל קובץ שנוסף או שונה, בשלמותו (לקובץ ש-git לא יכול למזג);
- \`DELETED.txt\` — הקבצים שהשינוי מסיר (רק כשיש כאלה).

### החלה
משורש הפרויקט, כשהעבודה של הצוות כבר ב-commit:
1. \`git apply --3way --whitespace=nowarn path/to/update.patch\`
2. העתיקו את \`menora-model.json\` (וכל קובץ ש-\`UPDATE.md\` מציין שאינו ב-patch) מתוך \`files/\`.
3. \`git status\`: פתרו קבצים במצב "both modified", עברו עליהם עם \`git diff HEAD\`, build, test, commit.

אם git עונה "repository lacks the necessary blob", הקבצים מעולם לא נכנסו ל-commit כפי שנוצרו: החילו עם \`--reject\` והשלימו מתוך \`files/\`, או העתיקו את הקבצים האלה מעל הקיימים.`,
        callouts: [
          {
            type: 'tip',
            text: 'סוכנים עושים זאת מקצה לקצה עם ה-skill menora-initializr: mi update <dir> מביא את העדכון ובודק אותו, mi update <dir> --use <update> --apply מחיל אותו עם git ומדווח על קונפליקטים. ראו סקיל לסוכני AI.'
          }
        ]
      },
      {
        id: 'update-api',
        title: 'REST API של עדכון',
        description: '/starter.patch ו-/starter-fullstack.patch.',
        content: `### נקודות קצה
| Method | Path | Body |
|---|---|---|
| \`POST\` | \`/starter.patch\` | \`{ base, target, baseCatalogHash? }\` — כל צד הוא קובץ מודל של backend כמו שהוא, או רק ה-\`request\` שלו (גוף של \`/starter-wizard.zip\`, ועוד \`modules\` ל-multi-module) |
| \`POST\` | \`/starter-fullstack.patch\` | \`{ base, target, baseTemplatesHash? }\` — כל צד הוא גוף של \`/starter-fullstack.zip\` |

התשובה היא ה-ZIP של העדכון, עם ה-headers \`X-Update-Added\`, \`X-Update-Changed\` ו-\`X-Update-Deleted\`. צד שלא ניתן ליצור ממנו מחזיר 400 שאומר איזה: \`{ "error": "Invalid model", "side": "target", "detail": "bootVersion '9.9.9' is not a known version" }\` (שגיאות fullstack נושאות גם את ה-\`path\` במודל).

שתיהן נרשמות בלשונית Activity כפעולות **patch**.`,
        codeExamples: [
          {
            title: 'הוספת Kafka לפרויקט שנוצר',
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
        title: 'הרצת פרויקט מקומית',
        description: 'compose.yaml, ה-profile של compose, Testcontainers.',
        content: `### compose.yaml וה-profile של compose
backend שהתלויות שלו צריכות שירות — PostgreSQL, Oracle, SQL Server, MongoDB, Redis, Kafka — מקבל \`compose.yaml\` עם הקונטיינרים האלה ו-profile בשם \`application-compose.yaml\` שמכוון את האפליקציה אליהם:

\`\`\`bash
docker compose up -d
mvn spring-boot:run -Dspring-boot.run.profiles=compose
\`\`\`

לפרויקט multi-module יש \`compose.yaml\` אחד בשורש וה-profile במודול הכניסה שלו. ה-\`compose.yaml\` של פרויקט fullstack גם בונה ומפעיל את ה-backend וה-frontend שלו. DB2 כאן הוא IBM i, שאין לו image של קונטיינר, ולכן הוא לא מקבל כזה.

### Images
ה-images נמשכים דרך \`menora.containers.hub-prefix\` (ברירת המחדל היא ה-proxy \`repo.menora.co.il/dockerhub/\`) — הגדירו אותו במחולל אם ה-proxy זז.

### בדיקות על מסדי נתונים אמיתיים
- התלות \`testcontainers\` מוסיפה בדיקה לדוגמה שמפעילה את האפליקציה על מסדי הנתונים שלה ב-Docker (מדולגת כש-Docker לא רץ).
- ל-backend של fullstack עם האפשרות \`tests\` יש Maven profile בשם \`db-tests\`: \`mvn test -Pdb-tests\` מריץ את בדיקות ה-API שלו על מסד הנתונים האמיתי.

כרטיסי ה-next-steps של לשוניות Backend ו-Fullstack מציגים את הפקודות האלה אחרי Generate.`
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // TEAM SHARING
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'team-sharing',
    title: 'שיתוף בצוות',
    icon: 'groups',
    topics: [
      {
        id: 'team-what',
        title: 'Presets, מודלים, תבניות וקישורים',
        description: 'מה מפתחים משתפים זה עם זה על השרת, מחוץ לקטלוג האדמין.',
        content: `### מה אפשר לשתף
| מה | איפה | Endpoint |
|---|---|---|
| **Team presets** — הגדרה שלמה של לשונית Backend (טופס, תלויות, אפשרויות, מודולים, מסמכי אשף) | לשונית Backend → פס ה-Presets → **Team**; התיבה *For the team* בחלון השמירה | \`/metadata/backend/presets\` |
| **Team models** — מודל של לשונית Fullstack | לשונית Fullstack → presets → **Team**; היעד *Team* בחלון השמירה | \`/metadata/fullstack/models\` |
| **Team templates** — דף או widget של דשבורד ב-layout designer | הספרייה של ה-designer (*Team templates*, *Team widgets*); *Share with team* ב-inspector | \`/metadata/fullstack/templates\` |
| **קישורי שיתוף** — ההגדרה הנוכחית ב-URL | כפתור Share בכותרת | הפרמטרים \`bs\` (Backend) ו-\`fs\` (Fullstack) |

### איך הם מתנהגים
- כל מי שיכול לפתוח את המחולל יכול לקרוא, לשמור ולמחוק אותם — הם לא מאחורי התחברות האדמין. מחיקה מבקשת אישור, כי היא מסירה את הפריט לכולם.
- שמות ייחודיים בתוך כל סוג, בלי תלות ברישיות: שם תפוס נדחה, או מוצע לדריסה.
- ה-header \`userinfo\` מציין מי שמר כל אחד.
- Team models מוגבלים ל-1 MB, תבניות ל-64 KB.

### מה הם לא
הם לא שורות קטלוג: הם לא מופיעים באדמין, ב-History או בייצוא הקונפיגורציה, וייבוא לא נוגע בהם. גבו אותם יחד עם מסד הנתונים. המקבילים שהאדמין אוצר הם **Starter Templates** (Quick Start בלשונית Backend) ו-**Fullstack Examples**.

### קישורי שיתוף
קישור Backend נושא את הטופס, התלויות והאפשרויות כפרמטרים רגילים; כשבהגדרה יש מודולים או מסמכי אשף הוא מוסיף \`bs\` (ההגדרה כולה, מקודדת) — שמושמט מעבר ל-60 000 תווים, והלשונית אומרת שהקישור נושא רק את הפרויקט והתלויות שלו. קישור Fullstack נושא את המודל ב-\`fs\`; פתיחת קישור כזה מעל עבודה שלא נשמרה שואלת לפני שהיא מחליפה אותה.`
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // ADMIN OPERATIONS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'admin-operations',
    title: 'פעולות ניהול',
    icon: 'admin_panel_settings',
    topics: [
      {
        id: 'admin-signin',
        title: 'כניסה לממשק הניהול',
        description: 'כניסה יחידה (SSO) עם קבוצת LDAP, והסיסמה המשותפת.',
        content: `### שתי דרכים להיכנס
- **Sign in as <user>** — כששער ה-SSO מציין את המשתמש (הכותרת \`userinfo\`) ושירות ה-LDAP REST של מנורה מחזיר, בין הקבוצות שלו, קבוצה שמכילה את קבוצת המנהלים. השירות נשאל ב-\`{ADMIN_LDAP_REST_BASE_URL}/employee/findGroupsByCn/{user}\`; התשובה נשמרת דקה.
- **הסיסמה המשותפת** — כל עוד \`admin.password-login\` הוא true (ברירת המחדל). המחזיק בה נרשם כ-"<user> (password)" כשהשער מציין אותו, ואחרת כ-"password".

ל-\`ADMIN_LDAP_REST_BASE_URL\` ול-\`ADMIN_GROUP\` **אין ברירות מחדל**: עד שהם מוגדרים לסביבה, אפשר להיכנס רק בסיסמה.

### טוקנים
כניסה מחזירה טוקן חתום שנושא את זמן התפוגה שלו (\`admin.token-ttl\`, 12 שעות) ואת שם המנהל, כך שכל instance מאחורי load balancer מקבל אותו. שינוי הסיסמה או \`admin.token-secret\` מנתק את כולם. הכותרת מציגה מי מחובר.

### הגנה
- הסיסמה מושווית בזמן קבוע. אחרי \`admin.login.max-failures\` (10) סיסמאות שגויות מכתובת אחת בתוך \`admin.login.window\` (5 דקות), הכתובת הזו מקבלת 429 עד שהחלון עובר. מאחורי proxy, הגדירו \`server.forward-headers-strategy\`, אחרת כל המנהלים חולקים מונה אחד.
- אזהרה נכתבת ללוג בהפעלה כל עוד הסיסמה היא עדיין \`changeme\`.
- קונסולת H2 כבויה בתצורה שנשלחת (היא שורת פקודה של SQL על הקטלוג); מפתח מדליק אותה עם \`--spring.h2.console.enabled=true\`.`
      },
      {
        id: 'admin-history',
        title: 'History: מי שינה את הקטלוג',
        description: 'כל שינוי בקטלוג, עם מי שביצע אותו והשורה לפני ואחרי — וביטול.',
        content: `### מה נרשם
כל שורת קטלוג שנוצרה, שונתה או נמחקה — דרך מסכי הניהול, ייבוא, סנכרון הקטלוג, איפוס תבניות או סנכרון ההפעלה של release — עם מתי, מי, המקור, הבקשה שבה הגיעה, והשורה לפני ואחרי. נרשמים: קבוצות, רשומות, תרומות קבצים, תצורות build, אפשרויות משנה, כללי תאימות, תבניות starter והתלויות שלהן, תבניות מודולים ומיפויים, סטי תבניות ישויות, קבצים ותלויות ברירת מחדל, פלטות, גרסאות, מחלקות, דוגמאות fullstack ומקורות סכמה. לא נרשמים: presets, מודלים ותבניות של הצוות, ויומן הביקורת של היצירות.

### לשונית History
- **Changes** — סינון לפי טבלה, מקור, מי וטקסט; שינוי פותח מגירה עם השדות שלו לפני ואחרי (אלה ששונו מסומנים).
- **Requests** — השינויים מקובצים לפי הבקשה שביצעה אותם (ייבוא הוא בקשה אחת), כל אחת עם **Show changes** ו-**Undo**.

### חזרה אחורה
- **Undo this change** — השורה כפי שהייתה לפני השינוי (שורה שנמחקה חוזרת עם המזהה שלה).
- **Restore this version** — השורה כפי שהשינוי הזה השאיר אותה.
- **Its whole request** — כל השינויים של בקשה אחת, מהאחרון לראשון, בטרנזקציה אחת (ביטול ייבוא שלם).

הביטול בודק קודם שאף אחד לא שינה את השורה מאז; אחרת הוא מפרט את השורות והשדות ששונו מאז, ו-**Undo anyway** דורס אותם. מטמון הקטלוג נבנה מחדש אחרי שחזור.

### מגבלות
היומן נשמר לתמיד. קובץ תבנית שנשלח עם המערכת ושה-release זורע מחדש חוזר בהפעלה הבאה, לא משנה מה ביטול עשה. ביטול של שורה שהאב שלה כבר לא קיים נכשל — בטלו קודם את האב, או את הבקשה כולה.`
      },
      {
        id: 'catalog-sync',
        title: 'סנכרון קטלוג: שורות שהולכות בעקבות release',
        description: 'איך תרומות קבצים ותצורות build זזות עם ה-release, ואיך מנהל שומר את שלו.',
        content: `### מה הולך בעקבות release
| קטלוג | בהפעלה |
|---|---|
| תרומות קבצים, תצורות build | **סנכרון קטלוג**: שורה שנשלחה ושאף אחד לא ערך נכתבת מחדש לגרסה של ה-release; שורה חדשה שנשלחה מתווספת; שורה שנערכה נשארת כמו שהיא ומדווחת |
| סטי תבניות fullstack | **סנכרון תבניות**: קבצים שלא נערכו הולכים בעקבות ה-release, קבצים שנערכו נשמרים, קבצים שנשלחו ונמחקו חוזרים |
| דוגמאות fullstack | דוגמאות שלא נערכו הולכות בעקבות ה-release; דוגמאות שנערכו נשמרות; דוגמאות שנמחקו נשארות מחוקות |
| גרסאות | גרסאות חדשות שנשלחו מתווספות |
| קבוצות, רשומות, אפשרויות משנה, כללי תאימות, תבניות starter ותבניות מודולים | נזרעות פעם אחת, לתוך מסד נתונים ריק — release לעולם לא משנה אותן |

### ההפעלה הראשונה של מסד נתונים קיים
בפעם הראשונה שמסד נתונים פוגש את סנכרון הקטלוג, אי אפשר להבחין בין עריכה של מנהל לבין התוכן של release ישן, ולכן **ההפעלה הזו לא משנה כלום**: היא רושמת כל שורה שנשלחה, וכותבת ללוג אזהרה עם מספר השורות השונות או החסרות. מכאן והלאה, השורות הולכות בעקבות ה-release כמתואר למעלה.

### סקירה ולקיחה של שורות שנשלחו
עדיין אין מסך; ה-endpoints נמצאים מאחורי הכניסה לממשק הניהול:
- \`GET /admin/catalog-sync\` — כל שורה שנשלחה עם הסטטוס שלה: \`IN_STEP\`, \`DIFFERS\`, \`MISSING\`, \`KEPT\`, \`DELETED\` (\`?status=DIFFERS,MISSING\` לצמצום).
- \`GET /admin/catalog-sync/{key}\` — השורה שנשלחה והשורה הנוכחית זו לצד זו.
- \`POST /admin/catalog-sync/apply\` \`{keys: […]}\` או \`{all: true}\` — לקיחת הגרסה שנשלחה (לעולם לא של שורה שסומנה כשמורה או כמחוקה, אלא אם צוינה בשמה).
- \`POST /admin/catalog-sync/keep\` \`{keys: […]}\` — סימון שורות כשייכות למנהל: הן לא מדווחות יותר ולעולם לא מוחלפות (\`kept: false\` מבטל זאת).

\`initializr.catalog.sync=off\` מכבה אותו. כל מה שהסנכרון כותב נמצא ב-History (מקור "catalog-sync" או "release-sync").`,
        callouts: [
          {
            type: 'warning',
            text: 'אחרי שדרוג של התקנה קיימת, בדקו את GET /admin/catalog-sync?status=DIFFERS,MISSING: תיקונים ש-release עשה בשורות שנשלחו (Dockerfiles, nginx, תצורות datasource) מגיעים למסד הנתונים הזה רק אחרי שמנהל מחיל אותם.'
          }
        ]
      },
      {
        id: 'export-import-how',
        title: 'ייצוא וייבוא',
        description: 'גיבוי הקטלוג, או העברתו בין סביבות.',
        content: `### ייצוא
**Export** (בפינה הימנית-עליונה של ממשק הניהול) מוריד את \`initializr-config-YYYY-MM-DD.json\` עם הקטלוג כולו: קבוצות ורשומות תלויות, תרומות קבצים, תצורות build, אפשרויות משנה, כללי תאימות, תבניות starter והתלויות שלהן, תבניות מודולים ומיפויים, סטי תבניות ישויות עם הקבצים ותלויות ברירת המחדל שלהם, פלטות, גרסאות, מחלקות ודוגמאות fullstack.

לא נכללים בו: presets, מודלים ותבניות של הצוות; מקורות סכמה (הם מציינים את מסדי הנתונים והסודות של הסביבה הזו); ה-History ויומן הביקורת של היצירות.

### ייבוא
**Import** (בפינה הימנית-עליונה), בוחרים קובץ שיוצא ומאשרים. הייבוא **מחליף** את הקטלוג: כל טבלת קטלוג מתרוקנת ומתמלאת מהקובץ. דוגמאות ה-fullstack שבקובץ נבדקות לפני שמשהו נמחק. ייצוא ישן בלי גרסאות, מחלקות או דוגמאות fullstack משאיר את שלוש הטבלאות האלה כמו שהן.

הייבוא כולו הוא בקשה אחת ב-**History**, כך שאפשר לבטל אותו כיחידה אחת. שורות מיובאות ששוות למה ש-release שלח לאחרונה ממשיכות ללכת בעקבות releases; האחרות מדווחות ע״י סנכרון הקטלוג כשונות.

### המלצה
ייצאו לפני כל שינוי משמעותי, ושמרו את הייצואים האחרונים.`,
        callouts: [
          {
            type: 'warning',
            text: 'ייבוא מחליף — שורות שקיימות במסד הנתונים אבל לא בקובץ נמחקות. אם זה היה הקובץ הלא נכון, בטלו אותו מ-History → Requests.'
          }
        ]
      },
      {
        id: 'activity-what',
        title: 'Activity: מה נוצר',
        description: 'יומן הביקורת של היצירות — כל הורדה, עדכון ותצוגה מקדימה, עם הסוג, המחלקה, המשתמש וסיבת הכישלון.',
        content: `### מה שורה רושמת
כל קריאה ל-endpoint של יצירה — \`/starter…\` ו-\`/frontend/starter…\` שמסתיימים ב-\`.zip\` (**הורדה**), \`.patch\` (**עדכון**) או \`.preview\` (**תצוגה מקדימה**). לכל שורה יש: מתי, הסוג (backend, wizard, multimodule, fullstack, frontend), ה-artifact, גרסאות Boot ו-Java, התלויות שהיצירה השתמשה בהן בפועל, האשפים שהיו בשימוש, מספר הישויות, המחלקה, המשתמש (\`userinfo\`), הכתובת (אלא אם \`menora.audit.log-remote-addr: false\`), משך הזמן, הצלחה או כישלון, ובכישלון — ההודעה של השגיאה עצמה.

לא נרשמים: קריאות הזיהוי של האשפים, ותצוגות מקדימות שמסומנות \`X-Preview-Intent: live\` (ה-file dock של לשונית Backend מבקש אותן כשההגדרה משתנה).

השורות נכתבות ע״י כותב ברקע (תקלה במסד הנתונים לעולם לא שוברת יצירה) ונמחקות אחרי \`menora.audit.retention-days\` (365) ע״י job לילי.

### לשונית Activity
- תקופות: 1, 7, 30, 90 או 365 ימים.
- חמישה כרטיסים: יצירות, תצוגות מקדימות, שיעור הצלחה, משך P50 ו-P95.
- תרשים יומי, מוערם לפי סוג.
- פילוחים לפי סוג, מחלקה, משתמש, תלות, גרסת Boot ו-endpoint; סוג, מחלקה או משתמש מצמצמים את האירועים.
- כישלונות מקובצים לפי סיבה, עם **Show events**.
- טבלת האירועים עם מסנני תאריך, סוג, פעולה, סטטוס, מחלקה, משתמש וטקסט, דפדוף ו-**Export CSV**.

### למה זה חשוב
- **זיהוי סטייה** — תלויות שתמיד נבחרות יחד הן Starter Template שמחכה שיכינו אותו.
- **איתור כשלים** — הסיבה נמצאת בשורה, בלי צורך בלוג של השרת.
- **אימוץ** — אילו מחלקות וצוותים משתמשים במה.`
      },
      {
        id: 'activity-api',
        title: 'Activity REST API ומדדים',
        description: 'ה-endpoints שמאחורי הלשונית, ומדדי Micrometer.',
        content: `### REST Endpoints
כולם דורשים טוקן מנהל (\`Authorization: Bearer <token>\`).

- \`GET /admin/activity/summary?days=30\` — יצירות (הורדות ועדכונים) נספרות בנפרד מתצוגות מקדימות: סכומים, שיעור הצלחה, אחוזונים, לכל יום לפי סוג, לפי סוג, endpoint, מחלקה ומשתמש, התלויות וגרסאות ה-Boot המובילות, כישלונות לפי סיבה.
- \`GET /admin/activity/events?from&to&kind&action&status&department&username&q&page&size\` — אירועים, החדש קודם, בדפים (לכל היותר 200 בדף); התאריכים הם ימים, \`to\` כולל; \`action=generation\` הוא הורדות ועדכונים.
- \`GET /admin/activity/events.csv\` — אותו סינון כ-CSV (לכל היותר 10 000 שורות).
- \`GET /admin/activity/recent?limit=50\` — האירועים האחרונים.

### מדדי Micrometer
ב-\`/actuator/metrics\`:
- \`menora.generation.count\` — מונה עם תג \`status=success|failure\`
- \`menora.generation.duration\` — טיימר עם תג סטטוס

המחולל עצמו לא כולל registry של Prometheus; כדי לעשות להם scrape, הוסיפו את \`micrometer-registry-prometheus\` ל-build שלו ואת \`prometheus\` לחשיפת ה-actuator.`,
        codeExamples: [
          {
            title: 'יצירות שנכשלו בשבוע האחרון, כ-CSV',
            language: 'bash',
            code: `curl -H "Authorization: Bearer $TOKEN" \\
  "http://localhost:8080/admin/activity/events.csv?from=2026-11-11&status=FAILURE" -o failures.csv`
          },
          {
            title: 'בדיקת מונה Micrometer',
            language: 'bash',
            code: `curl http://localhost:8080/actuator/metrics/menora.generation.count`
          }
        ]
      },
      {
        id: 'service-settings',
        title: 'הגדרות השירות',
        description: 'ההגדרות של המחולל עצמו, שמפעיל קובע לכל סביבה.',
        content: `### שער גישה
\`menora.access.require-user-header\` (env \`MENORA_ACCESS_REQUIRE_USER_HEADER\`, ברירת מחדל false): כשהוא true, בקשה בלי כותרת המשתמש של שער ה-SSO (\`userinfo\`, \`menora.audit.user-header\`) נענית ב-**403** עם \`code: "USERINFO_REQUIRED"\`, וה-UI מציג מסך "No access". \`menora.access.open-paths\` (ברירת מחדל \`/actuator/**\`) נשאר פתוח עבור ה-probes של Kubernetes. הדליקו אותו היכן שהמחולל יושב מאחורי השער.

### ניהול
\`admin.password\`, \`admin.password-login\`, \`admin.token-secret\`, \`admin.token-ttl\`, \`ADMIN_LDAP_REST_BASE_URL\`, \`ADMIN_GROUP\`, \`admin.login.max-failures\`, \`admin.login.window\` — ראו **כניסה לממשק הניהול**. כל העותקים (replicas) חייבים לחלוק את הסיסמה ואת הסוד.

### מגבלות על מה שבקשה יכולה לעשות
- \`menora.wizard.max-documents-size\` (5MB) — מסמכי האשף של בקשה אחת יחד, וכל מסמך זיהוי/ייבוא.
- מזהי artifact, שמות פרויקטי frontend ומפתחות מפת האשף חייבים להיות שמות פשוטים; נתיב שנבנה מבקשה, מהקטלוג או מתבנית ושהיה יוצא מתיקיית הפרויקט הוא 400.
- מסמכי OpenAPI/AsyncAPI ו-WSDL מודבקים אינם רשאים להפנות לקבצים או לכתובות URL.

### קריאות ממסד נתונים חי
\`menora.live-schema.typed-connections\`, \`allowed-hosts\`, \`max-tables\`, \`max-concurrent-reads\`, והסיסמאות של המקורות (\`SCHEMA_SOURCE_…\` / \`menora.live-schema.secrets.…\`) — ראו **קריאה ממסד נתונים חי** של אשף ה-SQL.

### Audit
\`menora.audit.retention-days\` (365; 0 שומר הכל), \`retention-cron\` (03:30), \`async\` (true), \`log-remote-addr\` (true).

### סנכרונים וקונטיינרים
\`initializr.catalog.sync\` ו-\`initializr.fullstack.template-sync\` (\`off\` מכבה אותם), \`menora.containers.hub-prefix\` (המקום שממנו קובצי \`compose.yaml\` שנוצרים מושכים images).

### מסד נתונים אחד לכל instance
כל הפעלה כותבת מחדש שורות שנשלחו ושאף אחד לא ערך, ומחילה את ה-migrations של המחולל עצמו, ולכן שני builds שחולקים קובץ מסד נתונים מתחלפים בכתיבה מחדש של התבניות זה של זה. תנו לכל סביבה — ולכל branch במחשב של מפתח — מסד נתונים משלה.`
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // COMMON WORKFLOWS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'workflows',
    title: 'תהליכי עבודה נפוצים',
    icon: 'checklist',
    topics: [
      {
        id: 'workflow-new-dep',
        title: 'הוספת תלות חדשה מקצה לקצה',
        description: 'הדרכה מלאה להוספת ספרייה פנימית חדשה לקטלוג.',
        content: `עקבו אחר השלבים האלה כדי להוסיף תלות חדשה למערכת, כך שמפתחים יוכלו לבחור בה במחולל.`,
        workflowSteps: [
          {
            title: 'צרו קבוצת תלויות (במידת הצורך)',
            description: 'לכו ל-Config → Dep Groups. אם התלות החדשה שייכת לקטגוריה חדשה, לחצו New Group, הזינו שם ושמרו. דלגו על שלב זה אם משתמשים בקבוצה קיימת.'
          },
          {
            title: 'צרו את רשומת התלות',
            description: 'לכו ל-Config → Dependencies. לחצו New Entry. מלאו: depId (ייחודי, אותיות קטנות), name, description, group, וקואורדינטות ה-Maven (groupId + artifactId; השאירו את ה-version ריק אם ה-BOM של Spring Boot מנהל אותה) — או סמנו File-only option לרשומה שמביאה רק קבצים. הגדירו compatibilityRange אם הספרייה עובדת רק עם גרסאות Boot מסוימות.'
          },
          {
            title: 'הוסיפו תרומות קבצים',
            description: 'לכו ל-Config → File Contribs. לכל קובץ להזרקה (למשל מקטע YAML ל-application.yaml, MyLibConfig.java למחלקת קונפיגורציה של Java), לחצו New Contribution. הגדירו dependencyId ל-depId החדש, fileType (YAML_MERGE ל-YAML, TEMPLATE ל-Java), targetPath, content, substitutionType (MUSTACHE לקבצי Java) ו-sortOrder.'
          },
          {
            title: 'הוסיפו תצורות build (במידת הצורך)',
            description: 'לכו ל-Config → Build Custom. אם הספרייה דורשת תלויות Maven נוספות (מעבר לרשומה הראשית) או החרגות, הוסיפו אותן כאן. הגדירו dependencyId ל-depId החדש ו-customizationType ל-ADD_DEPENDENCY או EXCLUDE_DEPENDENCY.'
          },
          {
            title: 'הוסיפו אפשרויות משנה (אם רלוונטי)',
            description: 'אם לתלות יש תוכן מיוצר אופציונלי (למשל מחלקות דוגמה), לכו ל-Config → Sub-Options (New Sub-Option). הוסיפו רשומות אפשרות משנה עם dependencyId = ה-depId שלכם. לאחר מכן חזרו לתרומות הקבצים והגדירו subOptionId על תרומות הקבצים המותנות.'
          },
          {
            title: 'הוסיפו כללי תאימות (אם רלוונטי)',
            description: 'לכו ל-Config → Compatibility (New Rule). הוסיפו כללי REQUIRES, CONFLICTS או RECOMMENDS — השרת אוכף REQUIRES ו-CONFLICTS על כל בקשה. לדוגמה, אם הספרייה שלכם דורשת JPA, הוסיפו כלל REQUIRES: sourceDepId = ה-depId שלכם, targetDepId = data-jpa.'
          },
          {
            title: 'בדקו את זה',
            description: 'פתחו את לשונית ה-Backend, מצאו את התלות החדשה בבוחר, בחרו אותה, ובדקו ב-file dock (Project files) או ב-Explore שהקבצים הצפויים שם לפני היצירה. כל שינוי שעשיתם נמצא ב-History, אם תצטרכו לבטל אותו.'
          }
        ]
      },
      {
        id: 'workflow-common-file',
        title: 'הוספת קובץ לכל פרויקט',
        description: 'כיצד להזריק קובץ לכל הפרויקטים שנוצרים באמצעות __common__.',
        content: `השתמשו בתהליך עבודה זה כשאתם רוצים שכל פרויקט שנוצר יכיל קובץ מסוים — בלי קשר לתלויות שהמפתח בוחר.`,
        workflowSteps: [
          {
            title: 'לכו לתרומות הקבצים',
            description: 'Config → File Contribs → New Contribution.'
          },
          {
            title: 'הגדירו dependencyId ל-__common__',
            description: 'הקלידו בדיוק: __common__ (שני קווים תחתונים בכל צד). זהו ערך הסנטינל שמשמעותו "החל על כל הפרויקטים".'
          },
          {
            title: 'בחרו את סוג הקובץ',
            description: 'STATIC_COPY לקובץ קבוע, TEMPLATE לקובץ עם משתני פרויקט, YAML_MERGE להוספת ערכים ל-application.yaml בכל הפרויקטים, DELETE להסרת קובץ שה-framework מייצר.'
          },
          {
            title: 'הגדירו נתיב יעד ותוכן',
            description: 'הזינו את נתיב היעד בתוך הפרויקט שנוצר (למשל scripts/setup.sh). לסוג TEMPLATE, השתמשו במשתני החלפה כמו {{artifactId}} והגדירו substitutionType ל-MUSTACHE.'
          },
          {
            title: 'שמרו ובדקו',
            description: 'שמרו את הרשומה. אין צורך ב-Refresh — תרומות קבצים נכנסות לתוקף בבקשת היצירה הבאה. צרו פרויקט בדיקה ואמתו שהקובץ קיים.'
          }
        ]
      },
      {
        id: 'workflow-version-dockerfile',
        title: 'Dockerfiles לפי גרסה',
        description: 'כיצד לקבל Dockerfiles שונים ל-Java 17 ול-Java 21.',
        content: `תבנית זו משתמשת בשדה javaVersion כדי להגיש תוכן קובץ שונה לפי גרסת ה-Java שנבחרה.`,
        workflowSteps: [
          {
            title: 'צרו את תרומת ה-Dockerfile ל-Java 17',
            description: 'לכו ל-File Contribs → New Contribution. הגדירו: dependencyId = __common__, fileType = TEMPLATE, targetPath = Dockerfile, substitutionType = MUSTACHE, javaVersion = 17. כתבו את תוכן ה-Dockerfile עם image הבסיס eclipse-temurin:17-jre-alpine. כללו {{artifactId}} בפקודת ה-COPY.'
          },
          {
            title: 'צרו את תרומת ה-Dockerfile ל-Java 21',
            description: 'צרו רשומה שנייה עם הגדרות זהות, פרט ל-javaVersion = 21 ותוכן Dockerfile שמשתמש ב-eclipse-temurin:21-jre-alpine.'
          },
          {
            title: 'אמתו את הבחירה',
            description: 'המערכת בוחרת בדיוק תרומה אחת לפי גרסת ה-Java שנבחרה בפרויקט. צרו פרויקט Java 17 ופרויקט Java 21, ובדקו כל Dockerfile כדי לוודא שנעשה שימוש ב-image הבסיס הנכון.'
          }
        ],
        callouts: [
          {
            type: 'info',
            text: 'אם תרצו גם Dockerfile ברירת מחדל לגרסאות Java שאינן מפורטות, צרו רשומה שלישית עם javaVersion ריק. היא תשמש לכל גרסת Java שאין לה התאמה מפורשת.'
          }
        ]
      },
      {
        id: 'workflow-sub-option',
        title: 'הוספת אפשרות משנה לתלות קיימת',
        description: 'כיצד להוסיף מחלקת דוגמה או קונפיגורציה אופציונלית לתלות קיימת.',
        content: `השתמשו בזה כשאתם רוצים לתת למפתחים תוספת אופציונלית בתוך תלות קיימת — למשל, מחלקת service לדוגמה או קונפיגורציה של מקור נתונים משני.`,
        workflowSteps: [
          {
            title: 'הגדירו את אפשרות המשנה',
            description: 'לכו ל-Config → Sub-Options → New Sub-Option. הגדירו: dependencyId = ה-depId הקיים (למשל postgresql), optionId = מזהה קצר וייחודי (למשל pg-readonly), label = שם התצוגה (למשל "Read-Only DataSource"), description = טקסט ה-tooltip.'
          },
          {
            title: 'צרו את תרומת הקובץ המגודרת',
            description: 'לכו ל-Config → File Contribs → New Contribution. הגדירו: dependencyId = אותו depId, fileType = TEMPLATE (או YAML_MERGE), targetPath = הקובץ שייווצר, content = תוכן התבנית, subOptionId = ה-optionId שיצרתם זה עתה (למשל pg-readonly).'
          },
          {
            title: 'בדקו את אפשרות המשנה',
            description: 'במחולל הראשי, בחרו את תלות האב. תיבת הסימון של אפשרות המשנה אמורה להופיע. סמנו אותה, צרו פרויקט, ואמתו שהקובץ המגודר קיים. לאחר מכן צרו פרויקט בלי לסמן את אפשרות המשנה ואמתו שהקובץ אינו קיים.'
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
    title: 'סקיל לסוכני AI',
    icon: 'smart_toy',
    topics: [
      {
        id: 'agent-skill',
        title: 'הפעלת המחולל מסוכן AI',
        description: 'הסקיל menora-initializr: סקריפט אחד מעל ה-REST API הציבורי, עבור Claude Code וסוכנים אחרים.',
        content: `### מה זה
סוכן AI מפעיל את המחולל דרך אותו REST API שהדפדפן משתמש בו. אין נקודת קצה נפרדת לסוכנים. הסקיל **menora-initializr** אורז את זה עבור סוכן: \`SKILL.md\` שהסוכן קורא, סקריפט Node אחד בלי תלויות (\`scripts/mi.mjs\`, Node 18 ומעלה) ודפי עזר על בקשת ה-fullstack, על ה-API ועל הפרויקטים שנוצרים. הוא חי ב-repository משלו ומותקן תחת \`.claude/skills/menora-initializr/\`.

### מה סוכן יכול לעשות איתו
- **לגלות** מה השרת הזה מציע: גרסאות Boot ו-Java, כל מזהה תלות עם אפשרויות המשנה שלו, האשפים, המודולים, ה-template sets ודוגמאות ה-fullstack (\`mi meta\`, \`mi meta deps <text>\`).
- **לצפות מראש וליצור** כל סוג פרויקט: רגיל, multi-module, ארבעת האשפים (SQL, OpenAPI, SOAP, AsyncAPI), frontend ו-fullstack — מדוגמה, מ-DDL מודבק או ממסד נתונים חי. הפרויקט נפרס לתיקייה, והסוכן מקבל עבורו את הצעדים הבאים.
- **לפתוח presets ומודלים של הצוות** כבקשות מוכנות.
- **לעדכן פרויקט** שהוא יצר בעבר, מתוך ה-\`menora-model.json\` שלו: להביא את העדכון, לסקור אותו, ואז להחיל אותו עם \`git apply --3way\`, כשקונפליקטים וקבצים שאינם במעקב (untracked) מדווחים ולעולם לא נמחקים.

### הגדרות
| משתנה | משמעות |
|---|---|
| \`MENORA_INITIALIZR_URL\` | הכתובת של המחולל (ברירת מחדל \`http://localhost:8080\`) |
| \`MENORA_USERINFO\` | ה-login של המשתמש, שנשלח כ-header \`userinfo\` — נדרש כשהשירות דורש אותו (\`USERINFO_REQUIRED\`), והוא מזהה את המשתמש ב-audit של היצירות |
| \`MENORA_DB_PASSWORD\` | הסיסמה לחיבור מוקלד למסד נתונים חי; לעולם לא נכתבת לקובץ |

### מה זה אומר לאדמין
אין מה להגדיר בשרת: הסקיל משתמש בנקודות הקצה הציבוריות, כך שכל מה שבמדריך הזה (הקטלוג, שער הגישה, ה-audit) חל עליו. היצירות שלו מופיעות בלשונית **Activity** כמו כל יצירה אחרת. נקודת קצה חדשה או שדה בקשה חדש מגיעים לסוכנים רק כשגם דפי העזר והסקריפט של הסקיל מתעדכנים.`,
        codeExamples: [
          {
            title: 'שירות, ואחריו עדכון',
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
