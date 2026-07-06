import { useState, useEffect, useCallback } from 'react';
import type { Usuario } from '@shared/types';

/** Gestión de empleadas (crear, cambiar PIN, activar/desactivar). Sólo admin. */
export function EmpleadasSection({ onFlash }: { onFlash: (m: string) => void }) {
  const [empleadas, setEmpleadas] = useState<Usuario[]>([]);
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [editandoPin, setEditandoPin] = useState<{ id: string; pin: string } | null>(null);

  const cargar = useCallback(async () => {
    setEmpleadas(await window.api.usuarios.listarEmpleadas());
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear() {
    if (!nombre.trim()) return;
    if (!/^\d{4}$/.test(pin)) return onFlash('El PIN debe ser de 4 dígitos');
    const res = await window.api.usuarios.crearEmpleada(nombre.trim(), pin);
    if (!res.ok) return onFlash(res.error ?? 'Error');
    setNombre('');
    setPin('');
    onFlash('Empleada creada');
    cargar();
  }

  async function guardarPin() {
    if (!editandoPin) return;
    if (!/^\d{4}$/.test(editandoPin.pin)) return onFlash('El PIN debe ser de 4 dígitos');
    const res = await window.api.usuarios.cambiarPin(editandoPin.id, editandoPin.pin);
    onFlash(res.ok ? 'PIN actualizado' : res.error ?? 'Error');
    setEditandoPin(null);
  }

  async function desactivar(u: Usuario) {
    if (!confirm(`¿Desactivar a ${u.nombre}? No podrá iniciar sesión.`)) return;
    await window.api.usuarios.editar(u.id, { activo: 0 });
    cargar();
  }

  return (
    <section className="card p-5">
      <h2 className="font-bold text-lg mb-3">👥 Empleadas</h2>

      <div className="space-y-2 mb-4">
        {empleadas.length === 0 && <div className="text-slate-500 text-sm">Todavía no hay empleadas.</div>}
        {empleadas.map((e) => (
          <div key={e.id} className="flex items-center gap-2 bg-base-700/50 rounded-lg p-2">
            <span className="text-xl">👤</span>
            <span className="flex-1 font-semibold">{e.nombre}</span>
            {editandoPin?.id === e.id ? (
              <>
                <input
                  className="input w-28"
                  value={editandoPin.pin}
                  onChange={(ev) => setEditandoPin({ id: e.id, pin: ev.target.value.replace(/\D/g, '').slice(0, 4) })}
                  placeholder="Nuevo PIN"
                  inputMode="numeric"
                />
                <button onClick={guardarPin} className="btn-primary px-3 py-1.5 text-sm">
                  Guardar
                </button>
                <button onClick={() => setEditandoPin(null)} className="btn-ghost px-3 py-1.5 text-sm">
                  ✕
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditandoPin({ id: e.id, pin: '' })}
                  className="btn-ghost px-3 py-1.5 text-sm"
                >
                  Cambiar PIN
                </button>
                <button onClick={() => desactivar(e)} className="btn-danger px-3 py-1.5 text-sm">
                  Desactivar
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 border-t border-base-700 pt-4">
        <div className="flex-1">
          <label className="block text-sm text-slate-400 mb-1">Nombre</label>
          <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: María" />
        </div>
        <div className="w-32">
          <label className="block text-sm text-slate-400 mb-1">PIN (4 díg.)</label>
          <input
            className="input"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            placeholder="1234"
          />
        </div>
        <button onClick={crear} className="btn-primary px-4 py-2">
          + Agregar
        </button>
      </div>
    </section>
  );
}

/** Cambio de contraseña del administrador logueado. */
export function PasswordSection({ onFlash }: { onFlash: (m: string) => void }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [nueva2, setNueva2] = useState('');

  async function cambiar() {
    if (nueva.length < 4) return onFlash('La nueva contraseña debe tener al menos 4 caracteres');
    if (nueva !== nueva2) return onFlash('Las contraseñas no coinciden');
    const res = await window.api.auth.cambiarPassword(actual, nueva);
    if (!res.ok) return onFlash(res.error ?? 'Error');
    setActual('');
    setNueva('');
    setNueva2('');
    onFlash('Contraseña actualizada');
  }

  return (
    <section className="card p-5">
      <h2 className="font-bold text-lg mb-3">🔑 Contraseña de administrador</h2>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Actual</label>
          <input type="password" className="input" value={actual} onChange={(e) => setActual(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Nueva</label>
          <input type="password" className="input" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Repetir nueva</label>
          <input type="password" className="input" value={nueva2} onChange={(e) => setNueva2(e.target.value)} />
        </div>
      </div>
      <button onClick={cambiar} className="btn-primary px-4 py-2 mt-3">
        Cambiar contraseña
      </button>
    </section>
  );
}
