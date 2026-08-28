import { DOOR_PARAMETERS } from "../door-parameters.js";
import type {
  DoorGovernanceContext,
  DoorGovernanceOutcome,
  DoorGovernanceRule,
} from "../door-governance.js";
import type { MagneticFieldIntensity } from "../../kinetics/magnetic-field.js";
import type { StructuralResistanceLevel } from "../../properties/material.types.js";

const INTENSITY_ORDER: readonly MagneticFieldIntensity[] = ["N", "B", "M", "A"];
const RESISTANCE_ORDER: readonly StructuralResistanceLevel[] = ["B", "M", "A"];

/**
 * Caso de validación 9, "El Electroimán de Emergencia": un campo magnético lo
 * bastante intenso traba una hoja metálica y el intruso no pasa.
 *
 * Hasta 13h el caso 9 solo verificaba que se pudiera ENSAMBLAR el `MAG` a
 * partir de piezas atómicas, porque no había ninguna puerta que trabar. Esta
 * regla es el consumidor que faltaba.
 *
 * La condición es por PROPIEDADES en los dos lados (principio 1): un campo por
 * encima del umbral sobre una hoja lo bastante resistente. No hay lista de ids
 * de puertas "imantables" ni de emisores válidos — cualquier bobina que el
 * jugador improvise sirve, que es el punto del caso 9.
 */
export class MagneticLockRule implements DoorGovernanceRule {
  readonly source = "magnetic-lock" as const;

  appliesTo(ctx: DoorGovernanceContext): boolean {
    return (
      atLeast(INTENSITY_ORDER, ctx.magneticFieldIntensity, DOOR_PARAMETERS.magneticLockMinIntensity) &&
      atLeast(RESISTANCE_ORDER, ctx.resistance, DOOR_PARAMETERS.magneticLockMinResistance)
    );
  }

  resolve(): DoorGovernanceOutcome {
    return { forcedState: "jammed", mode: "override", overrideSource: "magnetic-lock" };
  }
}

function atLeast<T>(order: readonly T[], value: T, minimum: T): boolean {
  return order.indexOf(value) >= order.indexOf(minimum);
}
