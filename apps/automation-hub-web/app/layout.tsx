import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Automation Hub', description: 'Manage approved automations, securely and simply.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
