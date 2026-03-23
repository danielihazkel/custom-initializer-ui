
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Lock, User,
  ShieldCheck, ShieldAlert, ArrowRight,
  Play, CheckCircle2, XCircle,
  Server, Globe
} from 'lucide-react';
import { SECURITY_FILTERS } from '../tutorial-constants';

const SecurityFilterVisualizer: React.FC = () => {
  const [activeFilterIndex, setActiveFilterIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'processing' | 'authenticated' | 'authorized' | 'denied'>('idle');
  const [filterStates, setFilterStates] = useState<Record<string, 'pending' | 'passed' | 'failed'>>({});
  const [scenario, setScenario] = useState<'valid' | 'invalid-token' | 'unauthorized'>('valid');

  const filters = SECURITY_FILTERS;

  const reset = () => {
    setActiveFilterIndex(-1);
    setIsProcessing(false);
    setRequestStatus('idle');
    const initialStates: Record<string, 'pending' | 'passed' | 'failed'> = {};
    filters.forEach(f => initialStates[f.id] = 'pending');
    setFilterStates(initialStates);
  };

  useEffect(() => {
    reset();
  }, [scenario]); // eslint-disable-line react-hooks/exhaustive-deps

  const startSimulation = async () => {
    reset();
    setIsProcessing(true);
    setRequestStatus('processing');

    for (let i = 0; i < filters.length; i++) {
      setActiveFilterIndex(i);
      const filter = filters[i];

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 800));

      let result: 'passed' | 'failed' = 'passed';

      // Scenario logic
      if (scenario === 'invalid-token' && filter.id === 'jwt') {
        result = 'failed';
      } else if (scenario === 'unauthorized' && filter.id === 'authorization') {
        result = 'failed';
      }

      setFilterStates(prev => ({ ...prev, [filter.id]: result }));

      if (result === 'failed') {
        setRequestStatus('denied');
        setIsProcessing(false);
        return;
      }

      if (filter.id === 'jwt' || filter.id === 'username-password') {
        setRequestStatus('authenticated');
      }
    }

    setRequestStatus('authorized');
    setIsProcessing(false);
  };

  const getFilterIcon = (filter: typeof filters[0], state: string) => {
    if (state === 'passed') return <CheckCircle2 className="text-green-400" size={18} />;
    if (state === 'failed') return <XCircle className="text-red-400" size={18} />;

    switch (filter.role) {
      case 'Authentication': return <User size={18} className="text-blue-400" />;
      case 'Authorization': return <Lock size={18} className="text-purple-400" />;
      case 'Protection': return <Shield size={18} className="text-orange-400" />;
      default: return <ShieldCheck size={18} className="text-gray-400" />;
    }
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl flex flex-col">
      <div className="p-6 border-b border-gray-800 bg-gray-900/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Shield className="text-blue-400" size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Security Filter Chain</h3>
              <p className="text-gray-500 text-xs">Visualize request interception and validation</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-950 p-1 rounded-xl border border-gray-800">
            {(['valid', 'invalid-token', 'unauthorized'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                disabled={isProcessing}
                className={`
                  px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                  ${scenario === s
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                  }
                `}
              >
                {s.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 bg-gray-950 p-4 rounded-xl border border-gray-800">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700">
            <Globe size={14} className="text-blue-400" />
            <span className="text-xs font-mono text-gray-300">GET /api/admin/users</span>
          </div>
          <div className="flex-1 h-px bg-gray-800 relative">
            {isProcessing && (
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                animate={{ left: ['0%', '100%'] }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            )}
          </div>
          <button
            onClick={startSimulation}
            disabled={isProcessing}
            className={`
              flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all
              ${isProcessing
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20'
              }
            `}
          >
            {isProcessing ? 'Simulating...' : 'Run Simulation'}
            {!isProcessing && <Play size={14} />}
          </button>
        </div>
      </div>

      <div className="p-8 bg-[#0d1117] flex flex-col items-center gap-8 min-h-[400px]">
        <div className="flex flex-wrap justify-center gap-4 max-w-4xl">
          {filters.map((filter, index) => (
            <div key={filter.id} className="flex items-center gap-4">
              <motion.div
                animate={{
                  scale: activeFilterIndex === index ? 1.05 : 1,
                  borderColor: activeFilterIndex === index ? '#3b82f6' :
                              filterStates[filter.id] === 'passed' ? '#22c55e' :
                              filterStates[filter.id] === 'failed' ? '#ef4444' : '#1f2937'
                }}
                className={`
                  w-40 p-4 rounded-xl border-2 bg-gray-900/50 backdrop-blur-sm relative transition-colors
                  ${activeFilterIndex === index ? 'shadow-[0_0_20px_rgba(59,130,246,0.2)]' : ''}
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 rounded-lg bg-gray-800 border border-gray-700">
                    {getFilterIcon(filter, filterStates[filter.id])}
                  </div>
                  <div className="text-[8px] font-black uppercase tracking-widest text-gray-500">
                    {filter.role}
                  </div>
                </div>
                <h4 className="text-[10px] font-bold text-white truncate">{filter.name}</h4>

                {activeFilterIndex === index && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-gray-900 animate-pulse"
                  />
                )}
              </motion.div>

              {index < filters.length - 1 && (
                <ArrowRight size={16} className="text-gray-800 shrink-0" />
              )}
            </div>
          ))}

          <ArrowRight size={16} className="text-gray-800 shrink-0" />

          <motion.div
            animate={{
              opacity: requestStatus === 'authorized' ? 1 : 0.3,
              scale: requestStatus === 'authorized' ? 1.1 : 1,
              borderColor: requestStatus === 'authorized' ? '#22c55e' : '#1f2937'
            }}
            className="w-40 p-4 rounded-xl border-2 bg-gray-900/50 flex flex-col items-center justify-center gap-2"
          >
            <Server size={24} className={requestStatus === 'authorized' ? 'text-green-400' : 'text-gray-600'} />
            <span className="text-[10px] font-bold text-white uppercase tracking-widest">Controller</span>
          </motion.div>
        </div>

        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {activeFilterIndex !== -1 ? (
              <motion.div
                key={filters[activeFilterIndex].id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-gray-900/80 border border-gray-800 p-6 rounded-2xl"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                    Active Filter
                  </div>
                  <h4 className="text-white font-bold">{filters[activeFilterIndex].name}</h4>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {filters[activeFilterIndex].description}
                </p>

                <div className="mt-4 flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Status</span>
                    <span className={`text-xs font-mono font-bold uppercase ${
                      filterStates[filters[activeFilterIndex].id] === 'passed' ? 'text-green-400' :
                      filterStates[filters[activeFilterIndex].id] === 'failed' ? 'text-red-400' : 'text-blue-400'
                    }`}>
                      {filterStates[filters[activeFilterIndex].id]}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Context</span>
                    <span className="text-xs font-mono text-gray-400">
                      {requestStatus === 'authenticated' ? 'SecurityContext: AUTHENTICATED' : 'SecurityContext: ANONYMOUS'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="text-center p-8">
                <p className="text-gray-600 text-sm italic">Select a scenario and run simulation to see the filter chain in action</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="p-4 bg-gray-950 border-t border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${requestStatus === 'authenticated' || requestStatus === 'authorized' ? 'bg-green-500' : 'bg-gray-800'}`} />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Authenticated</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${requestStatus === 'authorized' ? 'bg-green-500' : 'bg-gray-800'}`} />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Authorized</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {requestStatus === 'authorized' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-400 uppercase tracking-widest"
            >
              <ShieldCheck size={12} />
              Access Granted
            </motion.div>
          )}
          {requestStatus === 'denied' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 uppercase tracking-widest"
            >
              <ShieldAlert size={12} />
              Access Denied (403)
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityFilterVisualizer;
