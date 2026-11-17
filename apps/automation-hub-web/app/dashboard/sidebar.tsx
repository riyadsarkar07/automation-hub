import Link from 'next/link';
import { SignOut } from './sign-out';

type SidebarProps = {
  active: 'overview' | 'integrations';
  email?: string;
};

export function DashboardSidebar({ active, email }: SidebarProps) {
  return (
    <aside className="sidebar">
      <Link className="brand" href="/">✳ Automation Hub</Link>
      <nav aria-label="Workspace navigation" className="side-menu">
        <Link aria-current={active === 'overview' ? 'page' : undefined} className={active === 'overview' ? 'active' : ''} href="/dashboard">◈ Overview</Link>
        <Link href="/dashboard#automations">⌁ Automations</Link>
        <Link href="/dashboard#activity">◷ Activity</Link>
        <Link aria-current={active === 'integrations' ? 'page' : undefined} className={active === 'integrations' ? 'active' : ''} href="/dashboard/integrations">▦ Integrations</Link>
        <span aria-disabled="true">◇ Billing <em>Coming soon</em></span>
      </nav>
      <div className="side-bottom">
        <small>Signed in as</small>
        <p>{email}</p>
        <SignOut />
      </div>
    </aside>
  );
}
