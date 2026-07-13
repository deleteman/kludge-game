// GDD 9 (extensión), caso 17 — "El Cañón de Riel Improvisado": docs/Extension_aceleracion_magnetica.md §5 — decaimiento por distancia + inercia acumulada de la aceleración magnética, y daño por impacto cinético (velocidad × footprint).
import { describe, expect, it } from "vitest";
import {
  activeCoilFieldIntensity,
  intensityAtDistance,
  MagneticAccelerationAccumulator,
  resolveKineticImpact,
  SignalEvaluator,
  type SignalEdge,
  type SignalEdgeId,
  type SignalEmitterInputs,
  type SignalGraph,
  type SignalNode,
  type SignalNodeId,
  type SignalNodeRole,
  type TickContext,
} from "../index.js";

const id = (value: string): SignalNodeId => value as SignalNodeId;
const tickOf = (elapsed: number, dt = 1): TickContext => ({
  dtSeconds: dt,
  elapsedSeconds: elapsed,
});

function node(raw: string, role: SignalNodeRole, behavior?: SignalNode["behavior"]): SignalNode {
  return { id: id(raw), role, position: { x: 0, y: 0 }, ownerRef: raw, behavior };
}
function edge(from: string, to: string): SignalEdge {
  return { id: `${from}->${to}` as SignalEdgeId, from: id(from), to: id(to) };
}

const targetFootprint = { width: 1, height: 1 };

describe("case 17 — El Cañón de Riel Improvisado", () => {
  it("well-spaced coil timing (delay nodes) fires 3 sequential pulses that accumulate into a high-severity impact", () => {
    // 3 bobinas, cada una con su propio receptor temporizado (delay, GDD 5.6
    // ya validado en Fase 2) para activarse justo cuando el proyectil pasa
    // por ella — el jugador calculó el espaciado correctamente.
    const graph: SignalGraph = {
      nodes: [
        node("proyectil-entra", "emitter"),
        node("bobina-1", "receptor", { kind: "delay", delaySeconds: 2 }),
        node("bobina-2", "receptor", { kind: "delay", delaySeconds: 5 }),
        node("bobina-3", "receptor", { kind: "delay", delaySeconds: 8 }),
      ],
      edges: [
        edge("proyectil-entra", "bobina-1"),
        edge("proyectil-entra", "bobina-2"),
        edge("proyectil-entra", "bobina-3"),
      ],
    };
    const evaluator = new SignalEvaluator(graph);
    const state = evaluator.createState();
    const accumulator = new MagneticAccelerationAccumulator("proyectil-riel");

    // Cada bobina, "en secuencia" (documento §1: la cuenta de bobinas activas
    // crece con cada pulso ya disparado), corriente alta, dentro del rango
    // efectivo (distancia 2, rango efectivo = 3).
    const coilPlan = [
      { nodeId: "bobina-1", coilsSoFar: 1, distance: 2 },
      { nodeId: "bobina-2", coilsSoFar: 2, distance: 2 },
      { nodeId: "bobina-3", coilsSoFar: 3, distance: 2 },
    ];
    const wasActive: Record<string, boolean> = {
      "bobina-1": false,
      "bobina-2": false,
      "bobina-3": false,
    };

    // MagneticAccelerationAccumulator espera un tick() por cada tick simulado
    // (mismo contrato que HazardAccumulator/StructuralIntegrity), pasando "N"
    // cuando ninguna bobina dispara ese tick — así detecta el flanco de
    // subida internamente en vez de recibir solo los pulsos ya filtrados.
    for (let t = 0; t < 12; t++) {
      const map: SignalEmitterInputs = new Map([[id("proyectil-entra"), true]]);
      evaluator.tick(state, map, tickOf(t));

      let fieldThisTick: ReturnType<typeof intensityAtDistance> = "N";
      for (const coil of coilPlan) {
        const isActive = state.get(id(coil.nodeId))?.output ?? false;
        if (isActive && !wasActive[coil.nodeId]) {
          const fieldAtCoil = activeCoilFieldIntensity(coil.coilsSoFar, "A");
          fieldThisTick = intensityAtDistance(fieldAtCoil, coil.distance);
        }
        wasActive[coil.nodeId] = isActive;
      }
      accumulator.tick(fieldThisTick, tickOf(t));
    }

    expect(accumulator.currentVelocity).toBe("A");
    const impact = resolveKineticImpact(
      accumulator.currentVelocity,
      targetFootprint,
      "puerta-bloqueada",
      tickOf(12),
    );
    expect(impact).toMatchObject({ kind: "kinetic-impact", severity: "high" });
  });

  it("misjudging one coil's placement lets its pulse decay out of range, weakening the impact from high to medium", () => {
    const accumulator = new MagneticAccelerationAccumulator("proyectil-mal-calculado");

    // Pulso 1: bobina 1, en secuencia, corriente alta, dentro de rango.
    accumulator.tick(intensityAtDistance(activeCoilFieldIntensity(1, "A"), 2), tickOf(0));
    // Pulso 2 mal calculado: el jugador dejó demasiada distancia entre la
    // bobina 2 y el riel -> el campo decae a "sin efecto" (N) antes de llegar
    // al proyectil, y el pulso se pierde por completo (documento §2).
    const decayedField = intensityAtDistance(activeCoilFieldIntensity(2, "A"), 10);
    expect(decayedField).toBe("N");
    accumulator.tick(decayedField, tickOf(1)); // sin efecto: no cuenta como pulso
    // Pulso 3 (segundo pulso EFECTIVO): en secuencia, dentro de rango.
    accumulator.tick(intensityAtDistance(activeCoilFieldIntensity(2, "A"), 2), tickOf(2));

    expect(accumulator.currentVelocity).toBe("M"); // no alcanzó "A" por el pulso perdido
    const impact = resolveKineticImpact(
      accumulator.currentVelocity,
      targetFootprint,
      "puerta-bloqueada",
      tickOf(3),
    );
    expect(impact.severity).toBe("medium");
  });

  it.todo(
    "daño cinético a un tripulante/enemigo en la trayectoria (documento §3, distinto de daño a estructura/" +
      "componente ya validado arriba) — depende de Fase 9 (tripulación), que no existe todavía en el motor",
  );
});
