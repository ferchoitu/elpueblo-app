import { createClient } from '@supabase/supabase-js';

// Cliente de Supabase con la SERVICE ROLE key. SOLO para usar en el servidor
// (route handlers / server components): saltea RLS y puede leer todo. La key
// nunca se manda al navegador.
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
