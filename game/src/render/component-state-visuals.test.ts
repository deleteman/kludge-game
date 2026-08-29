import { describe, expect, it } from "vitest";
import type { InstanceState } from "engine";

import { instanceStateLabel, resolveComponentVisual, visualForState } from "./component-state-visuals.js";
import { COMPONENT_CONDITION_TINT, COMPONENT_WEAR_TINT, DOOR_STATE_COLOR } from "./palette.js";

const UNPOWERED: InstanceState = { flag: "unpowered", required: 2, available: 1 };

describe("resolveComponentVisual (13h, ronda 3 de playtest)", () => {
  it("una pieza sana y nueva no se tiñe", () => {
    expect(resolveComponentVisual({ condition: "ok", wear: "nuevo" })).toEqual({});
  });

  it("sin energía se tiñe y trae ícono", () => {
    const visual = resolveComponentVisual({ condition: "ok", wear: "nuevo" }, [UNPOWERED]);
    expect(visual.tint).toBe(DOOR_STATE_COLOR.unpowered);
    expect(visual.icon).toBe("⚡");
  });

  describe("prioridad: gana el dato más grave", () => {
    it("`condition` gana sobre el estado derivado", () => {
      // Una puerta destruida no necesita que además le digan que no tiene
      // energía: el dato más grave manda, para no colapsar dos estados en un
      // color intermedio ambiguo (mismo criterio que la Fase 13c).
      const visual = resolveComponentVisual({ condition: "destroyed", wear: "nuevo" }, [UNPOWERED]);
      expect(visual.tint).toBe(COMPONENT_CONDITION_TINT.destroyed);
    });

    it("el estado derivado gana sobre `wear`", () => {
      // Que no arranque importa más que cuánta historia arrastra.
      const visual = resolveComponentVisual({ condition: "ok", wear: "degradado" }, [UNPOWERED]);
      expect(visual.tint).toBe(DOOR_STATE_COLOR.unpowered);
    });

    it("sin estados vivos cae a `wear`, que es lo que hacía el renderer antes", () => {
      const visual = resolveComponentVisual({ condition: "ok", wear: "critico" });
      expect(visual.tint).toBe(COMPONENT_WEAR_TINT.critico);
    });
  });

  it("el tinte de `unpowered` NO coincide con ningún tinte de desgaste ni de condición", () => {
    // Principio 6 de CLAUDE.md en su forma inversa: dos fenómenos distintos
    // nunca deben verse igual. El ámbar de `ENERGY_LAYER_COLOR.deficit` sería
    // el color "natural" de la energía, pero sobre un sprite ese mismo ámbar ya
    // significa `wear: degradado` — este aserto es lo que impide que alguien lo
    // "corrija" más adelante y vuelva a colapsar los dos estados.
    const reserved = [...Object.values(COMPONENT_WEAR_TINT), ...Object.values(COMPONENT_CONDITION_TINT)];
    expect(reserved).not.toContain(visualForState("unpowered").tint);
  });
});

describe("instanceStateLabel", () => {
  it("compone los números, porque el aviso sin ellos no da la salida", () => {
    const label = instanceStateLabel(UNPOWERED);
    expect(label).toContain("2");
    expect(label).toContain("1");
  });

  it("un estado sin detalle numérico se queda en su frase, sin sufijos vacíos", () => {
    expect(instanceStateLabel({ flag: "unpowered" })).not.toContain("undefined");
  });
});
