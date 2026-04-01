import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Toast } from '../types'

interface Props {
  toast: Toast | null
  onClear: () => void
}

export function AppToast({ toast, onClear }: Props) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClear, 3000)
    return () => clearTimeout(t)
  }, [toast, onClear])

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.message + toast.type}
          className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-tertiary-container text-on-tertiary-container'
              : 'bg-error-container text-on-error-container'
          }`}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
