import type Phaser from "phaser";

import forceField000Url from "../../assets/audio/gameplay/forceField_000.ogg?url";
import forceField001Url from "../../assets/audio/gameplay/forceField_001.ogg?url";
import explosionCrunch000Url from "../../assets/audio/gameplay/explosionCrunch_000.ogg?url";
import explosionCrunch001Url from "../../assets/audio/gameplay/explosionCrunch_001.ogg?url";
import lowFrequencyExplosion000Url from "../../assets/audio/gameplay/lowFrequency_explosion_000.ogg?url";
import lowFrequencyExplosion001Url from "../../assets/audio/gameplay/lowFrequency_explosion_001.ogg?url";
import slime000Url from "../../assets/audio/gameplay/slime_000.ogg?url";
import slime001Url from "../../assets/audio/gameplay/slime_001.ogg?url";
import engineCircular000Url from "../../assets/audio/gameplay/engineCircular_000.ogg?url";
import impactMetal000Url from "../../assets/audio/gameplay/impactMetal_000.ogg?url";
import impactMetal001Url from "../../assets/audio/gameplay/impactMetal_001.ogg?url";
import impactMetal002Url from "../../assets/audio/gameplay/impactMetal_002.ogg?url";
import impactMetal003Url from "../../assets/audio/gameplay/impactMetal_003.ogg?url";
import impactMetal004Url from "../../assets/audio/gameplay/impactMetal_004.ogg?url";
import computerNoise002Url from "../../assets/audio/gameplay/computerNoise_002.ogg?url";
import computerNoise003Url from "../../assets/audio/gameplay/computerNoise_003.ogg?url";

import tick001Url from "../../assets/audio/UI/tick_001.ogg?url";
import tick002Url from "../../assets/audio/UI/tick_002.ogg?url";
import confirmation001Url from "../../assets/audio/UI/confirmation_001.ogg?url";
import confirmation002Url from "../../assets/audio/UI/confirmation_002.ogg?url";
import error001Url from "../../assets/audio/UI/error_001.ogg?url";
import error002Url from "../../assets/audio/UI/error_002.ogg?url";
import glitch001Url from "../../assets/audio/UI/glitch_001.ogg?url";
import glitch002Url from "../../assets/audio/UI/glitch_002.ogg?url";
import question001Url from "../../assets/audio/UI/question_001.ogg?url";
import question002Url from "../../assets/audio/UI/question_002.ogg?url";
import click001Url from "../../assets/audio/UI/click_001.ogg?url";
import click002Url from "../../assets/audio/UI/click_002.ogg?url";
import pluck001Url from "../../assets/audio/UI/pluck_001.ogg?url";
import pluck002Url from "../../assets/audio/UI/pluck_002.ogg?url";
import select001Url from "../../assets/audio/UI/select_001.ogg?url";
import select002Url from "../../assets/audio/UI/select_002.ogg?url";
import open001Url from "../../assets/audio/UI/open_001.ogg?url";
import open002Url from "../../assets/audio/UI/open_002.ogg?url";
import close001Url from "../../assets/audio/UI/close_001.ogg?url";
import close002Url from "../../assets/audio/UI/close_002.ogg?url";

/**
 * Pack de audio colocado por el operador en `game/assets/audio/` (Subfase
 * 12b): `gameplay/` para fenómenos del motor, `UI/` para blips de UI y de
 * bark. Mismo patrón que `particle-texture-registry.ts`/`ui-asset-registry.ts`:
 * se importan solo las variantes efectivamente usadas (no las ~230 del pack
 * completo), tabla `key → URL`, precarga única vía `preloadAudioAssets`.
 *
 * `voices/Female|Male/` (clips de voz en inglés) queda SIN USAR — no
 * corresponde a las líneas de bark ya escritas en `engine/src/crew/bark-bank.ts`
 * (idioma/contenido no coinciden). El pack tampoco tiene sonido de "fuga de
 * gas" (siseo), "zumbido eléctrico continuo", "sirena de alarma" ni "paso
 * sobre piso metálico" dedicados — aproximaciones usadas en su lugar:
 * `gasLeakAmbient` (loop de motor grave), `alarm` (klaxon de computadora),
 * `footstep` (impacto metálico grave/corto). Señalado explícitamente como gap
 * de asset (CLAUDE.md: "cuando falte un sprite... avisar explícitamente").
 */
export const AUDIO_KEYS = {
  overloadCut: ["sfx-force-field-0", "sfx-force-field-1"],
  overloadFire: ["sfx-explosion-crunch-0", "sfx-explosion-crunch-1"],
  overloadExplosion: ["sfx-low-freq-explosion-0", "sfx-low-freq-explosion-1"],
  combustion: ["sfx-explosion-crunch-0", "sfx-explosion-crunch-1"],
  corrosion: ["sfx-slime-0", "sfx-slime-1"],
  gasLeakAmbient: "sfx-engine-circular-0",
  alarm: ["sfx-computer-noise-2", "sfx-computer-noise-3"],
  install: ["sfx-impact-metal-0", "sfx-impact-metal-1"],
  footstep: ["sfx-impact-metal-2", "sfx-impact-metal-3", "sfx-impact-metal-4"],
  barkCrisisOrDanger: ["sfx-ui-tick-0", "sfx-ui-tick-1"],
  barkSuccess: ["sfx-ui-confirmation-0", "sfx-ui-confirmation-1"],
  barkFailureOrInjury: ["sfx-ui-error-0", "sfx-ui-error-1"],
  barkCrewDeath: ["sfx-ui-glitch-0", "sfx-ui-glitch-1"],
  barkUnstableSubstance: ["sfx-ui-question-0", "sfx-ui-question-1"],
  /** Acción rechazada por la UI (Fase 13b: arrastrar el slider de energía más allá de lo disponible). Reusa los assets de error ya cargados. */
  uiDenied: ["sfx-ui-error-0", "sfx-ui-error-1"],
  uiButtonHover: ["sfx-ui-pluck-0", "sfx-ui-pluck-1"],
  uiButtonClick: ["sfx-ui-click-0", "sfx-ui-click-1"],
  mapCellSelect: ["sfx-ui-select-0", "sfx-ui-select-1"],
  modalOpen: ["sfx-ui-open-0", "sfx-ui-open-1"],
  modalClose: ["sfx-ui-close-0", "sfx-ui-close-1"],
} as const;

const AUDIO_URLS: Readonly<Record<string, string>> = {
  "sfx-force-field-0": forceField000Url,
  "sfx-force-field-1": forceField001Url,
  "sfx-explosion-crunch-0": explosionCrunch000Url,
  "sfx-explosion-crunch-1": explosionCrunch001Url,
  "sfx-low-freq-explosion-0": lowFrequencyExplosion000Url,
  "sfx-low-freq-explosion-1": lowFrequencyExplosion001Url,
  "sfx-slime-0": slime000Url,
  "sfx-slime-1": slime001Url,
  "sfx-engine-circular-0": engineCircular000Url,
  "sfx-impact-metal-0": impactMetal000Url,
  "sfx-impact-metal-1": impactMetal001Url,
  "sfx-impact-metal-2": impactMetal002Url,
  "sfx-impact-metal-3": impactMetal003Url,
  "sfx-impact-metal-4": impactMetal004Url,
  "sfx-computer-noise-2": computerNoise002Url,
  "sfx-computer-noise-3": computerNoise003Url,
  "sfx-ui-tick-0": tick001Url,
  "sfx-ui-tick-1": tick002Url,
  "sfx-ui-confirmation-0": confirmation001Url,
  "sfx-ui-confirmation-1": confirmation002Url,
  "sfx-ui-error-0": error001Url,
  "sfx-ui-error-1": error002Url,
  "sfx-ui-glitch-0": glitch001Url,
  "sfx-ui-glitch-1": glitch002Url,
  "sfx-ui-question-0": question001Url,
  "sfx-ui-question-1": question002Url,
  "sfx-ui-click-0": click001Url,
  "sfx-ui-click-1": click002Url,
  "sfx-ui-pluck-0": pluck001Url,
  "sfx-ui-pluck-1": pluck002Url,
  "sfx-ui-select-0": select001Url,
  "sfx-ui-select-1": select002Url,
  "sfx-ui-open-0": open001Url,
  "sfx-ui-open-1": open002Url,
  "sfx-ui-close-0": close001Url,
  "sfx-ui-close-1": close002Url,
};

export function preloadAudioAssets(scene: Phaser.Scene): void {
  for (const [key, url] of Object.entries(AUDIO_URLS)) {
    scene.load.audio(key, url);
  }
}
