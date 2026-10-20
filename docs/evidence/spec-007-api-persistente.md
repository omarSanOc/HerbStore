# Evidencia — Spec 007: Integración con API persistente

Fecha de la ronda: **2026-10-19**. Árbol: commit `5d88ad0` + working tree sin commitear con el incremento 007 completo (T1–T9 + correcciones de T10). Ejecutada por el agente implementador en el Mac del proyecto. Sin seriales, UDID, claves ni PII: los marcadores `<android-serial>` (Samsung SM-A037M, Android 13, USB) y `<ios-simulator-udid>` (iPhone 17 Pro Simulator, iOS 26.5) se sustituyen por los del equipo al reproducir.

## Entorno

- API persistente `http://localhost:3001` (OpenAPI 3.1 «HerbStore API», fuera del repo, **sin reset**; `GET /health` → `{"status":"ok"}`).
- Node 24, Maestro 2.11.0 (Java 25), Development Builds ya instalados en ambos destinos. **Sin cambios de dependencias ni app config en 007 → sin recompilación nativa.**
- Android: `adb reverse tcp:8081 tcp:8081` y `tcp:3001 tcp:3001`. iOS Simulator: `localhost` directo. Metro con `EXPO_PUBLIC_API_ORIGIN=http://localhost:3001` (puerto 8081; se reutilizó un Metro preexistente y para el gate se levantó un segundo Metro sin origen en 8083, después cerrado).
- Android Emulator (`10.0.2.2`) solo documentado (RF-47); iPhone físico/LAN fuera de la matriz bloqueante.

## Automatizado (ejecutado, verde)

| Comprobación | Resultado |
|---|---|
| `npx expo lint` / `npx tsc --noEmit` | limpio / limpio |
| `npm run test:logic` | **1503/1503**, 241 suites, 0 fallos |
| `npm run test:jest` | **649/649**, 54 suites, 0 fallos (incluye `production-bundle-audit.test.ts`) |
| `git diff --check` | limpio |
| `HERBSTORE_LIVE_API_ORIGIN=http://localhost:3001 npm run verify:live-api` | **23 OK, 0 FAIL**, exit 0, solo GET (RF-7–RF-23, RF-27, RF-34, RF-40–RF-42) |
| Export producción Android (`expo export --platform android --no-minify`, origen documentado `https://api.example.test`) | generado (Hermes .hbc, 6.8 MB); grep de `EXPO_PUBLIC_HOME_FIXTURE\|home-fixture-env\|home-fixtures\|ORDER_POST_DELAY_MS\|mock-server\|FRESH_STOCK\|MOCK_LATENCY\|fail=true` → **0 coincidencias** (RF-17, RF-49) |
| Export producción iOS (ídem) | generado; mismo grep → **0 coincidencias** (RF-17, RF-49) |
| Únicos `EXPO_PUBLIC_*` en ambos bundles | `EXPO_PUBLIC_API_ORIGIN` (configuración documentada) y `EXPO_PUBLIC_USE_RN_FETCH` — **falso positivo explicado**: string del runtime vendoril de Expo (`node_modules/expo/src/winter/runtime.native.ts`, flag documentada de Expo; sin valor en estos builds), no un activador de HerbStore |

Los exports y sus greps viven en el scratchpad del sistema (temporal, no versionado); los artefactos no se suben.

## Defecto detectado en T10 y corregido (corrección estrictamente necesaria)

**Maestro 2.11.0: el bloque `env:` de un flow gana a las variables `-e` de la CLI y a las que pasa el `runFlow` del padre** (medido con un probe mínimo en el scratchpad: flow con `env: PROBE: "false"` + `-e PROBE=true` → la aserción ve `false`; y flow hijo con env propio frente a valor del `runFlow` → gana el del hijo). Consecuencia: `.maestro/checkout.yaml` y `.maestro/reset-state.yaml` (T7, nunca ejecutados en dispositivo) tenían defaults que anulaban todo override y el comando documentado acababa **siempre** en `INCONCLUSA` (primera ejecución real, antes de mutar: verificado en vivo). Corrección aplicada (T10): ambos flows **dejan de definir valores** en su `env:` (documentación en comentarios; fuente única `-e`/`runFlow`; al faltar la variable la compuerta de exclusividad sigue fallando cerrado, INCONCLUSA sin mutar). `.maestro/README.md` actualiza la sección de variables y el comando exacto. Los extras conservan sus defaults (son los pretendidos y no requieren override). Este es el único cambio de código/infra de T10.

## Matriz bloqueante — Android (Samsung por USB, RF-45/RF-48)

| Fila | Resultado | Observación |
|---|---|---|
| Gate origen ausente (RF-2) | **PASS** | Metro sin `EXPO_PUBLIC_API_ORIGIN` → «Configuración necesaria» + «Falta la dirección pública obligatoria del catálogo.» + ayuda; cero pantallas remotas. |
| Gate origen inválido (RF-2) | **PASS — confirmación del usuario** | El usuario confirma que la validación manual del gate inválido funcionó; no se registran datos de configuración ni solicitudes. |
| Home localizado es | **PASS** | Chrome + copy remoto de API en español («Más vendidos», «Nuevo», categorías, banner «Descubre fórmulas botánicas y proteínas vegetales.») |
| Home localizado en | **PASS** | Tras «Try again» y en flows Maestro («Best sellers», «Discover botanical and plant protein formulas.») |
| Cambio es↔en sin mezcla | **PASS** | Cuenta → «Español» → «Inicio» pinta contenido es; vuelta a «English» pinta en (dump antes/después) |
| Catálogo: búsqueda → detalle | **PASS** | Flujo Maestro completo («Evening Magnesium Powder» → 1 resultado → detalle) |
| Filtros/orden en dispositivo | **PASS — confirmación del usuario** | El usuario confirma que filtros y orden funcionaron correctamente en la validación manual. |
| Paginación en dispositivo | **PASS — confirmación del usuario** | El usuario confirma que la paginación funcionó correctamente; no se registran ids ni datos sensibles. |
| Código de barras (cámara) | **PASS — evidencia aportada por el usuario** | La evidencia previa del usuario cubre EAN-13 directo y QR existente/inexistente; esta ronda no lo repite. |
| Imagen loading/fallback | **PASS — confirmación del usuario** | El usuario confirma que el fallback de imagen funcionó correctamente. |
| Offline / stale / recuperación | **PASS** | Con `adb reverse --remove tcp:3001` + modo avión: Home muestra «No connection to the server» + «Try again»; restaurada la red, «Try again» recupera el contenido («Best sellers»). |
| Carrito / checkout / doble toque | **PASS** | Maestro `checkout.yaml` verde: doble toque real 50 ms → UNA confirmación («Order in progress» → «Check order status» → «Order confirmed», «1 unit»). |
| Order status / idempotencia observable | **PASS** | Preflight + delta `final == initial − 1` verdes; UNA fila en «My orders» y no dos. |
| RF-43 (una orden real) | **PASS** | Con `-e E2E_EXCLUSIVE=true` y stock inicial 99 > 0: **stock 99 → 98** (exactamente −1) y una sola fila local. |
| RF-44 (INCONCLUSA sin exclusividad) | **PASS (en vivo)** | Ejecución previa sin la declaración: el flujo se detuvo antes de observar/mutar con la causa `INCONCLUSA: E2E_EXCLUSIVE is not 'true'…`; stock sin tocar. |
| Producto 404 | **PASS** | Extra `product-404.yaml` verde: «Product not found» → «Go to Home» → Home. |
| Deep link A→B (singular) | **PASS** | Extra `deep-link-a-b.yaml` verde. |
| Carrito: swipe → Eliminar | **PASS** | Extra `cart-swipe-delete.yaml` verde (solo esa línea desaparece; subtotal coherente). |
| Accesibilidad básica | **PASS (nombres)** | Todos los selectores de los flows son nombres accesibles (campo de búsqueda, tarjeta, «Add to cart», «Cart, 1 item», campos de dirección por testID, «My orders», acciones): nombre/rol presentes en la ruta crítica en ambos idiomas. |
| TalkBack, texto 2.0 y reduced motion | **PASS — confirmación del usuario** | El usuario confirma que accesibilidad/TalkBack, texto grande y movimiento reducido funcionaron correctamente. |

## Matriz bloqueante — iOS (Simulator, RF-46/RF-48)

| Fila | Resultado | Observación |
|---|---|---|
| Gate origen ausente (RF-2) | **PASS** | Captura en scratchpad: «Configuration required / The required public catalog address is missing. / Set EXPO_PUBLIC_API_ORIGIN…» |
| Home y cambio es/en | **PASS** | Cuenta → «Español» → «Inicio»: «Más vendidos» (copy remoto es) visible; vuelta a «English» → «Best sellers». Detalle de producto muestra nombre remoto localizado («Garden Protein Cápsulas»). |
| Checkout / doble toque / order status | **PASS** | Maestro `checkout.yaml` verde con exclusividad: UNA confirmación, delta verde, UNA fila local; **stock 98 → 97** (RF-43). |
| INCONCLUSA sin exclusividad | **PASS** | Misma compuerta (flujo compartido) aborta antes de mutar. |
| 404 / deep link / swipe | **PASS** | Extras `product-404`, `deep-link-a-b`, `cart-swipe-delete` verdes (logs sin FAILED, 47/35/30 pasos COMPLETED). |
| Offline / stale / recuperación | **PASS — confirmación del usuario** | El usuario confirma que offline, recuperación y estados stale funcionaron correctamente en iOS. |
| Código de barras QR | **LIMITACIÓN DEL SIMULATOR** | El Simulator muestra el scanner, pero no ofrece una cámara utilizable; no se declara escaneo físico PASS. La lógica QR aplicable está cubierta por Jest/RNTL. |
| Imagen fallback | **PASS — confirmación del usuario** | El usuario confirma que el fallback de imagen funcionó correctamente en iOS. |
| VoiceOver/audio y accesibilidad manual | **PASS — confirmación del usuario** | El usuario confirma que accesibilidad y VoiceOver/audio funcionaron correctamente. |
| Texto grande | **PASS — confirmación del usuario** | El usuario confirma que texto grande funcionó correctamente. |
| Reduced motion | **PASS — confirmación del usuario** | El usuario confirma que movimiento reducido funcionó correctamente. |

## Límites y observaciones

- **Exclusividad**: `E2E_EXCLUSIVE=true` fue la declaración del operador (coordinador) para esta ronda; el YAML no puede detectar clientes concurrentes (|RF-44|: `INTERFERENCE=true` registra INCONCLUSA en vez de culpar al producto).
- Las dos órdenes reales creadas (una por plataforma) son el escenario mutante permitido por RF-43; el smoke y los extras no mutan.
- **Corrección autorizada del reviewer (2026-10-19)**: se eliminó `src/app/test.tsx`, una ruta accidental no solicitada que contenía un contador. La eliminación fue autorizada explícitamente por el usuario; no contenía secretos, PII ni datos de catálogo. La ruta ya no forma parte del árbol de producto.
- Capturas y logs de Maestro: scratchpad y `~/.maestro/tests/2026-10-19_*` (fuera del repo; sin seriales en los nombres de este documento).

## Estado de T10

**Validación manual completa confirmada por el usuario.** La implementación y la cobertura
automática QR están verdes; Samsung tiene evidencia de los seis casos QR/EAN y la matriz RF-48
restante fue confirmada manualmente. En iOS, los casos QR 3–4 siguen siendo una limitación de
cámara del Simulator y no se presentan como PASS de hardware; la lógica aplicable y el resto de la
matriz fueron confirmados por el usuario.

## Continuación de validación QR — 2026-10-19

Esta ronda no creó órdenes ni ejecutó `POST /orders`. La API respondió `GET /health` y el smoke
opt-in volvió a terminar con 23/23 comprobaciones GET, sin POST. Se conservaron los puertos USB
redireccionados 3001 y 8081, se relanzó el Development Build actual y el Samsung llegó a
«Listo para escanear»; el iOS Simulator llegó a «Ready to scan».

| Plataforma/caso | Resultado honesto | Observación |
|---|---|---|
| Samsung 4: QR con checksum EAN-13 inválido | **PASS — evidencia aportada por el usuario** | El usuario escaneó el QR de checksum inválido en el Samsung y observó «Código inválido», conforme al flujo localizado esperado. |
| Samsung 5: URL, ID, deep link/payload arbitrario | **PASS — evidencia aportada por el usuario** | El usuario escaneó los QR de URL y de `product ID`; ambos mostraron «Código inválido». No se abrieron enlaces ni se interpretó el ID. |
| Samsung 6: doble lectura y ausencia de request para rechazados | **PASS — evidencia aportada por el usuario** | El usuario escaneó rápidamente dos veces el QR válido y observó una sola transición al detalle del producto, equivalente a una sola consulta. La ausencia de request para rechazados está además cubierta por Jest/RNTL. |
| iOS 3: QR EAN-13 válido inexistente | **LIMITACIÓN DEL SIMULATOR** | El preview de `CameraView` quedó sin imagen de cámara en el Simulator. No se afirma escaneo físico. El flujo 404 de QR y la ausencia de reintento están cubiertos por Jest/RNTL. |
| iOS 4: QR inválido/URL/ID/deep link | **LIMITACIÓN DEL SIMULATOR** | Sin cámara utilizable no se puede emitir el callback real. La normalización, el estado localizado/accesible y cero request están cubiertos por tests aplicables. |

La confirmación del usuario de Samsung 1–6 y de la matriz manual restante de ambas plataformas se
conserva como reporte externo de esta ronda, fechada **2026-10-19**, sin seriales, secretos ni PII.
T10 queda completa. iOS 3–4 no se presentan como escaneo de hardware PASS: el Simulator no tiene
cámara QR utilizable; la limitación y la cobertura Jest/RNTL aplicable quedan registradas conforme
a RF-46/RF-48.

## Correcciones tras revisión — 2026-10-19

- `src/app/test.tsx` fue eliminada con autorización explícita del usuario; no se modificaron otras
  rutas ni archivos de producto por esta corrección.
- La ejecución temporal inicial del gate inválido falló por un stream incompleto de Metro; la
  confirmación manual posterior del usuario supersede ese intento y queda registrada como PASS.
- El flow Samsung de filtros/orden fue no mutante y pasó; la confirmación manual posterior del
  usuario cubre también la paginación y las demás filas manuales.
- El smoke de `orders/status` fue corregido para no enviar `Accept-Language` ni exigir
  `Content-Language`; sus tests y la ejecución viva permanecen verdes (23/23 GET, 0 POST).

## Confirmación final de validación manual — 2026-10-19

El usuario confirma explícitamente que funcionaron exitosamente todas las filas manuales que
estaban pendientes: Samsung (gate, filtros, orden, paginación, fallback, accesibilidad/TalkBack,
texto grande y movimiento reducido) e iOS (offline/recuperación, fallback, accesibilidad, texto
grande y movimiento reducido). Esta confirmación no añade seriales, secretos, PII ni detalles no
aportados. La limitación del iOS Simulator para escanear QR con cámara permanece documentada y
aceptada conforme a RF-46/RF-48.
