import { describe, expect, it } from "vitest";
import type { InstanceState, InstanceStateFlag } from "engine";

import {
  instanceStateLabel,
  resolveComponentVisual,
  stateGlyphs,
  visualForState,
} from "./component-state-visuals.js";
import { t } from "../i18n/i18n.js";
import {
  COMPONENT_CONDITION_TINT,
  COMPONENT_WEAR_TINT,
  DOOR_STATE_COLOR,
  OVERLOADED_CONDUCTOR_LIGHT_COLOR,
} from "./palette.js";

const UNPOWERED: InstanceState = { flag: "unpowered", required: 2, available: 1 };
const OVERLOADED: InstanceState = { flag: "overloaded" };

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

  it("ningún estado derivado comparte tinte con el desgaste ni con la condición", () => {
    // Principio 6 de CLAUDE.md en su forma inversa: dos fenómenos distintos
    // nunca deben verse igual. El ámbar de `ENERGY_LAYER_COLOR.deficit` sería
    // el color "natural" de la energía, pero sobre un sprite ese mismo ámbar ya
    // significa `wear: degradado` — este aserto es lo que impide que alguien lo
    // "corrija" más adelante y vuelva a colapsar los dos estados.
    //
    // Extendido en 14a-2 a TODOS los flags en vez de solo a `unpowered`: el
    // valor de este aserto es que cubra el estado que se agregue mañana sin que
    // nadie se acuerde de venir a ampliarlo. `overloaded` usa un ámbar propio
    // (el de la cicatriz de chispas) que no es el de `CRISIS_WARNING_COLOR`.
    const reserved = [...Object.values(COMPONENT_WEAR_TINT), ...Object.values(COMPONENT_CONDITION_TINT)];
    const flags: InstanceStateFlag[] = ["unpowered", "overloaded", "unsignaled"];
    const tints = flags.map((flag) => visualForState(flag).tint);

    for (const tint of tints) {
      expect(reserved).not.toContain(tint);
    }
    // Y tampoco entre sí: un cable cortado no puede verse igual que uno apagado.
    expect(new Set(tints).size).toBe(flags.length);
  });

  describe("`overloaded` (ronda 1 de playtest de 14a-2)", () => {
    it("un conductor cortado se tiñe con el ámbar de su propia cicatriz y trae glifo", () => {
      const visual = resolveComponentVisual({ condition: "ok", wear: "nuevo" }, [OVERLOADED]);
      expect(visual.tint).toBe(OVERLOADED_CONDUCTOR_LIGHT_COLOR);
      expect(visual.icon).toBeDefined();
      expect(visual.noticeKey).toBeDefined();
    });

    /**
     * La franja donde los DOS predicados son ciertos, que es la que el operador
     * se encontraría jugando: el cable se corta dentro de una sección a la que
     * el dial dejó sin energía. Sin un orden fijo, la pieza se anunciaría como
     * "sin energía" y el jugador iría a mover el dial en vez de a reemplazar el
     * cable — el aviso mandándolo al problema equivocado.
     */
    it("sobrecargado gana sobre sin energía: se anuncia la cicatriz, no el dial", () => {
      const visual = resolveComponentVisual({ condition: "ok", wear: "nuevo" }, [OVERLOADED, UNPOWERED]);
      expect(visual.tint).toBe(OVERLOADED_CONDUCTOR_LIGHT_COLOR);
    });

    it("pero `condition` sigue ganando sobre él: una pieza destruida se ve destruida", () => {
      const visual = resolveComponentVisual({ condition: "destroyed", wear: "nuevo" }, [OVERLOADED]);
      expect(visual.tint).toBe(COMPONENT_CONDITION_TINT.destroyed);
    });

    it("su aviso no arrastra sufijos numéricos vacíos (no tiene detalle que mostrar)", () => {
      const label = instanceStateLabel(OVERLOADED);
      expect(label).not.toContain("undefined");
      expect(label.length).toBeGreaterThan(0);
    });
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

  it("una temperatura del motor se redondea a una décima (ronda 1 de playtest de 14a-3)", () => {
    // El operador vio `-10.9483472938279` en el aviso de contenido congelado.
    // Los detalles nacieron en 13h con consumidores que solo traían enteros, así
    // que interpolar el número crudo funcionaba por casualidad hasta que llegó
    // el primer float.
    const label = instanceStateLabel({
      flag: "frozen-content",
      required: 0,
      available: -10.9483472938279,
    });
    expect(label).toContain("-10.9");
    expect(label).not.toContain("-10.94");
  });

  it("un entero sigue leyéndose como entero, sin `.0` sobrante", () => {
    // Las unidades de energía y la demanda de señal son contables: un decimal
    // ahí sería ruido.
    const label = instanceStateLabel(UNPOWERED);
    expect(label).toContain("2");
    expect(label).not.toContain("2.0");
  });
});

/**
 * Ronda 2 de playtest de 14a-4. El operador pidió el estado nuevo y, en la
 * misma frase, que pudiera convivir con el de energía: "cuidado que ambos
 * estados pueden convivir, así que las indicaciones visuales deben estar
 * preparadas para eso".
 */
describe("`unsignaled` y la convivencia de estados (14a-4 ronda 2)", () => {
  const SIN_SENAL: InstanceState = { flag: "unsignaled", required: 8, available: 3 };
  const SIN_ENERGIA: InstanceState = { flag: "unpowered", required: 2, available: 1 };

  it("trae glifo propio, distinto del rayo de la energía", () => {
    expect(visualForState("unsignaled").icon).toBeDefined();
    expect(visualForState("unsignaled").icon).not.toBe(visualForState("unpowered").icon);
  });

  it("con DOS estados se dibujan los DOS glifos", () => {
    // El agujero que esta función viene a tapar: `resolveComponentVisual`
    // devuelve un solo visual, así que hasta acá el jugador arreglaba la
    // energía y recién entonces descubría que además faltaba señal.
    expect(stateGlyphs([SIN_SENAL, SIN_ENERGIA])).toEqual([
      visualForState("unsignaled").icon,
      visualForState("unpowered").icon,
    ]);
  });

  it("el TINTE sigue siendo uno solo: el del estado más grave", () => {
    // Los glifos se acumulan, el color no. Un color mixto sería inventar un
    // tercer significado (principio 6 en su forma inversa).
    const visual = resolveComponentVisual({ condition: "ok", wear: "nuevo" }, [SIN_SENAL, SIN_ENERGIA]);
    expect(visual.tint).toBe(visualForState("unsignaled").tint);
  });

  it("sin estados no hay glifos", () => {
    expect(stateGlyphs([])).toEqual([]);
  });

  it("el detalle nombra la demanda y la capacidad, no 'pide/otorga'", () => {
    // Los dos números de `unsignaled` no son los de `unpowered`: nadie "otorga"
    // la capacidad de un emisor. Compartir las etiquetas dejaba el aviso
    // describiendo mal su propio número.
    const label = instanceStateLabel(SIN_SENAL);
    expect(label).toContain("8");
    expect(label).toContain("3");
    expect(label).not.toContain(t("ui.floorplan.mission.state.granted"));
  });

  /**
   * Ronda 1 de playtest de 14b-2. `instanceStateLabel` COMPONE el número aparte
   * —`t()` no interpola, como dice su propio docblock— así que una etiqueta de
   * detalle con un `{value}` adentro se imprime literal: el operador vio
   * "quedan {value} 46 · de {value} 120".
   *
   * El test recorre TODOS los flags en vez de arreglar los dos que fallaron:
   * ancla la clase (ninguna clave de detalle puede llevar placeholder) y no el
   * caso, que es lo que evita que el próximo estado lo reintroduzca.
   */
  it("ninguna etiqueta de detalle imprime un placeholder sin reemplazar", () => {
    const FLAGS: readonly InstanceStateFlag[] = [
      "unpowered",
      "overloaded",
      "unsignaled",
      "frozen-content",
      "pouring",
      "reservoir-low",
    ];
    for (const flag of FLAGS) {
      const label = instanceStateLabel({ flag, required: 46, available: 120 });
      expect(label, `el aviso de "${flag}" lleva un placeholder literal`).not.toContain("{");
      const visual = visualForState(flag);
      if (visual.detailKeys) {
        expect(label).toContain("46");
        expect(label).toContain("120");
      }
    }
  });
});
