
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Terminal, RefreshCw, Globe,
  CheckCircle2, Clock,
  ChevronRight, Database, Server
} from 'lucide-react';
import { MockApi } from '../tutorial-types';

interface Props {
  mockApi: MockApi;
}

const MockApiPlayground: React.FC<Props> = ({ mockApi }) => {
  const [isSending, setIsSending] = useState(false);
  const [response, setResponse] = useState<{
    body: string;
    status: number;
    time: number;
    timestamp: string;
  } | null>(null);

  // Reset response when mockApi changes (new lesson)
  useEffect(() => {
    setResponse(null);
  }, [mockApi]);

  const handleSend = () => {
    setIsSending(true);
    setResponse(null);

    // Simulate network latency
    setTimeout(() => {
      setIsSending(false);
      setResponse({
        body: mockApi.responseBody,
        status: mockApi.status,
        time: Math.floor(Math.random() * 150) + 50,
        timestamp: new Date().toLocaleTimeString(),
      });
    }, 800);
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-primary';
    if (status >= 400) return 'text-error';
    return 'text-orange-400';
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col relative">
      <div className="p-5 border-b border-outline-variant bg-surface-variant/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Terminal className="text-primary" size={20} />
            </div>
            <div>
              <h3 className="text-on-surface font-bold text-lg">API Playground</h3>
              <p className="text-secondary text-xs">Test the implementation in a mock environment</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-surface-variant border border-outline-variant text-[10px] font-bold uppercase tracking-wider ${isSending ? 'text-tertiary' : 'text-secondary'}`}>
              {isSending ? (
                <RefreshCw size={10} className="animate-spin" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
              {isSending ? 'Processing' : 'Server Online'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-surface-container/50 p-2 rounded-xl border border-outline-variant">
          <div className="px-3 py-1.5 rounded-lg bg-surface-variant text-[10px] font-black text-primary uppercase tracking-widest border border-outline-variant">
            {mockApi.method}
          </div>
          <div className="flex-1 flex items-center gap-2 px-2 overflow-hidden">
            <Globe size={14} className="text-secondary shrink-0" />
            <span className="text-sm font-mono text-on-surface-variant truncate">
              {mockApi.endpoint}
            </span>
          </div>
          <button
            onClick={handleSend}
            disabled={isSending}
            className={`
              flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all
              ${isSending
                ? 'bg-surface-variant text-secondary cursor-not-allowed'
                : 'bg-primary text-on-primary hover:bg-primary-container shadow-lg shadow-primary/20'
              }
            `}
          >
            {isSending ? 'Sending...' : 'Send Request'}
            {!isSending && <Send size={14} />}
          </button>
        </div>

        {mockApi.requestBody && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-secondary uppercase tracking-wider">
              <ChevronRight size={10} />
              Request Body
            </div>
            <div className="bg-surface-container/50 p-3 rounded-lg border border-outline-variant font-mono text-xs text-on-surface-variant">
              {mockApi.requestBody}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-[200px] bg-surface-container relative overflow-hidden">
        <AnimatePresence mode="wait">
          {response ? (
            <motion.div
              key="response"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 h-full flex flex-col"
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-outline-variant">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Status</span>
                    <span className={`text-sm font-mono font-bold ${getStatusColor(response.status)}`}>
                      {response.status} {response.status < 300 ? 'OK' : 'Error'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Time</span>
                    <span className="text-sm font-mono text-on-surface-variant">{response.time}ms</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Timestamp</span>
                  <p className="text-xs font-mono text-on-surface-variant">{response.timestamp}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto tutorial-scroll">
                <pre className="font-mono text-sm leading-6 text-primary">
                  <code>{response.body}</code>
                </pre>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-surface-variant flex items-center justify-center border border-outline-variant">
                <Server size={24} className="text-secondary" />
              </div>
              <div>
                <p className="text-sm text-secondary font-medium">Ready to receive request</p>
                <p className="text-xs text-on-surface-variant mt-1 max-w-[240px]">
                  {mockApi.description}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isSending && (
          <div className="absolute inset-0 bg-surface/40 backdrop-blur-[2px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="text-primary animate-spin" size={24} />
              <span className="text-xs font-bold text-primary uppercase tracking-widest">Awaiting Response</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-surface border-t border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[10px] text-secondary font-medium uppercase tracking-wider">
            <Database size={12} className="text-tertiary" />
            H2 In-Memory DB
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-secondary font-medium uppercase tracking-wider">
            <Clock size={12} className="text-secondary" />
            Latency: 50-200ms
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-secondary font-bold uppercase tracking-widest">
          <CheckCircle2 size={12} className="text-primary" />
          Mock Environment
        </div>
      </div>
    </div>
  );
};

export default MockApiPlayground;
