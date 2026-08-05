import type { EventEmitter } from "../simulation/event-emitter.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { ChemicalTagLevel } from "../properties/chemical-tag.types.js";
import type { StructuralResistanceLevel } from "../properties/material.types.js";
import { REACTION_PARAMETERS } from "../chemistry/reaction/reaction-parameters.js";
// Orden de resistencia estructural de mayor a menor (GDD 7.0): A → M → B → fallo.
// Desde 13c vive en `properties/material-order.ts` — este módulo dejó de ser su
// único consumidor (la agregación de creaciones y el dominio `wear/` lo usan).
import { RE_ORDER } from "../properties/material-order.js";
import type { FailureDomainEvent } from "./failure-events.types.js";

/**
 * Segundos de exposición continua para bajar un nivel de RE, según el nivel del
 * corrosivo (Espec. §1: ~15s a corrosivo medio, el doble de rápido a alto). El
 * nivel B se extrapola como más lento (documentado; ajustable).
 */
const SECONDS_PER_LEVEL_BY_CORROSIVE: Record<ChemicalTagLevel, number> = {
  A: REACTION_PARAMETERS.corrosion.structuralLevelSecondsHigh,
  M: REACTION_PARAMETERS.corrosion.structuralLevelSecondsMedium,
  B: REACTION_PARAMETERS.corrosion.structuralLevelSecondsMedium * 2,
};

/**
 * Degradación estructural por corrosión (GDD 5.3/5.6, Espec. §1). Acumula el
 * daño de la exposición corrosiva continua y baja la resistencia estructural
 * un nivel a la vez (A→M→B→fallo), emitiendo un evento en cada paso.
 *
 * Consecuencia permanente (principio 5 de CLAUDE.md): el daño acumulado NO se
 * recupera cuando la exposición cesa — la degradación y el progreso parcial
 * hacia el siguiente nivel persisten. La corrosión es una cicatriz, no un
 * estado transitorio.
 */
export class StructuralIntegrity {
  private level: StructuralResistanceLevel;
  private failed = false;
  /** Progreso [0,1) hacia el próximo descenso de nivel. */
  private damageProgress = 0;

  constructor(
    private readonly ref: string,
    initialLevel: StructuralResistanceLevel = "A",
  ) {
    this.level = initialLevel;
  }

  get currentLevel(): StructuralResistanceLevel {
    return this.level;
  }

  get hasFailed(): boolean {
    return this.failed;
  }

  /**
   * Aplica un tick de exposición. `corrosiveLevel` null = sin exposición este
   * tick (el daño acumulado se conserva, no se reduce).
   */
  tick(
    corrosiveLevel: ChemicalTagLevel | null,
    tick: TickContext,
    emitter?: EventEmitter<FailureDomainEvent>,
  ): FailureDomainEvent[] {
    if (this.failed || corrosiveLevel === null) {
      return [];
    }
    const events: FailureDomainEvent[] = [];
    this.damageProgress += tick.dtSeconds / SECONDS_PER_LEVEL_BY_CORROSIVE[corrosiveLevel];

    // Epsilon: la acumulación tick a tick de fracciones (1/15…) cae por
    // redondeo justo por debajo de 1 en los límites exactos.
    const EPSILON = 1e-9;
    while (this.damageProgress >= 1 - EPSILON && !this.failed) {
      this.damageProgress -= 1;
      const index = RE_ORDER.indexOf(this.level);
      const nextLevel = RE_ORDER[index + 1];
      if (nextLevel) {
        this.level = nextLevel;
        const event: FailureDomainEvent = {
          kind: "structural-degraded",
          ref: this.ref,
          newLevel: nextLevel,
          elapsedSeconds: tick.elapsedSeconds,
        };
        events.push(event);
        emitter?.emit(event);
      } else {
        this.failed = true;
        const event: FailureDomainEvent = {
          kind: "structural-failure",
          ref: this.ref,
          elapsedSeconds: tick.elapsedSeconds,
        };
        events.push(event);
        emitter?.emit(event);
      }
    }
    return events;
  }
}
