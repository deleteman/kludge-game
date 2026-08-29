import { describe, expect, it } from "vitest";
import {
  allEmittersActive,
  buildComponentCatalog,
  MissionPowerRuntime,
  MissionSignalRuntime,
  motionAwareEmitterInputs,
  MutableShipState,
  type Blueprint,
  type ComponentId,
  type GridPosition,
  type PlacedComponentInstanceId,
  type ShipFloorplan,
  type SignalEdgeId,
  type SignalNodeId,
} from "../index.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

/**
 * Fotorreceptor → cable → indicador LED, con el reparto de energía REAL en el
 * medio (Subfase 13g).
 *
 * Por qué monta `MissionPowerRuntime` de verdad en vez de inyectar un
 * `isInstancePowered` a mano, como hace `door-signal-chain.integration.test.ts`
 * (patrones 13 y 43 de la memoria de playtest): el bug que 13g cierra es
 * precisamente que el predicado real devolvía `true` para todo el catálogo. Un
 * doble que implemente la semántica correcta habría estado en verde con el bug
 * puesto — probaría el doble, no el runtime. Acá el único dato de entrada es la
 * asignación del jugador, igual que en partida.
 */

const SALA = "sala" as SectionId;
const SENSOR = "sensor-1" as PlacedComponentInstanceId;
const SENSOR_NODE = "sensor-1:em" as SignalNodeId;
const LED = "led-1" as PlacedComponentInstanceId;
const LED_NODE = "led-1:rec" as SignalNodeId;
const FUENTE = "fuente-1" as PlacedComponentInstanceId;

const REGISTRY = buildComponentCatalog().registry;

function floorplan(): ShipFloorplan {
  return {
    id: "nave-test",
    archetype: "exploracion",
    nameKey: "ship.test",
    gridSize: { width: 4, height: 1 },
    sections: [
      {
        id: SALA,
        nameKey: "section.sala",
        cells: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 3, y: 0 },
        ],
      },
    ],
    conduits: [],
    anchors: [],
    componentSeeds: [],
    doors: [],
  };
}

function instance(
  instanceId: PlacedComponentInstanceId,
  componentDefinitionId: string,
  position: GridPosition,
) {
  return {
    instanceId,
    componentDefinitionId: componentDefinitionId as ComponentId,
    placement: { position, footprint: { width: 1, height: 1 }, rotation: 0 as const },
    condition: "ok" as const,
    wear: "nuevo" as const,
  };
}

function blueprintWith(unitsForSala: number): Blueprint {
  return {
    metadata: {
      schemaVersion: 10,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
    },
    placedComponents: [
      instance(SENSOR, "fotorreceptor", { x: 0, y: 0 }),
      instance(LED, "indicador-led", { x: 1, y: 0 }),
      // La fuente da presupuesto a la nave; lo que el test mueve es cuánto de
      // ese presupuesto llega a la sala.
      instance(FUENTE, "celula-fotovoltaica", { x: 3, y: 0 }),
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [
        { id: SENSOR_NODE, role: "emitter", position: { x: 0, y: 0 }, ownerRef: SENSOR },
        { id: LED_NODE, role: "receptor", position: { x: 1, y: 0 }, ownerRef: LED },
      ],
      edges: [{ id: "cable-1" as SignalEdgeId, from: SENSOR_NODE, to: LED_NODE }],
    },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    overloadedRefs: [],
    powerState: {
      sectionAllocations: unitsForSala > 0 ? [{ sectionId: SALA, units: unitsForSala }] : [],
      instancePriorities: [],
      permanentlyDisconnectedSectionIds: [],
      dischargedSourceIds: [],
    },
  };
}

function mountChain(unitsForSala: number, blockedCells: ReadonlyArray<GridPosition> = []) {
  const plan = floorplan();
  const shipState = new MutableShipState(blueprintWith(unitsForSala));
  const blocked = {
    isBlocked: (cell: GridPosition) =>
      blockedCells.some((entry) => entry.x === cell.x && entry.y === cell.y),
  };

  let actors: GridPosition[] = [];
  const powerRuntime = new MissionPowerRuntime(shipState, plan, REGISTRY);
  const signalRuntime = new MissionSignalRuntime(
    shipState,
    // Base `allEmittersActive`, LA MISMA que produccion. Con el mapa vacio que
    // este test usaba en 13g, un emisor que el resolvedor no supiera resolver
    // salia `false` aca y `true` en el juego — o sea que el bug de la ronda 1
    // (el LED siempre encendido) era invisible por construccion.
    motionAwareEmitterInputs(
      shipState,
      () => actors,
      blocked,
      REGISTRY,
      allEmittersActive(shipState),
    ),
    undefined,
    powerRuntime,
    powerRuntime,
  );

  // Mismo orden que el core loop de `MissionRuntime`: energía y después señales.
  const tick = (elapsedSeconds: number): void => {
    const ctx: TickContext = { dtSeconds: 0.5, elapsedSeconds };
    powerRuntime.tick(ctx);
    signalRuntime.tick(ctx);
  };

  const run = (seconds: number, from = 0): number => {
    let elapsed = from;
    for (let step = 0; step < Math.round(seconds / 0.5); step += 1) {
      elapsed += 0.5;
      tick(elapsed);
    }
    return elapsed;
  };

  return {
    shipState,
    powerRuntime,
    signalRuntime,
    run,
    moveActorsTo: (positions: GridPosition[]) => {
      actors = positions;
    },
    setSalaUnits: (units: number) => {
      const blueprint = shipState.get();
      shipState.set({
        ...blueprint,
        powerState: {
          ...blueprint.powerState,
          sectionAllocations: units > 0 ? [{ sectionId: SALA, units }] : [],
        },
      });
      powerRuntime.recalculate();
    },
  };
}

describe("cadena de señal con el reparto de energía real (Subfase 13g)", () => {
  it("con energía suficiente, el sensor emite y la señal llega al LED", () => {
    const { signalRuntime, run, moveActorsTo } = mountChain(2);
    moveActorsTo([{ x: 0, y: 0 }]);
    run(2);

    expect(signalRuntime.outputOf(SENSOR_NODE)).toBe(true);
    expect(signalRuntime.outputOf(LED_NODE)).toBe(true);
  });

  it("CON energía y SIN nadie cerca, el LED queda apagado", () => {
    // El bug de la ronda 1 de playtest de 13g, y el caso que faltaba: los tests
    // de 13g probaban el positivo (actor encima del sensor) y el apagado por
    // ENERGÍA, nunca el apagado por falta de estímulo. El operador lo vio antes
    // que la suite: "el LED se activa aunque el fotorreceptor detecte algo o no".
    const { signalRuntime, run } = mountChain(2);
    run(2);

    expect(signalRuntime.outputOf(SENSOR_NODE)).toBe(false);
    expect(signalRuntime.outputOf(LED_NODE)).toBe(false);
  });

  it("un actor dentro del rango pero detrás de una pared no dispara el sensor", () => {
    // Paredes y puertas cerradas cuentan: `/game` inyecta el mismo `blocked`
    // que usa el pathfinding, con `doorRuntime.blocksCell` incluido.
    const { signalRuntime, run, moveActorsTo } = mountChain(2, [{ x: 1, y: 0 }]);
    moveActorsTo([{ x: 2, y: 0 }]);
    run(2);

    expect(signalRuntime.outputOf(SENSOR_NODE)).toBe(false);
  });

  it("el actor se va y el LED se apaga: el sensor sigue el mundo en las dos direcciones", () => {
    const { signalRuntime, run, moveActorsTo } = mountChain(2);
    moveActorsTo([{ x: 0, y: 0 }]);
    const elapsed = run(2);
    expect(signalRuntime.outputOf(LED_NODE)).toBe(true);

    moveActorsTo([]);
    run(2, elapsed);
    expect(signalRuntime.outputOf(SENSOR_NODE)).toBe(false);
    expect(signalRuntime.outputOf(LED_NODE)).toBe(false);
  });

  it("en una sección a 0 unidades la señal NO llega, aunque el sensor esté activo", () => {
    // El corazón de 13g: hasta ahora `isInstancePowered` devolvía `true` para
    // todo el catálogo y este caso pasaba igual que el anterior.
    const { signalRuntime, powerRuntime, run, moveActorsTo } = mountChain(0);
    moveActorsTo([{ x: 0, y: 0 }]);
    run(2);

    expect(powerRuntime.isInstancePowered(SENSOR)).toBe(false);
    expect(powerRuntime.isInstancePowered(LED)).toBe(false);
    expect(signalRuntime.outputOf(SENSOR_NODE)).toBe(false);
    expect(signalRuntime.outputOf(LED_NODE)).toBe(false);
  });

  it("devolverle la energía a la sección restablece la señal en el mismo tick", () => {
    const { signalRuntime, run, moveActorsTo, setSalaUnits } = mountChain(0);
    moveActorsTo([{ x: 0, y: 0 }]);
    const elapsed = run(2);
    expect(signalRuntime.outputOf(SENSOR_NODE)).toBe(false);

    // El dial se opera en pausa, así que el efecto tiene que verse sin esperar
    // al siguiente tick (patrón 2: todo control da respuesta visible inmediata).
    setSalaUnits(2);
    expect(signalRuntime.outputOf(SENSOR_NODE)).toBe(true);
    expect(signalRuntime.outputOf(LED_NODE)).toBe(true);

    run(1, elapsed);
    expect(signalRuntime.outputOf(LED_NODE)).toBe(true);
  });

  it("con energía parcial el triaje decide quién queda encendido, no la sección entera", () => {
    // Sensor (1) + LED (1) = 2; con 1 unidad solo entra uno, y el orden es el
    // determinista de `allocateComponentPower` (prioridad, después instanceId).
    const { powerRuntime, run, moveActorsTo } = mountChain(1);
    moveActorsTo([{ x: 0, y: 0 }]);
    run(2);

    const powered = [SENSOR, LED].filter((id) => powerRuntime.isInstancePowered(id));
    expect(powered).toEqual([LED]);
    expect(powerRuntime.sectionHasNoPowerGranted(SALA)).toBe(false);
  });

  it("la fuente no consume: sigue alimentada aunque la sala esté a 0", () => {
    const { powerRuntime, run } = mountChain(0);
    run(1);
    expect(powerRuntime.isInstancePowered(FUENTE)).toBe(true);
  });
});
