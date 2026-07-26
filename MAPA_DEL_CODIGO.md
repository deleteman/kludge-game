# Mapa del código

Índice de módulos por dominio — una línea por módulo, actualizado al cerrar cada fase o sub-fase. No es un changelog (eso vive en `changelog.log`); acá solo qué existe y para qué.

## `engine/src/enemies/` (Fase 11d.1)

- `enemy-actor.types.ts` — `EnemyActor`: posición por celda, arquetipo (`armored`/`agile`), referencia a arma de catálogo, state machine de estado.
- `enemy-route.types.ts` — `ScriptedRoute`/`RouteWaypoint`: ruta scripteada determinista por capítulo (celda + tiempo de arribo).
- `route-progression.ts` — `cellAtElapsedSeconds`: resuelve la celda de un enemigo dado el tiempo de misión transcurrido (snap discreto, sin interpolar).
- `weapon-damage.ts` — `weaponDamageSeverity`: traduce `ActuatorProperty.power`/`cadence` a severidad cualitativa de daño.
- `combat-rule.ts` + `rules/melee-adjacency-rule.ts` + `rules/ranged-proximity-rule.ts` + `rules/combat-rule-registry.ts` — Strategy de rango de combate (cuerpo a cuerpo vs. a distancia), mismo molde que `crisis/crisis-rule.ts`.
- `enemy-attack-resolver.ts` — `resolveEnemyAttack`: orquesta arma + reglas + `applyCrewDamage`, sin mutar estado.
- `enemy-events.types.ts` — eventos de dominio (`enemy-advanced`/`enemy-attacked`/`enemy-defeated`), agregados a `DomainEvent`.

## `engine/src/crew/` (modificado, Fase 11d.1)

- `crew-actor.types.ts` — `CrewActor` gana `currentCell?: GridPosition` (posición por celda opcional, compartida con `EnemyActor`).
- `crew-events.types.ts` — `CrewDamageCause` gana la causa `"enemy-attack"`.

## `engine/src/components/catalog/composite/guerra.ts` (modificado, Fase 11d.1)

- Nuevo componente `garra-de-abordaje` — arma cuerpo a cuerpo de referencia (solo `ACT`, sin `EM`), en contraste con `torreta-automatizada` (`EM`+`ACT`, a distancia).

## `engine/src/mission/` (modificado, Fase 11d.2)

- `mutable-enemy-state.ts` — `MutableEnemyState`: espejo de `MutableCrewState` (get/set/all) para el estado vivo de enemigos.
- `enemy-threat-runtime.ts` — `EnemyThreatRuntime` (`Tickable`): avanza rutas y resuelve ataques de enemigo contra la tripulación en cada tick de misión, con cooldown por arma.
- `mission-projectile-world.ts` — `occupantAt` ahora resuelve también contra `crew`/`enemies` opcionales (antes solo componentes colocados) — cierra el punto 4 de `PENDIENTES_OBSERVACIONES.md`.

## `game/src/mission/mission-runtime.ts` (modificado, Fase 11d.2)

- `EnemyThreatRuntime` instanciado y registrado en `coreLoop` (tras `crisisRuntime`, antes de señales/proyectiles); expone `enemyState`/`enemyEvents`; pasa `crewState`/`enemyState` a `MissionProjectileWorld`.

## `game/src/particles/effects/crew-death-effect.ts` (modificado, Fase 11d.2)

- `weaponStrike` — variante mínima de partículas para `cause: "enemy-attack"` (placeholder, distinción por arquetipo/arma diferida a Fase 11d.3).

## `game/src/enemies/enemy-tokens.ts` (nuevo, Fase 11d.3; modificado, fix post-11d.4)

- `createEnemyToken`/`flashEnemyAttack`/`destroyEnemyToken` — token visual de enemigo (rectángulo placeholder por archetipo, distinto de los círculos de tripulación).
- `enemyJumpSignature` — firma de salto por archetipo, para que `floorplan-scene.ts` la use al encadenar hops celda a celda. `hopEnemyToken` (salto directo A→B) quedó como fallback sin grilla transitable, ya no es el camino principal.

## `game/src/render/render-depths.ts` (modificado, Fase 11d.3)

- Nueva capa `enemyEntity: 4.2`, junto a `crewEntity`.

## `game/src/scenes/floorplan-scene.ts` (modificado, Fase 11d.3 + 11d.4 + fix post-11d.4)

- `enemyTokens`, `initEnemyTokens()`, `handleEnemyEvent()` — Observer sobre `mission.enemyEvents` (avance/ataque/derrota de enemigo).
- `travelEnemyToken()`/`enemySegmentDurationMs()` (fix post-11d.4) — encadenan un hop por celda (mismo mecanismo que `travelCrewToken`) repartiendo la duración real del tramo de ruta, en vez del salto directo A→B que se veía como teletransporte. `chainHops` generalizado para aceptar cualquier `HopTarget`/`JumpSignature`, no solo tripulación.
- `update()` (fix post-11d.4, 2da y 3ra ronda) — sincroniza `crewState.currentCell` Y `currentSectionId` CADA FRAME desde la posición visual real del token de tripulación (`sectionContainingCell`), en vez del modelo por-tarea del scheduler (que solo actualiza sección al COMPLETAR un `go-to`, nunca durante un paso visual por una sección de tránsito).

## `engine/src/enemies/campaign/chapter-02-enemy-seed.ts` (nuevo, Fase 11d.4; retocado, fix post-11d.4 2da ronda)

- `CHAPTER_02_INTRUSO` + `CHAPTER_02_INTRUSO_ROUTE` — primer `EnemyActor`/`ScriptedRoute` de contenido real, capítulo 2, arquetipo exploración. `ENEMY_SEED_BY_CHAPTER_ID` — análogo a `CHAPTER_SEED_BY_ID` pero para enemigos. Ritmo de `arrivalSeconds` recalibrado a ~0.33s/celda tras playtest.

## `game/src/mission/mission-runtime.ts` (modificado, Fase 11d.4 + fix post-11d.4)

- Resuelve `ENEMY_SEED_BY_CHAPTER_ID` por `chapterProgress.currentChapterId`; ancla `crewState.currentCell` al centroide de sección solo como valor inicial de arranque (se corrige en el primer frame vía `floorplan-scene.ts::update()`) y lo persiste en `toUpdatedSave`.
- `enemyRoutes` (fix post-11d.4) — expone la `ScriptedRoute` de cada enemigo para que `floorplan-scene.ts` calcule la duración real de cada tramo al animar.

## `engine/src/chemistry/reaction/` (modificado, Fase 11e)

- `unidentified-mixture-factory.ts` — el id de una "Mezcla sin identificar" pasa de un literal fijo (`reaction:unidentified`) a uno determinístico por unión ordenada de tags (incluye nivel para `TOX`/`CORR`); dos mezclas con distinto conjunto de tags ya no colisionan en el registro.
- `mixture-hazard-preview.ts` (nuevo) — `deriveMixtureHazardPreview`: función pura que deriva el radio de combustión (según O2 de sección) y los segundos por nivel de degradación estructural de una mezcla, reutilizando las constantes ya existentes de `reaction-parameters.ts` sin inventar física nueva.

## `engine/src/tasks/` + `engine/src/mission/ship-task-effect.ts` + `engine/src/crew/crew-affinity.ts` (modificado, Fase 11e)

- Nuevo `TaskType`/`TaskPayload` `"analyze-substance"` ("Analizar Sustancia") + `TaskEffectResult.analyzedSubstanceId`, con su caso en `ship-task-effect.ts` (tarea de "revelar", no muta `shipState`/`atomicStock`) y reenvío en `TaskCompletedEvent`.
- `crew-affinity.ts` — `"analyze-substance"` afín a especialidad `"medico"` (GDD: "identifica la composición más rápido"), sin gate duro — cualquier especialidad puede ejecutarla, solo cambia la duración.

## `game/src/mission/mission-runtime.ts` (modificado, Fase 11e)

- `queueAnalyzeSubstance`/`isSubstanceAnalyzed`/`hazardPreviewFor` — estado "analizada" durable en un `Set` (re-consultado en cada render, no un evento de un solo uso); `hazardPreviewFor` recalcula en vivo contra el O2 real de la sección indicada.

## `game/src/ui/widgets/mission-action-panel.ts` + `game/src/mission/mission-interaction-controller.ts` (modificado, Fase 11e)

- Nueva variante `"substance"` de `ActionPanelContent` (ficha + botón "Analizar sustancia") y lista de sustancias sintetizadas en el estado idle (`createKenneyList`) — primer consumidor real de `MissionRuntime.availableSubstances` (punto 9 de `PENDIENTES_OBSERVACIONES.md`, sin consumidor desde la Fase 11c.3).
- `mission-interaction-controller.ts::buildSubstanceDetailLines`/`selectSubstance`/`refreshActionPanel` (público, llamado por `floorplan-scene.ts` en cada `task-completed` no-`go-to`).

## `game/src/render/conduit-path.ts` (nuevo, Fase 11f)

- `computeConduitPaths(floorplan, walkableGrid?)` — polilínea de cada conducto entre los centroides de sus dos secciones, vía `findPath`/`WalkableGrid` (reusa el pathfinding de tripulación de `crew/floorplan-pathfinding.ts`), simplificada a tramos rectos. Fallback a línea recta de 2 puntos sin `WalkableGrid`.

## `game/src/mission/conduit-flow-heuristics.ts` (nuevo, Fase 11f / 11f.6)

- `conduitFlowIntensity`/`computeSectionSignalActivity` — intensidad/actividad de flujo por conducto FÍSICO derivada de datos reales del motor (presión, `unpoweredSectionIds`, `signalGraph`+`outputOf`), nunca inventada; `fluido` reutiliza el booleano de energía de `electrico` a falta de un dato de caudal real (deuda técnica, `PENDIENTES_OBSERVACIONES.md` #10). Fase 11f.6: `signalWireFlowIntensity(edge, mission)` — mismo criterio pero para un `SignalEdge` (cable que arma el jugador): activo si `outputOf(edge.from)`, por NODO en vez de por sección.

## `game/src/render/floorplan-renderer.ts` (modificado, Fase 11f)

- `FloorplanRender` gana `conduitLayers` (un `Graphics` por `FloorplanLayerId`, exportado junto a `FLOORPLAN_LAYER_IDS`) y `conduitPaths`; `renderFloorplan` gana un 3er parámetro opcional `walkableGrid`. `drawConduit` descompuesto en `drawConduitLine` (polilínea nueva) + `drawConduitMarker` (círculo/válvula sellada de siempre).

## `game/src/particles/effects/conduit-flow-effect.ts` (modificado, Fase 11f / 11f.4 / 11f.5 / 11f.6)

- `createConduitPathFlowEffect(path, onTokenCreated?)` — Fase 11f.5: reescrito de emisor-por-segmento a "tokens viajeros" (`Image` con posición manual sobre la polilínea completa vía `cumulativeLengths`/`pointAtDistance`, no `ParticleEmitter`). 2 `FlowStream` simultáneos por conducto (path directo + invertido) cubren ambos extremos como origen; cada token tiene cabeza + 2 fantasmas de estela (offset de distancia fijo) y fade en los extremos; velocidad fijada al spawnear (el token en tránsito termina su viaje aunque el conducto se apague). El hook `FlowTokenHook` registra cada `Image` con la cámara de mundo (11f.3). `createConduitFlowEffect` (punto fijo, demo de galería) y `createFlowEmitter`/`flowFrequency`/`flowQuantity` (fix 11f.4: config de emisión completo, setters puntuales en vez de `setConfig`) siguen siendo el emisor-rocío de siempre, sin cambios. Fase 11f.6: `HEAD_SIZE_PX`/`GHOST_SIZES_PX` subidos (10/7→18/13/9, se perdían contra el fondo); `ConduitPathFlowState.visible` — el toggle de capa fuerza el alpha final a 0 (oculto real, no solo atenuado) sin pausar el spawn/avance interno.

## `game/src/ui/widgets/floorplan-layer-toggle-panel.ts` (nuevo, Fase 11f)

- `renderFloorplanLayerTogglePanel` — 5 botones de toggle (`createKenneyButton`+`setButtonHighlighted`), uno por `FloorplanLayerId` (4 `ConduitKind` reales + `"estructural"` placeholder).

## `game/src/scenes/floorplan-scene.ts` (modificado, Fase 11f / 11f.6 / 11f.7)

- Botón "Capas" en el header abre/cierra un panel flotante (mismo patrón que `toggleObjectivesPanel`). `toggleFloorplanLayer`/`applyLayerAlpha` atenúan la línea estática (`CONDUIT_LAYER_INACTIVE_ALPHA`, `palette.ts`); el flujo animado en cambio se OCULTA por completo vía `ConduitPathFlowState.visible` (11f.6, no comparte el mismo factor de atenuación). `initConduitFlowEffects`/`updateConduitFlowEffects` arrancan y actualizan un `createConduitPathFlowEffect` por conducto FÍSICO. `walkableGrid` ahora se extrae antes de `renderFloorplan` (antes al revés). Fase 11f.6: `signalWireFlowEffects`/`syncSignalWireFlowEffects`/`updateSignalWireFlowEffects` — mismo patrón pero uno por `SignalEdge` (cable dinámico del jugador, clave `edge.id`), sincronizado en `create()` y tras cada `redrawOverlay()`. Fase 11f.7: `updateConduitFlowEffects`/`updateSignalWireFlowEffects` en el `update()` principal ahora solo corren dentro de `coreLoop.mode === "execution"` (antes corrían siempre) — los tokens en viaje se congelan en pausa, igual que proyectiles/atmósfera.

## `engine/src/floorplan/conduit-connectivity.ts` (nuevo, Fase 11f.1)

- `sectionsConnectedByConduit`/`findConduitRoute` — BFS sobre el grafo de secciones donde las aristas son conductos de un `kind` dado (multi-salto). Base de la mecánica de cableado restringido; `findConduitRoute` (devuelve la secuencia de conductos) la reusa el render del cable en `/game`.

## `engine/src/workbench/port-wiring.ts` (modificado, Fase 11f.1)

- `assertSignalWiringReachable(floorplan, graph, from, to)` + `SignalWiringUnreachableError` — regla de misión: un cable de señal solo cruza de sección a sección si hay camino de conductos `senal`. Vive aparte de `wireExternalPort` (operación pura de grafo) porque necesita geometría.

## `engine/src/mission/ship-task-effect.ts` (modificado, Fase 11f.1)

- `createShipTaskEffect` gana un 4º parámetro OPCIONAL `floorplan`; el caso `connect` valida `assertSignalWiringReachable` cuando se lo inyectan (el `MissionRuntime` real siempre lo pasa; opcional para no romper los tests unitarios).

## `game/src/render/conduit-path.ts` (modificado, Fase 11f.1)

- `computeSignalWireRoute` (rutea un cable de señal por los pasamuros de los conductos `senal` del cruce, vía `findConduitRoute`) + `routeThroughWaypoints` (helper compartido factorizado de `computeConduitPaths`).

## `game/src/render/mission-overlay-renderer.ts` (modificado, Fase 11f.1)

- El cable de señal se dibuja ruteado por conductos cuando cruza secciones (`drawSignalEdge`), no en recta; `renderMissionOverlay` gana `floorplan?`/`walkableGrid?`. Cierra la Observación #1.

## `game/src/render/conduit-path.ts` (reescrito, Fase 11f.2)

- Ruteo en espacio de PÍXELES (`PixelPoint`) con el marcador del conducto como vértice exacto; el cruce de pared usa celdas de aproximación transitables (`nearestSectionCell`) en vez de redondear el conducto a celda. `buildRoutedPath` (multi-salto vía `findConduitRoute`) reemplaza a `routeThroughWaypoints`. `computeConduitPaths`/`computeSignalWireRoute` devuelven `PixelPoint[]`. Corrige el desfasaje línea/marcador y que el cable cruzara por la puerta en vez del conducto.

## `engine/src/ship-status/` (nuevo, Fase 11g)

- `ship-status.types.ts` — `ShipStatusLevel` (`nominal`/`warning`/`critical`), `ShipStatusIndicator` (`level`+`fraction`), `ShipStatusSnapshot` (atmósfera/soporte vital/integridad de casco/energía).
- `ship-status-aggregation.ts` — `fractionToLevel` (corte de 3 niveles, mismo criterio que `hpBarColor` de `crew-strip.ts`) + `aggregateAtmosphere`/`aggregateLifeSupport`/`aggregateHullIntegrity`/`aggregateEnergy`: agregación a NIVEL DE NAVE con criterio "peor sección/componente gana", reutilizando umbrales ya existentes (`REACTION_PARAMETERS.toxicity`, `RE_ORDER`) — ningún umbral nuevo.
- `ship-status-runtime.ts` — `ShipStatusQuery`: consulta pull-based (no `Tickable`), mismos colaboradores que `MissionStructuralRuntime` (`MutableShipState`, `ShipFloorplan`, `MissionAtmosphereRuntime`, registries de componentes/químicos).

## `game/src/ui/widgets/ship-status-hud.ts` (nuevo, Fase 11g)

- `renderShipStatusHud` — HUD de estado permanente: 4 filas (atmósfera/soporte vital/integridad de casco/energía) con barra de color por fracción (`healthFractionColor`, `palette.ts`) + parpadeo en `critical` (`sectionScarFlickerAlpha`) + botón "Sustancias (N)".

## `game/src/mission/mission-runtime.ts` (modificado, Fase 11g)

- `ShipStatusQuery` instanciado junto a `atmosphereRuntime`/`structuralRuntime`; expone `get shipStatus(): ShipStatusSnapshot` (pull-based, se recalcula en cada lectura).

## `game/src/mission/mission-interaction-controller.ts` (modificado, Fase 11g)

- El panel de acciones deja de ser DOCKED permanente: `hasContextualSelection` (reemplaza el chequeo `idle` disperso), `openSubstancesList()` (nuevo contenido `substances-list`, antes embebido en `idle`), `repositionActionPanel(point)` (reposiciona el `Container` ya construido, llamado cada frame por la escena). `redrawActionPanel` ya no monta nada en estado `idle`. `MissionInteractionGeometry` pierde `actionPanelX/Y` (el panel flota, no tiene posición fija).

## `game/src/ui/widgets/mission-action-panel.ts` (reescrito, Fase 11g)

- `renderMissionActionPanel` se construye en origen LOCAL (0,0) en vez de coordenadas absolutas — el llamador reposiciona el `Container` devuelto vía `setPosition()`. Nuevo contenido `ActionPanelContent.kind === "substances-list"` (antes vivía embebido en `idle`); `idle` ya no renderiza la lista de sustancias, solo mensaje corto.

## `game/src/scenes/floorplan-scene.ts` (modificado, Fase 11g)

- `redrawShipStatusHud()` — monta/redibuja el HUD permanente en el espacio que antes ocupaba el panel docked, con throttle por cambio de valor (redibuja siempre si algún indicador está `critical`, para animar el parpadeo). `updateActionPanelAnchor()` — convierte la celda seleccionada a coordenadas de pantalla (inversa de `cameras.main.getWorldPoint`) y reposiciona el panel flotante cada frame; sin celda (abierto desde el botón "Sustancias"), usa una posición fija dedicada (`SUBSTANCES_PANEL_POSITION`) en vez del clamp de seguimiento de celda. `isOverFixedUi` gana un chequeo de `actionPanelBounds` (el panel flotante puede estar sobre el mapa, a diferencia del docked).

## `game/src/render/palette.ts` (modificado, Fase 11g)

- `healthFractionColor` — extraída de `crew-strip.ts` (antes `hpBarColor` local) para que el nuevo HUD de estado use el mismo corte de 3 niveles sin duplicar la función.
