'use client';

import { createContext, useContext, useEffect, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import { createInitialState, demoReducer, PLAYBACK_MS } from '@/lib/vpp/simulation';
import type { DemoAction, DemoState } from '@/lib/vpp/simulation';

const DemoContext = createContext<{ state: DemoState; dispatch: Dispatch<DemoAction> } | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, undefined, createInitialState);
  useEffect(() => {
    if (!state.running) return;
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), PLAYBACK_MS);
    return () => window.clearInterval(timer);
  }, [state.running]);
  return <DemoContext.Provider value={{ state, dispatch }}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('useDemo requires DemoProvider');
  return context;
}
