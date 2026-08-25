import { afterEach, describe, expect, it } from "vitest";
import type { CampaignSaveState } from "engine";
import {
  captureLiveMissionSave,
  clearLiveMissionSave,
  registerLiveMissionSave,
} from "./live-mission-save.js";

const base = { metadata: { id: "campaign-1", updatedAt: "2026-01-01T00:00:00.000Z" } } as unknown as CampaignSaveState;

afterEach(() => clearLiveMissionSave());

/**
 * Cobertura del puente misión→save (ronda 1 de playtest de 13f). El bug que
 * motiva estos tests es de WIRING, no de lógica: "Guardar y salir" nunca
 * llamaba a `toUpdatedSave`, así que ninguna prueba de la construcción del save
 * lo habría atrapado — hacía falta cubrir que el camino existe.
 */
describe("live-mission-save (13f, ronda 1)", () => {
  it("sin misión montada devuelve el save tal cual (guardar desde fuera de misión sigue siendo válido)", () => {
    expect(captureLiveMissionSave(base)).toBe(base);
  });

  it("con misión montada, el save que se persiste pasa por el builder de la misión", () => {
    const built = { ...base, metadata: { ...base.metadata, id: "vivo" } } as CampaignSaveState;
    registerLiveMissionSave(() => built);
    expect(captureLiveMissionSave(base)).toBe(built);
  });

  it("el builder recibe el save base sobre el que volcar el estado vivo", () => {
    let seen: CampaignSaveState | undefined;
    registerLiveMissionSave((received) => {
      seen = received;
      return received;
    });
    captureLiveMissionSave(base);
    expect(seen).toBe(base);
  });

  it("al desmontar la escena de misión deja de aplicarse", () => {
    registerLiveMissionSave(() => ({ ...base, metadata: { ...base.metadata, id: "vivo" } }) as CampaignSaveState);
    clearLiveMissionSave();
    expect(captureLiveMissionSave(base)).toBe(base);
  });
});
