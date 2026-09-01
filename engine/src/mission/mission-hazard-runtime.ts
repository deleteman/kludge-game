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
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
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
 *  - **Térmico** (ronda 1 de 14a-2): frío o calor extremos en la atmósfera de
 *    la sala. Mismo criterio que el vacío en todo — mordiscos discretos,
 *    exposición por ACTOR, causas `"cold"`/`"fire"` ya existentes.
 *
 * VACÍO Y FRÍO SE ACUMULAN (decisión del operador): una sección brechada Y
 * congelada da los dos mordiscos, cada uno con su propia cuenta. No se suprime
 * uno con el otro — son dos fenómenos distintos del motor y el jugador que
 * dejó que se junten los dos paga por los dos.
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
  /**
   * Exposición al vacío POR ACTOR, no por sección — al revés que los hazards
   * químicos de arriba. Es deliberado: el veneno es una propiedad de la sala
   * ("esta sala ya es letal"), pero el vacío es una cuenta de la persona, y el
   * jugador tiene que poder sacar a un tripulante y meter a otro sin que el
   * segundo herede los mordiscos del primero.
   */
  private readonly vacuumExposure = new Map<CrewActorId, BiteExposure>();
  /** Ídem para el térmico, en un mapa APARTE: los dos se acumulan y cada uno lleva su propia cuenta. */
  private readonly thermalExposure = new Map<CrewActorId, BiteExposure>();

  constructor(private readonly deps: MissionHazardRuntimeDeps) {}

  tick(ctx: TickContext): void {
    for (const actor of this.deps.crewState.all()) {
      if (actor.hp <= 0 || !actor.currentCell) {
        this.clearExposure(actor.id);
        continue;
      }
      const section = sectionContainingCell(this.deps.shipFloorplan, actor.currentCell);
      const atmosphere = section && this.deps.atmosphereRuntime.atmosphereOf(section.id);
      if (!section || !atmosphere) {
        this.clearExposure(actor.id);
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
        this.bite(this.vacuumExposure, actor, HAZARD_PARAMETERS.vacuum, "cold", ctx);
      } else {
        // Salir de la sección brechada resetea la cuenta: el vacío no deja
        // daño acumulado latente, o volver a entrar mataría de inmediato.
        this.vacuumExposure.delete(actor.id);
      }

      // Térmico: los dos lados del eje, con el mismo criterio de salida que el
      // vacío — irse de la sala corta la cuenta. Es el camino de vuelta, sin el
      // cual sacar a alguien de una sala congelada no lo salvaría.
      const temperature = atmosphere.temperatureCelsius;
      const thermalCause = thermalDamageCause(temperature);
      if (thermalCause) {
        this.bite(this.thermalExposure, actor, HAZARD_PARAMETERS.thermal, thermalCause, ctx);
      } else {
        this.thermalExposure.delete(actor.id);
      }
    }
  }

  private clearExposure(actorId: CrewActorId): void {
    this.vacuumExposure.delete(actorId);
    this.thermalExposure.delete(actorId);
  }

  private applyHazard(actor: CrewActor, event: HazardEvent, ctx: TickContext): void {
    const cause: CrewDamageCause = event.kind === "corrosive-exposure" ? "corrosion" : "fire";
    this.hurt(actor, HP_LOSS_FRACTION[event.severity === "lethal" ? "high" : "medium"], cause, ctx, {
      lethal: event.severity === "lethal",
    });
  }

  /**
   * Daño ambiental por mordiscos DISCRETOS, no por goteo continuo. Es el molde
   * que comparten el vacío (13f) y el térmico (14a-2), en un solo lugar porque
   * el bug que lo originó es uno solo y no debe poder reaparecer en el segundo
   * llamador.
   *
   * La primera versión de 13f escalaba una fracción con `dtSeconds` en cada
   * tick. Con el core loop corriendo por frame la pérdida redondeaba a cero:
   * cero daño real y un `crew-damaged` por frame. Ahora es un mordisco cada
   * `biteIntervalSeconds`, el primero inmediato y NO letal (el aviso).
   */
  private bite(
    exposureBySource: Map<CrewActorId, BiteExposure>,
    actor: CrewActor,
    params: { readonly biteIntervalSeconds: number; readonly hpFractionPerBite: number },
    cause: CrewDamageCause,
    ctx: TickContext,
  ): void {
    const exposure = exposureBySource.get(actor.id) ?? { secondsSinceBite: 0, bites: 0 };
    exposure.secondsSinceBite += ctx.dtSeconds;

    const firstBite = exposure.bites === 0;
    if (firstBite || exposure.secondsSinceBite >= params.biteIntervalSeconds) {
      this.hurt(actor, params.hpFractionPerBite, cause, ctx, {
        // El primer mordisco es el aviso: hiere pero deja vivo. A partir del
        // segundo el peligro mata de verdad.
        lethal: !firstBite,
      });
      exposure.bites += 1;
      exposure.secondsSinceBite = 0;
    }

    exposureBySource.set(actor.id, exposure);
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

/** Cuenta de mordiscos de UN tripulante para UNA fuente de daño. Mutable a propósito: es estado de tick, no de dominio. */
interface BiteExposure {
  secondsSinceBite: number;
  bites: number;
}

/**
 * Qué causa de daño corresponde a una temperatura, o `undefined` si está en el
 * rango donde no pasa nada. Las dos causas ya existen en `CrewDamageCause` y ya
 * tienen su variante en `crew-death-effect.ts`, así que el eje térmico no
 * agrega ningún fenómeno visual nuevo que haya que dibujar.
 *
 * `"cold"` es la MISMA causa que usa el vacío. No colisionan porque llevan
 * cuentas de exposición separadas y, del lado visual, ambas significan
 * exactamente lo que la partícula muestra: este tripulante se está congelando.
 */
function thermalDamageCause(temperatureCelsius: number): CrewDamageCause | undefined {
  if (temperatureCelsius <= HAZARD_PARAMETERS.thermal.coldOnsetCelsius) return "cold";
  if (temperatureCelsius >= HAZARD_PARAMETERS.thermal.hotOnsetCelsius) return "fire";
  return undefined;
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
