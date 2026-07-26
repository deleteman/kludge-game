# Extensión de componente — Indicador LED y Pantalla LCD

Documento independiente, no fusionado al GDD (en uso activo durante desarrollo). Extiende conceptualmente las secciones 7.2 (catálogo atómico), 5.6 (reglas de interacción), 9 (casos de validación) y 11/11e (iluminación) del GDD — referenciadas aquí, no modificadas allí.

## Motivación

El catálogo atómico universal (GDD 7.2) tiene receptores de señal (`REC`) y actuadores mecánicos (`ACT`), pero ninguna pieza cuyo único propósito sea **visualizar** el estado de una señal — el equivalente más básico de una lámpara de redstone. Es un hueco real: toda la filosofía de legibilidad total del juego (pilar de diseño 3, GDD §11.1) depende de que el estado del sistema sea visible, y hoy no existe la pieza más elemental para lograrlo dentro de la ficción del juego.

Se definen dos piezas atómicas independientes, con distinto costo de implementación cada una — ninguna depende de la otra ni se ensambla a partir de la otra.

## 1. Indicador LED (nueva pieza atómica — extiende GDD 7.2)

| Atributo | Valor |
|---|---|
| Tags funcionales | `REC` (receptor de señal) |
| Tamaño (footprint) | 1×1 |
| Comportamiento | Emite luz cuando recibe una señal activa desde el nodo al que está conectado. Binario (encendido/apagado) como comportamiento base. |
| Intensidad/color | Reutiliza el sistema de tinte en runtime ya definido (GDD 11.0) y el sistema de luces aditivas de la sub-fase 11e — no requiere pipeline de iluminación nuevo. Si el emisor de origen tiene una intensidad graduada (bajo/medio/alto, mismo patrón que `MAG` en la extensión de aceleración magnética), la luz del indicador puede escalar junto con ella; si no, se comporta como binario simple. |
| Consumo | Trivial — no se modela como carga eléctrica significativa, a diferencia de un actuador mecánico. |

**Uso esperado**: colocarlo sobre cualquier nodo `REC`/`EM` para dar feedback visual inmediato de su estado sin tener que inspeccionar el componente — refuerza directamente el principio de "dos fenómenos nunca deben verse igual" ya establecido para partículas, ahora aplicado a estado de señal en reposo, no solo a eventos.

## 2. Pantalla LCD (nueva pieza atómica independiente — extiende GDD 7.2)

No es un compuesto ensamblado a partir de otras piezas — es su propia pieza atómica, al mismo nivel que el Indicador LED (sección 1) o cualquier otra entrada del catálogo 7.2. Se conecta a su fuente de datos por cableado normal, igual que cualquier `REC` se conecta a un `EM`, no mediante una receta de ensamblaje.

| Atributo | Valor |
|---|---|
| Tags funcionales | `REC` (receptor de señal) |
| Tamaño (footprint) | 2×1 (más grande que el Indicador LED — necesita más espacio que un punto de luz) |
| Comportamiento | Muestra el **valor real** de la propiedad del nodo al que está cableada, no solo su estado binario. |
| Control opcional por chip | Puede cablearse a un Chip de circuito genérico (GDD 7.2, pieza ya existente) para lógica de selección o formato de qué mostrar — esto es cableado entre dos piezas atómicas independientes, igual que cualquier otra combinación de señales (GDD 5.6), no una fusión en un compuesto nuevo. El chip es opcional: la pantalla también puede cablearse directo a la fuente sin él. |

**Qué puede mostrar** (según a qué se conecte):
- Estado de un nodo `REC`: texto ON/OFF.
- Nivel de un reservorio (`RES`): porcentaje o cantidad restante.
- Valor de una propiedad de material en su escala cualitativa (ej. temperatura bajo/medio/alto).
- Estado de un latch/memoria: activo/inactivo, con contador si el latch lo lleva.

**Costo de implementación real**: requiere renderizado de texto dinámico sobre el sprite, que no reutiliza ningún sistema existente al 100% — es la pieza de trabajo real de esta extensión, a diferencia del LED que se apoya casi enteramente en sistemas ya construidos (11.0, 11e). Recomendación de actualización: no en cada frame — un intervalo corto (250-500ms) es suficiente y más barato en rendimiento.

**Nota de i18n**: si la pantalla muestra etiquetas de texto (ON/OFF, nombres de estado de un latch) en vez de solo números, esas cadenas deben pasar por el sistema de claves de traducción ya establecido (CLAUDE.md) — los valores numéricos puros no lo requieren.

## 3. Nueva sub-categoría conceptual: actuador de salida de información

Ni el LED ni el LCD encajan del todo en la definición actual de `ACT` (GDD 5.1: "convierte energía en trabajo físico"): no producen trabajo físico, producen una representación legible. Se propone tratarlos como una sub-categoría de `ACT` — **"salida de información"** — que no mueve nada ni libera energía, solo visualiza el estado de otro nodo. No cambia el modelo de propiedades, solo lo aclara para que quien implemente no intente forzarlos dentro de la semántica de "trabajo físico" del resto de actuadores.

## 4. Caso de validación propuesto (extiende GDD sección 9, caso 18)

**"El Panel de Diagnóstico Improvisado"**: el jugador construye una Pantalla LCD y la conecta al sensor de presión de una sección con una fuga de gas activa, mostrando en tiempo real el nivel restante — permite decidir cuándo intervenir sin tener que adivinar ni pausar a inspeccionar el componente manualmente. Valida: el Indicador LED como pieza base, la lectura de valor real del LCD, y su integración con el sistema de atmósfera (GDD 5.5) como fuente de datos.

## 5. Nota para integración futura

Cuando se decida fusionar esta extensión al GDD:
- El Indicador LED y la Pantalla LCD se agregan a GDD 7.2 como piezas atómicas universales independientes (#21 y #22) — ninguna es receta de la otra, ambas se colocan y cablean como cualquier otra pieza del catálogo.
- La sub-categoría de "actuador de salida de información" (sección 3) se añade como aclaración dentro de GDD 5.1, sin alterar la tabla de propiedades funcionales existente.
- El caso de validación (sección 4) se numera como caso 18 en GDD sección 9 — verificar que no choque con el caso 17 (Extensión de aceleración magnética), que también propone numerarse como 17 si ambas extensiones se fusionan en la misma sesión.

Dado que el proyecto ya está en fase de contenido (Fase 11+ del orden de trabajo), esta pieza debería recibir su propio test unitario en `/engine` antes de darse por integrada, siguiendo el estándar de CLAUDE.md.
