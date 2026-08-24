import type {
  KineticDamageSeverity,
  KineticImpactEvent,
  MagneticAccelerationEvent,
  VelocityLevel,
} from "engine";

import { crewDamageFlash } from "./combustion-effect.js";
import type { EventDrivenEffect, GridPosition } from "../particle-effect.types.js";
import { spawnBurst, spreadRange, textureScale, toPixel } from "../particle-utils.js";
import { FIRE_TEXTURES, TRACE_TEXTURE } from "../particle-texture-registry.js";

/**
 * Extensión de aceleración magnética (`docs/Extension_aceleracion_magnetica.md`
 * §4): estela detrás del objeto (sin estela si la velocidad es baja/reposo) e
 * impacto cinético direccional (en la trayectoria, no radial como una
 * explosión — se distingue de `overload-effect.ts::explosionBurst`).
 */
const WAKE_INTENSITY_BY_VELOCITY: Readonly<Record<VelocityLevel, number>> = {
  N: 0,
  B: 0,
  M: 10,
  A: 20,
};

export const magneticAccelerationEffect: EventDrivenEffect<"magnetic-acceleration"> = {
  kind: "magnetic-acceleration",
  trigger(scene, position: GridPosition, event: MagneticAccelerationEvent, options): void {
    const quantity = WAKE_INTENSITY_BY_VELOCITY[event.velocity];
    if (quantity === 0) return; // Sin estela si la velocidad es baja/reposo (documento §4).
    const { px, py } = toPixel(position);
    spawnBurst(
      scene,
      px,
      py,
      {
        lifespan: 300,
        speed: { min: 5, max: 15 },
        scale: { start: textureScale(18), end: 0 },
        alpha: { start: 0.5, end: 0 },
        quantity,
        frequency: 20,
        tint: 0x9fd8ff,
        x: spreadRange(3),
        y: spreadRange(3),
      },
      300,
      TRACE_TEXTURE,
      options?.onObjectCreated,
    );
  },
};

const IMPACT_QUANTITY_BY_SEVERITY: Readonly<Record<KineticDamageSeverity, number>> = {
  low: 8,
  medium: 14,
  high: 22,
};

export const kineticImpactEffect: EventDrivenEffect<"kinetic-impact"> = {
  kind: "kinetic-impact",
  trigger(scene, position: GridPosition, event: KineticImpactEvent, options): void {
    const { px, py } = toPixel(position);
    // Burst direccional (en la trayectoria del proyectil), no radial —
    // distingue el impacto cinético de una explosión (documento §4).
    spawnBurst(
      scene,
      px,
      py,
      {
        lifespan: 400,
        speed: { min: 80, max: 180 },
        angle: { min: -15, max: 15 },
        scale: { start: textureScale(22), end: 0 },
        quantity: IMPACT_QUANTITY_BY_SEVERITY[event.severity],
        tint: 0xd8d8d8,
        x: spreadRange(2),
        y: spreadRange(2),
      },
      400,
      FIRE_TEXTURES,
      options?.onObjectCreated,
    );
    if (event.severity === "high") {
      scene.cameras.main.shake(180, 0.006);
      crewDamageFlash(scene, px, py, 10, options?.onObjectCreated);
    }
  },
};
