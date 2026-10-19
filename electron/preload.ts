import { contextBridge, ipcRenderer } from 'electron';
import type {
  Categoria,
  Producto,
  NuevoProducto,
  NuevaCategoria,
  NuevaVenta,
  VentaConItems,
  Venta,
  RangoFechas,
  MetricasResumen,
  LecturaPeso,
  TramaDiagnostico,
  ConfigBalanza,
  AppConfig,
  ConfigNegocio,
  ConfigImpresora,
  Resultado,
  Sesion,
  EstadoInicial,
  SetupAdmin,
  Usuario,
  Turno,
  TurnoActualEmpleada,
  DetalleItemVendido,
  ConfigSync,
  EstadoSync,
  NuevoPedido,
  PedidoConItems,
  PagoPedidoInput,
  FiltroPedidos,
  CopiaTicketPedido,
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

// API segura expuesta al renderer. Todo pasa por IPC hacia el proceso main.
const api = {
  productos: {
    listar: (): Promise<Producto[]> => ipcRenderer.invoke('productos:listar'),
    crear: (p: NuevoProducto): Promise<Resultado<Producto>> =>
      ipcRenderer.invoke('productos:crear', p),
    editar: (id: string, cambios: Partial<NuevoProducto> & { activo?: number }): Promise<Resultado<void>> =>
      ipcRenderer.invoke('productos:editar', id, cambios),
    borrar: (id: string): Promise<Resultado<void>> => ipcRenderer.invoke('productos:borrar', id),
  },
  categorias: {
    listar: (): Promise<Categoria[]> => ipcRenderer.invoke('categorias:listar'),
    crear: (c: NuevaCategoria): Promise<Resultado<Categoria>> =>
      ipcRenderer.invoke('categorias:crear', c),
    editar: (id: string, cambios: Partial<NuevaCategoria> & { activo?: number }): Promise<Resultado<void>> =>
      ipcRenderer.invoke('categorias:editar', id, cambios),
  },
  venta: {
    crear: (v: NuevaVenta): Promise<Resultado<VentaConItems>> =>
      ipcRenderer.invoke('venta:crear', v),
    anularUltima: (): Promise<Resultado<Venta | null>> =>
      ipcRenderer.invoke('venta:anularUltima'),
    anular: (ventaId: string): Promise<Resultado<void>> =>
      ipcRenderer.invoke('venta:anular', ventaId),
  },
  auth: {
    estadoInicial: (): Promise<EstadoInicial> => ipcRenderer.invoke('auth:estadoInicial'),
    sesion: (): Promise<Sesion | null> => ipcRenderer.invoke('auth:sesion'),
    setupAdmin: (d: SetupAdmin): Promise<Resultado<{ recoveryCode: string }>> =>
      ipcRenderer.invoke('auth:setupAdmin', d),
    loginAdmin: (usuario: string, password: string): Promise<Resultado<Sesion>> =>
      ipcRenderer.invoke('auth:loginAdmin', usuario, password),
    loginEmpleada: (usuarioId: string, pin: string): Promise<Resultado<Sesion>> =>
      ipcRenderer.invoke('auth:loginEmpleada', usuarioId, pin),
    logout: (): Promise<Resultado<void>> => ipcRenderer.invoke('auth:logout'),
    resetAdmin: (usuario: string, code: string, nueva: string): Promise<Resultado<void>> =>
      ipcRenderer.invoke('auth:resetAdmin', usuario, code, nueva),
    cambiarPassword: (actual: string, nueva: string): Promise<Resultado<void>> =>
      ipcRenderer.invoke('auth:cambiarPassword', actual, nueva),
  },
  usuarios: {
    listarEmpleadas: (): Promise<Usuario[]> => ipcRenderer.invoke('usuarios:listarEmpleadas'),
    crearEmpleada: (nombre: string, pin: string): Promise<Resultado<void>> =>
      ipcRenderer.invoke('usuarios:crearEmpleada', nombre, pin),
    cambiarPin: (id: string, pin: string): Promise<Resultado<void>> =>
      ipcRenderer.invoke('usuarios:cambiarPin', id, pin),
    editar: (id: string, cambios: { nombre?: string; activo?: number }): Promise<Resultado<void>> =>
      ipcRenderer.invoke('usuarios:editar', id, cambios),
  },
  pedidos: {
    listar: (f: FiltroPedidos): Promise<Resultado<PedidoConItems[]>> => ipcRenderer.invoke('pedidos:listar', f),
    crear: (p: NuevoPedido): Promise<Resultado<PedidoConItems>> => ipcRenderer.invoke('pedidos:crear', p),
    entregar: (id: string, pago: PagoPedidoInput | null): Promise<Resultado<PedidoConItems>> =>
      ipcRenderer.invoke('pedidos:entregar', id, pago),
    cancelar: (id: string): Promise<Resultado<void>> => ipcRenderer.invoke('pedidos:cancelar', id),
    imprimir: (id: string, copias: CopiaTicketPedido[]): Promise<Resultado<void>> =>
      ipcRenderer.invoke('pedidos:imprimir', id, copias),
  },
  reparto: {
    repartidores: (incluirInactivos?: boolean): Promise<Resultado<Repartidor[]>> =>
      ipcRenderer.invoke('reparto:repartidores', incluirInactivos),
    crearRepartidor: (nombre: string, telefono: string | null): Promise<Resultado<Repartidor>> =>
      ipcRenderer.invoke('reparto:crearRepartidor', nombre, telefono),
    editarRepartidor: (id: string, cambios: { nombre?: string; telefono?: string | null; activo?: number }): Promise<Resultado<void>> =>
      ipcRenderer.invoke('reparto:editarRepartidor', id, cambios),
    clientes: (repartidorId: string, incluirInactivos?: boolean): Promise<Resultado<ClienteReparto[]>> =>
      ipcRenderer.invoke('reparto:clientes', repartidorId, incluirInactivos),
    crearCliente: (c: { repartidor_id: string; nombre: string; telefono?: string | null; direccion?: string | null }): Promise<Resultado<ClienteReparto>> =>
      ipcRenderer.invoke('reparto:crearCliente', c),
    editarCliente: (id: string, cambios: { nombre?: string; telefono?: string | null; direccion?: string | null; activo?: number }): Promise<Resultado<void>> =>
      ipcRenderer.invoke('reparto:editarCliente', id, cambios),
    crearLiquidacion: (n: NuevaLiquidacion): Promise<Resultado<LiquidacionDetalle>> =>
      ipcRenderer.invoke('reparto:crearLiquidacion', n),
    liquidaciones: (rango: RangoDias, repartidorId?: string | null): Promise<Resultado<Liquidacion[]>> =>
      ipcRenderer.invoke('reparto:liquidaciones', rango, repartidorId),
    liquidacion: (id: string): Promise<Resultado<LiquidacionDetalle | null>> => ipcRenderer.invoke('reparto:liquidacion', id),
    anularLiquidacion: (id: string): Promise<Resultado<void>> => ipcRenderer.invoke('reparto:anularLiquidacion', id),
    cuentas: (repartidorId?: string | null): Promise<Resultado<CuentaCliente[]>> => ipcRenderer.invoke('reparto:cuentas', repartidorId),
    movimientos: (clienteId: string): Promise<Resultado<MovimientoCuenta[]>> => ipcRenderer.invoke('reparto:movimientos', clienteId),
    registrarCobro: (clienteId: string, monto: number, metodo: MetodoCobroReparto, fecha: string): Promise<Resultado<void>> =>
      ipcRenderer.invoke('reparto:registrarCobro', clienteId, monto, metodo, fecha),
    metricas: (rango: RangoDias): Promise<Resultado<MetricasReparto>> => ipcRenderer.invoke('reparto:metricas', rango),
  },
  turno: {
    actual: (): Promise<TurnoActualEmpleada | null> => ipcRenderer.invoke('turno:actual'),
    abrir: (fondoInicial: number): Promise<Resultado<{ id: string; numero: number }>> =>
      ipcRenderer.invoke('turno:abrir', fondoInicial),
    cerrar: (): Promise<
      Resultado<{ numero: number; ticketImpreso: boolean; errorImpresion?: string }>
    > => ipcRenderer.invoke('turno:cerrar'),
    registrarConteo: (turnoId: string, efectivoContado: number): Promise<Resultado<Turno>> =>
      ipcRenderer.invoke('turno:registrarConteo', turnoId, efectivoContado),
    listar: (rango: { desde: string; hasta: string }): Promise<Turno[]> =>
      ipcRenderer.invoke('turnos:listar', rango),
    reimprimirZ: (turnoId: string): Promise<Resultado<void>> =>
      ipcRenderer.invoke('turnos:reimprimirZ', turnoId),
    exportarCSV: (rango: RangoFechas): Promise<Resultado<string>> =>
      ipcRenderer.invoke('turnos:exportarCSV', rango),
  },
  balanza: {
    pedirPeso: (): Promise<LecturaPeso> => ipcRenderer.invoke('balanza:pedirPeso'),
    listarPuertos: (): Promise<{ path: string; manufacturer?: string }[]> =>
      ipcRenderer.invoke('balanza:listarPuertos'),
    iniciarDiagnostico: (): Promise<Resultado<void>> =>
      ipcRenderer.invoke('balanza:iniciarDiagnostico'),
    detenerDiagnostico: (): Promise<void> => ipcRenderer.invoke('balanza:detenerDiagnostico'),
    onTrama: (cb: (t: TramaDiagnostico) => void): (() => void) => {
      const listener = (_: unknown, t: TramaDiagnostico) => cb(t);
      ipcRenderer.on('balanza:trama', listener);
      return () => ipcRenderer.off('balanza:trama', listener);
    },
  },
  ticket: {
    imprimir: (venta: VentaConItems): Promise<Resultado<void>> =>
      ipcRenderer.invoke('ticket:imprimir', venta),
    reimprimirUltimo: (): Promise<Resultado<number>> =>
      ipcRenderer.invoke('ticket:reimprimirUltimo'),
    reimprimir: (ventaId: string): Promise<Resultado<void>> =>
      ipcRenderer.invoke('ticket:reimprimir', ventaId),
  },
  metricas: {
    resumen: (rango: RangoFechas): Promise<MetricasResumen> =>
      ipcRenderer.invoke('metricas:resumen', rango),
  },
  ventas: {
    listar: (rango: RangoFechas): Promise<VentaConItems[]> =>
      ipcRenderer.invoke('ventas:listar', rango),
    itemsDetalle: (rango: RangoFechas): Promise<DetalleItemVendido[]> =>
      ipcRenderer.invoke('ventas:itemsDetalle', rango),
    exportarCSV: (rango: RangoFechas): Promise<Resultado<string>> =>
      ipcRenderer.invoke('ventas:exportarCSV', rango),
  },
  config: {
    obtener: (): Promise<AppConfig> => ipcRenderer.invoke('config:obtener'),
    guardarNegocio: (v: ConfigNegocio): Promise<Resultado<void>> =>
      ipcRenderer.invoke('config:guardarNegocio', v),
    guardarImpresora: (v: ConfigImpresora): Promise<Resultado<void>> =>
      ipcRenderer.invoke('config:guardarImpresora', v),
    listarImpresoras: (): Promise<{ name: string; displayName: string; isDefault: boolean }[]> =>
      ipcRenderer.invoke('impresora:listar'),
    probarImpresora: (): Promise<Resultado<void>> => ipcRenderer.invoke('impresora:probar'),
    guardarBalanza: (v: ConfigBalanza): Promise<Resultado<void>> =>
      ipcRenderer.invoke('config:guardarBalanza', v),
    elegirLogo: (): Promise<Resultado<{ path: string; dataUrl: string | null } | null>> =>
      ipcRenderer.invoke('config:elegirLogo'),
    quitarLogo: (): Promise<Resultado<void>> => ipcRenderer.invoke('config:quitarLogo'),
    logoDataUrl: (): Promise<string | null> => ipcRenderer.invoke('config:logoDataUrl'),
    rutaBackup: (): Promise<Resultado<string>> => ipcRenderer.invoke('config:rutaBackup'),
    hacerBackup: (): Promise<Resultado<string>> => ipcRenderer.invoke('config:hacerBackup'),
    guardarSync: (v: ConfigSync): Promise<Resultado<void>> =>
      ipcRenderer.invoke('config:guardarSync', v),
  },
  sync: {
    ahora: (): Promise<{ ok: boolean; ventas?: number; turnos?: number; pedidos?: number; error?: string }> =>
      ipcRenderer.invoke('sync:ahora'),
    estado: (): Promise<EstadoSync> => ipcRenderer.invoke('sync:estado'),
  },
  // El main avisa cuando se intentó cerrar la app con una empleada con turno
  // abierto: hay que forzar el cierre de caja antes de poder salir.
  onForzarCierreCaja: (cb: () => void): (() => void) => {
    const listener = () => cb();
    ipcRenderer.on('forzar-cierre-caja', listener);
    return () => ipcRenderer.off('forzar-cierre-caja', listener);
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;
