
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



### Fase 12 — Pulido Estructural Sensorial: Luces y Audio

El objetivo aquí es asegurar la inmersión visual y el feedback diegético necesario antes de masificar los niveles.

#### Subfase 12a: Iluminación Dinámica y Estados de Daño

* **Iluminación Aditiva Dinámica:** Crear un renderizado de luces aditivas simples por código en `/game` (sprites radiales con opacidad variable y tintado en tiempo real). Implementar un parpadeo de alerta en toda la pantalla de juego o en la sección afectada cuando ocurran fugas o incendios críticos.


* **Estados de Daño de Fondo:** Integrar efectos de daño persistentes (`StateDrivenEffect` de la Fase 8) vinculados a las cicatrices activas (por ejemplo, chispas eléctricas continuas de un conductor sobrecargado o parpadeos de luz ambiental en secciones sin energía).



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


### Fase 13 — Capítulo 2: "Ecos en el Pasillo"

* **Lógica Avanzada de Señales:** Diseñar el nivel de forma que requiera construir filtros AND/OR/NOT en la capa de señales utilizando sensores de movimiento y el chip de identificación de tripulación.


* **Amenaza Física Real:** Introducir el primer actor enemigo (11d) que el jugador deba neutralizar de forma activa para completar la misión.



### Fase 14 — Hito: Publicar Demo en Itch.io y Página de Steam

* **Contenido de la Demo:** Limitar la build a los Capítulos 1 y 2 con el arquetipo de Exploración completamente jugable (único con tile art pulido).


* **Estrategia de Captación:** Habilitar la importación/exportación de archivos JSON de Blueprints desde la mesa creativa para fomentar la viralización comunitaria. Redirigir el final de la demo a la página de Steam para acumular wishlists.



---

## Q2 (Meses 4–6): Meta-progresión y Escalado de Niveles Medios

Este trimestre se enfoca en expandir la jugabilidad con la introducción de variables de tiempo y memoria, agregando mecánicas de progresión persistente para retener a los jugadores de la demo.

### Fase 15 — Capítulo 3: "La Alarma que no Calla"

* **Lógica de Memoria:** Implementar el diseño de nivel que requiere el uso del comportamiento `latch` (memoria síncrona) para capturar alertas fugaces de sensores de presión.


* **Cicatriz Permanente:** El desenlace de la crisis genera la primera reducción persistente de la resistencia estructural (`RE`) en la sección afectada de la nave.



### Fase 16 — Capítulo 4: "Cortocircuito en la Bahía de Carga"

* **Física de Materiales:** El nivel introduce el comportamiento de cambio de estado y conductividad de fluidos variables con la temperatura (caso de validación 2). El jugador se enfrenta a un límite estricto de 90 segundos para enfriar un cableado o congelar una fuga de refrigerante.



### Fase 17 — Capítulo 5: "El Reactor al Límite"

* **Pilar de Sacrificio:** Crisis avanzada de sobrecarga del reactor principal. El jugador debe tomar la decisión permanente de drenar y desactivar permanentemente la energía de una sección no crítica para salvar el soporte vital. La sección sacrificada se guarda como "sin energía" en la partida persistente de la campaña (11b).



---

## Q3 (Meses 7–9): Complejidad Avanzada, Cierre de Campaña y Steam Next Fest

Es el momento de introducir la simulación cruzada y participar en el festival de demos de Steam con un tráiler profesional.

### Fase 18 — Capítulo 6: "Ataque y Fuga Simultánea"

* **Simulación Multi-Falla:** Dos emergencias paralelas: abordaje hostil avanzado (11d) y fuga de amoníaco tóxico en el invernadero. Exige coordinar dependencias directas en la cola de tareas de la tripulación (Caso 14) y usar la mesa de creación en vivo en plena misión (11b) para ensamblar defensas improvisadas.



### Fase 19 — Capítulo 7: "Las Cicatrices Vuelven"

* **Callback de Campaña:** El juego consulta el estado persistente guardado (11b). La sección con resistencia `RE` reducida en el Capítulo 3 o la zona desenergizada en el Capítulo 5 falla ante una fuga corrosiva y tóxica cruzada (caso de validación 13 de orden de prioridad entre tags simultáneos). Exige realizar síntesis química en la mesa de creación (11b) para neutralizar el ácido.



### Fase 20 — Capítulo 8: "Punto de No Retorno"

* **Maniobra de Navegación (Piloto):** Introducir la mecánica de evasión a nivel de nave espacial (Caso 16), forzando al tripulante de rol Piloto a operar los actuadores de propulsión de la nave bajo una cuenta regresiva estricta.


* **Clímax:** Una cascada de fallas en múltiples secciones simultáneas donde la resolución depende exclusivamente de la ruta de reconstrucción atómica desde cero (desarmar compuestos inutilizados en la mesa de creación para obtener piezas elementales limpias).



---

## Q4 (Meses 10–12): Pulido de Arquetipos, Telemetría, Balanceo y Publicación

El trimestre final se enfoca en el aseguramiento de la calidad técnica, el soporte multiplataforma y la salida al mercado.

### Fase 21 — Pulido General de Contenido e i18n

* **Fase 21a (Soporte de Arquetipos):** Extender la verificación de los 8 capítulos jugables a las naves de Investigación, Guerra y Médica, resolviendo anomalías de anclaje visuales específicas de cada plano.


* **Fase 21b (Desbloqueos):** Integrar la UI del árbol de logros de GDD §6.8 para reclutar tripulantes nombrados con habilidades pasivas fijas basadas en el estilo de juego del jugador.


* **Fase 21c (Localización):** Auditoría total de los diccionarios de i18n en español e inglés.



### Fase 22 — Balanceo Técnico & Telemetría de QA

* **Ajuste de Parámetros:** Refinar las variables físicas y químicas de la Especificación técnica §1-§4 basándose en el playtesting de los 8 capítulos en paralelo.


* **Telemetría de Diseños:** Crear un script local de análisis de datos para capturar los esquemas JSON de los Blueprints que utilicen los testers. Esto permitirá identificar si el motor sufre de soluciones "receta" degeneradas que invaliden la emergencia del juego.



### Fase 23 — Empaquetado Standalone y Lanzamiento

* Configurar los builds nativos de Electron para Windows, macOS y Linux.


* Publicación de la versión 1.0 en Steam.



### Fase 24 — Modo Dev de Autoría de Estado Inicial (Baja Prioridad)

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
| **Gap: Cicatrices de Campaña**<br> | **Fase 11b / 19**<br> | Guardado de RE reducido y zonas sin energía + callbacks.

 |
| **Gap: Legibilidad del Plano (Capas + Flujo Animado, GDD §10)**<br> | **Fase 11f**<br> | Toggle de capas HUD + integración de `conduit-flow-effect` al plano real.

 |
| **Gap: Iluminación Dinámica**<br> | **Fase 12a**<br> | Luces aditivas, pulsos de alerta y parpadeos en cables.

 |
| **Gap: Audio Sistémico**<br> | **Fase 12b**<br> | SFX reactivos por reglas e integración de barks de voz.

 |
| **Gap: Balanceo y Telemetría**<br> | **Fase 22**<br> | Registro de Blueprints de QA para interceptar meta-soluciones.

 |
| **Gap: Mitigar Frustración / Dead Ends**<br> | **Fase 11b (Save System)**<br> | El guardado manual y el sistema de reintento de misiones previenen bloqueos insalvables.

 |
| **Estrategia de Wishlists**<br> | **Fase 14 (Demo)**<br> | Integración del importador de Blueprints en la demo para viralidad.

 |