import type { Brand } from "../shared/brand.types.js";
import type { PlacedFootprint } from "../geometry/grid-position.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SignalGraph } from "../signals/signal-graph.types.js";

/**
 * Blueprint schema — PRIMER INTENTO, PROVISIONAL (GDD sección 17: "formato
 * exacto del archivo de blueprint (schema JSON)... pendiente"). Diseñado
 * ahora por decisión explícita del operador (Fase 1), pero debe revisarse y
 * validarse contra:
 *  - Fase 5 (plano físico real / adyacencia de secciones exportada de Tiled),
 *  - Fase 7 (footprint real de compuestos/ensamblajes calculado en mesa de
 *    creación, confirmación de semántica de rotación).
 * No asumir compatibilidad binaria entre valores distintos de schemaVersion.
 *
 * Fase 6: el placeholder `crewTaskDependencies` se eliminó de este schema. Las
 * colas de tareas y sus dependencias son ESTADO DE SESIÓN RUNTIME (dominio
 * `tasks/`, autorado por el jugador durante la crisis), no estado estático de
 * la nave — mezclarlos era el error que el placeholder marcaba PROVISIONAL.
 * Serializar una partida en curso (con colas a medias) es un tema de save-system
 * para Fase 11, con su propio formato, no parte del blueprint de la nave.
 */
export interface BlueprintMetadata {
  readonly schemaVersion: number;
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /** ENGINE_VERSION al momento de autoría, para diagnosticar incompatibilidades futuras. */
  readonly engineVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type PlacedComponentInstanceId = Brand<string, "PlacedComponentInstanceId">;

export interface PlacedComponentInstance {
  readonly instanceId: PlacedComponentInstanceId;
  /** Referencia al catálogo de definiciones (Fase 4) — no se embebe la definición completa. */
  readonly componentDefinitionId: ComponentId;
  readonly placement: PlacedFootprint;
}

export interface ReservoirContent {
  /** Debe apuntar a una instancia cuya definición declare la propiedad funcional RES. */
  readonly componentInstanceId: PlacedComponentInstanceId;
  readonly substanceId: ChemicalSubstanceId;
  readonly amount: number;
}

export interface Blueprint {
  readonly metadata: BlueprintMetadata;
  readonly placedComponents: ReadonlyArray<PlacedComponentInstance>;
  readonly reservoirContents: ReadonlyArray<ReservoirContent>;
  readonly signalGraph: SignalGraph<PlacedComponentInstanceId>;
}
