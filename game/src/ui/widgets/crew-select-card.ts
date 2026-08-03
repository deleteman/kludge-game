import Phaser from "phaser";
import type { CrewActor, CrewActorId } from "engine";
import { UI_FONT_FAMILY } from "../fonts.js";
import { HEADER_COLOR, LABEL_COLOR, SELECTED_CELL_COLOR, CREW_TOKEN_COLORS } from "../../render/palette.js";
import { crewPortraitSlug, crewPortraitTextureKey, hasCrewPortrait } from "../../render/crew-portrait-registry.js";
import { UI_POINTER_CURSOR_CSS } from "../custom-cursor.js";
import { AUDIO_KEYS } from "../../audio/audio-asset-registry.js";
import { pickSoundKey } from "../../audio/audio-utils.js";
import { t } from "../../i18n/i18n.js";

const PORTRAIT_SIZE = 88;
const PORTRAIT_GRAY = 0x555a66;
const CARD_PAD = 12;

export interface CrewSelectCardHandle {
  readonly container: Phaser.GameObjects.Container;
  readonly actorId: CrewActorId;
  setSelected(selected: boolean): void;
}

/** Multiplica un color base por un tinte (0xRRGGBB), canal a canal — placeholder sin sprite real. */
function tintColor(base: number, tint: number): number {
  const r = Math.round((((base >> 16) & 0xff) * ((tint >> 16) & 0xff)) / 0xff);
  const g = Math.round((((base >> 8) & 0xff) * ((tint >> 8) & 0xff)) / 0xff);
  const b = Math.round(((base & 0xff) * (tint & 0xff)) / 0xff);
  return (r << 16) | (g << 8) | b;
}

/**
 * Tarjeta de selección de tripulante (Fase 12g): retrato + nombre + rol/tier +
 * rasgo de personalidad + descripción, reutilizando el mismo registro de
 * retratos que `crew-strip.ts` (Fase 10b) pero sin barra de HP (no aplica
 * antes de embarcar) y con bloque de descripción — layout distinto (tarjeta
 * vertical de grilla, no tira horizontal), por eso es un widget propio en vez
 * de una opción de `renderCrewStrip`.
 */
export function renderCrewSelectCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  actor: CrewActor,
  colorIndex: number,
  selected: boolean,
  onToggle: () => void,
): CrewSelectCardHandle {
  const container = scene.add.container(x, y);
  const identityColor = CREW_TOKEN_COLORS[colorIndex % CREW_TOKEN_COLORS.length]!;

  const bg = scene.add
    .rectangle(0, 0, width, height, selected ? 0x16202c : 0x11151d, 0.92)
    .setOrigin(0, 0)
    .setStrokeStyle(selected ? 2 : 1, selected ? SELECTED_CELL_COLOR : 0x2a3040, 1);
  container.add(bg);

  container.add(scene.add.rectangle(0, 0, 5, height, identityColor, 1).setOrigin(0, 0));

  const portraitX = CARD_PAD;
  const portraitY = CARD_PAD;
  const slug = crewPortraitSlug(actor.name);
  if (hasCrewPortrait(scene, actor.name)) {
    const key = crewPortraitTextureKey(slug);
    const img = scene.add
      .image(portraitX + PORTRAIT_SIZE / 2, portraitY + PORTRAIT_SIZE / 2, key)
      .setOrigin(0.5)
      .setDisplaySize(PORTRAIT_SIZE, PORTRAIT_SIZE);
    if (!selected) img.preFX?.addColorMatrix().grayscale(1);
    container.add(img);
  } else {
    container.add(
      scene.add
        .rectangle(
          portraitX + PORTRAIT_SIZE / 2,
          portraitY + PORTRAIT_SIZE / 2,
          PORTRAIT_SIZE,
          PORTRAIT_SIZE,
          selected ? tintColor(identityColor, 0xffffff) : PORTRAIT_GRAY,
          1,
        )
        .setOrigin(0.5)
        .setStrokeStyle(1, 0x2a3040, 1),
    );
  }

  const textX = portraitX + PORTRAIT_SIZE + 12;
  const textWidth = width - textX - CARD_PAD;

  container.add(
    scene.add
      .text(textX, portraitY, actor.name, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "16px",
        color: selected ? HEADER_COLOR : LABEL_COLOR,
        fontStyle: "bold",
      })
      .setOrigin(0, 0),
  );
  container.add(
    scene.add
      .text(textX, portraitY + 22, `${t(`crew.specialty.${actor.specialty}`)} · ${t(`crew.tier.${actor.tier}`)}`, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "11px",
        color: "#8890a8",
      })
      .setOrigin(0, 0),
  );
  container.add(
    scene.add
      .text(textX, portraitY + 40, t(`crew.trait.${actor.trait}`), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "11px",
        color: "#8890a8",
        fontStyle: "italic",
      })
      .setOrigin(0, 0),
  );
  container.add(
    scene.add
      .text(textX, portraitY + 60, t(`crew.${slug}.description`), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "10px",
        color: LABEL_COLOR,
        wordWrap: { width: textWidth },
        lineSpacing: 2,
      })
      .setOrigin(0, 0),
  );

  container.setSize(width, height);
  container.setInteractive({ useHandCursor: false, hitArea: new Phaser.Geom.Rectangle(0, 0, width, height), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
  if (container.input) container.input.cursor = UI_POINTER_CURSOR_CSS;
  container
    .on("pointerover", () => bg.setFillStyle(selected ? 0x16202c : 0x161c28, 0.95))
    .on("pointerout", () => bg.setFillStyle(selected ? 0x16202c : 0x11151d, 0.92))
    .on("pointerdown", () => {
      scene.sound.play(pickSoundKey(AUDIO_KEYS.uiButtonClick), { volume: 0.4 });
      onToggle();
    });

  return {
    container,
    actorId: actor.id,
    setSelected(next: boolean): void {
      bg.setFillStyle(next ? 0x16202c : 0x11151d, 0.92);
      bg.setStrokeStyle(next ? 2 : 1, next ? SELECTED_CELL_COLOR : 0x2a3040, 1);
    },
  };
}
