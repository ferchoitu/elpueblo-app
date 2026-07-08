-- ===========================================================================
-- DEL PUEBLO — esquema de la nube para la sincronización caja -> Supabase.
--
-- Cada caja se identifica con un token de dispositivo (tabla `devices`). La
-- Edge Function `push` valida ese token y hace UPSERT idempotente por id (el
-- mismo UUID que usa la caja local), así subir dos veces la misma venta/turno
-- no duplica. Los ids son TEXT (UUID v4 generados en la caja) para no atarnos a
-- un formato ni fallar si alguno no calza como uuid nativo.
--
-- Escritura: solo la Edge Function (service role, saltea RLS). Lectura del
-- dashboard: se agregará con políticas RLS por dispositivo/usuario (ver TODO).
-- ===========================================================================

create table if not exists devices (
  id          text primary key default gen_random_uuid()::text,
  token       text unique not null,
  nombre      text,                 -- ej: "Caja mostrador"
  negocio     text,                 -- nombre del negocio (informativo)
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  last_push_at timestamptz
);

create table if not exists turnos (
  id                text primary key,
  device_id         text not null references devices(id) on delete cascade,
  numero            integer,
  apertura_at       timestamptz,
  fondo_inicial     numeric,
  cierre_at         timestamptz,
  fondo_cierre      numeric,
  efectivo_contado  numeric,
  total_ventas      numeric,
  total_efectivo    numeric,
  cantidad_tickets  integer,
  esperado_efectivo numeric,
  diferencia        numeric,
  estado            text,
  empleada          text,
  updated_at        timestamptz not null default now()
);
create index if not exists idx_turnos_device on turnos(device_id);

create table if not exists ventas (
  id             text primary key,
  device_id      text not null references devices(id) on delete cascade,
  numero         integer,
  fecha          timestamptz,
  total          numeric,
  metodo_pago    text,
  monto_recibido numeric,
  vuelto         numeric,
  estado         text,
  turno_id       text,              -- referencia "blanda": el turno puede subir después
  anulada_por    text,
  anulada_at     timestamptz,
  empleada       text,
  updated_at     timestamptz not null default now()
);
create index if not exists idx_ventas_device on ventas(device_id);
create index if not exists idx_ventas_turno on ventas(turno_id);
create index if not exists idx_ventas_fecha on ventas(fecha);

create table if not exists venta_items (
  id               text primary key,
  venta_id         text not null references ventas(id) on delete cascade,
  producto_nombre  text,
  tipo_venta_usado text,
  cantidad         numeric,
  unidad           text,
  precio_unitario  numeric,
  subtotal         numeric
);
create index if not exists idx_items_venta on venta_items(venta_id);

-- RLS: activado en todas. La Edge Function escribe con la service role (saltea
-- RLS). No creamos políticas públicas: sin políticas, nadie lee con la anon key.
-- TODO(dashboard): agregar políticas de SELECT por usuario/dispositivo cuando se
-- arme el dashboard (ej: un usuario autenticado ve los devices de su negocio).
alter table devices     enable row level security;
alter table turnos      enable row level security;
alter table ventas      enable row level security;
alter table venta_items enable row level security;
