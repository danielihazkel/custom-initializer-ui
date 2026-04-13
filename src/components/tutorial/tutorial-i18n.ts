export type Lang = 'en' | 'he'

export interface UiStrings {
  sidebarTitle: string
  searchPlaceholder: string
  noLessonsFound: string
  clearSearch: string
  showArchitecture: string
  hideArchitecture: string
  implementationExample: string
  readOnly: string
  architectureHidden: string
  showVisualizer: string
  langToggleLabel: string
  langToggleTitle: string
}

export const UI_STRINGS: Record<Lang, UiStrings> = {
  en: {
    sidebarTitle: 'Spring Master',
    searchPlaceholder: 'Search lessons...',
    noLessonsFound: 'No lessons found',
    clearSearch: 'Clear search',
    showArchitecture: 'Show Architecture',
    hideArchitecture: 'Hide Architecture',
    implementationExample: 'Implementation Example',
    readOnly: 'Read-Only',
    architectureHidden: 'Architecture view hidden',
    showVisualizer: 'Show Visualizer',
    langToggleLabel: 'עב',
    langToggleTitle: 'עבור לעברית',
  },
  he: {
    sidebarTitle: 'ספרינג מאסטר',
    searchPlaceholder: 'חיפוש שיעורים...',
    noLessonsFound: 'לא נמצאו שיעורים',
    clearSearch: 'נקה חיפוש',
    showArchitecture: 'הצג ארכיטקטורה',
    hideArchitecture: 'הסתר ארכיטקטורה',
    implementationExample: 'דוגמת מימוש',
    readOnly: 'לקריאה בלבד',
    architectureHidden: 'תצוגת ארכיטקטורה מוסתרת',
    showVisualizer: 'הצג ויזואליזציה',
    langToggleLabel: 'EN',
    langToggleTitle: 'Switch to English',
  },
}
