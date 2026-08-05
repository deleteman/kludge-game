
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
2. ✅ RESUELTO (Fase 12c.6). en las listas de elementos (como en el modal de instalación), si hago click en un elemento para el que tuve que scrollear para verlo, la lista se vuelve al inicio (no se deselecciona, pero se mueve autoamticamente a su estado original), complicando así la exploración de la lista.
   Resuelto: el selector de instalación se recrea entero al seleccionar un ítem; ahora preserva la fracción de
   scroll del `ScrollablePanel` de rexUI entre rebuilds (`initialScrollT`/`onListReady` en
   `install-picker-modal.ts`, captura de `panel.t` en `mission-interaction-controller.ts`). La paleta de química
   no tenía el bug (no se recrea al seleccionar un elemento).
3. ✅ RESUELTO (Fase 12f). Los tripulantes siguen moviendose incluso si a mitad de camino se pausa el juego.
   Resuelto: `hopMove` (`game/src/crew/hop-movement.ts`) devuelve un `Phaser.Tweens.Tween` real, pero
   `chainHops`/`stepAsideCrewToken`/el fallback `hopEnemyToken` (`game/src/scenes/floorplan-scene.ts`) lo
   descartaban sin guardar referencia — nada lo pausaba al entrar en modo `planning`. Ahora
   `FloorplanScene.activeHopTweens` (`Set<Phaser.Tweens.Tween>`) trackea cada salto en vuelo (auto-removido
   al completar) y `update()` lo pausa/reanuda cada frame según `coreLoop.mode`, mismo criterio que 11f.7
   aplicó al flujo de conductos. `hopEnemyToken` (`game/src/enemies/enemy-tokens.ts`) pasó de `void` a
   devolver el `Tween` para poder trackearlo también. Gap aceptado: el tween interno de `landingSquash`
   (aterrizaje, dentro de `hopMove`) queda fuera del tracking por ser corto y cosmético.

4. Las sustancias quimicas deberían poder sintetizarse solamente desde un aparato especifico. al hacerle click a la "estación quimica" (nombre que se puede mejorar) el menú contextual debería ser "Fabricar sustancias" y "Desmontar".

5. ✅ RESUELTO (Fase 12c.6). El texto al crear las sustancias quimicas se sale del modal de confirmacion.
   Resuelto: `confirmSynthesis` (`creative-workbench-scene.ts`) dibujaba el nombre de la sustancia (20px) sin
   `wordWrap` dentro de una caja de 520px — un nombre largo desbordaba. Ahora se envuelve dentro del ancho de la
   caja (con margen).

6. ✅ RESUELTO (Fase 12c.7). No hay feedback sonoro para los clicks cuando estamos en modo cableado.
   Resuelto: `handleWireModeClick` (`mission-interaction-controller.ts`) reproduce `AUDIO_KEYS.mapCellSelect` al
   clickear un nodo válido (seleccionar origen, deseleccionar o confirmar destino).
7. ✅ RESUELTO (Fase 12f). El modo pantalla completa queda en negro sin errores en la consola.
   Resuelto: `game/src/main.ts` no definía `scale.parent`/`scale.fullscreenTarget`, así que Phaser insertaba
   el canvas suelto en `<body>` — el elemento que el navegador expande en fullscreen no coincidía de forma
   confiable con lo que `FIT` recalculaba. Se agregó un contenedor `#game-root` con tamaño explícito
   (`game/index.html`) como `parent`/`fullscreenTarget` de la config de `scale`, y `BootScene` (única escena
   que auto-arranca) suscribe `ENTER_FULLSCREEN`/`LEAVE_FULLSCREEN` para forzar `this.scale.refresh()` en
   ambas transiciones, por si el recálculo automático de `FIT` no dispara solo.

8. Se pueden encolar 2 o más tripulantes para instalar la misma pieza (de la cual solo hay una copia) y cuando se le da "play", luego de que el primero termina la instalación, el juego da un error al querer instalar la pieza que ya no está en stock.

9. cambiar de idioma no afecta todos los strings, hay botones de la UI que no cambian el idioma.

10. En la pantalla de selección de arquetipo y la selección de tripulantes, el click no funciona bien. Parece que hay un desfase entre donde está el mouse y donde se hace el click, incluso parece que a veces el jugador hace click en un tripulante y termina clickeando en otro.

11. los clicks en botones de selección de capa hacen click en el mapa tambien. Eso no debería pasar en ningun elemento de la UI que está renderizado arriba del mapa.

12. hay algun uso real para los planos de la nave? que gana el jugador con ver es

13. el modal de instalación tiene ahora la sección derecha con fondo negro para solucionar el contraste horrible entre el texto y el fondo gris del modal. Esto es un parche temporal, se debe rediseñar este modal para que se lea mejor l ainformacion.


## Fine-tunning

* ✅ RESUELTO (Fase 12c.1). El botón de MESA y el botón de creaciones quimicas podría tener un icono junto al nombre, tengo iconos en game/assets/ui/ui-components/BUTTON-ICONS que podriamos usar
  Resuelto: botón MESA con `construction-table.png` y toggle Física/Química con `mixer.png` (ruta real
  `game/assets/sprites/ui/ui-components/BUTTON-ICONS/`), vía el nuevo `iconTextureKey` de `createKenneyButton`.
* ⚠️ PARCIALMENTE RESUELTO (Fase 12g). El menú de la pantalla inicial se ve y se siente profesional? Qué le falta?
  Resuelto en parte: los 6 botones del menú (`title-scene.ts`) no tenían ninguna animación de entrada, a
  diferencia del logo (flotación + partículas + blur ya resueltos) — se agregó `popIn` escalonado + `fadeIn`
  de cámara al entrar. Sigue abierta la pregunta original de fondo (qué más le falta al menú para sentirse
  profesional) — es una pregunta abierta de diseño, no una tarea puntual cerrable.
* Los primeros 10 minutos de gameplay, son adictivos? Le dan algún reward al jugador?
* ✅ RESUELTO (Fase 12c.1). Falta efectos hover en los botones de la UI. Ahora mismo hay sonidos al hacerle hover, lo cual es genial, pero falta un efecto visual que corresponda con la acción.
  Resuelto: `attachHoverJuice` (`game/src/ui/ui-effects.ts`) engancha un tween sutil de escala en
  `pointerover`/`pointerout` + pulso al `pointerdown`, aplicado en el único punto `createKenneyButton`, así que
  todos los botones de menú y de misión lo heredan.
* ✅ RESUELTO (Fase 12g). La pantalla de selección de tripulantes al inicio de la campaña debe mejorarse. Debemos mostrar fotos de los tripulantes en una tarjeta por cada uno, donde también damos su nombre, personalidad, role, y una descripción. Esto es flavor, pero le da personalidad al juego.
  Resuelto: `crew-select-scene.ts` usa una grilla de tarjetas (`crew-select-card.ts`) con retrato (reutiliza
  `crew-portrait-registry.ts`), nombre, especialidad/tier, rasgo y descripción (`crew.<slug>.description`,
  ya existía en i18n sin consumidor).
* ✅ RESUELTO (Fase 12g). La pantalla de selección de arquetipo de nave debe mostrar datos de cada nave, por cada una deberiamos tener: nombre (no del arquetipo, sino de la nave), una pequeña imagen exterior para darle color a la elección, su arquetipo y una descripción del arquetipo con los + y los - (ej: + armamento, - sensores, etc)
  Resuelto: `archetype-select-scene.ts` usa una grilla 2×2 de tarjetas (`ship-archetype-card.ts`) con nombre
  propio, arquetipo, descripción y pros/cons (`ship-archetype-metadata.ts`, copy placeholder redactado por
  Claude, a reemplazar por el operador). Imagen exterior cae a placeholder de color: faltan los 4 sprites
  reales, carpeta `game/assets/sprites/ships/` creada vacía, ruta esperada
  `game/assets/sprites/ships/<archetype>.png`.
* Los componentes cableables tienen un punto arriba cuando se ve la capa de señales, que los tapa por completo. Ese punto no parece tener ningún sentido, por lo que habría que removerlo.
* Las capas deberían comenzar todas en off y al estar en off no deberían verse, sin transparentes como se ven ahora.
* El cuadro contextual de acción que aparece cuando se clickea en una celda del mapa debe poder cerrarse con ESC y al hacerle click en el fondo del mapa (fuera de la nave).

## Deuda técnica detectada (fuera de alcance de la fase en curso)

Hallazgos anotados al pasar, sin fase asignada. Cada entrada dice qué está mal,
dónde, y qué costaría arreglarlo.

3. ✅ RESUELTO (Fase 13a). **Los emisores no se simulan: un sensor cableado está siempre disparado** (Fase 11a).
   `allEmittersActive` (`engine/src/mission/mission-signal-runtime.ts`) activa TODOS los nodos
   emisores en cada tick, porque nada evalúa `EmitterProperty` (`range`/`triggerType`/`frequency`,
   `engine/src/properties/functional.types.ts`) contra el mundo: ningún sensor de movimiento
   comprueba si hay un tripulante cerca. El `MissionSignalRuntime` ya recibe la fuente de
   entradas por inyección (`EmitterInputSource`), así que el día que exista la simulación de
   sensores se enchufa ahí sin tocar el runtime. Lo necesita cualquier capítulo cuya lógica
   dependa de que un sensor se dispare de verdad y no de que esté cableado.
   Resuelto: no existía ningún sensor de movimiento dedicado en el catálogo (solo `fotorreceptor`,
   `triggerType: "optical"`) ni línea de visión/raycast en todo el repo — `engine/src/geometry/line-of-sight.ts`
   (`hasLineOfSight`, Bresenham puro sobre un `CellBlockedQuery` inyectado, sin Phaser/Tiled) +
   `engine/src/mission/motion-emitter-input-source.ts` (`motionAwareEmitterInputs`, mismo patrón que
   `pressureAwareEmitterInputs`): un nodo óptico se dispara si algún tripulante/enemigo vivo está a
   `range` celdas (Manhattan) con LOS real. `/game` (`mission-runtime.ts::setMotionBlockedQuery`,
   invocado desde `floorplan-scene.ts` tras `extractWalkableGrid`) inyecta el bloqueo de paredes real
   del tilemap sin que `/engine` conozca Phaser — fallback "nada bloqueado" si no hay tile art.
   `frequency` sigue sin consumidor (ninguna deuda lo pedía). Detalle completo: `changelog.log` (2026-08-04).

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

5. ✅ RESUELTO (Fase 12f). **Un proyectil suelto pierde su sprite de catálogo al promoverse** (Fase 11a.3).
   `LooseFerromagneticPromoter` (`engine/src/mission/loose-ferromagnetic-promoter.ts`) registra el
   `ProjectileBody` con `ref: placedComponentInstanceId`, no con el `componentDefinitionId` del
   catálogo — así que `projectile-renderer.ts` (`game/src/render/`) no tiene forma de volver a
   `componentTextureKey`/`hasComponentSprite` para dibujar el sprite real de la pieza (ej.
   `pieza-hierro.png`, que SÍ existe en `game/assets/sprites/components/`) y cae siempre en un
   círculo placeholder por código, incluso cuando el sprite de esa pieza está disponible.
   Resuelto: `LooseFerromagneticPromoter` gana un `Map<ref, ComponentId>` privado (`definitionByRef`),
   poblado en `promote()` junto a la creación del `ProjectileBody`, expuesto vía
   `definitionIdForRef(ref)` — sin tocar `ProjectileBody`/`kinetics/`, que se mantienen sin concepto de
   catálogo. `MissionRuntime.loosePromoter` ya era público, así que no hizo falta wiring nuevo:
   `renderProjectileTokens` (`projectile-renderer.ts`) recibe ahora un resolver
   `(ref) => componentDefinitionId | undefined` y dibuja el sprite real vía `componentTextureKey`/
   `hasComponentSprite` (mismo patrón que `mission-overlay-renderer.ts`) antes de caer al placeholder.
   **Fix post-QA del operador (mismo día)**: al probarlo en partida real, la pieza quedaba VISIBLE DOBLE
   — un sprite de tamaño completo "pegado" en la celda (fantasma, sin poder seleccionarlo ni desmontarlo)
   además del token pequeño correcto del proyectil. Causa: la promoción a proyectil pasa en el MISMO tick
   que completa la tarea de instalación, pero DESPUÉS de que `redrawOverlay()` ya la dibujó como
   componente fijo (`task-completed` dispara el redraw antes de que `LooseFerromagneticPromoter.tick()`
   la saque de `placedComponents` en ese mismo tick, `mission-runtime.ts:374-389`) — nada volvía a
   redibujar el overlay tras esa promoción silenciosa. Resuelto: `FloorplanScene.knownProjectileRefs`
   compara los `ref` de `mission.projectiles.all` cada frame de ejecución contra el set del frame
   anterior; ante un `ref` nuevo (promoción recién ocurrida) dispara `redrawOverlay()` para borrar el
   fantasma. No poder seleccionar/desmontar la pieza promovida SÍ es comportamiento esperado (principio 5
   de CLAUDE.md: una vez proyectil, no vuelve a `placedComponents`).

6. ✅ RESUELTO (Fase 13c, como prerrequisito). **Una creación de la mesa no hereda las propiedades de material de sus partes** (Fase 11c.1).
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
   Resuelto: `aggregateCreationMaterial` (`engine/src/workbench/creation-material-aggregation.ts`), consumido
   por `nameAndRegisterCreation` junto a la agregación funcional que ya existía. Regla decidida con el operador
   (2026-08-05), una por propiedad porque cada una tiene semántica física distinta — no hay una regla genérica:
   - `RE` = el **PEOR** de las partes. Un ensamblaje se rompe por su eslabón más débil; es además el mismo
     criterio worst-case que `aggregateHullIntegrity`/`aggregateSectionHullIntegrity` ya usaban para agregar a
     nivel sección y nave, así que no se inventa un criterio nuevo. Pegar una lente frágil a una plancha de
     acero no da una lente blindada.
   - `MAG` = `true` si **cualquier** parte lo es (basta para que una bobina la acelere, GDD 5.5 / caso 17).
   - `CE`/`CT` = el **mayor**: conducir es una propiedad de camino, si alguna parte conduce el conjunto conduce.
   - `ES` = el estado mayoritario (empate → el de la primera parte, determinista).
   Devuelve `undefined` si ninguna parte declara material, para no poblar `data.material` con un objeto vacío
   (mismo criterio que ya seguía `aggregatedFunctional`). El orden canónico de niveles se extrajo a
   `engine/src/properties/material-order.ts` (`RE_ORDER` dejó de ser un array local de `structural-failure.ts`).
   11 tests unitarios propios + 2 de integración en `creation-naming.test.ts`. Era prerrequisito bloqueante de
   la Fase 13c: sin `data.material`, una creación no podía corroerse y por lo tanto no podía desgastarse.

7. ✅ RESUELTO (Fase 11c.2). **La mesa de creación dibuja rectángulos, no los sprites de las piezas** (Fase 11c.1, reportado en playtest).
   `workbench-renderer.ts` (`game/src/render/`) pinta cada celda con `graphics.fillRect` + etiqueta de
   texto; nunca usa los sprites de componente. La escena `creative-workbench-scene.ts` solo precarga UI
   assets (`preloadUiAssets`), no los sprites de piezas. El plano de misión SÍ los muestra vía
   `component-sprite-registry.ts` (`preloadComponentSprites`) + `renderFloorplan`. Arreglo estimado:
   precargar los sprites de componente en la escena creativa y reescribir `workbench-renderer` para
   dibujar `add.image` con la texture key del componente (con fallback al rectángulo actual cuando el
   sprite falte). Encaja naturalmente en 11c.2 (cuando la mesa pase a ser superficie real en misión) o
   en la Fase 12 (pulido visual).

8. ✅ RESUELTO (Fase 12c.5). **Una creación compuesta instalada se dibuja como un rectángulo placeholder** (Fase 11c.1, reportado en playtest).
   El `componentDefinitionId` de una creación es `creation-XXXX`, que no tiene sprite propio en
   `game/assets/sprites/components/`, así que `renderFloorplan` cae al placeholder. Para dibujarla como
   sus piezas reales habría que descomponer el compuesto (su receta) y pintar el sprite de cada parte en
   su offset dentro del footprint — trabajo de render no trivial, y a futuro una creación podría merecer
   identidad visual propia. Distinto del #7 (ese es la mesa; este es el plano de misión). Diferido a la
   Fase 12 o a cuando se defina la representación visual de compuestos custom.
   Resuelto: `buildRecipeFromPieces` descartaba las posiciones, así que se agregó `CompositeComponentData.layout`
   (`CreationPart[]` = ref + offset relativo al origen del footprint + footprint + rotación por pieza), poblado en
   `nameAndRegisterCreation` (`calculateFootprintOrigin` nuevo) y round-trippeado por el serializer de creación (3
   tests nuevos). `renderMissionOverlay` recibe un `resolveDefinition` y `drawCreationLayout` pinta el sprite real de
   cada parte en su offset (con fallback a placeholder por parte que falte). Es el plano de MISIÓN; el #7 (la mesa) ya
   estaba resuelto por separado.

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
   **Tocado por la Subfase 13d, sin cerrarse**: `Blueprint.reservoirContents` (que SÍ tiene
   `substanceId`/`amount`) pasó a tener consecuencia — desmontar un reservorio lleno derrama
   (`dismantle-spill`) y la tarea `purge-reservoir` lo ventea de forma controlada. Lo que sigue igual: no hay
   forma de LLENAR un reservorio ni de verter una sustancia sintetizada en él, ni mecánica de extracción /
   inventario de elementos. Ambos siguen siendo alcance de 13e.

10. **Capa `fluido` del plano (11f) anima con una heurística sin dato de caudal real.** A diferencia de
    `ventilacion` (deriva de `pressureKpa` real) y `electrico`/`senal` (derivan de `unpoweredSectionIds`/
    `signalGraph` reales), no existe en el motor ningún concepto de transporte de fluido entre secciones —
    `ReservoirProperty`/`ReservoirContent` es una cantidad estática por instancia de componente, no un
    caudal. Hoy `fluido` (`game/src/mission/conduit-flow-heuristics.ts`) reutiliza el mismo booleano de
    cicatriz de energía que `electrico`, con una intensidad fija, sin granularidad propia. Resolver cuando
    exista una simulación real de fluidos/reservorios con transporte entre secciones — hueco relacionado
    con el punto 9 de este archivo (reservorios sin `substanceId`/`amount`).

11. ✅ RESUELTO (Fase 12a). **Capa `estructural` del HUD (11f) es un botón sin dato ni overlay detrás — decisión de alcance
    explícita.** El texto original de la Subfase 11f mencionaba una capa "estructural" que no corresponde a
    ningún `ConduitKind` del motor (`ventilacion`/`electrico`/`fluido`/`senal`) — la integridad estructural
    es un dato de sección (`structuralResistanceOverride`/cicatrices de RE en `blueprint.types.ts`, hoy solo
    consumidas por tooltip), no un tipo de conducto. Se agregó el botón al toggle de HUD
    (`game/src/ui/widgets/floorplan-layer-toggle-panel.ts`, `FloorplanLayerId = ConduitKind | "estructural"`)
    para no dejar un hueco entre el texto de la fase y la UI, pero no controla ningún render —
    `conduitLayers.estructural` en `floorplan-renderer.ts` se crea vacío a propósito. Implementar cuando el
    GDD defina un overlay real de integridad de casco/RE.
    Resuelto: `aggregateSectionHullIntegrity` (`engine/src/ship-status/ship-status-aggregation.ts`) agrega el
    peor RE de los componentes anclados en una sección (mismo criterio worst-case que `aggregateHullIntegrity`
    a nivel nave), expuesto vía `ShipStatusQuery.sectionHullIntegrity`/`MissionRuntime.sectionHullIntegrity`.
    `drawStructuralLayer` (`game/src/render/floorplan-renderer.ts`) tiñe cada sección degradada
    (ámbar/rojo, `STRUCTURAL_LAYER_COLOR`), redibujado cada frame por `floorplan-scene.ts` — mismo criterio
    que `redrawUnpoweredSectionScar`.

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

15. ⚠️ PARCIALMENTE RESUELTO (Fase 12e: semántica de color; configurabilidad por instancia SIGUE diferida).
    **MVP de "componentes configurables" pedido explícitamente por el operador — fuera de alcance de la
    Subfase 11h, se planifica en otra sesión.** Playtest de la fuga de Cap.1: el Indicador LED se enciende
    en verde (`LED_ACTIVE_TINT`) al detectar la fuga, mismo verde que el resto de la paleta reserva para
    "todo bien" — semánticamente al revés para una alarma. El fix acotado de esta subfase fue cambiar el
    color fijo a ámbar (`0xe0a33f`, reutilizado de `jammed`/`planning`), sin tocar arquitectura. El operador
    pidió considerar, para una sesión futura, un MVP real de configurabilidad por instancia: elegir color y
    condición de disparo (`>`, `<`, `=`) para componentes como el LED. Esto requeriría: datos de
    configuración por instancia (bump de `schemaVersion` del blueprint), una UI/interacción nueva para
    configurar la instancia colocada, y que el LED lea el valor numérico real (no solo booleano) por el
    mismo mecanismo que ya usa la Pantalla LCD (`resolveLcdDisplayValue`, resolución por tag funcional). No
    iniciar sin un ciclo de preguntas propio con el operador (alcance: ¿solo LED o cualquier receptor de
    señal con salida numérica?, ¿editable en cualquier momento o solo antes de instalar?, etc.).
    **Confirmado como fuera de alcance en la planificación de la Fase 12a (2026-07-28)**: el ítem "Potenciar
    Indicador LED con intensidad graduada" del texto de 12a (`nuevo-orden.md`) quedó explícitamente diferido
    — no existe en el motor ninguna fuente de nivel graduado genérica en el grafo de señales (solo
    `VelocityLevel` del dominio kinetics/MAG, Fase 11a), así que graduar el LED requiere antes decidir de
    dónde sale ese nivel para el caso general, no solo para fuentes cinéticas. 12a sí entregó el sistema de
    luces aditivas (`game/src/particles/effects/dynamic-light.ts`) que un LED graduado futuro reutilizaría.
    **Resuelto en Fase 12e (solo la semántica de color)**: el LED activo ahora deriva de `CRISIS_WARNING_COLOR`
    del contrato de color único (`game/src/render/palette.ts`, Eje A), y un test de regresión
    (`palette.contract.test.ts`) impide que vuelva a verde. Lo que SIGUE diferido a su propio ciclo de preguntas:
    la configurabilidad por instancia (elegir color y condición de disparo `>`/`<`/`=`, con bump de
    `schemaVersion` y UI de configuración) y que el LED lea el valor numérico real por umbral — 12e mantuvo el
    LED binario ON(ámbar)/OFF(gris) a propósito, solo re-etiquetando su color dentro del contrato.

16. ⚠️ PARCIALMENTE RESUELTO (Fase 13a). **`CombustionEvent`/reacciones químicas no tienen ningún llamador de
    producción en `MissionRuntime` (detectado en Fase 12a).** Igual que `OverloadRule` antes de esta fase,
    `ReactionResolver`/las reglas de combustión (`engine/src/chemistry/reaction/rules/combustion.ts`) solo se
    ejercitan en tests — no hay ningún runtime de misión que evalúe reacciones químicas en vivo, así que
    `combustionEffect` (`game/src/particles/effects/combustion-effect.ts`) sigue siendo un efecto demostrado
    únicamente en `particle-gallery-scene.ts`, nunca disparado en partida real. Consecuencia directa para 12a:
    el overlay de alerta de pantalla completa (`redrawScreenAlertOverlay`, `floorplan-scene.ts`) NO reacciona
    a "combustión violenta" pese a que el texto de la fase lo pedía — solo a `overload` (fire/explosion) y al
    agregado crítico de `ShipStatusSnapshot` (que sí cubre la fuga crítica, vía el dominio atmósfera). Lo
    necesita cualquier capítulo cuyo caso de validación dependa de que un incendio real ocurra en misión, no
    solo en la mesa de creación/reacciones aisladas. Al resolverlo, revisar también si el `PointLight` de
    `combustion-effect.ts:116-130` necesita el `LightHook` de 12a (`game/src/particles/particle-effect.types.ts`)
    — hoy ese burst no registra su luz contra `hudCamera.ignore()`, un riesgo menor mientras sea un burst
    corto (300-2000ms) pero a revisar si algún día se vuelve más largo.
    Resuelto (llamador de producción): `MissionReactionRuntime` (`engine/src/mission/mission-reaction-runtime.ts`)
    evalúa `CrisisDefinition.scriptedReactions` (`ScriptedReactionSubject`, dato de guion — no existe todavía
    ninguna fuente real de sustancias vivas en misión, ver Fase 13e) cada tick, con `oxygen` real de sección
    (`sectionCombustionAtmosphere`) e `ignitionPresent` real para `"overload-bridge"` (puente a `failureEvents`,
    resuelve `OverloadEvent.ref` → sección). `game/src/mission/mission-runtime.ts`/`floorplan-scene.ts` cablean
    `reactionEvents` a `combustionEffect`/`combustionSound` (ya existían, sin llamador real hasta ahora) y
    extienden el overlay de alerta a combustión no-débil — el hueco de 12a queda cerrado. `CombustionEvent`
    ganó `sectionId?: SectionId` opcional para que `/game` sepa dónde pintar.
    Sigue SIN resolver, evaluado y descartado a propósito en esta fase: el `LightHook`/`hudCamera.ignore()` de
    `combustion-effect.ts` — arreglarlo exigiría extender la firma de `EventDrivenEffect.trigger` para los ~10
    efectos ya registrados en `effect-registry.ts`, desproporcionado para 13a; con el burst disparándose ahora
    en partida real (antes solo en la galería), este es el momento de revisar si el riesgo dejó de ser menor.
    Detalle completo: `changelog.log` (2026-08-04).
    **Ampliado en Fase 12b**: el mismo hueco existe para `HazardEvent` (`toxic-threshold`/`corrosive-exposure`,
    umbral de exposición atmosférica a tripulante) — tampoco tiene llamador real en `floorplan-scene.ts`, solo
    se demuestra en `particle-gallery-scene.ts`. El sonido de corrosión (`game/src/audio/effects/
    corrosion-sound.ts`) y el de combustión quedaron listos y registrados en `phenomenon-sound-registry.ts`,
    pero ninguno de los dos suena en partida real hasta que exista el runtime que dispare estos eventos.

17. **No hay asset dedicado de siseo de fuga de gas, zumbido eléctrico continuo, sirena de alarma ni paso sobre
    piso metálico en el pack de audio (Fase 12b).** El pack colocado por el operador en `game/assets/audio/`
    (`UI/`, `gameplay/`, `voices/`) es de ciencia ficción/acción genérico, no industrial de mantenimiento de
    nave — no trae ninguno de esos cuatro sonidos. Aproximaciones usadas en su lugar, documentadas en
    `game/src/audio/audio-asset-registry.ts`: `engineCircular` (loop de motor grave) para la fuga de gas,
    `computerNoise` para la alarma, `impactMetal` para instalación/pasos de tripulante. Reemplazar cuando se
    consiga un asset más específico — el punto de cambio es un solo archivo (`AUDIO_KEYS`), no requiere tocar
    ningún llamador.
    **Ampliado en 13d**: el chispazo de desmontar una pieza viva (`dismantle-spark`) tampoco tiene asset
    propio — reutiliza el banco `overloadCut` (chisporroteo/arco), que es la misma familia eléctrica. El
    derrame y la fuga de 13d quedan sin sonido puntual a propósito, por la misma falta de assets.

18. al seleccionar un tripulante en la pantalla de selección de tripulantes debería cambiarle su imagen a color, ahora quedan en escala de grises.

19. los efectos visuales de una zona sin energía se renderizan parcialmente arriba del cuadro de asginacion de energía en modo pausa.
20. ⚠️ PARCHE INTERINO (13c fix ronda 1) — **la integridad de casco se deriva del RE de los componentes
    instalados, no de la nave.** Reportado por el operador en el playtest de 13c: instalar un `tubo-flexible`
    (RE-B) desplomaba el indicador de casco de toda la nave, y desmontarlo lo "reparaba". La causa es de la
    Subfase 11g: `aggregateHullIntegrity` (`engine/src/ship-status/ship-status-aggregation.ts`) tomaba el peor
    RE de CUALQUIER pieza que declarara RE. Una manguera no es casco. 13c solo hizo el problema visible, al
    poner al jugador a mirar el RE.
    Parcheado de forma interina: solo cuentan las piezas con propiedad funcional `EST` (Estructura/soporte,
    GDD 5.1) y se ponderan por su `damageResistance` de catálogo en vez de tomar el peor caso — ponderar
    además de filtrar era necesario porque la `tornilleria-fijacion` (EST, RE-B) reproducía el mismo síntoma.
    **Se resuelve del todo en la Subfase 13f** (`nuevo-orden.md`, diseño ya cerrado 2026-08-05): las secciones
    pasan a tener vida propia, dañada por impacto cinético contra pared, explosión/combustión, corrosión y
    descompresión, con brecha + cicatriz permanente al llegar a 0. Esa subfase borra `instanceHullContribution`
    y `weightedHullFraction` enteras.

21. **Un proyectil que no golpea nada sale del plano y sigue avanzando** (relevado al diseñar 13f).
    `ProjectileSimulation.advance` (`engine/src/kinetics/projectile-simulation.ts`) no valida contra
    `floorplan.gridSize`, y `MissionProjectileWorld.occupantAt` solo resuelve componentes, tripulación y
    enemigos — no hay concepto de pared en el motor. Lo único que lo frena es el drag de ASA 2. Tampoco
    rebota: `impact()` lo detiene en seco y pierde toda la inercia. Se aborda en la Subfase 13f, que necesita
    la colisión contra pared para dañar la sección (mismo patrón de inyección que `setMotionBlockedQuery` de
    13a, sin que `/engine` conozca Tiled).
