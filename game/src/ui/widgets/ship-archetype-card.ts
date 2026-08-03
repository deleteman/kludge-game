import Phaser from "phaser";
import type { ShipArchetype } from "engine";
import { UI_FONT_FAMILY } from "../fonts.js";
import { HEADER_COLOR, LABEL_COLOR, SELECTED_CELL_COLOR, CRISIS_SAFE_COLOR, CRISIS_FATAL_COLOR } from "../../render/palette.js";
import { hasShipImage, shipImageTextureKey } from "../../render/ship-image-registry.js";
import { UI_POINTER_CURSOR_CSS } from "../custom-cursor.js";
import { AUDIO_KEYS } from "../../audio/audio-asset-registry.js";
import { pickSoundKey } from "../../audio/audio-utils.js";
import { t } from "../../i18n/i18n.js";
import { SHIP_ARCHETYPE_METADATA } from "../../meta/ship-archetype-metadata.js";

const IMAGE_SIZE = 96;
const IMAGE_GRAY = 0x2a3040;
const CARD_PAD = 12;

export interface ShipArchetypeCardHandle {
  readonly container: Phaser.GameObjects.Container;
  readonly archetype: ShipArchetype;
  setSelected(selected: boolean): void;
}

/**
 * Tarjeta de selección de arquetipo de nave (Fase 12g): imagen exterior +
 * nombre propio + arquetipo + descripción + +/−, reutilizando `SHIP_ARCHETYPE_METADATA`
 * (claves i18n) y `ship-image-registry.ts` (imagen con fallback a placeholder
 * de color, convención CLAUDE.md). Mismo patrón de tarjeta que
 * `crew-select-card.ts` (12g), layout propio en vez de `createKenneyCardList`
 * porque necesita imagen + bloque de pros/cons, no solo swatch + texto.
 */
export function renderShipArchetypeCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  archetype: ShipArchetype,
  selected: boolean,
  onSelect: () => void,
): ShipArchetypeCardHandle {
  const container = scene.add.container(x, y);
  const meta = SHIP_ARCHETYPE_METADATA[archetype];

  const bg = scene.add
    .rectangle(0, 0, width, height, selected ? 0x16202c : 0x11151d, 0.92)
    .setOrigin(0, 0)
    .setStrokeStyle(selected ? 2 : 1, selected ? SELECTED_CELL_COLOR : 0x2a3040, 1);
  container.add(bg);

  const imageX = CARD_PAD;
  const imageY = CARD_PAD;
  if (hasShipImage(scene, archetype)) {
    const img = scene.add
      .image(imageX + IMAGE_SIZE / 2, imageY + IMAGE_SIZE / 2, shipImageTextureKey(archetype))
      .setOrigin(0.5)
      .setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
    container.add(img);
  } else {
    container.add(
      scene.add
        .rectangle(imageX + IMAGE_SIZE / 2, imageY + IMAGE_SIZE / 2, IMAGE_SIZE, IMAGE_SIZE, IMAGE_GRAY, 1)
        .setOrigin(0.5)
        .setStrokeStyle(1, 0x3a4050, 1),
    );
    container.add(
      scene.add
        .text(imageX + IMAGE_SIZE / 2, imageY + IMAGE_SIZE / 2, archetype, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "10px",
          color: "#6b7280",
          align: "center",
          wordWrap: { width: IMAGE_SIZE - 8 },
        })
        .setOrigin(0.5),
    );
  }

  const textX = imageX + IMAGE_SIZE + 12;
  const textWidth = width - textX - CARD_PAD;

  container.add(
    scene.add
      .text(textX, imageY, t(meta.properNameKey), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "16px",
        color: selected ? HEADER_COLOR : LABEL_COLOR,
        fontStyle: "bold",
      })
      .setOrigin(0, 0),
  );
  container.add(
    scene.add
      .text(textX, imageY + 22, t(`ship.${archetype}.name`), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "11px",
        color: "#8890a8",
      })
      .setOrigin(0, 0),
  );
  const descriptionY = imageY + 40;
  const descriptionText = scene.add
    .text(textX, descriptionY, t(meta.descriptionKey), {
      fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
      fontSize: "10px",
      color: LABEL_COLOR,
      wordWrap: { width: textWidth },
      lineSpacing: 2,
    })
    .setOrigin(0, 0);
  container.add(descriptionText);

  // Debajo de la descripción real (no un offset fijo): el texto varía de 2 a
  // 4 líneas según el arquetipo, un offset fijo dejaba pro/con superpuestos
  // con la última línea en las descripciones más largas (playtest 12g).
  // Pros/cons en una sola columna vertical (no dos columnas lado a lado):
  // una línea larga en español desbordaba la mitad del ancho y se superponía
  // con la columna de contras (mismo playtest).
  let proConY = descriptionY + descriptionText.height + 8;
  const proConColor = { pro: CRISIS_SAFE_COLOR, con: CRISIS_FATAL_COLOR };
  for (const [kind, keys] of [["pro", meta.proKeys] as const, ["con", meta.conKeys] as const]) {
    for (const key of keys) {
      const line = scene.add
        .text(textX, proConY, t(key), {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "10px",
          color: `#${proConColor[kind].toString(16).padStart(6, "0")}`,
          wordWrap: { width: textWidth },
          lineSpacing: 2,
        })
        .setOrigin(0, 0);
      container.add(line);
      proConY += line.height + 2;
    }
  }

  container.setSize(width, height);
  container.setInteractive({ hitArea: new Phaser.Geom.Rectangle(0, 0, width, height), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
  if (container.input) container.input.cursor = UI_POINTER_CURSOR_CSS;
  container
    .on("pointerover", () => bg.setFillStyle(selected ? 0x16202c : 0x161c28, 0.95))
    .on("pointerout", () => bg.setFillStyle(selected ? 0x16202c : 0x11151d, 0.92))
    .on("pointerdown", () => {
      scene.sound.play(pickSoundKey(AUDIO_KEYS.uiButtonClick), { volume: 0.4 });
      onSelect();
    });

  return {
    container,
    archetype,
    setSelected(next: boolean): void {
      bg.setFillStyle(next ? 0x16202c : 0x11151d, 0.92);
      bg.setStrokeStyle(next ? 2 : 1, next ? SELECTED_CELL_COLOR : 0x2a3040, 1);
    },
  };
}
