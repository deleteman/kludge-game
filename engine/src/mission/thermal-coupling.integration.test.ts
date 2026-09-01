import { describe, expect, it } from "vitest";
import { MissionThermalRuntime } from "./mission-thermal-runtime.js";
import { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import { MissionOverloadRuntime } from "./mission-overload-runtime.js";
import { MissionReactionRuntime } from "./mission-reaction-runtime.js";
import { TransientGasInjection } from "./section-gas-injection.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import { ReactionResolver } from "../chemistry/reaction/reaction-resolver.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";
import { activeThermalRegulatorsBySection, sectionsWithThermalRegulator } from "./thermal-regulators.js";
import { thermalDamageRule } from "../integrity/section-damage-rules.js";
import { sectionArea } from "../floorplan/floorplan.types.js";
import { THERMAL_CONDUCTIVITY_PARAMETERS } from "../failure/thermal-conductivity-rule.js";
import { THERMAL_REGULATOR_OVERLOAD_CELSIUS } from "../atmosphere/thermal-parameters.js";
import type { ReactionDomainEvent } from "../chemistry/reaction/reaction-events.types.js";
import type { FailureDomainEvent } from "../failure/failure-events.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SectionIntegrity } from "../integrity/section-integrity.types.js";

/**
 * Integración de la Subfase 14a-2: los acoplamientos del eje térmico con los
 * otros dominios, recorridos **juntos y con la pila real**.
 *
 * Los unitarios de cada lado ya pasaban antes de esta subfase y van a seguir
 * pasando después: lo que ningún test cubría es el pegamento, que es donde
 * estaban los tres agujeros que 14a-2 cierra (patrón 43). Por eso acá no se
 * inyecta ningún doble que imponga el valor del borde entre dos sistemas —
 * la temperatura sale de `MissionAtmosphereRuntime`, la carga del cableado real
 * y las capacidades del catálogo de verdad.
 */

const SALA = "sala" as SectionId;
// Subfase 14a-4: el conductor dejó de ser una pieza en una celda y pasó a ser
// el cable que tiende el jugador. El montaje es fuente → cable troncal → chip,
// con los LEDs colgando del chip: el troncal carga con todo lo de aguas abajo.
const FUENTE = "fuente-1" as PlacedComponentInstanceId;
const FUENTE_NODE = "fuente-1-em" as SignalNodeId;
const HUB = "chip-1" as PlacedComponentInstanceId;
const HUB_NODE = "chip-1-rec" as SignalNodeId;
const TRONCAL = "cable-troncal" as SignalEdgeId;
const TANQUE = "tanque-1" as PlacedComponentInstanceId;
const ENFRIADOR = "enfriador-1" as PlacedComponentInstanceId;
const ENFRIADOR_NODE = "enfriador-1-rec" as SignalNodeId;

const REGISTRY = buildComponentCatalog().registry;
const CHEMICALS = buildChemicalCatalog().registry;

const tickOf = (elapsed: number, dt = 1) => ({ dtSeconds: dt, elapsedSeconds: elapsed });

function floorplan(): ShipFloorplan {
  return {
    id: "nave-14a2",
    archetype: "investigacion",
    nameKey: "ship.test.name",
    gridSize: { width: 10, height: 1 },
    sections: [
      {
        id: SALA,
        nameKey: "section.sala",
        cells: Array.from({ length: 10 }, (_, x) => ({ x, y: 0 })),
      },
    ],
    conduits: [],
    anchors: [],
    componentSeeds: [],
    doors: [],
  };
}

interface SceneOptions {
  /** LEDs colgados del cable: cada uno suma su `powerDraw` real a la carga. */
  readonly ledCount: number;
  readonly withCryoTank?: boolean;
  readonly withCooler?: boolean;
}

function blueprintFor({ ledCount, withCryoTank, withCooler }: SceneOptions): Blueprint {
  const leds = Array.from({ length: ledCount }, (_, index) => index + 1);
  const place = (
    instanceId: PlacedComponentInstanceId,
    componentDefinitionId: string,
    x: number,
  ) => ({
    instanceId,
    componentDefinitionId: componentDefinitionId as ComponentId,
    placement: {
      position: { x, y: 0 },
      footprint: { width: 1, height: 1 },
      rotation: 0 as const,
    },
    condition: "ok" as const,
    wear: "nuevo" as const,
  });

  return {
    metadata: {
      schemaVersion: 5,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-08-31T00:00:00.000Z",
      updatedAt: "2026-08-31T00:00:00.000Z",
    },
    placedComponents: [
      place(FUENTE, "fotorreceptor", 0),
      place(HUB, "chip-circuito-generico", 1),
      ...leds.map((n) => place(`led-${n}` as PlacedComponentInstanceId, "indicador-led", n)),
      ...(withCryoTank ? [place(TANQUE, "tanque-muestra-criogenica", 8)] : []),
      ...(withCooler ? [place(ENFRIADOR, "sistema-refrigeracion-muestras", 9)] : []),
    ],
    reservoirContents: withCryoTank
      ? [
          {
            componentInstanceId: TANQUE,
            substanceId: "nitrogeno-liquido" as ChemicalSubstanceId,
            amount: 100,
          },
        ]
      : [],
    signalGraph: {
      nodes: [
        { id: FUENTE_NODE, role: "emitter" as const, position: { x: 0, y: 0 }, ownerRef: FUENTE },
        { id: HUB_NODE, role: "receptor" as const, position: { x: 1, y: 0 }, ownerRef: HUB },
        ...leds.map((n) => ({
          id: `led-${n}-rec` as SignalNodeId,
          role: "receptor" as const,
          position: { x: n, y: 0 },
          ownerRef: `led-${n}` as PlacedComponentInstanceId,
        })),
        ...(withCooler
          ? [
              {
                id: ENFRIADOR_NODE,
                role: "receptor" as const,
                position: { x: 9, y: 0 },
                ownerRef: ENFRIADOR,
              },
            ]
          : []),
      ],
      edges: [
        { id: TRONCAL, from: FUENTE_NODE, to: HUB_NODE, conductorId: "cable-cobre" as ComponentId },
        ...leds.map((n) => ({
          id: `rama-${n}` as SignalEdgeId,
          from: HUB_NODE,
          to: `led-${n}-rec` as SignalNodeId,
          conductorId: "cable-cobre" as ComponentId,
        })),
      ],
    },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    overloadedRefs: [],
    powerState: {
      sectionAllocations: [],
      instancePriorities: [],
      permanentlyDisconnectedSectionIds: [],
      dischargedSourceIds: [],
    },
  };
}

/**
 * Monta la pila igual que el core loop real, en su mismo orden de tick:
 * térmico → atmósfera → sobrecarga → reacciones.
 */
function buildScene(options: SceneOptions) {
  const plan = floorplan();
  const shipState = new MutableShipState(blueprintFor(options));
  const reactionEvents = new EventEmitter<ReactionDomainEvent>();
  const failureEvents = new EventEmitter<FailureDomainEvent>();
  const emitted: ReactionDomainEvent[] = [];
  reactionEvents.onAny((event) => emitted.push(event));

  // Todo alimentado y sin cables de señal activos: lo que se prueba acá es el
  // eje térmico, no el reparto de energía, pero la pieza real es la que decide.
  const isInstancePowered = () => true;
  const outputOf = () => false;

  const thermal = new MissionThermalRuntime(reactionEvents, failureEvents, () =>
    activeThermalRegulatorsBySection(shipState.get(), {
      registry: REGISTRY,
      floorplan: plan,
      isInstancePowered,
      outputOf,
    }),
  );
  const gasInjection = new TransientGasInjection({
    substanceOf: (substanceId) => CHEMICALS.get(substanceId),
    sectionVolumeOf: (sectionId) => {
      const section = plan.sections.find((entry) => entry.id === sectionId);
      return section && sectionArea(section);
    },
    onSpill: (sectionId, substanceId, amount) =>
      thermal.applySubstanceSpill(sectionId, substanceId, amount),
  });
  const atmosphere = new MissionAtmosphereRuntime(
    plan,
    [],
    undefined,
    gasInjection.asInjectionSource(),
    undefined,
    undefined,
    () => thermal.rates(),
  );
  const overload = new MissionOverloadRuntime(
    shipState,
    REGISTRY,
    [],
    failureEvents,
    plan,
    (sectionId) => atmosphere.atmosphereOf(sectionId),
  );
  const reactions = new MissionReactionRuntime(
    shipState,
    plan,
    [],
    new ReactionResolver(),
    (sectionId) => atmosphere.atmosphereOf(sectionId),
    reactionEvents,
    failureEvents,
    undefined,
    (substanceId) => CHEMICALS.get(substanceId),
    () => sectionsWithThermalRegulator(shipState.get(), { registry: REGISTRY, floorplan: plan }),
  );

  const tick = (elapsed: number, dt = 1) => {
    thermal.tick(tickOf(elapsed, dt));
    atmosphere.tick(tickOf(elapsed, dt));
    overload.tick(tickOf(elapsed, dt));
    reactions.tick(tickOf(elapsed, dt));
  };
  const temperature = () => atmosphere.atmosphereOf(SALA)!.temperatureCelsius;
  return { shipState, gasInjection, reactionEvents, emitted, tick, temperature };
}

describe("integración 14a-2: nitrógeno líquido → frío → conductor degradado → cortocircuito", () => {
  it("una carga segura revienta el cable después de vaciarle el tanque criogénico encima", () => {
    const { shipState, gasInjection, tick, temperature } = buildScene({
      ledCount: 4,
      withCryoTank: true,
    });

    // 1) Nave templada: el cable aguanta los 4 LEDs sin problema.
    for (let i = 0; i < 5; i += 1) {
      tick(i);
    }
    expect(shipState.get().overloadedRefs).toEqual([]);

    // 2) Se vuelca el tanque sobre la sala. El nitrógeno es `state: "L"` +
    //    `INERTE`: NO entra en la atmósfera, y hasta 14a-2 esto no hacía nada.
    gasInjection.inject(SALA, "nitrogeno-liquido" as ChemicalSubstanceId, 100);
    // Se mide DURANTE la ventana de frío, no después: el derrame es un pulso y
    // la climatización devuelve la sala al nominal en cuanto se agota. Medir al
    // final habría dado un verde/rojo que no describe el fenómeno.
    let coldest = Number.POSITIVE_INFINITY;
    for (let i = 5; i < 40; i += 1) {
      tick(i);
      coldest = Math.min(coldest, temperature());
    }

    // 3) La sala cruzó el umbral de degradación y el cable se cortó SIN que la
    //    carga cambiara: el cableado es el mismo que en el paso 1.
    expect(coldest).toBeLessThan(THERMAL_CONDUCTIVITY_PARAMETERS.triggerTemperatureCelsius);
    expect(shipState.get().overloadedRefs).toEqual([TRONCAL]);

    // 4) Y la sala se recupera sola: el derrame es un evento con final, igual
    //    que el incendio de 14a-1. La cicatriz del cable, en cambio, se queda.
    expect(temperature()).toBeGreaterThan(coldest);
  });

  it("sin el tanque, la misma carga y los mismos ticks no rompen nada", () => {
    // El control del experimento: sin esto, un cable que revienta solo daría el
    // mismo verde y el test no probaría el acoplamiento.
    const { shipState, tick } = buildScene({ ledCount: 4 });
    for (let i = 0; i < 40; i += 1) {
      tick(i);
    }
    expect(shipState.get().overloadedRefs).toEqual([]);
  });

  it("aguanta la cadencia real de frame, no solo ticks de 1 s", () => {
    // Patrón 25: una tasa continua evaluada a 1 tick = 1 s puede esconder que a
    // ~0.016 s el fenómeno no ocurre nunca.
    const { shipState, gasInjection, tick, temperature } = buildScene({
      ledCount: 4,
      withCryoTank: true,
    });
    gasInjection.inject(SALA, "nitrogeno-liquido" as ChemicalSubstanceId, 100);
    const dt = 1 / 60;
    let coldest = Number.POSITIVE_INFINITY;
    for (let frame = 0; frame < 60 * 30; frame += 1) {
      tick(frame * dt, dt);
      coldest = Math.min(coldest, temperature());
    }
    expect(coldest).toBeLessThan(THERMAL_CONDUCTIVITY_PARAMETERS.triggerTemperatureCelsius);
    expect(shipState.get().overloadedRefs).toEqual([TRONCAL]);
  });
});

describe("integración 14a-2: combustión → calor → regulador sobrecargado → ignición espontánea", () => {
  it("un volátil en el aire se enciende solo cuando el regulador térmico no da abasto", () => {
    const { gasInjection, reactionEvents, emitted, tick, temperature } = buildScene({
      ledCount: 0,
      withCooler: true,
    });

    // 1) Disolvente volátil en el aire (es `VOLAT`, así que SÍ entra en la
    //    atmósfera) y sala templada: no pasa nada.
    gasInjection.inject(SALA, "disolvente-volatil" as ChemicalSubstanceId, 60);
    for (let i = 0; i < 5; i += 1) {
      tick(i);
    }
    expect(emitted.some((event) => event.kind === "spontaneous-ignition")).toBe(false);

    // 2) Un incendio calienta la sala por encima del umbral del regulador.
    reactionEvents.emit({
      kind: "combustion",
      elapsedSeconds: 5,
      intensity: "violent",
      radius: "half-section",
      crewDamage: "high",
      sectionId: SALA,
    });
    let hottest = Number.NEGATIVE_INFINITY;
    for (let i = 5; i < 15; i += 1) {
      tick(i);
      hottest = Math.max(hottest, temperature());
    }

    // El pico se mide mientras arde. Y es un pico BAJO a propósito: el enfriador
    // instalado está peleando contra el incendio, que es justo lo que obligó a
    // recalibrar `THERMAL_REGULATOR_OVERLOAD_CELSIUS`.
    expect(hottest).toBeGreaterThan(THERMAL_REGULATOR_OVERLOAD_CELSIUS);
    expect(emitted.some((event) => event.kind === "spontaneous-ignition")).toBe(true);
  });

  it("sin regulador instalado no hay ignición espontánea por mucho que arda", () => {
    // `thermalRegulatorOverloaded` significa "el regulador se rindió", no "hace
    // calor": sin regulador no hay nada que se rinda.
    const { gasInjection, reactionEvents, emitted, tick } = buildScene({ ledCount: 0 });
    gasInjection.inject(SALA, "disolvente-volatil" as ChemicalSubstanceId, 60);
    reactionEvents.emit({
      kind: "combustion",
      elapsedSeconds: 0,
      intensity: "violent",
      radius: "half-section",
      crewDamage: "high",
      sectionId: SALA,
    });
    for (let i = 0; i < 15; i += 1) {
      tick(i);
    }
    expect(emitted.some((event) => event.kind === "spontaneous-ignition")).toBe(false);
  });

  it("no repite el evento tick tras tick mientras nada cambia", () => {
    // Patrón 26: un efecto que no cambió nada no debe emitir evento.
    const { gasInjection, reactionEvents, emitted, tick } = buildScene({
      ledCount: 0,
      withCooler: true,
    });
    gasInjection.inject(SALA, "disolvente-volatil" as ChemicalSubstanceId, 60);
    reactionEvents.emit({
      kind: "combustion",
      elapsedSeconds: 0,
      intensity: "violent",
      radius: "half-section",
      crewDamage: "high",
      sectionId: SALA,
    });
    for (let i = 0; i < 30; i += 1) {
      tick(i);
    }
    const ignitions = emitted.filter((event) => event.kind === "spontaneous-ignition");
    expect(ignitions.length).toBeGreaterThan(0);
    expect(ignitions.length).toBeLessThan(5);
  });
});

describe("integración 14a-2: el calor y el frío dañan la estructura de la sección", () => {
  const integrity: SectionIntegrity = { hp: 100, maxHp: 100, breached: false };
  const damageAt = (temperatureCelsius: number) =>
    thermalDamageRule.damageFor({
      atmosphere: {
        gases: new Map(),
        temperatureCelsius,
        pressureKpa: 101,
      },
      integrity,
      chemicalRegistry: CHEMICALS,
      dtSeconds: 1,
    }).amount;

  it("no daña en el rango de operación de la nave", () => {
    expect(damageAt(21)).toBe(0);
    expect(damageAt(59)).toBe(0);
  });

  it("daña por calor y por frío, y escala con lo extremo que sea", () => {
    expect(damageAt(150)).toBeGreaterThan(0);
    expect(damageAt(600)).toBeGreaterThan(damageAt(150));
    expect(damageAt(-60)).toBeGreaterThan(0);
    expect(damageAt(-79)).toBeGreaterThan(damageAt(-60));
  });

  it("no pone piso: el fuego SÍ puede llegar a reventar una sección", () => {
    expect(
      thermalDamageRule.damageFor({
        atmosphere: { gases: new Map(), temperatureCelsius: 400, pressureKpa: 101 },
        integrity,
        chemicalRegistry: CHEMICALS,
        dtSeconds: 1,
      }).floorHp,
    ).toBeUndefined();
  });
});
