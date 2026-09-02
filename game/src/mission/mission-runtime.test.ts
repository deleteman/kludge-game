import { describe, expect, it } from "vitest";
import { createNewCampaignSave } from "engine";
import type { CampaignSaveState, CrewActor, CrewRoster, SectionId } from "engine";

import { MissionRuntime } from "./mission-runtime.js";

/**
 * Ronda 4a de playtest de 14a-4: **las dependencias entre tareas no existían**.
 *
 * `ensureAt` encolaba un `go-to` antes de cada acción con sitio y nunca pasaba
 * `dependsOn`: la relación era puro orden FIFO por tripulante. O sea que
 * cancelar el movimiento NO impedía la acción — el tripulante se quedaba donde
 * estaba y la pieza se instalaba igual, en una sección a la que nunca llegó.
 *
 * El mecanismo para evitarlo estaba entero y testeado en `TaskScheduler` desde
 * la Fase 10 (`resolveBlockingReason`, `cascadeDependents`) y **sin un solo
 * llamador**. Estos tests existen para que no vuelva a quedarse sin llamador:
 * los del scheduler prueban que el bloqueo funciona, estos prueban que alguien
 * lo usa.
 *
 * `MissionRuntime` no importa Phaser y su constructor solo toma un save, así que
 * es testeable de verdad — el estándar más laxo de `/game` (smoke tests) aplica
 * a lo que necesita una escena, no a esto.
 */

function actor(id: string): CrewActor {
  return {
    id,
    name: id,
    specialty: "ingenieria",
    tier: 1,
    hp: 100,
    status: "idle",
  } as unknown as CrewActor;
}

const ROSTER = {
  available: [actor("crew-1"), actor("crew-2"), actor("crew-3"), actor("crew-4")],
} as CrewRoster;

function newSave(): CampaignSaveState {
  return createNewCampaignSave({
    id: "campaign-test" as CampaignSaveState["metadata"]["id"],
    name: "test",
    archetype: "exploracion",
    roster: ROSTER,
    chosenCrewIds: [actor("crew-1").id, actor("crew-2").id],
    engineVersion: "0.0.0",
    now: "2026-09-02T00:00:00.000Z",
  });
}

/** Una sección donde el tripulante NO está, para forzar el `go-to` previo. */
function remoteSectionFor(mission: MissionRuntime, actorId: CrewActor["id"]): SectionId {
  const current = mission.scheduler.getActor(actorId)?.currentSectionId;
  const other = mission.shipFloorplan.sections.find((section) => section.id !== current);
  if (!other) throw new Error("el arquetipo de prueba necesita al menos dos secciones");
  return other.id;
}

describe("MissionRuntime: la acción depende del movimiento que la precede (14a-4 ronda 4a)", () => {
  it("encolar una acción en otra sección crea el `go-to` Y la enlaza", () => {
    const mission = new MissionRuntime(newSave());
    const actorId = mission.activeCrew[0]!.id;
    const target = remoteSectionFor(mission, actorId);

    mission.queueInstall(
      actorId,
      "indicador-led" as Parameters<MissionRuntime["queueInstall"]>[1],
      { width: 1, height: 1 },
      mission.shipFloorplan.sections.find((section) => section.id === target)!.cells[0]!,
    );

    const queue = mission.scheduler.queueFor(actorId);
    const move = queue.find((task) => task.type === "go-to");
    const install = queue.find((task) => task.type === "install");
    expect(move).toBeDefined();
    expect(install?.dependsOn).toEqual([move!.id]);
  });

  it("si el tripulante YA está en la sección no hay movimiento ni dependencia", () => {
    // Sin esto, cada acción arrastraría una dependencia a un `go-to` inexistente
    // o a uno inútil, y la cola anidada mostraría un árbol que no existe.
    const mission = new MissionRuntime(newSave());
    const actorId = mission.activeCrew[0]!.id;
    const current = mission.scheduler.getActor(actorId)?.currentSectionId;
    const here = mission.shipFloorplan.sections.find((section) => section.id === current)!;

    mission.queueInstall(
      actorId,
      "indicador-led" as Parameters<MissionRuntime["queueInstall"]>[1],
      { width: 1, height: 1 },
      here.cells[0]!,
    );

    const queue = mission.scheduler.queueFor(actorId);
    expect(queue.some((task) => task.type === "go-to")).toBe(false);
    expect(queue.find((task) => task.type === "install")?.dependsOn).toEqual([]);
  });

  /**
   * El camino NORMAL, y el que más protege: enlazar dependencias en 16 sitios
   * podría haber roto todas las acciones del juego de una sola vez. Si el
   * `go-to` completa, la acción tiene que correr como siempre.
   */
  it("si el movimiento se completa, la acción se ejecuta igual que antes", () => {
    const mission = new MissionRuntime(newSave());
    const actorId = mission.activeCrew[0]!.id;
    const target = remoteSectionFor(mission, actorId);
    const cell = mission.shipFloorplan.sections.find((section) => section.id === target)!.cells[0]!;
    const before = mission.blueprint.placedComponents.length;

    mission.queueInstall(
      actorId,
      "indicador-led" as Parameters<MissionRuntime["queueInstall"]>[1],
      { width: 1, height: 1 },
      cell,
    );
    for (let tick = 1; tick <= 60; tick += 1) {
      mission.scheduler.tick({ dtSeconds: 1, elapsedSeconds: tick });
    }

    const install = mission.scheduler.queueFor(actorId).find((task) => task.type === "install");
    expect(install?.state).toBe("completed");
    expect(mission.blueprint.placedComponents).toHaveLength(before + 1);
  });

  /**
   * EL BUG DEL REPORTE. Antes de esta ronda la instalación se ejecutaba igual y
   * la pieza aparecía en una sección a la que el tripulante nunca llegó.
   */
  it("cancelar el movimiento BLOQUEA la acción y la pieza no se instala", () => {
    const mission = new MissionRuntime(newSave());
    const actorId = mission.activeCrew[0]!.id;
    const target = remoteSectionFor(mission, actorId);
    const cell = mission.shipFloorplan.sections.find((section) => section.id === target)!.cells[0]!;
    const before = mission.blueprint.placedComponents.length;

    mission.queueInstall(
      actorId,
      "indicador-led" as Parameters<MissionRuntime["queueInstall"]>[1],
      { width: 1, height: 1 },
      cell,
    );
    const move = mission.scheduler.queueFor(actorId).find((task) => task.type === "go-to")!;
    mission.scheduler.cancel(move.id, { dtSeconds: 0, elapsedSeconds: 0 });

    // Tiempo de sobra para que la instalación hubiera corrido si nada la frena.
    for (let tick = 1; tick <= 30; tick += 1) {
      mission.scheduler.tick({ dtSeconds: 1, elapsedSeconds: tick });
    }

    const install = mission.scheduler.queueFor(actorId).find((task) => task.type === "install");
    expect(install?.state).toBe("blocked");
    expect(mission.scheduler.blockReasonFor(install!.id)).toBe("dependency-cancelled");
    expect(mission.blueprint.placedComponents).toHaveLength(before);
  });
});
