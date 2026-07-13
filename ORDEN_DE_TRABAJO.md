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

## Fase 3 — Suite de validación ✅ (completada 2026-07-13, ampliada 2026-07-13)
1. ✅ Un test por cada uno de los 17 casos de validación (los 16 del GDD sección 9 + 1 caso de
   extensión, ver punto 3), en `engine/src/validation/case-XX-slug.test.ts` — 14 casos activos
   pasando contra el motor (13 originales + caso 17, más 4 reglas nuevas mínimas y aisladas que
   ese motor no cubría, ver puntos 2 y 3), y 3 casos con al menos una parte diferida documentada
   con `it.todo(...)` (14 y 16 totalmente, 15 y 17 parcialmente — no cuentan como fallo del run).
2. ✅ Tres reglas nuevas del cierre original de Fase 3, cada una implementada con su propio test
   unitario en el dominio correspondiente (no en `validation/`), antes de escribir su caso de
   validación: sobrecarga de conductor por enfriamiento extremo (`failure/thermal-conductivity-rule.ts`,
   caso 2 — reutiliza `OverloadRule`, no duplica el mecanismo de fallo); comportamiento de señal
   `counter` con memoria incremental (`signals/rules/counter-rule.ts` + extensión de
   `signal-evaluator.ts`, caso 5 — misma familia Strategy que latch/oscillator, gap detectado
   durante el análisis de Fase 3 y señalado al operador antes de implementar); radio de explosión
   y daño a tripulante en `CombustionRule`/`CombustionEvent` según el bucket de O2
   (`chemistry/reaction/reaction-parameters.ts` + `reaction-events.types.ts`, caso 11 — extensión
   mecánica de `COMBUSTION_INTENSITY_BY_OXYGEN`, sin ambigüedad contra la Especificación §1).
3. ✅ Ampliación posterior: el operador escribió `docs/Extension_aceleracion_magnetica.md`
   (documento independiente, deliberadamente NO fusionado al GDD todavía) proponiendo aceleración
   magnética con inercia acumulada + daño por impacto cinético (extiende GDD 5.2/5.6) y un caso de
   validación nuevo, numerado 17 ("El Cañón de Riel Improvisado"). Implementado como dominio nuevo
   `engine/src/kinetics/` (aislado, mismo patrón Strategy/data-driven que `atmosphere/`/`failure/`):
   intensidad de campo por bobinas+corriente y decaimiento por distancia (`magnetic-field.ts`),
   acumulador de velocidad con inercia — clase con estado y `.tick()`, mismo patrón que
   `HazardAccumulator`/`StructuralIntegrity` (`magnetic-acceleration.ts`), resolución de daño por
   impacto = velocidad × footprint (`kinetic-impact.ts`). `DomainEvent` (agregado en `index.ts`)
   extendido con `KineticDomainEvent`.

**Decisiones tomadas con el operador (cierre original)**: 3 casos quedan diferidos por depender de
fases que aún no existen — caso 14 (dependencias entre colas de tripulantes, Fase 6, sobre el
placeholder `CrewTaskDependencyPlaceholder` marcado explícitamente "no construir lógica de motor
sobre este tipo todavía"), caso 16 (especialidad de Piloto, Fase 9, tripulación no existe en
absoluto), y solo la parte de coste-por-tier del caso 15 (GDD 6.5, Fase 9) — la ruta atómica
completa de ese mismo caso (7.1) sí se valida ahora, en contraste con el caso 1. Los tres
umbrales/constantes de la regla del caso 2 no tienen tabla numérica en la Especificación de datos
técnicos; quedan como valores de referencia data-driven (`THERMAL_CONDUCTIVITY_PARAMETERS`), mismo
criterio que `REACTION_PARAMETERS`, ajustables en playtesting sin tocar la lógica.

**Decisiones tomadas con el operador (ampliación caso 17)**: (1) conflicto MAG — el documento de
extensión proponía que `MAG` (GDD 7.0, "ferromagnético Sí/No", propiedad ESTÁTICA de material)
dejara de ser booleano y pasara a ser una escala de intensidad; se detectó que la "intensidad de
campo" del documento es en realidad una cantidad DINÁMICA del electroimán ensamblado y activo, no
la misma propiedad — `properties/material.types.ts::MAG` se mantiene booleano sin cambios (no
rompe GDD 7.0 ni los tests que ya usan `MAG: true`, casos 9 y 15); la intensidad de campo vive
como concepto nuevo y separado (`MagneticFieldIntensity`, `kinetics/magnetic-field.ts`), misma
naturaleza que `CombustionIntensity` (resultado de regla, no propiedad de material). (2) nivel de
corriente — el motor no modelaba "corriente baja/alta" en ningún lado; nuevo tipo `CurrentLevel`
(`"B"|"M"|"A"`, `kinetics/current-level.types.ts`), misma familia cualitativa que `CE`/`CT`/`RE`
(GDD 7.0), declarado explícitamente por la bobina activa, no derivado de números existentes. (3)
encaje de fases — se implementó ahora, reabriendo el cierre de Fase 3, en vez de diferirse como
backlog, por ser motor de reglas (GDD 5.2/5.6) del mismo tipo que Fase 2/3; el daño cinético a
TRIPULANTE (no a estructura/componente, que sí se valida activamente) queda `it.todo` igual que
los casos 14/16, por depender de Fase 9. Convención de tipos mixta deliberada: letras (A/M/B/N)
para `CurrentLevel`/`MagneticFieldIntensity`/`VelocityLevel` (escalas de material/operacionales,
confirmado con el operador); palabras en inglés (`"low"|"medium"|"high"`) para
`KineticDamageSeverity` (severidad de evento, mismo criterio que `CrewDamageSeverity`). Posición
del proyectil simplificada respecto al plan original: NO se modela como estado interno del
acumulador (ni distancia escalar de riel ni `GridPosition` 2D) — el decaimiento por distancia
(`intensityAtDistance`) es una función pura que el llamador aplica ANTES de pasar la intensidad ya
decaída a `MagneticAccelerationAccumulator.tick()`; el acumulador solo conoce esa intensidad final,
no la distancia ni la posición. Responsabilidad única: `magnetic-field.ts` posee el decaimiento
espacial, `magnetic-acceleration.ts` posee la acumulación temporal. Un modelo de posición real (2D,
ligado al plano físico) queda pendiente de Fase 5, mismo criterio PROVISIONAL que
`atmosphere/section.types.ts`.

## Fase 4 — Datos de contenido ✅ (completada 2026-07-13)
*Transcripción de catálogos del GDD y Especificación de datos técnicos a estructuras TypeScript tipadas.*

1. ✅ Catálogo atómico universal (GDD 7.2): 20 componentes físicos (plancha metálica, cable de cobre, bobina de cobre, batería celda simple, motor pequeño, etc.) con footprint, propiedades funcionales/material exactas. Confirmado: incluye cable de cobre (`cable-cobre`) e imán permanente (`iman-permanente`) — reconciliados con fixtures de caso 9 (donde antes se llamaba `nucleo-hierro`, ahora es `iman-permanente` per catálogo real).
2. ✅ Catálogo de elementos base (GDD 5.4.1): 28 elementos (hidrógeno, oxígeno, carbono, sodio, potasio, hierro, cobre, etc.) + nitrógeno líquido, con tags químicos resueltos; elementos sin tag correspondiente usan INERTE + comentario descriptivo (sodio, potasio, hierro, cobre, etc. — no se extiende `ChemicalTag`).
3. ✅ Catálogo de compuestos derivados y sustancias pre-mezcladas (GDD 5.4.2 + 5.4.3 + Especificación §3): 22 sustancias (agua, sal común, ácido de laboratorio, dióxido de carbono, amoniaco, acero, latón, combustible de motor, ácido de batería, base de laboratorio, etc.) con recetas elemento→compuesto/anidadas (caso único: desinfectante = yodo + agua). Placeholders creados: fluido-biologico (GDD 7.6, Banco de sangre, pendiente contenido narrativo) y sustancia-medica-generica (Farmacia automatizada).
4. ✅ Catálogos de componentes compuestos por arquetipo (GDD 7.3-7.6): Investigación (17 compuestos), Guerra (17 compuestos + 1 ensamblaje complejo Torreta automatizada), Exploración (16 compuestos), Médica (18 compuestos) — 69 compuestos funcionales totales (nivel 1 + 1 nivel 2) compartidos entre los 4 arquetipos. Cada uno con receta atómica explícita e inyección de referencias a sustancias químicas para reservorios.
5. ✅ Parámetros de difusión atmosférica (Especificación §4): ya implementados en código (`atmosphere/diffusion.ts`), reutilizados sin cambios. Nota: regeneración pasiva de O2 (invernadero, generador de oxígeno) diferida fuera de Fase 4 — dejada como comentario en entrada catálogo, requiere comportamiento (integración tick atmosfera).

**Decisiones tomadas con el operador (cierre)**: elementos sin tag químico existente usan INERTE; sustancias sin definición GDD crean placeholders INERTE/Líquido; compuestos sin receta se instancian como atómicos, no compuestos (elementos reutilizados como puros, placeholders); tests Fase 3 (casos 7, 9, 12) refactorizados para usar ids reales del catálogo en lugar de fixtures locales — todos los 17 casos de validación pasan (129 tests unitarios/integración en verde).

**Estructura entregada**:
- `engine/src/chemistry/catalog/`: element-catalog.ts (28 elementos), compound-catalog.ts (22 compuestos), build-chemical-catalog.ts (constructor con orden de dependencia)
- `engine/src/components/catalog/`: atomic-component-catalog.ts (20 atómicos), composite/{investigacion,guerra,exploracion,medica}.ts (69 compuestos), build-component-catalog.ts (constructor con 2 pasadas: atómicos→compuestos-de-átomos→ensamblajes-complejos)
- `engine/src/index.ts`: nueva sección "Fase 4 — Catálogo de contenido" exportando arrays y builders
- Casos validación 7/9/12 refactorizados; tests nuevos en catalog/atomic-component-catalog.test.ts, catalog/composite/composite-catalog.test.ts, catalog/element-catalog.test.ts, catalog/compound-catalog.test.ts (TBD: escribir tests específicos del catálogo)

## Fase 5 — Plano físico y renderizado mínimo ✅ (completada 2026-07-13)
1. ✅ Las 4 naves canónicas diseñadas y autoradas como JSON formato Tiled (`engine/src/floorplan/maps/`,
   abribles/editables en Tiled): 40×22 celdas, 11 secciones por nave — espina común (puente,
   pasillo-central, soporte-vital, camarotes, esclusa, ingeniería) + 5-6 secciones por arquetipo
   (GDD 7.3-7.6). Riesgos autorados de fábrica: polvorín de Guerra ventila solo vía armería; sala
   de aislamiento de la Médica sellada (`initialAperture: 0`). En Exploración, `sala-hibernacion`
   sustituye a `camarotes`. Solo object layers (`secciones`/`conductos`/`anclajes`) — sin tilesets;
   los tile layers visuales llegarán con el pack de arte sin tocar el parser.
2. ✅ Parser en `/engine`: nuevo dominio `floorplan/` (tipos Tiled mínimos, `ShipFloorplan`,
   parser con guards a mano espejo de blueprint, integridad semántica — solape/adyacencia por
   arista/anclajes/aperturas —, `CANONICAL_SHIP_FLOORPLANS` parseado en carga de módulo).
   `atmosphere-projection.ts` resuelve la nota PROVISIONAL de `section.types.ts`: `Section` es
   proyección del plano con volumen = área en celdas. 41 tests nuevos, incluido smoke de
   integración con `diffuse()` de Fase 2 sobre secciones derivadas de un mapa real.
3. ✅ Render estático en Phaser: `/game` gana su primer código real — Vite (`npm run dev -w game`,
   alias a `engine/src` para hot reload), escena visor con teclas 1-4, renderer de `Graphics`
   (secciones, paredes, conductos coloreados por tipo, válvula sellada visualmente distinta
   — principio 6 —, anclajes, leyenda), paleta placeholder data-driven, seed i18n ES/EN.
   Verificado con capturas headless de las 4 naves. **Sprites faltantes** (aviso CLAUDE.md): no
   existe ningún asset; se esperan en `game/assets/sprites/tiles/` y `ui/` al elegir pack (GDD §17).
4. ✅ Revisión kinetics cerrada sin código nuevo: el helper de distancia 2D se difiere hasta que
   exista el primer llamador con proyectil posicionado (Fase 8/10) para no fijar la métrica sin
   caso de uso — comentario actualizado en `magnetic-field.ts`.

**Decisiones tomadas con el operador**: mapas generados por Claude (editables en Tiled después);
unidad de grid = 32×32 px (cierra el pendiente de GDD §17 — `GRID_CELL_SIZE_PX` en `geometry/`);
extensión `.json` (mismo formato que `.tmj`, import directo con `resolveJsonModule`); volumen de
sección = área en celdas; pipeline Vite (Electron queda para Fase 11); layouts con los dos riesgos
autorados aprobados. Colateral: se arreglaron errores de tsc/lint preexistentes de Fase 4 que
bloqueaban `npm run build`/`npm run lint` (exports duplicados, tipos de builders, casts en tests
7/9/12) — 170 tests + 4 `it.todo` en verde, build y lint de los 3 workspaces en verde.

## Fase 6 — Core loop ✅ (completada 2026-07-13)
*Modelo recomendado: **Opus 4.8** para el diseño de la máquina de estados y la resolución de dependencias entre tareas de distintos tripulantes (la parte con más aristas: deadlocks, tareas bloqueadas, pausa/reanudación en cualquier momento); **Sonnet 5** para el resto de la implementación.*
1. ✅ Modo planificación (pausa) vs. ejecución (tiempo real) — GDD sección 4. `CoreLoopModeMachine`
   (`tasks/core-loop-mode.ts`): máquina de modo explícita + driver genérico de simulación con un
   registro de `Tickable`. En planificación el `tick()` es no-op (reloj congelado, GDD §4.2); en
   ejecución acumula `elapsedSeconds` y propaga `TickContext` a los tickables. Re-pausable en
   cualquier momento (GDD §4.5). Emite `core-loop-mode-changed`.
2. ✅ Cola de tareas por tripulante con dependencias entre tripulantes. `TaskScheduler`
   (`tasks/task-scheduler.ts`, implementa `Tickable`, mismo patrón que `HazardAccumulator`):
   colas por actor + índice de tareas; máquina de estados de tarea explícita
   (`pending/in-progress/blocked/completed/cancelled/failed`, `tasks/task.types.ts`); `enqueue`
   valida el grafo (rechaza ciclos/deps inexistentes, `tasks/task-dependency-graph.ts`);
   `linkDependency` para la acción "vincular" del GDD §4.3 (revalida ciclos antes de aceptar); el
   dependiente queda `blocked`/`waiting` hasta que su dependencia completa (espera en su sitio);
   duraciones base data-driven (`tasks/task-parameters.ts`, pendientes de modulación por tier en
   Fase 9); hook de efecto `TaskEffect` para el efecto físico real (diferido a Fases 7/9/10).
3. ✅ Ejecución en tiempo real con re-pausa. `cancel()` interrumpe a mitad de tarea; si otras
   dependían de la cancelada, las marca `blocked` y encola una `PlayerNotification` que se expone al
   repausar (`drainNotifications`, GDD §4). Tripulante = actor mínimo (`crew/crew-actor.types.ts`):
   id + sección + estado; tiers/afinidad/HP/permadeath quedan para Fase 9.

**Decisiones tomadas con el operador (cierre)**: (1) modelo de tripulante = actor mínimo, sin
tiers/afinidad/HP (Fase 9); (2) tareas abstractas + hook de efecto — Fase 6 entrega el mecanismo del
loop, no el efecto físico de desmontar/sintetizar (Fases 7/9/10); (3) driver genérico — el cableado
concreto de los subsistemas del motor (señales/química/atmósfera/fallo/cinética) al driver se hace en
Fase 10 (integración end-to-end), aquí solo se registra el scheduler; (4) el placeholder
`CrewTaskDependencyPlaceholder` se **eliminó** del schema de blueprint (`crewTaskDependencies` fuera
de `Blueprint`, `schemaVersion` 1→2): las colas/dependencias son estado de sesión runtime, no estado
estático de la nave — serializar una partida en curso es save-system de Fase 11. Ajuste sobre el
plan: el escenario circular del GDD §4.3 ("A espera a B, B espera a A") no puede surgir al `enqueue`
(las deps deben preexistir → grafo DAG por construcción); se realiza vía `linkDependency`, la acción
de "vincular" posterior, que es donde el ciclo es alcanzable. Caso de validación 14 pasa de `it.todo`
a activo (quedan 3 diferidos: 15 parcial, 16, 17-tripulante, todos Fase 9). 193 tests + 3 `it.todo`;
build y lint de los 3 workspaces en verde.

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
4. Nota (extensión caso 17, `docs/Extension_aceleracion_magnetica.md` §4): 2 fenómenos nuevos a cubrir — estela de aceleración magnética (intensidad proporcional a `VelocityLevel`, sin estela si es baja) y burst de impacto cinético direccional (en la trayectoria, no radial como una explosión), enganchados a `magnetic-acceleration` y `kinetic-impact` (`kinetics/kinetic-events.types.ts`).

## Fase 9 — Tripulación
*Modelo recomendado: **Sonnet 5**. Mezcla de lógica (afinidad, tiers) y contenido (banco de frases) — necesita coherencia de diseño, no solo volumen.*
1. Selección pre-misión, tiers, afinidad de especialidad (GDD 6.1-6.6).
2. Personalidad y banco de frases (GDD 6.7) — empezar con 1-2 rasgos, no los 5 a la vez.
3. Muertes gráficas reutilizando el sistema de partículas de Fase 8.
4. Al aterrizar el modelo de tripulante/HP, resolver los `it.todo` pendientes: caso 16 (afinidad de Piloto), 15 (coste por tier al desmontar) y 17 (daño cinético a tripulante/enemigo, `engine/src/validation/case-17-canon-de-riel-improvisado.test.ts`). El caso 14 (dependencias entre colas) ya quedó activo en Fase 6. Además, aplicar los multiplicadores de duración/riesgo por tier y afinidad (GDD 6.6) sobre las duraciones base data-driven de `tasks/task-parameters.ts` (vía el override de `estimatedDurationSeconds` en `createCrewTask`, ya previsto).

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
