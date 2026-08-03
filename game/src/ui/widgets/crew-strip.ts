import type Phaser from "phaser";
import type { CrewActor, CrewActorId } from "engine";
import { UI_FONT_FAMILY } from "../fonts.js";
import {
  CREW_TOKEN_COLORS,
  HEADER_COLOR,
  LABEL_COLOR,
  SELECTED_CELL_COLOR,
  healthFractionColor,
} from "../../render/palette.js";
import { crewPortraitSlug, crewPortraitTextureKey, hasCrewPortrait } from "../../render/crew-portrait-registry.js";

/** Gris de retrato NO seleccionado (placeholder; con sprite real es el grayscale FX). */
const PORTRAIT_GRAY = 0x555a66;
const PORTRAIT_SIZE = 72;
const HP_BAR_HEIGHT = 7;
const HP_BAR_TRACK_COLOR = 0x1a2030;
const CARD_GAP = 16;
const CARD_PAD = 8;
/** Ancho de la franja de identidad de color a la izquierda de cada tarjeta (mismo color que el token del mapa). */
const IDENTITY_BAR_WIDTH = 6;
const TEXT_BLOCK_WIDTH = 108;
const INNER_GAP = 8;
const CARD_WIDTH = CARD_PAD * 2 + PORTRAIT_SIZE + INNER_GAP + TEXT_BLOCK_WIDTH;

export interface CrewStripCardHit {
  readonly xMin: number;
  readonly xMax: number;
  readonly actorId: CrewActorId;
}

/** Objeto del retrato (imagen real o rectángulo placeholder) — centrado en origin 0.5 para poder sacudirlo/rotarlo (12c.2). */
export type CrewPortraitObject = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

export interface CrewStripHandle {
  readonly container: Phaser.GameObjects.Container;
  readonly cardHitAreas: ReadonlyArray<CrewStripCardHit>;
  /** Retrato por tripulante, para que la escena le aplique reacciones de daño/muerte (12c.2). */
  readonly portraits: ReadonlyMap<CrewActorId, CrewPortraitObject>;
}

/**
 * Tinte multiplicativo del retrato según fracción de vida (12c.2): blanco (sin
 * tinte) con vida llena, virando a rojo apagado a medida que baja. Es un
 * reflejo EN REPOSO del estado de salud, redibujado con el HP vivo en cada
 * `renderCrewStrip` — no depende de ningún tween, así que sobrevive al rebuild.
 */
function healthTint(fraction: number): number {
  const f = Math.max(0, Math.min(1, fraction));
  if (f >= 0.999) return 0xffffff;
  // Interpola G y B hacia abajo (deja R alto) → el retrato se enrojece al herirse.
  const g = Math.round(0x66 + (0xff - 0x66) * f);
  const b = Math.round(0x5a + (0xff - 0x5a) * f);
  return (0xff << 16) | (g << 8) | b;
}

/** Multiplica un color base por un tinte (ambos 0xRRGGBB), canal a canal — para el placeholder que no admite `setTint`. */
function tintColor(base: number, tint: number): number {
  const r = Math.round((((base >> 16) & 0xff) * ((tint >> 16) & 0xff)) / 0xff);
  const g = Math.round((((base >> 8) & 0xff) * ((tint >> 8) & 0xff)) / 0xff);
  const b = Math.round(((base & 0xff) * (tint & 0xff)) / 0xff);
  return (r << 16) | (g << 8) | b;
}

/**
 * Tira horizontal de tripulantes bajo el mapa (playtest #16b). Cada TARJETA:
 * retrato a la IZQUIERDA, a la derecha el nombre (arriba) y el rol (debajo del
 * nombre). Cada tarjeta con su caja/borde y separación (`CARD_GAP`) para que no
 * se toquen ni se solape el rol con la vecina.
 *
 * El tripulante SELECCIONADO muestra el retrato en COLOR; los demás en GRIS
 * (grayscale FX si hay sprite real, gris manual si es placeholder). El borde
 * verde marca la tarjeta seleccionada.
 *
 * INPUT DETERMINISTA: el widget SOLO dibuja objetos planos de Phaser y expone
 * `cardHitAreas` (rangos de x en pantalla). La selección la resuelve la escena
 * con hit-testing a nivel de puntero (mismo mecanismo del click de mapa).
 *
 * Retratos: un PNG por tripulante en `game/assets/sprites/crew/<slug>.png`
 * (slug = nombre en minúscula sin acentos, ver `crew-portrait-registry.ts`).
 */
export function renderCrewStrip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  crew: ReadonlyArray<CrewActor>,
  selectedActorId: CrewActorId | undefined,
): CrewStripHandle {
  const container = scene.add.container(0, 0);

  // Caja de fondo de la tira.
  container.add(
    scene.add.rectangle(x, y, width, height, 0x0a0a0f, 0.72).setOrigin(0, 0).setStrokeStyle(1, 0x2a3040, 1),
  );

  const cardHitAreas: CrewStripCardHit[] = [];
  const portraits = new Map<CrewActorId, CrewPortraitObject>();
  const startX = x + 10;
  const cardHeight = height - 16;
  const cardTop = y + 8;

  crew.forEach((actor, index) => {
    const color = CREW_TOKEN_COLORS[index % CREW_TOKEN_COLORS.length]!;
    const selected = actor.id === selectedActorId;
    const cardX = startX + index * (CARD_WIDTH + CARD_GAP);
    const hpFraction = actor.maxHp > 0 ? Math.max(0, Math.min(1, actor.hp / actor.maxHp)) : 0;

    // Caja de la tarjeta (separación visual entre tripulantes).
    container.add(
      scene.add
        .rectangle(cardX, cardTop, CARD_WIDTH, cardHeight, selected ? 0x16202c : 0x11151d, 0.9)
        .setOrigin(0, 0)
        .setStrokeStyle(selected ? 2 : 1, selected ? SELECTED_CELL_COLOR : 0x2a3040, 1),
    );

    // Franja de identidad de color en el borde izquierdo: SIEMPRE visible (no
    // depende de la selección), con el MISMO color que el token del mapa
    // (`CREW_TOKEN_COLORS[index]`), para saber de un vistazo qué tarjeta es qué
    // tripulante — el retrato genérico gris no lo distingue por sí solo.
    container.add(
      scene.add.rectangle(cardX, cardTop, IDENTITY_BAR_WIDTH, cardHeight, color, 1).setOrigin(0, 0),
    );

    // Retrato a la izquierda (centrado verticalmente en la tarjeta). Centrado en
    // origin 0.5 (12c.2): así la escena puede sacudirlo/rotarlo/escalarlo ante el
    // daño sin que el pivote quede en la esquina.
    const portraitX = cardX + CARD_PAD;
    const portraitY = cardTop + (cardHeight - PORTRAIT_SIZE) / 2;
    const portraitCX = portraitX + PORTRAIT_SIZE / 2;
    const portraitCY = portraitY + PORTRAIT_SIZE / 2;
    // Tinte multiplicativo de salud (12c.2): blanco lleno → rojo apagado herido.
    const tint = healthTint(hpFraction);
    if (hasCrewPortrait(scene, actor.name)) {
      const key = crewPortraitTextureKey(crewPortraitSlug(actor.name));
      const img = scene.add.image(portraitCX, portraitCY, key).setOrigin(0.5).setDisplaySize(PORTRAIT_SIZE, PORTRAIT_SIZE);
      // Gris cuando NO está seleccionado (Phaser 3.90 preFX ColorMatrix); color
      // cuando sí. `preFX` es null bajo renderer Canvas → el `?.` degrada a color.
      if (!selected) img.preFX?.addColorMatrix().grayscale(1);
      if (tint !== 0xffffff) img.setTint(tint);
      container.add(img);
      portraits.set(actor.id, img);
      // Borde del retrato para recortarlo visualmente del fondo de la tarjeta.
      container.add(
        scene.add
          .rectangle(portraitX, portraitY, PORTRAIT_SIZE, PORTRAIT_SIZE)
          .setOrigin(0, 0)
          .setStrokeStyle(selected ? 2 : 1, selected ? SELECTED_CELL_COLOR : 0x2a3040, 1),
      );
    } else {
      // Placeholder: color del tripulante si está seleccionado, gris si no; el
      // tinte de salud se aplica multiplicando el color base.
      const baseColor = selected ? color : PORTRAIT_GRAY;
      const rect = scene.add
        .rectangle(portraitCX, portraitCY, PORTRAIT_SIZE, PORTRAIT_SIZE, tintColor(baseColor, tint), 1)
        .setOrigin(0.5)
        .setStrokeStyle(selected ? 2 : 1, selected ? SELECTED_CELL_COLOR : 0x2a3040, 1);
      container.add(rect);
      portraits.set(actor.id, rect);
    }

    // Bloque de texto a la derecha: nombre arriba, rol debajo.
    const textX = portraitX + PORTRAIT_SIZE + INNER_GAP;
    container.add(
      scene.add
        .text(textX, portraitY + 6, actor.name, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "13px",
          color: selected ? HEADER_COLOR : LABEL_COLOR,
          fontStyle: selected ? "bold" : "normal",
        })
        .setOrigin(0, 0),
    );
    container.add(
      scene.add
        .text(textX, portraitY + 26, `${actor.specialty}\n(${actor.tier})`, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "10px",
          color: selected ? LABEL_COLOR : "#8890a8",
          wordWrap: { width: TEXT_BLOCK_WIDTH },
          lineSpacing: 2,
        })
        .setOrigin(0, 0),
    );

    // Barra de HP al pie del bloque de texto: pista oscura + relleno coloreado por
    // fracción de vida, con la cifra `hp/maxHp` encima. Refleja el daño en vivo
    // cuando la escena redibuja la tira tras un evento `crew-damaged`.
    const hpBarY = cardTop + cardHeight - CARD_PAD - HP_BAR_HEIGHT;
    container.add(
      scene.add.rectangle(textX, hpBarY, TEXT_BLOCK_WIDTH, HP_BAR_HEIGHT, HP_BAR_TRACK_COLOR, 1).setOrigin(0, 0),
    );
    if (hpFraction > 0) {
      container.add(
        scene.add
          .rectangle(textX, hpBarY, TEXT_BLOCK_WIDTH * hpFraction, HP_BAR_HEIGHT, healthFractionColor(hpFraction), 1)
          .setOrigin(0, 0),
      );
    }
    container.add(
      scene.add
        .text(textX + TEXT_BLOCK_WIDTH, hpBarY - 12, `${Math.round(actor.hp)}/${actor.maxHp}`, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "9px",
          color: "#8890a8",
        })
        .setOrigin(1, 0),
    );

    cardHitAreas.push({ xMin: cardX, xMax: cardX + CARD_WIDTH, actorId: actor.id });
  });

  return { container, cardHitAreas, portraits };
}
