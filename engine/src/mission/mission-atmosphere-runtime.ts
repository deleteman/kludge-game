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
import type { SectionGasInjectionSource } from "./section-gas-injection.js";

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
    /**
     * Subfase 13e: sustancias que ENTRAN a la atmósfera de una sección
     * (verter un neutralizante, un derrame). Mismo patrón DI que `sinkSource`
     * y, como él, opcional: sin fuente el comportamiento es idéntico al
     * anterior a 13e.
     */
    private readonly gasInjectionSource?: SectionGasInjectionSource,
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
    // Las inyecciones se aplican ANTES de difundir, para que el gas recién
    // vertido se reparta por los conductos en el mismo tick en vez de esperar
    // al siguiente — verter algo y no ver nada moverse hasta un tick después
    // se leería como que la acción no hizo nada.
    this.applyGasInjections();
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

  /**
   * Suma las fracciones inyectadas este tick (Subfase 13e). El gas entra
   * DESPLAZANDO al resto proporcionalmente en vez de sumarse por encima: la
   * suma de fracciones de una sección no puede pasar de 1 (el "hueco" que
   * queda por debajo de 1 es vacío, no un gas implícito — ver
   * `atmosphere-composition.types.ts`). Verter algo en una sección llena de
   * aire desplaza aire; eso es lo que hace que un tóxico sea peligroso y que
   * un neutralizante llegue a tocar lo que hay que neutralizar.
   */
  private applyGasInjections(): void {
    if (!this.gasInjectionSource) {
      return;
    }
    for (const [sectionId, bySubstance] of this.gasInjectionSource()) {
      const runtime = this.sectionsById.get(sectionId);
      if (!runtime) {
        continue;
      }
      const requested = [...bySubstance.values()].reduce((total, fraction) => total + fraction, 0);
      if (requested <= 0) {
        continue;
      }
      // Se muta el Map en sitio (la referencia es `readonly`, el contenido no)
      // — mismo criterio que `diffuse()`.
      const gases = runtime.atmosphere.gases;
      const occupied = [...gases.values()].reduce((total, fraction) => total + fraction, 0);
      // Una sección no admite más de su propio volumen: verter 100 unidades en
      // un armario no lo llena 5 veces. Lo que excede se pierde — el exceso ya
      // salió del reservorio, y ese coste es intencional (Principio 5).
      const admitted = Math.min(requested, 1);
      const admittedRatio = admitted / requested;
      // Lo que no cabe en el vacío disponible se hace sitio a costa del resto.
      const displaced = Math.max(0, Math.min(occupied, admitted - Math.max(0, 1 - occupied)));
      if (displaced > 0 && occupied > 0) {
        const keepRatio = (occupied - displaced) / occupied;
        for (const [gasKey, fraction] of gases) {
          gases.set(gasKey, fraction * keepRatio);
        }
      }
      for (const [substanceId, fraction] of bySubstance) {
        gases.set(substanceId, (gases.get(substanceId) ?? 0) + fraction * admittedRatio);
      }
    }
  }

  /** Snapshot serializable de todas las secciones, para `toUpdatedSave`. */
  toSnapshots(): ReadonlyArray<SectionAtmosphereSnapshot> {
    return [...this.sectionsById.values()].map((runtime) =>
      toSectionAtmosphereSnapshot(runtime.section.id, runtime.atmosphere),
    );
  }
}
