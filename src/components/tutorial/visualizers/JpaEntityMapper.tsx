
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
      .replace(/(@\w+)/g, '<span class="text-blue-400">$1</span>')
      .replace(/\b(public|private|abstract|class|extends|implements|private|Long|String|BigDecimal|List)\b/g, '<span class="text-purple-400">$1</span>');
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl flex flex-col">
      <div className="p-6 border-b border-gray-800 bg-gray-900/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
              <Database className="text-orange-400" size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">JPA Entity-to-Table Mapper</h3>
              <p className="text-gray-500 text-xs">Visualize Java objects mapping to SQL tables</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-950 p-1 rounded-xl border border-gray-800">
            {JPA_MAPPING_SCENARIOS.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setActiveScenarioIndex(idx)}
                className={`
                  px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                  ${activeScenarioIndex === idx
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                  }
                `}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 bg-[#0d1117]">
        {/* Java Entity Side */}
        <div className="p-8 border-b lg:border-b-0 lg:border-r border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Code2 size={16} className="text-purple-400" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Java Entity</span>
          </div>
          <div className="bg-gray-950 rounded-xl border border-gray-800 p-6 font-mono text-sm leading-relaxed overflow-x-auto">
            <pre dangerouslySetInnerHTML={{ __html: highlightJava(scenario.javaCode) }} />
          </div>
        </div>

        {/* Database Table Side */}
        <div className="p-8 bg-gray-900/20">
          <div className="flex items-center gap-2 mb-4">
            <TableIcon size={16} className="text-orange-400" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Database Table: <span className="text-white">{scenario.tableName}</span></span>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950 shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-900/50 border-b border-gray-800">
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Column</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Type</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Constraints</th>
                </tr>
              </thead>
              <tbody>
                {scenario.columns.map((col, idx) => (
                  <motion.tr
                    key={col.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="border-b border-gray-800/50 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {col.constraints.includes('PK') ? <Key size={12} className="text-yellow-500" /> :
                         col.constraints.includes('FK') ? <LinkIcon size={12} className="text-blue-400" /> :
                         <Hash size={12} className="text-gray-600" />}
                        <span className="text-sm font-mono text-white">{col.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-orange-400/80">{col.type}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">
                        {col.constraints || 'NONE'}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 p-4 bg-orange-500/5 border border-orange-500/10 rounded-xl">
            <div className="flex items-center gap-2 text-orange-400 text-[10px] font-bold uppercase tracking-widest mb-2">
              <Info size={14} />
              Mapping Logic
            </div>
            <p className="text-gray-400 text-sm leading-relaxed italic">
              {scenario.explanation}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-gray-950 border-t border-gray-800 flex items-center justify-between">
        <button
          onClick={() => setActiveScenarioIndex(Math.max(0, activeScenarioIndex - 1))}
          disabled={activeScenarioIndex === 0}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all
            ${activeScenarioIndex === 0 ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-800'}
          `}
        >
          <ChevronLeft size={16} />
          Previous
        </button>

        <div className="flex gap-1">
          {JPA_MAPPING_SCENARIOS.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeScenarioIndex ? 'w-4 bg-orange-500' : 'bg-gray-800'}`}
            />
          ))}
        </div>

        <button
          onClick={() => setActiveScenarioIndex(Math.min(JPA_MAPPING_SCENARIOS.length - 1, activeScenarioIndex + 1))}
          disabled={activeScenarioIndex === JPA_MAPPING_SCENARIOS.length - 1}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all
            ${activeScenarioIndex === JPA_MAPPING_SCENARIOS.length - 1 ? 'text-gray-700 cursor-not-allowed' : 'bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-900/20'}
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
