# Mapa del código

Índice de módulos por dominio: **una entrada por módulo**, con lo que existe y para qué. Se ACTUALIZA la entrada existente al tocar un módulo — nunca se agrega una segunda para el mismo archivo. No es un changelog (eso vive en `docs/changelog/`) ni un historial de fases (`ORDEN_DE_TRABAJO.md`).

Se lee por sección de carpeta, no entero.

---

## `engine/src/atmosphere/`
- `tagged-concentration.ts` — `sectionTaggedConcentration`: punto único de "gases contaminantes con tag X".
- `diffusion.ts` — `diffuse()` equilibra `pressureKpa` además de las fracciones de gas, con la misma apertura y paso. Es lo que hace que una brecha se desangre por cada puerta abierta.
- `section.types.ts` / `atmosphere-snapshot.types.ts` — molde de estado por sección + round-trip de snapshot (referencia para `integrity/`).
- `thermal-parameters.ts` — **único lugar con números térmicos**: `NOMINAL_TEMPERATURE_CELSIUS` (única fuente del 21, la importa `standardSectionAtmosphere`), `PASSIVE_DRIFT_PER_SECOND`, `THERMAL_DIFFUSION_RATE_PER_SECOND`, `MIN_THERMAL_APERTURE`, clamps piso/techo, `THERMAL_SENSOR_TRIGGER_CELSIUS`, `AUTOIGNITION_CELSIUS` (90, **medido** contra la pila real: a 120 la propagación era imposible), `SPARK_IGNITION_SECONDS`, y las tablas `COMBUSTION_HEAT`/`OVERLOAD_HEAT` (autoradas como "+X °C en Y s", no como °C/s).
- `diffusion.ts` — tercer bloque de equilibrio (temperatura) junto a presión y gases, con tasa propia y piso de apertura: **una puerta cerrada detiene el gas y NO el calor**. El `continue` por apertura 0 exige que ambos pasos sean nulos.

## `engine/src/blueprint/`
- `blueprint.types.ts` + `blueprint-serializer.ts` — `Blueprint` y su serialización versionada. Campos acumulados: `overloadedRefs` (cicatriz de sobrecarga), `powerState` (`unpoweredSectionIds` es DERIVADO, recalculado por `MissionPowerRuntime`, y el único campo público que consumen `MissionSignalRuntime`/UI), `PlacedComponentInstance.wear` requerido (`structuralResistanceOverride` deprecado a solo-lectura), `sectionIntegrity`. `schemaVersion` actual **9**; cada subida trae su guard/migración con default en el serializer.

## `engine/src/chemistry/`
- `reaction/unidentified-mixture-factory.ts` — id determinístico de "Mezcla sin identificar" por unión ordenada de tags (incluye nivel para `TOX`/`CORR`); dos mezclas con distinto conjunto de tags no colisionan.
- `reaction/mixture-hazard-preview.ts` — `deriveMixtureHazardPreview`: función pura, radio de combustión (según O2 de sección) y segundos por nivel de degradación, sobre las constantes de `reaction-parameters.ts`.
- `reaction/reaction-events.types.ts` — `CombustionEvent.sectionId?` lo estampa `MissionReactionRuntime` al emitir, no `CombustionRule` (que sigue sin noción de mundo).
- `phase/phase-change.types.ts` — `PhaseChangePoints`, `PhaseTransition` y `AuthoredSubstanceData` (el tipo que vuelve obligatorios `state` + los dos puntos, y solo en las entradas de catálogo).
- `phase/phase-change-parameters.ts` — `DEFAULT_PHASE_POINTS_BY_STATE` (perfil de las sustancias sintetizadas en runtime), `PHASE_EXPANSION_KPA_PER_UNIT`/`_DURATION_SECONDS`, `FREEZE_DESTROYS_RESERVOIR_AT_WORST_WEAR`.
- `phase/matter-state.ts` — `phasePointsOf` (punto único de resolución catálogo/fallback), `effectiveMatterState`, `nominalStateOf`, `phaseTransitionOf`, `isFrozenAt`.
- `phase/phase-events.types.ts` — `SubstancePhaseChangeEvent` (sustancia suelta en una sección) y `ReservoirContentPhaseChangeEvent` (contenido de un tanque, con si dañó o destruyó el contenedor).
- `catalog/element-catalog.ts` + `compound-catalog.ts` — las 49 entradas declaran sus dos puntos de transición; `CRYOGENIC_SUBSTANCE_IDS` nombra las excepciones deliberadas al test de coherencia.
- `reaction/reaction-events.types.ts` — `NeutralizationEvent.sectionId` opcional, mismo criterio que el de `CombustionEvent`.

## `engine/src/components/`
- `physical-component.types.ts` — `CreationPart` (ref + offset + footprint + rotación) y `CompositeComponentData.layout?` para dibujar una creación con los sprites de sus partes; `data.powerDraw` como dato de componente, hermano de `footprint` (lo inyecta `withPowerDraw` al construir, los specs no lo autoran).
- `catalog/atomic-component-catalog.ts` — catálogo atómico. Incluye Indicador LED (1×1, `REC`), Pantalla LCD (2×1, `REC`, valor real vía `lcd-display-value.ts`) y Sensor de Presión (1×1, `EM`, `triggerType: "pressure"`). `material.RE` autorado en las 18 piezas que no lo declaraban.
- `catalog/composite/composite-component-spec.types.ts` — `CompositeComponentSpec` única, importada y re-exportada por los 4 catálogos de arquetipo. Campo `contains?: ChemicalSubstanceId`: sustancia de fábrica de un reservorio (el estado vivo es `Blueprint.reservoirContents`).
- `catalog/composite/guerra.ts` — `garra-de-abordaje` (solo `ACT`, cuerpo a cuerpo) frente a `torreta-automatizada` (`EM`+`ACT`, a distancia); `compuerta-blindada` con `ACT.cadence` 1.5 s, número compartido por simulación y animación.
- `catalog/composite/taller.ts` — `banco-de-trabajo` (FAB física) y `estacion-quimica` (FAB química + `RES(L)` de salida). Kit base de las 4 naves, sembrado en `initial-ship-state.ts`, no catálogo de arquetipo.
- `catalog/build-component-catalog.ts` — construcción del catálogo; exporta `ALL_COMPOSITE_SPECS` (lista estática, sin las creaciones registradas en caliente en `componentRegistry`). `powerUnits` autorado en las 8 fuentes `RES(E)` reales.
- `fabricator-query.ts` — `fabricatorDomainOf`/`instanceFabricatorDomain`/`findFabricators`/`hasFabricator`: punto ÚNICO de "¿qué instancias habilitan qué mesa?", resuelto por propiedad `FAB` y nunca por `ComponentId` (Principio 1). Una instancia `destroyed` deja de habilitar; `jammed` sigue.

## `engine/src/crew/`
- `crew-actor.types.ts` — `CrewActor` con `currentCell?: GridPosition` (compartido con `EnemyActor`).
- `crew-events.types.ts` — `CrewDamageCause` incluye `"enemy-attack"`.

## `engine/src/crisis/`
- `crisis-definition.types.ts` — `CrisisDefinition` con `scriptedOverloads?` (`ScriptedOverloadSubject`: `load`/`capacityOverride` para `MissionOverloadRuntime`) y `scriptedReactions?` (`ScriptedReactionSubject`: reactivos + `sectionId` + `ignitionTrigger`). Datos de guion; ausentes = ningún capítulo los usa.
- `campaign/chapter-01-primer-aviso.ts` — Capítulo 1. 3ª resolución `replacement-installed-connected` anclada en `sealPosition`, con `CHAPTER_01_SEAL_POSITION_BY_ARCHETYPE`, `..._SEAL_SECTION_ID_BY_ARCHETYPE`, `..._SEAL_ACCEPTABLE_COMPONENT_IDS` y tasas de drenaje/recuperación. `CHAPTER_01_OVERLOAD_INSTANCE_ID` + `overloadedConductorPosition` siembran un `cable-cobre` real. `CHAPTER_01_INITIAL_ATOMIC_STOCK` define el stock de arranque (re-balanceado en 14a-3; sigue siendo deuda #44).
- `crisis-rule.ts` — molde Strategy que reusan `enemies/combat-rule.ts` y los demás dominios.

## `engine/src/doors/`
- `door.types.ts` — `DoorId`/`DoorMode`/`DoorState`/`DoorOverrideSource`/`DoorRuntime`/`DoorSnapshot`. `DoorState` incluye `opening`/`closing` (la transición dura `ACT.cadence`, no es un escalón); `overrideSource` lleva el MOTIVO para que la UI diga por qué la puerta no responde. `blocksPathing(door)` y `blocksPassage(door)` son preguntas DISTINTAS: una puerta en `auto` con energía tapa la celda pero no es obstáculo para planificar ruta.
- `door-parameters.ts` — todo el balance (vida por `RE`, radio de auto-apertura, umbral de trabado magnético, coste de forzar). Ninguna regla tiene literales propios.
- `door-aperture.ts` — apertura [0,1]; `opening`/`closing` interpolan.
- `door-identity.ts` — `isDoorCapable` (`ACT`+`EST`), `doorActuator`, `doorTransitionSeconds`, `thresholdSectionsAt`. Identidad por propiedades y umbral por geometría; ninguna lista de ids.
- `door-governance.ts` + `door-rules/` + `door-rule-registry.ts` — Strategy con prioridad ORDENADA (destruida > trabada > sin energía > señal > tarea > auto). El orden vive en el registry y ES la semántica; `AutoProximityRule` va última porque es la única incondicional.
- `door-events.types.ts` — `door-transition`/`settled`/`override-changed`/`damaged`/`destroyed`/`repaired`/`crushed-actor`.
- `door-identity.ts` — `sectionsTouchingCell` (todas las secciones que toca una celda) y `cellSeparates` (¿toca estas dos?); `thresholdSectionsAt` está reescrita sobre el primero y conserva su semántica de inferencia.
- `door.types.ts` — `blocksPathing` mira el ESTADO antes que el modo: una hoja abierta o abriéndose no es obstáculo, la gobierne quien la gobierne.

## `engine/src/enemies/`
- `enemy-actor.types.ts` — `EnemyActor`: celda, arquetipo (`armored`/`agile`), arma de catálogo, state machine.
- `enemy-route.types.ts` + `route-progression.ts` — `ScriptedRoute`/`RouteWaypoint` y `cellAtElapsedSeconds` (snap discreto, sin interpolar).
- `weapon-damage.ts` — `weaponDamageSeverity`: `ActuatorProperty.power`/`cadence` → severidad cualitativa.
- `combat-rule.ts` + `rules/{melee-adjacency,ranged-proximity,combat-rule-registry}` — Strategy de rango de combate, molde de `crisis/crisis-rule.ts`.
- `enemy-attack-resolver.ts` — `resolveEnemyAttack`: orquesta arma + reglas + `applyCrewDamage`, sin mutar estado.
- `enemy-events.types.ts` — `enemy-advanced`/`enemy-attacked`/`enemy-defeated`, agregados a `DomainEvent`.
- `campaign/chapter-02-enemy-seed.ts` — `CHAPTER_02_INTRUSO` + su ruta; `ENEMY_SEED_BY_CHAPTER_ID` (análogo a `CHAPTER_SEED_BY_ID`). Ritmo ~0.33 s/celda.

## `engine/src/failure/`
- `OverloadEvent` gana `sectionId?`, estampado por `MissionOverloadRuntime` (que conoce el plano) al emitir; la regla sigue pura. Fuente única: `MissionReactionRuntime` ya no hace su propio lookup `ref → sección`.
- `thermal-conductivity-rule.ts` — `thermalCapacityFactor(temperatura, CT)` con **dos** ramas: fría (≤ -50) y caliente (≥ 100, desplazada por el `CT` del material). Lo consume `thermallyAdjustedConductorOverloadSubject`.

## `engine/src/floorplan/`
- `conduit-connectivity.ts` — `sectionsConnectedByConduit`/`findConduitRoute`: BFS sobre el grafo de secciones con aristas = conductos de un `kind` (multi-salto). `findConduitRoute` devuelve la secuencia y la reusa el render del cable en `/game`.
- `initial-ship-state.ts` — `starterKit(archetype)`: siembra el kit base y, en `"exploracion"`, las fuentes reales de energía (`EXPLORACION_POWER_SOURCE_CELLS`, celdas verificadas contra `nave-exploracion.json`). La oferta y el reparto inicial se siembran en el SAVE, no en el runtime (el runtime no distingue "nunca se asignó" de "el jugador puso 0").
- `parseConduits` — deriva `ConduitId` (`${kind}:${a}:${b}:${índice}`); el índice hace falta porque hay pares repetidos reales en `nave-exploracion`.
- `instantiate-door-seeds.ts` — `instantiateDoorSeeds`: la capa Tiled `puertas` (opcional, con `span`/`axis`) materializa INSTANCIAS reales de `compuerta-blindada` + su nodo receptor. Un vano de dos celdas es UNA instancia 2×1: dos piezas aportarían dos aristas de difusión.
- `floorplan-integrity` — validaciones: `door-self-reference`/`unknown-section`/`not-adjacent`/`outside-section`/`duplicate-id`.
- `floorplan-integrity.ts` — issue `door-not-a-threshold`: la celda de una puerta debe cumplir `cellSeparates` con las dos secciones que declara — **la misma precondición que exige el runtime** para darla de alta.

## `engine/src/geometry/`
- `line-of-sight.ts` — `hasLineOfSight(from, to, blocked: CellBlockedQuery)`: raycast tipo Bresenham, puro. `CellBlockedQuery` es el puerto mínimo que `/game` implementa sobre su `WalkableGrid`.

## `engine/src/index.ts`
- Barrel público del motor.

## `engine/src/instance-state/`
- `instance-state.types.ts` — `InstanceStateFlag` e `InstanceState`, que lleva el detalle numérico (`required`/`available`) como DATOS: el motor no arma texto de UI. Flags: `unpowered`, `frozen-content` y las demás del sistema genérico.
- `derive-instance-states.ts` — `deriveInstanceStates` con interfaz angosta inyectada (molde de `DoorWorldQueries`). `unpowered` exige `powerDraw > 0`.
- `InstanceStateFlag` completo: `unpowered`, `overloaded`, `unsignaled`, `frozen-content`. **El orden de emisión es la subprioridad visual** (`overloaded` va antes que `unpowered`). `InstanceStateQueries` suma `isInstanceOverloaded`, `signalStarvationOf` (devuelve los dos números demanda/capacidad, no un booleano) y `frozenContentOf`.

## `engine/src/integrity/`
- `section-integrity.types.ts` — `SectionIntegrity` (hp/maxHp/breached) + snapshot y round-trip; `initialSectionIntegrity` escala la vida con `sectionArea()`.
- `section-integrity-parameters.ts` — TODO el balance (hp por celda, daño por escritor, umbral y piso de descompresión, drenaje y piso de presión de la brecha, RE mínima del parche, rango de explosiones del colapso).
- `section-damage-rules.ts` — Strategy (molde de `dismantle-hazard-rules.ts`). Ambientales por tick (`corrosionDamageRule`, `decompressionDamageRule`) y puntuales por evento (`kineticImpactSectionDamage`, `combustionSectionDamage`). La descompresión devuelve un `floorHp` y **no puede colapsar una sección por sí sola**: es la amortiguación del bucle de realimentación.
- `section-integrity.ts` — `applySectionDamage`: emite `section-damaged` solo al CRUZAR nivel del corte del HUD (`fractionToLevel`) y `section-breached` una sola vez.
- `breach-cell.ts` — `hullBreachCell`/`isHullEdgeCell`, puras: la brecha se abre en la celda que TOCA el exterior más cercana al origen del daño, con desempate determinista.
- `integrity-events.types.ts` — `SectionDamagedEvent`/`SectionBreachedEvent` (con `breachCell`) + `SectionDamageCause`.
- `section-damage-rules.ts` — `thermalDamageRule`, quinto escritor, registrado en `SECTION_ENVIRONMENTAL_DAMAGE_RULES`. Dos lados (calor y frío) y **sin `floorHp`**. `SectionDamageCause` suma `"thermal"`.

## `engine/src/inventory/`
- `inventory.types.ts` — `AtomicPartsStock` con buckets por desgaste (`WearBuckets`): es dónde vive la historia de una pieza entre desmontarla y reinstalarla.
- `inventory-ledger.ts` — `stockOf` (total), `stockOfWear`/`wearBucketsOf`; `consumeStock`/`creditStock` operan sobre un bucket explícito y no caen a otro.
- `element-ledger.ts` + `mutable-element-stock.ts` — `ElementStock` y su ledger, sin buckets (una sustancia no acumula historia). `consumeElements` devuelve `null` sin descontar parcialmente, mismo contrato que `consumeStock`.
- `component-stock-cost.ts` — `componentStockCost(registry, id, wear, consumeRecipe)`: QUÉ cuesta materializar una pieza, **puro y sin mirar el stock** (atómico → 1 del bucket pedido; compuesto con receta → sus ingredientes en `nuevo`; compuesto sin el flag → gratis). Extraído de `payComponentCost`, que decidía y cobraba en el mismo sitio, porque la reserva necesitaba el cálculo sin la mutación. `stockCostKey(ref, wear)` es la clave de agregación por bucket.

## `engine/src/kinetics/`
- `KineticImpactEvent` con `position` (celda golpeada) y `targetKind` (`component`/`crew`/`enemy`/`wall`); `CellOccupant` con `kind`; `resolveKineticImpact` recibe ocupante y celda.
- `MissionProjectileWorld` toma opciones con `blocked` (el `CellBlockedQuery` que `MissionRuntime` ya tiene inyectado desde el tilemap) y `gridSize`: un proyectil frena contra pared y contra el borde del plano.
- `magnetic-acceleration.ts` — velocidad cualitativa acumulada y su decaimiento.

## `engine/src/mission/`
Todos los `*-runtime.ts` implementan `Tickable` y se registran en orden en `MissionRuntime`. El patrón común del dominio: **dependencias opcionales inyectadas** (`DismantleWearDeps`, `SalvageHazardDeps`, `DoorWorldQueries`, `GasInjectionDeps`, `SectionPressureSinkSource`…) — sin ellas el comportamiento previo queda intacto y los tests unitarios no se rompen.

**Orquestación y estado vivo**
- `mutable-crew-state.ts` — `MutableCrewState` + `isAlive`/`allAlive`/`markDead`: criterio ÚNICO de "vivo" (`hp > 0` más el eje `status` del permadeath), antes copiado en cada runtime que aplica daño.
- `mutable-enemy-state.ts` — espejo del anterior para enemigos (get/set/all).
- `mission-projectile-world.ts` — `occupantAt` resuelve contra componentes colocados, `crew` y `enemies`.

**Tareas y efectos**
- `ship-task-effect.ts` — `createShipTaskEffect`: el switch de efectos de toda tarea de nave. Casos: `install` (rama `isCompositeEntity && payload.consumeRecipe` consume la receta completa del bucket `nuevo`; las creaciones personalizadas no ponen el flag y siguen gratis), `dismantle` (acredita atómicas al `atomicStock`, degrada por tier del especialista, e inyecta en la sección el contenido de los `dismantle-spill`), `connect` (valida `assertSignalWiringReachable` cuando le inyectan `floorplan`), `cut-power`, `purge-reservoir` y `transfer-substance` (ambos vía `drawFrom` + `gasInjection.inject`, la misma vía que `apply-substance`; devuelven `pouredSubstanceId`/`pouredAmount` y `overflowAmount`; `transfer` chequea `freeCapacity` del destino ANTES de `drawFrom`). Exporta `dismantleHazardContext()`, que `/game` reusa para el badge de riesgo antes de encolar.
- `fluid-operations.ts` — `FluidOperationRegistry`: operaciones de fluido EN CURSO (trasvase/vertido/extracción/purga) enganchadas al ciclo de vida de la tarea. De acá sale el caudal real que anima la capa `fluido`; sin operación viva el conducto queda quieto.

**Atmósfera y presión**
- `mission-atmosphere-runtime.ts` — aplica el sumidero con clamp de dos lados (`PRESSURE_SINK_FLOOR_KPA` / `PRESSURE_RECOVERY_CEILING_KPA` = 101 kPa). `SectionPressureFloorSource` hace el piso POR SECCIÓN (una brechada llega a 0 kPa real). `SectionApertureSource` devuelve la lista COMPLETA de conexiones efectivas del tick (válvulas = misma arista con otra apertura, puertas = aristas adicionales); `diffuse()` no cambió. `netPressureRateOf(sectionId)`: tasa neta del último tick, estado de tick y no de dominio, sin consumidores en el motor — existe para que la UI diga "represurizando".
- `seal-breach-pressure-sink.ts` — drena mientras la junta del Cap. 1 está rota y RECUPERA (tasa negativa) al sellarse. Identifica "¿sellada?" por POSICIÓN + `componentDefinitionId` aceptables (`SealBreachConfig`), nunca por `instanceId`: reparar crea una instancia nueva.
- `section-breach-pressure-sink.ts` — mismo molde para la brecha de casco (drena 12 kPa/s, recupera 2). `isBreachPatch` decide qué sirve de parche **por propiedades** (`EST` + RE efectiva), no por lista de ids; `isBreachSealed` mira TODAS las celdas ocupadas por la pieza.
- `composite-pressure-sink.ts` — `composePressureSinks(...)`: suma sumideros respetando el signo (el runtime acepta uno solo).
- `composite-aperture-source.ts` — molde del anterior pero CONCATENA en vez de sumar por clave: entre dos secciones puede haber a la vez un ducto abierto y una puerta cerrada, y son dos caminos distintos.
- `section-gas-injection.ts` — `SectionGasInjectionSource` + `TransientGasInjection`: **el escritor real de `ChemicalSubstanceId` en `atmosphere.gases`**. El gas entra desplazando al resto, con la suma de fracciones acotada a 1 y dividida por `sectionVolumeOf` (espec §4). `isAirborneSubstance`: solo `state === "G"` o tag `VOLAT` pueden estar en el aire — el discriminador es el ESTADO DE MATERIA, no el tag.

**Daño, riesgo y fallas**
- `mission-section-integrity-runtime.ts` — corrosión y descompresión por tick; impacto y combustión por suscripción. Al colapsar: brecha + desgaste de la maquinaria de la sección (reusa `worsenWear`) + 1..N combustiones reales, con `ignoredCombustionRefs` para no dañarse en bucle. Expone `fractionOf`/`weightedFractions` (`SectionIntegritySource`), `openBreaches`, `pressureFloorFor`, `toSnapshots`. `weightedFractions` pondera por `maxHp` y multiplica el peso de las brechadas.
- `mission-hazard-runtime.ts` + `mission-hazard-parameters.ts` — llamador de producción de `HazardAccumulator`: tóxico, corrosivo y **vacío** (usa la causa `"cold"` existente). `incapacitation` hiere con `minHp: 1`, solo `lethal` mata. El vacío aplica mordiscos discretos por actor (~10 s hasta la muerte, el primero no letal como aviso).
- `kinetic-damage-handler.ts` — `registerKineticDamage`: llamador de `applyKineticDamage`. Enemigos y tripulantes comparten `HP_LOSS_FRACTION`.
- `mission-overload-runtime.ts` — llamador de `OverloadRule`; evalúa `ScriptedOverloadSubject` y escribe la cicatriz `Blueprint.overloadedRefs` cuando `failureMode === "cut"`. Estampa `sectionId` en el evento.
- `mission-reaction-runtime.ts` — llamador de `ReactionResolver` fuera de la mesa. Evalúa `scriptedReactions` con `oxygen` real de sección; `ignitionTrigger: "overload-bridge"` significa "hay ignición real en la sección" venga de `OverloadEvent` o de `dismantle-spark` (nombre conservado para no tocar contenido autorado). Cicatriz sin retorno: un `subject.id` que combustiona no se re-evalúa.
- `loose-ferromagnetic-promoter.ts` — promueve piezas sueltas a proyectil. `definitionByRef`/`definitionIdForRef` conservan el `componentDefinitionId` sin tocar `kinetics/`. Excluye puertas.

**Señales, sensores y puertas**
- `mission-signal-runtime.ts` — `InstancePowerSource`: gating por instancia (más fino que `PowerScarSource` por sección); `outputOf()` fuerza `false` si la instancia dueña del nodo no está alimentada aunque su sección tenga presupuesto.
- `pressure-emitter-input-source.ts` — `pressureAwareEmitterInputs`: resuelve la entrada por TAG funcional (`EM` + `triggerType: "pressure"`), nunca por identidad de componente.
- `motion-emitter-input-source.ts` — `motionAwareEmitterInputs`: resuelve `triggerType: "optical"` contra posiciones reales de crew/enemigos, por rango Manhattan + `hasLineOfSight`. Mismo molde de envoltorio parcial que el anterior.
- `lcd-display-value.ts` — `resolveLcdDisplayValue`: qué valor real muestra una Pantalla LCD según la propiedad del nodo cableado.
- `mission-door-runtime.ts` — dueño del estado vivo de puertas. Produce `apertureSource()` (aristas atmosféricas, se SUMAN a las de conductos) y `blocksCell()`/`blocksPathingAt()`, única fuente de verdad del bloqueo compartida por pathfinding, línea de visión y proyectiles. `syncInstalledDoors()` es el único camino de alta (se llama al cambiar el blueprint, no por tick); los snapshots quedan pendientes hasta que su puerta se da de alta. `DoorWorldQueries.powered` toma la PUERTA y mira sus dos secciones.
- `door-signal-output.ts` — `doorSignalOutput`: los tres valores no son intercambiables — `undefined` = nadie la gobierna (sin cable o sin motor vivo), `true`/`false` = override abrir/cerrar.
- `enemy-threat-runtime.ts` — avanza rutas y resuelve ataques con cooldown por arma. `doorBlocking`/`damageDoor`: el enemigo se frena ante una puerta cerrada con su reloj de ruta pausado (`routeHoldSeconds`, necesario porque `cellAtElapsedSeconds` es función del tiempo absoluto) y la golpea hasta romperla.
- `coil-field-source.ts` — `coilFieldIntensityAt`: cuánto campo hay en una celda. Bobinas contiguas cuentan como un solo electroimán; máximo entre grupos, no suma.
- `mission-thermal-runtime.ts` — `Tickable` **único productor del mapa de °C/s**. Traduce `CombustionEvent`/`OverloadEvent`(fire, explosion)/`NeutralizationEvent` a pulsos con duración, suma el aporte continuo de los reguladores activos (`ActiveThermalRegulatorSource`) y el pulso de un derrame (`applySubstanceSpill`). Expone `rates()`/`heatRateOf()`. La neutralización usa el calor que trae su propio evento; el resto, la tabla de parámetros. Eventos sin `sectionId` se ignoran.
- `mission-atmosphere-runtime.ts` — `SectionHeatSource` como 7º parámetro opcional y `applyThermalUpdate`: aporte por evento + deriva exponencial hacia el nominal, con clamp de dos lados. Va **antes** del early-return del sumidero, así que una misión sin fuentes de presión igual climatiza.
- `emitter-sensing.ts` — `PRESENCE_TRIGGER_TYPES`/`PRESSURE_TRIGGER_TYPES`/`THERMAL_TRIGGER_TYPES`, `emitterRangeOf` (contra el REGISTRO, no el catálogo atómico), `emitterReaches` y `emitterCoverageCells`. **Una sola fórmula de alcance**, compartida por el resolvedor que decide el disparo y la capa de `/game` que dibuja el área.
- `temperature-emitter-input-source.ts` — `temperatureAwareEmitterInputs`: resuelve `triggerType: "thermal"` contra la temperatura real de la sección, disparo POR ENCIMA del umbral.
- `actuator-emitter-input-source.ts` — `actuatorEmitterInputs`: resuelve las salidas de actuador contra el estado REAL del mundo (`ActuatorActivityReader`). Un actuador sin lector se resuelve a `false`, **nunca** al fail-open de `allEmittersActive`.
- Los `*-emitter-input-source.ts` se componen como una **cebolla** en `MissionRuntime`, en pasos nombrados: `withMotion` → `withPressure` → temperatura → actuador. Todos reciben el `EntityRegistry`, así que los sensores COMPUESTOS se resuelven.
- `seed-actuator-output-nodes.ts` — `seedActuatorOutputNodes`: siembra las salidas que falten en una partida ya empezada re-derivando con `deriveSignalNodes`, no deduciendo qué receptor vino del `ACT`. Idempotente y preserva identidad.
- `thermal-regulators.ts` — `isThermalRegulatorDefinition` (identidad por propiedades: `ACT` no direccional + `CT: "A"`), `isThermalRegulatorActive` (energía + señal, molde de `doorSignalOutput`), `activeThermalRegulatorsBySection`, `sectionsWithThermalRegulator`.
- `section-reactants.ts` — `sectionReactants`: qué hay en el aire que pueda reaccionar, excluyendo gases de fondo y trazas. `reactantsFingerprint` para el antirruido por tick.
- `mission-overload-runtime.ts` — evalúa **todo conductor instalado y toda arista** con carga derivada, no solo `scriptedOverloads`. Cadena de capacidad: catálogo → `capacityOverride` → `wornCapacity` → factor térmico. Una pieza `COND(E)` colocada ya no es sujeto (lo es la arista). `edgeStatus(edge)` es público: la UI le pregunta carga/capacidad al runtime que decide, en vez de recalcular la cadena. `worstThermalFactorAlong` manda el peor de los dos extremos y estampa el evento con esa sección.
- `mission-fanout-runtime.ts` — el reparto de señal vivo, memoizado por identidad de blueprint + prioridades. Punto único para tres consumidores que no se conocen: compuerta de señal, estado de instancia y tooltips.
- `mission-phase-runtime.ts` — vigila el contenido de los reservorios contra la temperatura de su sección y actúa solo en el CRUCE del umbral: emite evento y aplica `worsenWear`. Estado previo por instancia, de simulación y no persistido.
- `phase-expansion-pressure.ts` — `PhaseExpansionPressureSource`: **primera FUENTE de presión del motor** (kPa negativos durante un pulso cuando un derrame se evapora), compuesta con los sumideros existentes.
- `mission-reaction-runtime.ts` — `tickEmergent`: química por sección a partir de las sustancias realmente presentes, además de la scripteada. Ventana de ignición con vencimiento (`ignitedUntilSeconds`), autoignición por temperatura (`hasIgnitionSource`) y consumo real de los reactivos sobre `atmosphere.gases` (`consumeReactants`). `thermalRegulatorOverloaded` se deriva (hay regulador instalado y la sala supera su umbral).
- `section-gas-injection.ts` — `isAirborneSubstance` **deriva el estado de la temperatura** y ya no acepta la vía por tag `VOLAT`; `hasEvaporated` distingue "soltar un gas" de "el charco hirvió". `GasInjectionDeps` suma `sectionTemperatureOf`, `onEvaporate` y `onSpill` (avisado ANTES del descarte por sustancia no aérea: un criogénico enfría la sala aunque quede como charco).
- `ship-task-effect.ts` — `payComponentCost` extraído y compartido por `install` y `connect`, que cobra ANTES de tocar el grafo; case `disconnect` (saca la arista y su cicatriz, acredita el conductor un escalón más gastado, salvo que esté quemada). `FrozenReservoirContentError` + `assertContentNotFrozen` en las cuatro tareas que mueven sustancia. `installInstance` puebla `reservoirContents` desde `FACTORY_RESERVOIR_CONTENTS`.
- `mission-door-runtime.ts` — `resolveBoundary`: puerta autorada → `a`/`b` del mapa (verificados con `cellSeparates`); improvisada → inferencia. Es lo que permite autorar una puerta en la boca de un pasillo, que toca tres secciones. `initialOpen` del seed decide el estado inicial y el snapshot del save le gana. `isActuatorActive(instanceId)` es el lector de estado real para la salida de señal de una puerta.

- `mission-hazard-parameters.ts` + `mission-hazard-runtime.ts` — quinto peligro: `HAZARD_PARAMETERS.thermal` (umbrales -10/60, **propios y distintos de los de la sección**) aplicado por ACTOR. `applyVacuum` se generalizó al `bite()` compartido por vacío y térmico, con `thermalDamageCause` mapeando temperatura → `"cold"`/`"fire"`. Vacío y frío llevan cuentas separadas y se acumulan.

## `engine/src/power/`
- `power.types.ts` — `PowerState`/`SectionPowerAllocation`/`InstancePowerPriority`/`emptyPowerState()`. Incluye `permanentlyDisconnectedSectionIds` (cicatriz real, distinta del déficit táctico de sesión) y `dischargedSourceIds` (fuentes canibalizadas por `discharge-source`: cuestan presupuesto permanentemente).
- `power-source.ts` — `totalPowerBudget`: suma `powerUnits` de toda instancia RES(E) instalada, descontando las descargadas.
- `power-parameters.ts` — `POWER_DRAW_BY_COMPONENT` + `declaredPowerDraw`: la ÚNICA tabla de consumos, con el criterio documentado (señal pura 1 · `ACT` 2 · pesado/`FAB` 3) y por qué conductores y fuentes no consumen.
- `component-power-draw.ts` — `componentPowerDraw`: único lector de `definition.data.powerDraw`. Por eso reparto, heatmap y derivación de estado no pueden divergir.
- `power-allocation.ts` — reparto puro en dos niveles: `allocateSectionBudget` (global→sección; `darkSectionIds` es informativo, no gatea) y `allocateComponentPower` (sección→componentes, por prioridad con desempate por `instanceId`). Ante déficit **apaga secciones de menor a mayor asignación** hasta que el resto entre, en vez de recortar proporcionalmente; un único sobreviviente que excede se recorta. Devuelve `shortfallUnits` y `shedSectionIds` y no toca `sectionAllocations` (reconciliación no destructiva).
- `default-allocation.ts` — `defaultSectionAllocations`: reparto inicial por demanda declarada, mayor primero. Existe porque `emptyPowerState()` deja todo en 0, y eso es una partida nueva sin señales, sin mesas y sin puertas.
- `mission-power-runtime.ts` — implementa `PowerScarSource`, `InstancePowerSource` y `PowerSupplySource` (`grantedTotalUnits()`/`requestedTotalUnits()`, alimenta el HUD). `recalculate()` es público y `tick()` delega en él: el recálculo NO puede depender del tick porque `CoreLoopModeMachine` es NO-OP en `planning` y los controles de energía solo existen en pausa. Cachea `sectionPowerGranted()`/`powerShortfallUnits()` y emite `PowerShortfallEvent` POR FLANCO. `unpoweredSectionIds` refleja SOLO la cicatriz permanente; `sectionHasNoPowerGranted` (déficit vivo) alimenta el efecto ambiental y el gating de tareas de `TaskScheduler`; `isInstancePowered` es el predicado de gating vigente, con fail-open para instancias sin sección.
- `power-events.types.ts` — `PowerShortfallEvent`/`PowerDomainEvent`, sumados a la unión `DomainEvent`. El motor ya resolvió el conflicto; el evento existe para que `/game` lo comunique.
- `conductor-load.ts` — `edgeElectricalLoad`: la carga de una arista es la suma del `powerDraw` de lo que cuelga aguas abajo, en unidades de `powerDraw` (por eso se re-escaló `COND.maxCapacity` en el catálogo). Cuenta el dueño de `edge.to` y recorre el grafo ACTIVO.
- `power-allocation.ts` — `orderByPowerPriority` extraído acá y compartido por los dos triajes (energía y señal).

## `engine/src/properties/`
- `functional.types.ts` — las propiedades funcionales del GDD §5.1. `ReservoirProperty.powerUnits?` (presupuesto de una fuente `RES(E)`), `FabricatorProperty` (`FAB`, con `domain: "fisica" | "quimica"`): propiedad de HABILITACIÓN, no de trabajo — declara que desde esa pieza se abre la mesa. `ActuatorProperty` tiene `power` pero **no** `powerDraw` (el consumo eléctrico es dato de componente, ver `power/`).
- `material-order.ts` — `RE_ORDER`/`CE_ORDER`/`CT_ORDER` + `worstResistance`/`bestConductivity`/`bestThermalConductivity`: orden canónico de niveles de material.

## `engine/src/reservoir/`
- `reservoir-ledger.ts` — operaciones PURAS sobre `Blueprint.reservoirContents`: `contentOf`/`freeCapacity`/`pourInto`/`drawFrom`/`emptyReservoir`. Regla: UNA sustancia por reservorio; verter otra lanza `ReservoirOccupiedError` (hay que purgar antes).
- `reservoir-query.ts` — `substanceReservoirProperty`/`instanceReservoirCapacity`: filtran el `RES` de tipo G/L/T; las baterías (`RES(E)`) no son reservorios de sustancia.
- `fluid-transfer-reachability.ts` — espejo exacto de `assertSignalWiringReachable` con `kind: "fluido"`. Intra-sección libre, cross-section exige conducto, misma política fail-open.
- `substance-composition.ts` — de qué está hecha una sustancia: receta de catálogo → procedencia registrada al sintetizar → indescomponible. **Precondición en los tres: estar analizada** (`analyze-substance` es puerta real, no flavor).
- `initial-reservoir-contents.ts` + `factory-reservoir-contents.ts` — `indexFactoryReservoirContents` (puro, sobre specs) + `deriveInitialReservoirContents` (instancias → entradas llenas a `capacity`). Lo consumen `save/campaign-save-factory.ts` y `save/chapter-progression.ts`.
- `reservoir-parameters.ts` — `EXTRACTION_BATCH_UNITS`: tope por tarea de extracción, que convierte la escasez en TIEMPO (cada lote es un viaje) en vez de autorar cantidades a mano.
- `frozen-content.ts` — `isSubstanceFrozenAt` (predicado desnudo) y `frozenContentOf` (instancia → sección → temperatura → puntos). Función ÚNICA que consumen el efecto de tarea, el panel de acciones y el glifo del plano.

## `engine/src/salvage/`
- `salvage-hazard.types.ts` — `dismantle-spark`/`dismantle-spill`/`dismantle-leak` + `SalvageDomainEvent`. Todos llevan `instanceId`/`position`/`sectionId`.
- `dismantle-hazard-rules.ts` — Strategy, una regla por condición (`powered-instance`, `reservoir-content`, `hazardous-atmosphere`) + `DismantleHazardContext` (estado vivo alrededor de la pieza). Molde reusado por `integrity/section-damage-rules.ts`.
- `dismantle-hazard-assessment.ts` — evaluación PURA compartida por el efecto de tarea y por el badge de riesgo de la UI: una sola fuente de verdad.
- `dismantle-hazard-handler.ts` — la parte con efectos: emitir eventos, dañar al actor vía `applyCrewDamage`, pedir el escalón extra de desgaste.
- `salvage-parameters.ts` — daño por hazard, umbrales de atmósfera comprometida, caudal/duración de la fuga.
- `transient-pressure-sink.ts` — `TransientLeakPressureSink`: fugas acotadas en el tiempo (las permanentes son de `integrity/`).
- `instance-energized.ts` — `isElectricallyLive`/`isElectricSource`/`isInstanceEnergized`, resuelto por propiedades (`COND`/`RES(E)`, `ACT`, `EM`, `REC`, `CE ≠ "N"`). **No confundir con `MissionPowerRuntime.isInstancePowered`**, que significa "su demanda está satisfecha" y da `true` para cualquier pieza sin `powerDraw` incluso con la sección a 0. Una FUENTE está viva hasta que se la descarga, sin depender de la red.

## `engine/src/save/`
- `campaign-save-factory.ts` — campaña nueva. `powerState.sectionAllocations` y `permanentlyDisconnectedSectionIds` arrancan `[]`.
- `CampaignSaveState` — `schemaVersion` **5**: incluye `elementStock`, `substanceProvenance` y `analyzedSubstanceIds` (los dos últimos vivían solo en memoria de `MissionRuntime`). Migración "campo ausente ⇒ vacío". Se versiona aparte del `Blueprint.schemaVersion`.
- `crew-write-back.ts` — `writeBackCrew`: vuelca HP y celda de `MutableCrewState`, status/sección del `TaskScheduler`, y la BAJA DEFINITIVA de los muertos (permadeath, GDD 6.1). Un muerto queda `dead` con 0 HP, sale de `activeCrewIds` y sigue en `crew` — `assertCampaignSaveIntegrity` exige esa relación.
- `chapter-progression.ts` — semillas por capítulo.

## `engine/src/ship-status/`
- `ship-status.types.ts` — `ShipStatusLevel` (`nominal`/`warning`/`critical`), `ShipStatusIndicator` (`level`+`fraction`), `ShipStatusSnapshot` (atmósfera / soporte vital / integridad de casco / energía).
- `ship-status-aggregation.ts` — `fractionToLevel` (corte de 3 niveles, mismo criterio que `hpBarColor` de `crew-strip.ts`) + los cuatro agregadores a nivel de NAVE, criterio "peor sección gana", sobre umbrales ya existentes (`REACTION_PARAMETERS.toxicity`, `RE_ORDER`). `aggregateAtmosphere` combina concentración de gas tóxico y `pressureFraction = pressureKpa / 101`. `aggregateHullIntegrity(sectionFractions)` recibe fracciones por sección y no componentes. `aggregateEnergy(EnergyAggregationInput)` devuelve el PEOR de dos señales — cicatriz permanente y suministro/demanda (`granted`/`requested`) — con `requestedUnits === 0` = nominal.
- `ship-status-runtime.ts` — `ShipStatusQuery`: consulta pull-based (no `Tickable`). `SectionIntegritySource` es interfaz angosta **no opcional**: sin ella el indicador quedaría muerto.

## `engine/src/signals/`
- `orient-signal-wiring.ts` — `orientSignalWiring`: la dirección del cable sale de los ROLES, no del orden de clicks. Rechaza receptor↔receptor y emisor↔emisor.
- `graph-traversal.ts` — `upstreamNodes`/`downstreamNodes`: BFS en las dos direcciones, tolerante a ciclos (el latch de GDD 5.6). Aceptan el conjunto de aristas a recorrer (default: el grafo completo), para recorrer el grafo activo sin duplicar el BFS.
- `edge-conductor.ts` — punto único de dos preguntas que no tenían dueño: `isWiringMaterial`/`electricalConductorProperty` ("¿es material de cableado?", por PROPIEDAD `COND(E)`, nunca por lista de ids) y `edgeConductorId`/`edgeConductorWear` ("¿con qué se tendió esta arista?", con el default de migración a `cable-cobre` en un solo lugar). Firmas estructurales, para servir igual a un spec de catálogo que a una definición del registry.
- `active-signal-graph.ts` — `activeSignalEdges`/`activeSignalGraph`/`isEdgeBurned`: el grafo menos los cables quemados. Punto único consumido por dos dominios que no se conocen — la evaluación de señal (deja de propagar) y el cálculo de carga (se redistribuye); no le enseña al `SignalEvaluator` qué es una sobrecarga. `burnedWiresTouching(blueprint, instanceId)` vive acá y no en `MissionRuntime` para poder testearse.
- `signal-edge.types.ts` — `SignalEdge` lleva `conductorId`/`conductorWear`; **la capacidad NO se persiste**, se deriva del catálogo.
- `signal-output-parameters.ts` — `SIGNAL_OUTPUT_CAPACITY_BY_COMPONENT` + `declaredSignalOutputCapacity` + defaults. Tabla data-driven gemela de `power-parameters.ts`, inyectada en `data.signalOutputCapacity` por `build-component-catalog.ts`.
- `emitter-fanout.ts` — `allocateEmitterFanout`: cuánto cuelga de cada salida y quién queda sin señal. **La demanda NO es transitiva** (cada salida paga solo lo directo): es lo que convierte a un chip en relé útil. Ordena con `orderByPowerPriority`, el comparador compartido con el triaje eléctrico.
- `orient-signal-wiring.ts` — la orientación se decide por "el segundo es emisor"; el rechazo receptor→receptor cayó (habilita el relé) y eso además arregló `conductor → emisor`.
- `signal-evaluator.ts` — `tick` acepta una compuerta opcional por arista: el mecanismo del triaje de señal sin tocar el grafo activo.

## `engine/src/simulation/`
- `random-source.ts` — `RandomSource` inyectable, `sequenceRandom` (secuencia fija para tests), `systemRandom`. Primer y único azar del motor; se inyecta para que los casos de validación sigan siendo reproducibles.

## `engine/src/tasks/`
- `task.types.ts` / `task-factory.ts` — `CrewTask` y su payload. `TaskType` incluye `analyze-substance`, `transfer-substance`, `apply-substance`, `extract-elements`, `cut-power`, `purge-reservoir`, `discharge-source`. `InstallTaskPayload.consumeRecipe?` distingue un compuesto de catálogo (gasta receta) de una creación personalizada (gratis). `powerSectionIds?` es independiente de `targetSectionId` (que sigue siendo ubicación del actor/animación); ausente o vacío = la tarea nunca se gatea por energía. `powerInstanceIds` es su hermano por instancia y el único sitio donde una tarea `combine` conserva de qué mesa habla.
- `task-scheduler.ts` — state machine de la cola. `resolveBlockingReason` itera `powerSectionIds` y bloquea con `"no-power"` si cualquiera no tiene energía, evaluado DESPUÉS del bloqueo por dependencias (que tiene prioridad). `fail(taskId, reason, tick)` es hermano de `cancel()` (que cascadea `dependency-cancelled` a los dependientes) y borra el avance por objetivo. `CrewActorStatus` incluye `"dead"`, TERMINAL: `standDown(actorId, tick)` cancela la cola del muerto, el tick deja de avanzarlo, `enqueue` lo rechaza y `registerActor` no lo resucita. Re-chequea energía en la Fase A del tick.
- `task-progress-key.ts` — `taskProgressKey(task)`: identidad del OBJETIVO derivada del payload. Habilita el trabajo por relevos (`progressByObjective`): si el tripulante muere a mitad, el siguiente retoma donde quedó. Se limpia al COMPLETAR — cancelar o morir deja el avance a propósito. Nunca usa el `instanceId` de la tarea; `go-to` y las tareas sin payload no acumulan.
- `task-events.types.ts` — `TaskCompletedEvent` (reusa `TaskEffectResult["obtained"]` en vez de repetir su forma, y propaga `obtainedElements`/`overflowAmount`/`pouredSubstanceId`/`pouredAmount`), `TaskFailedEvent.reason`, `TaskBlockedEvent["reason"]` (incluye `"no-power"`).
- `queued-reservations.ts` — `reservedCells(tasks)` y `reservedStock(tasks, costOf)`: qué tiene comprometido la cola VIVA (`pending`/`in-progress`/`blocked`, vía `TERMINAL_TASK_STATES`, el mismo predicado que filtra la cola dibujada). Solo `install` ocupa celdas; `install` y `connect` reservan stock. **Nunca se persiste.**
- `task-scheduler.ts` — `completeTask` envuelve el efecto en try/catch: un rechazo pasa la tarea a `failed` con motivo `effect-rejected` (+ `task-effect-error` con el mensaje crudo) en vez de reventar el tick. `blockReasonFor(taskId)` expone `lastBlockReason`.

## `engine/src/valves/`
- `valve.types.ts` / `valve-runtime.ts` — apertura viva por `ConduitId`, sembrada de `initialAperture` y pisada por el save. Existe porque la puerta NO cierra el ducto: contener una fuga exige cerrar también la válvula.

## `engine/src/wear/`
- `wear.types.ts` — `ComponentWear` (`nuevo`/`usado`/`degradado`/`critico`), `WEAR_ORDER`, `wearSteps`, `worsenWear`, `worstWear`. Eje ortogonal a `ComponentCondition`. **No existe función inversa a propósito** (principio 5: sin undo gratuito).
- `effective-resistance.ts` — `effectiveResistance(catalogRE, wear, legacyOverride?)`: punto ÚNICO donde el desgaste entra en el cálculo estructural. Mapeo 1:1 (un escalón de desgaste = uno de RE) + retrocompat de `structuralResistanceOverride` en saves ≤ v6 (gana el peor de los dos ejes).
- `overload-capacity.ts` — `wornCapacity(capacity, wear)` = −15% por escalón: el desgaste sube el riesgo de fallo catastrófico sin meter azar en el tick.
- `dismantle-wear.ts` — `wearAfterDismantle`: probabilidad de conservar el estado al canibalizar, reutilizando `atomicRecoveryFraction` (GDD §6.5). Sin `RandomSource` inyectado nunca degrada.

## `engine/src/workbench/`
- `port-wiring.ts` — `assertSignalWiringReachable(floorplan, graph, from, to)` + `SignalWiringUnreachableError`: un cable de señal solo cruza de sección a sección si hay camino de conductos `senal`. Vive aparte de `wireExternalPort` (operación pura de grafo) porque necesita geometría.
- `derive-signal-nodes.ts` — deriva los nodos de señal de una pieza. `ACT` deriva un nodo `receptor`: un actuador gobernado por señal ES un receptor. Vale para todo `ACT`, no solo puertas.
- `creation-naming.ts` + `footprint-calculator.ts` — `nameAndRegisterCreation` puebla `data.layout` con el offset relativo de cada pieza; `calculateFootprintOrigin` devuelve el min corner del bounding box.
- `creation-material-aggregation.ts` — `aggregateCreationMaterial`: RE = peor de las partes, MAG = OR, CE/CT = mayor, ES = mayoritario. Lo consume `creation-naming.ts`, que antes solo agregaba propiedades funcionales.
- `installation-placement.ts` — validación de colocación. **No** reubica la pieza: "lo que ves es lo que se instala" (el viejo `findFittingInstallPlacement` fue borrado; el fantasma en vivo lo reemplaza).
- `derive-signal-nodes.ts` — un `ACT` deriva receptor **y** emisor de salida. `actuatorOutputNodeId`/`isActuatorOutputNode`: el id del emisor se deriva del receptor y **no consume índice**, para no correr los ids posteriores y dejar huérfana una arista ya guardada.
- `port-wiring.ts` — `wireExternalPort` acepta el conductor y rechaza un par ya cableado (`SignalWiringDuplicateError`, no dirigido); `/game` lo distingue para ofrecer RETIRAR en vez de mostrar un error.

## `game/src/audio/`
- `audio-asset-registry.ts` — tabla `key → URL` del pack real (`game/assets/audio/`), imports `?url` solo de las variantes usadas, `preloadAudioAssets` (mismo patrón que `ui-asset-registry.ts`). `AUDIO_KEYS` documenta los gaps de asset (sin siseo de fuga, zumbido eléctrico continuo, sirena ni paso metálico dedicados). `uiDenied` (acción rechazada) reusa los assets de error ya cargados.
- `audio-effect.types.ts` — `EventDrivenSound`/`StateDrivenSound`, análogos sonoros de `particles/particle-effect.types.ts`.
- `phenomenon-sound-registry.ts` — `fireEventSound`: Factory `DomainEvent["kind"] → EventDrivenSound`, en paralelo a `EFFECTS_BY_KIND`.
- `audio-utils.ts` — `pickSoundKey`, análogo sonoro de `pickTexture`.
- `bark-sound.ts` — `playBarkSound`: SFX corto por categoría de `BarkEventType`, no voz hablada.
- `effects/` — `overload-sound`, `combustion-sound`, `corrosion-sound` y `door-sound` (event-driven, gemelos de sus `particles/effects/*`; el de puerta engancha al ARRANQUE de la transición, no a `door-settled`); `gas-leak-sound` es state-driven (loop ambiental, volumen ∝ concentración) y necesita `.stop()` explícito en `SHUTDOWN` — un `Phaser.Sound` no se destruye solo al cambiar de escena.

## `game/src/crew/`
- `bark-controller.ts` — `fire()` reproduce `playBarkSound` junto a la burbuja de texto.

## `game/src/enemies/`
- `enemy-tokens.ts` — `createEnemyToken`/`flashEnemyAttack`/`destroyEnemyToken` (rectángulo placeholder por arquetipo, distinto de los círculos de tripulación). `enemyJumpSignature` es la firma de salto que `floorplan-scene.ts` encadena celda a celda; `hopEnemyToken` (salto directo A→B) quedó como fallback sin grilla transitable y devuelve el tween para poder pausarlo en modo `planning`.

## `game/src/i18n/`
- `es.ts` / `en.ts` — catálogo de claves de traducción. Familias: `crew.specialty.*`/`crew.trait.*`/`crew.tier.*`, `ship.<archetype>.properName`/`.description`/`.pro.N`/`.con.N`, `ui.floorplan.*`. Terminología fijada: "transferir"/"transferencia" (no "trasvasar"). **Toda cadena de UI y bark pasa por acá, es+en, desde el MVP.**

## `game/src/meta/`
- `game-settings.types.ts` — `GameSettings` persistidas (CRT, `shadowIntensity` con clamp01…), hidratadas por `options-scene.ts`.
- `ship-archetype-metadata.ts` — `SHIP_ARCHETYPE_METADATA`: `ShipArchetype → { properNameKey, descriptionKey, proKeys, conKeys }`, claves i18n y no texto. Vive en `/game` porque es presentación, no dato de motor.
- `live-mission-save.ts` — registro de una `(base) => CampaignSaveState` que `FloorplanScene` publica al montar la misión y libera en su SHUTDOWN, para que `PauseMenuScene` persista el estado VIVO sin conocer `MissionRuntime`. Sin esto "Guardar y salir" solo tocaba `updatedAt`.
- `save-adapter.ts` — E/S de saves. `mostRecentCampaignSave()` ordena por `metadata.updatedAt` (no por el timestamp del id, que marca la CREACIÓN) y omite las ilegibles.

## `game/src/mission/`
- `mission-runtime.ts` — sumó al core loop `thermalRuntime` (ANTES de `atmosphereRuntime`, su `rates()` se inyecta por closure como `SectionHeatSource`), `phaseRuntime`, `phaseExpansion` y el bus `phaseEvents`. `MissionOverloadRuntime` pasa a recibir `shipFloorplan` (sin él los `OverloadEvent` salían sin `sectionId`) y `atmosphereOf`. Nueva superficie: `emitterCoverageOf(instanceId)` (celdas cubiertas, reusando el helper del motor y el mismo `motionBlockedQuery` que alimenta al resolvedor), `signalRoleOf`, `edgeStatusOf(edge)` (con capacidad NOMINAL además de la efectiva, para poder explicar por qué el número es más chico que el del catálogo), `frozenContentFor`, `instanceCellOf`, y la **puerta única a las reservas**: `reservedCells()`, `reservedStockOfWear`, `availableStockOfWear`, `queuedInstallGhosts()` (sin caché, recalculado por consulta). `hasRecipeStockFor`/`missingRecipeIngredients` miden contra el DISPONIBLE, y el segundo devuelve además `reserved` para distinguir "falta" de "está comprometida". `sectionAtmosphereInfo` agrega `temperatureCelsius`, `heating`, `selfIgniting` y el estado de las sustancias en el aire. `ensureAt` devuelve el id del `go-to` que encoló y los 16 sitios que la llaman lo declaran como `dependsOn` — el llamador que le faltaba al bloqueo por dependencia desde la Fase 10. Tiene test propio (`mission-runtime.test.ts`): no importa Phaser, su constructor solo toma un save.
- `mission-interaction-controller.ts` — `isWiringOnly` saca los conductores del selector de instalación; `buildWireOptions`/`conductorDetailLines` arman el selector de cableado (capacidad EFECTIVA por fila, no la de catálogo); `confirmWireConductor` encola el tendido y repetir el gesto sobre un par ya cableado encola el retiro. `installIssuesAt(position, footprint)` es el predicado ÚNICO de "por qué no se puede instalar acá", compartido por el fantasma bajo el cursor y por el click que encola; `reservationDetailLine`/`recipeBlockReason` alimentan el desglose y el bloqueo `queue-reserved`.
- `active-task-visuals.ts` — registro `taskId → cómo se apaga su visual` (`register`/`stop`/`forget`). Fuera de la escena y sin Phaser para tener test propio: un apagador que no se invoca es exactamente lo que no se ve al revisar código.

## `game/src/mission/conduit-flow-heuristics.ts`
- `conduitFlowIntensity`/`computeSectionSignalActivity` — intensidad de flujo por conducto FÍSICO derivada de datos reales del motor (presión, `unpoweredSectionIds`, `signalGraph` + `outputOf`), nunca inventada. La capa `fluido` toma su caudal de `FluidOperationRegistry`. `signalWireFlowIntensity(edge, mission)` aplica el mismo criterio a un `SignalEdge` que armó el jugador: por NODO en vez de por sección.

## `game/src/mission/mission-interaction-controller.ts`
Segundo archivo más tocado. Tres **modos de interacción** hermanos, todos interceptados por `handleMapClick` antes del comportamiento normal:
- `wireModeValue` — cableado de señal.
- `transferModeState` — `startTransferMode`/`cancelTransferMode`/`handleTransferModeClick` + getters `transferMode`/`transferModeOrigin`/`transferModeCandidates`. Recalcula `transferCandidatesFor` **en el momento del click**, no al abrir el modo. La cantidad encolada es `Math.min(content.amount, candidate.freeCapacity)`. Un candidato bloqueado suena `AUDIO_KEYS.uiDenied` antes de `setStatus(...)`.
- `installPlacementState` — modo de COLOCACIÓN: se elige QUÉ en el modal y DÓNDE en el mapa; `installPlacementPreviewAt` devuelve el footprint anclado exacto bajo el cursor y si ahí entra. El flujo empieza en el botón de la barra (`updateInstallButton`), no en el panel de celda vacía.

**Panel de acciones**: flota, no está docked. `hasContextualSelection` reemplaza el chequeo `idle` disperso; `repositionActionPanel(point)` reposiciona el `Container` ya construido (lo llama la escena cada frame); `manualPanelPosition` guarda la posición tras un arrastre y se limpia al cambiar el objetivo del panel, pero sobrevive a un `refreshActionPanel`. El contenido abierto **se re-deriva del mundo vivo en cada dibujo** (`doorInfoForInstance`/`doorInfoById`/`conduitLiveState`, igual que los hazards): el estado de una puerta cambia solo.

**Selector de instalación**: `buildInstallOptions()` — lista ÚNICA y plana (sin pestañas), habilitados primero y bloqueados después con su motivo. Sus tres fuentes: piezas atómicas, creaciones personalizadas y compuestos de catálogo con `consumesRecipe: true`. `buildComposition(options?: { highlightRequiredTag?; missingRefs? })` marca `hasStock` por ingrediente desde `mission.missingRecipeIngredients(def)`.

`conduitAtCell` redondea la posición del marcador: los conductos se autoran en coordenadas fraccionales sobre la arista, y sin redondear uno en (11.5, 11) no sería clickeable desde ninguna celda.

## `game/src/mission/mission-runtime.ts`
**El archivo más tocado del proyecto.** Construye y registra todos los runtimes del motor en el core loop, y expone la única superficie que la UI consume. Nada en `/game` habla con `/engine` salteándolo.

**Orden de registro en el core loop** (importa, y varias regresiones vinieron de acá):
1. Un `Tickable` mínimo PRIMERO, que fija el reloj del tick (los hazards lo leen para datar sus eventos) y caduca las fugas abiertas.
2. `powerRuntime` → `signalRuntime` → `doorRuntime` (la puerta debe leer la señal de ESTE tick, no del anterior) → `atmosphereRuntime` → `sectionIntegrityRuntime`/`hazardRuntime` (leen corrosión y presión ya difundidas).
- `doorRuntime`/`valveRuntime` se **construyen** antes de la atmósfera (son sus productores de apertura); sus `queries` son closures, así que no dependen del orden de construcción.
- `enemyThreatRuntime` va tras `crisisRuntime` y antes de señales/proyectiles.

**Buses de eventos expuestos**: `enemyEvents`, `reactionEvents`, `failureEvents`, `powerEvents`, `salvageEvents`, `integrityEvents`, `atmosphereEvents`.

**Superficie para la UI**, agrupada:
- *Energía*: `sectionPowerAllocation`, `setSectionPowerUnits`, `sectionPowerDemand`, `instancePowerPriorityOrder`, `reorderInstancePriority`, `totalPowerBudget`, `sectionPowerGranted`, `powerShortfallUnits`, `sectionHasNoPowerGranted`. `setSectionPowerUnits`/`reorderInstancePriority` llaman `powerRuntime.recalculate()` **de forma síncrona**: el core loop no tickea en pausa, que es justo cuando se opera esta UI.
- *Química y fluidos*: `elementStock`, `substanceProvenance`, `fluidOperations`, `reservoirContentOf`, `transferCandidatesFor` (devuelve TODOS los reservorios con motivo de bloqueo `"full"`/`"unreachable"`/`"different-substance"` y su `freeCapacity`, para que el modo espacial pueda iluminar los bloqueados), `extractionBlockedFor`, `availableSubstances` (deriva también de `reservoirContents`, así que el HUD sabe DÓNDE está cada sustancia), `airborneSubstanceAt` (dominante en el aire sin filtrar por tag, para uso visual; hermana de `contaminantAt`, que es la de daño), `substanceTagsOf`, `isSubstanceAnalyzed`, `hazardPreviewFor` (recalcula en vivo contra el O2 real).
- *Instalación*: `installableCatalogComposites`, `hasRecipeStockFor`, `missingRecipeIngredients`, `fabricatorDomainOfInstance`, `benchCell(domain)`, `fabricatorBlockedReason` (punto único que comparten el guard de `openWorkbench` y el label del botón).
- *Encolado*: `queueGoTo`/`queueDismantle`/`queueInstall`/`queueConnect`/`queueCutPower`/`queuePurgeReservoir`/`queueDischargeSource`/`queueTransferSubstance`/`queueApplySubstance`/`queueExtractElements`/`queueAnalyzeSubstance`/`queueFabrication`/`queueSynthesis`/`queueSetValve`/`queueForceDoor`/`queueRepairDoor`. **Regla de energía**: las cuatro tareas de máquina pasan `powerSectionIds`/`powerInstanceIds`; transferir y aplicar pasan AMBAS secciones (origen y destino); las demás no fijan `powerSectionIds` y por eso nunca se gatean.
- *Estado*: `shipStatus` (pull-based, recalcula en cada lectura), `sectionAt`, `elapsedSeconds`, `sectionIdOfInstance()`, `dismantleHazardsFor()`, `enemyRoutes` (para que la escena calcule la duración real de cada tramo al animar).
- `materializedByTaskId` + `consumeMaterializedByTask(taskId)` — qué materializó cada tarea `combine`, patrón "drenar y limpiar" (mismo criterio que `TransientGasInjection.asInjectionSource()`).
- `queueSynthesis` consume el stock **AL ENCOLAR**, no al completar; `pendingFabrications`/`pendingSynthesis` se limpian al fallar o cancelar (el material se pierde, principio 5, pero los maps se vacían).
- Resincronización de puertas construidas comparando la REFERENCIA de `placedComponents` (`Blueprint` es inmutable, el `!==` es exacto y O(1)): sin esto una compuerta instalada a mitad de misión no era puerta.

## `game/src/particles/`
Cada fenómeno del motor tiene su efecto (principio 6: dos fenómenos distintos nunca se ven igual). Dos familias, `EventDrivenEffect` y `StateDrivenEffect`.

**Infraestructura**
- `particle-effect.types.ts` — las dos familias, `ObjectCreatedHook`, `LightHook`, y `EventEffectOptions { tint?, onObjectCreated? }` como 4º parámetro opcional de `trigger`/`fireEventEffect`: permite que el color dependa de datos que solo `/game` puede resolver (el registro químico) sin que `/engine` conozca colores.
- `effect-registry.ts` — `EFFECTS_BY_KIND`: Factory `DomainEvent["kind"] → efecto`, gemelo de `phenomenon-sound-registry.ts`.
- `particle-utils.ts` — `spawnBurst`/`spawnDecal`, ambos con el hook opcional al final.
- **Regla del doble-cámara**: los 15 efectos del registro propagan `onObjectCreated` para que la escena marque cada objeto con la cámara de mundo y lo excluya del `hudCamera`. Un objeto que no se registra aparece duplicado o pegado al HUD.

**Efectos**
- `dynamic-light.ts` — `createDynamicLight` (luz aditiva persistente) y `createBurstLight` (parpadeo → desvanecido → destrucción, con las fases encadenadas por `onComplete`, porque dos tweens sobre `intensity` se pelean si se solapan). Consumidores: `combustion-effect.ts` (`fadeMs` = 1.5× `sustainMs`) y `environmental-damage-effect.ts` (arco eléctrico, `fadeMs` 200).
- `conduit-flow-effect.ts` — `createConduitPathFlowEffect(path, onTokenCreated?)`: **tokens viajeros**, `Image` con posición manual sobre la polilínea (`cumulativeLengths`/`pointAtDistance`), no `ParticleEmitter`. 2 `FlowStream` por conducto (path directo + invertido) cubren ambos extremos como origen; cada token tiene cabeza + 2 fantasmas de estela y fade en los extremos; la velocidad se fija al spawnear, así que un token en tránsito termina su viaje aunque el conducto se apague. `direction` apaga el SPAWN del sentido contrario, no el stream. `ConduitPathFlowState.visible` fuerza el alpha final a 0 (oculto REAL, no atenuado) sin pausar el avance interno. `ventilationIntensity` lee la apertura VIVA y devuelve el sentido (de mayor a menor presión). `createConduitFlowEffect` + `createFlowEmitter`/`flowFrequency`/`flowQuantity` son el emisor-rocío de punto fijo (demo de galería).
- `overloaded-conductor-effect.ts` — `StateDrivenEffect` de chispas + luz parpadeante sobre un conductor/reservorio sobrecargado. Cicatriz sin retorno: nunca se detiene.
- `environmental-damage-effect.ts` — `electricArcEffect` con burst de luz en el punto de impacto; `EnvironmentalEffectObject` incluye `PointLight` en su unión.
- `phosphor-static-effect.ts` — `firePhosphorStatic`: ruido de fósforo localizado sobre la celda averiada, en espacio de mundo. Severidad `minor`/`major`.
- `fabrication-effect.ts` — `dismantleEffect`: orbes aditivos cian/dorados + chispas + humo tenue + `PointLight` pulsante.
- `salvage-hazard-effect.ts` — tres efectos visualmente distintos para los tres hazards de desmontaje: estallido eléctrico hacia arriba, charco + salpicadura, chorro ancho que se disipa. `firePouredSubstance(scene, position, amount, tint)` está extraído porque hay TRES formas de mojar el piso (derrame al desmontar, verter, purgar); usa `RENDER_DEPTH.substanceSpill`.
- `section-breach-effect.ts` — `sectionDamagedEffect` (polvo cayendo) y `sectionBreachedEffect` (chorro de descompresión + mancha permanente que marca dónde instalar el parche).
- `atmosphere-state-effects.ts` — nubes de gas por sección. `CLOUD_VISIBILITY_THRESHOLD` + `CLOUD_RAMP_PER_SECOND`: la concentración mostrada persigue a la real con retardo en vez de saltar, y la opacidad del emisor acompaña a la densidad.
- `crew-death-effect.ts` — incluye la variante `weaponStrike` para `cause: "enemy-attack"`.
- `substance-phase-change` / `reservoir-content-phase-change` — columna de vapor ascendente (color de la sustancia) y escarcha sobre la pieza (más densa si rompió el tanque), del eje térmico de 14a-3.

**Gaps de asset conocidos**: el chispazo de desmontaje reutiliza el banco de sobrecarga y la brecha el de explosión grave — no hay assets dedicados (deudas #17 y #40 en `PENDIENTES_OBSERVACIONES.md`).
- `atmosphere-effect-coverage.ts` — cuánta superficie ocupa un fenómeno de atmósfera y con qué densidad (aparte de "qué partícula es", que decide `atmosphere-state-effects.ts`). `sectionEmitZone` reparte partículas sobre las celdas REALES de una sección, **nunca su bounding box**; `coverageQuantity` escala con área y severidad con techo y piso; `thresholdSeverity` normaliza los dos lados del eje térmico. Compartido por los tres efectos de atmósfera y por las chispas de sobrecarga.
- `particle-effect.types.ts` — `EffectArea` (celdas de grid) como tercer parámetro opcional de `StateDrivenEffect.start`: un efecto de SALA necesita su superficie, no solo un punto. Opcional, así la galería y los tests siguen instanciando efectos sin sección detrás.
- `atmosphere-state-effects.ts` — los tres efectos escalan densidad por severidad × área. `FREEZING_THRESHOLD_CELSIUS` y `HEAT_VAPOR_THRESHOLD_CELSIUS` se leen de `HAZARD_PARAMETERS.thermal` — el umbral del **TRIPULANTE**, no el de la estructura: ver escarcha o vapor significa que la sala mata.
- `phase-change-effect.ts` — `substancePhaseChangeEffect` (vapor ascendente con el color de la sustancia) y `reservoirContentPhaseChangeEffect` (escarcha sobre la pieza, densidad según el daño).
- `electric-arc-effect.ts` — arco de un cable quemado, direccional y transitorio, en reemplazo de la luz de la cicatriz.
- `overloaded-conductor-effect.ts` — chispas con núcleo propio (`OVERLOADED_SPARK_CORE_COLOR`, distinto del ámbar de la luz), frecuencia por debajo de la vida para que nunca haya cero partículas vivas, dispersión sobre el footprint real. `withLight`: la cicatriz de un CABLE apaga la luz, la de una pieza colocada la conserva.

## `game/src/render/`
### Color y contrato de paleta
- `palette.ts` — **fuente canónica de color**, dos ejes ortogonales. *Eje A (semántica de crisis)*: `CRISIS_FATAL/WARNING/SAFE_COLOR` + `INFO_NEUTRAL_COLOR` (rojo/ámbar/verde/cian), con espejos CSS (`*_CSS`) y `hexToCss`. De él derivan `healthFractionColor` (corte de 3 niveles, compartido con la tira de tripulación y el HUD de estado), `LED_ACTIVE_TINT` (ámbar, **nunca verde**: un LED de alarma en verde estaba semánticamente al revés), `CORE_LOOP_MODE_COLORS`, `COMPONENT_CONDITION_TINT`, `COMPONENT_WEAR_TINT`/`_CSS` (`usado` es un bronce apagado que no colisiona con el Eje A; `condition` gana sobre `wear` al pintar), `STRUCTURAL_LAYER_COLOR`, `ENERGY_LAYER_COLOR`/`_ALPHA`, `POWER_BLOCKED_FLASH_COLOR`, `TIMER_TEXT_COLORS`, `SELECTED_CELL_COLOR`, `OBJECTIVE_DONE_COLOR`, `SEALED_VALVE_COLOR`. *Eje B (categoría de tag)*: `TAG_CATEGORY_COLORS`/`_CSS` (funcional azul-acero / material bronce); el químico vive en `CHEMICAL_TAG_COLORS` y `CHEMICAL_COMPOUND_COLORS`. `chemicalSubstanceColor(id, tags)` resuelve elemento curado > compuesto curado > primer tag > neutro. También `LED_LIGHT_RADIUS_PX`/`LED_LIGHT_INTENSITY`.
- `palette.contract.test.ts` — guardia de regresión del contrato: verifica los cortes de `healthFractionColor`, que el LED activo nunca sea verde, que condición/estructura/timer/válvula deriven del Eje A, y que el Eje B no colisione con el A ni consigo mismo. **Cualquier color nuevo se agrega acá, no como literal suelto.**
- `render-depths.ts` — `RENDER_DEPTH`, orden de capas. Valores con historia: `dynamicShadows` 1.7 y `dynamicLight` 1.8 van sobre suelo/decals y **debajo** de objetos (la luz actúa sobre el plano del suelo, no sobre los sprites); `enemyEntity` 4.2 junto a `crewEntity`; `mapDimOverlay` 5.8 / `transferHighlightedConduit` 5.9 / `problemMarker` 6 / `transferTargetHighlight` 6.1 (modo de transferencia); `hudFloatingPanel` 25 tiene depth propio entre `hudContent` y `notification` porque compartir el 21 con la tira de tripulación hacía que la tira lo tapara al re-crearse.

### Plano y overlay
- `floorplan-renderer.ts` — `renderFloorplan(…, walkableGrid?)` → `FloorplanRender` con `conduitLayers` (un `Graphics` por `FloorplanLayerId`) y `conduitPaths`. `FLOORPLAN_LAYER_IDS`: `estructural`, `energia`, `fluido`, `senal`, `puertas`, `presion`. Dibujantes por capa: `drawConduitLine` + `drawConduitMarker` (ambos exportados, los reusa el clon de capa del modo de transferencia), `drawStructuralLayer` (tinte de RE degradado por sección), `drawEnergyLayer` (rojo/ámbar por déficit), `drawPressureLayer` (molde del anterior; alpha por distancia a lo nominal — **una sala nominal no se dibuja**, principio 6), `drawDoorLayer` (CONTORNO por celda, no barra: independiente de la orientación y no tapa el sprite; marca además las válvulas cerradas EN VIVO, porque `drawConduitMarker` se dibuja una sola vez desde `initialAperture`).
- `mission-overlay-renderer.ts` — `renderMissionOverlay(…, floorplan?, walkableGrid?, resolveDefinition)`. El cable de señal se dibuja ruteado por conductos cuando cruza secciones (`drawSignalEdge`), no en recta. `drawCreationLayout` dibuja cada parte de una creación en su offset con su sprite real. Expone fuera del `graphics` bakeado: `ledIndicatorsByInstanceId`, el texto LCD por instancia (retintables/actualizables por tick sin redibujar todo; el LCD con throttle de 250-500 ms) y `componentSpritesByInstanceId` (sprites reales por instancia, para tintar la pieza en el modo de transferencia).
- `conduit-path.ts` — ruteo en espacio de PÍXELES (`PixelPoint`), con el marcador del conducto como vértice exacto y el cruce de pared por celdas de aproximación transitables (`nearestSectionCell`). `computeConduitPaths(floorplan, walkableGrid?)` reusa el pathfinding de tripulación (`crew/floorplan-pathfinding.ts`); `computeConduitRoute(floorplan, walkableGrid, from, to, kind)` es la forma general multi-salto (vía `findConduitRoute`), y `computeSignalWireRoute` su wrapper con `kind: "senal"`.
- `walkable-grid.ts` — extracción del tilemap. `withDoorState(grid, isDoorBlocked)` **decora, no copia**: la escena mantiene `navigationGrid` (decorada, para pathfinding y bloqueo) separada de `walkableGrid` (cruda, para el ruteo estático de conductos y cables).
- `door-visuals.ts` — `doorOpenness` (estaba duplicado textualmente en renderer y escena), `easedDoorOpenness` (Sine.InOut, respeta los extremos para no adelantar la apertura real) y `doorSlideAxis` (eje del vano si mide más de una celda; si no, perpendicular al sentido del paso).
- `projectile-renderer.ts` — `renderProjectileTokens` recibe un resolver `(ref) => componentDefinitionId` y dibuja el sprite real de la pieza antes de caer al círculo placeholder.

### Sprites y estado visual de componentes
- `component-state-visuals.ts` — tabla ORDENADA estado→(tinte, ícono, aviso) + `resolveComponentVisual` (cadena `destroyed > jammed > unpowered > wear`) e `instanceStateLabel` (compone los números, porque `t()` no interpola). **Es la única fuente de tinte de sprite.**
- `component-sprite-registry.ts` — `componentTextureKey`/`hasComponentSprite` + `ensureComponentPlaceholderTexture`. El placeholder es un `Image` por celda, así que una pieza sin arte recorre el mismo camino de tinte y sombreado que un sprite real.
- `crew-sprite.ts` — sprite genérico de tripulante para los tokens del PLANO (no la tira de UI). `preloadCrewSprite` carga `crew/tripulante.png`; `ensureCrewTintTexture` deriva una vez una base GRIS CLARA en `CanvasTexture` (luminancia empujada a claro, alfa preservado) para que `setTint` rinda nítido el color por personaje. `faceX` (pura, con test: derecha ⇒ voltea, izquierda ⇒ no, vertical puro ⇒ conserva la cara) resuelve el `flipX`. `CREW_TOKEN_HEIGHT_PX` fija la altura.
- `crew-portrait-registry.ts` / `ship-image-registry.ts` — registros `import.meta.glob` de retratos por nombre y de imagen exterior por arquetipo. El primero excluye el basename `tripulante` (es el sprite genérico compartido); el segundo cae siempre al placeholder de color mientras `game/assets/sprites/ships/` esté vacía.

### Iluminación y sombras (`shadows/`)
- `visibility-polygon.ts` — geometría PURA sin Phaser: `raySegmentIntersection`, `castRay`, `computeVisibilityPolygon` (polígono iluminado por luz puntual, recortado al radio).
- `occluder-edges.ts` — `buildStaticOccluderEdges` (fusión de tramos colineales de la grilla walls∪objects), `rectEdges`/`worldBorderEdges`, `extractOccluderGrid`.
- `dynamic-shadows.ts` — `DynamicShadowLayer`: el glue de Phaser, dueño de una `RenderTexture` que se rellena de oscuridad y borra (ERASE) el polígono de visibilidad de cada luz. `addLight`, `setStaticOccluders`/`setDynamicOccluders`, `redraw()` por frame, `setIntensity` (0 = apagadas). **La oscuridad es el default**: no hay luz ambiental global (se probó y lavaba el contraste); solo la despejan luces reales. Perf: cache de polígono por luz invalidado por `occludersVersion`, culling por viewport, short-circuit a intensidad 0, y `quantizeIntensity` para que el parpadeo de las luces de cicatriz no invalide el cache 60 veces por segundo.
- `light-grid.ts` — `computeLightLevelGrid`: nivel de luz 0..1 por celda, PURO, reusando `raySegmentIntersection` (misma geometría que dibuja la RT). Recorta por bbox de radio, combina luces con `max` (no suma) y usa `ambient` como piso. **La contribución de una luz NO lee `intensity`** — esa propiedad es el brillo del glow aditivo, no opacidad de oscurecido, y mezclar las dos escalas dejaba todo iluminado. `LIGHT_CLEAR_ALPHA_FLOOR` se exporta solo para la RT de sombras.
- `light-shading.ts` — `shade(baseColor, level)` canal por canal, `NEUTRAL_TINT`, y `actorLightLevel` con `MIN_ACTOR_LIGHT_LEVEL` (piso de brillo: tripulación y enemigos se oscurecen, nunca desaparecen).
- `authored-lights.ts` — `loadAuthoredLights(scene, archetype)`: lee la capa de objetos Tiled `luces`; `toAuthoredLightSpec` es puro y testeado (defaults + parseo de color hex).
- `shadow-settings.ts` — store vivo de `shadowIntensity` (0..1), que desacopla el slider de Opciones del layer que lo lee por frame.

### CRT
- `crt-pipeline.ts` — `CrtPostFxPipeline` + `registerCrtPipeline`: filtro en dos capas por uniforms (`onPreRender`). "Clean CRT" (scanlines / aberración cromática base / barrel / glow) por `uCrtIntensity`; "System Failure" (CA fuerte + flicker) por `uFailure`. Barrel y scanlines en coords globales (`gl_FragCoord`) para ser coherentes entre las dos cámaras. Alpha-preserving, solo WebGL; devuelve la instancia (una por cámara) para fijar uniforms por frame.
- `crt-settings.ts` — store vivo de `crtIntensity`/`flickerIntensity` (+ `hydrateCrtSettings`). Mismo patrón que `shadow-settings.ts`: desacopla lectura por-frame de escritura del slider, sin plumbear eventos entre escenas.
- `signal-node-layout.ts` — `layoutSignalNodes` (reparto en abanico de los nodos que comparten celda), `signalNodeAtPoint`/`signalNodesAtPoint` (hit-test por el más cercano en píxeles / todos los candidatos, para detectar ambigüedad) y `signalNodeRoleKey` (entrada / salida / emite / paso). **Compartido a propósito por el dibujo y por el modo cableado**: dos cálculos separados se desincronizan.
- `conduit-path.ts` — `signalWireCells(route)` (celdas que ATRAVIESA un cable, para el índice del tooltip) y `signalWireBodyCells` (sin los extremos, para que la cicatriz no se pinte encima de las piezas que une) — divergencia deliberada, documentada en `wireByCell`. `polylineMidpoint` (punto medio POR LONGITUD, no el vértice del medio), `dashedPolyline` (acumula el patrón entre tramos para que los guiones sigan las esquinas) y `arcTargetsNear`.
- `mission-overlay-renderer.ts` — `drawSignalLayer` exportada, para repintar solo la capa de señal; el cable se pinta por su carga (`wireLoadColor`, `WIRE_LOAD_WARNING_RATIO`) y carbonizado si se quemó (`BURNED_WIRE_COLOR`).
- `queued-install-ghosts.ts` — `renderQueuedInstallGhosts(scene, ghosts, onCreated?)`: sprite atenuado (o el placeholder tinteable) más contorno entrecortado por celda con `dashedPolyline`. Ámbar si la tarea está bloqueada, más opaco en `in-progress`.
- `component-state-visuals.ts` — filas `overloaded`, `unsignaled` y `frozen-content`. `stateGlyphs`: **el tinte sigue siendo uno (el más grave), los glifos se acumulan**; `detailKeys` por estado, porque los dos números de `unsignaled` no son los de `unpowered`.
- `render-depths.ts` — `frostLayer` 1.6, `queuedGhost` 1.9 (entre la luz persistente y los objetos: **un plan no puede tapar un estado real del motor**), `emitterRange` 2.8.
- `palette.ts` — `FROST_LAYER_COLOR`/`FROST_MIN_ALPHA`/`FROST_MAX_ALPHA`, `OVERLOADED_SPARK_CORE_COLOR`, `BURNED_WIRE_COLOR`, `wireLoadColor`/`WIRE_LOAD_WARNING_RATIO`.

## `game/src/scenes/floorplan-scene.ts`
**El archivo más grande y más tocado del proyecto** (29 revisiones registradas). Es la escena del plano: monta el render, se suscribe a todos los buses del motor, anima los tokens y hospeda todo el HUD de misión. Agrupado por responsabilidad:

**Ciclo de vida**
- `preload()`: `preloadAudioAssets`, sprites de tripulación/componentes/naves.
- `create()`: `extractWalkableGrid` **antes** de `renderFloorplan`; `mission.setMotionBlockedQuery(...)`; alta del `DynamicShadowLayer` con los oclusores estáticos extraídos una vez; instancia las luces autoradas (capa Tiled `luces`); publica la función de guardado vivo (`live-mission-save.ts`).
- `update()`: sincroniza `crewState.currentCell` **y** `currentSectionId` CADA FRAME desde la posición visual real del token (`sectionContainingCell`), no desde el modelo por-tarea del scheduler (que solo actualiza la sección al COMPLETAR un `go-to`). Redibuja las capas `estructural`, `energia` y `presion`, corre `shadowLayer.redraw()` y `applyLightShading()`, refresca el tooltip a la vista y reposiciona el panel de acciones.
- Los efectos de flujo (`updateConduitFlowEffects`/`updateSignalWireFlowEffects`) y los tweens de salto solo corren en `coreLoop.mode === "execution"`: **todo se congela en pausa táctica**, igual que proyectiles y atmósfera.

**Movimiento de tokens**
- `chainHops` (generalizado a cualquier `HopTarget`/`JumpSignature`) encadena un salto por celda; `travelEnemyToken`/`enemySegmentDurationMs` reparten la duración real del tramo de ruta en vez de saltar A→B. `faceHopTarget` aplica el volteo por dirección (no-op en enemigos). `chainHops` **difiere** el salto que entra en una celda de puerta hasta que esté abierta (`isDoorwayHeldClosed`, reintento cada `DOOR_WAIT_RETRY_MS`): el tiempo de la hoja le cuesta al jugador.
- `activeHopTweens` + `trackHopTween`: los tweens en vuelo se pausan/reanudan según el modo del core loop.
- `unreachableReason` nombra la puerta culpable de un "sin ruta al destino", rebuscando la ruta sobre la grilla sin puertas. Solo corre cuando una orden ya falló.

**Suscripciones a eventos del motor** (Observer; `/engine` nunca conoce Phaser): `enemyEvents`, `reactionEvents`, `failureEvents`, `powerEvents`, `salvageEvents`, `integrityEvents`, `atmosphereEvents`, `doorEvents`, más los de tarea. Cada uno dispara `fireEventEffect` + `fireEventSound` por el mismo camino. La brecha se pinta en SU celda y el daño en el centroide.

**Cicatrices y efectos persistentes**: `syncOverloadedConductorEffects` (uno por instancia en `overloadedRefs`, con `stop()` al desmontar), `syncUnpoweredSectionLights`, `redrawUnpoweredSectionScar` — estos dos consumen `mission.sectionHasNoPowerGranted()`, no `blueprint.unpoweredSectionIds`.

**Iluminación y tinte** — la regla más delicada del archivo:
- `baseTints` (`WeakMap`) + `baseTintOf`/`setBaseTint`/`applyShadedTint`: **único punto de escritura de tinte**. Todo lo demás (LED, estados de componente, resaltados) escribe la BASE; solo `applyLightShading` llama a `setTint`/`setFillStyle`.
- `applyLightShading()` pinta componentes, LEDs y tokens con `base × nivel de luz de su celda`; no toca affordances de UI (hover, anillos, marcador). `forEachShadedTarget` es la lista única de objetivos, para que `applyLightShading` y `clearLightShading` no puedan divergir.
- `registerLight` → depth `dynamicLight`; `registerBurstLight` deja el fogonazo en `effect`. `registerEffectObject` + `worldEffectOptions` son el registro único de todo objeto creado por un efecto (cámara de mundo + depth) — el que evita el bug de doble-cámara.
- `collectDynamicOccluderEdges` pasa componentes y tokens como casters móviles; `syncLedLight` hace que un LED encendido emita `PointLight` real y participe de las sombras.

**HUD y capas**
- `redrawShipStatusHud()` con throttle por cambio de valor (redibuja siempre si algún indicador está `critical`, para animar el parpadeo).
- Botón "Capas" → panel flotante; `toggleFloorplanLayer`/`applyLayerAlpha` atenúan la línea estática, pero el flujo animado se OCULTA por completo (`ConduitPathFlowState.visible`) — no comparte el factor de atenuación.
- Controles de energía: `redrawEnergyControls()`/`openEnergyPriorityPanel()`/`closeEnergyPriorityPanel()`, `unallocatedPowerUnits()`/`syncEnergySliderCaps()` (tope global del reparto; los sliders de las otras secciones se reajustan sin reconstruirse). `ENERGY_CONTROL_BOX` es la fuente única de la que derivan el panel de fondo y `energyControlWorldBounds`; `ENERGY_CONTROL_SHADOW` es un segundo panel tintado de negro que hace de sombra dura, sin shaders.
- `redrawScreenAlertOverlay` — viñeta de alerta a pantalla completa sobre `hudCamera` + alarma, disparada por `ShipStatusSnapshot` crítico, `overload` violento, combustión no-débil, brecha, o el arranque de la crisis (`crisisStartAlertUntilSeconds`, chequeado tanto síncronamente en `create()` como por el evento `crisis-triggered`, porque el trigger ya aplica antes de que la escena exista).
- `updateComponentStateTints` + `syncStateIcon` escriben `setBaseTint` (nunca `setTint`) y corren FUERA del guard de `execution`; el ícono no entra en `forEachShadedTarget`, así que la luz no lo apaga.
- `updateDoorSprites` corre la hoja `DOOR_SLIDE_CELLS` y la desvanece **sin tweens** (por la inversión a mitad de camino, la reconstrucción del overlay y la pausa táctica).
- `tooltipRedrawKey`: el tooltip se reconstruye cuando cambiaría su TEXTO, no solo al cambiar de celda, y se refresca desde `update()` mientras está a la vista.

**Input — las tres trampas ya resueltas** (volver acá antes de agregar UI sobre el mapa):
- `installTopmostOnlyInput()` sobrescribe `input.sortGameObjects` para que el objeto de UI de capa más alta sea el ÚNICO que recibe el click. El `topOnly` nativo no alcanza: ordena por el índice en el `renderList` de la cámara del puntero, donde los `Label` de rexUI no entran, y el hit-test ignora las listas `ignore` de cámara (que solo afectan al render), así que un objeto de mundo tiene área de click fantasma sobre el HUD.
- `swallowCurrentClick()` + `targetPickArmedDownTime`: la pulsación que abre o cierra una capa de UI sobre el mapa no vale además como click de mapa. Se identifica por `pointer.downTime` (la pulsación concreta) y no con una bandera de "ignorá el próximo click", para no depender del orden en que Phaser despacha GameObjects vs. escena.
- `isOverFixedUi()` chequea `actionPanelBounds` y `energyControlWorldBounds` — el panel flota sobre el mapa, a diferencia del viejo docked.
- `keydown-ESC` cancela primero el modo de selección activo, y recién después cae a la pausa.

**Modo de transferencia** (`updateTransferMode`/`updateTransferChannel`) — el molde a copiar para cualquier modo de selección espacial: botón "Cancelar" en el mismo casillero que `wireModeButton` (mutuamente excluyentes), `transferDimOverlay` oscureciendo el plano, `transferModePriorActiveLayers` guardando el snapshot completo de capas para restaurarlo, reemplazo de `activeFloorplanLayers` por `{"fluido"}` exacto, clon top-level de la capa `fluido` (`transferFluidoHighlightLayer`, por el bug de depth), contornos de footprint real por candidato (`instancePlacement` + `occupiedCells`, no una sola celda), `spriteCopyAboveDim` para levantar el sprite del candidato por encima del oscurecido (el original no se puede subir porque vive dentro del container del overlay), y `updateTransferChannel` dibujando la ruta real con `computeConduitRoute(..., "fluido")`.

**Otros helpers**: `updateSelectedHighlight()` usa un pool de rectángulos (uno por celda ocupada) y pinta el footprint completo; `instanceCell`/`instancePlacement`; `fireCollectionBurst(originCell, targetCell, count)` (stagea N "monedas" en arco hacia una mesa) y `notifySubstanceTaskResult`, que consume `mission.consumeMaterializedByTask(event.taskId)` en vez de comparar longitudes de listas; `reactCrewPortrait`/`playAnalogStatic`/`syncCrewToxicOverlays`; `updateCursor`/`customCursor`.

**Teclas de dev**: **F** (`fireDevEventSample()`, siguiente fenómeno del catálogo por el camino de producción — única forma de verificar el bug de doble-cámara, porque la galería tiene una sola cámara) y **H** (`fireDevSectionDamage()`, combustión REAL por el emisor del motor: recorre daño, colapso, brecha, drenaje y desgaste). Ambas usan `devTargetMode`: arman la herramienta y el siguiente click de mapa elige la celda, sin depender de `interaction.selectedCell` — **una herramienta de dev no debe depender de un estado de juego para funcionar**.
- `updateEmitterRangeHighlight()` — `Graphics` top-level en depth `emitterRange`, redibujado desde `update()` porque la cobertura es viva (una puerta que se abre cambia la línea de visión).
- `signalWireRouteFor` centraliza la ruta de un cable: flujo, dibujo y cicatriz comparten la MISMA. `wireByCell` + `rebuildWireCellIndex` es el índice celda→cable del tooltip. `refreshSignalWireColors` repinta a 4 Hz **fuera** del gate de ejecución (la capacidad efectiva baja con la temperatura sin que cambie la topología). El flujo animado de un cable quemado se apaga; `electricArcEffects`/`arcTargetsFrom` pintan sus arcos y `burnedEdgeCenterCell` ancla el fogonazo.
- `handleWireModeClick` se parte en "elegir nodo" y `applyWireNode`, para que el menú circular entre por el mismo camino. Línea fantasma con flecha en `pointermove`; aro de carga en el nodo emisor (`nodeLoadRatio`, canal separado del color de rol); el resalte de nodos usa `layoutSignalNodes`, no el centro de celda. El click pasa el punto de mundo además de la celda.
- `redrawFrostLayer` pinta la escarcha por celda con alpha por severidad; `initSectionAtmosphereEffects` pasa las celdas de la sección a los tres efectos; `syncOverloadedConductorEffects` pasa el footprint real.
- `chainHops` gana `shouldContinue`, consultado antes de cada salto (corta ENTRE saltos, nunca a mitad de uno). `travelCrewToken` y `fireFabricationEffect` registran su apagador en `active-task-visuals.ts`; `task-cancelled`/`task-failed`/`task-blocked` lo invocan y `task-completed` lo olvida.
- `buildQueueRows` alimenta la cola; `queueCancelHitAt` distingue click derecho (fila entera) de izquierdo (solo la "×"); `updateQueueCancelHover` resalta el botón bajo el cursor. `redrawQueuedInstallGhosts()` cuelga de `redrawQueuePanel()`: **mapa y cola muestran el mismo dato y se redibujan en el mismo sitio, para que no puedan divergir.**

## `game/src/ui/`
Todo el chrome usa el pack Kenney a través de los helpers `createKenney*`. **Regla transversal del dominio**: un botón deshabilitado lleva el MOTIVO en su propio label — un botón gris y mudo impide descubrir qué falta. Y los widgets solo pintan: el riesgo, el bloqueo y los números los precalcula el motor o el controller.

### Primitivas
- `widgets/kenney-button.ts` — **único punto de creación de botones rexUI**: sonido de hover y click heredado por las 10 escenas de menú y todos los widgets de misión, `iconTextureKey`/`iconSize` opcionales, `attachHoverJuice`.
- `widgets/kenney-list.ts` — `KenneyListItem` distingue `enabled` (clickeable, gobierna `setInteractive`/`onClick`) de `muted` (solo atenuado visual). `pointerout` restaura `dimmed ? 0.25 : ROW_BG_ALPHA`, no un alpha fijo.
- `widgets/kenney-card-list.ts` — lista de tarjetas con scroll. Ojo: rexUI ancla cada hijo de un sizer por su CENTRO, así que las tarjetas dibujan sus hijos relativos al centro (`left = -cardWidth/2`) con alto adaptativo al contenido medido; con `origin(0,0)` media tarjeta caía fuera de la máscara.
- `widgets/kenney-slider.ts` — `createKenneySlider`: slider 0..1 armado con primitivas (el pack no trae track/thumb). `onChange` en vivo al arrastrar; limpia sus listeners de `pointermove`/`pointerup` en el SHUTDOWN.
- `ui-effects.ts` — `popIn`/`slideOut`/`clickReaction`/`shake`/`flash`/`attachHoverJuice`: tweens reutilizables. `shake`/`flash` agitan un contenedor de UI sin tocar el mapa.
- `custom-cursor.ts` — `CustomCursor`: cursor contextual vía `setDefaultCursor(url(...))` con sprites Kenney, deduplicado por tipo para no pelear con el `useHandCursor` por objeto. `UI_POINTER_CURSOR_CSS` es el sprite "selectable" que usan botones y filas.

### Panel de acciones y tooltip
- `widgets/mission-action-panel.ts` — `renderMissionActionPanel`, construido en origen LOCAL (0,0); el llamador reposiciona el `Container` con `setPosition()`. Variantes de `ActionPanelContent`: `idle` (mensaje corto), `substances-list`, `substance` (ficha + "Analizar sustancia"), `instance`, `conduit` (válvula: apertura, delta de presión con flecha, abrir/cerrar) y `door` (`DoorPanelInfo` + `renderDoorBlock`, compartido con `instance` porque una puerta construida se desmonta y repara como cualquier pieza; `overrideSource` llega hasta el panel para que el botón gris diga POR QUÉ). **La variante `empty` fue borrada**: sin acciones, un panel flotante que tapa el mapa a cambio de una pista de texto no se gana el sitio.
  - En `instance`: `dismantleHazards` (badge ámbar + un botón de asegurado por hazard aplicable) y `ReservoirPanelInfo` (contenido + Aplicar/Trasvasar/Extraer, con `transferBlocked`/`applyBlocked`/`reservoirHint`/`fabricatorBlocked`/`openFabricatorBlocked` como motivos en los labels).
  - `attachPanelScroll(...)` convierte el panel en ventana con scroll (máscara sobre un sub-container + rueda + indicador "▾") cuando excede `maxHeight`. **No usa `ScrollablePanel` de rexUI** porque el apilado del panel es en coordenadas absolutas y rexUI re-centra a sus hijos.
  - `attachPanelDrag(...)` — arrastre por click&hold sobre el backdrop (`pointerdown` local + `pointermove`/`pointerup` globales, mismo patrón que `kenney-slider.ts`), con callback `onPanelDragged`.
  - El `backdrop` tiene `setInteractive()` sin handler propio, para entrar al hit-test de `installTopmostOnlyInput` y cerrar el agujero por el que el click al área vacía atravesaba al mundo.
  - **No hay botón MESA global**: la mesa se abre desde el panel contextual del aparato y entra fijada a su dominio.
- `widgets/mission-tooltip.ts` — muestra tag de desgaste y **resistencia EFECTIVA** (no la de catálogo). La variante `section` da presión, tendencia, "Vacío: letal" y la brecha de esa celda: es la única lectura del estado de una sala desde que el panel de celda vacía dejó de existir. Las mismas líneas se pintan sobre una PIEZA cuando la sala es noticia (`noteworthySectionAtmosphere`), porque tras tapar la brecha el jugador mira el parche, no el suelo de al lado. Las líneas de estado (ícono, texto, color) las resuelve el llamador desde `component-state-visuals.ts`.

### HUD de misión
- `widgets/ship-status-hud.ts` — `renderShipStatusHud`: 4 filas (atmósfera / soporte vital / integridad de casco / energía) con barra por fracción (`healthFractionColor`) + parpadeo en `critical` + botón "Sustancias (N)".
- `widgets/notification-center.ts` — `NotificationCenter.push({title, lines?, type})`: pila transitoria arriba-centro, tipos info/success/warning/error mapeados al contrato de paleta (`INFO_NEUTRAL`/`CRISIS_SAFE`/`CRISIS_WARNING`/`CRISIS_FATAL`), popIn + auto-descarte, cap de 4.
- `widgets/crew-strip.ts` — tira de tripulación. Retratos con origin 0.5 (para animarlos) y tinte de salud en reposo; expone `portraits` por actor para las reacciones de daño/muerte. Cada tarjeta lleva una franja de identidad de color en el borde izquierdo, siempre visible, con el mismo `CREW_TOKEN_COLORS[index]` que el token del mapa.
- `widgets/floorplan-layer-toggle-panel.ts` — un botón de toggle por `FloorplanLayerId`.

### Controles de energía
- `widgets/power-allocation-slider.ts` — `renderPowerAllocationSlider`: slider entero por sección, **objeto de mundo** (usa `getWorldPoint`) con `destroy()` explícito de sus listeners de `scene.input`, porque se reconstruye muchas veces por sesión. Acumula varias lecciones de playtest que conviene no revertir:
  - El track abarca `0..max(1, maxUnits, units)`, escala fijada al construir; el arrastre se topa en `capUnits` (`setCap` lo reajusta sin destruir el widget) y el tramo bloqueado usa `LOCKED_COLOR` neutro.
  - **El pedido NO se clampea al presupuesto** — clamparlo hacía que dos zonas con 3 y 7 mostraran ambas "2/2". Relleno partido: azul hasta `grantedUnits`, ámbar de ahí al pedido (`setGranted` lo refresca). El `· P%` solo aparece cuando el pedido entra en el presupuesto.
  - `signalBlocked()` (throttle 500 ms) da señal de rechazo al chocar contra el tope: sacudón del thumb, destello con `POWER_BLOCKED_FLASH_COLOR` y sonido `uiDenied`. Sin esto el tope funcionaba en silencio y el slider "parecía roto".
  - `setLabel(texto, color)` mide y encoge la fuente (piso 10px) si no entra en `maxLabelWidth` — robustez frente a i18n. El mensaje de bloqueo va sobre un badge casi negro dimensionado al texto medido: el rojo del contrato sobre el gris del panel Kenney da ~1.3:1, y sobre el badge sube a ~4.5:1 sin inventar colores fuera de las constantes canónicas.
- `widgets/power-priority-list.ts` — `renderPowerPriorityList`: inspector de prioridad de una sección con botones ↑/↓ por fila, sin drag-and-drop.

### Selector de instalación y composición
- `widgets/install-picker-modal.ts` — `renderInstallPickerModal` recibe **un único `options: ReadonlyArray<InstallPickerOption>`**: lista plana, sin pestañas (`InstallPickerTab`/`activeTab`/`renderTabStrip` fueron borrados). Una fila por bucket de desgaste, para que el jugador elija qué unidad gasta en vez de recibir la peor en silencio. `InstallPickerOption` lleva `consumesRecipe?` y `blocked?: "no-stock" | "missing-ingredients"`; una fila bloqueada es `enabled: true` + `muted: true` (seleccionable pero atenuada) y el botón "Instalar" queda gateado por `selected?.blocked`. `renderSelectedComponentSheet` ancla la huella en `titleText.y + titleText.height + 4` y avanza `lineY` con `warningText.height + 8` — offsets medidos, no fijos, para que nada se pise cuando el título o el warning envuelven a dos líneas. `initialScrollT`/`onListReady` preservan el scroll al recrear el modal. `DESCRIPTION_BACKDROP_*` pone un rectángulo bajo la ficha porque los tags del Eje B daban 1.2-1.4:1 sobre el gris del panel.
- `widgets/composition-list.ts` — `renderCompositionLines`: sufijo `"(sin stock)"` en gris atenuado cuando `ingredient.hasStock === false`, con prioridad sobre el resaltado ámbar de `hasRequiredTag`.

### Tarjetas de selección
- `widgets/crew-select-card.ts` — `renderCrewSelectCard`: retrato con fallback de color, nombre, especialidad/tier, rasgo, descripción. Hermana de `crew-strip.ts` pero en grilla vertical y sin barra de HP.
- `widgets/ship-archetype-card.ts` — `renderShipArchetypeCard`: imagen exterior con fallback, nombre propio, arquetipo, descripción y pros/cons en **columna única con wrap dinámico** (dos columnas lado a lado se solapaban con texto largo en español).
- `queue-rows.ts` — `buildQueueRows`: orden y anidado de la cola, **pura y testeada** (un árbol mal ordenado miente sobre qué espera a qué, y el widget tiene por contrato "solo dibuja"). Filtra los tres estados terminales antes de resolver los padres, así que un dependiente cuya dependencia se canceló pasa a raíz con su motivo en vez de colgar de una fila que ya no se dibuja.
- `widgets/crew-queue-panel.ts` — `UnifiedQueueTask` con `depth` y `blockReason`: sangría, conector `└`, bloqueadas en ámbar con su motivo, botón de cancelar con caja propia (`rowXMin`/`rowXMax`).
- `widgets/signal-node-menu.ts` — menú circular para elegir entre nodos superpuestos. **Aparece solo con ambigüedad real.**
- `widgets/mission-tooltip.ts` — `TooltipContent` suma `kind: "wire"` (carga/capacidad efectiva, desgaste, quemado, degradación térmica) y `SignalTooltipInfo` en la variante `instance` (qué gobierna, quién la gobierna, si emite, `burnedWires`). Línea de temperatura siempre presente, coloreada por los DOS lados del eje con los umbrales del daño a TRIPULACIÓN (`isLethalTemperature`), y línea de "fuente de calor activa" en ámbar — ejes separados a propósito.
- `widgets/mission-action-panel.ts` — `ActionPanelContent` suma `kind: "wire"` con "Retirar cable" y el coste dicho por adelantado.
- `widgets/install-picker-modal.ts` — `footprint` pasa a **opcional** (un cable no se coloca) y `detailLines` admite líneas ya formateadas por el llamador: el mismo modal sirve a instalación y a cableado. `blocked` admite `"queue-reserved"`.

## `game/src/scenes/` (otras escenas)
- `title-scene.ts` — `fadeIn` + `popIn` escalonado en los 6 botones. Ojo con "Continuar", creado dentro de un `.then()`: su `y` se captura en una constante antes del `await`, o el microtask lo dibuja encima de "Salir".
- `archetype-select-scene.ts` / `crew-select-scene.ts` — grillas de `renderShipArchetypeCard` (2×2) y `renderCrewSelectCard` (2 columnas), con entrada escalonada.
- `creative-workbench-scene.ts` — mesa de creación. `CHEM_COLUMNS`: el modo química no hereda el layout del grid físico, usa tres columnas (paleta → selección → resultado) sobre el alto completo. "Modo cableado"/"modo borrar" solo existen en modo físico.
- `dev-event-samples.ts` — `DEV_EVENT_SAMPLES`: catálogo de `DomainEvent` de muestra, uno por fenómeno del registro, compartido por la galería de partículas y la tecla F del plano.
- `particle-gallery-scene.ts` — galería de efectos (una sola cámara).
- `options-scene.ts` — sliders de CRT y sombras, hidratados/persistidos contra `GameSettings`.
- `pause-menu-scene.ts` — persiste el estado VIVO vía `live-mission-save.ts`.

## Raíz y datos autorados
- `game/index.html` + `game/src/main.ts` + `game/src/scenes/boot-scene.ts` — contenedor `#game-root` con tamaño explícito como `scale.parent`/`scale.fullscreenTarget`; `BootScene` fuerza `scale.refresh()` en `ENTER_FULLSCREEN`/`LEAVE_FULLSCREEN`.
- `engine/src/floorplan/maps/nave-exploracion.json` — el plano autorado del arquetipo de exploración (Tiled). Sus capas: secciones, conductos, `puertas` (opcional, con `span`/`axis`) y `luces`.
