
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Database, Code2,
  Info, ChevronRight, ChevronLeft,
  Key, Link as LinkIcon, Hash,
  Table as TableIcon
} from 'lucide-react';
import { JPA_MAPPING_SCENARIOS } from '../tutorial-constants';

const JpaEntityMapper: React.FC = () => {
  const [activeScenarioIndex, setActiveScenarioIndex] = useState(0);
  const scenario = JPA_MAPPING_SCENARIOS[activeScenarioIndex];

  const highlightJava = (code: string) => {
    return code
      .replace(/(@\w+)/g, '<span class="text-tertiary">$1</span>')
      .replace(/\b(public|private|abstract|class|extends|implements|private|Long|String|BigDecimal|List)\b/g, '<span class="text-primary">$1</span>');
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col relative">
      <div className="p-6 border-b border-outline-variant bg-surface-variant/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center border border-tertiary/20">
              <Database className="text-tertiary" size={20} />
            </div>
            <div>
              <h3 className="text-on-surface font-bold text-lg">JPA Entity-to-Table Mapper</h3>
              <p className="text-secondary text-xs">Visualize Java objects mapping to SQL tables</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-surface-variant/50 p-1 rounded-xl border border-outline-variant">
            {JPA_MAPPING_SCENARIOS.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setActiveScenarioIndex(idx)}
                className={`
                  px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                  ${activeScenarioIndex === idx
                    ? 'bg-tertiary text-on-tertiary shadow-lg shadow-tertiary/20'
                    : 'text-secondary hover:text-on-surface hover:bg-surface-variant'
                  }
                `}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 bg-surface-container">
        {/* Java Entity Side */}
        <div className="p-8 border-b lg:border-b-0 lg:border-r border-outline-variant">
          <div className="flex items-center gap-2 mb-4">
            <Code2 size={16} className="text-primary" />
            <span className="text-xs font-bold text-secondary uppercase tracking-widest">Java Entity</span>
          </div>
          <div className="bg-surface-container-highest rounded-xl border border-outline-variant p-6 font-mono text-sm leading-relaxed overflow-x-auto">
            <pre dangerouslySetInnerHTML={{ __html: highlightJava(scenario.javaCode) }} />
          </div>
        </div>

        {/* Database Table Side */}
        <div className="p-8 bg-surface-container/50">
          <div className="flex items-center gap-2 mb-4">
            <TableIcon size={16} className="text-tertiary" />
            <span className="text-xs font-bold text-secondary uppercase tracking-widest">Database Table: <span className="text-on-surface">{scenario.tableName}</span></span>
          </div>

          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-variant shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-lowest border-b border-outline">
                  <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Column</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Type</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest">Constraints</th>
                </tr>
              </thead>
              <tbody>
                {scenario.columns.map((col, idx) => (
                  <motion.tr
                    key={col.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="border-b border-outline-variant hover:bg-surface-variant/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {col.constraints.includes('PK') ? <Key size={12} className="text-yellow-500" /> :
                         col.constraints.includes('FK') ? <LinkIcon size={12} className="text-primary/70" /> :
                         <Hash size={12} className="text-secondary" />}
                        <span className="text-sm font-mono text-on-surface">{col.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-tertiary/80">{col.type}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold text-secondary bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant">
                        {col.constraints || 'NONE'}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 p-4 bg-tertiary/5 border border-tertiary/10 rounded-xl">
            <div className="flex items-center gap-2 text-tertiary text-[10px] font-bold uppercase tracking-widest mb-2">
              <Info size={14} />
              Mapping Logic
            </div>
            <p className="text-secondary text-sm leading-relaxed italic">
              {scenario.explanation}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-surface border-t border-outline-variant flex items-center justify-between">
        <button
          onClick={() => setActiveScenarioIndex(Math.max(0, activeScenarioIndex - 1))}
          disabled={activeScenarioIndex === 0}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all
            ${activeScenarioIndex === 0 ? 'text-outline opacity-50 cursor-not-allowed' : 'text-secondary hover:text-on-surface hover:bg-surface-variant'}
          `}
        >
          <ChevronLeft size={16} />
          Previous
        </button>

        <div className="flex gap-1">
          {JPA_MAPPING_SCENARIOS.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeScenarioIndex ? 'w-4 bg-tertiary' : 'bg-outline-variant'}`}
            />
          ))}
        </div>

        <button
          onClick={() => setActiveScenarioIndex(Math.min(JPA_MAPPING_SCENARIOS.length - 1, activeScenarioIndex + 1))}
          disabled={activeScenarioIndex === JPA_MAPPING_SCENARIOS.length - 1}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all
            ${activeScenarioIndex === JPA_MAPPING_SCENARIOS.length - 1 ? 'text-outline opacity-50 cursor-not-allowed' : 'bg-tertiary text-on-tertiary hover:bg-tertiary-container shadow-lg shadow-tertiary/20'}
          `}
        >
          Next Scenario
          {activeScenarioIndex !== JPA_MAPPING_SCENARIOS.length - 1 && <ChevronRight size={16} />}
        </button>
      </div>
    </div>
  );
};

export default JpaEntityMapper;
