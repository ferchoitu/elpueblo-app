import { randomUUID } from 'node:crypto';
import { getDB } from './db';
import type {
  Repartidor,
  ClienteReparto,
  NuevaLiquidacion,
  Liquidacion,
  LiquidacionDetalle,
  CuentaCliente,
  MovimientoCuenta,
  MetodoCobroReparto,
  RangoDias,
  MetricasReparto,
} from '../shared/types';

// ===========================================================================
// Reparto. Lo que vende cada repartidor es del local pero va por FUERA de la
// caja del local: no crea ventas ni toca turnos. Se carga una liquidación con lo
// que trae en el papel (por cliente: lo vendido y lo cobrado) y cada cliente del
// reparto lleva cuenta corriente: saldo = vendido (liquidaciones confirmadas) -
// cobrado (cobros confirmados). Anular una liquidación anula también sus cobros.
// ===========================================================================

const nowUTC = () => new Date().toISOString();
const round2 = (n: number) => Math.round(n * 100) / 100;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Subconsultas de saldo por cliente (reutilizadas en varias consultas).
const VENDIDO_CLIENTE = `COALESCE((SELECT SUM(i.subtotal) FROM reparto_items i
  JOIN reparto_liquidaciones l ON l.id = i.liquidacion_id AND l.estado = 'confirmada'
  WHERE i.cliente_id = c.id), 0)`;
const COBRADO_CLIENTE = `COALESCE((SELECT SUM(x.monto) FROM reparto_cobros x
  WHERE x.cliente_id = c.id AND x.estado = 'confirmado'), 0)`;

// ---------------------------------------------------------------------------
// Repartidores y clientes
// ---------------------------------------------------------------------------

export function listarRepartidores(incluirInactivos = false): Repartidor[] {
  const db = getDB();
  return db
    .prepare(`SELECT id, nombre, telefono, activo, created_at FROM repartidores
              ${incluirInactivos ? '' : 'WHERE activo = 1'} ORDER BY nombre`)
    .all() as Repartidor[];
}

export function crearRepartidor(nombre: string, telefono: string | null): Repartidor {
  const db = getDB();
  const n = nombre?.trim();
  if (!n) throw new Error('Falta el nombre de quien hace el reparto');
  const r: Repartidor = { id: randomUUID(), nombre: n, telefono: telefono?.trim() || null, activo: 1, created_at: nowUTC() };
  db.prepare(
    'INSERT INTO repartidores (id, nombre, telefono, activo, created_at, synced_at) VALUES (@id, @nombre, @telefono, @activo, @created_at, NULL)'
  ).run(r);
  return r;
}

export function editarRepartidor(id: string, cambios: { nombre?: string; telefono?: string | null; activo?: number }): void {
  const db = getDB();
  const actual = db.prepare('SELECT * FROM repartidores WHERE id = ?').get(id) as Repartidor | undefined;
  if (!actual) throw new Error('No se encontró ese reparto');
  const nombre = cambios.nombre !== undefined ? cambios.nombre.trim() : actual.nombre;
  if (!nombre) throw new Error('Falta el nombre');
  db.prepare('UPDATE repartidores SET nombre = ?, telefono = ?, activo = ?, synced_at = NULL WHERE id = ?').run(
    nombre,
    cambios.telefono !== undefined ? cambios.telefono?.trim() || null : actual.telefono,
    cambios.activo ?? actual.activo,
    id
  );
}

/** Clientes del repartidor con el último precio cobrado por producto. El saldo solo si `conSaldo`. */
export function listarClientes(repartidorId: string, conSaldo: boolean, incluirInactivos = false): ClienteReparto[] {
  const db = getDB();
  const filas = db
    .prepare(
      `SELECT c.id, c.repartidor_id, c.nombre, c.telefono, c.direccion, c.activo, c.created_at,
              ${VENDIDO_CLIENTE} - ${COBRADO_CLIENTE} AS saldo
       FROM reparto_clientes c
       WHERE c.repartidor_id = ? ${incluirInactivos ? '' : 'AND c.activo = 1'}
       ORDER BY c.nombre`
    )
    .all(repartidorId) as (Omit<ClienteReparto, 'ultimos_precios'> & { saldo: number })[];

  // Último precio por (cliente, producto): la línea más reciente de una liquidación confirmada.
  const precios = db
    .prepare(
      `SELECT i.cliente_id, i.nombre_producto, i.precio_unitario
       FROM reparto_items i JOIN reparto_liquidaciones l ON l.id = i.liquidacion_id
       WHERE l.estado = 'confirmada' AND l.repartidor_id = ?
       ORDER BY l.fecha DESC, l.created_at DESC`
    )
    .all(repartidorId) as { cliente_id: string; nombre_producto: string; precio_unitario: number }[];
  const porCliente = new Map<string, Record<string, number>>();
  for (const p of precios) {
    const m = porCliente.get(p.cliente_id) ?? {};
    if (m[p.nombre_producto] === undefined) m[p.nombre_producto] = p.precio_unitario;
    porCliente.set(p.cliente_id, m);
  }

  return filas.map((c) => ({
    ...c,
    saldo: conSaldo ? round2(c.saldo) : null,
    ultimos_precios: porCliente.get(c.id) ?? {},
  }));
}

export function crearCliente(c: {
  repartidor_id: string;
  nombre: string;
  telefono?: string | null;
  direccion?: string | null;
}): ClienteReparto {
  const db = getDB();
  const nombre = c.nombre?.trim();
  if (!nombre) throw new Error('Falta el nombre del cliente');
  const rep = db.prepare('SELECT id FROM repartidores WHERE id = ?').get(c.repartidor_id);
  if (!rep) throw new Error('No se encontró ese reparto');
  const dup = db
    .prepare('SELECT id FROM reparto_clientes WHERE repartidor_id = ? AND lower(nombre) = lower(?) AND activo = 1')
    .get(c.repartidor_id, nombre);
  if (dup) throw new Error(`Ya hay un cliente "${nombre}" en este reparto`);
  const row = {
    id: randomUUID(),
    repartidor_id: c.repartidor_id,
    nombre,
    telefono: c.telefono?.trim() || null,
    direccion: c.direccion?.trim() || null,
    activo: 1,
    created_at: nowUTC(),
  };
  db.prepare(
    `INSERT INTO reparto_clientes (id, repartidor_id, nombre, telefono, direccion, activo, created_at, synced_at)
     VALUES (@id, @repartidor_id, @nombre, @telefono, @direccion, @activo, @created_at, NULL)`
  ).run(row);
  return { ...row, ultimos_precios: {}, saldo: null };
}

export function editarCliente(
  id: string,
  cambios: { nombre?: string; telefono?: string | null; direccion?: string | null; activo?: number }
): void {
  const db = getDB();
  const a = db.prepare('SELECT * FROM reparto_clientes WHERE id = ?').get(id) as ClienteReparto | undefined;
  if (!a) throw new Error('Cliente no encontrado');
  const nombre = cambios.nombre !== undefined ? cambios.nombre.trim() : a.nombre;
  if (!nombre) throw new Error('Falta el nombre del cliente');
  db.prepare(
    'UPDATE reparto_clientes SET nombre = ?, telefono = ?, direccion = ?, activo = ?, synced_at = NULL WHERE id = ?'
  ).run(
    nombre,
    cambios.telefono !== undefined ? cambios.telefono?.trim() || null : a.telefono,
    cambios.direccion !== undefined ? cambios.direccion?.trim() || null : a.direccion,
    cambios.activo ?? a.activo,
    id
  );
}

// ---------------------------------------------------------------------------
// Liquidaciones
// ---------------------------------------------------------------------------

export function crearLiquidacion(n: NuevaLiquidacion, usuarioId: string): LiquidacionDetalle {
  const db = getDB();
  const rep = db.prepare('SELECT id FROM repartidores WHERE id = ?').get(n.repartidor_id);
  if (!rep) throw new Error('Elegí quién hizo el reparto');
  if (!FECHA_RE.test(n.fecha ?? '')) throw new Error('Falta la fecha del reparto');
  const items = n.items ?? [];
  const cobros = (n.cobros ?? []).filter((c) => c.monto > 0);
  if (!items.length && !cobros.length) throw new Error('La liquidación está vacía');

  const clientesValidos = new Set(
    (db.prepare('SELECT id FROM reparto_clientes WHERE repartidor_id = ?').all(n.repartidor_id) as { id: string }[]).map(
      (c) => c.id
    )
  );
  for (const it of items) {
    if (!clientesValidos.has(it.cliente_id)) throw new Error('Hay un cliente que no es de este reparto');
    if (!it.nombre_producto?.trim()) throw new Error('Hay una línea sin producto');
    if (!(it.cantidad > 0)) throw new Error(`Falta la cantidad de "${it.nombre_producto}"`);
    if (!Number.isFinite(it.precio_unitario) || it.precio_unitario < 0) {
      throw new Error(`Precio inválido en "${it.nombre_producto}"`);
    }
    if (it.unidad !== 'kg' && it.unidad !== 'u') throw new Error('Unidad inválida');
  }
  for (const c of cobros) {
    if (!clientesValidos.has(c.cliente_id)) throw new Error('Hay un cobro de un cliente que no es de este reparto');
    if (c.metodo !== 'efectivo' && c.metodo !== 'transferencia') throw new Error('Método de cobro inválido');
  }

  // El subtotal se recalcula acá: no se confía en el que manda la pantalla.
  const lineas = items.map((it) => ({ ...it, subtotal: round2(it.cantidad * it.precio_unitario) }));
  const total = round2(lineas.reduce((a, it) => a + it.subtotal, 0));
  const efectivo = round2(cobros.filter((c) => c.metodo === 'efectivo').reduce((a, c) => a + c.monto, 0));
  const transf = round2(cobros.filter((c) => c.metodo === 'transferencia').reduce((a, c) => a + c.monto, 0));
  const entregado = n.efectivo_entregado == null ? null : round2(n.efectivo_entregado);
  if (entregado != null && (!Number.isFinite(entregado) || entregado < 0)) throw new Error('Efectivo entregado inválido');

  const tx = db.transaction((): string => {
    const maxRow = db.prepare('SELECT COALESCE(MAX(numero),0) AS max FROM reparto_liquidaciones').get() as { max: number };
    const id = randomUUID();
    const ahora = nowUTC();
    db.prepare(
      `INSERT INTO reparto_liquidaciones (id, numero, repartidor_id, fecha, total_vendido, cobrado_efectivo,
         cobrado_transferencia, efectivo_entregado, diferencia, notas, estado, usuario_id, created_at, synced_at)
       VALUES (@id, @numero, @repartidor_id, @fecha, @total, @efectivo, @transf, @entregado, @diferencia, @notas,
         'confirmada', @usuario_id, @created_at, NULL)`
    ).run({
      id,
      numero: maxRow.max + 1,
      repartidor_id: n.repartidor_id,
      fecha: n.fecha,
      total,
      efectivo,
      transf,
      entregado,
      diferencia: entregado == null ? null : round2(entregado - efectivo),
      notas: n.notas?.trim() || null,
      usuario_id: usuarioId,
      created_at: ahora,
    });
    const insItem = db.prepare(
      `INSERT INTO reparto_items (id, liquidacion_id, cliente_id, producto_id, nombre_producto, unidad, cantidad, precio_unitario, subtotal)
       VALUES (@id, @liquidacion_id, @cliente_id, @producto_id, @nombre_producto, @unidad, @cantidad, @precio_unitario, @subtotal)`
    );
    for (const it of lineas) {
      insItem.run({ ...it, nombre_producto: it.nombre_producto.trim(), id: randomUUID(), liquidacion_id: id });
    }
    const insCobro = db.prepare(
      `INSERT INTO reparto_cobros (id, liquidacion_id, cliente_id, fecha, monto, metodo, estado, usuario_id, created_at, synced_at)
       VALUES (@id, @liquidacion_id, @cliente_id, @fecha, @monto, @metodo, 'confirmado', @usuario_id, @created_at, NULL)`
    );
    for (const c of cobros) {
      insCobro.run({
        id: randomUUID(),
        liquidacion_id: id,
        cliente_id: c.cliente_id,
        fecha: n.fecha,
        monto: round2(c.monto),
        metodo: c.metodo,
        usuario_id: usuarioId,
        created_at: ahora,
      });
    }
    return id;
  });

  return obtenerLiquidacion(tx())!;
}

const SELECT_LIQ = `SELECT l.id, l.numero, l.repartidor_id, r.nombre AS repartidor_nombre, l.fecha, l.total_vendido,
    l.cobrado_efectivo, l.cobrado_transferencia, l.efectivo_entregado, l.diferencia, l.notas, l.estado,
    u.nombre AS cargado_por, l.anulada_por, l.anulada_at, l.created_at
  FROM reparto_liquidaciones l
  JOIN repartidores r ON r.id = l.repartidor_id
  LEFT JOIN usuarios u ON u.id = l.usuario_id`;

export function obtenerLiquidacion(id: string): LiquidacionDetalle | null {
  const db = getDB();
  const l = db.prepare(`${SELECT_LIQ} WHERE l.id = ?`).get(id) as Liquidacion | undefined;
  if (!l) return null;
  const items = db
    .prepare(
      `SELECT i.id, i.cliente_id, c.nombre AS cliente_nombre, i.producto_id, i.nombre_producto, i.unidad, i.cantidad,
              i.precio_unitario, i.subtotal
       FROM reparto_items i JOIN reparto_clientes c ON c.id = i.cliente_id
       WHERE i.liquidacion_id = ? ORDER BY c.nombre, i.rowid`
    )
    .all(id) as LiquidacionDetalle['items'];
  const cobros = db
    .prepare(
      `SELECT x.id, x.cliente_id, c.nombre AS cliente_nombre, x.monto, x.metodo
       FROM reparto_cobros x JOIN reparto_clientes c ON c.id = x.cliente_id
       WHERE x.liquidacion_id = ? ORDER BY c.nombre`
    )
    .all(id) as LiquidacionDetalle['cobros'];
  return { ...l, items, cobros };
}

export function listarLiquidaciones(rango: RangoDias, repartidorId?: string | null): Liquidacion[] {
  const db = getDB();
  return db
    .prepare(
      `${SELECT_LIQ} WHERE l.fecha BETWEEN @desde AND @hasta ${repartidorId ? 'AND l.repartidor_id = @rep' : ''}
       ORDER BY l.fecha DESC, l.numero DESC`
    )
    .all({ desde: rango.desde, hasta: rango.hasta, rep: repartidorId ?? null }) as Liquidacion[];
}

export function anularLiquidacion(id: string, anuladaPor: string): void {
  const db = getDB();
  const l = db.prepare('SELECT estado FROM reparto_liquidaciones WHERE id = ?').get(id) as { estado: string } | undefined;
  if (!l) throw new Error('Liquidación no encontrada');
  if (l.estado === 'anulada') throw new Error('La liquidación ya está anulada');
  db.transaction(() => {
    db.prepare(
      "UPDATE reparto_liquidaciones SET estado = 'anulada', anulada_por = ?, anulada_at = ?, synced_at = NULL WHERE id = ?"
    ).run(anuladaPor, nowUTC(), id);
    db.prepare("UPDATE reparto_cobros SET estado = 'anulado', synced_at = NULL WHERE liquidacion_id = ?").run(id);
  })();
}

// ---------------------------------------------------------------------------
// Cuentas corrientes
// ---------------------------------------------------------------------------

/** Pago suelto de un cliente (fuera de una liquidación), ej: vino al local a pagar la deuda. */
export function registrarCobroSuelto(
  clienteId: string,
  monto: number,
  metodo: MetodoCobroReparto,
  fecha: string,
  usuarioId: string
): void {
  const db = getDB();
  if (!db.prepare('SELECT id FROM reparto_clientes WHERE id = ?').get(clienteId)) throw new Error('Cliente no encontrado');
  if (!(monto > 0)) throw new Error('El monto tiene que ser mayor a cero');
  if (metodo !== 'efectivo' && metodo !== 'transferencia') throw new Error('Método de cobro inválido');
  if (!FECHA_RE.test(fecha)) throw new Error('Fecha inválida');
  db.prepare(
    `INSERT INTO reparto_cobros (id, liquidacion_id, cliente_id, fecha, monto, metodo, estado, usuario_id, created_at, synced_at)
     VALUES (?, NULL, ?, ?, ?, ?, 'confirmado', ?, ?, NULL)`
  ).run(randomUUID(), clienteId, fecha, round2(monto), metodo, usuarioId, nowUTC());
}

export function cuentasClientes(repartidorId?: string | null): CuentaCliente[] {
  const db = getDB();
  const filas = db
    .prepare(
      `SELECT c.id AS cliente_id, c.nombre AS cliente_nombre, c.repartidor_id, r.nombre AS repartidor_nombre,
              ${VENDIDO_CLIENTE} AS vendido, ${COBRADO_CLIENTE} AS cobrado,
              (SELECT MAX(f) FROM (
                 SELECT l.fecha AS f FROM reparto_items i JOIN reparto_liquidaciones l ON l.id = i.liquidacion_id
                 WHERE i.cliente_id = c.id AND l.estado = 'confirmada'
                 UNION ALL
                 SELECT x.fecha FROM reparto_cobros x WHERE x.cliente_id = c.id AND x.estado = 'confirmado')) AS ultimo_movimiento
       FROM reparto_clientes c JOIN repartidores r ON r.id = c.repartidor_id
       WHERE c.activo = 1 ${repartidorId ? 'AND c.repartidor_id = @rep' : ''}`
    )
    .all({ rep: repartidorId ?? null }) as Omit<CuentaCliente, 'saldo'>[];
  return filas
    .map((f) => ({ ...f, vendido: round2(f.vendido), cobrado: round2(f.cobrado), saldo: round2(f.vendido - f.cobrado) }))
    .sort((a, b) => b.saldo - a.saldo || a.cliente_nombre.localeCompare(b.cliente_nombre));
}

export function movimientosCliente(clienteId: string): MovimientoCuenta[] {
  const db = getDB();
  const ventas = db
    .prepare(
      `SELECT l.fecha, l.numero, GROUP_CONCAT(i.nombre_producto || ' ' ||
                CASE WHEN i.unidad = 'kg' THEN i.cantidad || ' kg' ELSE 'x' || i.cantidad END, ', ') AS detalle,
              SUM(i.subtotal) AS monto, MAX(l.created_at) AS orden
       FROM reparto_items i JOIN reparto_liquidaciones l ON l.id = i.liquidacion_id
       WHERE i.cliente_id = ? AND l.estado = 'confirmada'
       GROUP BY l.id`
    )
    .all(clienteId) as { fecha: string; numero: number; detalle: string; monto: number; orden: string }[];
  const cobros = db
    .prepare(
      `SELECT x.fecha, l.numero, x.metodo, x.monto, x.created_at AS orden
       FROM reparto_cobros x LEFT JOIN reparto_liquidaciones l ON l.id = x.liquidacion_id
       WHERE x.cliente_id = ? AND x.estado = 'confirmado'`
    )
    .all(clienteId) as { fecha: string; numero: number | null; metodo: string; monto: number; orden: string }[];
  const movs = [
    ...ventas.map((v) => ({ m: { fecha: v.fecha, tipo: 'venta' as const, detalle: v.detalle, monto: round2(v.monto), liquidacion_numero: v.numero }, orden: v.orden })),
    ...cobros.map((c) => ({
      m: {
        fecha: c.fecha,
        tipo: 'cobro' as const,
        detalle: `Pago en ${c.metodo}${c.numero == null ? ' (en el local)' : ''}`,
        monto: round2(c.monto),
        liquidacion_numero: c.numero,
      },
      orden: c.orden,
    })),
  ];
  // Más nuevo primero; en el mismo día, la venta antes que el cobro.
  movs.sort((a, b) => b.m.fecha.localeCompare(a.m.fecha) || b.orden.localeCompare(a.orden) || (a.m.tipo === 'venta' ? -1 : 1));
  return movs.map((x) => x.m);
}

// ---------------------------------------------------------------------------
// Métricas (período por día del reparto)
// ---------------------------------------------------------------------------

export function metricasReparto(rango: RangoDias): MetricasReparto {
  const db = getDB();
  const p = { desde: rango.desde, hasta: rango.hasta };
  const LIQ = "l.estado = 'confirmada' AND l.fecha BETWEEN @desde AND @hasta";

  const tot = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_vendido),0) AS vendido, COALESCE(SUM(diferencia),0) AS dif
       FROM reparto_liquidaciones l WHERE ${LIQ}`
    )
    .get(p) as { n: number; vendido: number; dif: number };
  const cant = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN i.unidad='kg' THEN i.cantidad END),0) AS kilos,
              COALESCE(SUM(CASE WHEN i.unidad='u' THEN i.cantidad END),0) AS unidades
       FROM reparto_items i JOIN reparto_liquidaciones l ON l.id = i.liquidacion_id WHERE ${LIQ}`
    )
    .get(p) as { kilos: number; unidades: number };
  // Cobros por fecha del cobro (incluye pagos sueltos en el local).
  const cob = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN metodo='efectivo' THEN monto END),0) AS ef,
              COALESCE(SUM(CASE WHEN metodo='transferencia' THEN monto END),0) AS tr
       FROM reparto_cobros WHERE estado = 'confirmado' AND fecha BETWEEN @desde AND @hasta`
    )
    .get(p) as { ef: number; tr: number };

  const porRepartidor = db
    .prepare(
      `SELECT r.nombre AS repartidor,
              COALESCE((SELECT SUM(l.total_vendido) FROM reparto_liquidaciones l WHERE l.repartidor_id = r.id AND ${LIQ}),0) AS vendido,
              COALESCE((SELECT SUM(i.cantidad) FROM reparto_items i JOIN reparto_liquidaciones l ON l.id = i.liquidacion_id
                        WHERE l.repartidor_id = r.id AND i.unidad = 'kg' AND ${LIQ}),0) AS kilos,
              COALESCE((SELECT SUM(x.monto) FROM reparto_cobros x JOIN reparto_clientes c ON c.id = x.cliente_id
                        WHERE c.repartidor_id = r.id AND x.estado = 'confirmado' AND x.fecha BETWEEN @desde AND @hasta),0) AS cobrado,
              COALESCE((SELECT SUM(l.diferencia) FROM reparto_liquidaciones l WHERE l.repartidor_id = r.id AND ${LIQ}),0) AS diferencia,
              (SELECT COUNT(*) FROM reparto_liquidaciones l WHERE l.repartidor_id = r.id AND ${LIQ}) AS liquidaciones
       FROM repartidores r ORDER BY vendido DESC`
    )
    .all(p) as MetricasReparto['porRepartidor'];

  const ventasMes = db
    .prepare(
      `SELECT substr(l.fecha,1,7) AS mes, SUM(i.subtotal) AS vendido,
              SUM(CASE WHEN i.unidad='kg' THEN i.cantidad ELSE 0 END) AS kilos
       FROM reparto_items i JOIN reparto_liquidaciones l ON l.id = i.liquidacion_id
       WHERE ${LIQ} GROUP BY 1`
    )
    .all(p) as { mes: string; vendido: number; kilos: number }[];
  const cobrosMes = db
    .prepare(
      `SELECT substr(fecha,1,7) AS mes, SUM(monto) AS cobrado FROM reparto_cobros
       WHERE estado = 'confirmado' AND fecha BETWEEN @desde AND @hasta GROUP BY 1`
    )
    .all(p) as { mes: string; cobrado: number }[];
  const meses = new Map<string, { mes: string; vendido: number; cobrado: number; kilos: number }>();
  for (const v of ventasMes) meses.set(v.mes, { mes: v.mes, vendido: round2(v.vendido), kilos: v.kilos, cobrado: 0 });
  for (const c of cobrosMes) {
    const m = meses.get(c.mes) ?? { mes: c.mes, vendido: 0, kilos: 0, cobrado: 0 };
    m.cobrado = round2(c.cobrado);
    meses.set(c.mes, m);
  }

  const topClientes = db
    .prepare(
      `SELECT c.nombre AS cliente, r.nombre AS repartidor, SUM(i.subtotal) AS vendido,
              SUM(CASE WHEN i.unidad='kg' THEN i.cantidad ELSE 0 END) AS kilos
       FROM reparto_items i
       JOIN reparto_liquidaciones l ON l.id = i.liquidacion_id
       JOIN reparto_clientes c ON c.id = i.cliente_id
       JOIN repartidores r ON r.id = c.repartidor_id
       WHERE ${LIQ} GROUP BY c.id ORDER BY vendido DESC LIMIT 15`
    )
    .all(p) as MetricasReparto['topClientes'];
  const topProductos = db
    .prepare(
      `SELECT i.nombre_producto AS producto,
              SUM(CASE WHEN i.unidad='kg' THEN i.cantidad ELSE 0 END) AS kilos,
              SUM(CASE WHEN i.unidad='u' THEN i.cantidad ELSE 0 END) AS unidades,
              SUM(i.subtotal) AS vendido
       FROM reparto_items i JOIN reparto_liquidaciones l ON l.id = i.liquidacion_id
       WHERE ${LIQ} GROUP BY i.nombre_producto ORDER BY vendido DESC LIMIT 15`
    )
    .all(p) as MetricasReparto['topProductos'];

  const deuda = cuentasClientes().reduce((a, c) => a + Math.max(0, c.saldo), 0);

  return {
    totalVendido: round2(tot.vendido),
    kilos: round2(cant.kilos),
    unidades: cant.unidades,
    cobradoEfectivo: round2(cob.ef),
    cobradoTransferencia: round2(cob.tr),
    diferenciaEfectivo: round2(tot.dif),
    liquidaciones: tot.n,
    deudaClientes: round2(deuda),
    porRepartidor: porRepartidor.filter((r) => r.liquidaciones > 0 || r.cobrado > 0),
    porMes: [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes)),
    topClientes,
    topProductos,
  };
}

// ---------------------------------------------------------------------------
// Sincronización a la nube (pendientes = synced_at IS NULL)
// ---------------------------------------------------------------------------

export function repartoPendientesCount(): number {
  const db = getDB();
  const n = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE synced_at IS NULL`).get() as { n: number }).n;
  return n('repartidores') + n('reparto_clientes') + n('reparto_liquidaciones') + n('reparto_cobros');
}

/** Lo pendiente de subir, en el shape de la nube. Las liquidaciones viajan con sus ítems. */
export function repartoPendientes(limite = 300) {
  const db = getDB();
  const repartidores = db
    .prepare('SELECT id, nombre, telefono, activo, created_at FROM repartidores WHERE synced_at IS NULL LIMIT ?')
    .all(limite) as any[];
  const clientes = db
    .prepare(
      `SELECT id, repartidor_id, nombre, telefono, direccion, activo, created_at
       FROM reparto_clientes WHERE synced_at IS NULL LIMIT ?`
    )
    .all(limite) as any[];
  const liquidaciones = db
    .prepare(
      `SELECT l.id, l.numero, l.repartidor_id, l.fecha, l.total_vendido, l.cobrado_efectivo, l.cobrado_transferencia,
              l.efectivo_entregado, l.diferencia, l.notas, l.estado, u.nombre AS cargado_por, l.anulada_por,
              l.anulada_at, l.created_at
       FROM reparto_liquidaciones l LEFT JOIN usuarios u ON u.id = l.usuario_id
       WHERE l.synced_at IS NULL ORDER BY l.created_at LIMIT ?`
    )
    .all(limite) as any[];
  const getItems = db.prepare(
    `SELECT id, cliente_id, nombre_producto AS producto_nombre, unidad, cantidad, precio_unitario, subtotal
     FROM reparto_items WHERE liquidacion_id = ?`
  );
  const cobros = db
    .prepare(
      `SELECT x.id, x.liquidacion_id, x.cliente_id, x.fecha, x.monto, x.metodo, x.estado, u.nombre AS cargado_por, x.created_at
       FROM reparto_cobros x LEFT JOIN usuarios u ON u.id = x.usuario_id
       WHERE x.synced_at IS NULL ORDER BY x.created_at LIMIT ?`
    )
    .all(limite) as any[];
  return {
    repartidores,
    clientes,
    liquidaciones: liquidaciones.map((l) => ({ ...l, items: getItems.all(l.id) })),
    cobros,
  };
}

export function marcarRepartoSincronizado(p: ReturnType<typeof repartoPendientes>): void {
  const db = getDB();
  const now = nowUTC();
  const marcar = (tabla: string, ids: string[]) => {
    const upd = db.prepare(`UPDATE ${tabla} SET synced_at = ? WHERE id = ?`);
    for (const id of ids) upd.run(now, id);
  };
  db.transaction(() => {
    marcar('repartidores', p.repartidores.map((r: any) => r.id));
    marcar('reparto_clientes', p.clientes.map((c: any) => c.id));
    marcar('reparto_liquidaciones', p.liquidaciones.map((l: any) => l.id));
    marcar('reparto_cobros', p.cobros.map((c: any) => c.id));
  })();
}
