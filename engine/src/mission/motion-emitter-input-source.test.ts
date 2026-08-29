import { describe, expect, it } from "vitest";
import { motionAwareEmitterInputs } from "./motion-emitter-input-source.js";
import { MutableShipState } from "./mutable-ship-state.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { CellBlockedQuery } from "../geometry/line-of-sight.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";

/** Catálogo REAL: el bug de la ronda 1 de 13g solo se manifiesta con las piezas de verdad. */
const REGISTRY = buildComponentCatalog().registry;

const SENSOR_INSTANCE = "sensor-instance" as PlacedComponentInstanceId;
const SENSOR_NODE = "sensor-node" as SignalNodeId;

function buildFixtureBlueprint(componentDefinitionId = "fotorreceptor"): Blueprint {
  return {
    metadata: {
      schemaVersion: 4,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-08-04T00:00:00.000Z",
      updatedAt: "2026-08-04T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: SENSOR_INSTANCE,
        componentDefinitionId: componentDefinitionId as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [
        {
          id: SENSOR_NODE,
          role: "emitter",
          position: { x: 0, y: 0 },
          ownerRef: SENSOR_INSTANCE,
        },
      ],
      edges: [],
    },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [], dischargedSourceIds: [] },
  };
}

const NOTHING_BLOCKED: CellBlockedQuery = { isBlocked: () => false };

describe("mission: motionAwareEmitterInputs (Fase 13a, deuda #3)", () => {
  it("se dispara si hay un actor dentro de rango con línea de visión despejada", () => {
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const inputs = motionAwareEmitterInputs(
      shipState,
      () => [{ x: 3, y: 0 }],
      NOTHING_BLOCKED,
      REGISTRY,
      () => new Map(),
    );
    expect(inputs().get(SENSOR_NODE)).toBe(true);
  });

  it("no se dispara si el actor está dentro de rango pero detrás de una pared", () => {
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const blocked: CellBlockedQuery = { isBlocked: (cell) => cell.x === 1 && cell.y === 0 };
    const inputs = motionAwareEmitterInputs(
      shipState,
      () => [{ x: 3, y: 0 }],
      blocked,
      REGISTRY,
      () => new Map(),
    );
    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });

  it("no se dispara si el actor está fuera de rango, aunque tenga línea de visión", () => {
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const inputs = motionAwareEmitterInputs(
      shipState,
      () => [{ x: 20, y: 0 }],
      NOTHING_BLOCKED,
      REGISTRY,
      () => new Map(),
    );
    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });

  it("no se dispara si no hay ningún actor", () => {
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const inputs = motionAwareEmitterInputs(shipState, () => [], NOTHING_BLOCKED, REGISTRY, () => new Map());
    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });

  it("preserva las entradas de la fuente base para emisores que no son sensores ópticos", () => {
    const OTHER_NODE = "other-node" as SignalNodeId;
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const inputs = motionAwareEmitterInputs(
      shipState,
      () => [],
      NOTHING_BLOCKED,
      REGISTRY,
      () => new Map([[OTHER_NODE, true]]),
    );
    expect(inputs().get(OTHER_NODE)).toBe(true);
    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });

  /**
   * Ronda 1 de playtest de 13g. Estos dos casos son los que la suite NO podía
   * ver antes: la búsqueda de la propiedad `EM` iba contra
   * `ATOMIC_COMPONENT_CATALOG`, así que un sensor COMPUESTO nunca se resolvía y
   * caía en el fail-open — o sea que se quedaba con el `true` de
   * `allEmittersActive` y estaba permanentemente disparado en partida.
   */
  describe("cobertura de sensores compuestos (13g ronda 1)", () => {
    it("un sensor COMPUESTO se resuelve y NO se dispara sin actores", () => {
      const shipState = new MutableShipState(buildFixtureBlueprint("sensor-movimiento-laser"));
      const inputs = motionAwareEmitterInputs(
        shipState,
        () => [],
        NOTHING_BLOCKED,
        REGISTRY,
        // La base de PRODUCCIÓN es "todos los emisores activos": si el
        // resolvedor no cubre la pieza, este valor sobrevive y el sensor
        // miente. Con un mapa vacío como base el test pasaría igual con el
        // bug puesto.
        () => new Map([[SENSOR_NODE, true]]),
      );
      expect(inputs().get(SENSOR_NODE)).toBe(false);
    });

    it("un sensor COMPUESTO sí se dispara con un actor a la vista", () => {
      const shipState = new MutableShipState(buildFixtureBlueprint("sensor-movimiento-laser"));
      const inputs = motionAwareEmitterInputs(
        shipState,
        () => [{ x: 3, y: 0 }],
        NOTHING_BLOCKED,
        REGISTRY,
        () => new Map(),
      );
      expect(inputs().get(SENSOR_NODE)).toBe(true);
    });
  });
});
