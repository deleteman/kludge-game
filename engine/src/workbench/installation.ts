import type { Footprint, GridPosition, Rotation } from "../geometry/grid-position.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { FloorplanSection } from "../floorplan/floorplan.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import { rotateExteriorFootprint } from "./installation-placement.js";
import { validateInstallation, type InstallationIssue } from "./installation-validation.js";

export type InstallationResult =
  | { readonly outcome: "installed"; readonly blueprint: Blueprint; readonly instanceId: PlacedComponentInstanceId }
  | { readonly outcome: "rejected"; readonly issues: ReadonlyArray<InstallationIssue> };

/**
 * "Instalar en el plano" (GDD 10.1 párrafo 5): coloca la creación terminada
 * de la mesa en una sección, validando que quepa sin solaparse — si no cabe,
 * se rechaza (la UI de Fase 8 traduce esto a la silueta en rojo). NO cablea
 * puertos externos (GDD 10.1 párrafo 7, ver `port-wiring.ts`): instalar y
 * conectar son pasos deliberadamente separados.
 */
export function installCreationInFloorplan(
  blueprint: Blueprint,
  section: FloorplanSection,
  creationDefinitionId: ComponentId,
  footprint: Footprint,
  proposedPosition: GridPosition,
  rotation: Rotation,
  instanceId: PlacedComponentInstanceId,
): InstallationResult {
  const rotatedFootprint = rotateExteriorFootprint(footprint, rotation);
  const proposedPlacement = { position: proposedPosition, footprint: rotatedFootprint, rotation };

  const issues = validateInstallation(section, blueprint.placedComponents, proposedPlacement);
  if (issues.length > 0) {
    return { outcome: "rejected", issues };
  }

  const nextBlueprint: Blueprint = {
    ...blueprint,
    placedComponents: [
      ...blueprint.placedComponents,
      {
        instanceId,
        componentDefinitionId: creationDefinitionId,
        placement: proposedPlacement,
        condition: "ok",
      },
    ],
  };

  return { outcome: "installed", blueprint: nextBlueprint, instanceId };
}
