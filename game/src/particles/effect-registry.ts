import type { DomainEvent } from "engine";
import type Phaser from "phaser";

import type { EventDrivenEffect, GridPosition } from "./particle-effect.types.js";
import { combustionEffect } from "./effects/combustion-effect.js";
import { crewDamagedEffect, crewDeathEffect } from "./effects/crew-death-effect.js";
import { corrosiveExposureEffect, toxicThresholdEffect } from "./effects/hazard-effect.js";
import { kineticImpactEffect, magneticAccelerationEffect } from "./effects/kinetics-effect.js";
import { neutralizationEffect } from "./effects/neutralization-effect.js";
import { overloadEffect } from "./effects/overload-effect.js";
import {
  dismantleLeakEffect,
  dismantleSparkEffect,
  dismantleSpillEffect,
} from "./effects/salvage-hazard-effect.js";
import { spontaneousIgnitionEffect } from "./effects/spontaneous-ignition-effect.js";
import {
  structuralDegradedEffect,
  structuralFailureEffect,
} from "./effects/structural-degraded-effect.js";

/**
 * Único punto de registro evento→efecto (Factory simple, CLAUDE.md). Se
 * amplía con un `effects/*.ts` por fenómeno a medida que se implementan —
 * `fireEventEffect` no cambia cuando se agrega uno nuevo, solo este mapa.
 *
 * Fenómenos de GDD 11.1 sin `DomainEvent` propio (flujo en conducto, fuga de
 * gas, corriente activa continua, congelación, vapor por calor) son
 * state-driven — ver `effects/conduit-flow-effect.ts` y compañía, leídos por
 * frame en vez de suscritos aquí.
 */
const EFFECTS_BY_KIND: {
  readonly [K in DomainEvent["kind"]]?: EventDrivenEffect<K>;
} = {
  combustion: combustionEffect,
  "spontaneous-ignition": spontaneousIgnitionEffect,
  neutralization: neutralizationEffect,
  overload: overloadEffect,
  "structural-degraded": structuralDegradedEffect,
  "structural-failure": structuralFailureEffect,
  "toxic-threshold": toxicThresholdEffect,
  "corrosive-exposure": corrosiveExposureEffect,
  "magnetic-acceleration": magneticAccelerationEffect,
  "kinetic-impact": kineticImpactEffect,
  "crew-death": crewDeathEffect,
  "crew-damaged": crewDamagedEffect,
  // Subfase 13d — riesgo al canibalizar (chispa/derrame/fuga).
  "dismantle-spark": dismantleSparkEffect,
  "dismantle-spill": dismantleSpillEffect,
  "dismantle-leak": dismantleLeakEffect,
};

/** Dispara el efecto registrado para `event.kind`, si existe uno todavía. */
export function fireEventEffect(
  scene: Phaser.Scene,
  position: GridPosition,
  event: DomainEvent,
): void {
  const effect = EFFECTS_BY_KIND[event.kind] as EventDrivenEffect | undefined;
  effect?.trigger(scene, position, event);
}
