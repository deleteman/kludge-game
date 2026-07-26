import type { HazardEvent, HazardSeverity } from "engine";

import { crewDamageFlash } from "./combustion-effect.js";
import type { EventDrivenEffect, GridPosition } from "../particle-effect.types.js";
import { spawnBurst, spreadRange, textureScale, toPixel } from "../particle-utils.js";
import { SMOKE_TEXTURES } from "../particle-texture-registry.js";

/**
 * Umbral de atmósfera (GDD 5.3/11.1). `HazardEvent.kind` distingue dos
 * fenómenos (principio 6): "toxic-threshold" → nube tóxica (verde, GDD "fuga
 * de gas" aplicada al umbral de incapacitación); "corrosive-exposure" → vapor
 * ácido (ámbar) sobre el tripulante. Ambos disparan además el burst de daño
 * a tripulante compartido si la severidad es letal.
 */
export const CLOUD_TINT: Readonly<Record<HazardEvent["kind"], number>> = {
  "toxic-threshold": 0x6adc7a,
  "corrosive-exposure": 0xd4a83f,
};

const RADIUS_BY_SEVERITY: Readonly<Record<HazardSeverity, number>> = {
  incapacitation: 14,
  lethal: 22,
};

function hazardCloud<K extends HazardEvent["kind"]>(kind: K): EventDrivenEffect<K> {
  return {
    kind,
    trigger(scene, position: GridPosition, event: HazardEvent): void {
      const { px, py } = toPixel(position);
      const radius = RADIUS_BY_SEVERITY[event.severity];
      spawnBurst(
        scene,
        px,
        py,
        {
          lifespan: 1200,
          speed: { min: 5, max: 15 },
          scale: { start: textureScale(24), end: textureScale(60) },
          alpha: { start: 0.4, end: 0 },
          quantity: 16,
          frequency: 40,
          tint: CLOUD_TINT[kind],
          x: spreadRange(radius),
          y: spreadRange(radius),
        },
        1200,
        SMOKE_TEXTURES,
      );
      if (event.severity === "lethal") {
        crewDamageFlash(scene, px, py, radius);
      }
    },
  };
}

export const toxicThresholdEffect = hazardCloud("toxic-threshold");
export const corrosiveExposureEffect = hazardCloud("corrosive-exposure");
