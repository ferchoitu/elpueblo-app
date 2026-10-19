# Sincronización a la nube (Supabase)

La caja sube ventas y cierres a Supabase con la Edge Function `push`. Es la mitad
"servidor" de la sync; la mitad "caja" está en `electron/sync.ts` + Config → ☁️.

## Estado: DESPLEGADO ✅

Proyecto **`delpueblo-caja`** (`duzzunmryafyvssgjkux`, región sa-east-1):

- ✅ Esquema aplicado (`cajas`, `dispositivos`, `turnos`, `ventas`, `venta_items`) — ver `migrations/0001_sync_schema.sql`.
- ✅ Funciones del dashboard aplicadas — `migrations/0002_dashboard_rpc.sql`.
- ✅ Edge Function `push` desplegada (`--no-verify-jwt`) — `functions/push/index.ts`.
- ✅ 1 caja + 1 dispositivo con token creados.
- ✅ Camino de subida probado end-to-end (una venta de prueba subió y se borró).

**URL del push:** `https://duzzunmryafyvssgjkux.supabase.co/functions/v1/push`

## Pedidos (migración 0004) — APLICADA 2026-10-19 (push v2)

- Tablas `pedidos` y `pedido_items`, y columna `ventas.pedido_id` (seña y saldo
  son ventas normales atadas al pedido).
- Métricas: `dash_pedidos_resumen`, `dash_pedidos_por_mes`, `dash_pedidos_top_items`
  (período = cuándo se tomó el pedido; "cobrado" = ventas no anuladas del pedido).
- **Orden de despliegue:** 1) aplicar `migrations/0004_pedidos.sql`,
  2) desplegar `push`, 3) recién ahí publicar la versión de la caja. Si la caja
  nueva sube antes de la migración, el upsert de ventas falla por `pedido_id`
  (la caja reintenta sola, pero no sube nada hasta que esté la columna).

## Reparto (migración 0005) — PENDIENTE DE APLICAR

- Tablas `repartidores`, `reparto_clientes`, `reparto_liquidaciones`, `reparto_items`,
  `reparto_cobros`. Va por fuera de la caja del local (no son ventas).
- Métricas: `dash_reparto_resumen`, `dash_reparto_por_mes`, `dash_reparto_por_repartidor`.
- Orden: 1) aplicar 0005, 2) desplegar `push`. La caja solo marca el reparto como
  subido si `push` responde la clave `reparto`, así que una caja nueva contra una
  función vieja no pierde datos: los reintenta.

## Modelo

Dos niveles: `cajas` (el negocio) y `dispositivos` (cada caja física, con su
`token`). Los datos cuelgan de `caja_id`. La función `push` valida el
`x-device-token`, resuelve el `caja_id` del dispositivo y hace UPSERT idempotente
por id (el mismo UUID de la caja local). Subir dos veces no duplica.

## Configurar una caja

En la app: **Config → ☁️ Sincronización**:
- **URL**: `https://duzzunmryafyvssgjkux.supabase.co/functions/v1/push`
- **Token**: el `token` del dispositivo (tabla `dispositivos`).
- Tildar **activada** → Guardar → **Sincronizar ahora**.

## Alta de otra caja/dispositivo

```sql
-- una caja (negocio)
insert into cajas (nombre) values ('Sucursal centro') returning id;
-- un dispositivo con token para esa caja
insert into dispositivos (caja_id, nombre, token)
values ('<caja_id>', 'Caja mostrador', encode(gen_random_bytes(24), 'hex'))
returning token;
```

## Volver a aplicar / cambios

Las migraciones son idempotentes (`create table if not exists`,
`create or replace function`). Con la CLI: `supabase db push`. Para la función:
`supabase functions deploy push --no-verify-jwt`.

## Pendiente (cuando se quiera)

- **Lectura del dashboard**: hoy lee con la service role (saltea RLS). Las tablas
  tienen RLS activado sin políticas de SELECT. Si en el futuro el dashboard leyera
  con la anon key o con usuarios, habría que agregar políticas por caja/usuario.
