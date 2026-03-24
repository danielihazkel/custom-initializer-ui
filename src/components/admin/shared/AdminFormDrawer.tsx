import type { ReactNode } from 'react'

interface AdminFormDrawerProps {
  title: string
  isOpen: boolean
  onClose: () => void
  onSave: () => Promise<void>
  saving: boolean
  children: ReactNode
}

export function AdminFormDrawer({ title, isOpen, onClose, onSave, saving, children }: AdminFormDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/60 z-30"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-[520px] z-40 bg-surface-container border-l border-outline-variant flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant flex-shrink-0">
          <h3 className="text-sm font-bold uppercase tracking-widest text-secondary">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-secondary hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {children}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-outline-variant flex-shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded text-sm font-medium border border-outline-variant text-secondary hover:text-on-surface transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-5 py-2 rounded text-sm font-bold bg-primary text-on-primary hover:brightness-110 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}
