// GDD 9, caso 3 — "Reconducción de oxígeno para ahogar atacantes": reservorio+flujo (difusión atmosférica) con consecuencia de cicatriz (GDD 5.5) — la sección drenada no se autorregula.
import { describe, expect, it } from "vitest";
import {
  diffuse,
  GAS,
  ValveRuntime,
  type ConduitId,
  type GasKey,
  type SectionId,
  type SectionRuntime,
  type ShipFloorplan,
  type TickContext,
} from "../index.js";

const sectionId = (raw: string): SectionId => raw as SectionId;
const tickOf = (elapsed: number, dt = 1): TickContext => ({
  dtSeconds: dt,
  elapsedSeconds: elapsed,
});

const SALA = sectionId("sala-atacante");
const PASILLO = sectionId("pasillo-venteo");
const VALVE = "ventilacion:sala-atacante:pasillo-venteo:0" as ConduitId;

function section(id: SectionId, volume: number, gases: Record<GasKey, number>): SectionRuntime {
  return {
    section: { id, volume },
    atmosphere: { gases: new Map(Object.entries(gases)), temperatureCelsius: 21, pressureKpa: 101 },
  };
}
function o2(runtime: SectionRuntime): number {
  return runtime.atmosphere.gases.get(GAS.OXYGEN) ?? 0;
}

/**
 * Plano mínimo con UNA válvula de ventilación operable entre las dos secciones.
 * Desde 13h el sellado del caso 3 se hace con la válvula real, no fabricando a
 * mano una conexión con `valveAperture: 0` — que era lo que este test tenía que
 * hacer mientras la apertura fue un dato estático del plano.
 */
function floorplan(): ShipFloorplan {
  return {
    id: "nave-caso-03",
    archetype: "guerra",
    nameKey: "ship.test",
    gridSize: { width: 2, height: 1 },
    sections: [
      { id: SALA, nameKey: "section.sala", cells: [{ x: 0, y: 0 }] },
      { id: PASILLO, nameKey: "section.pasillo", cells: [{ x: 1, y: 0 }] },
    ],
    conduits: [
      {
        id: VALVE,
        a: SALA,
        b: PASILLO,
        kind: "ventilacion",
        position: { x: 0.5, y: 0 },
        initialAperture: 1,
      },
    ],
    anchors: [],
    componentSeeds: [],
    doors: [],
  };
}

describe("case 3 — Reconducción de oxígeno para ahogar atacantes", () => {
  it("draining a room's O2 into a large vented sink suffocates it, and it stays that way once sealed again", () => {
    // Sala del atacante, atmósfera estándar; un pasillo de venteo enorme y
    // vacío que actúa de sumidero — abrir la válvula drena la sala hacia él.
    const salaAtacante = section(SALA, 5, { [GAS.OXYGEN]: 0.21 });
    const pasilloVenteo = section(PASILLO, 500, { [GAS.OXYGEN]: 0 });
    const sections = new Map([salaAtacante, pasilloVenteo].map((r) => [r.section.id, r]));
    const valves = new ValveRuntime(floorplan());

    // Actuador de válvula abierto varios segundos: el sumidero es tan grande
    // que el equilibrio de masa cae a casi 0% en la sala del atacante.
    for (let t = 0; t < 60; t++) diffuse(sections, valves.effectiveConnections(), tickOf(t));
    expect(o2(salaAtacante)).toBeLessThan(0.05); // por debajo del umbral respirable

    // Subfase 13h: el jugador cierra la válvula DE VERDAD (tarea `set-valve`),
    // en vez de que el test fabrique una conexión sellada aparte.
    valves.setAperture(VALVE, 0);
    const suffocatedLevel = o2(salaAtacante);
    for (let t = 60; t < 120; t++) diffuse(sections, valves.effectiveConnections(), tickOf(t));

    // Consecuencia de cicatriz (GDD 5.5): sin ventilación limpia reconectada,
    // la sala NO se autorregula — sigue despresurizada de O2 indefinidamente.
    expect(o2(salaAtacante)).toBeCloseTo(suffocatedLevel);
  });
});
