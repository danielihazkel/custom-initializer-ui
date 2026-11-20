// The database drivers whose "primary / secondary" sub-option the dependency picker manages by
// itself: one driver of a kind is its primary, and with several the user picks which.

export const DB_DRIVERS = ['postgresql', 'mssql', 'db2', 'oracle', 'mongodb', 'h2'] as const

export const DB_PRIMARY_OPTIONS: Record<string, string> = {
  postgresql: 'pg-primary',
  mssql: 'mssql-primary',
  db2: 'db2-primary',
  oracle: 'oracle-primary',
  mongodb: 'mongodb-primary',
  h2: 'h2-primary'
}

export const DB_SECONDARY_OPTIONS: Record<string, string> = {
  postgresql: 'pg-secondary',
  mssql: 'mssql-secondary',
  db2: 'db2-secondary',
  oracle: 'oracle-secondary',
  mongodb: 'mongodb-secondary',
  h2: 'h2-secondary'
}

export const DB_SUB_OPTION_IDS = new Set([
  ...Object.values(DB_PRIMARY_OPTIONS),
  ...Object.values(DB_SECONDARY_OPTIONS),
])

export const DB_DRIVER_KINDS: Record<string, 'jdbc' | 'mongodb'> = {
  postgresql: 'jdbc',
  mssql: 'jdbc',
  db2: 'jdbc',
  oracle: 'jdbc',
  h2: 'jdbc',
  mongodb: 'mongodb',
}
