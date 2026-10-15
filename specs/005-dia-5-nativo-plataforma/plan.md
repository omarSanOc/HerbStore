# Plan 005 — Día 5: capacidades nativas y plataforma

> Revisión 3 (2026-10-13): sustituye el plan anterior después de la aprobación explícita de la spec corregida. Incorpora confirmación previa en cada apertura del escáner, cancelación al origen, permisos/notificaciones persistentes por instalación, validación Android real/determinista, URL de catálogo obligatoria y el límite de calidad entre Día 5 y Día 6.
>
> Revisión 4 (2026-10-14, **aprobada por el usuario el 2026-10-14**): añade la sección «Cambio de requisitos 2026-10-14 — RF-37 a RF-39» tras la aprobación del cambio de la spec. El resto del plan no cambia.

## Precondiciones, infraestructura real y división del día
- Parte de los Días 1–4 implementados: un único `baseApi`, `GET /products/barcode/:code` en el mock, detalle reutilizable, carrito persistido, `orderRecorded`, esquema `herbstore`, modal raíz del escáner, MMKV y `npm run test:logic`. RF-10–RF-27.
- `package.json` tiene Expo 57.0.28/RN 0.86.3 y no contiene todavía `expo-camera`, `expo-notifications`, `expo-haptics`, Jest, RNTL ni Maestro; `eas.json`, `.env.example` y el módulo local tampoco existen. No se afirmará que esa infraestructura ya está disponible.
- Consultar antes de instalar la documentación de SDK 57 y usar `npx expo install expo-camera expo-notifications expo-haptics`. `expo-updates` solo se añadirá si la comprobación oficial de EAS/runtime demuestra que es necesaria para validar RF-31; no se instala por intuición. RF-3, RF-28, RF-31.
- El alcance se divide dentro del Día 5 en cuatro incrementos ejecutables: **A)** base nativa y DeviceInsights (T1–T3), **B)** escáner y enlaces (T4–T6), **C)** feedback, compartir y notificaciones (T7–T8), **D)** configuración de entrega y cierre (T9–T10). No se cierra el día si falta un incremento o la evidencia remota EAS. RF-33, RF-36.
- Cada tarea es un checkpoint de 20–30 minutos. Si una compilación o servicio remoto excede ese tiempo, se registra el punto alcanzado y se reanuda el mismo checkpoint; no se recortan RF ni se inicia la tarea siguiente.

## Archivos y responsabilidades

### T1 — Dependencias, configuración CNG y diagnóstico obligatorio
- `package.json`, `package-lock.json`: dependencias compatibles instaladas con Expo; conservar scripts actuales y no adelantar Jest/RNTL. RF-11, RF-22–RF-25, RNF-5.
- `app.json`: plugins de cámara y notificaciones, cámara trasera con barcode EAN-13, sin permiso de micrófono innecesario (`recordAudioAndroid: false`), `runtimeVersion` verificable y configuración existente intacta. No editar `ios/` ni `android/`. RF-10–RF-12, RF-23, RF-28, RF-31.
- `locales/es.json`, `locales/en.json`: propósito localizado de cámara para metadata del sistema; la pantalla previa explica el propósito en el idioma activo también en Android. RF-10, RF-11, RF-32.
- `src/core/config/public-config.ts` (+test), `src/core/network/api-origin.ts`, `src/core/network/resolve-api-origin.ts` (+test): `EXPO_PUBLIC_API_ORIGIN` pasa a ser obligatoria y se valida como origen HTTP(S) sin ruta, credenciales, query ni fragmento; no existe fallback implícito. El resultado puro es `ready | missing | invalid`. RF-29, RF-30.
- `src/core/config/PublicConfigGate.tsx`: antes de montar navegación/catálogo, muestra diagnóstico localizado y accesible cuando falta o es inválida la URL; el `baseApi` no se monta ni solicita red en ese estado. `src/app/_layout.tsx` solo coloca el gate alrededor de la app existente. RF-30, RF-32, RNF-1.
- `.env.example`: nombres públicos requeridos con placeholders no sensibles; no incluir valores locales, secretos ni variables internas de herramientas. RF-29, RNF-1.

### T2–T3 — DeviceInsights y experiencia didáctica
- `modules/device-insights/`: módulo local generado con el flujo oficial de Expo Modules; `expo-module.config.json` declara Android/iOS y los archivos bajo `android/` y `ios/` son fuente versionada del módulo, no salidas CNG. RF-2–RF-8.
- `modules/device-insights/android/.../DeviceInsightsModule.kt` y vista Android: plataforma sync; actualización async de modelo no vacío, versión e indicador físico; un evento por éxito; vista botón con props y evento de activación. RF-5–RF-9.
- `modules/device-insights/ios/DeviceInsightsModule.swift` y vista iOS: mismo contrato observable y errores controlados, sin serial, vendor id ni identificador persistente. RF-5–RF-9, RNF-1.
- `modules/device-insights/src/index.ts` y `src/core/native/device-insights.ts`: frontera tipada única. Valida payloads desconocidos, ISO 8601 UTC, modelo no vacío y tokens `primary|success|warning|error`; adapta el evento nativo a un resumen localizado no sensible y elimina la suscripción en cleanup. RF-5–RF-8.
- `src/core/native/device-insights-contract.ts` (+test): parsers y máquina pura `idle | refreshing | success | error`; una segunda solicitud durante `refreshing` devuelve `ignored`. RF-6, RF-7.
- `src/features/device-insights/screens/DeviceInsightsScreen.tsx`: panel completo de sync, estado/resultado async, último evento, error y vista interactiva; no duplica estado derivado. RF-4–RF-9.
- `src/app/(tabs)/(account)/device-insights.tsx`, layout de Cuenta y `AccountPlaceholderScreen.tsx`: ruta delgada, singular y acceso interno de aprendizaje junto a Fundamentos. RF-4.
- La vista nativa recibe etiqueta, estado de disponibilidad/actualización y color ya resuelto desde tokens; cada plataforma expone rol botón, foco visible, fuente escalable y mínimo 48 dp/44 pt. RF-8, RF-9, RNF-3.

### T4–T6 — Escáner, catálogo y deep links
- `src/features/scanner/logic/ean13.ts` (+test): acepta exactamente 13 dígitos y checksum válido; nunca normaliza entradas ambiguas. RF-14.
- `src/features/scanner/logic/scanner-machine.ts` (+test por tabla): estados `preview`, `checking-permission`, `unavailable`, `ready`, `invalid-code`, `querying`, `offline`, `timeout`, `temporary-error`, `invalid-data`, `not-found`, `navigating`, `navigation-error`, `closed`; solo `ready` acepta lectura. Cada intento lleva token/epoch para descartar resultados tardíos. RF-10–RF-19.
- `src/features/scanner/logic/scanner-view-state.ts` (+test): acciones permitidas por estado, anuncios y clasificación `ApiError` (`network`, `timeout`, 5xx, `invalid`, 404); no mezcla offline con error de datos. RF-11, RF-13, RF-16–RF-19.
- `src/features/product/data/products-api.ts`: `getProductByBarcode` consume `GET /products/barcode/:code`, reutiliza `parseProductDetail`, la política GET existente y tags del producto; 404 significa no encontrado. RF-15–RF-18.
- `src/features/scanner/hooks/use-scanner-controller.ts`: conecta máquina, consulta lazy, `onReconnect` y ciclo de vida; recuperar conectividad habilita el reintento pero nunca lo dispara solo. Abort/unmount/cancel incrementan epoch y silencian resultados. RF-12, RF-16, RF-19, RNF-2.
- `src/features/scanner/screens/ScannerScreen.tsx` y componentes acotados de preview/estado/cámara: `CameraView` solo se monta enfocada, confirmada, autorizada y `ready|querying`; `active`/unmount evita dos previews. `onMountError`, ausencia de recurso y permiso no resoluble convergen en `unavailable`. Nunca toma ni almacena imágenes. RF-10–RF-19, RNF-1.
- `src/app/scanner.tsx` se sustituye por `src/app/scanner/_layout.tsx`, `index.tsx` y `product/[id].tsx`: el escáner es un stack modal singular; el detalle escaneado se apila dentro, apaga cámara y Atrás/gesto vuelve a la misma instancia y la rearma. Cerrar/error Cancelar descarta el stack modal y vuelve al origen; una reapertura crea instancia nueva en `preview`. RF-10, RF-13, RF-17–RF-19.
- `src/core/navigation/linking.ts` (+test), `src/app/+not-found.tsx`, `ProductDetailScreen.tsx` y un estado de producto inválido/no encontrado: id malformado → Producto inválido; 404 con id válido → Producto no encontrado + salida segura a Inicio, donde existe catálogo navegable; ruta desconocida → Enlace no reconocido + Inicio; `scanner` sigue permitido y abre preview. RF-20, RF-21.
- La prueba en frío usa una compilación que entregue el esquema directamente a la app, no el launcher del dev client; en iOS Simulator se usa la herramienta nativa de URL, sin afirmar cámara física. RF-21, RF-33.

### T7 — Hápticos y compartir
- `src/features/feedback/logic/cart-feedback.ts` (+test): lista cerrada de acciones humanas (`productAdded`, `lineIncremented`, `lineDecremented`, `lineRemoved`) y comparación pura de carrito antes/después; `cartCleared` y `stockRefreshed` no cuentan. RF-22.
- `src/features/feedback/native/haptics.ts`: único import de hápticos; solicita impacto ligero y absorbe falta de soporte/error sin cambiar carrito. RF-22, RNF-2.
- `src/features/feedback/store/native-feedback-listeners.ts` y `src/core/store/store.ts`: listener post-reducer compara `getOriginalState()` con estado actual y dispara una vez solo cuando cambian unidades/líneas; el badge sigue derivando de `selectCartUnits`. RF-22.
- `src/features/product/logic/product-share.ts` (+test) y `ProductDetailScreen.tsx`: conserva `buildProductShareUrl`, clasifica `shared | cancelled | failed` incluyendo resultado ausente y encapsula `Share`; cancelación es silenciosa, fallo deja pantalla, anuncia mensaje localizado y permite reintentar. RF-26, RF-27, RF-32.

### T8 — Notificación local por orden
- `src/features/orders/logic/order-notification-state.ts` (+test): estado puro por order id con `permissionRequested` y `notified`; registra la solicitud antes de invocar el sistema, marca notificada solo tras scheduling exitoso y sanea ids contra el historial local. RF-23–RF-25.
- `src/features/orders/store/order-history-slice.ts` (+test) y `src/core/storage/persist-policy.ts` (+test): amplían el historial con ambos conjuntos no sensibles, incrementan versión de persistencia y conservan carrito/búsqueda/intento/órdenes; restart mantiene marcas, estado corrupto se sanea y borrar datos/desinstalar vuelve al inicial. RF-23, RF-25, RNF-1.
- `src/features/notifications/logic/notification-permission.ts` (+test): clasificador inyectable de Android con diálogo runtime, Android sin diálogo e iOS (`authorized|provisional|ephemeral` utilizables; no utilizable con explicación/Ajustes cuando aplique). La variante Android ausente se cubre aquí sin llamarla prueba real. RF-23, RF-33.
- `src/features/notifications/native/order-notifications.ts`: único import de notificaciones; crea canal Android antes de permiso, consulta capacidad, solicita como máximo una vez por orden, programa inmediata con copia localizada y payload `{ destination: 'home' }` sin id, y devuelve resultados discriminados sin lanzar. RF-23–RF-25, RNF-1.
- `src/features/notifications/store/order-notification-listener.ts`: escucha una orden nueva una vez; programa fuera del reducer y persiste solo transiciones admitidas. Respuestas idempotentes duplicadas no reprograman. RF-23–RF-25.
- `src/features/notifications/hooks/use-notification-response-navigation.ts` y `src/app/_layout.tsx`: consume respuesta inicial una vez y suscripción activa, valida el payload cerrado y navega a Inicio; cleanup evita duplicados. RF-24.
- `OrderConfirmationScreen.tsx`: aviso no bloqueante ante fallo/no utilidad y acción explícita de reintento de scheduling sin volver a solicitar permiso ya registrado. RF-23, RF-25, RF-32.

### T9–T10 — EAS, variables, OTA, evidencia y cierre
- `eas.json`: perfiles `development` y `preview` con identificadores de app existentes, distribución adecuada y configuración válida para Android/iOS; no contiene credenciales ni valores secretos. RF-28, RNF-1.
- `app.json`: política `runtimeVersion` elegida se inspecciona para Android/iOS. Casos documentados: texto/lógica/recurso compatible como candidato OTA; permiso, plugin, dependencia o módulo nativo como nuevo binario/runtime. No se publica una OTA. RF-31.
- `docs/evidence/day-5-platform.md`: fecha, versión, dispositivo/Simulator, pasos, observación y resultado para DeviceInsights, scanner, deep links frío/activo, hápticos, compartir, notificaciones, variante Android real y variante determinista, límites de Simulator, EAS local/remoto, variables y matriz OTA/binario. RF-27–RF-34.
- El inventario incluye variables consumidas por app y mock (`EXPO_PUBLIC_API_ORIGIN`, fixture pública de desarrollo y variables operativas del mock actuales), con propósito, exposición, entorno y obligatoriedad; excluye variables internas de Node/Expo/EAS y todos los valores. RF-29.
- `LEARNING.md`: teoría, decisiones, analogías, errores típicos, ejercicio, 8–10 preguntas, checklist y registro de verificación. Solo al cumplir RF-28 remoto y toda la matriz se crea el commit de cierre. RF-1–RF-3, RF-35, RF-36.

## Estado, flujo de datos y contratos

### DeviceInsights
1. La pantalla lee sync una vez por montaje; refresh aceptado cambia `idle|success|error → refreshing`; otros toques se ignoran. RF-5, RF-6.
2. Native async devuelve `{ platform, model, systemVersion, isPhysical }`; el adapter rechaza modelo vacío/forma inválida. RF-6.
3. Un éxito actualiza resultado y emite una vez `{ summary, timestamp }`; el evento público contiene resumen localizado y timestamp ISO UTC. Cleanup retira observador. RF-7.
4. Press de la vista entrega `{ platform, timestamp }`; label/accent/state son props inmutables y el resultado se muestra como texto. RF-8, RF-9.

### Escáner
1. Cada montaje empieza `preview`; confirmar inicia permiso/capacidad. Sin confirmación no hay cámara. RF-10–RF-13.
2. Solo `ready` acepta callback `ean13`; inválido → aviso bloqueado; válido → `querying` con epoch nuevo. RF-14, RF-15.
3. `getProductByBarcode`: producto → `navigating`; 404 → `not-found`; network/timeout/5xx/invalid → su estado específico. Los reintentos reutilizan el código aceptado sin rearmar cámara. RF-16–RF-18.
4. Detalle vive encima del scanner stack; back/gesture reactiva y rearma. Error de navegación conserva producto/código para `Reintentar navegación`. RF-13, RF-17.
5. Cancelar error aborta, invalida epoch, cierra modal al origen; late results no tienen transición válida. RF-19.

### Carrito, notificaciones y compartir
- Haptic listener observa una acción ya reducida y compara antes/después; por eso un botón a límite, bloqueo o dedupe no vibra. Badge = selector de suma de unidades existente. RF-22.
- `orderRecorded` sigue siendo fuente de confirmación. El listener separa dos marcas: solicitud de acceso (antes de pedir) y scheduling exitoso (después de recibir identificador). Fallo permite retry explícito y nunca expone order id en contenido/payload público. RF-23–RF-25.
- Notification tap solo acepta `{ destination: 'home' }`; inicio frío y activo convergen en `dismissTo('/')`. RF-24.
- Compartir recibe id/nombre/idioma, construye texto en idioma activo y devuelve unión `shared|cancelled|failed`; nunca cambia carrito/orden. RF-26, RF-27.

## Interfaz y estados
- DeviceInsights: idle, refreshing, success, controlled error; no hay vacío porque el panel siempre muestra sync y vista. Acciones deshabilitadas durante refresh. RF-4–RF-9.
- Scanner: preview, checking/loading, ready, invalid, querying, cuatro errores distinguibles, not-found, navigation-error y unavailable. Offline habilita retry solo tras reconexión; todos los errores bloqueados conservan Cancelar al origen. RF-10–RF-19.
- Producto/link: invalid, loading, not-found, offline y error quedan separados; unknown route no reutiliza mensaje de producto. RF-20, RF-21.
- Notificación: usable, not-usable, scheduling, scheduled y failed/retry. La confirmación comercial nunca se revierte por permiso o scheduling. RF-23–RF-25.
- Tema claro/oscuro, texto ampliado y movimiento reducido se revisan en las superficies nuevas; empty solo aplica donde exista colección, y se documenta «no aplica» para panel/scanner en vez de inventar un estado. RF-34, RNF-3, RNF-4.

## Android, iOS, CNG y rendimiento
- `expo-camera`, `expo-notifications`, `expo-haptics`, módulo local, plugins, metadata localizada y runtime config cambian el binario: ejecutar CNG mediante `npx expo run:*`, nunca editar generados, y recompilar Development Build Android físico/iOS Simulator tras T1 y tras cambios Kotlin/Swift. RNF-5.
- Cámara de SDK 57 es device-only en Android/iOS: se valida lectura real en Android físico; iOS Simulator valida preview previo, permiso/estado unavailable, lifecycle y navegación, pero no lectura ni hardware. RF-33.
- Háptico real solo es observable en Android físico; Simulator iOS valida que la acción no bloquea y registra la imposibilidad de Taptic Engine. Notificaciones locales sí se prueban en Simulator compatible, sin afirmar push remoto. RF-22–RF-25, RF-33.
- La variante Android de permiso runtime representada por el Samsung se prueba realmente; la opuesta usa tests del clasificador con SDK/capacidad inyectados y se rotula determinista, no dispositivo. RF-23, RF-33.
- Solo una `CameraView`, un refresh DeviceInsights, una consulta barcode y una programación por orden a la vez. No guardar frames, no procesar imágenes en JS, no memoizar sin medición y mantener callbacks tardíos fuera de UI. RNF-1, RNF-2.

## Accesibilidad e i18n
- Todas las claves nuevas se añaden en `es.ts`/`en.ts` y pasan `parity.test.ts`; textos visibles, anuncios, permission rationale, share y notification content usan solo idioma activo. RF-7–RF-9, RF-10–RF-27, RF-32.
- DeviceInsights y scanner exponen headers, botones, disabled/busy, live regions/anuncios solo al cambiar estado y foco visible; cámara visual tiene alternativa textual. Targets 48 dp/44 pt, contraste AA y escalado sin fijar altura de texto. RF-9, RF-34, RNF-3.
- Háptico nunca es la única confirmación; notificación nunca es requisito para confirmar la orden; color/acento siempre acompaña texto/estado. RF-22–RF-25, RNF-3.
- La auditoría es dirigida a las cinco capacidades del Día 5; hallazgos globales y VoiceOver integral siguen en Día 6. RF-34.

## Decisiones y alternativas
- **Elegida:** módulo Expo local dentro de CNG. **Trade-off:** dos implementaciones y recompilar. **Descartada:** TurboModule RN CLI/manual, que duplicaría integración y exigiría editar proyectos generados. RF-2, RF-3.
- **Elegida:** contrato nativo crudo + fachada pública validada/localizada. **Trade-off:** un adapter adicional. **Descartada:** localizar dentro de Kotlin/Swift, que duplicaría recursos y podría divergir del idioma activo. RF-6–RF-8.
- **Elegida:** stack modal propio para scanner y detalle escaneado. **Trade-off:** una ruta de detalle adicional delega en la misma pantalla. **Descartada:** navegar al stack Home y perder la instancia/rearme exigidos. RF-13, RF-17–RF-19.
- **Elegida:** máquina pura con epoch y cámara condicionada a foco. **Trade-off:** más estados explícitos. **Descartada:** cooldown temporal/booleano `hasScanned`, incapaz de distinguir retry, cancel y resultado tardío. RF-10–RF-19.
- **Elegida:** endpoint barcode en el `productsApi` existente. **Trade-off:** otro endpoint/tag en la API compartida. **Descartada:** `fetch` directo desde la pantalla, que perdería taxonomía, retries y abort. RF-15–RF-18.
- **Elegida:** listener Redux compara estado antes/después para háptico. **Trade-off:** middleware adicional. **Descartada:** vibrar en cada botón, que vibraría acciones rechazadas y duplicaría lógica entre detalle/carrito. RF-22.
- **Elegida:** marcas de notificación dentro del historial persistido y solicitud registrada antes del prompt. **Trade-off:** una caída justo después de marcar puede impedir otro prompt para esa orden, priorizando «máximo una vez». **Descartada:** marcar después del diálogo o solo en memoria, que permite repetir solicitudes tras crash/restart. RF-23.
- **Elegida:** marcar `notified` solo tras scheduling exitoso y retry explícito. **Trade-off:** el usuario debe reintentar. **Descartada:** marcar al iniciar o reintentar automáticamente, que perdería avisos o podría duplicarlos. RF-25.
- **Elegida:** URL de catálogo obligatoria con gate temprano. **Trade-off:** desarrollo requiere `.env.local`. **Descartada:** defaults por plataforma, prohibidos por RF-30 aunque eran cómodos en días anteriores. RF-29, RF-30.
- **Elegida:** política de runtime verificable y matriz sin publicar OTA. **Trade-off:** evidencia conceptual/configurada, no rollout real. **Descartada:** publicar solo para demostrar el mecanismo, fuera de alcance. RF-31.
- **Elegida:** pruebas actuales `node:test` + matriz manual; Jest/RNTL/Maestro se mantienen para Día 6. **Trade-off:** UI/native no queda automatizada aún. **Descartada:** adelantar una suite completa y ampliar el Día 5. RF-34.

## Estrategia de pruebas y comandos
- **Tests primero, infraestructura actual:** antes de UI/native escribir tablas en `npm run test:logic` para config, payload DeviceInsights, máquina/visual state scanner, EAN-13, linking, haptic acceptance, share outcomes, permission matrix y persistencia/dedupe. Los `.test.ts` mantienen imports relativos con extensión y no importan RN. RF-5–RF-31.
- **Jest/RNTL:** no están instalados. El Día 6 añadirá Jest/RNTL y cubrirá `PublicConfigGate`, `DeviceInsightsScreen`, `ScannerScreen`, `OrderConfirmationScreen` y producto/link por rol, state, texto y acciones. Este plan deja lógica inyectable y semantics estables; no añade snapshots ni testIDs innecesarios.
- **Maestro:** no existe `.maestro/`. Día 6 automatizará los flujos adecuados; cámara física, prompt real, háptico y módulo bilateral conservan matriz manual. Candidatos preparados: scanner preview/cancel, deep links, notification tap y share; no se afirma automatización ahora.
- **Cada tarea JS/TS:** `npm run test:logic`, `npx expo lint`, `npx tsc --noEmit`.
- **Si toca mock (no previsto):** `npm --prefix mock-server test` además de lo anterior.
- **T1 y cierre, por dependencias/config:** `npx expo install --check` y `npx expo-doctor@latest`.
- **Cambios nativos/config:** `npx expo run:android --device` en Android físico y `npx expo run:ios` en Simulator; repetir tras cambios Kotlin/Swift. Metro: `npx expo start --dev-client`.
- **Deep links:** herramientas nativas Android/iOS, app activa y arranque frío en build que no pase por launcher. **EAS:** validación local de config para ambos perfiles/plataformas y comprobación remota cuando servicio/credenciales estén disponibles; si no, RF-36 queda pendiente.
- **Matriz dirigida:** DeviceInsights sync/async/event/view/unsubscribe; scanner preview/reopen/permisos/unavailable/valid-invalid/errores/retry/cancel/late result/back; links; cuatro mutaciones haptic; share success/cancel/fail; notification permission/schedule/fail/retry/dedupe/restart/tap; tema, texto, reduced motion y accesibilidad aplicables. RF-4–RF-34.

## Conceptos pedagógicos y analogías
- Expo Module/JSI y contrato tipado ↔ Android library + JNI/Kotlin y iOS framework + Swift/Objective-C interoperability. RF-1, RF-2.
- Promise async ↔ `suspend`/Coroutine y `async/await`; eventos + cleanup ↔ `Flow`/`callbackFlow` y `AsyncStream`/Combine cancellable. RF-2, RF-6, RF-7.
- Native view ↔ `AndroidView`/View y `UIViewRepresentable`/UIView; props inmutables y eventos unidireccionales. RF-2, RF-8, RF-9.
- Permisos/ciclo de vida ↔ Activity Result + Lifecycle y `AVCaptureDevice`/scene phase; `useEffect` cleanup no sustituye el foco de navegación. RF-10–RF-19.
- Máquina discriminada + epoch ↔ `sealed interface` con reducer/MVI y `enum` con associated values; evita booleanos incompatibles y callbacks zombis. RF-14–RF-19.
- Listener middleware ↔ colector app-scoped de `SharedFlow` y `Task`/observer app-scoped; efectos ocurren después de aceptar estado. RF-22–RF-25.
- CNG/EAS/runtimeVersion ↔ manifest/Gradle build variants y Info.plist/Xcode schemes; JS bundle compatible no puede introducir código nativo ausente. RF-28–RF-31.

## Trazabilidad
| Parte | Requisitos |
|---|---|
| Base/configuración y URL obligatoria | RF-29, RF-30, RF-31, RNF-1, RNF-5 |
| DeviceInsights contrato/panel/vista | RF-4–RF-9, RNF-1–RNF-3 |
| Scanner máquina/cámara/API/navegación | RF-10–RF-19, RF-32–RF-34, RNF-1–RNF-4 |
| Deep links y estados de producto | RF-20, RF-21, RF-32–RF-34 |
| Carrito/hápticos | RF-22, RF-32–RF-34, RNF-2–RNF-4 |
| Notificaciones | RF-23–RF-25, RF-32–RF-34, RNF-1–RNF-4 |
| Compartir | RF-26, RF-27, RF-32–RF-34, RNF-1–RNF-3 |
| EAS, variables, OTA y cierre | RF-28–RF-36, RNF-1, RNF-5 |
| Material pedagógico | RF-1–RF-3, RF-35, RF-36 |
| Carrito vacío → raíz de Inicio | RF-37, RF-32, RF-34, RNF-3 |
| Redirección única de la consulta del pedido | RF-38, RF-34 |
| Denegadas recuperables vs bloqueadas | RF-39, RF-23–RF-25, RF-32, RF-34, RNF-1, RNF-3 |

## Riesgos y limitaciones
- iOS Simulator no ofrece cámara física ni Taptic Engine: solo se valida fallback/lifecycle y no bloqueo; no se inventa evidencia física. RF-33.
- El launcher del dev client interceptó enlaces fríos en días previos; la evidencia fría necesita un build que entregue el esquema directamente a HerbStore.
- Los prompts pertenecen al SO y pueden no reaparecer; la prueba observa estado/capacidad y la marca persistida, no promete UI del sistema. RF-23.
- La variante Android opuesta a la del dispositivo queda probada determinísticamente, no realmente. RF-33.
- EAS remoto depende de servicio y credenciales fuera del repo; la validación local se conserva, pero el Día 5 permanece pendiente sin evidencia remota. RF-28, RF-36.
- Cambiar la URL a obligatoria rompe los defaults pedagógicos anteriores de forma intencional: documentación y `.env.example` deben actualizarse juntos para no bloquear a quien ejecuta el proyecto. RF-29, RF-30.

## Cambio de requisitos 2026-10-14 — RF-37 a RF-39

Parte del cambio aprobado por el usuario el 2026-10-14 (spec, «Historial de cambios»). Corrige H-T8-2, H-T8-3 y H-T8-4 dentro del Incremento C, ANTES de la validación iOS única de T8. H-T8-5 (idioma no persistido) es comportamiento por diseño, sin RF y sin trabajo: se mantiene la decisión del Día 4 de no persistir preferencias (`PERSISTED_KEYS` no incluye `preferences`) y tras un cierre real la app vuelve al idioma del sistema (corrección documental del 2026-10-15; spec, «Historial de cambios»). Son cambios solo de JS/TS: no hay dependencias, config plugins, `app.json` ni código Kotlin/Swift nuevos, así que basta Metro con Fast Refresh y no hay que recompilar el Development Build ni ejecutar `expo install --check`/Doctor por estas tareas (T10 los vuelve a ejecutar en el cierre). Jest/RNTL siguen sin estar disponibles hasta el Día 6: toda regla va a lógica pura en `npm run test:logic` y lo que solo existe en pantalla se valida en el dispositivo.

Nota sobre el plan vigente: la línea «Notification tap … convergen en `dismissTo('/')`» de «Carrito, notificaciones y compartir» quedó superada en T8 por `features/notifications/logic/go-home.ts` (`dismissTo` → `navigate` → `dismissTo`, medido en el Samsung). RF-37 no modifica ese helper ni el tap (RF-24).

### RF-37 — «Ir a Inicio» desde el carrito vacío (H-T8-2)

**Causa.** `CartScreen` pasa `router.dismissTo('/')` a `EmptyCart`. `dismissTo` es la acción `POP_TO`. El navegador que diverge entre la pestaña Carrito y `/` es `Tabs`, y `TabRouter` no entiende `POP_TO`, así que la acción no hace nada. Es la misma causa que la del tap de la notificación en T8.

**Lectura del código de expo-router 57.0.27 (`node_modules/expo-router/build/…`), que debe confirmarse en el dispositivo:**
- `navigate('/')` desde otra pestaña despacha `NAVIGATE` en `Tabs` con `params.screen = 'index'`. El stack de Inicio recibe un `NAVIGATE index` y, si su ruta visible no es `index` (por ejemplo, `[index, product]`), apila un `index` nuevo (`StackRouter`, caso `NAVIGATE` sin `pop`).
- `dismissTo('/')` dentro del stack de Inicio (`POP_TO index`) se queda en la ruta visible si ya se llama `index` (`StackRouter`, caso `POP_TO`: `state.routes[currentIndex].name === name`). Por eso la secuencia `goHome` de T8 podría dejar `[index, product, index]` cuando Inicio tenía un detalle apilado, que es justo el caso límite de RF-37. T8 lo midió solo con Inicio en su raíz.
- `POP_TO_TOP` en un stack deja `routes[0]`. Con `target` igual a la clave del propio stack nunca queda «sin manejar», aunque no haya nada que quitar (`useOnAction`: `result === null && action.target === state.key ? state`). Así se evita el aviso de desarrollo «The action … was not handled by any navigator» de `ExpoRoot`.
- `JUMP_TO` en `TabRouter` solo cambia la pestaña enfocada y no despacha nada al stack hijo.

**Archivos y responsabilidades:**
- `src/features/navigation/logic/home-root-plan.ts` (+test), lógica pura sin RN: `planHomeRoot(tabsState)` recibe la forma mínima del estado de `Tabs` (`key` y `routes[{ name, state?: { key?, routes[{ name }] } }]`) y devuelve, en este orden, las acciones planas de React Navigation: `{ type: 'POP_TO_TOP', target: <clave del stack (home)> }`, solo si ese stack existe, tiene `key` y más de una ruta, y después `{ type: 'JUMP_TO', payload: { name: '(home)' }, target: <clave de Tabs> }`. Nunca devuelve `NAVIGATE` ni `PUSH`, que crean instancias, y sin ruta `(home)` devuelve `[]`. Primero se vacía el stack de Inicio, que aún no se ve, para que el usuario no vea una animación de retroceso, y después se selecciona la pestaña. RF-37.
- `src/features/navigation/use-go-to-home-root.ts`: hook delgado, junto a `use-go-back-or-home.ts`. Obtiene la navegación de `Tabs` con `useNavigation('/(tabs)')`, la API de expo-router 57 para un layout padre; si esa ruta lanzara «Could not find parent navigation», se usaría `useNavigation().getParent()` sin cambiar el plan. Al pulsar, lee `getState()` en ese momento y despacha cada acción del plan con `navigation.dispatch`. No usa `dismissTo` ni `navigate`. RF-37.
- `src/features/cart/screens/CartScreen.tsx`: `EmptyCart onGoHome` pasa a usar el hook. `EmptyCart`, `NotFoundScreen`, `CategoryProductsScreen` y `go-home.ts` no cambian (spec, Fuera de alcance). RF-37.

**Decisión.**
- **Elegida:** plan puro a partir del estado de `Tabs` (`POP_TO_TOP` dirigido al stack de Inicio + `JUMP_TO`). **Trade-off:** acopla el hook a la forma del estado de React Navigation y a los nombres de ruta `(home)`/`index`, y usa `dispatch` con `target`, más bajo nivel que `router.*`. A cambio, es determinista, se prueba en Node con estados de ejemplo y no depende de cómo `NAVIGATE` trata `index` en el stack hijo.
- **Descartada A:** reutilizar `goHome` de T8 (`dismissTo` → `navigate` → `dismissTo`). Funciona medido con Inicio en su raíz, pero contiene `dismissTo`, y la lectura de `POP_TO` indica que no limpia `[index, product, index]`. Además, cambiarlo para cubrir este caso tocaría RF-24, que está fuera de RF-37.
- **Descartada B:** `navigate('/')` + `dismissAll()`. No usa `dismissTo`, pero `dismissAll` (`POP_TO_TOP` sin `target`) queda «sin manejar» y genera un aviso de desarrollo cuando Inicio ya está en su raíz.
- **Descartada C:** `popToTopOnBlur` en las opciones de `Tabs`. Cambiaría el comportamiento de todas las pestañas, fuera del alcance acotado de RF-37.
- **Descartada D:** reiniciar todo el estado de navegación. Pierde el historial de las demás pestañas.
- **Descartada E:** `router.replace('/')`. Sustituye la pantalla del carrito y no selecciona Inicio.

**Accesibilidad, i18n y rendimiento.** No cambian textos ni roles: el botón y su pista ya existen en ES/EN. El cambio de pestaña de `Tabs` no anima, y el `POP_TO_TOP` ocurre en un stack que no se ve, así que no añade movimiento (RNF-4). Son dos `dispatch` por toque y no hay coste medible. Un doble toque no apila nada porque el segundo plan, si llega a ejecutarse, solo contiene `JUMP_TO` sobre la pestaña ya enfocada.

**Analogía.** En Compose sería seleccionar el ítem de `NavigationBar` y vaciar el grafo de Inicio con `navController.popBackStack(HomeRoot, inclusive = false)`, o `navigate(HomeGraph) { popUpTo(HomeRoot); launchSingleTop = true }`. En SwiftUI sería `homePath = NavigationPath()` y después `selection = .home` en `TabView`. Error típico al venir de nativo: usar «navegar» para volver a una raíz, porque en un stack eso apila otra instancia en lugar de volver.

**Tests primero (`home-root-plan.test.ts`).** Los tests comprueban los siguientes resultados:
- `[index]` da solo `JUMP_TO`.
- `[index, product]` y `[index, category, product]` dan `POP_TO_TOP` con la clave del stack de Inicio antes de `JUMP_TO`.
- Un `(home)` sin `state`, o con `state` sin `key`, da solo `JUMP_TO`.
- Sin `(home)` da `[]`.
- Ningún plan contiene `NAVIGATE`, `PUSH` ni `POP_TO`.
- Aplicar el plan a un estado de ejemplo y volver a planificar da solo `JUMP_TO`, de modo que repetir el toque no apila nada.

**Validación en Samsung SM-A037M.** Se ejecuta el siguiente recorrido:
1. Se abre un producto en Inicio, se va a Carrito vacío y se pulsa «Ir a Inicio».
2. Inicio aparece en su raíz, sin flecha en la captura ni en `uiautomator dump`.
3. El botón Atrás del sistema no revela otro Inicio ni el detalle: con `backBehavior` por defecto, la app sale a segundo plano.
4. Se repite con Inicio en la raíz y con categoría → producto, y se hace un doble toque rápido.
5. Metro y `logcat` no muestran «was not handled by any navigator».

La validación en iOS Simulator va en el pase único de T8.

### RF-38 — Redirección única fuera del render en la consulta del pedido (H-T8-3)

**Causa.** `OrderStatusScreen` llama a `router.replace('/(tabs)/(cart)/checkout')` durante el render cuando `checkoutAttempt.status === 'idle'`, y React avisa «Cannot update a component while rendering…». Además, `checkOrderStatus` despacha `attemptOutcome` dentro del thunk. Con `confirmed`, `notCreated` o `expired`, `transitionAttempt` devuelve `initialAttempt` (`idle`) ANTES de que `await …unwrap()` termine. Así, la pantalla se vuelve a renderizar con `idle` y redirige al checkout, y después el `consult` hace `replace` a la confirmación. El resultado son dos redirecciones, y la primera va al destino equivocado.

**Archivos y responsabilidades:**
- `src/features/checkout/logic/order-status-redirect.ts` (+test), lógica pura sin RN: una máquina mínima con fases `watching | consulting | done`. Sus eventos son los siguientes:
  - `attemptObserved(status)`: solo en `watching` y con `status === 'idle'` decide `checkout`.
  - `consultStarted`: pasa a `consulting`; mientras tanto, `idle` NO redirige porque espera el resultado.
  - `consultFinished({ outcome, status })`: `confirmed` decide `order-confirmation`; si no, `status === 'idle'` decide `checkout`; si sigue pendiente o sin resolver, vuelve a `watching` sin redirigir.
  - `left`: pulsar Cancelar o desmontar la pantalla pasa a `done` sin destino.

  Cualquier decisión pasa a `done`, y en `done` ningún evento vuelve a decidir: una sola redirección. Devuelve `{ phase, redirect: 'checkout' | 'order-confirmation' | null }`. Los destinos son los actuales. RF-38.
- `src/features/checkout/screens/OrderStatusScreen.tsx`:
  - Guarda la fase en un `useRef`, porque es un guard que no se pinta.
  - Ejecuta `router.replace` solo desde un `useEffect` que depende de `attempt.status` (incluido el montaje con `idle`) o desde la continuación asíncrona de `consult`. Ninguna de las dos ocurre durante el render.
  - `consult` marca `consultStarted` antes del `dispatch` y usa `try/finally`. Un `unwrap` que lance cuenta como `consultFinished` con el estado vigente, para no quedar en `consulting`.
  - Cancelar marca `left` antes de `router.back()`, así que un resultado tardío no navega.
  - Mientras el intento es `idle`, la pantalla renderiza `null` y no muestra contenido de un intento inexistente.
  - El efecto es idempotente ante una nueva ejecución (Strict Mode o Fast Refresh): un ref de montaje se pone en `true` en cada ejecución y en `false` en el cleanup, y la continuación asíncrona lo consulta.

  No se limpia el historial del stack Carrito (spec, Fuera de alcance). RF-38.

**Decisión.**
- **Elegida:** efecto + máquina pura con guard de una sola vez. **Trade-off:** más código que un `<Redirect>` declarativo y un ref que hay que explicar. A cambio, distingue «`idle` porque la propia consulta confirmó» de «`idle` por cualquier otra causa», que es lo que impide la segunda redirección, y la regla se prueba en Node.
- **Descartada A:** `<Redirect href=… />` de expo-router. Por dentro hace `router.replace` en `useFocusEffect` sin dependencias, así que se ejecuta en cada foco. Además, al pasar a `idle` durante la consulta se renderizaría y mandaría al checkout antes de conocer el resultado `confirmed`. Mezclaría un destino declarativo con otro imperativo y no se puede probar sin RNTL.
- **Descartada B:** mover la navegación al thunk o a un listener Redux. Acopla la capa de datos al router y navegaría aunque la pantalla ya no estuviera visible.
- **Descartada C:** no pasar a `idle` hasta navegar. Cambiaría la máquina idempotente del Día 4 (`attempt-machine.ts`) y su persistencia, fuera de RF-38.

**Analogía.** Navegar es un efecto, no parte de la descripción de la UI.
- **Compose:** `LaunchedEffect(status) { if (!navigated) { navigated = true; navController.navigate(…) { popUpTo(current) { inclusive = true } } } }`, con `navigated` en `rememberSaveable`. Llamar a `navigate` en el cuerpo de la composición se repite en cada recomposición.
- **SwiftUI:** `.onChange(of: status)` o `.task`, con `@State var didRedirect`. Cambiar la navegación dentro de `body` produce «Modifying state during view update», la misma clase de error que el aviso de React.

Error típico al venir de nativo: confiar en que el render se ejecuta una sola vez.

**Tests primero (`order-status-redirect.test.ts`).** Los tests comprueban los siguientes resultados:
- Montaje con `idle` da `checkout` una vez, y un segundo `attemptObserved('idle')` da `null`.
- Montaje con `unresolved` o pendiente da `null`.
- `consultStarted` seguido de `attemptObserved('idle')` da `null`, y `consultFinished(confirmed)` da `order-confirmation`; ninguna secuencia de ese caso produce `checkout`.
- `consultFinished(notCreated | expired)` con `idle` da `checkout`.
- `consultFinished(pending)` vuelve a `watching` sin destino.
- `left` seguido de cualquier evento da `null`.
- Un fallo de `unwrap` con estado `idle` da `checkout`, y con estado no `idle` da `null`.

**Validación en Samsung SM-A037M.** Se ejecuta el siguiente recorrido:
1. Se hace una orden ficticia que responda 202 `pending`.
2. «Consultar estado» lleva a «Pedido confirmado» una sola vez, sin pasar por el checkout.
3. No aparece el toast rojo de LogBox, y Metro y `logcat` no contienen «Cannot update a component while rendering».
4. Cancelar mientras está pendiente vuelve a la pantalla anterior.

Los casos `notCreated`/`expired` y «abrir sin intento» quedan cubiertos por los tests deterministas, salvo que se puedan provocar con el mock sin tocarlo. La validación en iOS Simulator va en el pase único de T8.

### RF-39 — Texto de denegadas recuperables vs bloqueadas (H-T8-4)

**Causa.** `classifyNotificationPermission` devuelve `request` cuando el diálogo todavía podría resolverse. `scheduleOrderNotification` convierte en `unusable` tanto ese caso, cuando la orden ya usó su solicitud o el usuario acaba de rechazar, como el bloqueo real, y en ambos con `canOpenSettings: true`. Por eso la pantalla siempre muestra `notificationUnavailableSettings` («bloqueadas»).

**Regla (pura, junto a la matriz de permisos vigente).** La categoría se deriva de la ÚLTIMA lectura de permisos de esa evaluación: la respuesta de `requestPermissionsAsync` si se pidió, o la de `getPermissionsAsync` si no.
- **Denegadas recuperables:** `platform === 'android'`, `hasRuntimePrompt === true` y `classifyNotificationPermission(...)` es `request`. Es el estado `denied` con `canAskAgain`, sin `runtimeGranted`.
- **Bloqueadas:** todo lo demás no utilizable. Incluye Android sin diálogo runtime, `canAskAgain` falso, permiso runtime concedido con las notificaciones de la app desactivadas, cualquier estado de iOS (incluido `undetermined` con la solicitud ya registrada) y estados desconocidos.

Encaja con los casos límite de la spec:
- Primer rechazo en Android 13+: `denied` + `canAskAgain`, recuperable.
- Una orden posterior sin diálogo: `canAskAgain` falso, bloqueadas.
- iOS tras rechazar: `ios.status` `denied`, bloqueadas.
- Provisional o efímero: utilizables.

En ningún caso se vuelve a pedir acceso para la misma orden: `requestPermission` sigue saliendo de `permissionRequested` (RF-23).

**Archivos y responsabilidades.** Siguen el patrón de `order-notification-state.ts`: transiciones puras con un registro por orden, y la UI solo elige el texto.
- `src/features/notifications/logic/notification-permission.ts` (+test): nuevo tipo `UnusableReason = 'denied-recoverable' | 'blocked'` y nueva función pura `classifyUnusableReason(input: PermissionInput): UnusableReason`, que aplica la regla anterior reutilizando `classifyNotificationPermission`. Los tests de la matriz Android con diálogo, Android sin diálogo e iOS se amplían. La variante Android sin diálogo sigue rotulada como determinista. RF-39, RF-33.
- `src/features/notifications/logic/schedule-order-notification.ts` (+test): el resultado `unusable` añade `reason`, calculado con la última `PermissionInput`. `canOpenSettings` se conserva y siempre vale `true`. RF-39.
- `src/features/notifications/logic/order-notification-coordinator.ts` (+test) y `store/create-order-notification-listener.ts` (+test): `onUnusable(canOpenSettings, reason)` y `notificationUnusable({ orderId, canOpenSettings, reason })` reenvían la razón sin decidir nada. RF-39.
- `src/features/orders/logic/order-notification-state.ts` (+test):
  - `OrderNotificationRecord` añade `unusableReason?: UnusableReason`, presente solo con `status === 'unusable'`.
  - `markNotificationUnusable(state, id, canOpenSettings, reason)` la guarda.
  - `markNotificationScheduling`, `markNotificationScheduled` y `markNotificationFailed` la eliminan, de modo que cada reintento muestra la nueva evaluación.
  - `sanitizeOrderNotificationState` acepta solo los dos valores. Si el estado es `unusable` y la razón falta o es inválida, usa `'blocked'`, el texto vigente y conservador; si el estado no es `unusable`, la descarta.

  Para no crear un ciclo `orders → notifications`, el tipo se declara en `orders/logic` y `notification-permission.ts` lo importa, o se define en un módulo de tipos compartido. Lo decide el implementador sin cambiar el contrato. RF-39, RNF-1: solo una etiqueta, sin datos personales.
- `src/features/orders/store/order-history-slice.ts` (+test): el payload de `notificationUnusable` incluye `reason`. RF-39.
- `src/core/storage/persist-policy.ts` (+test) y `src/core/storage/order-notification-persistence.test.ts`: la forma persistida del registro cambia, así que, según la regla del propio archivo, `PERSIST_VERSION` pasa de 2 a 3 y `READABLE_PREVIOUS_VERSIONS` pasa a `[1, 2]` después de que un test demuestre que un registro v2 sin `unusableReason` se restaura como `blocked` y conserva carrito, búsqueda, intento y órdenes. RF-39, RF-25.
- `src/features/checkout/logic/order-notification-notice.ts` (+test), lógica pura: `buildNotificationNotice(record | undefined)` devuelve `{ messageKey, showSettings, showRetry, retrying } | null`. `null` significa notificada, y la pantalla oculta el bloque.

  | Registro | Texto (`messageKey`) | Ajustes | Reintento |
  |---|---|---|---|
  | `unusable` + `denied-recoverable` | `checkout.confirmation.notificationDeniedRecoverable` | Sí | Sí |
  | `unusable` + `blocked` | `checkout.confirmation.notificationUnavailableSettings` | Sí | Sí |
  | `failed` | `notificationFailed` | No | Sí |
  | `scheduling` | `notificationRetrying` | No | Sí, deshabilitado |
  | Sin registro o `idle` | `notificationPending` | No | Sí |

  Las dos categorías `unusable` comparten acciones y solo cambian el texto. Sustituye el ternario anidado de `OrderConfirmationScreen`. RF-39.
- `src/features/checkout/screens/OrderConfirmationScreen.tsx`: pinta lo que devuelve `buildNotificationNotice`. Conserva los botones, las pistas y la región viva actuales. RF-39, RNF-3.
- `src/core/i18n/resources/es.ts` y `en.ts`:
  - Nueva clave `checkout.confirmation.notificationDeniedRecoverable` con el texto aprobado en RF-39:
    - ES: «No permitiste las notificaciones para este pedido. Puedes habilitarlas en Ajustes; podremos volver a preguntarte en tu próximo pedido.»
    - EN: «You didn't allow notifications for this order. You can enable them in Settings; we may ask again on your next order.»
  - `notificationUnavailableSettings` (bloqueadas) no cambia.

  `parity.test.ts` debe seguir en verde, y un test fija el texto exacto de las dos claves en ES/EN. RF-32, RF-39.

**Persistencia o reevaluación.**
- La categoría es la de la última evaluación de esa orden: se persiste en el registro (MMKV, `orderHistory`) y se reemplaza en cada reintento.
- Tras un reinicio se muestra la última categoría conocida sin consultar al sistema, igual que hoy con `unusable`.
- Si el usuario habilita las notificaciones en Ajustes y pulsa «Reintentar notificación», el coordinador vuelve a evaluar: `scheduling` borra la razón y, al programar, `scheduled` y `notified` hacen desaparecer el texto (RF-24, RF-25).
- Si no las habilitó, vuelve a `unusable` con la razón de esa nueva lectura, sin pedir permiso de nuevo.

**Decisión.**
- **Elegida:** derivar la razón en la capa pura de permisos y guardarla en el registro de la orden. **Trade-off:** sube la versión de persistencia y añade un campo al registro. A cambio, el texto es coherente tras un reinicio, se prueba en Node y la UI no decide nada.
- **Descartada A:** volver a consultar `getPermissionsAsync` al montar la confirmación. Mete trabajo asíncrono nativo en la UI y mostraría un estado actual, no «la última evaluación de esa orden» que pide RF-39; además, no se prueba sin RNTL.
- **Descartada B:** guardar la razón solo en memoria. Tras un reinicio caería siempre en «bloqueadas», aunque fuera recuperable.
- **Descartada C:** reutilizar `canOpenSettings` como discriminante. Hoy siempre vale `true` para `unusable`, y cambiar su significado rompería la semántica de T8 y su saneado.
- **Descartada D:** añadir el campo sin subir `PERSIST_VERSION`. Funcionaría porque el saneado tolera la ausencia, pero contradice la regla documentada en `persist-policy.ts`.

**Analogía.**
- **Android/Compose:** `shouldShowRequestPermissionRationale()` es `true` tras el primer rechazo (recuperable) y `false` tras el segundo o con «No volver a preguntar» (bloqueado). Es lo que expo-notifications traduce a `canAskAgain`. En Compose se modela con un `sealed interface NotificationAvailability { Usable; DeniedRecoverable; Blocked }` y un `when` que elige el `stringResource`.
- **iOS/SwiftUI:** `UNAuthorizationStatus.denied` es terminal y solo Ajustes lo cambia; `.notDetermined` es el único estado que pregunta. En SwiftUI, un `enum` con `switch` devuelve la `LocalizedStringKey`.

Error típico al venir de nativo: prometer «te lo volveremos a preguntar» cuando el sistema decide si muestra el diálogo.

**Tests primero:**
- `notification-permission.test.ts`, matriz de `classifyUnusableReason`:
  - Android 13+: `denied` + `canAskAgain` da recuperable; `denied` sin `canAskAgain` da bloqueadas; `runtimeGranted` con notificaciones desactivadas da bloqueadas.
  - Android <33 desactivado da bloqueadas, en variante determinista.
  - iOS `denied`, o `undetermined` con la solicitud ya registrada, da bloqueadas.
  - Un estado desconocido da bloqueadas.
- `schedule-order-notification.test.ts`:
  - El primer rechazo tras `requestPermissions` da recuperable.
  - Con `requestPermission: false` no se llama a `requestPermissions` y la razón sale de `getPermissions`.
  - El segundo rechazo da bloqueadas.
- Coordinador y listener: reenvían la razón.
- `order-notification-state.test.ts`:
  - `unusable` guarda la razón y `scheduling`, `scheduled` y `failed` la borran.
  - Reintento recuperable → bloqueadas.
  - El saneado acepta `blocked` por defecto y descarta valores inválidos.
- `persist-policy.test.ts`: v3 y lectura de v2 y v1.
- `order-notification-notice.test.ts`: la tabla anterior, la igualdad de acciones entre las dos categorías y `null` si está notificada.
- Texto exacto ES/EN de las dos claves.

**Validación en Samsung SM-A037M (Android 13, variante con diálogo runtime real):**
1. Se restablece el permiso para que el diálogo vuelva a ser posible: `adb shell pm revoke` + `pm clear-permission-flags` (banderas `user-set`/`user-fixed`) sobre `com.herbstore.mobile`. Autorizado por el usuario el 2026-10-14 (decisión 4).
2. Orden A: se rechaza el diálogo y aparece el texto de denegadas recuperables en ES. Se cambia a EN, se reintenta sin diálogo y aparece el mismo estado en EN. `logcat` muestra 0 `GrantPermissionsActivity` en el reintento.
3. Orden B: aparece el diálogo, se rechaza y el texto pasa a bloqueadas en ES/EN, con los mismos botones.
4. Se habilitan las notificaciones en Ajustes, se pulsa reintentar, se programa la notificación y el texto desaparece.
5. Se reinicia la app y la categoría de cada orden se conserva.
6. Se comprueba el texto ampliado (`font_scale` 2.0) dentro del `ScrollView`.

La variante Android sin diálogo queda cubierta por los tests y rotulada como no validada en dispositivo (RF-33). En iOS Simulator, la categoría bloqueadas tras rechazar se observa en el pase único de T8.

### Validación iOS única de T8 (después de RF-37 a RF-39)
Se hace un único pase en iOS Simulator (iPhone 17 Pro) con Metro y el mock activos, sin recompilar porque no hay cambios nativos. Cubre lo que T8 tenía pendiente y lo que exige el criterio de finalización del cambio:
- «Ir a Inicio» del carrito vacío con Inicio en la raíz y con un detalle apilado: llega a la raíz sin flecha ni instancias duplicadas, también con doble toque.
- La consulta del pedido no muestra advertencias de render en Metro ni superpuestas.
- Tras rechazar el diálogo, aparece el texto de bloqueadas en ES/EN. Para que el diálogo vuelva a aparecer se reinstala el Development Build en el Simulator, autorizado por el usuario el 2026-10-14 (decisión 3): se pierden los datos locales del Simulator, que son ficticios. No se sustituye por desactivar las notificaciones en Ajustes, porque eso no es «tras rechazar» el diálogo.
- Programación y cancelación durante la espera, inglés, tema oscuro, texto ampliado, roles, ocupado, foco y targets de 44 pt, y reduced motion de la superficie de notificación.
- Se observa y registra, sin criterio propio, la salida «Ir a Inicio» de la pantalla de enlace no reconocido.
- Se observa y registra, sin criterio propio, si el tap de la notificación (RF-24, `goHome`) deja un detalle bajo Inicio cuando Inicio tenía un detalle apilado (seguimiento S-RF24, abajo).

Para escribir en los campos bajos del checkout se usa el teclado en pantalla (`MEMORY.md`, «Aprendizajes»).

Nota práctica para el inglés (H-T8-5, comportamiento por diseño): `src/core/i18n/index.ts` arranca siempre con el idioma del sistema y los botones de Cuenta > Fundamentos solo cambian el idioma en memoria. Para validar en inglés hay que elegir EN en Fundamentos después de CADA arranque en frío (también tras reinstalar el Development Build o tras el tap frío de una notificación), o bien poner el Simulator en inglés. Conviene usar datos inventados en el checkout: el mock guarda las órdenes solo en memoria.

### Seguimientos del cambio
- **S-RF24 (tap de la notificación con Inicio apilado).** Por la misma lectura de `POP_TO`, `goHome` (RF-24) podría dejar un detalle bajo Inicio si Inicio tenía un detalle apilado. Es solo una deducción leyendo expo-router, sin confirmar en dispositivo. Se observa durante la validación iOS única de T8 y se registra en la evidencia; NO amplía el alcance, no tiene criterio de aceptación propio y `go-home.ts` no cambia en esta revisión. Si se confirma, su corrección vuelve primero a `spec.md`.

## Decisiones del usuario (2026-10-14)
La spec está aprobada; cualquier cambio de alcance vuelve primero a `spec.md`. El usuario respondió a las cuatro preguntas de la Revisión 4 y aprobó este plan y `tasks.md` el 2026-10-14:
1. **RF-37:** se confirma la función pura nueva `home-root-plan.ts` (`POP_TO_TOP` dirigido al stack de Inicio solo si tiene más de una pantalla, y después `JUMP_TO`). Se descarta reutilizar `goHome`.
2. **Tap de la notificación (RF-24):** el posible defecto se registra como seguimiento S-RF24 y se observa en la validación iOS de T8, sin ampliar alcance ni criterio propio.
3. **iOS:** se autoriza reinstalar el Development Build en el Simulator para probar «rechazar el diálogo → bloqueadas»; se pierden los datos locales del Simulator, que son ficticios.
4. **Samsung:** se autoriza `adb shell pm revoke` + `pm clear-permission-flags` sobre `com.herbstore.mobile` para restablecer el permiso de notificaciones y observar «denegadas recuperables».
5. **Tamaño de la spec:** se mantiene todo en la spec 005 con 14 tareas. Es una excepción documentada al máximo de 10 de la skill: el criterio de finalización ata RF-37 a RF-39 a la validación iOS única de T8, y separarlos obligaría a cerrar T8 sin ellos o a crear una dependencia entre specs.

## Preguntas abiertas
- Ninguna.
