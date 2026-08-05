import type { SectionId } from "../atmosphere/section.types.js";
import type { SectionPressureSinkSource } from "../mission/mission-atmosphere-runtime.js";
import type { DismantleLeakEvent } from "./salvage-hazard.types.js";

interface ActiveLeak {
  readonly sectionId: SectionId;
  readonly drainRateKpaPerSecond: number;
  readonly expiresAtSeconds: number;
}

/**
 * Fugas ACOTADAS en el tiempo abiertas por desmontar en una sección con la
 * atmósfera comprometida (Subfase 13d). Implementa `SectionPressureSinkSource`,
 * así que se compone con el sumidero de la junta rota del Capítulo 1
 * (`composePressureSinks`) sin que `MissionAtmosphereRuntime` se entere.
 *
 * Por qué acotada: una brecha PERMANENTE que drena hasta el colapso es de la
 * Subfase 13f (vida por sección + cicatriz de campaña). 13d abre un agujero que
 * el aire termina de igualar, no una herida de nave.
 *
 * Varias fugas simultáneas en la misma sección SUMAN caudal — dos piezas
 * arrancadas del mismo mamparo pierden más aire que una.
 */
export class TransientLeakPressureSink {
  private leaks: ActiveLeak[] = [];
  private nowSeconds = 0;

  /** Registra la fuga de un `dismantle-leak`. Ignora eventos sin sección resuelta. */
  register(event: DismantleLeakEvent): void {
    if (!event.sectionId) {
      return;
    }
    this.leaks.push({
      sectionId: event.sectionId,
      drainRateKpaPerSecond: event.drainRateKpaPerSecond,
      expiresAtSeconds: event.elapsedSeconds + event.durationSeconds,
    });
  }

  /**
   * El sumidero se consulta una vez por tick desde `MissionAtmosphereRuntime`,
   * que no le pasa el `TickContext` (la firma de `SectionPressureSinkSource` no
   * lo lleva). El tiempo entra por acá, desde el mismo `Tickable` que ya corre
   * en el core loop — así la pausa táctica congela también el vencimiento de
   * las fugas, en vez de que caduquen mientras el jugador planifica.
   */
  advanceTo(elapsedSeconds: number): void {
    this.nowSeconds = elapsedSeconds;
    this.leaks = this.leaks.filter((leak) => leak.expiresAtSeconds > elapsedSeconds);
  }

  /** Fugas todavía activas, para tests y depuración. */
  get activeLeakCount(): number {
    return this.leaks.length;
  }

  asSinkSource(): SectionPressureSinkSource {
    return () => {
      const rates = new Map<SectionId, number>();
      for (const leak of this.leaks) {
        if (leak.expiresAtSeconds <= this.nowSeconds) {
          continue;
        }
        rates.set(leak.sectionId, (rates.get(leak.sectionId) ?? 0) + leak.drainRateKpaPerSecond);
      }
      return rates;
    };
  }
}
