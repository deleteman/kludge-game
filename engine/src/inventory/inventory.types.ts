import type { ComponentId } from "../components/physical-component.types.js";

/**
 * Stock de piezas ATÓMICAS recuperadas/disponibles para instalar (GDD 7.1: solo
 * los átomos son "building blocks" con identidad de catálogo propia — un
 * compuesto no se apila en inventario, se desarma o se fabrica). Clave ausente
 * = cero unidades; no hay semántica de "ilimitado" implícita en este tipo, la
 * decide quien construye el stock inicial (`save/campaign-save-factory.ts`).
 */
export type AtomicPartsStock = Partial<Record<ComponentId, number>>;
