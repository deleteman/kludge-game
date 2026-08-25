import type { Tickable } from "../tasks/core-loop-mode.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { RandomSource } from "../simulation/random-source.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { FloorplanSection, ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemistry/chemical-substance.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { KineticDomainEvent } from "../kinetics/kinetic-events.types.js";
import type {
  CombustionEvent,
  ReactionDomainEvent,
} from "../chemistry/reaction/reaction-events.types.js";
import { worsenWear, WEAR_ORDER } from "../wear/wear.types.js";
import type { IntegrityDomainEvent, SectionDamageCause } from "../integrity/integrity-events.types.js";
import {
  combustionSectionDamage,
  kineticImpactSectionDamage,
  SECTION_ENVIRONMENTAL_DAMAGE_RULES,
} from "../integrity/section-damage-rules.js";
import { hullBreachCell } from "../integrity/breach-cell.js";
import { SECTION_INTEGRITY_PARAMETERS } from "../integrity/section-integrity-parameters.js";
import { applySectionDamage } from "../integrity/section-integrity.js";
import {
  fromSectionIntegritySnapshot,
  initialSectionIntegrity,
  integrityFraction,
  toSectionIntegritySnapshot,
  type SectionIntegrity,
  type SectionIntegritySnapshot,
  type WeightedSectionIntegrity,
} from "../integrity/section-integrity.types.js";
import { PRESSURE_SINK_FLOOR_KPA } from "./mission-atmosphere-runtime.js";
import type { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import type { SectionBreach } from "./section-breach-pressure-sink.js";
import type { MutableShipState } from "./mutable-ship-state.js";

export interface MissionSectionIntegrityRuntimeDeps {
  readonly shipState: MutableShipState;
  readonly shipFloorplan: ShipFloorplan;
  readonly atmosphereRuntime: MissionAtmosphereRuntime;
  readonly chemicalRegistry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>;
  readonly componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>;
  readonly initialSnapshots?: ReadonlyArray<SectionIntegritySnapshot>;
  readonly emitter?: EventEmitter<IntegrityDomainEvent>;
  /** Impactos cinéticos: solo los que dieron contra PARED dañan la sección. */
  readonly kineticEvents?: EventEmitter<KineticDomainEvent>;
  /**
   * Reacciones: entra por combustión (daño) y sale por las explosiones del
   * colapso. El mismo emisor en los dos sentidos, a propósito — una explosión
   * de colapso es una combustión real y tiene que verse y sonar como tal, no
   * ser un efecto visual aparte.
   */
  readonly reactionEvents?: EventEmitter<ReactionDomainEvent>;
  /** Azar del colapso. Inyectado: determinista en tests, `systemRandom` en producción. */
  readonly random?: RandomSource;
}

/**
 * Vida propia por sección (Subfase 13f). Reemplaza el modelo de la Fase 11g,
 * donde la integridad de casco se derivaba del `RE` de las piezas instaladas y
 * una manguera contaba como casco.
 *
 * Molde de `MissionStructuralRuntime`: mismos colaboradores, mismo recorrido
 * por secciones, y se registra en el core loop DESPUÉS de
 * `MissionAtmosphereRuntime` para leer la atmósfera del tick ya aplicada.
 *
 * Cuatro escritores de daño (`integrity/section-damage-rules.ts`): impacto
 * cinético contra pared y explosión entran por evento; corrosión y
 * descompresión se evalúan por tick. Al llegar a 0 la sección colapsa —
 * brecha, daño a la maquinaria de adentro y explosiones — y no se recupera
 * nunca (principio 5 de CLAUDE.md).
 *
 * NOTA DE ALCANCE HONESTA: de los cuatro escritores, el de corrosión no tiene
 * camino real en ningún capítulo autorado, porque ninguno tiene una sustancia
 * `CORR` viva en su atmósfera (el Cap.1 es fuga de presión, no ácido). Está
 * cableado y testeado, pero hasta que exista ese contenido no va a mover nada
 * jugando. Mismo aviso, y por la misma razón, que el docblock de
 * `MissionStructuralRuntime`.
 */
export class MissionSectionIntegrityRuntime implements Tickable {
  private readonly bySection = new Map<SectionId, SectionIntegrity>();
  private readonly breaches: SectionBreach[] = [];
  private readonly deps: MissionSectionIntegrityRuntimeDeps;
  /** Último tick visto, para poder resolver daño por evento fuera de `tick()`. */
  private lastTick: TickContext = { dtSeconds: 0, elapsedSeconds: 0 };
  /**
   * Explosiones que este runtime emitió al colapsar una sección. Se ignoran al
   * volver por el emisor: sin esto, el colapso se dañaría a sí mismo en bucle
   * (colapso → explosión → daño → colapso). La sección ya está en 0; el daño
   * extra no significaría nada y el bucle sí.
   */
  private readonly ignoredCombustionRefs = new Set<CombustionEvent>();

  constructor(deps: MissionSectionIntegrityRuntimeDeps) {
    this.deps = deps;

    for (const section of deps.shipFloorplan.sections) {
      const snapshot = deps.initialSnapshots?.find((entry) => entry.sectionId === section.id);
      const integrity = snapshot
        ? fromSectionIntegritySnapshot(snapshot)
        : initialSectionIntegrity(section);
      this.bySection.set(section.id, integrity);
      if (integrity.breached) {
        // Cicatriz cargada de un save: la brecha vuelve a existir, y con ella
        // su fuga. Sin esto, cargar la partida "reparaba" la nave sola.
        this.breaches.push({
          sectionId: section.id,
          // La celda viene del save. El fallback solo cubre saves anteriores a
          // la ronda 1 de 13f, donde el campo no existía.
          cell: integrity.breachCell ?? this.breachCellFor(section.id),
        });
      }
    }

    deps.kineticEvents?.on("kinetic-impact", (event) => {
      const amount = kineticImpactSectionDamage(event);
      if (amount <= 0) {
        return;
      }
      const section = sectionContainingCell(deps.shipFloorplan, event.position);
      if (section) {
        this.damage(section.id, amount, "kinetic-impact", this.breachCellFor(section.id, event.position));
      }
    });

    deps.reactionEvents?.on("combustion", (event) => {
      if (!event.sectionId || this.ignoredCombustionRefs.delete(event)) {
        return;
      }
      const amount = combustionSectionDamage(event);
      if (amount > 0) {
        this.damage(event.sectionId, amount, "combustion", this.breachCellFor(event.sectionId));
      }
    });
  }

  integrityOf(sectionId: SectionId): SectionIntegrity | undefined {
    return this.bySection.get(sectionId);
  }

  /** Fracción [0,1] de vida de una sección — insumo del `ShipStatusIndicator` del HUD. */
  fractionOf(sectionId: SectionId): number {
    const integrity = this.bySection.get(sectionId);
    return integrity ? integrityFraction(integrity) : 1;
  }

  /**
   * Vida de TODAS las secciones para la agregación a nivel de nave, cada una
   * con su peso. El peso base es el `maxHp`, que ya es área × HP por celda:
   * perder la esclusa de 10 celdas no puede pesar lo mismo que perder la bodega
   * de 60. Una sección BRECHADA pesa además un múltiplo de eso — ver
   * `breachedSectionWeightMultiplier`.
   */
  weightedFractions(): ReadonlyArray<WeightedSectionIntegrity> {
    const { breachedSectionWeightMultiplier } = SECTION_INTEGRITY_PARAMETERS.breach;
    return [...this.bySection.values()].map((integrity) => ({
      fraction: integrityFraction(integrity),
      weight: integrity.maxHp * (integrity.breached ? breachedSectionWeightMultiplier : 1),
    }));
  }

  /** Brechas abiertas, para el sumidero de presión (`sectionBreachPressureSink`). */
  openBreaches(): ReadonlyArray<SectionBreach> {
    return this.breaches;
  }

  /** Piso de presión de una sección: vacío si está brechada, el de 11h si no. */
  pressureFloorFor(sectionId: SectionId): number {
    return this.bySection.get(sectionId)?.breached
      ? SECTION_INTEGRITY_PARAMETERS.breach.pressureFloorKpa
      : PRESSURE_SINK_FLOOR_KPA;
  }

  toSnapshots(): ReadonlyArray<SectionIntegritySnapshot> {
    return [...this.bySection.entries()].map(([sectionId, integrity]) =>
      toSectionIntegritySnapshot(sectionId, integrity),
    );
  }

  tick(ctx: TickContext): void {
    this.lastTick = ctx;
    for (const section of this.deps.shipFloorplan.sections) {
      const integrity = this.bySection.get(section.id);
      const atmosphere = this.deps.atmosphereRuntime.atmosphereOf(section.id);
      if (!integrity || !atmosphere || integrity.breached) {
        continue;
      }
      for (const rule of SECTION_ENVIRONMENTAL_DAMAGE_RULES) {
        const damage = rule.damageFor({
          atmosphere,
          integrity,
          chemicalRegistry: this.deps.chemicalRegistry,
          dtSeconds: ctx.dtSeconds,
        });
        if (damage.amount <= 0) {
          continue;
        }
        this.applyAndResolve(
          section.id,
          damage.amount,
          rule.cause,
          this.breachCellFor(section.id),
          damage.floorHp,
        );
      }
    }
  }

  private damage(
    sectionId: SectionId,
    amount: number,
    cause: SectionDamageCause,
    breachCell: GridPosition,
  ): void {
    this.applyAndResolve(sectionId, amount, cause, breachCell);
  }

  private applyAndResolve(
    sectionId: SectionId,
    amount: number,
    cause: SectionDamageCause,
    breachCell: GridPosition,
    floorHp?: number,
  ): void {
    const integrity = this.bySection.get(sectionId);
    if (!integrity) {
      return;
    }
    const events = applySectionDamage({
      sectionId,
      integrity,
      amount,
      cause,
      breachCell,
      floorHp,
      tick: this.lastTick,
      emitter: this.deps.emitter,
    });
    if (events.some((event) => event.kind === "section-breached")) {
      this.collapse(sectionId, breachCell);
    }
  }

  /**
   * Consecuencias del colapso, en orden. Es lo que convierte "la barra llegó a
   * cero" en una escena: la sección se abre al vacío, lo que había dentro
   * queda dañado y algo revienta.
   */
  private collapse(sectionId: SectionId, breachCell: GridPosition): void {
    this.breaches.push({ sectionId, cell: breachCell });
    this.damageMachinery(sectionId);
    this.fireCollapseExplosions(sectionId);
  }

  /**
   * La maquinaria de una sección que se abre al vacío no sale indemne: cada
   * pieza sube un escalón de desgaste, y la que ya estaba en el peor escalón
   * queda destruida.
   *
   * Reusa `worsenWear`, el mismo eje que escriben la canibalización (13c) y la
   * corrosión — no un segundo campo de daño por instancia. Dos ejes
   * describiendo el mismo deterioro es exactamente el doble conteo que 13c ya
   * tuvo que deshacer.
   */
  private damageMachinery(sectionId: SectionId): void {
    const blueprint = this.deps.shipState.get();
    let changed = false;
    const updated = blueprint.placedComponents.map((instance) => {
      const section = sectionContainingCell(this.deps.shipFloorplan, instance.placement.position);
      if (section?.id !== sectionId || instance.condition === "destroyed") {
        return instance;
      }
      changed = true;
      const worst = WEAR_ORDER[WEAR_ORDER.length - 1];
      if (instance.wear === worst) {
        return { ...instance, condition: "destroyed" as const };
      }
      return { ...instance, wear: worsenWear(instance.wear) };
    });
    if (changed) {
      this.deps.shipState.set({ ...blueprint, placedComponents: updated });
    }
  }

  /**
   * Explosiones del colapso. Son `CombustionEvent` REALES por el emisor de
   * reacciones, no un efecto visual inventado: así suenan, iluminan y dañan a
   * la tripulación por los mismos caminos que cualquier otra combustión
   * (principio 6 — un fenómeno, una representación).
   *
   * El azar entra por el puerto `RandomSource`; sin fuente inyectada el
   * resultado es determinista (el mínimo), que es lo que quieren los tests.
   */
  private fireCollapseExplosions(sectionId: SectionId): void {
    const { minExplosions, maxExplosions } = SECTION_INTEGRITY_PARAMETERS.collapse;
    const roll = this.deps.random?.() ?? 0;
    const count = minExplosions + Math.floor(roll * (maxExplosions - minExplosions + 1));

    for (let index = 0; index < count; index += 1) {
      const event: CombustionEvent = {
        kind: "combustion",
        intensity: "violent",
        radius: "half-section",
        crewDamage: "medium",
        sectionId,
        elapsedSeconds: this.lastTick.elapsedSeconds,
      };
      // Marcado ANTES de emitir: el emisor despacha síncrono, así que el
      // handler de arriba lo ve en esta misma llamada.
      this.ignoredCombustionRefs.add(event);
      this.deps.reactionEvents?.emit(event);
    }
  }

  /**
   * Celda donde se abriría la brecha de esta sección: la celda de casco (una
   * que toca el exterior) más cercana al origen del daño.
   *
   * `origin` es la celda exacta cuando el fenómeno la tiene (un impacto
   * cinético) y el centroide cuando no (una explosión daña "la sección", no una
   * pared puntual). En los dos casos el resultado se proyecta al borde: la
   * primera versión de 13f devolvía el centroide tal cual y abría el agujero en
   * medio del piso, lejos de donde el operador había clickeado.
   */
  private breachCellFor(sectionId: SectionId, origin?: GridPosition): GridPosition {
    const section = this.deps.shipFloorplan.sections.find((entry) => entry.id === sectionId);
    if (!section) {
      return origin ?? { x: 0, y: 0 };
    }
    return hullBreachCell(this.deps.shipFloorplan, section, origin ?? sectionCentroid(section));
  }
}

/**
 * Celda representativa de una sección, para las brechas que no nacen de una
 * celda concreta (una explosión daña "la sección", no una pared puntual). Se
 * elige la celda REAL más cercana al centroide y no el centroide calculado:
 * una sección en L puede tener su centro geométrico fuera de sí misma, y el
 * jugador tiene que poder instalar el parche ahí.
 */
function sectionCentroid(section: FloorplanSection): GridPosition {
  const first = section.cells[0] ?? { x: 0, y: 0 };
  const sum = section.cells.reduce((acc, cell) => ({ x: acc.x + cell.x, y: acc.y + cell.y }), {
    x: 0,
    y: 0,
  });
  const center = { x: sum.x / section.cells.length, y: sum.y / section.cells.length };
  return section.cells.reduce((closest, cell) => {
    const distance = Math.abs(cell.x - center.x) + Math.abs(cell.y - center.y);
    const best = Math.abs(closest.x - center.x) + Math.abs(closest.y - center.y);
    return distance < best ? cell : closest;
  }, first);
}
