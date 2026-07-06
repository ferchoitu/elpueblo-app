import { SerialPort } from 'serialport';
import type { ConfigBalanza, LecturaPeso, TramaDiagnostico } from '../shared/types';
import { getBalanza } from './config';

// ===========================================================================
// Lectura de balanza Systel (Croma 30 V2) por RS-232 / adaptador USB.
//
// La trama exacta depende de cómo esté configurado el equipo puntual, por eso:
//   1) el parser es configurable por protocolo,
//   2) hay MODO DIAGNÓSTICO que muestra las tramas crudas para ajustar el parser
//      antes de fijarlo (equivale al software de prueba oficial de Systel).
//
// Protocolos soportados:
//   - 'estable'  : solicitud 0x05 (ENQ). Respuesta estable = STX + 6 ASCII (XX.XXX kg)
//                  + ETX + XOR. Respuesta inestable = 0x11. (protocolo primario)
//   - 'continuo' : solicitud 0x07. Respuesta siempre trae peso + byte 'e'/'i' + XOR.
//   - 'torrey'   : solicitud ASCII 'P' (respaldo compatibilidad).
//   - 'cas'      : solicitud ASCII 'W' (respaldo compatibilidad).
//
// Interpretación del peso (robusta a cómo esté configurado el visor):
//   si el número tiene separador decimal -> son kilos -> *1000 = gramos;
//   si es entero -> ya son gramos.
// ===========================================================================

let port: SerialPort | null = null;
let portKey = '';
let diagListener: ((d: Buffer) => void) | null = null;
let diagInterval: NodeJS.Timeout | null = null;

function keyOf(c: ConfigBalanza): string {
  return `${c.puerto}|${c.baudRate}|${c.dataBits}|${c.parity}|${c.stopBits}`;
}

export async function listarPuertos(): Promise<{ path: string; manufacturer?: string }[]> {
  try {
    const ports = await SerialPort.list();
    return ports.map((p) => ({ path: p.path, manufacturer: p.manufacturer }));
  } catch {
    return [];
  }
}

function abrirPuerto(c: ConfigBalanza): Promise<SerialPort> {
  return new Promise((resolve, reject) => {
    const p = new SerialPort(
      {
        path: c.puerto,
        baudRate: c.baudRate,
        dataBits: c.dataBits,
        parity: c.parity,
        stopBits: c.stopBits,
        autoOpen: true,
      },
      (err) => {
        if (err) return reject(err);
        port = p;
        portKey = keyOf(c);
        p.on('close', () => {
          if (port === p) {
            port = null;
            portKey = '';
          }
        });
        resolve(p);
      }
    );
  });
}

async function ensurePort(c: ConfigBalanza): Promise<SerialPort> {
  const key = keyOf(c);
  if (port && port.isOpen && key === portKey) return port;
  if (port && port.isOpen) await cerrarPuerto();
  return abrirPuerto(c);
}

export function cerrarPuerto(): Promise<void> {
  return new Promise((resolve) => {
    if (diagInterval) {
      clearInterval(diagInterval);
      diagInterval = null;
    }
    if (port && diagListener) port.off('data', diagListener);
    diagListener = null;
    if (port && port.isOpen) {
      port.close(() => resolve());
    } else {
      resolve();
    }
  });
}

function bytesSolicitud(c: ConfigBalanza): Buffer | null {
  switch (c.protocolo) {
    case 'estable':
      return Buffer.from([c.byteSolicitud ?? 0x05]);
    case 'continuo':
      return Buffer.from([0x07]);
    case 'torrey':
      return Buffer.from('P', 'ascii');
    case 'cas':
      return Buffer.from('W', 'ascii');
    default:
      return Buffer.from([c.byteSolicitud ?? 0x05]);
  }
}

/** Extrae el primer número de un texto y lo convierte a gramos. */
function parsearGramos(texto: string): number {
  const m = texto.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return NaN;
  const norm = m[0].replace(',', '.');
  const val = parseFloat(norm);
  if (Number.isNaN(val)) return NaN;
  // Con decimal => kilos; entero => ya son gramos.
  return norm.includes('.') ? Math.round(val * 1000) : Math.round(val);
}

function xorDe(bytes: Buffer): number {
  let x = 0;
  for (const b of bytes) x ^= b;
  return x;
}

type ParseResult = LecturaPeso | 'inestable' | null;

/** Intenta interpretar el buffer acumulado. null = trama incompleta. */
function intentarParsear(buf: Buffer, c: ConfigBalanza): ParseResult {
  const hex = buf.toString('hex');

  if (c.protocolo === 'estable') {
    if (buf.includes(0x11)) return 'inestable';
    const stx = buf.indexOf(0x02);
    const etx = stx >= 0 ? buf.indexOf(0x03, stx + 1) : -1;
    if (stx === -1 || etx === -1) return null;
    const xorByte = buf[etx + 1];
    if (xorByte === undefined) return null; // falta el byte de verificación
    const payload = buf.subarray(stx + 1, etx);
    const gramos = parsearGramos(payload.toString('ascii'));
    if (Number.isNaN(gramos)) return null;
    const xorOk = xorDe(payload) === xorByte;
    return {
      gramos,
      estable: true,
      ok: true,
      crudo: buf.subarray(stx, etx + 2).toString('hex'),
      error: xorOk ? undefined : 'Advertencia: XOR no coincide (revisar en diagnóstico)',
    };
  }

  const ascii = buf.toString('ascii');

  if (c.protocolo === 'continuo') {
    if (/i/i.test(ascii) && !/\d/.test(ascii.replace(/i/gi, ''))) return null;
    const gramos = parsearGramos(ascii);
    if (Number.isNaN(gramos)) return null;
    // 'i' = inestable, 'e' = estable.
    if (/i/i.test(ascii) && !/e/i.test(ascii)) {
      return { gramos, estable: false, ok: true, crudo: hex };
    }
    if (/e/i.test(ascii)) {
      return { gramos, estable: true, ok: true, crudo: hex };
    }
    return null; // esperando marcador de estabilidad
  }

  // torrey / cas: respuesta ASCII, tomamos el número. Estable si hay número.
  if (/[\r\n]/.test(ascii) || ascii.length >= 6) {
    const gramos = parsearGramos(ascii);
    if (!Number.isNaN(gramos)) {
      return { gramos, estable: true, ok: true, crudo: hex };
    }
  }
  return null;
}

/** Envía una solicitud y espera una respuesta parseable (ventana corta). */
function solicitarUnaVez(p: SerialPort, c: ConfigBalanza): Promise<ParseResult> {
  return new Promise((resolve) => {
    let buf = Buffer.alloc(0);
    const onChunk = (d: Buffer) => {
      buf = Buffer.concat([buf, d]);
      const r = intentarParsear(buf, c);
      if (r) {
        cleanup();
        resolve(r);
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      // último intento con lo que haya
      resolve(intentarParsear(buf, c));
    }, 400);
    const cleanup = () => {
      clearTimeout(timer);
      p.off('data', onChunk);
    };
    p.on('data', onChunk);

    const req = bytesSolicitud(c);
    if (req) {
      p.write(req, (err) => {
        if (err) {
          cleanup();
          resolve(null);
        }
      });
    }
  });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Pide el peso a la balanza. Reintenta hasta que se estabilice o venza el timeout.
 * Devuelve gramos + flag de estabilidad. Nunca lanza: si falla, ok=false para que
 * el POS ofrezca el ingreso manual como fallback.
 */
export async function pedirPeso(override?: Partial<ConfigBalanza>): Promise<LecturaPeso> {
  const c = { ...getBalanza(), ...override };
  try {
    const p = await ensurePort(c);
    const inicio = Date.now();
    let ultimo: LecturaPeso | null = null;
    while (Date.now() - inicio < c.timeoutMs) {
      const r = await solicitarUnaVez(p, c);
      if (r === 'inestable') {
        await delay(150);
        continue;
      }
      if (r && r.ok) {
        if (r.estable) return r;
        ultimo = r; // guardamos por si nunca se estabiliza
        await delay(150);
        continue;
      }
      await delay(120);
    }
    if (ultimo) return { ...ultimo, estable: false };
    return {
      gramos: 0,
      estable: false,
      ok: false,
      error: 'La balanza no respondió o el peso no se estabilizó. Ingresá el peso a mano.',
    };
  } catch (e) {
    return {
      gramos: 0,
      estable: false,
      ok: false,
      error: `No se pudo abrir el puerto ${c.puerto}: ${(e as Error).message}. Ingresá el peso a mano.`,
    };
  }
}

/**
 * Modo diagnóstico: abre el puerto, poll de solicitudes y envía cada trama cruda
 * (hex + ascii) al renderer para identificar el formato del modelo puntual.
 */
export async function iniciarDiagnostico(
  onTrama: (t: TramaDiagnostico) => void
): Promise<{ ok: boolean; error?: string }> {
  const c = getBalanza();
  try {
    await cerrarPuerto();
    const p = await ensurePort(c);
    diagListener = (d: Buffer) => {
      onTrama({
        ts: new Date().toISOString(),
        hex: d.toString('hex').replace(/(..)/g, '$1 ').trim(),
        ascii: d.toString('ascii').replace(/[^\x20-\x7e]/g, '·'),
      });
    };
    p.on('data', diagListener);
    // Muchas balanzas responden sólo bajo pedido: hacemos poll.
    const req = bytesSolicitud(c);
    diagInterval = setInterval(() => {
      if (port && port.isOpen && req) port.write(req);
    }, 500);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function detenerDiagnostico(): Promise<void> {
  await cerrarPuerto();
}
