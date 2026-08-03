import Phaser from "phaser";
import { metaGameStateMachine } from "../meta/meta-game.js";
import { SceneFlowManager } from "../meta/scene-flow-manager.js";
import { SCENE_KEYS } from "../meta/scene-keys.js";

/**
 * Primera escena registrada (auto-arranca, Phaser inicia el índice 0 del
 * array de `scene:`). Único propósito: instanciar `SceneFlowManager` con un
 * `ScenePlugin` real (`this.scene`) — necesario porque `game.scene`
 * (`SceneManager`) no expone `start/launch/pause` en los typings de esta
 * versión de Phaser, solo `ScenePlugin` (el `this.scene` de una escena) los
 * tiene — y arrancar la pantalla de título. La máquina de meta-juego ya
 * empieza en `"title"` sin necesidad de una transición para este primer paso.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    // Se registra a sí mismo vía el constructor (Observer sobre metaGameStateMachine).
    const flowManager = new SceneFlowManager(this.scene, metaGameStateMachine);
    void flowManager;
    // Fase 12f (Obs 7, fullscreen en negro): el recálculo automático de `FIT`
    // al entrar/salir de fullscreen no siempre dispara solo contra el nuevo
    // `fullscreenTarget` — forzar `refresh()` en ambas transiciones cubre ese
    // caso. Registrado una sola vez acá (única escena que auto-arranca).
    this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, () => this.scale.refresh());
    this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, () => this.scale.refresh());
    this.scene.start(SCENE_KEYS.title);
  }
}
