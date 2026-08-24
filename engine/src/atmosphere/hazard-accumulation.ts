import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import { REACTION_PARAMETERS } from "../chemistry/reaction/reaction-parameters.js";
import type { SectionId } from "./section.types.js";
import type { AtmosphereDomainEvent, HazardEvent } from "./atmosphere-events.types.js";

/**
 * Configuración de un peligro por acumulación de exposición (GDD 5.3, efectos
 * por tiempo). Data-driven: los umbrales vienen de Espec. §1.
 */
export interface HazardConfig {
  readonly eventKind: HazardEvent["kind"];
  /** Concentración por encima de la cual la exposición se acumula. */
  readonly onsetConcentration: number;
  /** Segundos sobre el umbral → severidad "incapacitation" (Infinity = sin esta fase). */
  readonly incapacitationSeconds: number;
  /** Concentración que es letal de forma inmediata (opcional). */
  readonly lethalConcentration?: number;
  /** Segundos sobre el umbral → severidad "lethal" por tiempo (opcional). */
  readonly lethalSeconds?: number;
}

interface HazardSectionState {
  secondsExposed: number;
  emittedIncapacitation: boolean;
  emittedLethal: boolean;
}

/**
 * Acumulador de peligros por tiempo de exposición, por sección (GDD 5.3 +
 * Espec. §1). Cada tick recibe la concentración del contaminante en la sección
 * y acumula tiempo sobre el umbral; al cruzar un umbral de severidad emite el
 * evento correspondiente una sola vez. Si la concentración baja del umbral, la
 * exposición se reinicia (el peligro se disipó).
 *
 * Cubre el caso de validación 10 (fuga de amoníaco: >30% durante >5s →
 * incapacitación; >60% → letal) y, con otra config, el daño corrosivo directo
 * a tripulante (~10s letal, GDD 5.3 / Espec. §1).
 */
export class HazardAccumulator {
  private readonly bySection = new Map<SectionId, HazardSectionState>();

  constructor(private readonly config: HazardConfig) {}

  private stateFor(sectionId: SectionId): HazardSectionState {
    let state = this.bySection.get(sectionId);
    if (!state) {
      state = { secondsExposed: 0, emittedIncapacitation: false, emittedLethal: false };
      this.bySection.set(sectionId, state);
    }
    return state;
  }

  tick(
    sectionId: SectionId,
    concentration: number,
    tick: TickContext,
    emitter?: EventEmitter<AtmosphereDomainEvent>,
  ): HazardEvent[] {
    const state = this.stateFor(sectionId);
    const emitted: HazardEvent[] = [];
    const push = (severity: HazardEvent["severity"]): void => {
      const event: HazardEvent = {
        kind: this.config.eventKind,
        sectionId,
        severity,
        concentration,
        elapsedSeconds: tick.elapsedSeconds,
      };
      emitted.push(event);
      emitter?.emit(event);
    };

    const { lethalConcentration, lethalSeconds, incapacitationSeconds } = this.config;

    if (lethalConcentration !== undefined && concentration >= lethalConcentration) {
      if (!state.emittedLethal) {
        push("lethal");
        state.emittedLethal = true;
      }
      return emitted;
    }

    if (concentration > this.config.onsetConcentration) {
      state.secondsExposed += tick.dtSeconds;
      if (
        lethalSeconds !== undefined &&
        state.secondsExposed >= lethalSeconds &&
        !state.emittedLethal
      ) {
        push("lethal");
        state.emittedLethal = true;
      }
      if (state.secondsExposed >= incapacitationSeconds && !state.emittedIncapacitation) {
        push("incapacitation");
        state.emittedIncapacitation = true;
      }
    } else {
      state.secondsExposed = 0;
      state.emittedIncapacitation = false;
      state.emittedLethal = false;
    }

    return emitted;
  }
}

/** Peligro de incapacitación tóxica (caso 10): >30% → incapacita a los 5s; >60% letal. */
export function createToxicHazardAccumulator(): HazardAccumulator {
  return new HazardAccumulator({
    eventKind: "toxic-threshold",
    onsetConcentration: REACTION_PARAMETERS.toxicity.incapacitationConcentration,
    incapacitationSeconds: REACTION_PARAMETERS.toxicity.incapacitationSeconds,
    lethalConcentration: REACTION_PARAMETERS.toxicity.lethalConcentration,
  });
}

/**
 * Daño corrosivo directo a tripulante (GDD 5.3): letal tras ~10s de contacto.
 *
 * Subfase 13f: gana una fase de incapacitación a la MITAD de ese tiempo, que
 * antes era `Infinity`. No cambia el momento de la muerte (la Espec. §1 sigue
 * mandando en eso) — añade el aviso previo que el operador pidió al cablear
 * este acumulador a producción: un tripulante que se está corroyendo ahora
 * grita antes de morir, en vez de caerse de golpe al segundo 10.
 */
export function createCorrosiveCrewHazardAccumulator(): HazardAccumulator {
  return new HazardAccumulator({
    eventKind: "corrosive-exposure",
    onsetConcentration: 0,
    incapacitationSeconds: REACTION_PARAMETERS.corrosion.crewLethalSeconds / 2,
    lethalSeconds: REACTION_PARAMETERS.corrosion.crewLethalSeconds,
  });
}
