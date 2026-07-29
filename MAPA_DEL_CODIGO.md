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
