-- ===========================================================================
-- DEL PUEBLO — esquema de la nube para la sincronización caja -> Supabase.
--
-- ESTE ES EL ESQUEMA YA APLICADO en el proyecto `delpueblo-caja`
-- (duzzunmryafyvssgjkux). Se documenta acá para tener el repo como fuente.
--
-- Modelo de dos niveles:
--   cajas         -> un negocio / punto de venta
--   dispositivos  -> cada caja física, con su TOKEN (auth de la sync)
-- Los datos (turnos/ventas/venta_items) cuelgan de `caja_id`. La Edge Function
-- `push` valida el token del dispositivo, resuelve su caja_id y hace UPSERT
-- idempotente por id (el mismo UUID que usa la caja local).
-- ===========================================================================

create table if not exists cajas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text,
  created_at timestamptz not null default now()
);

create table if not exists dispositivos (
  id         uuid primary key default gen_random_uuid(),
  caja_id    uuid not null references cajas(id),
  nombre     text,
  token      text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists turnos (
  id                uuid primary key,
  caja_id           uuid references cajas(id),
  numero            integer,
  empleada          text,
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
  actualizado_at    timestamptz not null default now()
);

create table if not exists ventas (
  id             uuid primary key,
  caja_id        uuid references cajas(id),
  turno_id       uuid,               -- referencia "blanda": el turno puede subir después
  numero         integer,
  fecha          timestamptz,
  total          numeric,
  metodo_pago    text,
  monto_recibido numeric,
  vuelto         numeric,
  estado         text,
  empleada       text,
  anulada_por    text,
  anulada_at     timestamptz,
  actualizado_at timestamptz not null default now()
);
create index if not exists idx_ventas_caja on ventas(caja_id);
create index if not exists idx_ventas_fecha on ventas(fecha);

create table if not exists venta_items (
  id               uuid primary key,
  venta_id         uuid references ventas(id) on delete cascade,
  producto_nombre  text,
  tipo_venta_usado text,
  cantidad         numeric,
  unidad           text,
  precio_unitario  numeric,
  subtotal         numeric
);
create index if not exists idx_items_venta on venta_items(venta_id);

-- RLS activado en todas. La Edge Function `push` y el dashboard escriben/leen con
-- la service role (saltea RLS). Sin políticas públicas, la anon key no lee nada.
alter table cajas        enable row level security;
alter table dispositivos enable row level security;
alter table turnos       enable row level security;
alter table ventas       enable row level security;
alter table venta_items  enable row level security;
