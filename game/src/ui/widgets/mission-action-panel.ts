import Phaser from "phaser";
import type {
  ChemicalSubstanceId,
  ComponentCondition,
  ComponentId,
  DismantleHazardKind,
  Footprint,
  FunctionalProperty,
  GridPosition,
  MaterialProperties,
  PlacedComponentInstanceId,
} from "engine";
import { UI_FONT_FAMILY } from "../fonts.js";
import { LABEL_COLOR, HEADER_COLOR, CRISIS_WARNING_CSS } from "../../render/palette.js";
import { RENDER_DEPTH } from "../../render/render-depths.js";
import { createKenneyButton } from "./kenney-button.js";
import { createKenneyList } from "./kenney-list.js";
import { UI_POINTER_CURSOR_CSS } from "../custom-cursor.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";

export interface InstallOption {
  readonly id: ComponentId;
  readonly name: string;
  readonly footprint: Footprint;
  readonly functional?: ReadonlyArray<FunctionalProperty>;
  readonly material?: MaterialProperties;
}

/** Un ingrediente de la receta de un compuesto, ya resuelto a nombre — ver "Composición" en el panel/picker. */
export interface CompositionIngredient {
  readonly componentId: ComponentId;
  readonly name: string;
  readonly quantity: number;
  /** `true` si esta pieza tiene el tag funcional que la crisis activa necesita (resaltado ámbar, solo color). */
  readonly hasRequiredTag: boolean;
}

export type ActionPanelContent =
  | { readonly kind: "idle" }
  | {
      readonly kind: "instance";
      readonly instanceId: PlacedComponentInstanceId;
      readonly name: string;
      readonly condition: ComponentCondition;
      /**
       * Riesgo VIVO de desmontar esta pieza (Subfase 13d), ya evaluado por el
       * llamador contra el motor (`MissionRuntime.dismantleHazardsFor`). El
       * panel solo pinta: no sabe qué hace peligrosa a una pieza.
       */
      readonly dismantleHazards?: ReadonlyArray<DismantleHazardKind>;
      /** La pieza es una fuente con carga propia todavía sin descargar (13d, fix ronda 1). */
      readonly canDischargeSource?: boolean;
    }
  | { readonly kind: "empty"; readonly position: GridPosition }
  | {
      readonly kind: "substance";
      readonly substanceId: ChemicalSubstanceId;
      readonly name: string;
      readonly analyzed: boolean;
      /**
       * Líneas de detalle ya resueltas por el llamador (Fase 11e): tags
       * genéricos siempre; si `analyzed`, además los valores exactos de
       * riesgo (radio de combustión, segundos por nivel de corrosión) — el
       * panel solo las pinta (color/ícono ya vienen resueltos), no conoce
       * `MixtureHazardPreview` ni `CHEMICAL_TAG_COLORS`.
       */
      readonly detailLines: ReadonlyArray<SubstanceDetailLine>;
    }
  /**
   * Lista de sustancias sintetizadas disponibles (Subfase 11g): antes vivía
   * embebida en el estado `idle` (Fase 11e), ahora es un contenido contextual
   * propio que se abre desde el botón "Sustancias" del HUD permanente
   * (`ship-status-hud.ts`) — el panel ya no está siempre visible, así que la
   * lista necesita su propio disparador explícito.
   */
  | { readonly kind: "substances-list"; readonly substances: ReadonlyArray<AvailableSubstanceEntry> };

/**
 * Una línea de detalle de sustancia (Fase 11e, fix de playtest: las líneas
 * centradas en gris apagado "se leían muy poco" y no distinguían un tag
 * genérico de un valor de riesgo recién revelado). `color` y `icon` ya
 * vienen resueltos por el llamador (`mission-interaction-controller.ts`,
 * vía `CHEMICAL_TAG_COLORS`/ámbar de resaltado) — este widget solo pinta.
 */
export interface SubstanceDetailLine {
  readonly text: string;
  readonly color: string;
  /** Glifo unicode como ícono liviano (mismo criterio que `CONDITION_ICON` de `mission-tooltip.ts`), sin sprite nuevo. */
  readonly icon: string;
}

/** Una sustancia disponible para analizar (Fase 11e), listada en `substances-list`. */
export interface AvailableSubstanceEntry {
  readonly substanceId: ChemicalSubstanceId;
  readonly name: string;
  readonly analyzed: boolean;
}

export interface ActionPanelLabels {
  readonly idleTitle: string;
  readonly idleMessage: string;
  readonly instanceTitle: (name: string, condition: ComponentCondition) => string;
  readonly emptyTitle: string;
  readonly emptyHint: string;
  readonly dismantle: string;
  readonly installHere: string;
  /** Aviso de riesgo al desmontar (13d), una línea por hazard vivo. */
  readonly hazardWarning: (kind: DismantleHazardKind) => string;
  /** Tareas de asegurado que neutralizan el riesgo (13d). */
  readonly cutPower: string;
  readonly purgeReservoir: string;
  readonly dischargeSource: string;
  /** Aviso específico de una fuente con carga propia — el chispazo tiene otra causa y otra salida. */
  readonly sourceChargeWarning: string;
  readonly noActorSelected: string;
  /** "Analizar Sustancia" (Fase 11e); el label ya refleja si se completó (ej. "Ya analizada"). */
  readonly analyzeSubstance: (analyzed: boolean) => string;
  /** Título de la lista de sustancias disponibles (`substances-list`). */
  readonly substancesTitle: string;
  readonly substanceAnalyzedSuffix: string;
  /** "Cerrar" (deselección manual, fix de playtest 11e — ver doc de la función). */
  readonly close: string;
}

export interface ActionPanelCallbacks {
  readonly onDismantle: (instanceId: PlacedComponentInstanceId) => void;
  /** Encola "Cortar energía a la sección" (13d) para la sección de esta pieza. */
  readonly onCutPower: (instanceId: PlacedComponentInstanceId) => void;
  /** Encola "Purgar reservorio" (13d) sobre esta pieza. */
  readonly onPurgeReservoir: (instanceId: PlacedComponentInstanceId) => void;
  /** Encola "Descargar fuente" (13d, fix ronda 1) sobre esta batería/panel. */
  readonly onDischargeSource: (instanceId: PlacedComponentInstanceId) => void;
  readonly onOpenInstallPicker: (position: GridPosition) => void;
  readonly onAnalyzeSubstance: (substanceId: ChemicalSubstanceId) => void;
  readonly onSelectSubstance: (substanceId: ChemicalSubstanceId) => void;
  /** La lista de sustancias es un widget rexUI aparte de la display list de la escena (ver `kenney-list.ts`) — necesita su propio registro de HUD. */
  readonly markAsHudObject: (obj: Phaser.GameObjects.GameObject) => void;
  /** Deselección manual (fix de playtest 11e): vuelve el panel a `idle` sin tener que encolar ninguna acción. */
  readonly onClose: () => void;
}

/**
 * Panel de acciones CONTEXTUAL (Subfase 11g, reemplaza el docked de Fase
 * 10d): construido con origen LOCAL (0,0) — el llamador (`MissionInteraction
 * Controller`) posiciona el `Container` devuelto vía `setPosition()` cada
 * frame, siguiendo la celda seleccionada en espacio de pantalla (necesario
 * para flotar junto a la selección incluso mientras el jugador panea/hace
 * zoom del mapa, sin reconstruir el contenido en cada frame). Solo se llama
 * a esta función cuando hay contenido que mostrar — `idle` no se renderiza
 * más (antes vivía siempre montado; ver `mission-interaction-controller.ts`).
 *
 * **"✕" de cerrar** (fix de playtest de Fase 11e): visible en cualquier
 * estado — vuelve el panel a `idle` (que ahora significa "sin panel
 * montado", ver el controller).
 */
/** Clave de `container.getData()` con el alto realmente ocupado por el panel. */
export const ACTION_PANEL_HEIGHT_KEY = "panelHeight";

export function renderMissionActionPanel(
  scene: SceneWithRexUI,
  width: number,
  height: number,
  content: ActionPanelContent,
  hasSelectedActor: boolean,
  labels: ActionPanelLabels,
  callbacks: ActionPanelCallbacks,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);

  // Caja de fondo delimitada (playtest #16), ahora relativa al origen local
  // del container (antes anclada a la columna lateral fija). Se guarda la
  // referencia porque su alto REAL no se conoce hasta terminar de apilar el
  // contenido (13d ronda 2): con varios avisos de riesgo y sus botones, el
  // alto fijo del llamador se queda corto.
  const backdrop = scene.add
    .rectangle(-10, -8, width + 20, height, 0x0a0a0f, 0.72)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x2a3040, 1);
  container.add(backdrop);

  /** Punto más bajo ocupado por el contenido, para dimensionar el fondo al final. */
  let contentBottom = 0;
  const claim = (bottom: number): void => {
    contentBottom = Math.max(contentBottom, bottom);
  };

  const title =
    content.kind === "instance"
      ? labels.instanceTitle(content.name, content.condition)
      : content.kind === "empty"
        ? labels.emptyTitle
        : content.kind === "substance"
          ? content.name
          : content.kind === "substances-list"
            ? labels.substancesTitle
            : labels.idleTitle;

  const hasClose = content.kind !== "idle";
  const contentTop = hasClose ? 16 : 0;
  if (hasClose) {
    container.add(
      scene.add
        .text(width - 4, 0, `✕ ${labels.close}`, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "11px",
          color: LABEL_COLOR,
        })
        .setOrigin(1, 0)
        .setInteractive({ cursor: UI_POINTER_CURSOR_CSS })
        .on("pointerdown", () => callbacks.onClose()),
    );
  }

  const titleText = scene.add
    .text(width / 2, contentTop, title, {
      fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
      fontSize: "14px",
      color: HEADER_COLOR,
      align: "center",
      // `useAdvancedWrap`: el wrap básico no parte un token sin espacios, así
      // que un nombre largo de una sola palabra se salía de la caja (obs de
      // playtest). El avanzado sí corta la palabra al ancho disponible.
      wordWrap: { width: width - 20, useAdvancedWrap: true },
    })
    .setOrigin(0.5, 0);
  container.add(titleText);
  claim(contentTop + titleText.height);

  /**
   * Cursor de flujo vertical (13d ronda 2). Todo lo que sigue se apila midiendo
   * la altura REAL del elemento anterior, en vez de sumar constantes: el aviso
   * de "sin tripulante" y los avisos de riesgo se pisaban entre sí, y un aviso
   * de dos líneas quedaba tapado por el botón de desmontar. El alto de un texto
   * envuelto depende del idioma y del ancho del panel, así que no se puede
   * predecir con un número fijo.
   */
  let flowY = contentTop + titleText.height + 10;

  if (content.kind === "idle") {
    container.add(
      scene.add
        .text(width / 2, 26, labels.idleMessage, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "11px",
          color: LABEL_COLOR,
          align: "center",
          wordWrap: { width: width - 20 },
        })
        .setOrigin(0.5, 0),
    );
    return container;
  }

  if (content.kind === "substances-list") {
    const listTop = contentTop + 30;
    const list = createKenneyList(
      scene,
      width / 2,
      listTop + (height - listTop) / 2,
      width - 20,
      height - listTop,
      content.substances.map((entry) => ({
        text: entry.analyzed ? `${entry.name} ${labels.substanceAnalyzedSuffix}` : entry.name,
        onClick: () => callbacks.onSelectSubstance(entry.substanceId),
      })),
    ).setDepth(RENDER_DEPTH.hudContent);
    // Debe ser hijo del container (no un objeto top-level aparte): el panel
    // flota y se reposiciona vía `container.setPosition()` cada frame
    // (Subfase 11g) — un hijo hereda esa transformación, un sibling
    // construido con las mismas coordenadas LOCALES quedaría fijo en el
    // origen de la escena y nunca se vería donde el panel realmente está.
    container.add(list);
    return container;
  }

  if (!hasSelectedActor) {
    const notice = scene.add
      .text(width / 2, flowY, labels.noActorSelected, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "11px",
        color: LABEL_COLOR,
        align: "center",
        wordWrap: { width: width - 20, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    container.add(notice);
    flowY += notice.height + 6;
    claim(flowY);
  }

  if (content.kind === "instance") {
    // Propiedades/composición ya NO se repiten acá (playtest): esa ficha
    // completa vive en el tooltip de hover (`mission-tooltip.ts`) — este
    // panel solo ofrece la acción sobre la pieza seleccionada.
    const hazards = content.dismantleHazards ?? [];
    // Badge de riesgo (13d): el jugador tiene que poder decidir ANTES de
    // encolar, no descubrirlo con el chispazo (pilar de legibilidad total).
    // Ámbar del contrato de color único de 12e — es escalable, no fatal.
    let cursorY = flowY;
    for (const hazard of hazards) {
      // Una fuente chispea por su propia carga, no por la red: decirle al
      // jugador "está energizada" lo mandaría a cortar la sección, que no la
      // arregla (13d, fix ronda 1).
      const warning =
        hazard === "dismantle-spark" && content.canDischargeSource
          ? labels.sourceChargeWarning
          : labels.hazardWarning(hazard);
      const warningText = scene.add
        .text(width / 2, cursorY, `⚠ ${warning}`, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "10px",
          color: CRISIS_WARNING_CSS,
          align: "center",
          wordWrap: { width: width - 20, useAdvancedWrap: true },
        })
        .setOrigin(0.5, 0);
      container.add(warningText);
      // Alto REAL: el aviso de una fuente ocupa 2-3 líneas y el fijo de 24px
      // dejaba las siguientes debajo del botón (13d ronda 2).
      cursorY += warningText.height + 6;
      claim(cursorY);
    }

    // Un botón de rexUI se ancla por su CENTRO, así que el cursor (que es el
    // borde superior del flujo) suma media altura. `contentTop + 68` se
    // conserva como piso para que el caso sin avisos se vea igual que antes.
    const dismantleCenter = Math.max(cursorY + 17, contentTop + 68);
    container.add(
      createKenneyButton(scene, width / 2, dismantleCenter, labels.dismantle, {
        width: width - 40,
        height: 34,
        fontSize: "12px",
        enabled: hasSelectedActor,
        onClick: () => callbacks.onDismantle(content.instanceId),
      }),
    );
    cursorY = dismantleCenter + 17 + 8;
    claim(cursorY);

    // Un botón por tarea de asegurado APLICABLE — la fuga atmosférica no tiene
    // tarea propia (decisión del operador): se resuelve arreglando la sección.
    const stackButton = (label: string, onClick: () => void): void => {
      container.add(
        createKenneyButton(scene, width / 2, cursorY + 15, label, {
          width: width - 40,
          height: 30,
          fontSize: "11px",
          enabled: hasSelectedActor,
          onClick,
        }),
      );
      cursorY += 36;
      claim(cursorY);
    };

    // Cortar la energía de la sección no asegura una FUENTE con carga propia,
    // así que para una batería se ofrece la descarga y no el corte.
    if (hazards.includes("dismantle-spark") && !content.canDischargeSource) {
      stackButton(labels.cutPower, () => callbacks.onCutPower(content.instanceId));
    }
    if (hazards.includes("dismantle-spill")) {
      stackButton(labels.purgeReservoir, () => callbacks.onPurgeReservoir(content.instanceId));
    }
    // Una FUENTE (batería, panel solar) no se asegura cortando la sección: su
    // carga es propia (13d, fix de playtest ronda 1). El llamador marca cuándo
    // corresponde ofrecer la descarga — el panel no conoce el catálogo.
    if (content.canDischargeSource) {
      stackButton(labels.dischargeSource, () => callbacks.onDischargeSource(content.instanceId));
    }
  } else if (content.kind === "empty") {
    const installCenter = Math.max(flowY + 17, contentTop + 68);
    container.add(
      createKenneyButton(scene, width / 2, installCenter, labels.installHere, {
        width: width - 40,
        height: 34,
        fontSize: "12px",
        enabled: hasSelectedActor,
        onClick: () => callbacks.onOpenInstallPicker(content.position),
      }),
    );
    // Texto de contexto (ajuste post-playtest #3): sin esto, nada en pantalla
    // sugería que instalar un reemplazo se hace clickeando de nuevo la misma
    // celda vacía — un jugador sin el GDD no podía deducirlo.
    const hint = scene.add
      .text(width / 2, installCenter + 28, labels.emptyHint, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "10px",
        color: LABEL_COLOR,
        align: "center",
        wordWrap: { width: width - 20, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    container.add(hint);
    claim(installCenter + 28 + hint.height);
  } else if (content.kind === "substance") {
    // Tags genéricos siempre; si ya fue analizada, el llamador agrega acá
    // los valores exactos de riesgo (radio de combustión, segundos por nivel
    // de corrosión). Fix de playtest de Fase 11e: antes centradas y en gris
    // apagado ("se leían muy poco") — ahora alineadas a la izquierda, con
    // un ícono/color por línea ya resuelto por el llamador (genérico vs.
    // revelado por el análisis se distinguen a simple vista).
    const detailX = 14;
    const detailWidth = width - 28;
    let detailY = flowY;
    for (const line of content.detailLines) {
      const lineText = scene.add
        .text(detailX, detailY, `${line.icon} ${line.text}`, {
          fontFamily: "sans-serif",
          fontSize: "11px",
          color: line.color,
          wordWrap: { width: detailWidth },
        })
        .setOrigin(0, 0);
      container.add(lineText);
      detailY += lineText.height + 5;
    }
    container.add(
      createKenneyButton(scene, width / 2, detailY + 12, labels.analyzeSubstance(content.analyzed), {
        width: width - 40,
        height: 34,
        fontSize: "12px",
        enabled: hasSelectedActor && !content.analyzed,
        onClick: () => callbacks.onAnalyzeSubstance(content.substanceId),
      }),
    );
    claim(detailY + 12 + 17);
  }

  // El alto que pidió el llamador es un MÍNIMO, no un techo (13d ronda 2): con
  // dos o tres avisos de riesgo y sus botones, el contenido pasa de largo y el
  // fondo tiene que acompañar en vez de recortarlo.
  const renderedHeight = Math.max(height, contentBottom + 16);
  backdrop.setSize(width + 20, renderedHeight);
  // El alto REAL, para que la escena pueda mantener el panel dentro de pantalla
  // y bloquear los clicks sobre toda su superficie (si el clamp siguiera usando
  // el alto nominal, la parte que sobresale dejaría pasar el click al mapa).
  container.setData(ACTION_PANEL_HEIGHT_KEY, renderedHeight);

  return container;
}
