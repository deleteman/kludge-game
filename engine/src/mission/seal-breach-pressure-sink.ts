import type { ComponentId } from "../components/physical-component.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { SectionPressureSinkSource } from "./mission-atmosphere-runtime.js";
import type { MutableShipState } from "./mutable-ship-state.js";

/**
 * Configuración de una fuga por pieza sellada rota (Subfase 11h). A
 * diferencia de `pressureAwareEmitterInputs`/`resolveLcdDisplayValue` (que
 * resuelven por TAG del componente — principio 1 de CLAUDE.md), esto
 * identifica la pieza por POSICIÓN + lista cerrada de `componentDefinitionId`
 * aceptables — mismo criterio que la resolución de crisis
 * `replacement-installed-connected` (`engine/src/crisis/rules/replacement-installed-connected.ts`),
 * no por `instanceId`: el jugador repara desmontando la junta rota e
 * instalando una nueva (otro `instanceId`), así que identificar por posición
 * es lo único que sigue funcionando después de ese reemplazo. No existe
 * ninguna propiedad de catálogo que signifique "esto sella la atmósfera"
 * (`ES` en `material.types.ts` es *estado de la materia*, sólido/líquido/gas,
 * no hermeticidad), así que no hay tag genérico que matchear — es contenido
 * de capítulo sembrado, igual que la válvula atascada del Capítulo 1.
 */
export interface SealBreachConfig {
  readonly position: GridPosition;
  readonly acceptableComponentDefinitionIds: ReadonlyArray<ComponentId>;
  readonly sectionId: SectionId;
  readonly drainRateKpaPerSecond: number;
  readonly recoveryRateKpaPerSecond: number;
}

/**
 * `SectionPressureSinkSource` que drena la sección de una fuga mientras no
 * haya, en `config.position`, una instancia `condition === "ok"` cuyo
 * `componentDefinitionId` esté entre los aceptables — y la RECUPERA (tasa
 * negativa) en cuanto la hay. Cubre tanto "reparar" (misma instancia, cambia
 * `condition`) como "sustituir" (desmontar + instalar una nueva) con la misma
 * regla, igual que `ReplacementInstalledConnectedRule`.
 */
export function sealBreachPressureSink(
  shipState: MutableShipState,
  config: SealBreachConfig,
): SectionPressureSinkSource {
  return () => {
    const sealed = shipState.get().placedComponents.some(
      (entry) =>
        entry.condition === "ok" &&
        entry.placement.position.x === config.position.x &&
        entry.placement.position.y === config.position.y &&
        config.acceptableComponentDefinitionIds.includes(entry.componentDefinitionId),
    );
    const rateKpaPerSecond = sealed ? -config.recoveryRateKpaPerSecond : config.drainRateKpaPerSecond;
    return new Map([[config.sectionId, rateKpaPerSecond]]);
  };
}
