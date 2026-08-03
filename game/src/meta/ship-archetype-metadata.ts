import { SHIP_ARCHETYPES } from "engine";
import type { ShipArchetype } from "engine";

/**
 * Metadata de flavor por arquetipo (Fase 12g, tarjeta de selección de nave).
 * Vive en `/game`, no en `/engine`: es texto/presentación, igual criterio que
 * `t(\`ship.${archetype}.name\`)` (nombre de arquetipo) ya resuelto en i18n.
 * Data-driven (CLAUDE.md): las claves i18n reales viven en `es.ts`/`en.ts`,
 * este mapa solo declara QUÉ claves usa cada arquetipo, no el texto en sí.
 */
export interface ShipArchetypeMetadata {
  readonly archetype: ShipArchetype;
  readonly properNameKey: string;
  readonly descriptionKey: string;
  readonly proKeys: readonly string[];
  readonly conKeys: readonly string[];
}

export const SHIP_ARCHETYPE_METADATA: Readonly<Record<ShipArchetype, ShipArchetypeMetadata>> = Object.fromEntries(
  SHIP_ARCHETYPES.map((archetype) => [
    archetype,
    {
      archetype,
      properNameKey: `ship.${archetype}.properName`,
      descriptionKey: `ship.${archetype}.description`,
      proKeys: [`ship.${archetype}.pro.0`, `ship.${archetype}.pro.1`],
      conKeys: [`ship.${archetype}.con.0`, `ship.${archetype}.con.1`],
    } satisfies ShipArchetypeMetadata,
  ]),
) as unknown as Readonly<Record<ShipArchetype, ShipArchetypeMetadata>>;
