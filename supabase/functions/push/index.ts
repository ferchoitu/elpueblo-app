import { createClient } from "jsr:@supabase/supabase-js@2";

// Sincronización caja -> nube. Autenticación por TOKEN de dispositivo (no JWT),
// por eso verify_jwt está deshabilitado y validamos el token a mano.
// Ya desplegada en el proyecto delpueblo-caja: `supabase functions deploy push --no-verify-jwt`.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-device-token, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const token = req.headers.get("x-device-token") ?? "";
  if (!token) return json({ error: "sin token" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const { data: disp } = await supabase
    .from("dispositivos").select("caja_id").eq("token", token).maybeSingle();
  if (!disp) return json({ error: "token invalido" }, 401);
  const caja_id = disp.caja_id as string;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "json invalido" }, 400); }

  const turnos = Array.isArray(body?.turnos) ? body.turnos : [];
  const ventas = Array.isArray(body?.ventas) ? body.ventas : [];
  const ahora = new Date().toISOString();

  if (turnos.length) {
    const rows = turnos.map((t: any) => ({ ...t, caja_id, actualizado_at: ahora }));
    const { error } = await supabase.from("turnos").upsert(rows);
    if (error) return json({ error: "turnos: " + error.message }, 500);
  }

  const items: any[] = [];
  const ventaRows = ventas.map((v: any) => {
    const { items: vItems, ...rest } = v;
    if (Array.isArray(vItems)) for (const it of vItems) items.push({ ...it, venta_id: v.id });
    return { ...rest, caja_id, actualizado_at: ahora };
  });
  if (ventaRows.length) {
    const { error } = await supabase.from("ventas").upsert(ventaRows);
    if (error) return json({ error: "ventas: " + error.message }, 500);
  }
  if (items.length) {
    const { error } = await supabase.from("venta_items").upsert(items);
    if (error) return json({ error: "items: " + error.message }, 500);
  }

  return json({ ok: true, turnos: turnos.length, ventas: ventas.length });
});
