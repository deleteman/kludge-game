import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { SectionId, SectionRuntime } from "./section.types.js";
import type { GasKey } from "./atmosphere-composition.types.js";
import type { VentilationConnection } from "./ventilation.types.js";

/** Espec. §4: la diferencia de concentración se reduce ~10%/s a válvula 100% abierta. */
export const DIFFUSION_RATE_PER_SECOND = 0.1;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Difusión atmosférica híbrida por tick (GDD 5.5, Espec. §4). Para cada
 * conexión de ventilación, cada gas de ambas secciones se mueve hacia la
 * concentración de equilibrio ponderada por volumen, a un ritmo `step` =
 * 10%/s × apertura × dt.
 *
 * Propiedades del modelo (simple pero fiel al spec):
 *  - La DIFERENCIA de concentración entre las dos secciones decae exactamente a
 *    `step` por segundo, independientemente de los volúmenes → cumple "~10%/s".
 *  - El equilibrio es ponderado por volumen ⇒ la masa de gas se conserva y las
 *    secciones grandes cambian proporcionalmente menos (Espec. §4) sin factor
 *    extra: su distancia al equilibrio ya es menor.
 *  - Válvula cerrada (apertura 0) ⇒ step 0 ⇒ secciones aisladas.
 *  - NO hay regeneración pasiva de gas (Espec. §4): la difusión solo mueve el
 *    gas existente, nunca lo crea.
 *  - La PRESIÓN se equilibra por la misma conexión y con el mismo paso (ronda 1
 *    de playtest de 13h) — ver el comentario en el cuerpo.
 */
export function diffuse(
  sectionsById: ReadonlyMap<SectionId, SectionRuntime>,
  connections: ReadonlyArray<VentilationConnection>,
  tick: TickContext,
): void {
  for (const connection of connections) {
    const a = sectionsById.get(connection.a);
    const b = sectionsById.get(connection.b);
    if (!a || !b) {
      continue;
    }
    const step = Math.min(
      1,
      DIFFUSION_RATE_PER_SECOND * clamp01(connection.valveAperture) * tick.dtSeconds,
    );
    if (step <= 0) {
      continue;
    }
    const volA = a.section.volume;
    const volB = b.section.volume;
    const totalVolume = volA + volB;
    if (totalVolume <= 0) {
      continue;
    }

    // Presión (ronda 1 de playtest de 13h). Hasta acá `diffuse()` movía
    // fracciones de gas pero NUNCA tocaba `pressureKpa`: la presión solo la
    // movía el sumidero de 13f, y siempre sobre una sola sección. La
    // consecuencia era que abrir la puerta de una sala brechada no le hacía
    // nada a la sala de al lado — reportado en el playtest, y era un hueco de
    // modelado, no un bug de las puertas.
    //
    // Se equilibra con la MISMA apertura y el MISMO paso ponderado por volumen
    // que las fracciones: es el mismo fenómeno por la misma conexión, así que
    // no merece una segunda función ni un segundo recorrido. Consecuencia
    // buscada (decisión del operador): una brecha se desangra por cada puerta o
    // válvula abierta hasta el último rincón de la nave, y cerrarlas es lo
    // único que lo detiene.
    const pA = a.atmosphere.pressureKpa;
    const pB = b.atmosphere.pressureKpa;
    if (pA !== pB) {
      const equilibrium = (pA * volA + pB * volB) / totalVolume;
      a.atmosphere.pressureKpa = pA + (equilibrium - pA) * step;
      b.atmosphere.pressureKpa = pB + (equilibrium - pB) * step;
    }

    const gasKeys = new Set<GasKey>([...a.atmosphere.gases.keys(), ...b.atmosphere.gases.keys()]);
    for (const gas of gasKeys) {
      const cA = a.atmosphere.gases.get(gas) ?? 0;
      const cB = b.atmosphere.gases.get(gas) ?? 0;
      if (cA === cB) {
        continue;
      }
      const equilibrium = (cA * volA + cB * volB) / totalVolume;
      a.atmosphere.gases.set(gas, cA + (equilibrium - cA) * step);
      b.atmosphere.gases.set(gas, cB + (equilibrium - cB) * step);
    }
  }
}
