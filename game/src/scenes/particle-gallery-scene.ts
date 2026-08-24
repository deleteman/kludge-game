import Phaser from "phaser";
import { CANONICAL_SHIP_FLOORPLANS, GRID_CELL_SIZE_PX, SHIP_ARCHETYPES } from "engine";

import { DEV_EVENT_SAMPLES } from "./dev-event-samples.js";
import { t } from "../i18n/i18n.js";
import { renderFloorplan } from "../render/floorplan-renderer.js";
import { fireEventEffect } from "../particles/effect-registry.js";
import { fireEventSound } from "../audio/phenomenon-sound-registry.js";
import { createConduitFlowEffect } from "../particles/effects/conduit-flow-effect.js";
import {
  createFreezingEffect,
  createGasLeakEffect,
  createHeatVaporEffect,
} from "../particles/effects/atmosphere-state-effects.js";
import type { StateDrivenEffect } from "../particles/particle-effect.types.js";
import { HEADER_COLOR, LABEL_COLOR } from "../render/palette.js";
import { type HopCadence, hopMove } from "../crew/hop-movement.js";

/** En celdas de grid (no píxeles) para que las posiciones de partículas, que
 * se calculan en coordenadas de celda, coincidan con el offset del plano. */
const MAP_OFFSET_CELLS = 1;

/**
 * Escena solo-dev de Fase 8: dispara manualmente cada `DomainEvent` sobre un
 * plano ya renderizado, sin depender del driver de simulación real (diferido
 * a Fase 10). Sirve de smoke test visual y de catálogo de referencia — cada
 * fenómeno nuevo en `effect-registry.ts` se añade aquí con su propia tecla.
 *
 * No es parte del flujo de juego; se accede con la tecla G desde
 * `FloorplanScene` y se vuelve con ESC.
 */
/** Fenómenos state-driven (sin `DomainEvent` propio): se activan/desactivan con la misma tecla (toggle). */
const STATE_DRIVEN_LABELS = [
  "E: flujo en conducto (toggle)",
  "R: fuga de gas (toggle)",
  "T: congelación (toggle)",
  "Y: vapor por calor (toggle)",
] as const;

/** Ciclo de cadencias que recorre la tecla H (GDD 11.2). */
const HOP_CADENCE_CYCLE: readonly HopCadence[] = ["normal", "urgente", "herido"];

export class ParticleGalleryScene extends Phaser.Scene {
  private headerText?: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;

  constructor() {
    super("particle-gallery");
  }

  create(): void {
    const ship = CANONICAL_SHIP_FLOORPLANS[SHIP_ARCHETYPES[0]];
    const { base, walls } = renderFloorplan(this, ship);
    const offsetY = MAP_OFFSET_CELLS * GRID_CELL_SIZE_PX;
    base.setY(offsetY);
    walls?.setY(offsetY);

    this.headerText = this.add
      .text(8, 2, t("ui.gallery.header"), {
        fontFamily: "monospace",
        fontSize: "12px",
        color: HEADER_COLOR,
      })
      .setDepth(2);

    this.hintText = this.add
      .text(
        8,
        20,
        [...DEV_EVENT_SAMPLES.map((entry) => entry.label), ...STATE_DRIVEN_LABELS].join("   "),
        { fontFamily: "monospace", fontSize: "10px", color: LABEL_COLOR, wordWrap: { width: 1264 } },
      )
      .setDepth(2);

    // Posición fija de referencia: primera celda de la primera sección del plano.
    const targetCell = ship.sections[0]!.cells[0]!;
    const position = { x: targetCell.x, y: targetCell.y + MAP_OFFSET_CELLS };

    for (const entry of DEV_EVENT_SAMPLES) {
      this.input.keyboard?.on(`keydown-${entry.key}`, () => {
        const event = entry.buildEvent();
        fireEventEffect(this, position, event);
        fireEventSound(this, event);
      });
    }

    this.setupStateDemoToggle("E", position, createConduitFlowEffect(), () => ({
      active: true,
      intensity: 0.8,
      kind: "electrico" as const,
      direction: { x: 1, y: 0 },
    }));
    this.setupStateDemoToggle("R", position, createGasLeakEffect(), () => ({
      concentration: 0.6,
      tint: 0x6adc7a,
    }));
    this.setupStateDemoToggle("T", position, createFreezingEffect(), () => ({
      temperatureCelsius: -20,
    }));
    this.setupStateDemoToggle("Y", position, createHeatVaporEffect(), () => ({
      temperatureCelsius: 90,
    }));

    this.setupHopDemo(position);

    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("floorplan"));
  }

  /**
   * Placeholder de tripulante (GDD §17: no hay pack de arte todavía —
   * rectángulo de color con id como texto, convención CLAUDE.md) que salta
   * ida y vuelta entre dos celdas. Tecla H: cicla cadencia normal → urgente →
   * herido, para comparar los tres perfiles de `hop-movement.ts` uno al lado
   * del otro (mismo criterio de smoke test visual manual, sin driver real).
   */
  private setupHopDemo(basePosition: { x: number; y: number }): void {
    const baseX = basePosition.x * GRID_CELL_SIZE_PX + GRID_CELL_SIZE_PX / 2;
    const baseY = basePosition.y * GRID_CELL_SIZE_PX + GRID_CELL_SIZE_PX / 2;
    const from = { x: baseX, y: baseY + 3 * GRID_CELL_SIZE_PX };
    const to = { x: baseX + 2 * GRID_CELL_SIZE_PX, y: from.y };

    const marker = this.add.rectangle(from.x, from.y, 10, 14, 0x4ad0e0).setDepth(3);
    this.add
      .text(from.x, from.y - 14, "tripulante", { fontFamily: "monospace", fontSize: "8px", color: LABEL_COLOR })
      .setOrigin(0.5)
      .setDepth(3);

    let cadenceIndex = 0;
    let atFrom = true;
    const hopNext = (): void => {
      const cadence = HOP_CADENCE_CYCLE[cadenceIndex]!;
      const source = atFrom ? from : to;
      const destination = atFrom ? to : from;
      atFrom = !atFrom;
      hopMove(this, marker, source, destination, cadence).once("complete", () => {
        this.time.delayedCall(150, hopNext);
      });
    };

    this.input.keyboard?.on("keydown-H", () => {
      cadenceIndex = (cadenceIndex + 1) % HOP_CADENCE_CYCLE.length;
    });
    hopNext();
  }

  /** Prende/apaga un efecto state-driven con la misma tecla, alimentándolo con estado sintético cada 100ms — sustituto de un driver real (Fase 10). */
  private setupStateDemoToggle<TState>(
    key: string,
    position: { x: number; y: number },
    effect: StateDrivenEffect<TState>,
    sampleState: () => TState,
  ): void {
    let active = false;
    let timer: Phaser.Time.TimerEvent | undefined;
    this.input.keyboard?.on(`keydown-${key}`, () => {
      active = !active;
      if (active) {
        effect.start(this, position);
        timer = this.time.addEvent({
          delay: 100,
          loop: true,
          callback: () => effect.update(sampleState(), 0.1),
        });
      } else {
        timer?.remove();
        effect.stop();
      }
    });
  }
}
