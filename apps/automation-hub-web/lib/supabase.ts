import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
function settings() { const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; if (!url || !key) throw new Error('Set the Supabase URL and publishable key.'); return { url, key }; }
export function browserClient() { const { url, key } = settings(); return createBrowserClient(url, key); }
export async function serverClient() { const { url, key } = settings(); const store = await cookies(); return createServerClient(url, key, { cookies: { getAll() { return store.getAll(); }, setAll(items) { try { items.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* Server Components cannot write cookies; proxy refreshes them. */ } } } }); }
