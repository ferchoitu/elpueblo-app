# DEL PUEBLO — Dashboard

Dashboard web (Next.js) para ver las ventas y cierres que la caja sube a Supabase.
Lee **server-side** con la service role (las claves nunca llegan al navegador) y
entra con una **contraseña simple**. Pensado para desplegar en **Vercel**.

> Requiere que la sincronización esté andando: esquema + Edge Function `push`
> aplicados (ver `../supabase/README.md`) y al menos una caja subiendo datos.

## Requisitos previos en Supabase

Aplicar las dos migraciones (además de `0001`, que crea las tablas):

- `../supabase/migrations/0001_sync_schema.sql` — tablas.
- `../supabase/migrations/0002_dashboard_rpc.sql` — funciones de agregación que
  usa el dashboard (`dash_resumen`, `dash_por_dia`, `dash_top_items`, `dash_por_pago`).

Con la CLI: `supabase db push`. O pegando ambos SQL en el SQL Editor.

## Variables de entorno

Copiá `.env.example` a `.env.local` (para dev) y cargá las mismas en Vercel:

| Variable | Qué es |
|---|---|
| `SUPABASE_URL` | URL del proyecto (`https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → **service_role** (secreta) |
| `DASHBOARD_PASSWORD` | la contraseña para entrar |
| `DASHBOARD_SESSION_SECRET` | string largo al azar para firmar la cookie |

## Desarrollo local

```bash
cd dashboard
npm install
cp .env.example .env.local   # y completá los valores
npm run dev                  # http://localhost:3000
```

## Deploy en Vercel

1. Nuevo proyecto en Vercel apuntando a este repo.
2. **Root Directory: `dashboard`** (importante: el repo tiene la caja en la raíz).
3. Cargá las 4 variables de entorno de arriba.
4. Deploy. Framework: Next.js (autodetectado).

## Qué muestra

- **KPIs**: ventas totales, tickets, ticket promedio del período.
- **Ventas por día** (gráfico) y **por método de pago** (torta).
- **Productos**: unidades, gramos y facturación por producto.
- **Cierres de caja**: por turno, con contado y diferencia.
- **Filtros**: hoy / 7 días / mes / año / personalizado, y por caja (si hay más de una).

Todo excluye ventas anuladas y agrupa por día en horario de Argentina.
