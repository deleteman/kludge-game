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

## Fase 7 — Mesa de creación ✅ (completada 2026-07-13)
*Modelo recomendado: **Sonnet 5**. Reutiliza lógica ya validada en Fase 5; es extensión, no diseño nuevo.*
1. ✅ Grid de composición espacial compartiendo lógica con el plano principal (GDD 10.1). Dominio
   nuevo `engine/src/workbench/` (`workbench-state.types.ts`, `workbench-signal-adapter.ts`):
   `WorkbenchState` reutiliza `PlacedFootprint`/`GridPosition` de `geometry/` y
   `SignalGraph<WorkbenchPieceId>` de `signals/` sin tipos nuevos — mismo lenguaje de "seleccionar
   nodo A → arrastrar a nodo B" que el plano principal. Solape de piezas dentro de la mesa con el
   mismo criterio de `floorplan-integrity.ts` (`overlapping-section-cells`).
2. ✅ Cálculo de footprint, nombrado de creaciones, validación de espacio al instalar en el plano.
   `footprint-calculator.ts` calcula el rectángulo mínimo real (bounding box, no valor fijo de
   receta) considerando rotación por pieza; `creation-recipe-builder.ts` arma la `Recipe` agregando
   piezas repetidas por `quantity`; `creation-naming.ts` reutiliza la `CompositionFactory` genérica
   ya usada por el catálogo de Fase 4 para registrar la creación como
   `PhysicalComponentDefinition` compuesto nuevo. `CompositeComponentData` gana un campo opcional
   `footprint?` (retrocompatible) para guardar ese resultado. `installation-validation.ts` valida
   contra la FORMA real de la sección (no solo su bounding box — secciones en L) y contra otros
   componentes ya instalados; `installation.ts` orquesta rotación (solo del rectángulo exterior,
   decisión confirmada) → validación → `Blueprint` inmutable con la instancia agregada.
3. ✅ Conexión externa de puertos tras la instalación. `port-wiring.ts` traduce los nodos locales de
   la mesa a nodos globales del plano (misma instancia = misma "caja negra"), los incorpora al
   `signalGraph` del blueprint, y expone/cablea puertos externos como una operación aparte y
   explícita — instalar nunca conecta automáticamente (GDD 10.1, verificado con un chequeo negativo
   en el test de integración). Es la primera implementación de "editar el `signalGraph` de un
   `Blueprint` ya instanciado" (Fase 5 solo hizo render estático), reutilizable por cualquier editor
   de plano futuro.

**Decisiones tomadas con el operador (cierre)**: sin bump de `schemaVersion` de blueprint —
`PlacedFootprint` alcanza tal cual; el footprint de un compuesto nacido en la mesa vive en el nuevo
campo opcional `CompositeComponentData.footprint`, no en una estructura paralela; el hook
`TaskEffect` de Fase 6 se difiere a Fase 10 (Fase 7 entrega el dominio de la mesa, independiente de
`tasks/`); la rotación al instalar afecta solo el rectángulo exterior, no las posiciones internas de
piezas/nodos (se difiere a Fase 8 si hiciera falta visualizarlo); piezas repetidas se agregan en un
solo `RecipeIngredient` con `quantity` sumada (mismo criterio que el catálogo de Fase 4); la mesa es
una estructura de datos nueva (`WorkbenchState`), no un `Blueprint` en miniatura; las piezas siempre
entran intactas a la mesa (desarmar es la tarea `dismantle`, previa y separada). 10 archivos nuevos +
10 archivos de test (incluido `workbench.integration.test.ts`, caso end-to-end colocar → nombrar →
instalar → cablear puerto externo) + 2 cambios de comentario housekeeping
(`geometry/grid-position.types.ts`, `blueprint/blueprint.types.ts`) + exports nuevos en `index.ts`.
44 tests nuevos (237 tests + 3 `it.todo` totales); build y lint de los 3 workspaces en verde.

## Fase 8 — Feedback visual 🟡 (parcial, 2026-07-14 — tile layers con arte real solo en Exploración)
*Modelo recomendado: **Sonnet 5** para definir el primer fenómeno de referencia (ajuste de "game feel"); **Haiku 4.5** para replicar el patrón a los fenómenos siguientes una vez establecido.*
1. ✅ Integración del pack de arte y render de tile layers — pipeline de carga implementado
   (2026-07-14) tras que el operador colocara `game/assets/sprites/tiles/tileset-nave.png` y
   pintara tile layers en `nave-exploracion.json`. `game/src/render/tile-layer-registry.ts`
   (alias `engine-maps` nuevo en `vite.config.ts`/`tsconfig.json`, apunta a
   `engine/src/floorplan/maps/` — mismos 4 JSON que consume el parser lógico, dos lectores
   distintos) + `game/src/render/tile-layers.ts` (`createTileLayers`, usa
   `scene.load.tilemapTiledJSON`/`map.addTilesetImage`/`map.createLayer`, el parser de tilemaps de
   Phaser, independiente del de `/engine`). `floorplan-renderer.ts` compone las tile layers reales
   cuando existen y solo cae al fallback de `Graphics` de Fase 5 si el mapa del arquetipo todavía
   no trae tileset — **hoy solo `nave-exploracion.json` lo trae**; las otras 3 naves siguen en
   fallback hasta que el operador pinte sus tile layers (mismo patrón, sin código nuevo). El parser
   de `/engine` no cambió: sigue leyendo solo object layers. Verificado con `npm run dev -w game` +
   build/lint en verde; verificación visual de píxeles la hace el operador (sin browser tool
   disponible para capturas automatizadas). Nota: si el PNG del tileset depende de
   `"transparentcolor"` de Tiled para las zonas transparentes, revisar visualmente — Phaser no lee
   ese campo automáticamente, solo respeta canal alfa real del PNG.
   Decisiones de pipeline ya tomadas con el operador (sin cambios):
   - **Elegir el pack de pixel art es decisión del operador** (verificación de licencia incluida,
     GDD §17) — el agente no lo elige solo.
   - **Un tileset atlas, no un PNG por elemento**: los tiles de suelo/pared viven en UN solo PNG
     (`game/assets/sprites/tiles/tileset-nave.png`) del que Tiled recorta cada tile por índice.
     Variantes de color por sección/recurso vía tiles en escala de grises + `tint` en runtime
     (GDD 11.0), no PNGs adicionales.
   - **Los gráficos del mapa se autoran en Tiled y se cargan desde el propio JSON**: tile layers
     pintadas en los 4 mapas de `engine/src/floorplan/maps/`, con el tileset **embebido en el
     mapa** ("Embed in map" en Tiled, no `.tsx` externo) para que `/game` cargue mapa + tiles con
     el loader de tilemaps de Phaser desde ese único JSON + el PNG del atlas. El parser de
     `/engine` NO cambia: sigue leyendo solo las object layers (lógica); las tile layers son
     presentación pura que `/game` consume del mismo archivo. El tamaño de tile del atlas debe ser
     32px (`GRID_CELL_SIZE_PX`, ya validado por el parser).
   - **Iconos de UI** (conducto, válvula sellada, anclaje): aquí sí archivos propios en
     `game/assets/sprites/ui/` — o un spritesheet único si el pack los trae así; ambos valen.
     Los componentes físicos mantienen la convención `components/<id>.png` de CLAUDE.md (un
     archivo por id de catálogo).
2. ✅ Sistema de partículas por fenómeno (GDD 11.1), dominio nuevo `game/src/particles/`. Fenómeno
   de referencia: `effects/combustion-effect.ts` (fija el patrón: `particle-effect.types.ts`
   distingue `EventDrivenEffect`/`StateDrivenEffect`; `particle-utils.ts` da los helpers
   compartidos de posicionamiento/limpieza). Replicado a 8 fenómenos event-driven más
   (`overload-effect.ts` con sus 3 `failureMode` distintos, `spontaneous-ignition-effect.ts`,
   `neutralization-effect.ts`, `structural-degraded-effect.ts` con corrosión activa vs. fallo
   completo, `hazard-effect.ts` con nube tóxica vs. vapor ácido, `kinetics-effect.ts`) y 3
   state-driven con gancho real de motor (`conduit-flow-effect.ts`,
   `atmosphere-state-effects.ts`: fuga de gas/congelación/vapor por calor). Registro único en
   `effect-registry.ts` (Factory `DomainEvent["kind"]→efecto`). **"Derrame de líquido" (fila de GDD
   11.1) queda sin implementar y señalado explícitamente**: `/engine` no modela ningún estado de
   líquido-en-piso; extenderlo está fuera del alcance de `/game`.
3. ✅ Flujo animado en conductos activos (`conduit-flow-effect.ts`) — intensidad/dirección las
   calcula quien conoce el estado real del conducto (Fase 10); este efecto solo pinta el estado que
   le pasan, no lo deriva.
4. ✅ Movimiento por salto con gravedad para tripulantes/enemigos (GDD 11.2):
   `game/src/crew/hop-movement.ts`. Trayectoria parabólica real (`4·h·p·(1−p)` sobre el tiempo, no
   senoidal), 3 cadencias (normal/urgente/herido) + "firma de salto" reutilizable para enemigos
   (blindado pesado/lento, ágil rápido/errático), squash&stretch. Valores numéricos de referencia,
   no finales (GDD §17, pendiente de sprites reales).
5. ✅ Extensión caso 17 (`docs/Extension_aceleracion_magnetica.md` §4): estela de aceleración
   magnética y burst de impacto cinético direccional, en `kinetics-effect.ts`.
6. ✅ Verificación visual sin el driver real de Fase 10 (decisión del operador): escena solo-dev
   `game/src/scenes/particle-gallery-scene.ts` (tecla G desde `FloorplanScene`, ESC para volver)
   dispara manualmente cada `DomainEvent` + los 4 fenómenos state-driven + el demo de salto sobre un
   plano ya renderizado. Sin test runner nuevo en `/game` (no existía ninguno; la "verificación
   headless" de Fase 5 resultó ser manual/no reproducible al auditarla) — se verifica con
   `npm run dev -w game` + la galería, decisión explícita del operador para no sumar una
   dependencia nueva sin pedirla.
7. ✅ Reapertura puntual (2026-07-14): el operador colocó un pack real de texturas de partículas en
   `game/assets/sprites/particles/*.png` (dirt/scorch/spark/flame/fire/smoke/circle/trace/flare,
   imágenes de un solo color con alpha para tintar en runtime) y pidió (a) manchas de sangre
   persistentes sobre el suelo — charco + gotas que se desvanecen, no solo el burst en el aire ya
   existente — y (b) integrar el pack completo en el resto de efectos, reemplazando `__WHITE`.
   Nuevo `game/src/render/render-depths.ts` (`RENDER_DEPTH`, tabla por nombre de tile layer de
   Tiled — `background`/`objects`/`walls`, confirmado contra `engine/src/floorplan/maps/*.json` —
   más `bloodDecal`/`crewEntity` reservado): reemplaza el orden de inserción implícito que tenía
   `floorplan-renderer.ts`/`tile-layers.ts`, con aviso si una tile layer nueva no tiene depth
   asignado. Nuevo `game/src/particles/particle-texture-registry.ts` (mismo patrón que
   `tile-layer-registry.ts`, precargado en `FloorplanScene.preload()`). `particle-utils.ts` gana
   `spawnDecal` (mancha estática con ciclo aparición→sostenido→desvanecimiento, para
   sangre/quemaduras — el `spawnBurst` existente es efímero, sub-segundo, no servía para esto),
   `textureScale` (conversión de tamaño en px a `scale`, la fuente real es ~512px vs. los 4px de
   `__WHITE`) y `pickTexture` (Phaser no soporta múltiples texturas standalone por emisor, solo
   múltiples `frame` de una misma textura — la variedad se resuelve eligiendo una variante al azar
   por burst/instancia, no por partícula individual). Los 10 efectos existentes (`combustion`,
   `overload` —+ nuevo decal de quemadura persistente para `fire`/`explosion`—, `hazard`,
   `neutralization`, `spontaneous-ignition`, `kinetics`, `structural-degraded`,
   `atmosphere-state-effects`, `conduit-flow`, `crew-death`) migrados a las texturas reales sin
   tocar su lógica (tintes/intensidades/duraciones intactos, solo cambia la forma). `crew-death-
   effect.ts` gana `bloodDecals` (charco grande con `dirt-03` + 5 gotas con `dirt-01`/`dirt-02`,
   solo para las causas que ya generaban sangre: fuego/explosión/impacto cinético) y `goreSplatter`/
   `crewDamageFlash`/`frozenShatter`/`fullBodyDissolve`/`rigidCollapse` migrados a texturas reales.
   Sin cambios en `/engine` ni en `effect-registry.ts` (el enganche por `kind` ya existía). 253
   tests en verde (sin regresión), build y lint de los 3 workspaces en verde.

## Fase 9 — Tripulación ✅ (completada 2026-07-14)
1. ✅ Modelo completo de tripulante en `engine/src/crew/`: `CrewSpecialty`
   (ingeniero/médico/piloto/seguridad), `CrewTier` (novato/veterano/experto),
   `PersonalityTrait` (5 rasgos), extendiendo `CrewActor` (Fase 6) con
   `name`/`specialty`/`tier`/`trait`/`hp`/`maxHp` sin romper
   `CrewActorId`/`CrewActorStatus`, de los que ya depende `TaskScheduler`.
   `crew-affinity.ts` resuelve GDD 6.6 (multiplicador de duración por tier
   dentro de la propia afinidad vs. penalización general fija +20% fuera de
   ella, Strategy data-driven mismo criterio que `REACTION_PARAMETERS`);
   `atomic-recovery.ts` resuelve GDD 6.5 (recuperación atómica al desmontar
   por tier, bonus +10% del Ingeniero, penalización por `RE` baja del
   compuesto original); `crew-roster.ts` modela la selección pre-misión (GDD
   6.2) — **solo datos** (roster + capacidad por arquetipo), sin UI: la UI se
   construye en Fase 10 con el primer capítulo jugable.
2. ✅ Personalidad y banco de frases (GDD 6.7.1): los **5 rasgos completos**
   (no 1-2 como sugería el plan original — el contenido ES ya estaba escrito
   en el GDD, sin costo de autoría pendiente, decisión tomada con el
   operador) transcritos a `game/src/i18n/es.ts`/`en.ts` como namespace
   `crew.bark.<trait>.<eventType>.<n>`; `engine/src/crew/bark-bank.ts` solo
   decide la clave/rotación (`barkKey`, `pickBarkIndex`) — el contenido vive
   en i18n, no en el motor. **Sin disparador real todavía** (decisión con el
   operador): ningún evento de `TaskScheduler`/`CoreLoopModeMachine` dispara
   un bark hoy — se cablea en Fase 10 junto con la primera crisis jugable.
3. ✅ Muertes gráficas reutilizando la infraestructura de partículas de Fase 8
   (`game/src/particles/effects/crew-death-effect.ts`, registrado en
   `effect-registry.ts` como `"crew-death"`/`"crew-damaged"`), con **variante
   visual propia por causa sobre el cuerpo** (ajuste pedido explícitamente
   por el operador sobre el GDD 6.8 literal): fuego/explosión/impacto cinético
   letal → salpicado de sangre (`goreSplatter`); frío extremo → cristalización
   + fragmentación en astillas (`frozenShatter`); corrosión → disolución
   progresiva del sprite completo (`fullBodyDissolve`, distinta de las
   picaduras superficiales de `structuralDegradedEffect`); electrocución →
   arco eléctrico + colapso rígido (`rigidCollapse`). Reutiliza emisores y
   parámetros ya existentes (paleta/timing), no efectos nuevos desde cero.
   `crew-hp-to-cadence.ts` conecta el HP real a la cadencia `"herido"` de
   `hop-movement.ts` (Fase 8), que esperaba este gancho desde entonces.
4. ✅ `engine/src/crew/hp-resolution.ts` unifica las dos fuentes de daño a
   tripulante que ya emitían severidad cualitativa sin resolver HP:
   `CrewDamageSeverity` (combustión, GDD 5.5/caso 11 — `applyCombustionDamage`,
   clasifica `intensity === "violent"` como causa "explosion", el resto como
   "fire") y `KineticDamageSeverity` (impacto cinético, caso 17 —
   `applyKineticDamage`). Ambas deciden permadeath cuando `hp <= 0` (GDD 6.1),
   emitiendo `CrewDomainEvent` (`crew-damaged`/`crew-death`, nuevo, sumado al
   union `DomainEvent` de `index.ts`). `it.todo` resueltos: caso 15 (coste de
   tiempo + recuperación por tier del Ingeniero), caso 16 (afinidad de Piloto
   vs. penalización +20%, archivo estaba vacío) y caso 17 (daño cinético a
   tripulante con permadeath). El caso 14 ya estaba activo desde Fase 6.
   253 tests en verde (0 `it.todo` restantes); build y lint de los 3
   workspaces en verde.

**Decisiones tomadas con el operador (cierre)**: (1) selección pre-misión
solo modelo de datos en Fase 9, la UI llega en Fase 10; (2) el roster SÍ
lleva nombre propio por tripulante desde ya (nombres genéricos de relleno),
pero NO los 8 nombres de logros de GDD 6.8 (reservados para el árbol de
logros de Fase 11); (3) los 5 rasgos de personalidad completos ya, no 1-2;
(4) ningún disparador real de barks se cablea en Fase 9; (5) las muertes
gráficas reutilizan la infraestructura de partículas pero con una variante
visual propia por causa sobre el cuerpo del tripulante (gore/fragmentación/
disolución/colapso), no el mismo resultado literal que sobre un componente —
ajuste explícito del operador sobre la redacción original de GDD 6.8.

## Fase 9.5 — Menú principal y flujo de meta-juego ✅ (completada 2026-07-14)
 
No es opcional ni "pulido de después" — sin esto, la Fase 10 no es realmente jugable de principio a fin como la experimentaría un jugador.
 
1. ✅ Pantalla de título (`title-scene.ts`): Nueva Partida, Continuar (lista real de saves,
   deshabilitada si no hay ninguna), Modo Creativo, Opciones, Créditos, Salir.
2. ✅ Selección de arquetipo de nave al iniciar una campaña (`archetype-select-scene.ts`,
   reutiliza `SHIP_ARCHETYPES`/`CANONICAL_SHIP_FLOORPLANS`). Asunción de
   `Primeras_8_crisis.md` CONFIRMADA con el operador: una campaña usa un único arquetipo
   elegido al inicio (estilo FTL), ya no queda "a confirmar".
3. ✅ Selección de tripulación pre-misión (`crew-select-scene.ts`, GDD 6.2) — primera UI real
   sobre `selectActiveCrew`/`CREW_CAPACITY_BY_ARCHETYPE` (solo datos desde Fase 9); roster
   real de campaña sigue siendo Fase 11 (GDD 6.8), se usa un roster placeholder documentado
   mientras tanto (`game/src/meta/placeholder-roster.ts`).
4. ✅ Menú de pausa in-game (`pause-menu-scene.ts`, overlay `launch`+`pause` sobre la misión):
   salir al menú, opciones, guardar y salir — distinto en naming/comentarios de la futura
   pausa táctica del core loop (GDD sección 4, Fase 10).
5. ✅ Guardado/carga de progreso de campaña, con **persistencia real a disco** (decisión del
   operador, adelantada desde Fase 11): `engine/src/save/` (`CampaignSaveState` reutiliza
   `Blueprint` tal cual como estado dinámico de nave, GDD 15.4) + `/electron` reescrito desde
   el shell vacío (`BrowserWindow`/`preload`/IPC sobre `saves/campaigns/` en
   `app.getPath('userData')`).
6. ✅ Pantalla de resultado de crisis (`crisis-result-scene.ts`) — consume datos reales de la
   `CampaignSaveState` activa (`crisis-outcome.ts`); sin contenido real de crisis todavía
   (Fase 10), se prueba con un disparador manual de dev (tecla `C` desde `floorplan-scene.ts`,
   mismo patrón que la galería de partículas de Fase 8).
7. ✅ Opciones (`options-scene.ts`): idioma, resolución/pantalla completa (`scale.FIT` +
   `toggleFullscreen`), controles. Persisten entre sesiones vía `kludgeSettings`/
   `settings.json` (decisión del operador).
8. ✅ Modo creativo completo (`creative-hub-scene.ts` + `creative-workbench-scene.ts`, decisión
   del operador de construir la mesa visual completa, no solo el punto de entrada): explorador
   de partidas/creaciones guardadas, mesa de creación real (`workbench-renderer.ts`) sobre el
   dominio `engine/src/workbench/` ya existente — colocar/cablear (simplificado: click en vez
   de arrastre continuo, un nodo por defecto por pieza)/nombrar/guardar/instalar en el plano.
   Tercer formato de guardado `CustomCreation` (`engine/src/save/custom-creation*`) para
   persistir creaciones entre sesiones.

**Decisiones tomadas con el operador (cierre)**: (1) campaña-por-arquetipo confirmada; (2)
persistencia real en esta fase, no diferida — mínimo de `/electron` construido ahora, el
empaquetado multiplataforma completo sigue en Fase 11; (3) mesa de creación visual completa
ahora, no placeholder; (4) UI con rexUI (primera vez registrado) + pack Kenney ya colocado por
el operador, con fallback shape-based de rexUI donde falta asset (checkbox/scrollbar/slider,
confirmado ausentes en las 740 imágenes del pack); (5) estado inicial de nave por arquetipo:
datos mínimos hardcodeados (`INITIAL_SHIP_STATE_BY_ARCHETYPE`), no el editor dev completo; (6)
resultado de crisis construido ya con datos reales de la partida, con disparador manual de dev
hasta que exista contenido real (Fase 10); (7) opciones persistentes entre sesiones. 265 tests
en verde (12 nuevos), build/lint de los 3 workspaces en verde. Sin browser headless disponible
en este entorno para verificar la interacción real del canvas — mismo caveat ya señalado en
Fases 5/8; verificado con `tsc`, `vite build` y dev server (todos los módulos transforman sin
error).

## Fase 10 — Primer capítulo de campaña, de punta a punta

Alcance real (auditado 2026-07-14 antes de empezar, ver plan de la fase): esta fase integra casi
todo lo que quedó diferido explícitamente desde Fase 2 — driver de tick real (Fase 6 punto 3),
`TaskEffect` real (Fase 6/7), disparo real de barks (Fase 9), `crisis-result-scene` conectada a
una crisis real (Fase 9.5) — y no existía todavía ningún dominio de "Crisis" en `/engine` (GDD
§15.3). Es, con margen, más grande que cualquier fase anterior. Por decisión explícita del
operador se parte en **sub-fases formales (10a-10f)**, cada una cerrada, documentada aquí y en
`changelog.log`, y revisada con el operador antes de empezar la siguiente — no se implementan
todas en una sola pasada. Decisiones de alcance ya tomadas (no volver a preguntar): verificación
jugable end-to-end solo contra el arquetipo Exploración (única nave con tile art real, Fase 8); el
mecanismo general de cicatrices persistentes (RE reducido por sección, sección sin energía) queda
fuera de alcance de Fase 10, se construye recién cuando el capítulo que lo necesita (Fase 11,
capítulo 3+) lo requiera.

### 10a — Dominio de Crisis en el motor + contenido del capítulo 1 ✅ (completada 2026-07-14)
1. ✅ Nuevo dominio `engine/src/crisis/`: máquina de estados explícita (`crisis-state.types.ts`,
   mismo criterio que `TaskState`), `CrisisDefinition` data-driven (GDD §15.3) con `evaluateCrisis()`
   puro (`crisis-machine.ts` — no conoce `TaskScheduler` ni `Tickable`, eso es 10b), Strategy de
   reglas de trigger/resolución (`crisis-rule.ts`, mismo patrón que `ReactionRule`/`SignalRule`)
   con registro por `kind` (`rules/crisis-rule-registry.ts`).
2. ✅ Campo nuevo y genérico `PlacedComponentInstance.condition` (`"ok"|"jammed"|"destroyed"`,
   `blueprint/blueprint.types.ts`) — decisión explícita del operador de no modelarlo como estado
   oculto local a una crisis. `schemaVersion` de `Blueprint` 2→3 (migración automática a `"ok"` en
   el deserializador); `schemaVersion` de `CampaignSaveMetadata` 1→2 por `ChapterProgressState`
   tipado contra `CrisisDefinitionId` en vez de string libre.
3. ✅ Contenido del capítulo 1 (`crisis/campaign/chapter-01-primer-aviso.ts`, resuelto por
   `chapter-registry.ts`): válvula simple atascada bloqueando `bodega-carga`, sin `timer` (sin
   amenaza real, "temporizador suave" del diseño), resoluble reinstalando `valvula-simple` o
   `motor-pequeno` en la misma posición de anclaje — cubre reparar in-situ y sustituir con la
   misma regla de resolución.
4. ✅ 21 tests nuevos (`crisis-machine.test.ts`, `rules/crisis-rules.test.ts`,
   `campaign/chapter-01.test.ts`) — 286 tests en verde, build y lint de los 3 workspaces en verde.

**Nota de contrato con 10c**: el estado inicial de nave de Exploración debe colocar una instancia
de `valvula-simple` con `condition: "jammed"`, `instanceId` `capitulo-1-valvula-atascada` y
posición `{x:6,y:6}` exactamente (constantes exportadas desde `chapter-01-primer-aviso.ts`), o el
trigger/resolución de este capítulo nunca se satisfacen. Posición corregida durante 10b: el
operador ya había colocado el anclaje correspondiente en Tiled (`nave-exploracion.json`, capa
`anclajes`, objeto `valvula-simple-1`) en la celda `(6,6)`, no `(6,4)` como se autoró originalmente
— la constante se ajustó para coincidir con el WIP real. Ese anclaje todavía no tiene la propiedad
`id` que el parser exige (`floorplan-parser.ts::parseAnchors`), así que hoy rompe el parseo de las
4 naves canónicas y, en cadena, toda la suite que importa `index.ts` (validation/*, canonical-ships,
installation.test, index.test) — es un WIP del operador en curso, no se toca; el operador lo
completa en Tiled. Además, la capa `anclajes` solo captura `id`/posición/sección hoy (Fase 5): las
propiedades custom `condition`/`instanceId` que el operador ya agregó a ese objeto no las lee
ningún parser todavía — conectar "anclaje autorado en Tiled" → `PlacedComponentInstance` real con
esas propiedades es trabajo de 10c, no de 10b.

### 10b — Driver de simulación real + `TaskEffect` real ✅ (completada 2026-07-14)
*Alcance acotado por decisión explícita del operador (no lo que decía el roadmap original): solo lo
que el capítulo 1 ejercita. Química/atmósfera/fallo/cinética/señales NO se adaptan a `Tickable`
todavía — se agregan recién en la sub-fase que implemente el capítulo que las necesite (2 señales,
4 atmósfera/material, 5 fallo, 8 cinética), mismo criterio ya aplicado a las cicatrices persistentes.*
1. ✅ `CrewTask` ganó `payload?: TaskPayload` (`tasks/task.types.ts`) — datos del efecto físico por
   tipo de tarea, discriminado (`DismantleTaskPayload`/`InstallTaskPayload`/`ConnectTaskPayload`;
   `transport`/`combine` quedan sin payload hasta que la mesa de creación entre al core loop).
   `task-factory.ts` lo propaga sin tocarlo.
2. ✅ Nuevo dominio `engine/src/mission/`: `MutableShipState` (caja mutable sobre el `Blueprint`
   vivo de la misión — única fuente de verdad compartida entre el efecto de tareas y el runtime de
   crisis, que no se conocen entre sí); `createShipTaskEffect` (`TaskEffect` real: `dismantle`
   limpia instancia + nodos de señal propios + edges colgantes + contenido de reservorio;
   `install` agrega la instancia nueva con `condition: "ok"`, sin cablear —GDD 10.1 párrafo 7—;
   `connect` reutiliza `workbench/port-wiring.ts::wireExternalPort` tal cual); `CrisisRuntime`
   (`Tickable` que envuelve `evaluateCrisis` de 10a sobre el `Blueprint` vivo y emite sus eventos,
   se registra en `CoreLoopModeMachine` junto al `TaskScheduler`).
3. ✅ 14 tests nuevos (`task-factory.test.ts`, `mission/ship-task-effect.test.ts`,
   `mission/crisis-runtime.test.ts`, y `mission/chapter-01-mission.integration.test.ts` — el
   capítulo 1 resuelto de punta a punta a través del pipeline real
   `CoreLoopModeMachine`→`TaskScheduler`→`TaskEffect`→`CrisisRuntime`, no invocando `evaluateCrisis`
   a mano). 55/55 tests en verde en los dominios que toca esta sub-fase (`crisis/`, `mission/`,
   `tasks/`); build y lint de los 3 workspaces en verde. La suite completa (`npm test -w engine`)
   no corre en verde hoy por el WIP de `nave-exploracion.json` descrito arriba, no relacionado a
   10b — decisión del operador de dejarlo así y no bloquear la sub-fase por eso.

### 10c — Estado inicial de nave para el capítulo 1 ✅ (completada 2026-07-14)
*Decisión explícita del operador: el anclaje que colocó en Tiled (`nave-exploracion.json`, capa
`anclajes`, objeto `valvula-simple-1` con propiedades custom `condition`/`instanceId`) queda como
referencia visual solamente — el parser de Fase 5 sigue sin leer esas propiedades (eso es GDD 15.2,
modo dev real, Fase 11). El estado inicial real se autora en TS, no se deriva del plano.*
1. ✅ `crisis/campaign/chapter-01-primer-aviso.ts` pasó de una única `CrisisDefinition` fija a
   `CHAPTER_01_BY_ARCHETYPE: Record<ShipArchetype, CrisisDefinition>` — mismo patrón (válvula
   simple/motor pequeño universales del catálogo, 7.2), distinta posición/sección bloqueada por
   arquetipo (`CHAPTER_01_PARAMS_BY_ARCHETYPE`, tabla data-driven interna). Posición de Exploración
   ajustada a `(6,6)` para coincidir con el anclaje real que el operador colocó en Tiled (cae en el
   borde de `soporte-vital`, no `bodega-carga` como se autoró originalmente en 10a — corregido).
   Las otras 3: posición de referencia dentro de una sección secundaria real de su propio plano
   (`enfermeria-basica` en Guerra, `hangar-drones` en Investigación, `laboratorio-muestras` en
   Médica), sin verificación visual (decisión ya tomada: solo Exploración se juega de punta a
   punta). Nuevo `CHAPTER_01_INITIAL_COMPONENT_BY_ARCHETYPE` arma el `PlacedComponentInstance`
   (`condition: "jammed"`) listo para anexar, por arquetipo.
2. ✅ `chapter-registry.ts` registra las 4 variantes (antes solo Exploración).
   `save/campaign-save-factory.ts::createNewCampaignSave` anexa la instancia semilla del arquetipo
   elegido a `INITIAL_SHIP_STATE_BY_ARCHETYPE` (que queda sin cambios, sigue siendo el kit genérico
   de Fase 9.5) y fija `chapterProgress.currentChapterId` al id de capítulo 1 de ESE arquetipo —
   toda campaña nueva arranca con el disparador del capítulo 1 ya en el plano.
3. ✅ 15 tests nuevos (`chapter-01-primer-aviso.test.ts` — incluye un test que dispara y resuelve
   mecánicamente vía `evaluateCrisis` en los 4 arquetipos, no solo Exploración —,
   `chapter-registry.test.ts`, 2 casos nuevos en `save/campaign-save.test.ts`). 312 tests en verde
   (0 regresiones), build y lint de los 3 workspaces en verde.

**Decisión tomada con el operador (cierre)**: el anclaje de Tiled queda como marcador visual, no
como fuente de datos parseada — evita mezclar dos conceptos que el GDD mantenía separados (15.1
anclajes vs. 15.2 estado inicial de componentes, este último previsto recién para el modo dev de
Fase 11). Si Fase 11 termina formalizando "anclaje autorado en Tiled → componente instalado", este
mismo contenido (`CHAPTER_01_INITIAL_COMPONENT_BY_ARCHETYPE`) es candidato a migrarse sin cambiar
su forma, solo su origen.

### 10d — UI de juego real ✅ (completada 2026-07-14)
*Decisiones de alcance tomadas con el operador antes de implementar (no volver a preguntar): (1)
spawn de tripulación en `floorplan.sections[0]` de la nave — no había ningún dato de "sección de
inicio" en ningún lado; (2) UI de vinculación de dependencias cruzadas entre tripulantes (GDD §4.3)
diferida — el motor ya la soporta y está testeada (`TaskScheduler.linkDependency`), pero el
capítulo 1 se resuelve con un solo tripulante, no hay caso de uso real todavía para construir esa
UI; (3) herramienta "conectar" SÍ incluida ahora, aunque la regla de resolución del capítulo 1
(`replacement-installed-connected`) — pese al nombre — solo verifica posición + `condition: "ok"`,
no cableado real: se incluye para completar visualmente la secuencia del GDD §4.2.*
1. ✅ Nuevo `engine/src/floorplan/floorplan.types.ts::sectionContainingCell` (celda → sección, con
   test) — lo necesita `/game` para resolver a qué sección pertenece una celda clickeada.
2. ✅ Nuevo dominio `game/src/mission/`: `MissionRuntime` (construye y posee `MutableShipState` +
   `TaskScheduler` + `CrisisRuntime` + `CoreLoopModeMachine` a partir de una `CampaignSaveState`
   real, con `queueDismantle`/`queueInstall`/`queueConnect` que auto-insertan un `go-to` implícito
   cuando la sección destino no coincide con la ya planificada del actor, y aplican la duración
   modulada por afinidad de especialidad/tier de GDD 6.6 — `crew-affinity.ts`, Fase 9, sin
   disparador real hasta ahora); `MissionInteractionController` (selección de tripulante activo,
   click en el plano → inspeccionar/desmontar/instalar, modo cableado — extraído de
   `FloorplanScene` para no superar el umbral de ~200-300 líneas de CLAUDE.md).
3. ✅ `game/src/render/mission-overlay-renderer.ts` (componentes colocados teñidos por `condition` —
   ámbar=atascado, gris=destruido — + grafo de señales real del `Blueprint`, primera vez que el
   plano REAL, no la mesa, muestra sus nodos/edges) y dos widgets nuevos en `game/src/ui/widgets/`
   (`crew-queue-panel.ts`, `component-inspector-panel.ts`, mismo patrón `redraw()` que
   `creative-workbench-scene.ts`). `palette.ts` ganó `SIGNAL_NODE_COLORS`/`COMPONENT_CONDITION_TINT`/
   `CREW_TOKEN_COLORS` (factorizados desde `workbench-renderer.ts`, que ahora reutiliza
   `SIGNAL_NODE_COLORS` en vez de su propia tabla local). `floorplan-renderer.ts` expone
   `sectionCentroidPx` (antes lógica interna de `sectionLabel`).
4. ✅ `floorplan-scene.ts` reescrita para modo in-mission real: siempre parte de
   `campaignSession.requireActive()` (se retiran las teclas 1-4 de cambio de nave — código muerto
   una vez que la nave la fija la campaña); header con nombre de crisis + estado localizado +
   botón play/pausa que maneja `CoreLoopModeMachine`; `update(time, delta)` tickea el core loop en
   modo ejecución; panel de cola de tripulación (click para armar actor activo, cancelar tarea);
   tokens de tripulación persistentes (círculo + nombre, sin sprite — ver nota de assets abajo) que
   saltan (`hop-movement.ts`, Fase 8) al completarse un `go-to`. Se mantienen `G` (galería, dev) y
   `C` (disparador dev de `crisis-result-scene`, retiro es tarea de 10e).
5. ✅ Corrección durante la implementación: el click en el plano originalmente exigía que la celda
   perteneciera a una sección para poder inspeccionar lo que hay en ella — pero el anclaje real del
   capítulo 1 en Exploración cae en el BORDE de `soporte-vital` (10c), lo que hubiera bloqueado
   inspeccionar/desmontar la propia válvula que el capítulo pide resolver. Corregido: un componente
   ya colocado siempre es inspeccionable; la pertenencia a sección solo se exige para decidir si se
   puede instalar algo NUEVO en una celda vacía (ahí sí la valida `validateInstallation`).
6. ✅ Simplificaciones explícitas (documentadas en el código, no TODOs silenciosos): sin rotación en
   el picker de instalación (mismo criterio que la mesa de creación de Fase 9.5); el salto de
   tripulación se anima solo al completarse el `go-to` (no interpola durante toda la duración
   simulada — no hay pathfinding de corredores en el motor); catálogo de instalación es el atómico
   completo (20 piezas), sin filtrar por lo que el capítulo 1 acepta — la UI no decide "qué gana",
   solo deja actuar (principio 1 de CLAUDE.md aplicado a la UI).
7. ⚠️ **Falta el sprite de tripulante** (GDD §17): el token en el plano es un placeholder de código
   (círculo de color + nombre) — ruta esperada `game/assets/sprites/crew/`, como ya señalaba
   CLAUDE.md para este caso.
8. ✅ Sin test automatizado nuevo en `/game` (no hay test runner ahí desde Fase 8, decisión ya
   tomada) más allá del nuevo test de `sectionContainingCell` en `/engine`. **315 tests en verde**
   (0 regresiones), build y lint de los 3 workspaces en verde. Verificación jugable manual
   (`npm run dev -w game`) queda a cargo del operador — sin herramienta de captura de navegador
   disponible en este entorno (misma limitación ya documentada en Fases 8/9).
9. ✅ **Bugfix post-playtest del operador** (mismo día): botones "Ejecutar"/"Modo cableado"
   solapados (posiciones derivadas de la misma constante) y todo el chrome de HUD (header, panel de
   cola, popup de inspección) por debajo del depth de sus propios fondos semitransparentes —
   `createKenneyButton`/los contenedores de los widgets no fijan depth propio, y los fondos se
   habían agregado con un depth explícito por encima de ellos. Explica los 3 síntomas reportados:
   tripulación "sin moverse" (el click de "Ejecutar" probablemente nunca se registraba por el
   solape, así que el core loop nunca entraba en ejecución), panel opacado, botón de cableado
   encimado. `render-depths.ts` gana una franja `hudBackground`/`hudContent` dedicada, aplicada a
   todo el chrome de HUD; botones reposicionados sin solape. Caveat conocido y no bloqueante: un
   tripulante en una sección de la mitad derecha del plano (propulsión/tanques, no usadas por el
   capítulo 1) puede seguir tapado por el panel de cola, dado que el mapa ocupa el canvas completo.
10. ✅ **Ajuste de UI post-playtest #2** (mismo día — ver también el plan
    `dame-un-plan-de-iterative-beaver.md`): un segundo playtest mostró que el problema de fondo del
    punto 9 no estaba del todo resuelto — el mapa (1280×704px) sigue ocupando prácticamente el
    canvas completo, y el popup de inspección (posición FIJA de pantalla, 280×220px) absorbía todo
    click dentro de su rectángulo una vez abierto, sin re-targetear ni cerrar — de ahí que solo los
    3 componentes del kit inicial (`plancha-metalica`/`bateria-celda-simple`/`cable-cobre` en
    `(0,0)/(3,0)/(4,0)`, fuera de ese rectángulo) siguieran respondiendo al click. Rediseño:
    - `FloorplanScene` pasa a usar DOS cámaras: `worldCamera` (recortada al área de mapa,
      `setBounds` al tamaño real de la nave, paneable arrastrando con distinción click/arrastre por
      distancia — sin esto panear no serviría de nada, ya que el mundo cabía entero en un viewport
      del tamaño del canvas) y `cameras.main` (canvas completo, fija, dueña de TODO el chrome de
      HUD). Cada cámara ignora los objetos de la otra (`camera.ignore(...)`, patrón estándar de
      Phaser para "mundo recortado/paneable + HUD de pantalla completa").
    - El popup de inspección flotante se reemplaza por un panel de acciones DOCKED
      (`ui/widgets/component-inspector-panel.ts` renombrado a `mission-action-panel.ts`, con nueva
      variante `idle`), fijo dentro de la franja lateral derecha junto a la cola de tripulación —
      nunca se superpone al mapa, así que el bug de clicks "comidos" desaparece por construcción.
    - Nuevo `briefingKey` opcional en `CrisisDefinition` (contenido MECÁNICO para el capítulo 1, no
      narrativo — `docs/Primeras_8_crisis.md` marca la narrativa como pendiente de definir) +
      `ui/widgets/mission-briefing-modal.ts`: al entrar a la misión se muestra un resumen de la
      crisis con botón "Entendido". Requirió que `MissionRuntime` evalúe la crisis una vez de forma
      síncrona en el constructor (fuera de `CoreLoopModeMachine`, que arranca en `planning` sin
      tickear) — el GDD §4 ordena "1. Crisis se dispara. 2. Modo planificación...", la crisis ya
      está disparada CUANDO arranca la planificación, no recién al primer Play.
    - Marcador visual pulsante (`Graphics`+`tweens`, sin partículas nuevas) sobre el componente que
      originó la crisis (resuelto vía `mission.problemMarkerPosition`, que lee el `instanceId` del
      trigger `jammed-actuator-blocks-section`); la cámara centra ahí al entrar.
    - Header ahora también muestra el modo del core loop ("Planificación"/"Ejecución") explícito.
    - `chapter-01-primer-aviso.test.ts` gana una aserción de `briefingKey` no vacío en los 4
      arquetipos (mismo test ya existente, sin sumar casos nuevos). 315 tests en verde (sin
      regresiones), build y lint de los 3 workspaces en verde.
11. ✅ **Ajuste de UI post-playtest #3** (2026-07-14 — ver también el plan
    `dame-un-plan-de-iterative-beaver.md`): un tercer playtest reportó el modal de briefing ilegible
    (tapado por el mapa), el loop de "tengo un problema, ¿cómo lo resuelvo?" seguía sin ser
    deducible solo con información del juego, y la tripulación seguía sin distinguirse visualmente.
    - **Bug de z-order entre cámaras, causa raíz confirmada**: Phaser compone las cámaras en el
      orden en que se agregan a la escena, no por `depth` de los objetos (`depth` solo ordena DENTRO
      de la pasada de una misma cámara). `worldCamera` se creaba DESPUÉS de `cameras.main` (ajuste
      #2) y por lo tanto pintaba SIEMPRE encima — el header/panel lateral se salvaban por pura
      coincidencia geométrica (viven fuera del rectángulo de `worldCamera`), pero el modal de
      briefing, centrado en pantalla, caía dentro y quedaba tapado por el mapa. Fix: se invierten los
      roles — `cameras.main` (la cámara automática, SIEMPRE se pinta primero) pasa a ser la cámara de
      MUNDO recortada vía `setViewport(...)` en vez de crearle una cámara aparte; `hudCamera` es la
      cámara nueva, agregada DESPUÉS, canvas completo — así el HUD gana la composición por
      construcción, no por casualidad de posición.
    - **Análisis de jugabilidad pedido por el operador** (simulación paso a paso del capítulo 1 con
      la UI tal como estaba): el selector de instalación mostraba los 20 componentes atómicos SOLO
      por nombre, sin ninguna propiedad — un jugador sin el GDD no tenía forma de razonar cuál pieza
      calzaba. Esto invertía la intención real del principio 1 de CLAUDE.md ("emergencia sobre
      recetas" es una restricción sobre el MOTOR — no hardcodear combinaciones válidas —, no una
      instrucción para ocultarle al jugador las propiedades por las que debe razonar). Fix: el
      selector pasa a ser un modal de dos columnas, `ui/widgets/install-picker-modal.ts` (selección
      izquierda sin confirmar, ficha derecha con imagen placeholder + nombre + huella + una línea por
      propiedad funcional/material, texto copiado literalmente de GDD §5.1/5.2 vía 8 claves i18n
      nuevas bajo `component.functional.*`/`component.material.re.*`). `InstallOption` (compartido
      entre `mission-action-panel.ts` y el modal nuevo) gana `functional`/`material`, ya presentes en
      `ATOMIC_COMPONENT_CATALOG` — sin cambios de motor. `MissionInteractionController` gana un
      estado de modal separado del panel docked (`installPickerState`/`installPickerOpen`, este
      último usado por `FloorplanScene` para bloquear paneo/click de mapa mientras el modal está
      abierto). El panel docked, en su estado `empty`, gana un texto de contexto fijo explicando que
      instalar un reemplazo se hace clickeando la misma celda vacía.
    - Tokens de tripulación más grandes (radio 7→11px) con borde oscuro de contraste fijo (visible
      contra cualquier color de tile), más un anillo pulsante de "trabajando" (mismo patrón de tween
      que el marcador de problema) visible mientras `scheduler.getActor(id)?.status === "busy"` —
      antes solo el `go-to` daba algún feedback visual al completarse; desmontar/instalar/conectar no
      animaban nada durante toda su duración.
    - Placeholders de imagen del selector: **falta el sprite de cada una de las 20 piezas del
      catálogo atómico** (GDD §17) — ruta esperada `game/assets/sprites/components/<id>.png`, como ya
      señala CLAUDE.md para este caso; mientras tanto se usa un rectángulo de color + id como texto.
    - 315 tests en verde (sin regresiones — sin cambios de motor más allá de exponer datos ya
      existentes), build y lint de los 3 workspaces en verde. Verificación jugable manual queda a
      cargo del operador (misma limitación de entorno sin captura de navegador, documentada desde
      Fases 8/9).
12. ✅ **Ajuste de UI post-playtest #4** (2026-07-14 — ver también el plan
    `dame-un-plan-de-iterative-beaver.md`): cuarta ronda, cuatro pedidos de feedback visual/
    interacción, ninguno de mecánica.
    - **Afordancia de click**: nada distinguía una celda clickeable antes del click. Se expone
      `MissionInteractionController.isCellInteractable(position)` (misma regla que `handleMapClick`:
      componente colocado O celda con sección) y `FloorplanScene` dibuja un único rectángulo de
      resaltado reutilizable que sigue al cursor en `pointermove` (objeto de mundo, panea con el
      mapa, nuevo depth `hoverHighlight` entre `walls` y `crewEntity`), visible solo sobre celdas
      interactuables y oculto sobre HUD/modales.
    - **Listas con scroll (overflow VERTICAL, corrección de un diagnóstico previo equivocado que lo
      leyó como horizontal)**: el recorte de rexUI es una geometry mask que asume que el contenido
      scrolleable vive directo en la display list de la ESCENA; `install-picker-modal.ts` anidaba la
      lista dentro de un `Phaser.Container` nativo, rompiendo el recorte (los ítems se salían por
      abajo). Las listas ya existentes (`creative-hub`/`creative-workbench`) agregan la lista directo
      a la escena y nunca tuvieron el bug. Fix: la lista se saca del Container (hijo directo de
      escena + depth `hudModal` + registro en cámara de HUD + atada al `destroy` del container para
      no cambiar el contrato de "un solo handle a destruir"). Aparte, `kenney-list.ts` pasa
      `mouseWheelScroller` de `focus:true` a `focus:2` (el primero congela el hit-area del bloque
      scrolleable en ~1×1px porque `setInteractive` corre antes de `.layout()`, por eso la rueda no
      disparaba) — beneficia a las 3 listas.
    - **Pathing de tripulación**: los tokens saltaban en línea recta atravesando paredes. Nuevo
      `render/walkable-grid.ts` (extrae una grilla booleana transitable leyendo las tile layers
      `background`/`walls` de Tiled vía `map.getLayer(...).data` — una celda es transitable si tiene
      piso y no tiene pared; `objects` es decorativo y no bloquea, confirmado con el operador) y
      `crew/floorplan-pathfinding.ts` (BFS 4-direccional + reubicación al transitable más cercano si
      el centroide cae en pared + simplificación de tramos rectos; sin librería nueva). `hopCrewToken`
      encadena un `hopMove` por waypoint (patrón ya soportado por `hop-movement.ts`); etiqueta y
      anillo siguen al dot cada frame en `update()`. 100% capa `/game` — el motor sigue tratando el
      `go-to` como duración abstracta, sin celdas intermedias (sin cambios en `/engine`). Degradación
      explícita a salto único si la nave no tiene tile layers (naves sin arte, GDD §17) o no hay ruta.
    - **Indicador de pausa/ejecución**: nueva tabla `CORE_LOOP_MODE_COLORS` en `palette.ts` (verde =
      ejecución, ámbar = planificación), un badge/pill de color sólido + icono (▶/⏸) en el header con
      pulso en ejecución, y el borde del viewport del mapa coloreado por modo — para que el estado se
      note de un vistazo, no solo por el label chico del botón. El modo se saca del texto del header
      (ahora solo crisis + estado) y vive en el badge.
    - 315 tests en verde (sin cambios de motor), build y lint de los 3 workspaces en verde.
      Verificación jugable manual a cargo del operador (limitación de entorno ya documentada).
13. ✅ **Ajuste de UI post-playtest #5** (2026-07-14 — ver también el plan
    `dame-un-plan-de-iterative-beaver.md`): quinta ronda, cuatro pedidos.
    - **Saltos más cortos**: la simplificación de tramos rectos del ajuste #4 hacía que un pasillo
      entero se colapsara en un waypoint → salto largo. `findPath` (`floorplan-pathfinding.ts`) ahora
      devuelve el path COMPLETO (una celda por paso; se elimina `simplify`), y la cadencia `normal`
      de `hop-movement.ts` se afina a saltos cortos/rápidos (170ms, 6px) — lee como caminar a
      saltitos, no brincos.
    - **Indicador de tiempo por tarea**: `CrewQueueTaskRow` gana `estimatedDurationSeconds`/
      `elapsedSeconds` (ya expuestos por `CrewTask`, sin cambios de motor); cada fila muestra su
      duración estimada y, si está en curso, una barra de progreso + cuenta regresiva. `update()`
      redibuja el panel de cola con throttle (~200ms) durante la ejecución para que avance en vivo.
    - **Solvencia del capítulo 1**: el capítulo SÍ era resoluble (desmontar la válvula en (6,6) e
      instalar otra `valvula-simple` o un `motor-pequeno` — ambas en el selector, ambas aceptadas por
      `ReplacementInstalledConnectedRule`); el bloqueo real era que esas piezas están al fondo de la
      lista de 20 y el overflow (pedido 4) impedía scrollear hasta ellas. Se reescribe el briefing
      del cap. 1 (es/en) para nombrar la solución aceptable (otra válvula simple o un motor pequeño),
      y el inspector de una pieza colocada ahora muestra sus propiedades funcional/material (mismas
      claves i18n y presentación que la ficha del selector) para que el jugador razone qué es un
      "equivalente". Decisión del operador: nombrar en el briefing, NO marcar piezas en el selector
      (no acercar la UI a "decidir qué gana", principio 1). Sin hardcodear recetas en la UI.
    - **Overflow de listas/modal — causa raíz real (posicionamiento, no máscara)**:
      `scene.rexUI.add.scrollablePanel({x,y})` ubica el panel por su CENTRO (origin 0.5), pero
      `install-picker-modal.ts` pasaba una `y` calculada como borde superior → el panel quedaba
      centrado demasiado arriba y sobresalía del modal (el diagnóstico de "anidar en Container" del
      ajuste #4 era un red herring). Se define una caja de contenido explícita y la lista se ubica
      por su centro con la altura correcta; la columna de descripción se reubica para no salirse por
      la derecha del modal. Mismo error latente corregido en `creative-workbench-scene.ts` (y de la
      lista = centro alineado al grid). `kenney-list.ts` gana un comentario dejando EXPLÍCITO que
      `(x,y)` es el centro.
    - 315 tests en verde (sin cambios de motor), build y lint de los 3 workspaces en verde.
      Verificación jugable manual a cargo del operador.
14. ✅ **Sprites de componente + aclaración del desarmado post-playtest #6** (2026-07-15 — ver plan
    `dame-un-plan-de-iterative-beaver.md`).
    - **Aclaración (sin código)**: al completar el desarmado, la pieza SÍ desaparece (el motor la borra
      de `placedComponents` y `redrawOverlay` reconstruye sin ella); lo que queda es el marcador
      pulsante de la crisis, a propósito — desarmar no resuelve, hay que instalar el reemplazo válido
      en esa celda para que la crisis se dé por resuelta y el marcador se apague. Comportamiento
      intencional.
    - **Sprites de componente**: nuevo `render/component-sprite-registry.ts` que descubre los PNGs que
      existan en `game/assets/sprites/components/<id>.png` vía `import.meta.glob` de Vite (tolerante a
      archivos faltantes — no rompe el build por ids sin arte todavía), los precarga
      (`preloadComponentSprites` en `FloorplanScene.preload`) y expone `hasComponentSprite`/
      `componentTextureKey`. El overlay del plano (`mission-overlay-renderer.ts`) y la ficha del
      selector de instalación (`install-picker-modal.ts`) usan el sprite si existe (tinte por
      `condition` en el overlay), con fallback al placeholder de rectángulo actual. Carpeta vacía hoy →
      cero cambio visual hasta que el operador agregue los PNGs (un id por pieza del catálogo atómico,
      20 en total). Sin cambios de motor. 315 tests en verde, build y lint de los 3 workspaces en verde.
15. ✅ **Profundidad de tripulación/objetos vs. paredes post-playtest #7** (2026-07-15): los
    tripulantes y los componentes que colocan deben renderizar POR ENCIMA del suelo pero POR DEBAJO de
    las paredes. Causa raíz: `renderFloorplan` metía las 3 tile layers (`background`/`objects`/`walls`)
    en UN solo container a depth `background` — un `Container` de Phaser aplana la profundidad de sus
    hijos, así que todo el plano (paredes incluidas) renderizaba a depth 0, y el overlay de
    componentes (depth 2) y la tripulación (depth 4) quedaban ENCIMA de las paredes. Fix:
    `render-depths.ts` reordena (`objects` 2 < `crewEntity` 4 < `walls` 5 < `problemMarker` 6;
    `hoverHighlight` 3), y `renderFloorplan` devuelve ahora `{ base, walls }` — la capa de paredes (o
    el `Graphics` de paredes del fallback sin arte) queda como objeto TOP-LEVEL a `RENDER_DEPTH.walls`,
    fuera del container base, para que su profundidad real interleave con la tripulación/objetos. Los
    dos callers (`floorplan-scene.ts`, `particle-gallery-scene.ts`) registran ambos objetos.
    Sin cambios de motor. 315 tests en verde, build y lint de los 3 workspaces en verde.
16. ✅ **7 bugs de playtest #8** (2026-07-15):
    - **Movimiento durante el `go-to`** (bugs 1/5/7): el salto se disparaba al COMPLETAR el `go-to`
      (el token quedaba quieto y saltaba al final) y apuntaba al CENTROIDE de la sección (a veces no
      transitable → `findPath` fallaba → deslizamiento en línea recta entre zonas lejanas). Reescrito:
      el viaje se anima al ARRANCAR el `go-to` (`task-started`), repartido en su duración (`hopMove`
      gana `durationMsOverride`, `chainHops` reparte `perHopMs`), hacia la CELDA real de la acción
      siguiente (`nextActionCellFor` deriva la celda del payload install/dismantle/connect), no al
      centroide; el fallback sin ruta ahora salta por celdas en línea recta (`straightLineWaypoints`)
      en vez de un único deslizamiento. Todo en `/game`.
    - **Overlay sin desfase** (bug 2, motor): `TaskScheduler.completeTask` ejecutaba `effect` DESPUÉS
      de emitir `task-completed`, así que el `redrawOverlay` de `/game` leía el estado sin el objeto
      recién instalado (aparecía un evento tarde). Ahora el efecto corre ANTES del emit (orden correcto
      del Observer). 315 tests en verde (ningún test dependía del orden previo).
    - **Kit fantasma** (bug 3, motor): `initial-ship-state.ts::starterKit` devuelve `[]` — las 3 piezas
      placeholder en la esquina (0,0) desaparecen; una partida nueva arranca solo con el actuador
      atascado del cap. 1.
    - **Celda seleccionada persistente** (bug 6): `MissionInteractionController` trackea `selectedCell`
      (+ callback `onSelectionChanged`); `FloorplanScene` dibuja un resaltado persistente de color
      distinto del hover (`SELECTED_CELL_COLOR`) sobre la celda sobre la que se va a actuar, para no
      colocar algo por error en otra celda.
    - **Pop-up de resultado de crisis** (bug 4): al resolverse (evento `crisis-resolved`),
      `FloorplanScene` guarda el outcome real (`buildCrisisOutcome`/`setPendingCrisisOutcome`) y
      transiciona a `CrisisResultScene` (antes solo cambiaba el texto del header). La escena muestra el
      desenlace real (fallback al dev outcome para la tecla `C`) + botón "Siguiente capítulo"
      deshabilitado (no hay capítulo 2 registrado todavía, con aviso) + "Volver al menú". La
      persistencia de progreso (avanzar/guardar capítulo) sigue siendo 10e/10f.
    - 315 tests en verde, build y lint de los 3 workspaces en verde.

17. ✅ **Paso al costado + consulta del sprite fallante (playtest #9)** (2026-07-15):
    - **Paso al costado al terminar** (game): al completar una acción (install/dismantle/connect) sin
      más trabajo encolado (`hasPendingWork` falso), el tripulante quedaba parado sobre la celda que
      tocó, tapando el objeto. `FloorplanScene.stepAsideCrewToken` da un salto corto a la primera celda
      adyacente ortogonal transitable (`adjacentWalkableCell` sobre la `WalkableGrid`) para dejarlo
      visible; sin grilla o sin vecino transitable, no se mueve.
    - **Consulta (sin código)**: la pieza fallante del cap. 1 es una `valvula-simple` (actuador atascado,
      celda (6,6), sección `soporte-vital`). Sprite esperado: `game/assets/sprites/components/valvula-simple.png`
      (id de definición, no la instancia; `motor-pequeno.png` para el reemplazo alterno).
    - 315 tests en verde, build y lint de los 3 workspaces en verde.

18. ✅ **Destino inalcanzable aborta la tarea (playtest #10)** (2026-07-15):
    - **No cruzar paredes NI ejecutar la acción** (game): con grilla presente y sin ruta transitable,
      `travelWaypoints` devuelve `undefined` (la línea recta queda solo para naves sin grilla) y
      `travelCrewToken` llama a `abortUnreachable`. Como el motor modela el `go-to` como un puro
      temporizador (no conoce paredes) y el `go-to` y su acción NO están vinculados por `dependsOn` (van
      secuenciales en la cola, `mission-runtime.ts`), no basta con no mover el token: hay que cancelar el
      `go-to` Y el tramo contiguo de acciones que iban a ese destino (`scheduler.cancel` hasta el próximo
      `go-to`), o la acción se ejecutaría igual en el lugar equivocado al vencer el timer. El token no se
      mueve; aviso con texto flotante rojo "Sin ruta al destino" (fade 2.2s) + `console.warn` con la
      celda origen para diagnosticar la conectividad del plano (que el operador corrige en Tiled).
    - i18n: `ui.floorplan.mission.no-path` (es/en).
    - 315 tests en verde, build y lint de los 3 workspaces en verde.

19. ✅ **Partículas de instalar/desmontar + selección visual del tripulante (playtest #11)** (2026-07-16):
    - **Partículas de acción** (game): `particles/effects/fabrication-effect.ts` con `installEffect`
      (chispas cian en arco hacia arriba + destello) y `dismantleEffect` (escombros marrones radiales +
      polvo gris) — visualmente distintos (principio 6). No son `DomainEvent`, la escena los dispara en
      `fireFabricationEffect` sobre la celda de la acción (payload; fallback a la celda del token para el
      desmontaje). Nuevo `RENDER_DEPTH.effect` (7); los emisores se marcan como objetos de mundo por la
      doble cámara. Se disparan antes del paso al costado, con el token aún en el sitio.
    - **Selección visual del tripulante** (game): anillo estático verde en el token del actor
      seleccionado en el panel (`updateSelectedActorHighlight` desde `redrawQueuePanel`), distinto del
      `workingRing` pulsante; sigue al token cada frame.
    - 315 tests en verde, build y lint de los 3 workspaces en verde.
    - **(playtest #12)** Las partículas deben correr MIENTRAS dura la acción, no al terminar:
      `fabrication-effect.ts` pasó a emisión continua durante `durationMs` (de
      `task.estimatedDurationSeconds`) y el disparo se movió de `task-completed` a `task-started`.

20. ✅ **Zoom del mapa con la rueda del mouse (playtest #13)** (2026-07-16):
    - **Zoom con rueda** (game): `FloorplanScene` engancha `input.on("wheel")` a `cameras.main.zoom`,
      anclado al cursor (`getWorldPoint` antes/después + corrección de scroll). Restringido a la zona de
      mapa (`isOverFixedUi`, briefing/picker) para no chocar con el scroller del panel de cola. Clamp
      entre `minZoom` ("encajar todo el plano", calculado en `create()`) y `MAP_MAX_ZOOM` (3).
    - **Paneo con zoom**: el arrastre ahora divide el delta por `camera.zoom` para seguir al cursor 1:1
      a cualquier acercamiento (a zoom 1, sin cambios). Hover/click ya usaban `getWorldPoint`.
    - 315 tests en verde, build y lint de los 3 workspaces en verde.

21. ✅ **Nombres de zona/componente como tooltip (playtest #14)** (2026-07-16):
    - **Etiquetas fijas removidas** (game): fuera el nombre de sección (`floorplan-renderer.ts::sectionLabel`)
      y el nombre de componente colocado (`mission-overlay-renderer.ts`; `nameByComponentId` ya no se usa
      en la firma).
    - **Tooltip en hover** (game): `FloorplanScene.updateTooltip` (en `pointermove`, oculto al arrastrar)
      usa `MissionInteractionController.tooltipLabelAt(cell)` — prioridad del componente bajo el cursor
      sobre la zona (reusa `findInstanceAtCell` + `sectionContainingCell`). Objeto de HUD (coords de
      pantalla, no escala con zoom), clampeado para no invadir la franja lateral/borde inferior.
    - 315 tests en verde, build y lint de los 3 workspaces en verde.

22. ✅ **Cap. 1 más interesante — señal simple (sensor → compuerta)** (2026-07-16):
    - **Resolución en 2 pasos (AND)**: (1) reparar/sustituir la válvula atascada (regla existente), (2)
      cablear el sensor de proximidad al panel de la compuerta con el Modo cableado (regla NUEVA). Alinea
      el cap. 1 con `docs/Primeras_8_crisis.md` (señal simple EM+ACT) y le da uso real al botón de
      cableado, que antes no hacía nada (grafo de señales vacío).
    - **Engine**: `SignalNodesWiredResolutionSpec` + `SignalNodesWiredRule` (BFS no dirigido) registrada,
      con unit test. `chapter-01-primer-aviso.ts` siembra dos componentes fijos (fotorreceptor + chip)
      dueños de los nodos emisor/receptor SIN cable (infra fija para sobrevivir al desmontaje);
      `campaign-save-factory.ts` los siembra en el estado inicial. Posiciones exploración verificadas
      walkable; otros arquetipos de referencia.
    - **Tests**: unit de la regla + cap-01 (evaluateCrisis por arquetipo) + integración (tarea `connect`)
      actualizados para exigir ambos pasos. Briefing i18n reescrito (es/en).
    - 319 tests en verde (+4), build y lint de los 3 workspaces en verde.

23. ✅ **UX del cableado + nodos centrados + checklist de objetivos (playtest #15)** (2026-07-16):
    - **(A) Nodos/aristas centrados** (game): los nodos de señal y el cable se dibujan desde el CENTRO de
      la celda (antes esquina) y el punto es más grande, para que quede sobre el sprite. Solo render.
    - **(B) UX del modo cableado** (game): anillos ámbar resaltan los nodos clickeables al activar el
      modo, y marcan distinto el nodo origen; feedback paso a paso por el status; si falta tripulante NO
      se pierde el primer nodo (se pide seleccionar uno y reintentar). Controller: `wireFirstNode` getter,
      `onWireSelectionChanged`, no-reset sin actor.
    - **(C) Checklist de objetivos** (engine + game): las metas generales son las resoluciones de la
      crisis. `objectiveKey?` en las specs + `CrisisRuntime.objectiveStatuses()` (unit test); botón HUD
      "Objetivos" abre un panel con briefing + checklist ✓/○ que se refresca al completar tareas.
    - i18n es/en. 320 tests en verde (+1), build y lint de los 3 workspaces en verde.

24. ✅ **Paneles de misión: cajas acotadas con wrap + scroll (playtest #16)** (2026-07-16):
    - **Texto desbordando** los contenedores: pop-up de briefing y panel de Objetivos (altura fija, texto
      centrado) + panel derecho sin caja y la cola de tareas invadiéndolo (Container que crecía).
    - Nuevo `scrollable-text.ts::createScrollableText` (caja de alto fijo + Text con wrap dentro de un
      scrollablePanel de rexUI). Aplicado al briefing modal (MODAL_HEIGHT 260→360) y al panel de Objetivos.
    - **Cola de tripulación** reescrita como scrollablePanel acotado a `QUEUE_PANEL_HEIGHT` con caja de
      fondo visible: deja de crecer/invadir el panel de acciones, el exceso scrollea. Filas interactivas
      preservadas; barra de progreso gráfica simplificada a la cuenta regresiva textual.
    - **Panel de acciones**: caja de fondo delimitada (param `height`/`actionPanelHeight`); se quitó el
      rectángulo único del strip — cada panel trae su caja (cola [40,260], gap, acciones [276,704]).
    - 320 tests en verde, build y lint de los 3 workspaces en verde.

25. ✅ **Tripulación como tira horizontal + cola unificada — fin del bug de selección (playtest #16b)** (2026-07-16):
    - **Bug**: tras seleccionar el primer tripulante no se podía seleccionar otro. Causa raíz: reconstruir
      objetos interactivos dentro de un `scrollablePanel` de rexUI en esta escena de doble cámara no es
      fiable para input (el `pointerdown` de la fila reconstruida no se disparaba); 4 intentos con rexUI
      cambiaron un modo de falla por otro. `selectActor` ya era correcto (setter plano sin guardas).
    - **Rediseño (decisión del operador)**: la tripulación pasa a una **tira horizontal bajo el mapa**
      (`crew-strip.ts`, solo columna del mapa): cada carta = retrato + nombre + rol; retrato en color
      (`CREW_TOKEN_COLORS[i]`) si seleccionado, **gris** si no. Placeholder de color por código.
    - **Cola unificada** (`crew-queue-panel.ts` reescrito, sin rexUI): una sola lista plana con TODAS las
      tareas de todos, cada fila con chip del color del tripulante + nombre + tarea + cuenta regresiva +
      "×". Recorte con máscara de geometría; scroll con rueda.
    - **Input determinista**: selección/cancelar/scroll se resuelven con **hit-testing a nivel de escena**
      en los handlers `pointerup`/`wheel` existentes (mismo mecanismo del click de mapa), no con
      `setInteractive` por fila. Reconstruir estos paneles es seguro. `MAP_VIEWPORT_HEIGHT` se acorta en
      `CREW_STRIP_HEIGHT` (118px) para la tira; el panel derecho mantiene cola arriba + acciones abajo.
    - **Sprite faltante**: `game/assets/sprites/crew/portrait-base.png` (retrato genérico tintable, con
      grayscale FX cuando no está seleccionado) — placeholder de color activo hasta que exista.
    - 320 tests en verde, build y lint en verde.

26. ✅ **Retratos por tripulante + rediseño de tarjeta de la tira (playtest #16b)** (2026-07-16):
    - **Retratos por nombre**: `crew-portrait-registry.ts` (nuevo, mismo patrón que
      `component-sprite-registry.ts` con `import.meta.glob`): un PNG por tripulante en
      `game/assets/sprites/crew/<slug>.png`, slug = nombre en minúscula sin acentos (`crewPortraitSlug`).
      `preloadCrewPortraits`/`hasCrewPortrait`/`crewPortraitTextureKey`; `floorplan-scene::preload` lo llama.
    - **Tarjeta rediseñada** (`crew-strip.ts`): layout horizontal — retrato a la izquierda, nombre a la
      derecha, rol debajo; caja/borde por tarjeta + `CARD_GAP` mayor (arregla el solape del rol). Retrato:
      Image con grayscale FX (ColorMatrix) cuando no está seleccionado / color cuando sí; placeholder
      gris/color si aún no hay PNG.
    - **i18n** `es.ts`/`en.ts`: `crew.<slug>.name|sex|description` para los 6 tripulantes (ES+EN), para un
      futuro panel de ficha.
    - Sprites faltantes: `game/assets/sprites/crew/{rios,vance,osei,kade,solis,petra}.png` (placeholder activo).
    - 320 tests en verde, build y lint en verde.

### 10e — Barks reales + resultado de crisis real ✅ (2026-07-16)
- **Barks reales (`crisis-start`)**: `bark-bubble.ts` (burbuja sobre el token, sube y se desvanece) +
  `bark-controller.ts` (`BarkController.fire(actor, eventType, x, y)`, elige la línea con
  `barkKey`/`pickBarkIndex` del motor ya testeados y rota entre las 2 del banco). `floorplan-scene.ts`
  dispara un bark por tripulante activo al arrancar la misión (escalonados ~1s, tras cerrar el briefing),
  leyendo `crisisState === "active"` — NO el evento `crisis-triggered`, que se emite en el constructor de
  `MissionRuntime` antes de que la escena se suscriba (el `EventEmitter` no hace replay).
- **Resultado real + retiro de dev**: la resolución real ya estaba cableada (`crisis-resolved` →
  `buildCrisisOutcome` → `setPendingCrisisOutcome` → `crisis-result-scene`). Se quitó la tecla dev `C`, el
  fallback `buildDevCrisisOutcome` (ahora la escena usa solo `takePendingCrisisOutcome()` y vuelve al
  título si no hay outcome) y la clave i18n huérfana `ui.menu.crisis-result.dev-trigger-hint`.
- Otros `BarkEventType` (success/failure/crew-death/…) se dejan para cuando una crisis los produzca; el
  diseño de `fire()` los admite sin cambios. 320 tests en verde, build y lint en verde.
- **Ajuste (feedback)**: los barks pasan de dispararse todos al inicio (poco útil) a REACTIVOS al juego,
  vía `handleCoreLoopEvent`: al empezar una acción asignada (`task-started`, ≠`go-to`) → `dangerous-task`;
  al terminarla (`task-completed`) → `success`; al fallar (`task-failed`) → `failure`. `crisis-start`
  queda como UN solo bark (tripulante al azar) al cerrar el briefing. Cooldown de 600ms por actor en
  `BarkController` para no solapar. Barks de daño (severe-injury/crew-death) siguen pendientes: nadie
  produce esos eventos en misión (HP no se tickea; cap. 1 sin peligro).

### 10f — Integración end-to-end + verificación ✅ (2026-07-17)
Flujo real desde `crew-select-scene` hasta resultado + avance de `chapterProgress` + guardado.
- **Motor**: `crisis/campaign/chapter-sequence.ts` (nuevo, data-driven: `ORDERED_CHAPTERS` fija el orden
  global, `nextChapterAfter(id, archetype)` resuelve el siguiente — único lugar que define el ORDEN, el
  `CHAPTER_REGISTRY` solo mapea id→definición). `save/chapter-progression.ts` (nuevo):
  `advanceChapterProgress(save, resolvedChapterId)` puro — dedup en `completedChapterIds`, fija
  `currentChapterId`, y siembra el estado inicial del próximo capítulo vía `CHAPTER_SEED_BY_ID` (tabla
  extraída y reutilizada también por `campaign-save-factory.ts` para el cap. 1). Con tests.
- **Juego**: `MissionRuntime.toUpdatedSave(base)` — único punto de write-back del estado vivo (nave
  modificada + HP/status/sección de la tripulación) al save. `floorplan-scene.ts::goToCrisisResult`
  reescrita: write-back → (si éxito) `advanceChapterProgress` → `campaignSession.load` + autosave
  `saveCampaignSave` (en éxito Y fallo) → `buildCrisisOutcome` → transición. `crisis-outcome.ts`
  calcula `nextChapterId` vía `nextChapterAfter` sobre el capítulo resuelto (no `undefined`
  hardcodeado), habilitando "Siguiente capítulo" cuando lo hay.
- 327 tests en verde, build y lint de los 3 workspaces en verde. Housekeeping: se logueó el ajuste de
  duración de barks (hold 4s + fade 900ms, `bark-bubble.ts`) que había quedado sin registrar en 10e.

**La Fase 10 (capítulo 1 de punta a punta) queda cerrada.** El siguiente corte es el hito de demo.

## Hito — Demo pública en itch.io
 
No es una fase de desarrollo nueva, es un punto de corte dentro de la Fase 11 pensado para validar el juego en el mercado antes de completarlo. Alcance mínimo antes de publicar:
1. ✅ Capítulos 1 y 2 completos (no solo el 1) — el capítulo 2 es el primero que muestra combinación de
   señales, necesario para que la demo comunique la promesa central del juego ("como redstone"), no solo
   el tutorial. **Cap. 2 "Ecos en el Pasillo" implementado (2026-07-17)**: trigger `motion-sensors-active`
   + resolución `signal-output-matches` (tabla de verdad AND reutilizando `signal-evaluator.ts` de Fase 2)
   + consecuencia `crew-damage` real aplicada en `CrisisRuntime` (timer medio; al vencer mal cableado,
   electrocuta a un tripulante — reusa `hp-resolution.ts`, nuevo `MutableCrewState`). `/game` pinta el
   daño (partículas + bark severe-injury/crew-death, cierra el pendiente de 10e). Contenido data-driven
   con i18n es/en; Exploración walkable verificada, otros arquetipos de referencia.
   **Post-playtest (2026-07-17)** — tres arreglos sobre el cap. 2: (a) bug del pop-up de resultado que no
   aparecía al pasar del cap. 1 al 2 (estado por-misión de la escena persistente no se reiniciaba en
   `create()`); (b) **temporizador visible** en el header (cuenta regresiva con color por urgencia); (c)
   **peligro progresivo** — el timer ahora castiga la dilación: pasado `startFraction`, descargas
   periódicas NO letales a un tripulante (`CrisisHazardSchedule` data-driven + `applyCrewDamage` con piso
   de HP `minHp`); decisión del operador "solo herida" en la demo. Además: `queueConnect` orienta emisor→
   receptor sin importar el orden de click (la resolución del cap. 2 es sensible a la dirección). Ver
   `changelog.log`. (NOTA: el `npm test -w engine` completo depende de que el mapa
   `nave-exploracion.json` — WIP del operador en Tiled — tenga sus secciones alineadas al grid de 32px.)
2. ✅ Exportación/importación de blueprints del modo creativo funcionando — adelantado desde la Fase 11
   (punto 3) porque es el mecanismo de viralidad orgánica esperado. **Implementado (2026-07-17)**:
   archivo `.kludge` vía diálogo nativo de Electron (IPC `blueprint:export`/`import`, `window.kludgeBlueprint`),
   `save-adapter.ts` (`exportCreationToFile`/`importCreationFromFile` con `serialize`/`deserializeCustomCreation`
   del motor, fallback con aviso fuera de Electron), botones Exportar/Importar en `creative-hub-scene.ts`, i18n es/en.
3. Explícitamente fuera de alcance para este hito: capítulos 3-8, árbol de logros/tripulantes nombrados, empaquetado multiplataforma completo (Windows primero es suficiente), segundo idioma (puede añadirse después sin fricción si el sistema de claves de traducción ya está en pie desde CLAUDE.md).
4. Publicar en itch.io como validación de mercado antes de invertir en el resto de la campaña (Fase 11 completa) — no esperar el juego "terminado" para obtener el primer feedback real de jugadores.
 
**Pendiente del hito (diferido por decisión del operador, plan aparte)**: empaquetado Windows
(`electron-builder` + NSIS/portable) y subida a itch.io. El contenido jugable de la demo (cap. 1+2 +
export/import) está verde; el empaquetado es el paso siguiente, cuando el operador lo decida.

**Playtest end-to-end pendiente (operador, `npm run dev -w game`, sin herramienta de captura en este
entorno)**: (1) resolver cap. 1 → resultado con resumen post-misión, reabrir con Continuar y confirmar
que la nave modificada persistió; (2) "Siguiente capítulo" → cap. 2, cablear el combinador → resuelto;
dejar vencer el timer → un tripulante recibe daño (partícula + bark) y resultado de fallo; confirmar que
`chapterProgress` avanzó y persistió; (3) modo creativo: exportar una creación a `.kludge` e importarla.


## Fases 11+

Para las siguientes fases, leer el documento `nuevo-orden.md`.

### Fase 11a — Ajustes de Consistencia Física (ASA)

**Corrección de alcance sobre `nuevo-orden.md` (2026-07-17)**: la 11a estaba redactada como tres
retoques (ASA 1/2/3) sobre sistemas "que ya existen", pero `engine/src/kinetics/` era una ISLA —
completo, testeado y exportado, pero sin un solo llamador de producción, y sin ninguna noción de
proyectil con posición (el caso 17 simulaba el avance a mano con un contador `coilsSoFar` y
distancias literales). ASA 2 ("degradar cada Y celdas recorridas") y ASA 3 (trayectoria fantasma)
presuponen esa entidad. Se parte en 4 subfases — prerrequisito → reglas → visual:

1. ✅ **11a.0 — Proyectil posicionado y simulado** (2026-07-17). Plan:
   `claude-plans/evalua-la-fase-11-a-shimmering-bachman.md`.
   - **Geometría**: `geometry/grid-distance.ts` (`manhattanDistance`) fija la métrica que
     `magnetic-field.ts` había pospuesto a propósito "hasta que exista el primer llamador con un
     proyectil posicionado" — ese llamador es esta subfase. Manhattan sobre euclídea (decisión del
     operador): el proyectil va por un riel recto y la distancia tiene que ser contable a ojo para
     que espaciar bobinas sea una decisión informada.
   - **Cinética**: `kinetics/projectile.types.ts` (`ProjectileState`, `ProjectileBody`, y el puerto
     `ProjectileWorld`) + `kinetics/projectile-simulation.ts` (`ProjectileSimulation implements
     Tickable`). Avanza por celdas con resolución fraccionaria (un proyectil rápido no atraviesa
     obstáculos intermedios), COMPONE sin reimplementar: `activeCoilFieldIntensity` +
     `intensityAtDistance` para el campo, `MagneticAccelerationAccumulator` para la velocidad,
     `resolveKineticImpact` para el daño. Ports & Adapters (decisión del operador): `kinetics/` no
     importa `blueprint/` ni `floorplan/`.
   - **Dirección derivada, no autorada** (decisión del operador): en cada flanco de subida el
     proyectil se orienta hacia la bobina que lo pulsa (doc §2, "se mueve hacia la fuente"), y
     conserva la dirección por inercia. Es el jugador quien dirige colocando bobinas (principio 1).
   - **Señales vivas** (decisión del operador, ampliación de alcance): `mission/mission-signal-runtime.ts`.
     El motor solo evaluaba señales en ráfagas desechables (la resolución del cap. 2 crea un
     `SignalEvaluator`, lo corre con entradas sintéticas y tira el estado) — nadie mantenía qué
     nodos están energizados AHORA, así que el adaptador no tenía a quién preguntarle. Ahora es un
     `Tickable` más del core loop (la pausa táctica congela las señales con todo lo demás) y
     preserva la memoria de latch/contador de los nodos que sobreviven a un re-cableado.
   - **Adaptador**: `mission/mission-projectile-world.ts`. Bobina identificada POR PROPIEDADES
     (`material.MAG` + `COND` eléctrico + nodo energizado — el criterio del caso 9), nunca por id.
     La corriente se DERIVA del reservorio eléctrico más fuerte aguas arriba en el grafo (decisión
     del operador): deroga el comentario de `current-level.types.ts` que decía "se declara
     explícitamente, no se deriva" — nunca existió un campo donde declararla, y fijarla por pieza
     habría impedido que el jugador la variara, que es la palanca central del caso 17.
   - **Cableado**: `MissionRuntime` registra `signalRuntime` y `projectiles` en el core loop, en ese
     orden (una bobina que se energiza en el tick pulsa en el tick, no con uno de retraso).
   - **Caso 17 reescrito**: pilota la simulación real. El pulso temporizado de cada bobina se
     construye con lo que el GDD 5.6 ya ofrece (`delay(on) AND NOT delay(off)`), sin semántica nueva.
   - 370 tests en verde (eran 327), build y lint de los 3 workspaces en verde.
   - Hallazgos fuera de alcance anotados en `PENDIENTES_OBSERVACIONES.md` (3, 4 y 5): código muerto
     de `multipleCoilsThreshold`, emisores sin simulación de sensores, y tripulación sin posición
     por celda.
2. ✅ **11a.1 — ASA 1: masa virtual** (2026-07-17). Plan:
   `claude-plans/revisa-el-punto-11-a1-shimmering-clover.md`.
   - **Regla nueva**: `kinetics/virtual-mass.ts` (`virtualMass(footprint, re?)` → B/M/A, tabla
     tamaño × RE; `RE` ausente = ligera). Archivo propio: una regla = un archivo. El umbral
     `largeFootprintArea` se mudó aquí desde `KINETIC_IMPACT_PARAMETERS` — era el proxy de masa
     entero cuando la masa era solo el tamaño; ahora pertenece a esta regla, junto a
     `mediumFootprintArea`.
   - **Impacto**: `resolveKineticImpact` recibe el `ProjectileBody` entero (footprint + `re`) y
     resuelve la matriz velocidad × masa. `ProjectileBody.re` existía desde 11a.0 sin lector —
     este es el lector.
   - **Deroga el doc §3** (decisión del operador): "daño alto si la velocidad es alta" deja de
     ser cierto — la masa modula en AMBOS sentidos, un proyectil ligero a velocidad alta hace
     daño medio. Si la masa solo agravara, el defecto que ASA 1 corrige sobrevivía en la fila
     que más importa. Enmienda anotada en `docs/Extension_aceleracion_magnetica.md` §3, no solo
     en el código.
   - **Datos de catálogo** (decisión del operador — el fix es data-driven, no un parche al test):
     `iman-permanente` declara `RE: "M"` (1×1 → masa baja: es un imán chico, no un ariete) y se
     añadió `pieza-hierro` (`MAG` + `RE: "A"` → masa media), que el doc §5 ya nombraba pero no
     existía como pieza. El caso 17 volaba un cuerpo ficticio; ahora pilota el catálogo real.
   - **Caso 17**: los 3 tests existentes siguen con su desenlace intacto, más uno nuevo — mismo
     riel, misma temporización, proyectil ligero → el tripulante sobrevive. ASA 1 validado en
     crisis: elegir el proyectil decide el desenlace.
   - **Pendiente #3 resuelto de paso**: `multipleCoilsThreshold` era código muerto (2-3 y ≥4
     bobinas con corriente alta devolvían ambas "A"). Ahora 2-3 + alta → "M", dejando ≥4 + alta
     como único camino a intensidad Alta (tabla del doc §1), con el test 3-vs-4 que faltaba.
     Sin efecto sobre el caso 17: su riel energiza las bobinas de a una.
   - 375 tests en verde (eran 370), build y lint de los 3 workspaces en verde.
   - **Sprite faltante**: `game/assets/sprites/components/pieza-hierro.png` (anotado en
     `docs/listado-piezas-imagenes.md`); mientras tanto cae en el placeholder por código.
3. ✅ **11a.2 — ASA 2: drag por celdas recorridas** (2026-07-17). Plan:
   `claude-plans/revisa-11a-2-hazme-un-serialized-riddle.md`.
   - **Regla nueva**: `MagneticAccelerationAccumulator.applyDrag` (`kinetics/magnetic-acceleration.ts`).
     Fuera de la influencia de toda bobina activa, la velocidad decae un nivel cada
     `dragThresholdCells` celdas recorridas sin pulso — consume `cellsSinceLastPulse`, contabilizado
     desde 11a.0 y reservado sin consumidor hasta ahora. El comentario que afirmaba que el peso
     acumulado "NUNCA decrece" se reescribió: ahora decrece a propósito fuera de pulsos (dentro de
     un pulso sostenido la inercia sigue sin decrecer).
   - **Peso acumulado también decae** (decisión del operador): un decaimiento de velocidad reduce
     también `accumulatedWeight` al umbral del nivel resultante, no solo el nivel expuesto — un
     pulso posterior tiene que volver a ganarse el nivel perdido, no restaurarlo de un pico
     histórico que nunca bajó.
   - **Umbral conservador** (decisión del operador): `dragThresholdCells = 25`, muy por encima del
     hueco más grande del riel bien calculado del caso 17 (~7 celdas) y también por encima de la
     deriva que produce el 2° test de ese caso (bobina fuera de rango, ~14-16 celdas sin pulso) —
     los 4 tests existentes de caso 17 siguen dando exactamente los mismos resultados sin tocarlos.
     El valor 10 probado primero rompía ese 2° test (verificado corriendo la suite, no a mano) y se
     descartó.
   - **Cableado**: `ProjectileSimulation.accelerate()` (`kinetics/projectile-simulation.ts`) llama
     `applyDrag` solo cuando la celda del proyectil no tiene influencia de ninguna bobina
     (`intensity === "N"`) y no hubo pulso este tick — un campo sostenido (sin flanco nuevo) no
     dispara drag aunque el proyectil recorra muchas celdas bajo su influencia.
   - **Disparador solo por celdas** (decisión del operador): `nuevo-orden.md` mencionaba también un
     disparador por segundos de reloj; se descartó por no tener llamador que lo necesite y por ser
     coherente con que el resto de la simulación resuelve todo por celda.
   - **Caso 17**: los 4 tests existentes intactos, más un 5° test (drag): una bobina bien ubicada
     pero encendida demasiado tarde deja al proyectil derivando más de `dragThresholdCells` celdas
     sin pulso — el impulso decae a "N" antes de que la siguiente bobina lo alcance, así que esa
     bobina reconstruye el impulso desde cero en vez de reforzarlo (impacto "B"/"low" en vez del
     "A"/"high" del riel bien calculado).
   - 385 tests en verde (eran 375), build y lint de `/engine` en verde.
   - `PENDIENTES_OBSERVACIONES.md` revisado: ninguno de los 4 puntos registrados aplica a esta
     subfase (no tocan `kinetics/`).
4. ✅ **11a.3 — ASA 3: trayectoria fantasma en pausa táctica** (2026-07-17). Plan:
   `claude-plans/revisa-11a-3-y-dame-encapsulated-wolf.md` (vertical slice completo, decisión del
   operador tras encontrar que ningún proyectil se colocaba/renderizaba nunca en misión real).
   - **Efecto emergente, no mecánica nueva** (decisión del operador): "cargar un proyectil" no es un
     `TaskType` ni una UI nueva. `isLooseFerromagneticCandidate` (`mission-projectile-world.ts`,
     negación exacta de `isElectromagnetDefinition` — el mismo criterio de propiedades del caso 9)
     identifica cualquier pieza `MAG` sin conducción eléctrica; `LooseFerromagneticPromoter`
     (`mission/`, `Tickable` nuevo entre `signalRuntime` y `projectiles` en el core loop) promueve
     esa pieza de `placedComponents` a `ProjectileSimulation` en cuanto aparece — el jugador solo la
     instaló con `queueInstall` de siempre.
   - **Snapshot/restore para predecir "desde ahora"**: `MagneticAccelerationAccumulator` ganó
     `snapshot()`/`initial?` (antes no había forma de clonar el peso acumulado/intensidad
     previa/pasos de drag a mitad de vuelo). `ProjectileSimulation.registerFrom`/`bodyOf`/
     `accumulatorSnapshotOf` siembran un dry-run desde el estado vivo, no desde reposo.
   - **`kinetics/trajectory-preview.ts`** (nuevo, puro): `previewTrajectory` corre una
     `ProjectileSimulation` desechable, trunca en el primer impacto predicho, reutiliza el mismo
     código que la simulación real (nunca una segunda implementación aproximada).
   - **`mission/mission-trajectory-preview.ts`** (nuevo): orquestador concreto — clona el
     `SignalGraphState` vivo y el `Blueprint` (congelado para la ventana de predicción, válido
     porque el reloj real está totalmente parado en pausa), arma un `SignalEvaluator` y un
     `MissionProjectileWorld` descartables (sin emitter: ningún evento de dry-run llega a los buses
     reales). `MissionProjectileWorld` pasó a depender de la interfaz mínima `SignalOutputReader`
     en vez de la clase concreta `MissionSignalRuntime`, justo para permitir este lector de mentira.
   - **Juego**: `projectile-renderer.ts` (token real, redibujado cada frame en ejecución) y
     `projectile-trajectory-renderer.ts` (polilínea fantasma, calculada UNA vez al entrar en pausa
     — `core-loop-mode-changed` — no por frame, porque nada que alimenta la predicción puede
     cambiar con el reloj congelado). Cableado que faltaba desde 11a.0: `kineticEvents`/
     `signalEvents` ahora se suscriben en `floorplan-scene.ts` (antes solo se demostraban en la
     galería de partículas, código muerto en misión real).
   - **Test central** (`case-17...test.ts`): predicción a mitad de vuelo (4s de 8) coincide con el
     impacto real final (misma posición, misma severidad) — "si predice sin drag, miente" probado
     de punta a punta, no solo por partes sueltas.
   - `PENDIENTES_OBSERVACIONES.md` revisado: puntos 1 y 2 no aplican (línea de conexión estática y
     scroll de listas, sin relación); puntos 3 y 4 **heredados, no nuevos** — la predicción es
     exactamente tan (in)exacta como el juego en vivo en emisores/sensores y en impacto contra
     tripulación.
   - 401 tests en verde (eran 385 antes de esta subfase), build y lint de los 3 workspaces en
     verde.
   - Fase 11a completa (11a.0 → 11a.3).

### Fase 11b — Sistema de Guardado y Cicatrices Persistentes ✅ (2026-07-17)

Plan: `claude-plans/revisa-el-punto-11-b-generic-conway.md`.

- **Guardado dinámico**: `Blueprint.schemaVersion` 3→4 (`blueprint.types.ts`,
  `blueprint-serializer.ts`), 3 campos nuevos con default si faltan (mismo criterio que `condition`
  en el bump 2→3): `sectionAtmospheres` (snapshot serializable de `SectionAtmosphere` por sección,
  `atmosphere-snapshot.types.ts`), `unpoweredSectionIds` (cicatriz de energía) y
  `PlacedComponentInstance.structuralResistanceOverride` (cicatriz de RE). `reservoirContents` y el
  sistema de guardado en sí (`engine/src/save/`, persistencia real a disco vía Electron) ya
  existían desde antes — no eran parte del trabajo real de esta fase.
- **Atmósfera viva en misión** (hallazgo: no existía ninguna, solo tests unitarios aislados):
  `MissionAtmosphereRuntime` (`mission/mission-atmosphere-runtime.ts`, nuevo `Tickable`) siembra
  `SectionRuntime` desde `deriveAtmosphereModel` + snapshot guardado y tickea `diffuse()` real —
  primer llamador de producción. Alimenta también `atmosphere-state-effects.ts`, que ya existía sin
  llamador. Nuevo `atmosphere/corrosive-atmosphere.ts` (`sectionCorrosiveLevel`) clasifica el nivel
  corrosivo de una sección cruzando sus gases contra el catálogo químico.
- **Cicatriz de RE**: `MissionStructuralRuntime` (`mission/mission-structural-runtime.ts`, nuevo
  `Tickable`) — primer llamador de producción de `StructuralIntegrity` (existía desde antes de
  Fase 10, sin cablear). Degrada por componente instalado según el nivel corrosivo de su sección y
  escribe `structuralResistanceOverride` de vuelta al Blueprint. Wiring visual: `floorplan-scene.ts`
  suscribe `failureEvents` a los efectos `structural-degraded`/`structural-failure` (existían, sin
  llamador en misión real).
- **Cicatriz de energía**: `MissionSignalRuntime.outputOf` gana un `PowerScarSource` opcional —
  fuerza `output=false` en los nodos de una sección marcada sin energía, sin importar
  cableado/reservorio (decisión del operador). Wiring visual (decisión del operador tras descartar
  un tinte oscuro simple por insuficiente): tinte exclusivo + parpadeo sinusoidal continuo
  (`sectionScarFlickerAlpha`, `palette.ts`), nuevo depth `sectionScar`.
- **Cicatriz de tripulante**: `CrewActor.seriousInjurySurvivalCount` — solo el campo (decisión del
  operador), sin la lógica del logro "Superviviente nato" (GDD 6.8, -15% de daño futuro), que se
  implementa junto al árbol de logros.
- **Alcance confirmado con el operador**: guardado solo entre misiones (no a mitad de crisis); la
  incapacitación tóxica/corrosiva a tripulación (`HazardAccumulator`, caso 10) queda fuera — es
  contenido de capítulo (Fase 18), no infraestructura genérica.
- **Test central**: `case-07-neutralizacion-emergencia.test.ts` reescrito para pilotar el flujo real
  (mismo criterio que 11a.0 con el caso 17) — degradación bajo exposición sostenida, neutralización
  detiene la cicatriz sin revertirla, y la cicatriz sobrevive un round-trip real de serialización.
- 417 tests en verde (eran 401), build y lint de los 3 workspaces en verde.
- `PENDIENTES_OBSERVACIONES.md` revisado: puntos 1, 2, 4 y 5 no aplican. Punto 3 (emisores no
  simulados) es adyacente — esta fase también toca `mission-signal-runtime.ts`, pero para un
  mecanismo distinto; sigue abierto.

### Fase 11c — Mesa de Creación en Misión y Síntesis Química

Plan: `claude-plans/dame-unplan-de-ejecucion-merry-canyon.md`. Subfase densa (motor de señales,
tareas, escenas de `/game`, motor químico) partida en 4 sub-subfases, dependencia lineal
11c.0 → 11c.1 → 11c.2 y 11c.3 mayormente independiente.

1. ✅ **11c.0 — Nodos de señal para piezas instaladas en runtime** (2026-07-17). Prerrequisito
   (hallazgo de 11a.3): `ship-task-effect.ts::installInstance` agregaba a `placedComponents` pero
   NO a `signalGraph.nodes` — asimétrico con `dismantleInstance`, que sí limpia nodos por
   `ownerRef`. En cascada, `mission-interaction-controller.ts::handleWireModeClick` (busca nodos por
   posición) hacía `return` silencioso: la pieza instalada en misión era incableable.
   - **Regla nueva** `workbench/derive-signal-nodes.ts` (`deriveSignalNodes`): deriva los nodos de
     las propiedades funcionales de la definición — `EM→emitter`, `REC→receptor`, `COND→conductor`
     (decisión del operador: los nodos emergen de propiedades, no se declaran en el catálogo,
     principio 1). `ACT`/`RES`/`EST` no generan nodos. Es el análogo runtime de
     `translateWorkbenchNodesToBlueprint`; ubicado en `workbench/` (no en `signals/` como decía el
     plan) para evitar el ciclo `signals→workbench` — `workbench/` ya importa `signals/`. Reutiliza
     `occupiedCells` para posicionar cada nodo en una celda distinta (el `find` por posición del
     modo cableado no colisiona).
   - **Cableado**: `installInstance` resuelve la definición desde el `componentRegistry` (nuevo
     parámetro de `createShipTaskEffect`) y fusiona los nodos derivados con `mergeInstalledSignalGraph`
     (ya existía, reutilizado — no se reimplementó el merge). No cablea puertos externos: crear los
     nodos ≠ conectarlos (GDD 10.1 párrafo 7). El único llamador de producción, `mission-runtime.ts`,
     pasa su `componentRegistry` ya existente (`buildComponentCatalog().registry`).
   - **Tests**: unitario de `deriveSignalNodes` (mapeo de tags, ignora ACT/RES/EST, reparto en celdas
     distintas) + integración del effect (instalar el `fotorreceptor` EM real deja un nodo `emitter`
     cableable en la posición de la pieza). Tests existentes de `ship-task-effect` y del pipeline del
     cap. 1 actualizados a la nueva firma.
   - 422 tests en verde (eran 417), build y lint de los 3 workspaces en verde.
   - `PENDIENTES_OBSERVACIONES.md` revisado: punto 3 (emisores no simulados) es adyacente pero
     distinto — 11c.0 crea los nodos de señal, no simula sensores; sigue abierto.
2. ✅ **11c.1 — Creaciones custom instalables y cableables en misión** (2026-07-17). Depende de 11c.0.
   - **Hallazgo bloqueante**: `buildComposite` NO agrega las propiedades funcionales de las piezas, y
     `nameAndRegisterCreation` solo guardaba `{ footprint }` — una creación de la mesa tenía
     `data.functional` vacío, así que al instalarla en misión `deriveSignalNodes` (11c.0) no derivaba
     ningún nodo y era incableable pese a contener piezas EM/REC/COND.
   - **Motor**: `nameAndRegisterCreation` (`workbench/creation-naming.ts`) ahora agrega al
     `data.functional` del compuesto la unión de las propiedades funcionales de sus ingredientes
     (`factory.resolveIngredients`) — los puertos externos de la creación emergen de sus partes
     (principios 1 y 3), no se declaran aparte. Con esto la derivación de nodos de 11c.0 vale igual
     para átomos y creaciones.
   - **Game**: `MissionRuntime.loadInstallableCreations()` (async) carga las creaciones custom vía
     `save-adapter` (`listCustomCreations`/`loadCustomCreation`), las registra en el `componentRegistry`
     de la misión (tipado ahora como `MapEntityRegistry` para poder registrar) y las expone
     (`installableCreations`, `definitionOf`). `FloorplanScene` la dispara al iniciar la misión
     (fire-and-forget, termina antes de que se pueda abrir el picker) y suma sus nombres al mapa
     compartido. El picker (`mission-interaction-controller.ts::buildInstallOptions`) lista átomos +
     creaciones; el inspector de una instancia colocada resuelve sus props vía `definitionOf` (no solo
     `ATOMIC_COMPONENT_CATALOG`), así muestra también las de una creación instalada.
   - **Ciclo verificado**: instalar una creación → sus nodos derivados quedan en `signalGraph` → el
     modo cableado los encuentra por posición → `queueConnect`. Sin código nuevo de cableado.
   - **Tests**: `creation-naming` (agrega funcionales) + integración del effect (instalar un compuesto
     con parte EM deja un nodo `emitter` cableable). 424 tests en verde (eran 422), build y lint de los
     3 workspaces en verde.
   - **Pendiente anotado**: la agregación cubre `functional` pero no `material` — una creación no hereda
     el `RE`/`MAG` de sus partes todavía (afecta cicatriz estructural y detección ferromagnética de una
     creación instalada). Registrado en `PENDIENTES_OBSERVACIONES.md`.
3. ✅ **11c.2 — Mesa de creación en pausa táctica + tarea de fabricación** (2026-07-17). Depende de 11c.1.
   - **Motor**: `combine` sumado a `AffinityAction` (`crew-affinity.ts`), afín a `ingeniero` (GDD 6.6 /
     caso 15, "según el tier del Ingeniero"), con su tabla de multiplicador por tier + test. `combine` ya
     tenía duración base (10s) y state machine/dependencias en el scheduler — no muta el `Blueprint`, así
     que el efecto de motor sigue siendo no-op (la fabricación es disponibilidad de registry, game-layer).
   - **Fabricación diferida** (`MissionRuntime`): `queueFabrication(actorId, definition)` registra la
     creación en el `componentRegistry` y encola una tarea `combine` modulada por afinidad/tier. La
     creación NO aparece en el picker hasta que la tarea se completa: una suscripción a `task-completed`
     (clavada por `taskId`, el payload no viaja en el evento) mueve la definición de `pendingFabrications`
     a `installableCreations` (11c.1). Instalar sigue siendo un paso aparte (GDD 10.1, decisión del
     operador: 2 pasos).
   - **Mesa en misión** (decisión del operador: reutilizar la escena creativa): `CreativeWorkbenchScene`
     gana `init({ missionContext })` — en modo misión cambia "volver"→`onClose` y "nombrar y guardar"→
     "Fabricar" (`nameAndFabricate`: nombra, entrega la definición y cierra, sin guardar en campaña ni
     auto-instalar), y pinta un fondo opaco de modal. `FloorplanScene` la abre como overlay desde un botón
     "Mesa" del header (solo en planificación y con tripulante seleccionado), pausa el plano y bloquea su
     input mientras la mesa está encima. i18n es/en.
   - **Sprites en la mesa** (cierra pendiente #7, el operador dio luz verde al tocar este render):
     `creative-workbench-scene.ts` precarga `preloadComponentSprites`, y `workbench-renderer.ts` dibuja el
     sprite real de cada pieza (fallback al rectángulo por código si falta). Nodos/cables/contornos se
     movieron a un `topGraphics` de depth superior para no quedar tapados por el sprite.
   - **Test**: afinidad de `combine` (`crew.test.ts`). El resto es game-layer (sin suite, CLAUDE.md);
     validación por playtest bajo Electron. 425 tests en verde (eran 424), build y lint de los 3
     workspaces en verde.
   - **Hardening post-playtest bajo Electron (2026-07-20)** — cinco arreglos:
     (1) **Preload roto** (crítico): `preload.js` era ESM pero el preload sandboxed exige CommonJS →
     `window.kludgeSave` NUNCA se inyectaba → toda la persistencia caía a memoria, incluso bajo Electron.
     Fix: bundle CJS con esbuild (`preload.cjs`), `main.ts` apunta ahí. (2) **Leak de `missionContext`**
     (crítico): Phaser retiene `sys.settings.data`, así que el contexto de misión reaparecía en el modo
     creativo → "Fabricar" sobre una `FloorplanScene` muerta → crash `drawImage`/pantalla negra. Fix:
     handoff de un solo uso por variable de módulo (`setPendingMissionWorkbenchContext`), sin `scene.data`;
     se eliminaron `init(data)` y el handler de SHUTDOWN. (3) `FloorplanScene` libera las suscripciones a
     los emisores del motor en su SHUTDOWN. (4) **Borrar pieza**: `removePiece` (motor, con test) + botón
     "Modo borrar" en la mesa (mover = borrar+recolocar; decisión del operador). (5) Botón "Mesa" atenuado
     en ejecución. Además: DevTools auto-abre en dev, `BrowserWindow` con `useContentSize`. 427 tests en
     verde (eran 425).
4. ✅ **11c.3 — Síntesis química element→compuesto** (2026-07-20). Flujo de sustancias aparte que
   cablea `ReactionResolver` + `NamedRecipeIndex` a producción y extiende el caso 12 (antes solo
   cubría el fallback). Alcance acordado con el operador: motor + mesa de síntesis, dejando fuera
   (anotado en `PENDIENTES_OBSERVACIONES.md`, punto 9) el almacenamiento en reservorio y la
   extracción por centrífuga — mismo criterio incremental que 11c.1 con la agregación de material.
   - **Motor**: `buildChemicalCatalog()` ahora también devuelve `namedRecipeIndex` (construido desde
     el propio `registry`, ya no hay que rearmarlo en cada call site) y su `registry` se tipa como
     `MapEntityRegistry` concreto (no la interfaz), igual que `buildComponentCatalog`, para poder
     registrar en él. Nuevo módulo `chemistry/production/synthesize-substance.ts`
     (`synthesizeSubstance`): traduce una selección de sustancias a `ReactantSubstance[]`, delega en
     `ReactionResolver.resolve` (sin reimplementar la resolución en 3 pasos) y registra el resultado
     en el catálogo si no estaba ya (una receta nombrada como "agua" no se reinscribe; un fallback o
     el producto de una regla por tags sí, para que quede resolvible después por atmósfera/futuros
     reservorios). Exportado desde `engine/src/index.ts`.
   - **Caso 12 extendido**: se sumaron 4 tests nuevos sobre el catálogo real vía `synthesizeSubstance`
     (no solo el `ReactionResolver` pelado, como antes): receta nombrada (hidrógeno×2+oxígeno→Agua),
     sensibilidad a proporción con los mismos elementos (hidrógeno×2+oxígeno×2→Peróxido, GDD 5.4.2),
     regla por tags (ácido+base de laboratorio→Solución neutralizada) y el fallback quedando
     registrado y resoluble por id. El test original (fallback con `ReactionResolver` sin catálogo de
     recetas) se mantiene sin tocar. Más un archivo de test dedicado a `synthesizeSubstance` (7 casos,
     incluye validación de errores: <2 sustancias, id desconocido).
   - **Producción en misión** (`MissionRuntime`): `queueSynthesis(actorId, selectedElementIds)` espeja
     `queueFabrication` — resuelve la síntesis de una (es determinística) y encola una tarea `combine`
     modulada por la misma afinidad de Ingeniero que fabricar un compuesto físico (GDD 6.6: "Fabricar
     en la mesa es trabajo de Ingeniero"); reutiliza el tipo de tarea `combine` en vez de crear uno
     nuevo, distinguiendo fabricación física de síntesis química por cuál de los dos mapas
     (`pendingFabrications`/`pendingSynthesis`) tiene el `taskId` al completarse. Nuevo getter
     `availableSubstances`.
   - **Mesa de creación** (`CreativeWorkbenchScene`): toggle "Física"/"Química" (solo en contexto de
     misión, porque `queueSynthesis` vive en `MissionRuntime`). En modo química la paleta lista
     `ELEMENT_CATALOG` en vez de `ATOMIC_COMPONENT_CATALOG`; los elementos elegidos se acumulan en una
     lista con cantidad (sin grid espacial — un elemento químico no tiene footprint en el modelo de
     datos, a diferencia de una pieza física) y el botón de acción pasa a "Sintetizar"
     (`MissionWorkbenchContext.onSynthesize`, cableado en `FloorplanScene.openWorkbench`). i18n es/en.
   - **438 tests en verde (eran 431)**, build y lint de los 3 workspaces en verde.
   - **Playtest manual bajo Electron no se pudo completar**: el propio `npm run start -w electron` del
     proyecto (no solo el intento de automatizarlo) falla en este entorno con
     `SyntaxError: The requested module 'electron' does not provide an export named 'BrowserWindow'` —
     `node_modules/electron` se ejecuta como Node.js plano, no como runtime de Electron/Chromium
     (confirmado: `electron --version` devuelve una versión de Node, no de Electron). Es un problema de
     empaquetado/entorno preexistente en esta máquina, no relacionado con este cambio — ya estaba roto
     antes de tocar nada de 11c.3. No se pudo abrir la app para un playtest visual. Verificación de
     respaldo: 438 tests unitarios/integración en verde (incluida la extensión del caso 12) y
     `tsc --noEmit` limpio en los 3 workspaces confirman que el cableado tipa y se comporta según lo
     esperado a nivel de motor/game-layer, pero no reemplazan ver la mesa renderizada. Pendiente: un
     playtest visual humano cuando el entorno de Electron esté disponible.
   - **Hardening post-playtest humano (2026-07-20)** — el operador sí pudo abrir la app y reportó 5
     problemas del modo química, los 5 con causa raíz identificada y corregida:
     (1) **Crash al scrollear la lista de elementos** (crítico): `renderPalette()` llamaba
     `this.palettePanel?.destroy(true)` al alternar de modo. En rexUI, `destroy(true)` en un objeto de
     la familia `ContainerLite` (`ScrollablePanel`, `Label`, `Sizer`) significa "me destruye la Scene, no
     yo" y por eso **saltea destruir a sus hijos reales** (filas, `track`/`thumb` del scrollbar, el
     `ScrollableBlock` interno) — el `MouseWheelScroller` solo desregistra su listener de `wheel` a nivel
     de escena cuando ese `ScrollableBlock` emite su propio `'destroy'`, que nunca ocurría. El listener
     viejo seguía vivo apuntando a un panel con `childrenMap` ya nulo → crash al scrollear el panel
     nuevo. Fix: `.destroy()` sin argumento (cascada real) — aplicado también al nuevo widget de
     tarjetas y a los botones del modal de confirmación (misma familia rexUI). (2) **Elementos
     mecánicos de fondo semitransparentes** en modo química: mismo bug de (1) dejaba fantasmas del panel
     viejo, más `redraw()` seguía dibujando el grid físico vacío (`renderWorkbench`) incluso en química,
     donde no hay nada que colocar — ahora `redraw()` no llama a `renderWorkbench` en modo química y usa
     esa área para selección/resultado. (3)/(4) **Interfaz poco interesante y sin info química** — nuevo
     widget `ui/widgets/kenney-card-list.ts` (hermano de `kenney-list.ts`, misma base
     `scrollablePanel`/`slider`/`mouseWheelScroller`, filas como `Phaser.GameObjects.Container` en vez de
     una sola línea de texto): tarjetas con color curado por elemento (`CHEMICAL_ELEMENT_COLORS`,
     `render/palette.ts`, decisión del operador: color real por elemento específico) + nombre + todos
     sus tags (`chemistry.tag.*`, mismo criterio de bullets que `component.functional.*`). El área del
     grid liberada en (2) ahora muestra chips de la selección (color + cantidad) y una tarjeta de
     "Resultado" en vivo — nuevo `MissionRuntime.previewSynthesis` (consulta de solo lectura al
     `ReactionResolver`, sin registrar nada, para poder llamarse en cada click) coloreada por tag
     dominante del resultado (`CHEMICAL_TAG_COLORS`, decisión del operador: color por tag para el
     resultado, no por identidad — reutiliza los valores de `CLOUD_TINT` para TOX/CORR). (5) **"Sintetizar"
     cerraba la mesa sin decir qué pasó**: no era un bug de datos (`queueSynthesis` ya resolvía el nombre
     bien), era falta de feedback — nuevo modal de confirmación (`confirmSynthesis`, mismo patrón visual
     que `promptCreationName` pero de solo confirmación, sin campo de texto, porque a diferencia de una
     creación física el nombre de una sustancia lo determina el motor, GDD 5.3, no el jugador) mostrando
     nombre+tags antes de cerrar; `queueSynthesis` ahora devuelve el nombre resuelto y el status del
     plano lo muestra explícito (`workbench-synthesizing` con `{name}`, mismo formato que
     `workbench-queued`). 438 tests en verde (sin cambios de motor en este hardening), build y lint de
     los 3 workspaces en verde. Playtest visual sigue pendiente de confirmación humana tras este fix.

### Fase 11c-adhoc Rework Capítulo 1: "sin stock → inspeccionar → desarmar → reutilizar" ✅ (2026-07-21)

Plan: `claude-plans/plan-capitulo-1-rework-inventario-desarmado.md`. Pedido del operador: el capítulo
1 dejaba instalar `motor-pequeno`/`valvula-simple` directo desde un catálogo sin límite — nuevo flujo
obliga a descubrir que no hay stock, inspeccionar un compuesto no crítico ya en la nave, desarmarlo y
recién ahí instalar la pieza obtenida. Alcance ampliado en dos rondas de preguntas con el operador:
sistema de stock **global** (no una excepción de capítulo 1), resolución de crisis generalizada a
**tag funcional** en vez de lista cerrada de ids (corrige el incumplimiento del principio 1 de
`CLAUDE.md`), y un **estándar nuevo de autoría en Tiled** para sembrar objetos compuestos directo
desde el mapa (pedido explícito, pensado para reutilizarse en capítulos futuros).

- **Inventario/stock** (`engine/src/inventory/`, nuevo dominio): `AtomicPartsStock` (`Partial<Record<ComponentId, number>>`,
  clave ausente = 0) + ledger puro (`hasStock`/`consumeStock`/`creditStock`) + `MutableAtomicStock`
  (mismo patrón que `MutableShipState`). `CampaignSaveState.atomicStock` nuevo (`schemaVersion` 2→3),
  con default retrocompatible (`{}`) al deserializar un save viejo.
- **`ship-task-effect.ts`**: `installInstance` consume 1 unidad de stock si la definición es
  ATÓMICA (lanza `InsufficientStockError` si no alcanza); `dismantleInstance` acredita los
  `recipe.ingredients` al stock si la definición es COMPUESTA (nada si es atómica — no tiene receta
  que revertir). `createShipTaskEffect` gana un tercer parámetro (`MutableAtomicStock`) — todos los
  call sites (motor + `MissionRuntime`) actualizados.
- **Resolución de crisis por tag funcional**: nuevo `FunctionalTagInstalledResolutionSpec`/
  `FunctionalTagInstalledRule` (`crisis/rules/functional-tag-installed.ts`) — acepta cualquier pieza
  con `data.functional` conteniendo el tag pedido en `anchorPosition`, no una lista cerrada de
  `ComponentId`. `CrisisEvalContext` gana `componentRegistry?` (opcional, solo esta regla lo usa).
  Capítulo 1 migrado de `replacement-installed-connected` a `functional-tag-installed` con
  `requiredTag: "ACT"` (se borró `CHAPTER_01_ACCEPTABLE_REPLACEMENT_IDS`, ya sin consumidores); la
  regla vieja queda registrada por si algún capítulo futuro la necesita tal cual.
- **Estándar Tiled — objetos semilla compuestos** (`floorplan/`): nueva capa **opcional** `semillas`
  (mismo patrón que `anclajes`/`conductos`: `objectgroup`, objetos punto), propiedades
  `componentId`/`condition`/`instanceId`/`chapterId` (todas menos `componentId` opcionales).
  `ComponentSeedPoint` + `ShipFloorplan.componentSeeds` (parser tolera mapas sin la capa aún — los
  otros 3 arquetipos siguen sin autorarla). Nuevo `floorplan/instantiate-component-seeds.ts`: resuelve
  cada semilla contra el `componentRegistry`, exige que sea COMPUESTO (GDD 7.1-7.2: un átomo no se
  "encuentra" suelto con identidad propia) y que su `CompositeComponentSpec.data.footprint` esté
  poblado (campo ya existía en el tipo, pre-Fase-7 casi ningún compuesto de catálogo lo tenía —
  poblado para los 3 elegidos). `chapterId` ausente = attrezzo presente desde el arranque de la
  campaña (`BASE_COMPONENT_SEEDS_BY_ARCHETYPE`, `campaign-save-factory.ts`); presente = convención
  por `chapterOrder` (no por el id completo archetype-suffixed), instanciado en `CHAPTER_SEED_BY_ID`.
  `nave-exploracion.json` (único mapa verificado de punta a punta) autorado con 3 semillas: la
  solución (`herramientas-reparacion-externa`, contiene `motor-pequeno`) y dos señuelos
  (`radio-largo-alcance`, `reservorio-agua-reciclada`) que no resuelven la crisis pero sí se pueden
  desarmar — el pedido explícito del operador era mostrar el mecanismo general, no un atajo de un
  solo objeto. Edición del JSON quirúrgica (inserción de texto, no reserializado completo) para no
  perder formato/contenido previo del archivo.
- **`CHAPTER_01_INITIAL_ATOMIC_STOCK = {}`**: toda campaña nueva arranca en capítulo 1
  (`campaign-save-factory.ts` ya lo asumía así), así que este valor es directamente el stock inicial
  de la partida — sin necesidad de un mecanismo de "default generoso" real hoy (documentado en el
  código como el punto de extensión para cuando exista otro capítulo de entrada).
- **UI (`/game`)**: `install-picker-modal.ts` gana dos pestañas ("Disponibles en Inventario" /
  "Catálogo — Requiere Síntesis", `setButtonHighlighted` + `createKenneyButton`, mismo patrón que
  `archetype-select-scene.ts`) — Inventario filtra atómicos por `MissionRuntime.stockOf(id) > 0` +
  creaciones custom; Catálogo es informativo (botón "Instalar" deshabilitado, decisión confirmada con
  el operador). `mission-action-panel.ts` e `install-picker-modal.ts` comparten un nuevo
  `renderCompositionLines` (`ui/widgets/composition-list.ts`) que desglosa `recipe.ingredients` de un
  compuesto y resalta en ámbar (`WIRE_HIGHLIGHT_COLOR`, mismo color que el highlight de nodos
  cableables) la pieza que tiene el tag funcional que la crisis activa necesita.
- **Incidente durante la implementación**: un `git checkout -- <archivo>` sobre
  `nave-exploracion.json` (para deshacer un rewrite propio con formato distinto) revirtió también
  cambios previos sin commitear que ya existían en ese archivo ANTES de esta tarea (mostrados como
  modificado en el estado inicial de la sesión) — `git checkout` no distingue "mis cambios de este
  turno" de "cambios previos sin commitear", descarta todo el working tree del archivo contra HEAD.
  Recuperado buscando en `git fsck --dangling` un blob huérfano (`git add` previo sin commit) que
  coincidía en tamaño/contenido con el archivo original leído al principio de la sesión, y
  reaplicando la inserción de la capa `semillas` sobre ese contenido recuperado en vez del commit
  limpio. Verificado con `diff` que el resultado final es exactamente el contenido pre-tarea más la
  inserción quirúrgica, nada más. Lección para instrucciones futuras: nunca usar `git checkout --
  <archivo>` como forma de "deshacer mi propio cambio" sin revisar antes si el archivo ya tenía
  modificaciones sin commitear ajenas a la tarea — `git diff` o guardar una copia antes es más seguro.
- **470 tests en verde** (motor, `npx vitest run` en `/engine`; eran 454 antes de este cambio),
  `tsc --noEmit` limpio en `/engine` y `/game`, `vite build` de `/game` exitoso (2056 módulos). Sin
  test suite propia en `/game` (más laxo por convención de `CLAUDE.md`) — playtest manual visual
  queda a cargo del operador (pidió hacerlo él mismo en esta sesión).

### Fase 11c-adhoc.1 — Fixes de playtest manual sobre la Fase 11d ✅ (2026-07-21)

El operador hizo el playtest manual de la Fase 11d (según lo pactado: "yo hago la prueba manual, no
tu") y reportó 5 problemas. Todos corregidos en la misma sesión, con plan previo aprobado
(`claude-plans/vamos-a-restructurar-el-temporal-bunny.md` reutilizado — mismo archivo, tarea nueva).

- **Tooltip enriquecido reemplaza la info del click**: `MissionInteractionController.tooltipLabelAt`
  (nombre plano) reemplazado por `tooltipContentAt` (nombre, condición, propiedades funcionales/
  materiales, composición) — misma lógica que antes armaba el panel de acciones al click
  (`buildComposition` reutilizado tal cual). Nuevo widget `game/src/ui/widgets/mission-tooltip.ts`:
  caja flotante con ícono de condición por color/glifo (✔ verde / ⚠ ámbar / ✖ rojo, sin sprites
  nuevos) + `renderCompositionLines`. `floorplan-scene.ts::updateTooltip` ahora dibuja este widget
  (antes un `Text` de una línea), redibujando solo al cambiar de celda. El panel de acciones
  (`mission-action-panel.ts`) deja de repetir propiedades/composición al click — `ActionPanelContent`
  (caso `instance`) se simplifica a solo `name`/`condition`/`instanceId`, esa info ahora vive
  exclusivamente en el tooltip.
- **Resaltado de pieza requerida solo por color**: `renderCompositionLines` pierde el parámetro
  `requiredTagBadge` — la pieza con `hasRequiredTag` se sigue pintando en ámbar/negrita, pero ya no
  agrega el texto "★ Contiene función requerida" (pedido explícito del operador: que sea implícito,
  no explicado). Clave i18n `required-tag-badge` eliminada de `es.ts`/`en.ts`.
- **Layout del modal de instalación**: causa raíz encontrada leyendo el código, no solo ajuste visual
  a ciegas — (a) el título no tenía `wordWrap` y las pestañas quedaban a ~15-30px por debajo,
  suficiente para invadirse con texto largo (fix: `wordWrap` en el título + más separación,
  `TAB_ROW_Y`/`CONTENT_TOP` corridos); (b) `install-picker-modal.ts::catalogHint` se dibujaba a solo
  ~10px de la fila de botones Instalar/Cancelar, se solapaban con texto de 2 líneas (fix: subido
  ~18px más arriba); (c) `kenney-list.ts` NO tenía `wordWrap` en el texto de cada fila — un nombre
  largo (frecuente en la pestaña "Catálogo") se renderizaba más ancho que el `width` fijo declarado
  para el layout de la fila, dando la sensación de lista angosta con la scrollbar desalineada del
  texto (fix: `wordWrap` explícito en el texto de la fila).
- **Feedback visual al desarmar un compuesto**: `TaskEffect` (motor) pasa de devolver `void` a
  `TaskEffectResult | void` (`{ obtained?: [...] }`); `TaskScheduler.completeTask` reenvía ese
  resultado en el evento `task-completed` (campo `obtained` nuevo, opcional). `ship-task-effect.ts`,
  rama `dismantle`, devuelve los ingredientes acreditados cuando la pieza desarmada es un compuesto.
  En `/game`, nuevo widget `game/src/ui/widgets/obtained-toast.ts` (mismo patrón de tween que
  `flashCrewCard`: aparece, deriva hacia arriba, se desvanece) disparado desde
  `floorplan-scene.ts::handleCoreLoopEvent` con el texto "Obtuviste: x{qty} {nombre}".
- **`motor-pequeno` (2×2) no entraba en el hueco de `valvula-simple` (1×1)**: la causa raíz NO era
  tamaño de sección — la celda ancla del capítulo 1 (`(6,6)`) está pegada a un `chip-circuito-generico`
  FIJO (panel de compuerta, no desmontable, en `(7,6)`) y a la semilla `radio-largo-alcance` sembrada
  cerca; cualquier footprint 2×2 que contuviera la celda ancla terminaba pisando alguno de los dos —
  confirmado por lectura directa de `chapter-01-primer-aviso.ts` + `nave-exploracion.json`, no
  supuesto. Nuevo `engine/src/workbench/installation-placement.ts::findFittingInstallPlacement`
  (función pura, reutiliza `validateInstallation` ya existente): en vez de limitarse a offsets que
  contengan la celda clickeada, recorre TODAS las celdas de la sección, descarta las que no validan, y
  devuelve la válida más cercana (distancia Chebyshev) a la celda clickeada — generaliza el fix a
  *cualquier* pieza más grande que el hueco que reemplaza, no un parche puntual del capítulo 1
  (principio 1 de `CLAUDE.md`). `mission-interaction-controller.ts::confirmInstall` la usa antes de
  encolar la tarea de instalación; si no hay hueco en ninguna celda, se mantiene el mensaje de rechazo
  de siempre. 3 tests nuevos en `installation-placement.test.ts` (fit exacto, fit en celda cercana
  reproduciendo el caso real del capítulo 1, `undefined` sin hueco).
- **Objetivos siempre visibles + feedback de progreso**: nueva franja compacta
  `renderObjectivesStrip()` en `floorplan-scene.ts`, fija en la columna lateral entre el header y la
  cola de tareas (`OBJECTIVES_STRIP_HEIGHT = 72`, solo bullets `✓`/`○`, sin briefing) — el resto de la
  columna (cola, panel de acciones) se corre hacia abajo la misma cantidad. Se refresca en cada
  `task-completed` incondicionalmente (antes solo si el modal de objetivos estaba abierto). El modal
  del botón "Objetivos" (`renderObjectivesPanel`) pierde el checklist duplicado, se queda solo con el
  briefing explicativo. Feedback de progreso: `objectivesDoneKeys` guarda qué objetivos ya estaban
  cumplidos en el redibujado anterior; cualquiera que pase de `false` a `true` dispara un flash verde
  breve sobre su línea (mismo patrón de tween que `flashCrewToken`/`flashCrewCard`).
- **473 tests en verde** (motor, `npx vitest run` en `/engine`; +3 sobre la Fase 11d por
  `findFittingInstallPlacement`), `tsc --noEmit` limpio en `/engine` y `/game`, `vite build` de
  `/game` exitoso (2058 módulos). Playtest manual visual queda a cargo del operador.

### Fase 11c-adhoc.2 — Segunda ronda de playtest: tooltip y tabs ✅ (2026-07-21)

Nueva ronda de feedback del operador sobre la Fase 11e, 4 problemas — todos en `/game`, sin tocar
`/engine`:

- **Fuente ilegible en mayúsculas**: `UI_FONT_FAMILY` ("Kenney Future") es una fuente de display en
  mayúsculas por diseño; se usaba también para texto de cuerpo en `mission-tooltip.ts` y
  `composition-list.ts`. Se queda solo en encabezados/mini-títulos (nombre del tooltip, título de
  "Composición"); las líneas de propiedades/composición pasan a `"sans-serif"` (genérico ya usado en
  el checklist de objetivos, sin assets nuevos — investigado que no hay ninguna fuente mixed-case
  cargada vía `FontFace` en el proyecto).
- **Nombres de componente crudos** (ej. "valvula-simple" en vez de "Válvula simple"): el cache
  `nameByComponentId` de `floorplan-scene.ts` solo se puebla con el catálogo atómico + creaciones
  custom + fabricaciones — nunca con compuestos de catálogo (`EXPLORACION_CATALOG`, etc.) ni con las
  semillas Tiled. `mission-interaction-controller.ts::tooltipContentAt`/`buildComposition` ahora
  priorizan `this.mission.definitionOf(id)?.name` (el `componentRegistry` real de la misión, que sí
  conoce todo) sobre ese cache parcial, que queda como último respaldo.
- **Prefijo "H1"/"HX" confuso**: no había ningún código generando esa cadena — era "x1" (prefijo de
  cantidad) renderizado en mayúsculas ("X1") pegado al nombre crudo, fácil de leer como "H1" a 11px.
  Se resuelve como efecto colateral de los dos fixes anteriores; además se cambió el separador de "x"
  a "×" (signo de multiplicación) en `composition-list.ts` como seguro adicional.
- **Pestañas del modal de instalación seguían solapándose**: el fix de la Fase 11e corrigió el
  espaciado del título pero no el ancho de los botones — seguían siendo dos `createKenneyButton` de
  200px fijos con solo 10px de hueco entre ellos, y `kenney-button.ts` no recorta/envuelve texto (un
  label largo como "Catálogo — Requiere Síntesis" se desbordaba más allá de su propio botón). Nuevo
  widget `game/src/ui/widgets/tab-strip.ts` (`renderTabStrip`): mide el ancho real de cada label con
  un `Text` temporal (mismo font/tamaño) antes de crear el botón definitivo, dimensiona cada pestaña
  a `texto + padding` (piso de 140px) y las posiciona en fila con gap fijo, centrando el grupo — sin
  inventar un asset de tab nuevo (el pack Kenney no trae uno; se reutiliza el botón existente pero con
  layout correcto). `install-picker-modal.ts` reemplaza los dos botones manuales + `setButtonHighlighted`
  por un único `renderTabStrip(...)`.
- `tsc --noEmit` limpio y `vite build` exitoso en `/game` (2058 módulos). Sin cambios en `/engine`, no
  hizo falta re-correr su suite de tests. Playtest visual queda a cargo del operador.

### Fase 11c-adhoc.3 — Fuente legible en el briefing de misión ✅ (2026-07-21)

Ajuste puntual: `scrollable-text.ts::createScrollableText` (widget compartido por el cuerpo del modal
de briefing de crisis, `mission-briefing-modal.ts`, y el briefing del panel de objetivos,
`floorplan-scene.ts::renderObjectivesPanel`) usaba `UI_FONT_FAMILY` ("Kenney Future", mayúsculas por
diseño) también para el texto largo de la descripción del escenario — mismo problema de legibilidad ya
corregido en el tooltip/composición (Fase 11f), pendiente en este widget. Cambiado el default a
`"sans-serif"`; el título corto del modal (`mission-briefing-modal.ts`, fuera de este widget) se queda
en la fuente Kenney, coherente con el criterio ya establecido (encabezados cortos sí, cuerpo largo no).
`tsc --noEmit` y `vite build` limpios en `/game`.

### Fase 11d — Enemigos con ruta scripteada y daño a tripulación (nueva, distinta de la "Fase 11d" de `changelog.log`)

Nota de desambiguación: `changelog.log` usa "Fase 11d" para el rework del Capítulo 1 (el que este
documento llama `Fase 11c-adhoc`). `PENDIENTES_OBSERVACIONES.md` (punto 4, deuda técnica) reutilizaba el
mismo número para algo distinto y no implementado: enemigos que se mueven con `hop-movement`. Confirmado
con el operador (2026-07-21) que esta sección es esa segunda cosa. Plan completo en
`.claude/plans/analiza-la-fase-11d-mellow-llama.md`. Se ejecuta en 4 sub-fases incrementales.

#### Fase 11d.1 — Motor puro (dominio `enemies/`) ✅ (2026-07-21)

Alcance confirmado con el operador: movimiento por ruta scripteada determinista (no IA reactiva), daño
cuerpo a cuerpo en celda adyacente / a distancia en 2-3 celdas con arma modelada por las mismas
propiedades de componente físico que el motor ya entiende (`EM`+`ACT`), y resolución del punto 4 de
`PENDIENTES_OBSERVACIONES.md` (posición por celda de tripulación, compartida con enemigos).

- **Posición por celda compartida**: `CrewActor.currentCell?: GridPosition` nuevo (opcional,
  retrocompatible — la tripulación sigue registrándose sin celda si no se provee). Nuevo dominio
  `engine/src/enemies/`: `EnemyActor` (`enemy-actor.types.ts`) con posición por celda obligatoria,
  `archetype: "armored" | "agile"` (mapea a las firmas de hop ya reservadas en
  `game/src/crew/hop-movement.ts`), `weaponComponentId: ComponentId` (referencia real al catálogo, nunca
  literales de daño sueltos — así desarmar a futuro es degradar esa instancia/definición), y
  `status: "advancing" | "attacking" | "defeated"` (state machine explícita).
- **Ruta scripteada**: `enemy-route.types.ts` (`ScriptedRoute`/`RouteWaypoint`, con `arrivalSeconds` sobre
  el mismo reloj de misión que `CrisisTimerConfig`) + `route-progression.ts::cellAtElapsedSeconds`,
  función pura y determinista (snap discreto por celda, sin interpolar píxeles — eso es de `/game`).
- **Arma reutilizando propiedades existentes**: nuevo componente de catálogo `garra-de-abordaje`
  (`components/catalog/composite/guerra.ts`) — solo `ACT`, sin `EM`, en contraste con
  `torreta-automatizada` (`EM`+`ACT`, a distancia). `weapon-damage.ts::weaponDamageSeverity` traduce
  `power`/`cadence` de un `ActuatorProperty` a severidad cualitativa (tabla, mismo criterio que
  `kinetic-impact.ts::kineticDamageSeverity`) — no existía ninguna función que hiciera esto antes.
- **Combate (Strategy)**: `combat-rule.ts::CombatRangeRule` (mismo molde que `CrisisTriggerRule`),
  `rules/melee-adjacency-rule.ts` (distancia Manhattan == 1, arma sin `EM`) y
  `rules/ranged-proximity-rule.ts` (distancia 2-3, arma con `EM.range` suficiente), registradas en
  `rules/combat-rule-registry.ts`. `enemy-attack-resolver.ts::resolveEnemyAttack` orquesta: resuelve el
  arma vía `componentRegistry`, prueba las reglas, y si conecta llama `applyCrewDamage` con la nueva causa
  `"enemy-attack"` (`crew-events.types.ts`) — mismo punto único de convergencia de daño que ya usa
  `CrisisRuntime`, no una cuarta función paralela.
- **Eventos de dominio**: `enemy-events.types.ts` (`enemy-advanced`/`enemy-attacked`/`enemy-defeated`),
  agregados a la unión `DomainEvent` del barrel (`index.ts`) — el consumidor en `/game` (partículas,
  `hopMove`) queda para la Fase 11d.3, deliberadamente, igual que Fase 11b declaró
  `seriousInjurySurvivalCount` sin implementar su efecto todavía.
- **Fuera de alcance de esta sub-fase (queda para 11d.2)**: el `Tickable` `EnemyThreatRuntime` que
  orquesta todo esto contra el reloj real de misión, y el fix de `MissionProjectileWorld.occupantAt` para
  que un proyectil golpee tripulación/enemigos reales (hoy solo se prueba con el mundo de test sintético
  del caso 17). El punto 4 de `PENDIENTES_OBSERVACIONES.md` queda parcialmente resuelto (el dato ya
  existe) pero se marca resuelto del todo recién al cerrar 11d.2.
- 28 tests nuevos (`route-progression.test.ts`, `weapon-damage.test.ts`,
  `melee-adjacency-rule.test.ts`, `ranged-proximity-rule.test.ts`, `enemy-attack-resolver.test.ts`), 501
  tests en verde (`npx vitest run` en `/engine`), `tsc --noEmit` limpio. Sin cambios en `/game`.

#### Fase 11d.2 — Integración en `MissionRuntime` + fix de `occupantAt` ✅ (2026-07-22)

- **`engine/src/mission/mutable-enemy-state.ts`**: `MutableEnemyState`, espejo de `MutableCrewState`
  (get/set/all) — misma fuente de verdad compartida entre `EnemyThreatRuntime` (que muta al tickear) y
  `MissionProjectileWorld` (que resuelve colisiones contra el mismo estado).
- **`engine/src/mission/enemy-threat-runtime.ts`**: `EnemyThreatRuntime implements Tickable`, mismo molde
  que `CrisisRuntime` sobre `evaluateCrisis`. Cada tick: avanza la `ScriptedRoute` de cada enemigo vivo
  vía `cellAtElapsedSeconds` (emite `enemy-advanced` si cambió de celda; `onComplete: "vanish"` reutiliza el
  estado `"defeated"` de la state machine — sin un cuarto valor para "removido sin combate", a `/game`
  (11d.3) le basta con saber que ya no está en juego), y prueba `resolveEnemyAttack` contra la tripulación
  viva. La cadencia entre ataques (para no atacar todos los ticks, responsabilidad explícitamente diferida
  del resolver puro en 11d.1) se resuelve aquí interpretando `ActuatorProperty.cadence` como cooldown en
  segundos entre disparos de esa arma — mismo criterio de "cadencia baja = ataca más seguido" que ya usa
  `weaponDamageSeverity`.
- **Fix de `MissionProjectileWorld.occupantAt`** (punto 4 de `PENDIENTES_OBSERVACIONES.md`, resuelto del
  todo ahora): el constructor acepta `crew?: MutableCrewState` y `enemies?: MutableEnemyState` opcionales;
  si no hay componente colocado en la celda, cae a buscar coincidencia por `currentCell`/`cell` en
  tripulación y luego en enemigos. El caso 17 (`RailWorld` sintético) sigue sin pasarlos y no se tocó.
- **`game/src/mission/mission-runtime.ts`**: instancia `EnemyThreatRuntime` (sin rutas de contenido
  todavía — `routes: new Map()`, a la espera de 11d.4) y lo registra en `coreLoop` justo después de
  `crisisRuntime` y antes de `signalRuntime`/`projectiles`, para que el daño de enemigo y el de un
  proyectil en el mismo tick se acumulen sobre el HP más reciente. Expone `enemyState`/`enemyEvents`
  igual que ya existían `crewState`/`crewEvents`, y pasa `crewState`/`enemyState` al construir
  `MissionProjectileWorld`.
- **Efecto de partículas mínimo para `cause: "enemy-attack"`** (`game/src/particles/effects/crew-death-effect.ts::weaponStrike`):
  al extender `CrewDamageCause` en 11d.1 sin tocar `/game`, el `Record<CrewDamageCause, ...>` de
  `DEATH_VARIANT_BY_CAUSE` quedó incompleto y `tsc --noEmit` de `/game` rompía al tocarlo en esta
  sub-fase. Se agregó un chispazo naranja + el mismo charco de sangre que el resto de causas físicas
  (principio 6: distinto del amarillo de `rigidCollapse`/electrocución) — placeholder mínimo,
  distinción por arquetipo/arma de enemigo queda para 11d.3.
- **`engine/src/validation/case-18-intruso-en-el-pasillo.test.ts`**: integración con el `EnemyThreatRuntime`
  real (no un runtime de test simplificado, mismo criterio que caso 17) — dos enemigos con
  `ScriptedRoute` real (torreta a distancia, garra cuerpo a cuerpo) avanzan hasta entrar en rango contra
  dos tripulantes distintos: la torreta conecta a distancia 3 (severidad "high", letal — `crew-death`), la
  garra conecta adyacente (severidad "medium" — `crew-damaged`, hp 100→50), y ninguna repite ataque dentro
  de la ventana de test por su cadencia (torreta cada 5s, garra cada 4s).
- **502 tests en verde** (`npx vitest run` en `/engine`, 89 archivos, incluido el nuevo caso 18), `tsc
  --noEmit` limpio en `/engine` y `/game`, `vite build` limpio en `/game`.
- Punto 4 de `PENDIENTES_OBSERVACIONES.md` queda **resuelto del todo**: posición por celda + colisión real
  de proyectiles contra tripulación/enemigos, validado contra el runtime real.
- **Fuera de alcance de esta sub-fase (queda para 11d.3/11d.4)**: ningún enemigo es visible/jugable
  todavía — `EnemyThreatRuntime` corre con `enemies`/`routes` vacíos en la misión real hasta que 11d.4
  siembre contenido; el consumidor visual (`hopMove`, partículas de arma por arquetipo) es 11d.3.

#### Fase 11d.3 — Render/animación/partículas en `/game` ✅ (2026-07-22)

- **`game/src/enemies/enemy-tokens.ts`** (nuevo, consistente con la modularización por dominio): token
  visual de enemigo — rectángulo de color sólido (mismo criterio de placeholder-por-código de
  `initCrewTokens`, GDD §17) distinguible de los tokens circulares de tripulación (principio 6:
  "enemigo" nunca debe leerse como "tripulante"), con tinte/tamaño distinto por `EnemyArchetype`
  (blindado: gris-azulado, grande; ágil: naranja, chico). `hopEnemyToken` reutiliza `hopMove` con
  `ARMORED_ENEMY_SIGNATURE`/`AGILE_ENEMY_SIGNATURE` (ya reservadas desde antes de esta fase).
  `flashEnemyAttack` da feedback corto (pulso de escala) sobre el propio token del enemigo al conectar
  un ataque. `destroyEnemyToken` limpia el token al derrotarse/desvanecerse.
  - **Sprite real pendiente** (convención de CLAUDE.md, avisado explícitamente): faltan
    `game/assets/sprites/crew/enemy-armored.png` y `game/assets/sprites/crew/enemy-agile.png`. Mientras
    no existan, el placeholder de código basta — no hay `TODO` sin señalar.
- **`game/src/render/render-depths.ts`**: nueva capa `enemyEntity: 4.2`, junto a `crewEntity` (4) pero
  ligeramente por encima, para que un enemigo nunca quede tapado por un tripulante en la misma celda.
- **`game/src/scenes/floorplan-scene.ts`**: `enemyTokens: Map<EnemyActorId, EnemyToken>`, `initEnemyTokens()`
  (un token por `mission.enemyState.all()`, en la celda real del enemigo — a diferencia de la tripulación,
  que solo tiene sección), suscripción a `mission.enemyEvents.onAny` y `handleEnemyEvent` (Observer:
  `enemy-advanced` → `hopEnemyToken`; `enemy-attacked` → `flashEnemyAttack`; `enemy-defeated` →
  `destroyEnemyToken` + limpieza del mapa). El daño/muerte de tripulante causado por un enemigo
  (`cause: "enemy-attack"`) ya se pintaba automáticamente desde 11d.2 (`handleCrewEvent` despacha por
  `cause` sin cambios adicionales — el `weaponStrike` de 11d.2 ya cubría esto).
- **Sin contenido de capítulo todavía (11d.4 pendiente)**: `mission.enemyState`/`mission.enemyEvents`
  siguen vacíos en una misión real, así que no hay NADA visible en pantalla hoy — el consumidor está
  listo, esperando a que 11d.4 siembre un `EnemyActor`+`ScriptedRoute` real. Por eso el playtest manual
  de "enemigo visible saltando y atacando" (criterio de cierre del plan original) se difiere al cierre
  de 11d.4, que es cuando habrá algo que el operador pueda efectivamente ver en pantalla.
- `tsc --noEmit` y `vite build` limpios en `/game`. Sin cambios en `/engine` (nada que testear ahí en
  esta sub-fase).

#### Fase 11d.4 — Contenido de un capítulo real ✅ (2026-07-22)

Decisiones tomadas con el operador antes de escribir contenido (minimizando assumptions):
- **Capítulo**: 2 ("Ecos en el Pasillo") — encaja con el caso de validación 18 ya escrito en 11d.2.
- **Arquetipos**: solo `exploracion` (el único verificado jugable de punta a punta, mismo criterio ya
  establecido en `chapter-02-ecos-en-el-pasillo.ts`) — los otros 3 quedan sin enemigo por ahora.
- **Arma**: `garra-de-abordaje` (severidad "medium"), NO `torreta-automatizada` (severidad "high" —
  letal por sí sola). El capítulo 2 está diseñado explícitamente como NO letal (su propio hazard/
  consecuencia declaran `lethal: false`) y `resolveEnemyAttack` (11d.1) no tiene un flag de no-letalidad
  equivalente al `options.minHp` de `applyCrewDamage` — el operador optó por mitigar con contenido
  (arma sin severidad "high") en vez de extender el motor en esta sub-fase.

**Hallazgo y fix previo, fuera del plan original pero bloqueante**: `CrewActor.currentCell` nunca se
escribía en `/game` (solo se leía, desde 11d.1/11d.2) — la tripulación solo trackeaba `currentSectionId`
vía el scheduler; la celda concreta era puramente visual (`pixelPositionForSection`, centroide de
sección). Sin esto, un enemigo sembrado NUNCA podría conectar un ataque en partida real (el resolver
descarta tripulantes sin `currentCell`), y el punto 4 de `PENDIENTES_OBSERVACIONES.md` seguía sin estar
realmente resuelto pese a haberse marcado ✅ en 11d.2 (esa sub-fase resolvió la mitad "motor", nunca la
mitad "game" que escribe el dato). Fix (confirmado con el operador antes de proceder):
- `game/src/mission/mission-runtime.ts`: al registrar cada actor activo, ancla `crewState.currentCell`
  al centroide (`sectionCentroidCell`) de su sección de spawn/save. `toUpdatedSave` persiste `currentCell`
  de vuelta al save.
- `game/src/scenes/floorplan-scene.ts`: nuevo `syncCrewCell(actorId)`, llamado en cada `task-completed`
  de tipo `go-to` — mantiene la celda al día cuando el actor viaja de sección.

Contenido nuevo:
- **`engine/src/enemies/campaign/chapter-02-enemy-seed.ts`**: `CHAPTER_02_INTRUSO` (`EnemyActor`,
  archetype `agile`, arma `garra-de-abordaje`) + `CHAPTER_02_INTRUSO_ROUTE` (`ScriptedRoute` de 4
  waypoints por el `pasillo-central`, de x=30 a x=13 en y=9, cerca del panel combinador/sensor B del
  puzzle del capítulo, `onComplete: "hold"`). `ENEMY_SEED_BY_CHAPTER_ID: ReadonlyMap<CrisisDefinitionId, EnemySeed>`
  — análogo a `CHAPTER_SEED_BY_ID` (`save/chapter-progression.ts`) pero para enemigos; un capítulo sin
  entrada arranca vacío (mismo criterio que regía en 11d.2 sin contenido).
- **`game/src/mission/mission-runtime.ts`**: resuelve `ENEMY_SEED_BY_CHAPTER_ID.get(save.chapterProgress.currentChapterId)`
  al construir la misión y alimenta `enemyState`/`EnemyThreatRuntime.routes` con el contenido real si existe.
- **3 tests nuevos** (`chapter-02-enemy-seed.test.ts`): siembra exactamente 1 enemigo para exploración con
  arma no-"high", ningún otro capítulo tiene contenido todavía, y la ruta tiene `arrivalSeconds`
  estrictamente creciente terminando en `"hold"`.
- **505 tests en verde** (`npx vitest run` en `/engine`, +3 sobre 11d.3), `tsc --noEmit` limpio en
  `/engine` y `/game`, `vite build` limpio en `/game`.
- Punto 4 de `PENDIENTES_OBSERVACIONES.md` ahora sí queda resuelto del todo (motor + game).
- **Pendiente de validar por el operador**: playtest manual iniciando una partida nueva en el arquetipo
  Exploración, dejando avanzar el capítulo 2 hasta que dispare, y confirmando en pantalla que el intruso
  (rectángulo naranja) aparece en el pasillo, salta por su ruta, y su ataque (si un tripulante queda en
  su camino) hiere sin matar.

Con esto se cierran las 4 sub-fases de la Fase 11d.

#### Fix post-cierre (2026-07-22) — el enemigo saltaba varias celdas de golpe en vez de caminar

El operador reportó en playtest que el intruso del capítulo 2 "se mueve muy lento y salta varias
casillas a la vez, no como los tripulantes". Causa: el consumidor visual de 11d.3
(`enemy-tokens.ts::hopEnemyToken`) animaba cada `enemy-advanced` con un solo `hopMove` directo entre
waypoints separados por varias celdas, en vez de caminar celda a celda como la tripulación
(`travelCrewToken`/`chainHops`). Fix: `chainHops` (`floorplan-scene.ts`) se generalizó para aceptar
cualquier `HopTarget` + una `JumpSignature`; nuevo `travelEnemyToken`/`enemySegmentDurationMs` calculan
el camino transitable y reparten la duración REAL del tramo (expuesta vía el nuevo
`MissionRuntime.enemyRoutes`) entre esas celdas — mismo mecanismo que la tripulación, firma de salto
distinta. `hopEnemyToken` queda como fallback sin grilla transitable. `tsc --noEmit`/`vite build`
limpios en `/game`, sin cambios en `/engine`. Pendiente: confirmación visual del operador.

#### Fix post-cierre, segunda ronda (2026-07-22) — seguía lento y el enemigo nunca atacaba

El operador confirmó mejora en el movimiento pero reportó que seguía "muy lento" y que "no ataca a
nadie". Dos causas: (1) el `arrivalSeconds` del seed del capítulo 2 (`chapter-02-enemy-seed.ts`) tenía un
ritmo de ~1.33s/celda — comprimido a ~0.33s/celda, comparable a la cadencia normal de la tripulación
(cambio de datos, sin tocar motor); (2) `syncCrewCell` (fix anterior) anclaba `currentCell` al centroide
de TODA la sección, demasiado impreciso para que las reglas de combate (adyacencia 1 / rango 2-3)
conectaran contra un tripulante real dentro de una sección grande como `pasillo-central`. Reemplazado por
sincronización cada frame en `update()` de `floorplan-scene.ts`, derivando `currentCell` de la posición
VISUAL real del token (`Math.floor(dot.x/CELL)`/`Math.floor(dot.y/CELL)`) — mismo criterio que ya usa ese
loop para seguir la etiqueta/anillos durante un viaje largo. `tsc --noEmit`/`vite build` limpios en
`/game`; 31 tests de `src/enemies` en verde. Pendiente: confirmación visual del operador.

#### Fix post-cierre, tercera ronda (2026-07-23) — seguía sin atacar aunque un tripulante pasara al lado

El movimiento ya se veía bien, pero el enemigo seguía sin atacar a nadie. Causa: `resolveEnemyAttack`
exige además `target.currentSectionId === enemy.sectionId`, y `CrewActor.currentSectionId` (fuente:
`TaskScheduler::completeTask`) solo se actualiza cuando un `go-to` COMPLETA — nunca mientras el
tripulante atraviesa visualmente una sección de paso (ej. `pasillo-central`) camino a otro destino.
Mismo desajuste "modelo discreto por tarea vs. posición visual continua" que el de `currentCell`, un
nivel más arriba. Fix: el mismo loop de `update()` que sincroniza `currentCell` cada frame ahora también
deriva `currentSectionId` vía `sectionContainingCell` (ya exportada de `/engine`) y lo escribe en
`crewState` — sin tocar el `currentSectionId` que persiste el scheduler para el guardado. Sin cambios en
`/engine`: `resolveEnemyAttack` y su test de "no conecta en otra sección" siguen siendo correctos, solo
recibían un dato desactualizado. `tsc --noEmit`/`vite build` limpios en `/game`. Pendiente: confirmación
visual del operador.

### Fase 11e — Identificación Médica de Mezclas ✅ (2026-07-23)

Definida en `nuevo-orden.md` (roadmap todavía no fusionado a este archivo): "Analizar Sustancia" revela
los valores exactos de riesgo de una "Mezcla sin identificar", en vez de solo sus tags genéricos.
Confirmado con el operador antes de implementar (minimizando assumptions, CLAUDE.md):
- Cualquier tripulante puede ejecutar la tarea — Médico solo la hace más rápido (GDD línea 242, mismo
  criterio que el resto de `crew-affinity.ts`), sin gate duro por especialidad.
- El radio de combustión revelado se recalcula EN VIVO según el O2 actual de la sección del tripulante
  que tiene la muestra, no un número fijo de peor caso.
- Se incluyó en el alcance de esta fase tanto el fix de un bug bloqueante encontrado en la investigación
  previa como la UI mínima para poder probar la feature de punta a punta (ver abajo).

**Bug de identidad arreglado primero (bloqueante)**: `createUnidentifiedMixture`
(`engine/src/chemistry/reaction/unidentified-mixture-factory.ts`) le ponía a TODA mezcla sin identificar
el mismo id fijo `reaction:unidentified`, sin importar sus tags — una segunda mezcla distinta de la misma
misión pisaba a la primera en el registro. Reemplazado por un id determinístico derivado de la unión
ordenada de tags (`reaction:unidentified:TAG1+TAG2...`, incluyendo nivel para `TOX`/`CORR`) — mezclas con
el mismo conjunto de tags comparten id (misma sustancia, GDD 5.3); conjuntos distintos ya no colisionan.
4 tests nuevos (`unidentified-mixture-factory.test.ts`, no existía antes).

**Motor**:
- `engine/src/chemistry/reaction/mixture-hazard-preview.ts` (nuevo): `deriveMixtureHazardPreview(tags,
  sectionOxygen)`, función pura que reutiliza `COMBUSTION_RADIUS_BY_OXYGEN`/`REACTION_PARAMETERS.corrosion`
  (nunca inventa números nuevos — coherente con "no simular química real" de CLAUDE.md) y replica el
  criterio de `CombustionRule.effectiveOxygen` (tag `OXI` propio fuerza O2 efectivo alto). 6 tests.
- `engine/src/tasks/task.types.ts`: nuevo `TaskType`/`TaskPayload` `"analyze-substance"` +
  `TaskEffectResult.analyzedSubstanceId`. `engine/src/mission/ship-task-effect.ts`: nuevo caso del switch,
  tarea de "revelar" que no muta `shipState`/`atomicStock`. `task-events.types.ts`/`task-scheduler.ts`:
  `analyzedSubstanceId` reenviado en `TaskCompletedEvent`. `task-parameters.ts`: duración base 10s.
- `engine/src/crew/crew-affinity.ts`: `"analyze-substance"` afín a `"medico"`, reutilizando los
  multiplicadores de `stabilize` (0.85/0.65/0.45 por tier) como placeholder ajustable en playtesting.
- Todo exportado desde `engine/src/index.ts`. 8 tests nuevos más entre `ship-task-effect.test.ts`,
  `task-scheduler.test.ts` y `crew.test.ts` (afinidad).

**`/game`**:
- `game/src/mission/mission-runtime.ts`: `analyzedSubstanceIds: Set<ChemicalSubstanceId>` (estado durable,
  distinto del patrón de toast de un solo uso de `obtained` — se re-consulta en cada render, no se empuja
  por evento hacia la UI). `queueAnalyzeSubstance`, `isSubstanceAnalyzed`, `hazardPreviewFor` (recalcula
  contra `sectionCombustionAtmosphere(atmosphereRuntime.atmosphereOf(sectionId))`, ya existente en
  `/engine`, sin necesidad de un getter nuevo).
- **Primer consumidor real de `MissionRuntime.availableSubstances`** (punto 9 de
  `PENDIENTES_OBSERVACIONES.md`, sin consumidor desde la Fase 11c.3): `mission-action-panel.ts` gana una
  variante `"substance"` de `ActionPanelContent` + una lista de sustancias sintetizadas en el estado idle
  (usando `createKenneyList`, mismo widget que el selector de instalación). Cada fila abre la ficha de la
  sustancia (tags genéricos siempre; si ya fue analizada, además las líneas de riesgo exacto) con el botón
  "Analizar sustancia".
- `mission-interaction-controller.ts`: `selectSubstance`, `buildSubstanceDetailLines` (usa la sección del
  tripulante seleccionado como referencia para el O2 en vivo — una sustancia suelta no tiene ubicación
  propia todavía, ver punto 9), `refreshActionPanel` (público, llamado desde `floorplan-scene.ts` en cada
  `task-completed` no-`go-to` para que una síntesis nueva o un análisis recién completado se reflejen sin
  esperar otra interacción manual).
- 6 claves i18n nuevas en `es.ts`/`en.ts` (botón, título de lista, sufijo "(analizada)", líneas de radio de
  combustión/tasa de corrosión, aviso "sin analizar").
- `tsc --noEmit` limpio en `/engine` y `/game`; `vite build` limpio en `/game` (2070 módulos). 518 tests en
  verde en `/engine` (`npx vitest run`, +19 sobre el conteo previo de esta rama).
- Punto 9 de `PENDIENTES_OBSERVACIONES.md` marcado como **parcialmente resuelto**: `availableSubstances` ya
  tiene consumidor; siguen abiertos los otros dos huecos que documenta (reservorio con sustancia+cantidad,
  mecánica de extracción/inventario).
- **Pendiente de validar por el operador**: playtest manual sintetizando dos mezclas sin identificar con
  tags distintos en la misma misión (confirma el fix de identidad), encolando "Analizar Sustancia" con un
  Médico y con otra especialidad (confirma diferencia de duración), y confirmando que el tooltip/ficha pasa
  de tags genéricos a detalle numérico solo tras completarse el análisis.

#### Fix post-cierre (2026-07-23) — no había forma de deseleccionar una celda en el mapa

El operador reportó, durante el playtest manual de esta fase, que un click accidental en una celda vacía
dejaba el panel de acciones pegado en "Instalar aquí" para siempre — sin acceso de vuelta al estado idle
(y por lo tanto sin ver la lista de sustancias). Causa: el diseño original de la Fase 10d asumía que un
cierre manual no hacía falta porque el panel docked "nunca tapa nada" — pero eso no contempló que, sin
selección real, el jugador queda sin forma de volver a idle. Ya existía una clave de traducción sin usar
(`ui.floorplan.mission.inspector.close`) de una fase anterior, nunca conectada a ningún botón. Fix: nuevo
control "✕ Cerrar" en la esquina superior derecha del panel (`mission-action-panel.ts`, visible en
cualquier estado que no sea idle) que llama a un nuevo `ActionPanelCallbacks.onClose`, resuelto en
`mission-interaction-controller.ts` a `setActionPanelContent({kind:"idle"})` (que ya deseleccionaba la
celda, solo faltaba poder dispararlo a mano). `tsc --noEmit`/`vite build` limpios en `/game`. Sin cambios
en `/engine`.

### Fase 11f — Legibilidad del Plano: Capas y Flujo Animado ✅ (2026-07-25)

Definida en `nuevo-orden.md` (roadmap todavía no fusionado a este archivo): toggle de capas del plano en
el HUD + cablear `createConduitFlowEffect()` (hasta ahora solo usado en la escena de debug) al plano real
de misión. Confirmado con el operador antes de implementar (minimizando assumptions, CLAUDE.md):
- El texto de la fase mencionaba una capa "estructural" que no corresponde a ningún `ConduitKind` del
  motor (`ventilacion`/`electrico`/`fluido`/`senal`) — se implementó como un 5º botón de HUD **placeholder**,
  sin overlay ni dato real detrás (ver deuda técnica al cierre).
- Se amplió el alcance de la fase para incluir el trazado real de conductos (polilínea entre secciones
  evitando paredes, reusando el pathfinding ya existente para tripulación) en vez de solo animar sobre el
  punto suelto que había — esto resuelve también la **Observación #1 de `PENDIENTES_OBSERVACIONES.md`**
  ("la conexión es una línea recta... debería seguir el camino viable... y debería haber flujo animado").

**Todo el código vive en `/game`** — no se tocó `/engine` (ninguna regla de dominio nueva, solo consumo
read-only de datos ya expuestos: presión, `unpoweredSectionIds`, `signalGraph`/`outputOf`).

- `game/src/render/conduit-path.ts` (nuevo): `computeConduitPaths(floorplan, walkableGrid?)` — resuelve la
  polilínea de cada conducto entre los centroides de sus dos secciones vía `findPath`/`WalkableGrid`
  (`crew/floorplan-pathfinding.ts`, ya existente para tripulación), simplificada a tramos rectos
  (`simplifyCollinear`, evita un emisor de partículas por celda de BFS). Fallback a línea recta de 2 puntos
  cuando no hay `WalkableGrid` (nave sin tile art) — mismo criterio que ya usa `floorplan-scene.ts` para
  mover tripulación. Cómputo estático por misión, una sola vez.
- `game/src/mission/conduit-flow-heuristics.ts` (nuevo): `conduitFlowIntensity`/`computeSectionSignalActivity`
  derivan intensidad/actividad SIEMPRE de datos reales del motor, nunca inventados — `ventilacion` de
  `pressureKpa` (gradiente entre secciones), `electrico`/`senal` de `unpoweredSectionIds`/`signalGraph`+
  `outputOf` (binario, intensidad fija por falta de granularidad continua en el motor), `fluido` reutiliza
  el mismo booleano de energía que `electrico` a falta de un concepto de caudal real (deuda técnica).
- `game/src/render/floorplan-renderer.ts`: `FloorplanRender` gana `conduitLayers` (un `Graphics` por
  `FloorplanLayerId` — las 4 `ConduitKind` + `"estructural"` vacío) y `conduitPaths`; `renderFloorplan` gana
  un 3er parámetro opcional `walkableGrid`. `drawConduit` se descompuso en `drawConduitLine` (polilínea
  nueva) + `drawConduitMarker` (el círculo/válvula sellada de siempre, sin cambios de lógica).
- `game/src/particles/effects/conduit-flow-effect.ts`: nueva `createConduitPathFlowEffect(path)` — un
  emisor por segmento simplificado del path (no un emisor viajero: Phaser no soporta reposicionar+reangular
  un emisor activo sin que se note el salto). `createConduitFlowEffect` original queda intacta para el demo
  de galería, refactorizada a helpers compartidos (`createFlowEmitter`/`updateFlowEmitter`) sin cambio de
  comportamiento observable.
- `game/src/ui/widgets/floorplan-layer-toggle-panel.ts` (nuevo): 5 botones (`createKenneyButton` +
  `setButtonHighlighted` para el estado activo/inactivo), uno por `FloorplanLayerId`.
- `game/src/scenes/floorplan-scene.ts`: botón "Capas" en el header (abre/cierra un panel flotante, mismo
  patrón que `toggleObjectivesPanel` — la fila de botones del header ya estaba saturada para sumar 5 más
  directo). `toggleFloorplanLayer`/`applyLayerAlpha` atenúan la línea estática (`conduitLayers[layer]
  .setAlpha`) y el flujo animado con el MISMO factor (`CONDUIT_LAYER_INACTIVE_ALPHA`, nueva constante en
  `palette.ts`) — un único sistema de visibilidad, no dos paralelos (texto explícito de la fase).
  `initConduitFlowEffects`/`updateConduitFlowEffects` arrancan y actualizan un efecto por conducto cada
  frame (también en pausa táctica: refleja estado ya calculado, no una simulación que la pausa deba
  congelar — mismo criterio que la cicatriz de sección sin energía). Se reordenó la extracción de
  `walkableGrid` para que ocurra ANTES de `renderFloorplan` (antes era al revés).
- 7 claves i18n nuevas (`es.ts`/`en.ts`): botón "Capas" + label por capa (la de `estructural` incluye
  sufijo "(próximamente)"/"(coming soon)" para que el jugador no lo confunda con un bug).
- `tsc --noEmit` limpio en `/engine` y `/game`; `vite build` limpio en `/game` (2073 módulos); `eslint .`
  limpio sobre los archivos tocados (los 2 errores preexistentes de `mission-interaction-controller.ts` no
  corresponden a esta fase). 518 tests en verde en `/engine` (sin cambios de motor, conteo sin variación).
  Sin tests nuevos en `/game` — consistente con el resto del código de render/HUD del proyecto (0 archivos
  `*.test.ts` en `game/src`).
- **Pendiente de validar por el operador** (smoke test visual manual, sin browser disponible en este
  entorno para correrlo end-to-end): abrir una misión con y sin tile art y confirmar el trazado/fallback;
  togglear cada capa una por una; togglear "estructural" y confirmar que es un no-op visual; provocar una
  diferencia de presión, una cicatriz de energía y una salida de señal real y confirmar que el flujo
  reacciona; confirmar que el demo de galería (`particle-gallery-scene.ts`, tecla E) sigue igual.
- 3 entradas nuevas de deuda técnica agregadas a `PENDIENTES_OBSERVACIONES.md` (capa `fluido` sin caudal
  real, capa `estructural` sin overlay, clave `(a,b,kind)` no garantizada única).

#### Fix post-cierre (2026-07-25) — línea de conducto desconectada del marcador + botón "estructural" desbordado

El operador reportó, tras playtest manual: (1) puntos de ventilación/eléctrico sin línea visible uniéndolos,
(2) fluidos que no se mueven, (3) el botón "estructural (próximamente)" se solapa con "señales".

**(1) Diagnóstico**: `computeConduitPaths` (`conduit-path.ts`) trazaba la polilínea entre los CENTROIDES de
las dos secciones, pero el marcador (`drawConduitMarker`) se dibuja en `conduit.position` — el punto
autorado en Tiled sobre la pared/frontera real entre ambas secciones, que no coincide con el centroide. En
varios conductos el trazado quedaba a suficiente distancia del marcador como para parecer un punto aislado,
sin línea. Verificado contra los 4 mapas reales con un script de reproducción standalone (decodificando el
tile layer base64 de Tiled a mano, replicando `extractWalkableGrid`/`findPath`/`computeConduitPaths`): las
rutas SÍ se calculaban (ninguna degenerada), el problema era puramente que no pasaban por el marcador.
**Fix**: la ruta ahora se arma en 2 tramos — centroide A → `conduit.position` → centroide B — así el
marcador queda siempre sobre la línea (o a lo sumo a una celda, si `conduit.position` cae en una celda no
transitable y `findPath` reubica al vecino transitable más cercano). Además se subió el grosor/opacidad del
trazo (2px/0.8 alpha → 4px/1 alpha, `floorplan-renderer.ts`): a zoom "encajar toda la nave" un trazo fino
quedaba casi invisible contra el ruido de la grilla de fondo.

**(2) Diagnóstico**: revisando los 4 JSON de `engine/src/floorplan/maps/` (capa `conductos` de Tiled), NO
existe ningún objeto `kind=fluido` ni `kind=senal` en ninguna de las 4 naves canónicas — solo `ventilacion`
(10 por nave) y `electrico` (4 por nave). No es un bug: el código de la Fase 11f soporta los 4 tipos, pero no
hay contenido de ese tipo autorado todavía. Documentado como punto 13 de `PENDIENTES_OBSERVACIONES.md`
(tarea de contenido/diseño de nivel, no de motor/render).

**(3) Fix**: el label de "estructural" pasa de "Estructural (próximamente)" a "Estructural" a secas (mismo
largo que el resto de labels, ya no desborda el botón); el aviso "sin overlay todavía" se mueve a un
`setStatus` disparado al hacer click en ese toggle específico (`ui.floorplan.layer.estructural-hint`, nueva
clave i18n), en vez de vivir en el texto fijo del botón.

`tsc --noEmit` limpio en `/game`; `vite build` limpio (2073 módulos); `eslint` limpio sobre los archivos
tocados. Sin cambios en `/engine`.
Razón: feedback de playtest del operador sobre la Fase 11f.

#### Fase 11f.1 — Conductos como infraestructura funcional: cableado de señal restringido por conducto ✅ (2026-07-26)

Extensión de la Fase 11f decidida con el operador tras discutir el modelo: los conductos dejan de ser
capa puramente visual y pasan a ser **la infraestructura de ruteo cross-section**. Decisiones del operador
(no reabrir): (1) una conexión que cruza de una sección a otra va EXCLUSIVAMENTE por el conducto del tipo
que le corresponde; si no hay conducto, esas secciones NO se conectan en esa capa; (2) es una **restricción
real** (mecánica de emergencia), no solo routing visual — habilita mecánicas futuras al poder afectar
conductos. Como el modo cableado solo cablea señales, la restricción aplica a la capa `senal`; el
`electrico` no tiene cableado de jugador que restringir (la energía es cicatriz por sección), así que para
él "pasar por el conducto" es solo lo visual (ya resuelto en 11f).

Hallazgo clave de la investigación previa: el Cap.1 (único jugado de punta a punta) cablea el sensor
(`pasillo-central`) al panel de compuerta (`soporte-vital`) — un cruce cross-section. Como no había
conductos `senal` en ningún mapa, la restricción habría vuelto el Cap.1 insoluble. El operador autoró el
conducto `senal` `pasillo-central`↔`soporte-vital` en `nave-exploracion.json` (Fase A, contenido, a su
cargo) → verificado end-to-end contra datos reales que el cable del Cap.1 ahora se permite y un cruce a una
sección sin `senal` (ej. `propulsion`) se bloquea con el error correcto.

**Motor** (`/engine`):
- `engine/src/floorplan/conduit-connectivity.ts` (nuevo): `sectionsConnectedByConduit` y `findConduitRoute`
  — BFS sobre el grafo de secciones donde las aristas son conductos de un `kind` dado (multi-salto).
  `findConduitRoute` devuelve la secuencia de conductos, reutilizada por el render del cable en `/game`.
  8 tests (`conduit-connectivity.test.ts`).
- `engine/src/workbench/port-wiring.ts`: nueva `assertSignalWiringReachable(floorplan, graph, from, to)` +
  error tipado `SignalWiringUnreachableError` (subclase de `WorkbenchError`, para que `/game` muestre un
  mensaje localizado propio). Vive aparte de `wireExternalPort` (operación pura de grafo, sus 4 tests
  intactos) porque necesita geometría. Intra-sección libre; sección indeterminable → fail-open. 4 tests
  nuevos en `port-wiring.test.ts`.
- `engine/src/mission/ship-task-effect.ts`: el caso `connect` llama a `assertSignalWiringReachable` cuando
  se le inyecta el `floorplan` (nuevo 4º parámetro OPCIONAL de `createShipTaskEffect` — opcional para no
  romper sus ~14 tests con nodos sintéticos; el `MissionRuntime` real siempre lo pasa). Defensa en
  profundidad: el preview del game es el gate de UX que evita encolar un cable inalcanzable.
- Todo exportado desde `engine/src/index.ts`. Engine: 530 tests en verde (+12 sobre 518).

**`/game`**:
- `game/src/mission/mission-interaction-controller.ts`: el preview de cableado llama primero a
  `assertSignalWiringReachable`; si tira `SignalWiringUnreachableError` muestra la clave i18n nueva
  `ui.floorplan.mission.wire-no-conduit`, el resto de errores su texto crudo como antes. (De paso se
  limpiaron 2 imports sin usar preexistentes — `ComponentCondition`/`MaterialProperties` — que eran los
  únicos 2 errores de lint del repo.)
- `game/src/mission/mission-runtime.ts`: pasa `this.shipFloorplan` a `createShipTaskEffect`.
- `game/src/render/conduit-path.ts`: nueva `computeSignalWireRoute` (rutea un cable por los pasamuros de
  los conductos `senal` del cruce, vía `findConduitRoute`) + helper compartido `routeThroughWaypoints`
  (factorizado de `computeConduitPaths`, mismo criterio de tramos/simplificación).
- `game/src/render/mission-overlay-renderer.ts`: el cable de señal (antes recta pura, `lineBetween`) se
  dibuja ruteado por conductos cuando cruza secciones (`drawSignalEdge`); intra-sección o sin plano/grilla
  cae a recta. `renderMissionOverlay` gana `floorplan?`/`walkableGrid?` opcionales; `floorplan-scene.ts` los
  pasa. Cierra del todo la Observación #1 de `PENDIENTES_OBSERVACIONES.md`.
- 1 clave i18n nueva en `es.ts`/`en.ts`.
- `tsc --noEmit` limpio en `/engine` y `/game`; `vite build` limpio; `eslint .` limpio (repo entero, 0
  errores). Verificado end-to-end con specs throwaway contra `CANONICAL_SHIP_FLOORPLANS` reales.
- **Heads-up de contenido (no bloqueante)**: investigación/guerra/médica todavía NO tienen conductos
  `senal`, así que el cableado cross-section de su Cap.1 quedaría bloqueado — pero solo exploración se juega
  de punta a punta hoy (los otros 3 son posiciones de referencia sin verificación visual, ver
  `chapter-01-primer-aviso.ts`). Autorar sus `senal` cuando esos arquetipos entren en testeo real.
- **Pendiente de validar por el operador**: smoke test manual en misión — cablear el sensor al panel del
  Cap.1 (debe permitirse y dibujar el cable ruteado por el conducto), e intentar un cruce a una sección sin
  `senal` (debe rechazarlo con el aviso "No hay conducto de señal entre esas secciones").

#### Fix post-cierre (2026-07-26, Fase 11f.2) — líneas de conducto y cable no pasaban por el marcador

El operador reportó tras playtest: (1) los puntos de conducto coinciden con Tiled pero las líneas no pasan
por ellos (desfasaje); (2) el cable sensor→panel sigue yendo directo por la puerta, no por el conducto.
También preguntó si se usa la capa `anclajes` en el ruteo → **no**, solo se usan conductos, centroides de
secciones, `conduit.position` y la `WalkableGrid`.

**Causa raíz (verificada numéricamente contra `nave-exploracion`)**: `conduit.position` es un punto
FRACCIONAL sobre la pared (ej. celda `8.94,8.95` = píxel `286,286.5`). El código hacía
`roundCell(conduit.position)` = `(9,9)`, lo que rompía dos cosas: (a) el marcador se dibuja en `pos*CELL`
(286) pero la línea en el centro de la celda redondeada (`304`) → ~18px de desfasaje; (b) `(9,9)` cae en el
corredor transitable, así que `findPath` la trataba como un waypoint más y cruzaba por la puerta real
(x=7), ignorando el conducto (x≈9). Ambos síntomas, la misma raíz: el punto fraccional sobre la pared se
redondeaba a una celda de corredor, perdiendo su posición exacta (para dibujar) y su rol de paso (para
rutear).

**Fix (todo en `/game` render, sin tocar `/engine` ni la mecánica de 11f.1)**: `conduit-path.ts` reescrito
para rutear en espacio de PÍXELES con el marcador del conducto como vértice exacto. El cruce de pared se
arma con celdas de aproximación transitables a cada lado del conducto (`nearestSectionCell`); `findPath`
nunca recibe el punto de pared, así que no se desvía por otra puerta. Nuevo tipo `PixelPoint`; helpers
`cellCenterPx`/`conduitPx`/`nearestSectionCell`; `buildRoutedPath` (soporta multi-salto reconstruyendo la
secuencia de secciones desde `findConduitRoute`). `computeConduitPaths`/`computeSignalWireRoute` devuelven
`PixelPoint[]`. Consumidores ajustados a dibujar píxeles directo (sin `+0.5` ni `toPixel`): `drawConduitLine`
(`floorplan-renderer.ts`), `buildSegments`/`createConduitPathFlowEffect` (`conduit-flow-effect.ts`),
`drawSignalEdge` (`mission-overlay-renderer.ts`). `drawConduitMarker` queda igual — ahora la línea llega
justo al punto.

Verificado con script de reproducción contra datos reales: el cable sensor(7,9)→panel(7,6) pasa EXACTO por
el marcador `(286,286.5)` y cruza la pared en x≈8.7 (el conducto), no en x=7 (la puerta). `tsc`/`eslint`/
`vite build` limpios en `/game`; 530 tests en verde en `/engine`.
Razón: feedback de playtest del operador sobre la Fase 11f (desfasaje de coordenadas en el ruteo).

#### Fix post-cierre (2026-07-26, Fase 11f.3) — color del cable, capa `señales`, y partículas invisibles

Tres reportes del operador tras el fix del ruteo:

**(1) Color del cable**: era gris genérico (`0xd8dce8`) → ahora usa `CONDUIT_COLORS.senal` (verde), unificando
cable/conducto/capa. En `mission-overlay-renderer.ts`.

**(2) Pertenencia a la capa `señales`**: el cable no se atenuaba con el toggle de la capa porque las
aristas+nodos se dibujaban en el mismo `graphics` que los componentes, separado de `conduitLayers.senal`.
Se separó el grafo de señal (nodos + cables) a su propio `Graphics` (`signalGraphics`) devuelto por
`renderMissionOverlay`; la escena lo atenúa junto a `conduitLayers.senal` en `applyLayerAlpha("senal")` y lo
reaplica en cada `redrawOverlay` (el overlay se reconstruye por tarea completada). Los componentes físicos
quedan siempre visibles. **Alcance confirmado por el operador**: cables + nodos se atenúan juntos.

**(3) Partículas de flujo invisibles — bug de doble-cámara**: los efectos state-driven (flujo de conducto y
atmósfera) crean sus emisores internamente con `scene.add.particles` y nunca se registraban con la cámara de
mundo, así que la `hudCamera` los pintaba sin scroll y quedaban fuera de lugar/invisibles — el mismo bug ya
documentado para `fireEventEffect` (`floorplan-scene.ts:2139`). Fix: nuevo tipo `ParticleEmitterHook`
(`particle-effect.types.ts`); las factories (`createConduitPathFlowEffect` + los 3 de
`atmosphere-state-effects.ts`) reciben un callback `onEmitterCreated` que la escena
(`registerParticleEmitter`) usa para `setDepth(effect)` + `markAsWorldObject`, idéntico al patrón ya probado
de `fireFabricationEffect`. Corrige de paso el mismo bug latente en los efectos de atmósfera (gas/hielo/vapor,
que hoy solo se ven con hazard).

Sin cambios en `/engine`. `tsc`/`eslint`/`vite build` limpios en `/game`; 530 tests en verde en `/engine`.
Pendiente de validar por el operador: partículas fluyendo por los conductos activos (al menos `electrico`),
cable verde, y que el toggle `señales` atenúe cable+nodos.
Razón: feedback de playtest del operador sobre la Fase 11f (color, capa, y visibilidad de partículas).
### Fix post-cierre 2026-07-26 — Fase 11f.4 (partículas de flujo: causa raíz real)

El fix 11f.3 (registrar emisores con la cámara de mundo) era necesario pero **insuficiente**: el operador
confirmó que ni siquiera los conductos `electrico` (los únicos activos al inicio del cap.1) mostraban flujo.

**Diagnóstico (evaluando el cap.1 de nave-exploración, a pedido del operador):**
- *Condiciones por diseño*: al arrancar, solo `electrico` cumple su condición de flujo (`unpoweredSectionIds`
  vacío). `ventilacion` no fluye (el runtime siembra 101 kPa uniformes → ΔP=0), `senal` tampoco (cable aún no
  creado / emisor sin disparar), y no hay conductos `fluido` autorados. "Nada fluye" es lo esperado para 3 de
  4 tipos; solo eléctrico debía verse.
- *Bug real*: `createFlowEmitter` creaba el emisor SIN `frequency`/`quantity`/`angle` y `updateFlowEmitter` los
  aplicaba con `emitter.setConfig(...)` cada frame. `ParticleEmitter.setConfig` recarga TODOS los ops y los
  ausentes (`scale`/`speed`/`lifespan`) vuelven a su default (scale 1 → partículas de 512px, speed 0 →
  inmóviles). Por eso el flujo era invisible. Los efectos visibles (`spawnBurst`) nunca llaman `setConfig`.

**Fix:** emisor con config de emisión COMPLETO en la creación (emite por `emitting:true`); cambios en vivo con
setters puntuales (`setFrequency`, `setEmitterAngle`) solo cuando el valor cambia (evita resetear el
`flowCounter`). Mismo defecto y arreglo en `createGasLeakEffect`; `createFreezingEffect`/`createHeatVaporEffect`
ya eran correctos. Archivos: `conduit-flow-effect.ts`, `atmosphere-state-effects.ts`. Sin cambios en `/engine`.

**Sembrado explícito de atmósfera inicial** (pedido en la ronda de preguntas): descartado — el runtime ya
siembra `standardSectionAtmosphere()` (101 kPa) por sección, así que sería un no-op que no afecta el flujo.

Sin cambios en `/engine`. `tsc`/`eslint`/`vite build` limpios en `/game`; 530 tests en verde en `/engine`.
Pendiente de validar por el operador: partículas fluyendo por los conductos `electrico` (pasillo-central↔
puente/propulsión/soporte-vital, esclusa-eva↔pasillo, ingeniería↔pasillo).
Razón: la causa raíz de la invisibilidad era `setConfig` borrando ops del emisor, no solo la doble cámara.

### Fix post-cierre 2026-07-26 — Fase 11f.5 (partículas de flujo: tokens viajeros, no rocío)

Feedback visual tras validar 11f.4 (las partículas ya se veían, pero como rocío estacionario por tramo): el
operador pidió partículas que **recorren** el camino completo de punta a punta, arrancando en uno de los 2
extremos del conducto (las 2 secciones que conecta), cubriendo ambos extremos, reiniciándose continuamente.

**Confirmado con el operador:**
- Cobertura de extremos: **dos streams independientes simultáneos** (uno por dirección), no azar ni alternancia.
- Estilo: punto/círculo (mismas texturas de siempre) con **estela corta** (2 fantasmas, alpha decreciente).

**Diseño:** se reemplaza el emisor-por-segmento (`FlowSegment` + `ParticleEmitter` estacionario, eliminados) por
un sistema de "tokens viajeros" — `Image` sueltas con control manual de posición cuadro a cuadro sobre la
polilínea completa (`cumulativeLengths`/`pointAtDistance`, nuevos), NO `ParticleEmitter` (no sigue una
polilínea con curvas nativamente) ni `Curves.Path`/`PathFollower` (sin precedente en el proyecto; el único
similar es el lerp manual punto-a-punto de `crew/hop-movement.ts`, generalizado acá a N puntos). Por conducto:
2 `FlowStream` (path directo + invertido), cada uno con su acumulador de spawn y tope de 4 tokens concurrentes.
La estela usa offset de distancia FIJO (no de tiempo) detrás de la cabeza — mismo efecto visual, sin drift de
framerate. La velocidad de cada token se fija al spawnear: si el conducto se apaga a mitad de camino, el token
termina su viaje a velocidad constante (evita fantasmas congelados si `intensity` cae a 0 en tránsito).

Nuevo tipo `FlowTokenHook` (hermano de `ParticleEmitterHook`) + `registerFlowToken` en `floorplan-scene.ts`
(mismo registro de cámara de mundo/depth de 11f.3). `ConduitFlowState`/`createConduitFlowEffect` (punto fijo,
demo de galería) sin cambios — caso de uso distinto.

Sin cambios en `/engine`. `tsc`/`eslint`/`vite build` limpios en `/game`; 530 tests en verde en `/engine`.
Pendiente de validar por el operador: partículas viajando de punta a punta con estela, tráfico visible en
ambas direcciones a la vez, fade suave en los extremos, flujo nunca vacío mientras el conducto esté activo.
Razón: feedback de playtest del operador sobre el look del flujo animado tras 11f.4.

### Fix post-cierre 2026-07-26 — Fase 11f.6 (tamaño, oculto real por capa, flujo sobre cables)

Tres reportes del operador tras validar 11f.5 (tokens viajeros):

1. **Tamaño**: se veían "muy poco" → cabeza subida de 10 a 18px, fantasmas de 7 a 13/9px, estela reajustada.
2. **Ocultamiento por capa**: antes solo se atenuaba la intensidad (25%) al desactivar una capa, igual que la
   línea estática — confundía la lectura. Ahora `ConduitPathFlowState.visible` fuerza el alpha final a 0 (oculto
   por completo) sin pausar el spawn/avance interno (así el tráfico ya está en curso al reactivar la capa).
3. **Flujo sobre el cable del jugador**: al cablear sensor→panel en el cap.1, no había animación en ESA conexión
   — solo existía para los conductos físicos del mapa, nunca para los `SignalEdge` que arma el jugador. Nuevo
   `syncSignalWireFlowEffects` (`floorplan-scene.ts`) crea/destruye un efecto de flujo por cada `SignalEdge`
   (clave `edge.id`), reutilizando el mismo `computeSignalWireRoute` que ya dibuja el cable estático — la
   animación sigue el MISMO camino exacto. Sincroniza en `create()` y tras cada `redrawOverlay()`
   (`task-completed`), preservando instancias existentes. Nueva `signalWireFlowIntensity(edge, mission)` en
   `conduit-flow-heuristics.ts`: activo si `signalRuntime.outputOf(edge.from)`.

Sin cambios en `/engine`. `tsc`/`eslint`/`vite build` limpios en `/game`; 530 tests en verde en `/engine`.
Pendiente de validar por el operador: tamaño legible, flujo invisible con la capa apagada, y flujo visible en
el cable recién conectado del cap.1.
Razón: feedback de playtest del operador tras 11f.5.

### Fix post-cierre 2026-07-26 — Fase 11f.7 (el flujo se congela en pausa)

El operador confirmó que 11f.6 quedó bien, con un único reporte: el flujo de conductos/cables seguía moviéndose
al apretar "Pausa" (proyectiles y atmósfera sí se congelaban). El criterio previo trataba el flujo como estado
ya calculado (igual que la cicatriz de sección sin energía, que solo parpadea) — pero a diferencia de la
cicatriz, los tokens SE MUEVEN: es una animación de simulación y debe detenerse en pausa, como todo lo demás.
Fix: `updateConduitFlowEffects`/`updateSignalWireFlowEffects` ahora solo corren dentro del
`if (this.mission.coreLoop.mode === "execution")` del loop principal de `floorplan-scene.ts`, igual que
proyectiles y atmósfera. En pausa los tokens quedan congelados en su última posición y retoman el viaje al
reanudar (no se destruyen ni reinician).

Sin cambios en `/engine` ni en `conduit-flow-effect.ts`. `tsc`/`eslint`/`vite build` limpios en `/game`;
530 tests en verde en `/engine`.
Razón: feedback de playtest del operador — coherencia del estado pausa/ejecución.

### Fase 11g — HUD de Estado General de la Nave y Acciones Contextuales ✅ (2026-07-27)

Reemplaza el panel de acciones DOCKED permanente (Fase 10d, `mission-action-panel.ts`) por un HUD de estado
siempre visible (atmósfera/soporte vital/integridad de casco/energía, agregado a nivel de NAVE) y convierte
las acciones (desmontar/instalar aquí/analizar sustancia) en un panel CONTEXTUAL que solo existe ante una
selección/interacción válida.

**Motor — nuevo dominio `engine/src/ship-status/`** (`ship-status.types.ts`, `ship-status-aggregation.ts`,
`ship-status-runtime.ts` + test): hasta esta fase atmósfera (`SectionAtmosphereSnapshot`), integridad
estructural (`StructuralIntegrity`) y energía (`Blueprint.unpoweredSectionIds`) solo existían por
sección/componente, nunca como resumen global. Decisiones de diseño confirmadas con el operador (el texto de
la fase las dejaba explícitamente abiertas):
- **Agregación**: peor caso (worst-case) gana — una sola sección comprometida basta para bajar el indicador
  agregado. `fractionToLevel` reutiliza el mismo corte de 3 niveles que ya usaba `hpBarColor` en
  `crew-strip.ts` (>0.5 nominal, >0.25 warning, resto critical).
- **Energía MVP**: `energy = 1 - (secciones sin energía / total)`, derivado del flag binario existente
  (`unpoweredSectionIds`) — sin simulación de producción/consumo/flujo (no existe ningún `PowerGrid` en el
  motor; construir uno real quedó fuera de alcance, "sentar las bases mínimas" nada más).
- **Soporte vital**: derivado de la misma atmósfera/O2 por sección (respirabilidad), NO del HP de tripulación
  — evita mezclar dos dominios de datos distintos en un solo indicador.
- **Atmósfera**: peor sección según concentración de gas tóxico, reutilizando el umbral letal ya existente en
  `REACTION_PARAMETERS.toxicity` (Espec. §1) — ningún umbral nuevo inventado.
- **Integridad de casco**: peor `structuralResistanceOverride ?? RE de catálogo` entre los componentes
  instalados; `condition === "destroyed"` fuerza crítico.
`ShipStatusQuery` es pull-based (no `Tickable`), con la misma forma de constructor que
`MissionStructuralRuntime` (mismos colaboradores: `MutableShipState`, `ShipFloorplan`,
`MissionAtmosphereRuntime`, registries). Exportado desde `engine/src/index.ts`.

**Juego**: `MissionRuntime` instancia `ShipStatusQuery` y expone `get shipStatus()`. Nuevo widget
`game/src/ui/widgets/ship-status-hud.ts` (4 filas con barra de color por fracción + botón "Sustancias (N)"),
montado en la columna lateral donde antes vivía el panel docked, redibujado solo cuando el snapshot cambia
(throttle por comparación de fracciones redondeadas, salvo un indicador `critical` que parpadea con el mismo
patrón sinusoidal que la cicatriz de sección sin energía). `healthFractionColor` extraída de `crew-strip.ts` a
`palette.ts` para no duplicar el corte de 3 niveles entre ambos widgets.

**Panel de acciones flotante**: `mission-action-panel.ts` se reescribió para construirse en origen LOCAL
(0,0) en vez de coordenadas absolutas — el `Container` devuelto se reposiciona vía `setPosition()` cada frame
(`MissionInteractionController.repositionActionPanel`, llamado desde `updateActionPanelAnchor` en
`floorplan-scene.ts`), siguiendo la celda seleccionada en espacio de pantalla (conversión mundo→pantalla,
inversa de la que ya usan `updateTooltip`/`updateHoverHighlight`) — decisión de UX confirmada con el operador
sobre la opción más simple de panel docked-colapsable, porque el texto de la fase pedía explícitamente que
apareciera "junto a la selección". `MissionInteractionController` gana `hasContextualSelection` (reemplaza el
chequeo `idle` disperso) y ya NO renderiza nada en estado `idle` (antes siempre montado). `isOverFixedUi` gana
un chequeo de bounds del panel flotante — a diferencia del docked (siempre dentro de la columna lateral fija),
este puede flotar SOBRE el mapa, y sin el chequeo un click en sus botones también disparaba `handleMapClick`
sobre la celda de abajo.

**Sustancias sintetizadas**: la lista (antes embebida en el estado `idle` del panel, Fase 11e) se investigó
contra el GDD/código antes de decidir dónde reubicarla — hoy la ÚNICA acción real sobre una sustancia es
"Analizar Sustancia" (no existe mecanismo de "verter en reservorio"/"aplicar a hazard": `ReservoirContent` SÍ
tiene `substanceId`/`amount` en el schema pero ningún flujo de producción lo llena todavía — confirma el punto
9 de `PENDIENTES_OBSERVACIONES.md`, que queda sin resolver, fuera de alcance de esta subfase). La lista pasó a
ser un contenido contextual propio (`ActionPanelContent.kind === "substances-list"`), abierto desde el botón
"Sustancias" del HUD (`MissionInteractionController.openSubstancesList`), reutilizando el mismo panel
flotante en vez de construir un tercer widget o inventar una mecánica de "uso" que el motor no soporta.

**Fixes post-playtest del operador, mismo día**: (1) la lista de sustancias no aparecía pese al conteo
correcto en el botón — `createKenneyList` se construía como objeto top-level en vez de hijo del `container`
flotante, así que no heredaba su `setPosition()` y quedaba fija en el origen de la escena; fix:
`container.add(list)`. (2) el panel de sustancias aparecía en la esquina inferior derecha del mapa, semi-tapado
por la tira de tripulación — el anclaje "sin celda" pasaba por el mismo clamp genérico pensado para seguir una
celda cerca del borde; fix: posición fija dedicada (`SUBSTANCES_PANEL_POSITION`, esquina superior derecha del
viewport de mapa) que no depende del clamp de seguimiento de celda.

Archivos nuevos: `engine/src/ship-status/{ship-status.types,ship-status-aggregation,ship-status-runtime}.ts`
+ test, `game/src/ui/widgets/ship-status-hud.ts`. Modificados: `engine/src/index.ts`,
`game/src/mission/mission-runtime.ts`, `game/src/mission/mission-interaction-controller.ts`,
`game/src/ui/widgets/mission-action-panel.ts`, `game/src/scenes/floorplan-scene.ts`,
`game/src/render/palette.ts`, `game/src/ui/widgets/crew-strip.ts`, `game/src/i18n/{en,es}.ts`.
`tsc`/`eslint` limpios en `/engine` y `/game`; 543 tests en verde en `/engine` (13 nuevos de
`ship-status-aggregation.test.ts`).
Razón: `nuevo-orden.md`, Subfase 11g — infraestructura fundacional que los capítulos 2-8 asumen (HUD de
estado agregado + acciones contextuales), más feedback de playtest del operador sobre la ubicación del panel
de sustancias.

### Fase 11h — Piezas Atómicas de Salida de Información: Indicador LED y Pantalla LCD ✅ (2026-07-28)

Extiende el catálogo atómico (GDD 7.2, `docs/Extension_indicador_led_pantalla_lcd.md`) con el hueco que hoy
impedía aplicar legibilidad total (GDD §11.1) al estado en REPOSO de un nodo, no solo a eventos de transición.

**Motor**: 3 piezas atómicas nuevas en `atomic-component-catalog.ts` — Indicador LED (1×1, `REC`, feedback
binario ON/OFF por tinte en runtime ya existente, GDD 11.0, sin sistema nuevo), Pantalla LCD (2×1, `REC`
independiente, no receta de otras piezas, muestra el VALOR real del nodo cableado, no solo binario), Sensor de
Presión (1×1, `EM`/`triggerType: "pressure"`) — único emisor del catálogo que se evalúa contra el mundo real
(`pressure-emitter-input-source.ts::pressureAwareEmitterInputs`, resuelve por TAG funcional, no por identidad
de componente — principio 1 de CLAUDE.md) en vez de estar siempre activo mientras cableado
(`allEmittersActive`). Nuevo `lcd-display-value.ts::resolveLcdDisplayValue` resuelve qué valor real muestra la
pantalla (hoy: presión de sección). `functional.types.ts` documenta la sub-categoría conceptual "actuador de
salida de información" (LED/LCD no producen trabajo físico, solo visualizan estado de otro nodo) sin agregar
un tag nuevo al esquema existente. Caso de validación 19 — "El Panel de Diagnóstico Improvisado": LCD cableado
al sensor de presión de una sección con fuga de gas activa, mostrando el nivel restante en tiempo real.

**Juego**: `mission-overlay-renderer.ts` expone sprites/texto de LED/LCD por instancia (`ledIndicatorsByInstanceId`
y equivalente de texto LCD) como objetos propios fuera del `graphics` bakeado compartido del resto del overlay
— necesario para poder retintar el LED o actualizar el texto del LCD cada tick sin redibujar todo
(`FloorplanScene.updateLedIndicators`, throttle de 250-500ms para el texto del LCD, no por frame, según pide
el documento fuente). Sprite propio agregado para la Pantalla LCD (`game/assets/sprites/components/
pantalla-lcd.png`); el Indicador LED sigue con placeholder por código (sin sprite propio todavía, señalado
explícitamente por convención de CLAUDE.md).

Archivos nuevos: `engine/src/mission/{pressure-emitter-input-source,lcd-display-value}.ts` + tests,
`engine/src/validation/case-19-panel-diagnostico-improvisado.test.ts`. Modificados:
`atomic-component-catalog.ts`, `functional.types.ts`, `mission-overlay-renderer.ts`, `floorplan-scene.ts`.
Razón: `nuevo-orden.md`, Subfase 11h — cerrar el gap de legibilidad de estado en reposo antes de escalar a más
capítulos con sensores/paneles de diagnóstico.

#### Feedback de playtest manual sobre la Subfase 11h (fuga del Capítulo 1) ✅ (2026-07-28)

El operador jugó el escenario de fuga (Sensor de Presión + LCD + LED + junta hermética rota, Cap.1, arquetipo
Exploración) y reportó 4 hallazgos. Investigados y resueltos 3; el 4º (cablear señal entre secciones sin
conducto `senal` directo falla) se investigó y confirmó que NO es un bug — el BFS de
`assertSignalWiringReachable`/`computeSignalWireRoute` ya soporta multi-salto; la causa real es que solo existe
UN conducto `senal` autorado en todo el juego (nave Exploración, `PENDIENTES_OBSERVACIONES.md` punto 14), y la
restricción de requerir infraestructura `senal` real para cruzar de sección es una decisión INTENCIONAL de la
Fase 11f.1 — confirmado con el operador que se mantiene, sin cambios de código. Hallazgo feliz durante la
investigación del punto 2: la resolución `replacement-installed-connected` (ya existente, verifica
`condition === "ok"` + posición + lista de `componentDefinitionId` aceptables) servía tal cual para el
objetivo formal de la fuga, sin inventar un tipo de resolución nuevo.

1. **HUD sin reflejar la fuga de presión**: `ship-status-aggregation.ts::aggregateAtmosphere` suma un factor
   `pressureFraction = pressureKpa/101` (101 = `standardSectionAtmosphere().pressureKpa`, reutilizada) al
   `worstFraction` ya existente (antes solo miraba concentración de gas tóxico) — decisión del operador:
   sumarlo al indicador "Atmósfera" existente, sin fila nueva de HUD.
2. **Fuga ausente del checklist de sub-objetivos y de la sinopsis**: se formaliza como 3ª resolución del
   Capítulo 1 (AND con las 2 existentes), con clave i18n `crisis.objective.capitulo-1.fuga` y la sinopsis del
   briefing ampliada para mencionarla. Decisión del operador: formalizarla como objetivo real de la crisis
   ahora, revirtiendo la decisión anterior de dejarla como attrezzo puro.
3. **Highlight de instalación solo marcaba 1 celda** (podía tapar overlaps sin querer, bug general no
   específico de esta fase): nuevo `MissionInteractionController.installPickerHighlightCells` resuelve el
   footprint completo de la opción enfocada en el picker de instalación, en la posición donde realmente
   encajaría (`findFittingInstallPlacement`, mismo criterio que ya usa `confirmInstall`).
   `floorplan-scene.ts::updateSelectedHighlight` reescrito a un pool de rectángulos (uno por celda ocupada,
   mismo patrón que `updateWireHighlights`) en vez de un único `Rectangle` de 1×1 fijo.
4. **Pedido adicional del operador, tras revisar el primer intento de plan**: la presión debía recuperarse
   VISIBLEMENTE en el LCD al reparar la junta, no quedar estancada — esto reduce el alcance de una
   "limitación conocida" ya documentada en la implementación original. `seal-breach-pressure-sink.ts` pasa de
   "drena o nada" a bidireccional: nuevo campo `recoveryRateKpaPerSecond` en `SealBreachConfig`, tasa negativa
   cuando la junta está sellada. `MissionAtmosphereRuntime.tick()` gana un clamp de DOS lados
   (`PRESSURE_SINK_FLOOR_KPA` / nueva `PRESSURE_RECOVERY_CEILING_KPA` = atmósfera estándar) para que la
   recuperación no se pase de 101 kPa. **Bug de arquitectura detectado y corregido ANTES de shippear, durante
   la implementación**: la primera versión identificaba "¿está sellada?" por un `instanceId` fijo, pero el
   flujo real de reparación del jugador (desmontar la pieza rota + instalar una de repuesto) crea una
   instancia con un `instanceId` NUEVO — identidad por instanceId nunca vería la reparación. Se rediseñó
   `SealBreachConfig` para identificar por POSICIÓN + lista de `acceptableComponentDefinitionIds`, exactamente
   el mismo criterio que ya usa la resolución de crisis `replacement-installed-connected` (`chapter-01-primer-
   aviso.ts` gana `CHAPTER_01_SEAL_POSITION_BY_ARCHETYPE`/`CHAPTER_01_SEAL_SECTION_ID_BY_ARCHETYPE` por
   arquetipo para sostener esta identidad).
5. **Pedido adicional del operador, tras revisar un segundo intento de plan**: el Indicador LED se enciende en
   VERDE al detectar la fuga — mismo verde que el resto de la paleta reserva para "todo bien" (modo ejecución,
   objetivo cumplido, celda seleccionada), semánticamente al revés para una alarma. Fix acotado a esta subfase:
   `LED_ACTIVE_TINT` pasa de `0x64dc78` a `0xe0a33f` (ámbar de alerta, reutilizado de
   `COMPONENT_CONDITION_TINT.jammed`/`CORE_LOOP_MODE_COLORS.planning`, no un color nuevo), sin tocar
   arquitectura. El operador planteó, para una sesión futura, un MVP real de "componentes configurables"
   (color + condición `>`/`<`/`=` elegible por instancia) — decisión explícita del operador: separarlo, cerrar
   primero lo ya planificado y dejar el MVP configurable para otra sesión con su propio ciclo de preguntas
   (anotado en `PENDIENTES_OBSERVACIONES.md` punto 15 para no perderlo).

Archivos nuevos: `engine/src/validation/case-20-fuga-por-junta-rota.test.ts` (reescrito por completo para
cubrir drenaje Y recuperación real tras desmontar+instalar). Modificados: `engine/src/ship-status/
ship-status-aggregation.ts` + test, `engine/src/crisis/campaign/chapter-01-primer-aviso.ts` + test,
`engine/src/mission/{mission-atmosphere-runtime,seal-breach-pressure-sink}.ts` + test, `engine/src/mission/
chapter-01-mission.integration.test.ts`, `engine/src/crisis/campaign/chapter-01.test.ts`, `engine/src/index.ts`,
`game/src/mission/{mission-interaction-controller,mission-runtime}.ts`, `game/src/scenes/floorplan-scene.ts`,
`game/src/render/palette.ts`, `game/src/i18n/{es,en}.ts`.
`tsc`/`vite build` limpios en `/engine`, `/game` y `/electron`; 99 archivos / 560 tests en verde en `/engine`
(sin regresiones sobre los 543 previos, más los nuevos de esta ronda). Verificación manual del HUD/checklist/
LCD/highlight NO realizada por el agente en esta sesión — sin herramienta de navegador disponible en el
entorno, queda pendiente de confirmación visual por el operador antes del cierre definitivo de la subfase.
Razón: feedback de playtest manual del operador sobre la Subfase 11h recién implementada — antes de darla por
cerrada del todo, hacerla jugable de punta a punta con retroalimentación real de estado de nave, objetivo
formal, recuperación visible y semántica de color correcta.

### Fase 12a — Iluminación Dinámica y Estados de Daño ✅ (2026-07-28)

Primera subfase de la Fase 12 (`nuevo-orden.md`, "Pulido Estructural Sensorial: Luces y Audio"): sistema de
luces aditivas dinámicas, estados de daño de fondo persistentes, y capa "estructural" del HUD del plano —
hasta ahora un botón sin overlay real (`PENDIENTES_OBSERVACIONES.md` punto 11).

**Motor**: cicatriz persistente de sobrecarga eléctrica — `Blueprint.overloadedRefs` (`schemaVersion` 4→5) +
`MissionOverloadRuntime` (`engine/src/mission/mission-overload-runtime.ts`), primer llamador de producción de
`OverloadRule` (existía completa y testeada desde el caso de validación 2, sin ningún runtime que la
ejercitara — mismo punto de partida que tenía `StructuralIntegrity` antes de la Fase 11b). A diferencia de la
corrosión (alimentada por un dato real y continuo, la atmósfera), no existe simulación de carga eléctrica en el
motor: el `load`/`capacityOverride` de cada sobrecarga es dato SCRIPTEADO por la crisis
(`CrisisDefinition.scriptedOverloads`, nuevo campo opcional, ausente = ninguno todavía en ningún capítulo) —
mismo criterio narrativo que `condition: "jammed"` sembrado en el capítulo 1, decisión explícita del operador
tras preguntarlo. Solo el `failureMode "cut"` (corte/cortocircuito, típico de recurso eléctrico) deja cicatriz
visual continua; `"fire"`/`"explosion"` ya tienen su propio burst (`overload-effect.ts`). Segunda pieza de
motor: `aggregateSectionHullIntegrity` (`engine/src/ship-status/ship-status-aggregation.ts`), agregación de RE
POR SECCIÓN (peor caso entre los componentes anclados, mismo criterio que `aggregateHullIntegrity` ya usaba a
nivel nave completa), expuesta vía `ShipStatusQuery.sectionHullIntegrity`.

**Juego**: módulo nuevo de luces aditivas (`game/src/particles/effects/dynamic-light.ts` + `LightHook` en
`particle-effect.types.ts`) generaliza el único precedente existente (`scene.add.pointlight` en
`combustion-effect.ts`, burst temporal) a un helper reusable para bursts y efectos persistentes, resolviendo el
mismo bug de doble-cámara que ya afectaba a los emisores de partículas. `overloaded-conductor-effect.ts`
(`StateDrivenEffect`) dibuja chispas + luz parpadeante en la posición de cada instancia con `ref` en
`overloadedRefs` — cicatriz sin retorno, nunca se detiene, igual que `redrawUnpoweredSectionScar`.
`redrawScreenAlertOverlay` (`floorplan-scene.ts`) agrega un overlay de alerta rojo a pantalla completa
(`hudCamera`, fijo, nuevo depth `RENDER_DEPTH.screenAlert`), disparado por: dominio del `ShipStatusSnapshot` en
`"critical"` (cubre fuga crítica vía atmósfera) o un `overload` con `failureMode` fire/explosion reciente —
"combustión violenta" queda fuera del disparador porque no existe ningún llamador de producción de
`CombustionEvent` en `MissionRuntime` todavía (mismo tipo de hueco que tenía `OverloadRule`, anotado como nuevo
punto 16 en `PENDIENTES_OBSERVACIONES.md`). Capa "estructural" del HUD: `drawStructuralLayer`
(`floorplan-renderer.ts`) tiñe cada sección degradada (ámbar/rojo, `STRUCTURAL_LAYER_COLOR`), redibujada cada
frame desde `floorplan-scene.ts`.

**Fuera de alcance, confirmado con el operador durante la planificación**: intensidad graduada del Indicador
LED (no hay fuente de nivel graduado genérica en el grafo de señales más allá de `VelocityLevel`/MAG, dominio
distinto) — anotado en `PENDIENTES_OBSERVACIONES.md` punto 15.

Archivos nuevos: `engine/src/mission/mission-overload-runtime.ts` + test,
`game/src/particles/effects/{dynamic-light,overloaded-conductor-effect}.ts`. Modificados:
`engine/src/blueprint/blueprint.types.ts`, `engine/src/blueprint/blueprint-serializer.ts` (+ test),
`engine/src/crisis/crisis-definition.types.ts`, `engine/src/ship-status/{ship-status-aggregation,
ship-status-runtime}.ts` (+ test), `engine/src/save/campaign-save-factory.ts`, `engine/src/index.ts`, ~20
fixtures de test que construían un `Blueprint` literal (campo nuevo no opcional), `game/src/particles/
particle-effect.types.ts`, `game/src/render/{palette,render-depths,floorplan-renderer}.ts`,
`game/src/scenes/floorplan-scene.ts`, `game/src/mission/mission-runtime.ts`.
`tsc --noEmit` limpio en `/engine` y `/game`; 100 archivos / 565 tests en verde en `/engine` (sin regresiones).
Verificación manual: servidor de dev de `/game` arranca sin errores (smoke test HTTP), pero SIN verificación
visual interactiva de los efectos (chispas/luz/overlay) — ningún capítulo autora todavía `scriptedOverloads`,
así que el wiring queda inerte en partida real hasta que exista contenido que lo dispare (mismo estado que
tuvieron los conductos `fluido`/`senal` sin autorar tras la Fase 11f). Queda pendiente de confirmación visual
por el operador cuando haya contenido real que lo ejercite.
Razón: `nuevo-orden.md`, Subfase 12a — pulido sensorial antes de escalar a más capítulos, y cierre del hueco de
la capa "estructural" del HUD documentado desde la Fase 11f.

### Fix post-cierre 2026-07-29 — Fase 12a (iluminación invisible en partida real)

Playtest manual del operador tras el cierre de 12a: "no veo luces por ningún lado". Investigación confirmó que
el código de la fase era correcto pero estaba desconectado de cualquier contenido real (mismo patrón que los
conductos `fluido`/`senal` sin autorar, punto 13 de `PENDIENTES_OBSERVACIONES.md`) — 4 causas puntuales,
corregidas todas en esta ronda:

1. **Chispas + luz de conductor sobrecargado sin contenido**: `Blueprint.overloadedRefs` nunca lo poblaba
   ningún capítulo. `chapter-01-primer-aviso.ts` gana un `cable-cobre` sembrado en `ingenieria` (Exploración,
   `{x:22,y:12}` — dentro del bounding box de la sección, sin coincidir con ningún anclaje autorado; NO
   verificado contra la capa de paredes del tilemap, riesgo cosmético bajo dado que es attrezzo puramente
   decorativo) + `scriptedOverloads: [{ instanceId: CHAPTER_01_OVERLOAD_INSTANCE_ID, load: 150 }]` en la
   `CrisisDefinition` (150 > 100 de capacidad del cable → dispara `failureMode: "cut"` de forma determinística
   desde el primer tick de ejecución). Nuevo test de integración
   (`chapter-01-mission.integration.test.ts`) confirma que ambos lados (instancia sembrada + `instanceId`
   scripteado) apuntan a la MISMA referencia — un typo en cualquiera de los dos habría quedado indetectado por
   el chequeo de tipos solo.
2. **Alarma de pantalla completa inalcanzable**: el umbral `"critical"` (fracción ≤0.25) nunca se alcanza en el
   contenido actual (confirmado: la fuga del Cap.1 tiene un piso de `40/101≈0.40` → `"warning"`, nunca
   `"critical"`). Se agrega un disparador nuevo: el INICIO de la crisis también fuerza el overlay
   (`crisisStartAlertUntilSeconds`, `floorplan-scene.ts`). Hallazgo importante durante la corrección: en ambos
   capítulos existentes el trigger YA aplica desde el arranque de la misión (`MissionRuntime` corre un tick
   síncrono de la crisis en su constructor, ANTES de que la escena exista y se suscriba a `crisisEvents`) — si
   el disparador solo escuchara el evento en vivo, nunca se habría visto, repitiendo el mismo bug. Se chequea
   `mission.crisisState === "active"` al crear la escena, ADEMÁS de la suscripción en vivo (para capítulos
   futuros donde el trigger aplique después del arranque).
3. **Golpes eléctricos del Cap.2 sin luz**: `electricArcEffect` (`environmental-damage-effect.ts`) ya disparaba
   partículas reales en cada electrocución, pero sin luz aditiva. Gana un burst de `createDynamicLight` con el
   mismo patrón de tween que `combustion-effect.ts`. `EnvironmentalEffectObject` amplía su unión para incluir
   `PointLight`.
4. **"Parpadeos de luz ambiental en secciones sin energía" nunca implementado**: ejemplo del texto original de
   12a que había quedado fuera. Mismo problema que el punto 1: `unpoweredSectionIds` tampoco lo poblaba ningún
   capítulo. `chapter-01-primer-aviso.ts` gana `unpoweredSectionId: "taller"` (Exploración, sección de attrezzo
   sin rol en el puzzle), sembrado en `campaign-save-factory.ts`. Nueva `PointLight` violeta apagada por sección
   (`UNPOWERED_SECTION_LIGHT_COLOR`, distinto de la cicatriz de sobrecarga — ausencia de energía, no alarma
   activa), parpadeo derivado de la misma curva que ya usa el tinte (`unpoweredSectionLightIntensity`,
   `sectionScarFlickerAlpha` reescalada).

Los otros 3 arquetipos (guerra/investigación/médica) NO reciben `overloadedConductorPosition`/`unpoweredSectionId`
en esta ronda — a diferencia del resto de posiciones de `chapter-01-primer-aviso.ts` (offsets de referencia sin
verificación visual), un `SectionId` inválido podría referenciar una sección inexistente en un mapa no leído
esta sesión; se prefirió dejarlos ausentes antes que inventar un id sin verificar.

Archivos nuevos: ninguno. Modificados: `engine/src/crisis/campaign/chapter-01-primer-aviso.ts`,
`engine/src/save/campaign-save-factory.ts`, `engine/src/mission/chapter-01-mission.integration.test.ts`,
`game/src/particles/effects/environmental-damage-effect.ts`, `game/src/render/palette.ts`,
`game/src/scenes/floorplan-scene.ts`.
`tsc --noEmit` limpio en `/engine` y `/game`; 100 archivos / 566 tests en verde en `/engine` (565 previos + 1
nuevo). Verificación manual: smoke test HTTP del dev server únicamente — sin entorno de navegador disponible en
esta sesión para confirmar visualmente que las luces se ven en partida real; queda pendiente de confirmación
del operador antes de dar el playtest por resuelto del todo. La posición del `cable-cobre` en `ingenieria` NO
se verificó contra la capa de paredes del tilemap (solo contra el bounding box de la sección y los anclajes
autorados) — riesgo cosmético bajo, revisar si aparece incrustado en una pared al jugarlo.
Razón: feedback de playtest manual del operador ("no veo luces por ningún lado") sobre la Fase 12a recién
cerrada — el mecanismo estaba construido y testeado, pero invisible en partida real por falta de contenido que
lo ejerciera.

#### 2ª ronda del mismo playtest (2026-07-29): ajustes de sensación + alcance de sombras

Tras confirmar que las 4 correcciones de arriba funcionaban, el operador reportó 2 ajustes de sensación y una
respuesta a mis preguntas de seguimiento:

1. **Luz del taller demasiado predecible**: `unpoweredSectionLightIntensity` reusaba `sectionScarFlickerAlpha`
   (seno suave, período fijo 1.6s) — se leía como un pulso regular, no una falla real. Reemplazado por
   `flickeringLightIntensity` (`palette.ts`), patrón nuevo: suma de senos a frecuencias inconmensurables +
   umbral que recorta casi todo a 0 — mayormente oscura, con chispazos breves e irregulares ("luz de
   emergencia que quiere prender y no puede"). Determinístico (sin `Math.random()`), con `seed` por sección
   (`sectionFlickerSeed`, `floorplan-scene.ts`) para que dos secciones sin energía no titilen sincronizadas.
2. **Luz del arco eléctrico (electrocución) tapaba el resto del efecto**: radio 60→26px, intensidad pico 1→0.35
   — acompaña el rayo/chispas en vez de taparlos.
3. **Chispas de conductor sobrecargado**: confirmado que SÍ se ven con una partida nueva — el operador no
   encontró un bug, sino que no entendía el propósito narrativo del indicador (es attrezzo puramente
   decorativo, documentado como tal desde que se sembró — no bloquea ningún objetivo del capítulo).
4. **Sombras dinámicas**: pedido nuevo, explícitamente fuera del alcance de 12a — el operador pidió
   planificarlo como una NUEVA subfase (no sprites de sombra estáticos, sombras que reaccionen a las fuentes
   de luz dinámicas ya entregadas). Documentado como "Subfase 12d" en `nuevo-orden.md`, sin implementar —
   requiere su propio ciclo de preguntas (alcance de oclusión real vs. sombreado de superficie, qué proyecta
   sombra, impacto de migrar `dynamic-light.ts` de `PointLight` a `scene.lights` si se opta por Light2D).

Archivos modificados: `game/src/render/palette.ts`, `game/src/scenes/floorplan-scene.ts`,
`game/src/particles/effects/environmental-damage-effect.ts`. Documentación: `nuevo-orden.md` (nueva Subfase
12d, sin implementar). `tsc --noEmit` limpio en `/game`; suite de `/engine` sin cambios (566 tests, no tocado
en esta ronda). Verificación manual: sin navegador disponible en esta sesión, pendiente de confirmación visual
del operador para los ajustes de sensación (1 y 2).

### Fase 12b — Sistema de Audio Diegético ✅ (2026-07-29)

Segunda subfase de la Fase 12 (`nuevo-orden.md`, "Pulido Estructural Sensorial: Luces y Audio"): dominio nuevo
`game/src/audio/` vinculado a `effect-registry.ts` para sonido por fenómeno, y SFX corto que acompaña los barks
de texto por personalidad (ya existentes end-to-end desde antes de esta fase — el objetivo 2 de 12b no era
crear el sistema de barks, solo sonorizar la burbuja ya construida). El operador colocó el pack real
(`game/assets/audio/{UI,gameplay,voices}/`) al arrancar la subfase.

**Arquitectura**: mismo patrón Factory que `particles/effect-registry.ts` — `phenomenon-sound-registry.ts`
(`fireEventSound`, mapa `DomainEvent["kind"] → EventDrivenSound`) vive en paralelo a `EFFECTS_BY_KIND`, sin
tocarlo. `audio-asset-registry.ts` sigue el mismo criterio que `ui-asset-registry.ts` (imports `?url` explícitos,
solo las variantes usadas, no las ~230 del pack completo) + `preloadAudioAssets` llamado en el `preload()` de
las 10 escenas que ya llamaban `preloadUiAssets`. `gas-leak-sound.ts` es el análogo sonoro de
`createGasLeakEffect` (`StateDrivenSound`, loop con volumen ∝ concentración), cableado en
`initSectionAtmosphereEffects`/`updateSectionAtmosphereEffects` junto al efecto de partículas — con `.stop()`
explícito en el `SHUTDOWN` de la escena, porque a diferencia de un `ParticleEmitter` un `Phaser.Sound` vive en
el `SoundManager` del juego, no en la escena, y no se destruye solo al cambiar de escena (bug real detectado y
corregido antes de cerrar, no solo documentado).

**Gaps de asset señalados en código** (mismo criterio que sprites faltantes, CLAUDE.md): el pack no trae siseo
de fuga de gas, zumbido eléctrico continuo, sirena de alarma ni paso sobre piso metálico dedicados —
aproximaciones usadas (`engineCircular` para fuga, `forceField`/`explosionCrunch`/`lowFrequency_explosion` para
sobrecarga, `computerNoise` para alarma, `impactMetal` para instalación/pasos), documentadas en
`audio-asset-registry.ts`. `voices/Female|Male/` queda sin usar — son clips genéricos en inglés que no
corresponden a las líneas i18n de los barks (`engine/src/crew/bark-bank.ts`), usarlos como locución real
requeriría re-grabar, fuera de alcance. Combustión y corrosión (`HazardEvent`) tienen su sonido listo pero
tampoco tienen llamador real en `floorplan-scene.ts` hoy (mismo gap #16 de `PENDIENTES_OBSERVACIONES.md` para
combustión; corrosión tiene el mismo problema, no documentado ahí antes de esta fase) — solo suenan en
`particle-gallery-scene.ts` (demo).

**Ampliación post-cierre (mismo día, playtest manual del operador)**: 5 pedidos nuevos fuera del texto original
de 12b, implementados en la misma ronda para no dejar el playtest a medias:
1. Hover/click de botones en el punto único `createKenneyButton` (`ui/widgets/kenney-button.ts`) — cubre las 10
   escenas de menú y todos los widgets de misión de una sola vez.
2. Click sobre celda del plano (`MissionInteractionController.handleMapClick`).
3. Apertura/cierre de modal (briefing de crisis, picker de instalación).
4. Sonido de instalación completada (`impactMetal`, en el `task-completed` de tipo `install`).
5. Alarma: sin asset de sirena dedicado (`computerNoise` como aproximación), disparada como sonido puntual en
   los mismos 3 puntos donde ya se activaba el overlay de alerta visual de 12a (arranque con crisis ya activa,
   `crisis-triggered` en vivo, `overload` violento) — no un loop continuo nuevo, para no duplicar arquitectura
   sin necesidad.
6. Paso de tripulantes (`impactMetal`, distinto rango de variantes que instalación) en `chainHops`/
   `stepAsideCrewToken`, filtrado por identidad de referencia a `CREW_SIGNATURE` para no sonar en enemigos.

Archivos nuevos: `game/src/audio/{audio-asset-registry,audio-effect.types,audio-utils,bark-sound,
phenomenon-sound-registry}.ts`, `game/src/audio/effects/{overload-sound,combustion-sound,corrosion-sound,
gas-leak-sound}.ts`. Modificados: `game/src/crew/bark-controller.ts`, `game/src/scenes/floorplan-scene.ts`,
`game/src/scenes/particle-gallery-scene.ts`, `game/src/mission/mission-interaction-controller.ts`,
`game/src/ui/widgets/kenney-button.ts`, y el `preload()` de las 9 escenas de menú restantes (`title-scene.ts`,
`options-scene.ts`, `creative-hub-scene.ts`, `pause-menu-scene.ts`, `crew-select-scene.ts`,
`archetype-select-scene.ts`, `crisis-result-scene.ts`, `credits-scene.ts`, `creative-workbench-scene.ts`).
`tsc --noEmit` y `vite build` limpios en `/game`; suite de `/engine` sin cambios (566 tests, no tocado — esta
fase es 100% `/game`). Verificación manual: playtest completo por el operador (dos rondas, la segunda sobre la
ampliación post-cierre) — confirmado sin reportar bugs pendientes al cierre de esta entrada.
Razón: `nuevo-orden.md`, Subfase 12b — feedback diegético de audio antes de escalar a más capítulos; la
ampliación post-cierre respondió directamente al playtest manual del operador sobre el alcance real de "audio
por fenómenos" (UI, movimiento, instalación, alarma no estaban en el texto original de la subfase).

### Fase 12c — Micro-interacciones, Juice y Personalidad de la UI ✅ (2026-07-29)

Tercera subfase de la Fase 12 (`nuevo-orden.md`). Rota en 6 sub-fases por tamaño (9 ítems del texto + 4 deudas
de `PENDIENTES_OBSERVACIONES.md` plegadas: hover visual, iconos de botón, #2 scroll, #5 modal). Casi todo `/game`;
la única excepción que toca `/engine`+save es la deuda #8 (creación con sprites reales, 12c.5).

Decisiones tomadas con el operador (ciclo de preguntas de planificación): #8 incluida como 12c.5; las 4 deudas
plegadas; shader CRT sutil por defecto. Sprites de cursor provistos por el operador en `game/assets/sprites/ui/cursor/`.

- **12c.1 — Fundamentos de juice + botones:** `game/src/ui/ui-effects.ts` nuevo (`popIn`/`slideOut`/`clickReaction`/
  `shake`/`flash`/`attachHoverJuice`). Hover VISUAL en todos los botones (`kenney-button.ts`, antes solo sonido).
  Iconos en botón MESA (`construction-table.png`) y toggle Química (`mixer.png`), registrados en `ui-asset-registry.ts`.
- **12c.2 — Reacciones de retrato:** `crew-strip.ts` centra retratos (origin 0.5), tinte de salud en reposo, expone
  `portraits` por actor. Escena: sacudida+rotación + destello por causa (verde corrosión) al daño, estática analógica
  + apagado en muerte; parpadeo tóxico/corrosivo por overlay persistente (`syncCrewToxicOverlays`, usa `contaminantAt`).
- **12c.3 — Cursor contextual:** `game/src/ui/custom-cursor.ts` nuevo — `setDefaultCursor(url(...))` según estado del
  `MissionInteractionController` (default/selectable/wire/dismantle). Se limpia en el SHUTDOWN de la escena.
- **12c.4 — Pantalla completa:** viñeta radial generada por código reemplaza el tinte plano del overlay de alerta
  (`ensureVignetteTexture`); `game/src/render/crt-pipeline.ts` nuevo — CRT sutil (scanlines + aberración cromática)
  sobre `hudCamera`, solo bajo WebGL (degrada sin romper en Canvas).
- **12c.5 — Satisfacción de deconstrucción:** (a) recolección visible — texto ascendente por elemento + partícula
  coleccionable en arco hacia la mesa (`fireElementCollection`). (b) deuda #8 — `CreationPart[]` en `CompositeComponentData`
  (offset+rotación+footprint por pieza), poblado en `nameAndRegisterCreation` (`calculateFootprintOrigin` nuevo), round-trip
  por el serializer de creación, dibujado en `mission-overlay-renderer.ts::drawCreationLayout` con los sprites reales.
- **12c.6 — Bugs plegados:** #5 nombre de síntesis con `wordWrap` dentro del modal; #2 scroll del selector de instalación
  preservado entre rebuilds (`initialScrollT`/`onListReady`, panel `t`).

`tsc --noEmit` limpio en `/engine` y `/game`; `vite build` limpio; suite de `/engine` 569 tests (3 nuevos de layout de
creación en `custom-creation.test.ts`); eslint limpio. Verificación visual: pendiente de playtest manual del operador
(estándar `/game`, CLAUDE.md).
Razón: `nuevo-orden.md`, Subfase 12c — dar carácter/juice a la UI y cerrar la "satisfacción de deconstrucción" de
Shipbreaker antes de escalar a más capítulos.

### Fase 12c.7 — Fixes de playtest de 12c ✅ (2026-07-29)

Cierre de las 8 observaciones del playtest de 12c. 100% `/game` salvo un cambio chico de motor (recuperar la pieza
atómica al desmontar). Decisiones con el operador: la pieza atómica se recupera al stock (desgaste a futuro);
notificaciones cablean desmantelamiento + síntesis + tarea fallida/bloqueada + objetivo/crisis; posición arriba-centro.

- **A (obs #2)** — cursor custom en UI clickeable: `UI_POINTER_CURSOR_CSS` exportado de `custom-cursor.ts`, aplicado vía
  `setInteractive({ cursor })` en `createKenneyButton`, filas de `kenney-list`/`kenney-card-list`, "✕" del panel de acciones
  y botón de sustancias (antes revertían al puntero chico del sistema).
- **B (obs #1)** — tooltip de misión ahora se ubica ARRIBA del cursor (se volteaba solo si se saldría por arriba), sin taparse.
- **C (obs #6/#7 + PENDIENTES obs #6)** — hover/click en filas de lista y tarjetas de química: sonido (`uiButtonHover`/`Click`)
  + realce de fondo; click en modo cableado suena (`mapCellSelect`).
- **D (obs #3/#4)** — `dismantleEffect` reescrito a "bolas de energía" (orbes cian/dorados aditivos + chispas + luz pulsante
  vía `createDynamicLight`/`lightHook`); motor: desmontar una pieza atómica la acredita al stock y devuelve `obtained` (test).
- **E (obs #5)** — nuevo `game/src/ui/widgets/notification-center.ts` (pila arriba-centro, tipos info/success/warning/error con
  color+sonido, popIn/auto-descarte); cableado: desmantelamiento (lista de obtenidos, reemplaza los toasts por-elemento),
  síntesis/fabricación, tarea fallida/bloqueada, objetivo completado, escalada de crisis. `RENDER_DEPTH.notification=29`.
- **F (obs #8)** — tarjeta de "Resultado" de la mesa: el nombre (`outcome.name`) ahora envuelve, "Mezcla sin identificar" no se sale.

`tsc --noEmit` limpio en `/engine` y `/game`; `vite build` limpio; `/engine` 569 tests (test de "desmontar atómico acredita
stock" actualizado); eslint limpio. Verificación visual pendiente de playtest manual del operador.
Razón: playtest manual de 12c — pulido de cursor/tooltip/listas, unificación del efecto de desmontaje y un sistema de
notificaciones legible pedido por el operador.

**Ajustes de segundo playtest (mismo bloque 12c.7):**
- Timer de tarea pendiente en la cola: se mostraba crudo (`12 × 0.6 = 7.199999999999999`); `crew-queue-panel.ts` ahora
  redondea el estimado (`~7s`).
- Nombre de pieza en el panel de acción contextual se salía de la caja cuando era un token largo sin espacios;
  `mission-action-panel.ts` usa `useAdvancedWrap` en el título para partir la palabra.
- Luz del desmontaje: el operador se refería a las FICHAS que vuelan hacia la mesa, no al efecto del proceso. Se quitó el
  `PointLight`/`lightHook` de `dismantleEffect` (quedan las bolas de energía) y `fireCollectibleToWorkbench` gana un halo
  aditivo pulsante (glow) sobre el núcleo — el HUD no está iluminado, así que la "luz" es blend ADD, no un `PointLight` real.

### Fase 12c.8 — CRT en dos capas + estática localizada + accesibilidad ✅ (2026-07-30)

Ajuste de feedback del operador sobre el CRT (`crt-pipeline.ts`, 12c.4): reestructurarlo en dos capas conceptuales y
cubrir accesibilidad fotosensibilidad. Decisiones tomadas con el operador: CRT a **frame completo** (mundo + HUD, no solo
HUD); estática localizada como **efecto de partículas** (no uniforms de shader); **dos controles** de accesibilidad
separados (estético vs parpadeo/fallo). 100% `/game`, sin tocar `/engine`.

- **Shader parametrizado (`crt-pipeline.ts`):** uniforms `uCrtIntensity`/`uFailure`/`uTime`/`uResolution`/`uViewportSize`
  vía `onPreRender`, en vez de constantes hardcodeadas. Capa "Clean CRT" (scanlines ≤15%, CA base leve, barrel ≤2%, glow
  de fósforo barato de 4 taps) escalada por `uCrtIntensity`; capa "System Failure" (CA fuerte + flicker ~1.9 Hz, bajo el
  umbral WCAG) escalada por `uFailure`. Barrel/scanlines en coords globales de ventana (`gl_FragCoord` + `uResolution`)
  para ser coherentes entre las dos cámaras. Alpha-preserving. A `uCrtIntensity=0` es passthrough.
- **Full-frame (`floorplan-scene.ts`):** `registerCrtPipeline` ahora devuelve la instancia (una por cámara) y se aplica a
  `cameras.main` + `hudCamera`. Driver por frame (`updateCrtDriver`) sube/baja `crtFailureLevel` con ease exponencial según
  la misma condición del overlay de alerta (crítico / overload violento / inicio de crisis, en ejecución), multiplicado por
  el control de flicker → `uFailure`. **Bloom nativo descartado** a favor del glow en shader (una sola mecánica, sin riesgo
  de orden FX-vs-pipeline).
- **Estática de fósforo localizada (`phosphor-static-effect.ts` nuevo):** ruido de fósforo sobre la celda del componente
  averiado (patrón `fireEnvironmentalDamage`: devuelve emisores para que la escena los marque de mundo + depth). Disparada
  en el suscriptor de `failureEvents` (major = ruptura estructural / incendio / explosión; minor = resto), con gate del
  control de flicker (a 0 no aparece). No usa el `effect-registry` (una-por-kind, ya ocupados) — helper dedicado `fireLocalStatic`.
- **Accesibilidad:** `GameSettings` gana `crtIntensity`/`flickerIntensity` (clamp [0,1], defaults 0.7/1.0); store vivo en
  memoria `render/crt-settings.ts` (desacopla lectura por-frame del plano de escritura en vivo del slider); widget nuevo
  `ui/widgets/kenney-slider.ts` (primitivas — el pack Kenney no trae slider); dos sliders en `options-scene.ts` con claves
  i18n `ui.menu.options.crt-intensity`/`flicker-intensity`, persistidos en "Volver".

`tsc --noEmit` limpio en `/game`; `vite build` limpio. Smoke test visual aprobado por el operador.
Riesgo anotado a vigilar en playtest: posible costura de barrel en la frontera del header entre las dos cámaras (barrel
≤2%, mínima) — fallback documentado en el plan = compositar en un `RenderTexture` full-screen y aplicar el pipeline una vez.
Razón: feedback del operador para hacer legible la lectura de componentes sin perder la estética retro, y proteger a
jugadores fotosensibles.

### Fase 12d — Sombras Dinámicas 🚧 (en curso, 2026-07-30)

Ciclo de preguntas de 12d resuelto con el operador: técnica **raycast/oclusión real**; casters = componentes
colocados + objetos de la capa Tiled `objects` + tripulación/enemigos; fuentes = luces dinámicas de 12a +
luz ambiental global. Plan phaseado 12d.1→12d.4 en `~/.claude/plans/revisa-12d-y-dame-logical-charm.md`.

- **12d.1 — Pipeline mínimo (paredes estáticas + luces 12a) ✅:** nuevo subdominio `game/src/render/shadows/`.
  Geometría PURA unit-testeada: `visibility-polygon.ts` (raycast rayo-segmento + polígono de visibilidad por luz,
  recorte al radio) y `occluder-edges.ts` (silueta de segmentos con fusión de tramos colineales, `rectEdges`/
  `worldBorderEdges`, `extractOccluderGrid` = walls ∪ objects). Glue Phaser `dynamic-shadows.ts`
  (`DynamicShadowLayer`): `RenderTexture` del tamaño del mundo rellena de oscuridad, se borra (ERASE) el polígono
  de visibilidad de cada luz → sombra arrojada con oclusión. Integrado en `floorplan-scene.ts` (alta en `create()`,
  registro de luces por el hook `registerLight`, `redraw()` por frame). Depth nuevo `RENDER_DEPTH.dynamicShadows`
  (1.7). 15 tests (`vitest`), script `test` agregado al workspace `game`. `tsc`/`vite build` limpios.
  Smoke visual: **pendiente de playtest del operador** (sin automatización de browser en el entorno).
- **12d.2 — Casters móviles ✅:** `collectDynamicOccluderEdges` suma componentes colocados (footprint real) +
  tokens de tripulación/enemigos (caja chica), recalculado por frame. Objetos Tiled ya eran oclusores estáticos.
- **12d.3 — Luz ambiental global ✅:** `makeGlobalAmbientLight` (pseudo-luz lejana, dirección fija) hace un
  ERASE parcial → sombra base siempre presente; dinámicas restan más encima (clearAlpha ∝ intensidad). Se quitó
  el marco del mundo de los oclusores (bloqueaba a la ambiental exterior). `DYNAMIC_SHADOW_DARKNESS_ALPHA` = 0.5.
- **LED emite luz ✅ (feedback del operador):** `syncLedLight` crea/destruye una `PointLight` corta según el
  estado ON/OFF del LED; registrada por `registerLight`, ilumina y proyecta sombras. Antes solo cambiaba de tinte.
- **Iteración post-playtest (2026-07-30) ✅ código / ⏳ contenido:** el operador jugó 12d.1-12d.3 y reportó 4
  puntos. Se **quitó la ambiental global** (lavaba el contraste → "desaparecieron las sombras") a favor de
  **luces focales autoradas en Tiled**: capa de objetos `luces` (Point + props `color`/`radius`/`intensity`),
  loader `game/src/render/shadows/authored-lights.ts`, instanciadas como `PointLight` reales. Fixes: LED centrado
  y atenuado; conductor sobrecargado con cleanup al desmontar + glow bajado. Falta que el operador **autore la
  capa `luces`** en `nave-exploracion` (esquema comunicado) y haga el smoke.
- **12d.4 — Rendimiento + accesibilidad ✅ (2026-07-31):** slider "Sombras" en Opciones (`GameSettings.shadowIntensity`,
  store vivo `shadow-settings.ts`, persistido, 0 = apagadas) — mismo patrón que los sliders CRT de 12c.8. Perf en
  `DynamicShadowLayer`: cache de polígono de visibilidad por luz (invalidado por `occludersVersion`, que solo
  bumpea cuando los oclusores de verdad cambian → en reposo el redraw es solo re-erase), culling por viewport, y
  short-circuit con el slider en 0. Falta smoke del operador.

**Cierre Fase 12d:** código completo (12d.1–12d.4 + iteración post-playtest). Pendiente de cierre total: que el
operador autore la capa `luces` en los 4 arquetipos y corra el smoke visual final.

### Fase 12f — Fixes de Playtest de 12d ✅ (2026-08-03)

Bucket de 3 fixes puntuales (`nuevo-orden.md`, convención de 12c.7), recogiendo Obs 3 / Obs 7 / deuda #5 de
`PENDIENTES_OBSERVACIONES.md`:

- **Obs 3 (tripulantes se mueven en pausa):** `FloorplanScene.activeHopTweens` trackea los tweens de salto de
  `chainHops`/`stepAsideCrewToken`/el fallback `hopEnemyToken`, pausados/reanudados en `update()` según
  `coreLoop.mode` — mismo criterio que 11f.7 aplicó al flujo de conductos.
- **Obs 7 (fullscreen en negro):** faltaba `scale.parent`/`scale.fullscreenTarget` en `main.ts`. Contenedor
  `#game-root` con tamaño explícito (`index.html`) + `BootScene` forzando `scale.refresh()` en
  `ENTER_FULLSCREEN`/`LEAVE_FULLSCREEN`.
- **Deuda #5 (proyectil suelto sin sprite):** `LooseFerromagneticPromoter.definitionByRef`/`definitionIdForRef`
  conserva el `componentDefinitionId` de catálogo sin ensuciar `ProjectileBody`/`kinetics/`; `projectile-renderer.ts`
  dibuja el sprite real cuando existe.
- **Fix post-QA (mismo día):** el operador reportó la pieza duplicada al validar deuda #5 en partida real (sprite
  fantasma de celda completa + token pequeño). `FloorplanScene.knownProjectileRefs`/`syncNewlyPromotedProjectiles`
  detecta la promoción a proyectil dentro del mismo tick de instalación y fuerza `redrawOverlay()`.

Test unitario nuevo en `loose-ferromagnetic-promoter.test.ts`. Suite completa: 570 tests de `/engine` y 29 de
`/game` verdes, `tsc --noEmit` limpio en ambos workspaces tras ambos fixes. Detalle completo en `changelog.log`
(2026-08-03).

### Fase 12g — Pulido de Pantallas de Selección ✅ (2026-08-03)

Pulido de UI de meta-menú (`nuevo-orden.md`), coherente con 12c. Recoge los ítems de fine-tunning de
`PENDIENTES_OBSERVACIONES.md` sobre las pantallas de selección de tripulación y arquetipo, con alcance
ampliado a `title-scene.ts` (aprobado por el operador).

- **`crew-select-scene.ts`:** reemplaza la lista de botones de texto por una grilla de tarjetas
  (`crew-select-card.ts`, nuevo) — retrato (reutiliza `crew-portrait-registry.ts`), nombre, especialidad/tier,
  rasgo de personalidad, descripción. Las descripciones (`crew.<slug>.description`) ya existían en i18n de una
  fase anterior sin consumidor; se agregaron las claves nuevas `crew.specialty.*`/`crew.trait.*`/`crew.tier.*`.
- **`archetype-select-scene.ts`:** reemplaza los botones por una grilla 2×2 de tarjetas
  (`ship-archetype-card.ts`, nuevo) — nombre propio, arquetipo, descripción, pros/cons. Metadata nueva en
  `game/src/meta/ship-archetype-metadata.ts` (mapa a claves i18n, no texto embebido); copy placeholder
  redactado por Claude (`ship.<archetype>.properName/.description/.pro.N/.con.N`), a reemplazar por el
  operador. Imagen exterior con fallback de color vía `ship-image-registry.ts` (mismo patrón
  `import.meta.glob` que los retratos) — **faltan los 4 sprites reales**, carpeta
  `game/assets/sprites/ships/` creada vacía, ruta esperada `game/assets/sprites/ships/<archetype>.png`.
- **`title-scene.ts` (alcance ampliado):** entrada escalonada (`popIn`) en los 6 botones + `fadeIn` de cámara
  al entrar — antes aparecían sin animación, inconsistente con el resto de la UI ya pulida en 12c. De paso
  corrigió un bug preexistente encontrado en la verificación visual: el botón "Continuar" se crea dentro de un
  `.then()` (necesita `listCampaignSaves()`) y capturaba la variable `y` compartida con el resto de botones
  síncronos — para cuando el microtask corría, `y` ya había avanzado hasta su valor final, así que "Continuar"
  quedaba dibujado encima de "Salir". Se captura ahora en una constante (`continueY`) antes del `await`.
- Ajustes de layout descubiertos en la verificación visual: la tarjeta de arquetipo posicionaba pros/cons con
  un offset fijo (se solapaba con descripciones largas) y en dos columnas lado a lado (una línea larga en
  español desbordaba la mitad del ancho); se cambió a una sola columna vertical con avance dinámico según la
  altura real de cada línea. Altura de tarjeta de tripulante ajustada (130→148px) porque la descripción más
  larga del roster (Kade) se recortaba contra el borde inferior.

Verificado con Playwright headless (Chromium cacheado, sin `chromium-cli` disponible en este entorno): 3
pantallas navegadas de punta a punta (título → arquetipo → tripulación) + interacción de selección múltiple
de tripulantes, sin errores de consola. Suite completa: 570 tests de `/engine` y 29 de `/game` verdes,
`tsc --noEmit` limpio en `/game`. Detalle completo en `changelog.log` (2026-08-03).

## Fase 13 — Gaps de Motor de las Comparativas de Género

### Subfase 13a — Simulación de Emisores y Cascada de Fallas Emergente ✅ (2026-08-04)

Cierra deuda #3 (emisores siempre disparados) y deuda #16 (química sin llamador de producción en misión) de
`PENDIENTES_OBSERVACIONES.md`. Investigación previa reescaló el alcance original de `nuevo-orden.md`: no
existe todavía ninguna fuente real de sustancias químicas vivas en misión (reservorios sin sustancia+cantidad,
ninguna fuga real inserta un `ChemicalSubstanceId` en la atmósfera — bloqueado detrás de Fase 13e), y no
existía ni sensor de movimiento en el catálogo ni línea de visión/raycast en todo el repo. Alcance acordado con
el operador en un ciclo de preguntas: reusar `fotorreceptor`/`triggerType: "optical"` como sensor de presencia,
LOS real con paredes (no solo Manhattan sin bloqueo), y química como infraestructura data-driven (mismo
criterio que `MissionOverloadRuntime`) en vez de esperar a la Fase 13e.

- **Deuda #3 (emisores):** `engine/src/geometry/line-of-sight.ts` (`hasLineOfSight`/`CellBlockedQuery`, raycast
  tipo Bresenham, lógica pura sin Phaser/Tiled) + `engine/src/mission/motion-emitter-input-source.ts`
  (`motionAwareEmitterInputs`, mismo patrón que `pressureAwareEmitterInputs`): un nodo `EM` con
  `triggerType: "optical"` se dispara si algún tripulante/enemigo vivo está a `range` celdas (Manhattan) Y
  tiene línea de visión real. `/game` (`mission-runtime.ts::setMotionBlockedQuery`, llamado desde
  `floorplan-scene.ts` tras `extractWalkableGrid`) inyecta el bloqueo de paredes real del tilemap sin que
  `/engine` conozca Phaser — arranca en "nada bloqueado" (fallback, nave sin tile art) hasta que la escena lo
  setea.
- **Deuda #16 (química):** `CrisisDefinition.scriptedReactions` (`ScriptedReactionSubject`: reactivos +
  `ignitionTrigger`, dato de guion igual que `ScriptedOverloadSubject`) + `engine/src/mission/mission-reaction-runtime.ts`
  (`MissionReactionRuntime`, primer llamador de producción de `ReactionResolver` fuera de la mesa de creación).
  `oxygen` sale de la atmósfera real de la sección (`sectionCombustionAtmosphere`); `ignitionPresent` es real
  para `ignitionTrigger: "overload-bridge"` (el runtime se suscribe a `failureEvents` y resuelve
  `OverloadEvent.ref` → instancia → sección para abrir una ventana de ignición). `CombustionEvent` ganó
  `sectionId?: SectionId` opcional (mismo precedente que `OverloadEvent.ref`) para que `/game` sepa dónde
  pintar el efecto — `CombustionRule` en sí sigue sin conocer el mundo, lo enriquece el runtime al emitir.
- **Cascada emergente:** test de integración (`mission-reaction-cascade.integration.test.ts`) prueba que un
  `ScriptedOverloadSubject` con `failureMode: "fire"` enciende, sin ningún código que los conecte
  explícitamente, un `ScriptedReactionSubject` `"overload-bridge"` en la misma sección — la cascada emerge del
  estado compartido (evento → ventana de ignición → reacción), no de una secuencia scripteada a mano.
- **Wiring en `/game`:** `mission-runtime.ts` gana `reactionEvents`/`reactionRuntime` (mismo patrón que
  `failureEvents`/`overloadRuntime`); `floorplan-scene.ts` suscribe `reactionEvents` — `combustionEffect`/
  `combustionSound` ya existían completos (registrados por `kind: "combustion"`) pero sin llamador real en
  misión, solo demostrados en la galería de partículas; ahora también disparan el overlay de alerta de
  pantalla completa (hueco que el propio texto de la Fase 12a había dejado pendiente).
- **Fuera de alcance, documentado:** reactivos derivados de estado real del mundo (depende de 13e); pieza de
  catálogo "sensor de movimiento" dedicada (se reusa `fotorreceptor`); `EmitterProperty.frequency` sigue sin
  consumidor; `thermalRegulatorOverloaded` sigue fijo en `false` (sin fuente real); el `PointLight` de
  `combustion-effect.ts` sigue sin `LightHook`/`hudCamera.ignore()` — arreglarlo requeriría extender la firma
  de `EventDrivenEffect.trigger` para los ~10 efectos ya registrados, desproporcionado para esta subfase; la
  propia deuda #16 ya lo documentaba como riesgo menor mientras el burst sea corto (300-2000ms), queda abierto.

19 tests nuevos en `/engine` (8 de `line-of-sight`, 5 de `motion-emitter-input-source`, 4 de
`mission-reaction-runtime`, 2 de integración de cascada). Suite completa: 589 tests de `/engine` y 29 de
`/game` verdes, `tsc --noEmit` limpio en ambos workspaces. Detalle completo en `changelog.log` (2026-08-04).

### Subfase 13b — Presupuesto de Energía de la Nave ✅ (2026-08-04)

Realiza el sistema de energía que 11g dejó como stub (`aggregateEnergy` sin `PowerGrid`/`EnergyGrid`).
Dominio nuevo `engine/src/power/` (Gap ③ FTL): presupuesto total = suma de `powerUnits` (nuevo campo de
catálogo, distinto de `capacity`) de las fuentes `RES(E)` instaladas; reparto en dos niveles — (1) global→sección
por asignación manual del jugador (`SectionPowerAllocation`, bloques de unidades enteras) y (2) sección→componente
por prioridad manual (`InstancePowerPriority`), consumiendo el pool de la sección en ese orden vía `powerDraw`
(nuevo campo en `ActuatorProperty`). Excepción deliberada a la escala cualitativa bajo/medio/alto del resto del
motor (§5.2): conteo de unidades, no porcentajes.

- **Dominio puro (`power-allocation.ts`):** `allocateSectionBudget`/`allocateComponentPower`/`reconcilePowerScars`/
  `distributeBudgetEvenly`, funciones testeadas de forma aislada ANTES de integrar (10 tests), incluyendo triaje
  por prioridad con empate determinista por `instanceId` y reconciliación cicatriz-permanente vs. déficit-vivo.
- **`MissionPowerRuntime` (Tickable, `mission-power-runtime.ts`):** molde de `MissionOverloadRuntime` — lee el
  `Blueprint`, recalcula, solo reescribe si cambió. Implementa `PowerScarSource` (reemplaza el objeto inline que
  antes leía `unpoweredSectionIds` directo) y la nueva interfaz `InstancePowerSource` (gating MÁS FINO que
  sección: una instancia puede quedar sin alimentar por triaje interno aunque su sección tenga presupuesto).
  `MissionSignalRuntime.outputOf()` consume ambas.
- **Reconciliación cicatriz-permanente vs. déficit-vivo (decisión del operador):** `Blueprint.unpoweredSectionIds`
  sigue siendo el ÚNICO campo público (un solo campo, recalculado cada tick), pero internamente la cicatriz real
  (Cap.5, sacrificio) vive aparte en `Blueprint.powerState.permanentlyDisconnectedSectionIds` — nunca escrita por
  el reparto vivo — para que el triaje táctico de una sesión de misión no se filtre como cicatriz permanente del
  guardado entre partidas. `unpoweredSectionIds` = `permanentlyDisconnectedSectionIds` ∪ secciones con déficit de
  asignación viva, recalculado cada tick.
- **Schema:** `Blueprint.schemaVersion` 5→6 (`powerState: PowerState` nuevo, requerido con default vacío en el
  deserializador). ~30 fixtures de test migradas en el mismo commit que el bump de tipo.
- **Siembra inicial (decisión del operador, evita romper Cap.1/2):** el diseño cerrado dice "lo no asignado deja
  la sección a oscuras" — aplicado literal con `sectionAllocations` vacío, TODA sección habría arrancado sin
  energía desde el primer tick de cualquier partida nueva, antes de que exista la UI del dial. Resuelto:
  `campaign-save-factory.ts` siembra `sectionAllocations` con `distributeBudgetEvenly` (reparto a partes iguales
  del presupuesto total real entre las secciones), replicando el comportamiento "todo alimentado" que regía antes
  de esta fase — el jugador retriagea con el dial cuando una crisis se lo exija, no desde el arranque.
- **Datos de catálogo:** `powerUnits` autorado en las 8 fuentes `RES(E)` reales (atomic + composite, 4
  arquetipos), valores 1–6 manteniendo el orden relativo de `capacity`. `powerDraw` **deliberadamente sin
  autorar todavía** en ningún componente — ningún capítulo jugable (Cap.1/2) depende hoy de que un actuador se
  apague por energía, y fabricar valores de balance sin diseño de contenido que los use sería una asunción no
  pedida (queda para cuando el Cap.5/Fase 18 lo necesite); el campo es opcional y retrocompatible.
- **UI (`/game`):** nueva capa `"energia"` del toggle de 11f (`drawEnergyLayer`, heatmap rojo=sin energía/
  ámbar=déficit interno, deriva del Eje A de color — no reusa `CONDUIT_COLORS.electrico`). Dial +1/-1 por sección
  (`power-allocation-dial.ts`, primer stepper del proyecto, sin plantilla previa) anclado al centroide de cada
  sección en el plano (no panel de barras abstracto), gateado a modo pausa. Inspector de prioridad
  (`power-priority-list.ts`, lista con botones ↑/↓ por fila — opción más simple, sin drag-and-drop, sin
  precedente de reordenamiento en la UI del proyecto) abierto por sección desde un botón junto al dial.
  `MissionRuntime` gana getters/setters mínimos (`sectionPowerAllocation`, `setSectionPowerUnits`,
  `instancePowerPriorityOrder`, `reorderInstancePriority`, `sectionPowerDemand`, `totalPowerBudget`) para que la
  UI no se acople al runtime completo.
- **Fuera de alcance, documentado:** gating fino por instancia solo consumido en `MissionSignalRuntime` en este
  alcance — `MissionProjectileWorld`/`MissionStructuralRuntime`/task effects quedan para 13c/13d ("pieza viva" =
  recibiendo ≥1 unidad, definición ya exportada con nombre claro para que 13d la reuse). `powerDraw` sin autorar
  (ver arriba). Playtest visual de la capa/dial/inspector pendiente de confirmación del operador (sin
  infraestructura de test visual automatizado en el proyecto, mismo criterio que 11f/12a/12g).

Tests nuevos: 10 de `power-allocation.test.ts`, 4 de `mission-power-runtime.test.ts`, 1 de gating fino en
`mission-signal-runtime.test.ts`, 2 de round-trip/default de `powerState` en `blueprint.test.ts` — 606 tests en
`/engine` (desde 589), 29 en `/game` sin cambios. `tsc --noEmit` limpio y `vite build` limpio en ambos
workspaces. Detalle completo en `changelog.log` (2026-08-04).

**Fix post-playtest del operador (mismo día):** 4 observaciones. (1+2, misma causa) presupuesto 0 al arrancar
(ninguna fuente RES(E) instalada de fábrica) marcaba TODAS las secciones a oscuras → `energy.level: "critical"`
→ disparaba el overlay de alerta Y el CRT a máxima intensidad desde el primer frame — corregido:
`allocateSectionBudget` no marca ninguna sección a oscuras cuando `totalUnits <= 0` (sin economía de energía
real que modelar todavía, mismo criterio de retrocompat que `powerDraw` ausente). (3) dial/botón de prioridad
casi invisibles, tapados por sombras/luces/paredes — el contenedor heredaba el depth `background` (0) de
`floorplanRender.base`; corregido con `setDepth(RENDER_DEPTH.effect)` + `markAsWorldObject` explícito, sin
reparentar a `base`. (4) el listado de botones de capas se salía del panel — `LAYER_PANEL_WIDTH` (700px)
estaba dimensionado para 5 capas, no para las 6 desde que "energia" se sumó; subido a 830px. Test nuevo en
`power-allocation.test.ts`. 607 tests en `/engine` (antes 606, +1), `tsc --noEmit`/`vite build` limpios.
