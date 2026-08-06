/**
 * Ledger inmutable del contenido de los reservorios (Subfase 13e, deuda #9).
 *
 * `Blueprint.reservoirContents` (`{componentInstanceId, substanceId, amount}`)
 * existía desde el principio pero NADIE lo llenaba: hasta 13d solo se vaciaba
 * (`purge-reservoir`, `dismantleInstance`). Este módulo aporta los escritores
 * que faltaban, para que una sustancia sintetizada deje de ser un id flotante y
 * pase a tener ubicación y cantidad en el plano.
 *
 * Deliberadamente NO se extendió `ReservoirProperty` con sustancia+cantidad
 * (la disyuntiva que planteaba `nuevo-orden.md`): esa propiedad es dato de
 * CATÁLOGO, compartido por todas las instancias de la pieza; el contenido es
 * estado dinámico por instancia, que es exactamente lo que el `Blueprint` ya
 * modelaba. `ReservoirProperty.capacity` sí se usa, como tope.
 *
 * Regla de una sustancia por reservorio (decisión del operador, 2026-08-06):
 * verter algo distinto de lo que ya contiene se RECHAZA. Mezclar in-situ sería
 * otro sistema (abriría la resolución de identidad de mezclas dentro de un
 * tanque); el camino previsto es purgarlo antes (`purge-reservoir`, 13d), que
 * de paso le da un segundo uso a esa tarea.
 */

import type { PlacedComponentInstanceId, ReservoirContent } from "../blueprint/blueprint.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";

export class ReservoirLedgerError extends Error {}

/** El reservorio ya contiene OTRA sustancia: hay que purgarlo antes de verter. */
export class ReservoirOccupiedError extends ReservoirLedgerError {
  constructor(
    readonly instanceId: PlacedComponentInstanceId,
    readonly currentSubstanceId: ChemicalSubstanceId,
    readonly incomingSubstanceId: ChemicalSubstanceId,
  ) {
    super(
      `El reservorio "${instanceId}" contiene "${currentSubstanceId}": no admite "${incomingSubstanceId}" sin purgarlo antes.`,
    );
  }
}

export type ReservoirContents = ReadonlyArray<ReservoirContent>;

/** Contenido actual de una instancia, o `undefined` si está vacía. */
export function contentOf(
  contents: ReservoirContents,
  instanceId: PlacedComponentInstanceId,
): ReservoirContent | undefined {
  return contents.find((entry) => entry.componentInstanceId === instanceId && entry.amount > 0);
}

/** Espacio libre respecto de la capacidad de catálogo de la pieza. */
export function freeCapacity(
  contents: ReservoirContents,
  instanceId: PlacedComponentInstanceId,
  capacity: number,
): number {
  return Math.max(0, capacity - (contentOf(contents, instanceId)?.amount ?? 0));
}

export interface PourResult {
  readonly contents: ReservoirContents;
  /** Unidades que efectivamente entraron. */
  readonly poured: number;
  /**
   * Unidades que NO cupieron y se perdieron. El llamador avisa al jugador; se
   * pierden y no se devuelven al origen (Principio 5: las decisiones mal
   * medidas cuestan material).
   */
  readonly overflow: number;
}

/**
 * Vierte `amount` unidades de `substanceId` en la instancia. Lanza
 * `ReservoirOccupiedError` si ya contiene otra sustancia distinta.
 */
export function pourInto(
  contents: ReservoirContents,
  instanceId: PlacedComponentInstanceId,
  substanceId: ChemicalSubstanceId,
  amount: number,
  capacity: number,
): PourResult {
  if (amount <= 0) {
    return { contents, poured: 0, overflow: 0 };
  }
  const current = contentOf(contents, instanceId);
  if (current && current.substanceId !== substanceId) {
    throw new ReservoirOccupiedError(instanceId, current.substanceId, substanceId);
  }
  const room = freeCapacity(contents, instanceId, capacity);
  const poured = Math.min(amount, room);
  const overflow = amount - poured;
  if (poured === 0) {
    return { contents, poured: 0, overflow };
  }
  return {
    contents: withAmount(contents, instanceId, substanceId, (current?.amount ?? 0) + poured),
    poured,
    overflow,
  };
}

export interface DrawResult {
  readonly contents: ReservoirContents;
  /** Unidades realmente extraídas (puede ser menos de lo pedido: se saca lo que hay). */
  readonly drawn: number;
  readonly substanceId?: ChemicalSubstanceId;
}

/**
 * Saca hasta `amount` unidades. A diferencia de `consumeElements`, acá el
 * parcial SÍ es válido: vaciar un tanque que tiene menos de lo pedido es la
 * operación esperada, no un error.
 */
export function drawFrom(
  contents: ReservoirContents,
  instanceId: PlacedComponentInstanceId,
  amount: number,
): DrawResult {
  const current = contentOf(contents, instanceId);
  if (!current || amount <= 0) {
    return { contents, drawn: 0 };
  }
  const drawn = Math.min(amount, current.amount);
  return {
    contents: withAmount(contents, instanceId, current.substanceId, current.amount - drawn),
    drawn,
    substanceId: current.substanceId,
  };
}

/** Vacía la instancia por completo, devolviendo qué contenía (derrame/purga). */
export function emptyReservoir(
  contents: ReservoirContents,
  instanceId: PlacedComponentInstanceId,
): DrawResult {
  const current = contentOf(contents, instanceId);
  return drawFrom(contents, instanceId, current?.amount ?? 0);
}

/**
 * Escribe la cantidad de una instancia, borrando la entrada al llegar a cero
 * — un reservorio vacío no debe dejar una fila fantasma en el guardado, y
 * `blueprint-integrity.ts` ya trata las referencias colgantes como error.
 */
function withAmount(
  contents: ReservoirContents,
  instanceId: PlacedComponentInstanceId,
  substanceId: ChemicalSubstanceId,
  amount: number,
): ReservoirContents {
  const others = contents.filter((entry) => entry.componentInstanceId !== instanceId);
  if (amount <= 0) {
    return others;
  }
  return [...others, { componentInstanceId: instanceId, substanceId, amount }];
}
