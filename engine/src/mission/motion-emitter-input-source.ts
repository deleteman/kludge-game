import { ATOMIC_COMPONENT_CATALOG } from "../components/catalog/atomic-component-catalog.js";
import type { ComponentId } from "../components/physical-component.types.js";
import { hasLineOfSight, type CellBlockedQuery } from "../geometry/line-of-sight.js";
import { manhattanDistance } from "../geometry/grid-distance.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { EmitterInputSource } from "./mission-signal-runtime.js";
import type { MutableShipState } from "./mutable-ship-state.js";

/** `EmitterProperty.triggerType` que identifica un sensor óptico/de presencia (catálogo: `fotorreceptor`). */
const MOTION_TRIGGER_TYPE = "optical";

function motionSensorRange(componentDefinitionId: ComponentId): number | undefined {
  const spec = ATOMIC_COMPONENT_CATALOG.find((entry) => entry.id === componentDefinitionId);
  const property = spec?.data.functional?.find(
    (candidate) => candidate.tag === "EM" && candidate.triggerType === MOTION_TRIGGER_TYPE,
  );
  return property?.tag === "EM" ? property.range : undefined;
}

/**
 * `EmitterInputSource` que resuelve `triggerType: "optical"` contra la
 * posición real de tripulación/enemigos (Fase 13a, deuda #3), en vez de
 * darlo siempre por activo como `allEmittersActive` — mismo criterio de
 * envoltorio parcial que `pressureAwareEmitterInputs`: solo reemplaza los
 * nodos que son sensores ópticos, el resto de `base()` queda intacto.
 *
 * Un sensor se dispara si ALGÚN actor (tripulación viva o enemigo) está a
 * `range` celdas o menos (Manhattan) Y tiene línea de visión real contra el
 * sensor (`blocked`, inyectado por `/game` desde el `WalkableGrid` del
 * tilemap — `/engine` no conoce paredes, ver `line-of-sight.ts`).
 */
export function motionAwareEmitterInputs(
  shipState: MutableShipState,
  actorPositions: () => ReadonlyArray<GridPosition>,
  blocked: CellBlockedQuery,
  base: EmitterInputSource,
): EmitterInputSource {
  return () => {
    const inputs = new Map<SignalNodeId, boolean>(base());
    const blueprint = shipState.get();
    const instanceById = new Map(
      blueprint.placedComponents.map((instance) => [instance.instanceId, instance]),
    );
    const positions = actorPositions();
    for (const node of blueprint.signalGraph.nodes) {
      if (node.role !== "emitter") {
        continue;
      }
      const instance = instanceById.get(node.ownerRef as PlacedComponentInstanceId);
      const range = instance && motionSensorRange(instance.componentDefinitionId);
      if (range === undefined) {
        continue;
      }
      const triggered = positions.some(
        (actor) => manhattanDistance(node.position, actor) <= range && hasLineOfSight(node.position, actor, blocked),
      );
      inputs.set(node.id, triggered);
    }
    return inputs;
  };
}
