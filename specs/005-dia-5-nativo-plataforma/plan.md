# Plan 005 — Día 5: capacidades nativas y plataforma

## Precondiciones y límite del incremento
- Requiere carrito/checkout del Día 4, rutas/deep links del Día 2 y barcode endpoint del Día 1.
- Antes de instalar `expo-camera`, `expo-notifications` y `expo-haptics`, comprobar documentación y compatibilidad con SDK 57 y usar `npx expo install`; comprobar también Expo Modules API actual, no APIs recordadas.
- Siete checkpoints de 20–30 minutos priorizan DeviceInsights bilateral → cámara → feedback/notificación → EAS/OTA. Todo cambio nativo exige validación real Android/iOS; si se agota el timebox, se retoma sin aceptar una limitación ambiental como cierre.

## Archivos y responsabilidades
- `modules/device-insights/expo-module.config.json`, `package.json`, `src/index.ts`: registro y contrato TypeScript del módulo local.
- `modules/device-insights/android/.../DeviceInsightsModule.kt`, `DeviceBadgeView.kt`: función sync, async, evento y vista Android.
- `modules/device-insights/ios/DeviceInsightsModule.swift`, `DeviceBadgeView.swift`: contrato equivalente iOS.
- `src/core/native/device-insights.ts`: fachada tipada para evitar imports nativos en UI.
- `src/features/device-insights/screens/DeviceInsightsScreen.tsx`: demo de función, actualización, evento y vista. RF-4–RF-7.
- `src/features/scanner/domain/ean13.ts`: checksum puro y discriminación válido/inválido. RF-9.
- `src/features/scanner/hooks/useBarcodeScanner.ts`: permiso, armed/processing/disarmed, lifecycle y cleanup. RF-8–RF-14.
- `src/features/scanner/screens/ScannerScreen.tsx`: cámara/fallback/no encontrado/rearmado; reemplaza placeholder del Día 2 sin cambiar ruta.
- `src/features/feedback/haptics.ts`: responde una vez al evento de agregado exitoso. RF-15.
- `src/features/notifications/order-notifications.ts`: permiso y dedupe persistente por order id, usando solo resumen no sensible. RF-16, RF-17.
- `src/features/products/share-product.ts`: Share con texto localizado y deep link. RF-18.
- `app.config.ts`: configuración reproducible de scheme, cámara, notificaciones y módulo; sustituye configuración estática conservando valores existentes.
- `eas.json`: perfiles development/preview. RF-20.
- `.env.example`: solo nombres públicos/documentados, nunca valores sensibles. RF-21.
- `docs/evidence/day-5-platform.md`: matriz fechada Android/iOS, perfiles, variables y OTA/binario. RF-19–RF-22.
- Recursos i18n y `LEARNING.md`: permisos, estados y cierre. RF-23–RF-26.

## Contratos DeviceInsights
- Sync `getPlatformName(): 'android' | 'ios'`.
- Async `refreshInsightsAsync(): Promise<{ platform, model, systemVersion, isPhysical }>`; error se transforma a resultado controlado en la feature.
- Evento `onInsightsUpdated`: `{ summary, timestamp }`, exactamente uno por refresh satisfactorio mientras existe suscriptor.
- `DeviceBadgeView`: props `{ label, accentColor }`; evento `onPress` con `{ platform, timestamp }`.
- Kotlin y Swift implementan el mismo contrato; el adapter JS valida payload y gestiona unsubscribe. RF-4–RF-7, RNF-1, RNF-2.

## Flujo de cámara y capacidades
1. Al entrar, consultar permiso; `undetermined` solicita, denied/restricted muestra fallback y opción settings cuando existe. RF-8.
2. Solo estado armed procesa un EAN-13 con checksum; pasa de inmediato a processing y descarta callbacks posteriores. RF-9–RF-11.
3. Barcode endpoint: encontrado → detalle único; 404 → no encontrado y botón de rearmado; inválido no consulta. RF-9–RF-11.
4. Foreground vuelve a consultar permiso; unmount invalida trabajo pendiente y apaga cámara. RF-12–RF-14.
5. Evento cart `productAdded` solicita un háptico, una vez. Confirmación de orden consulta permiso de notificaciones; dedupe por order id evita repetir tras recuperación idempotente. RF-15–RF-17.

## Android, iOS, CNG y EAS
- El código Kotlin/Swift vive en el módulo local, no en salidas generadas. Permisos/plugins se configuran en app config; CNG regenera los proyectos y después se recompilan Development Builds.
- Diferencias reales: apertura de settings y valores de plataforma se encapsulan en adaptaciones; comportamiento de negocio permanece común.
- Deep links se prueban en arranque frío/activo con herramientas nativas (`adb` y `xcrun`) sin guardar identificadores de dispositivos. RF-19.
- EAS: validar perfiles y configuración para ambos; si el servicio está disponible, registrar resultado de build de validación, sin publicar. Inventariar variable/nombre/entorno/clasificación sin valores secretos. RF-20, RF-21.
- Matriz OTA: cambio JS/recurso compatible vs permiso/dependencia/módulo nativo que exige binario. RF-22.

## Accesibilidad, i18n y rendimiento
- Scanner anuncia permiso, inválido, no encontrado y processing; mantiene salida accesible y no depende del háptico. RNF-3.
- Device badge usa label accesible y fallback para color inválido/vacío. Cámara no persiste imágenes. RNF-1.
- Cancel/back responde durante async; callbacks desmontados no actualizan UI. RNF-2.
- Todos los textos/propósitos de permiso/share/notificación están en es/en. RF-23.

## Decisiones y alternativas
- **Elegida:** Expo Module local. **Trade-off:** recompilación nativa y dos implementaciones. **Descartada:** TurboModule RN CLI, fuera de CNG/Expo elegido, pero se compara pedagógicamente.
- **Elegida:** máquina armed/processing explícita. **Trade-off:** más estados. **Descartada:** cooldown temporal ciego, que puede duplicar navegación.
- **Elegida:** dedupe de notificación por order id persistido en resumen no sensible. **Trade-off:** metadato adicional. **Descartada:** notificar cada respuesta idempotente.
- **Elegida:** app config + CNG. **Trade-off:** recompilar tras cambios. **Descartada:** editar manualmente proyectos generados.
- **Elegida:** Share nativo de RN. **Trade-off:** UI depende del SO. **Descartada:** dependencia extra sin requisito.

## Verificación
- Sin Jest/RNTL/Maestro aún: lint, typecheck, install check, Expo Doctor, build Android/iOS, logs del módulo sin PII y matriz manual.
- Casos: sync/async/event/view; subscribe/unsubscribe; checksum; callbacks rápidos; permission undetermined/denied/granted/cambio; unmount; háptico una vez; notificación dedupe; share cancel; deep links frío/activo.
- Día 6 automatiza checksum/adapters/componentes donde sea razonable; capacidades físicas mantienen prueba manual bilateral.

## Bloque pedagógico
- Teoría previa: Expo Modules/JSI/Codegen/TurboModule, permisos/lifecycle, eventos/vistas, EAS/variables/OTA. RF-1–RF-3.
- Analogías: módulo Expo ↔ Android library/iOS framework; Promise ↔ suspend/async; event emitter ↔ Flow/Combine; native view ↔ Android View/UIView bridged.
- `LEARNING.md` registra trade-offs, ejercicio de eventos/permisos, 8–10 respuestas, checklist, evidencia Android/iOS y commit. RF-24–RF-26.
