import type { CustomCreation } from "./custom-creation.types.js";

/** Mismo patrón que `blueprint-serializer.ts`/`campaign-save-serializer.ts`: guards a mano. */
export class CustomCreationParseError extends Error {}

export function serializeCustomCreation(creation: CustomCreation): string {
  return JSON.stringify(creation, null, 2);
}

export function deserializeCustomCreation(json: string): CustomCreation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new CustomCreationParseError(`Invalid JSON: ${(error as Error).message}`);
  }

  assertIsCustomCreationShape(parsed);
  return parsed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertIsCustomCreationShape(value: unknown): asserts value is CustomCreation {
  if (!isPlainObject(value)) {
    throw new CustomCreationParseError("CustomCreation must be a JSON object");
  }

  const { metadata, definition } = value;

  if (!isPlainObject(metadata)) {
    throw new CustomCreationParseError("CustomCreation.metadata must be an object");
  }
  if (typeof metadata.schemaVersion !== "number") {
    throw new CustomCreationParseError("CustomCreation.metadata.schemaVersion must be a number");
  }
  for (const field of ["id", "engineVersion", "createdAt", "updatedAt"] as const) {
    if (typeof metadata[field] !== "string") {
      throw new CustomCreationParseError(`CustomCreation.metadata.${field} must be a string`);
    }
  }

  if (!isPlainObject(definition)) {
    throw new CustomCreationParseError("CustomCreation.definition must be an object");
  }
  if (definition.level !== "composite") {
    throw new CustomCreationParseError(
      'CustomCreation.definition.level must be "composite" — atomic catalog pieces are not custom creations',
    );
  }
  if (typeof definition.id !== "string" || typeof definition.name !== "string") {
    throw new CustomCreationParseError("CustomCreation.definition must have string id/name");
  }
  if (!isPlainObject(definition.data)) {
    throw new CustomCreationParseError("CustomCreation.definition.data must be an object");
  }
  const recipe = definition.recipe;
  if (!isPlainObject(recipe) || !Array.isArray(recipe.ingredients)) {
    throw new CustomCreationParseError("CustomCreation.definition.recipe.ingredients must be an array");
  }
  for (const ingredient of recipe.ingredients) {
    if (
      !isPlainObject(ingredient) ||
      typeof ingredient.ref !== "string" ||
      typeof ingredient.quantity !== "number"
    ) {
      throw new CustomCreationParseError("Invalid entry in CustomCreation.definition.recipe.ingredients");
    }
  }

  // Layout de piezas (deuda #8, Fase 12c.5) — opcional y retrocompatible: las
  // creaciones guardadas antes de 12c.5 no lo traen. Si está, se valida su forma.
  const layout = (definition.data as Record<string, unknown>).layout;
  if (layout !== undefined) {
    if (!Array.isArray(layout)) {
      throw new CustomCreationParseError("CustomCreation.definition.data.layout must be an array when present");
    }
    for (const part of layout) {
      if (
        !isPlainObject(part) ||
        typeof part.ref !== "string" ||
        !isPlainObject(part.offset) ||
        typeof part.offset.x !== "number" ||
        typeof part.offset.y !== "number" ||
        !isPlainObject(part.footprint) ||
        typeof part.footprint.width !== "number" ||
        typeof part.footprint.height !== "number" ||
        typeof part.rotation !== "number"
      ) {
        throw new CustomCreationParseError("Invalid entry in CustomCreation.definition.data.layout");
      }
    }
  }
}
