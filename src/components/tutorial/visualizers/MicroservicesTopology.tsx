
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud, Server, Database, Globe,
  Shield, Zap, Settings,
  Activity, Share2
} from 'lucide-react';
import { TOPOLOGY_DATA } from '../tutorial-constants';

const MicroservicesTopology: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<'idle' | 'request' | 'failure'>('idle');

  const { nodes, links } = TOPOLOGY_DATA;

  // Fixed positions for a clean diagram
  const nodePositions: Record<string, { x: number, y: number }> = {
    'client': { x: 50, y: 200 },
    'gateway': { x: 200, y: 200 },
    'eureka': { x: 200, y: 50 },
    'config': { x: 350, y: 50 },
    'auth-service': { x: 350, y: 120 },
    'order-service': { x: 450, y: 200 },
    'inventory-service': { x: 650, y: 150 },
    'payment-service': { x: 650, y: 250 },
    'broker': { x: 550, y: 350 },
    'database': { x: 800, y: 200 }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'client': return <Globe size={18} />;
      case 'infrastructure': return <Settings size={18} />;
      case 'service': return <Server size={18} />;
      case 'database': return <Database size={18} />;
      default: return <Cloud size={18} />;
    }
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'client': return 'text-primary bg-primary/10 border-primary/20';
      case 'infrastructure': return 'text-secondary bg-secondary/10 border-secondary/20';
      case 'service': return 'text-tertiary bg-tertiary/10 border-tertiary/20';
      case 'database': return 'text-on-surface-variant bg-surface-container-high border-outline-variant';
      default: return 'text-secondary bg-surface-variant border-outline-variant';
    }
  };

  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col relative">
      <div className="p-6 border-b border-outline-variant bg-surface-variant/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Share2 className="text-primary" size={20} />
            </div>
            <div>
              <h3 className="text-on-surface font-bold text-lg">Microservices Topology</h3>
              <p className="text-secondary text-xs">Interactive system architecture and service dependencies</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-surface-variant/50 p-1 rounded-xl border border-outline-variant">
            {(['idle', 'request', 'failure'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setActiveScenario(s)}
                className={`
                  px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                  ${activeScenario === s
                    ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                    : 'text-secondary hover:text-on-surface hover:bg-surface-variant'
                  }
                `}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative h-[500px] bg-surface-container overflow-hidden group">
        {/* SVG for Links */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" className="text-outline">
              <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
            </marker>
            <marker id="arrowhead-active" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" className="text-primary">
              <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
            </marker>
          </defs>

          {links.map((link, i) => {
            if (link.special) return null;
            const start = nodePositions[link.source];
            const end = nodePositions[link.target];
            if (!start || !end) return null;

            const isActive = activeScenario === 'request' &&
              (link.source === 'client' || link.source === 'gateway' || link.source === 'order-service');

            return (
              <g key={i}>
                <line
                  x1={start.x + 40} y1={start.y + 20}
                  x2={end.x} y2={end.y + 20}
                  className={`transition-colors duration-500 ${isActive ? 'stroke-primary' : 'stroke-outline-variant'}`}
                  strokeWidth={isActive ? 2 : 1}
                  markerEnd={isActive ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                />
                {isActive && (
                  <motion.circle
                    r="3"
                    className="fill-primary"
                    animate={{
                      cx: [start.x + 40, end.x],
                      cy: [start.y + 20, end.y + 20]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "linear",
                      delay: i * 0.2
                    }}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = nodePositions[node.id];
          if (!pos) return null;

          const isSelected = selectedNode === node.id;
          const isHovered = hoveredNode === node.id;
          const isFailed = activeScenario === 'failure' && node.id === 'inventory-service';

          return (
            <motion.div
              key={node.id}
              initial={false}
              animate={{
                x: pos.x,
                y: pos.y,
                scale: isSelected ? 1.1 : isHovered ? 1.05 : 1
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => setSelectedNode(node.id)}
              className={`
                absolute w-40 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${getNodeColor(node.type)}
                ${isSelected ? 'shadow-[0_0_20px_var(--color-primary)] border-primary z-20' : 'z-10'}
                ${isFailed ? 'border-error/50 bg-error/10 animate-pulse' : ''}
              `}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="p-1.5 rounded-lg bg-surface-container/50 border border-outline-variant">
                  {isFailed ? <Zap size={14} className="text-error" /> : getNodeIcon(node.type)}
                </div>
                {isSelected && <Activity size={12} className="text-primary animate-pulse" />}
              </div>
              <h4 className="text-[10px] font-bold text-on-surface uppercase tracking-wider truncate">{node.label}</h4>
              <div className="text-[8px] opacity-80 font-mono mt-1">
                {isFailed ? 'STATUS: DOWN' : 'STATUS: UP'}
              </div>
            </motion.div>
          );
        })}

        {/* Legend / Info Overlay */}
        <AnimatePresence>
          {selectedNodeData && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-6 right-6 w-72 glass-panel border-outline-variant rounded-2xl p-6 shadow-2xl z-30"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-xl bg-surface-container border border-outline-variant`}>
                  {getNodeIcon(selectedNodeData.type)}
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-secondary hover:text-on-surface">
                  <Globe size={16} />
                </button>
              </div>
              <h4 className="text-on-surface font-bold mb-1">{selectedNodeData.label}</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
                {selectedNodeData.description}
              </p>

              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-secondary font-bold uppercase tracking-wider">Type</span>
                  <span className="text-[10px] text-on-surface-variant font-mono">{selectedNodeData.type.toUpperCase()}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-secondary font-bold uppercase tracking-wider">Dependencies</span>
                  <div className="flex flex-wrap gap-1">
                    {links.filter(l => l.source === selectedNodeData.id).map(l => (
                      <span key={l.target} className="px-1.5 py-0.5 rounded bg-surface-variant border border-outline-variant text-[8px] text-secondary">
                        {l.target}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Help Text */}
        <div className="absolute bottom-4 left-6 flex items-center gap-4 text-[10px] text-secondary font-medium">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary" /> Client
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-secondary" /> Infrastructure
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-tertiary" /> Service
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-on-surface-variant" /> Database
          </div>
        </div>
      </div>

      <div className="p-4 bg-surface border-t border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-secondary">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-primary" />
            <span>Encrypted Traffic</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-tertiary" />
            <span>Auto-Scaling Enabled</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-bold text-secondary uppercase tracking-widest">
          <Activity size={12} className="text-primary" />
          System Health: 99.9%
        </div>
      </div>
    </div>
  );
};

export default MicroservicesTopology;
