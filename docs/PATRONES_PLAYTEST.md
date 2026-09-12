# Patrones de playtest — detalle completo

Archivo de referencia. **No se lee entero**: el checklist operativo vive en la memoria
`feedback-aprender-del-patron-de-playtest` (13 ejes). Este documento se consulta cuando un eje del
checklist no alcanza para decidir — se salta directo al patrón buscado por su número.

Contenido: los 83 patrones extraídos del feedback de playtest del operador entre las Fases 12 y 14a,
íntegros y en su redacción original, con la ronda de origen y el caso real que los produjo.

**Regla de crecimiento**: un patrón nuevo se agrega SIEMPRE acá, al final. La memoria solo se toca si
el patrón abre un **eje nuevo** que ninguno de los 13 cubre.

---

## Índice por eje → patrones

| # | Eje | Patrones |
|---|---|---|
| 1 | La UI nunca miente sobre el estado del motor | 1, 10, 41, 66, 80, 88 |
| 2 | Si no se ve, no existe: acción, confirmación, tope y estado terminal necesitan señal propia | 2, 8, 35, 51, 65, 73, 75, 79 |
| 3 | Legibilidad medida con números, no a ojo (contraste contra el asset real, layout sumado) | 3, 9, 11, 14, 48, 62 |
| 4 | Coherencia entre hermanos: arreglar uno deja rotos a los demás | 4, 16, 31, 46, 72, 78, 84, 91 |
| 5 | Interacción real: click, arrastre, capas, orden de dibujo | 5, 38, 39 |
| 6 | Infraestructura sin llamador —o evento sin consumidor— es infraestructura ausente | 12, 21, 23, 26, 32, 37, 49, 74, 82 |
| 7 | Un indicador que nunca se mueve está roto | 7, 25, 29 |
| 8 | Un dato derivado mal modelado contamina todo lo que lo agrega | 10, 17, 19, 54, 68 |
| 9 | Un test que inyecta su propia versión de la dependencia no puede ver el bug | 13, 20, 24, 44, 45, 50, 71, 87, 92 |
| 10 | Alcanzabilidad: que el motor lo simule no significa que el jugador pueda llegar | 42, 55, 59, 60, 67, 69, 81, 85, 87, 89, 90 |
| 11 | Ciclo de vida completo: lo que se reserva se libera, lo que se cancela se despinta | 6, 22, 27, 33, 70, 76, 77 |
| 12 | El contenido autorado manda; si no encaja, el código grita en vez de degradarse | 47, 52, 53, 54 |
| 13 | Proceso: verificar antes de afirmar, releer la razón vieja, preguntar el alcance | 15, 18, 28, 30, 34, 36, 40, 43, 56, 57, 58, 61, 63, 64, 83, 86 |

Los patrones 1 a 9 aparecen abajo como lista numerada (son los ejes originales de la Fase 12-13b); del
10 en adelante, cada uno lleva su propio encabezado `**Patrón N — …**`.

---


Cada vez que el operador da feedback de playtest, no tratarlo solo como una lista de bugs a corregir:
identificar **qué estaba probando y en qué se fija**, y usar ese patrón como checklist propio ANTES de cerrar
las siguientes subfases. El objetivo explícito que pidió (2026-08-05) es que aprenda de él para prevenir
errores, no solo repararlos.

**Por qué**: en la Subfase 13b hicieron falta **7 rondas** de playtest. Muchos hallazgos de las rondas 2-7 eran
predecibles desde la ronda 1 — el mismo tipo de problema aplicado a otro control. Detectar el patrón convierte
el feedback en prevención.

**Patrón observado hasta ahora** (Fase 12-13b, usarlo como checklist de auto-revisión):

1. **La UI nunca debe mentir sobre el estado del motor.** Es su tema recurrente #1. Casos reales: el HUD de
   energía en 0 sin déficit real; el slider mostrando el *pedido* (`4/4 · 100%`) cuando el motor otorgaba 2;
   la asignación intacta después de perder fuentes. Antes de cerrar: por cada dato que la UI muestra,
   preguntarse si existe un estado en que el motor lo contradiga.
2. **Todo control debe dar respuesta visible inmediata, en pausa.** Prueba manipulando controles en modo
   planificación y espera ver el efecto en el acto. Así apareció el bug de que `CoreLoopModeMachine.tick()`
   es NO-OP en `planning` y el runtime de energía nunca recalculaba.
3. **Legibilidad visual real sobre el plano** (principio 6 del CLAUDE.md, pero él lo verifica a ojo): mira si
   el elemento nuevo se LEE encima del mapa — no tapado por sombras/luces/paredes, no mezclado con el fondo,
   sin salirse de su contenedor. Revisar depth, fondo propio y ancho del contenedor al agregar UI al plano.
   **Hace pasadas de fine tuning visual** (ronda 7): padding asimétrico, texto que desborda su caja, elementos
   que no se despegan del mapa. Antes de cerrar, hacer una **auditoría de layout con números reales** (sumar
   posiciones y altos y comparar contra los bordes del contenedor), no confiar en que "se ve bien" — en la
   ronda 7 la etiqueta no estaba pegada al borde, estaba 3px FUERA, y eso solo se ve calculando. Y todo texto
   de UI se mide contra el ancho disponible, porque el largo cambia con el idioma.
4. **Coherencia entre elementos del mismo tipo**: si dos secciones/piezas están en el mismo estado, deben
   verse igual. Una que se ve distinta sin razón es señal de que algo está mal modelado (así salió el
   acoplamiento de `unpoweredSectionIds` sirviendo a dos propósitos incompatibles).
5. **Interacción real, no solo apariencia**: clickea y arrastra. Reporta click bleed-through, steppers
   incómodos, granularidad inservible (slider que salta 0→1). Verificar que un control nuevo no dispare
   además la acción de la capa de abajo, y que su rango tenga pasos útiles.
6. **Consecuencias sistémicas de romper/quitar cosas**: prueba qué pasa al desmantelar o perder un recurso, y
   espera que genere un conflicto explícito, no un cambio silencioso. Al agregar un recurso, diseñar también
   el camino de su pérdida.
7. **Un indicador que nunca se mueve está roto** (ronda 5): preguntó "¿el HUD de energía no se ve afectado
   nunca, debería?". Estaba muerto — leía un campo que un fix anterior había dejado siempre vacío. Antes de
   cerrar, por cada indicador visible: ¿existe hoy algún camino real que lo haga cambiar de valor? Si no, o se
   conecta a una señal viva o se admite explícitamente que es un stub.
8. **Una acción bloqueada tiene que distinguirse de una que no hace nada** (ronda 6): el tope del slider
   funcionaba, pero en silencio, y por eso "parecía que no funciona". Todo límite, tope o rechazo necesita su
   propia señal (visual + sonora), y con throttle si vive en un `pointermove`. Ojo con los early-return del
   tipo `if (next === value) return`: colapsan "no cambió" y "no te dejo" en el mismo camino, que es
   exactamente donde se pierde el feedback.
9. **Contraste real contra el fondo real, no contra el que uno supone** (ronda 8): "el rojo sobre gris no se
   ve bien". Era cierto y medible — el panel del cluster es el `panel_rectangle.png` del pack Kenney, un gris
   medio (~#9496a5), y el rojo del contrato (#e0483f) encima da ~1.3:1 (WCAG AA pide 4.5:1). **Que un color
   venga del contrato de la paleta no garantiza que sea legible sobre una superficie concreta.** Al poner
   texto sobre un asset, abrir el asset (el Read de imágenes sirve), estimar el contraste, y si no alcanza
   resolverlo con un fondo/badge detrás en vez de inventar un color nuevo fuera de las 4 constantes canónicas.
   Vale doble con texto chico.

**Lección sobre mis propios fixes — el patrón más caro de todos.** Ya pasó DOS veces en la misma subfase: un
fix mío generó el hallazgo de una ronda posterior.
- Ronda 5: al desacoplar `unpoweredSectionIds` en la ronda 2 para arreglar un bug real, dejé sin fuente viva
  al indicador de energía del HUD. Nadie lo notó hasta 3 rondas después.
- Ronda 8: el auto-encogido de fuente que agregué en la ronda 7 tenía piso de 8px, y el mensaje de bloqueo
  caía JUSTO en ese piso — el "letra muy chica" del operador lo causó mi propia solución de la ronda anterior.

Regla: al cerrar, revisar el propio fix como si fuera código ajeno. **¿Qué consumía lo que acabo de quitar o
desacoplar?** ¿Y **qué pasa en el caso extremo del mecanismo que acabo de agregar** (el valor tope, el piso, el
default)? Un mecanismo de fallback nuevo se prueba en su peor caso, no solo en el caso feliz que motivó
escribirlo.

**Aplicado preventivamente en 13c (2026-08-05), antes de cualquier ronda de playtest.** Correr el checklist
DURANTE la planificación, no solo al cerrar, hizo aparecer cuatro problemas que el texto de la subfase no
anticipaba — cada uno habría sido una ronda de playtest:
1. **Colisión de nombre**: el campo `condition` que pedía el diseño ya existía con otra semántica desde la
   Fase 10a. (Patrón nuevo: antes de añadir un campo, grepear su nombre — un plan escrito hace meses no sabe
   qué se construyó después.)
2. **Doble conteo del mismo dato** (patrón 4, coherencia): la corrosión ya bajaba `RE` y el desgaste iba a
   bajar la RE efectiva. Dos campos describiendo el MISMO daño es la misma clase de error que el
   acoplamiento de `unpoweredSectionIds` en 13b. Se unificó en un eje con mapeo 1:1.
3. **Fórmula replicada en 3 sitios**: `override ?? catálogo`. Centralizarla ANTES de tocar nada fue lo que
   permitió que el cambio entrara en un solo lugar. (Regla: si voy a modificar un cálculo, primero contar
   cuántas copias tiene.)
4. **La UI mentía desde antes** (patrón 1): el tooltip mostraba el RE de CATÁLOGO, no el efectivo — un bug
   preexistente que mi cambio habría agravado. Auditar los consumidores del dato que toco encuentra bugs que
   ya estaban ahí.

También se aplicó el patrón 7 ("un indicador que nunca se mueve está roto") de forma honesta: el escritor de
desgaste por corrosión NO tiene camino real en ningún capítulo autorado (ninguno tiene sustancia `CORR` viva),
así que se documentó explícitamente en el docblock del runtime en vez de dejarlo pasar como si funcionara.

**Patrón 10 — un indicador agregado hereda los errores de modelado de lo que agrega** (13c ronda 1). El
operador preguntó "instalar un tubo flexible con RE baja bajó la integridad del casco, ¿por qué? Al
desmontarlo se soluciona, ¿tiene sentido?". No tenía sentido: `aggregateHullIntegrity` tomaba el peor RE de
CUALQUIER pieza instalada, y una manguera no es casco. **El bug era de la Fase 11g, no de 13c** — 13c solo lo
volvió visible al poner al jugador a mirar el RE. Dos lecciones:
- Cuando una subfase hace que el jugador PRESTE ATENCIÓN a un dato que ya existía, hereda todos los errores de
  modelado de ese dato. Al agregar consumidores de un dato viejo, revisar de dónde sale, no solo cómo se usa.
- Sus preguntas en forma de "¿tiene sentido?" / "¿está bien?" **no son retóricas ni buscan confirmación**: son
  reportes de bug con la causa todavía sin identificar. Las dos de esta ronda eran correctas. Tratarlas como
  hipótesis a verificar en el código antes de responder, nunca como dudas a despejar con una explicación.

**Patrón 11 — el color del contrato no garantiza legibilidad, y el fondo cambia por superficie** (13c ronda 1,
refuerzo del patrón 9). El MISMO color de tag se lee perfecto en el tooltip (fondo oscuro propio) e ilegible en
el modal de instalación (gris del panel Kenney): 1.2-1.4:1 contra los 4.5:1 de WCAG AA. Al reusar un color en
una superficie nueva, medir contra ESA superficie. La solución vuelve a ser la misma que en la ronda 8 de 13b:
poner un fondo detrás, nunca inventar un color fuera de las 4 constantes canónicas.

**Patrón 12 — un tipo duplicado es un dato que nunca llega** (13c ronda 1). `TaskCompletedEvent.obtained`
repetía la forma de `TaskEffectResult["obtained"]` en vez de reusarla, así que el campo `wear` agregado en 13c
se quedaba en el motor sin llegar a `/game` **y nada fallaba al compilar**. Al agregar un campo a un tipo que
cruza el seam motor→UI, verificar que el evento que lo transporta reuse el tipo, no que lo repita.

**Aplicado preventivamente en 13d (2026-08-05), antes de playtest.** Lo que el checklist forzó a decidir en la
planificación, no después:
- Patrón 1 (la UI no miente): el badge de riesgo del panel de acciones y el hazard que dispara el motor
  comparten la MISMA función pura (`assessDismantleHazards`). Dos evaluaciones paralelas habrían sido
  exactamente el bug de "la UI dice seguro y salta el chispazo".
- Patrón 4 (coherencia / no duplicar estado): se descartó el flag `purged` por instancia — el estado seguro se
  DERIVA del mundo. Un flag persistido habría vuelto a ser un `unpoweredSectionIds` sirviendo a dos amos, y se
  habría desincronizado del dial de energía de 13b.
- Patrón 6 (consecuencias de romper cosas): es literalmente el tema de la subfase, pero además se diseñó el
  camino inverso — re-asignar energía vuelve a hacer peligrosa la pieza, con test propio.
- Patrón 7 (un indicador que nunca se mueve está roto): la condición de fuga atmosférica no tiene tarea de
  asegurado, así que se verificó que tenga un camino real de resolución (sellar/ventilar, ya existentes) en
  vez de dejar un aviso que el jugador no puede apagar.

**Patrón 13 — un test que inyecta su propia versión de una dependencia puede enmascarar la semántica real**
(13d ronda 1, la lección más cara de esa subfase). Los 3 tests de integración de 13d pasaban en VERDE con el
bug puesto en producción: el fixture inyectaba su propio `isInstancePowered` derivado de las asignaciones de
sección — o sea, implementaba la semántica que el runtime *debería* tener, no la que tiene. La suite no probaba
el runtime, probaba el doble. Reglas que salen de ahí:
- Cuando un test inyecta un doble de una dependencia REAL del sistema (no un stub de I/O), preguntarse si el
  doble está implementando el comportamiento correcto **en lugar** del componente real. Si el doble encapsula
  justo la lógica que está bajo prueba, montar el componente real.
- Los tests de predicados que dependen del catálogo deben correr contra el CATÁLOGO REAL, no contra
  definiciones sintéticas: el bug se manifestaba solo con las piezas de verdad (ninguna declara `powerDraw`).

**Patrón 10, segunda ocurrencia seguida** (13d ronda 1): otra vez un dato viejo con modelado equivocado que la
subfase nueva volvió visible. En 13c fue `aggregateHullIntegrity` (11g); en 13d fue `isInstancePowered` (13b).
Elevar a regla de planificación: **al elegir un predicado/dato existente como base de una mecánica nueva, leer
su implementación y su docblock, no su nombre.** `isInstancePowered` suena a "está energizada" y significa "su
demanda está satisfecha" — la diferencia estaba documentada en el código de 13b desde el principio.

**Patrón 14 — nunca apilar contenido de altura VARIABLE con posiciones fijas** (13d ronda 2; es el patrón 3
elevado a regla de código, no solo de revisión). Dos avisos superpuestos y un texto cortado bajo un botón, con
la misma causa: `cursorY += 24` por elemento y offsets `contentTop + 26/+30/+68/+96` escritos a mano. El alto
de un texto envuelto depende del IDIOMA y del ancho del contenedor: no es predecible con un número. Regla: si
un widget puede mostrar 0..N elementos, o texto traducible, posicionar midiendo (`text.height`) y no sumando
constantes. Corolarios que aparecieron al auditarlo con números:
- Los botones de rexUI se anclan por su CENTRO, no por su borde superior: mezclar ambas convenciones en el
  mismo flujo desplaza medio botón.
- Un alto pasado por el llamador suele ser un MÍNIMO, no un techo: si el contenido crece, el fondo debe
  crecer con él o recorta en silencio.
- Si el widget crece, todo lo que dependa de su tamaño (clamp de borde de pantalla, bounds que bloquean el
  click a la capa de abajo) tiene que leer el tamaño REAL. Un panel que sobresale con bounds viejos deja pasar
  clicks al mapa — exactamente la Obs 11 de PENDIENTES.

**Patrón 15 — el texto de una observación vieja es una hipótesis, no un diagnóstico** (triaje de
`PENDIENTES_OBSERVACIONES.md`, 2026-08-21). Al verificar en código 10 observaciones antes de asignarles fase,
**tres estaban mal descritas** y una ya estaba resuelta por decisión explícita: Obs 16 decía "los sprites se
dibujan sobre las luces" y es al revés (los `PointLight` van a depth 7, sobre paredes 5 y sprites 2); Obs 18
decía "el seleccionado queda en grises" y en realidad NINGÚN retrato sale de grises; Obs 8 decía "da un error"
y es un crash del tick (efecto invocado sin try/catch). El operador describe el SÍNTOMA que vio, correctamente
— la causa que infiere de él es una conjetura. Regla: antes de planificar sobre una observación acumulada,
verificarla en el código; la severidad y el lugar del fix cambian seguido. Corolario barato: al triar, revisar
también si rondas posteriores ya la resolvieron de refilón (deuda #22 quedó cerrada por las rondas 7 y 9 de 13e
sin que nadie volviera a marcarla).

**Criterio de priorización del operador** (mismo triaje): ante "¿los fixes de UI/UX van antes o después de
publicar la demo?" eligió **todo antes**, y ante "¿uno o dos buckets?" eligió **un solo bucket**. La demo es la
carta de presentación: no se sale a publicar con UI conocida-rota, y no se fragmenta el trabajo de pulido en
varias subfases que compiten entre sí. Asumir ese criterio al planificar cualquier cosa que toque la primera
impresión.

**Patrón 16 — al agregar un escritor a un canal ya disputado, primero contar quién más escribe ahí** (12d.5,
aplicado en planificación). El sombreado por luz iba a escribir `setTint` por frame sobre sprites que ya
tenían CUATRO escritores: el tinte por `condition` del overlay, el estado ON/OFF del LED, el resaltado del
modo de trasvase y el color de personaje. El trasvase guardaba `sprite.tintTopLeft` como "color original":
con un escritor por frame encima, habría guardado un valor ya sombreado, se habría ido oscureciendo solo y su
`setTint` lo habría borrado al frame siguiente — el resaltado INVISIBLE, sin que nada fallara al compilar. La
solución es siempre la misma forma: un registro de valor BASE y un único punto que pinta el valor final. Es el
patrón 3 de 13c ("si voy a modificar un cálculo, primero contar cuántas copias tiene") aplicado a un canal de
escritura en vez de a una fórmula.

**Patrón 17 — un dato derivado no puede tener como entrada la cosa que describe** (12d.5, encontrado
auto-revisando el propio cambio). La grilla de nivel de luz iba a usar los mismos oclusores que la capa de
sombras, "para que coincidan" (patrón 1, bien intencionado). Pero los oclusores dinámicos SON los componentes
y los tokens, o sea justo lo que se iba a tintar: el rayo luz→centro cruza la propia caja del objeto antes de
llegar, así que TODO se habría leído "en sombra" siempre — patrón 7 en su versión más cara, un indicador
muerto que además parece funcionar. Regla: al derivar una propiedad visual de una consulta geométrica, revisar
si el objeto consultado forma parte de la geometría de la consulta.

**Patrón 18 — una razón para diferir caduca; releerla antes de repetirla.** La deuda #16 residual se había
descartado en 13a con un motivo concreto y correcto EN SU MOMENTO ("exigiría extender la firma de
`EventDrivenEffect.trigger` para los ~10 efectos ya registrados"). Dos subfases después, 13e ronda 4 había
agregado `EventEffectOptions.onObjectCreated` justo para eso, y nadie volvió a mirar la nota. Al verificarla,
además, el problema resultó 15 veces más ancho que el ítem registrado: solo UN efecto propagaba el hook. Es el
patrón 15 ("el texto de una observación vieja es una hipótesis") aplicado a mis propias decisiones de alcance,
no solo a los reportes del operador.

**Medir en vez de estimar cuando el riesgo es de perf** (12d.5). El plan anotaba "medir si el frame time sube
de 16 ms" y era fácil cerrarlo con una estimación a ojo. Un benchmark descartable con las dimensiones REALES
del mapa (40×22, 148 aristas, 21 luces) tardó dos minutos y dio 0.49 ms — número que además sirvió para
decidir no complicar el cache. Vale también al revés: leer los datos autorados reales destapó que las 21 luces
tienen `intensity` por debajo del piso de aclarado, o sea un dial que hoy no mueve nada (patrón 7 en los
DATOS, no en el código). Registrado como pendiente en vez de "arreglado" por mi cuenta: son datos del operador.

**Patrón 19 — copiar una fórmula de un módulo vecino arrastra su ESCALA, y la escala no viaja en el tipo**
(12d.6, ronda 1 de playtest de 12d.5; costó una ronda entera). `light-grid.ts` copió
`clearAlpha = max(0.3, min(1, light.intensity))` de la capa de sombras para responder "cuánta luz recibe este
sprite". Las dos cosas son `number` en 0..1 y compilan igual, pero `PointLight.intensity` es **brillo de glow
aditivo** (en este proyecto 0.01-0.35, porque a 0.3 una luz ya quema tiles a blanco) y el 0.3 es **opacidad de
oscurecido**. Resultado: todas las luces aportaban lo mismo y el contraste era del 15%, o sea invisible — un
efecto que existe, compila, tiene tests verdes y no se ve. Reglas:
- Al reusar una expresión de otro módulo, preguntar **qué mide** cada factor, no si el tipo encaja. Dos
  `number` en el mismo rango pueden ser magnitudes incomparables.
- Corolario que ya había fallado: **yo interpreté los datos del operador como el error** (registré "las luces
  tienen intensity demasiado baja, es un dial muerto") cuando el error era mi lectura de esa escala. Antes de
  registrar que un dato autorado está mal, verificar que el consumidor lo esté leyendo en su escala.
- Un efecto visual nuevo necesita una verificación **numérica de contraste**, no solo tests de que "se
  calcula": medir el valor con luz y sin luz y ver si la diferencia es perceptible. Medirlo con el MAPA REAL
  destapó además que solo el 20% del suelo recibe luz — información que ninguna cantidad de tests unitarios
  con grillas sintéticas iba a dar.

**Patrón 20 — una receta de prueba que no ejecuté es una receta sin verificar.** En el cierre de 12d.5
entregué "provocá una combustión en el Cap.1" como paso de smoke. El operador respondió "no tengo forma de
provocar combustión", y tenía razón: `scriptedReactions` no tiene datos en NINGÚN capítulo, así que ese paso
era imposible. Antes de entregar los pasos de prueba manual ([[feedback_pasos_de_prueba_manual_por_subfase]]),
verificar en el código que **existe un camino real** para cada paso — es el patrón 7 ("un indicador que nunca
se mueve está roto") aplicado a mis propias instrucciones. Cuando el camino no existe, la salida honesta es
construir la herramienta (acá: una tecla de dev que dispara el fenómeno por el camino de producción) y
registrar el hueco de contenido, no escribir un paso que suena plausible.

**Corolario de alcance de una herramienta de verificación** (mismo caso): la galería de partículas ya existía
y parecía cubrir esto, pero tiene UNA sola cámara — el bug de doble-cámara que había que verificar no se
reproduce ahí ni estando presente. Una herramienta de prueba solo sirve si reproduce las condiciones del bug;
si no, da un falso verde.

**Patrón 21 — un helper a medio escribir garantiza copias divergentes** (12d.7). `dynamic-light.ts` declaraba
en su docblock que generalizaba el patrón de luz "tanto para bursts como para luz persistente", pero solo se
había escrito la mitad persistente. Los dos bursts del proyecto copiaron el patrón a mano y AMBOS quedaron con
el mismo agujero (destruir la luz sin desvanecerla). El operador vio uno; el otro estaba igual de roto desde
12a. Reglas:
- Cuando un módulo promete dos casos de uso y solo implementa uno, el otro no queda "pendiente": queda
  duplicado a mano en cada llamador, con una copia distinta del bug en cada uno.
- Al arreglar un fenómeno visual, **buscar los hermanos por FORMA de código** (acá:
  `grep "delayedCall.*destroy()"`), no solo por el síntoma reportado. Es el patrón 4 aplicado a la
  implementación en vez de a lo que se ve en pantalla.

**Patrón 22 — un ciclo de vida de animación se encadena por eventos, no por aritmética de tiempos** (12d.7).
El bug era una fase que faltaba (parpadeo → *nada* → destroy) más dos relojes independientes: un tween con
`repeat` finito y un `delayedCall` con la duración calculada a mano. Dos tweens sobre la misma propiedad se
pelean si se solapan, y un tiempo calculado a mano se desincroniza en cuanto alguien toca una duración.
Encadenar con `onComplete` hace que las fases no puedan solaparse por construcción. Corolario al revisar un
efecto: preguntarse **cómo TERMINA**, no solo cómo empieza — el final es lo que nadie mira y lo que el
operador nota.

**Corolario de la ronda anterior, confirmado:** la tecla de dev que agregué en 12d.6 para poder provocar la
combustión es lo que permitió al operador VER este bug. Una herramienta de verificación paga en la ronda
siguiente, no en la que se construye.

**Patrón 23 — un umbral que coincide con un clamp existente es un escritor muerto** (13f, encontrado
auto-revisando el propio cambio). La regla de daño por descompresión usaba `onsetKpa: 40` "para que coincida con
`PRESSURE_SINK_FLOOR_KPA`", que sonaba elegante. Pero el piso es exactamente donde la presión SE DETIENE: una
fuga baja hasta 40 y se queda ahí, o sea justo en el umbral, o sea daño 0 para siempre. El único escenario de
fuga que existe (la junta rota del Cap.1) habría dejado ese escritor sin ningún camino real. Es el patrón 7 en
su versión más traicionera, porque el número no está "mal" — está mal EN RELACIÓN a otro número del sistema.
Regla: al elegir un umbral, buscar los clamps, pisos y techos que ya actúan sobre esa misma magnitud y
comprobar que el rango entre ellos y el umbral no sea vacío.

**Patrón 24 — antes de dar un fenómeno por verificable, revisar QUÉ hace la herramienta de verificación, no
cómo se llama** (13f). La tecla de dev F parecía cubrir "provocá una combustión", pero dispara
`fireEventEffect`/`fireEventSound` directamente: solo el efecto VISUAL, sin pasar por el motor. Para una
subfase cuyo objeto es la consecuencia mecánica (daño, colapso, brecha) eso no verifica nada. Hizo falta una
tecla nueva (H) que emite por el emisor real del motor. Es el patrón 20 con un giro: no basta con que exista
una herramienta, tiene que ejercitar el CAMINO que la subfase construyó. Corolario del corolario de 12d.5
sobre la galería de partículas: la misma herramienta puede servir para una subfase y ser un falso verde para
la siguiente.

**Aplicado preventivamente en 13f (2026-08-24), antes de playtest.** Lo que el checklist forzó a decidir en la
planificación:
- Patrón 18 (una razón para diferir caduca): de los 6 huecos de motor que el texto de 13f listaba, el #5 ya lo
  había resuelto 13d (`composePressureSinks`). Verificarlos uno a uno antes de planificar ahorró rehacerlo.
- Patrón 16 (contar quién más escribe en el canal): el daño a la maquinaria del colapso reusa `worsenWear` en
  vez de abrir un segundo eje de daño por instancia — que habría sido exactamente el doble conteo que 13c ya
  tuvo que deshacer.
- Patrón 1 (la UI no miente): el HUD, la capa estructural del plano y el motor leen ahora la MISMA fracción;
  y `aggregateHullIntegrity` ya ni siquiera ACEPTA componentes por firma, así que el bug original es imposible
  por construcción, no solo corregido.
- Patrón 7, honesto: de los cuatro escritores de daño, la corrosión no tiene camino jugable porque ningún
  capítulo autora una sustancia `CORR` viva. Se documentó en el docblock y como pendiente, en vez de dejarlo
  pasar como si funcionara.

**Patrón 25 — una tasa continua × `dtSeconds` que pasa por `Math.round` es cero** (13f ronda 1). El daño por
vacío aplicaba `maxHp × 0.1 × dtSeconds`. Con ticks de 1 s en los tests daba 10 y todo pasaba; con el core loop
real corriendo por FRAME (`coreLoop.tick(delta/1000)`, ~0.016 s) daba `Math.round(0.16)` = **0**. Cero daño y,
peor, un evento de daño por frame para siempre. Dos lecciones: (a) todo test de una regla continua tiene que
correr al menos una vez a cadencia de frame, no solo a 1 tick = 1 segundo — la cadencia del test era el doble
que ocultaba el bug (patrón 13 aplicado al TIEMPO, no a los colaboradores); (b) si un fenómeno tiene que
producir un efecto VISIBLE y contable, conviene modelarlo como evento discreto con su propio acumulador, no
como un goteo que depende de la resolución del tick.

**Patrón 26 — un efecto que no cambió nada no debe emitir evento, y el guard va en el punto único de
resolución** (13f ronda 1). El síntoma que el operador vio no fue "no pierde vida" sino "veo sangre saltándole
aunque no recibe daño": el evento cosmético MINTIÓ sobre lo que estaba pasando. Al poner el guard en
`applyHpLoss` (y no en el llamador que tenía el bug) aparecieron dos cosas más: un caso real de crisis del
Cap.2 donde el castigo periódico ya no significaba nada, y la garantía de que ninguna fuente futura pueda
repetirlo. Regla: cuando un bug sale de un llamador de un punto único de resolución, preguntarse si el
invariante pertenece al punto único — casi siempre sí, y ahí cubre a los que todavía no existen.

**Patrón 27 — un tween relativo sobre el valor actual es una bomba de tiempo; el valor BASE se registra**
(13f ronda 1). `scaleX: dot.scaleX * 1.4` parecía lo correcto (el sprite no está a escala 1) y con un evento
aislado funciona. Con una ráfaga, cada tween solapado toma como base un valor ya inflado por el anterior y la
escala crece sin techo hasta que el sprite desaparece de pantalla; peor, `hopMove` capturaba `target.scaleX` al
empezar el salto y CRISTALIZABA la corrupción. Es el patrón 16 (contar quién escribe en el canal) y el patrón
22 (dos tweens sobre la misma propiedad pelean) en su forma más cara. Regla: cualquier propiedad que más de una
animación deforme necesita un registro de su valor en reposo; todos los escritores parten de ahí, en absoluto,
con `killTweensOf` previo.

**Patrón 28 — el bug que el operador reporta puede ser el más viejo del repo** (13f ronda 1). Dos de los cinco
reportes ("los indicadores vuelven al 100%", "los componentes desaparecen") no eran de 13f: "Guardar y salir"
nunca había persistido el estado de misión, y "Continuar" cargaba `saves[0]` de un `readdir` sin ordenar. Solo
se hicieron visibles porque 13f introdujo la PRIMERA cicatriz que el jugador esperaba encontrar al volver. Dos
consecuencias prácticas: (a) antes de asumir que un reporte es de la subfase en curso, verificar en el código
quién escribe ese estado — el diagnóstico correcto cambió por completo el trabajo; (b) una subfase que
introduce persistencia nueva es la primera prueba real del camino de guardado, aunque no lo haya tocado.

**Patrón 29 — corregir un indicador que grita de más puede dejarlo mudo** (13f ronda 1). "Peor sección gana"
ponía toda la nave al 17% por una sala reventada. La media ponderada por tamaño, que es la corrección
principiada, la movía un 7% — o sea de un extremo al otro. Hizo falta medir contra el MAPA REAL (335 celdas en
11 secciones) antes de dar el fix por bueno, y agregar un peso extra a las secciones brechadas. Regla: al
cambiar una fórmula de agregación, calcular el resultado con los datos reales del contenido, no solo con el
caso de test — un fix que satisface el reporte y rompe el patrón 7 no es un fix.

**Patrón 30 — "se resolverá por los medios que ya existan" es una apuesta; hay que ir a contarlos** (13f ronda
2). 13f decidió a propósito que sellar una brecha solo DETUVIERA la fuga, razonando que la sección "se volvería
a presurizar por los medios que ya existan". No existía ninguno: `diffuse()` reparte fracciones de gas y jamás
toca `pressureKpa`. Resultado: el jugador hacía todo bien —encontraba la plancha, la instalaba en la celda
correcta— y la sala quedaba a 0 kPa y letal para siempre. Una consecuencia permanente (principio 5) es que
reparar CUESTE, no que reparar no sirva. Regla: cuando una decisión de diseño se apoya en que otra parte del
sistema haga algo, abrir esa otra parte y verificar que lo hace. Es el patrón 18 (una razón para diferir caduca)
aplicado hacia el futuro en vez de hacia el pasado.

**Patrón 31 — arreglar un indicador deja a sus hermanos con el mismo bug** (13f ronda 2). La ronda 1 corrigió
"peor sección gana" en la integridad de casco porque una sala reventada hundía toda la nave. La ronda 2 trajo
exactamente la misma queja... sobre la fila de al lado, la de atmósfera, que compartía el defecto y no se
revisó. Regla: al corregir el criterio de agregación de un indicador, mirar de inmediato los que se calculan
igual y decidir explícitamente para cada uno si aplica. Y decidir de verdad: acá el tóxico se quedó con
peor-sección-gana porque un gas SÍ se difunde al resto de la nave — no todo lo que comparte la fórmula comparte
la razón.

**Patrón 32 — un evento de dominio sin consumidor mecánico es una feature que no existe** (13f ronda 2). El
permadeath del GDD 6.1 llevaba desde la Fase 9 emitiendo `crew-death`, con partículas, bark y reacción del
retrato. Todo eso era presentación: el scheduler no modelaba HP, la UI no filtraba y el save devolvía al muerto
entero a la misión siguiente. Pasó desapercibido tanto tiempo porque hasta 13f no había ningún camino jugable
frecuente para morir. Regla: cuando una subfase abre un camino nuevo a un evento que ya existía, revisar qué
hace de verdad ese evento aguas abajo — "ya está implementado" puede significar solo "ya se ve".

**Patrón 33 — el fix correcto puede abrir un agujero nuevo; buscarlo antes de que lo encuentre el operador**
(13f ronda 2). Implementar el permadeath bien hizo posible algo que antes no lo era: una campaña sin nadie a
quien desplegar, o sea un mapa jugable donde no se puede hacer nada. No salió de ningún reporte, salió de
preguntarse "¿qué estado nuevo hace alcanzable este cambio?". Se mitigó (fin de misión visible en vez de
bloqueo silencioso) y se registró lo que falta. Regla: al cerrar un cambio que quita algo del mundo de forma
permanente, recorrer el caso límite de haberlo quitado TODO.

**Patrón 34 — cruzar los números del propio juego antes de dar por jugable una mecánica** (13f ronda 3). El
vacío mataba en 8 s; instalar tarda 8-9,6 s y desmontar 12-14,4, y el daño empieza al ENTRAR en la sección, no
al llegar a la celda. O sea que la única solución que el diseño ofrecía no cabía en la ventana que el diseño
daba — y eso se sabía sin jugar, con dos tablas de constantes que ya estaban en el repo
(`TASK_BASE_DURATION_SECONDS` y `HAZARD_PARAMETERS`). Regla: cuando una mecánica pone un reloj sobre una
acción, sumar la duración REAL de esa acción (incluidos multiplicadores y el viaje) y comprobar que entra, con
margen para el error del jugador. Un temporizador que no permite la solución no es difícil, está roto.

**Patrón 35 — un preview que se dibuja debajo de un modal no existe** (13f ronda 3). El operador pidió "que el
resaltado tenga la forma final de la pieza"... y ya la tenía, desde 11h, actualizándose al cambiar de opción.
Lo que no tenía era visibilidad: el selector es un modal de 720×480 con fondo negro al 55% sobre toda la
pantalla, así que el preview se pintaba tapado y atenuado. Antes de dar por buena una función de feedback
visual, hay que mirar QUÉ HAY ENCIMA de ella en el orden de dibujo. Corolario: cuando el operador pide algo que
ya está implementado, la respuesta correcta casi nunca es "ya existe" — es preguntarse por qué no lo ve.

**Patrón 36 — "el jugador se equivocó" merece verificarse antes de aceptarlo** (13f ronda 3). Al reportarle que
la plancha podía terminar al lado de la brecha, el operador respondió razonablemente "si el jugador se equivoca
en dónde pone la pieza, es problema de él, ¿o no?". No lo era: el jugador NO elegía la posición —
`findFittingInstallPlacement` recorría toda la sección y reubicaba la pieza sola. Verificar el mecanismo exacto
antes de contestar convirtió una discusión sobre responsabilidad del jugador en un rediseño del flujo. Vale en
las dos direcciones: yo tampoco había visto que el preview ya existía.

**Patrón 37 — al reemplazar un flujo, borrar la función que lo sostenía** (13f ronda 3). `findFittingInstallPlacement`
existía solo para perdonar apuntar mal cuando no se podía ver el footprint. Con el fantasma en vivo dejó de
hacer falta, y su comportamiento —reubicar en silencio— es exactamente lo contrario de la decisión nueva ("lo
que ves es lo que se instala"). Dejarla exportada y testeada la habría convertido en una invitación a
reintroducir el bug. Regla: una función que sobrevive al flujo para el que se escribió es deuda con aspecto de
utilidad.

**Patrón 38 — un botón que dispara en `pointerdown` y cierra su propia capa le regala el click al mapa** (13f
ronda 4). Phaser despacha los handlers de los GameObjects ANTES del `pointerdown` de la escena: para cuando la
escena mira "¿hay un modal abierto?", el botón ya lo cerró, así que arma el arrastre y el `pointerup` del MISMO
click cae sobre la celda que había debajo del botón. El síntoma que reportó el operador —"el tripulante va a
instalar sin dejarme elegir dónde"— era el peor caso de una familia: el briefing, el panel de objetivos y el
cancelar del selector tenían la misma forma con síntoma más leve. Dos reglas: (a) al añadir una capa de UI que
flota SOBRE el mapa, comprobar qué pasa con el click que la cierra, no solo con el que la abre; (b) el guard se
ata a la PULSACIÓN concreta (`pointer.downTime`), no a una bandera de "ignorá el próximo click" — una bandera
depende del orden de despacho y se queda pegada si el click nunca se suelta.

**Patrón 39 — quitar la única acción de un panel lo convierte en estorbo, y hay que ir a cerrarlo** (13f ronda
4). La ronda 3 le quitó "Instalar aquí" al panel de celda vacía y lo dejó "como ficha informativa". Una ronda
después el operador reportó exactamente eso: "no cumple objetivo ninguno". Un panel flotante que tapa el mapa
se gana el sitio con una ACCIÓN; sin ella, lo informativo pertenece al hover, que no tapa nada. Regla: cuando un
cambio deja un contenedor de UI sin su razón de existir, borrarlo en el mismo cambio en vez de degradarlo a
informativo — es el patrón 37 (borrar la función que sostenía el flujo) aplicado a la UI.

**Patrón 40 — "es correcto" y "se entiende" son dos preguntas distintas, y el operador puede elegir la
segunda** (13f ronda 4). El mordisco que caía DESPUÉS de tapar la brecha era física correcta: la sala sigue a 0
kPa y tarda ~10 s en cruzar el umbral de vacío recuperando a 2 kPa/s. Ante las tres opciones (cambiar la regla,
acelerar la recuperación, o dejarlo y explicarlo) el operador eligió explicarlo. Dos consecuencias prácticas:
(a) al diagnosticar un reporte, separar "¿el modelo está mal?" de "¿el jugador puede ver por qué pasa esto?" y
ofrecer las dos salidas — la segunda suele ser más barata y respeta el diseño ya decidido; (b) hacer legible un
estado a menudo exige exponer un dato que el motor ya calcula y tira (acá el SIGNO del sumidero de presión, que
se consumía en el bucle del tick), no inventar estado nuevo.

**Patrón 41 — un dato vivo dentro de un widget cacheado se congela** (13f ronda 4). El tooltip solo se
reconstruía al cambiar de CELDA, lo cual bastaba mientras su contenido fuera estático (nombre, tags). Al meterle
la presión de la sección, la clave de cache pasó a ser insuficiente justo en el caso que motivó el cambio: mirar
fijo una sala represurizándose. Regla: al añadir estado vivo a un widget existente, revisar su clave de redibujo
y su disparador (acá hacían falta las dos cosas: clave por contenido y refresco desde `update()`, porque solo se
redibujaba en `pointermove`). Hermano del patrón 1: un número congelado es la UI mintiendo, aunque el valor
haya sido cierto hace un segundo.

**Patrón 42 — un sistema nuevo que CONSUME energía hay que probarlo en una partida donde la energía no esté
repartida** (13h ronda 2). `emptyPowerState()` deja `sectionAllocations: []`, así que en una partida nueva
TODA sección tiene 0 unidades otorgadas. Eso era inocuo mientras nada crítico declarara `powerDraw` — y la
puerta fue la primera pieza cuyo apagado bloquea el PASO, o sea que convierte "no asignaste energía" en "la
nave entera es inalcanzable". El save del operador ya tenía energía repartida, así que el síntoma no aparecía
igual para los dos. Reglas: (a) al darle `powerDraw` a algo, correr el caso de partida NUEVA, que es el
default y el que nadie prueba; (b) si el apagado de una pieza bloquea una acción del jugador, el aviso tiene
que nombrar la causa — el default silencioso convierte un problema de gestión en un bug aparente.

**Patrón 43 — cada pieza probada sola no prueba la cadena, y el pegamento es donde están los bugs** (13h ronda
2, la lección más cara de la subfase). La cadena fotorreceptor→cable→evaluador→puerta estaba cortada en TRES
lugares a la vez y la suite entera en verde: `SignalDoorRule` se probaba con `signalOutput` puesto a mano,
`motionAwareEmitterInputs` con un grafo sin puertas, y el pegamento —closures dentro de `MissionRuntime`— sin
ningún test. Es el patrón 13 (un doble que implementa la semántica en vez de ejercitarla) elevado: acá el
doble era *el valor literal* del borde entre dos sistemas. Reglas:
- Cuando una subfase conecta dos subsistemas que ya existían, el test que hace falta es el que los recorre
  JUNTOS. Los unitarios de cada lado ya pasaban antes del cambio y van a seguir pasando después.
- **Un closure dentro de una clase de `/game` que decide una regla de dominio es código sin test por
  construcción.** Si tiene una regla adentro, extraerlo a `/engine` como función pura — acá `doorSignalOutput`
  tenía el bug desde la ronda A y no había dónde escribir el test que lo atrapara.

**Patrón 44 — una validación que no valida lo que su nombre sugiere deja pasar no-ops silenciosos** (13h ronda
2). `validateSignalGraphIntegrity` suena a "el grafo es válido" y solo comprueba ids duplicados y extremos
colgantes: nada de ROLES. Así, cablear puerta→sensor se aceptaba, encolaba la tarea, el tripulante caminaba
hasta allá, y la arista quedaba escrita al revés sin que nadie volviera a leerla nunca. Un no-op perfecto:
cuesta tiempo de juego y no falla en ningún lado. Es el patrón 10 (leer la implementación, no el nombre)
aplicado a los validadores. Corolario: cuando el ORDEN en que el jugador clickea determina un dato del modelo,
casi siempre es un bug — el dato tiene que derivarse de los roles, no de la interacción.

**Patrón 45 — al cambiar una constante de balance, buscar los tests que la tienen escrita a mano** (13h ronda
2). Bajar `ACT.cadence` de 3 s a 1.5 s rompió un test que decía "a mitad del ciclo de 3 s" con `run(1.5)`
hardcodeado: con la cadencia nueva medía el ciclo YA TERMINADO. Se recalibró derivando la mitad de
`transitionSecondsOf` en vez de aflojar el aserto. Regla: un test que ancla un número derivado de una
constante de balance debe LEER la constante, no copiar su valor — si no, el día que el balance cambia el test
no protege nada y encima hay que interpretarlo.

**Patrón 46 — dos predicados correctos sobre el mismo hecho terminan en la misma pantalla, y ahí se leen como
un bug** (13h ronda 3). El operador reportó un popup que decía "Pieza energizada" y "Sin energía" a la vez.
Los dos eran ciertos: uno pregunta "¿hay corriente en la sección?" y el otro "¿su demanda está satisfecha?",
y discrepan en la franja `0 < otorgado < powerDraw`. Cada predicado tenía su docblock explicando por qué es
distinto del otro; lo que nadie escribió nunca fue **qué ve el jugador cuando los dos son ciertos**. Reglas:
- Al agregar un segundo predicado sobre un concepto que ya tiene uno, buscar la franja donde discrepan y
  decidir explícitamente qué se muestra ahí. Y **anclarla con un test**: sin él, un futuro "arreglo" de uno
  de los dos rompe el otro en silencio.
- La salida no siempre es suprimir un mensaje. Acá las dos verdades le importan al jugador (una pieza que no
  arranca igual es peligrosa de desmontar), así que lo que cambió fue que cada frase nombre **de qué habla**
  —la sección o la pieza— en vez de sonar como opuestos.

**Patrón 47 — cuando el operador pide "hacelo genérico", el sistema nuevo tiene que REEMPLAZAR a los que ya
decidían, no sumarse** (13h ronda 3). El pedido de tintado por estado llegó sobre un canal que ya tenía dos
escritores (el `condition`/`wear` del renderer, con su prioridad escrita a mano, y el sombreado por luz).
Agregar un tercero habría hecho oscilar la base según quién escribió último — el patrón 16 otra vez. Lo que
volvió genérico al sistema no fue empezar con muchos estados (arrancó con UNO), sino absorber la prioridad
que ya existía para que quedara una sola tabla. Regla: antes de escribir el sistema genérico, contar quién
decide hoy eso mismo y hacerlo pasar por la tabla nueva en el mismo cambio.

**Patrón 48 — un tinte de estado se apaga justo donde más hace falta** (13h ronda 3, anticipado en
planificación). El sombreado por luz multiplica todo tinte por el nivel de luz de la celda, y una pieza sin
energía vive en una sección con poca o ninguna energía asignada — o sea con poca luz. El estado que más hay
que mostrar habría sido el menos visible: patrón 17 (un dato derivado cuya entrada es la cosa que describe)
en versión visual. La salida fue un glifo a brillo pleno, deliberadamente FUERA del recorrido del sombreado.
Regla: al codificar un estado con color, preguntar si el estado correlaciona con las condiciones que
degradan ese color.

**Aplicado preventivamente en 13g (2026-08-29), antes de playtest.** Lo que el checklist forzó a decidir en
la planificación, y los cuatro problemas que destapó y el texto de la subfase no anticipaba:
- **Patrón 42 (probar la partida NUEVA), el hallazgo más caro y el que habría invalidado la subfase entera**:
  el operador eligió subir la oferta de energía de 10 a 38 unidades... y eso solo no habría encendido NADA,
  porque `emptyPowerState()` deja `sectionAllocations: []` y toda sección de una campaña nueva arranca en 0.
  Regla nueva que sale de acá: **cuando una decisión es "subir X", verificar que X sea lo que efectivamente
  limita**, no lo que suena a que limita. El techo real era el reparto, no el presupuesto.
- **Patrón 4 (un dato sirviendo a dos amos), aplicado al sitio del fix**: la tentación era auto-rellenar el
  reparto en `MissionPowerRuntime` (self-healing, cubre saves viejos). Está mal: `setSectionPowerUnits` BORRA
  la entrada al llegar a 0, así que "nunca se asignó" y "el jugador puso todo en 0" son el mismo dato, y el
  runtime se habría peleado con una decisión deliberada del jugador. Fue al save factory. Regla: antes de
  poner un default en un runtime, preguntar si el estado vacío es distinguible de una elección del usuario.
- **Patrón 18 (una razón para diferir caduca)**: el fail-open de `mission-power-runtime` se justificaba con
  "sin `powerDraw`, no gatear" — razón que esta misma subfase invalidaba. Se conservó el comportamiento pero
  se reescribió el porqué. Igual con tres comentarios que citaban `POWER_EXEMPT_TASK_TYPES`, borrado en 13e.
- **Patrón 31 (arreglar un indicador deja a sus hermanos igual)**: al volver tinteable el placeholder de
  componente aparecieron DOS hermanos con el mismo defecto (el de la Pantalla LCD) y un consumidor que asumía
  lo contrario (`spriteCopyAboveDim` daba por hecho alpha 1). Buscar los hermanos ANTES de cerrar, no después.
- **Patrones 13 y 43 (el doble que implementa la semántica bajo prueba)**: el test de integración de la cadena
  de señal monta el `MissionPowerRuntime` REAL en vez de inyectar `isInstancePowered`, precisamente porque el
  bug que 13g cierra es que ese predicado devolvía `true` para todo. Un doble correcto habría estado en verde.
- **Patrón 10 (leer la implementación, no el nombre)**: antes de generalizar el trato de `doorSignalOutput`
  ("sin energía ⇒ `undefined`, no `false`") se fue a mirar a los otros dos lectores de `outputOf` sobre su
  propia instancia. Ninguno lo necesitaba: en la bobina y el LED, `false` significa correctamente "apagado" y
  no una orden. Verificado, no asumido ni copiado por analogía.

**Patrón 49 — un evento sin escritor y un evento sin consumidor son el mismo bug, y hay que buscarlos en las
dos direcciones** (13g, extensión del patrón 32). 13f encontró `crew-death` emitido sin que nadie lo consumiera
mecánicamente. 13g encontró el reverso: `failed`/`task-failed` llevaban desde la Fase 6 con consumidor completo
en `/game` (notificación, bark, retrato) y **ningún escritor**, o sea una rama de UI probada y muerta. Los dos
casos pasan desapercibidos por la misma razón: la mitad que existe se ve y da la impresión de que la feature
está. Regla: al tocar un estado o evento del motor, grepear por separado **quién lo escribe** y **quién lo
lee**, y desconfiar si alguno de los dos conjuntos está vacío.

**Patrón 50 — un test que inyecta una base distinta a la de producción no puede ver el bug** (13g ronda 1; es
el patrón 13 en su forma más barata de cometer y más cara de detectar, TERCERA ocurrencia). Los dos tests de
integración de la cadena de señal inyectaban `() => new Map()` como fuente de entradas, o sea base `false`,
mientras producción compone sobre `allEmittersActive`, base `true`. Cualquier emisor que el resolvedor no
supiera resolver salía apagado en el test y encendido en el juego: el bug del operador ("el LED está siempre
encendido") era **invisible por construcción**, con la suite entera en verde. Reglas:
- Cuando un sistema se construye por COMPOSICIÓN de envoltorios, el test tiene que montar la misma pila que
  producción, empezando por la misma base. Cambiar la base por "algo neutro" cambia el valor por defecto de
  todo lo que el envoltorio no toca — que es justo donde viven los agujeros de cobertura.
- Un envoltorio parcial con `continue` (fail-open) tiene un caso de prueba obligatorio: **la pieza que NO
  sabe resolver**, con la base real puesta. Sin eso solo se está probando el camino feliz.
- Corolario ya conocido pero reincidente: los tests de un predicado que depende del catálogo deben usar el
  catálogo REAL. Acá el bug era que la búsqueda iba contra `ATOMIC_COMPONENT_CATALOG` y ningún sensor
  compuesto se resolvía; con fixtures sintéticos no aparece nunca.

**Patrón 51 — "siempre encendido" y "roto" se ven igual, y el jugador reporta lo segundo** (13g ronda 1). El
operador describió un LED que no responde. No había ningún fallo en el gating ni en el evaluador: el sensor
detectaba de verdad al tripulante que acababa de tenderle el cable, porque `queueConnect` lo deja parado al
lado y el radio era de 10 celdas Manhattan en un mapa de 40×22. Dos lecciones:
- **Una constante de alcance/umbral hay que cruzarla contra cómo se JUEGA, no solo contra su rango teórico.**
  El mismo cruce destapó que el puzzle del Cap.2 (dos sensores + compuerta AND) se resolvía solo, porque con
  radio 10 el solape de sus coberturas era total. Un puzzle que está permanentemente resuelto no falla en
  ningún test.
- Cuando la respuesta es "el modelo está bien, no se entiende" (patrón 40), la salida es **exponer el dato que
  el motor ya calcula**: acá dibujar el área de alcance, con la MISMA función que decide el disparo. Una
  fórmula propia en la capa visual habría sido un área pintada que no coincide con lo que el sensor detecta.

**Patrón 52 — cuando el operador edita CONTENIDO, el código tiene que gritar, no degradarse** (13g ronda 2).
Editó el mapa en Tiled y una puerta quedó en una celda que tocaba tres secciones. El motor descarta esos
cruces a propósito, así que la puerta cargaba como pieza decorativa: no bloqueaba, no abría, no cerraba, y
**nada fallaba en ningún lado**. El validador de plano incluso la daba por buena, porque sus tres chequeos
(secciones existen / son adyacentes / la celda pertenece a una) son todos más DÉBILES que la condición que el
runtime exige para dar la puerta de alta. Reglas:
- Cuando el runtime tiene una precondición para activar algo (`thresholdSectionsAt`, `isDoorCapable`, resolver
  una definición), **esa misma precondición tiene que estar en el validador de los datos autorados**. Si no,
  el editor de contenido puede producir objetos que el motor ignora en silencio, y el síntoma aparece jugando.
- El aviso va **al parsear**, no al usarse: reventar al cargar el mapa con la causa escrita cuesta un
  playtest menos que descubrirlo cruzando una puerta.
- Es el patrón 44 ("un validador que no valida lo que su nombre sugiere") aplicado a los DATOS de contenido en
  vez de al grafo, y viene con su gemelo en los tests: había un test de puertas que pasaba con el bug puesto
  porque comprobaba la propiedad débil. Al escribir un test sobre contenido autorado, preguntarse si comprueba
  lo que hace FUNCIONAR la cosa o solo algo que la acompaña.

**Corolario sobre tests que dependen del contenido** (misma ronda, patrón 45 confirmado): otro test exigía que
el mapa tuviera al menos un vano de `span > 1`, y se cayó en cuanto el operador editó los suyos a 1 a
propósito. Un test que se rompe porque el CONTENIDO cambió legítimamente no estaba probando el mapeo, estaba
probando el mapa. Se recalibró derivando lo esperado del dato de cada puerta, y cubriendo la propiedad que
importa (vano ancho ⇒ una sola instancia) con una semilla sintética que no depende de lo que el mapa autore.

**Patrón 53 — mover el CONTENIDO para que encaje con el código es una señal de alarma, no una solución**
(13g ronda 3; el error más caro que cometí en estas rondas, y lo cometí yo, no lo heredé). La puerta del
puente no funcionaba y "arreglé" el mapa moviéndola una celda. El operador lo rechazó de inmediato: *"esa
celda no es correcta, la puerta estaba en la boca del pasillo y no tiene sentido ahí"*. Tenía razón — había
puesto la puerta donde el DISEÑO la pide, y yo moví el diseño para que entrara en el modelo. Peor: agregué un
validador que declaraba inválido ese mapa correcto, o sea que blindé la causa en vez de arreglarla.
- Cuando un dato autorado "no es válido" para el motor, la primera pregunta es **si el motor tiene razón**.
  Un mapa que el diseñador considera correcto y el código rechaza suele significar que al código le falta
  información, no que al mapa le sobre.
- **Un validador nuevo que prohíbe contenido que el operador quiere autorar está resolviendo el problema al
  revés.** Antes de escribirlo, preguntarse: ¿esto detecta un error real, o legaliza una limitación mía?
- El operador es la autoridad de diseño sobre el contenido. Ante "esto no funciona en X", el arreglo por
  defecto va en el código; tocar el contenido necesita justificación explícita y su acuerdo.

**Patrón 54 — un dato autorado que el motor vuelve a inferir es un dato que se va a perder** (13g ronda 3, la
causa raíz de lo anterior). La capa Tiled `puertas` declara `a` y `b` de cada puerta. `instantiateDoorSeeds`
los descartaba —solo conservaba posición, footprint e id— y `syncInstalledDoors` los RE-INFERÍA con
`thresholdSectionsAt`, que se rinde cuando la celda toca tres secciones. O sea que una puerta perfectamente
declarada se descartaba en silencio por una ambigüedad que no existía, porque el desempate estaba escrito y se
había tirado tres pasos antes. Reglas:
- Al unificar dos caminos en uno (13h fusionó "puerta autorada" e "instancia instalada" para que ambas
  tuvieran sprite y nodo de señal), listar qué datos tenía cada camino y **verificar que el camino unificado
  los conserve todos**. Acá la unificación resolvió dos huecos y abrió este.
- Si el motor deriva algo que en algún origen viene declarado, hacen falta **dos caminos**: dato explícito
  cuando existe, inferencia como fallback. Un solo camino inferido convierte el dato autorado en decoración.
- Síntoma reconocible: un campo del formato de autoría que no aparece en ningún consumidor. En la misma ronda
  apareció otro (`initialOpen`, autorable en Tiled y leído por nadie) — buscarlos en lote, no de a uno.

**Patrón 55 — que el motor simule una pieza no significa que el jugador pueda conseguirla; el camino de
ADQUISICIÓN se verifica aparte del de simulación** (14a-1 ronda 1). 14a-1 sacó al sensor térmico del fail-open,
lo cableó, lo testeó de punta a punta y le dio partículas. El operador abrió el juego y no lo encontró en la
lista de instalación. Estaba cortado en tres lugares que ningún test del motor podía ver:
- La pieza no declaraba `data.footprint`, y `buildInstallOptions` descarta esos compuestos con un `continue`
  MUDO — ni fila bloqueada ni aviso. Solo 6 de ~30 compuestos del catálogo lo declaran.
- Su receta pedía ingredientes con stock 0 en el capítulo, así que ni con footprint habría sido construible.
- El LED que hace falta para leerla tenía stock 1, o sea que no se podía montar más de una prueba.

Reglas que salen de acá:
- Al dar vida a una pieza del catálogo, recorrer su cadena completa: **¿aparece en el selector? ¿hay stock o
  receta pagable? ¿hay suficiente para montar MÁS DE UNA prueba a la vez?** Es el patrón 20 (una receta de
  prueba que no ejecuté) aplicado a la disponibilidad de la pieza, y el patrón 49 (escritor/lector) aplicado a
  la economía: una pieza simulada y no obtenible es tan inerte como un evento sin consumidor.
- **El operador prueba VARIAS instancias a la vez**, no una. Su pedido literal fue "asegurate de que pueda
  instalar varios sensores y varios LEDs para hacer diferentes pruebas en la misma pantalla". Comparar dos
  secciones en estados distintos es cómo verifica que un fenómeno es local y no global — con una sola unidad
  no se distingue "funciona" de "está siempre encendido" (patrón 51). Al cerrar una subfase con una pieza
  nueva, dejar stock para al menos 3 montajes simultáneos.
- Precedente que confirma que esto es política y no un favor puntual: 11h ya había sumado 1 sensor de presión
  + 1 LCD + 1 LED al stock del Cap. 1 exactamente para poder instalarlos sin desarmar nada. Está escrito en
  `chapter-01-primer-aviso.ts` y yo no lo leí antes de cerrar 14a-1.

**Patrón 56 — un dato de UI que aprendí una vez puede haber cambiado; el pack de pasos de prueba caduca**
(14a-1 ronda 1). Escribí "pestaña Catálogo del picker" y el picker no tiene pestañas desde la ronda 8: es una
lista plana, y `tab-strip.ts` quedó sin importadores. El docstring de `knownCompositeDefinitions` en
`mission-runtime.ts` TODAVÍA dice «pestaña "Catálogo"», o sea que el código me habría confirmado el dato viejo.
Regla: antes de escribir un paso de prueba que nombre un elemento concreto de UI, abrir el widget que lo
dibuja — no confiar ni en la memoria ni en los comentarios del código, que envejecen igual. Guardado como
[[picker-instalacion-sin-pestanas]].

**Aplicado preventivamente en 14a-2 (2026-08-31), antes de playtest.** Lo que el checklist forzó a destapar
en la PLANIFICACIÓN, y que el texto de la subfase daba por sentado:
- **Patrón 15/18 (el texto de un ítem viejo es una hipótesis) — cuatro de cuatro viñetas estaban mal.**
  `thermalConductivityRule` modelaba solo el FRÍO mientras todos los escritores de 14a-1 son de calor (o sea,
  inalcanzable, y la integración que la propia subfase declaraba como objetivo era la rama que faltaba); el
  enfriador que pedía crear YA EXISTÍA en el catálogo, inerte; y "cambio de estado L↔S↔G" no era un
  acoplamiento sino un subsistema entero sin ningún dato de soporte. Verificar cada viñeta en el código antes
  de planificar cambió el alcance de la subfase completa.
- **Patrón 49 (escritor sin lector) en su forma más cara: DOS runtimes enteros sin camino jugable.**
  `MissionOverloadRuntime` solo corría sobre `scriptedOverloads` y `MissionReactionRuntime` sobre
  `scriptedReactions`, vacío en TODOS los capítulos. Preguntárselo al operador cambió el diseño de raíz — su
  respuesta fue "nada de scripted, poné las piezas para que yo monte el escenario". La lección de proceso:
  cuando un plan dice "cablear X dentro de Y", ir a ver **si Y se ejecuta alguna vez en partida**.
- **Patrón 19 (la escala no viaja en el tipo)**: `COND.maxCapacity` valía 100 y `powerDraw` vale 1-3. Derivar
  la carga del consumo real exigía re-escalar el catálogo; sin eso, dos `number` que compilan igual habrían
  dado un conductor que nunca revienta.
- **Patrón 23 (buscar los clamps que ya actúan sobre la misma magnitud)**: la potencia del enfriador se eligió
  resolviendo el equilibrio contra la deriva pasiva (21 - R/0.05), no a ojo. Con menos de 3.55 °C/s toda la
  rama fría habría quedado inalcanzable. Y el umbral caliente se ubicó cruzando el del sensor (60) contra los
  picos reales de combustión (~81 standard, ~161 violent) para que la franja no fuera vacía por ningún lado.

**Patrón 57 — la condición que hace observable un estado puede ser la misma que lo suprime** (14a-2,
encontrado por el test de integración, no por el operador; es el patrón 48 fuera de lo visual).
`thermalRegulatorOverloaded` exige que haya un regulador térmico INSTALADO en la sección. Pero un regulador
instalado está enfriando, así que una combustión violenta en su sala pica en ~73 °C en vez de los ~161 que
daría sin él — y el umbral estaba en 80. O sea: el estado "el regulador no da abasto" era inalcanzable
exactamente en el único caso en que se evalúa, por culpa de la pieza que lo hace evaluable. Reglas:
- Al escribir un predicado con forma "hay una pieza P **y** el mundo está en estado E", preguntar si P
  **modifica** E. Si lo modifica, el umbral hay que calibrarlo con P puesta, no con la nave sin P.
- Esto no lo encontró ningún unitario: cada lado estaba bien. Lo encontró el test que monta la pila entera
  (patrón 43), y lo encontró porque el aserto era sobre un NÚMERO real y no sobre "se emitió el evento".

**Patrón 58 — medir un fenómeno transitorio al final del bucle mide su recuperación, no el fenómeno**
(14a-2). Dos tests de la cadena fría fallaron dando -12 °C donde esperaban -50: el derrame criogénico es un
PULSO, la sala cruzaba el umbral, disparaba el corte del conductor, y para cuando el bucle terminaba la
climatización ya la había devuelto casi al nominal. El aserto describía el instante equivocado. Regla: al
testear algo que sube y baja, acumular el extremo (`Math.min`/`Math.max`) durante el bucle en vez de leer el
valor final — y, si el fenómeno deja cicatriz, comprobar las dos cosas por separado: el pico que ocurrió y la
marca que quedó.

**Patrón 59 — el camino de adquisición tiene más de un corte, y el segundo está más adelante** (14a-2;
continuación directa del patrón 55). 14a-1 aprendió "una pieza simulada que no se puede conseguir es inerte" y
arregló footprint y stock. En 14a-2 la pieza SÍ se conseguía —el jugador podía fabricar e instalar el tanque
criogénico— y seguía sin servir: `deriveInitialReservoirContents` solo corría al crear la campaña, así que el
tanque nacía VACÍO y la acción "Verter en la sección" ni siquiera aparecía en el panel. Regla: recorrer la
cadena de adquisición hasta el USO, no hasta la instalación. ¿Aparece en el selector? ¿hay receta pagable? ¿la
pieza instalada queda en un estado que permite la acción para la que existe? Se encontró verificando los pasos
de prueba manual contra el código ANTES de entregarlos (patrón 20), que es exactamente para lo que sirve.

**Patrón 60 — colgar una mecánica de una pieza que nadie tiene motivo para colocar** (14a-2 ronda 1; el más
caro de esa ronda y cometido por mí en la subfase anterior). El operador preguntó *"¿por qué el jugador metería
un cable de cobre en el mapa?"* y la respuesta verificada fue **que no tiene ninguno**: el modo cableado conecta
nodo→nodo directamente ruteando por conductos del plano, nunca a través de piezas; el rol de nodo `"conductor"`
tiene **cero lectores en producción** (es idéntico a un `receptor`); y la arista que dibuja el jugador es
**gratis, instantánea y de capacidad infinita**. O sea que 14a-2 construyó un acoplamiento térmico correcto
—enfriar un conductor baja su capacidad y lo corta— colgado de una pieza que nunca entra al mapa. Es el patrón
55/59 un nivel más arriba: no es que la pieza no se pueda conseguir ni que no se pueda usar, es que **no hay
razón para quererla**. Regla: al elegir el sujeto de una mecánica nueva, preguntar *"¿qué hace hoy que el
jugador quiera poner esto?"* y verificar la respuesta en el código, no en el catálogo. Si la única razón para
colocar la pieza es la mecánica que estoy escribiendo, la mecánica no tiene camino jugable.

**Patrón 61 — cerrar una subfase dejando sin hacer un punto de legibilidad que el propio plan prometía**
(14a-2 ronda 1). El operador reportó "el cable no muestra ningún estado en su tooltip". Era cierto, y el
docblock de `instance-state.types.ts` **ya nombraba** `Blueprint.overloadedRefs` como el candidato natural con
la infraestructura lista. El plan de 14a-2 lo incluía; se implementó la mitad del motor (cortar el conductor) y
no la mitad visible (decirlo). La subfase pasó por su cierre completo —tests, changelog, mapa, commit— sin que
nada notara el hueco, porque todo lo que se escribió estaba bien. Regla de cierre: **releer el plan propio
punto por punto contra lo implementado antes de marcarlo cerrado**, tratándolo como una checklist y no como un
recuerdo. Es el patrón 15 ("el texto de una observación vieja es una hipótesis") aplicado al propio plan, y
tiene un olor característico: una subfase que toca el motor y NO agrega ninguna representación visual casi
siempre dejó afuera el principio 6.

**Patrón 62 — un efecto de SALA pintado en un punto, y el mismo defecto en todos sus hermanos** (14a-2 ronda
1). "La caída de temperatura debería congelar toda la sección; ahora congela una celda". Los tres efectos de
atmósfera creaban UN emisor en la celda centroide con `spreadRange(10)` — 10 píxeles, menos de una celda,
dentro de salas de 30-60. Dos cosas que salen de acá:
- **El alcance visual de un efecto se verifica contra las dimensiones REALES del contenido**, no contra que "se
  ve la partícula". 10 px suena a un radio razonable hasta que se compara con una sala de 60 celdas: es el
  patrón 19 (la escala no viaja en el tipo) en versión espacial.
- Y el patrón 31 otra vez, ya inevitable: los tres hermanos compartían el defecto y solo uno se reportó. La
  salida estructural fue extraer la cobertura a un módulo compartido, para que el próximo efecto de sala la
  herede en vez de volver a inventar un radio a ojo.
- Corolario sobre superficies: la zona de emisión son las **celdas** de la sección, nunca su bounding box — el
  box de una sección en L incluye pared y pasillo ajeno, y pintar un fenómeno donde el motor no lo tiene es
  peor que no pintarlo (patrón 1).

**Patrón 63 — un umbral visual atado al umbral EQUIVOCADO de los que existen** (14a-2 ronda 1; refinamiento del
23 y del 46). La escarcha se había atado al umbral de daño ESTRUCTURAL (-40) con el argumento correcto —un
número suelto se separa del motor en el próximo balanceo— pero de los umbrales disponibles se eligió el que no
describe lo que la señal significa. Con -40, la sala mataba a un tripulante durante 30 °C enteros sin mostrar
absolutamente nada. Regla: al atar una señal visual a una constante del motor, elegir la que responde **la
pregunta que el jugador se está haciendo al mirarla** ("¿puedo entrar acá?" → el umbral de la persona, no el
del casco). Y del otro lado del mismo eje apareció el hermano: el tooltip coloreaba solo el lado caliente, o
sea que un eje de dos lados tenía UI de uno solo. Al agregar un eje bidireccional, buscar explícitamente el
lado que no motivó el cambio.

**Patrón 64 — un predicado que decide sobre un estado tiene que MIRAR ese estado** (14a-4 ronda 1, el bug más
caro de la ronda). `blocksPathing` devolvía `door.mode === "override"` y nunca leía `door.state`, así que una
puerta que la señal mantenía ABIERTA se trataba como pared y dejaba a un tripulante encerrado detrás de una
hoja visiblemente abierta. Lo revelador: **su propio docblock ya describía la regla correcta** ("cerrada por un
override de señal") y el código decía otra cosa. Reglas que salen de ahí:
- Al escribir o revisar un predicado, contrastar el docblock con el código **línea por línea**: la prosa suele
  llevar la intención y el código una simplificación que era cierta cuando se escribió.
- Cuando existen VARIOS predicados sobre el mismo objeto (acá tres: `blocksPassage`, `blocksPathing`,
  `isDoorwayHeldClosed`), ponerlos en una tabla y buscar la fila donde discrepan. Coincidían en todo salvo en
  un cruce, y ese cruce era el bug.
- El test que faltaba no era un caso nuevo, era el **CRUCE de dos casos ya cubiertos** ("cerrada por señal" y
  "abierta en auto"). Al cubrir una tabla de estados, cubrir las combinaciones, no las filas.

**Patrón 65 — una acción sin affordance no existe** (14a-4 ronda 1). Se agregó "retirar un cable" como gesto
(volver a marcar sus dos extremos) sin ningún indicio en pantalla, y el operador preguntó literalmente "¿cómo
retiro un cable sano?". Un gesto que solo conoce quien escribió el código es una función no entregada. Regla:
toda acción nueva necesita un punto de entrada VISIBLE (botón, entrada de panel, ítem de menú); un atajo de
gesto se agrega ADEMÁS, nunca en lugar de.

**Patrón 66 — mostrar el estado con un color y no dar el número deja el indicador a medias** (14a-4 ronda 1;
hermano del 7 y del 63). El cable cambiaba de color según su carga, y el reporte fue: "el 7º cable está en
ámbar, pero el jugador no entiende el porqué del color ni lo que implica; el emisor que tiene 7 receptores no
dice nada, los receptores no dicen nada, el cable no tiene tooltip". Tres lecciones distintas:
- Un color es una ALERTA, no una lectura. Si el jugador puede preguntarse "¿cuánto me falta?", hace falta el
  número (`carga 5 / 6`), no solo el tono.
- Un umbral necesita su **consecuencia en palabras**. "Ámbar" no dice qué pasa al cruzarlo.
- La causa y el efecto suelen vivir en objetos distintos: el cable se pone ámbar por culpa de lo que cuelga
  del EMISOR. Al agregar un indicador, preguntarse **dónde va a mirar el jugador buscando la causa** y poner
  ahí la otra mitad de la lectura.

**Patrón 67 — una mecánica solo existe si la topología que el jugador construye puede alcanzarla** (14a-4
ronda 1). La sobrecarga de cables está bien modelada, pero en una ESTRELLA (un sensor → N consumidores) cada
cable lleva un solo consumidor y el ratio queda clavado: hicieron falta 7 consumidores encadenados para ver el
primer ámbar. El modelo era correcto y aun así casi invisible en juego. Regla: al cerrar una mecánica,
simular mentalmente **el montaje que el jugador va a hacer primero** (el más obvio, no el que la luce) y
comprobar si en ese montaje la mecánica se manifiesta. Si no, o se ajustan los números, o se agrega la lectura
explícita que la haga entendible igual.

**Patrón 68 — al agregar un dato derivado a una entidad, preguntarse por las partidas YA guardadas** (14a-4
ronda 1). Los nodos de señal se derivan al INSTALAR y se persisten, así que darle una salida nueva al `ACT`
habría dejado sin ella a toda puerta de una partida en curso: la mecánica nueva habría sido invisible **justo
para quien ya está jugando**, el peor reparto posible. La migración de forma (serializador) no alcanza cuando
el dato nuevo depende del CATÁLOGO; hace falta una siembra idempotente al arrancar, en la capa que sí conoce el
registry. Corolario del mismo caso: al derivar ids por índice, agregar un elemento en el medio CORRE los ids
posteriores y deja huérfanas las referencias guardadas — derivar el id nuevo del viejo en vez de consumir un
índice más.

**Patrón 69 — una mecánica de coste no existe si la topología BARATA la evita** (14a-4 ronda 2).
Extensión dura del patrón 67, y el mismo caso una ronda después: sobrecargar un cable exige un tronco
(`sensor → relé → N piezas`), pero montar en tronco costaba un cable MÁS que la estrella. O sea que el
montaje que produce la mecánica era **estrictamente peor** y ningún jugador razonable lo iba a
construir jamás. No alcanza con preguntarse si la mecánica es alcanzable: hay que preguntarse **qué
empuja al jugador hacia el montaje que la produce**. Si la respuesta es "nada", la mecánica está
muerta aunque el modelo sea impecable. La solución casi nunca es recalibrar la mecánica en sí, sino
agregar la presión que falta aguas arriba (acá: un límite en el emisor, que vuelve necesario el relé).

**Patrón 70 — rodear una guarda en vez de corregirla deja el agujero abierto** (14a-4 ronda 2). En la
ronda 1, `orientSignalWiring` impedía que una puerta emitiera; se resolvió dándole al `ACT` un nodo
emisor nuevo. Una ronda después la MISMA guarda bloqueaba el relé receptor→receptor, y su argumento
("dos consumidores no tienen nada que decirse") era falso desde siempre para este motor. Regla: cuando
algo legítimo choca contra una validación, **leer el argumento de la validación y verificar si sigue
siendo cierto** antes de inventarle una vuelta. Un rodeo resuelve el síntoma del día y deja la causa
esperando a la próxima ronda. Corolario: al corregir la guarda, revisar si el rodeo anterior sigue
teniendo sentido propio (acá sí: el nodo del `ACT` emite el estado REAL, no el passthrough — dos
semánticas distintas).

**Patrón 71 — un test que contradice su propio título está avisando de un error de diseño, no de
aritmética** (14a-4 ronda 2). Al escribir "con el relé nadie pasa hambre" el aserto salió
`starved > 0`: la demanda era transitiva, así que el sensor seguía viendo todo a través del relé y el
relé no resolvía nada. El plan aprobado tenía el agujero y solo apareció al escribir el caso. Regla:
cuando un test tenga que afirmar lo contrario de lo que su nombre promete, **parar y revisar el
diseño** en vez de ajustar el aserto — el nombre venía de la intención, y la intención es la que hay
que arreglar.

**Patrón 72 — al pintar la consecuencia de una RELACIÓN, verificar que el efecto no caiga sobre los
objetos que relaciona** (14a-4 ronda 3). Un cable quemado sembraba su cicatriz sobre todas las celdas
que atraviesa, y esa lista incluye las de sus dos extremos — o sea las celdas de las piezas que une.
El operador vio "el chip brillando como si estuviera roto" cuando el chip estaba impecable y lo
quemado era la arista. **El jugador atribuye lo que ve a lo que hay debajo**, así que una cicatriz
correcta sobre el sujeto equivocado se lee como un bug en la pieza. Regla: cuando el sujeto de un
efecto sea una arista, un vínculo o una relación, preguntarse qué OBJETO queda debajo de cada píxel
que se pinta. Corolario: un efecto puntual (una luz, un glow) describe un objeto con volumen; para una
línea hace falta algo direccional (un arco que se ve nacer en ella), o el efecto termina describiendo
lo que tiene debajo en vez de a sí mismo.

**Patrón 73 — "atenuado" no es un estado; invisible se lee como ausente** (14a-4 ronda 3). El cable
quemado se dibujaba a 1 px con alfa 0.7 en gris oscuro, con la idea de que "apagado" comunicara
"muerto". El operador reportó que **el cable desapareció**. Un estado degradado tiene que seguir siendo
igual de VISIBLE que el estado sano y diferenciarse por FORMA (entrecortado, rayado, tachado), no por
menos presencia — bajar contraste u opacidad comunica "esto no existe", no "esto está roto". Y en este
caso además rompía la salida: sin ver el recorrido, el jugador no puede ir a retirar el cable.

**Patrón 74 — infraestructura completa sin llamador es infraestructura AUSENTE** (14a-4 ronda 4a). El
bloqueo por dependencia entre tareas estaba entero, testeado y documentado en `TaskScheduler` desde la
Fase 10… y `mission-runtime` nunca pasaba `dependsOn`. Cancelar un movimiento no impedía la
instalación que lo seguía: la pieza aparecía en una sección a la que el tripulante nunca llegó. Regla:
al afirmar cómo se comporta un sistema, **verificar quién lo INVOCA**, no solo que exista y esté bien
implementado. Corolario personal: en esta misma conversación afirmé "queda bloqueada" tras leer solo
el scheduler, y me tuve que corregir al mirar los llamadores — leer la implementación no es verificar
el comportamiento.

**Patrón 75 — una acción sin CONFIRMACIÓN es indistinguible de una que no existe** (14a-4 ronda 4a).
La "×" de cancelar estaba dibujada en cada fila de la cola desde hacía fases, y el operador no sabía
que se podían cancelar tareas: era un glifo chico que al clickearse no producía ninguna señal
perceptible (ni sonido, ni resaltado, ni animación). Es el patrón 65 en su segunda forma — ahí faltaba
la affordance, acá faltaba el feedback. Al agregar una acción, preguntarse **qué percibe el jugador en
el instante en que la usa**; si la respuesta es "el estado cambia en algún lado", no alcanza.

**Patrón 76 — antes de agregar una reserva o un bloqueo, preguntarse cómo se LIBERA** (14a-4 ronda
4a). El operador frenó un diseño de reserva de stock con la pregunta correcta: "hay formas de colgar
tareas y que nunca se ejecuten; esas tareas dejarían piezas reservadas indefinidamente". Todo recurso
que se toma necesita un camino de salida VISIBLE, y ese camino es parte del diseño de la reserva, no
un extra. Corolario: si el estado que sostiene la reserva no se persiste, la reserva tiene que
DERIVARSE de él y nunca escribirse en el guardado — descontar al encolar habría hecho perder material
por el simple hecho de guardar la partida.

**Patrón 77 — cancelar un estado del motor no cancela lo que ya está en pantalla** (14a-4 ronda 4b).
Los visuales de una tarea (la cadena de saltos del `go-to`, las partículas de instalar) se lanzaban en
`task-started` y se soltaban sin guardar ninguna referencia: detenerlos al cancelar no era difícil,
era **imposible**. El motor hacía bien su parte —la pieza no se instalaba— y aun así en pantalla la
cancelación no había ocurrido: el tripulante terminaba el viaje y la animación llegaba hasta el final.
Regla: toda animación que dure más de un instante y represente una tarea necesita **cómo se apaga**
registrado en el mismo lugar donde se lanza. Si no hay forma de alcanzarla, no hay forma de cancelarla.

**Patrón 78 — tres síntomas con la misma causa se arreglan juntos o no se arreglan** (14a-4 ronda 4b,
y ya había pasado en 14a-2 con los efectos de sección). El operador reportó tres cosas distintas (la
fila no desaparece, el tripulante no se detiene, la animación no para) que eran **un solo defecto**
visto desde tres sitios. Antes de arreglar el que más molesta, buscar si sus hermanos comparten causa
— arreglar uno solo deja los otros rotos con la misma raíz y garantiza otra ronda de playtest.

**Patrón 79 — un estado terminal que se sigue mostrando se lee como "no pasó nada"** (14a-4 ronda 4b).
La cola filtraba solo `completed`, así que una tarea cancelada seguía en la lista con la barra en cero
y el operador concluyó que borrar no hacía nada. Una lista de "lo que va a pasar" no es un historial:
al agregar un estado terminal nuevo, revisar TODAS las vistas que enumeran esa entidad, no solo la que
motivó el cambio.

**Patrón 80 — un número que baja NO es la forma de comunicar que un recurso está comprometido**
(14a-4 ronda 4c, decisión del operador en la planificación). Propuse que el selector mostrara el stock
ya descontado ("1 disponible" cuando hay 3 y 2 están encoladas) y el operador lo corrigió: **mostrar
el stock REAL en la fila, y el desglose reservadas/disponibles en los detalles**. Es el patrón 1 (la
UI no miente sobre el motor) llevado un paso más: descontar en silencio hace que la UI mienta *por
omisión* — la pieza existe, está en la bodega, y un número más chico la borra de la vista sin decir
quién se la llevó. Regla general: cuando un recurso queda comprometido por otra cosa, mostrar **el
total real + el reparto**, nunca el neto solo; y cuando eso bloquea una acción, el motivo del bloqueo
tiene que ser PROPIO ("comprometida por la cola") y no reciclar el del recurso ausente ("sin stock"),
porque cada uno manda al jugador a hacer algo distinto (cancelar una tarea vs. salir a conseguir la
pieza).

**Aplicado preventivamente en 14a-3 (2026-09-03), antes de playtest.** Lo que el checklist forzó a destapar
en la PLANIFICACIÓN, y lo que destapó el propio test de integración:
- **Patrón 15/18 otra vez, y otra vez cuatro de cuatro**: verificar en código las viñetas del ítem viejo cambió
  el ENCUADRE de la subfase entera. No era "más variedad química": era el eslabón que faltaba entre el eje
  térmico y una cadena de ignición que ya estaba viva y a la que nadie podía llegar.
- **Patrón 49 (escritor sin lector), dos veces**: `ReservoirContentPhaseChange`… no, los dos reales fueron
  `consumedReactantIds` (declarado por `CombustionRule` desde siempre, aplicado por NADIE — el combustible del
  aire no se agotaba nunca) y `ignitedSectionIds` (un `Set` que jamás se limpiaba). Ninguno de los dos se notaba
  porque no había forma de meter reactivos al aire después del hecho; la subfase creaba justo esa forma.
- **Patrón 23 (buscar los clamps de la misma magnitud) en su forma más cara**: `PRESSURE_RECOVERY_CEILING_KPA`
  ES la presión estándar, así que "presión por expansión" habría sido un escritor muerto en cualquier sala sana.
  Se destapó ANTES de escribir una línea, y cambió la pregunta al operador de "cómo lo implemento" a "qué
  queremos que signifique".
- **Patrón 19 aplicado a mi propio plan**: el plan aprobado decía `FROZEN_RESERVOIR_WEAR_INCREMENT = 0.15` y
  `ComponentWear` es una escala ORDINAL de cuatro niveles. Un "incremento de 0.15" no significa nada en ese eje.

**Patrón 81 — un umbral elegido por su lugar en la tabla puede ser inalcanzable por el CAMINO que lo alimenta**
(14a-3, encontrado por el test de integración). `AUTOIGNITION_CELSIUS` se ubicó en 120 con un argumento correcto
(entre la degradación del conductor y el pico de una combustión violenta) y era imposible de cruzar: la
conducción entre secciones atenúa ~70% del exceso, así que una combustión violenta que deja la sala de origen en
124 °C deja la vecina en **54**. El umbral no estaba mal respecto de los otros umbrales; estaba mal respecto del
MECANISMO que tenía que llevar la temperatura hasta él. Es el patrón 23 un nivel más arriba: no basta con mirar
los clamps que actúan sobre la magnitud, hay que simular el camino concreto por el que el valor va a llegar ahí.
Corolario del mismo caso: cuando dos umbrales del sistema se ordenan entre sí (el vapor aparece a X, la
autoignición a Y), **el orden ES la mecánica** — con la ebullición del combustible por encima de la autoignición
el charco habría ardido solo y la chispa no habría hecho falta nunca. Mover 95 → 75 no fue balanceo, fue abrir
la franja donde el jugador decide.

**Patrón 82 — una heurística caduca cuando llega el dato que sustituía, y hay que ir a borrarla** (14a-3). El
tag `VOLAT` metía a los líquidos volátiles en la atmósfera desde 13e, con su docblock diciendo explícitamente que
era un sustituto ("un líquido volátil se evapora") de unos puntos de ebullición que no existían. Al llegar los
puntos, mantener las dos vías dejaba al combustible y al disolvente permanentemente en el aire — o sea
inflamables a 21 °C, con la mecánica nueva muerta y sin que nada fallara. Lo destapó un test que afirmaba lo
contrario de lo que su nombre prometía (patrón 71). Regla: al implementar el dato real, grepear la heurística que
lo suplía y borrarla en el mismo cambio; si no, las dos conviven y gana la vieja, que es la que ya está cableada.

**Patrón 83 — la pregunta del operador sobre el ALCANCE es la que más barato sale contestar** (14a-3). Ante el
plan ya escrito preguntó *"¿estamos teniendo en cuenta la interacción de los estados con el entorno — chispazos,
la temperatura de otra sala por una explosión? ¿o esta iteración solo agrega variedad química?"*. Verificarlo
destapó tres huecos preexistentes (la ignición que no caduca, el calor que no enciende, el combustible que no se
agota) que habrían convertido la subfase en una mecánica correcta y sin efecto. Sus preguntas de encuadre valen
lo mismo que sus reportes de bug: no piden confirmación, piden que vaya a mirar.

**Cómo aplicar**: correr este checklist como auto-revisión antes de dar por cerrada una subfase con UI, y
además **durante la planificación** (13c demostró que ahí es más barato), y
mencionarlo en los pasos de prueba manual que ya se entregan ([[feedback_pasos_de_prueba_manual_por_subfase]]).
Cuando llegue feedback nuevo, agregar el patrón detectado a esta lista **en el mismo cierre**, en vez de solo
arreglar el caso puntual. (Esto ya falló DOS veces: la lista se creó tras la ronda 4 y no se actualizó en las
rondas 5-7, ni tampoco en la 8 — en ambos casos hizo falta que el operador preguntara "¿guardaste esto?".
Actualizar esta memoria es parte del cierre, al mismo nivel que el changelog y el commit, no un extra.)

**Patrón 84 — un arreglo que solo llega a una de las dos familias de un sistema garantiza que la otra
repita el bug** (14a-3 ronda 1; es el patrón 31 con causa estructural, y esta vez el hermano roto lo
escribí yo DESPUÉS de haber aprendido la lección). La ronda 1 de 14a-2 corrigió "un fenómeno de sala
pintado como un punto" en los tres efectos de atmósfera, y lo hizo bien: extrajo la cobertura a un módulo
compartido. Pero solo cableó el área en los efectos *state-driven* — `StateDrivenEffect.start` recibe un
`EffectArea` y `EventEffectOptions` no tenía ninguno—, así que cuando 14a-3 agregó la evaporación como
efecto por EVENTO, el módulo compartido no era alcanzable y volví a inventar un radio a ojo: un burst de
±14 px en el centroide de una sala de 30-60 celdas. El operador reportó exactamente lo mismo que dos
subfases antes ("el vapor es muy poco visible"). Reglas:
- Al extraer un helper para arreglar una familia de consumidores, preguntar si existe una SEGUNDA familia
  que resuelve el mismo problema por otra vía. Si existe y no puede llegar al helper, el helper solo
  arregló la mitad y la otra mitad va a divergir en cuanto alguien la toque.
- El olor característico: dos tipos que representan lo mismo (`StateDrivenEffect.start(…, area)` y
  `EventEffectOptions`) y solo uno lo lleva. No es una asimetría de diseño, es la mitad de un arreglo.
- Corolario del corolario: los tres efectos que ya estaban bien (`section-damaged`, los hazards
  atmosféricos) también pintaban en el centroide y nadie lo había reportado — al cablear el área hubo que
  arreglarlos en la misma pasada, que es el patrón 31 en su forma normal.

**Patrón 85 — una fórmula que es correcta en el caso general puede no tener ningún caso REAL donde se
sostenga** (14a-3 ronda 1, encontrado por el eje 10 del checklist antes de que el operador lo jugara). El
calor del cableado (`carga² / capacidad`) se calibró contra "tres compuertas detrás de un relé", que da
una carga de 7 sobre un cable de capacidad 6. `OverloadRule` corta con `load > capacity`: ese montaje se
quema en el primer tick, así que el número estaba calibrado contra un escenario que en partida no existe.
Un test verde y una cuenta correcta sobre un mundo imposible. Reglas:
- Al calibrar una magnitud contra un montaje concreto, verificar que ese montaje sea ESTABLE bajo las
  otras reglas del motor — y anclarlo con un aserto propio (acá: que la carga del tronco no supere su
  capacidad), no dejarlo en la prosa del docblock.
- El fixture tiene que usar las piezas que el capítulo tiene EN STOCK. Con compuertas (consumo 2) no
  existe ningún número de consumidores que dé exactamente 6 con el chip sumando 1; con los LEDs que el
  Cap. 1 sí tiene (consumo 1) sale justo. Un fixture con piezas que el jugador no puede conseguir
  describe un montaje que nadie va a armar.
- Corolario sobre la conclusión intuitiva: "la resistencia eléctrica es el calefactor" era falso. A igual
  carga calienta un orden de magnitud más que la fibra, pero en su PROPIO límite el cobre calienta más,
  porque `C²/C = C` crece con la capacidad. Antes de vender una consecuencia jugable, evaluar la fórmula
  en el límite de cada pieza y no solo comparando a igualdad de una variable.

**Patrón 86 — "tsc limpio" no es lo mismo que "corrí tsc después de mi último cambio"** (14a-3, detectado
en la ronda 1). El cierre de 14a-3 declaró `tsc` limpio y no lo estaba: los dos últimos archivos que
edité eran tests de integración, quedaron con una inferencia circular (`gasInjection` referenciando un
`atmosphere` declarado más abajo) y **vitest no typechequea**, así que la suite entera seguía en verde. Mi
última corrida de `tsc` era anterior a esas ediciones. Regla: los tres verificadores se corren DESPUÉS del
último cambio, juntos y en la misma pasada, y el número que se reporta es el de esa corrida — no el
recuerdo de una anterior. Corolario específico de este repo: un archivo `.test.ts` puede romper `tsc` sin
romper ningún test, así que "los tests pasan" no cubre el typecheck de los tests.

**Patrón 87 — Un fixture de calibración más simple que el juego es una calibración NO medida** (14a-3,
ronda 2; el más caro del proyecto hasta ahora: cinco números mal en tres subfases). El eje térmico se
calibró siempre despejando `T = NOMINAL + R / PASSIVE_DRIFT_PER_SECOND`. Esa cuenta ignora la conducción
entre secciones, que en la nave real se lleva **más** calor que la propia climatización: la tasa de
conducción es el triple de la deriva pasiva, no se apaga al cerrar una puerta (`MIN_THERMAL_APERTURE`) y
cada par de salas está conectado dos veces (ducto + puerta). Resultado: el cableado prometía 82 °C y daba
43, la tecla de dev nunca llegaba a su consigna, el enfriador prometía -69 y daba -10.9 —dejando
**inalcanzable** el umbral frío que su propio docblock se felicitaba por haber hecho alcanzable— y los
picos de combustión citados en dos docblocks estaban un 50% arriba, con lo que la rama caliente de
`thermalConductivityRule` era inalcanzable para todo conductor que no fuera `CT: "A"`.

Lo importante es por qué **sí se había medido y no alcanzó**: el test de integración de la ronda 1 montaba
la pila real (térmico + atmósfera) a cadencia de frame y leía el equilibrio de la simulación… sobre un
`ShipFloorplan` de UNA sección con `conduits: []`. En una nave de una sola sala sin vecinas, la fórmula
mala es exacta, así que el test la **confirmaba** en vez de contradecirla. Los tres fixtures de calibración
del repo tenían la misma forma.

- "Medí" no es una propiedad de la corrida, es una propiedad del **mundo** contra el que se corre. La
  pregunta no es "¿simulé?" sino "¿qué le saqué al mundo para que el fixture fuera cómodo, y ese recorte
  es justo la variable que domina el resultado?".
- Una calibración se mide contra el **contenido real** (acá `CANONICAL_SHIP_FLOORPLANS`), no contra un
  plano sintético: un fixture sintético puede volver a ser más simple que el juego, un plano autorado no.
- Cuando un número dependa de la topología, **afirmarlo sobre varias salas y no sobre una**: acá el techo
  no lo pone la sala de referencia sino la peor ventilada (89.2 contra 76.7), y es la que decide si la
  promesa "ningún montaje solo enciende una sala" es verdad.
- Un test verde custodiando una regla muerta es peor que no tener test: da por saldada la verificación.
  Si un aserto dice que un umbral es alcanzable, tiene que alcanzarlo **por el camino de producción**.
- Corolario de números en cascada: al recalibrar una constante, buscar los OTROS números despejados de la
  misma fórmula. Acá salieron el ramp de las partículas del cable (que nacía saturado con la constante
  nueva) y la ventana térmica citada en cinco docblocks de química. Un `grep` de los valores viejos es
  parte del cambio.
- Corolario sobre magnitudes absolutas en tests: dos asertos (`< 0.1 °C/s`, equilibrio del enfriador) se
  volvieron rojos al recalibrar sin que nada estuviera mal, porque afirmaban un NÚMERO en vez de su
  significado ("la sala no se entera", "cruza el umbral"). Afirmar el significado sobrevive al balanceo.

**Patrón 88 — Dos lecturas del mismo fenómeno tienen que gatillar sobre la misma magnitud** (14a-3,
ronda 2). El tooltip del cable decía `2.7 °C/s en esta sala` y el de la sección `1.7`: los dos números
eran correctos —el cable disipa 2.7 en total y reparte 1.35 a cada sala que cruza— y el que mentía era el
TEXTO. Al corregirlo para mostrar el reparto apareció el bug simétrico: la línea del tooltip se mostraba
sólo por encima del mismo umbral que las partículas, pero las partículas miran el total del cable y la
línea pasaba a mirar el reparto, así que un tronco largo podía brillar sin número al lado. Cuando dos
indicadores prometen coherencia ("si ves el shimmer, el número está ahí"), el **gatillo** de los dos tiene
que ser la misma magnitud, aunque muestren cosas distintas. Y antes de dar por bueno un desacuerdo entre
dos números de la UI, comprobar si el desacuerdo es real o si simplemente son dos magnitudes distintas mal
etiquetadas.

**Patrón 89 — Alcanzabilidad no termina en la pieza: el ESTÍMULO también tiene que existir** (14b-1,
ronda 1). El sensor químico se cerró verificando lo de siempre —que el motor lo simulara, que declarara
`footprint`, que su receta se pagara con el stock del capítulo— y todo eso estaba bien. El operador lo
montó, lo cableó a un LED, vació un reservorio en la sala y no pasó nada: **no existía en el Cap.1 ninguna
sustancia que el sensor pudiera detectar**. Un lector sin nada que leer es tan inusable como una pieza sin
footprint, y es más difícil de ver porque la pieza funciona perfecto. Para todo componente que REACCIONA a
un estado del mundo, la checklist de alcanzabilidad tiene dos mitades: ¿puede el jugador conseguir la
pieza? y ¿puede el jugador PRODUCIR la condición que la activa? La segunda hay que verificarla contra el
contenido del capítulo, no contra el catálogo.

**Patrón 90 — Un predicado sobre una capa del motor hereda las restricciones de esa capa** (14b-1, ronda
1). El sensor filtra por tag `TOX`/`CORR`, que es la condición que el diseño pedía, pero lee de
`atmosphere.gases` — y ahí solo entra lo que está en estado GASEOSO. Casi todos los TOX/CORR del catálogo
son líquidos a temperatura ambiente (ácido 110 °C, desinfectante 78, bromo 59): se derraman al piso y
nunca llegan al aire, así que el predicado real era "TOX/CORR **y gaseoso**" y nadie lo había escrito. Al
elegir la condición de disparo de un sensor, enumerar qué del catálogo la cumple DE VERDAD por el canal
que el sensor consume, no por la propiedad que se está filtrando.

**Patrón 91 — Arreglar un caso tres veces seguidas es la señal de que faltaba anclar la CLASE** (14b-1,
auto-revisión de cierre). 14a-1 le dio `footprint` al sensor térmico, 14b-1 al químico, y al pasar el
checklist aparecieron el de movimiento y el de presión/gas rotos igual, con sus `triggerType` simulados
desde 13g y 11h. Cada arreglo puntual había sido correcto y ninguno había preguntado "¿a quién más le
pasa esto?". La salida no fue un quinto parche sino un test que recorre el registro y falla si alguna
pieza con un `triggerType` simulado no declara `footprint`, con la única excepción de diseño documentada
en el propio test. Cuando el mismo arreglo aparece por tercera vez, el entregable deja de ser el arreglo y
pasa a ser el invariante que lo hace imposible.

**Patrón 92 — Un test que inyecta el estímulo directo no puede ver que el estímulo es inalcanzable**
(14b-1, ronda 1). El test de integración inyectaba amoníaco en la sección y pasaba en verde: amoníaco es
TOX y gaseoso, así que el sensor disparaba. Pero el jugador no tiene forma de conseguir amoníaco. Es el
eje 9 aplicado a los DATOS y no a las dependencias: un test de integración que construye su propio mundo
demuestra que el mecanismo funciona, nunca que el contenido lo habilita. Las dos cosas necesitan tests
distintos, y el de contenido tiene que derivar del catálogo y del stock reales.
