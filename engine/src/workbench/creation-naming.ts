import type { CompositionFactory } from "../composition/composition-factory.js";
import type { MapEntityRegistry } from "../composition/entity-registry.js";
import type {
  AtomicComponentData,
  ComponentId,
  CompositeComponentData,
  PhysicalComponentDefinition,
} from "../components/physical-component.types.js";
import { calculateFootprint } from "./footprint-calculator.js";
import { buildRecipeFromPieces } from "./creation-recipe-builder.js";
import { WorkbenchError, type WorkbenchPiece } from "./workbench-state.types.js";

export interface NameCreationParams {
  /** Id asignado por el llamador (game/save-system) para el nuevo compuesto. */
  readonly id: ComponentId;
  readonly name: string;
}

/**
 * "Nombrar" (GDD 10.1): al terminar de componer en la mesa, el jugador
 * asigna un nombre y la disposición se guarda como compuesto nuevo,
 * reutilizable y exportable en blueprints. Reutiliza la `CompositionFactory`
 * genérica ya usada por el catálogo de Fase 4 (`buildComponentCatalog`) — no
 * duplica su lógica de validación de receta, y sigue el mismo patrón de
 * registrar manualmente en el `EntityRegistry` tras construir.
 */
export function nameAndRegisterCreation(
  factory: CompositionFactory<ComponentId, AtomicComponentData, CompositeComponentData, ComponentId>,
  registry: MapEntityRegistry<ComponentId, PhysicalComponentDefinition>,
  pieces: ReadonlyArray<WorkbenchPiece>,
  params: NameCreationParams,
): PhysicalComponentDefinition {
  if (params.name.trim().length === 0) {
    throw new WorkbenchError("A creation must be named with a non-empty name before saving it");
  }

  const footprint = calculateFootprint(pieces);
  const recipe = buildRecipeFromPieces(pieces);

  // Agrega las propiedades funcionales de las piezas al compuesto (11c.1): sin
  // esto, `data.functional` quedaba vacío y una creación instalada en misión no
  // derivaba ningún `SignalNode` (`deriveSignalNodes`), así que era incableable
  // pese a contener piezas EM/REC/COND. Los puertos externos de la creación
  // emergen de las propiedades de sus partes (principios 1 y 3), no se declaran
  // aparte. Una propiedad por ingrediente distinto (la receta ya deduplica
  // piezas repetidas en `quantity`): un solo puerto por tipo de pieza con rol.
  const aggregatedFunctional = factory
    .resolveIngredients(recipe)
    .flatMap(({ entity }) => entity.data.functional ?? []);

  const composite = factory.buildComposite({
    id: params.id,
    name: params.name,
    data: {
      footprint,
      ...(aggregatedFunctional.length > 0 ? { functional: aggregatedFunctional } : {}),
    },
    recipe,
  });

  registry.register(composite.id, composite);
  return composite;
}
