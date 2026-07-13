/**
 * Tipado nominal para identificadores. Sin esto, dos IDs con la misma forma
 * primitiva (ej. ComponentId y ChemicalSubstanceId, ambos string) serían
 * intercambiables por el chequeo estructural de TypeScript.
 */
export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };
