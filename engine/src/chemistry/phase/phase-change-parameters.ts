import type { MatterState } from "../../properties/material.types.js";
import type { PhaseChangePoints } from "./phase-change.types.js";

/**
 * Parámetros del cambio de estado (Subfase 14a-3).
 *
 * Único lugar con números de este subsistema, mismo criterio que
 * `thermal-parameters.ts` (14a-1) y `power-parameters.ts` (13g): la lógica
 * importa de acá y nunca declara constantes propias, para que el balanceo sea
 * un diff de datos y no un diff de reglas.
 */

/**
 * Perfil por estado nominal para sustancias que NO vienen del catálogo: los
 * productos que las reglas de reacción sintetizan en runtime (residuo de
 * combustión, sal neutralizada, "Mezcla sin identificar").
 *
 * Son deliberadamente ANCHOS: un producto de reacción sin identidad no debería
 * cambiar de estado por la temperatura de la sala, porque nadie autoró qué
 * significa eso para él. El perfil lo deja en su estado nominal en toda la
 * ventana térmica alcanzable del motor ([-80, ~161] °C), sin necesitar un caso
 * especial en `effectiveMatterState`.
 */
export const DEFAULT_PHASE_POINTS_BY_STATE: Readonly<Record<MatterState, PhaseChangePoints>> = {
  S: { meltingPointCelsius: 2000, boilingPointCelsius: 3000 },
  L: { meltingPointCelsius: -2000, boilingPointCelsius: 2000 },
  G: { meltingPointCelsius: -3000, boilingPointCelsius: -2000 },
};

/**
 * Estado nominal asumido cuando una sustancia ni siquiera declara `state`
 * (posible en `ChemicalSubstanceData`, donde el campo es opcional). Líquido es
 * el intermedio: cae al perfil que no cambia de estado en ningún extremo.
 */
export const DEFAULT_NOMINAL_STATE: MatterState = "L";

/**
 * kPa que aporta a la sección **una unidad** de sustancia al evaporarse
 * (Subfase 14a-3, GDD §5.6 "sólido → gas puede generar presión/expansión").
 *
 * **El número sale de un cálculo, no de una estimación.** El sumidero de
 * presión clampea arriba en `PRESSURE_RECOVERY_CEILING_KPA` (= la presión
 * estándar, 101.3) y abajo en el piso por sección, así que el recorrido útil de
 * esta magnitud es la franja entre el piso de una fuga (40 kPa) y el estándar:
 * **~61 kPa**. Con 2.5 kPa/unidad, un reservorio de 25 unidades evaporado de
 * golpe recupera esa franja entera, y una purga chica (5 unidades) mueve ~12
 * kPa — perceptible en el tooltip sin resolver la sala de un solo gesto.
 *
 * Ojo al leerlo: por decisión de la subfase NO existe la sobrepresión, así que
 * todo lo que exceda el techo se descarta en el clamp. Evaporar en una sala sana
 * no hace nada a la presión, y eso es correcto, no un escritor muerto: el valor
 * jugable de esta magnitud es represurizar una sala que quedó baja tras sellar
 * una brecha.
 */
export const PHASE_EXPANSION_KPA_PER_UNIT = 2.5;

/**
 * En cuánto tiempo entrega la expansión sus kPa. Se modela como PULSO con
 * duración, igual que `HeatPulseSpec` de 14a-1, y no como un delta instantáneo:
 * el sumidero de presión aplica `rate * dtSeconds`, así que un "total de golpe"
 * dependería de la duración del frame (patrón 25 — una tasa continua que pasa
 * por la resolución del tick es un número que cambia con el hardware).
 *
 * A 3 s el jugador ve la aguja moverse y puede atribuir el cambio al charco que
 * acaba de evaporarse; instantáneo se leería como un salto sin causa.
 */
export const PHASE_EXPANSION_DURATION_SECONDS = 3;

/**
 * Un reservorio cuyo contenido se CONGELA sube UN escalón de desgaste (GDD §5.6:
 * el líquido expande al solidificar y fuerza las paredes del tanque).
 *
 * No hay constante numérica a propósito: `ComponentWear` es una escala ORDINAL
 * de cuatro niveles (`wear/wear.types.ts`), no una fracción, así que "un
 * incremento de 0.15" sería un número que no significa nada en su eje — dos
 * magnitudes que compilan igual y no son comparables. Se reusa `worsenWear`, el
 * mismo eje que escriben la canibalización (13c), la corrosión y el colapso de
 * sección (13f), en vez de abrir un segundo eje de daño por instancia.
 *
 * Se aplica UNA VEZ por CRUCE del umbral, con registro del estado anterior por
 * instancia: no un goteo proporcional a `dtSeconds`, que a cadencia de frame no
 * daría ni daño ni un evento legible (patrón de 13f ronda 1).
 *
 * Con cuatro escalones, un tanque sano aguanta tres congeladas antes de quedar
 * en `critico` y la cuarta lo destruye: congelar por accidente es un susto,
 * hacerlo de forma sistemática cuesta la pieza (principio 5).
 */
export const FREEZE_DESTROYS_RESERVOIR_AT_WORST_WEAR = true;
