
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3 from 'd3';
import {
  ArrowRight, Database, Globe, Layers, Server, Shield, Box, Zap,
  Radio, Router, MessageSquare, LayoutGrid, Info, X,
  Activity, Lock, Cpu
} from 'lucide-react';
import { ARCHITECTURE_STEPS } from '../tutorial-constants';

interface Props {
  activeStage: string | undefined;
}

interface ComponentDetail {
  id: string;
  title: string;
  description: string;
  springRole: string;
  keyAnnotations: string[];
  icon: React.ReactNode;
}

const COMPONENT_DETAILS: Record<string, ComponentDetail> = {
  'client': {
    id: 'client',
    title: 'Client Application',
    description: 'The entry point of the request, typically a browser, mobile app, or another microservice.',
    springRole: 'Originates HTTP/gRPC requests to the Spring ecosystem.',
    keyAnnotations: ['@RestController', '@RequestBody'],
    icon: <Globe className="w-5 h-5" />
  },
  'gateway': {
    id: 'gateway',
    title: 'API Gateway',
    description: 'The single entry point for all clients. Handles routing, rate limiting, and cross-cutting concerns.',
    springRole: 'Spring Cloud Gateway (Reactive) using Predicates and Filters.',
    keyAnnotations: ['@EnableGateway', 'RouteLocator'],
    icon: <Router className="w-5 h-5" />
  },
  'security': {
    id: 'security',
    title: 'Security Filter Chain',
    description: 'Intercepts requests to verify authentication and authorization before they reach the business logic.',
    springRole: 'Spring Security Filter Chain, JWT decoding, and OAuth2 integration.',
    keyAnnotations: ['@EnableWebSecurity', '@PreAuthorize'],
    icon: <Shield className="w-5 h-5" />
  },
  'controller': {
    id: 'controller',
    title: 'REST / GraphQL Controller',
    description: 'Handles incoming requests, validates input, and maps them to service methods.',
    springRole: 'DispatcherServlet routes requests to these beans.',
    keyAnnotations: ['@RestController', '@GetMapping', '@PostMapping'],
    icon: <Server className="w-5 h-5" />
  },
  'cache': {
    id: 'cache',
    title: 'Cache Layer',
    description: 'Stores frequently accessed data in-memory to reduce database load and latency.',
    springRole: 'Spring Cache Abstraction with Redis or Caffeine providers.',
    keyAnnotations: ['@Cacheable', '@CacheEvict', '@EnableCaching'],
    icon: <Zap className="w-5 h-5" />
  },
  'service': {
    id: 'service',
    title: 'Service Layer (Tx Boundary)',
    description: 'Contains core business logic and manages database transactions.',
    springRole: 'The heart of the application. Managed by Spring IoC.',
    keyAnnotations: ['@Service', '@Transactional', '@Async'],
    icon: <Layers className="w-5 h-5" />
  },
  'event-bus': {
    id: 'event-bus',
    title: 'Spring Event Bus',
    description: 'Enables decoupled communication between components within the same application.',
    springRole: 'ApplicationEventPublisher and @EventListener mechanism.',
    keyAnnotations: ['@EventListener', '@TransactionalEventListener'],
    icon: <Radio className="w-5 h-5" />
  },
  'repository': {
    id: 'repository',
    title: 'Repository Layer',
    description: 'Abstracts data access logic, providing a clean API for CRUD operations.',
    springRole: 'Spring Data JPA / MongoDB / JDBC repositories.',
    keyAnnotations: ['@Repository', 'JpaRepository', 'MongoRepository'],
    icon: <Box className="w-5 h-5" />
  },
  'database': {
    id: 'database',
    title: 'Database',
    description: 'The persistent storage for application data.',
    springRole: 'Managed via DataSource and TransactionManager.',
    keyAnnotations: ['@Entity', '@Table', '@Id'],
    icon: <Database className="w-5 h-5" />
  },
  'broker': {
    id: 'broker',
    title: 'Message Broker',
    description: 'Handles asynchronous communication between distributed microservices.',
    springRole: 'Spring AMQP (RabbitMQ) or Spring Kafka integration.',
    keyAnnotations: ['@RabbitListener', '@KafkaListener'],
    icon: <MessageSquare className="w-5 h-5" />
  }
};

const getIcon = (id: string, active: boolean) => {
  const color = active ? 'text-primary' : 'text-secondary';
  switch (id) {
    case 'client': return <Globe className={`w-6 h-6 ${color}`} />;
    case 'gateway': return <Router className={`w-6 h-6 ${color}`} />;
    case 'security': return <Shield className={`w-6 h-6 ${color}`} />;
    case 'controller': return <Server className={`w-6 h-6 ${color}`} />;
    case 'cache': return <Zap className={`w-6 h-6 ${color}`} />;
    case 'service': return <Layers className={`w-6 h-6 ${color}`} />;
    case 'event-bus': return <Radio className={`w-6 h-6 ${color}`} />;
    case 'broker': return <MessageSquare className={`w-6 h-6 ${color}`} />;
    case 'repository': return <Box className={`w-6 h-6 ${color}`} />;
    case 'database': return <Database className={`w-6 h-6 ${color}`} />;
    case 'graphql': return <LayoutGrid className={`w-6 h-6 ${color}`} />;
    default: return <Box className={`w-6 h-6 ${color}`} />;
  }
};

// d3 is imported for potential future use in layout calculations
void d3;

const ArchitectureVisualizer: React.FC<Props> = ({ activeStage }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-select the active stage when it changes
  useEffect(() => {
    if (activeStage && activeStage !== 'none' && activeStage !== 'test') {
      setSelectedId(activeStage);
    }
  }, [activeStage]);

  const selectedDetail = selectedId ? COMPONENT_DETAILS[selectedId] : null;

  return (
    <div className="w-full flex flex-col gap-6" ref={containerRef}>
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>

        <div className="flex items-center justify-between mb-8">
            <h3 className="text-secondary text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                <Activity size={12} className="text-primary" />
                System Architecture Flow
            </h3>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]"></div>
                    <span className="text-[10px] text-secondary font-medium uppercase">Active</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-outline-variant"></div>
                    <span className="text-[10px] text-secondary font-medium uppercase">Idle</span>
                </div>
            </div>
        </div>

        <div className="relative flex flex-wrap justify-center gap-y-12 gap-x-4 py-4">
          {ARCHITECTURE_STEPS.map((step, index) => {
            let isActive = activeStage === step.id;

            // Mappings for visual simplicity
            if (activeStage === 'test' && step.id === 'service') isActive = true;
            if (activeStage === 'graphql' && step.id === 'controller') isActive = true;
            if (activeStage === 'resilience' && step.id === 'service') isActive = true;
            if (activeStage === 'tracing' && step.id === 'service') isActive = true;

            const isSelected = selectedId === step.id;

            return (
              <div key={step.id} className="flex items-center group">
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedId(step.id)}
                  className={`
                    relative z-10 w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 border
                    ${isActive
                      ? 'bg-primary/10 border-primary/50 shadow-[0_0_20px_var(--color-primary)]'
                      : isSelected
                        ? 'bg-primary-container/10 border-primary-container/50 shadow-[0_0_20px_var(--color-primary-container)]'
                        : 'bg-surface-variant border-outline-variant hover:border-outline'
                    }
                  `}
                >
                  {getIcon(step.id, isActive)}

                  {/* Label */}
                  <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className={`text-[10px] font-bold uppercase tracking-tighter transition-colors ${isActive ? 'text-primary' : isSelected ? 'text-primary-container' : 'text-secondary'}`}>
                      {step.label}
                    </span>
                  </div>

                  {/* Active Indicator Ring */}
                  {isActive && (
                    <motion.div
                      layoutId="active-ring"
                      className="absolute inset-0 rounded-xl border-2 border-primary/50"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                </motion.button>

                {index < ARCHITECTURE_STEPS.length - 1 && (
                  <div className="w-6 flex items-center justify-center">
                    <ArrowRight className={`w-3 h-3 transition-colors ${isActive ? 'text-primary animate-pulse' : 'text-outline-variant'}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedDetail ? (
          <motion.div
            key={selectedId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card rounded-2xl p-5 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-2">
                <button
                    onClick={() => setSelectedId(null)}
                    className="p-1 hover:bg-surface-variant rounded-md text-secondary transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="flex gap-5">
                <div className="w-12 h-12 rounded-xl bg-surface-variant flex items-center justify-center shrink-0 border border-outline-variant group-hover:border-primary/30 transition-colors">
                    {selectedDetail.icon}
                </div>
                <div className="space-y-4 flex-1">
                    <div>
                        <h4 className="text-on-surface font-bold text-lg flex items-center gap-2">
                            {selectedDetail.title}
                            {activeStage === selectedId && (
                                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/30 font-bold uppercase tracking-wider">
                                    Current Context
                                </span>
                            )}
                        </h4>
                        <p className="text-on-surface-variant text-sm leading-relaxed mt-1">
                            {selectedDetail.description}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-surface-variant/50 p-3 rounded-xl border border-outline-variant/50">
                            <h5 className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Cpu size={12} className="text-primary" />
                                Spring Framework Role
                            </h5>
                            <p className="text-xs text-on-surface-variant leading-relaxed">
                                {selectedDetail.springRole}
                            </p>
                        </div>
                        <div className="bg-surface-variant/50 p-3 rounded-xl border border-outline-variant/50">
                            <h5 className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Lock size={12} className="text-tertiary" />
                                Key Annotations
                            </h5>
                            <div className="flex flex-wrap gap-1.5">
                                {selectedDetail.keyAnnotations.map(anno => (
                                    <span key={anno} className="text-[10px] font-mono bg-surface-container-highest text-tertiary px-1.5 py-0.5 rounded border border-tertiary/20">
                                        {anno}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          </motion.div>
        ) : (
          <div className="bg-surface-variant/40 border border-dashed border-outline-variant rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3">
             <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-secondary">
                <Info size={20} />
             </div>
             <div>
                <p className="text-sm text-secondary font-medium">Select a component to view its role in Spring Boot</p>
                <p className="text-xs text-on-surface-variant mt-1">The visualizer automatically highlights components relevant to the current lesson.</p>
             </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ArchitectureVisualizer;
