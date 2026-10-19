// Tipos compartidos entre el proceso main y el renderer (React).
// Mantener sincronizado con el esquema SQLite en electron/db.ts.

export type TipoVenta = 'unidad' | 'peso' | 'ambos';
export type UnidadItem = 'u' | 'g' | 'kg';
export type MetodoPago = 'efectivo' | 'debito' | 'credito' | 'qr' | 'transferencia';
export type EstadoVenta = 'completada' | 'anulada';
export type Rol = 'admin' | 'empleada';
export type EstadoTurno = 'abierto' | 'cerrado';

export interface Categoria {
  id: string;
  nombre: string;
  color: string;
  emoji: string;
  orden: number;
  activo: number; // 0 | 1
  created_at: string; // ISO UTC
}

export interface Producto {
  id: string;
  nombre: string;
  categoria_id: string | null;
  tipo_venta: TipoVenta;
  precio_unidad: number | null;
  precio_kg: number | null;
  emoji: string;
  color: string | null;
  orden: number;
  activo: number; // 0 | 1
  created_at: string;
  updated_at: string;
}

export interface VentaItem {
  id: string;
  venta_id: string;
  producto_id: string | null;
  nombre_producto: string;
  tipo_venta_usado: 'unidad' | 'peso';
  cantidad: number;
  unidad: UnidadItem;
  precio_unitario_aplicado: number;
  subtotal: number;
}

export interface Venta {
  id: string;
  numero: number;
  fecha: string; // ISO UTC
  total: number;
  metodo_pago: MetodoPago;
  monto_recibido: number | null;
  vuelto: number | null;
  estado: EstadoVenta;
  turno_id: string | null;
  usuario_id: string | null;
  anulada_por: string | null; // nombre de quien anuló
  anulada_at: string | null; // ISO UTC
  synced_at: string | null;
}

export interface VentaConItems extends Venta {
  items: VentaItem[];
}

// ----- Payloads IPC -----

export interface NuevoProducto {
  nombre: string;
  categoria_id: string | null;
  tipo_venta: TipoVenta;
  precio_unidad: number | null;
  precio_kg: number | null;
  emoji: string;
  color: string | null;
  orden?: number;
}

export interface NuevaCategoria {
  nombre: string;
  color: string;
  emoji: string;
  orden?: number;
}

// Ítem del carrito tal como llega desde el renderer al crear la venta.
export interface CarritoItemInput {
  producto_id: string | null;
  nombre_producto: string;
  tipo_venta_usado: 'unidad' | 'peso';
  cantidad: number;
  unidad: UnidadItem;
  precio_unitario_aplicado: number;
  subtotal: number;
}

export interface NuevaVenta {
  items: CarritoItemInput[];
  total: number;
  metodo_pago: MetodoPago;
  monto_recibido: number | null;
  vuelto: number | null;
}

// ----- Usuarios / Turnos / Sesión -----

export interface Usuario {
  id: string;
  nombre: string;
  usuario: string | null; // login del admin; NULL en empleadas
  rol: Rol;
  activo: number; // 0 | 1
  created_at: string;
}

export interface Turno {
  id: string;
  numero: number;
  usuario_id: string;
  usuario_nombre?: string; // join para mostrar
  apertura_at: string; // ISO UTC
  fondo_inicial: number;
  cierre_at: string | null;
  fondo_cierre: number | null; // fondo que se deja en la caja al cerrar
  efectivo_contado: number | null;
  total_ventas: number | null; // snapshot al cerrar
  total_efectivo: number | null; // ventas efectivo del turno
  cantidad_tickets: number | null;
  esperado_efectivo: number | null; // fondo + total_efectivo
  diferencia: number | null; // contado - esperado
  estado: EstadoTurno;
  synced_at: string | null;
  created_at: string;
}

// Info mínima del turno para la empleada (SIN montos de ventas).
export interface TurnoActualEmpleada {
  id: string;
  numero: number;
  apertura_at: string;
  fondo_inicial: number;
  cantidad_tickets: number;
  de_otro_dia: boolean; // se abrió otro día (hora local): hay que cerrarlo antes de vender
}

export interface Sesion {
  usuario_id: string;
  nombre: string;
  rol: Rol;
  turno_id: string | null;
  turno_retomado: boolean; // al loguearse ya había un turno abierto (no lo abrió en esta sesión)
}

export interface EstadoInicial {
  necesitaSetup: boolean; // true si todavía no hay admin
}

export interface SetupAdmin {
  nombre: string;
  usuario: string;
  password: string;
}

export interface NuevaEmpleada {
  nombre: string;
  pin: string; // 4 dígitos
}

// ----- Pedidos -----

export type EstadoPedido = 'pendiente' | 'entregado' | 'cancelado';

export interface PedidoItem {
  id: string;
  pedido_id: string;
  producto_id: string | null;
  nombre_producto: string;
  tipo_venta_usado: 'unidad' | 'peso';
  cantidad: number;
  unidad: UnidadItem;
  precio_unitario_aplicado: number;
  subtotal: number;
}

export interface Pedido {
  id: string;
  numero: number;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_direccion: string | null;
  fecha_entrega: string; // yyyy-mm-dd (fecha local)
  hora_entrega: string | null; // HH:MM
  notas: string | null;
  total: number; // precios congelados al tomar el pedido
  estado: EstadoPedido;
  usuario_id: string | null; // quién lo tomó
  usuario_nombre?: string; // join para mostrar
  entregado_at: string | null;
  entregado_por: string | null;
  cancelado_at: string | null;
  cancelado_por: string | null;
  created_at: string;
  synced_at: string | null;
}

// Cobro asociado a un pedido (seña o saldo). Cada uno es una venta del turno.
export interface PagoDePedido {
  venta_id: string;
  venta_numero: number;
  fecha: string;
  monto: number;
  metodo_pago: MetodoPago;
}

export interface PedidoConItems extends Pedido {
  items: PedidoItem[];
  pagos: PagoDePedido[];
  pagado: number; // suma de las ventas completadas del pedido
  saldo: number; // total - pagado
}

export interface PagoPedidoInput {
  monto: number;
  metodo_pago: MetodoPago;
  monto_recibido: number | null; // solo efectivo (para el vuelto)
}

export interface NuevoPedido {
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_direccion: string | null;
  fecha_entrega: string;
  hora_entrega: string | null;
  notas: string | null;
  items: CarritoItemInput[];
  pago: PagoPedidoInput | null; // seña o pago total (null/0 = sin pago)
}

export interface FiltroPedidos {
  estado: EstadoPedido;
  busqueda?: string;
}

export type CopiaTicketPedido = 'cliente' | 'local';

// ----- Reparto -----
// Todo lo que vende un repartidor es del local, pero va por FUERA de la caja del
// local (no toca turnos ni el Z). Se carga una liquidación con lo que trae en el
// papel; cada cliente del reparto tiene cuenta corriente (vendido - cobrado).

export type MetodoCobroReparto = 'efectivo' | 'transferencia';
export type UnidadReparto = 'kg' | 'u';

export interface Repartidor {
  id: string;
  nombre: string;
  telefono: string | null;
  activo: number; // 0 | 1
  created_at: string;
}

export interface ClienteReparto {
  id: string;
  repartidor_id: string;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  activo: number; // 0 | 1
  created_at: string;
  ultimos_precios: Record<string, number>; // nombre_producto -> último precio que se le cobró
  saldo: number | null; // lo que debe; null si quien consulta no es Administración
}

export interface LineaRepartoInput {
  cliente_id: string;
  producto_id: string | null;
  nombre_producto: string;
  unidad: UnidadReparto;
  cantidad: number; // kg (con decimales) o unidades
  precio_unitario: number; // $/kg o $/unidad
  subtotal: number;
}

export interface CobroRepartoInput {
  cliente_id: string;
  monto: number;
  metodo: MetodoCobroReparto;
}

export interface NuevaLiquidacion {
  repartidor_id: string;
  fecha: string; // yyyy-mm-dd: día del reparto
  items: LineaRepartoInput[];
  cobros: CobroRepartoInput[];
  efectivo_entregado: number | null; // lo que entregó en mano (null = no se registró)
  notas: string | null;
}

export interface Liquidacion {
  id: string;
  numero: number;
  repartidor_id: string;
  repartidor_nombre: string;
  fecha: string;
  total_vendido: number;
  cobrado_efectivo: number;
  cobrado_transferencia: number;
  efectivo_entregado: number | null;
  diferencia: number | null; // entregado - cobrado en efectivo
  notas: string | null;
  estado: 'confirmada' | 'anulada';
  cargado_por: string | null;
  anulada_por: string | null;
  anulada_at: string | null;
  created_at: string;
}

export interface LiquidacionDetalle extends Liquidacion {
  items: (LineaRepartoInput & { id: string; cliente_nombre: string })[];
  cobros: (CobroRepartoInput & { id: string; cliente_nombre: string })[];
}

export interface CuentaCliente {
  cliente_id: string;
  cliente_nombre: string;
  repartidor_id: string;
  repartidor_nombre: string;
  vendido: number;
  cobrado: number;
  saldo: number;
  ultimo_movimiento: string | null; // yyyy-mm-dd
}

export interface MovimientoCuenta {
  fecha: string; // yyyy-mm-dd
  tipo: 'venta' | 'cobro';
  detalle: string;
  monto: number;
  liquidacion_numero: number | null;
}

export interface RangoDias {
  desde: string; // yyyy-mm-dd (incluido)
  hasta: string; // yyyy-mm-dd (incluido)
}

export interface MetricasReparto {
  totalVendido: number;
  kilos: number;
  unidades: number;
  cobradoEfectivo: number;
  cobradoTransferencia: number;
  diferenciaEfectivo: number; // suma de diferencias (negativo = faltó plata)
  liquidaciones: number;
  deudaClientes: number; // saldo total actual (no depende del período)
  porRepartidor: { repartidor: string; vendido: number; kilos: number; cobrado: number; diferencia: number; liquidaciones: number }[];
  porMes: { mes: string; vendido: number; cobrado: number; kilos: number }[];
  topClientes: { cliente: string; repartidor: string; vendido: number; kilos: number }[];
  topProductos: { producto: string; kilos: number; unidades: number; vendido: number }[];
}

// ----- Balanza -----

export type ProtocoloBalanza = 'estable' | 'continuo' | 'torrey' | 'cas';

export interface ConfigBalanza {
  puerto: string; // ej. COM3 o /dev/tty.usbserial
  baudRate: number;
  dataBits: 5 | 6 | 7 | 8;
  parity: 'none' | 'even' | 'odd' | 'mark' | 'space';
  stopBits: 1 | 2;
  protocolo: ProtocoloBalanza;
  byteSolicitud: number; // ej. 0x05
  decimales: number; // decimales que muestra el visor (para parseo)
  timeoutMs: number;
}

export interface LecturaPeso {
  gramos: number;
  estable: boolean;
  ok: boolean;
  error?: string;
  crudo?: string; // representación hex de la trama, útil para debug
}

export interface TramaDiagnostico {
  ts: string;
  hex: string;
  ascii: string;
}

// ----- Impresora / Negocio -----

export interface ConfigNegocio {
  nombre: string;
  direccion: string;
  cuit: string;
  mensajePie: string;
  alias: string; // alias/CBU para transferencias (se imprime en el ticket)
  logoPath: string | null; // ruta a la imagen del logo (opcional)
}

export interface ConfigImpresora {
  tipo: 'epson' | 'star';
  interfaz: string; // ej. "printer:XP-58" | "//localhost/XP-58" | "/dev/usb/lp0"
  ancho: number; // caracteres por línea (58mm ≈ 32)
  habilitada: boolean;
}

export interface ConfigSync {
  url: string; // endpoint de la Edge Function push
  token: string; // token del dispositivo
  habilitado: boolean;
}

export interface AppConfig {
  negocio: ConfigNegocio;
  impresora: ConfigImpresora;
  balanza: ConfigBalanza;
  sync: ConfigSync;
}

export interface EstadoSync {
  habilitado: boolean;
  pendientesVentas: number;
  pendientesTurnos: number;
  pendientesPedidos: number;
  pendientesReparto: number;
  ultimaSync: string | null; // ISO local
  ultimoError: string | null;
}

// ----- Métricas -----

export interface RangoFechas {
  desde: string; // ISO UTC
  hasta: string; // ISO UTC
}

export interface MetricasResumen {
  totalVendido: number;
  cantidadTickets: number;
  ticketPromedio: number;
  porDia: { fecha: string; total: number; tickets: number }[];
  porMes: { mes: string; total: number; tickets: number }[];
  porHora: { hora: string; total: number; tickets: number }[]; // hora local 00–23
  topProductos: { nombre: string; cantidad: number; totalDinero: number }[];
  porMetodoPago: { metodo: MetodoPago; total: number; tickets: number }[];
}

// Fila del desglose "qué se vendió, a qué hora y qué artículo".
export interface DetalleItemVendido {
  fecha: string; // ISO UTC de la venta
  venta_numero: number;
  nombre_producto: string;
  tipo_venta_usado: 'unidad' | 'peso';
  cantidad: number;
  unidad: UnidadItem;
  subtotal: number;
  metodo_pago: MetodoPago;
}

// Respuesta genérica de las operaciones IPC.
export interface Resultado<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
