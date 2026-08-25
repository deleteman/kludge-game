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

## `engine/src/components/catalog/atomic-component-catalog.ts` + `engine/src/properties/functional.types.ts` (modificados, Fase 11h)

- 3 piezas atómicas nuevas: Indicador LED (1×1, `REC`, feedback binario), Pantalla LCD (2×1, `REC`, muestra valor real vía `lcd-display-value.ts`), Sensor de Presión (1×1, `EM`/`triggerType: "pressure"`). `functional.types.ts` documenta la sub-categoría conceptual "actuador de salida de información" (LED/LCD no producen trabajo físico, solo visualizan estado) sin agregar un tag nuevo al esquema.

## `game/src/render/mission-overlay-renderer.ts` (modificado, Fase 11h)

- Expone `ledIndicatorsByInstanceId`/(texto LCD por instancia): sprites/texto propios fuera del `graphics` bakeado del resto del overlay, para poder retintar el LED o actualizar el texto del LCD cada tick sin redibujar todo (`FloorplanScene.updateLedIndicators`, throttle de 250-500ms para el LCD).

## `engine/src/mission/pressure-emitter-input-source.ts` (nuevo, Fase 11h)

- `pressureAwareEmitterInputs` — resuelve la entrada de un emisor de señal por TAG funcional (`EM`/`triggerType==="pressure"`), no por identidad de componente (principio 1 de CLAUDE.md): busca el sensor de presión cableado a un nodo emisor y compara la presión real de su sección (`atmosphereOf`) contra el umbral configurado en su definición.

## `engine/src/mission/lcd-display-value.ts` (nuevo, Fase 11h)

- `resolveLcdDisplayValue` — resuelve qué valor real muestra una Pantalla LCD según la propiedad del nodo cableado (hoy: presión de sección); mismo criterio de resolución por tag, no por id de componente.

## `engine/src/mission/seal-breach-pressure-sink.ts` (nuevo, Fase 11h; reescrito, feedback de playtest 2026-07-28)

- `sealBreachPressureSink` — `SectionPressureSinkSource` que drena la sección mientras la junta hermética del escenario de fuga del Capítulo 1 está rota, y RECUPERA (tasa negativa) en cuanto vuelve a estar sellada. Identifica "¿está sellada?" por POSICIÓN + lista de `componentDefinitionId` aceptables (`SealBreachConfig`), no por `instanceId` — el flujo real de reparación del jugador (desmontar + instalar) crea una instancia nueva, así que identidad por instanceId nunca vería la reparación (mismo criterio que la resolución de crisis `replacement-installed-connected`).

## `engine/src/mission/mission-atmosphere-runtime.ts` (modificado, Fase 11h; feedback de playtest 2026-07-28)

- `tick()` aplica el `sinkSource` con clamp de DOS lados: `PRESSURE_SINK_FLOOR_KPA` (piso de fuga) y la nueva `PRESSURE_RECOVERY_CEILING_KPA` (techo = atmósfera estándar, 101 kPa) — antes la presión solo podía caer, nunca recuperarse sola.

## `engine/src/crisis/campaign/chapter-01-primer-aviso.ts` (modificado, feedback de playtest 2026-07-28)

- 3ª resolución del Capítulo 1 (`replacement-installed-connected`, anclada en `sealPosition`): reparar la junta hermética pasa de attrezzo puro a objetivo FORMAL de la crisis. Nuevos exports por arquetipo: `CHAPTER_01_SEAL_POSITION_BY_ARCHETYPE`, `CHAPTER_01_SEAL_SECTION_ID_BY_ARCHETYPE`, `CHAPTER_01_SEAL_ACCEPTABLE_COMPONENT_IDS`, tasas de drenaje/recuperación.

## `engine/src/ship-status/ship-status-aggregation.ts` (modificado, feedback de playtest 2026-07-28)

- `aggregateAtmosphere` suma un factor `pressureFraction = pressureKpa / 101` al `worstFraction` ya existente (antes solo miraba concentración de gas tóxico) — una fuga de presión sin gas tóxico ahora también degrada el indicador "Atmósfera" del HUD.

## `game/src/mission/mission-interaction-controller.ts` (modificado, feedback de playtest 2026-07-28)

- `installPickerHighlightCells` — footprint completo (todas las celdas ocupadas) de la opción enfocada en el picker de instalación, resuelto en la posición donde realmente encajaría (`findFittingInstallPlacement`, mismo criterio que `confirmInstall`) — antes el resaltado de instalación solo marcaba 1 celda, pudiendo tapar overlaps sin querer.

## `game/src/scenes/floorplan-scene.ts` (modificado, feedback de playtest 2026-07-28)

- `updateSelectedHighlight()` reescrito: pool de rectángulos (uno por celda ocupada, mismo patrón que `updateWireHighlights`) en vez de un único `Rectangle` de 1×1 fijo — pinta el footprint completo del picker de instalación cuando está abierto, o la celda seleccionada simple si no.

## `game/src/render/palette.ts` (modificado, feedback de playtest 2026-07-28)

- `LED_ACTIVE_TINT` cambia de verde (`0x64dc78`, reservado en el resto de la paleta para "todo bien") a ámbar de alerta (`0xe0a33f`, reutilizado de `jammed`/`planning`) — un LED de alarma en verde era semánticamente al revés. Fix acotado, sin tocar arquitectura; el MVP de color/condición configurable por instancia queda pendiente (`PENDIENTES_OBSERVACIONES.md` punto 15).

- `healthFractionColor` — extraída de `crew-strip.ts` (antes `hpBarColor` local) para que el nuevo HUD de estado use el mismo corte de 3 niveles sin duplicar la función.

## `engine/src/mission/mission-overload-runtime.ts` (nuevo, Fase 12a)

- `MissionOverloadRuntime` — primer llamador de producción de `OverloadRule`; evalúa sobrecarga scripteada por contenido (`ScriptedOverloadSubject`, sin simulación de carga eléctrica real en el motor) y escribe la cicatriz `Blueprint.overloadedRefs` cuando `failureMode === "cut"`.

## `engine/src/blueprint/blueprint.types.ts` / `blueprint-serializer.ts` (modificado, Fase 12a)

- `Blueprint.overloadedRefs: ReadonlyArray<PlacedComponentInstanceId>` — cicatriz de sobrecarga, `schemaVersion` 4→5, con default `[]` en la migración de saves antiguos.

## `engine/src/crisis/crisis-definition.types.ts` (modificado, Fase 12a)

- `CrisisDefinition.scriptedOverloads?: ReadonlyArray<ScriptedOverloadSubject>` — fuente de `load`/`capacityOverride` para `MissionOverloadRuntime`, dato de guion (ausente = ningún capítulo lo usa todavía).

## `engine/src/ship-status/ship-status-aggregation.ts` / `ship-status-runtime.ts` (modificado, Fase 12a)

- `aggregateSectionHullIntegrity` + `ShipStatusQuery.sectionHullIntegrity` — integridad de casco de UNA sección (peor caso entre sus componentes anclados), consumida por la capa "estructural" del HUD del plano.

## `game/src/particles/effects/dynamic-light.ts` (nuevo, Fase 12a)

- `createDynamicLight` — generaliza el único precedente de luz aditiva del proyecto (`pointlight` en `combustion-effect.ts`) a un helper reusable para bursts y efectos persistentes, con `LightHook` (`particle-effect.types.ts`) para el registro contra `hudCamera.ignore()`.

## `game/src/particles/effects/overloaded-conductor-effect.ts` (nuevo, Fase 12a)

- `createOverloadedConductorEffect` — `StateDrivenEffect` de chispas + luz parpadeante en la posición de un conductor/reservorio sobrecargado; cicatriz sin retorno, nunca se detiene (`overloadedConductorFlickerIntensity`, `palette.ts`).

## `game/src/render/floorplan-renderer.ts` (modificado, Fase 12a)

- `drawStructuralLayer` — puebla `conduitLayers.estructural` (vacío desde la Fase 11f) con el tinte de RE degradado por sección (`STRUCTURAL_LAYER_COLOR`), redibujado cada frame por `floorplan-scene.ts`.

## `game/src/scenes/floorplan-scene.ts` (modificado, Fase 12a)

- `syncOverloadedConductorEffects` — crea/actualiza un efecto por instancia en `overloadedRefs`, nunca los remueve. `redrawScreenAlertOverlay` — overlay de alerta roja de pantalla completa (`hudCamera`), disparado por `ShipStatusSnapshot` crítico o un `overload` violento reciente; "combustión violenta" queda fuera del disparador (`CombustionEvent` sin llamador de producción, ver `PENDIENTES_OBSERVACIONES.md` punto 16).

## `engine/src/crisis/campaign/chapter-01-primer-aviso.ts` (modificado, fix post-cierre Fase 12a)

- `CHAPTER_01_OVERLOAD_INSTANCE_ID` + `overloadedConductorPosition`/`unpoweredSectionId` (solo Exploración) — siembran un `cable-cobre` real + `scriptedOverloads`/`unpoweredSectionId` para que la iluminación dinámica de 12a sea verificable jugando, no solo en tests.

## `game/src/particles/effects/environmental-damage-effect.ts` (modificado, fix post-cierre Fase 12a)

- `electricArcEffect` gana un burst de `createDynamicLight` en el punto de impacto — antes solo partículas, sin luz aditiva. `EnvironmentalEffectObject` amplía su unión para incluir `PointLight`.

## `game/src/scenes/floorplan-scene.ts` (modificado, fix post-cierre Fase 12a)

- `syncUnpoweredSectionLights` — `PointLight` violeta apagada por sección sin energía, una por sección, nunca removida. `crisisStartAlertUntilSeconds` — el overlay de alerta global también se dispara al inicio de la crisis (chequeado tanto de forma síncrona en `create()` como vía el evento `crisis-triggered` en vivo, porque el trigger de los capítulos actuales ya aplica antes de que la escena exista).

## `game/src/audio/` (nuevo, Fase 12b)

- `audio-asset-registry.ts` — tabla `key → URL` del pack real (`game/assets/audio/`), imports `?url` solo de las variantes usadas, `preloadAudioAssets` (mismo patrón que `ui-asset-registry.ts`). `AUDIO_KEYS` documenta los gaps de asset (sin siseo de fuga, zumbido eléctrico continuo, sirena ni paso metálico dedicados).
- `audio-effect.types.ts` — `EventDrivenSound`/`StateDrivenSound`, análogos sonoros de `particles/particle-effect.types.ts`.
- `phenomenon-sound-registry.ts` — `fireEventSound`, mapa Factory `DomainEvent["kind"] → EventDrivenSound` en paralelo a `EFFECTS_BY_KIND` (`particles/effect-registry.ts`); cubre `overload`/`combustion`/`corrosive-exposure`.
- `audio-utils.ts` — `pickSoundKey`, análogo sonoro de `pickTexture` (variante al azar de una familia).
- `bark-sound.ts` — `playBarkSound`, SFX corto por categoría de `BarkEventType` que acompaña la burbuja de texto ya existente (`bark-controller.ts`), no voz hablada.
- `effects/overload-sound.ts`, `effects/combustion-sound.ts`, `effects/corrosion-sound.ts` — sonido event-driven gemelo de sus respectivos `particles/effects/*.ts`.
- `effects/gas-leak-sound.ts` — `createGasLeakSound`, loop ambiental state-driven gemelo de `createGasLeakEffect` (volumen ∝ concentración), cableado en `floorplan-scene.ts::sectionAtmosphereEffects` con `.stop()` explícito en `SHUTDOWN` (un `Phaser.Sound` no se destruye solo al cambiar de escena).

## `game/src/crew/bark-controller.ts` (modificado, Fase 12b)

- `fire()` reproduce `playBarkSound` junto a la burbuja de texto.

## `game/src/ui/widgets/kenney-button.ts` (modificado, Fase 12b — ampliación post-playtest)

- Único punto de creación de botones rexUI: gana sonido de hover (`pointerover`) y click (`pointerdown`), heredado automáticamente por las 10 escenas de menú y todos los widgets de misión que ya usan `createKenneyButton`.

## `game/src/mission/mission-interaction-controller.ts` (modificado, Fase 12b — ampliación post-playtest)

- `handleMapClick` reproduce sonido al seleccionar una celda válida; `onOpenInstallPicker`/`closeInstallPicker` reproducen apertura/cierre de modal.

## `game/src/scenes/floorplan-scene.ts` (modificado, Fase 12b)

- `preloadAudioAssets` en `preload()`. `fireEventSound` junto a cada `fireEventEffect` (kinetic/signal/failure/crew events). `sectionAtmosphereEffects` gana `gasLeakSound`. Briefing de crisis reproduce apertura/cierre de modal. `task-completed` de tipo `install` reproduce sonido de instalación. Alarma puntual (`AUDIO_KEYS.alarm`) en los 3 disparadores del overlay de alerta visual de 12a (arranque con crisis activa, `crisis-triggered`, `overload` violento). `chainHops`/`stepAsideCrewToken` reproducen paso de tripulante, filtrado por `CREW_SIGNATURE` (no suena en enemigos).

## `game/src/ui/ui-effects.ts` (nuevo, Fase 12c.1)

- Helper de "juice" de UI: `popIn`/`slideOut`/`clickReaction`/`shake`/`flash`/`attachHoverJuice` — configuraciones de tween reutilizables por cualquier widget; `shake`/`flash` agitan un contenedor de UI de forma independiente al mapa.

## `game/src/ui/custom-cursor.ts` (nuevo, Fase 12c.3)

- `CustomCursor`: cursor contextual reactivo vía `setDefaultCursor(url(...))` con sprites del pack Kenney (`assets/sprites/ui/cursor/`). Deduplica por tipo para no pelear con el `useHandCursor` por objeto.

## `game/src/render/crt-pipeline.ts` (modificado, Fase 12c.8)

- `CrtPostFxPipeline` + `registerCrtPipeline`: filtro CRT en dos capas parametrizado por uniforms (`onPreRender`). Capa "Clean CRT" (scanlines/CA base/barrel/glow) por `uCrtIntensity`; capa "System Failure" (CA fuerte + flicker) por `uFailure`. Barrel/scanlines en coords globales (`gl_FragCoord`) → coherentes entre las dos cámaras. Alpha-preserving; solo WebGL. `registerCrtPipeline` devuelve la instancia (una por cámara) para que la escena fije los uniforms por frame.

## `game/src/render/crt-settings.ts` (nuevo, Fase 12c.8)

- Store vivo en memoria de `crtIntensity`/`flickerIntensity` (get/set + `hydrateCrtSettings`). Desacopla la lectura por-frame del CRT en `floorplan-scene` de la escritura en vivo del slider en `options-scene`, sin plumbear eventos entre escenas.

## `game/src/particles/effects/phosphor-static-effect.ts` (nuevo, Fase 12c.8)

- `firePhosphorStatic`: ruido de fósforo localizado sobre la celda averiada (capa "System Failure" en espacio de mundo). Devuelve emisores para que la escena los marque de mundo + depth (patrón `fireEnvironmentalDamage`). Severidad `minor`/`major`.

## `game/src/ui/widgets/kenney-slider.ts` (nuevo, Fase 12c.8)

- `createKenneySlider`: slider 0..1 con primitivas (el pack Kenney no trae track/thumb). `onChange` en vivo al arrastrar; limpia sus listeners de `pointermove`/`pointerup` en el SHUTDOWN. Usado por los controles de accesibilidad del CRT.

## Fase 12c.8 — otros módulos tocados

- `game/src/scenes/floorplan-scene.ts` (modificado): CRT a frame completo (`cameras.main` + `hudCamera`), driver por frame `updateCrtDriver` (rampa `crtFailureLevel` → `uFailure`) y `fireLocalStatic` en el suscriptor de `failureEvents`.
- `game/src/scenes/options-scene.ts` (modificado): dos sliders de accesibilidad CRT (estético + parpadeo/fallo), hidratan el store vivo y persisten en "Volver".
- `game/src/meta/game-settings.types.ts` (modificado): campos `crtIntensity`/`flickerIntensity` (clamp [0,1], defaults 0.7/1.0) en `GameSettings`/`DEFAULT_SETTINGS`/(de)serialize.
- `game/src/i18n/{es,en}.ts` (modificado): claves `ui.menu.options.crt-intensity` / `ui.menu.options.flicker-intensity`.

## `game/src/ui/widgets/crew-strip.ts` (modificado, Fase 12c.2)

- Retratos centrados (origin 0.5) para poder animarlos; tinte de salud en reposo (`healthTint`); expone `portraits` por actor (`CrewPortraitObject`) para las reacciones de daño/muerte de la escena.

## `game/src/ui/widgets/kenney-button.ts` (modificado, Fase 12c.1)

- Gana `iconTextureKey`/`iconSize` (icono opcional junto al texto) y `attachHoverJuice` (feedback visual de hover/click, complementa el sonido de 12b).

## `game/src/ui/widgets/install-picker-modal.ts` (modificado, Fase 12c.6)

- `initialScrollT`/`onListReady`: preservan la posición de scroll de la lista al recrear el modal por una selección (deuda #2 de PENDIENTES).

## `engine/src/components/physical-component.types.ts` (modificado, Fase 12c.5 — deuda #8)

- Nuevo `CreationPart` (ref + offset + footprint + rotación por pieza) y `CompositeComponentData.layout?` — disposición para dibujar una creación con los sprites reales de sus partes.

## `engine/src/workbench/creation-naming.ts` + `footprint-calculator.ts` (modificado, Fase 12c.5)

- `nameAndRegisterCreation` puebla `data.layout` con el offset relativo de cada pieza; `calculateFootprintOrigin` (nuevo) devuelve el min corner del bounding box.

## `game/src/render/mission-overlay-renderer.ts` (modificado, Fase 12c.5 — deuda #8)

- `renderMissionOverlay` acepta un `resolveDefinition`; `drawCreationLayout` dibuja cada parte de una creación en su offset con su sprite real (fallback a placeholder por parte).

## `game/src/scenes/floorplan-scene.ts` (modificado, Fase 12c)

- Cursor contextual (`updateCursor`/`customCursor`), reacciones de retrato (`reactCrewPortrait`/`playAnalogStatic`/`syncCrewToxicOverlays`), overlay de alerta como viñeta (`ensureVignetteTexture`) + CRT sobre `hudCamera`, y recolección visible de elementos al desmontar (`fireElementCollection`/`fireCollectibleToWorkbench`).

## `game/src/ui/widgets/notification-center.ts` (nuevo, Fase 12c.7)

- `NotificationCenter`: pila de notificaciones transitorias arriba-centro del mapa (tipos info/success/warning/error con color de acento + sonido, popIn + auto-descarte, cap de 4). Objeto de HUD; `push({title, lines?, type})`.

## `game/src/ui/custom-cursor.ts` (modificado, Fase 12c.7)

- Exporta `UI_POINTER_CURSOR_CSS` (el sprite "selectable") para que botones y filas de lista usen el cursor custom en vez del puntero del sistema (obs #2).

## `game/src/particles/effects/fabrication-effect.ts` (modificado, Fase 12c.7)

- `dismantleEffect` reescrito: "bolas de energía" (orbes aditivos cian/dorados + chispas + humo tenue) y un `PointLight` pulsante (`createDynamicLight`, `lightHook` para el bug de doble-cámara). Reemplaza los escombros marrones.

## `engine/src/mission/ship-task-effect.ts` (modificado, Fase 12c.7 — obs #4)

- Desmontar una pieza ATÓMICA ahora la acredita al `atomicStock` y devuelve `obtained` con la propia pieza (antes se destruía sin acreditar) — habilita coleccionable + notificación como el compuesto.

## `game/src/render/shadows/` (nuevo, Fase 12d.1)

- `visibility-polygon.ts` — geometría PURA (sin Phaser): `raySegmentIntersection`, `castRay`, `computeVisibilityPolygon` (polígono iluminado por luz puntual, recortado al radio). Unit-testeado.
- `occluder-edges.ts` — silueta de segmentos oclusores: `buildStaticOccluderEdges` (fusión de tramos colineales de la grilla walls∪objects), `rectEdges`/`worldBorderEdges`, y `extractOccluderGrid` (extracción del tilemap, mismo patrón que `walkable-grid.ts`).
- `dynamic-shadows.ts` — `DynamicShadowLayer`: glue Phaser, dueño de una `RenderTexture` que se rellena de oscuridad y borra (ERASE) el polígono de visibilidad de cada luz → sombra arrojada con oclusión. Registro de luces (`addLight`), `setStaticOccluders`/`setDynamicOccluders`, `redraw()` por frame.

## `game/src/render/render-depths.ts` (modificado, Fase 12d.1)

- Nuevo `RENDER_DEPTH.dynamicShadows` (1.7): sobre suelo/decals, debajo de objetos/componentes/tripulación/paredes.

## `game/src/scenes/floorplan-scene.ts` (modificado, Fase 12d.1)

- Alta de `DynamicShadowLayer` en `create()` (oclusores estáticos extraídos una vez); toda luz dinámica se registra vía el hook `registerLight` existente; `shadowLayer.redraw()` por frame en `update()`.

## `game/src/render/shadows/dynamic-shadows.ts` (modificado, Fase 12d.2 + 12d.3)

- `setDynamicOccluders` (casters móviles) + luz ambiental global (`makeGlobalAmbientLight`, `AmbientLight`, `AMBIENT_CLEAR_ALPHA`): ERASE parcial para sombra base; clearAlpha de las dinámicas escala con su intensidad. `DYNAMIC_SHADOW_DARKNESS_ALPHA` (ex `_AMBIENT_ALPHA`). Sin marco del mundo en los oclusores estáticos.

## `game/src/render/palette.ts` (modificado, Fase 12d)

- `LED_LIGHT_RADIUS_PX` / `LED_LIGHT_INTENSITY`: parámetros de la luz que emite un LED encendido.

## `game/src/scenes/floorplan-scene.ts` (modificado, Fase 12d.2/12d.3 + LED)

- `collectDynamicOccluderEdges` (componentes + tokens de tripulación/enemigos como casters); ambiental global en `create()`; `syncLedLight` en `updateLedIndicators` (el LED encendido emite `PointLight` real, participa de las sombras).

## `game/src/render/shadows/authored-lights.ts` (nuevo, Fase 12d iteración post-playtest)

- Loader de la capa de objetos Tiled `luces`: `loadAuthoredLights(scene, archetype)` (lee el object layer del tilemap efímero) + `toAuthoredLightSpec` puro (defaults + parseo de color hex, unit-testeado). Reemplaza la ambiental global de 12d.3.

## `game/src/render/shadows/dynamic-shadows.ts` (modificado, Fase 12d iteración)

- Eliminada la luz ambiental global (`makeGlobalAmbientLight`/`setAmbientLight`/`AmbientLight`/`AMBIENT_CLEAR_ALPHA`) — lavaba el contraste. La oscuridad vuelve a ser el default; solo la despejan luces reales.

## `game/src/scenes/floorplan-scene.ts` (modificado, Fase 12d iteración)

- Instancia las luces autoradas (`luces`) en `create()`; `syncLedLight` centra la luz en el sprite; `syncOverloadedConductorEffects` hace cleanup (`stop()`) al desmontar/desactivar el conductor.

## `game/src/particles/effects/overloaded-conductor-effect.ts` + `game/src/render/palette.ts` (modificado, Fase 12d iteración)

- Glow del conductor sobrecargado atenuado (scale/quantity/frequency/alpha) y radio de luz 36→64; LED atenuado (intensity 0.35, radio 52).

## `game/src/render/shadows/shadow-settings.ts` (nuevo, Fase 12d.4)

- Store vivo de `shadowIntensity` (0..1) — desacopla el slider de Opciones del `DynamicShadowLayer` que lo lee por frame. Mismo patrón que `crt-settings.ts`.

## `game/src/render/shadows/dynamic-shadows.ts` (modificado, Fase 12d.4)

- `setIntensity` (aplica el slider, 0 = apagadas). Perf: cache de polígono por luz invalidado por `occludersVersion` (bump solo si los oclusores cambian, `segmentsEqual`), culling por viewport (`circleIntersectsRect`), short-circuit a intensidad 0.

## `game/src/meta/game-settings.types.ts` + `options-scene.ts` + `i18n/{es,en}.ts` (modificado, Fase 12d.4)

- `GameSettings.shadowIntensity` (default 1, clamp01); tercer slider "Sombras" en Opciones (clave `ui.menu.options.shadow-intensity`), hidratado/persistido con los de CRT.

## `game/src/render/palette.ts` (modificado, Fase 12e)

- Contrato de semántica de color de crisis (Eje A): `CRISIS_FATAL/WARNING/SAFE_COLOR` + `INFO_NEUTRAL_COLOR` (rojo/ámbar/verde/cian) como fuente canónica, con espejos CSS (`*_CSS`) y helper `hexToCss`. Consolida los 3 hex de rojo y el ámbar reusado; `healthFractionColor`, `LED_ACTIVE_TINT`, `CORE_LOOP_MODE_COLORS`, `COMPONENT_CONDITION_TINT.jammed`, `STRUCTURAL_LAYER_COLOR`, `TIMER_TEXT_COLORS`, `SELECTED_CELL_COLOR`, `OBJECTIVE_DONE_COLOR`, `SEALED_VALVE_COLOR` derivan de él.
- Color por categoría de tag (Eje B, ortogonal): `TAG_CATEGORY_COLORS`/`TAG_CATEGORY_CSS` (funcional azul-acero / material bronce) — antes texto plano. El químico ya vivía en `CHEMICAL_TAG_COLORS`.

## `game/src/render/palette.contract.test.ts` (nuevo, Fase 12e)

- Guardia de regresión del contrato: los cortes de `healthFractionColor`, el LED activo (nunca verde — regresión #15), core-loop, condición/estructura/timer/válvula derivan del Eje A; el Eje B no colisiona con el A ni consigo mismo.

## `game/src/ui/widgets/notification-center.ts` + `mission-tooltip.ts` + `install-picker-modal.ts` (modificado, Fase 12e)

- `notification-center` consume el contrato (info/success/warning/error → `INFO_NEUTRAL`/`CRISIS_SAFE`/`CRISIS_WARNING`/`CRISIS_FATAL`) en vez de su tabla local. Tooltip y modal de instalación colorean las líneas de tag funcional/material con `TAG_CATEGORY_CSS` (Eje B).

## `game/src/render/crew-sprite.ts` (nuevo, 2026-08-03)

- Sprite genérico de tripulante para los tokens del PLANO (no la tira UI). `preloadCrewSprite` carga el PNG crudo (`crew/tripulante.png`, amarillo, mira a la izquierda); `ensureCrewTintTexture` deriva una vez una base GRIS CLARA en `CanvasTexture` (luminancia empujada a claro, alfa preservado) para que `setTint` rinda el color por personaje nítido. `faceX` (pura, testeada) resuelve el `flipX` de "mira hacia donde camina". `CREW_TOKEN_HEIGHT_PX` fija la altura del token.

## `game/src/render/crew-sprite.test.ts` (nuevo, 2026-08-03)

- 3 casos de `faceX`: derecha ⇒ voltea, izquierda ⇒ no, vertical puro ⇒ conserva la cara.

## `game/src/scenes/floorplan-scene.ts` (modificado, 2026-08-03)

- `initCrewTokens` usa el `Image` teñido de `crew-sprite.ts` en vez del círculo placeholder; `dot` del mapa `crewTokens` pasa de `Arc` a `Image`. `faceHopTarget` aplica el volteo por dirección en `chainHops`/`stepAsideCrewToken` (no-op en enemigos). `flashCrewToken` adaptado a `Image` (displayHeight en vez de radius, pulso de escala relativo).

## `game/src/render/crew-portrait-registry.ts` (modificado, 2026-08-03)

- Excluye el basename `tripulante` del glob de retratos por-nombre: es el sprite genérico compartido, no un retrato de un tripulante llamado así.

## `game/src/ui/widgets/crew-strip.ts` (modificado, 2026-08-03)

- Cada tarjeta gana una franja de identidad de color (`IDENTITY_BAR_WIDTH`) en el borde izquierdo, siempre visible, con el mismo `CREW_TOKEN_COLORS[index]` que el token del mapa — para distinguir quién es quién sin depender del retrato.

## Fase 12f — Fixes de playtest de 12d (2026-08-03)

## `game/src/scenes/floorplan-scene.ts` (modificado, Fase 12f)

- `activeHopTweens` (`Set<Phaser.Tweens.Tween>`) + `trackHopTween`: tracking de los tweens de salto de tripulación/enemigos en vuelo, pausados/reanudados en `update()` según `coreLoop.mode` (Obs 3). `redrawProjectileTokens` pasa un resolver `ref → componentDefinitionId` (vía `mission.loosePromoter`) a `renderProjectileTokens` (deuda #5).
- `knownProjectileRefs` (`Set<string>`) + `syncNewlyPromotedProjectiles` (fix post-QA, deuda #5): detecta una promoción nueva a proyectil suelto (mismo tick que la instalación) y fuerza `redrawOverlay()` para borrar el sprite fantasma que quedaba pegado en la celda.

## `game/src/enemies/enemy-tokens.ts` (modificado, Fase 12f)

- `hopEnemyToken` pasa de `void` a devolver el `Phaser.Tweens.Tween` de `hopMove`, para que el llamador pueda trackearlo y pausarlo en modo `planning` (Obs 3).

## `game/index.html` + `game/src/main.ts` + `game/src/scenes/boot-scene.ts` (modificado, Fase 12f)

- Fix de fullscreen en negro (Obs 7): contenedor `#game-root` con tamaño explícito como `scale.parent`/`scale.fullscreenTarget`; `BootScene` fuerza `scale.refresh()` en `ENTER_FULLSCREEN`/`LEAVE_FULLSCREEN`.

## `engine/src/mission/loose-ferromagnetic-promoter.ts` (modificado, Fase 12f)

- `definitionByRef` (`Map<ref, ComponentId>`) + `definitionIdForRef(ref)`: conserva el `componentDefinitionId` de catálogo de cada pieza promovida a proyectil suelto, sin tocar `ProjectileBody`/`kinetics/` (deuda #5).

## `game/src/render/projectile-renderer.ts` (modificado, Fase 12f)

- `renderProjectileTokens` recibe un resolver `(ref) => componentDefinitionId | undefined` y dibuja el sprite real de la pieza (`componentTextureKey`/`hasComponentSprite`) antes de caer al círculo placeholder (deuda #5).

## `game/src/ui/widgets/crew-select-card.ts` (nuevo, Fase 12g)

- `renderCrewSelectCard`: tarjeta de selección de tripulante (retrato con fallback de color, nombre, especialidad/tier, rasgo, descripción). Hermana de `crew-strip.ts` (10b) pero sin barra de HP y con bloque de descripción — layout de grilla vertical, no tira horizontal.

## `game/src/ui/widgets/ship-archetype-card.ts` (nuevo, Fase 12g)

- `renderShipArchetypeCard`: tarjeta de selección de arquetipo (imagen exterior con fallback de color + id de arquetipo, nombre propio, nombre de arquetipo, descripción, pros/cons en columna única con wrap dinámico — evita el solape que dejaba un offset fijo o dos columnas lado a lado con texto largo en español).

## `game/src/meta/ship-archetype-metadata.ts` (nuevo, Fase 12g)

- `SHIP_ARCHETYPE_METADATA`: mapa `ShipArchetype → { properNameKey, descriptionKey, proKeys, conKeys }` (claves i18n, no texto). Vive en `/game` porque es flavor/presentación, no dato de motor.

## `game/src/render/ship-image-registry.ts` (nuevo, Fase 12g)

- `hasShipImage`/`shipImageTextureKey`/`preloadShipImages`: registro de imagen exterior por arquetipo, mismo patrón `import.meta.glob` que `crew-portrait-registry.ts`. Carpeta `game/assets/sprites/ships/` creada vacía en esta fase — sin sprites reales todavía, cae siempre al placeholder de color.

## `game/src/scenes/crew-select-scene.ts` (modificado, Fase 12g)

- Reemplaza la lista de botones de texto por una grilla de `renderCrewSelectCard` (2 columnas), con entrada escalonada (`popIn`).

## `game/src/scenes/archetype-select-scene.ts` (modificado, Fase 12g)

- Reemplaza los botones de texto por una grilla de `renderShipArchetypeCard` (2×2), con entrada escalonada (`popIn`).

## `game/src/scenes/title-scene.ts` (modificado, Fase 12g)

- `cameras.main.fadeIn` al entrar + `popIn` escalonado en los 6 botones del menú (antes aparecían sin animación). Fix de paso: el botón "Continuar" (creado dentro de un `.then()`) capturaba la `y` compartida con el resto de botones sync, que para cuando el microtask corría ya había avanzado hasta el valor final — quedaba dibujado encima de "Salir"; ahora se captura en una constante antes del `await`.

## `game/src/i18n/es.ts` + `game/src/i18n/en.ts` (modificado, Fase 12g)

- Claves nuevas `crew.specialty.*`/`crew.trait.*`/`crew.tier.*` (etiquetas legibles) y `ship.<archetype>.properName`/`.description`/`.pro.N`/`.con.N` (placeholder redactado por Claude, reemplazable por el operador). Las descripciones de tripulante (`crew.<slug>.description`) ya existían de una fase anterior, sin usar hasta ahora.

## `engine/src/geometry/line-of-sight.ts` (nuevo, Fase 13a)

- `hasLineOfSight(from, to, blocked: CellBlockedQuery)`: raycast tipo Bresenham entre dos celdas, lógica pura sin Phaser/Tiled. `CellBlockedQuery` es el puerto mínimo de "¿esta celda está bloqueada?" que `/game` implementa concretamente sobre su `WalkableGrid`.

## `engine/src/mission/motion-emitter-input-source.ts` (nuevo, Fase 13a)

- `motionAwareEmitterInputs(shipState, actorPositions, blocked, base)`: `EmitterInputSource` que resuelve `triggerType: "optical"` (`fotorreceptor`, reusado como sensor de presencia) contra la posición real de tripulación/enemigos vivos, por rango Manhattan + `hasLineOfSight`. Mismo patrón de envoltorio parcial que `pressure-emitter-input-source.ts` (Subfase 11h).

## `engine/src/mission/mission-reaction-runtime.ts` (nuevo, Fase 13a)

- `MissionReactionRuntime` (`Tickable`): primer llamador de producción de `ReactionResolver` fuera de la mesa de creación. Evalúa `CrisisDefinition.scriptedReactions` cada tick con `oxygen` real de sección y `ignitionPresent` real para el trigger `"overload-bridge"` (se suscribe a `failureEvents`, resuelve `OverloadEvent.ref` → sección). Cicatriz sin retorno: un `subject.id` que combustiona no se re-evalúa.

## `engine/src/crisis/crisis-definition.types.ts` (modificado, Fase 13a)

- `ScriptedReactionSubject` (reactivos + `sectionId` + `ignitionTrigger`) y `CrisisDefinition.scriptedReactions?`, mismo criterio narrativo/data-driven que `ScriptedOverloadSubject` (Fase 12a).

## `engine/src/chemistry/reaction/reaction-events.types.ts` (modificado, Fase 13a)

- `CombustionEvent.sectionId?: SectionId` opcional — lo llena `MissionReactionRuntime` al emitir (no `CombustionRule`, que sigue sin noción de mundo), para que `/game` sepa dónde posicionar el efecto/overlay.

## `game/src/mission/mission-runtime.ts` (modificado, Fase 13a)

- `setMotionBlockedQuery(query)` + composición de `motionAwareEmitterInputs` en `emitterInputs` (junto a `pressureAwareEmitterInputs` ya existente). `reactionEvents`/`reactionRuntime` nuevos, mismo patrón que `failureEvents`/`overloadRuntime` (Fase 12a).

## `game/src/scenes/floorplan-scene.ts` (modificado, Fase 13a)

- Llama `mission.setMotionBlockedQuery(...)` tras `extractWalkableGrid` (adapta `WalkableGrid` al `CellBlockedQuery` del motor). Nuevo listener de `reactionEvents` (mismo patrón que `failureEvents`): dispara `combustionEffect`/`combustionSound` (ya existían, sin llamador real hasta ahora) y extiende el overlay de alerta de pantalla completa a combustión no-débil.

## `engine/src/power/power.types.ts` (nuevo, Fase 13b)

- `PowerState`/`SectionPowerAllocation`/`InstancePowerPriority`/`emptyPowerState()`. Estado dinámico del presupuesto de energía: asignación de unidades por sección, prioridad manual por instancia, y `permanentlyDisconnectedSectionIds` (cicatriz real, distinta del déficit táctico de sesión).

## `engine/src/power/power-source.ts` (nuevo, Fase 13b)

- `totalPowerBudget(placedComponents, componentRegistry)`: suma `powerUnits` de toda instancia RES(E) instalada. "Conectada" = instalada (mismo MVP sin simulación de cableado físico que el resto del dominio de misión).

## `engine/src/power/power-allocation.ts` (nuevo, Fase 13b; modificado, fixes post-playtest rondas 2 y 4)

- Reparto en dos niveles, funciones puras testeadas antes de integrar: `allocateSectionBudget` (global→sección — `darkSectionIds` es informativo, no gatea nada por sí solo), `allocateComponentPower` (sección→componentes, ordena por prioridad con desempate determinista por `instanceId`, consume por `powerDraw`). `reconcilePowerScars`/`distributeBudgetEvenly` (ronda 1) eliminados en la ronda 2 — sin caller tras desacoplar la cicatriz permanente del déficit vivo (ver `mission-power-runtime.ts`).
- Ronda 4: ante déficit ya no recorta proporcionalmente — apaga secciones de MENOR a MAYOR asignación hasta que el resto entre (desempate por `sectionId`); un único sobreviviente que excede el presupuesto se recorta en vez de apagarse. Devuelve además `shortfallUnits` y `shedSectionIds`. No toca `sectionAllocations`: la reconciliación es no destructiva.

## `engine/src/power/power-events.types.ts` (nuevo, fix post-playtest ronda 4 de 13b)

- `PowerShortfallEvent`/`PowerDomainEvent`: el jugador tiene más energía repartida que la que la nave entrega. El motor ya resolvió el conflicto; el evento existe para que `/game` lo comunique. Sumado a la unión agregada `DomainEvent` (`index.ts`).

## `engine/src/power/mission-power-runtime.ts` (nuevo, Fase 13b; modificado, fixes post-playtest rondas 2 y 3)

- `MissionPowerRuntime` (`Tickable`, molde de `MissionOverloadRuntime`). Implementa `PowerScarSource` e `InstancePowerSource` (`mission-signal-runtime.ts`). `Blueprint.unpoweredSectionIds` refleja SOLO `powerState.permanentlyDisconnectedSectionIds` (ronda 2 — ya no unión con déficit vivo). `sectionHasNoPowerGranted(sectionId)`: señal puramente cosmética (déficit vivo, sin excepciones) para el efecto visual ambiental, desacoplada del gating real.
- `recalculate()` público (ronda 3): el recálculo NO puede depender solo de `tick()`, porque `CoreLoopModeMachine` es NO-OP en modo `planning` y los controles de energía solo existen en pausa. `tick()` delega en él.
- Ronda 5: implementa además `PowerSupplySource` (`grantedTotalUnits()`/`requestedTotalUnits()`) — alimenta el indicador de energía del HUD.
- Ronda 4: cachea `grantedBySectionId`/`shortfallUnits` (`sectionPowerGranted()`, `powerShortfallUnits()`) y emite `PowerShortfallEvent` POR FLANCO — solo cuando el faltante aparece o cambia de magnitud, no en cada recálculo. Guarda el último `elapsedSeconds` visto en `tick()`, porque `recalculate()` no recibe `TickContext`.

## `engine/src/properties/functional.types.ts` (modificado, Fase 13b)

- `ReservoirProperty.powerUnits?` (unidades de presupuesto de una fuente RES(E)) y `ActuatorProperty.powerDraw?` (costo eléctrico), ambos opcionales/retrocompatibles.

## `engine/src/blueprint/blueprint.types.ts` + `blueprint-serializer.ts` (modificado, Fase 13b)

- `Blueprint.powerState: PowerState` nuevo (`schemaVersion` 5→6). `unpoweredSectionIds` pasa de cicatriz autoritativa a campo DERIVADO (recalculado por `MissionPowerRuntime`); sigue siendo el único campo público que consumen `MissionSignalRuntime`/UI. Serializer valida/defaultea `powerState` para saves pre-v6.

## `engine/src/mission/mission-signal-runtime.ts` (modificado, Fase 13b)

- Nueva interfaz `InstancePowerSource` (gating por instancia, más fino que `PowerScarSource` por sección) — `outputOf()` fuerza `false` si la instancia dueña del nodo no está alimentada, aunque su sección sí tenga presupuesto.

## `engine/src/save/campaign-save-factory.ts` (modificado, Fase 13b; modificado, fix post-playtest ronda 2)

- `powerState.sectionAllocations` arranca `[]` (ronda 2 — revierte el auto-reparto de la ronda 1, ya no hace falta como red de seguridad porque el gating real no depende del déficit vivo); `permanentlyDisconnectedSectionIds` arranca `[]` (se quitó la siembra de la demo "taller", ver `chapter-01-primer-aviso.ts`).

## `engine/src/crisis/campaign/chapter-01-primer-aviso.ts` (modificado, fix post-playtest ronda 2 de 13b)

- Quitado `Chapter01ArchetypeParams.unpoweredSectionId` y el export `CHAPTER_01_UNPOWERED_SECTION_ID_BY_ARCHETYPE` — la demo de "taller" (attrezzo de Fase 12a) no era contenido narrativo real; reemplazada por una fuente real sembrada en `initial-ship-state.ts`.

## `engine/src/floorplan/initial-ship-state.ts` (+ `initial-ship-state.test.ts` nuevo) (modificado, fixes post-playtest rondas 2 y 3 de 13b)

- `starterKit(archetype)` gana el parámetro `archetype`: solo para `"exploracion"` siembra fuentes reales de energía. Ronda 3: 5× `celula-fotovoltaica` (footprint 1×2, `powerUnits: 2`) = **10 unidades** — 3 en `ingenieria` y 2 en `propulsion` (`ingenieria` tope real 6: solo 3 pares verticales libres). Celdas verificadas contra `nave-exploracion.json`, en `EXPLORACION_POWER_SOURCE_CELLS`.

## `engine/src/ship-status/ship-status-aggregation.ts` + `ship-status-runtime.ts` (modificado, Fase 13b; modificado, fix post-playtest ronda 5)

- Comentarios actualizados: `aggregateEnergy` ya no es MVP-stub, la fórmula no cambió pero `unpoweredSectionIds` ahora es un valor real derivado, no un flag estático.
- Ronda 5: `aggregateEnergy` recibe `EnergyAggregationInput` (objeto, no 4 números posicionales) y devuelve el PEOR de dos señales — cicatriz permanente y suministro/demanda (`granted/requested`). `requestedUnits === 0` = nominal, la condición que impide revivir el bug de "todo crítico al arrancar" de la ronda 1. Sin esto el indicador quedaba muerto (siempre 100%). El dato entra por `PowerSupplySource`, interfaz angosta y opcional implementada por `MissionPowerRuntime`.

## `engine/src/components/catalog/{atomic-component-catalog,composite/*}.ts` (modificado, Fase 13b)

- `powerUnits` autorado en las 8 fuentes `RES(E)` reales del catálogo (atomic + 4 composite por arquetipo).

## `game/src/render/palette.ts` + `floorplan-renderer.ts` (modificado, Fase 13b)

- `ENERGY_LAYER_COLOR`/`ENERGY_LAYER_ALPHA` (deriva del Eje A de color). `FloorplanLayerId` gana `"energia"`; `drawEnergyLayer()` (plantilla de `drawStructuralLayer`) pinta rojo/ámbar por sección según déficit.
- Ronda 6: `POWER_BLOCKED_FLASH_COLOR` (= `CRISIS_FATAL_COLOR`, rojo de bloqueo del contrato) para el destello de rechazo del slider, con aserción en `palette.contract.test.ts`.

## `game/src/audio/audio-asset-registry.ts` (modificado, fix post-playtest ronda 6 de 13b)

- Clave `uiDenied` (acción rechazada por la UI) mapeada a los assets de error YA cargados (`sfx-ui-error-*`, compartidos con `barkFailureOrInjury`) — sin assets nuevos.

## `game/src/ui/widgets/power-allocation-slider.ts` (nuevo, fix post-playtest ronda 2 de 13b — reemplaza `power-allocation-dial.ts`, borrado; modificado ronda 3)

- `renderPowerAllocationSlider`: slider entero de arrastre por sección (molde de `kenney-slider.ts`), consciente de cámara (`getWorldPoint`, objeto de mundo no HUD) y con `destroy()` explícito de sus propios listeners de `scene.input` — necesario porque se destruye/reconstruye muchas veces por sesión, a diferencia del slider de `options-scene.ts`.
- Ronda 3: el track abarca `0..maxUnits` (presupuesto total, ancho con el mismo significado en todas las secciones) pero el arrastre se topa en `capUnits`; el tramo bloqueado se pinta con `LOCKED_COLOR` propio. Etiqueta `N/total · P%`. `setCap(capUnits)` reajusta el tope sin destruir el widget.
- Ronda 4: relleno partido pedido vs. otorgado — azul hasta `grantedUnits`, ámbar (`ENERGY_LAYER_COLOR.deficit`) de ahí al pedido. `setGranted(n)` lo refresca sin destruir el widget. Sin déficit el tramo ámbar mide 0.
- Ronda 5: el pedido ya NO se clampea al presupuesto (lo tapaba: dos zonas con 3 y 7 mostraban ambas "2/2"). La escala del track es `max(1, maxUnits, units)` — fijada al construir, no se recalcula en el arrastre. `capUnits` limita solo el arrastre. El `· P%` se muestra solo cuando el pedido entra en el presupuesto.
- Ronda 6: señal de rechazo al chocar contra el tope (antes era silencioso y el slider parecía roto) — `signalBlocked()` throttleado a 500 ms: sacudón del thumb, destello con `POWER_BLOCKED_FLASH_COLOR` y sonido `uiDenied`; la etiqueta muestra "Sin energía libre" ~1s. `LOCKED_COLOR` con más contraste (neutro, no rojo: aparece casi siempre). `destroy()` cancela timer y tweens.
- Ronda 7: `setLabel(texto, color)` mide y encoge la fuente si el texto no entra en `maxLabelWidth` (robusto frente a i18n); el mensaje de bloqueo va en `CRISIS_FATAL_CSS`, el mismo rojo del destello. `LABEL_OFFSET_Y` a `-24` — antes la etiqueta se salía por arriba del panel.
- Ronda 8: el mensaje de bloqueo se dibuja sobre un badge casi negro dimensionado al texto medido — el rojo del contrato sobre el gris del panel daba ~1.3:1 de contraste; sobre el badge sube a ~4.5:1 sin salirse de las constantes canónicas. Piso del auto-encogido a 10px (el mensaje caía en el anterior de 8px).

## `game/src/ui/widgets/power-priority-list.ts` (nuevo, Fase 13b)

- `renderPowerPriorityList`: inspector de prioridad de una sección, lista con botones ↑/↓ por fila — opción más simple del diseño cerrado, sin drag-and-drop.

## `game/src/mission/mission-runtime.ts` (modificado, Fase 13b; modificado, fix post-playtest ronda 2)

- `powerRuntime: MissionPowerRuntime` nuevo, registrado en el core loop antes de `signalRuntime`. Getters/setters para la UI: `sectionPowerAllocation`, `setSectionPowerUnits`, `sectionPowerDemand`, `instancePowerPriorityOrder`, `reorderInstancePriority`, `totalPowerBudget`, y (ronda 2) `sectionHasNoPowerGranted`.
- Ronda 3: `setSectionPowerUnits`/`reorderInstancePriority` llaman `powerRuntime.recalculate()` de forma síncrona — el core loop no tickea en pausa, que es cuando se opera la UI de energía.
- Ronda 4: emisor `powerEvents` (déficit de energía) + getters `sectionPowerGranted`/`powerShortfallUnits`.

## `game/src/scenes/floorplan-scene.ts` (modificado, Fase 13b; modificado, fix post-playtest ronda 2)

- Redibuja la capa "energia" cada frame (mismo criterio que "estructural"). Slider/inspector de prioridad se reconstruyen bajo demanda (toggle de capa, cambio de modo) — `redrawEnergyControls()`/`openEnergyPriorityPanel()`/`closeEnergyPriorityPanel()`, usa `renderPowerAllocationSlider` (ronda 2). Nuevo campo `energyControlWorldBounds` + chequeo en `isOverFixedUi()` (ronda 2, fix de click bleed-through, mismo patrón que `actionPanelBounds`). `redrawUnpoweredSectionScar`/`syncUnpoweredSectionLights` consumen `mission.sectionHasNoPowerGranted()` en vez de `blueprint.unpoweredSectionIds` (ronda 2).
- Ronda 3: `unallocatedPowerUnits()`/`syncEnergySliderCaps()` imponen el tope global del reparto (los sliders de las otras secciones se reajustan sin reconstruirse). Constante `ENERGY_CONTROL_BOX`, fuente única de la que se derivan el panel de fondo (`createKenneyPanel`) y `energyControlWorldBounds`.
- Ronda 4: suscripción a `mission.powerEvents` → aviso de déficit por el `NotificationCenter`; `syncEnergySliderCaps` refresca además lo otorgado en todos los sliders.
- Ronda 7: `ENERGY_CONTROL_BOX` gana `padding` y crece a 120×90 con las 3 piezas re-espaciadas (la etiqueta se salía del panel); `ENERGY_CONTROL_SHADOW` + un segundo `createKenneyPanel` tintado de negro hacen de sombra dura, sin shaders (hay un cluster por sección).

## `engine/src/wear/` (nuevo, Fase 13c)

- `wear.types.ts`: `ComponentWear` (`nuevo`/`usado`/`degradado`/`critico`), `WEAR_ORDER`, `wearSteps`, `worsenWear`, `worstWear`. Eje ortogonal a `ComponentCondition`. No existe función inversa a propósito (principio 5: sin undo gratuito).
- `effective-resistance.ts`: `effectiveResistance(catalogRE, wear, legacyOverride?)` — punto ÚNICO donde el desgaste entra en el cálculo estructural; antes la fórmula estaba replicada en 3 sitios. Mapeo 1:1 (un escalón de desgaste = un escalón de RE) + retrocompat de la cicatriz `structuralResistanceOverride` de saves ≤ v6 (gana el peor de los dos ejes).
- `overload-capacity.ts`: `wornCapacity(capacity, wear)` = −15% por escalón. Así el desgaste sube el riesgo de fallo catastrófico sin meter azar en el tick de simulación.
- `dismantle-wear.ts`: `wearAfterDismantle` — probabilidad de conservar el estado al canibalizar, reutilizando `atomicRecoveryFraction` (GDD §6.5) como probabilidad por pieza. Sin `RandomSource` inyectado nunca degrada.

## `engine/src/simulation/random-source.ts` (nuevo, Fase 13c)

- `RandomSource` (tipo inyectable), `sequenceRandom` (secuencia fija para tests), `systemRandom`. Primer y único azar del motor; se inyecta para que los casos de validación sigan siendo reproducibles.

## `engine/src/properties/material-order.ts` (nuevo, Fase 13c)

- `RE_ORDER`/`CE_ORDER`/`CT_ORDER` + `worstResistance`/`bestConductivity`/`bestThermalConductivity`. El orden canónico de niveles de material, antes un array local de `structural-failure.ts`.

## `engine/src/workbench/creation-material-aggregation.ts` (nuevo, Fase 13c — deuda #6)

- `aggregateCreationMaterial`: RE = peor de las partes, MAG = OR, CE/CT = mayor, ES = mayoritario. Consumido por `creation-naming.ts`, que hasta ahora solo agregaba propiedades funcionales.

## `engine/src/inventory/` (modificado, Fase 13c)

- `inventory.types.ts`: `AtomicPartsStock` pasa de `Record<ComponentId, number>` a buckets por desgaste (`WearBuckets`) — sin esto no hay dónde guardar la historia de una pieza entre desmontarla y reinstalarla.
- `inventory-ledger.ts`: `stockOf` conserva su firma y devuelve el total; nuevos `stockOfWear`/`wearBucketsOf`; `consumeStock`/`creditStock` operan sobre un bucket explícito y no caen a otro.

## `engine/src/mission/ship-task-effect.ts` (modificado, Fase 13c)

- `DismantleWearDeps` (azar + lookup `actorId → CrewActor`, ambos opcionales): el desmontaje degrada la pieza según el tier del especialista y la instalación toma el desgaste del bucket consumido. Sin las deps, comportamiento pre-13c intacto.

## `engine/src/blueprint/` · `engine/src/save/` (modificado, Fase 13c)

- `PlacedComponentInstance.wear` requerido (`schemaVersion` 6→7, default `nuevo` en el guard); `structuralResistanceOverride` deprecado a solo-lectura. `CampaignSaveState` 3→4 por el cambio de forma del stock, con migración `number → {nuevo: n}`.

## `game/src/render/palette.ts` (modificado, Fase 13c)

- `COMPONENT_WEAR_TINT`/`COMPONENT_WEAR_CSS`: `degradado` y `critico` derivan del contrato de 12e; `usado` es un bronce apagado que no colisiona con el Eje A. `condition` gana sobre `wear` al pintar.

## `game/src/ui/widgets/mission-tooltip.ts` · `install-picker-modal.ts` (modificado, Fase 13c)

- Tooltip: tag de desgaste + resistencia EFECTIVA (corrige un bug preexistente que mostraba el RE de catálogo).
- Selector de instalación: una fila por bucket de desgaste (`optionRowLabel`), para que el jugador elija qué unidad gasta en vez de recibir la peor en silencio.

## `engine/src/ship-status/ship-status-aggregation.ts` (modificado, 13c fix de playtest ronda 1)

- `instanceHullContribution`/`weightedHullFraction` reemplazan a `instanceHullFraction`: la integridad de casco solo cuenta piezas con tag `EST` y las pondera por `damageResistance`. **Provisional** — la Subfase 13f lo borra y pasa la integridad a ser vida propia de la sección.

## `engine/src/tasks/task-events.types.ts` (modificado, 13c fix de playtest ronda 1)

- `TaskCompletedEvent.obtained` pasa a reusar `TaskEffectResult["obtained"]` en vez de repetir su forma; mientras estuvieron duplicados, los campos nuevos del motor no llegaban a `/game` sin que nada fallara al compilar.

## `engine/src/components/catalog/atomic-component-catalog.ts` (modificado, 13c fix de playtest ronda 1)

- `material.RE` autorado en las 18 piezas que no lo declaraban (B electrónica/plástico, M metálico funcional): sin RE, el desgaste de 13c no tenía consecuencia mecánica en la mayoría del catálogo.

## `game/src/ui/widgets/install-picker-modal.ts` (modificado, 13c fix de playtest ronda 1)

- `DESCRIPTION_BACKDROP_*` + rectángulo de fondo bajo la columna de ficha: los tags del Eje B daban 1.2-1.4:1 sobre el gris del panel Kenney. Mismo recurso que el fondo del tooltip, sin tocar la paleta.

## `engine/src/salvage/` (nuevo, Subfase 13d)

- `salvage-hazard.types.ts`: `dismantle-spark`/`dismantle-spill`/`dismantle-leak` + `SalvageDomainEvent`. Todos llevan `instanceId`/`position`/`sectionId` — lo que `/game` necesita para pintar y lo que 13f necesitará para restar vida a la sección sin cambiar el contrato.
- `dismantle-hazard-rules.ts`: Strategy, una regla por condición de peligro (`powered-instance`, `reservoir-content`, `hazardous-atmosphere`) + `DismantleHazardContext` (el estado vivo alrededor de la pieza).
- `dismantle-hazard-assessment.ts`: evaluación PURA compartida por el efecto de tarea y por la UI (badge de riesgo) — una sola fuente de verdad, no dos criterios que se desincronizan.
- `dismantle-hazard-handler.ts`: la parte con efectos (emitir eventos, dañar al actor vía `applyCrewDamage`, pedir el escalón extra de desgaste).
- `salvage-parameters.ts`: daño por hazard, umbrales de atmósfera comprometida, caudal/duración de la fuga.
- `transient-pressure-sink.ts`: `TransientLeakPressureSink`, fugas acotadas en el tiempo como `SectionPressureSinkSource` (las permanentes son 13f).

## `engine/src/mission/composite-pressure-sink.ts` (nuevo, Subfase 13d)

- `composePressureSinks(...)`: `MissionAtmosphereRuntime` acepta un solo sumidero (ocupado por la junta rota del Cap.1); esto los suma respetando el signo. Cubre también el hueco #5 relevado por 13f.

## `engine/src/mission/ship-task-effect.ts` (modificado, Subfase 13d)

- `SalvageHazardDeps` (opcional, mismo criterio que `DismantleWearDeps`): consultas al mundo vivo — energía (13b), atmósfera de la sección, reloj — más el handler. Sin ellas, comportamiento pre-13d intacto.
- `dismantleHazardContext()` exportado: `/game` lo reusa para el badge de riesgo antes de encolar.
- Casos nuevos `cut-power` (asignación de la sección a 0) y `purge-reservoir` (ventea el contenido, no lo acredita al stock).

## `engine/src/mission/mission-reaction-runtime.ts` (modificado, Subfase 13d)

- Segunda fuente de ignición real: se suscribe a `dismantle-spark` además del `OverloadEvent` fire/explosion. `ignitionTrigger: "overload-bridge"` pasa a significar "hay ignición real en la sección", venga de donde venga (nombre conservado para no tocar contenido autorado).

## `game/src/particles/effects/salvage-hazard-effect.ts` · `game/src/audio/effects/dismantle-spark-sound.ts` (nuevo, Subfase 13d)

- Tres efectos visualmente distintos (principio 6): estallido eléctrico hacia arriba, charco + salpicadura, chorro ancho que se disipa. El sonido del chispazo reutiliza el banco de sobrecarga (misma familia eléctrica, sin asset dedicado — deuda #17).

## `game/src/mission/mission-runtime.ts` (modificado, Subfase 13d)

- `salvageEvents`, `dismantleHazardsFor()`, `queueCutPower`/`queuePurgeReservoir`, `sectionIdOfInstance()`, y un `Tickable` mínimo registrado PRIMERO en el core loop que fija el reloj del tick (los hazards lo leen para datar sus eventos) y caduca las fugas abiertas.

## `game/src/ui/widgets/mission-action-panel.ts` (modificado, Subfase 13d)

- `ActionPanelContent.instance.dismantleHazards`: badge de riesgo en ámbar (contrato de 12e) + un botón de asegurado por hazard aplicable. El widget solo pinta: el riesgo lo evalúa el motor.

## `engine/src/salvage/instance-energized.ts` (nuevo, 13d fix de playtest ronda 1)

- `isElectricallyLive` / `isElectricSource` / `isInstanceEnergized`: el predicado de "pieza viva" propio de 13d. **No usar `MissionPowerRuntime.isInstancePowered` para esto** — significa "su demanda está satisfecha" y da `true` para cualquier pieza sin `powerDraw`, incluso con la sección a 0 (ver el docblock del módulo).
- Se resuelve por propiedades (`COND`/`RES` de tipo E, `ACT`, `EM`, `REC`, `CE ≠ "N"`), no por identidad de componente. Una FUENTE (`RES(E)` con `powerUnits`) está viva hasta que se la descarga, sin depender de la red.

## `engine/src/power/` (modificado, 13d fix de playtest ronda 1)

- `PowerState.dischargedSourceIds` (schema 7→8): fuentes descargadas por la tarea `discharge-source`. `totalPowerBudget` deja de contarlas — asegurar una batería para canibalizarla cuesta presupuesto de nave, permanentemente.

## `engine/src/properties/functional.types.ts` (modificado, Subfase 13e)

- `FabricatorProperty` (`FAB`, con `domain: "fisica" | "quimica"`): propiedad de HABILITACIÓN, no de trabajo — declara que desde esa pieza se abre la mesa de creación. No es un `ACT` (no convierte energía en trabajo); misma clase de aclaración semántica que 11h hizo con LED/LCD dentro de `REC`. Extiende el set de tags del GDD §5.1.

## `engine/src/components/fabricator-query.ts` · `catalog/composite/taller.ts` (nuevo, Subfase 13e)

- `fabricatorDomainOf`/`instanceFabricatorDomain`/`findFabricators`/`hasFabricator`: punto ÚNICO de "¿qué instancias habilitan qué mesa?", resuelto por propiedad `FAB` y nunca por `ComponentId` (Principio 1). Una instancia `destroyed` deja de habilitar; `jammed` sigue.
- `TALLER_CATALOG`: `banco-de-trabajo` (FAB física) y `estacion-quimica` (FAB química + `RES(L)` = su reservorio de SALIDA). No es un catálogo de arquetipo — es kit base de las 4 naves, sembrado en `initial-ship-state.ts`.

## `engine/src/reservoir/` (nuevo, Subfase 13e)

- `reservoir-ledger.ts`: operaciones PURAS sobre `Blueprint.reservoirContents` (`contentOf`/`freeCapacity`/`pourInto`/`drawFrom`/`emptyReservoir`). Los escritores que faltaban desde siempre — hasta 13d ese campo solo se vaciaba. Regla: UNA sustancia por reservorio; verter otra lanza `ReservoirOccupiedError` (hay que purgar antes).
- `reservoir-query.ts`: `substanceReservoirProperty`/`instanceReservoirCapacity`, que filtran el `RES` de tipo G/L/T — las baterías (`RES(E)` de 13b) no son reservorios de sustancia.
- `fluid-transfer-reachability.ts`: espejo exacto de `assertSignalWiringReachable` con `kind: "fluido"`. Intra-sección libre, cross-section exige conducto, misma política fail-open.
- `substance-composition.ts`: de qué está hecha una sustancia — receta de catálogo → procedencia registrada al sintetizar → indescomponible. **Precondición en los tres: estar analizada** (`analyze-substance` de 11e pasa de flavor a puerta real).

## `engine/src/inventory/element-ledger.ts` · `mutable-element-stock.ts` (nuevo, Subfase 13e)

- `ElementStock` y su ledger. Sin buckets de desgaste a diferencia de `AtomicPartsStock`: una sustancia no acumula historia entre usos. `consumeElements` devuelve `null` sin descontar parcialmente, mismo contrato que `consumeStock`.

## `engine/src/mission/section-gas-injection.ts` (nuevo, Subfase 13e)

- `SectionGasInjectionSource` + `TransientGasInjection`, inyectados como 4º parámetro OPCIONAL de `MissionAtmosphereRuntime` (mismo patrón DI que `SectionPressureSinkSource`). **El primer escritor real de un `ChemicalSubstanceId` en `atmosphere.gases`**: todo el camino lector (`contaminantAt`, `sectionCorrosiveLevel`, `HazardousAtmosphereHazardRule`) existía desde 13a sin escritor. El gas entra desplazando al resto, con la suma de fracciones acotada a 1.

## `engine/src/mission/fluid-operations.ts` (nuevo, Subfase 13e — cierra la deuda #10)

- `FluidOperationRegistry`: operaciones de fluido EN CURSO (trasvase/vertido/extracción/purga), enganchadas al ciclo de vida de la tarea. De acá sale el caudal real con que se anima la capa `fluido`, en vez de la heurística prestada del booleano de energía. Sin operación viva el conducto queda quieto — correcto, mismo criterio que 11f.4 para `senal` en calma.

## `engine/src/tasks/` · `crew/crew-affinity.ts` · `mission/ship-task-effect.ts` (modificado, Subfase 13e)

- Tres `TaskType` nuevos con su payload: `transfer-substance`, `apply-substance`, `extract-elements` (afinidad Ingeniero las dos primeras, Médico la tercera). `SubstanceFlowDeps` opcional en `createShipTaskEffect`, mismo criterio que `SalvageHazardDeps`: sin ella las tareas son no-op y nada del comportamiento anterior cambia.

## `engine/src/save/` (modificado, Subfase 13e)

- `CampaignSaveState.schemaVersion` 4→5: `elementStock`, `substanceProvenance` y `analyzedSubstanceIds`. Los dos últimos vivían solo en memoria de `MissionRuntime`; `analyzedSubstanceIds` pasó de flavor a precondición de la extracción, así que tenía que persistir. Migración "campo ausente ⇒ vacío". **`Blueprint.schemaVersion` NO se toca**: `reservoirContents` ya existía y ya se serializaba.

## `game/src/mission/mission-runtime.ts` (modificado, Subfase 13e)

- `elementStock`, `substanceProvenance`, `fluidOperations`; `queueTransferSubstance`/`queueApplySubstance`/`queueExtractElements`; `reservoirContentOf`/`transferTargetsFor`/`extractionBlockedFor`/`fabricatorDomainOfInstance`/`benchCell`. `queueSynthesis` consume el stock AL ENCOLAR (no al completar, para no repetir el bug de la Obs 8), registra la procedencia y deposita el resultado en el reservorio de la estación. `availableSubstances` deriva también de `reservoirContents`, así que el HUD por fin sabe DÓNDE está cada sustancia.

## `game/src/ui/widgets/mission-action-panel.ts` · `scenes/{floorplan-scene,creative-workbench-scene}.ts` (modificado, Subfase 13e)

- `ReservoirPanelInfo` en el contenido `instance`: contenido del reservorio + botones Aplicar/Trasvasar/Extraer, con el MOTIVO del bloqueo en el propio label (un botón gris y mudo es lo que impide descubrir que primero hay que analizar). El panel sigue sin conocer el catálogo: todo viene precalculado, mismo criterio que los hazards de 13d.
- El botón MESA global del header **se eliminó**: la mesa se abre desde el panel contextual del aparato y entra fijada a su dominio, así que el toggle libre Física/Química también desapareció. La recolección de elementos de 12c.5 vuela ahora al banco de trabajo real del plano.

## `engine/src/components/catalog/composite/composite-component-spec.types.ts` (nuevo, 13e ronda 1 de fixes)

- `CompositeComponentSpec` extraída: estaba duplicada palabra por palabra en los 4 catálogos de arquetipo y las copias ya divergían (solo exploración tenía `footprint`). Los cuatro la importan y la re-exportan para no romper a sus consumidores.
- Campo nuevo `contains?: ChemicalSubstanceId`: la sustancia que un reservorio trae DE FÁBRICA. Es dato de catálogo; el estado vivo sigue siendo `Blueprint.reservoirContents`.

## `engine/src/reservoir/initial-reservoir-contents.ts` · `factory-reservoir-contents.ts` (nuevo, 13e ronda 1)

- `indexFactoryReservoirContents` (puro, sobre specs) + `deriveInitialReservoirContents` (instancias → entradas llenas a `capacity`), y el singleton atado al catálogo real. **Es lo que faltaba para que 13e fuera jugable**: hasta acá todos los reservorios nacían vacíos, así que el ciclo extraer → sintetizar no tenía de dónde arrancar. Filtra el `RES(E)` de las baterías de 13b.
- Lo consumen `save/campaign-save-factory.ts` (campaña nueva) y `save/chapter-progression.ts` (semillas de capítulo).

## `engine/src/reservoir/reservoir-parameters.ts` (nuevo, 13e ronda 1)

- `EXTRACTION_BATCH_UNITS`: unidades por tarea de extracción. Con los tanques sembrados llenos, vaciar uno de un saque daba materia prima infinita; topear por tarea convierte la escasez en TIEMPO (cada lote es un viaje), en vez de autorar 21 cantidades a mano.

## `game/src/ui/widgets/kenney-card-list.ts` (modificado, 13e ronda 1)

- **Fix de un bug preexistente**: rexUI ancla cada hijo de un sizer por su CENTRO, pero las tarjetas dibujaban sus hijos con `origin(0,0)` desde ese punto — media tarjeta caía fuera de la máscara del `scrollablePanel` ("se ve cortado a la derecha de cada tarjeta"). Hijos relativos al centro (`left = -cardWidth/2`) + alto adaptativo al contenido medido en vez de fijo.

## `game/src/scenes/creative-workbench-scene.ts` (modificado, 13e ronda 1)

- `CHEM_COLUMNS`: el modo química deja de heredar el layout del grid físico (que no usa) y pasa a tres columnas — paleta → selección → resultado — sobre el alto completo. "Modo cableado"/"modo borrar" solo se crean en modo físico.

## `engine/src/mission/ship-task-effect.ts` (modificado, 13e ronda 2)
- `purge-reservoir` deja de borrar la entrada a mano: usa `drawFrom` + `gasInjection.inject(sectionId, …)` —
  la misma vía que `apply-substance`, porque es el mismo fenómeno físico con otra intención — y devuelve
  `{pouredSubstanceId, pouredAmount}`. `apply-substance` devuelve el mismo par.
- El case `dismantle` inyecta en la sección el contenido de los `dismantle-spill` que emitió la regla: hasta
  acá la sustancia derramada moría con la instancia sin llegar nunca a `atmosphere.gases`.

## `engine/src/tasks/task-scheduler.ts` + `task-events.types.ts` (modificado, 13e ronda 2)
- `TaskCompletedEvent` y la emisión de `completeTask` propagan `obtainedElements`, `overflowAmount`,
  `pouredSubstanceId` y `pouredAmount`. Es el único punto de traducción efecto→evento; sin esto los cuatro
  campos se calculaban y se perdían dentro del motor.

## `game/src/particles/particle-effect.types.ts` + `effect-registry.ts` (modificado, 13e ronda 2)
- `EventEffectOptions {tint?}` como 4º parámetro opcional de `EventDrivenEffect.trigger` y de
  `fireEventEffect`: permite que el color de un efecto dependa de datos que solo `/game` puede resolver (el
  registro químico) sin que `/engine` conozca colores.

## `game/src/particles/effects/salvage-hazard-effect.ts` (modificado, 13e ronda 2)
- `firePouredSubstance(scene, position, amount, tint)` — salpicadura + charco, extraído del efecto de derrame
  porque ahora hay tres formas de mojar el piso (derrame al desmontar, verter, purgar). `dismantleSpillEffect`
  delega en él.

## `game/src/render/palette.ts` (modificado, 13e ronda 2)
- `chemicalSubstanceColor(id, tags)` — color de cualquier sustancia: elemento curado > color por primer tag >
  neutro. Usado por el charco y por la nube de sección, que antes tenían colores fijos.

## `game/src/mission/mission-runtime.ts` (modificado, 13e ronda 2)
- `airborneSubstanceAt(sectionId)` — sustancia dominante en el aire SIN filtrar por tag, para uso visual;
  hermana de `contaminantAt`, que sigue siendo la de daño y la del siseo de alarma. `substanceTagsOf` expone
  los tags para que quien pinta derive el color. `BASELINE_GAS_KEYS` excluye O2/N2/CO2.
- `queuePurgeReservoir` pasa la `sectionId` en el payload (la que ya calculaba para el viaje).

## `game/src/scenes/floorplan-scene.ts` (modificado, 13e ronda 2)
- `notifySubstanceTaskResult(event)` — notificación por cada resultado de tarea de sustancia y charco visible
  en la celda de la tarea. El rechazo de `openWorkbench` pasa de `setStatus` a `NotificationCenter`.
- El handler de `core-loop-mode-changed` refresca el panel de acciones (el botón de la mesa depende del modo).

## `game/src/ui/widgets/mission-action-panel.ts` (modificado, 13e ronda 2)
- `fabricatorBlocked` en el contenido de instancia; `transferBlocked`/`applyBlocked`/`reservoirHint`/
  `openFabricatorBlocked` en los labels. Todos los botones del bloque de reservorio llevan el motivo en el
  label cuando están deshabilitados, no solo "Extraer".

## `engine/src/mission/section-gas-injection.ts` (modificado, 13e ronda 3)
- `isAirborneSubstance(substance)` — solo `state === "G"` o tag `VOLAT` pueden estar en el aire; un líquido
  inerte (el agua) se derrama al piso y no desplaza oxígeno. El discriminador es el ESTADO DE MATERIA, no el
  tag: `VOLAT` lo llevan 4 sustancias con estados G/S/L/L y solo alimenta reglas de combustión.
- `GasInjectionDeps {substanceOf, sectionVolumeOf}` — inyectadas al construir `TransientGasInjection`. La
  fracción pasa a dividirse por el volumen de la sección, como exige la espec de datos §4. Sin dependencias el
  comportamiento es el previo a la ronda 3.

## `game/src/particles/effects/atmosphere-state-effects.ts` (modificado, 13e ronda 3)
- `CLOUD_VISIBILITY_THRESHOLD` + `CLOUD_RAMP_PER_SECOND`: la nube tiene umbral de visibilidad y su
  concentración mostrada persigue a la real con retardo, en vez de saltar. La opacidad del emisor acompaña a
  la densidad.

## `game/src/ui/widgets/mission-action-panel.ts` (modificado, 13e ronda 3)
- `attachPanelScroll(...)` — convierte el panel en ventana con scroll (máscara sobre un sub-container + rueda
  del mouse + indicador "▾") cuando el contenido excede `maxHeight`. No usa `ScrollablePanel` de rexUI porque
  todo el apilado del panel usa coordenadas absolutas y rexUI re-centra a sus hijos.

## `game/src/render/render-depths.ts` (modificado, 13e ronda 3)
- `hudFloatingPanel: 25` — depth propio para el panel de acciones flotante, entre `hudContent` y
  `notification`. Compartir el 21 con la tira de tripulación hacía que la tira lo tapara al re-crearse.

## `game/src/scenes/floorplan-scene.ts` (modificado, 13e ronda 4)
- `installTopmostOnlyInput()` — sobrescribe `input.sortGameObjects` para que el objeto de UI de capa más alta
  sea el ÚNICO que recibe el click. El `topOnly` nativo no alcanza: ordena por el índice en el `renderList` de
  la cámara del puntero, donde los `Label` de rexUI no entran, y el hit-test ignora las listas `ignore` de
  cámara (que solo afectan al render), así que un objeto de mundo tiene área de click fantasma sobre el HUD.

## `game/src/render/palette.ts` (modificado, 13e ronda 4)
- `CHEMICAL_COMPOUND_COLORS` — color curado por compuesto del catálogo, consultado por
  `chemicalSubstanceColor` antes de caer al color por tag. Sin esto el agua se pintaba con el gris genérico de
  `INERTE`, que además era el mismo valor que el neutro de "desconocida" y que `ANCHOR_COLOR`; los tres son
  ahora distintos y `palette.contract.test.ts` lo fija.

## `game/src/particles/effects/salvage-hazard-effect.ts` (modificado, 13e ronda 4)
- `firePouredSubstance` acepta un hook de registro de objetos, para que la escena les asigne cámara de mundo
  (sin él caía en el bug de doble-cámara) y usa `RENDER_DEPTH.substanceSpill` en vez de `bloodDecal`.

## `game/src/ui/widgets/mission-action-panel.ts` (modificado, 13e ronda 5)
- `backdrop` gana `setInteractive()` (sin handler de click propio) — entra al hit-test de
  `installTopmostOnlyInput`, cierra el agujero por el que el click al área vacía del panel atravesaba al mundo.
- `attachPanelDrag(...)` — arrastre del panel por click&hold sobre el backdrop (`pointerdown` local +
  `pointermove`/`pointerup` globales en `scene.input`, mismo patrón que `kenney-slider.ts`). Nuevo
  `ActionPanelCallbacks.onPanelDragged?`.

## `game/src/mission/mission-interaction-controller.ts` (modificado, 13e ronda 5)
- `manualPanelPosition` (getter) — posición manual tras un arrastre, escrita por `onPanelDragged`. Se limpia en
  `setActionPanelContent` (cambio de objetivo del panel); sobrevive a un rebuild por `refreshActionPanel`.

## `game/src/scenes/floorplan-scene.ts` (modificado, 13e ronda 5)
- `updateActionPanelAnchor()` — si `interaction.manualPanelPosition` existe, la usa (clampeada al mismo borde
  que el anclaje automático) en vez de recalcular desde `selectedCell`.
- Notificación de `combine` reemplazada: consume `mission.consumeMaterializedByTask(event.taskId)` en vez de
  comparar `availableSubstances.length`/`installableCreations.length` (frágil ante deduplicación por `Set`).
  Elimina `lastSubstancesCount`/`lastCreationsCount`.
- `fireCollectionBurst(originCell, targetCell, count)` — helper extraído de `fireElementCollection` (stagea N
  "monedas" en arco hacia una mesa). `notifySubstanceTaskResult` lo usa para volar una moneda por sustancia
  distinta desde una extracción de reservorio hacia `mission.benchCell("quimica")`.

## `game/src/mission/mission-runtime.ts` (modificado, 13e ronda 5)
- `materializedByTaskId` + `consumeMaterializedByTask(taskId)` — qué materializó cada tarea `combine`
  (sustancia o creación), poblado en el mismo listener de `task-completed` que ya materializa. Patrón "drenar y
  limpiar", mismo criterio que `TransientGasInjection.asInjectionSource()`.
- `benchCell(domain: FabricatorDomain = "fisica")` — generalizado por dominio (antes hardcodeaba `"fisica"`),
  reusando `findFabricators` que ya lo soporta.

## `game/src/mission/mission-runtime.ts` (modificado, 13e ronda 6)
- `transferTargetsFor` exige `freeCapacity(...) > 0` además de capacidad de catálogo y alcanzabilidad — un
  reservorio ya lleno deja de contar como destino válido (antes se ofrecía igual, y el motor perdía el 100%
  del origen como "desborde total" al ejecutar).

## `engine/src/mission/ship-task-effect.ts` (modificado, 13e ronda 6)
- Caso `"transfer-substance"`: chequea `freeCapacity` del destino ANTES de `drawFrom` — con 0, la tarea es un
  no-op (defensa en profundidad, cubre la carrera de que el destino se llene entre armar el panel y ejecutar
  la tarea). El desborde PARCIAL (destino con algo de lugar, pero no todo) sigue igual que antes.

## `engine/src/mission/ship-task-effect.ts` (modificado, 13e ronda 7)
- Caso `"transfer-substance"`: devuelve `pouredSubstanceId`/`pouredAmount` cuando `poured.poured > 0`, además
  de `overflowAmount` — antes un trasvase 100% exitoso no reportaba nada.
- Caso `"install"`: nueva rama `isCompositeEntity(definition) && payload.consumeRecipe` — consume la receta
  completa (bucket `nuevo`, mismo `consumeStock` estricto que el camino atómico) antes de instalar. Las
  creaciones personalizadas nunca ponen ese flag, así que siguen gratis.

## `engine/src/tasks/task.types.ts` (modificado, 13e ronda 7)
- `InstallTaskPayload.consumeRecipe?: boolean` — distingue un compuesto de catálogo instalado desde
  "Inventario" (gasta receta) de una creación personalizada (gratis).

## `engine/src/index.ts` (modificado, 13e ronda 7)
- Exporta `ALL_COMPOSITE_SPECS` (`build-component-catalog.ts`) — lista estática del catálogo de compuestos,
  sin las creaciones personalizadas que se registran en caliente en el mismo `componentRegistry`.

## `game/src/mission/mission-runtime.ts` (modificado, 13e ronda 7)
- `transferTargetsFor` → `transferCandidatesFor`: devuelve TODOS los reservorios de la nave (cualquier
  dominio) con motivo de bloqueo (`"full"` | `"unreachable"` | `"different-substance"`) en vez de solo los ya
  válidos — el modo de selección espacial necesita ver los bloqueados para iluminarlos en rojo.
- `installableCatalogComposites` (getter) / `hasRecipeStockFor(definition)` — compuestos de catálogo (no
  creaciones) con stock suficiente de su receta, para la pestaña "Inventario".
- `queueInstall` gana el parámetro `consumeRecipe?: boolean`, propagado al payload de la tarea.

## `game/src/mission/mission-interaction-controller.ts` (modificado, 13e ronda 7)
- Nuevo modo de interacción `transferModeState` (hermano de `wireModeValue`): `startTransferMode`,
  `cancelTransferMode`, `handleTransferModeClick`, getters `transferMode`/`transferModeOrigin`/
  `transferModeCandidates`. `handleMapClick` lo intercepta igual que `wireModeValue`.
- `buildInventoryOptions` suma una tercera fuente (compuestos de catálogo con `consumesRecipe: true`) además
  de piezas atómicas y creaciones personalizadas.
- Nuevo callback `MissionInteractionCallbacks.onTransferModeChanged`.

## `game/src/scenes/floorplan-scene.ts` (modificado, 13e ronda 7)
- `updateTransferMode()` — punto de entrada único del modo de trasvase: botón "Cancelar trasvase" (mismo
  casillero que `wireModeButton`, mutuamente excluyentes), oscurecido de todo el plano (`transferDimOverlay`),
  un anillo verde/rojo por reservorio candidato (`transferHighlights`, `CRISIS_SAFE_COLOR`/`CRISIS_FATAL_COLOR`)
  y forzado/restaurado de la capa `fluido`.
- `updateTransferChannel(pointer)` — línea recta origen↔candidato-bajo-cursor, coloreada según si hay camino.
- `instanceCell(instanceId)` — helper extraído del lookup que ya hacía `taskTargetCell` para `dismantle`.
- `notifySubstanceTaskResult`: rama propia para `event.type === "transfer-substance"` (notificación +
  `fireCollectionBurst` hacia el destino elegido) en vez de reusar el charco de verter/purgar.

## `game/src/render/render-depths.ts` (modificado, 13e ronda 7)
- `mapDimOverlay: 5.8` (oscurecido del modo de trasvase) y `transferTargetHighlight: 6.1` (resaltados de
  reservorio, por encima del oscurecido).

## `game/src/ui/widgets/install-picker-modal.ts` (modificado, 13e ronda 7)
- `InstallPickerOption.consumesRecipe?: boolean` — marca las filas de compuesto de catálogo que gastan su
  receta al instalarse.

## `game/src/render/conduit-path.ts` (modificado, 13e ronda 8)
- `computeSignalWireRoute` generalizada a `computeConduitRoute(floorplan, walkableGrid, from, to, kind)`;
  `computeSignalWireRoute` queda como wrapper de una línea (`kind: "senal"`) para no tocar el cableado.

## `game/src/render/floorplan-renderer.ts` (modificado, 13e ronda 8)
- `drawConduitLine`/`drawConduitMarker` pasan a exportadas — reusadas por `FloorplanScene.updateTransferMode`
  para clonar la capa `fluido` fuera del container `base` (fix del bug de depth #5).

## `game/src/render/render-depths.ts` (modificado, 13e ronda 8)
- `transferHighlightedConduit: 5.9` — depth del clon top-level de la capa `fluido` durante el modo de
  trasvase, entre `mapDimOverlay` (5.8) y `problemMarker` (6).

## `game/src/render/mission-overlay-renderer.ts` (modificado, 13e ronda 8)
- Nuevo `componentSpritesByInstanceId` en `MissionOverlayRender` — sprites reales por instancia, poblado en el
  branch de sprite real y en `drawCreationLayout` (ahora devuelve los `Image` que dibuja). Usado por el
  resaltado del modo de trasvase para tintar la pieza misma cuando tiene arte real.

## `game/src/scenes/floorplan-scene.ts` (modificado, 13e ronda 8)
- `updateTransferMode()`: oculta `conduitLayers.fluido` y dibuja su clon top-level
  (`transferFluidoHighlightLayer`, fix del bug de depth); `transferHighlights` pasa de `Arc[]` (círculos) a
  `Rectangle[]` (contorno de footprint real vía `instancePlacement`); tinta los sprites reales de los
  candidatos (`transferTintedSprites`, restaurados por `restoreTransferTintedSprites`).
- `updateTransferChannel(pointer)`: usa `computeConduitRoute(..., "fluido")` para dibujar la ruta real en vez
  de una línea recta.
- Listener `keydown-ESC`: cancela el modo de trasvase si está activo, antes de caer al comportamiento previo
  de pausa.
- Nuevo helper `instancePlacement(instanceId)` (placement completo, no solo la celda de `instanceCell`).

## `game/src/mission/mission-interaction-controller.ts` (modificado, 13e ronda 8)
- `handleTransferModeClick` recalcula `transferCandidatesFor` en el momento del click en vez de leer la lista
  cacheada al abrir el modo (candidato más plausible del aviso de pérdida reportado, sin garantía).
- `buildInventoryOptions`/`buildCatalogOptions` se fusionan en `buildInstallOptions()` — lista única,
  habilitados primero, bloqueados después con motivo. Nuevo helper `missingIngredientNames(definition)`.
- `installPickerState` pierde `activeTab`/`inventoryOptions`/`catalogOptions` → un solo campo `options`.

## `game/src/mission/mission-runtime.ts` (modificado, 13e ronda 8)
- Nuevo `missingRecipeIngredients(definition)` — ingredientes de receta que faltan (bucket `nuevo`, mismo
  criterio que `hasRecipeStockFor`), para explicar el motivo de bloqueo en el selector de instalación.

## `game/src/ui/widgets/install-picker-modal.ts` (modificado, 13e ronda 8)
- Elimina `InstallPickerTab`/`activeTab`/`renderTabStrip`/el hint de "Catálogo" — `renderInstallPickerModal`
  pasa a recibir un único `options: ReadonlyArray<InstallPickerOption>`.
- `InstallPickerOption` gana `blocked?: "no-stock" | "missing-ingredients"` y `missingIngredientNames?`. La
  fila deshabilitada explica el motivo directo en su texto (`optionRowLabel`); la ficha de detalle
  (`renderSelectedComponentSheet`) suma una línea ámbar con el motivo cuando el ítem está bloqueado.

## `engine/src/crisis/campaign/chapter-01-primer-aviso.ts` (modificado, 13e ronda 8)
- `CHAPTER_01_INITIAL_ATOMIC_STOCK` suma `tubo-flexible: 1`, `valvula-simple: 1`, sube `junta-hermetica` de 1 a
  2 — completa la receta del segundo reservorio (1+1+2, `exploracion.ts`).

## `game/src/ui/widgets/kenney-list.ts` (modificado, 13e ronda 9)
- `KenneyListItem` gana `muted?: boolean` — atenuado visual independiente de `enabled` (clickeable). El color
  de texto/alpha de fondo depende de `(enabled ?? true) && !muted`; `setInteractive`/`onClick` siguen
  dependiendo solo de `enabled`.

## `game/src/ui/widgets/install-picker-modal.ts` (modificado, 13e ronda 9)
- Filas de la lista: `enabled: true` siempre (seleccionables aunque estén bloqueadas), `muted: !!option.blocked`
  para el atenuado visual — el botón "Instalar" sigue gateado por `selected?.blocked`.
- `renderSelectedComponentSheet`: la huella se ancla en `titleText.y + titleText.height + 4` en vez de un
  offset fijo — ya no se superpone cuando el título ocupa 2 líneas.

## `game/src/ui/widgets/mission-action-panel.ts` (modificado, 13e ronda 9)
- `CompositionIngredient` gana `hasStock?: boolean` — `false` marca el ingrediente puntual sin stock
  suficiente (independiente de `hasRequiredTag`).

## `game/src/ui/widgets/composition-list.ts` (modificado, 13e ronda 9)
- `renderCompositionLines` agrega el sufijo `"(sin stock)"`/`"(no stock)"` (i18n) en gris atenuado (`#8890a8`,
  mismo tono que las filas deshabilitadas de `kenney-list.ts`) cuando `ingredient.hasStock === false`, con
  prioridad sobre el resaltado ámbar de `hasRequiredTag`.

## `game/src/mission/mission-interaction-controller.ts` (modificado, 13e ronda 9)
- `buildComposition` gana `options?: { highlightRequiredTag?; missingRefs? }` — `buildInstallOptions` pasa
  `highlightRequiredTag: false` (sin ámbar de objetivo de misión en este contexto) y `missingRefs` desde
  `mission.missingRecipeIngredients(def)` para marcar `hasStock` por ingrediente.
- `handleTransferModeClick`: la cantidad encolada pasa a `Math.min(content.amount, candidate.freeCapacity)` en
  vez del contenido completo del origen.
- `transferModeState.candidates`/`transferModeCandidates` derivan de `ReturnType<MissionRuntime["transferCandidatesFor"]>`
  en vez de duplicar la forma a mano.

## `game/src/mission/mission-runtime.ts` (modificado, 13e ronda 9)
- `transferCandidatesFor` expone `freeCapacity: number` por candidato (ya se computaba internamente para
  decidir el motivo `"full"`).

## `game/src/scenes/floorplan-scene.ts` (modificado, 13e ronda 9)
- `transferModePriorFluidoActive: boolean` → `transferModePriorActiveLayers: ReadonlySet<FloorplanLayerId>`
  (snapshot completo). `updateTransferMode()` reemplaza `activeFloorplanLayers` por `{"fluido"}` exacto (no
  solo agrega) y llama `applyLayerAlpha` para todas las capas — apaga los tokens de flujo animado de las
  demás capas sin tocar `updateConduitFlowEffects`/`updateSignalWireFlowEffects`.
- `updateTransferChannel`: usa `instancePlacement(...)` + `occupiedCells(...)` (huella completa) en vez de
  `instanceCell(...)` (una sola celda) para resolver el candidato bajo el cursor.

## `game/src/i18n/es.ts` (modificado, 13e ronda 9)
- Renombradas las 8 entradas que decían "trasvasar"/"trasvase" a la familia "transferir"/"transferencia"
  (claves sin cambio, ya en inglés). Nueva clave `ui.floorplan.mission.composition-no-stock`.

## `game/src/ui/widgets/install-picker-modal.ts` (modificado, 13e ronda 10)
- `optionRowLabel` ya no agrega el motivo de bloqueo al texto de la fila (el atenuado `muted` ya distingue).
  `InstallPickerOption.missingIngredientNames` eliminado (sin consumidores).
- `InstallPickerLabels.blockedMissingIngredients` pasa de función `(names) => string` a string estático,
  igual que `blockedNoStock`. `renderSelectedComponentSheet` avanza `lineY` con `warningText.height + 8` en
  vez de un offset fijo — no pisa más la sección de Composición cuando el warning envuelve a 2+ líneas.

## `game/src/mission/mission-interaction-controller.ts` (modificado, 13e ronda 10)
- `missingIngredientNames()` (helper privado) eliminado junto con su único call site.
- `buildInstallOptions`: `blockedMissingIngredients` label pasa a texto estático sin `.replace("{names}", ...)`.
- `handleTransferModeClick`: la rama de `candidate.blocked` reproduce
  `scene.sound.play(pickSoundKey(AUDIO_KEYS.uiDenied))` antes de `setStatus(...)`.

## `engine/src/tasks/task-scheduler.ts` + `task-events.types.ts` (modificado, 13e ronda 10)
- Nueva regla transversal "sin energía, la máquina no actúa": `TaskSchedulerOptions.isSectionUnpowered?:
  (sectionId) => boolean`; `POWER_EXEMPT_TASK_TYPES` (`dismantle`, `cut-power`, `purge-reservoir`,
  `discharge-source`) queda fuera. `resolveBlockingReason` devuelve el nuevo motivo `"no-power"` cuando
  `task.targetSectionId` está definido, el tipo no es exento, y la sección no tiene energía otorgada —
  evaluado DESPUÉS del bloqueo por dependencias, que tiene prioridad. `TaskBlockedEvent["reason"]` gana el
  literal `"no-power"`.

## `game/src/mission/mission-runtime.ts` (modificado, 13e ronda 10)
- `new TaskScheduler(...)` pasa `isSectionUnpowered: (sectionId) => this.powerRuntime.sectionHasNoPowerGranted(sectionId)`.
- `sectionHasNoPowerGranted` (delegado) documentado como segundo consumidor real de gating, no solo cosmético.

## `engine/src/power/mission-power-runtime.ts` (modificado, 13e ronda 10)
- `sectionHasNoPowerGranted` deja de documentarse como "puramente cosmético, nunca para gating" — ahora
  también alimenta `TaskScheduler` (gating de tareas); el gating de señales/HUD sigue usando
  `unpoweredSectionIds` (cicatriz permanente), sin cambios de comportamiento ahí.

## `game/src/scenes/floorplan-scene.ts` (modificado, 13e ronda 10)
- Notificación de `task-blocked` distingue `event.reason === "no-power"` con la clave
  `ui.floorplan.notification.task-blocked-no-power` en vez del texto genérico.

## `game/src/ui/widgets/kenney-list.ts` (modificado, 13e ronda 11)
- `pointerout` restaura `dimmed ? 0.25 : ROW_BG_ALPHA` en vez de un alpha normal hardcodeado — una fila
  atenuada (`muted`) ya no queda con el color de fondo normal tras alejar el mouse.

## `engine/src/tasks/task.types.ts` + `task-factory.ts` (modificado, 13e ronda 11)
- `CrewTask`/`CreateCrewTaskInput` ganan `readonly powerSectionIds?: ReadonlyArray<SectionId>` —
  independiente de `targetSectionId` (que sigue existiendo para ubicación del actor/animación de camino).
  Ausente/vacío = la tarea nunca se gatea por energía.

## `engine/src/tasks/task-scheduler.ts` (modificado, 13e ronda 11)
- `POWER_EXEMPT_TASK_TYPES` eliminado. `resolveBlockingReason` itera `task.powerSectionIds ?? []` y
  bloquea con `"no-power"` si CUALQUIERA de esas secciones no tiene energía — reemplaza el gate por
  `targetSectionId` + lista de tipos exentos de la ronda 10 (no podía expresar "dos secciones distintas"
  sin un switch por tipo).

## `game/src/mission/mission-runtime.ts` (modificado, 13e ronda 11)
- `queueTransferSubstance`/`queueApplySubstance` pasan `powerSectionIds` con AMBAS secciones (origen y
  destino) — corrige que transferir hacia un destino sin energía no se bloqueaba.
- `queueExtractElements`/`queueAnalyzeSubstance`/`queueFabrication`/`queueSynthesis` pasan
  `powerSectionIds: [targetSectionId]` (mismo comportamiento que la ronda 10, migrado al campo nuevo).
- `queueGoTo`/`queueDismantle`/`queueCutPower`/`queuePurgeReservoir`/`queueDischargeSource`/`queueInstall`/
  `queueConnect`: sin cambios — nunca fijan `powerSectionIds`, así que nunca se gatean.

## `game/src/i18n/es.ts` / `en.ts` (modificado, 13e ronda 10)
- `blocked-missing-ingredients` deja de llevar `{names}`. Nueva clave
  `ui.floorplan.notification.task-blocked-no-power`.

## `game/src/render/shadows/light-grid.ts` (nuevo, Fase 12d.5)
- `computeLightLevelGrid` — nivel de luz 0..1 por celda, PURO (sin Phaser). Reusa `raySegmentIntersection` de
  `visibility-polygon.ts`, así que la oclusión es la misma geometría que dibuja la RT de sombras. Recorta por
  bbox de radio antes del raycast; combina luces con `max` (no suma) y usa `ambient` como piso.
- `LIGHT_CLEAR_ALPHA_FLOOR` — piso de aclarado de una luz; única fuente del valor, lo importa `dynamic-shadows.ts`.

## `game/src/render/shadows/light-shading.ts` (nuevo, Fase 12d.5)
- `shade(baseColor, level)` — color × nivel de luz, canal por canal. `NEUTRAL_TINT`, y `actorLightLevel` con
  `MIN_ACTOR_LIGHT_LEVEL` (piso de brillo para tripulación/enemigos: se oscurecen, nunca desaparecen).

## `game/src/render/shadows/dynamic-shadows.ts` (modificado, Fase 12d.5)
- `lightGrid(w, h, cell)` — expone la grilla de nivel de luz, cacheada por firma (`staticOccludersVersion` +
  estado de cada luz + ambiente). Usa SOLO oclusores estáticos: los móviles son las cosas que se tintan y se
  ocluirían a sí mismas. `ambient` se deriva del mismo `darknessAlpha × intensity` que pinta la RT.
- `quantizeIntensity` + `staticOccludersVersion` — evitan que el parpadeo de las luces de cicatriz invalide el
  cache 60 veces por segundo. `currentEdges()` extrae la composición estáticos ∪ dinámicos que ya usaba `redraw`.

## `game/src/render/render-depths.ts` (modificado, Fase 12d.5)
- `dynamicLight` (1.8) — luz aditiva persistente entre las sombras (1.7) y los objetos (2): la luz actúa sobre
  el plano del suelo, no sobre los sprites. Antes toda luz vivía en `effect` (7), encima de todo.

## `game/src/scenes/floorplan-scene.ts` (modificado, Fase 12d.5)
- `applyLightShading()` — pinta componentes, LEDs y tokens con `base × nivel de luz de su celda`. Corre por
  frame junto al `redraw()` de sombras. No toca affordances de UI (hover, anillos, marcador).
- `baseTints` (`WeakMap`) + `baseTintOf`/`setBaseTint`/`applyShadedTint` — único punto de escritura de tinte.
  El LED y el resaltado de trasvase escriben la BASE; solo `applyLightShading` llama a `setTint`/`setFillStyle`.
- `registerLight` pasa a `dynamicLight`; `registerBurstLight` (nuevo) deja el fogonazo de un burst en `effect`.
- `registerEffectObject` + `worldEffectOptions` — registro único de todo objeto creado por un efecto de evento
  (cámara de mundo + depth para emisores, `registerBurstLight` para luces, decals con su propia capa).

## `game/src/particles/` (modificado, Fase 12d.5)
- `particle-effect.types.ts` — `ObjectCreatedHook` con nombre propio; `EventEffectOptions.onObjectCreated` lo reusa.
- `particle-utils.ts` — `spawnBurst`/`spawnDecal` aceptan el hook como último parámetro opcional.
- `effects/*.ts` — los 15 efectos del registro propagan el hook (antes solo `salvage-hazard-effect.ts`).
  `combustion-effect.ts` registra además su `PointLight` (deuda #16 residual).

## `game/src/render/shadows/light-grid.ts` (modificado, Fase 12d.6)
- La contribución de una luz deja de leer `intensity` (`falloff(dist/radio)` a secas): esa propiedad es el
  brillo del glow aditivo, no opacidad de oscurecido, y mezclar ambas escalas dejaba todo iluminado a 0.65
  contra 0.50 sin luz. `LIGHT_CLEAR_ALPHA_FLOOR` sigue exportada solo para la RT de sombras, con la nota de
  por qué el sombreado de sprites NO debe leerla.

## `game/src/scenes/dev-event-samples.ts` (nuevo, Fase 12d.6)
- `DEV_EVENT_SAMPLES` — catálogo de `DomainEvent` de muestra, uno por fenómeno del registro. Extraído de
  `particle-gallery-scene.ts` para compartirlo con la tecla de dev del plano de misión.

## `game/src/scenes/floorplan-scene.ts` (modificado, Fase 12d.6)
- `fireDevEventSample()` + tecla **F** — dispara el siguiente fenómeno del catálogo en la celda seleccionada
  por el camino de producción (`fireEventEffect` + `worldEffectOptions` + `fireEventSound`). Única forma de
  verificar el bug de doble-cámara: la galería (tecla G) tiene una sola cámara.
- `forEachShadedTarget` — lista única de objetivos del sombreado, para que `applyLightShading` y
  `clearLightShading` (nueva, devuelve todo a brillo pleno) no puedan divergir.
- `spriteCopyAboveDim` — copia top-level del sprite de un candidato de trasvase por encima del oscurecido;
  el original no se puede subir porque vive dentro del container del overlay. Reemplaza el tinte plano y el
  relleno del recuadro, y elimina `transferTintedSprites`.

## `game/src/i18n/es.ts` / `en.ts` (modificado, Fase 12d.6)
- `ui.floorplan.dev.no-cell` / `ui.floorplan.dev.fired` — avisos de la tecla de dev.

## `game/src/particles/effects/dynamic-light.ts` (modificado, Fase 12d.7)
- `createBurstLight` — luz de burst con ciclo de vida completo: parpadeo → desvanecido → destrucción, con las
  fases encadenadas por `onComplete` (dos tweens sobre `intensity` se pelean si se solapan). Es la mitad que
  faltaba del módulo: solo existía `createDynamicLight` (luz persistente), así que los dos bursts del proyecto
  copiaban el patrón a mano y ambos destruían la luz sin fade.
- Consumidores: `combustion-effect.ts` (`sustainMs` = duración de la llama, `fadeMs` = 1.5×, misma vida total
  que antes) y `environmental-damage-effect.ts` (arco eléctrico, `fadeMs` 200).

## `engine/src/integrity/` (dominio nuevo, Subfase 13f)
- `section-integrity.types.ts` — `SectionIntegrity` (hp/maxHp/breached, escalares mutables) + `SectionIntegritySnapshot`
  y su round-trip. Molde exacto de `atmosphere/section.types.ts` + `atmosphere-snapshot.types.ts`.
  `initialSectionIntegrity` escala la vida con `sectionArea()`.
- `section-integrity-parameters.ts` — TODO el balance de la subfase (hp por celda, daño por escritor, umbral y piso de
  descompresión, drenaje y piso de presión de la brecha, RE mínima del parche, rango de explosiones del colapso).
  Ninguna regla tiene literales propios.
- `section-damage-rules.ts` — **Strategy**, molde de `dismantle-hazard-rules.ts`. Dos familias: ambientales por tick
  (`corrosionDamageRule`, `decompressionDamageRule`) y puntuales por evento (`kineticImpactSectionDamage`,
  `combustionSectionDamage`, funciones puras: no hay nada que acumular). La descompresión devuelve un `floorHp` y por
  eso **no puede colapsar una sección por sí sola** — es la amortiguación del bucle de realimentación, estructural y no
  un número afinado a ojo.
- `section-integrity.ts` — `applySectionDamage`: aplica, emite `section-damaged` solo al CRUZAR de nivel del corte del
  HUD (`fractionToLevel`, así el evento coincide con lo que ve el jugador) y `section-breached` una sola vez.
- `integrity-events.types.ts` — `SectionDamagedEvent`/`SectionBreachedEvent` (con `breachCell`) + `SectionDamageCause`.
- `breach-cell.ts` (ronda 1 de playtest de 13f) — `hullBreachCell`/`isHullEdgeCell`, puras: la brecha se abre en la celda
  de la sección que TOCA el exterior más cercana al origen del daño, con desempate determinista. Antes se usaba el
  centroide y el agujero aparecía en medio del piso, lejos de donde el jugador había clickeado.

## `engine/src/mission/mission-section-integrity-runtime.ts` (nuevo, Subfase 13f)
- `MissionSectionIntegrityRuntime` — `Tickable`, molde de `MissionStructuralRuntime`; se registra tras `atmosphereRuntime`.
  Corrosión y descompresión por tick; impacto contra pared y combustión por suscripción. Al colapsar: brecha, desgaste de
  toda la maquinaria de la sección (reusa `worsenWear`, no un segundo eje de daño) y 1..N combustiones REALES por el
  emisor de reacciones. `ignoredCombustionRefs` evita que el colapso se dañe a sí mismo en bucle. Expone `fractionOf`/
  `weightedFractions` (implementa `SectionIntegritySource`), `openBreaches`, `pressureFloorFor` y `toSnapshots`.
  `weightedFractions` pondera cada sección por su `maxHp` y multiplica el peso de las brechadas
  (`breachedSectionWeightMultiplier`) — ronda 1 de playtest: la agregación "peor sección gana" hundía el casco de toda
  la nave por una sala, y la media plana no lo movía casi nada.

## `engine/src/mission/section-breach-pressure-sink.ts` (nuevo, Subfase 13f)
- `sectionBreachPressureSink` — hermano de `sealBreachPressureSink` con una diferencia física deliberada: la brecha no
  recupera presión al taparse, solo deja de drenar. `isBreachPatch` decide qué sirve de parche **por propiedades**
  (`EST` + RE efectiva suficiente, principio 1) y no por lista de ids; `isBreachSealed` mira TODAS las celdas ocupadas
  por la pieza, no solo su origen.

## `engine/src/mission/mission-hazard-runtime.ts` + `mission-hazard-parameters.ts` (nuevos, Subfase 13f)
- `MissionHazardRuntime` — llamador de producción que le faltaba a `HazardAccumulator` (deuda #16). Hermano del runtime
  de sección: misma lectura de atmósfera aplicada al tripulante. Tóxico, corrosivo y **vacío** (que usa la causa `"cold"`
  ya existente en vez de inventar un `kind` nuevo de `HazardEvent`). `incapacitation` hiere con `minHp: 1`, solo
  `lethal` mata. El vacío aplica **mordiscos discretos por actor** (~10 s hasta la muerte, el primero no letal como
  aviso): la versión original escalaba una fracción con `dtSeconds` y por frame redondeaba a cero daño mientras emitía
  un `crew-damaged` por frame.

## `engine/src/mission/kinetic-damage-handler.ts` (nuevo, Subfase 13f)
- `registerKineticDamage` — llamador de producción de `applyKineticDamage`, que existía desde 11a sin ninguno. Enemigos
  y tripulantes comparten la tabla `HP_LOSS_FRACTION` para que un impacto signifique lo mismo contra ambos.

## `engine/src/atmosphere/tagged-concentration.ts` (nuevo, Subfase 13f)
- `sectionTaggedConcentration` — el recorrido "gases contaminantes con tag X" que vivía copiado en `aggregateAtmosphere`
  y `sectionCorrosiveLevel`, extraído antes de que hiciera falta una tercera copia.

## `engine/src/kinetics/` (modificado, Subfase 13f)
- `KineticImpactEvent` gana `position` (celda golpeada) y `targetKind` (`component`/`crew`/`enemy`/`wall`) — huecos #1 y
  #2 del relevamiento. `CellOccupant` gana `kind`. `resolveKineticImpact` recibe el ocupante y la celda.
- `MissionProjectileWorld` acepta un objeto de opciones con `blocked` (el `CellBlockedQuery` que `MissionRuntime` YA
  tenía inyectado desde el tilemap — se reusa, no se duplica) y `gridSize`: un proyectil frena contra pared y contra el
  borde del plano (deuda #21).

## `engine/src/failure/` + `mission-overload-runtime.ts` (modificado, Subfase 13f)
- `OverloadEvent` gana `sectionId?`, estampado por `MissionOverloadRuntime` (que sí conoce el plano) al emitir; la regla
  sigue pura. El lookup manual `ref → sección` de `MissionReactionRuntime` se borró: una sola fuente de verdad.

## `engine/src/ship-status/` (modificado, Subfase 13f)
- **Borrados** `instanceHullContribution` y `weightedHullFraction` (parche interino de 13c) y
  `aggregateSectionHullIntegrity`. `aggregateHullIntegrity(sectionFractions)` ya no recibe componentes: "peor sección
  gana", mismo criterio que atmósfera y soporte vital.
- `SectionIntegritySource` — interfaz angosta NO opcional (a diferencia de `PowerSupplySource`): sin ella el indicador
  quedaría muerto. `ShipStatusQuery` dejó de necesitar el `componentRegistry`.

## `engine/src/mission/mission-atmosphere-runtime.ts` (modificado, Subfase 13f)
- `SectionPressureFloorSource` opcional: el piso de presión pasa a ser POR SECCIÓN. Una brechada llega a 0 kPa (vacío
  real); el resto conserva el `PRESSURE_SINK_FLOOR_KPA` de 11h, que sigue siendo correcto para una gotera.

## `engine/src/blueprint/` + `save/` (modificado, Subfase 13f)
- `Blueprint.sectionIntegrity` (`schemaVersion` 8→9), con el guard "ausente = `[]`" del serializer. Es el callback de
  cicatriz estructural que `Primeras_8_crisis.md` pide para los Cap. 3, 6, 7 y 8.

## `game/src/particles/effects/section-breach-effect.ts` + `audio/effects/section-breach-sound.ts` (nuevos, Subfase 13f)
- `sectionDamagedEffect` (polvo cayendo) y `sectionBreachedEffect` (chorro de descompresión largo + mancha permanente
  que marca dónde instalar el parche). El sonido reutiliza el banco de explosión grave: no hay asset de descompresión
  (deuda #40).

## `game/src/mission/mission-runtime.ts` (modificado, Subfase 13f)
- `sectionIntegrityRuntime`/`hazardRuntime` registrados tras `atmosphereRuntime` (leen corrosión y presión ya difundidas).
  Buses nuevos `integrityEvents` y **`atmosphereEvents`** — este último no existía, que es la razón de fondo por la que
  el sonido de corrosión de 12b nunca sonó. `sectionAt`/`elapsedSeconds` públicos.

## `game/src/scenes/floorplan-scene.ts` (modificado, Subfase 13f)
- Suscripción a `integrityEvents` (la brecha se pinta en SU celda, el daño en el centroide) y a `atmosphereEvents`. Una
  brecha dispara el mismo overlay de alerta y alarma que una combustión violenta.
- `fireDevSectionDamage()` + tecla **H** — emite una combustión REAL por el emisor del motor, o sea que recorre el
  camino de producción entero (daño, colapso, brecha, drenaje, desgaste). Existe porque ningún capítulo autorado tiene
  hoy forma jugable de dañar el casco, y sin esto los pasos de prueba manual serían imposibles de ejecutar.


## `game/src/meta/live-mission-save.ts` (nuevo, ronda 1 de playtest de 13f)
- Registro de una función `(base) => CampaignSaveState` que `FloorplanScene` publica al montar la misión y libera en su
  SHUTDOWN, para que `PauseMenuScene` pueda persistir el estado VIVO sin conocer `MissionRuntime`. Cierra un bug
  preexistente: "Guardar y salir" guardaba `campaignSession.touch()`, o sea solo `updatedAt`, y tiraba en silencio
  atmósfera, desgaste, `condition`, stock, química, HP y la cicatriz de casco.

## `game/src/meta/save-adapter.ts` (modificado, ronda 1 de playtest de 13f)
- `mostRecentCampaignSave()` — ordena por `metadata.updatedAt` y omite las partidas ilegibles. "Continuar" tomaba
  `saves[0]` de un `readdir` SIN ORDENAR, así que con varias campañas en disco entraba en una vieja sin ningún error
  visible (los guards de deserialización son tolerantes a propósito) y el jugador leía "los componentes desaparecieron".
  Se ordena por `updatedAt` y no por el timestamp del id, que marca la CREACIÓN y no el último guardado.
