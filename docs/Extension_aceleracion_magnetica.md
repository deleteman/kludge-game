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

## 3. Daño por impacto cinético

**Enunciado**: cuando un objeto acelerado por la regla anterior colisiona (con estructura, un componente, o un tripulante/enemigo), se aplica daño por impacto cinético, calculado con dos factores, ambos ya existentes en el sistema — no se introduce una propiedad de "masa" nueva:

- **Velocidad acumulada** (sección 2 de este documento).
- **Tamaño/footprint de la pieza** (GDD 7.2), como proxy de masa.

**Regla de resolución** (bajo/medio/alto, misma escala que el resto del sistema):
- Daño **alto** si la velocidad es alta.
- Daño **medio** si la velocidad es media, o si la velocidad es baja pero el tamaño de la pieza es grande.
- Daño **bajo** en el resto de los casos.

Este cálculo deliberadamente no pondera con precisión "física real" (no es ½mv²) — es una tabla de resolución cualitativa consistente con cómo se resuelven el resto de reglas de interacción del GDD (5.6).

## 4. Representación en partículas (extiende GDD 11.1)

Nuevo fenómeno a añadir a la tabla de partículas del GDD:

| Fenómeno | Representación en partículas |
|---|---|
| Aceleración magnética activa | Estela/rastro sutil detrás del objeto en movimiento, intensidad proporcional a la velocidad acumulada; sin estela si la velocidad es baja |
| Impacto cinético | Burst de partículas de impacto (chispas/fragmentos según superficie) + breve sacudida de cámara si el daño es alto; reutiliza el lenguaje visual ya establecido de "daño a estructura/tripulante" del GDD 11.1, no un sistema nuevo — el impacto cinético se distingue de otros daños por el burst direccional (en la trayectoria del objeto) en vez de radial (como una explosión) |

## 5. Caso de validación propuesto (extiende GDD sección 9, caso 17)

**"El Cañón de Riel Improvisado"**: el jugador coloca varias bobinas de cobre enrolladas alrededor de un tubo rígido, en secuencia, cada una con su propio receptor de señal temporizado para activarse justo cuando el proyectil (una pieza ferromagnética, ej. un imán permanente o pieza de hierro) pasa por ella. El jugador debe calcular el espaciado y la temporización para que la inercia se acumule pulso a pulso en vez de perderse entre bobinas → valida la regla de aceleración magnética completa (decaimiento + inercia) y la regla de daño cinético (velocidad × tamaño), usando únicamente piezas ya catalogadas en el GDD (7.2), sin ningún componente nuevo.

## 6. Nota para integración futura

Cuando se decida fusionar esta extensión al GDD:
- La tabla de intensidad de `MAG` (sección 1) reemplaza la línea correspondiente en GDD 5.2.
- Las reglas de las secciones 2 y 3 se añaden como nuevos bullets en GDD 5.6.
- La fila de partículas (sección 4) se añade a la tabla de GDD 11.1.
- El caso de validación (sección 5) se numera como caso 17 en GDD sección 9, y la nota de auditoría de cobertura debería actualizarse para mencionarlo.

Mientras tanto, dado que el proyecto ya está en fase 3 (suite de validación), esta regla debería recibir su propio test unitario en `/engine` antes de darse por integrada, siguiendo el estándar de CLAUDE.md ("cada regla nueva... se añade junto con su test unitario en el mismo cambio").
