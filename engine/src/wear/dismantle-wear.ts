import { atomicRecoveryFraction } from "../crew/atomic-recovery.js";
import type { CrewSpecialty } from "../crew/crew-specialty.types.js";
import type { CrewTier } from "../crew/crew-tier.types.js";
import type { StructuralResistanceLevel } from "../properties/material.types.js";
import type { RandomSource } from "../simulation/random-source.js";
import { type ComponentWear, worsenWear } from "./wear.types.js";

export interface DismantleWearInput {
  /** Desgaste que la pieza traía antes de desmontarla. */
  readonly current: ComponentWear;
  readonly tier: CrewTier;
  readonly specialty: CrewSpecialty;
  /**
   * RE EFECTIVA de la pieza al momento de desmontarla (no la de catálogo): una
   * pieza ya degradada es más fácil de romper todavía más. Cierra el ciclo que
   * el GDD §6.5 insinuaba — "rara vez pierde algo salvo piezas ya dañadas
   * previamente".
   */
  readonly effectiveResistance?: StructuralResistanceLevel;
}

/**
 * Desgaste con el que una pieza vuelve al stock tras canibalizarla (Subfase
 * 13c, escritor 1). Reutiliza la probabilidad de recuperación de GDD §6.5
 * (`crew/atomic-recovery.ts`) como probabilidad de CONSERVAR el estado:
 *
 *   novato 0.6  ·  veterano 0.8  ·  experto 0.925
 *   +0.10 si lo hace el Ingeniero (su afinidad, GDD §6.6)
 *   −0.15 si la pieza ya tenía RE efectiva baja (GDD §6.5)
 *
 * Nota: `atomicRecoveryFraction` existía desde la Fase 9 pero NINGÚN llamador
 * de producción la usaba — solo tests. 13c la pone a trabajar por primera vez.
 * Se reinterpreta como probabilidad por pieza en vez de como fracción de un
 * montón, que es lo que el desmontaje real necesita: acá se desmonta una
 * instancia concreta, no un lote.
 *
 * El azar viene INYECTADO (`RandomSource`): sin él la función es determinista y
 * conserva siempre, que es el comportamiento correcto para los llamadores que
 * todavía no eligieron una fuente (y para los tests que no ejercitan desgaste).
 */
export function wearAfterDismantle(
  input: DismantleWearInput,
  random?: RandomSource,
): ComponentWear {
  if (!random) {
    return input.current;
  }
  const keepChance = atomicRecoveryFraction(
    input.tier,
    input.specialty,
    input.effectiveResistance,
  );
  return random() < keepChance ? input.current : worsenWear(input.current);
}
