import { useState, useEffect } from 'react';
import { useAuth } from './store/authStore';
import PosPage from './pages/PosPage';
import MetricasPage from './pages/MetricasPage';
import ProductosPage from './pages/ProductosPage';
import ConfigPage from './pages/ConfigPage';
import TurnosPage from './pages/TurnosPage';
import SetupWizard from './components/auth/SetupWizard';
import LoginScreen from './components/auth/LoginScreen';
import CerrarTurno from './components/turno/CerrarTurno';

type Tab = 'pos' | 'metricas' | 'productos' | 'turnos' | 'config';

const TABS: { id: Tab; label: string; emoji: string; soloAdmin: boolean }[] = [
  { id: 'pos', label: 'Caja', emoji: '🧾', soloAdmin: false },
  { id: 'metricas', label: 'Métricas', emoji: '📊', soloAdmin: true },
  { id: 'productos', label: 'Productos', emoji: '🥐', soloAdmin: true },
  { id: 'turnos', label: 'Turnos', emoji: '📅', soloAdmin: true },
  { id: 'config', label: 'Config', emoji: '⚙️', soloAdmin: true },
];

export default function App() {
  const { cargando, sesion, necesitaSetup, init, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('pos');
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  // Auto-bloqueo del ADMIN por inactividad: si se aleja del mostrador logueado,
  // a los 10 minutos sin tocar nada se cierra la sesión (la empleada no ve sus datos).
  const esAdminSesion = sesion?.rol === 'admin';
  useEffect(() => {
    if (!esAdminSesion) return;
    const LIMITE_MS = 10 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;
    const reiniciar = () => {
      clearTimeout(timer);
      timer = setTimeout(() => logout(), LIMITE_MS);
    };
    window.addEventListener('pointerdown', reiniciar);
    window.addEventListener('keydown', reiniciar);
    reiniciar();
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', reiniciar);
      window.removeEventListener('keydown', reiniciar);
    };
  }, [esAdminSesion, logout]);

  if (cargando) {
    return <div className="h-full flex items-center justify-center text-slate-500">Cargando…</div>;
  }
  if (!sesion) {
    return necesitaSetup ? <SetupWizard /> : <LoginScreen />;
  }

  const esAdmin = sesion.rol === 'admin';
  const tabsVisibles = TABS.filter((t) => esAdmin || !t.soloAdmin);
  const tabActual = tabsVisibles.some((t) => t.id === tab) ? tab : 'pos';

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-2 px-4 py-2 bg-base-800 border-b border-base-700">
        <div className="font-black text-xl tracking-tight mr-4">
          DEL&nbsp;PUEBLO<span className="text-acento"> · Caja</span>
        </div>
        <nav className="flex gap-2">
          {tabsVisibles.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                tabActual === t.id ? 'bg-acento text-white' : 'bg-base-700 hover:bg-base-600'
              }`}
            >
              <span className="mr-1">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {sesion.turno_id && (
            <button onClick={() => setCerrando(true)} className="btn-danger px-3 py-2 text-sm">
              🔒 Cerrar caja
            </button>
          )}
          <div className="text-right leading-tight">
            <div className="font-semibold text-sm">{sesion.nombre}</div>
            <div className="text-xs text-slate-400">{esAdmin ? 'Administrador' : 'Empleada'}</div>
          </div>
          <button onClick={() => logout()} className="btn-ghost px-3 py-2 text-sm" title="Cerrar sesión">
            ⏻ Salir
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0">
        {tabActual === 'pos' && <PosPage />}
        {tabActual === 'metricas' && esAdmin && <MetricasPage />}
        {tabActual === 'productos' && esAdmin && <ProductosPage />}
        {tabActual === 'turnos' && esAdmin && <TurnosPage />}
        {tabActual === 'config' && esAdmin && <ConfigPage />}
      </main>

      {cerrando && <CerrarTurno onClose={() => setCerrando(false)} />}
    </div>
  );
}
