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
  // 2. מחולל פרויקטי Frontend (React + TS + Vite + FSD)
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
אותו קטלוג מבוסס-DB שמייצר backend של Spring Boot מייצר גם פרויקטי **React + TypeScript + Vite** בארכיטקטורת [Feature-Slice Design](https://feature-sliced.design/). המפתח בוחר שם פרויקט, npm scope, תלויות, sub-options, ולוחץ Generate — התשובה היא פרויקט frontend מכווץ שמוכן ל-\`pnpm install && pnpm dev\`.

לשונית **Frontend** ראשית חדשה בממשק יושבת ליד **Backend / Training / Guide / Config**. אותו פאנל אדמין מנהל את שני הקטלוגים זה לצד זה.

### למה נתיב שני במקום שימוש חוזר ב-Spring?
מסגרת Spring Initializr קשורה ל-Maven/Gradle בקשיחות — היא לא יכולה לייצר \`package.json\` או \`vite.config.ts\`. לכן נתיב ה-FE עוקף את המסגרת לחלוטין. \`FrontendStarterController\` הוא REST controller רגיל של Spring שמפעיל שירות חדש בשם \`FrontendProjectGenerator\`, שבונה תיקייה זמנית בדיוק כמו ה-backend ואז מכווץ.

מה שחשוב — נתיב ה-FE **משתמש מחדש** בכל מה שלא תלוי בכלי הבנייה: \`DependencyConfigService\`, טבלת \`FileContributionEntity\` (עם כל ארבעת הסוגים — STATIC_COPY, TEMPLATE, YAML_MERGE, DELETE), \`ProjectOptionsContext\` ל-sub-options, פילטר ה-servlet \`InitializrWebConfiguration\`, ואותו מנוע Mustache עם אותן ההסכמות בקונטקסט (\`has<Dep>\`, \`opt<Dep><Option>\`).

### דיסקרימינטור ProjectKind
לכל שורה בשש טבלאות הקטלוג יש עכשיו עמודת \`project_kind\` (\`BACKEND\` או \`FRONTEND\`). קטלוגי backend ו-frontend חיים באותו מסד H2 אבל לעולם לא רואים זה את זה — \`DependencyConfigService\` מסנן לפי kind בזמן שאילתה. שורות קיימות מקבלות \`BACKEND\` כברירת מחדל כך שהשינוי תואם לאחור באופן מלא.`,
        callouts: [
          {
            type: 'info',
            text: 'נתיב ה-FE **אינו** עובר דרך מסגרת Spring Initializr. הנקודות תחת `/frontend/*`, נפרדות מ-`/starter.zip`. לשונית Frontend בממשק מדברת עם `/frontend/metadata` ו-`/frontend/starter.zip`.'
          }
        ]
      },
      {
        id: 'fe-using',
        title: 'שימוש בלשונית Frontend',
        description: 'מה מפתח רואה וממלא בעת יצירת פרויקט React.',
        content: `### עמודה שמאלית — פרויקט + Stack
- **Project Name** — שם התיקייה וערך \`package.json "name"\`. נגזר אוטומטית ל-App Title ב-title case.
- **Scope** (אופציונלי) — npm scope בלי ה-\`@\`. \`menora\` + \`my-app\` הופך ל-\`@menora/my-app\` ב-\`package.json\`.
- **App Title** — מופיע ב-\`<title>\` וב-HomePage לדוגמה.
- **Description** — ערך \`package.json "description"\`.
- **React** — תפריט גרסה (18 / 19), ברירת מחדל מ-\`application.yml\`.
- **Node** — תפריט גרסה (18 / 20 / 22).
- **Package Manager** — pill toggle: \`npm\` או \`pnpm\`. משפיע על הוראות ההרצה ב-README דרך הדגלים \`isNpm\` / \`isPnpm\` ב-Mustache.
- **Base Path** — קונפיגורציית \`base\` של Vite לפריסות תת-נתיב (ברירת מחדל \`/\`).

### עמודה ימנית — תלויות
אותה תבנית של chips + רשימה מקובצת כמו בלשונית ה-Backend. לכל תלות יכולים להיות sub-options שמופיעים כ-checkboxes מקוננים אחרי שהאב נבחר. תיבת סינון בראש מחפשת לפי id, שם ותיאור.

### Generate
כפתור Generate ב-FrontendView מחובר ל-\`/frontend/starter.zip\` עם כל ערכי הטופס + התלויות הנבחרות ורשימות \`opts-{depId}\` לכל תלות. הקובץ מוזרם לדפדפן כ-\`{projectName}.zip\`.

### שמירת מצב
כל שינוי בטופס, בבחירות, או ב-sub-options נכתב ל-\`localStorage\` תחת \`frontendInitializrState\` — רענון של הדף משחזר את המצב. הקישור "Reset to defaults" מנקה אותו.`,
        callouts: [
          {
            type: 'tip',
            text: 'לשונית ה-Frontend **אינה** חולקת state, presets, או recents עם לשונית ה-Backend. הן עצמאיות. Backend ממשיך להשתמש ב-`useProjectState`; frontend משתמש ב-hook המקביל `useFrontendState`.'
          }
        ]
      },
      {
        id: 'fe-admin-pill',
        title: 'אדמין: ה-Pill של Backend ⇄ Frontend',
        description: 'איך הטוגל בכותרת האדמין מגביל כל לשונית לקטלוג אחד.',
        content: `### איפה למצוא
פתחו Config (Admin). בכותרת יש עכשיו pill toggle קטן: **Backend** | **Frontend**. ה-kind הנוכחי נשמר ב-\`localStorage\` כך שהוא שורד רענון דף.

### על מה זה משפיע
שש לשוניות מסננות שורות לפי ערך ה-pill הנוכחי ומסמנות \`projectKind\` על כל רשומה חדשה:
- **Dep Groups** — קטגוריות שמופיעות בבוחר
- **Dependencies** — רשומות הקטלוג
- **File Contribs** — שורות STATIC_COPY / TEMPLATE / YAML_MERGE / DELETE
- **Build Customizations** — כולל שני הסוגים החדשים שתחומים ל-FE (למטה)
- **Sub-Options** — בחירות מותנות לכל תלות
- **Compatibility** — חוקי REQUIRES / CONFLICTS / RECOMMENDS

### על מה זה לא משפיע
- **Overview** ו-**Activity** מציגות נתונים בשני ה-kinds.
- **Templates** (חבילות starter) ו-**Modules** (multi-module) הם backend-only ב-v1.

### שורות מהעבר
שורות קיימות ללא \`projectKind\` נחשבות \`BACKEND\` על ידי הסנן בצד הלקוח (ברירת המחדל ב-DB דואגת לכך גם בצד השרת). אין צורך ב-backfill.`,
        callouts: [
          {
            type: 'warning',
            text: 'אם יוצרים רשומה תחת ה-pill הלא נכון — למשל מוסיפים `state-zustand` כשה-pill על Backend — היא תופיע ב-`/metadata/client` (קטלוג Spring) ותשבור את ה-pipeline של ה-backend בזמן יצירה. תמיד ודאו את ה-pill לפני שלוחצים **New Entry**.'
          }
        ]
      },
      {
        id: 'fe-build-types',
        title: 'שני סוגי Build Customization חדשים',
        description: 'ADD_NPM_DEPENDENCY ו-ADD_VITE_PLUGIN — שימוש חוזר בעמודות קיימות עם משמעויות חדשות.',
        content: `### שימוש חוזר בסכמה
במקום להוסיף ישות חדשה, ל-\`BuildCustomizationEntity\` נוספו שני ערכי enum. העמודות שלו **מתפרשות מחדש** לפי שילוב של \`projectKind\` ו-\`customizationType\`. משמעות השדה לכל שורה:

| Type | פרשנות שדות |
|---|---|
| \`ADD_NPM_DEPENDENCY\` | \`mavenArtifactId\` = שם חבילת npm (למשל \`react-router-dom\`); \`version\` = טווח semver (למשל \`^6.26.0\`); \`scope\` = \`"dev"\` → מגיע ל-\`devDependencies\`, כל ערך אחר → \`dependencies\` |
| \`ADD_VITE_PLUGIN\` | \`mavenGroupId\` = נתיב import (למשל \`@vitejs/plugin-react\`); \`mavenArtifactId\` = שם binding (למשל \`react\`); \`version\` = ביטוי קריאת ה-plugin (למשל \`react()\`) |

### איך הם מיושמים
- **\`PackageJsonBuilder\`** טוען את ה-baseline \`templates/frontend/fe-package-base.mustache\`, מבצע render דרך Mustache, מפרסר ל-Jackson tree, ואז עובר על כל שורות \`ADD_NPM_DEPENDENCY\` ומכניס אותן לבלוק הנכון. המפתחות ממוינים אלפביתית בכל בלוק לדיפים יציבים.
- **\`ViteConfigBuilder\`** טוען את \`templates/frontend/fe-vite-config.mustache\`, אוסף imports ייחודיים ורשימת קריאות plugin משורות \`ADD_VITE_PLUGIN\`, חושף אותם כ-\`{{vitePluginImports}}\` ו-\`{{vitePluginCalls}}\` בקונטקסט ה-Mustache, ומבצע render.

### חבילות שתמיד מותקנות
התלות \`__common__\` נושאת את ה-npm deps הבסיסיים שכל פרויקט מקבל — \`react\`, \`react-dom\`, \`typescript\`, \`vite\`, \`@vitejs/plugin-react\`, בתוספת ערימת האיכות שתמיד פעילה (\`eslint\`, \`prettier\`, \`husky\`, \`lint-staged\`, ועוד). שורת \`@vitejs/plugin-react\` היא גם השורה היחידה \`ADD_VITE_PLUGIN\` ב-\`__common__\`.`,
        callouts: [
          {
            type: 'tip',
            text: 'הוספת חבילת npm חדשה דרך האדמין היא שורה אחת: בחרו **Build Customizations**, הגדירו את ה-type ל-`ADD_NPM_DEPENDENCY`, מלאו את שם החבילה ב-**mavenArtifactId**, גרסה ב-**version**, ו-`"dev"` ב-**scope** אם זה שייך ל-devDependencies.'
          }
        ]
      },
      {
        id: 'fe-structure',
        title: 'מה נוצר',
        description: 'כל פרויקט מגיע עם הקבצים האלה — ללא קשר לבחירת התלויות.',
        content: `### מבנה בסיסי
כל פרויקט frontend שנוצר כולל:

- **בנייה וקונפיגורציה** — \`package.json\`, \`vite.config.ts\`, \`tsconfig.json\`, \`tsconfig.node.json\` עם aliases של נתיבים \`@app/@pages/@widgets/@features/@entities/@shared\` ממופים גם ב-Vite וגם ב-TypeScript.
- **כניסה** — \`index.html\` (עם החלפת \`{{appTitle}}\`), \`src/main.tsx\` שעוטף \`<App/>\` מ-\`@app/App\`, ו-HomePage עובד תחת \`src/pages/home/ui/\` כך ש-\`pnpm dev\` מראה משהו ברגע שההתקנה מסתיימת.
- **איכות** — \`eslint.config.js\` (flat config, TS + React + react-hooks + react-refresh), \`.prettierrc.json\`, \`.husky/pre-commit\` שמריץ \`lint-staged\`. תמיד פעיל.
- **CI / פריסה** — \`Dockerfile\` רב-שלבי (node → nginx), \`nginx.conf\` עם SPA fallback, \`Jenkinsfile\`, \`.dockerignore\`.
- **כל 6 שכבות ה-FSD** — \`src/app\`, \`src/pages\`, \`src/widgets\`, \`src/features\`, \`src/entities\`, \`src/shared\` — לכל אחת barrel \`index.ts\` ו-\`README.md\` קצר שמסביר את מקום השכבה בהיררכיית ה-imports של FSD.

### קבצים תלויי תלות
- **\`style-tailwind\`** → \`tailwind.config.js\`, \`postcss.config.js\`, \`src/index.css\` עם שלוש הוראות \`@tailwind\`. \`src/main.tsx\` מייבא את ה-CSS תלוי-תנאי דרך \`{{#hasStyleTailwind}}…{{/hasStyleTailwind}}\`.
- **\`test-vitest-rtl\`** → \`vitest.config.ts\`, \`src/test-setup.ts\`. \`package.json\` מקבל את ה-scripts \`test\`, \`test:ui\`, \`coverage\` תחת \`{{#hasTestVitestRtl}}\`.
- כל השאר כרגע רק npm deps — המשתמש מחבר את הספרייה ל-\`App.tsx\` בעצמו. הוספת חיבור אוטומטי לכל תלות היא שורת file-contribution אחת מרחק.`,
        callouts: [
          {
            type: 'info',
            text: 'גם Mustache וגם JSX משתמשים ב-`{{` כפותח טוקן — אובייקטי inline-style כמו `style={{ color: "red" }}` מתנגשים. ה-`HomePage.tsx` הזרוע מרים את הסגנונות לקבועים ברמת המודול, וזה הפתרון הנקי ביותר. אם אתם כותבים שורת TEMPLATE שזקוקה ל-JSX עם סוגריים כפולים, השתמשו באותו דפוס.'
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

מחזיר את ברירות המחדל של הטופס, את תפריטי React/Node/package-manager, את גרסאות ה-TS/Vite המקובעות, ואת קטלוג ה-FRONTEND (קבוצות → רשומות → sub-options).

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

Sub-options עוקבים אחר אותה הסכמה \`opts-{depId}=opt1,opt2\` כמו בנתיב ה-backend; ה-servlet filter הקיים \`InitializrWebConfiguration\` מאכלס את \`ProjectOptionsContext\` לכל בקשה שמגיעה לאפליקציה, כך שנקודות הקצה של ה-frontend מקבלות sub-options בחינם.`,
      },
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // 3. קבוצות תלויות
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
מיישם תחלופת משתנים על התוכן, ואז כותב אותו לנתיב היעד. התוכן עובר רינדור דרך מנוע Mustache אמיתי (\`com.samskivert:jmustache\`) כאשר \`substitutionType\` הוא MUSTACHE, מה שמאפשר גם משתני תחלופה וגם מקטעים מותנים (ראו להלן).

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
        title: 'תחלופת תבניות (Mustache)',
        description: 'משתנים, מקטעים ותוכן מותנה בתרומות קבצים מסוג TEMPLATE.',
        content: `### סוגי תחלופה

תרומות \`TEMPLATE\` עוברות רינדור דרך מנוע Mustache אמיתי (\`com.samskivert:jmustache\`, עם HTML escaping מושבת). לשדה \`substitutionType\` שני ערכים:

- **NONE** — ללא תחלופה. התוכן נכתב כפי שהוא. מתאים לקבצים זהים בינארית (log4j2 XML, .editorconfig, entrypoint.sh).
- **MUSTACHE** — התוכן עובר רינדור דרך jmustache עם ההקשר המאוחד למטה. זהו ברירת המחדל לכל תבנית עם משתנים או בלוקים מותנים.

### ההקשר המאוחד
כל תבנית MUSTACHE מקבלת את אותו ההקשר. **משתנים** מתרנדרים כטקסט; **מקטעים** (\`{{#name}}…{{/name}}\`) מתרנדרים רק כאשר השם אמת; **מקטעים הפוכים** (\`{{^name}}…{{/name}}\`) מתרנדרים רק כאשר השם שקר/חסר.

**משתני פרויקט:**
- \`{{artifactId}}\` — מזהה artifact של הפרויקט (למשל \`demo\`)
- \`{{groupId}}\` — מזהה קבוצת הפרויקט (למשל \`com.menora\`)
- \`{{version}}\` — גרסת הפרויקט (למשל \`0.0.1-SNAPSHOT\`)
- \`{{packageName}}\` — חבילת הבסיס (למשל \`com.menora.demo\`)
- \`{{packagePath}}\` — שם החבילה עם נקודות מוחלפות בסלשים (למשל \`com/menora/demo\`)
- \`{{javaVersion}}\` — גרסת ה-JDK שהמשתמש בחר, למשל \`17\` או \`21\`
- \`{{packaging}}\` — \`jar\` או \`war\`

**בוליאני תלויות** — \`has\` + PascalCase של depId. מקפים, קווים תחתונים ונקודות הם מפרידי מילים:
- \`{{#hasKafka}}…{{/hasKafka}}\` — depId \`kafka\`
- \`{{#hasSecurity}}…{{/hasSecurity}}\` — depId \`security\`
- \`{{#hasMailSampler}}…{{/hasMailSampler}}\` — depId \`mail-sampler\`

**בוליאני תת-אפשרויות** — \`opt\` + PascalCase(depId) + PascalCase(optionId):
- \`{{#optKafkaConsumerExample}}…{{/optKafkaConsumerExample}}\` — kafka + תת-אפשרות \`consumer-example\`
- \`{{#optMailSamplerSendMail}}…{{/optMailSamplerSendMail}}\` — mail-sampler + תת-אפשרות \`send-mail\`

### משתני נתיב יעד
ה**נתיב היעד** (לא רק התוכן) יכול להכיל \`{{packagePath}}\`, שהוא שם החבילה עם נקודות מוחלפות בסלשים. זה ממקם קבצי מקור Java בתיקייה הנכונה ללא קשר לחבילה שהמשתמש בחר.

**דוגמה:** נתיב יעד \`src/main/java/{{packagePath}}/config/KafkaConfig.java\` הופך ל-\`src/main/java/com/menora/demo/config/KafkaConfig.java\` עבור חבילה \`com.menora.demo\`.

### למה מקטעים מותנים חשובים
לפני מקטעי Mustache, כל וריאציה דרשה שורת תרומת קובץ משלה. מחלקה שפלטה \`@EnableAsync\` רק כאשר תת-אפשרות אסינכרונית נבחרה דרשה שתי שורות עם אותו \`targetPath\` — אחת עם ההערה, אחת בלי. מקטעי Mustache ממזגים את אלה לשורה אחת, ומפשטים את קטלוג ה-DB.`,
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
            title: 'שער תת-אפשרות — דוגמת @KafkaListener מותנית',
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
            text: 'משתנים לא ידועים מתרנדרים כמחרוזת ריקה — טעות הקלדה ב-{{hasKafak}} תפיק בשקט כלום. הריצו grep על התבניות כשמוסיפים תלות חדשה כדי לבדוק הפניות.'
          },
          {
            type: 'info',
            text: 'תגי מקטע עצמאיים ({{#name}} / {{/name}} בשורה משלהם) מקצצים רווח לבן מסביב לפי מפרט Mustache, ושומרים על Java נקי. שימו את התוכן באותה שורה של התג אם אתם צריכים שורה חדשה מפורשת.'
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
          { name: 'substitutionType', type: 'SubstitutionType', required: false, description: 'מצב תחלופת משתנים: NONE (תוכן נכתב כפי שהוא) או MUSTACHE (מעבד בעזרת jmustache — משתנים {{artifactId}}, {{groupId}}, {{version}}, {{packageName}}, {{packagePath}}, {{javaVersion}}, {{packaging}}, וסקציות בוליאניות כגון {{#hasKafka}}…{{/hasKafka}} או {{#optKafkaConsumerExample}}…{{/optKafkaConsumerExample}}).', example: 'MUSTACHE' },
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
  // 10b. אשף SOAP
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
כאשר המפתח בוחר את התלות \`web-services\` (Spring Web Services starter), כפתור **"SOAP…"** מופיע על אותה כרטיסיה. לחיצה עליו פותחת מגירה שבה המפתח מדביק מסמך WSDL 1.1. בלחיצה על Generate, ה-backend שומר את ה-WSDL ב-\`src/main/resources/wsdl/\`, מגדיר את plugin של JAX-WS Maven ליצור מחלקות payload של JAXB בזמן build, ופולט אחד משלושה — stubs של \`@Endpoint\` בצד שרת, client מסוג \`WebServiceGatewaySupport\`, או שניהם — בהתאם למצב הנבחר.

זהו התאום הסימטרי של אשף OpenAPI לצוותי SOAP. הוא מסיר את הבויילרפלייט גם לשרתי SOAP בגישת contract-first וגם לצרכני SOAP.

### אילו תלויות זכאיות
ה-UI קורא ל-\`GET /metadata/soap-capable-deps\` בטעינת הדף — הכפתור מופיע רק על כרטיסיות תלות שנוכחות בתגובה (כרגע רק \`web-services\`, בחיתוך עם תלויות הקיימות בקטלוג).

### זרימה במבט מהיר
1. המפתח בוחר \`web-services\` מהקטלוג.
2. לוחץ **SOAP…** על כרטיסיית התלות.
3. מדביק או מעלה WSDL (\`.wsdl\` או \`.xml\`).
4. רשימת **שירותים שזוהו** חיה מופיעה (debounced 400ms) עם ערכים כגון \`CountryService.CountryPort: getCountry, listCountries\`.
5. בוחר מצב — **Endpoints**, **Client**, או **Both** — ואופציונלית מחליף sub-packages, את context path של ה-servlet (במצב endpoint), ואת מאפיין ה-base URL (במצב client).
6. שמירה → כרטיסיית התלות מציגה תווית "WSDL attached".
7. לחיצה על **Generate** או **Explore** — ה-UI שולח POST \`/starter-wizard.zip\` / \`/starter-wizard.preview\` עם גוף JSON. ה-endpoint משותף עם אשפי SQL ו-OpenAPI — בקשה אחת יכולה לשאת \`wsdlByDep\`, \`specByDep\`, ו-\`sqlByDep\` ביחד.`,
        callouts: [
          {
            type: 'info',
            text: 'מחלקות JAXB request/response לא נכתבות לתוך ה-ZIP. הן נוצרות בזמן build על ידי ה-plugin של JAX-WS Maven מתוך ה-XSD המוטמע ב-WSDL. ה-mvn compile הראשון מייצר אותן תחת target/generated-sources/jaxws/. סביבות פיתוח מזהות את התיקייה הזאת אוטומטית.'
          },
          {
            type: 'info',
            text: 'אשפי SQL, OpenAPI ו-SOAP כולם ניתנים לשילוב — POST /starter-wizard.zip מקבל את sqlByDep, specByDep ו-wsdlByDep יחדיו. מפות ריקות הן no-op.'
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
| \`BOTH\` | כל הנ"ל. ה-endpoints וה-client חולקים את אותן מחלקות payload שנוצרות על ידי JAXB. |

### מתודות Endpoint
לכל פעולת WSDL:

- מתודה אחת לפעולה, \`@PayloadRoot(namespace = ..., localPart = ...)\` אחד לכל מתודה
- \`namespace\` נלקח מ-namespace של ה-element של ה-request (או מ-\`targetNamespace\` של ה-WSDL אם ל-part אין הפניה ל-element)
- \`localPart\` נלקח מהשם המקומי של ה-element של ה-request (או משם הפעולה כ-fallback)
- חתימת המתודה משתמשת בשמות מחלקות payload של JAXB; הם יבוצעו resolve כש-\`mvn compile\` יריץ את ה-plugin של JAX-WS
- הגוף זורק \`UnsupportedOperationException\`

### מתודות Client
לכל פעולת WSDL:

- מתודה אחת לפעולה, עם טיפוס request של JAXB כפרמטר וטיפוס response של JAXB כערך החזרה
- הגוף מאציל ל-\`getWebServiceTemplate().marshalSendAndReceive(request)\`
- ה-beans של \`WebServiceTemplate\` ו-\`Jaxb2Marshaller\` מוגדרים ב-\`SoapClientConfig\` עם \`contextPath\` המכוון ל-package שנוצר

### חבילות
- WSDL → \`src/main/resources/wsdl/{kebab-cased-service-name}.wsdl\`
- Endpoints → \`{packageName}.{endpointSubPackage}\` (ברירת מחדל \`endpoint\`)
- Client → \`{packageName}.{clientSubPackage}\` (ברירת מחדל \`client\`)
- payloads של JAXB → \`{packageName}.{payloadSubPackage}\` (ברירת מחדל \`generated\`) — נוצר בזמן build על ידי plugin של JAX-WS`,
      },
      {
        id: 'soap-wizard-api',
        title: 'REST API',
        description: 'נקודות קצה POST ומטא-נתונים נלווים.',
        content: `### נקודות קצה

| Method | Path | מטרה |
|---|---|---|
| \`GET\` | \`/metadata/soap-capable-deps\` | מזהי תלות זכאים לאשף (בחיתוך עם תלויות בקטלוג) |
| \`POST\` | \`/starter-wizard.zip\` | יצירת ZIP עם endpoints/clients (משותף עם אשפי SQL ו-OpenAPI) |
| \`POST\` | \`/starter-wizard.preview\` | עץ קבצים + תוכן (אותה צורה כמו \`/starter.preview\`) |
| \`POST\` | \`/starter-wizard.detect-services\` | פרסור צד-שרת: \`{ wsdl }\` → \`["CountryService.CountryPort: getCountry, listCountries"]\` עבור התצוגה החיה במגירה |

### למה נקודת קצה POST חדשה
מסמכי WSDL בקלות נכנסים לעשרות קילובייטים כש-XSD המוטמע אינו טריוויאלי — הרבה מעבר למגבלות אורך URL טיפוסיות. שימוש חוזר באותה נקודת קצה POST של האשף שכבר קיימת עבור SQL ו-OpenAPI שומר על אחידות הצורה ב-wire ועוקף תקרות גודל URL.

### שגיאות פירוש
אם ה-WSDL פגום, ה-backend מחזיר HTTP 400 עם גוף כגון \`{ "error": "Invalid WSDL", "messages": ["WSDLException: faultCode=PARSER_ERROR: ..."] }\`. המגירה מציגה את ההודעות האלה בבאנר צהוב.`,
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
    "wsdlByDep":{"web-services":"<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>\\n<wsdl:definitions xmlns:wsdl=\\"http://schemas.xmlsoap.org/wsdl/\\" ..."},
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
          { name: 'wsdlByDep', type: 'object', required: false, description: 'מפה של depId → טקסט מסמך WSDL 1.1 גולמי. wsdl4j מפרש בצד השרת.', example: '{ "web-services": "<?xml version=\\"1.0\\"?>..." }' },
          { name: 'soapOptions', type: 'object', required: false, description: 'מפה של depId → { mode, endpointSubPackage, clientSubPackage, payloadSubPackage, baseUrlProperty, contextPath }. mode הוא אחד מ-ENDPOINTS, CLIENT, BOTH (ברירת מחדל ENDPOINTS).', example: '{ "web-services": { "mode": "BOTH", "endpointSubPackage": "endpoint", "clientSubPackage": "client" } }' },
          { name: 'dependencies', type: 'array', required: true, description: 'מערך dep-id הרגיל. רק תלויות הרשומות ב-/metadata/soap-capable-deps יעובדו עם רשומותיהן ב-wsdlByDep.', example: '[ "web-services" ]' }
        ]
      },
      {
        id: 'soap-wizard-limits',
        title: 'הערות ומגבלות (גרסה 1)',
        description: 'מה היצירה הזו עושה, מה לא, ומדוע.',
        content: `### מה גרסה 1 מפיקה
- ה-WSDL עצמו, נכתב verbatim ל-\`src/main/resources/wsdl/{kebab-service-name}.wsdl\`.
- ה-plugin של JAX-WS Maven (\`com.sun.xml.ws:jaxws-maven-plugin:4.0.2\`) מחובר ל-\`generate-sources\` ב-\`pom.xml\` — מייצר מחלקות payload של JAXB מה-XSD המוטמע בכל \`mvn compile\`.
- \`{Service}Endpoint.java\` ו/או \`{Service}Client.java\` אחד לכל \`<wsdl:service>\`, מתודה אחת לכל פעולה.
- \`WebServiceConfig.java\` (מצב endpoint) ו/או \`SoapClientConfig.java\` (מצב client).
- מקטע \`application.yaml\` עם מאפיין ה-base URL (מצב client בלבד) — מוזג עמוק ל-\`application.yaml\` הקיים.

### מה גרסה 1 לא מפיקה
- **אין מחלקות JAXB ב-ZIP.** הן חיות ב-\`target/generated-sources/jaxws/\` אחרי ש-\`mvn compile\` מריץ את ה-plugin. סביבות פיתוח קולטות את זה אוטומטית.
- **אין תמיכה ב-WSDL 2.0** — wsdl4j מפרש WSDL 1.1 בלבד.
- **אין קלט XSD עצמאי** — האשף מצפה ל-WSDL עם schemas מוטמעים או מוצמדים.
- **אין דריסת SOAP 1.2 binding** — שתי קישורי כתובת 1.1 ו-1.2 מזוהים בתצוגה החיה, אך הקוד שנוצר משתמש ב-\`MessageFactory\` ברירת המחדל (SOAP 1.1). עברו ל-SOAP 1.2 ב-\`SoapClientConfig\` אחרי היצירה אם נדרש.
- **אין חיווט mTLS / WS-Security** — ה-client שנוצר הוא HTTP פשוט. חברו interceptors (\`Wss4jSecurityInterceptor\`, \`HttpComponents5MessageSender\` מותאם) בעצמכם.

### מדוע הבחירות האלה
יצירת קוד JAXB היא בעיה מורכבת ומפותרת היטב; מימוש מחדש שלה בתוך האשף יהיה שימוש לא יעיל במאמץ ויסתה ללא הרף מהתנהגות הייחוס של ה-JDK. האצלה ל-plugin של JAX-WS Maven נותנת למפתח את המחלקות *המדויקות* שהיה מייצר ידנית מה-WSDL, ללא הפתעות — ערך האשף הוא חיווט Spring סביב המחלקות האלה, לא המחלקות עצמן.`,
        callouts: [
          {
            type: 'tip',
            text: 'אחרי היצירה, הריצו mvn -DskipTests compile פעם אחת כדי לממש את מחלקות ה-payload של JAXB. מחלקות Endpoint ו-Client שנוצרו לא יבוצעו resolve ב-IDE עד שזה ירוץ לפחות פעם אחת.'
          },
          {
            type: 'tip',
            text: 'עבור WS-Security או mTLS, הוסיפו interceptors / WebServiceMessageSender מותאם ב-SoapClientConfig אחרי היצירה. האשף נשאר במכוון מחוץ למדיניות אבטחה — היא משתנה יותר מדי לכל שירות.'
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
            description: 'לכו ל-Config → File Contributions. עבור כל קובץ להזרקה (למשל application-mylib.yml לקונפיגורציית YAML, MyLibConfig.java למחלקת קונפיגורציה Java), לחצו + Add. הגדירו dependencyId ל-depId החדש שלכם, fileType (YAML_MERGE ל-YAML, TEMPLATE ל-Java), targetPath, content, substitutionType (MUSTACHE לקבצי Java), ו-sortOrder.'
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
            description: 'הזינו את נתיב היעד בתוך הפרויקט שנוצר (למשל scripts/setup.sh). לסוג TEMPLATE, השתמשו במשתני תחלופה כמו {{artifactId}} והגדירו substitutionType ל-MUSTACHE.'
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
            description: 'לכו לתרומות קבצים → + Add. הגדירו: dependencyId = __common__, fileType = TEMPLATE, targetPath = Dockerfile, substitutionType = MUSTACHE, javaVersion = 17. כתבו את תוכן Dockerfile באמצעות image בסיס eclipse-temurin:17-jre-alpine. כללו {{artifactId}} בפקודת COPY.'
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
  },

  // ─────────────────────────────────────────────────────────────────
  // 13. חוזה לסוכני AI
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'agent',
    title: 'חוזה לסוכני AI',
    icon: 'smart_toy',
    topics: [
      {
        id: 'agent-what',
        title: 'מהו חוזה הסוכן',
        description: 'משטח HTTP ייעודי לסוכני AI ולקוחות headless.',
        content: `### מטרה
חוזה הסוכן הוא משטח מקביל לממשק הדפדפן, המיועד לסוכני AI (Claude, GPT, פנים-ארגוניים) ולכל לקוח HTTP שמעדיף עץ קבצים בפורמט JSON על פני ZIP בינארי. הזרימה: סוכן קורא לחוזה כדי ליצור שלד פרויקט Spring Boot, ולאחר מכן ממשיך לערוך את העץ שנוצר עם הלוגיקה העסקית שלו.

### שלושה חלקים
1. **\`GET /agent/manifest\`** — גילוי בקריאה אחת של כל התלויות, אפשרויות המשנה, תבניות ה-starter/multi-module, וחזרה על יכולות ה-wizards. מחליף שבעה round-trips נפרדים אל \`/metadata/*\`.
2. **\`POST /agent/scaffold\`** — אותו pipeline שמפעיל \`/starter-wizard.zip\`, אך מחזיר עץ קבצים בפורמט JSON (utf-8 + base64) יחד עם manifest. אין צורך בטיפול בבינארי.
3. **\`.menora-init.json\`** — manifest שנכתב בשורש הפרויקט, מציין את הקלטים ו-SHA-256 לכל קובץ. מאפשר לסוכן להבחין בין קבצים שנוצרו על ידי השלד לקבצים שהסוכן ערך בעצמו.

### למה לא הנקודות הקיימות?
\`/starter.zip\` ו-\`/starter-wizard.zip\` מצוינות עבור דפדפנים, אבל הן מאלצות סוכן להתמודד עם ZIP בינארי ולתפור גילוי מתוך מספר נקודות. חוזה הסוכן מאחד את שניהם ל-JSON, מה שהופך אותו לשמיש מכל שכבת tool-call של LLM בשתי בקשות HTTP.

### אימות
כרגע ללא אימות, בהתאם לנקודות הציבוריות הקיימות. ניתן להוסיף שכבת bearer-token בעתיד אם המשטח נחשף החוצה.`,
        callouts: [
          {
            type: 'info',
            text: 'חוזה הסוכן הוא תוספתי — ממשק הדפדפן ממשיך להשתמש ב-/starter.zip ו-/starter-wizard.zip בדיוק כמו קודם. שום דבר במשטח הקיים לא משתנה.'
          },
          {
            type: 'tip',
            text: 'הגילוי ניתן לקאש. אם הסוכן מבצע מספר קריאות scaffold ברצף, עדיף למשוך את /agent/manifest פעם אחת ולשמור.'
          }
        ]
      },
      {
        id: 'agent-discovery',
        title: 'GET /agent/manifest — גילוי',
        description: 'נקודת קצה אחת המספקת את הקטלוג המלא הדרוש לסוכן לפני scaffold.',
        content: `### מבנה התשובה
JSON מסוג \`AgentManifestResponse\` המכיל כל קטלוג שהסוכן צריך כדי לבנות בקשת scaffold תקינה: תלויות (עם sub-options ב-inline ו-Boot compatibility ranges), starter templates, module templates, חוקי תאימות, ארבע רשימות ה-\`SingleSelectCapability\` (boot/java/language/packaging), ובלוק \`wizards\` עם רשימת התלויות הנתמכות עבור SQL, OpenAPI ו-SOAP.

### למה זה קריאה אחת
ממשק הדפדפן קורא ל-\`/metadata/client\`, \`/metadata/extensions\`, \`/metadata/compatibility\`, \`/metadata/starter-templates\`, \`/metadata/module-templates\`, \`/metadata/openapi-capable-deps\`, \`/metadata/soap-capable-deps\` ו-\`/metadata/sql-dialects\` בנפרד. לסוכן אין UI לאופטימיזציה; קריאה אחת שומרת על פרומפט פשוט.

### הנחיית ולידציה לסוכנים
לפני קריאה ל-\`/agent/scaffold\`, על הסוכן:
- לבחור \`bootVersion\` מתוך \`bootVersions\` (ברירת מחדל זמינה ב-\`defaultBootVersion\`).
- לסנן \`dependencies[]\` לפי \`compatibilityRange\` כנגד גרסת ה-Boot שנבחרה (סוכן שיבחר תלות לא תואמת יקבל 4xx).
- לאתר את המזהים החוקיים של sub-options לכל תלות ב-\`dependencies[].subOptions\`.`,
        codeExamples: [
          {
            title: 'גילוי — curl',
            language: 'bash',
            code: `curl http://localhost:8080/agent/manifest | jq '{
  bootVersions, javaVersions,
  depCount: (.dependencies | length),
  sqlDeps: .wizards.sql.capableDeps
}'`
          },
          {
            title: 'גילוי — TypeScript SDK',
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
        title: 'POST /agent/scaffold — יצירה',
        description: 'JSON-in, JSON-out: יצירת פרויקט שמחזירה עץ קבצים (utf-8 או base64).',
        content: `### מבנה הבקשה
הגוף הוא super-set של \`/starter-wizard.zip\` הקיים, בתוספת דגל \`mode\` ומערך \`modules\`. כל שדות ה-wizard (\`sqlByDep\`, \`specByDep\`, \`wsdlByDep\` וכו') מתקבלים בדיוק כמו ב-\`/starter-wizard.zip\`.

### בורר המצב
| Mode | התנהגות |
|---|---|
| \`wizard\` (ברירת מחדל) | פרויקט יחיד; שדות ה-wizard עבור SQL/OpenAPI/SOAP מכובדים. |
| \`starter\` | פרויקט יחיד; שווה ערך ל-\`wizard\` עם שדות wizard ריקים. |
| \`multimodule\` | מחזיר HTTP 501 — השתמשו ב-\`GET /starter-multimodule.zip\` בינתיים. multi-module ב-JSON ב-roadmap. |

### מבנה התשובה
\`\`\`json
{
  "manifest": { /* .menora-init.json מפורק — ראו בנושא הבא */ },
  "files": [
    { "path": "pom.xml",                  "encoding": "utf-8",  "content": "<project>...", "sha256": "abc..." },
    { "path": "src/main/java/.../App.java","encoding": "utf-8", "content": "package ...;",  "sha256": "def..." },
    { "path": ".mvn/wrapper/mvn-wrapper.jar","encoding": "base64","content": "UEsD...",     "sha256": "789..." }
  ]
}
\`\`\`

### כללי קידוד
קבצים עם סיומות טקסטואליות (\`.java\`, \`.xml\`, \`.yaml\`, \`.properties\`, \`.json\`, \`.md\`, \`.sh\`, \`.gitignore\`, \`Dockerfile\`, \`mvnw\` וכו') משוננים inline כ-UTF-8. כל השאר, יחד עם זיהוי בינארי (בייט NUL ב-4 KB הראשונים), נופל לאחור ל-base64. שדה ה-\`sha256\` תמיד משקף את הבייטים הגולמיים — שימושי לבדיקה צולבת מול ה-checksums של ה-manifest.

### טיפול בשגיאות
שגיאות parse של wizards (WSDL/OpenAPI/SQL פגום) צצות כתשובות 400 מובנות, זהות ל-\`/starter-wizard.zip\`:
\`\`\`json
{ "error": "Invalid OpenAPI spec", "messages": ["..."] }
{ "error": "Invalid WSDL",         "messages": ["..."] }
{ "error": "Invalid SQL",          "dep": "postgresql", "detail": "..." }
\`\`\``,
        codeExamples: [
          {
            title: 'scaffold מינימלי',
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
            title: 'עם wizard SQL',
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
            title: 'דרך ה-SDK',
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
  // כתיבת \`bytes\` תחת הנתיב המבוקש
}`
          }
        ]
      },
      {
        id: 'agent-manifest',
        title: '.menora-init.json — מקור',
        description: 'manifest בשורש הפרויקט שעוקב אחר קבצים שמקורם ב-scaffold.',
        content: `### מה יש בו
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

### למה checksum לכל קובץ
לאחר ה-scaffold, הסוכן עורך קבצים. חלק מהעריכות יחולו על קבצים שמקורם ב-scaffold (למשל הוספת תלויות ל-\`pom.xml\`); חלקן יהיו קבצים חדשים לחלוטין (לוגיקה עסקית). כשהסוכן (או ריצת re-scaffold עתידית) רוצה לדעת מה זה מה, הוא משווה את עץ העבודה מול ה-manifest:

| מצב בעץ העבודה | משמעות |
|---|---|
| הנתיב ב-manifest, sha זהה | scaffold ללא שינוי |
| הנתיב ב-manifest, sha שונה | הסוכן ערך קובץ scaffold |
| הנתיב לא ב-manifest | הסוכן הוסיף קובץ חדש |
| הנתיב ב-manifest, הקובץ חסר | הסוכן מחק קובץ scaffold |

זה הופך re-scaffolding בטוח לבר-ביצוע: ריצות עתידיות יכולות לחשב 3-way diff (scaffold ישן → scaffold חדש → עריכות הסוכן) במקום לדרוס את עבודת הסוכן.

### חישוב ה-SHA בעצמכם
\`\`\`bash
# קובץ טקסט
echo -n "$(cat pom.xml)" | sha256sum
# או בכל שפה:
node -e 'console.log(require("crypto").createHash("sha256").update(require("fs").readFileSync("pom.xml")).digest("hex"))'
\`\`\``,
        callouts: [
          {
            type: 'info',
            text: 'ה-manifest עצמו מוחרג מתוך files[] שלו — ה-sha שלו היה משתנה בכל פעם שה-manifest נכתב, מה שהיה מבטל את הצורך כולו.'
          }
        ]
      },
      {
        id: 'agent-openapi',
        title: 'OpenAPI Spec ו-Swagger UI',
        description: 'תיעוד שנוצר אוטומטית עבור נקודות הקצה /agent/*.',
        content: `### נקודות קצה
- **\`GET /v3/api-docs\`** — מפרט OpenAPI 3 JSON מלא, מצומצם ל-\`com.menora.initializr.agent\` בלבד.
- **\`GET /swagger-ui.html\`** — Swagger UI אינטראקטיבי לאותו מפרט.

### למה הסינון לפי scope
ה-controllers של ה-wizards לדפדפן מצביעים בעקיפין על טיפוסי \`javax.xml.bind\` ישנים דרך \`swagger-parser\` ו-\`wsdl4j\`. מתן ל-springdoc לסרוק אותם היה מפוצץ את המפרט בזמן ריצה. אנחנו מצמצמים את הסריקה ל-\`com.menora.initializr.agent\` כך שהמפרט נשאר ממוקד, תקין, ומיושר עם החוזה שסוכנים באמת משתמשים בו.

### יצירת SDK
אפשר להפעיל codegen של OpenAPI מול \`/v3/api-docs\` ולקבל לקוח typed בחינם:
\`\`\`bash
npx openapi-typescript http://localhost:8080/v3/api-docs -o agent-types.ts
\`\`\`
ה-TypeScript SDK המסופק ב-\`clients/typescript/\` נכתב ביד עבור אינטגרציה נוחה עם Anthropic SDK, אבל אפשר להחליף או להשלים אותו עם codegen.`,
      },
      {
        id: 'agent-sdk',
        title: 'TypeScript SDK',
        description: '@menora/initializr-client — wrappers typed + הגדרות tool של Anthropic.',
        content: `### היכן הוא נמצא
\`clients/typescript/\` במונורפו. נבנה עם \`tsc\` רגיל; ללא bundler. משתמש ב-\`globalThis.fetch\` כך שרץ ללא שינוי ב-Node 18+, דפדפנים, Bun, Deno ו-Cloudflare Workers.

### שני משטחים
1. **\`InitializrClient\`** — wrappers typed לנקודות הקצה של הסוכן. שיטות: \`manifest()\`, \`scaffold(req)\`, \`detectOpenApiPaths(spec)\`, \`detectWsdlServices(wsdl)\`. שגיאות זורקות \`InitializrApiError\` עם status + parsed body.
2. **\`anthropicTools()\` + \`executeAgentTool()\`** — הגדרות tool של Anthropic מוכנות לשימוש בפורמט \`Anthropic.Messages.Tool\`, יחד עם helper שמנתב בלוקי \`tool_use\` חזרה לקריאת ה-backend הנכונה. ניתן לשלב בכל זרימת \`messages.create({ tools })\`.

### תצורה
- \`new InitializrClient({ baseUrl })\` — ברירת מחדל היא משתנה הסביבה \`MENORA_INITIALIZR_URL\`, fallback ל-\`http://localhost:8080\`.
- \`{ fetch }\` ו-\`{ timeoutMs }\` עבור runtimes לא סטנדרטיים.`,
        codeExamples: [
          {
            title: 'אינטגרציה עם Anthropic SDK',
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
  tools: anthropicTools(),                  // 4 כלים, סכמות מלאות
  messages: [{
    role: "user",
    content: "Scaffold a Spring Boot 3.2.1 project with Spring Web and JPA.",
  }],
});

for (const block of response.content) {
  if (block.type === "tool_use") {
    const result = await executeAgentTool(block.name, block.input, menora);
    // ...להזין את התוצאה לקריאת messages.create() הבאה
  }
}`
          },
          {
            title: 'שימוש פשוט ב-client',
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
        title: 'שרת MCP (Claude Code)',
        description: 'שרת Model Context Protocol שעוטף את חוזה הסוכן.',
        content: `### היכן הוא נמצא
\`mcp-server/\` במונורפו. פרויקט Node קטן שעוטף את ה-TypeScript SDK ככלים של MCP, כך ש-Claude Code (וכל לקוח MCP) יוכל להפעיל scaffold באופן native.

### התקנה
\`\`\`bash
cd mcp-server
npm install
npm run build
claude mcp add menora-initializr -- node /abs/path/to/mcp-server/dist/index.js
\`\`\`

הגדירו \`MENORA_INITIALIZR_URL\` אם ה-backend לא רץ ב-\`http://localhost:8080\`.

### כלים מוצעים

| כלי | נקודת קצה |
|---|---|
| \`list_capabilities\` | \`GET /agent/manifest\` |
| \`scaffold_project\` | \`POST /agent/scaffold\` |
| \`detect_openapi_paths\` | \`POST /starter-wizard.detect-paths\` |
| \`detect_wsdl_services\` | \`POST /starter-wizard.detect-services\` |

### שימוש מ-Claude Code
לאחר רישום, פרומפטים כמו הבא עובדים ללא הקשר נוסף:

> "Use menora-initializr to scaffold a Spring Boot 3.2.1 service with web, data-jpa, and postgresql."

Claude Code יקרא ל-\`list_capabilities\` כדי לאמת את הקלטים, אחר כך ל-\`scaffold_project\`, ולאחר מכן יכתוב את הקבצים לדיסק וימשיך במשימה.

### Transport
Stdio בלבד ב-v1. SSE/HTTP עבור סוכנים מרוחקים נמצא ב-roadmap; כרגע, יש להריץ את שרת ה-MCP לצד הסוכן (או באותו container).`,
        callouts: [
          {
            type: 'tip',
            text: 'שרת ה-MCP משתמש ב-TypeScript SDK המקומי דרך "@menora/initializr-client": "file:../clients/typescript". עריכות ב-SDK נקלטות לאחר build חוזר של שתי החבילות.'
          }
        ]
      },
      {
        id: 'agent-workflow',
        title: 'מקצה לקצה: סוכן AI בונה פרויקט',
        description: 'סקירה של סוכן שמבצע scaffold וממשיך עם הלוגיקה העסקית.',
        content: `השתמשו ב-workflow הזה כהפניה לאופן שבו סוכן צריך להפעיל את החוזה מקצה לקצה.`,
        workflowSteps: [
          {
            title: 'גילוי',
            description: 'הסוכן קורא ל-list_capabilities (או GET /agent/manifest). מקאש את התשובה. בוחר גרסת Boot מתוך bootVersions, מסנן dependencies[] לפי compatibilityRange, ומאתר את מזהי ה-sub-options הנדרשים.'
          },
          {
            title: 'אימות wizard אופציונלי',
            description: 'אם לסוכן יש מפרט OpenAPI או WSDL להזין, הוא קורא קודם ל-detect_openapi_paths / detect_wsdl_services. תשובה 400 כאן משמעה שהמפרט שבור — הסוכן מתקן אותו לפני scaffold במקום לקבל פרויקט חלקי.'
          },
          {
            title: 'Scaffold',
            description: 'הסוכן קורא ל-scaffold_project עם הקלטים שנפתרו. התשובה כוללת manifest ועץ קבצים JSON.'
          },
          {
            title: 'כתיבת קבצים לדיסק',
            description: 'הסוכן עובר על files[] וכותב כל אחד מהם תחת הספרייה המבוקשת, מפענח ערכי base64 קודם. ה-.menora-init.json יושב בשורש הפרויקט.'
          },
          {
            title: 'המשך עם לוגיקה עסקית',
            description: 'הסוכן עורך ומוסיף קבצים בחופשיות. ה-manifest בשורש מספר לו אילו קבצים הגיעו מה-scaffold (ובאיזה sha) ואילו הוא הוסיף בעצמו.'
          },
          {
            title: 'הידור ובדיקה',
            description: 'mvn verify סטנדרטי או שווה ערך. ה-scaffold משלח pom.xml תקין, כך שהסוכן לא אמור להזדקק לגעת ב-build לפני ה-compile הראשון.'
          }
        ]
      }
    ]
  }
]
