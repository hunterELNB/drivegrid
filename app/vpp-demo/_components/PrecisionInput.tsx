'use client';
import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { numericInputDisplay } from '@/lib/vpp/units';

/** Rounded at rest; exact on focus and in FormData, including unchanged saves. */
export function PrecisionInput({ defaultValue, name, onChange, min, max, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'value' | 'type'> & {defaultValue:number}) {
  const [raw,setRaw]=useState(String(defaultValue));
  const [focused,setFocused]=useState(false);
  const display=raw===''||!Number.isFinite(Number(raw))?raw:numericInputDisplay(Number(raw));
  const invalid=(props.required&&raw.trim()==='')||raw.length>64||(raw!==''&&(!Number.isFinite(Number(raw))||(min!==undefined&&Number(raw)<Number(min))||(max!==undefined&&Number(raw)>Number(max))));
  return <><input {...props} type="number" step="any" value={focused?raw:display} min={focused?min:undefined} max={focused?max:undefined}
    onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
    ref={element=>{element?.setCustomValidity(invalid?'Value is outside the permitted range.':'');}}
    onChange={event=>{setRaw(event.target.value);onChange?.(event);}}/>
    <input type="hidden" name={name} value={raw}/></>;
}
