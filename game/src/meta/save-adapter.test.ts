import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNewCampaignSave } from "engine";
import type { CampaignSaveState, CrewActor, CrewRoster } from "engine";

/**
 * Cobertura del listado de partidas (ronda 1 de playtest de 13f). `/game` no
 * tenía NINGÚN test de `save-adapter`, y ahí vivía el bug preexistente por el
 * que "Continuar" entraba en una campaña de hacía un mes.
 *
 * Se stubea `window.kludgeSave` con un store en memoria en vez de usar el
 * fallback interno del adaptador: así se ejercita el mismo camino que corre en
 * Electron (serializar → escribir → leer → deserializar), y se puede meter un
 * fichero corrupto que el fallback no permitiría inyectar.
 */
const store = new Map<string, string>();
vi.stubGlobal("window", {
  kludgeSave: {
    list: async () => [...store.keys()],
    load: async (_ns: string, id: string) => {
      const found = store.get(id);
      if (found === undefined) throw new Error(`no existe ${id}`);
      return found;
    },
    save: async (_ns: string, id: string, contents: string) => {
      store.set(id, contents);
    },
    delete: async (_ns: string, id: string) => {
      store.delete(id);
    },
  },
});
vi.spyOn(console, "warn").mockImplementation(() => {});

const { mostRecentCampaignSave, saveCampaignSave } = await import("./save-adapter.js");

function actor(id: string): CrewActor {
  return {
    id,
    name: `Tripulante ${id}`,
    specialty: "ingeniero",
    tier: "novato",
    trait: "estoico",
    hp: 100,
    maxHp: 100,
    status: "idle",
  } as unknown as CrewActor;
}

const roster = { available: [actor("crew-1"), actor("crew-2"), actor("crew-3"), actor("crew-4")] } as CrewRoster;

function saveWith(id: string, updatedAt: string): CampaignSaveState {
  const created = createNewCampaignSave({
    id: id as CampaignSaveState["metadata"]["id"],
    name: id,
    archetype: "exploracion",
    roster,
    chosenCrewIds: [actor("crew-1").id, actor("crew-2").id],
    engineVersion: "0.0.0",
    now: "2026-07-01T00:00:00.000Z",
  });
  return { ...created, metadata: { ...created.metadata, updatedAt } };
}

describe("mostRecentCampaignSave (13f, ronda 1: 'Continuar' cargaba la partida equivocada)", () => {
  beforeEach(() => store.clear());

  it("sin partidas guardadas no devuelve ninguna", async () => {
    expect(await mostRecentCampaignSave()).toBeUndefined();
  });

  /**
   * REGRESIÓN: "Continuar" tomaba `saves[0]` de un `readdir` sin ordenar. Con
   * varias campañas en disco entraba en una vieja y el jugador leía "los
   * componentes desaparecieron". El id NO sirve para ordenar: marca cuándo se
   * CREÓ la partida, no cuándo se guardó — por eso acá la partida vieja es la
   * que tiene el id más alto.
   */
  it("devuelve la de `updatedAt` más reciente, no la primera ni la de id más alto", async () => {
    await saveCampaignSave(saveWith("campaign-100", "2026-08-25T10:00:00.000Z"));
    await saveCampaignSave(saveWith("campaign-999", "2026-07-22T10:00:00.000Z"));

    expect((await mostRecentCampaignSave())?.metadata.id).toBe("campaign-100");
  });

  it("una partida ilegible se omite en vez de romper el listado entero", async () => {
    await saveCampaignSave(saveWith("campaign-100", "2026-08-25T10:00:00.000Z"));
    store.set("campaign-rota", "{{{");

    expect((await mostRecentCampaignSave())?.metadata.id).toBe("campaign-100");
  });
});
