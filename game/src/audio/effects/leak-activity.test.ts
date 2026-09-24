import { describe, expect, it } from "vitest";
import {
  LEAK_FADE_SECONDS,
  advanceLeakActivity,
  createLeakActivityState,
} from "./leak-activity.js";

/** Corre `seconds` de frames a 20 fps con la concentración dada por `concentrationAt(t)`. */
function run(
  state: ReturnType<typeof createLeakActivityState>,
  seconds: number,
  concentrationAt: (t: number) => number,
  start = 0,
): number {
  let level = 0;
  const step = 0.05;
  for (let t = step; t <= seconds + 1e-9; t += step) level = advanceLeakActivity(state, concentrationAt(start + t), step);
  return level;
}

describe("audio: actividad de fuga", () => {
  it("una concentración estática por encima del umbral NO suena (el residuo no es una fuga)", () => {
    const state = createLeakActivityState(0.1);
    expect(run(state, 30, () => 0.1)).toBe(0);
  });

  it("gas que llega suena, y se apaga solo cuando deja de llegar aunque la sala siga contaminada", () => {
    const state = createLeakActivityState(0);
    const whilePouring = run(state, 4, (t) => 0.005 * t); // 0.005 /s de subida
    expect(whilePouring).toBeGreaterThan(0.5);

    // Deja de verter: la concentración se queda en 0.02, pero el siseo se apaga.
    const after = run(state, LEAK_FADE_SECONDS + 1, () => 0.02, 4);
    expect(after).toBe(0);
  });

  it("la difusión lenta (bajo la zona muerta) no dispara el sonido", () => {
    const state = createLeakActivityState(0.05);
    expect(run(state, 20, (t) => 0.05 + 0.0001 * t)).toBe(0);
  });

  it("una caída de concentración no suena", () => {
    const state = createLeakActivityState(0.2);
    expect(run(state, 10, (t) => 0.2 - 0.01 * t)).toBe(0);
  });

  it("con el juego en pausa (delta 0) no acumula ventana ni cambia la intensidad", () => {
    const state = createLeakActivityState(0);
    run(state, 2, (t) => 0.005 * t);
    const before = state.level;
    expect(advanceLeakActivity(state, 0.5, 0)).toBe(before);
  });
});
