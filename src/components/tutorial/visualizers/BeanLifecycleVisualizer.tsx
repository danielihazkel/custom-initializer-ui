
import React, { useState, cloneElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box, Settings, UserCheck, Zap,
  Play, CheckCircle2, Trash2, Info,
  ChevronRight, ChevronLeft
} from 'lucide-react';
import { BEAN_LIFECYCLE_STEPS } from '../tutorial-constants';

const BeanLifecycleVisualizer: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = BEAN_LIFECYCLE_STEPS;
  const activeStep = steps[currentStep];

  const getIcon = (id: string) => {
    switch (id) {
      case 'instantiation': return <Box size={20} />;
      case 'populate': return <Settings size={20} />;
      case 'aware': return <UserCheck size={20} />;
      case 'pre-init': return <Zap size={20} />;
      case 'init': return <Play size={20} />;
      case 'post-init': return <Zap size={20} />;
      case 'ready': return <CheckCircle2 size={20} />;
      case 'destroy': return <Trash2 size={20} />;
      default: return <Info size={20} />;
    }
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden relative">
      <div className="p-6 border-b border-outline-variant bg-surface-variant/30">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Box className="text-primary" size={20} />
            </div>
            <div>
              <h3 className="text-on-surface font-bold text-lg">Spring Bean Lifecycle</h3>
              <p className="text-secondary text-xs">Interactive step-by-step visualization</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-surface-variant/50 px-3 py-1.5 rounded-full border border-outline-variant">
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
        </div>

        {/* Timeline Progress */}
        <div className="relative flex justify-between items-center px-2 mb-8">
          <div className="absolute left-0 right-0 h-0.5 bg-outline-variant top-1/2 -translate-y-1/2 z-0 mx-8" />
          <motion.div
            className="absolute left-0 h-0.5 bg-primary top-1/2 -translate-y-1/2 z-0 mx-8 origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: currentStep / (steps.length - 1) }}
            transition={{ type: 'spring', stiffness: 50, damping: 20 }}
          />

          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(index)}
              className={`
                relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                ${index <= currentStep
                  ? 'bg-primary text-on-primary shadow-lg shadow-primary/40'
                  : 'bg-surface-variant text-secondary hover:bg-surface-variant/80'}
              `}
            >
              {index < currentStep ? <CheckCircle2 size={16} /> : <span className="text-xs font-bold">{index + 1}</span>}

              <div className={`
                absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold uppercase tracking-tighter transition-colors
                ${index === currentStep ? 'text-primary' : 'text-secondary'}
              `}>
                {step.label}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="p-8 min-h-[300px] flex items-center justify-center bg-surface-container relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/5 rounded-full blur-[100px]" />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="relative z-10 w-full max-w-2xl"
          >
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="shrink-0">
                <motion.div
                  className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-2xl shadow-primary/30"
                  animate={{
                    scale: [1, 1.05, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <div className="text-on-primary">
                    {cloneElement(getIcon(activeStep.id) as React.ReactElement<{ size?: number }>, { size: 40 })}
                  </div>
                </motion.div>
              </div>

              <div className="flex-1 text-center md:text-left">
                <h4 className="text-2xl font-bold text-on-surface mb-2">{activeStep.label}</h4>
                <p className="text-secondary text-lg leading-relaxed mb-4">
                  {activeStep.description}
                </p>
                <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-widest mb-1">
                    <Info size={12} />
                    Technical Detail
                  </div>
                  <p className="text-on-surface-variant text-sm italic">
                    {activeStep.details}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="p-4 bg-surface border-t border-outline-variant flex items-center justify-between">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all
            ${currentStep === 0 ? 'text-outline opacity-50 cursor-not-allowed' : 'text-secondary hover:text-on-surface hover:bg-surface-variant'}
          `}
        >
          <ChevronLeft size={16} />
          Previous Step
        </button>

        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentStep ? 'w-4 bg-primary' : 'bg-outline-variant'}`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
          disabled={currentStep === steps.length - 1}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all
            ${currentStep === steps.length - 1 ? 'text-outline opacity-50 cursor-not-allowed' : 'bg-primary text-on-primary hover:bg-primary-container shadow-lg shadow-primary/20'}
          `}
        >
          {currentStep === steps.length - 1 ? 'End of Lifecycle' : 'Next Step'}
          {currentStep !== steps.length - 1 && <ChevronRight size={16} />}
        </button>
      </div>
    </div>
  );
};

export default BeanLifecycleVisualizer;
