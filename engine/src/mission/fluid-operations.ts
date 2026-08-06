/**
 * Registro de operaciones de fluido EN CURSO (Subfase 13e, deuda #10).
 *
 * La capa `fluido` del plano animaba con una heurística prestada: reutilizaba
 * el booleano de cicatriz de energía de `electrico`, porque el motor no tenía
 * ningún concepto de caudal (`ReservoirContent` es una cantidad estática por
 * instancia, no transporte entre secciones).
 *
 * En vez de construir una simulación de transporte continuo —que ningún
 * capítulo pide todavía— el caudal se deriva de lo que REALMENTE está pasando:
 * un trasvase, un vertido, una extracción, una purga o un derrame en curso. Si
 * nadie mueve fluido, el conducto queda quieto: eso es correcto, no un bug,
 * mismo criterio que 11f.4 dejó documentado para los conductos `senal` en calma.
 *
 * Vive en `/engine` y no en `/game` porque el dato es de dominio (qué tarea
 * está corriendo y entre qué secciones); `/game` solo lo normaliza a [0,1].
 */

import type { SectionId } from "../atmosphere/section.types.js";

/** Una operación de fluido viva entre dos secciones (o dentro de una sola). */
export interface FluidFlow {
  readonly fromSectionId: SectionId;
  /** Ausente = la operación no cruza a otra sección (vertido/extracción in situ). */
  readonly toSectionId?: SectionId;
  /** Unidades por segundo, para que un trasvase grande se vea más intenso que uno chico. */
  readonly rate: number;
}

/**
 * Operaciones en curso, indexadas por un id opaco (el `CrewTaskId` de quien la
 * ejecuta) para poder retirarlas al terminar sin depender del orden.
 */
export class FluidOperationRegistry {
  private readonly flows = new Map<string, FluidFlow>();

  begin(operationId: string, flow: FluidFlow): void {
    if (flow.rate <= 0) {
      return;
    }
    this.flows.set(operationId, flow);
  }

  end(operationId: string): void {
    this.flows.delete(operationId);
  }

  get all(): ReadonlyArray<FluidFlow> {
    return [...this.flows.values()];
  }

  /**
   * Caudal agregado que atraviesa el par de secciones dado, en cualquier
   * sentido — un conducto no distingue dirección para animarse. Incluye las
   * operaciones in situ de cualquiera de los dos extremos: purgar un tanque en
   * la bodega también mueve fluido por el conducto que la alimenta.
   */
  rateBetween(a: SectionId, b: SectionId): number {
    let total = 0;
    for (const flow of this.flows.values()) {
      const touchesA = flow.fromSectionId === a || flow.toSectionId === a;
      const touchesB = flow.fromSectionId === b || flow.toSectionId === b;
      if (touchesA || touchesB) {
        total += flow.rate;
      }
    }
    return total;
  }

  get isEmpty(): boolean {
    return this.flows.size === 0;
  }
}
