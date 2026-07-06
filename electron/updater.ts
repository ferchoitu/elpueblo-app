import electronUpdater from 'electron-updater';
import { dialog, BrowserWindow } from 'electron';

const { autoUpdater } = electronUpdater;

// ===========================================================================
// Auto-actualización vía GitHub Releases (electron-updater).
//
// Sólo corre en la app EMPAQUETADA (en dev no hay feed de actualizaciones).
// Es offline-first: si no hay internet, no pasa nada y la caja sigue andando;
// cuando haya conexión, chequea, baja la versión nueva en segundo plano y
// avisa para instalarla al reiniciar. Los datos (SQLite en userData) no se tocan;
// las migraciones de esquema corren solas al abrir la nueva versión.
// ===========================================================================

export function configurarAutoUpdate(getWin: () => BrowserWindow | null): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    console.error('[auto-update] error:', err?.message ?? err);
  });

  autoUpdater.on('update-available', (info) => {
    getWin()?.webContents.send('update:estado', { tipo: 'disponible', version: info.version });
  });

  autoUpdater.on('update-downloaded', async (info) => {
    getWin()?.webContents.send('update:estado', { tipo: 'descargada', version: info.version });
    const win = getWin();
    const opts = {
      type: 'info' as const,
      buttons: ['Reiniciar e instalar', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
      title: 'Actualización lista',
      message: `Hay una versión nueva (${info.version}) lista para instalar.`,
      detail: 'Se aplica al reiniciar. Tus ventas y configuración no se tocan.',
    };
    const r = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts);
    if (r.response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall());
    }
  });

  // Chequeo al inicio y luego cada 6 horas (por si la caja queda abierta días).
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 6 * 60 * 60 * 1000);
}
