import {
  deserializeCampaignSave,
  deserializeCustomCreation,
  serializeCampaignSave,
  serializeCustomCreation,
} from "engine";
import type { CampaignSaveState, CustomCreation } from "engine";
import { deserializeSettings, serializeSettings, DEFAULT_SETTINGS } from "./game-settings.types.js";
import type { GameSettings } from "./game-settings.types.js";

/**
 * Única responsabilidad: hablar con `window.kludgeSave`/`kludgeSettings`
 * (expuestas por `electron/src/preload.ts`) y traducir a/desde los tipos de
 * `/engine`. Si `window.kludgeSave` no existe (ej. `npm run dev -w game`
 * suelto, sin `electron .`), cae a un adaptador en memoria con aviso en
 * consola — NUNCA `localStorage`/`sessionStorage` (CLAUDE.md).
 */
const inMemoryCampaigns = new Map<string, string>();
const inMemoryCreations = new Map<string, string>();
let inMemorySettings: string | null = null;

function warnMemoryFallback(what: string): void {
  console.warn(
    `[save-adapter] window.kludgeSave no está disponible (¿corriendo fuera de Electron?) — ${what} usa un adaptador en memoria, no persistente.`,
  );
}

export async function listCampaignSaves(): Promise<string[]> {
  if (!window.kludgeSave) {
    warnMemoryFallback("listCampaignSaves");
    return [...inMemoryCampaigns.keys()];
  }
  return window.kludgeSave.list("campaigns");
}

export async function loadCampaignSave(id: string): Promise<CampaignSaveState> {
  let json: string;
  if (!window.kludgeSave) {
    warnMemoryFallback("loadCampaignSave");
    const stored = inMemoryCampaigns.get(id);
    if (!stored) throw new Error(`No hay partida en memoria con id ${id}`);
    json = stored;
  } else {
    json = await window.kludgeSave.load("campaigns", id);
  }
  return deserializeCampaignSave(json);
}

export async function saveCampaignSave(state: CampaignSaveState): Promise<void> {
  const json = serializeCampaignSave(state);
  if (!window.kludgeSave) {
    warnMemoryFallback("saveCampaignSave");
    inMemoryCampaigns.set(state.metadata.id, json);
    return;
  }
  await window.kludgeSave.save("campaigns", state.metadata.id, json);
}

export async function deleteCampaignSave(id: string): Promise<void> {
  if (!window.kludgeSave) {
    warnMemoryFallback("deleteCampaignSave");
    inMemoryCampaigns.delete(id);
    return;
  }
  await window.kludgeSave.delete("campaigns", id);
}

export async function listCustomCreations(): Promise<string[]> {
  if (!window.kludgeSave) {
    warnMemoryFallback("listCustomCreations");
    return [...inMemoryCreations.keys()];
  }
  return window.kludgeSave.list("creations");
}

export async function loadCustomCreation(id: string): Promise<CustomCreation> {
  let json: string;
  if (!window.kludgeSave) {
    warnMemoryFallback("loadCustomCreation");
    const stored = inMemoryCreations.get(id);
    if (!stored) throw new Error(`No hay creación en memoria con id ${id}`);
    json = stored;
  } else {
    json = await window.kludgeSave.load("creations", id);
  }
  return deserializeCustomCreation(json);
}

export async function saveCustomCreation(creation: CustomCreation): Promise<void> {
  const json = serializeCustomCreation(creation);
  if (!window.kludgeSave) {
    warnMemoryFallback("saveCustomCreation");
    inMemoryCreations.set(creation.metadata.id, json);
    return;
  }
  await window.kludgeSave.save("creations", creation.metadata.id, json);
}

/**
 * Exporta una creación del modo creativo a un archivo `.kludge` vía diálogo
 * nativo (hito de demo). Serializa con el motor (`serializeCustomCreation`, que
 * ya valida al deserializar en la punta receptora) y delega el diálogo/escritura
 * en `window.kludgeBlueprint`. Fuera de Electron avisa y devuelve `false` — nunca
 * `localStorage` (CLAUDE.md). Devuelve `true` si el usuario confirmó y se guardó.
 */
export async function exportCreationToFile(creation: CustomCreation): Promise<boolean> {
  const json = serializeCustomCreation(creation);
  if (!window.kludgeBlueprint) {
    warnMemoryFallback("exportCreationToFile");
    return false;
  }
  return window.kludgeBlueprint.export(json);
}

/**
 * Importa una creación desde un archivo `.kludge` vía diálogo nativo. Deserializa
 * con el motor (`deserializeCustomCreation`, que valida versión/estructura y lanza
 * si el archivo no es una creación válida). Devuelve `undefined` si el usuario
 * cancela el diálogo o si se corre fuera de Electron.
 */
export async function importCreationFromFile(): Promise<CustomCreation | undefined> {
  if (!window.kludgeBlueprint) {
    warnMemoryFallback("importCreationFromFile");
    return undefined;
  }
  const json = await window.kludgeBlueprint.import();
  if (json === null) {
    return undefined;
  }
  return deserializeCustomCreation(json);
}

export async function loadSettings(): Promise<GameSettings> {
  let json: string | null;
  if (!window.kludgeSettings) {
    warnMemoryFallback("loadSettings");
    json = inMemorySettings;
  } else {
    json = await window.kludgeSettings.load();
  }
  return json ? deserializeSettings(json) : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: GameSettings): Promise<void> {
  const json = serializeSettings(settings);
  if (!window.kludgeSettings) {
    warnMemoryFallback("saveSettings");
    inMemorySettings = json;
    return;
  }
  await window.kludgeSettings.save(json);
}
