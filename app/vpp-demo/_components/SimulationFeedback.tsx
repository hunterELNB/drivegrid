'use client';
import { useDemo } from '../_state/DemoProvider';
import s from '../demo.module.css';
export function SimulationFeedback(){
  const {state}=useDemo();
  return state.dispatchError?<p className={s.notice} role="alert">{state.dispatchError}</p>:null;
}
