# Tareas 005 — Día 5: capacidades nativas y plataforma

- [ ] **T1. Crear el contrato y función sync/async de DeviceInsights en Kotlin y Swift.** RF-1, RF-2, RF-3, RF-4, RF-5
- Hecho cuando: ambas plataformas devuelven platform/model/systemVersion/isPhysical con el mismo tipo, error controlado y sin identificadores sensibles; recompilar y parar para validar Android/iOS.
- [ ] **T2. Completar evento y vista nativa de DeviceInsights.** RF-6, RF-7, RNF-2, RNF-3
- Hecho cuando: cada refresh emite un evento, unsubscribe evita callbacks, label/accent se reflejan y press entrega platform/timestamp una vez en Android/iOS.
- [ ] **T3. Configurar permisos y construir la máquina del escáner.** RF-8, RF-9, RF-12, RF-14
- Hecho cuando: checksum inválido no consulta, undetermined/denied/granted y cambio en foreground muestran el estado correcto, sin guardar imágenes; validar ambas plataformas.
- [ ] **T4. Completar consulta, bloqueo, rearmado y cleanup del escáner.** RF-10, RF-11, RF-13
- Hecho cuando: callbacks rápidos producen una navegación, no encontrado requiere rearmado y unmount descarta resultados; parar y probar Android/iOS.
- [ ] **T5. Integrar háptico, notificación deduplicada, share y deep links.** RF-15, RF-16, RF-17, RF-18, RF-19
- Hecho cuando: add solicita un háptico, permisos de notificación siguen tres estados, una order id notifica máximo una vez, share cancela sin cambios y deep links pasan frío/activo en ambas plataformas.
- [ ] **T6. Validar perfiles EAS, variables y matriz OTA/binario.** RF-20, RF-21, RF-22, RNF-1
- Hecho cuando: development/preview tienen evidencia fechada válida, inventario no contiene valores secretos y ejemplos JS/nativo quedan correctamente clasificados.
- [ ] **T7. Cerrar y validar el Día 5.** RF-23, RF-24, RF-25, RF-26, RNF-4
- Hecho cuando: lint/typecheck/install-check/Doctor pasan, Development Builds y capacidades reales se validan Android/iOS, y `LEARNING.md`, ejercicio, 8–10 respuestas, checklist, evidencia y commit quedan completos; detenerse.
