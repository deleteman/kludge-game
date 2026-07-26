import type { GasKey } from "./atmosphere-composition.types.js";
import type { SectionAtmosphere, SectionId } from "./section.types.js";

/**
 * Forma serializable de `SectionAtmosphere` (Fase 11b, guardado dinámico).
 * `SectionAtmosphere.gases` es un `Map`, que no sobrevive un `JSON.stringify`
 * tal cual — se representa como array de pares `[GasKey, number]`, mismo
 * criterio que el resto del motor usa arrays para lo que en runtime es un Map
 * (ej. `SignalGraphState`).
 */
export interface SectionAtmosphereSnapshot {
  readonly sectionId: SectionId;
  readonly gases: ReadonlyArray<readonly [GasKey, number]>;
  readonly temperatureCelsius: number;
  readonly pressureKpa: number;
}

export function toSectionAtmosphereSnapshot(
  sectionId: SectionId,
  atmosphere: SectionAtmosphere,
): SectionAtmosphereSnapshot {
  return {
    sectionId,
    gases: [...atmosphere.gases.entries()],
    temperatureCelsius: atmosphere.temperatureCelsius,
    pressureKpa: atmosphere.pressureKpa,
  };
}

export function fromSectionAtmosphereSnapshot(snapshot: SectionAtmosphereSnapshot): SectionAtmosphere {
  return {
    gases: new Map(snapshot.gases),
    temperatureCelsius: snapshot.temperatureCelsius,
    pressureKpa: snapshot.pressureKpa,
  };
}
