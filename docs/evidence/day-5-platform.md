# Día 5 — evidencia de plataforma y entrega

**Fecha de registro original:** 2026-10-13 (cabecera histórica «T9 y T10 parcial», superada: ver «Estado vigente»).
**Alcance:** evidencia acumulada del Día 5 (T1–T14) y cierre de T10 (RF-1–RF-3, RF-27, RF-32–RF-36, RNF-1–RNF-5). No se publica ninguna OTA.

## Estado vigente (2026-10-15, tras aplicar los tres parches)

> Resumen corto y autoritativo. Si una sección más abajo lo contradice, está rotulada como «superada» y manda este bloque. El detalle de esta vuelta está en «Cierre de T10, vuelta 2» (casi al final); la regresión y los builds EAS previos al parche, en «Cierre de T10 — 2026-10-15».

- **Tareas:** T1–T9 y T11–T14 marcadas en `tasks.md`; T8 cerrada con la limitación de iOS aceptada por el usuario; @reviewer APROBADO (2026-10-15) tras corregir RF-31. **T10 queda marcada y la spec `implementada`; @reviewer dio APROBADO en la validación final (2026-10-15) y el Día 5 está cerrado en el commit `feat: complete day 5 native platform features` (se consulta con `git log --grep "day 5"`).**
- **Dependencias:** por decisión del usuario se aplicaron los tres parches de SDK 57 (`expo` ~57.0.30, `expo-router` ~57.0.28, `@expo/ui` ~57.0.25). `npx expo install --check` **«Dependencies are up to date»** y `npx expo-doctor@latest` **21/21**.
- **Regresión (2026-10-15):** `npm run test:logic` **1082/1082**; `npx expo lint`, `npx tsc --noEmit` y `git diff --check` en verde.
- **Plataformas:** Android físico (Samsung SM-A037M, Android 13) e iOS Simulator (iPhone 17 Pro, iOS 26.5) validados en T2–T8 y T11–T14, con las limitaciones rotuladas en cada sección (sin cámara óptica, Taptic ni VoiceOver real en el Simulator; variante Android «sin diálogo runtime» solo determinista). **Los Development Builds se recompilaron el 2026-10-15 con los tres parches** (Android BUILD SUCCESSFUL, iOS Build Succeeded) y la matriz mínima de humo pasó en ambas plataformas [A] (inicio, DeviceInsights, escáner, deep link, orden ficticia hasta la confirmación, RF-37).
- **EAS remoto (RF-28/RF-36): CONSEGUIDO y repetido el 2026-10-15 con los parches** para `development` Android (APK), `development` iOS (Simulator) y `preview` Android (APK): los tres `FINISHED` (ids en «Cierre de T10, vuelta 2»). `preview` iOS (`simulator: false`) queda como **LIMITACIÓN declarada** (credenciales de Apple, no intentado). La URL del catálogo en esas compilaciones es el placeholder público `https://api.example.test`: la tubería compila, pero la app no carga catálogo.
- **Huellas nuevas** (local = remota): Android `13218f3f…`, iOS `156ff282…`; cambiaron frente a `a6659518…` y `27b01168…` por los tres parches.
- **Limpieza de ruido:** `modules/device-insights/android/build/` SÍ está ignorada (`.gitignore`); las celdas «iOS no validado» de T8 se resolvieron en el pase iOS único; la cabecera «T9 y T10 parcial» y las cifras 900/900, 1013/1013 y Doctor 20/21 de secciones anteriores son históricas.
- **Qué falta:** nada del Día 5. La validación de @reviewer está dada (APROBADO, 2026-10-15) y el commit de cierre (`feat: complete day 5 native platform features`) ya existe; el siguiente trabajo es el Día 6. Los builds de EAS muestran el `gitCommitHash` `4e95c67` porque se lanzaron antes de ese commit.

## Perfiles EAS

`eas.json` contiene los perfiles `development` y `preview`, sin credenciales, tokens,
certificados ni valores secretos.

| Perfil | Android | iOS | Distribución | Runtime/app ids |
|---|---|---|---|---|
| `development` | APK, `developmentClient: true` | Simulator | `internal` | Hereda `com.herbstore.mobile`; runtime `fingerprint` |
| `preview` | APK | dispositivo, `simulator: false` | `internal` | Hereda `com.herbstore.mobile`; runtime `fingerprint` |

La configuración de `app.json` mantiene el mismo identificador Android
(`com.herbstore.mobile`) y bundle identifier iOS (`com.herbstore.mobile`). La política
`runtimeVersion: { policy: "fingerprint" }` se aplica a ambas plataformas; por tanto,
un cambio nativo que modifique la huella requiere un nuevo binario/runtime.

### Validación

- Validación local de configuración Expo: ejecutada con `npx expo config --json`.
- Validación local estructural de perfiles EAS: ejecutada con un script Node que comprobó
  los dos perfiles, distribución/plataformas, APK, modo Simulator y coincidencia de
  ids/runtime; resultado **OK**. `npx eas-cli@latest config` no pudo resolver perfiles
  porque EAS solicita una cuenta antes de continuar.
- Validación remota EAS: **SUPERADA el 2026-10-15** (ver «Cierre de T10 — 2026-10-15»). Cuando se escribió
  esta viñeta (2026-10-13) no había sesión EAS ni build remoto; hoy hay tres builds remotos `FINISHED`.
  La validación local de arriba sigue sin presentarse como remota.

## Inventario de variables

Solo se registran nombres y metadatos; nunca valores.

| Variable | Consumidor | Propósito | Exposición | Entorno | Obligatoria |
|---|---|---|---|---|---|
| `EXPO_PUBLIC_API_ORIGIN` | App Expo | Origen HTTP(S) bare del catálogo | Pública, incluida en el bundle | development, preview y runtime de la app | Sí |
| `EXPO_PUBLIC_HOME_FIXTURE` | App Expo | Fixture de Home para escenarios de desarrollo | Pública; solo se lee bajo `__DEV__` | development/tests manuales | No |
| `MOCK_LATENCY_MS` | `mock-server` | Latencia artificial de catálogo | Servidor local; no llega al bundle | mock local | No |
| `ORDER_PROCESSING_MS` | `mock-server` | Duración simulada de procesamiento de órdenes | Servidor local; no llega al bundle | mock local | No |
| `ORDER_POST_DELAY_MS` | `mock-server` | Retardo artificial del POST de órdenes | Servidor local; no llega al bundle | mock local | No |
| `ORDER_POST_FAULT` | `mock-server` | Fallo controlado del POST (`server-error`/`inconsistent`) | Servidor local; no llega al bundle | mock local | No |
| `ORDER_ACTIVE_MS` | `mock-server` | Ventana activa configurable de órdenes | Servidor local; no llega al bundle | mock local | No |
| `HOST` | `mock-server` | Interfaz de escucha HTTP | Servidor local; no llega al bundle | mock local | No |
| `PORT` | `mock-server` | Puerto de escucha HTTP | Servidor local; no llega al bundle | mock local | No |

No se encontraron variables secretas consumidas por la app o el mock. Se excluyen
variables internas de Node, Expo CLI, EAS y del sistema operativo. `EXPO_PUBLIC_*` no
se trata como secreto: Expo las expone al JavaScript compilado.

## Ausencia de URL y fallo temprano

La frontera `resolvePublicConfig` clasifica la URL como `missing`, `invalid` o `ready`.
`PublicConfigGate` se monta antes de la navegación/store; con `missing` o `invalid` no
se monta el catálogo ni se hace una petición de red. El diagnóstico solo nombra la
variable y el formato esperado, sin mostrar valores ni introducir un host implícito.

La prueba lógica `src/core/config/public-config.test.ts` reproduce URL ausente, URL con
ruta inválida y origen válido. La URL válida usada en tests es un placeholder y no es
un endpoint de despliegue.

## Matriz OTA frente a binario

**Corrección 1 del reviewer (RF-31), 2026-10-15.** La versión anterior de esta sección era
declarativa («no cambia la huella»). Ahora cada fila está medida con `@expo/fingerprint`
0.20.14 (la versión instalada con `expo` 57.0.29, que es la misma que usa el CLI) sobre una
copia del proyecto; no se publicó ninguna actualización OTA y no se instaló ninguna
dependencia.

### Herramienta y comandos realmente disponibles

`node_modules/.bin/fingerprint --help` lista dos comandos: `fingerprint:generate`
(opciones `--platform`, `--source-skips`, `--ignore-path`, `--hash-algorithm`, `--debug`) y
`fingerprint:diff <a.json> <b.json>`. En este proyecto no existe el script npm
`fingerprint:*` ni `expo-updates` (su CLI `expo-updates fingerprint:generate` no está
disponible), por lo que se usó el binario directo:

```bash
node_modules/.bin/fingerprint fingerprint:generate --platform android > fp-android.json
node_modules/.bin/fingerprint fingerprint:generate --platform ios     > fp-ios.json
node_modules/.bin/fingerprint fingerprint:diff <base>.json <variante>.json
```

### Huella real por plataforma (línea base)

| Plataforma | Hash (sha1) | Fuentes | Composición |
|---|---|---|---|
| Android | `96c8994e4e31439aee5fee8863e3d381273af233` | 96 | 48 `file` + 43 `dir` + 5 `contents` |
| iOS | `7ac6ef0794acf97155283b25a9192738abe51170` | 94 | 45 `file` + 44 `dir` + 5 `contents` (sin `ios/` generado) |

Las fuentes son: `app.json` resuelto (`expoConfig`), archivos de config plugins y
recursos referenciados por la config (iconos/splash), `eas.json`, `.gitignore`, `scripts`
de `package.json`, la config de autolinking (`expoAutolinkingConfig`), el módulo local
`modules/device-insights/{android,ios}` y los directorios nativos de cada paquete de
`node_modules`. El código TypeScript de `src/` **no** es una fuente.

Con las carpetas generadas `android/` e `ios/` presentes la herramienta cuenta 97 y 95
fuentes (una más: el directorio nativo), pero el **hash es idéntico** (al estar en
`.gitignore`, la herramienta no suma su contenido a la huella). Por eso el hash de CNG debería coincidir con el que
calcule EAS Build, que no tiene esas carpetas (EAS puede aplicar sus propias opciones de
omisión; no se verificó en remoto). Dos ejecuciones consecutivas dan el mismo hash
(determinista).

### Cómo se midió sin tocar el árbol de trabajo

El árbol tiene 66 entradas sin commitear. No se editó ningún archivo del producto. Se clonó
el proyecto completo con `cp -cR` (clon copy-on-write de APFS, sin gasto de disco) a un
directorio temporal, se comprobó que el clon da **los mismos hashes** que el original
(Android `96c8994e…`, iOS `7ac6ef07…`) y todas las variantes se aplicaron solo en el clon,
restaurando cada archivo con `cp -c` desde el original y comprobando con `cmp`. Al final
`git status --short` y `git diff` del repositorio real son byte a byte idénticos a los
capturados antes (solo cambió el log de Metro `.expo/dev/logs/start.log`, ignorado por
Git y escrito por un servidor de desarrollo en marcha).

### Resultados medidos

«=» significa hash idéntico a la línea base; «≠» hash distinto, con la fuente que cambió.

| Id | Cambio aplicado en el clon | Android | iOS | Clasificación |
|---|---|---|---|---|
| A1 | Cadena i18n (`tabs.home` en `es.ts`) | = | = | OTA candidata |
| A2 | Lógica TS: constante nueva en `cart.ts` | = | = | OTA candidata |
| A3 | Imagen nueva en `assets/images/` no referenciada por la config | = | = | OTA candidata |
| A5 | Rango de una dependencia solo JS en `package.json` (`zod`) | = | = | OTA candidata |
| B1 | `android.permissions` += `VIBRATE` | ≠ (`expoConfig`) | ≠ (`expoConfig`) | Nuevo binario |
| B2 | `ios.infoPlist` += clave de permiso de ubicación | ≠ (`expoConfig`) | ≠ (`expoConfig`) | Nuevo binario |
| B3 | Opción de plugin `expo-camera` (`recordAudioAndroid: true`) | ≠ | ≠ | Nuevo binario |
| B4 | Plugin nuevo `expo-font` | ≠ (+6 archivos del plugin) | ≠ (+6) | Nuevo binario |
| B5 | Opción de `expo-build-properties` (`useDayNightTheme: false`) | ≠ | ≠ | Nuevo binario |
| B7 | Línea añadida en `DeviceInsightsModule.kt` | ≠ (`modules/device-insights/android`) | = | Nuevo binario Android |
| B8 | Línea añadida en `DeviceInsightsModule.swift` | = | ≠ (`modules/device-insights/ios`) | Nuevo binario iOS |
| B9 | Quitar `expo-haptics` (dependencia nativa) de `package.json` | ≠ (`expoAutolinkingConfig:android` y `expo-haptics/android`) | ≠ (`expoAutolinkingConfig:ios` y `expo-haptics/ios`) | Nuevo binario |

Hashes por variante (Android / iOS), para reproducir:

| Id | Android | iOS |
|---|---|---|
| A4a `version` 1.0.1 | `94ba4047…` | `44ae5b19…` |
| A4b `android.versionCode` 2 | `9715a678…` | `e10aa1c5…` |
| A4c `ios.buildNumber` 2 | `d893fa41…` | `36238249…` |
| B1 | `a8196a08…` | `7a3e6a0a…` |
| B2 | `8ca9104e…` | `9f2e6b25…` |
| B3 | `5be28f22…` | `6e9f31eb…` |
| B4 | `ec103fcf…` | `e801747d…` |
| B5 | `6d85fedc…` | `349ae826…` |
| B7 | `17f21ee5…` | = base |
| B8 | = base | `d722c956…` |
| B9 | `4c6410c5…` | `9ca8e134…` |

### Hallazgos que matizan la regla (no la contradicen)

1. **`app.json` entra completo en ambas plataformas.** Un permiso solo de Android (B1) o una
   clave solo de `infoPlist` (B2) cambian **las dos** huellas. Es conservador: la
   herramienta no separa `android`/`ios` dentro de `expoConfig`. En cambio el código nativo
   local (B7, B8) sí es específico de cada plataforma.
2. **`version`, `android.versionCode` e `ios.buildNumber` SÍ cambian el hash** con las
   opciones por defecto (A4a-c), porque `DEFAULT_SOURCE_SKIPS` solo omite los `scripts` de
   `package.json` que no contienen `run`. Con `--source-skips 513`
   (`ExpoConfigVersions` 1 + el valor por defecto 512) subir las tres versiones **no**
   cambia la huella (Android `336fb053…`, iOS `dbb74fc3…`, antes y después). Un binario nuevo
   por subir `versionCode` no es una incompatibilidad nativa; conviene fijar una política
   (no decidida aquí, ver «Preguntas abiertas»).
3. **Falso negativo conocido: `locales/es.json` y `locales/en.json`.** Contienen los textos
   nativos de permisos (p. ej. `NSCameraUsageDescription`), que acaban en `InfoPlist.strings`
   dentro del binario. Cambiar uno (B6) deja el hash **igual** (Android `96c8994e…`, iOS
   `7ac6ef07…`): la huella no registra esos archivos y `@expo/fingerprint` 0.20.14 no ofrece
   un `extraSources` en su configuración. Regla práctica: tratar cualquier cambio en
   `locales/` como «nuevo binario» aunque la huella no lo avise.
4. **Solo texto de JS ≠ texto nativo.** Las cadenas i18n de `src/` (A1) viajan en el bundle
   JS y son candidatas a OTA; los textos de `locales/` y de `infoPlist` viven en el binario.

### Qué significa `runtimeVersion: { policy: "fingerprint" }` sin `expo-updates`

Comprobado en el código instalado y en el proyecto generado:

- `@expo/config-plugins` (`utils/Updates.js`): para la política `fingerprint` devuelve el
  valor centinela `file:fingerprint`; el comentario del código dice que la huella «es
  resoluble solo en tiempo de build (no en el config plugin)».
- `@expo/prebuild-config` aplica un plugin «sin versión» de actualizaciones cuando el
  paquete `expo-updates` no está, y ese plugin escribe ese centinela. En el proyecto
  generado (CNG) quedan: Android `expo.modules.updates.ENABLED=false`,
  `EXPO_RUNTIME_VERSION=@string/expo_runtime_version` y `strings.xml` con
  `file:fingerprint`; iOS `EXUpdatesEnabled=false` y `EXUpdatesRuntimeVersion=file:fingerprint`.
- `@expo/cli` (`resolveRuntimeVersionWithExpoUpdatesAsync`) llama al CLI de `expo-updates`
  para resolverla y, si el módulo no existe, devuelve `null`.
- `expo-updates` **no** está instalado (solo `expo-updates-interface`, dependencia de
  `expo-dev-client`); no hay en la app ningún cliente que lea esa clave ni consulte
  actualizaciones.

Conclusión: sin `expo-updates` la política es **metadato inerte** en el binario. Sirve
como declaración de intención y para que EAS Build/Update calculen el runtime con
`@expo/fingerprint`, pero la app **no puede recibir una OTA** hoy. La documentación oficial
(SDK 57) describe `runtimeVersion` como «propiedad que indica la compatibilidad entre el
código nativo de una build y una actualización OTA», y `updates` como «configuración de la
librería `expo-updates`». La página de políticas dice que `fingerprint` incrementa la
versión «cuando cambia algo que pueda afectar al runtime nativo». Las páginas consultadas
no dicen de forma explícita qué ocurre sin `expo-updates`; la respuesta anterior se apoya
en el código instalado.

**¿Hace falta `expo-updates` ahora?** No. RF-31 pide clasificar, comprobar la
configuración y la versión de compatibilidad y «no publicar una actualización remota»:
eso lo cubre `@expo/fingerprint` (ya instalado como dependencia de `expo`) sin ningún
paquete nuevo. `expo-updates` solo haría falta para **recibir** una OTA real, que está
fuera de alcance. Si algún día se instala: `npx expo install expo-updates` (versión
compatible `~57.0.26`), con aprobación previa (constitución, regla 1) y recompilación
del Development Build. No se instaló.

### Analogía Android / iOS

- **Android.** `versionCode` es el entero monótono que identifica el APK/AAB para Google
  Play; el manifest y las bibliotecas nativas (permisos, Kotlin, `.so`) quedan fijados en
  ese binario. Un cambio de permisos exige instalar otro APK/AAB (el sistema vuelve a
  pedirlos), igual que la huella cambia con B1, B3 y B7. Play Core (actualizaciones
  dentro de la app) sustituye el binario completo; una OTA de Expo solo sustituye el
  bundle JS y sus recursos dentro del mismo APK ya instalado.
- **iOS.** `CFBundleShortVersionString` y `CFBundleVersion` (build number) identifican el
  binario en App Store Connect/TestFlight; `Info.plist` (claves `NS…UsageDescription`) y
  los módulos Swift van dentro del `.ipa`. Un cambio de permiso o de módulo Swift pide
  otro binario (B2, B8); un bundle OTA solo reemplaza el JS que el mismo `.ipa` ya sabe
  ejecutar.
- La huella equivale a un «checksum de lo que compila Gradle/Xcode»: si coincide entre la
  build instalada y el bundle nuevo, el JS es compatible con ese nativo; si no coincide, el
  bundle podría llamar a código nativo que el binario no tiene. `versionCode`/build number
  son identidad de distribución en tiendas, no compatibilidad (aunque, con las opciones por
  defecto de esta versión, también alteran la huella; ver hallazgo 2).

### Preguntas abiertas para el usuario (no bloquean RF-31)

> **Estado 2026-10-15:** el usuario decidió NO resolverlas en el Día 5; pasan como seguimientos del Día 6 (ver «Cierre de T10 — 2026-10-15», «Seguimientos → Día 6»). No se instaló `expo-updates`.

1. ¿Se fija una política de versiones (`--source-skips 513` / `fingerprint.config.js`) para
   que subir `versionCode`/`buildNumber` no cuente como cambio nativo? Hoy no se cambió
   ninguna configuración.
2. ¿Se cubre el falso negativo de `locales/` (hallazgo 3) en el Día 6 o se acepta la regla
   práctica «cambio en `locales/` = binario nuevo»?
3. ¿Se aprueba `expo-updates` en una spec futura, solo si se quiere recibir una OTA real?

### Resumen de clasificación (tabla conservada)

| Cambio representativo | Android | iOS | Clasificación | Medido en |
|---|---|---|---|---|
| Lógica TypeScript o texto localizado en `src/`, sin API nativa nueva | OTA candidata | OTA candidata | Huella igual | A1, A2 |
| Recurso JS/imagen no referenciado por la config nativa | OTA candidata | OTA candidata | Huella igual | A3, A5 |
| Permiso o metadata de permiso | Nuevo binario | Nuevo binario | Huella distinta | B1, B2 |
| Plugin/config nativa (cámara, notificaciones, build properties) | Nuevo binario | Nuevo binario | Huella distinta | B3, B4, B5 |
| Dependencia nativa o módulo Expo local Kotlin/Swift | Nuevo binario | Nuevo binario | Huella distinta | B7, B8, B9 |
| Textos nativos de permisos en `locales/` | Nuevo binario (la huella NO lo detecta) | Nuevo binario (la huella NO lo detecta) | Falso negativo | B6 |
| Subir `version`/`versionCode`/`buildNumber` | Cambia la huella con opciones por defecto | Ídem | Política pendiente | A4a-c |

No se publicó una actualización OTA real, no hay canal de actualizaciones y esta evidencia
no equivale a una validación remota EAS (la validación remota se hizo después: ver «Cierre de T10 — 2026-10-15»).

## Plataformas y límites verificables

> **Sección histórica, superada por «Estado vigente» (arriba) y por «Revalidación Android física — 2026-10-13» y las secciones T2–T14.** No describe el estado actual; se conserva solo como registro fechado.
> Rótulo: «Android no pudo recompilarse» y «sin SDK/`adb`» ya NO son ciertos; Android se compiló y validó en el Samsung SM-A037M.

Esta tarea valida configuración y documentación, no repite la regresión de T1–T8.
El iOS Simulator estuvo disponible en incrementos anteriores; no acredita hardware
físico. Android no pudo recompilarse/validarse porque el entorno carece de
`ANDROID_HOME`/SDK y `adb`. No se inventa evidencia de cámara, hápticos o permisos
físicos Android.

## Regresión dirigida T10

> **Sección histórica, superada por «Estado vigente» (arriba) y por «Corrección 2 de T10» y «Cierre de T10 — 2026-10-15».** No describe el estado actual; se conserva solo como registro fechado.
> Rótulo: las cifras 58/58 y 900/900 son del checkpoint de 2026-10-13.

La regresión dirigida de las cinco capacidades pasó **58/58** con tests de DeviceInsights, scanner/EAN/deep links, notificaciones, compartir y feedback háptico. La regresión completa `npm run test:logic` pasó **900/900**.

| Capacidad | Evidencia real | Evidencia determinista/limitación |
|---|---|---|
| DeviceInsights | iOS Simulator recompilado e instalado con el módulo local | Contrato sync/async/evento/error: tests; Android físico no disponible |
| Escáner | iOS Simulator valida build, preview y estados sin hardware | EAN, permiso, errores, retry/cancel y callbacks tardíos: tests; no lectura física |
| Notificaciones | iOS Simulator disponible para la capacidad local soportada | Android con/sin diálogo: clasificador inyectable; Android real no validado |
| Compartir | iOS Simulator ejecuta el binario | success/cancel/ausente: tests; Taptic Engine no aplica |
| Deep links | `simctl openurl` activo probado en T6–T8; build iOS recompilado | inválido/404/desconocido/deduplicación: tests; Android no disponible |

Se revisaron roles, labels, headers, live regions, disabled/busy, targets táctiles, traducciones, tema claro/oscuro, estados loading/error/offline/not-found, texto ampliado y reduced motion en las superficies nuevas. Empty no aplica a DeviceInsights ni scanner. No se atribuye cámara, háptico ni permiso físico al Simulator.

## Resultado T10

> **Sección histórica, superada por «Estado vigente» (arriba) y por «Cierre de T10 — 2026-10-15».** No describe el estado actual; se conserva solo como registro fechado.
> Rótulo: «Android sin SDK/`adb`», 900/900 y «T10 parcial» describen el 2026-10-13.

La configuración local, el inventario y la matriz quedan registrados. Resultados de este
checkpoint: `npm run test:logic` **900/900**, `npx expo lint` **OK**, `npx tsc --noEmit`
**OK**, `npx expo install --check` **Dependencies are up to date** y
`npx expo-doctor@latest` **21/21 checks passed**. `npx expo config --json` y la
comprobación estructural de perfiles/ids/runtime también fueron satisfactorias.
`npx expo run:ios --device "iPhone 17 Pro"` terminó con **Build Succeeded**, instaló y abrió `com.herbstore.mobile`; quedó un warning de Xcode sobre un script ambiguo, sin errores. Android sigue sin SDK/`ANDROID_HOME`/`ANDROID_SDK_ROOT` ni `adb`, por lo que no se compiló ni validó dispositivo físico.

Se intentó EAS remoto: `npx eas-cli@latest config` pidió perfil sin stdin y `npx eas-cli@latest build --profile development --platform all --non-interactive` terminó con `An Expo user account is required`. No existe evidencia remota. T10 queda **parcial y sin marcar**; RF-28/RF-36 y la matriz Android física permanecen pendientes. No se crea commit de cierre.

## Revalidación Android física — 2026-10-13

Se comprobó el entorno con el Samsung conectado:

```text
ANDROID_HOME=$HOME/Library/Android/sdk
ANDROID_SDK_ROOT=$HOME/Library/Android/sdk
adb devices -l
 <serial anonimizado>  device  model:SM_A037M  android 13
```

El shell no tenía esas variables ni `adb` en `PATH`; se usaron temporalmente el SDK
local, `platform-tools` y Java 21, sin modificar configuración del repositorio. La
recompilación sí concluyó:

```text
npx expo run:android --no-bundler --no-install
BUILD SUCCESSFUL in 43s
Installed app-debug.apk and opened com.herbstore.mobile on SM-A037M
```

La primera apertura sin `EXPO_PUBLIC_API_ORIGIN` mostró el diagnóstico de configuración
esperado y no montó el catálogo. Con Metro reiniciado con
`EXPO_PUBLIC_API_ORIGIN=http://localhost:3001`, `adb reverse tcp:8081 tcp:8081` y
`adb reverse tcp:3001 tcp:3001`, Inicio cargó y el mock respondió `GET /home -> ok`.

### Observaciones realmente comprobadas

- **Preview/reapertura del scanner:** al tocar el acceso QR se mostró «Escáner de
  productos» con «Continuar» y «Cerrar» antes de cámara/permiso. La pantalla se abrió
  de nuevo tras cerrar y volvió a mostrar la confirmación.
- **Permiso/capacidad no disponible:** tras confirmar, el dispositivo mostró «La cámara
  no está disponible», «Abrir ajustes» y «Cancelar». No se inventa una lectura EAN: en
  esta sesión el flujo no llegó a «Listo para escanear» ni a `CameraView` usable.
- **Corrección posterior del reviewer:** el estado no disponible también ofrece «Buscar
  productos» localizado; cancela el intento del escáner y reemplaza la ruta modal por la
  ruta existente `/search`, evitando dejar una instancia bloqueada.
- **Accesibilidad visible:** los estados anteriores expusieron texto explicativo y
  botones localizados; la captura Android confirmó targets táctiles amplios. Tema claro
  y texto ampliado/reduced motion no se reejecutaron en esta sesión; permanecen cubiertos
  por la evidencia previa/determinista, no como nueva observación física.
- **Deep links, cámara usable, EAN válido/inválido, errores/retry/cancel/rearme,
  háptico físico, compartir y notificaciones Android (diálogo, tap, dedupe/restart):**
  no se registran como comprobados en esta revalidación porque el dev server terminó
  durante la sesión y el permiso/capacidad de cámara quedó en `unavailable`.

Se volvió a intentar `CI=1 npx eas-cli@latest whoami`; no había sesión/cuenta usable,
por lo que RF-28/RF-36 siguen pendientes. La matriz Android queda mejorada con build,
conexión, diagnóstico, carga de Home, preview y estado de permiso/cámara, pero no
completa. T10 permanece sin marcar.

## Corrección de cámara Android — segunda vuelta, 2026-10-13 (superada)

Se confirmó que `CameraView.isAvailableAsync()` de `expo-camera` 57.0.6 lanza
`UnavailabilityError` cuando el manager nativo Android no expone ese método. El fallo
ocurría antes de montar `CameraView`, aunque el permiso y Camera2 fueran utilizables.
Esta segunda vuelta omitió el prechequeo solo en Android y conservó una suposición
incorrecta para iOS. La documentación y la fuente instalada de 57.0.6 marcan
`isAvailableAsync()` como **solo web**; la tercera vuelta siguiente sustituye por
completo esta corrección parcial.

### TDD y comprobaciones estáticas

- Rojo esperado: los tests dirigidos fallaron con `ERR_MODULE_NOT_FOUND` para
  `camera-access.ts` y por no existir `shouldMountScannerCamera`; después, la validación
  cruzada añadió un rojo por no existir el selector de preflight por plataforma.
- Verde dirigido: 15/15 casos de acceso, plataforma, máquina y estado visual. Cubren permiso ya
  concedido sin otra solicitud, solicitud solo con `canAskAgain`, denegación no
  resoluble, transición `permissionGranted → ready`, montaje solo en `ready|querying`
  con foco y `onMountError → unavailable`.
- `npm run test:logic`: **907/907**; `npx expo lint`: **OK**;
  `npx tsc --noEmit`: **OK**.

### Android físico SM-A037M, Android 13

Con `ANDROID_HOME`/`ANDROID_SDK_ROOT`, `platform-tools`, Java 21 y
`EXPO_PUBLIC_API_ORIGIN=http://localhost:3001` configurados solo para el proceso:

```text
npx expo run:android --device SM_A037M --no-bundler
BUILD SUCCESSFUL in 3s
Installed app-debug.apk and opened com.herbstore.mobile
```

Se ejecutaron Metro Development Client y el mock, con reversas USB para 8081/3001.
Resultados observados, sin inferir capacidades no vistas:

- Con `CAMERA granted=true`, Continuar cambió a **«Listo para escanear»**, montó una
  preview trasera con imagen real y dejó `CameraView` activo. Logcat registró
  `CameraGraph-1 state ... GRAPH_STARTED`, estado interno `OPEN`, primer frame y
  `CAMERA_STATE_ACTIVE` para HerbStore. No apareció `UnavailabilityError`,
  `SecurityException` ni FATAL.
- Tras revocar el permiso, el diálogo normal Android apareció. La primera denegación
  terminó en `unavailable`; la segunda mostró «No permitir» no preguntable y dejó el
  permiso con `USER_FIXED`. Una reapertura ya no mostró diálogo y volvió directamente
  al mismo estado no disponible.
- En `unavailable` se observaron los tres fallbacks: **Buscar productos**, **Abrir
  ajustes** y **Cancelar**. Cancelar volvió a Inicio; Buscar productos reemplazó el
  modal por la pantalla Búsqueda; Abrir ajustes abrió la configuración de la app.
- Con la app en Ajustes se restauró el permiso mediante el harness `adb`; al volver a
  primer plano la instancia pasó de `unavailable` a **«Listo para escanear»**, remontó
  la preview y Camera2 volvió a `CAMERA_STATE_ACTIVE`. Esto verifica la reevaluación de
  RF-12 sin reiniciar la aplicación.
- No se provocó un fallo real de inicialización sin interferir artificialmente con otra
  app; la convergencia `onMountError → unavailable` queda comprobada de forma
  determinista por el reducer y el montaje se comprobó realmente en el dispositivo.
- No fue posible presentar físicamente un patrón EAN a la cámara desde esta sesión
  remota. Por tanto, **no** se acreditan aquí lectura válida/inválida, consulta, errores
  de red, retry ni rearme derivados de lectura. Esos contratos siguen en tests, pero no
  se presentan como evidencia física. El cancel de `unavailable` sí fue real.

### iOS Simulator, iPhone 17 Pro (resultado histórico superado)

Con el Development Build ya instalado y el bundle servido por Metro, esa sesión observó
`unavailable`, pero atribuirlo a un preflight iOS soportado fue incorrecto. La evidencia
vigente es la de la tercera vuelta: iOS nativo tampoco invoca esa API web-only.

RF-11 y RF-12 quedan corregidos y comprobados en Android para permiso, montaje,
preview, lifecycle y fallbacks. La parte óptica/consulta de RF-13–RF-19 y EAS remoto
RF-28/RF-36 siguen pendientes; T10 permanece sin marcar y no se crea commit.

## Corrección reviewer — tercera vuelta, 2026-10-13

### TDD rojo y diseño final

Antes de cambiar implementación se añadieron casos para el contrato real de SDK 57,
`permissionGranted → mounting-camera → cameraReady → ready`, revocación
`ready → unavailable`, revocación `querying → unavailable`, descarte del resultado
tardío y recuperación `unavailable → mounting-camera → ready`. La prueba dirigida quedó
en rojo con **5 fallos por las causas esperadas**: iOS todavía ejecutaba preflight, el
permiso saltaba directamente a `ready`, `ready/querying` ignoraban la revocación y la
cámara no se montaba durante inicialización.

La implementación final separa la capacidad por resolución de plataforma:
`native/camera-availability.ts` no importa ni llama `CameraView.isAvailableAsync()` y
permite montar; solo `.web.ts` conserva el preflight web. Android/iOS pasan a
`mounting-camera` al concederse permiso y solo `onCameraReady` publica «Listo para
escanear»; `onMountError` converge en `unavailable`. Al salir de foreground se desmonta
la cámara. Al volver, se consulta de nuevo permiso antes de remontar; una denegación
aborta la lazy query RTK activa, borra su referencia, incrementa el epoch y los callbacks
comprueban identidad antes de despachar, por lo que un resultado tardío no actúa.

### Comandos repetidos

- Scanner + linking dirigidos: **38/38**.
- `npm run test:logic`: **909/909**.
- `npx expo lint`: **OK**.
- `npx tsc --noEmit`: **OK**.
- `npx expo install --check`: **Dependencies are up to date**.
- `npx expo-doctor@latest`: **21/21 checks passed**.
- Android con SDK local, Microsoft OpenJDK 21 y Samsung conectado:
  `npx expo run:android --device SM_A037M --no-bundler` → **BUILD SUCCESSFUL in 3s**,
  APK instalado y abierto.
- iOS: `npx expo run:ios --device "iPhone 17 Pro" --no-bundler` →
  **Build Succeeded**, app instalada y abierta; se conserva un warning no bloqueante del
  script de Expo Dev Launcher.
- `CI=1 npx eas-cli@latest whoami` → **Not logged in**. RF-28/RF-36 siguen pendientes.

No cambiaron dependencias ni configuración en esta corrección; install-check y Doctor se
repitieron por regresión, y el mismo Development Build cargó el bundle final.

### Android físico — Samsung SM-A037M, Android 13

- Tras borrar datos para obtener un prompt limpio, se observó preview y confirmación
  antes de cualquier permiso. El diálogo normal mostró las opciones del sistema; «No
  permitir» llevó a `unavailable`. En la reapertura, conceder «Mientras la app está en
  uso» montó la cámara y solo después de `onCameraReady` apareció «Listo para escanear».
- Logcat acreditó `GRAPH_STARTED` y `CAMERA_STATE_ACTIVE` para
  `com.herbstore.mobile`; no apareció `UnavailabilityError`.
- Con permiso no resoluble se observaron **Buscar productos**, **Abrir ajustes** y
  **Cancelar**. Buscar abrió Búsqueda, Ajustes abrió la ficha de la app y Cancelar volvió
  al origen.
- Desde `unavailable`, conceder permiso mientras la app estaba en Ajustes y volver a
  foreground recuperó `ready` y `CAMERA_STATE_ACTIVE` sin reinstalar.
- La revocación runtime con `pm revoke` reinició el proceso por decisión del SO, de modo
  que no conserva una instancia `ready` para observar manualmente esa transición. Se
  intentó `appops CAMERA ignore` sin matar el proceso: CameraX registró
  `ERROR_CAMERA_DISABLED`, pero expo-camera no emitió `onMountError` y el permiso seguía
  reportado como concedido; no se presenta como fallback válido. Las transiciones
  `ready/querying → unavailable`, el abort y el resultado tardío quedan acreditados por
  tests deterministas, no como observación física.
- No había un patrón EAN físico presentable. No se acreditan lectura válida/inválida,
  consulta, retry, navegación ni `querying → unavailable` real.

### iOS Simulator — iPhone 17 Pro

- Preview y confirmación se observaron antes de permiso/cámara. Con permiso concedido,
  el Simulator emitió `onCameraReady` y la UI mostró «Listo para escanear»; esto valida
  la señal y el flujo, **no** cámara óptica física ni lectura.
- `simctl privacy revoke camera` reinició el proceso (PID cambió). Al reabrir y confirmar,
  se mostró `unavailable` con Buscar, Ajustes y Cancelar. Buscar abrió Búsqueda, Ajustes
  abrió configuración y Cancelar desde un deep link de scanner devolvió a Búsqueda.
- `simctl privacy grant camera` también reinició el proceso; una apertura nueva volvió a
  preview y después a `ready`. Por ese reinicio del SO, no se atribuye al Simulator una
  transición preservada `ready → unavailable` ni recuperación de la misma instancia.
- No se reprodujo `onMountError`, no existe cámara física/EAN y no se inventan flujos
  derivados.

### Pendientes exactos

T10 continúa sin marcar y no se crea commit. Siguen pendientes un patrón EAN físico para
RF-13–RF-19 (válido, inválido, consulta, errores, retry, navegación/rearme y cancelación
durante intento real), una observación nativa de revocación sin reinicio si el SO la
permite, un `onMountError` real reproducible y la validación remota EAS de RF-28/RF-36.

## Segunda y última vuelta del nuevo ciclo — 2026-10-14

Esta vuelta corrige exclusivamente los siete hallazgos enumerados por el reviewer. No
cierra T10 ni sustituye la evidencia bilateral que aún falta en T2, T3, T6, T7 y T8.

### Rojo registrado

Primero se añadieron los casos de barrera síncrona del scanner, scheduling concurrente,
cleanup/retry, respuesta fría/activa/duplicada, copia localizada de la vista nativa y
estado observable de notificación. La ejecución dirigida quedó en rojo con **5 archivos
fallidos** por las causas esperadas: cuatro módulos aún no existían y
`order-notification-state.ts` no exportaba las transiciones nuevas. Tras la primera
recompilación, la validación iOS descubrió otro rojo real:
`Event cannot be both direct and bubbling: topPress`; el evento propio de la vista se
llamaba `onPress` y colisionaba con el evento RN. Se renombró de forma equivalente a
`onNativePress` en TypeScript/Kotlin/Swift y se recompilaron ambas plataformas.

### Correcciones por hallazgo

1. **RF-15:** `createScannerReadBarrier` asigna identidad a cada rearmado y consume esa
   identidad de forma síncrona en el primer callback. Dos callbacks consecutivos que ven
   el mismo render `ready` ya no pueden iniciar dos consultas; una lectura inválida
   también consume el intento. Solo `cameraReady`, rearmado explícito y regreso enfocado
   del detalle vuelven a habilitar una lectura; cancelación, error de cámara y desmontaje
   bloquean la barrera. Se conservan abort y epoch existentes.
2. **RF-8/RF-9/RF-32:** Kotlin y Swift ya no contienen `Actualizar información`,
   `actualizando`, `Actualizando` ni `Disponible`. JS entrega label, fallback y estados
   available/unavailable/refreshing localizados. Quitar `accessible` del contenedor Expo
   dejó que el botón UIKit expusiera rol y `accessibilityValue`; Android expone el estado
   en `contentDescription`. El evento propio se llama `onNativePress` en ambas plataformas.
3. **RF-25:** un coordinador in-flight por order id comparte una sola Promise entre
   efectos concurrentes y limpia el mapa en éxito o fallo. Una respuesta idempotente que
   ya existía antes de `orderRecorded` no reintenta sola; el retry posterior debe ser la
   acción explícita.
4. **RF-23/RF-25:** el historial persistible expone `idle|scheduling|unusable|failed|scheduled`
   y `canOpenSettings`; scheduling se restaura como `idle` para no quedar bloqueado tras
   una caída. La confirmación muestra un mensaje distinto para permiso no utilizable y
   fallo, ofrece Ajustes cuando corresponde y despacha retry sin volver a pedir el permiso
   que ya quedó registrado.
5. **RF-24:** la respuesta inicial y la suscripción activa pasan por un deduplicador
   acotado por `notification.request.identifier`; el payload continúa cerrado a
   `{ destination: 'home' }`, se limpia la respuesta nativa consumida y el cleanup impide
   navegación tras desmontaje.
6. **RNF-3:** «Abrir ajustes» del scanner usa `scanner.openSettingsHint`, distinto de la
   pista de Cerrar, con claves ES/EN y paridad comprobada.
7. **Estado:** `LEARNING.md` registra 919/919 y builds actuales sin presentarlos como
   cierre. T2, T3, T6, T7 y T8 se desmarcaron por evidencia bilateral incompleta; T10
   continúa sin marcar.

### Comandos y resultados finales

- Tests dirigidos nuevos + paridad: **15/15**.
- `npm run test:logic`: **919/919**.
- `npx expo lint`: **OK**, sin warnings.
- `npx tsc --noEmit`: **OK**.
- `npx expo install --check`: **Dependencies are up to date**.
- `npx expo-doctor@latest`: **21/21 checks passed**.
- `git diff --check`: sin salida.
- Búsqueda de los cuatro literales fijados en las fuentes nativas DeviceInsights: sin
  coincidencias.
- Android físico SM-A037M: recompilación final después de Kotlin → **BUILD SUCCESSFUL in
  5s**, APK instalado y abierto.
- iOS Simulator iPhone 17 Pro: recompilación final después de Swift → **Build Succeeded**,
  app instalada y abierta; persiste el warning no bloqueante del script de Expo Dev
  Launcher.

### Validación bilateral alcanzada

- **Android físico:** DeviceInsights mostró plataforma Android y el botón nativo con
  bounds de 596×90 px en el árbol, con descripción «Actualizar información, Disponible».
  Al activarlo apareció una sola vez «Interacción nativa recibida: android.».
- **iOS Simulator:** DeviceInsights mostró plataforma iOS. En español, el botón UIKit de
  336×48 pt expuso rol botón, label «Actualizar información», value «Disponible» y una
  activación produjo «Interacción nativa recibida: ios.». Después de cambiar el idioma
  activo, el mismo control expuso «Refresh information» y value «Available».
- **Scanner:** los dobles callbacks se validaron determinísticamente en el mismo turno JS
  (primero válido, y secuencia inválido→válido) sin un segundo claim/consulta. No se usó
  ni se inventa un EAN físico.
- **Notificaciones:** concurrencia, cleanup, retry sin nuevo permiso, resultados
  `unusable`/`failed`, payload cerrado y dedupe frío/activo/remontaje quedaron cubiertos
  por lógica determinista. Android reportó para el paquete importancia de notificaciones
  `NONE`, pero esta sesión no creó una orden confirmada desde la app; tampoco se generó
  una orden/notificación en iOS Simulator. Por ello no se acredita scheduling/tap real ni
  se marca T8.

### Pendientes ambientales y de evidencia

Permanecen el patrón EAN físico y los flujos ópticos derivados, scheduling/tap/reinicio
real de notificaciones en Android e iOS, las validaciones bilaterales de deep links y
compartir que exigen sus propios «Hecho cuando», háptico físico, y EAS remoto sin sesión.
No se ejecutó EAS remoto, no se validaron shares/deep links nuevos y no se creó commit.

## Cierre específico de T2 — 2026-10-14

Esta vuelta valida exclusivamente el contrato síncrono/asíncrono y la fachada de
DeviceInsights (RF-1–RF-7, RNF-1 y RNF-2). No corrige `accentColor`, no amplía la
validación de la vista/evento de T3 y no avanza otra tarea.

### Contrato determinista y protección de datos

Se ejecutó:

```text
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test \
  src/core/native/device-insights-contract.test.ts \
  src/core/native/device-insights.test.ts \
  src/core/native/device-insights-view-copy.test.ts
```

Resultado: **16/16**. Los casos acreditan las plataformas cerradas `android|ios`, el
payload válido y su proyección a solo `platform`, `model`, `systemVersion` e
`isPhysical`, rechazo de payload malformado/modelo vacío, timestamp ISO 8601 canónico
en UTC, error controlado `invalid-response|native-failure` con retry, y coordinación
de concurrencia. En la prueba concurrente dos llamadas a la fachada dejan exactamente
**una** invocación nativa; la segunda devuelve `ignored`. Los fixtures incluyen campos
sensibles ficticios (`serialNumber`, `identifierForVendor`, `deviceId`) y comprueban que
no atraviesan la frontera pública.

Además, la búsqueda estática en las fuentes productivas Kotlin, Swift, TypeScript y la
pantalla no encontró lecturas de serial, IDFV, Android ID, device id ni identificador
único. Los únicos datos nativos publicados son los cuatro campos del contrato y el
timestamp del evento. La fachada transforma rechazos nativos y respuestas inválidas en
un resultado discriminado; la pantalla ya presenta ambos códigos como mensajes
localizados, sin propagar detalles de la excepción. No se añadió un fault injector al
binario solo para la prueba.

### Android físico — Samsung SM-A037M, Android 13

- Entorno usado solo para los comandos: Android SDK local en
  `$HOME/Library/Android/sdk`, `platform-tools` en `PATH` y Microsoft OpenJDK 21.0.11.
  `adb devices -l` mostró el Samsung conectado; `ro.kernel.qemu=0` confirmó dispositivo
  físico.
- Antes de actualizar, el panel mostró el valor síncrono **«Plataforma: Android»**.
- Tras solicitar la actualización asíncrona, mostró **«Actualización completada:
  SM-A037M, sistema 13, dispositivo físico.»**. Coincide con `getprop` (`SM-A037M`,
  Android `13`) y el indicador físico es coherente.
- El evento observable quedó en **«Android · SM-A037M · 13 · dispositivo físico»** con
  timestamp `2026-10-14T16:25:33.183Z`, forma UTC canónica aceptada por la frontera.
- Se enviaron dos taps prácticamente simultáneos al control de refresh. La pantalla no
  quedó bloqueada ni mostró un segundo estado; la afirmación fuerte de operación única
  procede del test de coordinador que cuenta una sola llamada nativa, no de inferirla a
  partir del último texto visible.
- El árbol de UI resultante no expuso ids del dispositivo. El APK instalado contiene
  las clases DEX `expo.modules.deviceinsights.DeviceInsightsModule` y
  `DeviceInsightsView`; la ejecución del sync/async confirma además el módulo cargado
  dentro del Development Build.

### iOS Simulator — iPhone 17 Pro, iOS 26.5

- Antes de actualizar, el árbol de accesibilidad mostró **«Valor síncrono, Plataforma:
  iOS»**.
- Tras la actualización asíncrona mostró **«Actualización completada: iPhone, sistema
  26.5, simulador.»**. El modelo no está vacío, la versión coincide con el runtime
  arrancado y `isPhysical=false` es coherente con `targetEnvironment(simulator)`.
- El evento observable quedó en **«iOS · iPhone · 26.5 · simulador»** con timestamp
  `2026-10-14T16:25:33.177Z`, forma UTC canónica.
- Dos activaciones prácticamente simultáneas no bloquearon la UI; como en Android, la
  no duplicación de la operación se acredita por el conteo determinista del test, no por
  una capacidad física del Simulator.
- La app instalada ejecutó `getPlatform` y `getInsightsAsync`; la integración CocoaPods
  contiene `DeviceInsightsModule.swift` en el target `DeviceInsights`. Esto acredita el
  módulo dentro del Development Build sin atribuir cámara ni Taptic Engine al Simulator.

No se recompiló en esta vuelta porque no cambió código, dependencia ni configuración:
se reutilizaron los Development Builds finales ya recompilados el 2026-10-14 y
registrados arriba (**BUILD SUCCESSFUL** Android y **Build Succeeded** iOS). La ejecución
nativa actual en ambos confirma que esos binarios incluyen el módulo.

### Regresión del checkpoint

- Dirigidos DeviceInsights: **16/16**.
- `npm run test:logic`: **919/919**.
- `npx expo lint`: **OK**, sin salida.
- `npx tsc --noEmit`: **OK**, sin salida.
- `git diff --check`: sin salida.

Con contrato equivalente y datos coherentes observados en ambas plataformas, pruebas de
payload/error/concurrencia en verde, ausencia de ids sensibles y módulo presente en los
dos Development Builds, **T2 queda completada**. T3 y las demás tareas pendientes no se
marcan.

## Cierre específico de T3 — 2026-10-14

Esta vuelta cubre exclusivamente el evento, la vista accesible y el panel didáctico de
DeviceInsights (RF-4, RF-6–RF-9, RF-32–RF-34 y RNF-2–RNF-4). T6/T7/T8/T10 no se
ejecutaron ni se marcaron.

### TDD y corrección del color

Antes de cambiar producción se añadieron pruebas de resolución y propagación del color.
El primer rojo dirigido terminó con **4 fallos**: no existía el resolver de token/color,
la pantalla seguía pasando `colors.primary` para todo estado y los dos `accentColor`
nativos eran callbacks vacíos. El segundo rojo, provocado por la validación con texto
máximo, terminó con **3 fallos**: no existía el alto adaptativo, la pantalla conservaba
48 fijos y Android no permitía salto de línea.

La solución conserva el contrato cerrado `primary|success|warning|error`, pero resuelve
el token a la paleta activa en JS. Kotlin y Swift reciben y aplican ese `#RRGGBB`; no
mantienen paletas semánticas paralelas. Ambos aceptan solo seis dígitos hexadecimales con
conversión opcional (`toLongOrNull`/`UInt64`); un valor inválido usa el acento del tema
Android o `systemBlue` de UIKit, sin copia fija de idioma. La validación de fuente impide
regresar a un prop no-op o a `Color.parseColor`.

La primera comprobación con texto máximo reveló un defecto real: Android mantenía la
etiqueta en una línea e iOS dejaba el título fuera de 48 pt. Se corrigió dentro de RNF-3:
el alto mínimo escala desde 48 con `fontScale`, Android permite wrap sin mayúsculas
forzadas e iOS usa word wrapping. La segunda observación mostró el texto completo.

### Contrato, evento y estados deterministas

- Dirigidos DeviceInsights finales: **26/26**. Incluyen cuatro tokens y sus colores,
  fallback de token/color inválido, alto según font scale, payload/ISO UTC, error
  controlado, una sola llamada ante concurrencia y press/propagación bilateral.
- Cleanup/remount está probado contra un emisor nativo que conserva deliberadamente el
  callback viejo: tras `remove()` el evento tardío se descarta, una segunda llamada a
  cleanup es idempotente y el remontaje entrega exactamente un evento nuevo.
- El panel mostró valor sync, estado async, resultado, evento UTC, error localizado por
  contrato y vista. No se añadió un inyector de fallos al binario; error y retry quedan
  cubiertos por fachada/pantalla y tests. Empty y offline no aplican al panel local.
- Un refresh real produjo un solo resumen por plataforma. El press final produjo una
  sola cadena de estado en cada pantalla; iOS expone el mismo texto en nodo padre/hijo
  del árbol AX, no dos eventos.

### Android físico — Samsung SM-A037M, Android 13

- Panel completo abierto desde Cuenta; sync `Android`, async `SM-A037M`/13/físico y
  evento UTC observados. La vista expuso `android.widget.Button`, label+estado
  `Actualizar información, Disponible`, `enabled=true`, `focusable=true` y 596×90 px
  a escala normal (mínimo 48 dp). Un press mostró una sola vez «Interacción nativa
  recibida: android.».
- Español e inglés se comprobaron mediante locale de app; en inglés la misma vista
  expuso `Refresh information, Available`, sin mezclar idiomas.
- Tema claro y oscuro se observaron. Tras éxito, oscuro cambió la vista a la paleta JS
  clara y texto negro en vez de conservar el verde fijo nativo. Los cuatro fondos y el
  foreground blanco/negro elegido por luminancia dan contraste calculado entre **5.04:1
  y 13.13:1**.
- Con `font_scale=2.0`, la etiqueta completa quedó visible y el objetivo conservó más de
  48 dp. Con animaciones del sistema a cero no apareció movimiento ni se perdió estado:
  esta pantalla no implementa animación no esencial. Con teclado/D-pad el botón nativo
  alcanzó `focused=true` y mostró contorno de foco visible.
- Los ajustes temporales se revirtieron: font scale 1, animaciones 1, tema claro y locale
  de app vacío.

### iOS Simulator — iPhone 17 Pro, iOS 26.5

- Panel completo abierto desde Cuenta; sync `iOS`, async `iPhone`/26.5/simulador y
  evento UTC observados, sin atribuir hardware físico. La vista UIKit expuso rol button,
  label, value `Disponible`/`Available`, enabled y 336×48 pt a escala normal. Un press
  mostró «Interacción nativa recibida: ios.».
- Español e inglés se comprobaron reiniciando el proceso con el idioma de app; la vista
  cambió entre `Actualizar información` y `Refresh information`, con estado localizado.
- Claro/oscuro se observaron; en oscuro el fondo cambió con el token JS igual que en
  Android y el foreground pasó a negro. El cálculo WCAG AA es el mismo de la paleta.
- Con tamaño `accessibility-extra-extra-extra-large`, el target creció a **336×172 pt**,
  la etiqueta hizo wrap completo y siguió siendo botón accionable. Reduced Motion se
  activó y el panel permaneció estático, sin depender de animación. `UIButton(type:
  .system)` conserva el indicador de foco administrado por UIKit; el árbol AX confirmó
  el elemento enfocable y no se sustituyó por un contenedor que ocultase su semántica.
- Se restauraron apariencia clara, tamaño `large`, idioma del sistema y movimiento/foco
  de teclado predeterminados.

### Comandos finales

- `npm run test:logic`: **929/929**.
- `npx expo lint`: **OK**, sin salida.
- `npx tsc --noEmit`: **OK**, sin salida.
- `git diff --check`: sin salida.
- Android final después de Kotlin: `npx expo run:android --device SM_A037M
  --no-bundler` → **BUILD SUCCESSFUL in 5s**, APK instalado y abierto.
- iOS final después de Swift: `npx expo run:ios --device "iPhone 17 Pro"
  --no-bundler` → **Build Succeeded**, app instalada y abierta; único warning conocido
  del script de Expo Dev Launcher.

No cambiaron dependencias ni app config, por lo que install-check y Doctor no eran
aplicables a T3. Con evento/cleanup, vista/press, localización, contraste, targets, texto,
tema y reduced motion comprobados bilateralmente, **T3 queda completada**. Las tareas
T6/T7/T8/T10 continúan sin marcar.

## Validación parcial específica de T6 — 2026-10-14

Esta vuelta se limitó al stack scanner→detalle y a deep links (RF-13, RF-17–RF-21,
RF-32–RF-34, RNF-2 y RNF-3). No se añadió una entrada para simular lecturas ni se cambió
código, configuración o dependencias. Los Development Builds ya instalados se conectaron
a Metro solo como preparación; las URLs que cuentan como evidencia activa se entregaron
después mediante el esquema `herbstore` y herramientas nativas.

### Contratos deterministas repetidos

```text
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test \
  src/core/navigation/linking.test.ts \
  src/features/scanner/logic/ean13.test.ts \
  src/features/scanner/logic/scanner-machine.test.ts \
  src/features/scanner/logic/scanner-navigation.test.ts \
  src/features/scanner/logic/scanner-read-barrier.test.ts \
  src/features/scanner/logic/scanner-view-state.test.ts \
  src/features/scanner/logic/camera-access.test.ts
```

Resultado: **41/41**. La selección incluye EAN exacto/checksum, preview y permiso,
`ready`, una sola lectura, barrera síncrona por rearmado, epoch, descarte tardío, errores
network/timeout/5xx/datos/404, retry, cancel, fallo/retry de navegación, rearmado y montaje
de cámara. Linking cubre producto válido, id malformado, id válido posiblemente
inexistente, ruta desconocida, scanner, formas de URL y rechazo del launcher.

La regresión completa terminó **929/929**; `npx expo lint`, `npx tsc --noEmit` y
`git diff --check` terminaron sin salida ni errores. No se recompiló porque no cambió
código, configuración ni dependencias.

### Android físico — Samsung SM-A037M, Android 13

Con la app activa se enviaron intents explícitos a
`com.herbstore.mobile/.MainActivity`, no a la URL `exp+herbstore` del launcher:

| Caso activo | Observación | Salida/no duplicación |
|---|---|---|
| `product/product-261009-001` | Un único detalle «Complete Daily Powder» | Dos intents consecutivos conservaron un detalle; un solo Back volvió a Inicio |
| id malformado | «Producto inválido» y explicación específica | «Volver»/«Ir a Inicio» visibles; «Ir a Inicio» llegó a Inicio |
| `product-261009-999` | «Producto no encontrado» tras 404 | «Volver»/«Ir a Inicio» visibles; «Ir a Inicio» llegó a Inicio |
| ruta desconocida | «Enlace no reconocido» | «Volver»/«Ir a Inicio» visibles; «Ir a Inicio» llegó a Inicio |
| `scanner` | Preview con «Continuar»/«Cerrar», sin `ready` antes del toque | Confirmar llegó a «Listo para escanear»; Back volvió al origen y reabrir empezó otra vez en preview |

Logcat registró para estos casos `initial=false -> redirected` sin escribir las URLs. El
botón «Cancelar» estaba presente en el árbol tras confirmar, pero en este dump Android
reportó bounds 0×0; no se atribuye un tap físico a ese control: la salida comprobada fue
Back, y «Cerrar» sí se accionó desde el preview.

Se intentaron también los cinco casos tras `am force-stop`, usando el componente explícito.
Todos devolvieron `LaunchState: COLD`, pero la actividad final fue
`expo.modules.devlauncher.launcher.DevLauncherActivity` y la pantalla mostró
«Development Build»/«DEVELOPMENT SERVERS», no el destino solicitado. Por tanto esta
ejecución **no** cuenta como matriz fría: el único APK instalado y el único artefacto en
`android/app/build/outputs` eran de debug con Dev Launcher. No se generó otro binario,
conforme a la instrucción de recompilar solo si cambiaba código.

### iOS Simulator — iPhone 17 Pro, iOS 26.5

Con el proceso activo, `xcrun simctl openurl` entregó directamente el esquema de la app:

| Caso activo | Observación | Salida/no duplicación |
|---|---|---|
| `product/product-261009-001` | Un único detalle «Complete Daily Powder» | Dos aperturas conservaron un detalle; un solo Back nativo volvió a Inicio |
| id malformado | «Producto inválido» y explicación específica | «Ir a Inicio» volvió a Inicio |
| `product-261009-999` | «Producto no encontrado» | «Ir a Inicio» volvió a Inicio |
| ruta desconocida | «Enlace no reconocido» | «Ir a Inicio» volvió a Inicio |
| `scanner` | Preview con «Continuar»/«Cerrar», sin `ready` previo | Confirmar llegó a «Listo para escanear»; «Cancelar» volvió al origen y la reapertura volvió a preview |

No se atribuye cámara óptica al Simulator. Para la matriz fría se repitió, para cada una
de las cinco URLs, `simctl terminate` seguido de `simctl openurl`. Las cinco capturas
fueron byte a byte iguales (mismo SHA-256) y mostraron la pantalla **Development Build**
con servidores recientes; ninguna expuso nodos AX del producto, error, ruta desconocida
o scanner. El único `.app` disponible estaba en `Debug-iphonesimulator`, por lo que estos
intentos quedan rotulados como interceptados por Dev Launcher y no como evidencia fría.

### Cobertura alcanzada y bloqueo exacto

- **Comprobado realmente en ambas plataformas, app activa:** cinco destinos, copia
  específica, salida segura, singularidad ante enlace repetido, Back/close, preview,
  confirmación explícita, `ready` posterior y remount a preview.
- **Comprobado determinísticamente:** EAN/checksum, lectura única, error y retry de
  consulta/navegación, cancel, epoch, resultado tardío y rearmado.
- **No comprobado físicamente:** scanner→detalle, Back/gesto desde ese detalle a
  «Listo», errores/retry/cancel y rearmado derivados de una lectura real. No hay otra
  pantalla ni un patrón EAN impreso presentable al Android; iOS Simulator no tiene
  cámara óptica. No se añadió un atajo de producción ni se simuló un callback.
- **No comprobado en frío sin launcher:** no existe un artefacto directo instalado y los
  Development Builds interceptan el esquema al iniciar el proceso. Los intentos se
  conservan como evidencia del bloqueo, no como aprobados.

Por faltar dos partes de su «Hecho cuando» —flujo óptico scanner→detalle/rearme y matriz
fría en build no interceptado— **T6 permanece desmarcada**. No se avanzó a T7.

> **Superado el 2026-10-14:** las dos partes que faltaban se resolvieron después (matriz fría en la
> «Segunda vuelta de T6» y flujo óptico en el «Cierre de T6 — 2026-10-14»). T6 quedó **marcada**. Esta
> sección se conserva como historia.

## Segunda vuelta de T6 — 2026-10-14: lámina EAN y binarios Release sin Dev Launcher

No cambió código, `app.json`, `eas.json`, plugins ni dependencias; `git status` quedó idéntico
al de antes de la vuelta. Todo el material temporal (lámina, scripts, capturas, logs) vive en
el scratchpad de la sesión y no se añadió al repositorio.

### A) Lámina temporal de EAN-13 para el Samsung

Se generó con un script propio (sin dependencias): codificación estándar L/G/R con paridad por
primer dígito, guardas inicial/central/final, zonas de silencio de 11/7 módulos y una página
HTML que muestra un código por vez (teclas 1/2/3) sobre tarjeta blanca de alto contraste.

| # | Código | Caso | Comprobación |
|---|---|---|---|
| 1 | `2002610090028` | Válido, existe: «Magnesium Glycinate Softgels» (`product-261009-002`, stock 99) | checksum válido; `GET /products/barcode/…` → 200 |
| 2 | `4006381333932` | Checksum inválido (el dígito correcto sería 1) | checksum inválido; mock → 400 |
| 3 | `5901234123457` | Checksum válido, no está en el catálogo | checksum válido; mock → 404 `PRODUCT_NOT_FOUND` |

Verificación independiente del renderizado: se decodificaron con el framework Vision de Apple,
tanto el patrón en PNG como capturas del HTML real renderizado por Chrome. El 1 y el 3 se
decodifican con la carga exacta; el 2 **no** se decodifica. Un control con los mismos 12
dígitos y checksum correcto (`4006381333931`) sí se decodificó, así que el rechazo del 2 se debe
solo al checksum. Consecuencia: los decodificadores nativos descartan un EAN-13 de checksum
inválido antes de entregarlo (ML Kit en Android, según su comportamiento conocido, no se
comprobó en el dispositivo). Es muy probable que el código 2 no produzca ninguna reacción en la
app; el estado `invalid-code` queda cubierto de forma determinista por los tests de la máquina,
y la ausencia de reacción óptica debe anotarse como «sin reacción», no como fallo.

Corrección de expectativas (leída del código): en «no encontrado» las acciones son «Escanear de
nuevo» y «Cancelar» (el 404 no es reintentable); «Reintentar» solo aparece en
offline/timeout/5xx/datos inválidos y solo con conexión; en inválido el botón es «Aceptar».

### B) Binarios Release (sin Dev Launcher)

Documentación consultada (docs.expo.dev, guía de builds locales): `npx expo run:android
--variant release` y `npx expo run:ios --configuration Release`; las variantes release incrustan
el JS y excluyen el UI de `expo-dev-client`. En Apple `expo-dev-launcher` y `expo-dev-menu` declaran
`debugOnly`; en Android la ausencia del launcher se comprobó en el propio APK (abajo). La URL pública se inyectó solo en el
entorno del comando (`EXPO_PUBLIC_API_ORIGIN=http://localhost:3001`), sin tocar archivos.

**Android (Samsung SM-A037M).** `npx expo run:android --variant release --device SM_A037M
--no-bundler` → **BUILD SUCCESSFUL in 4m 17s**, APK instalado sobre el debug (misma firma de
depuración, datos conservados). El APK no contiene `DevLauncherActivity` ni entradas
`devlauncher`, no es depurable y su manifiesto no declara `usesCleartextTraffic`; el APK debug
tiene depurable, `usesCleartextTraffic=true` y `DevLauncherActivity`. Ese es el único cambio de
red entre ambos y explica la limitación de abajo (atribución inferida del manifiesto: en release
no hay logs JS que lo confirmen).

**iOS Simulator (iPhone 17 Pro).** El primer intento, `npx expo run:ios --configuration Release`,
falló en `lipo` con `No space left on device` (errno 28): el volumen de datos del Mac está al 100 %
(358 MiB libres de 460 GiB) y Release compila un binario universal arm64+x86_64. Tras liberar
solo salidas de build generadas en esta vuelta, se repitió con exactamente los mismos argumentos
que usa Expo CLI (`xcodebuild -workspace … -configuration Release -scheme HerbStore -destination
id=<udid> COCOAPODS_PARALLEL_CODE_SIGN=true COMPILER_INDEX_STORE_ENABLE=NO`) más
`ONLY_ACTIVE_ARCH=YES` (solo arm64) → **BUILD SUCCEEDED**. El `.app` es arm64, lleva
`main.jsbundle`, no tiene frameworks ni símbolos del launcher (solo el protocolo
`EXUpdatesDevLauncherInterface` de la interfaz de updates) y su ATS conserva
`NSAllowsLocalNetworking=true` (por eso iOS sí llega al mock en `localhost`).

### Matriz fría, binario Release no interceptado

Procedimiento: proceso muerto (Android `am force-stop`, `pidof` vacío; iOS `simctl terminate`, sin
PID) y entrega de la URL. Android: `am start -W -a android.intent.action.VIEW -d <url> -n
com.herbstore.mobile/.MainActivity`; iOS: `simctl openurl`. IDs usados: `product-261009-001`,
`NOT_A_PRODUCT`, `product-261009-999`, `herbstore://totally-unknown/path`, `herbstore://scanner`.

| Caso | Android Release (Samsung) | iOS Release (Simulator) |
|---|---|---|
| Producto válido | `LaunchState: COLD`, `MainActivity`; «Producto» + «Sin conexión con el servidor» + «Reintentar» (ruta correcta, datos no) | Detalle «Complete Daily Powder», precio, «Agotado» (stock 0), datos reales |
| Id malformado | «Producto inválido» + «El enlace no contiene un identificador de producto válido.» + Volver/Ir a Inicio | Igual |
| Id válido inexistente | Como el válido: «Sin conexión con el servidor» (404 no distinguible) | «Producto no encontrado» + «El producto no existe o el enlace no es válido.» (404 real) |
| Ruta desconocida | «No encontramos esta pantalla» + «Enlace no reconocido» + Volver/Ir a Inicio | Igual |
| `scanner` | «Escáner», «Escáner de productos», aviso de cámara, «Continuar»/«Cerrar» | Mismas etiquetas en el árbol AX |

En Android las cinco entregas dieron `Status: ok`, `LaunchState: COLD`, actividad final
`com.herbstore.mobile/.MainActivity` (`topResumedActivity`), ~1,9 s, y ningún nodo «Development
Build»/«DEVELOPMENT SERVERS» (`uiautomator dump`). En iOS el PID cambió en cada apertura (proceso
nuevo) y el árbol (`axe describe-ui`) no contiene ningún nodo del launcher; las capturas no muestran
el botón flotante de herramientas que sí aparece en el Development Build.

Salida segura desde destinos fríos: Android, Back desde producto y desde scanner → Inicio; iOS,
«Cerrar» del scanner, Atrás nativo del producto y «Ir a Inicio» del 404 → Inicio.

Notas de método: en el simulador `AccessibilityEnabled`/`ApplicationAccessibilityEnabled` estaban en 0
y `axe describe-ui` devolvía un árbol vacío (la primera pasada solo aporta capturas, que sí mostraron
detalle y preview); se pusieron en `true` para la segunda pasada, que es la tabla de arriba, y se
restauraron a 0. La cola del volcado AX de iOS lista el Inicio antes que la hoja del scanner; las
etiquetas del scanner están más abajo en el mismo árbol y un `--point` sobre «Continuar» las devuelve.

### Qué destinos quedan limitados por el cleartext (Android Release)

- Comprobables en frío sin red: id malformado, ruta desconocida, scanner, y el arranque directo al
  destino sin launcher (Android: también producto válido/inexistente como **ruta**, pero su contenido
  depende de la API).
- Limitados en Android Release: contenido de producto válido, 404 y también Inicio (todos requieren
  HTTP al mock). Quitar la limitación exigiría un cambio tracked (p. ej. la opción
  `usesCleartextTraffic` de `expo-build-properties`, que ampliaría el alcance y relajaría la
  seguridad del build de release); no se hizo. iOS no la tiene por `NSAllowsLocalNetworking`.

### Restauración del entorno

- Android: `npx expo run:android --device SM_A037M --no-bundler` (debug) → **BUILD SUCCESSFUL**, APK
  depurable con `DevLauncherActivity`, `adb reverse` 8081 y 3001 activos, Development Build conectado
  a Metro y abierto en la vista previa del scanner.
- iOS: se reinstaló el `.app` Debug ya compilado (sin recompilar) y se conectó a Metro; muestra Inicio.
- Mac: se retiraron las salidas Release generadas en esta vuelta (productos e intermedios de iOS y
  los intermedios de cmake/libs nativas de Android Release; el APK Release de ~130 MB se conserva).
  El volumen sigue casi lleno (≈2,5 GiB libres): recompilar iOS Release universal con
  `expo run:ios --configuration Release` volverá a fallar por espacio hasta que se libere disco.

### Verificación

`npx expo lint` y `npx tsc --noEmit` sin salida; `git diff --check` limpio; dirigidos de T6 **41/41**;
`npm run test:logic` **929/929**.

### Estado

Matriz fría acreditada en ambas plataformas con binario no interceptado (con la limitación de
cleartext en Android descrita). **Falta** la lectura óptica real scanner→detalle con Back/gesto a
«Listo», 404 y red derivados de una lectura de cámara: Android depende del usuario con la lámina;
iOS Simulator no tiene cámara óptica. **T6 sigue desmarcada.** No se avanzó a T7.

> **Superado el 2026-10-14:** la lectura óptica real en el Samsung se hizo después y T6 quedó
> **marcada**; ver «Cierre de T6 — 2026-10-14». Un matiz de esta sección cambia: el código 2
> (checksum inválido) no produjo «ninguna reacción» sino lecturas de otros valores con checksum válido
> (la cámara leyó mal el rótulo); sigue sin llegar ninguna consulta con checksum inválido a la red. Se
> conserva como historia.

## Cierre de T6 — 2026-10-14

Cierra T6 (RF-13, RF-17–RF-21, RF-32–RF-34, RNF-2 y RNF-3) tras la lectura óptica real en el
Samsung. Esta sección **supera** a las dos anteriores de T6, que se conservan como historia: allí T6
quedó desmarcada porque faltaba el flujo óptico scanner→detalle; aquí se registra ese flujo, los tres
defectos que destapó (corregidos dentro de T6 por decisión del usuario), las decisiones del usuario
sobre lo que no se puede cerrar con hardware y las limitaciones que quedan. T6 queda **marcada**.

Esta llamada de cierre fue solo documental: no tocó código de producto, dependencias, configuración
ni `ios/`/`android/`. Las tres correcciones se hicieron antes, en la misma tarea. El material
temporal (lámina de EAN, scripts, capturas, volcados y logs) vive en el scratchpad de la sesión y no se
añadió al repositorio.

Leyenda de autoría de cada medida:

- **[U]** reportado por el usuario en el Samsung (con sus palabras cuando importa).
- **[A]** medido por un agente con herramientas (logcat de `ReactNativeJS`, `uiautomator`, herramienta
  `A11y`, `dumpsys`, `axe`, capturas).
- **[T]** comprobado por tests deterministas (sin dispositivo).

### Correcciones hechas dentro de T6

Las tres salieron de la validación física con la lámina (antes de corregir, [U] reportó: el Atrás
nativo volvía a «Listo» pero la flecha del encabezado llevaba a Inicio; [A] midió que «Cancelar» y
«Agregar al carrito» quedaban bajo la barra del sistema).

| # | Defecto | Causa | Corrección | Opción descartada |
|---|---|---|---|---|
| 1 | La flecha del encabezado del detalle escaneado cerraba todo el modal y llevaba a Inicio; el Atrás de hardware sí volvía a «Listo» | El encabezado era del Stack raíz (`presentation: 'modal'`, `headerShown: true`) y el Stack interior tenía `headerShown: false`: la flecha de un encabezado del modal siempre saca la pantalla del Stack raíz | `src/app/_layout.tsx`: el modal raíz ya no dibuja encabezado. `src/app/scanner/_layout.tsx` dibuja los del Stack interior: X «Cerrar» en `index` (`src/features/scanner/components/ScannerHeaderCloseButton.tsx`, cierra el modal, RF-19) y flecha nativa en `product/[id]` (vuelve a «Listo», RF-13), con `unstable_settings.anchor = 'index'` para que un enlace directo al producto tenga el scanner debajo. Test de caracterización en `src/core/navigation/linking.test.ts` (`/scanner` y `/scanner/product/<id>` no se convierten en `/product/<id>`) | Encabezado raíz con `headerLeft` dinámico según la ruta hija: frágil, depende de leer la ruta activa desde fuera |
| 2 | «Cancelar» del scanner en «Listo» y «Consultando» no se podía pulsar | Con edge-to-edge de Android el botón quedaba entero dentro de la franja de la barra de navegación (`[0,1510][720,1600]` px), sin tab bar que la cubra | `src/features/scanner/screens/ScannerScreen.tsx`: componente local `ScannerPage` (`AppSurface` + `SafeAreaView edges={['bottom','left','right']}` + padding), compartido por la rama de cámara y por `MessageScreen` (preview, errores, 404). El encabezado del Stack interior ya cubre el inset superior | `useSafeAreaInsets()` con cálculo manual del padding |
| 3 | La barra «Total / Agregar al carrito» (`StickyAddBar`) del detalle abierto desde el scanner quedaba bajo la barra del sistema (Android) y solapada con el indicador de inicio (iOS) | El detalle fija la barra abajo y por diseño no añade inset: bajo los tabs lo cubre la tab bar; el modal del scanner no tiene tab bar | `src/features/scanner/components/ScannerProductFrame.tsx` (`SafeAreaView edges={['bottom']}`, `flex: 1`, fondo `colors.surface` para que la franja se lea como una barra más alta) envuelve el detalle en `src/app/scanner/product/[id].tsx`. `StickyAddBar`, `ProductDetailScreen` y las rutas con tabs quedan sin cambios | Inset opcional en `StickyAddBar`/`ProductDetailScreen` (ensancha una pantalla compartida por un solo llamador) y `useSafeAreaInsets()` dentro del detalle (duplicaría el espacio con tabs) |

Notas de diseño que justifican las decisiones:

- La X de `ScannerHeaderCloseButton` se dibuja con dos barras (`View`) y no con `AppIcon`: en Android
  `SymbolView` pinta un glifo de fuente cuya caja es fija pero cuyo texto escala, y desde ~1,3x se
  recortaba (hallazgo H-1/H-11 de la auditoría). Es la única salida visible del modal, así que no debe
  depender de una fuente. Arreglar `AppIcon` para toda la app queda para la auditoría del Día 6.
- Trade-off del punto 3: mientras el detalle no tiene barra (cargando, no encontrado, error) la franja
  de `surface` queda bajo una página de fondo `background`; solo mide el inset del sistema (34 pt en
  iOS; 48 dp con la barra de 3 botones de Android, donde la barra opaca la tapa).
- Kotlin/Compose: el equivalente del punto 1 es un `NavHost` anidado cuyo `popBackStack()` solo llega
  al exterior cuando el interior está en su inicio; del punto 2 y 3, `Modifier.navigationBarsPadding()`.
  Swift/SwiftUI: un `NavigationStack` dentro de un `.sheet` (el botón atrás vuelve en la pila, `dismiss()`
  cierra la hoja) y `.safeAreaInset(edge: .bottom)`.

### Validación física tras las correcciones — Samsung SM-A037M, Android 13

El dispositivo usa navegación de 3 botones: el gesto de retroceso del borde **no** se ejercitó.

| Caso | [U] Usuario | [A] Agente |
|---|---|---|
| Atrás de hardware desde el detalle escaneado | Vuelve a «Listo» y se rearma | Vuelve a «Listo» por la ruta real `herbstore://scanner/product/product-261009-002` |
| Flecha del encabezado del detalle | Vuelve a «Listo» y se rearma («tanto con el botón nativo y con la flecha de la pantalla») | Vuelve a «Listo» (antes de la corrección iba a Inicio) |
| X «Cerrar» del encabezado de `index` | Lleva a Inicio; la reapertura vuelve a la vista previa | Botón de 48 dp; la reapertura empieza en `preview` sin `ExpoCameraView` montado |
| Código válido `2002610090028` | «Magnesium Glycinate Softgels» | `GET /products/barcode/2002610090028 -> ok` y `GET /products/product-261009-002 -> ok` |
| 404 con la tecla 3 `5901234123457` | «Producto no encontrado.» con «Escanear de nuevo» y «Cancelar»; ambos funcionan | `GET /products/barcode/5901234123457 -> http 404` en el log |
| «Cancelar» alcanzable en «Listo» | «La prueba se realizó de manera exitosa» | `[30,1390][690,1480]` px (48 dp) sobre la barra `[0,1510]`; el tap cierra el scanner sin consultas; igual en tema oscuro y con `font_scale` 2.0 |
| «Agregar al carrito» del detalle escaneado | — | 260×48 dp `[202,1388][690,1478]`; feedback «Se agregó 1 unidad al carrito.» (carrito restaurado después); a `font_scale` 2.0 la barra ocupa el 23 % de la pantalla (tope 40 %) |
| Regresión de la ruta con tabs | — | Sin hueco doble bajo la barra de compra |

Rearmado por foco: con la cámara apuntando a la lámina, al volver del detalle el scanner relee solo
~1,6 s después y reabre el detalle. Es el diseño (el foco rearma la instancia, RF-13), no un fallo.

### iOS Simulator — iPhone 17 Pro, iOS 26.5 (sin cámara óptica)

Todo [A] por `axe`/capturas; no se atribuye lectura óptica al Simulator.

- X «Cerrar» de 48×48 pt → Inicio.
- Enlace directo al detalle del scanner: aparece «‹ Escáner»; Atrás nativo → vista previa del scanner
  (el scanner está debajo en `preview` por `anchor: 'index'`).
- «Cancelar» de 48 pt de alto con 50 pt libres sobre el borde inferior.
- «Agregar al carrito» en y=775–823, sobre el indicador de inicio (antes solapado).
- Ruta con tabs sin hueco doble.
- **No comprobado en iOS:** lectura óptica, tap en «Agregar», tema oscuro, texto grande, gesto de borde
  y reconexión de `expo-network`.

### RF-14 y lecturas inválidas con la cámara real (inferencia, no prueba directa)

Se imprimieron dos rótulos de checksum inválido: `4006381333932` (el dígito correcto sería 1) y
`2002610090012`. En el Samsung ninguno produjo el aviso de código inválido: ambos acabaron en
«Producto no encontrado». En logcat, la cámara entregó otros valores:

| Valor consultado | Resultado | ¿Checksum válido? | Diferencia con el rótulo `4006381333932` |
|---|---|---|---|
| `9415385333932` | `http 404` | Sí | 10 de 42 módulos distintos en la mitad izquierda, 0 en la derecha |
| `8006485333932` | `http 404` (2 veces) | Sí | 2 de 42 a la izquierda, 0 a la derecha |
| `3040484333932` | `http 404` | Sí | 4 de 42 a la izquierda, 0 a la derecha |

En los tres la mitad derecha (`333932`) está intacta y la izquierda tiene entre 2 y 10 módulos mal
leídos. El log también contiene `4031212070068` y `4006381333931` (ambos `http 404`, checksum válido);
no se analizaron módulo a módulo. Ninguna consulta con checksum inválido llegó a la red.

Lectura: los decodificadores nativos validan el checksum EAN-13 antes de entregar el valor. **Vision**
se comprobó directamente en el Mac (decodifica `4006381333931`, no `4006381333932`); **ML Kit** en
Android es una **inferencia** del log (una mala lectura con checksum roto se descarta y solo pasan las
que, por azar, validan). No hay instrumentación del decodificador que pruebe qué emitió ML Kit.

Decisión del usuario: RF-14 se cierra como **«Cubierto por tests deterministas»**: `ean13.test.ts`
(checksum y longitud) y `scanner-machine.test.ts` («invalid code blocks until explicit rearm»: un valor
inválido lleva a `invalid-code`, ignora nuevas lecturas y solo se rearma con `rearm`, sin pasar por
`querying`). **Hueco conocido:** la parte «no consulta el catálogo» depende además del guard
`if (!isValidEan13(code)) return;` de `src/features/scanner/hooks/use-scanner-controller.ts`, que no
tiene test directo; Jest/RNTL llega en el Día 6.

Observación (opción D, descartada por ahora): una mala lectura con checksum válido que coincida con un
producto real abriría el producto equivocado. Mitigación posible: exigir dos lecturas consecutivas
idénticas (coste: latencia de reconocimiento).

### RF-16 con reconexión real (Android, lectura óptica real, dos repeticiones)

Procedimiento: se quitó el túnel del mock (`adb reverse --remove tcp:3001`) con la cámara apuntando al
código válido `2002610090028`; la cámara leyó sola. Horas locales del log de `ReactNativeJS` (sin SSID
ni datos de red):

| Hora | Evento |
|---|---|
| 15:11:51.934 / 15:11:52.492 / 15:11:53.550 | 3× `[api] GET /products/barcode/2002610090028 -> network` (intento y dos reintentos de 500 y 1000 ms) |
| tras el 3.er `network` | Título «Sin conexión. Recupera la conexión y pulsa Reintentar.» con **solo** «Cancelar»; el lector queda bloqueado (0 consultas en 10 s con la lámina delante) |
| ≈15:12 | `svc wifi disable` + `svc data disable`: el sistema se queda sin ninguna red; la pantalla no cambia |
| 15:13:08.118 | Con el túnel restaurado y `svc wifi enable` + `svc data enable`: `[net] offline -> online (1 listener)`; aparece «Reintentar» (`[30,428][690,518]`) junto a «Cancelar» |
| 15:13:41.846 y 15:13:42.843 | Tap en «Reintentar»: `GET /products/barcode/2002610090028 -> ok` (0,75 s tras el tap) y `GET /products/product-261009-002 -> ok` (1,75 s); detalle «Magnesium Glycinate Softgels», «Disponible: 99 unidades» |
| 15:15:19.076 / 15:15:19.624 / 15:15:20.669 | Repetición: 3× `-> network` |
| 15:15:49.221 | Repetición: `[net] offline -> online (1 listener)` y vuelve a aparecer «Reintentar» |
| ≈15:16 | «Cancelar» tras la reconexión → Inicio, sin ninguna consulta posterior en el log |

Descartado como evidencia: un failover a datos móviles (el teléfono no tiene servicio celular) y el
registro tardío del estado previo de la red. Una primera pasada (≈14:48–15:02, por las capturas) no dejó
ninguna consulta EAN en el log y se repitió desde las 15:10.

**Hueco aceptado y trasladado al Día 6 (decisión del usuario).** «Reintentar» solo aparece tras una
transición real offline→online de `expo-network`: `isOnline` es un `useState(true)` local de
`use-scanner-controller.ts` que pasa a `false` al fallar una consulta de tipo `network` y a `true` solo
con `onReconnect`. Consecuencias:

- Si la consulta falla con el sistema aún conectado (servidor caído, túnel perdido, portal cautivo)
  solo queda «Cancelar», y el título dice «Sin conexión. Recupera la conexión y pulsa Reintentar.»:
  promete un botón que no existe.
- Tras la reconexión el título sigue diciendo «Sin conexión…».
- Posible carrera sin probar: si la red vuelve durante los 3 intentos, `setIsOnline(true)` ocurriría
  antes del fallo y el botón quedaría oculto.
- Alternativa a valorar: derivar `isOnline` del estado actual (`getNetworkStateAsync`) o del tipo de
  error en lugar de solo de eventos. Trade-off: dejaría de bloquear el reintento cuando el servidor falla
  sin que el sistema esté offline, que es lo que RF-16 pide hoy («permite reintentar cuando se recupere
  conectividad»).

### Matriz Android/iOS

| Caso | Android físico, activo | Android Release, frío | iOS Simulator, activo | iOS Release, frío |
|---|---|---|---|---|
| Producto válido | Un único detalle [A] | Ruta resuelve; datos limitados por cleartext | Un único detalle [A] | Detalle con datos reales [A] |
| Id malformado | «Producto inválido» + salida [A] | Igual [A] | Igual [A] | Igual [A] |
| Id válido inexistente | «Producto no encontrado» [A] | Ruta resuelve; 404 no distinguible (cleartext) | Igual [A] | 404 real [A] |
| Ruta desconocida | «Enlace no reconocido» + salida [A] | Igual [A] | Igual [A] | Igual [A] |
| `scanner` | Preview → «Listo» → Cancelar/X [U][A] | Preview con aviso de cámara [A] | Preview → «Listo» → Cancelar/X [A] | Preview [A] |
| Scanner→detalle por lectura óptica | Sí, Atrás/flecha/X/404/red [U][A] | No aplica | No (sin cámara) | No (sin cámara) |

Los casos fríos son los de la sección «Segunda vuelta de T6» (binarios Release sin Dev Launcher; no se
usa como evidencia el launcher interceptado). El detalle de cada entrega no se repite aquí.

### Resultados por requisito

| RF | Resultado | Evidencia | Limitación |
|---|---|---|---|
| RF-13 | Cumplido en Android; parcial en iOS | [U][A] Atrás de hardware y flecha → «Listo» con rearmado; reapertura tras desmontar → preview; [A] iOS: Atrás nativo desde el enlace al detalle → preview; [T] máquina y navegación | Gesto de borde no ejercitado (Android con 3 botones; `axe swipe` no lo dispara en iOS); iOS no tiene retorno desde un detalle escaneado (sin cámara) |
| RF-14 | **Cubierto por tests deterministas** (decisión del usuario) | [T] `ean13.test.ts` y `scanner-machine.test.ts` (estado `invalid-code`, bloqueo y rearme); [A] ninguna consulta con checksum inválido llegó a la red | Con la cámara real no se entrega un EAN-13 inválido (inferencia); el guard del hook no tiene test directo (Día 6) |
| RF-16 | Cumplido en Android para offline; el resto por tests | [A] reconexión real, dos repeticiones: bloqueo, solo «Cancelar», «Reintentar» tras offline→online, detalle abierto; [T] timeout/5xx/datos inválidos | Hueco de «Reintentar» (arriba) → Día 6; iOS sin reconexión |
| RF-17 | Solo tests | [T] `scanner-machine.test.ts` («scanner exposes recoverable navigation failure and ignores late navigation results after cancel» y «…completes navigation only after the nested detail is opened, then rearms on return») | No es provocable con la cámara |
| RF-18 | Cumplido en Android y en iOS por enlace | [U][A] 404 con `5901234123457`: «Producto no encontrado.», «Escanear de nuevo» (rearma) y «Cancelar»; iOS Release: 404 real por enlace | En Android Release el cleartext impide ver el 404 en frío (aceptado) |
| RF-19 | Cumplido | [A] «Cancelar» alcanzable (48 dp, claro/oscuro/`font_scale` 2.0), cierra al origen sin consultas, también tras reconectar; X → Inicio [U][A]; [T] resultados tardíos ignorados | iOS: alcanzable (50 pt libres), sin lectura óptica |
| RF-20 | Cumplido | [A] malformado, inexistente y desconocido con salida segura, en activo y en frío | Android Release: solo malformado y desconocido son concluyentes (aceptado) |
| RF-21 | Cumplido | [A] un solo destino ante enlaces repetidos, arranque frío (binarios sin launcher) y activo, salida segura; `herbstore://scanner` exige confirmar; [T] `linking.test.ts` | Android Release: destinos con datos limitados por cleartext (aceptado) |
| RF-32–RF-34, RNF-2, RNF-3 | Cumplido en Android; parcial en iOS | [A] objetivos de 48 dp, tema oscuro y `font_scale` 2.0 en «Listo», X y «Agregar»; Android e iOS reportados por separado | iOS sin tema oscuro ni texto grande; «Consultando» y errores a `font_scale` 2.0 no reproducidos en físico |

### Limitaciones declaradas (no son fallos)

- Gesto de retroceso del borde: no ejercitado en Android (navegación de 3 botones) ni en iOS (`axe
  swipe` no lo dispara). Navegación por gestos de Android (barra transparente): la franja de `surface`
  bajo la barra de «Agregar» sería visible; no comprobada.
- RF-17 (fallo de navegación al abrir el detalle): solo tests de máquina y navegación.
- «Consultando producto…» y errores/`unavailable` a `font_scale` 2.0 en el Samsung: no reproducidos
  físicamente. Estimación de holgura de ~200 dp para `unavailable` a 2.0; en pantallas más bajas podría
  hacer falta un `ScrollView` (Día 6).
- iOS sin evidencia óptica ni de reconexión; el Simulator no tiene cámara.
- Android Release: HTTP cleartext bloqueado hacia el mock; producto válido y 404 no se distinguen en frío.
  **Decisión del usuario: se acepta**, sin cambios en el repositorio; iOS Release sí los comprobó en frío
  con datos reales.

### Seguimientos para el Día 6 / auditoría

- Hueco de «Reintentar», título desactualizado tras reconectar y posible carrera (arriba).
- Test directo del guard `isValidEan13` del hook (Jest/RNTL).
- Opción D: dos lecturas consecutivas idénticas antes de consultar (si se quiere cerrar el riesgo de
  producto equivocado).
- Dos toques casi simultáneos (~100 ms) sobre un botón con ruta singular apilan dos pantallas
  (preexistente; también en Búsqueda).
- Cambiar `font_scale` con el scanner abierto devuelve la app a Inicio.
- Barra de navegación del Samsung clara en modo oscuro (también con tabs).
- Posible `ScrollView` en `MessageScreen` con fuente muy grande.
- Método: `uiautomator dump` recorta nodos en y=1465 en este Samsung; para medir cerca de la barra
  inferior usar la herramienta `A11y` (`/data/local/tmp/a11y.dex`) o `dumpsys`.
- Entorno: el disco del Mac llegó a ~800 MiB libres (un Release iOS universal falla por `lipo` errno 28;
  usar `ONLY_ACTIVE_ARCH=YES`); `adb` no está en el PATH (`$ANDROID_HOME/platform-tools/adb`).
- Higiene del repositorio: las salidas de compilación de `modules/device-insights/android/build/` (unos
  350 archivos) no estaban ignoradas por Git. **Superado:** hoy las ignora `/modules/device-insights/android/build/` en `.gitignore`.

### Verificación de este cierre

Ejecutada al cerrar T6, sin cambios de dependencias ni de configuración:

- `npx expo lint`: sin salida, código 0.
- `npx tsc --noEmit`: sin salida, código 0.
- `npm run test:logic`: **930/930** (la 2.ª vuelta registraba 929; el +1 es compatible con el test de
  caracterización de `linking.test.ts` añadido por la corrección 1).
- Dirigidos de scanner y linking (`linking`, `ean13`, `scanner-machine`, `scanner-navigation`,
  `scanner-read-barrier`, `scanner-view-state`, `camera-access`): **42/42** (41 antes).
- `git diff --check`: limpio. Revisión de espacios finales, tabuladores y salto de línea final en
  `src/app/scanner/`, `src/features/scanner/components/` y `ScannerScreen.tsx` (archivos sin seguimiento,
  que `git diff --check` no cubre): sin hallazgos.
- `package.json`, `app.json` y `package-lock.json` figuran modificados respecto a `HEAD` por T1–T5; sus
  fechas de modificación (13 de octubre, 17:57 y 20:17) son anteriores al primer cambio de código de T6
  (14 de octubre, 13:17), así que T6 no los tocó. Por eso no se ejecutaron `expo install --check` ni
  Expo Doctor.

### Estado

Matriz fría acreditada en ambas plataformas, flujo óptico real acreditado en Android físico, tres
correcciones validadas, RF-14 cubierto por tests, cleartext de Android Release y «Reintentar» aceptados
por el usuario con seguimiento para el Día 6. **T6 queda marcada.** No se avanzó a T7. No se creó commit:
el Día 5 no está cerrado (faltan T7, T8 y T10).

## T7 — Háptico solo en mutaciones aceptadas y compartir recuperable — 2026-10-14

Alcance: RF-22, RF-26, RF-27, RF-32, RF-34, RNF-2, RNF-3, RNF-4. Una vuelta anterior dejó el listener
háptico, `classifyShareResult` y el error con «Reintentar» sin cerrar la tarea. Esta vuelta audita contra el
«Hecho cuando», añade los huecos de lógica con tests primero y mide en Android físico (Samsung SM-A037M,
Android 13, Development Build debug, JS recargado por Metro) y en iOS Simulator (iPhone 17 Pro, iOS 26.5).
Sin recompilar y sin tocar dependencias, `app.json` ni `eas.json`.

### Auditoría previa (qué ya estaba y qué faltaba)

| Pieza | Estado al empezar | Hueco |
| --- | --- | --- |
| `cartFeedbackAction` (comparación antes/después) | correcto, con test de instantáneas escritas a mano | ningún test con los reducers reales: límite de stock, línea inexistente, `removeLine` ajeno |
| Listener `native-feedback-listeners.ts` | correcto, pero acoplado a `expo-haptics` | no comprobable en Node: «exactamente un impacto» sin test; nada probaba que un fallo del actuador no afecta al carrito |
| `requestLightImpact` | `try/catch` sin test | sin test de promesa rechazada, `throw` síncrono ni promesa que no resuelve |
| Badge | `selectCartUnits` suma unidades, con tests | sin test en cadena (acción real → badge) |
| `classifyShareResult` | aceptaba solo `{action?: string}` | no cubría formas no reconocibles (string, número, array) |
| `Share.share` en `ProductDetailScreen` | `.then/.catch` en la pantalla | `Share.share` puede lanzar de forma SÍNCRONA (`invariant`, ShareModule ausente): el `.catch` no lo cubría; sin guarda ante doble toque; el error se ocultaba al pulsar «Reintentar» (el foco se perdía) |
| Texto compartido | `t('product.share.message')` en la pantalla | sin test por idioma; nada probaba el enlace literal en ES y EN |
| Contenedor del error | `accessibilityLiveRegion="polite"` + `announceForAccessibility` | doble ruta de anuncio en Android |

### Cambios (tests primero; fallaban por módulo/export inexistente)

- `src/features/feedback/logic/optional-feedback.ts` (+test): `runOptionalFeedback` absorbe rechazo, `throw`
  síncrono y devuelve `true/false`.
- `src/features/feedback/store/cart-feedback-listener.ts` (+test, 9 casos con los slices reales y el thunk
  real): `createCartFeedbackListener(requestImpact)`. `native-feedback-listeners.ts` queda como el cableado
  (`requestLightImpact`) y `haptics.ts` solo llama a `Haptics.impactAsync(Light)`; el listener es el punto
  único que absorbe los fallos. Verificado por mutación: si `cartFeedbackAction` ignora «sin cambio» fallan 3
  tests; si el listener no absorbe el rechazo el test de `console.error` falla.
- `src/features/product/logic/product-share-outcome.ts` (+test): `classifyShareResult(unknown)` y
  `createShareRunner()` (un solo share en vuelo, `ignored` para el segundo toque, rechazo o `throw`
  síncrono = `failed`, la guarda se libera tras cualquier final).
- `src/features/product/logic/product-share.ts` (+test con i18next real en `es` y `en`):
  `buildProductShareRequest(product, translate)` con enlace literal dentro de `message`.
- `src/features/product/hooks/use-product-share.ts` (nuevo) y `ProductDetailScreen.tsx`: la pantalla solo
  conecta. Éxito y cancelación son silenciosos y limpian un error previo; `failed` muestra el mensaje,
  «Reintentar compartir» y un anuncio único. El mensaje de error ya no tiene `accessibilityLiveRegion`
  (el anuncio por `announceForAccessibility` es la ruta común a ambas plataformas, como `AddToCartFeedback`).
  Log `__DEV__` `[share] outcome=…` para distinguir plataformas.

Decisiones: (1) listener tras el reducer que compara antes/después (elegida en el plan) frente a vibrar en
cada botón (descartada: vibraría acciones rechazadas); trade-off: un middleware más. (2) `impactAsync(Light)`
en ambas plataformas, una llamada (elegida) frente a `performAndroidHapticsAsync` (descartada: solo Android,
depende del ajuste «respuesta táctil» del sistema y exige `Platform.select`); trade-off: en Android pasa por
el servicio `Vibrator`, que la documentación de Expo considera menos recomendable. (3) Runner con guarda propia
frente a `useRef` booleano en el hook (descartada: no comprobable en Node).

### Android físico — háptico (medido por el agente [A]; lo sentido está en «Confirmación del usuario»)

Método: `adb shell dumpsys vibrator_manager` conserva el historial de vibraciones solicitadas al servicio con
`opPkg`, uso, estado y forma de onda. Se contaron las entradas de `com.herbstore.mobile` antes y después de
cada acción. Cada impacto aparece como `usage=TOUCH`, `status: finished`, `Step{amplitude=0.11764706,
duration=50}`, que es la forma «light» del código Kotlin de `expo-haptics` 57.0.3 (tiempos `[0, 50]`,
amplitudes `[0, 30]`, 30/255). Una forma «heavy» se vería con 60 ms y 0,27.

| Acción real en el Samsung | Impactos | Badge |
| --- | --- | --- |
| Agregar 1 unidad de A | 1 | 1 |
| Doble toque en «Agregar» (2 toques en menos de 700 ms) | 1 | 2 |
| `+` del selector de cantidad del detalle (estado local, ~200 toques) | 0 | sin cambio |
| Agregar con cantidad 2 | 1 | 4 |
| Agregar 1 unidad de B (segunda línea) | 1 | 5 (unidades, no líneas) |
| Carrito: `+` de A / `−` de A / «Eliminar» B | 1 / 1 / 1 | 6 / 5 / 4 |
| Agregar con cantidad 99 sobre 4 (tope a 99) | 1 | 99 |
| «Agregar» otra vez con 99 (inmediato y 3 s después) | 0 / 0 | 99 |
| Carrito: `+` con 99 (límite de stock) | 0 | 99 |
| Carrito: «Eliminar» A (99 unidades) | 1 | sin badge |
| Producto agotado: toque en el botón «Agotado» (deshabilitado) | 0 | sin badge |
| Reduced motion (`animator_duration_scale` 0): agregar 1 | 1 | 1 |

Con tope de stock el mensaje «El carrito conserva el máximo disponible: 99 unidades.» sigue apareciendo sin
háptico (captura tomada 0,7 s después del toque), así que el háptico no es la única confirmación. El
dispositivo declara el vibrador sin control de amplitud (`mCapabilities=[]`) y la intensidad TOUCH del sistema
en BAJA: lo que la mano percibe puede ser distinto de la onda solicitada.

### Android físico — compartir

| Caso | Observación | Resultado de JS |
| --- | --- | --- |
| Hoja del sistema en español | texto completo leído del árbol de la hoja: `Mira Magnesium Glycinate Softgels en HerbStore: herbstore://product/product-261009-002` | — |
| Hoja con la app en inglés | `Check out Magnesium Glycinate Softgels on HerbStore: herbstore://product/product-261009-002` | — |
| Cancelar con Atrás | vuelve al detalle, sin mensaje ni cambio | `outcome=shared` |
| Cancelar tocando fuera | igual | — |
| «Copiar» (destino inocuo) | vuelve al detalle, sin mensaje | `outcome=shared` |
| Resultado ausente (forzado) | mensaje «No se pudo compartir el producto. Inténtalo de nuevo.» y botón «Reintentar compartir» | `outcome=failed` (3 intentos) |

Android resuelve `sharedAction` en cuanto arranca el selector (código de `ShareModule` de RN 0.86), de modo que
cancelar y compartir producen el MISMO resultado de JS. No es un defecto: en ambos casos la pantalla queda
intacta y sin mensaje. El fallo no se puede provocar con la UI real: se forzó con un parche temporal que
sustituye `Share.share` por `Promise.resolve(undefined)` (el caso «resultado nativo ausente»), revertido y
comprobado con `diff` contra la copia buena. Con ese parche: tema oscuro correcto, objetivo de «Reintentar
compartir» 184 x 48 dp y, con `font_scale` 2.0, el mensaje se ve y el botón queda bajo la barra fija hasta
desplazar (alcanzable al desplazar, 333 x 58 dp). Idioma: se cambió con los botones de Fundamentos y se
restauró a español.

### iOS Simulator — compartir y carrito (sin Taptic)

| Caso | Observación | Resultado de JS |
| --- | --- | --- |
| Hoja en español | texto `Mira Magnesium … en H…` en la vista previa; el portapapeles tras «Copiar» contiene `Mira Magnesium Glycinate Softgels en HerbStore: herbstore://product/product-261009-002` | — |
| Hoja con la app en inglés | tras «Copiar», portapapeles `Check out Magnesium Glycinate Softgels on HerbStore: herbstore://product/product-261009-002` | — |
| Cancelar tocando fuera | hoja cerrada, sin mensaje | `outcome=cancelled` |
| «Copiar» | sin mensaje | `outcome=shared` |
| Resultado ausente (forzado igual que en Android) | mensaje y «Try sharing again»/«Reintentar compartir»; claro, oscuro y AX3 (a AX3 el botón queda bajo la barra fija hasta desplazar) | `outcome=failed` |
| Badge | etiquetas `Cart, 2 items` → 3 → 4 → 3 → 2 con 2 unidades de A y 1 de B, `+`, `−` y borrar B | — |

iOS distingue cancelar de compartir (`dismissedAction`/`sharedAction`); Android no (ver arriba): las dos formas
se registran por separado, sin afirmar que coincidan. La hoja de compartir no aparece en el árbol AX de `axe`
(vista remota): se manejó por coordenadas con capturas. El háptico en iOS NO se comprobó: el Simulator no tiene
Taptic Engine; solo consta que el flujo no se rompe y que la lógica solicita un impacto por mutación (tests).

### Confirmación del usuario

Tras la medición, el coordinador pidió al usuario tres pasos en el Samsung con respuesta táctil activa:
(1) abrir `product-261009-002` y pulsar «Agregar al carrito» una vez, esperando un pulso breve y suave y que
el badge suba; (2) en el carrito pulsar `+`, `−` y «Eliminar», esperando un pulso breve en cada uno (y que
`+` en el tope de stock NO vibre); (3) en el producto agotado `product-261009-001`, esperando que el botón
«Agotado» NO vibre. Respuestas literales, reportadas por el usuario **[U]** (leyenda de la sección de T6):

- [U] «Sí sentí el pulso en los tres pasos». Como el paso 3 esperaba AUSENCIA de pulso, la respuesta era
  ambigua; el coordinador la aclaró con una pregunta cerrada.
- [U] «No, en «Agotado» no vibró». Es decir, la respuesta anterior se refería a los pasos 1 y 2.

Por tanto el usuario **[U] confirma**: pulso sentido al agregar (paso 1) y en `+`, `−` y «Eliminar» del
carrito (paso 2); SIN pulso en «Agotado» (paso 3). Lo que el usuario NO reportó:

- Nada concreto sobre el tope de stock (que `+` no vibre al llegar al máximo): ese «0 impactos» sigue siendo
  SOLO la medida del agente **[A]** vía `dumpsys vibrator_manager` (arriba), no una confirmación táctil.
- Ningún ajuste de intensidad: no se pidió ni se reportó ninguno.

Las medidas **[A]** de la sección anterior siguen vigentes (1 impacto en agregar, doble toque, cantidad 2, otro
producto, `+`, `−`, «Eliminar» y tope 99; 0 en el selector de cantidad del detalle, «Agregar» con 99, `+` del
carrito con 99 y «Agotado»; `usage=TOUCH`, 50 ms, amplitud 0,1176). Con la confirmación **[U]** coinciden
para agregar, `+`, `−`, «Eliminar» y «Agotado»: lo solicitado al servicio de vibración y lo sentido por el
usuario van en el mismo sentido (hay pulso donde se midió un impacto y no lo hay en «Agotado»).

### Resultados por requisito

| Requisito | Medido por el agente | Queda para el usuario |
| --- | --- | --- |
| RF-22 | tests en cadena (reducers y thunk reales) + historial del `Vibrator` de Android con un impacto por mutación y ninguno por límite, agotado ni doble toque; badge = suma de unidades en Android e iOS | [U] confirmado en el Samsung: pulso al agregar y en `+`, `−`, «Eliminar»; sin pulso en «Agotado». No sentido por el usuario: tope de stock (solo [A]); carrito bloqueado hasta rehidratar solo por tests (no provocable) |
| RF-26 | texto en ES/EN con enlace literal (hoja de Android, portapapeles de iOS y tests); cancelación silenciosa; error con reintento y anuncio | oír el anuncio del error con TalkBack/VoiceOver (el error no se provoca con la UI real) |
| RF-27 | resultados de Android e iOS registrados por separado (arriba) | — |
| RF-32 | claves ES/EN en `parity.test.ts`; textos de la hoja y del error comprobados en los dos idiomas | — |
| RF-34 | claro/oscuro, `font_scale` 2.0 y AX3, movimiento reducido; offline y vacío no aplican a compartir | — |
| RNF-2 | el cambio del carrito termina antes de pedir el impacto (test: un impacto que nunca resuelve no bloquea) | — |
| RNF-3 | objetivos ≥ 48 dp / 44 pt, mensaje y botón con nombre/rol; confirmación visual sin háptico | — |
| RNF-4 | sin animación nueva; el mensaje de «Agregar» aparece completo con `animator_duration_scale` 0 | reduced motion en iOS no evidenciado (como en T4) |

### Hallazgos nuevos

- Bajo: a texto muy grande (Android 2.0, iOS AX3) el error de compartir y su botón caen parcialmente bajo la
  barra fija «Agregar»; se alcanzan al desplazar y el anuncio cubre a lector de pantalla. Mismo patrón que H-10/H-12.
- Informativo: la hoja del Samsung y la de iOS no muestran `dialogTitle`; no se pudo verificar dónde se usa.
- Informativo: el cierre `Atrás` de la hoja de Android se registra como compartido (limitación de RN 0.86).

### Limitaciones declaradas (no son fallos)

- **Háptico en iOS:** el Taptic Engine no existe en el Simulator y no hay iPhone físico; solo consta que el
  flujo no se rompe y que la lógica solicita un impacto por mutación (tests). Tampoco se comprobó reduced
  motion en iOS (el código lo respeta, como en T4).
- **Tope de stock:** el «sin pulso» al pulsar `+` con 99 unidades está medido solo por el agente **[A]**
  (historial del `Vibrator`); el usuario no lo reportó, así que no hay confirmación táctil de ese caso.
- **Intensidad:** el Samsung declara el vibrador sin control de amplitud y la intensidad TOUCH del sistema en
  BAJA, de modo que lo sentido puede diferir de lo solicitado (0,1176 durante 50 ms).
- **Lector de pantalla:** el anuncio único del error de compartir (`announceForAccessibility`) no se oyó con
  TalkBack ni VoiceOver reales; consta por código (`announceForAccessibility`), no por el oído.
- **`dialogTitle`:** ni la hoja del Samsung ni la de iOS lo muestran; no se verificó dónde se usa.
- **Error de compartir:** no se puede provocar con la UI real. Solo se vio con un parche temporal que
  sustituía `Share.share` por `Promise.resolve(undefined)`, ya revertido y comprobado con `diff`, más los
  tests de `createShareRunner`/`classifyShareResult`.
- **Carrito bloqueado hasta rehidratar:** solo por tests (no provocable en el dispositivo).
- **Cancelar en Android:** `Share.share` resuelve `sharedAction` al lanzar el selector, así que cancelar y
  compartir son indistinguibles (iOS sí devuelve `dismissedAction`).
- **Registro de depuración:** el log `[share] outcome=…` solo existe con `__DEV__`.

### Seguimiento para el Día 6 / auditoría

- Con texto muy grande (Android `font_scale` 2.0, iOS AX3) el error de compartir y «Reintentar compartir»
  caen parcialmente bajo la barra fija «Agregar»; se alcanzan al desplazar y el anuncio cubre a lector de
  pantalla. Mismo patrón que H-10/H-12 de la auditoría.

### Verificación

Vuelta de implementación: `npx expo lint` (0 avisos tras corregir uno de `array-type` en un test nuevo),
`npx tsc --noEmit`, `npm run test:logic` **957/957** (930 + 27 nuevos), dirigidos de feedback, compartir,
carrito y preferencias **197/197**, `git diff --check` limpio. `package.json`, `app.json`,
`package-lock.json` y `eas.json` no se tocaron en esa vuelta: no se ejecutaron `expo install --check` ni Doctor.

Cierre documental (esta vuelta, solo documentos): `npx expo lint` y `npx tsc --noEmit` sin salida de error,
`npm run test:logic` **957/957**, dirigidos **197/197** (archivos `*.test.ts` de `src/features/feedback`,
`product-share*` de `src/features/product/logic`, `src/features/cart` y `src/features/preferences`),
`git diff --check` limpio. `package.json`, `app.json` y `package-lock.json` sin cambios respecto al inicio de
la llamada (mismo hash SHA-1 antes y después). No se tocó código de producto ni se ejecutaron Expo Doctor
ni `expo install --check` porque no cambiaron dependencias ni configuración.

### Estado

**T7 marcada** en `specs/005-dia-5-nativo-plataforma/tasks.md` (2026-10-14): lógica y medida del agente
completas, confirmación táctil del usuario recibida en agregar, `+`, `−`, «Eliminar» y sin pulso en
«Agotado», con las limitaciones de arriba. En esta vuelta no se tocó el teléfono ni el simulador: el entorno
queda como lo dejó la vuelta de implementación (carrito vacío en ambos, `font_scale` 1.0, tema claro, español,
`animator_duration_scale` 1, flags AX de iOS en 0) y `stay_on_while_plugged_in` sigue en 3 en el Samsung
(decisión pendiente del usuario). No se avanzó a T8 ni se creó commit: el Día 5 no está cerrado (faltan T8 y
T10).

## T8 — Permisos, persistencia, scheduling, retry y navegación de notificación — 2026-10-14

> **Sección histórica, superada por «Estado vigente» (arriba) y por «T8 — pase iOS único — 2026-10-15».** No describe el estado actual; se conserva solo como registro fechado.
> Rótulo: todas las celdas «iOS: no validado…» de esta sección (scheduling/cancelación, inglés, oscuro, texto ampliado, accesibilidad, reduced motion) se resolvieron en el pase iOS único del 2026-10-15; las limitaciones que sobreviven están en «Criterios y límites» de esa sección.

Alcance: RF-23, RF-24, RF-25, RF-32, RF-33, RF-34, RNF-1–RNF-4. Había una implementación previa sin cerrar
(clasificador, coordinador in-flight, estado por orden, listener, hook de respuesta). Esta vuelta la audita
contra el «Hecho cuando», completa los huecos con tests primero y la mide en el Samsung (SM-A037M, Android 13,
Development Build debug, JS recargado por Metro, sin recompilar) y en el iOS Simulator (iPhone 17 Pro, iOS 26.5).
Leyenda como en T6/T7: **[A]** medido por el agente, **[U]** reportado por el usuario, **[T]** test determinista.
No se tocaron `package.json`, `app.json`, `package-lock.json` ni `eas.json` (mismo SHA-1 antes y después). Datos de
prueba evidentemente ficticios (no se copian aquí); ids de orden, SSID y contenido del panel de notificaciones del
teléfono NO se registran.

### Auditoría previa: qué cumplía y qué faltaba

| Pieza | Estado al empezar | Hueco (y cómo se midió) |
| --- | --- | --- |
| `order-notification-state.ts`, slice, `persist-policy` (`PERSISTED_KEYS`, `migrate`, saneado de ids fantasma) | correcto y con tests | sin test de ida y vuelta por la tubería real de redux-persist |
| Coordinador in-flight por order id | correcto (registra la solicitud antes de invocar al sistema, marca solo tras éxito) | ningún test con el slice real ni con reinicio |
| Clasificador de permisos | solo recibía estados ya normalizados | **nunca recibía lo que devuelve expo-notifications**: en Android 13+ una instalación nueva llega como `denied` + `canAskAgain` (el módulo Kotlin responde `DENIED` si `areNotificationsEnabled()` es falso), de modo que el diálogo no se pedía nunca; en iOS `provisional`/`ephemeral` llegan como `undetermined` (solo `ios.status` los distingue) y se habrían vuelto a pedir; `hasRuntimePrompt` era «Android siempre» aunque la API < 33 no tiene diálogo |
| Presentación en primer plano | no existía `setNotificationHandler` | **la notificación inmediata no se muestra con la app abierta** (la SDK: «el comportamiento por defecto sin handler es no mostrarla»); la confirmación ocurre justo con la app abierta. Medido con un A/B (abajo) |
| Canal Android | creado como `orders`, nombre fijo «Orders» | con `trigger: null` Android usa el canal de reserva del SDK (HIGH, «Miscellaneous»), no `orders`; nombre del canal fuera de i18n |
| Texto de la notificación | diccionario propio en `notification-payload.ts` | fuera de `es.ts`/`en.ts`: `parity.test.ts` no lo cubría |
| Listener `order-notification-listener.ts` | sin tests; importaba RN y `@/` | no probable en Node; un reintento para una orden inexistente creaba un registro fantasma |
| `PERSIST_VERSION` 1 → 2 | subido, pero `sanitizePersistedState` reinicia TODOS los slices ante otra versión | **un teléfono con el build del Día 4 perdía carrito, historial de búsqueda, intento de checkout (la clave de idempotencia de una orden sin resolver) y órdenes**; el plan pedía subir la versión Y conservarlos |
| Navegación al tocar | `router.dismissTo('/')` | **no hace nada con otra pestaña enfocada** (medido: `decision=navigate` y la pantalla de confirmación del Carrito no cambia); `getLastNotificationResponseAsync` está obsoleta en SDK 57 |
| `OrderConfirmationScreen` | aviso, Ajustes y reintento | sin scroll: con texto 2.0 «Volver al carrito» queda bajo la barra de pestañas |

### Cambios (tests primero; cada uno falló antes por la razón esperada)

- `logic/notification-permission.ts` (+test, 10 casos nuevos): `toPermissionInput` mapea la respuesta real del SDK
  (Android: `granted`, `canAskAgain`, API ≥ 33 → diálogo; iOS: `ios.status` 0–4). `denied` + `canAskAgain` pide en Android
  con diálogo; `granted` del permiso con avisos apagados abre Ajustes y no pide; un estado desconocido nunca pide ni es
  utilizable. Rojo: export `toPermissionInput` inexistente.
- `logic/schedule-order-notification.ts` (+test, 9 casos, NUEVO): la secuencia pasa del borde nativo a lógica con un
  `OrderNotificationPort`: canal ANTES de leer/pedir permiso, pedir como máximo una vez por orden, orden ya con solicitud =
  `unusable` con Ajustes, fallo = resultado `failed` (nunca lanza). `native/order-notifications.ts` queda como adaptador
  de 40 líneas: `setNotificationHandler` (banner + lista, sin sonido ni badge) y `trigger: { channelId: 'orders' }` en Android.
- `logic/notification-payload.ts` (+test): título, cuerpo y nombre de canal salen de `es.ts`/`en.ts`
  (`notifications.orderConfirmed.*`, `notifications.channelName`), protegidos por `parity.test.ts`.
- `store/create-order-notification-listener.ts` (+test con slice real, 11 casos, NUEVO): una vez por orden, solicitud
  registrada ANTES de invocar al sistema, respuesta idempotente que repite una orden NO reintenta (ni una fallida), reintento
  solo explícito, reintentos concurrentes comparten una operación, planificador que rechaza o lanza síncrono queda
  absorbido, reintento de una orden fuera del historial no hace nada, y «reinicio» = tienda y listener nuevos sobre el
  historial restaurado. `order-notification-listener.ts` queda como cableado (idioma activo + native).
- `core/storage/order-notification-persistence.test.ts` (NUEVO, 5 casos): tubería real de redux-persist con el slice y
  el listener reales: marcas tras reiniciar, la solicitud ya está en disco mientras el diálogo sigue abierto, fallo que se
  reintenta tras reiniciar, registro fantasma descartado y «borrar datos» que olvida las marcas.
- `core/storage/persist-policy.ts` (+3 tests): `READABLE_PREVIOUS_VERSIONS = [1]`; una actualización desde el build del Día 4
  conserva carrito, búsqueda, intento y órdenes (notificaciones vacías); cualquier otra versión sigue reiniciando.
- `logic/go-home.ts` (+test, NUEVO) y `hooks/use-notification-response-navigation.ts`: `goHome` = `dismissTo('/')`,
  `navigate('/')`, `dismissTo('/')`; lectura sincrónica `getLastNotificationResponse()`; log `__DEV__`
  `[notifications] tap source=initial|active decision=…` (sin id ni datos).
- `OrderConfirmationScreen.tsx`: contenido dentro de un `ScrollView`.

Verificación de los tests por mutación (cada mutante rompe al menos un test): quitar la guarda de orden fantasma, registrar
la solicitud DESPUÉS del sistema, crear el canal tras leer el permiso, que `denied` no pida en Android, que iOS `denied`
pida, que la versión 1 sea ilegible, que el saneado conserve fantasmas, que `scheduled` no marque, y alterar el orden de
`goHome`. Dos mutantes sobrevivieron al primer intento (una respuesta idempotente sobre una orden fallida; iOS `denied`
con `canAskAgain`) y se añadieron los tests que los matan.

Decisiones (alternativa elegida, trade-off, descartada):
1. Mapeo del SDK dentro de la lógica (elegida) frente a normalizar en `native/` (descartada: no se podría probar la
   matriz en Node). Trade-off: la lógica conoce la forma de `NotificationPermissionsStatus`.
2. `setNotificationHandler` global a nivel de módulo (elegida) frente a decidir por notificación. Trade-off: toda
   notificación en primer plano se muestra (solo hay esta). Descartada: no tener handler (A/B abajo).
3. `trigger: { channelId }` solo en Android (elegida) frente a `trigger: null` (descartada: usa el canal de reserva).
4. Subir `PERSIST_VERSION` y leer la versión 1 (elegida, es lo que pide el plan) frente a no subirla (descartada por el
   plan) y frente a reiniciar todo (descartada: perdería la clave de idempotencia de una orden sin resolver).
5. `goHome` en tres pasos (elegida, medida) frente a `dismissTo` solo (no hace nada entre pestañas), `navigate` solo
   (deja un `index` duplicado en Inicio y un segundo `(tabs)` sobre el escáner) y `reset` del estado (borraría el estado
   de las demás pestañas). Trade-off: depende del orden en que expo-router aplica acciones encoladas.

### Android físico — Samsung SM-A037M, Android 13, targetSdk 36 [A]

Estado inicial: `POST_NOTIFICATIONS granted=false`, carrito e historial vacíos. Orden de checkout real por la UI
(producto con stock → Carrito → Checkout → «Continuar» → «Consultar estado»; teclado por `adb shell input keyevent`, uno
por llamada, que no pierde caracteres). El campo opcional «Número interior» se rellenó siempre (hallazgo H-T8-1).

| Caso (orden real) | Observación | Medida |
| --- | --- | --- |
| 1.ª orden confirmada, permiso sin pedir | aparece el diálogo de Android 13 («¿Permitir que HerbStore te envíe notificaciones?»); la pantalla muestra «Programando…» con el botón deshabilitado y no se bloquea | captura; permiso `granted=false` hasta responder |
| Mismo momento, MMKV | `permissionRequested: true, notified: false, status: scheduling` YA estaba en disco con el diálogo abierto (orden 5; la 1.ª se respondió antes de poder leerlo) | snapshot MMKV tomado en cuanto `GrantPermissionsActivity` tuvo el foco, antes de pulsar |
| Respuesta «Permitir» (orden 1) | `notified: true, status: scheduled`; notificación publicada con la app EN PRIMER PLANO. El diálogo se cerró a las 17:06:20 sin que el agente emitiera ningún toque: lo pulsó, presumiblemente, la persona que tenía el teléfono (no es un [U] confirmado) | `dumpsys notification --noredact` |
| Contenido publicado | `android.title=Pedido confirmado`, `android.text=Tu compra se completó.`, canal `orders` (nombre «Pedidos», importancia 3), `contentIntent` = `startActivity`, payload `{"destination":"home"}` en la solicitud serializada. 0 apariciones del id de la orden ni de la dirección en todo el volcado; el `tag` es un UUID aleatorio del SDK distinto del id de la orden | volcado y decodificación de `expo.notification_request` |
| Inglés (orden 3, idioma por «Fundamentos») | `Order confirmed` / `Your purchase was completed.`; el canal se renombró a «Orders» (`setNotificationChannelAsync` actualiza el nombre) | `dumpsys` |
| Tap con la app activa, desde la confirmación del Carrito, ANTES del arreglo | `[notifications] tap source=active decision=navigate` y la pantalla NO cambió (`dismissTo` ignorado) | log + `uiautomator` |
| Mismo tap, con `goHome` | llega a Inicio sin flecha de retroceso; la notificación se descarta (autocancel) | log + `uiautomator` |
| Tap en arranque en frío | `pidof` vacío tras `keyevent HOME` + `am kill`, notificación todavía publicada; al tocarla arranca el proceso, el dev client carga el bundle y el log dice `tap source=initial decision=navigate` y la app queda en Inicio | log + `uiautomator`. Inicio es también el destino de un arranque normal: lo que prueba el log es que la respuesta inicial se leyó y consumió una vez |
| Reinicio de la app | marcas de las 4 órdenes iguales antes y después (`cmp` del archivo MMKV idéntico), 0 notificaciones nuevas, ningún diálogo | `am kill` + relanzar |
| 2.ª orden, permiso ya concedido | se registra `permissionRequested: true` aunque no haya diálogo, se programa y se marca | MMKV |
| Permiso revocado (`pm revoke`), orden 5 | aparece el diálogo; «No permitir» (por `adb`) → `unusable`, `canOpenSettings: true`; mensaje «Las notificaciones están bloqueadas. Puedes habilitarlas en Ajustes.», botones «Abrir ajustes de notificaciones», «Reintentar notificación» y «Volver al carrito» (la orden no se bloquea) | captura, MMKV, `uiautomator` |
| «Reintentar» con el permiso aún denegado | sin diálogo nuevo, mismo estado | foco de ventana + MMKV |
| «Abrir ajustes» → Ajustes de la app → «Permitir notificaciones» (UI real de Ajustes) → «Reintentar» | programa SIN diálogo (`requestPermission: false`), `notified: true`, notificación publicada | `dumpsys package`, MMKV, `dumpsys notification` |
| Permiso bloqueado por el sistema (`pm revoke` tras el paso anterior; la bandera pasó a USER_FIXED), orden 8 | NO aparece diálogo y aun así queda `permissionRequested: true` en la orden; `unusable` + Ajustes | vigilante de foco 60 s + MMKV |
| A/B sin `setNotificationHandler` (parche temporal, revertido y comprobado con `diff`), orden 6 | la orden se programa y se marca (`notified: true`) pero 0 notificaciones publicadas con la app abierta; con el handler restaurado, orden 7: 1 publicada | `dumpsys notification` |
| Tema oscuro y `font_scale` 2.0, estado `unusable` | texto legible sin recortes; botones de 48 dp a 1.0 (90 px a 300 dpi) y crecen con el texto; con 2.0 «Volver al carrito» quedaba bajo la barra y, tras el `ScrollView`, se alcanza al desplazar (108 px). Cambiar `font_scale` con la app abierta devuelve a Inicio (patrón conocido) | capturas + `uiautomator` |
| «Cero PII» | `strings` del archivo MMKV, que contiene también los bytes sobrantes: 0 coincidencias de `fullName`, `phone`, `postalCode`, `street`, `exteriorNumber`, `interiorNumber`, `city`, `address`, `shippingAddress`; los slices solo llevan claves de pedido (id, importes, líneas) y las cuatro de la marca; log de JS: 0 UUID y 0 datos de dirección | MMKV + logcat |

Variante Android «sin diálogo runtime» (API < 33, `hasRuntimePrompt=false`): **no validada realmente en dispositivo**; la cubre
determinísticamente `notification-permission.test.ts` («Android below 13…», «the runtime dialog starts at API 33») y
`schedule-order-notification.test.ts` («Android without the runtime dialog…»). El Samsung representa la variante CON diálogo.

### iOS Simulator — iPhone 17 Pro, iOS 26.5 [A]

| Caso | Observación |
| --- | --- |
| 1.ª orden confirmada | alerta del sistema «HerbStore quiere enviarte notificaciones» («Permitir»/«No permitir»); con ella abierta el MMKV ya tenía `permissionRequested: true, notified: false, status: scheduling` |
| «Permitir» | banner en primer plano «Pedido confirmado / Tu compra se completó.» (sin id ni dirección), orden marcada |
| 2.ª orden (ya autorizado) | sin alerta; banner; al tocar el banner con la app activa: `tap source=active decision=navigate` y llega a Inicio desde la confirmación del Carrito |
| Reinicio (terminar y relanzar) | las 2 órdenes siguen marcadas, sin alertas ni notificaciones nuevas |
| Tap en arranque en frío | el log de Metro registra `tap source=initial decision=navigate`; la app termina en Inicio sin flecha | log de Metro, línea 13698 |
| «Cero PII» | 0 coincidencias de los nombres de campo de dirección en el MMKV (`Documents/mmkv/herbstore.persist`) ni UUID en el log |
| Scheduling/cancelación durante la espera | **No validado por separado en iOS.** No se observó una comprobación manual iOS del estado «Programando…» con cancelación/volver durante scheduling; la única observación disponible es la constancia `status: scheduling` antes de la alerta |
| Accesibilidad de la superficie | **No validada por separado en iOS.** No se observó una inspección manual del rol, estado, nombre, foco ni target mínimo de 44 pt de los controles, ni escucha con VoiceOver |

El tap en arranque en frío queda confirmado por el log de Metro: `LOG [notifications] tap source=initial decision=navigate`
(línea 13698), y la app terminó en Inicio sin flecha. La evidencia distingue así el arranque en frío de un tap con la app
activa, aunque los toques sintéticos sobre la notificación de la pantalla de bloqueo/Centro de notificaciones fueron inertes
en este entorno. No comprobado en el Simulator: (1) estado denegado (`simctl privacy` no cubre notificaciones y no se
reinició el Simulator); (2) `provisional`/`ephemeral`
(solo en tests); (4) inglés, tema oscuro y texto grande de la notificación; (5) VoiceOver. No se usó `simctl push` para
fabricar eventos.

### Resultados por requisito

| Requisito | Medido por el agente | Tests | Queda |
| --- | --- | --- | --- |
| RF-23 solicitud única por orden, constancia aunque no haya diálogo, estados no utilizables con Ajustes | Android: diálogo en la 1.ª orden, constancia en disco con el diálogo abierto, constancia sin diálogo (permiso bloqueado) y con permiso ya concedido, Ajustes real y reintento sin pedir; iOS: alerta en la 1.ª orden y constancia previa | matriz Android con/sin diálogo e iOS 0–4, una solicitud por orden tras reinicio, saneado | iOS denegado y provisional solo por tests |
| RF-24 contenido localizado sin datos y tap a Inicio frío/activo | Android ES/EN sin id ni dirección (`dumpsys`), tap activo y frío; iOS contenido, tap activo y log de tap frío | contenido cerrado en ES/EN, `goHome`, deduplicador | — |
| RF-25 marca solo tras éxito, fallo = aviso + reintento, sin reprogramar | Android: marcas persistentes tras reiniciar, reintento tras Ajustes marca, ninguna segunda notificación | fallo no marcado, retry marca, tercer disparo no reprograma, idempotente no reintenta, in-flight | fallo de scheduling real no provocable con la UI (solo tests) |
| RF-32 ES/EN | notificación y canal en ES y EN en el Samsung | `parity.test.ts` cubre título, cuerpo y canal | **iOS: no validado visualmente en inglés.** No se observó en iOS el contenido localizado de la notificación |
| RF-33 Android real + variante determinista + iOS soportado | arriba | variante sin diálogo rotulada | — |
| RF-34 | oscuro y texto 2.0 en `unusable` (Android) | — | **iOS: no validado visualmente en tema oscuro ni texto ampliado.** Vacío y offline no aplican a esta superficie; movimiento reducido queda pendiente por plataforma |
| RNF-1 | 0 PII en MMKV, logs y notificación | cero id/dirección en el contenido | — |
| RNF-2 | Android: «Programando…» con el diálogo abierto y «Volver al carrito» activo | — | **iOS: no validado por separado** durante scheduling/cancelación |
| RNF-3 | Android: controles observados con rol/nombre y target de 48 dp; el aviso es texto con región viva | — | **iOS: no validado por separado** (rol, estado, foco, target de 44 pt y superficie de notificaciones); anuncio con TalkBack/VoiceOver real no oído |
| RNF-4 | No se añadió animación específica a la superficie | — | **No comprobado por separado en Android ni iOS** con movimiento reducido; no se atribuye validación manual |

### Hallazgos

- **H-T8-1 (Alta, Día 4, CORREGIDO 2026-10-14: ver «H-T8-1 corregido»):** con «Número interior» vacío el checkout nunca llega al servidor: el esquema deja
  `interiorNumber: undefined` y `canonical-order-request.ts` (`trimAddress`) llama `value.trim()` sobre `undefined`
  (`TypeError: Cannot read properties of undefined (reading 'trim')`, reproducido en Node y en el Samsung). Probablemente es
  la causa de «el formulario no se pudo completar» del cierre del Día 4. Fuera del alcance de T8; para validar se rellenó siempre
  el campo opcional. Arreglo mínimo propuesto: ignorar valores `undefined` en `trimAddress` (+ test).
- **H-T8-2 (Media, Día 2/4, no tocado):** «Ir a Inicio» del carrito vacío (`CartScreen`, `router.dismissTo('/')`) no hace nada
  desde la pestaña Carrito por la misma causa que el tap de la notificación (POP_TO no lo entiende el Tabs); medido en el
  Samsung. `NotFoundScreen` y `CategoryProductsScreen` lo usan desde un stack, donde sí funciona.
- **H-T8-3 (Baja, Día 4):** `OrderStatusScreen` llama `router.replace(...)` durante el render
  («Cannot update a component while rendering…»): toast rojo de LogBox en desarrollo que cubre la pestaña Carrito y
  desvió varios toques de la validación.
- **H-T8-4 (Baja):** el texto «Las notificaciones están bloqueadas» también se muestra tras una primera denegación (aún
  no bloqueada por el sistema) porque Ajustes se ofrece siempre que el diálogo no puede resolver la orden.
- **H-T8-5 (Informativa):** el idioma de la app no se persiste (se reinicia al del sistema al recargar); la prueba en
  inglés exigió cambiarlo justo antes de cada orden.
  - *Estado vigente (2026-10-15): comportamiento por diseño.* Ver la conciliación en «Cierre documental de T8 › Hallazgos
    y seguimiento».

### H-T8-1 corregido — 2026-10-14

Alcance cerrado y aprobado por el usuario: solo `trimAddress`. Sin cambios en esquema, contrato, formulario, UI,
dependencias ni configuración. Leyenda: **[A]** medido por el agente, **[T]** test determinista.

- **Causa [T].** El esquema (`optionalTrimmed`) deja `interiorNumber: undefined` con la clave presente;
  `trimAddress` (`canonical-order-request.ts`) hacía `value.trim()` sobre cada valor de `Object.entries(address)` y lanzaba
  `TypeError: Cannot read properties of undefined (reading 'trim')` dentro de `submitOrder`, antes de calcular la huella y de
  enviar el POST. El contrato declara `interiorNumber?: string` y el mock acepta la clave ausente
  (`mock-server/src/orders/order-contract.js`), así que el defecto era solo del cliente.
- **Test que falló primero [T].** `canonical-order-request.test.ts` pasó de 2 a 12 tests. Antes del arreglo fallaron 6 con el
  `TypeError` esperado (clave presente con `undefined`; el resto de campos recortados con ese caso; campo `undefined` ignorado;
  serialización idéntica para ausente/`undefined`/`''`/`'  '`; canonicalizar dos veces; salida real del esquema con interior
  vacío hasta el cuerpo del POST) y 6 pasaron como guardia (ausente, `''`/espacios/tabulaciones, interior relleno recortado y
  byte a byte igual al formato previo, salida del esquema con interior relleno, los dos tests que ya existían).
- **Arreglo.** Una línea en `trimAddress`: `if (value === undefined) continue;` antes del `trim()`. La regla previa de omitir
  `interiorNumber` vacío se conserva. Un campo obligatorio `undefined` también se omite en lugar de lanzar: el servidor lo
  rechaza con 400 (decisión explícita, con test).
- **Auditoría acotada.** `buildCheckoutRequest` solo copia con `spread`; `serializeCanonicalOrder`/`sorted` no tocan strings
  (y `JSON.stringify` descarta `undefined`); `createFingerprint` no recorta; `submitOrder` y `checkOrderStatus` no operan sobre
  la dirección. Los únicos otros `trim()` de la ruta son `item.productId.trim()` (el carrito solo admite `productId` cadena no
  vacía, validado en `cart.ts`) y `request.currency.trim()` (viene tipada de `selectPreferredCurrency`). No hay otro `trim()`
  riesgoso en `src/features/checkout/`.
- **Verificación [T].** `npx expo lint` sin avisos; `npx tsc --noEmit` sin errores; `npm run test:logic` **1013/1013** (1003 + 10
  nuevos); `git diff --check` limpio. No se ejecutaron `expo install --check` ni Doctor (no cambian dependencias ni configuración).
- **Samsung SM-A037M (Android 13) [A].** Orden real por la UI con «Número interior» sin tocar y datos ficticios (no se
  registran): log `[api] POST /orders -> ok` y `[orders] POST /orders -> 202 pending`, luego «Consultar estado» →
  `GET /orders/status/… -> ok` y pantalla «Pedido confirmado» («Las notificaciones están bloqueadas…», sin diálogo, como
  esperaba el estado del permiso). El stock del producto en el mock bajó 88 → 87.
- **iOS Simulator (iPhone 17 Pro, iOS 26.5) [A].** Misma orden con el campo sin tocar: «Pedido en proceso» →
  «Consultar estado» → «Pedido confirmado», con el banner «Pedido confirmado / Tu compra se completó.» (permiso ya concedido).
  Stock del mock 87 → 86. Antes, un envío con «Número exterior» vacío mostró «El número exterior es obligatorio.» y no hizo POST
  (comprobación fortuita de la validación).
- **Límites.** (1) La prueba de dispositivo ejercita solo el caso «interior sin tocar» (`undefined`); `''` y espacios los cubren
  los tests, y el esquema convierte `''` en `undefined` de todos modos. (2) «El mock lo recibió» se acredita por el 202/200 de
  la respuesta y por el descenso del stock; el cuerpo exacto enviado no se inspeccionó en el servidor (sin registro de
  cuerpos). (3) iOS Simulator: `axe type` no escribió en «Número exterior» ni «Número interior» (campos en la parte baja de la
  pantalla) con el teclado de hardware, pero sí en los demás; el campo se rellenó pulsando teclas del teclado en pantalla
  (`AutomaticMinimizationEnabled=false`, relanzar la app y enfocar ese campo ANTES de usar `axe type`; se quedó escrito «as»).
  Es una limitación de la herramienta, no se comprobó que sea un defecto de la app; encaja con «el formulario no se pudo
  completar» del cierre del Día 4. (4) Quedan abiertos, sin tocar, H-T8-2 a H-T8-5.
- **Entorno.** Samsung: `font_scale` 1.0, tema claro, español, `stay_on_while_plugged_in` 3, permiso de notificaciones
  bloqueado (sin cambios), carrito vacío, en Inicio; ahora el historial tiene una orden más con aviso `unusable`. iOS: carrito
  vacío, en Inicio, apariencia clara, texto `large`, `AutomaticMinimizationEnabled` restaurado a 1 y flags AX en 0; el Centro de
  Notificaciones conserva el aviso de esta orden (conviene limpiarlo antes de la comprobación en frío). Metro (8081) y el mock
  (3001) siguen vivos; túneles `adb reverse` 8081 y 3001 activos. No se borraron datos de la app ni se recompiló.

### Entorno y verificación

`npx expo lint` sin avisos, `npx tsc --noEmit` sin errores, `npm run test:logic` **1003/1003** (957 + 46 nuevos),
dirigidos (notificaciones, órdenes, persistencia, i18n) **118/118**, `git diff --check` limpio, SHA-1 de `package.json`,
`app.json`, `package-lock.json` y `eas.json` sin cambios (no se ejecutaron `expo install --check` ni Doctor porque no
cambian dependencias ni configuración). El material temporal (arnés de enrutador `t8nav` en `linking.ts` y el hook, parche
del handler) se revirtió y se comprobó con `diff`; `grep` de `TEMP-T8` en `src/` da 0. Acciones sobre el teléfono: dos
`pm revoke` (el permiso queda revocado al final, como estaba al empezar) y un cambio real en Ajustes de la app; se paró con `am force-stop` la app «Clima» de Samsung (no es de
HerbStore) porque un aviso suyo robó el foco; su diálogo de ubicación no se respondió.

### Estado

**T8 NO marcada.** El tap en arranque en frío de iOS queda confirmado por el log de Metro y el reinicio real del Samsung queda
acreditado en la sección siguiente. Permanecen abiertos H-T8-2, H-T8-3, H-T8-4 y H-T8-5, que se revisarán con el usuario antes
de marcar T8. No se avanzó a T10 ni se creó commit.

### Reinicio del dispositivo (Samsung) — 2026-10-14

> **Sección histórica, superada por «Estado vigente» (arriba) y por «T8 — pase iOS único — 2026-10-15».** No describe el estado actual; se conserva solo como registro fechado.
> Rótulo: «T8 NO marcada» describe el 2026-10-14; T8 se cerró el 2026-10-15.

Añadido después de «Estado»: lo que ahí figura como «opcionalmente, reinicio del teléfono» queda medido aquí. Cubre la parte
de RF-25 que la fila «Reinicio de la app» no probaba: la deduplicación «tras reinicios de aplicación y dispositivo».
Samsung SM-A037M, Android 13, Development Build debug, JS servido por Metro por el túnel USB (`adb reverse` 8081 y 3001), sin
recompilar. Leyenda: **[A]** medido por el agente en solo lectura (no tocó la pantalla ni abrió o cerró la app; no envió
toques ni teclas), **[U]** hecho por el usuario, **[I]** inferencia del agente. Teléfono y Mac comparten zona horaria (CST,
−0600): las horas son las del log.

**Una línea honesta.** Un primer intento se descartó porque el teléfono no se había reiniciado (uptime de 24 d 20 h, arranque
el 2026-09-19); esas medidas solo se conservan como línea base («antes»).

**Método.**
1. [A] «Antes» (18:52): uptime, `btime` y motivos de arranque; túneles; permiso y notificaciones publicadas por el paquete;
   SHA-256 de `files/mmkv/herbstore.persist` y `.crc` calculados EN el teléfono con `run-as` (el archivo no se copia al Mac);
   captura de `logcat` filtrada (ReactNativeJS, el paquete, NotificationService/Manager, AndroidRuntime y ciclo de vida del
   proceso) que sobrevive al reinicio.
2. [U] Reinició el teléfono y, cuando se le avisó, abrió HerbStore desde el icono; dice que no tocó nada más. El log no
   muestra otra interacción (solo el autoavance del banner de Inicio).
3. [A] Tras el reinicio: nueva medición (¿reinició de verdad?), restauración de los túneles que el reinicio borró y un
   marcador en el log (19:03:42, «app NOT yet opened») para separar la fase de apertura.
4. [A] Tras el «listo»: lectura del log desde el marcador, `dumpsys` (notification, alarm, jobscheduler, window, activity),
   captura de pantalla (fuera del repo), tres lecturas de hashes y análisis del MMKV dentro del teléfono mostrando solo
   conteos, booleanos y hashes (ningún id, dirección ni valor crudo salió del dispositivo). Al final se detuvo la captura.

**Reinicio real [A]** (condición de validez del test):

| Medida | Antes (18:52) | Después |
| --- | --- | --- |
| `btime` | 2026-09-19 21:58:03 | 2026-10-14 18:55:30 (igual a las 19:34: mismo arranque) |
| Uptime | 24 d 20 h 51 min | 5 min 29 s a las 19:00:59; 38 min 47 s a las 19:34 |
| Motivos de arranque (más reciente primero) | `reboot,lpm`… | `reboot,userrequested`, luego los `reboot,lpm` anteriores |
| `adb reverse --list` | 8081 y 3001 | vacío (lo borró el reinicio); restaurados antes del marcador |

**Matiz: el proceso no estaba totalmente frío [A].** A las 19:01:30.884 el sistema arrancó el proceso de la app (pid 9161) por
`BOOT_COMPLETED`, con un broadcast a `expo.modules.notifications.service.NotificationsService` (receptor que declara
expo-notifications). Cargó `MainApplication`, `libreactnative` y Nitro MMKV; no ejecutó JS (0 líneas `ReactNativeJS`), no
escribió (hashes sin cambio hasta la apertura), no publicó ninguna notificación y no programó alarmas ni trabajos. No se
forzó su parada: habría sido una intervención fuera de alcance. Por eso el toque en el icono no creó un proceso nuevo: la
`MainActivity` y el JS arrancaron dentro del proceso ya existente (`am_app_transition … WARM`). La prueba demuestra que el
receptor de arranque no re-dispara nada y que rehidratar tras el reinicio no re-notifica; no es «proceso muerto + fork nuevo al
tocar» (ese caso frío se probó antes con `am kill`).

**Resultados por punto [A]** (desde el marcador de las 19:03:42; el log capturado llega a las 19:33:38, 760 líneas):

| # | Qué se comprobó | Valor medido |
| --- | --- | --- |
| 1 | Apertura real | 19:21:43.823 `ActivityTaskManager: START … cat=LAUNCHER cmp=com.herbstore.mobile/.MainActivity` iniciado por el launcher de Samsung, 18,0 min después del marcador; `wm_create_activity` 19:21:43.896. A 19:21:44.906 el Development Build (UID de la app) relanza la `MainActivity` con `CLEAR_TASK` (`wm_finish_activity … clear-task-all`, segundo `wm_create_activity` 19:21:44.965): es el patrón del dev client que carga la app desde Metro. `Displayed +1s28ms` y `+2s298ms`; `am_app_transition … WARM(8)`. `ReactNativeJS: Running "main" … "fabric":true` 19:21:55.933 (+12,1 s tras el toque). La última línea `Android Bundled 67ms …/expo-router/entry.js` del log de Metro (sin hora; es la 34.ª de la sesión de Metro y la única tras los logs de la sesión anterior) va justo antes de los logs JS de esta sesión (el `logcat` filtrado no incluye la descarga; en un build debug el JS sale de Metro). Línea de tiempo desde el toque: MMKV abierto +16,6 s; `[deep-link] initial=true -> redirected` +17,8 s; `[api] GET /home -> ok` +20,5 s (también prueba que el mock responde por el túnel tras el reinicio). Proceso: **pid 9161, el mismo del arranque**, porque Android lo reutilizó (0 `am_proc_start` desde el marcador). |
| 2 | Sin notificaciones nuevas | `dumpsys notification --noredact` (19:23 y 19:34): **0** del paquete (6 registros del sistema, ninguno suyo; archivo 0; `cmd notification list` 0). Líneas `NotificationService`/`NotificationManager` desde el marcador: 33, **0** nombran el paquete (son de `LocationManagerService` y del servicio de actualizaciones de Samsung); 0 líneas de expo-notifications. `dumpsys alarm`: 0 entradas del paquete. `jobscheduler`: 0 trabajos de su UID (`JOB #u0a286`: 0; solo el temporizador interno de app en primer plano). |
| 3 | Sin diálogo de permiso | 0 líneas `GrantPermissionsActivity`/`permissioncontroller`/`requestPermissions` desde el marcador; las únicas dos `START` del paquete son las de `MainActivity`. Ventana con foco a las 19:23 y 19:34: `com.herbstore.mobile/.MainActivity`; `dumpsys window` sin ventana de permisos. `POST_NOTIFICATIONS granted=false` con las mismas banderas (`USER_SET\|USER_FIXED`…), appop `ignore`, importancia `NONE`: idéntico a la línea base. El proceso `permissioncontroller` existe, pero lo arrancó el sistema a las 19:01:41 durante el arranque (20 min antes de abrir) y no tiene ventana. Captura (en el scratchpad, no en el repo): Inicio sin diálogo; el engranaje flotante de la esquina superior derecha ya aparecía en capturas anteriores del Día 5. |
| 4 | Persistencia | Ver abajo: los hashes **difieren**, la app escribió al arrancar y el contenido medido es el esperado. |
| 5 | Sin errores | 0 `FATAL EXCEPTION`, 0 `am_crash`, 0 `am_anr`, 0 `am_proc_died`, 0 `am_kill` del paquete. 2 líneas `AndroidRuntime: VM exiting with result code 0` (19:05:21 y 19:07:27) de otros PID (8323 y 10601, salidas normales; no del 9161). 410 líneas `ReactNativeJS`, todas de nivel I: 407 `[BannerAutoplay]`, `Running "main"`, `[deep-link]` y `[api] GET /home -> ok`; 0 `[notifications]`, 0 `[net]`, 0 `[orders]`. **0** UUID y 0 coincidencias de campos de dirección, teléfono, correo o token en los logs de JS (y 0 UUID en cualquier línea que nombre el paquete). |
| 6 | Cierre del entorno | Captura de `logcat` detenida (proceso padre y su `adb logcat`; sin procesos restantes); túneles 8081 y 3001 activos; app en primer plano en Inicio; ajustes del teléfono sin tocar. |

**Persistencia (punto 4) [A], [I].** Hashes SHA-256 abreviados, tres lecturas estables a las 19:24 y otras tres a las 19:34:

| Archivo | Antes (mtime 18:28:32) | Después (mtime 19:22:01.692) |
| --- | --- | --- |
| `herbstore.persist` (4096 B) | `97c94d7f…b033` | `979d47ca…1480` |
| `herbstore.persist.crc` (4096 B) | `30b358fb…1525` | `12a651d5…2d76` |

- **Qué pasó [A].** Los archivos cambiaron: la última escritura es de las 19:22:01.692, 72 ms después de
  `[deep-link] initial=true`, 1,3 s después de que MMKV mapeara el archivo y 2,7 s antes del primer `GET /home`; es decir, la
  hizo el arranque de la app, no ninguna acción. No se observó ninguna escritura posterior en los 12 min siguientes en Inicio
  (mtime y hashes iguales a las 19:34). No se sabe si el arranque escribió una o varias veces, solo cuándo fue la última.
- **Causa probable [I].** Tras `REHYDRATE`, redux-persist 6.0.0 encola todas las claves de la lista blanca (`lastState` empieza
  vacío) y escribe `persist:root` una vez; el adaptador (`persist-storage.ts`) no compara antes de escribir y MMKV reescribe la
  entrada con un prefijo de 4 bytes que cambia en cada reescritura. Apoyo: dos snapshots locales de T8 con 17 s de diferencia,
  mismo tamaño y mismo contenido lógico difieren solo en los bytes 4–7 y tienen CRC distinto. Corolario: «hash idéntico» no es un
  criterio válido para «no escribió»; toda reescritura cambia el hash.
- **Integridad [A].** El CRC32 del área viva (3935 B) coincide con el del archivo `.crc` (`8e11b8a4`); hay una sola entrada
  `persist:root`.
- **Contenido, solo conteos y estructura, calculado en el teléfono [A].** 9 órdenes y 9 registros de notificación;
  `permissionRequested=true` en 9 de 9; `notified=true` en 7 (estado `scheduled`, `canOpenSettings=false`) y `notified=false` en 2
  (estado `unusable`, `canOpenSettings=true`); 0 registros en `scheduling`, `failed` o `idle`. Carrito vacío, historial de
  búsqueda vacío, intento de checkout en `idle`, `_persist` versión 2 con `rehydrated=true`. Coincide con T8: las órdenes 1–7
  programadas y las dos bloqueadas (la 8 y la de H-T8-1) sin marcar.
- **Comparación con el snapshot de las 17:50 de T8 (8 órdenes) [A].** SHA-256 por segmentos calculados en el teléfono (solo
  los hashes cruzaron al Mac): la cabecera JSON con las 8 primeras órdenes, los 8 primeros registros (con sus claves y marcas) y
  la cola `_persist` son idénticos byte a byte, y los 8 hashes por orden coinciden. Fuera de los segmentos comparados solo quedan el prefijo de 4 bytes, la 9.ª orden con su
  registro `unusable` (la de la verificación de H-T8-1) y los delimitadores del JSON entre ellos.
- **Lectura [I].** El archivo cambió porque la app lo reescribió al arrancar con el mismo contenido lógico medido; ninguna
  marca ni orden se perdió, se cambió o se volvió a programar. Las dos órdenes `unusable` siguieron sin reprogramarse (solo hay
  reintento explícito), y las 7 marcadas no volvieron a notificar.

**Lo que no se pudo medir.**
- **Marcas por orden ANTES del reinicio.** La línea base solo guardó hashes: copiar el MMKV al Mac lo denegó el clasificador de
  permisos (datos de pedidos). La conservación de las marcas se acredita de forma indirecta (igualdad con el snapshot de las
  17:50 para 8 de las 9 órdenes y coincidencia de totales con T8 para la 9.ª), no con un «antes = después» directo. Esta vez los
  conteos sí se obtuvieron, porque se calcularon dentro del teléfono sin sacar valores.
- Una respuesta idempotente repetida o un reintento tras el reinicio: exigiría una orden nueva; lo cubren los tests
  (`create-order-notification-listener.test.ts`, `order-notification-persistence.test.ts`).
- iOS: no se probó reinicio de dispositivo (el Simulator no lo representa).
- La causa de la escritura de arranque es una inferencia (código de redux-persist y snapshots previos); no se instrumentó la
  app para observarla.

**Consecuencia para la fila «Reinicio de la app» de arriba.** Allí el `cmp` idéntico entre «antes» y «después» no es un criterio
fiable: toda reescritura cambia 4 bytes, y las dos instantáneas de aquella comparación se tomaron con solo 19 s de diferencia
(incluida la muerte y el relanzamiento de la app), poco más de los ~18 s que hoy tardó el arranque en llegar a su última
escritura; pudieron adelantarse a ella. No se corrigió esa fila; conviene no citar ese `cmp` como prueba de «no escribió».

**Resultado.** La prueba de reinicio **PASA**, con las limitaciones anteriores (proceso ya despierto por `BOOT_COMPLETED`; marcas
de antes conservadas por evidencia indirecta). Tras el reinicio real y la apertura: 0 notificaciones nuevas, 0 alarmas y trabajos,
ningún diálogo de permiso, 0 errores y las 9 órdenes con las marcas esperadas. **T8 sigue sin marcar** hasta revisar H-T8-2 a
H-T8-5 con el usuario. No se avanzó a T10 ni se creó commit.

### Revalidación solicitada del reinicio — Samsung SM-A037M, 2026-10-14

Se hizo una comprobación física adicional, sin modificar datos ni configuración de la aplicación:

- **Dispositivo:** Samsung SM-A037M, Android 13; Development Build debug, Metro en 8081 y mock en 3001 mediante `adb reverse`.
- **Pasos medidos por el agente [A]:** antes del reinicio, `uptime` era 1 h 35 min y `btime` era `1792025730`; se ejecutó `adb reboot`. Tras `sys.boot_completed=1`, el nuevo `btime` fue `1792031491` y el uptime volvió a cero. El reinicio también eliminó los túneles, que se restauraron después.
- **Apertura y resultado [A]:** se abrió la aplicación mediante el enlace del Development Client, sin tocar la pantalla. La primera apertura terminó en un crash nativo SIGSEGV de Fabric y volvió al launcher; no se cuenta como resultado correcto. Una segunda apertura cargó la app (`Running "main"`, `GET /home -> ok`) y quedó en Inicio, con `com.herbstore.mobile/.MainActivity` como actividad en primer plano. No se observó diálogo de permiso ni se creó una notificación nueva durante esta comprobación.
- **Metro/logs [A]:** en esta revalidación no apareció `[notifications] tap source=initial decision=navigate`. Metro solo registró `[deep-link] initial=true -> ignored` para la apertura normal del Development Client; por tanto este reinicio no confirma un tap de notificación en arranque en frío ni permite distinguirlo de una apertura normal mediante esa línea.
- **Estado final:** el Samsung quedó con HerbStore abierta en Inicio, sin más acciones sobre el dispositivo después de dejarlo así. T8 continúa sin marcar; esta entrada no sustituye la evidencia pendiente del tap frío de iOS ni convierte una apertura normal en tap de notificación.

### Cierre documental de T8 — 2026-10-14

> **Sección histórica, superada por «Estado vigente» (arriba) y por «T8 — pase iOS único — 2026-10-15».** No describe el estado actual; se conserva solo como registro fechado.
> Rótulo: «T8 DESMARCADA/PENDIENTE» describe el 2026-10-14; T8 se cerró el 2026-10-15 con la limitación aceptada por el usuario.

Este pase solo actualiza la documentación; no cambia código de aplicación ni configuración
nativa. La evidencia se separa por autoría: **[A]** log o medida de herramienta, **[U]**
resultado visual o interacción reportada por el usuario, **[T]** test determinista.

- **iOS Simulator, tap frío:** [A] Metro contiene exactamente
  `LOG [notifications] tap source=initial decision=navigate` (línea 13698 de la sesión
  registrada arriba). Este log distingue el tap inicial (`source=initial`) del tap con la
  aplicación activa (`source=active`); no se presenta como una medición táctil del usuario.
  [U] El usuario reportó que iOS arrancó en frío y terminó en Inicio, sin flecha. Los toques
  sintéticos sobre la pantalla de bloqueo/Centro de notificaciones fueron inertes y no se
  reinterpretan como una medición de interacción.
- **Samsung SM-A037M, reinicio real:** [A] el reinicio y la persistencia quedaron medidos en
  la sección anterior. [U] el usuario dejó Samsung en Inicio tras abrirlo después del reinicio,
  sin más toques posteriores; no se afirma una medición táctil adicional. No se registraron
  notificaciones nuevas ni nuevo diálogo de permiso.

#### Hallazgos y seguimiento, conservados sin reinterpretación

- **H-T8-2 — FALLO [U], seguimiento:** el usuario confirmó que «Ir a Inicio» del carrito
  vacío no llega/cruza correctamente a la pestaña Inicio. No se presenta como fallo de RF-23,
  RF-24 o RF-25 corregido en T8.
- **H-T8-3 — FALLO [U], seguimiento:** durante el flujo/consulta del pedido aparece el toast
  rojo de LogBox «Cannot update a component while rendering…», que puede cubrir la pestaña
  Carrito. No se corrigió en este pase.
- **H-T8-4 — FALLO parcial [U], seguimiento:** tras la primera denegación aparece «Las
  notificaciones están bloqueadas»; después de habilitar desde Ajustes y pulsar reintento, el
  mensaje desaparece. Se conserva como observación del usuario, sin reinterpretarla.
- **H-T8-5 — resultado posterior [U], seguimiento:** el usuario confirmó que el idioma se
  conserva tras recargar/reiniciar. Esto contradice la observación histórica de esta sección
  (2026-10-14, [A]) que describía reinicio al idioma del sistema; ambas observaciones se
  conservan con autoría y fecha, sin borrar la historia ni afirmar una causa.
  - **Conciliación (2026-10-15):** el código explica la observación [A] y no la confirmación [U]:
    `src/core/i18n/index.ts` arranca siempre con `getLocales()[0]?.languageCode` (idioma del sistema), los botones de
    Cuenta > Fundamentos llaman a `i18n.changeLanguage(...)` solo en memoria y `PERSISTED_KEYS` excluye las preferencias
    por la decisión del Día 4. En T14 se repitió [A]: tras un `force-stop`, el EN elegido volvió al ES del sistema. Lo
    más probable es que la observación del usuario coincidiera con el idioma del sistema o que la app no llegara a
    cerrarse del todo (por ejemplo, solo pasó a segundo plano); no hay una causa confirmada. Decisión del usuario
    (2026-10-15): «dejarlo así». H-T8-5 deja de figurar como «RESUELTO» y pasa a **comportamiento por diseño**: el idioma
    no se persiste y, tras un cierre real, vuelve al del sistema. Para validar en inglés hay que elegir EN después de
    cada arranque en frío o poner el dispositivo/Simulator en inglés.

Con la evidencia disponible, T8 permanece **DESMARCADA/PENDIENTE** en
`specs/005-dia-5-nativo-plataforma/tasks.md`, porque faltan evidencias bilaterales. H-T8-2..H-T8-5
permanecen como limitaciones o seguimientos ajenos a una corrección de RF de T8. T10 permanece sin marcar.

### Revisión manual iOS solicitada por el reviewer — 2026-10-14 [A]

> **Sección histórica, superada por «Estado vigente» (arriba) y por «T8 — pase iOS único — 2026-10-15».** No describe el estado actual; se conserva solo como registro fechado.
> Rótulo: aquel intento no completó la orden; el pase único del 2026-10-15 sí lo hizo.

Se hizo un intento adicional exclusivamente en el iOS Simulator iPhone 17 Pro
(`UDID omitido`). El Samsung no se tocó: permaneció abierto en
Inicio. No se usó `simctl push` ni se fabricó ningún evento de notificación.

Se intentó confirmar una orden ficticia mediante el checkout local para observar
`Programando…`, cancelarlo durante la espera y comprobar la notificación resultante. La
entrada no fue reproducible de forma fiable con `axe`: al enfocar un campo y usar el teclado
HID, los taps de campos fuera de la ventana visible no desplazaron el destino y el texto se
concatenó en el primer campo. No se completó una orden nueva ni se ejecutó scheduling/cancelación
en esta vuelta. La app terminó en Inicio; se restauraron apariencia clara, texto `large` y
`AutomaticMinimizationEnabled=true`.

| Criterio | Resultado iOS [A] | Estado honesto |
|---|---|---|
| Scheduling, cancelación durante scheduling y controles accesibles | No reproducido; no hubo una orden nueva. La observación previa solo acredita `status: scheduling` antes de la alerta, no Cancelar/Volver durante la espera. | Pendiente |
| Inglés visible en notificación/estado | No reproducido visualmente en iOS; el checkout no llegó a confirmación. ES/EN de la copia siguen cubiertos por tests y Android, no se extrapolan a iOS. | Pendiente |
| Tema oscuro y texto ampliado | No se atribuye validación a la superficie de notificación/estado; no se usó un cambio de ajustes como sustituto de un banner real. | Pendiente |
| Roles, labels, busy/disabled, foco y targets ≥44 pt | `axe` mostró campos del checkout con rol `text field` y controles de 48–52 pt, pero no es evidencia de los controles de scheduling/notificación. No se hizo auditoría de esos controles ni VoiceOver. | Pendiente |
| Reduced motion | No comprobado por separado en iOS para notificación/estado. | Pendiente |

Esta vuelta no cambia la conclusión: T8 continúa **DESMARCADA/PENDIENTE** por faltar la
evidencia bilateral de esos criterios. H-T8-2..H-T8-5 permanecen sin cambios.

## T10 — checkpoint de regresión y matriz final disponible — 2026-10-14

> **Sección histórica, superada por «Estado vigente» (arriba) y por «Corrección 2 de T10» y «Cierre de T10 — 2026-10-15».** No describe el estado actual; se conserva solo como registro fechado.
> Rótulo: 1013/1013, 20/21 de Doctor, «T8 continúa `[ ]`» y la nota sobre `modules/device-insights/android/build/` son del 2026-10-14 (T8 se cerró el 2026-10-15; esa carpeta está en `.gitignore`, regla `/modules/device-insights/android/build/`).

Este checkpoint ejecutó únicamente la regresión/documentación de T10. No modifica código,
dependencias, configuración ni proyectos nativos generados. T8 continúa `[ ]` y sus huecos
de validación iOS no se usan como evidencia inventada.

### Comandos y resultados

| Comando | Resultado | Limitación/nota |
|---|---|---|
| `npm run test:logic` | **1013/1013**, 0 fallos | Tests `node:test`; no sustituyen la interacción manual. |
| `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test <regresión dirigida>` | **219/219**, 0 fallos | DeviceInsights, scanner/EAN/deep links, notificaciones/persistencia, feedback y compartir. |
| `npx expo lint` | **OK**, sin salida | — |
| `npx tsc --noEmit` | **OK**, sin salida | — |
| `npx expo install --check` | **FAIL** | Recomienda seis parches: `@expo/ui` 57.0.24, `expo` 57.0.29, `expo-constants` 57.0.22, `expo-linking` 57.0.13, `expo-notifications` 57.0.23 y `expo-router` 57.0.27; no se actualizaron en T10. |
| `npx expo-doctor@latest` | **20/21 checks** | Falla únicamente la comprobación de versiones Expo por los seis parches anteriores. |
| `npx expo config --json` + script estructural local | **OK** | Perfiles `development`/`preview`, ids Android/iOS `com.herbstore.mobile` y `runtimeVersion: fingerprint`. |
| `CI=1 npx eas-cli@latest whoami` | **Not logged in** | No hay sesión/cuenta disponible. |
| `CI=1 npx eas-cli@latest build --profile development --platform all --non-interactive` | **FAIL** | `An Expo user account is required`; no se inició build remoto. |
| `git diff --check` | **OK**, sin salida | — |

### Matriz dirigida Android físico / iOS Simulator

| Superficie/estado aplicable | Android físico Samsung SM-A037M, Android 13 | iOS Simulator iPhone 17 Pro, iOS 26.5 |
|---|---|---|
| DeviceInsights sync/async/evento/vista | **Real**: Android, modelo/versión, físico, evento único y botón accesible; claro/oscuro, ES/EN, texto 2× y reduced motion comprobados. | **Real en Simulator**: iOS, iPhone/26.5, simulador, evento único y botón UIKit; claro/oscuro, ES/EN, AX5 y reduced motion comprobados. No implica iPhone físico. |
| Scanner preview, permisos, unavailable, foreground, texto | **Real**: preview previa, permiso, `ready`, `unavailable`, Ajustes/Búsqueda/Cancelar y recuperación; cámara óptica/EAN y errores derivados no se reejecutaron en este checkpoint. | **Real como UI/estado**: preview, permiso, `ready`/`unavailable`, navegación y fallback; no cámara óptica ni lectura EAN. |
| Deep links activo/frío | **Real en Release**: destinos, salida segura y ausencia de Dev Launcher; contenido de catálogo limitado por cleartext del mock. | **Real en Release**: destinos y salida segura, sin Dev Launcher; no se atribuye hardware. |
| Notificaciones | Tests deterministas para matriz y dedupe; evidencia física histórica de permisos/tap/reinicio queda en la sección T8, pero T8 sigue pendiente. | Tap frío/activo y estados previos documentados; scheduling/cancelación, tema/texto grande/roles/reduced motion de la superficie siguen pendientes. |
| Compartir/háptico | Tests y evidencia histórica de compartir/háptico; no se repitió en este checkpoint. | Tests y hoja del sistema; Taptic Engine no existe en Simulator. |
| Loading/error/empty/offline/reduced motion | Aplicados cuando la superficie los tiene; `empty` no aplica a DeviceInsights/scanner. | Igual; capacidades físicas del Simulator no se presentan como validadas. |

El Samsung quedó en un estado seguro: aplicación en Inicio, sin cambios persistentes de
font scale, tema, locale o animaciones. El Simulator quedó disponible y sin cambios de
apariencia que se presenten como evidencia adicional de T8. El directorio conocido
`modules/device-insights/android/build/` contiene aproximadamente 349 archivos generados;
permanece fuera del estado Git por las reglas existentes, sin borrar ni editar su contenido.

### Decisión de cierre

T10 permanece **[ ] pendiente**: aunque la regresión y la documentación están completas,
`expo install --check`/Doctor no están verdes en el entorno actual y falta la validación
remota EAS exigida por RF-28/RF-36. No se crea commit ni se marca la spec como implementada.

## Corrección 1 de T10 tras reviewer — 2026-10-14

> **Sección histórica, superada por «Estado vigente» (arriba) y por «Corrección 2 de T10» y «Cierre de T10 — 2026-10-15».** No describe el estado actual; se conserva solo como registro fechado.
> Rótulo: «T8 y T10 siguen `[ ]`» y «EAS remoto sin sesión» describen el 2026-10-14; los seis parches se alinearon después y la sesión EAS existe desde 2026-10-15.

Se repitieron únicamente las comprobaciones pertinentes; no se editó código de producto,
configuración, dependencias ni proyectos nativos generados. T8 y T10 no se marcan.

### Compatibilidad Expo/RNF-5

`npx expo install --check` volvió a fallar y `npx expo-doctor@latest` quedó en **20/21**.
Ambos identifican estos parches publicados para la línea SDK 57:

| Paquete | Instalado | Recomendado |
|---|---:|---:|
| `@expo/ui` | 57.0.23 | ~57.0.24 |
| `expo` | 57.0.28 | ~57.0.29 |
| `expo-constants` | 57.0.21 | ~57.0.22 |
| `expo-linking` | 57.0.12 | ~57.0.13 |
| `expo-notifications` | 57.0.22 | ~57.0.23 |
| `expo-router` | 57.0.26 | ~57.0.27 |

### Decisión previa al cambio

Los seis cambios anteriores son parches de la misma línea Expo SDK 57 (no cambian SDK,
React Native ni la arquitectura). Se alinearán con `npx expo install`, porque Expo Doctor
los declara versiones esperadas para el SDK instalado y no requieren un upgrade de stack.
Se anticipa impacto nativo por `expo`/`expo-notifications`: después se regenerarán y
recompilarán los Development Builds y se repetirá la matriz bilateral. No se editarán
`ios/`/`android/` generados ni se usará `npm audit fix --force`. Si la compilación revela
incompatibilidad, se dejará el bloqueo documentado sin improvisar una alternativa.

### EAS remoto

Se reintentó sin secretos y sin login interactivo:

```text
CI=1 npx eas-cli@latest whoami
Not logged in

CI=1 npx eas-cli@latest build --profile development --platform all --non-interactive
An Expo user account is required to proceed.
```

No se inició ninguna build remota. Sin sesión/cuenta o `EXPO_TOKEN` proporcionado por el
usuario, RF-28 y RF-36 permanecen pendientes; la validación local no se presenta como remota.

### Evidencia manual iOS de notificaciones

La revisión manual adicional no pudo completar una orden ficticia de forma reproducible con
`axe`, por lo que no hubo scheduling ni cancelación observables. Permanecen pendientes en
iOS Simulator: scheduling/cancelación, inglés visible, tema oscuro, texto ampliado,
roles/labels/busy/disabled/foco/targets y reduced motion. Los tests y la evidencia previa de
Android no sustituyen esta comprobación bilateral; no se atribuye esta evidencia a Android ni
se cierran RF-34, RNF-3 o RNF-4 para esta superficie.

### Revalidación sin cambios de producto

| Comprobación | Resultado |
|---|---|
| `npm run test:logic` | **1013/1013** |
| `npx expo lint` | **OK** |
| `npx tsc --noEmit` | **OK** |
| `git diff --check` | **OK** |
| Android/iOS Development Build | No se recompila: no cambió código, dependencia ni configuración |

T8 sigue `[ ]`, T10 sigue `[ ]` y no se crea commit.

## Corrección 2 de T10 — alineación Expo SDK 57 y recompilación — 2026-10-14

> **Sección histórica, superada por «Estado vigente» (arriba) y por «Cierre de T10 — 2026-10-15».** No describe el estado actual; se conserva solo como registro fechado.
> Rótulo: «T8 continúa `[ ]`» y «EAS remoto sin sesión» son del 2026-10-14. Las cifras 21/21 y 1013/1013 también: tras los tres parches siguientes (2026-10-15) vuelve a ser 21/21 y la lógica es 1082/1082.

La decisión documentada arriba se ejecutó con `npx expo install` para los seis parches
esperados. `package.json` y `package-lock.json` quedaron alineados con Expo SDK 57:
`@expo/ui` 57.0.24, `expo` 57.0.29, `expo-constants` 57.0.22, `expo-linking` 57.0.13,
`expo-notifications` 57.0.23 y `expo-router` 57.0.27. No hubo cambio de SDK, React
Native, New Architecture ni configuración de aplicación. No se ejecutó `npm audit fix
--force`.

### Verificación de herramientas

| Comprobación | Resultado |
|---|---|
| `npx expo install --check` | **Dependencies are up to date** |
| `npx expo-doctor@latest` | **21/21 checks passed** |
| `npx expo lint` | **OK** |
| `npx tsc --noEmit` | **OK** |
| `npm run test:logic` | **1013/1013** |
| `git diff --check` | **OK** |

### Recompilación bilateral

- Android físico Samsung SM-A037M: tras configurar `ANDROID_HOME` y JDK 21,
  `npx expo run:android --device SM_A037M --no-bundler` terminó **BUILD SUCCESSFUL**,
  instaló el APK y abrió el Development Build.
- iOS Simulator iPhone 17 Pro: tras regenerar los proyectos CNG con
  `npx expo prebuild --clean` (sin editar `ios/`/`android/` manualmente),
  `ONLY_ACTIVE_ARCH=YES npx expo run:ios --device "iPhone 17 Pro" --no-bundler`
  terminó **Build Succeeded**, instaló y abrió la app. El primer intento falló por
  pods desfasados (`ExpoModulesCore`/`ExpoModulesWorklets`); `pod update` y la
  regeneración CNG resolvieron el desfase.

La matriz dirigida no se repitió en este pase: T8 continúa `[ ]` por evidencia bilateral
faltante y RF-28/RF-36 continúa pendiente por EAS remoto sin sesión. Por tanto T10 no se
marca, no se marca la spec y no se crea commit.

## T11 — RF-37: «Ir a Inicio» del carrito vacío a la raíz de Inicio (H-T8-2) — 2026-10-14

Alcance aprobado: solo el carrito vacío. `EmptyCart`, `NotFoundScreen`, `CategoryProductsScreen` y
`go-home.ts` (tap de la notificación, S-RF24) no cambian. Sin dependencias nuevas ni cambios nativos:
basta Fast Refresh/recarga del Development Build, sin recompilar.

### Lectura de la API real (expo-router 57.0.27, React Navigation vendorizada en `build/react-navigation`)

- `useNavigation('/(tabs)')` (`build/useNavigation.js`) resuelve `navigation.getParent('/(tabs)')`: el id del
  navegador es el `contextKey` del layout (`withLayoutContext.js`). `getState()` devuelve el estado de `Tabs`.
- `useOnAction`: una acción con `target` sube al padre y, si nadie la maneja, baja a los navegadores hijos
  montados; con `target === state.key` y resultado `null` devuelve `state` (manejada, sin aviso).
- `StackRouter` `POP_TO_TOP` = `POP` con `count = routes.length - 1` (deja `routes[0]`); la anulación de
  expo-router (`StackClient.js`) solo rechaza acciones con otro `target`. `TabRouter` `JUMP_TO` solo cambia el índice.
- `dismissTo` = `ROUTER_LINK` con `event: 'POP_TO'` despachado con `target` = clave de `Tabs`: `TabRouter`
  devuelve `null` y, por la regla anterior, se descarta EN SILENCIO (por eso H-T8-2 no dejaba aviso).

### Código

- `src/features/navigation/logic/home-root-plan.ts` (+ `home-root-plan.test.ts`, 12 tests): `planHomeRoot(tabsState)`
  devuelve `POP_TO_TOP` con `target` = clave del stack `(home)` solo si tiene clave y más de una ruta, y luego
  `JUMP_TO (home)` con `target` = clave de `Tabs`; sin `(home)` o sin estado, `[]`.
- `src/features/navigation/use-go-to-home-root.ts`: hook que lee `getState()` al pulsar y despacha el plan.
- `src/features/cart/screens/CartScreen.tsx`: `EmptyCart onGoHome={goToHomeRoot}` (antes `router.dismissTo('/')`).

### Verificación

| Comprobación | Resultado |
|---|---|
| Test nuevo en rojo primero | **FALLA** por `ERR_MODULE_NOT_FOUND` (`home-root-plan.ts` no existía) |
| `home-root-plan.test.ts` | **12/12** |
| `npm run test:logic` | **1025/1025** (1013 + 12) |
| `npx expo lint` | **OK** (exit 0) |
| `npx tsc --noEmit` | **OK** (exit 0) |
| `git diff --check` | **OK** |

### Samsung SM-A037M (Android 13, Development Build, Metro) — [A]

Herramientas: `uiautomator dump`, `screencap`, `input tap`/`keyevent 4`, `dumpsys window` y
`logcat -v time ReactNativeJS:V '*:S'` durante toda la sesión. Sin flecha = no existe el nodo
«Desplazarse hacia arriba» (el Atrás de la cabecera) y el título es «Inicio».

| Partida | Acción | Resultado |
|---|---|---|
| Inicio en su raíz | Carrito vacío → «Ir a Inicio» | Inicio seleccionado (captura), título «Inicio», sin flecha. Atrás del sistema → launcher (`mCurrentFocus` = `LauncherActivity`) |
| Inicio con producto apilado | Carrito vacío → «Ir a Inicio» | Igual: raíz sin flecha; Atrás → launcher, no revela el detalle ni otro Inicio |
| Inicio con categoría → producto | Doble toque secuencial rápido (`input tap; input tap` en la misma shell) | Raíz sin flecha; Atrás → launcher |
| Inicio con producto apilado | Doble toque simultáneo (`input tap & input tap & wait`) | Raíz sin flecha; Atrás → launcher |
| Tras recargar el Dev Build con el código final | producto apilado → Carrito → «Ir a Inicio» | Raíz sin flecha; Atrás → launcher; 0 líneas `E/`/`W/ReactNativeJS` desde la marca |

El segundo toque se dio en (100, 860): en el carrito cae sobre «Ir a Inicio» y en Inicio sobre espacio vacío,
así que un toque que llegue tarde no abre otra pantalla. adb no permite distinguir si el segundo toque llegó
al botón antes del cambio de pestaña; el plan lo cubre en el test «replanificar tras aplicar el plan da solo `JUMP_TO`».

«was not handled by any navigator» en `logcat`: **0** en todos los recorridos con el código final.
**Control positivo** (temporal, revertido con copia del archivo y verificado con `git diff`):
1. Con `router.dismissTo('/')` (código previo) el toque dejó la app en «Carrito»: H-T8-2 reproducido, sin aviso
   (descartado en silencio, ver la lectura de la API).
2. Con la alternativa descartada B (`navigate('/')` + `dismissAll()`) desde Inicio en la raíz, `logcat` registró
   `E/ReactNativeJS: The action 'POP_TO_TOP' was not handled by any navigator.`: el canal sí captura el aviso
   y confirma el motivo del descarte de B.
No se leyó la consola de Metro (proceso ya en marcha, iniciado fuera de esta sesión); el aviso es un
`console.error`, que en Android llega a `logcat` como se acaba de demostrar.

Estado del dispositivo: `font_scale` 1.0, tema claro (`Night mode: no`) e idioma `es-US`, igual que al
empezar; la app quedó en Inicio. No se tocaron permisos ni `stay_on_while_plugged_in` (sigue en 3, de T6).

### iOS Simulator iPhone 17 Pro (iOS 26.5) — [A], adelanto sin sustituir el pase único de T8

Herramientas: `axe describe-ui`/`touch`/`swipe`, `simctl io screenshot`. El carrito tenía una línea ficticia
(Daily Balance Powder ×1): se eliminó para la prueba y se restauró al final con «Agregar al carrito» (×1).

| Partida | Acción | Resultado |
|---|---|---|
| Inicio en su raíz | Carrito vacío → «Ir a Inicio» | Encabezado «Inicio», 0 `back button` en el árbol, pestaña Inicio activa (captura) |
| Producto apilado (había `back button` «Inicio») | Carrito vacío → «Ir a Inicio» | Raíz, 0 `back button`; gesto de borde (swipe x 2→320) no revela nada |
| Categoría → producto | Doble toque simultáneo con `axe touch` (en (60, 494), espacio vacío en Inicio) | Raíz, 0 `back button`; gesto de borde sin efecto |

`log stream` con predicado «not handled» no mostró coincidencias, pero en iOS **no** se hizo control positivo
de ese canal: no se afirma la ausencia del aviso en iOS por esta vía. Apariencia `light`, texto `large` y
accesibilidad del Simulator (`AccessibilityEnabled` = 1, como se encontró) sin cambios. El pase iOS formal de
RF-37 sigue en la validación única de T8.

## T12 — RF-38: la consulta del pedido redirige una sola vez y fuera del render (H-T8-3) — 2026-10-14

Alcance aprobado: destino correcto, una sola redirección y ninguna advertencia de render. No se limpia el historial
de la pestaña Carrito (Fuera de alcance). Sin dependencias, sin cambios nativos ni en `attempt-machine.ts`, el thunk
o los listeners: basta Fast Refresh/recarga del Development Build.

### Lectura de la API real

- `useRouter()` (expo-router 57.0.27, `build/hooks/useRouter.js`) devuelve el objeto `router` de módulo
  (`imperative-api.js`): es estable y puede ir en las dependencias del efecto sin re-ejecutarlo.
- `useStore.withTypes<AppStore>()` (react-redux 9.3.0) da `getState()` para leer el estado VIGENTE en la continuación
  asíncrona de la consulta (lo capturado en el render ya está obsoleto).
- `MOCK_LATENCY_MS` solo retrasa `/home`, `/categories`, `/products` y `/brands` (`mock-server/src/server.js`); no
  afecta a `GET /orders/status`, así que un resultado tardío tras Cancelar no se puede provocar sin tocar el mock: lo
  cubren los tests. Sin variables, el mock responde `POST /orders` → 202 `pending` (`retryAfter` 1 s) y confirma al
  consultar pasado ese segundo, que es justo el caso de RF-38. El mock no se paró ni se relanzó.

### Código

- `src/features/checkout/logic/order-status-redirect.ts` (+ `order-status-redirect.test.ts`, 12 tests): máquina pura
  `watching | consulting | done` con `nextRedirect(phase, event)` → `{ phase, redirect: 'checkout' | 'order-confirmation' | null }`.
  `attemptObserved('idle')` solo decide en `watching`; `consultFinished` con `confirmed` → confirmación, si no `idle` →
  checkout, si no vuelve a `watching`; `left` y cualquier decisión pasan a `done`, que no vuelve a decidir.
- `src/features/checkout/screens/OrderStatusScreen.tsx`: la fase vive en un `useRef`; navega solo desde un `useEffect`
  sobre `attempt.status` o desde la continuación de `consult` (try/catch: un `unwrap` que lanza decide por el estado
  vigente). Un ref de montaje (true en el efecto, false en el cleanup) convierte un resultado tras desmontar en `left`.
  Cancelar marca `left` antes de `router.back()`. Con el intento en `idle` renderiza `null`. Log solo `__DEV__`
  `[order-status] redirect -> <destino> (from effect|consult)` para medir «una sola vez».
- `src/core/store/store.ts` (`AppStore`) y `src/core/store/hooks.ts` (`useAppStore`).

Decisión no cubierta literalmente por el plan: desmontar NO envía `left` desde el cleanup del efecto, porque en
Strict Mode/Fast Refresh el cleanup se ejecuta y el efecto vuelve a montarse; `left` dejaría la máquina en `done` y
se perdería la redirección legítima de «abrir sin intento». El ref de montaje cubre el desmontaje real y la
continuación aplica entonces `left`.

### Verificación

| Comprobación | Resultado |
|---|---|
| Test nuevo en rojo primero | **FALLA** por `ERR_MODULE_NOT_FOUND` (`order-status-redirect.ts` no existía) |
| Dirigidos (`order-status-redirect`, `attempt-machine`, `checkout-attempt-slice`) | **14/14** (12 nuevos) |
| `npm run test:logic` | **1037/1037** (1025 + 12) |
| `npx expo lint` | **OK** (exit 0) |
| `npx tsc --noEmit` | **OK** (exit 0) |
| `git diff --check` | **OK** |

### Samsung SM-A037M (Android 13, Development Build, Metro) — [A]

Formulario de checkout rellenado por el agente campo a campo (`uiautomator` para localizar cada campo por su
etiqueta, `input keyevent` uno por llamada y ocultar el teclado con Atrás antes de cada toque). Datos ficticios.
`logcat -v time ReactNativeJS:V '*:S'` capturado durante toda la sesión.

| Recorrido | Resultado |
|---|---|
| 1. Orden → `POST /orders -> 202 pending retryAfter=1s` → «Pedido en proceso» → «Consultar estado» | «Pedido confirmado» (captura); sin toast de LogBox en la captura ni en el árbol |
| 2. Orden 202 → «Cancelar espera» | Vuelve a la pantalla anterior: Carrito con «Pedido sin resolver / Reabrir consulta»; 0 líneas `[order-status] redirect` |
| 2b. «Reabrir consulta» → «Consultar estado» | Un `GET /orders/status` y **una** línea `[order-status] redirect -> order-confirmation (from consult)`; «Pedido confirmado» |
| 3. Sin intento (`idle`), carrito vacío, `herbstore://order-status` | **Una** línea `redirect -> checkout (from effect)`; luego el checkout (Día 4, sin cambios) reenvía al Carrito porque no hay líneas. Queda un Carrito con flecha encima de otro (historial intermedio: Fuera de alcance de RF-38) |
| 4. Tras recargar con el código final: orden 202 → doble toque en «Consultar estado» (dos `input tap` en la misma shell) | Un único `GET /orders/status`, **una** redirección a la confirmación; Atrás del sistema → Carrito |

«Cannot update a component while rendering» en `logcat` con el código final: **0**; `E/`/`W/ReactNativeJS`: **0**.
**Control positivo** (temporal, copia del archivo; `git diff` vacío respecto a HEAD con el código anterior y `cmp`
idéntico al restaurar): con el `OrderStatusScreen` anterior, orden 202 → «Consultar estado» llegó a «Pedido
confirmado» pero `logcat` registró `E/ReactNativeJS: 'Cannot update a component (%s) while rendering a different
component (%s)…', 'ForwardRef(NavigationContainerInner)', 'OrderStatusScreen'` y apareció el toast rojo de LogBox
sobre la barra de pestañas, tapando «Carrito» (captura y nodo en `uiautomator`, bounds [19,1373][701,1463]): H-T8-3
reproducido y canal comprobado. No se leyó la consola de Metro (proceso iniciado fuera de esta sesión).
Los casos `notCreated`/`expired`, Cancelar con la consulta en vuelo y el fallo de `unwrap` solo están cubiertos por
los tests (el mock no permite provocarlos sin modificarlo).

Estado del dispositivo: las 4 órdenes ficticias publicaron «Pedido confirmado» (RF-24, permiso ya concedido); se
descartaron con un deslizamiento cada una (0 notificaciones de HerbStore; las de otras apps intactas). La app quedó en
Inicio en su raíz con el carrito vacío. `font_scale` 1.0, tema claro, permisos sin tocar, `stay_on_while_plugged_in`
sigue en 3 (de T6). El historial local de pedidos tiene 4 órdenes ficticias más y el mock 4 confirmaciones más de
`product-261009-218` (estado en memoria; no se reinició).

### iOS Simulator iPhone 17 Pro (iOS 26.5) — [A], adelanto sin sustituir el pase único de T8

Sin rellenar el formulario (ver MEMORY). Canal: `log stream` filtrado; los `console.error` de JS llegan como
`[com.facebook.react.log:javascript]`, los `console.log` no, así que «una sola redirección» no se mide en iOS.

| Caso | Resultado |
|---|---|
| Intento `idle`, carrito con 1 línea, `herbstore://order-status` (código final) | Llega a «Datos de entrega» (checkout); sin toast de LogBox en el árbol de `axe` ni en la captura |
| Control positivo con el código anterior (mismo enlace, tras recargar) | Nodo de LogBox «!, Cannot update a component (`ForwardRef(NavigationContainerInner)`) while rendering… (`OrderStatusScreen`)» en el árbol y la línea `E … [com.facebook.react.log:javascript] 'Cannot update a component…` en `log stream` |
| Código final restaurado y recargado, mismo enlace | Checkout, 0 nodos de LogBox y 0 líneas nuevas en `log stream` |

La app se recargó y quedó en Inicio con su carrito (1 línea) como estaba; apariencia `light` y texto `large` sin
cambios. El recorrido 202 → «Consultar estado» → confirmación en iOS queda para el pase único de T8.

## T13 — RF-39 (lógica): categoría «denegadas recuperables» / «bloqueadas» por orden (H-T8-4) — 2026-10-14

Alcance: solo lógica y persistencia. Sin cambios en UI, textos, dependencias ni código nativo (T14 pinta el texto).

### Lectura de la API real (expo-notifications 57.0.23, expo-modules-core)

- Android API 33+ (`NotificationPermissionsModule.kt`): `status` = `denied` si el permiso runtime está denegado o
  `areNotificationsEnabled()` es falso; `granted` = solo el permiso runtime; `canAskAgain` = el de `PermissionsService`.
- `PermissionsService.kt`: tras un `request` denegado guarda `blocked = !shouldShowRequestPermissionRationale()` en sus
  SharedPreferences y `getPermissions` devuelve `canAskAgain = !blocked`. Primer rechazo → `denied` + `canAskAgain`
  (recuperable); segundo rechazo → `denied` sin `canAskAgain` (bloqueadas). La forma ya modelada en `toPermissionInput`
  no cambia.
- iOS (`ExpoNotificationsPermissionsRequester.swift`): `ios.status` sigue mandando; provisional/ephemeral = utilizables.
- **Riesgo para T14 (comprobado solo por lectura, 2026-10-14):** `pm revoke` + `pm clear-permission-flags` no borran la
  marca que `PermissionsService` guarda en `shared_prefs/expo.modules.permissions.asked.xml`. En el Samsung esa marca
  ya vale `blocked:android.permission.POST_NOTIFICATIONS = true` (de T8; hoy el permiso está `granted=true`,
  `USER_SET|USER_FIXED`). Tras revocar, `getPermissions` devolvería `denied` sin `canAskAgain`: la app clasificaría
  «bloqueadas» y nunca mostraría el diálogo, así que la orden A de T14 no llegaría a «denegadas recuperables». Antes de
  T14 hace falta decidir cómo reiniciar esa marca (borrar datos de la app también borra el MMKV). No se tocó.

### Código

- `orders/logic/order-notification-state.ts`: `UnusableReason = 'denied-recoverable' | 'blocked'` (declarado aquí para
  no crear el ciclo `orders → notifications`) e `isUnusableReason`; `unusableReason` solo con `status === 'unusable'`;
  `scheduling`/`scheduled`/`failed` eliminan la clave; el saneado convierte una razón ausente o inválida en `blocked` y la
  descarta fuera de `unusable`.
- `notifications/logic/notification-permission.ts`: `classifyUnusableReason(input)` = recuperable solo si
  `android` + `hasRuntimePrompt === true` + `classifyNotificationPermission(...)` es `request`; todo lo demás, bloqueadas.
- `schedule-order-notification.ts`: la razón sale de la ÚLTIMA lectura (respuesta de `request` si se pidió, si no la de
  `get`). `canOpenSettings` sigue siendo `true`. `requestPermission` sigue saliendo de `permissionRequested` (RF-23).
- Coordinador, listener y `order-history-slice.ts` reenvían `reason` sin decidir nada.
- `core/storage/persist-policy.ts`: `PERSIST_VERSION = 3`; `READABLE_PREVIOUS_VERSIONS = [1, 2]`.

### Verificación

| Comprobación | Resultado |
|---|---|
| Tests nuevos en rojo primero | **FALLAN**: `classifyUnusableReason` no exportado (SyntaxError), sin `reason`/`unusableReason`, `PERSIST_VERSION` 2 |
| Dirigidos (permisos, scheduling, coordinador, listener, estado, slice, persist-policy, persistencia real) | **129/129** |
| `npm run test:logic` | **1068/1068** (1037 + 31) |
| `npx expo lint` / `npx tsc --noEmit` / `git diff --check` | **OK** / **OK** / **OK** |

### Samsung SM-A037M — arranque con los datos existentes (v2) [A]

- Con Metro en modo watch, Fast Refresh reevaluó el store al guardar `persist-policy.ts` (23:14:45) y el archivo MMKV
  se reescribió a las 23:14:46 sin un nuevo `Running "main"`: la migración v2→v3 REAL se ejecutó sobre los datos del
  dispositivo. Lectura del MMKV (`run-as`, solo recuentos): `_persist.version` 3, **15 órdenes y 15 registros
  conservados**, 13 `scheduled` y los 2 `unusable` de T8 restaurados como `blocked`.
- Arranque en frío (`force-stop` + dev client): `Running "main"`, Inicio renderizado, 0 líneas `E/` de la app, y el mismo
  estado v3 (15 órdenes, 2 `blocked`).
- Limitación: el estado v2 del dispositivo tenía el carrito y la búsqueda vacíos, así que su conservación en el
  dispositivo no se ha comprobado; la cubren los tests de `persist-policy` y del pipeline real de redux-persist. Sembrar
  un v2 con carrito sobrescribiendo el MMKV del dispositivo fue bloqueado por una comprobación de seguridad y no se hizo.

## T14 — RF-39 (texto y UI): aviso «denegadas recuperables» / «bloqueadas» con las mismas acciones — 2026-10-14

Alcance: función pura del aviso, clave i18n nueva y `OrderConfirmationScreen`. Sin dependencias, sin cambios nativos ni de
lógica de permisos/persistencia (T13). Basta Fast Refresh/recarga del Development Build.

### Código

- `src/features/checkout/logic/order-notification-notice.ts` (+ `order-notification-notice.test.ts`, 14 tests):
  `buildNotificationNotice(record | undefined)` → `{ messageKey, showSettings, showRetry, retrying } | null`, con la tabla
  del plan: `unusable` + `denied-recoverable` → `notificationDeniedRecoverable`; `unusable` + `blocked` (o sin razón) →
  `notificationUnavailableSettings`; ambas con Ajustes + reintento; `failed` → reintento sin Ajustes; `scheduling` →
  reintento deshabilitado; sin registro/`idle` → pendiente; `notified` → `null`. No existe acción «pedir de nuevo» (RF-23).
- `src/core/i18n/resources/es.ts` y `en.ts`: clave `checkout.confirmation.notificationDeniedRecoverable` con el texto aprobado.
  `notificationUnavailableSettings` no cambia (un test fija el texto exacto de ambas claves en ES/EN).
- `src/features/checkout/screens/OrderConfirmationScreen.tsx`: pinta lo que devuelve la función (sustituye el ternario
  anidado). Conserva botones, pistas, `accessibilityLiveRegion` y el `ScrollView`.

Decisión no cubierta por el plan: en `unusable` el botón de Ajustes ya NO depende de `canOpenSettings` (RF-39 exige las
mismas acciones y `canOpenSettings` siempre vale `true` en `unusable`); por eso la clave `notificationUnavailable` queda
sin uso. No se borró (se conserva el trabajo existente); retirarla es un seguimiento menor.

### Verificación

| Comprobación | Resultado |
|---|---|
| Test nuevo en rojo primero | **FALLA** por `ERR_MODULE_NOT_FOUND`; con el módulo creado, fallan solo los 3 tests de copy (clave ausente) |
| Dirigidos (`order-notification-notice` + `parity`) | **17/17** |
| `npm run test:logic` | **1082/1082** (1068 + 14) |
| `npx expo lint` / `npx tsc --noEmit` / `git diff --check` | **OK** / **OK** / **OK** |

### Samsung SM-A037M (Android 13, Development Build, Metro, mock en marcha, túneles 8081/3001) — 2026-10-14

Autoría: **[U]** = acciones hechas a mano por el usuario en el teléfono y medidas por el agente con instrumentación;
**[A]** = acciones y medidas del agente. (Corrección 2026-10-15: en la primera redacción estas acciones figuraban como
**[P]**, «persona no identificada»; el usuario confirmó después que las hizo él. Ver «Confirmación del usuario» al final
de esta sección.) Instrumentos: sondeo cada
3 s de `dumpsys window` (foco), `dumpsys package` (permiso y banderas), `run-as … shared_prefs/expo.modules.permissions.asked.xml`
(lectura), registros de notificación del MMKV (`run-as strings`, ids anonimizados) y `uiautomator`; `logcat` filtrado
(`REQUEST_PERMISSIONS` = cada vez que la app lanzó `GrantPermissionsActivity`). No se capturaron los datos del formulario
del usuario; los volcados temporales de `/sdcard` se borraron. Datos del agente: ficticios.

Estado encontrado: a las 23:25:22 el teléfono registró `clear data` de `com.herbstore.mobile` (no lo ejecutó el agente):
MMKV vacío, sin `expo.modules.permissions.asked.xml`, `POST_NOTIFICATIONS granted=false` sin `USER_SET`/`USER_FIXED`.

| Paso | Observación | Medida |
|---|---|---|
| 1. Orden A [U], ES: diálogo → «No permitir» | Diálogo de Android 13 (1.er `REQUEST_PERMISSIONS`); texto «No permitiste las notificaciones para este pedido. Puedes habilitarlas en Ajustes; podremos volver a preguntarte en tu próximo pedido.» + «Abrir ajustes de notificaciones» + «Reintentar notificación» | captura; registro `unusable` + `denied-recoverable`; banderas `USER_SET`; marca Expo `blocked:` = `false` |
| 2. Orden B [U], ES: el diálogo aparece una 2.ª vez → «No permitir» | «Las notificaciones están bloqueadas. Puedes habilitarlas en Ajustes.» con los MISMOS dos botones | `uiautomator`; 2.º `REQUEST_PERMISSIONS`; `USER_SET\|USER_FIXED`; marca `blocked:` = `true`; registro `blocked` |
| 3. [U] «Abrir ajustes» → Ajustes → «Permitir notificaciones» → volver → «Reintentar» (orden B) | aviso desaparece; notificación programada | `granted=true`; registro `scheduling` → `scheduled`, `notified: true`; `REQUEST_PERMISSIONS` sigue en 2 |
| Orden C [U], permiso concedido | se programa sin diálogo ni aviso | registro `scheduled`; `REQUEST_PERMISSIONS` = 2 |
| 4a. Reinicio [A] (`force-stop` + dev client) | la orden A conserva `denied-recoverable` y B/C `scheduled` | MMKV antes/después idéntico; `Running "main"` |
| `pm clear` [A] (autorizado) | estado de instalación nueva; idioma de la app → Inglés (Cuenta › Fundamentos) | sin marca Expo; `granted=false` sin banderas |
| 1-EN. Orden A' [A]: diálogo → «No permitir» | «You didn't allow notifications for this order. You can enable them in Settings; we may ask again on your next order.» + «Open notification settings» + «Try notification again» | `uiautomator` + captura; `REQUEST_PERMISSIONS` 3 |
| Reintento recuperable [A] (dos veces) | sin diálogo; mismo texto recuperable | `REQUEST_PERMISSIONS` sigue en 3; sondeo MMKV: `unusable` → `scheduling` → `unusable` (`denied-recoverable`) |
| 2-EN. Orden B' [A]: el diálogo aparece una 2.ª vez → «No permitir» | «Notifications are blocked. You can enable them in Settings.» con los mismos botones; el reintento no abre diálogo | `REQUEST_PERMISSIONS` 4 → 4; `USER_FIXED`; marca `blocked:` = `true`; registro `blocked` |
| 4b. Reinicio [A] + `herbstore://order-confirmation` | la orden B' sigue en «bloqueadas»; la app volvió al idioma del sistema, así que el texto se ve en ES (bloqueadas en ES también medido por el agente) | `uiautomator` + captura |
| 5a. `font_scale` 2.0 [A], bloqueadas | texto completo en 3 líneas; botones crecen con el texto (184 px de alto) | captura + `uiautomator` |
| 2.º `pm clear` [A] + orden A'' ES rechazada a 1.0 | texto recuperable en ES | `REQUEST_PERMISSIONS` 5 |
| 5b. `font_scale` 2.0 [A], recuperable | texto completo en 7 líneas; desplazando se alcanzan «Abrir ajustes…», «Reintentar…» y «Volver al carrito» (cada uno ≥108 px) | capturas + `uiautomator` |
| 3-bis [A] a 1.0: «Abrir ajustes» → Notificaciones → «Permitir notificaciones» → volver → reabrir confirmación → «Reintentar» | aviso desaparece; «Pedido confirmado / Tu compra se completó.» publicada | `granted=true`; registro `scheduled`, `notified: true`; `REQUEST_PERMISSIONS` 5 → 5 |

`E/`/`W/ReactNativeJS` en todo el recorrido: **0**. A 1.0 los botones miden 90 px (48 dp). Targets, rol `button` y región
viva no cambian (mismo `AppButton`/`AppText`).

Observaciones sin criterio propio:
- La confirmación siempre muestra la ÚLTIMA orden; la categoría de una orden anterior solo es visible en el MMKV.
- Tras `force-stop`, el idioma elegido en Fundamentos (EN) volvió al del sistema (ES). Coincide con la observación histórica
  [A] de H-T8-5 y contradice la confirmación posterior del usuario; se registra sin afirmar causa. (2026-10-15: conciliado
  como comportamiento por diseño; ver H-T8-5 en «Cierre documental de T8».)
- Al volver de Ajustes, la app quedó una vez en Inicio en lugar de la confirmación (hubo un cambio de `font_scale` justo
  antes, patrón conocido); se reabrió con el deep link.
- Android con diálogo: el sistema mostró el diálogo DOS veces por instalación (1.er rechazo → recuperable; 2.º → bloqueadas),
  como describe el caso límite de la spec. La variante Android sin diálogo sigue cubierta solo por tests (RF-33). iOS: pase
  único de T8.

Estado final del dispositivo: `font_scale` 1.0, tema claro, `es-US`, app en Inicio sin flecha, `POST_NOTIFICATIONS`
**concedido** (`USER_SET`), notificación de HerbStore descartada. Por los `pm clear` (uno ajeno y dos del agente) se perdieron
el carrito, el historial y las órdenes ficticias anteriores; quedan 1 orden ficticia (`scheduled`) y la marca Expo
`blocked:` = `false` en `shared_prefs` (un solo rechazo tras el último `pm clear`). `stay_on_while_plugged_in` sigue en 3 (de T6).

### Confirmación del usuario — 2026-10-15

El usuario confirmó que las acciones marcadas antes como [P] las hizo él y reportó «1 ok, 2 ok, 3 ok, 4 ok» [U]:

1. Orden A: texto recuperable en ES/EN y reintento sin diálogo.
2. Orden B: bloqueadas, con los mismos botones.
3. Ajustes + reintento: el aviso desaparece.
4. Reinicio y texto grande: correctos.

Nota práctica: en el checkout conviene usar datos inventados (nombre, dirección, teléfono). El mock guarda las órdenes
solo en memoria (`Map` de `mock-server/src/orders/order-store.js`) y desaparecen al reiniciarlo, así que no hace falta
introducir datos reales para ninguna prueba.

### Seguimiento menor → Día 6

- La clave i18n `checkout.confirmation.notificationUnavailable` (ES/EN) queda sin uso tras T14. No se borró; retirarla
  (y comprobar `parity.test.ts`) es un seguimiento menor del Día 6. No se implementa en este pase.

## T8 — pase iOS único — 2026-10-15

Alcance: RF-23–RF-25, RF-32–RF-34, RF-37–RF-39, RNF-1–RNF-4 en **iOS Simulator** (iPhone 17 Pro, iOS 26.5), una sola
pasada, **sin recompilar** el binario (el `.app` Debug de DerivedData es de 2026-10-14 22:02; solo se reinstaló, autorizado
por el usuario el 2026-10-14). Metro (`expo start --dev-client`, ya en marcha) y el mock (puerto 3001, ya en marcha) estaban
activos; no se tocaron `ios/`, `android/`, dependencias ni código de producto (`git diff --stat -- src` igual antes y después).
No se usó `simctl push`: cada notificación salió de una orden real (4 órdenes con datos inventados). Leyenda: **[A]** medido
por el agente (`axe describe-ui`/`touch`/`key-sequence`, `simctl io screenshot`, log de Metro), **[U]** hecho por el usuario.
En esta pasada no hubo acciones [U]: todo fue [A]. El Samsung no se tocó (Android ya validado en T8/T14).

Evidencia iOS previa que NO se repitió: alerta de permiso, banner, tap con la app activa y tap en arranque frío
(`source=initial`), y los adelantos de RF-37 (3 recorridos) y RF-38 (apertura sin intento). Sí se repitió, por tratarse del
pase formal, RF-37 (desde la raíz, con detalle apilado y con doble toque) y RF-38 con una orden 202 real.

### Método y herramientas (para reproducir)

- Reinstalación: `simctl terminate` + `simctl uninstall com.herbstore.mobile` + `simctl install <.app Debug de DerivedData>`;
  se perdieron los datos locales (ficticios) y el permiso de notificaciones volvió a «sin pedir». Hoja de bienvenida del dev
  client: «Continue».
- Checkout con `axe`: `axe type` desordena y duplica letras (p. ej. «Ana Prueba» → «Ana Prebau»; Cmd+A no selecciona) y
  tocar un campo justo después de teclear en otro a veces no cambia el foco. Lo que SÍ fue reproducible (4 órdenes, 4 veces):
  tocar cada campo dos veces y teclear con `axe key-sequence --keycodes <HID> --delay 0.12` (letras 4–29, dígitos 30–39,
  espacio 44), desplazar con `axe swipe` 700→300 y rellenar «Número exterior» ya en pantalla. El campo «Número interior» se
  deja vacío (H-T8-1 corregido). No hizo falta cambiar `AutomaticMinimizationEnabled` (sigue en `true`).
- Cuidado: teclear con la app SIN un campo enfocado manda teclas al dev client (en una ocasión la app se recargó y el idioma
  volvió a ES; causa probable, no confirmada). Ejecutar el relleno solo con el formulario abierto.
- Diálogo de permiso: mientras la alerta del sistema está abierta, `axe describe-ui` solo ve la alerta (la app queda fuera
  del árbol) y los toques no llegan a la app; para el estado «Programando…» se usó captura.
- Un banner nuevo se redibuja con el tamaño de texto vigente en ese instante; un banner ya mostrado no.

### RF-39 — tras RECHAZAR el diálogo (1.ª orden tras reinstalar) [A]

| Paso | Observado |
| --- | --- |
| Orden → confirmación | alerta del sistema «HerbStore quiere enviarte notificaciones» (ES del Simulator) con «No permitir»/«Permitir»; detrás, la pantalla muestra «Programando…» en el botón de reintento (deshabilitado, gris) y «Volver al carrito» activo |
| «No permitir» (ES, tema claro, `large`) | «Las notificaciones están bloqueadas. Puedes habilitarlas en Ajustes.» con **dos** botones, «Abrir ajustes de notificaciones» y «Reintentar notificación», más «Volver al carrito» |
| Mismo estado en inglés (elegido en Cuenta > Fundamentos) | «Notifications are blocked. You can enable them in Settings.» con «Open notification settings» y «Try notification again»; texto igual en claro y oscuro |
| «Try notification again» con el permiso aún rechazado | sin diálogo nuevo y sin cambio de texto (RF-23: no se vuelve a pedir acceso a la misma orden) |
| «Abrir ajustes» | en este Simulator abre la raíz de Ajustes, no la página de HerbStore; se navegó Apps > HerbStore > Notificaciones (la fila ya decía «Notificaciones, No») y se activó «Permitir notificaciones». Ajustes se usó SOLO para habilitar tras el rechazo real (caso de uso de RF-39), nunca como sustituto del rechazo |
| Vuelta a la app y «Try notification again» | el aviso y los botones de reintento desaparecen, queda solo «Back to cart», y aparece el banner **inglés** «Order confirmed / Your purchase was completed.» (sin id de orden ni dirección) |

La categoría «denegada recuperable» no existe en iOS (spec, caso límite de RF-39): el rechazo del diálogo en iOS muestra siempre
el texto de bloqueadas; el texto recuperable queda validado en Android (T14). El rechazo se hizo una sola vez.

### Superficie de notificación (confirmación del pedido y banner) [A]

| Criterio | Resultado iOS Simulator |
| --- | --- |
| Programación | «Programando…» visible detrás de la alerta (captura); tras responder, `scheduling` → `unusable`; tras habilitar y reintentar, `scheduled` y la notificación se muestra en primer plano. En las órdenes con el permiso ya concedido el banner salió sin alerta |
| Cancelación durante la espera | **Limitación de iOS, ver «Criterios y límites».** Con la alerta abierta ningún toque llega a la app. Sí se probó «Cancelar espera» de la consulta del pedido (RF-38) y «Volver al carrito» tras responder |
| Inglés | pantalla y banner en inglés (ver arriba); título y cuerpo de la notificación localizados por el idioma activo al programar |
| Tema oscuro | pantalla (fondo y botones) y banner legibles; «Back to cart» relleno verde claro con texto oscuro |
| Texto `accessibility-extra-extra-extra-large` (relanzando la app antes de medir, H-10) | el aviso (600 pt de alto) y los botones (304, 161 y 161 pt) crecen y se alcanzan desplazando el `ScrollView`; el texto completo se lee. El banner a ese tamaño envuelve título y cuerpo completos, sin truncar ni mostrar id/dirección. A `large`: botones de 370×48 pt |
| Roles | `Heading` (título), `StaticText` (id, unidades, aviso), `Button` (3 acciones), `Heading` en la barra; nombres en ES/EN como en los textos |
| Estado ocupado/deshabilitado | el reintento en curso cambia su rótulo a «Programando…» y se deshabilita (`accessibilityState.disabled`); NO se expone un estado `busy` aparte (el componente `AppButton` no lo define). Igual criterio que el aceptado en Android |
| Foco | orden del árbol de accesibilidad de arriba abajo (título, id, unidades, aviso, Ajustes, Reintentar, Volver) y todos los controles son alcanzables; VoiceOver real no disponible en el Simulator |
| Targets ≥44 pt | 48 pt de alto por 370 de ancho a `large`; a AXXXL 161–304 pt |
| Reduced motion | `ReduceMotionEnabled` = 1 (Fundamentos mostró «Reduced motion: on»; la consola dio el aviso de desarrollo de Reanimated). La superficie no define animación propia (el feedback de pulsación de `AppButton` se desactiva con esa preferencia) y los estados de la 2.ª y 3.ª orden (consulta pendiente, confirmación, banner) se vieron estáticos y completos |

### RF-37 — «Ir a Inicio» del carrito vacío [A] (carrito vacío en los tres casos)

| Partida | Resultado |
| --- | --- |
| Inicio en su raíz | Inicio en la raíz, 0 botones de retroceso en el árbol; el gesto de borde (swipe x 2→320) no revela nada |
| Inicio con un detalle apilado (Daily Balance Powder) | raíz de Inicio, 0 botones de retroceso, gesto de borde sin efecto; el detalle ya no está |
| Detalle apilado + doble toque simultáneo | igual que el anterior: raíz sin flecha ni instancias duplicadas |

0 apariciones de «was not handled by any navigator» ni «not handled» en Metro durante toda la pasada.

### RF-38 — consulta del pedido [A]

| Caso | Resultado |
| --- | --- |
| 202 `pending` → «Consultar estado» (4 órdenes reales) | llega a «Pedido confirmado» una sola vez: el log de Metro registra exactamente una línea `[order-status] redirect -> order-confirmation (from consult)` por consulta (4 y 4); sin toast de LogBox y 0 coincidencias de «Cannot update a component» |
| «Cancelar espera» con la orden pendiente | vuelve al Carrito (que muestra «Pedido sin resolver» y «Reabrir consulta»); no hay línea `redirect` ni advertencia; «Reabrir consulta» → «Consultar estado» confirma la misma orden con una sola redirección |

### Observaciones sin criterio de aceptación [A]

- **Pantalla de enlace no reconocido** (`herbstore://zzz-unknown`): título «We couldn't find this screen», «Link not recognized», botones «Go back» y «Go to Home». «Go to Home» desde Inicio en su raíz llega a Inicio sin flecha. Desde Inicio con un detalle apilado, llega a un Inicio NUEVO encima del detalle, con flecha «Product» (la salida no se corrigió por RF-37, a propósito: el mismo patrón que RF-37 resolvió para el carrito). La flecha de la pantalla muestra el nombre de ruta crudo «(tabs)» como etiqueta.
- **S-RF24** (tap de la notificación con Inicio apilado): con Inicio = [Inicio, detalle de Daily Balance], tras una orden desde la pestaña Carrito, el tap del banner con la app activa registró `tap source=active decision=navigate` una vez y llevó a Inicio EN SU RAÍZ: 0 botones de retroceso, gesto de borde sin efecto y sin detalle ni encima ni debajo. **No se confirmó el defecto deducido** para este recorrido; `go-home.ts` no se tocó. No se repitió con el tap frío (ya observado) ni con otros destinos.

### Criterios y límites

- Cubierto con evidencia iOS real en el Simulator: todo lo anterior. No se afirma validación en iPhone físico: **Taptic, VoiceOver real, comportamiento del sistema de notificaciones en dispositivo, y el estado `provisional`/`ephemeral`** (solo por tests) no son acreditables aquí.
- «Cancelar durante la espera»: en iOS la alerta de permiso es modal del sistema y bloquea toda interacción con la app mientras la orden está en `scheduling`; la programación termina en cuanto se responde. Lo comprobable es que, al estar abierta, la pantalla ya mostraba «Programando…» deshabilitado con «Volver al carrito» activo (captura), y que tras responder los controles de salida responden. Es el mismo grado de evidencia aceptado en Android (diálogo modal).
- Reiniciar el idioma: tras cada relanzamiento la app vuelve al idioma del sistema (H-T8-5, por diseño); el inglés se eligió en Fundamentos antes de cada medición.

### Hallazgos nuevos (no corregidos; sin cambio de producto)

- **H-T8-6 (Baja, Día 6):** con texto AXXXL, «Abrir ajustes de notificaciones» parte la palabra («notificacione» / «s») dentro de su botón de 370 pt. No se aplicó tope de escala al botón (patrón H-10/H-12).
- **H-T8-7 (Baja, Día 2/Día 6):** el botón de retroceso de la pantalla de enlace no reconocido se etiqueta con el nombre de ruta «(tabs)»; es ruido para VoiceOver.
- **H-T8-8 (Baja, Día 4):** la confirmación dice «1 unidades»/«1 units» (falta plural).
- **H-T8-9 (Informativa):** en este Simulator `Linking.openSettings()` abre la raíz de Ajustes, no la página de la app; no se atribuye a la app ni se probó en iPhone físico.
- **H-10 se repite:** cambiar `content_size` con la app abierta deja textos recortados y el árbol de accesibilidad con medidas obsoletas hasta relanzar.
- La etiqueta del botón de retroceso del encabezado (p. ej. «Carrito») puede quedar en el idioma anterior hasta una nueva navegación, consecuencia de que el idioma no se persista.

### Aceptación del usuario — 2026-10-15

El usuario decidió aceptar la limitación de «cancelar durante la espera» en iOS (la alerta de permiso del sistema es modal y
bloquea todo toque mientras la orden está en `scheduling`; ver «Criterios y límites») con evidencia **por captura**, el mismo
grado que se aceptó en Android, y **cerrar T8**. No se amplía la evidencia ni se toca producto. Siguiente paso: validación de
@reviewer RF por RF y después T10.

### Seguimientos → Día 6

Registrados con la severidad indicada arriba en «Hallazgos nuevos» (no se corrigen en el Día 5):

- H-T8-6 (Baja): palabra partida a AXXXL en «Abrir ajustes de notificaciones».
- H-T8-7 (Baja): flecha de la pantalla de enlace no reconocido etiquetada «(tabs)».
- H-T8-8 (Baja, Día 4): «1 unidades»/«1 units» en la confirmación (falta plural).
- H-T8-9 (Informativa): `Linking.openSettings()` abre la raíz de Ajustes en este Simulator.
- Observación sin criterio: «Ir a Inicio» de la pantalla de enlace no reconocido crea un Inicio nuevo encima (flecha «Product»)
  cuando Inicio tenía un detalle apilado. S-RF24 (tap de notificación con Inicio apilado) no se reprodujo en el recorrido probado.
- H-10 se repite en iOS (cambiar el tamaño de texto con la app abierta deja textos cortados hasta relanzar).
- Menor ya registrado (T14): retirar la clave `checkout.confirmation.notificationUnavailable` sin uso.

### Estado final del Simulator

Apariencia `light`, tamaño de texto `large`, `ReduceMotionEnabled` = 0, `AutomaticMinimizationEnabled` = `true` (no se cambió),
`AccessibilityEnabled`/`ApplicationAccessibilityEnabled` = 1 (como se encontraron). App en Inicio (ES), carrito vacío, con
el permiso de notificaciones **concedido** (tras habilitarlo en Ajustes) y 3 órdenes ficticias en el historial local (la 1.ª, anterior a la reinstalación, se perdió con ella); Metro y el mock
siguen en marcha como estaban. Samsung sin cambios.


## Cierre de T10 — 2026-10-15

> **Superada en parte por «Cierre de T10, vuelta 2» y por «Estado vigente»:** el 20/21 de Doctor, el install-check rojo, los ids `a13ab87a…`/`08cf7ee7…`/`c66441e0…` y las huellas `a6659518…`/`27b01168…` son del mediodía, previos a los parches.

Ejecución de T10 (RF-1–RF-3, RF-27, RF-32–RF-36, RNF-1–RNF-5). No se cambió código de producto ni se instaló ninguna dependencia. **Resultado: la evidencia remota (RF-28/RF-36) existe, pero T10 NO se marca**: `expo install --check` y Doctor no están verdes por tres parches nuevos (ver A).

### A. Regresión final (2026-10-15)

| Comando | Resultado | Nota |
|---|---|---|
| `npm run test:logic` | **1082/1082**, 0 fallos | `node:test`; sustituye la cifra 1013/1013 de 2026-10-14 |
| `npx expo lint` | **OK**, sin salida | — |
| `npx tsc --noEmit` | **OK**, sin salida | — |
| `git diff --check` | **OK**, sin salida | repetido tras los cambios de `app.json`/`eas.json` |
| `npx expo install --check` | **FALLA** (código 1) | `@expo/ui` 57.0.24 → ~57.0.25, `expo` 57.0.29 → ~57.0.30, `expo-router` 57.0.27 → ~57.0.28 |
| `npx expo-doctor@latest` | **20/21** | falla solo «packages match versions required by installed Expo SDK», por los mismos tres parches; repetido tras `eas init`, sin comprobaciones nuevas en rojo |

Los tres parches son de la misma línea SDK 57 y los recomienda el propio Doctor, pero `expo` y `expo-router` llevan código nativo: aplicarlos cambia dependencias y la huella, obliga a regenerar CNG y recompilar ambos Development Builds y a repetir la matriz. Por instrucción del usuario NO se aplicaron ni se usó `npm audit fix --force`. **Pregunta abierta:** ¿aplicarlos ahora (`npx expo install expo@~57.0.30 @expo/ui@~57.0.25 expo-router@~57.0.28` y repetir recompilación y matriz mínima) o aceptar la divergencia y excepcionar ese criterio? Ayer (2026-10-14) se alinearon seis parches con el mismo método (sección «Corrección 2 de T10»).

### B. Development Builds locales

Sin recompilar (A no lo exige: no cambió ninguna dependencia ni configuración nativa desde la recompilación del 2026-10-14). Se reutiliza la evidencia fechada de T2–T8 y T11–T14 en Samsung SM-A037M e iPhone 17 Pro Simulator; no se repitió ninguna prueba porque nada de lo ya validado cambió (los cambios de hoy son `eas.json`, `extra.eas.projectId` y documentación). Límites que se mantienen, sin atribuirlos al otro entorno: el Simulator no acredita cámara óptica, Taptic Engine ni VoiceOver real; la variante Android «sin diálogo runtime» (API < 33) sigue siendo determinista y no validada realmente en dispositivo, porque el Samsung es Android 13 (variante con diálogo).

### C. EAS remoto (RF-28 / RF-36)

**Sesión:** `eas whoami` confirmó una sesión iniciada por el usuario (no se mostró ni guardó ningún token, `EXPO_TOKEN` ni credencial; el correo y el nombre de cuenta no se registran). El proyecto se vinculó con `eas init` autorizado por el usuario, bajo su cuenta personal (la sesión tiene también una cuenta de equipo; se eligió la personal, ver preguntas).

**`eas init` y `app.json`.** Se guardó una copia antes (el archivo ya tenía cambios sin commitear del usuario). `eas init` reescribió `app.json` con la configuración resuelta por los plugins, lo que sobrepasaba lo autorizado: añadió `ios.infoPlist.CFBundleLocalizations`, `android.permissions` (`CAMERA`), `extra.router` y `owner`. Se restauró la copia y se aplicó SOLO `extra.eas.projectId`; `diff` contra la copia confirma que es lo único que cambió. `owner` no hizo falta (las compilaciones se crearon con el `projectId`). El `projectId` no es un secreto. Efecto lateral en la cuenta: EAS fijó el icono del proyecto desde el icono de la app.

**`EXPO_PUBLIC_API_ORIGIN` en las compilaciones.** Se declara en `eas.json`, en `env` de cada perfil, con el placeholder público de `.env.example` (`https://api.example.test`). Motivo: es un valor público y no secreto (el prefijo `EXPO_PUBLIC_` lo incluye en el bundle), el archivo está versionado y la compilación es reproducible desde Git sin estado en el panel de EAS. Alternativa descartada: variables hospedadas en EAS (CLI/panel) con visibilidad «Plain text»/«Sensitive» (`secret` no es válido para variables que acaban en el cliente). Es la opción recomendada para valores por entorno que no deben vivir en el repositorio o cuando la URL real cambie; aquí añadiría estado de cuenta sin necesidad. La documentación consultada de EAS describe ambas vías (`env` en el perfil y el campo `environment` con variables hospedadas) pero no fija precedencia entre ellas ni declara una como obligatoria; el log de cada build confirmó «Environment variables loaded from the "development" build profile "env" configuration» y que el entorno hospedado no tenía variables. Sin IP local ni dato personal.

**Builds remotos** (`--non-interactive --no-wait`, sin credenciales de Apple; páginas públicas del build bajo `https://expo.dev/accounts/<cuenta personal>/projects/HerbStore/builds/<id>`):

| Fecha (UTC) | Perfil | Plataforma | Resultado | Id del build | Cola / compilación | Huella remota |
|---|---|---|---|---|---|---|
| 2026-10-15 16:14 → 17:05 | `development` | Android (APK) | **FINISHED** | `a13ab87a-e5a7-4529-a977-bd28ef19b888` | 31 min / 20 min | `a6659518…` |
| 2026-10-15 16:14 → 16:22 | `development` | iOS (Simulator) | **FINISHED** | `08cf7ee7-bbff-4c34-bad8-91d6662206f2` | 7 s / 7 min | `27b01168…` |
| 2026-10-15 16:15 → 17:09 | `preview` | Android (APK) | **FINISHED** | `c66441e0-7511-414f-8eb4-e819a2a99156` | 31 min / 23 min | `a6659518…` |
| — | `preview` | iOS (`simulator: false`) | **NO INTENTADO — LIMITACIÓN** | — | — | — |

Los tres con `runtime` `file:fingerprint`, SDK 57, identificador `com.herbstore.mobile`, versión 1.0.0 (1) y artefacto generado (caduca a los 14 días). Sin errores. Plan gratuito: la cola de Android fue de ~31 min (iOS Simulator, 7 s); no se lanzó ningún build duplicado.

**Limitaciones declaradas (no son fallos):**
1. `preview` iOS (`simulator: false`) exige credenciales de Apple (certificado y perfil de aprovisionamiento) y queda sin validar remotamente por decisión del usuario; solo tiene validación local de configuración.
2. Los artefactos no se instalaron ni se ejecutaron. La URL del catálogo es un placeholder inexistente: la tubería (instalación de dependencias, módulo Kotlin/Swift, plugins, CNG, compilación) queda validada, pero la app compilada no cargaría catálogo. El gate de la URL (RF-30) pasa porque el placeholder es un origen HTTP(S) bare válido; su caso «ausente» sigue acreditado por `public-config.test.ts` y la evidencia local de T1.
3. El `gitCommitHash` que muestra EAS es el de `HEAD` (`4e95c67`, Día 4), no un commit del Día 5, porque los builds se lanzaron antes de ese commit. El contenido subido fue el árbol de trabajo (inferido de que la huella remota coincide con la local, que incluye el módulo, `expo-camera`, `expo-notifications` y los plugins del Día 5; no se verificó en los logs de compilación). Una compilación reproducible desde un commit solo es posible a partir del commit de cierre (los builds de EAS ya hechos no lo son).
4. En Android, EAS generó y guarda un keystore de firma en la cuenta del usuario («Created keystore») para poder firmar el APK. Es una credencial de EAS en su cuenta, nunca en Git ni en esta evidencia.
5. Aviso de la compilación iOS: `ios.infoPlist.ITSAppUsesNonExemptEncryption` ausente en `app.json` (relevante solo para App Store Connect, fuera de alcance). Seguimiento del Día 6.

### D. Comparación con la matriz OTA (RF-31)

La huella que calculó EAS en sus dos plataformas coincide con la que calcula `fingerprint:generate` en local (Android `a66595180…`, 97 fuentes; iOS `27b011687…`, 95), hasta ahora solo «no verificado en remoto». Esto confirma que el hash local sirve para decidir OTA frente a binario. La huella base documentada (`96c8994e…` Android, `7ac6ef07…` iOS) cambió porque, después de medirla, se añadieron `extra.eas.projectId` a `app.json` y `env` a `eas.json` (ambos entran en la huella; no se aisló cuál contribuye cada uno). Para Android las dos compilaciones (`development` y `preview`) tienen la misma huella.

### E. Limpieza de seguimientos del reviewer

M1 (bloque «Estado vigente» y secciones superadas rotuladas), L1 (UDID del Simulator y rutas con el nombre de usuario sustituidos), M3 (avisos de `tasks.md` fechados) y L2 (`MEMORY.md` comprimida; el detalle está en el apéndice de abajo) quedaron resueltos. M4 queda resuelta por la validación remota (sección C).

### Seguimientos → Día 6 (registrados, NO decididos por el usuario)

- Política de huella (`--source-skips 513`) para que subir `version`/`versionCode`/`buildNumber` no cuente como cambio nativo.
- Falso negativo de `locales/` en la huella (regla práctica mientras tanto: cambio en `locales/` = binario nuevo).
- `expo-updates` si algún día se quiere una OTA real (hoy `runtimeVersion: fingerprint` es un metadato inerte).
- `ITSAppUsesNonExemptEncryption` en `app.json` (aviso de EAS iOS).
- `preview` iOS con `simulator: false` y credenciales de Apple, si se quiere validación remota completa.
- Sustituir el placeholder por una URL real de catálogo (variable hospedada en EAS con visibilidad «Plain text») cuando exista un backend desplegado.
- Los pendientes del Día 6 ya registrados (H-T8-6..9, H-10, VoiceOver real, iPhone físico, Jest/RNTL/Maestro, etc.).


## Cierre de T10, vuelta 2 — tres parches SDK 57 aplicados, recompilación y builds EAS repetidos — 2026-10-15

Decisión del usuario (2026-10-15): aplicar los tres parches y repetir lo necesario, como se hizo con los seis de la «Corrección 2 de T10». No se usó `npm audit fix --force` ni se instaló ninguna otra dependencia (ni `expo-updates`). No se cambió código de producto.

### A. Parches y verificación

Comando: `npx expo install expo@~57.0.30 @expo/ui@~57.0.25 expo-router@~57.0.28` (npm avisó de 29 vulnerabilidades preexistentes y de un script de instalación sin autorizar, `unrs-resolver`; no se tocó nada de eso).

| Paquete | Antes | Después |
|---|---|---|
| `expo` | ~57.0.29 | ~57.0.30 |
| `expo-router` | ~57.0.27 | ~57.0.28 |
| `@expo/ui` | ~57.0.24 | ~57.0.25 |

`git diff` de `package.json` cambia solo esas tres líneas. `package-lock.json` cambia esas tres y lo transitorio esperable de la misma línea: `@expo/cli` 57.0.30→57.0.31, `@expo/router-server` 57.0.12→57.0.13, `babel-preset-expo` 57.0.15→57.0.16 y rangos internos de `expo-constants`, `@expo/metro-runtime` y `expo-widgets`. No aparecieron parches nuevos adicionales.

| Comprobación | Resultado |
|---|---|
| `npx expo install --check` | **Dependencies are up to date** |
| `npx expo-doctor@latest` | **21/21 checks passed** |
| `npm run test:logic` | **1082/1082**, 0 fallos |
| `npx expo lint` / `npx tsc --noEmit` / `git diff --check` | OK / OK / OK |

### B. Recompilación de los Development Builds

- Android, Samsung SM-A037M (USB, Android 13): `npx expo run:android --device SM_A037M --no-bundler` con JDK 21 y `ANDROID_HOME` → **BUILD SUCCESSFUL** (18 s, caché de Gradle), APK instalado y abierto.
- iOS Simulator iPhone 17 Pro (iOS 26.5): `ONLY_ACTIVE_ARCH=YES npx expo run:ios --device "iPhone 17 Pro" --no-bundler` → **Build Succeeded** (0 errores, 1 aviso previo del script «Strip Local Network Keys for Release» del dev launcher); `Podfile.lock` ya refleja `Expo (57.0.30)`. Esta vez no hizo falta `npx expo prebuild --clean` ni `pod update`: CocoaPods resolvió solo. No se editó `ios/` ni `android/`. No se generó ninguna salida Release; el disco del Mac sigue justo (≈3 GiB libres).
- Metro se reinició con `EXPO_PUBLIC_API_ORIGIN=http://localhost:3001` (solo en el proceso, sin `.env.local`) y `-c`. Sin la variable, el gate de URL (RF-30) mostró «Configuración necesaria» en el Samsung: la pantalla es el comportamiento esperado y quedó observada de paso.

### C. Matriz mínima de humo tras recompilar (datos inventados)

Todo [A] (`uiautomator`/`axe` y capturas). Sin atribuir cámara óptica, Taptic ni VoiceOver real al Simulator.

| Paso | Samsung SM-A037M (Android 13) | iOS Simulator (iPhone 17 Pro, iOS 26.5) |
|---|---|---|
| Arranque en Inicio sin errores | OK; `logcat` de `ReactNativeJS` sin errores ni avisos | OK; sin `ERROR` en Metro (solo el `WARN` normal del dev launcher al reabrir: «bundle scheme is file») |
| Cuenta > DeviceInsights (síncrono, asíncrono, evento, vista nativa) | OK: «Plataforma: Android», «Actualización completada: SM-A037M, sistema 13, dispositivo físico», evento nativo y vista accesible | OK: «Plataforma: iOS», «Actualización completada: iPhone, sistema 26.5, simulador», evento recibido |
| Escáner abre y muestra su estado | OK: «Antes de continuar, confirma que quieres permitir el acceso a la cámara», Continuar/Cerrar y X «Cerrar» | OK por botón y por `herbstore://scanner` (mismo estado previo al permiso); sin lectura óptica |
| `herbstore://product/<id>` | OK (`product-261009-002`, detalle con stock y precio) | OK (`product-261009-003` y `-004`) |
| Orden ficticia hasta la confirmación | OK: 202 `pending` → «Consultar estado» → «Pedido confirmado»; `POST_NOTIFICATIONS` concedido y una notificación publicada en el canal `orders` (`dumpsys notification`); sin aviso de permiso porque el permiso ya estaba concedido | OK: «Pedido confirmado» y banner del sistema «Pedido confirmado · Tu compra se completó.» |
| «Ir a Inicio» del carrito vacío (RF-37) | OK: con el detalle del deep link apilado en Inicio, vuelve a la raíz de Inicio (título «Inicio», sin flecha) | OK: mismo resultado desde un carrito vacío con detalle apilado |

Notas de la ejecución:
- El «aviso de notificación» de la confirmación (RF-39) solo aparece con permiso inutilizable; con permiso concedido el resultado observable es la notificación programada. Los textos «denegadas recuperables / bloqueadas» no se repitieron aquí: ya están validados en el pase iOS único de T8 y en Samsung.
- En iOS, tocar el botón del escáner en (362, 156–160) no hizo nada: ese punto está bajo el área táctil del botón flotante «Tools» del dev client (solo `__DEV__`); tocando en (350, 172) abre el escáner. No es una regresión de los parches (el enlace directo funciona y el botón responde fuera de esa zona). Observación para el Día 6 junto a la que ya existe sobre el botón Tools tapando el Atrás.
- Teclado iOS: se aplicó el truco de `AutomaticMinimizationEnabled` (restaurado a `true`) y teclas HID; «Tab» no mueve el foco, hay que tocar cada campo. Al pulsar «Carrito» por etiqueta, `axe` casó antes con «Agregar al carrito» y añadió una unidad extra (se eliminó del carrito antes de comprobar RF-37).
- El mock siguió en el puerto 3001 y las órdenes de prueba (2) solo viven en su memoria. Samsung e iOS: datos de entrega inventados («test user», «Jalisco», «Test», «calle uno»), sin PII.

### D. Builds EAS repetidos (RF-28 / RF-36)

`npx eas-cli@latest build --platform <p> --profile <perfil> --non-interactive --no-wait`, sin credenciales de Apple y sin duplicados (un primer intento falló antes de subir por un error mío al construir los argumentos del bucle de shell, `Flag --profile expects a value`; no creó ningún build). La URL pública de cada build es `https://expo.dev/accounts/<cuenta personal>/projects/HerbStore/builds/<id>`.

| Fecha (UTC) | Perfil | Plataforma | Resultado | Id del build | Duración total (cola + compilación) | Huella remota |
|---|---|---|---|---|---|---|
| 2026-10-15 17:31 → 18:09 | `development` | Android (APK) | **FINISHED** | `f8ab7c9a-d558-4e4a-ad6f-3abe40d2f40e` | ≈38 min | `13218f3f…` |
| 2026-10-15 17:31 → 17:41 | `development` | iOS (Simulator) | **FINISHED** | `a5934fef-6623-4f16-80a4-2b1eb2cb48c4` | ≈10 min | `156ff282…` |
| 2026-10-15 17:31 → 18:14 | `preview` | Android (APK) | **FINISHED** | `527f5684-6357-46ba-a58f-32b6d8f8d2f3` | ≈43 min | `13218f3f…` |
| — | `preview` | iOS (`simulator: false`) | **NO INTENTADO — LIMITACIÓN** | — | — | — |

Los tres con `runtime` `file:fingerprint`, SDK 57, identificador `com.herbstore.mobile`, versión 1.0.0 (1), artefacto generado y sin error. Siguen vigentes las limitaciones de la sección «Cierre de T10 — 2026-10-15»: `preview` iOS exige credenciales de Apple (decisión del usuario), la URL del catálogo es el placeholder `https://api.example.test` y los artefactos no se instalaron, el `gitCommitHash` que muestra EAS sigue siendo el de `HEAD` (`4e95c67`, Día 4) porque los builds se lanzaron antes del commit de cierre, y el keystore Android ya existía en la cuenta del usuario (EAS lo reutilizó, no creó otro). Los tres builds del mediodía (`a13ab87a…`, `08cf7ee7…`, `c66441e0…`) quedan como registro previo al parche; no se borran ni se reutilizan.

### E. Huellas (comparación con las anteriores)

| Plataforma | Local (`fingerprint:generate`) | Remota (EAS) | Anterior | Fuentes |
|---|---|---|---|---|
| Android | `13218f3f83bd879d9488a408a831434c3588f7c1` | `13218f3f…` | `a6659518…` | 97 |
| iOS | `156ff282959819916ca519c904f9a91c3c2f73f5` | `156ff282…` | `27b01168…` | 95 |

La huella local y la remota coinciden en ambas plataformas, como el 2026-10-15 por la mañana. **Cambió respecto a la anterior por los parches**: `node_modules/expo/package.json`, los directorios nativos `node_modules/@expo/ui/android` y `node_modules/expo-router/android` y las configuraciones de autolinking (`expoAutolinkingConfig`, `rncoreAutolinkingConfig`, que llevan las versiones) son fuentes de la huella, y los tres paquetes subieron de versión. No se aisló cuánto aporta cada una. Es el comportamiento que prescribe la matriz OTA: un cambio de dependencia nativa exige un runtime/binario nuevo, y los builds de esta vuelta lo reflejan. Las dos compilaciones Android (`development` y `preview`) comparten huella.

### F. Estado tras esta vuelta

**Criterios de T10 (RF-1–RF-3, RF-27, RF-32–RF-36, RNF-1–RNF-5):** `npm run test:logic`, lint, typecheck, install-check y Doctor pasan (1082/1082, OK, OK, up to date, 21/21); los Development Builds se recompilaron y la matriz mínima pasó en Android físico e iOS Simulator sobre la base de la validación completa de T2–T8 y T11–T14, con las limitaciones rotuladas; la evidencia no atribuye cámara óptica, Taptic ni VoiceOver al Simulator ni la variante Android determinista al dispositivo; `LEARNING.md` contiene teoría, analogías, ejercicio, 10 preguntas y checklist; la evidencia EAS remota existe y se repitió con las huellas nuevas; `MEMORY.md` está actualizada. **El único paso que quedaba era el commit de cierre**, que se hizo después de la validación de @reviewer (APROBADO, 2026-10-15). Con `tasks.md` T10 `[x]` y la spec `implementada` (ver abajo), el commit de cierre es `feat: complete day 5 native platform features`.


## Apéndice — detalle trasladado desde `MEMORY.md` (2026-10-15)

Texto íntegro de las entradas del Día 5 que `MEMORY.md` tenía al 2026-10-15, trasladado aquí al comprimir la memoria (máximo ~50 líneas). **Es un registro histórico: las cifras viejas (1013/1013, Doctor 20/21 de entonces, T8 pendiente) quedaron superadas por «Estado vigente» y «Cierre de T10 — 2026-10-15».**

- **Día 5 (spec 005 `aprobada`, en curso, sin commit):** T1–T9 y T11–T14 hechas; T8 cerrada el 2026-10-15 (ver abajo); falta T10. Samsung SM-A037M pasó reinicio real sin re-notificar. **Cambio de requisitos RF-37–RF-39 (H-T8-2..4): spec, plan (Revisión 4) y tareas T11–T14 APROBADOS por el usuario el 2026-10-14; T11–T14 hechas (lógica 1082/1082); siguiente paso: T10.** Orden: T11 (RF-37, `home-root-plan.ts` puro `POP_TO_TOP`+`JUMP_TO`, sin `dismissTo` ni `goHome`) → T12 (RF-38, máquina de redirección única) → T13 (RF-39 lógica, `PERSIST_VERSION` 3) → T14 (RF-39 texto + Android) → validación iOS única de T8 → T10. **T11 hecha (2026-10-14):** `features/navigation/logic/home-root-plan.ts` (+12 tests) + `use-go-to-home-root.ts` (`useNavigation('/(tabs)')`, despacha el plan al pulsar); solo `CartScreen` cambia. Samsung [A] 4 recorridos + iOS Sim [A] 3 recorridos OK. **T12 hecha (2026-10-14):** `order-status-redirect.ts` (máquina `watching|consulting|done` en `useRef`); desmontar NO manda `left` en el cleanup (Strict Mode) sino vía ref de montaje; `useAppStore` en `core/store/hooks.ts`. **T13 hecha (2026-10-14):** `UnusableReason = 'denied-recoverable'|'blocked'` declarado en `orders/logic/order-notification-state.ts` (evita ciclo); `classifyUnusableReason` en `notification-permission.ts` (recuperable solo Android+`hasRuntimePrompt`+`request`); la razón sale de la ÚLTIMA lectura; `unusableReason` solo con `unusable` (las demás transiciones borran la CLAVE); saneado → `blocked`; `PERSIST_VERSION` 3. Lógica 1068/1068. Samsung: migración real v2→v3 (15 órdenes conservadas) + arranque en frío OK; carrito v2 en dispositivo no comprobado (vacío). **T14 hecha (2026-10-14):** `checkout/logic/order-notification-notice.ts` (`buildNotificationNotice`, +14 tests) + clave `notificationDeniedRecoverable`; la confirmación pinta el aviso; Ajustes en `unusable` ya no mira `canOpenSettings` (`notificationUnavailable` sin uso, no borrada). Lógica 1082/1082. Recorrido ES del Samsung hecho por el usuario [U] (antes rotulado [P]; confirmó «1 ok, 2 ok, 3 ok, 4 ok» el 2026-10-15). **El Samsung tuvo `pm clear` (uno ajeno a las 23:25 y dos del agente, autorizados): se perdieron carrito, historial y órdenes ficticias previas; queda 1 orden `scheduled`, permiso concedido y marca Expo `blocked:` = `false`.** Android 13 muestra el diálogo 2 veces por instalación (1.er no → recuperable, 2.º → bloqueadas + `USER_FIXED` + `blocked:` true); solo `pm clear` restablece esa marca. La confirmación muestra solo la última orden; `herbstore://order-confirmation` la reabre. **H-T8-5 = comportamiento por diseño (decisión del usuario 2026-10-15, «dejarlo así»; ya no «RESUELTO»):** el idioma no se persiste (decisión Día 4) y tras un cierre real vuelve al del sistema; en iOS elegir EN en Fundamentos tras cada arranque en frío o poner el Simulator en inglés; datos de checkout inventados (el mock guarda órdenes solo en memoria). 14 tareas = excepción documentada al máximo de 10. Evidencia en `docs/evidence/day-5-platform.md`.

- **Corrección reviewer 2026-10-14:** scanner con barrera síncrona + epoch/abort; notificaciones con dedupe in-flight por order id, resultado persistible `idle|scheduling|unusable|failed|scheduled`, Ajustes/retry y respuestas deduplicadas. DeviceInsights recibe textos desde JS; evento `onNativePress` (evita colisión Fabric con `topPress`); pista propia de Ajustes en el scanner.

- **T2 y T3 cerradas (2026-10-14):** DeviceInsights sync/async/evento/vista accesible validados en Android físico (SM-A037M, Android 13) e iOS Simulator (iPhone 17 Pro, iOS 26.5), sin ids sensibles. `accent` cerrado se resuelve a color de tema en JS; Kotlin/Swift aplican `accentColor` con parser hex acotado y foreground WCAG (5.04–13.13:1); el alto crece con fontScale. Detalle en la evidencia.

- **T6 cerrada (2026-10-14):** scanner→detalle con lectura óptica real (Samsung), deep links frío/activo y reconexión real RF-16; iOS Simulator sin cámara óptica. Tres correcciones: encabezados del scanner, «Cancelar» bajo la barra de Android y barra «Agregar» del detalle escaneado. Dirigidos 42/42, lógica 930/930. Decisiones vigentes: RF-14 «cubierto por tests» (ML Kit/Vision descartan el EAN-13 inválido antes de JS; el guard `isValidEan13` de `use-scanner-controller.ts` no tiene test directo hasta Jest/RNTL del Día 6); cleartext de Android Release aceptado (HTTP al mock bloqueado: válido y 404 no se distinguen en frío; iOS sí); hueco de «Reintentar» (solo tras offline→online de `expo-network`; con servidor caído y sistema conectado solo queda «Cancelar» y el título promete un botón que no existe) aceptado y movido al Día 6. No cubierto: gesto de borde, RF-17 en físico, iOS óptico/oscuro/texto grande.

- **T7 cerrada (2026-10-14):** háptico = `createCartFeedbackListener(requestImpact)`: listener Redux tras el reducer que compara líneas antes/después (límite, bloqueo, agotado y doble toque no vibran) y absorbe fallos con `runOptionalFeedback`; `haptics.ts` solo llama `impactAsync(Light)`. Compartir = `useProductShare` + `createShareRunner` (un share en vuelo; rechazo, `throw` SÍNCRONO de `Share.share` o resultado ausente = `failed`; cancelar/éxito silenciosos) + `buildProductShareRequest` (idioma activo, enlace dentro de `message`). Android resuelve SIEMPRE `sharedAction` al lanzar el selector (cancelar = compartir); iOS sí distingue `dismissedAction`. Lógica 957/957. Samsung: 1 impacto por mutación y 0 por límite/agotado/doble toque (medido con `dumpsys vibrator_manager`); el usuario sintió el pulso al agregar y en `+`/`−`/«Eliminar» y ninguno en «Agotado»; el tope de stock solo está medido. iOS sin Taptic. Error de compartir solo con parche temporal (revertido). Día 6: ese error cae bajo la barra fija a texto muy grande (H-10/H-12).

- **T8 CERRADA (2026-10-15, pase iOS único, todo [A]; limitación ACEPTADA por el usuario el 2026-10-15):** iOS Simulator (iPhone 17 Pro) cubrió RF-37, RF-38, RF-39 y la superficie de notificación (EN/oscuro/AXXXL, roles, 48 pt, reduced motion, banner sin PII). Límites aceptados: «cancelar durante la espera» en iOS solo por captura (alerta modal del sistema; mismo grado que Android), sin VoiceOver real/Taptic/provisional, sin `busy` aparte. S-RF24 no reproducido. Detalle en la evidencia. **Siguiente: validación de @reviewer RF por RF y después T10.**

- **T9/T10 (2026-10-13):** checkout E2E añadido y cierre documental completado. La lógica cubre UUID/SHA-256, POST único, consulta sin dirección, confirmación única, limpieza, stock temprano y estados pendientes/inciertos. La matriz manual de POST no pudo ejecutarse: Android/iOS cargan Carrito/Checkout, pero teclado/axe no permitió completar el formulario de forma fiable. La limitación queda registrada en `LEARNING.md`; no se inventa evidencia.

- **Día 5 T10 (2026-10-14, sin marcar):** alineados seis parches SDK 57 con `npx expo install`; install-check **up to date**, Doctor **21/21**, lógica **1013/1013**, lint/tsc/diff check OK. CNG `prebuild --clean` + recompilación: Android Samsung e iOS Simulator OK. EAS remoto sigue bloqueado sin sesión; RF-28/RF-36 pendientes. RF-31 medido el 2026-10-15 con `node_modules/.bin/fingerprint fingerprint:generate|diff` en un clon `cp -cR` (Android `96c8994e…`/96, iOS `7ac6ef07…`/94; `locales/` no entra en la huella; `fingerprint` sin `expo-updates` = metadato inerte). Detalle en `docs/evidence/day-5-platform.md`. No commit.

- Pendientes Día 5/6: T10 (EAS remoto RF-28/RF-36, LEARNING.md, commit); gesto de borde; VoiceOver real; iPhone físico (Taptic, reduced motion, reconexión, óptica); POST manual; H-10; Jest/RNTL/Maestro y auditoría; retirar la clave i18n sin uso `checkout.confirmation.notificationUnavailable` (seguimiento menor de T14). `modules/device-insights/android/build/` (~349 archivos generados) permanece fuera de Git por reglas existentes; no borrar. De T6: `stay_on_while_plugged_in` quedó en 3 en el Samsung (revertir: `adb shell settings put global stay_on_while_plugged_in 0`).

- Seguimientos T6 → Día 6: test directo del guard `isValidEan13` del hook; «Reintentar» derivado solo de eventos (valorar `getNetworkStateAsync` o el tipo de error; trade-off: dejaría de bloquear el reintento con servidor caído y sistema conectado), título «Sin conexión…» obsoleto tras reconectar y posible carrera si la red vuelve durante los 3 intentos; dos lecturas idénticas (opción D); doble toque (~100 ms) en botón con ruta singular apila 2 pantallas (también Búsqueda); cambiar `font_scale` con el scanner abierto vuelve a Inicio; barra de navegación del Samsung clara en oscuro; posible `ScrollView` en `MessageScreen` con fuente muy grande.

- Auditoría Día 6 (a11y/rendimiento): H-T8-6 (Baja: «Abrir ajustes de notificaciones» parte la palabra a AXXXL), H-T8-7 (Baja: flecha del enlace no reconocido etiquetada «(tabs)»), H-T8-8 (Baja, Día 4: «1 unidades» sin plural), H-T8-9 (Informativa: `openSettings()` abre la raíz de Ajustes en el Simulator); «Ir a Inicio» del enlace no reconocido crea un Inicio nuevo sobre el detalle apilado (sin criterio; S-RF24 no reproducido); H-10 se repite en iOS; H-1/H-11 (iconos del tab bar y `SymbolView` recortados desde 1.3x en Android; S-4 = H-1), H-10 (iOS: cambiar el tamaño de texto con la app abierta deja textos cortados; también Home), H-12 (filas del skeleton más bajas que las tarjetas), F-3 (Atrás <0,5 s tras abrir hoja se pierde), F-4 (foco de TalkBack salta a "Tools" en dev; confirmar en release), G-2/G-3 (anuncios "Filtros/Orden aplicado" y S-6 vacío/borrado no se oyen en TalkBack; devolver el foco al botón de la hoja), G-4/S-8 (botón "Filtros" casi fuera del borde con fuente grande), G-5 (swipe rápido sobre el backdrop cierra en Android), G-6, G-7, S-5 (vacío con dos encabezados), S-9/R-4 (pérdida de caracteres con `axe type`/`adb`), S-10, S-11, S-12 (reabrir búsqueda larga >60 s refresca las 15 páginas), M-5/M-6 (timeout durante el cuerpo en `fetchJson`; doble `router.back()`), `engines` Node ≥ 22.18, test extra de `http.ts`, R-2 (Reintentar del fallback vuelve a la raíz del tab), H-5, H-9 (`.env.local` lo crea el usuario), VoiceOver real, release medible (HTTP cleartext), Jest/RNTL/Maestro; G-6, G-7, S-10 y S-11 en `LEARNING.md` (Día 3, «Hallazgos de T16»); reduced motion iOS sin evidencia.
