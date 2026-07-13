# Orden de trabajo inicial — Kludge

Punto de partida sugerido para el agente. Este documento es un plan vivo, no una regla fija — se espera que se reordene o ajuste conforme avance el desarrollo. No debe copiarse a CLAUDE.md.

**Principio general**: motor antes que interfaz, datos antes que contenido narrativo, un capítulo completo de punta a punta antes que los ocho a medias.

## Fase 0 — Andamiaje del proyecto ✅ (completada 2026-07-13)
1. ✅ Estructura de carpetas: `/engine`, `/game`, `/electron`, `/docs`.
2. ✅ `package.json` (root con npm workspaces), TypeScript (`tsconfig.base.json`, strict), ESLint + Prettier, Vitest en `/engine`.
3. ✅ Documentos de diseño ya presentes en `/docs`.

## Fase 1 — Modelo de datos del motor (`/engine`, sin renderizado)
1. Tipos TypeScript para las tres capas de propiedades (funcional, material, química) — GDD 5.1-5.3.
2. Tipos para el modelo atómico/compuesto/ensamblaje de componentes físicos (GDD 7.1) y elemento/compuesto de sustancias (GDD 5.4.1-5.4.2).
3. Estructura de grafo de nodos/señales (emisor, receptor, conductor) sin lógica de reacción todavía — solo el modelo de datos y su serialización.

## Fase 2 — Motor de reglas
1. Combinación de señales (AND/OR/NOT), memoria/latch, temporización (GDD 5.6).
2. Motor de reacciones químicas con el modelo de resolución de 3 pasos (GDD 5.3) y los parámetros/prioridades de la Especificación de datos técnicos.
3. Sistema de atmósfera por sección con difusión híbrida (GDD 5.5) y dependencia de combustión respecto a concentración de O2.
4. Sobrecarga y fallo de conductores/reservorios.

## Fase 3 — Suite de validación (antes de seguir)
1. Escribir un test por cada uno de los 16 casos de validación del GDD (sección 9).
2. No avanzar a Fase 4 hasta que los 16 pasen contra el motor de Fase 2. Esta suite es la garantía de que el sistema de propiedades funciona como se diseñó antes de gastar tiempo en interfaz.

## Fase 4 — Datos de contenido
1. Catálogo atómico universal (GDD 7.2) con tamaños de footprint.
2. Catálogo de elementos y compuestos químicos (GDD 5.4.1-5.4.2) y mapeo de sustancias pre-mezcladas (Especificación de datos técnicos, sección 3).
3. Catálogos de componentes compuestos por arquetipo (GDD 7.3-7.6) con sus recetas.
4. Parámetros de difusión atmosférica (Especificación de datos técnicos, sección 4).

## Fase 5 — Plano físico y renderizado mínimo
1. Diseñar las 4 naves canónicas en Tiled (GDD 15.1) — geometría, adyacencia de secciones, puntos de anclaje.
2. Exportar a JSON, parsear en `/engine`.
3. Render estático del plano en Phaser (`/game`) — sin interactividad todavía, solo confirmar que el plano se ve correctamente. Primer punto de contacto con el motor de Fase 2.

## Fase 6 — Core loop
1. Modo planificación (pausa) vs. ejecución (tiempo real) — GDD sección 4.
2. Cola de tareas por tripulante, con soporte de dependencias entre tareas de distintos tripulantes.
3. Ejecución en tiempo real con re-pausa en cualquier momento.

## Fase 7 — Mesa de creación
1. Grid de composición espacial compartiendo lógica con el plano principal (GDD 10.1).
2. Cálculo de footprint, nombrado de creaciones, validación de espacio al instalar en el plano.
3. Conexión externa de puertos tras la instalación.

## Fase 8 — Feedback visual
1. Sistema de partículas por fenómeno (GDD 11.1) — empezar por los fenómenos usados en los primeros capítulos de campaña (fuego, chispas, fuga de gas).
2. Flujo animado en conductos activos.
3. Movimiento por salto con gravedad para tripulantes/enemigos (GDD 11.2).

## Fase 9 — Tripulación
1. Selección pre-misión, tiers, afinidad de especialidad (GDD 6.1-6.6).
2. Personalidad y banco de frases (GDD 6.7) — empezar con 1-2 rasgos, no los 5 a la vez.
3. Muertes gráficas reutilizando el sistema de partículas de Fase 8.

## Fase 10 — Primer capítulo de campaña, de punta a punta
1. Implementar "Primer Aviso" (Primeras_8_crisis.md, capítulo 1) completo: disparador, temporizador, solución, consecuencia.
2. Este es el primer punto donde el juego debe ser jugable de principio a fin, aunque sea con un único arquetipo de nave. Sirve para detectar fricciones de integración entre motor, UI y contenido antes de escalar a los otros 7 capítulos.

## Fase 11 — Resto de la campaña y contenido restante
1. Capítulos 2-8, en orden, reutilizando el pipeline validado en la Fase 10.
2. Los 4 arquetipos completos jugables.
3. Modo creativo: export/import de blueprints, modo dev para autoría de estado inicial (GDD 15.2).
4. Árbol de logros y tripulantes nombrados (GDD 6.8).
5. Localización ES/EN.
6. Empaquetado Electron multiplataforma.

## Notas para el agente

- Si en cualquier fase una decisión de diseño no está clara en la documentación, marcarla explícitamente en vez de asumir en silencio — varios puntos del GDD ya están señalados como "pendiente de definir" (sección 17) o como asunciones a confirmar (ej: campaña ligada a un solo arquetipo por partida, en Primeras_8_crisis.md).
- No optimizar prematuramente el motor de reglas — la prioridad es que las 16 validaciones pasen con claridad, no que sea rápido.
- Cada vez que se añada una regla nueva al motor, actualizar en el mismo cambio su representación en partículas (principio 6 de CLAUDE.md) — evita que el feedback visual quede permanentemente por detrás de la lógica.
