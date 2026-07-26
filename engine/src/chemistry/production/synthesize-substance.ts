import type { CompositionFactory } from "../../composition/composition-factory.js";
import type { MapEntityRegistry } from "../../composition/entity-registry.js";
import type {
  ChemicalSubstanceData,
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemical-substance.types.js";
import type { ReactionOutcome, ReactionResolver } from "../reaction/reaction-resolver.js";
import { toReactant } from "../reaction/tag-predicates.js";

export class SynthesisError extends Error {}

/**
 * Punto de entrada de "producción" para la síntesis química elemento→compuesto
 * (GDD 5.4.1/5.4.2, Fase 11c.3): traduce una selección de sustancias (elementos
 * u otras sustancias ya conocidas) elegida por el jugador en la mesa de
 * creación a un `ReactionContext` neutro y delega la resolución de identidad
 * en 3 pasos al `ReactionResolver` ya existente — esta función no reimplementa
 * esa lógica, solo la cablea a un flujo de juego real (antes solo la ejercían
 * tests que armaban el contexto a mano).
 *
 * Si el resultado no está ya en el `registry` (una receta nombrada como "agua"
 * ya lo está; una "Mezcla sin identificar" o el producto genérico de una regla
 * por tags, no), se registra como sustancia atómica para que quede resolvible
 * después por otros sistemas que busquen por id (atmósfera, futuros
 * reservorios) — mismo criterio que `workbench/creation-naming.ts` registra la
 * pieza física nueva tras construirla.
 */
export function synthesizeSubstance(
  resolver: ReactionResolver,
  registry: MapEntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>,
  factory: CompositionFactory<
    ChemicalSubstanceId,
    ChemicalSubstanceData,
    ChemicalSubstanceData,
    ChemicalSubstanceId
  >,
  selectedSubstanceIds: ReadonlyArray<ChemicalSubstanceId>,
): ReactionOutcome {
  if (selectedSubstanceIds.length < 2) {
    throw new SynthesisError("Synthesizing a substance requires at least 2 elements in contact");
  }

  const reactants = selectedSubstanceIds.map((id) => {
    const definition = registry.get(id);
    if (!definition) {
      throw new SynthesisError(`Unknown chemical substance id: ${id}`);
    }
    return toReactant(definition);
  });

  const outcome = resolver.resolve({
    reactants,
    oxygen: "normal",
    ignitionPresent: false,
    thermalRegulatorOverloaded: false,
    elapsedSeconds: 0,
  });

  if (outcome.result && !registry.has(outcome.result.id)) {
    const registered = factory.buildAtomic({
      id: outcome.result.id,
      name: outcome.result.name,
      data: { tags: outcome.result.tags, state: outcome.result.state },
    });
    registry.register(registered.id, registered);
  }

  return outcome;
}
