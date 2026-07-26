import type Phaser from "phaser";
import type { MetaGameState } from "./meta-game-state.js";
import { MetaGameStateMachine } from "./meta-game-state.js";
import { SCENE_KEYS } from "./scene-keys.js";

type SceneAction = (plugin: Phaser.Scenes.ScenePlugin) => void;

/**
 * Único lugar que traduce una transición lógica (`MetaGameState` A → B) a
 * llamadas concretas de Phaser (`start`/`launch`/`pause`/`resume`/`stop`).
 * Tabla explícita por par (from, to) — no una heurística genérica de
 * "¿es overlay?" — porque el mismo estado destino (`options`) requiere una
 * acción distinta según de dónde vino (`title` vs. `paused`), y una tabla
 * cerrada hace ese matiz visible en vez de inferido.
 *
 * Opera sobre un `Phaser.Scenes.ScenePlugin` (el `this.scene` de CUALQUIER
 * escena activa) en vez de `game.scene` (`SceneManager`) — sus métodos
 * `start/launch/pause/...` aceptan cualquier `key` de destino, no solo el de
 * la escena dueña del plugin, así que un único plugin "ancla" (el de
 * `BootScene`) alcanza para orquestar todas las transiciones.
 *
 * IMPORTANTE (bug corregido): `ScenePlugin.start(key)` sin más SOLO detiene
 * la escena DUEÑA del plugin que lo invoca — no "la escena actual" genérica.
 * Como todas las transiciones se disparan desde el plugin ancla de
 * `BootScene` (siempre detenida), un `start(to)` a secas nunca apagaba la
 * escena `from` real: quedaba corriendo debajo y sus botones se acumulaban
 * visualmente. Cada "cambio duro" de escena acá para explícitamente `from`
 * antes de `start(to)`; cada "vuelta de overlay" usa `resume(from)` en vez de
 * `start(from)` cuando `from` fue solo pausada (no detenida) al entrar al
 * overlay — `start()` la recrearía desde cero encima de sus propios objetos
 * ya en pantalla.
 */
const TRANSITION_ACTIONS: ReadonlyMap<string, SceneAction> = new Map<string, SceneAction>([
  [
    "title->archetype-select",
    (p) => {
      p.stop(SCENE_KEYS.title);
      p.start(SCENE_KEYS.archetypeSelect);
    },
  ],
  [
    "title->in-mission",
    (p) => {
      p.stop(SCENE_KEYS.title);
      p.start(SCENE_KEYS.floorplan);
    },
  ],
  [
    "title->creative-hub",
    (p) => {
      p.stop(SCENE_KEYS.title);
      p.start(SCENE_KEYS.creativeHub);
    },
  ],
  [
    "title->options",
    (p) => {
      p.pause(SCENE_KEYS.title);
      p.launch(SCENE_KEYS.options, { returnTo: "title" });
    },
  ],
  [
    "title->credits",
    (p) => {
      p.pause(SCENE_KEYS.title);
      p.launch(SCENE_KEYS.credits);
    },
  ],
  [
    "credits->title",
    (p) => {
      p.stop(SCENE_KEYS.credits);
      p.resume(SCENE_KEYS.title);
    },
  ],
  [
    "archetype-select->crew-select",
    (p) => {
      p.stop(SCENE_KEYS.archetypeSelect);
      p.start(SCENE_KEYS.crewSelect);
    },
  ],
  [
    "archetype-select->title",
    (p) => {
      p.stop(SCENE_KEYS.archetypeSelect);
      p.start(SCENE_KEYS.title);
    },
  ],
  [
    "crew-select->in-mission",
    (p) => {
      p.stop(SCENE_KEYS.crewSelect);
      p.start(SCENE_KEYS.floorplan);
    },
  ],
  [
    "crew-select->archetype-select",
    (p) => {
      p.stop(SCENE_KEYS.crewSelect);
      p.start(SCENE_KEYS.archetypeSelect);
    },
  ],
  [
    "in-mission->paused",
    (p) => {
      p.pause(SCENE_KEYS.floorplan);
      p.launch(SCENE_KEYS.pauseMenu);
    },
  ],
  [
    "in-mission->crisis-result",
    (p) => {
      p.stop(SCENE_KEYS.floorplan);
      p.start(SCENE_KEYS.crisisResult);
    },
  ],
  [
    "paused->in-mission",
    (p) => {
      p.stop(SCENE_KEYS.pauseMenu);
      p.resume(SCENE_KEYS.floorplan);
    },
  ],
  [
    "paused->title",
    (p) => {
      p.stop(SCENE_KEYS.pauseMenu);
      p.stop(SCENE_KEYS.floorplan);
      p.start(SCENE_KEYS.title);
    },
  ],
  [
    "paused->options",
    (p) => {
      p.pause(SCENE_KEYS.pauseMenu);
      p.launch(SCENE_KEYS.options, { returnTo: "paused" });
    },
  ],
  [
    "options->title",
    (p) => {
      // `title` sólo quedó PAUSADA (este edge únicamente se usa cuando se
      // entró a options desde title, ver `returnTo`) — reanudar, no recrear.
      p.stop(SCENE_KEYS.options);
      p.resume(SCENE_KEYS.title);
    },
  ],
  [
    "options->paused",
    (p) => {
      p.stop(SCENE_KEYS.options);
      p.resume(SCENE_KEYS.pauseMenu);
    },
  ],
  [
    "crisis-result->in-mission",
    (p) => {
      p.stop(SCENE_KEYS.crisisResult);
      p.start(SCENE_KEYS.floorplan);
    },
  ],
  [
    "crisis-result->title",
    (p) => {
      p.stop(SCENE_KEYS.crisisResult);
      p.start(SCENE_KEYS.title);
    },
  ],
  [
    "creative-hub->creative-workbench",
    (p) => {
      p.stop(SCENE_KEYS.creativeHub);
      p.start(SCENE_KEYS.creativeWorkbench);
    },
  ],
  [
    "creative-hub->title",
    (p) => {
      p.stop(SCENE_KEYS.creativeHub);
      p.start(SCENE_KEYS.title);
    },
  ],
  [
    "creative-workbench->creative-hub",
    (p) => {
      p.stop(SCENE_KEYS.creativeWorkbench);
      p.start(SCENE_KEYS.creativeHub);
    },
  ],
]);

export class SceneFlowManager {
  constructor(
    private readonly plugin: Phaser.Scenes.ScenePlugin,
    private readonly machine: MetaGameStateMachine,
  ) {
    this.machine.onStateChanged(({ from, to }) => this.applyTransition(from, to));
  }

  private applyTransition(from: MetaGameState, to: MetaGameState): void {
    const action = TRANSITION_ACTIONS.get(`${from}->${to}`);
    if (!action) {
      throw new Error(`SceneFlowManager: no scene action registered for ${from}->${to}`);
    }
    action(this.plugin);
  }
}
