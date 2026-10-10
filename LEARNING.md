# LEARNING.md — Registro acumulado de aprendizaje de HerbStore

Perfil de partida: desarrollador Android sénior (Kotlin, Compose, Coroutines/Flow, Clean Architecture, MVVM) que aprende React Native y Swift/SwiftUI. Las explicaciones están en español; el código y los identificadores, en inglés.

## Día 1 — Fundamentos y preparación del entorno

Estado: **completado y validado en Android e iOS** (tema claro/oscuro, idioma es/en y accesibilidad), con comprobaciones automáticas en verde y commit del día creado.

Qué hay al terminar el día (spec `specs/001-dia-1-fundamentos-setup`):
- Entorno: Expo SDK 57.0.27, React Native 0.86.3, React 19.2.3, Hermes y New Architecture, con Development Build en Android y iOS (nunca Expo Go).
- `mock-server/`: servidor Express + Faker con seed fija, 300 productos deterministas, filtros, búsqueda, orden, paginación y órdenes idempotentes (37 tests con `node:test`).
- `src/core/i18n` y `src/design-system`: textos es/en, tokens, tema claro/oscuro, `AppText`, `AppSurface`, `AppButton`, font scaling y reduced motion.
- `src/features/foundations`: pantalla didáctica de componentes, props, estado, ref, efecto con cleanup y Flexbox.

Cada bloque teórico se lee en 10 minutos o menos (RF-1) y se practica justo después en la app.

---

### Bloque 1 — Cómo se ejecuta una app React Native (≈8 min)

**Hilos.** Una app RN corre sobre tres grupos de hilos:

| Hilo | Qué hace | Analogía Android | Analogía iOS |
|---|---|---|---|
| JavaScript | Ejecuta tu código en Hermes: componentes, hooks, lógica, reducers, `fetch`. Aquí se hace el *render* de React (calcula el árbol de elementos). | No existe un hilo equivalente; es como un único `Dispatcher` propio donde corre todo tu código de presentación | Un único serial queue propio |
| UI (principal) | Crea y actualiza las vistas nativas, recibe táctiles y gestos, dibuja. | Main thread / `Looper.getMainLooper()` | Main thread / `@MainActor` |
| Segundo plano | Trabajo nativo: cálculo de layout del árbol de Fabric, módulos nativos, red, decodificación de imágenes. | `Dispatchers.IO` / `Default` | `DispatchQueue.global` |

Consecuencia práctica: **el hilo JS es un solo hilo y gestiona también los eventos**. Si bloqueas JS con trabajo pesado (parsear un JSON enorme, ordenar 100 000 ítems, un bucle largo), la UI nativa sigue dibujando lo que ya tiene, pero los toques, los `setState` y las animaciones dirigidas desde JS dejan de responder. Es el equivalente a un ANR, pero sin diálogo del sistema: simplemente se percibe como congelación o *jank*. Regla: trabajo pesado fuera de JS (módulo nativo, worklet de Reanimated, servidor).

**Metro.** Es el bundler y servidor de desarrollo: resuelve módulos, transforma TypeScript/JSX con Babel, genera un único bundle y lo sirve por HTTP; mantiene un canal WebSocket para recargas. Es JavaScript puro: **no compila Kotlin, Swift, Gradle ni Xcode**. Analogía: Metro es el "Gradle de la capa JS", pero solo para JS. En este proyecto se arranca con `npx expo start --dev-client`.

**Fast Refresh.** Al guardar un archivo, Metro envía solo el módulo cambiado; React lo vuelve a ejecutar y **conserva el estado de los componentes funcionales** (los `useState`/`useRef` se mantienen) mientras el módulo solo exporte componentes. Los efectos sí se vuelven a ejecutar. Si editas un módulo que exporta algo que no es un componente, se recargan sus dependientes y el estado puede perderse; un error de sintaxis se corrige sin reiniciar. Analogía: *Apply Changes* de Android Studio o *Live Edit* de Compose, y los *Previews* de SwiftUI. **Límite clave:** Fast Refresh no sustituye una recompilación nativa; cambiar una dependencia nativa, `app.json` o un config plugin exige reconstruir el Development Build con Gradle/Xcode.

**Hermes.** Es el motor JavaScript de RN, hecho para móvil. En el build, el bundle se compila a **bytecode** (`.hbc`), por lo que arranca rápido y gasta poca memoria; no usa JIT. Analogía: el bytecode se parece a D8/R8 produciendo DEX en Android, aunque Hermes ejecuta con un intérprete propio, no con ART. Qué cambia para ti: no hay compilación en caliente que "arregle" código lento; medir con DevTools/Profiler antes de optimizar.

### Bloque 2 — New Architecture frente al Bridge anterior (≈8 min)

**Bridge antiguo.** JS y nativo hablaban enviando mensajes JSON asíncronos por una cola (el *bridge*). Todo se serializaba, no había llamadas síncronas, los módulos nativos se cargaban al inicio y el layout se calculaba de forma asíncrona. Es como si Compose y la capa de datos solo pudieran comunicarse por un `Intent` con `Bundle` serializado.

**New Architecture** (obligatoria en SDK 57; `newArchEnabled` ya no se configura):

| Pieza | Qué es | Comparación |
|---|---|---|
| **JSI** (JavaScript Interface) | API en C++ para que JS tenga referencias directas a objetos nativos y los llame sin serializar JSON, incluso de forma síncrona. | JNI en Android; interoperabilidad C/Objective-C++ en iOS. Mucho más cómodo, sin el coste de serializar. |
| **Fabric** | Nuevo renderer. El árbol de vistas se construye en C++ (shadow tree inmutable) y se monta después en vistas nativas; permite lecturas de layout síncronas y las funciones concurrentes de React. | El árbol de `Composable`/`View` que Compose comprueba y luego dibuja; en iOS, el diff de SwiftUI hacia UIKit. |
| **TurboModules** | Módulos nativos tipados, cargados de forma perezosa (solo al usar), expuestos a JS vía JSI. | Módulos Hilt con `Lazy`/inyección diferida; clases Swift inicializadas bajo demanda. |
| **Codegen** | En build genera las interfaces C++/Kotlin/Swift a partir de especificaciones TypeScript tipadas, de modo que JS y nativo comparten un contrato verificado. | Generación de código tipo KSP/kapt, protobuf o Swift macros. |
| **Bridgeless** | Modo en el que el bridge antiguo ya no existe; todo pasa por JSI. | — |

Cuándo notarás la diferencia: menos arranque a pagar, llamadas nativas síncronas posibles, y tipos que atrapan errores de contrato en build. Error típico: asumir que "es lo mismo, pero más rápido". Cambia el modelo (síncrono posible, contratos tipados), no solo la velocidad.

### Bloque 3 — Expo, Development Build y generación nativa (≈8 min)

**Expo vs React Native CLI.**
- *React Native CLI*: plantilla "pelada". Tú posees y editas `android/` e `ios/` en el repositorio; configuración y versiones nativas son tu responsabilidad.
- *Expo*: framework y herramientas sobre RN (Expo Router, SDK de librerías versionadas juntas, `expo install`, EAS). Hoy es el camino recomendado por el equipo de RN, y **no te impide usar código nativo propio**.
- Elegido: **Expo**. Trade-off: dependes del ciclo de versiones del SDK y de sus plugins. Descartado: RN CLI, porque obliga a mantener a mano proyectos nativos que Expo puede regenerar.

**Expo Go vs Development Build.**
- *Expo Go*: app prefabricada con un conjunto fijo de módulos nativos; sirve para demos rápidas, pero no puede incluir tus módulos ni tu configuración.
- *Development Build*: **tu propia app** de desarrollo (con `expo-dev-client`), que incluye las capacidades nativas exactas del proyecto. Cargas el JS desde Metro, igual que en Expo Go.
- Elegido: Development Build (regla de `AGENTS.md`: nunca Expo Go). Trade-off: hay que recompilar tras cambios nativos. Descartado: Expo Go, porque no soporta el Expo Module Kotlin/Swift del Día 5 ni la configuración nativa propia.
- Analogía: Expo Go es como probar en el *Preview* de Studio con una app genérica; el Development Build es tu `debug` variant.

**Generación nativa reproducible (CNG, *Continuous Native Generation*).** `ios/` y `android/` son **salidas generadas** (`npx expo prebuild`, o lo hace `expo run:*`) a partir de `app.json`, `package.json` y los *config plugins*. Por eso están en `.gitignore` y **no se editan a mano**: lo que modifiques ahí se perdería en la siguiente generación. Analogía: son como el directorio `build/` + `AndroidManifest` fusionado por Gradle, en lugar de ficheros que mantienes tú.

**Config plugins.** Funciones que se aplican durante la generación y modifican `AndroidManifest.xml`, `Info.plist`, Gradle o el proyecto Xcode de forma declarativa. Ejemplos reales en este repo:
- `expo-localization` declara `es` y `en` en ambos sistemas (por eso hubo que recompilar).
- `expo-build-properties` fija propiedades de build; `expo-dev-client` añade el menú de desarrollo.
Analogía Android: *manifest merger* + `buildTypes`/`productFlavors` configurados por librerías. Analogía iOS: `.xcconfig` + entradas de `Info.plist` añadidas por un script de build.

Regla de oro: cambio en JS/TS → Fast Refresh o recarga. Cambio en dependencia nativa, `app.json` o plugin → regenerar y recompilar el Development Build (Gradle para Android con Java 21; Xcode para iOS).

### Bloque 4 — Fundamentos de React frente a Compose y SwiftUI (≈10 min)

| Concepto React | Compose (Kotlin) | SwiftUI | Diferencia que muerde |
|---|---|---|---|
| **JSX** | Llamadas a `@Composable` en un DSL | `body` con `ViewBuilder` | JSX es azúcar de sintaxis de `React.createElement`/`jsx()`: describe *elementos* (objetos inmutables), no vistas vivas. |
| **Componente funcional** | `@Composable fun` | `struct ...: View` | Es una función pura de `props` + estado → elementos. No guardes datos en variables de módulo. |
| **Props** | Parámetros de la función | `let`/propiedades de la `View` | Son de solo lectura. Se tipan `Readonly<...>`. No las mutes. |
| **Estado** (`useState`) | `remember { mutableStateOf() }` | `@State` | Cada render ve una *foto* del estado. Actualiza con el setter; `count++` no hace nada. |
| **Efecto** (`useEffect`) | `LaunchedEffect` / `DisposableEffect` | `.task` / `.onAppear` + `.onDisappear` | Tú declaras el array de dependencias; si falta una, el efecto usa valores obsoletos. El *cleanup* corre antes del siguiente efecto y al desmontar. |
| **Ref** (`useRef`) | `remember {}` sin estado, `FocusRequester` | `@FocusState`, `ScrollViewProxy` | Mutar `ref.current` **no** provoca render. Sirve para handles imperativos o valores que no se pintan. |
| **Hooks** | Funciones `remember*`/`derivedStateOf` | Property wrappers (`@State`, `@Environment`) | Solo se llaman en el nivel superior y en el mismo orden en cada render. |
| **Render** | Recomposición | Reevaluar `body` | Por defecto un padre que renderiza vuelve a renderizar a todos sus hijos; Compose salta lo que tiene parámetros estables. |
| **Reconciliación** | Positional memoization + keys | Identidad estructural/explícita (`id`) | React compara el árbol nuevo con el anterior por tipo y `key`; cambiar el `key` desmonta y pierde estado. |

**Errores típicos al venir de nativo:**
1. **Mutación.** `items.push(x); setItems(items)` no re-renderiza (misma referencia). En Compose, `mutableStateListOf` observa mutaciones; en React no hay observación. Crea valores nuevos: `setItems([...items, x])`.
2. **Efectos incompletos.** Omitir una dependencia en `useEffect` crea un *closure* con valores viejos. Calcula valores derivados durante el render, usa actualizaciones funcionales (`setN(c => c + 1)`) y no sincronices estado con otro estado mediante un efecto.
3. **Renders innecesarios.** Renderizar no es malo; renderizar caro o a cada frame sí. No pongas `useMemo`/`useCallback`/`memo` por intuición: mide con React DevTools/Profiler y recién entonces memoiza (norma de `AGENTS.md`).
4. **Trabajo pesado en JS.** Bloquea el hilo JS (Bloque 1). Mueve el cálculo fuera o pagina/virtualiza (FlashList llega más adelante).
5. **Listas sin `key` estable** y estado atado al índice.

### Bloque 5 — La demo del Día 1 (T6) y Flexbox (≈8 min)

La ruta `src/app/index.tsx` solo delega en `FoundationScreen` (rutas delgadas). La pantalla combina:

| Concepto | Dónde | Qué observar |
|---|---|---|
| **Composición** | `ConceptCard` recibe `children` y compone cada bloque. | Como un `@Composable` con `content: @Composable () -> Unit` o un `@ViewBuilder`. |
| **Props inmutables** | `FlexLayoutDemo` recibe `direction` como `Readonly<...>`; solo la pantalla lo cambia. | El hijo nunca cambia el valor: pide el cambio con un callback en el padre (elevar estado, *state hoisting*). |
| **Estado local** | `HookLifecycleDemo`: `tapCount` con `setTapCount(c => c + 1)`. `FoundationScreen`: `flexDirection`. | Cada cambio re-renderiza el componente dueño y sus hijos; los `console.log` bajo `__DEV__` lo muestran. |
| **Ref** | `useRef<ScrollView>(null)`; `scrollTo({ y: 0, animated: !reduceMotionEnabled })`. | Cambiar la ref no re-renderiza. Es imperativo, como `ScrollState.animateScrollTo` o `ScrollViewProxy.scrollTo`. |
| **Efecto con cleanup** | `LifecycleTimer`: `useEffect` crea `setInterval` si `isRunning`; el return hace `clearInterval`. Depende solo de `[isRunning]`. | Pausar o "Ocultar temporizador" ejecuta el cleanup (log `interval cleared`). El actualizador funcional evita añadir `elapsedSeconds` a las dependencias y evita el *stale closure*. |
| **Montar/desmontar** | El botón oculta `LifecycleTimer`: su estado (`elapsedSeconds`) se destruye. | Al mostrarlo de nuevo vuelve a 0. Equivale a salir de la composición y perder `remember`. |
| **Datos de sistema** | `useReducedMotionPreference` usa `useSyncExternalStore` y `AccessibilityInfo`. | RN 0.86 no exporta `useReducedMotion`; el hook observa el evento nativo. Es el patrón correcto para leer un store externo. |

**Flexbox y unidades.**
- En RN todo contenedor es flex, y **`flexDirection` por defecto es `column`** (en la web es `row`). `flex: 1, 2, 1` reparte el espacio en proporción 1:2:1 sobre el eje principal.
- En una columna hace falta una altura acotada para que esas proporciones se vean; por eso `trackColumn` define `height: 5 * sizes.minimumTouchTarget`.
- `StyleSheet.create` agrupa estilos tipados y los define una vez; los valores son **unidades independientes de densidad** (dp en Android, pt en iOS): `16` mide lo mismo físicamente en un móvil de densidad 2 y otro de 3.5. `PixelRatio.get()` muestra cuántos píxeles físicos hay por unidad; solo úsalo para diagnóstico o assets, no para maquetar.
- Analogía: Flexbox ≈ `Row`/`Column` + `Modifier.weight()` en Compose y `HStack`/`VStack` + `layoutPriority` en SwiftUI.
- Accesibilidad aplicada: `AppButton` es un `Pressable` con `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityHint` y `accessibilityState`; mide al menos 48 de alto/ancho (objetivo 48 dp en Android y 44 pt en iOS); `AppText` permite *font scaling*; el estado "seleccionado" no depende solo del color.

### Bloque 6 — Organización del código (≈6 min)

HerbStore agrupa por **funcionalidad** y separa lo compartido:

```
src/app/            rutas delgadas (Expo Router)
src/features/       una carpeta por funcionalidad: UI + hooks + lógica
src/core/           infraestructura compartida (i18n, accesibilidad, más adelante red/store)
src/design-system/  tokens y componentes sin lógica de negocio
mock-server/        backend independiente
```

Qué se decidió en cada alternativa (RF-6):

| Alternativa | Elegida en HerbStore | Trade-off | Opción descartada |
|---|---|---|---|
| Estructura de carpetas | Por funcionalidad (`features/<name>`) + `core` + `design-system` | Requiere disciplina para no importar entre features y decidir qué sube a `core` | Carpetas por tipo (`components/`, `hooks/`, `screens/`): crecen sin límite y esparcen una funcionalidad |
| Clean Architecture (domain/data/presentation, casos de uso, repositorios) | Versión ligera: lógica pura separada de la UI y acceso a datos por RTK Query (desde el Día 3) | Menos garantías formales de aislamiento; hay que cuidar que la UI no contenga reglas | Capas completas con casos de uso y mappers por cada entidad: ceremonia desproporcionada en una app didáctica |
| MVVM | Componentes + **custom hooks** como "ViewModel ligero" y Redux Toolkit para estado global de cliente | No existe un `ViewModel` con ciclo de vida propio; el estado vive en el árbol de componentes o en el store | Clases ViewModel con observables: no encajan con el modelo de hooks y añaden una abstracción propia |
| Estado de datos remotos | RTK Query (Días 3–4) frente a Redux "a mano" | Dependencia de su modelo de caché | Reducers con `fetch` manual: reimplementan caché, reintentos y paginación |

Mapa mental: `Repository` ≈ endpoint de RTK Query; `UseCase` ≈ función pura en la feature; `ViewModel` ≈ custom hook; `StateFlow`/`@Published` ≈ selector de Redux o `useState`; `Composable`/`View` ≈ componente.

---

### Decisiones técnicas del Día 1

| Decisión elegida | Trade-off | Descartada |
|---|---|---|
| Servidor Node/Express/Faker con funciones puras | Dos procesos locales | `json-server`: no expresa validación, idempotencia ni latencia controlada |
| Tests del mock con `node:test` | API de aserciones más básica | Adelantar Jest (reservado para el Día 6) |
| Reloj y tiempo de procesamiento inyectables | El store recibe el tiempo como dependencia | Timers reales: lentos y no deterministas |
| Reserva atómica de stock al crear `pending` | Stock retenido hasta confirmar o expirar | Revalidar al confirmar: permitiría sobreventa o invalidar una orden aceptada |
| Registro activo 24 h + tombstone 24 h | Se guarda una key no personal hasta 48 h | Olvidar a las 24 h: no distingue "expirada" de "nunca creada" |
| Tokens semánticos + 3 primitivas (`AppText`, `AppSurface`, `AppButton`) | Pocos componentes al inicio | Migrar toda la plantilla antes de necesitarla |
| i18n es/en desde el Día 1 | Trabajo inicial extra | Textos fijos y deuda hasta el Día 6 (viola la constitución) |
| `AppButton` con `Pressable` y objetivo mínimo 48 | Un botón propio en vez de `Button` | `Button` de RN: no se puede adaptar su tamaño/estilo de forma uniforme |
| Reduced motion con `useSyncExternalStore` | Código de infraestructura propio | Leerlo en un efecto + `setState`: render extra y penalizado por React 19 |
| Sin memoización en la demo | Re-renders visibles a propósito | `memo`/`useMemo` sin medición |

### Direcciones del servidor desde cada plataforma (RF-25)

El servidor mock escucha en `3001` y se arranca con `npm --prefix mock-server run dev`.
- Emulador Android: `http://10.0.2.2:3001`
- Simulador iOS: `http://localhost:3001`
- Dispositivo físico en la misma red: `http://<IP_LAN>:3001` (o `adb reverse tcp:3001 tcp:3001` con USB en Android).
- Se comprueba con `/health`. Hasta el Día 3 la app no consume aún el catálogo.

---

### Ejercicio del Día 1 (sin solución)

**Construye `useCountdown`: una cuenta regresiva con efecto y cleanup correctos.**

Crea, en una rama o carpeta de práctica (no sobrescribas la demo existente):
1. Un hook `useCountdown(initialSeconds)` que devuelva `{ remainingSeconds, isRunning, start, pause, reset }`.
2. Una pantalla pequeña que lo use con tres `AppButton` (iniciar/pausar, reiniciar) y un texto de estado.
3. Requisitos:
   - Un único intervalo vivo a la vez; debe limpiarse al pausar, al llegar a 0 y al desmontar el componente.
   - Sin dependencias obsoletas: el hook no puede leer valores de un render anterior y no debe usar `setState` dentro del cuerpo del efecto salvo desde el callback del intervalo.
   - Al llegar a 0 se detiene solo y comunica el cambio de forma accesible (texto, no solo color).
   - Todo texto en español e inglés, usando el `i18n` del proyecto.
   - Las animaciones o transiciones respetan `reduce motion`.
   - Objetivos táctiles de 48 dp/44 pt y escala de fuente 200 % sin recortes.
4. Valida en Android e iOS. Añade un `console.log` bajo `__DEV__` en el efecto y su cleanup y comprueba: un log de inicio por cada `start`, uno de limpieza por cada `pause`/`reset`/desmontaje, y nunca dos intervalos.
5. Diagnóstico (sin respuestas aquí): explica por qué este fragmento falla y qué cambiarías.

```tsx
const [seconds, setSeconds] = useState(10);
useEffect(() => {
  const id = setInterval(() => setSeconds(seconds - 1), 1000);
}, []);
```

Entrega esperada: el código del hook, una explicación en tus propias palabras (≤ 8 líneas) y una comparación con `LaunchedEffect`/`DisposableEffect` y `.task`.

---

### Preguntas de repaso (respuestas cortas)

1. **¿Qué hilos intervienen en una app RN y qué se ejecuta en cada uno?**
   JS (código de la app y render de React en Hermes), UI/principal (vistas nativas y gestos) y segundo plano (layout, módulos nativos, red). Bloquear el hilo JS congela lógica y respuesta a eventos aunque la UI nativa siga viva.
2. **¿Qué hace Metro y por qué Fast Refresh no basta para cambios nativos?**
   Metro empaqueta y sirve JS/TS y notifica cambios; Fast Refresh reemplaza módulos JS conservando estado. No compila Kotlin/Swift/Gradle/Xcode, por eso un cambio nativo exige recompilar el Development Build.
3. **¿Qué aporta Hermes?**
   Motor JS pensado para móvil: bytecode precompilado, arranque rápido y menos memoria, sin JIT. Optimiza midiendo, no por intuición.
4. **¿Qué problema tenía el Bridge antiguo y cómo lo resuelve JSI?**
   Mensajes JSON asíncronos serializados y módulos cargados al inicio. JSI permite referencias directas a objetos nativos y llamadas sin serializar, incluso síncronas.
5. **¿Qué papel tienen Fabric, TurboModules, Codegen y bridgeless?**
   Fabric: renderer con árbol C++ inmutable. TurboModules: módulos nativos perezosos y tipados vía JSI. Codegen: genera el código de contrato desde especificaciones tipadas. Bridgeless: ya no existe el bridge antiguo.
6. **¿Por qué HerbStore usa Development Build y no Expo Go?**
   Expo Go solo trae módulos fijos. El Development Build incluye los módulos y la configuración nativa propios del proyecto (incluido el Expo Module Kotlin/Swift) y sigue cargando JS desde Metro.
7. **¿Qué es CNG y qué implica para `ios/` y `android/`?**
   Continuous Native Generation: esas carpetas se generan desde `app.json`, `package.json` y config plugins. Están ignoradas por Git y no se editan a mano; los cambios se hacen en la configuración y se recompila.
8. **¿Por qué `items.push(x); setItems(items)` no actualiza la pantalla?**
   Porque la referencia es la misma y React no observa mutaciones. Hay que crear un valor nuevo (`[...items, x]`) y mantener el estado inmutable.
9. **¿Cuándo corre el cleanup de un `useEffect` y qué pasa si falta una dependencia?**
   Antes de volver a ejecutar el efecto por un cambio de dependencias y al desmontar. Si falta una dependencia, el efecto usa valores obsoletos (stale closure) y puede dejar intervalos o suscripciones colgados.
10. **¿Cuándo se memoiza y qué diferencia hay entre render y recomposición?**
    Solo con una razón medible en Profiler/DevTools. React vuelve a renderizar por defecto a los hijos de un componente que renderiza; Compose omite lo que tiene parámetros estables. Un render es barato y no implica tocar vistas nativas hasta que la reconciliación detecta cambios.

---

### Checklist oral

Debería poder explicar, sin mirar apuntes y en unos 60 segundos cada punto:

**Ejecución**
- [ ] Qué hilos existen, qué corre en cada uno y por qué JS bloqueado es un problema parecido a un ANR.
- [ ] Qué hacen Metro, Fast Refresh y Hermes, y qué no hacen.
- [ ] Qué cambia entre Bridge antiguo y New Architecture (JSI, Fabric, TurboModules, Codegen, bridgeless).

**Renderizado**
- [ ] Qué es un render, cómo reconcilia React y en qué se diferencia de la recomposición de Compose y del diff de SwiftUI.
- [ ] Por qué las props son de solo lectura y el estado no se muta.
- [ ] Cuándo corre el cleanup de un efecto, qué es un stale closure y por qué `useRef` no re-renderiza.
- [ ] Por qué no memoizar sin medir y qué herramienta uso para medir.
- [ ] Cómo funciona `flex` y por qué la unidad es independiente de densidad.

**Expo**
- [ ] Expo frente a React Native CLI: qué ganas y qué aceptas.
- [ ] Development Build frente a Expo Go y por qué el proyecto prohíbe Expo Go.
- [ ] Qué comandos uso: `npx expo install`, `npx expo install --check`, `npx expo start --dev-client`, `npx expo-doctor@latest`.

**Generación nativa**
- [ ] Qué es CNG y por qué `ios/` y `android/` no se versionan ni se editan.
- [ ] Qué hace un config plugin y un ejemplo real del proyecto (`expo-localization`).
- [ ] Qué cambios requieren recompilar (dependencia nativa, `app.json`, plugin) y cuáles solo recargar JS.

**Arquitectura y proceso**
- [ ] Organización por features frente a por tipo; Clean Architecture ligera; custom hook como ViewModel ligero.
- [ ] Por qué existe un servidor mock determinista y cómo alcanzarlo desde emulador, simulador y dispositivo físico.

---

### Registro de verificación del Día 1

Resultado de la comprobación automática de T7 (2026-10-10):

| Comprobación | Comando | Resultado |
|---|---|---|
| Pruebas del mock | `npm --prefix mock-server test` | 37 de 37 pasan |
| ESLint | `npx expo lint` | sin errores |
| TypeScript strict | `npx tsc --noEmit` | sin errores |
| Compatibilidad de dependencias | `npx expo install --check` | dependencias al día |
| Diagnóstico | `npx expo-doctor@latest` | 21/21 comprobaciones superadas |

Validación manual de T7 (tema claro/oscuro, idioma es/en, accesibilidad en Android físico e iOS simulador): **confirmada en ambas plataformas**.
