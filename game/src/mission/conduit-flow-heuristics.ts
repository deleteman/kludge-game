import type { ConduitConnection, SectionId, SignalEdge } from "engine";
import { sectionContainingCell } from "engine";

import type { MissionRuntime } from "./mission-runtime.js";

/**
 * Intensidad/actividad de flujo de un conducto, derivada de estado REAL del
 * motor (Fase 11f) — nunca inventada. No hay campo de "caudal" en
 * `ConduitConnection`, así que cada `ConduitKind` deriva su intensidad de la
 * fuente de datos más cercana ya expuesta: presión (ventilación), cicatriz de
 * energía (eléctrico/fluido) o salida del grafo de señales (señal). Ver
 * `conduitFlowIntensity` para el detalle por tipo.
 */
export interface ConduitFlowIntensity {
  readonly active: boolean;
  /** [0,1]. 0 = sin flujo visible. */
  readonly intensity: number;
  /**
   * Sentido del flujo (Subfase 13h). `"forward"` = de `a` hacia `b`. Ausente =
   * simétrico, que es lo correcto donde no hay un "hacia dónde" que mostrar
   * (`electrico`, `senal`).
   */
  readonly direction?: "forward" | "backward" | "both";
}

const VENTILATION_PRESSURE_EPSILON_KPA = 0.5;
const VENTILATION_PRESSURE_RANGE_KPA = 20;
const ELECTRICO_FIXED_INTENSITY = 0.7;
const SENAL_FIXED_INTENSITY = 0.7;
/**
 * `fluido` (Subfase 13e, cierra la deuda #10): dejó de reutilizar el booleano
 * de cicatriz de energía de `electrico` y ahora deriva del caudal REAL de las
 * operaciones en curso (`MissionRuntime.fluidOperations`: trasvase, vertido,
 * extracción, purga). Sin ninguna operación viva el conducto queda quieto —
 * es correcto, no un bug: mismo criterio que 11f.4 dejó documentado para los
 * conductos `senal` en calma.
 *
 * `EPSILON` evita que un goteo residual encienda la animación; `RANGE`
 * normaliza a [0,1] igual que `VENTILATION_PRESSURE_RANGE_KPA` hace con la
 * presión. `FLOOR` garantiza que una operación válida siempre se VEA, aunque
 * sea de una sola unidad.
 */
const FLUID_FLOW_EPSILON = 0.05;
const FLUID_FLOW_RANGE = 2;
const FLUID_FLOW_FLOOR_INTENSITY = 0.35;

/**
 * Precalcula, una vez por frame de misión, qué secciones tienen AL MENOS un
 * nodo de señal con `output === true` ahora mismo — evita recorrer
 * `blueprint.signalGraph.nodes` una vez POR CONDUCTO.
 */
export function computeSectionSignalActivity(mission: MissionRuntime): ReadonlySet<SectionId> {
  const active = new Set<SectionId>();
  for (const node of mission.blueprint.signalGraph.nodes) {
    if (!mission.signalRuntime.outputOf(node.id)) continue;
    const section = sectionContainingCell(mission.shipFloorplan, node.position);
    if (section) active.add(section.id);
  }
  return active;
}

export function conduitFlowIntensity(
  conduit: ConduitConnection,
  mission: MissionRuntime,
  activeSignalSections: ReadonlySet<SectionId>,
): ConduitFlowIntensity {
  switch (conduit.kind) {
    case "ventilacion":
      return ventilationIntensity(conduit, mission);
    case "electrico":
      return poweredIntensity(conduit, mission, ELECTRICO_FIXED_INTENSITY);
    case "fluido":
      return fluidIntensity(conduit, mission);
    case "senal":
      return signalIntensity(conduit, activeSignalSections);
    default:
      return { active: false, intensity: 0 };
  }
}

/**
 * Caudal real de las operaciones de fluido que tocan este par de secciones
 * (13e). A diferencia del resto de los tipos, no hay estado "en reposo" que
 * mostrar: un conducto de fluido sin nadie moviendo nada está quieto.
 */
function fluidIntensity(conduit: ConduitConnection, mission: MissionRuntime): ConduitFlowIntensity {
  if (conduit.initialAperture === 0) return { active: false, intensity: 0 };
  const rate = mission.fluidOperations.rateBetween(conduit.a, conduit.b);
  if (rate <= FLUID_FLOW_EPSILON) return { active: false, intensity: 0 };
  const normalized = Math.min(1, rate / FLUID_FLOW_RANGE);
  return {
    active: true,
    intensity: Math.max(FLUID_FLOW_FLOOR_INTENSITY, normalized),
  };
}

/**
 * Válvula cerrada fuerza flujo apagado, sin importar la presión.
 *
 * Subfase 13h: lee la apertura VIVA (`ValveRuntime`) y no `initialAperture` —
 * ese era el dato correcto mientras la apertura era estática, pero desde que el
 * jugador puede mandar a cerrar una válvula, el conducto seguiría animando
 * partículas por un ducto que él acaba de sellar.
 *
 * Y devuelve el SENTIDO, no solo la magnitud: el aire va de la sala con más
 * presión a la que tiene menos, y con la nave compartimentada eso es justo lo
 * que el jugador necesita ver para saber por dónde se está desangrando.
 */
function ventilationIntensity(conduit: ConduitConnection, mission: MissionRuntime): ConduitFlowIntensity {
  if (mission.valveRuntime.apertureFor(conduit.id) <= 0) return { active: false, intensity: 0 };
  const pressureA = mission.atmosphereRuntime.atmosphereOf(conduit.a)?.pressureKpa ?? 0;
  const pressureB = mission.atmosphereRuntime.atmosphereOf(conduit.b)?.pressureKpa ?? 0;
  const delta = Math.abs(pressureA - pressureB);
  if (delta <= VENTILATION_PRESSURE_EPSILON_KPA) return { active: false, intensity: 0 };
  return {
    active: true,
    intensity: Math.min(1, delta / VENTILATION_PRESSURE_RANGE_KPA),
    direction: pressureA > pressureB ? "forward" : "backward",
  };
}

function poweredIntensity(
  conduit: ConduitConnection,
  mission: MissionRuntime,
  fixedIntensity: number,
): ConduitFlowIntensity {
  const unpowered = mission.blueprint.unpoweredSectionIds;
  const active = !unpowered.includes(conduit.a) && !unpowered.includes(conduit.b);
  return { active, intensity: active ? fixedIntensity : 0 };
}

function signalIntensity(
  conduit: ConduitConnection,
  activeSignalSections: ReadonlySet<SectionId>,
): ConduitFlowIntensity {
  const active = activeSignalSections.has(conduit.a) || activeSignalSections.has(conduit.b);
  return { active, intensity: active ? SENAL_FIXED_INTENSITY : 0 };
}

/**
 * Flujo sobre el CABLE de un `SignalEdge` concreto (Fase 11f.6) — distinto de
 * `signalIntensity` (que evalúa el conducto FÍSICO que cruza una pared): un
 * cable conecta 2 NODOS puntuales, así que su actividad se lee directo del
 * nodo emisor (`edge.from`), no de la sección completa.
 */
export function signalWireFlowIntensity(edge: SignalEdge, mission: MissionRuntime): ConduitFlowIntensity {
  const active = mission.signalRuntime.outputOf(edge.from);
  return { active, intensity: active ? SENAL_FIXED_INTENSITY : 0 };
}
