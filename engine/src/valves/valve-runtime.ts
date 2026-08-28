import type { ConduitConnection, ConduitId, ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { ValveSnapshot } from "./valve.types.js";

export type { ValveSnapshot };

/**
 * Apertura VIVA de las válvulas de ventilación (Subfase 13h).
 *
 * Hasta acá `valveAperture` se copiaba una vez desde `conduit.initialAperture`
 * al construir la misión y nada la mutaba: el "aislamiento deliberado" del GDD
 * §5.5 —cerrar una válvula para contener una fuga o drenar el O2 de una
 * sección— era una capacidad declarada en el documento de diseño y ausente del
 * juego.
 *
 * Existe además porque la puerta NO cierra el ducto (decisión del operador):
 * una puerta cerrada compartimenta el umbral, pero el aire sigue pasando por el
 * conducto de ventilación que une esas mismas dos secciones. Contener una fuga
 * del todo exige las dos cosas, y esa es la tensión que hace interesante el
 * aislamiento en vez de un botón de "sellar sala".
 *
 * Solo `ventilacion` tiene válvula: en los demás tipos de conducto
 * `initialAperture` no es significativa (`ConduitConnection`).
 */
export class ValveRuntime {
  private readonly apertureById = new Map<ConduitId, number>();
  private readonly conduitsById: ReadonlyMap<ConduitId, ConduitConnection>;

  constructor(floorplan: ShipFloorplan, snapshots: readonly ValveSnapshot[] = []) {
    const ventilation = floorplan.conduits.filter((conduit) => conduit.kind === "ventilacion");
    this.conduitsById = new Map(ventilation.map((conduit) => [conduit.id, conduit]));

    const bySnapshot = new Map(snapshots.map((snapshot) => [snapshot.conduitId, snapshot.aperture]));
    for (const conduit of ventilation) {
      // El save gana sobre el plano: si el jugador dejó una válvula cerrada,
      // sigue cerrada al recargar. Sin snapshot, vale la autoría del mapa — que
      // es donde vive, por ejemplo, la sala de aislamiento sellada de fábrica de
      // la nave médica (`initialAperture: 0`).
      this.apertureById.set(conduit.id, clamp01(bySnapshot.get(conduit.id) ?? conduit.initialAperture));
    }
  }

  /** Apertura [0,1] de una válvula. 1 para un conducto desconocido (no restringe nada). */
  apertureFor(conduitId: ConduitId): number {
    return this.apertureById.get(conduitId) ?? 1;
  }

  /** `true` si el conducto tiene válvula operable (es decir, es de ventilación). */
  hasValve(conduitId: ConduitId): boolean {
    return this.apertureById.has(conduitId);
  }

  setAperture(conduitId: ConduitId, aperture: number): void {
    if (!this.apertureById.has(conduitId)) {
      return;
    }
    this.apertureById.set(conduitId, clamp01(aperture));
  }

  /**
   * Conexiones de ventilación con su apertura VIVA — la mitad "válvulas" de la
   * `SectionApertureSource`. La otra mitad la aportan las puertas.
   */
  effectiveConnections(): ReadonlyArray<{
    readonly a: ConduitConnection["a"];
    readonly b: ConduitConnection["b"];
    readonly valveAperture: number;
  }> {
    return [...this.conduitsById.values()].map((conduit) => ({
      a: conduit.a,
      b: conduit.b,
      valveAperture: this.apertureFor(conduit.id),
    }));
  }

  toSnapshots(): readonly ValveSnapshot[] {
    return [...this.apertureById.entries()].map(([conduitId, aperture]) => ({ conduitId, aperture }));
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
