import { useState, useMemo, type ReactNode } from 'react'
import { Reorder, useDragControls } from 'framer-motion'

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
  searchable?: boolean
  searchPlaceholder?: string
  onReorder?: (newOrder: T[]) => void
  addButton?: ReactNode
}

function DraggableRow<T extends { id: number }>({ row, columns, onEdit, onDelete }: { row: T, columns: ColumnDef<T>[], onEdit: (row: T) => void, onDelete: (row: T) => void }) {
  const controls = useDragControls()
  return (
    <Reorder.Item 
      as="tr" 
      value={row} 
      dragListener={false} 
      dragControls={controls} 
      className="border-t border-outline-variant hover:bg-primary/5 transition-colors duration-150 bg-surface"
    >
      <td className="px-3 py-4 text-secondary text-center w-10">
        <button 
          className="cursor-grab active:cursor-grabbing hover:text-primary transition-colors flex items-center justify-center p-1"
          onPointerDown={(e) => controls.start(e)}
          title="Drag to reorder"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>drag_indicator</span>
        </button>
      </td>
      {columns.map((col, i) => (
        <td key={i} className="px-5 py-4 text-on-surface">
          {col.render(row)}
        </td>
      ))}
      <td className="px-5 py-4 text-right">
        <div className="flex items-center justify-end gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(row)}
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
            title="Edit"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
          </button>
          <button
            onClick={() => onDelete(row)}
            className="p-1.5 rounded-lg text-secondary hover:text-error hover:bg-error/10 transition-colors"
            title="Delete"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
          </button>
        </div>
      </td>
    </Reorder.Item>
  )
}

export function AdminTable<T extends { id: number }>({
  columns, rows, onEdit, onDelete, loading, searchable = true, searchPlaceholder = 'Search...', onReorder, addButton
}: AdminTableProps<T>) {
  const [query, setQuery] = useState('')

  const filteredRows = useMemo(() => {
    if (!searchable || !query.trim()) return rows;
    const lowerQuery = query.toLowerCase()
    return rows.filter(row => {
      // Very naive text-search across all values
      return Object.values(row).some(val => 
        String(val).toLowerCase().includes(lowerQuery)
      )
    })
  }, [rows, query, searchable])

  // Disable dragging when a search is active to prevent weird reordering states
  const isDragEnabled = !!onReorder && !query.trim()

  return (
    <div className="flex flex-col gap-4">
      {(searchable || addButton) && (
        <div className="sticky top-0 z-10 bg-background border-b border-outline-variant py-3 flex items-center justify-between gap-3">
          {searchable && (
            <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-xl border border-outline-variant max-w-sm shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: '20px' }}>search</span>
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full text-on-surface placeholder:text-secondary"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-secondary hover:text-on-surface">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                </button>
              )}
            </div>
          )}
          {addButton && (
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              {addButton}
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface shadow-sm relative">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              {isDragEnabled && (
                <th className="px-3 py-4 w-10"></th>
              )}
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-secondary"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
              <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-widest text-secondary w-24">
                Actions
              </th>
            </tr>
          </thead>
          
          {loading ? (
            <tbody>
              <tr>
                <td colSpan={columns.length + (isDragEnabled ? 2 : 1)} className="px-6 py-12 text-center text-secondary">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: '28px' }}>
                      progress_activity
                    </span>
                    <span className="text-xs font-medium uppercase tracking-widest text-primary/80">Loading Data</span>
                  </div>
                </td>
              </tr>
            </tbody>
          ) : filteredRows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={columns.length + (isDragEnabled ? 2 : 1)} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-secondary">
                    <span className="material-symbols-outlined text-secondary/50" style={{ fontSize: '48px' }}>
                      search_off
                    </span>
                    <p className="text-sm font-medium mt-2 text-on-surface">No results found</p>
                    <p className="text-xs text-secondary max-w-[200px]">Try adjusting your search criteria</p>
                  </div>
                </td>
              </tr>
            </tbody>
          ) : isDragEnabled ? (
            <Reorder.Group as="tbody" values={filteredRows} onReorder={onReorder}>
              {filteredRows.map(row => (
                <DraggableRow key={row.id} row={row} columns={columns} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </Reorder.Group>
          ) : (
            <tbody>
              {filteredRows.map(row => (
                <tr key={row.id} className="border-t border-outline-variant hover:bg-primary/5 transition-colors duration-150 bg-surface">
                  {columns.map((col, i) => (
                    <td key={i} className="px-5 py-4 text-on-surface">
                      {col.render(row)}
                    </td>
                  ))}
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(row)}
                        className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                      </button>
                      <button
                        onClick={() => onDelete(row)}
                        className="p-1.5 rounded-lg text-secondary hover:text-error hover:bg-error/10 transition-colors"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  )
}
