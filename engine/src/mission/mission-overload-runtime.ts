import type { Tickable } from "../tasks/core-loop-mode.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import {
  OverloadRule,
  conductorOverloadSubject,
  reservoirOverloadSubject,
} from "../failure/overload-rule.js";
import { thermalCapacityFactor } from "../failure/thermal-conductivity-rule.js";
import type { FailureDomainEvent, OverloadEvent } from "../failure/failure-events.types.js";
import type { ThermalConductivityLevel } from "../properties/material.types.js";
import type { ConductorProperty } from "../properties/functional.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import { edgeElectricalLoad } from "../power/conductor-load.js";
import { edgeConductorId, edgeConductorWear, electricalConductorProperty } from "../signals/edge-conductor.js";
import type { SignalEdge, SignalEdgeId } from "../signals/signal-edge.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ScriptedOverloadSubject } from "../crisis/crisis-definition.types.js";
import { wornCapacity } from "../wear/overload-capacity.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { MutableShipState } from "./mutable-ship-state.js";

/**
 * Sobrecarga eléctrica en misión — llamador de producción de `OverloadRule`
 * (`failure/overload-rule.ts`).
 *
 * **Subfase 14a-2: la carga dejó de ser dato de guion.** Hasta acá el runtime
 * solo miraba `CrisisDefinition.scriptedOverloads`, o sea que un conductor solo
 * podía reventar donde el contenido lo hubiera decidido a mano. Por decisión
 * del operador la sobrecarga tiene que EMERGER de lo que el jugador cablea:
 * ahora se evalúa **todo conductor instalado**, con la carga derivada del
 * consumo real de las piezas que cuelgan de él (`power/conductor-load.ts`).
 * `scriptedOverloads` sobrevive como override de guion (carga y capacidad
 * fijas) para el attrezzo del capítulo 1, no como única fuente.
 *
 * **Subfase 14a-4: el sujeto del acoplamiento eléctrico es la ARISTA.** 14a-2
 * derivaba la carga de un `COND(E)` colocado en una celda, y la ronda 1 de
 * playtest destapó el agujero: nadie tiene motivo para colocar uno. El conductor
 * real de la nave es el cable que tiende el jugador, que desde 14a-4 está hecho
 * de una pieza consumida del stock y hereda su capacidad. Así que este runtime
 * recorre ahora dos colecciones:
 *  - `signalGraph.edges` — los cables, sujeto normal del acoplamiento;
 *  - `placedComponents` — solo lo que tiene override de guion
 *    (`scriptedOverloads`) o es un `RES` con contenido de guion. Una pieza
 *    `COND(E)` colocada ya NO se evalúa: sería el mismo fenómeno modelado dos
 *    veces, con dos capacidades distintas para el mismo cable.
 *
 * Cadena de capacidad, en orden y sin que ningún eslabón reemplace al anterior:
 * catálogo → `capacityOverride` de guion → `wornCapacity` (13c, el desgaste
 * hace que la misma carga reviente) → factor térmico (14a-2, frío o calor bajan
 * la capacidad efectiva sin que la carga cambie). Es la MISMA cadena para los
 * dos sujetos: si se le agrega un eslabón, se le agrega a los dos.
 *
 * Cicatriz sin retorno (principio 5 de CLAUDE.md, "consecuencias
 * permanentes"): una vez que un `ref` dispara, queda en
 * `Blueprint.overloadedRefs` para siempre y no se vuelve a evaluar. Para una
 * arista eso además significa que deja de conducir señal
 * (`signals/active-signal-graph.ts`) — la cicatriz no es cosmética.
 */
export class MissionOverloadRuntime implements Tickable {
  private readonly rule = new OverloadRule();
  private readonly firedRefs = new Set<PlacedComponentInstanceId | SignalEdgeId>();

  constructor(
    private readonly shipState: MutableShipState,
    private readonly componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
    private readonly scriptedSubjects: ReadonlyArray<ScriptedOverloadSubject>,
    private readonly emitter?: EventEmitter<FailureDomainEvent>,
    /**
     * Plano, para estampar `sectionId` en el evento (Subfase 13f, hueco #3) y
     * para saber de qué sección leer la temperatura (14a-2). Opcional: sin él
     * el evento sale sin sección y sin acoplamiento térmico — los tests que
     * solo ejercitan la regla no necesitan un plano.
     */
    private readonly shipFloorplan?: ShipFloorplan,
    /**
     * Lectura de la atmósfera de una sección, para el factor térmico (14a-2).
     * Callback angosto y opcional, mismo molde que el `atmosphereOf` de
     * `MissionReactionRuntime`: el runtime no conoce `MissionAtmosphereRuntime`.
     */
    private readonly atmosphereOf?: (sectionId: SectionId) => SectionAtmosphere | undefined,
  ) {}

  tick(ctx: TickContext): void {
    const blueprint = this.shipState.get();
    const overloadedRefs = new Set(blueprint.overloadedRefs);
    let changed = false;

    const fire = (raw: OverloadEvent | null, ref: PlacedComponentInstanceId | SignalEdgeId, sectionId?: SectionId) => {
      if (!raw) {
        return;
      }
      // Subfase 13f: la regla se evalúa SIN emisor y el evento se emite acá ya
      // con `sectionId`. `OverloadRule` sigue siendo pura y sin noción de
      // mundo; este runtime es el único que conoce el plano. Mismo reparto de
      // responsabilidades que `MissionReactionRuntime` con `CombustionEvent`.
      const event = sectionId ? { ...raw, sectionId } : raw;
      this.emitter?.emit(event);
      this.firedRefs.add(ref);
      // Chispas persistentes de conductor sobrecargado (Fase 12a, GDD 5.6):
      // solo el modo "cut" (corte/cortocircuito, típico de recurso eléctrico)
      // deja cicatriz visual continua — "fire"/"explosion" ya tienen su
      // propio burst + decal persistente (`overload-effect.ts`), sin chispas
      // en bucle.
      if (event.failureMode === "cut") {
        overloadedRefs.add(ref);
        changed = true;
      }
    };

    for (const instance of blueprint.placedComponents) {
      if (this.firedRefs.has(instance.instanceId)) {
        continue;
      }
      const scripted = this.scriptedSubjects.find(
        (entry) => entry.instanceId === instance.instanceId,
      );
      const definition = this.componentRegistry.get(instance.componentDefinitionId);
      const functional = definition?.data.functional;
      const conductor = functional?.find((property) => property.tag === "COND");
      const reservoir = functional?.find((property) => property.tag === "RES");
      // Subfase 14a-4: **sin guion no hay sujeto colocado**. Un `COND(E)` en una
      // celda dejó de ser un conductor evaluable (lo es la arista); un `RES` sin
      // guion nunca tuvo una fuente de "contenido vivo" con la que derivarle una
      // carga. Los dos se saltan en vez de inventarles un número.
      const load = scripted?.load ?? null;
      if (load === null) {
        continue;
      }
      const baseSubject = conductor
        ? conductorOverloadSubject(instance.instanceId, conductor, load)
        : reservoir
          ? reservoirOverloadSubject(instance.instanceId, reservoir, load)
          : null;
      if (!baseSubject) {
        continue;
      }
      const declaredCapacity =
        scripted?.capacityOverride === undefined ? baseSubject.capacity : scripted.capacityOverride;
      // El `sectionId` se resuelve ACÁ y no después de evaluar (como hasta
      // 13f), porque el factor térmico necesita la temperatura de la sección
      // antes de decidir.
      const sectionId = this.shipFloorplan
        ? sectionContainingCell(this.shipFloorplan, instance.placement.position)?.id
        : undefined;
      // Fase 13c: una pieza desgastada aguanta menos. Es la forma en que el
      // desgaste "sube la probabilidad de fallo catastrófico" (GDD 6.3) sin
      // meter dados en el tick — la misma carga que la pieza nueva toleraba
      // ahora la revienta. `OverloadRule` sigue siendo determinista.
      const worn = wornCapacity(declaredCapacity, instance.wear);
      const subject = {
        ...baseSubject,
        // Solo a conductores: un reservorio no cambia su capacidad con la
        // temperatura de la sala.
        capacity: worn * (conductor ? this.thermalFactorAt(sectionId, definition?.data.material?.CT) : 1),
      };
      fire(this.rule.evaluate(subject, ctx), instance.instanceId, sectionId);
    }

    for (const edge of blueprint.signalGraph.edges) {
      if (this.firedRefs.has(edge.id)) {
        continue;
      }
      const status = this.edgeStatus(edge);
      if (!status) {
        continue;
      }
      fire(
        this.rule.evaluate(
          { ...conductorOverloadSubject(edge.id, status.conductor, status.load), capacity: status.capacity },
          ctx,
        ),
        edge.id,
        status.sectionId,
      );
    }

    if (changed) {
      this.shipState.set({ ...blueprint, overloadedRefs: Array.from(overloadedRefs) });
    }
  }

  /**
   * Carga y capacidad EFECTIVA de un cable, ahora mismo (Subfase 14a-4).
   *
   * Público a propósito: la UI pinta la arista según lo cerca que esté de su
   * límite, y tiene que preguntárselo **al runtime que decide**, no recalcularlo.
   * Dos evaluaciones paralelas de la misma cadena (catálogo → desgaste →
   * térmico) es exactamente el bug de "la UI dice seguro y el cable revienta"
   * que este proyecto ya pagó varias veces.
   *
   * `null` si el conductor no existe en el registry: no se le inventa capacidad.
   */
  edgeStatus(
    edge: SignalEdge,
  ): { conductor: ConductorProperty; load: number; capacity: number; sectionId?: SectionId } | null {
    const definition = this.componentRegistry.get(edgeConductorId(edge));
    const conductor = electricalConductorProperty(definition);
    if (!conductor) {
      return null;
    }
    const blueprint = this.shipState.get();
    const load = edgeElectricalLoad(blueprint, edge.id, this.componentRegistry);
    const worn = wornCapacity(conductor.maxCapacity, edgeConductorWear(edge));
    const { factor, sectionId } = this.worstThermalFactorAlong(edge, definition?.data.material?.CT);
    return { conductor, load, capacity: worn * factor, sectionId };
  }

  /**
   * Factor térmico sobre la capacidad de un conductor (14a-2). Sin plano, sin
   * lector de atmósfera o sin sección resoluble devuelve 1 — el comportamiento
   * previo a 14a-2, no un castigo silencioso. El guard de "esto es un conductor"
   * queda en el llamador: un reservorio no cambia su capacidad con la
   * temperatura de la sala.
   */
  private thermalFactorAt(
    sectionId: SectionId | undefined,
    thermalConductivity: ThermalConductivityLevel | undefined,
  ): number {
    if (!sectionId || !this.atmosphereOf) {
      return 1;
    }
    const atmosphere = this.atmosphereOf(sectionId);
    if (!atmosphere) {
      return 1;
    }
    return thermalCapacityFactor(atmosphere.temperatureCelsius, thermalConductivity);
  }

  /**
   * Un cable falla por su punto más débil (Subfase 14a-4): de las secciones que
   * toca, manda la que MÁS le baja la capacidad, y el evento se estampa con esa
   * sección — que es donde el jugador lo ve quemarse.
   *
   * Se miran los dos EXTREMOS, no el recorrido completo. El ruteo real de un
   * cable por los conductos `senal` lo calcula `/game`
   * (`render/conduit-path.ts::computeSignalWireRoute`) porque necesita la grilla
   * transitable, y el motor no importa nada de la capa de render. Con los
   * extremos alcanza para el caso que importa —tender un cable hacia una sala
   * fría o en llamas— y mantiene el cálculo puro.
   */
  private worstThermalFactorAlong(
    edge: SignalEdge,
    thermalConductivity: ThermalConductivityLevel | undefined,
  ): { factor: number; sectionId: SectionId | undefined } {
    const blueprint = this.shipState.get();
    let worst: { factor: number; sectionId: SectionId | undefined } = { factor: 1, sectionId: undefined };
    for (const nodeId of [edge.from, edge.to]) {
      const node = blueprint.signalGraph.nodes.find((candidate) => candidate.id === nodeId);
      const sectionId =
        node && this.shipFloorplan
          ? sectionContainingCell(this.shipFloorplan, node.position)?.id
          : undefined;
      if (!sectionId) {
        continue;
      }
      const factor = this.thermalFactorAt(sectionId, thermalConductivity);
      if (worst.sectionId === undefined || factor < worst.factor) {
        worst = { factor, sectionId };
      }
    }
    return worst;
  }
}
