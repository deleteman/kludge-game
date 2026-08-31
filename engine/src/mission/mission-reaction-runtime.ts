import type { Tickable } from "../tasks/core-loop-mode.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import { ReactionResolver } from "../chemistry/reaction/reaction-resolver.js";
import type { ReactionDomainEvent } from "../chemistry/reaction/reaction-events.types.js";
import { sectionCombustionAtmosphere } from "../atmosphere/combustion-atmosphere.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { FailureDomainEvent } from "../failure/failure-events.types.js";
import type { ScriptedReactionSubject } from "../crisis/crisis-definition.types.js";
import type { SalvageDomainEvent } from "../salvage/salvage-hazard.types.js";
import type { MutableShipState } from "./mutable-ship-state.js";
import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemistry/chemical-substance.types.js";
import { THERMAL_REGULATOR_OVERLOAD_CELSIUS } from "../atmosphere/thermal-parameters.js";
import { reactantsFingerprint, sectionReactants } from "./section-reactants.js";

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
  /** Última huella evaluada por sección (14a-2), para no re-emitir sin cambios. */
  private readonly lastEmergentFingerprint = new Map<SectionId, string>();

  constructor(
    private readonly shipState: MutableShipState,
    private readonly shipFloorplan: ShipFloorplan,
    private readonly scriptedSubjects: ReadonlyArray<ScriptedReactionSubject>,
    private readonly resolver: ReactionResolver,
    private readonly atmosphereOf: (sectionId: SectionId) => SectionAtmosphere | undefined,
    private readonly emitter?: EventEmitter<ReactionDomainEvent>,
    failureEvents?: EventEmitter<FailureDomainEvent>,
    salvageEvents?: EventEmitter<SalvageDomainEvent>,
    /**
     * Catálogo químico, para leer los tags de lo que hay en el aire (14a-2).
     * Sin él el runtime se comporta como antes: solo química scripteada.
     */
    private readonly substanceOf?: (
      substanceId: ChemicalSubstanceId,
    ) => ChemicalSubstanceDefinition | undefined,
    /**
     * Secciones con un regulador térmico instalado (14a-2), resuelto por
     * `mission/thermal-regulators.ts`. Callback y no el blueprint entero por el
     * mismo criterio que `atmosphereOf`: este runtime no conoce el reparto de
     * energía ni el grafo de señal.
     */
    private readonly regulatorSections?: () => ReadonlySet<SectionId>,
  ) {
    // Subfase 13f: `OverloadEvent` ya trae `sectionId` estampado por
    // `MissionOverloadRuntime`. Antes este handler resolvía el puente
    // `ref → sección` a mano; ahora ese lookup vive en un solo sitio y acá se
    // lee el campo, igual que con `dismantle-spark`.
    failureEvents?.on("overload", (event) => {
      if (event.failureMode !== "fire" && event.failureMode !== "explosion") {
        return;
      }
      if (event.sectionId) {
        this.ignitedSectionIds.add(event.sectionId);
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
    this.tickScripted(ctx);
    this.tickEmergent(ctx);
  }

  /**
   * Química EMERGENTE por sección (Subfase 14a-2): las sustancias que están de
   * verdad en el aire de cada sala, no las que declaró un guion.
   *
   * Es lo que hace alcanzable a `SpontaneousIgnitionRule`, muerta desde que se
   * escribió porque su única puerta de entrada —`thermalRegulatorOverloaded`—
   * era un `false` literal y sus reactivos solo podían venir de
   * `scriptedReactions`, vacío en todos los capítulos.
   *
   * A diferencia de los sujetos scripteados, acá NO se marca una cicatriz por
   * id: la sección se re-evalúa mientras su contenido cambie. El antirruido va
   * por huella (`reactantsFingerprint` + el estado del regulador): sin cambios,
   * no se vuelve a resolver ni a emitir.
   */
  private tickEmergent(ctx: TickContext): void {
    if (!this.substanceOf) {
      return;
    }
    for (const section of this.shipFloorplan.sections) {
      const atmosphere = this.atmosphereOf(section.id);
      if (!atmosphere) {
        continue;
      }
      const reactants = sectionReactants(atmosphere, this.substanceOf);
      if (reactants.length === 0) {
        this.lastEmergentFingerprint.delete(section.id);
        continue;
      }
      const regulatorOverloaded = this.isThermalRegulatorOverloaded(section.id, atmosphere);
      const ignitionPresent = this.ignitedSectionIds.has(section.id);
      const fingerprint = `${reactantsFingerprint(reactants)}#${regulatorOverloaded}#${ignitionPresent}`;
      if (this.lastEmergentFingerprint.get(section.id) === fingerprint) {
        continue;
      }
      this.lastEmergentFingerprint.set(section.id, fingerprint);

      const outcome = this.resolver.resolve({
        reactants,
        oxygen: sectionCombustionAtmosphere(atmosphere),
        ignitionPresent,
        thermalRegulatorOverloaded: regulatorOverloaded,
        elapsedSeconds: ctx.elapsedSeconds,
      });
      if (outcome.appliedRuleIds.length === 0 || !this.emitter) {
        continue;
      }
      for (const event of outcome.events) {
        this.emitter.emit(
          event.kind === "combustion" || event.kind === "neutralization"
            ? { ...event, sectionId: section.id }
            : event,
        );
      }
    }
  }

  /**
   * ¿El regulador térmico de esta sección está sobrecargado? (GDD 5.3).
   *
   * Hay regulador instalado **y** la sala está por encima del umbral en el que
   * deja de dar abasto. Un regulador que se rindió ante el calor es exactamente
   * eso: instalado y superado. Sin regulador la respuesta es `false` — no es que
   * el regulador esté sobrecargado, es que no hay ninguno.
   */
  private isThermalRegulatorOverloaded(sectionId: SectionId, atmosphere: SectionAtmosphere): boolean {
    if (!this.regulatorSections) {
      return false;
    }
    return (
      this.regulatorSections().has(sectionId) &&
      atmosphere.temperatureCelsius >= THERMAL_REGULATOR_OVERLOAD_CELSIUS
    );
  }

  private tickScripted(ctx: TickContext): void {
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
        thermalRegulatorOverloaded: atmosphere
          ? this.isThermalRegulatorOverloaded(subject.sectionId, atmosphere)
          : false,
        elapsedSeconds: ctx.elapsedSeconds,
      });
      if (!outcome.appliedRuleIds.includes("combustion")) {
        continue;
      }
      this.firedSubjectIds.add(subject.id);
      if (this.emitter) {
        for (const event of outcome.events) {
          // 14a-1: la neutralización se estampa igual que la combustión —
          // su calor (`heatReleasedCelsius`) no sirve de nada sin saber a qué
          // sección aplicárselo.
          this.emitter.emit(
            event.kind === "combustion" || event.kind === "neutralization"
              ? { ...event, sectionId: subject.sectionId }
              : event,
          );
        }
      }
    }
  }
}
