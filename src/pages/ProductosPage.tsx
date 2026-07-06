import { useState, useEffect, useCallback } from 'react';
import type { Producto, Categoria, NuevoProducto, TipoVenta } from '@shared/types';
import { money } from '../lib/format';

const EMOJIS = ['🥖', '🍞', '🥐', '🥯', '🥨', '🧁', '🎂', '🍰', '🍪', '🍫', '🥧', '🍩', '🥟', '🧀'];
const COLORES = ['#d97706', '#db2777', '#ca8a04', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#0891b2'];

const vacio: NuevoProducto = {
  nombre: '',
  categoria_id: null,
  tipo_venta: 'unidad',
  precio_unidad: null,
  precio_kg: null,
  emoji: '🥐',
  color: null,
};

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [form, setForm] = useState<NuevoProducto | null>(null);
  const [catForm, setCatForm] = useState<{ nombre: string; emoji: string; color: string } | null>(null);

  const cargar = useCallback(async () => {
    const [p, c] = await Promise.all([
      window.api.productos.listar(),
      window.api.categorias.listar(),
    ]);
    setProductos(p);
    setCategorias(c);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function nuevo() {
    setEditando(null);
    setForm({ ...vacio, categoria_id: categorias[0]?.id ?? null });
  }

  function editar(p: Producto) {
    setEditando(p);
    setForm({
      nombre: p.nombre,
      categoria_id: p.categoria_id,
      tipo_venta: p.tipo_venta,
      precio_unidad: p.precio_unidad,
      precio_kg: p.precio_kg,
      emoji: p.emoji,
      color: p.color,
    });
  }

  async function guardar() {
    if (!form || !form.nombre.trim()) return;
    const res = editando
      ? await window.api.productos.editar(editando.id, form)
      : await window.api.productos.crear(form);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setForm(null);
    setEditando(null);
    cargar();
  }

  async function borrar(p: Producto) {
    if (!confirm(`¿Borrar "${p.nombre}"? (no afecta ventas ya registradas)`)) return;
    await window.api.productos.borrar(p.id);
    cargar();
  }

  async function guardarCategoria() {
    if (!catForm || !catForm.nombre.trim()) return;
    await window.api.categorias.crear({ ...catForm, orden: categorias.length });
    setCatForm(null);
    cargar();
  }

  const catMap = new Map(categorias.map((c) => [c.id, c]));
  const set = (patch: Partial<NuevoProducto>) => setForm((f) => (f ? { ...f, ...patch } : f));

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Productos</h1>
        <div className="flex gap-2">
          <button onClick={() => setCatForm({ nombre: '', emoji: '🥖', color: COLORES[0] })} className="btn-ghost px-4 py-2">
            + Categoría
          </button>
          <button onClick={nuevo} className="btn-primary px-4 py-2">
            + Producto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {productos.map((p) => {
          const cat = p.categoria_id ? catMap.get(p.categoria_id) : undefined;
          return (
            <div key={p.id} className="card p-3 flex items-center gap-3">
              <span className="text-3xl">{p.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{p.nombre}</div>
                <div className="text-xs text-slate-400">
                  {cat?.nombre ?? 'Sin categoría'} ·{' '}
                  {p.tipo_venta === 'peso'
                    ? `${money(p.precio_kg ?? 0)}/kg`
                    : p.tipo_venta === 'ambos'
                    ? `${money(p.precio_unidad ?? 0)} / ${money(p.precio_kg ?? 0)}kg`
                    : money(p.precio_unidad ?? 0)}
                </div>
              </div>
              <button onClick={() => editar(p)} className="btn-ghost px-3 py-1.5 text-sm">
                Editar
              </button>
              <button onClick={() => borrar(p)} className="btn-danger px-3 py-1.5 text-sm">
                🗑
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal producto */}
      {form && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4 overflow-y-auto">
          <div className="card p-5 w-full max-w-lg my-8">
            <h2 className="text-xl font-bold mb-4">
              {editando ? 'Editar producto' : 'Nuevo producto'}
            </h2>

            <label className="block text-sm text-slate-400 mb-1">Nombre</label>
            <input
              className="input mb-3"
              value={form.nombre}
              onChange={(e) => set({ nombre: e.target.value })}
              placeholder="Ej: Torta de chocolate"
            />

            <label className="block text-sm text-slate-400 mb-1">Categoría</label>
            <select
              className="input mb-3"
              value={form.categoria_id ?? ''}
              onChange={(e) => set({ categoria_id: e.target.value || null })}
            >
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.nombre}
                </option>
              ))}
            </select>

            <label className="block text-sm text-slate-400 mb-1">Tipo de venta</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(['unidad', 'peso', 'ambos'] as TipoVenta[]).map((t) => (
                <button
                  key={t}
                  onClick={() => set({ tipo_venta: t })}
                  className={`py-2 rounded-lg font-semibold capitalize ${
                    form.tipo_venta === t ? 'bg-acento text-white' : 'bg-base-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {(form.tipo_venta === 'unidad' || form.tipo_venta === 'ambos') && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Precio por unidad ($)</label>
                  <input
                    type="number"
                    className="input"
                    value={form.precio_unidad ?? ''}
                    onChange={(e) => set({ precio_unidad: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
              )}
              {(form.tipo_venta === 'peso' || form.tipo_venta === 'ambos') && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Precio por kilo ($)</label>
                  <input
                    type="number"
                    className="input"
                    value={form.precio_kg ?? ''}
                    onChange={(e) => set({ precio_kg: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
              )}
            </div>

            <label className="block text-sm text-slate-400 mb-1">Emoji</label>
            <div className="flex flex-wrap gap-1 mb-3">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => set({ emoji: e })}
                  className={`w-10 h-10 rounded-lg text-xl ${
                    form.emoji === e ? 'bg-acento' : 'bg-base-700'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>

            <label className="block text-sm text-slate-400 mb-1">Color (opcional, sobrescribe el de la categoría)</label>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => set({ color: null })}
                className={`px-3 h-8 rounded-lg text-sm ${!form.color ? 'ring-2 ring-white' : ''} bg-base-700`}
              >
                Categoría
              </button>
              {COLORES.map((c) => (
                <button
                  key={c}
                  onClick={() => set({ color: c })}
                  className={`w-8 h-8 rounded-lg ${form.color === c ? 'ring-2 ring-white' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setForm(null); setEditando(null); }} className="btn-ghost py-3">
                Cancelar
              </button>
              <button onClick={guardar} className="btn-primary py-3">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal categoría */}
      {catForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4">
          <div className="card p-5 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Nueva categoría</h2>
            <input
              className="input mb-3"
              placeholder="Nombre"
              value={catForm.nombre}
              onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })}
            />
            <div className="flex flex-wrap gap-1 mb-3">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setCatForm({ ...catForm, emoji: e })}
                  className={`w-10 h-10 rounded-lg text-xl ${catForm.emoji === e ? 'bg-acento' : 'bg-base-700'}`}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {COLORES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCatForm({ ...catForm, color: c })}
                  className={`w-8 h-8 rounded-lg ${catForm.color === c ? 'ring-2 ring-white' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setCatForm(null)} className="btn-ghost py-3">
                Cancelar
              </button>
              <button onClick={guardarCategoria} className="btn-primary py-3">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
