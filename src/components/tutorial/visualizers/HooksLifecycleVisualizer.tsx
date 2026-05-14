import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Zap, ChevronRight, ChevronLeft, Info } from 'lucide-react';

type Phase = {
  id: string;
  label: string;
  badge: 'Mount' | 'Update' | 'Unmount';
  description: string;
  fires: string[];
};

const PHASES: Phase[] = [
  {
    id: 'render-mount',
    label: 'Initial render',
    badge: 'Mount',
    description: 'React calls your component for the first time. State initializers run; the JSX tree is built but not yet on screen.',
    fires: ['useState initializer', 'useReducer initializer', 'useMemo (initial)'],
  },
  {
    id: 'commit-mount',
    label: 'Commit to DOM',
    badge: 'Mount',
    description: 'React applies the JSX to the DOM. The user can now see the component. Refs are assigned.',
    fires: ['ref assignment'],
  },
  {
    id: 'effect-mount',
    label: 'Effects run',
    badge: 'Mount',
    description: 'After paint, React runs every useEffect setup function. useLayoutEffect runs synchronously before paint.',
    fires: ['useLayoutEffect setup', 'useEffect setup'],
  },
  {
    id: 'render-update',
    label: 'Re-render on state change',
    badge: 'Update',
    description: 'A setter is called with a new value. React re-runs the component function and diffs against the previous tree.',
    fires: ['component function re-runs', 'useMemo (deps check)'],
  },
  {
    id: 'cleanup-update',
    label: 'Effect cleanup',
    badge: 'Update',
    description: 'For every effect whose dependencies changed, React runs its cleanup function before the new setup.',
    fires: ['useEffect cleanup (changed deps)', 'useLayoutEffect cleanup (changed deps)'],
  },
  {
    id: 'effect-update',
    label: 'New effects run',
    badge: 'Update',
    description: 'After the DOM is committed, React runs the setup for every effect whose dependencies changed.',
    fires: ['useLayoutEffect setup (changed deps)', 'useEffect setup (changed deps)'],
  },
  {
    id: 'cleanup-unmount',
    label: 'Final cleanup',
    badge: 'Unmount',
    description: 'The component is being removed from the tree. All active effect cleanups run, then the DOM nodes are detached.',
    fires: ['every active useEffect cleanup', 'every active useLayoutEffect cleanup'],
  },
];

const badgeColor = (badge: Phase['badge']) => {
  switch (badge) {
    case 'Mount': return 'bg-primary/10 text-primary border-primary/20';
    case 'Update': return 'bg-tertiary/10 text-tertiary border-tertiary/20';
    case 'Unmount': return 'bg-error/10 text-error border-error/20';
  }
};

const HooksLifecycleVisualizer: React.FC = () => {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = window.setTimeout(() => {
      setStep(s => (s + 1) % PHASES.length);
    }, 1800);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [playing, step]);

  const phase = PHASES[step];

  return (
    <div className="glass-card rounded-2xl overflow-hidden relative">
      <div className="p-6 border-b border-outline-variant bg-surface-variant/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Zap className="text-primary" size={20} />
            </div>
            <div>
              <h3 className="text-on-surface font-bold text-lg">Hooks Lifecycle Timeline</h3>
              <p className="text-secondary text-xs">When each hook callback fires across mount, update, and unmount</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-surface-variant/50 px-3 py-1.5 rounded-full border border-outline-variant">
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
              Phase {step + 1} of {PHASES.length}
            </span>
          </div>
        </div>

        <div className="relative flex justify-between items-center px-2 mt-8">
          <div className="absolute left-0 right-0 h-0.5 bg-outline-variant top-1/2 -translate-y-1/2 z-0 mx-4" />
          <motion.div
            className="absolute left-0 h-0.5 bg-primary top-1/2 -translate-y-1/2 z-0 mx-4 origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: step / (PHASES.length - 1) }}
            transition={{ type: 'spring', stiffness: 50, damping: 20 }}
          />
          {PHASES.map((p, i) => (
            <button
              key={p.id}
              onClick={() => { setPlaying(false); setStep(i); }}
              className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                i <= step
                  ? 'bg-primary text-on-primary shadow-lg shadow-primary/40'
                  : 'bg-surface-variant text-secondary hover:bg-surface-variant/80'
              }`}
              title={p.label}
            >
              <span className="text-[10px] font-bold">{i + 1}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-8 min-h-[280px] bg-surface-container relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/5 rounded-full blur-[100px]" />

        <AnimatePresence mode="wait">
          <motion.div
            key={phase.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="relative z-10"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${badgeColor(phase.badge)}`}>
                {phase.badge}
              </span>
              <h4 className="text-2xl font-bold text-on-surface">{phase.label}</h4>
            </div>
            <p className="text-on-surface-variant text-base leading-relaxed mb-5 max-w-3xl">
              {phase.description}
            </p>
            <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl">
              <div className="flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-widest mb-3">
                <Info size={12} />
                Hook callbacks that fire here
              </div>
              <ul className="space-y-2">
                {phase.fires.map(f => (
                  <li key={f} className="flex items-center gap-2 text-on-surface-variant text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                    <code className="font-mono text-primary">{f}</code>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="p-4 bg-surface border-t border-outline-variant flex items-center justify-between">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            step === 0
              ? 'text-outline opacity-50 cursor-not-allowed'
              : 'text-secondary hover:text-on-surface hover:bg-surface-variant'
          }`}
        >
          <ChevronLeft size={16} />
          Previous
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlaying(p => !p)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={() => { setPlaying(false); setStep(0); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-secondary hover:text-on-surface hover:bg-surface-variant transition-all"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>

        <button
          onClick={() => setStep(s => Math.min(PHASES.length - 1, s + 1))}
          disabled={step === PHASES.length - 1}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            step === PHASES.length - 1
              ? 'text-outline opacity-50 cursor-not-allowed'
              : 'bg-primary text-on-primary hover:bg-primary-container shadow-lg shadow-primary/20'
          }`}
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default HooksLifecycleVisualizer;
