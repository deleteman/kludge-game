# Historial de subfases cerradas (Fases 11 a 13)

Cuerpo completo de las subfases ya cerradas, movido fuera de `ORDEN_DE_TRABAJO.md` para que leer
la fase activa no cueste el historial entero. El índice con una línea por subfase sigue en
`ORDEN_DE_TRABAJO.md`. Las Fases 0 a 13 en su formato anterior están en `fases-00-13-cerradas.md`.

---

#### Subfase 12d: Sombras Dinámicas ✅ CERRADA (2026-08-24)

**Cierre (12d.5, 2026-08-24):** los tres ítems del spec de abajo quedaron resueltos. El ciclo de preguntas
técnico se respondió en 12d.1-12d.4 (raycast/oclusión real, no Light2D). Obs 16 se resolvió sin migrar a
`scene.lights`: depth nuevo `dynamicLight` (1.8) para la luz de ambientación + tinte por nivel de luz
(`render/shadows/light-grid.ts` + `light-shading.ts`) para que el sprite reaccione a su sección. La deuda #16
residual se cerró con `EventEffectOptions.onObjectCreated` (que 13e ronda 4 ya había agregado), extendida a
los 15 efectos del registro. Detalle en `changelog.log` y `ORDEN_DE_TRABAJO.md`. Autorar la capa `luces` en
los otros 3 arquetipos queda como pendiente #35 (depende del arte de esas naves, no de esta subfase).

Pedido del operador tras el playtest de 12a: "no veo sombras de los elementos en el mapa, ya sea de las cosas
en la capa `objects` autoradas en Tiled, o de los componentes que se ponen en el mapa y con los que puede
interactuar el jugador". Explícitamente **no** son sprites de sombra estáticos (el blob/óvalo oscuro fijo bajo
cada sprite, técnica barata típica de pixel art) — el operador pidió sombras DINÁMICAS, porque con 12a ya
existen varias fuentes de luz que se mueven/parpadean en tiempo real (chispas de conductor sobrecargado, luz
ambiental de sección sin energía, flash de electrocución) y esas sombras deberían reaccionar a esas luces, no
quedar fijas.

**Consideración técnica a resolver antes de plan de implementación** (por qué esto es una subfase aparte y no
un ajuste de 12a): Phaser 3 no tiene sombreado 2D dinámico nativo atado a `PointLight` — el pipeline `Light2D`
(`scene.lights`) sí soporta sprites con normal maps reaccionando a luces, pero es un sistema distinto del que
ya usa el proyecto para `PointLight` (`game/src/particles/effects/dynamic-light.ts`, Fase 12a) y no proyecta
sombras arrojadas por geometría — solo sombreado de superficie. Sombras arrojadas reales (oclusión de luz por
un objeto) requerirían algo como raycasting 2D por objeto/luz o un enfoque de shadow-map, no hay precedente en
el proyecto. Antes de planificar la implementación hay que decidir, con su propio ciclo de preguntas
(CLAUDE.md, "minimizar assumptions"):
- Alcance visual: ¿sombreado de superficie (Light2D + normal maps, más barato, no oclusión real) o sombras
  arrojadas verdaderas (oclusión, más caro, requiere raycasting/shadow-map)?
- Qué proyecta sombra: ¿solo componentes colocados por el jugador, o también objetos estáticos de la capa
  Tiled `objects`? ¿Tripulación/enemigos?
- Costo de rendimiento aceptable — cuántas fuentes de luz dinámicas simultáneas se esperan en una misión real
  (hoy: cicatriz de sobrecarga + cicatriz de sección sin energía + bursts puntuales, un número bajo, pero sin
  límite modelado).
- Si la respuesta es sombreado de superficie (Light2D), migrar `dynamic-light.ts` de `PointLight` a
  `scene.lights` sería un cambio de arquitectura sobre TODO lo entregado en 12a, no una extensión — impacto a
  dimensionar antes de comprometerse.

No implementar sin ese ciclo de preguntas — anotado acá para no perder el pedido, siguiendo el mismo criterio
que otros ítems diferidos de este documento (ver Subfase 11h → 12a → "Potenciar Indicador LED").

**Sumado en el triaje de 2026-08-21** (dos ítems de `PENDIENTES_OBSERVACIONES.md` que son del mismo dominio de
depth/registro de luces y deben entrar al mismo ciclo de preguntas, no resolverse sueltos):

* **Los sprites de componentes no reaccionan a la luz/sombra de la sección (Obs 16).** El reporte original decía
  que los sprites se dibujan *encima* de la capa de luces; verificado en código, es al revés: las sombras
  dinámicas están bien (`RENDER_DEPTH.dynamicShadows` = 1.7, por debajo de `objects` = 2) pero **todos los
  `PointLight` se registran a `RENDER_DEPTH.effect` = 7** (`registerLight`, `floorplan-scene.ts`), o sea por
  encima de paredes (5) y de los sprites (2) — luz aditiva pintada sobre todo, que es lo que se lee como
  "lavado" y como "el sprite no recibe luz". Cualquier decisión de esta subfase (seguir con `PointLight` o
  migrar a `scene.lights`) cambia la respuesta, por eso no se parchea el depth por separado.

* **`combustion-effect.ts` no registra su `PointLight` con el `LightHook` de 12a (deuda #16 residual).** El
  burst no pasa por `hudCamera.ignore()`. Se evaluó y descartó a propósito en 13a (exigía extender la firma de
  `EventDrivenEffect.trigger` para los ~10 efectos ya registrados), pero desde 13a el burst **se dispara en
  partida real**, no solo en la galería de partículas, así que el riesgo dejó de ser teórico.




#### Subfase 12e: Contrato de Semántica de Color de Diagnóstico ✅ CERRADA (2026-07-31)

Ítem de pulido sensorial surgido de la evaluación de comparativas (deuda `PENDIENTES_OBSERVACIONES.md` #15). Es su propia subfase porque 12a ya está cerrada y este es un contrato transversal, no un ajuste puntual de una pieza.

* **Contrato de color único:** Definir un lenguaje de color coherente para el estado de crisis (rojo = fatal/sin O2, ámbar = escalable, cian/blanco = seguro — la tabla de diagnóstico de FTL/Barotrauma) y auditar `palette.ts`, el Indicador LED (11h, hoy parcheado a ámbar caso por caso), el HUD de estado (11g) y los tags contra ese contrato. Hoy el verde reservado a "todo bien" se reusaba para alarmas — semánticamente al revés. Al ser transversal, toca varias superficies ya entregadas (LED, HUD, tags), de ahí que sea un cierre de consistencia y no obra nueva de una pieza.

  **Cerrada:** contrato canónico en `palette.ts` (Eje A: `CRISIS_FATAL/WARNING/SAFE_COLOR` + `INFO_NEUTRAL_COLOR`, con espejos CSS); consolidados los 3 rojos y el ámbar reusado; `healthFractionColor`/LED/core-loop/condición/estructura/timer/válvula derivan del contrato; `notification-center` deja su tabla local. Segundo eje ortogonal de categoría de tag (`TAG_CATEGORY_COLORS`) aplicado a tags funcional/material (antes texto plano). Test de regresión `palette.contract.test.ts` (el LED nunca vuelve a verde). Decisión: el verde SIGUE siendo "seguro" (no se adopta el cian/blanco literal de FTL); el LED solo se re-etiqueta, su estado rojo/umbral sigue diferido a la deuda #15. Smoke visual in-game pendiente de playtest del operador.




#### Subfase 12f: Fixes de Playtest de 12d ✅ CERRADA (2026-08-03)

Bucket de fixes puntuales surgidos del playtest, siguiendo la convención de la Subfase 12c.7 ("Fixes de playtest"). Recoge observaciones abiertas de `PENDIENTES_OBSERVACIONES.md` (Obs 3, Obs 7, deuda #5).

* **Tripulantes se mueven en pausa (Obs 3):** los saltos de tripulación usan tweens de Phaser (`hopMove`, `game/src/crew/hop-movement.ts`) y nada los pausa al entrar en modo planificación — `floorplan-scene.ts` no pausa/reanuda esos tweens con el cambio de `coreLoop.mode`. Pausar/reanudar los tweens de movimiento de tripulación (y enemigos) sincronizados con `execution`/`planning`, mismo criterio ya aplicado al flujo de conductos en 11f.7.
  **Resuelto:** `FloorplanScene.activeHopTweens` (`Set<Phaser.Tweens.Tween>`) trackea cada salto en vuelo (poblado en `chainHops`/`stepAsideCrewToken`/el fallback `hopEnemyToken`, auto-removido al completar); `update()` lo pausa/reanuda cada frame según `coreLoop.mode`.

* **Modo pantalla completa queda en negro (Obs 7):** el toggle de fullscreen deja la pantalla en negro sin errores en consola. Investigar el toggle (`options-scene.ts`, `scale.FIT` + `toggleFullscreen`, Fase 9.5) y el redimensionado de cámaras (mundo + `hudCamera`).
  **Resuelto:** faltaba `scale.parent`/`scale.fullscreenTarget` en `main.ts` — Phaser insertaba el canvas suelto en `<body>`. Contenedor `#game-root` con tamaño explícito (`index.html`) como referencia estable; `BootScene` fuerza `scale.refresh()` en `ENTER_FULLSCREEN`/`LEAVE_FULLSCREEN`.

* **Proyectil suelto pierde su sprite de catálogo (deuda #5):** `LooseFerromagneticPromoter` (`engine/src/mission/loose-ferromagnetic-promoter.ts`) registra el `ProjectileBody` con `ref: placedComponentInstanceId` en vez del `componentDefinitionId`, así que `projectile-renderer.ts` cae siempre al círculo placeholder aunque el sprite de la pieza exista. Conservar el `componentDefinitionId` accesible al renderer (mapa `ref→componentDefinitionId` en `MissionRuntime`) sin ensuciar `ProjectileBody`/`kinetics/`.
  **Resuelto:** `definitionByRef`/`definitionIdForRef(ref)` en el propio `LooseFerromagneticPromoter` (expuesto vía `MissionRuntime.loosePromoter`, ya público). `renderProjectileTokens` recibe el resolver y dibuja el sprite real (`componentTextureKey`/`hasComponentSprite`) antes de caer al placeholder. Test unitario nuevo en `loose-ferromagnetic-promoter.test.ts`.
  **Fix post-QA del operador (mismo día):** al validarlo en partida real apareció un bug nuevo — la pieza se veía DOBLE (sprite fantasma de celda completa, sin poder seleccionarlo/desmontarlo, + token pequeño correcto). Causa: la promoción pasa en el mismo tick que completa la instalación, pero DESPUÉS de que `redrawOverlay()` ya dibujó la pieza como componente fijo. `FloorplanScene.knownProjectileRefs`/`syncNewlyPromotedProjectiles` detecta el `ref` nuevo cada frame de ejecución y fuerza `redrawOverlay()`. Confirmado por el operador; revertido el stock temporal de QA (`pieza-hierro` en `CHAPTER_01_INITIAL_ATOMIC_STOCK`).




#### Subfase 12g: Pulido de Pantallas de Selección ✅ CERRADA (2026-08-03)

Pulido de UI de meta-menú (pantallas de Fase 9.5), coherente con 12c (personalidad de la UI). Recoge los ítems de fine-tunning de `PENDIENTES_OBSERVACIONES.md` sobre las pantallas de arranque de campaña. Da personalidad y "sensación profesional" a los primeros minutos.

* **Tarjetas de selección de tripulación (`crew-select-scene.ts`):** una tarjeta por tripulante con foto, nombre, personalidad (rasgo), rol/especialidad y descripción. Reutiliza el roster real (`CrewSpecialty`/`PersonalityTrait`/`CrewTier`, Fase 9). Si faltan sprites de retrato, avisar explícitamente con su ruta esperada (convención CLAUDE.md, `game/assets/sprites/crew/`).

* **Datos de nave en selección de arquetipo (`archetype-select-scene.ts`):** por cada nave, nombre propio (no del arquetipo), imagen exterior para dar color a la elección, su arquetipo y una descripción con los + y los − (ej. + armamento, − sensores). Reutiliza `SHIP_ARCHETYPES`. Avisar de sprites de nave faltantes con su ruta esperada.

  **Cerrada:** tarjetas de tripulación (`crew-select-card.ts`, grilla 2 columnas) reutilizando los retratos de `crew-portrait-registry.ts` y las descripciones i18n `crew.<slug>.description` que ya existían sin consumidor; nuevas claves `crew.specialty.*`/`crew.trait.*`/`crew.tier.*`. Tarjetas de arquetipo (`ship-archetype-card.ts`, grilla 2×2) con nombre propio/descripción/pros-cons redactados como placeholder por Claude (`SHIP_ARCHETYPE_METADATA` + claves `ship.<archetype>.properName/.description/.pro.N/.con.N`), imagen exterior con fallback de color (`ship-image-registry.ts`, carpeta `game/assets/sprites/ships/` creada vacía — **faltan los 4 sprites reales**, uno por arquetipo, ruta `game/assets/sprites/ships/<archetype>.png`). Alcance ampliado con aprobación del operador: `title-scene.ts` gana entrada escalonada (`popIn`) en sus 6 botones + `fadeIn` de cámara; de paso corrigió un bug preexistente donde el botón "Continuar" (creado dentro de una promesa) quedaba dibujado encima de "Salir". Verificado visualmente con Playwright headless (3 pantallas + interacción de selección), sin errores de consola; 570 tests de `/engine` y 29 de `/game` verdes, `tsc --noEmit` limpio.




#### Subfase 13a: Simulación de Emisores y Cascada de Fallas Emergente ✅ CERRADA (2026-08-04)

Resuelve dos deudas técnicas registradas en `PENDIENTES_OBSERVACIONES.md` (#3 emisores siempre disparados, #16 reacciones químicas sin llamador de producción en misión) que, juntas, impiden que las fallas se encadenen de forma **emergente** — el mayor logro de Barotrauma (agua conductora → cortocircuito → sobrecarga → incendio). Sin esto, las cascadas de crisis son secuencias scripteadas en la `CrisisDefinition`, no propagación real entre sistemas, y la lógica de señales del Cap.2 (Fase 14) no puede depender de que un sensor se dispare de verdad. Es infraestructura de motor de máxima prioridad: desbloquea contenido posterior.

* **Simulación de Emisores (deuda #3):** Reemplazar `allEmittersActive` (`engine/src/mission/mission-signal-runtime.ts`), que activa TODOS los nodos emisores cada tick, por una evaluación real de `EmitterProperty` (`range`/`triggerType`/`frequency`) contra el mundo — un sensor de movimiento comprueba si hay un tripulante/enemigo en su rango. Se enchufa en el `EmitterInputSource` ya inyectado, sin reescribir el runtime. Desbloquea cualquier capítulo cuya lógica dependa de que un sensor se dispare de verdad (Cap.2 en adelante).

* **Runtime de Reacciones Químicas en Misión (deuda #16):** Añadir a `MissionRuntime` el llamador de producción que hoy no existe para `ReactionResolver`/reglas de combustión (`engine/src/chemistry/reaction/rules/combustion.ts`) — igual que `OverloadRule` ya se evalúa en vivo. Esto dispara `CombustionEvent` en partida real (no solo en tests), habilitando `combustionEffect` y que el overlay de alerta de pantalla completa reaccione a incendios reales. Revisar de paso si el `PointLight` de `combustion-effect.ts` necesita el `LightHook` de 12a.

* **Cascada Emergente:** Con emisores simulados + química en vivo + `OverloadRule` ya existente, permitir que una falla propague a otra por el estado compartido del mundo, sin scriptear la secuencia. Añadir su test de integración (una falla dispara la siguiente sin definición explícita del encadenamiento).


#### Subfase 13b: Presupuesto de Energía de la Nave (Gap ③, estilo FTL) ✅ CERRADA (2026-08-05)

Realiza el sistema de energía que 11g dejó como stub ("no existe ningún sistema de energía `PowerGrid`/`EnergyGrid`… sentar las bases mínimas"). Convierte el triaje de recurso escaso de FTL en un sistema propio, reconciliado con el modelo físico de canibalización de Kludge. Es el substrato del sacrificio de energía del Cap.5 (Fase 18). Diseño cerrado en ciclo de preguntas 2026-07-29.

* **Dominio de Energía (motor):** Nuevo `engine/src/power/` con un presupuesto total = suma de las **unidades discretas** que aporta cada fuente conectada (reactor + baterías + panel solar, `RES(E)`). Canibalizar/conectar una fuente extra sube el total.

* **Reparto en dos niveles:** (1) **global → sección**: el jugador asigna bloques de unidades enteras por sección; lo no asignado deja la sección a oscuras (triaje manual). (2) **sección → componentes**: cada componente tiene una prioridad manual (set-and-forget); el pool de la sección alimenta a los componentes en orden de prioridad hasta agotarse; los que quedan bajo su umbral no arrancan.

* **Reconciliación con cicatrices:** una sección cicatrizada (Cap.5 / 11b) queda permanentemente fuera de la grilla; el reparto vivo opera sobre el resto. `unpoweredSectionIds` pasa de flag de cicatriz a **consecuencia del presupuesto + cicatriz permanente** — reconciliar ambos sentidos.

* **Capa de Energía en el Plano (UI):** Nueva capa del toggle de 11f con **heatmap** de demanda vs. suministro; el dial de reparto por sección es discreto (+1/−1 unidad), operado en modo pausa. Sin panel de barras abstracto — anclado al plano, mitigando el riesgo que el GDD §16 marca. La prioridad por componente se fija reordenando los componentes en el inspector de la capa.

* **Estado dinámico:** la asignación de unidades y las prioridades por componente se serializan (encaja en el guardado de 11b, bump de schema).

* *Nota de consistencia:* el conteo de unidades es una excepción **deliberada** a la escala cualitativa bajo/medio/alto del resto del motor (§5.2) — contar 1/2/3 unidades es distinto de exponer porcentajes exactos, asumido como tal.

* Test unitario del reparto (déficit global + triaje interno por prioridad) antes de integrar.


#### Subfase 13c: Degradación Funcional de Componentes (Gap ①) ✅ CERRADA (2026-08-05)

Cierra el hueco de "hardware frágil" de Duskers y refuerza el Pilar 2 (consecuencias permanentes): una pieza canibalizada no entra como de fábrica. Depende del guardado/schema de 11b (la condición es estado dinámico). Diseño cerrado 2026-07-29.

* **Campo de condición (motor):** Añadir `condition` cualitativo por instancia (`nuevo`/`usado`/`degradado`/`crítico`) en `blueprint.types.ts`, ortogonal a `RE` y a las propiedades funcionales. Bump de `schemaVersion`.

* **Efecto = fragilidad, no eficiencia:** una pieza degradada mantiene su función completa pero es más frágil — la condición aplica un **modificador sobre la RE efectiva ya existente** (no un segundo campo de RE) y sube la probabilidad de fallo catastrófico en `OverloadRule`/forzado de conductor. Decisión explícita: **no** reduce potencia/eficiencia (se descartó el nerf funcional del "80%" literal de Duskers).

* **Escritores de condición:** (1) desmontar+reinstalar baja un escalón, probabilístico por tier del Ingeniero (reusa la lógica de §6.5); (2) exposición a una sustancia `CORR` en el tiempo baja la condición (tick en el dominio químico/atmósfera). **No** por sobrecarga previa (descartado).

* **Prerrequisito — agregación de material en creaciones (deuda `PENDIENTES_OBSERVACIONES.md` #6):** `nameAndRegisterCreation` (`engine/src/workbench/creation-naming.ts`) agrega hoy la unión de propiedades FUNCIONALES de las partes pero **no** las de MATERIAL (`RE`/`MAG`), así que una creación instalada no tiene `data.material` y no se corroe ni se detecta ferromagnética. Como el escritor de condición (2) depende de la exposición `CORR`, una creación necesita heredar material para poder degradarse. Al resolver, **decidir la regla de agregación** (¿RE = máximo/suma/armazón?, ¿MAG si CUALQUIER parte es MAG?) y testearla junto al caso correspondiente.

* **UI:** tag `[DEGRADADO]` en ámbar en el inspector + tinte/ícono en el sprite.

* Test unitario del modificador de RE + riesgo por condición; integración "canibalizar deja la pieza frágil".


#### Subfase 13d: Riesgo Sistémico al Desmontar (Gap ②) ✅ CERRADA (2026-08-05)

Cierra el hueco de "riesgo al canibalizar" de Shipbreaker (cortar una tubería viva = hazard). Distinto de la pérdida de material (§6.5, coste de tiempo/piezas): es un hazard **puntual en el acto de desmontaje** según el estado vivo de la pieza. Depende de 13b, que define "pieza viva" con precisión (= recibiendo ≥1 unidad de energía). Diseño cerrado 2026-07-29.

* **Precondición de desmontaje seguro (motor):** en `ship-task-effect.ts` (resolución de desmontaje), evaluar si la instancia está viva (recibiendo energía / reservorio con contenido / sustancia peligrosa) y no fue purgada → emitir evento de dominio (`spark`/`leak`/`spill`) para `/game`.

* **Flujo evitable (tarea previa):** nueva `TaskEffect` de "cortar energía a sección" / "cerrar válvula / purgar reservorio" que marca la pieza como segura de desmontar. El jugador la encola antes; encaja en el grafo de dependencias del core loop (desmontar depende de purgar), premiando planificar en pausa.

* **Doble filo:** el mismo evento queda disponible como herramienta **deliberada** (provocar el chispazo, ligado a la trampa-de-chispa §5.5 / caso de validación 8).

* Test: desmontar conductor energizado sin purga → evento de chispa/combustión; con purga previa → seguro.

  **Cerrada:** dominio nuevo `engine/src/salvage/` con las reglas como Strategy (tres condiciones ortogonales:
  energizada → `dismantle-spark`, reservorio con contenido → `dismantle-spill`, atmósfera comprometida →
  `dismantle-leak`) y la evaluación PURA compartida por el efecto de tarea y por la UI. Dos tareas de asegurado
  (`cut-power`, `purge-reservoir`); la fuga atmosférica no tiene tarea propia, se evita arreglando la sección.
  Estado "seguro" DERIVADO del mundo, sin flag ni bump de `schemaVersion` (re-asignar energía vuelve a hacerla
  peligrosa). Consecuencias: ignición real + daño no letal al tripulante + un escalón extra de desgaste; el
  daño a la vida de la sección queda para 13f (los eventos ya llevan `sectionId`/`position`). El doble filo se
  validó extendiendo el **caso 8** con la chispa REAL en vez del `ignitionPresent: true` literal. De paso,
  `composePressureSinks` cubre el hueco #5 relevado por 13f. UI: badge ámbar (contrato 12e) + botones de
  asegurado, tres efectos de partículas distintos, i18n en es/en. `/engine` 679 → 707 tests.

* **Extensión diferida (fuera de 13b/13d): `powerDraw` en `EmitterProperty`/`ReceptorProperty`.** Hoy solo
  `ActuatorProperty` tiene costo eléctrico; un sensor/receptor nunca deja de funcionar por falta de energía.
  Extenderlo exige decidir qué sensores lo requieren y balancear el presupuesto inicial de cada capítulo ya
  jugable (Cap.1/2) para que sigan siendo resolubles — mismo criterio de "no re-balancear contenido validado
  sin ciclo de preguntas propio" que otros ítems diferidos de este documento (ver 12d, 11h→12a). Surgió en la
  revisión de la ronda 2 de playtest de 13b; el operador confirmó dejarlo diferido de ese plan.

  **El canal de visualización ya está construido** (verificado en la ronda 5 de playtest, ante la pregunta del
  operador "¿cómo afecta si tengo 7 elementos consumiendo energía dentro de esa zona?"): el inspector de
  "Prioridad" (`game/src/ui/widgets/power-priority-list.ts`, abierto desde cada sección en la capa "energia")
  ya lista los componentes de la sección y pinta en ámbar los que quedaron sin alimentar, leyendo
  `MissionPowerRuntime.isInstancePowered`. Lo único que falta es el DATO: al autorar `powerDraw` en el
  catálogo, ese inspector pasa a responder solo, sin UI nueva. Al hacerlo, revisar si además hace falta un
  indicador a nivel de sección en el plano (hoy el efecto ambiental de "sin energía" es binario: 0 unidades
  otorgadas o no) para distinguir "sección sin nada" de "sección a media máquina".


#### Subfase 13e: Destino Real de Sustancias — Reservorios, Extracción y Estación Química ✅ CERRADA (2026-08-06)

Agrupa Obs 4 + deudas #9 y #10 de `PENDIENTES_OBSERVACIONES.md`: hoy una sustancia sintetizada (11c.3) se resuelve y queda `available` pero no puede verterse en nada ni tiene ubicación propia en el plano. Es el mismo sistema — dar un destino real a las sustancias. Substrato del Cap.7 (Fase 20, neutralizante sintetizado en la mesa). **Pendiente de su propio ciclo de preguntas** antes de plan de implementación (mismo criterio que 12d / "Potenciar LED"): exige decidir si `ReservoirProperty` se extiende con sustancia+cantidad o si el estado vive en un runtime aparte paralelo a `MissionAtmosphereRuntime`.

* **Estación química dedicada (Obs 4):** la síntesis deja de estar disponible libremente; se hace desde un aparato específico ("estación química", nombre a definir) cuyo menú contextual (panel de acciones de 11g) es "Fabricar sustancias" / "Desmontar".

* **Reservorio con sustancia+cantidad y mecánica de extracción (deuda #9):** extender `ReservoirProperty` (`engine/src/properties/functional.types.ts`) — o un runtime aparte — con `substanceId`/`amount`; añadir la mecánica de extracción de elementos (GDD 5.4.1) en vez de ofrecer el `ELEMENT_CATALOG` completo sin restricción de inventario. Habilita verter la sustancia en un reservorio o aplicarla sobre una atmósfera/hazard.

* **Caudal de fluido real (deuda #10):** la capa `fluido` del plano anima hoy con una heurística sin dato de caudal (`conduit-flow-heuristics.ts` reutiliza el booleano de energía). Al existir transporte de fluido/reservorios entre secciones, alimentar la capa con el dato real de caudal.

* Test unitario del vertido/extracción antes de integrar; caso de validación ligado al Cap.7.

  **Cerrada:** ciclo de vida completo de una sustancia — *extraer → sintetizar → almacenar → transportar →
  aplicar*. Decisión de fondo del ciclo de preguntas: NO se extendió `ReservoirProperty` ni se creó un runtime
  paralelo (la disyuntiva que planteaba el texto original), porque `Blueprint.reservoirContents`
  (`{componentInstanceId, substanceId, amount}`) ya modelaba sustancia+cantidad y ya se serializaba — solo le
  faltaban ESCRITORES. Sin bump de `Blueprint.schemaVersion`; sí de `CampaignSaveState` (4→5).

  - **Aparato (Obs 4):** propiedad funcional nueva `FAB` (`FabricatorProperty {tag:"FAB"; domain}`, GDD §5.1
    actualizado) + dos compuestos nuevos (`banco-de-trabajo`, `estacion-quimica`, `catalog/composite/taller.ts`)
    sembrados en los 4 arquetipos (`initial-ship-state.ts`, celdas verificadas contra el mapa real en
    exploración). El botón MESA global del header desapareció: la mesa se abre desde el panel contextual del
    aparato y entra ya fijada a su dominio (el toggle libre Física/Química se eliminó). La estación declara
    además `RES(L)` = su reservorio de SALIDA, donde la síntesis deposita.
  - **Inventario + extracción (deuda #9):** `ElementStock` + `element-ledger.ts` (sin buckets de desgaste: una
    sustancia no acumula historia) y tarea `extract-elements`, que descompone la sustancia de un reservorio por
    su receta de catálogo o, si es una "Mezcla sin identificar", por la **procedencia** registrada al
    sintetizarla. **Precondición: la sustancia debe estar analizada** — `analyze-substance` (11e) pasa de flavor
    a puerta real y gana su segundo consumidor. La paleta química deja de ofrecer el `ELEMENT_CATALOG` completo:
    muestra unidades disponibles y se deshabilita a cero. Cap.1 arranca con `elementStock` vacío.
  - **Destinos:** tres tareas nuevas (`transfer-substance`, `apply-substance`, `extract-elements`) con el patrón
    de 13d. `apply-substance` es el **primer escritor real de un `ChemicalSubstanceId` en `atmosphere.gases`**
    (`section-gas-injection.ts`) — todo el camino LECTOR (`contaminantAt`, `sectionCorrosiveLevel`,
    `HazardousAtmosphereHazardRule`) existía desde 13a sin nadie que escribiera. El gas entra DESPLAZANDO al
    resto, con la suma de fracciones acotada a 1.
  - **Alcance de trasvase:** `assertFluidTransferReachable` es el espejo exacto de `assertSignalWiringReachable`
    reutilizando `sectionsConnectedByConduit(..., "fluido", ...)`: intra-sección libre, cross-section exige
    conducto. Un reservorio contiene UNA sustancia a la vez — verter otra se rechaza y hay que purgar antes
    (`purge-reservoir` de 13d gana un segundo uso).
  - **Caudal real (deuda #10):** `FluidOperationRegistry` publica las operaciones EN CURSO (trasvase, vertido,
    extracción, purga) enganchadas al ciclo de vida de la tarea; `conduit-flow-heuristics.ts` deja de reutilizar
    el booleano de energía. Sin operación viva el conducto queda quieto — correcto, mismo criterio que 11f.4
    para `senal` en calma. Autorados 2 conductos `fluido` en `nave-exploracion` (bodega-carga y soporte-vital a
    la red existente).
  - **Persistencia:** `elementStock` + `substanceProvenance` + `analyzedSubstanceIds` en el guardado
    (`schemaVersion` 5, migración "campo ausente ⇒ vacío"). Las sustancias en reservorio persisten solas.
  - `/engine` 833 → 843 tests; `/game` 36; `tsc --noEmit` limpio en ambos.
  - **Sprites:** el operador colocó `banco-de-trabajo.png` y `estacion-quimica.png` en
    `game/assets/sprites/components/` durante la sesión; los descubre solo `component-sprite-registry.ts`.
    Smoke visual in-game (incluido el encuadre 2×2) pendiente de playtest del operador.
  - **Fuera de alcance a propósito** (anotado en `PENDIENTES_OBSERVACIONES.md`): mezclar dos sustancias dentro
    de un reservorio, y un runtime de transporte continuo de fluido por conducto.

  **Ronda 1 de fixes de playtest (2026-08-07)** — el operador reportó que el ciclo no se podía jugar de punta
  a punta. Tres causas, las tres confirmadas en código:
  - **Reservorios vacíos (bloqueante):** NADIE poblaba nunca `Blueprint.reservoirContents` — la sustancia de
    cada reservorio existía solo como comentario (`// Nota: contiene X`) en 21 entradas del catálogo. Promovido
    a dato real (`CompositeComponentSpec.contains`, con la interfaz extraída a
    `composite-component-spec.types.ts` porque estaba duplicada en los 4 catálogos) y derivado al crear la
    campaña y al sembrar un capítulo (`reservoir/initial-reservoir-contents.ts`). Los tanques nacen LLENOS a su
    `capacity`. De paso, esto activa por primera vez en partida real el derrame de 13d.
  - **Materia prima infinita (consecuencia del anterior):** extraer vaciaba el tanque entero en una tarea de
    14s (100 unidades de agua = 200 H + 100 O). Se topea por tarea (`EXTRACTION_BATCH_UNITS = 5`): la escasez
    pasa a ser de TIEMPO — cada lote es un viaje del tripulante — en vez de 21 cantidades autoradas a mano.
  - **El tripulante no caminaba a la mesa:** `queueFabrication`/`queueSynthesis`/`queueAnalyzeSubstance` usaban
    `plannedSectionFor` ("donde ya esté"), correcto cuando la mesa era un botón global pero contradictorio con
    haberla convertido en aparato. Ahora van con `ensureAt` a la sección del aparato — y analizar, a la del
    reservorio que contiene la sustancia.
  - **Mesa en química:** se ocultan "modo cableado"/"modo borrar" (no aplican, sus handlers ya eran no-op), y
    el layout pasa a tres columnas (`CHEM_COLUMNS`) usando el alto completo en vez de heredar el del grid
    físico. **Causa raíz del texto cortado**: rexUI ancla cada hijo de un sizer por su CENTRO, pero las
    tarjetas dibujaban sus hijos con `origin(0,0)` desde ese punto, así que media tarjeta caía fuera de la
    máscara del `scrollablePanel` — bug preexistente de `kenney-card-list.ts`, ahora con hijos relativos al
    centro y alto adaptativo al contenido.
  - Verificado en la app real con Playwright (campaña nueva → misión → estación química): reservorio en
    "Contiene: Agua — 100/100", aviso de derrame, "Extraer (requiere análisis)" deshabilitado, y la paleta con
    el texto completo. `/engine` 843 → 858 tests.

  **Ronda 2 de fixes de playtest (2026-08-07)** — cinco reportes, tres causas raíz, todas de "el motor hace lo
  correcto y la pantalla no lo cuenta":
  - **`purge-reservoir` había quedado desactualizado respecto de 13e.** Su propio comentario decía que el
    contenido se venteaba a la nada "porque no existe todavía un destino real para las sustancias (deuda #9,
    Subfase 13e)" — 13e cerró esa deuda y nadie volvió a esa rama. Ahora la purga **vuelca sobre la atmósfera
    de la sección** por la misma vía que `apply-substance`. El operador purgó un tanque lleno sin ir a
    desmontarlo, perdió sus 100 unidades de agua y con ellas la única materia prima de la nave — de ahí su "no
    tengo químicos en la mesa química". Purgar y extraer NO compiten (purgar = tirar la carga para desmontar
    sin derrame; extraer = cosechar 5 por viaje sin vaciar el tanque), pero se dibujaban juntos sin decir qué
    hacía cada uno: ahora se renombraron ("Purgar (se pierde el contenido)", "Verter en la sección",
    "Trasvasar a otro reservorio"), los deshabilitados llevan el motivo en el label y el bloque tiene línea de
    ayuda.
  - **El scheduler no propagaba los resultados de tarea.** `TaskEffectResult` ya declaraba `obtainedElements`
    y `overflowAmount` y los efectos ya los devolvían, pero `completeTask` solo copiaba `obtained` y
    `analyzedSubstanceId` al evento — morían en el motor sin que nada fallara al compilar. Las cuatro acciones
    de sustancia ahora notifican por `NotificationCenter`. Añadido el test de scheduler que faltaba.
  - **El panel de acciones no conocía el modo del core loop**, así que el botón de la mesa se dibujaba siempre
    habilitado y el único gate avisaba con `setStatus` (texto discreto del header). Ahora dice "Fabricar
    (pausá primero)". **Bug encontrado corriendo el juego**: el handler de `core-loop-mode-changed` no
    refrescaba el panel, así que al pausar el label quedaba congelado.
  - **Legibilidad visual (principio 6, pedido del operador).** Al auditarlo el hueco era mayor que la purga
    nueva: el derrame de 13d emitía evento y charco pero la sustancia **nunca entraba a `atmosphere.gases`**
    (moría con la instancia — el charco era cosmético); el tinte del charco era FIJO, así que agua y ácido
    dejaban la misma mancha; y la nube de sección solo se pintaba con tag TOX/CORR, o sea que verter agua era
    **invisible**. Ahora: el desmontaje inyecta en la sección reusando la decisión de la propia regla; nueva
    `chemicalSubstanceColor` + `EventEffectOptions.tint` (sin que `/engine` conozca colores); y consulta
    hermana `airborneSubstanceAt` para el uso VISUAL, dejando `contaminantAt` como la de daño y la del siseo
    de alarma — mezclar "qué me lastima" con "qué se ve" era la causa.
  - **Paleta química vacía:** con stock 0 mostraba las 29 tarjetas del catálogo en ×0, que se lee como "el
    juego está roto". Ahora lleva línea de estado vacío que dice de dónde salen los elementos.
  - Verificado en la app real con Playwright: panel del reservorio con las etiquetas y la ayuda nuevas, y el
    botón del banco alternando "Fabricar (pausá primero)" ↔ "Fabricar" al pausar sin reabrir el panel. **No
    verificado en la app** (se deja dicho): la notificación de purga y su charco exigen tripulante
    seleccionado y la tira de tripulación no entra en el viewport headless de 720px — cubierto por tests del
    motor y por la receta manual. `/engine` 858 → 863 tests.

  **Ronda 3 de fixes de playtest (2026-08-08)** — la ronda 2 conectó los volcados a la atmósfera; el playtest
  mostró que la conexión era correcta pero la MAGNITUD absurda:
  - **Desmontar un reservorio lleno asfixiaba la nave entera.** Tres errores apilados:
    `GAS_FRACTION_PER_SUBSTANCE_UNIT` era la fracción ABSOLUTA por unidad (50 unidades llenaban cualquier
    sección al 100 %, y un reservorio trae 100), incumpliendo la espec de datos §4 que exige calcular el % **sobre
    el volumen total** — ahora se divide por `sectionArea`; CUALQUIER sustancia se volvía atmósfera, así que un
    tanque de agua asfixiaba igual que un tóxico — ahora solo `state === "G"` o tag `VOLAT` llegan al aire
    (`isAirborneSubstance`), el resto se derrama al piso; y la propia ronda 2 multiplicó la exposición de esa
    constante al hacer que purga y derrame la usaran. **Nota de diseño:** `VOLAT` no significa gaseoso (lo
    llevan 4 sustancias con estados G/S/L/L y solo alimenta reglas de combustión); el discriminador correcto
    ya existía en `ChemicalSubstanceData.state`.
  - **Tests que mentían:** `dismantle-hazard.integration.test.ts` construía la inyección sin dependencias y
    afirmaba que el agua contamina — verde justo sobre lo que se corrigió. Cableado con las deps de producción
    y ampliado con el caso contrario. Otro test comparaba dos `undefined` sin afirmar nada.
  - **La nube aparecía de golpe en todas las secciones:** `createGasLeakEffect` no tenía umbral ni suavizado.
    Ahora la concentración mostrada persigue a la real con retardo, hay umbral de visibilidad y la opacidad
    acompaña a la densidad.
  - **"Extraer" no se veía y el panel costaba clickear:** el panel crecía sin techo (~350 px típicos sobre un
    nominal de 220) sin scroll ni recorte, y compartía depth con la tira de tripulación, que lo tapaba al
    re-crearse. Ahora tiene `actionPanelMaxHeight` con scroll interno por rueda, depth propio
    (`hudFloatingPanel`) y el clamp mide contra la tira, no contra el borde de pantalla. **Cierra la
    observación #25.**
  - **Botones deshabilitados ilegibles:** texto gris sobre fondo atenuado al 40 %; las dos atenuaciones se
    sumaban y anulaban el patrón de "motivo en el label" introducido en la ronda 2. `/engine` 863 → 870 tests.

  **Ronda 4 de fixes de playtest (2026-08-08)** — tres hallazgos, dos de ellos regresiones de la ronda 2:
  - **El click atravesaba el panel de acciones** hasta el botón "Prioridad" del reparto de energía. No era
    `depth`: Phaser hace hit-test contra TODOS los objetos interactivos y las listas `ignore` de cámara solo
    afectan al RENDER; un objeto de MUNDO evaluado contra la `hudCamera` tiene un **área de click fantasma**. Y
    `topOnly` no desempataba porque ordena por el índice en el `renderList` de la cámara, donde los `Label` de
    rexUI no aparecen. Regla adoptada: **el elemento más arriba es el único que recibe el click**, implementada
    globalmente sobrescribiendo `input.sortGameObjects` con un orden por profundidad EFECTIVA (la del container
    más externo).
  - **El agua derramada no se veía.** Tres causas: el charco no se marcaba como objeto de mundo (el "bug de
    doble cámara" que el resto de efectos ya evita); iba a `bloodDecal` (1), **debajo de las sombras y del
    overlay de la propia pieza**; y su color caía al gris `0x8a949e`, que era el **mismo valor exacto** que el
    de "sustancia desconocida" y el de anclaje, y casi el de las paredes. Ahora hay colores curados por
    compuesto, un `RENDER_DEPTH.substanceSpill` propio, y un test de contrato que impide que esos colores
    vuelvan a colapsar.
  - **No había forma de analizar la sustancia desde el panel del reservorio:** decía "Extraer (requiere
    análisis)" y el único camino era el botón "Sustancias (N)" del HUD. El runtime ya mandaba al tripulante al
    reservorio correcto; faltaba el botón, que ahora va **antes** de "Extraer" y no cierra el panel — como el
    comentario de las otras acciones de 13e ya decía que debía ser. `/game` 36 → 40 tests.

  **Ronda 5 de fixes de playtest (2026-08-10)** — dos bugs con causa concreta; el tercer reporte (mesas sin
  energía) es el hallazgo ya documentado de la Subfase 13g, confirmado sin regresión y explícitamente no
  tocado en esta ronda:
  - **El click sobre el FONDO del panel (no los botones) seguía atravesando.** La ronda 4 arregló el desempate
    entre objetos interactivos superpuestos, pero el `backdrop` nunca fue interactivo (miedo de 13d a que se
    comiera los clicks de los botones) — al no competir en el hit-test, el click al área vacía iba directo al
    mundo debajo. Ese miedo ya no aplica con `installTopmostOnlyInput` desempatando por profundidad efectiva:
    un backdrop interactivo pierde contra los botones (se agregan después) y gana contra el mundo. De paso,
    pedido del operador: arrastre del panel por click&hold sobre el backdrop, con posición manual que se limpia
    al cambiar de selección pero sobrevive a un rebuild por refresco de contenido vivo.
  - **La síntesis no notificaba, solo sonaba.** Se detectaba comparando `availableSubstances.length`
    antes/después — un `Set` deduplicado que no crecía (y por tanto no notificaba) si la sustancia sintetizada
    ya existía en algún reservorio. Nuevo `MissionRuntime.materializedByTaskId` + `consumeMaterializedByTask`:
    dato exacto tomado del mismo listener que ya materializa, en vez de un conteo indirecto. Corrige de paso el
    mismo patrón frágil en la fabricación física.
  - **La extracción de elementos de un reservorio no volaba ninguna "moneda"** hacia la mesa, a diferencia del
    desmontaje físico. `benchCell` generalizado por dominio; nuevo helper `fireCollectionBurst` compartido; la
    extracción vuela una moneda por sustancia distinta hacia la estación QUÍMICA (donde se consume
    `elementStock`), no el banco físico. `/engine` 870, `/game` 40 tests (sin cambio de conteo — la lógica
    nueva no agregó tests unitarios propios: input de Phaser sobre una escena real, sin arnés razonable de
    test automático — verificado razonando sobre el código, determinista sin ambigüedad de dedupe).

  **Ronda 6 de fixes de playtest (2026-08-11)** — un solo bug, con dos capas de causa:
  - **"Trasvasar a otro reservorio" perdía el 100% del contenido origen si el destino ya estaba lleno**, aunque
    el aviso de desborde (correcto desde la ronda 2, y sigue intacto para el caso PARCIAL) mostrara cuánto se
    perdió. `transferTargetsFor` solo chequeaba que el destino TUVIERA capacidad de catálogo, no que le
    quedara espacio LIBRE — un reservorio lleno contaba igual como destino válido y el botón se ofrecía sin
    aviso. Y en el motor, `drawFrom` vaciaba el origen incondicionalmente ANTES de saber si el destino podía
    recibir algo, así que con espacio libre 0 se perdía el 100% como "desborde total". El MVP no deja elegir
    destino ni cantidad (siempre el primer reservorio alcanzable, con el 100% del contenido), así que esto no
    era una decisión mal medida del jugador — era un destino que nunca debió ofrecerse. Fix en dos capas
    (mismo criterio de defensa en profundidad que ya usa la validación de alcance del propio archivo):
    `transferTargetsFor` exige `freeCapacity > 0` (cae al motivo ya existente `"no-target"`), y
    `ship-task-effect.ts` chequea `freeCapacity` del destino antes de `drawFrom` — con 0, la tarea es un no-op,
    cubriendo también la carrera de que el destino se llenara entre armar el panel y ejecutar la tarea.
    `/engine` 870 → 871 tests.

  **Ronda 7 de fixes de playtest (2026-08-21)** — investigación a fondo del reporte "sigue perdiendo el
  contenido": el motor ya NO perdía nada tras la ronda 6 — el trasvase se movía con éxito al reservorio
  interno de `starter-estacion-quimica` (mini-reservorio `FAB`, conectado por conducto), pero el auto-pick
  ciego del MVP elegía ese destino sin que el jugador lo supiera, y `ship-task-effect.ts` nunca reportaba
  `pouredSubstanceId`/`pouredAmount` en el caso de ÉXITO (solo el desborde) — un trasvase 100% exitoso no
  disparaba ninguna notificación ni efecto visual, así que la sustancia parecía desaparecer:
  - **Modo de selección espacial de destino**, estilo SimCity (pedido explícito del operador, tras descartar
    un simple listado por confuso con varios reservorios en una misma zona y descartar excluir la estación
    química, que sigue contando como destino válido): hermano estructural de `wireMode` (Fase 11f) — el mapa
    se oscurece por completo, la capa de conductos `fluido` se fuerza visible, cada reservorio candidato se
    ilumina en verde/rojo según pueda o no recibir (mismo contrato de color de crisis ya existente, sin
    inventar uno nuevo), y un canal recto entre origen y el candidato bajo el cursor confirma si hay camino.
    Nuevo motivo de bloqueo `"different-substance"` (el destino ya tiene otra sustancia — `pourInto` lanzaría
    `ReservoirOccupiedError`, y el scheduler no envuelve el efecto en try/catch).
  - **Notificación + moneda en trasvase exitoso**: rama propia para `transfer-substance` (no reutiliza el
    charco de verter/purgar, que sí derraman de verdad) con su propia notificación y una moneda hacia el
    reservorio destino elegido.
  - **Compuestos de catálogo instalables desde "Inventario"**, gateados por stock de receta (pedido del
    operador para poder instalar un segundo reservorio y probar el trasvase de verdad) — antes solo aparecían
    en la pestaña "Catálogo", informativa. Instalarlos consume la receta completa; las creaciones
    personalizadas del jugador siguen gratis. `/engine` 871 → 873 tests.

  **Ronda 8 de fixes de playtest (2026-08-21)** — seis reportes sobre lo entregado en la ronda 7, cinco con
  causa raíz confirmada y uno documentado como hipótesis (a reconfirmar):
  - **Canal del trasvase por el conducto real**, no recta: `computeSignalWireRoute` generalizada a
    `computeConduitRoute(kind)` (`conduit-path.ts`) — la polilínea ya existía para el cableado, solo faltaba
    parametrizar el tipo de conducto.
  - **Bug de depth confirmado** detrás de "no se ve la capa de flujo resaltada": `conduitLayers[kind]` vive
    dentro del `Container` `base`, que aplana el depth de sus hijos al del propio container — subir el alpha
    de la capa nunca iba a bastar, el oscurecido (depth mayor) la tapaba igual. Fix: nuevo
    `RENDER_DEPTH.transferHighlightedConduit`, con un clon top-level de la capa `fluido` mientras dura el modo
    (el original se oculta), en vez de intentar reordenar dentro del container.
  - **Resaltado por contorno de pieza**, no un círculo suelto: rectángulo del footprint real
    (`effectiveFootprintExtent`) + tinte directo del sprite si existe (nuevo `componentSpritesByInstanceId` en
    `mission-overlay-renderer.ts`) — hoy ni el reservorio ni la estación química tienen sprite real todavía,
    así que el resaltado visible sigue siendo el contorno.
  - **ESC cancela el modo de trasvase** (antes solo pausaba el juego) — se prueba primero contra el modo
    activo, cae a pausar si no hay ninguno.
  - **Investigación abierta** sobre "unidades perdidas: 50" tras un trasvase exitoso: no se pudo confirmar el
    mecanismo con certeza leyendo código (el guard de la ronda 6 debería impedir una pérdida total). Hipótesis
    más plausible corregida: `handleTransferModeClick` ya no usa la lista de candidatos cacheada al abrir el
    modo, la recalcula en el momento del click — pendiente de reconfirmar en el próximo playtest si el aviso
    reaparece.
  - **Selector de instalación unificado**: el operador, al ver que el reservorio no aparecía en "Disponibles
    en inventario" por falta de stock, pidió que un compuesto sin receta completa aparezca IGUAL en la lista
    (deshabilitado, explicando qué falta) y — siguiendo esa misma lógica — unificar las dos pestañas
    ("Inventario"/"Catálogo") en una sola. `buildInstallOptions()` reemplaza a `buildInventoryOptions`/
    `buildCatalogOptions`: habilitados primero (atómico con stock, creación, compuesto con receta completa),
    bloqueados después con motivo (`"no-stock"`/`"missing-ingredients"` + nombres de lo que falta, nuevo
    `MissionRuntime.missingRecipeIngredients`). Se suma stock inicial del capítulo 1 (`tubo-flexible`,
    `valvula-simple`, `junta-hermetica` a 2) para que el segundo reservorio sea instalable de entrada.
    `/engine` 873 tests (sin cambio), `/game` 40 tests (sin cambio — fixes de render/UI de Phaser y contenido).

  **Ronda 9 de fixes de playtest (2026-08-21)** — seis reportes sobre lo entregado en la ronda 8, todos con
  causa raíz confirmada (dos agentes Explore en paralelo), más una decisión de diseño consultada al operador:
  - **Ítem bloqueado seleccionable en el selector de instalación**: `kenney-list.ts` ligaba un solo booleano
    `enabled` a "clickeable" Y "atenuado" — nuevo `muted?: boolean` independiente, así una fila bloqueada
    sigue mostrando su ficha completa al clickearla (el botón "Instalar" es lo único que queda deshabilitado).
  - **Título de 2 líneas ya no pisa la huella**: la huella se ancla en `título.y + título.height + 4` en vez
    de un offset fijo que asumía una sola línea.
  - **Sin resaltado de objetivo de misión en el selector de instalación**: `buildComposition` gana
    `highlightRequiredTag?`/`missingRefs?` — el selector pasa `false` para el ámbar (válido solo en el
    tooltip de desmontar) y suma "(sin stock)" en gris en el ingrediente puntual que falta, en vez del
    mensaje genérico de toda la fila.
  - **Solo la capa `fluido` visible durante la transferencia**: `updateTransferMode()` solo AGREGABA `fluido`
    a las capas activas sin QUITAR las demás — sus tokens de flujo animado (señal/ventilación/eléctrico)
    seguían moviéndose por encima del oscurecido. Ahora el set de capas activas pasa a ser exactamente
    `{"fluido"}` mientras dura el modo (snapshot completo para restaurar al salir, no solo un booleano).
  - **Hover reconoce la huella completa**: el canal solo se dibujaba con el cursor sobre la celda origen de
    un candidato > 1×1 — mismo criterio de huella completa (`occupiedCells`) que ya usaba el click.
  - **Transferencia parcial: capar al espacio disponible, nunca perder** (decisión del operador, consultada
    directamente: capar vs. advertir antes de confirmar — eligió capar). `transferCandidatesFor` expone
    `freeCapacity` por candidato; la cantidad encolada pasa a `Math.min(origen, freeCapacity)` — el remanente
    queda disponible para un segundo viaje en vez de perderse por desborde. De paso, el operador confirmó que
    no hay distinción entre "trasvasar" y "transferir" — se renombran las 8 entradas en español a la familia
    "transferir"/"transferencia" (los identificadores de código, ya en inglés, no cambian).
    `/engine` 873 tests (sin cambio), `/game` 40 tests (sin cambio — mismo criterio de rondas anteriores).

  **Ronda 10 de fixes de playtest (2026-08-21)** — tres fixes puntuales del selector de instalación/modo
  transferir, más una regla de motor nueva y transversal surgida de una pregunta del operador sobre
  transferir líquido en zonas con energía:
  - **Lista del selector de instalación sin ruido**: `optionRowLabel` ya no agrega el motivo de bloqueo
    ("sin stock"/"faltan: X, Y") al nombre de la fila — con la fila ya atenuada (`muted`, ronda 9) era
    redundante, y para compuestos duplicaba lo que la ficha ya muestra pieza por pieza.
  - **Warning de la ficha sin listado y sin solape**: `blockedMissingIngredients` deja de listar nombres
    ("Faltan piezas para fabricarlo." a secas — el listado ya vive en Composición); el `lineY` que sigue al
    warning se calcula con `warningText.height` en vez de un offset fijo, mismo criterio que el título/huella
    de ronda 9, para que un warning largo no pise la sección de abajo.
  - **Sonido al clickear un destino bloqueado en modo transferir**: mismo `AUDIO_KEYS.uiDenied` que la
    asignación de energía de más — antes el único aviso era el texto de estado.
  - **Nueva regla de motor — "sin energía, la máquina no actúa"**: confirmado con el operador en dos rondas de
    preguntas de alcance. Toda tarea con `targetSectionId` queda `blocked` con el nuevo motivo `"no-power"` si
    su sección no tiene energía otorgada — salvo `dismantle`, `cut-power`, `purge-reservoir` y
    `discharge-source` (las tareas de asegurado de 13d, que existen para operar sobre una sección sin
    energía, quedarían rotas si se gatearan a sí mismas). Implementado en el único choke point donde el
    scheduler ya resolvía bloqueos por dependencia (`TaskScheduler.resolveBlockingReason`), inyectando
    `isSectionUnpowered` desde `mission-runtime.ts` — reutiliza la señal viva `sectionHasNoPowerGranted`
    (nacida cosmética en 13b, ahora con un segundo consumidor real de gating, documentado en su propio
    comentario). Una tarea bloqueada por energía se retoma sola en cuanto la sección la recibe, sin acción del
    jugador sobre la tarea — mismo mecanismo que el bloqueo por dependencias. Notificación distinta en
    `floorplan-scene.ts` ("Bloqueado: la sección no tiene energía") en vez del texto genérico de tarea
    bloqueada.
    `/engine` 881 tests (873 + 8 nuevos de gating por energía en `task-scheduler.test.ts`), `/game` 40 tests
    (sin cambio).

  **Ronda 11 de fixes de playtest (2026-08-21)** — un bug visual del selector de instalación y dos problemas
  de alcance del gating por energía de la ronda 10, más una pregunta de alcance al operador (¿"conectar"/
  "combinar" son igual de manuales que "instalar"? → conectar sí, combinar no: la estación química opera como
  máquina real):
  - **Hover-out no restauraba el atenuado**: `kenney-list.ts`, el `pointerout` de una fila restauraba un alpha
    hardcodeado (el normal) en vez de `dimmed ? 0.25 : ROW_BG_ALPHA` — una fila bloqueada se veía "normal" tras
    alejar el mouse hasta que el modal se reconstruía por completo al clickear cualquier ítem.
  - **"Ir a sección" e "instalar" quedaban bloqueadas sin deber estarlo**: eran trabajo manual del tripulante,
    gateadas por accidente porque también fijan `targetSectionId` (el mismo campo que leía el gate de la
    ronda 10). "Conectar" (cablear señal) se suma a la lista de exentas por la misma razón, confirmado con el
    operador.
  - **Transferir a un destino sin energía no se bloqueaba**: `queueTransferSubstance` fijaba `targetSectionId`
    SOLO desde el origen — el destino nunca se chequeaba para el gate.
  - **Rediseño del mecanismo**: de "tipo exento" (lista de exclusión que hay que recordar ampliar) a
    `powerSectionIds?: ReadonlyArray<SectionId>` explícito por tarea (opt-in), campo nuevo e independiente de
    `targetSectionId` (que sigue existiendo para ubicación del actor/animación, sin tocar). El scheduler
    bloquea si CUALQUIERA de las secciones declaradas no tiene energía — ausente/vacío nunca gatea. Transferir
    y aplicar sustancia declaran AMBAS secciones (origen y destino); extraer/analizar/fabricar-sintetizar
    declaran solo la suya, igual que antes; ir a sección/instalar/conectar/desmontar/las 3 tareas de asegurado
    de 13d no declaran ninguna.
    `/engine` 886 tests (881 + 5 nuevos/reescritos de gating), `/game` 40 tests (sin cambio).


#### Subfase 13f: Integridad de Casco por Sección ✅ CERRADA (2026-08-24)

Surgida del playtest de 13c: el operador reportó que instalar un `tubo-flexible` (RE baja) desplomaba la integridad del casco de toda la nave, y que desmontarlo la "reparaba". La causa es un error de modelado de la Subfase 11g — `aggregateHullIntegrity` deriva la integridad del **peor RE de los componentes instalados**, así que cualquier pieza que declare RE (una manguera, un chip) cuenta como si fuera casco. Propuesta del operador, adoptada: **las secciones tienen vida propia**, dañada por fenómenos físicos, y la integridad de casco se deriva de eso — no de las piezas que hay dentro.

13c dejó un **parche interino** (solo cuentan las piezas con tag `EST`, ponderadas por `damageResistance`) explícitamente marcado como provisional: esta subfase **borra `instanceHullFraction`/`weightedHullFraction` y toda esa agregación**.

* **Vida por sección (motor):** HP numérico interno por sección, escalado por `sectionArea()` (ya existe). El jugador **nunca ve el número**: el HUD y la capa "estructural" ya consumen `ShipStatusIndicator` (`fraction` + nominal/warning/critical), así que no hace falta UI nueva. Se eligió numérico y no la escala cualitativa del resto del motor porque los impactos son eventos discretos que restan de forma natural; con 3 niveles, la primera explosión ya se comería un tercio de la barra. Misma clase de excepción deliberada que las unidades de energía de 13b.

* **Cuatro escritores de daño:** (1) impacto cinético contra pared, (2) explosión/combustión, (3) corrosión de la atmósfera de la sección, (4) descompresión/presión baja — este último **amortiguado**, porque se realimenta con la brecha (menos vida → más fuga → menos presión → más daño).

* **Colapso a 0:** brecha que drena presión de forma continua, reutilizando el `SectionPressureSinkSource` que el Cap.1 ya usa para su junta rota, **más una cicatriz permanente en el guardado de campaña**. Esto último es literalmente el callback que `docs/Primeras_8_crisis.md` pide para los Cap. 3, 6, 7 y 8 ("la sección afectada queda con `RE` reducida — cicatriz que reaparece en el capítulo 7") y que hoy no tiene ninguna implementación. Sellar la brecha la detiene, pero la vida NO se recupera (principio 5).

* **Huecos de motor a cubrir** (relevados antes de planificar, para que la subfase no arranque a ciegas):
  1. `KineticImpactEvent` no lleva posición/celda/sección — solo `targetRef`.
  2. **No existe colisión contra pared:** `MissionProjectileWorld.occupantAt` resuelve solo componentes, tripulación y enemigos; el motor no conoce las paredes (viven en el tilemap de `/game`). Además un proyectil que no golpea nada **sale del plano sin frenar** — no hay chequeo de bordes. Se resuelve con el mismo patrón de inyección que 13a usó para la línea de visión (`setMotionBlockedQuery`), sin que `/engine` sepa de Tiled.
  3. `OverloadEvent` no lleva `sectionId` (el puente `ref → sección` ya se hace a mano en `MissionReactionRuntime`). `CombustionEvent` sí lo lleva, y su `radius` cualitativo (`half-section`/`full-section`) hoy solo alimenta partículas — se le da consecuencia real.
  4. Estado dinámico por sección: copiar el molde exacto de `sectionAtmospheres` + `SectionAtmosphereSnapshot` (bump de `schemaVersion` con campo opcional).
  5. `MissionAtmosphereRuntime` acepta **un solo** `SectionPressureSinkSource`; hay que componer el sink de brecha con el del Cap.1.
  6. El render ya está desacoplado: `drawStructuralLayer` recibe `indicatorForSection` inyectado — sustituir la fuente es una línea.

* **Sumado en el triaje de 2026-08-21 — `HazardEvent` sigue sin llamador de producción (deuda #16, ampliación
  de 12b).** `toxic-threshold`/`corrosive-exposure` (umbral de exposición atmosférica a un tripulante) solo se
  demuestran en `particle-gallery-scene.ts`; el sonido de corrosión (`game/src/audio/effects/corrosion-sound.ts`)
  quedó registrado en `phenomenon-sound-registry.ts` desde 12b y nunca sonó en partida real. Entra acá porque
  esta subfase ya construye el escritor hermano —la corrosión de la atmósfera dañando la **sección**— y el
  hazard es la misma lectura de atmósfera aplicada al **tripulante**: son el mismo tick, no dos sistemas.

* Test unitario por escritor de daño + integración "una explosión abre una brecha que drena presión"; la cicatriz permanente debe sobrevivir un round-trip de guardado.

* **Cerrada el 2026-08-24.** Dominio nuevo `engine/src/integrity/` (vida por sección + reglas de daño como Strategy),
  `MissionSectionIntegrityRuntime` y `MissionHazardRuntime`, brecha con sumidero propio y piso de presión POR SECCIÓN
  (una brechada llega a 0 kPa, el resto conserva el piso de 40 de 11h), sellado por PROPIEDADES (`EST` + RE
  suficiente, principio 1) y no por lista de ids. `schemaVersion` 8→9. Borrados `instanceHullContribution` y
  `weightedHullFraction`. Los tres huecos de motor cerrados (#5 ya lo había pagado 13d con `composePressureSinks`).
  Correcciones que salieron de la auto-revisión, no del texto original: el umbral de descompresión se subió a 60 kPa
  porque a 40 coincidía con el piso global y el escritor no tenía ningún camino real; y la corrosión sigue sin
  camino jugable (ningún capítulo autora una sustancia `CORR` viva), documentado en el docblock del runtime en vez
  de darlo por bueno. Tecla de dev **H** para provocar el colapso por el camino de producción.

* **Ronda 1 de playtest (2026-08-25).** Cinco reportes; dos de ellos resultaron ser bugs **preexistentes del
  meta-juego** que 13f volvió visibles por primera vez.
  - *Integridad de casco casi a 0 con una sola explosión.* La agregación era "peor sección gana", así que una
    sección al 17% ponía toda la nave al 17%. Pasa a **media ponderada por tamaño**, con las secciones
    brechadas pesando el triple (`breachedSectionWeightMultiplier`): la fila del HUD deja de desplomarse por
    una sala y sigue moviéndose lo bastante como para contar algo. La alarma localizada no se pierde — la capa
    "estructural", el overlay de alerta y la alarma sonora ya estaban donde corresponde.
  - *La celda clickeada no quedaba marcada.* La brecha se abría en el **centroide** de la sección: en medio del
    piso, lejos del daño y físicamente imposible. Nuevo módulo puro `integrity/breach-cell.ts` — se elige la
    celda que toca el exterior más cercana al origen del daño, con desempate determinista. La celda se GRABA en
    `SectionIntegrity.breachCell` y se persiste: recalcularla al cargar mudaba el agujero de pared y dejaba el
    parche del jugador en el lugar equivocado.
  - *Sangre saltando sobre un tripulante que no perdía vida, y el sprite roto al moverse.* Mismo origen: el
    daño por vacío escalaba una fracción con `dtSeconds`, que por frame redondeaba a 0 — cero daño y ~60
    `crew-damaged` por segundo. El vacío pasa a **mordiscos discretos** (~10 s hasta la muerte, el primero no
    letal como aviso), y `applyHpLoss` gana un **guard general**: un daño que no quita vida no emite evento,
    lo que corta la clase entera de bug para cualquier fuente futura. El sprite se rompía porque el flash de
    daño era un tween RELATIVO sobre la escala actual; ahora es absoluto sobre una escala BASE registrada, que
    `hopMove` también lee.
  - *Sellar con una junta hermética no funcionaba.* Correcto por diseño y **el requisito se mantiene** (una
    goma no tapa un agujero al vacío), pero el juego no lo decía en ningún lado. Ahora la brecha es
    inspeccionable en el panel, instalar algo que no sirve avisa por qué, y cada brecha tiene un marcador
    pulsante propio en el plano que cambia de color al sellarse.
  - *Preexistentes:* "Guardar y salir" persistía `campaignSession.touch()` (solo `updatedAt`), así que salir a
    mitad de misión tiraba TODO el estado vivo; y "Continuar" cargaba `saves[0]` de un `readdir` sin ordenar,
    entrando en una campaña de hacía un mes sin ningún error visible. Resueltos con `meta/live-mission-save.ts`
    y `mostRecentCampaignSave()`. Sin esto la cicatriz de 13f no era verificable.
  - La tecla **H** pasa a emitir media sección en vez del radio máximo: con `full-section` una sola pulsación
    reventaba la sección de un golpe y no había progresión que observar.
  - Registrados sin arreglar: deudas #41 a #45 de `PENDIENTES_OBSERVACIONES.md`.

* **Ronda 2 de playtest (2026-08-25).** Tres reportes. Ninguno era un bug de la ronda 1: dos son huecos que 13f
  destapó al darle por fin camino jugable a la muerte y al vacío, y el tercero era consecuencia del segundo.
  - *"El tripulante no muere al llegar a 0 vida, sigo usándolo para todo".* **El permadeath del GDD 6.1 nunca
    se había implementado más allá del evento**: `crew-death` disparaba partículas y un bark, y ahí terminaba.
    `CrewActorStatus` gana `"dead"` (estado TERMINAL, no un booleano suelto), el scheduler cancela la cola del
    muerto —avisando por `dependency-cancelled` a quien dependía de él— y deja de darle trabajo, la UI no lo
    deja seleccionar, su token sale del plano y el save lo saca de `activeCrewIds` conservándolo en `crew`.
    El volcado de tripulación al save se extrajo a `writeBackCrew` en `/engine`, donde sí se puede testear.
    Cierra el pendiente #42.
  - *"La atmósfera queda en 0 y no se restaura al sellar".* Dos causas encadenadas. (a) Sellar la brecha solo
    DETENÍA el drenaje y nada volvía a subir la presión — `diffuse()` reparte fracciones de gas pero nunca toca
    `pressureKpa`, así que la sala quedaba a 0 kPa para siempre con el parche puesto. 13f había apostado a que
    "se represurizaría por los medios que ya existan"; no existía ninguno. Ahora el sumidero devuelve una tasa
    de recuperación en negativo, igual que la junta del Cap.1, y la cicatriz permanente se queda donde
    corresponde: en el casco (vida 0, `breached` para siempre, un golpe más lo reabre). (b) La fila "Atmósfera"
    usaba peor-sección-gana sobre la presión, así que una sección venteada la clavaba en 0 para toda la nave y
    reparar la fuga en otra sala no movía nada. Pasa a media ponderada por tamaño, reusando el peso por área y
    el multiplicador de brechadas de la ronda 1. **El término de gas tóxico se queda con peor-sección-gana a
    propósito**: un tóxico se difunde al resto de la nave, el vacío no.
  - *"El tripulante sigue dañándose en la zona ya parcheada".* Consecuencia directa de lo anterior: la sección
    seguía por debajo del umbral de vacío. Se cierra sin tocar nada de hazards.
  - Sumado por decisión del operador: con toda la tripulación muerta la crisis pasa a `resolved-failure` en vez
    de dejar la partida en un bloqueo silencioso (el Cap.1 no tiene temporizador).
  - Registrados sin arreglar: deudas #46 y #47.

* **Ronda 3 de playtest (2026-08-26).** Dos reportes, los dos sobre el mismo eje: el presupuesto de tiempo
  dentro de una sección brechada no alcanzaba para nada. Medido contra el código: morir en vacío tardaba 8 s,
  instalar 8-9,6 s y desmontar 12-14,4 s, y el daño empieza en cuanto el token ENTRA en la sección. O sea que
  **ni siquiera poner el parche bien a la primera era posible**.
  - *Ventana de vacío* de ~8 s a **~32 s** (`biteIntervalSeconds` 2 → 8). El número sale de medir la cadena de
    recuperación completa (viaje + desmontar la pieza equivocada + instalar la plancha ≈ 28 s): equivocarse
    cuesta casi toda la vida del tripulante, pero se arregla en un viaje.
  - *"El desmonte inicia de 0 con cada nuevo tripulante".* El progreso vivía en la TAREA, y la tarea muere con
    su actor. Ahora se acumula por **objetivo** (`taskProgressKey`): dos tripulantes pueden turnarse en un
    trabajo largo. Es una mecánica nueva —trabajo por relevos— no solo un fix; se limpia al COMPLETAR, así que
    cancelar o morir a mitad deja el avance para el siguiente.
  - *Encontrado investigando, no reportado:* la plancha 2×2 podía terminar **al lado** de la brecha.
    `findFittingInstallPlacement` reubicaba la pieza a "la celda válida más cercana" sin rechazar la acción, y
    el aviso de la ronda 1 no saltaba porque solo se dispara si la pieza CUBRE la brecha. El preview del
    footprint existía y se actualizaba, pero se dibujaba **debajo** del modal del selector (720×480 con fondo
    negro al 55%): información que no se podía ver.
  - *Flujo de instalación invertido* (propuesta del operador): botón **"Instalar" en la barra** → elegir la
    pieza → el modal se cierra → marcar el sitio en el mapa con el fantasma del footprint siguiendo el cursor,
    **anclado exacto**, verde donde entra y rojo donde no. Molde de `transferMode` (13e ronda 7). Se quitó
    "Instalar aquí" del panel de celda y se **borró `findFittingInstallPlacement`**: existía solo para el flujo
    que se reemplazó, y su comportamiento es justo el contrario del decidido.
  - *Click derecho = mover a esa celda.* Cubre el hueco que dejó "Instalar aquí" y uno anterior: `go-to` solo
    apuntaba a una sección, así que mandar a alguien a un punto concreto no tenía forma de expresarse.
    `CrewTask` gana `targetCell`.

* **Ronda 4 de playtest (2026-08-27).** Tres reportes sobre el flujo que la ronda 3 acababa de invertir.
  - *"Clickear Instalar tras elegir la pieza a veces pasa el click al mapa y el tripulante instala solo."*
    Cierto, y el más grave: encolaba la pieza en el sitio equivocado, justo lo que la ronda 3 vino a impedir.
    `createKenneyButton` dispara en **`pointerdown`** y Phaser despacha los handlers de los GameObjects ANTES
    del `pointerdown` de la escena: el botón cerraba el modal, así que la escena ya no lo veía abierto (y el
    modal flota sobre el mapa, fuera de `isOverFixedUi`), armaba el arrastre y el `pointerup` del MISMO click
    encolaba la instalación en la celda de debajo del botón. Se traga la pulsación por su `downTime`
    (`swallowCurrentClick`), no con una bandera de "ignorá el próximo click": así el fix no depende del orden
    de despacho. Aplicado también al cerrar el selector por Cancelar, al briefing, al panel de objetivos y al
    modo de trasvase — todos tenían la misma forma, con síntoma más leve (seleccionar una celda sola).
  - *"El pop-up de la celda vacía no cumple objetivo ninguno."* Cierto: desde que la ronda 3 le quitó "Instalar
    aquí" no le quedaba ninguna acción. La variante `empty` del panel se **borra** (no se oculta); clickear
    suelo vacío marca la celda y nada más.
  - *"Tapar la brecha detuvo el daño, pero le hizo daño una vez más después de instalar."* Física correcta mal
    comunicada: sellar cambia el signo del sumidero, pero la sala sigue a ~0 kPa y recupera a 2 kPa/s, así que
    tarda ~10 s en cruzar el umbral de vacío (20) y el mordisco cae cada 8. **Decisión del operador: no se toca
    el balance**, se hace legible. El tooltip de sección (que era solo el nombre) pasa a mostrar presión,
    tendencia —`netPressureRateOf`, lectura nueva del signo del sumidero, que hasta ahora se consumía y se
    tiraba— y "Vacío: letal", y la notificación de sellado dice que la sala tarda en llenarse. El estado de la
    sala aparece también en la ficha de una PIEZA cuando es noticia: tras tapar la brecha el jugador mira el
    parche, no el suelo de al lado.
  - *Corrección inmediata (ronda 4b):* quitar el panel dejó la celda vacía en `idle`, y `idle` desmarca la
    celda — así que F y H, que leían `selectedCell`, se quedaron sin fuente. Pasan a **armar y clickear** (la
    tecla arma, el click elige la celda, ESC o la misma tecla desarman): una herramienta de dev no debe
    depender de un estado de juego. Y clickear suelo vacío vuelve a marcar la celda, que es lo único que queda
    de ese click.


#### Subfase 13g: Consumo Eléctrico Real — que el reparto de energía gatee algo ✅ CERRADA (2026-08-29)

Surgida del playtest de 13e ronda 2: el operador preguntó si las mesas de creación dejan de funcionar cuando su sección no tiene energía, y si pasa lo mismo con un chip lógico en soporte vital. **La respuesta es que no, y el hueco no son las mesas: 13b construyó toda la maquinaria de reparto — presupuesto, asignación por sección, triaje de prioridad por componente, déficit — pero nada declara DEMANDA, así que los dos predicados de gating que el motor expone están degenerados.**

Estado auditado antes de planificar:

* **Ninguna pieza del catálogo declara `powerDraw`.** El campo solo aparece en `properties/functional.types.ts:34` (dentro de `ActuatorProperty`), en la lógica de reparto y en tests. Como `allocateComponentPower` (`power-allocation.ts:131`) calcula la demanda leyendo ese campo, **`isInstancePowered` devuelve `true` para todo, siempre** — el nivel 2 del reparto es funcionalmente inerte y el inspector de prioridad dice "alimentado" hasta con la sección a cero.

* **El runtime de señales SÍ implementa el gating, por dos vías que están muertas** (`mission-signal-runtime.ts:105-127`): `powerScars.unpoweredSections()`, que devuelve la cicatriz PERMANENTE (`permanentlyDisconnectedSectionIds`, vacía en campaña nueva), e `isInstancePowered`, siempre `true`. Ninguna consulta `sectionHasNoPowerGranted`, que es el único predicado con señal real. **Un chip en una sección a oscuras evalúa y emite normalmente.**

* **Química, atmósfera y todas las tareas de tripulación ignoran la energía**: fabricar, sintetizar, analizar y extraer no la consultan en ningún punto.

* Hoy cortar la energía a una sección produce **solo** oscuridad + parpadeo, y que desmontar ahí no chispee (13d, el único consumidor con gating funcional real — vía `isInstanceEnergized`, no vía `isInstancePowered`). El dial de reparto mueve agujas que no controlan nada.

Alcance de la subfase:

* **`powerDraw` sube de `ActuatorProperty` a dato de componente.** Hoy vive dentro del tag `ACT`, así que una pieza que no es actuador — un chip lógico, un sensor, una mesa — no tiene dónde declarar consumo. Pasa a `PhysicalComponentDefinition.data`, junto a `footprint`, que ya sienta el precedente de "dato de componente que no es un tag del GDD". Migrar el único lector (`power-allocation.ts:131`) para que haya **una sola fuente de verdad**, no dos. Decisión del ciclo de preguntas: consumo **declarado por pieza**, no derivado de propiedades — porque es lo que permite que una pieza se quede sin energía aunque su sección tenga algo, que es justamente para lo que existe el triaje de prioridad de 13b.

* **Las puertas ya son consumidor real desde 13h.** Al ejecutarse antes que esta subfase, 13h declara `powerDraw`
  en el `ACT` de la puerta y la congela cuando su sección no tiene energía — es el ejemplo de referencia de "una
  pieza que declara demanda y se apaga de verdad", y su `powerDraw` es uno de los que migran al subir el campo a
  dato de componente. Ojo con el predicado, que CAMBIÓ en la ronda 2 de playtest de 13h: usaba la unión de
  `unpoweredSections()` (cicatriz) y `sectionHasNoPowerGranted()` (déficit vivo), y eso estaba mal por dos
  motivos — preguntaba a nivel de SECCIÓN cuando quien decide si el motor cobra sus unidades es el reparto por
  instancia, y `sectionHasNoPowerGranted` está declarado en su propio docblock como "puramente cosmético… sigue
  sin usarse para gating de señales/HUD". La semántica vigente, y la que esta subfase debe generalizar, es
  `isInstancePowered(instanceId)` + la cicatriz permanente. Ver también `door-signal-output.ts`: para un
  RECEPTOR cuya instancia es el propio actuador, "sin energía" tiene que resolverse como `undefined` (nadie
  gobierna) y no como `false`, o la falta de energía se lee como una orden.

* **Poblar `powerDraw` en el catálogo**, data-driven: tabla de consumos por clase en `engine/src/power/power-parameters.ts` (molde de `salvage-parameters.ts`), no literales dispersos por los catálogos. Criterio de partida — sensores/chips/indicadores 1, actuadores 2, mesas y equipamiento pesado 3. Los números concretos son de balanceo (Fase 23); lo que cierra esta subfase es que **existan y se respeten**.

* **Señales:** al declararse la demanda, `isInstancePowered` deja de ser siempre-`true` y el gating que `outputOf` ya implementa empieza a funcionar solo. Revisar además el fail-open de `mission-power-runtime.ts:112-118` (toda instancia sin sección resoluble se fuerza a alimentada) y la vía muerta de `unpoweredSections()`.

* **Mesas (`FAB`):** banco y estación declaran `powerDraw` (decisión del operador: **las dos**, no solo la química); `openWorkbench` (`floorplan-scene.ts`) gana su tercer guard y el botón dice el motivo. El panel de acciones **ya soporta esto**: `fabricatorBlocked` es un motivo tipado (13e ronda 2) hoy con un solo valor `"execution"` — se le añade `"unpowered"` y el patrón de label queda igual.

* **Tarea en curso:** si la sección pierde energía mientras se ejecuta, la tarea pasa a `failed` con notificación (decisión del operador; principio 5 — quedarse sin energía a mitad de una síntesis cuesta algo). `task-failed` y su aviso ya existen: falta el gancho que lo dispare.

* **Legibilidad (principio 6): ✅ YA RESUELTA por adelantado** en la ronda 3 de playtest de 13h. La puerta fue
  el primer consumidor real y volvió urgente esta viñeta, así que se construyó ahí el sistema GENÉRICO que
  pedía: `engine/src/instance-state/` deriva los estados notables de una instancia y
  `game/src/render/component-state-visuals.ts` es la tabla ordenada estado→(tinte, ícono, aviso), consumida a
  la vez por el sprite del plano, el tooltip y el panel de acciones. **13g no tiene que construir nada de
  esto: agrega una fila por estado nuevo.** Dos cosas que sí hereda — la deuda #38 (las piezas sin sprite
  propio no son tinteables, y 13g es justo lo que las va a poner en ese estado) y la #39 (la oferta de energía
  de la nave nunca se dimensionó contra su demanda, y esta subfase la empeora).

* **GDD:** revisar §5.1 (la línea de `FAB` escrita en 13e dice que no se modela como `ACT` porque no convierte energía en trabajo). Sigue sin ser `ACT` — no hace trabajo físico sobre el mundo — pero sí **requiere alimentación para operar**. Documentar `powerDraw` como dato de componente y no como campo de `ACT`.

* **Cierre:** un chip en una sección a 0 unidades no emite; las dos mesas no se abren y lo dicen; cortar la energía a mitad de una síntesis la hace fallar con aviso; y una pieza apagada se distingue a simple vista de una encendida. Tests unitarios de reparto con demanda real + integración "sección a oscuras ⇒ la señal no llega".

**Cerrada el 2026-08-29.** Todo el alcance entregado. Decisiones del ciclo de preguntas: (a) subir la oferta
(10 → 38) en vez de dejar la escasez, con la demanda real medida en 33; (b) la tarea en curso FALLA y el
material se pierde (principio 5); (c) deuda #38 resuelta con objeto por instancia también para el placeholder;
(d) `powerDraw` es campo de `data` poblado al construir el catálogo desde una tabla única.

Lo que apareció y el texto de la subfase no anticipaba:
* **Subir la oferta sola no encendía nada.** `emptyPowerState()` deja `sectionAllocations: []`: toda sección
  de una campaña nueva arranca en 0 (patrón 42). Hizo falta `defaultSectionAllocations`, sembrado en el SAVE y
  no en el runtime — el runtime no distingue "nunca se asignó" de "el jugador puso todo en 0".
* **El gating de tareas tenía que ser por INSTANCIA, no solo por sección.** `powerInstanceIds` es además el
  único sitio donde una tarea `combine` conserva de qué mesa habla.
* **`failed`/`task-failed` llevaban desde la Fase 6 sin escritor** (patrón 32). 13g les dio el primero, y la
  Fase A del tick del scheduler —que nunca había mirado el mundo— es donde vive.
* Los otros dos lectores de `outputOf` sobre su propia instancia (bobina del electroimán, LED) NO necesitaban
  el trato de `doorSignalOutput`: ninguno lee `false` como orden. Verificado, no asumido.

Suite: `/engine` 1038 → **1059**, `/game` 86 sin cambios. `tsc`, `eslint` y `npm run build` limpios.

##### Ronda 1 de playtest de 13g ✅ (2026-08-29)

Un reporte: "cablé el fotorreceptor al LED y el LED se activa siempre, detecte algo o no; sin energía se
apaga". El gating de 13g estaba bien — el sensor detectaba de verdad al tripulante que le acababa de tender el
cable, porque `range: 10` cubría media nave y `queueConnect` lo deja parado al lado.

* **Rango 10 → 4**, cruzado antes contra el Cap.2: con el rango viejo el solape de sus dos sensores era total
  y **su compuerta AND estaba permanentemente en verdadero**, o sea que el puzzle se resolvía solo.
* **El área de alcance se dibuja** sobre el plano, con la MISMA función que decide el disparo (paredes y
  puertas incluidas) y redibujada por frame, porque una puerta que se abre cambia la cobertura.
* **Bug aparte, más ancho:** los resolvedores buscaban en `ATOMIC_COMPONENT_CATALOG`, así que ningún sensor
  COMPUESTO se simulaba nunca. Corregido contra el registro completo. El fail-open de los 15 `triggerType` sin
  simulación se conserva por decisión del operador, ahora documentado (deuda #40).
* **Patrón 13 por tercera vez:** los tests de la cadena inyectaban base vacía en vez de `allEmittersActive`,
  así que el bug era invisible por construcción. Corregido, con el caso negativo que faltaba.

Suite: `/engine` 1059 → **1070**.

##### Ronda 2 de playtest de 13g ✅ (2026-08-29)

Un reporte: la puerta puente↔pasillo no bloquea el paso ni abre ni cierra. Estaba autorada en una celda que
tocaba TRES secciones, y `thresholdSectionsAt` descarta los cruces de tres a propósito — así que
`syncInstalledDoors` nunca la daba de alta y quedaba como pieza decorativa. Movida a (4,9), umbral real.

Lo importante no es el dato sino que **fallaba en silencio**: `validateFloorplanIntegrity` daba la puerta por
buena (secciones existentes, adyacentes, celda dentro de una de ellas) sin comprobar lo único que la hace
funcionar — patrón 44 aplicado al plano. Se añade el issue `door-not-a-threshold`, que exige la misma
condición que el runtime, y el mapa ahora revienta al parsearse con la causa escrita.

Suite: `/engine` 1070 → **1072**. **Este fix estaba mal planteado — ver la ronda 3.**

##### Ronda 3 de playtest de 13g ✅ (2026-08-30)

El operador rechazó el fix de la ronda 2: la puerta estaba en la boca del pasillo, donde tiene sentido de
diseño, y yo la moví una celda atrás para que encajara con el modelo. La causa real es que **la capa Tiled
declara `a`/`b` y el motor los descarta** para re-inferirlos con `thresholdSectionsAt`, que se rinde cuando la
celda toca tres secciones — cosa que la boca de un pasillo hace por definición.

* **Resolución en dos pasos** (`resolveBoundary`): autorada → el `a`/`b` del mapa manda, verificado con
  `cellSeparates`; improvisada por el jugador → inferencia, que sigue siendo el único camino posible ahí.
* **El validador de la ronda 2 también estaba mal**: exigía que la inferencia coincidiera con lo autorado, o
  sea prohibía autorar puertas justo donde el dato sirve. Ahora comprueba la precondición real del runtime.
* La puerta vuelve a (5,9), y `initialOpen` —otro campo autorado que nadie leía— queda conectado.

Lección registrada: **mover contenido para que encaje con el código es una señal de alarma, no una solución.**

Suite: `/engine` 1072 → **1080**.



