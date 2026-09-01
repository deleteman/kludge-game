import { describe, expect, it } from "vitest";

import {
  COMPONENT_WEAR_TINT,
  COMPONENT_WEAR_CSS,
  CRISIS_FATAL_COLOR,
  CRISIS_WARNING_COLOR,
  CRISIS_SAFE_COLOR,
  INFO_NEUTRAL_COLOR,
  CRISIS_FATAL_CSS,
  CRISIS_WARNING_CSS,
  CRISIS_SAFE_CSS,
  TAG_CATEGORY_COLORS,
  ANCHOR_COLOR,
  CHEMICAL_TAG_COLORS,
  CHEMICAL_ELEMENT_COLORS,
  CHEMICAL_COMPOUND_COLORS,
  CHEMICAL_ELEMENT_FALLBACK_COLOR,
  chemicalSubstanceColor,
  WALL_COLOR,
  healthFractionColor,
  LED_ACTIVE_TINT,
  CORE_LOOP_MODE_COLORS,
  COMPONENT_CONDITION_TINT,
  STRUCTURAL_LAYER_COLOR,
  TIMER_TEXT_COLORS,
  SEALED_VALVE_COLOR,
  POWER_BLOCKED_FLASH_COLOR,
  BURNED_WIRE_COLOR,
  CONDUIT_COLORS,
  WIRE_LOAD_WARNING_RATIO,
  wireLoadColor,
  hexToCss,
} from "./palette.js";

/**
 * Guardia de regresión del contrato de semántica de color de crisis (Fase 12e).
 * Todas las superficies de estado deben derivar de las 4 constantes canónicas;
 * este test falla si alguien vuelve a hardcodear un hex de estado suelto (la
 * causa raíz de la deuda #15: el LED de alarma encendido en verde).
 */
describe("contrato de color de crisis (Eje A)", () => {
  it("healthFractionColor mapea a las constantes del contrato en sus 3 cortes", () => {
    expect(healthFractionColor(0.9)).toBe(CRISIS_SAFE_COLOR);
    expect(healthFractionColor(0.4)).toBe(CRISIS_WARNING_COLOR);
    expect(healthFractionColor(0.1)).toBe(CRISIS_FATAL_COLOR);
  });

  it("el Indicador LED activo usa el ámbar del contrato, nunca el verde de 'seguro' (regresión #15)", () => {
    expect(LED_ACTIVE_TINT).toBe(CRISIS_WARNING_COLOR);
    expect(LED_ACTIVE_TINT).not.toBe(CRISIS_SAFE_COLOR);
  });

  it("el modo del core loop usa verde=corriendo / ámbar=congelado del contrato", () => {
    expect(CORE_LOOP_MODE_COLORS.execution).toBe(CRISIS_SAFE_COLOR);
    expect(CORE_LOOP_MODE_COLORS.planning).toBe(CRISIS_WARNING_COLOR);
  });

  it("condición, capa estructural, timer y válvula sellada derivan del contrato", () => {
    expect(COMPONENT_CONDITION_TINT.jammed).toBe(CRISIS_WARNING_COLOR);
    expect(STRUCTURAL_LAYER_COLOR.warning).toBe(CRISIS_WARNING_COLOR);
    expect(STRUCTURAL_LAYER_COLOR.critical).toBe(CRISIS_FATAL_COLOR);
    expect(TIMER_TEXT_COLORS.warning).toBe(CRISIS_WARNING_CSS);
    expect(TIMER_TEXT_COLORS.danger).toBe(CRISIS_FATAL_CSS);
    expect(SEALED_VALVE_COLOR).toBe(CRISIS_FATAL_COLOR);
  });

  it("el destello de rechazo del slider de energía usa el rojo de bloqueo del contrato (Fase 13b)", () => {
    expect(POWER_BLOCKED_FLASH_COLOR).toBe(CRISIS_FATAL_COLOR);
  });

  it("los espejos CSS coinciden con sus constantes numéricas", () => {
    expect(CRISIS_FATAL_CSS).toBe(hexToCss(CRISIS_FATAL_COLOR));
    expect(CRISIS_WARNING_CSS).toBe(hexToCss(CRISIS_WARNING_COLOR));
    expect(CRISIS_SAFE_CSS).toBe(hexToCss(CRISIS_SAFE_COLOR));
  });
});

describe("desgaste de componente (Fase 13c) respeta el contrato", () => {
  it("degradado y critico derivan del Eje A, no de hexes inventados", () => {
    expect(COMPONENT_WEAR_TINT.degradado).toBe(CRISIS_WARNING_COLOR);
    expect(COMPONENT_WEAR_TINT.critico).toBe(CRISIS_FATAL_COLOR);
  });

  it("nuevo no tiñe (una pieza de fábrica se ve como cualquier otra)", () => {
    expect(COMPONENT_WEAR_TINT.nuevo).toBeUndefined();
  });

  it("usado no se confunde con ningún estado del Eje A: todavía no es un problema", () => {
    const crisisAxis = [CRISIS_FATAL_COLOR, CRISIS_WARNING_COLOR, CRISIS_SAFE_COLOR, INFO_NEUTRAL_COLOR];
    expect(crisisAxis).not.toContain(COMPONENT_WEAR_TINT.usado);
  });

  it("el desgaste escala en gravedad, nunca al revés (usado ≠ critico)", () => {
    expect(COMPONENT_WEAR_TINT.usado).not.toBe(COMPONENT_WEAR_TINT.critico);
    expect(COMPONENT_WEAR_TINT.degradado).not.toBe(COMPONENT_WEAR_TINT.critico);
  });

  it("los espejos CSS del desgaste coinciden con sus tintes", () => {
    expect(COMPONENT_WEAR_CSS.degradado).toBe(CRISIS_WARNING_CSS);
    expect(COMPONENT_WEAR_CSS.critico).toBe(CRISIS_FATAL_CSS);
    expect(COMPONENT_WEAR_CSS.usado).toBe(hexToCss(COMPONENT_WEAR_TINT.usado!));
  });

  it("el desgaste NUNCA usa el verde reservado a 'todo bien' (misma regresión que la deuda #15)", () => {
    for (const tint of Object.values(COMPONENT_WEAR_TINT)) {
      expect(tint).not.toBe(CRISIS_SAFE_COLOR);
    }
  });
});

describe("categoría de tag (Eje B) es ortogonal al Eje A", () => {
  it("ningún color de categoría colisiona con el eje de crisis", () => {
    const crisisAxis = [CRISIS_FATAL_COLOR, CRISIS_WARNING_COLOR, CRISIS_SAFE_COLOR, INFO_NEUTRAL_COLOR];
    expect(crisisAxis).not.toContain(TAG_CATEGORY_COLORS.functional);
    expect(crisisAxis).not.toContain(TAG_CATEGORY_COLORS.material);
  });

  it("funcional y material son distinguibles entre sí", () => {
    expect(TAG_CATEGORY_COLORS.functional).not.toBe(TAG_CATEGORY_COLORS.material);
  });
});

/**
 * 13e ronda 4. `CHEMICAL_TAG_COLORS.INERTE`, `CHEMICAL_ELEMENT_FALLBACK_COLOR` y
 * `ANCHOR_COLOR` valían los tres `0x8a949e`: tres significados distintos con un
 * mismo color, que es lo que el principio 6 prohíbe. En la práctica hacía que un
 * charco de agua fuera indistinguible del suelo y de las paredes.
 */
describe("colores de sustancia distinguibles (principio 6)", () => {
  it("inerte, desconocida y anclaje no comparten color", () => {
    const trio = [CHEMICAL_TAG_COLORS.INERTE, CHEMICAL_ELEMENT_FALLBACK_COLOR, ANCHOR_COLOR];
    expect(new Set(trio).size).toBe(trio.length);
  });

  it("ningún color de sustancia coincide con el de las paredes", () => {
    const all = [
      ...Object.values(CHEMICAL_ELEMENT_COLORS),
      ...Object.values(CHEMICAL_COMPOUND_COLORS),
      ...Object.values(CHEMICAL_TAG_COLORS),
      CHEMICAL_ELEMENT_FALLBACK_COLOR,
    ];
    expect(all).not.toContain(WALL_COLOR);
  });

  it("un compuesto del catálogo tiene color propio y no cae al de su tag", () => {
    // El agua es INERTE: sin entrada curada se pintaba con el gris genérico.
    expect(chemicalSubstanceColor("agua", [{ name: "INERTE" }])).toBe(CHEMICAL_COMPOUND_COLORS.agua);
    expect(chemicalSubstanceColor("agua", [{ name: "INERTE" }])).not.toBe(CHEMICAL_TAG_COLORS.INERTE);
  });

  it("una sustancia desconocida sin tags cae al neutro", () => {
    expect(chemicalSubstanceColor("mezcla-sin-identificar-1")).toBe(CHEMICAL_ELEMENT_FALLBACK_COLOR);
  });
});

/**
 * Subfase 14a-4: el cable del jugador pasa a tener estado (carga, quemado), así
 * que entra al mismo contrato que el resto de las superficies de estado.
 */
describe("estado de un cable de señal (Subfase 14a-4)", () => {
  it("un cable holgado se sigue viendo como el verde de la capa `senal`", () => {
    // Sin esto, 14a-4 habría recoloreado toda la capa de señal de la nave por
    // el mero hecho de agregarle un estado.
    expect(wireLoadColor(0.1)).toBe(CONDUIT_COLORS.senal);
    expect(wireLoadColor(undefined)).toBe(CONDUIT_COLORS.senal);
  });

  it("avisa en ámbar ANTES de reventar, no en el momento del corte", () => {
    // Patrón 8 del checklist: un límite necesita su propia señal, y llegar al
    // tope sin aviso previo se lee como que el juego hizo trampa.
    expect(WIRE_LOAD_WARNING_RATIO).toBeLessThan(1);
    expect(wireLoadColor(WIRE_LOAD_WARNING_RATIO)).toBe(CRISIS_WARNING_COLOR);
    expect(wireLoadColor(WIRE_LOAD_WARNING_RATIO - 0.01)).toBe(CRISIS_SAFE_COLOR);
  });

  it("el cable quemado no se confunde con ningún estado del eje de crisis (principio 6)", () => {
    for (const color of [CRISIS_SAFE_COLOR, CRISIS_WARNING_COLOR, CRISIS_FATAL_COLOR, INFO_NEUTRAL_COLOR]) {
      expect(BURNED_WIRE_COLOR).not.toBe(color);
    }
    // Ni con un cable sano, que es la confusión que de verdad importa acá.
    expect(BURNED_WIRE_COLOR).not.toBe(CONDUIT_COLORS.senal);
  });
});
