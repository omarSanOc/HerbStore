# Día 6 — T6b: texto ampliado y objetivos táctiles (RF-15, RNF-4)

Fecha: 2026-10-16. Estado: **cerrada** (automático en verde; evidencia en Android e iOS). Este documento sustituye al borrador parcial anterior, cuyas medidas de la barra de pestañas eran un artefacto de herramienta (ver «Correcciones a la evidencia anterior»).

## Método y herramientas (RNF-4)

| | Android (Samsung SM-A037M, Android 13, 720 × 1600 px, densidad 300 dpi = 1,875 px/dp) | iOS (Simulator iPhone 17 Pro, 402 × 874 pt, idioma de la app: español) |
|---|---|---|
| Condición | Development Build, Metro (watch) y mock 3001 en marcha; `system/font_scale` 1.0 / 1.3 / 1.5 / 2.0 (espera 14 s) y **relanzando la app** (`am force-stop` + enlace del dev client) | `simctl ui booted content_size` `large` / `accessibility-medium` (AX1) / `accessibility-extra-large` (AX3) / `accessibility-extra-extra-extra-large` (AX5) y **relanzando la app** (H-10) |
| Targets | Herramienta `A11y tree` (UiAutomation): bounds reales de cada nodo `CLICK`; dp = px ÷ 1,875; umbral 90 px = 48 dp | `axe describe-ui`: `frame` de cada `Button`/`TextField`, umbral 44 pt (con `AccessibilityEnabled` = 1; restaurado a 0) |
| Truncado / bajo barra fija | Captura de pantalla (`screencap`) revisada a ojo + posición del nodo frente a la barra de pestañas (y = 1419 px). Nota A-1: el árbol da el texto completo aunque el recorte visual exista | Captura (`simctl io screenshot`) + frame frente a la barra (y = 791,3 pt) |
| Pantallas | Enlaces `herbstore://` (Inicio, Categorías, categoría, producto en stock, carrito, checkout, confirmación, cuenta, mis pedidos, escáner, búsqueda) y desplazamiento arriba/abajo | Los mismos |

Por qué `A11y tree` y no `uiautomator dump`: `uiautomator` recorta los nodos en y = 1465 px (nota de `MEMORY.md`), así que cualquier nodo que toca la barra de pestañas sale más bajo de lo que es (ver correcciones).

Para provocar estados que no salen solos se usaron **parches temporales marcados `TEMP-T6B` y revertidos** (hash de cada archivo comprobado idéntico al original; `grep TEMP-T6B src` = 0): error de compartir forzado, aviso de notificaciones «bloqueadas» forzado, esqueleto de Inicio/cuadrícula forzado y título «Consultando producto…» forzado (el simulador no tiene cámara). Cada uno solo cambia qué estado se dibuja, no el layout.

Capturas (en el directorio temporal de la sesión, no en el repositorio): `…/scratchpad/t6b2/ev/`. Nombres: `a-<escala>-<pantalla>-top|bot.png` (Android; escala 10/13/15/20), `i-<tamaño>-<pantalla>-top|bot.png` (iOS), y las citadas abajo.

## Resumen por plataforma y escala

| Plataforma / escala | Controles medidos | < 48 dp / < 44 pt (no recortados) | Información truncada o bajo barra fija | Resultado |
|---|---:|---:|---|---|
| Android 1.0 | 189 | 0 | ninguna | OK |
| Android 1.3 | 155 | 0 | ninguna (revisadas: categoría, checkout; resto por árbol) | OK |
| Android 1.5 | 150 | 0 | ninguna (revisadas: Inicio, categorías) | OK |
| Android 2.0 | 136 | 0 | ninguna (revisadas todas las pantallas de la tabla siguiente) | OK |
| iOS large | 200 | 0 | ninguna | OK |
| iOS AX1 | 177 | 0 | ninguna (revisada: categoría) | OK |
| iOS AX3 | 174 | 0 | ninguna (revisadas: categoría, Inicio) | OK |
| iOS AX5 | 177 | 0 | **cuatro encontradas y corregidas** (palabras partidas: tarjetas de Inicio, «Filtros» y «Consultando» del escáner; botones de «Estado del pedido» fuera de pantalla sin scroll); tras la corrección, ninguna | OK tras C |

«No recortados»: un nodo cuyo borde toca el borde de la ventana, la cabecera o la barra de pestañas se mide recortado por el viewport (p. ej. el rótulo «Español» a 32 dp bajo la cabecera); su altura real se midió en una captura sin recorte (los selectores de Cuenta miden 48 dp: `Español`… `System/Light/Dark` 48,0 dp). Esas filas se etiquetan `CLIPPED` en los análisis y no cuentan como incumplimiento.

Barra de pestañas (H-6): cada pestaña mide **96,0 × 48,5 dp** en Android a 1.0–2.0 (91 px) y **100,7 × 48,7 pt** en iOS a large–AX5. Cumple 48 dp / 44 pt a todas las escalas.

## Matriz por pantalla (flujo crítico y componentes afectados)

Pasos comunes: fijar la escala, relanzar, abrir el enlace, capturar y medir; luego desplazar al final y repetir. «Target» = el menor control no recortado de la pantalla.

| Pantalla / componente | Android 1.0 – 1.3 | Android 1.5 | Android 2.0 | iOS large – AX1 | iOS AX3 | iOS AX5 |
|---|---|---|---|---|---|---|
| Inicio: cabecera, buscador, banner | target 48 dp; sin truncado | ídem | buscador en una línea (tope 1.5); banner y puntos completos; target 48 dp | ídem | ídem | ídem; título del banner en 3 líneas, nada bajo la barra |
| **H-7** fila de categorías | 8 dp (iguales a antes) | separación 12 dp (≈ 25 px) entre rótulos (`a-15-home-cats.png`); el 4.º sale por el borde de una fila que desplaza | separación 16 dp (≈ 33 px) (`a-20-home6.png`); targets 127,5 × 116,3 dp | rótulos separados | ídem | rótulos de 2 palabras en 1–2 líneas |
| Tarjetas de producto de Inicio (Más vendidos, Nuevos, Ofertas) | completas | completas | completas (`a-20-home5.png`) | completas | completas (`i-ax3-home-bot.png`) | **antes** «Complet / e Daily», «$233.8 / 2»; **después** nombre y precio enteros (`i-ax5-home-fix2.png`) |
| **G-4/S-8** barra Ordenar / Filtros / chips | ambos botones dentro del 1.er viewport; 58 dp de alto | ídem | «Sort: Featured» + «Filters» enteros, 3.er chip asoma (`a-20-category-fix.png`) | ídem | ídem (`i-ax3-category-top.png`) | **antes** «Filtro / s»; **después** «Ordenar: Destacados» en 2 líneas y «Filtros» entero (`i-ax5-category-fix1.png`) |
| Scroll del chip seleccionado | — | — | «Subscribe & save» se activa y queda **entero** dentro del borde con 16 dp de margen (`a-20-chips2.png`) | — | — | «Suscríbete y ahorra» crece 245 → 271 pt y queda entero, margen 16 pt (`i-ax5-chips2.png`) |
| Hojas Ordenar / Filtros | — | — | Cerrar / Cancelar / Aplicar visibles y de 57–58 dp (`a-20-filters.png`) | — | — | validadas en T6a/Día 3 (topes `optionLabel`, `sectionHeading`, `actionLabel`) |
| Cuadrícula de categoría | completa | completa | 1 columna; nombre y precio enteros (`a-20-category-bot.png`) | completa | completa | 1 columna; nombre y precio enteros |
| **H-12** esqueleto de Inicio y de la cuadrícula | — | — | alturas de líneas y ancho de tarjeta crecen con el texto (`a-20-skel-home.png`, `a-20-skel-grid.png`) | — | — | idem (`i-ax5-skel-home.png`, `i-ax5-skel-grid.png`); «Cargando Inicio…» en 2 líneas |
| Detalle de producto + barra de compra | barra ≈ 22 % de pantalla a 2.0; «Agregar al carrito» en 1 línea | ídem | todo alcanzable; cantidad 48 × 54 dp (`a-20-share-error.png`) | ídem | ídem | la barra con tope 2.0 ocupa ≈ 23 % de la pantalla (sin tope era 43 %, medido en el Día 5); contenido alcanzable al desplazar (`i-ax5-share-error.png`) |
| **Error de compartir** + «Reintentar compartir» | — | — | **bajo la barra no queda**: al aparecer, el mensaje y el botón se desplazan a la vista (`a-20-share-error.png`); botón 58 dp | — | — | mensaje de 3 líneas y botón de 332 × 58 pt completos sobre la barra (`i-ax5-share-error.png`) |
| `MessageScreen` (escáner: primera pantalla) | — | — | 1 pantalla, «Continue»/«Close» 58 dp (`a-20-scanner.png`) | — | — | no cabe: **desplaza**; «Continuar» y «Cerrar» de 370 × 90 pt alcanzables (`i-ax5-scanner1.png`) |
| **«Consultando producto…»** (cámara) | — | — | «Looking up product…» en 2 líneas, cámara y «Cancel» visibles (`a-20-querying.png`) | — | — | **antes** «Consultand / o»; **después** «Consultando / producto…» entero y «Cancelar» a 90 pt (`i-ax5-scanner3.png`) |
| Búsqueda (historial) | — | — | campo 48 dp; placeholder con «…» (ver D) y nombre accesible completo; «Clear all» 58 dp | — | — | campo, historial y «Borrar todo» enteros (`i-ax5-search.png`) |
| Carrito | completo; cantidad, ± y «Delete» ≥ 48 dp | ídem | «Continue to checkout» sobre la barra (`a-20-cart-bot.png`) | ídem | ídem | botón de 2 líneas, todo alcanzable (`i-ax5-cart-bot.png`) |
| Checkout (formulario) | campos 48 dp+ | ídem | rótulos largos en 2 líneas; «Continue» alcanzable (`a-20-checkout-bot.png`) | ídem | ídem | alcanzable al desplazar (`i-ax5-checkout-top.png`) |
| **Estado del pedido** («Pedido en proceso») | texto y 2 botones sin problema | ídem | cabe en una pantalla; botones 58 dp (`a-20-orderstatus2.png`) | ídem | ídem | **antes no cabía y no desplazaba**: «Consultar estado» y «Cancelar espera» empezaban en y = 881 y 1058 pt (> 791 pt de la barra) y no había scroll; **después** `ScrollView`: se alcanzan al desplazar, 370 × 161 pt (`i-ax5-orderstatus0.png` → `i-ax5-orderstatus1.png`) |
| Confirmación + **H-T8-6** | completa | ídem | «Open notification settings» en 2 líneas (palabras enteras), 98 dp; «Try notification again» 58 dp; «Back to cart» sobre la barra (`a-20-confirm-notice.png`) | ídem | ídem | «Abrir ajustes de / notificaciones» enteras (la palabra de 14 letras ya no se parte); los tres botones alcanzables (`i-ax5-confirmation-bot.png`) |
| Cuenta / Mis pedidos | selectores 48 dp | ídem | texto completo; desplazable (`a-20-account-top.png`, `a-20-orders-top.png`) | ídem | ídem | texto completo en 5–6 líneas; el identificador del pedido se parte por ser una sola «palabra» sin espacios (D) |
| Barra de pestañas | 96 × 48,5 dp | ídem | ídem; iconos recortados = H-1/H-11 (T6c) | 100,7 × 48,7 pt | ídem | ídem |

## Hallazgos y acciones

| Hallazgo | Dónde | Acción |
|---|---|---|
| «Consultar estado» y «Cancelar espera» fuera de pantalla y sin scroll | iOS AX5, «Estado del pedido» | **C** `ScrollView` (`testID` `order-status-scroll`) |
| Palabras partidas en el nombre/precio de las tarjetas de Inicio («Complet / e Daily», «$233.8 / 2») | iOS AX5 | **C** `fontScaleLimits.cardText` = 2 en `ProductCard` |
| «Filtros» partida («Filtro / s») | iOS AX5 (G-4/S-8) | **C** solo el 1.er botón del grupo se encoge (`flexShrink` 1; los demás 0) |
| «Consultando» partida («Consultand / o») | iOS AX5 (cámara del escáner) | **C** `fontScaleLimits.screenTitle` = 2 en los títulos del escáner |
| Tarjetas de Inicio con huecos enormes tras cambiar el tamaño con la app abierta (Fast Refresh) | iOS | No es un defecto: es H-10 (medidas obsoletas al cambiar `content_size` en caliente); relanzando sale compacta. Pertenece a T6c |
| Iconos de la barra de pestañas recortados a 1.3 / 1.5 / 2.0 | Android (`a-13-category-top.png`, `a-15-home-cats.png`, `a-20-*`) | **Es H-1/H-11 (= S-4), delegado a T6c**; no es un problema de layout de la barra (la barra y sus targets miden 96 × 48,5 dp y las etiquetas están completas) |

## Correcciones a la evidencia anterior

- El borrador decía que la barra de pestañas medía «180 × 46 px = 23 dp» y que incumplía 48 dp. Era un artefacto: `uiautomator` corta los nodos en y = 1465 px y la barra empieza en 1419. Con `A11y tree` la pestaña mide 180 × 91 px = **96 × 48,5 dp** (coincide con H-6 de `LEARNING.md`). No hay incumplimiento.
- Las medidas en dp del borrador dividían por 2; la densidad real es 300 dpi (1,875 px/dp). Las de este documento usan 1,875.

## Limitaciones

- iOS: se midieron large, AX1, AX3 y AX5; AX2 y AX4 no (los topes de `fontScaleLimits` hacen que AX3–AX5 rendericen igual el cromo acotado, y el contenido libre solo crece).
- No se ejecutó VoiceOver/TalkBack: esta tarea mide layout, no lectura.
- El esqueleto, el error de compartir, el aviso de notificaciones bloqueadas y «Consultando producto…» se vieron con un parche temporal que fuerza el estado (revertido); el layout es el real, el disparo no.
- El Simulator no tiene cámara: la vista de cámara de iOS se ve vacía; el título y el botón son los reales.
- El iPhone físico no existe (decisión previa): iOS = Simulator.
- H-10 (cambiar el tamaño con la app abierta), contraste, movimiento reducido y profiling no son de esta tarea (T6c/T6d).
- La pantalla «Estado del pedido» no se alcanza con un enlace real sin un intento pendiente (RF-38 redirige al checkout); se vio con un parche temporal que quita la redirección y la guarda de «sin intento» (`TEMP-T6B`, revertido).

## Validación automática de esta tarea

- Tests nuevos o cambiados, cada uno con mutación temporal que lo pone en rojo y revertida (hash comprobado): `QuickFilters.test.tsx` (solo el 1.º encoge), `ProductCard.test.tsx` (tope `cardText`), `ScannerScreen.test.tsx` (tope `screenTitle`), `CategoryRow.test.tsx` (separación 8/12/16 dp), `ProductDetailScreen.layout.test.tsx` (el error de compartir se desplaza a la vista), `OrderConfirmationScreen.test.tsx` (tope `actionLabel` del botón de ajustes), `OrderStatusScreen.test.tsx` (texto y botones dentro de un `ScrollView`; RED observado antes del código). Auditoría `text-truncation-audit.test.ts`: solo `TabBarLabel` y el placeholder del buscador usan `numberOfLines`.
- `npm run test:logic` 1327/1327; `npm run test:jest` 507/507 (40 suites); `npm test` exit 0; `npx expo lint` y `npx tsc --noEmit` exit 0; `git diff --check` exit 0; bundles Metro Android/iOS 200.
- Estado final: Samsung `font_scale` 1.0; Simulator `content_size` `large` y `AccessibilityEnabled`/`ApplicationAccessibilityEnabled` = 0.
