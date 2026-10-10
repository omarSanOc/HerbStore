# Tareas 004 — Día 4: estado, carrito y checkout

- [ ] **T1. Configurar persistencia segura y migrar historial de búsqueda.** RF-2, RF-11, RF-12, RF-16, RF-27, RNF-1
- Hecho cuando: MMKV rehidrata solo whitelist, historial conserva reglas del Día 3, `preliminary` persiste únicamente key/fingerprint/status y al reiniciar se promueve a `unresolved` antes de checkout para consultar status; corrupción cae a vacío y ninguna dirección/request/error payload aparece en storage; parar y comprobar reinicio Android/iOS.
- [ ] **T2. Implementar carrito, conversión y selectors puros.** RF-5, RF-7, RF-8, RF-10, RF-13
- Hecho cuando: cantidades, badge, subtotal, tasa 18 y umbral canónico 800 producen valores verificables sin mutación.
- [ ] **T3. Completar detalle y agregado animado.** RF-4, RF-6, RF-7, RNF-2, RNF-3
- Hecho cuando: galería, stock, cantidad, share/deep link y sticky add funcionan; feedback desaparece con reduced motion; parar y validar Android/iOS.
- [ ] **T4. Completar carrito visual, swipe y rehidratación.** RF-8, RF-9, RF-10, RF-11, RF-13
- Hecho cuando: swipe no compite con scroll, hay alternativa accesible, última unidad elimina, vacío bloquea checkout y progreso cambia en 800 MXN; confirmar ambas plataformas.
- [ ] **T5. Construir formulario y validación de dirección.** RF-14, RF-15, RF-17, RNF-3
- Hecho cuando: reglas Zod y mensajes es/en pasan; `VALIDATION_ERROR.fields` conocido se asigna al control/línea, path desconocido o general se anuncia accesiblemente, y ningún value/dirección se persiste o registra.
- [ ] **T6. Implementar fingerprint y máquina idempotente completa.** RF-16, RF-17, RF-18, RF-19, RF-20, RF-21, RF-22, RF-23, RF-24, RF-25, RF-26, RF-27
- Hecho cuando: el request no envía totales y su fingerprint canónico aplica trim, orden de keys/items y rechazo de duplicados; la matriz verifica `preliminary`; 400/`OUT_OF_STOCK` temprano limpia y refresca, pero tardío con unresolved conserva; 202/`IDEMPOTENCY_KEY_REUSED`/offline/timeout/5xx/payload incoherente eleva o conserva `unresolved`; 200 guarda un único resumen y dedupe por order id; 404/410 solo liberan con status+code coherentes; cancel solo oculta, restart promueve preliminary y consulta sin PII, y pending conserva la reserva.
- [ ] **T7. Cerrar y validar el Día 4.** RF-28, RF-29, RF-30, RF-31, RNF-1, RNF-2, RNF-3, RNF-4
- Hecho cuando: lint/typecheck y matriz cart/checkout/storage—including restart preliminary→unresolved, ambos 409, terminales coherentes e inconsistentes—pasan; flujo se valida Android/iOS, es/en, texto ampliado y reduced motion; `LEARNING.md`, ejercicio, 8–10 respuestas, checklist y commit quedan completos; detenerse.
