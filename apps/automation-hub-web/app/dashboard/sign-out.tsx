'use client';
import { browserClient } from '@/lib/supabase';
export function SignOut() { return <button className="signout" onClick={async()=>{ await browserClient().auth.signOut(); window.location.assign('/login'); }}>Sign out ↗</button>; }
