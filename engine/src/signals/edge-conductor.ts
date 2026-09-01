import type { ComponentId } from "../components/physical-component.types.js";
import type { ConductorProperty, FunctionalProperty } from "../properties/functional.types.js";
import { DEFAULT_WEAR, type ComponentWear } from "../wear/wear.types.js";
import type { SignalEdge } from "./signal-edge.types.js";

/**
 * De qué está hecho un cable (Subfase 14a-4).
 *
 * Punto ÚNICO de dos preguntas que antes no tenían dueño y que ahora se hacen
 * desde el motor y desde la UI a la vez:
 *
 *  1. «¿esta pieza es material de cableado?» — se responde por PROPIEDAD
 *     (`COND` con `resourceType: "E"`), nunca por lista de ids. Es el Principio 1
 *     del proyecto: si mañana entra un conductor nuevo al catálogo, se vuelve
 *     cableable solo, sin tocar este archivo ni el selector.
 *  2. «¿con qué conductor se tendió esta arista?» — con su default de migración
 *     en un solo lugar, para que ningún llamador tenga que acordarse del `??`.
 */

/**
 * Conductor con el que se rellenan las aristas de saves anteriores a la
 * Subfase 14a-4 (`schemaVersion` ≤ 10), donde el cable no costaba nada. Cobre:
 * es el conductor base del catálogo atómico y el único que el capítulo 1 tiene
 * en stock, así que una partida vieja sigue siendo jugable con los mismos
 * márgenes con los que se guardó.
 */
export const DEFAULT_EDGE_CONDUCTOR_ID = "cable-cobre" as ComponentId;

/**
 * `COND(E)` de una definición, o `null` si la pieza no conduce electricidad.
 * Una pieza puede declarar varios `COND` (un tubo declara uno por `L` y otro
 * por `G`): acá solo interesa el eléctrico.
 */
export function electricalConductorProperty(
  /**
   * Tipo estructural y no `PhysicalComponentDefinition` a propósito: lo único
   * que hace falta es la lista de propiedades funcionales, y así sirve igual
   * para un `AtomicComponentSpec` del catálogo (que no es una definición
   * completa) que para una definición del registry. Es el mismo dato mirado
   * desde dos capas.
   */
  definition: { readonly data: { readonly functional?: ReadonlyArray<FunctionalProperty> } } | undefined,
): ConductorProperty | null {
  const found = definition?.data.functional?.find(
    (property): property is ConductorProperty => property.tag === "COND" && property.resourceType === "E",
  );
  return found ?? null;
}

/**
 * ¿Esta pieza sirve para tender un cable de señal? Desde 14a-4 los conductores
 * eléctricos dejan de ser componentes INSTALABLES y pasan a ser otro tipo de
 * recurso (decisión del operador, 2026-09-01): no aparecen en el selector de
 * instalación, aparecen en el de cableado. Este predicado es el que separa las
 * dos listas, y por eso vive acá y no dentro de una de ellas.
 */
export function isWiringMaterial(
  definition: { readonly data: { readonly functional?: ReadonlyArray<FunctionalProperty> } } | undefined,
): boolean {
  return electricalConductorProperty(definition) !== null;
}

/** Conductor con el que se tendió la arista, con el default de migración aplicado. */
export function edgeConductorId(edge: SignalEdge): ComponentId {
  return edge.conductorId ?? DEFAULT_EDGE_CONDUCTOR_ID;
}

/** Desgaste de la pieza consumida al tender, con el default de migración aplicado. */
export function edgeConductorWear(edge: SignalEdge): ComponentWear {
  return edge.conductorWear ?? DEFAULT_WEAR;
}
