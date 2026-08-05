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
  healthFractionColor,
  LED_ACTIVE_TINT,
  CORE_LOOP_MODE_COLORS,
  COMPONENT_CONDITION_TINT,
  STRUCTURAL_LAYER_COLOR,
  TIMER_TEXT_COLORS,
  SEALED_VALVE_COLOR,
  POWER_BLOCKED_FLASH_COLOR,
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
