// GDD 9, caso 7 — "La Neutralización de Emergencia": ácido+base (neutralización) cruzado con corrosividad sobre estructura — neutralizar a tiempo detiene la degradación del casco.
//
// Reescrito en Fase 11b: hasta entonces este caso alimentaba `StructuralIntegrity`
// a mano con un nivel corrosivo tecleado directamente ("A"/"M"/"B"/null), porque
// nada conectaba la atmósfera de una sección con la cicatriz de RE de un
// componente instalado — `StructuralIntegrity` era una isla sin llamador de
// producción, igual que `kinetics/` antes de la 11a.0. Ahora pilota el flujo
// real: un `Blueprint` con el panel de casco colocado, `MissionAtmosphereRuntime`
// (atmósfera viva por sección) y `MissionStructuralRuntime` (cicatriz de RE),
// exactamente lo que corre en misión — y confirma que la cicatriz sobrevive un
// round-trip de guardado (schema v4, Fase 11b).
import { describe, expect, it } from "vitest";
import {
  buildChemicalCatalog,
  deserializeBlueprint,
  MapEntityRegistry,
  MissionAtmosphereRuntime,
  MissionStructuralRuntime,
  MutableShipState,
  ReactionResolver,
  serializeBlueprint,
  type Blueprint,
  type ChemicalSubstanceId,
  type ComponentId,
  type PhysicalComponentDefinition,
  type PlacedComponentInstanceId,
  type ReactantSubstance,
  type ReactionContext,
  type SectionId,
  type ShipFloorplan,
  type TickContext,
} from "../index.js";

const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

const CASCO_SECTION = "bahia-carga" as SectionId;
const HULL_INSTANCE = "casco-bahia-carga" as PlacedComponentInstanceId;
const HULL_COMPONENT = "panel-casco-fixture" as ComponentId;
const ACIDO_BATERIA = "acido-de-bateria" as ChemicalSubstanceId;

function bahiaCargaFloorplan(): ShipFloorplan {
  return {
    id: "nave-caso-07",
    archetype: "investigacion",
    nameKey: "ship.caso07",
    gridSize: { width: 2, height: 1 },
    sections: [
      { id: CASCO_SECTION, nameKey: "section.bahia-carga", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    ],
    conduits: [],
    anchors: [],
    componentSeeds: [],
  };
}

function blueprintWithHullPanel(): Blueprint {
  return {
    metadata: {
      schemaVersion: 4,
      id: "caso-07-fixture",
      name: "Caso 7 fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: HULL_INSTANCE,
        componentDefinitionId: HULL_COMPONENT,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      },
    ],
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [
      {
        sectionId: CASCO_SECTION,
        // Fuga de ácido de batería en la sección — concentración por encima
        // del umbral de exposición (`CORROSIVE_ONSET_CONCENTRATION`).
        gases: [[ACIDO_BATERIA, 0.5]],
        temperatureCelsius: 21,
        pressureKpa: 101,
      },
    ],
    unpoweredSectionIds: [],
    overloadedRefs: [],
  };
}

describe("case 7 — La Neutralización de Emergencia", () => {
  it("neutralizing the acid leak in time halts hull corrosion before it fails, and the scar survives a save round-trip", () => {
    const shipFloorplan = bahiaCargaFloorplan();
    const shipState = new MutableShipState(blueprintWithHullPanel());
    const atmosphereRuntime = new MissionAtmosphereRuntime(
      shipFloorplan,
      shipState.get().sectionAtmospheres,
    );
    const { registry: chemicalRegistry } = buildChemicalCatalog();
    const componentRegistry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
    componentRegistry.register(HULL_COMPONENT, {
      level: "atomic",
      id: HULL_COMPONENT,
      name: "Panel de casco (fixture)",
      data: { footprint: { width: 1, height: 1 }, material: { RE: "A" } },
    });
    const structuralRuntime = new MissionStructuralRuntime(
      shipState,
      shipFloorplan,
      atmosphereRuntime,
      componentRegistry,
      chemicalRegistry,
    );

    const run = (seconds: number): void => {
      for (let t = 0; t < seconds; t += 1) {
        atmosphereRuntime.tick(tickOf(t));
        structuralRuntime.tick(tickOf(t));
      }
    };

    // La fuga corroe el casco sin intervención: 8s a corrosivo alto (~7.5s/nivel) ya degrada un nivel.
    run(8);
    const hullAfterExposure = shipState.get().placedComponents.find((entry) => entry.instanceId === HULL_INSTANCE);
    expect(hullAfterExposure?.structuralResistanceOverride).toBe("M");

    // El jugador mezcla base disponible en el mismo pasillo: ácido+base neutraliza (verificado con el motor de reacciones puro).
    const acidoBateria = chemicalRegistry.get(ACIDO_BATERIA)!;
    const baseLaboratorio = chemicalRegistry.get("base-de-laboratorio" as ChemicalSubstanceId)!;
    const acidReactant: ReactantSubstance = { id: acidoBateria.id, name: acidoBateria.name, tags: acidoBateria.data.tags };
    const baseReactant: ReactantSubstance = {
      id: baseLaboratorio.id,
      name: baseLaboratorio.name,
      tags: baseLaboratorio.data.tags,
    };
    const context: ReactionContext = {
      reactants: [acidReactant, baseReactant],
      oxygen: "normal",
      ignitionPresent: false,
      thermalRegulatorOverloaded: false,
      elapsedSeconds: 8,
    };
    const outcome = new ReactionResolver().resolve(context);
    expect(outcome.result?.name).toBe("Solución neutralizada");
    expect(outcome.events.some((e) => e.kind === "neutralization")).toBe(true);

    // La neutralización retira el ácido de la atmósfera de la sección — el
    // jugador ya resolvió la fuga, la cicatriz existente no crece más.
    atmosphereRuntime.atmosphereOf(CASCO_SECTION)!.gases.set(ACIDO_BATERIA, 0);

    // Sin más corrosivo activo, el casco no degrada más aunque pase mucho más
    // tiempo — la cicatriz ya hecha persiste, pero no crece.
    run(60);
    const hullAfterNeutralizing = shipState.get().placedComponents.find((entry) => entry.instanceId === HULL_INSTANCE);
    expect(hullAfterNeutralizing?.structuralResistanceOverride).toBe("M");

    // La cicatriz sobrevive un guardado real (Fase 11b, schema v4) — no es
    // solo estado en memoria de la sesión de misión.
    const restored = deserializeBlueprint(serializeBlueprint(shipState.get()));
    expect(
      restored.placedComponents.find((entry) => entry.instanceId === HULL_INSTANCE)?.structuralResistanceOverride,
    ).toBe("M");
  });
});
