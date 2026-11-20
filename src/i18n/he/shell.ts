/** Hebrew for the shell: the header, its menus and commands, toasts, dialogs, the palette, the tours,
 *  the shortcut sheets and the shared parts every tab uses. See ./index.ts for the glossary. */
import type { Dict } from '../index'

const dict: Dict = {
  // ── Tabs ──
  'Backend': 'בקאנד',
  'Frontend': 'פרונטאנד',
  'Fullstack': 'פולסטאק',
  'Training': 'הדרכה',
  'Guide': 'מדריך',
  'Config': 'ניהול',

  // ── Header ──
  'Open navigation': 'פתח ניווט',
  'Sections': 'אזורים',
  'Open the command palette': 'פתח את לוח הפקודות',
  'Search and commands · Ctrl+K': 'חיפוש ופקודות · Ctrl+K',
  'Search': 'חיפוש',
  'Copy share link': 'העתק קישור שיתוף',
  'Copy a link to this setup': 'העתק קישור להגדרה הזו',
  'Reset to defaults': 'איפוס לברירות המחדל',
  'Toggle animations': 'הפעל או כבה אנימציות',
  'Disable animations': 'כבה אנימציות',
  'Enable animations': 'הפעל אנימציות',
  'Toggle theme': 'החלף ערכת צבעים',
  'Switch to light mode': 'עבור למצב בהיר',
  'Switch to dark mode': 'עבור למצב כהה',
  'More actions': 'פעולות נוספות',
  'Help': 'עזרה',
  'Take the tour': 'סיור מודרך',
  'Keyboard shortcuts': 'קיצורי מקלדת',
  'Explore': 'עיון',
  'Preview project files before downloading': 'הצג את קבצי הפרויקט לפני ההורדה',
  'Generate': 'צור',
  'Generate and download the project (Ctrl+Enter)': 'צור והורד את הפרויקט (Ctrl+Enter)',
  'Building…': 'בונה…',
  'Done!': 'מוכן!',
  'Cancel': 'ביטול',
  'Retry': 'נסה שוב',
  'Retrying…': 'מנסה שוב…',
  'Dismiss': 'סגור',
  'Dismiss error': 'סגור את השגיאה',
  'Confirm': 'אישור',
  'Reset': 'איפוס',

  // ── Backend page heading (drawn by App) ──
  'Spring Boot Generator': 'מחולל Spring Boot',
  'Pick a stack and its dependencies and get a Menora-standard Spring Boot project as a ZIP.':
    'בחרו stack ותלויות, וקבלו פרויקט Spring Boot בתקן של מנורה כקובץ ZIP.',
  "Couldn't generate preview": 'לא ניתן היה ליצור תצוגה מקדימה',
  'Reset project to defaults?': 'לאפס את הפרויקט לברירות המחדל?',
  'Your current form values and selected dependencies will be lost.': 'הערכים בטופס והתלויות שנבחרו יימחקו.',

  // ── Toasts ──
  'Link copied to clipboard': 'הקישור הועתק',
  "Couldn't copy link — copy it from the address bar": 'לא ניתן היה להעתיק את הקישור — העתיקו אותו משורת הכתובת',
  "Couldn't generate project: {error}": 'לא ניתן היה ליצור את הפרויקט: {error}',
  'curl command copied': 'פקודת ה-curl הועתקה',
  "Couldn't copy the curl command": 'לא ניתן היה להעתיק את פקודת ה-curl',
  'Fix project metadata: {error}': 'יש לתקן את פרטי הפרויקט: {error}',
  'Fix project metadata before generating': 'יש לתקן את פרטי הפרויקט לפני היצירה',
  'Fix project metadata first': 'יש לתקן קודם את פרטי הפרויקט',
  'Project downloaded!': 'הפרויקט הורד!',
  'Frontend project downloaded!': 'פרויקט הפרונטאנד הורד!',
  'Project reset to defaults': 'הפרויקט אופס לברירות המחדל',
  'Open the Backend, Frontend or Fullstack tab to take its tour': 'פתחו את לשונית הבקאנד, הפרונטאנד או הפולסטאק כדי לצאת לסיור שלה',
  '{what} copied': '{what} הועתק',
  "Couldn't copy: {what}": 'לא ניתן היה להעתיק: {what}',

  // ── Commands (⌘K) ──
  'Go to': 'מעבר אל',
  'Go to {tab}': 'מעבר אל {tab}',
  'App': 'אפליקציה',
  'Switch between light and dark': 'מעבר בין בהיר לכהה',
  'Turn animations on or off': 'הפעלה או כיבוי של אנימציות',
  'Take the tour of this tab': 'סיור מודרך בלשונית הזו',
  'Generate and download the project': 'צור והורד את הפרויקט',
  'Explore the generated files': 'עיון בקבצים שייווצרו',
  'Compare starter templates': 'השוואת תבניות התחלה',
  'Turn the multi-module project on or off': 'הפעלה או כיבוי של פרויקט multi-module',
  'Show or hide the project files': 'הצג או הסתר את קבצי הפרויקט',
  'The files this setup generates, kept current as you change it': 'הקבצים שההגדרה הזו יוצרת, מתעדכנים תוך כדי שינוי',
  'Reset the project to defaults': 'איפוס הפרויקט לברירות המחדל',

  // ── Common words, shared by the tabs ──
  'Save': 'שמור',
  'Close': 'סגור',
  'Next': 'הבא',
  'Description': 'תיאור',
  'Loading…': 'טוען…',
  'Copied': 'הועתק',
  'Remove {name}': 'הסר את {name}',
  'Delete {name}': 'מחק את {name}',
  'Recent': 'אחרונים',
  'Dependencies': 'תלויות',
  'Language': 'שפה',
  'Java Version': 'גרסת Java',
  'Spring Boot Version': 'גרסת Spring Boot',
  'Packaging': 'אריזה',
  'Starter Templates': 'תבניות התחלה',
  'Search dependencies': 'חיפוש תלויות',
  'Selected Dependencies': 'תלויות שנבחרו',
  'Explore Dependencies': 'עיון בתלויות',
  'No dependencies selected': 'לא נבחרו תלויות',
  'No results found': 'לא נמצאו תוצאות',
  'Project Metadata': 'פרטי הפרויקט',
  'Project Name': 'שם הפרויקט',
  'My Presets': 'התצורות שלי',
  'Save current as preset…': 'שמור את הנוכחי כתצורה…',
  'Untitled preset': 'תצורה ללא שם',
  'untitled': 'ללא שם',
  'just now': 'עכשיו',
  '{n}m ago': 'לפני {n} דק׳',
  '{n}h ago': 'לפני {n} שע׳',
  '{n}d ago': 'לפני {n} ימים',
  'Unpack': 'חילוץ',
  'Run': 'הרצה',
  'Keep this setup:': 'שמירת ההגדרה:',

  // ── Command palette ──
  'Command palette': 'לוח הפקודות',
  'Search actions, dependencies, templates and settings': 'חיפוש פעולות, תלויות, תבניות והגדרות',
  "Search actions… (e.g. 'add entity', 'generate')": "חיפוש פעולות… (למשל 'ישות', 'צור')",
  "Search actions, dependencies, templates… (e.g. 'web', 'generate')": "חיפוש פעולות, תלויות, תבניות… (למשל 'web', 'צור')",
  'TO CLOSE': 'לסגירה',
  'Results': 'תוצאות',
  'No results found for "{query}"': 'לא נמצאו תוצאות עבור "{query}"',
  'Selected': 'נבחר',
  'Current': 'נוכחי',
  'Showing {shown} of {total} — type to narrow it down.': 'מוצגות {shown} מתוך {total} — הקלידו כדי לצמצם.',
  'Set {setting} to {value}': 'הגדר {setting} ל-{value}',

  // ── Backend unreachable / no access / error boundary ──
  'Cannot reach backend': 'אין חיבור לבקאנד',
  'Make sure the Spring Initializr backend is running on port 8080.': 'ודאו שהבקאנד של Spring Initializr פועל בפורט 8080.',
  'Trying…': 'מנסה…',
  'Retry now': 'נסה עכשיו',
  'Asking the backend…': 'פונה לבקאנד…',
  'Trying again in {seconds} s': 'ניסיון נוסף בעוד {seconds} שנ׳',
  'No access': 'אין גישה',
  'This site can only be opened through the company sign-in. Open it from its usual address, then try again.':
    'אפשר לפתוח את האתר הזה רק דרך ההזדהות של החברה. פתחו אותו מהכתובת הרגילה שלו ונסו שוב.',
  'Checking…': 'בודק…',
  'Try again': 'נסה שוב',
  'Something went wrong': 'משהו השתבש',
  'The page hit an unexpected error. Reloading usually fixes it; if it keeps happening, reset the locally saved project data.':
    'בדף אירעה שגיאה לא צפויה. טעינה מחדש בדרך כלל פותרת אותה; אם היא חוזרת, אפסו את נתוני הפרויקט השמורים בדפדפן.',
  'Reload': 'טען מחדש',
  'Reset local data': 'אפס נתונים מקומיים',

  // ── Shortcut sheets ──
  'Ctrl is ⌘ on a Mac. Chords work while typing; the bare keys wait until you leave the field.':
    'ב-Mac, Ctrl הוא ⌘. צירופי מקשים פועלים גם בזמן הקלדה; מקש בודד ממתין עד שיוצאים מהשדה.',
  'Generate the fullstack ZIP': 'יצירת ה-ZIP של הפולסטאק',
  'Save the current model as a preset': 'שמירת המודל הנוכחי כתצורה',
  'Redo': 'בצע שוב',
  'Command palette — every action on this tab': 'לוח הפקודות — כל פעולה בלשונית הזו',
  'Move through the entity outline and open a card': 'מעבר ברשימת הישויות ופתיחת כרטיס',
  'Search the library (in the layout designer)': 'חיפוש בספרייה (בעורך הפריסה)',
  'Remove the selected widget (layout designer)': "הסרת הווידג'ט הנבחר (עורך הפריסה)",
  'Move the selected widget (layout designer)': "הזזת הווידג'ט הנבחר (עורך הפריסה)",
  'Make the selected widget narrower or wider': "הצרה או הרחבה של הווידג'ט הנבחר",
  'Copy or cut the selected widget — or, with none selected, copy every widget of the dashboard':
    "העתקה או גזירה של הווידג'ט הנבחר — או, כשלא נבחר אף אחד, העתקת כל הווידג'טים של הדשבורד",
  'Rename a title on the canvas in place — Enter saves, Esc cancels (layout designer)':
    'שינוי שם של כותרת ישירות על הקנבס — Enter שומר, Esc מבטל (עורך הפריסה)',
  'Duplicate the selected widget (layout designer)': "שכפול הווידג'ט הנבחר (עורך הפריסה)",
  'Paste copied widgets onto the dashboard on the canvas (after the selected one)':
    "הדבקת ווידג'טים שהועתקו לדשבורד שעל הקנבס (אחרי הנבחר)",
  'On a focused page chip: remove the page, or move it (layout designer)': 'על שבב של עמוד שבפוקוס: הסרת העמוד או הזזתו (עורך הפריסה)',
  'Play the layout: click through it as the app would (layout designer)': 'הפעלת הפריסה: מעבר בה בלחיצות, כמו באפליקציה (עורך הפריסה)',
  'Open a focused page chip’s menu; Ctrl/Shift-click picks several pages (layout designer)':
    'פתיחת התפריט של שבב עמוד שבפוקוס; Ctrl/Shift ולחיצה בוחרים כמה עמודים (עורך הפריסה)',
  'Close a dialog, panel or the import drawer; in the designer, deselect first': 'סגירת חלון, חלונית או מגירת הייבוא; בעורך — קודם מבטל את הבחירה',
  'Show this list': 'הצגת הרשימה הזו',
  'Command palette — every action, dependency and setting': 'לוח הפקודות — כל פעולה, תלות והגדרה',
  'Save the current setup as a preset': 'שמירת ההגדרה הנוכחית כתצורה',
  'From the search box, move through the results': 'מתיבת החיפוש: מעבר בין התוצאות',
  'In the search box: add (or remove) the first result': 'בתיבת החיפוש: הוספה (או הסרה) של התוצאה הראשונה',
  'On a dependency: select it': 'על תלות: בחירה בה',
  'Clear the search; close a dialog, drawer or menu': 'ניקוי החיפוש; סגירת חלון, מגירה או תפריט',
  'Close a dialog or menu': 'סגירת חלון או תפריט',

  // ── Tours ──
  'Tour · {n} of {total}': 'סיור · {n} מתוך {total}',
  'Skip': 'דלג',
  'Backend tour': 'סיור בבקאנד',
  'Frontend tour': 'סיור בפרונטאנד',
  'Fullstack tour': 'סיור בפולסטאק',
  'Start from a template': 'התחילו מתבנית',
  'A template ticks a working set of dependencies in one click. Save your own setups as presets right below, and compare templates side by side.':
    'תבנית מסמנת בלחיצה אחת סט תלויות שעובד. שמרו הגדרות משלכם כתצורות ממש מתחת, והשוו תבניות זו לצד זו.',
  'Name the project': 'תנו לפרויקט שם',
  'Group, artifact and package, the Spring Boot and Java versions. A field that would stop Generate says so here.':
    'Group, artifact ו-package, וגרסאות Spring Boot ו-Java. שדה שימנע את היצירה יגיד זאת כאן.',
  'Pick dependencies': 'בחרו תלויות',
  'Press / and type — initials work ("sdj" finds Spring Data JPA). Enter adds the first result. Star the ones you use; they stay on top as quick picks.':
    'הקישו / והקלידו — גם ראשי תיבות עובדים ("sdj" מוצא את Spring Data JPA). Enter מוסיף את התוצאה הראשונה. סמנו בכוכב את אלה שאתם משתמשים בהן, והן יישארו למעלה כבחירות מהירות.',
  'Options and wizards': 'אפשרויות ואשפים',
  'What you picked, with its options. A dependency with a wizard badge can generate code from a SQL script, an OpenAPI spec, a WSDL or an AsyncAPI document.':
    'מה שבחרתם, עם האפשרויות שלו. תלות עם תג אשף יכולה ליצור קוד מסקריפט SQL, ממפרט OpenAPI, מ-WSDL או ממסמך AsyncAPI.',
  'Watch the files': 'עקבו אחרי הקבצים',
  'The project’s file tree, updated as you tick dependencies, with what each one adds. Click a file to read it.':
    'עץ הקבצים של הפרויקט, שמתעדכן כשמסמנים תלויות, עם מה שכל אחת מוסיפה. לחצו על קובץ כדי לקרוא אותו.',
  'Explore, then Generate': 'קודם עיון, ואז יצירה',
  'Explore shows every file before you download — and what changed since the last look. Generate downloads the ZIP (Ctrl+Enter). Ctrl+K reaches everything; ? lists the keys.':
    'עיון מציג כל קובץ לפני ההורדה — וגם מה השתנה מאז הפעם הקודמת. "צור" מוריד את ה-ZIP (Ctrl+Enter). Ctrl+K מגיע לכל דבר; ? מציג את המקשים.',
  'A template picks a router, state, styling and tooling that work together. Change anything afterwards.':
    'תבנית בוחרת router, ניהול state, עיצוב וכלים שעובדים יחד. אפשר לשנות הכול אחר כך.',
  'Pick the tooling': 'בחרו את הכלים',
  'Press / to search. A badge says which React versions a library supports; conflicts are flagged as you pick.':
    'הקישו / לחיפוש. תג מציין באילו גרסאות React ספרייה תומכת; התנגשויות מסומנות תוך כדי בחירה.',
  'Explore shows the files first. Generate downloads the ZIP (Ctrl+Enter); the card that follows has the commands to run it.':
    'עיון מציג קודם את הקבצים. "צור" מוריד את ה-ZIP (Ctrl+Enter); בכרטיס שמופיע אחר כך יש את הפקודות להרצה.',
  'Start from an example': 'התחילו מדוגמה',
  'Each example is a complete model — entities, relations and pages. Open one and change it, or load a preset, a team model or a project’s own menora-model.json.':
    'כל דוגמה היא מודל שלם — ישויות, קשרים ועמודים. פתחו אחת ושנו אותה, או טענו תצורה, מודל של הצוות או את ה-menora-model.json של פרויקט.',
  'Describe the entities': 'תארו את הישויות',
  'Fields, relations and options per entity; the outline on the side jumps between them. Problems that would stop Generate are counted and one click away.':
    'שדות, קשרים ואפשרויות לכל ישות; הרשימה שבצד קופצת ביניהן. בעיות שימנעו את היצירה נספרות, ונמצאות במרחק לחיצה.',
  'Lay out the app': 'סדרו את האפליקציה',
  'Open the layout designer to arrange dashboards, lists, records and forms on a live canvas — or keep the classic one-list-per-entity shell.':
    'פתחו את עורך הפריסה כדי לסדר דשבורדים, רשימות, רשומות וטפסים על קנבס חי — או השאירו את המעטפת הקלאסית, רשימה אחת לכל ישות.',
  'One ZIP with a Spring Boot backend and a React frontend, wired together. Ctrl+K lists every action on this tab; ? lists the keys.':
    'ZIP אחד עם בקאנד Spring Boot ופרונטאנד React, מחוברים זה לזה. Ctrl+K מציג כל פעולה בלשונית הזו; ? מציג את המקשים.',

  // ── Shared parts ──
  'Could not load departments ({error}) — the default department is used': 'לא ניתן היה לטעון את המחלקות ({error}) — נעשה שימוש במחלקת ברירת המחדל',
  'Default department': 'מחלקת ברירת מחדל',
  '{name} (unknown)': '{name} (לא מוכר)',
  'Department': 'מחלקה',
  'Next steps': 'הצעדים הבאים',
  'The setup has changed since — generate again to get the current version.': 'ההגדרה השתנתה מאז — צרו שוב כדי לקבל את הגרסה הנוכחית.',
  'Dismiss next steps': 'סגור את הצעדים הבאים',
  'Copy {label} command': 'העתק את פקודת ה{label}',
  '{label} command': 'פקודת ה{label}',
  'Color Palette': 'פלטת צבעים',

  // ── What the team shares (models, presets, templates): whose it is to change ──
  'Saved by {user} — only they or a signed-in admin can change or delete it': 'נשמר על ידי {user} — רק הם או מנהל מחובר יכולים לשנות או למחוק אותו',
  'Only whoever saved it or a signed-in admin can change or delete it': 'רק מי ששמר אותו או מנהל מחובר יכולים לשנות או למחוק אותו',
}

export default dict
