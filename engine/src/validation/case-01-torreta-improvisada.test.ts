// GDD 9, caso 1 — "Torreta improvisada": sensor de movimiento + láser médico + brazo articulado + batería, combinados por propiedades compartidas (principio 1), no por identidad de componente.
import { describe, expect, it } from "vitest";
import {
  createPhysicalComponentFactory,
  EventEmitter,
  isCompositeEntity,
  MapEntityRegistry,
  SignalEvaluator,
  type ComponentId,
  type PhysicalComponentDefinition,
  type SignalDomainEvent,
  type SignalEdge,
  type SignalEdgeId,
  type SignalEmitterInputs,
  type SignalGraph,
  type SignalNode,
  type SignalNodeId,
  type TickContext,
} from "../index.js";

const SENSOR_MOVIMIENTO = "sensor-movimiento" as ComponentId;
const LASER_MEDICO = "laser-medico" as ComponentId;
const BRAZO_ARTICULADO = "brazo-articulado" as ComponentId;
const BATERIA = "bateria" as ComponentId;
const TORRETA = "torreta-improvisada" as ComponentId;

const id = (value: string): SignalNodeId => value as SignalNodeId;
const tickOf = (elapsed: number, dt = 1): TickContext => ({
  dtSeconds: dt,
  elapsedSeconds: elapsed,
});

describe("case 1 — Torreta improvisada", () => {
  it("assembles a turret from 4 intact components by shared functional tags, not by hardcoded identity", () => {
    const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
    const factory = createPhysicalComponentFactory(registry);

    const sensor = factory.buildAtomic({
      id: SENSOR_MOVIMIENTO,
      name: "Sensor de movimiento",
      data: {
        footprint: { width: 1, height: 1 },
        functional: [{ tag: "EM", range: 5, triggerType: "motion", frequency: 1 }],
      },
    });
    registry.register(sensor.id, sensor);

    const laser = factory.buildAtomic({
      id: LASER_MEDICO,
      name: "Láser médico",
      data: {
        footprint: { width: 1, height: 1 },
        functional: [{ tag: "ACT", power: 20, cadence: 1, directional: true }],
      },
    });
    registry.register(laser.id, laser);

    const brazo = factory.buildAtomic({
      id: BRAZO_ARTICULADO,
      name: "Brazo articulado",
      data: {
        footprint: { width: 1, height: 2 },
        functional: [{ tag: "EST", damageResistance: 5, articulatedRange: 180 }],
      },
    });
    registry.register(brazo.id, brazo);

    const bateria = factory.buildAtomic({
      id: BATERIA,
      name: "Batería",
      data: {
        footprint: { width: 1, height: 1 },
        functional: [{ tag: "RES", resourceType: "E", capacity: 50, dischargeRate: 5 }],
      },
    });
    registry.register(bateria.id, bateria);

    // El motor no conoce "torreta" como concepto: la ensambla por combinar
    // 4 refs con sus propiedades funcionales, ninguna regla especial que
    // busque "sensor + láser + brazo + batería" por nombre (principio 1).
    const turret = factory.buildComposite({
      id: TORRETA,
      name: "Torreta improvisada",
      data: {
        functional: [
          ...(sensor.data.functional ?? []),
          ...(laser.data.functional ?? []),
          ...(brazo.data.functional ?? []),
          ...(bateria.data.functional ?? []),
        ],
      },
      recipe: {
        ingredients: [
          { ref: SENSOR_MOVIMIENTO, quantity: 1 },
          { ref: LASER_MEDICO, quantity: 1 },
          { ref: BRAZO_ARTICULADO, quantity: 1 },
          { ref: BATERIA, quantity: 1 },
        ],
      },
    });
    registry.register(turret.id, turret);

    expect(isCompositeEntity(turret)).toBe(true);
    const resolved = factory.resolveIngredients(turret.recipe);
    expect(resolved.map((r) => r.entity.id).sort()).toEqual(
      [SENSOR_MOVIMIENTO, LASER_MEDICO, BRAZO_ARTICULADO, BATERIA].sort(),
    );
    expect(turret.data.functional?.map((f) => f.tag).sort()).toEqual(["ACT", "EM", "EST", "RES"]);

    // Combinación funcional básica: el sensor (EM) dispara el actuador (ACT)
    // a través del grafo de señales — no es solo un bag de propiedades, se
    // comporta como una torreta de verdad.
    function node(
      raw: string,
      role: SignalNode["role"],
      behavior?: SignalNode["behavior"],
    ): SignalNode {
      return { id: id(raw), role, position: { x: 0, y: 0 }, ownerRef: raw, behavior };
    }
    function edge(from: string, to: string): SignalEdge {
      return { id: `${from}->${to}` as SignalEdgeId, from: id(from), to: id(to) };
    }
    const graph: SignalGraph = {
      nodes: [node("sensor-emisor", "emitter"), node("actuador-laser", "receptor")],
      edges: [edge("sensor-emisor", "actuador-laser")],
    };
    const emitter = new EventEmitter<SignalDomainEvent>();
    const evaluator = new SignalEvaluator(graph, emitter);
    const state = evaluator.createState();

    const run = (movementDetected: boolean, elapsed: number): void => {
      const map: SignalEmitterInputs = new Map([[id("sensor-emisor"), movementDetected]]);
      evaluator.tick(state, map, tickOf(elapsed));
    };

    run(true, 0);
    run(true, 1);
    expect(state.get(id("actuador-laser"))?.output).toBe(true);
  });
});
