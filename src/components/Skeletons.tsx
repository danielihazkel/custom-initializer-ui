/**
 * Layout-shaped loading placeholders. These mirror the real view structure so the
 * page doesn't jump when content arrives, replacing bare "Loading…" text.
 */

function Bar({ className = '' }: { className?: string }) {
  return <div className={`rounded-md bg-surface-container-high ${className}`} />
}

/** Skeleton for the backend generator (mirrors InitializrView: template row + 5/7 grid). */
export function InitializrSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      {/* Template + preset rows */}
      <div className="max-w-7xl mx-auto px-8 space-y-4">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Bar key={i} className="h-20 w-44 shrink-0" />
          ))}
        </div>
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Bar key={i} className="h-9 w-32" />
          ))}
        </div>
      </div>

      {/* Two-column body */}
      <div className="max-w-7xl mx-auto px-8 grid grid-cols-12 gap-10 mt-8">
        {/* Left: project setup */}
        <section className="col-span-12 lg:col-span-5 space-y-6">
          <Bar className="h-4 w-40" />
          <div className="grid grid-cols-2 gap-4">
            <Bar className="h-14" />
            <Bar className="h-14" />
            <Bar className="h-14 col-span-2" />
            <Bar className="h-14 col-span-2" />
            <Bar className="h-14 col-span-2" />
          </div>
          <Bar className="h-24 rounded-xl" />
        </section>

        {/* Right: dependency list */}
        <section className="col-span-12 lg:col-span-7 space-y-4">
          <Bar className="h-11 rounded-xl" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Bar key={i} className="h-16 rounded-xl" />
          ))}
        </section>
      </div>
    </div>
  )
}

/** Generic centered skeleton for lazily-loaded views (Frontend, Fullstack, Guide, etc.). */
export function ViewSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-8 animate-pulse space-y-6" aria-hidden="true">
      <Bar className="h-8 w-64" />
      <Bar className="h-4 w-96" />
      <div className="grid grid-cols-12 gap-10 mt-4">
        <div className="col-span-12 lg:col-span-5 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bar key={i} className="h-14 rounded-xl" />
          ))}
        </div>
        <div className="col-span-12 lg:col-span-7 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Bar key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
