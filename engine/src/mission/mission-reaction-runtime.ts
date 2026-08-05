import type { Tickable } from "../tasks/core-loop-mode.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import { ReactionResolver } from "../chemistry/reaction/reaction-resolver.js";
import type { ReactionDomainEvent } from "../chemistry/reaction/reaction-events.types.js";
import { sectionCombustionAtmosphere } from "../atmosphere/combustion-atmosphere.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { FailureDomainEvent } from "../failure/failure-events.types.js";
import type { ScriptedReactionSubject } from "../crisis/crisis-definition.types.js";
import type { SalvageDomainEvent } from "../salvage/salvage-hazard.types.js";
import type { MutableShipState } from "./mutable-ship-state.js";

/**
 * Química viva de misión (Fase 13a, deuda #16) — primer llamador de
 * producción de `ReactionResolver` fuera de la mesa de creación. Mismo
 * criterio data-driven que `MissionOverloadRuntime` (Fase 12a): no existe
 * todavía ninguna fuente real de sustancias vivas en el mundo (reservorios
 * sin sustancia+cantidad, fugas sin `ChemicalSubstanceId` en la atmósfera —
 * bloqueado detrás de la Fase 13e), así que `reactants` sale del guion de la
 * crisis (`ScriptedReactionSubject`). Lo que SÍ es real: `oxygen` (atmósfera
 * viva de la sección) e `ignitionPresent` cuando el trigger es
 * `"overload-bridge"` — este runtime se suscribe al emisor de fallos para
 * saber si un `OverloadEvent` fire/explosion ya "encendió" la sección.
 * `ReactionResolver` sigue siendo la única lógica que decide el resultado.
 *
 * Cicatriz sin retorno (principio 5 de CLAUDE.md): un `subject.id` que
 * dispara combustión no se vuelve a evaluar.
 */
export class MissionReactionRuntime implements Tickable {
  private readonly firedSubjectIds = new Set<string>();
  private readonly ignitedSectionIds = new Set<SectionId>();

  constructor(
    private readonly shipState: MutableShipState,
    private readonly shipFloorplan: ShipFloorplan,
    private readonly scriptedSubjects: ReadonlyArray<ScriptedReactionSubject>,
    private readonly resolver: ReactionResolver,
    private readonly atmosphereOf: (sectionId: SectionId) => SectionAtmosphere | undefined,
    private readonly emitter?: EventEmitter<ReactionDomainEvent>,
    failureEvents?: EventEmitter<FailureDomainEvent>,
    salvageEvents?: EventEmitter<SalvageDomainEvent>,
  ) {
    failureEvents?.on("overload", (event) => {
      if (event.failureMode !== "fire" && event.failureMode !== "explosion") {
        return;
      }
      const instance = this.shipState.get().placedComponents.find((entry) => entry.instanceId === event.ref);
      const section = instance && sectionContainingCell(this.shipFloorplan, instance.placement.position);
      if (section) {
        this.ignitedSectionIds.add(section.id);
      }
    });
    // Segunda fuente de ignición REAL (Subfase 13d): el chispazo de desmontar
    // una pieza viva. Es el doble filo del GDD §5.5 / caso de validación 8 —
    // hasta acá, "provocar una chispa con un cable pelado" solo existía como
    // `ignitionPresent: true` literal en el fixture del test.
    salvageEvents?.on("dismantle-spark", (event) => {
      if (event.sectionId) {
        this.ignitedSectionIds.add(event.sectionId);
      }
    });
  }

  tick(ctx: TickContext): void {
    if (this.scriptedSubjects.length === 0) {
      return;
    }
    for (const subject of this.scriptedSubjects) {
      if (this.firedSubjectIds.has(subject.id)) {
        continue;
      }
      const ignitionPresent = subject.ignitionTrigger === "always" || this.ignitedSectionIds.has(subject.sectionId);
      if (!ignitionPresent) {
        continue;
      }
      const atmosphere = this.atmosphereOf(subject.sectionId);
      const outcome = this.resolver.resolve({
        reactants: subject.reactants,
        oxygen: atmosphere ? sectionCombustionAtmosphere(atmosphere) : "none",
        ignitionPresent,
        // Sin fuente real todavía (mismo criterio que documentó en su día
        // `allEmittersActive`): ningún subsistema del motor modela hoy un
        // regulador térmico sobrecargado que este runtime pueda consultar.
        thermalRegulatorOverloaded: false,
        elapsedSeconds: ctx.elapsedSeconds,
      });
      if (!outcome.appliedRuleIds.includes("combustion")) {
        continue;
      }
      this.firedSubjectIds.add(subject.id);
      if (this.emitter) {
        for (const event of outcome.events) {
          this.emitter.emit(
            event.kind === "combustion" ? { ...event, sectionId: subject.sectionId } : event,
          );
        }
      }
    }
  }
}
