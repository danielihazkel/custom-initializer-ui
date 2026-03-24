import type { ReactNode } from 'react'

export interface ColumnDef<T> {
  label: string
  render: (row: T) => ReactNode
  width?: string
}

interface AdminTableProps<T extends { id: number }> {
  columns: ColumnDef<T>[]
  rows: T[]
  onEdit: (row: T) => void
  onDelete: (row: T) => void
  loading: boolean
}

export function AdminTable<T extends { id: number }>({
  columns, rows, onEdit, onDelete, loading
}: AdminTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-container-high">
            {columns.map((col, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-secondary"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
            <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-secondary w-20">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-secondary">
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: '20px' }}>
                  progress_activity
                </span>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-secondary text-sm">
                No items yet
              </td>
            </tr>
          ) : (
            rows.map(row => (
              <tr key={row.id} className="border-t border-outline-variant hover:bg-surface-container-high transition-colors">
                {columns.map((col, i) => (
                  <td key={i} className="px-4 py-3 text-on-surface">
                    {col.render(row)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(row)}
                      className="p-1 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                    </button>
                    <button
                      onClick={() => onDelete(row)}
                      className="p-1 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
