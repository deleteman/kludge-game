import { describe, expect, it } from "vitest";
import { sealBreachPressureSink } from "./seal-breach-pressure-sink.js";
import { MutableShipState } from "./mutable-ship-state.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

const SEAL_INSTANCE = "junta-rota" as PlacedComponentInstanceId;
const REPLACEMENT_INSTANCE = "junta-reemplazo" as PlacedComponentInstanceId;
const SECTION = "soporte-vital" as SectionId;
const POSITION = { x: 6, y: 5 };
const DRAIN_RATE = 1.5;
const RECOVERY_RATE = 1.5;

function baseConfig() {
  return {
    position: POSITION,
    acceptableComponentDefinitionIds: ["junta-hermetica" as ComponentId],
    sectionId: SECTION,
    drainRateKpaPerSecond: DRAIN_RATE,
    recoveryRateKpaPerSecond: RECOVERY_RATE,
  };
}

function buildBlueprint(
  placedComponents: Blueprint["placedComponents"],
): Blueprint {
  return {
    metadata: {
      schemaVersion: 4,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    },
    placedComponents,
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [] },
  };
}

function sealInstance(condition: "ok" | "jammed" | "destroyed"): Blueprint["placedComponents"][number] {
  return {
    instanceId: SEAL_INSTANCE,
    componentDefinitionId: "junta-hermetica" as ComponentId,
    placement: { position: POSITION, footprint: { width: 1, height: 1 }, rotation: 0 },
    condition,
    wear: "nuevo",
  };
}

describe("mission: sealBreachPressureSink (Subfase 11h, escenario de fuga en Capítulo 1)", () => {
  it("drena la sección mientras la junta está rota", () => {
    const shipState = new MutableShipState(buildBlueprint([sealInstance("jammed")]));
    const sink = sealBreachPressureSink(shipState, baseConfig());

    expect(sink().get(SECTION)).toBe(DRAIN_RATE);
  });

  it("recupera (tasa negativa) en cuanto la misma instancia vuelve a estar ok", () => {
    const shipState = new MutableShipState(buildBlueprint([sealInstance("jammed")]));
    const sink = sealBreachPressureSink(shipState, baseConfig());
    expect(sink().get(SECTION)).toBe(DRAIN_RATE);

    shipState.set(buildBlueprint([sealInstance("ok")]));
    expect(sink().get(SECTION)).toBe(-RECOVERY_RATE);
  });

  it("recupera también cuando el jugador desmonta la rota e instala una de repuesto (otro instanceId)", () => {
    const shipState = new MutableShipState(buildBlueprint([sealInstance("jammed")]));
    const sink = sealBreachPressureSink(shipState, baseConfig());
    expect(sink().get(SECTION)).toBe(DRAIN_RATE);

    // Desmontar (la instancia rota desaparece) + instalar una nueva en la
    // misma posición — instanceId distinto, mismo criterio que la resolución
    // de crisis `replacement-installed-connected`.
    shipState.set(
      buildBlueprint([
        {
          instanceId: REPLACEMENT_INSTANCE,
          componentDefinitionId: "junta-hermetica" as ComponentId,
          placement: { position: POSITION, footprint: { width: 1, height: 1 }, rotation: 0 },
          condition: "ok",
          wear: "nuevo",
        },
      ]),
    );
    expect(sink().get(SECTION)).toBe(-RECOVERY_RATE);
  });

  it("drena si la posición queda vacía (junta desmontada, todavía sin reemplazo)", () => {
    const shipState = new MutableShipState(buildBlueprint([]));
    const sink = sealBreachPressureSink(shipState, baseConfig());

    expect(sink().get(SECTION)).toBe(DRAIN_RATE);
  });
});
