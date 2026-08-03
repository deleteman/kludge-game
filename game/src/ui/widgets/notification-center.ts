import type Phaser from "phaser";

import { UI_FONT_FAMILY } from "../fonts.js";
import {
  HEADER_COLOR,
  LABEL_COLOR,
  CRISIS_FATAL_COLOR,
  CRISIS_WARNING_COLOR,
  CRISIS_SAFE_COLOR,
  INFO_NEUTRAL_COLOR,
} from "../../render/palette.js";
import { RENDER_DEPTH } from "../../render/render-depths.js";
import { popIn } from "../ui-effects.js";
import { AUDIO_KEYS } from "../../audio/audio-asset-registry.js";
import { pickSoundKey } from "../../audio/audio-utils.js";

/**
 * Fase 12c.7 (obs #5): sistema de notificaciones transitorias unificado. Una
 * pila de "toasts" fija en pantalla (arriba-centro del área de mapa) que da
 * avisos legibles al jugador — reemplaza el patrón disperso de `setStatus` +
 * toasts de mundo + barks para los eventos que sí quieren un aviso claro.
 *
 * Cada notificación tiene un `type` que fija su color de acento y su sonido.
 * Es objeto de HUD (cámara fija): el llamador pasa `registerHud` para que la
 * escena la ignore en la cámara de mundo (mismo contrato que el resto del HUD).
 */
export type NotificationType = "info" | "success" | "warning" | "error";

export interface NotificationInput {
  readonly title: string;
  readonly lines?: ReadonlyArray<string>;
  readonly type?: NotificationType;
}

/** Acento por tipo — deriva del contrato de color de crisis (Fase 12e), no una tabla local paralela. */
const ACCENT_COLOR: Readonly<Record<NotificationType, number>> = {
  info: INFO_NEUTRAL_COLOR,
  success: CRISIS_SAFE_COLOR,
  warning: CRISIS_WARNING_COLOR,
  error: CRISIS_FATAL_COLOR,
};

/** Clave de sonido por tipo (`AUDIO_KEYS`) — feedback diegético coherente con 12b. */
const TYPE_SOUND: Readonly<Record<NotificationType, string | readonly string[]>> = {
  info: AUDIO_KEYS.uiButtonClick,
  success: AUDIO_KEYS.barkSuccess,
  warning: AUDIO_KEYS.barkUnstableSubstance,
  error: AUDIO_KEYS.barkFailureOrInjury,
};

const CARD_WIDTH = 320;
const CARD_GAP = 8;
const PAD = 10;
const ACCENT_W = 4;
const MAX_ACTIVE = 4;

interface ActiveCard {
  readonly container: Phaser.GameObjects.Container;
  readonly height: number;
  timer?: Phaser.Time.TimerEvent;
}

export class NotificationCenter {
  private readonly active: ActiveCard[] = [];

  /**
   * @param anchorX centro X de la pila (coords de pantalla).
   * @param topY    tope Y de la primera tarjeta.
   * @param registerHud registra un objeto como HUD (lo ignora la cámara de mundo).
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly anchorX: number,
    private readonly topY: number,
    private readonly registerHud: (obj: Phaser.GameObjects.GameObject) => void,
  ) {}

  /** Encola una notificación: la dibuja, suena, y la auto-descarta tras un tiempo escalado por su largo. */
  push(input: NotificationInput): void {
    const type = input.type ?? "info";
    const { container, height } = this.buildCard(input, type);
    container.setDepth(RENDER_DEPTH.notification);
    this.registerHud(container);
    this.scene.sound.play(pickSoundKey(TYPE_SOUND[type]), { volume: 0.5 });

    const card: ActiveCard = { container, height };
    this.active.push(card);
    // Cap de tarjetas concurrentes: la más vieja se va antes.
    if (this.active.length > MAX_ACTIVE) this.dismiss(this.active[0]!);

    this.reflow();
    popIn(this.scene, container as unknown as Parameters<typeof popIn>[1]);

    const lifeMs = 2600 + (input.lines?.length ?? 0) * 500;
    card.timer = this.scene.time.delayedCall(lifeMs, () => this.dismiss(card));
  }

  /** Descarta una tarjeta con fade+desplazamiento y reacomoda el resto. */
  private dismiss(card: ActiveCard): void {
    const index = this.active.indexOf(card);
    if (index === -1) return;
    this.active.splice(index, 1);
    card.timer?.remove();
    this.scene.tweens.add({
      targets: card.container,
      alpha: 0,
      x: card.container.x + 24,
      duration: 220,
      ease: "Quad.easeIn",
      onComplete: () => card.container.destroy(),
    });
    this.reflow();
  }

  /** Reposiciona la pila: cada tarjeta bajo la anterior, con transición suave. */
  private reflow(): void {
    let y = this.topY;
    for (const card of this.active) {
      this.scene.tweens.add({ targets: card.container, y, duration: 160, ease: "Quad.easeOut" });
      y += card.height + CARD_GAP;
    }
  }

  private buildCard(
    input: NotificationInput,
    type: NotificationType,
  ): { container: Phaser.GameObjects.Container; height: number } {
    const scene = this.scene;
    const textLeft = -CARD_WIDTH / 2 + ACCENT_W + PAD;
    const textWidth = CARD_WIDTH - ACCENT_W - PAD * 2;

    const title = scene.add
      .text(textLeft, PAD, input.title, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "13px",
        color: HEADER_COLOR,
        fontStyle: "bold",
        wordWrap: { width: textWidth },
      })
      .setOrigin(0, 0);

    let bodyBottom = PAD + title.height;
    const lineTexts: Phaser.GameObjects.Text[] = [];
    if (input.lines && input.lines.length > 0) {
      const body = scene.add
        .text(textLeft, bodyBottom + 4, input.lines.join("\n"), {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "11px",
          color: LABEL_COLOR,
          wordWrap: { width: textWidth },
          lineSpacing: 2,
        })
        .setOrigin(0, 0);
      bodyBottom = bodyBottom + 4 + body.height;
      lineTexts.push(body);
    }

    const height = bodyBottom + PAD;

    const bg = scene.add
      .rectangle(0, 0, CARD_WIDTH, height, 0x0d1420, 0.94)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, 0x2a3346, 1);
    const accent = scene.add
      .rectangle(-CARD_WIDTH / 2, 0, ACCENT_W, height, ACCENT_COLOR[type], 1)
      .setOrigin(0, 0);

    const container = scene.add.container(this.anchorX, this.topY, [bg, accent, title, ...lineTexts]);
    return { container, height };
  }
}
