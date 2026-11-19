/** Hebrew for The Frontend tab. See ./index.ts for the glossary. */
import type { Dict } from '../index'

const dict: Dict = {
  // ── The view ──
  'React Frontend Generator': 'מחולל פרונטאנד React',
  'React + TypeScript + Vite, scaffolded as a Feature-Sliced Design project with the tooling you choose.':
    'React + TypeScript + Vite, במבנה Feature-Sliced Design ועם הכלים שתבחרו.',
  'Generate and download the frontend project': 'צור והורד את פרויקט הפרונטאנד',
  'Reset the frontend project to defaults': 'איפוס פרויקט הפרונטאנד לברירות המחדל',
  'Cannot load frontend catalog': 'לא ניתן לטעון את קטלוג הפרונטאנד',
  'Make sure the backend exposes {path} on port 8080.': 'ודאו שהבקאנד חושף את {path} בפורט 8080.',
  '{file} is downloaded — {n} dependency': '{file} הורד — {n} תלות',
  '{file} is downloaded — {n} dependencies': '{file} הורד — {n} תלויות',
  'Install and start it, then open': 'התקינו והפעילו אותו, ואז פתחו את',
  'Explore the files': 'עיון בקבצים',
  'Reset project to defaults (clears form & dependencies)': 'איפוס הפרויקט לברירות המחדל (מנקה את הטופס ואת התלויות)',
  'FSD layers:': 'שכבות FSD:',

  // ── Project form ──
  'Scope (optional, no @)': 'Scope (רשות, בלי @)',
  'App Title (browser tab)': 'כותרת האפליקציה (בלשונית הדפדפן)',
  'npm name will be': 'שם החבילה ב-npm יהיה',

  // ── Options ──
  'None / Plain CSS': 'ללא / CSS רגיל',
  'Stack': 'סטאק',
  'Package Manager': 'מנהל חבילות',
  'Design System': 'מערכת עיצוב',
  'Base Path': 'נתיב בסיס',
  'RTL layout': 'פריסה מימין לשמאל (RTL)',
  'dir="rtl" + Hebrew lang; mirrored right-to-left UI': 'dir="rtl" ושפה עברית; ממשק מימין לשמאל',
  'TypeScript {typescript} · Vite {vite} (pinned)': 'TypeScript {typescript} · Vite {vite} (גרסאות קבועות)',
  'Paired Backend (optional)': 'בקאנד מותאם (רשות)',
  'API Base URL': 'כתובת הבסיס של ה-API',
  'Writes {env} and a {api} proxy in {config}.': 'כותב את {env} ו-proxy ל-{api} ב-{config}.',
  'Backend ArtifactId': 'ה-ArtifactId של הבקאנד',
  'Mentioned in the generated README only.': 'מוזכר רק ב-README שנוצר.',

  // ── Presets ──
  'Preset name (e.g. My dashboard baseline)': 'שם התצורה (למשל: בסיס הדשבורד שלי)',
  'No presets yet. Configure a project and click "Save current as preset…" above.':
    'אין עדיין תצורות. הגדירו פרויקט ולחצו למעלה על "שמור את הנוכחי כתצורה…".',
  'No recent projects yet. Generate or explore a project to see it here.':
    'אין עדיין פרויקטים אחרונים. צרו פרויקט או עיינו בו כדי לראות אותו כאן.',
  '{n} dep': '{n} תלות',
  '{n} deps': '{n} תלויות',

  // ── Dependencies ──
  'React {version} only': 'React {version} בלבד',
  'Search router, state, query…': 'חיפוש router, state, query…',
  'We couldn’t find any dependencies matching “{search}”': 'לא נמצאו תלויות שמתאימות ל-“{search}”',
  'conflicts with': 'מתנגשת עם',
  'requires': 'דורשת',
  'Search and add dependencies from the panel on the right.': 'חפשו והוסיפו תלויות מהחלונית הסמוכה.',
}

export default dict
