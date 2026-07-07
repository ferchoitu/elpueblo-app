import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as db from './db';
import * as balanza from './balanza';
import * as auth from './auth';
import { imprimirTicket, imprimirCierreZ } from './impresora';
import { configurarAutoUpdate } from './updater';
import {
  getAppConfig,
  setNegocio,
  setImpresora,
  setBalanza,
} from './config';
import type {
  NuevoProducto,
  NuevaCategoria,
  NuevaVenta,
  RangoFechas,
  VentaConItems,
  ConfigNegocio,
  ConfigImpresora,
  ConfigBalanza,
  SetupAdmin,
} from '../shared/types';

const __dirnameLocal = path.dirname(fileURLToPath(import.meta.url));

// vite-plugin-electron define estas variables de entorno.
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
const DIST = path.join(__dirnameLocal, '../dist');
const PRELOAD = path.join(__dirnameLocal, 'preload.mjs');

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0b0f14',
    autoHideMenuBar: true,
    webPreferences: {
      preload: fs.existsSync(PRELOAD) ? PRELOAD : path.join(__dirnameLocal, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // El preload es un módulo ESM (.mjs); requiere sandbox desactivado.
      sandbox: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(DIST, 'index.html'));
  }
}

// ---------------------------------------------------------------------------
// Registro de handlers IPC
// ---------------------------------------------------------------------------

function ok<T>(data?: T) {
  return { ok: true as const, data };
}
function fail(error: unknown) {
  return { ok: false as const, error: (error as Error)?.message ?? String(error) };
}

function registrarIPC() {
  // Productos
  ipcMain.handle('productos:listar', () => db.listarProductos());
  ipcMain.handle('productos:crear', (_e, p: NuevoProducto) => {
    try {
      return ok(db.crearProducto(p));
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('productos:editar', (_e, id: string, cambios) => {
    try {
      db.editarProducto(id, cambios);
      return ok();
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('productos:borrar', (_e, id: string) => {
    try {
      db.borrarProducto(id);
      return ok();
    } catch (e) {
      return fail(e);
    }
  });

  // Categorías
  ipcMain.handle('categorias:listar', () => db.listarCategorias());
  ipcMain.handle('categorias:crear', (_e, c: NuevaCategoria) => {
    try {
      return ok(db.crearCategoria(c));
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('categorias:editar', (_e, id: string, cambios) => {
    try {
      db.editarCategoria(id, cambios);
      return ok();
    } catch (e) {
      return fail(e);
    }
  });

  // Ventas
  ipcMain.handle('venta:crear', (_e, v: NuevaVenta) => {
    try {
      const s = auth.requireSesion();
      if (!s.turno_id) throw new Error('Abrí un turno antes de cobrar');
      return ok(db.crearVenta(v, s.turno_id, s.usuario_id));
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('venta:anularUltima', () => {
    try {
      const s = auth.requireSesion();
      // La empleada sólo puede anular su última venta del turno en curso;
      // el admin puede anular la última venta global.
      const ultima = s.rol === 'admin' ? db.ultimaVenta() : db.ultimaVenta(s.turno_id);
      if (!ultima) return ok(null);
      db.anularVenta(ultima.id);
      return ok(ultima);
    } catch (e) {
      return fail(e);
    }
  });

  // Balanza
  ipcMain.handle('balanza:pedirPeso', () => {
    auth.requireSesion();
    return balanza.pedirPeso();
  });
  ipcMain.handle('balanza:listarPuertos', () => balanza.listarPuertos());
  ipcMain.handle('balanza:iniciarDiagnostico', async () => {
    try {
      auth.requireAdmin();
      const r = await balanza.iniciarDiagnostico((t) => {
        win?.webContents.send('balanza:trama', t);
      });
      return r.ok ? ok() : fail(r.error);
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('balanza:detenerDiagnostico', () => balanza.detenerDiagnostico());

  // Impresión
  ipcMain.handle('ticket:imprimir', async (_e, venta: VentaConItems) => {
    try {
      const r = await imprimirTicket(venta);
      return r.ok ? ok() : fail(r.error);
    } catch (e) {
      return fail(e);
    }
  });

  // Métricas / ventas (sólo admin — datos de dinero blindados en el main)
  ipcMain.handle('metricas:resumen', (_e, rango: RangoFechas) => {
    auth.requireAdmin();
    return db.metricasResumen(rango);
  });
  ipcMain.handle('ventas:listar', (_e, rango: RangoFechas) => {
    auth.requireAdmin();
    return db.listarVentas(rango);
  });
  ipcMain.handle('ventas:itemsDetalle', (_e, rango: RangoFechas) => {
    auth.requireAdmin();
    return db.itemsDetalle(rango);
  });
  const guardarCSV = async (titulo: string, defecto: string, csv: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: titulo,
      defaultPath: defecto,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (canceled || !filePath) return ok('');
    fs.writeFileSync(filePath, '﻿' + csv, 'utf8'); // BOM para Excel
    return ok(filePath);
  };

  ipcMain.handle('ventas:exportarCSV', async (_e, rango: RangoFechas) => {
    try {
      auth.requireAdmin();
      return await guardarCSV(
        'Exportar ventas a CSV',
        `ventas-${rango.desde.slice(0, 10)}_a_${rango.hasta.slice(0, 10)}.csv`,
        db.exportarCSV(rango)
      );
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('turnos:exportarCSV', async (_e, rango: RangoFechas) => {
    try {
      auth.requireAdmin();
      return await guardarCSV(
        'Exportar cierres de caja a CSV',
        `cierres-${rango.desde.slice(0, 10)}_a_${rango.hasta.slice(0, 10)}.csv`,
        db.exportarTurnosCSV(rango)
      );
    } catch (e) {
      return fail(e);
    }
  });

  // Config (admin)
  ipcMain.handle('config:obtener', () => {
    auth.requireAdmin();
    return getAppConfig();
  });
  ipcMain.handle('config:guardarNegocio', (_e, v: ConfigNegocio) => {
    try {
      auth.requireAdmin();
      setNegocio(v);
      return ok();
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('config:guardarImpresora', (_e, v: ConfigImpresora) => {
    try {
      auth.requireAdmin();
      setImpresora(v);
      return ok();
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('config:guardarBalanza', (_e, v: ConfigBalanza) => {
    try {
      auth.requireAdmin();
      setBalanza(v);
      return ok();
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('config:rutaBackup', () => ok(db.dbPath()));
  ipcMain.handle('config:hacerBackup', async () => {
    try {
      auth.requireAdmin();
      const origen = db.dbPath();
      const { canceled, filePath } = await dialog.showSaveDialog(win!, {
        title: 'Guardar copia de la base de datos',
        defaultPath: `delpueblo-backup-${new Date().toISOString().slice(0, 10)}.db`,
        filters: [{ name: 'SQLite', extensions: ['db'] }],
      });
      if (canceled || !filePath) return ok('');
      fs.copyFileSync(origen, filePath);
      return ok(filePath);
    } catch (e) {
      return fail(e);
    }
  });

  // ---- Autenticación / sesión ----
  ipcMain.handle('auth:estadoInicial', () => auth.estadoInicial());
  ipcMain.handle('auth:sesion', () => auth.getSesion());
  ipcMain.handle('auth:setupAdmin', (_e, d: SetupAdmin) => {
    try {
      return ok(auth.setupAdmin(d));
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('auth:loginAdmin', (_e, usuario: string, password: string) => {
    try {
      return ok(auth.loginAdmin(usuario, password));
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('auth:loginEmpleada', (_e, usuarioId: string, pin: string) => {
    try {
      return ok(auth.loginEmpleada(usuarioId, pin));
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('auth:logout', () => {
    auth.logout();
    return ok();
  });
  ipcMain.handle('auth:resetAdmin', (_e, usuario: string, code: string, nueva: string) => {
    try {
      auth.resetAdmin(usuario, code, nueva);
      return ok();
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('auth:cambiarPassword', (_e, actual: string, nueva: string) => {
    try {
      auth.cambiarPasswordAdmin(actual, nueva);
      return ok();
    } catch (e) {
      return fail(e);
    }
  });

  // ---- Usuarios / empleadas (admin) ----
  ipcMain.handle('usuarios:listarEmpleadas', () => db.listarUsuarios('empleada'));
  ipcMain.handle('usuarios:crearEmpleada', (_e, nombre: string, pin: string) => {
    try {
      auth.crearEmpleada(nombre, pin);
      return ok();
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('usuarios:cambiarPin', (_e, id: string, pin: string) => {
    try {
      auth.cambiarPinEmpleada(id, pin);
      return ok();
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('usuarios:editar', (_e, id: string, cambios: { nombre?: string; activo?: number }) => {
    try {
      auth.editarUsuario(id, cambios);
      return ok();
    } catch (e) {
      return fail(e);
    }
  });

  // ---- Turnos ----
  ipcMain.handle('turno:actual', () => {
    const s = auth.getSesion();
    if (!s || !s.turno_id) return null;
    const t = db.obtenerTurno(s.turno_id);
    if (!t) return null;
    const res = db.resumenTurno(t.id);
    // La empleada NO recibe montos; sólo datos operativos del turno.
    return {
      id: t.id,
      numero: t.numero,
      apertura_at: t.apertura_at,
      fondo_inicial: t.fondo_inicial,
      cantidad_tickets: res.cantidad_tickets,
    };
  });
  ipcMain.handle('turno:abrir', (_e, fondoInicial: number) => {
    try {
      const s = auth.requireSesion();
      if (s.turno_id) throw new Error('Ya tenés un turno abierto');
      const t = db.abrirTurno(s.usuario_id, fondoInicial);
      auth.setTurnoEnSesion(t.id);
      return ok({ id: t.id, numero: t.numero });
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('turno:cerrar', async (_e, efectivoRetirado: number, fondoCierre: number) => {
    try {
      const s = auth.requireSesion();
      if (!s.turno_id) throw new Error('No hay turno abierto');
      const turno = db.cerrarTurno(s.turno_id, efectivoRetirado, fondoCierre);
      auth.setTurnoEnSesion(null);
      // Ticket Z ciego si la cierra una empleada; completo si es admin.
      const imp = await imprimirCierreZ(turno, { ciego: s.rol === 'empleada' });
      // No devolvemos montos a la empleada (cierre a ciegas).
      return ok({ numero: turno.numero, ticketImpreso: imp.ok, errorImpresion: imp.error });
    } catch (e) {
      return fail(e);
    }
  });
  ipcMain.handle('turnos:listar', (_e, rango: RangoFechas) => {
    auth.requireAdmin();
    return db.listarTurnos(rango);
  });
  ipcMain.handle('turnos:reimprimirZ', async (_e, turnoId: string) => {
    try {
      auth.requireAdmin();
      const t = db.obtenerTurno(turnoId);
      if (!t) throw new Error('Turno no encontrado');
      if (t.estado !== 'cerrado') throw new Error('El turno todavía está abierto');
      const imp = await imprimirCierreZ(t, { ciego: false });
      return imp.ok ? ok() : fail(imp.error);
    } catch (e) {
      return fail(e);
    }
  });
}

// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  // CSP estricta sólo en la app empaquetada (en dev rompería el HMR de Vite).
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      cb({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; script-src 'self'",
          ],
        },
      });
    });
  }

  db.initDB();
  registrarIPC();
  createWindow();

  // Auto-actualización (sólo en la app instalada).
  if (app.isPackaged) configurarAutoUpdate(() => win);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  await balanza.cerrarPuerto().catch(() => {});
  if (process.platform !== 'darwin') app.quit();
});
