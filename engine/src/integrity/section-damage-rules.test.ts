import { describe, expect, it } from "vitest";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemistry/chemical-substance.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import { standardSectionAtmosphere } from "../atmosphere/section.types.js";
import type { GasKey } from "../atmosphere/atmosphere-composition.types.js";
import type { CombustionEvent } from "../chemistry/reaction/reaction-events.types.js";
import type { KineticImpactEvent } from "../kinetics/kinetic-events.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import {
  combustionSectionDamage,
  corrosionDamageRule,
  decompressionDamageRule,
  kineticImpactSectionDamage,
} from "./section-damage-rules.js";
import { SECTION_INTEGRITY_PARAMETERS } from "./section-integrity-parameters.js";
import { applySectionDamage } from "./section-integrity.js";
import type { IntegrityDomainEvent } from "./integrity-events.types.js";
import type { SectionIntegrity } from "./section-integrity.types.js";

const SECTION = "ingenieria" as SectionId;
const CELL = { x: 4, y: 4 };

const tickOf = (elapsedSeconds: number, dtSeconds = 1): TickContext => ({ dtSeconds, elapsedSeconds });

/** Sección de 40 celdas → 400 HP con los parámetros por defecto. */
function integrityOf(maxHp = 400, hp = maxHp): SectionIntegrity {
  return { hp, maxHp, breached: false };
}

function atmosphereWith(overrides: Partial<SectionAtmosphere> = {}): SectionAtmosphere {
  return { ...standardSectionAtmosphere(), ...overrides };
}

/**
 * Registro químico mínimo con un ácido `CORR` de nivel alto. No se usa el
 * catálogo completo a propósito: lo que se prueba acá es la regla, no qué
 * sustancias existen.
 */
const ACID = "acido-generico" as ChemicalSubstanceId;
const chemicalRegistry = {
  get: (id: ChemicalSubstanceId) =>
    id === ACID
      ? ({
          id: ACID,
          name: "Ácido genérico",
          data: { tags: [{ name: "CORR", level: "A" }] },
        } as unknown as ChemicalSubstanceDefinition)
      : undefined,
} as EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>;

describe("13f — escritor 1: impacto cinético", () => {
  const impactOf = (
    severity: KineticImpactEvent["severity"],
    targetKind: KineticImpactEvent["targetKind"],
  ): KineticImpactEvent => ({
    kind: "kinetic-impact",
    targetRef: "r",
    targetKind,
    position: CELL,
    velocity: "A",
    severity,
    elapsedSeconds: 0,
  });

  it("escala el daño con la severidad del impacto", () => {
    expect(kineticImpactSectionDamage(impactOf("low", "wall"))).toBe(
      SECTION_INTEGRITY_PARAMETERS.kineticDamageBySeverity.low,
    );
    expect(kineticImpactSectionDamage(impactOf("high", "wall"))).toBeGreaterThan(
      kineticImpactSectionDamage(impactOf("medium", "wall")),
    );
  });

  it("solo daña la sección si el impacto fue contra la PARED", () => {
    // Golpear una pieza o a un tripulante daña a ESE objetivo, no al casco.
    // Sin esta condición, disparar contra un enemigo destrozaría la nave.
    expect(kineticImpactSectionDamage(impactOf("high", "component"))).toBe(0);
    expect(kineticImpactSectionDamage(impactOf("high", "crew"))).toBe(0);
    expect(kineticImpactSectionDamage(impactOf("high", "enemy"))).toBe(0);
  });
});

describe("13f — escritor 2: combustión", () => {
  const combustionOf = (radius: CombustionEvent["radius"]): CombustionEvent => ({
    kind: "combustion",
    intensity: "standard",
    radius,
    crewDamage: "medium",
    sectionId: SECTION,
    elapsedSeconds: 0,
  });

  it("le da consecuencia real al radio, que hasta 13f solo movía partículas", () => {
    expect(combustionSectionDamage(combustionOf("none"))).toBe(0);
    expect(combustionSectionDamage(combustionOf("full-section"))).toBeGreaterThan(
      combustionSectionDamage(combustionOf("half-section")),
    );
  });
});

describe("13f — escritor 3: corrosión", () => {
  const ctx = (atmosphere: SectionAtmosphere, dtSeconds = 1) => ({
    atmosphere,
    integrity: integrityOf(),
    chemicalRegistry,
    dtSeconds,
  });

  it("no daña con atmósfera limpia", () => {
    expect(corrosionDamageRule.damageFor(ctx(atmosphereWith())).amount).toBe(0);
  });

  it("daña proporcionalmente al tiempo de exposición", () => {
    const corrosive = atmosphereWith({ gases: new Map([[ACID as unknown as GasKey, 0.5]]) });
    const oneSecond = corrosionDamageRule.damageFor(ctx(corrosive, 1)).amount;
    const twoSeconds = corrosionDamageRule.damageFor(ctx(corrosive, 2)).amount;

    expect(oneSecond).toBeGreaterThan(0);
    expect(twoSeconds).toBeCloseTo(oneSecond * 2);
  });
});

describe("13f — escritor 4: descompresión (amortiguada)", () => {
  const { onsetKpa, floorFraction } = SECTION_INTEGRITY_PARAMETERS.decompression;

  const ctx = (pressureKpa: number, integrity = integrityOf()) => ({
    atmosphere: atmosphereWith({ pressureKpa }),
    integrity,
    chemicalRegistry,
    dtSeconds: 1,
  });

  it("no daña mientras la presión esté por encima del umbral", () => {
    expect(decompressionDamageRule.damageFor(ctx(onsetKpa)).amount).toBe(0);
  });

  it("daña más cuanto más baja la presión", () => {
    const leve = decompressionDamageRule.damageFor(ctx(onsetKpa - 5)).amount;
    const vacio = decompressionDamageRule.damageFor(ctx(0)).amount;

    expect(leve).toBeGreaterThan(0);
    expect(vacio).toBeGreaterThan(leve);
  });

  /**
   * EL CASO EXTREMO, que es la razón de ser de la amortiguación: sin piso, el
   * bucle se realimenta (menos vida → más fuga → menos presión → más daño) y
   * cualquier sección con una fuga colapsa sola. Se prueba el peor caso —
   * vacío total durante mucho tiempo — no el caso feliz que motivó la regla.
   */
  it("por sí sola NUNCA puede colapsar la sección, por mucho que insista", () => {
    const integrity = integrityOf(400);
    const events: IntegrityDomainEvent[] = [];
    const emitter = new EventEmitter<IntegrityDomainEvent>();
    emitter.onAny((event) => events.push(event));

    for (let second = 0; second < 1000; second += 1) {
      const damage = decompressionDamageRule.damageFor(ctx(0, integrity));
      applySectionDamage({
        sectionId: SECTION,
        integrity,
        amount: damage.amount,
        floorHp: damage.floorHp,
        cause: "decompression",
        breachCell: CELL,
        tick: tickOf(second),
        emitter,
      });
    }

    expect(integrity.breached).toBe(false);
    expect(integrity.hp).toBeCloseTo(400 * floorFraction);
    expect(events.some((event) => event.kind === "section-breached")).toBe(false);
  });

  it("pero deja la sección a un impacto de la brecha: amortigua, no protege", () => {
    const integrity = integrityOf(400, 400 * floorFraction);
    applySectionDamage({
      sectionId: SECTION,
      integrity,
      amount: 999,
      cause: "kinetic-impact",
      breachCell: CELL,
      tick: tickOf(1),
    });

    expect(integrity.breached).toBe(true);
  });
});
