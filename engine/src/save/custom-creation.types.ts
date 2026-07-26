import type { Brand } from "../shared/brand.types.js";
import type { PhysicalComponentDefinition } from "../components/physical-component.types.js";

/**
 * Tercer formato de guardado (junto a `CampaignSaveState` y `Blueprint`
 * suelto): una creación nombrada de la mesa (`workbench/creation-naming.ts`)
 * persistida a disco para poder reabrirla entre sesiones — hoy
 * `nameAndRegisterCreation` solo la registra en un `MapEntityRegistry` en
 * memoria. Decisión confirmada con el operador (Fase 9.5, punto 8): el
 * explorador de blueprints del modo creativo necesita contenido real que
 * listar, no solo blueprints de nave completos.
 */
export type CustomCreationId = Brand<string, "CustomCreationId">;

export interface CustomCreationMetadata {
  readonly schemaVersion: number;
  readonly id: CustomCreationId;
  readonly engineVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CustomCreation {
  readonly metadata: CustomCreationMetadata;
  /** Resultado de `nameAndRegisterCreation` — siempre nivel "composite" (nunca una pieza atómica de catálogo). */
  readonly definition: PhysicalComponentDefinition;
}
