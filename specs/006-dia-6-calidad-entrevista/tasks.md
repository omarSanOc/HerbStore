# Tareas 006 — Día 6: calidad y preparación de entrevista

- [ ] **T1. Configurar Jest/RNTL y el harness determinista.** RF-1, RF-2, RF-4, RF-5, RNF-1
- Hecho cuando: suite arranca sin internet, render helper aporta store/i18n y fetch controlado representa success/empty/4xx/5xx/timeout/latency.
- [ ] **T2. Cubrir lógica acumulada de carrito, moneda, búsqueda y checkout.** RF-3, RF-5, RF-17
- Hecho cuando: reducers/selectors, 800 MXN, tasa 18, normalización/merge/schema y estados idempotentes tienen casos deterministas en verde.
- [ ] **T3. Cubrir componentes y estados accesibles con RNTL.** RF-4, RF-5, RF-17
- Hecho cuando: lista, carrito, formulario, unresolved, error/offline/empty y fallback se verifican por rol/texto/estado, no por internals.
- [ ] **T4. Completar Cuenta, preferencias y auditoría i18n.** RF-7, RF-8, RF-9, RF-10, RF-11, RF-12, RNF-3
- Hecho cuando: es/en, MXN/USD, system/light/dark y Mis pedidos sobreviven reinicio, vacío tiene CTA y ninguna traducción o dirección queda pendiente; validar Android/iOS.
- [ ] **T5. Automatizar el flujo crítico con Maestro.** RF-6, RF-17, RNF-1, RNF-2
- Hecho cuando: desde estado limpio busca, agrega, llena dirección, protege doble tap y observa una confirmación; se confirma manualmente la plataforma complementaria.
- [ ] **T6. Ejecutar auditorías de accesibilidad y rendimiento.** RF-13, RF-14, RF-15, RF-16, RNF-4
- Hecho cuando: contraste cumple ratios, TalkBack/VoiceOver y foco tienen evidencia bilateral, y baseline/after de Home/lista/carrito conserva solo mejoras sin regresión.
- [ ] **T7. Realizar live coding y evaluación de 45 minutos.** RF-18, RF-19
- Hecho cuando: cronómetro se detiene al minuto 45 y la rúbrica registra cada criterio y mejora sin extender el ejercicio.
- [ ] **T8. Crear banco final y cerrar el programa.** RF-20, RF-21, RF-22, RF-23, RNF-2
- Hecho cuando: existen exactamente 30 preguntas con respuesta y conexión individual, más ejercicio y 8–10 preguntas distintas; lint/typecheck/Jest/RNTL/Maestro y Android/iOS pasan, `LEARNING.md`, checklist y commit final quedan completos; detenerse.
