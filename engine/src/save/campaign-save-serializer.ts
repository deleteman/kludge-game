import { assertIsBlueprintShape } from "../blueprint/blueprint-serializer.js";
import { assertBlueprintIntegrity } from "../blueprint/blueprint-integrity.js";
import { assertCampaignSaveIntegrity } from "./campaign-save-integrity.js";
import { DEFAULT_WEAR, isComponentWear } from "../wear/wear.types.js";
import type { CampaignSaveState } from "./campaign-save.types.js";

/**
 * Mismo patrón que `blueprint-serializer.ts`: sin librería de validación
 * runtime, guards a mano; `shipState` delega en los guards ya existentes de
 * blueprint en vez de reimplementarlos.
 */
export class CampaignSaveParseError extends Error {}

export function serializeCampaignSave(state: CampaignSaveState): string {
  return JSON.stringify(state, null, 2);
}

export function deserializeCampaignSave(json: string): CampaignSaveState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new CampaignSaveParseError(`Invalid JSON: ${(error as Error).message}`);
  }

  assertIsCampaignSaveShape(parsed);

  // Save pre-schemaVersion-3: sin `atomicStock` — se completa con stock vacío
  // antes de validar/devolver, así el resto del motor nunca ve el campo ausente.
  const withStock: CampaignSaveState = { ...parsed, atomicStock: parsed.atomicStock ?? {} };

  try {
    assertBlueprintIntegrity(withStock.shipState);
    assertCampaignSaveIntegrity(withStock);
  } catch (error) {
    throw new CampaignSaveParseError((error as Error).message);
  }

  return withStock;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertIsCampaignSaveShape(value: unknown): asserts value is CampaignSaveState {
  if (!isPlainObject(value)) {
    throw new CampaignSaveParseError("CampaignSaveState must be a JSON object");
  }

  const { metadata, shipState, crew, activeCrewIds, chapterProgress, atomicStock } = value;

  if (!isPlainObject(metadata)) {
    throw new CampaignSaveParseError("CampaignSaveState.metadata must be an object");
  }
  if (typeof metadata.schemaVersion !== "number") {
    throw new CampaignSaveParseError("CampaignSaveState.metadata.schemaVersion must be a number");
  }
  for (const field of ["id", "name", "archetype", "engineVersion", "createdAt", "updatedAt"] as const) {
    if (typeof metadata[field] !== "string") {
      throw new CampaignSaveParseError(`CampaignSaveState.metadata.${field} must be a string`);
    }
  }

  try {
    assertIsBlueprintShape(shipState);
  } catch (error) {
    throw new CampaignSaveParseError(
      `CampaignSaveState.shipState is not a valid Blueprint: ${(error as Error).message}`,
    );
  }

  if (!Array.isArray(crew)) {
    throw new CampaignSaveParseError("CampaignSaveState.crew must be an array");
  }
  for (const actor of crew) {
    if (
      !isPlainObject(actor) ||
      typeof actor.id !== "string" ||
      typeof actor.name !== "string" ||
      typeof actor.specialty !== "string" ||
      typeof actor.tier !== "string" ||
      typeof actor.trait !== "string" ||
      typeof actor.hp !== "number" ||
      typeof actor.maxHp !== "number" ||
      typeof actor.status !== "string"
    ) {
      throw new CampaignSaveParseError("Invalid entry in CampaignSaveState.crew");
    }
  }

  if (!Array.isArray(activeCrewIds) || activeCrewIds.some((id) => typeof id !== "string")) {
    throw new CampaignSaveParseError("CampaignSaveState.activeCrewIds must be an array of strings");
  }

  if (
    !isPlainObject(chapterProgress) ||
    typeof chapterProgress.currentChapterId !== "string" ||
    !Array.isArray(chapterProgress.completedChapterIds) ||
    chapterProgress.completedChapterIds.some((id) => typeof id !== "string")
  ) {
    throw new CampaignSaveParseError("CampaignSaveState.chapterProgress is invalid");
  }

  // Ausente = save pre-schemaVersion-3, sin escasez de stock todavía — se
  // trata como stock vacío en vez de romper la carga (mismo criterio que
  // `sectionAtmospheres`/`unpoweredSectionIds` en `blueprint-serializer.ts`).
  if (atomicStock !== undefined) {
    if (!isPlainObject(atomicStock)) {
      throw new CampaignSaveParseError("CampaignSaveState.atomicStock must be an object");
    }
    for (const [id, entry] of Object.entries(atomicStock)) {
      // schemaVersion < 4 guardaba un único número por pieza; desde 13c son
      // buckets por desgaste. Un save viejo se migra al bucket `nuevo`: nada
      // de lo guardado hasta ahora podía estar desgastado, porque el concepto
      // no existía.
      if (typeof entry === "number") {
        assertNonNegativeInteger(entry, `CampaignSaveState.atomicStock.${id}`);
        (atomicStock as Record<string, unknown>)[id] = { [DEFAULT_WEAR]: entry };
        continue;
      }
      if (!isPlainObject(entry)) {
        throw new CampaignSaveParseError(
          `CampaignSaveState.atomicStock.${id} must be an object of wear buckets`,
        );
      }
      for (const [wear, quantity] of Object.entries(entry)) {
        if (!isComponentWear(wear)) {
          throw new CampaignSaveParseError(
            `CampaignSaveState.atomicStock.${id} has invalid wear bucket: ${wear}`,
          );
        }
        assertNonNegativeInteger(quantity, `CampaignSaveState.atomicStock.${id}.${wear}`);
      }
    }
  }
}

function assertNonNegativeInteger(value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new CampaignSaveParseError(`${path} must be a non-negative integer`);
  }
}
