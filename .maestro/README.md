# Maestro: flujo crítico contra la API persistente (spec 007, T7; RF-6 de spec 006)

Maestro es una herramienta externa (CLI). **No** está en `package.json`.
Equivalencias: Maestro ↔ Espresso/UI Automator (Android) y XCUITest (iOS), pero de caja negra y con el mismo YAML en ambas plataformas; `testID` ↔ `resource-id` (Android) / `accessibilityIdentifier` (iOS).

> **La API es persistente, compartida y SIN reset** (RF-42/RF-44). El flujo crítico **compra de verdad** y baja el stock del producto en 1 unidad cada vez que pasa. Por eso: (1) exige una **ventana exclusiva** declarada (`E2E_EXCLUSIVE=true`) antes de tocar nada, (2) **nunca** reinicia ni repone stock, y (3) si falta una precondición se detiene con el marcador **`INCONCLUSA`** sin haber mutado, en vez de atribuir un fallo al producto. Ver «API persistente y `INCONCLUSA`» más abajo.

## Qué hay

| Archivo | Papel |
|---|---|
| `checkout.yaml` | El flujo: buscar, agregar, carrito, dirección, **doble toque en «Continuar»**, UNA confirmación, UNA orden. |
| `reset-state.yaml` | Preflight (health + `PRODUCT_ID` con stock > 0 + `E2E_EXCLUSIVE=true`) y luego solo estado LOCAL limpio: `fresh-app`, carrito/historial/pedidos vacíos. |
| `subflows/fresh-app.yaml` | `clearState`, reabre el Development Build (con la carrera del lanzador resuelta), cierra el Dev Menu por plataforma y fija inglés. No toca la API. |
| `subflows/fill-field.yaml` | Teclea un campo por `testID` y cierra el teclado de forma explícita. |
| `subflows/open-my-orders.yaml` | Desde Cuenta: `scroll` + `scrollUntilVisible` + toque en «My orders» (iOS y Android listan nodos de forma distinta). |
| `product-404.yaml` | **Extra opcional:** `herbstore://product/<inexistente>` -> «Product not found» -> «Go to Home». |
| `deep-link-a-b.yaml` | **Extra opcional:** con el producto A abierto, el enlace a B lo REEMPLAZA (singular) y un solo Atrás va a Inicio. |
| `cart-swipe-delete.yaml` | **Extra opcional (RF-31, spec 006 T6e):** carrito de 2 líneas, deslizar la primera, tocar la acción revelada; solo desaparece esa línea y el subtotal es el de la restante. **Usa coordenadas** (ver abajo). |
| `scripts/read-stock.js` | Preflight y medición: verifica `GET /health`, que `PRODUCT_ID` existe y su stock vivo; lo guarda en `output.stock[SLOT]`. Con `REQUIRE_POSITIVE=true` exige stock > 0. |
| `scripts/check-delta.js` | Tras la compra, compara `final == initial - 1`: verde, fallo real del producto, o `INCONCLUSA` si se declaró interferencia. |
| `config.yaml` | `maestro test .maestro` ejecuta solo `checkout.yaml` (los extras no están en el flujo por defecto). |

## Requisitos

Maestro CLI (probado: **2.11.0** con Java 25; pide Java 17+) y, según la plataforma, Xcode/`simctl` (Simulator) o `adb`. En iOS Maestro 2.x usa su propio driver XCTest: **no hace falta `idb`**. Instalación (≈345 MiB en `~/.maestro`):

```bash
curl -fsSL "https://get.maestro.mobile.dev" -o install-maestro.sh   # léelo antes de ejecutarlo
bash install-maestro.sh
export PATH="$PATH:$HOME/.maestro/bin"; maestro --version
```

El script añade `~/.maestro/bin` a `~/.zshrc` y `~/.bash_profile`; si no quieres, ejecútalo con un `maestro` falso en el PATH (el script solo edita los perfiles si `command -v maestro` falla) y exporta el PATH a mano. `export MAESTRO_CLI_NO_ANALYTICS=1` desactiva la telemetría. Alternativa: Homebrew (`brew install mobile-dev-inc/tap/maestro`).

## Orden exacto (cada ejecución)

Desde la raíz del repositorio, en tres terminales. **No hay reinicio de la API**: es persistente y no tiene reset, así que el flujo se apoya en el preflight y en una ventana exclusiva declarada. `reset-state.yaml` se niega a seguir (marcador `INCONCLUSA`) si `E2E_EXCLUSIVE` no es `true`, si `GET /health` falla o si `PRODUCT_ID` no existe o tiene stock 0.

```bash
# 1. La API persistente (se gestiona fuera de este repo; el mock-server desaparece en T8).
#    Asegúrate de que responde y de que ningún otro cliente compra el mismo PRODUCT_ID:
curl -s http://localhost:3001/health        # -> {"status":"ok"}

# 2. Metro del Development Build, apuntando a la API (una vez; sigue vivo entre ejecuciones)
EXPO_PUBLIC_API_ORIGIN=http://localhost:3001 npx expo start --dev-client

# 3. El flujo, declarando la ventana exclusiva (sin ella aborta antes de mutar) y el producto
maestro --device <UDID-o-serial> test .maestro/checkout.yaml \
  -e E2E_EXCLUSIVE=true \
  -e PRODUCT_ID=product-261009-062 \
  -e "PRODUCT_QUERY=Evening Magnesium Powder"
```

- **Marcadores de dispositivo.** En este repositorio y en `docs/evidence/` los identificadores reales se sustituyen por `<android-serial>` (Android: `adb devices -l`, primera columna) y `<ios-simulator-udid>` (iOS: `xcrun simctl list devices booted`); sustitúyelos por los de tu equipo al ejecutar los comandos. No se versionan seriales ni UDID (AGENTS.md).
- **iOS Simulator** (iPhone 17 Pro): `xcrun simctl list devices booted` da el UDID. Necesita el Development Build instalado.
- **Android físico**: antes `adb reverse tcp:8081 tcp:8081` y `adb reverse tcp:3001 tcp:3001` (8081 lleva Metro, 3001 la API); serial con `adb devices`; pantalla desbloqueada. **`clearState` borra los datos de la app** (preferencias, carrito, historial, pedidos locales), nunca los de la API. Un paso de Maestro en un gama baja tarda ~4-7 s: el flujo dura ≈5 min en el Samsung SM-A037M frente a ≈1,5 min en el Simulator.
- **Extras** (opcionales, no amplían RF-6; **no crean órdenes, así que NO necesitan ventana exclusiva** ni preflight de stock, pero sí hacen `clearState` y necesitan la API y Metro arriba): `maestro --device <id> test .maestro/product-404.yaml` y `.../deep-link-a-b.yaml` (≈70 s en el Samsung, ≈35 s en el Simulator).
- **`cart-swipe-delete.yaml`** (extra por archivo, fuera de `config.yaml`): `maestro --device <id> test .maestro/cart-swipe-delete.yaml`. No crea órdenes (no exige ventana exclusiva) y hace `clearState`. ≈46 s en el Simulator y ≈103 s en el Samsung; verde 3 veces seguidas en cada uno (T6e, `docs/evidence/day-6-cart-swipe.md`).
- Variables (`-e CLAVE=valor`): `API_ORIGIN` (cómo alcanza el Mac a la API), `METRO_URL` (cómo alcanza el dispositivo a Metro), `PRODUCT_QUERY`, `PRODUCT_ID`, `E2E_EXCLUSIVE`, `INTERFERENCE`. **`checkout.yaml` y `reset-state.yaml` no llevan valores por defecto a propósito:** en Maestro 2.11.0 el bloque `env:` de un flow gana a las variables `-e` de la CLI **y** a las que pasa el `runFlow` del padre (medido en spec 007 T10 con un probe mínimo: flow `env: PROBE: "false"` + `-e PROBE=true` → la aserción ve `false`), así que cualquier valor por defecto ahí anularía el override y el flujo acabaría siempre en `INCONCLUSA`. Al faltar la variable la seguridad es la misma que antes: la compuerta de exclusividad la trata como no declarada y se detiene antes de mutar («fail closed»). Los extras (`product-404.yaml`, `deep-link-a-b.yaml`, `cart-swipe-delete.yaml`) sí conservan sus valores por defecto: son los pretendidos y no necesitan override. No hay secretos ni datos personales: la dirección es ficticia.

## API persistente e `INCONCLUSA`

La API (spec 007) sirve un catálogo persistente, no tiene reset y puede ser compartida. El flujo crítico es el único que muta (compra 1 unidad). Cómo convive con eso:

- **Preflight antes de mutar.** `reset-state.yaml` exige, en este orden y **sin haber comprado nada todavía**: `E2E_EXCLUSIVE=true` (ventana exclusiva declarada por el operador), `GET /health` ok, y que `PRODUCT_ID` responda con `stock > 0`. Si falta cualquiera, `read-stock.js` lanza una causa `INCONCLUSA: ...` y el flujo se detiene. La API nunca se reinicia ni se repone stock.
- **Parametrización.** `PRODUCT_ID` (el que se compra; debe existir y tener stock) y `PRODUCT_QUERY` (la búsqueda que lo encuentra; debe devolver resultados no ambiguos) son entradas. Si el catálogo agota ese producto, se pasa **otro** `PRODUCT_ID`/`PRODUCT_QUERY`; nunca se restaura stock ni se reinicia la API.
- **Delta y `INCONCLUSA`.** Tras la compra, `read-stock.js` (SLOT `final`) + `check-delta.js` comparan `final == initial - 1`. Verde si coincide. Si no coincide **y** se declaró interferencia (`INTERFERENCE=true`, hubo otro cliente), se registra `INCONCLUSA` (no es fallo del producto). Si no coincide y la exclusividad se sostuvo, es un **fallo real** del producto (una segunda orden dejaría `initial - 2`; una orden perdida dejaría `initial`).
- **`E2E_EXCLUSIVE` y `INTERFERENCE` son declaraciones del operador, no detectores automáticos.** El YAML no puede saber si otro cliente compró: por eso el preflight exige la declaración de exclusividad y el delta permite declarar interferencia para no culpar al producto. Ninguna de las dos variables es un secreto.
- **La carrera del doble toque es determinista en Jest, no aquí.** El doble toque de Maestro usa dos toques reales separados 50 ms; si la API responde rápido, el segundo toque puede caer fuera de la ventana. La garantía de «un solo POST con una sola clave» vive en `checkout-thunks.test.tsx` (fetch demorado + aserción de key única). Maestro solo comprueba el resultado observable: UNA confirmación, delta `-1` y una sola fila en «My orders».

## Decisiones de diseño (resumen; detalle en `plan.md`, «Decisiones de T5»)

- **Idioma fijado a inglés desde Cuenta**, no regex es/en en cada paso: un solo punto bilingüe (`Account|Cuenta`) y el resto de selectores son textos exactos.
- **Selectores**: texto/etiqueta accesible; solo los 8 campos de la dirección tienen `testID` (`checkout-<campo>`), porque su etiqueta aparece dos veces (rótulo y campo).
- **Sin coordenadas ni pausas**: `extendedWaitUntil`, `scrollUntilVisible` y `assertVisible`.
- **Teclado**: «Enter» (tecla Hecho) cierra los campos de texto; `hideKeyboard` (opcional) los de teléfono y código postal, que en iOS no tienen tecla Hecho (en el Simulator sale «WARNED» y es inocuo). En Android `hideKeyboard` es «Atrás»: solo se usa con el teclado abierto.
- **iOS lista nodos fuera de pantalla**: Maestro los da por visibles y `scrollUntilVisible` no se mueve; por eso «My orders» (bajo el pliegue) se alcanza con `scroll`.
- **Alerta de permiso de notificaciones**: la dibuja el SO en el idioma del dispositivo (`Allow|Permitir`); una alerta huérfana de una ejecución fallida se descarta al empezar.
- **Dev Menu**: tras `clearState` hay que aceptar la hoja de bienvenida («Continue») y cerrar el menú completo, con una rama por plataforma (`runFlow` + `when: platform:`): iOS `id: xmark` (símbolo SF); Android no tiene `resource-id`: es una `View` clicable cuyo único identificador es su `accessibilityText` «Close», y el selector de texto de Maestro también compara `accessibilityText`, así que basta `tapOn: "Close"`.
- **Enlace al Development Build en Android**: el primer `openLink` tras `clearState` se perdía (llegaba a `MainActivity` 60 ms después de `launchApp`, antes de que existiera el proceso, y el lanzador de Expo que se abre después lo tragaba). Se espera primero el lanzador («DEVELOPMENT SERVERS») y el `retry` (45 s por intento, 4 intentos) queda como red de seguridad. Un `openLink` normal con la app ya abierta (los extras) no se pierde.
- **Android solo ve lo visible**: `uiautomator` no lista lo que está fuera de pantalla (iOS sí), por eso «My orders» se busca con `scroll` + `scrollUntilVisible`.
- **Permiso de notificaciones**: la rama `Allow|Permitir` se mantiene, pero en el Samsung (Android 13) no apareció ningún diálogo en el flujo.
- **Doble toque**: `tapOn` con `repeat: 2`, `delay: 50` y `retryTapIfNoChange: false` (si no, Maestro añadiría un tercer toque).

## Excepción a «sin coordenadas»: `cart-swipe-delete.yaml` (T6e)

- **Por qué hay un punto de pantalla.** La acción «Eliminar» que aparece al deslizar una línea está **fuera del árbol accesible a propósito** (RF-28: el lector de pantalla encuentra una sola acción de eliminar por línea, el botón visible) y Maestro lee ese mismo árbol (XCTest en iOS, UI Automator en Android). No hay selector por texto, `id` ni `index` para ella. **Descartado:** quitar el ocultar o darle un `testID` para que Maestro la vea (contradice RF-28) y duplicar el botón.
- **Qué coordenadas y por qué esas.** Swipe `90%,28%` -> `40%,28%` (50 % del ancho: 201 pt en el iPhone 17 Pro, 192 dp en el Samsung) y toque en `83%,28%`. La primera línea ocupa ≈ 20-43 % del alto en el iPhone y ≈ 16-40 % en el Samsung a tamaño de texto normal, y la acción abierta ≈ 70-96 % del ancho: los mismos porcentajes valen en las dos plataformas, sin ramas. Todo lo demás (carrito sembrado, aserciones) es por texto. Si cambia el diseño de la línea, el dispositivo o el tamaño de texto hay que revisarlos.
- **La duración (600 ms) forma parte del escenario:** al soltar, Gesture Handler decide con `translationX + 0.05 × velocityX`, así que una pasada más rápida puede abrir con menos recorrido. `swipe` solo admite puntos y duración literales (con variables de `env` falla el análisis).
- **Control incluido:** antes del swipe, un toque en el mismo punto con la fila cerrada no elimina nada; demuestra que lo que abre la acción es el swipe y no un botón visible.
- **Doble toque (hallazgo del spike):** `tapOn` con `point`, `repeat: 2` y `delay: 50` sobre el «Delete» visible de la primera línea vació el carrito de 2 líneas en iOS antes de la corrección de `CartScreen` (el segundo toque pulsaba el botón de la línea que subió). No forma parte del escenario por defecto (el punto del botón depende de la plataforma); lo cubren Jest y la evidencia.
- **Si el driver de Maestro del Samsung no arranca** («driver did not start up in time»): `adb kill-server` lo arregla pero borra `adb reverse`; repetir `adb reverse tcp:8081 tcp:8081` y `tcp:3001 tcp:3001`.
