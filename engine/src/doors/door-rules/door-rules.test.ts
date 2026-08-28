import { describe, expect, it } from "vitest";
import {
  createDefaultDoorRuleRegistry,
  resolveDoorGovernance,
  type DoorGovernanceContext,
  type DoorRuntime,
  type DoorId,
} from "../../index.js";
import type { SectionId } from "../../atmosphere/section.types.js";

const RULES = createDefaultDoorRuleRegistry();

function door(overrides: Partial<DoorRuntime> = {}): DoorRuntime {
  return {
    id: "door-1" as DoorId,
    a: "pasillo" as SectionId,
    b: "bodega" as SectionId,
    cells: [{ x: 4, y: 2 }],
    mode: "auto",
    state: "closed",
    transitionElapsedSeconds: 0,
    hp: 300,
    maxHp: 300,
    ...overrides,
  };
}

function ctx(overrides: Partial<DoorGovernanceContext> = {}): DoorGovernanceContext {
  return {
    door: door(),
    actorNearby: false,
    powered: true,
    magneticFieldIntensity: "N",
    resistance: "A",
    ...overrides,
  };
}

describe("reglas de gobierno de puertas (13h)", () => {
  describe("auto — el default que compartimenta la nave", () => {
    it("abre cuando hay un actor cerca y cierra cuando no lo hay", () => {
      expect(resolveDoorGovernance(RULES, ctx({ actorNearby: true }))).toMatchObject({
        targetOpen: true,
        mode: "auto",
      });
      expect(resolveDoorGovernance(RULES, ctx({ actorNearby: false }))).toMatchObject({
        targetOpen: false,
        mode: "auto",
      });
    });

    it("no distingue quién se acerca — un intruso la abre igual que un tripulante", () => {
      // `actorNearby` es deliberadamente ciego al bando: es lo que hace que
      // trabar una puerta sea una decisión táctica y no un detalle.
      expect(resolveDoorGovernance(RULES, ctx({ actorNearby: true })).targetOpen).toBe(true);
    });
  });

  describe("señal — la puerta como actuador cableado", () => {
    it("abre con la señal en true y cierra con la señal en false", () => {
      expect(resolveDoorGovernance(RULES, ctx({ signalOutput: true }))).toMatchObject({
        targetOpen: true,
        mode: "override",
        overrideSource: "signal",
      });
      expect(resolveDoorGovernance(RULES, ctx({ signalOutput: false }))).toMatchObject({
        targetOpen: false,
        overrideSource: "signal",
      });
    });

    it("sin cable tendido (undefined) NO gobierna — la puerta sigue en auto", () => {
      // Si `undefined` se tratara como `false`, instalar una puerta la dejaría
      // cerrada para siempre hasta que alguien la cablee.
      const outcome = resolveDoorGovernance(RULES, ctx({ signalOutput: undefined, actorNearby: true }));
      expect(outcome).toMatchObject({ targetOpen: true, mode: "auto" });
    });

    it("gana sobre auto: la señal cierra aunque haya alguien al lado", () => {
      const outcome = resolveDoorGovernance(RULES, ctx({ signalOutput: false, actorNearby: true }));
      expect(outcome.targetOpen).toBe(false);
    });
  });

  describe("prioridad — el orden del registro ES la semántica", () => {
    it("sin energía gana sobre la señal: una puerta sin motor no obedece a un cable", () => {
      const outcome = resolveDoorGovernance(RULES, ctx({ powered: false, signalOutput: true }));
      expect(outcome.overrideSource).toBe("unpowered");
      // `targetOpen` ausente = congelar donde está, que no es lo mismo que cerrar.
      expect(outcome.targetOpen).toBeUndefined();
    });

    it("sin energía gana sobre auto", () => {
      const outcome = resolveDoorGovernance(RULES, ctx({ powered: false, actorNearby: true }));
      expect(outcome.overrideSource).toBe("unpowered");
      expect(outcome.targetOpen).toBeUndefined();
    });

    it("la señal gana sobre la tarea: automatizar pisa una orden manual vieja", () => {
      const outcome = resolveDoorGovernance(
        RULES,
        ctx({ signalOutput: false, taskOverrideOpen: true }),
      );
      expect(outcome).toMatchObject({ targetOpen: false, overrideSource: "signal" });
    });

    it("trabada por electroimán gana sobre todo salvo destruida", () => {
      const outcome = resolveDoorGovernance(
        RULES,
        ctx({ magneticFieldIntensity: "A", signalOutput: true, actorNearby: true }),
      );
      expect(outcome).toMatchObject({ forcedState: "jammed", overrideSource: "magnetic-lock" });
    });

    it("destruida gana sobre todo, incluido el electroimán", () => {
      const outcome = resolveDoorGovernance(
        RULES,
        ctx({ door: door({ state: "destroyed" }), magneticFieldIntensity: "A", signalOutput: true }),
      );
      expect(outcome.forcedState).toBe("destroyed");
    });
  });

  describe("electroimán (caso de validación 9)", () => {
    it("no traba con campo por debajo del umbral", () => {
      const outcome = resolveDoorGovernance(RULES, ctx({ magneticFieldIntensity: "B" }));
      expect(outcome.overrideSource).not.toBe("magnetic-lock");
    });

    it("no traba una hoja demasiado blanda — es por propiedades, no por id", () => {
      const outcome = resolveDoorGovernance(
        RULES,
        ctx({ magneticFieldIntensity: "A", resistance: "B" }),
      );
      expect(outcome.overrideSource).not.toBe("magnetic-lock");
    });
  });

  describe("daño", () => {
    it("una puerta muy castigada se traba por deformación", () => {
      const outcome = resolveDoorGovernance(RULES, ctx({ door: door({ hp: 50 }) }));
      expect(outcome.overrideSource).toBe("jammed-damage");
    });

    it("se traba DONDE ESTÁ: pillada abierta, se queda abierta", () => {
      const outcome = resolveDoorGovernance(RULES, ctx({ door: door({ hp: 50, state: "open" }) }));
      expect(outcome).toMatchObject({ targetOpen: true, overrideSource: "jammed-damage" });
      expect(outcome.forcedState).toBeUndefined();
    });
  });
});
