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
