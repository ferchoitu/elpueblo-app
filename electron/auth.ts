import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import * as db from './db';
import { getConfig, setConfig } from './db';
import type { Sesion, EstadoInicial, SetupAdmin, Rol } from '../shared/types';

// ===========================================================================
// Autenticación local (offline). Roles: admin (usuario+contraseña) y empleada (PIN).
// Los secretos se guardan hasheados con scrypt (viene en Node, sin dependencias).
// La "sesión" vive en memoria del proceso main; el renderer la consulta por IPC.
//
// Nota de alcance: esto controla el ACCESO por la interfaz. Como la base es local,
// no protege contra alguien que abra el archivo .db con otro programa (eso
// requeriría encriptar la base). Alcanza para el objetivo: que la empleada no vea
// los números de ventas/dinero mientras opera la caja.
// ===========================================================================

// ----- Hashing -----

function hashSecreto(secreto: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(secreto, salt, 64);
  return `${salt.toString('hex')}:${dk.toString('hex')}`;
}

function verificarSecreto(secreto: string, almacenado: string | null): boolean {
  if (!almacenado) return false;
  const [saltHex, keyHex] = almacenado.split(':');
  if (!saltHex || !keyHex) return false;
  const key = Buffer.from(keyHex, 'hex');
  const dk = scryptSync(secreto, Buffer.from(saltHex, 'hex'), key.length);
  return key.length === dk.length && timingSafeEqual(dk, key);
}

// ----- Sesión en memoria -----

let sesion: Sesion | null = null;

export function getSesion(): Sesion | null {
  return sesion;
}

export function logout(): void {
  // No cierra el turno: sólo desloguea. El turno abierto sigue abierto.
  sesion = null;
}

export function setTurnoEnSesion(turnoId: string | null): void {
  if (sesion) sesion.turno_id = turnoId;
}

/** Lanza si no hay admin logueado. Se usa para blindar los datos de dinero. */
export function requireAdmin(): void {
  if (sesion?.rol !== 'admin') throw new Error('Acceso restringido: se requiere administrador');
}

export function requireSesion(): Sesion {
  if (!sesion) throw new Error('No hay sesión activa');
  return sesion;
}

// ----- Estado / setup -----

export function estadoInicial(): EstadoInicial {
  return { necesitaSetup: !db.existeAdmin() };
}

/** Crea el admin inicial y devuelve un código de recuperación (mostrar una sola vez). */
export function setupAdmin(datos: SetupAdmin): { recoveryCode: string } {
  if (db.existeAdmin()) throw new Error('Ya existe un administrador');
  if (!datos.usuario.trim() || datos.password.length < 4)
    throw new Error('Usuario y contraseña (mín. 4 caracteres) son obligatorios');

  db.crearUsuario({
    nombre: datos.nombre || datos.usuario,
    usuario: datos.usuario.trim(),
    rol: 'admin',
    pass_hash: hashSecreto(datos.password),
  });

  // Código de recuperación: se guarda hasheado, se muestra una vez.
  const recoveryCode = randomBytes(5).toString('hex').toUpperCase(); // 10 chars
  setConfig('recovery_hash', hashSecreto(recoveryCode));
  return { recoveryCode };
}

// ----- Login -----

export function loginAdmin(usuario: string, password: string): Sesion {
  const u = db.obtenerUsuarioPorLogin(usuario.trim());
  if (!u || !verificarSecreto(password, u.pass_hash)) {
    throw new Error('Usuario o contraseña incorrectos');
  }
  const turno = db.turnoAbiertoDe(u.id);
  sesion = { usuario_id: u.id, nombre: u.nombre, rol: 'admin', turno_id: turno?.id ?? null };
  return sesion;
}

export function loginEmpleada(usuarioId: string, pin: string): Sesion {
  const u = db.obtenerUsuarioRow(usuarioId);
  if (!u || u.rol !== 'empleada' || u.activo !== 1 || !verificarSecreto(pin, u.pass_hash)) {
    throw new Error('PIN incorrecto');
  }
  const turno = db.turnoAbiertoDe(u.id);
  sesion = { usuario_id: u.id, nombre: u.nombre, rol: 'empleada', turno_id: turno?.id ?? null };
  return sesion;
}

// ----- Gestión de usuarios (sólo admin) -----

export function crearEmpleada(nombre: string, pin: string): void {
  requireAdmin();
  if (!/^\d{4}$/.test(pin)) throw new Error('El PIN debe ser de 4 dígitos');
  db.crearUsuario({ nombre, usuario: null, rol: 'empleada', pass_hash: hashSecreto(pin) });
}

export function cambiarPinEmpleada(usuarioId: string, pin: string): void {
  requireAdmin();
  if (!/^\d{4}$/.test(pin)) throw new Error('El PIN debe ser de 4 dígitos');
  const u = db.obtenerUsuarioRow(usuarioId);
  if (!u || u.rol !== 'empleada') throw new Error('Empleada no encontrada');
  db.actualizarPassHash(usuarioId, hashSecreto(pin));
}

export function editarUsuario(usuarioId: string, cambios: { nombre?: string; activo?: number }): void {
  requireAdmin();
  db.editarUsuario(usuarioId, cambios);
}

export function cambiarPasswordAdmin(passwordActual: string, nueva: string): void {
  const s = requireSesion();
  if (s.rol !== 'admin') throw new Error('Sólo el admin puede cambiar su contraseña');
  const u = db.obtenerUsuarioRow(s.usuario_id);
  if (!u || !verificarSecreto(passwordActual, u.pass_hash))
    throw new Error('La contraseña actual es incorrecta');
  if (nueva.length < 4) throw new Error('La nueva contraseña debe tener al menos 4 caracteres');
  db.actualizarPassHash(u.id, hashSecreto(nueva));
}

// ----- Recuperación de contraseña de admin (offline) -----

export function resetAdmin(usuario: string, recoveryCode: string, nuevaPassword: string): void {
  const guardado = getConfig<string>('recovery_hash');
  if (!verificarSecreto(recoveryCode.trim().toUpperCase(), guardado)) {
    throw new Error('Código de recuperación incorrecto');
  }
  const u = db.obtenerUsuarioPorLogin(usuario.trim());
  if (!u) throw new Error('No existe un admin con ese usuario');
  if (nuevaPassword.length < 4) throw new Error('La nueva contraseña debe tener al menos 4 caracteres');
  db.actualizarPassHash(u.id, hashSecreto(nuevaPassword));
}

// Reexport de tipo para conveniencia
export type { Rol };
