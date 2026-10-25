'use client';
import { useMemo } from 'react';
import { settleHistory } from '@/lib/vpp/settlement';
import { useDemo } from './DemoProvider';

export function useSettlement() {
  const {state}=useDemo();
  return useMemo(()=>settleHistory(state.history,state.assets,state.commercialSettings),[state.history,state.assets,state.commercialSettings]);
}
