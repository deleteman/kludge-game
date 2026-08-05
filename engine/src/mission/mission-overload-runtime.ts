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
import type { FailureDomainEvent } from "../failure/failure-events.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ScriptedOverloadSubject } from "../crisis/crisis-definition.types.js";
import { wornCapacity } from "../wear/overload-capacity.js";
import type { MutableShipState } from "./mutable-ship-state.js";

/**
 * Sobrecarga scripteada por contenido (Fase 12a) — primer llamador de
 * producción de `OverloadRule` (`failure/overload-rule.ts`), que hasta esta
 * fase solo se ejercitaba a mano en tests (caso de validación 2). A
 * diferencia de `MissionStructuralRuntime` (alimentado por corrosión real de
 * la atmósfera), no existe ninguna simulación de carga eléctrica en el motor:
 * el `load`/`capacityOverride` de cada `ScriptedOverloadSubject` es dato de
 * guion (`CrisisDefinition.scriptedOverloads`), mismo criterio narrativo que
 * `condition: "jammed"` sembrado en el capítulo 1 — `OverloadRule` sigue
 * siendo quien decide si dispara.
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
  ) {}

  tick(ctx: TickContext): void {
    if (this.scriptedSubjects.length === 0) {
      return;
    }
    const blueprint = this.shipState.get();
    const overloadedRefs = new Set(blueprint.overloadedRefs);
    let changed = false;

    for (const scripted of this.scriptedSubjects) {
      if (this.firedInstanceIds.has(scripted.instanceId)) {
        continue;
      }
      const instance = blueprint.placedComponents.find((entry) => entry.instanceId === scripted.instanceId);
      if (!instance) {
        continue;
      }
      const definition = this.componentRegistry.get(instance.componentDefinitionId);
      const functional = definition?.data.functional;
      const conductor = functional?.find((property) => property.tag === "COND");
      const reservoir = functional?.find((property) => property.tag === "RES");
      const baseSubject = conductor
        ? conductorOverloadSubject(scripted.instanceId, conductor, scripted.load)
        : reservoir
          ? reservoirOverloadSubject(scripted.instanceId, reservoir, scripted.load)
          : null;
      if (!baseSubject) {
        continue;
      }
      const declaredCapacity =
        scripted.capacityOverride === undefined ? baseSubject.capacity : scripted.capacityOverride;
      // Fase 13c: una pieza desgastada aguanta menos. Es la forma en que el
      // desgaste "sube la probabilidad de fallo catastrófico" (GDD 6.3) sin
      // meter dados en el tick — la misma carga que la pieza nueva toleraba
      // ahora la revienta. `OverloadRule` sigue siendo determinista.
      const subject = { ...baseSubject, capacity: wornCapacity(declaredCapacity, instance.wear) };

      const event = this.rule.evaluate(subject, ctx, this.emitter);
      if (!event) {
        continue;
      }
      this.firedInstanceIds.add(scripted.instanceId);
      // Chispas persistentes de conductor sobrecargado (Fase 12a, GDD 5.6):
      // solo el modo "cut" (corte/cortocircuito, típico de recurso eléctrico)
      // deja cicatriz visual continua — "fire"/"explosion" ya tienen su
      // propio burst + decal persistente (`overload-effect.ts`), sin chispas
      // en bucle.
      if (event.failureMode === "cut") {
        overloadedRefs.add(scripted.instanceId);
        changed = true;
      }
    }

    if (changed) {
      this.shipState.set({ ...blueprint, overloadedRefs: Array.from(overloadedRefs) });
    }
  }
}
