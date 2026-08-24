import { describe, expect, it } from "vitest";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type {
  Blueprint,
  PlacedComponentInstance,
  PlacedComponentInstanceId,
} from "../blueprint/blueprint.types.js";
import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemistry/chemical-substance.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { ReactionDomainEvent } from "../chemistry/reaction/reaction-events.types.js";
import type { IntegrityDomainEvent } from "../integrity/integrity-events.types.js";
import { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import { MissionSectionIntegrityRuntime } from "./mission-section-integrity-runtime.js";
import { sectionBreachPressureSink } from "./section-breach-pressure-sink.js";
import { composePressureSinks } from "./composite-pressure-sink.js";
import { MutableShipState } from "./mutable-ship-state.js";

const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

const SECTION = "bahia-carga" as SectionId;
const PLATE = "plancha-metalica" as ComponentId;
const CRATE = "caja-generica" as ComponentId;
const CRATE_INSTANCE = "caja-1" as PlacedComponentInstanceId;

function componentRegistry(): MapEntityRegistry<ComponentId, PhysicalComponentDefinition> {
  const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  // Parche válido: estructura (EST) con RE suficiente — identidad por
  // propiedades, no por id (ver `isBreachPatch`).
  registry.register(PLATE, {
    level: "atomic",
    id: PLATE,
    name: "Plancha metálica",
    data: {
      footprint: { width: 2, height: 2 },
      functional: [{ tag: "EST", damageResistance: 50, articulatedRange: undefined }],
      material: { RE: "M" },
    },
  });
  // Pieza cualquiera de la sección: se daña al colapsar, pero no sirve de parche.
  registry.register(CRATE, {
    level: "atomic",
    id: CRATE,
    name: "Caja",
    data: { footprint: { width: 1, height: 1 }, material: { RE: "B" } },
  });
  return registry;
}

const chemicalRegistry = new MapEntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>();

function placed(
  instanceId: PlacedComponentInstanceId,
  definitionId: ComponentId,
  x: number,
  y: number,
  footprint = { width: 1, height: 1 },
): PlacedComponentInstance {
  return {
    instanceId,
    componentDefinitionId: definitionId,
    placement: { position: { x, y }, footprint, rotation: 0 },
    condition: "ok",
    wear: "nuevo",
  };
}

function blueprintWith(placedComponents: PlacedComponentInstance[]): Blueprint {
  return {
    metadata: {
      schemaVersion: 9,
      id: "t",
      name: "t",
      engineVersion: "0.0.0",
      createdAt: "2026-08-24",
      updatedAt: "2026-08-24",
    },
    placedComponents,
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: {
      sectionAllocations: [],
      instancePriorities: [],
      permanentlyDisconnectedSectionIds: [],
      dischargedSourceIds: [],
    },
  };
}

/** Sección de 3×3 celdas → 90 HP con los parámetros por defecto. */
function fixtureFloorplan(): ShipFloorplan {
  const cells = [];
  for (let x = 0; x < 3; x += 1) {
    for (let y = 0; y < 3; y += 1) {
      cells.push({ x, y });
    }
  }
  return {
    id: "fixture",
    archetype: "exploracion",
    nameKey: "fixture",
    gridSize: { width: 3, height: 3 },
    sections: [{ id: SECTION, nameKey: "fixture-section", cells }],
    conduits: [],
    anchors: [],
    componentSeeds: [],
  };
}

/**
 * Monta el sistema REAL: atmósfera, integridad y sumidero de brecha
 * compuestos como en producción. Nada de dobles que implementen la semántica
 * bajo prueba — el único stub es el azar del colapso, que es I/O.
 */
function mount(options: { readonly random?: () => number } = {}) {
  const floorplan = fixtureFloorplan();
  const shipState = new MutableShipState(blueprintWith([placed(CRATE_INSTANCE, CRATE, 1, 1)]));
  const registry = componentRegistry();
  const reactionEvents = new EventEmitter<ReactionDomainEvent>();
  const integrityEvents = new EventEmitter<IntegrityDomainEvent>();
  const fired: IntegrityDomainEvent[] = [];
  const explosions: ReactionDomainEvent[] = [];
  integrityEvents.onAny((event) => fired.push(event));
  reactionEvents.onAny((event) => explosions.push(event));

  // Declaración diferida: el sumidero de presión y el piso por sección se
  // resuelven por closure contra el runtime que todavía no existe — es el
  // mismo nudo que se ata en producción (`mission-runtime.ts`).
  // eslint-disable-next-line prefer-const
  let integrityRuntime: MissionSectionIntegrityRuntime;
  const atmosphereRuntime = new MissionAtmosphereRuntime(
    floorplan,
    [],
    composePressureSinks(
      sectionBreachPressureSink(shipState, () => integrityRuntime.openBreaches(), registry),
    ),
    undefined,
    (sectionId) => integrityRuntime.pressureFloorFor(sectionId),
  );
  integrityRuntime = new MissionSectionIntegrityRuntime({
    shipState,
    shipFloorplan: floorplan,
    atmosphereRuntime,
    chemicalRegistry,
    componentRegistry: registry,
    emitter: integrityEvents,
    reactionEvents,
    random: options.random,
  });

  return { floorplan, shipState, registry, atmosphereRuntime, integrityRuntime, fired, explosions, reactionEvents };
}

describe("13f — una explosión abre una brecha que drena presión", () => {
  it("la combustión daña la sección, la colapsa y la vacía hasta el vacío real", () => {
    // `random: () => 0.99` fija el máximo de explosiones de colapso: el peor
    // caso, no el cómodo.
    const world = mount({ random: () => 0.99 });

    // Tres explosiones de media sección (120 cada una) sobre 90 HP: la primera
    // ya la revienta.
    world.reactionEvents.emit({
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
      sectionId: SECTION,
      elapsedSeconds: 0,
    });

    expect(world.integrityRuntime.integrityOf(SECTION)?.breached).toBe(true);
    expect(world.fired.some((event) => event.kind === "section-breached")).toBe(true);

    // La maquinaria de adentro salió dañada.
    const crate = world.shipState.get().placedComponents[0];
    expect(crate?.wear).toBe("usado");

    // Y hubo explosiones REALES por el emisor de reacciones (la que provocó el
    // colapso + las del colapso), no un efecto visual aparte.
    expect(world.explosions.length).toBeGreaterThan(1);

    // La presión cae hasta 0 y no se queda en el piso de 40 kPa de una fuga
    // normal: eso es lo que distingue a una sección colapsada.
    for (let second = 1; second <= 20; second += 1) {
      world.atmosphereRuntime.tick(tickOf(second));
    }
    expect(world.atmosphereRuntime.atmosphereOf(SECTION)?.pressureKpa).toBe(0);
  });

  it("el colapso no se realimenta: sus propias explosiones no vuelven a dañarla", () => {
    const world = mount({ random: () => 0.99 });
    world.reactionEvents.emit({
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
      sectionId: SECTION,
      elapsedSeconds: 0,
    });

    // Una sola brecha, por muchas explosiones que dispare el colapso.
    expect(world.fired.filter((event) => event.kind === "section-breached")).toHaveLength(1);
  });

  it("instalar una pieza estructural sobre la brecha detiene la fuga pero NO devuelve la vida", () => {
    const world = mount();
    world.reactionEvents.emit({
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
      sectionId: SECTION,
      elapsedSeconds: 0,
    });
    const breach = world.integrityRuntime.openBreaches()[0]!;

    // Presurizada a mano para poder ver si la fuga se detuvo de verdad.
    const atmosphere = world.atmosphereRuntime.atmosphereOf(SECTION)!;
    atmosphere.pressureKpa = 101;

    const blueprint = world.shipState.get();
    world.shipState.set({
      ...blueprint,
      placedComponents: [
        ...blueprint.placedComponents,
        placed("parche" as PlacedComponentInstanceId, PLATE, breach.cell.x, breach.cell.y, {
          width: 2,
          height: 2,
        }),
      ],
    });

    for (let second = 1; second <= 20; second += 1) {
      world.atmosphereRuntime.tick(tickOf(second));
    }

    expect(world.atmosphereRuntime.atmosphereOf(SECTION)?.pressureKpa).toBe(101);
    // La cicatriz sigue ahí (principio 5): sellar tapa el agujero, no repara
    // el casco. Un golpe más y se vuelve a abrir.
    expect(world.integrityRuntime.integrityOf(SECTION)?.hp).toBe(0);
    expect(world.integrityRuntime.fractionOf(SECTION)).toBe(0);
  });

  it("una pieza que no es estructura no sirve de parche", () => {
    const world = mount();
    world.reactionEvents.emit({
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
      sectionId: SECTION,
      elapsedSeconds: 0,
    });
    const breach = world.integrityRuntime.openBreaches()[0]!;

    const blueprint = world.shipState.get();
    world.shipState.set({
      ...blueprint,
      placedComponents: [
        ...blueprint.placedComponents,
        placed("caja-2" as PlacedComponentInstanceId, CRATE, breach.cell.x, breach.cell.y),
      ],
    });

    for (let second = 1; second <= 20; second += 1) {
      world.atmosphereRuntime.tick(tickOf(second));
    }

    expect(world.atmosphereRuntime.atmosphereOf(SECTION)?.pressureKpa).toBe(0);
  });

  it("la descompresión sola deteriora la sección pero nunca la abre", () => {
    const world = mount();
    const atmosphere = world.atmosphereRuntime.atmosphereOf(SECTION)!;
    atmosphere.pressureKpa = 0;
    atmosphere.gases.set(GAS.OXYGEN, 0);

    for (let second = 1; second <= 500; second += 1) {
      world.integrityRuntime.tick(tickOf(second));
    }

    const integrity = world.integrityRuntime.integrityOf(SECTION)!;
    expect(integrity.breached).toBe(false);
    expect(integrity.hp).toBeGreaterThan(0);
    expect(integrity.hp).toBeLessThan(integrity.maxHp);
  });
});
