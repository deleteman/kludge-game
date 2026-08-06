# Game Design Document — "Kludge" (título de trabajo)

## 1. Visión general

Un juego de gestión de crisis en tiempo real con pausa táctica, ambientado a bordo de una nave espacial, donde el jugador no dispone de "power-ups" ni objetos mágicos: dispone de **la propia nave**. Cada sistema (eléctrico, fluidos, estructural, señales) es un conjunto de componentes físicos reales que pueden desmontarse, reconectarse y recombinarse para resolver problemas para los que nunca fueron diseñados.

**Elevator pitch:** *Apollo 13 + Oxygen Not Included + Baba Is You*, donde la "redstone" es la propia nave.

## 2. Pilares de diseño

1. **MacGyverismo de sistemas** — nunca hay una pieza nueva que resuelve el problema; hay piezas existentes reutilizadas.
2. **Consecuencias permanentes** — toda solución improvisada deja una cicatriz (recurso perdido, sistema degradado).
3. **Reglas físicas consistentes y predecibles** — el jugador debe poder anticipar el resultado de una combinación nueva porque entendió la regla, no porque el juego se lo dijo.
4. **Emergencia sobre recetas** — el diseño no lista combos válidos; las combinaciones emergen de propiedades compartidas.
5. **Legibilidad visual total** — toda la complejidad del sistema debe ser visible e interactuable directamente sobre el plano de la nave.

## 3. Modos de juego

### 3.1 Campaña
Progresión fija de crisis diseñadas a mano, dificultad ascendente, con meta-progresión entre partidas (desbloqueos permanentes: nuevos componentes, arquetipos adicionales, tripulantes especializados). Permadeath de tripulación individual; la nave puede perderse (game over) si sistemas críticos colapsan sin solución a tiempo.

### 3.2 Creativo
Recursos y componentes desbloqueados sin restricción, sin cicatrices permanentes (toggleable), con modo de simulación de crisis bajo demanda para probar construcciones. Exportación/importación de blueprints como archivo local (JSON), compartible manualmente entre jugadores.

No hay meta-progresión en este modo — es un sandbox puro.

## 4. Core Loop (Campaña)

El juego opera en dos modos alternables en cualquier momento: **planificación** (pausa) y **ejecución** (tiempo real).

1. Crisis se dispara (evento único o combinación de 2-3 fallos simultáneos).
2. **Modo planificación** (pausa total del reloj de simulación — nada reacciona, ninguna reacción química avanza, ningún fuego se propaga): el jugador evalúa el plano de la nave por capas, identifica componentes y propiedades relevantes, y **encola una secuencia de tareas por tripulante** (ej: ir a la sección X → desmontar componente Y → transportarlo a la mesa de creación → combinarlo → reinstalarlo → conectar). Cada tarea tiene una duración estimada, no es instantánea.
3. El jugador puede construir colas en paralelo para varios tripulantes a la vez antes de reanudar, y puede **vincular una tarea de un tripulante como dependiente de la tarea de otro** (ej: la tarea del médico "usar pieza X" espera a que la tarea del ingeniero "desmontar componente Y" termine). El tripulante dependiente espera en su sitio (visualmente, en animación de espera) hasta que la dependencia se cumple.
4. Al pulsar "play", **todas las colas se ejecutan simultáneamente en tiempo real**: el jugador observa el desarrollo visualmente (sistema de partículas, reacciones, sobrecargas) mientras la crisis avanza en paralelo.
5. **El jugador puede volver a pausar en cualquier momento**, no solo al completarse una cola — es la única forma de reaccionar a una consecuencia inesperada (reacción química descontrolada, tripulante herido, enemigo nuevo) y replanificar: cancelar tareas pendientes, redirigir un tripulante a mitad de cola, o iniciar una nueva línea de acción.
6. Resolución: la solución funciona, falla parcialmente, o genera un nuevo problema derivado — visible en tiempo real, no como resultado calculado tras un fundido a negro.
7. Consecuencia permanente se registra (sistema degradado, recurso perdido, tripulante herido/muerto).
8. Siguiente crisis, con la nave ya modificada por decisiones anteriores.

**Implicaciones para el motor**: las tareas encoladas necesitan tiempo de ejecución estimable (no instantáneo), soporte para cancelación/interrupción a mitad de tarea, y un **grafo de dependencias entre tareas de distintos tripulantes** en vez de colas puramente lineales — cada tarea puede declarar "espera a: [tarea X de tripulante Y]". El motor debe rechazar dependencias circulares al momento de encolar (A espera a B, B espera a A), y si una tarea de la que otra depende se cancela o falla, la dependiente debe marcarse como bloqueada y notificar al jugador al repausar.

## 5. Sistema de propiedades (motor del juego)

### 5.1 Propiedades funcionales
Determinan qué "hace" un componente en el grafo de sistemas.

| Propiedad | Función | Atributos |
|---|---|---|
| Emisor de señal | Genera pulso ante un trigger | rango, tipo de trigger, frecuencia |
| Receptor de señal | Reacciona a un pulso recibido | umbral, delay de respuesta |
| Actuador | Convierte energía en trabajo físico | potencia, cadencia, direccionable sí/no |
| Reservorio + flujo | Almacena y libera un recurso (eléctrico/gas/líquido/térmico) | capacidad, tasa de descarga, tipo de recurso |
| Conductor/aislante | Transmite o bloquea recurso entre nodos | capacidad máxima, tipo de recurso soportado |
| Estructura/soporte | Da rigidez, anclaje o rango de movimiento a otra pieza | resistencia a daño, rango si es articulado |
| Aparato de fabricación | Habilita la mesa de creación en un dominio concreto | dominio (física = ensamblar piezas / química = sintetizar sustancias) |

**Sub-categoría conceptual — "aparato de fabricación" (`FAB`, Subfase 13e).** A diferencia del resto, `FAB` es una propiedad de HABILITACIÓN, no de trabajo: la pieza no produce ningún efecto físico por sí misma, solo declara que desde ella se puede abrir la mesa de creación. Por eso no se modela como `ACT` (que convierte energía en trabajo) — misma clase de aclaración semántica que se hizo en 11h con el Indicador LED y la Pantalla LCD dentro de `REC`.

Existe como propiedad y no como una lista de componentes concretos por el Pilar de emergencia: cualquier pieza que declare `FAB` habilita su mesa, sin que el motor conozca ningún id de catálogo. Las dos piezas que la declaran hoy son el **Banco de trabajo** (`FAB(física)`) y la **Estación química** (`FAB(química)`), sembradas en los 4 arquetipos — la mesa dejó de ser un botón siempre disponible y pasa a abrirse desde el aparato, con su menú contextual ("Fabricar" / "Fabricar sustancias" + "Desmontar").

### 5.2 Propiedades de material (capa física, ortogonal a la funcional)

| Propiedad | Efecto |
|---|---|
| Conductividad eléctrica | Determina si un material puede portar corriente (y con qué pérdida/riesgo), variable con temperatura |
| Conductividad térmica | Determina velocidad de transferencia de calor / aislamiento |
| Magnetismo/ferromagnetismo | Permite generar campos magnéticos al combinar conductor enrollado + corriente + núcleo ferromagnético |
| Resistencia estructural | Punto de fallo ante tensión, calor o presión |
| Estado (sólido/líquido/gas) | Determina si algo puede fluir, sellarse, comprimirse o congelarse/fundirse |

Valores en escala simple (bajo/medio/alto), no numérica realista, para mantener predictibilidad sin volverse simulación de física dura.

### 5.3 Propiedades químicas (tercera capa, ortogonal a funcional y material)

Aplica a **sustancias**, entidades independientes de los objetos que las contienen (ver 5.4). Cada sustancia tiene 1-3 tags químicos, no valores numéricos exactos, siguiendo el mismo principio de predictibilidad que la capa de material.

| Propiedad | Efecto |
|---|---|
| Reactividad (tag: oxidante / combustible / ácido / base / inerte) | Determina si reacciona al contacto con otra sustancia y cómo |
| Volatilidad/inflamabilidad | Probabilidad de ignición ante calor o chispa |
| Toxicidad | Incapacitación o daño progresivo a tripulantes expuestos, según concentración |
| Corrosividad | Degrada estructura, conductores, tejido orgánico (tripulantes) y puede reaccionar con otras sustancias químicas al contacto, no solo con materiales inertes |

**Reglas de reacción genéricas (no combos hardcodeados, se aplican por combinación de tags):**
- Ácido + base → neutralización, libera calor. Resultado: **"Solución neutralizada"** (inerte).
- Oxidante + combustible + fuente de ignición → explosión/combustión, **modulada por la concentración de oxígeno ambiental de la sección** (ver detalle en 5.5): imposible en vacío, débil en atmósfera pobre, violenta en atmósfera enriquecida. Resultado: **"Residuo de combustión"** (inerte, con humo/gas como subproducto).
- Tóxico + espacio sellado sin ventilación → incapacitación de área.
- Corrosivo + conductor/estructura expuesta prolongadamente → fallo estructural o cortocircuito derivado.
- Corrosivo + tripulante expuesto → daño progresivo directo (quemadura química), independiente de toxicidad; exposición prolongada o alta concentración puede ser letal.
- Corrosivo + otra sustancia química (no solo materiales inertes) → puede disolverla, neutralizarla o generar un subproducto nuevo. Resultado por defecto: **"Gas tóxico derivado"**.
- Volátil + regulador térmico sobrecargado → riesgo de ignición espontánea.

Estas reglas se combinan con las de material (ej: un ácido en estado líquido puede conducir electricidad además de corroer) y con las funcionales (un reservorio sigue siendo reservorio+flujo; lo que cambia es qué sustancia contiene).

**Resolución de identidad al mezclar sustancias**: cuando dos o más sustancias entran en contacto, el motor determina el resultado en este orden de prioridad:
1. **Receta nombrada** (5.4.2): si la combinación coincide exactamente con un compuesto ya definido, se usa su nombre y propiedades tal cual (ej: Hidrógeno+Oxígeno → Agua).
2. **Regla de reacción por tags** (lista anterior): si no hay receta nombrada pero los tags disparan una regla conocida, el resultado usa un **nombre genérico fijo por tipo de regla**, no ad-hoc — toda neutralización ácido+base produce "Solución neutralizada" (inerte); todo oxidante+combustible+ignición produce "Residuo de combustión" (inerte, con humo/gas como subproducto); todo corrosivo+orgánico produce "Gas tóxico derivado" — el nombre depende de qué regla se disparó, no de qué sustancias específicas la originaron.
3. **Sin receta ni regla conocida**: la mezcla no queda indefinida — se convierte en una **"Mezcla sin identificar"**, con propiedades iguales a la unión de los tags de sus componentes (sin cancelarse) y un nombre generado por plantilla a partir de sus tags dominantes (ej: "Mezcla inestable (Volátil, Corrosiva)"). Esto es intencional: el jugador puede sintetizar algo que el juego nunca nombró explícitamente, coherente con el pilar de diseño 4.

### 5.4 Catálogo de sustancias

Las sustancias son entidades propias, independientes del objeto físico que las contiene o transporta (tanque, tubería, o simplemente el aire de una sección). Un mismo tipo de sustancia se comporta igual esté en un reservorio, derramada en el suelo, o difundida en la atmósfera de una sala.

#### 5.4.1 Elementos base (nivel atómico químico)

Igual que con los componentes físicos (7.1), la química tiene su propio nivel atómico: elementos que no pueden descomponerse más, solo combinarse. Usan nombres reales (para que el jugador tenga intuición gratuita) con tags de gameplay simplificados, no propiedades químicas reales exactas. Son más escasos que las sustancias ya mezcladas de 5.4.3 — se obtienen extrayéndolos de equipamiento (ej: centrífuga de Investigación) o de depósitos limitados, y se usan en la mesa de creación para sintetizar sustancias nuevas que la nave no tenía de inicio.

| Elemento | Tags de gameplay |
|---|---|
| Hidrógeno | `COMB`, `VOLAT` (gas ligero) |
| Oxígeno | `OXI` |
| Nitrógeno | `INERTE` (gas) |
| Carbono | `COMB` (sólido) |
| Cloro | `TOX(M)`, `CORR(M)` (gas) |
| Sodio | Reactivo violento al contacto con agua |
| Potasio | Reactivo violento al contacto con agua (más intenso que sodio) |
| Hierro | MAG-Sí, CE-M, estructural |
| Cobre | CE-A (conductor eléctrico alto) |
| Aluminio | RE-M, ligero, CE-M |
| Azufre | `COMB` (produce gas tóxico al arder) |
| Fósforo | `VOLAT` (autoignición) |
| Flúor | `CORR(A)`, `TOX(A)` |
| Helio | `INERTE` (gas, buen aislante) |
| Neón | `INERTE` (gas) |
| Argón | `INERTE` (gas) |
| Silicio | Base de componentes electrónicos (`REC`) |
| Calcio | Estructural, reactivo con ácidos |
| Magnesio | `COMB` (arde con luz intensa) |
| Plomo | RE-A, denso, aislante de radiación |
| Zinc | CE-M, anticorrosivo |
| Níquel | MAG-Sí, resistente a corrosión |
| Platino | Catalizador (acelera reacciones sin consumirse) |
| Litio | `RES(E)` alta densidad energética, reactivo con agua/aire |
| Yodo | Desinfectante leve, `TOX(B)` |
| Bromo | `CORR(M)`, `TOX(M)` (líquido) |
| Xenón | `INERTE` (gas, ionizable — propulsión) |
| Titanio | RE-A, ligero, resistente a corrosión, alto punto de fusión |

#### 5.4.2 Compuestos derivados (ejemplos de recetas elemento→sustancia)

No es una lista exhaustiva de todas las combinaciones posibles (ver pendientes, sección 17) — son ejemplos que validan que el modelo funciona y que ya generan interacciones interesantes por sí solos.

| Compuesto | Receta | Resultado |
|---|---|---|
| Agua | Hidrógeno + Oxígeno | `INERTE`, líquido, extingue fuego — pero reacciona violentamente si contacta sodio, potasio o litio |
| Sal común | Sodio + Cloro | `INERTE` — neutraliza dos elementos peligrosos en uno seguro |
| Ácido clorhídrico | Hidrógeno + Cloro | `ACID`, `CORR(A)` |
| Dióxido de carbono | Carbono + Oxígeno | `INERTE` (gas), asfixiante en alta concentración, también apaga fuego al desplazar oxígeno |
| Amoníaco | Nitrógeno + Hidrógeno | `TOX(M)` (gas) |
| Óxido de hierro (herrumbre) | Hierro + Oxígeno | Producto de corrosión lenta — degrada RE del hierro expuesto con el tiempo |
| Peróxido | Hidrógeno + Oxígeno (proporción distinta al agua) | `OXI` fuerte — desinfectante potente u oxidante de reacción |
| Óxido de magnesio | Magnesio + Oxígeno | Producto de combustión de magnesio — luz/calor intenso, base de una bengala improvisada |
| Acero | Hierro + Carbono | RE-A — estructura reforzada, mejor que hierro puro |
| Latón | Cobre + Zinc | CE-M, RE-M — conductor y estructural a la vez |

#### 5.4.3 Sustancias funcionales pre-mezcladas (disponibles de inicio en el equipamiento de cada nave)

| Sustancia | Estado | Tags químicos | Notas |
|---|---|---|---|
| Oxígeno | Gas | `OXI` | Componente vital de la atmósfera respirable; también acelera combustión |
| Nitrógeno | Gas | `INERTE` | Relleno atmosférico estándar |
| Dióxido de carbono (CO2) | Gas | `INERTE` (pero asfixiante en alta concentración → efecto `TOX` indirecto) | Producto de respiración/combustión |
| Agua | Líquido | `INERTE` | CE-M (conduce con pérdida), CT-M |
| Nitrógeno líquido | Líquido/temperatura extrema | `INERTE` | CT-A frío; cambia de estado fácilmente (se evapora a gas) |
| Refrigerante sintético | Líquido | `INERTE` | CT-A |
| Combustible de motor | Líquido | `COMB`, `VOLAT` | |
| Ácido de batería | Líquido | `ACID`, `CORR(A)` | CE-M |
| Ácido de laboratorio | Líquido | `ACID`, `CORR(M)` | |
| Base de laboratorio | Líquido | `BASE` | Neutraliza ácidos |
| Disolvente volátil | Líquido | `VOLAT`, `COMB` | |
| Anestésico médico | Gas | `TOX(controlado)` | Dosis baja = sedante, alta = letal |
| Desinfectante | Líquido | `CORR(B)` | |
| Propelente/oxidante de munición | Líquido/sólido | `OXI`, `COMB` | |

Los componentes tipo `RES(tipo)` en las tablas de arquetipo (sección 7) ya no llevan tags químicos directamente — indican **qué sustancia contienen** por defecto, referenciando este catálogo. El jugador puede vaciar, mezclar o sustituir el contenido de un reservorio compatible.

### 5.5 Sistema de atmósfera

Cada sección de la nave tiene su propia composición atmosférica: % de oxígeno, nitrógeno, CO2, y cualquier contaminante presente (tóxico, corrosivo volatilizado), además de temperatura y presión.

- **Modelo híbrido por ventilación**: las secciones no son compartimentos aislados por defecto — están conectadas por conductos de ventilación (`COND(G)`), y los gases se difunden/equilibran gradualmente entre secciones conectadas, a una velocidad determinada por la apertura de la válvula del conducto.
- **Aislamiento deliberado**: cerrar una válvula de ventilación o sellar una puerta (`EST` sellado) corta esa difusión, permitiendo aislar una sección (para contener una fuga, o para privarla de oxígeno a propósito).
- **Consecuencia de cicatriz**: una sección despresurizada o contaminada permanece así hasta reparación activa — no se autorregula sola con el tiempo salvo que el jugador reconecte ventilación limpia.
- Esto es lo que hace funcionar de verdad el caso "reconducir oxígeno para ahogar atacantes" (sección 9): no es vaciar un tanque, es manipular el balance de difusión entre secciones para drenar oxígeno de una sala específica.

**Combustión dependiente de la atmósfera**: la inflamabilidad de un material o sustancia (tag `VOLAT`/`COMB`, sección 5.3) no es un valor fijo — se evalúa contra la concentración de oxígeno de la sección donde ocurre, no solo contra la presencia de una fuente de ignición.

| Concentración de O2 en la sección | Efecto sobre combustión |
|---|---|
| 0% (vacío o atmósfera inerte total) | Combustión imposible, sin importar fuente de ignición ni combustible presente |
| Baja (sección parcialmente drenada) | Ignición difícil, fuego débil que tiende a autoextinguirse |
| Normal (composición estándar de la nave) | Comportamiento estándar según los tags de la sustancia/material |
| Alta (sección enriquecida artificialmente con oxígeno) | Ignición mucho más fácil y violenta; incluso materiales normalmente poco inflamables pueden arder |

Esto abre soluciones de doble filo consistentes con el resto del sistema: el jugador puede **extinguir un incendio sin agua ni extintor**, simplemente drenando el oxígeno de la sección afectada (aislando ventilación); o, a la inversa, **enriquecer deliberadamente una sección con oxígeno** para garantizar que una chispa mínima provoque un incendio o explosión — la misma mecánica de atmósfera, usada como herramienta de contención o como arma, según la intención del jugador.

### 5.6 Reglas de interacción (no son componentes, son comportamientos emergentes)

- **Combinación de señales**: múltiples emisores a un receptor se comportan como AND/OR/NOT según cómo se conectan (en paralelo, en serie, con inversor).
- **Memoria (latch)**: un receptor puede retroalimentar su propia salida como input, reteniendo un estado aunque cese el trigger original. Requiere reset manual o condición explícita.
- **Temporización**: delay de propagación variable según material del conductor; permite construir relojes/osciladores.
- **Cambio de estado por temperatura**: líquido → sólido detiene flujo; sólido → gas puede generar presión/expansión.
- **Sobrecarga**: exceder capacidad máxima de un conductor/reservorio provoca fallo (corte, incendio, explosión según tipo de recurso).

## 6. Tripulación

Los tripulantes no son decorativos: son el "actuador humano" necesario para ejecutar cualquier solución.

### 6.1 Rol mecánico
- **Especialidades** (no stats numéricas extensas): Ingeniero, Médico, Piloto, Seguridad. Cada una desbloquea/facilita ciertas combinaciones (ej: el ingeniero puede forzar un conductor más allá de su límite con menor riesgo de fallo catastrófico; el médico puede manipular contenedores de fluido biológico o químico sin repercusión; seguridad reduce riesgo al manejar sustancias tóxicas o volátiles).
- **Cuello de botella físico**: un tripulante solo puede estar en un lugar; soluciones que requieren acción simultánea en dos secciones exigen coordinar a más de una persona.
- **Vulnerabilidad**: los tripulantes están sujetos a las mismas reglas físicas y químicas que el jugador manipula (pueden electrocutarse, asfixiarse, quemarse, intoxicarse) — incluso por soluciones que el propio jugador construyó.
- **Permadeath individual**: la muerte de un tripulante es permanente dentro de la partida de campaña; afecta disponibilidad de especialidades para el resto de la run.

### 6.2 Selección pre-misión
Antes de cada misión/crisis de campaña, el jugador elige su tripulación activa de un roster disponible, limitado por la capacidad del arquetipo de nave. Esta decisión es táctica: llevar más especialistas de un tipo facilita ciertas soluciones pero deja huecos en otras áreas.

### 6.3 Tiers de especialista
Cada rol tiene tres niveles — Novato / Veterano / Experto — que modifican velocidad de ejecución y margen de riesgo al operar componentes de su especialidad (ej: un ingeniero experto tiene mucho menor probabilidad de fallo catastrófico al forzar un conductor al límite que uno novato).

### 6.4 Progresión y desbloqueo
- **Por hitos de campaña**: completar capítulos desbloquea nuevos especialistas disponibles en el roster (tiers más altos, nuevas especialidades).
- **Por logros de estilo de juego**: acciones específicas (resolver una crisis sin bajas, improvisar una solución puramente química, sobrevivir una crisis avanzada sin dañar estructura) desbloquean **tripulantes nombrados** con una pasiva única, no solo un tier más alto — premiando directamente el estilo de improvisación característico del juego, no solo el avance lineal.
- La progresión de tripulación aplica solo a campaña (ver sección 3.1); el modo creativo no tiene restricciones de roster.

### 6.5 Pérdida de material al desmontar

Desmontar un componente compuesto hasta sus piezas atómicas (ver 7.1) no es 100% reversible: el tier del especialista determina qué porcentaje de las piezas atómicas se recupera intactas.

| Tier | Recuperación aproximada | Nota |
|---|---|---|
| Novato | ~60% de los átomos | Alto riesgo de dañar piezas frágiles en el proceso |
| Veterano | ~80% de los átomos | |
| Experto | ~90-95% de los átomos | Rara vez pierde algo salvo piezas ya dañadas previamente |

La resistencia estructural (`RE`) del compuesto original también influye: un compuesto con `RE` baja tiene mayor probabilidad de perder piezas frágiles (lentes, chips) sin importar el tier del especialista. Esto refuerza el pilar de diseño 2 (consecuencias permanentes): incluso desmontar con cuidado tiene un coste esperado, no solo tiempo.

### 6.6 Efecto mecánico exacto por especialidad

Cualquier tripulante puede intentar cualquier tarea (no hay bloqueo duro por rol), pero cada especialidad tiene **propiedades de afinidad** donde recibe bonus reales; fuera de su afinidad, ejecuta la tarea con normalidad pero sin los bonus, y con una penalización de tiempo fija. Los porcentajes escalan por tier (Novato/Veterano/Experto, sección 6.3).

**Regla general fuera de afinidad**: +20% de tiempo de ejecución, sin reducción de riesgo, independientemente del tier.

| Especialidad | Afinidad (propiedades) | Efecto mecánico (N/V/E) |
|---|---|---|
| **Ingeniero** | `ACT`, `COND`, `RES(E)`, propiedades de material (CE, CT, RE, MAG) | Reduce riesgo de fallo catastrófico al forzar un conductor/reservorio más allá de su límite: −15% / −30% / −50% sobre la probabilidad base de fallo. Reduce duración de tareas de desmontaje/instalación/reconexión: ×0.9 / ×0.75 / ×0.6. Mejora la recuperación atómica al desmontar (6.5) en +10% adicional sobre el valor base de su tier. |
| **Médico** | Sustancias (5.3/5.4), reservorios biológicos/químicos sensibles, tripulantes heridos | Reduce riesgo de daño accidental al manipular sustancias tóxicas/corrosivas: −15% / −30% / −50%. Reduce duración de tareas de estabilización/curación de tripulantes: ×0.85 / ×0.65 / ×0.45. Identifica la composición de una sustancia desconocida más rápido (relevante al sintetizar en la mesa de creación, 5.4.2). |
| **Piloto** | Actuadores de propulsión/navegación de la nave, maniobras evasivas, sensores/comunicación de largo alcance | Reduce tiempo de reacción y mejora precisión en maniobras evasivas ante amenazas externas: −20% / −40% / −60% sobre tiempo de reacción base. Reduce consumo de combustible/energía en actuadores de propulsión: −10% / −20% / −35%. |
| **Seguridad** | Actuadores de arma (`ACT` alta potencia), contención de amenazas, sustancias volátiles/tóxicas en contexto de combate | Reduce tiempo de apuntado/disparo de actuadores de arma: −15% / −30% / −45%. Reduce riesgo al manejar sustancias volátiles/tóxicas en combate (distinto del contexto médico): −15% / −30% / −50%. Reduce probabilidad de sufrir daño propio al ejecutar tareas de riesgo: −10% / −20% / −35%. |

**Nota sobre 6.5**: los porcentajes de recuperación atómica al desmontar (60/80/90-95% por tier) asumen que la tarea la ejecuta el Ingeniero, su especialidad afín. Otra especialidad desmontando aplica la regla general fuera de afinidad (+20% tiempo, sin el bonus adicional de +10% recuperación), pero mantiene el porcentaje base de su tier — desmontar no está bloqueado para nadie, solo es más lento y menos eficiente fuera de su afinidad.

### 6.7 Personalidad de tripulantes

Dado el nivel visual minimalista de los tripulantes (estilo Among Us o más simple), la personalidad vive casi enteramente en texto y en partículas, no en animación facial.

- **Rasgo único por tripulante** (5 rasgos base): Estoico, Ansioso, Sarcástico, Temerario, Disciplinado. Cada uno tiene un banco corto de frases (3-5 líneas) por tipo de evento — asignación de tarea peligrosa, éxito, fallo, muerte de un compañero, uso de una sustancia inestable — y puede afectar levemente el comportamiento (el Temerario acepta tareas de riesgo sin dudar; el Ansioso tarda algo más en ejecutar bajo presión; el Disciplinado tiene menor probabilidad de fallo al desmontar bajo estrés).
- Los tripulantes nombrados desbloqueados por logros (6.4) combinan su pasiva mecánica con un rasgo de personalidad fijo, reforzando que se sientan como personajes reconocibles, no solo stats.

**Tono**: humor negro/sarcástico con tensión real de fondo (estilo FTL) — el chiste no le quita peso a la crisis, es cómo el personaje la procesa.

#### 6.7.1 Banco de frases por rasgo × evento

**Estoico** (lacónico, sin dramatismo, comentarios secos)
- Inicio de crisis: "Otra vez." / "Ya lo he visto antes. Sigue siendo malo."
- Tarea peligrosa: "Entendido." / "Si no vuelvo, quédate con mis herramientas."
- Éxito: "Hecho." / "Como estaba previsto. Más o menos."
- Fallo: "No ha funcionado. Siguiente idea." / "Anotado. No lo repetiré."
- Muerte de compañero: "Descanse." / "Habrá tiempo para esto después. Ahora no."
- Sustancia inestable: "Esto podría matarme. Empezando." / "Cero margen de error. Como siempre."
- Herida grave propia: "He tenido peores días. Creo." / "Sigo de pie. Por ahora."

**Ansioso** (nervioso, humor como mecanismo de defensa)
- Inicio de crisis: "¿Otra vez esto? ¿En serio? Vale, vale, respirando." / "¿Por qué siempre me toca a mí estar despierto cuando pasa esto?"
- Tarea peligrosa: "¿Yo? ¿Por qué yo? Vale, voy, voy." / "Si esto sale mal, que conste que lo dije."
- Éxito: "¡No puedo creer que haya funcionado! ¡No preguntéis cómo!" / "Vale. VALE. Sigo vivo. Genial."
- Fallo: "Sabía que esto iba a pasar. Lo sabía." / "No ha sido culpa mía. Bueno, un poco sí."
- Muerte de compañero: "No, no, no, esto no está pasando." / "¿Quién es el siguiente? Necesito saberlo. No, no quiero saberlo."
- Sustancia inestable: "Esto es una pésima idea y la voy a hacer igual." / "Si explota, decidle a mi familia que los quería. Y que tenían razón."
- Herida grave propia: "Estoy bien. ESTOY BIEN. Alguien que me mire esto." / "No es tan grave. Es bastante grave. No es tan grave."

**Sarcástico** (ironía constante, deliberada)
- Inicio de crisis: "Justo lo que necesitaba esta nave: más personalidad." / "Ah, genial, otra oportunidad de morir de forma creativa."
- Tarea peligrosa: "Claro, mándame a mí a la sección que se está quemando. Encaja con mi suerte." / "Voy. Alguien tiene que hacer que esto parezca fácil."
- Éxito: "Sorprendentemente, no he muerto. Diez de diez." / "Funcionó. Guardadlo en el manual, porque nadie se lo va a creer."
- Fallo: "Bueno, eso ha sido humillante." / "Anotad esto en mi expediente: 'lo intentó'."
- Muerte de compañero: "Odio tener razón sobre esta nave." / "Guardaos los chistes por hoy. Solo por hoy."
- Sustancia inestable: "¿Qué podría salir mal mezclando dos cosas que dicen 'peligro' en la etiqueta?" / "Si me convierto en gas verde, decidle a la nave que la odiaba."
- Herida grave propia: "He estado mejor. También he estado peor, pero no me acuerdo cuándo." / "Esto va a dejar una cicatriz genial para contar la historia."

**Temerario** (bravuconería, casi coquetea con el riesgo)
- Inicio de crisis: "¡Por fin algo interesante!" / "Vale, esto sí que promete."
- Tarea peligrosa: "Dame la tarea más loca que tengas." / "¿Peligroso? Mejor. Me aburría."
- Éxito: "¡Os dije que funcionaría! Más o menos os lo dije." / "Fácil. Siguiente reto."
- Fallo: "Vale, eso ha sido más peligroso de lo que pensaba. Otra vez." / "Solo ha sido un pequeño fallo de cálculo. Y de todo lo demás."
- Muerte de compañero: "No voy a fingir que esto me asusta. Pero duele." / "Esto se lo debemos. Vamos a terminarlo."
- Sustancia inestable: "Mézclalo todo. Veamos qué pasa." / "Si esto sale bien, es una historia genial. Si sale mal, también."
- Herida grave propia: "Esto ni siquiera cuenta como herida grave." / "Solo necesito un minuto. Y quizás un brazo nuevo."

**Disciplinado** (profesional, ironía contenida)
- Inicio de crisis: "Protocolo estándar. Nos movemos." / "Ya hemos entrenado para esto. Toca demostrarlo."
- Tarea peligrosa: "Entendido. Ejecutando con margen de seguridad." / "Riesgo asumido, procedimiento claro. Voy."
- Éxito: "Ejecución limpia. Como debe ser." / "Resultado dentro de parámetros. Seguimos."
- Fallo: "Fallo registrado. Ajustando el procedimiento." / "No ha salido según el plan. Plan B."
- Muerte de compañero: "Lo lamentaremos después del turno. Ahora hay trabajo." / "Se merece que terminemos esto bien hecho."
- Sustancia inestable: "Procedimiento de riesgo alto iniciado. Todos atrás." / "Esto requiere precisión, no valentía. Dadme espacio."
- Herida grave propia: "Herida registrada. Sigo operativo." / "Puedo continuar. Informaré si eso cambia."

#### 6.8 Árbol de logros de tripulación

Cada logro premia un estilo de improvisación específico (no progreso lineal) y desbloquea un tripulante nombrado con especialidad, rasgo de personalidad y una pasiva única, más allá de los bonus genéricos de tier (6.6).

| Logro | Condición | Desbloquea | Especialidad / Rasgo | Pasiva única |
|---|---|---|---|---|
| Cero bajas | Completar una crisis sin perder ningún tripulante | Amara Osei | Médico / Disciplinado | −20% adicional en tiempo de estabilización, sobre el bonus de tier |
| Química pura | Resolver una crisis usando solo síntesis/reacciones químicas, sin actuadores de arma | Priya Chandrasekaran | Ingeniero / Sarcástico | −25% tiempo de síntesis de compuestos en la mesa de creación (5.4.2) |
| Estructura intacta | Sobrevivir una crisis de nivel avanzado sin que ningún componente pierda resistencia estructural | Magnus Eriksson | Seguridad / Estoico | −25% probabilidad de daño estructural colateral al usar actuadores de alta potencia |
| Vacío perfecto | Resolver una crisis manipulando la atmósfera de una sección (5.5) sin usar ningún arma | Kenji Watanabe | Piloto / Disciplinado | −30% tiempo de manipulación de válvulas de ventilación |
| El reciclador | Desmontar 20 componentes con recuperación atómica superior al 90% (6.5) | Fatima Al-Rashid | Ingeniero / Estoico | +5% adicional de recuperación atómica, acumulable con el bonus de tier |
| Amistad peligrosa | Combinar con éxito dos sustancias inestables (`VOLAT`/`CORR`/`TOX`) sin bajas en la misma crisis | Diego Fernández | Médico / Temerario | −20% riesgo adicional al manipular sustancias reactivas |
| El cirujano de metal | Reparar un componente crítico con menos de 30 segundos restantes en el temporizador de la crisis | Yuki Tanaka | Ingeniero / Ansioso | −20% tiempo adicional en tareas bajo presión de tiempo extremo |
| Superviviente nato | Un mismo tripulante sobrevive 3 crisis consecutivas con heridas graves | *(evento emergente, no un nuevo personaje)* | El propio tripulante afectado | Gana permanentemente −15% probabilidad de sufrir daño en futuras crisis — cicatrices como ventaja narrativa, no solo penalización |

El último logro es deliberadamente distinto a los demás: no desbloquea un personaje nuevo, es una recompensa emergente para un tripulante que ya tenías, reforzando que las historias de la tripulación se construyen jugando, no solo desbloqueando contenido.

**Muertes gráficas reutilizando el sistema de partículas (11.1)**: no se diseña un sistema de muerte aparte — se dispara el mismo efecto de partículas ya definido para el fenómeno causante, aplicado sobre el sprite del tripulante en vez de sobre un componente. Esto mantiene la coherencia visual del principio "dos fenómenos nunca se ven igual" sin duplicar trabajo:

| Causa de muerte | Efecto reutilizado de 11.1 |
|---|---|
| Fuego | Carbonización progresiva + ceniza cayendo, reutilizando el efecto de combustión |
| Corrosión química | Disolución progresiva del sprite, mismo efecto que corrosión sobre estructura |
| Electrocución | Arco eléctrico + colapso rígido, reutilizando el efecto de sobrecarga |
| Frío extremo/congelación | Cristalización azulada progresiva + fragmentación final, reutilizando el efecto de cambio de estado a sólido |
| Explosión | Onda expansiva + desmembramiento estilizado, reutilizando el efecto de explosión |
| Asfixia/vacío | Sin partícula violenta — el sprite pierde color gradualmente y, si es vacío real, flota; refuerza que no toda muerte es espectacular, algunas son silenciosas |
| Envenenamiento/tóxico | Tos, tono verdoso progresivo, colapso lento — reutiliza la lógica de incapacitación por toxicidad ya definida en 5.3 |

## 7. Arquetipos de nave

Cada arquetipo comparte el mismo motor de propiedades; lo que cambia es la abundancia relativa de componentes por categoría, generando soluciones narrativamente distintas ante el mismo problema.

### 7.0 Leyenda de etiquetas

**Funcionales**: `EM` Emisor de señal · `REC` Receptor de señal · `ACT` Actuador · `RES(tipo)` Reservorio+flujo, tipo = E/G/L/T (eléctrico/gas/líquido/térmico) · `COND(tipo)` Conductor · `EST` Estructura/soporte · `FAB(dominio)` Aparato de fabricación, dominio = física/química (5.1)

**Material**: `CE` conductividad eléctrica (A/M/B/N) · `CT` conductividad térmica (A/M/B) · `MAG` ferromagnético (Sí/No) · `RE` resistencia estructural (A/M/B) · `ES` estado (S/L/G)

**Química**: ver catálogo de sustancias (5.4). Los reservorios (`RES`) indican qué sustancia contienen por defecto, no tags químicos propios.

### 7.1 Modelo de niveles: atómico / compuesto / ensamblaje

- **Nivel 0 — Atómicos**: piezas base que no pueden descomponerse más. Catálogo universal, compartido por los 4 arquetipos (7.2).
- **Nivel 1 — Compuestos**: los componentes funcionales con nombre propio (sensor de movimiento, tanque de anestésico, cañón láser). Cada uno tiene una **receta** explícita de qué piezas atómicas lo forman. Al desmontarlos se recuperan piezas atómicas (con pérdida según tier, ver 6.5).
- **Nivel 2 — Ensamblajes complejos**: algunos componentes pre-construidos (ej: torreta automatizada) están hechos de otros compuestos, no directamente de átomos. Desmontar un ensamblaje da compuestos intactos; desmontar esos compuestos a su vez da átomos.

**Implicación de diseño**: reutilizar un compuesto intacto es rápido (ideal bajo presión de tiempo, MacGyverismo clásico); desmontarlo hasta átomos y reconstruir algo distinto es más lento pero permite soluciones a medida. El jugador elige el balance según cuánto tiempo le queda en la crisis — esto es intencional y refuerza el pilar de diseño 3.

### 7.2 Catálogo de componentes atómicos (universal, disponible en los 4 arquetipos)

Cada pieza tiene un tamaño físico (footprint en unidades de grid, mismo grid que el plano y la mesa de creación, ver 10.1) — determina cuánto espacio ocupa al posicionarla, tanto en la mesa como una vez instalada.

| Pieza atómica | Tags | Tamaño |
|---|---|---|
| Plancha metálica | `EST` (panel) — RE-M | 2×2 |
| Tornillería/fijación | `EST` (conector) — RE-B | 1×1 |
| Cable de cobre | `COND(E)` — CE-A | 1×1 |
| Bobina de cobre | `COND(E)` (enrollado; con núcleo ferromagnético + corriente → genera `MAG`) — CE-A | 1×1 |
| Resistencia eléctrica | `COND(E)` con pérdida controlada (limita corriente) | 1×1 |
| Célula fotovoltaica | `RES(E)` pequeña, regenerable — CE-A | 1×2 |
| Batería celda simple | `RES(E)` pequeña, no regenerable — CE-A | 1×1 |
| Chip de circuito genérico | `REC` básico | 1×1 |
| Lente óptica | Componente óptico base (parte de sensores/láseres) | 1×1 |
| Emisor láser de baja potencia | `ACT` mínimo (base de láseres/sensores ópticos) | 1×1 |
| Fotorreceptor | `EM` (trigger=luz/movimiento óptico) | 1×1 |
| Imán permanente | Núcleo ferromagnético — MAG-Sí | 1×1 |
| Tubo rígido | `COND(L/G)` — RE-M | 1×2 |
| Tubo flexible | `COND(L/G)` — RE-B, maleable | 1×2 |
| Junta hermética/goma | Sellado — ES-S, CE-N | 1×1 |
| Válvula simple | `ACT` (abrir/cerrar flujo) | 1×1 |
| Placa disipadora | Regulador térmico — CT-A | 1×2 |
| Placa aislante térmica | CT-B | 1×2 |
| Motor pequeño (servo) | `ACT` (movimiento mecánico básico) | 2×2 |
| Carcasa plástica | `EST` contenedor — CE-N | 2×2 |

Estas piezas existen para que cualquier improvisación tenga un mínimo común denominador disponible en toda nave, y para que desmontar cualquier compuesto tenga un destino claro y reutilizable.

### 7.3 Nave de Investigación
Abundante en: sensores de precisión, computación, calibración fina, sustancias de laboratorio.
Escaso en: potencia bruta, blindaje, actuadores de daño directo.

| Componente (compuesto) | Función | Receta (piezas atómicas) |
|---|---|---|
| Sensor de movimiento láser | `EM` (trigger=movimiento, rango M) | Fotorreceptor + lente óptica + carcasa plástica + cable de cobre |
| Sensor térmico de precisión | `EM` (trigger=temperatura) | Chip genérico + placa disipadora + carcasa plástica |
| Sensor de presión/gas | `EM` (trigger=presión) | Chip genérico + junta hermética + carcasa plástica |
| Brazo robótico de laboratorio | `ACT` fino direccionable + `EST` articulado | Motor pequeño ×2 + plancha metálica + tornillería + cable de cobre |
| Servidor de análisis | `REC`+`EM` (nodo lógico, combina/reemite señales) | Chip genérico ×3 + cable de cobre ×2 + carcasa plástica |
| Escáner de espectro | `EM` (trigger=composición química) | Lente óptica + chip genérico + carcasa plástica |
| Microscopio electrónico | `REC` (analiza, no actúa) | Lente óptica ×2 + chip genérico + carcasa plástica |
| Tanque de muestra criogénica | `RES(T)` — CT-A | Tubo rígido + placa disipadora + junta hermética · *Contiene: Nitrógeno líquido* |
| Dron de reconocimiento | `ACT` (movimiento libre) + `EM` (cámara) | Motor pequeño + fotorreceptor + batería celda simple + carcasa plástica |
| Panel solar de alta eficiencia | `RES(E)` regenerable | Célula fotovoltaica ×3 + cable de cobre + plancha metálica |
| Impresora 3D de piezas | `ACT` (fabrica piezas `EST` a partir de material bruto) | Motor pequeño + chip genérico + plancha metálica + resistencia |
| Cámara de aislamiento | `EST` sellado — RE-A | Plancha metálica ×2 + junta hermética ×2 |
| Centrífuga | `ACT` (separa mezclas/sustancias) | Motor pequeño + carcasa plástica + tubo rígido |
| Cable de fibra óptica | `COND` (solo señal) — CE-N | Lente óptica + carcasa plástica (variante especializada de cable) |
| Sistema de purificación de aire | `ACT`+`REC` (filtra, neutraliza tóxicos leves) | Motor pequeño + chip genérico + tubo flexible + placa aislante |
| Reservorio de reactivo ácido | `RES(L)` | Tubo rígido + junta hermética + válvula simple · *Contiene: Ácido de laboratorio* |
| Reservorio de reactivo base | `RES(L)` | Tubo rígido + junta hermética + válvula simple · *Contiene: Base de laboratorio* |
| Reservorio de disolvente | `RES(L)` | Tubo rígido + junta hermética + válvula simple · *Contiene: Disolvente volátil* |

### 7.4 Nave de Guerra
Abundante en: actuadores de energía, blindaje, redundancia, sustancias explosivas/supresoras.
Escaso en: fluidos médicos, sensores finos.

| Componente (compuesto) | Función | Receta (piezas atómicas) |
|---|---|---|
| Cañón láser | `ACT` alta potencia, direccionable | Emisor láser ×2 + motor pequeño + plancha metálica + cable de cobre ×2 |
| Generador de escudo | `ACT` (campo) + `RES(E)` alto consumo | Bobina de cobre ×3 + imán permanente + plancha metálica |
| Blindaje reactivo | `EST` — RE-A | Plancha metálica ×3 + tornillería ×2 |
| Torreta automatizada *(ensamblaje complejo)* | `EM`+`REC`+`ACT` combinados | Sensor de movimiento (compuesto) + Cañón láser (compuesto) + soporte articulado |
| Reactor de alto amperaje | `RES(E)` gran capacidad, alto riesgo de sobrecarga | Bobina de cobre ×4 + placa disipadora + plancha metálica |
| Compuerta blindada | `EST` + `ACT` (abre/cierra) — RE-A | Plancha metálica ×2 + motor pequeño + tornillería |
| Sistema de comunicación cifrada | `EM`+`REC` (largo alcance) | Chip genérico ×2 + cable de cobre + carcasa plástica |
| Celda de energía de munición | `RES(E)` descarga rápida, alta potencia | Batería celda simple ×2 + resistencia |
| Panel estructural reforzado | `EST` — RE-A | Plancha metálica ×2 + tornillería |
| Extintor militar | `RES(G/L)` supresor (anula `COMB`) | Tubo rígido + válvula simple + carcasa plástica · *Contiene: Nitrógeno (desplaza oxígeno del fuego)* |
| Consola de mando central | `REC` (nodo combinador) | Chip genérico ×3 + cable de cobre ×2 |
| Radar de largo alcance | `EM`+`REC` (amplio, baja precisión) | Fotorreceptor + chip genérico + plancha metálica |
| Motor de propulsión de combate | `ACT` (movimiento nave) | Motor pequeño ×2 (escala mayor) + tubo rígido |
| Reservorio de combustible de motor | `RES(L)` | Tubo rígido + junta hermética + válvula simple · *Contiene: Combustible de motor* |
| Kit médico básico | `RES(L)` limitado | Carcasa plástica + tubo flexible · *Contiene: Anestésico médico (dosis baja)* |
| Cable blindado de alto amperaje | `COND(E)` — CE-A, RE-A | Cable de cobre ×2 + plancha metálica (blindaje) |
| Reservorio de propelente de munición | `RES(L/S)` | Tubo rígido + junta hermética · *Contiene: Propelente/oxidante de munición* |
| Reservorio de ácido de batería | `RES(L)` | Tubo rígido + junta hermética · *Contiene: Ácido de batería* |

### 7.5 Nave de Exploración
Abundante en: almacenamiento, propulsión, autonomía energética.
Escaso en: sensores finos, potencia instantánea.

| Componente (compuesto) | Función | Receta (piezas atómicas) |
|---|---|---|
| Tanque de combustible de largo alcance | `RES(L)` gran capacidad | Tubo rígido ×2 + junta hermética + carcasa plástica · *Contiene: Combustible de motor* |
| Motor de crucero eficiente | `ACT` bajo consumo | Motor pequeño + tubo rígido |
| Panel solar desplegable | `RES(E)` regenerable | Célula fotovoltaica ×4 + plancha metálica |
| Sistema de reciclaje de agua/aire | `ACT`+`REC` (filtra) | Motor pequeño + chip genérico + tubo flexible ×2 |
| Bodega de carga modular | `EST` (almacenamiento, sin propiedad activa) | Plancha metálica ×3 + tornillería |
| Impresora de piezas de repuesto | `ACT` (fabrica `EST`) | Motor pequeño + chip genérico + plancha metálica |
| Traje EVA | `EST` portátil (aísla vacío/temperatura) | Carcasa plástica + placa aislante + junta hermética ×2 |
| Telescopio de largo alcance | `EM` (detección lejana, baja precisión) | Lente óptica ×2 + carcasa plástica |
| Batería de gran capacidad | `RES(E)` alta capacidad, carga/descarga lenta | Batería celda simple ×3 + resistencia |
| Sistema de hibernación | `ACT` (pausa metabolismo de tripulante) | Chip genérico + placa aislante + tubo flexible |
| Sellador de emergencia de casco | `ACT`+`EST` (repara brecha) | Plancha metálica + junta hermética ×2 |
| Radio de largo alcance | `EM`+`REC` | Chip genérico + cable de cobre + carcasa plástica |
| Sistema de navegación estelar | `REC` (computa) | Chip genérico ×2 + cable de cobre |
| Invernadero hidropónico | `RES(L)` agua/nutrientes + `ACT` lento (genera oxígeno) | Tubo flexible ×2 + carcasa plástica + placa disipadora · *Contiene: Agua; genera Oxígeno como subproducto lento* |
| Herramientas de reparación externa | `EST` portátil + `ACT` manual | Plancha metálica + motor pequeño (manual) |
| Reservorio de refrigerante de motor | `RES(L)` | Tubo rígido + junta hermética · *Contiene: Refrigerante sintético* |
| Reservorio de agua reciclada | `RES(L)` | Tubo flexible + junta hermética · *Contiene: Agua* |

### 7.6 Nave Médica
Abundante en: fluidos, precisión, esterilidad, láseres de baja potencia.
Escaso en: estructura reforzada, energía de alto amperaje.

| Componente (compuesto) | Función | Receta (piezas atómicas) |
|---|---|---|
| Láser quirúrgico | `ACT` baja potencia, direccionable + `REC` | Emisor láser + lente óptica + chip genérico + carcasa plástica |
| Tanque de anestésico | `RES(G)` | Tubo rígido + junta hermética + válvula simple · *Contiene: Anestésico médico* |
| Camilla automatizada | `EST`+`ACT` (movimiento controlado) | Motor pequeño + plancha metálica + tornillería |
| Esterilizador UV | `ACT` (calor/luz) + `REC` | Emisor láser (variante UV) + chip genérico + carcasa plástica |
| Sistema de diagnóstico | `REC`+`EM` (biométrico) | Chip genérico ×2 + fotorreceptor + carcasa plástica |
| Banco de sangre/fluidos | `RES(L)` biológico, degradable | Tubo flexible + junta hermética + placa disipadora (refrigerado) · *Contiene: Fluido biológico (categoría especial, ver contenido narrativo)* |
| Brazo robótico quirúrgico | `ACT` fino, direccionable + `EST` articulado | Motor pequeño ×2 + lente óptica + plancha metálica |
| Ventilador mecánico | `ACT` (regula gas) + `RES(G)` conectado | Motor pequeño + tubo flexible + válvula simple · *Contiene: Oxígeno* |
| Sensor biométrico por tripulante | `EM` (trigger=signos vitales) | Chip genérico + fotorreceptor + carcasa plástica (portátil) |
| Farmacia automatizada | `RES(L)` múltiples sustancias + `ACT` dispensador | Motor pequeño + tubo flexible ×3 + carcasa plástica · *Contiene: varias sustancias médicas en compartimentos separados* |
| Cámara de aislamiento biológico | `EST` sellado — RE-M | Plancha metálica + junta hermética ×2 |
| Generador de oxígeno de precisión | `RES(G)`+`ACT` regulador | Motor pequeño + válvula simple + tubo rígido · *Contiene/genera: Oxígeno* |
| Sistema de refrigeración de muestras | `RES(T)` — CT-A | Tubo rígido + placa disipadora + junta hermética |
| Comunicador de emergencia médica | `EM`+`REC` | Chip genérico + cable de cobre + carcasa plástica |
| Batería de respaldo bajo consumo | `RES(E)` pequeña | Batería celda simple + resistencia |
| Reservorio de anestésico concentrado | `RES(G)` | Tubo rígido + junta hermética · *Contiene: Anestésico médico (alta concentración)* |
| Reservorio de desinfectante | `RES(L)` | Tubo flexible + junta hermética · *Contiene: Desinfectante* |
| Reservorio de oxígeno médico concentrado | `RES(G)` | Tubo rígido + junta hermética + válvula simple · *Contiene: Oxígeno (alta concentración)* |

### 7.7 Evaluación de cobertura

**Balance de escasez/abundancia**: cada arquetipo mantiene su perfil declarado — Investigación tiene solo un actuador de daño directo indirecto (brazo/impresora, nada pensado para combate), Guerra apenas tiene un componente de fluidos médicos, Exploración carece de sensores finos (solo detección de largo alcance, baja precisión), Médica no tiene ningún componente de blindaje o energía de alto amperaje. Confirma el pilar de diseño 4 (emergencia sobre recetas): ningún arquetipo tiene "la pieza que resuelve todo", tiene que improvisar con lo que abunda.

**Cobertura de propiedades funcionales**: las 6 propiedades funcionales están representadas en los 4 arquetipos (reforzado además por el catálogo atómico universal de 7.2), aunque con densidad muy distinta — Guerra tiene 5+ actuadores de alta potencia, Investigación solo 2-3 de baja potencia. Esto es intencional y correcto según el pilar de diseño.

**Cobertura de sustancias**: los 4 arquetipos tienen acceso directo a oxígeno (vital, presente en atmósfera y al menos un reservorio dedicado), y al menos una sustancia reactiva (ácido, oxidante o volátil) y una inerte, permitiendo tanto ataque/daño como neutralización/contención en cualquier nave.

**Validación cruzada contra los casos de la sección 9**:
- *Torreta improvisada*: válida en cualquier arquetipo combinando un `EM` de sensor + un `ACT` disponible (potencia varía mucho por nave, lo cual es deseable — la torreta de Guerra es letal, la de Médica es apenas disuasiva).
- *Cortocircuito bahía de carga*: requiere `RES(T)` o sustancia fría — presente en Investigación (tanque criogénico) y Exploración (refrigerante); en Guerra o Médica el jugador tendría que improvisar con otro reservorio frío disponible o resolverlo por otra vía — **gap aceptable**, refuerza que no todas las soluciones están disponibles en todas las naves.
- *Reconducción de oxígeno*: ahora modelado correctamente vía el sistema de atmósfera (5.5) — cualquier nave puede aislar una sección y drenar su oxígeno hacia secciones vecinas manipulando ventilación, sin depender de un tanque específico.
- *El Piano de Emergencia / El Cañón que Aprende*: requieren nodo combinador (`REC`+`EM` — Investigación lo tiene explícito con el servidor de análisis; en otras naves el jugador usaría la consola de mando de Guerra o el sistema de diagnóstico de Médica de forma no evidente) y el chip de identificación de tripulante (componente atómico/común universal, corrigiendo un gap detectado en el diseño original).
- *El Pulmón Compartido*: cubierto en cualquier nave con `RES(G)` + válvulas (`ACT`) + sensores de presencia, y ahora reforzado por el modelo de atmósfera por sección — todas cumplen.
- *La Neutralización de Emergencia*: requiere ácido y base disponibles simultáneamente — actualmente solo Investigación tiene ambas sustancias en reservorio dedicado; en otras naves el jugador necesitaría transportar una sustancia entre secciones — **punto a revisar en playtesting**, puede ser intencional (rareza) o requerir una sustancia base adicional en Guerra/Exploración/Médica.

**Riesgo detectado**: Investigación concentra desproporcionadamente los componentes "nodo lógico" (servidor de análisis) y química dual (ácido+base). Si en playtesting resulta que Investigación resuelve crisis lógicas/químicas con ventaja excesiva frente a los otros 3 arquetipos, considerar redistribuir un componente combinador o una sustancia base a Guerra/Exploración/Médica para equilibrar.

## 8. Generación de crisis

- Crisis de nivel temprano: un solo fallo, una sola propiedad relevante, solución con 2-3 pasos.
- Crisis de nivel medio: combinación de 2 fallos simultáneos o un fallo que involucra 2-3 propiedades distintas (funcional + material).
- Crisis de nivel avanzado: 3-4 fallos encadenados, alguno de ellos causado por una cicatriz de una crisis anterior del jugador (la nave "recuerda" daño previo).
- Dificultad ascendente por capítulo/acto de campaña, incorporando progresivamente: señal simple → combinación de señales → memoria/latch → propiedades de material → material + tiempo (fusibles térmicos, cambios de estado bajo presión).

## 9. Casos de validación de diseño (referencia interna)

1. **Torreta improvisada**: sensor de movimiento + láser médico + brazo articulado + batería → valida combinación funcional básica.
2. **Cortocircuito en bahía de carga**: refrigerante conductor + nitrógeno líquido + panel eléctrico → valida propiedades de material (estado, conductividad variable con temperatura).
3. **Reconducción de oxígeno para ahogar atacantes**: reservorio de gas + actuador de válvula + estructura sellante → valida reservorio+flujo con consecuencia de cicatriz.
4. **El Piano de Emergencia**: 3 sensores + nodo combinador + latch de memoria con prioridad absoluta → valida combinación de señales y memoria.
5. **El Cañón que Aprende**: verificación cruzada (amigo/enemigo) + contador incremental → valida NOT lógico y memoria incremental.
6. **El Pulmón Compartido**: oscilador cíclico + prioridad por presencia + memoria de patrón de uso → valida temporización y memoria de estado a largo plazo.
7. **La Neutralización de Emergencia**: fuga de ácido de batería avanza hacia una sección con tripulación; el jugador mezcla un reservorio de base disponible en el mismo pasillo para neutralizarla antes de que corroa el casco → valida reglas de reacción química (ácido+base) y su cruce con propiedad de corrosividad sobre estructura.
8. **Sofocar sin extintor / Trampa de chispa**: un incendio avanza por un pasillo sin extintor disponible; el jugador aísla la ventilación de la sección y drena su oxígeno hacia una sección vecina, apagando el fuego por asfixia en vez de por enfriamiento. En el caso inverso, el jugador enriquece deliberadamente una sección con oxígeno de un tanque médico antes de que un enemigo la cruce, y provoca una chispa con un cable pelado para detonarla → valida la dependencia de combustión respecto a la concentración atmosférica de oxígeno (5.5).
9. **El Electroimán de Emergencia**: una puerta estanca no cierra por fallo mecánico; el jugador enrolla cable de cobre (pieza atómica, 7.2) alrededor de un núcleo ferromagnético (imán permanente o pieza de hierro) y lo alimenta con corriente para generar un campo magnético que traba la puerta desde el marco, sin usar ningún actuador mecánico dedicado → valida la propiedad de material `MAG` (5.2) y la composición pura desde piezas atómicas sin depender de una propiedad funcional pre-etiquetada como "cierre de puerta".
10. **Fuga de Amoníaco en el Invernadero**: un tanque dañado libera amoníaco (`TOX(M)`) en una sección sellada sin ventilación donde hay tripulación trabajando. A diferencia del Pulmón Compartido (caso 6, sobre falta de oxígeno), aquí el peligro es la acumulación de un gas tóxico específico por encima del umbral de incapacitación → valida el tag `TOX` con sus umbrales concretos de concentración/tiempo (ver Especificación de datos técnicos, sección 1), distinto de la asfixia por falta de O2.
11. **La Detonación Controlada**: una puerta bloqueada por daño estructural no cede a ningún actuador disponible; el jugador enriquece deliberadamente una sección adyacente vacía con combustible y oxidante, y provoca una ignición controlada para volar la puerta desde el otro lado, calculando el radio de la explosión para no dañar a su propia tripulación cercana → valida los parámetros de radio/daño de explosión (Especificación de datos técnicos, sección 1) como herramienta deliberada, no solo como accidente.
12. **Síntesis de un Compuesto Desconocido**: el jugador no tiene la sustancia exacta que necesita, así que extrae elementos base con la centrífuga (7.3) y los combina en la mesa de creación en una proporción que no coincide con ninguna receta nombrada (5.4.2). El motor genera una "Mezcla sin identificar" con las propiedades resultantes de la unión de tags; el jugador la usa igual porque conoce su comportamiento aunque no tenga nombre → valida el catálogo de elementos base (5.4.1) y el modelo completo de resolución de identidad, incluyendo su rama de fallback (5.3).
13. **Doble Amenaza Simultánea**: una fuga combina una sustancia `CORR`+`TOX` a la vez, avanzando hacia una sección donde además hay un oxidante almacenado cerca (riesgo de combustión si la fuga lo alcanza). El jugador debe decidir qué atacar primero sabiendo que ambas reglas podrían dispararse → valida las reglas de prioridad y stacking entre tags simultáneos (Especificación de datos técnicos, sección 2).
14. **Cadena de Montaje bajo Presión**: la solución requiere que el Ingeniero desmonte un componente en la Sección A y que el Médico use una de esas piezas para fabricar algo en la Sección B. El jugador encola la tarea del Médico con dependencia explícita a la tarea del Ingeniero; ambos ejecutan en paralelo, el Médico esperando en su sitio hasta que la pieza esté disponible → valida las dependencias entre colas de distintos tripulantes (sección 4).
15. **Reconstrucción desde Cero**: ningún componente intacto de la nave sirve para el problema (se necesita un actuador de precisión que no existe tal cual). El jugador desmonta 2-3 compuestos distintos hasta sus piezas atómicas y construye en la mesa de creación un compuesto nuevo que la nave nunca tuvo preinstalado, asumiendo el coste de tiempo y la pérdida de material según el tier del Ingeniero → valida la ruta atómica completa (7.1) y la tensión velocidad-vs-precisión, en contraste directo con el caso 1 (que reutiliza compuestos intactos).
16. **Maniobra Evasiva**: una amenaza externa (impacto inminente, disparo enemigo) requiere que el Piloto ejecute una maniobra evasiva con los actuadores de propulsión/navegación de la nave antes de que expire el temporizador de la crisis. El jugador decide si asigna al Piloto (afinidad, mucho más rápido) o a otro tripulante disponible (penalización del +20%, posiblemente demasiado lento) → valida la especialidad de Piloto (6.6), sin cobertura previa en ningún caso anterior.

**Nota de auditoría**: los casos 1-16 cubren, entre todos, cada mecánica descrita en las secciones 4-7 y 11 del GDD, más los parámetros de la Especificación de datos técnicos. Los casos 9-16 se añadieron tras una auditoría de cobertura que detectó 8 mecánicas sin caso propio (magnetismo, toxicidad con umbral, explosión con radio/daño, síntesis elemental y su fallback de resolución, prioridad entre reglas simultáneas, dependencias entre colas de tripulantes, ruta atómica completa, y especialidad de Piloto). No cubierto todavía por ningún caso: el sistema de personalidad/frases (6.7) y el sistema de logros (6.8), por ser contenido narrativo/meta-progresión más que reglas emergentes del motor — no requieren validación de la misma naturaleza.

## 10. UI/UX

- **Plano 2D esquemático de la nave** (no vista 3D navegable), con capas activables tipo Photoshop: eléctrica, fluidos, estructural, señales. La capa inactiva se atenúa visualmente pero permanece visible.
- **Todo el plano es seleccionable**: cualquier componente puede inspeccionarse (propiedades visibles como iconos/barras, no tablas numéricas), desmontarse o reconectarse directamente.
- **Paneles auxiliares** (pixel art, sin HTML): estado de tripulación, alertas activas, inventario de componentes desmontados.
- **Feedback visual de propiedades activas**: color/iconografía consistente por tipo de recurso (eléctrico, térmico, fluido) en todo el juego.
- **Flujo animado en conductos activos**: todo conducto con recurso circulando (eléctrico, gas, líquido) muestra partículas moviéndose en la dirección del flujo, con densidad/velocidad proporcional al caudal — el jugador ve de un vistazo qué está activo y hacia dónde va, sin necesitar seleccionar el conducto para inspeccionarlo.

### 10.1 Mesa de creación: composición espacial

La mesa de creación no es una lista de combinación abstracta — es un **grid pequeño con la misma unidad que el plano principal**, donde el jugador posiciona físicamente las piezas (atómicas o compuestos intactos) unas respecto a otras, exactamente igual que en el plano.

- **Colocar**: arrastrar piezas al grid de la mesa, en la disposición que el jugador elija.
- **Conectar**: mismo gesto que cablear el plano (seleccionar nodo A → arrastrar a nodo B) — un único lenguaje de interacción compartido entre mesa y plano, sin curva de aprendizaje adicional.
- **Footprint resultante**: el rectángulo mínimo que contiene todas las piezas tal como fueron colocadas (no un valor fijo por receta) — una disposición compacta ocupa menos que una dispersa. Cada pieza atómica tiene su propio tamaño en el catálogo (7.2).
- **Nombrar**: al terminar, el jugador asigna un nombre a su creación. Se guarda como compuesto nuevo, reutilizable y exportable en blueprints (3.2).
- **Instalar en el plano**: colocar el compuesto terminado en una sección valida que el footprint calculado quepa sin solaparse con paredes u otros componentes — si no cabe, se rechaza visualmente (silueta en rojo). Rotación del footprint permitida antes de confirmar la colocación.
- **Conexión externa final**: instalar el compuesto en el plano no lo conecta automáticamente al resto de la nave — sus puertos externos (entrada de energía, salida de señal, etc.) se cablean después, igual que con cualquier componente de fábrica. La construcción interna se resuelve en la mesa; la integración con la nave es un paso aparte, deliberadamente.

## 11. Arte y estilo visual

- Pixel art de alta densidad (referencia: Dead Cells, Hyper Light Drifter).
- Iluminación 2D dinámica (luces de emergencia, chispas, fuego, paneles).
- Violencia/gore explícito permitido visualmente.

### 11.0 Estrategia de assets: sourcing vs. procedural

Sin capacidad de ilustración propia, se combinan dos fuentes distintas de arte, y es importante no mezclarlas sin criterio:

- **Assets estáticos (sprites, tiles de suelo/pared, chrome de UI, base de tripulantes/enemigos)**: sourced de packs de pixel art gratuitos/CC0 (ej: Kenney.nl u otras fuentes compatibles con uso comercial). **Preferir pocas familias de packs del mismo autor/estilo** en vez de mezclar muchas fuentes distintas — mezclar packs de autores diferentes casi siempre produce inconsistencia de densidad de píxel y paleta, más notable que usar un solo estilo aunque sea más limitado.
- **Todo lo dinámico/procedural sigue siendo 100% código**, sin cambios respecto a lo ya definido: partículas (11.1), flujo en conductos (10), movimiento por salto (11.2), iluminación dinámica. Esto no depende de habilidad gráfica.
- **Técnica puente — recoloreado en runtime**: para que assets genéricos de un pack encajen con el código de color por tipo de recurso ya establecido (eléctrico/térmico/fluido/etc.), aplicar tinte por código (`tint` de Phaser) sobre sprites base en escala de grises o color neutro, en vez de buscar/depender de que el pack tenga exactamente el color correcto. Esto también ayuda a unificar visualmente piezas que vengan de fuentes distintas.
- **Licencia**: verificar que cualquier pack usado permita uso comercial y no requiera atribución incompatible con la distribución planeada, antes de integrarlo — pendiente de confirmar por pack elegido (ver sección 17).

### 11.1 Sistema de partículas como feedback diegético

El sistema de partículas no es decorativo: es la forma principal en que el jugador **lee el estado del motor de propiedades** sin recurrir a texto o UI abstracta. Cada propiedad activa o reacción en curso debe tener una representación visual consistente y reconocible, para que el jugador pueda diagnosticar un problema con solo mirar el plano.

| Fenómeno del motor | Representación en partículas |
|---|---|
| Corriente eléctrica activa/sobrecarga | Chispas y arcos eléctricos a lo largo del conductor; intensidad y frecuencia escalan con el nivel de sobrecarga |
| Flujo activo en conducto (eléctrico/gas/líquido, sin sobrecarga) | Partículas discretas moviéndose en la dirección del flujo a lo largo del conducto; densidad y velocidad proporcionales al caudal actual, color según tipo de recurso |
| Fuego/combustión | Llamas con propagación real a materiales inflamables cercanos, humo ascendente, luz dinámica parpadeante; intensidad y color escalan con la concentración de oxígeno local (llama débil y oscura en atmósfera pobre, llama intensa y blanca en atmósfera enriquecida, imposible en vacío) |
| Fuga de gas | Nube semitransparente que se expande y disipa según ventilación de la sección; color por tipo (tóxico, inerte, oxidante) |
| Derrame de líquido | Charco que se expande sobre el suelo, reduce visibilidad de conexiones bajo él, puede conducir electricidad si es conductor |
| Corrosión activa | Textura de "quemado/disuelto" progresiva sobre el material afectado (estructura, piel de tripulante), con partículas de humo/vapor ácido |
| Neutralización química | Efervescencia/burbujeo breve + nube de vapor al mezclarse ácido/base |
| Explosión | Onda expansiva con partículas de escombros, empuje físico a tripulantes/objetos cercanos |
| Congelación / cambio de estado a sólido | Cristalización visual progresiva, vapor frío, ralentización de partículas de flujo hasta detenerse |
| Vapor por calor extremo | Nube blanca ascendente, distorsión de calor (heat haze) |
| Daño a tripulante (térmico/químico/eléctrico) | Partícula distintiva por tipo de daño (quemadura, salpicadura corrosiva, arco eléctrico), reforzando que el jugador entienda *por qué* murió, no solo que murió |

**Principio de diseño**: dos reacciones distintas nunca deben verse igual. Esto es crítico porque el jugador diagnostica visualmente antes de leer cualquier dato — si un fuego y una corrosión se ven parecidos, se rompe la legibilidad que sostiene todo el sistema de improvisación bajo presión.

### 11.2 Movimiento de unidades orgánicas (tripulantes y enemigos)

Sin animación de caminata (coherente con el nivel visual minimalista, sección 12.3 del pitch original), el desplazamiento de cualquier unidad orgánica se representa mediante **saltos discretos (hopping)**, nunca como deslizamiento continuo ni bamboleo sinusoidal.

- **Cada salto sigue una trayectoria parabólica real**, gobernada por una gravedad constante descendente: velocidad inicial hacia arriba que se frena progresivamente hasta el punto más alto (apex), seguida de caída acelerada hasta aterrizar. Es una curva de easing física, no una animación con loop senoidal — el salto tiene un ritmo asimétrico perceptible (sube más lento cerca del apex, cae acelerando), que es justamente lo que lo distingue de un bamboleo artificial.
- **Squash & stretch**: compresión breve del sprite al aterrizar (venden peso e impacto), ligero estiramiento vertical en el apex — técnica estándar de pixel art para comunicar físicidad sin frames de animación complejos.
- **Variantes de cadencia según urgencia/estado**, todas construidas sobre la misma curva base:
  - Desplazamiento normal: saltos pequeños y frecuentes.
  - Movimiento urgente (huyendo, respondiendo a alarma): saltos más altos y largos, cadencia más rápida.
  - Tripulante herido: saltos irregulares, más bajos, cadencia entrecortada — el propio movimiento comunica el estado sin necesitar una barra de vida flotante.
- **Enemigos reutilizan el mismo sistema con firma de salto propia** (blindados = saltos pesados y lentos; tipos ágiles = saltos rápidos y erráticos), reforzando el principio de legibilidad diegética ya aplicado a partículas (11.1): el jugador reconoce el tipo de amenaza por cómo se mueve, sin leer una etiqueta.
- **Nota de implementación**: esto es un patrón de animación (curva parabólica predefinida aplicada al sprite), no una simulación física completa por unidad — no requiere un motor de físicas dedicado.

## 12. Idioma y plataformas

- Español e inglés desde el lanzamiento (localización completa desde el MVP).
- Windows, Mac y Linux.
- Distribución local (build standalone vía Electron), sin dependencia de servidor.

## 13. Alcance del MVP

- Los 4 arquetipos completos desde el inicio.
- Duración objetivo por crisis: 15-25 minutos.
- Modo campaña + modo creativo desde el MVP.
- Exportación/importación de blueprints como archivo local (JSON) en modo creativo.
- Meta-progresión entre partidas solo en campaña (modo creativo sin progresión).

## 14. Stack técnico

- **Motor**: lógica pura en TypeScript (`/engine`), desacoplada de renderizado — nodos, propiedades, señales, simulación.
- **Render/UI**: Phaser 3 + plugin rexUI, 100% pixel art, sin overlays HTML.
- **Distribución**: Electron como wrapper de empaquetado.
- **Testing**: Jest/Vitest sobre `/engine`, usando los casos de validación de la sección 9 como suite de tests de referencia.

## 15. Pipeline de contenido y herramientas de autoría

No se construye un editor de niveles como producto — el plano físico es fijo y canónico por arquetipo (uno por nave, evoluciona con cicatrices durante la partida, no se regenera). Esto reduce el problema a tres piezas de pipeline, cada una con su propia herramienta:

### 15.1 Plano físico (habitaciones, pasillos, topología de ventilación/cableado)
- **Herramienta**: Tiled Map Editor (gratuito, exporta JSON parseable directo en TypeScript). Se diseñan las 4 naves una sola vez, a mano.
- **Datos que debe capturar**: grid de habitaciones/secciones, grafo de adyacencia entre secciones (qué conecta con qué, vía qué tipo de conducto), puntos de anclaje donde pueden montarse componentes.
- El plano geométrico (paredes/habitaciones) es estático y no editable por el jugador ni en campaña ni en modo creativo — solo lo que ocurre *dentro* de él es dinámico.

### 15.2 Estado inicial de componentes por arquetipo (qué hay instalado y dónde)
- No se construye una herramienta de autoría aparte: se reutiliza la propia UI de juego (plano + mesa de creación, sección 10) en un **modo dev** — un flag que permite colocar/conectar libremente el equipamiento inicial de cada arquetipo (7.3-7.6) sobre su plano fijo, y guardarlo como el estado canónico de esa nave. Evita mantener dos herramientas distintas para el mismo problema (colocar componentes sobre un plano).

### 15.3 Definición de crisis (el contenido que sí escala con el tiempo)
- Formato de datos declarativo (JSON/TS), no una herramienta visual, dado que el volumen inicial es bajo (5-8 crisis para el MVP, ver 13). Cada crisis se define como una secuencia de fallos/triggers con sus condiciones, temporización y (cuando aplica) dependencia de cicatrices de crisis anteriores.
- Solo si más adelante se abre autoría de crisis a la comunidad (modo "diseña tu propia crisis", mencionado como idea temprana) valdría la pena invertir en una UI visual sobre este mismo formato — no antes.

### 15.4 Separación de estado estático vs. dinámico
Consecuencia directa de lo anterior para el motor: el plano (15.1) es contenido estático versionado con el juego; la instancia de una partida (posición/estado de componentes, sustancias en reservorios, cicatrices acumuladas, tripulación) es estado dinámico guardado por partida — misma separación que ya aplica al modo creativo con sus blueprints (3.2, 13).

## 16. Riesgos identificados

- **Complejidad de UI del editor de nodos**: conexiones tipo cable/curva en pixel art puro son costosas de implementar bien; vigilar como posible cuello de botella de desarrollo.
- **Balanceo del sistema de propiedades**: con demasiada libertad, riesgo de soluciones "degeneradas" que trivializan crisis; necesita playtesting iterativo por capítulo.
- **Carga cognitiva para jugador nuevo**: la introducción de reglas (señal → combinación → memoria → material → tiempo) debe ser gradual y tutorializada dentro de las primeras crisis de campaña, no en un tutorial separado.

## 17. Pendiente de definir (siguiente iteración del spec)

- Diseño detallado de las primeras 5-8 crisis de campaña, capítulo por capítulo.
- Sistema de audio (fuera de alcance para esta versión del GDD).
- Ver también el documento complementario "Especificación de datos técnicos" para: parámetros numéricos de las reglas de reacción química, mapeo de sustancias pre-mezcladas (5.4.3) a recetas de elementos, y parámetros de difusión atmosférica.
- Formato exacto del archivo de blueprint (schema JSON), incluyendo cómo se serializan recetas atómico→compuesto y dependencias entre tareas de tripulantes.
- Playtesting del gap de neutralización química fuera de Investigación (ver 7.7) — decidir si es intencional o requiere ajuste de componentes.
- Ajuste fino de parámetros numéricos del sistema de salto (altura/distancia/cadencia en píxeles y frames, por variante) una vez haya sprites de referencia.
- Selección final de packs de pixel art (11.0) y verificación de licencia para uso comercial.
- Confirmar los tamaños de footprint asignados a las piezas atómicas (7.2) — son una asunción de diseño inicial, no valores validados en playtesting.
- Definir el tamaño exacto en píxeles de la unidad de grid compartida entre plano, mesa de creación y footprints de componentes.
