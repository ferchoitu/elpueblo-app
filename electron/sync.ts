import * as db from './db';
import { getSyncConfig } from './config';

// ===========================================================================
// Worker de sincronización caja -> nube (Supabase, vía Edge Function `push`).
//
// Offline-first: si no hay internet o falla, no pasa nada — la caja sigue
// andando y los pendientes (synced_at IS NULL) se suben en el próximo intento.
// Idempotente por UUID: subir dos veces la misma venta no duplica.
// ===========================================================================

let sincronizando = false;
let ultimaSync: string | null = null;
let ultimoError: string | null = null;
let intervalo: NodeJS.Timeout | null = null;

export interface ResultadoSync {
  ok: boolean;
  ventas?: number;
  turnos?: number;
  error?: string;
}

export async function sincronizar(): Promise<ResultadoSync> {
  const cfg = getSyncConfig();
  if (!cfg.habilitado || !cfg.url || !cfg.token) {
    return { ok: false, error: 'Sincronización no configurada' };
  }
  if (sincronizando) return { ok: false, error: 'Ya está sincronizando' };
  sincronizando = true;
  try {
    const ventas = db.ventasPendientes(300);
    const turnos = db.turnosPendientes(300);
    if (!ventas.length && !turnos.length) {
      ultimaSync = new Date().toISOString();
      ultimoError = null;
      return { ok: true, ventas: 0, turnos: 0 };
    }

    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-token': cfg.token },
      body: JSON.stringify({ ventas, turnos }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      ultimoError = `HTTP ${res.status}: ${txt.slice(0, 200)}`;
      return { ok: false, error: ultimoError };
    }

    db.marcarSincronizados('ventas', ventas.map((v) => v.id));
    db.marcarSincronizados('turnos', turnos.map((t) => t.id));
    ultimaSync = new Date().toISOString();
    ultimoError = null;
    return { ok: true, ventas: ventas.length, turnos: turnos.length };
  } catch (e) {
    // Sin internet / timeout: se reintenta después.
    ultimoError = (e as Error).message;
    return { ok: false, error: ultimoError };
  } finally {
    sincronizando = false;
  }
}

export function estadoSync() {
  const { ventas, turnos } = db.pendientesCount();
  return {
    habilitado: getSyncConfig().habilitado,
    pendientesVentas: ventas,
    pendientesTurnos: turnos,
    ultimaSync,
    ultimoError,
  };
}

/** Arranca el sync automático periódico (y un intento inicial). */
export function iniciarSyncAuto(intervaloMs = 60_000): void {
  if (intervalo) clearInterval(intervalo);
  sincronizar().catch(() => {});
  intervalo = setInterval(() => sincronizar().catch(() => {}), intervaloMs);
}

/** Dispara una sincronización en segundo plano (fire-and-forget) tras una venta/cierre. */
export function sincronizarPronto(): void {
  setTimeout(() => sincronizar().catch(() => {}), 500);
}
