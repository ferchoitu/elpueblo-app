import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AppConfig,
  ConfigNegocio,
  ConfigImpresora,
  ConfigBalanza,
  TramaDiagnostico,
  ProtocoloBalanza,
} from '@shared/types';
import { EmpleadasSection, PasswordSection } from '../components/config/UsuariosConfig';

export default function ConfigPage() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [puertos, setPuertos] = useState<{ path: string; manufacturer?: string }[]>([]);
  const [guardado, setGuardado] = useState('');

  const [diagActivo, setDiagActivo] = useState(false);
  const [tramas, setTramas] = useState<TramaDiagnostico[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [impresoras, setImpresoras] = useState<{ name: string; displayName: string; isDefault: boolean }[]>([]);
  const [probando, setProbando] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState<{ ok: boolean; msg: string } | null>(null);
  const unsubRef = useRef<null | (() => void)>(null);

  const cargar = useCallback(async () => {
    const [c, p, l] = await Promise.all([
      window.api.config.obtener(),
      window.api.balanza.listarPuertos(),
      window.api.config.logoDataUrl(),
    ]);
    setCfg(c);
    setPuertos(p);
    setLogo(l);
  }, []);

  async function elegirLogo() {
    const res = await window.api.config.elegirLogo();
    if (!res.ok) return flash(res.error ?? 'No se pudo cargar el logo');
    if (res.data) {
      setLogo(res.data.dataUrl);
      setCfg((c) => (c ? { ...c, negocio: { ...c.negocio, logoPath: res.data!.path } } : c));
      flash('Logo cargado');
    }
  }

  async function quitarLogo() {
    await window.api.config.quitarLogo();
    setLogo(null);
    setCfg((c) => (c ? { ...c, negocio: { ...c.negocio, logoPath: null } } : c));
    flash('Logo quitado');
  }

  async function detectarImpresoras() {
    const lista = await window.api.config.listarImpresoras();
    setImpresoras(lista);
    flash(lista.length ? `${lista.length} impresora(s) detectada(s)` : 'No se detectaron impresoras');
  }

  async function probarImpresora() {
    if (!cfg) return;
    setProbando(true);
    setResultadoPrueba(null);
    // Guardamos la config actual y luego imprimimos la prueba con esos valores.
    await window.api.config.guardarImpresora(cfg.impresora);
    const res = await window.api.config.probarImpresora();
    setProbando(false);
    setResultadoPrueba(
      res.ok
        ? { ok: true, msg: '✅ Se envió la impresión de prueba. Revisá que haya salido el ticket.' }
        : { ok: false, msg: `❌ No se pudo imprimir: ${res.error}` }
    );
  }

  useEffect(() => {
    cargar();
    return () => {
      unsubRef.current?.();
      window.api.balanza.detenerDiagnostico();
    };
  }, [cargar]);

  function flash(msg: string) {
    setGuardado(msg);
    setTimeout(() => setGuardado(''), 2500);
  }

  async function guardarNegocio(v: ConfigNegocio) {
    await window.api.config.guardarNegocio(v);
    flash('Datos del negocio guardados');
  }
  async function guardarImpresora(v: ConfigImpresora) {
    await window.api.config.guardarImpresora(v);
    flash('Impresora guardada');
  }
  async function guardarBalanza(v: ConfigBalanza) {
    await window.api.config.guardarBalanza(v);
    flash('Balanza guardada');
  }

  async function toggleDiagnostico() {
    if (diagActivo) {
      unsubRef.current?.();
      unsubRef.current = null;
      await window.api.balanza.detenerDiagnostico();
      setDiagActivo(false);
      return;
    }
    // Guardamos la config de balanza actual antes de diagnosticar.
    if (cfg) await window.api.config.guardarBalanza(cfg.balanza);
    setTramas([]);
    const res = await window.api.balanza.iniciarDiagnostico();
    if (!res.ok) {
      flash('Error al abrir el puerto: ' + res.error);
      return;
    }
    unsubRef.current = window.api.balanza.onTrama((t) =>
      setTramas((prev) => [t, ...prev].slice(0, 50))
    );
    setDiagActivo(true);
  }

  async function backup() {
    const res = await window.api.config.hacerBackup();
    if (res.ok && res.data) alert('Backup guardado en:\n' + res.data);
    else if (!res.ok) alert(res.error);
  }

  if (!cfg) return <div className="p-6 text-slate-400">Cargando…</div>;

  const setNeg = (patch: Partial<ConfigNegocio>) =>
    setCfg({ ...cfg, negocio: { ...cfg.negocio, ...patch } });
  const setImp = (patch: Partial<ConfigImpresora>) =>
    setCfg({ ...cfg, impresora: { ...cfg.impresora, ...patch } });
  const setBal = (patch: Partial<ConfigBalanza>) =>
    setCfg({ ...cfg, balanza: { ...cfg.balanza, ...patch } });

  return (
    <div className="h-full overflow-y-auto p-6 max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Configuración</h1>

      {/* Ticket / Negocio */}
      <section className="card p-5">
        <h2 className="font-bold text-lg mb-1">🧾 Ticket (lo que se imprime)</h2>
        <p className="text-xs text-slate-500 mb-3">
          El <b>número de ticket</b> y la <b>fecha y hora</b> se imprimen automáticamente en cada venta.
        </p>

        <div className="grid grid-cols-1 gap-3">
          <Field label="Nombre de la panadería">
            <input className="input" value={cfg.negocio.nombre} onChange={(e) => setNeg({ nombre: e.target.value })} />
          </Field>

          {/* Logo */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Logo (opcional, se imprime arriba del nombre)</label>
            <div className="flex items-center gap-3">
              {logo ? (
                <img src={logo} alt="logo" className="h-14 w-auto bg-white rounded p-1" />
              ) : (
                <div className="h-14 w-14 rounded bg-base-700 flex items-center justify-center text-slate-500 text-xs">
                  sin logo
                </div>
              )}
              <button onClick={elegirLogo} className="btn-ghost px-3 py-2 text-sm">
                {logo ? 'Cambiar logo' : 'Elegir logo'}
              </button>
              {logo && (
                <button onClick={quitarLogo} className="btn-danger px-3 py-2 text-sm">
                  Quitar
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Ideal: imagen en blanco y negro, angosta (máx. ~384 px de ancho). PNG o JPG.
            </p>
          </div>

          <Field label="Dirección">
            <input className="input" value={cfg.negocio.direccion} onChange={(e) => setNeg({ direccion: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CUIT">
              <input className="input" value={cfg.negocio.cuit} onChange={(e) => setNeg({ cuit: e.target.value })} />
            </Field>
            <Field label="Alias / CBU para transferencias">
              <input
                className="input"
                value={cfg.negocio.alias ?? ''}
                onChange={(e) => setNeg({ alias: e.target.value })}
                placeholder="ej: panaderia.delpueblo"
              />
            </Field>
          </div>
          <Field label="Mensaje del pie">
            <input className="input" value={cfg.negocio.mensajePie} onChange={(e) => setNeg({ mensajePie: e.target.value })} />
          </Field>
        </div>

        {/* Vista previa del ticket */}
        <div className="mt-4">
          <div className="text-sm text-slate-400 mb-1">Vista previa</div>
          <div className="bg-white text-black rounded-lg p-3 max-w-[240px] mx-auto font-mono text-[11px] leading-tight text-center">
            {logo && <img src={logo} alt="logo" className="h-10 w-auto mx-auto mb-1" />}
            <div className="font-bold text-sm">{cfg.negocio.nombre || 'NOMBRE'}</div>
            {cfg.negocio.direccion && <div>{cfg.negocio.direccion}</div>}
            {cfg.negocio.cuit && <div>CUIT: {cfg.negocio.cuit}</div>}
            <div className="border-t border-dashed border-black/40 my-1" />
            <div className="text-left">Ticket N: 123</div>
            <div className="text-left">Fecha: {new Date().toLocaleString('es-AR')}</div>
            <div className="border-t border-dashed border-black/40 my-1" />
            <div className="text-left flex justify-between"><span>Medialuna x2</span><span>$1.200</span></div>
            <div className="border-t border-dashed border-black/40 my-1" />
            <div className="text-right font-bold">TOTAL $1.200</div>
            {cfg.negocio.alias?.trim() && (
              <>
                <div className="border-t border-dashed border-black/40 my-1" />
                <div>Transferencias — Alias:</div>
                <div className="font-bold">{cfg.negocio.alias.trim()}</div>
              </>
            )}
            <div className="border-t border-dashed border-black/40 my-1" />
            <div>{cfg.negocio.mensajePie || '¡Gracias por su compra!'}</div>
          </div>
        </div>

        <button onClick={() => guardarNegocio(cfg.negocio)} className="btn-primary px-4 py-2 mt-4">
          Guardar ticket
        </button>
      </section>

      {/* Impresora */}
      <section className="card p-5">
        <h2 className="font-bold text-lg mb-3">🖨️ Impresora térmica (Xprinter 58mm)</h2>

        {/* Paso 1: detectar impresoras instaladas */}
        <div className="bg-base-900 rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">1. Elegí tu impresora</span>
            <button onClick={detectarImpresoras} className="btn-ghost px-3 py-1.5 text-sm">
              🔄 Detectar
            </button>
          </div>
          {impresoras.length > 0 ? (
            <select
              className="input"
              value=""
              onChange={(e) => e.target.value && setImp({ interfaz: `printer:${e.target.value}` })}
            >
              <option value="">— Elegí una impresora detectada —</option>
              {impresoras.map((imp) => (
                <option key={imp.name} value={imp.name}>
                  {imp.displayName}
                  {imp.isDefault ? ' (predeterminada)' : ''}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-slate-500">
              Tocá <b>Detectar</b> para listar las impresoras instaladas en el sistema. Si no aparece
              ninguna, revisá que esté instalada y encendida, o usá una conexión directa abajo.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Interfaz / conexión">
            <input
              className="input"
              value={cfg.impresora.interfaz}
              onChange={(e) => setImp({ interfaz: e.target.value })}
              placeholder="printer:XP-58"
            />
          </Field>
          <Field label="Ancho (caracteres)">
            <input
              type="number"
              className="input"
              value={cfg.impresora.ancho}
              onChange={(e) => setImp({ ancho: Number(e.target.value) })}
            />
          </Field>
          <Field label="Tipo">
            <select className="input" value={cfg.impresora.tipo} onChange={(e) => setImp({ tipo: e.target.value as 'epson' | 'star' })}>
              <option value="epson">Epson / ESC-POS (Xprinter)</option>
              <option value="star">Star</option>
            </select>
          </Field>
          <Field label="Habilitada">
            <label className="flex items-center gap-2 h-full">
              <input
                type="checkbox"
                checked={cfg.impresora.habilitada}
                onChange={(e) => setImp({ habilitada: e.target.checked })}
                className="w-5 h-5"
              />
              <span>Imprimir tickets automáticamente</span>
            </label>
          </Field>
        </div>

        {/* Atajos de conexión directa */}
        <div className="mt-2">
          <div className="text-xs text-slate-400 mb-1">Atajos de conexión directa:</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setImp({ interfaz: '/dev/usb/lp0' })} className="btn-ghost px-3 py-1.5 text-xs">
              USB Linux (/dev/usb/lp0)
            </button>
            <button onClick={() => setImp({ interfaz: 'tcp://192.168.0.100:9100' })} className="btn-ghost px-3 py-1.5 text-xs">
              Red (tcp://IP:9100)
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-2">
          <b>Windows:</b> elegila del detector (o <code>printer:NOMBRE</code>). <b>Linux:</b> la impresora
          del sistema (detector) o el dispositivo USB <code>/dev/usb/lp0</code>. <b>Red:</b> <code>tcp://IP:9100</code>.
        </p>

        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => guardarImpresora(cfg.impresora)} className="btn-primary px-4 py-2">
            Guardar impresora
          </button>
          <button onClick={probarImpresora} disabled={probando} className="btn-ghost px-4 py-2">
            {probando ? 'Imprimiendo…' : '🧾 Imprimir prueba'}
          </button>
        </div>
        {resultadoPrueba && (
          <div
            className={`text-sm mt-2 ${resultadoPrueba.ok ? 'text-acento' : 'text-red-400'}`}
          >
            {resultadoPrueba.msg}
          </div>
        )}
      </section>

      {/* Balanza */}
      <section className="card p-5">
        <h2 className="font-bold text-lg mb-3">⚖️ Balanza Systel (RS-232 / USB)</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Puerto COM">
            <div className="flex gap-2">
              <input
                className="input"
                value={cfg.balanza.puerto}
                onChange={(e) => setBal({ puerto: e.target.value })}
                list="puertos"
              />
              <datalist id="puertos">
                {puertos.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.manufacturer}
                  </option>
                ))}
              </datalist>
            </div>
          </Field>
          <Field label="Baudios">
            <select className="input" value={cfg.balanza.baudRate} onChange={(e) => setBal({ baudRate: Number(e.target.value) })}>
              {[1200, 2400, 4800, 9600, 19200, 38400].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Paridad">
            <select className="input" value={cfg.balanza.parity} onChange={(e) => setBal({ parity: e.target.value as ConfigBalanza['parity'] })}>
              {['none', 'even', 'odd'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Protocolo">
            <select
              className="input"
              value={cfg.balanza.protocolo}
              onChange={(e) => setBal({ protocolo: e.target.value as ProtocoloBalanza })}
            >
              <option value="estable">Systel estable (0x05)</option>
              <option value="continuo">Systel continuo (0x07)</option>
              <option value="torrey">Torrey (P)</option>
              <option value="cas">CAS (W)</option>
            </select>
          </Field>
          <Field label="Byte de solicitud (hex)">
            <input
              className="input"
              value={'0x' + cfg.balanza.byteSolicitud.toString(16).padStart(2, '0')}
              onChange={(e) => {
                const v = parseInt(e.target.value.replace(/^0x/i, ''), 16);
                if (!Number.isNaN(v)) setBal({ byteSolicitud: v });
              }}
            />
          </Field>
          <Field label="Timeout (ms)">
            <input
              type="number"
              className="input"
              value={cfg.balanza.timeoutMs}
              onChange={(e) => setBal({ timeoutMs: Number(e.target.value) })}
            />
          </Field>
        </div>

        <div className="flex gap-2 mt-3">
          <button onClick={() => guardarBalanza(cfg.balanza)} className="btn-primary px-4 py-2">
            Guardar balanza
          </button>
          <button onClick={toggleDiagnostico} className={diagActivo ? 'btn-danger px-4 py-2' : 'btn-ghost px-4 py-2'}>
            {diagActivo ? '■ Detener diagnóstico' : '▶ Diagnóstico (ver tramas)'}
          </button>
        </div>

        {/* Consola de diagnóstico */}
        <div className="mt-3">
          <p className="text-xs text-slate-500 mb-1">
            Poné peso en la balanza y observá las tramas crudas para ajustar el protocolo/parser al
            modelo puntual antes de fijarlo.
          </p>
          <div className="bg-black rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs">
            {tramas.length === 0 ? (
              <span className="text-slate-600">
                {diagActivo ? 'Esperando tramas…' : 'Diagnóstico detenido'}
              </span>
            ) : (
              tramas.map((t, i) => (
                <div key={i} className="border-b border-white/5 py-0.5">
                  <span className="text-slate-500">{t.ts.slice(11, 23)} </span>
                  <span className="text-emerald-400">{t.hex}</span>
                  <span className="text-slate-400 ml-2">"{t.ascii}"</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Empleadas y contraseña */}
      <EmpleadasSection onFlash={flash} />
      <PasswordSection onFlash={flash} />

      {/* Backup */}
      <section className="card p-5">
        <h2 className="font-bold text-lg mb-3">💾 Respaldo de la base de datos</h2>
        <p className="text-sm text-slate-400 mb-3">
          Guardá una copia del archivo SQLite (todas las ventas y productos) en un pendrive o carpeta.
        </p>
        <button onClick={backup} className="btn-ghost px-4 py-2">
          Hacer copia de seguridad ahora
        </button>
      </section>

      {guardado && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-acento text-white px-5 py-3 rounded-xl shadow-xl z-50">
          {guardado}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
