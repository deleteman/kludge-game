import type { Tickable } from "../tasks/core-loop-mode.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import { deriveAtmosphereModel } from "../floorplan/atmosphere-projection.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { diffuse } from "../atmosphere/diffusion.js";
import { standardSectionAtmosphere } from "../atmosphere/section.types.js";
import type { SectionAtmosphere, SectionId, SectionRuntime } from "../atmosphere/section.types.js";
import type { VentilationConnection } from "../atmosphere/ventilation.types.js";
import {
  fromSectionAtmosphereSnapshot,
  toSectionAtmosphereSnapshot,
} from "../atmosphere/atmosphere-snapshot.types.js";
import type { SectionAtmosphereSnapshot } from "../atmosphere/atmosphere-snapshot.types.js";

/**
 * Atmósfera VIVA de una misión (Fase 11b) — hasta esta fase, `diffuse()` y el
 * resto de `atmosphere/` solo corrían en tests unitarios aislados; ninguna
 * misión real instanciaba una `SectionRuntime`. Mismo criterio que
 * `MissionSignalRuntime` (Fase 11a): estado persistente a través de los
 * ticks, registrado como `Tickable` en el core loop para que la pausa
 * táctica congele la difusión igual que todo lo demás (GDD §4.2).
 *
 * Siembra desde `Blueprint.sectionAtmospheres` (snapshot del último guardado)
 * cuando existe, o aire estándar por sección si no (partida nueva, o save
 * anterior a esta fase sin el campo).
 */
export class MissionAtmosphereRuntime implements Tickable {
  private readonly sectionsById: Map<SectionId, SectionRuntime>;
  private readonly connections: ReadonlyArray<VentilationConnection>;

  constructor(shipFloorplan: ShipFloorplan, initialSnapshots: ReadonlyArray<SectionAtmosphereSnapshot>) {
    const model = deriveAtmosphereModel(shipFloorplan);
    const snapshotBySection = new Map(initialSnapshots.map((snapshot) => [snapshot.sectionId, snapshot]));

    this.sectionsById = new Map(
      model.sections.map((section) => {
        const snapshot = snapshotBySection.get(section.id);
        const atmosphere = snapshot ? fromSectionAtmosphereSnapshot(snapshot) : standardSectionAtmosphere();
        return [section.id, { section, atmosphere }];
      }),
    );
    this.connections = model.connections;
  }

  /** Atmósfera actual de una sección, o `undefined` si el id no existe en el plano. */
  atmosphereOf(sectionId: SectionId): SectionAtmosphere | undefined {
    return this.sectionsById.get(sectionId)?.atmosphere;
  }

  tick(ctx: TickContext): void {
    diffuse(this.sectionsById, this.connections, ctx);
  }

  /** Snapshot serializable de todas las secciones, para `toUpdatedSave`. */
  toSnapshots(): ReadonlyArray<SectionAtmosphereSnapshot> {
    return [...this.sectionsById.values()].map((runtime) =>
      toSectionAtmosphereSnapshot(runtime.section.id, runtime.atmosphere),
    );
  }
}
