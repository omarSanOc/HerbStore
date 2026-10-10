# AGENTS.md — HerbStore
App didáctica de e-commerce de suplementos para aprender React Native y preparar una entrevista técnica mobile. El código debe ser productivo, explicable y fácil de relacionar con Android/Kotlin y iOS/Swift.

## Stack y estructura
- Expo SDK 57 + React Native 0.86, Development Build y New Architecture; nunca Expo Go.
- TypeScript strict, Expo Router, Redux Toolkit/RTK Query, redux-persist y MMKV.
- FlashList, expo-image, Reanimated, Gesture Handler, Gorhom Bottom Sheet, React Hook Form y Zod.
- i18next/expo-localization, expo-camera, expo-notifications, expo-haptics y un Expo Module en Kotlin/Swift.
- Rutas delgadas en `src/app/`; lógica y UI agrupadas por feature en `src/features/`.
- Infraestructura compartida en `src/core/` y componentes/tokens en `src/design-system/`.
- Backend mock independiente en `mock-server/` con Node, Express y Faker con seed fija.
- `ios/` y `android/` son salidas generadas por CNG y permanecen ignoradas por Git.

## Convenciones
- Código, nombres de archivos, commits e identificadores en inglés; explicaciones y material de estudio en español.
- Cada concepto de RN debe compararse con Kotlin/Compose y Swift/SwiftUI.
- Componentes funcionales y hooks; props inmutables y estado actualizado sin mutaciones directas.
- Cuando existan alternativas, documenta la elegida, el trade-off y la opción descartada.
- Prioriza accesibilidad, targets táctiles de 44/48 pt, font scaling y reduced motion.
- No optimices por intuición: usa memoización solo con una razón medible y valida con Profiler/DevTools.
- No uses marcas, logos ni imágenes reales; HerbStore y sus datos son ficticios.

## Datos
- El catálogo proviene del servidor Express; RTK Query gestiona requests, caché, reintentos y paginación.
- Redux guarda solo estado global de cliente; el carrito se persiste mediante redux-persist + MMKV.
- La búsqueda mantiene historial persistido y el checkout usa una Idempotency-Key estable por intento.
- Moneda MXN/USD con `Intl.NumberFormat`; interfaz localizada en español e inglés.
- Nunca guardes secretos, tokens, certificados ni datos personales en Git o `MEMORY.md`.

## Expo y plataforma (fácil equivocarse)
- Antes de usar una API Expo/RN, lee la versión de `expo` y consulta la documentación de SDK 57; no confíes en APIs recordadas.
- Instala dependencias de la app con `npx expo install`; luego ejecuta `npx expo install --check` y Expo Doctor.
- Configura permisos y cambios nativos mediante `app.json`/`app.config.ts` y config plugins; no edites los proyectos generados.
- Tras cambiar una dependencia nativa, app config o SDK, regenera/recompila el Development Build.
- Usa `Platform.select` o archivos `.ios.tsx`/`.android.tsx` solo para diferencias reales de plataforma.
- Distingue Metro/JavaScript de Gradle/Xcode: Fast Refresh no reemplaza una recompilación nativa.

## Forma de trabajar
- Sigue el plan de 6 días y avanza en incrementos pequeños ejecutables, no construyas el proyecto completo de golpe.
- Antes de cada bloque: teoría breve; después, construcción guiada y confirmación en Android e iOS.
- Al cerrar cada día: ejercicio sin solución, 8–10 preguntas con respuestas cortas y checklist oral.
- Actualiza `LEARNING.md` y crea un commit claro únicamente al completar y validar el día.
- Señala errores típicos al venir de nativo: mutación, efectos mal declarados, renders innecesarios y trabajo pesado en JS.
- Haz solo lo pedido; conserva trabajo existente y pregunta antes de ampliar alcance o tomar decisiones irreversibles.
- Si el usuario invoca SDD o un comando `/sdd-*`, sigue la skill `sdd` y se permite delegar en los agentes SDD configurados.

## SDD en OpenCode y Claude Code
- Fuente única: roles en `.opencode/agents/`, pasos en `.opencode/commands/` y método en `.agents/skills/sdd/`.
- `.claude/agents/` y `.claude/commands/` son adaptadores finos: solo permisos, argumentos y diferencias de Claude Code.
- Cambia el comportamiento en `.opencode/` o en la skill, nunca duplicándolo en `.claude/`.
- Coordinador: en OpenCode, agente `coordinator`; en Claude Code, `claude --agent coordinator`.
- Argumentos: OpenCode usa `$1`, `$2` (desde 1); Claude Code usa `$0`, `$1` (desde 0). Texto con espacios, entre comillas.
- Los subagentes no hablan con el usuario: entrevistas, aprobaciones y validación en dispositivo las gestiona el hilo principal.

## Comandos
```bash
npx expo install <package>       # Dependencia compatible con SDK 57
npx expo install --check         # Compatibilidad de dependencias
npx expo start --dev-client      # Metro para el Development Build
npx expo run:android --device    # Compilar/instalar Android
npx expo run:ios --device        # Compilar/instalar iOS
npx expo lint                    # ESLint
npx tsc --noEmit                 # TypeScript strict
npx expo-doctor@latest           # Diagnóstico Expo
npm --prefix mock-server run dev # Servidor mock, cuando esté creado
```
- Usa Jest/RNTL para unitarios y componentes, y Maestro para E2E cuando esa infraestructura esté disponible.
- No ejecutes `npm audit fix --force`; puede sustituir versiones coordinadas por Expo.

## Memoria
- Al empezar, lee `MEMORY.md` para conocer el estado y las decisiones vigentes.
- Al terminar una tarea, actualízalo con estado, decisiones y errores útiles para la siguiente sesión.
- Mantenlo breve (máximo ~50 líneas) y elimina información superada.
- Si una decisión se vuelve una norma permanente, muévela a `AGENTS.md`.
- No guardes datos sensibles, seriales de dispositivos, claves ni tokens.

## Límites
- ✅ Siempre: código en inglés, explicación pedagógica en español y comparación Android/iOS.
- ✅ Siempre: validar lint y typecheck; Expo Doctor si cambian dependencias o configuración.
- ✅ Siempre: comprobar Android e iOS antes de cerrar un incremento funcional.
- ⚠️ Pregunta antes: cambiar el stack obligatorio, ampliar alcance o hacer una operación destructiva.
- 🚫 Nunca: Expo Go, marcas reales, secretos, editar manualmente `ios/`/`android/` o forzar upgrades incompatibles.

## Verificación
- Cambios JS/TS: `npx expo lint` y `npx tsc --noEmit`.
- Dependencias/configuración: añade `npx expo install --check` y `npx expo-doctor@latest`.
- Código nativo: recompila y prueba el Development Build en Android e iOS.
- Lógica: tests Jest; componentes: React Native Testing Library; flujos críticos: Maestro.
- Interfaz: revisa estados loading/error/empty/offline, accesibilidad, tema claro/oscuro y texto escalado.
