# DEL PUEBLO — Caja Registradora (offline)

Caja registradora de escritorio para panadería. **100% offline.** Registra ventas por
**unidad, gramo o kilo**, toma el peso de una **balanza Systel** por RS-232/USB, imprime el
ticket en una **impresora térmica Xprinter 58 mm** y guarda todo en una base **SQLite local**.
Con **usuarios por rol** (admin / empleadas con PIN), **turnos con cierre de caja**, métricas
completas y **auto-actualización** desde GitHub Releases.

> No lleva control de stock. Un producto es un **nombre + precio** para cobrar rápido.

## Funciones principales

- **POS táctil**: grilla de tiles con emoji/color por categoría, tabs, **buscador**, venta por
  unidad / peso / ambos, **monto libre** ("Varios"), carrito con stepper, cobro con vuelto.
- **Balanza Systel Croma 30 V2** (RS-232/USB) con modo diagnóstico y fallback manual.
- **Ticket 58 mm** con **logo**, datos del negocio, **alias para transferencias**, N° y
  fecha/hora automáticos. **Reimpresión** del último ticket (POS) o de cualquiera (admin).
- **Roles**: la **empleada** (PIN de 4 dígitos) solo ve la Caja, sin números de ventas.
  El **admin** (usuario + contraseña) ve todo. Datos de dinero blindados en el proceso main.
- **Turnos / cierre de caja sin contar**: la empleada abre con un fondo, y al cerrar deja ese
  fondo en la caja y guarda el excedente con el **ticket Z**. El **admin cuenta después** y
  registra el conteo → diferencia (faltante/sobrante) por turno.
- **Anulaciones auditadas**: quién y cuándo anuló; el admin puede anular cualquier ticket.
- **Métricas (admin)**: KPIs, evolución por día, **ventas por hora**, comparativa mensual,
  top productos, desglose por pago, caja por turno, **detalle de artículo por hora** y
  **listado de tickets**. Períodos: hoy / semana / mes / **año** / personalizado.
- **Export CSV** de ventas (una fila por artículo, con turno/empleada/pago) y de cierres.
- **Backups**: manual (botón) y **automático diario** (rota 30 copias) — ambos consistentes.
- **Auto-update**: la app instalada se actualiza sola desde GitHub Releases.

## Stack

- **Electron** + **electron-builder** (instalador `.exe` Windows, AppImage/`.deb` Linux)
- **React + TypeScript + Vite** (renderer) · **Tailwind CSS** (UI táctil, tema oscuro)
- **better-sqlite3** (base local) · **serialport** (balanza) · **node-thermal-printer** (ESC/POS)
- **Zustand** (estado) · **Recharts** (gráficos) · **electron-updater** (auto-update)

Todo el hardware y la base viven en el **proceso main**; el renderer se comunica por **IPC**
a través de un `preload` seguro (`contextBridge`). Los canales con datos de dinero exigen
sesión de **admin** en el main (no es solo ocultamiento de UI).

---

## Requisitos para desarrollar / compilar

- **Node.js 18+** (probado con Node 20/22).
- Herramientas de build para los módulos nativos (`better-sqlite3`, `serialport`):
  - **Windows:** Visual Studio Build Tools ("Desktop development with C++") + **Python 3.11**
    (3.12+ no trae `distutils`, que node-gyp necesita).
  - **Linux:** `sudo apt install build-essential python3`.
  - **macOS (solo dev):** si `npm install` falla por Python sin `distutils`:
    ```bash
    python3 -m venv gypvenv && ./gypvenv/bin/pip install "setuptools<74"
    export npm_config_python="$PWD/gypvenv/bin/python"
    npm run rebuild
    ```

## Desarrollo

```bash
npm install        # instala y recompila los módulos nativos para Electron
npm run dev        # Vite + Electron con hot reload
```

En desarrollo se siembran productos de prueba; **en la app instalada el catálogo arranca vacío**.

## Instaladores

| Plataforma | Comando (en esa plataforma) | Resultado en `release/` |
|---|---|---|
| Windows | `npm run dist:win` | `DEL-PUEBLO-Caja-Setup-<v>.exe` (NSIS) |
| Linux | `npm run dist:linux` | `.AppImage` (portable, se auto-actualiza) + `.deb` |

> No compilar cruzado (ej. `.exe` desde Mac): los módulos nativos deben compilarse en la
> plataforma destino. Para eso está el CI (abajo).

**Linux — permisos de hardware (una vez):**
```bash
sudo usermod -aG dialout,lp $USER   # balanza (serie) + impresora; re-loguearse
sudo apt install -y libfuse2        # para que corra el AppImage
```
Balanza: `/dev/ttyUSB0`. Impresora: nombre de CUPS, `/dev/usb/lp0` o `tcp://IP:9100`.

---

## Primer uso

1. Al abrir por primera vez, el **asistente** crea el administrador (usuario + contraseña) y
   muestra un **código de recuperación** — guardalo: es la única forma offline de resetear la
   contraseña ("¿Olvidaste la contraseña?" en el login).
2. Como admin: cargá **productos y categorías**, y en **Config → Empleadas** creá a cada
   empleada con su **PIN de 4 dígitos**.
3. En **Config** ajustá el **ticket** (nombre, logo, alias de transferencias), la **impresora**
   (detector + impresión de prueba) y la **balanza** (diagnóstico).

## Flujo diario

- La empleada entra con su PIN → **abre turno** marcando el fondo inicial → vende.
- Al cerrar: **deja el fondo** con el que abrió en la caja y **guarda el excedente junto al
  ticket Z**. No cuenta nada; no ve montos de ventas.
- El admin, cuando quiere, cuenta el sobre y lo registra en **Turnos → ✏️ Contar** → la app
  calcula la **diferencia**. El Z completo se puede reimprimir desde ahí.
- Tras 5 intentos fallidos de PIN/contraseña hay una espera de 30 s. La sesión de admin se
  **bloquea sola a los 10 min de inactividad**.

---

## La base de datos y los backups

- Archivo único SQLite en `app.getPath('userData')`:
  - Windows: `C:\Users\<usuario>\AppData\Roaming\DEL PUEBLO Caja\delpueblo.db`
  - Linux: `~/.config/DEL PUEBLO Caja/delpueblo.db`
- **Sobrevive a las actualizaciones**; las migraciones de esquema corren solas al abrir.
- **Backup automático diario** en `userData/backups/auto-YYYY-MM-DD.db` (conserva 30).
- **Backup manual**: Config → Respaldo (consistente aun con la app abierta).
- Diseño **sync-ready** (UUID, `synced_at`, fechas UTC) para una futura nube — no implementada.

## Hardware

### Impresora (Xprinter 58 mm)
En **Config → Impresora**: botón **Detectar** lista las impresoras del sistema (elegís y listo),
atajos para USB directo / red, y **🧾 Imprimir prueba** para verificar sin hacer una venta.
Ancho 58 mm ≈ **32 caracteres**. La impresión es directa y silenciosa.

### Balanza Systel (Croma 30 V2)
Serie 9600 8-N-1 (configurable). Protocolos: **`estable`** (0x05, recomendado), `continuo`
(0x07), `torrey` (P) y `cas` (W) como respaldo. **Antes de fijar el parser**, usar
**Config → Balanza → Diagnóstico**: muestra las tramas crudas (hex + ASCII) con peso en el
plato para confirmar formato y decimales. Interpretación robusta: número con decimales = kg
(×1000), entero = gramos. **Fallback manual siempre disponible** — la caja nunca se traba.

---

## Estructura

```
/electron            # proceso main (Node)
  main.ts            # ventana, IPC, CSP, backups, CSV
  preload.ts         # API segura (contextBridge) → window.api
  db.ts              # SQLite: esquema, migraciones, queries, métricas, backups
  auth.ts            # roles, scrypt, rate-limit, sesión, recuperación
  balanza.ts         # serialport: pedirPeso, diagnóstico, parser configurable
  impresora.ts       # tickets de venta, prueba y cierre Z (ESC/POS 58mm)
  config.ts          # negocio/ticket, impresora, balanza (tabla config)
  updater.ts         # auto-update por GitHub Releases
/shared/types.ts     # tipos compartidos main ↔ renderer
/src                 # React (renderer)
  store/             # cartStore, authStore
  pages/             # PosPage, MetricasPage, ProductosPage, TurnosPage, ConfigPage
  components/        # pos/, metricas/, turno/, auth/, config/
/build/icon.png      # ícono de la app (usado por electron-builder)
.github/workflows/release.yml   # CI: compila y publica Windows + Linux al taguear
```

## Publicar una versión (CI)

```bash
npm version 1.1.0 --no-git-tag-version
git commit -am "v1.1.0"
git tag v1.1.0 && git push origin main --tags
```

El workflow compila en `windows-latest` y `ubuntu-latest` y publica la Release. Las cajas
instaladas se actualizan solas (el `.exe` y el AppImage; el `.deb` no se auto-actualiza).

> El repo debe ser **público** para que el auto-update lea las Releases sin credenciales.

### Cambios de esquema sin perder datos
En `electron/db.ts`, `migrar()` corre en cada arranque: agregá ahí los `ALTER TABLE ...`
condicionales (chequeando `PRAGMA table_info`) y las cajas instaladas migran solas.

## Nota de seguridad

Los roles controlan el acceso **por la interfaz** (y los canales IPC del main). Como la base
es un archivo local sin cifrar, alguien con acceso al equipo podría abrir el `.db` con otro
programa. Para el objetivo (que la empleada no vea números mientras opera) alcanza; cifrar la
base (SQLCipher) sería el paso siguiente si hiciera falta.
