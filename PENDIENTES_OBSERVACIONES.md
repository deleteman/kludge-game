
> **Triaje de 2026-08-21:** todos los puntos abiertos de este archivo tienen ahora fase asignada en
> `nuevo-orden.md`. El grueso de UI/UX y bugs de input vive en la **Subfase 14d** ("Bucket de UI/UX y Bugs de
> Playtest — Pre-Demo"), creada en ese triaje porque la Fase 12 está cerrada entera y no había dónde ponerlos.
> Cada punto de abajo dice su destino en su propia línea. Ningún ítem abierto queda sin fase.

## Observaciones

0. No hay una historia, debería haber una historia definida, con una intro, con algo que muestre lo que está pasando ANTES de ver el plano de la nave? Tal vez un par de escenas con texto que se escribe y cuenta lo que está pasando. Un reporte de incidente? 
   → **Fase 15 (Demo)**, pendiente de ciclo de diseño narrativo propio (no existe ningún sistema narrativo previo en el proyecto).
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

17. El puntero del mouse debería estar con la misma imagen que se pone sobre los botones en su estado default. Ahora mismo, salta abruptamente entre el puntero del sistema y el puntero de los botones.
   → **Subfase 14d, Bloque 2.** No es obra nueva: `game/src/ui/custom-cursor.ts` existe desde 12c pero solo está
   cableado en `floorplan-scene.ts`; title/crew-select/hub/workbench/options usan el puntero del sistema. Falta
   cursor por defecto global + revisar el `setDefaultCursor("default")` que lo revierte en `floorplan-scene.ts`.

## Deuda técnica detectada (fuera de alcance de la fase en curso)

Hallazgos anotados al pasar, sin fase asignada. Cada entrada dice qué está mal,
dónde, y qué costaría arreglarlo.

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
23. **Las claves i18n `ui.menu.workbench.mode-chemistry`/`mode-physical`/`chemistry-hint` quedaron sin
    consumidor** (Subfase 13e). El toggle libre Física/Química de la mesa se eliminó al pasar el modo a
    depender del aparato desde el que se abre (Obs 4), pero las claves siguen en `es.ts`/`en.ts`. Se dejan
    porque son inofensivas y la auditoría total de i18n es la Fase 22c — anotado para que esa auditoría las
    encuentre en vez de dar por hecho que se usan.
    → **Fase 22c** (ya listado en el texto de esa subfase).

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

**Actualización 14a-2 (2026-08-31):** se le dio `footprint` a tres compuestos más
(`sistema-refrigeracion-muestras`, `tanque-muestra-criogenica`, `reservorio-disolvente`) porque el escenario de
acoplamientos térmicos los necesitaba colocables. Sigue siendo **el caso puntual, no la clase**: quedan ~21
compuestos invisibles. La deuda sigue ABIERTA y sigue dependiendo de decidirse junto con la #43.

`footprint` es opcional en compuestos POR DISEÑO (`composite-component-spec.types.ts:25-33`: los compuestos
pre-Fase-7 se instalan solo vía mesa de creación, que calcula su propio footprint), así que la salida no es
obvia. Dos evaluadas:
- **Fila bloqueada con motivo `no-footprint`**, coherente con "nunca dejarlo en silencio" de CLAUDE.md. Pero
  suma ~24 filas grises a una lista que ya es larga, y empeora el picker antes de mejorarlo — depende de que
  exista primero el buscador de la deuda #43.
- **Poblar `footprint` pieza por pieza** en los compuestos que tenga sentido colocar directo en el plano, y
  dejar fuera a los que de verdad solo se fabrican. Requiere pasar el catálogo entero con criterio de diseño.

**Actualización 14a-4 (2026-09-01):** los dos cables COMPUESTOS (`cable-fibra-optica`,
`cable-blindado-alto-amperaje`) salen de esta deuda por un camino distinto al de darles footprint: desde
14a-4 un conductor eléctrico **no se instala en el plano**, se gasta al tender un cable, y su selector
propio no pide footprint. O sea que dejaron de necesitarlo. El resto de la deuda sigue **ABIERTA**: quedan
~19 compuestos invisibles, y sigue dependiendo de decidirse junto con la #43.

**Actualización 14b-1 (2026-09-12):** cuatro compuestos más ganaron `footprint`, y esta vez con un criterio que
recorta la deuda de verdad en vez de parchar el caso: **toda pieza cuyo `triggerType` el motor SIMULA tiene que
ser instalable**. Eran `escaner-espectro` (`spectral`), `sensor-movimiento-laser` (`motion`, simulado desde 13g),
`sensor-presion-gas` (`pressure`, desde 11h) y `tanque-anestesico` (única fuente alcanzable de un TOX gaseoso).
Esa clase quedó **cerrada con un test** en `engine/src/mission/emitter-sensing.test.ts`, así que no puede volver
a abrirse en silencio. Lo que sigue ABIERTO es el resto del catálogo: ~15 compuestos sin `footprint` que no son
sensores, y ahí sí la salida sigue dependiendo de decidirse junto con la #43.

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
| `placa-disipadora` | 0 | **9** | receta del sensor térmico (×1) + enfriador (×2) + tanque criogénico (×1) |

**Actualizado en la Subfase 14b-1 (2026-09-12).** Tercera subida, por la misma razón de siempre — hacer
fabricable un sensor que el motor ya simulaba: `lente-optica` 0 → **6** y `bateria-celda-simple` 0 → **3**
(receta del `escaner-espectro`), y `chip-circuito-generico` 8 → **14** porque pasó a compartirlo con el sensor
térmico. **Ojo al re-nivelar**: `bateria-celda-simple` es `RES(E)`, o sea OFERTA eléctrica (1 `powerUnits` cada
una), así que esas 3 unidades aflojan el presupuesto de energía del capítulo como efecto secundario — no es
solo material de receta. Hay un test que exige que las recetas se paguen **contra el mismo stock**, así que
bajar estos números falla ahí antes que en un playtest.

**Actualizado en la Subfase 14a-2 (2026-08-31).** El operador pidió explícitamente que el escenario de
acoplamientos térmicos se pudiera montar con piezas reales en vez de con contenido scripteado, así que el stock
creció otra vez para pagar las recetas de los tres compuestos que hacen falta:

| Pieza | Antes de 14a-2 | Ahora | Para qué |
|---|---|---|---|
| `placa-disipadora` | 4 | **9** | + 2 enfriadores (×2) + 2 tanques criogénicos (×1) |
| `junta-hermetica` | 2 | **7** | 2 tanques (×2) + 1 reservorio de disolvente (×2) + la fuga sembrada |
| `tubo-flexible` | 1 | **4** | 2 enfriadores (×1) + 1 disolvente (×1) + el reservorio de agua de 13e |
| `valvula-simple` | 1 | **2** | + 1 reservorio de disolvente |
| `motor-pequeno` | 0 | **2** | 2 enfriadores (×1) — **rompe a propósito el "stock 0" deliberado del capítulo** |
| `tubo-rigido` | 0 | **4** | 2 tanques criogénicos (×2) |

**Actualizado en la Subfase 14a-3 (2026-09-03).** El cambio de estado se verifica COMPARANDO salas en estados
distintos (una congelada, una templada, una en ebullición), y el techo real eran DOS reservorios en toda la nave:
el de agua y el de disolvente comparten receta y la válvula simple estaba en 2. Sube a tres montajes simultáneos:

| Pieza | Antes de 14a-3 | Ahora | Para qué |
|---|---|---|---|
| `valvula-simple` | 2 | **6** | 3 reservorios de agua + 3 de disolvente (×1 c/u) |
| `junta-hermetica` | 7 | **14** | los 6 reservorios (×2) + 3 tanques criogénicos (×2) + la fuga sembrada |
| `tubo-flexible` | 4 | **8** | los 6 reservorios (×1) + 3 enfriadores (×1) |
| `tubo-rigido` | 4 | **6** | 3 tanques criogénicos (×2) |
| `motor-pequeno` | 2 | **3** | 3 enfriadores (×1) — única fuente de frío del juego |

**Actualizado en la ronda 1 de playtest de 14a-3 (2026-09-03).** `resistencia-electrica` es material de CABLEADO
desde 14a-4 y no estaba en stock, así que "cableá un tronco con resistencia" era un paso de prueba imposible
(el patrón de la receta que no ejecuté). Entra porque desde esa ronda un conductor DISIPA calor según su carga:

| Pieza | Antes | Ahora | Para qué |
|---|---|---|---|
| `resistencia-electrica` | 0 | **4** | un tronco + tres ramas del cable que llega a estar caliente con la mitad de consumidores colgados |
| `cable-cobre` | 0 | **4** | cargar un conductor por encima de su capacidad y verlo cortarse |

El caso más grave es `motor-pequeno`: estaba a 0 **por diseño**, para forzar el loop "sin stock → inspeccionar →
desarmar → reutilizar" que es la lección del capítulo. Al re-nivelar hay que decidir si el enfriador se paga
desarmando algo (coherente con el capítulo) o si el escenario térmico vive en el Cap. 2 y el Cap. 1 vuelve a su
austeridad original.

**Actualizado en la ronda 2 de playtest de 14a-4 (2026-09-02).** El emisor pasó a tener capacidad de
salida, así que el stock del capítulo ya no se dimensiona solo por "cuántos cables puede tender el
jugador" (criterio de la ronda 1) sino por **cuántos relés puede intercalar**: sin un
`chip-circuito-generico` disponible, un jugador que sobrecarga un sensor no tiene ninguna salida y la
lección se corta a la mitad. Hoy alcanza (chips ×8), pero es una dependencia nueva que el re-nivelado
tiene que respetar: bajar los chips por austeridad rompería la mecánica que 14a-4 acaba de abrir.

Con el estado anterior eran **4 sensores térmicos** construibles. Contradice de frente el diseño austero del capítulo — el loop
"sin stock → inspeccionar → desarmar → reutilizar" que justifica el resto de esa lista y que es la lección
que el Cap. 1 tiene que enseñar. Es deuda de balance asumida a cambio de poder verificar el eje.

14a-2 ya está cerrada y el eje térmico validado, así que esta deuda está **lista para ejecutarse**: bajar todas
las entradas de las dos tablas y **re-evaluar los niveles** (no solo este capítulo — el operador pidió revisar el
nivelado en general antes de publicar).

**Actualización 14a-4 (2026-09-01):** el `cable-cobre` ×4 **deja de ser stock inflado de playtest y pasa a ser
stock de diseño**. Desde 14a-4 tender cualquier cable de señal CONSUME un conductor, así que sin cobre en el
inventario el jugador no puede cablear nada — el capítulo 1 se volvería injugable, no austero. Al re-nivelar,
esa fila se decide por cuántos cables debe poder tender el jugador en el capítulo, no por si sobra o falta
para una prueba puntual. El resto de la tabla no cambia de criterio.

**Actualización ronda 1 de playtest de 14a-4 (2026-09-01):** `cable-cobre` sube a **9** — el operador se quedó
sin cable a mitad del capítulo. Junto con eso, retirar un cable SANO ahora lo devuelve al stock un escalón más
gastado, así que la presión sobre esta fila baja: re-rutear ya no consume material nuevo. Al re-nivelar, medir
el número contra "cuántos montajes distintos debe poder intentar el jugador antes de quedarse sin nada", no
contra el conteo de cables de un montaje.

## Deuda #46 — Un charco derramado no existe como entidad del motor (Subfase 14a-3)

**Estado:** ABIERTA. Limitación conocida, registrada al implementar el cambio de estado.

`TransientGasInjection` es un buffer PUNTUAL: decide en el instante del vertido si la sustancia entra a la
atmósfera o "cae al piso", y lo segundo no se guarda en ningún lado — el charco es solo un decal de `/game`
(`salvage-hazard-effect.ts`), sin estado en el `Blueprint`.

Consecuencia concreta para 14a-3: **derramar en frío y calentar después no evapora nada.** El jugador tiene que
verter con la sala ya caliente, porque el líquido que cayó al piso dejó de existir para el motor en ese mismo
tick. La cadena "cebar una sala y encenderla más tarde" funciona con el vapor YA en el aire (que sí persiste y
difunde), no con un charco esperando.

Qué haría falta: una entidad de charco por celda o por sección, persistida en el `Blueprint`, que el runtime de
fase evalúe cada tick igual que hoy evalúa el contenido de los reservorios. No es trabajo de esta subfase — es un
subsistema con su propio guardado, su propia representación visual y su propio coste de limpieza.

## Deuda #47 — No existe la sobrepresión (Subfase 14a-3, decisión del operador)

**Estado:** DIFERIDA por decisión explícita del operador, 2026-09-03.

El GDD §5.6 dice "sólido → gas puede generar presión/expansión". 14a-3 implementa la expansión, pero el bucle del
sumidero clampea en `PRESSURE_RECOVERY_CEILING_KPA`, que ES la presión estándar: evaporar en una sala sana no
mueve la aguja. Ante las dos opciones el operador eligió la acotada — la expansión sirve para REPRESURIZAR una
sala que quedó baja tras sellar una brecha, y no se abre un eje de daño nuevo.

Lo que queda pendiente si alguna vez se quiere la lectura literal del GDD: un techo de presión POR SECCIÓN (mismo
molde que `SectionPressureFloorSource` de 13f) más un consumidor real del exceso — daño estructural, brecha, o una
puerta que no abre contra la diferencia de presión. Sin ese consumidor, subir el techo sería un número que nadie
lee.

## Deuda #48 — Sustancias con puntos de transición deliberadamente inalcanzables (Subfase 14a-3)

**Estado:** ABIERTA, informativa. No es un bug: es una decisión declarada que conviene no perder.

Las 49 entradas del catálogo químico declaran punto de fusión y de ebullición, pero la ventana térmica realmente
alcanzable del motor va de **-80 °C** (el clamp; lo alcanzan dos reguladores térmicos, uno solo llega a -35.7) a
**~157 °C** (dos troncos de cableado cargados y sostenidos en la sala peor ventilada). Los metales, sales y gases
nobles llevan sus valores reales, muy fuera de esa ventana: son inertes al eje térmico A PROPÓSITO, y sus números
están ahí por trazabilidad, no como mecánica.

**Corregido en la ronda 2 de playtest de 14a-3**: hasta entonces esta deuda decía que el techo era "~161 °C, pico
de una combustión violenta", número despejado de la fórmula de equilibrio que ignora la conducción. El techo real
de una combustión violenta es **109.2 °C** y se disipa; el techo sostenido lo pone el CABLEADO. O sea que se puede
mantener una sala más caliente de lo que se la puede picar, y las sustancias entre 109 y 157 °C (peróxido a 150,
los dos ácidos a 110) sí son alcanzables, pero sólo con un montaje eléctrico deliberado — no con un incendio.

Las que SÍ tienen su transición dentro de la ventana —y por lo tanto son las únicas con las que el jugador puede
jugar hoy— están fijadas por un test: agua, combustible de motor, disolvente volátil y bromo. Si el balanceo de la
Fase 23 mueve `COMBUSTION_HEAT` o `COOLER_RATE_CELSIUS_PER_SECOND`, ese test es el que avisa de que la ventana se
movió y hay que revisar esta lista.

---

## Deuda #49 — El termostato de dev es proporcional y deja error residual (Subfase 14a-3, ronda 2)

**Estado:** ABIERTA, informativa. Decisión consciente, anotada para que nadie la lea como un bug.

La tecla T sostiene una sección con un lazo **proporcional** (`R = (consigna - T_actual) × 10`, clamp ±60 °C/s).
Un lazo proporcional se estabiliza donde la tasa que pide iguala a la que el mundo se lleva, así que siempre
queda un error de `pérdidas / ganancia`: **~1.5 °C** en la peor sala. Una consigna de 120 se lee como 118.6.

No se agrega término integral a propósito: es una herramienta de verificación, 1.5 °C no cambia ninguna prueba
manual, y un integrador mal sintonizado oscilaría con el dt variable del core loop. Si alguna vez la consigna
tiene que ser exacta —por ejemplo para un test automatizado que dependa de cruzar un umbral por 0.5 °C—, el
cambio es subir la ganancia antes que agregar el integrador.

---

## Deuda #50 — El regulador térmico sólo existe por fabricación, y ninguna prueba lo dice (Subfase 14a-3, ronda 2)

**Estado:** ABIERTA, menor. Es un hueco de comunicación, no de motor.

Los dos únicos componentes que el predicado `isThermalRegulatorDefinition` reconoce como enfriadores
(`banco-sangre-fluidos` y `sistema-refrigeracion-muestras`) son compuestos de la **nave médica**, y ninguno está
en el stock del Capítulo 1. El eje de enfriamiento entero —y con él la rama fría de `thermalConductivityRule`,
recalibrada en esta ronda— parece inalcanzable si uno mira sólo la lista de piezas.

**Sí es alcanzable**: 14a-2 stockeó deliberadamente los ingredientes para fabricar `sistema-refrigeracion-muestras`
en la mesa (`placa-disipadora` ×2 + motor ×1 + tubo flexible ×1 + chip ×1). Lo que falta es que el juego lo diga:
hoy sólo consta en un comentario del capítulo. Cuando 14b haga cableable al enfriador, conviene resolverlo con
contenido —una entrada de bitácora o un objetivo— y no dejarlo dependiendo de que el jugador explore la mesa.


## Pregunta abierta #45 — ¿La torreta automatizada debería ser instalable directo del catálogo? (Subfase 14b-1, auto-revisión de cierre)

**Estado:** ABIERTA. Decisión de diseño, no de código. Registrada 2026-09-12.

El test de clase que cerró 14b-1 (`engine/src/mission/emitter-sensing.test.ts`) exige que toda pieza con un
`triggerType` simulado declare `footprint`. `torreta-automatizada` es la **única excepción** y está anotada como
tal en el propio test, no silenciada: el GDD 7.5 la marca como *ensamblaje complejo* y el caso de validación 1
consiste precisamente en armarla en la mesa a partir de un sensor compuesto + un cañón + un soporte. Darle
`footprint` la volvería una fila más del selector y saltearía la composición que la pieza existe para enseñar.

Si el operador decide que también debe poder instalarse directo, el cambio es de una línea (darle `footprint`)
más borrar la lista `WORKBENCH_ONLY` del test. Mientras tanto queda como está.

## Observación #46 — El tanque de anestésico es equipo Médico y aparece en la nave de Investigación (Subfase 14b-1, ronda 1 de playtest)

**Estado:** ABIERTA. Decisión de contenido. Registrada 2026-09-12.

`installableCatalogComposites` **no filtra por arquetipo**: lista todo `ALL_COMPOSITE_SPECS`. Al darle
`footprint` al `tanque-anestesico` para que el Cap.1 tuviera una fuente de contaminante detectable, quedó
instalable en la nave de Investigación, que es la del capítulo. Funciona y no rompe nada, pero es equipo de la
nave Médica apareciendo donde no corresponde por arquetipo.

Dos caminos, los dos de diseño y ninguno urgente:
- Que el Cap.1 tenga su propia fuente de contaminante coherente con Investigación (un reactivo de laboratorio
  **gaseoso**; hoy los reactivos del arquetipo son todos líquidos y por eso no servían).
- Filtrar el selector por arquetipo, que es un cambio más grande y afecta a todo el catálogo.

Relacionado: el **bromo** (TOX líquido, hierve a 59 °C) sería la fuente elegante — derramarlo y calentar la sala
lo evapora, encadenando el cambio de estado de 14a-3 con el sensor de 14b-1. Hoy necesita extracción de
elementos, que el Cap.1 no otorga.

## Observación #51 — El volcado completo de un reservorio tóxico solo es purgable bajo el umbral del sensor en salas chicas (Subfase 14b-2, ronda 1 y 2 de playtest)

**Estado:** ABIERTA. Decisión de contenido, no de código. Registrada 2026-09-24.

Medido contra la nave canónica de Investigación (298 celdas, 11 secciones): volcar el tanque de anestésico
completo (80u) y dejar que la válvula automática purgue (120u a 2u/s) solo baja la concentración bajo el
umbral del sensor químico (0.05) en la **esclusa** (6 celdas: pico 0.910, purga a los 37s con 46u restantes).
El resto de las secciones (20-52 celdas) queda en 0.054-0.064 sin importar cuánto suba la capacidad de la
válvula — el piso de equilibrio de nave completa es 80×0.2/298 = 0.0537, por encima del umbral. La sustancia
no desaparece (principio 5), solo se redistribuye, así que en una sala grande el lazo sensor→válvula→purga
nunca cierra con este tanque.

Además, el pico de 0.910 en la esclusa es MUY superior al umbral letal (0.6): un tripulante que se queda en la
sala durante el vertido muere casi al instante, confirmado en playtest real.

Dos caminos, los dos de diseño y ninguno urgente:
- Bajar la capacidad del tanque de anestésico (o su tasa de vertido) para que el pico quede por debajo de lo
  letal y el lazo cierre en salas más grandes que la esclusa.
- Dejarlo como está: es una crisis real con una ventana de reacción corta, y el escenario de demo del Cap.1
  puede estar pensado justo para la esclusa.

## Pregunta abierta #52 — ¿Unificar `workbench-renderer.ts` con la distinción forma+color de nodos de señal? (Subfase 14b-2, ronda 1 de playtest)

**Estado:** ABIERTA. Registrada 2026-09-24.

La ronda 1 de playtest de 14b-2 le dio a los nodos de señal del PLANO una forma por rol además de color
(`signalNodePresentationRole`, `SIGNAL_NODE_PRESENTATION_COLORS`) — antes solo tenían color
(`SIGNAL_NODE_COLORS`), y la salida de un actuador compartía el amarillo del emisor de un sensor. La MESA DE
CREACIÓN (`game/src/render/workbench-renderer.ts`) sigue dibujando sus nodos con la tabla vieja, sin la
distinción nueva. CLAUDE.md (principio 7) pide que plano y mesa compartan la misma lógica de grid/conexión —
no se tocó porque no fue parte del alcance reportado por el operador, que probó el escenario en el plano.
