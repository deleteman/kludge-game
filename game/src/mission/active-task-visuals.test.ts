import { describe, expect, it, vi } from "vitest";
import type { CrewTaskId } from "engine";

import { ActiveTaskVisuals } from "./active-task-visuals.js";

/**
 * Ronda 4b de playtest de 14a-4: cancelar una tarea no detenía lo que el
 * tripulante estaba haciendo. Estos tests fijan el contrato del registro que lo
 * arregla; el cableado con la escena (quién registra qué) no es testeable acá.
 */

const id = (value: string): CrewTaskId => value as CrewTaskId;

describe("ActiveTaskVisuals", () => {
  it("apaga el visual de la tarea cancelada", () => {
    const visuals = new ActiveTaskVisuals();
    const stop = vi.fn();
    visuals.register(id("mover"), stop);

    visuals.stop(id("mover"));

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("no toca el visual de OTRA tarea", () => {
    // Dos tripulantes trabajando a la vez: cancelar a uno no puede congelar al otro.
    const visuals = new ActiveTaskVisuals();
    const otro = vi.fn();
    visuals.register(id("mover"), vi.fn());
    visuals.register(id("instalar"), otro);

    visuals.stop(id("mover"));

    expect(otro).not.toHaveBeenCalled();
  });

  it("apagar dos veces corre el apagador una sola vez", () => {
    // `task-cancelled` y `task-failed` pueden llegar sobre la misma tarea si
    // algo falla al cancelarla; un emisor ya destruido no admite un segundo stop.
    const visuals = new ActiveTaskVisuals();
    const stop = vi.fn();
    visuals.register(id("instalar"), stop);

    visuals.stop(id("instalar"));
    visuals.stop(id("instalar"));

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("apagar una tarea desconocida no revienta", () => {
    // Lo normal: cancelar una tarea que todavía no había arrancado.
    expect(() => new ActiveTaskVisuals().stop(id("nunca-arrancó"))).not.toThrow();
  });

  it("olvidar NO apaga: al completar, la animación termina sola", () => {
    const visuals = new ActiveTaskVisuals();
    const stop = vi.fn();
    visuals.register(id("mover"), stop);

    visuals.forget(id("mover"));
    visuals.stop(id("mover"));

    expect(stop).not.toHaveBeenCalled();
  });

  it("re-registrar apaga el visual anterior", () => {
    // Una tarea que se desbloquea y vuelve a arrancar emite `task-started` otra
    // vez; el visual viejo quedaría corriendo sin nadie que pueda detenerlo.
    const visuals = new ActiveTaskVisuals();
    const viejo = vi.fn();
    visuals.register(id("mover"), viejo);

    visuals.register(id("mover"), vi.fn());

    expect(viejo).toHaveBeenCalledTimes(1);
  });
});
