import { useCallback, useEffect, useState } from 'react';
import type { EstadoPedido, PagoPedidoInput, PedidoConItems } from '@shared/types';
import { useAuth } from '../store/authStore';
import NuevoPedido from '../components/pedidos/NuevoPedido';
import CobroPedido from '../components/pedidos/CobroPedido';
import { money, cantidadTexto } from '../lib/format';
import { diasHasta, fechaEntregaTexto, fechaHoraLocal } from '../lib/fechas';

const FILTROS: { id: EstadoPedido; label: string }[] = [
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'entregado', label: 'Entregados' },
  { id: 'cancelado', label: 'Cancelados' },
];

const METODO_TXT: Record<string, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  qr: 'QR',
  transferencia: 'Transferencia',
};

function BadgeEntrega({ p }: { p: PedidoConItems }) {
  if (p.estado !== 'pendiente') return null;
  const n = diasHasta(p.fecha_entrega);
  if (n < 0) return <span className="px-2 py-0.5 rounded bg-red-600 text-white text-xs font-bold">ATRASADO</span>;
  if (n === 0) return <span className="px-2 py-0.5 rounded bg-amber-500 text-black text-xs font-bold">HOY</span>;
  return null;
}

export default function PedidosPage() {
  const sesion = useAuth((s) => s.sesion);
  const esAdmin = sesion?.rol === 'admin';

  const [filtro, setFiltro] = useState<EstadoPedido>('pendiente');
  const [busca, setBusca] = useState('');
  const [pedidos, setPedidos] = useState<PedidoConItems[]>([]);
  const [nuevo, setNuevo] = useState(false);
  const [detalle, setDetalle] = useState<PedidoConItems | null>(null);
  const [entregando, setEntregando] = useState<PedidoConItems | null>(null);
  const [confirmCancelar, setConfirmCancelar] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const cargar = useCallback(async () => {
    const res = await window.api.pedidos.listar({ estado: filtro, busqueda: busca });
    if (res.ok && res.data) setPedidos(res.data);
  }, [filtro, busca]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function mostrarToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 5000);
  }

  async function reimprimir(p: PedidoConItems, copia: 'cliente' | 'local') {
    const r = await window.api.pedidos.imprimir(p.id, [copia]);
    mostrarToast(r.ok ? `🖨 Imprimiendo pedido #${p.numero} (copia ${copia})` : r.error ?? 'No se pudo imprimir');
  }

  async function entregar(pago: PagoPedidoInput | null, imprimir: boolean) {
    if (!entregando) return;
    setProcesando(true);
    setError('');
    const res = await window.api.pedidos.entregar(entregando.id, pago);
    if (!res.ok || !res.data) {
      setProcesando(false);
      setError(res.error ?? 'No se pudo entregar el pedido');
      return;
    }
    let mensaje = `✅ Pedido #${res.data.numero} entregado`;
    if (imprimir) {
      const imp = await window.api.pedidos.imprimir(res.data.id, ['cliente']);
      if (!imp.ok) mensaje += ` — ⚠️ no se imprimió: ${imp.error}`;
    }
    setProcesando(false);
    setEntregando(null);
    setDetalle(null);
    mostrarToast(mensaje);
    cargar();
  }

  async function cancelar() {
    if (!detalle) return;
    const res = await window.api.pedidos.cancelar(detalle.id);
    setConfirmCancelar(false);
    if (res.ok) {
      mostrarToast(`Pedido #${detalle.numero} cancelado`);
      setDetalle(null);
      cargar();
    } else {
      mostrarToast(res.error ?? 'No se pudo cancelar');
    }
  }

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <div className="flex items-center gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`px-4 py-2 rounded-lg font-semibold ${
              filtro === f.id ? 'bg-acento text-white' : 'bg-base-700 hover:bg-base-600'
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          className="input w-64 ml-2"
          placeholder="🔍 Nombre, teléfono o N°…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button onClick={() => setNuevo(true)} className="btn-primary px-5 py-3 ml-auto text-lg">
          ＋ Nuevo pedido
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {pedidos.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500">
            {filtro === 'pendiente' ? 'No hay pedidos pendientes.' : 'No hay pedidos para mostrar.'}
          </div>
        ) : (
          pedidos.map((p) => (
            <div key={p.id} className="card p-3 flex items-center gap-4">
              <div className="w-16 text-center">
                <div className="text-xs text-slate-400">N°</div>
                <div className="text-xl font-black">{p.numero}</div>
              </div>
              <div className="w-40">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{fechaEntregaTexto(p.fecha_entrega, p.hora_entrega)}</span>
                  <BadgeEntrega p={p} />
                </div>
                <div className="text-xs text-slate-400">
                  {p.cliente_direccion ? '🛵 Envío' : '🏪 Retira'}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{p.cliente_nombre}</div>
                <div className="text-sm text-slate-400 truncate">
                  📞 {p.cliente_telefono} · {p.items.map((it) => it.nombre_producto).join(', ')}
                </div>
              </div>
              <div className="w-32 text-right">
                <div className="font-bold tabular-nums">{money(p.total)}</div>
                <div className={`text-sm tabular-nums ${p.saldo > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {p.saldo > 0 ? `Debe ${money(p.saldo)}` : 'Pagado'}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDetalle(p)} className="btn-ghost px-4 py-3">
                  Ver
                </button>
                {p.estado === 'pendiente' && (
                  <button
                    onClick={() => {
                      setError('');
                      setEntregando(p);
                    }}
                    className="btn-primary px-4 py-3"
                  >
                    Entregar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {detalle && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4">
          <div className="card w-full max-w-lg p-5 max-h-full overflow-y-auto">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-2xl font-black">Pedido #{detalle.numero}</h2>
                <div className="text-slate-400 text-sm">
                  Tomado {fechaHoraLocal(detalle.created_at)}
                  {detalle.usuario_nombre ? ` por ${detalle.usuario_nombre}` : ''}
                </div>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                  detalle.estado === 'pendiente'
                    ? 'bg-amber-500 text-black'
                    : detalle.estado === 'entregado'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-red-600 text-white'
                }`}
              >
                {detalle.estado}
              </span>
            </div>

            <div className="bg-base-900 rounded-xl p-3 mb-3 space-y-1">
              <div className="font-bold text-lg">{detalle.cliente_nombre}</div>
              <div>📞 {detalle.cliente_telefono}</div>
              {detalle.cliente_direccion && <div>🛵 {detalle.cliente_direccion}</div>}
              <div className="font-semibold">
                📅 Entrega: {fechaEntregaTexto(detalle.fecha_entrega, detalle.hora_entrega)}{' '}
                <BadgeEntrega p={detalle} />
              </div>
              {detalle.notas && <div className="text-amber-200">📝 {detalle.notas}</div>}
              {detalle.entregado_at && (
                <div className="text-sm text-slate-400">
                  Entregado {fechaHoraLocal(detalle.entregado_at)} por {detalle.entregado_por}
                </div>
              )}
              {detalle.cancelado_at && (
                <div className="text-sm text-slate-400">
                  Cancelado {fechaHoraLocal(detalle.cancelado_at)} por {detalle.cancelado_por}
                </div>
              )}
            </div>

            <div className="space-y-1 mb-3">
              {detalle.items.map((it) => (
                <div key={it.id} className="flex justify-between">
                  <span>
                    {it.nombre_producto} <span className="text-slate-400">{cantidadTexto(it.cantidad, it.unidad)}</span>
                  </span>
                  <span className="tabular-nums">{money(it.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-base-700 pt-2 mb-4 space-y-1">
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span className="tabular-nums">{money(detalle.total)}</span>
              </div>
              {detalle.pagos.map((pg) => (
                <div key={pg.venta_id} className="flex justify-between text-sm text-slate-300">
                  <span>
                    Pagó {fechaHoraLocal(pg.fecha)} · {METODO_TXT[pg.metodo_pago] ?? pg.metodo_pago}
                  </span>
                  <span className="tabular-nums">{money(pg.monto)}</span>
                </div>
              ))}
              <div
                className={`flex justify-between text-xl font-black ${
                  detalle.saldo > 0 ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                <span>{detalle.saldo > 0 ? 'Saldo' : 'Pagado'}</span>
                <span className="tabular-nums">{detalle.saldo > 0 ? money(detalle.saldo) : '✓'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <button onClick={() => reimprimir(detalle, 'cliente')} className="btn-ghost py-3">
                🖨 Copia cliente
              </button>
              <button onClick={() => reimprimir(detalle, 'local')} className="btn-ghost py-3">
                🖨 Copia local
              </button>
            </div>
            {detalle.estado === 'pendiente' && (
              <button
                onClick={() => {
                  setError('');
                  setEntregando(detalle);
                }}
                className="btn-primary w-full py-4 text-lg mb-2"
              >
                Entregar
              </button>
            )}
            <div className="flex gap-2">
              {esAdmin && detalle.estado === 'pendiente' && (
                <button onClick={() => setConfirmCancelar(true)} className="btn-danger px-4 py-3 text-sm">
                  Cancelar pedido
                </button>
              )}
              <button onClick={() => setDetalle(null)} className="btn-ghost py-3 flex-1">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmCancelar && detalle && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-sm text-center">
            <div className="font-bold text-lg mb-2">¿Cancelar el pedido #{detalle.numero}?</div>
            <p className="text-slate-400 text-sm mb-4">
              {detalle.pagado > 0
                ? `La seña cobrada (${money(detalle.pagado)}) sigue registrada como venta. Si se la devolvés al cliente, anulá esa venta desde Métricas.`
                : 'No tiene pagos registrados.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmCancelar(false)} className="btn-ghost py-3">
                No
              </button>
              <button onClick={cancelar} className="btn-danger py-3">
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {entregando && (
        <CobroPedido
          modo="saldo"
          total={entregando.saldo}
          titulo={`Entregar #${entregando.numero} · ${entregando.cliente_nombre}`}
          etiquetaConfirmar="Entregar"
          procesando={procesando}
          error={error}
          onConfirmar={entregar}
          onCancelar={() => setEntregando(null)}
        />
      )}

      {nuevo && (
        <NuevoPedido
          onClose={(msg) => {
            setNuevo(false);
            if (msg) {
              mostrarToast(msg);
              setFiltro('pendiente');
              cargar();
            }
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-base-700 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-semibold">
          {toast}
        </div>
      )}
    </div>
  );
}
