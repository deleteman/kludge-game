# CLAUDE.md — Kludge

Instrucciones persistentes de proyecto para Claude Code. Mantener este archivo corto y estable; el plan de trabajo vivo va en `/docs/ORDEN_DE_TRABAJO.md`, no aquí.

## Qué es este proyecto

**Kludge** (título de trabajo) es un juego de gestión de crisis a bordo de una nave espacial. El jugador no recibe piezas nuevas para resolver problemas: reutiliza, desmonta y recombina el equipamiento existente de la nave — MacGyverismo de sistemas, con la misma sensación de composición libre que la redstone de Minecraft, aplicada a física, química y señales en vez de bloques lógicos.

Documentación de referencia (leer antes de tocar el sistema correspondiente):
- `/docs/GDD_nave_sistemas.md` — diseño completo: pilares, mecánicas, arquetipos de nave, tripulación, UI. Es la autoridad de diseño.
- `/docs/Especificacion_datos_tecnicos.md` — parámetros numéricos, matriz de prioridad de reacciones, mapeo sustancia→elementos, difusión atmosférica. Es la fuente de datos para `/engine`.
- `/docs/Primeras_8_crisis.md` — diseño de los primeros 8 capítulos de campaña.

## Stack técnico

- **Motor** (`/engine`): TypeScript puro, sin dependencias de renderizado. Contiene el modelo de propiedades, el grafo de nodos/señales, el motor de reacciones químicas y el sistema de atmósfera.
- **Render/UI** (`/game`): Phaser 3 + plugin rexUI. 100% pixel art, sin overlays HTML.
- **Empaquetado** (`/electron`): Electron, build standalone Windows/Mac/Linux.
- **Testing**: Jest o Vitest sobre `/engine`. Los 16 casos de validación del GDD (sección 9) son la suite de referencia — cada caso debe tener un test correspondiente antes de darlo por resuelto.

## Principios de diseño no negociables (afectan decisiones de código, no solo de diseño)

1. **Emergencia sobre recetas**: nunca hardcodear combinaciones válidas ("si sensor X + láser Y, entonces torreta"). Las combinaciones deben resolverse por propiedades/tags compartidos entre componentes, no por identidad del componente.
2. **Tres capas ortogonales de propiedades**: funcional, material, química. Un componente puede tener varias a la vez; no colapsarlas en una sola enumeración.
3. **Modelo atómico → compuesto → ensamblaje** para componentes físicos, y **elemento → compuesto** para sustancias químicas — misma lógica en ambos dominios, no dos sistemas paralelos.
4. **Resolución de identidad de mezclas químicas en 3 pasos**: receta nombrada > regla de reacción por tags (nombre genérico fijo) > "Mezcla sin identificar" (unión de tags). Nunca dejar un resultado indefinido.
5. **Consecuencias permanentes**: ninguna acción de reparación/improvisación es 100% reversible sin coste (tiempo, material perdido, sección dañada). No implementar undo gratuito.
6. **Legibilidad visual total**: todo estado del motor relevante debe tener representación en partículas — dos fenómenos distintos nunca deben verse igual. Si se añade una nueva regla al motor, añadir su representación visual en el mismo cambio.
7. **Mesa de creación y plano principal comparten la misma lógica de grid/conexión** (10.1 del GDD) — no construir dos sistemas de posicionamiento distintos.

## Convenciones

- Todo el contenido de datos (catálogo atómico, sustancias, recetas, crisis) vive como datos estructurados (JSON/TS), no hardcodeado en lógica de UI.
- Nombres de propiedades y tags en el código deben corresponder exactamente a las etiquetas del GDD (`EM`, `REC`, `ACT`, `RES`, `COND`, `EST`, `CE`, `CT`, `MAG`, `RE`, `ES`, y los tags químicos) para que el código sea trazable al documento de diseño.
- Localización: español e inglés desde el MVP. No hardcodear strings de UI ni de barks de tripulación directamente en el código — usar un sistema de claves de traducción desde el principio.
- pip no aplica (proyecto Node/TS). Para paquetes npm, instalar normalmente; verificar disponibilidad antes de asumir una librería instalada.
- **Arte**: sprites/tiles estáticos vienen de packs de pixel art externos (GDD 11.0), no se generan por código ni se pide a Claude que "dibuje" pixel art detallado. Lo que sí es código: partículas, flujo en conductos, movimiento por salto, iluminación, y el tinte en runtime para adaptar sprites genéricos al código de color por recurso.
- **Cuando falte un sprite**: si una implementación requiere un asset visual que no existe todavía en el proyecto, no usar un placeholder en silencio y seguir — avisar explícitamente en la respuesta (qué sprite falta, para qué componente/entidad del GDD) e indicar la ruta exacta donde se espera que se coloque, siguiendo esta convención de carpetas en `/game/assets/sprites/`:
  - `tiles/` — suelo, paredes, elementos del plano fijo.
  - `components/<id-del-componente>.png` — un archivo por componente físico del catálogo (7.2-7.6), nombrado con el mismo id usado en los datos.
  - `crew/` — base de tripulantes/enemigos (antes del tinte/personalización por código).
  - `ui/` — chrome de paneles, iconos, bordes.
  Mientras el sprite no exista, usar una textura placeholder generada por código (rectángulo de color sólido con el tag/id como texto) para no bloquear el desarrollo — nunca dejarlo como un `TODO` sin señalar.

## Estándares de desarrollo, arquitectura y testeo

**Modularización**: un archivo = una responsabilidad. En `/engine`, separar por dominio en carpetas propias (`properties/`, `signals/`, `chemistry/`, `atmosphere/`, `crew/`, `tasks/`) — nunca un archivo único que mezcle varios dominios. ~200-300 líneas por archivo es la señal de alerta para dividir, no una regla dura: si un archivo la supera, evaluar refactor antes de seguir añadiendo código. Separar tipos/interfaces de la lógica que los usa cuando el archivo empieza a mezclar ambos.

**Patrones de diseño esperados para esta arquitectura** (no aplicar patrones por moda; estos resuelven problemas reales que ya identificamos en el diseño):
- **Strategy** para las reglas de reacción (5.6 del GDD y las reglas químicas de 5.3): cada regla (AND/OR/NOT de señales, neutralización, combustión, incapacitación tóxica, etc.) implementa una interfaz común ("¿aplica a este estado? → aplicar"), no un switch/if-else gigante. Nuevas reglas se añaden implementando la interfaz, no editando un método central.
- **Observer/eventos** entre `/engine` y `/game`: el motor emite eventos de dominio (sobrecarga, combustión, muerte de tripulante, fallo estructural) y `/game` se suscribe para disparar partículas — `/engine` nunca importa nada de Phaser ni conoce que existe una capa visual. Esto es lo que mantiene real la separación motor/render ya establecida.
- **Factory** para construir compuestos desde recetas atómicas (7.1-7.2 del GDD) y para instanciar el resultado de una reacción química (5.3, incluida la rama de "Mezcla sin identificar").
- **State machine** explícita para el estado de una tarea encolada (pendiente / en curso / bloqueada por dependencia / completada / cancelada) y para el modo del core loop (planificación / ejecución) — no banderas booleanas sueltas.
- **Data-driven**: cualquier contenido (catálogos, recetas, crisis, parámetros numéricos) vive como datos importables, nunca como literales dentro de la lógica que los consume.

**Testeo integrado al desarrollo, no posterior**:
- Cada regla nueva en el motor de reacciones o de señales se añade junto con su test unitario en el mismo cambio — no se acumula "testear después".
- Dos niveles de test en `/engine`: unitario por regla individual aislada, e integración por caso de validación completo (GDD sección 9) combinando varias reglas a la vez, tal como ocurre en una crisis real.
- No mergear una regla o componente nuevo en `/engine` sin al menos un test que lo cubra. Este estándar es más laxo en `/game` (UI) — ahí priorizar smoke tests visuales sobre cobertura exhaustiva.
- La Fase 3 del orden de trabajo (los 16 casos de validación pasando) es un hito puntual, no el único momento de testear — es el piso mínimo antes de avanzar a contenido, el testeo continuo sigue después.


## Orden de implementación
Cada vez que inicies el proceso de implementación, seguirás estos pasos **sin excepción**:
1. Leer los documentos del proyecto para entender que tienes la ultima versión del entendimiento
2. Planificar la implementación (si ya no vienes con un plan de implementación dado), para esta planificación utiliza los criterios aprendidos del feedback del operador en `feedback-aprender-del-patron-de-playtest`.
3. Solicitar al operador humano cualquier dato que no tengas claro, **debes minimizar tus assumptions al minimo** y preguntar antes de implementar nada.
4. Implementar la tarea actual siguiendo las guías definidas en este y otros documentos.
5. Cuando termines con la actividad actual, actualizar el archivo `ORDEN_DE_TRABAJO.md` marcando la tarea como cerrad.
6. Mantendras un log de cambios en `changelog.log` en donde registraras la fecha del cambio, el detalle de lo que hicisite y la razón.
7. Al cerrar cualquier fase o sub-fase, actualizar MAPA_DEL_CODIGO.md con los módulos nuevos o modificados — una línea por módulo, no un changelog. Es un paso de cierre, no opcional.
8. al cerrar cualquier fase o sub-fase de iteracion, actualiza los criterios de diseño que tienes en `feedback-aprender-del-patron-de-playtest` a partir de lo que yo te doy como feedback del playtest para evitar esos problemas a futuro.



## Uso eficiente de contexto (agentes y lecturas)
 
- Antes de delegar la exploración de un archivo a un subagente, decidir si el siguiente paso ya es editarlo. Si sí, leerlo directamente — delegar y luego releer el mismo archivo paga el costo dos veces. Los subagentes de exploración son para responder una pregunta puntual, no un paso previo a una edición ya decidida.
- Al explorar varios archivos relacionados que se van a sintetizar en un mismo plan, agrupar en 2-3 agentes de alcance más amplio en vez de uno por archivo — cada spawn tiene overhead fijo de contexto frío y no comparte hallazgos con los demás.
- Antes de leer un archivo completo para un cambio puntual (un método, una propiedad), usar Grep para localizar la región exacta y leer solo esa parte. Reservar la lectura completa para cambios que de verdad tocan el archivo de forma amplia.

## Qué NO hacer

- No construir un editor de niveles como producto aparte — el plano físico es fijo por arquetipo (15.1 del GDD), autorado en Tiled. La colocación de componentes iniciales se hace reutilizando la propia UI de juego en modo dev (15.2), no con una herramienta separada.
- No usar localStorage/sessionStorage en ningún prototipo (aunque esto es Electron y no Artifacts, mantener el estado en memoria/disco propio del proceso, no en APIs de navegador no soportadas de forma consistente).
- No simular química real (estequiometría, pH numérico) — el sistema de tags simplificado es intencional, no un placeholder pendiente de "mejorar".
- No añadir animación de caminata a tripulantes/enemigos — el movimiento es por salto parabólico (11.2 del GDD), es una decisión de arte, no una limitación temporal.

## Verificación de cambios

Antes de dar por cerrada una funcionalidad del motor: correr los tests de los casos de validación relevantes (GDD sección 9) y confirmar que el resultado es coherente con el documento de datos técnicos, no solo que compila.
