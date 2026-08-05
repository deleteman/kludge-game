import type { PhysicalComponentDefinition } from "../components/physical-component.types.js";

/**
 * "¿Esta pieza está VIVA?" para el riesgo de canibalización (Subfase 13d, fix
 * de playtest ronda 1).
 *
 * Por qué existe, en vez de reusar `MissionPowerRuntime.isInstancePowered`
 * (que es lo que 13d hacía y era el bug): ese predicado significa "su demanda
 * eléctrica está satisfecha", no "está energizada". `allocateComponentPower`
 * marca como alimentada a toda instancia con `powerDraw` 0 o ausente **sin
 * mirar las unidades de la sección** — retrocompat deliberada de 13b, correcta
 * para decidir si un actuador arranca. Como ninguna pieza del catálogo declara
 * `powerDraw` todavía (extensión diferida en `nuevo-orden.md`), TODO se leía
 * como vivo para siempre: cortar la energía no evitaba el chispazo y el badge
 * de riesgo no se apagaba nunca. `isInstancePowered` se deja intacto porque
 * `MissionSignalRuntime` y el inspector de prioridad dependen de su semántica.
 *
 * Regla decidida con el operador (2026-08-05): sección con energía otorgada Y
 * pieza eléctricamente relevante — con la excepción de las fuentes, que llevan
 * su propia carga y no dependen de la red.
 */

/**
 * ¿La pieza participa del sistema eléctrico? Se resuelve por PROPIEDADES, no
 * por identidad de componente (principio 1 de CLAUDE.md): cualquier pieza
 * futura que declare estas propiedades queda cubierta sin tocar esta lista.
 *
 * Con el catálogo real: sí para cable/bobina/resistencia (COND-E), válvula
 * (ACT), chip (REC), batería y célula fotovoltaica (RES-E); no para junta
 * hermética (`CE: "N"`, sin funcional), tubos de líquido/gas (COND de L/G) ni
 * placas disipadora/aislante.
 */
export function isElectricallyLive(definition: PhysicalComponentDefinition | undefined): boolean {
  if (!definition) {
    return false;
  }
  const conductivity = definition.data.material?.CE;
  if (conductivity && conductivity !== "N") {
    return true;
  }
  return (definition.data.functional ?? []).some((property) => {
    switch (property.tag) {
      case "COND":
      case "RES":
        return property.resourceType === "E";
      case "ACT":
      case "EM":
      case "REC":
        return true;
      default:
        return false;
    }
  });
}

/**
 * ¿La pieza es una FUENTE de energía con carga propia (batería, panel solar)?
 * `RES(E)` con `powerUnits` — el mismo criterio con el que `totalPowerBudget`
 * cuenta lo que aporta al presupuesto de 13b, para que "es fuente" signifique
 * exactamente lo mismo en los dos lugares.
 */
export function isElectricSource(definition: PhysicalComponentDefinition | undefined): boolean {
  return (definition?.data.functional ?? []).some(
    (property) => property.tag === "RES" && property.resourceType === "E" && (property.powerUnits ?? 0) > 0,
  );
}

export interface InstanceEnergizedInput {
  readonly definition: PhysicalComponentDefinition | undefined;
  /** La sección que contiene a la pieza tiene ≥1 unidad OTORGADA en este tick. */
  readonly sectionHasGrantedPower: boolean;
  /** La fuente ya fue descargada por una tarea `discharge-source` (`PowerState.dischargedSourceIds`). */
  readonly sourceDischarged: boolean;
}

/**
 * Una fuente NO descargada está viva siempre: su carga es propia, cortar la
 * sección no la vacía (decisión del operador — por eso existe la tarea de
 * descarga, para que el jugador igual tenga una salida). Cualquier otra pieza
 * está viva solo si es eléctricamente relevante Y su sección recibe energía.
 */
export function isInstanceEnergized(input: InstanceEnergizedInput): boolean {
  if (isElectricSource(input.definition)) {
    return !input.sourceDischarged;
  }
  return input.sectionHasGrantedPower && isElectricallyLive(input.definition);
}
