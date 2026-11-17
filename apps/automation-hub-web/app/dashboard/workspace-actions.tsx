'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase';
type Props = { userId: string; orgId?: string; automations: Array<{id:string;name:string;status:string}> };
export function WorkspaceActions({userId,orgId,automations}: Props) {
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [orgName,setOrgName]=useState('My workspace'),[name,setName]=useState('Welcome notice'),[message,setMessage]=useState('Your automation just ran successfully.');
  async function execute(task:()=>Promise<void>) {setBusy(true);setError('');setNotice('');try{await task();router.refresh();}catch(e){setError(e instanceof Error?e.message:'Something went wrong.');}finally{setBusy(false);}}
  function createOrg(e:FormEvent) {e.preventDefault();void execute(async()=>{const {error}=await browserClient().from('automation_hub_organizations').insert({name:orgName.trim(),owner_user_id:userId});if(error)throw error;setNotice('Workspace created.');});}
  function createAutomation(e:FormEvent) {e.preventDefault();if(!orgId)return;void execute(async()=>{const {error}=await browserClient().from('automation_instances').insert({organization_id:orgId,name:name.trim(),message:message.trim(),kind:'in_app_notice',status:'active'});if(error)throw error;setNotice('Automation saved.');});}
  function run(id:string) {void execute(async()=>{const {error}=await browserClient().rpc('ah_run_in_app_notice',{p_automation_id:id,p_idempotency_key:crypto.randomUUID()});if(error)throw error;setNotice('In-app notification delivered to your activity feed.');});}
  return <section className="action-card">
    <h2>{orgId?'Create a notification automation':'Create your workspace'}</h2>
    {orgId?<><p className="muted">This MVP workflow writes a real notification to your private activity feed. It does not send external messages.</p>
      <form onSubmit={createAutomation} className="action-form">
        <label htmlFor="automationName">Automation name</label><input id="automationName" minLength={1} maxLength={120} required value={name} onChange={e=>setName(e.target.value)}/>
        <label htmlFor="automationMessage">Notification message</label><textarea id="automationMessage" minLength={1} maxLength={500} required rows={3} value={message} onChange={e=>setMessage(e.target.value)}/>
        <button className="primary" disabled={busy||!name.trim()||!message.trim()}>Create automation</button>
      </form>
      {automations.length>0&&<div className="run-actions"><h3>Run an automation</h3>{automations.map(a=><div key={a.id} className="run-action"><span>{a.name}</span><button disabled={busy||a.status!=='active'} onClick={()=>run(a.id)}>{a.status==='active'?'Run now':'Paused'}</button></div>)}</div>}
    </>:<form onSubmit={createOrg} className="action-form"><label htmlFor="orgName">Workspace name</label><input id="orgName" maxLength={100} required value={orgName} onChange={e=>setOrgName(e.target.value)}/><button className="primary" disabled={busy||!orgName.trim()}>Create workspace</button></form>}
    {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="form-success" role="status">{notice}</p>}
  </section>;
}
