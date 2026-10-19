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
  // Cajas viejas no mandan `pedidos`: queda vacío y todo sigue igual.
  const pedidos = Array.isArray(body?.pedidos) ? body.pedidos : [];
  const ahora = new Date().toISOString();

  // Pedidos primero: sus ítems tienen FK al pedido.
  const pedidoItems: any[] = [];
  const pedidoRows = pedidos.map((p: any) => {
    const { items: pItems, ...rest } = p;
    if (Array.isArray(pItems)) for (const it of pItems) pedidoItems.push({ ...it, pedido_id: p.id });
    return { ...rest, caja_id, actualizado_at: ahora };
  });
  if (pedidoRows.length) {
    const { error } = await supabase.from("pedidos").upsert(pedidoRows);
    if (error) return json({ error: "pedidos: " + error.message }, 500);
  }
  if (pedidoItems.length) {
    const { error } = await supabase.from("pedido_items").upsert(pedidoItems);
    if (error) return json({ error: "pedido_items: " + error.message }, 500);
  }

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

  // Reparto (por fuera de la caja). Responder `reparto` le confirma a la caja que
  // esta versión lo guarda: recién ahí lo marca como subido.
  const rep = body?.reparto ?? {};
  const arr = (x: unknown) => (Array.isArray(x) ? x : []);
  const conCaja = (rows: any[]) => rows.map((r) => ({ ...r, caja_id, actualizado_at: ahora }));
  const repItems: any[] = [];
  const liqRows = arr(rep.liquidaciones).map((l: any) => {
    const { items: lItems, ...rest } = l;
    for (const it of arr(lItems)) repItems.push({ ...it, liquidacion_id: l.id });
    return { ...rest, caja_id, actualizado_at: ahora };
  });
  const pasos: [string, any[]][] = [
    ["repartidores", conCaja(arr(rep.repartidores))],
    ["reparto_clientes", conCaja(arr(rep.clientes))],
    ["reparto_liquidaciones", liqRows],
    ["reparto_items", repItems],
    ["reparto_cobros", conCaja(arr(rep.cobros))],
  ];
  for (const [tabla, rows] of pasos) {
    if (!rows.length) continue;
    const { error } = await supabase.from(tabla).upsert(rows);
    if (error) return json({ error: `${tabla}: ${error.message}` }, 500);
  }

  return json({
    ok: true,
    turnos: turnos.length,
    ventas: ventas.length,
    pedidos: pedidos.length,
    reparto: { liquidaciones: liqRows.length, cobros: arr(rep.cobros).length },
  });
});
