import type { Footprint, GridPosition } from "../geometry/grid-position.types.js";
import type { CurrentLevel } from "./current-level.types.js";
import type { StructuralResistanceLevel } from "../properties/material.types.js";
import type { KineticTargetKind, VelocityLevel } from "./kinetic-events.types.js";

/**
 * Dirección de avance sobre el grid, en celdas por paso. Solo ejes (sin
 * diagonales): el proyectil viaja por un riel recto (documento §5), y la
 * métrica de distancia elegida es Manhattan (`geometry/grid-distance.ts`).
 */
export interface GridDirection {
  readonly dx: -1 | 0 | 1;
  readonly dy: -1 | 0 | 1;
}

export const DIRECTION_AT_REST: GridDirection = { dx: 0, dy: 0 };

/** Una bobina activa sobre el plano: posición en celdas + corriente declarada (documento §1). */
export interface ActiveCoil {
  readonly ref: string;
  readonly position: GridPosition;
  readonly current: CurrentLevel;
}

/**
 * Qué ocupa una celda del plano, desde el punto de vista del proyectil. El
 * dominio cinético no sabe qué es un blueprint ni un tripulante — solo
 * necesita saber si la celda frena al proyectil y contra qué referencia
 * resolver el impacto.
 */
export interface CellOccupant {
  /** Ref del objetivo golpeado, tal como aparecerá en `KineticImpactEvent.targetRef`. */
  readonly ref: string;
  /**
   * Qué clase de objetivo es (Subfase 13f). El simulador no lo usa para
   * decidir el frenado —todo ocupante frena— pero lo propaga al evento, que es
   * donde la distinción importa: una pared daña la vida de la sección, un
   * tripulante recibe daño propio.
   */
  readonly kind: KineticTargetKind;
}

/**
 * Puerto (patrón Ports & Adapters) que el llamador implementa para exponer el
 * mundo al simulador. Existe para que `kinetics/` NO importe `floorplan/` ni
 * `blueprint/` — el dominio cinético se mantiene puro y testeable con un fake,
 * y el adaptador real vive en `/game` (`MissionRuntime`), que sí conoce ambos.
 * Decisión del operador (Fase 11a).
 */
export interface ProjectileWorld {
  /** Qué ocupa esa celda, o `null` si el proyectil puede seguir avanzando. */
  occupantAt(cell: GridPosition): CellOccupant | null;
  /** Bobinas energizadas EN ESTE TICK. El simulador no sabe cómo se activan (señales, GDD 5.6). */
  activeCoils(): ReadonlyArray<ActiveCoil>;
}

/**
 * Estado vivo de un proyectil ferromagnético (`MAG`-Sí, GDD 7.0) suelto sobre
 * el plano. `velocity` y la dirección los deriva el simulador de los pulsos —
 * no se autoran (documento §2: el objeto "se mueve hacia la fuente", y el
 * jugador dirige colocando bobinas, no fijando una flecha).
 */
export interface ProjectileState {
  readonly ref: string;
  position: GridPosition;
  direction: GridDirection;
  velocity: VelocityLevel;
  /**
   * Celdas recorridas desde el último pulso. Insumo de
   * `MagneticAccelerationAccumulator.applyDrag` (ASA 2, Fase 11a.2): fuera de
   * la influencia de toda bobina activa, cada `dragThresholdCells` celdas
   * degradan la velocidad un nivel.
   */
  cellsSinceLastPulse: number;
  /** Sub-celda acumulada: el avance es fraccionario por tick, el impacto se resuelve por celda. */
  cellProgress: number;
}

/** Datos inmutables de la pieza que vuela — lo que ASA 1 (11a.1) cruzará para la masa virtual. */
export interface ProjectileBody {
  readonly ref: string;
  readonly footprint: Footprint;
  readonly re?: StructuralResistanceLevel;
}
