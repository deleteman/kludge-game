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
import type { FailureDomainEvent } from "../failure/failure-events.types.js";
import type { ConductorProperty } from "../properties/functional.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import { conductorElectricalLoad } from "../power/conductor-load.js";
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
 * Cadena de capacidad, en orden y sin que ningún eslabón reemplace al anterior:
 * catálogo → `capacityOverride` de guion → `wornCapacity` (13c, el desgaste
 * hace que la misma carga reviente) → factor térmico (14a-2, frío o calor bajan
 * la capacidad efectiva sin que la carga cambie).
 *
 * Cicatriz sin retorno (principio 5 de CLAUDE.md, "consecuencias
 * permanentes"): una vez que un `ref` dispara, queda en
 * `Blueprint.overloadedRefs` para siempre y no se vuelve a evaluar.
 */
export class MissionOverloadRuntime implements Tickable {
  private readonly rule = new OverloadRule();
  private readonly firedInstanceIds = new Set<PlacedComponentInstanceId>();

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

    for (const instance of blueprint.placedComponents) {
      if (this.firedInstanceIds.has(instance.instanceId)) {
        continue;
      }
      const scripted = this.scriptedSubjects.find(
        (entry) => entry.instanceId === instance.instanceId,
      );
      const definition = this.componentRegistry.get(instance.componentDefinitionId);
      const functional = definition?.data.functional;
      const conductor = functional?.find((property) => property.tag === "COND");
      const reservoir = functional?.find((property) => property.tag === "RES");
      // Carga: la de guion si la hay, si no la real derivada del cableado. Un
      // reservorio sin guion no tiene todavía una fuente de "contenido vivo"
      // equivalente, así que se salta en vez de inventarle una carga.
      const load =
        scripted?.load ??
        (conductor ? conductorElectricalLoad(blueprint, instance.instanceId, this.componentRegistry) : null);
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
      // Fase 13c: una pieza desgastada aguanta menos. Es la forma en que el
      // desgaste "sube la probabilidad de fallo catastrófico" (GDD 6.3) sin
      // meter dados en el tick — la misma carga que la pieza nueva toleraba
      // ahora la revienta. `OverloadRule` sigue siendo determinista.
      //
      // El `sectionId` se resuelve ACÁ y no después de evaluar (como hasta
      // 13f), porque el factor térmico necesita la temperatura de la sección
      // antes de decidir.
      const sectionId = this.shipFloorplan
        ? sectionContainingCell(this.shipFloorplan, instance.placement.position)?.id
        : undefined;
      const worn = wornCapacity(declaredCapacity, instance.wear);
      const subject = {
        ...baseSubject,
        capacity: worn * this.thermalFactorFor(conductor, sectionId, definition),
      };

      // Subfase 13f: la regla se evalúa SIN emisor y el evento se emite acá ya
      // con `sectionId`. `OverloadRule` sigue siendo pura y sin noción de
      // mundo; este runtime es el único que conoce el plano. Mismo reparto de
      // responsabilidades que `MissionReactionRuntime` con `CombustionEvent`.
      const raw = this.rule.evaluate(subject, ctx);
      if (!raw) {
        continue;
      }
      const event = sectionId ? { ...raw, sectionId } : raw;
      this.emitter?.emit(event);
      this.firedInstanceIds.add(instance.instanceId);
      // Chispas persistentes de conductor sobrecargado (Fase 12a, GDD 5.6):
      // solo el modo "cut" (corte/cortocircuito, típico de recurso eléctrico)
      // deja cicatriz visual continua — "fire"/"explosion" ya tienen su
      // propio burst + decal persistente (`overload-effect.ts`), sin chispas
      // en bucle.
      if (event.failureMode === "cut") {
        overloadedRefs.add(instance.instanceId);
        changed = true;
      }
    }

    if (changed) {
      this.shipState.set({ ...blueprint, overloadedRefs: Array.from(overloadedRefs) });
    }
  }

  /**
   * Factor térmico sobre la capacidad (14a-2). Solo aplica a conductores: un
   * reservorio no cambia su capacidad con la temperatura de la sala. Sin plano,
   * sin lector de atmósfera o sin sección resoluble devuelve 1 — el
   * comportamiento previo a 14a-2, no un castigo silencioso.
   */
  private thermalFactorFor(
    conductor: ConductorProperty | undefined,
    sectionId: SectionId | undefined,
    definition: PhysicalComponentDefinition | undefined,
  ): number {
    if (!conductor || !sectionId || !this.atmosphereOf) {
      return 1;
    }
    const atmosphere = this.atmosphereOf(sectionId);
    if (!atmosphere) {
      return 1;
    }
    return thermalCapacityFactor(atmosphere.temperatureCelsius, definition?.data.material?.CT);
  }
}
