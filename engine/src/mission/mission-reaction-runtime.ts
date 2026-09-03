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
import {
  AUTOIGNITION_CELSIUS,
  OVERLOAD_HEAT,
  SPARK_IGNITION_SECONDS,
  THERMAL_REGULATOR_OVERLOAD_CELSIUS,
} from "../atmosphere/thermal-parameters.js";
import { reactantsFingerprint, sectionReactants } from "./section-reactants.js";
import type { ReactantSubstance } from "../chemistry/reaction/reaction-context.types.js";

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
  /**
   * Secciones con una fuente de ignición ACTIVA y hasta cuándo lo están
   * (Subfase 14a-3). Era un `Set` que nunca se limpiaba: una sala donde alguna
   * vez saltó un chispazo quedaba inflamable el resto de la misión, y con la
   * evaporación de 14a-3 eso pasaba a ser el camino normal para arder sin causa
   * presente. Cada fuente declara su duración leyendo la que ya existe
   * (`OVERLOAD_HEAT`), en vez de inventar un número paralelo.
   */
  private readonly ignitedUntilSeconds = new Map<SectionId, number>();
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
        // Dura lo que dura su propio fuego: la misma tabla que le da el pulso
        // de calor a `MissionThermalRuntime`, no una constante gemela.
        this.igniteFor(
          event.sectionId,
          event.elapsedSeconds,
          OVERLOAD_HEAT[event.failureMode]?.durationSeconds ?? SPARK_IGNITION_SECONDS,
        );
      }
    });
    // Segunda fuente de ignición REAL (Subfase 13d): el chispazo de desmontar
    // una pieza viva. Es el doble filo del GDD §5.5 / caso de validación 8 —
    // hasta acá, "provocar una chispa con un cable pelado" solo existía como
    // `ignitionPresent: true` literal en el fixture del test.
    salvageEvents?.on("dismantle-spark", (event) => {
      if (event.sectionId) {
        this.igniteFor(event.sectionId, event.elapsedSeconds, SPARK_IGNITION_SECONDS);
      }
    });
  }

  tick(ctx: TickContext): void {
    this.expireIgnitions(ctx.elapsedSeconds);
    this.tickScripted(ctx);
    this.tickEmergent(ctx);
  }

  /** Abre (o extiende) la ventana de ignición de una sección. */
  private igniteFor(sectionId: SectionId, elapsedSeconds: number, durationSeconds: number): void {
    const until = elapsedSeconds + durationSeconds;
    this.ignitedUntilSeconds.set(
      sectionId,
      Math.max(this.ignitedUntilSeconds.get(sectionId) ?? 0, until),
    );
  }

  /**
   * Borde INCLUSIVO (`until < elapsed`, no `<=`): el efecto de tarea que emite
   * el chispazo y el tick que lo evalúa comparten el mismo `elapsedSeconds`, y
   * con el borde exclusivo la chispa se apagaba en el mismo instante en que se
   * creaba. Con `SPARK_IGNITION_SECONDS = 1` y un chispazo en t=0, la ventana
   * vale en [0, 1] — un tick de un segundo entero, que es el mínimo para que
   * cualquier cadencia de simulación la vea.
   */
  private expireIgnitions(elapsedSeconds: number): void {
    for (const [sectionId, until] of [...this.ignitedUntilSeconds]) {
      if (until < elapsedSeconds) {
        this.ignitedUntilSeconds.delete(sectionId);
      }
    }
  }

  /**
   * ¿Hay con qué encender en esta sección? Dos caminos, y el segundo es de
   * 14a-3: una chispa reciente, **o** una sala tan caliente que enciende sola.
   * El segundo es lo que hace que un incendio se PROPAGUE por la conducción de
   * calor que ya existe desde 14a-1, sin ningún camino nuevo.
   */
  private hasIgnitionSource(sectionId: SectionId, atmosphere: SectionAtmosphere): boolean {
    return (
      this.ignitedUntilSeconds.has(sectionId) ||
      atmosphere.temperatureCelsius >= AUTOIGNITION_CELSIUS
    );
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
      const ignitionPresent = this.hasIgnitionSource(section.id, atmosphere);
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
      if (outcome.appliedRuleIds.length === 0) {
        continue;
      }
      // 14a-3: lo que reaccionó SALE del aire. Hasta acá `consumedReactantIds`
      // se declaraba en cada `ReactionResult` y no lo aplicaba nadie: el
      // combustible no se agotaba nunca. Con la autoignición eso sería una
      // cascada sin final y "apagar el fuego" no existiría — el ciclo se cierra
      // acá (derramar → evaporar → arder → agotarse → apagarse).
      this.consumeReactants(atmosphere, reactants, outcome.result);
      // La huella se recalcula sola el tick que viene sobre la atmósfera ya
      // consumida, así que no hace falta invalidarla a mano.
      if (!this.emitter) {
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
   * Quita del aire lo que reaccionó y deja en su lugar el producto, si el
   * catálogo sabe qué es.
   *
   * **Sin estequiometría, a propósito** (CLAUDE.md: "no simular química real"):
   * la fracción total de los reactivos consumidos pasa entera al producto. Y si
   * el producto no se puede resolver contra el registro —el residuo de una
   * combustión, una "Mezcla sin identificar"—, esa masa simplemente desaparece
   * del aire en vez de quedar como una clave de gas que nadie sabe leer y que
   * seguiría desplazando oxígeno para siempre.
   */
  private consumeReactants(
    atmosphere: SectionAtmosphere,
    reactants: ReadonlyArray<ReactantSubstance>,
    result: ReactantSubstance | null,
  ): void {
    let consumedFraction = 0;
    for (const reactant of reactants) {
      if (result && reactant.id === result.id) {
        continue;
      }
      consumedFraction += atmosphere.gases.get(reactant.id) ?? 0;
      atmosphere.gases.delete(reactant.id);
    }
    if (consumedFraction <= 0 || !result || !this.substanceOf?.(result.id)) {
      return;
    }
    atmosphere.gases.set(result.id, (atmosphere.gases.get(result.id) ?? 0) + consumedFraction);
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
      // La atmósfera se lee ANTES del gate (14a-3): la respuesta a "¿hay con qué
      // encender?" es la misma pregunta acá que en la química emergente, y una
      // sala a 120 °C enciende un sujeto scripteado igual que un charco.
      const atmosphere = this.atmosphereOf(subject.sectionId);
      const ignitionPresent =
        subject.ignitionTrigger === "always" ||
        (atmosphere !== undefined && this.hasIgnitionSource(subject.sectionId, atmosphere));
      if (!ignitionPresent) {
        continue;
      }
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
