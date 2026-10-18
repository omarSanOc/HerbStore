# Día 6 — T6c: contraste, iconos, cambios de texto en caliente y movimiento reducido (RF-13, RF-15, RNF-4)

Fecha: 2026-10-16. Estado: **automático en verde y evidencia en Android e iOS**. Las capturas y las grabaciones viven en el directorio temporal de la sesión, no en el repositorio.

## Identificadores (de dónde sale cada definición)

| ID | Definición (fuente) | Acción en T6c |
|---|---|---|
| H-1 | Iconos de `SymbolView` recortados en Android con fuente grande (`LEARNING.md`, Día 2, «Decisiones del usuario sobre H-1 a H-9»: aceptado, «se revisa en el Día 6») | **C** (corregido) |
| H-11 | No tiene definición propia: aparece siempre como «H-1/H-11» y describe la misma observación en la barra de pestañas (`LEARNING.md`, Día 4: «con `font_scale` ≥ 1,3 los iconos del tab bar de Android salen recortados») | **C** (mismo arreglo) |
| S-4 | Solo consta como «S-4 = H-1» (`docs/evidence/day-5-platform.md`, línea «Auditoría Día 6»); no hay descripción propia | **C** (mismo arreglo) |
| H-10 | iOS: cambiar el tamaño del texto con la app abierta deja textos cortados, también en Home (`LEARNING.md`, Día 3, «Hallazgos de T16», «Pendientes de decisión del usuario») | **C** (corregido en JS) |
| N-4 | Misma observación que H-10 (`LEARNING.md`, Día 2, «N-4. iOS: cambiar el tamaño de texto con la app abierta deja el layout desactualizado»; el propio texto pedía confirmarlo con Ajustes) | **C** |
| N-5 | Android recrea la Activity al cambiar `font_scale` (`LEARNING.md`, Día 2, N-5 «informativa»); es el «`font_scale` con el escáner abierto vuelve a Inicio» | **D** (decisión escrita) |
| S-10 | iOS, el doble espacio se convierte en punto: comportamiento del teclado del sistema, no de la app (`LEARNING.md`, Día 3, «Descripción de seguimientos») | **D** |

## 1. Contraste (RF-13)

**Método.** Función pura `contrastRatio` (luminancia relativa WCAG 2.x) en `src/design-system/contrast.ts`, sin React Native. `contrast.test.ts` (`node:test`) la valida con valores publicados: negro/blanco = 21:1, mismo color = 1:1, `#767676` sobre blanco = 4,54:1 (el gris más claro que pasa 4,5:1) y `#777777` = 4,48:1 (justo por debajo), `#595959` = 7:1. Las paletas se movieron a `palettes.ts` (datos puros) y `contrast-pairs.ts` lista, contra **tokens** y no contra hex, cada par primer plano/fondo que la app dibuja; `contrast-audit.test.ts` mide cada par en las dos paletas con su umbral (texto normal 4,5:1; texto grande, desde 18 pt o 14 pt en negrita 700+, y componentes/bordes/iconos informativos 3:1). Dos escaneos del código lo mantienen honesto: ningún literal de color fuera de las paletas (así se escapó el rojo `#B42318`) y todo `colors.<token>` que lee un componente figura en algún par. Un cambio en `palettes.ts` rompe el test si un par deja de cumplir.

**Tabla medida** (`node src/design-system/contrast-audit.test.ts`; los ratios salen del mismo módulo que usa el test). «Exento» = se mide y se registra, pero WCAG no lo exige (contorno decorativo; componente inactivo):

| Par | Dónde se dibuja | Colores | Categoría | Mínimo | Claro | Oscuro |
|---|---|---|---|---|---:|---:|
| `text/background` | body and label text on the page (lists, forms, messages) | text / background | texto normal | 4.5:1 | 15.46 | 16.69 |
| `text/surface` | text on cards, sheets, headers, fields and outlined buttons | text / surface | texto normal | 4.5:1 | 16.71 | 14.70 |
| `heading/background` | screen titles (28 pt bold) on the page | text / background | texto grande | 3:1 | 15.46 | 16.69 |
| `subheading/surface` | section and banner titles (20 pt) on cards and sheets | text / surface | texto grande | 3:1 | 16.71 | 14.70 |
| `muted/background` | secondary text and loading messages on the page | textMuted / background | texto normal | 4.5:1 | 6.55 | 10.24 |
| `muted/surface` | secondary text on cards, search placeholder, inactive tab label | textMuted / surface | texto normal | 4.5:1 | 7.08 | 9.02 |
| `tab-label-muted/surface` | inactive tab label (10 pt) | textMuted / surface | texto normal | 4.5:1 | 7.08 | 9.02 |
| `muted/border` | fallback text of an image that did not load (on the frame color) | textMuted / border | texto normal | 4.5:1 | 4.68 | 5.04 |
| `on-primary/primary` | label of a selected or primary button, card badge, swipe-to-delete action | onPrimary / primary | texto normal | 4.5:1 | 6.51 | 9.09 |
| `primary/surface` | check mark of the selected option in a sheet | primary / surface | texto normal | 4.5:1 | 6.51 | 9.61 |
| `tab-label-primary/surface` | active tab label (10 pt) | primary / surface | texto normal | 4.5:1 | 6.51 | 9.61 |
| `error/surface` | checkout error text inside a card or notice | error / surface | texto normal | 4.5:1 | 7.08 | 9.53 |
| `error/background` | checkout field error text on the page | error / background | texto normal | 4.5:1 | 6.56 | 10.82 |
| `badge/error` | cart count badge on the tab bar (12 pt) | badge text on error / error | texto normal | 4.5:1 | 7.08 | 12.37 |
| `success/surface` | success token on cards (declared; no screen draws it yet) | success / surface | texto normal | 4.5:1 | 5.04 | 9.31 |
| `success/background` | success token on the page (declared; no screen draws it yet) | success / background | texto normal | 4.5:1 | 4.66 | 10.58 |
| `warning/surface` | warning token on cards (declared; no screen draws it yet) | warning / surface | texto normal | 4.5:1 | 7.48 | 10.11 |
| `warning/background` | warning token on the page (declared; no screen draws it yet) | warning / background | texto normal | 4.5:1 | 6.92 | 11.49 |
| `accent-button/primary` | DeviceInsights native button, accent "primary" | black/white on primary / primary | texto normal | 4.5:1 | 6.51 | 12.47 |
| `accent-button/success` | DeviceInsights native button, accent "success" | black/white on success / success | texto normal | 4.5:1 | 5.04 | 12.09 |
| `accent-button/warning` | DeviceInsights native button, accent "warning" | black/white on warning / warning | texto normal | 4.5:1 | 7.48 | 13.13 |
| `accent-button/error` | DeviceInsights native button, accent "error" | black/white on error / error | texto normal | 4.5:1 | 7.08 | 12.37 |
| `control-border/surface` | border of fields, chips, option rows, steppers and outlined buttons on a card or sheet | controlBorder / surface | componente | 3:1 | 3.74 | 3.62 |
| `control-border/background` | border of the same controls when they sit on the page (filter bar, search field, form) | controlBorder / background | componente | 3:1 | 3.46 | 4.11 |
| `primary/surface-graphic` | active tab icon, selected option outline, spinner on a card | primary / surface | componente | 3:1 | 6.51 | 9.61 |
| `primary/background-graphic` | active carousel dot, spinner and pull-to-refresh on the page | primary / background | componente | 3:1 | 6.02 | 10.91 |
| `primary/border-graphic` | filled part of the shipping progress bar over its track | primary / border | componente | 3:1 | 4.30 | 5.37 |
| `muted/surface-icon` | inactive tab icon, search and clear icons, inactive carousel dot | textMuted / surface | componente | 3:1 | 7.08 | 9.02 |
| `muted/background-icon` | inactive carousel dot and gallery dot on the page | textMuted / background | componente | 3:1 | 6.55 | 10.24 |
| `text/surface-icon` | header close cross, back arrow, carousel step arrows | text / surface | componente | 3:1 | 16.71 | 14.70 |
| `on-primary/primary-icon` | scanner icon inside the filled button of Home | onPrimary / primary | componente | 3:1 | 6.51 | 9.09 |
| `error/surface-outline` | error outline of a field or of the notice box on a card | error / surface | componente | 3:1 | 7.08 | 9.53 |
| `error/background-outline` | error outline of a field or of the notice box on the page | error / background | componente | 3:1 | 6.56 | 10.82 |
| `accent-button/primary-boundary` | DeviceInsights native button, accent "primary", against the page | primary / background | componente | 3:1 | 6.02 | 10.91 |
| `border/surface` | outline of a card or divider on a card | border / surface | exento | exento | 1.51 | 1.79 |
| `border/background` | outline of a card, skeleton block and banner frame on the page | border / background | exento | exento | 1.40 | 2.03 |
| `disabled-stepper` | disabled "+/-" button (opacity 0.4), icon on its surface | text at 40% over background / surface at 40% over background | exento | exento | 2.51 | 3.42 |
| `disabled-add-bar` | disabled "Add to cart" (opacity 0.6): label over its fill | onPrimary at 60% over surface / primary at 60% over surface | exento | exento | 2.77 | 4.22 |

**Qué se corrigió** (cambio mínimo, sin bajar umbrales):

| Defecto | Antes | Después | Cómo |
|---|---|---|---|
| Rojo de error `#B42318` escrito a mano en `AddressForm` y `CheckoutNotice`: en oscuro era casi ilegible | 6,57:1 / 6,08:1 sobre tarjeta / página (claro); **2,46:1 / 2,79:1 (oscuro)** | 7,08 / 6,56 (claro); **9,53 / 10,82 (oscuro)** | Usan `colors.error` (token que ya existía y no se usaba) |
| Texto secundario sobre el marco de una imagen que no cargó (claro) | 4,41:1 | 4,68:1 | `textMuted` claro `#506055` -> `#4D5C51` (imperceptible; también sube 6,18 -> 6,55 sobre la página y 6,68 -> 7,08 sobre tarjeta) |
| Borde de los controles (campos, chips, filas de opción, botones con contorno, pasos de cantidad, buscador) | 1,51 / 1,40 (claro), 1,79 / 2,03 (oscuro) | **3,74 / 3,46 (claro), 3,62 / 4,11 (oscuro)** | Token nuevo `controlBorder` (`#78887C` / `#657D6C`) en los 10 puntos de control; `border` queda para lo decorativo (tarjetas, esqueletos, marcos) |
| Insignia del carrito: la del navegador pinta texto blanco sobre `rgb(255, 59, 48)` (la app no le da tema) | **3,55:1** con texto de 12 pt, en los dos temas | 7,08:1 (claro, blanco sobre `#A52A2A`); 12,37:1 (oscuro, negro sobre `#FFB4AB`) | `getTabBarBadgeStyle(colors)` rellena la insignia con `colors.error`; el navegador elige el color del texto con su regla YIQ (copiada en `navigationBadgeText` y probada) |

Mutación: con `controlBorder` = `border` y `textMuted` antiguo, `contrast-audit.test.ts` falla en exactamente `muted/border`, `control-border/surface`, `control-border/background` (claro) y en «el borde de un control es más fuerte que el decorativo»; restaurado y en verde (84/84).

**Verificación visual** (capturas `a-dark-01-list`, `a-dark-02-home`, `i-dark-01-cart`, `i-dark-04`, `a-00-now`): Samsung con `cmd uimode night yes` (restaurado a `no`) y Simulator con `simctl ui appearance dark` (restaurado a `light`). Claro y oscuro: los chips, el buscador, los pasos de cantidad y «Eliminar» se distinguen por su contorno; la insignia del carrito se lee (blanco sobre rojo oscuro en claro; número oscuro sobre rosa en oscuro); los errores del checkout (resumen, borde y texto de cada campo) ya son legibles en oscuro. **Limitación:** la comprobación a ojo la hizo el agente sobre capturas; la aprobación visual es del usuario (ver el final).

## 2. H-1 / H-11 / S-4: iconos recortados

**Reproducción (Samsung, Android 13).** `font_scale` 1.3 y 2.0 con Home abierta (espera 14 s): las cuatro pestañas, la lupa del buscador, el icono del escáner y las flechas del carrusel salen recortados (a 2.0 queda un cuarto del glifo; `a-icons-before-1.3.png`, `a-icons-before-2.0.png`).

**Causa** (lectura de `node_modules/expo-symbols/build/SymbolView.js`, versión 57.0.3): en Android `SymbolView` es `<View style={{ width: size, height: size }}><Text style={{ fontFamily, fontSize: size, lineHeight: size }}>glifo</Text></View>`. El `Text` escala con `font_scale` y la caja no. La barra de pestañas no tiene la culpa: sus objetivos miden 96 × 48,5 dp a todas las escalas (T6b).

**Prueba de que la causa es el tamaño de la caja y no solo el factor** (dos intentos en el dispositivo): dividir el tamaño de fuente por el factor sin tocar la caja deja el glifo recortado igual (la caja que `SymbolView` da al `Text` es la pequeña); hay que dividir la fuente **y** declarar la caja entera mediante `style`, que `SymbolView` aplica después de la suya.

**Corrección.** `AppIcon` mantiene el tamaño pedido en Android: `fixedIconGeometry(size, fontScale)` (puro, `icon-size.ts`) devuelve la caja `size × size` y la fuente `size / fontScale`; el sistema la multiplica de vuelta. En iOS no hace nada (un SF Symbol es un número fijo de puntos). Tests: `icon-size.test.ts` (4) y `AppIcon.test.tsx` (6: 1, 1.3, 1.5, 2; iOS sin compensar; sigue siendo decorativo). Mutación: con la compensación quitada, 3 de 6 tests fallan.

**Evidencia** (Samsung; `a-after-1.0|1.3|1.5|2.0.png`, recortes `a-tab-1.3.png`/`a-tab-2.0.png` frente a `a-tab-before-*`): a 1.3, 1.5 y 2.0 los cuatro iconos de pestaña, la lupa, el escáner y las flechas salen enteros y del mismo tamaño que a 1.0. Objetivos de pestaña a 2.0 con `A11y tree`: 180 × 91 px = **96 × 48,5 dp** (>= 48). iOS AX5 relanzando (`i-ax5-home`): el SF Symbol nunca se recortó (iconos de pestaña, lupa y escáner enteros). Resultado: **OK en ambos**.

**Decisión sobre el icono de la X del escáner** (`ScannerHeaderCloseButton`, dos `View` por H-1): se deja como está; funciona y migrarla a `AppIcon` no aporta nada medible.

## 3. H-10 (= N-4): texto cambiado con la app abierta

**Android.** Cambiar `font_scale` recrea la Activity (el manifiesto generado declara `configChanges="…|uiMode|…"` sin `fontScale`): la app arranca de nuevo con todas las vistas medidas al tamaño nuevo, así que no hay nada obsoleto. Con **Ajustes reales** (Pantalla > Tamaño y estilo de fuente, slider al máximo -> `font_scale` 2.0; `a-settings-font*.png`, `a-settings-app-after.png`): al volver a HerbStore Inicio sale correcta a 2.0, sin medidas viejas. Restaurado a 1.0.

**iOS: reproducido.** Dos caminos con el mismo resultado: (a) `simctl ui booted content_size` en vivo y (b) la app **Ajustes real del Simulator** (Accesibilidad > Pantalla y tamaño del texto > Texto más grande, slider de `large` a AX5, y volver a HerbStore): los textos crecen pero sus cajas no (título del banner cortado, «Buscar suplementos» cortado, rótulos de categorías cortados, `i-02-ax3-hot`, `i-set-13-after-settings`). Con la app en segundo plano mientras se cambia (Ajustes) también ocurre cuando antes estaba medida a un tamaño menor; si ya estaba medida al tamaño al que se cambia no se nota (por eso un primer intento salió «limpio»: la app venía de AX5).

**Causa** (lectura de React Native 0.86): `RCTFabricSurface` actualiza `layoutContext.fontSizeMultiplier` al recibir `UIContentSizeCategoryDidChangeNotification`, pero ningún nodo `Text` se marca sucio, así que Yoga reutiliza la medida de antes; el glifo se dibuja con el multiplicador nuevo dentro de una caja del tamaño viejo.

**Corrección en JS.** `AppText` (el único `Text` de la app) lleva como `key` el factor de fuente en iOS (`textRemeasureKey`, puro): un tamaño nuevo remonta el `Text`, que se mide de nuevo; sus padres y su estado (navegación, formularios) no se tocan. `useFontScale` es una sola suscripción compartida a `Dimensions.change` (un `useSyncExternalStore` que solo avisa si cambia el factor). En Android no hay `key`. Tests: `font-scale-key.test.ts` (3), `AppText.test.tsx` (4: iOS remonta al cambiar, no remonta con el mismo tamaño, Android no remonta). Mutación en dispositivo: con la `key` quitada y la app limpia en `large`, el cambio a AX5 vuelve a dejar los textos cortados (`i-set-11-mut-fresh`, `i-set-13-after-settings`); con la `key` puesta, por Ajustes reales (`i-set-14-fixed-after-settings`) y en vivo (`i-03-ax3-remount`, `i-05-ax3-hot-fix`, `i-08-list-ax3`) el layout sale completo (título del banner en tres líneas, buscador, categorías, tarjetas de la lista).

**Lo que no cambia con el arreglo (y no es un defecto):** el *placeholder* y el texto escrito de un `TextInput` nativo se dibujan al tamaño con el tope de su campo (1.5 en el buscador); en vivo y tras relanzar son idénticos (`i-13-search-ax3-fix` frente a `i-15-search-relaunch`), por lo que un `TextInput` no necesita la `key` (se probó un `AppTextInput` y se retiró: sin beneficio medible).

## 4. `font_scale` con el escáner abierto (N-5): decisión

**Reproducción (Samsung).** Home -> botón del escáner (pantalla previa «Escáner de productos», sin permiso concedido; no se tocó el permiso) -> `font_scale` 1.0 -> 1.3 con la app abierta (`n5-1-scanner.png`, `n5-2-after-1.3.png`). `logcat`: `Override config changes=40000000` (`CONFIG_FONT_SCALE`), `Destroying surface … MainActivity` y un nuevo `Running "main"`; la app vuelve a **Inicio** y el escáner desaparece.

**Por qué.** `MainActivity` no declara `fontScale` en `android:configChanges`, así que Android destruye y recrea la Activity; el árbol de React se monta otra vez desde la ruta inicial (el store Redux y MMKV sobreviven: el carrito conserva sus líneas). Es el equivalente de `onConfigurationChanged` no gestionado frente a un `UIContentSizeCategoryDidChange` de iOS, que no recrea nada.

**Decisión: D (decisión escrita), sin plugin de `configChanges`** (decisión del usuario/plan). Ver `plan.md`, «Decisiones de T6c».

## 5. S-10: decisión

iOS convierte «doble espacio» en «. » con el atajo del teclado del sistema (Ajustes > General > Teclado > «Atajo “.”»). React Native no tiene ninguna propiedad para ese atajo (solo `autoCorrect`, `spellCheck`, `smartInsertDelete`; lectura de `TextInput.d.ts` 0.86) y `UITextInputTraits` tampoco. **D:** se deja el comportamiento del sistema; la búsqueda ya normaliza los espacios y el usuario puede desactivar el atajo en su teclado. Descartado: interceptar `onChangeText` para deshacerlo (pelea con el IME y rompe la composición de otros idiomas).

## 6. Movimiento reducido (RF-15)

**Inventario** (todo lo que se mueve; `reduced-motion-audit.test.ts` falla si aparece algo nuevo sin decidir):

| Qué se mueve | Con movimiento reducido | Prueba |
|---|---|---|
| Mensaje «agregado al carrito» (`AddToCartFeedback`, Reanimated) | opacidad 1, desplazamiento 0, escala 1 desde el primer fotograma; mismo texto y mismo tiempo en pantalla | `AddToCartFeedback.test.tsx` (4) + `add-feedback.test.ts` |
| Autoplay del carrusel de Inicio (5 s) | **apagado**; el botón «siguiente» y el gesto `increment` saltan (`animated: false`) | `BannerCarousel.test.tsx` (5) + `carousel-autoplay.test.ts` |
| Galería del producto (pasos por lector de pantalla) | salta, mismo resultado | `ProductGallery.test.tsx` (2) |
| Hojas inferiores (Gorhom) | `overrideReduceMotion = Always`: saltan a su posición | `AppBottomSheet.reduced-motion.test.tsx` (2) |
| Aparición de imágenes (`expo-image`, 200 ms) | `transition = 0` | `RemoteImage.test.tsx` (3) |
| Desplazamiento al chip/error de compartir (`useScrollReveal`) | sin animación | `QuickFilters.test.tsx`, `ProductDetailScreen.layout.test.tsx` (+1 cada uno) |
| Spinner del pie de listas | omitido, queda el texto | `ProductListView.test.tsx` (Día 3) |
| **Spinner de «Restaurando carrito…» y de «Cargando producto…»** | **omitido, queda el título** (corregido en T6c: antes giraban) | `CartRestoring.test.tsx` (2), `ProductDetailScreen.reduced-motion.test.tsx` (2) |
| Atenuación al pulsar (16 usos en 13 archivos) | sin atenuación | `AppButton.test.tsx` + auditoría de código |
| Deslizar para eliminar (`ReanimatedSwipeable`) | sigue al dedo (manipulación directa); Reanimated usa `ReduceMotion.System`; el botón visible de «Eliminar» de cada línea es la alternativa sin movimiento | **ya no es D:** evidencia en Android e iOS con movimiento reducido (caso 8a) en [`day-6-cart-swipe.md`](day-6-cart-swipe.md), §T6f (RF-29) |
| Insignia del carrito (150 ms de aparición, la del navegador) | termina en la insignia estática; no hay API para quitarla | D |
| Transiciones de pantalla y de modal (pila nativa) | las gobierna el sistema (ver limitaciones) | D |

**Android (Samsung SM-A037M).** Valores previos: `animator_duration_scale`, `transition_animation_scale` y `window_animation_scale` = 1.0. Pasos: los tres a 0 (`adb shell settings put global …`), `am force-stop` + enlace del dev client, observar. Observaciones: `[Reanimated] Reduced motion setting is enabled on this device` en `logcat` (Reanimated lee el ajuste); 26 s en Inicio sin ninguna línea `[BannerAutoplay] armed` y con el banner 1 («Banner 1 of 2» por `A11y tree`, `a-rm-01-home-t26.png`); «siguiente» -> «Banner 2 of 2» y la captura inmediata ya lo muestra completo (`a-rm-02-crop.png`); producto -> «Add to cart»: el mensaje «1 unit was added to the cart.» sale opaco y en su sitio (`a-rm-03-add-2-c.png`, `a-rm-04-add-s.png`), y la insignia sube de 1 a 3; hoja «Sort by» abierta y completa a los 0,6 s (`a-rm-05-s.png`). **Restaurados a 1.0 los tres** (verificado) y `font_scale` 1.0.

**iOS (Simulator iPhone 17 Pro, iOS 26.5).** Valor previo: `com.apple.Accessibility ReduceMotionEnabled` = 0. Pasos: `xcrun simctl spawn booted defaults write com.apple.Accessibility ReduceMotionEnabled -bool true`, relanzar la app (el ajuste se lee al arrancar; el comportamiento lo confirma: sin autoplay y con saltos), grabar con `xcrun simctl io booted recordVideo --codec=h264`, restaurar a `false`/0 y relanzar. **Grabaciones** (en el directorio temporal, NO en el repo; el disco tenía 2,0 GiB libres y pesan 4,5 MB y 0,3 MB): `…/scratchpad/ios-reduced-motion.mp4` (34 s) y `…/scratchpad/ios-reduced-motion-sheet.mp4` (10 s). Fotogramas (extraídos con AVFoundation a intervalos de 20-100 ms):

| Tiempo del vídeo | Qué se ve |
|---|---|
| 4,0 / 8,0 / 11,5 s | Inicio con el banner 1; **sin autoplay** (con movimiento habría pasado al 2 a los 5 s) |
| 12,70-12,78 s -> 12,80 s | Banner 1 -> **banner 2 completo en un solo paso de 20 ms**: sin posiciones intermedias (salto) |
| 17,3 s | Al abrir la categoría **la pantalla entra deslizándose desde la derecha**: la pila nativa de iOS sigue deslizando con Reduce Motion (ver limitaciones) |
| 31,1 s | «Se agregó 1 unidad al carrito.» aparece **opaco y en su sitio en el mismo fotograma** en que la insignia pasa de 1 a 2; los fotogramas siguientes son idénticos |
| `…-sheet.mp4` 4,90 -> 4,95 s | Hoja «Ordenar por» con su fondo oscurecido: **ausente y completa en 50 ms, sin posiciones intermedias** |

**Limitaciones registradas.**
1. **Transiciones de pantalla de iOS:** la pila nativa sigue deslizando con Reduce Motion (fotograma 17,3 s); iOS solo las cambia por fundido con «Preferir transiciones de fundido». **D:** no se usa `animation: 'fade'` de `react-native-screens`, que sustituye el animador del sistema por uno propio (en el código de la 4.26.2 el gesto interactivo de borde solo se mantiene con `customAnimationOnSwipe`, y T6a validó el gesto de borde); no medido en dispositivo. En Android el ajuste del sistema quita las transiciones (`window_animation_scale` 0).
2. **Samsung sin grabación:** no se grabó vídeo del Samsung; sus capturas tardan unos 0,3 s, así que un fundido de 180 ms no se distingue con o sin movimiento. La diferencia con movimiento (el mensaje empieza transparente y desplazado) la fijan los tests, que fallan si el mensaje empieza transparente con el ajuste activo.
3. iOS: `axe describe-ui` quedó vacío tras relanzar (AccessibilityEnabled = 0): los toques fueron por coordenadas.

## 7. Estado en que quedó el entorno

Samsung SM-A037M: `font_scale` 1.0, `animator/transition/window_animation_scale` 1.0, modo noche `no`, `stay_on_while_plugged_in` 3 (sin tocar; T8 lo restaura), idioma/moneda/tema de la app sin cambios. Simulator: `content_size` `large`, `appearance` `light`, `ReduceMotionEnabled` 0, `AccessibilityEnabled` 0, app en español. Metro (8081) y mock (3001) en marcha, sin tocar.

## 8. PENDIENTE DE VALIDACIÓN MANUAL (usuario)

Lo observado por el agente es automático (capturas, árboles, fotogramas). Pasos para comprobarlo a simple vista:

- **Iconos de la barra de pestañas (Samsung).** Ajustes > Pantalla > Tamaño y estilo de fuente: slider al máximo (1.5 y 2.0 equivalen a `settings put system font_scale 1.5|2.0`). Con la app abierta (se recrea) deben verse enteros y del mismo tamaño los iconos de Inicio, Categorías, Carrito y Cuenta, la lupa, el escáner y las flechas del carrusel, y las etiquetas completas. Restaurar el slider al valor por defecto (`font_scale` 1.0).
- **Tema claro/oscuro (Samsung e iOS).** Cuenta > Tema: Claro, Oscuro y Sistema. Comprobar que los contornos de chips, buscador, pasos de cantidad y botones con contorno se distinguen, que la insignia del carrito se lee y que, en el checkout, enviar el formulario vacío muestra el resumen y los errores en un color legible en oscuro.
- **Texto en caliente (iOS).** Con la app abierta en Inicio, Centro de control > Tamaño del texto (o Ajustes > Accesibilidad > Pantalla y tamaño del texto > Texto más grande) hasta AX5 y volver: ningún título, buscador ni rótulo debe quedar cortado. Restaurar a «large».
- **Movimiento reducido.** Samsung: `adb shell settings put global animator_duration_scale 0` (y `transition_animation_scale`, `window_animation_scale`) o «Quitar animaciones» en Ajustes > Accesibilidad > Mejoras de la visibilidad; Inicio no avanza solo, «siguiente» salta, «Agregar al carrito» muestra el mensaje opaco y la hoja de ordenar aparece completa. Restaurar a 1.0. iOS: Ajustes > Accesibilidad > Movimiento > Reducir movimiento; relanzar la app; mismas comprobaciones (la pila sigue deslizando: limitación 1). Restaurar el ajuste.

## 9. Comprobación en dispositivo de §8 (revisión del reviewer, ronda 2, 2026-10-17)

El agente ejecutó los pasos de iconos de la barra de pestañas (Samsung) y de texto en caliente (iOS). **Observado por herramientas y capturas; pendiente de confirmación visual del usuario** (no se declara «aprobado»). Capturas en el directorio temporal de la sesión: Android `shots/r2-f{1.5,2.0}-and-{light,dark}.png`, iOS `r2/ios-fs-{0-large-base,1-ax5-hot,2-ax5-hot-dark,3-large-hot}.png`. Tema «Sistema» (claro con `cmd uimode night no`, oscuro con `night yes`), inglés + MXN, Inicio.

| Plataforma | Condición | Pasos | Observación | Resultado |
|---|---|---|---|---|
| Samsung SM-A037M | `font_scale` **1.5**, claro y oscuro | `settings put system font_scale 1.5`, espera 16 s (la app vuelve a Inicio), captura; `cmd uimode night yes`, captura | `A11y tree`: las cuatro pestañas miden 180 × 91 px (96 × 48,5 dp) cada una, en `y` 1419-1510. Capturas: los cuatro iconos (casa, cuadrícula, carrito, persona) se ven **enteros** y del mismo tamaño; etiquetas «Home», «Categories», «Cart», «Account» completas y sin recorte; la lupa, el botón del escáner y las flechas del carrusel enteros. En claro y en oscuro | observado: sin recortes; pendiente de confirmación visual del usuario |
| Samsung SM-A037M | `font_scale` **2.0**, claro y oscuro | Ídem con 2.0 (espera 16 s) | Misma geometría de la barra (180 × 91 px por pestaña: la barra no crece, el texto de las etiquetas queda topado). Iconos **enteros**; etiquetas completas, **pegadas al borde inferior** de la barra (unos pocos px) (el texto grande cabe justo; ninguna letra cortada en las capturas). El título «Home» del encabezado y el tamaño de las pestañas no crecen con 2.0 (topes de fuente); el contenido sí (el título del banner pasa a 2 líneas y su texto a 3). Ningún icono ni etiqueta recortado | observado: sin recortes (etiquetas ajustadas al borde); pendiente de confirmación visual del usuario |
| Simulator iPhone 17 Pro | `content_size` `accessibility-extra-extra-extra-large` en caliente (sin relanzar), Inicio | `xcrun simctl ui booted content_size accessibility-extra-extra-extra-large`, espera 4 s, captura; luego `appearance dark` y captura | Con la app abierta el contenido **se reescala sin relanzar**: el título del banner pasa de 1 línea a «Plant- / powered / collection» (≈ 3 × tamaño), el campo de búsqueda crece (placeholder «Search supplements» mayor) y el botón del escáner se agranda. El título del encabezado «Home» y las etiquetas de la barra de pestañas **no cambian** (topes de fuente / nativos). Sin texto cortado en lo visible. En oscuro: mismos tamaños | observado: sin texto cortado; pendiente de confirmación visual del usuario |
| Simulator iPhone 17 Pro | `content_size` `large` en caliente (vuelta) | `xcrun simctl ui booted content_size large`, espera 4 s, captura | El layout **vuelve al de `large`** (banner de 1 línea, buscador y carrusel como en la línea base): **no se observó el layout viejo** anotado como conocido (H-10/N-4, corregido con la `key` de `AppText` en T6c); no hay una captura de la «línea base» tomada antes del cambio con la misma escena (el carrusel avanza solo), pero la geometría coincide con la de §7 | observado: sin layout atascado; pendiente de confirmación visual del usuario |

Defectos: ninguno. Los tres ajustes volvieron a su valor (`font_scale` 1.0, `large`, `night no`/`light`).
