import Phaser from "phaser";
import { t, setLocale, getLocale } from "../i18n/i18n.js";
import type { Locale } from "../i18n/i18n.js";
import { preloadUiAssets } from "../ui/ui-asset-registry.js";
import { preloadAudioAssets } from "../audio/audio-asset-registry.js";
import { createKenneyButton } from "../ui/widgets/kenney-button.js";
import { createKenneyPanel } from "../ui/widgets/kenney-panel.js";
import { createKenneySlider, type KenneySliderHandle } from "../ui/widgets/kenney-slider.js";
import { metaGameStateMachine } from "../meta/meta-game.js";
import type { MetaGameState } from "../meta/meta-game-state.js";
import { loadSettings, saveSettings } from "../meta/save-adapter.js";
import { DEFAULT_SETTINGS } from "../meta/game-settings.types.js";
import {
  getCrtIntensity,
  getFlickerIntensity,
  hydrateCrtSettings,
  setCrtIntensity,
  setFlickerIntensity,
} from "../render/crt-settings.js";
import { SCENE_KEYS } from "../meta/scene-keys.js";
import type { SceneWithRexUI } from "../ui/scene-with-rex-ui.types.js";

interface OptionsSceneData {
  readonly returnTo: MetaGameState;
}

/**
 * Opciones (Fase 9.5, punto 7): idioma, pantalla completa, controles.
 * Persisten entre sesiones vía `kludgeSettings` (decisión confirmada con el
 * operador). Se lanza como overlay desde `title` o `paused` — `init(data)`
 * recibe a dónde volver (`scene-flow-manager.ts` lo pasa en el `launch`).
 */
export class OptionsScene extends Phaser.Scene {
  private returnTo: MetaGameState = "title";

  constructor() {
    super(SCENE_KEYS.options);
  }

  init(data: OptionsSceneData): void {
    this.returnTo = data.returnTo;
  }

  preload(): void {
    preloadUiAssets(this);
    preloadAudioAssets(this);
  }

  create(): void {
    const self = this as unknown as SceneWithRexUI;
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.5);
    createKenneyPanel(this, 640, 360, 460, 420, t("ui.menu.options.header"));

    let currentLocale: Locale = getLocale();
    void loadSettings().then((settings) => {
      currentLocale = settings.locale;
      setLocale(currentLocale);
      localeButtonLabel?.setText(currentLocale.toUpperCase());
      fullscreenButtonLabel?.setText(settings.fullscreen ? t("ui.menu.options.on") : t("ui.menu.options.off"));
      isFullscreenPreference = settings.fullscreen;
      // Siembra el store vivo del CRT y refleja los valores en los sliders.
      hydrateCrtSettings(settings);
      crtSlider.setValue(settings.crtIntensity);
      flickerSlider.setValue(settings.flickerIntensity);
    });

    let isFullscreenPreference = DEFAULT_SETTINGS.fullscreen;

    this.add
      .text(500, 250, t("ui.menu.options.language"), { fontSize: "14px", color: "#d8dce8" })
      .setOrigin(0, 0.5);
    const localeButton = createKenneyButton(self, 760, 250, currentLocale.toUpperCase(), {
      width: 140,
      height: 34,
      onClick: () => {
        currentLocale = currentLocale === "es" ? "en" : "es";
        setLocale(currentLocale);
        localeButtonLabel?.setText(currentLocale.toUpperCase());
      },
    });
    const localeButtonLabel = localeButton.getElement("text") as Phaser.GameObjects.Text | undefined;

    this.add
      .text(500, 300, t("ui.menu.options.fullscreen"), { fontSize: "14px", color: "#d8dce8" })
      .setOrigin(0, 0.5);
    const fullscreenButton = createKenneyButton(
      self,
      760,
      300,
      isFullscreenPreference ? t("ui.menu.options.on") : t("ui.menu.options.off"),
      {
        width: 140,
        height: 34,
        onClick: () => {
          isFullscreenPreference = !isFullscreenPreference;
          this.scale.toggleFullscreen();
          fullscreenButtonLabel?.setText(
            isFullscreenPreference ? t("ui.menu.options.on") : t("ui.menu.options.off"),
          );
        },
      },
    );
    const fullscreenButtonLabel = fullscreenButton.getElement("text") as Phaser.GameObjects.Text | undefined;

    // Accesibilidad CRT (12c.4): dos sliders separados. El estético
    // (`crtIntensity`) y el de parpadeo/fallo (`flickerIntensity`) — este último
    // a 0 protege a jugadores fotosensibles sin apagar la estética CRT. Ambos
    // actualizan el store vivo al arrastrar (efecto visible al instante en el
    // plano si está activo) y se persisten al pulsar "Volver".
    this.add
      .text(500, 350, t("ui.menu.options.crt-intensity"), { fontSize: "14px", color: "#d8dce8" })
      .setOrigin(0, 0.5);
    const crtSlider: KenneySliderHandle = createKenneySlider(this, 760, 350, {
      width: 150,
      value: getCrtIntensity(),
      onChange: (v) => setCrtIntensity(v),
    });

    this.add
      .text(500, 400, t("ui.menu.options.flicker-intensity"), { fontSize: "14px", color: "#d8dce8" })
      .setOrigin(0, 0.5);
    const flickerSlider: KenneySliderHandle = createKenneySlider(this, 760, 400, {
      width: 150,
      value: getFlickerIntensity(),
      onChange: (v) => setFlickerIntensity(v),
    });

    createKenneyButton(self, 640, 500, t("ui.menu.options.back"), {
      width: 260,
      onClick: () => {
        void saveSettings({
          locale: currentLocale,
          fullscreen: isFullscreenPreference,
          crtIntensity: getCrtIntensity(),
          flickerIntensity: getFlickerIntensity(),
        }).then(() => {
          metaGameStateMachine.transition(this.returnTo);
        });
      },
    });
  }
}
