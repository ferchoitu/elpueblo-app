import { useEffect, useState, useMemo, useCallback } from 'react';
import type { Producto, Categoria } from '@shared/types';
import { useCart } from '../store/cartStore';
import { useAuth } from '../store/authStore';
import CategoryTabs from '../components/pos/CategoryTabs';
import ProductTile from '../components/pos/ProductTile';
import Cart from '../components/pos/Cart';
import WeightPrompt from '../components/pos/WeightPrompt';
import CheckoutModal from '../components/pos/CheckoutModal';
import NumericKeypad from '../components/pos/NumericKeypad';
import AbrirTurno from '../components/turno/AbrirTurno';
import { money } from '../lib/format';

export default function PosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [catActiva, setCatActiva] = useState<string | null>(null);

  const [pesoProducto, setPesoProducto] = useState<Producto | null>(null);
  const [ambosProducto, setAmbosProducto] = useState<Producto | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [toast, setToast] = useState('');
  const [busca, setBusca] = useState('');
  const [libre, setLibre] = useState(false); // modal de monto libre
  const [confirmAnular, setConfirmAnular] = useState(false);

  const { agregarUnidad, agregarPeso, agregarLibre } = useCart();
  const sesion = useAuth((s) => s.sesion);

  const cargar = useCallback(async () => {
    const [prods, cats] = await Promise.all([
      window.api.productos.listar(),
      window.api.categorias.listar(),
    ]);
    setProductos(prods);
    setCategorias(cats);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  // Normaliza para buscar sin acentos ni mayúsculas.
  const norm = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const visibles = useMemo(() => {
    let lista = catActiva ? productos.filter((p) => p.categoria_id === catActiva) : productos;
    const q = norm(busca.trim());
    if (q) lista = lista.filter((p) => norm(p.nombre).includes(q));
    return lista;
  }, [productos, catActiva, busca]);

  function mostrarToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  function elegirProducto(p: Producto) {
    if (p.tipo_venta === 'unidad') {
      agregarUnidad(p);
    } else if (p.tipo_venta === 'peso') {
      setPesoProducto(p);
    } else {
      setAmbosProducto(p); // preguntar unidad o peso
    }
  }

  async function anularUltima() {
    setConfirmAnular(false);
    const res = await window.api.venta.anularUltima();
    if (res.ok) {
      mostrarToast(
        res.data ? `Venta #${res.data.numero} anulada` : 'No hay ventas para anular'
      );
    } else {
      mostrarToast(res.error ?? 'Error al anular');
    }
  }

  async function reimprimirUltimo() {
    const res = await window.api.ticket.reimprimirUltimo();
    mostrarToast(
      res.ok ? `🖨 Reimprimiendo ticket #${res.data}` : res.error ?? 'No se pudo reimprimir'
    );
  }

  // Sin turno abierto no se puede cobrar: se pide abrir turno (fondo inicial).
  if (!sesion?.turno_id) return <AbrirTurno />;

  return (
    <div className="h-full flex">
      {/* Grilla de productos */}
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
          {visibles.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              No hay productos. Cargalos en la pestaña Productos.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {visibles.map((p) => (
                <ProductTile
                  key={p.id}
                  producto={p}
                  categoria={p.categoria_id ? catMap.get(p.categoria_id) : undefined}
                  onClick={() => elegirProducto(p)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setLibre(true)} className="btn-ghost text-sm px-3 py-2">
            💲 Monto libre
          </button>
          <button onClick={reimprimirUltimo} className="btn-ghost text-sm px-3 py-2">
            🖨 Reimprimir último
          </button>
          <button onClick={() => setConfirmAnular(true)} className="btn-ghost text-sm px-3 py-2">
            ↩︎ Anular última venta
          </button>
        </div>
      </div>

      {/* Carrito */}
      <aside className="w-[380px] shrink-0 bg-base-800 border-l border-base-700">
        <Cart onCobrar={() => setCheckout(true)} />
      </aside>

      {/* Modales */}
      {pesoProducto && (
        <WeightPrompt
          producto={pesoProducto}
          onCancel={() => setPesoProducto(null)}
          onConfirm={(g) => {
            agregarPeso(pesoProducto, g);
            setPesoProducto(null);
          }}
        />
      )}

      {ambosProducto && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4">
          <div className="card p-6 w-full max-w-sm text-center">
            <div className="text-4xl mb-2">{ambosProducto.emoji}</div>
            <div className="font-bold text-lg mb-4">{ambosProducto.nombre}</div>
            <div className="text-slate-400 mb-4">¿Cómo lo vendés?</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  agregarUnidad(ambosProducto);
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

      {checkout && (
        <CheckoutModal
          onClose={(msg) => {
            setCheckout(false);
            if (msg) mostrarToast(msg);
          }}
        />
      )}

      {confirmAnular && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4">
          <div className="card p-6 w-full max-w-sm text-center">
            <div className="text-4xl mb-3">↩︎</div>
            <div className="font-bold text-lg mb-2">¿Anular la última venta?</div>
            <p className="text-slate-400 text-sm mb-4">
              La venta queda marcada como anulada y no cuenta para la caja. Queda registrado
              quién la anuló.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmAnular(false)} className="btn-ghost py-3">
                No, volver
              </button>
              <button onClick={anularUltima} className="btn-danger py-3">
                Sí, anular
              </button>
            </div>
          </div>
        </div>
      )}

      {libre && (
        <MontoLibreModal
          onCancel={() => setLibre(false)}
          onConfirm={(nombre, monto) => {
            agregarLibre(nombre, monto);
            setLibre(false);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-base-700 border border-base-600 px-5 py-3 rounded-xl shadow-xl z-50 text-center max-w-md">
          {toast}
        </div>
      )}
    </div>
  );
}

/** Cobro de un importe suelto sin producto cargado (ej. un encargo puntual). */
function MontoLibreModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (nombre: string, monto: number) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [montoStr, setMontoStr] = useState('');
  const monto = parseFloat(montoStr || '0') || 0;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4">
      <div className="card p-5 w-full max-w-md">
        <h2 className="text-xl font-bold mb-3">💲 Monto libre</h2>
        <label className="block text-sm text-slate-400 mb-1">Descripción (opcional)</label>
        <input
          className="input mb-3"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Varios"
        />
        <div className="bg-base-900 rounded-xl p-4 text-center mb-3">
          <div className="text-xs text-slate-400">Importe</div>
          <div className="text-4xl font-black tabular-nums">{money(monto)}</div>
        </div>
        <NumericKeypad
          value={montoStr}
          onChange={setMontoStr}
          allowDecimal={false}
          onEnter={() => monto > 0 && onConfirm(nombre, monto)}
        />
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={onCancel} className="btn-ghost py-3">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(nombre, monto)}
            disabled={monto <= 0}
            className="btn-primary py-3"
          >
            Agregar al carrito
          </button>
        </div>
      </div>
    </div>
  );
}
