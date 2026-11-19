/**
 * The Hebrew dictionary: English text → Hebrew, one file per area of the site, merged here into
 * the one chunk `setLang('he')` loads. `npm run i18n:check` lists what is missing or unused.
 *
 * Glossary — keep one word for one thing across the site:
 *   Backend / Frontend / Fullstack (tabs) → בקאנד / פרונטאנד / פולסטאק
 *   Training → הדרכה · Guide → מדריך · Config (the admin tab) → ניהול
 *   project → פרויקט · dependency → תלות (pl. תלויות) · module → מודול
 *   Generate → צור · Explore → עיון · preview → תצוגה מקדימה · download → הורדה
 *   preset → תצורה שמורה · template → תבנית · starter template → תבנית התחלה
 *   entity → ישות · field → שדה · relation → קשר · page → עמוד · widget → וידג'ט
 *   layout → פריסה · dashboard → דשבורד · list → רשימה · record → רשומה · form → טופס
 *   workflow → תהליך עבודה · transition (a workflow move) → מעבר · step → שלב
 *   rule → כלל · option → אפשרות · setting → הגדרה · share link → קישור שיתוף
 *   wizard → אשף · team → צוות · update (of a project) → עדכון · model → מודל
 *   undo / redo → בטל / בצע שוב · reset → איפוס · copy → העתק · cancel → ביטול
 *   warning → אזהרה · error → שגיאה · suggestion → הצעה · issue / problem → בעיה
 * Buttons and common words:
 *   Save → שמור · Delete → מחק · Remove → הסר · Close / Dismiss → סגור · Add → הוסף · Edit → ערוך
 *   Open → פתח · Load → טען · Import → ייבוא · Export → ייצוא · Apply → החל · Back → חזרה
 *   Next → הבא · Previous → הקודם · Confirm → אישור · Cancel → ביטול · Retry → נסה שוב
 *   Done → סיום · Yes / No → כן / לא · Name → שם · Description → תיאור · Type → סוג
 *   Required → חובה · Optional → רשות · Loading… → טוען… · None → ללא · Default → ברירת מחדל
 *   Settings → הגדרות · Search → חיפוש · Filter → סינון · Copy → העתק · Copied → הועתק
 *   Show / Hide → הצג / הסתר · More → עוד · Clear → נקה · Collapse / Expand → כווץ / הרחב
 * Messages: say "לא ניתן היה ל…" for "Couldn't …"; a toast after an action is past tense
 * ("הקישור הועתק"); address the user in the plural imperative ("בחרו", "פתחו") in hints and
 * sentences, and use short singular imperatives on buttons ("צור", "שמור").
 * Kept in English: product and technical names — Spring Boot, Maven, Java, React, Vite, Kafka,
 * JSON, YAML, SQL, DDL, Flyway, OpenAPI, AsyncAPI, WSDL, SOAP, REST, API, ZIP, curl, Docker,
 * groupId / artifactId, ldap-auth, Vault, H2, PostgreSQL, Oracle, SQL Server, DB2.
 */
import type { Dict } from '../index'
import shell from './shell'
import backend from './backend'
import explore from './explore'
import frontend from './frontend'
import fullstack from './fullstack'
import designer from './designer'
import pages from './pages'

const dict: Dict = { ...shell, ...backend, ...explore, ...frontend, ...fullstack, ...designer, ...pages }

export default dict
