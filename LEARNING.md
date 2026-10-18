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

Estado: **completado y validado en Android e iOS** (matriz de verificación aprobada por el usuario, revisión de @reviewer aprobada y cierre del día aprobado).

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
- **Ideas pendientes para la auditoría del Día 6** (opcionales, no aplicadas por decisión del usuario): (a) timeout/abort también durante la lectura del cuerpo en `fetchJson`; (b) posible doble disparo de `router.back()` con un doble toque rápido; (c) declarar `engines` de Node ≥ 22.18 en `package.json` para `test:logic`; y un test extra para `src/core/network/http.ts` (línea ~80).

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
4. **El control `__DEV__` del badge y las fixtures siguen presentes como código muerto en el bundle de producción.** Hay que distinguir: el control no se renderiza (el árbol lo sustituye por `null`) y las fixtures quedan anuladas por `isDev:false`, pero el componente `CartDevControls`, los textos `cartDev.*` (es/en) y los nombres de fixtures viajan en el bundle. Decisión del usuario: aceptarlo ahora y retirarlo en el Día 4 (el plan ya lo prevé).
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

---

## Día 3 — Datos remotos, listas y rendimiento

Estado: **T1–T16 hechas y validadas** (spec `specs/003-dia-3-datos-listas-rendimiento`); T15 y T16 aprobadas explícitamente por el usuario; cierre del día pendiente solo del commit (tras la re-validación de @reviewer). Cada bloque se lee en 10 minutos o menos (RF-1); código e identificadores en inglés, explicación en español.

### Bloque T1 — Estado de servidor, RTK Query y módulos nativos de Expo (≈10 min)

**Estado de servidor frente a estado de cliente.** El catálogo, Home y las órdenes viven en el servidor: la app solo tiene una copia prestada que puede quedarse vieja, que puede fallar al pedirse y que otro usuario puede cambiar. Tiene sus propias preguntas: ¿está fresca?, ¿se está pidiendo ya?, ¿hay que reintentar?, ¿qué invalida qué? El estado de cliente (carrito, historial de búsqueda, filtros elegidos) es del usuario, es síncrono y la app es su única dueña. Mezclar los dos en un mismo `slice` obliga a reescribir a mano la caché, la deduplicación y los reintentos. Por eso en HerbStore RTK Query es la única fuente del estado remoto y Redux guarda solo estado de cliente.

| Idea | React Native (HerbStore) | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Capa de datos remota con caché | RTK Query (`createApi`, endpoints, tags) | `Repository` + fuente remota/local + caché, expuesto como `Flow`/`StateFlow` | `async/await` + un modelo `@Observable` (o Combine) que guarda el resultado |
| Estado que consume la UI | hooks `useGetXQuery` (`data`, `isFetching`, `error`) | `collectAsStateWithLifecycle()` sobre el `StateFlow` del `ViewModel` | propiedades del `@Observable` leídas en `body` |
| Invalidar caché | `invalidatesTags` / `providesTags` | borrar o refrescar la caché del repositorio, emitir de nuevo en el `Flow` | volver a lanzar la tarea y publicar el nuevo valor |
| Reintento con espera | `retry` de RTK sobre el base query | interceptor de OkHttp/Retrofit | reintento propio sobre `URLSession` |
| Estado de cliente | slice de Redux (`configureStore`) | `ViewModel` con `StateFlow` / `SavedStateHandle` | `@State` / `@Observable` / `AppStorage` |

Idea para entrevista: RTK Query es "un repositorio con caché, deduplicación y reintentos ya escrito", con la diferencia de que la identidad de cada consulta es el nombre del endpoint más sus argumentos serializados. Dos componentes que piden lo mismo comparten una sola petición, igual que dos colectores del mismo `StateFlow` compartido.

**Qué es un módulo nativo de Expo y por qué Fast Refresh no basta.** `expo-network` no es solo JavaScript: trae código Kotlin y Swift (`NetworkModule`) que el *autolinking* de Expo compila dentro de la app. En Android registra un `ConnectivityManager.NetworkCallback` (`registerDefaultNetworkCallback`) y en iOS usa un `NWPathMonitor`; el módulo reenvía esos eventos a JS (`onNetworkStateChanged`). Fast Refresh y Metro solo reemplazan el bundle de JavaScript. Un módulo nuevo cambia el binario (Gradle/CocoaPods/Xcode), así que hay que **recompilar el Development Build** en las dos plataformas; con el binario viejo la llamada fallaría porque el módulo no existe. Es el mismo motivo por el que, en nativo, añadir una dependencia con código obliga a recompilar y no basta con "aplicar cambios".

| `expo-network` | Android | iOS |
| --- | --- | --- |
| Lectura inicial | `getNetworkStateAsync()` ↔ `ConnectivityManager.getNetworkCapabilities(activeNetwork)` | `getNetworkStateAsync()` ↔ la última `NWPath` del monitor |
| Cambios | `addNetworkStateListener` ↔ `NetworkCallback` | `addNetworkStateListener` ↔ `pathUpdateHandler` de `NWPathMonitor` |
| Permisos | `ACCESS_NETWORK_STATE`, añadidos por el propio manifiesto del módulo | ninguno |

### Decisiones de T1 (RF-3)

- **RTK Query como única fuente remota.**
  - Elegida: RTK Query para Home, listas, detalle, facets y órdenes.
  - Trade-off: hay que configurar tags e infinite queries.
  - Descartada: copiar las respuestas a slices de Redux, porque duplica la fuente de verdad y obliga a escribir a mano la frescura, la deduplicación y la invalidación.
- **Reconexión con `expo-network` (5.ª dependencia, aprobada por el usuario).**
  - Elegida: `expo-network ~57.0.2`, el módulo que mantiene Expo y fija el SDK 57.
  - Trade-off: es nativo, así que obliga a recompilar en Android e iOS; además mide la red del dispositivo, no si el servidor mock responde (con `adb reverse` pueden diferir).
  - Descartadas: `@react-native-community/netinfo` (también nativo y fijado por el SDK, pero del repositorio de la comunidad y sin nada que RF-5 necesite de más) y la heurística sin dependencia ("la primera respuesta correcta tras un fallo de red es la reconexión"), que no se entera de que vuelve la red hasta que se hace una petición y confunde la caída del servidor con la del dispositivo.
- **Constitución, punto 1 (stack mínimo).** Toda dependencia fuera del stack exige necesidad demostrable, compatibilidad con Expo y aprobación previa. Las 5 de hoy están en el plan aprobado; `expo-network` la aprobó el usuario al resolver P1 y es la 5.ª.

### Registro de T1: versiones, código nativo y API real (comprobado el 2026-10-11)

Instalación con `npx expo install @reduxjs/toolkit react-redux @shopify/flash-list @gorhom/bottom-sheet expo-network`, sin `--force`, `--legacy-peer-deps` ni `npm audit fix --force`.

| Paquete | Versión instalada | `package.json` | Código nativo propio |
| --- | --- | --- | --- |
| `@reduxjs/toolkit` | 2.13.0 (≥ 2.6, trae `build.infiniteQuery` y `refetchCachedPages`) | `^2.13.0` | No (solo `dist`, `query`, `react`, `src`) |
| `react-redux` | 9.3.0 (con `redux` 5.0.1) | `^9.3.0` | No (solo `dist`, `src`) |
| `@shopify/flash-list` | 2.0.2 | `2.0.2` | No (solo `dist`, `src`; v2 exige New Architecture) |
| `@gorhom/bottom-sheet` | 5.2.14 | `^5.2.14` | No (solo `lib`, `src`; usa Reanimated y Gesture Handler) |
| `expo-network` | 57.0.2 | `~57.0.2` | **Sí**: `android/` (Kotlin), `ios/` (Swift + `ExpoNetwork.podspec`) y `expo-module.config.json` |

- **Peers de Gorhom 5.2.14:** `react-native-gesture-handler >=2.16.1` (instalado 2.32.0) y `react-native-reanimated >=3.16.0 || >=4.0.0-` (instalado 4.5.1, con Worklets 0.10.1). Satisfechos sin forzar nada. Peers de `react-redux` (`react` ^18 || ^19, `redux` ^5) y de RTK (`react-redux` ^9) también satisfechos.
- **Búsqueda de código nativo:** solo `expo-network` trae `android/`, `ios/`, podspec y `expo-module.config.json`. Los otros cuatro son JavaScript puro, así que la recompilación se debe solo a `expo-network`.
- **`app.json`:** sin cambios. La documentación de SDK 57 dice que `expo-network` no necesita config plugin y que `ACCESS_NETWORK_STATE` y `ACCESS_WIFI_STATE` los añade el manifiesto de la librería (fusionado por Gradle). iOS no pide permisos.
- **API real de `expo-network` 57.0.2** (tipos instalados en `node_modules/expo-network/build/Network.d.ts`):
  - Escucha: `addNetworkStateListener(listener: (event: NetworkStateEvent) => void): EventSubscription`. Devuelve una suscripción con `remove()`; la página de documentación la describe como "función para cancelar", pero **manda el tipo instalado**: se cancela con `subscription.remove()`.
  - Lectura inicial: `getNetworkStateAsync(): Promise<NetworkState>`.
  - Forma del estado: `NetworkState = { type?: NetworkStateType; isConnected?: boolean; isInternetReachable?: boolean }` (todos opcionales); `NetworkStateEvent` es el mismo tipo. En iOS `isInternetReachable` es siempre igual a `isConnected`; en Android exige capacidad de internet y conexión validada.
  - Extras que HerbStore no usa: `getIpAddressAsync`, `isAirplaneModeEnabledAsync` (solo Android) y el hook `useNetworkState`.
  - Plan de uso (T3): `core/network/reconnection.ts` será el único punto de suscripción; el resto de la app nunca importa `expo-network`.

### Raíz de gestos (T1)

`src/app/_layout.tsx` envuelve toda la app en `GestureHandlerRootView` con `style={{ flex: 1 }}`. Gesture Handler necesita una vista raíz para registrar sus reconocedores; Gorhom la necesitará para las hojas de T10. Equivale a tener un único `Window`/`UIWindow` que recibe los toques y los reparte a los reconocedores (`GestureDetector` en Compose, `UIGestureRecognizer` en UIKit). Es JavaScript: no requiere recompilar por sí mismo.

### Recompilación del Development Build (T1, 2026-10-11)

- **Android** (Samsung SM-A037M, USB, `adb reverse tcp:8081` y `tcp:3001`): `npx expo run:android --device SM_A037M` con Java 21 y `ANDROID_HOME`. `BUILD SUCCESSFUL`; Gradle autolinkeó `expo-network (57.0.2)`; APK instalado y JS arrancado (`Running "main"`). Dos tropiezos de entorno, no del proyecto: `--device` pide el **nombre** del dispositivo (`SM_A037M`), no el serial de `adb`, y sin `ANDROID_HOME` Gradle falla con "SDK location not found" (no hay `local.properties`; no se editó `android/`).
- **iOS** (simulador iPhone 17 Pro, no dispositivo físico, igual que el Día 2): `npx expo run:ios --device "iPhone 17 Pro"`. CocoaPods instaló `ExpoNetwork (57.0.2)`, Xcode compiló y empaquetó `libExpoNetwork.a` y terminó con 0 errores y 1 aviso; la Home se ve igual que en el Día 2 (buscador, carrusel, categorías, tabs).
- `android/` e `ios/` siguen siendo salidas CNG ignoradas por Git y no se tocaron a mano.
- **Validado por el usuario** en Android (físico) e iOS (simulador): Home, tabs y enlaces como en el Día 2.

### Bloque T2 — Base query, reintentos con backoff e idempotencia (≈10 min)

**Base query.** RTK Query no hace peticiones por sí mismo: cada endpoint solo describe *qué* pedir (`query: () => ({ path, parse })`) y delega el *cómo* en una función única, el base query: `(args, api) => { data } | { error }`. Es el sitio donde viven el origen, las cabeceras, la cancelación y la traducción de errores. En HerbStore es un adaptador pequeño sobre `fetchJson` (`core/api/fetch-json-base-query.ts`): suma el origen al `path`, pasa `api.signal` (así un desmontaje o un refetch cancelan la petición) y convierte el resultado a `{ data }` o `{ error: ApiError }`. Los errores salen tipados: `network`, `http` (con `status`), `invalid`, `timeout` y `aborted`.

**Reintentos con backoff.** Si una lectura falla por algo pasajero, repetirla casi siempre funciona; si falla por algo permanente, repetirla solo gasta batería y tiempo. Por eso la decisión es una función pura (`shouldRetryRequest`) que se prueba sin red, y la espera crece (500 ms y 1000 ms): dar margen al servidor sin que el usuario espere de más. Con 2 reintentos, una lectura que falla hace 3 peticiones. El *intento* cuenta los fallos acumulados: tras el primer fallo vale 1.

| Resultado | ¿Reintenta una lectura (`GET`)? | Por qué |
| --- | --- | --- |
| `network` | Sí (hasta 2) | Puede volver la red en un segundo |
| `http` 5xx | Sí (hasta 2) | El servidor falló, no la petición |
| `http` 4xx | No | La petición es el problema; repetirla da la misma respuesta |
| `timeout` | No | No prueba que el servidor no la procesara y el usuario ya esperó 8 s |
| `invalid` | No | Un contrato roto no se arregla repitiendo |
| `aborted` | No | Lo cancelamos nosotros a propósito |
| Cualquier `POST` | No | Ver idempotencia |

**Idempotencia.** Una operación es idempotente si repetirla deja el mundo igual que hacerla una vez. `GET` lo es: pedir dos veces el catálogo no cambia nada. `POST /orders` no: si se pierde la respuesta, la app no sabe si la orden se creó; reenviar a ciegas puede crear dos. La solución del proyecto es la `Idempotency-Key`: el servidor reconoce la misma clave y devuelve la misma orden. Aun así, el reintento automático se descarta para las escrituras; la spec 004 consultará el estado de la clave. El segundo `POST` tras un `202 pending` no es un reintento por fallo: es el protocolo de órdenes (misma clave, mismo cuerpo), y se verá en T13.

| Idea | React Native (HerbStore) | Android (Kotlin) | iOS (Swift) |
| --- | --- | --- | --- |
| Punto único de red | base query de RTK sobre `fetchJson` | `Interceptor` de OkHttp / `Retrofit` | `URLSession` con un envoltorio propio |
| Reintento con espera | `retry` de RTK con `shouldRetryRequest` y `retryDelayMs` | interceptor que repite y duerme (o `retryWhen` en un `Flow`) | bucle `async` con `Task.sleep` o `retry` de Combine |
| Errores tipados | unión discriminada `ApiError` | `sealed interface` / `Result` | `enum` con valores asociados / `Result` |
| Cancelación | `AbortSignal` del base query | `Call.cancel()` / cancelación de la corrutina | `Task.cancel()` / `URLSessionTask.cancel()` |

Idea para entrevista: "no reintentes a ciegas": un reintento solo es seguro si la operación es idempotente y el fallo es transitorio. Clasificar el error (red, 4xx, 5xx, timeout) vale más que un número mágico de reintentos.

### Decisiones de T2 (RF-3)

- **Reintentar solo lecturas `GET`.**
  - Elegida: 2 reintentos (500 ms y 1000 ms) ante `network` y 5xx, solo en `GET`.
  - Trade-off: `createOrder` falla a la primera ante un corte de red y la recuperación llega con la consulta de estado del Día 4.
  - Descartada: reintentar todo (incluido `POST`), porque podría duplicar una orden si la respuesta se perdió; y reintentar `timeout`, que alargaría la espera a ~25 s sin garantía.
- **Base query propio sobre `fetchJson`.**
  - Elegida: reutilizar `fetchJson`, que ya clasifica `FetchError` de `expo/fetch`, el timeout y el abort propio.
  - Trade-off: mantener un adaptador pequeño y probado.
  - Descartada: `fetchBaseQuery` de RTK, que perdería la taxonomía `network/timeout/invalid` y la validación del contrato por endpoint (`parse`).
- **Logs por `onSettled` inyectado.** El base query no lee `__DEV__`; informa método, ruta sin query, resultado y status, nunca cabeceras ni cuerpo (una búsqueda o una dirección son datos del usuario). Trade-off: un parámetro más. Descartado: `console.log` dentro del módulo, que no se puede probar y ataría la lógica pura a `__DEV__`.
- **Backoff determinista.** `retryDelayMs(n) = 500 * 2^(n-1)`. Trade-off: sin *jitter*, así que muchos clientes fallando a la vez reintentarían a la vez (irrelevante en una app didáctica). Descartado: el backoff aleatorio por defecto de RTK, que no garantiza "exactamente dos" ni una espera creciente verificable.

### Bloque T3 — Caché, frescura, suscripciones, tags y conectividad (≈10 min)

**Cómo piensa la caché de RTK Query.** Cada consulta se guarda en una *entrada* cuya clave es el endpoint más sus argumentos serializados (`getProducts({ category: 'x' })`). Todo componente que usa un hook `useXQuery` es un **suscriptor** de esa entrada: dos pantallas que piden lo mismo comparten datos y una sola petición. Cuando el último suscriptor se va, la entrada no se borra de inmediato: se queda `keepUnusedDataFor` segundos (300 en HerbStore) y después se elimina. Mientras existe, reabrir la pantalla muestra la caché al instante.

**Frescura frente a retención: dos relojes distintos.**

| Ajuste | Qué mide | Valor en HerbStore | Qué pasa al vencer |
| --- | --- | --- | --- |
| `keepUnusedDataFor` | Cuánto vive una entrada **sin suscriptores** | 300 s | Se borra; la próxima apertura es una carga inicial (skeleton) |
| `refetchOnMountOrArgChange: 60` | Desde cuándo un dato se considera **viejo** al montar un suscriptor | 60 s | Se muestra la caché y se revalida en segundo plano (`isFetching` sin `isLoading`) |
| `shouldRevalidate` (`freshness.ts`) | La misma regla de 60 s para foco, primer plano y reconexión | 60 s | Una sola revalidación; con datos frescos, ninguna petición |

Si solo usáramos el valor por defecto de `keepUnusedDataFor` (60 s), la caché se borraría justo cuando RF-5 pide mostrarla mientras se revalida. Por eso 300 s: la retención debe ser mayor que la ventana de frescura.

**Tags: invalidar sin saber quién depende de qué.** Una consulta declara qué datos *provee* (`providesTags: ['Home']`) y una mutación qué *invalida* (`invalidatesTags: ['Home']`). Al confirmarse una orden, RTK busca las entradas con esos tags: las suscritas se vuelven a pedir ya; las inactivas se borran y se piden de nuevo al abrirse. La mutación no conoce las pantallas, solo etiquetas. En HerbStore `tagTypes` es `Home`, `ProductList` y `Product` (este último con `id`).

| Idea | React Native (HerbStore) | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Caché con TTL | entrada RTK con `keepUnusedDataFor` + sello `fulfilledTimeStamp` | caché de repositorio con marca de tiempo y TTL (Room + `lastFetched`, o `Cache` de OkHttp) | `NSCache` en memoria; `URLCache` con `Cache-Control`/`max-age` en disco |
| Suscriptores | hooks `useXQuery` (cuenta de referencias) | colectores de un `StateFlow` con `WhileSubscribed(5_000)` | observadores de un `@Observable` compartido |
| Dato viejo mientras revalida | `isFetching` verdadero con `data` presente | `stateIn` con valor previo + `refresh()` | `.task` que actualiza sin vaciar el modelo |
| Invalidación | `invalidatesTags` | borrar la clave del repositorio y reemitir | `URLCache.removeCachedResponse` / recargar el modelo |
| Revalidar al volver al foco | `useRevalidateWhenStale` (foco + `AppState`) | `repeatOnLifecycle(STARTED)` que llama a `refresh()` | `.task`/`onChange(of: scenePhase)` |

**Eventos de conectividad y por qué un solo listener nativo.** `expo-network` expone al JavaScript lo que cada sistema ya emite: en Android un `ConnectivityManager.NetworkCallback` (`onAvailable`, `onLost`, `onCapabilitiesChanged`) y en iOS un `NWPathMonitor` con `pathUpdateHandler`. Cada `addNetworkStateListener` registra un callback nativo y cada evento cruza el puente a JS. Si cada pantalla suscribiera el suyo, el mismo cambio de red se repetiría N veces. `core/network/reconnection.ts` es el único archivo que importa `expo-network`: crea **una** suscripción cuando llega el primer oyente, la retira con `subscription.remove()` cuando se va el último y guarda el estado previo (sembrado con `getNetworkStateAsync`) para detectar el paso **offline → online**. Es el patrón `callbackFlow { registerNetworkCallback … awaitClose { unregister } }` compartido con `shareIn(WhileSubscribed)` en Android, o un `NWPathMonitor` envuelto en un publisher con `.share()` en iOS.

La regla de decisión está separada del evento y es pura (`connectivity.ts`): `isOnline` (conectado y `isInternetReachable` no `false`; `null`/ausente = desconocido, cuenta como alcanzable) e `isReconnection(previous, next)` (el estado previo era *explícitamente* offline y el nuevo es online; sin estado previo, o con uno desconocido, nunca). Así se prueba sin dispositivo.

**Pieza por pieza (qué hace cada archivo).**
- `base-api.ts`: la única `createApi`. Envuelve el base query de T2 en `retry` y fija la política de caché. Las features añaden endpoints con `injectEndpoints`.
- `store.ts` y `hooks.ts`: un único `configureStore` con el reducer y el middleware de la API; hooks tipados (`useAppDispatch`, `useAppSelector`). No hay `setupListeners` porque solo sirve a `refetchOnFocus`/`refetchOnReconnect`, que están apagados. Nada se persiste hasta el Día 4.
- `useRevalidateWhenStale`: foco + primer plano + reconexión con la regla de 60 s; no actúa al montar (lo cubre `refetchOnMountOrArgChange`), ni con la pantalla oculta, ni sin datos.
- `usePullToRefresh`: llama a `refetch()` sin consultar la frescura (RF-6) y mantiene su propio `isRefreshing`, así la revalidación silenciosa nunca enciende el spinner.

**Errores típicos al venir de nativo.** (1) Esperar que `refetchOnFocus` funcione como `onResume`: en RN depende de eventos web y no respeta los 60 s. (2) Suscribirse a la red en cada pantalla y olvidar el `remove()`: fuga de callbacks nativos. (3) Confundir "sin red del dispositivo" con "el servidor no responde": con `adb reverse` el mock se alcanza sin red, por eso la UI offline sale del fallo de `fetch` y no de `expo-network`. (4) Pasar `maxRetries` y `retryCondition` a `retry`: los tipos de RTK lo prohíben y la condición reemplaza al límite, que por eso vive en `shouldRetryRequest`.

### Decisiones de T3 (RF-3)

- **Frescura con un hook propio.**
  - Elegida: `refetchOnMountOrArgChange: 60` + `useRevalidateWhenStale` (foco, primer plano y reconexión con la misma regla).
  - Trade-off: un hook más que mantener.
  - Descartada: `refetchOnFocus`/`refetchOnReconnect` con `setupListeners`, porque ignoran los 60 s (refrescarían en cada foco) y dependen de eventos web que no existen en React Native.
- **Un solo listener nativo.**
  - Elegida: `reconnection.ts` con suscripción perezosa compartida por todos los oyentes.
  - Trade-off: estado de módulo (un singleton) que hay que limpiar bien al quedar sin oyentes.
  - Descartada: `useNetworkState` de `expo-network` o un `addNetworkStateListener` por pantalla, que repiten el callback nativo y los eventos por cada pantalla montada.
- **Estado offline desde `fetch`, no desde `expo-network`.**
  - Elegida: la UI sigue mostrando offline cuando `fetch` falla sin respuesta; `expo-network` solo dispara la revalidación. El aviso se retira únicamente tras una respuesta satisfactoria.
  - Trade-off: el aviso no desaparece "por sí solo" al volver la red hasta que llega una respuesta.
  - Descartada: derivar el estado de pantalla de `isConnected`, que con `adb reverse` o un servidor caído diría lo contrario de lo que ve el usuario.
- **Reconexión solo con la pantalla visible.**
  - Elegida: el oyente se registra solo mientras la pantalla tiene foco y la app está activa; al recuperar el foco, la regla de 60 s se aplica igual.
  - Trade-off: una pantalla oculta no se actualiza hasta volver a verse.
  - Descartada: que cada pantalla montada (tabs ocultos) revalide al reconectar, que dispararía peticiones que nadie ve.
- **`ProductList` como nombre del tag de listas.** El plan aprobado usa `ProductList`; es el nombre que usarán `getProducts` (T7) y la invalidación de órdenes (T13).

### Bloque T4 — Migrar la capa de datos sin tocar la UI y deduplicar peticiones (≈10 min)

**Cambiar la fuente sin que la pantalla se entere.** En el Día 2 `useHome` mantenía su propio reductor (identidad de petición, un request a la vez, abort, aviso conservado). En el Día 3 esa maquinaria la hace RTK Query, y `useHome` queda como un adaptador fino con **la misma firma** (`{ state, isRefreshing, refetch }`). `HomeScreen.tsx` no cambia ni una línea: es el patrón "un ViewModel que cambia de fuente". Lo que se borra es código que RTK ya sabe hacer (`home-client`, `home-request-state`, `refetch-policy`); lo que se conserva son las **reglas de producto** del Día 2 (offline solo con `network`, aviso sobre datos previos, colecciones vacías), que ahora leen un resumen del hook: `{ data, error, isFetching }`.

| Idea | React Native (HerbStore) | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Quién habla con la UI | `useHome()` devuelve el mismo `HomeViewModel` | `HomeViewModel` expone el mismo `StateFlow<HomeUiState>` | el `@Observable` expone las mismas propiedades |
| Cambio de fuente | del reductor propio a `useGetHomeQuery` | el `ViewModel` pasa de un caso de uso a un `Repository` y `repository.home().stateIn(...)` | `load()` pasa de `URLSession` a un cliente compartido; la `View` lee lo mismo |
| Reglas de producto | `classifyHomeResult` (pura, con test) | un `map` puro del `Flow` a `UiState` | una función pura de estado remoto a estado de vista |
| Pantalla | `HomeScreen` intacta | `@Composable HomeScreen(state)` intacto | `View` intacta |

**Deduplicación de peticiones en vuelo.** Una consulta es una *entrada* (`getHome(undefined)`). Si un disparador pide la entrada mientras otra petición de **esa misma entrada** está en curso (pull + volver a primer plano, dos pantallas, foco + reconexión), RTK no lanza una segunda: la segunda llamada espera a la primera y comparte su resultado. Es el equivalente de que dos colectores de un `StateFlow` compartido (`shareIn`/`stateIn`) usen **un** productor, o de reutilizar la misma `Task` de `async/await` guardada en un diccionario por clave. Por eso el aviso de "una sola petición" se prueba contando líneas `[api] GET /home` en Metro.

**Cómo se enchufan las piezas de T3 (primera vez).**
- Abrir Home: `refetchOnMountOrArgChange: 60` (en `baseApi`). Sin datos, carga inicial; con datos de ≥ 60 s, caché + revalidación; con menos, nada.
- `useRevalidateWhenStale({ fulfilledTimeStamp, isFetching, refetch })`: foco, primer plano y reconexión con la regla de 60 s, sin spinner. Sustituye la política del Día 2 (primer plano siempre, foco solo tras fallo).
- `usePullToRefresh(refetch)`: fuerza la petición (RF-6) y controla el spinner. `isRefreshing` solo se muestra sobre datos visibles (`&& state.status === 'ready'`): en la primera carga o al reintentar desde la pantalla de error se ve el skeleton, como en el Día 2.
- `getHome` usa `providesTags: ['Home']` para que T13 pueda invalidarlo al confirmar una orden.

**Tipado por endpoint.** El base query es único para toda la API y devuelve `unknown` (su `parse` valida cada contrato). Cada endpoint declara su resultado con `build.query<HomeData, void>` y un `transformResponse: (response) => response as HomeData`. El cast está **acotado a un punto por endpoint** y es honesto porque `buildHomeRequest(...).parse` ya devuelve exactamente `HomeData | undefined`. El `error` del hook llega tipado como `ApiError | SerializedError`; `toApiError(error)` lo estrecha a `ApiError` (cualquier forma ajena, como un `CUSTOM_ERROR` de `retry`, pasa a `invalid` para que se vea el error con reintento y no un skeleton eterno).

**Comprobado (d): ¿persiste `error` durante `pending`?** Sí. Leído en RTK 2.13 (`buildSlice`: el caso `pending` solo cambia `status`, `requestId` y `startedTimeStamp`; únicamente `fulfilled` borra el error; el hook lo documenta: "the cache entry keeps `error` set through a pending refetch") y confirmado con un `configureStore` real y un `fetch` simulado:

| Momento | `status` | `data` | `error` |
| --- | --- | --- | --- |
| Éxito inicial | fulfilled | sí | — |
| Refetch que falla tras 3 intentos | rejected | **se conserva** | `http` |
| Reintento en curso (con datos) | pending | sí | **`http` (persiste)** |
| Primera carga que falla | rejected | no | `network` |
| Reintento en curso (sin datos) | pending | no | **`network` (persiste)** |
| Éxito del reintento | fulfilled | nuevo | — (se borra) |

Dos refetch forzados a la vez sobre la misma entrada hicieron 3 intentos en total (no 6): la deduplicación funciona también con los reintentos dentro. **Solución elegida:** no guardar nada propio; las reglas leen `{ data, error, isFetching }`. Con datos, el aviso del fallo anterior se mantiene durante el reintento y se retira solo con un éxito (el caso límite de la spec); sin datos, `isFetching` manda y el reintento muestra el skeleton, no la pantalla de error otra vez. Descartada: un `lastError` propio en `useRef`/estado, que duplicaría lo que RTK ya conserva y añadiría un efecto.

**Errores típicos al venir de nativo.** (1) Dejar el reductor del Día 2 "por si acaso" junto a RTK: dos fuentes de verdad que discrepan. (2) Asumir que `isFetching` implica spinner: en RTK `isFetching` es cierto también en la revalidación silenciosa; el spinner del pull es estado local. (3) Mirar solo `error` para decidir "hay fallo": con RTK el error persiste durante el reintento, hay que cruzarlo con `isFetching` y `data`. (4) Esperar que `refetch()` lance una petición nueva siempre: si ya hay una en vuelo se une a ella.

**Logs `__DEV__` para contar (sin datos de usuario).** El Día 2 imprimía `[home] request N settled`; esa cuenta la sustituye la de `base-api` por **intento**: `[api] GET /home -> ok`, `-> http 503`, `-> network`, `-> timeout`. Se añaden `[home] manual refetch (pull or retry button)`, `[home] background revalidation: data is 60 s old or more` y, desde `reconnection.ts`, `[net] offline -> online (N listener)`. Así se distingue "no pasó nada" de "el evento no llegó": una revalidación por reconexión muestra `[net]`, luego `[home] background revalidation` y luego `[api] GET /home -> ok`. (El log imprime el estado solo cuando hay uno: un éxito sale como `ok`, sin `200`; los fallos HTTP sí lo llevan, p. ej. `http 503`.)

### Decisiones de T4 (RF-3)

- **`useHome` conserva su firma; `HomeScreen` no cambia.**
  - Elegida: adaptador sobre `useGetHomeQuery` + `classifyHomeResult`.
  - Trade-off: la pantalla sigue dependiendo de un `HomeScreenState` propio y hay que mantener ese traductor (con sus tests).
  - Descartada: que `HomeScreen` consuma `useGetHomeQuery` directamente, que mezclaría las reglas de producto (offline/error/vacío) con el JSX y obligaría a tocar la UI que debe quedar igual.
- **RTK Query como único dueño de la petición.**
  - Elegida: borrar reductor, `requestId`, abort manual y política de refetch del Día 2.
  - Trade-off: se depende de comportamientos de RTK (deduplicación, `error` persistente) que hay que conocer y comprobar.
  - Descartada: conservar el reductor dentro del hook, que duplicaría caché, deduplicación y descarte de respuestas tardías.
- **Tipado: `transformResponse` con cast acotado por endpoint.**
  - Elegida: `build.query<HomeData, void>` + `response as HomeData`.
  - Trade-off: un cast por endpoint que confía en que su `parse` coincide con el tipo declarado.
  - Descartada: hacer genérico el base query por endpoint (RTK fija un solo tipo de argumentos para toda la API) y repartir casts por pantallas y hooks.
- **Error y datos tal como los deja RTK.**
  - Elegida: leer `error` aunque haya `pending` y combinarlo con `data` e `isFetching`.
  - Trade-off: la regla depende de que RTK conserve el error hasta un éxito (probado, y cubierto por tests de `classifyHomeResult`).
  - Descartada: un `lastError` propio.

### Registro de T4

- Archivos nuevos: `home/data/home-request.ts` (+test), `home/data/home-api.ts`. Adaptados: `classify-home-result.ts` (+test), `use-home.ts`, `core/api/api-error.ts` (+`toApiError`, con test) y un log `__DEV__` en `core/network/reconnection.ts`. Borrados: `home-client`, `home-request-state` y `refetch-policy`, cada uno con su test.
- Los hooks `useRevalidateWhenStale` y `usePullToRefresh` de T3 se revisaron al conectarlos y no se cambiaron.
- Tests: 335 → 304. Sale lo que RTK asume (10 de `home-client`, 27 de `home-request-state`, 13 de `refetch-policy`); entran 12 de `home-request` (los casos de fixture, `?fail=true`, timeout y aborto se migraron), 4 más en `classify-home-result` y 3 de `toApiError`. Ninguna regla conservada se queda sin test.

### Validación de T4 (2026-10-11): Android e iOS por el usuario y comprobación independiente en el Samsung

- T4 queda validada. Una comprobación independiente en el Samsung dio 8/8 puntos de la matriz.
- **Logs reales que salen** (Metro, `__DEV__`): `[api] GET /home -> ok` (sin `200`), `[api] GET /home -> http 503` / `-> network` / `-> timeout`, `[net] offline -> online (N listener)`, `[home] background revalidation: data is 60 s old or more` y `[home] manual refetch (pull or retry button)`.
- **Pull por `adb`**: `adb shell input swipe 360 450 360 1300 400` (de arriba hacia abajo en 400 ms) dispara el `RefreshControl` y produce `[home] manual refetch` seguido de una petición aunque la caché esté fresca.
- **Enlace del dev client por `adb`**: debe ser `exp+herbstore://expo-development-client/?url=…`. Sin el prefijo `exp+` el esquema es el de la app y cae en `+not-found`: el dev client solo reconoce `exp+<slug>`.
- Mock con latencia: `MOCK_LATENCY_MS=2000 npm --prefix mock-server run dev` (o `start`; ambos scripts existen, `dev` añade `--watch`).


### Bloque T5 — Identidad de caché, normalización Unicode y por qué la página no es identidad (≈10 min)

**La clave de caché es el argumento.** En RTK Query una entrada de caché se identifica por el nombre del endpoint más el *argumento serializado* (claves ordenadas, `JSON`). Si `"Vitamina Ç"` y `"vitamina c"` producen argumentos distintos, hay dos entradas y dos peticiones para lo mismo; si las marcas llegan como `['b', 'a']` y `['a', 'b']`, otra vez. La solución es que el argumento se construya **canónico**: `buildProductQueryArgs` normaliza el texto, normaliza, deduplica y ordena los facets, y omite las claves de flags inactivos (no existe `inStock: false`: el flag apagado no tiene clave). Así "consulta equivalente" (definición de la spec) se convierte en algo comprobable: dos argumentos equivalentes son **profundamente iguales** y comparten caché y petición en vuelo.

**Normalización Unicode (NFD).** `"Ç"` puede ser un solo carácter (`U+00C7`, forma compuesta) o `C` + `U+0327` (la cedilla como *marca combinante*, forma descompuesta). NFD descompone todo; después se eliminan las marcas (`\p{M}`) y queda la letra base. El orden de los pasos es el mismo que usa el servidor mock (`normalizeText`): NFD → sin marcas → minúsculas → `trim` → espacios internos a uno. Resultado: `"  Vitamina   Ç "` → `"vitamina c"`. La UI conserva el texto humano más reciente (para el historial); la forma normalizada es solo la identidad.

| Idea | React Native (HerbStore) | Android (Kotlin) | iOS (Swift) |
| --- | --- | --- | --- |
| Quitar diacríticos | `text.normalize('NFD').replace(/\p{M}/gu, '')` | `Normalizer.normalize(text, Normalizer.Form.NFD)` + `Regex("\\p{Mn}")`; el patrón habitual usa `Mn`, aquí usamos `M` (incluye `Mn`, `Mc`, `Me`) para coincidir con el servidor, y en datos latinos dan lo mismo | `text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .init(identifier: "en"))` (hace el plegado Unicode por ti; ojo con la `locale`, p. ej. turco) |
| Espacios y minúsculas | `.toLowerCase().trim().replace(/\s+/g, ' ')` | `lowercase(Locale.ROOT).trim().replace(Regex("\\s+"), " ")` | `lowercased()`, `trimmingCharacters(in: .whitespacesAndNewlines)` y `split` + `joined(separator: " ")` |
| Clave de caché | el argumento canónico (objeto) serializado por RTK | una `data class` inmutable como clave de un `Map`/`LruCache`; sus `equals` y `hashCode` estructurales equivalen al "profundamente iguales" (con `Set` o listas ordenadas en los facets). Retrofit/OkHttp cachean por **URL**, así que `?brand=b,a` y `?brand=a,b` serían entradas distintas | una `struct` `Hashable` como clave de un `Dictionary` o de un `NSCache` (con `NSCache` hay que envolverla en una clase, porque la clave debe ser un objeto); `URLCache` también cachea por URL |
| Facet OR/AND | `brand=a,b` (OR dentro) y facets distintos (AND) | un `Set<String>` por facet en el `Query`/`Specification` | un `Set<String>` por facet en el predicado |

**La página no es identidad.** `getProducts` es una *infinite query*: **una** entrada de caché guarda *todas* las páginas de una lista, y la página es el `pageParam` con el que se pide la siguiente. `toProductQueryString(args, page)` recibe la página aparte justo por eso. Si la página fuese parte del argumento, "cargar más" crearía otra entrada por página, el refresco no sabría qué páginas rehacer, no habría forma de "volver a la página 1 y arriba" con un solo gesto, y cambiar un filtro dejaría páginas viejas huérfanas. Con la página fuera, cambiar un filtro cambia el argumento y por tanto de entrada (los datos de otros filtros no se mezclan), y pull-to-refresh actúa sobre una sola entrada. Nota: la spec define "consulta equivalente" incluyendo página y límite; en la práctica la página se resuelve dentro de la entrada (`pageParam`) y el límite es constante (20), así que nada de la definición queda sin cubrir.

**Contrato real del servidor.** `GET /products?category&q&brand&subcategory&inStock&minRating&ownBrand&subscribeAndSave&sort&page&limit` → `{ items, page, totalPages, total }`. La búsqueda va en `q` (marca + nombre + descripción, normalizada también en el servidor) y la categoría en `category` (su id). `limit` va de 1 a 50 (por defecto 20); `sort` es uno de `featured`, `price_asc`, `price_desc`, `rating`, `best_selling`. Un `page` más allá de la última no es error: devuelve `items: []`. `brand` y `subcategory` son CSV sin vacíos. `GET /brands` → `[{ name, productCount }]`; `GET /categories` → `[{ id, name, productCount, subcategories: [{ id, name, productCount }] }]`.

**Validar la página.** `parseProductPage` mantiene la política de Home: un elemento malformado, un id repetido, o `page` (≥ 1), `totalPages` (≥ 0) o `total` (≥ 0) fuera de rango invalidan **toda** la página (la pantalla muestra error con reintento, no una lista a medias). `parseCatalogProduct` es el mismo parser que usaba Home, extraído sin cambiar reglas.

**Errores típicos al venir de nativo.** (1) Usar el texto crudo del usuario como clave: cada espacio extra o mayúscula es otra petición. (2) Normalizar solo en el cliente o solo en el servidor y suponer que coinciden: aquí se comprueba con un test contra el `normalizeText` real del mock. (3) Dejar `inStock: false` en el argumento: parece "sin filtro" pero para la clave es una identidad distinta. (4) Ordenar con `sort()` sin pensar en la `locale`: se usa el orden por unidades de código, que no depende de la plataforma. (5) Incluir la página en la clave "porque así lo hace Paging 3 en su `PagingSource`": allí la clave de página es el *cursor* interno, no la identidad de la consulta.

### Decisiones de T5 (RF-3)

- **Normalizar en el cliente para la identidad.**
  - Elegida: el cliente normaliza (misma regla que el servidor) y envía la forma normalizada.
  - Trade-off: la regla vive en dos sitios (cliente y mock) y debe mantenerse sincronizada; un test contra el módulo real del mock lo vigila.
  - Descartada: enviar el texto crudo como identidad, porque rompería la caché compartida y la deduplicación (RF-4, RF-5).
- **La página fuera de la identidad.**
  - Elegida: una entrada de caché por lista (`pageParam` dentro de la infinite query).
  - Trade-off: la entrada crece con las páginas y hay que refrescarla como un todo (T9).
  - Descartada: una entrada por página, que multiplicaría entradas, tags y carreras entre refresh y página siguiente.
- **Facets ordenados y deduplicados; flags inactivos sin clave.**
  - Elegida: el argumento canónico se construye en una función pura.
  - Trade-off: el orden de selección del usuario se pierde en la identidad (no importa: es OR).
  - Descartada: dejar al serializador de RTK la igualdad, que solo ordena claves, no arrays.
- **Un `CatalogProduct` compartido, `HomeProduct` como alias.**
  - Elegida: una sola proyección del producto para Home y listas; los guards JSON comunes en `core/validation`.
  - Trade-off: los campos extra del servidor (`isOwnBrand`, `description`…) no se conservan hasta el detalle (Día 4).
  - Descartada: duplicar el parser en `product/` y en `home/`, que divergería.

### Registro de T5

- Archivos nuevos: `core/validation/json-guards.ts` (guards JSON compartidos, movidos desde `parse-home.ts`), `product/contracts/{catalog-product,parse-catalog-product}.ts` y `product/logic/product-query.ts`, cada uno con su test. Modificados: `home/contracts/{home,parse-home}.ts` (`HomeProduct` es un alias; `parse-home` importa `parseCatalogProduct`; sus reglas y `parse-home.test.ts` no cambian) y `product/logic/product-card.ts` (+ el import de tipo de su test).
- Tests: 304 → 363 (+38 de `parse-catalog-product`, +21 de `product-query`). Incluyen comprobaciones contra el código real del mock (las 15 páginas del catálogo, página vacía y página fuera de rango, `GET /brands`, `GET /categories`, `normalizeText` y el filtrado de `queryProducts` con la query string generada).
- Sin cambios visibles ni en dispositivo: T5 es lógica pura y no requiere validación manual.


### Bloque T6 — Paginación, infinite queries y respuestas obsoletas (≈10 min)

**Paginación por offset frente a cursor.** El mock pagina por *offset*: `page` + `limit` → `{ items, page, totalPages, total }`. Es simple y permite saltar a cualquier página, pero la lista del servidor puede cambiar entre dos peticiones: si se inserta un producto antes de tu posición, el último elemento de la página 1 reaparece como primero de la página 2 (un **duplicado**); si se borra uno, se **salta** un elemento. Con un *cursor* (un token opaco o el último id visto: "dame los 20 siguientes a este") la posición no se desplaza, pero el servidor tiene que soportarlo y no se puede ir a "la página 7". HerbStore usa el offset del mock y compensa el duplicado en el cliente (`flattenUniqueProducts`, primer ejemplar por id); el salto no se corrige: aceptarlo es el trade-off, y el pull-to-refresh reconstruye la lista desde la página 1.

**Infinite query de RTK.** `build.infiniteQuery` guarda **todas las páginas de una lista en una sola entrada de caché** (`{ pages, pageParams }`). Se declara con `initialPageParam: 1` y `getNextPageParam`; el hook da `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`, `isFetchNextPageError` y `currentData`. `getNextPageParam({ page, totalPages })` es una función pura: devuelve `page + 1` o `undefined`, y de ese `undefined` sale `hasNextPage = false`. Por eso `page = totalPages` no pide otra y `totalPages = 0` (sin resultados) tampoco.

**"Cargar más" por posición, no por `onEndReached`.** La regla (RF-10) es: cuando entra en pantalla cualquiera de los **últimos 4** elementos. `shouldLoadNextPage` recibe el índice visible más alto, la longitud de la lista, `hasNextPage`, `isFetching` y la **última longitud para la que ya se pidió**. Con 20 elementos el índice 15 no carga y el 16 sí. El *guard* por longitud existe porque los callbacks de visibilidad se disparan varias veces por gesto y `isFetching` solo cambia cuando la petición ya salió: mientras la longitud no crezca, no se vuelve a pedir. Lo guarda quien llama (un `useRef` en T9); se reinicia al cambiar la identidad de la consulta, al empezar un refresh y al abortar la página en vuelo por ese refresh. Un **fallo** de la página siguiente no lo reinicia: el pie ofrece un reintento manual y no hay bucle automático contra un servidor que falla.

| Idea | React Native (HerbStore) | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Paginación | `build.infiniteQuery` + `getNextPageParam`; páginas en una sola entrada de caché | **Paging 3**: `PagingSource.load()` devuelve `LoadResult.Page(data, prevKey, nextKey)`; `Pager` + `cachedIn(viewModelScope)` | No hay equivalente de serie: un `@Observable` con el array, la página actual y un `loadMore()` |
| Cuándo pedir más | Viewability de FlashList + `shouldLoadNextPage` (últimos 4) | `PagingConfig(prefetchDistance = 4)`: Paging dispara solo al leer `items[i]` cerca del final | `.onAppear` de las últimas celdas dentro de `LazyVGrid`, con un guard propio |
| Pie de carga/error | `footer: 'loading-more' \| 'load-more-failed'` | `LoadState.Append` (`Loading`/`Error`) con `retry()` | Un estado propio (`enum`) y un botón de reintento |
| Refresh | `refetch` + `usePullToRefresh`; la lista se conserva | `pagingItems.refresh()` (conserva items mientras `LoadState.Refresh` carga) | `.refreshable { await vm.reload() }` |
| Descartar respuestas viejas | cada args = su entrada; la pantalla lee `currentData` | `flatMapLatest { args -> pager(args).flow }` cancela el flujo anterior | `.task(id: args)` cancela la tarea anterior al cambiar `id`; en Combine, `switchToLatest()` |
| Duplicados por offset | `flattenUniqueProducts` (primer ejemplar por id) | `distinctBy { it.id }` al mapear, o `RemoteMediator` con base de datos como fuente de verdad | `Dictionary`/`Set` de ids al hacer `append` |

**Descartar respuestas obsoletas por identidad.** La clave de la entrada es el argumento canónico (T5). Si el usuario cambia un filtro mientras una petición vuela, esa petición termina escribiendo en **su** entrada (los args viejos), no en la vigente; la pantalla lee `currentData`, que es solo la entrada de los args actuales, así que nunca muestra datos de otra consulta. `data`, en cambio, conserva el resultado anterior mientras cargan los nuevos: sirve para evitar parpadeos pero **no** para listas filtradas, porque mostraría productos que ya no cumplen el filtro. No hay que cancelar ni comparar `requestId` a mano: la identidad hace el trabajo. Es el mismo principio de `flatMapLatest` y `.task(id:)`, con la diferencia de que aquí el resultado viejo se queda en caché por si el usuario vuelve a esos filtros.

**El estado de la lista.** `classifyProductListState` es la hermana de `classifyHomeResult` y sigue sus reglas: sin productos, `loading` (primera carga, args nuevos sin `currentData`, reintento), `offline` (fallo de `fetch` sin respuesta) o `error` (5xx, timeout, inválido); sin coincidencias, `empty`; con productos, siempre `ready`, con un pie (`idle`, `loading-more`, `load-more-failed`) y, si el fallo no es de la página siguiente, un aviso (`offline` o `update-failed`) que **no desaparece al reintentar** y solo se retira cuando un éxito borra el `error` (RTK 2.13 lo conserva durante `pending`; ver T4). El refresh no tiene variante: la lista sigue como `ready` y el spinner del pull es estado local. Detalle fino: mientras se carga o falla la página *siguiente* no se deriva aviso, porque el `error` conservado no distingue un fallo viejo de un refresh del que el usuario está reintentando; el pie ya dice qué falló.

**Errores típicos al venir de nativo.** (1) Leer `data` en vez de `currentData` y mostrar productos de otro filtro. (2) Disparar `fetchNextPage` desde `onEndReached` sin guard: se piden varias páginas a la vez. (3) Guardar el guard en `useState`: provoca un render por cada callback de visibilidad; es un `useRef`. (4) Concatenar páginas con `[...a, ...b]` sin deduplicar y obtener dos tarjetas con el mismo `key` (React avisa y FlashList recicla mal). (5) Tratar `total` como la longitud de la lista: `total` son las coincidencias del servidor, la lista crece página a página. (6) Meter la página en la identidad de la consulta (ver T5).

### Decisiones de T6 (RF-3)

- **Offset del mock + deduplicación por id en el cliente.**
  - Elegida: paginar por `page`/`limit` y conservar el primer ejemplar de cada id.
  - Trade-off: un elemento puede saltarse si el catálogo se reduce entre dos páginas; solo el refresh lo corrige.
  - Descartada: paginación por cursor, que exigiría cambiar el contrato del servidor y no aporta nada visible con un catálogo estático de 300 productos.
- **Umbral de los últimos 4 elementos con un guard por longitud.**
  - Elegida: `index >= itemCount - 4` y una sola petición por longitud de lista.
  - Trade-off: el guard vive fuera de la función pura (en el hook) y hay que reiniciarlo en tres momentos; si una página llegara con todos sus ids repetidos, la longitud no crece y el guard sigue cerrado hasta un refresh o el reintento del pie.
  - Descartada: `onEndReached` con un umbral en píxeles, que depende de la altura de las celdas y de la fuente y no coincide con la regla de la spec.
- **Una entrada por lista y `flattenUniqueProducts` en cada render.**
  - Elegida: aplanar sin memoizar (como mucho 300 elementos, O(n)).
  - Trade-off: se recalcula en cada render; se medirá en T15 y solo se memoizará si la medida lo justifica.
  - Descartada: copiar las páginas a un `slice` de Redux, que duplicaría la caché y obligaría a descartar a mano las respuestas tardías.
- **El refresh no es un estado propio de la lista.**
  - Elegida: `ready` conserva los productos y el spinner del pull es estado local.
  - Trade-off: el clasificador no sabe si hay un pull en curso (no lo necesita).
  - Descartada: un flag `isPullRefreshing` dentro del clasificador, que mezclaría estado de gesto con estado de datos.

### Registro de T6

- Archivos nuevos: `product/logic/product-pages.ts` (`getNextPageParam`, `flattenUniqueProducts`, `shouldLoadNextPage`, `LOAD_MORE_THRESHOLD`) y `product/logic/product-list-state.ts` (`classifyProductListState`), cada uno con su test.
- Tests: 363 → 411 (+23 de `product-pages`, +25 de `product-list-state`). Sin cambios visibles ni en dispositivo: T6 es lógica pura y no requiere validación manual.

### Bloque T7 — `injectEndpoints`, tags por lista y por id, infinite query (≈10 min)

**`injectEndpoints`: una sola API, endpoints repartidos por feature.** `core/api/base-api.ts` crea la API única (un reducer, un middleware, una política de caché y de reintentos) con `endpoints: () => ({})`. Cada feature la amplía con `baseApi.injectEndpoints({ endpoints: (build) => ({ ... }) })`: Home en `home/data/home-api.ts` y el catálogo en `product/data/products-api.ts` (`getProducts`, `getProduct`, `getBrands`, `getCategories`). El resultado es tipado y se puede importar sin que `core` conozca a ninguna feature.

| Idea | React Native (HerbStore) | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Endpoints por feature | `baseApi.injectEndpoints` en cada `*-api.ts` | una interfaz Retrofit por feature (`ProductsService`) sobre un único `OkHttpClient`/`Retrofit` compartido (interceptores, reintentos, caché) | un cliente por feature (`ProductsClient`) sobre un `URLSession` compartido |
| Detalle por id | `getProduct(id)` con tag `{ Product, id }` | `ProductsService.getProduct(id)` + `Room` (`@Query ... WHERE id = :id`) | `func product(id:)` con `NSCache`/`URLCache` o un diccionario por id |
| Invalidar | `invalidatesTags` borra o refetchea lo que lo provee | `Room` notifica por `Flow` al cambiar una tabla; sin base de datos, se vacía la caché del repositorio | se invalida la clave en el `NSCache` o se emite un evento (`Combine`/`AsyncStream`) |
| Paginar | `build.infiniteQuery` (`initialPageParam`, `getNextPageParam`) | `Pager` + `PagingSource.load()` (Paging 3) | `loadMore()` en un `@Observable`, disparado por `.onAppear` de las últimas celdas |

**Tags por lista y por id (RF-7).** Un tag es una etiqueta que una consulta *declara* que "contiene" (`providesTags`) y que una mutación puede *invalidar* (`invalidatesTags`). En HerbStore:
- `getProducts` provee `{ ProductList, LIST }` (un tag para **todas** las listas: categoría, búsqueda, filtros) y un `{ Product, id }` **por cada producto cargado**, así que a medida que se cargan páginas la entrada va ganando tags.
- `getProduct(id)` provee solo `{ Product, id }`.
- Una orden confirmada (T13) invalidará `Home`, `{ ProductList, LIST }` y `{ Product, id }` de cada producto comprado: las consultas con suscriptores refetchean al instante y las inactivas quedan marcadas y se piden al abrirlas.
- `getBrands` y `getCategories` no llevan tags: son opciones de filtro, no dependen de ninguna orden.
Los tags son lógica pura (`product/logic/product-tags.ts`, con test): `productListTags(pages)` genera la lista sin repetidos aunque un id aparezca en dos páginas.

**Infinite query.** `build.infiniteQuery<ProductPage, ProductQueryArgs, number>` guarda **todas las páginas de una lista en una sola entrada** (`{ pages, pageParams }`). `initialPageParam: 1` es la primera página; `getNextPageParam` (la función pura de T6, pasada tal cual) devuelve el número siguiente o `undefined`, y de ahí sale `hasNextPage`. La función `query` recibe `{ queryArg, pageParam }`: el `queryArg` es la identidad de la lista y el `pageParam` es solo "qué página pedir ahora" (T5: la página no es identidad). `fetchNextPage()` pide `pageParam + 1` y la añade a `pages`; la entrada entera tiene **un** `providesTags` calculado sobre todas las páginas.

**Detalle de producto.** `GET /products/:id` devuelve el producto completo del catálogo (los mismos campos de la lista más `ean13`, `servingInfo`, `description`...). Para el placeholder basta `parseCatalogProduct`, que valida y proyecta lo que la app ya usa (se comprobó contra los 300 productos del mock: 0 inválidos). El Día 4 ampliará el contrato en vez de reparsear desde cero. El `id` solo llega a la petición si pasó `parseProductId`; un id con forma inválida usa `skipToken` y **no hace ninguna petición**.

**Clasificar el resultado.** `classifyProductLookup({ data, error, isFetching })` es la hermana de `classifyHomeResult` (T4): `network` → `offline`; 5xx, otro 4xx, timeout o inválido → `error`; **404 → `not-found`**; sin datos y con una petición en vuelo → `loading` (el `error` que RTK conserva durante `pending` no se ve en el reintento); con datos, un fallo posterior no los tapa (no hay franja de aviso en el placeholder), salvo un 404, que es una respuesta más nueva que la caché. Con RF-8: el 404 hace **una** petición (los 4xx no se reintentan); `network` y 5xx hacen 3.

**Errores típicos al venir de nativo.** (1) Una API por feature, cada una con su reducer y middleware: duplica caché y reintentos; se inyectan endpoints en la misma. (2) Tags sin id (`'Product'` a secas): invalidar un producto refetchea todos. (3) Llamar a un hook con un argumento condicional con `if`: los hooks no pueden ir bajo una condición; se usa `skipToken`. (4) Poner `page` dentro del argumento de la consulta y obtener una entrada por página, sin lista acumulada. (5) Mantener el `ProductSummary` del Día 2 junto al contrato compartido: dos tipos de producto que divergen.

### Decisiones de T7 (RF-3)

- **Detalle por id con tag propio.**
  - Elegida: `getProduct(id)` pide `GET /products/:id` y provee `{ Product, id }`.
  - Trade-off: abrir un producto ya visto en una lista hace una petición más; a cambio, el detalle y los datos de la lista se invalidan por separado y el Día 4 podrá ampliar el contrato.
  - Descartada: derivar el detalle de la lista cacheada (`selectFromResult` sobre `getProducts`), que no funciona al entrar por un enlace, ni con la entrada ya expulsada de la caché, y que acoplaría el detalle a una consulta concreta.
- **Endpoints inyectados por feature.**
  - Elegida: `injectEndpoints` sobre la `baseApi` de `core`.
  - Trade-off: hay que recordar importar el módulo `*-api.ts` antes de usar el endpoint (los hooks se exportan del propio archivo, así que ocurre solo).
  - Descartada: una API monolítica con todos los endpoints de la app en un archivo, que concentra todas las features en `core` y crece sin control.
- **Tags de la lista con un id fijo (`LIST`) y uno por producto cargado.**
  - Elegida: `productListTags(pages)` sin repetidos.
  - Trade-off: la entrada recalcula sus tags al llegar cada página (O(n) sobre 300 productos como máximo).
  - Descartada: un tag solo por lista (no se sabría qué listas contienen el producto comprado) o un tag solo por producto (invalidar "todas las listas" exigiría enumerarlas).
- **`skipToken` para un id inválido.**
  - Elegida: el hook se ejecuta siempre y se omite la consulta; la pantalla muestra no encontrado sin petición.
  - Trade-off: el hook sigue montado aunque no haga nada.
  - Descartada: resolver la ruta en dos componentes (uno con y otro sin hook) solo para evitar el `skipToken`.

### Registro de T7

- Archivos nuevos: `product/logic/{product-lookup,product-tags}.ts` (+tests), `product/data/products-api.ts`. Adaptado: `ProductPlaceholderScreen.tsx` (misma interfaz y textos). Borrados: `product-client.ts` (+test) y `use-product-exists.ts`.
- Tests: 411 → 422. Salen los 6 de `product-client.test.ts`; entran 12 de `product-lookup` y 5 de `product-tags`. No hay textos nuevos.
- Comprobación fuera del repo (store RTK real + mock real en :3001, ya borrada): `getProduct` ok y 404 (una sola petición); `getBrands` (8) y `getCategories` (5); `getProducts` página 1 → 15 (14 peticiones más, ninguna extra al llegar a la última; 300 productos, `hasNextPage = false`); `selectInvalidatedBy` confirma que `{ Product, id }` toca `getProducts` y `getProduct`, y `ProductList/LIST` toca solo la lista; con el origen caído, 3 intentos y `offline`.

### Validación de T7 (2026-10-11): Android e iOS por el usuario

- **Android (Samsung, por adb): 7/7.** Producto existente (nombre e id como en el Día 2), id con forma válida pero inexistente (no encontrado tras una sola petición, 0 reintentos), id inválido (ninguna petición), mock detenido (offline tras 3 intentos) y reintento manual que recupera.
- **iOS (simulador): 6/6** en los mismos casos aplicables.
- **Aprendizajes de la validación.**
  - En iOS los logs `[api]` solo llegan a Metro tras reconectar el dev client con `exp+herbstore://expo-development-client/?url=…`.
  - El simulador de iOS es `DeviceHub.app` (Xcode 27) y `osascript` no llega a su pantalla; sirve un clic CGEvent compilado con `swiftc` (con el permiso de Accesibilidad concedido).
  - `adb reverse` no cambia el estado de red del sistema, así que `expo-network` no emite reconexión. Para probar la reconexión real hay que cortar Wi-Fi y datos con `adb shell svc`.
  - En desarrollo aparece `ERROR … injectEndpoints … getHome without overrideExisting: true` tras un Fast Refresh de un archivo con `injectEndpoints`: es ruido solo de desarrollo (decisión pendiente: `overrideExisting` o ignorarlo; no se cambia código).
- `product-tags.ts` queda como archivo aparte (aceptado por el usuario). La sesión 1 (T1–T7) se cierra sin commit intermedio; la sesión 2 empieza en T8.

---

## Sesión 2 — Cuadrícula, filtros, búsqueda y cierre (T8–T16)

### Bloque T8 — Virtualización, reciclaje y FlashList v2 (≈10 min)

**Por qué una lista no renderiza todo.** El catálogo tiene 300 productos. Crear 300 tarjetas con imagen cuesta memoria y tiempo de arranque, y casi todas están fuera de pantalla. Una lista **virtualizada** solo mantiene vivas las celdas cercanas a la ventana visible. Hay dos estrategias:
- **Ventana (FlatList / `VirtualizedList`):** monta las celdas que entran y **desmonta** las que salen (las sustituye por un hueco del tamaño estimado). Al volver, las crea de nuevo.
- **Reciclaje (FlashList, `RecyclerView`, `UICollectionView`):** cuando una celda sale, su vista **se reutiliza** para otro dato que entra por el otro extremo. No se crea ni se destruye vista: solo cambian los props. Es mucho más barato, pero **cualquier estado local de la celda sobrevive al reciclaje** (por eso `RemoteImage` ya usa `recyclingKey`).

| Idea | React Native (HerbStore) | Android (Kotlin/Compose y Views) | iOS (Swift/SwiftUI y UIKit) |
| --- | --- | --- | --- |
| Lista virtualizada con reciclaje | `FlashList` v2 (`data`, `renderItem`) | `RecyclerView` + `ViewHolder` reciclado; en Compose `LazyColumn`/`LazyVerticalGrid` **no recicla vistas** (compone solo lo visible y reutiliza por `key`/`contentType`) | `UICollectionView` con celdas en cola (`dequeueReusableCell`); `LazyVGrid` crea las vistas perezosamente |
| Cuadrícula de 2 columnas | `numColumns={2}` | `GridLayoutManager(ctx, 2)` o `GridCells.Fixed(2)` | `UICollectionViewCompositionalLayout` o `[GridItem(.flexible()), GridItem(.flexible())]` |
| Identidad estable de la celda | `keyExtractor={(p) => p.id}` | `items(list, key = { it.id })` / `DiffUtil` con `areItemsTheSame` | `ForEach(list, id: \.id)` / `Identifiable` / diffable data source |
| Tipos de celda para reciclar mejor | `getItemType` | `contentType` / `getItemViewType` | varios identificadores de reuso (`register(forCellWithReuseIdentifier:)`) |
| Cabecera, pie y vacío | `ListHeaderComponent`, `ListFooterComponent`, `ListEmptyComponent` | `item { }`/`stickyHeader`, `ConcatAdapter`/`MergeAdapter` | `Section` header/footer, `ContentUnavailableView` |
| Tamaño de las celdas | **v2 las mide sola** | `RecyclerView` mide al enlazar; Compose mide en la composición | `UICollectionView` con `estimatedItemSize`/self-sizing |

**Por qué v2 ya no usa `estimatedItemSize`.** En v1 había que decirle a la lista el tamaño medio de una celda para que calculara el alto total y cuántas pintar. En v2 (arquitectura nueva) la lista **mide cada celda real tras montarla** y ajusta posiciones en el siguiente frame; para lo no medido usa una estimación interna. Resultado: menos configuración, menos saltos y ninguna propiedad que mantener a mano. El propio paquete de `2.0.2` no tiene la propiedad en sus tipos. En una cuadrícula la fila mide lo que mide su celda más alta, y la lista pasa ese alto como `minHeight` a las demás celdas de la fila (por eso la tarjeta puede crecer hasta igualar a su vecina).

**Keys estables.** `keyExtractor` devuelve el **id del producto**, no la posición. Con posición, un dato que cambia de lugar (nuevas páginas, reordenar, borrar) parecería otra celda y se perdería el seguimiento del reciclaje y de las animaciones. Es el mismo principio que `key` en React, `key =` en Compose y `id:` en `ForEach`.

**Estados en lugar de una lista rota.** El skeleton, el vacío, el offline y el error **no son una lista**: son vistas cortas. Solo cuando hay productos se monta la cuadrícula. La clasificación (`classifyProductListState`, T6) decide cuál; la pantalla solo pinta.

**Errores típicos al venir de nativo.** (1) Esperar que `renderItem` se vuelva a ejecutar al cambiar un valor capturado: FlashList solo repinta una celda si cambia su `item` o `extraData`. (2) Guardar estado local en la celda sin acordarse de que se recicla. (3) Usar el índice como key. (4) Meter una `FlatList`/`FlashList` dentro de una `ScrollView` vertical: se pierde la virtualización. (5) Dar `padding` al `style` en vez de al `contentContainerStyle`. (6) Resolver el hueco entre columnas con `ItemSeparatorComponent` (ver abajo). (7) Memoizar a ojo: con React Compiler activo no hace falta y se mide en T15.

### APIs reales de FlashList 2.0.2 que usa T8 (comprobadas en la documentación oficial y en los tipos/código de `node_modules`)

| API | Cómo se usa | Diferencia con lo supuesto en el plan |
| --- | --- | --- |
| `numColumns` | `getGridColumnCount(fontScale)`: 2, o 1 con fuente > 1.5x | El plan decía "2 columnas"; la columna única a fuente muy grande es nueva (ver decisiones). La lista re-maqueta sola al cambiar `numColumns`: no hace falta `key`. |
| `keyExtractor` | `(product) => product.id`, a nivel de módulo | Sin diferencia. |
| `renderItem` + `extraData` | `renderItem` de módulo; el `onOpenProduct` viaja en `extraData` | **Nuevo:** `renderItem` recibe `{ item, index, target, extraData }`. Una celda solo se vuelve a ejecutar si cambia `item` o `extraData`, así que un closure no basta. |
| `ListHeaderComponent` / `ListFooterComponent` | elementos React (título, contador y aviso; progreso del pie) | Sin diferencia. Hay también `ListHeaderComponentStyle`/`ListFooterComponentStyle`. |
| `ListEmptyComponent` | **No se usa**: el vacío es una pantalla (`ProductListStatus`), no una lista sin filas | El plan lo mencionaba para la cuadrícula; el clasificador ya separa `empty` y la cuadrícula solo se monta con productos. |
| `ItemSeparatorComponent` | **No se usa** | En v2 el separador se dibuja **debajo** de cada celda (`trailingItem`), no entre columnas: en una cuadrícula no sirve para el hueco horizontal. |
| `contentContainerStyle` | `paddingHorizontal` y `paddingBottom` | En v2 solo admite padding y `backgroundColor`; el `style` no debe llevar padding. El hueco entre tarjetas es **padding en la celda** (`GRID_CELL_PADDING` = 4, 8 entre vecinas) más padding del contenedor (`GRID_EDGE_PADDING` = 12, para llegar a 16). |
| `contentInsetAdjustmentBehavior` | `"automatic"` (pasa a la `ScrollView`) | Sin diferencia (igual que Home). |
| `maintainVisibleContentPosition` | **valor por defecto** | Viene **activada** por defecto en v2 (`disabled` para apagarla). T9 la valida con las páginas adicionales. |
| `drawDistance` | **valor por defecto** | Solo se toca si T15 lo justifica midiendo. |
| `onEndReached`, `onViewableItemsChanged`, `viewabilityConfig` | **no se usan en T8** | Existen. `viewabilityConfig` **no se puede cambiar en caliente**; `ViewToken` trae `index`, `isViewable`, `item`, `key`, `timestamp`. Para T9. |
| `refreshing` + `onRefresh` / `refreshControl` | **no se usan en T8** | Existen (T9 usará `refreshControl`, como Home). |
| `onLoad` | **no se usa** | Da `elapsedTimeInMs`, útil para la métrica de T15. |
| `estimatedItemSize` | **no existe** | Confirmado: no está en los tipos de 2.0.2. |

### Decisiones de T8 (RF-3)

- **FlashList en la cuadrícula frente a `FlatList`.**
  - Elegida: `FlashList` v2 (reciclaje de celdas) solo en `ProductGrid`.
  - Trade-off: una dependencia con vistas nativas propias; hay que recordar que las celdas se reciclan y que `renderItem` solo se repinta con `item`/`extraData`.
  - Descartada: `FlatList` con `numColumns`, que desmonta y remonta celdas con imagen (más trabajo en el hilo JS al hacer scroll). Home sigue en `FlatList`: sus filas tienen 10 elementos y no hay mejora medida.
- **`ProductCard` compartida frente a duplicada.**
  - Elegida: una sola tarjeta en `product/components/` con `width` opcional (Home pasa el ancho del Día 2; la cuadrícula la deja llenar su celda).
  - Trade-off: Home gana la línea "Agotado" cuando corresponde, y el ancho deja de ser un detalle interno de la tarjeta.
  - Descartada: copiar la tarjeta para la cuadrícula, que obligaría a mantener dos veces la etiqueta hablada, el formato de precio y la insignia.
- **Skeleton estático frente a shimmer.**
  - Elegido: bloques con la forma de la cuadrícula, sin animación, un único elemento accesible marcado `busy`.
  - Trade-off: se ve menos "vivo".
  - Descartado: shimmer con Reanimated: exigiría una rama para movimiento reducido (RNF-3) y no mejora la comprensión del estado.
- **Una columna con fuente muy grande: excepción a RF-9 (decisión del usuario, por RNF-2).**
  - Elegida: `getGridColumnCount`: 2 columnas hasta 1.5x de escala de fuente y 1 por encima. RF-9 pide dos columnas "con el tamaño normal"; con texto muy grande se prioriza RNF-2 (nombre, precio y estado visibles). Validada: Android 1.0 y 1.5 en 2 columnas, 2.0 en 1; iOS `extra-large` en 2 y AX5 en 1.
  - Trade-off: con fuente muy grande la cuadrícula deja de ser de dos columnas y se ven menos productos por pantalla.
  - Descartada: mantener 2 columnas siempre: una celda de unos 150 dp no cabe un precio y una palabra de un nombre a 2x/AX5 (se rompería a mitad de palabra).
- **Título de la categoría: tope de escala `fontScaleLimits.listTitle` = 2.**
  - Problema (hallazgo de la validación): en iOS con AX5 (`xcrun simctl ui booted content_size accessibility-extra-extra-extra-large`, unas 3.1x) el título de 28 pt pasa a unos 87 pt y "Vitaminas" es una sola palabra más ancha que los 370 pt útiles: iOS la partía como "Vitamin / as". Android no lo mostraba porque su escala máxima es 2.0 (56 pt, cabe).
  - Elegida: `maxFontSizeMultiplier={fontScaleLimits.listTitle}` (2.0) solo en el `AppText` del título (mismo patrón que `tabLabel` 1.2 y `searchField` 1.5). El título sigue creciendo con el sistema hasta 56 pt, en Android no cambia nada y en iOS AX5 se queda en una línea (68 pt de alto, unos 255 pt de ancho de 370 pt útiles, medido en Vitaminas y Botánicos). No es lógica pura: es una constante de diseño sin cálculo que probar, así que no hay test nuevo.
  - Trade-off: por encima de 2x (en la práctica solo iOS AX3–AX5) el título deja de crecer, aunque sigue siendo un título de 56 pt, mayor que el contador y el texto de las tarjetas; un nombre de categoría desconocido y muy largo del servidor aún podría partirse (aceptado: los cinco conocidos caben).
  - Descartada: `adjustsFontSizeToFit`/`minimumFontScale` con `numberOfLines={1}` (el título encoge a un tamaño arbitrario según la palabra, difícil de explicar y de probar, y trunca o reduce textos largos), y dejar el título partirse (incumple RNF-2 y el criterio (f)).
  - Equivalencias: en Compose se limita con `sp` y `maxLines`/`TextAutoSize`, o con `LocalDensity` y un `fontScale` acotado; en iOS equivale a limitar Dynamic Type con `UIFontMetrics(forTextStyle:).scaledFont(for:maximumPointSize:)` o `.dynamicTypeSize(...DynamicTypeSize.accessibility2)` en SwiftUI, y `minimumScaleFactor`/`lineLimit` si se prefiere encoger.
- **Nombre de la categoría.**
  - Elegida: traducción propia (`categoryLabelKey`); solo un id sin traducción pregunta al servidor por `GET /categories` (con `skipToken` si no hace falta) y, si tampoco la conoce, el título genérico "Categoría".
  - Trade-off: una petición más solo en ese caso raro.
  - Descartada: pedir siempre `GET /categories`, una petición que los cinco ids conocidos no necesitan.
- **Acción del vacío en una categoría.**
  - Elegida: "Ir a Inicio" (la categoría aún no tiene filtros que limpiar). `ProductListView` recibe la acción como prop; T10/T11/T12 la cambiarán por "Limpiar".
  - Descartada: un botón "Limpiar" que no hace nada.

### Registro de T8

- Cierre de la sesión 1: T7 validada (Android 7/7 por adb, iOS 6/6) y `MEMORY.md` apunta T1–T7 validadas.
- Lógica nueva con test primero: `getGridColumnCount` (+3 tests) e `inStock` en `buildProductCardModel` (+1). 422 → 426.
- Archivos nuevos: `product/components/ProductCard.tsx` (movido desde Home), `product/list/{ProductGrid,ProductGridSkeleton,ProductListStatus,ProductListView}.tsx`, `product/list/{use-product-list,grid-layout}.ts`, `categories/screens/CategoryProductsScreen.tsx`. Borrado: `CategoryPlaceholderScreen.tsx`. Textos: `home.product.*` → `productCard.*` (+ `outOfStock`), `productList.*`, y `category.idLabel`/`category.note` eliminadas.
- Con React Compiler activo, los 9 componentes y el hook nuevos compilan sin omisiones; no hay `memo`/`useMemo`/`useCallback`.
- Home: sin cambios visibles salvo la línea "Agotado" (en el mock, `product-261009-001` en "Nuevos" y "Ofertas", y `product-261009-027` en "Más vendidos").
- Corrección tras la validación por adb y simulador: hallazgo 1 (título partido en AX5) corregido con `fontScaleLimits.listTitle` (arriba). Revalidado: iOS AX5 en las cinco categorías (una línea), `extra-large`, `large` y oscuro; Android 1.0/1.5/2.0 en es y en en. El hallazgo 2 (tamaño de texto en vivo en iOS) pasa a la auditoría del Día 6 (H-10 en `MEMORY.md`).
- **TalkBack real en el Samsung (SM-A037M, Android 13, TalkBack 13.5): PASA.** Se activó el servicio por `adb` y se leyó lo que TalkBack enuncia con su opción de desarrollador "Mostrar la salida de voz" (un cuadro oscuro con el texto hablado); no se oye el audio. `adb shell input` no pasa por la exploración táctil de TalkBack (un toque es un clic normal y el swipe no navega), así que el foco se movió con una herramienta `UiAutomation` (`ACTION_ACCESSIBILITY_FOCUS`/`ACTION_CLICK`), que es lo mismo que TalkBack hace con un swipe y un doble toque. El orden de recorrido sale del árbol de accesibilidad (no se probó el swipe físico).
  - Cada tarjeta es UN solo foco (el anillo envuelve la tarjeta): "Complete Daily Powder. En oferta, USD 12.99, antes USD 15.59. Calificación 3.1 de 5, 815 reseñas. Agotado, Botón, Abre el producto." Nombre, precio y rating sueltos no reciben foco. La insignia "Nuevo" / "Más vendido" va al final ("… Agotado. Más vendido").
  - Orden: "Navegar hacia arriba, Botón" → "Categoría" → "Vitaminas, Encabezado" → "60 productos" → tarjetas por filas (izquierda, derecha, siguiente fila). Home dice "Agotado" en Nuevos y en Ofertas.
  - Skeleton: un solo elemento, "Cargando productos, ocupado" (región viva, anunciada al aparecer). Offline: "Sin conexión con el servidor, Encabezado" y "Reintentar, Botón, Vuelve a solicitar los productos." (botón de 204×90 px = 109×48 dp, y recupera la lista). Vacío: "No hay productos, Encabezado" e "Ir a Inicio, Botón, Abre la pantalla de Inicio." (lleva a Home).
  - Al abrir un producto el foco pasa a "Navegar hacia arriba" de la pantalla nueva; Atrás devuelve a la categoría con el foco en ese mismo botón (no vuelve a la tarjeta).
  - No se pudo ver "Aún sin reseñas": el mock no tiene productos con 0 reseñas (se cubre con el test de `buildProductCardModel`). Observación menor, no es un fallo: TalkBack deletrea "USD" en voz alta; VoiceOver real queda sin probar (decisión del usuario) para la auditoría del Día 6.

### Bloque T9 — Scroll infinito, refresh y carreras (≈10 min)

**Cargar más por viewability, no por `onEndReached`.** FlashList avisa con `onViewableItemsChanged` cada vez que cambia el conjunto de elementos visibles y entrega `viewableItems` completo. `getLastVisibleIndex` toma el índice más alto (`ViewToken.index` es `number | null`: se saltan los `null` a mano, porque `Math.max(null, 3)` da 3 pero `Math.max(...[null])` da 0) y `shouldLoadNextPage` decide: último índice ≥ longitud − 4. `onEndReached` mide una fracción de la pantalla (`onEndReachedThreshold`), no "elementos", y con celdas de alto distinto o fuente grande no coincide con la regla de la spec. `viewabilityConfig` no se puede cambiar en caliente (por eso es una constante de módulo) y `minimumViewTime` vale 250 ms por defecto: se pone a 0 para que la petición salga en cuanto aparece el último bloque; el callback solo compara unos pocos números. El umbral de visibilidad por defecto es 0 (un píxel basta), que es el "entra en pantalla" de RF-10.

**El guard cuenta páginas, no elementos.** T6 guardaba la longitud de la lista; si una página llegaba con todos sus ids repetidos (RF-11), `flattenUniqueProducts` los descartaba, la longitud no crecía y el guard quedaba cerrado hasta un refresh. Ahora el `useRef` guarda el **número de páginas cargadas** para el que ya se pidió la siguiente: cada página que aterriza suma una, sea cual sea su contenido. El umbral sigue usando la longitud (lo que el usuario ve). Límite residual: tras una página de repetidos nada "entra" en pantalla, así que la siguiente petición espera al próximo cambio de elementos visibles (cualquier scroll). Se reinicia a `undefined` al cambiar la identidad, al empezar un pull y al abortar la página en vuelo; un fallo de página **no** lo reinicia (sin bucles).

**Carrera entre refresh y página siguiente.** Comprobado con un store RTK real y el mock (ver "Comprobación" abajo): RTK descarta un `refetch()` mientras la entrada está `pending` (`condition` rechaza), y el hook de RTK espera a la petición en vuelo. Sin abortar, un pull durante "cargar más" termina con la página 2 ya añadida y no empieza en la 1. Por eso el pull hace: `promise.abort()` → `await promise` → `refetch({ refetchCachedPages: false })`. El `await` es imprescindible: `abort()` solo *pide* la cancelación; si se hace `refetch` justo después, RTK lo descarta en silencio y la entrada se queda `rejected` sin refrescar. Además, RTK registra el abort como un `SerializedError` `AbortError` y deja `isFetchNextPageError = true` hasta que el refetch pasa a `pending`: `toApiError` lo traduce ahora a `aborted` (la UI nunca trata una cancelación propia como fallo; antes se vería un pie de error y luego el aviso "no se pudo actualizar" durante todo el refresh).

**`refetchCachedPages` (RTK 2.13).** Por defecto un `refetch` rehace **todas** las páginas cacheadas en secuencia y cambia la entrada al final (con *structural sharing*: las páginas iguales conservan su identidad, así que FlashList no ve cambios y `maintainVisibleContentPosition` mantiene la posición). Con `refetchCachedPages: false` pide solo la página 1 y descarta el resto. Se aplican las dos: **revalidación tras 60 s** = todas las páginas (no mover lo que el usuario está mirando); **pull** = solo la primera (RF-6: "termina desde la página 1 nueva"; el pull se hace arriba del todo, así que reducir la lista no mueve nada visible y evita N peticiones).

| Idea | React Native (HerbStore) | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Pedir más al acercarse al final | `onViewableItemsChanged` + `shouldLoadNextPage` (últimos 4) | `PagingConfig(prefetchDistance)`; o `snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index }.distinctUntilChanged()` | `.onAppear` de las últimas celdas de `LazyVGrid` llamando a `loadMore()` con un guard |
| Cancelar la página en vuelo | `promise.abort()` + `await` | cancelar el `Job` (`job.cancelAndJoin()`) | cancelar el `Task` (`task.cancel()`; `await task.value`) |
| Pull-to-refresh | `RefreshControl` en `refreshControl` de FlashList | `PullToRefreshBox(isRefreshing, onRefresh)` | `.refreshable { await vm.reload() }` |
| No saltar al añadir elementos | `maintainVisibleContentPosition` (activa por defecto en v2) | `key` estable en `items(key = …)` mantiene la posición en `LazyColumn` | `ScrollViewReader`/ids estables en `LazyVStack` |
| Rehacer lo cargado sin mover la lista | `refetch()` de todas las páginas + structural sharing | `PagingSource.invalidate()` + `getRefreshKey` (anchor position) | recargar y reemplazar el array conservando ids |

### APIs reales usadas en T9 (documentación oficial y tipos/código de `node_modules`)

| API | Uso | Notas |
| --- | --- | --- |
| RTK `fetchNextPage()` (hook) | devuelve `InfiniteQueryActionCreatorResult` (promesa + `abort()` + `unsubscribe()`) | La guardamos en un ref y la limpiamos al resolver. Con la entrada `pending` no hace nada (la doc: "bail out si ya hay una petición en vuelo"). En la última página tampoco (`getNextPageParam` → `undefined`). |
| RTK `refetch({ refetchCachedPages })` | `false` en el pull; sin opciones en la revalidación | La opción por llamada existe en 2.13 (`Pick<…, 'refetchCachedPages'>`); el hook solo la tiene por defecto `true`. |
| `isFetchNextPageError` | solo es `true` con `isError` y `direction === 'forward'` | Un `refetch` pone `direction` a `undefined` al pasar a `pending`: tras un pull el flag es `false` (éxito o fallo del refresh). El `error` anterior sí persiste hasta un éxito (T4). |
| FlashList `onViewableItemsChanged`, `viewabilityConfig` | callback del hook + constante `{ minimumViewTime: 0 }` | La librería lee `props.onViewableItemsChanged` en vivo, no hay callback obsoleto. |
| FlashList `refreshControl` | `<RefreshControl>` con los colores del tema (como Home) | `refreshing` solo es `true` durante un pull. |
| FlashList `maintainVisibleContentPosition`, `drawDistance` | valores por defecto | Se valida en el dispositivo (f). |
| FlashList `onLoad` | solo bajo `__DEV__`: `[products] grid onLoad N ms` | Dato de partida para T15. |

### Comprobación con un store real (fuera del repo, borrada después)

Store RTK real + `baseApi`/`productsApi` reales + el mock de `:3001` (con un `fetch` envuelto para latencia y fallos). Peticiones por escenario:
- Paginación en `vitamins` (60 productos): 1 → 2 → 3 = 3 peticiones; `fetchNextPage` en la página 3 = **0** peticiones (`hasNextPage = false`).
- Ráfaga de 6 eventos de visibilidad por página con la lógica del hook: 1 petición por página; ninguna en la última.
- Pull durante "cargar más" (latencia 300 ms): `[api] … -> aborted` de la página 2 y después 1 petición de la página 1; el resultado queda en 1 página, sin error. Sin esperar al abort, el `refetch` se descarta y la entrada queda `rejected`/`AbortError`. Sin abortar, el pull termina con 2 páginas.
- Fallo de la página 2 (503): 3 peticiones (1 + 2 reintentos), `isFetchNextPageError = true`, la lista conserva la página 1; el reintento pide **solo** la página 2 y limpia el error.
- Pull tras un fallo de página: `isFetchNextPageError` pasa a `false` en cuanto empieza el refresh, tanto si el refresh tiene éxito (error limpio) como si falla (queda `http 503` con `direction` indefinido: aviso, no pie de error). Durante ese refresh el aviso "no se pudo actualizar" se ve hasta que llega la respuesta (el `error` viejo persiste): es coherente con el resto de la pantalla.
- 3 páginas en caché: `refetch()` = 3 peticiones secuenciales y la entrada cambia al final (la página 1 conserva su identidad); `refetch({ refetchCachedPages: false })` = 1 petición y la entrada pasa de 3 a 1 página.
- Página 2 con todos los ids de la página 1: la lista sigue en 20 elementos pero con 2 páginas; el guard por páginas se reabre y pide la 3.
- Un `fetchNextPage` o un pull con otra petición (revalidación) en vuelo no inician otra: se unen a la que corre.

### Decisiones de T9 (RF-3)

- **Cargar más por viewability y guard frente a `onEndReached`.**
  - Elegida: `onViewableItemsChanged` + `shouldLoadNextPage` (últimos 4 elementos) con un guard en un `useRef`.
  - Trade-off: más lógica propia y un `minimumViewTime` que elegir.
  - Descartada: `onEndReached` con `onEndReachedThreshold`, que mide fracciones de pantalla y no elementos.
- **Pull durante "cargar más": abortar y refrescar frente a dejar terminar la página.**
  - Elegida: `abort()` + `await` + `refetch({ refetchCachedPages: false })`, como pide la spec (el resultado parte de la página 1 nueva).
  - Trade-off: una petición tirada y una espera de un microtask; hay que traducir el `AbortError` de RTK.
  - Descartada: dejar terminar la página y refrescar después (el usuario vería la página 2 añadida y luego desaparecer) o ignorar el pull mientras carga (el spinner no respondería).
- **Guard por páginas frente a por elementos.**
  - Elegida: `pageCount` como base del guard; la longitud solo para el umbral.
  - Trade-off: una firma más en `shouldLoadNextPage` y un límite residual (hace falta un cambio de elementos visibles tras una página de repetidos).
  - Descartada: seguir contando elementos (se atasca con una página de repetidos) y un efecto que reevalúe tras cada página (más estado para un caso que el mock no produce).
- **Pull con `refetchCachedPages: false`, revalidación con todas.**
  - Elegida: la variante del plan, confirmada con el store real.
  - Trade-off: la revalidación de N páginas son N peticiones secuenciales; el pull descarta lo que había cargado más allá de la página 1.
  - Descartada: rehacer todas las páginas en el pull (N peticiones para volver a la página 1) y paginación por cursor o copiar las páginas a un `slice` (duplica la caché y obliga a descartar a mano las respuestas tardías).
- **Reinicio por identidad con un efecto, y `key` en la cuadrícula.**
  - Elegida: `useEffect` sobre la identidad serializada para olvidar el guard y la petición, y `key={identity}` en `ProductGrid` para volver arriba y reciclar desde cero.
  - Trade-off: una serialización por render (objeto pequeño).
  - Descartada: remontar toda la vista por identidad (perdería el foco de accesibilidad de los controles de filtros cuando lleguen en T10/T11).

**Errores típicos al venir de nativo.** (1) Hacer `refetch` justo después de `abort()` sin esperar: se descarta en silencio. (2) Guardar el guard en `useState` (un render por callback de visibilidad). (3) Dejar `minimumViewTime` en 250 y creer que "tarda" por la red. (4) Mostrar un `AbortError` propio como fallo. (5) Pedir la página siguiente desde `onEndReached` sin guard. (6) Esperar que el pull siga con 3 páginas: `refetchCachedPages: false` las descarta.

### Registro de T9

- Lógica nueva con test primero: `getLastVisibleIndex` (+4), `shouldLoadNextPage` por páginas con el caso de una página de ids repetidos (+3, y los existentes adaptados), `toApiError` reconoce el `AbortError` de RTK (+1). 426 → 434.
- Archivos: `product/list/{use-product-list.ts, ProductGrid.tsx, ProductListView.tsx}`, `product/logic/product-pages.ts` (+test), `core/api/api-error.ts` (+test). Sin textos nuevos (el pie de carga y el de error ya existían); sin dependencias nuevas.
- React Compiler: el hook y los componentes compilan sin omisiones; no hay `memo`/`useMemo`/`useCallback`. `use-pull-to-refresh.ts` (T3) no lo compila el Compiler (`try/finally` sin `catch`, error de `BuildHIR`); es anterior a T9 y inofensivo.
- Estado: **VALIDADA y aprobada por el usuario (2026-10-11): "Aprobar T9 y medir en T15".** (a)–(f) y la regresión pasan en Android (Samsung SM-A037M, por `adb`) e iOS (simulador, con `axe`). (g) pasa en iOS y en Android queda a medir en T15.

### Validación de T9 (2026-10-11): Android por adb, iOS con `axe`

- **Resultado.** (a) una petición por página y ninguna extra en la última; (b) sin duplicados (por id); (c) productos conservados con el pie de carga y pie de error con reintento; (d) pull con caché fresca; (e) pull durante "cargar más" cancela y parte de la página 1; (f) Producto → Atrás restaura la posición y revalida tras 60 s sin saltar; regresión de T8 sin cambios. Todo pasa en las dos plataformas.
- **(g), parcial.** En iOS no hay ningún stall del hilo JS. En Android (dev build, gama baja) el umbral estricto de 150 ms no se cumple.

| Medida (Samsung SM-A037M, dev build) | Resultado |
| --- | --- |
| Stall del hilo JS por llegada de página (sondeo `setInterval`) | 212, 370 y 392 ms (rango 210–390) |
| Stall solo con scroll, sin paginar | 250–440 ms |
| Tap con el pie de carga visible | ≈0,7 s |
| Tap sin carga | ≈0,8 s |
| `gfxinfo` con y sin cargas | medido en la validación; las cifras exactas no se copiaron a este registro: repetirlo en T15 |
| iOS (simulador), mismo sondeo | 0 stalls |

- **Interpretación honesta.** El scroll solo ya bloquea entre 250 y 440 ms, del mismo orden que lo que cuesta una página (210–390 ms), y el tap con el pie de carga no fue más lento que sin carga. Con un dev build de gama baja (Hermes sin las optimizaciones de release, Metro, React DevTools) **no se puede atribuir el bloqueo a la paginación sin medir en release o con el Profiler**. Por eso se aprueba T9 y la medición se hace en T15, antes y después (RF-21), sin optimizar por intuición. El sondeo `setInterval` fue solo un instrumento temporal: el usuario descartó dejarlo como utilidad permanente.
- **Lecciones de procedimiento.**
  - (H1) Los nombres del mock **no son únicos** (29 nombres distintos en 60 productos): comprobar duplicados por id o por tupla, nunca por nombre. El criterio (b) de T9 se reformuló así.
  - (H2) Quitar `adb reverse` no corta la conexión de inmediato por el keep-alive de ~5 s: esperar más de 5 s antes de pedir la página 2 si se quiere ver el fallo de página.
  - (H5) El detalle de producto deja `[api] GET /products/<id> -> ok`; un `grep` por el prefijo `GET /products` lo confunde con la lista. Filtrar por la forma exacta de la lista (`GET /products ->`).
  - (H6) En iOS, el pull con `axe swipe` necesita unos 600 pt en unos 0,8 s (de y=220 a y=820); con 0,5 s no dispara el refresh.
  - (H8) `axe describe-ui` incluye elementos fuera de pantalla (con coordenadas `y` negativas): filtrarlos antes de contar tarjetas visibles.
  - (H7) Observado sin investigar: una línea `[net] offline -> online` durante una recarga de bundle en Android, con un stall de 3355 ms. Se anota; no se atribuye a T9.
- **Seguimiento (H-13).** (g) en Android pasa a T15: llegada de una página y scroll con 60 y 300 productos, dev frente a release (o Profiler), antes y después.

### Bloque T10 — Filtros como entrada de la identidad, chips accesibles y hoja de orden (≈10 min)

**El filtro aplicado es la entrada de la consulta, no una orden.** En `ProductListView`, `ListParams` (cuatro banderas rápidas + `sort`, y huecos para marcas y subcategorías de T11) vive en un `useState` **local** de la pantalla. Cada cambio construye un objeto nuevo con una función pura de `list-params.ts` (`toggleQuickFilter`, `setSort`, `clearFilters`) y `toProductQueryArgs` lo convierte en la identidad canónica (`buildProductQueryArgs`). RTK Query serializa esa identidad como clave de caché: cambia un filtro → otra entrada → página 1 → la cuadrícula (con `key={identity}`) vuelve arriba. No hay "recargar" que programar: **cambiar el estado es cambiar la consulta**. Es el mismo modelo que `StateFlow<FilterState>` + `flatMapLatest { repository.products(it) }` en un `ViewModel` de Android, o `@State var filters` + `.task(id: filters)` en SwiftUI.

**Por qué local y no Redux ni URL.** Los filtros solo importan a esa lista. Volver desde un producto los restaura porque la pantalla sigue montada bajo el producto (como en T9), sin persistir nada. Al cambiar de categoría el *stack* es singular y **reutiliza la misma pantalla con otro `id`**: sin remontar, los filtros de Vitaminas se aplicarían a Minerales. Por eso `CategoryProductsScreen` pone `key={categoryId}` a `ProductListView`: otra categoría = estado nuevo.

**Chips accesibles.** Un chip es un `Pressable` con `accessibilityRole="button"` y `accessibilityState={{ selected }}`. En RN 0.86 (iOS, `RCTViewComponentView.mm`) `selected` añade el *trait* `UIAccessibilityTraitSelected` y VoiceOver dice "seleccionado"; en Android marca `isSelected` y TalkBack lo anuncia. La selección además se ve **sin color**: chip relleno + marca "✓" (oculta a los lectores, porque el estado ya lo dice). Alto mínimo 48 dp; la fila es un `ScrollView` horizontal, así que nunca crece en vertical con la fuente; un chip no supera el ancho de la pantalla (`maxWidth`) y su texto se parte en dos líneas antes que recortarse. Equivalentes: `FilterChip(selected = …)` en Compose, `Toggle(...).toggleStyle(.button)` en SwiftUI.

**La barra de filtros no puede vivir dentro de la rama que cambia.** `ProductListView` alterna entre la cuadrícula (FlashList), el esqueleto, el vacío y el error. Si los chips estuvieran en el encabezado de la cuadrícula, al tocar uno la lista pasaría a "cargando" (otra identidad → `currentData` indefinido), la rama se **desmontaría** y con ella el chip pulsado: TalkBack/VoiceOver perderían el foco justo después de actuar. Por eso la barra (botón de orden + chips) está **fija sobre** la rama y nunca se desmonta; además cumple RF-19 sola: los chips siguen visibles con cero resultados, con error o sin conexión.

**La hoja de orden: `BottomSheetModal` de Gorhom.** Se monta en un portal que pinta `BottomSheetModalProvider` (en `_layout.tsx`, dentro del tema y de i18n porque la hoja se dibuja allí) y se abre con `present()` / se cierra con `dismiss()`. Con `enableDynamicSizing` la altura sale del contenido; `enablePanDownToClose` permite arrastrar hacia abajo. Equivalentes: `ModalBottomSheet(sheetState)` de Material 3 en Compose (ventana propia: Atrás y accesibilidad los resuelve la plataforma) y `.sheet(isPresented:)` + `.presentationDetents([.medium])` en SwiftUI. La librería **no** resuelve por ti tres cosas, y `AppBottomSheet` (design system) las añade:
1. **Atrás de Android.** Gorhom 5.2.14 no usa `BackHandler`: sin más, Atrás cerraría la *pantalla* que hay debajo. Mientras la hoja está abierta se registra un `hardwareBackPress` que llama a `dismiss()` y devuelve `true` (los oyentes se ejecutan del último al primero, así gana al del navegador).
2. **Accesibilidad.** Los valores por defecto marcan el contenido entero como **un** elemento accesible (`role=adjustable`, "Bottom Sheet"; en iOS se tragaría los botones de dentro), y el fondo, el *handle* y el *backdrop* son nodos accesibles con texto en inglés. Se pasa `accessible={false}` y se sustituyen los tres por componentes del tema (fondo con `colors.surface`, que también arregla el modo oscuro). El contenido de detrás se oculta a TalkBack/VoiceOver con `HiddenWhileSheetOpen` en la raíz (`importantForAccessibility="no-hide-descendants"` + `accessibilityElementsHidden`), alimentado por un registro de hojas abiertas. El foco pasa al título con `AccessibilityInfo.sendAccessibilityEvent(ref, 'focus')` (la API antigua `setAccessibilityFocus` está *deprecated* en RN 0.86) y el gesto de escape de VoiceOver (`onAccessibilityEscape`) cierra la hoja. El foco **no se atrapa**: Cerrar, Atrás, arrastrar y escape salen.
3. **Reduced motion.** Gorhom ya lee la preferencia del sistema vía Reanimated (`overrideReduceMotion` por defecto `ReduceMotion.System`). Para seguir también la **única fuente de la app** (`useReducedMotionPreference`) se pasa `ReduceMotion.Always` cuando está activa: la hoja salta a su posición sin deslizarse (el *backdrop* también).

**Orden.** Cinco filas `radio` (rol y `checked`: iOS dice "radio button, checked", TalkBack "seleccionado") con la activa marcada con "✓", borde grueso y texto en negrita. Al elegir: se aplica, se cierra la hoja y se anuncia "Orden aplicado: …" (la hoja se va y la etiqueta del botón cambia, pero ninguna de las dos cosas se anuncia sola). El contador ("N productos") es una región viva `polite` y anuncia el nuevo total.

| Idea | React Native (HerbStore) | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Filtros aplicados como entrada de la consulta | `useState<ListParams>` → `toProductQueryArgs` → identidad de RTK Query | `MutableStateFlow<FilterState>` + `flatMapLatest` en el `ViewModel` | `@State var filters` + `.task(id: filters)` |
| Chip seleccionable | `Pressable` + `accessibilityState.selected` | `FilterChip(selected = …)` (semántica `Role.Checkbox`) | `Toggle(...).toggleStyle(.button)` / `.isSelected` |
| Hoja inferior modal | `BottomSheetModal` (portal + Reanimated + Gesture Handler) | `ModalBottomSheet` (ventana propia) | `.sheet` + `.presentationDetents` |
| Atrás | `BackHandler` a mano | `BackHandler`/predictive back de la ventana modal (automático) | no existe: gesto de arrastrar o botón |
| Ocultar el fondo a accesibilidad | `no-hide-descendants` + `accessibilityElementsHidden` | automático (otra ventana) | automático (`.sheet` es modal) |
| Menos movimiento | `useReducedMotionPreference` → `overrideReduceMotion` | `Settings.Global.ANIMATOR_DURATION_SCALE` / `LocalAccessibilityManager` | `@Environment(\.accessibilityReduceMotion)` |

### APIs reales usadas en T10 (documentación oficial y tipos/código de `node_modules`)

| API | Uso | Notas (lo que difiere del plan) |
| --- | --- | --- |
| `BottomSheetModalProvider` (Gorhom 5.2.14) | `_layout.tsx`: tema/i18n → provider → `HiddenWhileSheetOpen` → stack | Renderiza `{children}` y **después** un `PortalHost` hermano: la hoja queda fuera de `HiddenWhileSheetOpen`. |
| `BottomSheetModal` | `ref.present()` / `ref.dismiss()`, `name`, `onChange`, `onDismiss`, `enableDynamicSizing`, `enablePanDownToClose`, `topInset`, `backdropComponent`, `backgroundComponent`, `handleComponent`, `overrideReduceMotion` | `animateOnMount` y `containerHeight` no son configurables en el modal según la doc, aunque el tipo los acepta (se dejan por defecto). `snapPoints` no hace falta con `enableDynamicSizing`. |
| `BottomSheetScrollView` | contenido de la hoja | Con altura dinámica la hoja crece hasta el contenedor y después hace scroll (fuente enorme). El gesto de arrastrar y el scroll interno los arbitra la librería; se valida en el dispositivo. |
| `accessible`, `accessibilityLabel`, `accessibilityRole` (`NullableAccessibilityProps`) | `false` / `null` / `null` | **Diferencia con el plan:** hay que anular los valores por defecto (`adjustable` + "Bottom Sheet"). `accessibilityHint` no existe en las props de la hoja. |
| `BottomSheetBackdrop` | envuelto con `appearsOnIndex={0}`, `disappearsOnIndex={-1}`, `opacity=0.5`, `accessible={false}` | Con **un** solo punto de anclaje los valores por defecto (aparece en 1, desaparece en 0) no oscurecen nunca. Cierra al tocar (`pressBehavior="close"` por defecto). |
| Atrás de Android | `BackHandler.addEventListener('hardwareBackPress', …)` | **Diferencia con el plan:** `enableDismissOnClose` solo decide si el modal se desmonta al cerrarse; **no existe** manejo de Atrás ni un `useBottomSheetBackHandler` exportado en esta versión (comprobado en `src/`). Se hace a mano. |
| `overrideReduceMotion` + `ReduceMotion` (Reanimated 4.5.1) | `Always` si `useReducedMotionPreference()`; si no, `System` | `animate()` de la librería lo aplica a `withTiming`/`withSpring`. `animationConfigs` no hace falta. `animateOnMount` se deja en `true` (con `Always` el salto es inmediato). |
| `AccessibilityInfo.sendAccessibilityEvent(ref, 'focus')` | foco al título al asentarse la hoja | Tipos RN 0.86: `'click' \| 'focus' \| 'viewHoverEnter'`; `setAccessibilityFocus(reactTag)` está *deprecated*. |
| `onAccessibilityEscape` | cierra la hoja con el gesto de escape de VoiceOver | Solo iOS. |
| `accessibilityRole` `radio` / `radiogroup`, `accessibilityState.checked` | opciones de orden | iOS añade "radio button" y "checked" a `accessibilityValue`; Android usa `RadioButton` y `checked`. |
| `accessibilityState.selected`, `accessibilityRole="button"` (chips) | chips | iOS: trait *selected* ("seleccionado"); Android: `isSelected`. |
| `Pressable`, `ScrollView horizontal` | chips | Sin dependencias nuevas. |

### Decisiones de T10 (RF-3)

- **Hoja de orden: Gorhom `BottomSheetModal` frente a `Modal` de RN o a una ruta `formSheet`.**
  - Elegida: `BottomSheetModal` (stack obligatorio de `AGENTS.md`), envuelto en `AppBottomSheet` para reutilizarlo en T11.
  - Trade-off: provider, peers nativos (Reanimated y Gesture Handler) y tres huecos que cubrir a mano (Atrás, accesibilidad por defecto en inglés, reduced motion).
  - Descartadas: `Modal` de RN (sin detents ni arrastre; Atrás y accesibilidad los daría el sistema, pero habría que reimplementar el gesto) y una ruta `formSheet` de Expo Router (el borrador de T11 se perdería entre rutas y la lista no sabría cuándo se aplica).
- **Filtros: estado local con reductor puro frente a Redux o parámetros de URL.**
  - Elegida: `useState<ListParams>` en la vista + funciones puras.
  - Trade-off: no sobreviven a desmontar la pantalla (la spec no lo pide) y hay que remontar con `key` al cambiar de categoría.
  - Descartados: un *slice* global (estado de cliente que solo usa una pantalla y acoplaría la caché de RTK a la UI) y la URL (rutas tipadas, deep links con parámetros que nadie pidió).
- **Barra de filtros fija sobre la lista frente a dentro del encabezado.**
  - Elegida: fuera de la rama que cambia (cuadrícula, esqueleto, vacío, error).
  - Trade-off: ocupa ~56 dp fijos (más con fuente grande) y no se desplaza con el contenido.
  - Descartada: el encabezado de la cuadrícula, que se desmonta al cambiar la identidad y hace perder el foco de accesibilidad justo tras actuar.
- **Limpiar filtros no toca el orden.**
  - Elegida: `clearFilters` apaga las cuatro banderas (y marcas/subcategorías) y deja `sort` como está.
  - Trade-off: tras limpiar, el orden elegido puede no ser el predeterminado.
  - Descartada: restablecerlo todo con `clearAll` (la spec dice "limpiar búsqueda/filtros" y el orden no es un filtro; saltar a otro orden sin avisar desorienta).
- **Valor de orden inválido: se ignora.** `setSort` devuelve el mismo objeto (el tipo ya lo prohíbe; solo llega con un *cast*). Trade-off: un error silencioso. Descartado: lanzar, que tumbaría la pantalla por un dato que el servidor igualmente rechazaría.
- **Opciones de orden como `radio` + `checked`, chips como `button` + `selected`.** Trade-off: dos vocabularios de estado. Descartado: `selected` en las dos (en iOS un radio sin "radio button" pierde su semántica).
- **Ocultar el fondo con un registro de hojas abiertas.** Trade-off: un wrapper en la raíz y un almacén externo. Descartado: `accessibilityViewIsModal` (solo iOS; en Android dejaría el fondo accesible) y ocultar solo el contenido de la lista (cabecera y tabs seguirían accesibles).
- **Sin tope de fuente para los chips ni para el botón de orden.** La caja crece con el texto (alto mínimo, `maxWidth` y texto que parte entre palabras), así que nada se recorta. Medido en AX5 (iOS) y 2.0 (Android): hizo falta el `maxWidth` también en el botón de orden (ver la corrección F-1/F-2 más abajo) y un tope solo para las filas de la hoja.

**Errores típicos al venir de nativo.** (1) Suponer que la hoja cierra con Atrás: en Gorhom 5 cerraría la pantalla. (2) Dejar la accesibilidad por defecto de la librería (nodos "Bottom Sheet" en inglés, contenido como un único elemento). (3) Poner los controles dentro de la rama de la lista que se desmonta y perder el foco. (4) Olvidar el `key` y arrastrar los filtros de una categoría a otra. (5) Memoizar el `renderItem` o los manejadores "por si acaso" (React Compiler activo, se mide en T15). (6) Cambiar `sort` sin esperar que la lista vuelva a la página 1: ocurre sola porque el orden es parte de la identidad.

### Corrección F-1/F-2 de T10: texto largo con fuente grande (RNF-2)

La validación en dispositivo (Android `font_scale` 2.0, iOS AX5) encontró dos fallos de maquetación con texto muy grande. Los dos se corrigen dentro de T10.

**F-1. "Ordenar: …" no se leía entero.** Causa raíz: el botón de orden vive en la fila de chips, un `ScrollView` **horizontal**, y el contenido de un scroll horizontal **no tiene límite de ancho**. Un `Text` solo parte línea cuando su padre le impone un ancho máximo; aquí el padre dice "todo el que quieras", así que el texto se mide en **una sola línea** (610 px en Android, 573 pt en iOS) y el viewport lo recorta. Los chips ya tenían `maxWidth`, el botón no. Medido: antes, Android 628x109 con "Ordenar: Precio: de menor a mayor" recortado; iOS 573x90 recortado en "Ordenar: Dest". Después: Android 660x184 (dos líneas: "Ordenar: Precio: de / menor a mayor"), iOS 370x161 ("Ordenar: / Destacados"), y con el texto más largo 370x304 (cuatro líneas, por palabras). Escala normal: bordes idénticos a los validados (`[30,166][376,256]`, `[391,166][597,256]`; iOS `large` 195x48).

**El "✓" del chip recortado (Android 2.0) NO es la misma causa.** El texto no está truncado: al seleccionar, el chip gana la marca "✓" y se ensancha (586 → 643 px), pero el `ScrollView` conserva su desplazamiento, así que el final del chip queda fuera del viewport hasta que se desplaza. Es un problema de posición de scroll, no de ancho. No se corrige aquí (haría falta medir cada chip con `onLayout` y llamar a `scrollTo`); queda como seguimiento.

**F-2. "Destacad / os" en la hoja (iOS AX5).** Causa raíz: en una fila `flexDirection: 'row'` el "✓" era un `Text` que **escalaba con la fuente** (42 pt de ancho a AX5, más un `minWidth` y un `gap`) y se llevaba el ancho de la etiqueta. A AX5 "Destacados" mide unos 298 pt y a la etiqueta le quedaban unos 284: una palabra que no cabe se parte por dentro (iOS no tiene otra opción; Android no lo hizo porque su escala máxima es 2.0). Se corrigen las dos causas: (1) la etiqueta pasa a `flex: 1` + `minWidth: 0` y la marca a un hueco de **ancho fijo** (24) con `maxFontSizeMultiplier` 1.5, así la marca nunca quita ancho; (2) la etiqueta lleva `maxFontSizeMultiplier` 2 (`fontScaleLimits.optionLabel`), igual que el precedente `listTitle`: con 2.0 la palabra mide ~190 pt y cabe incluso en un móvil de 320 pt. Después: "Destacados" en una línea, 370x60 pt; filas de 48-66 pt.

**Opciones evaluadas**
- Botón de orden: *Elegida:* `maxWidth` de un viewport (`getFilterItemMaxWidth`, lógica pura con test) para el botón y los chips, y `textAlign: center` en `AppButton`. Trade-off: con el texto más largo en AX5 el botón ocupa 304 pt de 874 (la barra está fija sobre la lista). *Descartadas:* una fila propia a ancho completo (cambia el diseño validado en todas las escalas y gasta altura siempre); `fontScaleLimits` en el botón (la etiqueta dejaría de escalar con lo que pide el usuario).
- Hoja: *Elegida:* arreglar el layout (flex, hueco fijo) **y** topar la etiqueta en 2. Trade-off: en iOS AX5 las opciones se ven a 2x en vez de a 3.1x (en Android no cambia). *Descartada:* arreglar solo el layout: con el hueco fijo la etiqueta queda con ~302 pt para una palabra de ~298, un margen de 4 pt que rompe en cuanto la pantalla sea más estrecha.

| Idea | React Native | Android (Compose) | iOS (SwiftUI) |
| --- | --- | --- | --- |
| Texto que parte línea en una fila desplazable | `maxWidth` explícito al elemento (el scroll horizontal no limita el ancho) | `Modifier.widthIn(max = …)`; un `Text` con `softWrap = true` parte | `.frame(maxWidth:)` + `.fixedSize(horizontal: false, vertical: true)`; `lineLimit(nil)` |
| Etiqueta que toma el espacio sobrante | `flex: 1` + `minWidth: 0` | `Modifier.weight(1f)` | `.layoutPriority(1)` / `Spacer` + texto flexible |
| Indicador de ancho fijo | `View` con `width` y `maxFontSizeMultiplier` | `Box(Modifier.size(24.dp))` | `.frame(width: 24)` y `.dynamicTypeSize(...DynamicTypeSize.xxxLarge)` |
| Tope de escala de texto | `maxFontSizeMultiplier` (`fontScaleLimits`) | no hay tope por `Text`; se limita `fontScale` en `LocalDensity` | `.dynamicTypeSize(...size)` |

**Error típico al venir de nativo:** suponer que `Text` parte línea sin más. En RN depende de que algún ancestro dé un ancho; dentro de un scroll horizontal no lo hay.

### Registro de T10

- Lógica con test primero: `list-params.ts` (toggle de cada bandera, `setSort` con los cinco valores y rechazo de inválidos, `clearFilters`, conversión a `ProductQueryArgs`, `describeParamsForLog`), `describeQueryForLog` (en `product-query.ts`) y `modal-sheet-registry.ts`. 434 → 469 tests.
- Archivos nuevos: `product/logic/list-params.ts` (+test), `product/list/{QuickFilters,SortSheet}.tsx`, `design-system/components/AppBottomSheet.tsx`, `core/accessibility/{modal-sheet-registry.ts (+test),HiddenWhileSheetOpen.tsx}`. Modificados: `_layout.tsx` (provider), `ProductListView.tsx` (estado local, barra de filtros, hoja), `ProductListStatus.tsx` (vacío filtrado), `use-product-list.ts` (recibe `ProductQueryArgs`), `products-api.ts` (log de la consulta), `CategoryProductsScreen.tsx` (`key`), `AppText.tsx` (tipo del `ref`), `design-system/index.ts`, textos es/en. Sin dependencias nuevas ni cambios nativos.
- **Logs `__DEV__`** (sin datos de usuario ni texto de búsqueda): al cambiar algo, `[products] filters inStock,topRated sort=price_asc`; por cada página pedida, la **consulta normalizada** `[products] query category=vitamins inStock=true minRating=4 sort=featured page=1` (el log `[api]` omite la query a propósito). Para la comprobación "cada chip envía exactamente…": `inStock=true`, `minRating=4`, `ownBrand=true`, `subscribeAndSave=true`.
- **Comprobación con un store real + el mock (fuera del repo, borrada).** `vitamins` (60): `inStock` 55, `minRating=4` 22, `ownBrand` 7, `subscribeAndSave` 40; acumulando `+inStock` 55, `+topRated` 19, `+ownBrand` 2, `+subscribeAndSave` 1. Los cinco `sort` devuelven 60 con el orden esperado (precio ascendente 8.99…, descendente 42.99…, `rating` 5, 5, 5, 4.9…). Ninguna combinación de las cuatro banderas deja una categoría real en cero (el mínimo es 1): el vacío con filtros se provoca con una categoría de forma válida que no existe (`does-not-exist`: total 0).
- Corrección F-1/F-2 (fuente grande): `product/logic/filter-bar-layout.ts` (+test, 469 → 472), `QuickFilters.tsx`, `SortSheet.tsx`, `AppButton.tsx`, `tokens.ts`. Sin dependencias ni cambios nativos.
- Estado: **validada y aprobada por el usuario (2026-10-11)** en Samsung SM-A037M (Android) e iPhone 17 Pro (iOS), incluida la corrección F-1/F-2. Seguimientos fuera de T10: F-3, F-4, VoiceOver real (Día 6) y el scroll del chip seleccionado en Android 2.0.

### Bloque T11 — Borrador frente a aplicado, facets OR/AND y una hoja con botones fijos (≈10 min)

**Dos estados, dos tiempos de vida.** El filtro *aplicado* (`ListParams`, en `ProductListView`) es la entrada de la consulta: cambiarlo cambia la identidad de RTK Query y dispara una petición. Lo que el usuario marca dentro de la hoja es un *borrador*: una copia local que **no** toca la consulta. Solo **Aplicar** lo convierte en estado aplicado (`applyAdvancedFilters`); **Cancelar, Cerrar, el gesto de arrastre, Atrás de Android y el backdrop** simplemente cierran: el borrador se tira y no hay petición. No existe una función "cancelar" porque cancelar es *no llamar a aplicar*. La clave del diseño es **dónde vive el borrador**: en `AdvancedFiltersForm`, un componente que solo está montado mientras la hoja está abierta (el modal desmonta su contenido al cerrarse). Al abrirla otra vez se monta un formulario nuevo cuyo borrador arranca como copia de lo aplicado *en ese momento*; descartar no requiere código. Es el patrón de un diálogo con copia local: en Compose, `ModalBottomSheet` + `remember { mutableStateOf(applied) }` y un botón que llama a `onApply(draft)`; en SwiftUI, `.sheet` con `@State private var draft = applied` que se devuelve desde "Aplicar" (o `@Binding` solo si quieres aplicar al instante).

**Facets: OR dentro, AND entre ellos.** "Solstice Grove **o** Juniper Axis" y "Vitamina C", a la vez, significa (marca A o marca B) **y** subcategoría C. El servidor (`query-products.js`) construye un `Set` por facet con el CSV de `brand` y de `subcategory`, y un producto debe estar en todos los facets presentes. Comprobado: el servidor normaliza cada valor con la misma `normalizeText` que el cliente (NFD sin marcas, minúsculas, espacios colapsados) y rechaza con 400 un CSV con valores vacíos. Por eso el cliente envía los valores **normalizados, sin repetidos y ordenados** (`buildProductQueryArgs`): `brand=juniper%20axis,solstice%20grove`. Marcar "Solstice, Juniper" o "Juniper, Solstice" produce **la misma cadena**, la misma identidad y **una sola** entrada de caché y de petición: es la "consulta equivalente" de la spec. En el estado aplicado se guardan los valores tal como los devuelve `GET /brands` y `GET /categories` (así comparar "¿está marcada?" es una igualdad exacta); la normalización ocurre solo al construir la consulta.

**Una hoja alta con botones que no se van con el scroll.** La lista de opciones puede ser larga (8 marcas + 3 subcategorías por categoría, 15 subcategorías en búsqueda, más con fuente grande) y Aplicar/Cancelar deben verse siempre. La hoja de orden (T10) usa altura dinámica: título, botón y contenido **hacen scroll juntos** dentro de un `BottomSheetScrollView`, así que unos botones al final quedarían fuera de la pantalla. `AppBottomSheet` gana `layout="fixed"`: altura constante (90 % del espacio bajo la barra de estado), el título arriba y el cuerpo es una columna `flex: 1` con un `AppBottomSheetScrollView` (el de Gorhom, reexportado) y, debajo, la barra de acciones. El gesto lo resuelve la librería: el `BottomSheetScrollView` se registra como el desplazable de la hoja, así que arrastrar con la lista arriba cierra la hoja y arrastrar con la lista desplazada hace scroll (un `ScrollView` normal pelearía por el toque). La cuadrícula de detrás no compite: la hoja es un modal con backdrop, y mientras está abierta el fondo está oculto a TalkBack/VoiceOver (`HiddenWhileSheetOpen`).

**Filas de checkbox.** `Pressable` con `accessibilityRole="checkbox"` y `accessibilityState={{ checked }}`: es la forma que RN traduce al estado de casilla de cada plataforma (en T10 ya se comprobó el equivalente con `radio`); el texto exacto que dicen TalkBack y VoiceOver **se confirma en la validación en dispositivo**. Además se ve **sin color**: borde grueso, texto en negrita y "✓" (oculto a los lectores, el estado ya lo dice). Se reutiliza la maquetación que arregló F-2: etiqueta `flex: 1` + `minWidth: 0`, hueco fijo para el "✓" y `fontScaleLimits.optionLabel`/`selectionMark`. Los dos botones van en una fila (mitad cada uno) y pasan a columna cuando media fila no cabe (corrección G-1, más abajo; el `flexWrap` con `flexBasis: 120` de la primera versión no envolvía nunca y partía palabras). Aplicar es `variant="primary"` (relleno **sin** estado `selected`, que se anunciaría y no es cierto de una acción).

**El contador del botón.** "Filtros (2)" cuenta **marcas + subcategorías** (lo que edita la hoja). Los cuatro filtros rápidos **no** cuentan: ya muestran su estado seleccionado como chips en la misma barra, y un número que los incluyera no coincidiría con lo que el usuario encuentra al abrir la hoja (abrir con "3 activos" y ver una sola marca marcada desorienta). El texto dibujado es "Filtros (2)" y el hablado "Filtros, 2 activos" (`accessibilityLabel`), y con cero filtros solo "Filtros". Con filtros activos el botón se rellena, pero el número ya lo dice, así que no depende del color. "Limpiar filtros" (T10) sí vacía marcas y subcategorías y no toca el orden.

| Idea | React Native (HerbStore) | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Borrador frente a aplicado | Estado local del formulario de la hoja; `applyAdvancedFilters(applied, draft)` | `remember { mutableStateOf(applied) }` en el contenido del `ModalBottomSheet`; `onApply(draft)` | `@State var draft = applied` en el `.sheet`; se devuelve desde "Aplicar" |
| Descartar | Cerrar sin llamar a aplicar; el formulario se desmonta | `onDismissRequest` sin llamar a `onApply` | `dismiss()` sin escribir en el estado del padre |
| Facets OR/AND | `Set` por facet en el servidor; CSV ordenado en el cliente | `filter { brands.isEmpty() \|\| it.brand in brands }` encadenado por facet | `filter { brands.isEmpty \|\| brands.contains($0.brand) }` |
| Casilla accesible | `Pressable` + `role=checkbox` + `checked` | `Modifier.toggleable(value, role = Role.Checkbox)` | `Toggle` / `Button` + `.accessibilityAddTraits(.isSelected)` |
| Botones siempre visibles en una hoja con lista | `layout="fixed"`: scroll `flex: 1` + barra debajo | `Scaffold`/`Column` con `weight(1f)` en la lista y la barra fuera | `List` + `.safeAreaInset(edge: .bottom)` |
| Scroll dentro de una hoja arrastrable | `BottomSheetScrollView` (comparte el toque con el arrastre) | `nestedScroll` del `ModalBottomSheet` (automático) | `ScrollView` en un `.sheet` (el sistema lo arbitra) |

### APIs reales usadas en T11 (documentación oficial y tipos/código de `node_modules`)

| API | Uso | Notas |
| --- | --- | --- |
| `BottomSheetModal` `snapPoints` + `enableDynamicSizing={false}` (Gorhom 5.2.14) | altura constante del layout `fixed` | Los porcentajes son del contenedor menos `topInset` (`normalizeSnapPoint`). El contenido recibe una altura definida, por eso `flex: 1` funciona. |
| `BottomSheetScrollView` | área de scroll de opciones | Se registra como desplazable de la hoja (`animatedScrollableState`), con independencia de si es hijo directo. `styles.container` ya es `flex: 1`. |
| `enableContentPanningGesture` | no se toca (por defecto `true`) | Con el scroll registrado, el arrastre de contenido y el scroll se reparten el toque; desactivarlo impediría cerrar arrastrando desde la barra de acciones. |
| `footerComponent` + `enableFooterMarginAdjustment` | **descartado** | Existe y es la vía "oficial" para un pie, pero la hoja se pinta en un portal: el contexto de `AppBottomSheet` no llega al pie, y un componente creado en cada render se **remonta** con cada casilla. |
| `useGetBrandsQuery` / `useGetCategoriesQuery` (T7) | opciones, pedidas al abrir | Caché de 300 s; la segunda apertura las muestra al instante. |
| `accessibilityRole="checkbox"` + `accessibilityState.checked` | filas | iOS/Android lo anuncian de forma nativa. |

### Decisiones de T11 (RF-3)

- **Borrador + Aplicar frente a aplicar al instante.**
  - Elegida: borrador local; la consulta cambia solo con Aplicar (RF-14: "Cancelar conserva los filtros anteriores").
  - Trade-off: un toque más, y el usuario no ve el efecto de cada casilla hasta aplicar (la hoja no muestra totales).
  - Descartada: aplicar cada casilla al instante (como los chips): cada toque sería una petición nueva, "Cancelar" no tendría sentido y la lista de detrás se reajustaría mientras el usuario aún elige.
- **Casillas dentro de una hoja frente a una pantalla modal propia.**
  - Elegida: hoja (`AppBottomSheet` `fixed`), reutilizando Atrás, accesibilidad y reduced motion de T10.
  - Trade-off: altura fija del 90 % aunque haya pocas opciones.
  - Descartada: una ruta `modal` de Expo Router (el borrador viviría entre rutas o en la URL, y la lista tendría que enterarse de cuándo se aplica) y un `Modal` de RN (reimplementar gesto y detents).
- **Botones fuera del scroll mediante layout fijo frente a `footerComponent` de Gorhom o a una cabecera pegajosa.**
  - Elegida: columna `flex` con scroll y barra, sin API de pie.
  - Trade-off: la hoja es siempre alta; el layout `content` de T10 se queda para hojas cortas.
  - Descartadas: `footerComponent` (portal y remontaje, ver tabla) y `stickyHeaderIndices` (Aplicar arriba no es el patrón de Material y obliga a quitar el padding lateral del contenido para tapar el scroll).
- **El borrador vive en un componente que solo existe con la hoja abierta.** Trade-off: el estado "se pierde" al cerrar, que es justo lo que se quiere. Descartado: guardarlo en `ProductListView` y resetearlo a mano en cada apertura (un `useEffect` para sincronizar, que React 19 desaconseja).
- **Opciones pedidas al abrir, no al montar la pantalla.** Trade-off: la primera apertura muestra "Cargando opciones…" un instante. Descartado: pedirlas con la lista (dos peticiones por cada categoría que nadie usa).
- **Contador = marcas + subcategorías** (ver arriba). Descartado: contar también los cuatro chips.
- **Etiqueta de subcategoría:** traducción propia de las 15 conocidas (`subcategoryLabelKey`); cualquier otra id muestra el `name` que envió el servidor. Descartado: construir la clave desde cualquier id (un id como `constructor` o `vitamin-e` devolvería una clave inexistente).
- **Sin totales por opción** (`productCount` de `/brands` es global, no del filtro actual): un número que no coincide con el resultado confunde más de lo que ayuda.

**Errores típicos al venir de nativo.** (1) Aplicar cada casilla a la consulta y dejar "Cancelar" sin efecto real. (2) Guardar el borrador en el padre y olvidar reiniciarlo: la segunda apertura mostraría restos de la primera. (3) Un `ScrollView` normal dentro de una hoja arrastrable: el gesto de la hoja y el scroll compiten. (4) Poner los botones al final de un contenido que hace scroll. (5) Enviar el CSV sin ordenar: "a,b" y "b,a" serían dos entradas de caché. (6) Modificar el array aplicado al marcar una casilla (`push`): el estado aplicado cambiaría sin pasar por Aplicar.

### Corrección G-1 de T11: botones y encabezados con texto muy grande (RNF-2)

La validación en iOS (`accessibility-extra-extra-extra-large`, AX5) mostró palabras partidas por dentro en la hoja de filtros: "Canc / elar" y "Aplic / ar" en dos botones circulares de 181x161 pt, y "Subcategorías" en dos líneas de 186 pt con el fragmento "ías". Android a `font_scale` 2.0 no lo hacía. Se corrige dentro de T11.

**Causa raíz (medida con `onTextLayout` y `useWindowDimensions`, no supuesta).** A AX5 `fontScale` vale 3,571 en iOS (en Android 2.0 es el máximo). Una palabra que no cabe en su línea la parte la plataforma por dentro, porque no tiene otro sitio donde cortar. Anchos medidos (una línea, sin límite de ancho):

| Texto | em | iOS AX5 (pt) | Android 2.0 (dp) | Ancho disponible |
| --- | --- | --- | --- | --- |
| "Cancelar" (label 16) | 4,00 / 3,97 | 228,5 | 126,9 | media fila: 181 − 2 de borde − 32 de padding = 147 pt (iOS) y 172 − 34 = 138 dp (Android) |
| "Aplicar" | 3,14 | 179,5 | 101,0 | idem |
| "Subcategorías" (subheading 20) | 6,43 | 459,4 | 259,0 | 370 pt (iOS) y 352 dp (Android) |

En iOS la palabra no cabía ni en media fila (229 > 147) ni en el encabezado (459 > 370). En Android 2.0 cabe: por eso no se veía allí (126,9 ≤ 138, con 11 dp de margen). Además, la fila tenía `flexBasis: 120` con `flexGrow`: **nunca envolvía** (dos bases de 120 caben en 338) y cada botón se quedaba en 181 pt, así que el `flexWrap` no ayudaba. Un `Text` no hace *shrink* por debajo de su palabra más larga solo si el padre le deja ancho; aquí el padre (media fila) se lo negaba.

**Opciones.**
- **Elegida: (b) tope de escala para etiquetas de acción y encabezados de sección + (a) apilar solo si no caben.** `fontScaleLimits.actionLabel` y `sectionHeading` = 2 (el máximo de Android, como `listTitle` y `optionLabel`). Con 2,0, "Cancelar" mide 128 pt (cabe en media fila a partir de 384 pt de ventana) y "Subcategorías" 259 pt (cabe en 320 pt). `shouldStackActions` (función pura en `logic/action-bar-layout.ts`, con test primero) compara `16 × min(fontScale, tope) × 4,0 + 34` con la media fila: si no cabe, los botones van uno sobre otro a ancho completo, donde siempre caben. Trade-off: las etiquetas de **esos** botones y esos dos encabezados no siguen creciendo por encima de 2,0 (a AX5 el usuario pedía 3,57); el cuerpo, las filas ya estaban topadas a 2 por F-2, y los botones siguen ≥ 48 pt. La estimación del ancho es una constante medida (`ACTION_LABEL_WIDTH_EM`), no una medición en vivo: es lo que hace la función comprobable sin RN; el riesgo es una fuente distinta a SF/Roboto.
- **Descartada (a) sola: apilar sin tope.** Quita la palabra partida, pero a AX5 cada botón mide ~90 pt: la barra pasa de 161 a 188 pt y la lista se queda en ~2 filas (inutilizable).
- **Descartada (c) `flexShrink`/`flex: 1` en el encabezado sin tope:** el problema no es el hueco, es que la palabra mide más que la pantalla; sin tope solo cabría con menos fuente.
- **Descartada (d) menos padding/hueco:** ahorra ~10 pt de 229; no cambia nada.
- **No tocado:** la hoja de orden (sus palabras sí caben: sin evidencia) ni la cabecera "Filtros / Cerrar" (queda apilada a AX5, 191 pt, pero sin palabras partidas).

**Resultado medido.**

| Medida | Antes (AX5) | Después (AX5) | `large` / Android 1.0 | Android 2.0 |
| --- | --- | --- | --- | --- |
| Cancelar / Aplicar | 181x161 pt, partidos | 181x58 pt, una línea | 181x48 pt / 323x90 y 322x90 px (igual que lo validado) | 323x93 y 322x93 px (igual) |
| Barra de acciones | 161 pt | 58 pt | 48 pt | sin cambios |
| Encabezados "Marcas" / "Subcategorías" | 93 y 186 pt (partido) | 52 pt, una línea | 26 pt / 49 px | sin cambios |
| Filas visibles con la lista arriba | ~2,5 | 4 completas + una parcial | todas las marcas | — |
| Cabecera "Filtros" + "Cerrar" | 191 pt | 191 pt (sin cambio) | una fila | una fila |

Además se forzó la rama apilada en el Samsung con `wm size 600x1600` (320 dp) a 2.0: "Cancelar" y "Aplicar" a ancho completo (540 px), sin palabras partidas. Se restauró el tamaño de pantalla.

**Concepto y comparación.** Cuando un control no cabe a escala grande hay tres respuestas: encoger el texto (tope), cambiar la disposición (fila → columna) o dejar que el texto parta (aquí prohibido por RNF-2). En Compose la disposición adaptativa es `FlowRow` o un `Layout`/`SubcomposeLayout` que mide primero (`BoxWithConstraints` + `LocalDensity.current.fontScale`), y el tope es `TextStyle`/`sp` con un `coerceAtMost` sobre `fontScale`; `softWrap = false` no es opción: recorta. En SwiftUI es `ViewThatFits` (prueba la fila y, si no cabe, la columna) o `@Environment(\.dynamicTypeSize)` con `dynamicTypeSize.isAccessibilitySize ? AnyLayout(VStackLayout()) : AnyLayout(HStackLayout())`, y el tope es `.dynamicTypeSize(...DynamicTypeSize.xxxLarge)`. Ellos miden de verdad; en RN decidimos con una función pura sobre `fontScale` y el ancho de ventana (`useWindowDimensions`), más simple y comprobable pero con una estimación del ancho. **Error típico al venir de nativo:** creer que `flexWrap` + `flexBasis` envuelve por "lo que cabe de texto": envuelve por la base declarada, no por el contenido mínimo de una palabra.

### Registro de T11

- Lógica con test primero: `list-params.ts` (`applyAdvancedFilters`: reemplaza, no muta, conserva orden y chips, devuelve el mismo objeto si no cambia; `toggleFacetValue`; `countAdvancedFilters`; `clearFilters` con facets; log solo con recuentos), `category-labels.ts` (`subcategoryLabelKey` con las 15 y `undefined` para el resto, incluidos nombres de prototipo), `facet-options.ts` (`selectSubcategoryOptions`: las de la categoría o todas, sin repetidas, vacío para una categoría desconocida). 472 → 497 tests (G-1: 504).
- Archivos nuevos: `product/list/AdvancedFiltersSheet.tsx`, `product/logic/facet-options.ts` (+test). Modificados: `list-params.ts` (+test), `category-labels.ts` (+test), `ProductListView.tsx` (botón, hoja, aplicar), `QuickFilters.tsx` (`leading` como lista con `key`), `design-system/components/{AppBottomSheet,AppButton}.tsx` (`layout="fixed"` y `AppBottomSheetScrollView`; `accessibilityLabel` y `variant="primary"`), `design-system/index.ts`, textos es/en (`productList.advanced.*`, `subcategories.*`). Sin dependencias nuevas ni cambios nativos.
- **Smoke con el mock (puerto 3001, sin latencia; script fuera del repo que usa el código real de `list-params`/`product-query`).** `vitamins` (60, 3 páginas): una marca (`brand=solstice%20grove`) 3; dos marcas (`brand=juniper%20axis,solstice%20grove`) 9, **igual con el orden invertido** (misma cadena); una subcategoría (`vitamin-c`) 20; dos subcategorías 40 (2 páginas); dos marcas + `vitamin-c` 2; ese mismo con `inStock` + `minRating=4` 0. Sin categoría: una marca 43 (3 páginas), las ocho marcas 300 (15 páginas), `zinc,omegas` 40. Cada categoría tiene **8 marcas** y **3 subcategorías** (15 en búsqueda): la lista cabe sin problema, el scroll solo hace falta con fuente grande. De 120 combinaciones marca × subcategoría en categorías reales, **7 dan 0**: **Vitaminas + Solstice Grove + Vitamina C** (Solstice solo 3, Vitamina C sola 20), Minerales + BloomArc Wellness + Magnesio o Calcio, Proteínas + MossPeak Formulas + Proteína vegetal, Botánicos + HerbStore Essentials + Mezclas herbales, Bienestar + Verdant Forge + Probióticos o Omegas. Con las cuatro banderas, AsterVale Nutrition da 0 en las cinco categorías.
- Corrección G-1 (texto muy grande): `product/logic/action-bar-layout.ts` (+test, 497 → 504), `AdvancedFiltersSheet.tsx`, `AppButton.tsx` (`maxFontSizeMultiplier`), `tokens.ts` (`actionLabel`, `sectionHeading`). Sin dependencias ni cambios nativos.
- Estado: **validada y aprobada por el usuario (2026-10-12), con G-1 corregido.** Validada en Samsung e iPhone 17 Pro (simulador) salvo el foco/anuncio de TalkBack y VoiceOver real (seguimientos G-2/G-3 y Día 6).

## Día 3 — T12: búsqueda con debounce e historial en memoria

### Bloque T12 — Debounce, cancelación por identidad e historial como estado de cliente (≈10 min)

**Debounce = esperar a que el usuario deje de teclear.** Sin él, "vitamina" lanzaría 8 peticiones (una por letra) y solo la última importa. El debounce retrasa la consulta hasta que el texto lleva 400 ms quieto (RF-16). En HerbStore son dos valores: `text` (lo que hay en el campo, cambia en cada tecla) y `debounced` (`text` después de 400 ms de calma). Una función pura, `resolveSearchView({ rawText, debouncedText })`, decide qué se ve comparando sus formas normalizadas:

| Campo (`rawText`) | Texto asentado (`debouncedText`) | Vista |
| --- | --- | --- |
| vacío o solo espacios | cualquiera (aunque aún conserve el texto borrado) | `history` (sin consulta) |
| "vita" | "vit" | `pending` (no se consulta; esqueleto) |
| "v" | "" (primeras teclas) | `pending` |
| "Vitamina " | "Vitamina" | `query { q: 'vitamina' }` (misma identidad: añadir un espacio o una mayúscula no es otra búsqueda) |

**El hook.** `useDebouncedValue(text)` es un `useEffect` que instala un `setTimeout` de 400 ms y devuelve en el *cleanup* el `clearTimeout`. Cada cambio de `text` vuelve a ejecutar el efecto: el cleanup cancela el temporizador anterior antes de crear el nuevo, así que **solo existe uno** y siempre lleva el último texto; al desmontar también se cancela (no hay fugas ni `setState` sobre una pantalla muerta). El número 400 vive en un solo sitio (`SEARCH_DEBOUNCE_MS`, en `search-view.ts`). El hook devuelve también `settleNow(texto)` para "enviar": al pulsar la tecla de buscar no tiene sentido esperar.

**Resultados antiguos nunca sustituyen a la búsqueda más reciente.** Hay dos defensas independientes, y ninguna es el debounce:
1. *Mientras `pending`, la lista está pausada*: `ProductListView` sigue montada (así sobreviven los filtros) pero `useProductList` pasa `skipToken` a RTK Query. No hay petición, `currentData` es `undefined` y se ve el esqueleto.
2. *Una entrada de caché por texto normalizado*: la respuesta tardía de "vit" se guarda bajo "vit" y la pantalla de "vitam" lee **`currentData`** de su propia entrada. Con `data` (que RTK conserva del argumento anterior mientras carga el nuevo) se vería la lista de "vit" bajo el título de "vitam".

**Qué cuenta como "enviar" (RF-17).** Tres gestos escriben en el historial: la tecla de buscar del teclado, ejecutar una entrada del historial y tocar un resultado. Teclear sin enviar **no** escribe: "vit" a medias no es una búsqueda. El texto guardado es la variante humana más reciente ("vitamina  c", solo con los espacios exteriores recortados); la forma normalizada ("vitamina c") es solo la clave de identidad. Guardar la normalizada como texto visible sería el error típico: el usuario vería "vitamina c" donde escribió "Vitamina C".

**Historial = estado de cliente, en el store global.** Es una lista de strings que sobrevive a salir y volver a la pantalla (el store es global, no el componente) y que el Día 4 solo añade a la whitelist de redux-persist. Las reglas (identidad, mover al inicio, máximo 10, nunca vacío, no mutar) viven en `search-history.ts`, puro y probado; el *slice* únicamente delega.

**Qué se ve en cada caso.**
- Campo vacío: historial (ejecutar, quitar una entrada con una etiqueta que lleva su texto, "Borrar todo"); si no hay nada, un texto que lo explica.
- Texto: esqueleto hasta los 400 ms, luego `ProductListView` con contador, filtros rápidos, avanzados (15 subcategorías sin categoría) y orden. Cambiar el texto devuelve a la página 1 y arriba (la `key` de identidad de la cuadrícula).
- Sin coincidencias: vacío con **una** acción. Sin filtros, "Limpiar búsqueda" (borra el texto, enfoca el campo y vuelve al historial). Con filtros, "Limpiar búsqueda y filtros" (el plan pide que en búsqueda la acción limpie texto y filtros a la vez; al salir de la vista de resultados la lista se desmonta y con ella sus filtros). Los chips de filtros siguen visibles en ambos casos.
- Teclado: `keyboardDismissMode="on-drag"` lo cierra al arrastrar; `keyboardShouldPersistTaps="handled"` deja que el primer toque llegue a la tarjeta; `automaticallyAdjustKeyboardInsets` (iOS) empuja el contenido en vez de taparlo y Android ya reduce la ventana (`adjustResize`). Antes de abrir una hoja (orden/filtros) se cierra el teclado.

| Idea | React Native (HerbStore) | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Debounce | `useEffect` + `setTimeout` con `clearTimeout` en el cleanup | `snapshotFlow { text }.debounce(400)` o `query.debounce(400)` en el `ViewModel` | Combine `.debounce(for: .milliseconds(400), scheduler:)` |
| Ignorar repetidos | `resolveSearchView` compara formas normalizadas | `.distinctUntilChanged()` | `.removeDuplicates()` |
| Solo cuenta la última | `skipToken` mientras `pending` + una entrada de caché por texto + `currentData` | `flatMapLatest { repo.search(it) }` / `collectLatest` (cancela la anterior) | `switchToLatest()` o `.task(id: text)` (se cancela al cambiar el id) |
| Campo de búsqueda | `TextInput` en el contenido con `returnKeyType="search"` | `SearchBar`/`OutlinedTextField` con `ImeAction.Search` y `KeyboardActions(onSearch)` | `TextField` + `.submitLabel(.search)` + `.onSubmit`; o `.searchable` |
| Historial | slice de Redux (luego redux-persist + MMKV) | `StateFlow` en un repositorio (luego DataStore) | `@Observable` inyectado (luego `UserDefaults`/`@AppStorage`) |

### Decisiones de T12 (RF-3)

- **Debounce propio con `setTimeout` frente a una librería o a `useDeferredValue`.**
  - Elegido: `useDebouncedValue` (10 líneas, sin dependencia; constitución, punto 1).
  - Trade-off: hay que escribir y razonar el cleanup uno mismo; sin cancelación de peticiones por ser solo un temporizador.
  - Descartados: `lodash.debounce` (dependencia nueva, y su función con estado sobrevive a los renders: hay que guardarla en un ref) y `useDeferredValue` (retrasa por *prioridad de render*, no por tiempo: no daría el "400 ms desde la última tecla" medible de RF-16 y seguiría pidiendo cada letra).
- **Campo en el contenido frente a `headerSearchBarOptions`.**
  - Elegido: `TextInput` propio. Trade-off: no es la barra nativa (ni la animación de colapso de iOS ni el botón "Cancelar" nativo).
  - Descartada: la barra nativa del header, con foco y vaciado distintos por plataforma y menos control para mostrar el historial con el campo vacío.
- **Guardar al enviar o tocar un resultado frente a guardar en cada pulsación.**
  - Elegido: RF-17. Trade-off: una búsqueda a la que el usuario no llegó a dar a buscar, ni tocar un resultado, no queda en el historial.
  - Descartado: escribir cada texto asentado: el historial se llenaría de "vit", "vita", "vitam".
- **Slice de Redux frente a estado local.**
  - Elegido: slice global (sobrevive a la pantalla; el Día 4 lo persiste sin tocar las reglas). Trade-off: Redux de cliente adelantado un día.
  - Descartado: `useState` en `SearchScreen` (se pierde al salir de la pantalla, que RF-18 y el criterio de T12 piden evitar) y un store externo temporal que el Día 4 tiraría.
- **`ProductListView` montada también en `pending`, con `paused`, frente a montar el esqueleto aparte.**
  - Elegido: la vista sigue montada desde el primer carácter hasta vaciar el campo; así la barra de filtros no parpadea con cada tecla y los filtros y el orden sobreviven a editar el texto. Trade-off: una prop nueva (`paused`) y `skipToken` en `useProductList`.
  - Descartado: desmontar la lista en `pending` (los filtros se reiniciarían con cada edición y la barra parpadearía).
- **Una sola acción "Limpiar búsqueda (y filtros)" en el vacío de la búsqueda.** Trade-off: no se puede quitar solo los filtros desde el vacío (se hace con los chips, que siguen visibles). Descartada: dos acciones, que contradicen "una sola acción" de la spec y el plan.
- **Identidad del historial con `normalizeSearchText`** (la misma definición que el servidor y la consulta; no se duplica). Descartado: una normalización propia del historial, que podría divergir.
- **Texto visible = lo escrito con los espacios exteriores recortados.** Descartado: colapsar también los interiores, que cambiaría lo que el usuario escribió.
- **Historial visible con el campo vacío aunque no tenga foco.** La spec dice "cuando el campo vacío obtiene foco"; el foco es condición suficiente. Mostrarlo también sin foco evita que, tras cerrar el teclado, una pantalla vacía parezca rota. Descartado: ocultarlo sin foco (exigiría seguir `onFocus`/`onBlur` y una pantalla en blanco).

**Errores típicos al venir de nativo.** (1) Olvidar el *cleanup* del `setTimeout`: cada tecla dejaría un temporizador vivo y se dispararían todas las búsquedas. (2) *Stale closure*: el callback del temporizador usa el `value` del render que lo creó; es lo deseado aquí, pero en un handler que se registra una vez (suscripción, `useEffectEvent` mal usado) leería un texto viejo. (3) Leer `data` en lugar de `currentData`: aparecen resultados de otro texto bajo el título nuevo. (4) Guardar la forma normalizada como texto del historial. (5) Escribir el historial en cada pulsación. (6) Consultar con el texto vacío: el servidor responde 400. (7) Un `ScrollView` sin `keyboardShouldPersistTaps="handled"`: el primer toque sobre una tarjeta solo cierra el teclado. (8) Ejecutar una entrada del historial solo con `setText`: habría que esperar 400 ms más; hay que "asentar" ya (`settleNow`).

### APIs reales usadas en T12 (tipos y código de `node_modules`)

| API | Uso | Notas |
| --- | --- | --- |
| `skipToken` con `useGetProductsInfiniteQuery` | pausar la lista mientras `pending` | Sin petición, `currentData` es `undefined`; `fulfilledTimeStamp` también, así que la revalidación de 60 s no actúa. |
| `FlashListProps extends Omit<ScrollViewProps, ...>` (FlashList 2.0.2) | `keyboardDismissMode`, `keyboardShouldPersistTaps`, `automaticallyAdjustKeyboardInsets` | Pasan tal cual: no hizo falta ninguna prop nueva en `ProductGrid`; el `ScrollView` de los estados y el del historial reciben las mismas. |
| `TextInput`: `returnKeyType`, `onSubmitEditing`, `accessibilityRole="search"`, `keyboardAppearance` (solo iOS), `maxFontSizeMultiplier` | el campo | `autoFocus` abre el teclado al entrar desde Inicio. `maxLength` 100 evita consultas absurdas (el servidor acepta hasta 5000 caracteres sin error). |
| `createSlice` + `current(state)` | reductores que **devuelven** el siguiente estado | Las funciones puras ya construyen el array nuevo; no se edita el *draft* de Immer. Comprobado con un store real fuera del repo: alta, duplicado, quitar, 12 altas = 10 entradas y borrar todo. |

### Registro de T12

- Lógica con test primero: `search/logic/search-history.ts` (+test) y `search/logic/search-view.ts` (+test). 504 → 537 tests (+33), `test:logic` en verde.
- Archivos nuevos: `search/logic/{search-history,search-view}.ts` (+tests), `search/store/search-history-slice.ts`, `search/hooks/use-debounced-value.ts`, `search/components/{SearchField,SearchHistoryList}.tsx`, `search/screens/SearchScreen.tsx`. Modificados: `core/store/store.ts` (reductor `searchHistory`), `product/list/{ProductListView,ProductListStatus,ProductGrid,use-product-list}`, `(tabs)/(home)/search.tsx` (ruta delgada), textos es/en (`search.*`, sin `search.body`). Borrado: `SearchPlaceholderScreen.tsx`. Sin dependencias nuevas ni cambios nativos.
- Cómo se llega: el campo de búsqueda de Inicio (`HomeHeader`) hace `router.push('/search')`; la ruta ya existía en el `Stack` de Inicio (singular). También por el enlace `herbstore://search`.
- **Smoke con el mock (puerto 3001, sin latencia; script fuera del repo con el código real de `product-query`/`search-view`).** El catálogo es **solo inglés** y todas las descripciones empiezan "<nombre> in a <formato> format for a simple daily wellness routine". Con `q`: marca "solstice" **43** (3 páginas; "SOLSTICE GROVE" igual); nombre "magnesium" **20** ("MAGNÉSIUM" y "magnesium" = 20); "Magnesium  glycinate" (2 espacios) = "magnesium glycinate" = **6** (misma consulta); descripción: "routine", "wellness" y "daily" **300** (15 páginas: la forma de llegar a los 300 reales para T15); "tablets" **87** (5 páginas); "forest" **3**; **un único resultado**: "calm capsules" y "zinc powder" (Daily Zinc Powder, Solstice Grove, 3.1★); **sin coincidencias**: "zzzz", "vitamina" y "vitamin c" (el español y "vitamin" no existen: los nombres son "Citrus C Powder"...). Con filtros: "tablets" + Disponible 82; "tablets" + las 4 banderas 4; "zinc powder" + 4★ o más **0** (rating 3.1) y "zinc powder" + marca Juniper Axis **0** (vacío con filtros reproducible). Un carácter ("a", "e") ya coincide con los 300.
- Contrato de `q` del servidor: **sin longitud mínima**; `q` vacío o de solo espacios responde **400** `INVALID_QUERY`. La interfaz nunca lo envía: `buildProductQueryArgs` omite `q` vacío y `resolveSearchView` no devuelve `query` con `q` vacío.
### Corrección S-1/S-2/S-3/S-7 (hallazgos de la validación de T12)

**S-1 — TalkBack leía el icono como un carácter ("壳", "嬉").**
- Causa (comprobada en `node_modules/expo-symbols/build/SymbolView.js`): en Android `SymbolView` es una `View` con un `Text` que dibuja un carácter de la fuente Material Symbols y **solo reenvía `style`, `size` y `tintColor`**. `accessibilityElementsHidden` e `importantForAccessibility` se descartaban en silencio, así que el glifo (carácter de uso privado) era un nodo accesible más: parada propia en la lupa y texto añadido a los hijos del botón. En iOS la vista nativa sí recibe esas props, por eso allí no se veía. El árbol real lo confirmaba (`TextView text='\ue8b6'`).
- Opciones:
  - Elegida: `AppIcon` en el design system, una `View` con `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"` que envuelve al `SymbolView`. Se corrige en un solo sitio y los 5 usos (búsqueda, cabecera de Inicio, carrusel, tab bar) lo comparten. Trade-off: una vista más por icono (sin estilo propio, no cambia el layout).
  - Descartada: `accessibilityLabel={entry}` en cada fila: arregla solo esa fila, duplica el texto y deja la lupa del campo y el resto de iconos con el mismo fallo.
  - Descartadas: `accessible={false}` o cualquier otra prop sobre el `SymbolView` (por la misma causa no llega al `View` de Android) y otro componente de icono (no hay otro en el design system).
- Resultado en Android (`A11y stops` y "Mostrar la salida de voz"): "tablets, Botón, Busca este texto.", "Quitar «magnesium» de las búsquedas recientes, Botón…", "Borrar texto, Botón…", "Borrar todo, Botón…"; la lupa y los glifos pasan a `NOT-IMPORTANT`. Los chips con ✓ ya estaban bien (el ✓ es un `AppText` oculto y el chip lleva `accessibilityLabel`).

**S-2 — la tecla de buscar enviaba un texto parcial ("t" por "tablets").**
- Causa: `onSubmit` leía `text`, el estado del **último render**. Con JS lento (dev build en un A03) la tecla puede llegar antes de que React pinte el último carácter; el historial guardaba el fragmento (viola RF-17). Reproducido: `input text daily; sleep 0.05; input keyevent 66` dio `sent "d"`.
- Elegida: usar `event.nativeEvent.text` de `onSubmitEditing` (el texto nativo en ese instante) a través de `resolveSubmittedText(eventText, fieldText)` (puro, con test primero; solo cae al estado si el evento no trae texto; una cadena vacía es un valor real). Trade-off: un parámetro más en `onSubmit`. Descartado: un `ref` con el último `onChangeText` (más estado a mantener y el texto del evento ya es la fuente nativa). "Ejecutar entrada" usa el argumento `entry` y "tocar un resultado" el texto visible del render en el que ya hay resultados: ninguno lee un texto atrasado.
- Resultado: 12 envíos con esperas 0,05–0,15 s ("tablets", "daily", "magnesium"): siempre el texto completo, el historial sin parciales.

**S-3 — "Borrar texto" / "Limpiar búsqueda" no devolvían el teclado; ejecutar una entrada lo dejaba abierto.**
- Causa: tras la tecla de buscar el teclado se cierra pero Android conserva el foco del campo y React Native ignora `focus()` sobre el input que cree enfocado (`TextInputState.focusTextInput`, comprobado en `node_modules`). Probado quitando el `blur()`: teclado oculto tras borrar.
- Regla (documentada en `SearchScreen`): toda acción que **ejecuta** una búsqueda cierra el teclado (tecla de buscar y ejecutar entrada: `Keyboard.dismiss()` en `sendSearch`); toda acción que **vacía** el campo lo deja enfocado **con** teclado (`focusFieldWithKeyboard`: `blur()` + `focus()` solo si `Keyboard.isVisible()` es falso, para no parpadear si ya está abierto).
- Descartado: `blur()` + `focus()` siempre (parpadeo con el teclado visible) y quitar el foco del campo al enviar (cambia el comportamiento validado). Resultado: teclado visible tras borrar (8 muestras seguidas sin caída) y cerrado tras ejecutar una entrada. En iOS no se puede ver el teclado de software (teclado de hardware conectado): no ejecutable, sin regresión de flujo.

**S-7 — TalkBack leía el placeholder y no "Buscar productos".**
- Causa: en Android el nodo del `EditText` vacío expone el *hint* como `text` y TalkBack lee el texto antes que la `contentDescription`; la etiqueta nunca se pronunciaba. Con valor tecleado se leía el valor.
- Elegida: en Android el placeholder lo dibuja `AppText` (oculto al lector, `pointerEvents="none"`, una línea con puntos suspensivos, mismo tope de fuente) y el `TextInput` nativo queda sin `placeholder`; iOS conserva el nativo (VoiceOver ya dice etiqueta + valor + pista). Es una diferencia real de plataforma. Trade-off: un placeholder propio a mantener alineado con el campo. Descartado: poner el nombre accesible como `placeholder` (cambia el texto visible) o `accessibilityLabelledBy` (no vence al texto del nodo).
- Resultado: "Buscar productos, Editar casilla, Escribe para buscar…" vacío y "Editando, zinc, Editar casilla…" con valor.

| Idea | React Native (HerbStore) | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Icono decorativo | `AppIcon` (`importantForAccessibility="no-hide-descendants"` + `accessibilityElementsHidden`) | `Icon(..., contentDescription = null)`, `importantForAccessibility="no"`, `Modifier.clearAndSetSemantics {}` | `.accessibilityHidden(true)`, `isAccessibilityElement = false` |
| Enviar la búsqueda | `onSubmitEditing` con `event.nativeEvent.text` | `KeyboardOptions(imeAction = ImeAction.Search)` + `KeyboardActions(onSearch)` (el valor del `TextFieldValue` actual) | `.submitLabel(.search)` + `.onSubmit` |
| Teclado y foco | `Keyboard.dismiss()`, `blur()` + `focus()` | `LocalSoftwareKeyboardController.hide()/show()` + `FocusRequester` | `@FocusState` (`focused = true/false`) |
| Nombre del campo | `accessibilityLabel` (+ placeholder propio en Android) | `contentDescription`/`semantics { hintText }`; `label` del `TextField` | `.accessibilityLabel` y `.accessibilityHint` |

**Errores típicos al venir de nativo.** (1) Fiarse de que una prop de accesibilidad llega a la vista nativa: un componente de terceros puede descartarla (comprobar el árbol real, no solo el código). (2) Leer estado de React dentro de un handler de evento nativo: va un render por detrás. (3) Llamar a `focus()` sobre un input que React Native cree enfocado. (4) Un placeholder nativo que tapa la etiqueta accesible en Android.

- Estado: **validada y aprobada por el usuario (2026-10-12)** en Samsung SM-A037M e iPhone 17 Pro, con S-1/S-2/S-3/S-7 corregidos (541 tests) y la migración a `AppIcon` conservada. Seguimientos: S-4…S-6 y S-8…S-12 (ver `MEMORY.md`).

## Día 3 — T13: mutation `createOrder`, invalidación por tags y control `__DEV__`

### Bloque T13 — Mutations, `invalidatesTags` e idempotencia (≈10 min)

**Query frente a mutation.** Una *query* **lee** y se cachea: tiene una entrada por argumento, suscriptores y un `providesTags` ("esta entrada contiene Home / el producto X"). Una *mutation* **escribe**: no tiene entrada de caché que releer, se ejecuta cada vez que la llamas (`trigger(arg)`) y declara con `invalidatesTags` qué lecturas deja desactualizadas. RTK conecta las dos mitades con las **etiquetas**: la mutation no sabe quién la lee; solo dice "invalido `Home`, `ProductList/LIST` y `Product/<id>`" y RTK busca las entradas que proveen esas etiquetas.

**Qué pasa con cada entrada al invalidar (RF-7).**
- *Activa* (con suscriptor, p. ej. Home en su tab, la lista de la categoría bajo el producto, el detalle abierto): RTK la **vuelve a pedir** enseguida.
- *Inactiva* (sin suscriptores pero aún en caché por `keepUnusedDataFor: 300`, p. ej. una búsqueda que ya cerraste): RTK la **elimina de la caché**; al abrirla otra vez no hay datos ni fresco que valga y se pide de nuevo. Es la forma de RTK de decir "revalida en su siguiente apertura".
- `invalidatesTags` se llama con `(result, error, arg)`: `result` es `undefined` si falló, y `arg` es lo que pasaste al `trigger`. Por eso `arg` lleva los productos incluidos: de ahí salen las etiquetas `Product/<id>`.

**202 no es 200.** El servidor responde `202 pending` ("recibida, aún no confirmada") o `200 confirmed`. Solo la confirmada cambia el stock, así que **solo ella invalida** (`tagsForOrderResult` devuelve `[]` con `pending` y con error). Un 202 se resuelve **repitiendo el mismo POST** (misma clave, mismo cuerpo) tras `retryAfterSeconds`: el servidor reconoce la clave y devuelve el estado de esa orden en lugar de crear otra.

**Idempotency-Key estable por intento.** Un intento = una pulsación = **una clave** que se crea una vez y se reutiliza en cada reenvío de ese intento. Una pulsación nueva es un intento nuevo con clave nueva. Con la misma clave y un cuerpo distinto el servidor responde `409 IDEMPOTENCY_KEY_REUSED`.

### Decisiones de T13 (RF-3)

- **Mutation real + control `__DEV__` frente a simular la invalidación con `dispatch(api.util.invalidateTags(...))`.**
  - Elegida: `createOrder` real (`POST /orders`) y un botón de desarrollo que la llama. Trade-off: hay que escribir y luego retirar el control (Día 4, H-4) y depende del mock. Gana: se prueba el camino completo (la mutation, su `invalidatesTags` con el `arg` real y el 202/200 del servidor) y el Día 4 reutiliza `orders-api.ts` tal cual.
  - Descartada: `dispatch(invalidateTags([...]))` desde un botón. Invalidaría igual, pero no demuestra que la **mutation** invalida, ni que el 202 no lo hace, ni la idempotencia; enseñaría el mecanismo sin el caso real.
- **0 reintentos automáticos en un `POST` frente a 2 (RF-8).**
  - Elegida: RF-8 aplica solo a lecturas (`GET`); `shouldRetryRequest` nunca reintenta otro método (P2). Trade-off: un fallo transitorio de la orden exige pulsar otra vez (y eso crea **otra** clave: es un intento nuevo).
  - Descartada: los 2 reintentos del `GET`. Un `POST` que falló por red o timeout **puede haberse procesado**; reenviarlo a ciegas es el error de las órdenes duplicadas. El Día 4 resolverá la duda consultando `GET /orders/status/:key` sin reenviar.
  - El re-POST tras un 202 **no es un reintento por fallo**: el servidor respondió y dijo "pendiente"; se repite la misma petición idempotente.
- **Invalidar por etiquetas frente a `refetch()` manual o `updateQueryData`.**
  - Elegida: `invalidatesTags` con `Home`, `ProductList/LIST` (una sola etiqueta para todas las listas: categoría, búsqueda, filtros) y `Product/<id>` por producto. Trade-off: invalida de más (todas las listas, no solo las que contienen el producto) a cambio de una regla simple de una línea y sin riesgo de olvidar una pantalla.
  - Descartado `refetch()` manual: cada pantalla tendría que saber que existe una orden y las inactivas quedarían con datos viejos. Descartado `updateQueryData` (parchear la caché a mano): el stock y el orden dependen del servidor; replicar su lógica en el cliente es frágil.
- **Control cargado con `require` bajo `__DEV__` frente a `import` + `__DEV__ && <X />`.**
  - Medido: con `import` estático, el export de release (`expo export`, `__DEV__ = false`) **seguía llevando** el módulo ("Test Customer", `Idempotency-Key`, `POST /orders` en el `.hbc`); el JSX desaparecía pero el módulo se empaquetaba. Con `__DEV__ ? require(...) : null` Metro sustituye `__DEV__` por `false`, elimina la rama y el módulo no entra al bundle (0 coincidencias de esas cadenas; solo quedan los textos i18n). Trade-off: un `require` con `eslint-disable` justificado en un único sitio. Se retira en el Día 4 con el placeholder.
- **Clave en los logs: truncada.** Se registra `key=…2c3d` (4 últimos caracteres) porque validar "misma clave en el 202 y en el 200" la necesita. Nunca el cuerpo, la dirección, la moneda, las cantidades ni el id de la orden. Los ids de producto sí (son datos de catálogo).

### APIs reales comprobadas (RTK 2.13 y el mock)

| Pieza | Comprobación | Resultado |
| --- | --- | --- |
| `invalidatesTags: (result, error, arg)` con store real | `selectInvalidatedBy` y recuento de peticiones | Con 202: **0** peticiones nuevas. Con 200: `GET /home`, `GET /products?category=…` y `GET /products/<id>` una vez cada una; la búsqueda sin suscriptores se **eliminó** de la caché y se volvió a pedir al abrirse. Con 409: 0 peticiones. |
| Estado `api.mutations` | impresión del estado | RTK 2.13 **no guarda los argumentos** de la mutation (ni la dirección) en el store; guarda `status` y `data` (la proyección) hasta `reset()`. Los argumentos solo viajan en `meta.arg` de las acciones. `reset()` limpia ese resultado. |
| Reintentos | script con el mock caído (`localhost:3999`) | `POST /orders`: **1** intento, error `network` en ~20 ms y ningún reintento tardío (3 s después sigue 1). Control: `GET /home` con la misma red caída = 3 intentos (1 + 2) en ~1,5 s. |

### Contrato real de `POST /orders` (lectura de `mock-server/src/orders` + smoke contra el servidor)

- **Request:** exactamente `items[] { productId, quantity 1–99 entero }`, `currency` (`MXN`|`USD`) y `shippingAddress { fullName ≥3, phone 10 dígitos, postalCode 5 dígitos, state ≥2, city ≥2, street ≥3, exteriorNumber, interiorNumber? }`. Cualquier campo extra → 400. Cabecera `Idempotency-Key` obligatoria (cualquier texto no vacío; se recorta).
- **Respuestas:** `202 {status:'pending', retryAfterSeconds, key}` (≥1 s; la orden tarda `ORDER_PROCESSING_MS`, 1000 ms por defecto, en confirmarse); `200 {status:'confirmed', order:{id, items, currency, subtotal, shipping, total, status, createdAt}}` (la app solo guarda `order.id`); repetir la clave con el mismo cuerpo devuelve lo mismo (202 mientras dure, 200 después, también tras confirmar).
- **Errores (4xx con cuerpo, que `fetchJson` descarta hasta el Día 4):** 400 `VALIDATION_ERROR` (+`fields`), 409 `OUT_OF_STOCK`, 409 `IDEMPOTENCY_KEY_REUSED` (clave reutilizada con otro cuerpo), 404/410 en `GET /orders/status/:key` (no existe / caducada).
- **Stock:** los productos con `inStock: true` tienen 99 unidades por arranque del mock y cada orden confirmada o pendiente las reserva; `product-261009-001` está agotado (`inStock: false`) y produce **409 OUT_OF_STOCK**; en la app se ve como "El servidor rechazó la orden (HTTP 409)". Producto de ejemplo con stock: `product-261009-002` (USD 45,11).
- **Dirección ficticia:** `Test Customer`, teléfono `0000000000`, CP `00000`, `Test State`/`Test City`/`Test Street`, número `0`: cumple el contrato, no es un dato personal y nunca se registra.

### Comparación Android / iOS

| Idea | React Native (HerbStore) | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Escribir y refrescar lo leído | `createOrder` (mutation) + `invalidatesTags` | Repository que llama a Retrofit y luego invalida su caché / emite en un `SharedFlow` que los `ViewModel` recogen; con Room, el *invalidation tracker* re-emite las consultas afectadas | `URLSession` + un `@Observable`/Combine `PassthroughSubject` que avisa a los modelos; `NSCache.removeObject(forKey:)` para las entradas afectadas |
| Clave idempotente | cabecera `Idempotency-Key` creada por el llamador | `Interceptor` de OkHttp/Retrofit que añade la cabecera (la clave se crea en el caso de uso, no en el interceptor, para que sea estable por intento) | `URLRequest.setValue(key, forHTTPHeaderField: "Idempotency-Key")` |
| Etiquetas = qué lecturas quedan viejas | `Home`, `ProductList/LIST`, `Product/<id>` | claves de caché / `Flow` por consulta | claves del `NSCache` / `@Query` observadas |
| Entradas sin suscriptor | RTK las elimina; se piden al abrirse | `stateIn(WhileSubscribed)` deja de colectar; se recarga al volver a colectar | un `@Observable` sin vista viva se recarga en `.task` al reaparecer |
| Control solo de desarrollo | `__DEV__ ? require(...) : null` | `BuildConfig.DEBUG` + *source set* `debug` | `#if DEBUG` |

**Errores típicos al venir de nativo.**
1. Reenviar un `POST` sin saber si se procesó (por eso 0 reintentos y clave idempotente).
2. Invalidar con un 202: el stock aún no cambió.
3. Etiquetas sin `id` (`{ type: 'Product' }` invalida todos los productos; aquí cada producto lleva el suyo).
4. Una clave nueva por cada re-POST: crearía otra orden. La clave nace al pulsar y se reutiliza.
5. Mutar el `arg` entre reenvíos: el cuerpo debe ser idéntico (el servidor compara una huella canónica).
6. Registrar el cuerpo o la dirección; y creer que `__DEV__ && <X />` quita el módulo del bundle (quita el JSX, no el `import`).

### Registro de T13

- Lógica con test primero: `checkout/contracts/parse-order-result`, `checkout/logic/{order-invalidation,dev-order,order-log}` (+ tests). 541 → 566 tests (+25).
- Archivos nuevos: `checkout/contracts/{order,parse-order-result}.ts`, `checkout/logic/{order-invalidation,dev-order,order-log}.ts`, `checkout/data/orders-api.ts`, `checkout/components/OrderDevControls.tsx`. Modificados: `product/screens/ProductPlaceholderScreen.tsx` (carga condicional del control), textos `orderDev.*` es/en.
- Desviaciones mínimas del plan: (1) `contracts/` para los tipos y `parseOrderResult`, y `order-log.ts` aparte (la lógica del log sin RN se prueba sola); (2) `nextDevOrderStep`/`devRetryDelayMs`/`MAX_DEV_REPOSTS` puros en `dev-order.ts` (el bucle de 202 queda testeado; el componente solo lo ejecuta); (3) el control se carga con `require` bajo `__DEV__` en lugar de `__DEV__ &&` (medido, ver arriba); (4) `orderId` sale de `order.id`: el 200 real no trae `orderId`; (5) `retryAfterSeconds` se acota a 5 s en el control.
- El control (`OrderDevControls`): botón primario de 48 pt, deshabilitado mientras envía o espera; una región viva (`accessibilityLiveRegion="polite"`) con el estado en texto (y `announceForAccessibility` en iOS, que no tiene regiones vivas); indicador animado solo si no hay movimiento reducido (con movimiento reducido solo el texto); texto de estado con `flex: 1` + `minWidth: 0` y botón con `fontScaleLimits.actionLabel` (lecciones F-1/G-1). Estados: inactivo, enviando, pendiente (reenvío N de 3), confirmada, sigue pendiente, error (red / HTTP n / otro). Al terminar (cualquier salida) llama a `reset()`.
- Se retira en el Día 4 (H-4) cuando el detalle real sustituya al placeholder; `orders-api.ts` se conserva.
- Estado: **implementada y validada** en Samsung SM-A037M e iPhone 17 Pro ((c)–(e) y (h) comprobados; ver `tasks.md` T13).

## Día 3 — T14: fallback global de render

### Bloque T14 — Error boundaries frente a errores de API (≈8 min)

**Dos clases de fallo, dos lugares para recuperarse.** Un error esperado de red, un HTTP 5xx o un payload inválido forma parte del estado de una consulta: RTK Query lo entrega como dato y Home, producto o listado conserva su interfaz local con «Reintentar». Un error boundary no sustituye ese modelado. Solo contiene excepciones inesperadas que React encuentra al renderizar el árbol; por ejemplo, un componente que lanza al calcular su JSX. Los errores de callbacks asíncronos o handlers tampoco se convierten por arte de magia en errores de render.

**Contrato real de Expo Router 57.** Una ruta puede exportar `ErrorBoundary({ error, retry }: ErrorBoundaryProps)`. El tipo instalado declara `error: Error` y `retry: () => Promise<void>`; `retry` limpia el error del boundary y vuelve a renderizar la ruta. Al exportarlo desde el layout raíz, el fallback sustituye también sus providers, por eso monta sus propios `I18nextProvider` y `AppThemeProvider`. No reintenta automáticamente: si el mismo render vuelve a lanzar, Expo Router vuelve a presentar el fallback y evita un ciclo automático.

**Comparación nativa.** En Android, un `Thread.UncaughtExceptionHandler` observa una excepción no contenida cuando el proceso ya va a terminar; no puede recomponer de forma segura una pantalla como este boundary. Lo más cercano en Compose es contener un estado de error antes de componer, pero una excepción durante composición normalmente asciende al host. En iOS, un crash handler (`NSSetUncaughtExceptionHandler` o señales) sirve para diagnóstico, no para continuar el proceso; SwiftUI tampoco ofrece un equivalente directo que recupere cualquier excepción de `body`. El boundary de React es contención declarativa de un subárbol, no recuperación de un crash nativo, OOM o fallo de Kotlin/Swift.

### Decisión de T14 (RF-3)

- **Elegida:** el `ErrorBoundary` de Expo Router en `_layout.tsx`, con una pantalla completa que ofrece `retry()` y «Ir al inicio» (`retry()` y `router.replace('/')` en la tarea siguiente, después de que el fallback vuelva a quedar estable; orden comprobado con la versión instalada). Trade-off: como el layout raíz queda sustituido, el fallback duplica solo los providers imprescindibles; a cambio cubre todas las rutas y volver a Inicio remonta el árbol con estado efímero nuevo.
- **Descartada:** una clase `ErrorBoundary` propia o `react-error-boundary`. La primera duplica el mecanismo que Router ya instala por ruta; la segunda añade una dependencia sin aportar un requisito. También se descarta tratar errores API lanzándolos al boundary: perdería caché, contexto y recuperación local.

### Registro de T14

- Expo Router `~57.0.25`: los tipos instalados y la documentación confirman `ErrorBoundaryProps { error: Error; retry: () => Promise<void> }`; `Try.retry` limpia su estado de error y resuelve después del `setState`.
- La demo cambia estado desde el botón y lanza en el render siguiente (los boundaries no capturan el propio handler). Está cargada con `__DEV__ ? require(...) : null`, por lo que el módulo no entra en la rama de release.
- Orden comprobado en iOS con un error que persiste: `router.replace('/')` y `retry()` en el mismo turno, o reemplazar inmediatamente tras el `await`, deja la ruta que falla. Funciona `retry().then(() => setTimeout(() => router.replace('/'), 0))`: el fallback nuevo queda estable y la tarea siguiente reemplaza la ruta, desmontando su estado. El timer no es un reintento automático; nace exclusivamente al pulsar «Ir al inicio».
- Validación Android (Samsung SM-A037M): fallback español tras descartar LogBox; botones nativos enfocables de 90 px a densidad 300 (= 48 dp), TalkBack activo y árbol accesible; Reintentar recuperó la ruta sin bucle y «Ir al inicio» abrió Home. Sin mock, el producto mostró «Sin conexión» local, no el fallback.
- Validación iOS (simulador iPhone 17 Pro): fallback español e inglés en el idioma activo; auditoría AX con heading y dos botones de 48 pt; un error persistente reapareció solo al pulsar Reintentar (sin bucle) y «Go to Home» abrió Home. Sin mock, el producto mostró «No connection to the server» local. VoiceOver real queda para la auditoría del Día 6 por decisión previa del usuario.
- Comprobaciones: lint y TypeScript sin salida/errores; `test:logic` 566/566; paridad i18n 3/3.

## Día 3 — T15: medir antes de optimizar

### Bloque T15 — Profiler, renders, commits y tiempo de primera pintura (≈9 min)

**Tres medidas que no significan lo mismo.** React Native DevTools Profiler cuenta cada vez que React ejecuta un componente (*render*) y agrupa el trabajo que llega a la interfaz en *commits*. Un render puede acabar sin cambios nativos; un commit sí aplica el árbol reconciliado y su duración indica cuánto trabajo de React participó, pero no equivale por sí sola a FPS ni a un bloqueo completo del hilo JS. `FlashList.onLoad` mide otra fase: milisegundos desde montar la lista hasta que dibuja elementos por primera vez; solo se dispara una vez por montaje, así que al cambiar un chip (otra identidad y otro `key`) mide la primera pintura de la lista nueva.

**React Compiler está activo.** El compilador puede estabilizar valores y saltar renders sin `memo`, `useMemo` o `useCallback` escritos a mano. Para saber si está ocultando una diferencia se usa temporalmente la directiva `"use no memo"` en el componente observado, se repite exactamente el mismo recorrido y después se retira. La directiva es un control experimental, no una solución de producción. Primero se registra el comportamiento real compilado; solo si el perfil señala un coste concreto se prueba **un** candidato y se repite la misma interacción.

**Cómo leerlo desde nativo.** Un render se parece a una recomposición de Compose o a reevaluar `body` en SwiftUI; un commit se parece a la fase en la que Compose aplica cambios al árbol o SwiftUI actualiza su grafo/vistas. React Native DevTools Profiler corresponde a Android Studio Profiler más Layout Inspector para ver coste y árbol; en iOS, a Instruments (Time Profiler/Core Animation) más la jerarquía de vistas. Ninguna herramienta autoriza a inferir la causa: un sondeo temporal de `setInterval` detecta retrasos del event loop JS, mientras Profiler muestra qué trabajo React coincidió con ellos.

### Decisión de T15 antes de instrumentar (RF-3)

- **Elegida:** perfil reproducible con React Profiler/contadores temporales, `FlashList.onLoad` y sondeo temporal de stalls; mismo Samsung, datos y gestos antes/después. El único candidato se elige después del baseline. Trade-off: el código de medición altera ligeramente el build de desarrollo y obliga a repetir varias veces y usar mediana/rango.
- **Descartada:** añadir `memo`, cambiar `drawDistance`, ventana, imágenes o arquitectura por intuición. También se descarta dejar el sondeo o logs como telemetría: no representan rendimiento de producción y añadirían trabajo permanente al hilo JS.

### Método reproducible y resultado (Samsung SM-A037M)

1. Mock sin latencia, `adb reverse` para 8081/3001, escala de fuente normal y caché de la app vacía al iniciar cada serie. En categoría se usó Vitaminas (60); para 300 se usaron `daily` y `wellness`, búsquedas sin categoría equivalentes en tamaño (15 páginas de 20).
2. Se envolvió temporalmente la `FlashList` en `React.Profiler`, se contaron entradas a `ProductGrid`/`ProductCard`, se conservó el `onLoad.elapsedTimeInMs` ya previsto y se ejecutó un `setInterval` de 50 ms que registraba retrasos ≥50 ms. Todo ese código se retiró al terminar.
3. Interacción A: desde arriba, swipes adb de 900 px/400 ms hasta recibir tres páginas. Interacción B: desde la primera página de Vitaminas, tocar «Disponible» y esperar a que la nueva cuadrícula quedara estable. Para el recorrido completo de 300: 75 swipes idénticos de 900 px/400 ms hasta página 15; después, 18 swipes inversos sobre las 300 ya cargadas para separar scroll de llegada de página.
4. Se intentó además un APK `release` real (`assembleRelease`, instalado correctamente), pero el origen didáctico `http://localhost:3001` quedó bloqueado en release y la lista mostró offline. Habilitar cleartext o introducir un origen de producción habría cambiado app config fuera de T15. Por tanto, se aplicó la alternativa aprobada: Profiler sobre el Development Build, sin presentar ese intento como dato release.

Las duraciones son suma/mediana/máximo de commits de la misma serie. «Renders tarjetas» cuenta ejecuciones de `ProductCard`, no vistas nativas recicladas; «grid» cuenta ejecuciones de `ProductGrid`. El rango de stalls excluye el arranque y Fast Refresh.

| Dispositivo / build | Escenario y pasos | Variante | Renders `ProductGrid` / `ProductCard` | Commits React (n; suma; mediana; máx.) | `onLoad` | Stalls JS | Conducta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Samsung SM-A037M / dev instrumentado | 3 páginas, universo 300, swipes 900 px/400 ms | Antes: Compiler activo | 6 / 58 | 72; 3.688,7 ms; 20,5 ms; 237,9 ms | 355 ms | 51–414 ms | páginas 1–3, ids y posición correctos |
| Samsung SM-A037M / dev instrumentado | mismos pasos | Candidato: `memo(ProductCard)` + `"use no memo"` | 7 / 58 | 76; 3.669,9 ms; 17,4 ms; 236,0 ms | 486 ms | 53–470 ms | igual |
| Samsung SM-A037M / dev instrumentado | tocar «Disponible», 60 productos | Antes: Compiler activo | 2 / 10 | 7; 557,8 ms; 30,4 ms; 245,3 ms | 450 ms | 83–420 ms | 55 productos, página 1 y scroll arriba |
| Samsung SM-A037M / dev instrumentado | mismos pasos | Candidato | 2 / 10 | 7; 554,3 ms; 29,6 ms; 239,2 ms | 454 ms | 60–423 ms | igual |
| Samsung SM-A037M / dev instrumentado | 75 swipes 900 px/400 ms; cargar 15 páginas | Antes: Compiler activo | 30 / 300 | 419; 18.329,3 ms; 18,4 ms; 261,0 ms | 355 ms | 51–432 ms | 300 ids únicos; sin petición 16 |
| Samsung SM-A037M / dev instrumentado | mismos pasos | Candidato | 30 / 300 | 401; 17.958,4 ms; 17,7 ms; 236,0 ms | 486 ms | 53–472 ms | igual |
| Samsung SM-A037M / dev instrumentado | 18 swipes inversos sobre 300 ya cargados, sin red | Antes | — / solo celdas recicladas visibles | incluido en la traza anterior | no aplica | 50–104 ms | toque/scroll inmediato |
| Samsung SM-A037M / dev de T9 | categoría 60, recorrido frío | Antes de T15 | no registrado | no registrado | no registrado | página 212/370/392 ms; scroll 250–440 ms | funcional |
| Samsung SM-A037M / release | abrir categoría con mock local | no medible | no aplica | no aplica | no aplica | no aplica | offline por HTTP cleartext; dato descartado |

### Candidato, veredicto y cierre de H-13 / T9(g)

**Candidato único.** El perfil mostró que cada tarjeta visible se ejecutaba una vez; aun así se probó la única duda razonable: `memo(ProductCard)`, desactivando temporalmente el Compiler dentro de esa tarjeta con `"use no memo"` para no atribuirle al wrapper lo que ya hacía el compilador. La comparación mantuvo productos, callbacks e identidad. Se descartaron `drawDistance`, imágenes y la paginación porque habrían cambiado cuánto contenido se prepara o muestra, no un render redundante demostrado.

**Resultado: candidato revertido.** En el chip los siete commits y diez renders fueron idénticos; la diferencia de 3,5 ms acumulados es ruido (<1 %), `onLoad` empeoró 4 ms y el peor stall 3 ms. En 300 el wrapper redujo 18 commits internos y ≈2 % de duración acumulada, pero empeoró `onLoad` 131 ms y el peor stall 40 ms; además no evitó un solo render de tarjeta (300/300). No hay una mejora consistente y atribuible. React Compiler ya cubre este caso, así que no queda `memo`, `"use no memo"`, `Profiler`, contadores ni intervalo en producción.

**H-13 cerrado.** Con las 300 tarjetas ya cargadas, el mismo Development Build queda en 50–104 ms, por debajo de 150 ms; no existe una transformación síncrona de los 300 productos al tocar o desplazar. Los >150 ms aparecen al descubrir y montar celdas nuevas y alrededor de la llegada de páginas dentro del build instrumentado; el Profiler registra commits de hasta 238–261 ms, mientras añadir `memo` no reduce renders de tarjetas. Por tanto, los 250–440 ms «solo scroll» de T9 no prueban un coste de paginación: eran reproducibles en el recorrido frío de desarrollo, pero desaparecen con las 300 celdas ya recorridas. La llegada de página **sí contribuye** al recorrido frío en dev, pero no por aplanar 300 elementos ni por renders redundantes; predominan montaje/medición de celdas e instrumentación de desarrollo. El intento release no puede usarse cuantitativamente por el bloqueo HTTP explicado arriba. RNF-1 queda satisfecho y no se conserva una optimización especulativa.

### Validación final de T15 (sin instrumentación)

- **Android, Samsung SM-A037M:** Development Build debug reinstalado después del intento release. Vitaminas cargó páginas 2 y 3 una vez, «Disponible» cambió el total 60 → 55, volvió arriba y mantuvo tarjetas/ids correctos. No aparecieron logs `[profile]`; solo permanece el `grid onLoad` `__DEV__` que ya era parte del plan desde T9.
- **iOS, simulador iPhone 17 Pro:** mismo recorrido con `axe`: páginas 2 y 3 una vez; activación por coordenada del nodo AX «Disponible» cambió 60 → 55 y generó una cuadrícula nueva (`onLoad` 31 ms). Sin cambio productivo compartido que comparar: se validó que revertir el candidato conservó paginación, scroll, chip y tarjetas.
- **Automático:** `npx expo lint` y `npx tsc --noEmit`, sin salida/errores; `npm run test:logic`, 566/566; paridad i18n, 3/3. El primer intento del comando de paridad apuntó por error al directorio padre; se repitió con `src/core/i18n/resources/parity.test.ts` y pasó.

## Día 3 — T16: cierre y validación del día

### Bloque T16 — Qué significa «validado» en una app con caché (≈8 min)

**Validar es contar peticiones, no mirar pantallas.** Una pantalla puede verse bien con una caché que miente: por eso la matriz de cierre se lee en los logs `__DEV__` (`[api]`, `[products]`, `[home]`, `[net]`, `[orders]`, `[search]`) y no solo en lo que se ve. Cada regla de datos del día es un número comprobable: 1 petición al abrir tras más de 60 s, 0 antes, 3 peticiones ante red o 5xx en una lectura, 1 ante 404, timeout o `POST` fallido, 1 petición por página y ninguna tras la última, 1 consulta 400 ms después de la última tecla.

**Qué no puede decir un log.** Un log no dice si una etiqueta suena bien, si un botón se corta con texto grande ni si un gesto compite con el scroll. Eso se comprueba con el árbol de accesibilidad (`uiautomator`, `axe`, la herramienta `UiAutomation` con TalkBack activo) y con capturas a 2×/AX5, oscuro y movimiento reducido. Lo que ninguna herramienta de línea de comandos puede dar —VoiceOver real, una red física cortada en iOS— se declara como pendiente en vez de darse por hecho.

**Comparación nativa.** En Android esta matriz sería una mezcla de pruebas instrumentadas con `MockWebServer` (contar peticiones por ruta, simular 503 y latencia) y Compose test sobre el árbol semántico; en iOS, XCUITest con `URLProtocol` de prueba y el Accessibility Inspector. En React Native los dos caminos se unifican en Jest (con `fetch` controlado para RTK Query) y Maestro (árbol de accesibilidad común) el Día 6; hoy se hace a mano con los mismos criterios para saber qué automatizar.

**Errores típicos de quien viene de nativo.** (1) Dar por «roto» un comportamiento que es la regla: datos de menos de 60 s tras reconectar no piden nada (R-1 abajo). (2) Medir con el build de desarrollo y atribuir el resultado a la paginación: la instrumentación y la validación de dev inflan los tiempos (T15). (3) Probar solo la ruta feliz: sin latencia (`MOCK_LATENCY_MS`) no existe carrera entre refresh y «cargar más». (4) Fiarse del estado de la UI en vez del número de peticiones. (5) Contar `fetch` fallidos sin distinguir si el dispositivo o el servidor están caídos: `expo-network` mide el dispositivo, `adb reverse` y el mock miden otra cosa.

### Decisión de T16 (RF-3)

- **Elegida:** matriz guiada por logs reales con el mismo mock y Samsung/simulador de siempre, más árbol de accesibilidad como evidencia, y declarar sin disimulo lo no comprobado. Trade-off: es manual y lenta (≈1,5 h por plataforma) y hay casos de carrera que dependen de la latencia del adb/axe.
- **Descartada:** automatizar la matriz con una herramienta nueva hoy (Maestro/Jest entran el Día 6 con su plan: constitución, punto 4) y cortar el Wi-Fi del Mac para probar la reconexión en iOS (corta también el hilo de trabajo del implementador y afecta a todo el equipo; se deja al usuario).

### Registro de verificación del Día 3 (T16, 2026-10-12)

**Automático.**

| Comprobación | Resultado |
| --- | --- |
| `npx expo lint` | sin salida, código 0 |
| `npx tsc --noEmit` (con `.expo/types/router.d.ts` ya generado) | sin errores, código 0 |
| `npm run test:logic` | 566 tests, 123 suites, 566 pass, 0 fail (incluye la paridad i18n) |
| `npm --prefix mock-server test` | 73 tests, 12 suites, 73 pass |
| `npx expo install --check` | «Dependencies are up to date» |
| `npx expo-doctor@latest` | 21/21 comprobaciones sin incidencias |
| Instrumentación temporal de T15 en `src/` | ninguna: sin `Profiler`, `setInterval` de sondeo, `memo`/`"use no memo"` de prueba; solo queda el log `grid onLoad` bajo `__DEV__` previsto desde T9 |

**Matriz manual.** Android = Samsung SM-A037M (dev build, `adb`, Metro y mock por USB); iOS = simulador iPhone 17 Pro (`axe`, logs en Metro). Cifras tomadas de los logs.

| Caso | Android | iOS |
| --- | --- | --- |
| Home abre: 1 petición; tras >60 s al volver al foco: 1 revalidación sin spinner | OK (`[home] background revalidation` + 1 `GET /home`) | OK |
| Categoría: primera página, contador, 2 columnas | OK («60 productos») | OK |
| Paginación: páginas 2 y 3 una vez cada una, ninguna tras la última | OK | OK |
| Categoría <60 s: reabrir no pide; >60 s: una revalidación de las 3 páginas | OK (0 / 3 peticiones) | OK (0 / 3) |
| Chip «Disponible» → `inStock=true`, 55 productos; orden `price_asc`; marcas (`brands=2`, 13 productos) | OK | OK |
| Cancelar y cerrar la hoja de filtros: sin petición | OK (Cancelar y Atrás) | OK (Cancelar y Cerrar) |
| Vacío con filtros (`category/does-not-exist` + chip): chips visibles y «Limpiar filtros» en una acción | OK (limpiar reutiliza la caché fresca: 0 peticiones) | OK |
| Pull-to-refresh fuerza 1 petición con la caché fresca | OK | no repetido en T16 (validado en T9) |
| Carrera pull ↔ «cargar más» (latencia 6 s): aborta la página en vuelo y parte de la 1 | OK (`pull refresh: next page aborted`, `GET … -> aborted`) | no reproducido: los gestos `axe` tardan más que la ventana; validado en T9 |
| Skeleton con forma de cuadrícula con latencia 2 s | OK | validado en T8 |
| Timeout (latencia 9 s): 1 petición, error a los 8 s con «Reintentar» que recupera | OK | OK (1 petición `timeout`) |
| Offline (3 peticiones: 0, +0,6 s, +1,7 s) y reintento manual | OK (categoría y Home) | OK (Home en segundo plano: 3 peticiones y aviso; «Reintentar» lo retira) |
| 5xx (fixture `server-fail`): 3 peticiones y error con «Reintentar» | OK (3×`http 500`) | misma ruta de JS; no repetido |
| 404 de producto: 1 petición; id inválido: 0 | OK | OK |
| Reconexión con `expo-network` y datos >60 s: 1 revalidación y aviso retirado solo tras éxito | OK (106 s de antigüedad: `[net]`, `[home] background revalidation`, `GET -> ok`, aviso fuera) | PENDIENTE: no se corta el Wi-Fi del Mac |
| Reconexión con datos <60 s: ninguna petición; el aviso offline sigue | OK (54 s: solo `[net] offline -> online`; ver R-1) | PENDIENTE |
| Reconexión sin datos previos: ninguna petición, queda «Reintentar» | OK | PENDIENTE |
| Invalidación por orden: POST 202 (sin invalidar), POST 200 con la misma key y revalidación de Home, lista montada y detalle | OK (3 revalidaciones) | OK (Home y detalle; sin lista montada en esta ruta) |
| `POST /orders` sin red: 1 intento y aviso «pulsa de nuevo» | OK | OK |
| Búsqueda: 1 consulta 400 ms tras la última tecla, historial, sin duplicados | OK (`[search] debounced after 400ms`) | OK |
| 300 elementos reales (búsqueda `daily`): 14 cargas (páginas 2–15), 14 `ok`, ninguna 16.ª | OK | OK |
| Fallback global: fallback es, Reintentar recupera, «Ir al inicio» lleva a Home; un error de API sigue local | OK | OK |
| Fuente 2×/AX5 | OK: una columna, nombre/precio/estado visibles; iconos del tab bar recortados (H-1 conocido) | OK: título y tarjeta visibles; botón de orden en 2 líneas (aceptado) |
| Tema oscuro | OK (categoría y hoja) | OK |
| Movimiento reducido | ajuste del sistema aplicado y hoja abre; la ausencia de animación no se distingue en capturas: queda como en T10 | no evidenciado en iOS (el código lo respeta: skeleton estático, `overrideReduceMotion` en `AppBottomSheet`, spinner del pie omitido); pendiente de comprobación manual o auditoría del Día 6 |
| TalkBack / VoiceOver | TalkBack real: tarjetas con nombre, precio, oferta, calificación y disponibilidad; encabezados; contador en región viva; pestañas con rol. VoiceOver real: NO probado (decisión del usuario, Día 6); árbol AX de iOS revisado con `axe` | — |

**Medición en Android con los 300 reales (revisión de T9 (g), sin instrumentación).** Dev build, 90 swipes de 900 px sobre `daily`: `dumpsys gfxinfo` (hilo de UI, no el de JS) dio 3 904 fotogramas, p50 25 ms, p90 53 ms, p95 85 ms y p99 150 ms; con las 300 ya cargadas, 18 swipes inversos dieron p50 32 ms y p99 129 ms. Es el mismo orden que T15 (50–104 ms de estancamiento de JS con las 300 cargadas) y confirma la conclusión de T15: no hay una transformación síncrona de 300 elementos; los picos son montaje de celdas y trabajo del build de desarrollo. Dato complementario, no sustituye a un perfil en release (bloqueado por el HTTP cleartext, ver T15).

### Hallazgos de T16

- **R-1 (diseño, decidir en el Día 4):** tras reconectar con datos de menos de 60 s no se pide nada y el aviso offline sigue visible hasta el siguiente éxito (pull, «Reintentar» o foco >60 s). Cumple RF-5/RF-19 y el caso límite «el aviso se retira solo tras una respuesta satisfactoria», pero el usuario puede ver «Sin conexión» con red restaurada. Si se quiere, una reconexión con aviso activo podría ignorar los 60 s; es un cambio de requisito (spec 004/005), no un defecto.
- **R-2 (menor, no investigado):** en Android, «Reintentar» del fallback global tras provocar el error desde Foundations (abierto por enlace) deja al usuario en la raíz de la pestaña Cuenta, no en Foundations. Es el comportamiento de `retry()` de Expo Router sobre una ruta con estado efímero; no afecta a «Ir al inicio».
- **R-3 (herramienta de desarrollo):** en iOS el botón flotante «Tools» del dev client cubre el botón Atrás nativo («Inicio»/«Búsqueda»); para volver con `axe` hay que tocar su borde derecho. No ocurre en un build de producción.
- **R-4 (limitación de herramienta):** `adb shell input text` y `axe type` pierden o repiten caracteres (`magnesiu`, `daidaily`); es el mismo S-9 de T12. Los gestos de `adb`/`axe` empiezan a ser el factor limitante para reproducir las carreras con latencia.
- **Seguimientos que se mantienen:** F-3, F-4, G-2…G-7, H-1/H-11, H-10, H-12, S-4…S-6, S-8…S-12, M-5/M-6, `engines` de Node, VoiceOver real y el ruido de desarrollo `injectEndpoints … overrideExisting` tras Fast Refresh (ver `MEMORY.md`).
- **Descripción de seguimientos que solo tenían identificador:**
  - **G-6:** arrastre desde la barra de acciones de la hoja de filtros en iOS: resultado no concluyente.
  - **G-7:** la hoja de filtros tardó ≈2 s en abrir una vez; no reproducido.
  - **S-10:** iOS, el doble espacio se convierte en punto (comportamiento del teclado del sistema, no de la app).
  - **S-11:** una búsqueda de solo espacios desmonta la vista de resultados y reinicia los filtros; decisión consciente.
- **Pendientes de decisión del usuario:**
  - **H-10 (iOS, cambio del tamaño de texto en caliente):** textos cortados si se cambia con la app abierta (también en Home). Es una excepción conocida a RNF-2 que el usuario debe aceptar explícitamente (o priorizar en el Día 6).
  - **Cambio de requisito opcional (vía @planner, con aprobación del usuario; `spec.md` no se edita aquí):** anotar que RF-8 aplica a lecturas (`createOrder` hace 0 reintentos, decisión P2) y que RF-9 pasa a una columna con fuente > 1.5x.

### Comparación Android / iOS del día (para repasar)

| Concepto | React Native / HerbStore | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Estado de servidor | RTK Query: caché por argumentos, tags, reintentos | Repository + `Flow`/`StateFlow` con caché y `stateIn` | `async/await` + `@Observable`/Combine sobre `URLCache`/un cliente |
| Caché con frescura | `refetchOnMountOrArgChange: 60` + hook de revalidación | TTL en el repositorio; `Flow` que reemite | `URLCache`/`NSCache` con fecha de validez |
| Reintentos | `retry` con condición pura y espera 500/1000 ms | Interceptor de OkHttp/Retrofit | `URLSession` con reintento propio |
| Invalidación | `invalidatesTags` tras la orden | Invalidar el repositorio y volver a emitir | Invalidar la caché y notificar al `Observable` |
| Paginación | `infiniteQuery`, `getNextPageParam`, «cargar más» por viewability | Paging 3 (`PagingSource`) | `onAppear` del último elemento |
| Lista grande | FlashList v2 (reciclaje de celdas) | `LazyVerticalGrid` (composición perezosa) | `LazyVGrid` |
| Debounce | `setTimeout` reinstalado (400 ms) | `Flow.debounce` | `Combine.debounce` |
| Conectividad | `expo-network` (un listener) | `ConnectivityManager.NetworkCallback` | `NWPathMonitor` |
| Error inesperado de render | `ErrorBoundary` de Expo Router | contención de estado; `UncaughtExceptionHandler` solo diagnostica | `NSSetUncaughtExceptionHandler` solo diagnostica |
| Medir | React DevTools Profiler + `onLoad` | Android Studio Profiler / Layout Inspector | Instruments |

---

### Ejercicio del Día 3 (sin solución)

**Añade a la búsqueda un filtro de «Rango de precio» (mínimo y máximo) que se combine con la paginación sin duplicados, y demuestra que la caché lo distingue.**

Hazlo en una rama o carpeta de práctica sin romper lo existente y sin dependencias nuevas.

1. **Contrato.** El mock debe aceptar `minPrice` y `maxPrice` en `GET /products` (filtrar antes de ordenar y paginar). Escribe primero los tests de `node:test` del mock: rango válido, solo uno de los dos extremos, `min > max` (decide: 400 o vacío y justifica), no numérico y negativo. Confirma que cada test falla por la razón esperada antes de implementar.
2. **Identidad.** Amplía `buildProductQueryArgs` y `toProductQueryString` con tests puros: dos rangos equivalentes (`"10"` y `10`, o extremos intercambiados) deben ser la misma consulta; sin rango no deben aparecer las claves. Decide cómo normalizas el importe y anota el trade-off de la alternativa descartada.
3. **Estado local.** Añade el rango a `list-params` con las reglas de borrador/aplicado de la hoja de filtros (Cancelar no cambia nada, Aplicar sí) y al contador «Filtros (N)». Demuestra con un test que `clearFilters` lo borra y que `setSort` no.
4. **Paginación.** Con el rango activo, comprueba por id que no hay duplicados entre las páginas 1 y 2 y que `total`/`totalPages` provienen de la respuesta filtrada. Define con qué rango obtienes exactamente una página y con cuál `page=2` vacía, y explica qué hace `getNextPageParam` en cada caso.
5. **Carrera.** Con `MOCK_LATENCY_MS=4000`, cambia el rango dos veces seguidas mientras carga la página 2. Explica qué respuesta puede actualizar la lista y por qué, sin escribir código para ello.
6. **Caché.** Aplica el rango A, el rango B y vuelve al A antes de 60 s: anota cuántas peticiones salen y por qué. Repite pasados 60 s y explica qué se muestra mientras revalida.
7. **Interfaz.** Dos campos numéricos con teclado adecuado, error visible si `min > max`, objetivos de 48 dp/44 pt, texto al máximo del sistema sin recortes y movimiento reducido. Textos en español e inglés con `parity.test.ts` en verde.
8. **Validación.** Android físico e iOS simulador, claro y oscuro. Registra el contador de peticiones desde los logs `__DEV__` sin escribir el rango del usuario en ellos.
9. **Diagnóstico (sin respuestas aquí).** Explica cuántos problemas tiene este fragmento y qué cambiarías:

```tsx
function PriceFilterResults({ min, max }: { min: string; max: string }) {
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch(`${origin}/products?minPrice=${min}&maxPrice=${max}&page=${page}`)
      .then((r) => r.json())
      .then((data) => setItems([...items, ...data.items]));
  }, [page]);

  return <FlatList data={items} onEndReached={() => setPage(page + 1)} renderItem={...} />;
}
```

Entrega esperada: el código, una tabla de tus casos (entrada → consulta → peticiones → resultado), una explicación en tus palabras (≤ 8 líneas) y la comparación con Paging 3 (`PagingSource`/`RemoteMediator`) y con la paginación manual de SwiftUI.

---

### Preguntas de repaso (respuestas cortas)

1. **¿Qué diferencia hay entre estado de servidor y estado de cliente y dónde vive cada uno en HerbStore?**
   El de servidor es una copia remota con caché, frescura y reintentos; vive solo en RTK Query. El de cliente (historial de búsqueda, filtros de pantalla) es local o Redux. No se copian respuestas a slices.
2. **¿Cuándo se revalida una consulta y cuántas peticiones salen?**
   Con datos de 60 s o más: al volver el foco, la app a primer plano o la reconexión se muestra la caché y sale una sola petición en segundo plano. Con menos de 60 s no sale ninguna. El pull siempre fuerza una.
3. **¿Cuántos reintentos hace una lectura y cuándo no reintenta?**
   Dos (3 peticiones, esperas de 500 y 1000 ms) ante red o 5xx. Cero ante 4xx, timeout, respuesta inválida, aborto y cualquier `POST`: reenviar una orden de resultado desconocido es peligroso.
4. **¿Por qué la página no forma parte de la identidad de la consulta?**
   Porque es el `pageParam` de la infinite query: todas las páginas de los mismos parámetros viven en una entrada de caché, y cambiar un filtro u orden sí cambia la identidad.
5. **¿Cómo se evita que una respuesta tardía pise la lista vigente?**
   Cada combinación de parámetros tiene su entrada de caché y la pantalla lee `currentData`, nunca `data`: la respuesta tardía escribe en su propia entrada. Un refresh aborta además la página siguiente en vuelo.
6. **¿Cómo decide «cargar más» y por qué una sola vez por página?**
   Cuando uno de los 4 últimos elementos es visible, hay página siguiente y no hay petición en curso. Un guard por número de páginas pedidas evita duplicar la petición mientras llegan los datos.
7. **¿Qué aporta FlashList v2 frente a `FlatList` y cuál es su análogo nativo?**
   Recicla celdas en vez de crear y destruir, y v2 mide solo sin `estimatedItemSize`. Se parece al reciclaje de `RecyclerView`; `LazyVerticalGrid` y `LazyVGrid` componen perezosamente sin reciclar.
8. **¿Cómo funciona el debounce de la búsqueda y qué hace Enter?**
   Un `setTimeout` de 400 ms que se reinstala con cada cambio; tras él se consulta la forma normalizada. Enviar consulta al momento y añade al historial; teclear sin enviar no escribe.
9. **¿Qué invalida una orden confirmada y por qué un 202 no?**
   Confirmada (200) invalida Home, la lista y el detalle de cada producto: las consultas activas revalidan y las inactivas se piden al abrirse. El 202 es «pendiente»: aún no hay estado confirmado que invalidar.
10. **¿Por qué no se dejó `memo(ProductCard)` y cómo se decidió?**
    Se midió el mismo recorrido antes y después (renders, commits, `onLoad`, stalls): no evitó ni un render de tarjeta y empeoró dos métricas. React Compiler ya cubría el caso; sin mejora medible se revierte.

---

### Checklist oral

Debería poder explicar, sin mirar apuntes y en unos 60 segundos cada punto:

**Caché**
- [ ] Qué hacen `keepUnusedDataFor: 300` y `refetchOnMountOrArgChange: 60`, y por qué `refetchOnFocus`/`refetchOnReconnect` de RTK están desactivados.
- [ ] Recorrido de la regla de 60 s con foco, primer plano y reconexión, y por qué comparten una función pura.
- [ ] Tags: `providesTags`/`invalidatesTags`, consultas activas frente a inactivas, y por qué un 202 no invalida.
- [ ] Por qué se lee `currentData` y no `data`.

**Reintentos y errores**
- [ ] La taxonomía `network | http | timeout | invalid | aborted` y cuál reintenta; por qué `POST` y timeout no.
- [ ] Offline frente a error: de dónde sale «offline» (fallo de `fetch` sin respuesta) y por qué `expo-network` solo dispara la revalidación.
- [ ] Error de API (estado local con «Reintentar») frente a error de render (`ErrorBoundary` global).

**Listas**
- [ ] Reciclaje de celdas, `keyExtractor` por id y `key` de identidad para volver arriba al cambiar parámetros.
- [ ] «Cargar más» por viewability, guard por páginas, última página sin petición y pie de carga/error.
- [ ] Deduplicación (se conserva el primer ejemplar) y carrera entre refresh y página siguiente.
- [ ] Filtros: OR dentro de un facet, AND entre facets; borrador frente a aplicado; orden remoto.

**Debounce y búsqueda**
- [ ] `setTimeout` reinstalado de 400 ms, forma normalizada (NFD, minúsculas, espacios) y por qué añadir un espacio no es una consulta nueva.
- [ ] Historial: identidad normalizada, texto visible más reciente, máximo 10 y por qué es estado de cliente.

**Medición**
- [ ] Render frente a commit frente a `onLoad`, y por qué se mide con el mismo recorrido antes y después.
- [ ] Cuándo se conserva una optimización (una medida mejora y ninguna conducta cambia) y por qué se revirtió `memo`.
- [ ] Dev frente a release y qué no puede concluirse del build de desarrollo.

**Proceso**
- [ ] Cómo se validó el día: lógica con `node:test`, logs reales con contadores, árbol de accesibilidad y qué queda para el Día 6 (VoiceOver real, Jest, RNTL, Maestro).

### Bloque T5 — UI derivada, gestos y restauración (≈10 min)

La pantalla no guarda subtotal, progreso ni unidades: lee selectors puros del estado mínimo del carrito. Cada acción comprueba `selectIsCartLocked` antes de despachar; así una escritura durante `REHYDRATE` no pisa la instantánea persistida. `ReanimatedSwipeable` reserva el gesto horizontal y el `ScrollView` conserva el vertical; el botón visible «Eliminar» es la alternativa accesible. Con movimiento reducido se eliminan cambios visuales no esenciales, pero se mantienen las acciones y los mensajes.

| Concepto | React Native | Kotlin/Compose | Swift/SwiftUI |
| --- | --- | --- | --- |
| Estado derivado | `useAppSelector` + selectors | `StateFlow.map` / `derivedStateOf` | propiedad computada de `@Observable` |
| Swipe | `ReanimatedSwipeable` en UI thread | `SwipeToDismissBox` / `swipeActions` | `.swipeActions` |
| Restauración | `_persist.rehydrated` y estado local de la feature | `DataStore.data.first()` antes de habilitar mutaciones | lectura de `UserDefaults`/modelo antes de editar |

**Decisiones:** se eligió una sola acción de swipe y botón equivalente visible, frente a múltiples acciones ocultas; se eligió el umbral canónico de 80 000 centavos MXN y conversión solo al borde de presentación, frente a comparar el valor USD redondeado. No se añadió `memo`: el compilador de React está activo y el incremento no tenía una medición que lo justificara.

### Registro T5 (2026-10-13)

- Añadidos `CartScreen` y `components/{CartLine,SwipeToDelete,ShippingProgress,EmptyCart,CartRestoring}.tsx`; la ruta del carrito delega en `CartScreen`. Cada línea usa la instantánea persistida, `RemoteImage`, controles de 48 dp y `adjustable` con acciones de accesibilidad. El swipe usa `ReanimatedSwipeable`, revela únicamente «Eliminar» y oculta esa acción duplicada del árbol accesible porque la línea ya expone el botón.
- Eliminados `CartPlaceholderScreen.tsx` y `placeholders.cart.body`. La resta desde cantidad 1 elimina la línea mediante el reducer existente; el lock se consulta antes de cualquier dispatch.
- Verificaciones: `npx expo lint` ✅, `npx tsc --noEmit` ✅, `npm run test:logic` ✅ (853/853). No hay Jest/RNTL/Maestro hasta Día 6 según el plan.
- Matriz manual: iOS Simulator ✅ (carrito con instantánea, subtotal, umbral, árbol AX para decrement/increment/delete/progreso, eliminación accesible y estado vacío con «Ir a Inicio» y checkout deshabilitado; texto grande y tema claro). Android ⏸️ no ejecutado: no había dispositivo/emulador conectado. No se cambiaron dependencias ni configuración nativa.

---

## Día 4 — Estado, carrito y checkout (spec `specs/004-dia-4-estado-carrito-checkout`)

Estado: **en curso**. Diez checkpoints (T1–T10); cada uno empieza con su bloque teórico (RF-1) y termina con validación en Android e iOS (RF-29).

## Día 4 — T1: persistencia del historial con redux-persist + MMKV

### Bloque T1 — Persistir estado de cliente: whitelist, rehidratación y saneado (≈10 min)

**Qué se persiste y qué no.** En HerbStore conviven tres tipos de estado (RF-2):
- *Remoto* (RTK Query, slice `api`): el catálogo, Home, el detalle. Su fuente de verdad es el servidor y RTK Query decide cuándo revalidar (60 s). **Nunca se persiste**: tras reiniciar se pide de nuevo; guardarlo en disco duplicaría una caché que caduca, podría guardar datos de respuestas y haría que un esquema viejo de servidor sobreviviera a una actualización.
- *Global de cliente* (slices de Redux): el historial de búsqueda hoy; el carrito, el intento de checkout y los pedidos locales más tarde. Es lo único candidato a disco, y solo si el usuario espera recuperarlo tras reiniciar (RF-12).
- *Local* (estado de componente): el texto del campo, la cantidad del detalle, el formulario. Muere con la pantalla.

**redux-persist en tres piezas.**
1. `persistReducer(config, rootReducer)`: envuelve el reducer raíz y añade `_persist: { version, rehydrated }`. Tras cada cambio de una clave de la **whitelist** la serializa (JSON) y la escribe en `persist:root`.
2. `persistStore(store)`: despacha `PERSIST`; el reducer lee el disco una vez (`getItem`), pasa el resultado por `migrate` y despacha `REHYDRATE`, que mezcla el estado leído con el inicial (`autoMergeLevel1`: sustituye cada slice de primer nivel). Desde ese momento `_persist.rehydrated` es `true`.
3. El *storage engine*: un objeto `getItem/setItem/removeItem` con promesas. Aquí es MMKV.

**Whitelist frente a blacklist.** Con whitelist, un slice nuevo **no** se persiste hasta que alguien lo añade a mano (`PERSISTED_KEYS` en `core/storage/persist-policy.ts`). Con blacklist, cualquier slice nuevo (por ejemplo, uno con datos de un formulario) acabaría en disco por omisión. Para datos personales (constitución, punto 5; RNF-1) el fallo seguro es "no persistir": whitelist.

**Rehidratar no es leer el disco al vuelo.** El store arranca con el estado inicial y, unos milisegundos después, llega `REHYDRATE`. Lo que dependa de lo persistido (el carrito de T2/T5) debe saber si ya está restaurado: `selectIsRehydrated` lee `_persist.rehydrated`. HerbStore **no** usa `PersistGate` global (que retiene toda la UI hasta rehidratar): Home no depende de lo persistido; cada pantalla afectada muestra su propio estado de restauración (RF-11).

**El disco no es de fiar: saneado y versión.** Lo que se lee puede venir de una versión anterior de la app, de un archivo corrupto o de un JSON truncado. Por eso:
- `PERSIST_VERSION` es la versión del esquema; si lo leído trae otra, todos los slices vuelven a su estado inicial.
- `sanitizePersistedState` valida **slice por slice** con las mismas reglas que lo produjeron: `restoreSearchHistory` reutiliza `normalizeSearchText` y `MAX_SEARCH_HISTORY` y acepta solo un historial que esas reglas pudieron generar (≤10, sin vacíos, recortado y sin identidades duplicadas). Cualquier otra cosa → historial vacío **completo**: "reparar" (quitar una entrada, cortar la cola) inventaría un orden que el usuario nunca produjo.
- Un JSON ilegible hace fallar la lectura de redux-persist y rehidrata con `undefined`: se queda el estado inicial y la siguiente escritura sobrescribe lo corrupto. Ningún caso cierra la app.

**MMKV.** Almacén clave-valor de Tencent sobre un archivo mapeado en memoria (`mmap`): lecturas síncronas y muy rápidas a través de JSI (en v4, con Nitro Modules). Es nativo: exige Development Build y recompilar; no hay config plugin. El adapter (`createSafeStorage`) envuelve cada operación para que **todo resuelva**: un error de lectura devuelve `null` (estado vacío), uno de escritura se informa (solo la operación, nunca el valor) y la app sigue.

| Idea | React Native (HerbStore) | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Almacén clave-valor | MMKV (`react-native-mmkv` 4, JSI/Nitro) | `SharedPreferences` (síncrono, XML) / **DataStore** (Flow, asíncrono, transaccional); MMKV también existe para Android | `UserDefaults` / `@AppStorage`; MMKV también existe para iOS |
| Qué se guarda | whitelist explícita de slices (`PERSISTED_KEYS`) | lo que el repositorio escribe a mano en DataStore | lo que escribes en `UserDefaults` o con `@AppStorage` |
| Serialización | JSON por slice (redux-persist) | Proto DataStore (esquema) o Preferences DataStore (claves tipadas) | `Codable` → `Data`, o tipos primitivos |
| Restaurar al arrancar | `persistStore` → `REHYDRATE`; `_persist.rehydrated` | `dataStore.data.first()` / `stateIn(...)` en el `ViewModel` | `@AppStorage` lee al instanciar; `UserDefaults` es síncrono |
| Datos corruptos | `migrate` + `sanitizePersistedState` → estado inicial | `CorruptionHandler` (`ReplaceFileCorruptionHandler`) de DataStore | `try? JSONDecoder().decode` con valor por defecto |
| Migraciones | `version` + `migrate` | `DataMigration` de DataStore | claves versionadas a mano |

**Errores típicos al venir de nativo.** (1) Persistir todo el store (o la caché `api`): crecen el disco y el arranque y se resucitan datos caducados. (2) Confiar en lo leído como si fuera del tipo de TypeScript: el disco devuelve `unknown`. (3) Leer el carrito antes de `REHYDRATE` y "vaciarlo" con una escritura. (4) Mutar el estado restaurado. (5) Guardar datos personales "temporalmente" en un slice persistido. (6) Olvidar que cambiar una dependencia nativa exige recompilar: Fast Refresh no carga MMKV.

### Decisiones de T1 (RF-3)

- **redux-persist + MMKV con whitelist explícita** (plan). Trade-off: versionado y saneado manuales. Descartado: persistir todo el store o `api`, y AsyncStorage (asíncrono por el bridge, más lento; MMKV ya es el stack obligatorio).
- **Saneado en `migrate`** frente a un `stateReconciler` propio o transforms. Elegido: `migrate` corre una vez entre leer y `REHYDRATE`, recibe el estado completo con su `_persist.version` y nunca rechaza. Trade-off: un slice nuevo exige su restaurador (el tipo lo obliga). Descartado: transforms por clave (no ven la versión) y un reconciliador propio (reimplementar la mezcla).
- **Adapter seguro separado (`persist-storage.ts`) de la instancia MMKV (`mmkv-storage.ts`).** El plan describe un único `mmkv-storage.ts`; se separó la política de fallos en un módulo puro para probar "error de lectura → vacío" en `test:logic` (Node no puede importar MMKV). `mmkv-storage.ts` sigue siendo el único import de MMKV. Descartado: probar el fallo solo a mano en dispositivo.
- **`recoveryStrategy: 'discard-on-error'`** en MMKV: ante un error de CRC/longitud se descarta el archivo en vez de recuperar uno parcial. Trade-off: se pierde el historial en vez de intentar salvar parte. Descartado: `recover-on-error` (un estado a medias que el saneado rechazaría igualmente).
- **Instancia propia `herbstore.persist`** sin cifrado: solo contiene datos no sensibles por diseño (whitelist). Descartado: la instancia por defecto (compartida con cualquier otro uso futuro) y cifrar (exigiría gestionar una clave; constitución, punto 5, ya prohíbe guardar datos sensibles).
- **`overrideExisting: __DEV__` en los tres `injectEndpoints`** (decisión del usuario). Fast Refresh vuelve a ejecutar el módulo e inyecta los mismos endpoints: en desarrollo se sustituyen sin el `ERROR … without overrideExisting` que tapaba errores reales; en producción sigue `false` y un nombre duplicado por error se sigue detectando. Trade-off: en desarrollo un duplicado real se sobrescribe sin aviso. Descartado: ignorar el ruido.

### Versiones instaladas (T1, 2026-10-12, `npx expo install` sobre Expo 57.0.28)

| Paquete | Versión | Nativo | Notas |
| --- | --- | --- | --- |
| `redux-persist` | 6.0.0 | no | Trae sus tipos; sus acciones se excluyen del `serializableCheck`. |
| `react-native-mmkv` | 4.3.2 | sí | v4 = Nitro Modules + JSI; API `createMMKV()`, `getString/set/remove`. Sin config plugin. |
| `react-native-nitro-modules` | 0.37.1 | sí | Peer obligatorio de MMKV v4 (`peerDependencies`). |
| `react-hook-form` | 7.90.0 | no | Se usa en T6. |
| `zod` | 4.6.7 | no | Declarada explícitamente (antes solo transitiva 3.25 vía `@expo/cli`, que conserva su copia). |
| `@hookform/resolvers` | 5.9.1 | no | Peer `zod ^3.25 \|\| ^4`, `react-hook-form ^7.55`. |
| `expo-crypto` | ~57.0.4 | sí | Única de las siete en `bundledNativeModules` de SDK 57; `randomUUID()` y `digestStringAsync` (T8/T9). Sin config plugin. |

### Registro de T1

- Tests primero (rojos por la razón esperada: export/módulo inexistente): `search-history.test.ts` (+`restoreSearchHistory`), `core/storage/persist-policy.test.ts` (whitelist exacta, `api`/`preferences` ausentes, saneado por slice, versión, `migrate` que nunca rechaza y la tubería real de redux-persist sobre un backend en memoria: solo `searchHistory` y `_persist` llegan al disco, reinicio con orden/dedupe/límite, cinco formas de corrupción → vacío y sobrescrito, lectura fallida → vacío) y `core/storage/persist-storage.test.ts`. 566 → 619 tests.
- Nuevos: `core/storage/{persist-policy,persist-storage,mmkv-storage}.ts`, `core/store/rehydration.ts`. Modificados: `core/store/store.ts` (`persistReducer` raíz, `persistStore`, `serializableCheck`), `search/logic/search-history.ts` (`restoreSearchHistory`), comentario de `search-history-slice.ts`, `overrideExisting: __DEV__` en `home-api.ts`, `products-api.ts` y `orders-api.ts`.
- Verificaciones: `npx expo lint`, `npx tsc --noEmit`, `npm run test:logic` (619/619), `npx expo install --check` ("Dependencies are up to date") y `npx expo-doctor@latest` (21/21). `mock-server/` sin cambios. Sin cambios en `app.json`: ni MMKV ni `expo-crypto` necesitan config plugin.
- Development Build recompilado en Android (Gradle; MMKV y Nitro autolinkados) e iOS (CocoaPods: «NitroMmkv is boosted by nitro»). En iOS, `pod install` falló primero porque el `Podfile.lock` generado estaba desfasado respecto a `expo-modules-core` 57.0.22 (anterior a T1); se regeneró borrando `ios/Podfile.lock` y repitiendo `pod install` (salida CNG ignorada, sin edición manual).

### Comprobación propia en dispositivo (T1, 2026-10-12)

| Caso | Android (Samsung SM-A037M, adb) | iOS (simulador iPhone 17 Pro, axe/simctl) |
| --- | --- | --- |
| Contenido de MMKV (`herbstore.persist`) | solo `searchHistory` y `_persist` | igual |
| Orden y deduplicación tras reiniciar | "zinc", "omega", "ZINC" → `["ZINC","omega"]` restaurado | "ZINC", "omega", "zinc" → `["zinc","omega"]` restaurado |
| Límite | 11 búsquedas más → 10, sale la más antigua | cubierto por `test:logic` |
| Quitar una entrada y reiniciar | se mantiene quitada | se mantiene quitada |
| «Borrar todo» y reiniciar | vacío | — |
| Archivo MMKV con basura | vacío, sin cierre | vacío, sin cierre |
| Historial con identidades duplicadas (archivo válido, CRC recalculado) | vacío | — |
| Slice que no es JSON | vacío y sobrescrito con JSON válido | igual |
| Versión de esquema 2 | vacío | vacío |
| Control: edición válida del archivo (`"jj"`→`"kk"`, `"omega"`→`"delta"`) | se restaura tal cual (MMKV acepta el archivo) | igual |
| Fast Refresh de `home-api`, `products-api`, `orders-api` | sin `ERROR … without overrideExisting`; control con `overrideExisting: false` sí lo muestra | sin el error |

Método de la corrupción: con la app detenida se edita el archivo MMKV del contenedor (Android: `run-as`; iOS: `simctl get_app_container`) cambiando bytes de igual longitud y recalculando el CRC32 que MMKV guarda en `herbstore.persist.crc`; así MMKV acepta el archivo y decide solo el saneado de la app. El control con una edición válida demuestra que el vacío viene del saneado y no de un descarte de MMKV. En iOS, la tecla Return por HID (`axe key 40`) no dispara `onSubmitEditing`; las búsquedas se registraron tocando un resultado (también guarda historial, RF-17 del Día 3).

### Validación en dispositivo de T1 a petición del usuario (2026-10-12)

El usuario pidió que el agente ejecutara la validación manual pendiente. Metro sin `CI` (con Fast Refresh), mock en `:3001`, Android con `adb reverse` 8081/3001. Evidencia: árbol de UI (`uiautomator dump` / `axe describe-ui`), contenido de MMKV decodificado hasta el `actualSize` que guarda `herbstore.persist.crc` (CRC32 comprobado), logs de Metro/`logcat`/`log show` y PID nuevo en cada reinicio.

| Caso | Android (Samsung SM-A037M) | iOS (simulador iPhone 17 Pro) |
| --- | --- | --- |
| 1. «zinc», «omega», «ZINC» (enviadas con el teclado) | OK: `["ZINC","omega"]` | OK: `["ZINC","omega"]`, enviadas con la tecla «buscar» del teclado en pantalla |
| 2. Cerrar (`am force-stop` / `simctl terminate`) y reabrir | OK: mismo historial y orden (PID 17322 → 17871) | OK: igual (PID 953 → 1507) |
| 3. 11 búsquedas distintas | OK: quedan 10, sale «vitamina»; igual tras reiniciar | OK: igual, en el dispositivo y tras reiniciar |
| 4a. Quitar «calcio» con su «X» y reiniciar | OK: sigue quitada | OK: sigue quitada |
| 4b. «Borrar todo» y reiniciar | OK: vacío | OK: vacío |
| 5. Contenido de MMKV | OK: una sola clave `persist:root` con `searchHistory` y `_persist`; nada de `api`, catálogo ni `preferences` | OK: igual |
| 6. Archivo sobrescrito con `basura` (había 2 búsquedas) | OK: MMKV registra `check crc … fail` y descarta; sin cierre (0 `FATAL EXCEPTION`), historial vacío; «magnesio» se guarda y sobrevive a otro reinicio | OK: igual (`check crc … fail` en `log show`, sin informes de fallo); «magnesio» sobrevive |
| 7. Identidades duplicadas (`"kelp"`→`"ZINC"` con CRC recalculado) | OK: MMKV carga el archivo («loaded … 1 key-values») y el saneado deja el historial vacío | OK: igual |
| 7. Control: edición válida (`"hemp"`→`"kelp"`) | OK: se restaura `zinc, kelp, magnesio` | OK: igual |
| 8. Fast Refresh editando un comentario de `home-api.ts` | OK: el módulo se vuelve a ejecutar (aviso «Refreshing…» como `PopupWindow` y `[api] GET /home` ~1,5 s después de guardar) sin `without overrideExisting` | OK: `[api] GET /home` ~1 s después de guardar, con Android detenido; sin `without overrideExisting` |

Notas del método:
- **iOS, enviar la búsqueda.** `axe key 40` (y también 88 y 158) no dispara `onSubmitEditing`: es una tecla HID de "teclado físico". Con el teclado físico conectado, iOS minimiza el teclado en pantalla. Se desactivó temporalmente en el simulador `com.apple.keyboard.preferences AutomaticMinimizationEnabled` (con `simctl spawn … defaults write`), se escribió tocando las teclas del teclado en pantalla (nunca `axe type`, porque vuelve a minimizarlo) y se tocó «buscar». Al terminar se restauró el valor 1. No hizo falta tocar un resultado.
- **`strings | tail -1` engaña.** MMKV no pone a cero los bytes que quedan después de `actualSize` al compactar el archivo, así que esa orden muestra restos de historiales anteriores pegados a la última entrada. El contenido real es el que llega hasta `actualSize`. Para el Día 4 (T8, prueba de «cero PII»), esto significa que un valor que se haya escrito alguna vez puede seguir en el archivo como bytes muertos.
- **La señal de Fast Refresh** (`GET /home`) es indirecta: solo aparece si los datos de Home están caducados (más de 60 s). En iOS se hicieron cinco ediciones. La 3.ª y la 5.ª dieron la señal; la 1.ª y la 4.ª se hicieron con los datos aún frescos. La 2.ª no la dio sin una causa clara, y una ráfaga de capturas tampoco mostró el aviso «Refreshing…». En ninguna de las cinco apareció `without overrideExisting`. El último error de ese tipo en `.expo/dev/logs/start.log` es de las 20:56, el control de T1, anterior a esta sesión. El inspector de Metro volvió a cerrar con 1006 la conexión CDP externa.

---

## Día 4 — T2: moneda preferida, carrito puro, selectors y badge real

### Bloque T2 — Estado global frente a local, Redux Toolkit y dinero en centavos (≈10 min)

**¿Dónde vive cada dato?** La regla práctica es preguntar *quién lo lee*:
- Lo lee **una sola pantalla** y muere con ella → *estado local* (`useState`, React Hook Form): la cantidad del detalle, el texto del campo.
- Lo leen **varias pantallas distantes** o debe sobrevivir a una navegación → *estado global de cliente* (Redux): el carrito (lo leen la insignia del tab, el carrito, el detalle y el checkout), la moneda preferida (la lee cada tarjeta de producto).
- Su fuente de verdad **es el servidor** → *estado remoto* (RTK Query): el catálogo y el detalle. El carrito guarda solo una *instantánea* mínima de cada línea (decisión del plan) para poder pintarse sin red; no es el catálogo.

**Anatomía de Redux Toolkit con lo que se construye hoy.**
- *Acción*: un objeto plano `{ type: 'cart/productAdded', payload }` que describe **qué pasó** (no cómo cambia el estado). Los `createSlice` generan los creadores (`productAdded(payload)`).
- *Reducer*: función **pura** `(estadoAnterior, acción) → estadoSiguiente`. No hace red, no lee el reloj y no muta. Aquí delega en funciones puras de `cart.ts` (`addLine`, `decrementLine`…), que son lo que realmente se prueba.
- *Slice*: el trozo del estado que un reducer posee (`cart`, `preferences`, `searchHistory`) más sus acciones. `combineReducers` junta los slices en el store.
- *Selector*: función pura `(estado) → valor derivado` (`selectCartUnits`, `selectSubtotalMxnCents`). Se guarda en el store lo **mínimo** (las líneas) y todo lo demás se **deriva**: guardar también "unidades" o "subtotal" crea dos verdades que pueden desincronizarse. `createSelector` (reselect) memoiza por referencia de entradas; se usa **solo** cuando el selector devuelve un objeto nuevo (`selectShippingProgress`), porque `useSelector` compara con `Object.is` y un objeto nuevo en cada llamada provoca re-renders y un aviso en desarrollo. Un selector que devuelve un número no necesita memoización.
- *Immer*: dentro de `createSlice` puedes escribir `state.x = 1` y Redux Toolkit lo convierte en una copia inmutable con *structural sharing* (lo que no cambió conserva su referencia). Aquí los reducers **devuelven** el siguiente estado construido por funciones puras y, si nada cambió, devuelven el mismo `state`: `Object.is` ve "sin cambio" y ni re-renderiza ni reescribe MMKV.
- Flujo unidireccional: la UI **despacha** un evento → el reducer calcula el estado → los selectors lo leen → la UI se vuelve a pintar. Nada escribe el estado "por la puerta de atrás".

**Dinero: enteros, nunca decimales binarios.** `0.1 + 0.2 === 0.30000000000000004`. Con coma flotante, "¿llegó a 800 MXN?" puede fallar por una millonésima. HerbStore guarda el precio como lo manda el catálogo (`277.9`), pero **toda aritmética** pasa por *centavos enteros de MXN* (el valor canónico, RF-5): `toMxnCents` (USD × 18), suma de líneas en enteros, comparación con `80_000` y, solo al final, `fromMxnCents` (÷ 18 con redondeo *half-up* al centavo) y `Intl.NumberFormat` para el texto. Cambiar de moneda cambia la **vista**, nunca el valor canónico: por eso 799,99 MXN no cumple el umbral y 800,00 sí, también si la pantalla muestra USD.

| Idea | React Native (HerbStore) | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Contenedor de estado global | `store` de Redux + `Provider` | `ViewModel` con `StateFlow<CartState>` (o un repositorio `@Singleton`) | clase `@Observable` inyectada con `.environment` |
| Evento de usuario | acción `dispatch(productAdded(...))` | intención/evento `viewModel.onAddToCart(...)` (MVI) | método del modelo `cart.add(...)` |
| Transición pura | reducer `(state, action) → state` | `state.update { it.copy(...) }` / `reduce(state, intent)` | `mutating func` sobre un `struct`, o `reduce` en TCA |
| Valor derivado | selector (`createSelector` si devuelve objeto) | `map { }.distinctUntilChanged()`, `derivedStateOf` | propiedad computada; `@Observable` solo re-renderiza lo que se leyó |
| Suscripción | `useAppSelector(selector)` + `Object.is` | `collectAsStateWithLifecycle()` | la vista lee propiedades del `@Observable` |
| Inmutabilidad | Immer / copiar y devolver | `data class` + `copy` | `struct` (tipos valor) |
| Dinero | enteros en centavos (`number`) | `Long` en centavos o `BigDecimal` | `Decimal` o `Int` en centavos |

**Decisiones de este bloque.**
- *Centavos enteros* frente a `Decimal`/`BigDecimal` (librería extra) y a `number` decimal. Trade-off: hay que convertir en cada borde. Descartada la coma flotante: hace dudoso el límite exacto de 800 MXN.
- *Selectors que derivan* frente a guardar unidades y subtotal en el store. Trade-off: se recalculan en cada lectura (O(líneas), despreciable). Descartado duplicar estado.
- *`applyStockRefresh` que acota* (decisión del usuario) frente a solo actualizar el número y dejar la cantidad por encima del stock. Trade-off: la cantidad del usuario puede bajar sin que lo pida; por eso devuelve las líneas afectadas para informarle (T9).
- *Restaurar línea por línea* (decisión del usuario) frente a vaciar el carrito entero si una línea falla. Trade-off: se conserva lo válido y se pierde solo lo corrupto. A diferencia del historial de búsqueda (donde reparar inventaría un orden), una línea corrupta es independiente de las demás.

**Errores típicos al venir de nativo.** (1) Mutar el estado fuera de Immer (`state.lines.push(...)` en un `useEffect` o en un selector). (2) Un selector que devuelve un objeto o array nuevo en cada llamada. (3) Guardar en Redux algo derivado (unidades, subtotal). (4) Dinero con `toFixed` y `parseFloat` a mitad de cálculo. (5) Despachar cambios del carrito antes de que termine la rehidratación: el estado leído del disco no se mezcla si el slice ya cambió. (6) `useSelector(state => state)`: re-renderiza con cualquier cambio del store, incluida la caché de RTK Query.

### Decisiones de T2 (RF-3)

- **Centavos enteros MXN como valor canónico** (plan). Toda suma y comparación pasa por `toMxnCents` (USD × 18); `fromMxnCents` (÷ 18, *half-up*) y `Intl.NumberFormat` son el último paso. `toDisplayCents` no convierte cuando la moneda de origen y la de la vista coinciden (MXN → MXN nunca redondea). Trade-off: conversión explícita en cada borde. Descartada: coma flotante (dudoso el límite exacto de 800 MXN) y una librería `Decimal` (dependencia nueva sin necesidad: los importes caben en enteros seguros).
- **Moneda preferida solo en memoria** (decisión del usuario, plan). `preferences-slice.ts` tiene solo `currency` y **no** está en `PERSISTED_KEYS`; el texto del selector avisa de que vuelve a pesos al reiniciar. Trade-off: hay que elegirla de nuevo tras cada arranque hasta el Día 6. Descartada: persistirla ya (la persistencia de preferencias es del Día 6).
- **Todos los precios en la moneda preferida** (decisión del usuario). `buildProductCardModel(product, language, currency)` recibe la moneda como parámetro **obligatorio** (sin valor por defecto, para que ninguna pantalla se olvide) y `ProductCard` la lee con `useAppSelector`. Trade-off: cambiar la moneda repinta todas las tarjetas visibles; es un cambio infrecuente y no se añade `memo` sin medición. Descartada: convertir solo detalle/carrito/checkout (la misma tarjeta en dos monedas según la pantalla).
- **Línea del carrito = instantánea mínima** `{ productId, quantity, name, imagePath?, unitPrice, currency, stock }` (decisión del usuario). El precio es decimal en su moneda de origen, igual que el catálogo; la aritmética convierte a centavos. Invariante: `1 ≤ quantity ≤ stock`, una línea por producto.
- **`restoreCartLines`: línea por línea** (decisión del usuario). Se descartan las líneas inválidas (campos ausentes o de tipo erróneo, cantidad 0 o fraccionaria, `stock` 0, **cantidad mayor que el stock**, moneda desconocida, importe de línea que no sea un entero seguro) y las duplicadas por `productId` (gana la primera); cada línea se reconstruye solo con los siete campos, así que cualquier propiedad extra no sobrevive. Si el slice es ilegible (no es un array), el carrito queda vacío. Trade-off: se conserva lo válido y se pierde solo lo corrupto. Descartada: vaciar todo si falla una línea, y *reparar* (acotar la cantidad al stock), que inventaría una cantidad que el usuario no eligió. `PERSIST_VERSION` sigue en 1: añadir `cart` a la whitelist no cambia la forma de lo ya guardado y un estado de T1 sin `cart` restaura un carrito vacío.
- **`applyStockRefresh` acota y elimina** (decisión del usuario). Actualiza `stock`, deja `min(cantidad, stock)` y elimina la línea con stock 0; devuelve `{ lines, adjustments }` y solo informa de lo que el usuario notaría (líneas acotadas o eliminadas, con su nombre, porque una línea eliminada ya no existe para leerlo). Un stock que sube, o que baja pero sigue cubriendo la cantidad, solo actualiza la cifra. Trade-off: la cantidad puede bajar sin que el usuario lo pida; por eso se informa (T9). Descartada: dejar la cantidad por encima del stock (carrito inconsistente).
- **Umbral de envío gratis en vista USD** (decisión confirmada). `qualifies` y `fraction` salen del valor canónico MXN; el restante convertido nunca se muestra como `$0.00` mientras no se cumpla (mínimo 1 centavo). Con la vista en USD, 44,44 USD son 799,92 MXN: no cumple aunque la cifra coincida con el umbral mostrado (4 444 centavos); 44,45 USD (800,10 MXN) sí. Trade-off: el restante mostrado puede ser unos centavos mayor que el real. Descartada: decidir con la cifra redondeada de la vista.
- **Selectors:** `selectCartUnits`, `selectSubtotalMxnCents` y `selectCartLines` son funciones planas (devuelven un número o la misma referencia); `selectDisplaySubtotal` (`{ cents, currency }`) y `selectShippingProgress` usan `createSelector` **solo** porque devuelven un objeto: sin memoización cada llamada produciría un objeto nuevo y `useSelector` re-renderizaría con cualquier acción del store. `selectIsCartLocked` es en T2 solo `!selectIsRehydrated`; `selectIsRehydrated` acepta `Pick<RootState, '_persist'>` para probarse en Node con un estado hecho a mano. Descartado: guardar unidades y subtotal en el store.
- **Los reducers devuelven el mismo `state` si nada cambió** (no solo los nuevos arrays): redux-persist no reescribe MMKV y nada se repinta. Los reducers **no** conocen el bloqueo por rehidratación: quien cambie el carrito consulta `selectIsCartLocked` antes de despachar (plan). Descartado: que el reducer ignore acciones (no ve `_persist`).
- **`CurrencyCode` se queda en `product/contracts/catalog-product.ts`**; `currency.ts` lo importa solo como tipo. Trade-off: `preferences` depende de un tipo de `product`. Descartado: mover el tipo y reescribir el contrato del catálogo (fuera de alcance).
- **Retirada de H-4:** `CartDevControls.tsx`, `cart-count-source.ts` (+ su test), `use-cart-count.ts` y los textos `cartDev.*` ya no existen; el layout de tabs solo cambia la fuente del número (`useAppSelector(selectCartUnits)`), con `getCartBadge` y su etiqueta hablada intactos. Se pierden los atajos 0/5/100: se prueban con el estado persistido y los tests.

### Registro de T2

- Tests primero (rojos por la razón esperada: módulos inexistentes, y las cuatro aserciones de conversión de `buildProductCardModel`). 619 → **764** tests de lógica (se retiraron 5 de `cart-count-source`): `currency.test.ts` 14, `cart.test.ts` 71, `cart-selectors.test.ts` 24, `cart-slice.test.ts` 13, `preferences-slice.test.ts` 6, `persist-policy.test.ts` 47 (ampliado: whitelist exacta `['searchHistory', 'cart']`, saneado del carrito y la tubería real de redux-persist con el carrito) y `product-card.test.ts` 16 (ampliado a la moneda preferida). Incluyen una prueba exhaustiva USD → MXN → USD (exacta para cada centavo de 0 a 2 000 USD) y MXN → USD → MXN (pérdida máxima de 9 centavos MXN).
- Nuevos: `preferences/logic/currency.ts`, `preferences/store/preferences-slice.ts`, `preferences/components/CurrencySelector.tsx`, `cart/logic/cart.ts`, `cart/logic/cart-selectors.ts`, `cart/store/cart-slice.ts`. Modificados: `core/storage/persist-policy.ts`, `core/store/{store,rehydration}.ts`, `product/logic/product-card.ts`, `product/components/ProductCard.tsx`, `account/screens/AccountPlaceholderScreen.tsx`, `cart/screens/CartPlaceholderScreen.tsx` (sin el bloque `__DEV__`), `app/(tabs)/_layout.tsx`, `core/i18n/resources/{es,en}.ts` (`preferences.currency.*`; sin `cartDev.*`).
- Verificaciones: `npx expo lint` (sin avisos), `npx tsc --noEmit` y `npm run test:logic` (764/764). Sin cambios de dependencias ni de `app.json`: no hacen falta `expo install --check` ni Doctor; Metro basta (sin recompilar).
- Búsqueda en el repositorio (excluyendo `specs/`, `LEARNING.md` y `MEMORY.md`, que los citan como historia): `CartDevControls`, `cartDev`, `cart-count-source`, `use-cart-count`, `useCartCount` y `cartCountSource` no aparecen en `src/`.

### Validación en dispositivo de T2 por el agente, a petición del usuario (2026-10-12)

Metro sin `CI` y mock en `:3001`; Android Samsung SM-A037M por USB (`adb reverse` 8081 y 3001 como estaba) e iPhone 17 Pro (simulador). Como aún no hay UI para agregar productos, el carrito se **sembró escribiendo el archivo MMKV con la app detenida**, con una herramienta temporal fuera del repositorio que recalcula el CRC32. Evidencia: árbol de accesibilidad (`uiautomator dump` / `axe describe-ui`), capturas, volcado del MMKV hasta el `actualSize` del `.crc` y `logcat` (0 `FATAL EXCEPTION`).

| Caso | Android | iOS |
| --- | --- | --- |
| Carrito vacío → sin badge, etiqueta «Carrito» | OK | OK |
| 5 unidades (2 líneas: MXN y USD) → badge «5», etiqueta «Carrito, 5 artículos» | OK (captura: badge rojo «5») | OK |
| 99 unidades → «99», «Carrito, 99 artículos» | OK (captura: «99») | OK |
| 100 unidades → etiqueta hablada «Carrito, 100 artículos» | OK | OK |
| 100 unidades → texto visible `99+` | **NO: se dibuja «9…»** (anomalía A-1; corregida y revalidada, ver «Corrección de A-1») | **NO: «9…»** (anomalía A-1; corregida y revalidada) |
| Sobrevive al reinicio, estado escrito por la propia app (se toca «zinc» del historial; el MMKV pasa a `{searchHistory:[zinc,omega], cart:{2 líneas}}` y tras `force-stop`/`terminate` el badge sigue en 5) | OK | OK |
| Línea inválida entre válidas (cantidad 0, cantidad > stock, duplicada, válida) → quedan 2 líneas, badge 4 | OK | OK |
| Slice `cart` JSON de forma errónea (`"corrupt"`) → carrito vacío y el historial **se conserva** | OK | OK |
| Slice `cart` que no es JSON → todo vacío (historial incluido; límite de redux-persist, anomalía A-2), sin cierre | OK | OK |
| Versión de esquema 2 → todo vacío, sin cierre | OK | OK |
| Archivo con CRC inválido → MMKV lo descarta (`check crc … fail` en Android), todo vacío, sin cierre | OK | OK |
| Historial de T1 conservado junto al carrito (`omega`, `zinc` visibles en Búsqueda en todos los casos válidos) | OK | OK |
| Cuenta muestra el selector (MXN seleccionado por defecto, relleno), textos es y en | OK | OK |
| Home en MXN: «Daily Balance Powder» (USD 11.99 de origen) → `$215.82`; «Everyday Whey Tablets» (MXN) → `$277.90` | OK | OK |
| Home en USD: `USD 15.44` (277,90 MXN), `USD 11.99` (sin tocar), `USD 48.94` (880,90 MXN) | OK | OK |
| Lista de categoría (Vitaminas) MXN ↔ USD: `USD 12.99, antes USD 15.59` ↔ `$233.82, antes $280.62`; `$179.82` ↔ `USD 9.99` | OK | OK |
| Búsqueda «zinc» en USD: `USD 24.55` (441,90 MXN), `USD 9.16`, `USD 11.77, antes USD 14.13` | OK | OK |
| Inglés: USD → `$15.44`, MXN → `MX$277.90` / `MX$215.82` | OK | OK |
| MMKV nunca contiene `preferences`; tras reiniciar la vista vuelve a MXN | OK | OK |
| Texto al 200 % (Android, Cuenta): el selector se parte en dos filas sin recortar | OK | — |

Notas del método y hallazgos:
- **Formato MMKV 4.3.2 (comprobado con los archivos reales).** El `.crc` guarda el CRC32 de `datos[4 : 4 + actualSize]` (desplazamiento 0, little-endian) y `actualSize` en 0x1C. Los 4 primeros bytes del archivo de datos están sin usar (conservan restos, p. ej. `basu` de la prueba «basura» de T1). El contenido empieza con un varint de 4 bytes que MMKV salta y sigue con pares `varint(len(clave)) clave varint(len(valor)) valor`; para un string, `valor` es `varint(len) bytes`. Con eso se puede escribir un valor de **otra longitud** (no solo ediciones del mismo tamaño como en T1): se recalcula el CRC, se actualiza `actualSize` y se pone a cero el resto del archivo, para que el valor antiguo no sobreviva como bytes muertos.
- **A-1 (anomalía, CORREGIDA después): `99+` se dibujaba «9…» en ambas plataformas.** Con 99 se veía «99». El texto que recibe el tab era `'99+'` (`getCartBadge` no cambió) y la etiqueta hablada era correcta, pero el `Badge` de la navegación truncaba lo que no cabía. No se debía a T2 (solo cambió el origen del número). El usuario decidió corregirlo dentro de T2: causa real, cambio y revalidación en «Corrección de A-1» (más abajo). La causa que aquí se apuntó (contenedor de 24 dp) era inexacta: son 31 dp.
- **A-2: un slice que no es JSON vacía todo el estado persistido.** redux-persist convierte cada slice con `JSON.parse` antes de llamar a `migrate`; si uno falla, descarta el estado completo (el historial también). Un slice con JSON válido pero forma errónea sí se sanea slice por slice. Es el mismo comportamiento que T1 ya registraba; nunca cierra la app.
- Ni `axe` ni `uiautomator` exponen el rasgo *selected* de los botones del selector (`accessibilityState.selected` lo pone `AppButton`, sin cambios): el estado seleccionado se comprobó viendo el botón relleno en las capturas.
- Limpieza: MMKV restaurado a los archivos originales (historial vacío, sin `cart`) en ambos dispositivos, `font_scale` en 1.0, `adb reverse` 8081/3001 como estaba, `AutomaticMinimizationEnabled` sin tocar (1), Metro y mock detenidos, sin `.env.local` ni cambios temporales en el repositorio.

### Corrección de A-1: el badge `99+` (2026-10-12, a petición del usuario)

**Concepto (breve): una caja absoluta no «pide» espacio, lo recibe.** En React Native todo se maqueta con Yoga (flexbox). Un hijo con `position: 'absolute'` sale del flujo: sus `top/start/end` lo colocan respecto al contenedor, pero **no** le dan un ancho. Si además no tiene `width` explícito, Yoga mide su contenido con el ancho del contenedor como máximo; con `numberOfLines={1}` el texto que no cabe se recorta con «…». Un `Text` solo conoce su tamaño tras medirse, y esa medida depende de la fuente, del relleno y de la escala del texto del sistema.

| Idea | React Native (HerbStore) | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Insignia sobre un icono | `Text` absoluto dentro del contenedor del icono, con ancho máximo = el del contenedor | `BadgedBox(badge = { Badge { Text("99+") } })`: la insignia mide su contenido (alto 16 dp, 11 sp, relleno 4 dp) y crece hacia fuera | `.badge("99+")` / `.badge(100)`: el sistema dibuja y dimensiona la píldora |
| Quién decide el ancho | el layout, a mano (aquí: la librería de navegación) | `Layout` de `BadgedBox` | UIKit/SwiftUI |
| Texto ampliado | `allowFontScaling` + `maxFontSizeMultiplier` (en un `Text` propio) | `sp` escala solo; se acota con `LocalDensity` / `fontScale` | Dynamic Type; se acota con `dynamicTypeSize(...)` |
| Si no cabe | `numberOfLines` + «…» (o `adjustsFontSizeToFit`) | `maxLines` + `TextOverflow.Ellipsis` | `lineLimit` + `…` o `minimumScaleFactor` |

**Causa raíz real (leída en `node_modules/expo-router/build/react-navigation/`, no recordada).**
- `TabBarIcon.js`: el contenedor del icono es `wrapperUikit` = **31 × 28 dp** (el diagnóstico anterior hablaba de 24 dp: es la variante `material`, que aquí no se usa). El icono mide 25 dp y va centrado.
- `elements/Badge.js`: un `Animated.Text` con `numberOfLines={1}`, `fontSize = floor(size × 0,75)` = **14** (con `size` = 25 × 0,75 = 18,75), `paddingHorizontal: 4`, alto fijo 18,75 y `minWidth` 18,75. En `TabBarIcon` se posiciona con `position: 'absolute'`, `end: -3`, `top: -3` y **sin ancho**.
- Yoga limita ese hijo al ancho del contenedor (31 dp), sea cual sea el desplazamiento. Medido en Android: el `TextView` truncado ocupaba exactamente 58 px = 31 dp (1,875 px/dp). «99+» a 14 sp necesita ≈ 33 dp (texto ≈ 25 + relleno 8) → no cabe → «9…». «99» necesita ≈ 25 dp y cabe: por eso 99 se veía bien y 100 no.
- Dos agravantes: el texto del badge **escala** con el tamaño de fuente del sistema (`tabBarAllowFontScaling` no estaba desactivado) dentro de una píldora de alto fijo, así que con ≈ 1,4× ya «99» se truncaría; y al anclarse por `end` un badge más ancho crece **hacia el icono** y lo tapa (en la captura inicial cubría casi todo el carrito).
- Por qué la prueba anterior no lo vio: el árbol de accesibilidad (`uiautomator`/`axe`) devuelve el texto completo `99+` aunque se dibuje «9…». Esta anomalía solo se detecta con captura.

**Cambio realizado (solo estilo; sin `Platform.select`, la diferencia es la misma en ambas plataformas).**
- Nuevo `src/features/navigation/tab-bar-badge.ts`: `tabBarBadgeStyle` con `fontSize: 12`, `paddingHorizontal: 3`, `start: 21`, `top: -4` y `end: undefined`. Con 12 sp y relleno 3, «99+» mide **27,2 dp** (medido) y deja ≈ 3,8 dp de margen bajo los 31. El ancla pasa de `end` a `start` (21 dp, el borde izquierdo): el badge solo roza la esquina superior derecha del icono y un texto más largo crece hacia fuera. `end` debe quedar sin valor: con `start` y `end` a la vez Yoga fija el ancho a `31 − start − end` y todos los badges serían la misma píldora.
- `src/app/(tabs)/_layout.tsx`: `tabBarBadgeStyle` y `tabBarAllowFontScaling: false` en `screenOptions`. Solo el badge lee ese flag (la etiqueta del tab es una función propia y lo ignora), así que las etiquetas conservan su escala acotada.
- `getCartBadge`, su test, la etiqueta hablada y el resto de T2 no cambian.

**Decisión (RF-3).**
- **Elegida:** conservar el `Badge` de la navegación (color del tema, contraste automático, animación de aparición) y cambiar solo su estilo: fuente de 12 sp, relleno de 3 dp, ancla por `start`, sin escalado de texto. **Trade-off:** el badge no crece con el texto ampliado (a 2,0× las etiquetas sí crecen, hasta su tope, y el badge no) y su cifra es 2 sp menor que antes; el dato completo sigue en la etiqueta hablada («Carrito, 100 artículos»). En iOS las etiquetas del tab ya tenían el escalado desactivado a propósito (la vista de contenido grande muestra el título), así que el badge pasa a ser coherente con ellas.
- **Descartada 1: badge propio** (un `Text` dentro de `tabBarIcon` con `maxFontSizeMultiplier` y sin tope de ancho). Permitiría un escalado acotado, pero reimplementa color, contraste y animación, y deja de usar `tabBarBadge`. Se reconsidera en la auditoría del Día 6 si se exige que el badge escale.
- **Descartada 2: dejar escalar** el texto del badge, con `fontSize` más pequeño. A partir de ≈ 1,4× vuelve a truncar, con un alto fijo de 18,75 dp.
- **Descartada 3: fijar `width`** a ≈ 34 dp solo para la cadena `99+`. Se rompe con otra fuente (la de Samsung es más ancha) y todas las píldoras con texto serían iguales.
- **Sin test de lógica:** el arreglo es puramente de estilo y la medida depende de Yoga y de la fuente del dispositivo; un test de un objeto de estilo no probaría nada. Se valida en dispositivo.

**Validación en dispositivo (agente, a petición del usuario; Metro sin `CI`, mock en `:3001`, carrito sembrado en MMKV con la app detenida y CRC recalculado). Evidencia: captura del tab bar + árbol de accesibilidad.**

| Caso | Android (Samsung SM-A037M) | iOS (iPhone 17 Pro, simulador) |
| --- | --- | --- |
| 0 unidades → sin badge, etiqueta «Carrito» | OK | OK |
| 5 → «5», etiqueta «Carrito, 5 artículos» | OK | OK |
| 99 → «99», «Carrito, 99 artículos» | OK | OK |
| **100 → `99+` completo**, «Carrito, 100 artículos» | **OK** (TextView 27,2 dp de ancho, antes 31 dp truncado) | **OK** |
| Texto ampliado, 100 → `99+` completo, sin recorte, sin tapar el icono | OK con `font_scale` 1,3, 1,5 y 2,0 (el badge mantiene su tamaño: 51 × 36 px en todos) | OK con `accessibility-extra-extra-extra-large` (app reiniciada tras cambiar el tamaño) |
| Texto ampliado, 99 y 5 | OK a 2,0 | OK |
| Etiqueta hablada (`content-desc` / `AXLabel` del tab) | intacta en todos los casos | intacta en todos los casos |

Comprobaciones: Metro sin avisos ni errores (`end: undefined` no genera advertencia de estilo) y `logcat` con 0 `FATAL EXCEPTION`.

**Anomalías y notas.**
- **H-1/H-11 observado, no tocado (Día 6):** con `font_scale` ≥ 1,3 los iconos del tab bar de Android salen recortados (a 2,0 el carrito pierde el cuerpo y el de Cuenta queda partido). El badge no empeora esto: no escala, y ya no cubre el icono.
- **Método:** la primera captura tras un arranque en frío del dev client puede salir en blanco (un velo del launcher) aunque el árbol de accesibilidad ya sea correcto; hay que repetir la captura o esperar.
- **Plan:** `plan.md` («Retirada de H-4») dice que el layout «solo cambia la fuente»; ahora también declara `tabBarBadgeStyle` y `tabBarAllowFontScaling`. No se ha editado el plan; queda para el planificador si el usuario lo considera necesario.
- Limpieza: MMKV restaurado byte a byte a los archivos originales (historial vacío, sin `cart`) en ambos dispositivos; `font_scale` 1,0; `content_size` del simulador `large` (era `large`); `appearance` `light` sin tocar; `AutomaticMinimizationEnabled` sin tocar; `adb reverse` 8081 y 3001 como estaba; Metro y mock detenidos; sin `.env.local`.

### Comparación Android / iOS de T2 (para repasar)

| Concepto | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- |
| Badge del tab | `NavigationBarItem` con `BadgedBox { Badge { Text("99+") } }` (el límite lo pones tú) | `.badge(100)` en `TabView`: el sistema lo dibuja |
| Estado de la preferencia de moneda | `MutableStateFlow<Currency>` en un `ViewModel` de aplicación | propiedad de un `@Observable` en `.environment` |
| Selector de dos opciones | `SingleChoiceSegmentedButtonRow` | `Picker` con `.pickerStyle(.segmented)` |
| Dinero | `Long` en centavos (o `BigDecimal`) y `NumberFormat.getCurrencyInstance(locale)` | `Decimal` y `.formatted(.currency(code:))` |
| Restaurar con datos corruptos | `ReplaceFileCorruptionHandler` + validar cada elemento al leer | `try?` al decodificar cada elemento con `Codable` y descartar el que falle |

## Día 4 — T3: detalle real con stock vigente y retirada de `OrderDevControls`

### Bloque T3 — Una pantalla de detalle: composición, estado local y compartir (≈10 min)

**Composición: contenido que se desplaza + barra fija.** El detalle es una `View` con `flex: 1` que contiene DOS hermanos: un `ScrollView` (galería, textos, cantidad) y la barra de compra (`StickyAddBar`). La barra es hermana del scroll, **no** hija: así nunca se desplaza y el scroll recibe exactamente el espacio que sobra. Alternativas descartadas: `position: 'absolute'` abajo (hay que reservar a mano un `paddingBottom` igual a la altura de la barra, que cambia con el texto ampliado) y `stickyHeaderIndices` (pega *cabeceras* arriba, no una barra al fondo).
- *Safe area:* la barra **no** suma el inset inferior del dispositivo. La pantalla vive dentro del tab navigator y el tab bar queda debajo (ya cubre el indicador de inicio): rellenar con `useSafeAreaInsets().bottom` contaría ese espacio dos veces. La cabecera nativa del `Stack` ya resuelve el inset superior.
- *Teclado:* aquí no aplica, el detalle no tiene campos de texto. Donde sí hay (el formulario de checkout, T6) se usa `automaticallyAdjustKeyboardInsets` en el `ScrollView` o `KeyboardAvoidingView`.

**¿Dónde vive cada dato?** (retoma el bloque de T2)
- *Remoto* (RTK Query): el producto y su `stock` vigente. Se pide con `getProduct` y se refresca con la misma regla de 60 s de todas las pantallas.
- *Global* (Redux): la moneda preferida; el detalle solo la **lee**.
- *Local* (`useState`): la cantidad. Solo la pantalla la usa y muere con ella. Lo que llega al carrito es la acción de T4, no la cantidad.
- **Derivar en vez de sincronizar.** Si una revalidación baja el stock por debajo de lo elegido (5 elegidas, quedan 2), la pantalla no necesita un `useEffect` que corrija el estado: guarda la *elección* y **dibuja siempre** `clampQuantity(elección, stock)`. React 19 penaliza `setState` síncrono dentro de efectos y dos copias del mismo dato acaban desincronizadas.
- **Reiniciar estado con `key`.** La ruta de producto es *singular*: abrir B desde A **reutiliza** el componente con otro `id`. `<ProductDetailContent key={product.id}>` lo remonta y la cantidad de A no pasa a B, sin efectos.
- **`data` frente a `currentData` (error real, ver «Hallazgos»).** El hook de RTK Query devuelve en `data` el último resultado *de cualquier argumento*; `currentData` solo el del argumento actual. Con una ruta singular, `data` pintaba el producto A bajo el `id` de B hasta que llegaba B.

**`expo-image` (lo que ya hace `RemoteImage`).** Cachea en **disco** por defecto (`cachePolicy: 'disk'`; `'memory-disk'` añade memoria) y decodifica fuera del hilo de JS; `placeholder` y `transition` suavizan la llegada; `recyclingKey` evita ver el bitmap anterior en vistas recicladas. Aquí el *placeholder* es el marco cuadrado de color neutro (el servidor genera imágenes planas: un blurhash no se justifica), el cierre cruzado de 200 ms se pone a 0 con movimiento reducido y un fallo muestra texto visible («Imagen no disponible»). La galería es un `ScrollView` horizontal con `pagingEnabled` (2 imágenes: sin virtualización) y puntos decorativos; el *viewport* es un único elemento accesible `adjustable` («Imagen 1 de 2») con acciones siguiente/anterior.

**Compartir.** `Share.share({ title, message }, { dialogTitle })` de React Native abre la hoja del sistema. En **Android el campo `url` se ignora** (solo viaja `message`), en iOS `message` y `url` son campos distintos (leído en `node_modules/react-native/Libraries/Share/Share.js`). Por eso el enlace va **dentro del mensaje**: un solo texto idéntico en ambas plataformas. El enlace es `herbstore://product/<id>`, el mismo esquema de `app.json` que `core/navigation/linking.ts` ya normaliza a la ruta `/product/<id>`; un test comprueba esa ida y vuelta. Que otra app abra el enlace es del Día 5.

| Idea | React Native (HerbStore) | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- | --- |
| Contenido + barra fija | `View` con `ScrollView` + `StickyAddBar` hermanos | `Scaffold(bottomBar = { BottomAppBar { … } })` | `.safeAreaInset(edge: .bottom) { … }` |
| Estado local de la pantalla | `useState` (muere con la pantalla) | `rememberSaveable { mutableIntStateOf(1) }` | `@State private var quantity = 1` |
| Reiniciar al cambiar de producto | `key={product.id}` | `key(productId) { … }` o un `ViewModel` por id | `.id(productId)` en la vista |
| Dato derivado en vez de copia | `clampQuantity(elección, stock)` en el render | `derivedStateOf { min(…) }` | propiedad computada |
| Galería paginada | `ScrollView horizontal pagingEnabled` | `HorizontalPager` | `TabView { … }.tabViewStyle(.page)` |
| Imagen remota | `expo-image` (disco + memoria, `transition`) | Coil `AsyncImage` (memoria + disco) | `AsyncImage` (sin caché propia) o Nuke/Kingfisher |
| Cantidad accesible | `accessibilityRole="adjustable"` + `accessibilityActions` | `Modifier.semantics { stateDescription = …; customActions = … }` | `Stepper` / `.accessibilityAdjustableAction` |
| Compartir | `Share.share` (hoja del sistema) | `Intent.createChooser(ACTION_SEND)` | `ShareLink(item:)` / `UIActivityViewController` |

**Errores típicos al venir de nativo.** (1) Leer `data` creyendo que es «el dato de este id» (`currentData`). (2) Guardar la cantidad corregida con un efecto en lugar de derivarla. (3) Una barra «fija» que es hija del scroll o que ignora el texto grande. (4) Una línea de texto que *aparece* al final de una pantalla con scroll: cae detrás de la barra y nadie la ve. (5) Fiarse de `url` en `Share` en Android. (6) Un botón de «+» deshabilitado en el máximo: ya no puede «intentar superar» el stock ni anunciar el límite.

### APIs reales comprobadas (código instalado, Expo 57.0.28 / RN 0.86.3)
- `Share` (`react-native/Libraries/Share/Share.js` y `.d.ts`): Android solo usa `title` y `message` (`dialogTitle` como título del selector); iOS pasa `message`, `url` y `subject`. Devuelve una promesa (`sharedAction` | `dismissedAction`; en Android siempre `sharedAction`). Un fallo se captura con `.catch` y solo se registra en desarrollo.
- `expo-image` ~57.0.5 (`build/Image.types.d.ts`): `cachePolicy` (`'disk'` por defecto), `placeholder`, `priority`, `recyclingKey`, `transition`; el componente ya existía como `RemoteImage` y no se tocó.
- `AccessibilityInfo.announceForAccessibility`, `accessibilityRole="adjustable"`, `accessibilityValue.text` y `accessibilityActions` (ya usados por el carrusel de Home): en Android `increment`/`decrement` se registran como `ACTION_SCROLL_FORWARD`/`BACKWARD` con la etiqueta dada (comprobado con la herramienta `A11y`: «Aumentar cantidad» / «Disminuir cantidad», «Imagen siguiente» / «Imagen anterior»).
- Sin dependencias nuevas, sin cambios de `app.json` ni nativos: Metro basta (no se recompiló).

### Decisiones de T3 (RF-3)
- **Compartir: botón con texto en el contenido** (Elegida) frente a una acción de la cabecera (Descartada). Trade-off: ocupa una fila del contenido; ganan el texto visible («Compartir»), el objetivo táctil de 48 dp y el escalado con la fuente (los iconos de cabecera no escalan). **Mensaje único con el enlace dentro** (Elegida) frente a `message` + `url` por plataforma con `Platform.select` (Descartada): duplicaría el enlace en iOS y añade una rama que el Día 5 decidirá con validación nativa.
- **Cantidad en el cuerpo, total + botón en la barra.** Trade-off: para cambiar la cantidad hay que desplazarse hasta ella (el total de la barra se actualiza siempre). Descartada: el selector dentro de la barra: con texto ampliado dos controles + total no caben y la barra crecería aún más.
- **La cantidad es estado local de la elección y se muestra siempre acotada** (Elegida) frente a un efecto que corrija el estado o a guardarla en Redux (Descartadas, ver el bloque).
- **El botón «Agregar al carrito» existe pero NO hace nada en T3** (Elegida, lectura literal del plan): el despacho de `cart/productAdded`, el feedback animado y las reglas de carrito bloqueado/rehidratación son de T4 (`onAdd` es opcional y la pantalla no lo pasa). Solo el estado «agotado» sí se presenta ya: la barra muestra «Agotado» desactivado y sin total, y se oculta el selector. Trade-off: durante T3 el botón se pulsa sin efecto.
- **Línea de límite permanente** («Máximo disponible: 3 unidades.», en negrita al intentar superarlo) más `announceForAccessibility` (Elegidas). Primera versión descartada: un texto que *aparecía* solo al superar el stock: caía detrás de la barra fija y no se veía (hallazgo de la validación). El «+» **se queda habilitado** en el máximo para poder anunciar el límite; el «−» se desactiva en 1.
- **La barra no suma el inset inferior** (el tab bar ya lo cubre); descartado `useSafeAreaInsets().bottom`.
- **Galería: se reutilizan las funciones puras de `home/carousel/banner-pager`** (offset ↔ índice, paso acotado, «n de N»). Trade-off: `product` importa de `home` y los nombres dicen «banner». Descartadas: copiarlas (dos fuentes de verdad) y moverlas a `core/` (refactor de código ya aprobado de otro día; queda como mejora). Los puntos son decorativos: el *viewport* `adjustable` es la alternativa accesible.
- **`parseProductDetail` rechaza el payload donde `inStock` y `stock > 0` discrepan** (Elegida; el servidor deriva uno del otro, así que una discrepancia no es el contrato) frente a fiarse de uno de los dos. El modelo de la pantalla decide por el **número**.
- **El total convierte la línea completa** (`cantidad × precio canónico`, luego `fromMxnCents`), como el subtotal del carrito, y no `cantidad × precio unitario redondeado`: 5 unidades de 149,90 MXN son USD 41,64, no 41,65. Así el detalle y el carrito coinciden.
- **Topes de escala del texto** medidos en iOS AX5 (3,1–3,6×): `productTitle` (2,0) para nombre y precio («Magnes / ium / Glycina / te» sin tope), `sectionHeading` (2,0, ya existente) para «Descripción» y «Cantidad», y `purchaseBar` (2,0) para la barra: sin tope ocupaba el 43 % de la altura y dejaba solo la imagen para desplazar; con 2,0 ocupa ≈ 22 %. Android no cambia (su máximo es 2,0).
- **Revalidación a los 60 s con `useRevalidateWhenStale`** (foco, primer plano, reconexión), porque el stock en pantalla solo es tan fresco como la última respuesta. Con datos y un fallo posterior el detalle sigue mostrando el producto (sin fila de aviso, como el placeholder). Descartado: un aviso «sin conexión» propio del detalle (no pedido por el plan).
- **El detalle NO despacha `stockRefreshed`** al cargar: refrescar la instantánea de las líneas del carrito desde el detalle no está en el «Hecho cuando» de T3; queda para T4/T5, que tocan el carrito. Anotado como seguimiento.
- **Mock:** `GET /products/:id` y `/products/barcode/:code` devuelven `stock` (inventario vigente de `OrderStore.availableStock`) e `inStock = stock > 0`; listas, búsqueda y Home no cambian (decisión del usuario). Limitación documentada: un producto agotado durante la sesión del mock sigue saliendo disponible en listas y Home (comprobado: tras una orden de sus últimas unidades el detalle dice «Agotado» y la lista sigue sin etiqueta).
- **Texto del servidor sin traducir:** `description` y `servingInfo.size` llegan en inglés del mock («2 capsules») y se muestran tal cual dentro de textos localizados («Porción: 2 capsules»). Es contenido de catálogo, no interfaz.

### Retirada del andamiaje del Día 3 (H-4)
Borrados: `ProductPlaceholderScreen.tsx` (y su `require` condicional bajo `__DEV__`), `checkout/components/OrderDevControls.tsx` (la carpeta `components` queda vacía y desaparece), `checkout/logic/dev-order.ts` y `dev-order.test.ts` (11 tests), los textos `orderDev.*`, `product.placeholderNote` y `product.idLabel` (es/en). `order-log.test.ts` usa una dirección ficticia local. Se conservan `orders-api.ts`, `order-log.ts`, `order-invalidation.ts` y `contracts/*` (los usa T7–T9). La búsqueda en `src/` (y en `mock-server/`) de `OrderDevControls`, `orderDev`, `dev-order`, `DEV_SHIPPING_ADDRESS`, `ProductPlaceholderScreen` y `placeholderNote` no devuelve nada. Se pierde el atajo «crear orden de prueba»: en adelante se prueba con `curl POST /orders` (así se redujo el stock de varios productos durante la validación) y con el flujo real de T9.

### Registro de T3
- Tests primero (rojos por la razón esperada: módulos y exportaciones inexistentes; en el mock, `availableStock is not a function` y el `stock` ausente). Lógica: 764 → **810** (+57: `quantity` 13, `product-share` 3, `product-detail` 14, `parse-catalog-product` +27, `product-lookup` ya existente con el tipo nuevo; −11 de `dev-order`). Mock: 73 → **81** (2 de `OrderStore.availableStock` y 6 HTTP en «product stock on the detail endpoints»; el de «id y barcode» se actualizó a `{ …producto, stock: 99, inStock: true }`). La semilla del catálogo no cambia (SHA-256 del catálogo generado idéntico antes y después: `838f7038…`).
- Nuevos: `product/logic/{quantity,product-share,product-detail}.ts`, `product/components/{ProductGallery,QuantitySelector,StickyAddBar}.tsx`, `product/screens/ProductDetailScreen.tsx`. Modificados: `product/contracts/{catalog-product,parse-catalog-product}.ts` (`ProductDetail`, `ServingInfo`, `parseProductDetail`), `product/data/products-api.ts` (`getProduct` → `ProductDetail`), `product/logic/product-lookup.ts`, `app/(tabs)/(home)/product/[id].tsx`, `design-system/tokens.ts` (`productTitle`, `purchaseBar`), `core/i18n/resources/{es,en}.ts`, `checkout/contracts/order.ts` (un comentario) y, en el mock, `orders/order-store.js`, `routes/products.js`, `server.js`, README y tests.
- Verificaciones: `npx expo lint` (0 avisos), `npx tsc --noEmit`, `npm run test:logic` (810/810) y `npm --prefix mock-server test` (81/81). Sin cambios de dependencias ni de `app.json`: no hacen falta `expo install --check` ni Doctor; no se recompiló el Development Build.

### Validación en dispositivo de T3 por el agente, a petición del usuario (2026-10-12/13)
Metro sin `CI` y mock en `:3001`; Android Samsung SM-A037M por USB (`adb reverse` 8081 y 3001 como estaba) e iPhone 17 Pro (simulador). El stock se forzó con `curl POST /orders` (medio temporal, nada en el repositorio). Evidencia: árbol de accesibilidad (`uiautomator`, `axe describe-ui`, herramienta `A11y` ampliada con una orden `perform`), capturas y logs de Metro.

| Caso | Android | iOS |
| --- | --- | --- |
| Detalle con galería, marca, nombre, calificación, precio, «Disponible: 99 unidades», porción, descripción, cantidad, barra | OK | OK |
| Galería: deslizar cambia de imagen y de punto; valor accesible «Imagen 2 de 2» (ida y vuelta) | OK | OK |
| Galería: acciones accesibles siguiente/anterior (`ACTION_SCROLL_FORWARD/BACKWARD`, «Imagen siguiente/anterior») | OK (con TalkBack activo) | no comprobable con `axe` |
| Cantidad: mínimo 1 (− desactivado), sube de 1 en 1, total «Total: …» se actualiza | OK | OK |
| Cantidad: máximo = stock (3 y 2): el «+» en el tope conserva el máximo y la línea «Máximo disponible…» queda en negrita | OK | OK |
| Cantidad: acciones accesibles incrementar/decrementar cambian el valor «n de N» y el total; tope con 3 incrementos sobre stock 2 | OK (TalkBack) | no comprobable |
| Anuncio hablado del límite / del nuevo total | llamada ejecutada (rama `limited`); la voz **no es verificable por el agente** | ídem |
| Stock bajo la selección con la pantalla abierta (5 elegidas, el stock baja a 2, foco tras 65 s): pasa a «2 de 2» y el total se corrige solo | OK | no repetido |
| Cantidad de A no pasa a B al abrir otro producto (`key`) | OK (3 → 1) | OK |
| Stock 1 (plural/singular): «1 unidad» / «In stock: 1 unit», «Máximo disponible: 1 unit.» | OK (es, en) | — |
| Agotado de origen (`product-261009-001`): «Agotado», sin selector ni total, botón «Agotado» desactivado | OK | OK |
| Agotado en la sesión del mock: detalle «Agotado»; la lista del mismo producto sigue disponible (limitación documentada) | OK | — |
| Precio MXN ↔ USD (Cuenta): 811,90 MXN → `USD 45.11`; 3 uds → `USD 135.32`; USD 9.99 en USD; total de 3 → `USD 29.97`; oferta `En oferta, … antes …` | OK | OK |
| Inglés (selector de Fundamentos): textos, `$12.38` y plurales | OK | — |
| Compartir: abre la hoja del sistema con «Mira … en HerbStore: herbstore://product/…»; se cierra y la pantalla conserva su estado | OK (`ChooserActivity`) | OK |
| Deep link `herbstore://product/<id>` con la app abierta abre/reemplaza el detalle | OK | OK |
| Id inexistente (`…-999`, 404) o malformado (`…/xyz`) → «Producto no encontrado» con «Volver» | OK | no repetido |
| Atrás vuelve a Inicio | OK (tecla Atrás) | no probado (el botón nativo «Inicio» está presente) |
| Estados: cargando (mock con 7 s de latencia, spinner + «Cargando producto…»), sin conexión (mock detenido), error (servidor falso con 503), «Reintentar» recupera | OK | OK |
| Texto grande | OK con `font_scale` 2,0 (el contenido cabe; los iconos del tab bar se recortan, H-1) | OK con `accessibility-extra-extra-extra-large` tras los topes de escala (relanzando la app, H-10) |
| Tema oscuro | OK | OK |
| Objetivos táctiles | − / + / Compartir / Agregar: 90 px = 48 dp (`uiautomator`) | 48 × 48 pt (`axe`) |
| Movimiento reducido: `scrollTo` de la galería sin animación | OK (`transition_animation_scale` 0 → `animated=false`, 1,0 → `true`, comprobado con un log temporal ya retirado) | **no evidenciado** (como en días anteriores) |
| Sin cierre inesperado | OK (0 `FATAL EXCEPTION`/`AndroidRuntime`) | OK |

### Hallazgos de T3
- **E-1 (corregido): `data` en lugar de `currentData`.** Con la ruta singular, abrir B desde A pintaba el producto de A bajo el `id` de B mientras cargaba (visto en iOS). Corregido con `currentData`; evidencia: tras el cambio, el spinner aparece de verdad (7 s de latencia). El mismo fallo existía en el placeholder del Día 3 (que solo mostraba el nombre).
- **E-2 (corregido): la línea del límite quedaba detrás de la barra fija.** Primera versión: aparecía solo al superar el stock, al final del scroll y bajo la barra. Ahora es permanente y no cambia la altura de línea al ponerse en negrita (un cambio de 4 pt movía la página).
- **E-3 (corregido): barra y títulos con AX5.** Sin topes la barra ocupaba el 43 % de la pantalla y el nombre se partía en mitad de palabra; ver las decisiones.
- **Nota de método:** `axe tap` no activó «Reintentar» a la primera en iOS; `axe touch --down --up --delay 0.15` sí. Con TalkBack activo `perform` de la herramienta `A11y` devuelve `ok=false` aunque la acción llega a JS (el valor cambia): se comprueba por el árbol, no por ese booleano.
- **Observado, no tocado:** H-1/H-11 (iconos del tab bar recortados con `font_scale` 2,0 en Android; Día 6) y el botón flotante «Tools» del dev client sobre la cabecera. En la primera acción de la galería con TalkBack recién activado el log mostró `animated=false` con las animaciones al 100 %; no se reprodujo en dos ciclos posteriores (0 → `false`, 1,0 → `true`); sospecha: lectura inicial del ajuste de Samsung al activar TalkBack.
- **Pendiente de seguimiento (no es de T3):** (a) T4/T5: refrescar la instantánea del carrito (`stockRefreshed`) desde el detalle; (b) la voz de TalkBack/VoiceOver (anuncios del límite y del total) queda para la auditoría del Día 6 con un lector real; (c) la validación nativa profunda de compartir y de deep links en frío es del Día 5 (el launcher del dev client intercepta el enlace).
- Limpieza: Metro y mock detenidos; `font_scale` 1,0; modo noche `no`; escalas de animación 1,0; TalkBack apagado (`enabled_accessibility_services` vacío, `accessibility_enabled` 0, `touch_exploration_enabled` 0); `adb reverse` 8081 y 3001 como estaba; simulador con `content_size` `large` (era `large`), `appearance` `light` (era `light`) y `AutomaticMinimizationEnabled` 1 sin tocar; MMKV sin tocar (no se agregó nada al carrito ni al historial); sin `.env.local`; herramientas temporales fuera del repositorio.

### Comparación Android / iOS de T3 (para repasar)

| Concepto | Android (Kotlin/Compose) | iOS (Swift/SwiftUI) |
| --- | --- | --- |
| Estado que sobrevive a girar la pantalla | `rememberSaveable` (Bundle) | `@SceneStorage` / `@State` recreado por la vista |
| Cantidad acotada como dato derivado | `derivedStateOf { quantity.coerceIn(1, stock) }` | `var shown: Int { min(max(quantity, 1), stock) }` |
| Stepper accesible | `Modifier.semantics { stateDescription; customActions }` en el valor | `Stepper` (adjustable con + y − como acciones) |
| Barra de compra fija | `bottomBar` del `Scaffold` | `.safeAreaInset(edge: .bottom)` |
| Compartir | `Intent.ACTION_SEND` + `createChooser` (el `url` va en el texto) | `ShareLink` (admite `url` y `message` separados) |
| Resultado remoto del id actual | `StateFlow` filtrado por el id (`flatMapLatest`) | `.task(id: productID)` descarta el resultado anterior |

## Día 4 — T6: formulario de dirección

- Tests primero: los dos archivos de lógica fallaron con `ERR_MODULE_NOT_FOUND`; después quedaron verdes. El schema normaliza con `trim`, aplica límites exactos y conserva mensajes como claves i18n. El mapeador acepta únicamente paths conocidos y descarta completamente sus valores.
- La dirección vive exclusivamente en React Hook Form; `zodResolver` convierte el schema en errores por control. El resumen accesible agrupa errores de validación y cada mensaje se enlaza mediante `aria-errormessage`. El checkout no crea intento ni persiste datos: la creación queda fuera de T6.
- Analogía: RHF se parece a un `ViewModel` con estado de campos y validación en Compose, mientras que en SwiftUI equivale a `@State`/`@Observable` de una `Form`; Zod es la validación pura reutilizable, no una regla embebida en la vista.
- Verificación complementaria (2026-10-13): mock y Metro existentes (`:3001`/`:8081`), Samsung SM-A037M conectado por USB y iPhone 17 Pro simulador booted. Android validó carrito no vacío, navegación a checkout, controles accesibles, teclado/insets, submit vacío con resumen global accesible y 7 errores por control; el árbol expuso targets de 48 dp. iOS validó carrito no vacío, campos y botón `Continuar` en el árbol AX, targets de 44 pt y submit vacío con errores enlazados por control. El árbol AX de iOS no expuso el resumen global accesible tras el submit (no apareció su texto/label), por lo que T6 queda bloqueada para cierre hasta corregir o justificar esa diferencia. No se ejecutó envío válido ni POST: T6 deja `onSubmit` sin efecto. No se modificó código.

## Día 4 — T4: agregar al carrito y feedback

### Evidencia y decisiones
- Tests primero: los tres archivos nuevos fallaron por `ERR_MODULE_NOT_FOUND`; después quedaron verdes 41/41 específicos y 851/851 en `npm run test:logic`.
- `addProductToCart` consulta el bloqueo y las líneas actuales antes de emitir, como máximo, un evento `cart/productAdded`; badge y subtotal son selectores del mismo cambio de Redux. Un lockout de 700 ms trata el doble toque como una interacción.
- `AddToCartFeedback` usa shared values y `withTiming`: el worklet actualiza opacidad, traslado y escala en el hilo UI. Con movimiento reducido, traslado = 0, escala = 1 y no hay fades; el mensaje permanece 2,2 s.
- El detalle aplica `stockRefreshed` a una línea existente solo si el stock cambió y `selectIsCartLocked` es falso. No se añadieron dependencias, config ni APIs nativas.
- La validación descubrió dos diferencias reales de Android: un hijo absoluto de la barra no quedaba visible fuera de sus límites y la preferencia de movimiento reducido podía llegar después del primer render. El feedback pasó a una capa absoluta de la pantalla medida contra la altura real de la barra; al entrar en reduced motion restaura explícitamente opacidad 1, traslado 0 y escala 1. Descartado: insertar el mensaje en el flujo de la barra, porque movería el layout al aparecer y desaparecer.
- Analogía: shared values/worklets se parecen a `Animatable`/`animate*AsState` en Compose y a `withAnimation` en SwiftUI; Redux conserva un único evento, equivalente a enviar una intención a un reducer MVI o a un store unidireccional.

### Validación T4 (2026-10-13)

| Caso | Android (Samsung físico) | iOS (iPhone 17 Pro simulador) |
| --- | --- | --- |
| Movimiento normal: pulsar agrega una unidad y actualiza badge | OK: árbol muestra «Se agregó 1 unidad…» y «Carrito, 1 artículo» en la misma interacción | OK: captura con feedback transitorio y badge; un segundo toque deliberado posterior actualiza a 2 |
| Movimiento reducido | OK: escalas del sistema en 0; el mensaje de límite permanece visible sin depender de movimiento | OK: `ReduceMotionEnabled=1`; mensaje visible, sin traslado/escala/fade según la rama determinista |
| Producto agotado | OK: `product-261009-001`, botón «Agotado» con `enabled=false` | OK: botón AX con `enabled=false` y motivo accesible |
| Límite de stock | OK: con stock vigente 1, conserva badge 1 y muestra «El carrito conserva el máximo…» | OK: misma cantidad y feedback visible en captura |
| Rehidratación | Test del thunk: con `_persist.rehydrated=false` no emite `productAdded`; el botón usa el mismo selector para `disabled` | Misma lógica y UI compartidas |
| Único dispatch | 41 tests específicos verdes; cada alta aceptada emite exactamente un `cart/productAdded` | Misma lógica compartida |

Verificaciones: `npx expo lint` sin avisos; `npx tsc --noEmit` en verde; 41/41 tests específicos y `npm run test:logic` 853/853 al cierre. No aplicaban Expo Doctor ni recompilación del Development Build.

### Día 4 — T6: corrección de accesibilidad iOS y cierre

- **Causa:** iOS no expuso de forma estable el `View` accesible que contenía un `Text` anidado cuando aparecía tras el submit. Android sí lo exponía.
- **Corrección mínima:** el `AppText` del resumen es ahora el elemento accesible (`accessibilityRole="alert"`, `accessibilityLabel` y `accessibilityLiveRegion="polite"`); el contenedor solo conserva el estilo visual. `AccessibilityInfo.announceForAccessibility` anuncia el mismo texto al cambiar el resumen. No se añadieron APIs nativas ni dependencias. El helper puro `buildValidationSummary` evita divergencias entre el label y el texto visible.
- **Rojo → verde:** `validation-summary.test.ts` falló primero con `ERR_MODULE_NOT_FOUND`; tras crear el helper pasa. `npm run test:logic`: **859/859**; `npx expo lint` y `npx tsc --noEmit`: verdes.

| Caso T6 | Android — Samsung SM-A037M | iOS — iPhone 17 Pro simulador |
| --- | --- | --- |
| Formulario vacío, 7 errores por control y resumen global | OK en validación previa; 48 dp | OK tras corrección; AX expone resumen completo y 7 errores; 44 pt |
| Formulario válido, sin POST real | OK: T6 no implementa envío | OK: T6 no implementa envío |
| Cambio es/en | OK en validación previa | OK en validación previa |
| Teclado e insets | OK en validación previa | OK |
| Texto ampliado | OK en validación previa | OK en validación previa |
| Tema oscuro | OK en validación previa | OK en validación previa |
| Carrito vacío | OK en lógica/ruta: vuelve a carrito, sin intento | OK en lógica/ruta: vuelve a carrito, sin intento |
| Storage/logs | Tests de cero PII y logs: dirección ausente | Tests de cero PII y logs: dirección ausente |

La comprobación de Android en esta sesión quedó limitada a la evidencia previa: `adb` no está disponible en el PATH actual; no se inventa una nueva ejecución. No se generó POST ni se guardó dirección. La analogía RN permanece: `announceForAccessibility` equivale a emitir un evento semántico desde un `ViewModel`/semantics de Compose y a `UIAccessibility.post` en SwiftUI/UIKit; el `Text` accesible es el nodo que VoiceOver puede recorrer.

## Día 4 — T7: contratos y consulta de órdenes

- Rojo → verde: el parser anterior no aceptaba status HTTP ni proyectaba el resumen; tras ampliar `fetchJson`, contratos, API y mock, `npm run test:logic` queda en **859/859** y `npm --prefix mock-server test` en **81/81**.
- `parseErrorBody` es opt-in: los endpoints existentes mantienen sus errores sin cuerpo. Los 4xx de órdenes solo conservan códigos, campos saneados y el link de status si coincide exactamente con la key actual; nunca `message`, body original, dirección o key completa.
- El resumen confirmado es una proyección inmutable de id, líneas, importes, moneda y fecha, sin dirección. 200 solo acepta `confirmed` y 202 solo `pending`; una pareja incoherente es inválida/incierta.
- El GET de status conserva los reintentos GET y el POST no reintenta. El mock procesa primero el intento antes de aplicar delay/fault, por lo que una consulta posterior puede recuperar un POST retrasado o fallido.
- Analogía: el parser con status equivale a un `sealed class` de Kotlin/Swift que valida simultáneamente envelope y código HTTP; `parseErrorBody` es un interceptor opt-in, no otro cliente HTTP.
-
## Día 4 — T8: fingerprint, máquina idempotente y persistencia

- Rojo → verde: los seis módulos nuevos comenzaron con `ERR_MODULE_NOT_FOUND`; después `npm run test:logic` quedó en **870/870**.
- El request canónico vive solo en memoria: recorta strings, ordena items y claves recursivamente y rechaza duplicados. El hash recibe la función por inyección para probarlo con Node y usar `expo-crypto` en la app.
- La máquina conserva `preliminary` solo ante validación/stock agotado temprano; incertidumbre, pending, key reutilizada y errores elevan/conservan `unresolved`. Solo confirmed o 404/410 contractuales liberan. Cancelar no altera el intento.
- Persistencia es una proyección no reversible: key, fingerprint, estado y `remoteStatus`; historial sanitizado y deduplicado por id. Preliminary restaurado se promueve antes de habilitar checkout; el listener consulta status una vez tras `REHYDRATE`.
- Analogía: la máquina es `sealed class` + reducer MVI/StateFlow en Kotlin y un `enum` con transiciones puras en SwiftUI; el selector de bloqueo es `derivedStateOf`/computed property.
- Evidencia: lint, typecheck y `git diff --check` verdes; no hubo cambios de dependencias, mock, config ni proyectos nativos. El test de persistencia con dirección ficticia no encuentra su valor en JSON persistible. Android/iOS no requieren recompilación en T8; validación de dispositivo queda para T9/T10.

## Día 4 — T9: checkout de extremo a extremo

- Rojo → verde: la prueba inicial no encontró `checkout-thunks.ts`; tras añadir el borde de request, thunks y pantallas, `npm run test:logic` quedó en **871/871**, con lint, typecheck y `git diff --check` verdes.
- `submitOrder` bloquea síncronamente antes de generar el POST, usa UUID/SHA-256 de `expo-crypto` y conserva el request únicamente en memoria. `checkOrderStatus` solo reenvía la key; nunca dirección.
- Confirmación registra un resumen sanitizado, vacía el carrito e invalida catálogo una vez. Stock agotado temprano consulta detalles vigentes y aplica `applyStockRefresh`; el carrito avisa cuando un intento sigue sin resolver.
- Analogía: el thunk orquestador equivale a un `ViewModel` que coordina un repositorio y emite eventos a `StateFlow`; en SwiftUI equivale a una `Task` del modelo observable. Las pantallas solo presentan estado y eventos.
- No se pudo ejecutar la matriz manual Android/iOS en esta sesión; no se inventa evidencia. No hubo cambios de dependencias, mock, configuración ni proyectos nativos; T10 queda pendiente.

### Validación manual complementaria de T9 (2026-10-13)

Comandos ejecutados: `npm --prefix mock-server run dev`, Metro existente en `:8081`, `adb reverse tcp:8081 tcp:8081`, `adb reverse tcp:3001 tcp:3001`, lanzamiento del Development Build, `uiautomator dump` en Samsung SM-A037M y `axe describe-ui/tap/touch/swipe` en el simulador iPhone 17 Pro. El mock respondió y la app cargó catálogo en ambas plataformas.

| Área | Android — Samsung SM-A037M | iOS — iPhone 17 Pro Simulator |
| --- | --- | --- |
| Pantallas relevantes y accesibilidad | OK parcial: Inicio → Carrito; árbol expone línea, subtotal, progreso, `+`, `−`, Eliminar y checkout; targets observados de 90 px (48 dp). | OK parcial: Carrito → Checkout; AX expone campos, errores/labels y `Continuar`; targets previos de formulario 44 pt. |
| Envío válido y confirmación | No completado: esta sesión no logró introducir de forma fiable todos los campos y no se generó POST desde UI. | No completado: `axe type`/teclado dejó el formulario incompleto; no se generó POST desde UI. |
| Estados POST/GET (confirmed, pending, timeout, 503, incoherente, offline, 404/410, reinicio) | No observados manualmente en UI en esta sesión; cubiertos por `attempt-machine`, `order-outcome`, thunks y cero-PII en `npm run test:logic` (871/871 previamente). | Igual limitación. `ORDER_POST_DELAY_MS`, `ORDER_POST_FAULT` y `ORDER_ACTIVE_MS` quedaron sin activar desde UI. |
| Doble toque, bloqueo y limpieza exacta | No observados manualmente; cubiertos por los tests deterministas de T9/T8. | No observados manualmente; cubiertos por los mismos tests. |
| Storage/logs sin PII | No se inspeccionó una transición real de T9; la prueba determinista de estado persistible y redacción de logs permanece en verde. | Igual. |
| es/en, texto ampliado, tema oscuro, reduced motion | No se repitió la matriz específica de T9; hay evidencia previa de esas capacidades en T3–T6. | No se repitió la matriz específica de T9; hay evidencia previa de esas capacidades en T3–T6. |

**Limitación exacta:** el formulario válido no fue alcanzado manualmente en esta ejecución; por tanto no se afirma ninguna transición de orden ni que la matriz quede validada en dispositivo. No se reprodujo ningún fallo bloqueante ni se modificó código. T9 queda **parcialmente validada**: lógica automática completa, UI/rutas parcialmente inspeccionadas, matriz manual de checkout pendiente (T10).

## Día 4 — T10: cierre y validación final (2026-10-13)

### Teoría de cierre

El checkout separa tres responsabilidades: Redux conserva únicamente metadatos no reversibles, RTK Query habla con el servidor y la pantalla presenta una máquina de estados (`preliminary`, `unresolved`, `confirmed`). Esto equivale a un `ViewModel`/`StateFlow` con una `sealed class` en Kotlin y a un modelo observable con un `enum`/estado asociado en SwiftUI. La dirección vive en React Hook Form, como un estado temporal del formulario; no es un `SavedStateHandle`, DataStore, `UserDefaults` ni `@AppStorage`.

La animación de agregar usa shared values y worklets en el hilo UI: conceptualmente se parece a `Animatable`/`animate*AsState` de Compose y `withAnimation` de SwiftUI. El gesto usa `ReanimatedSwipeable`, equivalente a `SwipeToDismissBox` y `.swipeActions`. Movimiento reducido conserva el evento, el mensaje y el cambio de estado, pero elimina traslado y escala. La decisión evita trabajo por frame en JS, aunque obliga a probar el resultado visual en ambos sistemas.

### Matriz carrito, checkout y storage

La matriz determinista completa se ejecuta en `attempt-machine`, `order-outcome`, reducers y la prueba de cero PII (`npm run test:logic`). La siguiente tabla registra el comportamiento esperado y la evidencia disponible por plataforma; **no se presenta una transición de POST como observada cuando el formulario no pudo completarse**.

| Caso | Android — Samsung SM-A037M | iOS — iPhone 17 Pro Simulator |
| --- | --- | --- |
| Reinicio `preliminary → unresolved` | Lógica ✅; UI de reinicio/POST no observada: teclado impidió envío | Lógica ✅; UI de reinicio/POST no observada: `axe type` dejó el formulario incompleto |
| Primer 400 `VALIDATION_ERROR` | Lógica ✅: limpia solo `preliminary`, asigna paths y desbloquea | Lógica ✅: mismo resultado |
| Primer 409 `OUT_OF_STOCK` | Lógica ✅: limpia, refresca stock/líneas y exige key nueva | Lógica ✅: mismo resultado |
| 409 `IDEMPOTENCY_KEY_REUSED` | Lógica ✅: eleva/conserva `unresolved` y consulta status | Lógica ✅: mismo resultado |
| 202 pending y terminal 200 confirmed | Lógica ✅; pantallas accesibles inspeccionadas, transición no disparada | Lógica ✅; pantallas accesibles inspeccionadas, transición no disparada |
| 404/410 coherentes | Lógica ✅: libera solo con pareja status/code | Lógica ✅: mismo resultado |
| Terminal incoherente, offline, timeout, 5xx | Lógica ✅: conserva/eleva `unresolved`, nunca confirma | Lógica ✅: mismo resultado |
| Storage y logs | Test de estado persistible/logs ✅, sin dirección, body ni key completa; no se inspeccionó una transición real | Igual; no se inspeccionó una transición real |
| Carrito bloqueado y limpieza | Reducer/selector ✅; árbol accesible de carrito inspeccionado | Reducer/selector ✅; árbol AX de carrito/checkout inspeccionado |

Los estados terminales incoherentes y ambos 409 son, por diseño, demostrables de forma reproducible en lógica aunque no sean alcanzables con un formulario manual incompleto. El mock conserva su limitación intencionada: `stock` vigente existe en detalle y barcode, pero listas/Home solo exponen `inStock`; pueden mostrar «Disponible» después de agotar un producto en la misma sesión. No se guarda PII: el request y la dirección solo existen durante el submit en memoria.

### Validación por plataforma y límites honestos

- **Android:** el Development Build cargó Carrito y Checkout y el árbol UI expuso controles, errores, checkout y targets de 48 dp en la evidencia complementaria de T9. No fue posible completar de forma fiable todos los campos ni generar un POST; por ello no se afirma confirmación, pending, timeout, 409, reinicio ni storage real. La matriz de idioma es/en, texto grande, dark mode y reduced motion queda respaldada por recursos, lógica y validaciones previas de T3–T6, no por una nueva ejecución completa de T10.
- **iOS:** el simulador cargó Carrito y Checkout; AX expuso campos, resumen de errores y botón Continue, con targets previos de 44 pt. `axe type`/teclado no permitió alcanzar un formulario válido y tampoco se generó POST. Por la misma razón no se afirma la matriz de estados de red ni un reinicio real. La evidencia previa cubre recursos es/en, texto ampliado y tema oscuro; reduced motion está implementado y probado en lógica, pero no se declara observado manualmente en iOS.

La limitación no es un fallo funcional reproducido: es una limitación del procedimiento de entrada de T9. Se conserva para la auditoría del Día 6 en vez de inventar evidencia. RNF-2 queda cubierto por la lógica y la implementación; RNF-3 por árboles/targets observados y pruebas; RNF-4 por las comprobaciones automáticas de cierre.

### Decisiones y trade-offs cerrados

- Redux Toolkit + RTK Query: una fuente global/remota explicable; se descartan Context para un carrito mutable frecuente y Zustand fuera del stack. Es análogo a `ViewModel`/UDF, no a una caché remota duplicada.
- Moneda MXN/USD en Cuenta, solo en memoria: evita duplicar controles y separa idioma de moneda; el trade-off es volver a MXN al reiniciar. Se descarta persistirla hasta el Día 6.
- Todos los precios se convierten en todas las pantallas: evita que una misma tarjeta muestre monedas distintas; aumenta los renders visibles al cambiar preferencia.
- Carrito bloqueado durante `preliminary`/`unresolved`: evita vaciar líneas ajenas al pedido confirmado; el trade-off es esperar a un resultado observable.
- Instantánea mínima por línea: permite subtotal y umbral offline tras reinicio; puede quedar desfasada hasta refrescar y se corrige con detalle/`OUT_OF_STOCK`. No es una segunda caché del catálogo.
- `stock` numérico solo en detalle/barcode del mock: conserva los contratos y filtros del Día 3; listas/Home pueden mostrar disponibilidad desfasada.
- **R-1 se mantiene:** reconectar con datos de menos de 60 s no fuerza una petición y el aviso offline permanece hasta pull, Reintentar o foco después de 60 s. Trade-off: el usuario puede ver un aviso aunque la red ya vuelva. Se descarta cambiar ese requisito en este día.
- `overrideExisting: __DEV__` silencia duplicados esperables de Fast Refresh sin quitar la protección en producción; la alternativa era aceptar ruido que ocultaba errores.

### Ejercicio sin solución

Implementa `selectCheckoutAvailability(state)` como selector puro. Debe devolver `restoring`, `empty`, `blocked` o `ready`, sin mutar el estado ni leer dirección. Escribe primero una tabla con: rehidratación pendiente, carrito vacío, intento `preliminary`/`unresolved` y carrito válido. Añade tests de referencias y explica la equivalencia con `derivedStateOf`/computed property de Compose y SwiftUI.

### Preguntas de repaso (respuestas cortas)

1. **¿Qué persiste `preliminary`?** Solo key, fingerprint y estado; nunca dirección ni body.
2. **¿Qué hace un reinicio con `preliminary`?** Lo promueve a `unresolved` y consulta status sin dirección.
3. **¿Cuándo libera `unresolved`?** Con confirmed o una pareja coherente 404/410.
4. **¿Qué ocurre con un 409 temprano?** Limpia solo preliminary; refresca stock en OUT_OF_STOCK y exige una key nueva.
5. **¿Qué evita el fingerprint?** Reenviar una identidad distinta para un request semánticamente igual sin guardar el payload.
6. **¿Por qué no se reintenta el POST?** Un timeout puede ocultar una orden creada; solo se consulta la misma key.
7. **¿Dónde vive la dirección?** En el formulario y en la memoria del submit, no en Redux ni MMKV.
8. **¿Qué elimina reduced motion?** Movimiento no esencial; conserva mensajes y cambios de estado.
9. **¿Qué analogía tiene `attempt-machine`?** Una `sealed class` con transiciones puras, como reducer MVI o estado asociado SwiftUI.
10. **¿Qué cubre `selectIsCartLocked`?** Rehidratación pendiente y cualquier intento no resuelto, bloqueando otra modificación.

### Checklist oral de cierre

- [ ] Separar estado remoto, global, local y persistido; comparar Redux con ViewModel/StateFlow y SwiftUI.
- [ ] Explicar por qué preliminary se promueve al reiniciar y por qué timeout consulta en lugar de repetir POST.
- [ ] Recorrer la matriz: ambos 409, 202, confirmed, 404/410 y terminal incoherente.
- [ ] Demostrar que storage/logs no contienen dirección, body, valores de campo ni key completa.
- [ ] Explicar shared values/worklets y su equivalencia con Compose/SwiftUI.
- [ ] Explicar gesto horizontal, alternativa accesible por botón y targets 48 dp/44 pt.
- [ ] Justificar R-1 y la limitación de stock de listas/Home del mock.
- [ ] Nombrar los límites de la validación manual y separar evidencia de tests de evidencia de dispositivo.

### Resultados de cierre

| Comprobación | Resultado |
| --- | --- |
| `npm run test:logic` | **871/871**, 0 fallos |
| `npm --prefix mock-server test` | **81/81**, 0 fallos |
| `npx expo lint` | ✅ sin errores |
| `npx tsc --noEmit` | ✅ sin errores |
| `npx expo install --check` | ✅ dependencies are up to date |
| `npx expo-doctor@latest` | ✅ 21/21 comprobaciones |
| `git diff --check` | ✅ sin salida |
| Paridad i18n es/en | ✅ mismas claves, interpolaciones y textos no vacíos |
| Símbolos retirados T2–T5 | ✅ búsqueda sin resultados |

No cambian dependencias, configuración ni `ios/`/`android/` en T10; no se requiere recompilación adicional. El commit de cierre del día es `feat: complete day 4 cart and checkout`.
## Día 5 — Capacidades nativas y plataforma (T1–T14; cerrado y commiteado)

Estado (2026-10-15): T1–T14 hechas y validadas. Por decisión del usuario se aplicaron los tres parches de SDK 57 (`expo` ~57.0.30, `expo-router` ~57.0.28, `@expo/ui` ~57.0.25); `expo install --check` y Doctor están en verde (21/21), los Development Builds se recompilaron y los tres builds EAS se repitieron (`FINISHED`). T10 queda marcada y la spec 005 `implementada`; @reviewer dio APROBADO en la validación final (2026-10-15) y el Día 5 quedó cerrado en el commit `feat: complete day 5 native platform features` (se consulta con `git log --grep "day 5"`).

Spec: `specs/005-dia-5-nativo-plataforma`. Evidencia técnica fechada (comandos, capturas, mediciones): `docs/evidence/day-5-platform.md`. Catorce tareas (T1–T14; excepción documentada al máximo de 10 de la skill, porque RF-37 a RF-39 salieron de la validación de T8 y se resolvieron dentro de la misma spec). Cada incremento empieza con un bloque teórico de máximo 10 minutos (RF-1) y termina con la matriz Android físico (Samsung SM-A037M, Android 13) e iOS Simulator (iPhone 17 Pro, iOS 26.5). El Simulator **nunca** se presenta como hardware: sin cámara óptica, sin Taptic Engine, sin VoiceOver real.

### Teoría del día (cada bloque ≤ 10 min, RF-1 y RF-2)

**Bloque A — Interoperabilidad nativa: sync, Promise, evento y vista (DeviceInsights).**
Un Expo Module es un contrato pequeño entre JavaScript y el sistema. Hay cuatro formas de cruzar la frontera y cada una responde a una pregunta distinta:

| Forma | Pregunta que responde | Kotlin / Compose (Android) | Swift / SwiftUI (iOS) | Error típico |
|---|---|---|---|---|
| Función síncrona | «¿Qué plataforma soy?» (dato inmediato y barato) | `Function("getPlatform") { "android" }` | `Function("getPlatform") { "ios" }` | Usarla para trabajo lento: bloquea el hilo JS (el equivalente a llamar disco en el hilo principal). |
| Función asíncrona (`Promise`) | «Dame los datos del equipo» (operación única) | `AsyncFunction` (corrutina) | `AsyncFunction` (async/await) | Lanzar dos a la vez: se ignora la segunda mientras haya una activa. |
| Evento | «Avísame cuando termine» (secuencia con suscripción) | `callbackFlow`/`SharedFlow` + cancelar el collector | `AsyncStream`/Combine + cancelar la `Task` | No llamar a `remove()`: observadores duplicados y entregas a una pantalla desmontada. |
| Vista nativa | «Quiero un control del sistema dentro de mi árbol» | `AndroidView` (interop en Compose) | `UIViewRepresentable` | Pasarle estado mutable o textos fijos: la vista recibe props inmutables y emite eventos. |

Reglas del módulo: la fachada JS valida la forma del payload (modelo no vacío, ISO 8601 UTC) y lo convierte en un error controlado; Kotlin y Swift devuelven el **mismo** contrato sin identificadores sensibles; los textos localizados viajan desde JS (no se duplican recursos en Kotlin/Swift); el evento de la vista se llama `onNativePress` porque `onPress` colisiona con el `topPress` interno de Fabric.

**Bloque B — Cámara, permisos y máquina de estados (escáner).**
Un permiso es un estado que cambia fuera de la app (Ajustes) y por eso se vuelve a comprobar al volver a primer plano. El escáner nunca activa la cámara sin una pantalla previa confirmada **en cada apertura** (RF-10). La máquina discriminada (`preview → checking → ready → querying → …`) equivale a una `sealed interface UiState` con `when` exhaustivo en Kotlin y a un `enum` con valores asociados en Swift. El **epoch** (número de intento vigente) hace lo que cancelar un `Job` o una `Task`: una respuesta con epoch viejo se descarta. Una barrera síncrona (`scanner-read-barrier`) cierra la ventana entre dos lecturas de la cámara que llegan antes de que React renderice; un cooldown o un booleano `hasScanned` no distingue reintento, cancelación y resultado tardío.

**Bloque C — Deep links y navegación.**
`herbstore://product/<id>` se valida antes de navegar (inválido ≠ no encontrado ≠ ruta desconocida). Arranque en frío y app activa convergen en un solo destino y conservan una salida segura. En Expo Router, `dangerouslySingular` evita apilar dos instancias de la misma pantalla. Equivale a `navDeepLink` + `launchSingleTop` en Compose Navigation, y a `onOpenURL` + un `NavigationPath` único en SwiftUI.

**Bloque D — Realimentación: háptico y compartir.**
El háptico se pide **después** de que el reducer aceptó el cambio: un listener Redux compara el carrito antes y después (si no cambió, no vibra). Equivale a un collector de `StateFlow` app-scoped o a un `.onChange(of:)` en SwiftUI, nunca a vibrar en cada botón. Compartir devuelve una unión `shared | cancelled | failed`: cancelar no es error; un fallo (o un resultado ausente) muestra mensaje y permite reintentar. Android resuelve `sharedAction` al lanzar el selector (cancelar y compartir son indistinguibles); iOS sí distingue `dismissedAction`. Es una diferencia observable y se justifica, no se oculta (RF-27).

**Bloque E — Notificaciones locales: permisos, persistencia y deduplicación.**
Dos marcas distintas viven en el historial persistido: «solicitud de acceso registrada» (se escribe **antes** de pedir el permiso, para pedir como máximo una vez por orden aunque la app muera) y «notificada» (solo tras programar con éxito). Se parece a `shouldShowRequestPermissionRationale` + una bandera propia en DataStore (Android) y a `UNUserNotificationCenter.getNotificationSettings` + `UserDefaults` (iOS). Android 13+ muestra el diálogo dos veces por instalación; el primer «no» deja el estado **denegado recuperable** y el segundo lo vuelve **bloqueado**; iOS bloquea tras el primer rechazo. El contenido nunca lleva el id de la orden ni la dirección.

**Bloque F — Cambios de navegación y de estado persistido (RF-37 a RF-39).**
- RF-37: «Ir a Inicio» del carrito vacío se hace en `Tabs`, no con `router`: un plan puro (`POP_TO_TOP` dirigido a la pila de Inicio + `JUMP_TO`) selecciona la pestaña y vacía su pila. Compose: `popUpTo(startDestination)` + `launchSingleTop`; SwiftUI: cambiar la selección de `TabView` y vaciar el `path` de su `NavigationStack`.
- RF-38: la redirección **no** se hace durante el render. Llamar al router al renderizar produce «Cannot update a component while rendering»; la máquina `watching | consulting | done` vive en un `useRef` y decide dentro de un efecto. Es el mismo error que modificar un `MutableState` dentro del cuerpo de un `@Composable` o cambiar `@State` desde `body`.
- RF-39: la razón por la que las notificaciones no son utilizables (`denied-recoverable` o `blocked`) se deriva de la última lectura y se **persiste por orden**; subir `PERSIST_VERSION` a 3 es una migración: la v2 y la v1 siguen siendo legibles, y una razón ausente o inválida se sanea a `blocked`. Equivale a una migración de Room (`Migration(2, 3)`) o a una de SwiftData.

**Bloque G — Distribución: perfiles EAS, CNG y compatibilidad OTA/binario.**
CNG (`prebuild`) genera `android/` e `ios/` desde `app.json` y los config plugins; esas carpetas no se editan ni se versionan. Un perfil de `eas.json` es el equivalente a un `buildType`/flavor de Gradle (Android) o un esquema/configuración de Xcode (iOS). La **huella** (fingerprint) es el hash de todo lo que cambia el binario: permisos, plugins y sus opciones, módulos Kotlin/Swift, dependencias nativas y `app.json`. Cambios de solo JS, texto o recursos conservan la huella (candidatos a actualización OTA); lo demás exige un binario nuevo. En este proyecto `runtimeVersion: { policy: "fingerprint" }` sin `expo-updates` es un metadato inerte (no hay OTA real), y esa es una decisión consciente, no un descuido.

### Qué construyó cada incremento

| Incremento | Qué hace | Piezas principales |
|---|---|---|
| A. Base y DeviceInsights | Panel didáctico en Cuenta con valor síncrono, actualización asíncrona, evento y vista nativa accesible | `modules/device-insights` (Kotlin/Swift), `core/native/device-insights*.ts`, `features/device-insights/` |
| B. Escáner y enlaces | Preview confirmada → cámara → EAN-13 → producto, con errores recuperables y cancelación al origen | `features/scanner/{logic,hooks,screens}`, `app/scanner/` (Stack modal propio), `core/navigation/linking.ts` |
| C. Feedback y notificaciones | Háptico solo con mutaciones aceptadas; compartir recuperable; notificación local por orden con reintento | `features/feedback/`, `features/product/hooks/`, `features/notifications/`, `features/orders/` |
| D. Entrega | Perfiles EAS, inventario de variables, gate de URL, matriz OTA/binario medida con fingerprint, validación remota | `eas.json`, `.env.example`, `core/config/`, evidencia |
| Cambio de requisitos | RF-37 a RF-39 (Inicio en su raíz, redirección fuera del render, categorías de permiso) | `features/navigation/logic/`, `checkout/logic/order-status-redirect.ts`, `order-notification-notice.ts`, `PERSIST_VERSION` 3 |

### Decisiones y alternativas descartadas (RF-3)

| Decisión | Motivo | Trade-off | Alternativa descartada |
|---|---|---|---|
| Expo Module local dentro de CNG | Mantiene `ios/`/`android/` generados y el contrato didáctico | Dos implementaciones (Kotlin y Swift) y recompilar | TurboModule manual: más integración y editar proyectos generados |
| Contrato nativo crudo + fachada JS validada y localizada | Un solo lugar para textos y validación | Un adapter más | Localizar dentro de Kotlin/Swift: duplica recursos y puede divergir del idioma activo |
| Stack modal propio para escáner y detalle escaneado | Conserva la instancia y el rearmado al volver | Una ruta de detalle que delega en la misma pantalla | Navegar al stack de Inicio: pierde la instancia del escáner |
| Máquina pura + epoch + barrera síncrona | Modela reintento, cancelación y resultados tardíos | Más estados explícitos | `hasScanned`/cooldown: no distingue los casos anteriores |
| Endpoint de código de barras en `productsApi` | Reutiliza contrato, reintentos y abort | Otro endpoint/tag en la API compartida | `fetch` directo en la pantalla: pierde taxonomía de errores |
| Listener Redux tras el reducer para háptico y notificación | El efecto ocurre solo con estado aceptado | Un middleware más | Vibrar en cada botón: vibra acciones rechazadas y duplica lógica |
| Marca «solicitud registrada» antes del diálogo | Máximo una solicitud por orden aunque muera el proceso | Una caída justo después puede impedir otro diálogo | Marcar después del diálogo o solo en memoria |
| `notified` solo tras programar con éxito + reintento explícito | No se pierde ni se duplica el aviso | El usuario debe reintentar | Reintento automático: podría duplicar |
| `Tabs` + plan puro `POP_TO_TOP`/`JUMP_TO` (RF-37) | `dismissTo`/`POP_TO` no lo entiende `Tabs` y se descarta en silencio | Código específico para una salida | `router.dismissTo('/')`, `navigate` (empuja un `index` duplicado) |
| Máquina de redirección en `useRef`, fuera del render (RF-38) | Una sola redirección y cero avisos de render | Un hook más | Redirigir en el render o con un `useEffect` sin guardia |
| Categoría de permiso persistida con `PERSIST_VERSION` 3 (RF-39) | Texto correcto tras reiniciar | Migración v3 (v1/v2 legibles) | Derivarla al renderizar: perdería la última lectura de esa orden |
| URL del catálogo obligatoria con gate temprano | Falla explícito, sin host implícito | Desarrollo exige `.env.local` | Defaults por plataforma (prohibidos por RF-30) |
| `env` por perfil de `eas.json` con el placeholder público | Es público, no es secreto, reproducible desde Git y revisable | La URL real se cambiaría en el archivo (o por variable EAS de visibilidad «plain text») | Variables hospedadas en EAS: añaden estado de cuenta fuera del repositorio sin necesidad para un placeholder |
| Matriz OTA/binario **medida** con `@expo/fingerprint` en un clon | Evidencia real, equivalente en ambas plataformas | No se publica ninguna actualización | Matriz declarativa; publicar una OTA para demostrarlo (fuera de alcance) |
| `node:test` + matriz manual; Jest/RNTL/Maestro en el Día 6 | No ampliar el Día 5 | UI y nativo sin automatizar todavía | Adelantar una suite completa |

### Errores típicos al venir de nativo (y cómo aparecen aquí)

1. **Bloquear el hilo JS** con trabajo síncrono: la función síncrona solo devuelve `android`/`ios`; el trabajo real va en la `Promise`.
2. **Olvidar el cleanup**: un evento sin `remove()` duplica observadores; en Compose sería no cancelar un `collect`, en SwiftUI no cancelar una `Task`.
3. **Resultados tardíos**: una consulta que termina después de cancelar no debe navegar ni rearmar (epoch).
4. **Mutación directa**: los reducers devuelven estado nuevo; el listener compara referencias antes/después.
5. **Efectos mal declarados / efectos en el render**: RF-38 (navegar durante el render) y React 19 penaliza `setState` síncrono en efectos.
6. **Asumir que el permiso es estático**: se vuelve a comprobar al volver a primer plano; Android 13 es distinto de Android 12 y de iOS.
7. **Confundir Metro con Gradle/Xcode**: Fast Refresh no incorpora un permiso, un plugin o un módulo; eso cambia la huella y exige recompilar.
8. **Atribuir al Simulator lo que solo prueba un dispositivo**: cámara óptica, Taptic Engine y VoiceOver real quedan rotulados como no acreditados.
9. **Declarar hecho lo no observado**: la variante Android «sin diálogo runtime» está cubierta por tests deterministas y se rotula como **no validada realmente en dispositivo**.
10. **Creer que `EXPO_PUBLIC_*` es secreto**: acaba en el bundle compilado; solo lleva datos públicos.

### Comparación Android / iOS del día (para repasar)

| Tema | Android | iOS | Por qué difiere |
|---|---|---|---|
| Cámara | Lectura óptica real en el Samsung (ML Kit) | Simulator sin cámara; Vision en dispositivo | El Simulator no tiene hardware de cámara |
| Permiso de notificaciones | Android 13+: diálogo hasta dos veces, rechazo recuperable y luego bloqueado; <33 sin diálogo | Primer rechazo = bloqueado; `provisional`/`ephemeral` llegan como `undetermined` | Políticas del sistema |
| Compartir | `sharedAction` al abrir el selector (cancelar = compartir) | Distingue `dismissedAction` | Contrato del selector del sistema |
| Háptico | Medido en `dumpsys vibrator_manager` y sentido por el usuario | No acreditable en el Simulator | Sin Taptic Engine en el Simulator |
| Deep link en frío | Probado en Release (el Dev Launcher intercepta el enlace) | Igual | El launcher del Development Build |
| Textos y cleartext | Release bloquea HTTP al mock: válido y 404 no se distinguen en frío | Sí se distinguen | Política de tráfico cleartext de Android |

### Ejercicio sin solución

Diseña una máquina de permisos para una capacidad `contacts` con los estados `preview`, `requesting`, `granted`, `denied` y `blocked`.
1. Define los eventos de entrada (confirmar, resultado del sistema, volver a primer plano, cancelar, desmontar) y qué estados los aceptan.
2. Explica cómo impides dos solicitudes simultáneas y cómo descartas un resultado que llega después de desmontar.
3. Decide si «denegado recuperable» y «bloqueado» deben persistirse por usuario, por sesión o por solicitud, y cómo migrarías una versión anterior del estado guardado.
4. Indica qué parte de tu diseño podrías probar con tablas sin RN y cuál solo con un dispositivo real.
5. Compáralo con Activity Result API + `Lifecycle` en Android y con `CNAuthorizationStatus` + `scenePhase` en iOS.

### Preguntas de repaso (respuestas cortas)

1. **¿Qué diferencia hay entre una función síncrona, una `Promise` y un evento nativo?** La síncrona devuelve ya (trabajo barato); la `Promise` representa una operación única; el evento es una secuencia y exige cleanup.
2. **¿Por qué un evento debe llamar a `remove()`?** Para no duplicar observadores ni entregar a una pantalla desmontada.
3. **¿Qué es el epoch del escáner?** La identidad del intento vigente; una respuesta con epoch viejo se descarta (como cancelar un `Job`/`Task`).
4. **¿Qué se hace antes de activar la cámara?** Mostrar la pantalla previa, obtener confirmación en esa apertura y resolver permiso y capacidad efectiva.
5. **¿Qué valida y qué no un iOS Simulator?** UI, estados, navegación y servicios locales; no cámara óptica, Taptic Engine ni VoiceOver real.
6. **¿Por qué el háptico se solicita con un listener tras el reducer?** Para vibrar solo cuando el carrito cambió de verdad (no en límites, bloqueos ni dobles toques).
7. **¿Qué distingue `permissionRequested` de `notified`?** La primera registra el intento de pedir acceso (antes); la segunda confirma una programación satisfactoria (después).
8. **¿En qué se distinguen «denegadas recuperables» y «bloqueadas»?** En las primeras el sistema aún podría mostrar el diálogo en otra orden; en las segundas solo Ajustes lo resuelve. Mismas acciones, distinto texto.
9. **¿Cuándo un cambio exige un binario nuevo?** Si altera la huella: permiso, plugin u opción de plugin, dependencia nativa, módulo Kotlin/Swift o `app.json`; un cambio de texto, lógica TS o imagen no la altera.
10. **¿Por qué la evidencia remota de EAS es requisito del cierre y qué prueba?** Porque la validación local no demuestra que el servicio construya el proyecto desde cero; el build remoto valida la tubería, los perfiles y el gate de la URL, pero no que el catálogo cargue.

### Checklist oral

Se marca solo lo que está respaldado por evidencia registrada. Las casillas sin marcar son para que lo practiques tú en voz alta; no son evidencia del proyecto.

- [ ] Explicar sync/async/evento/vista con analogías Kotlin/Compose y Swift/SwiftUI.
- [ ] Explicar preview, permiso, foreground, epoch y cancelación del escáner.
- [ ] Distinguir cámara, háptico y notificación reales de simulación o de un clasificador determinista.
- [ ] Explicar el cleanup, los callbacks tardíos y el listener post-reducer.
- [ ] Explicar RF-37 (`Tabs`), RF-38 (fuera del render) y RF-39 (migración v3).
- [ ] Inventariar variables sin valores ni secretos y explicar el gate de URL.
- [ ] Clasificar un cambio como OTA candidata o binario nuevo con la huella.
- [ ] Reportar Android físico, iOS Simulator y limitaciones sin inventar evidencia.
- [ ] Explicar por qué EAS remoto es requisito para marcar el día y qué limitaciones tiene (placeholder de URL, `preview` iOS sin credenciales de Apple).

### Registro de verificación del Día 5 (T10, 2026-10-15)

| Comprobación | Resultado | Nota |
|---|---|---|
| `npm run test:logic` | **1082/1082** | sustituye 1013/1013 (2026-10-14); repetido tras los parches |
| `npx expo lint` / `npx tsc --noEmit` / `git diff --check` | OK / OK / OK | repetidos tras los parches |
| `npx expo install --check` | **Dependencies are up to date** | tras `npx expo install expo@~57.0.30 @expo/ui@~57.0.25 expo-router@~57.0.28` (antes fallaba por esos tres parches) |
| `npx expo-doctor@latest` | **21/21** | antes 20/21; solo fallaba la comprobación de versiones |
| Android físico (Samsung SM-A037M, Android 13) | validado en T2–T8 y T11–T14; **recompilado el 2026-10-15** y humo [A] OK | Inicio, DeviceInsights, escáner, deep link, orden ficticia hasta la confirmación y RF-37; variante «sin diálogo runtime» solo determinista |
| iOS Simulator (iPhone 17 Pro, iOS 26.5) | validado en T2–T8 y T11–T14; **recompilado el 2026-10-15** y humo [A] OK | mismos seis pasos; sin cámara óptica, Taptic ni VoiceOver real |
| EAS `development` Android (APK) | **FINISHED**, 2026-10-15 (con parches) | build `f8ab7c9a-d558-4e4a-ad6f-3abe40d2f40e`, huella `13218f3f…` |
| EAS `development` iOS (Simulator) | **FINISHED**, 2026-10-15 (con parches) | build `a5934fef-6623-4f16-80a4-2b1eb2cb48c4`, huella `156ff282…` |
| EAS `preview` Android (APK) | **FINISHED**, 2026-10-15 (con parches) | build `527f5684-6357-46ba-a58f-32b6d8f8d2f3`, huella `13218f3f…` |
| EAS `preview` iOS (`simulator: false`) | **LIMITACIÓN** | exige credenciales de Apple; no se intentó (decisión del usuario) |

Qué prueba y qué no el build remoto: prueba que el servicio instala las dependencias, aplica los config plugins, genera `ios/`/`android/` con CNG y compila el módulo Kotlin/Swift con el perfil indicado, y que su huella coincide con la local. **No** prueba que la app cargue el catálogo (`EXPO_PUBLIC_API_ORIGIN` es el placeholder público `https://api.example.test`, y los artefactos no se instalaron) ni sustituye la validación en dispositivo. `EXPO_PUBLIC_API_ORIGIN` se declara en `env` de cada perfil de `eas.json` (público, no secreto, reproducible desde Git); la alternativa, una variable hospedada en EAS con visibilidad «Plain text», es la que se usaría con una URL real distinta por entorno. Detalle, comandos, límites y seguimientos del Día 6 en `docs/evidence/day-5-platform.md`.

Los builds de esta vuelta reemplazan a los del mediodía (`a13ab87a…`, `08cf7ee7…`, `c66441e0…`), hechos antes de los parches. La huella cambió (Android `a6659518…` → `13218f3f…`, iOS `27b01168…` → `156ff282…`) porque `expo`, `@expo/ui` y `expo-router` son fuentes de la huella: subir un parche de una dependencia nativa pide un binario nuevo, igual que en Android con una subida de versión de Gradle o en iOS con `pod update`. La huella local y la remota coinciden. El commit de cierre es `feat: complete day 5 native platform features` (se consulta con `git log --grep "day 5"`); los builds de EAS muestran el `gitCommitHash` `4e95c67` porque se lanzaron antes de ese commit.

## Día 6 — Calidad y preparación de entrevista (T1–T8; pendiente de validación y commit)

Estado (2026-10-17): T1–T8 hechas en código, pruebas y evidencia; **el commit final lo lanza el coordinador tras la validación RF por RF del reviewer y la confirmación manual del usuario** (AGENTS.md: commit solo al completar y validar el día). La spec 006 sigue `aprobada`; «validada»/`implementada` lo decide el reviewer.

Spec: `specs/006-dia-6-calidad-entrevista` (RF-1 a RF-32, con el cambio de requisitos del gesto de eliminar, aprobado el 2026-10-17). Evidencia fechada: `docs/evidence/day-6-{e2e,accessibility,text-targets,contrast-motion,performance,cart-swipe}.md` (la del gesto: [`docs/evidence/day-6-cart-swipe.md`](docs/evidence/day-6-cart-swipe.md)). Banco final de 30 preguntas: material de preparación privado, no versionado. Quince tareas (T1–T8 con T3, T4 y T6 divididas): excepción documentada y aceptada por el usuario (2026-10-15 las 13 primeras; 2026-10-17 las 15 con T6e y T6f separadas).

### Teoría del día (cada bloque ≤ 10 min, RF-1 y RF-2)

Lectura total ≈ 10 min. Cada bloque va antes de su trabajo y solo resume lo practicado hoy; el detalle con datos está en las secciones siguientes y en `docs/evidence/day-6-*.md`.

**Bloque A — Pirámide de pruebas por riesgo: `node:test`, Jest + RNTL y Maestro.**
Se elige la herramienta por el riesgo y por dónde es más barato que algo falle, no por un porcentaje de cobertura.

| Capa | Qué cubre aquí | Kotlin / Compose (Android) | Swift / SwiftUI (iOS) | Límite |
|---|---|---|---|---|
| `node:test` (`*.test.ts`) | Lógica pura: reducers, selectores, validación, máquinas de estado, formateo | JUnit sobre Kotlin puro | XCTest / Swift Testing sobre lógica sin UIKit | Muy rápido, sin entorno; no ve UI |
| Jest + RNTL (`*.test.tsx`) | Lo que se ve y se oye en un componente: rol, texto, estado, foco | `composeTestRule` (`onNodeWithText`, semántica) | XCTest sobre vistas / ViewInspector | Sin gestos reales ni pila nativa: comprueba cuántas veces NUESTRO código pide navegar |
| Maestro | El flujo crítico en dispositivo (caja negra, un YAML para ambas plataformas) | Espresso / UI Automator | XCUITest | Lento en gama baja y depende de textos y de `clearState` |

Un test que nunca ha fallado no prueba nada: se escribe en rojo primero y se comprueba que falla por la razón esperada (en el Día 6 se rompió a propósito el código con mutaciones para confirmarlo). El mock de `fetch` y de `expo-router` es explícito y pequeño: si el doble imita demasiado, el test comprueba el doble. Error típico al venir de nativo: llamar `fireEvent.press` sobre un elemento ya desmontado; para el «segundo toque» se pulsa el control que ocupa su lugar.

**Bloque B — Accesibilidad: lector de pantalla, foco, objetivos, texto grande, movimiento reducido y contraste.**
- Lector: TalkBack (Android) y VoiceOver (iOS) recorren el árbol de accesibilidad, no el visual. Cada control necesita nombre, rol y estado; el foco debe ir a un lugar lógico al abrir y cerrar hojas y modales, y los cambios dinámicos se anuncian con regiones vivas. En Compose son `semantics { contentDescription, role, stateDescription }` y `LiveRegionMode`; en SwiftUI, `accessibilityLabel`, traits y `AccessibilityFocusState`. En el Simulator solo hay Accessibility Inspector: **no es VoiceOver real**.
- Objetivos táctiles: 44 pt (iOS) y 48 dp (Android) como mínimo, también con texto ampliado.
- Texto grande: se deja crecer el contenido o se desplaza; solo se topa (`fontScaleLimits`) el cromo de caja fija. Desactivar el escalado queda descartado. Equivale a `sp` frente a `dp` en Android y Dynamic Type en iOS.
- Movimiento reducido: la preferencia del sistema (`animator_duration_scale` en Android, Reduce Motion en iOS) apaga animaciones decorativas; la información no puede depender de ellas.
- Contraste: WCAG pide 4,5:1 para texto normal y 3:1 para texto grande y componentes de interfaz; una función pura mide los pares de tokens en claro y oscuro, de modo que un color nuevo mal elegido hace fallar un test.

**Bloque C — Localización y preferencias persistidas: i18n español/inglés, moneda y tema.**
Idioma, moneda y tema son estado de cliente persistido (redux-persist + MMKV). El idioma del sistema nunca se guarda como elección: si no hay elección, manda el dispositivo. Cambiar `PERSIST_VERSION` es una migración (la anterior sigue siendo legible), como `Migration(n, n+1)` en Room o una migración de SwiftData. Los textos son claves con paridad es/en comprobada por tests (mismas variables y plurales según `Intl.PluralRules`); importes y fechas se formatean con `Intl`, equivalentes a `NumberFormat`/`Locale` en Android y a `FormatStyle` en iOS. El tema forzado se propaga a las partes nativas con `Appearance.setColorScheme` (`AppCompatDelegate.setDefaultNightMode` en Android, `overrideUserInterfaceStyle` en iOS). Los diálogos de permisos y el teclado los dibuja el sistema: la app no los controla.

**Bloque D — Profiling: medir antes de optimizar.**
No se memoiza por intuición. El método es baseline → cambio → after contra el mismo build: `<Profiler>` de React (número de commits y `actualDuration`, lo que muestra React DevTools) para el trabajo JS, `dumpsys gfxinfo` para el hilo de UI en Android y el hueco de `requestAnimationFrame` en el Simulator de iOS (que no tiene `gfxinfo`; Instruments quedó descartado y justificado). Un Development Build (Debug) incluye avisos, comprobaciones y un motor menos optimizado: sirve para comparar un cambio contra su baseline, no para prometer cifras de producción, por eso se repitió en Release de iOS. `memo` se conserva solo con una razón medible: `memo(CartLineRow)` bajó los renders de `CartLine` de 36 a 12 y se quedó; `memo(ProductCard)` no mejoró y se descartó. Equivale a medir con Android Studio Profiler / Layout Inspector (recomposiciones) y con Instruments, y a `@Stable`/claves estables en Compose o vistas `Equatable` en SwiftUI.

### Qué se hizo en cada tarea (con decisión, trade-off y descartada)

| Tarea | Qué se hizo | Decisión elegida / trade-off / descartada |
|---|---|---|
| T1 | Harness: Jest + `jest-expo` + RNTL 14 para `*.test.tsx`; `node:test` para `*.test.ts`; `createAppStore` (store aislado por test), `renderWithProviders`, `mock-fetch`, `engines` Node ≥ 22.18 | **Runner mixto** (decisión del usuario). Trade-off: dos runners y dos configuraciones, `npm test` los encadena. Descartado: migrar 1082 tests de lógica a Jest (coste sin riesgo nuevo) |
| T2 | Lógica acumulada y RTK Query con respuestas controladas (éxito, vacío, 4xx, 5xx, timeout, latencia); M-5 (abort durante el cuerpo gana) | Mock de `fetch` propio. Descartado: MSW (fuera del stack aprobado). La carrera pull↔«cargar más» no tiene defecto; en iOS queda como **decisión D** (ver limitaciones) |
| T3a | Componentes por rol/texto/estado; bloqueo de 500 ms contra el doble toque (`useNavigationLockout`) | `expo-router` simulado con un mock explícito. Descartado: `renderRouter` (monta navegadores nativos, frágil bajo Jest) |
| T3b | Offline: «Reintentar» del escáner siempre, título tras reconectar, aviso con datos previos en el detalle, `OUT_OF_STOCK` que vacía el carrito deja el aviso en el checkout, 400 de validación | Todo con test y matriz POST manual aprobada por el usuario. Descartado: decidir con `getNetworkStateAsync` (el sistema puede decir «conectado» con el servidor caído) |
| T4a | `preferences` persistida (`PERSIST_VERSION` 4, v1–v3 legibles), selectores en Cuenta, splash retenido ≤ 1 s | Preferencias en el store persistido + listener. Descartado: `PersistGate` global (bloquea Home) y leer MMKV fuera de redux-persist (dos fuentes de verdad) |
| T4b | Mis pedidos (solo resúmenes confirmados, sin dirección), auditoría i18n en tres capas, «Ir a Inicio» del enlace no reconocido como plan puro | Plan RF-37 + paso raíz. Descartado: `dismissTo('/')` (creaba un Inicio nuevo sobre el detalle) y una regla de ESLint propia para i18n |
| T5 | Maestro: `checkout.yaml` (buscar, agregar, dirección, doble toque, UNA orden) y extras `product-404`/`deep-link-a-b` | `clearState` + mock fresco, selectores por texto y `testID` solo en los 8 campos; ramas por plataforma solo donde difiere. Una mutación con las TRES defensas del doble toque rotas hizo fallar el flujo (iOS) |
| T6a | Lector de pantalla: foco al cerrar hojas y modales, anuncios, `aria-hidden` en rótulos de campo | TalkBack real en el Samsung; iOS con Accessibility Inspector, «no VoiceOver real». Descartado: retrasar anuncios (se cortan con el foco) |
| T6b | Texto ampliado y objetivos: topes `fontScaleLimits` solo en el cromo de caja fija, `scaleWithFont`, `useScrollReveal` | Crecer o desplazar el contenido; topar solo el cromo. Descartado: desactivar el escalado |
| T6c | Contraste WCAG con función pura (38 pares, claro y oscuro), iconos, H-10 en iOS, movimiento reducido | Token `controlBorder`. `AppIcon` mantiene su tamaño en Android; `AppText` con `key` = factor de fuente en iOS. Descartado: `expo-navigation-bar` y `configChanges` (cambio nativo sin necesidad demostrada) |
| T6d | Perfilado baseline/after en Development Build y Release de iOS | C-1 conservado (ver abajo). Release de Android = decisión escrita (HTTP en claro bloqueado). Descartado: cleartext condicionado (cambia la huella) |
| T6e/T6f | Eliminar deslizando: pruebas, escenario Maestro y matriz manual de 8 casos por plataforma | Ver «El gesto de eliminar deslizando» |
| T7 | T7: práctica privada, fuera de este repositorio | No forma parte de este registro |
| T8 | Repaso del día; limpieza (H-4, H-5); verificación completa y este registro | Tres entregas con confirmación del usuario entre cada una |

**Errores típicos al venir de nativo que aparecieron este día.**
1. **Mutación y efectos:** un guard de «cargar más» sobre estado en lugar de una `ref`, y un valor volátil (como un interruptor de error simulado) dentro de las dependencias de un efecto: en Compose sería un `StateFlow` leído dentro de `LaunchedEffect(key)` que reinicia la corrutina.
2. **Probar lo que ya no existe:** `fireEvent.press` sobre un elemento desmontado no hace nada; para el «segundo toque» se pulsa el control que ocupa su lugar.
3. **Medir en Debug y concluir sobre Release:** por eso hay baseline y after contra el mismo build y una repetición en Release de iOS.
4. **Tratar el Simulator como hardware:** VoiceOver real, Taptic y cámara óptica siguen sin acreditar.
5. **Confiar en que Fast Refresh recompila:** retirar `expo-web-browser` (módulo nativo) obligó a recompilar ambos Development Builds.
6. **`fetch` y los códigos 4xx/5xx; `memo` por intuición:** `memo(ProductCard)` se descartó sin mejora medible; `memo(CartLineRow)` se conservó con medida.

### RF-2: Jest, RNTL y Maestro frente a Android e iOS

| Herramienta | Qué cubre aquí | Equivalente Android | Equivalente iOS / SwiftUI | Elegida y trade-off | Descartada |
|---|---|---|---|---|---|
| `node:test` | Lógica pura (`*.test.ts`, 1453) sin RN ni `@/` | JUnit sobre Kotlin puro | XCTest / Swift Testing sobre lógica sin UIKit | Rapidísimo, sin entorno; no ve UI | Migrar a Jest |
| Jest + RNTL 14 | Pantallas y hooks por rol, texto y estado (`*.test.tsx`, 582) | `composeTestRule` (`onNodeWithText`, semántica) / Robolectric | XCTest sobre vistas / ViewInspector; semántica de accesibilidad | Prueba lo que el usuario ve y oye sin dispositivo; no ve gestos reales ni pila nativa | Snapshots masivos; seleccionar por estructura interna |
| Maestro | El flujo crítico y 3 extras en dispositivo real/Simulator | Espresso / UI Automator (`UiDevice`) | XCUITest | Caja negra, un solo YAML en ambas plataformas; lento en gama baja (≈5 min en el Samsung) y depende de textos y de `clearState` | Tocar por coordenadas (solo una excepción, el gesto) y pausas fijas |
| Evidencia manual repetible | Lector, texto ampliado, contraste, movimiento, gesto | TalkBack, `font_scale`, `animator_duration_scale` | Accessibility Inspector, Texto más grande, Reduce Motion | Cubre lo que no se automatiza; depende de una persona | Declarar «cumplido» sin observarlo |

Regla: se elige por riesgo y por dónde es más barato que algo falle, no por porcentaje de cobertura. Teoría y analogías completas en `plan.md`, «Bloque pedagógico».

### El gesto de eliminar deslizando (RF-24 a RF-32)

**Cómo funciona.** `SwipeToDelete` envuelve `ReanimatedSwipeable` (Gesture Handler 2.32): el `Pan` se activa tras 24 dp/pt de recorrido horizontal (`dragOffsetFromRightEdge`), la acción revelada mide ≥ 48 dp/44 pt y se abre cuando el recorrido supera `rightThreshold` = 56. Equivale a `SwipeToDismissBox`/`AnchoredDraggable` de Compose (umbral y estado «abierto») y a `.swipeActions`/`UISwipeActionsConfiguration` de SwiftUI/UIKit; el umbral de activación equivale al *touch slop*.

**Qué se midió (T6f, Samsung SM-A037M y Simulator iPhone 17 Pro).** 80 dp/pt abre (también lento, 1,5 s) y 20 nunca; el umbral lento exacto es ≈ 75–80 dp/pt, **margen de 0–5 dp/pt sobre el requisito de 80**. **La velocidad cuenta:** al soltar, la biblioteca decide con `translationX + 0.05 × velocityX` frente al umbral, así que 60 dp/pt en 100 ms ya abre; por eso todo paso fija una duración (600 ms). Con `axe swipe` hay que usar `--delta 2` (sin él recorta el gesto en iOS).

**La acción revelada está oculta al lector a propósito** (`accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`, RF-28): un lector encuentra una sola acción de eliminar por línea, el botón visible «Eliminar <producto>». Equivale a `Modifier.clearAndSetSemantics {}` y `.accessibilityHidden(true)`; el botón visible es la alternativa gestual (como una `CustomAccessibilityAction`). **Consecuencia:** Maestro lee el mismo árbol accesible y no puede tocarla por texto; por eso `cart-swipe-delete.yaml` desliza `90%,28%` → `40%,28%` en 600 ms y toca `83%,28%`. Es la **única excepción a «sin coordenadas»**, con un control previo (tocar ese punto con la fila cerrada no elimina nada). Descartado: quitar el ocultar o darle un `testID` (contradice RF-28).

**Defectos reales, corregidos con un test que falla antes.**
- **Doble toque (T6e).** Un doble toque (50 ms) en «Eliminar» borraba también la línea que subía a su lugar (iOS, Maestro: carrito vacío). Guardia PROPIA de 500 ms en `CartScreen.tsx` (no es `useNavigationLockout`: un `useRef` síncrono más `setTimeout` con `NAVIGATION_LOCKOUT_MS`), compartida por las filas como prop estable (no rompe el `memo`). Por qué un ref: el segundo toque puede llegar antes del commit de React, cuando la fila pulsada ya se desmonta y la siguiente sube bajo el dedo; un estado aún no habría cambiado o se perdería con la fila, mientras que el ref se lee y escribe de forma síncrona. La ventana se comparte entre «Eliminar» y «−» cuando elimina. Trade-off: dos eliminaciones deliberadas en menos de 0,5 s son una. Descartado: deshabilitar los botones 0,5 s y pedir confirmación o deshacer.
- **D-1 `minWidth` (T6f).** «Eliminar» revelado se partía («Dele / te») con Android 2.0 / iOS AX5 por `width: 112`; ahora `minWidth: 112` (el marco crece con la etiqueta: 123,7 dp en inglés y 149,9 dp en español a 2.0). Trade-off: hasta 150 de 384 dp. Descartado: `adjustsFontSizeToFit`.
- **D-2 guardia de «−» (T6f).** «−» sobre una línea de 1 unidad elimina y compartía la raíz del doble toque; se protege con la MISMA guardia solo cuando elimina (decisión del usuario «Confirmar y proteger «−»»); dos «−» rápidos sobre una línea de 3 siguen bajando 2 unidades. RF-25 no menciona «−» (cabe en su caso límite; la spec no se editó).

**Decisión del usuario sobre el umbral.** La opción de bajar `rightThreshold` de 56 a ≈ 40 (≈ 15 dp/pt de margen, «medio camino» seguiría cerrado) se **descartó**; el margen de 0–5 dp/pt queda como limitación declarada.

**Resultado.** Jest sin mock de `ReanimatedSwipeable` (la real monta; `jest.spyOn(Gesture, 'Pan')` lee `enabled` y `activeOffsetXStart`), 9 mutaciones, `SwipeToDelete.test.tsx` y `CartScreen.test.tsx` ampliado; matriz de 8 casos conformes en ambas plataformas; `cart-swipe-delete.yaml` verde 3 veces seguidas en cada una en T6e y de nuevo en el cierre (tabla final). El bloqueo con la acción abierta: `CartScreen` sustituye todo el árbol por la pantalla de bloqueo, así que no sobrevive ninguna fila. RF-24 a RF-32: **cumplidos con evidencia** en [`docs/evidence/day-6-cart-swipe.md`](docs/evidence/day-6-cart-swipe.md) (la fila de `day-6-contrast-motion.md` enlaza a ella).

### C-1: `memo(CartLineRow)` con medida

Renders de `CartLine`: **36 → 12** en Android y en el Release de iOS (48 → 12 en Debug iOS); Android: trabajo JS 1 770 → 811 ms, commit máximo 144 → 63 ms; Release iOS sin bloqueos ≥ 100 ms antes ni después. Se conserva (decisión por medida, `CartScreen.rerender.test.tsx`). Descartados: `memo(CartLine)` a secas (el selector crea un `item` nuevo por línea), pasar `changeLine` como prop y memoizar el selector por línea. Como `CartLineRow` envuelve al gesto, cualquier cambio de ese `memo` revalida RF-24 a RF-27 además de RF-16. En Compose sería `key` estable + `@Stable`; en SwiftUI, una vista `Equatable`.

### Limpieza de T8: H-4 y H-5

- **H-4 (hallazgo real).** El bundle de producción llevaba `home-fixtures.ts` y `home-fixture-env.ts` aunque `isDev` los dejaba inertes: Metro empaqueta lo que se **importa**, no lo que se ejecuta. Corregido con `require` dentro de la rama `__DEV__` y `buildHomeRequest` con el aplicador inyectado; test `src/test/production-bundle-audit.test.ts` (rojo con las importaciones antiguas, verde tras el cambio), y verificado re-exportando iOS y Android y buscando en el mapa de fuentes y en las cadenas del bytecode. Se retiró también `ScannerPlaceholderScreen.tsx`. En Compose sería código de depuración fuera del `release` (`debugImplementation`); en iOS, `#if DEBUG`.
- **H-5.** Retiradas `expo-web-browser` (la única nativa) y `react-native-web`. **Conservadas** `@expo/ui` y `expo-glass-effect` (dependencias obligatorias de `expo-router` 57) y `react-dom` (peer no opcional de `vaul`, que trae `@expo/ui`): quitarlas del `package.json` no las quita de `node_modules` ni del binario, y npm las reinstalaría con una versión que ya no controlamos. Se recompilaron ambos Development Builds.
- **Script `web` y clave `web`.** Por decisión del usuario («Quitar solo el script») se eliminó el script `"web"` de `package.json` (sin `react-native-web` ya no funcionaba; AGENTS.md no lo menciona). **Residuo conocido:** la clave `web` de `app.json` (`output: static`, `favicon`) se conserva porque tocar `app.json` cambia la huella del build.

### Decisiones y limitaciones que deben constar

- **Android: teclado y diálogo de permisos siguen al SO.** El teclado (tema, idioma, autocorrección) y los diálogos de permisos (cámara, notificaciones) los dibuja el sistema con su idioma y su tema; React Native no ofrece una API para fijarlos y la app solo controla el texto previo a la solicitud. Es lo mismo que en Kotlin con `ActivityResultContracts.RequestPermission` y en Swift con `requestAuthorization`: el diálogo no es de la app.
- **`cameraPermission` de `app.json` en inglés.** El texto del plugin `expo-camera` («Allow $(PRODUCT_NAME) to access your camera») es el valor por defecto en inglés; en iOS se localiza al español con `locales/es.json` (`NSCameraUsageDescription`). En Android el diálogo es del sistema y no usa ese texto. No se cambió (tocar `app.json` cambia la huella).
- **Hint de Búsqueda en Android.** En el Samsung la primera tecla del campo de búsqueda tarda ≈ 70–95 ms: es rendimiento del dispositivo (gama baja), S-7 no se toca. La vista nativa de DeviceInsights no recibe pista (`deviceInsights.nativeHint` retirada por decisión del usuario).
- **Carrera pull↔«cargar más» en iOS = decisión D.** El test con latencia controlada no encuentra defecto (T2); la evidencia en iOS se cierra con una decisión escrita porque `axe` es demasiado lento para provocarla.
- **Audio de TalkBack no verificable.** `SamsungTTS` va cifrado en `logcat`: se observan foco, orden, nombre/rol/estado y eventos de anuncio, no el audio literal. Aceptado por el usuario.
- **VoiceOver «no real».** En iOS se usó `axe` (API UIAccessibility) y el Accessibility Inspector sobre el Simulator, cada fila rotulada «no VoiceOver real»; los anuncios hablados, el foco real y los rasgos `tab`/`selected` no son observables.
- **Voz en el idioma del SO (H-N1).** TalkBack habla con el idioma del SO; solo difiere si el usuario elige otro idioma en Cuenta.
- **Gesto de eliminar:** margen de 0–5 dp/pt sobre el umbral de 80 (arriba), `rightThreshold` sin cambiar por decisión del usuario.
- **Maestro con mutación solo comprobada en iOS.** La mutación con las tres defensas rotas hizo fallar el flujo en iOS; no se repitió en Android (comparten YAML y la defensa es JS).
- **Maestro en el Samsung es lento y a veces inestable en el preámbulo** (`fresh-app.yaml`): ver el registro de verificación.

### Fuera de alcance de 006 (decisión documentada; material para CI/CD, releases y OTA)

Política de huella `--source-skips` para `version`/`versionCode`/`buildNumber`; falso negativo de `locales/` en la huella; `expo-updates`/OTA real (dependencia nueva; `runtimeVersion` con política `fingerprint` es un metadato inerte); `ITSAppUsesNonExemptEncryption` y `preview` de iOS con credenciales de Apple (publicación en tiendas); URL real del catálogo (servicio de producción: `EXPO_PUBLIC_API_ORIGIN` es el placeholder público); iPhone físico (Taptic, cámara óptica iOS); variante Android sin diálogo runtime (sin dispositivo); H-T8-9 (`openSettings()` del Simulator); cambio opcional de RF-8/RF-9 de la spec 003 (spec cerrada).

### Deuda conocida (decisión D escrita; NO corregida en el Día 6)

**Tipos sueltos de `RootState`/`AppDispatch` en `src/core/store/store.ts`.** Eran `any` por un círculo de tipos slice↔store; derivarlos de `createAppStore` los hace precisos y destapa ≈ 32 errores (`OrderStatusScreen`, `checkout-thunks`, tests de los Días 4–5). `store.ts` los mantiene sueltos a propósito (comentado) y `createTestStore` sí devuelve tipos precisos. Apretarlos es una tarea aparte. Equivale a un `typealias` genérico a `Any` en Kotlin (o a `AnyObject` en Swift): compila, pero pierde la ayuda del compilador.

**Decisión D (usuario, 2026-10-17: «Decisión escrita (D) y tarea aparte»).**
- **Elegida:** dejar `RootState`/`AppDispatch` con el `any` documentado en `src/core/store/store.ts` y abrir una tarea aparte. **Trade-off:** el tipado estricto destapa ≈ 32 errores en `OrderStatusScreen`, `checkout-thunks` y los tests de los Días 4–5; resolverlo dentro del Día 6 amplía el alcance de un día de calidad y entrevista y arriesga regresiones en un checkout ya validado con Maestro, a cambio de una deuda declarada: `getState()` devuelve `any` donde se usa el store global.
- **Excepción explícita:** la spec 006 dice «sin aceptar deuda conocida de días anteriores»; esta es la única que se cierra con D y no con C o V, aprobada por el usuario. No cambia ningún RF ni el comportamiento.
- **Descartada:** corregirla en el Día 6 con una tarea T6g (toca 3 zonas de código ya validado, fuera de los RF).
- **Tarea futura propuesta:** «Tipar de forma estricta `RootState` y `AppDispatch`». Archivos: `store.ts` (derivarlos de `createAppStore` rompiendo el círculo con `import type` o con un `rootReducer` propio), `OrderStatusScreen.tsx`, `checkout-thunks.ts` y los tests de los Días 4–5. **Éxito:** `npx tsc --noEmit` strict en 0 errores y sin `any`/`LooseState` en esos dos tipos, lint limpio, lógica y Jest iguales (1453/582) sin cambiar el comportamiento ni un `expect`, `CartScreen.rerender.test.tsx` y `checkout.yaml` en verde.
- **Para la entrevista:** «¿por qué `any`?» → por un círculo de tipos (los slices importan `RootState` del store, que se infiere de los slices); la solución de manual es separar `rootReducer` y derivar los tipos de él, y se aplazó por decisión consciente, no por desconocimiento.

### Ejercicio adicional SIN solución: «Pedidos acotados»

#### Contexto

Hoy `orderHistory.orders` **no tiene tope**: `addOrderSummary` solo añade y `sanitizeOrderHistory` solo descarta lo inválido y los duplicados. Imagina que producto pide que *Mis pedidos* conserve **únicamente los 20 pedidos más recientes** y que un estado guardado dañado nunca tumbe la pantalla ni muestre datos que no debe. La spec 006 está cerrada, así que esto es **práctica en una rama o carpeta desechable**, sin cambiar el comportamiento aprobado de HerbStore.

#### Enunciado

1. **Tabla primero.** Antes de escribir código, redacta una tabla «estado guardado → qué se restaura» con, como mínimo: (a) 25 pedidos válidos; (b) un estado de versión 3 sin `preferences`; (c) un pedido con `createdAt` ilegible; (d) un pedido que arrastra un campo `shippingAddress`; (e) dos pedidos con el mismo `id`; (f) `orders` que no es un arreglo; (g) un slice que no es JSON; (h) una versión de persistencia desconocida (mayor que la actual).
2. **Pruebas de lógica en rojo.** Convierte la tabla en casos de `node:test` (`*.test.ts`) y comprueba que **fallan por la razón esperada** antes de implementar nada. Sin snapshots.
3. **Criterio de «más recientes».** Decide cómo ordenas y recortas (por `createdAt`, por orden de llegada o ambos) y qué haces con las fechas ilegibles. Justifícalo con su trade-off y di qué alternativa descartas.
4. **Recortar y notificaciones.** Los pedidos guardan un estado de notificación por `id`. Define qué ocurre con las notificaciones de los pedidos que salen del tope y demuestra con un test que no quedan huérfanas.
5. **Dónde se recorta.** ¿Al añadir un pedido, al restaurar el estado guardado o en ambos sitios? Explica qué cambia en cada opción (rendimiento al arrancar, estado que ya está en disco, coherencia entre ambos).
6. **¿Hay que subir `PERSIST_VERSION`?** Razónalo por escrito: ¿cambia la **forma** del estado guardado? ¿Qué le pasa a un dispositivo que vuelve a una build anterior con lo ya recortado?
7. **Rehidratación con RNTL.** Con un almacén en memoria cuyas lecturas puedes retener (`createMemoryStorage({ holdReads })`), comprueba en `OrderHistoryScreen` (español e inglés) que (i) antes de rehidratar **no** afirma «sin pedidos», (ii) después muestra como máximo 20 filas, la más reciente primero, y (iii) cada fila es **un solo** elemento accesible sin dirección.
8. **Privacidad.** Inspecciona la cadena realmente escrita en el almacenamiento tras añadir un pedido que arrastra un campo extra y demuestra que no contiene dirección.
9. **Dispositivo (opcional).** En Android e iOS, con texto grande, comprueba que una fila de 20 pedidos no se trunca y que el lector la anuncia como una frase.
10. **Diagnóstico (sin respuestas aquí).** Explica cuántos problemas tiene este fragmento y qué cambiarías:

```tsx
function OrdersDraft() {
  const orders = useAppSelector((state) => state.orderHistory.orders);
  const latest = orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);

  if (latest.length === 0) return <Text>Aún no tienes pedidos</Text>;

  return latest.map((order) => (
    <Text key={order.createdAt}>
      {order.id} - {order.address.city} - {order.total}
    </Text>
  ));
}
```

#### Criterios de aceptación

- La tabla del punto 1 existe y **cada fila** tiene al menos un caso de prueba.
- Todos los casos de lógica se vieron fallar antes de implementar y pasan después; ninguno depende del orden de ejecución ni de internet.
- Con 25 pedidos válidos se restauran exactamente 20, los más recientes, sin mutar el arreglo recibido.
- Un pedido con campo `shippingAddress` sale del saneado **sin** ese campo.
- Una versión desconocida, un slice que no es JSON y un `orders` que no es un arreglo producen un estado válido y la pantalla no se rompe; explicas por escrito cuál de ellos vacía **todo** el estado persistido y por qué.
- No quedan notificaciones asociadas a pedidos que ya no existen.
- La prueba RNTL localiza elementos por rol, texto o etiqueta, no por estructura interna, y pasa en español e inglés.
- El texto de la pantalla no promete sincronización, respaldo ni recuperación externa.
- La explicación del punto 6 distingue «cambia la forma» de «cambia el contenido».
- `npx expo lint` y `npx tsc --noEmit` en verde en tu rama.

#### Pistas (no son la solución)

- Mira cómo `sanitizeOrderHistory` ya pasa la lista de `id` válidos a `sanitizeOrderNotificationState`: es la costura por donde se mueve el punto 4.
- Un test que recorta tiene dos formas de fallar: recortar de menos y recortar los pedidos **equivocados**. Escribe un caso para cada una.
- Pregúntate si `Array.prototype.sort` y `reverse` mutan, y qué pasa cuando el estado de Redux está congelado.
- `Date.parse` devuelve `NaN` ante una fecha ilegible y `NaN` no es comparable con nada: define qué ocurre antes de ordenar.
- La política de versiones de `persist-policy.ts` distingue «legible» de «igual»; lee el comentario de `READABLE_PREVIOUS_VERSIONS` antes del punto 6.
- Para el punto 7, el estado «aún no rehidratado» es observable en el store; no hace falta temporizadores.
- Para el punto 8 no necesitas MMKV: el almacén en memoria del harness guarda la cadena que redux-persist escribió.

#### Qué entregar

El código (rama o carpeta de práctica), la tabla de casos (entrada, resultado esperado, prueba que la cubre), tu explicación en tus palabras (máximo 8 líneas) de los puntos 3, 5 y 6, y la comparación con **Room** (`Migration`, `@Query` con `LIMIT` y `ORDER BY`) y con **SwiftData** o Core Data (`SchemaMigrationPlan`, `FetchDescriptor` con `fetchLimit` y orden). Debes poder defender qué parte probarías en Node y cuál solo con un dispositivo.

### Preguntas de repaso del Día 6 (respuestas cortas)

**Número de preguntas de repaso: 10** (R1 a R10). Banco final de 30 preguntas: material de preparación privado, no versionado.

**R1. ¿Qué cubre cada herramienta de prueba del proyecto y cómo se elige?**
`node:test` (`*.test.ts`) para lógica pura, Jest + RNTL (`*.test.tsx`) para lo que se ve y se oye en un componente, y Maestro para el flujo crítico en dispositivo. Se elige por riesgo y por dónde es más barato que algo falle; la extensión decide el runner (al cierre del Día 6, 1453 de lógica y 582 de Jest).

**R2. En RNTL, ¿cómo se prueba un «segundo toque» si el primero hace desaparecer el botón?**
`fireEvent.press` sobre un elemento ya desmontado no hace nada, así que para simular el segundo toque se pulsa el control que ocupa su lugar (por ejemplo, el de la línea que subió). Así se comprobó que el doble toque no borraba dos líneas.

**R3. ¿Qué ocurre al arrancar con idioma, moneda y tema persistidos?**
`i18n` arranca con el idioma del dispositivo y el splash se retiene; redux-persist rehidrata y `migrate` sanea; un listener aplica idioma y tema forzado dentro del mismo `REHYDRATE`; el splash se libera al rehidratar o a 1 s como máximo. Un `language` ausente significa «nunca elegido» y sigue al dispositivo.

**R4. ¿Qué muestra y qué nunca muestra «Mis pedidos»?**
Muestra solo resúmenes confirmados de esta instalación (más reciente primero, unidades, total en la moneda preferida y fecha). Nunca muestra dirección, nombres de producto ni promete sincronización; y antes de rehidratar no afirma «sin pedidos».

**R5. ¿Qué evidencia de lector de pantalla se obtuvo en cada plataforma y con qué límite?**
Android: TalkBack real en el Samsung (orden de foco, nombre, rol y estado, eventos de anuncio, retorno de foco); el audio no es verificable. iOS: Accessibility Inspector sobre el Simulator, rotulado «no VoiceOver real», sin anuncios hablados ni foco real del lector.

**R6. ¿Cómo se comporta la app con texto grande y qué objetivos táctiles se exigen?**
Mínimos de 48 dp en Android y 44 pt en iOS; los topes de escala (`fontScaleLimits`) solo se aplican al cromo cuya caja no puede crecer, y el contenido crece o se desplaza. En Android cambiar el tamaño recrea la Activity; en iOS `AppText` vuelve a medir con una `key` igual al factor de fuente (H-10).

**R7. ¿Qué umbrales de contraste se verificaron y cómo?**
WCAG AA: 4.5:1 para texto normal y 3:1 para texto grande y componentes. Una función pura calcula el contraste y una auditoría mide 38 pares de tokens en tema claro y oscuro; destapó el rojo de error (2,46:1 en oscuro), `textMuted` y los bordes de controles (token `controlBorder`).

**R8. ¿Qué garantiza «movimiento reducido»?**
Los mismos cambios de estado con un resultado estático: los spinners de «Restaurando carrito…» y «Cargando producto…» se retiraron (queda el título) y un test de auditoría falla si aparece una animación sin decidir. Límite declarado: la pila nativa de iOS sigue deslizando.

**R9. ¿Qué mide `<Profiler>` y por qué no se comparan cifras de Debug con las de Release?**
Mide commits y `actualDuration` de React por componente. Debug añade comprobaciones de desarrollo y en Release React no invoca `<Profiler>`, así que solo se compara cada build contra su propio baseline y se conserva un cambio únicamente si mejora una medida sin empeorar otra (p. ej. renders de `CartLine` de 36 a 12).

**R10. ¿Qué umbrales tiene eliminar deslizando y qué defectos reales aparecieron?**
El gesto se activa a 24 dp/pt; abre con 80 y no con 20 o menos, y la velocidad cuenta. La acción revelada se oculta al lector y el botón visible es la alternativa. Defectos corregidos con test: el doble toque en «Eliminar» borraba también la línea siguiente (guardia de 500 ms, extendida a «−» sobre una unidad) y «Eliminar» se partía a Android 2.0 o iOS AX5 (`minWidth` en lugar de `width`).

### Checklist oral

Marca solo lo que puedas explicar **de memoria y sin mirar**, en unos 60 segundos por punto. Las casillas son para que las practiques en voz alta; no son evidencia del proyecto.

**Decisiones y trade-offs**
- [ ] Por qué hay dos runners (`node:test` y Jest) más Maestro, y qué riesgo cubre cada uno.
- [ ] Lista blanca de persistencia, `PERSIST_VERSION` 4, qué pasa con una versión desconocida y por qué la caché de la API nunca se guarda.
- [ ] Las tres defensas contra la orden duplicada y la mutación que demostró que hacen falta las tres.
- [ ] El orden de arranque con preferencias persistidas (idioma, moneda y tema) y por qué no se usó `PersistGate`.
- [ ] RTK Query como única fuente remota: frescura 60 s, dos reintentos solo en `GET`, `currentData` frente a `data`.
- [ ] Cuándo se memoiza y cuándo no (React Compiler, `memo` de `CartLineRow` frente a `memo(ProductCard)`), con la medida que lo decide.
- [ ] «Ir a Inicio» como plan puro de acciones y por qué `dismissTo('/')` fallaba.

**Cifras del proyecto**
- [ ] 300 productos (60 por categoría), umbral de envío gratis de 800 MXN y tasa fija de 18.
- [ ] 1453 tests de lógica y 582 de Jest al cierre del Día 6 (81 en el mock); Expo Doctor 21/21.
- [ ] 48 dp / 44 pt de objetivo táctil; 4.5:1 y 3:1 de contraste; 38 pares auditados.
- [ ] Gesto de eliminar: activa a 24, abre con 80, no abre con 20; guardia de 500 ms.
- [ ] Debounce de 400 ms, timeout de 8 s, 2 reintentos (500 y 1000 ms), 60 s de frescura.
- [ ] Renders de `CartLine` 36 a 12; 3 builds remotos de EAS.

**Limitaciones honestas (no las escondas)**
- [ ] No hay CI/CD real, ni OTA real (`expo-updates` no está instalado), ni publicación en tiendas, ni autenticación: son «qué haría» y «qué decidimos no hacer».
- [ ] No hay Release de Android medible (HTTP en claro bloqueado, decisión escrita) y `preview` de iOS en dispositivo exige credenciales de Apple.
- [ ] Nunca se probó VoiceOver real ni se oyó el audio de TalkBack; el iPhone solo se vio con el Accessibility Inspector.
- [ ] La reconexión real de `expo-network` en iOS no tiene evidencia (el Simulator comparte la red del Mac).
- [ ] Deuda conocida (decisión D): `RootState` y `AppDispatch` tipados sueltos a propósito en `store.ts`; sabes explicar el círculo de tipos, el trade-off y la tarea de arreglo propuesta.

**Errores típicos al venir de nativo**
- [ ] Mutar el estado (`push`, `sort`) en lugar de crear uno nuevo.
- [ ] Efectos con dependencias mal declaradas, sin limpieza o con `setState` síncrono dentro.
- [ ] Renders innecesarios y `useMemo`/`useCallback` por intuición.
- [ ] Trabajo pesado en el hilo de JS (no hay `ViewModel` ni hilo secundario por defecto).
- [ ] Creer que `fetch` rechaza ante un 4xx o 5xx; guard de «cargar más» sobre estado en lugar de una ref.
- [ ] Creer que `useEffect` es `onResume`, que Fast Refresh recompila código nativo o que una prueba en Debug demuestra el Release.

**Cómo hablar de un defecto propio**
- [ ] Contarlo en cuatro pasos: qué viste, causa, test que lo fija y decisión (corregir o cerrar con decisión escrita), sin defender lo indefendible.

### Registro de verificación del Día 6 (T8, entrega 3, 2026-10-17; RNF-2)

Salidas reales, en este orden. Entorno: Expo SDK 57 (`expo` ~57.0.30), RN 0.86.3, Node 24.14, Maestro 2.11.0 (Java 25), Samsung SM-A037M (Android 13, USB, `adb reverse` 8081/3001) y Simulator iPhone 17 Pro (iOS 26.5).

| Comprobación | Resultado |
|---|---|
| `npx expo lint` / `npx tsc --noEmit` | salida limpia, código 0 / 0 |
| `npm run test:logic` | **1453/1453**, 0 fallos (233 suites) |
| `npm run test:jest` | **582/582** en 51 suites |
| `npm test` | 1453 + 582, código 0 |
| `npm --prefix mock-server test` | **81/81** |
| `npx expo install --check` / `npx expo-doctor@latest` | «Dependencies are up to date» / **21/21** |
| `git diff --check`; `grep -rn "TEMP-" src` | sin salida; 0 coincidencias |
| `git status` | `ios/` y `android/` ignorados |
| Maestro `checkout.yaml` iOS (desde `clearState`, mock fresco `ORDER_POST_DELAY_MS=1500`) | **VERDE**, código 0, 88 s, stock de `product-261009-062` 99 → 98 (una orden) y una fila en «My orders» |
| Maestro `checkout.yaml` Samsung (ídem) | **VERDE**, código 0, 317 s, stock 99 → 98 y una fila. El paso «Tap on English» de `fresh-app.yaml` falló una vez dentro de su `retry` y se recuperó (ya documentado en la entrega 2) |
| `product-404.yaml` iOS / Samsung | VERDE (32 s) / **1 ROJO y 2 VERDES** (74 y 82 s): la primera ejecución falló en el preámbulo `fresh-app.yaml` («Search products» no visible) con el launcher del Samsung en primer plano tras cerrar el Dev Menu; no se pudo diagnosticar (el buffer de `logcat` ya se había renovado) y las dos siguientes pasaron sin cambios. **Observación abierta, no ajustada para que pase** |
| `deep-link-a-b.yaml` iOS / Samsung | VERDE (42 s) / VERDE (82 s) |
| `cart-swipe-delete.yaml` iOS / Samsung | VERDE (47 s) / VERDE (106 s) |

**Reinicio real (RF-8, RF-9, RF-10, RF-11; criterio de finalización).** Antes no había evidencia de un cierre de proceso en `docs/evidence/` de T4a/T4b, así que se ejecutó: tras `checkout.yaml` (idioma inglés, MXN, tema Sistema, 1 pedido) se eligió **Español + Dólares (USD) + Oscuro** en Cuenta; luego iOS `simctl terminate` (+ comprobación de que el proceso no figura) y Android `am force-stop` (`pidof` vacío; después PID nuevo) y se abrió el dev client otra vez. Resultado en ambas plataformas: Cuenta muestra «Español», «Dólares (USD)» y «Oscuro» seleccionados con el tema oscuro aplicado, e Inicio sale en español; «Mis pedidos» muestra el pedido confirmado en español con el total en USD (USD 30.55) y sin dirección. Capturas en el scratchpad de la sesión, no en el repo. En Android la primera captura tras el arranque en frío salió en blanco (velo del launcher) y se repitió, como ya se sabía.

**Estado final de dispositivos y servicios.** Tras los extras (`clearState`) ambos quedaron en inglés + MXN + Sistema, sin pedidos ni carrito (comprobado en la app). Samsung: `stay_on_while_plugged_in` 0, `font_scale` 1.0, `animator/transition/window_animation_scale` 1.0, TalkBack apagado. Simulator: `content_size` large, apariencia light, Reduce Motion 0, `AccessibilityEnabled`/`ApplicationAccessibilityEnabled` 0, `AutomaticMinimizationEnabled` 1. Mock reiniciado con `MOCK_LATENCY_MS=150 ORDER_POST_DELAY_MS=1500` (stock 99); Metro (8081) sin tocar.

**Comprobaciones en dispositivo de la ronda 2 del reviewer (2026-10-17; sin cambios de código).** Samsung SM-A037M e iPhone 17 Pro (Simulator), detalle en `docs/evidence/day-6-t4-device-checks.md`, `day-6-cart-swipe.md` §T6f.6 y `day-6-contrast-motion.md` §9:
- **«Ir a Inicio» del enlace no reconocido (T4b, puntos 2 a 5):** conforme en ambas, desde Inicio y desde la pestaña Carrito, y los 404 de producto y categoría. Android: `uiautomator`/`A11y` y `dumpsys window` (Atrás → launcher); iOS: `axe` y gesto de borde. Comparación: los intent filters de Android entregan el enlace a la Activity viva (`onNewIntent`) y el stack de tareas decide qué hay «detrás»; en iOS el enlace llega por `application(_:open:options:)` / Universal Links y `UINavigationController` conserva su pila: en ambos, expo-router traduce el enlace a una acción de navegación, y `+not-found` debe construir su propia salida a la raíz.
- **Tema «Sistema» en caliente:** conforme en 6 superficies por plataforma. Android `cmd uimode night yes|no` (equivale a `AppCompatDelegate.setDefaultNightMode`, que recrea/actualiza la configuración `uiMode`) e iOS `simctl ui appearance` (equivale a cambiar `UITraitCollection.userInterfaceStyle`, o a forzarlo con `overrideUserInterfaceStyle`); en RN, `useColorScheme()` emite el cambio y la UI de JS se vuelve a renderizar. El Samsung tarda ≲ 6 s. La barra de navegación de tres botones del Samsung sigue clara en oscuro (decisión D de T4a).
- **Caso límite del gesto (acción abierta + otra línea):** conforme en ambas; la fila abierta sobrevive a «+», «−» y al borrado de otra línea y solo se elimina al tocar su acción.
- **Iconos de la barra (1.5 y 2.0) y texto en caliente en iOS:** observados sin recortes; pendientes de confirmación visual del usuario. S-RF24 **no** comprobado (inconcluso): sigue como paso manual.
- Dispositivos restaurados: `font_scale` 1.0, animaciones 1.0, TalkBack apagado, `cmd uimode night no`, `stay_on_while_plugged_in` 0; Simulator `large`, `light`, Reduce Motion 0; ambos en inglés + MXN + Sistema, carritos y «Mis pedidos» vacíos.

**Qué prueba y qué no.** Prueba que las pruebas, tipos, dependencias y el flujo crítico en dos plataformas pasan sobre el mismo árbol. **No** prueba: Release de Android, VoiceOver real, audio de TalkBack, iPhone físico, ni la mutación de las tres defensas en Android (limitaciones arriba). Lo pendiente de validación manual del usuario consta en el informe de la entrega 3 y en `tasks.md`. El commit de cierre aún **no existe**: lo lanza el coordinador tras la validación.
