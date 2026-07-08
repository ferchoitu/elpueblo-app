import { getConfig, setConfig } from './db';
import type {
  AppConfig,
  ConfigNegocio,
  ConfigImpresora,
  ConfigBalanza,
  ConfigSync,
} from '../shared/types';

// Valores por defecto. Se guardan/leen de la tabla `config` (key-value).

const defNegocio: ConfigNegocio = {
  nombre: 'DEL PUEBLO',
  direccion: 'Av. Siempreviva 742',
  cuit: '20-00000000-0',
  mensajePie: '¡Gracias por su compra!',
  alias: '',
  logoPath: null,
};

const defImpresora: ConfigImpresora = {
  tipo: 'epson',
  // En Windows suele ser "printer:XP-58" (nombre de la impresora instalada).
  interfaz: 'printer:XP-58',
  ancho: 32, // 58mm ≈ 32 caracteres (fuente A)
  habilitada: true,
};

const defBalanza: ConfigBalanza = {
  // En Windows: COM3, COM4... En Mac/Linux: /dev/tty.usbserial-XXXX
  puerto: 'COM3',
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  protocolo: 'estable', // Systel Croma V2 nativo (solicitud 0x05)
  byteSolicitud: 0x05, // ENQ
  decimales: 3, // XX.XXX kg
  timeoutMs: 1500,
};

export function getNegocio(): ConfigNegocio {
  // Merge con defaults para que configs viejas sin alias/logoPath queden completas.
  return { ...defNegocio, ...(getConfig<Partial<ConfigNegocio>>('negocio') ?? {}) };
}
export function getImpresora(): ConfigImpresora {
  return getConfig<ConfigImpresora>('impresora') ?? defImpresora;
}
export function getBalanza(): ConfigBalanza {
  return getConfig<ConfigBalanza>('balanza') ?? defBalanza;
}

const defSync: ConfigSync = { url: '', token: '', habilitado: false };
export function getSyncConfig(): ConfigSync {
  return { ...defSync, ...(getConfig<Partial<ConfigSync>>('sync') ?? {}) };
}
export function setSyncConfig(v: ConfigSync) {
  setConfig('sync', v);
}

export function getAppConfig(): AppConfig {
  return {
    negocio: getNegocio(),
    impresora: getImpresora(),
    balanza: getBalanza(),
    sync: getSyncConfig(),
  };
}

export function setNegocio(v: ConfigNegocio) {
  setConfig('negocio', v);
}
export function setImpresora(v: ConfigImpresora) {
  setConfig('impresora', v);
}
export function setBalanza(v: ConfigBalanza) {
  setConfig('balanza', v);
}
