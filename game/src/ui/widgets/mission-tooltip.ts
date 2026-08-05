import type Phaser from "phaser";
import type { ComponentCondition, ComponentWear, FunctionalProperty, MaterialProperties } from "engine";
import { UI_FONT_FAMILY } from "../fonts.js";
import { HEADER_COLOR, OBJECTIVE_DONE_COLOR, TIMER_TEXT_COLORS, TAG_CATEGORY_CSS } from "../../render/palette.js";
import { COMPONENT_CONDITION_TINT, COMPONENT_WEAR_CSS, CRISIS_FATAL_CSS } from "../../render/palette.js";
import { renderCompositionLines } from "./composition-list.js";
import type { CompositionIngredient } from "./mission-action-panel.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";

export type TooltipContent =
  | {
      readonly kind: "instance";
      readonly name: string;
      readonly condition: ComponentCondition;
      /** Desgaste acumulado (Fase 13c) — eje ortogonal a `condition`. */
      readonly wear?: ComponentWear;
      readonly functional?: ReadonlyArray<FunctionalProperty>;
      readonly material?: MaterialProperties;
      /**
       * RE EFECTIVA (catálogo + desgaste). Hasta 13c el tooltip mostraba el RE
       * de CATÁLOGO (`material.RE`), que mentía en cuanto una pieza se corroía
       * o se canibalizaba: la ficha decía "A" mientras el motor la trataba
       * como "M". El llamador resuelve el valor real con `effectiveResistance`.
       */
      readonly effectiveResistance?: "A" | "M" | "B" | "fallo";
      /** Solo para compuestos: desglose de sus piezas atómicas. */
      readonly composition?: ReadonlyArray<CompositionIngredient>;
    }
  | { readonly kind: "section"; readonly name: string };

export interface MissionTooltipLabels {
  readonly functionalDescription: (tag: FunctionalProperty["tag"]) => string;
  readonly structuralResistance: (level: "A" | "M" | "B") => string;
  /** Etiqueta del tag de desgaste, ej. `[DEGRADADO]` (Fase 13c). */
  readonly wearTag: (wear: ComponentWear) => string;
  /** "Resistencia estructural: FALLO" cuando el desgaste consumió todos los escalones. */
  readonly structuralFailure: string;
  readonly compositionTitle: string;
}

const TOOLTIP_WIDTH = 260;
const PADDING = 10;

/** Ícono + color por `condition` (principio 6: un actuador atascado nunca debe leerse igual que uno operativo). */
const CONDITION_ICON: Readonly<Record<ComponentCondition, string>> = {
  ok: "✔",
  jammed: "⚠",
  destroyed: "✖",
};
const CONDITION_COLOR: Readonly<Record<ComponentCondition, string>> = {
  ok: OBJECTIVE_DONE_COLOR,
  jammed: `#${COMPONENT_CONDITION_TINT.jammed!.toString(16).padStart(6, "0")}`,
  destroyed: TIMER_TEXT_COLORS.danger,
};

/**
 * Ficha rica al hover (rework post-playtest de Fase 11d): antes el tooltip
 * era una sola línea con el nombre y toda la info real (condición,
 * propiedades, composición) solo aparecía al clickear la pieza — el operador
 * pidió que el hover ya muestre la ficha completa, así que este widget
 * reemplaza el `Text` simple de `floorplan-scene.ts::updateTooltip`. Mismo
 * `renderCompositionLines` que usa el selector de instalación, sin el texto
 * de badge (solo color ámbar) — pedido explícito del operador.
 */
export function renderMissionTooltip(
  scene: SceneWithRexUI,
  content: TooltipContent,
  labels: MissionTooltipLabels,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  let y = PADDING;

  const nameText = content.kind === "instance" ? `${CONDITION_ICON[content.condition]} ${content.name}` : content.name;
  const nameColor = content.kind === "instance" ? CONDITION_COLOR[content.condition] : HEADER_COLOR;
  const nameLabel = scene.add
    .text(PADDING, y, nameText, {
      fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
      fontSize: "13px",
      color: nameColor,
      fontStyle: "bold",
      wordWrap: { width: TOOLTIP_WIDTH - PADDING * 2 },
    })
    .setOrigin(0, 0);
  container.add(nameLabel);
  y += nameLabel.height + 6;

  if (content.kind === "instance") {
    // Texto de cuerpo en "sans-serif" (playtest de la ronda 2), NO en
    // `UI_FONT_FAMILY`: esa es una fuente de display en mayúsculas por
    // diseño (Kenney Future), ilegible para párrafos — se reserva para el
    // nombre/encabezado de arriba, que funciona como mini-título. Mismo
    // genérico ya usado en el checklist de objetivos, sin assets nuevos.
    for (const property of content.functional ?? []) {
      const line = scene.add
        .text(PADDING, y, `• ${labels.functionalDescription(property.tag)}`, {
          fontFamily: "sans-serif",
          fontSize: "11px",
          color: TAG_CATEGORY_CSS.functional, // Eje B, categoría funcional (Fase 12e)
          wordWrap: { width: TOOLTIP_WIDTH - PADDING * 2 },
        })
        .setOrigin(0, 0);
      container.add(line);
      y += line.height + 4;
    }
    // Tag de desgaste (Fase 13c), antes del RE porque es lo que EXPLICA que el
    // RE mostrado no coincida con el de catálogo que el jugador conoce.
    if (content.wear && content.wear !== "nuevo") {
      const line = scene.add
        .text(PADDING, y, `• ${labels.wearTag(content.wear)}`, {
          fontFamily: "sans-serif",
          fontSize: "11px",
          color: COMPONENT_WEAR_CSS[content.wear] ?? TAG_CATEGORY_CSS.material,
          fontStyle: "bold",
          wordWrap: { width: TOOLTIP_WIDTH - PADDING * 2 },
        })
        .setOrigin(0, 0);
      container.add(line);
      y += line.height + 4;
    }
    // RE EFECTIVA si el llamador la resolvió; si no, el de catálogo (piezas sin
    // instanciar, donde no hay desgaste que aplicar).
    const resistance = content.effectiveResistance ?? content.material?.RE;
    if (resistance) {
      const isFailure = resistance === "fallo";
      const line = scene.add
        .text(
          PADDING,
          y,
          `• ${isFailure ? labels.structuralFailure : labels.structuralResistance(resistance)}`,
          {
            fontFamily: "sans-serif",
            fontSize: "11px",
            // Eje B (categoría material, Fase 12e) salvo en fallo, donde el
            // Eje A manda: es estado crítico, no una etiqueta de propiedad.
            color: isFailure ? CRISIS_FATAL_CSS : TAG_CATEGORY_CSS.material,
            wordWrap: { width: TOOLTIP_WIDTH - PADDING * 2 },
          },
        )
        .setOrigin(0, 0);
      container.add(line);
      y += line.height + 4;
    }
    if (content.composition && content.composition.length > 0) {
      const { container: compositionContainer, bottomY } = renderCompositionLines(
        scene,
        PADDING,
        y,
        TOOLTIP_WIDTH - PADDING * 2,
        labels.compositionTitle,
        content.composition,
      );
      container.add(compositionContainer);
      y = bottomY;
    }
  }

  const background = scene.add
    .rectangle(0, 0, TOOLTIP_WIDTH, y + PADDING, 0x0a0a0f, 0.92)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x2a3040, 1);
  container.addAt(background, 0);

  return container;
}

export const MISSION_TOOLTIP_WIDTH = TOOLTIP_WIDTH;
