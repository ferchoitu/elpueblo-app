import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer';
import fs from 'node:fs';
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

function buildPrinter() {
  const cfg = getImpresora();
  return new ThermalPrinter({
    type: cfg.tipo === 'star' ? PrinterTypes.STAR : PrinterTypes.EPSON,
    interface: cfg.interfaz,
    characterSet: CharacterSet.PC858_EURO,
    removeSpecialCharacters: false,
    width: cfg.ancho,
    options: { timeout: 4000 },
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

    const okConn = await p.isPrinterConnected();
    if (!okConn) {
      return {
        ok: false,
        error: `No se detecta la impresora en "${cfgImp.interfaz}". Revisá la configuración.`,
      };
    }
    await p.execute();
    return { ok: true };
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

    const okConn = await p.isPrinterConnected();
    if (!okConn) {
      return { ok: false, error: `No se detecta la impresora en "${cfgImp.interfaz}".` };
    }
    await p.execute();
    return { ok: true };
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

    const okConn = await p.isPrinterConnected();
    if (!okConn) {
      return { ok: false, error: `No se detecta la impresora en "${cfgImp.interfaz}".` };
    }
    await p.execute();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
