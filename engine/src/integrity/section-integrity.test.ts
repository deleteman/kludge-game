import { describe, expect, it } from "vitest";
import type { SectionId } from "../atmosphere/section.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { IntegrityDomainEvent } from "./integrity-events.types.js";
import { applySectionDamage } from "./section-integrity.js";
import { SECTION_INTEGRITY_PARAMETERS } from "./section-integrity-parameters.js";
import {
  fromSectionIntegritySnapshot,
  initialSectionIntegrity,
  integrityFraction,
  toSectionIntegritySnapshot,
  type SectionIntegrity,
} from "./section-integrity.types.js";

const SECTION = "ingenieria" as SectionId;
const CELL = { x: 4, y: 4 };
const tickOf = (elapsedSeconds: number): TickContext => ({ dtSeconds: 1, elapsedSeconds });

function integrityOf(maxHp = 100): SectionIntegrity {
  return { hp: maxHp, maxHp, breached: false };
}

function damage(integrity: SectionIntegrity, amount: number, elapsed = 1) {
  const events: IntegrityDomainEvent[] = [];
  const emitter = new EventEmitter<IntegrityDomainEvent>();
  emitter.onAny((event) => events.push(event));
  applySectionDamage({
    sectionId: SECTION,
    integrity,
    amount,
    cause: "kinetic-impact",
    breachCell: CELL,
    tick: tickOf(elapsed),
    emitter,
  });
  return events;
}

describe("13f — vida por sección", () => {
  it("la vida inicial escala con el área de la sección", () => {
    const small = initialSectionIntegrity({
      id: SECTION,
      nameKey: "k",
      cells: [{ x: 0, y: 0 }],
    });
    const big = initialSectionIntegrity({
      id: SECTION,
      nameKey: "k",
      cells: Array.from({ length: 10 }, (_unused, index) => ({ x: index, y: 0 })),
    });

    expect(small.maxHp).toBe(SECTION_INTEGRITY_PARAMETERS.hpPerCell);
    expect(big.maxHp).toBe(SECTION_INTEGRITY_PARAMETERS.hpPerCell * 10);
    expect(integrityFraction(big)).toBe(1);
  });

  it("emite 'section-damaged' solo al CRUZAR de nivel, no en cada golpe", () => {
    const integrity = integrityOf(100);

    // 100 → 90: sigue en nominal (el corte de `fractionToLevel` es >0.5).
    expect(damage(integrity, 10)).toHaveLength(0);
    // 90 → 40: cruza a warning.
    const crossing = damage(integrity, 50);
    expect(crossing).toHaveLength(1);
    expect(crossing[0]).toMatchObject({ kind: "section-damaged", remainingFraction: 0.4 });
    // 40 → 35: sigue en warning, no vuelve a avisar.
    expect(damage(integrity, 5)).toHaveLength(0);
  });

  it("al llegar a 0 emite 'section-breached' UNA vez, con la celda de la brecha", () => {
    const integrity = integrityOf(100);
    const events = damage(integrity, 500);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "section-breached",
      sectionId: SECTION,
      breachCell: CELL,
      cause: "kinetic-impact",
    });
    expect(integrity.breached).toBe(true);
    expect(integrity.hp).toBe(0);

    // Seguir castigando una sección ya colapsada no vuelve a emitir nada: la
    // brecha ya está abierta, no se abre dos veces.
    expect(damage(integrity, 500, 2)).toHaveLength(0);
  });

  it("la vida NO se recupera nunca (principio 5)", () => {
    const integrity = integrityOf(100);
    damage(integrity, 60);
    // Un "daño" negativo no repara: la única vía de reparación es que no la hay.
    damage(integrity, -100);

    expect(integrity.hp).toBe(40);
  });

  it("sobrevive un round-trip de snapshot", () => {
    const integrity = integrityOf(250);
    damage(integrity, 200);

    const restored = fromSectionIntegritySnapshot(toSectionIntegritySnapshot(SECTION, integrity));

    expect(restored).toEqual({ hp: 50, maxHp: 250, breached: false });
  });
});
