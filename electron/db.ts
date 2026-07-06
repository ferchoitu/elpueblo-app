import Database from 'better-sqlite3';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import type {
  Categoria,
  Producto,
  NuevoProducto,
  NuevaCategoria,
  NuevaVenta,
  VentaConItems,
  Venta,
  VentaItem,
  MetricasResumen,
  RangoFechas,
  MetodoPago,
  Usuario,
  Turno,
  Rol,
  DetalleItemVendido,
} from '../shared/types';

let db: Database.Database;

/** Ruta del archivo SQLite. Vive en userData para sobrevivir actualizaciones. */
export function dbPath(): string {
  return path.join(app.getPath('userData'), 'delpueblo.db');
}

const nowUTC = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Init + migraciones
// ---------------------------------------------------------------------------

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categorias (
  id         TEXT PRIMARY KEY,
  nombre     TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#3b82f6',
  emoji      TEXT DEFAULT '🥖',
  orden      INTEGER NOT NULL DEFAULT 0,
  activo     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS productos (
  id                TEXT PRIMARY KEY,
  nombre            TEXT NOT NULL,
  categoria_id      TEXT REFERENCES categorias(id),
  tipo_venta        TEXT NOT NULL DEFAULT 'unidad',
  precio_unidad     REAL,
  precio_kg         REAL,
  emoji             TEXT DEFAULT '🥐',
  color             TEXT,
  orden             INTEGER NOT NULL DEFAULT 0,
  activo            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ventas (
  id             TEXT PRIMARY KEY,
  numero         INTEGER NOT NULL,
  fecha          TEXT NOT NULL,
  total          REAL NOT NULL,
  metodo_pago    TEXT NOT NULL,
  monto_recibido REAL,
  vuelto         REAL,
  estado         TEXT NOT NULL DEFAULT 'completada',
  turno_id       TEXT,
  usuario_id     TEXT,
  synced_at      TEXT
);

CREATE TABLE IF NOT EXISTS venta_items (
  id                       TEXT PRIMARY KEY,
  venta_id                 TEXT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id              TEXT,
  nombre_producto          TEXT NOT NULL,
  tipo_venta_usado         TEXT NOT NULL,
  cantidad                 REAL NOT NULL,
  unidad                   TEXT NOT NULL,
  precio_unitario_aplicado REAL NOT NULL,
  subtotal                 REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
  id         TEXT PRIMARY KEY,
  nombre     TEXT NOT NULL,
  usuario    TEXT,                 -- login del admin; NULL en empleadas
  rol        TEXT NOT NULL,        -- 'admin' | 'empleada'
  pass_hash  TEXT,                 -- scrypt (admin: contraseña; empleada: PIN)
  activo     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS turnos (
  id                TEXT PRIMARY KEY,
  numero            INTEGER NOT NULL,
  usuario_id        TEXT NOT NULL REFERENCES usuarios(id),
  apertura_at       TEXT NOT NULL,
  fondo_inicial     REAL NOT NULL,
  cierre_at         TEXT,
  efectivo_contado  REAL,
  total_ventas      REAL,
  total_efectivo    REAL,
  cantidad_tickets  INTEGER,
  esperado_efectivo REAL,
  diferencia        REAL,
  estado            TEXT NOT NULL DEFAULT 'abierto',
  synced_at         TEXT,
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_items_venta ON venta_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_turnos_usuario ON turnos(usuario_id);
`;

/** Agrega columnas que puedan faltar en bases creadas con versiones previas. */
function migrar(d: Database.Database): void {
  const cols = (tabla: string) =>
    (d.prepare(`PRAGMA table_info(${tabla})`).all() as { name: string }[]).map((c) => c.name);
  const ventasCols = cols('ventas');
  if (!ventasCols.includes('turno_id')) d.exec('ALTER TABLE ventas ADD COLUMN turno_id TEXT');
  if (!ventasCols.includes('usuario_id')) d.exec('ALTER TABLE ventas ADD COLUMN usuario_id TEXT');
  d.exec('CREATE INDEX IF NOT EXISTS idx_ventas_turno ON ventas(turno_id)');
}

export function initDB(): Database.Database {
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrar(db);

  // Semilla sólo si no hay productos aún.
  const count = db.prepare('SELECT COUNT(*) AS n FROM productos').get() as { n: number };
  if (count.n === 0) seed();

  return db;
}

export function getDB(): Database.Database {
  if (!db) throw new Error('DB no inicializada');
  return db;
}

// ---------------------------------------------------------------------------
// Config key-value (datos negocio, impresora, balanza)
// ---------------------------------------------------------------------------

export function getConfig<T>(clave: string): T | null {
  const row = db.prepare('SELECT valor FROM config WHERE clave = ?').get(clave) as
    | { valor: string }
    | undefined;
  return row ? (JSON.parse(row.valor) as T) : null;
}

export function setConfig(clave: string, valor: unknown): void {
  db.prepare(
    'INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor'
  ).run(clave, JSON.stringify(valor));
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

export function listarCategorias(): Categoria[] {
  return db
    .prepare('SELECT * FROM categorias WHERE activo = 1 ORDER BY orden, nombre')
    .all() as Categoria[];
}

export function crearCategoria(c: NuevaCategoria): Categoria {
  const cat: Categoria = {
    id: randomUUID(),
    nombre: c.nombre,
    color: c.color,
    emoji: c.emoji,
    orden: c.orden ?? 0,
    activo: 1,
    created_at: nowUTC(),
  };
  db.prepare(
    'INSERT INTO categorias (id, nombre, color, emoji, orden, activo, created_at) VALUES (@id, @nombre, @color, @emoji, @orden, @activo, @created_at)'
  ).run(cat);
  return cat;
}

export function editarCategoria(id: string, cambios: Partial<NuevaCategoria> & { activo?: number }): void {
  const actual = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id) as Categoria | undefined;
  if (!actual) throw new Error('Categoría no encontrada');
  const m = { ...actual, ...cambios };
  db.prepare(
    'UPDATE categorias SET nombre=@nombre, color=@color, emoji=@emoji, orden=@orden, activo=@activo WHERE id=@id'
  ).run({ ...m, id });
}

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

export function listarProductos(): Producto[] {
  return db
    .prepare('SELECT * FROM productos WHERE activo = 1 ORDER BY orden, nombre')
    .all() as Producto[];
}

export function crearProducto(p: NuevoProducto): Producto {
  const now = nowUTC();
  const prod: Producto = {
    id: randomUUID(),
    nombre: p.nombre,
    categoria_id: p.categoria_id,
    tipo_venta: p.tipo_venta,
    precio_unidad: p.precio_unidad,
    precio_kg: p.precio_kg,
    emoji: p.emoji,
    color: p.color,
    orden: p.orden ?? 0,
    activo: 1,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO productos (id, nombre, categoria_id, tipo_venta, precio_unidad, precio_kg, emoji, color, orden, activo, created_at, updated_at)
     VALUES (@id, @nombre, @categoria_id, @tipo_venta, @precio_unidad, @precio_kg, @emoji, @color, @orden, @activo, @created_at, @updated_at)`
  ).run(prod);
  return prod;
}

export function editarProducto(id: string, cambios: Partial<NuevoProducto> & { activo?: number }): void {
  const actual = db.prepare('SELECT * FROM productos WHERE id = ?').get(id) as Producto | undefined;
  if (!actual) throw new Error('Producto no encontrado');
  const m = { ...actual, ...cambios, id, updated_at: nowUTC() };
  db.prepare(
    `UPDATE productos SET nombre=@nombre, categoria_id=@categoria_id, tipo_venta=@tipo_venta,
     precio_unidad=@precio_unidad, precio_kg=@precio_kg, emoji=@emoji, color=@color,
     orden=@orden, activo=@activo, updated_at=@updated_at WHERE id=@id`
  ).run(m);
}

export function borrarProducto(id: string): void {
  // Borrado lógico: preserva histórico de ventas.
  db.prepare('UPDATE productos SET activo = 0, updated_at = ? WHERE id = ?').run(nowUTC(), id);
}

// ---------------------------------------------------------------------------
// Ventas (transacción única: venta + ítems + correlativo)
// ---------------------------------------------------------------------------

export function crearVenta(
  v: NuevaVenta,
  turnoId: string | null,
  usuarioId: string | null
): VentaConItems {
  const tx = db.transaction((nueva: NuevaVenta): VentaConItems => {
    const maxRow = db.prepare('SELECT COALESCE(MAX(numero), 0) AS max FROM ventas').get() as {
      max: number;
    };
    const numero = maxRow.max + 1;
    const ventaId = randomUUID();
    const fecha = nowUTC();

    const venta: Venta = {
      id: ventaId,
      numero,
      fecha,
      total: nueva.total,
      metodo_pago: nueva.metodo_pago,
      monto_recibido: nueva.monto_recibido,
      vuelto: nueva.vuelto,
      estado: 'completada',
      turno_id: turnoId,
      usuario_id: usuarioId,
      synced_at: null, // NULL = pendiente de subir a la nube (fase futura)
    };

    db.prepare(
      `INSERT INTO ventas (id, numero, fecha, total, metodo_pago, monto_recibido, vuelto, estado, turno_id, usuario_id, synced_at)
       VALUES (@id, @numero, @fecha, @total, @metodo_pago, @monto_recibido, @vuelto, @estado, @turno_id, @usuario_id, @synced_at)`
    ).run(venta);

    const insItem = db.prepare(
      `INSERT INTO venta_items (id, venta_id, producto_id, nombre_producto, tipo_venta_usado, cantidad, unidad, precio_unitario_aplicado, subtotal)
       VALUES (@id, @venta_id, @producto_id, @nombre_producto, @tipo_venta_usado, @cantidad, @unidad, @precio_unitario_aplicado, @subtotal)`
    );

    const items: VentaItem[] = nueva.items.map((it) => {
      const item: VentaItem = { id: randomUUID(), venta_id: ventaId, ...it };
      insItem.run(item);
      return item;
    });

    return { ...venta, items };
  });

  return tx(v);
}

export function anularVenta(id: string): void {
  db.prepare("UPDATE ventas SET estado = 'anulada' WHERE id = ?").run(id);
}

export function ultimaVenta(turnoId?: string | null): Venta | null {
  const row = turnoId
    ? (db
        .prepare(
          "SELECT * FROM ventas WHERE estado = 'completada' AND turno_id = ? ORDER BY numero DESC LIMIT 1"
        )
        .get(turnoId) as Venta | undefined)
    : (db
        .prepare("SELECT * FROM ventas WHERE estado = 'completada' ORDER BY numero DESC LIMIT 1")
        .get() as Venta | undefined);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

interface UsuarioRow extends Usuario {
  pass_hash: string | null;
}

export function existeAdmin(): boolean {
  const r = db
    .prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin' AND activo = 1")
    .get() as { n: number };
  return r.n > 0;
}

export function listarUsuarios(rol?: Rol): Usuario[] {
  const rows = rol
    ? (db
        .prepare('SELECT id, nombre, usuario, rol, activo, created_at FROM usuarios WHERE activo = 1 AND rol = ? ORDER BY nombre')
        .all(rol) as Usuario[])
    : (db
        .prepare('SELECT id, nombre, usuario, rol, activo, created_at FROM usuarios WHERE activo = 1 ORDER BY rol, nombre')
        .all() as Usuario[]);
  return rows;
}

export function obtenerUsuarioPorLogin(usuario: string): UsuarioRow | null {
  return (
    (db
      .prepare("SELECT * FROM usuarios WHERE usuario = ? AND rol = 'admin' AND activo = 1")
      .get(usuario) as UsuarioRow | undefined) ?? null
  );
}

export function obtenerUsuarioRow(id: string): UsuarioRow | null {
  return (db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id) as UsuarioRow | undefined) ?? null;
}

export function crearUsuario(u: {
  nombre: string;
  usuario: string | null;
  rol: Rol;
  pass_hash: string;
}): Usuario {
  const usr: UsuarioRow = {
    id: randomUUID(),
    nombre: u.nombre,
    usuario: u.usuario,
    rol: u.rol,
    pass_hash: u.pass_hash,
    activo: 1,
    created_at: nowUTC(),
  };
  db.prepare(
    'INSERT INTO usuarios (id, nombre, usuario, rol, pass_hash, activo, created_at) VALUES (@id,@nombre,@usuario,@rol,@pass_hash,@activo,@created_at)'
  ).run(usr);
  const { pass_hash, ...pub } = usr;
  return pub;
}

export function actualizarPassHash(id: string, pass_hash: string): void {
  db.prepare('UPDATE usuarios SET pass_hash = ? WHERE id = ?').run(pass_hash, id);
}

export function editarUsuario(id: string, cambios: { nombre?: string; activo?: number }): void {
  const actual = obtenerUsuarioRow(id);
  if (!actual) throw new Error('Usuario no encontrado');
  db.prepare('UPDATE usuarios SET nombre = ?, activo = ? WHERE id = ?').run(
    cambios.nombre ?? actual.nombre,
    cambios.activo ?? actual.activo,
    id
  );
}

// ---------------------------------------------------------------------------
// Turnos
// ---------------------------------------------------------------------------

export function turnoAbiertoDe(usuarioId: string): Turno | null {
  return (
    (db
      .prepare("SELECT * FROM turnos WHERE usuario_id = ? AND estado = 'abierto' ORDER BY numero DESC LIMIT 1")
      .get(usuarioId) as Turno | undefined) ?? null
  );
}

export function obtenerTurno(id: string): Turno | null {
  const t = db
    .prepare(
      `SELECT t.*, u.nombre AS usuario_nombre FROM turnos t
       JOIN usuarios u ON u.id = t.usuario_id WHERE t.id = ?`
    )
    .get(id) as Turno | undefined;
  return t ?? null;
}

export function abrirTurno(usuarioId: string, fondoInicial: number): Turno {
  const maxRow = db.prepare('SELECT COALESCE(MAX(numero),0) AS max FROM turnos').get() as {
    max: number;
  };
  const t: Turno = {
    id: randomUUID(),
    numero: maxRow.max + 1,
    usuario_id: usuarioId,
    apertura_at: nowUTC(),
    fondo_inicial: fondoInicial,
    cierre_at: null,
    efectivo_contado: null,
    total_ventas: null,
    total_efectivo: null,
    cantidad_tickets: null,
    esperado_efectivo: null,
    diferencia: null,
    estado: 'abierto',
    synced_at: null,
    created_at: nowUTC(),
  };
  db.prepare(
    `INSERT INTO turnos (id, numero, usuario_id, apertura_at, fondo_inicial, estado, synced_at, created_at)
     VALUES (@id, @numero, @usuario_id, @apertura_at, @fondo_inicial, @estado, @synced_at, @created_at)`
  ).run({
    id: t.id,
    numero: t.numero,
    usuario_id: t.usuario_id,
    apertura_at: t.apertura_at,
    fondo_inicial: t.fondo_inicial,
    estado: t.estado,
    synced_at: t.synced_at,
    created_at: t.created_at,
  });
  return t;
}

/** Totales en vivo del turno (ventas completadas atadas al turno). */
export function resumenTurno(turnoId: string): {
  total_ventas: number;
  total_efectivo: number;
  cantidad_tickets: number;
} {
  const r = db
    .prepare(
      `SELECT
         COALESCE(SUM(total),0) AS total_ventas,
         COALESCE(SUM(CASE WHEN metodo_pago='efectivo' THEN total ELSE 0 END),0) AS total_efectivo,
         COUNT(*) AS cantidad_tickets
       FROM ventas WHERE turno_id = ? AND estado = 'completada'`
    )
    .get(turnoId) as { total_ventas: number; total_efectivo: number; cantidad_tickets: number };
  return r;
}

export function cerrarTurno(turnoId: string, efectivoContado: number): Turno {
  const abierto = obtenerTurno(turnoId);
  if (!abierto) throw new Error('Turno no encontrado');
  if (abierto.estado === 'cerrado') throw new Error('El turno ya está cerrado');

  const res = resumenTurno(turnoId);
  const esperado = abierto.fondo_inicial + res.total_efectivo;
  const diferencia = efectivoContado - esperado;

  db.prepare(
    `UPDATE turnos SET cierre_at=@cierre_at, efectivo_contado=@efectivo_contado,
       total_ventas=@total_ventas, total_efectivo=@total_efectivo, cantidad_tickets=@cantidad_tickets,
       esperado_efectivo=@esperado_efectivo, diferencia=@diferencia, estado='cerrado'
     WHERE id=@id`
  ).run({
    id: turnoId,
    cierre_at: nowUTC(),
    efectivo_contado: efectivoContado,
    total_ventas: res.total_ventas,
    total_efectivo: res.total_efectivo,
    cantidad_tickets: res.cantidad_tickets,
    esperado_efectivo: esperado,
    diferencia,
  });

  return obtenerTurno(turnoId)!;
}

export function listarTurnos(rango: RangoFechas): Turno[] {
  return db
    .prepare(
      `SELECT t.*, u.nombre AS usuario_nombre FROM turnos t
       JOIN usuarios u ON u.id = t.usuario_id
       WHERE t.apertura_at >= ? AND t.apertura_at <= ?
       ORDER BY t.numero DESC`
    )
    .all(rango.desde, rango.hasta) as Turno[];
}

export function obtenerVenta(id: string): VentaConItems | null {
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(id) as Venta | undefined;
  if (!venta) return null;
  const items = db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(id) as VentaItem[];
  return { ...venta, items };
}

export function listarVentas(rango: RangoFechas): VentaConItems[] {
  const ventas = db
    .prepare('SELECT * FROM ventas WHERE fecha >= ? AND fecha <= ? ORDER BY numero DESC')
    .all(rango.desde, rango.hasta) as Venta[];
  const getItems = db.prepare('SELECT * FROM venta_items WHERE venta_id = ?');
  return ventas.map((v) => ({ ...v, items: getItems.all(v.id) as VentaItem[] }));
}

// ---------------------------------------------------------------------------
// Métricas (agregación local)
// ---------------------------------------------------------------------------

export function metricasResumen(rango: RangoFechas): MetricasResumen {
  const totalRow = db
    .prepare(
      "SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS n FROM ventas WHERE estado='completada' AND fecha >= ? AND fecha <= ?"
    )
    .get(rango.desde, rango.hasta) as { total: number; n: number };

  const totalVendido = totalRow.total;
  const cantidadTickets = totalRow.n;
  const ticketPromedio = cantidadTickets > 0 ? totalVendido / cantidadTickets : 0;

  // Agregación por día (fecha local del cajero). SQLite guarda UTC ISO;
  // convertimos con 'localtime' para agrupar por el día real del negocio.
  const porDia = db
    .prepare(
      `SELECT date(fecha, 'localtime') AS fecha, SUM(total) AS total, COUNT(*) AS tickets
       FROM ventas WHERE estado='completada' AND fecha >= ? AND fecha <= ?
       GROUP BY date(fecha, 'localtime') ORDER BY fecha`
    )
    .all(rango.desde, rango.hasta) as { fecha: string; total: number; tickets: number }[];

  // Comparativa mensual: todos los meses con ventas (independiente del rango,
  // para ver la evolución mes a mes que es el objetivo principal).
  const porMes = db
    .prepare(
      `SELECT strftime('%Y-%m', fecha, 'localtime') AS mes, SUM(total) AS total, COUNT(*) AS tickets
       FROM ventas WHERE estado='completada'
       GROUP BY mes ORDER BY mes`
    )
    .all() as { mes: string; total: number; tickets: number }[];

  // Ventas por hora del día (hora local del negocio).
  const porHora = db
    .prepare(
      `SELECT strftime('%H', fecha, 'localtime') AS hora, SUM(total) AS total, COUNT(*) AS tickets
       FROM ventas WHERE estado='completada' AND fecha >= ? AND fecha <= ?
       GROUP BY hora ORDER BY hora`
    )
    .all(rango.desde, rango.hasta) as { hora: string; total: number; tickets: number }[];

  const topProductos = db
    .prepare(
      `SELECT vi.nombre_producto AS nombre, SUM(vi.cantidad) AS cantidad, SUM(vi.subtotal) AS totalDinero
       FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id
       WHERE v.estado='completada' AND v.fecha >= ? AND v.fecha <= ?
       GROUP BY vi.nombre_producto ORDER BY totalDinero DESC LIMIT 15`
    )
    .all(rango.desde, rango.hasta) as { nombre: string; cantidad: number; totalDinero: number }[];

  const porMetodoPago = db
    .prepare(
      `SELECT metodo_pago AS metodo, SUM(total) AS total, COUNT(*) AS tickets
       FROM ventas WHERE estado='completada' AND fecha >= ? AND fecha <= ?
       GROUP BY metodo_pago ORDER BY total DESC`
    )
    .all(rango.desde, rango.hasta) as { metodo: MetodoPago; total: number; tickets: number }[];

  return {
    totalVendido,
    cantidadTickets,
    ticketPromedio,
    porDia,
    porMes,
    porHora,
    topProductos,
    porMetodoPago,
  };
}

/**
 * Desglose cronológico: cada artículo vendido con su hora, ticket y método de pago.
 * Responde "qué se vendió, a qué hora y qué artículo fue".
 */
export function itemsDetalle(rango: RangoFechas): DetalleItemVendido[] {
  return db
    .prepare(
      `SELECT v.fecha AS fecha, v.numero AS venta_numero, v.metodo_pago AS metodo_pago,
              vi.nombre_producto AS nombre_producto, vi.tipo_venta_usado AS tipo_venta_usado,
              vi.cantidad AS cantidad, vi.unidad AS unidad, vi.subtotal AS subtotal
       FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id
       WHERE v.estado='completada' AND v.fecha >= ? AND v.fecha <= ?
       ORDER BY v.fecha DESC`
    )
    .all(rango.desde, rango.hasta) as DetalleItemVendido[];
}

// ---------------------------------------------------------------------------
// Export CSV
// ---------------------------------------------------------------------------

const escCSV = (s: unknown) => {
  const str = String(s ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const fechaLocalSolo = (iso: string) => new Date(iso).toLocaleDateString('es-AR');
const horaLocalSolo = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * CSV de VENTAS con toda la info: una fila por artículo vendido, con datos del
 * ticket, turno, empleada, fecha/hora local, método de pago y montos.
 */
export function exportarCSV(rango: RangoFechas): string {
  const rows = db
    .prepare(
      `SELECT v.numero AS ticket, v.fecha AS fecha, v.estado AS estado, v.metodo_pago AS metodo_pago,
              v.total AS total_ticket, v.monto_recibido AS monto_recibido, v.vuelto AS vuelto,
              t.numero AS turno_numero, u.nombre AS empleada,
              vi.nombre_producto AS producto, vi.tipo_venta_usado AS tipo,
              vi.cantidad AS cantidad, vi.unidad AS unidad,
              vi.precio_unitario_aplicado AS precio_unitario, vi.subtotal AS subtotal
       FROM ventas v
       JOIN venta_items vi ON vi.venta_id = v.id
       LEFT JOIN turnos t ON t.id = v.turno_id
       LEFT JOIN usuarios u ON u.id = v.usuario_id
       WHERE v.fecha >= ? AND v.fecha <= ?
       ORDER BY v.fecha, v.numero`
    )
    .all(rango.desde, rango.hasta) as Array<{
    ticket: number;
    fecha: string;
    estado: string;
    metodo_pago: string;
    total_ticket: number;
    monto_recibido: number | null;
    vuelto: number | null;
    turno_numero: number | null;
    empleada: string | null;
    producto: string;
    tipo: string;
    cantidad: number;
    unidad: string;
    precio_unitario: number;
    subtotal: number;
  }>;

  const cols = [
    'ticket', 'fecha', 'hora', 'estado', 'turno', 'empleada', 'metodo_pago',
    'producto', 'tipo', 'cantidad', 'unidad', 'precio_unitario', 'subtotal',
    'total_ticket', 'monto_recibido', 'vuelto',
  ];
  const filas: string[] = [cols.join(',')];
  for (const r of rows) {
    filas.push(
      [
        r.ticket,
        fechaLocalSolo(r.fecha),
        horaLocalSolo(r.fecha),
        r.estado,
        r.turno_numero ?? '',
        escCSV(r.empleada ?? ''),
        r.metodo_pago,
        escCSV(r.producto),
        r.tipo,
        r.cantidad,
        r.unidad,
        r.precio_unitario,
        r.subtotal,
        r.total_ticket,
        r.monto_recibido ?? '',
        r.vuelto ?? '',
      ].join(',')
    );
  }
  return filas.join('\n');
}

/** CSV de CIERRES DE CAJA (turnos): un renglón por turno con su arqueo. */
export function exportarTurnosCSV(rango: RangoFechas): string {
  const turnos = listarTurnos(rango);
  const cols = [
    'turno', 'empleada', 'apertura', 'cierre', 'estado', 'fondo_inicial',
    'cantidad_tickets', 'total_ventas', 'total_efectivo', 'esperado_efectivo',
    'efectivo_contado', 'diferencia',
  ];
  const filas: string[] = [cols.join(',')];
  for (const t of turnos) {
    filas.push(
      [
        t.numero,
        escCSV(t.usuario_nombre ?? ''),
        `${fechaLocalSolo(t.apertura_at)} ${horaLocalSolo(t.apertura_at)}`,
        t.cierre_at ? `${fechaLocalSolo(t.cierre_at)} ${horaLocalSolo(t.cierre_at)}` : '',
        t.estado,
        t.fondo_inicial,
        t.cantidad_tickets ?? '',
        t.total_ventas ?? '',
        t.total_efectivo ?? '',
        t.esperado_efectivo ?? '',
        t.efectivo_contado ?? '',
        t.diferencia ?? '',
      ].join(',')
    );
  }
  return filas.join('\n');
}

// ---------------------------------------------------------------------------
// Seed de prueba
// ---------------------------------------------------------------------------

function seed(): void {
  const now = nowUTC();
  const cats: Categoria[] = [
    { id: randomUUID(), nombre: 'Panadería', color: '#d97706', emoji: '🥖', orden: 1, activo: 1, created_at: now },
    { id: randomUUID(), nombre: 'Pastelería', color: '#db2777', emoji: '🎂', orden: 2, activo: 1, created_at: now },
    { id: randomUUID(), nombre: 'Facturas', color: '#ca8a04', emoji: '🥐', orden: 3, activo: 1, created_at: now },
  ];
  const insCat = db.prepare(
    'INSERT INTO categorias (id, nombre, color, emoji, orden, activo, created_at) VALUES (@id,@nombre,@color,@emoji,@orden,@activo,@created_at)'
  );
  cats.forEach((c) => insCat.run(c));

  const [pan, pastel, fact] = cats;

  const prods: Array<Partial<Producto> & { nombre: string }> = [
    { nombre: 'Pan francés', categoria_id: pan.id, tipo_venta: 'peso', precio_kg: 2200, emoji: '🥖' },
    { nombre: 'Pan de campo', categoria_id: pan.id, tipo_venta: 'peso', precio_kg: 3500, emoji: '🍞' },
    { nombre: 'Pan lactal', categoria_id: pan.id, tipo_venta: 'unidad', precio_unidad: 2800, emoji: '🍞' },
    { nombre: 'Medialuna', categoria_id: fact.id, tipo_venta: 'unidad', precio_unidad: 600, emoji: '🥐' },
    { nombre: 'Factura surtida', categoria_id: fact.id, tipo_venta: 'ambos', precio_unidad: 600, precio_kg: 9000, emoji: '🥐' },
    { nombre: 'Vigilante', categoria_id: fact.id, tipo_venta: 'unidad', precio_unidad: 700, emoji: '🥯' },
    { nombre: 'Torta de chocolate', categoria_id: pastel.id, tipo_venta: 'unidad', precio_unidad: 35000, emoji: '🍫' },
    { nombre: 'Torta helada', categoria_id: pastel.id, tipo_venta: 'unidad', precio_unidad: 28000, emoji: '🍰' },
    { nombre: 'Alfajor de maicena', categoria_id: pastel.id, tipo_venta: 'unidad', precio_unidad: 900, emoji: '🍪' },
    { nombre: 'Masas finas', categoria_id: pastel.id, tipo_venta: 'peso', precio_kg: 12000, emoji: '🧁' },
    { nombre: 'Grisines', categoria_id: pan.id, tipo_venta: 'peso', precio_kg: 4000, emoji: '🥨' },
  ];

  prods.forEach((p, i) =>
    crearProducto({
      nombre: p.nombre,
      categoria_id: p.categoria_id ?? null,
      tipo_venta: (p.tipo_venta as Producto['tipo_venta']) ?? 'unidad',
      precio_unidad: p.precio_unidad ?? null,
      precio_kg: p.precio_kg ?? null,
      emoji: p.emoji ?? '🥐',
      color: null,
      orden: i,
    })
  );
}
