import Phaser from "phaser";
import { t } from "../i18n/i18n.js";
import { HEADER_COLOR, LABEL_COLOR } from "../render/palette.js";
import { UI_FONT_FAMILY } from "../ui/fonts.js";
import { preloadUiAssets } from "../ui/ui-asset-registry.js";
import { createKenneyButton } from "../ui/widgets/kenney-button.js";
import { createKenneyList } from "../ui/widgets/kenney-list.js";
import { metaGameStateMachine } from "../meta/meta-game.js";
import {
  exportCreationToFile,
  importCreationFromFile,
  listCampaignSaves,
  listCustomCreations,
  loadCustomCreation,
  saveCustomCreation,
} from "../meta/save-adapter.js";
import { SCENE_KEYS } from "../meta/scene-keys.js";
import type { SceneWithRexUI } from "../ui/scene-with-rex-ui.types.js";

/** Punto de entrada al modo creativo (Fase 9.5, punto 8): explorador de blueprints/creaciones + export/import `.kludge` (hito de demo). */
export class CreativeHubScene extends Phaser.Scene {
  private selectedCreationId?: string;
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.creativeHub);
  }

  preload(): void {
    preloadUiAssets(this);
  }

  create(): void {
    const self = this as unknown as SceneWithRexUI;

    this.add
      .text(640, 40, t("ui.menu.creative.header"), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "26px",
        color: HEADER_COLOR,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(340, 100, t("ui.menu.creative.creations"), { fontSize: "14px", color: LABEL_COLOR })
      .setOrigin(0.5);
    this.refreshCreationsList(self);

    this.add
      .text(940, 100, t("ui.menu.creative.blueprints"), { fontSize: "14px", color: LABEL_COLOR })
      .setOrigin(0.5);
    void listCampaignSaves().then((ids) => {
      createKenneyList(
        self,
        940,
        330,
        420,
        360,
        ids.map((id) => ({ text: id, onClick: () => {} })),
      );
    });

    // Feedback de export/import (selección requerida, cancelado, importado, error).
    this.statusText = this.add
      .text(640, 560, "", { fontSize: "13px", color: LABEL_COLOR, align: "center", wordWrap: { width: 620 } })
      .setOrigin(0.5, 0);

    createKenneyButton(self, 300, 620, t("ui.menu.creative.back"), {
      width: 200,
      onClick: () => metaGameStateMachine.transition("title"),
    });
    createKenneyButton(self, 520, 620, t("ui.menu.creative.export"), {
      width: 200,
      onClick: () => void this.exportSelected(),
    });
    createKenneyButton(self, 740, 620, t("ui.menu.creative.import"), {
      width: 200,
      onClick: () => void this.importCreation(self),
    });
    createKenneyButton(self, 960, 620, t("ui.menu.creative.new-canvas"), {
      width: 200,
      onClick: () => metaGameStateMachine.transition("creative-workbench"),
    });
  }

  /** (Re)dibuja la lista de creaciones; click en una fila la marca como seleccionada para exportar. */
  private refreshCreationsList(self: SceneWithRexUI): void {
    void listCustomCreations()
      .then((ids) =>
        // La lista guarda ids (`creation-XXXX`), pero el jugador reconoce sus
        // creaciones por el NOMBRE que les dio (`definition.name`), no por el id
        // técnico. Cargar cada una para mostrar el nombre; si una falla, cae al id.
        Promise.all(
          ids.map(async (id) => ({
            id,
            name: await loadCustomCreation(id)
              .then((creation) => creation.definition.name)
              .catch(() => id),
          })),
        ),
      )
      .then((entries) => {
        createKenneyList(
          self,
          340,
          330,
          420,
          360,
          entries.map(({ id, name }) => ({
            text: name,
            onClick: () => {
              this.selectedCreationId = id;
              this.setStatus(t("ui.menu.creative.selected").replace("{id}", name));
            },
          })),
        );
      });
  }

  private async exportSelected(): Promise<void> {
    if (!this.selectedCreationId) {
      this.setStatus(t("ui.menu.creative.select-first"));
      return;
    }
    try {
      const creation = await loadCustomCreation(this.selectedCreationId);
      const saved = await exportCreationToFile(creation);
      this.setStatus(saved ? t("ui.menu.creative.exported") : t("ui.menu.creative.export-cancelled"));
    } catch {
      this.setStatus(t("ui.menu.creative.export-error"));
    }
  }

  private async importCreation(self: SceneWithRexUI): Promise<void> {
    try {
      const creation = await importCreationFromFile();
      if (!creation) {
        this.setStatus(t("ui.menu.creative.import-cancelled"));
        return;
      }
      await saveCustomCreation(creation);
      this.refreshCreationsList(self);
      this.setStatus(t("ui.menu.creative.imported").replace("{id}", creation.metadata.id));
    } catch {
      this.setStatus(t("ui.menu.creative.import-error"));
    }
  }

  private setStatus(message: string): void {
    this.statusText?.setText(message);
  }
}
