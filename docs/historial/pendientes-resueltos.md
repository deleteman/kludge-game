# Pendientes y observaciones ya resueltos

Ítems cerrados, movidos fuera de `PENDIENTES_OBSERVACIONES.md` para que ese archivo sea solo lo que
sigue abierto. Se conserva su numeración y su texto original, incluida la nota de en qué fase se
resolvió. Al cerrar un ítem se marca ✅ RESUELTO **y se mueve acá**, en el mismo cambio.

---

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

4. ✅ RESUELTO (Fase 13e). Las sustancias quimicas deberían poder sintetizarse solamente desde un aparato especifico. al hacerle click a la "estación quimica" (nombre que se puede mejorar) el menú contextual debería ser "Fabricar sustancias" y "Desmontar".
   Resuelto: propiedad funcional nueva `FAB` (`FabricatorProperty`, GDD §5.1 actualizado) y dos compuestos
   nuevos en `engine/src/components/catalog/composite/taller.ts` — `banco-de-trabajo` (`FAB(fisica)`) y
   `estacion-quimica` (`FAB(quimica)` + `RES(L)` de salida) — sembrados en los 4 arquetipos
   (`floorplan/initial-ship-state.ts`). El botón MESA global del header se eliminó: la mesa se abre desde el
   panel de acciones contextual del aparato ("Fabricar" / "Fabricar sustancias") y entra ya fijada a su
   dominio, así que el toggle libre Física/Química de `creative-workbench-scene.ts` también desapareció. El
   motor identifica el aparato por PROPIEDAD (`components/fabricator-query.ts`), nunca por `ComponentId`
   (Principio 1). La animación de recolección de elementos (12c.5) pasó a apuntar al banco real del plano en
   vez del botón que ya no existe.

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

8. ✅ RESUELTO (Subfase 14a-4 + su ronda 4c). Se pueden encolar 2 o más tripulantes para instalar la misma pieza (de la cual solo hay una copia) y cuando se le da "play", luego de que el primero termina la instalación, el juego da un error al querer instalar la pieza que ya no está en stock.
   Verificado en el triaje: era peor que "da un error" — `queueInstall` (`game/src/mission/mission-runtime.ts`)
   no reservaba stock al encolar, `ship-task-effect.ts` lanzaba `InsufficientStockError` al completar, y
   `TaskScheduler.completeTask` invocaba el efecto **sin try/catch**, así que la excepción rompía el tick de la
   misión. El filtro `"no-stock"` del selector miraba el stock actual sin descontar lo ya encolado.
   Resuelto en las dos capas previstas, en dos momentos distintos:
   - **Segunda capa (14a-4)**: `TaskScheduler.completeTask` envuelve el efecto y degrada la tarea a `failed`
     con motivo propio y notificación, en vez de propagar la excepción por el tick de la misión.
   - **Primera capa (14a-4, ronda 4c de playtest)**: la cola viva reserva celdas y stock
     (`engine/src/tasks/queued-reservations.ts`, derivado de las tareas y NUNCA persistido — descontar al
     encolar haría perder material al guardar, porque `toUpdatedSave` no guarda tareas). El selector consulta
     `MissionRuntime.availableStockOfWear` en vez del stock crudo: con todo comprometido la fila queda
     bloqueada con motivo PROPIO (`queue-reserved`, "comprometida por la cola"), mostrando igual el stock real
     y el desglose reservadas/disponibles — "sin stock" habría mandado al jugador a buscar algo que ya tiene.
     El escenario exacto del reporte (dos tripulantes, una sola unidad) queda cubierto por test en
     `game/src/mission/mission-runtime.test.ts`.
   Quitada del Bloque 1 de la Subfase 14d, que era donde estaba asignada.

16. ✅ RESUELTO (Fase 12d.5, 2026-08-24). los sprites de los componentes no se ven afectados por la luz/sombra de las secciones, parecen ser renderizados arriba de la capa de luces.
   → **Subfase 12d** (sombras dinámicas, ciclo de preguntas ya pendiente). **Corrección del diagnóstico
   original, verificada en el triaje:** es al revés. Las sombras están bien
   (`RENDER_DEPTH.dynamicShadows` = 1.7 < `objects` = 2), pero **todos los `PointLight` se registran a
   `RENDER_DEPTH.effect` = 7** (`registerLight`, `floorplan-scene.ts`) — por encima de paredes (5) y sprites (2).
   La luz aditiva se pinta sobre todo, y eso es lo que se lee como "el sprite no recibe luz". No se parchea el
   depth suelto porque la decisión de 12d (seguir con `PointLight` vs. migrar a `scene.lights`) cambia la respuesta.
   **Resuelto sin migrar a `scene.lights`** (decisión del operador: Light2D reemplazaría todo lo entregado en
   12a/12d y convive mal con el post-pipeline CRT de 12c.8). Dos mitades: las luces de ambientación bajan al
   depth nuevo `RENDER_DEPTH.dynamicLight` (1.8) y dejan de lavar sprites y paredes; y el brillo del sprite pasa
   a resolverse por TINTE, con el nivel de luz por celda que calcula `game/src/render/shadows/light-grid.ts`
   (misma geometría de oclusión que la RT de sombras). Tripulación y enemigos llevan piso de brillo
   (`MIN_ACTOR_LIGHT_LEVEL`) para no volverse inclickeables en una sala oscura.

## Fine-tunning

* ✅ RESUELTO (Fase 12c.1). El botón de MESA y el botón de creaciones quimicas podría tener un icono junto al nombre, tengo iconos en game/assets/ui/ui-components/BUTTON-ICONS que podriamos usar
  Resuelto: botón MESA con `construction-table.png` y toggle Física/Química con `mixer.png` (ruta real
  `game/assets/sprites/ui/ui-components/BUTTON-ICONS/`), vía el nuevo `iconTextureKey` de `createKenneyButton`.
* ⚠️ PARCIALMENTE RESUELTO (Fase 12g). El menú de la pantalla inicial se ve y se siente profesional? Qué le falta?
  Resuelto en parte: los 6 botones del menú (`title-scene.ts`) no tenían ninguna animación de entrada, a
  diferencia del logo (flotación + partículas + blur ya resueltos) — se agregó `popIn` escalonado + `fadeIn`
  de cámara al entrar. Sigue abierta la pregunta original de fondo (qué más le falta al menú para sentirse
  profesional) — es una pregunta abierta de diseño, no una tarea puntual cerrable.
  → La pregunta de fondo se retoma en la **Subfase 14d, Bloque 2**: es lo que define la primera impresión de la demo.
* Los primeros 10 minutos de gameplay, son adictivos? Le dan algún reward al jugador?
  → **Subfase 14d, Bloque 2** (pregunta de diseño, no tarea puntual — mismo motivo que la anterior).
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
  → **Subfase 14d, Bloque 1.** `mission-overlay-renderer.ts` dibuja `fillCircle(..., 7)` = 14px sobre una celda
  de 32px (44% de la celda). Removerlo, o como mínimo reducirlo y anclarlo a una esquina.
* Las capas deberían comenzar todas en off y al estar en off no deberían verse, sin transparentes como se ven ahora.
  → **Subfase 14d, Bloque 2**, dentro del ciclo de preguntas de capas (con Obs 12 y Obs 15). **Ojo:** hoy
  arrancan todas en ON (`activeFloorplanLayers` se inicializa con `FLOORPLAN_LAYER_IDS`) y "inactiva = atenuado,
  NUNCA oculto" está documentado como contrato explícito en `floorplan-layer-toggle-panel.ts` — esto es revertir
  una decisión de 11f, no arreglar un bug, y por eso se decide en el ciclo de preguntas en vez de arrastrarse
  como pendiente suelto.
* El cuadro contextual de acción que aparece cuando se clickea en una celda del mapa debe poder cerrarse con ESC y al hacerle click en el fondo del mapa (fuera de la nave).
  → **Subfase 14d, Bloque 1.** ESC hoy solo cancela el modo transferencia o pausa el juego
  (`floorplan-scene.ts`), y el click en celda vacía cambia el contenido del panel a `{kind:"empty"}` en vez de
  cerrarlo (`mission-interaction-controller.ts`).

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

9. ✅ RESUELTO (Fase 13e). **Una sustancia sintetizada (11c.3) queda disponible pero sin destino de uso.** `MissionRuntime.queueSynthesis`
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
   (`dismantle-spill`) y la tarea `purge-reservoir` lo ventea de forma controlada.
   **Resuelto en Fase 13e.** Decisión de fondo: NO se extendió `ReservoirProperty` ni se creó un runtime
   paralelo (la disyuntiva que planteaba el texto de arriba) — `Blueprint.reservoirContents` YA modelaba
   sustancia+cantidad por instancia y ya se serializaba; lo único que faltaba eran ESCRITORES. `RES.capacity`
   pasa a ser el tope. Sin bump de `Blueprint.schemaVersion`.
   - Escritores nuevos en `engine/src/reservoir/reservoir-ledger.ts` (`pourInto`/`drawFrom`/`emptyReservoir`,
     puros). Regla: un reservorio contiene UNA sustancia a la vez; verter otra se rechaza
     (`ReservoirOccupiedError`) y hay que purgarlo antes — le da un segundo uso a `purge-reservoir` (13d).
   - La síntesis deposita en el reservorio de salida de la estación química en vez de dejar un id flotante, así
     que la sustancia gana ubicación en el plano y persiste sola.
   - Mecánica de extracción (GDD 5.4.1): tarea `extract-elements` + `ElementStock`/`element-ledger.ts`
     (inventario de elementos, sin buckets de desgaste). La paleta química de la mesa deja de ofrecer el
     `ELEMENT_CATALOG` completo: muestra unidades disponibles y se deshabilita a cero. **Precondición: la
     sustancia debe estar analizada** (`analyze-substance`, 11e, que pasa de flavor a puerta real); la
     composición sale de la receta de catálogo o de la PROCEDENCIA registrada al sintetizar
     (`substanceProvenance`, guardado v5), oculta hasta el análisis.
   - Tareas `transfer-substance` (trasvase, intra-sección libre / cross-section vía conducto `fluido`) y
     `apply-substance` (vierte sobre la atmósfera de la sección) — esta última es el primer escritor real de un
     `ChemicalSubstanceId` en `atmosphere.gases`, cerrando el hueco "todo lector, ningún escritor" anotado en el
     punto 16 de este archivo.
   - **Fuera de alcance a propósito**: mezclar dos sustancias DENTRO de un reservorio (sería abrir la
     resolución de identidad de mezclas dentro de un tanque — otro sistema, no un detalle pendiente).
   **Completado en la ronda 1 de fixes de playtest (2026-08-07)**: 13e dejó los escritores construidos pero
   NADIE poblaba `reservoirContents` al crear la partida, así que todos los reservorios nacían vacíos y el
   ciclo no tenía de dónde arrancar (el operador lo reportó sobre el reservorio de agua del Cap.1). La
   sustancia de cada reservorio pasó de comentario a dato (`CompositeComponentSpec.contains`, 21 entradas) y se
   deriva al crear la campaña y al sembrar un capítulo (`reservoir/initial-reservoir-contents.ts`), llenando a
   `capacity`. Para que eso no regale materia prima infinita, la extracción se topea por tarea
   (`EXTRACTION_BATCH_UNITS`).

10. ✅ RESUELTO (Fase 13e). **Capa `fluido` del plano (11f) anima con una heurística sin dato de caudal real.** A diferencia de
    `ventilacion` (deriva de `pressureKpa` real) y `electrico`/`senal` (derivan de `unpoweredSectionIds`/
    `signalGraph` reales), no existe en el motor ningún concepto de transporte de fluido entre secciones —
    `ReservoirProperty`/`ReservoirContent` es una cantidad estática por instancia de componente, no un
    caudal. Hoy `fluido` (`game/src/mission/conduit-flow-heuristics.ts`) reutiliza el mismo booleano de
    cicatriz de energía que `electrico`, con una intensidad fija, sin granularidad propia. Resolver cuando
    exista una simulación real de fluidos/reservorios con transporte entre secciones — hueco relacionado
    con el punto 9 de este archivo (reservorios sin `substanceId`/`amount`).
    Resuelto: sin construir una simulación de transporte continuo (que ningún capítulo pide todavía), el caudal
    se deriva de las operaciones de fluido REALMENTE en curso — `FluidOperationRegistry`
    (`engine/src/mission/fluid-operations.ts`), poblado por trasvase/vertido/extracción/purga y enganchado al
    ciclo de vida de la tarea (`task-started` la activa, `task-completed`/`cancelled`/`failed` la retiran).
    `conduitFlowIntensity` gana un `fluidIntensity` propio que normaliza ese caudal a [0,1], con la misma forma
    que `ventilationIntensity` deriva de `pressureKpa`. Sin operación viva el conducto queda QUIETO: es
    correcto, no un bug — mismo criterio de diseño que 11f.4 documentó para los conductos `senal` en calma.
    **Fuera de alcance a propósito**: un runtime de transporte continuo de fluido por conducto (reservorio →
    conducto → reservorio por tick), que sería un dominio nuevo entero.

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
    → Lo diferido pasa a la **Subfase 14b** (triaje 2026-08-21): esa subfase ya hace el mismo trabajo —umbrales
    sobre una lectura del mundo (`triggerType: "quimico"`) y generalizar `SignalOutputReader`—, así que el
    umbral configurable del LED es una extensión de su dominio, no un pedido de UI suelto. **Conserva su ciclo
    de preguntas propio** (¿solo el LED o cualquier receptor con salida numérica?, ¿configurable en cualquier
    momento o solo antes de instalar?).

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
    → El residual del `LightHook` pasa a la **Subfase 12d** (triaje 2026-08-21), junto con Obs 16: es el mismo
    dominio de depth/registro de luces y debe entrar al mismo ciclo de preguntas.
    → ✅ **RESUELTO en la Fase 12d.5 (2026-08-24).** La razón por la que se había descartado en 13a ("exigiría
    extender la firma de `EventDrivenEffect.trigger` para los ~10 efectos ya registrados") **había dejado de
    ser cierta**: 13e ronda 4 agregó `EventEffectOptions.onObjectCreated` justo para esto. Al auditarlo se vio
    que el problema era más ancho que la combustión: de los 15 efectos del registro **solo `salvage-hazard`
    propagaba el hook**, o sea que los otros 14 tenían el mismo bug de doble-cámara latente. Ahora
    `spawnBurst`/`spawnDecal` aceptan un `ObjectCreatedHook`, todos los efectos lo propagan, y
    `floorplan-scene.ts` lo pasa en todos los `fireEventEffect` con un único `worldEffectOptions`. De paso, la
    luz de un burst entra al sistema de sombras (`registerBurstLight`): antes el fogonazo de un incendio no
    iluminaba nada.
    **Ampliado en Fase 12b**: el mismo hueco existe para `HazardEvent` (`toxic-threshold`/`corrosive-exposure`,
    umbral de exposición atmosférica a tripulante) — tampoco tiene llamador real en `floorplan-scene.ts`, solo
    se demuestra en `particle-gallery-scene.ts`. El sonido de corrosión (`game/src/audio/effects/
    corrosion-sound.ts`) y el de combustión quedaron listos y registrados en `phenomenon-sound-registry.ts`,
    pero ninguno de los dos suena en partida real hasta que exista el runtime que dispare estos eventos.
    → ✅ **RESUELTO en la Subfase 13f (2026-08-24).** `MissionHazardRuntime` es el llamador de producción que
    faltaba para `HazardAccumulator`, y `MissionRuntime` expone un `atmosphereEvents` nuevo — **ese bus no existía**,
    que es la razón de fondo por la que el sonido de corrosión de 12b nunca sonó. Letalidad según la decisión del
    operador: `incapacitation` hiere con `minHp: 1` (aviso previo) y solo `lethal` mata; se le añadió una fase de
    incapacitación al acumulador corrosivo, que la tenía en `Infinity`. Se cerró de paso el otro llamador ausente
    de la misma familia: `applyKineticDamage` (`registerKineticDamage`), así que un proyectil que golpea a un
    tripulante o a un enemigo por fin le hace daño.

20. ✅ RESUELTO en la Subfase 13f (2026-08-24). **La integridad de casco se derivaba del RE de los componentes
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
    → **Subfase 13f**.

21. ✅ RESUELTO en la Subfase 13f (2026-08-24). **Un proyectil que no golpea nada salía del plano y seguía avanzando.**
    `ProjectileSimulation.advance` (`engine/src/kinetics/projectile-simulation.ts`) no valida contra
    `floorplan.gridSize`, y `MissionProjectileWorld.occupantAt` solo resuelve componentes, tripulación y
    enemigos — no hay concepto de pared en el motor. Lo único que lo frena es el drag de ASA 2. Tampoco
    rebota: `impact()` lo detiene en seco y pierde toda la inercia. Se aborda en la Subfase 13f, que necesita
    la colisión contra pared para dañar la sección (mismo patrón de inyección que `setMotionBlockedQuery` de
    13a, sin que `/engine` conozca Tiled).
    Hecho: `CellOccupant` gana `kind` (`component`/`crew`/`enemy`/`wall`) y `MissionProjectileWorld` recibe el
    `CellBlockedQuery` que `MissionRuntime` YA tenía inyectado desde el tilemap (un solo punto de inyección, no
    dos verdades sobre qué celdas están bloqueadas) más el `gridSize`, de modo que salirse del plano cuenta como
    chocar contra el casco exterior. El impacto lleva además la celda (`position`), lo que de paso arregla que un
    impacto contra un tripulante no pintara NADA.
    → ✅ **Subfase 13f**.

22. ✅ RESUELTO (13e rondas 7 y 9; confirmado en el triaje de 2026-08-21). **No hay selector de destino al trasvasar una sustancia** (Subfase 13e, decisión de alcance explícita).
    `onTransferSubstance` (`game/src/mission/mission-interaction-controller.ts`) toma el PRIMER reservorio
    alcanzable que devuelve `MissionRuntime.transferTargetsFor`, sin preguntarle al jugador. Es suficiente hoy
    porque con la red de conductos `fluido` recién autorada el conjunto alcanzable es de uno o dos, pero en
    cuanto haya más reservorios en la misma red hace falta un modal de selección (mismo molde que
    `install-picker-modal.ts`). Tampoco hay control de CUÁNTO trasvasar: se mueve todo el contenido.
    Resuelto: la ronda 7 reemplazó el auto-pick ciego por un **modo de selección espacial** estilo SimCity
    (hermano estructural de `wireMode`), y la ronda 9 pasó la cantidad a `Math.min(origen, freeCapacity)`, así
    que ya no se pierde el remanente. Lo único que sigue vivo del texto original —que el jugador elija *cuánto*
    transferir— se rastrea en el punto **#27**, no acá.

24. ✅ RESUELTO (el operador los colocó durante la propia sesión de 13e). **Sprites de los dos aparatos de
    fabricación.** Rutas:
    `game/assets/sprites/components/banco-de-trabajo.png` y
    `game/assets/sprites/components/estacion-quimica.png`, 2×2 celdas cada uno. `component-sprite-registry.ts`
    los descubre solo vía `import.meta.glob`, sin wiring extra — falta confirmar visualmente en playtest que el
    encuadre 2×2 se ve bien.

25. ✅ RESUELTO (13e ronda 3). **El último botón del panel de acciones queda fuera de su caja de fondo** (detectado al verificar 13e
    ronda 1 con Playwright). Con la sección de reservorio (texto de contenido + 3 botones) el panel de una
    instancia llega a 5 botones, y el `backdrop` deja el último ("Extraer…") sin fondo detrás: se lee sobre el
    mapa y pierde contraste. `renderMissionActionPanel` YA dimensiona el fondo al contenido real
    (`claim()`/`renderedHeight`, arreglado en 13d ronda 2) y `stackButtonEnabled` llama a `claim`, así que la
    causa no es obvia — hace falta medir `container.getData(ACTION_PANEL_HEIGHT_KEY)` contra el `cursorY`
    final. Puramente estético: el botón se ve, se lee y funciona.

## Deuda #38 — Los componentes sin sprite propio no son tinteables por estado (Subfase 13h, ronda 3)

**Estado:** ✅ RESUELTO en la Subfase 13g (2026-08-29).

El sistema de estado por componente (`component-state-visuals.ts` + `updateComponentStateTints`) tiñe
`componentSpritesByInstanceId`, que solo se puebla cuando la pieza tiene sprite real
(`hasComponentSprite`). Las piezas sin arte todavía se dibujan en el `Graphics` batcheado del overlay
(`mission-overlay-renderer.ts`) y **no son objetos por instancia**, así que no pueden recibir tinte vivo ni
ícono: su estado solo se lee en el tooltip y en el panel.

Hoy no se nota porque el único estado es `unpowered` y el único consumidor de energía es `compuerta-blindada`,
que sí tiene sprite. Se vuelve visible en cuanto 13g le dé `powerDraw` a chips, sensores y mesas.

Dos salidas posibles: que el overlay cree un objeto por instancia también para el placeholder (uniforma el
camino, cuesta objetos), o que el contorno del footprint se redibuje por frame con el color del estado (más
barato, menos legible). Decidir al abrir 13g.

**Resolución (13g):** el operador eligió la primera. `mission-overlay-renderer.ts` crea ahora un `Image` por
celda ocupada sobre una textura blanca de 1×1 (`ensureComponentPlaceholderTexture`) en vez de rellenar el
`Graphics` batcheado, y lo registra en `componentSpritesByInstanceId`. Con eso el placeholder recorre EL MISMO
camino que un sprite real —`setBaseTint`, `updateComponentStateTints`, `applyLightShading`— sin bifurcación.
Se arregló además el hermano con el mismo defecto (el placeholder de la Pantalla LCD, patrón 31) y se ajustó
`spriteCopyAboveDim` para copiar también la opacidad, porque el placeholder va a 0.85 y los sprites a 1.

## Deuda #39 — La oferta de energía de la nave nunca se dimensionó contra su demanda (Subfase 13h, ronda 3)

**Estado:** ✅ RESUELTO en la Subfase 13g (2026-08-29).

`nave-exploracion` produce **10 unidades** (5 × `celula-fotovoltaica`) y sus 10 puertas piden **20**
(`powerDraw: 2` cada una). Cada sección tiene exactamente una puerta, así que ninguna funciona con 1 unidad, y
el techo real es peor: el reparto es por sección en bloques de 2 y las sobras impares se desperdician.

El operador decidió explícitamente **dejar la escasez** y resolver la legibilidad (esta ronda), no el balance.
Queda anotado acá porque el número correcto es trabajo de balanceo (Fase 23) y porque 13g va a EMPEORARLO: al
declarar `powerDraw` en chips, sensores y mesas, la demanda sube sobre la misma oferta de 10. Al abrir 13g hay
que decidir la oferta con la demanda total ya conocida, no pieza por pieza.

**Resolución (13g):** con el catálogo declarando consumo, la demanda real de una partida nueva de exploración
resultó ser **33** (20 de las 10 puertas, 6 de las 2 mesas, 2 de la válvula del Cap.1, 2 del fotorreceptor y
el chip de su segundo paso, 3 del attrezzo). El operador eligió **subir la oferta**, no dejar la escasez:
10 → **38 unidades**, sumando 4× `reactor-alto-amperaje` + 1× `bateria-gran-capacidad` en `propulsion`, en
celdas verificadas libres decodificando el mapa. Perder un reactor entero (6) ya obliga a triaje.

Salió además un segundo agujero que la deuda no nombraba y que habría hecho inútil subir la oferta:
`emptyPowerState()` deja `sectionAllocations: []`, o sea que TODA sección de una campaña nueva arranca con 0
unidades otorgadas (patrón 42). Se resolvió sembrando el reparto inicial en `campaign-save-factory.ts` con
`defaultSectionAllocations`, y NO en `MissionPowerRuntime`: el runtime no puede distinguir "nunca se asignó"
de "el jugador puso todo en 0", porque `setSectionPowerUnits` borra la entrada al llegar a 0.

`power/initial-power-budget.test.ts` cruza oferta contra demanda con el contenido autorado real, así que un
ajuste de balanceo futuro (Fase 23) no puede romper la relación en silencio.

## Decisión #45 — `panel-electrico` NO se crea como pieza (Subfase 14a-4)

**Estado:** ✅ RESUELTO por decisión explícita del operador, 2026-09-01. No es deuda: se registra para que no
se vuelva a abrir dentro de unos meses leyendo el GDD sin este contexto.

El GDD §9 caso 2 ("Cortocircuito en bahía de carga") nombra un *panel eléctrico*, y hasta 14a-4 existía solo
como **fixture sintético** en tres tests (`mission-overload-runtime.test.ts`, `mission-reaction-runtime.test.ts`,
`case-02-cortocircuito-bahia-carga.test.ts`), con `COND(E) maxCapacity: 20` — una escala anterior al
re-escalado de 14a-2, que dejó los conductores reales en 3/6/9/12 unidades de `powerDraw`.

Preguntado qué función cumpliría como pieza real, el operador respondió: **si es solo el lugar por donde pasan
los cables, no tiene sentido — los conductos `senal` del plano ya cumplen esa función.** Y es correcto:
`sectionsConnectedByConduit` ya decide por dónde puede cruzar un cable, y `computeSignalWireRoute` ya lo rutea
por ahí.

Se evaluó y se descartó también la variante "nodo de derivación" (una pieza donde convergen varias aristas, con
capacidad agregada propia). Queda anotada por si el diseño del Cap. 2 llega a pedir un tronco explícito, pero
**no se implementa sin un caso de uso que la pida**, mismo criterio de "no construir mecanismo antes del caso de
uso" que ya se aplicó a los payloads de tarea.

El caso de validación 2 dejó de depender del fixture: ahora corre sobre un cable real con capacidad de catálogo.

**Actualizado en la ronda 2 de playtest de 14a-4 (2026-09-02).** El "nodo de derivación" que quedó
anotado acá terminó existiendo, pero sin pieza nueva: `chip-circuito-generico` ya era un relé por
construcción —el evaluador calcula la salida de todo nodo que no sea emisor— y solo lo bloqueaba la
guarda receptor→receptor de `orientSignalWiring`. Levantarla, más la capacidad de salida por pieza,
da el tronco explícito que se buscaba **reusando el catálogo existente**, que es lo que el principio 1
pedía. El caso de uso que faltaba llegó del playtest, no de un diseño anticipado.



## ✅ RESUELTO — Deuda #56 — El estado interno de un chip no se ve: cuenta del contador, memoria del latch, fase del reloj (Subfase 14b-3, playtest de circuitos)

**Estado:** ✅ RESUELTO 2026-09-25. Registrada 2026-09-24. Prioridad alta antes de 14c: el Cap.2 pide al jugador construir filtros
AND/OR/NOT y sin esto depura a ciegas.

Al armar un circuito real (Y + contador + reloj + LEDs) el operador pudo configurarlo todo pero no ver qué pasaba
adentro. `SignalNodeState` guarda `counterValue`, `latchMemory` y `oscillatorPhaseSeconds`, y `/game` no lee ninguno
(verificado con grep). El panel del nodo (`kind:"node"`) sólo muestra la lógica ELEGIDA ("Actual: Contador"), no su
estado en vivo: "Cuenta: 1/2", "Memoria: enganchada", "Reloj: encendido". Es el eje 1 del checklist de playtest (la UI
no puede ocultar el estado del motor) aplicado a una pieza nueva.

Alcance sugerido, de menor a mayor:
- Una línea de estado vivo en el panel del nodo, derivada en cada dibujo como el resto (`redrawActionPanel`).
- Que el tooltip del nodo y del cable indique si están activos.
- Que la LCD pueda mostrar la cuenta o el estado de un latch: `LcdDisplayValue` sólo tiene `pressure`, `temperature` y
  `chemical`, y su docblock ya anticipaba "estado de un latch" como variante futura.

**Resolución (2026-09-25):** el estado interno (cuenta, memoria, entradas activas, reloj, retardo) se ve en el tooltip de la
pieza, en el tooltip del nodo en modo cableado y en el panel de la pieza, donde además se configura la lógica del chip (sin
pasar por el modo cableado, que ya no abre ningún panel). La LCD quedó fuera: Deuda #58. Detalle en `docs/changelog/fase-14.log`.
