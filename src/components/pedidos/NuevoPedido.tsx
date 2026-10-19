import { useEffect, useMemo, useState } from 'react';
import type { Producto, Categoria, CarritoItemInput, PagoPedidoInput, PedidoConItems } from '@shared/types';
import CategoryTabs from '../pos/CategoryTabs';
import ProductTile from '../pos/ProductTile';
import QuantityPrompt from '../pos/QuantityPrompt';
import WeightPrompt from '../pos/WeightPrompt';
import NumericKeypad from '../pos/NumericKeypad';
import CobroPedido from './CobroPedido';
import { money, cantidadTexto } from '../../lib/format';
import { fechaISOLocal } from '../../lib/fechas';

interface ItemPedido extends CarritoItemInput {
  key: string;
  emoji: string;
}

interface Props {
  onClose: (mensaje?: string) => void;
}

let seq = 0;
const nextKey = () => `p${Date.now()}_${seq++}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Alta de un pedido: productos (catálogo o libre) + datos del cliente + fecha, y al final la seña. */
export default function NuevoPedido({ onClose }: Props) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [catActiva, setCatActiva] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const [items, setItems] = useState<ItemPedido[]>([]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [fecha, setFecha] = useState(fechaISOLocal(1));
  const [hora, setHora] = useState('');
  const [notas, setNotas] = useState('');

  const [unidadProducto, setUnidadProducto] = useState<Producto | null>(null);
  const [pesoProducto, setPesoProducto] = useState<Producto | null>(null);
  const [ambosProducto, setAmbosProducto] = useState<Producto | null>(null);
  const [libre, setLibre] = useState(false);
  const [libreNombre, setLibreNombre] = useState('');
  const [libreMontoStr, setLibreMontoStr] = useState('');

  const [cobrando, setCobrando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([window.api.productos.listar(), window.api.categorias.listar()]).then(([p, c]) => {
      setProductos(p);
      setCategorias(c);
    });
  }, []);

  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const visibles = useMemo(() => {
    let lista = catActiva ? productos.filter((p) => p.categoria_id === catActiva) : productos;
    const q = norm(busca.trim());
    if (q) lista = lista.filter((p) => norm(p.nombre).includes(q));
    return lista;
  }, [productos, catActiva, busca]);

  const total = round2(items.reduce((acc, it) => acc + it.subtotal, 0));

  const faltante = !nombre.trim()
    ? 'Falta el nombre del cliente'
    : !telefono.trim()
      ? 'Falta el teléfono'
      : !fecha
        ? 'Falta la fecha de entrega'
        : fecha < fechaISOLocal()
          ? 'La fecha de entrega ya pasó'
          : items.length === 0
            ? 'Agregá al menos un producto'
            : '';

  function elegirProducto(p: Producto) {
    if (p.tipo_venta === 'unidad') setUnidadProducto(p);
    else if (p.tipo_venta === 'peso') setPesoProducto(p);
    else setAmbosProducto(p);
  }

  function agregarUnidades(p: Producto, cantidad: number) {
    const n = Math.max(1, Math.round(cantidad));
    const precio = p.precio_unidad ?? 0;
    setItems((prev) => {
      const existente = prev.find((it) => it.producto_id === p.id && it.tipo_venta_usado === 'unidad');
      if (existente) {
        return prev.map((it) =>
          it.key === existente.key
            ? { ...it, cantidad: it.cantidad + n, subtotal: round2(precio * (it.cantidad + n)) }
            : it
        );
      }
      return [
        ...prev,
        {
          key: nextKey(),
          emoji: p.emoji,
          producto_id: p.id,
          nombre_producto: p.nombre,
          tipo_venta_usado: 'unidad',
          cantidad: n,
          unidad: 'u',
          precio_unitario_aplicado: precio,
          subtotal: round2(precio * n),
        },
      ];
    });
  }

  function agregarPeso(p: Producto, gramos: number) {
    const precioKg = p.precio_kg ?? 0;
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        emoji: p.emoji,
        producto_id: p.id,
        nombre_producto: p.nombre,
        tipo_venta_usado: 'peso',
        cantidad: Math.round(gramos),
        unidad: 'g',
        precio_unitario_aplicado: precioKg,
        subtotal: round2((precioKg * gramos) / 1000),
      },
    ]);
  }

  function agregarLibre() {
    const monto = parseFloat(libreMontoStr || '0') || 0;
    if (!libreNombre.trim() || monto <= 0) return;
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        emoji: '✍️',
        producto_id: null,
        nombre_producto: libreNombre.trim(),
        tipo_venta_usado: 'unidad',
        cantidad: 1,
        unidad: 'u',
        precio_unitario_aplicado: round2(monto),
        subtotal: round2(monto),
      },
    ]);
    setLibre(false);
    setLibreNombre('');
    setLibreMontoStr('');
  }

  function cambiarCantidad(key: string, delta: number) {
    setItems((prev) =>
      prev
        .map((it) =>
          it.key === key && it.tipo_venta_usado === 'unidad'
            ? {
                ...it,
                cantidad: it.cantidad + delta,
                subtotal: round2(it.precio_unitario_aplicado * (it.cantidad + delta)),
              }
            : it
        )
        .filter((it) => it.cantidad > 0)
    );
  }

  async function guardar(pago: PagoPedidoInput | null, imprimir: boolean) {
    setProcesando(true);
    setError('');
    const res = await window.api.pedidos.crear({
      cliente_nombre: nombre,
      cliente_telefono: telefono,
      cliente_direccion: direccion || null,
      fecha_entrega: fecha,
      hora_entrega: hora || null,
      notas: notas || null,
      items: items.map(({ key, emoji, ...rest }) => rest),
      pago,
    });
    if (!res.ok || !res.data) {
      setProcesando(false);
      setError(res.error ?? 'No se pudo guardar el pedido');
      return;
    }
    const pedido: PedidoConItems = res.data;
    let mensaje = `✅ Pedido #${pedido.numero} guardado`;
    if (imprimir) {
      const imp = await window.api.pedidos.imprimir(pedido.id, ['cliente', 'local']);
      if (!imp.ok) mensaje += ` — ⚠️ no se imprimió: ${imp.error}`;
    }
    setProcesando(false);
    onClose(mensaje);
  }

  return (
    <div className="fixed inset-0 z-30 bg-base-900 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-2 bg-base-800 border-b border-base-700">
        <h1 className="font-bold text-lg">📋 Nuevo pedido</h1>
        <button onClick={() => onClose()} className="btn-ghost px-4 py-2 text-sm ml-auto">
          ✕ Cancelar
        </button>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* Catálogo */}
        <div className="flex-1 min-w-0 flex flex-col p-4 gap-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <CategoryTabs categorias={categorias} activa={catActiva} onSelect={setCatActiva} />
            </div>
            <input
              className="input w-48 shrink-0"
              placeholder="🔍 Buscar…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {visibles.map((p) => (
                <ProductTile
                  key={p.id}
                  producto={p}
                  categoria={p.categoria_id ? catMap.get(p.categoria_id) : undefined}
                  onClick={() => elegirProducto(p)}
                />
              ))}
            </div>
          </div>
          <button onClick={() => setLibre(true)} className="btn-ghost py-3">
            ✍️ Ítem libre (ej: torta personalizada)
          </button>
        </div>

        {/* Datos del pedido */}
        <aside className="w-[420px] shrink-0 bg-base-800 border-l border-base-700 flex flex-col min-h-0">
          <div className="p-4 space-y-2 border-b border-base-700">
            <input className="input" placeholder="Nombre del cliente *" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <input className="input" placeholder="Teléfono *" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            <input className="input" placeholder="Dirección (si es con envío)" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            <div className="flex gap-2">
              {[
                { label: 'Hoy', dias: 0 },
                { label: 'Mañana', dias: 1 },
                { label: 'Pasado', dias: 2 },
              ].map((b) => (
                <button
                  key={b.dias}
                  onClick={() => setFecha(fechaISOLocal(b.dias))}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
                    fecha === fechaISOLocal(b.dias) ? 'bg-acento text-white' : 'bg-base-700 hover:bg-base-600'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="date" className="input flex-1" value={fecha} min={fechaISOLocal()} onChange={(e) => setFecha(e.target.value)} />
              <input type="time" className="input w-32" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Notas (ej: escrito 'Feliz cumple Juli', sin TACC…)"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {items.length === 0 ? (
              <div className="text-center text-slate-500 mt-6">Tocá los productos para agregarlos al pedido.</div>
            ) : (
              items.map((it) => (
                <div key={it.key} className="flex items-center gap-2 bg-base-900 rounded-xl p-2">
                  <span className="text-2xl">{it.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{it.nombre_producto}</div>
                    <div className="text-xs text-slate-400">{cantidadTexto(it.cantidad, it.unidad)}</div>
                  </div>
                  {it.tipo_venta_usado === 'unidad' && it.producto_id && (
                    <div className="flex gap-1">
                      <button onClick={() => cambiarCantidad(it.key, -1)} className="btn-ghost w-8 h-8">−</button>
                      <button onClick={() => cambiarCantidad(it.key, 1)} className="btn-ghost w-8 h-8">+</button>
                    </div>
                  )}
                  <div className="w-20 text-right font-bold tabular-nums">{money(it.subtotal)}</div>
                  <button
                    onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}
                    className="text-slate-500 hover:text-red-400 px-1"
                    title="Quitar"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-base-700">
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-slate-400">Total del pedido</span>
              <span className="text-3xl font-black text-acento tabular-nums">{money(total)}</span>
            </div>
            {faltante && <div className="text-amber-300 text-sm mb-2 text-center">{faltante}</div>}
            <button onClick={() => setCobrando(true)} disabled={!!faltante} className="btn-primary w-full py-4 text-lg">
              Seguir: seña / pago →
            </button>
          </div>
        </aside>
      </div>

      {unidadProducto && (
        <QuantityPrompt
          producto={unidadProducto}
          onConfirm={(n) => {
            agregarUnidades(unidadProducto, n);
            setUnidadProducto(null);
          }}
          onCancel={() => setUnidadProducto(null)}
        />
      )}

      {pesoProducto && (
        <WeightPrompt
          producto={pesoProducto}
          conBalanza={false}
          onConfirm={(g) => {
            agregarPeso(pesoProducto, g);
            setPesoProducto(null);
          }}
          onCancel={() => setPesoProducto(null)}
        />
      )}

      {ambosProducto && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4">
          <div className="card p-6 w-full max-w-sm text-center">
            <div className="text-4xl mb-2">{ambosProducto.emoji}</div>
            <div className="font-bold text-lg mb-4">{ambosProducto.nombre}</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setUnidadProducto(ambosProducto);
                  setAmbosProducto(null);
                }}
                className="btn-ghost py-6 text-lg"
              >
                🔢 Por unidad
              </button>
              <button
                onClick={() => {
                  setPesoProducto(ambosProducto);
                  setAmbosProducto(null);
                }}
                className="btn-ghost py-6 text-lg"
              >
                ⚖️ Por peso
              </button>
            </div>
            <button onClick={() => setAmbosProducto(null)} className="text-slate-400 mt-4 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {libre && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4">
          <div className="card w-full max-w-md p-5">
            <h2 className="text-xl font-bold mb-3">✍️ Ítem libre</h2>
            <input
              autoFocus
              className="input mb-3"
              placeholder="Descripción (ej: Torta chocotorta 2 kg)"
              value={libreNombre}
              onChange={(e) => setLibreNombre(e.target.value)}
            />
            <div className="bg-base-900 rounded-xl p-3 text-center mb-3">
              <div className="text-xs text-slate-400">Precio</div>
              <div className="text-3xl font-black tabular-nums">{money(parseFloat(libreMontoStr || '0') || 0)}</div>
            </div>
            <NumericKeypad value={libreMontoStr} onChange={setLibreMontoStr} allowDecimal={false} onEnter={agregarLibre} />
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={() => setLibre(false)} className="btn-ghost py-3">
                Cancelar
              </button>
              <button
                onClick={agregarLibre}
                disabled={!libreNombre.trim() || !(parseFloat(libreMontoStr || '0') > 0)}
                className="btn-primary py-3"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {cobrando && (
        <CobroPedido
          modo="sena"
          total={total}
          titulo={`Seña · ${nombre.trim()}`}
          etiquetaConfirmar="Guardar"
          procesando={procesando}
          error={error}
          onConfirmar={guardar}
          onCancelar={() => {
            setCobrando(false);
            setError('');
          }}
        />
      )}
    </div>
  );
}
