import Phaser from "phaser";
import { t } from "../i18n/i18n.js";
import { preloadUiAssets } from "../ui/ui-asset-registry.js";
import { createKenneyButton } from "../ui/widgets/kenney-button.js";
import { createKenneyPanel } from "../ui/widgets/kenney-panel.js";
import { metaGameStateMachine } from "../meta/meta-game.js";
import { campaignSession } from "../meta/campaign-session.js";
import { takePendingCrisisOutcome } from "../meta/crisis-outcome.js";
import type { CrisisOutcomeKind } from "../meta/crisis-outcome.js";
import { SCENE_KEYS } from "../meta/scene-keys.js";
import { HEADER_COLOR, LABEL_COLOR } from "../render/palette.js";
import type { SceneWithRexUI } from "../ui/scene-with-rex-ui.types.js";

const HEADER_KEY_BY_KIND: Readonly<Record<CrisisOutcomeKind, string>> = {
  success: "ui.menu.crisis-result.header-success",
  failure: "ui.menu.crisis-result.header-failure",
  partial: "ui.menu.crisis-result.header-partial",
};

/**
 * Resultado de crisis (Fase 9.5, punto 6): éxito/fallo/parcial + resumen +
 * transición. Consume el outcome REAL de la resolución de la crisis, que
 * `floorplan-scene.ts` guarda (`setPendingCrisisOutcome`) al recibir
 * `crisis-resolved` antes de transicionar (Fase 10e). Ya no hay disparador de
 * dev: si se llega sin outcome pendiente, se vuelve al título.
 */
export class CrisisResultScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.crisisResult);
  }

  preload(): void {
    preloadUiAssets(this);
  }

  create(): void {
    const self = this as unknown as SceneWithRexUI;
    const save = campaignSession.current;

    if (!save) {
      // Sin partida activa (llegada fuera de flujo) — vuelve al título sin crashear.
      metaGameStateMachine.transition("title");
      return;
    }

    // Outcome REAL de la resolución (guardado por `floorplan-scene.ts` antes de
    // transicionar). Sin outcome pendiente = llegada fuera de flujo → al título.
    const outcome = takePendingCrisisOutcome();
    if (!outcome) {
      metaGameStateMachine.transition("title");
      return;
    }

    this.add
      .text(640, 90, t(HEADER_KEY_BY_KIND[outcome.kind]), {
        fontFamily: "sans-serif",
        fontSize: "30px",
        color: HEADER_COLOR,
      })
      .setOrigin(0.5);

    createKenneyPanel(this, 640, 320, 520, 300);
    this.add
      .text(640, 200, outcome.summaryLines.join("\n"), {
        fontSize: "16px",
        color: LABEL_COLOR,
        align: "center",
        lineSpacing: 8,
      })
      .setOrigin(0.5, 0);

    createKenneyButton(self, 480, 500, t("ui.menu.crisis-result.back-to-title"), {
      width: 240,
      onClick: () => metaGameStateMachine.transition("title"),
    });
    // "Siguiente capítulo" se habilita sii la crisis se resolvió con éxito y hay
    // un capítulo siguiente en la secuencia (`outcome.nextChapterId`, 10f); al
    // pulsarlo, la nueva misión lee `currentChapterId` — ya avanzado en el save
    // activo por `advanceChapterProgress` — así que basta con volver a misión.
    const hasNextChapter = outcome.nextChapterId !== undefined;
    createKenneyButton(self, 800, 500, t("ui.menu.crisis-result.next-chapter"), {
      width: 240,
      enabled: hasNextChapter,
      onClick: () => metaGameStateMachine.transition("in-mission"),
    });
    if (!hasNextChapter) {
      this.add
        .text(800, 540, t("ui.menu.crisis-result.no-next-chapter"), {
          fontSize: "12px",
          color: LABEL_COLOR,
          align: "center",
          wordWrap: { width: 240 },
        })
        .setOrigin(0.5, 0);
    }
  }
}
