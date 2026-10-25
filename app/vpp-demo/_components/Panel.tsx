import s from '../demo.module.css';
export function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className={s.panel} aria-label={title}><div className={s.panelHeading}><h2>{title}</h2><p>{subtitle}</p></div>{children}</section>;
}
