# Constitución de HerbStore

1. **Stack mínimo:** usar solo el stack obligatorio de `AGENTS.md`; toda dependencia adicional requiere necesidad demostrable, compatibilidad con Expo y aprobación previa.
2. **Spec antes que código:** ningún comportamiento fuera de alcance se implementa; cada cambio relevante debe corresponder a un RF de una spec aprobada.
3. **Lógica separada de UI:** rutas y componentes presentan estado y eventos; reglas de negocio, acceso a datos y transformaciones viven fuera de la interfaz y son comprobables de forma aislada.
4. **Tests proporcionales:** cada cambio pasa lint y typecheck, más tests existentes y validación Android/iOS aplicable; no se instalan herramientas de test fuera de un plan aprobado.
5. **Datos protegidos:** nunca registrar ni persistir secretos o datos personales; solo carrito, historial y preferencias no sensibles pueden guardarse localmente.
6. **Idioma coherente:** código, identificadores y commits en inglés; explicaciones en español y todo texto visible disponible en español e inglés mediante i18n.
