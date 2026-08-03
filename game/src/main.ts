import Phaser from "phaser";
import RexUIPlugin from "phaser3-rex-plugins/templates/ui/ui-plugin.js";

import { BootScene } from "./scenes/boot-scene.js";
import { FloorplanScene } from "./scenes/floorplan-scene.js";
import { ParticleGalleryScene } from "./scenes/particle-gallery-scene.js";
import { TitleScene } from "./scenes/title-scene.js";
import { CreditsScene } from "./scenes/credits-scene.js";
import { ArchetypeSelectScene } from "./scenes/archetype-select-scene.js";
import { CrewSelectScene } from "./scenes/crew-select-scene.js";
import { PauseMenuScene } from "./scenes/pause-menu-scene.js";
import { OptionsScene } from "./scenes/options-scene.js";
import { CrisisResultScene } from "./scenes/crisis-result-scene.js";
import { CreativeHubScene } from "./scenes/creative-hub-scene.js";
import { CreativeWorkbenchScene } from "./scenes/creative-workbench-scene.js";
import { loadUiFonts } from "./ui/fonts.js";

/**
 * Punto de entrada de /game. 1280×720, `pixelArt: true` (GDD §11) — el
 * canvas escala con nearest-neighbor. Fase 9.5 añade el flujo de meta-juego
 * (título→arquetipo→tripulación→misión→pausa/opciones/resultado→modo
 * creativo) sobre el visor/galería dev ya existentes de Fases 5/8, más el
 * plugin rexUI (instalado desde el inicio, nunca registrado hasta ahora) y
 * `scale.FIT` para pantalla completa (Opciones, punto 7). `BootScene`
 * (índice 0, auto-arranca) instancia `SceneFlowManager` y lanza `title`.
 */
async function bootstrap(): Promise<void> {
  await loadUiFonts();

  new Phaser.Game({
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    backgroundColor: "#0a0a0f",
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      // Fase 12f (Obs 7, fullscreen en negro): sin `parent`/`fullscreenTarget`
      // explícitos, Phaser inserta el canvas suelto en `<body>` y el elemento
      // que el navegador expande en fullscreen deja de coincidir con lo que
      // `FIT` recalcula. `#game-root` (game/index.html) tiene tamaño
      // explícito para servir de referencia estable en ambos casos.
      parent: "game-root",
      fullscreenTarget: "game-root",
    },
    scene: [
      BootScene,
      TitleScene,
      CreditsScene,
      ArchetypeSelectScene,
      CrewSelectScene,
      FloorplanScene,
      PauseMenuScene,
      OptionsScene,
      CrisisResultScene,
      CreativeHubScene,
      CreativeWorkbenchScene,
      ParticleGalleryScene,
    ],
    plugins: {
      scene: [{ key: "rexUI", plugin: RexUIPlugin, mapping: "rexUI" }],
    },
  });
}

void bootstrap();
