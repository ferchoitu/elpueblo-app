# Sincronización a la nube (Supabase)

La caja sube ventas y cierres a Supabase con la Edge Function `push`. Es la mitad
"servidor" de la sync; la mitad "caja" está en `electron/sync.ts` + Config → ☁️.

> **Nada de esto está desplegado todavía.** Son los archivos listos para que lo
> subas vos cuando quieras (necesita tu proyecto de Supabase y decisiones tuyas).

## 1. Crear/elegir el proyecto y aplicar el esquema

Con la [CLI de Supabase](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <TU_PROJECT_REF>
supabase db push            # aplica supabase/migrations/0001_sync_schema.sql
```

(O pegá el SQL de `migrations/0001_sync_schema.sql` en el SQL Editor del dashboard.)

## 2. Desplegar la Edge Function

```bash
supabase functions deploy push --no-verify-jwt
```

`--no-verify-jwt` es a propósito: la función valida el **token del dispositivo**
(`x-device-token`) por su cuenta, no un JWT de Supabase. Las variables
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase sola.

La URL queda: `https://<PROJECT_REF>.supabase.co/functions/v1/push`

## 3. Dar de alta una caja (device) y su token

Generá un token al azar y registralo. En el SQL Editor:

```sql
insert into devices (token, nombre, negocio)
values (encode(gen_random_bytes(24), 'hex'), 'Caja mostrador', 'DEL PUEBLO')
returning token;
```

Copiá el `token` devuelto.

## 4. Configurar la caja

En la app: **Config → ☁️ Sincronización**:
- **URL**: `https://<PROJECT_REF>.supabase.co/functions/v1/push`
- **Token**: el token del paso 3
- Tildar **Sincronización activada** → Guardar → **Sincronizar ahora**.

La caja sube automáticamente al arrancar, cada 60 s y tras cada venta/cierre. Es
offline-first e idempotente (subir dos veces no duplica). Las cajas ya instaladas
suben también su historial viejo (backfill) la primera vez.

## Pendiente (cuando se arme el dashboard)

- **Lectura**: hoy las tablas tienen RLS activado **sin políticas de SELECT**, así
  que solo la Edge Function (service role) escribe y nadie lee con la anon key.
  Falta agregar políticas para que el dashboard (usuario autenticado) lea los
  datos de sus dispositivos.
- **Multi-caja / negocio**: `devices` ya separa por dispositivo; falta el modelo
  de "negocio" que agrupe varias cajas y el vínculo con el usuario del dashboard.
