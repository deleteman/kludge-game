
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



#### Subfase 12f: Fixes de Playtest de 12d

Bucket de fixes puntuales surgidos del playtest, siguiendo la convención de la Subfase 12c.7 ("Fixes de playtest"). Recoge observaciones abiertas de `PENDIENTES_OBSERVACIONES.md` (Obs 3, Obs 7, deuda #5).

* **Tripulantes se mueven en pausa (Obs 3):** los saltos de tripulación usan tweens de Phaser (`hopMove`, `game/src/crew/hop-movement.ts`) y nada los pausa al entrar en modo planificación — `floorplan-scene.ts` no pausa/reanuda esos tweens con el cambio de `coreLoop.mode`. Pausar/reanudar los tweens de movimiento de tripulación (y enemigos) sincronizados con `execution`/`planning`, mismo criterio ya aplicado al flujo de conductos en 11f.7.

* **Modo pantalla completa queda en negro (Obs 7):** el toggle de fullscreen deja la pantalla en negro sin errores en consola. Investigar el toggle (`options-scene.ts`, `scale.FIT` + `toggleFullscreen`, Fase 9.5) y el redimensionado de cámaras (mundo + `hudCamera`).

* **Proyectil suelto pierde su sprite de catálogo (deuda #5):** `LooseFerromagneticPromoter` (`engine/src/mission/loose-ferromagnetic-promoter.ts`) registra el `ProjectileBody` con `ref: placedComponentInstanceId` en vez del `componentDefinitionId`, así que `projectile-renderer.ts` cae siempre al círculo placeholder aunque el sprite de la pieza exista. Conservar el `componentDefinitionId` accesible al renderer (mapa `ref→componentDefinitionId` en `MissionRuntime`) sin ensuciar `ProjectileBody`/`kinetics/`.



#### Subfase 12g: Pulido de Pantallas de Selección

Pulido de UI de meta-menú (pantallas de Fase 9.5), coherente con 12c (personalidad de la UI). Recoge los ítems de fine-tunning de `PENDIENTES_OBSERVACIONES.md` sobre las pantallas de arranque de campaña. Da personalidad y "sensación profesional" a los primeros minutos.

* **Tarjetas de selección de tripulación (`crew-select-scene.ts`):** una tarjeta por tripulante con foto, nombre, personalidad (rasgo), rol/especialidad y descripción. Reutiliza el roster real (`CrewSpecialty`/`PersonalityTrait`/`CrewTier`, Fase 9). Si faltan sprites de retrato, avisar explícitamente con su ruta esperada (convención CLAUDE.md, `game/assets/sprites/crew/`).

* **Datos de nave en selección de arquetipo (`archetype-select-scene.ts`):** por cada nave, nombre propio (no del arquetipo), imagen exterior para dar color a la elección, su arquetipo y una descripción con los + y los − (ej. + armamento, − sensores). Reutiliza `SHIP_ARCHETYPES`. Avisar de sprites de nave faltantes con su ruta esperada.



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

#### Subfase 13d: Riesgo Sistémico al Desmontar (Gap ②)

Cierra el hueco de "riesgo al canibalizar" de Shipbreaker (cortar una tubería viva = hazard). Distinto de la pérdida de material (§6.5, coste de tiempo/piezas): es un hazard **puntual en el acto de desmontaje** según el estado vivo de la pieza. Depende de 13b, que define "pieza viva" con precisión (= recibiendo ≥1 unidad de energía). Diseño cerrado 2026-07-29.

* **Precondición de desmontaje seguro (motor):** en `ship-task-effect.ts` (resolución de desmontaje), evaluar si la instancia está viva (recibiendo energía / reservorio con contenido / sustancia peligrosa) y no fue purgada → emitir evento de dominio (`spark`/`leak`/`spill`) para `/game`.

* **Flujo evitable (tarea previa):** nueva `TaskEffect` de "cortar energía a sección" / "cerrar válvula / purgar reservorio" que marca la pieza como segura de desmontar. El jugador la encola antes; encaja en el grafo de dependencias del core loop (desmontar depende de purgar), premiando planificar en pausa.

* **Doble filo:** el mismo evento queda disponible como herramienta **deliberada** (provocar el chispazo, ligado a la trampa-de-chispa §5.5 / caso de validación 8).

* Test: desmontar conductor energizado sin purga → evento de chispa/combustión; con purga previa → seguro.

#### Subfase 13e: Destino Real de Sustancias — Reservorios, Extracción y Estación Química

Agrupa Obs 4 + deudas #9 y #10 de `PENDIENTES_OBSERVACIONES.md`: hoy una sustancia sintetizada (11c.3) se resuelve y queda `available` pero no puede verterse en nada ni tiene ubicación propia en el plano. Es el mismo sistema — dar un destino real a las sustancias. Substrato del Cap.7 (Fase 20, neutralizante sintetizado en la mesa). **Pendiente de su propio ciclo de preguntas** antes de plan de implementación (mismo criterio que 12d / "Potenciar LED"): exige decidir si `ReservoirProperty` se extiende con sustancia+cantidad o si el estado vive en un runtime aparte paralelo a `MissionAtmosphereRuntime`.

* **Estación química dedicada (Obs 4):** la síntesis deja de estar disponible libremente; se hace desde un aparato específico ("estación química", nombre a definir) cuyo menú contextual (panel de acciones de 11g) es "Fabricar sustancias" / "Desmontar".

* **Reservorio con sustancia+cantidad y mecánica de extracción (deuda #9):** extender `ReservoirProperty` (`engine/src/properties/functional.types.ts`) — o un runtime aparte — con `substanceId`/`amount`; añadir la mecánica de extracción de elementos (GDD 5.4.1) en vez de ofrecer el `ELEMENT_CATALOG` completo sin restricción de inventario. Habilita verter la sustancia en un reservorio o aplicarla sobre una atmósfera/hazard.

* **Caudal de fluido real (deuda #10):** la capa `fluido` del plano anima hoy con una heurística sin dato de caudal (`conduit-flow-heuristics.ts` reutiliza el booleano de energía). Al existir transporte de fluido/reservorios entre secciones, alimentar la capa con el dato real de caudal.

* Test unitario del vertido/extracción antes de integrar; caso de validación ligado al Cap.7.



### Fase 14 — Capítulo 2: "Ecos en el Pasillo"

* **Lógica Avanzada de Señales:** Diseñar el nivel de forma que requiera construir filtros AND/OR/NOT en la capa de señales utilizando sensores de movimiento y el chip de identificación de tripulación.


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
| **Obs 0 — Historia / intro narrativa**<br> | **Fase 15 (Demo)**<br> | Escenas de intro tipo "reporte de incidente" antes del plano, pendientes de ciclo de diseño narrativo.

 |