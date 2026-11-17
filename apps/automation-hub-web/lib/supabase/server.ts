import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export async function serverClient() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key) throw new Error('Supabase environment variables are not configured.');
  const store=await cookies();
  return createServerClient(url,key,{ cookies:{
    getAll(){return store.getAll();},
    setAll(items){try{items.forEach(({name,value,options})=>store.set(name,value,options));}catch{/* Proxy refreshes in read-only render context. */}}
  }});
}
