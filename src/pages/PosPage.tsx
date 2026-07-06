import { useEffect, useState, useMemo, useCallback } from 'react';
import type { Producto, Categoria } from '@shared/types';
import { useCart } from '../store/cartStore';
import { useAuth } from '../store/authStore';
import CategoryTabs from '../components/pos/CategoryTabs';
import ProductTile from '../components/pos/ProductTile';
import Cart from '../components/pos/Cart';
import WeightPrompt from '../components/pos/WeightPrompt';
import CheckoutModal from '../components/pos/CheckoutModal';
import AbrirTurno from '../components/turno/AbrirTurno';

export default function PosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [catActiva, setCatActiva] = useState<string | null>(null);

  const [pesoProducto, setPesoProducto] = useState<Producto | null>(null);
  const [ambosProducto, setAmbosProducto] = useState<Producto | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [toast, setToast] = useState('');

  const { agregarUnidad, agregarPeso } = useCart();
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

  const visibles = useMemo(
    () => (catActiva ? productos.filter((p) => p.categoria_id === catActiva) : productos),
    [productos, catActiva]
  );

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
    const res = await window.api.venta.anularUltima();
    if (res.ok) {
      mostrarToast(
        res.data ? `Venta #${res.data.numero} anulada` : 'No hay ventas para anular'
      );
    } else {
      mostrarToast(res.error ?? 'Error al anular');
    }
  }

  // Sin turno abierto no se puede cobrar: se pide abrir turno (fondo inicial).
  if (!sesion?.turno_id) return <AbrirTurno />;

  return (
    <div className="h-full flex">
      {/* Grilla de productos */}
      <div className="flex-1 min-w-0 flex flex-col p-4 gap-3">
        <CategoryTabs categorias={categorias} activa={catActiva} onSelect={setCatActiva} />
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
        <div>
          <button onClick={anularUltima} className="btn-ghost text-sm px-3 py-2">
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

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-base-700 border border-base-600 px-5 py-3 rounded-xl shadow-xl z-50 text-center max-w-md">
          {toast}
        </div>
      )}
    </div>
  );
}
