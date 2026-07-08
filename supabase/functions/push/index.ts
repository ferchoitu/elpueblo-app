// ===========================================================================
// Edge Function `push` — recibe ventas y turnos de una caja DEL PUEBLO y los
// guarda en la nube (UPSERT idempotente por id). La caja llama a este endpoint
// con el header `x-device-token`; ver electron/sync.ts.
//
// Deploy (una vez):
//   supabase functions deploy push --no-verify-jwt
// La función valida el token del dispositivo por su cuenta, por eso va sin JWT.
//
// Variables de entorno (las setea Supabase solas en el runtime):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ===========================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Item {
  id: string;
  producto_nombre: string | null;
  tipo_venta_usado: string | null;
  cantidad: number | null;
  unidad: string | null;
  precio_unitario: number | null;
  subtotal: number | null;
}
interface Venta {
  id: string;
  numero: number | null;
  fecha: string | null;
  total: number | null;
  metodo_pago: string | null;
  monto_recibido: number | null;
  vuelto: number | null;
  estado: string | null;
  turno_id: string | null;
  anulada_por: string | null;
  anulada_at: string | null;
  empleada: string | null;
  items: Item[];
}
interface Turno {
  id: string;
  numero: number | null;
  apertura_at: string | null;
  fondo_inicial: number | null;
  cierre_at: string | null;
  fondo_cierre: number | null;
  efectivo_contado: number | null;
  total_ventas: number | null;
  total_efectivo: number | null;
  cantidad_tickets: number | null;
  esperado_efectivo: number | null;
  diferencia: number | null;
  estado: string | null;
  empleada: string | null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405);

  const token = req.headers.get('x-device-token');
  if (!token) return json({ ok: false, error: 'Falta x-device-token' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  // 1) Validar el token del dispositivo.
  const { data: device, error: devErr } = await supabase
    .from('devices')
    .select('id, activo')
    .eq('token', token)
    .maybeSingle();
  if (devErr) return json({ ok: false, error: `DB: ${devErr.message}` }, 500);
  if (!device || !device.activo) return json({ ok: false, error: 'Token inválido' }, 403);

  // 2) Parsear el cuerpo.
  let payload: { ventas?: Venta[]; turnos?: Turno[] };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, 400);
  }
  const ventas = payload.ventas ?? [];
  const turnos = payload.turnos ?? [];
  const deviceId = device.id as string;

  try {
    // 3) Turnos primero (aunque la venta no exige FK al turno).
    if (turnos.length) {
      const rows = turnos.map((t) => ({ ...t, device_id: deviceId, updated_at: new Date().toISOString() }));
      const { error } = await supabase.from('turnos').upsert(rows, { onConflict: 'id' });
      if (error) throw new Error(`turnos: ${error.message}`);
    }

    // 4) Ventas + ítems.
    if (ventas.length) {
      const ventaRows = ventas.map(({ items: _items, ...v }) => ({
        ...v,
        device_id: deviceId,
        updated_at: new Date().toISOString(),
      }));
      const { error: vErr } = await supabase.from('ventas').upsert(ventaRows, { onConflict: 'id' });
      if (vErr) throw new Error(`ventas: ${vErr.message}`);

      const itemRows = ventas.flatMap((v) => (v.items ?? []).map((it) => ({ ...it, venta_id: v.id })));
      if (itemRows.length) {
        const { error: iErr } = await supabase.from('venta_items').upsert(itemRows, { onConflict: 'id' });
        if (iErr) throw new Error(`venta_items: ${iErr.message}`);
      }
    }

    await supabase.from('devices').update({ last_push_at: new Date().toISOString() }).eq('id', deviceId);

    return json({ ok: true, ventas: ventas.length, turnos: turnos.length });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
