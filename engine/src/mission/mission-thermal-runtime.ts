import type { Tickable } from "../tasks/core-loop-mode.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import type { ReactionDomainEvent } from "../chemistry/reaction/reaction-events.types.js";
import type { FailureDomainEvent } from "../failure/failure-events.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { COMBUSTION_HEAT, OVERLOAD_HEAT } from "../atmosphere/thermal-parameters.js";

/**
 * Escritores de temperatura por evento (Subfase 14a-1).
 *
 * Traduce eventos de dominio discretos —una combustión, un cortocircuito en
 * modo fuego, una neutralización exotérmica— a una tasa continua de °C/s por
 * sección, que `MissionAtmosphereRuntime` consume por `SectionHeatSource`.
 *
 * Por qué un traductor y no aplicar el calor en el handler: un evento es
 * instantáneo y la temperatura es un estado que sube DURANTE un rato. Sumar
 * +60 °C de golpe daría un pico de un frame que ningún sensor ni jugador
 * alcanza a ver, y que la deriva pasiva borraría enseguida. El pulso con
 * duración es lo que convierte "hubo un incendio" en "esta sección está
 * caliente y hay que hacer algo".
 *
 * Mismo molde que `MissionReactionRuntime`: se suscribe a los emisores en el
 * constructor y guarda estado propio entre ticks, sin conocer `/game` ni la
 * capa visual (Observer, principio de separación motor/render).
 */

/** Un aporte de calor en curso sobre una sección. Estado de simulación, no se persiste. */
interface HeatPulse {
  readonly sectionId: SectionId;
  readonly celsiusPerSecond: number;
  remainingSeconds: number;
}

export class MissionThermalRuntime implements Tickable {
  private pulses: HeatPulse[] = [];
  /**
   * Tasa agregada por sección del último tick. Se recalcula entera cada vez;
   * misma forma de lectura que `MissionAtmosphereRuntime.netPressureRateOf`,
   * para que la UI y la física no puedan discrepar sobre si una sección se
   * está calentando.
   */
  private lastRates: ReadonlyMap<SectionId, number> = new Map();

  constructor(
    reactionEvents?: EventEmitter<ReactionDomainEvent>,
    failureEvents?: EventEmitter<FailureDomainEvent>,
  ) {
    reactionEvents?.on("combustion", (event) => {
      const spec = COMBUSTION_HEAT[event.intensity];
      this.open(event.sectionId, spec.celsius, spec.durationSeconds);
    });
    // La neutralización es el único evento que trae su propio calor autorado
    // (Espec. §1: +15 °C), así que NO pasa por la tabla de parámetros — sería
    // duplicar el dato en dos sitios que pueden divergir.
    reactionEvents?.on("neutralization", (event) => {
      this.open(event.sectionId, event.heatReleasedCelsius, event.heatDurationSeconds);
    });
    failureEvents?.on("overload", (event) => {
      const spec = OVERLOAD_HEAT[event.failureMode];
      if (!spec) {
        return;
      }
      this.open(event.sectionId, spec.celsius, spec.durationSeconds);
    });
  }

  /**
   * Abre un pulso. Un evento sin `sectionId` se ignora en silencio: no ocurrió
   * en el mundo (es la mesa de creación, que emite los mismos eventos sin
   * contexto de misión — ver el comentario de `CombustionEvent.sectionId`).
   */
  private open(sectionId: SectionId | undefined, celsius: number, durationSeconds: number): void {
    if (!sectionId || durationSeconds <= 0 || celsius === 0) {
      return;
    }
    this.pulses.push({
      sectionId,
      celsiusPerSecond: celsius / durationSeconds,
      remainingSeconds: durationSeconds,
    });
  }

  /**
   * °C/segundo que esta sección está recibiendo por eventos en el tick actual.
   * Los pulsos solapados se SUMAN: dos incendios en la misma sala calientan el
   * doble, que es la cascada multi-salto que 14a existe para sostener.
   */
  heatRateOf(sectionId: SectionId): number {
    return this.lastRates.get(sectionId) ?? 0;
  }

  /** La fuente a inyectar en `MissionAtmosphereRuntime` (`SectionHeatSource`). */
  rates(): ReadonlyMap<SectionId, number> {
    return this.lastRates;
  }

  tick(ctx: TickContext): void {
    if (this.pulses.length === 0) {
      // Un mapa nuevo vacío y no el anterior: si el último pulso venció, la
      // tasa tiene que caer a 0, no quedarse pegada en la del tick pasado.
      if (this.lastRates.size > 0) {
        this.lastRates = new Map();
      }
      return;
    }
    const rates = new Map<SectionId, number>();
    const alive: HeatPulse[] = [];
    for (const pulse of this.pulses) {
      rates.set(pulse.sectionId, (rates.get(pulse.sectionId) ?? 0) + pulse.celsiusPerSecond);
      pulse.remainingSeconds -= ctx.dtSeconds;
      if (pulse.remainingSeconds > 0) {
        alive.push(pulse);
      }
    }
    // El pulso aporta en el mismo tick en que se descuenta: uno de duración
    // menor a un frame igual entrega su calor una vez en vez de perderse.
    this.pulses = alive;
    this.lastRates = rates;
  }
}
