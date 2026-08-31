import type { CombustionIntensity } from "../chemistry/reaction/reaction-events.types.js";
import type { FailureMode } from "../failure/failure-events.types.js";

/**
 * Parámetros del dominio de temperatura (Subfase 14a-1, GDD §5.2).
 *
 * Único lugar con números térmicos, mismo criterio que
 * `section-integrity-parameters.ts` (13f) y `power-parameters.ts` (13g): la
 * lógica importa de acá y nunca declara constantes propias, para que el
 * balanceo sea un diff de datos y no un diff de reglas.
 *
 * El eje térmico ya tenía estado declarado (`SectionAtmosphere.temperatureCelsius`)
 * desde Fase 11b, pero ningún escritor: era un 21 fijo que solo miraba `/game`.
 * Estos parámetros son lo que lo vuelve un número vivo.
 */

/**
 * Temperatura de operación nominal de la nave, en °C. Es el valor al que
 * `standardSectionAtmosphere()` siembra una sección y el objetivo de la deriva
 * pasiva: la climatización de fondo siempre empuja hacia acá.
 */
export const NOMINAL_TEMPERATURE_CELSIUS = 21;

/**
 * Fracción de la distancia al nominal que la climatización recupera por
 * segundo. Deriva EXPONENCIAL, no lineal (`T += (nominal - T) * rate * dt`):
 * con dt de frame variable nunca puede pasarse del objetivo, así que no hace
 * falta un caso especial de "casi llegué".
 *
 * A 0.05 la mitad del exceso se disipa en ~14 s: un pico de calor es un evento
 * con principio y fin, no un estado permanente, pero dura lo suficiente para
 * que el jugador lo vea, lo diagnostique y reaccione.
 */
export const PASSIVE_DRIFT_PER_SECOND = 0.05;

/**
 * Conducción de calor entre secciones conectadas. Mayor que
 * `DIFFUSION_RATE_PER_SECOND` (0.1, gases) a propósito: el calor atraviesa un
 * mamparo mucho más rápido de lo que se mezcla el aire.
 */
export const THERMAL_DIFFUSION_RATE_PER_SECOND = 0.15;

/**
 * Apertura mínima con la que conduce el calor, aunque la conexión esté cerrada
 * del todo. Una puerta blindada cerrada (13h) sella el gas pero NO aísla
 * térmicamente: el metal sigue conduciendo. Es lo que impide que cerrar una
 * puerta sea una solución gratuita y total a un incendio — compartimentar
 * compra tiempo, no inmunidad (principio 5: sin arreglos sin coste).
 */
export const MIN_THERMAL_APERTURE = 0.15;

/** Clamp de dos lados, mismo criterio que el piso/techo del sumidero de presión (11h/13f). */
export const TEMPERATURE_FLOOR_CELSIUS = -80;
export const TEMPERATURE_CEILING_CELSIUS = 900;

/**
 * Un pulso de calor: cuántos °C aporta en total y en cuánto tiempo. El runtime
 * lo convierte a °C/s; se autoran así porque "+60 °C en 5 s" es legible para
 * diseño y "12 °C/s" no.
 *
 * Ojo al leer estos números: la deriva pasiva actúa DURANTE el pulso, así que
 * el pico real que se ve en pantalla es siempre menor que `celsius`.
 */
export interface HeatPulseSpec {
  readonly celsius: number;
  readonly durationSeconds: number;
}

/** Calor de una combustión según su intensidad (GDD 5.5). */
export const COMBUSTION_HEAT: Readonly<Record<CombustionIntensity, HeatPulseSpec>> = {
  weak: { celsius: 25, durationSeconds: 4 },
  standard: { celsius: 60, durationSeconds: 5 },
  violent: { celsius: 140, durationSeconds: 6 },
};

/**
 * Calor de una sobrecarga eléctrica. Solo los modos que producen fuego o
 * explosión: `cut` es un corte limpio del conductor y `L` (lógica) no libera
 * energía térmica apreciable.
 */
export const OVERLOAD_HEAT: Readonly<Partial<Record<FailureMode, HeatPulseSpec>>> = {
  fire: { celsius: 40, durationSeconds: 5 },
  explosion: { celsius: 90, durationSeconds: 4 },
};

/**
 * Umbral del sensor térmico (`triggerType: "thermal"`). Dispara POR ENCIMA, al
 * revés que el de presión, que dispara por debajo de la atmósfera estándar.
 *
 * A 60 °C queda por encima de cualquier variación de operación normal y por
 * debajo del pico de una combustión estándar: el sensor distingue "incendio"
 * de "la nave funcionando", que es exactamente para lo que el jugador lo cablea.
 */
export const THERMAL_SENSOR_TRIGGER_CELSIUS = 60;
