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
}

const VENTILATION_PRESSURE_EPSILON_KPA = 0.5;
const VENTILATION_PRESSURE_RANGE_KPA = 20;
const ELECTRICO_FIXED_INTENSITY = 0.7;
const SENAL_FIXED_INTENSITY = 0.7;
/**
 * `fluido` no tiene ningún dato de caudal real en el motor (`ReservoirContent`
 * es por instancia de componente, no transporte entre secciones) — reutiliza
 * el mismo booleano de cicatriz de energía que `electrico` como aproximación
 * deliberada. Documentado como deuda técnica en `PENDIENTES_OBSERVACIONES.md`.
 */
const FLUIDO_FIXED_INTENSITY = 0.6;

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
      return poweredIntensity(conduit, mission, FLUIDO_FIXED_INTENSITY);
    case "senal":
      return signalIntensity(conduit, activeSignalSections);
    default:
      return { active: false, intensity: 0 };
  }
}

/** Válvula sellada de fábrica (`initialAperture === 0`) fuerza flujo apagado, sin importar presión. */
function ventilationIntensity(conduit: ConduitConnection, mission: MissionRuntime): ConduitFlowIntensity {
  if (conduit.initialAperture === 0) return { active: false, intensity: 0 };
  const pressureA = mission.atmosphereRuntime.atmosphereOf(conduit.a)?.pressureKpa ?? 0;
  const pressureB = mission.atmosphereRuntime.atmosphereOf(conduit.b)?.pressureKpa ?? 0;
  const delta = Math.abs(pressureA - pressureB);
  if (delta <= VENTILATION_PRESSURE_EPSILON_KPA) return { active: false, intensity: 0 };
  return { active: true, intensity: Math.min(1, delta / VENTILATION_PRESSURE_RANGE_KPA) };
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
