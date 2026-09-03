import type { SectionId } from "../atmosphere/section.types.js";
import type { SectionPressureSinkSource } from "./mission-atmosphere-runtime.js";
import {
  PHASE_EXPANSION_DURATION_SECONDS,
  PHASE_EXPANSION_KPA_PER_UNIT,
} from "../chemistry/phase/phase-change-parameters.js";

interface ActiveExpansion {
  readonly sectionId: SectionId;
  /** Negativo: es un aporte de presión, no un drenaje (convención de `SectionPressureSinkSource`). */
  readonly rateKpaPerSecond: number;
  readonly expiresAtSeconds: number;
}

/**
 * Presión que aporta una sustancia al EVAPORARSE en una sección (Subfase 14a-3,
 * GDD §5.6: "sólido → gas puede generar presión/expansión").
 *
 * Implementa `SectionPressureSinkSource` con signo negativo —positivo drena,
 * negativo recupera—, así que se compone con los sumideros que ya existen
 * (`composePressureSinks`) sin que `MissionAtmosphereRuntime` sepa que hay una
 * fuente nueva. Es la PRIMERA fuente de presión del motor: hasta acá solo había
 * drenajes y la recuperación autorada del sellado del Cap. 1.
 *
 * **Techo, y por qué no es un escritor muerto**: el bucle del sumidero clampea
 * en `PRESSURE_RECOVERY_CEILING_KPA`, que ES la presión estándar, así que
 * evaporar en una sala sana no mueve nada. Es deliberado (decisión de la
 * subfase: no hay sobrepresión). El valor jugable de esta fuente está en la
 * franja entre el piso de una fuga y el estándar — represurizar una sala que
 * quedó baja después de sellar una brecha, que hasta 13f ronda 2 no tenía
 * ningún camino propio.
 *
 * Mismo molde que `TransientLeakPressureSink` (13d), incluido el `advanceTo`:
 * el tiempo entra desde el core loop, así que la pausa táctica congela también
 * el vencimiento de las expansiones en vez de dejarlas caducar mientras el
 * jugador planifica.
 */
export class PhaseExpansionPressureSource {
  private expansions: ActiveExpansion[] = [];
  private nowSeconds = 0;

  /**
   * Registra la evaporación de `amount` unidades. El total de kPa se reparte en
   * `PHASE_EXPANSION_DURATION_SECONDS`, nunca de golpe: ver el docblock del
   * parámetro.
   */
  register(sectionId: SectionId, amount: number, elapsedSeconds: number): void {
    if (amount <= 0) {
      return;
    }
    const totalKpa = amount * PHASE_EXPANSION_KPA_PER_UNIT;
    this.expansions.push({
      sectionId,
      rateKpaPerSecond: -(totalKpa / PHASE_EXPANSION_DURATION_SECONDS),
      expiresAtSeconds: elapsedSeconds + PHASE_EXPANSION_DURATION_SECONDS,
    });
  }

  advanceTo(elapsedSeconds: number): void {
    this.nowSeconds = elapsedSeconds;
    this.expansions = this.expansions.filter(
      (expansion) => expansion.expiresAtSeconds > elapsedSeconds,
    );
  }

  /** Expansiones todavía activas, para tests y depuración. */
  get activeExpansionCount(): number {
    return this.expansions.length;
  }

  asSinkSource(): SectionPressureSinkSource {
    return () => {
      const rates = new Map<SectionId, number>();
      for (const expansion of this.expansions) {
        if (expansion.expiresAtSeconds <= this.nowSeconds) {
          continue;
        }
        rates.set(
          expansion.sectionId,
          (rates.get(expansion.sectionId) ?? 0) + expansion.rateKpaPerSecond,
        );
      }
      return rates;
    };
  }
}
