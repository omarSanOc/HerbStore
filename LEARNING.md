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

---

## Día 2 — Navegación y Home

Estado: **teoría y material de cierre redactados; matriz de verificación (T9) aprobada por el usuario; pendientes la revisión de @reviewer y la aprobación del usuario para el commit del día (T10).**

Qué hay al terminar el día (spec `specs/002-dia-2-navegacion-home`):
- Navegación: `Tabs` con un `Stack` por tab (Inicio, Categorías, Carrito, Cuenta), badge del carrito, escáner como modal, rutas dinámicas `product/[id]` y `category/[id]`, `search`, `+not-found` y enlaces `herbstore://product/<id>`.
- Home real: cabecera (buscador y escáner), carrusel de banners con autoplay, categorías circulares y tres secciones de productos, con estados cargando / listo / vacío / sin conexión / error.
- Infraestructura: `fetchJson` (resultado discriminado), `resolveApiOrigin`, `resolveAssetUrl`, `Intl.NumberFormat` por moneda, `RemoteImage` sobre `expo-image` y `useIsAppActive`.
- Mock: `GET /images/:kind/:name` con PNG ficticios generados con `zlib` (73 tests con `node:test`).
- Lógica pura probada con `node:test` (`npm run test:logic`, 295 tests). Sin dependencias nuevas y sin cambios en `app.json`.

Cada bloque se lee en 10 minutos o menos (RF-1) y se practicó justo antes de construir. Código e identificadores en inglés, explicación en español.

---

### Bloque A — Layouts, grupos, Tabs y un Stack por tab (≈9 min)

**Expo Router es React Navigation con rutas basadas en archivos.** Cada archivo de `src/app/` es una pantalla; cada `_layout.tsx` declara el navegador que contiene a sus hermanos. Expo Router incluye su propia copia de React Navigation (en `node_modules/expo-router/build/react-navigation/`: `bottom-tabs`, `native-stack`, `routers`, `core`...; la carpeta `vendor/` solo contiene `react-helmet-async`) y un `Stack` nativo basado en `react-native-screens`, por eso las opciones de `Tabs` y `Stack` son las de React Navigation (`tabBarBadge`, `headerShown`, `presentation`...).

```
src/app/
  _layout.tsx                  Stack raíz (anchor '(tabs)'); modal `scanner`; `+not-found`
  (tabs)/_layout.tsx           Tabs (anchor '(home)')
    (home)/_layout.tsx         Stack (anchor 'index'): index, product/[id], category/[id], search
    (categories)/_layout.tsx   Stack · categories.tsx
    (cart)/_layout.tsx         Stack · cart.tsx
    (account)/_layout.tsx      Stack · account.tsx · foundations.tsx
```

- **Grupos `(nombre)`.** Los paréntesis agrupan rutas sin añadir un segmento a la URL: `(tabs)/(home)/product/[id].tsx` responde a `/product/<id>`. Por eso `router.push({ pathname: '/product/[id]', ... })` no menciona `(tabs)` ni `(home)`. Sirven para dar a cada tab su propio `Stack`.
- **Por qué `index` solo en Home.** Dos tabs con `index` colisionarían en `/`; el resto usa un nombre (`categories`, `cart`, `account`).
- **Un `Stack` por tab.** Producto, categoría y búsqueda se empujan en el stack del tab que los origina (hoy solo Inicio): Atrás vuelve al destino anterior sin cambiar de tab (RF-6). Cuando Categorías o Carrito originen producto (Días 3 y 4) se compartirán con grupos en array, `(home,categories)/...`.
- **Orden y badge.** `Tabs.Screen` en orden explícito. `tabBarBadge={getCartBadge(count)}` devuelve `undefined` con 0 (con `0` el tab dibuja "0": la barra solo comprueba `badge != null`), el número hasta 99 y `'99+'` desde 100. La etiqueta hablada conserva la cuenta real ("Carrito, 100 artículos") y se define en los cuatro tabs con `tabBarAccessibilityLabel`; sin eso iOS añade un texto en inglés ("..., tab, 1 of 4").
- **Fuente del badge.** `CartCountSource` es un almacén externo (`subscribe` / `getSnapshot`) leído con `useSyncExternalStore`, el mismo patrón que `useReducedMotionPreference` y `useIsAppActive`. El Día 4 lo sustituye por el selector real de Redux sin tocar los tabs.

**Lección de scroll por tab: «lo conserva el montaje, no el código».** Al cambiar de tab, el tab anterior **no se destruye**: su navegador sigue montado (con `lazy`, un tab se monta la primera vez que se visita, y `popToTopOnBlur` es `false` por defecto). Su `Stack`, su `FlatList` y su posición de scroll siguen en memoria. En `HomeScreen` no hay una sola línea que guarde un offset: el comportamiento sale de que el componente sigue vivo. Es lo contrario del reflejo de quien viene de Android, donde cambiar de destino suele significar recrear (y restaurar a mano con `rememberSaveable` o `saveState`).

**Reselección sin duplicados.** Tocar el tab activo no crea rutas: React Navigation hace *pop to top* del stack de ese tab (si ya estás en la raíz no ocurre nada visible). Se comprobó 5 veces seguidas en la raíz y con un producto apilado (M1).

| Concepto | Expo Router / React Navigation | Navigation Compose | SwiftUI |
|---|---|---|---|
| Navegador raíz | `_layout.tsx` con `Stack` | `NavHost` | `NavigationStack` (raíz) |
| Barra de tabs | `Tabs` | `NavigationBar` + `NavHost` | `TabView` |
| Un stack por tab | grupo `(home)` con su `Stack` | un *nested nav graph* por destino de la barra | un `NavigationStack` dentro de cada tab del `TabView` |
| Conservar estado del tab | el tab sigue montado | `saveState = true` / `restoreState = true` en `navigate` con `popUpTo` | `TabView` mantiene vivas las vistas de cada tab; su `path` solo se pierde si lo destruyes |
| Reselección | *pop to top* automático | `launchSingleTop` + `popUpTo(start)` a mano | detectar el toque en `selection` y vaciar el `path` a mano |
| Rutas sin URL | grupos `(x)` | rutas string o `@Serializable` | valores `Hashable` en `navigationDestination(for:)` |

**Errores típicos al venir de nativo.**
1. **Pensar que Atrás es del sistema operativo.** En RN lo gobierna el stack: el botón físico de Android y el gesto de iOS consultan al navegador. Un enlace profundo sin pila dejaría Atrás sin destino (de ahí `anchor`, Bloque D).
2. **Tratar el tab como una `Activity` recreada.** Aquí queda montado; guardar offsets a mano duplica trabajo y puede entrar en conflicto con el estado real.
3. **Estado que no se muta.** El conteo del carrusel, el badge o la lista de filas se reemplazan por valores nuevos, nunca se editan en sitio.
4. **Renders de más.** Cada navegador es un componente: un cambio en `useCartCount` re-renderiza el layout de `Tabs`, y es lo esperado; no memoices sin medir (Bloque H).
5. **Trabajo pesado en JS.** Los layouts solo declaran opciones; nada de cálculo en ellos.

### Bloque B — Rutas dinámicas y parámetros (≈8 min)

**El segmento `[id]` es un parámetro.** `product/[id].tsx` recibe `id` con `useLocalSearchParams<{ id?: string | string[] }>()`. Dos puntos delicados:

1. **El tipo no es `string`.** Una URL puede traer el parámetro repetido (`?id=a&id=b`), vacío o ausente: el tipo honesto es `string | string[] | undefined`.
2. **Typed routes solo validan el pathname.** Con `typedRoutes`, `router.push({ pathname: '/product/[id]', params: { id } })` falla en compilación si la ruta no existe o falta el parámetro. Pero **no** comprueban el contenido: `/product/<lo-que-sea>` pasa. El contenido hay que validarlo en tiempo de ejecución.

```ts
// features/product/parse-product-id.ts (idea): devuelve el id o undefined
parseProductId(value: unknown): string | undefined   // forma: product-<6 dígitos>-<3 dígitos>
// features/categories/parse-category-id.ts
parseCategoryId(value: unknown): string | undefined  // slug en minúsculas, ≤ 40 caracteres
```

La ruta es delgada: obtiene el parámetro crudo y se lo pasa a una pantalla de la *feature* (`ProductPlaceholderScreen rawId={id}`), que llama a `parseProductId`. Si es `undefined`, **no hay petición** y se muestra el estado no encontrado; si es válido se consulta `GET /products/:id` (cargando → encontrado | 404 | sin conexión | error). Dos niveles de "no existe": forma inválida (decide el cliente, sin red) e id con forma válida pero inexistente (decide el servidor, 404). Por eso `product-261009-999` y `not-an-id` muestran la misma pantalla pero solo la primera genera una petición.

**Estado no encontrado.** `NotFoundScreen` ofrece dos salidas: Volver (`router.back()`, o `replace('/')` si no hay historial: `useGoBackOrHome`, pensado para enlaces profundos) e Ir a Inicio (`router.dismissTo('/')`: regresa a Inicio sin apilar otra Home).

**Idea clave:** un parámetro de ruta es **entrada no confiable** (como un `Intent` extra o una URL externa). Antes de usarlo en una petición, en un log o en una pantalla, se parsea. El resultado de `parseX` es un tipo estrecho (`string | undefined`) que el resto del código puede dar por bueno.

| Idea | RN (Expo Router) | Navigation Compose | SwiftUI |
|---|---|---|---|
| Declarar el parámetro | segmento `[id]` en el nombre del archivo | `composable("product/{id}") { navArgument("id") ... }` o `@Serializable data class Product(val id: String)` | `NavigationLink(value: ProductID)` + `navigationDestination(for: ProductID.self)` |
| Leerlo | `useLocalSearchParams` (crudo) | `backStackEntry.arguments` o `toRoute<Product>()` | el valor llega ya tipado al destino |
| Quién valida el contenido | tú (`parseProductId`) | tú (el tipo `String` no garantiza la forma) | tú (la estructura del valor no garantiza que exista) |

**Errores típicos.** Confiar en que typed routes validan el id; asumir `string` y romper con un array; lanzar la petición antes de validar; mutar `params`; y declarar el efecto de la petición sin el id en sus dependencias (un producto nuevo con el efecto viejo). `useProductExists` incluye `[id, attempt]` y descarta respuestas que no corresponden al `id` ni al intento actual.

### Bloque C — Modales (≈5 min)

El escáner es una ruta del **Stack raíz** con `presentation: 'modal'`:

```tsx
<Stack.Screen name="scanner" dangerouslySingular options={{ headerShown: true, presentation: 'modal', title: t('scanner.title') }} />
```

- **iOS:** hoja deslizable; se cierra arrastrando hacia abajo o con el botón.
- **Android:** `presentation: 'modal'` es una pantalla de stack con animación vertical; no hay gesto de hoja. Se cierra con Atrás o con el botón. Por eso el botón **Cerrar de 48 dp** existe siempre (RF-7): el gesto no es un contrato multiplataforma.
- **Home debajo, intacta.** El modal vive en el stack raíz sobre `(tabs)`, que sigue montado: al cerrarlo Home reaparece con su scroll previo (misma lección del Bloque A).
- **Una sola instancia** con `dangerouslySingular` (Bloque D).
- **Hoy es un placeholder** (sin cámara): el escaneo real llega en el Día 5.

| | RN | Compose | SwiftUI |
|---|---|---|---|
| Modal de navegación | `presentation: 'modal'` | `dialog("scanner") { }` en el `NavHost` o `ModalBottomSheet` | `.sheet` / `.fullScreenCover` |
| Cierre | botón, gesto iOS, Atrás Android | `onDismissRequest`, Atrás | `dismiss()`, arrastrar |

**Error típico:** diseñar el cierre solo con el gesto de iOS o solo con Atrás; en lectores de pantalla el botón visible y etiquetado es lo que se activa.

### Bloque D — Deep links (≈9 min)

**Cadena de un enlace `herbstore://product/<id>`:**

1. El sistema entrega la URL a la app porque `app.json` declara `scheme: herbstore` (config plugin → `intent-filter` en `AndroidManifest.xml` y `CFBundleURLTypes` en `Info.plist`; es CNG, no se edita a mano).
2. Expo Router llama a `redirectSystemPath({ path, initial })` de `src/app/+native-intent.ts`. Recibe la **URL completa** (en un arranque normal, `herbstore:///`). El archivo solo delega en `core/navigation/linking.ts`, que es código puro y comprobable en Node.
3. `normalizeIncomingUrl` decide: raíz → `/`; `herbstore://product/<id>` (también `herbstore:///product/<id>`) → `/product/<id>` sin query, fragmento ni barra final; id con forma inválida → `/product/invalid` (el texto sin validar nunca llega a ser parámetro); esquema ajeno (incluido el `exp+herbstore://` del launcher) → `null` (se ignora); cualquier otro host del esquema propio **pasa tal cual**: Expo Router abre cualquier ruta que exista (p. ej. `herbstore://scanner`, `search`, `category/<id>`, `foundations`, `cart`, `categories`, `account`) y solo los hosts sin ruta llegan a `+not-found`. Es decir, **solo `product/<id>` se valida**; el resto no se filtra. **Nunca lanza**: una excepción aquí puede cerrar la app, así que hay `try/catch` que devuelve `null`.
4. Expo Router navega a la ruta resultante.

**Decisión del usuario (I-3): se acepta la alcanzabilidad externa de esas rutas.** Son pantallas marcador de posición sin riesgo (no escriben datos ni reciben parámetros sin validar) y la matriz de pruebas las usa como atajo (`herbstore://scanner`, `herbstore://foundations`). Trade-off: cualquier app o página puede abrir esas pantallas internas; hoy es inocuo, pero cuando una ruta tenga efectos (escáner real, Día 5) habrá que revisarlo. **Alternativa descartada:** restringir `linking.ts` a `product` y la raíz (más estricto, todo lo demás iría a `+not-found`), porque implica cambiar código y pruebas ahora; se revisará al llegar el escáner real, en el Día 5.

**`+not-found.tsx`** es el comodín: una URL del esquema propio que no coincide con ninguna ruta (`herbstore://unknown`) muestra una salida controlada hacia Inicio (RF-9).

**`unstable_settings.anchor`.** Un enlace a `/product/<id>` aterriza directo en el producto; sin nada debajo, Atrás no tendría destino. El `anchor` indica qué hijo se monta *debajo*: `'(tabs)'` en la raíz, `'(home)'` en los tabs e `'index'` en el stack de Home. Resultado: Home bajo el producto y Atrás vuelve a Inicio. Alternativa descartada: confiar en el anchor por defecto, que solo busca un hijo con el nombre del grupo y `index` no cumple.

**`dangerouslySingular={(name) => name}`.** Hace que cada ruta tenga como máximo una instancia en el stack, con el nombre de la ruta como identidad. Efectos medidos en T3/T9: enviar el enlace de A y luego el de B deja **un solo producto (B)**; un doble toque o dos dedos sobre dos tarjetas abren una sola pantalla. Es análogo a `launchSingleTop` de Navigation Compose, pero no idéntico: `dangerouslySingular` elimina la instancia previa en **cualquier posición** del stack y la reinserta arriba con los nuevos parámetros, mientras que `launchSingleTop` solo evita duplicar si el destino ya está arriba (y `launchMode="singleTop"` es de `Activity`, otro nivel). `getId` hace algo parecido pero está **deprecado** (avisa por consola en 57.0.25). Trade-off: no se puede apilar producto sobre producto; si el Día 4 lo necesita, el identificador pasa a depender del parámetro `id`.

**Arranque en frío frente a app activa.** Con la app en ejecución, `redirectSystemPath` recibe el enlace y navega; con la app cerrada, `initial` es `true` y el enlace es el destino de arranque. **Limitación conocida del Development Build:** `expo-dev-client` abre primero su *launcher* y lo intercepta, así que el arranque en frío con enlace no es observable (confirmado en Android y en iOS). Decisión del usuario: se cierra en el Día 5 (validación nativa de enlaces, probablemente con una compilación Release). No se da por validado hoy.

| | Expo Router | Navigation Compose / Android | SwiftUI / iOS |
|---|---|---|---|
| Declarar el esquema | `scheme` en `app.json` (CNG) | `<intent-filter>` con `<data android:scheme>` | `CFBundleURLTypes` en `Info.plist` |
| Mapear URL a destino | `+native-intent` + rutas | `navDeepLink { uriPattern = "herbstore://product/{id}" }` | `.onOpenURL { url in path.append(...) }` |
| Pila debajo del destino | `unstable_settings.anchor` | back stack sintetizado (`TaskStackBuilder`) | construir tú el `path` |
| Evitar duplicados | `dangerouslySingular` | `launchSingleTop = true` | comprobar el `path` antes de añadir |
| Ruta desconocida | `+not-found` | destino de error propio | `default` del `switch` |

**Errores típicos.** Probar solo con la app activa y creer que el arranque en frío está validado; fiarse de la URL (nunca la registres: puede llevar datos del usuario, por eso `+native-intent` solo registra *redirected/ignored*); olvidar el `try/catch`; y duplicar pantallas por doble toque.

### Bloque E — Capa de datos aislada y estados de pantalla (≈10 min)

**Capas.** `http.ts` (`fetchJson`) → clientes por feature (`home-client`, `product-client`) → lógica pura (`classifyHomeResult`) → hook (`useHome`) → pantalla. Cada capa tiene una sola responsabilidad y la pantalla solo presenta.

**`fetchJson` nunca lanza.** Devuelve una unión discriminada:

```ts
type FetchJsonOutcome<T> =
  | { kind: 'ok'; data: T; status: number } | { kind: 'http'; status: number }
  | { kind: 'network' } | { kind: 'invalid' } | { kind: 'timeout' } | { kind: 'aborted' };
```

- `network`: `fetch` rechazó sin respuesta (servidor caído, sin ruta, sin conexión).
- `http`: respuesta no 2xx (p. ej. 5xx). `invalid`: 2xx con cuerpo ilegible o que no pasa `parse`.
- `timeout`: sin respuesta completa en 8 s (`AbortController` propio). `aborted`: cancelación del llamador (desmontaje, petición nueva).

**Offline frente a error.** Offline = «no hubo respuesta»; error = «hubo respuesta mala (o ninguna a tiempo)». En Kotlin es la diferencia entre `IOException` (`UnknownHostException`) y un `HttpException`; en Swift entre `URLError(.notConnectedToInternet)` y un `HTTPURLResponse` con código 5xx. El usuario necesita mensajes distintos: «Sin conexión con el servidor» frente a «No se pudo cargar Inicio».

**Lección N-1: probar con el `fetch` real del SDK.** En SDK 57 el `fetch` global es `expo/fetch` y sus fallos de red son `FetchError extends Error`, **no** `TypeError`. La primera versión clasificaba `network` con `error instanceof TypeError`; los tests pasaban porque el doble de prueba lanzaba `TypeError`, pero en el dispositivo «sin conexión» caía en `invalid` y se veía como error de servidor. Arreglo: se separa el `try` de `fetch` del de `response.json()` y todo rechazo sin respuesta es `network`, salvo que lo provoque nuestro propio abort (que gana: `timeout` o `aborted`). Se clasifica por **estructura** («no hubo respuesta»), no por tipo de excepción. Moraleja: un doble de prueba que no reproduce el error real prueba el doble, no tu código.

**Estado de pantalla como unión discriminada.**

```ts
type HomeScreenState =
  | { status: 'loading' } | { status: 'ready'; data: HomeData; notice?: 'offline' | 'update-failed' }
  | { status: 'empty' } | { status: 'offline' } | { status: 'error' };
```

Cada variante lleva solo los datos que necesita y el `switch` sobre `status` lo comprueba el compilador. Frente a `isLoading` / `isError` / `data` como booleanos independientes, evita combinaciones imposibles («cargando y con error»). Equivale a un `sealed interface UiState` con `when` exhaustivo y a un `enum` con valores asociados en Swift.

**`classifyHomeResult(previous, outcome)`**, pura y probada: sin resultado → carga (o los datos previos, sin aviso, mientras se refresca); éxito → datos (colecciones vacías omitidas una a una; todo vacío → `empty`); fallo con datos previos → los mantiene con aviso (`offline` o `update-failed`); fallo sin datos → `offline` o `error`.

**`useHome` conecta la lógica con React.**
- Un `useReducer` guarda hechos (`requestId`, `isPending`, `data`, `outcome`); lo que se dibuja se **deriva en render** (`selectHomeScreenState`), nunca se guarda.
- Un solo request a la vez. Cada respuesta llega con su `requestId`; la de una petición vieja se descarta. El efecto crea un `AbortController` y su cleanup lo aborta: así no hay «respuestas zombi» tras desmontar.
- Disparadores: arrastrar para refrescar y Reintentar siempre; **primer plano** (`AppState` pasa a `active` con Home enfocado) refetch siempre que no haya una petición en curso; **foco de navegación** solo para recuperarse de un fallo (volver de un producto no repite la petición). Cada listener existe solo mientras su regla pura lo permite.
- Sin `setState` síncrono dentro de un efecto (React 19 lo penaliza); los disparadores son callbacks de eventos.

**Errores típicos al venir de nativo.** Banderas booleanas sueltas; olvidar el cleanup y actualizar estado de un componente desmontado; efectos con dependencias omitidas; sincronizar estado a mano en vez de derivarlo; probar con dobles que no reproducen el error real; y bloquear el hilo JS con cálculo (aquí el parseo del payload es corto; si creciera, habría que medir).

**Plan para el Día 3.** Solo `home-client` y `useHome` cambian a RTK Query; la pantalla, los componentes y los estados se conservan.

### Bloque F — Listas por filas, imágenes, formato y tarjetas (≈10 min)

**Home es una `FlatList` vertical de filas heterogéneas.** `buildHomeRows(state)` (pura) convierte el estado en `HomeRow[]` (otra unión discriminada: `notice`, `banners`, `categories`, `section:<id>`, `loading`, `empty | offline | error`) con `key` estable que nunca depende de la posición; `HomeRowItem` hace un `switch` sobre `row.kind`. Las colecciones vacías no generan fila (RF-15). Categorías y cada sección son listas horizontales (`FlatList horizontal`) con `keyExtractor` a nivel de módulo, sin *closures* nuevos por render. Las secciones tienen ≤10 productos, así que la ventana por defecto renderiza todo y la altura de la fila se conoce desde el primer frame. FlashList llega en el Día 3.

| | RN `FlatList` | Compose | SwiftUI |
|---|---|---|---|
| Lista vertical por filas | `FlatList` (virtualizada) | `LazyColumn` + `items(key = ...)` | `List` / `LazyVStack` |
| Lista horizontal | `FlatList horizontal` | `LazyRow` | `ScrollView(.horizontal)` + `LazyHStack` |
| Identidad de fila | `keyExtractor` | `key` | `id` (`Identifiable`) |
| Pull to refresh | `RefreshControl` | `PullToRefreshBox` | `.refreshable` |

**Imágenes remotas.** `RemoteImage` usa `expo-image` (caché en disco y en memoria nativas, decodificación fuera del hilo JS) con:
- Marco con `aspectRatio` y color de fondo como *placeholder*: las dimensiones se reservan antes de llegar el bitmap (sin saltos de layout, RNF-3).
- Fallo (`onError` o ruta inutilizable): texto visible «Imagen no disponible» (en categorías, la inicial) y etiqueta accesible con el nombre. El fallo se guarda como «la URI que falló», así que otra URI vuelve a intentarlo sin efectos.
- `transition` 0 con reduced motion (RNF-2); `contentFit: 'cover'`; `recyclingKey` = URI (hoy no cambia nada con `FlatList`, evitará el parpadeo cuando se migre a FlashList).
- Decorativa (sin `label`) se oculta al lector; con `label` es una imagen etiquetada.
- Origen: `resolveAssetUrl(origin, path)` (pura y estricta) y `apiOrigin` según plataforma: emulador Android `http://10.0.2.2:3001`, Android físico con `adb reverse` `localhost:3001`, simulador iOS `localhost:3001`; override con `EXPO_PUBLIC_API_ORIGIN`.
- Equivalentes: Coil `AsyncImage` con `placeholder` y `error`; `AsyncImage` de SwiftUI con fase `.failure`.

**Moneda y números.** `formatCurrency(amount, currency, language)` usa `Intl.NumberFormat` (disponible en Hermes) con la **moneda del producto**, nunca la del idioma. El idioma de la interfaz se traduce a un locale regional: `es` → `es-MX`, `en` → `en-US`. Resultado: `$277.90` (MXN) y `USD 11.99` en español; el precio se redondea para mostrar, no se calcula con aritmética flotante. Construir un `Intl.NumberFormat` es lo caro, así que hay una instancia cacheada por (locale, opciones). Equivale a `NumberFormat.getCurrencyInstance(Locale)` en Java/Kotlin y a `FormatStyle.currency(code:)` en Swift.

**Tarjeta de producto accesible.** Toda la tarjeta es **un** botón con una etiqueta hablada que compone nombre, precio (en oferta: «En oferta, $X, antes $Y»), calificación («Calificación 4.9 de 5, 2,400 reseñas») e insignia; la imagen y los textos visibles no se leen dos veces. Una sola insignia por prioridad (Oferta → Nuevo → Más vendido); la oferta exige `listPrice > price`; la marca no se muestra; `couponText` (inglés de servidor) tampoco. El ancho crece con la fuente hasta 1.5x y la altura nunca es fija, para que un precio como `USD 12.99` no se parta.

**Textos por id.** Secciones, categorías y banners se traducen por su id con claves i18n; el texto del servidor (inglés) es solo *fallback* para ids desconocidos. Nombre y marca del producto son datos de catálogo y se muestran tal cual.

**Errores típicos.** `key={index}`; crear funciones o estilos nuevos en cada render para cada celda sin necesidad (aquí se evitan los objetos de módulo, pero no se memoiza por intuición); `Intl.NumberFormat` por celda y por render; fijar altura a texto; olvidar el estado de imagen rota; y dejar que la lista se mueva a hilos pesados (decodificar imágenes en JS).

### Bloque G — Carrusel: paginación, accesibilidad y autoplay (≈10 min)

**Tres casos, tres componentes.** `getCarouselMode(count)`: 0 → nada; 1 → banner solo (sin indicadores, flechas ni autoplay); ≥2 → `PagedBanners` (así los hooks del caso paginado no corren para los otros dos). Si cambia el número de banners, `key={row.banners.length}` reinicia el carrusel.

**Paginación con `FlatList`.** `horizontal` + `pagingEnabled` + `getItemLayout` (cada página mide el ancho medido con `onLayout`). El índice es **estado de React que cambia solo cuando el scroll se asienta**: `onMomentumScrollEnd` → `indexFromOffset(offset, ancho, count)` (redondea y acota; tolera el rebote de iOS). Actualizarlo en cada `onScroll` re-renderizaría ~60 veces por gesto sin necesidad. Botones y acciones de accesibilidad actualizan el índice al instante y llaman a `scrollToOffset({ animated: !reduceMotion })`; el evento de asentamiento que sigue escribe el mismo número (idempotente). Los controles manuales están acotados (sin vuelta); solo el autoplay da la vuelta.

**Accesibilidad.** El viewport es **un elemento `adjustable`** (como `UIPageControl` o un slider) con valor «Banner n de N» y acciones `increment`, `decrement` y `activate` (abrir categoría) con etiquetas localizadas; los slides se ocultan al lector para no leerlos dos veces; los indicadores son decorativos y no hay *live region*, para no anunciar cada avance automático. Con un banner es un botón normal. Botones anterior/siguiente de 48 dp.

**Autoplay (RF-12, RF-13).** Un **único `setTimeout` de 5 s** que existe solo mientras `shouldAutoplay` lo permite y se **reinstala** al cambiar el banner, la condición o la «época» de interacción:

```
shouldAutoplay = bannerCount >= 2 && isFocused && isAppActive && isRowVisible && !reducedMotion && !isInteracting
```

- **Por qué `setTimeout` y no `setInterval`.** Con un intervalo la cuenta seguiría corriendo durante las pausas y se reanudaría a medias. Aquí pausar destruye el temporizador y reanudar construye uno nuevo, así que **cada reanudación espera 5 s completos**, y el siguiente avance se mide desde que se muestra el nuevo banner.
- **Cleanup.** El efecto declara de qué depende (`autoplay`, `index`, `epoch`, `count`) y su cleanup limpia el temporizador antes de la siguiente ejecución y al desmontar: nunca hay dos ni uno huérfano. Los logs `[BannerAutoplay] armed | fired | cleared` (solo `__DEV__`) lo demostraron: un `armed` por ciclo y 5,01 s entre `armed` y `fired`.
- **`useEffectEvent`.** Lo que hace el temporizador al dispararse (`goTo(nextBannerIndex(...))`) usa el índice y `goTo` más recientes, pero el efecto **no** debe reinstalarse cuando `goTo` cambia (cambia en cada render). `useEffectEvent` (React 19.2) separa ambas cosas. Equivale a `rememberUpdatedState` en un `LaunchedEffect`.
- **Visibilidad = cuatro señales distintas**, porque ninguna cubre todo: foco (`useIsFocused`: otro tab, un producto apilado o el modal), `AppState` activo (`useIsAppActive`), fila visible en el viewport vertical (`onViewableItemsChanged` con `itemVisiblePercentThreshold: 50`: un carrusel desplazado fuera de pantalla sigue en la pantalla enfocada) y reduced motion (sin autoplay: el carrusel queda manual).
- **Interacción del usuario frente a scroll programático.** `banner-interaction.ts` es un reductor (`touching`, `dragging`, `epoch`) alimentado solo por `onTouchStart/End/Cancel` y `onScrollBeginDrag/EndDrag`. `onMomentumScrollEnd` **no** cuenta como fin de interacción porque también se dispara tras `scrollToOffset`: serviría para saber *dónde* se asentó, no *quién* movió la lista. Dos banderas y no una porque Android cancela el toque JS cuando el scroll nativo toma el gesto y iOS sigue enviando toques durante el arrastre.
- **Compuerta de visibilidad.** Si el carrusel deja de ser visible a mitad de un gesto (la app pasa a segundo plano) el fin del gesto nunca llega; al perder visibilidad se «olvida» el gesto (`resetInteraction`) con el patrón de React «ajustar estado durante el render» (comparar con el valor previo guardado en estado).
- **`AppState` como almacén externo.** `useIsAppActive` usa `useSyncExternalStore`: `inactive` (iOS: centro de control, selector de apps) tampoco cuenta como activa.

| | RN | Compose | SwiftUI |
|---|---|---|---|
| Paginador | `FlatList` `pagingEnabled` | `HorizontalPager` (`settledPage`) | `TabView` con `.page` |
| Índice al asentarse | `onMomentumScrollEnd` | `pagerState.settledPage` | `selection` del `TabView` |
| Autoplay | `setTimeout` en `useEffect` con cleanup | `LaunchedEffect` + `delay(5000)` + `isDragged` | `Timer.publish`/`.task` + `scenePhase` |
| Valor actualizado en el temporizador | `useEffectEvent` | `rememberUpdatedState` | capturar con `@State`/`@Binding` |
| Ciclo de vida | foco + `AppState` | `repeatOnLifecycle(STARTED)` | `scenePhase` |
| Accesibilidad ajustable | `accessibilityRole="adjustable"` + acciones `increment`/`decrement` | `semantics { stateDescription; customActions }` | `.accessibilityAdjustableAction` |

**Errores típicos.** `setInterval` sin cleanup; dependencias omitidas que dejan un temporizador con un índice viejo; `setState` en cada frame de scroll; confundir un scroll programático con un gesto; anunciar cada avance a TalkBack; y no considerar el segundo plano.

### Bloque H — React Compiler: decisión del usuario (≈5 min)

**Estado:** activo (`experiments.reactCompiler: true` en `app.json`, heredado del template, sin cambios). Ojo: **no es un valor por defecto de SDK 57**; es una opción experimental y opt-in (`@expo/config-types`: «Experimentally enable React Compiler») que el template trae activada. Lo que implica:
- El compilador **memoiza solo** componentes y hooks (en este proyecto compila 58 archivos y 64 funciones, sin omisiones ni errores). Eso **enmascara los renders innecesarios** que este material quiere enseñar a detectar: la intuición «este padre re-renderiza a todos los hijos» se ve menos en DevTools.
- Omite en silencio los componentes que incumplen las reglas de React y no falla el build (se comprobó que aquí no hay omisiones).
- Equivalente: el *skipping* de Compose por estabilidad de parámetros, o que SwiftUI compare las dependencias de `body`, sin que lo pidas.

**Para la demo:** marcar el componente de ejemplo con `"use no memo"` y medir con el Profiler antes y después. No se memoiza a mano sin una razón medible (regla del proyecto). Las excepciones de código son por **corrección**, no por rendimiento: `useCallback` en `onViewableItemsChanged` porque `FlatList` exige un callback estable, y el objeto `viewabilityConfig` a nivel de módulo porque `FlatList` lanza si cambia.

**Opción elegida:** dejarlo activo. Trade-off: optimización automática y se mantiene la configuración heredada del template (opt-in experimental), pero renders redundantes menos visibles para enseñar. **Descartada:** `experiments.reactCompiler: false` (más renders visibles, pero se pierde la optimización y se aleja del template).

**Error típico:** creer que «el compilador lo arregla» y dejar de entender qué dispara un render, o, al revés, llenar el código de `useMemo`/`memo` que el compilador ya hace.

### Bloque I — Accesibilidad y escalado de fuente (≈7 min)

- **Nombre, rol, estado, valor.** Tabs con etiqueta y selección; badge dentro de la etiqueta («Carrito, 5 artículos»); tarjetas, categorías, buscador y escáner son `button` con etiqueta y pista localizadas; el banner es `adjustable`; el modal y los estados de error tienen un título y un botón activable. Se verificó con TalkBack y VoiceOver (M17, M18).
- **Targets.** 48 dp en Android y 44 pt en iOS: el token `minimumTouchTarget` es 48. Medidos en Android: buscador 296×48 dp, escáner y flechas 48×48, tabs 96×48,5.
- **Texto escalable.** `allowFontScaling` activo por defecto; sin alturas fijas para texto; las listas crecen en vez de recortar.
- **Los límites son una decisión, no un descuido.** Donde el contenedor tiene **altura fija** se acota el escalado con `maxFontSizeMultiplier` y el valor vive en un token: `fontScaleLimits.tabLabel = 1.2` (barra de tabs) y `fontScaleLimits.searchField = 1.5` (buscador). Sin tope, Android a 2.0 cortaba el descendente de «Categorías» y iOS AX5 partía «suplemen-tos». Todo lo demás sigue escalando. Alternativa descartada: `tabBarAllowFontScaling: false` (deja de escalar, peor accesibilidad). Para fijar un tope en los tabs hay que usar un `tabBarLabel` propio (`TabBarLabel`), porque la opción del navegador es solo booleana; en iOS se conserva su comportamiento (escalado desactivado y *large content viewer* al mantener pulsado).
- **Reduced motion.** `useReducedMotionPreference` (`AccessibilityInfo` + `useSyncExternalStore`) apaga el autoplay, las transiciones de imagen, el scroll animado programático y la opacidad de pulsación. La paginación manual sigue funcionando.
- **Comparación.** Android: `sp` escala con `fontScale` (en Compose se puede acotar con una `Density` propia o `maxLines`); iOS: Dynamic Type y `.dynamicTypeSize(...DynamicTypeSize.xxxLarge)`. En RN: `maxFontSizeMultiplier`.

**Limitaciones aceptadas** (documentadas en el registro de verificación): iconos `SymbolView` recortados en Android con fuente grande (H-1, revisión en el Día 6), arranque en frío con enlace (Día 5), iPhone físico sin override de red, N-4 a N-7 y H-7 (rótulos de categorías cercanos con fuente máxima).

---

### Decisiones del Día 2

| Alternativa tratada | Elegida | Trade-off | Descartada |
|---|---|---|---|
| Dónde viven producto, categoría y búsqueda | Un `Stack` por tab (grupos `(home)`, `(categories)`, `(cart)`, `(account)`); destinos en el stack del tab que los origina | Más archivos de layout; destinos compartidos futuros exigirán grupos en array | Producto/categoría/búsqueda en el stack raíz: más simple, pero Atrás y estado dejan de pertenecer al tab (rompe RF-6) |
| Tabs | `Tabs` y `Stack` estables de Expo Router | Apariencia menos nativa | `unstable-native-tabs` del template: API inestable y riesgo didáctico |
| Pila debajo de un enlace | `unstable_settings.anchor` en raíz, `(tabs)` y stack de Home | Configuración implícita que hay que probar con enlaces | Anchor por defecto (solo busca un hijo con el nombre del grupo; `index` no cumple) |
| Un destino por tipo | `dangerouslySingular={(name) => name}` | No se puede apilar producto sobre producto | `getId` (deprecado) o bloqueos manuales con estado en cada `Pressable` (duplica lógica) |
| Scroll y pila por tab | No guardar nada: el tab sigue montado | Memoria de pantallas inactivas | `freezeOnBlur` (riesgo sin necesidad medida) y persistir offsets a mano |
| Existencia del producto | Cliente mínimo `GET /products/:id` (loading, 404, offline, error) | Una petición extra que el Día 4 sustituye | Aceptar cualquier id con forma válida (RF-8 exige «no existe → no encontrado») |
| Cliente de datos de Home | `fetchJson` + clientes por feature + clasificador puro | Se migra a RTK Query en el Día 3 | Adelantar RTK Query antes de su bloque o acoplar `fetch` a la pantalla |
| Qué es «offline» | Fallo de `fetch` **sin respuesta** (estructura), con el abort propio por delante | Un timeout en red degradada se muestra como error, no como offline | `instanceof TypeError` (falla con `expo/fetch`, N-1), tratar todo fallo como offline (oculta fallos del servidor) o `NetInfo` (dependencia nueva) |
| Contrato de `/home` | Validación estructural sin dependencias (Zod llegará después): un elemento malformado invalida todo el payload (pantalla de error); secciones y badges desconocidos se ignoran por compatibilidad hacia delante | Una sola entrada mala deja la pantalla en error | Descartar en silencio los elementos malos (el servidor incumplió su promesa y no conviene ocultarlo) |
| Estado de Home | Reductor con hechos (`requestId`, `isPending`, `data`, `outcome`) y pantalla derivada en render | Un poco más de código que `useState` | Guardar el estado de pantalla y sincronizarlo con efectos |
| Refetch | Pull y Reintentar siempre; primer plano siempre (sin petición en curso); foco de navegación solo tras fallo | Volver de un producto no refresca con datos buenos hasta el Día 3 | Refetch en cada foco (repite peticiones) |
| Foco | Evento `focus` (`navigation.addListener`) para reaccionar una vez (refetch tras fallo); `useIsFocused` como valor derivado en render para el autoplay | El hook re-renderiza al cambiar el foco | Mirar el foco con un efecto y `setState` (estado duplicado) |
| Visibilidad del carrusel | `onViewableItemsChanged` (50 %) + foco + `AppState` + reduced motion | La fila podría desmontarse por la virtualización (con ≤5 filas el riesgo es bajo) | Solo el foco (no detecta un carrusel desplazado fuera) o matemática manual con `onScroll`+`onLayout` |
| Carrusel | `FlatList` horizontal y `setTimeout` reinstalado | Se implementan índice y temporizador | Dependencia de carrusel (para una conducta acotada) y `setInterval` (reanuda a medias) |
| Índice del carrusel | Se actualiza en `onMomentumScrollEnd` | El indicador cambia al asentarse el gesto | `setState` en cada `onScroll` (~60 renders por gesto) |
| Imágenes del mock | PNG generados con `zlib`, CRC32 propio y `Content-Type: image/png` en `/images/:kind/:name` | Un pequeño codificador PNG que mantener; imágenes sin texto | SVG (contrato `.png`, `expo-image` lo trata distinto por plataforma), binarios versionados (600+), servicios externos y `sharp`/`canvas` (dependencias) |
| URL de imágenes | `resolveAssetUrl` pura y estricta | Hay que mantener el parser a mano (el `URL` de RN no es consistente) | Concatenar en cada componente |
| Textos de contenido | Claves i18n por id con *fallback* del servidor | Hay que dar de alta cada id | Mostrar el texto del servidor (inglés) |
| Escalado de fuente | `maxFontSizeMultiplier` con tokens (`tabLabel` 1.2, `searchField` 1.5) | Un tope arbitrario que revisar en el Día 6 | `tabBarAllowFontScaling: false` y no acotar nada (cortes reales) |
| React Compiler | Activo, heredado del template (opt-in experimental; decisión del usuario) | Renders innecesarios menos visibles | `experiments.reactCompiler: false` |
| Modal del escáner | Modal real de navegación sin cámara | Aún no escanea | Simular el escaneo antes del Día 5 |
| Pruebas de lógica | `node:test` junto a los módulos puros (`npm run test:logic`) | Estilo restringido (imports relativos con extensión, sin RN ni `@/`) | Jest/RNTL antes del Día 6 (constitución, art. 4) |
| Casos que el servidor no produce | Fixtures `EXPO_PUBLIC_HOME_FIXTURE` solo con `__DEV__` | Variable de entorno y reinicio de Metro con `-c` | Menú de depuración en la interfaz |
| Arranque en frío con enlace | Cerrado en el Día 5 | Hoy no hay evidencia de ese caso | Compilación Release local ahora |

**Desviaciones respecto al plan** (y por qué):
- **`resolveAssetUrl` más estricto.** El plan dejaba pasar cualquier `http(s)://` absoluta. Ahora solo devuelve URLs del origen dado y rechaza `//host`, otros hosts o puertos, esquemas no HTTP, caracteres de control, espacios y `\`. Motivo: el servidor es una entrada no confiable y un parser distinto del nuestro podría leer la URL de otro modo.
- **Oferta solo si `listPrice > price`.** El plan decía «si hay `listPrice`». Un precio de lista igual o menor no es un descuento y tacharlo confunde.
- **Formato `es-MX` / `en-US`.** El plan hablaba de «locale derivado del idioma». `es` a secas escribiría `277,90 MXN`; la tienda es en pesos con precios en dólares y el español mexicano da `$277.90` y `USD 11.99`.
- **Offline por estructura.** El plan decía `TypeError`; el SDK 57 rechaza con `FetchError` (N-1).
- **Estado de Home con reductor.** El plan decía «contador de petición»; se hizo un reductor puro con `requestId` y reglas puras de refetch (`shouldRefetchOnForeground`, `shouldRefetchOnFocus`).
- **Interacción del carrusel.** El plan listaba `onTouchStart/End/Cancel` y `onScrollBeginDrag`; se añadió `onScrollEndDrag`, la época y el rechazo explícito de `onMomentumScrollEnd`.
- **Tope de fuente y ancho de tarjeta.** `fontScaleLimits` (tabs y buscador) lo decidió el usuario tras la matriz (N-2/N-3), y el ancho de tarjeta que crece con la fuente hasta 1.5x salió de T6; no estaban en el plan.
- **Contrato de Home y fixtures.** Un elemento malformado invalida el payload y las fixtures `server-fail` usan `/home?fail=true`.
- **Opciones de pila.** `+not-found` usa un botón Atrás mínimo porque iOS etiquetaría la flecha con el nombre del grupo «(tabs)».
- **Aprobación del usuario (revisión de @reviewer, ronda 1).** El usuario aprobó, sin confirmación expresa caso por caso, las decisiones anteriores del implementador: un elemento malformado invalida todo `/home` (pantalla de error); un id de producto con forma inválida va a `/product/invalid`; el ejercicio `brand/[slug]`; el ancho de tarjeta creciente hasta 1.5x; y el test extra `parity.test.ts`.
- **Deep links hacia rutas internas (I-3).** El usuario aceptó el comportamiento actual (ver Bloque D): se revisa con el escáner real del Día 5.
- **Trasladados a otros días (M-4).** Dos puntos de la revisión quedan trasladados a los planes de los Días 4 y 6 (los registra el planificador en `specs/004` y `specs/006`).
- **Ideas pendientes para la auditoría del Día 6** (opcionales, no aplicadas por decisión del usuario): M-5, M-6 y un test extra para `src/core/network/http.ts` (línea ~80).

---

### Ejercicio del Día 2 (sin solución)

**Añade la ruta parametrizada `brand/[slug]`: la pantalla de una marca, con validación, estado no encontrado, enlace profundo y comportamiento al volver.**

Hazlo en una rama o carpeta de práctica sin romper lo existente (la marca no se muestra hoy en las tarjetas; esta ruta no cambia eso). Sin dependencias nuevas.

1. **Ruta y pantalla.** Un archivo delgado en el stack de Inicio y la pantalla en `src/features/brand/`. Muestra el slug validado y un texto de marcador de posición en español e inglés.
2. **Validación primero.** Una función pura `parseBrandSlug` con tests `node:test` **antes** de implementarla. Define y documenta tú el formato permitido y cubre, como mínimo: válido, vacío, array, `undefined`, mayúsculas, espacios, `..`, `%2F`, caracteres no ASCII y longitud excesiva. Confirma que cada test falla por la razón esperada antes de escribir el código.
3. **No encontrado.** Un slug inválido o ausente muestra el estado no encontrado compartido (Volver e Ir a Inicio) **sin ninguna petición**. Define con qué criterio sería «inexistente» frente a «inválido» cuando exista un servidor, y anótalo (no lo implementes).
4. **Una instancia.** Decide cómo identificar la pantalla (por nombre de ruta o por slug), justifica la decisión con su trade-off y comprueba el resultado de abrir la marca A y luego la B, y de un doble toque.
5. **Enlace profundo.** `herbstore://brand/<slug>` abre la pantalla con Inicio debajo y Atrás vuelve a Inicio; amplía `normalizeIncomingUrl` con tests antes de tocarla (válido, inválido, query/fragmento, mayúsculas) y comprueba en `+native-intent` que no se registra la URL. Un enlace inválido muestra el estado no encontrado, y un host desconocido sigue yendo a `+not-found`.
6. **Navegar con tipos.** Abre la ruta con `router.push({ pathname: ..., params: ... })`. Demuestra que el compilador rechaza una ruta mal escrita **y** que acepta un slug basura (y por qué eso exige tu parser).
7. **Al volver.** Desde Inicio con scroll, entra a la marca y vuelve: la posición de Inicio debe conservarse **sin escribir código para ello**. Repite cambiando de tab y volviendo. Anota en una línea por qué ocurre.
8. **Accesibilidad.** Objetivos de 48 dp / 44 pt, texto al máximo del sistema sin recortes, cabecera con rol y título localizado, TalkBack/VoiceOver leen nombre y acciones.
9. **Validación.** Android físico e iOS simulador, claro y oscuro, español e inglés. Añade un `console.log` bajo `__DEV__` que registre solo el resultado (válido/no válido), nunca el slug, y comprueba qué se registra por cada caso.
10. **Diagnóstico (sin respuestas aquí).** Explica cuántos problemas tiene este fragmento y qué cambiarías:

```tsx
export default function BrandRoute() {
  const { slug } = useLocalSearchParams();
  const [brand, setBrand] = useState(null);

  useEffect(() => {
    fetch(`${origin}/brands/${slug}`)
      .then((response) => response.json())
      .then(setBrand);
  }, []);

  return <Text>{brand.name}</Text>;
}
```

Entrega esperada: el código, una tabla de tus casos (entrada → pantalla → petición sí/no), una explicación en tus palabras (≤ 8 líneas) y la comparación con `navArgument`/`toRoute` y `navigationDestination(for:)`.

---

### Preguntas de repaso (respuestas cortas)

1. **¿Qué relación hay entre Expo Router y React Navigation, y qué hace un grupo `(home)`?**
   Expo Router genera la configuración de React Navigation a partir de los archivos y lleva su propia copia. Un grupo organiza rutas y da a cada tab su `Stack` sin añadir un segmento a la URL.
2. **¿Por qué la posición de scroll de Home se conserva al cambiar de tab sin código propio?**
   Porque el navegador del tab sigue montado: su `FlatList` y su estado siguen vivos. Lo conserva el montaje, no el código; por eso no hay que guardar offsets a mano.
3. **¿Qué hace `dangerouslySingular={(name) => name}` y qué pasa con el enlace A seguido del B?**
   Limita la ruta a una instancia usando su nombre como identidad (análogo a `launchSingleTop`, aunque reinserta la instancia previa arriba aunque no estuviera en la cima). Tras A y B queda un solo producto (B) y Atrás vuelve a Inicio; los toques repetidos no apilan duplicados.
4. **¿Qué validan las typed routes y qué no?**
   Validan el pathname y los parámetros requeridos al compilar, no el contenido. `/product/lo-que-sea` compila, por eso se parsea el parámetro en ejecución (`parseProductId`).
5. **¿Para qué sirven `+native-intent` y `unstable_settings.anchor`?**
   `+native-intent` normaliza o descarta la URL entrante antes de navegar (sin lanzar nunca). `anchor` indica qué pantalla se monta debajo de un destino abierto por enlace, para que Atrás tenga a dónde volver.
6. **¿Por qué el arranque en frío con enlace no está validado y cuándo se hará?**
   El launcher de `expo-dev-client` intercepta el enlace. El usuario decidió cerrarlo en el Día 5 (validación nativa, p. ej. con una compilación Release).
7. **¿Por qué «offline» no se detecta con `instanceof TypeError`?**
   Porque `expo/fetch` (el `fetch` global del SDK 57) rechaza con `FetchError extends Error`. Se clasifica por estructura (fallo de `fetch` sin respuesta), con el abort propio por delante, y se prueba con un doble que reproduzca ese error.
8. **¿Qué ventaja tiene el estado de pantalla como unión discriminada frente a booleanos sueltos?**
   Cada variante lleva solo sus datos, el compilador exige tratar todos los casos y no existen combinaciones imposibles. Es un `sealed interface` en Kotlin o un `enum` con valores asociados en Swift.
9. **¿Por qué el autoplay usa un `setTimeout` reinstalado y para qué sirve `useEffectEvent`?**
   Un `setTimeout` que se destruye y se vuelve a crear garantiza 5 s completos tras cada pausa o cambio, y el cleanup evita temporizadores huérfanos. `useEffectEvent` lee el valor más reciente sin reinstalar el efecto (como `rememberUpdatedState`).
10. **¿Qué hace el React Compiler en HerbStore y cómo se muestra un render innecesario?**
    Memoiza componentes y hooks automáticamente y enmascara renders redundantes. Para enseñar, se marca el componente con `"use no memo"` y se mide con el Profiler; no se memoiza a mano sin medir.

---

### Checklist oral

Debería poder explicar, sin mirar apuntes y en unos 60 segundos cada punto:

**Layouts y grupos**
- [ ] Qué es un `_layout.tsx`, qué aporta un grupo `(x)` y por qué solo Home usa `index`.
- [ ] Cómo se relacionan Expo Router y React Navigation, y su equivalente en `NavHost`/`TabView`.

**Tabs**
- [ ] Cuatro tabs y badge: por qué `undefined` en cero y por qué la etiqueta hablada conserva el número real.
- [ ] Por qué se conserva el scroll de cada tab («lo conserva el montaje») y qué pasa al tocar el tab activo.
- [ ] Qué se acotó en el escalado de fuente de los tabs y por qué (y por qué un `tabBarLabel` propio).

**Stacks**
- [ ] Por qué un `Stack` por tab frente a producto en la raíz, y qué hace Atrás.
- [ ] Rutas dinámicas: `useLocalSearchParams`, `string | string[] | undefined`, typed routes y `parseProductId`.
- [ ] Cómo y por qué `dangerouslySingular` evita duplicados (y por qué no `getId`).

**Modales**
- [ ] Cómo se declara un modal, cómo se cierra en cada plataforma y por qué el botón Cerrar es obligatorio.

**Deep links**
- [ ] Recorrido de `herbstore://product/<id>`: scheme, `redirectSystemPath`, `normalizeIncomingUrl`, ruta, `anchor`.
- [ ] `+not-found`, id inválido frente a inexistente, enlace con la app activa y A→B.
- [ ] Qué es el arranque en frío, por qué hoy no se puede observar y qué se hará.

**Datos y estados**
- [ ] `fetchJson`, offline frente a error, la lección del `FetchError` y por qué se prueba con el `fetch` real.
- [ ] `classifyHomeResult` y `useHome`: unión discriminada, un solo request, `requestId`, abort y refetch.

**Listas, imágenes y carrusel**
- [ ] Lista por filas con `key` estable, imágenes con dimensiones reservadas y `Intl.NumberFormat` por moneda.
- [ ] Autoplay: condiciones, `setTimeout` reinstalado, cleanup, `useEffectEvent` y usuario frente a scroll programático.

**Accesibilidad y proceso**
- [ ] Elemento `adjustable`, etiquetas de tarjetas, targets 48/44 y reduced motion.
- [ ] React Compiler: qué hace, qué enmascara, `"use no memo"` y por qué no se memoiza sin medir.
- [ ] Cómo se verificó el día: lógica con `node:test`, matriz manual en Android e iOS, y qué se pasa a Maestro (Día 6).

---

### Registro de verificación del Día 2: matriz de T9

Estado: **T9 aprobada por el usuario (2026-10-10): parte automática ejecutada, parte manual declarada correcta y, tras corregir N-1 (offline) y acotar el texto de tabs y buscador (N-2/N-3), repetidos los casos pendientes con todos los resultados correctos.** Las celdas con `OK (auto)` las verificó el implementador por `adb`/`simctl` con evidencia (capturas, `uiautomator dump`, logcat); los fallos automáticos iniciales (N-1, N-2, N-3) se corrigieron y ninguna celda queda en fallo. `OK (usuario)` = el usuario declaró de forma GENERAL, en dos momentos, que sus pruebas manuales funcionaron: (1) "ya realicé las pruebas y funcionó de manera correcta"; (2) tras los arreglos de N-1/N-2/N-3, "los resultados salieron bien, no hubo ningún tema" al repetir los casos pendientes (offline M4/M7/M8 y los estados offline de M17/M18; texto ampliado de tabs y buscador M15 a 1.5/2.0 en Android y AX5 en iOS). No hay detalle por caso ni se afirma nada más específico. Las celdas marcadas "repetido tras N-1" o "tras acotar" son las de ese segundo momento. Ninguna celda queda pendiente. Resumen y pendientes al final de la matriz ("Resultados automáticos"). Spec `specs/002-dia-2-navegacion-home`, plan "Matriz de T9". Plataformas: Android físico (USB, `adb reverse` de 8081 y 3001) y simulador iOS.

**Teoría breve (≈6 min): pruebas de interfaz manuales frente a pruebas instrumentadas.**
- Una matriz manual es una lista de casos con pasos y resultado esperado ejecutados por una persona sobre el binario real. Sirve para descubrir qué merece automatizarse.
- Android: Espresso (vistas) y Compose test (`createComposeRule`, `onNodeWithText`, `performClick`) hablan con el árbol de semántica. iOS: XCUITest consulta el árbol de accesibilidad. En React Native, el equivalente transversal es **Maestro** (Día 6), que consulta ese mismo árbol de accesibilidad en ambas plataformas; las etiquetas que probamos hoy con TalkBack/VoiceOver serán los selectores de mañana.
- Candidatos a Maestro (Día 6): tabs y badge, reselección del tab, escáner modal, deep links (activo y A→B), producto 404, doble toque, estados de Home con fixtures, autoplay con 2 banners. No automatizables con facilidad: TalkBack/VoiceOver reales, escala de fuente y reduced motion del sistema, arranque en frío con el launcher del dev client.
- Opción elegida: matriz manual en el Día 2 + lógica pura con `node:test`. Trade-off: no hay red de seguridad ante regresiones de UI hasta el Día 6. Descartada: Jest/RNTL antes del Día 6 (constitución, art. 4: no se instalan herramientas fuera de un plan aprobado).

**Preparación (una vez).** Producto A = `product-261009-001`, B = `product-261009-002`, inexistente = `product-261009-999`, inválido = `not-an-id`. Id de paquete/bundle: `com.herbstore.mobile`. Los comandos exactos por caso están en el informe de T9; aquí se resumen en la columna "Pasos". Restaurar al terminar: tema, `font_scale`, `transition_animation_scale`, `adb reverse`, `.env.local` y mock.

Leyenda: `OK (auto)` y `OK (usuario)` como arriba; `N/A (motivo)` = el caso no aplica a esa plataforma. Durante el día cada celda empezó como pendiente y se fue rellenando con evidencia o con la declaración del usuario; nunca por suposición.

### M1. Navegación y tabs (RF-4, RF-5, RNF-1)

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| Cuatro tabs | Abrir la app | Inicio, Categorías, Carrito, Cuenta, en ese orden, con icono y nombre | OK (auto) | OK (auto) |
| Badge 0/5/100 | Carrito → Sumar 1 / Sumar 10 / Restablecer (control de desarrollo) | 0: sin badge; 5: "5"; 100: "99+"; Restablecer lo oculta | OK (usuario) (auto parcial: con 0 no hay badge; 5 y 99+ a cargo del usuario) | OK (usuario) (auto parcial: con 0 no hay badge) |
| Estado por tab | Home: desplazar; Categorías; volver a Inicio | Misma posición de scroll | OK (usuario) | OK (usuario) |
| Pila por tab | Inicio → Producto; cambiar a Cuenta; volver a Inicio | Sigue el Producto apilado | OK (usuario) | OK (usuario) |
| Reselección en raíz | Tocar 5 veces "Inicio" estando en Home | Sin pantallas duplicadas; Atrás sale de la app | OK (usuario) | OK (usuario) |
| Reselección con producto apilado | Producto abierto → tocar "Inicio" varias veces | Como mucho vuelve a la raíz del tab; nunca duplica | OK (usuario) | OK (usuario) |
| Cambio durante scroll | Desplazar Home con inercia y cambiar de tab y volver | Tab, pila y posición recuperados | OK (usuario) | OK (usuario) |
| Foundations | Cuenta → Fundamentos de React Native; Atrás | Abre y vuelve a Cuenta | OK (usuario) | OK (usuario) |

### M2. Stack y Atrás (RF-6)

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| Atrás desde producto | Inicio → tarjeta → Atrás (botón/gesto) | Vuelve a Inicio, mismo tab, scroll conservado | OK (usuario) | OK (usuario) |
| Atrás desde búsqueda | Inicio → buscador → Atrás | Vuelve a Inicio | OK (usuario) | OK (usuario) |
| Atrás desde categoría | Inicio → categoría → Atrás | Vuelve a Inicio | OK (usuario) | OK (usuario) |
| Atrás en raíz | Atrás en Inicio sin pila | Android: sale de la app. iOS: n/a (sin Atrás de sistema) | OK (usuario) | N/A |

### M3. Modal del escáner (RF-7)

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| Abrir | Inicio (con scroll) → icono de escáner | Modal sobre Home | OK (usuario) (auto parcial: `herbstore://scanner` abre el modal; el icono, a cargo del usuario) | OK (usuario) (auto parcial: `herbstore://scanner` abre el modal; el icono, a cargo del usuario) |
| Cerrar con botón | Botón "Cerrar" | Home con su scroll previo | OK (usuario) | OK (usuario) |
| Cerrar con gesto/Atrás | iOS: arrastrar hacia abajo. Android: Atrás | Home con su scroll previo | OK (usuario) | OK (usuario) |
| Una sola instancia | Doble toque rápido en el icono | Un solo modal | OK (usuario) | OK (usuario) |

### M4. Ruta dinámica y no encontrado (RF-8)

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| Id válido | Tocar una tarjeta o enlace con A | Pantalla de producto con nombre e id | OK (auto) | OK (auto) |
| Id inexistente | Enlace con `product-261009-999` | "Producto no encontrado" con Volver e Ir a Inicio | OK (auto) | OK (auto) |
| Id inválido | Enlace con `not-an-id` | Mismo estado, **sin petición** al servidor | OK (auto: sin servidor sigue "no encontrado", luego no hay petición) | OK (auto: estado; la ausencia de petición no es observable en iOS) |
| Servidor detenido | Detener mock; abrir A | Estado sin conexión con Reintentar; al reiniciar el mock, Reintentar recupera | OK (usuario, repetido tras N-1; auto tras el arreglo: "Sin conexión con el servidor" + Reintentar, también con el producto abierto por enlace y `adb reverse --remove tcp:3001`; ver N-1) | OK (usuario, repetido tras N-1) |
| Salidas | Volver / Ir a Inicio | Volver regresa; Ir a Inicio abre Home sin pila extra | OK (usuario) | OK (usuario) |

### M5. Deep links (RF-9)

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| App activa | `am start` / `simctl openurl` con A | Un producto con Home debajo; Atrás → Inicio | OK (auto) / OK (usuario) (auto: abre el producto; Atrás: declaración general del usuario) | OK (auto: el botón Atrás se llama "Inicio") |
| A → B | Enviar A y luego B | Un solo producto (B); Atrás → Inicio | OK (auto) / OK (usuario) (auto: muestra B; la profundidad de la pila no es observable; Atrás: declaración general del usuario) | OK (auto: muestra B y el botón Atrás sigue llamándose "Inicio": un solo producto) |
| Id inválido | Enlace con `not-an-id` | Estado no encontrado del producto | OK (auto) | OK (auto) |
| Host desconocido | `herbstore://unknown` | `+not-found` con salida a Inicio | OK (auto: pantalla "No encontramos esta pantalla" con Volver e Ir a Inicio) | OK (auto) |
| Arranque en frío | Cerrar a la fuerza + enlace | Un solo destino, o el launcher del dev client lo intercepta (limitación conocida; decisión del usuario: se cierra en el Día 5) | OK (auto: el launcher del dev client intercepta el enlace; limitación del Día 5) | OK (auto: ídem) |

### M6. Reselección y multitoque en transición (casos límite)

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| Doble toque en tarjeta | Doble toque rápido sobre una tarjeta | Una sola pantalla de producto | OK (usuario) | N/A (un puntero; solo doble toque) |
| Dos dedos, dos tarjetas | Tocar a la vez dos tarjetas distintas | Una sola pantalla de producto | OK (usuario) | N/A |
| Tarjeta + banner | Tocar a la vez un banner y una tarjeta | Un solo destino por tipo, sin pila corrupta | OK (usuario) | N/A |
| Doble toque en categoría/banner | Doble toque rápido | Una sola pantalla de categoría | OK (usuario) | OK (usuario) |

### M7. Home: loading, error, offline, empty, aviso (RF-14, RF-15)

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| Loading | Mock con `MOCK_LATENCY_MS=3000`; abrir la app | Esqueleto con "Cargando Inicio"; sin saltos bruscos al terminar | OK (usuario) | OK (usuario) |
| Error de servidor | Fixture `server-fail` | "No se pudo cargar Inicio" + Reintentar (distinto de offline) | OK (usuario) | OK (usuario) |
| Offline en primera carga | Mock parado (Android: `adb reverse --remove tcp:3001`) | "Sin conexión con el servidor" + Reintentar; al restaurar, Reintentar carga | OK (usuario, repetido tras N-1; auto tras el arreglo: Home muestra "Sin conexión con el servidor" + Reintentar, log `settled: network`) | OK (usuario, repetido tras N-1) |
| Aviso con datos previos | Cargar Home; parar mock; arrastrar para refrescar | Datos visibles + aviso "Sin conexión..." | OK (usuario, repetido tras N-1) | OK (usuario, repetido tras N-1) |
| Recuperación del aviso | Restaurar mock; arrastrar para refrescar | El aviso desaparece | OK (usuario, repetido tras N-1) | OK (usuario, repetido tras N-1) |
| Vacío total | Fixture `all-empty` | "Todavía no hay nada que mostrar" + Reintentar | OK (usuario) | OK (usuario) |
| Sección vacía | Fixture `empty-section` | Solo desaparece "Nuevos"; el resto sigue | OK (usuario) | OK (usuario) |

### M8. Refresco en primer plano y foco (RF-14)

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| Primer plano | Home visible → segundo plano → volver | Se solicita Home de nuevo (log `[home] refetch on foreground`) | OK (auto: `[home] refetch on foreground` al volver tras 11 s) | OK (usuario) |
| Foco tras fallo | Provocar fallo; ir a Categorías y volver | Reintenta al recuperar el foco (log `refetch on focus after a failure`) | OK (usuario, repetido tras N-1; el fallo se provoca con el servidor parado y clasifica como `network`) | OK (usuario, repetido tras N-1) |
| Foco sin fallo | Con datos correctos, ir a otro tab y volver | No hay petición nueva | OK (usuario) | OK (usuario) |

### M9. Banners 0 / 1 / N (RF-10, RF-12, RF-15)

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| N = 2 (servidor real) | Abrir Home; deslizar y usar flechas | Indicadores acompañan; flechas acotadas (sin wrap manual) | OK (usuario) (auto parcial: indicadores acompañan y las flechas se deshabilitan en los extremos; deslizar y pulsar, a cargo del usuario) | OK (usuario) (auto parcial: ídem por capturas) |
| 1 banner | Fixture `one-banner` | Banner sin indicadores ni flechas; sin autoplay | OK (usuario) | OK (usuario) |
| 0 banners | Fixture `zero-banners` | Sin carrusel ni indicadores; resto de Home intacto | OK (usuario) | OK (usuario) |
| Destino | Tocar un banner | Abre `category/<categoryId>` y Atrás vuelve a Inicio | OK (usuario) | OK (usuario) |

### M10. Autoplay y ciclo de vida (RF-12, RF-13)

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| 5 s medidos | Cronómetro con 2 banners | Avanza cada ~5 s y el indicador cambia | OK (auto: 5,01-5,02 s armed→fired por logcat, 6 ciclos) | OK (auto, aprox.: cadencia ≈5,2 s por capturas, ±0,5 s) |
| Pausa por toque/arrastre | Tocar o arrastrar; soltar | Se detiene; reanuda ~5 s después de soltar | OK (usuario) | OK (usuario) |
| Segundo plano | Segundo plano 15 s; volver | No avanza en segundo plano; al volver espera 5 s completos | OK (auto: 11 s en HOME sin `fired`; al volver `armed` y `fired` a los 5,016 s) | OK (usuario) |
| Cambio de tab / producto / modal | Abrir cada uno y volver | Pausa mientras no es visible; al volver espera 5 s completos | OK (usuario) (auto parcial: producto y modal por enlace: `cleared` sin `fired` en 9 s y 5 s completos al volver; tab, a cargo del usuario) | OK (usuario) |
| Fuera de pantalla | Desplazar Home hasta ocultar el carrusel; volver | Pausa y espera completa al reaparecer | OK (usuario) | OK (usuario) |
| Reduced motion a mitad | Activar durante el autoplay | Se detiene antes del siguiente cambio y queda manual | OK (auto: `transition_animation_scale 0` → `cleared` en <1 s y 14 s sin `fired`; al restaurar `armed` y `fired` a los 5,01 s) | OK (usuario) (a cargo del usuario) |
| Sin temporizadores huérfanos | Revisar logs `armed`/`fired`/`cleared` | Un solo `armed` por cambio; `cleared` al salir | OK (auto: un `armed` por ciclo en 6 ciclos, `cleared` al salir) | OK (usuario) |

### M11. Imagen rota (RNF-3)

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| Alternativa etiquetada | Fixture `broken-image` | Marco con dimensiones reservadas y "Imagen no disponible" (en categorías, la inicial); sin saltos | OK (usuario) | OK (usuario) |
| Etiqueta accesible | TalkBack/VoiceOver sobre la imagen rota | Lee el nombre del elemento | OK (usuario) | OK (usuario) |

### M12. Categorías y secciones (RF-10, RF-11)

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| Composición | Home completo | Buscador, escáner, banners, 5 categorías circulares y Más vendidos / Nuevos / Ofertas | OK (auto: con `wm size` alto se ven buscador, escáner, banners, 5 categorías y Más vendidos / Nuevos / Ofertas) | OK (usuario) (auto parcial: buscador, escáner, banner, categorías y "Más vendidos" visibles; el resto requiere scroll) |
| Destinos | Tocar buscador, categoría y producto | Abren búsqueda, categoría y producto con el parámetro seleccionado | OK (usuario) | OK (usuario) |
| Insignia | Observar tarjetas | Una sola insignia (Oferta con precio tachado, Nuevo o Más vendido); sin marca | OK (auto: una sola insignia por tarjeta; Oferta con precio anterior tachado; sin marca) | OK (usuario) (auto parcial: insignias de la primera fila correctas) |
| Scroll horizontal | Deslizar cada fila horizontal | Sin recortes ni solapes | OK (usuario) | OK (usuario) |

### M13. Monedas MXN / USD

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| Formato por moneda | Buscar una tarjeta en MXN y otra en USD | `$277.90` (MXN) y `USD 11.99` según el idioma/moneda del producto | OK (auto: `$277.90` MXN, `USD 11.99` USD, oferta `USD 12.99` con `USD 15.59` tachado) | OK (usuario) |
| Idioma en | Cambiar el idioma del sistema a inglés | Todos los textos en inglés y precios formateados con `en-US` | OK (usuario) | OK (usuario) |

### M14. Tema claro / oscuro (RNF-4)

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| Claro | Recorrer M1–M12 clave (Home, producto, 404, modal, estados) | Contraste legible, sin elementos invisibles | OK (auto: Home, producto, 404 y modal) | OK (auto: Home, producto, 404 y modal) |
| Oscuro | Ídem con tema oscuro | Ídem; imágenes y badge legibles | OK (auto: Home y modal legibles) | OK (auto: Home y 404 legibles) |
| Cambio en caliente | Cambiar de tema con la app abierta | La UI se actualiza sin reiniciar | OK (auto: `cmd uimode night`, sin `Running "main"` y la UI cambia) | OK (auto: `simctl ui appearance`, mismo proceso) |

### M15. Texto ampliado (RNF-1, RNF-4)

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| Escala 1.3–1.5 | Android `font_scale 1.3/1.5`; iOS tamaño XL/AX1 | Sin recortes ni solapes en Home, tarjetas, tabs, producto, 404, modal | OK (usuario, repetido tras acotar los tabs, N-2; auto tras el arreglo: 1.5 con etiquetas completas a 12 pt y buscador en una línea; los iconos de `SymbolView` siguen cortados, H-1 aceptado) | OK (auto: XL en Home y arranque limpio) |
| Escala máxima | Android `font_scale 2.0`; iOS AX5 | Texto legible y accesible; lo que se recorte queda anotado como hallazgo (ver abajo) | OK (usuario, repetido tras acotar, N-2; auto tras el arreglo: 2.0 con etiquetas de tabs completas y buscador en una línea; iconos cortados = H-1 aceptado; rótulos de categorías pegados = H-7 pendiente) | OK (usuario, repetido tras acotar, N-3; auto tras el arreglo: AX5 con "Buscar suplementos" en una línea y el escáner sin estirar) |
| Targets | Con escala normal, tocar flechas, escáner, botones, categorías | ≥48 dp en Android y ≥44 pt en iOS, sin toques fallidos | OK (auto: buscador 296×48 dp, escáner y flechas 48×48, Volver/Cerrar 48 de alto, Atrás 56, tabs 96×48,5 por `dumpsys`, categorías 72×96) | OK (usuario) |

### M16. Reduced motion (RNF-2)

| Caso | Pasos | Esperado | Android | iOS |
|---|---|---|---|---|
| Estado reportado | Cuenta → Fundamentos | "Movimiento reducido: activado" | OK (auto: "Movimiento reducido: activado" en `/foundations`, abierto por enlace) | OK (usuario) (a cargo del usuario) |
| Autoplay | Con reduced motion activo, esperar 15 s | El carrusel no avanza solo | OK (auto: 8 s con Home visible sin ningún log del autoplay) | OK (usuario) (a cargo del usuario) |
| Paginación manual | Flechas y deslizamiento | Funcionan; el salto programático no se anima | OK (usuario) | OK (usuario) |
| Imágenes | Recargar Home | Sin fundido de imagen (transition 0) | OK (usuario) | OK (usuario) |

### M17. TalkBack (Android) (RNF-1)

| Caso | Pasos | Esperado | Android |
|---|---|---|---|
| Tabs | Explorar la barra | Lee nombre y selección; "Carrito, N artículos" con badge | OK (usuario) |
| Cabecera | Buscador y escáner | Nombre y pista localizados; botones activables | OK (usuario) |
| Carrusel | Enfocar el banner; acciones personalizadas | "Banner n de N"; incrementar/decrementar cambian de banner; "Abrir categoría" abre | OK (usuario) |
| Tarjetas y categorías | Enfocar tarjeta/categoría | Nombre, precio (oferta con precio anterior) y calificación; categoría con pista | OK (usuario) |
| Estados | Error/offline/vacío | Título, mensaje y botón Reintentar leídos | OK (usuario); el estado offline, repetido tras N-1: OK (usuario) |
| Modal y 404 | Abrir escáner y estado no encontrado | Foco entra al contenido; Cerrar/Volver/Ir a Inicio activables | OK (usuario) |

### M18. VoiceOver (iOS) (RNF-1)

| Caso | Pasos | Esperado | iOS |
|---|---|---|---|
| Tabs | Explorar la barra | Lee nombre, "seleccionado" y "Carrito, N artículos" | OK (usuario) |
| Cabecera | Buscador y escáner | Nombre y pista localizados | OK (usuario) |
| Carrusel | Ajustable: deslizar arriba/abajo | "Banner n de N"; cambia de banner; "Abrir categoría" en acciones | OK (usuario) |
| Tarjetas y categorías | Enfocar | Nombre, precio y calificación | OK (usuario) |
| Estados, modal y 404 | Recorrer | Texto y botones leídos; el modal se cierra con la acción de escape | OK (usuario); el estado offline, repetido tras N-1: OK (usuario) |

Nota: en simulador, VoiceOver completo puede no estar disponible; el Accessibility Inspector de Xcode inspecciona etiquetas, roles y valores. iPhone físico: limitación documentada (sin override de red).

### Resultados automáticos (T9, parte 2) y A cargo del usuario (cerrada)

Alcance: sin toques ni gestos; solo enlaces (`am start`, `simctl openurl`), ajustes del sistema, capturas, `uiautomator dump`, `dumpsys` y logcat. Evidencia guardada fuera del repositorio. Todos los ajustes se restauraron (ver "Restauración").

**Hallazgos nuevos (N-1, N-2 y N-3 ya corregidos/acotados; el resto, como se indica):**
- **N-1. CORREGIDO (decisión del usuario: opción (a)): sin conexión se mostraba como error de servidor (Android, M4 y M7).** Causa raíz: SDK 57 instala `expo/fetch` como `fetch` global y sus fallos de red son `FetchError extends Error` (`node_modules/expo/src/winter/fetch/FetchErrors.ts`; el `fetch` real relanza con `FetchError.createFromError`), no `TypeError`; `fetchJson` solo clasificaba `network` con `error instanceof TypeError`, así que caía en `invalid` ("No se pudo cargar…"). Los tests pasaban porque el doble de prueba lanzaba `TypeError`, que el `fetch` real nunca lanza. Arreglo (`src/core/network/http.ts`): el `try` de `fetch` se separa del de `response.json()`; todo rechazo de `fetch` sin respuesta es `network`, salvo que lo provoque nuestro `AbortController` (timeout 8 s → `timeout`; cancelación del llamador → `aborted`, que tienen prioridad); un fallo al leer el cuerpo de una respuesta 2xx sigue siendo `invalid`, y los no 2xx `http`. Offline = "fallo de `fetch` sin respuesta", se clasifica por estructura, no por `instanceof`. Consumidores (`home-client`, `product-client`, `classifyHomeResult`) solo miran `kind === 'network'`: sin cambios de lógica, solo comentarios. Tests nuevos (4): `FetchError extends Error` → `network` (falla antes: devolvía `invalid`), cualquier otro rechazo no abortado → `network` (falla antes), `Error` tras nuestro abort → `timeout`/`aborted` (no `network`), fallo leyendo el cuerpo → `invalid`. Evidencia en el Android físico (sin toques): con `adb reverse --remove tcp:3001`, Home muestra "Sin conexión con el servidor" + "Reintentar" y el log `[home] request 1 settled: network`; el producto abierto por enlace (`herbstore:///product/…`) muestra lo mismo; restaurado el `reverse`, Home carga (`settled: ok`). **Lección:** probar con el `fetch` real del SDK (o con un doble que reproduzca su tipo de error), no solo con un mock que lanza `TypeError`. Con dedos (Reintentar, arrastrar con datos previos) y en iOS (M7): repetido por el usuario, correcto.
- **N-2. ACOTADO (H-2 confirmado y decidido): barra de tabs en Android con texto grande.** La barra tiene altura fija (≈91 px, 48,5 dp). `tabBarAllowFontScaling` del navegador es solo booleano (en iOS 13+ ya es `false` por defecto: usa el "large content viewer"), así que para fijar un tope se usa un `tabBarLabel` propio (`src/features/navigation/components/TabBarLabel.tsx`) con `Text.maxFontSizeMultiplier = fontScaleLimits.tabLabel`. Tope elegido: **1.2** (12 pt), token en `src/design-system/tokens.ts`; con 1.3 se probó a `font_scale` 2.0 y todavía cortaba el descendente de "Categorías", con 1.2 la etiqueta sale completa. En iOS se conserva el comportamiento del navegador (`allowFontScaling` desactivado). Los iconos de `SymbolView` siguen cortados a 1.5/2.0 (H-1 aceptado, no se tocan). Verificado en Android a 1.5 y 2.0; repetido por el usuario (M15), correcto. Alternativa descartada: `tabBarAllowFontScaling: false` (sin escalado, peor accesibilidad).
- **N-3. ACOTADO: iOS AX5 partía "suplemen-tos" y estiraba el escáner.** `HomeHeader` pasa `maxFontSizeMultiplier = fontScaleLimits.searchField` al texto del buscador. Tope elegido: **1.5** (24 pt, el mismo que la insignia de la tarjeta); en AX5 el texto cabe en una línea y el botón del escáner conserva su forma. En Android a 1.5 y 2.0 el buscador queda en una línea. Solo se acotan esos dos sitios; el resto de la app sigue escalando. Repetido por el usuario en iOS (M15 AX5), correcto.
- **Comparación nativa (N-1, N-2, N-3).** Red: en Kotlin un fallo sin respuesta es `IOException` (`UnknownHostException`, `ConnectException`) y un 5xx es una respuesta; en Swift, `URLError` (`.notConnectedToInternet`, `.cannotConnectToHost`) frente a un `HTTPURLResponse` con estado. En ambos se distingue "no hubo respuesta" de "hubo respuesta mala", que es lo que ahora hace `fetchJson`; clasificar por `instanceof TypeError` equivaldría a capturar solo una subclase concreta de `IOException`. Texto: Android escala `sp` con `fontScale` (en Compose, `LocalDensity` con `fontScale` acotado o `Text` con `maxLines`); iOS usa Dynamic Type y SwiftUI limita con `.dynamicTypeSize(...DynamicTypeSize.xxxLarge)`; en RN el equivalente es `maxFontSizeMultiplier`. Errores típicos: probar solo con dobles que no reproducen el error real, clasificar por tipo en vez de por estructura del fallo, y no acotar el texto en componentes de altura fija (la barra de tabs).
- **N-4. iOS: cambiar el tamaño de texto con la app abierta deja el layout desactualizado** (textos de banner y categorías cortados, banner desplazado a medias). Un arranque limpio con el mismo tamaño se ve bien. Observado con `simctl ui content_size`; falta confirmarlo cambiando Ajustes → Pantalla y brillo → Tamaño del texto en el simulador y volviendo a la app (si se reproduce, es un fallo real de re-medición tras el cambio de categoría). Sigue aceptado como estaba: no forma parte de las celdas repetidas.
- **N-5 (informativa). Android recrea la actividad al cambiar `font_scale`** (log `Running "main"` otra vez): `MainActivity` no declara `fontScale` en `configChanges`, así que se reinicia el JS en el dev client y Home vuelve a cargar. El tema sí es en caliente (`uiMode`). Por eso los casos de texto se capturan tras ~14 s.
- **N-6 (informativa). `[home] refetch on foreground` también aparece al navegar a la raíz con `am start`** (sin pasar a segundo plano); lo más probable es que `am start` pause/reanude la actividad y `AppState` pase por `background`. El caso "Foco sin fallo" (M8) debe comprobarse con toques reales.
- **N-7 (informativa).** El Android físico está en modo avión (icono en la barra de estado); no se tocó. `adb reverse` no se ve afectado.
- **H-7 (rótulos de categorías): confirmado en Android 2.0.** Los botones miden lo que su rótulo y la separación es constante (15 px = 8 dp), así que "Vitaminas Minerales Prote…" quedan casi pegados. En iOS a tamaño normal el hueco es de ≈9 pt. Pendiente: aumentar el espacio entre ítems.

**Evidencia positiva destacable:** `uiautomator dump` confirma `content-desc` de tabs (selección en `selected`), banner como `SeekBar` con "Banner n de N" y botones del carrusel con nombre; buscador/escáner/flechas miden 48 dp; los tabs miden 96×48,5 dp según `dumpsys activity top` (el dump de uiautomator los recorta a 24,5 dp por la barra del sistema, no es el tamaño real). Enlaces: `herbstore:///` abre Home, `herbstore://scanner` abre el modal, `herbstore://foundations` abre Fundamentos (útil para pruebas).

**A cargo del usuario (todo lo que necesita dedos, lector de pantalla o `.env.local`) — CERRADA: el usuario declaró que ejecutó la lista y que los resultados fueron correctos, sin detalle por punto:**
1. **Toques y pila (Android e iOS):** M1 (badge 5/99+, estado y pila por tab, reselección x5, cambio durante scroll, Cuenta → Fundamentos), M2 (Atrás: producto, búsqueda, categoría, raíz), M3 (abrir con el icono, cerrar con botón/Atrás/gesto, doble toque), M4 (Volver / Ir a Inicio), M5 (tras A→B pulsar Atrás en Android: debe volver a Inicio), M9 (deslizar, flechas, destino del banner), M10 (pausa por toque/arrastre, cambio de tab, desplazar el carrusel fuera de pantalla), M12 (destinos y scroll horizontal), M16 (paginación manual, imágenes sin fundido).
2. **Multitoque y doble toque (M6):** solo Android (dos dedos); doble toque rápido también en iOS.
3. **Offline (M4 servidor detenido, M7, M8 foco tras fallo, M17/M18 estado offline) — repetido tras N-1 en Android e iOS, correcto:** parar el mock (iOS: `Ctrl+C` en su terminal; Android: parar el mock o `adb reverse --remove tcp:3001`, y restaurar después) y comprobar offline en la primera carga, el aviso con datos previos tras arrastrar para refrescar y su recuperación.
   Texto ampliado de tabs y buscador (M15 1.5/2.0 en Android y AX5 en iOS) — repetido tras N-2/N-3, correcto.
4. **Fixtures (M7 loading/server-fail/empty, M9 0 y 1 banner, M11 imagen rota):** crear `.env.local` con `EXPO_PUBLIC_HOME_FIXTURE=<nombre>` y reiniciar Metro con `npx expo start --dev-client -c`; borrar el archivo al terminar. Para `loading`, mock con `MOCK_LATENCY_MS=3000`.
5. **Reduced motion en iOS (M10, M16):** Ajustes → Accesibilidad → Movimiento → Reducir movimiento; comprobar "Movimiento reducido: activado" y que el autoplay no avanza.
6. **Idioma (M13):** cambiar a inglés (selector de Fundamentos) y revisar textos y precios `en-US`.
7. **Lectores de pantalla (M17 TalkBack, M18 VoiceOver / Accessibility Inspector) y M11 etiqueta de la imagen rota.**
8. **iOS sin árbol de accesibilidad por consola:** targets ≥44 pt (M15), secciones Nuevos/Ofertas y monedas (M12, M13) requieren scroll; AX1 en iOS y texto ampliado con el Foundations.
9. **N-4:** reproducir el cambio de tamaño de texto con la app abierta (Ajustes del simulador).
10. **Foco sin fallo y foco tras fallo (M8)** y primer plano en iOS (logs JS de iOS no salen por `simctl`; usar la consola de Metro).

**Qué es `OK (usuario)` (registro de cierre de T9, 2026-10-10):** todas las celdas de la lista "A cargo del usuario" son `OK (usuario)` solo por declaración del usuario, sin detalle por caso: primero la declaración general ("ya realicé las pruebas y funcionó de manera correcta") y después, para las celdas que dependían de los arreglos (M4 servidor detenido, M7 offline en primera carga / aviso con datos previos / recuperación del aviso, M8 foco tras fallo, estados offline de M17/M18 y M15 de texto ampliado en Android 1.5/2.0 e iOS AX5), la declaración "repetí los casos tras el arreglo y todos salieron bien". No se afirma nada más específico (no se conocen tiempos, textos ni capturas de esas pruebas). Siguen como limitaciones aceptadas, sin cambio: arranque en frío con enlace (launcher del dev client; se cierra en el Día 5), iconos `SymbolView` recortados con fuente grande (H-1, revisión en el Día 6), N-4 a N-7 y H-7 (rótulos de categorías cercanos con fuente máxima), iPhone físico sin override de red.

**Restauración (2026-10-10, repetida tras las correcciones):** además, tras las pruebas de N-1/N-2/N-3: `font_scale` 1.0, iOS `content_size large`, `adb reverse` de 8081 y 3001 activos y la app en Inicio.

**Restauración (2026-10-10):** `font_scale` 1.0, `transition_animation_scale` 1, `cmd uimode night` = no, `wm size` sin override, `adb reverse` de 8081 y 3001 activos; iOS `appearance light` y `content_size large`; la app abierta en Inicio en ambos dispositivos. Modo avión de Android sin tocar.

### Regresión automática (preparación de T9, 2026-10-10)

| Comprobación | Comando | Resultado |
|---|---|---|
| ESLint | `npx expo lint` | sin errores |
| TypeScript strict | `npx tsc --noEmit` | sin errores |
| Lógica pura | `npm run test:logic` | 291 de 291 pasan |
| Mock | `npm --prefix mock-server test` | 73 de 73 pasan |
| Compatibilidad | `npx expo install --check` | dependencias al día |
| Diagnóstico | `npx expo-doctor@latest` | 21/21 comprobaciones superadas |
| Bundle de producción | `npx expo export` (Android, sin bytecode) con `EXPO_PUBLIC_HOME_FIXTURE=server-fail` forzada | La puerta `isDev` queda en `false` (`resolveHomeFixture({isDev:!1,...})`); el control del badge no se renderiza; sin logs `[home]`, `[deep-link]`, `[image]` ni `[BannerAutoplay]` en el bundle |

### Regresión de cierre (T10, 2026-10-10)

Antes de pedir la revisión de @reviewer y la aprobación del commit, sin cambios de código desde T9 salvo los arreglos N-1/N-2/N-3:

| Comprobación | Comando | Resultado |
|---|---|---|
| ESLint | `npx expo lint` | sin errores |
| TypeScript strict | `npx tsc --noEmit` | sin errores |
| Lógica pura | `npm run test:logic` | 295 de 295 pasan |
| Mock | `npm --prefix mock-server test` | 73 de 73 pasan |
| Compatibilidad | `npx expo install --check` | dependencias al día |
| Diagnóstico | `npx expo-doctor@latest` | 21/21 comprobaciones superadas |

### Hallazgos conocidos pendientes de decisión

1. **Iconos de `SymbolView` recortados en Android con `font_scale` alto** (tabs, cabecera, chevrons). Limitación previa de `expo-symbols` en Android (el icono se carga como fuente); la causa exacta del recorte no está investigada. Opciones: aceptar y documentar; fijar el tamaño del contenedor del icono; sustituir por iconos vectoriales (dependencia nueva, requiere aprobación).
2. **Campo de búsqueda y barra de tabs apretados con fuente a 2.0.** La etiqueta del tab y el texto del campo pierden aire; con AX5 el texto puede truncarse. Opciones: aceptar (es el extremo del rango); `numberOfLines`/`maxFontSizeMultiplier` acotado en la barra y el campo; barra con altura flexible. **RESUELTO (N-2/N-3):** se acotó con `fontScaleLimits` (tabs 1.2, buscador 1.5) y el usuario repitió M15 en Android e iOS con resultado correcto.
3. **El esqueleto de Home no reserva el texto ni los controles del banner**, así que al terminar la carga el contenido baja unos puntos. Opciones: aceptar como esqueleto estático (decisión previa); añadir líneas de texto y fila de controles al esqueleto.
4. **El control `__DEV__` del badge y las fixtures siguen presentes como código muerto en el bundle de producción.** Hay que distinguir: el control no se renderiza (el árbol lo sustituye por `null`) y las fixtures quedan anuladas por `isDev:false`, pero el componente `CartDevControls`, los textos `cartDev.*` (es/en) y los nombres de fixtures viajan en el bundle. Opciones: aceptar y retirarlo en el Día 4 (el plan ya lo prevé); cargar el control con un `require` dentro de `if (__DEV__)` para que Metro lo elimine; mover los textos del control fuera de los recursos globales.
5. **Dependencias heredadas del template que el código no importa:** `@expo/ui`, `expo-glass-effect`, `expo-web-browser`, `react-native-web`, `react-dom` (las demás son peer de Expo Router o de los días siguientes). Quitarlas cambia dependencias nativas y exige recompilar; no se toca sin aprobación.
6. **Barra de tabs y botón flotante del dev client.** El tamaño táctil de cada tab lo fija React Navigation (no hay código propio que lo garantice); comprobar en M15. El engranaje flotante que aparece sobre la cabecera es el menú del dev client: solo desarrollo, no es parte de la app.
7. **Posible separación escasa entre rótulos de categoría en iOS** a tamaño normal (en la captura de humo "Vitaminas Minerales Proteínas" quedan casi juntos). Verificar en M12/M15; si se confirma, aumentar el espacio entre ítems.
8. **Arranque en frío con enlace:** no observable con el launcher del dev client; decisión vigente: se cierra en el Día 5.
9. **`.env.local` ausente ahora mismo:** las fixtures de M7, M9 y M11 requieren crearlo (`EXPO_PUBLIC_HOME_FIXTURE=<nombre>`) y reiniciar Metro con `-c`. Lo crea el usuario.

**Decisiones del usuario sobre H-1 a H-9 (2026-10-10, "acepto las recomendadas"):**
- **H-1** (iconos de `SymbolView` recortados en Android): aceptado y documentado; se revisa en el Día 6. La matriz lo confirma con `font_scale` 1.5 y 2.0 (N-2).
- **H-2** (buscador y tabs apretados): se acota `maxFontSizeMultiplier` **solo si la matriz muestra truncado real**; si lo muestra, no se corrige y se reporta. Resultado: truncado real en Android (tabs a 2.0, "Categorí…") y partición de palabra en iOS AX5 (N-2, N-3): **acotado** tras la decisión del usuario (tabs 1.2, buscador 1.5; `fontScaleLimits`); repetido por el usuario (M15), correcto.
- **H-3** (esqueleto de Home): aceptado. **H-4** (código muerto del control `__DEV__`): se retira en el Día 4. **H-5** (dependencias heredadas): en la auditoría final. **H-6** (tamaño de tabs): comprobado en M15, 96×48,5 dp (cumple). **H-7** (rótulos de categorías): se verifica en M12/M15, confirmado en Android 2.0 (ver arriba). **H-8** (arranque en frío): cerrado para el Día 5; confirmado de nuevo en ambas plataformas (el launcher del dev client intercepta el enlace). **H-9** (`.env.local`): lo crea el usuario.

**React Compiler: activo, decisión del usuario** (`experiments.reactCompiler: true` intacto en `app.json`).
- Qué implica: el compilador memoiza componentes y hooks automáticamente (compila los 58 archivos, 64 funciones, sin omisiones ni errores), por lo que **enmascara renders innecesarios**. Es el equivalente a que Compose omitiera recomposiciones por estabilidad de parámetros (*skipping*) sin que lo pidas, o a que SwiftUI comparara las dependencias de `body`.
- Para la demo didáctica: poner `"use no memo"` en el componente de ejemplo y medir con el Profiler antes y después; no memoizar a mano sin medir (regla del proyecto).
- Opción elegida: dejarlo activo. Trade-off: se obtiene la optimización automática y se mantiene la configuración heredada del template (opt-in experimental, no un valor por defecto de SDK 57), pero los renders redundantes son menos visibles para enseñar. Descartada: desactivarlo con `experiments.reactCompiler: false` (más renders visibles para enseñar, pero se pierde la optimización y se aleja del template).
