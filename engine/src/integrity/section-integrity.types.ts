import type { FloorplanSection } from "../floorplan/floorplan.types.js";
import { sectionArea } from "../floorplan/floorplan.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import { SECTION_INTEGRITY_PARAMETERS } from "./section-integrity-parameters.js";

/**
 * Vida propia de una sección de la nave (Subfase 13f).
 *
 * Reemplaza el modelo de la Subfase 11g, donde la integridad de casco se
 * DERIVABA del `RE` de las piezas instaladas: instalar una manguera RE-B
 * desplomaba el indicador de toda la nave y desmontarla lo "reparaba"
 * (reportado en el playtest de 13c). Una manguera no es casco. Ahora las
 * secciones se dañan por fenómenos físicos y la integridad de casco se deriva
 * de eso, no de su contenido.
 *
 * Separado de la geometría (`FloorplanSection`) igual que `SectionAtmosphere`
 * se separa de `Section`: la forma no cambia por tick, la vida sí. Campos
 * escalares MUTABLES, misma convención que `SectionAtmosphere`.
 *
 * Por qué numérico y no la escala cualitativa bajo/medio/alto del resto del
 * motor (GDD §5.2): los impactos son eventos discretos que restan de forma
 * natural, y con 3 niveles la primera explosión ya se comería un tercio de la
 * barra. Misma clase de excepción DELIBERADA que las unidades de energía de
 * 13b. El jugador nunca ve el número: el HUD y la capa "estructural" consumen
 * `ShipStatusIndicator` (fracción + nominal/warning/critical), que no cambia.
 */
export interface SectionIntegrity {
  hp: number;
  readonly maxHp: number;
  /** `true` desde que la vida llegó a 0. Nunca vuelve a `false` (principio 5). */
  breached: boolean;
  /**
   * Celda EXACTA donde se abrió el agujero (ronda 1 de playtest de 13f).
   * `undefined` mientras la sección no esté brechada.
   *
   * Se guarda en vez de recalcularse al cargar porque depende de dónde ocurrió
   * el daño, y eso no se puede reconstruir desde un save: sin este campo, la
   * brecha se "mudaba" de pared al recargar la partida y el parche que el
   * jugador dejó instalado quedaba en el lugar equivocado.
   */
  breachCell?: GridPosition;
}

/**
 * Forma serializable de la vida de una sección — molde exacto de
 * `SectionAtmosphereSnapshot` (`atmosphere/atmosphere-snapshot.types.ts`).
 */
export interface SectionIntegritySnapshot {
  readonly sectionId: SectionId;
  readonly hp: number;
  readonly maxHp: number;
  readonly breached: boolean;
  /** Ver `SectionIntegrity.breachCell`. Ausente en saves anteriores a la ronda 1 de 13f. */
  readonly breachCell?: GridPosition;
}

export function toSectionIntegritySnapshot(
  sectionId: SectionId,
  integrity: SectionIntegrity,
): SectionIntegritySnapshot {
  return {
    sectionId,
    hp: integrity.hp,
    maxHp: integrity.maxHp,
    breached: integrity.breached,
    ...(integrity.breachCell ? { breachCell: integrity.breachCell } : {}),
  };
}

export function fromSectionIntegritySnapshot(snapshot: SectionIntegritySnapshot): SectionIntegrity {
  return {
    hp: snapshot.hp,
    maxHp: snapshot.maxHp,
    breached: snapshot.breached,
    ...(snapshot.breachCell ? { breachCell: snapshot.breachCell } : {}),
  };
}

/**
 * Vida inicial de una sección sin snapshot guardado todavía — partida nueva, o
 * `Blueprint` de un save previo a 13f. Escala con el área de la sección
 * (`sectionArea`, ya existente y ya usada como volumen atmosférico): una bahía
 * de carga aguanta más castigo que un armario.
 */
export function initialSectionIntegrity(section: FloorplanSection): SectionIntegrity {
  const maxHp = sectionArea(section) * SECTION_INTEGRITY_PARAMETERS.hpPerCell;
  return { hp: maxHp, maxHp, breached: false };
}

/**
 * Vida de una sección lista para agregar a nivel de nave: la fracción y el peso
 * que le toca en la media (ronda 1 de playtest de 13f).
 *
 * El peso existe porque la nave no es una lista de secciones intercambiables.
 * Sin él, la agregación tenía que elegir entre "peor sección gana" —que ponía
 * TODA la nave al 17% por una esclusa reventada— y una media plana, que le da
 * a la esclusa el mismo voto que a la bodega. El `maxHp` ya codifica el tamaño
 * (área × HP por celda), así que no hace falta un segundo número que mantener
 * en sincronía.
 */
export interface WeightedSectionIntegrity {
  readonly fraction: number;
  readonly weight: number;
}

/** Fracción [0,1] de vida restante, insumo del `ShipStatusIndicator` del HUD. */
export function integrityFraction(integrity: SectionIntegrity): number {
  if (integrity.maxHp <= 0) {
    return 1;
  }
  return Math.max(0, Math.min(1, integrity.hp / integrity.maxHp));
}
