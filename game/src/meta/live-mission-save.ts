import type { CampaignSaveState } from "engine";

/**
 * Puente entre la misión en curso y el meta-juego, para que "Guardar y salir"
 * guarde de verdad lo que está pasando en la nave.
 *
 * Encontrado en la ronda 1 de playtest de 13f, y **preexistente**: el botón
 * persistía `campaignSession.touch()`, que solo reescribe `updatedAt`. El único
 * punto del juego que volcaba el estado vivo al save era `goToCrisisResult`,
 * o sea que hasta ahora TODO lo que ocurriera en una misión sin resolverla
 * —atmósfera, desgaste, `condition`, stock, química, HP de la tripulación— se
 * perdía al guardar. La cicatriz de 13f solo lo hizo visible.
 *
 * Es un registro de una función y no una referencia a `MissionRuntime` a
 * propósito: la escena de pausa no tiene por qué conocer el runtime de misión
 * ni sus dependencias, solo necesita poder pedir "dame el save actualizado".
 * Mismo criterio de interfaz angosta que `PowerSupplySource` en `/engine`.
 */
export type LiveMissionSaveBuilder = (base: CampaignSaveState) => CampaignSaveState;

let builder: LiveMissionSaveBuilder | undefined;

/** La llama `FloorplanScene` al montar la misión; se libera en su SHUTDOWN. */
export function registerLiveMissionSave(build: LiveMissionSaveBuilder): void {
  builder = build;
}

export function clearLiveMissionSave(): void {
  builder = undefined;
}

/**
 * Vuelca el estado vivo de la misión sobre `base`. Sin misión montada devuelve
 * `base` tal cual — guardar desde un menú fuera de misión sigue siendo válido.
 */
export function captureLiveMissionSave(base: CampaignSaveState): CampaignSaveState {
  return builder ? builder(base) : base;
}
