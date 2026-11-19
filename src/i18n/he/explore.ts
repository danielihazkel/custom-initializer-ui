/** Hebrew for Explore (the project preview modal), the file tree and the diff viewer. See ./index.ts for the glossary. */
import type { Dict } from '../index'

const dict: Dict = {
  // ── ProjectPreview ──
  "Couldn't copy the path": 'לא ניתן היה להעתיק את הנתיב',
  "Couldn't copy the file": 'לא ניתן היה להעתיק את הקובץ',
  'Files of {name}': 'הקבצים של {name}',
  '{n} added': '{n} נוספו',
  '{n} modified': '{n} שונו',
  '{n} removed': '{n} הוסרו',
  'added': 'נוסף',
  'removed': 'הוסר',
  'modified': 'שונה',
  'What to show': 'מה להציג',
  'Normal': 'רגיל',
  'Diff': 'השוואה',
  'Download ZIP': 'הורד ZIP',
  'Close preview': 'סגור את התצוגה המקדימה',
  'Find a file': 'מציאת קובץ',
  'Files (Ctrl+P or /)': 'קבצים (Ctrl+P או /)',
  'Files': 'קבצים',
  'Search in files (Ctrl+Shift+F)': 'חיפוש בקבצים (Ctrl+Shift+F)',
  'Filter files…': 'סינון קבצים…',
  'Filter files by name': 'סינון קבצים לפי שם',
  'Search in every file…': 'חיפוש בכל הקבצים…',
  'Search in every file': 'חיפוש בכל הקבצים',
  'Type two letters or more.': 'הקלידו שתי אותיות או יותר.',
  'Nothing in these files says “{query}”.': 'אף קובץ כאן לא מכיל את ”{query}“.',
  '{lines} in {files}': '{lines} ב-{files}',
  '{n} line': '{n} שורה',
  '{n} lines': '{n} שורות',
  'Only the first {n} lines are listed — add a word.': 'מוצגות רק {n} השורות הראשונות — הוסיפו מילה.',
  'Resize the file list': 'שינוי רוחב רשימת הקבצים',
  'Path': 'נתיב',
  'Show only {dir}': 'הצג רק את {dir}',
  'Wrap long lines': 'גלישת שורות ארוכות',
  'Copy path': 'העתק נתיב',
  'Copy file': 'העתק קובץ',
  'Download file': 'הורד קובץ',
  'Download {file}': 'הורד את {file}',

  // ── DiffContentViewer ──
  '{n} unchanged line': '{n} שורה שלא השתנתה',
  '{n} unchanged lines': '{n} שורות שלא השתנו',
  'New file': 'קובץ חדש',
  'Removed file': 'קובץ שהוסר',
  '{n} change': '{n} שינוי',
  '{n} changes': '{n} שינויים',
  'Previous change': 'השינוי הקודם',
  'Next change': 'השינוי הבא',
  'Diff layout': 'תצוגת ההשוואה',
  'Unified': 'מאוחדת',
  'Side by side': 'זה לצד זה',

  // ── FileTree ──
  'Project files': 'קבצי הפרויקט',
  'No file matches “{filter}”.': 'אין קובץ שמתאים ל-”{filter}“.',
  'Has changes': 'יש שינויים',
}

export default dict
