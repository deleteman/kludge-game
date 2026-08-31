
> **Triaje de 2026-08-21:** todos los puntos abiertos de este archivo tienen ahora fase asignada en
> `nuevo-orden.md`. El grueso de UI/UX y bugs de input vive en la **Subfase 14d** ("Bucket de UI/UX y Bugs de
> Playtest — Pre-Demo"), creada en ese triaje porque la Fase 12 está cerrada entera y no había dónde ponerlos.
> Cada punto de abajo dice su destino en su propia línea. Ningún ítem abierto queda sin fase.

## Observaciones

0. No hay una historia, debería haber una historia definida, con una intro, con algo que muestre lo que está pasando ANTES de ver el plano de la nave? Tal vez un par de escenas con texto que se escribe y cuenta lo que está pasando. Un reporte de incidente? 
   → **Fase 15 (Demo)**, pendiente de ciclo de diseño narrativo propio (no existe ningún sistema narrativo previo en el proyecto).
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

8. Se pueden encolar 2 o más tripulantes para instalar la misma pieza (de la cual solo hay una copia) y cuando se le da "play", luego de que el primero termina la instalación, el juego da un error al querer instalar la pieza que ya no está en stock.
   → **Subfase 14d, Bloque 1 (primer ítem: es el único crash de esta lista).** Verificado en el triaje: es peor
   que "da un error" — `queueInstall` (`game/src/mission/mission-runtime.ts`) no reserva stock al encolar,
   `ship-task-effect.ts` lanza `InsufficientStockError` al completar, y `TaskScheduler.completeTask` invoca el
   efecto **sin try/catch**, así que la excepción rompe el tick de la misión. El filtro `"no-stock"` del selector
   (`mission-interaction-controller.ts`) mira el stock actual sin descontar lo ya encolado. Fix en dos capas:
   descontar lo encolado al ofrecer el ítem + degradar la tarea a `failed` con notificación en vez de propagar.

9. cambiar de idioma no afecta todos los strings, hay botones de la UI que no cambian el idioma.
   → **Subfase 14d, Bloque 1** el subconjunto que expone la demo (menú, pantallas de selección, HUD de misión);
   **Fase 22c** la auditoría total de i18n en ambos diccionarios, incluida la dirección inversa (claves sin
   consumidor, ver deuda #23).

10. En la pantalla de selección de arquetipo y la selección de tripulantes, el click no funciona bien. Parece que hay un desfase entre donde está el mouse y donde se hace el click, incluso parece que a veces el jugador hace click en un tripulante y termina clickeando en otro.
   → **Subfase 14d, Bloque 1.** Investigar primero la hit area de los containers de `crew-select-card.ts` /
   `ship-archetype-card.ts`, antes que el escalado (`scale.FIT` + `#game-root`, arreglado en 12f).

11. los clicks en botones de selección de capa hacen click en el mapa tambien. Eso no debería pasar en ningun elemento de la UI que está renderizado arriba del mapa.
   → **Subfase 14d, Bloque 1.** `installTopmostOnlyInput` (13e ronda 4) NO cubre este caso: desempata entre
   objetos interactivos y el mapa no es uno — se resuelve por el `pointerdown` global de `floorplan-scene.ts`.
   El panel de capas no registra sus bounds en `isOverFixedUi` ni hace interactivo su nineslice, a diferencia de
   `mission-action-panel.ts`. La regla general que pide la observación se implementa por esa vía.

12. hay algun uso real para los planos de la nave? que gana el jugador con ver es
   → **Subfase 14d, Bloque 2.** Confirmado con el operador en el triaje: se refiere a **las capas del plano de
   misión**. Es la pregunta de fondo de la que Obs 15 y el fine-tunning de capas son la respuesta propuesta —
   se resuelven como un solo ciclo de preguntas, no por separado.

13. el modal de instalación tiene ahora la sección derecha con fondo negro para solucionar el contraste horrible entre el texto y el fondo gris del modal. Esto es un parche temporal, se debe rediseñar este modal para que se lea mejor l ainformacion.
   → **Subfase 14d, Bloque 2** (rediseño de la jerarquía de lectura de la ficha, no repintado).

14. el link de "x cerrar" de los modales de acción (al hacer click en un tile del mapa) son muy dificiles de clickear, casi siempre falla el click.
   → **Subfase 14d, Bloque 1.** Es un `add.text` de 11px con `setInteractive()` sin padding ni `hitArea`
   (`mission-action-panel.ts`), o sea ~14px de alto de área clickeable. Pasar a `createKenneyButton`, como ya
   hace el close de `power-priority-list.ts`.

15. la UI de capas no es muy visualmente atractiva. Creo que preferiría tener nos iconos en el mapa mismo, como google maps, algo que sea solamente un icono representando lo que muesra con un tooltip. de esa forma se reduce el uso de botones, y se dejan más a mano. podrían estos botones estar dentro de una tira de herramientas relacionadas con el mapa (por ahora solo botones de capa) y con la capacidad de minimizar/ocultar esta tira así incluso no sacan espacio visual si el jugador no las necesita.
   → **Subfase 14d, Bloque 2**, junto con Obs 12 y el fine-tunning de capas (un solo ciclo de preguntas).

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

17. El puntero del mouse debería estar con la misma imagen que se pone sobre los botones en su estado default. Ahora mismo, salta abruptamente entre el puntero del sistema y el puntero de los botones.
   → **Subfase 14d, Bloque 2.** No es obra nueva: `game/src/ui/custom-cursor.ts` existe desde 12c pero solo está
   cableado en `floorplan-scene.ts`; title/crew-select/hub/workbench/options usan el puntero del sistema. Falta
   cursor por defecto global + revisar el `setDefaultCursor("default")` que lo revierte en `floorplan-scene.ts`.

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

12. **Un conducto asume que `(a, b, kind)` es una clave única (11f).** `ConduitConnection` no tiene un id
    propio; `game/src/scenes/floorplan-scene.ts::conduitFlowKey` usa `${a}-${b}-${kind}` como clave del
    `Map` de efectos de flujo animado. Si algún mapa de Tiled llegara a definir dos conductos del mismo
    `kind` entre el mismo par de secciones (no visto hasta ahora en los mapas reales), uno pisaría al otro.
    Bajo riesgo dado el patrón actual de autoría, documentado por si aparece.
    → **Fase 22a**, que es justamente donde se autoran conductos nuevos: verificar al autorar y darle id propio
    si el patrón aparece.

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
    **Parcial (Fase 13e)**: `nave-exploracion` ya tenía 3 conductos `fluido` autorados por el operador
    (`tanques-combustible`↔`propulsion`, `pasillo-central`↔`propulsion`, `ingenieria`↔`pasillo-central`), pero
    ninguno alcanzaba las secciones que 13e necesita. Se autoraron 2 más para conectar a esa red
    `bodega-carga` (donde viven el banco de trabajo y la estación química) y `soporte-vital` (donde está el
    reservorio de agua reciclada sembrado), fijados por test en `mission/fluid-operations.test.ts`. Sigue
    pendiente: `senal` y `fluido` en investigación/guerra/médica.
    → **Fase 22a** (ya listado en el texto de esa subfase).

14. **La capa `senal` está autorada solo en `nave-exploracion` — el resto queda sin cableado cross-section
    (Fase 11f.1).** Con la mecánica de cableado restringido (un cable de señal solo cruza a otra sección si
    hay un camino de conductos `senal`, `assertSignalWiringReachable`), un mapa sin conductos `senal` no
    permite NINGÚN cable de señal cross-section. Hoy solo `nave-exploracion` tiene el conducto que el Cap.1
    necesita; investigación/guerra/médica quedarían con su Cap.1 bloqueado en el paso de cableado. No rompe
    nada activo porque solo exploración se juega de punta a punta (los otros 3 son posiciones de referencia
    sin verificación visual, `chapter-01-primer-aviso.ts`). Autorar los `senal` de esos arquetipos cuando
    entren en testeo real. Intra-sección nunca requiere conducto.
    → **Fase 22a** (ya listado en el texto de esa subfase).

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
    → **Fase 22d** (creada en el triaje de 2026-08-21). Es procurement del operador, no código: el punto de
    cambio es un solo archivo (`AUDIO_KEYS`) y ningún llamador se toca.

18. al seleccionar un tripulante en la pantalla de selección de tripulantes debería cambiarle su imagen a color, ahora quedan en escala de grises.
    → **Subfase 14d, Bloque 1.** Verificado: es peor que lo reportado — **ningún** retrato sale nunca de grises.
    `crew-select-card.ts` aplica `grayscale(1)` en construcción (las tarjetas se crean siempre con
    `selected=false` desde `crew-select-scene.ts`) y `setSelected` solo cambia el fondo, nunca toca el `preFX`.

19. los efectos visuales de una zona sin energía se renderizan parcialmente arriba del cuadro de asginacion de energía en modo pausa.
    → **Subfase 14d, Bloque 1** (depth, mismo patrón que la ronda 4 de 13e).
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

23. **Las claves i18n `ui.menu.workbench.mode-chemistry`/`mode-physical`/`chemistry-hint` quedaron sin
    consumidor** (Subfase 13e). El toggle libre Física/Química de la mesa se eliminó al pasar el modo a
    depender del aparato desde el que se abre (Obs 4), pero las claves siguen en `es.ts`/`en.ts`. Se dejan
    porque son inofensivas y la auditoría total de i18n es la Fase 22c — anotado para que esa auditoría las
    encuentre en vez de dar por hecho que se usan.
    → **Fase 22c** (ya listado en el texto de esa subfase).

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

26. **El panel de acciones titula con el `instanceId`, no con el nombre del componente.** Se lee
    "RESERVORIO-AGUA-RECICLADA — OK" en vez de "Reservorio de agua reciclada". Viene de `instanceTitle(name,
    condition)` en `mission-interaction-controller.ts`, que recibe el id crudo cuando la instancia no está en
    `nameByComponentId`. Preexistente a 13e, visible en cualquier pieza sembrada; el tooltip de la misma pieza
    sí muestra el nombre bueno.
    → **Subfase 14d, Bloque 1.** El tooltip se arregló en la ronda 2 de 13e consultando `definitionOf(...)`
    antes del mapa; solo falta portar esa misma línea al panel. Ídem el inspector de prioridad de energía
    (`floorplan-scene.ts`), que cae a `String(instanceId)` crudo — peor caso del mismo bug.

27. **No hay selector de destino ni de cantidad al trasvasar** (registrado en 13e como #22, ampliado tras la
    ronda 2). "Trasvasar a otro reservorio" toma el primer destino alcanzable y mueve TODO el contenido. Con
    el aviso de desborde de la ronda 2 el jugador ya se entera de lo que pierde, pero sigue sin poder elegir.
    Cuando se implemente, el motor ya lo soporta: `TransferSubstanceTaskPayload` lleva `amount` y
    `transferTargetsFor` devuelve la lista completa de destinos, no solo el primero.
    **Reducido en el triaje de 2026-08-21:** el selector de destino ya existe (modo espacial, ronda 7) y la
    cantidad ya se capa al espacio libre sin perder el remanente (ronda 9). Lo único abierto es dejar al
    jugador **elegir cuánto**. → **Subfase 14d, Bloque 2**, prioridad baja dentro del bucket.

28. **La tira de tripulación no entra en un viewport de 720px de alto.** Detectado al verificar 13e ronda 2 con
    Playwright: en 1280×720 (el tamaño del canvas) el panel de acciones de una instancia con reservorio se
    dibuja hasta y más allá del borde inferior, y la tira de tripulación no aparece en absoluto — con lo cual no
    hay forma de seleccionar un tripulante. En el juego real el operador sí la ve, así que puede ser un mínimo
    de resolución no declarado. Conviene decidir si 1280×720 es soportado y, si lo es, ajustar el layout; está
    relacionado con #25, que es el mismo problema de alto en pequeño.
    → **Subfase 14d, Bloque 2.** Decidir primero la resolución mínima soportada (dato que la build de la demo
    tiene que declarar de todos modos) y recién después tocar layout.

29. **`sectionHasNoPowerGranted` se documenta como cosmético pero ya se usa para gating real.** Su docblock en
    `engine/src/power/mission-power-runtime.ts` dice textualmente que es "puramente cosmético… nunca por gating
    de señales/HUD", y sin embargo 13d lo consume para decidir si desmontar una pieza chispea
    (`dismantle-hazard-rules.ts` vía `SalvageHazardDeps.sectionHasGrantedPower`), y la Subfase 13g lo va a usar
    más. Corregir el comentario para que describa lo que el predicado realmente es: la única consulta de
    energía con señal viva. Detectado al auditar la pregunta del operador sobre las mesas sin energía.
    → **Subfase 13g** (ya listado en el texto de esa subfase). Nota del triaje: la ronda 10 de 13e le sumó un
    tercer consumidor de gating real (el bloqueo de tareas por sección sin energía), así que el docblock está
    aún más desactualizado que cuando se anotó esto.

30. **Dos fuentes distintas para "sección sin energía" en la misma pantalla.** La capa HUD "energia"
    (`game/src/scenes/floorplan-scene.ts`, `drawEnergyLayer`) resuelve el estado leyendo
    `blueprint.unpoweredSectionIds` — la cicatriz PERMANENTE, hoy siempre vacía en campaña nueva — mientras el
    overlay del plano (`redrawUnpoweredSectionScar`) usa `sectionHasNoPowerGranted`, que es el déficit vivo.
    Resultado: el plano pinta una sección a oscuras y la capa de energía no. Se resuelve solo en parte con 13g;
    conviene unificar la fuente explícitamente.
    → **Subfase 13g** (ya listado en el texto de esa subfase, bajo "revisar la vía muerta de `unpoweredSections()`").

31. **El inspector de prioridad energética siempre dice "alimentado".** `openEnergyPriorityPanel`
    (`floorplan-scene.ts`) muestra `powered` por componente usando `isInstancePowered`, que hoy devuelve `true`
    para todo porque ninguna pieza del catálogo declara `powerDraw`. No hay forma de que diga otra cosa hasta
    que se implemente la Subfase 13g; queda anotado para no diagnosticarlo dos veces.
    → **Subfase 13g** (ya listado en el texto de esa subfase: al poblar `powerDraw`, este inspector responde solo).

32. **`GAS_FRACTION_PER_SUBSTANCE_UNIT` pendiente de balanceo (Fase 23).** En la ronda 3 de 13e pasó a ser
    fracción por unidad **por unidad de volumen de sección** (se divide por `sectionArea`), y se recalibró de
    0.02 a 0.2 para compensar la división. El valor es plausible pero no está jugado en profundidad: con una
    sección de ~20 celdas, un reservorio de 100 unidades de gas satura al 100 %. Revisar junto al resto de
    parámetros numéricos cuando se haga el balanceo.
    → **Fase 23** (ya listado en el texto de esa fase).

33. **El suavizado de la nube de gas no tiene test automático.** `createGasLeakEffect` ganó umbral,
    persecución exponencial y opacidad proporcional (13e ronda 3), todo verificable solo a ojo. Es coherente
    con el estándar de `/game` (smoke visual, no cobertura), pero queda anotado: si el comportamiento se
    rompe, ninguna suite lo va a decir.
    → **Fase 23** (QA), como smoke test durante el playtesting de los 8 capítulos. No se sube a estándar de
    `/engine`: sigue siendo UI.

34. **Acoplamientos cruzados de motor evaluados y diferidos a después de la demo** (análisis de
    sesión 2026-08-11, matriz de dominios Energía/Presión/Química/Señales/Estructura). Cuatro pares
    quedaron diseñados pero sin fase asignada, candidatos a partir de la Fase 16 (ya hay callbacks
    de cicatriz persistente con los que un desgaste cruzado encaja mejor que en la demo):
    - Energía→Presión: regulador de presión activo, gateado por energía (contrarresta
      `SectionPressureSinkSource`, mismo `PRESSURE_RECOVERY_CEILING_KPA` hoy sin escritor).
    - Presión→Energía: presión crítica degrada la capacidad efectiva de un conductor de esa
      sección — misma regla genérica que el par Energía↔Presión de Barotrauma (líquido conductor),
      un `ConductorEnvironmentalStressRule` con dos disparadores en vez de dos reglas separadas.
    - Energía→Estructura: sobrecargas repetidas en una sección degradan `condition` (extiende el
      escritor de 13c con un tercer disparador). Depende de que `OverloadEvent` lleve `sectionId`
      resuelto (ya listado como hueco de motor de 13f).
    - Estructura→Energía: vida estructural baja reduce la capacidad de los conductores de esa
      sección (`sectionHullIntegrity` como input de `power-allocation.ts`). Depende de que 13f
      exista (vida por sección).
    **Descartado, no diferido:** Señales↔Estructura en ambos sentidos — decisión explícita del
    operador, un sensor/receptor no debería perder conexión por el estado estructural de su
    sección. Si en el futuro un caso de validación lo necesita, revisar con su propio ciclo de
    preguntas.
    → **Fase 16** (triaje 2026-08-21): primera fase post-demo y primera que introduce cicatriz persistente,
    que es el contexto donde un desgaste cruzado tiene sentido. Los dos pares que tocan Estructura dependen
    además de que **13f** exista (vida por sección).

35. **La capa de objetos `luces` está autorada solo en `nave-exploracion`** (relevado al cerrar 12d.5,
    2026-08-24). Mismo patrón que la deuda #14 con la capa `senal`: de los 4 arquetipos, solo
    `nave-exploracion` tiene la capa (21 focos). Los otros 3 (`nave-guerra`, `nave-investigacion`,
    `nave-medica`) no tienen siquiera tile layers `background`/`objects`/`walls` — o sea que no tienen arte
    todavía, y autorar sus luces es parte del trabajo de arte de esos arquetipos, no de 12d. `loadAuthoredLights`
    devuelve `[]` sin romper: esas naves se verían a oscuridad ambiente uniforme (sin focos, sin contraste de
    sombra y con todos los sprites al mismo nivel de luz). Ruta esperada: capa de objetos `luces` con Points y
    props `color`/`radius`/`intensity` en `engine/src/floorplan/maps/<arquetipo>.json`.

36. ❌ **DIAGNÓSTICO MÍO EQUIVOCADO, corregido en 12d.6 (2026-08-24).** El texto original de este punto decía
    que las 21 luces autoradas tenían `intensity` "por debajo del piso de aclarado" y que por eso era "un dial
    que no mueve nada". **Falso, y el error era mío**: `PointLight.intensity` es el brillo del GLOW ADITIVO
    —en todo el proyecto vive entre 0.01 y 0.35, porque a 0.3 una luz ya quema varios tiles a blanco— mientras
    que `LIGHT_CLEAR_ALPHA_FLOOR` = 0.3 es OPACIDAD DE OSCURECIDO de la capa de sombras. Son dos escalas
    distintas y las mezclé al escribir `light-grid.ts`. Los valores autorados por el operador son los
    correctos para lo que controlan y **no se tocaron**. Lo que se corrigió es el código: el nivel de luz de
    los sprites ya no lee `intensity` (una luz encendida ilumina pleno dentro de su radio). Se deja registrado
    porque el error de lectura de escala se llevó una ronda entera de playtest.

37. **Solo el 20% del suelo transitable de `nave-exploracion` recibe algo de luz** (medido al cerrar 12d.6,
    2026-08-24, con el mapa y las 21 luces reales). Distribución sobre las 679 celdas libres: **80% a
    oscuridad plena** (nivel 0.5), 3% en penumbra intermedia, 16% a brillo pleno. Con el contraste ya
    arreglado, una pieza que caiga en ese 80% se sigue viendo oscura — correctamente esta vez, porque
    literalmente no le llega luz. Es una decisión de AUTORÍA, no un bug: 21 focos de radio 100-140px (3-4.4
    celdas) sobre un plano de 40×22 cubren poco. Si la intención es que la nave se lea mayormente iluminada,
    la palanca es colocar más objetos en la capa `luces` o subir su `radius`; si la intención es una nave a
    oscuras con focos puntuales, ya está como debe. Depende del operador, no del código.

38. **`CrisisDefinition.scriptedReactions` no tiene datos en NINGÚN capítulo** (verificado al atender el
    playtest de 12d.5, 2026-08-24, reporte del operador: "no tengo forma de provocar combustión"). Existen el
    tipo (`engine/src/crisis/crisis-definition.types.ts`) y un test de integración
    (`mission-reaction-cascade.integration.test.ts`), y 13a cableó el runtime que los evalúa
    (`MissionReactionRuntime`), pero **nunca se autoró contenido**. Consecuencia: combustión, ignición
    espontánea y neutralización siguen sin camino real en partida, así que sus efectos, sus sonidos y el
    overlay de alerta por combustión violenta no se pueden ver jugando. Es el residual de CONTENIDO del
    ítem #16 (cuyo residual de código sí quedó cerrado). Mitigado, no cerrado, por la tecla de dev **F** del
    plano de misión (12d.6): dispara cualquier fenómeno del catálogo en la celda seleccionada, lo que permite
    verificarlos, pero no los hace alcanzables jugando. Cerrarlo de verdad es diseño de capítulo.

39. **La corrosión de la atmósfera nunca daña nada en partida, porque ningún capítulo autora una sustancia
    `CORR` viva** (relevado al cerrar 13f, 2026-08-24). Es el mismo hueco que 13c ya había documentado para su
    escritor de desgaste por corrosión, ahora con un segundo consumidor: el escritor de daño estructural POR
    SECCIÓN de 13f (`corrosionDamageRule`). Los dos están cableados y testeados y los dos son inertes jugando
    — el Cap.1 es una fuga de presión, no de ácido. Hermano de la deuda #38: es diseño de capítulo, no código.
    El resto de escritores de 13f sí tienen camino real (impacto cinético contra pared, explosión vía la tecla
    de dev **H**, y descompresión desde la fuga del Cap.1).

40. **`SectionBreachedEvent` no tiene sprite ni sonido propios** (relevado al cerrar 13f, 2026-08-24). El
    efecto de partículas es código (chorro de descompresión + mancha permanente que marca dónde instalar el
    parche), que es lo que corresponde; lo que falta es un asset de audio de descompresión — se reutiliza el
    banco de explosión grave (`AUDIO_KEYS.overloadExplosion`), misma familia de carencia que la deuda #17 y
    mismo punto de cambio único (`AUDIO_KEYS`). Si en algún momento se quiere un tile de brecha dibujado sobre
    el casco, iría en `game/assets/sprites/tiles/`.

41. **Las piezas ferromagnéticas promovidas a proyectil se pierden al guardar** (relevado en la ronda 1 de
    playtest de 13f, 2026-08-25, mientras se auditaba la persistencia). `LooseFerromagneticPromoter.promote()`
    saca la instancia de `Blueprint.placedComponents` y la pasa a `ProjectileSimulation`, que **no tiene
    ningún campo de schema donde persistirse**. Consecuencia: cualquier pieza MAG que haya sido promovida
    desaparece para siempre al recargar la partida — pérdida real de datos, no cosmética. Es preexistente y
    quedó tapado hasta ahora porque "Guardar y salir" no persistía nada del estado de misión (ver #42).
    Arreglarlo pide un campo propio en el `Blueprint` y un bump de `schemaVersion`, así que no entró en la
    ronda de fixes.

42. **`crew-death` no destruye ni atenúa el token de tripulación en el plano** (relevado en la ronda 1 de
    playtest de 13f, 2026-08-25). Un tripulante muerto sigue dibujado entero sobre el mapa, indistinguible de
    uno vivo; los enemigos sí lo resuelven (`destroyEnemyToken`). Con el daño por vacío de 13f ahora hay un
    camino jugable frecuente para morir, así que la inconsistencia se ve. Principio 6: dos estados distintos
    no pueden verse igual.

43. **El daño por vacío reutiliza la causa `"cold"`** (decisión tomada al implementar 13f y revisada en la
    ronda 1, 2026-08-25). En `crew-death-effect.ts` esa causa mapea a astillas de hielo, que es defendible
    —una descompresión congela— pero no es la lectura ideal de "se quedó sin aire". Si se quiere una variante
    visual propia, es un fenómeno nuevo del registro de efectos y su propia decisión de arte, no un ajuste.

44. **No hay materiales para el cañón de riel en el Cap.1** (reporte 3 de la ronda 1 de playtest de 13f,
    2026-08-25). El impacto cinético contra pared es uno de los cuatro escritores de daño estructural de 13f y
    el único con camino jugable propio, pero el stock inicial del capítulo no alcanza para montar el cañón, así
    que en la práctica no se puede ejercitar jugando. Hermano de las deudas #38 y #39: es diseño de capítulo.

45. **Un aviso periódico de crisis deja de emitir en cuanto la víctima toca su piso de HP** (relevado en la
    ronda 1 de playtest de 13f, 2026-08-25, al añadir el guard de daño nulo en `applyHpLoss`). Las descargas
    del Cap.2 usan severidad `high` con `lethal: false`, o sea `minHp: 1`: la primera deja al tripulante en 1
    HP y desde ahí ninguna quita nada. Antes se emitía igual un `crew-damaged` con `hpLost: 0` en cada
    descarga, lo que hacía que el castigo PARECIERA seguir; ahora el juego es honesto y el castigo se vuelve
    invisible tras el primer golpe. La deuda es de DISEÑO del capítulo: un castigo periódico que no escala
    necesita otro efecto (rotar de víctima, degradar una tarea, subir la severidad), no un evento cosmético.

46. **Una campaña puede quedarse sin tripulación desplegable, y no hay forma de reponerla** (introducido y
    mitigado en la ronda 2 de playtest de 13f, 2026-08-25). Con el permadeath ya implementado, perder a toda la
    tripulación saca a todos de `activeCrewIds` y la campaña queda sin nadie a quien desplegar. Está mitigado
    —la misión termina en fallo y va a la pantalla de resultado en vez de dejar un mapa vacío e injugable— pero
    NO resuelto: el jugador puede seguir pulsando "Continuar" y volver a caer en el mismo fallo. Cerrarlo de
    verdad pide meta-juego que todavía no existe: reclutar/reemplazar tripulación entre capítulos, o un estado
    explícito de "partida perdida". Es la contrapartida directa de la decisión de baja completa; antes de 13f
    el problema no existía porque los muertos volvían enteros a la misión siguiente.

47. **`aggregateLifeSupport` sigue con peor-sección-gana sin ponderar** (relevado al ponderar la atmósfera en la
    ronda 2 de 13f, 2026-08-25). Es coherente con el criterio que se fijó —el O2 se difunde por los conductos,
    así que una sala sin oxígeno sí es un problema de toda la nave, a diferencia del vacío— pero conviene
    revisarlo cuando exista contenido que apague el soporte vital de una sección concreta: si esa fila resulta
    tan ruidosa como lo era la de atmósfera, la palanca ya está construida (`WeightedSectionAtmosphere`, que la
    función ya recibe y hoy ignora).

48. **Ningún sitio del juego enseña ya el flujo de instalación ni el click derecho para mover** (introducido en
    la ronda 4 de playtest de 13f, 2026-08-27). La pista que lo explicaba vivía en el panel de la celda vacía,
    que se borró por pedido del operador ("no cumple objetivo ninguno") — y tenía razón: un panel flotante que
    tapa el mapa no es sitio para un tutorial. Pero el hueco queda: el botón "Instalar" de la barra se
    autodescribe, y "click derecho = mover a esta celda" no se descubre solo. Es deuda de ONBOARDING, no de
    esta subfase: el sitio natural es el briefing del Cap.1 o una capa de ayuda de controles (que no existe),
    junto con el resto de atajos que hoy tampoco se enseñan (ESC, rueda para zoom, arrastre para panear).

---

## Deuda #35 — Capa `puertas` sin autorar en 3 de los 4 arquetipos (Subfase 13h)

**Estado:** ABIERTA. Registrada al cerrar 13h (2026-08-28).

La capa Tiled `puertas` solo está autorada en `nave-exploracion` (10 puertas, una por frontera ventilada,
derivadas de los vanos REALES del tilemap y no del rectángulo de sección). `nave-guerra`,
`nave-investigacion` y `nave-medica` parsean `doors: []` — la capa es opcional, así que cargan sin error,
pero **esas naves no están compartimentadas**: una brecha desangra la nave entera como antes de 13h.

Es la misma clase de deuda de contenido que #13/#14 (conductos `senal`/`fluido` sin autorar en los otros
arquetipos) y se cierra en el mismo momento: cuando los capítulos se extiendan más allá de Exploración.

Receta para autorarlas: los vanos se encuentran buscando las celdas con suelo transitable a ambos lados de
cada frontera de ventilación (`background` con tile y `walls` sin tile). Los vanos de dos celdas van como
UNA puerta con `span: 2`, nunca como dos puertas — cada puerta aporta su propia arista de difusión, así que
partirla duplicaría el caudal de aire de ese vano. El test
`canonical-ships.test.ts > exploracion: hay una puerta por cada frontera de ventilación` es el molde de la
comprobación de cobertura; conviene extenderlo a los otros arquetipos al autorarlos.

## Deuda #36 — Frame de sprite de puerta abierta (Subfase 13h)

**Estado:** ABIERTA. Registrada al cerrar 13h (2026-08-28).

`game/assets/sprites/components/compuerta-blindada.png` es un único frame de puerta CERRADA. El estado
abierto se resuelve por código desvaneciendo el sprite (`updateDoorSprites`, alpha interpolado con la misma
cadencia que usa la simulación), y la lectura fuerte del estado la lleva la barra de la capa `puertas`.

Funciona, pero una hoja que se desvanece no es lo mismo que una hoja que se corre. Si aparece un segundo
frame (o una tira de 3-4), el punto de cambio es `updateDoorSprites` en `floorplan-scene.ts` y nada más.
Procurement del operador, no código.

## Deuda #37 — Las semillas de Tiled no derivan nodos de señal (Subfase 13h, ronda 1 de playtest)

**Estado:** ABIERTA. Registrada 2026-08-28.

`instantiateComponentSeeds` crea la instancia pero **no llama a `deriveSignalNodes`**, así que un componente
sembrado desde la capa Tiled `semillas` con `EM`/`REC`/`ACT`/`COND` nace sin nodos y no se puede cablear.
Solo funcionan los nodos autorados a mano en TS (`chapter-01-primer-aviso.ts`) y los que crea
`installInstance` cuando el jugador instala algo.

Es exactamente el bug que el playtest de 13h reportó para las puertas (reporte #5). Ahí se cerró **acotado**:
`instantiate-door-seeds.ts` deriva sus propios nodos. No se generalizó porque hacerlo en
`instantiateComponentSeeds` **duplicaría** los nodos del Cap.1, que ya vienen autorados a mano por otra vía.

Cerrarlo bien exige decidir primero cuál es la fuente de verdad de los nodos del Cap.1: o se borran los
autorados a mano y se derivan todos, o `mergeInstalledSignalGraph` deduplica por `ownerRef` + rol. Hasta
entonces, cualquier semilla nueva de Tiled con propiedades de señal va a parecer rota sin decir por qué.

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

## Deuda #40 — 15 de los 17 `triggerType` de emisor no tienen simulación y quedan siempre activos (Subfase 13g, ronda 1 de playtest)

**Estado:** ABIERTA POR DECISIÓN, con `thermal` ya cerrado. Registrada 2026-08-29; actualizada 2026-08-31
(Subfase 14a-1).

Un emisor necesita que algo del mundo lo encienda. El motor sabe resolver **tres** disparadores:
`PRESENCE_TRIGGER_TYPES` (`optical`/`motion`, contra la posición de tripulación y enemigos),
`PRESSURE_TRIGGER_TYPES` (`pressure`, contra la presión real de la sección) y —desde 14a-1—
`THERMAL_TRIGGER_TYPES` (`thermal`, contra la temperatura real de la sección). Quedan **14 de 17** sin
simulación. Para todos los demás —`radar`, `radio`, `biometric`, `spectral`, `magnified`, `remote`, `visual`, `navigation`, `computation`,
`signal`, `manual`, `emergency`— nadie calcula nada, así que el `continue` de los dos envoltorios los deja con
el `true` de `allEmittersActive`: **se comportan como sensores permanentemente disparados**.

No es un descuido nuevo, es el límite conocido desde la Fase 13a; lo que cambió es que 13g lo volvió visible
(el LED encendido y el tinte por estado ponen al jugador a mirar la señal). El operador decidió
explícitamente conservar el fail-open: un sensor apagado para siempre tampoco sería más honesto mientras su
dominio no exista, y dejaría inertes piezas que hoy al menos se pueden cablear.

Lo que SÍ se arregló en esta ronda es la cobertura, que era un bug aparte: la búsqueda iba contra
`ATOMIC_COMPONENT_CATALOG`, así que ni siquiera los sensores del tipo correcto se resolvían si eran
**compuestos** — `sensor-movimiento-laser` y `sensor-presion-gas`, o sea los sensores de verdad del catálogo,
más cualquier creación de la mesa con `EM`. Ahora se resuelve contra el registro completo.

Cerrar esta deuda es, tipo por tipo, atarlos a un dominio real del motor. **`thermal` quedó cerrado en la
Subfase 14a-1** (2026-08-31): `temperatureAwareEmitterInputs` resuelve `sensor-termico-precision` contra la
temperatura viva de su sección, y el test de integración deja anclado que arranca APAGADO — que era el
síntoma concreto de esta deuda. El resto no tiene todavía un eje del que colgarse.

`quimico` es el siguiente y lo desbloquea la **Subfase 14b**.

## Deuda #41 — Falta el sprite de `sensor-termico-precision` (Subfase 14a-1)

**Estado:** ABIERTA. Registrada 2026-08-31.

La Subfase 14a-1 puso en juego real al sensor térmico (antes estaba en el catálogo pero permanentemente
disparado, ver deuda #40), y con eso pasó a ser una pieza que el jugador instala y mira. No tiene arte:
falta `game/assets/sprites/components/sensor-termico-precision.png`.

Mientras tanto usa el placeholder tinteable generado por código, que desde 13g recorre el mismo camino
visual que un sprite real (deuda #38), así que no bloquea nada — pero es el tercer sensor del diseño de
nivel del Cap. 2 y para la demo debería tener arte propio y distinguible del sensor de presión, que sí lo
tiene (`sensor-presion.png`).

## Deuda #42 — Los compuestos sin `footprint` desaparecen del selector de instalación sin explicación (Subfase 14a-1, ronda 1 de playtest)

**Estado:** ABIERTA. Registrada 2026-08-31.

`buildInstallOptions` (`game/src/mission/mission-interaction-controller.ts:1290-1291`) descarta con un
`continue` mudo todo compuesto de catálogo que no declare `data.footprint`:

```ts
for (const def of this.mission.installableCatalogComposites) {
  const footprint = def.data.footprint;
  if (!footprint) continue;      // ← sin fila, sin motivo, sin aviso
```

**Solo 6 de ~30 compuestos lo declaran** (`compuerta-blindada`, `radio-largo-alcance`,
`herramientas-reparacion-externa`, `reservorio-agua-reciclada`, `banco-de-trabajo`, `estacion-quimica`).
Los otros ~24 son invisibles. Es peor que estar bloqueado: un compuesto SIN ingredientes al menos aparece
atenuado con motivo `missing-ingredients`, y uno sin footprint no aparece en absoluto.

Es la causa concreta de que el sensor térmico de 14a-1 fuera inusable pese a estar simulado de verdad por el
motor (se le dio footprint en esa ronda, arreglando el caso puntual y no la clase).

`footprint` es opcional en compuestos POR DISEÑO (`composite-component-spec.types.ts:25-33`: los compuestos
pre-Fase-7 se instalan solo vía mesa de creación, que calcula su propio footprint), así que la salida no es
obvia. Dos evaluadas:
- **Fila bloqueada con motivo `no-footprint`**, coherente con "nunca dejarlo en silencio" de CLAUDE.md. Pero
  suma ~24 filas grises a una lista que ya es larga, y empeora el picker antes de mejorarlo — depende de que
  exista primero el buscador de la deuda #43.
- **Poblar `footprint` pieza por pieza** en los compuestos que tenga sentido colocar directo en el plano, y
  dejar fuera a los que de verdad solo se fabrican. Requiere pasar el catálogo entero con criterio de diseño.

Decidir junto con la deuda #43, no por separado.

## Deuda #43 — El selector de instalación necesita un buscador por nombre (Subfase 14a-1, ronda 1 de playtest)

**Estado:** ABIERTA. Pedido explícito del operador, 2026-08-31.

Desde la ronda 8 de fixes de playtest el selector es una **lista plana única** (habilitados primero,
bloqueados después con su motivo): se eliminaron las pestañas "Inventario"/"Catálogo", y
`game/src/ui/widgets/tab-strip.ts` quedó sin ningún importador — código muerto que conviene borrar en el
mismo cambio.

La lista crece con cada pieza colocable, con cada creación personalizada del jugador y con cada atómico sin
stock (que igual aparece como fila `no-stock`). Sin filtro por nombre, encontrar una pieza concreta ya es
scroll a ojo, y resolver la deuda #42 la haría directamente inmanejable.

## Deuda #44 — Re-nivelar el stock inicial del Capítulo 1 antes de la demo (Subfase 14a-1, ronda 1 de playtest)

**Estado:** ABIERTA. Pedido explícito del operador, 2026-08-31. **Bloquea la Fase 15 (demo).**

`CHAPTER_01_INITIAL_ATOMIC_STOCK` (`engine/src/crisis/campaign/chapter-01-primer-aviso.ts`) se infló para
poder playtestear el eje térmico con varias pruebas simultáneas en la misma pantalla:

| Pieza | Antes | Ahora | Para qué |
|---|---|---|---|
| `indicador-led` | 1 | **6** | un LED por sensor y que sobre |
| `chip-circuito-generico` | 0 | **8** | receta del sensor térmico (×2 c/u) |
| `placa-disipadora` | 0 | **4** | receta del sensor térmico (×1 c/u) |

Son **4 sensores térmicos** construibles. Contradice de frente el diseño austero del capítulo — el loop
"sin stock → inspeccionar → desarmar → reutilizar" que justifica el resto de esa lista y que es la lección
que el Cap. 1 tiene que enseñar. Es deuda de balance asumida a cambio de poder verificar el eje.

Cuando 14a-2 esté cerrada y el eje térmico validado: bajar estas tres entradas y **re-evaluar los niveles**
(no solo este capítulo — el operador pidió revisar el nivelado en general antes de publicar).
