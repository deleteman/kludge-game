# Orden de trabajo inicial — Kludge

Punto de partida sugerido para el agente. Este documento es un plan vivo, no una regla fija — se espera que se reordene o ajuste conforme avance el desarrollo. No debe copiarse a CLAUDE.md.

**Principio general**: motor antes que interfaz, datos antes que contenido narrativo, un capítulo completo de punta a punta antes que los ocho a medias.

## Fase 0 — Andamiaje del proyecto ✅ (completada 2026-07-13)
1. ✅ Estructura de carpetas: `/engine`, `/game`, `/electron`, `/docs`.
2. ✅ `package.json` (root con npm workspaces), TypeScript (`tsconfig.base.json`, strict), ESLint + Prettier, Vitest en `/engine`.
3. ✅ Documentos de diseño ya presentes en `/docs`.

## Fase 1 — Modelo de datos del motor (`/engine`, sin renderizado) ✅ (completada 2026-07-13)
1. ✅ Tipos TypeScript para las tres capas de propiedades (funcional, material, química) — GDD 5.1-5.3.
2. ✅ Tipos para el modelo atómico/compuesto/ensamblaje de componentes físicos (GDD 7.1) y elemento/compuesto de sustancias (GDD 5.4.1-5.4.2), vía una abstracción de composición genérica compartida entre ambos dominios (`composition/`).
3. ✅ Estructura de grafo de nodos/señales (emisor, receptor, conductor) sin lógica de reacción todavía — solo el modelo de datos y su serialización. Ampliado por decisión del operador: los nodos incluyen posición de grid desde ya, y se diseñó el schema completo de blueprint JSON (no solo el grafo), marcado explícitamente como provisional — pendiente de revisión contra Fases 5/6/7 (ver nota en `engine/src/blueprint/blueprint.types.ts`).

## Fase 2 — Motor de reglas ✅ (completada 2026-07-13)
*Modelo recomendado: **Opus 4.8**. Es el núcleo del motor — errores de diseño aquí se propagan a las 16 validaciones (Fase 3) y a todo lo que sigue. La resolución química en 3 pasos y la difusión atmosférica híbrida tienen suficiente ambigüedad como para justificar más razonamiento.*
1. ✅ Combinación de señales (AND/OR/NOT), memoria/latch, temporización (GDD 5.6). Comportamiento explícito data-driven por nodo (gate/latch/oscilador/delay/passthrough), cada uno como Strategy; evaluador de circuito síncrono por tick (`signals/`).
2. ✅ Motor de reacciones químicas con el modelo de resolución de 3 pasos (GDD 5.3) y los parámetros/prioridades de la Especificación de datos técnicos §1-§2 (`chemistry/reaction/`): reglas Strategy (neutralización, combustión modulada por O2, corrosivo+sustancia, ignición espontánea), índice de recetas nombradas, factory de "Mezcla sin identificar", resolver con prioridad y consume→re-evalúa.
3. ✅ Sistema de atmósfera por sección con difusión híbrida (GDD 5.5, Espec. §4) y dependencia de combustión respecto a O2 (`atmosphere/`). Modelo de `Section` marcado PROVISIONAL (revisar contra plano real de Fase 5). Incapacitación tóxica y daño corrosivo a tripulante por acumulación temporal (Espec. §1).
4. ✅ Sobrecarga y fallo de conductores/reservorios + degradación estructural corrosiva (`failure/`), como eventos de dominio.

**Decisiones tomadas con el operador** (ver plan y changelog): tiempo por tick discreto `tick(dtSeconds)`; lógica de señales por comportamiento explícito (no derivación topológica); sección provisional + eventos de cruce de umbral sin modelar tripulantes (Fase 9 los consume). Principio 6: cada regla define su evento de dominio (seam Observer) como contrato para las partículas de Fase 8; no se escribe código de partículas todavía. Los 16 casos de validación end-to-end quedan para Fase 3 — Fase 2 entrega los mecanismos + 49 tests unitarios/de integración por bloque.

## Fase 3 — Suite de validación (antes de seguir)
*Modelo recomendado: **Sonnet 5**. Trabajo bien especificado (el GDD ya define input/output esperado) pero requiere fidelidad exacta al documento — no es lo bastante mecánico como para delegar a un modelo más liviano.*
1. Escribir un test por cada uno de los 16 casos de validación del GDD (sección 9).
2. No avanzar a Fase 4 hasta que los 16 pasen contra el motor de Fase 2. Esta suite es la garantía de que el sistema de propiedades funciona como se diseñó antes de gastar tiempo en interfaz.

## Fase 4 — Datos de contenido
*Modelo recomendado: **Haiku 4.5** para la transcripción (alto volumen, baja ambigüedad de diseño — es copiar del documento de datos técnicos a estructuras tipadas), con una pasada de revisión en **Sonnet 5** antes de cerrar la fase.*
1. Catálogo atómico universal (GDD 7.2) con tamaños de footprint.
2. Catálogo de elementos y compuestos químicos (GDD 5.4.1-5.4.2) y mapeo de sustancias pre-mezcladas (Especificación de datos técnicos, sección 3).
3. Catálogos de componentes compuestos por arquetipo (GDD 7.3-7.6) con sus recetas.
4. Parámetros de difusión atmosférica (Especificación de datos técnicos, sección 4).

## Fase 5 — Plano físico y renderizado mínimo
*Modelo recomendado: **Sonnet 5**. Integración estándar entre sistemas ya diseñados (Tiled→JSON→Phaser), sin decisiones de arquitectura nuevas.*
1. Diseñar las 4 naves canónicas en Tiled (GDD 15.1) — geometría, adyacencia de secciones, puntos de anclaje.
2. Exportar a JSON, parsear en `/engine`.
3. Render estático del plano en Phaser (`/game`) — sin interactividad todavía, solo confirmar que el plano se ve correctamente. Primer punto de contacto con el motor de Fase 2.

## Fase 6 — Core loop
*Modelo recomendado: **Opus 4.8** para el diseño de la máquina de estados y la resolución de dependencias entre tareas de distintos tripulantes (la parte con más aristas: deadlocks, tareas bloqueadas, pausa/reanudación en cualquier momento); **Sonnet 5** para el resto de la implementación.*
1. Modo planificación (pausa) vs. ejecución (tiempo real) — GDD sección 4.
2. Cola de tareas por tripulante, con soporte de dependencias entre tareas de distintos tripulantes.
3. Ejecución en tiempo real con re-pausa en cualquier momento.

## Fase 7 — Mesa de creación
*Modelo recomendado: **Sonnet 5**. Reutiliza lógica ya validada en Fase 5; es extensión, no diseño nuevo.*
1. Grid de composición espacial compartiendo lógica con el plano principal (GDD 10.1).
2. Cálculo de footprint, nombrado de creaciones, validación de espacio al instalar en el plano.
3. Conexión externa de puertos tras la instalación.

## Fase 8 — Feedback visual
*Modelo recomendado: **Sonnet 5** para definir el primer fenómeno de referencia (ajuste de "game feel"); **Haiku 4.5** para replicar el patrón a los fenómenos siguientes una vez establecido.*
1. Sistema de partículas por fenómeno (GDD 11.1) — empezar por los fenómenos usados en los primeros capítulos de campaña (fuego, chispas, fuga de gas).
2. Flujo animado en conductos activos.
3. Movimiento por salto con gravedad para tripulantes/enemigos (GDD 11.2).

## Fase 9 — Tripulación
*Modelo recomendado: **Sonnet 5**. Mezcla de lógica (afinidad, tiers) y contenido (banco de frases) — necesita coherencia de diseño, no solo volumen.*
1. Selección pre-misión, tiers, afinidad de especialidad (GDD 6.1-6.6).
2. Personalidad y banco de frases (GDD 6.7) — empezar con 1-2 rasgos, no los 5 a la vez.
3. Muertes gráficas reutilizando el sistema de partículas de Fase 8.

## Fase 10 — Primer capítulo de campaña, de punta a punta
*Modelo recomendado: **Opus 4.8**. Aquí aparecen las fricciones de integración que no se ven en aislamiento — la fase más cara si sale mal, porque el pipeline se reutiliza en los 7 capítulos siguientes (Fase 11). Vale la pena la inversión.*
1. Implementar "Primer Aviso" (Primeras_8_crisis.md, capítulo 1) completo: disparador, temporizador, solución, consecuencia.
2. Este es el primer punto donde el juego debe ser jugable de principio a fin, aunque sea con un único arquetipo de nave. Sirve para detectar fricciones de integración entre motor, UI y contenido antes de escalar a los otros 7 capítulos.

## Fase 11 — Resto de la campaña y contenido restante
*Modelo recomendado: **Haiku 4.5** para autoría de contenido repetitivo (capítulos 2-8 sobre el pipeline ya validado, localización, empaquetado Electron); **Sonnet 5** para el modo creativo (export/import de blueprints) y el modo dev.*
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
