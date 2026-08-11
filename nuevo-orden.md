
### Fase 11 — Sistemas Fundacionales y Ajustes de Consistencia (ASA)

Esta fase agrupa la infraestructura crítica que los capítulos 2 a 8 asumen por defecto y que actualmente no existe en el motor.

#### Subfase 11a: Ajustes de Consistencia Física (ASA Corrections)

* **ASA 1 — Masa Virtual:** Modificar la regla de impacto cinético `KineticImpactRule` (`engine/src/kinetics/`) para calcular una masa virtual cruzando el `footprint` de la pieza (su tamaño en el grid) con su Resistencia Estructural (`RE`) o estado del material. Esto evita que una carcasa de plástico vacía cause el mismo daño estructural que una plancha de metal reforzada de su mismo tamaño.


* **ASA 2 — Decaimiento de Inercia (Drag):** Añadir un coeficiente de decaimiento a la velocidad acumulada en `magnetic-acceleration.ts`. Si el proyectil ferromagnético no está bajo la influencia de ninguna bobina activa, su nivel cualitativo de velocidad se degradará paulatinamente (Alto $\rightarrow$ Medio $\rightarrow$ Bajo $\rightarrow$ Detenido) por cada $X$ segundos de simulación o $Y$ celdas recorridas, previniendo rebotes infinitos e incontrolables en salas vacías.


* **ASA 3 — Trayectorias Fantasma en Pausa Táctica:** Implementar un feedback visual predictivo en el modo de Planificación (pausa). Cuando el jugador encola la activación de una bobina, se calculará y dibujará una trayectoria estimada (un "fantasma" de ticks futuros) para que pueda coordinar las temporizaciones de los emisores sin caer en un frustrante sistema de ensayo y error a ciegas.



#### Subfase 11b: Sistema de Guardado y Cicatrices Persistentes

* **Guardado Dinámico:** Extender `CampaignSaveState` (`engine/src/save/`) para serializar el `Blueprint` dinámico modificado, la composición de la atmósfera por sección, el contenido remanente de los reservorios y las estadísticas de la tripulación (HP, cicatrices, tier). Subir la versión del esquema de `Blueprint` de 3 a 4.


* **Lógica de Cicatrices:** Implementar modificadores persistentes sobre las propiedades de material de las secciones o componentes individuales (por ejemplo, reducción permanente de la resistencia estructural `RE` o secciones sin suministro energético). Las crisis posteriores podrán leer estas cicatrices de la partida guardada para modificar su dificultad (callback del Capítulo 7).



#### Subfase 11c: Mesa de Creación en Misión y Síntesis Química

* **Prerrequisito (hallazgo de la Fase 11a.3) — Nodos de señal para piezas instaladas en misión:** `ship-task-effect.ts::installInstance` no genera ningún `SignalNode` para la instancia recién instalada — hoy solo son cableables los nodos que ya venían en el `Blueprint` inicial (autorados en el plano de origen), porque el modo cableado de `MissionInteractionController` solo detecta clicks sobre nodos YA EXISTENTES en el grafo. Cualquier pieza con propiedad funcional `EM`/`COND`/`RES` instalada DURANTE una misión — vía `queueInstall` directo o, más relevante para esta subfase, recién sintetizada en la mesa de creación y reinstalada — queda sin forma de conectarse al resto del circuito. Resolver esto antes o junto con "Improvisación en Pausa Táctica": si la mesa permite crear y reinstalar una pieza en pleno juego pero esa pieza no se puede cablear, el flujo de esta subfase queda a medias.


* **Improvisación en Pausa Táctica:** Integrar la mesa de creación visual (`workbench/` y `workbench-renderer.ts`) directamente en el modo de Planificación de la misión activa. Diseñar el flujo de entrada/salida de la mesa de forma que el proceso de creación consuma tiempo de un tripulante encolado mediante una tarea específica.


* **Síntesis Química element $\rightarrow$ compuesto:** Completar la interfaz visual de la mesa para permitir la combinación de elementos del catálogo atómico (`element-catalog.ts`) para producir compuestos derivados (`compound-catalog.ts`), validando el caso de validación 12.



#### Subfase 11d: Sistemas de Amenazas y Enemigos (Mínimo Core)

* **Actor Hostil:** Crear un dominio básico de amenazas (`engine/src/threat/`). Los enemigos serán actores mínimos con HP y una sección asignada, capaces de infligir daño. Se moverán utilizando el sistema de salto `hop-movement.ts` de la Fase 8.


* **Reglas de Combate:** Expandir `CrisisDefinition` con un disparador y regla de resolución de amenazas (eliminar o contener a los intrusos en una sección), integrando el caso de validación 1 (torreta improvisada).



#### Subfase 11e: Identificación Médica de Mezclas

* **Revelación de Parámetros:** Añadir el efecto de tarea (`TaskEffect`) de "Analizar Sustancia". Cuando un tripulante de especialidad Médico (Fase 9) complete esta tarea sobre una "Mezcla sin identificar", el inspector de componentes de la UI de `/game` pasará de mostrar etiquetas genéricas a detallar los valores numéricos exactos de su radio de explosión y su tasa de degradación estructural.



#### Subfase 11f: Legibilidad del Plano — Capas y Flujo Animado (GDD §10)

Esta subfase resuelve dos requisitos de UI/UX que el GDD §10 especifica como parte del contrato base del plano (no como pulido opcional) y que hoy están a medias: los datos y el color por tipo de recurso ya existen (`ConduitKind` en `engine/src/floorplan/floorplan.types.ts`, `CONDUIT_COLORS` en `game/src/render/palette.ts`, consumidos por `drawConduit()` en `floorplan-renderer.ts`), pero falta el control de HUD y el cableado a la escena real del juego. Se agrupan porque comparten el mismo dato y la misma superficie de renderizado: un toggle que oculta una capa debe ocultar/atenuar también sus partículas de flujo.

* **Toggle de Capas:** Permitir al jugador filtrar las conexiones visibles en el mapa activando o desactivando las capas eléctrica, de fluidos, estructural y de señales mediante botones dedicados en el HUD. Las capas inactivas se dibujarán con una opacidad reducida.

* **Integración de Flujo Animado en el Plano Real:** Cablear `createConduitFlowEffect()` (`game/src/particles/effects/conduit-flow-effect.ts`), hoy solo usado en `particle-gallery-scene.ts` (debug), a `floorplan-scene.ts`/`floorplan-renderer.ts` para que todo conducto activo muestre partículas de flujo en el juego real, con densidad/velocidad proporcional al caudal (GDD §10). El toggle de capas debe controlar la visibilidad de estas partículas junto con la del conducto correspondiente — un único sistema de visibilidad, no dos paralelos.



#### Subfase 11g: HUD de Estado General de la Nave y Acciones Contextuales

Reemplaza el panel fijo de acciones (`mission-action-panel.ts`, Fase 10d) como elemento permanente de la UI de misión por un HUD de estado siempre visible, y convierte las acciones (desmontar, instalar aquí) en un panel contextual que aparece solo ante una selección/interacción válida.

* **Diseño de HUD de Estado:** Diseñar qué indicadores muestra el HUD permanente — mínimo: atmósfera, soporte vital, integridad de casco y energía — y cómo cada uno reacciona visualmente a las crisis en curso (degradación gradual, alertas). Debe ser un estado agregado a nivel de nave, no solo por sección: hoy el motor solo expone estos datos por sección (`atmosphere-snapshot.types.ts`, `structural-failure.ts`) y no existe ningún sistema de energía (`PowerGrid`/`EnergyGrid`) en `/engine`.

* **Agregación de Estado a Nivel de Nave (motor):** Añadir en `/engine` la lógica que resume atmósfera, soporte vital y estructura de todas las secciones en un estado global de nave (criterio a definir en el diseño: peor caso vs. promedio), y sentar las bases mínimas de un sistema de energía si no existe ninguno del que partir.

* **HUD Permanente (UI):** Implementar el widget de HUD de estado en `/game`, ocupando el espacio hoy fijo del panel de acciones.

* **Panel de Acciones Contextual:** Adaptar `MissionInteractionController` y `renderMissionActionPanel` para que el panel de acciones (desmontar, instalar aquí) deje de ser fijo y aparezca de forma contextual (ej. junto a la selección o al pasar el cursor), sin perder ninguna acción hoy disponible.



#### Subfase 11h: Piezas Atómicas de Salida de Información — Indicador LED y Pantalla LCD

Extiende el catálogo atómico (GDD 7.2) con dos piezas nuevas cuyo único propósito es visualizar el estado de una señal — el hueco que hoy impide aplicar el pilar de legibilidad total (GDD §11.1) al estado en reposo de un nodo, no solo a eventos. Documento fuente: `docs/Extension_indicador_led_pantalla_lcd.md`.

* **Indicador LED (versión base, sin dependencias):** Nueva pieza atómica `REC`, footprint 1×1, feedback visual binario (encendido/apagado) del estado de la señal a la que está cableada. Se implementa apoyada exclusivamente en el sistema de tinte en runtime ya existente (GDD 11.0) — no depende de ningún sistema pendiente de construir. *(Nota: el documento fuente referencia "sub-fase 11e" como dueña del sistema de luces aditivas; en este plan esa función corresponde a la Subfase 12a — referencia desactualizada del documento original, corregida aquí.)* La versión con intensidad graduada (mismo patrón que `MAG`, Fase 11a) se implementa después, ver Subfase 12a → "Potenciar Indicador LED con intensidad graduada".

* **Pantalla LCD:** Nueva pieza atómica `REC` independiente (no es receta ni compuesto de otras piezas), footprint 2×1, muestra el valor real de la propiedad del nodo cableado (no solo estado binario): ON/OFF de un `REC`, nivel de un `RES`, valor cualitativo de una propiedad de material, o estado/contador de un latch. Cableable opcionalmente a un Chip de circuito genérico (GDD 7.2) para lógica de formato — el chip es opcional, no un ensamblaje. Requiere renderizado de texto dinámico con intervalo de actualización de 250-500ms (no por frame). Las etiquetas de texto (ON/OFF, nombres de estado) deben pasar por el sistema de claves de traducción (CLAUDE.md); los valores numéricos puros no lo requieren.

* **Sub-categoría conceptual — "actuador de salida de información":** Aclarar dentro de la semántica de `ACT` (GDD 5.1) que LED y LCD no producen trabajo físico, solo visualizan estado de otro nodo — sin alterar el modelo de propiedades existente.

* **Caso de validación 18 — "El Panel de Diagnóstico Improvisado":** Cablear una Pantalla LCD al sensor de presión de una sección con fuga de gas activa, mostrando el nivel restante en tiempo real. Valida el Indicador LED como pieza base, la lectura de valor real del LCD, y la integración con el sistema de atmósfera (GDD 5.5) como fuente de datos. Verificar que no choque con el caso 17 (Extensión de aceleración magnética, Fase 11a).

* Cada pieza requiere su propio test unitario en `/engine` antes de darse por integrada, siguiendo el estándar de CLAUDE.md.



### Fase 12 — Pulido Estructural Sensorial: Luces y Audio

El objetivo aquí es asegurar la inmersión visual y el feedback diegético necesario antes de masificar los niveles.

#### Subfase 12a: Iluminación Dinámica y Estados de Daño

* **Iluminación Aditiva Dinámica:** Crear un renderizado de luces aditivas simples por código en `/game` (sprites radiales con opacidad variable y tintado en tiempo real). Implementar un parpadeo de alerta en toda la pantalla de juego o en la sección afectada cuando ocurran fugas o incendios críticos.


* **Estados de Daño de Fondo:** Integrar efectos de daño persistentes (`StateDrivenEffect` de la Fase 8) vinculados a las cicatrices activas (por ejemplo, chispas eléctricas continuas de un conductor sobrecargado o parpadeos de luz ambiental en secciones sin energía).


* **Potenciar Indicador LED con intensidad graduada (depende de: Subfase 11h):** Una vez disponible el renderizado de luces aditivas de esta subfase, extender el Indicador LED (11h) para que su intensidad escale bajo/medio/alto junto con el emisor de origen (mismo patrón que `MAG`, Fase 11a), en vez de quedar limitado al binario por tinte con el que se implementó originalmente.



#### Subfase 12b: Sistema de Audio Diegético

* **Audio por Fenómenos:** Crear el dominio `game/src/audio/` e importar un pack de sonido industrial y de ciencia ficción. Vincular la emisión de sonido con el `effect-registry.ts`, permitiendo al jugador oír siseos en fugas de gas, zumbidos graves en sobrecargas eléctricas y sonidos burbujeantes de corrosión.


* **Barks de Voz:** Disparar sonidos breves o barks de texto formateados según la personalidad del tripulante encolado ante fallas críticas, heridas graves o el deceso de un compañero.



#### Subfase 12c: Micro-interacciones, Juice y Personalidad de la UI

Modelo recomendado: Sonnet 3.5 para la implementación de transiciones en /game.  

- **Motor de Transiciones de Phaser:** Implementar un helper de UI (game/src/ui/ui-effects.ts) para registrar configuraciones de tweens estándar de apertura/cierre (popIn, slideOut, clickReaction) reutilizables por cualquier widget (briefing, objetivos, selectores).  
- **Sistema de Sacudida (Shake) y Destello de Contenedores**: Desarrollar funciones para agitar contenedores de interfaz de forma independiente al mapa ante errores o colisiones cinéticas.  
- **Cursor Contextual Reactivo:** Crear un controlador de cursor (game/src/ui/custom-cursor.ts) que escuche el estado del MissionInteractionController (Fase 10d) y actualice el sprite del puntero según la acción válida bajo el ratón.  
- **Efectos de Alerta de Pantalla Completa:** Añadir un overlay de viñeta roja pulsante en la cámara del HUD (hudCamera, Fase 10d) que sincronice su frecuencia de pulso con el temporizador crítico de CrisisRuntime.  
- **Shakers en Retratos de Tripulación:** Conectar los eventos de daño recibidos del motor (crew-damaged, Fase 9) directamente con tweens de escala y rotación en la tira de personajes (crew-strip.ts, Fase 10b).
- **Filtros de Estado (ColorMatrix):** Los retratos en la tira horizontal (Fase 10b) deben reaccionar al estado de salud del tripulante.  
   - Si un tripulante entra en una sección con gas tóxico, su retrato debe parpadear sutilmente con un tinte verdoso.  
   - Si sufre daño grave o muere, el retrato debe temblar violentamente antes de apagarse con un efecto de estática analógica
- **Filtro de aberración cromática/barrido:** Un shader sutil de pantalla CRT sobre la cámara del HUD (hudCamera, Fase 10d) para que los textos pixelados y los bordes tengan ese brillo de fósforo retro.
- **Recolección Visible de Elementos Atómicos:** Al desmontar un componente, mostrar el nombre de cada elemento atómico obtenido por separado (texto ascendente individual por elemento, no un único string concatenado con todos), y disparar por cada elemento una partícula de tipo "coleccionable" con trayectoria vistosa hacia el botón de mesa (`createWorkbenchButton`, `floorplan-scene.ts`), al estilo de otros juegos con recolección de objetos. Construye sobre el efecto de desmontaje ya existente (`dismantleEffect`, `game/src/particles/effects/fabrication-effect.ts`).
- **Creación Compuesta con Sprites Reales (deuda `PENDIENTES_OBSERVACIONES.md` #8):** Una creación instalada (`creation-XXXX`) se dibuja hoy como rectángulo placeholder en el plano de misión porque no tiene sprite propio. Descomponer el compuesto (su receta) y pintar el sprite de cada parte en su offset dentro del footprint, con fallback al placeholder cuando falte alguno. Distinto de la mesa de creación (deuda #7, ya resuelta): esto es el plano de misión. Refuerza la "satisfacción de deconstrucción" de Shipbreaker junto con la recolección de elementos de arriba.


#### Subfase 12d: Sombras Dinámicas (planificada 2026-07-29, pendiente de ciclo de preguntas propio)

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



### Fase 13 — Gaps de Motor de las Comparativas de Género

Estos cuatro sistemas de motor se detectaron *después* de cerrar la Fase 11, al evaluar Kludge contra los referentes del género (Barotrauma, Duskers, FTL, Shipbreaker — ver `docs/comparativas-juegos/`). No son pulido sensorial (eso es la Fase 12), sino infraestructura que los capítulos posteriores asumen — por eso se ubican **antes del Cap.2** y no como apéndice de la Fase 11 ya cerrada. El orden interno respeta las dependencias: 13a desbloquea la lógica de señales del Cap.2; 13d depende de 13b.

#### Subfase 13a: Simulación de Emisores y Cascada de Fallas Emergente

Resuelve dos deudas técnicas registradas en `PENDIENTES_OBSERVACIONES.md` (#3 emisores siempre disparados, #16 reacciones químicas sin llamador de producción en misión) que, juntas, impiden que las fallas se encadenen de forma **emergente** — el mayor logro de Barotrauma (agua conductora → cortocircuito → sobrecarga → incendio). Sin esto, las cascadas de crisis son secuencias scripteadas en la `CrisisDefinition`, no propagación real entre sistemas, y la lógica de señales del Cap.2 (Fase 14) no puede depender de que un sensor se dispare de verdad. Es infraestructura de motor de máxima prioridad: desbloquea contenido posterior.

* **Simulación de Emisores (deuda #3):** Reemplazar `allEmittersActive` (`engine/src/mission/mission-signal-runtime.ts`), que activa TODOS los nodos emisores cada tick, por una evaluación real de `EmitterProperty` (`range`/`triggerType`/`frequency`) contra el mundo — un sensor de movimiento comprueba si hay un tripulante/enemigo en su rango. Se enchufa en el `EmitterInputSource` ya inyectado, sin reescribir el runtime. Desbloquea cualquier capítulo cuya lógica dependa de que un sensor se dispare de verdad (Cap.2 en adelante).

* **Runtime de Reacciones Químicas en Misión (deuda #16):** Añadir a `MissionRuntime` el llamador de producción que hoy no existe para `ReactionResolver`/reglas de combustión (`engine/src/chemistry/reaction/rules/combustion.ts`) — igual que `OverloadRule` ya se evalúa en vivo. Esto dispara `CombustionEvent` en partida real (no solo en tests), habilitando `combustionEffect` y que el overlay de alerta de pantalla completa reaccione a incendios reales. Revisar de paso si el `PointLight` de `combustion-effect.ts` necesita el `LightHook` de 12a.

* **Cascada Emergente:** Con emisores simulados + química en vivo + `OverloadRule` ya existente, permitir que una falla propague a otra por el estado compartido del mundo, sin scriptear la secuencia. Añadir su test de integración (una falla dispara la siguiente sin definición explícita del encadenamiento).

#### Subfase 13b: Presupuesto de Energía de la Nave (Gap ③, estilo FTL)

Realiza el sistema de energía que 11g dejó como stub ("no existe ningún sistema de energía `PowerGrid`/`EnergyGrid`… sentar las bases mínimas"). Convierte el triaje de recurso escaso de FTL en un sistema propio, reconciliado con el modelo físico de canibalización de Kludge. Es el substrato del sacrificio de energía del Cap.5 (Fase 18). Diseño cerrado en ciclo de preguntas 2026-07-29.

* **Dominio de Energía (motor):** Nuevo `engine/src/power/` con un presupuesto total = suma de las **unidades discretas** que aporta cada fuente conectada (reactor + baterías + panel solar, `RES(E)`). Canibalizar/conectar una fuente extra sube el total.

* **Reparto en dos niveles:** (1) **global → sección**: el jugador asigna bloques de unidades enteras por sección; lo no asignado deja la sección a oscuras (triaje manual). (2) **sección → componentes**: cada componente tiene una prioridad manual (set-and-forget); el pool de la sección alimenta a los componentes en orden de prioridad hasta agotarse; los que quedan bajo su umbral no arrancan.

* **Reconciliación con cicatrices:** una sección cicatrizada (Cap.5 / 11b) queda permanentemente fuera de la grilla; el reparto vivo opera sobre el resto. `unpoweredSectionIds` pasa de flag de cicatriz a **consecuencia del presupuesto + cicatriz permanente** — reconciliar ambos sentidos.

* **Capa de Energía en el Plano (UI):** Nueva capa del toggle de 11f con **heatmap** de demanda vs. suministro; el dial de reparto por sección es discreto (+1/−1 unidad), operado en modo pausa. Sin panel de barras abstracto — anclado al plano, mitigando el riesgo que el GDD §16 marca. La prioridad por componente se fija reordenando los componentes en el inspector de la capa.

* **Estado dinámico:** la asignación de unidades y las prioridades por componente se serializan (encaja en el guardado de 11b, bump de schema).

* *Nota de consistencia:* el conteo de unidades es una excepción **deliberada** a la escala cualitativa bajo/medio/alto del resto del motor (§5.2) — contar 1/2/3 unidades es distinto de exponer porcentajes exactos, asumido como tal.

* Test unitario del reparto (déficit global + triaje interno por prioridad) antes de integrar.

#### Subfase 13c: Degradación Funcional de Componentes (Gap ①)

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

#### Subfase 13f: Integridad de Casco por Sección (diseño cerrado 2026-08-05)

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

* Test unitario por escritor de daño + integración "una explosión abre una brecha que drena presión"; la cicatriz permanente debe sobrevivir un round-trip de guardado.

#### Subfase 13g: Consumo Eléctrico Real — que el reparto de energía gatee algo (2026-08-07)

Surgida del playtest de 13e ronda 2: el operador preguntó si las mesas de creación dejan de funcionar cuando su sección no tiene energía, y si pasa lo mismo con un chip lógico en soporte vital. **La respuesta es que no, y el hueco no son las mesas: 13b construyó toda la maquinaria de reparto — presupuesto, asignación por sección, triaje de prioridad por componente, déficit — pero nada declara DEMANDA, así que los dos predicados de gating que el motor expone están degenerados.**

Estado auditado antes de planificar:

* **Ninguna pieza del catálogo declara `powerDraw`.** El campo solo aparece en `properties/functional.types.ts:34` (dentro de `ActuatorProperty`), en la lógica de reparto y en tests. Como `allocateComponentPower` (`power-allocation.ts:131`) calcula la demanda leyendo ese campo, **`isInstancePowered` devuelve `true` para todo, siempre** — el nivel 2 del reparto es funcionalmente inerte y el inspector de prioridad dice "alimentado" hasta con la sección a cero.

* **El runtime de señales SÍ implementa el gating, por dos vías que están muertas** (`mission-signal-runtime.ts:105-127`): `powerScars.unpoweredSections()`, que devuelve la cicatriz PERMANENTE (`permanentlyDisconnectedSectionIds`, vacía en campaña nueva), e `isInstancePowered`, siempre `true`. Ninguna consulta `sectionHasNoPowerGranted`, que es el único predicado con señal real. **Un chip en una sección a oscuras evalúa y emite normalmente.**

* **Química, atmósfera y todas las tareas de tripulación ignoran la energía**: fabricar, sintetizar, analizar y extraer no la consultan en ningún punto.

* Hoy cortar la energía a una sección produce **solo** oscuridad + parpadeo, y que desmontar ahí no chispee (13d, el único consumidor con gating funcional real — vía `isInstanceEnergized`, no vía `isInstancePowered`). El dial de reparto mueve agujas que no controlan nada.

Alcance de la subfase:

* **`powerDraw` sube de `ActuatorProperty` a dato de componente.** Hoy vive dentro del tag `ACT`, así que una pieza que no es actuador — un chip lógico, un sensor, una mesa — no tiene dónde declarar consumo. Pasa a `PhysicalComponentDefinition.data`, junto a `footprint`, que ya sienta el precedente de "dato de componente que no es un tag del GDD". Migrar el único lector (`power-allocation.ts:131`) para que haya **una sola fuente de verdad**, no dos. Decisión del ciclo de preguntas: consumo **declarado por pieza**, no derivado de propiedades — porque es lo que permite que una pieza se quede sin energía aunque su sección tenga algo, que es justamente para lo que existe el triaje de prioridad de 13b.

* **Poblar `powerDraw` en el catálogo**, data-driven: tabla de consumos por clase en `engine/src/power/power-parameters.ts` (molde de `salvage-parameters.ts`), no literales dispersos por los catálogos. Criterio de partida — sensores/chips/indicadores 1, actuadores 2, mesas y equipamiento pesado 3. Los números concretos son de balanceo (Fase 23); lo que cierra esta subfase es que **existan y se respeten**.

* **Señales:** al declararse la demanda, `isInstancePowered` deja de ser siempre-`true` y el gating que `outputOf` ya implementa empieza a funcionar solo. Revisar además el fail-open de `mission-power-runtime.ts:112-118` (toda instancia sin sección resoluble se fuerza a alimentada) y la vía muerta de `unpoweredSections()`.

* **Mesas (`FAB`):** banco y estación declaran `powerDraw` (decisión del operador: **las dos**, no solo la química); `openWorkbench` (`floorplan-scene.ts`) gana su tercer guard y el botón dice el motivo. El panel de acciones **ya soporta esto**: `fabricatorBlocked` es un motivo tipado (13e ronda 2) hoy con un solo valor `"execution"` — se le añade `"unpowered"` y el patrón de label queda igual.

* **Tarea en curso:** si la sección pierde energía mientras se ejecuta, la tarea pasa a `failed` con notificación (decisión del operador; principio 5 — quedarse sin energía a mitad de una síntesis cuesta algo). `task-failed` y su aviso ya existen: falta el gancho que lo dispare.

* **Legibilidad (principio 6):** hoy la falta de energía se ve **por sección** (tinte + luz parpadeante, `redrawUnpoweredSectionScar`) pero no **por componente**. Una pieza apagada por triaje dentro de una sección con energía parcial no se distingue de una encendida — hace falta su representación, o el gating es invisible.

* **GDD:** revisar §5.1 (la línea de `FAB` escrita en 13e dice que no se modela como `ACT` porque no convierte energía en trabajo). Sigue sin ser `ACT` — no hace trabajo físico sobre el mundo — pero sí **requiere alimentación para operar**. Documentar `powerDraw` como dato de componente y no como campo de `ACT`.

* **Cierre:** un chip en una sección a 0 unidades no emite; las dos mesas no se abren y lo dicen; cortar la energía a mitad de una síntesis la hace fallar con aviso; y una pieza apagada se distingue a simple vista de una encendida. Tests unitarios de reparto con demanda real + integración "sección a oscuras ⇒ la señal no llega".



### Fase 14 — Capítulo 2 y Acoplamientos Cruzados de Motor

Agrupa, con el mismo criterio que separó la Fase 13 de gaps de motor del contenido de campaña, los acoplamientos entre dominios detectados al auditar si el motor sostiene fallas verdaderamente sistémicas (análisis de sesión 2026-08-11, ver `PENDIENTES_OBSERVACIONES.md` #34 para los pares evaluados y diferidos). Se ubican antes del Cap.2 porque lo alimentan directamente — el sensor químico y el sensor térmico son insumo de su diseño de nivel.

#### Subfase 14a: Dominio de Temperatura

Sexto eje del motor junto a energía/presión/química/señales/estructura — especificado en el GDD §5.2 y la Especificación de datos técnicos (efecto térmico de neutralización ácido+base) pero sin ningún campo de estado hasta ahora. Entra antes de la demo por los efectos naturales que desbloquea (combustión con rastro real, tercer sensor del Cap.2, enfriador cableable), no solo por ser prerrequisito no declarado de la Fase 17 (Cap.4, caso de validación 2).

* **Estado:** `temperatureC` en `SectionAtmosphere`/`SectionAtmosphereSnapshot`, nominal 20°C.
* **Escritores:** reacción exotérmica (neutralización), sobrecarga eléctrica (`OverloadEvent` modo fire), combustión (`CombustionEvent`, proporcional a `intensity`), enfriador/regulador térmico activo (`ACT` nuevo, gateado por energía), deriva pasiva hacia nominal.
* **Lectores:** conductividad `CE`/`CT` variable (modula `OverloadRule`), cambio de estado de sustancia (L↔S↔G), `thermalRegulatorOverloaded` real (hoy hardcodeado `false` en `MissionReactionRuntime`), quinto escritor de daño estructural (13f), sensor térmico nuevo (`triggerType: "temperatura"`, mismo molde que `pressureAwareEmitterInputs`).
* Cierra el ciclo combustión→calor→cortocircuito→combustión: la cascada multi-salto que hoy el motor no sostiene.
* Test unitario por escritor/lector + integración "combustión sube temperatura que degrada conductor".

#### Subfase 14b: Sensor Químico y Enfriador Cableable (Química↔Señales)

* **Química → Señales:** nuevo `triggerType: "quimico"` en `EmitterProperty` + pieza "sensor químico" + `chemicalAwareEmitterInputs` (mismo molde que `pressureAwareEmitterInputs`), disparado por `contaminantAt`/`airborneSubstanceAt` sobre umbral.
* **Señales → Química:** actuador `ACT` "válvula automática" — con señal activa ejecuta `drawFrom`/`emptyReservoir` (`reservoir-ledger.ts`) o bloquea `apply-substance`. Generaliza `SignalOutputReader`, hoy consumido solo por cinética (bobina electromagnética).
* Con esto el Cap.2 gana un tercer tipo de sensor (junto al de movimiento y el térmico de 14a) para su diseño de nivel AND/OR/NOT, y el Cap.1 gana la primera herramienta de corte automático de una fuga.

#### Subfase 14c: Capítulo 2 — "Ecos en el Pasillo"

* **Lógica Avanzada de Señales:** Diseñar el nivel de forma que requiera construir filtros AND/OR/NOT en la capa de señales utilizando sensores de movimiento, químico y térmico (14a/14b) y el chip de identificación de tripulación.


* **Amenaza Física Real:** Introducir el primer actor enemigo (11d) que el jugador deba neutralizar de forma activa para completar la misión.



### Fase 15 — Hito: Publicar Demo en Itch.io y Página de Steam

* **Contenido de la Demo:** Limitar la build a los Capítulos 1 y 2 con el arquetipo de Exploración completamente jugable (único con tile art pulido).


* **Estrategia de Captación:** Habilitar la importación/exportación de archivos JSON de Blueprints desde la mesa creativa para fomentar la viralización comunitaria. Redirigir el final de la demo a la página de Steam para acumular wishlists.

* **Intro narrativa / reporte de incidente (Obs 0 de `PENDIENTES_OBSERVACIONES.md`):** un par de escenas con texto que se escribe contando lo que pasa ANTES de ver el plano (formato "reporte de incidente"), para dar contexto y mejorar la primera impresión / captación de wishlists. **Pendiente de su propio ciclo de diseño narrativo** (alcance, tono, formato, i18n — sin hardcodear strings, CLAUDE.md). Como no existe ningún sistema narrativo previo en el proyecto, no iniciar sin ese ciclo.



---

## Q2 (Meses 4–6): Meta-progresión y Escalado de Niveles Medios

Este trimestre se enfoca en expandir la jugabilidad con la introducción de variables de tiempo y memoria, agregando mecánicas de progresión persistente para retener a los jugadores de la demo.

### Fase 16 — Capítulo 3: "La Alarma que no Calla"

* **Lógica de Memoria:** Implementar el diseño de nivel que requiere el uso del comportamiento `latch` (memoria síncrona) para capturar alertas fugaces de sensores de presión.


* **Cicatriz Permanente:** El desenlace de la crisis genera la primera reducción persistente de la resistencia estructural (`RE`) en la sección afectada de la nave.



### Fase 17 — Capítulo 4: "Cortocircuito en la Bahía de Carga"

* **Física de Materiales:** El nivel introduce el comportamiento de cambio de estado y conductividad de fluidos variables con la temperatura (caso de validación 2). El jugador se enfrenta a un límite estricto de 90 segundos para enfriar un cableado o congelar una fuga de refrigerante.



### Fase 18 — Capítulo 5: "El Reactor al Límite"

* **Pilar de Sacrificio:** Crisis avanzada de sobrecarga del reactor principal. El jugador debe tomar la decisión permanente de drenar y desactivar permanentemente la energía de una sección no crítica para salvar el soporte vital. La sección sacrificada se guarda como "sin energía" en la partida persistente de la campaña (11b).



---

## Q3 (Meses 7–9): Complejidad Avanzada, Cierre de Campaña y Steam Next Fest

Es el momento de introducir la simulación cruzada y participar en el festival de demos de Steam con un tráiler profesional.

### Fase 19 — Capítulo 6: "Ataque y Fuga Simultánea"

* **Simulación Multi-Falla:** Dos emergencias paralelas: abordaje hostil avanzado (11d) y fuga de amoníaco tóxico en el invernadero. Exige coordinar dependencias directas en la cola de tareas de la tripulación (Caso 14) y usar la mesa de creación en vivo en plena misión (11b) para ensamblar defensas improvisadas.



### Fase 20 — Capítulo 7: "Las Cicatrices Vuelven"

* **Callback de Campaña:** El juego consulta el estado persistente guardado (11b). La sección con resistencia `RE` reducida en el Capítulo 3 o la zona desenergizada en el Capítulo 5 falla ante una fuga corrosiva y tóxica cruzada (caso de validación 13 de orden de prioridad entre tags simultáneos). Exige realizar síntesis química en la mesa de creación (11b) para neutralizar el ácido.



### Fase 21 — Capítulo 8: "Punto de No Retorno"

* **Maniobra de Navegación (Piloto):** Introducir la mecánica de evasión a nivel de nave espacial (Caso 16), forzando al tripulante de rol Piloto a operar los actuadores de propulsión de la nave bajo una cuenta regresiva estricta.


* **Clímax:** Una cascada de fallas en múltiples secciones simultáneas donde la resolución depende exclusivamente de la ruta de reconstrucción atómica desde cero (desarmar compuestos inutilizados en la mesa de creación para obtener piezas elementales limpias).



---

## Q4 (Meses 10–12): Pulido de Arquetipos, Telemetría, Balanceo y Publicación

El trimestre final se enfoca en el aseguramiento de la calidad técnica, el soporte multiplataforma y la salida al mercado.

### Fase 22 — Pulido General de Contenido e i18n

* **Fase 22a (Soporte de Arquetipos):** Extender la verificación de los 8 capítulos jugables a las naves de Investigación, Guerra y Médica, resolviendo anomalías de anclaje visuales específicas de cada plano.
   - **Autoría de conductos `senal`/`fluido` en los otros arquetipos (deudas #13/#14 de `PENDIENTES_OBSERVACIONES.md`):** hoy la capa `conductos` `senal` solo está autorada en `nave-exploracion` y no hay ningún conducto `fluido` en ningún mapa. Sin conductos `senal`, un cable de señal cross-section queda bloqueado (`assertSignalWiringReachable`), así que el Cap.1 de investigación/guerra/médica no se puede cablear. Autorar en Tiled (capa `conductos`, propiedades `kind`/`a`/`b`) los `senal` que cada arquetipo necesite y los `fluido` en general. Tarea de contenido/diseño de nivel, encaja con la extensión de capítulos a estos arquetipos.


* **Fase 22b (Desbloqueos):** Integrar la UI del árbol de logros de GDD §6.8 para reclutar tripulantes nombrados con habilidades pasivas fijas basadas en el estilo de juego del jugador.


* **Fase 22c (Localización):** Auditoría total de los diccionarios de i18n en español e inglés.



### Fase 23 — Balanceo Técnico & Telemetría de QA

* **Ajuste de Parámetros:** Refinar las variables físicas y químicas de la Especificación técnica §1-§4 basándose en el playtesting de los 8 capítulos en paralelo.


* **Telemetría de Diseños:** Crear un script local de análisis de datos para capturar los esquemas JSON de los Blueprints que utilicen los testers. Esto permitirá identificar si el motor sufre de soluciones "receta" degeneradas que invaliden la emergencia del juego.



### Fase 24 — Empaquetado Standalone y Lanzamiento

* Configurar los builds nativos de Electron para Windows, macOS y Linux.


* Publicación de la versión 1.0 en Steam.



### Fase 25 — Modo Dev de Autoría de Estado Inicial (Baja Prioridad)

* Se mantiene en backlog de baja prioridad, utilizándose solo de forma interna si el volumen de naves del operador lo exige.



---

# Tabla de Validación de Feedback y Cobertura de Gaps

Para asegurar que no quede ningún cabo suelto del feedback técnico y comercial que hemos discutido, validamos las adiciones mecánicas e infraestructurales en la siguiente matriz de correspondencia:

| Gap o Feedback Reportado | Fase / Subfase de Resolución | Tipo de Solución en el Plan |
| --- | --- | --- |
| **ASA Flaw 1: Masa Virtual**<br> | **Fase 11a**<br> | Lógica de motor modificada en `KineticImpactRule`.

 |
| **ASA Flaw 2: Inercia Infinita**<br> | **Fase 11a**<br> | Implementación de arrastre de velocidad cualitativa (Drag).

 |
| **ASA Flaw 3: UX de Temporización**<br> | **Fase 11a**<br> | Implementación de trayectorias fantasma en el modo pausa.

 |
| **UX: Identificación de Mezclas**<br> | **Fase 11e**<br> | El Médico analiza sustancias para revelar números exactos.

 |
| **UX: Mesa visible en Misión**<br> | **Fase 11b**<br> | Acceso a la mesa en pausa táctica costando tiempo de actor.

 |
| **Gap: Save System Dinámico**<br> | **Fase 11b**<br> | Guardado y persistencia real a disco con Electron.

 |
| **Gap: Cicatrices de Campaña**<br> | **Fase 11b / 20**<br> | Guardado de RE reducido y zonas sin energía + callbacks.

 |
| **Gap: Legibilidad del Plano (Capas + Flujo Animado, GDD §10)**<br> | **Fase 11f**<br> | Toggle de capas HUD + integración de `conduit-flow-effect` al plano real.

 |
| **Gap: Falta pieza de feedback visual de señal (LED/LCD)**<br> | **Fase 11h**<br> | Dos piezas atómicas nuevas (Indicador LED, Pantalla LCD) + sub-categoría "salida de información" + caso de validación 18.

 |
| **Gap: Iluminación Dinámica**<br> | **Fase 12a**<br> | Luces aditivas, pulsos de alerta y parpadeos en cables.

 |
| **Gap: Audio Sistémico**<br> | **Fase 12b**<br> | SFX reactivos por reglas e integración de barks de voz.

 |
| **Gap: Balanceo y Telemetría**<br> | **Fase 23**<br> | Registro de Blueprints de QA para interceptar meta-soluciones.

 |
| **Gap: Mitigar Frustración / Dead Ends**<br> | **Fase 11b (Save System)**<br> | El guardado manual y el sistema de reintento de misiones previenen bloqueos insalvables.

 |
| **Estrategia de Wishlists**<br> | **Fase 15 (Demo)**<br> | Integración del importador de Blueprints en la demo para viralidad.

 |
| **Comparativa Barotrauma — Cascada de fallas emergente + emisores simulados**<br> | **Fase 13a**<br> | Simulación real de `EmitterProperty` (deuda #3) + runtime de reacciones químicas en misión (deuda #16) → propagación entre sistemas sin scriptear.

 |
| **Comparativa FTL — Gap ③: Triaje de energía zero-sum**<br> | **Fase 13b**<br> | Dominio `power/` con presupuesto en unidades discretas, reparto sección→componente y capa de energía con heatmap en el plano.

 |
| **Comparativa Duskers — Gap ①: Hardware degradado pero funcional**<br> | **Fase 13c**<br> | Campo `condition` por instancia; degradación = fragilidad (RE efectiva + riesgo de fallo), escrita por canibalización y corrosión.

 |
| **Comparativa Shipbreaker — Gap ②: Riesgo sistémico al desmontar**<br> | **Fase 13d**<br> | Hazard en el acto de desmontar una pieza viva, evitable con tarea previa de purga/corte; doble filo como herramienta.

 |
| **Comparativa FTL/Barotrauma — Semántica de color de diagnóstico**<br> | **Fase 12e**<br> | Contrato único de color de crisis (rojo/ámbar/cian) auditado contra LED, HUD y tags (deuda #15).

 |
| **Comparativa Shipbreaker — Satisfacción de deconstrucción (visual)**<br> | **Fase 12c**<br> | Recolección visible de elementos + creación compuesta dibujada con los sprites reales de sus partes (deuda #8).

 |
| **Playtest 12d — Bugs (Obs 3 pausa, Obs 7 fullscreen, deuda #5 sprite proyectil)**<br> | **Fase 12f**<br> | Bucket de fixes: pausar tweens de tripulación en planificación, arreglar fullscreen en negro, conservar `componentDefinitionId` del proyectil suelto.

 |
| **Fine-tunning — Pantallas de selección con personalidad**<br> | **Fase 12g**<br> | Tarjetas de tripulación (foto/personalidad/rol/descripción) + datos de nave por arquetipo (imagen exterior + / −).

 |
| **UX — Destino real de sustancias sintetizadas (Obs 4, deudas #9/#10)**<br> | **Fase 13e**<br> | Estación química con menú contextual + reservorio con sustancia+cantidad + extracción + caudal de fluido real.

 |
| **Deuda #6 — Agregación de material en creaciones**<br> | **Fase 13c**<br> | Prerrequisito: una creación hereda `RE`/`MAG` de sus partes para poder corroerse/degradarse.

 |
| **Deudas #13/#14 — Conductos `senal`/`fluido` en otros arquetipos**<br> | **Fase 22a**<br> | Autoría de contenido en Tiled para desbloquear el cableado cross-section del Cap.1 en investigación/guerra/médica.

 |
| **Playtest 13c — Integridad de casco derivada del RE de los componentes**<br> | **Fase 13f**<br> | Vida propia por sección (HP interno, display cualitativo) dañada por impacto/explosión/corrosión/descompresión; brecha + cicatriz permanente al llegar a 0. Reemplaza la agregación de 11g, parcheada de forma interina en 13c.

 |
| **Obs 0 — Historia / intro narrativa**<br> | **Fase 15 (Demo)**<br> | Escenas de intro tipo "reporte de incidente" antes del plano, pendientes de ciclo de diseño narrativo.

 |