import { useEffect, useMemo, useRef, useState } from 'react';
import type { Repartidor, ClienteReparto, Producto, MetodoCobroReparto, UnidadReparto } from '@shared/types';
import { useAuth } from '../../store/authStore';
import { money, parseCantidad, parsePlata } from '../../lib/format';
import { fechaISOLocal } from '../../lib/fechas';

interface Linea {
  key: string;
  producto_id: string | null;
  nombre: string;
  unidad: UnidadReparto;
  cantidad: string;
  precio: string;
  precioAuto: boolean; // el precio lo puso la app (último precio / catálogo) y se puede pisar al cambiar producto
}

interface Bloque {
  key: string;
  cliente: ClienteReparto;
  lineas: Linea[];
  cobro: string;
  metodo: MetodoCobroReparto;
}

let seq = 0;
const k = () => `r${Date.now()}_${seq++}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const fmtPrecio = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/**
 * Carga de la liquidación de un reparto: lo que trae el repartidor en el papel.
 * Por cliente: qué se le dejó (kilos/unidades y precio) y cuánto pagó. Al final,
 * el efectivo que entrega en mano contra el que debería traer.
 */
export default function CargarLiquidacion({ onGuardada }: { onGuardada?: () => void }) {
  const esAdmin = useAuth((s) => s.sesion?.rol === 'admin');
  const [repartidores, setRepartidores] = useState<Repartidor[]>([]);
  const [repId, setRepId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(fechaISOLocal());
  const [clientes, setClientes] = useState<ClienteReparto[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [busca, setBusca] = useState('');
  const [entregado, setEntregado] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const enfocar = useRef<string | null>(null); // key de la línea cuyo campo cantidad hay que enfocar

  useEffect(() => {
    window.api.reparto.repartidores().then((r) => r.ok && r.data && setRepartidores(r.data));
    window.api.productos.listar().then(setProductos);
  }, []);

  async function cargarClientes(id: string) {
    const r = await window.api.reparto.clientes(id);
    if (r.ok && r.data) setClientes(r.data);
  }

  useEffect(() => {
    setBloques([]);
    setClientes([]);
    if (repId) cargarClientes(repId);
  }, [repId]);

  useEffect(() => {
    if (!enfocar.current) return;
    document.getElementById(`cant-${enfocar.current}`)?.focus();
    enfocar.current = null;
  });

  const productoPorNombre = useMemo(() => new Map(productos.map((p) => [norm(p.nombre), p])), [productos]);

  function precioSugerido(cliente: ClienteReparto, nombre: string, unidad: UnidadReparto): string {
    const ultimo = cliente.ultimos_precios[nombre];
    if (ultimo !== undefined) return fmtPrecio(ultimo);
    const p = productoPorNombre.get(norm(nombre));
    const cat = unidad === 'kg' ? p?.precio_kg : p?.precio_unidad;
    return cat ? fmtPrecio(cat) : '';
  }

  function nuevaLinea(cliente: ClienteReparto, nombre = ''): Linea {
    const p = productoPorNombre.get(norm(nombre));
    const unidad: UnidadReparto = p?.tipo_venta === 'unidad' ? 'u' : 'kg';
    return {
      key: k(),
      producto_id: p?.id ?? null,
      nombre: p?.nombre ?? nombre,
      unidad,
      cantidad: '',
      precio: nombre ? precioSugerido(cliente, p?.nombre ?? nombre, unidad) : '',
      precioAuto: true,
    };
  }

  function agregarCliente(c: ClienteReparto) {
    // Arranca con lo último que se le llevó a ese cliente (o vacío si es nuevo).
    const previos = Object.keys(c.ultimos_precios);
    const lineas = previos.length ? previos.slice(0, 3).map((n) => nuevaLinea(c, n)) : [nuevaLinea(c)];
    setBloques((b) => [...b, { key: k(), cliente: c, lineas, cobro: '', metodo: 'efectivo' }]);
    enfocar.current = lineas[0].key;
    setBusca('');
  }

  async function crearYAgregar(nombre: string) {
    if (!repId) return;
    const r = await window.api.reparto.crearCliente({ repartidor_id: repId, nombre });
    if (!r.ok || !r.data) return setError(r.error ?? 'No se pudo crear el cliente');
    setClientes((cs) => [...cs, r.data!].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    agregarCliente(r.data);
  }

  const disponibles = useMemo(() => {
    const usados = new Set(bloques.map((b) => b.cliente.id));
    const q = norm(busca);
    return clientes.filter((c) => !usados.has(c.id) && (!q || norm(c.nombre).includes(q)));
  }, [clientes, bloques, busca]);
  const existeExacto = clientes.some((c) => norm(c.nombre) === norm(busca));

  function editarBloque(key: string, fn: (b: Bloque) => Bloque) {
    setBloques((bs) => bs.map((b) => (b.key === key ? fn(b) : b)));
  }
  function editarLinea(bk: string, lk: string, cambios: Partial<Linea>) {
    editarBloque(bk, (b) => ({ ...b, lineas: b.lineas.map((l) => (l.key === lk ? { ...l, ...cambios } : l)) }));
  }
  function cambiarProducto(b: Bloque, l: Linea, nombre: string) {
    const p = productoPorNombre.get(norm(nombre));
    const unidad: UnidadReparto = p ? (p.tipo_venta === 'unidad' ? 'u' : 'kg') : l.unidad;
    const cambios: Partial<Linea> = { nombre, producto_id: p?.id ?? null, unidad };
    if (l.precioAuto || !l.precio) {
      cambios.precio = precioSugerido(b.cliente, p?.nombre ?? nombre, unidad);
      cambios.precioAuto = true;
    }
    editarLinea(b.key, l.key, cambios);
  }

  const subtotal = (l: Linea) => round2(parseCantidad(l.cantidad) * parsePlata(l.precio));
  const totalBloque = (b: Bloque) => round2(b.lineas.reduce((a, l) => a + subtotal(l), 0));
  const lineaVacia = (l: Linea) => !l.nombre.trim() && !l.cantidad.trim();

  const total = round2(bloques.reduce((a, b) => a + totalBloque(b), 0));
  const cobradoEf = round2(bloques.filter((b) => b.metodo === 'efectivo').reduce((a, b) => a + parsePlata(b.cobro), 0));
  const cobradoTr = round2(bloques.filter((b) => b.metodo === 'transferencia').reduce((a, b) => a + parsePlata(b.cobro), 0));
  const entregadoNum = entregado.trim() ? parsePlata(entregado) : null;
  const diferencia = entregadoNum == null ? null : round2(entregadoNum - cobradoEf);

  const problema = (() => {
    if (!repId) return 'Elegí quién hizo el reparto';
    if (!bloques.length) return 'Agregá los clientes del papel';
    for (const b of bloques) {
      const lineas = b.lineas.filter((l) => !lineaVacia(l));
      if (!lineas.length && !(parsePlata(b.cobro) > 0)) return `${b.cliente.nombre}: cargá lo que se le dejó o lo que pagó`;
      for (const l of lineas) {
        if (!l.nombre.trim()) return `${b.cliente.nombre}: falta el producto`;
        if (!(parseCantidad(l.cantidad) > 0)) return `${b.cliente.nombre}: falta la cantidad de ${l.nombre}`;
        if (!l.precio.trim()) return `${b.cliente.nombre}: falta el precio de ${l.nombre}`;
      }
    }
    return '';
  })();

  async function guardar() {
    if (problema || !repId) return;
    setGuardando(true);
    setError('');
    const res = await window.api.reparto.crearLiquidacion({
      repartidor_id: repId,
      fecha,
      items: bloques.flatMap((b) =>
        b.lineas
          .filter((l) => !lineaVacia(l))
          .map((l) => ({
            cliente_id: b.cliente.id,
            producto_id: l.producto_id,
            nombre_producto: l.nombre.trim(),
            unidad: l.unidad,
            cantidad: parseCantidad(l.cantidad),
            precio_unitario: parsePlata(l.precio),
            subtotal: subtotal(l),
          }))
      ),
      cobros: bloques
        .filter((b) => parsePlata(b.cobro) > 0)
        .map((b) => ({ cliente_id: b.cliente.id, monto: parsePlata(b.cobro), metodo: b.metodo })),
      efectivo_entregado: entregadoNum,
      notas: notas || null,
    });
    setGuardando(false);
    if (!res.ok || !res.data) return setError(res.error ?? 'No se pudo guardar la liquidación');
    const rep = repartidores.find((r) => r.id === repId)?.nombre ?? '';
    setAviso(`✅ Liquidación #${res.data.numero} de ${rep} guardada (${money(res.data.total_vendido)} vendido)`);
    setTimeout(() => setAviso(''), 6000);
    setBloques([]);
    setEntregado('');
    setNotas('');
    cargarClientes(repId);
    onGuardada?.();
  }

  if (!repartidores.length) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-center p-6">
        Todavía no hay repartos cargados.
        <br />
        {esAdmin ? 'Agregalos en la pestaña "Repartidores".' : 'Pedile a Administración que los agregue.'}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <datalist id="productos-reparto">
        {productos.map((p) => (
          <option key={p.id} value={p.nombre} />
        ))}
      </datalist>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="text-slate-400 text-sm mr-1">Reparto de:</span>
        {repartidores.map((r) => (
          <button
            key={r.id}
            onClick={() => setRepId(r.id)}
            className={`px-4 py-2 rounded-lg font-semibold ${repId === r.id ? 'bg-acento text-white' : 'bg-base-700 hover:bg-base-600'}`}
          >
            🛵 {r.nombre}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-slate-400 text-sm">Día del reparto</span>
          <input type="date" className="input w-44" value={fecha} max={fechaISOLocal()} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      {repId && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
            {bloques.map((b) => {
              const tb = totalBloque(b);
              const saldoPrevio = b.cliente.saldo;
              return (
                <div key={b.key} className="card p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="font-bold text-lg">{b.cliente.nombre}</div>
                    {saldoPrevio != null && saldoPrevio !== 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded ${saldoPrevio > 0 ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                        {saldoPrevio > 0 ? `Debía ${money(saldoPrevio)}` : `A favor ${money(-saldoPrevio)}`}
                      </span>
                    )}
                    <button
                      onClick={() => setBloques((bs) => bs.filter((x) => x.key !== b.key))}
                      className="ml-auto text-slate-500 hover:text-red-400 text-sm"
                    >
                      Quitar cliente
                    </button>
                  </div>

                  <div className="space-y-1">
                    {b.lineas.map((l) => (
                      <div key={l.key} className="flex items-center gap-2">
                        <input
                          className="input flex-1 min-w-0"
                          list="productos-reparto"
                          placeholder="Producto (ej: Pan francés)"
                          value={l.nombre}
                          onChange={(e) => cambiarProducto(b, l, e.target.value)}
                        />
                        <input
                          id={`cant-${l.key}`}
                          className="input w-24 text-right"
                          inputMode="decimal"
                          placeholder="Cant."
                          value={l.cantidad}
                          onChange={(e) => editarLinea(b.key, l.key, { cantidad: e.target.value })}
                        />
                        <div className="flex rounded-lg overflow-hidden border border-base-600">
                          {(['kg', 'u'] as UnidadReparto[]).map((u) => (
                            <button
                              key={u}
                              tabIndex={-1}
                              onClick={() => editarLinea(b.key, l.key, { unidad: u })}
                              className={`px-2 py-2 text-sm ${l.unidad === u ? 'bg-acento text-white' : 'bg-base-900 text-slate-400'}`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                        <span className="text-slate-500 text-sm">a $</span>
                        <input
                          className="input w-28 text-right"
                          inputMode="decimal"
                          placeholder={l.unidad === 'kg' ? '$/kg' : '$/u'}
                          value={l.precio}
                          onChange={(e) => editarLinea(b.key, l.key, { precio: e.target.value, precioAuto: false })}
                        />
                        <div className="w-24 text-right font-bold tabular-nums">{money(subtotal(l))}</div>
                        <button
                          tabIndex={-1}
                          onClick={() => editarBloque(b.key, (x) => ({ ...x, lineas: x.lineas.filter((y) => y.key !== l.key) }))}
                          className="text-slate-500 hover:text-red-400 px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const nl = nuevaLinea(b.cliente);
                      editarBloque(b.key, (x) => ({ ...x, lineas: [...x.lineas, nl] }));
                    }}
                    className="text-sm text-acento mt-1"
                  >
                    ＋ otro producto
                  </button>

                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-base-700">
                    <span className="text-slate-400 text-sm">Pagó</span>
                    <input
                      className="input w-32 text-right"
                      inputMode="decimal"
                      placeholder="$0"
                      value={b.cobro}
                      onChange={(e) => editarBloque(b.key, (x) => ({ ...x, cobro: e.target.value }))}
                    />
                    <button
                      tabIndex={-1}
                      onClick={() => editarBloque(b.key, (x) => ({ ...x, cobro: tb ? fmtPrecio(tb) : '' }))}
                      className="btn-ghost px-2 py-1 text-xs"
                    >
                      = todo
                    </button>
                    <div className="flex rounded-lg overflow-hidden border border-base-600">
                      {(['efectivo', 'transferencia'] as MetodoCobroReparto[]).map((m) => (
                        <button
                          key={m}
                          tabIndex={-1}
                          onClick={() => editarBloque(b.key, (x) => ({ ...x, metodo: m }))}
                          className={`px-3 py-1.5 text-sm ${b.metodo === m ? 'bg-acento text-white' : 'bg-base-900 text-slate-400'}`}
                        >
                          {m === 'efectivo' ? '💵 Efectivo' : '🏦 Transf.'}
                        </button>
                      ))}
                    </div>
                    <div className="ml-auto text-right">
                      <div className="text-xs text-slate-400">Se le dejó</div>
                      <div className="font-black tabular-nums">{money(tb)}</div>
                    </div>
                    {saldoPrevio != null && (
                      <div className="text-right w-32">
                        <div className="text-xs text-slate-400">Queda debiendo</div>
                        <div className="font-bold tabular-nums text-amber-300">
                          {money(round2(saldoPrevio + tb - parsePlata(b.cobro)))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="card p-3">
              <input
                className="input"
                placeholder="🔍 Agregar cliente del papel (escribí el nombre y Enter)"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  if (disponibles[0] && (!busca.trim() || norm(disponibles[0].nombre).startsWith(norm(busca)))) {
                    agregarCliente(disponibles[0]);
                  } else if (busca.trim() && !existeExacto) {
                    crearYAgregar(busca.trim());
                  }
                }}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {disponibles.slice(0, 24).map((c) => (
                  <button key={c.id} onClick={() => agregarCliente(c)} className="btn-ghost px-3 py-2 text-sm">
                    {c.nombre}
                  </button>
                ))}
                {busca.trim() && !existeExacto && (
                  <button onClick={() => crearYAgregar(busca.trim())} className="btn-primary px-3 py-2 text-sm">
                    ＋ Cliente nuevo: “{busca.trim()}”
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="card p-3 mt-3 flex items-center gap-4 flex-wrap">
            <div>
              <div className="text-xs text-slate-400">Total vendido</div>
              <div className="text-2xl font-black text-acento tabular-nums">{money(total)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Cobró en efectivo</div>
              <div className="text-xl font-bold tabular-nums">{money(cobradoEf)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Por transferencia</div>
              <div className="text-xl font-bold tabular-nums">{money(cobradoTr)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Fiado</div>
              <div className="text-xl font-bold tabular-nums text-amber-300">{money(Math.max(0, total - cobradoEf - cobradoTr))}</div>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <div className="text-xs text-slate-400">Efectivo que entrega</div>
                <input className="input w-32 text-right" inputMode="decimal" placeholder={money(cobradoEf)} value={entregado} onChange={(e) => setEntregado(e.target.value)} />
              </div>
              {diferencia != null && (
                <div className={`text-sm font-bold pb-2 ${diferencia === 0 ? 'text-emerald-300' : diferencia < 0 ? 'text-red-400' : 'text-amber-300'}`}>
                  {diferencia === 0 ? '✓ Cuadra' : diferencia < 0 ? `Faltan ${money(-diferencia)}` : `Sobran ${money(diferencia)}`}
                </div>
              )}
            </div>
            <input className="input flex-1 min-w-[160px]" placeholder="Notas (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} />
            <div className="w-full flex items-center gap-3">
              {(error || problema) && <div className={`text-sm ${error ? 'text-red-400' : 'text-amber-300'}`}>{error || problema}</div>}
              <button onClick={guardar} disabled={!!problema || guardando} className="btn-primary px-8 py-3 text-lg ml-auto">
                {guardando ? 'Guardando…' : 'Guardar liquidación'}
              </button>
            </div>
          </div>
        </>
      )}

      {aviso && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-semibold">
          {aviso}
        </div>
      )}
    </div>
  );
}
