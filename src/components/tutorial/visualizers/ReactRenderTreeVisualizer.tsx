import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Component, Zap, Shield, Info, RotateCcw } from 'lucide-react';

type Node = {
  id: string;
  label: string;
  parent: string | null;
  // Which node, when its state updates, would normally cause this node to re-render
  // (i.e. itself or any ancestor — until something stops the propagation)
  rerendersWhenAncestorUpdates: string[];
  // Whether this node can be wrapped in React.memo via the toggle
  memoable?: boolean;
};

const TREE: Node[] = [
  { id: 'app', label: 'App', parent: null, rerendersWhenAncestorUpdates: ['app'] },
  { id: 'header', label: 'Header', parent: 'app', rerendersWhenAncestorUpdates: ['app', 'header'] },
  { id: 'main', label: 'Main', parent: 'app', rerendersWhenAncestorUpdates: ['app', 'main'] },
  { id: 'sidebar', label: 'Sidebar', parent: 'main', rerendersWhenAncestorUpdates: ['app', 'main', 'sidebar'] },
  { id: 'list', label: 'List', parent: 'main', rerendersWhenAncestorUpdates: ['app', 'main', 'list'], memoable: true },
  { id: 'item-1', label: 'Item', parent: 'list', rerendersWhenAncestorUpdates: ['app', 'main', 'list', 'item-1'] },
  { id: 'item-2', label: 'Item', parent: 'list', rerendersWhenAncestorUpdates: ['app', 'main', 'list', 'item-2'] },
  { id: 'item-3', label: 'Item', parent: 'list', rerendersWhenAncestorUpdates: ['app', 'main', 'list', 'item-3'] },
];

// 3-column layout positions for the tree, mapped to a 7-col grid
const POSITIONS: Record<string, { col: number; row: number }> = {
  'app': { col: 4, row: 0 },
  'header': { col: 2, row: 1 },
  'main': { col: 5, row: 1 },
  'sidebar': { col: 3, row: 2 },
  'list': { col: 6, row: 2 },
  'item-1': { col: 5, row: 3 },
  'item-2': { col: 6, row: 3 },
  'item-3': { col: 7, row: 3 },
};

const ReactRenderTreeVisualizer: React.FC = () => {
  const [trigger, setTrigger] = useState<string | null>(null);
  const [memoList, setMemoList] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const flashTimer = useRef<number | null>(null);

  const triggerUpdate = (sourceId: string) => {
    // Compute which nodes would re-render given the trigger source and current memo settings
    const wouldRerender = new Set<string>();
    const wouldSkip = new Set<string>();

    TREE.forEach(node => {
      const inChain = node.rerendersWhenAncestorUpdates.includes(sourceId);
      if (!inChain) return;

      // Check whether memoization on the List prunes this node from re-rendering.
      // List is wrapped in memo: List itself and its descendants (the Items) are skipped
      // when the trigger came from above List (App or Main) and List's props haven't changed.
      const isListSubtree = node.id === 'list' || (node.parent === 'list');
      const triggerIsAboveList = sourceId === 'app' || sourceId === 'main';
      if (memoList && isListSubtree && triggerIsAboveList) {
        wouldSkip.add(node.id);
        return;
      }

      wouldRerender.add(node.id);
    });

    setTrigger(sourceId);
    setFlashIds(wouldRerender);
    setSkippedIds(wouldSkip);

    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      setFlashIds(new Set());
      setSkippedIds(new Set());
    }, 1400);
  };

  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    };
  }, []);

  const reset = () => {
    setTrigger(null);
    setFlashIds(new Set());
    setSkippedIds(new Set());
  };

  const renderCount = flashIds.size;
  const skipCount = skippedIds.size;

  return (
    <div className="glass-card rounded-2xl overflow-hidden relative">
      <div className="p-6 border-b border-outline-variant bg-surface-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Component className="text-primary" size={20} />
            </div>
            <div>
              <h3 className="text-on-surface font-bold text-lg">React Re-Render Propagation</h3>
              <p className="text-secondary text-xs">Trigger a state update and watch which components re-render</p>
            </div>
          </div>
          <button
            onClick={() => setMemoList(m => !m)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
              memoList
                ? 'bg-tertiary/10 text-tertiary border-tertiary/30'
                : 'bg-surface-variant text-secondary border-outline-variant hover:border-outline'
            }`}
            title="Wrap the List component in React.memo"
          >
            <Shield size={14} />
            {memoList ? 'List is memoized' : 'Wrap List in React.memo'}
          </button>
        </div>
      </div>

      <div className="p-8 bg-surface-container relative overflow-hidden min-h-[420px]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-primary/5 rounded-full blur-[100px]" />

        {/* SVG layer for tree connectors */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 800 400"
          preserveAspectRatio="none"
        >
          {TREE.filter(n => n.parent).map(n => {
            const child = POSITIONS[n.id];
            const parent = POSITIONS[n.parent as string];
            // Map grid (col 1-7, row 0-3) to viewBox coords
            const cx = (child.col / 8) * 800;
            const cy = (child.row / 3.5) * 400 + 30;
            const px = (parent.col / 8) * 800;
            const py = (parent.row / 3.5) * 400 + 60;
            const active = flashIds.has(n.id) && flashIds.has(n.parent as string);
            return (
              <line
                key={n.id}
                x1={px}
                y1={py}
                x2={cx}
                y2={cy}
                stroke={active ? 'currentColor' : 'currentColor'}
                strokeWidth={active ? 2 : 1}
                className={active ? 'text-primary' : 'text-outline-variant'}
                opacity={active ? 1 : 0.4}
              />
            );
          })}
        </svg>

        <div className="relative z-10 grid grid-cols-7 gap-2" style={{ gridTemplateRows: 'repeat(4, minmax(72px, 1fr))' }}>
          {TREE.map(node => {
            const pos = POSITIONS[node.id];
            const isFlashing = flashIds.has(node.id);
            const isSkipped = skippedIds.has(node.id);
            const isTrigger = trigger === node.id;
            const isMemoed = memoList && node.memoable;

            return (
              <motion.button
                key={node.id}
                onClick={() => triggerUpdate(node.id)}
                style={{ gridColumn: pos.col, gridRow: pos.row + 1 }}
                animate={
                  isFlashing
                    ? { scale: [1, 1.08, 1], boxShadow: ['0 0 0 0 rgba(0,0,0,0)', '0 0 24px 4px var(--color-primary)', '0 0 0 0 rgba(0,0,0,0)'] }
                    : isSkipped
                      ? { scale: [1, 0.96, 1], opacity: [1, 0.5, 1] }
                      : { scale: 1 }
                }
                transition={{ duration: 0.6 }}
                className={`relative flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-xl border-2 text-xs font-bold transition-colors min-h-[64px] ${
                  isFlashing
                    ? 'bg-primary text-on-primary border-primary shadow-lg shadow-primary/40'
                    : isSkipped
                      ? 'bg-surface text-secondary border-outline-variant border-dashed'
                      : isTrigger
                        ? 'bg-tertiary/10 text-tertiary border-tertiary/30'
                        : 'bg-surface-container-high text-on-surface border-outline-variant hover:border-primary/40'
                }`}
              >
                <span>{node.label}</span>
                {isMemoed && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-tertiary text-on-primary flex items-center justify-center" title="memoized">
                    <Shield size={10} />
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="p-4 bg-surface border-t border-outline-variant flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-secondary">
          <Info size={14} className="text-primary" />
          <span>Click any node to trigger a state update there.</span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-primary inline-block" />
            <span className="text-on-surface-variant">Re-rendered: <span className="font-bold text-primary">{renderCount}</span></span>
          </div>
          {memoList && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded border-2 border-dashed border-outline inline-block" />
              <span className="text-on-surface-variant">Skipped by memo: <span className="font-bold text-tertiary">{skipCount}</span></span>
            </div>
          )}
          <button
            onClick={reset}
            className="flex items-center gap-1 px-2 py-1 rounded text-secondary hover:text-on-surface hover:bg-surface-variant transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
      </div>

      <div className="px-6 pb-5 bg-surface text-xs text-secondary leading-relaxed">
        <Zap size={12} className="inline mr-1 text-primary" />
        Toggle <span className="text-tertiary font-semibold">"Wrap List in React.memo"</span> and trigger an update on{' '}
        <span className="text-on-surface font-semibold">App</span> or{' '}
        <span className="text-on-surface font-semibold">Main</span> — the List subtree (and its three Items) is now skipped.
      </div>
    </div>
  );
};

export default ReactRenderTreeVisualizer;
