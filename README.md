# DEL PUEBLO — Caja Registradora (offline)

Caja registradora de escritorio para panadería. **100% offline.** Registra ventas por
**unidad, gramo o kilo**, toma el peso de una **balanza Systel** por RS-232/USB, imprime el
ticket en una **impresora térmica Xprinter 58 mm** y guarda todo en una base **SQLite local**
para analizar las ventas por día / semana / mes.

> No lleva control de stock. Un producto es un **nombre + precio** para cobrar rápido.

## Stack

- **Electron** + **electron-builder** (instalador `.exe` para Windows)
- **React + TypeScript + Vite** (renderer) · **Tailwind CSS** (UI táctil, tema oscuro)
- **better-sqlite3** (base local, proceso main)
- **serialport** (balanza, proceso main)
- **node-thermal-printer** (ESC/POS, proceso main)
- **Zustand** (carrito) · **Recharts** (métricas)

Todo el hardware y la base viven en el **proceso main**; el renderer se comunica por **IPC**
(`ipcRenderer.invoke` / `ipcMain.handle`) a través de un `preload` seguro (`contextBridge`).

---

## Requisitos para desarrollar / compilar

- **Node.js 18+** (probado con Node 20/22).
- **Windows:** herramientas de build para módulos nativos → instalar con
  `npm i -g windows-build-tools` **o** el "Desktop development with C++" de Visual Studio +
  **Python 3.11** (Python 3.12+ no trae `distutils`, que node-gyp necesita).

## Instalar y correr en desarrollo

```bash
npm install        # instala y recompila los módulos nativos para Electron
npm run dev        # levanta Vite + Electron con hot reload
```

Si `npm install` falla al recompilar módulos nativos por Python, usá Python 3.11:

```bash
npm config set python /ruta/a/python3.11
npm run rebuild    # electron-rebuild de better-sqlite3 y serialport
```

## Generar el instalador `.exe` (Windows)

Ejecutar **en Windows**:

```bash
npm run dist:win
```

El instalador NSIS queda en `release/DEL-PUEBLO-Caja-Setup-<version>.exe`.
Instalarlo en una PC limpia, abrir sin internet, vender, imprimir y leer la balanza.

> El build multiplataforma (generar el `.exe` desde Mac/Linux) no es confiable con módulos
> nativos: compilar el `.exe` **desde Windows**.

## Generar el paquete Linux (AppImage / .deb)

Ejecutar **en Linux** (o en la misma distro destino):

```bash
npm install        # recompila los nativos para Linux
npm run dist:linux
```

Queda en `release/DEL-PUEBLO-Caja-<version>.AppImage` (portable, doble clic para correr) y un `.deb`.

**Permisos de hardware en Linux** (una vez):
- **Balanza (puerto serie):** el usuario debe estar en el grupo `dialout`.
  ```bash
  sudo usermod -aG dialout $USER   # cerrar sesión y volver a entrar
  ```
  En Config → Balanza, el puerto suele ser `/dev/ttyUSB0` (adaptador USB-RS232). Listalo con `ls /dev/ttyUSB*`.
- **Impresora térmica:** lo más simple es apuntar la interfaz al **dispositivo crudo** o a una **impresora de red**:
  - USB directo: interfaz `/dev/usb/lp0` (agregar el usuario al grupo `lp`: `sudo usermod -aG lp $USER`).
  - Red / Ethernet: interfaz `tcp://IP_DE_LA_IMPRESORA:9100`.
  - Por nombre de CUPS (`printer:NOMBRE`) requiere tener la impresora instalada en CUPS; el dispositivo crudo suele ser más directo para ESC/POS.

---

## La base de datos

- Archivo único SQLite en `app.getPath('userData')`
  (Windows: `C:\Users\<usuario>\AppData\Roaming\DEL PUEBLO Caja\delpueblo.db`).
- Sobrevive a las actualizaciones del programa.
- Diseño **sync-ready**: cada registro tiene **UUID**, las ventas tienen `synced_at`
  (NULL = pendiente de subir) y las fechas están en **UTC ISO 8601**. Esto permite, en una
  fase futura, sincronizar a la nube sin rehacer el esquema. **La nube no está implementada.**

### Respaldo

En **Config → Respaldo** hay un botón para copiar el archivo `.db` a un pendrive o carpeta.
También se puede copiar el archivo a mano desde la ruta de arriba con el programa cerrado.

---

## Configuración (pestaña Config)

### Datos del negocio
Nombre, dirección, CUIT y mensaje del pie → salen impresos en el ticket.

### Impresora (Xprinter 58 mm)
- **Interfaz:** en Windows normalmente `printer:NOMBRE`, donde `NOMBRE` es el nombre exacto
  con el que quedó instalada la impresora (Panel de control → Dispositivos e impresoras).
  También admite `//localhost/NOMBRE` o una ruta USB.
- **Ancho:** 58 mm ≈ **32 caracteres** (fuente A).
- Impresión directa y silenciosa tras confirmar cada venta.

### Balanza Systel (Croma 30 V2)
- **Serie:** 9600 baudios, 8-N-1 (configurable). Confirmar en el menú de la balanza.
- **Protocolos:**
  - **`estable` (recomendado):** solicitud `0x05` (ENQ). Respuesta estable = `STX` + 6 ASCII
    (`XX.XXX` kg) + `ETX` + XOR. Respuesta inestable = `0x11` (reintenta).
  - **`continuo`:** solicitud `0x07`, trae el peso siempre + byte `e`/`i` (estable/inestable).
  - **`torrey`** (`P`) y **`cas`** (`W`): respaldos de compatibilidad para Croma nuevos.
- **Byte de solicitud, puerto COM, baudios y paridad** son editables.

#### ⚠️ Modo diagnóstico (hacer esto ANTES de fijar el parser)
El formato decimal exacto (kg vs g, cantidad de decimales) depende de cómo esté configurada
la balanza puntual. En **Config → Balanza → Diagnóstico**:

1. Elegí el puerto COM y guardá.
2. Tocá **▶ Diagnóstico** y poné peso en la balanza.
3. Mirá las **tramas crudas** (hex + ASCII) que aparecen en la consola negra.
4. Verificá que el peso leído coincida con el visor. Ajustá **protocolo / byte de solicitud**
   si hace falta, guardá y probá de nuevo.

**Interpretación del peso (robusta):** si el número trae separador decimal se interpreta en
**kilos** (×1000 = gramos); si es entero, ya son **gramos**.

**Fallback manual siempre disponible:** si la balanza falla o no está, un teclado numérico en
pantalla permite tipear los gramos. La caja nunca se traba por la balanza.

---

## Uso (POS)

- **Grilla** de tiles grandes con emoji + nombre + precio, coloreados por categoría, con
  **tabs de categoría** para filtrar.
- **Unidad:** tocar suma +1 (stepper −/+ en el carrito).
- **Peso:** pide el peso a la balanza, se puede corregir a mano, calcula `precio_kg × g / 1000`.
- **Ambos:** pregunta "¿por unidad o por peso?".
- **Cobrar:** método de pago (efectivo / débito / crédito / QR / transferencia); en efectivo,
  teclado para "recibido" y muestra el **vuelto**. Confirmar → guarda en SQLite → imprime ticket.
- **Anular última venta:** marca la venta como `anulada` (no repone stock porque no hay stock).

## Métricas

Período **hoy / semana / mes / personalizado**. KPIs (total, tickets, **ticket promedio**),
**evolución por día**, **comparativa mensual**, **top productos** (por $ y cantidad),
**desglose por método de pago**, **listado de tickets** con detalle y **export CSV**.

---

## Estructura

```
/electron        # proceso main (Node)
  main.ts        # ventana, IPC, CSP, backup/CSV
  preload.ts     # API segura (contextBridge) → window.api
  db.ts          # better-sqlite3: esquema, migraciones, queries, seed, métricas
  balanza.ts     # serialport: pedirPeso, diagnóstico, parser configurable
  impresora.ts   # node-thermal-printer: ticket ESC/POS 58mm
  config.ts      # defaults y persistencia de negocio/impresora/balanza
/shared
  types.ts       # tipos compartidos main ↔ renderer
/src             # React (renderer)
  store/cartStore.ts
  pages/         # PosPage, MetricasPage, ProductosPage, ConfigPage
  components/pos, components/metricas
electron-builder.yml
```

## Actualizaciones (auto-update por GitHub Releases)

La app instalada se **actualiza sola**: al abrir (y cada 6 h) chequea GitHub Releases; si hay
versión nueva la baja en segundo plano y avisa para instalarla al reiniciar. Es offline-first:
sin internet no pasa nada, la caja sigue andando. Los datos (SQLite en userData) y la config no se
tocan; las migraciones de esquema corren solas al abrir la versión nueva.

**Publicar una versión nueva** (no hace falta Windows: compila un GitHub Action):

```bash
# 1. Subí el número de versión
npm version 1.1.0 --no-git-tag-version   # edita package.json
git commit -am "v1.1.0"
# 2. Etiquetá y subí el tag
git tag v1.1.0
git push origin main --tags
```

El workflow `.github/workflows/release.yml` compila el instalador en `windows-latest` y publica la
Release automáticamente. Las cajas instaladas se actualizan a esa versión.

> **Importante:** para que el auto-update funcione sin credenciales, el repo `elpueblo-app`
> debe ser **público**. Si es privado, electron-updater necesita un token para leer las Releases.
>
> El **primer** instalador sale igual que cualquier release: creá el tag `v1.0.0`, dejá que el
> Action lo publique, descargá el `.exe` de la Release e instalalo una vez en la PC. De ahí en
> más las actualizaciones son automáticas.

### Cómo agregar cambios de esquema sin perder datos
En `electron/db.ts`, la función `migrar()` corre en cada arranque. Para una tabla/columna nueva,
agregá ahí un `ALTER TABLE ... ADD COLUMN` guardado (chequeando antes con `PRAGMA table_info`).
Así las cajas ya instaladas migran solas al actualizar.

## Fase futura (documentada, NO implementada)

Sincronización a la nube: un proceso en segundo plano detecta internet y sube las ventas con
`synced_at IS NULL` a un backend (Supabase/Postgres), marcándolas como sincronizadas. Panel web
de solo-lectura para ver las métricas desde el celular. La base local no cambia y la caja sigue
funcionando 100% offline aunque la nube no esté.
