/**
 * Demo de dev del core loop de Fase 6 (NO es UI de producción — el feedback
 * visual real es Fase 8, el cableado a /game es Fase 10). Corre el escenario del
 * caso de validación 14 ("Cadena de Montaje bajo Presión") imprimiendo cada
 * evento del motor tick a tick, para poder VER el loop latir desde la consola.
 *
 *   Ejecutar:  npx tsx engine/demo/core-loop-demo.ts
 */
import {
  CoreLoopModeMachine,
  TaskScheduler,
  createCrewTask,
  EventEmitter,
  type CoreLoopDomainEvent,
  type CrewActorId,
  type CrewTaskId,
  type SectionId,
} from "../src/index.js";

const INGENIERO = "ingeniero" as CrewActorId;
const MEDICO = "medico" as CrewActorId;
const id = (raw: string): CrewTaskId => raw as CrewTaskId;

// --- Cableado: máquina de modo + scheduler, con un log de todos los eventos ---
const emitter = new EventEmitter<CoreLoopDomainEvent>();
emitter.onAny((e) => {
  const extra =
    e.kind === "core-loop-mode-changed"
      ? `→ ${e.mode}`
      : e.kind === "task-blocked"
        ? `${e.taskId} (${e.reason})`
        : "taskId" in e
          ? e.taskId
          : "";
  console.log(`   ⚡ [t=${e.elapsedSeconds}s] ${e.kind} ${extra}`);
});

const scheduler = new TaskScheduler({
  emitter,
  effect: (task) => console.log(`      ↳ efecto de "${task.id}" ejecutado (aquí Fase 7/9/10)`),
});
const machine = new CoreLoopModeMachine(emitter);
machine.registerTickable(scheduler);

// --- Planificación (pausa): encolar dos colas en paralelo con una dependencia ---
console.log("═══ MODO PLANIFICACIÓN (reloj congelado) ═══");
scheduler.enqueue(
  createCrewTask({
    id: id("desmontar"),
    actorId: INGENIERO,
    type: "dismantle",
    targetSectionId: "seccion-a" as SectionId,
    estimatedDurationSeconds: 3,
  }),
);
scheduler.enqueue(
  createCrewTask({
    id: id("fabricar"),
    actorId: MEDICO,
    type: "combine",
    targetSectionId: "seccion-b" as SectionId,
    estimatedDurationSeconds: 2,
    dependsOn: [id("desmontar")], // el Médico espera al Ingeniero (GDD §4.3)
  }),
);
console.log("   Ingeniero: [desmontar 3s]   Médico: [fabricar 2s, espera a desmontar]");

// Prueba de que el reloj está congelado: un tick en planificación no hace nada.
machine.tick(1);
console.log(`   (tick en pausa → desmontar sigue '${scheduler.getTask(id("desmontar"))?.state}')`);

// --- Ejecución (play): avanzar en tiempo real, 1s por tick ---
console.log("\n═══ PLAY — MODO EJECUCIÓN (tiempo real) ═══");
machine.play();

const snapshot = (): string =>
  `Ing:${scheduler.getActor(INGENIERO)?.status}/${scheduler.getTask(id("desmontar"))?.state}` +
  `  Méd:${scheduler.getActor(MEDICO)?.status}/${scheduler.getTask(id("fabricar"))?.state}`;

for (let t = 1; t <= 6; t++) {
  machine.tick(1);
  console.log(`t=${t}s  ${snapshot()}`);
}

console.log("\n✔ Ambas tareas completadas. El Médico esperó bloqueado hasta que el Ingeniero terminó.");
