import type { Metadata } from 'next';
import { Shell } from './_components/Shell';
import { DemoProvider } from './_state/DemoProvider';
export const metadata: Metadata = { title: 'VPP Operations | DriveGrid', description: 'DriveGrid simulated virtual power plant operations dashboard.' };
export default function VppLayout({ children }: { children: React.ReactNode }) {
  return <DemoProvider><Shell>{children}</Shell></DemoProvider>;
}
