import { createNewCampaignSave, ENGINE_VERSION } from "engine";
import type { CampaignSaveState, CrewRoster, ShipArchetype } from "engine";
import type { CrewActor } from "engine";

/**
 * Estado en memoria de la partida activa durante la sesión de juego. Toda
 * mutación de dominio (crear partida, validar tripulación elegida) delega en
 * `/engine` — este módulo solo retiene la referencia actual y actualiza
 * `updatedAt`, que no es una regla de dominio sino plomería de sesión.
 */
export class CampaignSession {
  private active: CampaignSaveState | undefined;

  get current(): CampaignSaveState | undefined {
    return this.active;
  }

  startNew(params: {
    id: string;
    name: string;
    archetype: ShipArchetype;
    roster: CrewRoster;
    chosenCrewIds: ReadonlyArray<CrewActor["id"]>;
  }): CampaignSaveState {
    this.active = createNewCampaignSave({
      id: params.id as CampaignSaveState["metadata"]["id"],
      name: params.name,
      archetype: params.archetype,
      roster: params.roster,
      chosenCrewIds: params.chosenCrewIds,
      engineVersion: ENGINE_VERSION,
    });
    return this.active;
  }

  load(state: CampaignSaveState): void {
    this.active = state;
  }

  requireActive(): CampaignSaveState {
    if (!this.active) {
      throw new Error("CampaignSession: no hay ninguna partida activa");
    }
    return this.active;
  }

  /** Marca la partida activa como actualizada ahora — usar antes de guardar. */
  touch(): CampaignSaveState {
    const current = this.requireActive();
    this.active = {
      ...current,
      metadata: { ...current.metadata, updatedAt: new Date().toISOString() },
    };
    return this.active;
  }

  clear(): void {
    this.active = undefined;
  }
}

export const campaignSession = new CampaignSession();
