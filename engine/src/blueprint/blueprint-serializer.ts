import { assertBlueprintIntegrity } from "./blueprint-integrity.js";
import type { Blueprint } from "./blueprint.types.js";

/**
 * Sin librería de validación runtime (zod/ajv): `/engine` no tiene
 * dependencias runtime hoy y CLAUDE.md pide no asumir una librería nueva sin
 * confirmar disponibilidad primero. Guards escritos a mano; si crecen
 * demasiado, separar en `blueprint-guards.ts` es la vía de escape ya prevista
 * (ver plan de Fase 1).
 */
export class BlueprintParseError extends Error {}

export function serializeBlueprint(blueprint: Blueprint): string {
  return JSON.stringify(blueprint, null, 2);
}

export function deserializeBlueprint(json: string): Blueprint {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new BlueprintParseError(`Invalid JSON: ${(error as Error).message}`);
  }

  assertIsBlueprintShape(parsed);

  try {
    assertBlueprintIntegrity(parsed);
  } catch (error) {
    throw new BlueprintParseError((error as Error).message);
  }

  return parsed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertIsBlueprintShape(value: unknown): asserts value is Blueprint {
  if (!isPlainObject(value)) {
    throw new BlueprintParseError("Blueprint must be a JSON object");
  }

  const { metadata, placedComponents, reservoirContents, signalGraph } = value;

  if (!isPlainObject(metadata)) {
    throw new BlueprintParseError("Blueprint.metadata must be an object");
  }
  if (typeof metadata.schemaVersion !== "number") {
    throw new BlueprintParseError("Blueprint.metadata.schemaVersion must be a number");
  }
  for (const field of ["id", "name", "engineVersion", "createdAt", "updatedAt"] as const) {
    if (typeof metadata[field] !== "string") {
      throw new BlueprintParseError(`Blueprint.metadata.${field} must be a string`);
    }
  }

  if (!Array.isArray(placedComponents)) {
    throw new BlueprintParseError("Blueprint.placedComponents must be an array");
  }
  for (const entry of placedComponents) {
    if (
      !isPlainObject(entry) ||
      typeof entry.instanceId !== "string" ||
      typeof entry.componentDefinitionId !== "string" ||
      !isPlainObject(entry.placement)
    ) {
      throw new BlueprintParseError("Invalid entry in Blueprint.placedComponents");
    }
  }

  if (!Array.isArray(reservoirContents)) {
    throw new BlueprintParseError("Blueprint.reservoirContents must be an array");
  }
  for (const entry of reservoirContents) {
    if (
      !isPlainObject(entry) ||
      typeof entry.componentInstanceId !== "string" ||
      typeof entry.substanceId !== "string" ||
      typeof entry.amount !== "number"
    ) {
      throw new BlueprintParseError("Invalid entry in Blueprint.reservoirContents");
    }
  }

  if (
    !isPlainObject(signalGraph) ||
    !Array.isArray(signalGraph.nodes) ||
    !Array.isArray(signalGraph.edges)
  ) {
    throw new BlueprintParseError("Blueprint.signalGraph must have 'nodes' and 'edges' arrays");
  }
}
