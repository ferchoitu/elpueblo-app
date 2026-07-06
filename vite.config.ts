import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { fileURLToPath, URL } from 'node:url';

// Módulos que NO deben empaquetarse por Vite en el proceso main:
// nativos (se recompilan con electron-builder) + electron-updater (lee
// app-update.yml del paquete en runtime, conviene dejarlo sin bundlear).
const nativeExternals = [
  'better-sqlite3',
  'serialport',
  'node-thermal-printer',
  'electron-updater',
];

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  plugins: [
    react(),
    electron([
      {
        // Proceso MAIN
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: nativeExternals,
            },
          },
        },
      },
      {
        // PRELOAD
        entry: 'electron/preload.ts',
        onstart(args) {
          // Recargar la ventana cuando cambia el preload
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: nativeExternals,
              // Electron carga el preload como ESM sólo si es .mjs.
              output: { entryFileNames: '[name].mjs' },
            },
          },
        },
      },
    ]),
    // Permite que el renderer resuelva algunos módulos si hiciera falta.
    renderer(),
  ],
  build: {
    outDir: 'dist',
  },
});
