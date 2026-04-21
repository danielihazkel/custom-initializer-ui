import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface AppHeaderProps {
  view: 'initializr' | 'tutorial' | 'admin' | 'guide'
  setView: React.Dispatch<React.SetStateAction<'initializr' | 'tutorial' | 'admin' | 'guide'>>
  isDark: boolean
  setIsDark: React.Dispatch<React.SetStateAction<boolean>>
  onSearchOpen: () => void
  onExplore: () => void
  onGenerate: () => void
  exploreLoading: boolean
  exploreError: string | null
}

export function AppHeader({
  view,
  setView,
  isDark,
  setIsDark,
  onSearchOpen,
  onExplore,
  onGenerate,
  exploreLoading,
  exploreError
}: AppHeaderProps) {
  const [shareCopied, setShareCopied] = useState(false)
  const [generateSuccess, setGenerateSuccess] = useState(false)

  function handleShare(): void {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    })
  }

  function handleGenerateAction(): void {
    onGenerate()
    setGenerateSuccess(true)
    setTimeout(() => setGenerateSuccess(false), 2000)
  }

  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 glass-header">
      <div className="flex items-center gap-8">
        <span className="text-xl font-bold text-on-surface tracking-tighter">Spring Initializr</span>
        <nav className="hidden md:flex items-center gap-6">
          <button
            onClick={() => setView(v => v === 'tutorial' ? 'initializr' : 'tutorial')}
            className={`text-sm transition-colors duration-200 ${view === 'tutorial' ? 'text-on-surface font-semibold' : 'text-secondary hover:text-on-surface'}`}
          >
            Training
          </button>
          <button
            onClick={() => setView(v => v === 'guide' ? 'initializr' : 'guide')}
            className={`text-sm transition-colors duration-200 ${view === 'guide' ? 'text-on-surface font-semibold' : 'text-secondary hover:text-on-surface'}`}
          >
            Guide
          </button>
          <button
            onClick={() => setView(v => v === 'admin' ? 'initializr' : 'admin')}
            className={`text-sm transition-colors duration-200 ${view === 'admin' ? 'text-on-surface font-semibold' : 'text-secondary hover:text-on-surface'}`}
          >
            Config
          </button>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {/* Search button */}
        <button
          onClick={onSearchOpen}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-high transition-colors duration-200 text-secondary hover:text-on-surface group shadow-sm"
          aria-label="Search dependencies"
          title="Search dependencies (Cmd/Ctrl + K)"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
          <span className="hidden sm:inline text-xs font-medium">Search</span>
          <span className="hidden sm:flex border border-outline-variant bg-surface-container rounded px-1.5 py-0.5 text-[10px] font-bold text-secondary group-hover:text-on-surface">⌘K</span>
        </button>

        {/* Share button */}
        <button
          onClick={handleShare}
          className="p-2 rounded text-secondary hover:text-on-surface transition-colors duration-200"
          aria-label="Copy share link"
          title="Copy link to current configuration"
        >
          <AnimatePresence mode="wait">
            {shareCopied ? (
              <motion.span
                key="check"
                className="material-symbols-outlined"
                style={{ fontSize: '20px', display: 'block' }}
                initial={{ opacity: 0, scale: 0.3, rotate: 90 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.3 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              >
                check
              </motion.span>
            ) : (
              <motion.span
                key="share"
                className="material-symbols-outlined"
                style={{ fontSize: '20px', display: 'block' }}
                initial={{ opacity: 0, scale: 0.3, rotate: -90 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.3, rotate: 90 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              >
                share
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        {/* Theme toggle */}
        <button
          onClick={() => setIsDark(d => !d)}
          className="p-2 rounded text-secondary hover:text-on-surface transition-colors duration-200"
          aria-label="Toggle theme"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
            {isDark ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
        <button
          onClick={onExplore}
          disabled={exploreLoading}
          title={exploreError ?? 'Preview project files before downloading'}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-60 ${exploreError ? 'text-error' : 'text-secondary hover:text-on-surface'}`}
        >
          {exploreLoading
            ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>
            : 'Explore'}
        </button>
        <button
          onClick={handleGenerateAction}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn ${generateSuccess ? 'generate-success' : ''}`}
          style={{ minWidth: '110px' }}
        >
          <AnimatePresence mode="wait">
            {generateSuccess ? (
              <motion.span
                key="success"
                className="flex items-center justify-center gap-1.5"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                Done!
              </motion.span>
            ) : (
              <motion.span
                key="generate"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                Generate
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </header>
  )
}
