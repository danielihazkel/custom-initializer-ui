import type { GuideSection } from './guide-types'

export const GUIDE_SECTIONS_HE: GuideSection[] = [
  // ─────────────────────────────────────────────────────────────────
  // 1. סקירת המערכת
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
כלי זה הוא פורטל מפתחים פנימי ליצירת שלדי פרויקטי Spring Boot בהתאם לסטנדרטים של הנדסת Menora. מפתחים ממלאים את מטה-דאטה הפרויקט (Group ID, Artifact ID, גרסת Java, תלויות), לוחצים **Generate**, ומקבלים קובץ ZIP מוכן לקומפילציה שכבר מכיל:

- פרויקט Maven מובנה כראוי (POM הורה או מודול בודד)
- מאגרי Artifactory של החברה מוגדרים ב-POM
- Log4j2 מוגדר ו-Logback המוגדר כברירת מחדל מוסר
- \`Dockerfile\`, \`Jenkinsfile\`, \`k8s/values.yaml\`, ו-\`entrypoint.sh\`
- קובצי קונפיגורציה לכל תלות (למשל \`application.yaml\` עם Kafka bootstrap servers, מחלקות Java לקונפיגורציית JPA/Security/RQueue)
- \`.editorconfig\` וקובץ \`VERSION\`

### מדוע לא start.spring.io?
מערכת Spring Initializr הציבורית אינה יודעת דבר על מראה Artifactory של Menora, ספריות פנימיות (RQueue, mail-sampler), תבניות קבצים של החברה, או הוצאות Maven נדרשות. ה-backend הזה מוסיף את כל אלו על גבי אותה מסגרת Spring Initializr שמפעילה את start.spring.io.

### אדמין מול אפליקציה
**האפליקציה** (מה שמפתחים משתמשים בו) היא הדף הראשי — היא מציגה את טופס הפרויקט ומייצרת קובצי ZIP. **האדמין** (לשונית Config) הוא לוח הבקרה — כל מה שמגדירים שם משנה את מה שמוזרק לפרויקטים שנוצרים. המדריך הזה מכסה את האדמין.`,
      },
      {
        id: 'overview-pipeline',
        title: 'תהליך יצירת הפרויקט',
        description: 'כיצד קובץ ZIP מורכב מקונפיגורציית האדמין בזמן הבקשה.',
        content: `### זרימת הבקשה
כאשר מפתח לוחץ Generate, מתרחש הבא:

1. **בקשת HTTP** מגיעה ל-\`/starter.zip\` עם פרמטרי query: \`groupId\`, \`artifactId\`, \`dependencies\`, \`javaVersion\`, פרמטרי sub-option כמו \`opts-kafka=consumer-example\`, וכן הלאה.
2. **פילטר** (\`InitializrWebConfiguration\`) רץ ראשון — מזריק ברירת מחדל \`configurationFileFormat=properties\`, מנקה את כותרת \`X-Forwarded-Port\`, וקורא בחירות sub-option לאובייקט context לכל thread.
3. **המסגרת** מפעילה קונטקסט Spring ילד לבקשה וקוראת לכל \`ProjectGenerationConfiguration\` רשום.
4. **\`DynamicProjectGenerationConfiguration\`** (היחיד הרשום) קורא מהמסד נתונים ותורם שלושה דברים:
   - **תורם קבצים** — עובר על כל \`FileContributionEntity\` לתלויות הנבחרות (בתוספת \`__common__\`), מסנן לפי גרסת Java ו-sub-option, ואז כותב/ממזג/מוחק קבצים בתיקיית הפלט.
   - **תורם מחיקות** — רץ אחרון (עדיפות הנמוכה ביותר) כדי למחוק קבצים שנוצרו על ידי המסגרת שלא דרושים (למשל \`application.properties\`).
   - **מותאם build** — מיישם רשומות \`BuildCustomizationEntity\` על אובייקט Maven build (מוסיף תלויות, הוצאות, ומאגרים).
5. **ZIP** מורכב ומוחזר לדפדפן.

### תובנה מרכזית: מסד הנתונים הוא מקור האמת
שום דבר לגבי מה שנכנס לפרויקט שנוצר אינו מקודד בקשיחות ב-Java — הכל נמצא במסד הנתונים. הוסיפו קובץ, שנו תבנית, הוסיפו תלות: הכל עובר דרך קונפיגורציית האדמין. לאחר כל שינוי, לחצו **Refresh** (כפתור למעלה-ימין באדמין) כדי לטעון מחדש את מטמון המטה-דאטה ללא הפעלה מחדש של השרת.`,
        callouts: [
          {
            type: 'info',
            text: 'מזהה התלות `__common__` הוא סנטינל מיוחד. תרומות קבצים ותצורות build המשויכות ל-`__common__` מיושמות על **כל** פרויקט שנוצר, ללא קשר לתלויות שהמשתמש בחר.'
          }
        ]
      },
      {
        id: 'overview-refresh',
        title: 'כפתור Refresh',
        description: 'מתי ולמה לקרוא ל-/admin/refresh.',
        content: `### מדוע Refresh קיים
ה-backend מאחסן את מטה-דאטה התלויות המלא (קבוצות, רשומות, טווחי תאימות) בזיכרון כדי שלא יצטרך לפגוע במסד הנתונים על כל בקשת יצירה. לאחר שמבצעים שינוי כלשהו דרך ממשק האדמין, המטמון מיושן.

### מתי ללחוץ Refresh
לחצו **Refresh** (כפתור החץ המעגלי בפינה הימנית-עליונה של האדמין) לאחר:
- יצירה, עריכה, או מחיקה של **קבוצת תלות** או **רשומת תלות**
- שינוי **טווח תאימות** על תלות
- כל שינוי שאמור להיות משתקף בממשק מחולל הפרויקטים הראשי (בוחר התלויות)

אינכם צריכים להפעיל מחדש את השרת. Refresh מיידי ובטוח להפעלה בכל עת.

### מה Refresh לא משפיע עליו
תרומות קבצים ותצורות build נקראות טרייות ממסד הנתונים על כל בקשת יצירה — הן אינן מאוחסנות במטמון. לכן שינויים בהן נכנסים לתוקף מיד ללא צורך ב-Refresh.`,
        callouts: [
          {
            type: 'warning',
            text: 'אם הוספתם רשומת תלות חדשה אך שכחתם ללחוץ Refresh, התלות לא תופיע בבוחר התלויות בממשק עד שהמטמון יתרענן.'
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 2. קבוצות תלויות
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
המערכת מזרעת את הקבוצות הבאות בהפעלה ראשונה: **Menora Standards**, **Web**, **Data**, **Messaging**, **Security**, **Observability**, **Logging**, ו-**Communication**.

### סדר תצוגה
קבוצות מופיעות בבוחר התלויות בסדר עולה של \`sortOrder\`. השתמשו בתכונת **גרירה לסדר מחדש** בלשונית קבוצות תלויות באדמין — גררו שורה למיקום הרצוי, ולאחר מכן לחצו **Save Order**.`,
        fields: [
          { name: 'name', type: 'string', required: true, description: 'שם תצוגה המוצג כותרת מקטע בבוחר התלויות. חייב להיות ייחודי.', example: 'Data' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר מיון עולה. ערכים נמוכים יותר מופיעים ראשונה. מנוהל דרך גרירה לסדר מחדש.', example: '2' }
        ]
      },
      {
        id: 'dep-groups-manage',
        title: 'יצירה ומחיקת קבוצות',
        description: 'כיצד להוסיף, לערוך, לסדר מחדש, ולמחוק בבטחה קבוצות.',
        content: `### יצירת קבוצה
1. לכו ל-**Config → Dependency Groups**.
2. לחצו **+ Add Group**.
3. הזינו **שם** וסדר מיון ראשוני אופציונלי.
4. לחצו **Save**.
5. לחצו **Refresh** כדי שהקבוצה החדשה תופיע במטה-דאטה.

### עריכת קבוצה
לחצו על סמל העיפרון בכל שורה כדי לפתוח את מגירת העריכה. שנו את השם, שמרו, ואז לחצו **Refresh**.

### סדר מחדש של קבוצות
לחצו וגררו את ידית האחיזה (⠿) בצד שמאל של כל שורה לסדר מחדש. מופיע כפתור **Save Order** — לחצו עליו לשמירת הרצף החדש.

### מחיקת קבוצה
לחצו על סמל האשפה. אם הקבוצה מכילה תלויות, תראו **אזהרת קונפליקט** המפרטת את הרשומות העזובות. תוכלו:
- **לבטל** ולמחוק או להעביר תחילה את התלויות, או
- לסמן **Force delete** למחיקה מדורגת של כל תלויות הבנות (ותרומות הקבצים, תצורות ה-build והאפשרויות המשניות המשויכות להן).`,
        callouts: [
          {
            type: 'warning',
            text: 'מחיקה בכוח של קבוצה מסירה לצמיתות את כל תלויות הבנות שלה וכל תרומת קובץ, תצורת build, ואפשרות משנית המחוברות אליהן. לא ניתן לבטל פעולה זו.'
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 3. רשומות תלויות
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
- **אפשרויות משניות** — תכונות אופציונליות בתוך תלות זו
- **כללי תאימות** — קשרים עם תלויות אחרות

### קואורדינטות Maven אופציונליות
לא לכל רשומת תלות זקוקה לקואורדינטות Maven. לעיתים תלות היא רק טריגר קונפיגורציה — היא גורמת להזרקת קבצים ותצורות build אך עצמה אינה מוסיפה artifact Maven. במקרה זה השאירו את \`mavenGroupId\` / \`mavenArtifactId\` ריקים.

### בוחר התלויות
רשומות מופיעות בבוחר התלויות מקובצות לפי הקבוצה האב שלהן. בחירת המשתמש היא הסט של ערכי \`depId\` הנשלחים בבקשת היצירה כפרמטר query \`dependencies\`.`
      },
      {
        id: 'dep-entries-fields',
        title: 'עזר שדות',
        description: 'כל שדה ברשומת תלות מוסבר.',
        content: `### כל השדות`,
        fields: [
          { name: 'depId', type: 'string', required: true, description: 'מזהה ייחודי קריא למכונה. משמש כמפתח זר בתרומות קבצים, תצורות build, אפשרויות משניות, וכללי תאימות. חייב להיות באותיות קטנות, ללא רווחים. לא ניתן לשנות לאחר היצירה מבלי לחבר מחדש את כל הרשומות הקשורות.', example: 'kafka' },
          { name: 'name', type: 'string', required: true, description: 'שם תצוגה קריא לאדם המוצג בבוחר התלויות.', example: 'Apache Kafka' },
          { name: 'description', type: 'string', required: false, description: 'תיאור קצר המוצג כטולטיפ או טקסט משנה בבוחר התלויות.', example: 'Distributed event streaming via Apache Kafka' },
          { name: 'group', type: 'DependencyGroup', required: true, description: 'הקבוצה אליה שייכת תלות זו. קובעת באיזה מקטע של הבוחר היא תופיע.', example: 'Messaging' },
          { name: 'mavenGroupId', type: 'string', required: false, description: 'מזהה קבוצת Maven. אם סופק, artifact זה יתווסף ל-pom.xml שנוצר.', example: 'org.springframework.kafka' },
          { name: 'mavenArtifactId', type: 'string', required: false, description: 'מזהה artifact Maven.', example: 'spring-kafka' },
          { name: 'version', type: 'string', required: false, description: 'גרסת Maven מפורשת. השאירו ריק לסמוך על ניהול גרסאות Spring Boot BOM.', example: '3.1.0' },
          { name: 'scope', type: 'string', required: false, description: 'scope Maven. השאירו ריק עבור compile (ברירת מחדל). אפשרויות: runtime, provided, test, import.', example: 'runtime' },
          { name: 'repository', type: 'string', required: false, description: 'מזהה מאגר אם ה-artifact אינו ב-Maven Central. חייב להתאים למזהה מאגר המוגדר ב-application.yml או דרך BuildCustomization ADD_REPOSITORY.', example: 'menora-release' },
          { name: 'compatibilityRange', type: 'string', required: false, description: 'טווח גרסאות Spring Boot. אם מוגדר, התלות מוסתרת בממשק כאשר גרסת Boot הנבחרת מחוץ לטווח. ריק פירושו תואם לכל הגרסאות.', example: '[3.2.0,4.0.0)' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר תצוגה בתוך הקבוצה. ערכים נמוכים יותר מופיעים ראשונה.', example: '0' }
        ],
        codeExamples: [
          {
            title: 'תחביר טווח תאימות',
            language: 'text',
            code: `[3.2.0,4.0.0)   Boot >= 3.2.0 AND < 4.0.0  (כולל תחתון, לא כולל עליון)
3.2.0           Boot >= 3.2.0              (גבול עליון פתוח)
[3.2.0,3.3.0]   Boot >= 3.2.0 AND <= 3.3.0 (כולל שני הקצוות)
                (ריק)  תואם לכל גרסאות Boot`
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 4. תרומות קבצים
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
כותב את התוכן כפי שהוא לנתיב היעד. ללא שינוי, ללא תחלופה (גם אם substitutionType מוגדר). משמש לקבצי טקסט תואמי בינארי שאמורים להיות זהים ללא קשר להגדרות הפרויקט.

**דוגמאות לשימוש:** \`.editorconfig\`, \`entrypoint.sh\`, \`settings.xml\`, \`log4j2-spring.xml\`

### YAML_MERGE
ממזג עמוק את תוכן ה-YAML לקובץ היעד. אם קובץ היעד אינו קיים עדיין, הוא נוצר. אם כבר יש לו תוכן (מתרומה קודמת או מהמסגרת), ה-YAML החדש ממוזג אליו מפתח-מפתח, עם מפות מקוננות ממוזגות רקורסיבית וערכים סקלריים נדרסים.

זוהי הדרך העיקרית שבה תלויות מרובות כל אחת תורמת את המקטע שלה ל-\`application.yaml\` מבלי לדרוס אחת את השנייה.

**דוגמאות לשימוש:** מקטע bootstrap-servers של Kafka, מקטע datasource של JPA, קונפיגורציית נקודות הניהול.

### TEMPLATE
מיישם תחלופת משתנים על התוכן, ואז כותב אותו לנתיב היעד. סוג התחלופה תלוי בשדה \`substitutionType\` (ראו להלן). סיומת הקובץ \`.mustache\` קוסמטית בלבד — לא נעשה שימוש במנוע Mustache אמיתי.

**דוגמאות לשימוש:** \`Dockerfile\` (צריך artifactId), \`KafkaConfig.java\` (צריך שם חבילה), \`k8s/values.yaml\` (צריך groupId).

### DELETE
מסמן קובץ למחיקה. תורם המחיקות רץ בעדיפות הנמוכה ביותר (לאחר כל הכתיבות), לכן הוא מסיר קבצים שהמסגרת או תורמים מוקדמים כתבו. אין צורך בשדה \`content\`.

**דוגמת שימוש:** מסגרת Spring Initializr תמיד כותבת \`application.properties\`. פרויקטי Menora משתמשים ב-\`application.yaml\`, לכן תרומת DELETE מסירה את \`application.properties\` הלא רצוי.`,
        callouts: [
          {
            type: 'tip',
            text: 'השתמשו ב-YAML_MERGE לכל קונפיגורציית application.yaml. זה מאפשר לתלויות מרובות לכל אחת לתרום את המקטע שלה מבלי להתנגש — מנוע המיזוג מטפל בשילוב שלהן.'
          }
        ]
      },
      {
        id: 'file-contrib-substitution',
        title: 'תחלופת תבניות',
        description: 'משתנים זמינים בתרומות קבצים מסוג TEMPLATE.',
        content: `### סוגי תחלופה

**NONE** — לא מתבצעת תחלופה. התוכן נכתב בדיוק כפי שנשמר.

**PROJECT** — מחליף את המשתנים הבאים עם מטה-דאטה הפרויקט:
- \`{{artifactId}}\` — מזהה artifact הפרויקט
- \`{{groupId}}\` — מזהה קבוצת הפרויקט
- \`{{version}}\` — גרסת הפרויקט (למשל \`0.0.1-SNAPSHOT\`)

**PACKAGE** — מחליף:
- \`{{packageName}}\` — שם החבילה הבסיסית (למשל \`com.menora.demo\`)

### משתני נתיב יעד
ה**נתיב היעד** (לא רק התוכן) יכול גם להשתמש במשתנה \`{{packagePath}}\`, שהוא שם החבילה עם נקודות מוחלפות בסלשים. זה משמש למיקום קבצי קוד מקור Java בתיקייה הנכונה.

**דוגמה:** תבנית \`KafkaConfig.java\` עם נתיב יעד \`src/main/java/{{packagePath}}/config/KafkaConfig.java\` נכתבת ל-\`src/main/java/com/menora/demo/config/KafkaConfig.java\` עבור פרויקט עם חבילה \`com.menora.demo\`.`,
        codeExamples: [
          {
            title: 'תחלופת PROJECT — דוגמת Dockerfile',
            language: 'dockerfile',
            code: `FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY target/{{artifactId}}-*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]`
          },
          {
            title: 'תחלופת PACKAGE — דוגמת מחלקת קונפיגורציה Java',
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
        title: 'תלות __common__',
        description: 'כיצד לתרום קבצים לכל פרויקט שנוצר.',
        content: `### מה __common__ אומר
כאשר \`dependencyId\` של תרומת קובץ מוגדר ל-\`__common__\`, הוא מוזרק לכל פרויקט שנוצר, ללא קשר לתלויות שהמפתח בחר.

כך Menora מבטיחה שלכל הפרויקטים תמיד יש:
- \`Dockerfile\` (מתוגדש עם artifactId, ספציפי לגרסת JDK)
- \`Jenkinsfile\` (מתוגדש עם מטה-דאטה פרויקט)
- \`k8s/values.yaml\` (מתוגדש עם groupId/artifactId)
- \`entrypoint.sh\` (העתקה סטטית)
- \`.editorconfig\` (העתקה סטטית)
- \`VERSION\` (מתוגדש עם גרסה)
- \`log4j2-spring.xml\` (העתקה סטטית)
- מחיקה של \`application.properties\` (סוג DELETE)

### מתי להשתמש ב-__common__
השתמשו ב-\`__common__\` כאשר הקובץ אמור להיות בכל פרויקט. השתמשו ב-\`depId\` ספציפי כאשר הקובץ רלוונטי רק כאשר אותה תלות נבחרת.`,
        callouts: [
          {
            type: 'info',
            text: 'תצורות build (הוסף תלות, הוסף מאגר) תומכות גם ב-__common__. כך מאגרי Artifactory ותחלופת תלות ה-log4j2 מתווספים לכל הפרויקטים.'
          }
        ]
      },
      {
        id: 'file-contrib-filtering',
        title: 'סינון גרסת Java ואפשרויות משניות',
        description: 'כיצד להפוך קובץ מותנה לגרסת Java או לאפשרות משנית.',
        content: `### שדה javaVersion
אם לתרומת קובץ יש \`javaVersion\` שאינו ריק, היא תיכלל רק כאשר גרסת Java הנבחרת של הפרויקט תואמת בדיוק.

זה מאפשר לכם לקבל מספר גרסאות של אותו קובץ עבור JDKs שונים. למשל, ה-\`Dockerfile\` משתמש ב-image בסיס Java 17 לעומת image בסיס Java 21.

**כיצד להגדיר קבצים ספציפיים לגרסה:**
1. צרו תרומה אחת עם \`targetPath = "Dockerfile"\`, \`javaVersion = "17"\`, ותוכן image Java 17.
2. צרו אחרת עם אותו \`targetPath\`, \`javaVersion = "21"\`, ותוכן image Java 21.
3. השאירו \`javaVersion\` ריק אם אתם רוצים קובץ לכל הגרסאות.

### שדה subOptionId
אם לתרומת קובץ יש \`subOptionId\` שאינו ריק, היא תיכלל רק כאשר המשתמש בחר את האפשרות המשנית הזו עבור התלות האב.

**דוגמה:** קובץ \`KafkaConsumerExample.java\` מכיל \`subOptionId = "consumer-example"\` ו-\`dependencyId = "kafka"\`. הוא מופיע רק כאשר המשתמש בוחר את האפשרות המשנית "Consumer Example" תחת תלות Kafka.`,
        fields: [
          { name: 'dependencyId', type: 'string', required: true, description: 'ה-depId של התלות האב, או `__common__` לכל הפרויקטים.', example: 'kafka' },
          { name: 'fileType', type: 'FileType', required: true, description: 'כיצד התוכן מטופל: STATIC_COPY, YAML_MERGE, TEMPLATE, או DELETE.', example: 'YAML_MERGE' },
          { name: 'targetPath', type: 'string', required: true, description: 'נתיב פלט בתוך הפרויקט שנוצר. עשוי להכיל {{packagePath}} לקבצי קוד מקור Java.', example: 'src/main/java/{{packagePath}}/config/KafkaConfig.java' },
          { name: 'content', type: 'text', required: false, description: 'תוכן קובץ. לא נדרש לסוג DELETE. לסוג TEMPLATE, השתמשו במשתני תחלופה.', example: 'package {{packageName}}.config;' },
          { name: 'substitutionType', type: 'SubstitutionType', required: false, description: 'מצב תחלופת משתנים: NONE (ברירת מחדל), PROJECT (artifactId/groupId/version), PACKAGE (packageName).', example: 'PACKAGE' },
          { name: 'javaVersion', type: 'string', required: false, description: 'אם מוגדר, תרומה זו חלה רק כאשר גרסת Java של הפרויקט תואמת. השאירו ריק לכל הגרסאות.', example: '21' },
          { name: 'subOptionId', type: 'string', required: false, description: 'אם מוגדר, תרומה זו חלה רק כאשר המשתמש בוחר את האפשרות המשנית הזו תחת התלות האב.', example: 'consumer-example' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר עיבוד. חשוב כאשר תרומות מרובות מכוונות לאותו קובץ (למשל YAML_MERGE מרובים לאותו application.yaml).', example: '0' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 5. תצורות Build
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'build-customizations',
    title: 'תצורות Build',
    icon: 'build',
    topics: [
      {
        id: 'build-custom-types',
        title: 'סוגי תצורות',
        description: 'שלושת סוגי שינויי pom.xml ב-Maven.',
        content: `### ADD_DEPENDENCY
מוסיף רשומת Maven \`<dependency>\` ל-\`pom.xml\` שנוצר. דורש \`mavenGroupId\` ו-\`mavenArtifactId\`. גרסה ו-scope אופציונליים (תלויות מנוהלות BOM אינן צריכות גרסה).

**דוגמאות לשימוש:**
- הוספת \`spring-boot-starter-log4j2\` כתחליף ל-Logback
- הוספת \`lombok\` לכל פרויקט
- הוספת \`spring-boot-starter-mail\` כאשר תלות mail-sampler נבחרת

### EXCLUDE_DEPENDENCY
מוסיף Maven \`<exclusion>\` לתלות קיימת. משמש להסרת תלויות טרנסיטיביות המתנגשות עם הוספותיכם.

דורש:
- \`excludeFromGroupId\` + \`excludeFromArtifactId\` — ה-artifact להוסיף לו את ההוצאה
- \`mavenGroupId\` + \`mavenArtifactId\` — התלות הטרנסיטיבית להוציא

**דוגמת שימוש:** הוצאת \`spring-boot-starter-logging\` (Logback) מ-\`spring-boot-starter\` כדי שלא יתנגש עם Log4j2.

### ADD_REPOSITORY
מוסיף רשומת Maven \`<repository>\` ל-\`pom.xml\` שנוצר. ה-\`repoId\` חייב להיות ייחודי ומשמש כ-\`<id>\` ב-XML.

**דוגמת שימוש:** הוספת מאגרי release ו-snapshot של Menora Artifactory כדי שהפרויקט שנוצר יוכל לפתור artifacts פנימיים.`,
        fields: [
          { name: 'dependencyId', type: 'string', required: true, description: 'ה-depId של התלות האב, או `__common__` להחלה על כל הפרויקטים.', example: '__common__' },
          { name: 'customizationType', type: 'CustomizationType', required: true, description: 'ADD_DEPENDENCY, EXCLUDE_DEPENDENCY, או ADD_REPOSITORY.', example: 'ADD_DEPENDENCY' },
          { name: 'mavenGroupId', type: 'string', required: false, description: 'עבור ADD_DEPENDENCY: קבוצת ה-artifact. עבור EXCLUDE_DEPENDENCY: הקבוצה של התלות הטרנסיטיבית להוצאה.', example: 'org.springframework.boot' },
          { name: 'mavenArtifactId', type: 'string', required: false, description: 'עבור ADD_DEPENDENCY: מזהה ה-artifact. עבור EXCLUDE_DEPENDENCY: מזהה ה-artifact של התלות להוצאה.', example: 'spring-boot-starter-log4j2' },
          { name: 'version', type: 'string', required: false, description: 'גרסת Maven עבור ADD_DEPENDENCY. השאירו ריק אם מנוהל על ידי Spring Boot BOM.', example: '' },
          { name: 'excludeFromGroupId', type: 'string', required: false, description: 'EXCLUDE_DEPENDENCY בלבד: מזהה קבוצה של ה-artifact להוסיף לו את בלוק ההוצאה.', example: 'org.springframework.boot' },
          { name: 'excludeFromArtifactId', type: 'string', required: false, description: 'EXCLUDE_DEPENDENCY בלבד: מזהה artifact להוסיף לו את בלוק ההוצאה.', example: 'spring-boot-starter' },
          { name: 'repoId', type: 'string', required: false, description: 'ADD_REPOSITORY: מזהה מאגר ייחודי (משמש כ-<id> ב-pom.xml).', example: 'menora-release' },
          { name: 'repoName', type: 'string', required: false, description: 'ADD_REPOSITORY: שם מאגר קריא לאדם.', example: 'Menora Artifactory Releases' },
          { name: 'repoUrl', type: 'string', required: false, description: 'ADD_REPOSITORY: כתובת URL של המאגר.', example: 'https://repo.menora.co.il/artifactory/libs-release' },
          { name: 'snapshotsEnabled', type: 'boolean', required: false, description: 'ADD_REPOSITORY: האם לאפשר פתרון snapshot ממאגר זה. ברירת מחדל: false.', example: 'false' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר עיבוד בתוך תצורות לאותה תלות.', example: '0' }
        ],
        codeExamples: [
          {
            title: 'דוגמה: החלפת Logback ב-Log4j2 (נדרשות שתי רשומות)',
            language: 'text',
            code: `רשומה 1 — EXCLUDE_DEPENDENCY
  dependencyId:         __common__
  excludeFromGroupId:   org.springframework.boot
  excludeFromArtifactId: spring-boot-starter
  mavenGroupId:         org.springframework.boot
  mavenArtifactId:      spring-boot-starter-logging

רשומה 2 — ADD_DEPENDENCY
  dependencyId:         __common__
  mavenGroupId:         org.springframework.boot
  mavenArtifactId:      spring-boot-starter-log4j2`
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 6. אפשרויות משניות
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
אפשרויות משניות מאפשרות למשתמשים לבחור תוספות אופציונליות כאשר הם בוחרים תלות. למשל, בחירת Kafka מציגה תיבות סימון עבור "Consumer Example" ו-"Producer Example" — אלו מייצרים מחלקות consumer/producer לדוגמה בפרויקט.

אפשרויות משניות הן תוספות בלבד: הן מגדרות תרומות קבצים נוספות. הן אינן מוסיפות artifacts Maven בפני עצמן.

### מוסכמת URL
אפשרויות משניות מועברות לנקודת הקצה של היצירה כפרמטרי query:

\`opts-{depId}=opt1,opt2\`

לדוגמה: \`opts-kafka=consumer-example,producer-example\`

ה-frontend בונה אוטומטית פרמטרים אלו כאשר המשתמש מסמן תיבות של אפשרויות משניות.

### כיצד אפשרויות משניות מגדרות קבצים
בתרומת קובץ, הגדירו \`subOptionId\` ל-\`optionId\` של האפשרות המשנית. קובץ זה ייכתב רק אם פרמטר ה-\`opts-{depId}\` המתאים כולל את ה-optionId הזה.`,
        fields: [
          { name: 'dependencyId', type: 'string', required: true, description: 'ה-depId של התלות האב אליה שייכת אפשרות משנית זו.', example: 'kafka' },
          { name: 'optionId', type: 'string', required: true, description: 'מזהה ייחודי לאפשרות משנית זו בתוך התלות. משמש בפרמטרי URL ובתור מפתח זר בתרומות קבצים.', example: 'consumer-example' },
          { name: 'label', type: 'string', required: true, description: 'תווית תצוגה המוצגת ליד תיבת הסימון בממשק.', example: 'Consumer Example' },
          { name: 'description', type: 'string', required: false, description: 'טולטיפ או טקסט עזרה המסביר מה אפשרות משנית זו מייצרת.', example: 'מייצר מחלקת @KafkaListener לדוגמה' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר תצוגה בין האפשרויות המשניות לאותה תלות.', example: '0' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 7. כללי תאימות
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'compatibility',
    title: 'כללי תאימות',
    icon: 'compare_arrows',
    topics: [
      {
        id: 'compat-types',
        title: 'סוגי כללים',
        description: 'REQUIRES, CONFLICTS, ו-RECOMMENDS מוסברים.',
        content: `### REQUIRES
תלות המקור **דורשת** את תלות היעד. כאשר המשתמש בוחר את המקור, היעד מתווסף אוטומטית. המשתמש לא יכול לבטל את בחירת היעד בזמן שהמקור נבחר.

**דוגמה:** \`rqueue REQUIRES data-jpa\` — RQueue זקוק ל-JPA לניהול תורי ההודעות שלו במסד הנתונים.

### CONFLICTS
תלויות המקור והיעד הן **בלעדיות הדדית**. הממשק מונע מהמשתמש לבחור את שתיהן בו-זמנית.

**דוגמה:** \`web CONFLICTS webflux\` — לא ניתן להשתמש ב-Spring MVC מבוסס Servlet לצד WebFlux תגובתי באותו פרויקט.

### RECOMMENDS
תלות המקור **ממליצה** על היעד. הממשק מציג הצעה למשתמש, אך הוא חופשי להתעלם ממנה.

**דוגמה:** \`data-jpa RECOMMENDS postgresql\` — JPA זקוק לדרייבר מסד נתונים; PostgreSQL הוא הסטנדרט של החברה.`,
        fields: [
          { name: 'sourceDepId', type: 'string', required: true, description: 'ה-depId של התלות המגדירה את הכלל (ה"מקור").', example: 'rqueue' },
          { name: 'targetDepId', type: 'string', required: true, description: 'ה-depId של התלות שהכלל חל עליה (ה"יעד").', example: 'data-jpa' },
          { name: 'relationType', type: 'RelationType', required: true, description: 'REQUIRES, CONFLICTS, או RECOMMENDS.', example: 'REQUIRES' },
          { name: 'description', type: 'string', required: false, description: 'הסבר קריא לאדם מדוע כלל זה קיים. מוצג בטולטיפ גרף התאימות.', example: 'RQueue משתמש ב-JPA לשמירת מצב תור ההודעות' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר תצוגה ברשימת האדמין ובגרף.', example: '0' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 8. תבניות Starter
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
תבניות Starter הן הגדרות פרויקט בלחיצה אחת המופיעות במקטע **Quick Start** של המחולל. לחיצה על תבנית ממלאת מראש את טופס הפרויקט עם סט תלויות מאורגן (ואפשרויות משניות). המשתמש עדיין יכול לשנות את הבחירה לפני יצירת הפרויקט.

### תבניות מובנות
- **REST API Service** — Spring Web, JPA, PostgreSQL, Actuator
- **Event-Driven Service** — Kafka (עם דוגמאות consumer ו-producer), JPA
- **Microservice (Full Stack)** — Web, Kafka, JPA, Security, Actuator, Prometheus

### תבנית לעומת יצירה ישירה
תבנית רק בוחרת תלויות מראש. אם המשתמש משנה את בחירת התלויות לאחר לחיצה על תבנית, הפלט שנוצר משקף את הבחירה הסופית שלו, ולא את הגדרת התבנית.`,
        fields: [
          { name: 'templateId', type: 'string', required: true, description: 'מזהה ייחודי קריא למכונה. מוצג בכתובת URL בעת שיתוף קישור תבנית.', example: 'rest-api' },
          { name: 'name', type: 'string', required: true, description: 'שם תצוגה המוצג על כרטיס התבנית.', example: 'REST API Service' },
          { name: 'description', type: 'string', required: false, description: 'תיאור קצר המוצג מתחת לשם התבנית.', example: 'Spring Web + JPA + PostgreSQL + Actuator' },
          { name: 'icon', type: 'string', required: false, description: 'שם אייקון Material Symbols (למשל "api", "bolt", "hub"). ראו ספריית Material Symbols לשמות זמינים.', example: 'api' },
          { name: 'color', type: 'string', required: false, description: 'קוד צבע hex לצבע הדגשת כרטיס התבנית.', example: '#4CAF50' },
          { name: 'bootVersion', type: 'string', required: false, description: 'עקוף את גרסת Spring Boot המוגדרת כברירת מחדל עבור תבנית זו. השאירו ריק לשימוש בברירת המחדל של המערכת.', example: '' },
          { name: 'javaVersion', type: 'string', required: false, description: 'עקוף את גרסת Java המוגדרת כברירת מחדל עבור תבנית זו.', example: '21' },
          { name: 'packaging', type: 'string', required: false, description: 'עקוף את אריזת ברירת המחדל (jar/war) עבור תבנית זו.', example: 'jar' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר תצוגה של כרטיסי תבנית במקטע Quick Start.', example: '0' }
        ]
      },
      {
        id: 'starter-deps',
        title: 'תלויות תבנית',
        description: 'כיצד לצרף תלויות (עם אפשרויות משניות) לתבנית.',
        content: `### רשומות תלות תבנית
כל תלות בתבנית היא רשומה נפרדת המקשרת את התבנית ל-\`depId\`. ניתן גם לציין אפשרויות משניות לבחירה מראש.

### ניהול תלויות תבנית
בלשונית **Starter Templates** באדמין, לחצו על סמל העיפרון על תבנית. במגירת העריכה, גללו למטה למקטע **Template Dependencies**. השתמשו בכפתור **+ Add Dependency** לצירוף רשומת תלות. הזינו אופציונלית \`subOptions\` מופרדות בפסיקים (התואמות ערכי optionId מטבלת האפשרויות המשניות).

### דוגמה
תבנית: "Event-Driven Service"
- \`depId = kafka\`, \`subOptions = "consumer-example,producer-example"\`
- \`depId = data-jpa\`

כאשר מפתח לוחץ על תבנית זו, Kafka נבחר מראש עם שתי אפשרויות הדוגמה מסומנות, ו-JPA גם נבחר מראש.`,
        fields: [
          { name: 'template', type: 'StarterTemplate', required: true, description: 'התבנית האב אליה שייכת רשומה זו.', example: 'rest-api' },
          { name: 'depId', type: 'string', required: true, description: 'התלות לכלול בתבנית זו.', example: 'kafka' },
          { name: 'subOptions', type: 'string', required: false, description: 'ערכי optionId מופרדים בפסיקים לבחירה מראש עבור תלות זו. חייבים להתאים לאפשרויות משניות הרשומות עבור ה-depId.', example: 'consumer-example,producer-example' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 9. תבניות מודולים
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
1. המפתח מפעיל את המתג ובוחר אילו מודולים לכלול.
2. ה-backend מייצר כל מודול באופן עצמאי באמצעות צינור המודול הבודד הסטנדרטי.
3. לכל מודול, המערכת מפתרת אילו תלויות לכלול מטבלת **מיפויי תלות-מודול** (בתוספת תלויות שנבחרו גלובלית).
4. רק המודול עם \`hasMainClass = true\` מקבל \`@SpringBootApplication\` ומחלקת הבדיקה. מקבצים אחרים מוסרים מאותם קבצים.
5. POM הורה נוצר עם \`<packaging>pom</packaging>\` ומקטע \`<modules>\` המפרט את כל מזהי artifact של תת-המודולים.
6. הכל נדחס יחד תחת ספריית הפרויקט ברמה העליונה.

### מזהי Artifact של מודולים
מזהה artifact של כל מודול = \`{artifactId פרויקט}{סיומת מודול}\`

עבור פרויקט עם \`artifactId = "myapp"\` ומודול עם \`suffix = "-api"\`, מזהה artifact המודול הוא \`myapp-api\`.`,
        callouts: [
          {
            type: 'warning',
            text: 'בדיוק מודול אחד צריך לקבל hasMainClass = true. אם אף אחד לא מקבל, לפרויקט שנוצר לא יהיה נקודת כניסה Spring Boot ראשית. אם יש מרובים, לכל תת-מודול יהיה מחלקת main מיותרת.'
          }
        ]
      },
      {
        id: 'module-fields',
        title: 'שדות תבנית מודול',
        description: 'קונפיגורציה של תבניות מודולים בודדים.',
        content: `### ישות תבנית מודול`,
        fields: [
          { name: 'moduleId', type: 'string', required: true, description: 'מזהה ייחודי למודול זה. משמש כמפתח זר במיפויי תלות-מודול.', example: 'api' },
          { name: 'label', type: 'string', required: true, description: 'שם תצוגה המוצג בממשק בוחר המודולים.', example: 'API Layer' },
          { name: 'description', type: 'string', required: false, description: 'הסבר קצר על תפקיד מודול זה.', example: 'REST controllers, DTOs, web layer' },
          { name: 'suffix', type: 'string', required: true, description: 'מצורף ל-artifactId הפרויקט ליצירת מזהה artifact של מודול זה.', example: '-api' },
          { name: 'packaging', type: 'string', required: true, description: 'סוג אריזת Maven למודול זה. בדרך כלל jar. השתמשו ב-war רק עבור מודולי שכבת web בתרחישי פריסה מסוימים.', example: 'jar' },
          { name: 'hasMainClass', type: 'boolean', required: true, description: 'הגדירו ל-true עבור המודול האחד שצריך להכיל @SpringBootApplication. כל המודולים האחרים חייבים להיות false.', example: 'true' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר תצוגה בבוחר המודולים.', example: '0' }
        ]
      },
      {
        id: 'module-mappings',
        title: 'מיפויי תלות-מודול',
        description: 'הקצאת תלויות למודולים ספציפיים.',
        content: `### מטרה
מיפויי תלות-מודול שולטים באילו תלויות נכללות אוטומטית ב-\`pom.xml\` שנוצר של כל מודול.

לדוגמה:
- מודול **api** → \`web\`, \`security\`, \`actuator\` (controllers REST צריכים אלה)
- מודול **persistence** → \`data-jpa\`, \`postgresql\` (שכבת מסד הנתונים צריכה אלה)
- מודול **core** → \`logging\` (כלי עזר משותפים)

### כיצד להגדיר
בלשונית **Module Templates** באדמין, כל שורת תבנית מציגה מקטע **Dependency Mappings**. השתמשו ב-**+ Add Mapping** ליצירת שיוך תלות-מודול חדש.

### תלויות גלובליות לעומת ספציפיות למודול
תלויות שהמפתח בוחר בממשק המחולל מיושמות על כל המודולים. מיפויי תלות-מודול הם תלויות נוספות הנכללות אוטומטית רק במודול הנוגע. רשימת התלויות הסופית למודול = (תלויות שנבחרו על ידי המשתמש) ∪ (מיפויים ספציפיים למודול).`,
        fields: [
          { name: 'dependencyId', type: 'string', required: true, description: 'ה-depId של התלות לכלול במודול זה.', example: 'data-jpa' },
          { name: 'moduleId', type: 'string', required: true, description: 'ה-moduleId של המודול להקצות תלות זו אליו.', example: 'persistence' },
          { name: 'sortOrder', type: 'integer', required: false, description: 'סדר עיבוד. בדרך כלל 0 לכל המיפויים.', example: '0' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 10. אשף SQL → JPA
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'sql-wizard',
    title: 'אשף ישויות SQL',
    icon: 'auto_fix_high',
    topics: [
      {
        id: 'sql-wizard-what',
        title: 'מה האשף עושה',
        description: 'הדביקו סקריפטי CREATE TABLE וקבלו ישויות JPA בפרויקט שנוצר.',
        content: `### מטרה
כאשר המפתח בוחר תלות של דרייבר מסד נתונים רלציוני (PostgreSQL, MSSQL, Oracle, DB2, H2, MySQL), כפתור **"Generate entities from SQL…"** מופיע על הכרטיסיה של אותו דרייבר בפאנל התלויות שנבחרו. לחיצה עליו פותחת מגירה בה המפתח מדביק סקריפט \`CREATE TABLE\` אחד או יותר. כשלוחצים על Generate, ה-backend מנתח את ה-DDL וכותב מחלקות \`@Entity\` של JPA מוכנות לשימוש — בתוספת ממשקי \`JpaRepository\` אופציונליים — ישירות ל-ZIP המופק.

זה מבטל את השלב המייגע של כתיבה ידנית של מחלקות ישות לאחר יצירת הפרויקט.

### אילו דרייברים זכאים
ה-UI קורא ל-\`GET /metadata/sql-dialects\` בטעינת הדף כדי ללמוד אילו מזהי תלות ה-backend יכול לטפל בהם. הכפתור מופיע רק על כרטיסיות תלות שנוכחות בתגובה זו. הוספת דרייבר JDBC חדש לקטלוג התלויות שתואם לדיאלקט ידוע חושפת אוטומטית את האשף עבורו — לא נדרשת תצורת אדמין עבור האשף עצמו.

MongoDB אינו כלול מכיוון שאין לו חוזה DDL.

### הזרימה במבט כולל
1. המפתח בוחר תלות דרייבר מסד נתונים (למשל \`postgresql\`) בתוספת \`data-jpa\`.
2. לוחץ על **Generate entities from SQL…** בכרטיסיית התלות.
3. מדביק \`CREATE TABLE users (...); CREATE TABLE orders (...);\`.
4. טבלאות שזוהו מופיעות כרשימה עם תיבת סימון **Generate repository** בכל שורה (ברירת מחדל דלוקה).
5. אופציונלי: שנה את תת-החבילה (ברירת מחדל \`entity\`).
6. שמור → המגירה נסגרת וכרטיסיית התלות מציגה תווית קטנה (✓ N טבלאות).
7. לחץ על **Generate** או **Explore** — ה-UI עובר לשליחת POST ל-\`/starter-wizard.zip\` / \`/starter-wizard.preview\` עם גוף JSON מאוחד, והישויות/repositories מופיעים בפרויקט שהורד ובעץ הקבצים.`,
        callouts: [
          {
            type: 'info',
            text: 'מפתחים שלא משתמשים באשף אינם מושפעים — כאשר sqlByDep ריק, ה-UI ממשיך להשתמש בזרימת GET /starter.zip הרגילה. Lombok מתווסף לפרויקטים שנוצרו רק כאשר SQL מצורף.'
          }
        ]
      },
      {
        id: 'sql-wizard-mapping',
        title: 'מיפוי טיפוסים מודע לדיאלקט',
        description: 'כיצד טיפוסי עמודות SQL הופכים לטיפוסי שדות Java.',
        content: `### כללי מיפוי
כל עמודה ב-\`CREATE TABLE\` שנותח הופכת לשדה בישות. טיפוס Java נבחר על בסיס טיפוס ה-SQL הגולמי, דיוק/סקלה במקומות רלוונטיים, והדיאלקט שנבחר. נקודות עיקריות:

| טיפוס SQL | טיפוס Java | הערות |
|---|---|---|
| \`VARCHAR\`, \`CHAR\`, \`TEXT\`, \`CLOB\`, \`NVARCHAR\`, \`VARCHAR2\` | \`String\` | \`length\` → \`@Column(length=...)\` |
| \`INT\`, \`INTEGER\` | \`Integer\` | |
| \`BIGINT\`, \`BIGSERIAL\`, \`SERIAL\` | \`Long\` | SERIAL/BIGSERIAL גם מקבלים \`@GeneratedValue(IDENTITY)\` |
| \`BOOLEAN\`, \`BIT\` (MSSQL), \`TINYINT(1)\` (MySQL) | \`Boolean\` | |
| \`DATE\` / \`TIMESTAMP\` / \`TIME\` | \`LocalDate\` / \`LocalDateTime\` / \`LocalTime\` | |
| \`NUMERIC(p,s)\`, \`DECIMAL(p,s)\` | \`BigDecimal\` | precision/scale מועתקים ל-\`@Column\` |
| \`NUMBER(p,0)\` (Oracle) | \`Integer\` / \`Long\` | ≤9 → Integer, אחרת Long |
| \`UUID\` (PG), \`UNIQUEIDENTIFIER\` (MSSQL) | \`UUID\` | |
| \`JSON\`, \`JSONB\` (PG) | \`String\` | |
| \`BYTEA\`, \`BLOB\` | \`byte[]\` | |

### מוסכמות שמות
- טבלה \`user_orders\` → מחלקה \`UserOrders\`
- עמודה \`created_at\` → שדה \`createdAt\` + \`@Column(name = "created_at")\`
- מפתח ראשי → \`@Id\`; מפתח ראשי מורכב → \`@IdClass\` עם record מלווה שנוצר
- \`BIGSERIAL\` / \`SERIAL\` / \`AUTO_INCREMENT\` / \`IDENTITY\` → \`@GeneratedValue(strategy = IDENTITY)\`

### מפתחות זרים
עמודת ה-FK נשמרת כשדה סקלרי עם הערה \`// TODO: map as @ManyToOne\`. גרסה 1 לעולם לא מייצרת אוטומטית אסוציאציות — קרדינליות ואסטרטגיית fetch נדחות למפתח.

### Lombok
ישויות שנוצרו משתמשות ב-\`@Data\`, \`@NoArgsConstructor\`, ו-\`@AllArgsConstructor\`. ה-build customizer מוסיף \`org.projectlombok:lombok\` (scope \`annotationProcessor\`) ל-build של Maven **רק** כאשר SQL מצורף.`,
        callouts: [
          {
            type: 'warning',
            text: '@Data מייצר equals/hashCode על כל שדה, מה שעלול להפתיע ישויות JPA מנוהלות עם אסוציאציות עצלות. מכיוון שגרסה 1 לא מייצרת אסוציאציות, זו ברירת מחדל בטוחה — בחנו מחדש אם תרחיבו את האשף לפלוט @ManyToOne.'
          }
        ]
      },
      {
        id: 'sql-wizard-api',
        title: 'REST API',
        description: 'נקודות קצה POST ומטא-דאטה נלווית.',
        content: `### נקודות קצה

| שיטה | נתיב | מטרה |
|---|---|---|
| \`GET\` | \`/metadata/sql-dialects\` | מפת dep-id → שם דיאלקט (רק תלויות הנמצאות בקטלוג) |
| \`POST\` | \`/starter-wizard.zip\` | יצירת ZIP מאוחד עם ישויות/repositories (וגם artifacts של OpenAPI אם \`specByDep\` מאוכלס) |
| \`POST\` | \`/starter-wizard.preview\` | עץ קבצים + תוכן (אותה צורה כמו \`/starter.preview\`) |

### מדוע נקודת קצה POST חדשה
\`/starter.zip\` היא GET ששורת השאילתה שלה נושאת את כל קלטי היצירה. כמה משפטי \`CREATE TABLE\` חורגים בקלות ממגבלות אורך URL טיפוסיות (~2–8 KB). נקודת קצה POST אחות בשם \`/starter-wizard.zip\` המקבלת את אותם שדות בתוספת \`sqlByDep\` / \`sqlOptions\` (ו-\`specByDep\` / \`openApiOptions\` עבור אשף OpenAPI) היא התשובה הנקייה ביותר — ללא מצב session בצד שרת, וזרימת GET נשארת ללא שינוי עבור משתמשים שאינם צריכים את האשפים.`,
        codeExamples: [
          {
            title: 'יצירת פרויקט עם ישות users וה-repository שלה',
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
          { name: 'sqlByDep', type: 'object', required: false, description: 'מפת depId → סקריפט SQL גולמי המכיל משפט CREATE TABLE אחד או יותר.', example: '{ "postgresql": "CREATE TABLE users (...);" }' },
          { name: 'sqlOptions', type: 'object', required: false, description: 'מפת depId → { subPackage, tables[] }. tables[].generateRepository שולט בפליטת repository לכל טבלה; subPackage ברירת מחדל "entity".', example: '{ "postgresql": { "subPackage": "entity", "tables": [ { "name": "users", "generateRepository": true } ] } }' },
          { name: 'opts', type: 'object', required: false, description: 'אותה מפת תת-אפשרויות המשמשת עם פרמטרי שאילתה opts-{depId} של /starter.zip — למשל בחירת DB ראשי/משני.', example: '{ "postgresql": ["pg-primary"] }' }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 10b. אשף OpenAPI → Controller/DTO
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'openapi-wizard',
    title: 'אשף OpenAPI',
    icon: 'integration_instructions',
    topics: [
      {
        id: 'openapi-wizard-what',
        title: 'מה האשף עושה',
        description: 'הדביקו ספק OpenAPI 3.x וקבלו מחלקות @RestController + DTO records.',
        content: `### מטרה
כאשר המפתח בוחר תלות של שכבת web (\`web\` או \`webflux\`), כפתור **"OpenAPI…"** מופיע על הכרטיסיה של אותה תלות בפאנל התלויות שנבחרו. לחיצה עליו פותחת מגירה בה המפתח מדביק ספק OpenAPI 3.x (YAML או JSON). כשלוחצים על Generate, ה-backend מנתח את הספק וכותב מחלקות \`@RestController\` ו-\`record\` של DTO — כבר מחוברים עם אנוטציות Spring MVC, binding של פרמטרים ו-validation.

זה התאום הסימטרי של אשף ה-SQL עבור צוותים של API-first. זה מבטל את הבויילרפלייט של כתיבת חתימות controllers ו-DTO של request/response באופן ידני אחרי היצירה.

### אילו תלויות זכאיות
ה-UI קורא ל-\`GET /metadata/openapi-capable-deps\` בטעינת הדף — הכפתור מופיע רק על כרטיסיות תלות שנוכחות בתגובה (כרגע \`web\` ו-\`webflux\`, בחיתוך עם תלויות הקיימות בקטלוג).

### הזרימה במבט כולל
1. המפתח בוחר תלות שכבת web (למשל \`web\`).
2. לוחץ על **OpenAPI…** בכרטיסיית התלות.
3. מדביק או מעלה ספק OpenAPI 3.x (\`.yaml\`, \`.yml\`, או \`.json\`).
4. רשימת **פעולות שזוהו** מופיעה בזמן אמת (debounced 400ms) ומציגה ערכים כמו \`GET /pets\`, \`POST /pets/{id}\`.
5. אופציונלי: שנה את תתי-החבילות (ברירת מחדל \`api\` ל-controllers, \`dto\` ל-records).
6. שמור → כרטיסיית התלות מציגה תווית של צירוף.
7. לחץ על **Generate** או **Explore** — ה-UI עובר לשליחת POST ל-\`/starter-wizard.zip\` / \`/starter-wizard.preview\` עם גוף JSON מאוחד, וה-controllers/records שנוצרו מופיעים ב-ZIP ובעץ הקבצים.`,
        callouts: [
          {
            type: 'info',
            text: 'גופי המתודות תמיד זורקים UnsupportedOperationException. המטרה של גרסה 1 היא שלד שמתקמפל — המפתחים ממלאים את הלוגיקה העסקית לאחר היצירה.'
          },
          {
            type: 'info',
            text: 'אשף SQL ואשף OpenAPI יכולים לפעול יחד באותה בקשת יצירה — כל אחד על תלות שונה. גוף ה-\`/starter-wizard.zip\` נושא גם את \`sqlByDep\` וגם את \`specByDep\`, וה-backend שולב את פלטי שניהם לתוך פרויקט אחד.'
          }
        ]
      },
      {
        id: 'openapi-wizard-mapping',
        title: 'מיפוי סכמה → טיפוסי Java',
        description: 'כיצד סכמות OpenAPI הופכות ל-records ולטיפוסי Java.',
        content: `### מיפוי טיפוסים
האשף ממפה טיפוסי OpenAPI (ואת רמזי ה-\`format\` שלהם) לטיפוסי Java ישירות על שדות ה-records שנוצרו וחתימות ה-controllers.

| סכמת OpenAPI | טיפוס Java | הערות |
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
| \`array\` | \`List<T>\` | רקורסיה על \`items\` |
| \`object\` עם \`$ref\` | שם ה-record שמופנה אליו | |
| \`allOf\` / \`oneOf\` / \`anyOf\` | \`Object\` | עם הערת \`// TODO\` |

### Controllers
פעולות מקובצות לפי ה-**תג הראשון** שלהן (פעולות ללא תג עוברות ל-\`DefaultController\`). מתודה אחת נפלטת לכל פעולה:

- שם מחלקה: \`{Tag}Controller\` (למשל \`PetsController\`)
- אנוטציה ברמת המחלקה: \`@RestController\`, \`@Validated\`
- אנוטציית מתודה: \`@GetMapping\`, \`@PostMapping\`, \`@PutMapping\`, \`@DeleteMapping\`, \`@PatchMapping\`
- פרמטרים: \`@PathVariable\`, \`@RequestParam\`, \`@RequestHeader\`, \`@RequestBody\` (עם \`@Valid\`)
- גוף: \`throw new UnsupportedOperationException("TODO: implement ...")\`
- \`operationId\`-ים כפולים בתוך תג מבודלים על ידי הוספת \`_2\`, \`_3\`, …

### Records
כל ערך תחת \`components.schemas.*\` הופך ל-\`record\` של Java עם רכיב אחד לכל property. שדות חובה שומרים על טיפוס ה-Java הגולמי שלהם; שדות אופציונליים גם כן (nullability נדחית למפתח — גרסה 1 לא עוטפת optionals ב-\`Optional<T>\`).

### חבילות
- Controllers → \`{packageName}.{apiSubPackage}\` (ברירת מחדל \`api\`)
- Records → \`{packageName}.{dtoSubPackage}\` (ברירת מחדל \`dto\`)`,
      },
      {
        id: 'openapi-wizard-api',
        title: 'REST API',
        description: 'נקודות קצה POST ומטא-דאטה נלווית.',
        content: `### נקודות קצה

| שיטה | נתיב | מטרה |
|---|---|---|
| \`GET\` | \`/metadata/openapi-capable-deps\` | מזהי תלות זכאים לאשף (בחיתוך עם תלויות בקטלוג) |
| \`POST\` | \`/starter-wizard.zip\` | יצירת ZIP מאוחד עם controllers ו-DTO records (וגם artifacts של SQL אם \`sqlByDep\` מאוכלס) |
| \`POST\` | \`/starter-wizard.preview\` | עץ קבצים + תוכן (אותה צורה כמו \`/starter.preview\`) |
| \`POST\` | \`/starter-wizard.detect-paths\` | ניתוח בצד שרת: \`{ spec }\` → \`["GET /pets", "POST /pets/{id}", ...]\` עבור התצוגה החיה של המגירה |

### מדוע נקודת קצה POST חדשה
ספקי OpenAPI חורגים באופן קבוע ממגבלות אורך URL טיפוסיות (~2–8 KB) — אפילו הדוגמה של Petstore היא ~2 KB של YAML. שימוש בנקודת קצה POST אחות בשם \`/starter-wizard.zip\` המקבלת את אותם שדות יצירה בתוספת \`specByDep\` ו-\`openApiOptions\` (וגם \`sqlByDep\` / \`sqlOptions\` עבור אשף SQL) שומר את האשפים מפורקים מזרימת GET ועוקף את תקרות גודל ה-URL לחלוטין.

### שגיאות ניתוח
אם הספק פגום, ה-backend מחזיר HTTP 400 עם גוף כמו \`{ "error": "...", "messages": ["attribute info.version is missing", ...] }\`. המגירה מציגה הודעות אלה בבאנר צהוב ומשביתה את כפתור השמירה עד שהספק מתנתח נקי.`,
        codeExamples: [
          {
            title: 'יצירת פרויקט מספק Petstore קטן',
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
            title: 'ספק Petstore לדוגמה (YAML)',
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
            title: 'PetsController.java שנוצר',
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
          { name: 'specByDep', type: 'object', required: false, description: 'מפת depId → טקסט ספק OpenAPI 3.x גולמי (YAML או JSON). swagger-parser מזהה את הפורמט אוטומטית.', example: '{ "web": "openapi: 3.0.3\\n..." }' },
          { name: 'openApiOptions', type: 'object', required: false, description: 'מפת depId → { apiSubPackage, dtoSubPackage }. Controllers עוברים ל-apiSubPackage (ברירת מחדל "api"); records עוברים ל-dtoSubPackage (ברירת מחדל "dto").', example: '{ "web": { "apiSubPackage": "api", "dtoSubPackage": "dto" } }' },
          { name: 'dependencies', type: 'array', required: true, description: 'מערך dep-id הרגיל. רק תלויות הרשומות ב-/metadata/openapi-capable-deps יעובדו עם רשומותיהן ב-specByDep.', example: '[ "web" ]' }
        ]
      },
      {
        id: 'openapi-wizard-limits',
        title: 'הערות ומגבלות (גרסה 1)',
        description: 'מה היצירה הזו עושה, מה לא, ומדוע.',
        content: `### מה גרסה 1 מפיקה
- מחלקת \`{Tag}Controller\` אחת לכל תג (פעולות ללא תג עוברות ל-\`DefaultController\`).
- \`record\` אחד של Java לכל ערך ב-\`components.schemas.*\`.
- גופי מתודות תמיד זורקים \`UnsupportedOperationException\` — הפרויקט מתקמפל; הלוגיקה שלכם למלא.

### מה גרסה 1 לא מפיקה
- **ללא stubs של client** — Feign, WebClient, ו-clients מבוססי RestTemplate מחוץ לתחום.
- **ללא פולימורפיזם** — \`allOf\`, \`oneOf\`, \`anyOf\` חוזרים ל-\`Object\` עם הערת \`// TODO\`.
- **ללא סכמות inline** — רק סכמות בעלות שם תחת \`components.schemas.*\` הופכות ל-records. סכמות response/request inline גם חוזרות ל-\`Object\`.
- **ללא פליטת אנוטציות OpenAPI** — אנוטציות Springdoc / springfox לא מתווספות. הוסיפו \`springdoc-openapi-starter-webmvc-ui\` כתלות אם אתם רוצים Swagger UI חי.

### מדוע הבחירות האלה
המטרה של גרסה 1 היא להרוג את הבויילרפלייט בלי להחיל דעה על המימוש. פולימורפיזם, סמנטיקת null, ויצירת client הן כולן החלטות עיצוב שצוותים שונים מטפלים בהן אחרת — כפיית בחירה כאן יוצרת יותר עבודה לצוותים שרצו את התשובה האחרת. שמרו על גרסה 1 הדוקה, איטרציה על משוב אמיתי.`,
        callouts: [
          {
            type: 'tip',
            text: 'אם אתם רוצים תיעוד API אינטראקטיבי, הוסיפו את springdoc-openapi-starter-webmvc-ui כתלות רגילה (לא דרך האשף). הוא סורק את ה-controllers שלכם בזמן ריצה ומשחזר Swagger UI — ללא צורך בעבודת אנוטציות למקרים פשוטים.'
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 11. ייצוא / ייבוא
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'export-import',
    title: 'ייצוא וייבוא',
    icon: 'swap_horiz',
    topics: [
      {
        id: 'export-import-how',
        title: 'גיבוי והעברת קונפיגורציה',
        description: 'כיצד לייצא ולייבא את קונפיגורציית האדמין המלאה.',
        content: `### ייצוא
לחצו על כפתור **Export** (סמל הורדה) בפינה הימנית-עליונה של האדמין. זה מוריד קובץ JSON המכיל את כל רשומות מסד הנתונים: קבוצות תלויות, רשומות, תרומות קבצים, תצורות build, אפשרויות משניות, כללי תאימות, תבניות starter, תבניות מודולים, וכל המיפויים.

השתמשו בזה כדי:
- **לגבות** את הקונפיגורציה הנוכחית לפני ביצוע שינויים גדולים
- **להעביר** קונפיגורציה ממופע staging לייצור
- **לשלוט בגרסאות** בקונפיגורציה על ידי commit של ה-JSON למאגר שלכם

### ייבוא
לחצו על כפתור **Import** (סמל העלאה), בחרו קובץ JSON שיוצא קודם, ואשרו. הייבוא **ממזג** רשומות — הוא מוסיף או מעדכן רשומות על בסיס מזהיהן, אך אינו מוחק רשומות הקיימות במסד הנתונים אך נעדרות מה-JSON.

**תיבת דיאלוג לאישור מופיעה לפני ייבוא** — סקרו את סיכום השינויים לפני לחיצה על Confirm.

### המלצה
ייצאו את הקונפיגורציה המלאה ל-\`data/config-backup-YYYY-MM-DD.json\` לפני כל שינויים משמעותיים. שמרו לפחות 3 גיבויים אחרונים.`,
        callouts: [
          {
            type: 'warning',
            text: 'ייבוא אינו מוחק רשומות קיימות — הוא רק מוסיף או מעדכן. לביצוע החלפה מלאה, תצטרכו למחוק ידנית רשומות מתנגשות תחילה, או להשתמש במסד הנתונים ישירות.'
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 11. פעילות וביקורת
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'activity',
    title: 'פעילות וביקורת',
    icon: 'monitoring',
    topics: [
      {
        id: 'activity-what',
        title: 'יומן ביקורת של יצירה',
        description: 'ראו מה צוותים באמת יוצרים, באיזו מהירות ובאיזו תדירות יצירה נכשלת.',
        content: `### מה נרשם
כל קריאה ל-endpoint מסוג \`/starter*\` (הורדת ZIP, תצוגה מקדימה, אשף SQL, רב-מודולים) נרשמת עם: חותמת זמן, endpoint, מזהי artifact/group, גרסת Boot, גרסת Java, packaging, שפה, תלויות שנבחרו, משך בזמן מילישניות, תוצאה (SUCCESS/FAILURE), וכתובת IP אופציונלית של הלקוח.

מסנן הביקורת רץ במסלול התשובה — שגיאת מסד נתונים לעולם לא תשבור יצירת פרויקט.

### איפה למצוא
פתחו את האדמין ולחצו על טאב **Activity** בסרגל הצד. תראו:
- **ארבע כרטיסיות סיכום** — סך הפעולות, שיעור הצלחה, משך p50, משך p95.
- **תלויות מובילות** — אילו תלויות נבחרות בפועל הכי הרבה, עם גרף עמודות אופקי.
- **גרסאות Boot** — התפלגות גרסאות ה-Boot בשימוש.
- **טבלת אירועים אחרונים** — 50 היצירות האחרונות עם פרטים מלאים (מזהה artifact, תלויות שנבחרו, משך, סטטוס).

### חלון זמן
המתג בפינה הימנית-עליונה מחליף את הסיכום בין **יום אחד**, **7 ימים**, **30 יום** (ברירת מחדל), ו-**90 יום**. כל הכרטיסים, הרשימות המובילות וטבלת האירועים האחרונים נטענים מחדש עם השינוי.

### למה זה חשוב
- **זיהוי סטייה** — אם צוותים כל הזמן יוצרים את אותן 10 תלויות יחד, כדאי להכין עבורם Starter Template.
- **איתור כשלים** — טבלת האירועים האחרונים מסמנת יצירות שנכשלו עם הודעת השגיאה, בלי צורך לחטט בלוגי שרת.
- **תכנון קיבולת** — טיימרי p95/p99 מראים אם יצירה האטה אחרי שינוי בקטלוג.`,
        callouts: [
          {
            type: 'info',
            text: 'ה-endpoint של `POST /starter-wizard.zip` משתמש בגוף JSON, ולכן רשומת הביקורת שלו לוכדת endpoint/סטטוס/משך/IP אבל לא את פרמטרי אשף ה-SQL/OpenAPI. זו פשרה מכוונת — לכידה מפרמטרי שאילתה הייתה מחמיצה את האשפים לחלוטין.'
          }
        ]
      },
      {
        id: 'activity-api',
        title: 'REST API ומדדים',
        description: 'קריאה ישירה ל-endpoints עבור דשבורדים, סקריפטים, או scrape של Prometheus.',
        content: `### Endpoints
שני ה-endpoints דורשים אימות אדמין (\`Authorization: Bearer <token>\`).

\`GET /admin/activity/recent?limit=50\` — האירועים האחרונים, חדש קודם.

\`GET /admin/activity/summary?days=30\` — סיכום עבור חלון הזמן, מחזיר סך הפעולות, שיעור הצלחה, משכי p50/p95/p99, 10 תלויות מובילות והתפלגות גרסאות Boot.

### מדדי Micrometer
המסנן גם מפרסם ל-Micrometer, חשוף ב-\`/actuator/metrics\`:

- \`menora.generation.count\` — מונה עם תג \`status=success|failure\`
- \`menora.generation.duration\` — טיימר עם תג סטטוס, כולל היסטוגרמות של אחוזונים p50/p95/p99

כוונו scraper של Prometheus ל-\`/actuator/prometheus\` (הוסיפו תחילה \`prometheus\` לרשימת החשיפה) אם רוצים לשלוח את זה לדשבורד.

### מתג פרטיות
כתובות IP של לקוחות נרשמות כברירת מחדל. להשבתה (למשל לציות GDPR), הגדירו ב-\`application.yml\`:

\`\`\`
menora:
  audit:
    log-remote-addr: false
\`\`\`

שורות קיימות לא מושפעות; רק אירועים חדשים מדלגים על השדה.`,
        codeExamples: [
          {
            title: 'משיכת 50 האירועים האחרונים',
            language: 'bash',
            code: `curl -H "Authorization: Bearer $TOKEN" \\
  http://localhost:8080/admin/activity/recent?limit=50`
          },
          {
            title: 'סיכום של 7 ימים',
            language: 'bash',
            code: `curl -H "Authorization: Bearer $TOKEN" \\
  http://localhost:8080/admin/activity/summary?days=7`
          },
          {
            title: 'בדיקת מונה Micrometer',
            language: 'bash',
            code: `curl http://localhost:8080/actuator/metrics/menora.generation.count`
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 12. תהליכי עבודה נפוצים
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
        content: `עקבו אחר שלבים אלה להוספת תלות חדשה למערכת כדי שמפתחים יוכלו לבחור בה במחולל.`,
        workflowSteps: [
          {
            title: 'צרו קבוצת תלות (במידת הצורך)',
            description: 'לכו ל-Config → Dependency Groups. אם התלות החדשה שלכם שייכת לקטגוריה חדשה, לחצו + Add Group, הזינו שם, שמרו. דלגו על שלב זה אם משתמשים בקבוצה קיימת.'
          },
          {
            title: 'צרו את רשומת התלות',
            description: 'לכו ל-Config → Dependencies. לחצו + Add Dependency. מלאו: depId (ייחודי, אותיות קטנות), name, description, group, קואורדינטות Maven (groupId + artifactId; השאירו version ריק אם מנוהל על ידי Spring Boot BOM). הגדירו compatibilityRange אם הספרייה עובדת רק עם גרסאות Boot מסוימות.'
          },
          {
            title: 'הוסיפו תרומות קבצים',
            description: 'לכו ל-Config → File Contributions. עבור כל קובץ להזרקה (למשל application-mylib.yml לקונפיגורציית YAML, MyLibConfig.java למחלקת קונפיגורציה Java), לחצו + Add. הגדירו dependencyId ל-depId החדש שלכם, fileType (YAML_MERGE ל-YAML, TEMPLATE ל-Java), targetPath, content, substitutionType (PACKAGE לקבצי Java), ו-sortOrder.'
          },
          {
            title: 'הוסיפו תצורות Build (במידת הצורך)',
            description: 'לכו ל-Config → Build Customizations. אם הספרייה דורשת תלויות Maven נוספות (מעבר לרשומה הראשית) או הוצאות, הוסיפו אותן כאן. הגדירו dependencyId ל-depId החדש שלכם ו-customizationType ל-ADD_DEPENDENCY או EXCLUDE_DEPENDENCY.'
          },
          {
            title: 'הוסיפו אפשרויות משניות (אם רלוונטי)',
            description: 'אם לתלות יש תוכן מיוצר אופציונלי (למשל מחלקות דוגמה), לכו ל-Config → Sub-Options. הוסיפו רשומות אפשרות משנית עם dependencyId = ה-depId שלכם. לאחר מכן חזרו לתרומות קבצים והגדירו subOptionId על תרומות הקבצים המותנות.'
          },
          {
            title: 'הוסיפו כללי תאימות (אם רלוונטי)',
            description: 'לכו ל-Config → Compatibility. הוסיפו כללי REQUIRES, CONFLICTS, או RECOMMENDS. לדוגמה, אם הספרייה שלכם דורשת JPA, הוסיפו כלל REQUIRES: sourceDepId = ה-depId שלכם, targetDepId = data-jpa.'
          },
          {
            title: 'לחצו Refresh',
            description: 'בפינה הימנית-עליונה של האדמין, לחצו על כפתור Refresh. זה טוען מחדש את מטמון המטה-דאטה כך שהתלות החדשה שלכם תופיע בממשק המחולל הראשי.'
          },
          {
            title: 'בדקו זאת',
            description: 'לכו למחולל הראשי (לחצו על לוגו Spring Initializr), מצאו את התלות החדשה שלכם בבוחר, בחרו אותה, לחצו Generate, ופרקו כדי לאמת שכל הקבצים הצפויים קיימים ומאוכלסים כראוי.'
          }
        ]
      },
      {
        id: 'workflow-common-file',
        title: 'הוספת קובץ לכל פרויקט',
        description: 'כיצד להזריק קובץ לכל הפרויקטים שנוצרים באמצעות __common__.',
        content: `השתמשו בתהליך עבודה זה כאשר אתם רוצים שכל פרויקט שנוצר יכיל קובץ ספציפי — ללא קשר לתלויות שהמפתח בוחר.`,
        workflowSteps: [
          {
            title: 'לכו לתרומות קבצים',
            description: 'Config → File Contributions → לחצו + Add.'
          },
          {
            title: 'הגדירו dependencyId ל-__common__',
            description: 'הקלידו בדיוק: __common__ (שני קווים תחתונים בכל צד). זהו ערך הסנטינל שמשמעותו "החל על כל הפרויקטים".'
          },
          {
            title: 'בחרו את סוג הקובץ',
            description: 'STATIC_COPY לקובץ קבוע, TEMPLATE לקובץ עם משתני פרויקט, YAML_MERGE להוספת ערכים ל-application.yaml לכל הפרויקטים, DELETE להסרת קובץ שנוצר על ידי המסגרת.'
          },
          {
            title: 'הגדירו נתיב יעד ותוכן',
            description: 'הזינו את נתיב היעד בתוך הפרויקט שנוצר (למשל scripts/setup.sh). לסוג TEMPLATE, השתמשו במשתני תחלופה כמו {{artifactId}} והגדירו substitutionType ל-PROJECT.'
          },
          {
            title: 'שמרו ובדקו',
            description: 'שמרו את הרשומה. אין צורך ב-Refresh — תרומות קבצים נכנסות לתוקף בבקשת היצירה הבאה. צרו פרויקט בדיקה ואמתו שהקובץ קיים.'
          }
        ]
      },
      {
        id: 'workflow-version-dockerfile',
        title: 'Dockerfiles ספציפיים לגרסה',
        description: 'כיצד לקבל Dockerfiles שונים עבור Java 17 לעומת Java 21.',
        content: `תבנית זו משתמשת בשדה javaVersion לשירות תוכן קובץ שונה בהתאם לגרסת Java הנבחרת.`,
        workflowSteps: [
          {
            title: 'צרו את תרומת Dockerfile עבור Java 17',
            description: 'לכו לתרומות קבצים → + Add. הגדירו: dependencyId = __common__, fileType = TEMPLATE, targetPath = Dockerfile, substitutionType = PROJECT, javaVersion = 17. כתבו את תוכן Dockerfile באמצעות image בסיס eclipse-temurin:17-jre-alpine. כללו {{artifactId}} בפקודת COPY.'
          },
          {
            title: 'צרו את תרומת Dockerfile עבור Java 21',
            description: 'צרו רשומה שנייה עם הגדרות זהות פרט ל-javaVersion = 21 ותוכן Dockerfile המשתמש ב-eclipse-temurin:21-jre-alpine.'
          },
          {
            title: 'אמתו את הכוונון',
            description: 'המערכת בוחרת בדיוק תרומה אחת בהתבסס על גרסת Java הנבחרת של הפרויקט. צרו פרויקט Java 17 ופרויקט Java 21, בדקו כל Dockerfile כדי לאשר שנעשה שימוש ב-image הבסיסי הנכון.'
          }
        ],
        callouts: [
          {
            type: 'info',
            text: 'אם אתם גם רוצים Dockerfile גיבוי לגרסאות Java שאינן מפורטות, צרו רשומה שלישית עם javaVersion ריק. היא תשמש לכל גרסת Java שאין לה התאמה מפורשת.'
          }
        ]
      },
      {
        id: 'workflow-sub-option',
        title: 'הוספת אפשרות משנית לתלות קיימת',
        description: 'כיצד להוסיף מחלקת דוגמה אופציונלית או קונפיגורציה לתלות קיימת.',
        content: `השתמשו בזה כאשר אתם רוצים לתת למפתחים תוספת אופציונלית בתוך תלות קיימת — למשל, מחלקת שירות לדוגמה או קונפיגורציית מקור נתונים משני.`,
        workflowSteps: [
          {
            title: 'הגדירו את האפשרות המשנית',
            description: 'לכו ל-Config → Sub-Options → + Add. הגדירו: dependencyId = ה-depId הקיים (למשל postgresql), optionId = מזהה קצר ייחודי (למשל pg-readonly), label = שם תצוגה (למשל "Read-Only DataSource"), description = טקסט טולטיפ.'
          },
          {
            title: 'צרו את תרומת הקובץ המגודרת',
            description: 'לכו ל-Config → File Contributions → + Add. הגדירו: dependencyId = אותו depId, fileType = TEMPLATE (או YAML_MERGE), targetPath = הקובץ ליצירה, content = תוכן התבנית, subOptionId = ה-optionId שזה עתה יצרתם (למשל pg-readonly).'
          },
          {
            title: 'בדקו את האפשרות המשנית',
            description: 'במחולל הראשי, בחרו את התלות האב. תיבת הסימון של האפשרות המשנית אמורה להופיע. סמנו אותה, צרו פרויקט, ואמתו שהקובץ המגודר קיים. לאחר מכן צרו ללא האפשרות המשנית מסומנת ואמתו שהקובץ אינו קיים.'
          }
        ]
      }
    ]
  }
]
