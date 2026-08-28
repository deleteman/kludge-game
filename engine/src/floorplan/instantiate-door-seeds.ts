import { DEFAULT_WEAR } from "../wear/wear.types.js";
import { deriveSignalNodes } from "../workbench/derive-signal-nodes.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SignalNode } from "../signals/signal-node.types.js";
import type { DoorSeedPoint } from "./floorplan.types.js";

export class DoorSeedError extends Error {}

/** Pieza de catálogo con la que se materializa una puerta del casco. */
export const AUTHORED_DOOR_COMPONENT_ID = "compuerta-blindada" as ComponentId;

/**
 * Materializa las puertas autoradas en la capa Tiled `puertas` como INSTANCIAS
 * reales de `compuerta-blindada` (ronda 1 de playtest de 13h).
 *
 * En la ronda A las puertas autoradas eran una entidad de segunda: casco sin
 * instancia, con su propio estado dentro de `MissionDoorRuntime`. El playtest
 * destapó los dos agujeros de esa decisión de una sola vez — no se les dibujaba
 * el sprite (solo las instancias reciben uno) y no aparecían en modo cableado
 * (solo las instancias derivan nodos de señal). Ninguno de los dos era un bug
 * suelto: los dos eran la misma dualidad.
 *
 * Ahora una puerta es una puerta por la misma razón en los dos casos —un
 * `ACT`+`EST` sobre un umbral (`door-identity.ts`)— y todo lo demás (sprite,
 * nodo receptor, `powerDraw` en el reparto de 13b, desgaste, tinte por
 * condición, desmontaje) cae gratis de los sistemas que ya existen.
 *
 * Consecuencia asumida (decisión del operador): una puerta del casco se puede
 * desmontar y canibalizar, y esa frontera deja de compartimentar.
 */
export function instantiateDoorSeeds(
  seeds: ReadonlyArray<DoorSeedPoint>,
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): {
  readonly components: PlacedComponentInstance[];
  readonly signalNodes: SignalNode<PlacedComponentInstanceId>[];
} {
  const definition = registry.get(AUTHORED_DOOR_COMPONENT_ID);
  if (!definition) {
    throw new DoorSeedError(
      `Door seeding needs '${AUTHORED_DOOR_COMPONENT_ID}' in the catalog and it is missing`,
    );
  }

  const components: PlacedComponentInstance[] = [];
  const signalNodes: SignalNode<PlacedComponentInstanceId>[] = [];

  for (const seed of seeds) {
    // Un vano de dos celdas es UNA instancia 2×1, no dos piezas: dos puertas
    // aportarían dos aristas de difusión y ese vano intercambiaría aire al
    // doble de velocidad que uno de una celda.
    const placement = {
      position: seed.position,
      footprint: {
        width: seed.axis === "x" ? seed.span : 1,
        height: seed.axis === "y" ? seed.span : 1,
      },
      rotation: 0 as const,
    };
    const instanceId = `puerta-${seed.id}` as PlacedComponentInstanceId;
    components.push({
      instanceId,
      componentDefinitionId: AUTHORED_DOOR_COMPONENT_ID,
      placement,
      condition: "ok",
      wear: DEFAULT_WEAR,
    });
    // El nodo receptor sale del `ACT` de la compuerta, igual que al instalar una
    // (`derive-signal-nodes.ts`). Es lo que hace que la puerta aparezca en modo
    // cableado desde el primer tick — el hueco que el playtest reportó.
    signalNodes.push(...deriveSignalNodes(definition.data.functional, instanceId, placement));
  }

  return { components, signalNodes };
}
