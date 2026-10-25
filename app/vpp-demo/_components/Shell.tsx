'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { navigation } from '@/lib/vpp/fixtures';
import s from '../demo.module.css';
import { SimulationClock } from './SimulationClock';
import { SimulationFeedback } from './SimulationFeedback';
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <div className={s.shell}>
    <a className={s.skip} href="#vpp-main">Skip to content</a>
    <aside className={s.sidebar}>

<Link href="/" className={s.brand} onClick={() => setOpen(false)}><Image src="/logo.jpg" alt="DriveGrid — Return to homepage" width={892} height={413} className={s.brandLogo} priority/><small>VIRTUAL POWER PLANT</small></Link>

      <button className={s.menuButton} aria-expanded={open} aria-controls="vpp-navigation" onClick={() => setOpen(!open)}>{open ? 'Close menu ×' : 'Navigation ☰'}</button>
      <nav id="vpp-navigation" aria-label="VPP application" className={`${s.navigation} ${open ? s.navigationOpen : ''}`}>
        <p className={s.navLabel}>WORKSPACE</p>
        {navigation.map(item => { const href = `/vpp-demo${item.slug ? `/${item.slug}` : ''}`; return <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} className={`${s.navLink} ${pathname === href ? s.active : ''}`} onClick={() => setOpen(false)}><span aria-hidden="true">{item.symbol}</span>{item.label}</Link>; })}
        <div className={s.sidebarBottom}><span className={s.badge}>SIMULATION MODE</span><p>Illustrative data. No live assets or market connections.</p><Link className={s.returnLink} href="/">← Corporate Website</Link></div>
      </nav>
    </aside>
    <div className={s.workspace}><header className={s.topbar}><span>Workspace <span className={s.breadcrumb}>/ VPP Operations</span></span><span className={s.badge}>SIMULATION MODE</span></header><main id="vpp-main" className={s.main}><SimulationClock/><SimulationFeedback/>{children}</main><footer className={s.footer}>DRIVEGRID VPP · Demonstration environment <span>All values and events are simulated.</span></footer></div>
  </div>;
}

