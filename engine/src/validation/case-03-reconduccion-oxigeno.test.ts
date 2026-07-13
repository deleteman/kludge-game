// GDD 9, caso 3 — "Reconducción de oxígeno para ahogar atacantes": reservorio+flujo (difusión atmosférica) con consecuencia de cicatriz (GDD 5.5) — la sección drenada no se autorregula.
import { describe, expect, it } from "vitest";
import {
  diffuse,
  GAS,
  type GasKey,
  type SectionId,
  type SectionRuntime,
  type TickContext,
} from "../index.js";

const sectionId = (raw: string): SectionId => raw as SectionId;
const tickOf = (elapsed: number, dt = 1): TickContext => ({
  dtSeconds: dt,
  elapsedSeconds: elapsed,
});

function section(id: string, volume: number, gases: Record<GasKey, number>): SectionRuntime {
  return {
    section: { id: sectionId(id), volume },
    atmosphere: { gases: new Map(Object.entries(gases)), temperatureCelsius: 21, pressureKpa: 101 },
  };
}
function o2(runtime: SectionRuntime): number {
  return runtime.atmosphere.gases.get(GAS.OXYGEN) ?? 0;
}

describe("case 3 — Reconducción de oxígeno para ahogar atacantes", () => {
  it("draining a room's O2 into a large vented sink suffocates it, and it stays that way once sealed again", () => {
    // Sala del atacante, atmósfera estándar; un pasillo de venteo enorme y
    // vacío que actúa de sumidero — abrir la válvula drena la sala hacia él.
    const salaAtacante = section("sala-atacante", 5, { [GAS.OXYGEN]: 0.21 });
    const pasilloVenteo = section("pasillo-venteo", 500, { [GAS.OXYGEN]: 0 });
    const sections = new Map([salaAtacante, pasilloVenteo].map((r) => [r.section.id, r]));
    const connection = {
      a: salaAtacante.section.id,
      b: pasilloVenteo.section.id,
      valveAperture: 1,
    };

    // Actuador de válvula abierto varios segundos: el sumidero es tan grande
    // que el equilibrio de masa cae a casi 0% en la sala del atacante.
    for (let t = 0; t < 60; t++) diffuse(sections, [connection], tickOf(t));
    expect(o2(salaAtacante)).toBeLessThan(0.05); // por debajo del umbral respirable

    // Estructura sellante: el jugador cierra la válvula de nuevo.
    const sealed = { ...connection, valveAperture: 0 };
    const suffocatedLevel = o2(salaAtacante);
    for (let t = 60; t < 120; t++) diffuse(sections, [sealed], tickOf(t));

    // Consecuencia de cicatriz (GDD 5.5): sin ventilación limpia reconectada,
    // la sala NO se autorregula — sigue despresurizada de O2 indefinidamente.
    expect(o2(salaAtacante)).toBeCloseTo(suffocatedLevel);
  });
});
