import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { VentaConItems, Turno } from '../shared/types';
import { getImpresora, getNegocio } from './config';

// ===========================================================================
// Impresión de tickets en Xprinter 58mm (ESC/POS, compatible Epson).
// 58mm ≈ 32 caracteres por línea (fuente A).
// Impresión directa y silenciosa (sin diálogo), disparada tras la venta.
// ===========================================================================

const money = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });

function cantidadTexto(cantidad: number, unidad: string): string {
  if (unidad === 'g') return `${cantidad} g`;
  if (unidad === 'kg') return `${cantidad} kg`;
  return `x${cantidad}`;
}

// node-thermal-printer se usa SOLO para armar el buffer ESC/POS (es JS puro).
// El envío a la impresora lo hacemos nosotros (ver enviarBuffer), así evitamos
// depender de un módulo nativo del spooler que hay que compilar en cada plataforma.
// La interfaz que le pasamos es un marcador de tipo File: nunca llamamos execute(),
// solo getBuffer(), así que no toca el disco ni necesita driver.
function buildPrinter() {
  const cfg = getImpresora();
  return new ThermalPrinter({
    type: cfg.tipo === 'star' ? PrinterTypes.STAR : PrinterTypes.EPSON,
    interface: 'buffer', // marcador: solo usamos getBuffer(), nunca execute()
    characterSet: CharacterSet.PC858_EURO,
    removeSpecialCharacters: false,
    width: cfg.ancho,
    options: { timeout: 4000 },
  });
}

// Manda los bytes ESC/POS ya armados a la impresora según la interfaz configurada:
//   - "printer:NOMBRE"   -> impresora instalada del sistema (Windows: spooler RAW
//                           vía PowerShell/winspool; Mac/Linux: CUPS `lp -o raw`).
//   - "tcp://host:puerto" -> impresora de red (socket crudo, puerto 9100 por defecto).
//   - otra cosa          -> se trata como ruta de dispositivo/archivo (ej: /dev/usb/lp0).
async function enviarBuffer(
  interfaz: string,
  p: ThermalPrinter
): Promise<{ ok: boolean; error?: string }> {
  const buf = p.getBuffer();
  const iface = interfaz.trim();

  const printerMatch = /^printer:(.+)$/i.exec(iface);
  if (printerMatch) {
    return enviarAImpresoraSistema(printerMatch[1].trim(), buf);
  }

  const tcpMatch = /^tcp:\/\/([^/:]+)(?::(\d+))?/i.exec(iface);
  if (tcpMatch) {
    return enviarPorSocket(tcpMatch[1], Number(tcpMatch[2] ?? 9100), buf);
  }

  // Ruta de dispositivo/archivo.
  try {
    await fs.promises.writeFile(iface, buf);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `No se pudo escribir en "${iface}": ${(e as Error).message}` };
  }
}

// Impresora de red: abrir socket, mandar los bytes, cerrar.
function enviarPorSocket(host: string, puerto: number, buf: Buffer): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port: puerto });
    sock.setTimeout(5000);
    sock.on('connect', () => sock.end(buf));
    sock.on('close', () => resolve({ ok: true }));
    sock.on('timeout', () => {
      sock.destroy();
      resolve({ ok: false, error: `Tiempo de espera agotado conectando a ${host}:${puerto}.` });
    });
    sock.on('error', (e) => resolve({ ok: false, error: `No se pudo conectar a ${host}:${puerto}: ${e.message}` }));
  });
}

// Impresora instalada del sistema: manda bytes RAW al spooler.
async function enviarAImpresoraSistema(nombre: string, buf: Buffer): Promise<{ ok: boolean; error?: string }> {
  const tmp = path.join(os.tmpdir(), `ticket-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
  await fs.promises.writeFile(tmp, buf);
  try {
    return process.platform === 'win32'
      ? await enviarWindows(nombre, tmp)
      : await enviarCups(nombre, tmp);
  } finally {
    fs.promises.unlink(tmp).catch(() => {});
  }
}

// Windows: PowerShell + winspool (WritePrinter) manda los bytes crudos al spooler,
// sin depender de ningún módulo nativo de Node. El nombre de la impresora y la ruta
// del archivo van por variables de entorno para evitar inyección en el script.
function enviarWindows(nombre: string, archivo: string): Promise<{ ok: boolean; error?: string }> {
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class DpRaw {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
  }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)] public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOW di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)] public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
  public static void Send(string printerName, byte[] bytes) {
    IntPtr h;
    if (!OpenPrinter(printerName, out h, IntPtr.Zero)) throw new Exception("No se pudo abrir la impresora '" + printerName + "' (error " + Marshal.GetLastWin32Error() + ")");
    try {
      DOCINFOW di = new DOCINFOW(); di.pDocName = "Ticket DEL PUEBLO"; di.pDatatype = "RAW";
      if (!StartDocPrinter(h, 1, di)) throw new Exception("StartDocPrinter fallo (" + Marshal.GetLastWin32Error() + ")");
      try {
        StartPagePrinter(h);
        int written = 0;
        if (!WritePrinter(h, bytes, bytes.Length, out written)) throw new Exception("WritePrinter fallo (" + Marshal.GetLastWin32Error() + ")");
        EndPagePrinter(h);
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}
'@
[DpRaw]::Send($env:DP_PRINTER, [System.IO.File]::ReadAllBytes($env:DP_FILE))
`;
  const b64 = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve) => {
    const ps = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', b64],
      { env: { ...process.env, DP_PRINTER: nombre, DP_FILE: archivo } }
    );
    let err = '';
    ps.stderr.on('data', (d) => (err += d.toString()));
    ps.on('error', (e) => resolve({ ok: false, error: `No se pudo ejecutar PowerShell: ${e.message}` }));
    ps.on('close', (code) => {
      if (code === 0) return resolve({ ok: true });
      const limpio = err.replace(/\s+/g, ' ').trim().slice(0, 300);
      resolve({ ok: false, error: limpio || `PowerShell terminó con código ${code}.` });
    });
  });
}

// Mac/Linux (desarrollo): CUPS con datatype RAW.
function enviarCups(nombre: string, archivo: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const lp = spawn('lp', ['-d', nombre, '-o', 'raw', archivo]);
    let err = '';
    lp.stderr.on('data', (d) => (err += d.toString()));
    lp.on('error', (e) => resolve({ ok: false, error: `No se pudo ejecutar lp: ${e.message}` }));
    lp.on('close', (code) => (code === 0 ? resolve({ ok: true }) : resolve({ ok: false, error: err.trim() || `lp terminó con código ${code}.` })));
  });
}

export async function imprimirTicket(
  venta: VentaConItems
): Promise<{ ok: boolean; error?: string }> {
  const cfgImp = getImpresora();
  if (!cfgImp.habilitada) {
    return { ok: false, error: 'Impresora deshabilitada en configuración.' };
  }

  const neg = getNegocio();
  const p = buildPrinter();

  try {
    p.alignCenter();
    // Logo (opcional). Si falla la impresión de la imagen, seguimos con el nombre.
    if (neg.logoPath && fs.existsSync(neg.logoPath)) {
      try {
        await p.printImage(neg.logoPath);
      } catch {
        /* sin logo, seguimos */
      }
    }
    p.bold(true);
    p.setTextDoubleHeight();
    p.println(neg.nombre);
    p.setTextNormal();
    p.bold(false);
    if (neg.direccion) p.println(neg.direccion);
    if (neg.cuit) p.println(`CUIT: ${neg.cuit}`);
    p.drawLine();

    p.alignLeft();
    const fecha = new Date(venta.fecha).toLocaleString('es-AR');
    p.println(`Ticket N: ${venta.numero}`);
    p.println(`Fecha: ${fecha}`);
    p.drawLine();

    // Ítems: nombre + cantidad a la izquierda, subtotal a la derecha.
    for (const it of venta.items) {
      p.println(it.nombre_producto);
      p.leftRight(`  ${cantidadTexto(it.cantidad, it.unidad)}`, money(it.subtotal));
    }
    p.drawLine();

    // TOTAL destacado (doble alto).
    p.alignRight();
    p.bold(true);
    p.setTextDoubleHeight();
    p.println(`TOTAL ${money(venta.total)}`);
    p.setTextNormal();
    p.bold(false);
    p.alignLeft();

    p.println(`Pago: ${venta.metodo_pago.toUpperCase()}`);
    if (venta.metodo_pago === 'efectivo' && venta.monto_recibido != null) {
      p.leftRight('Recibido', money(venta.monto_recibido));
      p.leftRight('Vuelto', money(venta.vuelto ?? 0));
    }

    // Alias para transferencias (si está configurado).
    if (neg.alias && neg.alias.trim()) {
      p.drawLine();
      p.alignCenter();
      p.println('Transferencias — Alias:');
      p.bold(true);
      p.println(neg.alias.trim());
      p.bold(false);
    }

    p.drawLine();
    p.alignCenter();
    p.println(neg.mensajePie || '¡Gracias por su compra!');
    p.newLine();
    p.cut();

    return await enviarBuffer(cfgImp.interfaz, p);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ===========================================================================
// Impresión de PRUEBA (para configurar la impresora desde el panel).
// ===========================================================================

export async function imprimirPrueba(): Promise<{ ok: boolean; error?: string }> {
  const cfgImp = getImpresora();
  if (!cfgImp.habilitada) return { ok: false, error: 'La impresora está deshabilitada.' };
  const neg = getNegocio();
  const p = buildPrinter();
  try {
    p.alignCenter();
    p.bold(true);
    p.setTextDoubleHeight();
    p.println(neg.nombre);
    p.setTextNormal();
    p.bold(false);
    p.drawLine();
    p.bold(true);
    p.println('PRUEBA DE IMPRESION');
    p.bold(false);
    p.println(new Date().toLocaleString('es-AR'));
    p.drawLine();
    p.alignLeft();
    p.println(`Interfaz: ${cfgImp.interfaz}`);
    p.println(`Ancho: ${cfgImp.ancho} caracteres`);
    p.drawLine();
    p.alignCenter();
    p.println('Si estas leyendo esto, la');
    p.println('impresora quedo configurada OK.');
    p.newLine();
    p.cut();

    return await enviarBuffer(cfgImp.interfaz, p);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ===========================================================================
// Ticket de CIERRE DE CAJA (Z).
//   - ciego=true  (empleada): SIN montos de ventas ni esperado ni diferencia.
//   - ciego=false (admin, reimpresión): Z completo con esperado y diferencia.
// ===========================================================================

export async function imprimirCierreZ(
  turno: Turno,
  opts: { ciego: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const cfgImp = getImpresora();
  if (!cfgImp.habilitada) return { ok: false, error: 'Impresora deshabilitada en configuración.' };

  const neg = getNegocio();
  const p = buildPrinter();
  const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-AR') : '-');

  try {
    p.alignCenter();
    p.bold(true);
    p.println(neg.nombre);
    p.bold(false);
    p.println(opts.ciego ? 'CIERRE DE TURNO' : 'CIERRE DE CAJA (Z)');
    p.drawLine();

    p.alignLeft();
    p.println(`Turno N: ${turno.numero}`);
    p.println(`Empleada: ${turno.usuario_nombre ?? ''}`);
    p.println(`Apertura: ${hora(turno.apertura_at)}`);
    p.println(`Cierre:   ${hora(turno.cierre_at)}`);
    p.println(`Tickets:  ${turno.cantidad_tickets ?? 0}`);
    p.drawLine();

    const fondo = turno.fondo_inicial;
    p.leftRight('Fondo (queda en caja)', money(fondo));

    if (!opts.ciego) {
      // Z completo para el administrador.
      p.leftRight('Ventas totales', money(turno.total_ventas ?? 0));
      p.leftRight('Excedente esperado', money(turno.esperado_efectivo ?? turno.total_efectivo ?? 0));
      if (turno.efectivo_contado != null) {
        p.leftRight('Contado', money(turno.efectivo_contado));
        p.drawLine();
        p.bold(true);
        const dif = turno.diferencia ?? 0;
        const etiqueta = dif === 0 ? 'SIN DIFERENCIA' : dif > 0 ? 'SOBRANTE' : 'FALTANTE';
        p.leftRight(etiqueta, money(Math.abs(dif)));
        p.bold(false);
      } else {
        p.println('(pendiente de contar)');
      }
    } else {
      // Empleada: a ciegas, sin montos de ventas.
      p.newLine();
      p.alignCenter();
      p.println(`Dejá ${money(fondo)} de fondo en la caja.`);
      p.println('Guardá el excedente (las ventas)');
      p.println('junto a este ticket.');
    }

    p.drawLine();
    p.alignCenter();
    p.println('Firma: ______________________');
    p.newLine();
    p.cut();

    return await enviarBuffer(cfgImp.interfaz, p);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
