
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


#### Subfase 12d: Sombras Dinámicas ✅ CERRADA (2026-08-24)

#### Subfase 12e: Contrato de Semántica de Color de Diagnóstico ✅ CERRADA (2026-07-31)

#### Subfase 12f: Fixes de Playtest de 12d ✅ CERRADA (2026-08-03)

#### Subfase 12g: Pulido de Pantallas de Selección ✅ CERRADA (2026-08-03)

### Fase 13 — Gaps de Motor de las Comparativas de Género

Estos cuatro sistemas de motor se detectaron *después* de cerrar la Fase 11, al evaluar Kludge contra los referentes del género (Barotrauma, Duskers, FTL, Shipbreaker — ver `docs/comparativas-juegos/`). No son pulido sensorial (eso es la Fase 12), sino infraestructura que los capítulos posteriores asumen — por eso se ubican **antes del Cap.2** y no como apéndice de la Fase 11 ya cerrada. El orden interno respeta las dependencias: 13a desbloquea la lógica de señales del Cap.2; 13d depende de 13b.

#### Subfase 13a: Simulación de Emisores y Cascada de Fallas Emergente ✅ CERRADA (2026-08-04)

#### Subfase 13b: Presupuesto de Energía de la Nave (Gap ③, estilo FTL) ✅ CERRADA (2026-08-05)

#### Subfase 13c: Degradación Funcional de Componentes (Gap ①) ✅ CERRADA (2026-08-05)

#### Subfase 13d: Riesgo Sistémico al Desmontar (Gap ②) ✅ CERRADA (2026-08-05)

#### Subfase 13e: Destino Real de Sustancias — Reservorios, Extracción y Estación Química ✅ CERRADA (2026-08-06)

#### Subfase 13f: Integridad de Casco por Sección ✅ CERRADA (2026-08-24)

#### Subfase 13h: Puertas y Compartimentación

> **Orden de ejecución: 13f → 13h → 13g.** Se documenta acá, entre 13f y 13g, pero conserva la letra `h` para no
> renumerar 13g, que ya está registrada, commiteada y referenciada desde `PENDIENTES_OBSERVACIONES.md` y
> `changelog.log`.

Surgida del ciclo de preguntas de 13f (2026-08-24): al preguntar cómo sella el jugador una brecha, el operador
respondió "con una pieza, o cerrando la puerta de la zona" — y las puertas **no existen ni estaban agendadas en
ningún punto del plan**. El GDD 5.5 define el "aislamiento deliberado" (cerrar una válvula o sellar una puerta para
contener una fuga o privar de oxígeno a una sección) y hoy es letra muerta: los conductos `ventilacion` llevan un
`valveAperture` (0 = sellado) que se fija al construir la misión y que nada modifica en runtime.

Hay tres cosas ya construidas esperando exactamente esto: `compuerta-blindada` existe en el catálogo (`ACT` + `EST`,
RE-A) y no la usa nadie; el Cap.1 siembra un "panel de compuerta" como nodo receptor que no controla ninguna
compuerta; y el caso de validación 9 ("El Electroimán de Emergencia") solo verifica que se puede ensamblar el `MAG`,
porque **no hay ninguna puerta que trabar**.

* **Origen (decisión del operador): autoradas en Tiled + construibles.** Capa de objetos `puertas` nueva (Points con
  props `a`/`b`, molde de la capa `conductos`) y, además, cualquier componente con `ACT` + `EST` instalado sobre un
  umbral cuenta como puerta — identidad por propiedades, no por id de catálogo (principio 1).

* **Qué bloquea: atmósfera Y paso.** Cerrada corta la difusión entre secciones y bloquea a tripulación y enemigos.
  Señales **no** — ya se descartó explícitamente en el triaje de la Fase 16.

* **Modo `auto` por defecto + `override`.** En `auto` la puerta se abre para dejar pasar a un actor y se cierra sola
  el resto del tiempo; pasa a `override` cuando algo la gobierna (señal cableada, tarea del jugador, trabada por
  daño o por electroimán, o sin energía). Consecuencia buscada: **la nave está compartimentada por defecto**, así
  que una brecha de 13f deja de desangrar al resto sola, y en cuanto el jugador manda a alguien a la sección rota la
  puerta se abre y la presión se escapa. Emergente del default, no scripteado.

* **Dominio `engine/src/doors/`** con state machine explícita (`DoorMode`/`DoorState`) y las reglas de gobierno como
  **Strategy** con prioridad: trabada > sin energía > señal > tarea > auto. `overrideSource` lleva el MOTIVO, para
  que la UI pueda decir por qué la puerta no responde en vez de solo no responder.

* **Atmósfera:** la difusión pasa a leer la apertura por tick desde una fuente inyectada
  (`SectionApertureSource`), misma forma de interfaz angosta y opcional que `SectionPressureSinkSource`.

* **Paso:** el `WalkableGrid` se decora con el estado vivo de puertas (una función, no una copia). El
  `CellBlockedQuery` que 13f usa para los proyectiles debe leer la MISMA fuente — si no, un proyectil atravesaría
  una puerta cerrada que un tripulante no puede cruzar.

* **Sin energía la puerta se congela donde está** (decisión del operador): sin motor no se mueve, `auto` deja de
  funcionar y queda en override con motivo "sin energía". Tarea `force-door` para abrirla a mano, lenta y con tirada
  por tier. Le da a la tarea `cut-power` de 13d una consecuencia que hoy no tiene. `powerDraw` se declara en el
  `ACT` de la puerta (que ya lo admite) y migra con el resto cuando 13g lo suba a dato de componente.

* **Persistencia:** `Blueprint.doorStates`, `schemaVersion` 9→10.

* Tests: unitario por regla; integración "con la puerta cerrada la sección vecina no pierde presión"; integración
  con 13f (una brecha en `auto` no desangra la nave, mandar un tripulante la abre); **caso de validación 9
  completo** (el electroimán traba una puerta real y el intruso no pasa); y regresión de los casos 3, 6 y 10, que
  dependen de la difusión entre secciones.

#### Subfase 13g: Consumo Eléctrico Real — que el reparto de energía gatee algo ✅ CERRADA (2026-08-29)

### Fase 14 — Capítulo 2 y Acoplamientos Cruzados de Motor

Agrupa, con el mismo criterio que separó la Fase 13 de gaps de motor del contenido de campaña, los acoplamientos entre dominios detectados al auditar si el motor sostiene fallas verdaderamente sistémicas (análisis de sesión 2026-08-11, ver `PENDIENTES_OBSERVACIONES.md` #34 para los pares evaluados y diferidos). Se ubican antes del Cap.2 porque lo alimentan directamente — el sensor químico y el sensor térmico son insumo de su diseño de nivel.

#### Subfase 14a: Dominio de Temperatura

Sexto eje del motor junto a energía/presión/química/señales/estructura — especificado en el GDD §5.2 y la Especificación de datos técnicos (efecto térmico de neutralización ácido+base) pero sin ningún **escritor** hasta ahora. Entra antes de la demo por los efectos naturales que desbloquea (combustión con rastro real, tercer sensor del Cap.2, enfriador cableable), no solo por ser prerrequisito no declarado de la Fase 17 (Cap.4, caso de validación 2).

Partida en dos entregas jugables al planificarla (decisión del operador, 2026-08-31): 14a-1 deja el eje vivo y legible de punta a punta; 14a-2 agrega los acoplamientos con los otros dominios.

Tres correcciones al texto original tras auditar el código:
- El campo **ya existía** como `temperatureCelsius` (no `temperatureC`) con nominal **21 °C** (no 20). Se reusa tal cual: sin bump de `schemaVersion`, sin migración de saves.
- El `triggerType` es **`"thermal"`** (no `"temperatura"`): es el valor que ya autoraba `sensor-termico-precision` en el catálogo, y el resto de los trigger types están en inglés.
- El **sensor térmico ya existía** en el catálogo pero caía en el *fail-open* de `allEmittersActive`: estaba permanentemente disparado.

##### Subfase 14a-1: Estado vivo, escritores por evento y sensor térmico real ✅ CERRADA (2026-08-31)

* **Estado:** `temperatureCelsius` reusado; `NOMINAL_TEMPERATURE_CELSIUS` pasa a ser la única fuente del 21.
* **Parámetros** (`atmosphere/thermal-parameters.ts`): tasas de deriva y conducción, tablas de calor por evento, clamp de dos lados, umbral del sensor.
* **Escritores:** `MissionThermalRuntime` traduce `CombustionEvent` (por `intensity`), `OverloadEvent` (modos fire/explosion) y `NeutralizationEvent` (con su propio `heatReleasedCelsius`, que hasta ahora nadie aplicaba) a pulsos de °C/s con duración; deriva pasiva exponencial hacia el nominal; conducción entre secciones dentro de `diffuse()`, con piso de apertura — cerrar una puerta frena el gas pero no el calor.
* **Lectores:** sensor térmico real (`temperatureAwareEmitterInputs`) + lectura de temperatura y de "fuente de calor activa" en el tooltip de sección; el efecto de partículas `heatVapor` pasa a importar el umbral del motor en vez de repetir el 60.
* `NeutralizationEvent` gana `sectionId` opcional, estampado por `MissionReactionRuntime` igual que el de combustión.
* Suite: `/engine` 1080 → **1100**.
* **Sprite faltante:** `game/assets/sprites/components/sensor-termico-precision.png` — mientras tanto usa el placeholder tinteable por código.

###### Ronda 1 de playtest de 14a-1 ✅ (2026-08-31)

*"No tengo un sensor térmico en la lista a instalar."* El motor lo simulaba de verdad y el jugador no podía obtenerlo — la subfase estaba cerrada a medias, con los tres cortes fuera del alcance de cualquier test de motor:

1. La pieza no declaraba `footprint`, y el selector descarta esos compuestos con un `continue` **mudo** (ni fila bloqueada ni motivo). Solo 6 de ~30 compuestos lo declaran → **deuda #42**.
2. Su receta pedía dos piezas con stock 0 en el Cap. 1.
3. `indicador-led` tenía stock 1: imposible montar más de una prueba.

Fix, todo de datos: `footprint {1,1}` al sensor, y stock del Cap. 1 a `indicador-led` ×6 + `chip-circuito-generico` ×8 + `placa-disipadora` ×4 (cuatro sensores construibles). Tres tests nuevos que derivan de la receta real en vez de repetir los números. **El stock inflado hay que re-nivelarlo antes de la demo → deuda #44, bloquea la Fase 15.** También se registró la falta de un buscador por nombre en el selector (**deuda #43**, pedido del operador).

Suite: `/engine` 1100 → **1103**.

##### Subfase 14a-2: Acoplamientos térmicos ✅ CERRADA (2026-08-31)

**Decisión del operador al planificarla: nada de contenido scripteado.** Los dos runtimes donde entraban estos
acoplamientos solo corrían sobre datos de guion — `MissionOverloadRuntime` sobre `scriptedOverloads` y
`MissionReactionRuntime` sobre `scriptedReactions`, este último **vacío en TODOS los capítulos**. El pedido fue
poner las piezas necesarias para que el jugador monte el escenario. Eso cambió el alcance: la carga eléctrica y
los reactivos pasan a derivarse del mundo.

Cuatro supuestos del texto original que la auditoría de código corrigió:
- `thermalConductivityRule` modelaba **solo el frío** (≤ -50 °C) y todos los escritores de 14a-1 son de calor:
  era inalcanzable, y la integración que la subfase declaraba es la rama CALIENTE, que no estaba escrita.
- El **enfriador ya existía**: `sistema-refrigeracion-muestras` (`composite/medica.ts`), `ACT` + `REC` + `CT: "A"`,
  sin `footprint` y sin escritor. Se reusa en vez de crear una pieza gemela.
- **Cambio de estado L↔S↔G no es un acoplamiento sino un subsistema**: `MatterState` es un campo estático de
  catálogo, no hay puntos de fusión/ebullición y no existen consumidores. → **sale a la Subfase 14a-3**.
- **Bug bloqueante**: `MissionOverloadRuntime` se construía sin `shipFloorplan`, así que los `OverloadEvent`
  salían sin `sectionId` y tanto el pulso de calor por sobrecarga como el puente sobrecarga→ignición estaban
  **muertos en producción** desde que se escribieron.

Qué entró:
* **Carga eléctrica emergente** (`power/conductor-load.ts`): la carga de un conductor es la suma del `powerDraw`
  de lo que cuelga de él aguas abajo. Se re-escaló `COND.maxCapacity` a unidades de consumo (cable 100→6,
  resistencia 50→3, fibra 200→12, blindado 150→9): eran magnitudes incomparables. El BFS del grafo se extrajo de
  cinética a `signals/graph-traversal.ts` en vez de copiarlo. `scriptedOverloads` sobrevive como override.
* **Conductividad de dos ramas** (`thermalCapacityFactor`): frío ≤ -50 y calor ≥ 100 °C bajan la capacidad a la
  mitad, y el `CT` del material desplaza el umbral caliente (A +0 / M +20 / B +40), que es lo que le da papel
  mecánico a la placa aislante. Se aplica como cuarto factor, después de `wornCapacity`.
* **Enfriador** (sexto escritor): `footprint` al `sistema-refrigeracion-muestras`, tasa continua de -4.5 °C/s
  gateada por energía y por señal (sin cable funciona sola, con cable manda el cable). El número sale de un
  cálculo: con menos de 3.55 °C/s no cruzaría nunca el umbral frío.
* **Efecto térmico por sustancia** (séptimo escritor): tabla `SUBSTANCE_THERMAL_EFFECT`. Verter nitrógeno líquido
  **no hacía absolutamente nada** hasta ahora — `SectionGasInjection` descartaba en silencio toda sustancia no
  aérea. Es el caso de validación 2 vuelto jugable.
* **Reacciones emergentes por sección** (`mission/section-reactants.ts`) + **`thermalRegulatorOverloaded` real**:
  `SpontaneousIgnitionRule` deja de estar muerta en misión. Con antirruido por huella.
* **Quinto escritor de daño estructural**: `thermalDamageRule`, calor ≥ 100 y frío ≤ -40, sin `floorHp` (el
  fuego sí debe poder reventar una sección). La interfaz de 13f no hizo falta tocarla.
* **Reservorio recién instalado nace CON su sustancia**: `deriveInitialReservoirContents` solo corría al crear la
  campaña, así que un tanque fabricado por el jugador quedaba vacío y "Verter en la sección" ni aparecía.
* `footprint` + stock del Cap.1 para las tres piezas del escenario (deuda #42 puntual, #44 actualizada).

**Recalibración forzada por el test de integración**: `THERMAL_REGULATOR_OVERLOAD_CELSIUS` bajó de 80 a 70. A 80
era inalcanzable justo en el único caso en que se evalúa — la condición exige un regulador instalado, y un
regulador instalado está enfriando, así que una combustión violenta en su sala pica en ~73 °C en vez de ~161.
El estado se apagaba por culpa de la pieza que lo hace observable.

Suite: `/engine` 1103 → **1135**, `/game` 86 sin cambios. `tsc` y `eslint` limpios.

**Sprites faltantes** (placeholder tinteable mientras tanto): `sistema-refrigeracion-muestras.png`,
`tanque-muestra-criogenica.png`, `reservorio-disolvente.png` en `game/assets/sprites/components/` — y sigue
faltando `sensor-termico-precision.png` de 14a-1.

**Ronda 1 de playtest de 14a-2** ✅ CERRADA (2026-09-01) — legibilidad del eje térmico.

El operador jugó la cadena fría y reportó cuatro cosas. Verificadas contra el código, ninguna era un bug del
motor: **una mentira de la UI, dos efectos que no comunican y una pieza sin motivo para existir**. Es el patrón
recurrente del proyecto — el modelo funciona y el jugador no puede verlo.

* **El frío se ve en toda la sección y duele.** Los tres efectos de atmósfera (`gasLeak`, `freezing`,
  `heatVapor`) creaban UN emisor en el centroide con ±10 px de dispersión, dentro de salas de 30-60 celdas: un
  fenómeno de sala pintado como un punto. Se arreglan **los tres juntos** —arreglar solo el reportado deja a sus
  hermanos rotos— con `emitZone` sobre las celdas REALES de la sección (nunca el bounding box, que incluye pared
  y pasillo ajeno) e intensidad escalada por severidad y por área, unificados al criterio de `gasLeak`, que era
  el único que ya lo hacía bien. Se suma una **capa de escarcha por celda** (molde de
  `redrawUnpoweredSectionScar`), que es lo que da la lectura de superficie que las partículas solas no dan.
* **Daño térmico a la tripulación** — quinto peligro de `MissionHazardRuntime`, y la primera vez que la
  temperatura toca a una persona. El GDD lo pedía desde 6.1 y 11.1 y no existía ningún camino. Mordiscos
  discretos (molde de `applyVacuum`, con el bug de la fracción × `dtSeconds` cubierto por test en el llamador
  nuevo), exposición por ACTOR, 10 s / 15% HP — más lento que el vacío por decisión del operador: el vacío es el
  peligro agudo, el eje térmico es nuevo y necesita ventana para leerse. **Umbrales propios**: la gente sufre a
  -10/60, la estructura a -40/100, el conductor a -50/100, el clamp a -80/900 — **la gente muere antes que el
  casco**, con un test que fija ese orden. Vacío y frío **se acumulan** (decisión del operador). Y el umbral de
  la escarcha se ata al del tripulante: **ver escarcha = esta sala mata**.
* **El cable dice lo que le pasó**: estado `overloaded` en el sistema genérico de 13h — el primer cobro de la
  promesa de que agregar un estado es una consulta y una fila. Lo prometía el plan de 14a-2 y había quedado sin
  hacer: la subfase cerró con la mitad visible del acoplamiento pendiente. Va **antes** que `unpowered` en la
  cadena de prioridad, con test en la franja donde los dos predicados son ciertos.
* **La cicatriz comunica**: chispa y luz usaban el tint EXACTO (por eso no se veían dentro del glow, no porque la
  luz las tapara — están a depth 7 contra 1.8), `quantity: 1` cada 240 ms con vida 200 dejaba huecos sin ninguna
  partícula viva, y estaban confinadas a ±4 px. Núcleo casi blanco + frecuencia por debajo de la vida +
  dispersión sobre el footprint real. El hallazgo previo ("el glow tapaba el campo de luz") no se reintroduce
  porque lo causaba la densidad por píxel, y repartir sobre el footprint la baja aunque suba el conteo.
* **Falso positivo del Cap. 1 retirado** (decisión del operador): el `cable-cobre` sembrado en `ingenieria`
  reventaba en el PRIMER tick por un `scriptedOverloads` de carga 9 contra capacidad 6, y encima no tenía nodo de
  señal. Todo brillo ámbar al arrancar era attrezzo, lo que hacía **imposible playtestear** la cadena térmica.
  Se quitan la pieza y el override; el test de integración que afirmaba lo contrario se **invierte** para anclar
  la decisión. `scriptedOverloads` conserva cobertura en sus propios fixtures.
* **El tooltip coloreaba solo el lado caliente**: una sala a -50 °C se leía en el mismo gris que una a 21.

Suite: 1250 tests en verde (164 archivos). `tsc`, `eslint` y `build` limpios.

##### Subfase 14a-4: El cableado del jugador ES el conductor ✅ CERRADA (2026-09-02, tras 6 rondas de playtest)

Abierta desde la ronda 1 de 14a-2 (decisión del operador, 2026-09-01). Sale de la pregunta *"¿por qué el jugador
metería un cable de cobre en el mapa?"*, cuya respuesta verificada es **que hoy no tiene ningún motivo**:

- El modo cableado conecta **nodo A → nodo B directamente**, ruteando por los conductos `senal` del plano
  (`computeSignalWireRoute`), nunca a través de piezas. `assertSignalWiringReachable` valida conductos, no
  conductores.
- El rol de nodo `"conductor"` tiene **cero lectores en producción**: el evaluador solo bifurca en `emitter`, y un
  `conductor` es semánticamente idéntico a un `receptor` (regla `passthrough`).
- **La arista que dibuja el jugador es gratis, instantánea y de capacidad infinita**: no cuesta material, no ocupa
  celdas y no se puede sobrecargar.

O sea que 14a-2 colgó el acoplamiento térmico de una pieza que nadie tiene motivo para colocar — una mecánica
correcta sin camino jugable. Alcance:

- `SignalEdge` declara con qué conductor está hecha (bump de `schemaVersion` del blueprint + migración).
- Tender un cable **consume** un `cable-cobre` / `cable-fibra-optica` / `cable-blindado-alto-amperaje` del stock,
  y la arista hereda la `maxCapacity` de esa pieza.
- La sobrecarga y el factor térmico se mudan del componente colocado a la **arista**, y con ellos la cicatriz
  visual (se quema el cable dibujado, no un objeto en una celda).
- Da casa a las dos viñetas del GDD 5.6 que hoy no la tienen: retardo de propagación según material del conductor,
  y sobrecarga.

**Preguntas cerradas con el operador antes de planificar (2026-09-01):**
- Aristas de saves viejos → **cobre nuevo**, migración tolerante (`schemaVersion` 10→11): ningún save se
  rechaza y ninguna partida cambia de márgenes.
- **El jugador elige el cable siempre**, con capacidad y stock a la vista. Si el juego elige solo, nunca
  aprende que hay diferencia entre materiales.
- Un cable quemado **se pierde**: retirarlo no devuelve nada y retender cuesta otro conductor.
- **`panel-electrico` descartado.** Preguntado qué función cumpliría, el operador respondió que si es solo
  "el lugar por donde pasan los cables", los conductos `senal` del plano ya lo cubren. No se crea la pieza;
  el caso de validación 2 se reescribió sobre un cable real en vez del fixture sintético.
- Decisión extra del mismo ciclo: **los conductores dejan de ser componentes instalables** — son otro tipo
  de recurso, con su propio selector.

Qué entró:
* **La arista sabe de qué está hecha**: `SignalEdge.conductorId` + `conductorWear`. La capacidad NO se
  persiste, se deriva del catálogo — una segunda copia se habría desincronizado al re-escalar (ya pasó
  en 14a-2). Bump 10→11 y `overloadedRefs` pasa a admitir `SignalEdgeId`.
* **`MissionOverloadRuntime` recorre las aristas.** Una pieza `COND(E)` colocada ya no se evalúa: sería
  el mismo fenómeno con dos capacidades. `scriptedOverloads` sobrevive intacto como override.
  `conductorElectricalLoad` se borra al quedarse sin llamadores; lo reemplaza `edgeElectricalLoad`.
* **La cicatriz no es cosmética**: `activeSignalEdges` saca el cable quemado del grafo que se evalúa Y
  del cálculo de carga, así que quemar un cable **descarga a sus vecinos**.
* **El `CT` de los cables deja de ser decorativo**: ninguno lo declaraba y todos caían al default "A",
  o sea que la tabla de offsets térmicos existía en el código y no en el juego. Cobre/bobina/resistencia
  A, blindado M, fibra B — la elección de material pasa a tener dos ejes, con test que lo ancla.
* **Tarea `disconnect`** + gesto sin controles nuevos: repetir el cableado sobre un par ya cableado lo
  retira. De paso tapa un agujero viejo — se podían apilar N aristas idénticas, invisibles.
* **Fallo de tarea por rechazo del efecto**: `completeTask` invocaba el efecto sin try/catch y una
  excepción reventaba el tick. Existía desde la Fase 10b, pero 14a-4 lo volvió trivial de alcanzar
  (dos cables encolados con una pieza en stock). Ahora la tarea pasa a `failed` con motivo propio.
* **Legibilidad**: el cable se pinta verde → ámbar (75%) → carbonizado, repintado a 4 Hz porque la
  capacidad efectiva baja con la temperatura sin que cambie la topología; la cicatriz se siembra sobre
  las celdas que ATRAVIESA la ruta, no en un punto; su flujo animado se apaga con él.

Suite: motor **1168** (153 archivos), juego **105**. `tsc`, `eslint` y `build` limpios.

**Fuera de alcance, explícito:** el retardo de propagación por material (GDD 5.6). `DelayBehavior` y
`DelayRule` ya existen y su docblock promete derivar `delaySeconds` del material desde la Fase 4/5 — es
un eje temporal nuevo, no una mudanza. Sale a subfase aparte.

###### Ronda 1 de playtest de 14a-4 ✅ CERRADA (2026-09-01)

El operador cableó un fotorreceptor a varias puertas de la bodega. Cuatro reportes; ninguno era el
acoplamiento en sí, que funcionó:

* **Bug de 13h que el cableado volvió alcanzable**: `blocksPathing` miraba `door.mode` y no
  `door.state`, así que una puerta ABIERTA por señal seguía siendo pared para el pathfinding y dejaba
  al tripulante encerrado. Era el único de los tres predicados de puerta que ignoraba el estado, y su
  propio docblock ya describía la regla correcta. El test que faltaba era el CRUCE de dos casos que sí
  estaban cubiertos.
* **"El cable no explica nada"**: el color funciona (en estrella cada cable lleva 2 de 6; al colgar el
  7º consumidor viró a ámbar), pero no había *ninguna* lectura. Entra el **tooltip de cable** (carga
  contra capacidad efectiva, desgaste, la consecuencia en palabras, y por qué la sala se la baja) y las
  **líneas de señal en el tooltip de pieza** (qué gobierna y cuánta demanda suma; quién la gobierna y si
  la señal llega ahora). El color además se repinta en **pausa**, que es donde se cablea.
* **Retirar un cable era invisible**: el gesto existía sin ningún indicio en pantalla. Ahora hay acción
  en el panel, y un cable **sano vuelve al stock un escalón más gastado** — la decisión de "la pieza se
  pierde" era sobre el cable QUEMADO, y colapsar los dos casos dejaba sin salida al re-ruteo. Stock de
  `cable-cobre` del Cap. 1: 4 → **9**.
* **Los ACT emiten señal** (pedido del operador). Un `ACT` deriva ahora receptor + **emisor de salida**,
  y lo que emite es el **estado REAL** —una puerta trabada o sin motor no emite— resuelto por
  `actuatorEmitterInputs`. Se siembran las salidas faltantes al arrancar, o la mecánica habría sido
  invisible para las partidas ya empezadas; y los dos nodos de una puerta de 1 celda se reparten en
  abanico con hit-test por el más cercano, que de paso destapa el nodo oculto que
  `torreta-automatizada` y `dron-reconocimiento` arrastraban desde siempre.

Suite: motor **1189** (156 archivos), juego **113**. `tsc`, `eslint` y `build` limpios.

###### Ronda 2 de playtest de 14a-4 ✅ CERRADA (2026-09-02)

El operador colgó **7 consumidores de un solo fotorreceptor** (5 LEDs, una compuerta, una LCD) y
reportó que ningún cable llegaba a ámbar, que todos decían `carga 1/6`, y que `Gobierna: 7 · 8 de
demanda` no se entendía. **Los tres números estaban bien**, y aun así el sistema no funcionaba como
diseño:

* **La mecánica de carga era INALCANZABLE.** Un cable lleva lo que cuelga aguas abajo de él, así que
  en estrella cada uno lleva 1. Sobrecargarlo exige un TRONCO (`sensor → chip → N piezas`), y montar
  en tronco costaba un cable MÁS que la estrella: nadie lo iba a construir jamás. No era calibración
  — faltaba algo que empujara hacia la topología que la produce.
* **El relé estaba prohibido.** `chip-circuito-generico` solo declara `REC`, y `orientSignalWiring`
  rechazaba receptor→receptor con el argumento de que "dos consumidores no tienen nada que decirse".
  Falso en este motor: el evaluador calcula la salida de todo nodo que no sea emisor, o sea que un
  chip ya era un relé por construcción. Era además la MISMA guarda que la ronda 1 rodeó dándole al
  `ACT` un nodo emisor en vez de corregirla. Cae el rechazo; queda el de emisor→emisor, que sí es
  correcto. De paso se arregla `conductor → emisor`, que no se daba vuelta y escribía una arista
  entrando a un emisor.
* **El emisor pasa a tener capacidad de salida** (`signal-output-parameters.ts`, tabla data-driven
  gemela de `POWER_DRAW_BY_COMPONENT`): sensor suelto 3, chip 8, consola 12, salida de `ACT` 2. Lo
  que no entra **deja de recibir señal**, con triaje por el **mismo dial de prioridad que la energía**
  (`orderByPowerPriority`, extraído y compartido). Ahora el chip-relé es necesario, el tronco aparece
  solo, y el tronco sí se quema.
* **La demanda NO es transitiva** — la decisión que hace que el relé sirva de algo, y que el primer
  test de `emitter-fanout.ts` destapó: con demanda transitiva el sensor seguía viendo 9 a través del
  chip y no había ninguna salida al problema. Cada salida paga lo que cuelga DIRECTAMENTE de ella.
  La carga del CABLE sí sigue siendo transitiva (por eso el tronco revienta) y sigue contando lo
  cableado, no lo que recibe señal: descontarla al sacrificar habría hecho oscilar el montaje un tick
  sí y otro no.
* **`unsignaled`, tercer estado de instancia**, cobrando la promesa que `instance-state.types.ts`
  tenía escrita. Y los **glifos pasan a ser una lista**: el tinte sigue siendo uno (el más grave),
  pero `⚡` y `⊘` se dibujan juntos — pedido explícito del operador, porque con uno solo el jugador
  arreglaba la energía y recién ahí descubría que faltaba señal.
* **Elegir el nodo y ver la dirección.** Con dos nodos a 16 px en una celda de 32 y radios de click de
  10, las zonas se solapaban: ahora un click ambiguo abre un **menú circular** en vez de adivinar (con
  un solo candidato resuelve directo, sin pasos extra). Y como legalizar receptor→receptor devuelve la
  dirección al orden de clicks, se agrega la **línea fantasma con flecha**, que muestra el sentido
  ANTES de encolar la tarea. De paso, el resalte de nodos del modo cableado dejó de dibujarse en el
  centro de la celda: estaba desalineado de los puntos que resalta desde la ronda 1.
* **Los números tienen denominador**: `Gobierna 7 piezas · demanda 8 / 3`, con semáforo y la
  consecuencia en palabras; y el tooltip de cable explica por qué su carga es la que es.

Suite: motor **1207** (155 archivos), juego **122** (13 archivos). `tsc`, `eslint` y `build` limpios.

###### Ronda 3 de playtest de 14a-4 ✅ CERRADA (2026-09-02)

El operador confirmó que el fan-out, el relé y el tronco funcionan. Al **quemar el tronco
`fotorreceptor → chip`** encontró que no hay forma de saber qué se rompió: *"el chip comenzó a brillar
como si estuviera roto, el cable que los une desapareció, pero sigo viendo junto al fotorreceptor el
aviso de que el cable está quemado"*.

**Un solo bug, una sola causa, y el motor no tenía nada que ver**: en `overloadedRefs` entra el id de
la ARISTA y el chip no tenía tinte, glifo ni estado. Era la cicatriz correcta pintada sobre el sujeto
equivocado. `signalWireCells` muestrea `step = 0` y `step = steps`, o sea que **incluye las celdas de
los dos extremos** — justo donde están las piezas — y todo lo que dibuja un cable quemado se apoyaba
en esa lista.

* **La cicatriz pasa al CUERPO del cable** (`signalWireBodyCells`, sin los extremos), y el fogonazo y
  la estática del corte al **punto medio por longitud** en vez de `signalWireCells(...)[0]`, que era
  literalmente la celda del emisor. Un cable corto sin cuerpo cae al punto medio: nunca se queda sin
  cicatriz.
* **Se va la luz de la cicatriz de un cable** (pedido del operador: "eso oculta todo lo demás"). Un
  glow puntual de 64 px describe el volumen de una PIEZA; sobre una línea no describe nada, solo tapa
  — y encima estaba anclado en la celda de una pieza. Una pieza colocada la conserva.
* **En su lugar, arcos eléctricos** (idea del operador): cada 2-4 s una descarga corta sale de una
  celda al azar del cable hacia una pared o pieza cercana. Dice lo mismo que la luz y resuelve lo que
  la luz hacía mal — es **direccional y transitorio**, se ve nacer en el cable. **Puramente visual**:
  no emite eventos, no toca el motor, no daña. Sin blanco cerca no dibuja nada; nunca dispara al vacío.
* **El cable quemado se ve ROTO, no ausente**: trazo entrecortado (`dashedPolyline`) al mismo grosor
  que uno sano. Era 1 px al 70 % de alfa debajo de su propia luz ámbar — "invisible" se lee como "no
  está", y sin recorrido visible no hay forma de ir a retirarlo, que es la única salida de la cicatriz.
* **Las piezas de los extremos lo dicen en su tooltip** (`burnedWiresTouching`, en el motor para poder
  testearlo): *"1 cable quemado conectado (no conduce)"*, contando **entrantes y salientes** — el
  tronco era saliente del sensor y ENTRANTE del chip, que fue la pieza que pareció rota. Sin glifo
  sobre el sprite, por decisión del operador: un símbolo en la pieza volvería a decir "esta pieza está
  rota".

Suite: motor **1213** (156 archivos), juego **139** (14 archivos). `tsc`, `eslint` y `build` limpios.

###### Ronda 4a de playtest de 14a-4 ✅ CERRADA (2026-09-02)

El operador pidió un fantasma para las instalaciones encoladas ("para ver dónde quedarán las piezas
sin usar la memoria"). Verificarlo destapó que **planificar en serie no era seguro**, y al plantear la
reserva de stock que hacía falta, el operador señaló el riesgo: *"hay formas de colgar tareas y que
nunca se ejecuten; con este nuevo modelo esas tareas dejarían reservadas piezas del stock
indefinidamente"*. Verificar ESO destapó el bug de fondo. Se partió en dos: 4a arregla la cola, 4b
monta el fantasma y las reservas encima.

* **Las dependencias entre tareas no existían.** `ensureAt` encolaba un `go-to` antes de cada acción
  con sitio y **nunca pasaba `dependsOn`**: la relación era puro orden FIFO. O sea que cancelar el
  movimiento **no impedía la acción** — el tripulante se quedaba donde estaba y la pieza se instalaba
  igual, en una sección a la que nunca llegó. El mecanismo para evitarlo (`resolveBlockingReason`,
  `cascadeDependents`) estaba entero y testeado desde la Fase 10, **sin un solo llamador**. Enlazado en
  los 16 sitios que llaman a `ensureAt`.
* **El motivo del bloqueo, expuesto** (`blockReasonFor`): el dato vivía en `lastBlockReason`, privado
  y sin salida, así que una tarea bloqueada PARA SIEMPRE se veía igual que una esperando su turno.
* **La cola muestra el árbol**: `buildQueueRows` (pura, con test) coloca cada dependiente debajo de su
  dependencia con sangría y conector, y las bloqueadas van con borde ámbar y su motivo en la fila. Sin
  eso, cancelar un movimiento parecía inocuo.
* **Cancelar, con dos caminos y feedback en ambos.** La "×" existía en cada fila desde siempre y el
  operador no sabía que se podía cancelar nada: era un glifo de 14 px que al clickearse no producía
  **ninguna** señal. Ahora tiene caja propia, resaltado al pasar por encima y sonido — y además el
  **click derecho sobre cualquier punto de la fila** cancela.
* **`demanda 7 / 8` → `6 piezas · consumo 7 de 8`.** Son tres unidades distintas (piezas, consumo,
  capacidad) y la barra no lo decía: el operador la leyó como dos cifras de demanda, el mismo tropiezo
  que la ronda 2 ya había tenido con `Gobierna: 7 · 8 de demanda`. "consumo" es la palabra que el
  sistema de energía ya usa.

Suite: motor **1214** (156 archivos), juego **154** (16 archivos). `tsc`, `eslint` y `build` limpios.

###### Ronda 4b de playtest de 14a-4 ✅ CERRADA (2026-09-02)

Tres reportes sobre la cancelación que la ronda 4a acababa de hacer descubrible, y **los tres eran el
mismo defecto**: cancelar cambiaba el estado del motor y no tocaba nada de lo que ya estaba en
pantalla. El motor hacía bien su parte —la pieza no se instalaba— así que el fallo era enteramente de
la capa visual, donde una cancelación **no se distinguía de no haber cancelado**.

* **La fila cancelada se quedaba en la cola.** `redrawQueuePanel` filtraba solo `completed`, así que
  una tarea borrada seguía ahí con la barra en cero y el operador la leyó como "no pasó nada". El
  filtro pasa a `buildQueueRows` y cubre los tres estados terminales; corre **antes** de resolver los
  padres, para que el dependiente que queda bloqueado pase a raíz y muestre su motivo en vez de colgar
  de una fila que ya no se dibuja.
* **El tripulante terminaba el viaje cancelado.** `chainHops` era una cadena de tweens irreversible:
  se lanzaba en `task-started` y no había forma de alcanzarla. Gana un `shouldContinue` que se
  consulta antes de cada salto. Corta **entre saltos, no a mitad de uno**, para que el token siempre
  aterrice en el centro de una celda y nunca dentro de una pared ni cruzando una puerta.
* **Las partículas de una instalación cancelada seguían** hasta agotar el tiempo estimado de una tarea
  que ya no existía. Ahora se `stop()` (no se destruyen: las que están en vuelo terminan su vida, y
  `spawnBurst` ya tiene programada la destrucción del emisor).

**`mission/active-task-visuals.ts`** (nuevo, con test): registro de "cómo se apaga el visual de esta
tarea". Los tres síntomas tenían la misma causa, así que el arreglo es uno solo — cada visual registra
su apagador y el manejador de `task-cancelled`/`task-failed`/`task-blocked` lo invoca sin saber de qué
visual se trata. Al **completar** se olvida sin apagar: la animación tiene que terminar sola.

**Pendiente, ronda 4c** (era la 4b antes de este reporte): fantasma de las instalaciones encoladas +
reserva de celda y de stock, con el diseño ya cerrado — la reserva se **deriva** de la cola viva y
nunca se persiste, porque `toUpdatedSave` no guarda tareas y descontar al encolar haría **perder
material al guardar**.

Suite: motor **1214** (156 archivos), juego **163** (17 archivos). `tsc`, `eslint` y `build` limpios.

###### Ronda 4c de playtest de 14a-4 ✅ CERRADA (2026-09-02)

Lo que la 4a dejó pendiente al partirse en dos: el fantasma que el operador había pedido
(*"ver dónde quedarán las piezas sin usar la memoria"*) y las reservas que hacían falta debajo.
`queueInstall` **encolaba sin comprometer nada**, así que dos tareas podían pedir la misma celda o
la misma última unidad y nada lo decía hasta que la segunda se ejecutaba.

* **La reserva se deriva de la cola viva y NO se persiste**, la restricción que fijó el diseño:
  `toUpdatedSave` no guarda tareas, así que descontar al encolar haría **perder material al
  guardar**. `queued-reservations.ts` (nuevo, puro) lee las tareas y devuelve celdas y stock
  comprometidos; se recalcula en cada consulta, sin caché — una caché de esto es la misma clase de
  bug que 14a-4 evitó al no persistir la capacidad de las aristas.
* **Reserva `pending`, `in-progress` y `blocked`.** Una tarea bloqueada **sigue** reservando: está
  viva y puede desbloquearse. Es el caso que el operador señaló al abrir el diseño ("hay formas de
  colgar tareas que nunca se ejecuten"), y la salida es cancelarla —lo que las rondas 4a/4b hicieron
  descubrible— no una caducidad automática que libere material a espaldas del jugador. El predicado
  de "viva" es `TERMINAL_TASK_STATES`, el MISMO que filtra la cola dibujada: lo que se ve y lo que se
  reserva no pueden discrepar.
* **`componentStockCost` extraído de `payComponentCost`.** La fórmula de coste decidía Y cobraba en
  el mismo sitio; la reserva necesitaba el cálculo sin la mutación. Una sola definición de "qué
  cuesta" con dos lectores (cobrar y reservar) — una segunda copia habría sido dos sitios donde
  arreglar el próximo bug de stock, el patrón que este proyecto ya pagó en rondas anteriores.
* **La celda reservada se rechaza como una ocupada**: `installIssuesAt` (predicado único para el
  fantasma bajo el cursor y para el click que encola — decidir por separado dejaría ver verde y que
  el click no haga nada) suma el tercer motivo. **No** entra en `validateInstallation`: una reserva
  es un hecho de la COLA, no del `Blueprint`, y meterla ahí obligaría a pasarle tareas a una función
  de geometría.
* **El selector muestra el stock REAL y explica el reparto** (decisión del operador): la fila sigue
  diciendo `×3` —esconder piezas que existen sería mentir sobre el motor, mismo criterio con que 13c
  se negó a colapsar los buckets de desgaste— y la ficha desglosa `2 reservadas por la cola · 1
  disponible`. Con 0 disponibles la fila queda bloqueada con **motivo propio**, `queue-reserved`, no
  reciclando `no-stock`: la pieza existe, y "sin stock" mandaría al jugador a buscar algo que ya
  tiene. Vale igual para los conductores (dos cables encolados llegan al mismo doble cobro) y para
  los compuestos, donde `missingRecipeIngredients` distingue "falta" de "reservado" porque son dos
  problemas con dos salidas distintas.
* **El fantasma reusa el vocabulario visual, no inventa uno**: trazo entrecortado (`dashedPolyline`,
  el de la cicatriz de cable de la ronda 3) más el sprite atenuado, ámbar si la tarea está bloqueada
  y más opaco al pasar a `in-progress`. Contornea **cada celda ocupada**, no el rectángulo
  envolvente. Va en `RENDER_DEPTH.queuedGhost` (1.9), **debajo** de `objects`: un plan nunca puede
  tapar un estado real del motor.
* **Un solo sitio de redibujo**: `redrawQueuedInstallGhosts` cuelga de `redrawQueuePanel`, porque el
  mapa y la cola muestran el mismo dato. Colgarlo de un evento propio dejaría dos verdades que pueden
  divergir — el defecto de fondo que la ronda 4b tuvo que arreglar.

**Cierra la observación 8** de `PENDIENTES_OBSERVACIONES.md` (crash por doble encolado de la última
unidad): su segunda capa —que el efecto no reviente el tick— ya la había cerrado 14a-4, y ésta cierra
la primera. Sale del Bloque 1 de la Subfase 14d.

Suite: motor **1234** (158 archivos), juego **169** (17 archivos). `tsc`, `eslint` y `build` limpios.

##### Subfase 14a-3: Cambio de estado de sustancia (L↔S↔G) ✅ CERRADA (2026-09-03)

Separada de 14a-2 al planificarla (decisión del operador, 2026-08-31): no es un acoplamiento, es un subsistema.
`ChemicalSubstanceData.state` era un dato ESTÁTICO de catálogo con **un solo consumidor semántico** en todo el
motor (`isAirborneSubstance`), sin puntos de fusión/ebullición en ningún lado.

**Lo que la subfase resultó ser, tras la pregunta del operador al revisar el plan** (*"¿estamos teniendo en
cuenta la interacción de los estados con el entorno — chispazos, la temperatura de otra sala por una explosión?"*):
no es variedad química, es el **eslabón que faltaba** entre el eje térmico de 14a-1/14a-2 y la cadena de ignición
que ya estaba viva desde 14a-2. `sectionReactants` solo lee `atmosphere.gases`, y un líquido derramado nunca
entraba ahí — o sea que **derramar combustible y provocar un chispazo no hacía absolutamente nada**. Al volver
dinámico el estado, evaporarlo lo mete en la atmósfera y queda inflamable *por la cadena que ya existe*, sin
tocar ninguna regla de reacción.

Decisiones del operador en la planificación: puntos obligatorios para las 49 entradas; los cuatro consumidores
del estado; **sin piezas nuevas** (la mecánica cuelga del enfriador, la combustión y el vertido, que ya tienen
motivo de existir — evita el patrón 60); la expansión **solo represuriza**, sin sobrepresión; el reservorio
sellado **aísla el calor pero no el frío**; la ignición **dura lo que dura el fenómeno**; y el calor por encima
de un umbral **ES fuente de ignición** por sí solo.

Qué entró:
* **Módulo `chemistry/phase/`**: `effectiveMatterState` (estado derivado de la temperatura), `phasePointsOf`
  (punto ÚNICO de resolución catálogo/fallback), `phaseTransitionOf`, y los dos eventos de dominio. `state` pasa
  a documentarse como "estado dentro de un contenedor sellado"; la autoridad de runtime es la derivación.
* **Datos**: las 49 entradas declaran sus dos puntos, obligatorios por tipo (`AuthoredSubstanceData`), con test
  de coherencia contra el `state` declarado a 21 °C salvo `CRYOGENIC_SUBSTANCE_IDS` (el nitrógeno líquido se
  almacena líquido y suelto en una sala normal es gas — GDD línea 166).
* **Destino del derrame**: verter nitrógeno líquido en una sala templada la enfría **y** desplaza oxígeno.
* **Presión por expansión**: primera FUENTE de presión del motor. El techo la corta en el estándar, así que su
  valor jugable es represurizar una sala baja tras sellar una brecha.
* **Flujo bloqueado por congelación**: las cuatro tareas que mueven sustancia rechazan un contenido sólido con
  motivo PROPIO y sus dos números. La MISMA función alimenta el panel, el glifo del plano y el efecto de tarea.
* **Rotura del tanque**: `worsenWear` por CRUCE del umbral, con registro por instancia (evento de borde, no un
  goteo por frame). El estado previo se siembra al cargar: guardar en una sala fría no cobra daño.
* **Ciclo de vida de la ignición**: `ignitedSectionIds` era un `Set` que **nunca se limpiaba** — una sala con
  historial de chispazo quedaba inflamable el resto de la misión, y con la evaporación eso pasaba a ser el
  camino normal para arder sin causa presente.
* **Autoignición térmica**: lo que hace que un incendio se PROPAGUE de sala en sala por la conducción que ya
  existía desde 14a-1.
* **Consumo real del combustible** (hueco preexistente): `CombustionRule` declaraba `consumedReactantIds` y
  **nadie lo aplicaba**. Con autoignición encima habría sido una cascada sin final; ahora el ciclo se cierra
  solo (derramar → evaporar → arder → agotarse → apagarse) y "apagar el fuego" existe.
* **Cae la vía por tag `VOLAT`** de `isAirborneSubstance`, heurística de 13e que suplía a los puntos de
  ebullición inexistentes: mantenerla dejaba al combustible inflamable a 21 °C, o sea la mecánica muerta.

**Dos números salieron de MEDIR, y el primer candidato de cada uno estaba mal**: `AUTOIGNITION_CELSIUS` 120 →
**90** (con la conducción real, una combustión violenta deja la sala en 124 °C y la vecina en 54: a 120 la
propagación era imposible); y la ebullición del combustible 95 → **75**, para que quede DEBAJO de la
autoignición — entre 75 y 89 hay vapor inflamable y ninguna fuente, que es el hueco donde el jugador decide
cuándo encender.

Legibilidad: dos efectos de partículas nuevos, cuarto estado del sistema genérico de `InstanceStateFlag`
(`frozen-content`, copo a brillo pleno), el tooltip de sección dice qué hay en el aire y en qué estado y avisa
cuando la sala enciende sola, y el panel bloquea con motivo y números. i18n es+en.

Stock del Cap. 1 para TRES montajes simultáneos (deuda #44 actualizada): válvula 2→6, junta 7→14, tubo flexible
4→8, tubo rígido 4→6, motor 2→3 — la válvula era el techo real en dos reservorios en toda la nave.

Suite: motor 1234 → **1265** (162 archivos), juego 169 sin cambios. `eslint` y `build` limpios; **`tsc` NO lo
estaba** y el cierre lo declaró limpio por error — ver la ronda 1.
Deudas nuevas registradas: **#46** (el charco no es una entidad del motor: derramar en frío y calentar después
no evapora nada), **#47** (sobrepresión diferida) y **#48** (sustancias con puntos deliberadamente inalcanzables).

###### Ronda 1 de playtest de 14a-3 ✅ CERRADA (2026-09-03)

Cuatro reportes: tres bugs míos y una pregunta —*"¿qué puedo poner en una sala para que encienda sola?"*— cuya
respuesta honesta era **nada**. Eso último es lo que cambió el alcance: la autoignición estaba completa en el
motor y sin ningún sujeto que el jugador pudiera colocar (patrón 60 un nivel más arriba).

* **Decimales sin redondear** en el aviso de congelado. `instanceStateLabel` interpolaba los detalles crudos:
  nacieron en 13h con consumidores que solo traían ENTEROS y funcionaba por casualidad hasta el primer float.
  Al arreglarlo aparecieron **tres copias** de la misma regla de formato en tres archivos → `formatMeasure`.
* **El vapor casi no se veía**: reintroduje el patrón 62 que la ronda 1 de 14a-2 ya había corregido. La causa de
  fondo: aquel arreglo solo llegó a los efectos *state-driven*, porque `EventEffectOptions` no transportaba
  área. Ahora sí, y la cobertura de sala sube al módulo compartido; se corrigen de paso `section-damaged` y los
  hazards atmosféricos, con el mismo defecto y sin reportar.
* **El conductor disipa calor** (decisión: pieza real **y** tecla de dev, y por PROPIEDADES). `carga²/capacidad
  × transferencia(CT)`, o sea I²R. Octavo escritor térmico, con la geometría del recorrido inyectada desde
  `/game` en la misma pasada que ya calculaba celda→cable.
* **Indicador visual del cable** (pedido explícito): partículas ascendentes sobre las celdas del CUERPO, en canal
  propio y no un segundo color; el número en su tooltip; y el agregado en el tooltip de la SECCIÓN, que es donde
  el jugador busca la causa.
* **Tecla de dev T**: sostiene una sección en 80 / 120 / -20 °C. La H emite un pulso que se disipa en ~14 s, así
  que ninguna secuencia manual entraba en esa ventana (patrón 24). Entra por el mismo canal de calor continuo
  resolviendo la tasa de equilibrio, no escribiendo `temperatureCelsius`.
* **O2 y concentraciones** en el tooltip de sección, con el bucket de combustión que ya usa la regla.

**La calibración se rehízo DOS veces y las dos por el mismo checklist, no por el operador.** La primera
(`0.3 °C/s` por unidad) salió de un montaje de tres compuertas cuya carga con el chip es 7 contra una capacidad
de 6: `OverloadRule` corta con `load > capacity`, así que era un número correcto sobre un escenario que en
partida dura un tick. La definitiva (`0.45`) se calibra contra cinco LEDs detrás de un relé —carga **exactamente**
6, y es lo que el Cap. 1 tiene en stock—: la sala se sostiene en **82 °C** (vapor inflamable, sin autoignición),
dos montajes la llevan a ~144 y enciende sola, y un solo LED cableado la deja en ~28, lejos del sensor. Con un
aserto propio que fija que el tronco no se pasa de su capacidad.

También del checklist: `resistencia-electrica` NO estaba en el stock del Cap. 1, así que "cableá un tronco con
resistencia" era un paso de prueba imposible (patrón 20/55). Entra con 4 unidades.

Suite: motor 1265 → **1278**, juego 169 → **171** (1449 en total, 180 archivos). `tsc`, `eslint` y `build`
limpios — verificados los tres esta vez.

###### Ronda 2 de playtest de 14a-3 ✅ CERRADA (2026-09-03)

Dos reportes —*"la tecla T no logra llevar las zonas a la temperatura que promete"* y el montaje de 5 LEDs
parado en 47 °C con el tooltip del cable diciendo 2.7 y el de la sección 1.7— con **una sola causa**, y mucho
más grande que los dos síntomas.

**La fórmula de equilibrio del eje térmico estaba mal y la usaba todo el mundo.** `T = 21 + R / drift` ignora la
conducción entre secciones: `diffuse()` sangra a cada vecina a `THERMAL_DIFFUSION_RATE_PER_SECOND` (0.15), el
**triple** de la deriva pasiva, con piso `MIN_THERMAL_APERTURE` para que cerrar la puerta no aísle, y en la nave
real cada par de salas está conectado **dos veces** (ducto + puerta, concatenados a propósito por
`composeApertureSources`). Cinco números calibrados con esa cuenta, en tres subfases:

| | prometía | real |
|---|---|---|
| montaje de 5 LEDs en el taller | 82 °C | **42.7** |
| tecla T con consigna 80 | 80 °C | **~66** |
| enfriador de 14a-2 (-4.5 °C/s) | -69 °C | **-10.9** |
| pico de combustión `violent` | ~161 °C | **109.2** |
| pico de `explosion` de sobrecarga | ~111 °C | **86.3** |

Las dos últimas dejaban **dos ramas de regla muertas ya mergeadas**: el umbral frío de -50 de
`thermalConductivityRule` era inalcanzable —exactamente la regla muerta que el docblock de 14a-2 se felicitaba
por haber evitado— y el caliente de 100, con los desplazamientos por `CT`, quedaba en 120/140 para todo
conductor que no fuera `CT: "A"`.

**Por qué ningún test lo vio: todos los fixtures de calibración eran una caja aislada.** `conductor-heat.test.ts`,
`thermal-coupling.integration.test.ts` y `case-02` declaran `conduits: []` con una sola sección, y ahí la
fórmula es exacta. El test de integración de la ronda 1 llegó a montar la pila real a cadencia de frame y a leer
el equilibrio de la simulación… en una nave de una sola sala: confirmaba la fórmula en vez de contradecirla.

* **`atmosphere/thermal-calibration.fixture.ts`** (la corrección estructural): simula el eje térmico completo
  sobre la **nave canónica real**, con sus conductos y sus puertas. Se borró el helper `equilibrium()` y no se
  reescribió en ningún test: convertir una tasa en temperatura pasa por acá o no se hace.
* **Conductor recalibrado** `0.45 → 1.15`, midiendo. Taller 76.7 · ingeniería 75.7 · tanques 86.5 · bodega 89.2
  · pasillo 58.6. Ningún montaje solo cruza los 90 (el techo de la nave es 89.2, se afirma sobre TODAS las
  salas); dos los cruzan siempre; un LED suelto deja la sala en ~28.
* **Tecla T en lazo cerrado**: mide el error contra la temperatura real y aporta lo que falte. No necesita
  conocer ninguna pérdida, las compensa todas por construcción. Converge en <5 s a ±1.5 °C en cualquier sala.
* **Enfriador `-4.5 → -8`**, y es una calibración **acoplada**: subirlo suprime el pico de combustión que es lo
  único que hace observable `THERMAL_REGULATOR_OVERLOAD_CELSIUS` (70). A -10.75 el umbral frío se alcanzaría
  pero el pico caería a 68.4 y mataría la otra regla. A -8 hay margen por los dos lados (equilibrio -35.7,
  pico 78.9), y ahora hay un test que lo fija.
* **Umbrales de `thermalConductivityRule`**: frío -50 → **-30**, caliente 100 → **85**, desplazamientos por `CT`
  `{A:0,M:20,B:40}` → **`{A:0,M:10,B:20}`**. Orden resultante, todo alcanzable: 60 sensor < 70 regulador < 75
  ebullición del combustible < 85 degradación del conductor < 90 autoignición.
* **Tooltip del cable**: muestra el REPARTO de la sala (`wireHeatInSectionOf`) y no el total, que es lo que su
  texto "en esta sala" ya prometía. El total sigue gobernando si la línea aparece, para no discrepar con las
  partículas del recorrido, que son del cable entero.

Del checklist, tres cosas que el operador no llegó a ver: el ramp de las partículas del cable **nacía saturado**
con la constante nueva (un tronco al límite disipa 6.9 y el máximo estaba en 3.45, despejado de la misma fórmula
mala) → 1.41 y 9.74, medidos; la ventana térmica jugable citada en cinco docblocks de química ([-69, ~161]) era
falsa → [-80, ~157], y **el techo no lo pone una combustión sino el calor sostenido del cableado**: se puede
mantener más alto de lo que se puede picar; y el efecto del cable duplicaba a mano la normalización que ya
existía en `thresholdSeverity`.

Suite: **1456** (180 archivos), motor 1278 → 1281, juego 171 → 175. `tsc` de los dos workspaces, `eslint` y
`build` limpios.

#### Subfase 14b: Sensor Químico y Enfriador Cableable (Química↔Señales)

* **Química → Señales:** nuevo `triggerType: "quimico"` en `EmitterProperty` + pieza "sensor químico" + `chemicalAwareEmitterInputs` (mismo molde que `pressureAwareEmitterInputs`), disparado por `contaminantAt`/`airborneSubstanceAt` sobre umbral.
* **Señales → Química:** actuador `ACT` "válvula automática" — con señal activa ejecuta `drawFrom`/`emptyReservoir` (`reservoir-ledger.ts`) o bloquea `apply-substance`. Generaliza `SignalOutputReader`, hoy consumido solo por cinética (bobina electromagnética).
* Con esto el Cap.2 gana un tercer tipo de sensor (junto al de movimiento y el térmico de 14a) para su diseño de nivel AND/OR/NOT, y el Cap.1 gana la primera herramienta de corte automático de una fuga.

* **Sumado en el triaje de 2026-08-21 — MVP de componentes configurables por instancia (deuda #15).** Diferido
  desde 11h y reconfirmado como diferido en 12a; 12e resolvió solo la semántica de color (el LED activo ya no
  es verde). Lo que sigue abierto: elegir por instancia el color y la condición de disparo (`>`, `<`, `=`), con
  datos de configuración por instancia (bump de `schemaVersion` del blueprint), UI de configuración de la
  instancia colocada, y que el LED lea el **valor numérico real** por el mismo mecanismo de resolución por tag
  funcional que ya usa la Pantalla LCD (`resolveLcdDisplayValue`). Entra en esta subfase porque es exactamente
  el mismo trabajo que ella ya hace —umbrales sobre una lectura del mundo (`triggerType: "quimico"`) y
  generalizar `SignalOutputReader`—, no un pedido de UI suelto. **Mantiene su propio ciclo de preguntas**
  (¿solo el LED o cualquier receptor con salida numérica?, ¿configurable en cualquier momento o solo antes de
  instalar?) antes de plan de implementación.

#### Subfase 14c: Capítulo 2 — "Ecos en el Pasillo"

* **Lógica Avanzada de Señales:** Diseñar el nivel de forma que requiera construir filtros AND/OR/NOT en la capa de señales utilizando sensores de movimiento, químico y térmico (14a/14b) y el chip de identificación de tripulación.


* **Amenaza Física Real:** Introducir el primer actor enemigo (11d) que el jugador deba neutralizar de forma activa para completar la misión.

#### Subfase 14d: Bucket de UI/UX y Bugs de Playtest — Pre-Demo (triaje 2026-08-21)

Último trabajo antes de publicar la demo. Recoge **todo** lo de UI/UX y bugs de input que quedó sin fase en
`PENDIENTES_OBSERVACIONES.md`: la Fase 12 (su hogar temático) está cerrada entera, y reabrirla rompería la
convención de fases cerradas de este documento. Decisión del operador en el triaje: **un solo bucket, todo
antes de la demo** — es la carta de presentación del juego. Molde de la Subfase 12f, con dos bloques internos
ordenados por severidad porque el contenido es heterogéneo. Cada ítem lleva su causa raíz ya verificada en
código durante el triaje, así que la subfase no arranca a ciegas.

**Bloque 1 — Bugs con causa raíz confirmada y fix acotado** (no requieren decisión de diseño):

* ~~**Doble encolado de la última unidad rompe el tick (Obs 8).**~~ ✅ **RESUELTO fuera de esta subfase**, en
  las dos capas que el triaje había previsto: la segunda (que `TaskScheduler.completeTask` degrade la tarea a
  `failed` en vez de propagar la excepción) la cerró **14a-4**; la primera (descontar lo encolado al ofrecer
  el ítem) la cerró la **ronda 4c de 14a-4** con la reserva derivada de la cola. Ya no hay nada que hacer acá.

* **Clicks del panel de capas atraviesan al mapa (Obs 11).** `installTopmostOnlyInput` (ronda 4 de 13e) no
  cubre este caso: desempata entre objetos interactivos, y el mapa no es uno — se resuelve por el
  `pointerdown` global de `floorplan-scene.ts`. El panel de capas no registra sus bounds en `isOverFixedUi`
  ni hace interactivo su nineslice, a diferencia de `mission-action-panel.ts`. Regla general a respetar:
  **ningún elemento de UI renderizado sobre el mapa debe dejar pasar el click.**

* **Click desfasado en las pantallas de selección (Obs 10):** en selección de arquetipo y de tripulantes el
  click cae en un elemento distinto del que está bajo el cursor. Investigar la hit area de los containers de
  `crew-select-card.ts`/`ship-archetype-card.ts` antes que el escalado (`scale.FIT` + `#game-root`, 12f).

* **"✕ cerrar" del panel de acciones casi no se puede clickear (Obs 14):** es un `add.text` de 11px con
  `setInteractive()` sin padding ni `hitArea` (~14px de alto). Pasar a `createKenneyButton`, como ya hace el
  close de `power-priority-list.ts`.

* **Los retratos de la selección de tripulantes nunca salen de grises (Obs 18):** peor que lo reportado —
  `crew-select-card.ts` aplica `grayscale(1)` en construcción (siempre con `selected=false`) y `setSelected`
  solo cambia el fondo, nunca toca el `preFX`. El retrato debe pasar a color al seleccionarse.

* **Efectos de "sección sin energía" por encima del panel de asignación (Obs 19):** problema de depth, mismo
  patrón que la ronda 4 de 13e.

* **El panel de acciones titula con el `instanceId` (deuda #26):** `mission-interaction-controller.ts` resuelve
  el nombre con `nameByComponentId.get(...) ?? id`, sin consultar `definitionOf(...)` — el tooltip ya se
  arregló así en la ronda 2 de 13e y solo falta portar la misma línea. Ídem el inspector de prioridad de
  energía (`floorplan-scene.ts`), que muestra el `instanceId` crudo.

* **El panel contextual no cierra con ESC ni con click al fondo (fine-tunning):** ESC hoy solo cancela el modo
  transferencia o pausa; el click en celda vacía cambia el contenido a `{kind:"empty"}` en vez de cerrar.

* **El punto de nodo de señal tapa el componente (fine-tunning):** `mission-overlay-renderer.ts` dibuja un
  círculo de radio 7 (14px) sobre una celda de 32px — 44% de la celda. El operador pidió removerlo; la
  alternativa mínima es reducirlo y anclarlo a una esquina.

* **i18n de las pantallas de la demo (Obs 9, adelanto de 22c):** hay botones que no cambian de idioma. La
  auditoría total sigue siendo la Fase 22c; acá entra solo el subconjunto que la demo expone (menú, pantallas
  de selección, HUD de misión), porque un idioma a medias se ve en los primeros 30 segundos.

* **La hoja de la puerta se mueve a velocidad constante (playtest de 13h, 2026-08-29):** el operador reporta
  que le falta aceleración. **Ojo antes de empezar: el easing YA EXISTE** — `easedDoorOpenness`
  (`game/src/render/door-visuals.ts`, ronda 2 de playtest de 13h) aplica `Sine.InOut` sobre la apertura. O sea
  que la tarea no es agregarlo sino **que se note**: con 1.5 s de recorrido y 0.9 celdas de desplazamiento, la
  curva senoidal es demasiado suave para leerse como una puerta con motor. Probar una curva más marcada
  (`Quad`/`Cubic.InOut`) y calibrar A OJO contra el movimiento real, que es como se detectó el problema.
  Dos detalles que aparecen al tocarlo: (a) la curva **tiene que respetar los extremos** (0→0, 1→1) o la hoja
  se verá abierta antes de que el paso se libere de verdad — hay un test que ancla justamente eso; (b) el
  contorno de la capa `puertas` usa todavía `doorOpenness` LINEAL para su grosor, así que si la hoja acelera
  y el contorno no, se van a contradecir.

**Bloque 2 — Rediseños con decisión de diseño previa.** Abrir la subfase con **un único ciclo de preguntas**
que los cubra a todos (CLAUDE.md, "minimizar assumptions"), no uno por ítem:

* **Superficie de capas del plano (Obs 15 + Obs 12 + fine-tunning de capas) — son la misma pregunta.** Obs 12
  ("¿hay algún uso real para las capas? ¿qué gana el jugador con verlas?", confirmado por el operador en el
  triaje que se refiere a las capas del plano de misión) es la pregunta de fondo; Obs 15 propone la respuesta:
  iconos sobre el mapa al estilo Google Maps con tooltip, dentro de una tira de herramientas minimizable, en
  vez de una fila de botones que ocupa espacio permanente.

  **DECIDIDO por el operador (2026-08-29), ya no hace falta preguntarlo:** las capas son **EXCLUSIVAS**. Todas
  arrancan apagadas; al seleccionar una, el plano se **oscurece** y solo esa capa queda legible; solo puede
  haber una activa a la vez, y volver a tocarla la apaga. El molde explícito es el **modo de trasvase de
  reservorios** (13e ronda 7), que ya hace exactamente esto: atenúa el mundo entero y deja en claro solo lo
  que importa para la decisión en curso — o sea que el patrón visual, el dim y el manejo de entrada ya existen
  en `floorplan-scene.ts` y no hay que inventarlos.

  Esto **revierte el contrato "inactiva = atenuado, NUNCA oculto"** documentado en
  `floorplan-layer-toggle-panel.ts` desde 11f. Es una reversión deliberada, no un fix: aquella decisión asumía
  capas acumulables, y con cinco capas (`ventilacion`, `electrico`, `fluido`, `senal`, `estructural`,
  `energia`, `puertas`, `presion`) encendidas a la vez el plano es ilegible — que es justamente la
  Obs 12 ("¿qué gana el jugador con verlas?"). Hay que borrar ese docblock, no dejarlo contradiciendo al
  código.

  Consecuencia a revisar al implementarlo: la capa `energia` es hoy la única lectura de "esta sección tiene
  déficit", y con capas exclusivas deja de estar visible por defecto. El tinte + ícono por componente de la
  ronda 3 de 13h cubre el caso de la pieza concreta, pero conviene confirmar que nada más dependa de tener esa
  capa encendida.

* **Rediseño del modal de instalación (Obs 13):** el fondo negro de la columna derecha es un parche temporal
  contra el contraste del gris del modal. Rediseñar la jerarquía de lectura de la ficha, no repintarla.

* **Cursor consistente en todas las escenas (Obs 17):** `game/src/ui/custom-cursor.ts` ya existe desde 12c
  pero solo está cableado en `floorplan-scene.ts`; el resto (title, crew-select, hub, workbench, options) usa
  el puntero del sistema, de ahí el salto abrupto. Falta cursor por defecto global y revisar el
  `setDefaultCursor("default")` que lo revierte en `floorplan-scene.ts`.

* **Resolución mínima soportada (deuda #28):** en 1280×720 la tira de tripulación no entra y el panel de
  acciones se dibuja más allá del borde inferior. Decidir primero si 720p es soportado (dato que la build de
  demo tiene que declarar) y recién después tocar layout.

* **Elegir cantidad al transferir (deuda #27, prioridad baja):** el destino ya se resuelve con el modo espacial
  (ronda 7 de 13e) y la cantidad ya se capa al espacio libre (ronda 9), así que lo único vivo es dejar al
  jugador elegir *cuánto*. `TransferSubstanceTaskPayload` ya lleva `amount`.

* **Histórico de notificaciones — log revisable (pedido del operador, 2026-08-31):** hoy las notificaciones son
  efímeras y no dejan rastro: `NotificationCenter` (`game/src/ui/widgets/notification-center.ts`) auto-descarta
  cada tarjeta a los `2600 + 500·líneas` ms y, encima, tiene `MAX_ACTIVE = 4` — al quinto aviso simultáneo
  **descarta la más vieja antes de tiempo** (`push()`, línea 89), o sea que con varios eventos a la vez el
  jugador pierde avisos que nunca llegó a leer. Es exactamente el caso que más importa: una cascada emergente
  (13a) dispara varios eventos en el mismo tick. Hace falta un histórico persistente durante la misión, con
  detalle consultable en pausa. El motor ya tiene la mitad del dato: `TaskScheduler.pendingNotifications` /
  `drainNotifications()` acumulan las notificaciones de tarea, pero el resto de los avisos se pushean directo a
  la UI sin pasar por ningún registro. Decisiones a tomar en el ciclo de preguntas:
  - **Dónde vive el registro:** ¿un buffer en `/game` alimentado por el propio `NotificationCenter.push()` (más
    barato, pero el log no sobrevive al cambio de escena ni se guarda), o un dominio en `/engine` con eventos
    tipados y serializables? Si el histórico tiene que persistir en el save, es lo segundo y hay bump de
    `CampaignSaveState`.
  - **Superficie de lectura:** ¿panel dedicado abrible desde el HUD (molde de `power-priority-list.ts`), o la
    pila actual que se vuelve scrolleable/expandible al hacer click? Debe respetar la regla de 14d Bloque 1
    ("ningún elemento de UI sobre el mapa deja pasar el click").
  - **Alcance y retención:** ¿solo la misión en curso o toda la campaña? ¿Tope de entradas? ¿Filtro por tipo
    (`info`/`success`/`warning`/`error`) y/o por tripulante?
  - **Detalle por entrada:** timestamp de misión, tipo, tripulante/sección implicados, y si al clickear una
    entrada la cámara viaja a la sección del evento (el "detalle" que pidió el operador).
  - Los textos siguen pasando por claves de traducción (CLAUDE.md); el contrato de color es el de 12e, que
    `notification-center.ts` ya consume.

* **Acciones que quedan bloqueadas de por vida cuando una puerta corta el paso (pedido del operador,
  2026-08-31).** El operador reporta que al bloquearse un set de acciones porque una puerta no deja pasar
  (sin energía, trabada, cerrada por señal), esas acciones **quedan en el listado para siempre**: no se
  reintentan si la puerta vuelve a funcionar y tampoco desaparecen — basura visual. Dos causas raíz distintas,
  ambas verificadas en código:
  - **Las tareas terminales nunca se sacan de la lista.** El armado del panel de cola en `floorplan-scene.ts`
    (`redrawQueuePanel`, ~línea 3105) filtra **solo** `completed`; una tarea `cancelled` o `failed` se sigue
    dibujando indefinidamente. Y `showUnreachable` (`floorplan-scene.ts`) cancela el `go-to` **y todo el tramo
    contiguo** de acciones de ese destino, así que un solo fallo de ruta deja media cola en pantalla como
    zombis.
  - **El bloqueo por dependencia cancelada es permanente por diseño.** `resolveBlockingReason`
    (`engine/src/tasks/task-scheduler.ts`) trata `dependency-cancelled`/`dependency-failed` como bloqueo
    definitivo, y `blocked` **no** es un estado terminal: la tarea queda viva, con el actor en `waiting`, sin
    nadie que la reevalúe nunca. Nótese el contraste deliberado ya documentado ahí: `no-power` sí es
    reversible y se reevalúa cada tick — o sea que el motor ya sabe expresar "bloqueo que se destraba solo",
    y una puerta que recupera energía es más parecido a eso que a una dependencia cancelada.
  Alternativas a decidir (no implementar ninguna sin el ciclo de preguntas):
  1. **Descartar y avisar (mínimo):** las tareas canceladas/falladas desaparecen del panel al terminar (o tras
    un breve fade que las muestre tachadas), y el jugador recibe una notificación con el motivo — que además
    aterriza en el histórico del ítem anterior. Es el fix más chico y resuelve la "basura visual", pero deja
    en pie el trabajo de re-encolar todo a mano.
  2. **Bloqueo reversible por puerta:** que "sin ruta por puerta" deje de cancelar y pase a ser un motivo de
    bloqueo propio (`no-route`), reevaluado cada tick como ya se hace con `no-power`. La tarea se reanuda sola
    cuando la puerta se abre. Riesgo: un tripulante puede quedarse parado indefinidamente sin que el jugador
    entienda por qué — mitigable pintando la tarea en ámbar con el motivo en el label (patrón de 13e ronda 2)
    y encolando la reevaluación solo mientras el destino siga siendo válido.
  3. **Bloqueo reversible con caducidad:** como (2), pero la tarea se auto-cancela si sigue sin ruta después
    de N segundos de simulación, para que la cola no crezca sin techo en una nave rota.
  4. **Re-encolado explícito:** las tareas se cancelan (como hoy) pero el panel ofrece un botón "reintentar"
    sobre el tramo cancelado, que las vuelve a encolar en orden. Deja la decisión en el jugador; es más UI.
  Sea cual sea la elegida, **el panel tiene que dejar de mostrar tareas terminales** — esa parte no depende de
  la decisión de diseño y puede hacerse primero. Y hay que revisar de paso el estado `waiting` del actor, que
  hoy queda pegado mientras exista una tarea `blocked` permanente.

* **Preguntas abiertas de primera impresión (fine-tunning):** "¿el menú inicial se siente profesional, qué le
  falta?" (parcialmente atendido en 12g con la entrada escalonada de botones) y "¿los primeros 10 minutos son
  adictivos, dan algún reward?". No son tareas puntuales; entran acá porque definen exactamente lo que la demo
  vende.



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


* **Acoplamientos cruzados de motor diferidos a post-demo (deuda #34, ubicados acá en el triaje de 2026-08-21).** Cuatro pares quedaron diseñados en el análisis de la matriz de dominios (2026-08-11) sin fase asignada, con la nota "candidatos a partir de la Fase 16". Encajan en esta fase y no antes por dos razones: es la primera post-demo, y es la que introduce los callbacks de cicatriz persistente con los que un desgaste cruzado tiene sentido. Los dos últimos **dependen de que 13f exista** (vida por sección):
   - *Energía→Presión:* regulador de presión activo gateado por energía (contrarresta `SectionPressureSinkSource`, mismo `PRESSURE_RECOVERY_CEILING_KPA` hoy sin escritor).
   - *Presión→Energía:* presión crítica degrada la capacidad efectiva de un conductor de esa sección. Se implementan como **un solo** `ConductorEnvironmentalStressRule` con dos disparadores, no dos reglas separadas.
   - *Energía→Estructura:* sobrecargas repetidas degradan la `condition` de la sección (tercer disparador del escritor de 13c). Depende de que `OverloadEvent` lleve `sectionId` resuelto (hueco ya listado en 13f).
   - *Estructura→Energía:* vida estructural baja reduce la capacidad de los conductores de esa sección (`sectionHullIntegrity` como input de `power-allocation.ts`).
   - **Descartado, no diferido:** Señales↔Estructura en ambos sentidos, decisión explícita del operador — un sensor no debería perder conexión por el estado estructural de su sección.



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
   - **Clave de conducto no única (deuda #12, sumada en el triaje de 2026-08-21):** `ConduitConnection` no tiene id propio y `floorplan-scene.ts::conduitFlowKey` usa `${a}-${b}-${kind}` como clave del `Map` de efectos de flujo — dos conductos del mismo `kind` entre el mismo par de secciones se pisarían. Hoy es bajo riesgo porque ningún mapa lo hace, pero **esta subfase es justamente donde se autoran conductos nuevos**: verificar al autorar, y darle id propio si el patrón aparece.


* **Fase 22d (Assets de audio faltantes, deuda #17 — sumada en el triaje de 2026-08-21):** el pack colocado en `game/assets/audio/` es de ciencia ficción/acción genérico, no industrial de mantenimiento de nave: faltan siseo de fuga de gas, zumbido eléctrico continuo, sirena de alarma, paso sobre piso metálico y chispazo de desmontaje (`dismantle-spark`, 13d, hoy reusando `overloadCut`). Las aproximaciones vigentes están documentadas en `game/src/audio/audio-asset-registry.ts`. Es **procurement del operador**, no código: el punto de cambio es un solo archivo (`AUDIO_KEYS`) y ningún llamador se toca. El derrame y la fuga de 13d siguen mudos a propósito por la misma falta.


* **Fase 22b (Desbloqueos):** Integrar la UI del árbol de logros de GDD §6.8 para reclutar tripulantes nombrados con habilidades pasivas fijas basadas en el estilo de juego del jugador.


* **Fase 22c (Localización):** Auditoría total de los diccionarios de i18n en español e inglés.
   - **Strings que no cambian de idioma (Obs 9):** hay botones de UI que quedan en el idioma anterior al cambiarlo. El subconjunto que expone la demo (menú, pantallas de selección, HUD de misión) se adelanta a la Subfase 14d; la barrida completa —incluida la dirección inversa, buscar claves *sin consumidor*— es esta fase.
   - **Claves huérfanas conocidas (deuda #23):** `ui.menu.workbench.mode-chemistry`/`mode-physical`/`chemistry-hint` quedaron sin consumidor al eliminarse el toggle libre Física/Química de la mesa en 13e. Se dejaron a propósito para que esta auditoría las encuentre en vez de darlas por usadas.



### Fase 23 — Balanceo Técnico & Telemetría de QA

* **Ajuste de Parámetros:** Refinar las variables físicas y químicas de la Especificación técnica §1-§4 basándose en el playtesting de los 8 capítulos en paralelo.


* **Telemetría de Diseños:** Crear un script local de análisis de datos para capturar los esquemas JSON de los Blueprints que utilicen los testers. Esto permitirá identificar si el motor sufre de soluciones "receta" degeneradas que invaliden la emergencia del juego.


* **Parámetros ya marcados para este balanceo** (sumados en el triaje de 2026-08-21):
   - **`GAS_FRACTION_PER_SUBSTANCE_UNIT` (deuda #32):** en 13e ronda 3 pasó a ser fracción por unidad **por unidad de volumen de sección** y se recalibró 0.02 → 0.2 para compensar la división. Plausible pero no jugado en profundidad: con ~20 celdas, un reservorio de 100 unidades satura al 100 %.
   - **Consumos de `powerDraw` (13g):** la tabla de `engine/src/power/power-parameters.ts` arranca con criterio grueso (sensores/chips 1, actuadores 2, mesas 3); lo que cierra 13g es que existan y se respeten, no que estén balanceados.


* **QA sin cobertura automática (deuda #33):** `createGasLeakEffect` ganó umbral, persecución exponencial y opacidad proporcional (13e ronda 3), todo verificable solo a ojo. Es coherente con el estándar laxo de `/game` (smoke visual, no cobertura), pero si se rompe ninguna suite lo va a decir — candidato a smoke test durante el playtesting de los 8 capítulos.



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
| **Triaje 2026-08-21 — UI/UX y bugs de playtest sin fase (Obs 8-19, fine-tunning, deudas #26/#27/#28)**<br> | **Fase 14d**<br> | Bucket único pre-demo: Bloque 1 de bugs con causa raíz confirmada (crash de doble encolado, passthrough de clicks, hit areas, retratos, ESC/cierre) + Bloque 2 de rediseños con ciclo de preguntas propio (capas, modal de instalación, cursor, resolución mínima).

 |
| **Obs 16 + deuda #16 residual — Luces por encima de sprites y paredes**<br> | **Fase 12d**<br> | Entran al ciclo de preguntas de sombras dinámicas: los `PointLight` se registran a depth 7 sobre sprites (2) y paredes (5), y `combustion-effect.ts` sigue sin `LightHook` ahora que se dispara en partida real.

 |
| **Deuda #16 (ampliación 12b) — `HazardEvent` sin llamador de producción**<br> | **Fase 13f**<br> | El daño por exposición atmosférica al tripulante es el escritor hermano del daño por corrosión a la sección: mismo tick, misma lectura de atmósfera.

 |
| **Deuda #15 — Componentes configurables por instancia (LED)**<br> | **Fase 14b**<br> | Umbral + color por instancia y lectura de valor numérico real, junto al resto del trabajo de umbrales sobre el mundo y la generalización de `SignalOutputReader`. Conserva su ciclo de preguntas propio.

 |
| **Deuda #34 — Acoplamientos cruzados Energía↔Presión↔Estructura**<br> | **Fase 16**<br> | Primera fase post-demo y primera con cicatriz persistente; dos de los cuatro pares dependen de que 13f exista. Señales↔Estructura queda descartado, no diferido.

 |
| **Deuda #17 — Assets de audio industriales faltantes**<br> | **Fase 22d**<br> | Procurement del operador; el punto de cambio es `AUDIO_KEYS`, sin tocar llamadores.

 |