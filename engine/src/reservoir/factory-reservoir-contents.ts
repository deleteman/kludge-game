/**
 * Índice singleton de "qué sustancia trae de fábrica cada reservorio del
 * catálogo" (Subfase 13e, ronda 1 de fixes de playtest).
 *
 * Vive aparte de `initial-reservoir-contents.ts` para que ese módulo se
 * mantenga PURO y testeable con specs de fixture: acá se ata al catálogo real,
 * igual que `CANONICAL_SHIP_FLOORPLANS` ata los planos a sus JSON.
 */

import { ALL_COMPOSITE_SPECS } from "../components/catalog/build-component-catalog.js";
import { indexFactoryReservoirContents } from "./initial-reservoir-contents.js";
import type { FactoryReservoirContents } from "./initial-reservoir-contents.js";

export const FACTORY_RESERVOIR_CONTENTS: FactoryReservoirContents =
  indexFactoryReservoirContents(ALL_COMPOSITE_SPECS);
