
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
    if (state === 'passed') return <CheckCircle2 className="text-primary" size={18} />;
    if (state === 'failed') return <XCircle className="text-error" size={18} />;

    switch (filter.role) {
      case 'Authentication': return <User size={18} className="text-primary" />;
      case 'Authorization': return <Lock size={18} className="text-tertiary" />;
      case 'Protection': return <Shield size={18} className="text-secondary" />;
      default: return <ShieldCheck size={18} className="text-outline" />;
    }
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col relative">
      <div className="p-6 border-b border-outline-variant bg-surface-variant/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Shield className="text-primary" size={20} />
            </div>
            <div>
              <h3 className="text-on-surface font-bold text-lg">Security Filter Chain</h3>
              <p className="text-secondary text-xs">Visualize request interception and validation</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-surface-container-high p-1 rounded-xl border border-outline-variant">
            {(['valid', 'invalid-token', 'unauthorized'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                disabled={isProcessing}
                className={`
                  px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                  ${scenario === s
                    ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                    : 'text-secondary hover:text-on-surface hover:bg-surface-variant'
                  }
                `}
              >
                {s.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 bg-surface-container/50 p-4 rounded-xl border border-outline-variant">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-variant border border-outline-variant">
            <Globe size={14} className="text-primary" />
            <span className="text-xs font-mono text-on-surface-variant">GET /api/admin/users</span>
          </div>
          <div className="flex-1 h-px bg-outline-variant relative">
            {isProcessing && (
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full shadow-[0_0_10px_var(--color-primary)]"
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
                ? 'bg-surface-variant text-secondary cursor-not-allowed'
                : 'bg-primary text-on-primary hover:bg-primary-container shadow-lg shadow-primary/20'
              }
            `}
          >
            {isProcessing ? 'Simulating...' : 'Run Simulation'}
            {!isProcessing && <Play size={14} />}
          </button>
        </div>
      </div>

      <div className="p-8 bg-surface-container flex flex-col items-center gap-8 min-h-[400px]">
        <div className="flex flex-wrap justify-center gap-4 max-w-4xl">
          {filters.map((filter, index) => (
            <div key={filter.id} className="flex items-center gap-4">
              <motion.div
                animate={{
                  scale: activeFilterIndex === index ? 1.05 : 1
                }}
                className={`
                  w-40 p-4 rounded-xl border-2 bg-surface backdrop-blur-sm relative transition-colors duration-300
                  ${activeFilterIndex === index ? 'border-primary shadow-lg shadow-primary/20' :
                    filterStates[filter.id] === 'passed' ? 'border-primary' :
                    filterStates[filter.id] === 'failed' ? 'border-error' : 'border-outline-variant'
                  }
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 rounded-lg bg-surface-variant border border-outline-variant">
                    {getFilterIcon(filter, filterStates[filter.id])}
                  </div>
                  <div className="text-[8px] font-black uppercase tracking-widest text-secondary">
                    {filter.role}
                  </div>
                </div>
                <h4 className="text-[10px] font-bold text-on-surface truncate">{filter.name}</h4>

                {activeFilterIndex === index && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-surface animate-pulse"
                  />
                )}
              </motion.div>

              {index < filters.length - 1 && (
                <ArrowRight size={16} className="text-outline-variant shrink-0" />
              )}
            </div>
          ))}

          <ArrowRight size={16} className="text-outline-variant shrink-0" />

          <motion.div
            animate={{
              opacity: requestStatus === 'authorized' ? 1 : 0.3,
              scale: requestStatus === 'authorized' ? 1.1 : 1
            }}
            className={`w-40 p-4 rounded-xl border-2 bg-surface flex flex-col items-center justify-center gap-2 transition-colors duration-300 ${requestStatus === 'authorized' ? 'border-primary' : 'border-outline-variant'}`}
          >
            <Server size={24} className={requestStatus === 'authorized' ? 'text-primary' : 'text-secondary'} />
            <span className="text-[10px] font-bold text-on-surface uppercase tracking-widest">Controller</span>
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
                className="bg-surface-variant/50 border border-outline-variant p-6 rounded-2xl"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="px-2 py-1 rounded bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-widest">
                    Active Filter
                  </div>
                  <h4 className="text-on-surface font-bold">{filters[activeFilterIndex].name}</h4>
                </div>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  {filters[activeFilterIndex].description}
                </p>

                <div className="mt-4 flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-secondary font-bold uppercase tracking-wider">Status</span>
                    <span className={`text-xs font-mono font-bold uppercase ${
                      filterStates[filters[activeFilterIndex].id] === 'passed' ? 'text-primary' :
                      filterStates[filters[activeFilterIndex].id] === 'failed' ? 'text-error' : 'text-primary/70'
                    }`}>
                      {filterStates[filters[activeFilterIndex].id]}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-secondary font-bold uppercase tracking-wider">Context</span>
                    <span className="text-xs font-mono text-on-surface-variant">
                      {requestStatus === 'authenticated' ? 'SecurityContext: AUTHENTICATED' : 'SecurityContext: ANONYMOUS'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="text-center p-8">
                <p className="text-secondary text-sm italic">Select a scenario and run simulation to see the filter chain in action</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="p-4 bg-surface border-t border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${requestStatus === 'authenticated' || requestStatus === 'authorized' ? 'bg-primary' : 'bg-outline-variant'}`} />
            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Authenticated</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${requestStatus === 'authorized' ? 'bg-primary' : 'bg-outline-variant'}`} />
            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Authorized</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {requestStatus === 'authorized' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-widest"
            >
              <ShieldCheck size={12} />
              Access Granted
            </motion.div>
          )}
          {requestStatus === 'denied' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-error/10 border border-error/20 text-[10px] font-bold text-error uppercase tracking-widest"
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
