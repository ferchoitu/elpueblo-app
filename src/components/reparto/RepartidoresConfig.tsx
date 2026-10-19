import { useCallback, useEffect, useState } from 'react';
import type { ClienteReparto, Repartidor } from '@shared/types';
import { money } from '../../lib/format';

/**
 * Alta y edición de repartidores y de sus clientes.
 * Administración: todo. Personal (`soloClientes`): elige un reparto y agrega o
 * corrige clientes (nombre, teléfono, dirección); no ve saldos ni da de baja.
 */
export default function RepartidoresConfig({ soloClientes = false }: { soloClientes?: boolean }) {
  const [repartidores, setRepartidores] = useState<Repartidor[]>([]);
  const [sel, setSel] = useState<Repartidor | null>(null);
  const [clientes, setClientes] = useState<ClienteReparto[]>([]);
  const [nuevoRep, setNuevoRep] = useState('');
  const [nuevoRepTel, setNuevoRepTel] = useState('');
  const [nuevoCli, setNuevoCli] = useState({ nombre: '', telefono: '', direccion: '' });
  const [editando, setEditando] = useState<ClienteReparto | null>(null);
  const [error, setError] = useState('');

  const cargarReps = useCallback(async () => {
    const r = await window.api.reparto.repartidores(!soloClientes);
    if (r.ok && r.data) setRepartidores(r.data);
  }, [soloClientes]);
  const cargarClientes = useCallback(async (id: string) => {
    const r = await window.api.reparto.clientes(id, !soloClientes);
    if (r.ok && r.data) setClientes(r.data);
  }, [soloClientes]);

  useEffect(() => {
    cargarReps();
  }, [cargarReps]);
  useEffect(() => {
    if (sel) cargarClientes(sel.id);
  }, [sel, cargarClientes]);

  async function crearRep() {
    setError('');
    const r = await window.api.reparto.crearRepartidor(nuevoRep, nuevoRepTel || null);
    if (!r.ok) return setError(r.error ?? 'No se pudo crear');
    setNuevoRep('');
    setNuevoRepTel('');
    await cargarReps();
    if (r.data) setSel(r.data);
  }

  async function toggleRep(r: Repartidor) {
    await window.api.reparto.editarRepartidor(r.id, { activo: r.activo ? 0 : 1 });
    cargarReps();
  }

  async function renombrarRep(r: Repartidor) {
    const nombre = prompt('Nuevo nombre', r.nombre);
    if (!nombre) return;
    const res = await window.api.reparto.editarRepartidor(r.id, { nombre });
    if (!res.ok) return setError(res.error ?? '');
    cargarReps();
  }

  async function crearCli() {
    if (!sel) return;
    setError('');
    const r = await window.api.reparto.crearCliente({ repartidor_id: sel.id, ...nuevoCli });
    if (!r.ok) return setError(r.error ?? 'No se pudo crear');
    setNuevoCli({ nombre: '', telefono: '', direccion: '' });
    cargarClientes(sel.id);
  }

  async function guardarCli() {
    if (!editando || !sel) return;
    const r = await window.api.reparto.editarCliente(editando.id, {
      nombre: editando.nombre,
      telefono: editando.telefono,
      direccion: editando.direccion,
      ...(soloClientes ? {} : { activo: editando.activo }),
    });
    if (!r.ok) return setError(r.error ?? '');
    setEditando(null);
    cargarClientes(sel.id);
  }

  return (
    <div className="h-full flex gap-3 min-h-0">
      <div className="w-80 shrink-0 card p-4 flex flex-col min-h-0">
        <div className="font-bold mb-2">🛵 Repartos</div>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 mb-3">
          {repartidores.map((r) => (
            <div
              key={r.id}
              onClick={() => setSel(r)}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${sel?.id === r.id ? 'bg-acento/30' : 'hover:bg-base-700'} ${r.activo ? '' : 'opacity-50'}`}
            >
              <div className="flex-1">
                <div className="font-semibold">{r.nombre}</div>
                {r.telefono && <div className="text-xs text-slate-400">📞 {r.telefono}</div>}
              </div>
              {!soloClientes && (
                <>
                  <button onClick={(e) => (e.stopPropagation(), renombrarRep(r))} className="text-xs text-slate-400 hover:text-white">
                    ✏️
                  </button>
                  <button onClick={(e) => (e.stopPropagation(), toggleRep(r))} className="text-xs text-slate-400 hover:text-white">
                    {r.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        {soloClientes ? (
          <div className="text-xs text-slate-500">Para agregar un reparto nuevo, pedíselo a Administración.</div>
        ) : (
          <>
            <input className="input mb-2" placeholder="Nombre (ej: Mauro)" value={nuevoRep} onChange={(e) => setNuevoRep(e.target.value)} />
            <input className="input mb-2" placeholder="Teléfono (opcional)" value={nuevoRepTel} onChange={(e) => setNuevoRepTel(e.target.value)} />
            <button onClick={crearRep} disabled={!nuevoRep.trim()} className="btn-primary py-2">
              ＋ Agregar reparto
            </button>
          </>
        )}
      </div>

      <div className="flex-1 min-w-0 card p-4 flex flex-col min-h-0">
        {!sel ? (
          <div className="m-auto text-slate-500">Elegí un reparto para ver y cargar sus clientes.</div>
        ) : (
          <>
            <div className="font-bold mb-2">Clientes de {sel.nombre}</div>
            <div className="flex gap-2 mb-3">
              <input className="input" placeholder="Nombre del cliente *" value={nuevoCli.nombre} onChange={(e) => setNuevoCli({ ...nuevoCli, nombre: e.target.value })} />
              <input className="input" placeholder="Teléfono" value={nuevoCli.telefono} onChange={(e) => setNuevoCli({ ...nuevoCli, telefono: e.target.value })} />
              <input className="input" placeholder="Dirección" value={nuevoCli.direccion} onChange={(e) => setNuevoCli({ ...nuevoCli, direccion: e.target.value })} />
              <button onClick={crearCli} disabled={!nuevoCli.nombre.trim()} className="btn-primary px-4 shrink-0">
                ＋ Agregar
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-400 text-left sticky top-0 bg-base-800">
                  <tr>
                    <th className="p-2">Cliente</th>
                    <th className="p-2">Teléfono</th>
                    <th className="p-2">Dirección</th>
                    <th className="p-2">Precios que se le cobran</th>
                    {!soloClientes && <th className="p-2 text-right">Saldo</th>}
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.id} className={`border-t border-base-700 ${c.activo ? '' : 'opacity-50'}`}>
                      <td className="p-2 font-semibold">{c.nombre}</td>
                      <td className="p-2">{c.telefono ?? '—'}</td>
                      <td className="p-2">{c.direccion ?? '—'}</td>
                      <td className="p-2 text-slate-400 text-xs">
                        {Object.entries(c.ultimos_precios)
                          .map(([n, p]) => `${n}: ${money(p)}`)
                          .join(' · ') || '—'}
                      </td>
                      {!soloClientes && <td className="p-2 text-right tabular-nums">{c.saldo == null ? '' : money(c.saldo)}</td>}
                      <td className="p-2 text-right">
                        <button onClick={() => setEditando({ ...c })} className="text-slate-400 hover:text-white">
                          ✏️
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!clientes.length && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        Sin clientes todavía. También se pueden crear al cargar la liquidación.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
      </div>

      {editando && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4">
          <div className="card p-5 w-full max-w-md space-y-2">
            <h2 className="text-xl font-bold mb-2">Editar cliente</h2>
            <input className="input" value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} />
            <input className="input" placeholder="Teléfono" value={editando.telefono ?? ''} onChange={(e) => setEditando({ ...editando, telefono: e.target.value })} />
            <input className="input" placeholder="Dirección" value={editando.direccion ?? ''} onChange={(e) => setEditando({ ...editando, direccion: e.target.value })} />
            {!soloClientes && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editando.activo === 1} onChange={(e) => setEditando({ ...editando, activo: e.target.checked ? 1 : 0 })} /> Activo (aparece al cargar)
              </label>
            )}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => setEditando(null)} className="btn-ghost py-3">
                Cancelar
              </button>
              <button onClick={guardarCli} className="btn-primary py-3">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
