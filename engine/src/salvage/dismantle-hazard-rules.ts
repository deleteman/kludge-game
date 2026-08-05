import type { PlacedComponentInstance, ReservoirContent } from "../blueprint/blueprint.types.js";
import type { PhysicalComponentDefinition } from "../components/physical-component.types.js";
import { isInstanceEnergized } from "./instance-energized.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";
import type { SalvageDomainEvent } from "./salvage-hazard.types.js";
import { SALVAGE_HAZARD_PARAMETERS } from "./salvage-parameters.js";

/**
 * Estado VIVO del mundo alrededor de la pieza que se está por desmontar. Se
 * arma leyendo el mundo ANTES de sacar la pieza del `Blueprint` (si no, todo
 * daría "seguro" siempre). Lo consumen dos llamadores:
 *  - el efecto de tarea, para disparar el hazard al completarse el desmontaje;
 *  - la UI, para el badge de riesgo del panel de acciones ANTES de encolar.
 * Una sola evaluación compartida, no dos criterios que se desincronizan.
 */
export interface DismantleHazardContext {
  readonly instance: PlacedComponentInstance;
  readonly sectionId?: SectionId;
  /**
   * Definición de catálogo de la pieza. Fix de playtest ronda 1: el contexto
   * traía un `powered: boolean` YA resuelto por el llamador, y ahí fue donde
   * se coló la semántica equivocada de `isInstancePowered`. Ahora la regla
   * recibe los datos crudos y decide ella (`instance-energized.ts`).
   */
  readonly definition: PhysicalComponentDefinition | undefined;
  /** La sección de la pieza tiene ≥1 unidad OTORGADA (no la que el jugador pidió: la que el motor dio). */
  readonly sectionHasGrantedPower: boolean;
  /** La fuente ya fue descargada por una tarea `discharge-source`. */
  readonly sourceDischarged: boolean;
  /** Contenido de reservorio DE ESTA instancia (`Blueprint.reservoirContents` filtrado). */
  readonly reservoirContents: ReadonlyArray<ReservoirContent>;
  readonly atmosphere?: SectionAtmosphere;
  readonly elapsedSeconds: number;
}

/**
 * Strategy (CLAUDE.md, mismo patrón que las reglas de reacción de
 * `chemistry/reaction/rules/`): cada condición de peligro decide si aplica y
 * construye su evento. Añadir una cuarta condición es implementar esta
 * interfaz y sumarla al registro, nunca editar un `if` central.
 */
export interface DismantleHazardRule {
  readonly id: string;
  appliesTo(ctx: DismantleHazardContext): boolean;
  build(ctx: DismantleHazardContext): SalvageDomainEvent;
}

function anchorOf(ctx: DismantleHazardContext) {
  return {
    instanceId: ctx.instance.instanceId,
    position: ctx.instance.placement.position,
    sectionId: ctx.sectionId,
    elapsedSeconds: ctx.elapsedSeconds,
  };
}

/**
 * Pieza energizada → chispazo. Evitable cortando la energía de la sección
 * (tarea `cut-power`, o el propio dial de reparto de 13b: el estado es
 * derivado del mundo, no un flag) — salvo en una FUENTE con carga propia, que
 * necesita su tarea `discharge-source`.
 */
export const PoweredInstanceHazardRule: DismantleHazardRule = {
  id: "powered-instance",
  appliesTo: (ctx) =>
    isInstanceEnergized({
      definition: ctx.definition,
      sectionHasGrantedPower: ctx.sectionHasGrantedPower,
      sourceDischarged: ctx.sourceDischarged,
    }),
  build: (ctx) => ({ kind: "dismantle-spark", ...anchorOf(ctx) }),
};

/**
 * Reservorio con contenido → derrame. Hasta 13d, `dismantleInstance` tiraba
 * los `reservoirContents` de la instancia en silencio: la sustancia
 * desaparecía sin consecuencia. Evitable con la tarea `purge-reservoir`.
 *
 * Con varias sustancias en la misma instancia se derrama la de MAYOR cantidad
 * (un solo evento por desmontaje: el charco es uno).
 */
export const ReservoirContentHazardRule: DismantleHazardRule = {
  id: "reservoir-content",
  appliesTo: (ctx) => ctx.reservoirContents.some((entry) => entry.amount > 0),
  build: (ctx) => {
    const spilled = [...ctx.reservoirContents]
      .filter((entry) => entry.amount > 0)
      .sort((a, b) => b.amount - a.amount)[0]!;
    return {
      kind: "dismantle-spill",
      ...anchorOf(ctx),
      substanceId: spilled.substanceId,
      amount: spilled.amount,
    };
  },
};

/**
 * Sección con la atmósfera ya comprometida → abrir el hueco agrava la fuga.
 * Es la condición SIN tarea propia (decisión del operador, 2026-08-05): se
 * evita resolviendo la atmósfera con los medios que ya existen (sellar la
 * brecha, ventilar), no con una purga por pieza.
 *
 * "Comprometida" = hay un contaminante sobre el umbral (cualquier `GasKey` que
 * no sea uno de los tres estándar es el id de una sustancia, convención de
 * `atmosphere-composition.types.ts`) o la presión ya está por debajo de la
 * nominal.
 */
export const HazardousAtmosphereHazardRule: DismantleHazardRule = {
  id: "hazardous-atmosphere",
  appliesTo: (ctx) => {
    const atmosphere = ctx.atmosphere;
    if (!atmosphere) {
      return false;
    }
    if (atmosphere.pressureKpa < SALVAGE_HAZARD_PARAMETERS.hazardousPressureKpa) {
      return true;
    }
    const standardGases = new Set<string>(Object.values(GAS));
    for (const [gasKey, fraction] of atmosphere.gases) {
      if (
        !standardGases.has(gasKey) &&
        fraction > SALVAGE_HAZARD_PARAMETERS.hazardousContaminantConcentration
      ) {
        return true;
      }
    }
    return false;
  },
  build: (ctx) => ({
    kind: "dismantle-leak",
    ...anchorOf(ctx),
    drainRateKpaPerSecond: SALVAGE_HAZARD_PARAMETERS.leakDrainRateKpaPerSecond,
    durationSeconds: SALVAGE_HAZARD_PARAMETERS.leakDurationSeconds,
  }),
};

/** Registro por defecto, en el orden en que se evalúan (no hay prioridad: son ortogonales). */
export function createDefaultDismantleHazardRules(): ReadonlyArray<DismantleHazardRule> {
  return [PoweredInstanceHazardRule, ReservoirContentHazardRule, HazardousAtmosphereHazardRule];
}
