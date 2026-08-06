import type { CrewSpecialty } from "./crew-specialty.types.js";
import type { CrewTier } from "./crew-tier.types.js";

/**
 * Acciones con afinidad de especialidad (GDD 6.6). Las tres primeras
 * coinciden con `TaskType` (`../tasks/task.types.js`) porque son exactamente
 * las tareas de desmontaje/instalación/reconexión que ya existen en el core
 * loop (Fase 6); `evasive-maneuver`/`stabilize`/`weapon-aim` son acciones que
 * el GDD describe pero cuyo disparador real de juego todavía no existe (llega
 * con la primera crisis jugable, Fase 10) — el multiplicador ya se puede medir
 * y testear de forma aislada sin ese disparador.
 */
export type AffinityAction =
  | "dismantle"
  | "install"
  | "connect"
  | "combine"
  | "stabilize"
  | "evasive-maneuver"
  | "weapon-aim"
  | "analyze-substance"
  // Subfase 13d — asegurar una pieza antes de canibalizarla es trabajo de
  // Ingeniero, igual que desmontar/instalar; el GDD 6.6 no las lista porque no
  // existían, mismo caso que `combine`/`analyze-substance`.
  | "cut-power"
  | "purge-reservoir"
  | "discharge-source"
  // Subfase 13e — manipular fluidos es trabajo de Ingeniero; descomponer una
  // sustancia en sus elementos es trabajo de laboratorio, del Médico (mismo
  // criterio que `analyze-substance`, GDD línea 242).
  | "transfer-substance"
  | "apply-substance"
  | "extract-elements";

/** Especialidad afín a cada acción (GDD 6.6, columna "Afinidad"). */
export const AFFINITY_ACTION_SPECIALTY: Record<AffinityAction, CrewSpecialty> = {
  dismantle: "ingeniero",
  install: "ingeniero",
  connect: "ingeniero",
  // Fabricar en la mesa es trabajo de Ingeniero (GDD 6.6 y caso 15, "según el
  // tier del Ingeniero"): componer piezas en un compuesto nuevo (Fase 11c.2).
  combine: "ingeniero",
  stabilize: "medico",
  "evasive-maneuver": "piloto",
  "weapon-aim": "seguridad",
  // GDD línea 242: "el Médico identifica la composición de una sustancia
  // desconocida MÁS RÁPIDO" — modificador de velocidad, no un requisito duro
  // (Fase 11e); cualquier especialidad puede ejecutar "Analizar Sustancia".
  "analyze-substance": "medico",
  "cut-power": "ingeniero",
  "purge-reservoir": "ingeniero",
  "discharge-source": "ingeniero",
  "transfer-substance": "ingeniero",
  "apply-substance": "ingeniero",
  "extract-elements": "medico",
};

/**
 * Multiplicador de duración por tier, SOLO cuando el actor ejecuta dentro de
 * su propia afinidad (GDD 6.6, valores N/V/E literales de la tabla). Data-driven,
 * mismo criterio que `REACTION_PARAMETERS`/`THERMAL_CONDUCTIVITY_PARAMETERS`.
 */
export const AFFINITY_DURATION_MULTIPLIER: Record<AffinityAction, Record<CrewTier, number>> = {
  dismantle: { novato: 0.9, veterano: 0.75, experto: 0.6 },
  install: { novato: 0.9, veterano: 0.75, experto: 0.6 },
  connect: { novato: 0.9, veterano: 0.75, experto: 0.6 },
  combine: { novato: 0.9, veterano: 0.75, experto: 0.6 },
  stabilize: { novato: 0.85, veterano: 0.65, experto: 0.45 },
  "evasive-maneuver": { novato: 0.8, veterano: 0.6, experto: 0.4 },
  "weapon-aim": { novato: 0.85, veterano: 0.7, experto: 0.55 },
  // Reutiliza los valores de `stabilize` (misma especialidad, Médico) como
  // placeholder ajustable en playtesting — el GDD no da una fila numérica
  // propia para "analizar sustancia".
  "analyze-substance": { novato: 0.85, veterano: 0.65, experto: 0.45 },
  // Mismos valores que desmontar/instalar: es la misma clase de trabajo manual
  // del Ingeniero sobre la pieza (13d).
  "cut-power": { novato: 0.9, veterano: 0.75, experto: 0.6 },
  "purge-reservoir": { novato: 0.9, veterano: 0.75, experto: 0.6 },
  "discharge-source": { novato: 0.9, veterano: 0.75, experto: 0.6 },
  "transfer-substance": { novato: 0.9, veterano: 0.75, experto: 0.6 },
  "apply-substance": { novato: 0.9, veterano: 0.75, experto: 0.6 },
  // Fila del Médico, igual que `analyze-substance`/`stabilize`.
  "extract-elements": { novato: 0.85, veterano: 0.65, experto: 0.45 },
};

/** Regla general fuera de afinidad (GDD 6.6): +20% de tiempo, sin importar el tier. */
export const OFF_AFFINITY_DURATION_PENALTY = 1.2;

/**
 * Multiplicador de duración a aplicar sobre la base data-driven de
 * `task-parameters.ts`/`AFFINITY_DURATION_MULTIPLIER`: si el actor es afín a la
 * acción, el bonus de su tier; si no, la penalización general fija (GDD 6.6:
 * "fuera de afinidad, ejecuta con normalidad, sin los bonus, y con una
 * penalización de tiempo fija", independiente del tier).
 */
export function durationMultiplierFor(
  action: AffinityAction,
  actorSpecialty: CrewSpecialty,
  tier: CrewTier,
): number {
  const affineSpecialty = AFFINITY_ACTION_SPECIALTY[action];
  if (actorSpecialty !== affineSpecialty) {
    return OFF_AFFINITY_DURATION_PENALTY;
  }
  return AFFINITY_DURATION_MULTIPLIER[action][tier];
}
