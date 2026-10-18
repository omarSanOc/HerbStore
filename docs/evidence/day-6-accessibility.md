# Día 6 — T6a: auditoría de lector de pantalla y foco (RF-14, RNF-4)

Fecha: 2026-10-16. Estado: **cerrada con limitación de audio por decisión del usuario (2026-10-16)**: lo observable (foco, orden, nombre/rol/estado y eventos de anuncio) está aprobado en Android e iOS; el audio literal de TalkBack no es verificable con herramientas (ver «Limitaciones registradas»). Los «Pasos de escucha» se conservan como método para quien quiera repetirlos.

## Qué se mide y con qué (y qué NO se mide)

| Plataforma | Herramienta | Qué observa | Qué NO observa |
|---|---|---|---|
| Android (Samsung SM-A037M, Android 13, USB) | TalkBack real activado con `settings put secure enabled_accessibility_services …` + herramienta `A11y` (UiAutomation, ver apéndice) | Árbol con nombre, rol, estado (`CHECKED`, `SELECTED`, `DISABLED`), tooltip (= pista), orden de las paradas, nodo con foco de accesibilidad (`[A11Y-FOCUS]`), flujo de **eventos de accesibilidad** (`VIEW_ACCESSIBILITY_FOCUSED`, `ANNOUNCEMENT` con su texto, `WINDOW_STATE_CHANGED`…) y, en `logcat`, las peticiones al motor de voz (`SamsungTTS [Synthesize]`: cuántas, cuánto dura cada una y cuándo se interrumpen con `onStop`; el texto sale cifrado) | Lo que se oye. Un `ANNOUNCEMENT` demuestra que la app lo envió y una petición TTS posterior demuestra que TalkBack lo encoló, no que se oyó entero. El orden real de TalkBack con deslizamientos tampoco se pudo inyectar: el «orden» de las tablas es el de las paradas de `A11y stops` (aproxima `shouldFocusNode` de TalkBack) |
| iOS (Simulator iPhone 17 Pro, `<ios-simulator-udid>`) | `axe describe-ui` (la misma API UIAccessibility que lee Accessibility Inspector), con `AccessibilityEnabled`/`ApplicationAccessibilityEnabled` a `true` durante la sesión (restaurados a 0) | Etiqueta, rol, valor y orden de lectura del árbol | **«no VoiceOver real»** en todas las filas. No se observan anuncios hablados, el foco real del lector, ni el rasgo *selected* (`traits` sale vacío en `axe` aunque el botón esté seleccionado). La app Accessibility Inspector (GUI) no se pudo automatizar desde aquí: queda como comprobación opcional del usuario |

Condiciones, salvo que la fila diga otra cosa: Android = idioma de la app English, MXN, tema Sistema (claro), `font_scale` 1.0, TalkBack activo; el SO está en español (ver H-N1). iOS = English, MXN, claro, tamaño de texto `large`.

## Inventario de T6a (acción C corregir · V verificar · D decisión escrita)

Los IDs `G-2`, `G-3`, `S-5`, `S-6`, `F-3`, `F-4`, `G-5` solo tienen una frase en `MEMORY.md` de la fase del Día 3 (commit `092435c`, línea «Auditoría Día 6») y en el inventario de `plan.md`; `LEARNING.md` («Hallazgos de T16») solo define `G-6`. Ningún ID asignado a T6a falta; no se inventó ninguno. Interpretación de S-6 («anuncios de vacío/borrado de búsqueda»): los dos anuncios del historial de búsqueda (quitar una entrada y borrar todo), los únicos de esa pantalla.

| ID | Pendiente | Acción | Resultado |
|---|---|---|---|
| G-2 / G-3 | Anuncios «Orden/Filtros aplicado» no oídos; devolver el foco al botón de la hoja | **C** | El foco vuelve al botón que abrió la hoja (cuyo nombre ya dice el nuevo estado) y se retira el anuncio duplicado. Evidencia A-2…A-4 |
| S-6 | Anuncios de quitar/borrar historial no oídos | **C** | El foco va a la entrada vecina (o al encabezado) y el anuncio sale DESPUÉS. Evidencia A-6 |
| S-5 | Vacío de búsqueda con dos encabezados | **C** | Un solo encabezado. Evidencia A-5 / I-4 |
| F-3 | Atrás <0,5 s tras abrir una hoja se pierde | V → **C** | Reproducido con Atrás a <~100 ms (4/4 fallos); corregido (8/8 correctas). Evidencia A-7 |
| G-5 | Swipe rápido sobre el backdrop cierra la hoja (Android) | V + **D** | Reproducido; cualquier toque del backdrop cierra. Decisión en `plan.md` |
| G-6 | Arrastre desde la barra de acciones de la hoja de filtros en iOS | V | Concluyente: no cierra; arrastrar desde el asa sí. Evidencia I-3 |
| F-4 | «Tools» del dev client toma el foco de TalkBack | **D** | Sin Release Android; decisión en `plan.md`. La ausencia de «Tools» en Release iOS la comprueba T6d |
| sin ID | Anuncios de límite/total del detalle y del error de compartir | V (+ tests nuevos) | `ANNOUNCEMENT` observado en Android; tests RNTL nuevos fijan qué y cuándo se anuncia. Escucha pendiente |
| sin ID | `dialogTitle` de compartir no visible | **D** | Se conserva; decisión en `plan.md` |
| sin ID | Gesto de retroceso del borde | V + **D** | Equivale a la tecla Atrás en Android (verificada) y es el gesto nativo en iOS; decisión en `plan.md` |
| — VoiceOver real | Nunca probado | V (Inspector) + **D** | Filas I-* rotuladas «no VoiceOver real» y limitaciones registradas |
| (nuevo) | H-N2 foco perdido tras `replace` en confirmación/estado de pedido | **C** | Evidencia A-8 |
| (nuevo) | H-N3 cerrar el modal del escáner no devuelve el foco al botón | **C** | Evidencia A-9 |
| (nuevo) | H-N4 «Continuar al checkout» habilitado con la pista del carrito vacío | **C** | Evidencia A-10 |
| (nuevo) | H-N1 voz y rol en el idioma del SO, no de la app | **D** | `plan.md` |

## Matriz Android (TalkBack real, Samsung)

Cada fila es repetible con `docs/evidence/day-6-accessibility.md` + la herramienta del apéndice. «Orden» = orden de las paradas de TalkBack de arriba abajo.

| # | Pantalla / componente | Pasos | Observación (nombre / rol / estado / orden) | Resultado |
|---|---|---|---|---|
| A-1a | Inicio | Abrir `herbstore://` | Título «Home»; «Search products» (botón, pista «Opens the product search.»); «Scan a product» (botón); banner = `SeekBar` «…Banner 1 of 2» (ajustable); «Previous banner» `DISABLED`, «Next banner»; encabezados «Categories» y secciones; cada categoría y producto es UN botón con nombre completo («Daily Balance Powder. MX$215.82. Rated 4.9 out of 5, 1,338 reviews. Best seller»); 4 pestañas con rol «Pestaña» y la activa `SELECTED`. Primera parada: «Tools» (solo dev client, F-4) | OK |
| A-1b | Búsqueda: historial | `herbstore://search`, buscar «vit», «zinc», «omega»; limpiar texto | Campo de edición «Search products» con pista; encabezado «Recent searches»; «Clear all»; por entrada: botón con el texto + botón «Remove “zinc” from recent searches» (≥48 dp) | OK |
| A-1c | Búsqueda: resultados / vacío | Buscar «vit» y «zzzq» | Resultados: campo, «Clear text», grupo «Quick filters», encabezado «Results for “vit”», «4 products» (región viva), tarjetas. Vacío: **un** encabezado «No results for “zzzq”», mensaje y «Clear search» (S-5 corregido) | OK |
| A-1d | Lista de categoría | `herbstore://category/vitamins` | Barra «Quick filters» (un grupo; sus botones «Sort: Featured», «Filters», «Available», «4★ or more»…); encabezado «Vitamins»; «60 products» (región viva); tarjetas 2 columnas | OK |
| A-1e | Hoja «Ordenar» y «Filtros» abiertas | Tocar «Sort:» / «Filters» | La app de detrás desaparece del árbol (solo queda la hoja y «Tools»). Orden: título (encabezado), «Close», contenido. Ordenar: 5 `RadioButton` («Featured» `CHECKED` el aplicado). Filtros: encabezados «Brands»/«Subcategories», `CheckBox` con estado, «Cancel» y «Apply» fijos abajo. El foco entra en el título (`VIEW_ACCESSIBILITY_FOCUSED text=[Filters]`); una vez, en la primera carga con opciones, TalkBack terminó en «Brands» y no se repitió en 4 aperturas posteriores | OK (nota) |
| A-1f | Detalle | `herbstore://product/product-261009-002` | Galería = `SeekBar` «Pictures of …, Picture 1 of 2»; marca, encabezado del nombre, valoración hablada («Rated 4.6 out of 5, 502 reviews»), precio, «In stock: 99 units», «Share», encabezados «Description»/«Quantity», «Decrease quantity» (`DISABLED` en 1), `SeekBar` «Quantity, 1 of 99» (ajustable), «Increase quantity», «Maximum available: 99 units.» (permanente), «Total: MX$…» y «Add to cart» fijos | OK |
| A-1g | Carrito | Añadir y abrir pestaña Cart | Encabezado «1 product in your cart»; nombre; «… per unit»; «Subtotal»; «Decrease/Increase quantity of …» y `SeekBar` «Quantity of …, 3»; «Delete …» (alternativa al gesto de deslizar); progreso de envío («Barra de progreso», valor hablado); «Cart subtotal» y «Continue to checkout». Pestaña «Cart, 3 items» (badge hablado) | OK |
| A-1h | Carrito vacío | Tras confirmar un pedido | «Your cart is empty», «Go to Home», «Continue to checkout» `DISABLED` con pista «Add at least one product to continue.» | OK |
| A-1i | Checkout | Continuar al checkout | 8 campos `EditText` con nombre «Full name»…, pista con la regla («Enter at least 3 characters.»); el rótulo visible justo encima YA NO es una parada (H-N5 corregido: antes 8 paradas `TextView` «Full name»… delante de cada campo); «Continue» al final | OK (H-N5 C) |
| A-1j | Checkout con errores | Foco en «Continue» y activar con 7 campos vacíos | Eventos: foco a «Full name» (RHF), `ANNOUNCEMENT` «Review 7 form errors. The name must have at least 3 characters. …», 7 cambios de región viva (un error por campo, `live=1`). TTS: tras el foco del campo se encola una locución de 28,47 s cuyo texto cifrado coincide con el de la parada del resumen (`Zt20AVZK…`): el resumen sí llega al motor de voz, DESPUÉS de la lectura del campo | OK (escucha pendiente) |
| A-1k | Estado de pedido / confirmación | Rellenar con `ACTION_SET_TEXT`, Continue, «Check order status» | «Order in progress» (encabezado, texto, «Check order status», «Cancel waiting»); «Order confirmed» (id, «3 units», «Back to cart»). Ver A-8 para el foco | OK |
| A-1l | Mis pedidos | Cuenta → My orders | Cada pedido es UNA parada: «Order cc936934-…, Oct 16, 2026, 4:25 PM, 1 unit, total MX$278.82» | OK |
| A-1m | Cuenta / preferencias | Abrir Cuenta | Encabezados Language/Price currency/Theme; botones «Español»/«English», «Pesos (MXN)»/«Dollars (USD)», «System»/«Light»/«Dark» con el elegido `SELECTED`; «My orders», «React Native foundations», «Open DeviceInsights» | OK |
| A-1n | Escáner | Home → «Scan a product» → Continue | Cabecera «Close», «Scanner», «Product scanner» + «Continue»/«Close»; con cámara: «Ready to scan» (encabezado y región viva) y «Cancel». La vista de cámara no es un nodo. La vista nativa de DeviceInsights queda sin pista (decisión del usuario) | OK |
| A-1o | 404 | `herbstore://nowhere/zzz` | Título, encabezado «Link not recognized», «Go back», «Go to Home»; flecha del sistema con nombre del SO | OK |
| A-2 | **Foco al cerrar «Ordenar» con una opción** (G-2/G-3) | Foco en «Sort:», abrir, elegir «Price: low to high» | ANTES: foco a ningún sitio (`NO A11Y FOCUS`) y solo quedaba el anuncio. DESPUÉS: `VIEW_ACCESSIBILITY_FOCUSED text=[Sort: Price: low to high]` y `focused` = ese botón. Sin anuncio duplicado | OK |
| A-3 | **Foco al cerrar «Filtros» con Apply** | Abrir, marcar «AsterVale», Apply | DESPUÉS: foco en «Filters, 1 active» (nombre hablado con el recuento); 3 de 3 ejecuciones. (Con un retardo de 120 ms ya sin la corrección del backdrop, una vez TalkBack puso antes el foco en la flecha y la app lo corrigió 214 ms después; con la corrección definitiva no ocurre) | OK |
| A-4 | Foco al cerrar con Close y con Atrás de hardware | Abrir «Sort:»/«Filters», Close / `KEYCODE_BACK` | Foco en el botón que abrió la hoja en 6 de 6 (2 rondas × 3 flujos) | OK |
| A-5 | Vacío de búsqueda | Ver A-1c | 1 encabezado (ANTES 2: «Results for …» y «No results for …») | OK |
| A-6 | **Historial: quitar y borrar** (S-6) | Foco en «Remove “zinc”», activar; luego la última; luego la única; «Clear all» | ANTES: foco al campo de búsqueda y el anuncio se interrumpió (`onStop`) a los ~2 s. DESPUÉS: foco a la entrada siguiente (`[, omega] desc=omega`), a la anterior si era la última y al encabezado «Recent searches» si no queda ninguna; `ANNOUNCEMENT “zinc” removed from recent searches` unos 300 ms DESPUÉS del foco. TTS: etiqueta de la entrada → anuncio (3,95 s) → pista, sin `onStop` entre ellas | OK (escucha pendiente) |
| A-7 | **Atrás justo tras abrir la hoja** (F-3) | `clicktext Filters` + `KEYCODE_BACK` tras 0/150/300/450 ms | ANTES: 0 ms → 2 «perdido» (la hoja se abre igualmente) + 2 «sale la pantalla»; ≥150 ms → 10/10 correctos. DESPUÉS: 0 ms → 8/8 correctos (hoja cerrada, pantalla conservada) | OK |
| A-8 | **Foco tras `replace` a «Order in progress»/«Order confirmed»** | Flujo crítico con TalkBack | ANTES: el foco terminaba en la pestaña «Home» (2 de 2). Con la corrección a 0 ms: en la flecha del sistema. Con 700 ms: en el encabezado de la pantalla («Order in progress», «Order confirmed»), 4 de 4 (TalkBack pone el suyo y la app lo corrige 60-75 ms después) | OK |
| A-9 | **Cerrar el modal del escáner** | Foco en «Scan a product», abrir, «Close» | ANTES: foco al título «Home». DESPUÉS: `VIEW_ACCESSIBILITY_FOCUSED text=[Home]` (TalkBack) y 30-50 ms después `desc=Scan a product`; 3 de 3 | OK |
| A-10 | «Continue to checkout» con productos | Ver A-1g | ANTES: pista «Add at least one product to continue.» con el botón habilitado. DESPUÉS: «Opens the address form to place your order.» | OK |
| A-11 | Límite de stock y total (Día 4) | Con el lector: «Increase quantity» y acción `increment` del control ajustable | Botón: `ANNOUNCEMENT [Quantity 2. Total MX$1,623.80.]` y `[… 3 …]` se encolan sin `onStop`; acción del lector: silenciosa hasta el tope; en 99/99 `ANNOUNCEMENT [Maximum available: 99 units.]` en cada intento | OK (escucha pendiente) |
| A-12 | Añadir al carrito | «Add to cart» | `ANNOUNCEMENT [3 units were added to the cart.]` | OK |
| A-13 | Error de compartir (Día 5) | — | No se pudo provocar un fallo real de `Share` en el Samsung. Cubierto por RNTL (`ProductDetailScreen.announcements.test.tsx`): mensaje visible + «Try sharing again» + un anuncio | Solo Jest; escucha no aplicable |
| A-14 | Gesto de retroceso del borde | Samsung con 3 botones; `enableOnBackInvokedCallback="false"` en el manifiesto | El gesto del SO llega a la app como la misma tecla Atrás, ya ejercitada (A-4, A-7) | D |
| A-15 | G-5 backdrop | Abrir «Sort:»; `input swipe` sobre el backdrop: rápido ↓ 60 ms, rápido ↑ 60 ms, lateral 60 ms, lento 400 ms, toque | Cerró 5 de 5, el lento también | V + D |

## Matriz iOS (Simulator, «no VoiceOver real»)

| # | Pantalla | Observación (etiqueta / rol / valor / orden) | Limitación | Resultado |
|---|---|---|---|---|
| I-1 | Inicio, categoría, búsqueda (historial / vacío), detalle, carrito, checkout, estado, confirmación, Mis pedidos, Cuenta, escáner, 404 | Mismas etiquetas y orden que Android; encabezados con rol `heading`; Atrás nativo «back button» con el título de la pantalla anterior; botón «Share», `slider` «Quantity» valor «1 of 97»; pedidos = un elemento «Order …, Oct 16, 2026 at 4:48 PM, 1 unit, total …»; checkout con 8 `text field` (H-N5 corregido: antes cada uno iba precedido de un `StaticText` con el rótulo; ahora solo el campo) | Los `traits` salen vacíos en `axe`: no se ve «tab» en la barra inferior ni «selected» en Idioma/Moneda/Tema | OK (parcial) |
| I-2 | Hojas «Sort by» / «Filters» | La app de detrás queda fuera del árbol; «Featured» = «radio button, checked», el resto «unchecked»; casillas «checkbox, unchecked»; «Close» sale antes del encabezado (orden geométrico) | No se observa el foco real del lector al abrir ni al cerrar (el evento de foco al botón de origen solo tiene test) | OK (parcial) |
| I-3 | G-6 | Arrastre desde la barra de acciones (de y=790 a 860, 0,15 s y 0,5 s): la hoja NO se cierra. Arrastre desde el asa (y=152 → 700): se cierra | — | V cerrado |
| I-4 | S-5 | Búsqueda «zzzq»: un solo encabezado «No results for “zzzq”» + mensaje + «Clear search» | — | OK |
| I-5 | Checkout con errores | Resumen «Review 7 form errors…» (StaticText) y el error bajo cada campo | No se oye el anuncio ni se ve el foco | OK (parcial) |
| I-6 | Modal del escáner | «Close», «Scanner», «Product scanner», «Continue», «Close» | `axe` lista también la pantalla de debajo: no se puede afirmar que VoiceOver la ignore; el retorno de foco al botón de origen no es observable | Limitación |
| I-7 | Gesto de borde | `axe swipe` desde x=0/1/3 no dispara el gesto de sistema (ya se sabía) | — | D |
| I-8 | Texto del SO | Etiquetas del sistema («Barra de desplazamiento vertical», «Predicciones de escritura», teclado) en español con la app en inglés | Ver H-N1 | D |

## Hallazgos nuevos de esta auditoría (no estaban en el inventario)

- **H-N1** (Android e iOS) TalkBack sintetiza con la voz del idioma del SO (`es-MX`) y los roles del sistema salen en el idioma del SO («Pestaña», «Desplazarse hacia arriba», «Barra de progreso») aunque la app esté en inglés. React Native no fija el idioma de la voz en Android. Decisión D, **aceptada por el usuario** (limitación del SO, sin cambios de código).
- **H-N2** Tras un `replace` a las pantallas de estado y confirmación del pedido, TalkBack dejaba el foco en la pestaña «Home» (el botón pulsado desaparecía). Corregido (A-8).
- **H-N3** Cerrar el modal del escáner dejaba el foco en el título de Inicio. Corregido (A-9).
- **H-N4** Pista incorrecta en «Continue to checkout» habilitado. Corregido (A-10).
- **H-N5** (corregido, decisión del usuario «sí, ocúltalo») El rótulo visible de cada campo del checkout era una parada propia justo antes del campo con el mismo nombre (se leía dos veces). Ahora lleva `aria-hidden` (RN 0.86: `accessibilityElementsHidden` en iOS e `importantForAccessibility="no-hide-descendants"` en Android); el campo conserva `accessibilityLabel`, pista y `testID`, el texto sigue en pantalla y los mensajes de error siguen siendo paradas con `live=1`. Comprobado con el árbol (2026-10-16, mismo estado, Fast Refresh/relanzado):
  - **Android (Samsung, `A11y stops`)** antes: `TextView 'Full name'`, `EditText desc='Full name'`, `TextView 'Phone'`, `EditText desc='Phone'`… (16 paradas en el formulario, rótulos en y=379/545/710…). Después: solo los `EditText` (`desc='Full name'`, `'Phone'`… ids `checkout-*`, mismos `bounds`: 424-514, 590-680…, el diseño no se movió) y, con errores, el resumen, cada campo y su mensaje (`live=1`).
  - **iOS (Simulator, `axe describe-ui`)** antes: `StaticText 'Full name'` (y=238) + `TextField 'Full name'` (y=263)… Después: solo `TextField 'Full name'` (y=263)… mismas posiciones; con 7 errores siguen el resumen, cada campo y su `StaticText` de error.
  - Test automático: `CheckoutScreen.test.tsx` («H-N5», es/en) y mutación temporal (quitar `aria-hidden` -> falla; ocultar también el error -> falla; ocultar el campo -> 42 fallos).
  - Limitación: no se OYE desde aquí; ver el paso 4 de «Pasos de escucha».
- **H-N6** (sin cambio, de la herramienta) El nodo de accesibilidad que devuelve UiAutomation tarda segundos en reflejar un cambio de valor del `SeekBar` de cantidad (`Quantity, 40 of 99` con 99 ya mostrado). El texto y los anuncios son correctos; no es un defecto de la app.
- **H-N7** (sin cambio) Con acciones `increment` muy seguidas (<100 ms) solo cuenta una por render (`stepQuantity` lee la cantidad del render, no del estado). Un usuario no puede accionar tan rápido.

## Limitaciones registradas (T8 las lleva a `LEARNING.md`)

- **Audio literal de TalkBack: no verificable con herramientas.** El motor de voz del Samsung (`SamsungTTS`) cifra el texto en `logcat` (`[Synthesize] text` es opaco), así que desde el hilo de implementación se observa QUE se encoló una locución, su duración y si otra la cortó (`onStop`), pero no QUÉ palabras se pronunciaron ni cómo. Lo observable (orden de paradas, nombre/rol/estado, foco, eventos `ANNOUNCEMENT`) sí se midió y está aprobado. **Decisión del usuario (2026-10-16):** T6a se cierra con esta limitación; no se exige escucha manual.
- **VoiceOver real: no disponible** (sin iPhone físico). Filas `I-*` rotuladas «no VoiceOver real»: no se oyen anuncios, no se ve el foco real del lector y `axe` no expone los rasgos `tab`/`selected`.
- **Android: el teclado y el diálogo de permisos siguen al SO.** Decisión del usuario: no es un defecto de la app, el teclado del sistema y el diálogo de permisos los dibuja el SO con su propio idioma y tema, que pueden diferir de los elegidos en Cuenta. T8 lo documenta.
- **Anuncio de error de compartir (A-13):** solo cubierto por Jest; no se pudo provocar un fallo real de `Share`.

## Pasos de escucha (opcionales; método para repetir la escucha con TalkBack)

Activa TalkBack a mano (Ajustes → Accesibilidad) o con los comandos de `MEMORY.md`; apágalo al terminar. App en English.

1. **Hoja «Ordenar»** (Categoría → «Sort: Featured» → doble toque). Debe oírse «Sort by, encabezado»; elige «Price: low to high» con doble toque. Debe oírse «Sort: Price: low to high, botón…» (el foco vuelve al botón) y NO «Sort applied…».
2. **Hoja «Filtros»**: abre, marca una marca, «Apply». Debe oírse «Filters, 1 active, botón». Repite con «Close» y con Atrás: el foco vuelve a «Filters».
3. **Historial** (Buscar → escribe y envía 3 palabras → vacía el campo): en «Remove “zinc” from recent searches» doble toque. Debe oírse primero el nombre de la entrada vecina y DESPUÉS «“zinc” removed from recent searches» completo. Con «Clear all»: «Recent searches, encabezado» y luego «Recent searches cleared».
4. **Campos del checkout (H-N5)**: en el checkout, desliza a la derecha por el formulario. Cada campo debe leerse UNA sola vez («Full name, campo de edición, …» con su pista) y no debe haber una parada previa que solo diga «Full name». En iOS con Accessibility Inspector: ocho `text field` y ningún `static text` con el rótulo entre ellos.
   **Errores del formulario**: en el checkout con campos vacíos, «Continue». Debe oírse el campo «Full name» y, a continuación, el resumen «Review 7 form errors. The name must…» entero (dura ~30 s).
5. **Detalle**: «Increase quantity» (doble toque): «Quantity 2. Total …». Con el control ajustable (desliza arriba/abajo): lectura del valor. En el tope (hace falta un producto con poco stock): «Maximum available: N units.».
6. **Compartir**: no hay forma de provocar el fallo en el dispositivo; confía en el test.
7. **Modal del escáner**: Inicio → «Scan a product» → «Close». Debe oírse brevemente «Home» y después «Scan a product, botón». Anota si el salto se nota molesto.
8. **Pedido**: tras «Continue» en el checkout debe oírse «Order in progress» (no «Home»), y tras «Check order status» «Order confirmed».
9. **Foco y voz**: anota si la voz en español leyendo texto en inglés te parece un problema real (H-N1).

Con iOS (si dispones de VoiceOver real o de Accessibility Inspector): repite 1–4, 7 y 8; comprueba además que cada hoja deja el foco en su botón y que el tab bar se lee como «tab» y los selectores de Cuenta como «selected».

## Apéndice: herramienta y mediciones

- `A11y` (UiAutomation, `app_process`): órdenes `tree|stops|focused|focus <texto> [n]|click|clicktext <texto> [n]|perform <acción>|scroll fwd|back|settext <texto> <valor>|actions` y `run <archivo>`, que ejecuta un guion (`mark|…`, `sleep|ms`, `sh|comando`, órdenes anteriores) en una sola sesión y escribe cada evento de accesibilidad con su hora. Se ejecuta con `adb shell "CLASSPATH=/data/local/tmp/a11y2.dex app_process / A11y …"`. Fuente en `/private/tmp/…/scratchpad/a11y/A11y.java` (fuera del repositorio; `a11y2.dex` queda en `/data/local/tmp`).
- Correlación con la voz: `adb logcat -v time | grep SamsungTTS` (`[Synthesize] text` cifrado pero determinista: el mismo texto da el mismo cifrado; `generation done … Nsec` da la duración; `Called onStop()` = una locución cortada por otra). El texto de una locución se identifica enfocando un nodo con ese texto y comparando.
- F-3: 0 ms = Atrás inmediatamente después de `ACTION_CLICK` en «Filters» (≈60-100 ms). Antes: 0 ms → perdido, sale la pantalla, perdido, sale la pantalla; 150/300/450 ms → 10 de 10 correctos. Después: 8 de 8 correctos a 0 ms.
- Retardos medidos: el foco de vuelta de una hoja a 60 ms perdió contra el de TalkBack (terminó en la flecha), a 120 ms ganó; la pantalla de estado/confirmación necesita ~700 ms; el retorno del modal ~900 ms desde que Inicio recupera el foco. TalkBack coloca el suyo ~0,5-0,75 s después de `WINDOW_STATE_CHANGED`.
- Estado final restaurado: Samsung con `enabled_accessibility_services` vacío, `accessibility_enabled` 0, `touch_exploration_enabled` 0, `font_scale` 1.0 y `stay_on_while_plugged_in` 3 (sin tocar). Simulator con `AccessibilityEnabled`/`ApplicationAccessibilityEnabled` 0 y `AutomaticMinimizationEnabled` 1.
