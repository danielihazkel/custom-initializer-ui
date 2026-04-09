export type Lang = 'en' | 'he'

export interface UiStrings {
  sidebarTitle: string
  searchPlaceholder: string
  noTopicsFound: string
  clearSearch: string
  fieldTableHeaders: { field: string; type: string; req: string; description: string; example: string }
  fieldTableLegend: { required: string; optional: string }
  calloutTitles: { info: string; warning: string; tip: string }
  langToggleLabel: string
}

export const UI_STRINGS: Record<Lang, UiStrings> = {
  en: {
    sidebarTitle: 'Admin Guide',
    searchPlaceholder: 'Search guide...',
    noTopicsFound: 'No topics found',
    clearSearch: 'Clear search',
    fieldTableHeaders: { field: 'Field', type: 'Type', req: 'Req', description: 'Description', example: 'Example' },
    fieldTableLegend: { required: 'Required', optional: 'Optional' },
    calloutTitles: { info: 'Note', warning: 'Warning', tip: 'Tip' },
    langToggleLabel: 'עב',
  },
  he: {
    sidebarTitle: 'מדריך מנהל',
    searchPlaceholder: 'חיפוש במדריך...',
    noTopicsFound: 'לא נמצאו נושאים',
    clearSearch: 'נקה חיפוש',
    fieldTableHeaders: { field: 'שדה', type: 'סוג', req: 'חובה', description: 'תיאור', example: 'דוגמה' },
    fieldTableLegend: { required: 'חובה', optional: 'רשות' },
    calloutTitles: { info: 'הערה', warning: 'אזהרה', tip: 'טיפ' },
    langToggleLabel: 'EN',
  }
}
