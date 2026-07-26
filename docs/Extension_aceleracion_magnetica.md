# Extensión de regla — Aceleración magnética y daño por impacto cinético

Documento independiente, no fusionado al GDD (en uso activo durante desarrollo, fase 3 del orden de trabajo). Extiende conceptualmente las secciones 5.2 (propiedades de material), 5.6 (reglas de interacción), 9 (casos de validación) y 11.1 (partículas) del GDD — referenciadas aquí, no modificadas allí.

## Motivación

El sistema actual permite generar campos magnéticos (`MAG`, GDD 5.2) pero los trata como propiedad binaria (presencia/ausencia), usada hasta ahora solo para efectos estáticos (ej: caso de validación 9, "El Electroimán de Emergencia" — traba una puerta por atracción). No existía ninguna regla que conectara un campo magnético con movimiento acumulativo de un objeto — es decir, no era posible construir nada tipo acelerador electromagnético (coilgun) con causalidad real, aunque las piezas para ensamblarlo físicamente ya existían.

Esta extensión añade esa causalidad como una regla física genérica, no como un componente nombrado — sigue el pilar de diseño 4 del GDD (emergencia sobre recetas): el jugador puede llegar a un acelerador de proyectiles combinando piezas ya existentes, sin que el juego lo reconozca como "coilgun", solo como consecuencia de reglas simples.

## 1. Intensidad del campo magnético (extiende GDD 5.2)

`MAG` deja de ser booleano. Un campo magnético activo tiene una intensidad cualitativa:

| Intensidad | Condición |
|---|---|
| Baja | Una bobina activa, corriente baja |
| Media | Una bobina con corriente alta, o 2-3 bobinas activas en secuencia con corriente baja/media |
| Alta | Múltiples bobinas activas en secuencia con corriente alta |

Esta escala es consistente con el resto de propiedades de material del GDD (CE, CT, RE ya usan bajo/medio/alto) — no se introduce una escala numérica nueva.

## 2. Regla de aceleración magnética

**Enunciado**: un objeto ferromagnético (`MAG`-Sí) suelto dentro del alcance de un campo magnético activo se mueve hacia la fuente a una velocidad proporcional a la intensidad del campo (tabla anterior), con dos matices necesarios para que la regla sea físicamente coherente y no solo "un imán que atrae":

- **Decaimiento con la distancia**: la fuerza de atracción se debilita cuanto más lejos está el objeto de la bobina. Un campo de intensidad alta a corta distancia puede comportarse como intensidad media o baja si el objeto está lejos del origen.
- **Inercia**: el objeto conserva su velocidad acumulada al salir del alcance de una fuente, hasta encontrarse con la siguiente fuente activa, fricción/colisión, o el límite físico de la sección. Esta es la parte que convierte la regla en "acelerador" y no en "imán simple": pasar por varias bobinas activadas en secuencia (mediante temporización, ya cubierta por GDD 5.6) **acumula** velocidad en vez de reiniciarla en cada bobina.

**Nota de implementación**: no se simula masa, fricción real ni física de cuerpo rígido completa — es una regla de velocidad acumulada por pulsos discretos, coherente con el pilar de diseño 3 del GDD (reglas simples y predecibles, no simulación dura).

> **Enmienda (Fase 11a.2, ASA 2 — 2026-07-17)**. La inercia de la sección anterior tenía un límite no resuelto: el objeto conservaba su velocidad "hasta encontrarse con la siguiente fuente activa, fricción/colisión, o el límite físico de la sección" — pero ninguna de esas tres condiciones existía todavía para una sala vacía sin más bobinas ni obstáculos. Un proyectil que alcanzaba velocidad alta y salía del alcance de toda bobina la conservaba para siempre, rebotando sin control (`nuevo-orden.md`, ASA Flaw 2).
>
> **Regla añadida — drag por celdas recorridas**: mientras el objeto no está bajo la influencia de ninguna bobina activa, su velocidad decae un nivel cualitativo (Alta → Media → Baja → Detenido) por cada `dragThresholdCells` celdas recorridas sin un pulso nuevo. El peso acumulado que sostiene la velocidad decae junto con ella — un pulso posterior tiene que volver a ganarse el nivel perdido, no restaurarlo de un pico histórico que nunca bajó, consistente con el principio 5 de CLAUDE.md ("ninguna acción se revierte gratis") aplicado también a la pérdida de impulso, no solo a su ganancia.
>
> El umbral (`dragThresholdCells` en `kinetics/magnetic-acceleration.ts`) se fijó deliberadamente conservador (decisión del operador): mayor que cualquier hueco entre bobinas de un riel bien calculado (caso 17), e incluso mayor que la deriva que produce un pulso perdido y recuperable (caso 17, 2° test: una bobina fuera de rango). El drag es una red de seguridad para derivas largas sin ninguna bobina más en el camino — una sala vacía, no un castigo a un riel bien diseñado ni a un error de posición ya penalizado por el decaimiento por distancia de arriba.

## 3. Daño por impacto cinético

**Enunciado**: cuando un objeto acelerado por la regla anterior colisiona (con estructura, un componente, o un tripulante/enemigo), se aplica daño por impacto cinético, calculado con dos factores, ambos ya existentes en el sistema — no se introduce una propiedad de "masa" nueva:

- **Velocidad acumulada** (sección 2 de este documento).
- **Masa virtual**, derivada del **tamaño/footprint de la pieza** (GDD 7.2) cruzado con su **resistencia estructural `RE`** (GDD 5.2). Sigue sin ser una propiedad autorada: es una regla sobre dos propiedades que ya existen.

**Regla de resolución** (bajo/medio/alto, misma escala que el resto del sistema):

|  | masa baja | masa media | masa alta |
|---|---|---|---|
| **velocidad baja** | bajo | bajo | medio |
| **velocidad media** | bajo | medio | **alto** |
| **velocidad alta** | **medio** | alto | alto |

La masa virtual sale de cruzar el bucket de tamaño (por área del footprint) con `RE`; **`RE` ausente cuenta como ligera** (la mayoría del catálogo no la declara, y el defecto por ausencia no debe regalar daño):

|  | RE baja | RE media | RE alta |
|---|---|---|---|
| **tamaño pequeño** | baja | baja | media |
| **tamaño mediano** | baja | media | alta |
| **tamaño grande** | media | alta | alta |

Este cálculo deliberadamente no pondera con precisión "física real" (no es ½mv²) — es una tabla de resolución cualitativa consistente con cómo se resuelven el resto de reglas de interacción del GDD (5.6).

> **Enmienda (Fase 11a.1, ASA 1 — 2026-07-17)**. La versión anterior de esta sección usaba el footprint como único proxy de masa y fijaba tres reglas: "daño alto si la velocidad es alta; medio si la velocidad es media, o si es baja pero el tamaño es grande; bajo en el resto". El defecto (`nuevo-orden.md`, ASA Flaw 1): **una carcasa de plástico vacía hacía exactamente el mismo daño que una plancha de metal reforzada del mismo tamaño**, porque `RE` — la propiedad que ya las distingue en el catálogo — no participaba.
>
> La tabla nueva **deroga el literal "daño alto si la velocidad es alta"** (decisión del operador): la masa modula en **ambos** sentidos, así que un proyectil ligero a velocidad alta hace daño medio. Degradar era necesario para que la corrección alcanzara la fila que más importa — si la masa solo agravara, el imán y la plancha lanzados igual de rápido seguirían matando igual, que es justo el defecto que ASA 1 existe para corregir.
>
> Consecuencia de diseño buscada en el caso 17 (sección 5): elegir el proyectil pasa a ser una decisión con desenlace propio — el mismo riel, con la misma temporización, mata con una pieza de hierro (`RE` alta) y solo hiere con un imán permanente.

## 4. Representación en partículas (extiende GDD 11.1)

Nuevo fenómeno a añadir a la tabla de partículas del GDD:

| Fenómeno | Representación en partículas |
|---|---|
| Aceleración magnética activa | Estela/rastro sutil detrás del objeto en movimiento, intensidad proporcional a la velocidad acumulada; sin estela si la velocidad es baja |
| Impacto cinético | Burst de partículas de impacto (chispas/fragmentos según superficie) + breve sacudida de cámara si el daño es alto; reutiliza el lenguaje visual ya establecido de "daño a estructura/tripulante" del GDD 11.1, no un sistema nuevo — el impacto cinético se distingue de otros daños por el burst direccional (en la trayectoria del objeto) en vez de radial (como una explosión) |

## 5. Caso de validación propuesto (extiende GDD sección 9, caso 17)

**"El Cañón de Riel Improvisado"**: el jugador coloca varias bobinas de cobre enrolladas alrededor de un tubo rígido, en secuencia, cada una con su propio receptor de señal temporizado para activarse justo cuando el proyectil (una pieza ferromagnética, ej. un imán permanente o pieza de hierro) pasa por ella. El jugador debe calcular el espaciado y la temporización para que la inercia se acumule pulso a pulso en vez de perderse entre bobinas → valida la regla de aceleración magnética completa (decaimiento + inercia) y la regla de daño cinético (velocidad × masa virtual, sección 3), usando únicamente piezas ya catalogadas en el GDD (7.2), sin ningún componente nuevo. Desde la Fase 11a.1 el caso valida además la elección de proyectil: el mismo riel bien calculado mata con la pieza de hierro y solo hiere con el imán permanente. Desde la Fase 11a.2 el caso valida además el drag: una bobina bien ubicada pero encendida demasiado tarde deja al proyectil derivando lo suficiente para que el impulso decaiga por completo antes de que la siguiente bobina lo alcance, así que esa bobina reconstruye el impulso desde cero en vez de reforzarlo.

## 6. Cómo un objeto se vuelve proyectil, y trayectoria fantasma en pausa táctica (Fase 11a.3, ASA 3)

**Decisión del operador (2026-07-17)**: "cargar un proyectil" NO es un verbo
nuevo de jugador ni una mecánica con UI propia — es un efecto EMERGENTE de
las mecánicas que ya existen (principio 1 del GDD, identidad por
propiedades). El jugador instala una pieza ferromagnética suelta
(`iman-permanente`, `pieza-hierro`, catálogo GDD 7.2) con el flujo normal de
instalación (`queueInstall`, sin cambios). En el momento en que esa pieza
tiene núcleo ferromagnético (`MAG`) pero NO es ella misma un electroimán
activo (no conduce electricidad — el mismo criterio de propiedades con el
que el caso 9 arma un electroimán), deja de ser una entrada fija del
`Blueprint` y pasa a ser un objeto suelto simulado por `kinetics/`. Ninguna
acción explícita del jugador dispara esto — es la física la que decide, no
una UI ("cargar proyectil"). Una vez promovida, la pieza no vuelve al
`Blueprint` (principio 5: ninguna acción se revierte gratis), incluso en
reposo tras un impacto.

**Trayectoria fantasma**: en modo planificación (pausa total del reloj), si
hay al menos un proyectil suelto en el plano, se calcula y dibuja una
predicción de su trayectoria futura — la MISMA simulación que corre en
ejecución (`ProjectileSimulation`, con drag ASA 2 incluido: "si predice sin
drag, miente"), corrida como un dry-run desechable sobre una copia congelada
del estado actual (blueprint + señales), nunca sobre el estado real. Se
calcula UNA vez al entrar en pausa (el reloj congelado garantiza que nada de
lo que alimenta la predicción cambia mientras el jugador la mira), no por
frame.

**Limitaciones heredadas, no nuevas** (`PENDIENTES_OBSERVACIONES.md`): la
predicción reutiliza `allEmittersActive` (todo emisor cableado se comporta
como sensor permanentemente disparado — la simulación de sensores reales no
existe todavía) y no puede predecir un impacto contra tripulación (el motor
no modela posición por celda de un tripulante). El fantasma es exactamente
tan (in)exacto en estos dos puntos como el juego en vivo — no introduce un
defecto nuevo, hereda uno ya documentado.

## 7. Nota para integración futura

Cuando se decida fusionar esta extensión al GDD:
- La tabla de intensidad de `MAG` (sección 1) reemplaza la línea correspondiente en GDD 5.2.
- Las reglas de las secciones 2 y 3 se añaden como nuevos bullets en GDD 5.6.
- La fila de partículas (sección 4) se añade a la tabla de GDD 11.1.
- El caso de validación (sección 5) se numera como caso 17 en GDD sección 9, y la nota de auditoría de cobertura debería actualizarse para mencionarlo.
- La regla de promoción emergente y la trayectoria fantasma (sección 6) se añaden como bullets nuevos en GDD 5.6 y 10 (feedback predictivo del core loop) respectivamente.

Mientras tanto, dado que el proyecto ya está en fase 3 (suite de validación), esta regla debería recibir su propio test unitario en `/engine` antes de darse por integrada, siguiendo el estándar de CLAUDE.md ("cada regla nueva... se añade junto con su test unitario en el mismo cambio").
