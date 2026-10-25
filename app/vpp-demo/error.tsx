'use client';

import s from './assets.module.css';

export default function DemoError({reset}:{reset:()=>void}) {
  return <section className={s.clock} role="alert">
    <div><h1>This demo view could not be displayed</h1><p>Try the view again. To start a clean simulation, refresh this page; unsaved demo activity will be cleared.</p></div>
    <div className={s.controls}><button onClick={reset}>Try view again</button></div>
  </section>;
}
