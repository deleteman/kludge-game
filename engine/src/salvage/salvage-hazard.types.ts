import type { DomainEventBase } from "../simulation/domain-event.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";

/**
 * Riesgo sistémico al canibalizar (Subfase 13d, Gap ② de la comparativa con
 * Shipbreaker). Distinto de la pérdida de material de GDD §6.5 (coste de
 * tiempo/piezas, ya cubierto por `wear/`): esto es un hazard PUNTUAL en el
 * acto de desmontaje, según el estado VIVO de la pieza en ese instante.
 *
 * Tres fenómenos distintos, tres eventos distintos — principio 6 de CLAUDE.md:
 * una chispa eléctrica, un derrame de sustancia y una fuga de presión no
 * pueden verse igual en pantalla.
 *
 * Todos llevan `sectionId`/`position` porque son lo que `/game` necesita para
 * pintar y lo que la Subfase 13f (vida por sección) necesitará para restar
 * integridad a la sección afectada sin cambiar este contrato.
 */
export type DismantleHazardKind = "dismantle-spark" | "dismantle-spill" | "dismantle-leak";

interface DismantleHazardEventBase extends DomainEventBase {
  readonly instanceId: PlacedComponentInstanceId;
  /** Celda donde estaba anclada la pieza (origen de su footprint). */
  readonly position: GridPosition;
  /** Sección que contiene la celda; ausente solo si el plano no la resuelve. */
  readonly sectionId?: SectionId;
}

/**
 * Se desmontó una pieza que estaba recibiendo energía (13b,
 * `MissionPowerRuntime.isInstancePowered`). Es también una fuente de ignición
 * REAL para la sección — el doble filo del GDD §5.5 / caso de validación 8.
 */
export interface DismantleSparkEvent extends DismantleHazardEventBase {
  readonly kind: "dismantle-spark";
}

/** Se desmontó un reservorio con contenido: la sustancia se derrama en la celda. */
export interface DismantleSpillEvent extends DismantleHazardEventBase {
  readonly kind: "dismantle-spill";
  readonly substanceId: ChemicalSubstanceId;
  readonly amount: number;
}

/**
 * Se desmontó una pieza en una sección con la atmósfera comprometida
 * (contaminante sobre el umbral o presión ya caída): abrir el hueco agrava la
 * fuga durante un tiempo acotado. Las brechas PERMANENTES son de la Subfase 13f.
 */
export interface DismantleLeakEvent extends DismantleHazardEventBase {
  readonly kind: "dismantle-leak";
  /** Caudal de la fuga, en kPa/segundo, mientras dure. */
  readonly drainRateKpaPerSecond: number;
  readonly durationSeconds: number;
}

export type SalvageDomainEvent = DismantleSparkEvent | DismantleSpillEvent | DismantleLeakEvent;
