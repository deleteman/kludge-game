import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ComponentWear } from "../wear/wear.types.js";

/**
 * Unidades de una misma pieza atómica agrupadas por su desgaste (Fase 13c).
 * Clave ausente = cero unidades de ese desgaste.
 */
export type WearBuckets = Partial<Record<ComponentWear, number>>;

/**
 * Stock de piezas ATÓMICAS recuperadas/disponibles para instalar (GDD 7.1: solo
 * los átomos son "building blocks" con identidad de catálogo propia — un
 * compuesto no se apila en inventario, se desarma o se fabrica). Clave ausente
 * = cero unidades; no hay semántica de "ilimitado" implícita en este tipo, la
 * decide quien construye el stock inicial (`save/campaign-save-factory.ts`).
 *
 * Fase 13c: cada `ComponentId` deja de mapear a un único número y pasa a
 * mapear a sus BUCKETS DE DESGASTE. El motivo es que el desgaste es por
 * instancia, pero al desmontar una pieza vuelve al stock y pierde su identidad
 * — sin buckets no habría dónde guardar la historia de la pieza entre
 * desmontarla y volver a instalarla, y el ciclo desmontar+reinstalar seguiría
 * siendo gratis (que es exactamente el hueco que 13c cierra).
 *
 * Es fungible DENTRO de cada bucket, no globalmente: dos sensores `usado` son
 * intercambiables entre sí, pero no con uno `nuevo`.
 */
export type AtomicPartsStock = Partial<Record<ComponentId, WearBuckets>>;

/**
 * Stock de ELEMENTOS químicos disponibles para sintetizar (Subfase 13e, GDD
 * 5.4.1: "se obtienen extrayéndolos de equipamiento... o de depósitos
 * limitados"). Clave ausente = cero unidades.
 *
 * Hasta 13e la paleta química de la mesa ofrecía el `ELEMENT_CATALOG` completo
 * sin restricción, así que sintetizar no costaba nada — este tipo es lo que
 * convierte la síntesis en una decisión de recurso escaso.
 *
 * Sin buckets de desgaste, a diferencia de `AtomicPartsStock`: una sustancia no
 * se desgasta ni acumula historia entre usos. Dos unidades de hidrógeno son
 * intercambiables sin más.
 */
export type ElementStock = Partial<Record<ChemicalSubstanceId, number>>;
