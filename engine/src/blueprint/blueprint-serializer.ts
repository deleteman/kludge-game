import { assertBlueprintIntegrity } from "./blueprint-integrity.js";
import { DEFAULT_WEAR, isComponentWear } from "../wear/wear.types.js";
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

export function assertIsBlueprintShape(value: unknown): asserts value is Blueprint {
  if (!isPlainObject(value)) {
    throw new BlueprintParseError("Blueprint must be a JSON object");
  }

  const {
    metadata,
    placedComponents,
    reservoirContents,
    signalGraph,
    sectionAtmospheres,
    unpoweredSectionIds,
    overloadedRefs,
    powerState,
  } = value;

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
    // schemaVersion < 3 no tenía `condition` — todo lo autorado hasta Fase 10a
    // es equipamiento funcional, se asume "ok" en vez de rechazar el save.
    if (entry.condition === undefined) {
      (entry as { condition: unknown }).condition = "ok";
    } else if (!["ok", "jammed", "destroyed"].includes(entry.condition as string)) {
      throw new BlueprintParseError(
        `Blueprint.placedComponents entry has invalid condition: ${String(entry.condition)}`,
      );
    }
    // schemaVersion < 4 no tenía cicatriz de RE (Fase 11b) — ausente = sin
    // degradar. DEPRECADO desde 13c: se sigue validando y conservando para que
    // un save viejo no pierda su cicatriz (`effectiveResistance` toma el peor
    // de los dos ejes), pero ningún runtime lo escribe ya.
    if (
      entry.structuralResistanceOverride !== undefined &&
      !["A", "M", "B"].includes(entry.structuralResistanceOverride as string)
    ) {
      throw new BlueprintParseError(
        `Blueprint.placedComponents entry has invalid structuralResistanceOverride: ${String(entry.structuralResistanceOverride)}`,
      );
    }
    // schemaVersion < 7 no tenía desgaste (Fase 13c) — todo lo autorado hasta
    // ahora entra como pieza sin historia, mismo criterio que `condition`.
    if (entry.wear === undefined) {
      (entry as { wear: unknown }).wear = DEFAULT_WEAR;
    } else if (!isComponentWear(entry.wear)) {
      throw new BlueprintParseError(
        `Blueprint.placedComponents entry has invalid wear: ${String(entry.wear)}`,
      );
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

  // schemaVersion < 4 no tenía atmósfera/cicatriz de energía por sección (Fase
  // 11b) — ausente = sin snapshot todavía / ninguna sección sin energía.
  if (sectionAtmospheres === undefined) {
    (value as { sectionAtmospheres: unknown }).sectionAtmospheres = [];
  } else if (!Array.isArray(sectionAtmospheres)) {
    throw new BlueprintParseError("Blueprint.sectionAtmospheres must be an array");
  } else {
    for (const entry of sectionAtmospheres) {
      if (
        !isPlainObject(entry) ||
        typeof entry.sectionId !== "string" ||
        !Array.isArray(entry.gases) ||
        typeof entry.temperatureCelsius !== "number" ||
        typeof entry.pressureKpa !== "number"
      ) {
        throw new BlueprintParseError("Invalid entry in Blueprint.sectionAtmospheres");
      }
    }
  }

  if (unpoweredSectionIds === undefined) {
    (value as { unpoweredSectionIds: unknown }).unpoweredSectionIds = [];
  } else if (
    !Array.isArray(unpoweredSectionIds) ||
    unpoweredSectionIds.some((entry) => typeof entry !== "string")
  ) {
    throw new BlueprintParseError("Blueprint.unpoweredSectionIds must be an array of strings");
  }

  // schemaVersion < 5 no tenía cicatriz de sobrecarga (Fase 12a) — ausente =
  // ningún conducto/reservorio en cortocircuito todavía.
  if (overloadedRefs === undefined) {
    (value as { overloadedRefs: unknown }).overloadedRefs = [];
  } else if (!Array.isArray(overloadedRefs) || overloadedRefs.some((entry) => typeof entry !== "string")) {
    throw new BlueprintParseError("Blueprint.overloadedRefs must be an array of strings");
  }

  // schemaVersion < 6 no tenía presupuesto de energía (Fase 13b) — ausente =
  // sin asignación/prioridad/cicatriz permanente todavía.
  if (powerState === undefined) {
    (value as { powerState: unknown }).powerState = {
      sectionAllocations: [],
      instancePriorities: [],
      permanentlyDisconnectedSectionIds: [],
      dischargedSourceIds: [],
    };
  } else {
    if (!isPlainObject(powerState)) {
      throw new BlueprintParseError("Blueprint.powerState must be an object");
    }
    const { sectionAllocations, instancePriorities, permanentlyDisconnectedSectionIds, dischargedSourceIds } =
      powerState;
    if (
      !Array.isArray(sectionAllocations) ||
      sectionAllocations.some(
        (entry) => !isPlainObject(entry) || typeof entry.sectionId !== "string" || typeof entry.units !== "number",
      )
    ) {
      throw new BlueprintParseError("Blueprint.powerState.sectionAllocations must be an array of {sectionId, units}");
    }
    if (
      !Array.isArray(instancePriorities) ||
      instancePriorities.some(
        (entry) => !isPlainObject(entry) || typeof entry.instanceId !== "string" || typeof entry.priority !== "number",
      )
    ) {
      throw new BlueprintParseError(
        "Blueprint.powerState.instancePriorities must be an array of {instanceId, priority}",
      );
    }
    if (
      !Array.isArray(permanentlyDisconnectedSectionIds) ||
      permanentlyDisconnectedSectionIds.some((entry) => typeof entry !== "string")
    ) {
      throw new BlueprintParseError("Blueprint.powerState.permanentlyDisconnectedSectionIds must be an array of strings");
    }
    // schemaVersion < 8 no tenía fuentes descargadas (Subfase 13d) — ausente =
    // ninguna descargada todavía, mismo criterio tolerante que el resto.
    if (dischargedSourceIds === undefined) {
      (powerState as { dischargedSourceIds: unknown }).dischargedSourceIds = [];
    } else if (
      !Array.isArray(dischargedSourceIds) ||
      dischargedSourceIds.some((entry) => typeof entry !== "string")
    ) {
      throw new BlueprintParseError("Blueprint.powerState.dischargedSourceIds must be an array of strings");
    }
  }
}
