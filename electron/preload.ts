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
    ahora: (): Promise<{ ok: boolean; ventas?: number; turnos?: number; error?: string }> =>
      ipcRenderer.invoke('sync:ahora'),
    estado: (): Promise<EstadoSync> => ipcRenderer.invoke('sync:estado'),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;
