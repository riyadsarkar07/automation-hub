import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase';
import { SignOut } from './sign-out';
import { WorkspaceActions } from './workspace-actions';
export const dynamic = 'force-dynamic';
type Automation = {id:string; name:string; status:string; created_at:string};
type Run = {id:string; status:string; summary:string; started_at:string};
type Event = {id:string;message:string;created_at:string};
export default async function Dashboard() {
  let client;
  try { client=await serverClient(); } catch { return <main className="dashboard-main"><h1>Configuration required</h1><p>Configure your Supabase URL and publishable key.</p></main>; }
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user) redirect('/login');
  const orgResult=await client.from('automation_hub_organizations').select('id,name').order('created_at',{ascending:true}).limit(1);
  const org=orgResult.data?.[0];
  const [automationResult,runResult,eventResult]=org? await Promise.all([
    client.from('automation_instances').select('id,name,status,created_at').eq('organization_id',org.id).order('created_at',{ascending:false}).limit(30),
    client.from('automation_runs').select('id,status,summary,started_at').eq('organization_id',org.id).order('started_at',{ascending:false}).limit(15),
    client.from('automation_hub_events').select('id,message,created_at').eq('organization_id',org.id).order('created_at',{ascending:false}).limit(15)
  ]):[{data:[],error:null},{data:[],error:null},{data:[],error:null}];
  const automations=(automationResult.data??[]) as Automation[];
  const runs=(runResult.data??[]) as Run[];
  const events=(eventResult.data??[]) as Event[];
  const error=orgResult.error||automationResult.error||runResult.error||eventResult.error;
  return <main className="dashboard"><aside className="sidebar"><a className="brand" href="/">✳ Automation Hub</a><div className="side-menu"><span className="active">◈ Overview</span><span>⌁ Automations</span><span>◷ Activity</span><span>▦ Integrations <em>Coming soon</em></span><span>◇ Billing <em>Coming soon</em></span></div><div className="side-bottom"><small>Signed in as</small><p>{user.email}</p><SignOut/></div></aside>
    <section className="dashboard-main"><header className="dashboard-header"><p className="eyebrow">WORKSPACE / OVERVIEW</p><span className="status-pill">Secure session</span></header><h1>{org?.name??'Your workspace'}</h1><p className="muted">Create and run your first private in-app notification automation.</p>
    {error&&<p role="alert" className="form-error">Database setup is incomplete: {error.message}. Apply the reviewed SQL migration to a dedicated Automation Hub Supabase project.</p>}
    <div className="metric-grid"><article className="metric"><span>Automations</span><strong>{error?'—':automations.length}</strong><small>In this workspace</small></article><article className="metric"><span>Recent runs</span><strong>{error?'—':runs.length}</strong><small>Latest 15 runs</small></article><article className="metric"><span>In-app notifications</span><strong>{error?'—':events.length}</strong><small>Latest 15 notifications</small></article></div>
    {!error&&<WorkspaceActions userId={user.id} orgId={org?.id} automations={automations.map(({id,name,status})=>({id,name,status}))}/>}
    <section className="list-panel"><div className="list-heading"><h2>Saved automations</h2><span>{automations.length} visible</span></div>{automations.length?<ul className="automation-list">{automations.map(a=><li key={a.id}><b>{a.name}</b><span>{a.status}</span></li>)}</ul>:<p className="empty">No automations have been created yet.</p>}</section>
    <section className="list-panel spaced"><div className="list-heading"><h2>Recent activity</h2><span>Private notifications</span></div>{events.length?<ul className="automation-list">{events.map(e=><li key={e.id}><span>{e.message}</span><small>{new Date(e.created_at).toLocaleString()}</small></li>)}</ul>:<p className="empty">Run a notification automation to see an activity record here.</p>}</section>
    <p className="disclaimer">Internal workflow only. External messaging, billing and n8n worker integrations are not enabled.</p></section></main>;
}
