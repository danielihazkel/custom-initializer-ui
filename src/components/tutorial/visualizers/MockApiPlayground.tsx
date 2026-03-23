
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
    if (status >= 200 && status < 300) return 'text-green-400';
    if (status >= 400) return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl flex flex-col">
      <div className="p-5 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
              <Terminal className="text-green-400" size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">API Playground</h3>
              <p className="text-gray-500 text-xs">Test the implementation in a mock environment</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-800 border border-gray-700 text-[10px] font-bold uppercase tracking-wider ${isSending ? 'text-blue-400' : 'text-gray-500'}`}>
              {isSending ? (
                <RefreshCw size={10} className="animate-spin" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              )}
              {isSending ? 'Processing' : 'Server Online'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-gray-950 p-2 rounded-xl border border-gray-800">
          <div className="px-3 py-1.5 rounded-lg bg-gray-800 text-[10px] font-black text-green-400 uppercase tracking-widest border border-gray-700">
            {mockApi.method}
          </div>
          <div className="flex-1 flex items-center gap-2 px-2 overflow-hidden">
            <Globe size={14} className="text-gray-600 shrink-0" />
            <span className="text-sm font-mono text-gray-400 truncate">
              {mockApi.endpoint}
            </span>
          </div>
          <button
            onClick={handleSend}
            disabled={isSending}
            className={`
              flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all
              ${isSending
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
              }
            `}
          >
            {isSending ? 'Sending...' : 'Send Request'}
            {!isSending && <Send size={14} />}
          </button>
        </div>

        {mockApi.requestBody && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              <ChevronRight size={10} />
              Request Body
            </div>
            <div className="bg-gray-950 p-3 rounded-lg border border-gray-800 font-mono text-xs text-gray-400">
              {mockApi.requestBody}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-[200px] bg-[#0d1117] relative overflow-hidden">
        <AnimatePresence mode="wait">
          {response ? (
            <motion.div
              key="response"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 h-full flex flex-col"
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800/50">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Status</span>
                    <span className={`text-sm font-mono font-bold ${getStatusColor(response.status)}`}>
                      {response.status} {response.status < 300 ? 'OK' : 'Error'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Time</span>
                    <span className="text-sm font-mono text-gray-300">{response.time}ms</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Timestamp</span>
                  <p className="text-xs font-mono text-gray-400">{response.timestamp}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto tutorial-scroll">
                <pre className="font-mono text-sm leading-6 text-emerald-400">
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
              <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center border border-gray-800">
                <Server size={24} className="text-gray-700" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Ready to receive request</p>
                <p className="text-xs text-gray-600 mt-1 max-w-[240px]">
                  {mockApi.description}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isSending && (
          <div className="absolute inset-0 bg-gray-950/40 backdrop-blur-[2px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="text-green-500 animate-spin" size={24} />
              <span className="text-xs font-bold text-green-500 uppercase tracking-widest">Awaiting Response</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-950 border-t border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
            <Database size={12} className="text-blue-400" />
            H2 In-Memory DB
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
            <Clock size={12} className="text-purple-400" />
            Latency: 50-200ms
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
          <CheckCircle2 size={12} className="text-green-500" />
          Mock Environment
        </div>
      </div>
    </div>
  );
};

export default MockApiPlayground;
