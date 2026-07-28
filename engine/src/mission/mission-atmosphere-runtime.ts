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
/**
 * De dónde sale un drenaje/recuperación de presión sostenido por sección
 * (Subfase 11h, escenario de fuga en Capítulo 1): un `Map` de `SectionId` →
 * kPa/segundo a aplicar este tick. Mismo patrón DI que `EmitterInputSource`
 * (`mission-signal-runtime.ts`) — el runtime no sabe POR QUÉ hay fuga (una
 * junta rota, una pieza destruida), solo aplica la tasa que el mundo le da.
 * Positivo = drena (resta presión); negativo = recupera (suma presión) — el
 * signo decide la dirección, `tick()` aplica la misma fórmula para ambas.
 * Sin `sinkSource`, comportamiento idéntico a antes de esta fase.
 */
export type SectionPressureSinkSource = () => ReadonlyMap<SectionId, number>;

/**
 * Piso de presión de una fuga (Subfase 11h): "fuga menor" por diseño
 * (`docs/Extension_indicador_led_pantalla_lcd.md`, caso 19) — no baja a vacío
 * total. Valor confirmado con el operador, ajustable.
 */
export const PRESSURE_SINK_FLOOR_KPA = 40;

/**
 * Techo de recuperación (Subfase 11h): reparar una fuga no debe sobrepasar la
 * atmósfera estándar. Misma constante que `standardSectionAtmosphere().pressureKpa`,
 * no un número mágico aparte.
 */
export const PRESSURE_RECOVERY_CEILING_KPA = standardSectionAtmosphere().pressureKpa;

export class MissionAtmosphereRuntime implements Tickable {
  private readonly sectionsById: Map<SectionId, SectionRuntime>;
  private readonly connections: ReadonlyArray<VentilationConnection>;

  constructor(
    shipFloorplan: ShipFloorplan,
    initialSnapshots: ReadonlyArray<SectionAtmosphereSnapshot>,
    private readonly sinkSource?: SectionPressureSinkSource,
  ) {
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
    if (!this.sinkSource) {
      return;
    }
    // Sumidero/recuperación de presión (Subfase 11h): a diferencia de
    // `diffuse()` (mueve fracciones de gas entre secciones, nunca toca
    // `pressureKpa`), esto suma/resta presión directamente de una sección —
    // es el único mecanismo hoy que puede mover `pressureKpa` de forma
    // sostenida. Clamp de DOS lados: el piso evita vacío total mientras drena,
    // el techo evita que la recuperación se pase de la atmósfera estándar.
    for (const [sectionId, rateKpaPerSecond] of this.sinkSource()) {
      const runtime = this.sectionsById.get(sectionId);
      if (!runtime || rateKpaPerSecond === 0) {
        continue;
      }
      runtime.atmosphere.pressureKpa = Math.min(
        PRESSURE_RECOVERY_CEILING_KPA,
        Math.max(PRESSURE_SINK_FLOOR_KPA, runtime.atmosphere.pressureKpa - rateKpaPerSecond * ctx.dtSeconds),
      );
    }
  }

  /** Snapshot serializable de todas las secciones, para `toUpdatedSave`. */
  toSnapshots(): ReadonlyArray<SectionAtmosphereSnapshot> {
    return [...this.sectionsById.values()].map((runtime) =>
      toSectionAtmosphereSnapshot(runtime.section.id, runtime.atmosphere),
    );
  }
}
