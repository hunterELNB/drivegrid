import { notFound } from 'next/navigation';

// All approved sections now have explicit routes; keep unknown modules unavailable.
export const dynamicParams=false;
export function generateStaticParams():{module:string}[]{return [];}
export default function UnavailableModule(){notFound();}
