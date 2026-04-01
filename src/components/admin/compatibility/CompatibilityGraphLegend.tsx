export function CompatibilityGraphLegend() {
  return (
    <div className="absolute bottom-4 left-4 bg-surface/90 backdrop-blur-sm border border-outline-variant rounded-lg px-3 py-2.5 text-[11px] space-y-1.5 shadow-md">
      <div className="text-secondary font-bold uppercase tracking-widest text-[9px] mb-2">Legend</div>

      <div className="flex items-center gap-2">
        <svg width="36" height="10" className="shrink-0">
          <line x1="0" y1="5" x2="28" y2="5" stroke="var(--color-warning, #f59e0b)" strokeWidth="2" />
          <polygon points="28,2 36,5 28,8" fill="var(--color-warning, #f59e0b)" />
        </svg>
        <span className="text-warning font-medium">REQUIRES</span>
      </div>

      <div className="flex items-center gap-2">
        <svg width="36" height="10" className="shrink-0">
          <line x1="0" y1="5" x2="36" y2="5" stroke="var(--color-error, #ef4444)" strokeWidth="2" strokeDasharray="4,3" />
        </svg>
        <span className="text-error font-medium">CONFLICTS</span>
      </div>

      <div className="flex items-center gap-2">
        <svg width="36" height="10" className="shrink-0">
          <line x1="0" y1="5" x2="28" y2="5" stroke="var(--color-primary, #6366f1)" strokeWidth="2" strokeDasharray="2,3" />
          <polygon points="28,2 36,5 28,8" fill="var(--color-primary, #6366f1)" />
        </svg>
        <span className="text-primary font-medium">RECOMMENDS</span>
      </div>

      <div className="border-t border-outline-variant pt-1.5 mt-1 text-on-surface-variant text-[9px]">
        Drag nodes · Scroll to zoom · Click to inspect
      </div>
    </div>
  )
}
