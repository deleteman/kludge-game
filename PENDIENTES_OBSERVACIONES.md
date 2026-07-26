
## Observaciones

0. No hay una historia, debería haber una historia definida, con una intro, con algo que muestre lo que está pasando ANTES de ver el plano de la nave? Tal vez un par de escenas con texto que se escribe y cuenta lo que está pasando. Un reporte de incidente? 
1. ✅ RESUELTO (Fase 11f). deben haber indicadores visuales para todo. actualmente la conexión de 2 comopnentes es una línea recta entre ambos, debería seguir el camino viable (pasar por puertas ,no por dentro de paredes), y debería haber una animación corriendo sobre esa líena que muestre flujo de energía.
   Resuelto: los conductos ahora trazan una polilínea real entre las dos secciones que conectan
   (`game/src/render/conduit-path.ts::computeConduitPaths`), reusando el pathfinding ya existente para
   tripulación (`findPath`/`WalkableGrid`) para evitar paredes — no existe un modelo explícito de "puerta"
   en el dominio, pero como la grilla transitable ya excluye paredes según el tilemap pintado, cualquier
   hueco transitable (incluida una puerta pintada como piso) queda disponible para la ruta sin necesidad de
   modelarla aparte. `createConduitPathFlowEffect` (`game/src/particles/effects/conduit-flow-effect.ts`)
   anima partículas de flujo sobre esa polilínea, con intensidad derivada de datos reales del motor
   (`game/src/mission/conduit-flow-heuristics.ts`). Sin `WalkableGrid` (nave sin tile art) cae a línea recta,
   mismo criterio que el movimiento de tripulación.
   **Ampliado en Fase 11f.1**: el CABLE de modo-cableado (que era el caso literal de esta observación —
   "línea recta entre 2 componentes") también dejó de ser recto: `game/src/render/mission-overlay-renderer.ts`
   lo rutea por los conductos `senal` del cruce (`computeSignalWireRoute`), el mismo grafo que ahora lo
   restringe (ver punto 14). Un cable no puede cruzar a otra sección sin conducto de ese tipo.
   **Fix 11f.3 + 11f.4 (visibilidad de las partículas)**: la animación de flujo no se veía por dos causas
   encadenadas. (11f.3) doble cámara: los emisores no se registraban con la cámara de mundo → se pintaban sin
   scroll; resuelto con `ParticleEmitterHook`. (11f.4) causa raíz: `createFlowEmitter` creaba el emisor sin
   `frequency`/`quantity`/`angle` y `updateFlowEmitter` los aplicaba con `emitter.setConfig()` cada frame, que
   recarga TODOS los ops y deja los ausentes (`scale`/`speed`/`lifespan`) en su default (scale 1 → partículas
   de 512px, speed 0 → inmóviles); resuelto creando el emisor con su config completo y actualizando en vivo con
   `setFrequency`/`setEmitterAngle`. Nota de diseño: al inicio del cap.1 solo fluyen los conductos `electrico`
   (los demás no cumplen su condición en calma: ventilación sin ΔP, señal sin cable/emisor activo) — es
   correcto, no un bug.
   **Fase 11f.5 (look del flujo)**: tras validar que las partículas ya se veían, el operador pidió que en vez de
   rociar desde puntos fijos por tramo, viajen de punta a punta del camino. Reemplazado por un sistema de
   "tokens viajeros" (`Image` con posición manual cuadro a cuadro sobre la polilínea completa, no
   `ParticleEmitter`): 2 streams simultáneos por conducto (uno por sentido) para que ambos extremos estén
   siempre cubiertos, con estela corta (2 fantasmas a distancia fija) y fade en los extremos del recorrido.
   **Fase 11f.6**: tamaño subido (se veían muy chicos); toggle de capa ahora OCULTA por completo el flujo
   (antes solo atenuaba, como la línea estática, y confundía); y se agregó flujo animado sobre los CABLES que
   arma el jugador (`SignalEdge`, antes solo los conductos físicos del mapa tenían animación) —
   `syncSignalWireFlowEffects` en `floorplan-scene.ts`, reutilizando `computeSignalWireRoute`.
   **Fase 11f.7**: el flujo seguía moviéndose en pausa (proyectiles/atmósfera sí se congelaban) — corregido,
   `updateConduitFlowEffects`/`updateSignalWireFlowEffects` ahora solo corren en `coreLoop.mode === "execution"`.
   ✅ RESUELTO.
2. en las listas de elementos (como en el modal de instalación), si hago click en un elemento para el que tuve que scrollear para verlo, la lista se vuelve al inicio (no se deselecciona, pero se mueve autoamticamente a su estado original), complicando así la exploración de la lista.
3. Los tripulantes siguen moviendose incluso si a mitad de camino se pausa el juego.

4. Las sustancias quimicas deberían poder sintetizarse solamente desde un aparato especifico. al hacerle click a la "estación quimica" (nombre que se puede mejorar) el menú contextual debería ser "Fabricar sustancias" y "Desmontar".

5. El texto al crear las sustancias quimicas se sale del modal de confirmacion.

## Fine-tunning

* El botón de MESA y el botón de creaciones quimicas podría tener un icono junto al nombre, tengo iconos en game/assets/ui/ui-components/BUTTON-ICONS que podriamos usar
* El menú de la pantalla inicial se ve y se siente profesional? Qué le falta?
* Los primeros 10 minutos de gameplay, son adictivos? Le dan algún reward al jugador?

## Deuda técnica detectada (fuera de alcance de la fase en curso)

Hallazgos anotados al pasar, sin fase asignada. Cada entrada dice qué está mal,
dónde, y qué costaría arreglarlo.

3. **Los emisores no se simulan: un sensor cableado está siempre disparado** (Fase 11a).
   `allEmittersActive` (`engine/src/mission/mission-signal-runtime.ts`) activa TODOS los nodos
   emisores en cada tick, porque nada evalúa `EmitterProperty` (`range`/`triggerType`/`frequency`,
   `engine/src/properties/functional.types.ts`) contra el mundo: ningún sensor de movimiento
   comprueba si hay un tripulante cerca. El `MissionSignalRuntime` ya recibe la fuente de
   entradas por inyección (`EmitterInputSource`), así que el día que exista la simulación de
   sensores se enchufa ahí sin tocar el runtime. Lo necesita cualquier capítulo cuya lógica
   dependa de que un sensor se dispare de verdad y no de que esté cableado.

4. ✅ RESUELTO (Fase 11d.1 + 11d.2 + 11d.4). **La tripulación no tiene posición por celda, así que un proyectil no puede golpearla en misión** (Fase 11a).
   `CrewActor` (`engine/src/crew/crew-actor.types.ts`) solo modela `currentSectionId`; la celda
   concreta de cada tripulante vive en la capa de render (`game/src/crew/hop-movement.ts`), que el
   motor no conoce. Por eso `MissionProjectileWorld.occupantAt` resuelve colisiones solo contra
   componentes colocados, y el impacto cinético contra un tripulante se valida hoy únicamente en el
   caso 17 con un mundo de test. La Fase 11d (enemigos que se mueven con `hop-movement`) va a
   necesitar posición por celda en el motor de todos modos — al resolverla, revisar este punto.
   Resuelto: `CrewActor.currentCell?: GridPosition` (11d.1) + `MissionProjectileWorld.occupantAt`
   ahora resuelve también contra `crew`/`enemies` reales por celda (11d.2, ver
   `case-18-intruso-en-el-pasillo.test.ts`). **Corrección importante**: 11d.2 solo resolvió la mitad
   "motor" (el dato existe, la colisión se resuelve SI el dato está presente) — nada en `/game`
   escribía realmente `currentCell` en partida real, así que el punto seguía roto en la práctica pese
   a haberse marcado ✅ antes de tiempo. Cerrado del todo recién en 11d.4:
   `game/src/mission/mission-runtime.ts` ancla `currentCell` al centroide de sección al spawnear
   (`sectionCentroidCell`) y lo persiste en `toUpdatedSave`; `game/src/scenes/floorplan-scene.ts::syncCrewCell`
   lo mantiene al día en cada `go-to` completado.

5. **Un proyectil suelto pierde su sprite de catálogo al promoverse** (Fase 11a.3).
   `LooseFerromagneticPromoter` (`engine/src/mission/loose-ferromagnetic-promoter.ts`) registra el
   `ProjectileBody` con `ref: placedComponentInstanceId`, no con el `componentDefinitionId` del
   catálogo — así que `projectile-renderer.ts` (`game/src/render/`) no tiene forma de volver a
   `componentTextureKey`/`hasComponentSprite` para dibujar el sprite real de la pieza (ej.
   `pieza-hierro.png`, que SÍ existe en `game/assets/sprites/components/`) y cae siempre en un
   círculo placeholder por código, incluso cuando el sprite de esa pieza está disponible. Arreglo
   estimado: que `LooseFerromagneticPromoter` conserve el `componentDefinitionId` en algún lado
   accesible al renderer (¿un mapa aparte en `MissionRuntime`, ref→componentDefinitionId?) sin
   ensuciar `ProjectileBody`/`kinetics/` con un concepto de catálogo que no le corresponde.

6. **Una creación de la mesa no hereda las propiedades de material de sus partes** (Fase 11c.1).
   `nameAndRegisterCreation` (`engine/src/workbench/creation-naming.ts`) agrega al compuesto la unión
   de las propiedades FUNCIONALES de sus ingredientes (para que derive nodos de señal, 11c.0/11c.1),
   pero NO agrega las propiedades de MATERIAL (`RE`, `MAG`, etc.). Consecuencia: una creación instalada
   en misión no tiene `data.material`, así que `MissionStructuralRuntime` no le aplica cicatriz de RE
   según su sección y `MissionProjectileWorld` no la detecta como ferromagnética aunque contenga hierro.
   La agregación de material es más sutil que la de funcional (¿el RE resultante es el máximo de las
   partes, la suma, el del armazón?, ¿MAG si CUALQUIER parte es MAG?) — por eso se dejó fuera del MVP de
   11c.1. Lo necesita cualquier capítulo donde una creación instalada deba corroerse o servir de
   proyectil/ariete. Al resolverlo, decidir la regla de agregación de material y testearla junto al
   caso correspondiente.

7. ✅ RESUELTO (Fase 11c.2). **La mesa de creación dibuja rectángulos, no los sprites de las piezas** (Fase 11c.1, reportado en playtest).
   `workbench-renderer.ts` (`game/src/render/`) pinta cada celda con `graphics.fillRect` + etiqueta de
   texto; nunca usa los sprites de componente. La escena `creative-workbench-scene.ts` solo precarga UI
   assets (`preloadUiAssets`), no los sprites de piezas. El plano de misión SÍ los muestra vía
   `component-sprite-registry.ts` (`preloadComponentSprites`) + `renderFloorplan`. Arreglo estimado:
   precargar los sprites de componente en la escena creativa y reescribir `workbench-renderer` para
   dibujar `add.image` con la texture key del componente (con fallback al rectángulo actual cuando el
   sprite falte). Encaja naturalmente en 11c.2 (cuando la mesa pase a ser superficie real en misión) o
   en la Fase 12 (pulido visual).

8. **Una creación compuesta instalada se dibuja como un rectángulo placeholder** (Fase 11c.1, reportado en playtest).
   El `componentDefinitionId` de una creación es `creation-XXXX`, que no tiene sprite propio en
   `game/assets/sprites/components/`, así que `renderFloorplan` cae al placeholder. Para dibujarla como
   sus piezas reales habría que descomponer el compuesto (su receta) y pintar el sprite de cada parte en
   su offset dentro del footprint — trabajo de render no trivial, y a futuro una creación podría merecer
   identidad visual propia. Distinto del #7 (ese es la mesa; este es el plano de misión). Diferido a la
   Fase 12 o a cuando se defina la representación visual de compuestos custom.

9. ⚠️ PARCIALMENTE RESUELTO (Fase 11e). **Una sustancia sintetizada (11c.3) queda disponible pero sin destino de uso.** `MissionRuntime.queueSynthesis`
   resuelve la identidad de la mezcla (`engine/src/chemistry/production/synthesize-substance.ts`, vía
   `ReactionResolver`+`NamedRecipeIndex` sobre el catálogo real) y, al completarse la tarea `combine`, la
   expone en `MissionRuntime.availableSubstances` — pero nada en `/game` la consume todavía. Dos huecos
   relacionados, mismo criterio que el punto 6 (agregación de material dejada fuera de 11c.1):
   - `ReservoirProperty` (`engine/src/properties/functional.types.ts`) no tiene un campo de sustancia
     (`substanceId`/`amount`); solo trackea `resourceType` (E/G/L/T) abstracto. No hay forma de decir "este
     reservorio contiene 40 unidades de Agua". Tampoco existen reservorios de gas o líquido en el catálogo
     físico (`atomic-component-catalog.ts`) — solo 2 baterías eléctricas.
   - No hay mecánica de extracción (centrífuga u otro equipamiento, GDD 5.4.1: "se obtienen extrayéndolos de
     equipamiento... o de depósitos limitados"): la paleta de elementos de la mesa (modo química) ofrece el
     `ELEMENT_CATALOG` completo sin restricción de inventario, igual que la mesa física ya hace con
     `ATOMIC_COMPONENT_CATALOG` (ninguna de las dos trackea qué piezas/elementos "tiene" realmente la nave).
   Lo necesita cualquier capítulo cuyo caso de validación exija verter la sustancia sintetizada en un
   reservorio o aplicarla directamente sobre una atmósfera/hazard (ej. capítulo 7, "si no hay neutralizante
   preinstalado, sintetizarlo... en la mesa de creación"). Al resolverlo, decidir si `ReservoirProperty` se
   extiende con sustancia+cantidad o si el estado vive en un runtime aparte (paralelo a
   `MissionAtmosphereRuntime`, no en el catálogo estático).
   **Parcialmente resuelto en Fase 11e**: `mission-action-panel.ts` ya lista `availableSubstances` en el
   estado idle del panel de acciones (primer consumidor real) y permite "Analizar Sustancia" sobre cada
   una — pero los dos huecos de arriba (reservorio con sustancia+cantidad, mecánica de extracción/
   inventario) siguen sin resolver, así que una sustancia sigue sin poder verterse en nada ni tener
   ubicación propia en el plano.

10. **Capa `fluido` del plano (11f) anima con una heurística sin dato de caudal real.** A diferencia de
    `ventilacion` (deriva de `pressureKpa` real) y `electrico`/`senal` (derivan de `unpoweredSectionIds`/
    `signalGraph` reales), no existe en el motor ningún concepto de transporte de fluido entre secciones —
    `ReservoirProperty`/`ReservoirContent` es una cantidad estática por instancia de componente, no un
    caudal. Hoy `fluido` (`game/src/mission/conduit-flow-heuristics.ts`) reutiliza el mismo booleano de
    cicatriz de energía que `electrico`, con una intensidad fija, sin granularidad propia. Resolver cuando
    exista una simulación real de fluidos/reservorios con transporte entre secciones — hueco relacionado
    con el punto 9 de este archivo (reservorios sin `substanceId`/`amount`).

11. **Capa `estructural` del HUD (11f) es un botón sin dato ni overlay detrás — decisión de alcance
    explícita.** El texto original de la Subfase 11f mencionaba una capa "estructural" que no corresponde a
    ningún `ConduitKind` del motor (`ventilacion`/`electrico`/`fluido`/`senal`) — la integridad estructural
    es un dato de sección (`structuralResistanceOverride`/cicatrices de RE en `blueprint.types.ts`, hoy solo
    consumidas por tooltip), no un tipo de conducto. Se agregó el botón al toggle de HUD
    (`game/src/ui/widgets/floorplan-layer-toggle-panel.ts`, `FloorplanLayerId = ConduitKind | "estructural"`)
    para no dejar un hueco entre el texto de la fase y la UI, pero no controla ningún render —
    `conduitLayers.estructural` en `floorplan-renderer.ts` se crea vacío a propósito. Implementar cuando el
    GDD defina un overlay real de integridad de casco/RE.

12. **Un conducto asume que `(a, b, kind)` es una clave única (11f).** `ConduitConnection` no tiene un id
    propio; `game/src/scenes/floorplan-scene.ts::conduitFlowKey` usa `${a}-${b}-${kind}` como clave del
    `Map` de efectos de flujo animado. Si algún mapa de Tiled llegara a definir dos conductos del mismo
    `kind` entre el mismo par de secciones (no visto hasta ahora en los mapas reales), uno pisaría al otro.
    Bajo riesgo dado el patrón actual de autoría, documentado por si aparece.

13. **Ningún mapa autorado tiene conductos `fluido` ni `senal` — reportado por el operador tras playtest de
    11f ("no veo los fluidos moverse").** Confirmado revisando los 4 JSON de `engine/src/floorplan/maps/`:
    la capa `conductos` de Tiled solo trae objetos `kind=ventilacion` (10 por nave) y `kind=electrico` (4 por
    nave) en las 4 naves canónicas — cero objetos `fluido`/`senal` en ningún mapa. No es un bug de motor ni
    de render: el código de la Fase 11f (`conduit-flow-heuristics.ts`, `floorplan-renderer.ts`) sí soporta
    ambos tipos, simplemente no hay contenido que dibujar todavía. Se resuelve autorando conductos de esos
    tipos en Tiled (capa `conductos`, propiedades `kind`/`a`/`b`) — tarea de contenido/diseño de nivel, fuera
    del alcance de motor/render de esta fase.
    **Parcial (Fase 11f.1)**: el operador ya autoró 1 conducto `senal` en `nave-exploracion`
    (`pasillo-central`↔`soporte-vital`, necesario para el Cap.1). Sigue pendiente: `senal` en los otros 3
    arquetipos y conductos `fluido` en general (estos últimos, además, hoy solo reaccionan al booleano de
    energía — ver punto 10).

14. **La capa `senal` está autorada solo en `nave-exploracion` — el resto queda sin cableado cross-section
    (Fase 11f.1).** Con la mecánica de cableado restringido (un cable de señal solo cruza a otra sección si
    hay un camino de conductos `senal`, `assertSignalWiringReachable`), un mapa sin conductos `senal` no
    permite NINGÚN cable de señal cross-section. Hoy solo `nave-exploracion` tiene el conducto que el Cap.1
    necesita; investigación/guerra/médica quedarían con su Cap.1 bloqueado en el paso de cableado. No rompe
    nada activo porque solo exploración se juega de punta a punta (los otros 3 son posiciones de referencia
    sin verificación visual, `chapter-01-primer-aviso.ts`). Autorar los `senal` de esos arquetipos cuando
    entren en testeo real. Intra-sección nunca requiere conducto.
