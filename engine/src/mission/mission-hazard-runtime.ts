import type { Tickable } from "../tasks/core-loop-mode.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemistry/chemical-substance.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { AtmosphereDomainEvent, HazardEvent } from "../atmosphere/atmosphere-events.types.js";
import {
  createCorrosiveCrewHazardAccumulator,
  createToxicHazardAccumulator,
  type HazardAccumulator,
} from "../atmosphere/hazard-accumulation.js";
import { sectionTaggedConcentration } from "../atmosphere/tagged-concentration.js";
import type { CrewActor } from "../crew/crew-actor.types.js";
import type { CrewDamageCause, CrewDomainEvent } from "../crew/crew-events.types.js";
import { applyCrewDamage, HP_LOSS_FRACTION } from "../crew/hp-resolution.js";
import { HAZARD_PARAMETERS } from "./mission-hazard-parameters.js";
import type { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import type { MutableCrewState } from "./mutable-crew-state.js";

export interface MissionHazardRuntimeDeps {
  readonly shipFloorplan: ShipFloorplan;
  readonly atmosphereRuntime: MissionAtmosphereRuntime;
  readonly chemicalRegistry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>;
  readonly crewState: MutableCrewState;
  readonly emitter?: EventEmitter<AtmosphereDomainEvent>;
  readonly crewEmitter?: EventEmitter<CrewDomainEvent>;
}

/**
 * Peligro atmosférico sobre la TRIPULACIÓN (Subfase 13f) — primer llamador de
 * producción de `HazardAccumulator` (`atmosphere/hazard-accumulation.ts`), que
 * existía desde la Fase 2 y hasta ahora solo se ejercitaba en tests y en la
 * galería de partículas (deuda #16, ampliación de 12b). Por eso el efecto
 * `corrosive-exposure` y su sonido, listos y registrados desde 12b, nunca
 * habían sonado en partida real: no existía ni siquiera un bus donde emitir el
 * evento.
 *
 * Es el HERMANO de `MissionSectionIntegrityRuntime`: la misma lectura de
 * atmósfera, aplicada al tripulante en vez de a la sección. Mismo tick, no dos
 * sistemas.
 *
 * Tres peligros, todos sobre la atmósfera de la sección donde está el actor:
 *  - **Tóxico** (caso de validación 10): >30% durante >5s incapacita, >60% mata.
 *  - **Corrosivo** (GDD 5.3): letal tras ~10s de contacto directo.
 *  - **Vacío** (Subfase 13f): una sección brechada se queda sin atmósfera y
 *    quien entre se congela. No se inventa un `kind` nuevo de `HazardEvent`
 *    para esto — la causa de daño `"cold"` ya existe en `CrewDamageCause` y ya
 *    tiene su variante visual en `crew-death-effect.ts` (principio 6 sin
 *    inflar el registro de fenómenos).
 *
 * LETALIDAD (decisión del operador, 2026-08-24): el cruce a `incapacitation`
 * hiere pero NUNCA mata por sí solo (`minHp: 1`, el mismo mecanismo de 13d) —
 * es el aviso previo. Solo la severidad `lethal` mata de verdad. Así el
 * jugador tiene una ventana para sacar a su gente antes de perderla.
 *
 * SIMPLIFICACIÓN CONSCIENTE: `HazardAccumulator` acumula exposición POR
 * SECCIÓN, no por tripulante — es como está escrito desde la Fase 2 y se
 * reusa tal cual. Consecuencia: un tripulante que entra a una sección ya
 * envenenada hereda el tiempo de exposición acumulado en vez de empezar su
 * propia cuenta. Se acepta a propósito: la ficción ("esta sala ya es letal")
 * es más legible que la contabilidad por persona, y evita un segundo eje de
 * estado que habría que persistir.
 */
export class MissionHazardRuntime implements Tickable {
  private readonly toxicBySection = new Map<SectionId, HazardAccumulator>();
  private readonly corrosiveBySection = new Map<SectionId, HazardAccumulator>();

  constructor(private readonly deps: MissionHazardRuntimeDeps) {}

  tick(ctx: TickContext): void {
    for (const actor of this.deps.crewState.all()) {
      if (actor.hp <= 0 || !actor.currentCell) {
        continue;
      }
      const section = sectionContainingCell(this.deps.shipFloorplan, actor.currentCell);
      const atmosphere = section && this.deps.atmosphereRuntime.atmosphereOf(section.id);
      if (!section || !atmosphere) {
        continue;
      }

      const toxic = accumulatorFor(this.toxicBySection, section.id, createToxicHazardAccumulator).tick(
        section.id,
        sectionTaggedConcentration(atmosphere, this.deps.chemicalRegistry, "TOX"),
        ctx,
        this.deps.emitter,
      );
      const corrosive = accumulatorFor(
        this.corrosiveBySection,
        section.id,
        createCorrosiveCrewHazardAccumulator,
      ).tick(
        section.id,
        sectionTaggedConcentration(atmosphere, this.deps.chemicalRegistry, "CORR"),
        ctx,
        this.deps.emitter,
      );

      for (const event of [...toxic, ...corrosive]) {
        this.applyHazard(actor, event, ctx);
      }

      if (atmosphere.pressureKpa <= HAZARD_PARAMETERS.vacuum.onsetKpa) {
        this.applyVacuum(actor, ctx);
      }
    }
  }

  private applyHazard(actor: CrewActor, event: HazardEvent, ctx: TickContext): void {
    const cause: CrewDamageCause = event.kind === "corrosive-exposure" ? "corrosion" : "fire";
    this.hurt(actor, HP_LOSS_FRACTION[event.severity === "lethal" ? "high" : "medium"], cause, ctx, {
      lethal: event.severity === "lethal",
    });
  }

  /**
   * Daño por vacío. A diferencia de los hazards por umbral, es CONTINUO
   * mientras el actor siga ahí: no hay un "cruce" que emitir una vez, hay una
   * sección sin aire. Por eso escala con `dtSeconds` en vez de aplicar una
   * fracción de golpe.
   */
  private applyVacuum(actor: CrewActor, ctx: TickContext): void {
    this.hurt(actor, HAZARD_PARAMETERS.vacuum.hpFractionPerSecond * ctx.dtSeconds, "cold", ctx, {
      lethal: true,
    });
  }

  private hurt(
    actor: CrewActor,
    fraction: number,
    cause: CrewDamageCause,
    ctx: TickContext,
    options: { readonly lethal: boolean },
  ): void {
    const current = this.deps.crewState.get(actor.id) ?? actor;
    if (current.hp <= 0) {
      return;
    }
    const { actor: damaged, event } = applyCrewDamage(
      current,
      fraction,
      cause,
      ctx.elapsedSeconds,
      // El aviso previo: la incapacitación hiere hasta dejar en 1 HP, nunca
      // mata. Solo el umbral letal puede matar.
      options.lethal ? undefined : { minHp: 1 },
    );
    this.deps.crewState.set(damaged);
    if (event) {
      this.deps.crewEmitter?.emit(event);
    }
  }
}

function accumulatorFor(
  registry: Map<SectionId, HazardAccumulator>,
  sectionId: SectionId,
  create: () => HazardAccumulator,
): HazardAccumulator {
  let accumulator = registry.get(sectionId);
  if (!accumulator) {
    accumulator = create();
    registry.set(sectionId, accumulator);
  }
  return accumulator;
}
