import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { CellBlockedQuery } from "../geometry/line-of-sight.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import { emitterRangeOf, emitterReaches, PRESENCE_TRIGGER_TYPES } from "./emitter-sensing.js";
import type { EmitterInputSource } from "./mission-signal-runtime.js";
import type { MutableShipState } from "./mutable-ship-state.js";

/**
 * `EmitterInputSource` que resuelve los sensores de PRESENCIA (`triggerType`
 * `"optical"` o `"motion"`, ver `PRESENCE_TRIGGER_TYPES`) contra la posición
 * real de tripulación/enemigos (Fase 13a, deuda #3), en vez de darlos siempre
 * por activos como `allEmittersActive` — mismo criterio de envoltorio parcial
 * que `pressureAwareEmitterInputs`: solo reemplaza los nodos que sabe resolver,
 * el resto de `base()` queda intacto.
 *
 * Un sensor se dispara si ALGÚN actor (tripulación viva o enemigo) está a
 * `range` celdas o menos (Manhattan) Y tiene línea de visión real contra el
 * sensor (`blocked`, inyectado por `/game` desde el `WalkableGrid` del tilemap
 * más el estado de las puertas — `/engine` no conoce paredes, ver
 * `line-of-sight.ts`). El predicado vive en `emitter-sensing.ts` porque lo
 * comparte con la capa que dibuja el área de alcance en el plano.
 *
 * LÍMITE CONOCIDO, deliberado (ronda 1 de playtest de 13g): el `continue` de
 * abajo es fail-OPEN. Un emisor cuyo `triggerType` el motor no sabe simular
 * —térmico, radar, radio, biométrico, espectral y los demás; 15 de los 17 tipos
 * autorados— conserva el `true` de `allEmittersActive`, o sea que se comporta
 * como un sensor permanentemente disparado. Es una decisión del operador (un
 * sensor apagado para siempre tampoco sería más honesto mientras su dominio no
 * exista) y está registrado como deuda en `PENDIENTES_OBSERVACIONES.md`; el
 * térmico lo desbloquea la Subfase 14a. Lo que sí se arregló en esa ronda es la
 * COBERTURA: hasta entonces la búsqueda iba contra `ATOMIC_COMPONENT_CATALOG`,
 * así que ni siquiera los sensores compuestos del tipo correcto se resolvían.
 */
export function motionAwareEmitterInputs(
  shipState: MutableShipState,
  actorPositions: () => ReadonlyArray<GridPosition>,
  blocked: CellBlockedQuery,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
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
      const range =
        instance &&
        emitterRangeOf(instance.componentDefinitionId, componentRegistry, PRESENCE_TRIGGER_TYPES);
      if (range === undefined) {
        continue;
      }
      const triggered = positions.some((actor) =>
        emitterReaches(node.position, actor, range, blocked),
      );
      inputs.set(node.id, triggered);
    }
    return inputs;
  };
}
