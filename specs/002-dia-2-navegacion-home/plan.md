# Plan 002 — Día 2: navegación y Home

## Precondiciones y límite del incremento
- Requiere servidor, i18n y design system del Día 1 validados. No recrea contratos ni tokens. RF-10, RF-16.
- Expo Router y `expo-image` ya están instalados; se comprobará documentación de SDK 57 antes de usar APIs de tabs, stacks y linking. No se añade librería de carrusel ni de test.
- Siete checkpoints de 20–30 minutos priorizan primero navegación ejecutable y luego Home. Si el timebox de 3 horas termina, se conserva el último checkpoint funcional y se continúa sin omitir RF.

## Archivos y responsabilidades
- `src/app/_layout.tsx`: stack raíz, tema, proveedor i18n y presentación modal del escáner; sigue siendo delgado. RF-6, RF-7.
- `src/app/(tabs)/_layout.tsx`: tabs Inicio/Categorías/Carrito/Cuenta, badge derivado y etiquetas localizadas. RF-4, RF-5.
- `src/app/(tabs)/index.tsx`, `categories.tsx`, `cart.tsx`, `account.tsx`: adaptadores de ruta hacia pantallas de features/placeholders.
- `src/app/product/[id].tsx`: adaptación de parámetro a `ProductPlaceholderScreen`. RF-8, RF-9.
- `src/app/scanner.tsx`: modal placeholder que se reemplazará en Día 5 sin cambiar el contrato de navegación. RF-7.
- `src/core/network/api-origin.ts`: selecciona origen configurable para emulator/simulator/físico según documentación del Día 1.
- `src/features/home/contracts/home.ts`: tipos de Home que reflejan `/home`.
- `src/features/home/data/home-client.ts`: cliente fetch mínimo del Día 2, aislado para migrarlo a RTK Query en Día 3 sin tocar la UI.
- `src/features/home/screens/HomeScreen.tsx`: estado load/success/empty/error/offline y composición. RF-10, RF-14, RF-15.
- `src/features/home/components/{HomeHeader,BannerCarousel,CategoryRow,ProductSection}.tsx`: buscador/escáner, carrusel, categorías circulares y secciones.
- `src/features/navigation/screens/{PlaceholderScreen,ProductPlaceholderScreen,NotFoundScreen}.tsx`: destinos explícitos para alcance futuro.
- `src/core/navigation/linking.ts`: parseo/validación de `herbstore://product/:id` y fallback. RF-8, RF-9.
- Recursos i18n existentes: añadir tabs, Home, estados y accesibilidad en es/en. RF-16.
- Retirar `src/app/explore.tsx` y sustituir el `AppTabs` del template una vez que la nueva navegación funcione; no se preserva UI de muestra sin responsabilidad.

## Flujo de navegación y datos
1. El layout raíz monta stack y modal; el grupo tabs mantiene una pila por tab.
2. Cada ruta delega en una pantalla de feature; parámetros inválidos pasan a un estado Not Found con volver/Inicio.
3. Home solicita `/home` mediante el cliente aislado. Su resultado discriminado evita que la pantalla interprete respuestas HTTP.
4. Acciones de banner/categoría/producto producen rutas tipadas; buscador y escáner conducen a placeholders explícitos.
5. El Día 3 reemplaza solo el origen de datos por RTK Query y conserva `HomeScreen`/componentes/estados. RF-10–RF-15.

## Estado e interfaz
- El badge se calcula desde una interfaz de `CartCountSource` inicialmente en cero; el Día 4 conecta el store sin reescribir tabs. RF-4.
- Expo Router conserva pila por tab; la posición de Home se guarda por key de ruta mientras la pantalla permanece montada y se restaura al volver. RF-5.
- `BannerCarousel` usa una lista horizontal con paginación, índice visible y temporizador de 5 s. Interacción, background, invisibilidad y reduced motion cancelan el temporizador; reanudación crea una espera nueva. RF-12, RF-13.
- Cero/uno/múltiples banners tienen ramas explícitas. Las secciones vacías se omiten individualmente y el vacío total muestra reintento. RF-14, RF-15.

## Android, iOS y CNG
- Se mantiene `scheme: herbstore`; no se editan proyectos generados. Si la documentación exige cambio de configuración, se realiza por app config y se recompila Development Build.
- Validar back de Android, gesto/back de iOS, arranque frío y app activa para deep links, y modal en ambos sistemas. RF-5–RF-9, RF-17.
- El origen del mock usa `10.0.2.2`, `localhost` o LAN; `adb reverse` puede usarse en Android físico USB como alternativa local.

## Accesibilidad, i18n y rendimiento
- Tabs exponen rol, selección y badge; el carrusel anuncia posición y dispone de controles manuales; imágenes tienen label/alternativa y dimensiones reservadas. RNF-1, RNF-3.
- Todo texto se obtiene de recursos es/en; no se introducen strings visibles del template. RF-16.
- Reduced motion desactiva autoplay. El temporizador se limpia al perder visibilidad/desmontar para evitar efectos huérfanos. RF-12, RF-13, RNF-2.
- No se memoiza Home sin medición; las secciones reciben props inmutables y keys estables.

## Decisiones y alternativas
- **Elegida:** `Tabs`/`Stack` estables de Expo Router. **Trade-off:** apariencia menos nativa que NativeTabs experimental. **Descartada:** conservar `unstable-native-tabs`, por riesgo didáctico/API.
- **Elegida:** carrusel con primitivas RN. **Trade-off:** se implementa temporizador/índice. **Descartada:** dependencia adicional para una conducta acotada.
- **Elegida:** cliente fetch mínimo aislado. **Trade-off:** se migra en Día 3. **Descartada:** adelantar RTK Query antes de su bloque formativo o acoplar fetch a la pantalla.
- **Elegida:** modal de escáner como placeholder real de navegación. **Trade-off:** aún no abre cámara. **Descartada:** simular escaneo antes del Día 5.

## Verificación
- Sin nuevas dependencias: lint, typecheck, validación manual de rutas, timers con reloj observado, respuestas del mock y Android/iOS.
- Matriz: cambio/reselección de tabs; back; modal; id válido/ausente/inexistente; deep link frío/activo/inválido; Home loading/error/offline/empty; 0/1/N banners; reduced motion.
- Jest/RNTL/Maestro se difieren al Día 6; se documentan casos para automatizarlos allí.

## Bloque pedagógico
- Teoría antes de práctica: layout/ruta, tab/stack, modal/parámetro, deep link y ciclo de vida. RF-1, RF-2.
- Analogías: Expo Router ↔ Navigation Compose/NavHost y SwiftUI NavigationStack; modal ↔ Dialog/sheet/fullScreenCover; params ↔ typed arguments/path values.
- `LEARNING.md` registra decisiones, trade-offs y alternativa descartada; ejercicio de ruta parametrizada; 8–10 preguntas con respuestas; checklist oral; validación dual y commit. RF-3, RF-18, RF-19.
