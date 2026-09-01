# Ronda 1 de playtest de 14a-2 — legibilidad del eje térmico

> **Estado: PLANIFICADO, sin implementar.** Escrito el 2026-08-31 tras la ronda 1 de playtest de la Subfase
> 14a-2 (commit `be02782`). Documento de referencia: el diagnóstico está verificado contra el código, pero
> ninguno de los bloques se ejecutó todavía. La sección "Lo que NO entra" es el insumo de la subfase del
> cableado con material, que el operador ya decidió hacer y que todavía no tiene plan propio.

## Context

14a-2 cerró los acoplamientos térmicos y el motor los sostiene: la suite recorre la cadena entera. Pero el
operador jugó la cadena fría y reportó cuatro cosas que, verificadas en código, resultaron ser **una mentira de
la UI, dos efectos visuales que no comunican, y un problema de modelado de fondo**. Ninguna es un bug del
motor: son exactamente el patrón recurrente de este proyecto — el modelo funciona y el jugador no puede verlo.

Diagnóstico de cada punto (verificado, no inferido):

1. **"La caída de temperatura debería congelar toda la sección; ahora congela una celda."** Cierto y medible:
   `initSectionAtmosphereEffects` (`floorplan-scene.ts:3320-3334`) crea **un** emisor por sección en
   `sectionCentroidCell`, con `spreadRange(10)` — 10 px en una sala de decenas de celdas. Sus dos hermanos
   (`gasLeak`, `heatVapor`) tienen el mismo defecto. Y sobre "¿debería afectar al tripulante?": **sí, y el GDD
   ya lo pide** — "Frío extremo/congelación" está en la tabla de causas de muerte (6.1) y "Daño a tripulante
   (térmico/…)" en 11.1. Hoy **no existe ningún camino** por el que la temperatura dañe a alguien; el único
   consumidor de la temperatura para daño es la sección.
2. **"El cable no muestra ningún estado en su tooltip."** Cierto. `InstanceStateFlag` tiene **un solo valor**,
   `unpowered` — y el docblock de `instance-state.types.ts:15-17` ya nombra *"sobrecargado
   (`Blueprint.overloadedRefs`)"* como el candidato natural con la infraestructura lista. **Esto lo prometía el
   plan de 14a-2 y no lo implementé**: la subfase quedó cerrada con la mitad visible del acoplamiento sin
   hacer.
3. **"El brillo sube y baja, ¿qué representa? No veo chispas continuas, ¿la luz las tapa?"** La luz **no**
   puede taparlas: está a `dynamicLight` (1.8) y las chispas a `effect` (7), o sea las chispas van encima. Las
   causas reales son tres: (a) chispas y luz usan el **mismo tint exacto** `0xf2d24b`, así que la chispa no
   contrasta contra su propio glow; (b) `quantity: 1` cada `240 ms` con `lifespan: 200` deja intervalos con
   **cero partículas vivas**; (c) las chispas están confinadas a ±4 px dentro de un glow de 64 px de radio.
   Ojo: una ronda previa ya las atenuó *"porque el glow tapaba el campo de luz"* — subirlas otra vez sin
   revisar aquello reintroduce ese hallazgo.
4. **"¿Por qué el jugador metería un cable de cobre en el mapa?"** La pregunta correcta, y la respuesta es que
   hoy **no tiene ningún motivo**. Detalle en la sección siguiente.

**Un hallazgo que afecta a lo que viste jugando**: el Cap. 1 (arquetipo `exploracion`) siembra un `cable-cobre`
en `ingenieria` (22,12) con `scriptedOverloads: [{ load: 9 }]` contra capacidad 6. Ese cable **revienta en el
primer tick de ejecución, pase lo que pase**, y además **no tiene nodo de señal**, así que su carga emergente
sería 0. Es attrezzo de la Fase 12a para validar la iluminación. Si el cable que viste brillar fue ese, el
brillo no tuvo nada que ver con el nitrógeno — es un falso positivo permanente que hace imposible playtestear
esta mecánica.

---

## Por qué el cable de cobre no cierra (punto 4) y qué se hace con él

Lo verificado:

- El modo cableado conecta **nodo A → nodo B directamente**. La arista se rutea por los **conductos `senal` del
  plano** (`computeSignalWireRoute` → `computeConduitRoute(…, "senal")`), nunca a través de piezas.
  `assertSignalWiringReachable` valida conductos, no conductores.
- El rol de nodo `"conductor"` tiene **cero lectores en producción**: el evaluador solo bifurca en `emitter`, y
  un `conductor` es semánticamente **idéntico a un `receptor`** (regla `passthrough`).
- Consecuencia: cablear *a través* de un cable colocado agrega un tick de latencia y no aporta nada más.
- **La arista que dibuja el jugador es gratis, instantánea y de capacidad infinita.** No cuesta material, no
  ocupa celdas y no se puede sobrecargar.

O sea: el único incentivo que existe hoy para colocar un `cable-cobre` es la mecánica de sobrecarga que
introduje en 14a-2. Colgué el acoplamiento térmico de una pieza que nadie tiene motivo para poner. Es el
patrón de siempre —una mecánica correcta sin camino jugable— cometido por mí en la subfase anterior.

**Decisión del operador**: el cableado que dibuja el jugador **pasa a ser el conductor**. Eso es una subfase
propia (toca `SignalEdge`, `schemaVersion` y el consumo de stock al cablear) y **no entra en esta ronda** — se
deja escrita en `nuevo-orden.md` con sus preguntas abiertas. Ver la sección final.

---

## Qué entra en esta ronda

### Bloque A — El frío se ve en toda la sección y duele

**A1. Efectos de atmósfera con cobertura de sección (los tres, no solo la escarcha).**
Arreglar solo el frío dejaría a `gasLeak` y `heatVapor` con el mismo defecto, que es el patrón de "arreglar un
indicador y dejar a sus hermanos rotos". Un único cambio en
`game/src/particles/effects/atmosphere-state-effects.ts` + su punto de creación:

- **Un emisor por sección, con `emitZone` sobre las celdas REALES** (no el bounding box, que incluiría pared):
  un objeto con `getRandomPoint(point)` que elige una celda al azar de `section.cells` y un offset dentro de
  ella. Mantiene un emisor por sección (barato) y cubre la sala exacta. Hace falta pasarle `section.cells` a
  `start()`, hoy recibe solo el centroide.
- **Intensidad escalada por severidad**, no binaria: hoy `freezing` y `heatVapor` son on/off de tamaño fijo,
  mientras `gasLeak` ya escala `quantity`/`alpha`/radio con la concentración. Se unifican al criterio del
  hermano que ya lo hace bien: `quantity` proporcional a cuánto se pasó del umbral, y también a `sectionArea`
  (una sala grande necesita más partículas para leerse igual de densa).
- **Capa de escarcha por celda** reusando el molde de `redrawUnpoweredSectionScar`
  (`floorplan-scene.ts:3968-3987`): `Graphics` con `fillRect` por celda y alpha modulado por severidad, igual
  que la capa de presión (`floorplan-renderer.ts:350-368`). Es lo que da la lectura de "toda la sala está
  congelada" que las partículas solas no dan. Depth propio, entre `sectionScar` y `objects`.

**A2. Daño térmico a la tripulación** — quinto peligro de `MissionHazardRuntime`.

- Entrada `thermal` en `HAZARD_PARAMETERS` (`engine/src/mission/mission-hazard-parameters.ts`), junto a
  `vacuum`. **Mordiscos discretos**, copiando el molde de `applyVacuum` con exposición por ACTOR (no por
  sección): es lo que evita el bug documentado ahí mismo — una fracción continua × `dtSeconds` a cadencia de
  frame redondea a 0 y emite sangre sobre alguien inmortal.
- Causas: **no hacen falta tipos nuevos**. `CrewDamageCause` ya tiene `"cold"` y `"fire"`, ambos con su
  variante en `crew-death-effect.ts`. Ojo: `"cold"` ya lo usa el vacío — hay que asegurarse de que los dos
  caminos no se pisen y de que el mensaje diga de qué habla.
- **Umbrales propios, distintos de los de la sección.** Los de `SECTION_INTEGRITY_PARAMETERS.thermal`
  (100 / −40) son de **estructura**: un humano no aguanta 99 °C. Orden propuesto, con cada número justificado
  contra los que ya existen:

  | | frío | calor |
  |---|---|---|
  | Tripulante empieza a sufrir | **−10** | **60** (= umbral del sensor térmico y del vapor) |
  | Estructura de la sección | −40 | 100 |
  | Conductor pierde capacidad | −50 | 100 |
  | Clamp del eje | −80 | 900 |

  La gente muere antes que el casco, que es lo legible. Y **el umbral visual se ata al del tripulante**: hoy la
  escarcha aparece a −40 (umbral de estructura); pasa a −10, de modo que **ver escarcha = esta sala mata**. El
  vapor de calor ya coincide con 60 por la decisión de 14a-1, así que ese lado no se toca.

**A3. El tooltip de temperatura solo colorea el lado caliente** (`mission-tooltip.ts:270-276`): una sala a
−50 °C se muestra en gris neutro. Es el hermano exacto del punto 2 del operador y se arregla en el mismo
cambio.

### Bloque B — El cable dice lo que le pasó

Estado `overloaded` en el sistema genérico de 13h. Es un cambio pequeño porque hay **un solo embudo**
(`deriveInstanceStates` → `instanceStates`), del que ya cuelgan las tres superficies: el glifo sobre el sprite
en el plano, el panel de acciones y el tooltip.

- `InstanceStateFlag` suma `"overloaded"` (`engine/src/instance-state/instance-state.types.ts`).
- Consulta nueva `isInstanceOverloaded` en `InstanceStateQueries` + su rama en `deriveInstanceStates`, leyendo
  `Blueprint.overloadedRefs`. Cableada en `mission-runtime.ts:2348`.
- Fila en `STATE_VISUAL` (`game/src/render/component-state-visuals.ts:70`) con tinte + glifo + `noticeKey`, y
  claves i18n es/en junto a `ui.floorplan.mission.state.unpowered`.
- **Prioridad**: `resolveComponentVisual` usa `states[0]`, así que el orden de emisión en
  `deriveInstanceStates` es la subprioridad. Un cable cortado es más grave que uno sin energía → va primero.
- El test `component-state-visuals.test.ts:41-50` tiene un aserto de principio 6 que verifica que el tinte no
  colisione con ningún `COMPONENT_WEAR_TINT` ni `COMPONENT_CONDITION_TINT`: **extenderlo al nuevo estado**.

### Bloque C — La cicatriz comunica qué pasó

El efecto representa un **conductor cortado que arquea**. Tres ajustes en
`game/src/particles/effects/overloaded-conductor-effect.ts` y `game/src/render/palette.ts`:

- **Contraste**: la chispa deja de usar el tint exacto de la luz. Núcleo más claro que el glow ámbar, que es lo
  que la hace visible *dentro* de él.
- **Continuidad**: hoy `quantity: 1` cada 240 ms con vida 200 ms deja huecos sin ninguna partícula. Subir la
  frecuencia por encima de la vida garantiza que siempre haya al menos una.
- **Extensión**: `spreadRange(4)` → dispersión sobre el **footprint real de la pieza**, para que las chispas
  ocupen el objeto y no un punto en medio del glow.
- **Revisar el hallazgo previo antes de cerrar**: el comentario de `:45-47` dice que se atenuaron porque *"el
  glow tapaba el campo de luz"*. Hay que comprobar que subirlas no reintroduce eso — es literalmente el patrón
  de "mi propio fix generó el hallazgo de la ronda siguiente".

### Bloque D — Quitar el falso positivo del Cap. 1

El `cable-cobre` sembrado que revienta en el primer tick hace imposible distinguir la cadena térmica del
attrezzo. Se le quita el `scriptedOverloads` (o se le baja la carga por debajo de su capacidad) para que **deje
de dispararse solo**, conservando la pieza sembrada. La cicatriz de iluminación que validaba en 12a sigue
siendo alcanzable por el camino real: cargarlo o enfriarlo. **Decisión de contenido: se confirma con el
operador antes de tocarlo** — el criterio es que mover contenido para que encaje con el código es una señal de
alarma, y acá lo que sobra es el disparo automático, no la pieza.

---

## Lo que NO entra: la subfase del cableado con material

Se deja escrita en `nuevo-orden.md` como subfase propia, con su alcance y sus preguntas abiertas:

- `SignalEdge` declara con qué conductor está hecha (bump de `schemaVersion` del blueprint + migración).
- Tender un cable **consume** un `cable-cobre` / `cable-fibra-optica` / `cable-blindado-alto-amperaje` del
  stock, y la arista hereda la `maxCapacity` de esa pieza.
- La sobrecarga y el factor térmico se mudan del componente colocado a la **arista**, y con ellos la cicatriz
  visual (el cable dibujado se quema, no un objeto en una celda).
- Da casa a las dos viñetas del GDD 5.6 que hoy no la tienen: retardo de propagación según material del
  conductor, y sobrecarga.
- Preguntas abiertas: ¿qué pasa con las aristas de saves viejos (¿cobre por defecto?)? ¿el jugador elige el
  cable al tender, o se usa el mejor disponible? ¿un cable quemado se puede reemplazar, y a qué coste?
- Queda por decidir si absorbe también el `panel-electrico` que el caso de validación 2 nombra y que **no
  existe en el catálogo** (hoy solo vive como fixture sintético en su propio test).

---

## Archivos críticos

| Qué | Dónde |
|---|---|
| Efectos de atmósfera con `emitZone` de sección | `game/src/particles/effects/atmosphere-state-effects.ts`, creación en `game/src/scenes/floorplan-scene.ts:3320` |
| Molde de capa por celda a reusar | `floorplan-scene.ts:3968` (`redrawUnpoweredSectionScar`), `floorplan-renderer.ts:350` |
| Peligro térmico a tripulación | `engine/src/mission/mission-hazard-runtime.ts:118` (junto al vacío), `engine/src/mission/mission-hazard-parameters.ts` |
| Estado `overloaded` | `engine/src/instance-state/{instance-state.types,derive-instance-states}.ts`, `game/src/render/component-state-visuals.ts:70`, `game/src/mission/mission-runtime.ts:2348`, i18n es/en |
| Color de temperatura fría en el tooltip | `game/src/ui/widgets/mission-tooltip.ts:270` |
| Cicatriz de sobrecarga | `game/src/particles/effects/overloaded-conductor-effect.ts:48`, `game/src/render/palette.ts:471` |
| Falso positivo del Cap. 1 | `engine/src/crisis/campaign/chapter-01-primer-aviso.ts:279` |

---

## Verificación

**Tests de motor** (`/engine`, donde vive lo testeable):

- Peligro térmico: unitario por lado (calor y frío), uno que compruebe que **no** daña en el rango de
  operación, y uno a **cadencia de frame** — el molde del vacío existe precisamente porque una fracción
  continua × `dtSeconds` redondeaba a 0 y emitía daño nulo 60 veces por segundo.
- `deriveInstanceStates`: un caso con la instancia en `overloadedRefs` y otro sin ella; y un caso donde la
  pieza esté **sobrecargada y sin energía a la vez**, que ancla qué se muestra en la franja donde los dos
  predicados son ciertos.
- Coherencia de umbrales, como test: tripulante sufre **antes** que la estructura, y la estructura **antes**
  que el clamp, por los dos lados. Es lo que impide que un rebalanceo futuro deje un umbral por fuera del
  rango de otro sin que nada avise.
- Extender el aserto de no-colisión de tintes de `component-state-visuals.test.ts` al estado nuevo.

**Prueba manual** — cada paso verificado en código antes de entregarlo:

1. Partida nueva del Cap. 1, **repartir energía** con el dial (sin eso no hay carga).
2. Confirmar que **ningún cable brilla al arrancar** (Bloque D). Este paso es el que valida que lo que se vea
   después sea la cadena térmica y no el attrezzo.
3. Instalar `cable-cobre` + 4 LEDs cableados a él, y un tanque criogénico en la misma sección.
4. Verter el tanque: la **sala entera** se cubre de escarcha, no una celda; la temperatura del tooltip se pinta
   en frío; un tripulante dentro empieza a recibir mordiscos con su partícula de frío.
5. El cable se corta: glifo sobre el sprite en el plano, línea de estado en el tooltip y en el panel de
   acciones, y chispas visibles **dentro** del glow.
6. Sacar al tripulante de la sala y comprobar que **deja de sufrir** — el camino de salida, no solo el de
   entrada.

**Cierre** (pasos no opcionales de CLAUDE.md): registrar la ronda en `nuevo-orden.md` bajo 14a-2 y **abrir ahí
la subfase del cableado con material**; actualizar `MAPA_DEL_CODIGO.md`; changelog con el qué y el porqué;
commit; y volcar a `feedback-aprender-del-patron-de-playtest` los patrones nuevos de esta ronda — en particular
el de haber colgado una mecánica de una pieza sin motivo para existir, y el de cerrar una subfase dejando sin
hacer un punto de legibilidad que el propio plan prometía.
