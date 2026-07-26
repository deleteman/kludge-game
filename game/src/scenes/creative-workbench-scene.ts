import Phaser from "phaser";
import type ScrollablePanel from "phaser3-rex-plugins/templates/ui/scrollablepanel/ScrollablePanel.js";
import {
  ATOMIC_COMPONENT_CATALOG,
  CANONICAL_SHIP_FLOORPLANS,
  ELEMENT_CATALOG,
  GRID_CELL_SIZE_PX,
  MapEntityRegistry,
  addPiece,
  removePiece,
  addSignalNode,
  connectNodes,
  createEmptyWorkbenchState,
  createPhysicalComponentFactory,
  installCreationInFloorplan,
  nameAndRegisterCreation,
  occupiedCells,
} from "engine";
import type {
  ChemicalSubstanceId,
  ChemicalTag,
  ComponentId,
  CustomCreationId,
  PhysicalComponentDefinition,
  PlacedComponentInstanceId,
  ReactantSubstance,
  SignalEdgeId,
  SignalNodeId,
  WorkbenchPieceId,
  WorkbenchState,
} from "engine";

import { t } from "../i18n/i18n.js";
import { HEADER_COLOR, LABEL_COLOR, chemicalElementColor, chemicalResultColor } from "../render/palette.js";
import { renderWorkbench } from "../render/workbench-renderer.js";
import { preloadComponentSprites } from "../render/component-sprite-registry.js";
import { UI_FONT_FAMILY } from "../ui/fonts.js";
import { preloadUiAssets } from "../ui/ui-asset-registry.js";
import { createKenneyButton } from "../ui/widgets/kenney-button.js";
import { createKenneyList } from "../ui/widgets/kenney-list.js";
import { createKenneyCardList } from "../ui/widgets/kenney-card-list.js";
import { metaGameStateMachine } from "../meta/meta-game.js";
import { campaignSession } from "../meta/campaign-session.js";
import { saveCustomCreation } from "../meta/save-adapter.js";
import { SCENE_KEYS } from "../meta/scene-keys.js";
import type { SceneWithRexUI } from "../ui/scene-with-rex-ui.types.js";

const CELL = GRID_CELL_SIZE_PX;
const GRID_ORIGIN = { x: 40, y: 110 };
const GRID_SIZE = { width: 12, height: 8 };

/**
 * Contexto que convierte la mesa creativa en la mesa EN MISIÓN (11c.2): se pasa
 * como `init` data al lanzarla como overlay sobre una misión pausada. Con él, la
 * mesa deja de guardar en campaña / auto-instalar y en su lugar entrega la
 * creación diseñada (`onFabricate` → encola la tarea `combine`) y devuelve el
 * control a la misión (`onClose`). Sin este contexto, la escena es la mesa del
 * modo creativo de siempre.
 *
 * `onSynthesize` (11c.3) es el equivalente químico de `onFabricate`: entrega la
 * selección de elementos del modo "Química" para que la misión encole su propia
 * tarea `combine` vía `queueSynthesis`. Solo disponible en contexto de misión —
 * la síntesis no tiene todavía un destino en modo creativo (sin reservorio con
 * sustancia propia, ver PENDIENTES_OBSERVACIONES.md). `onPreviewSynthesis`
 * (feedback de playtest) es una consulta de solo lectura al mismo resolver —
 * no registra nada — para mostrar en vivo qué sustancia va a resultar de la
 * selección actual, antes de confirmar.
 */
export interface MissionWorkbenchContext {
  readonly onFabricate: (definition: PhysicalComponentDefinition) => void;
  readonly onSynthesize: (selectedElementIds: ReadonlyArray<ChemicalSubstanceId>) => void;
  readonly onPreviewSynthesis: (
    selectedElementIds: ReadonlyArray<ChemicalSubstanceId>,
  ) => ReactantSubstance | null;
  readonly onClose: () => void;
}

/**
 * Handoff de un solo uso del contexto de misión a la escena de la mesa (11c.2).
 * NO se pasa por `scene.data`: Phaser RETIENE `sys.settings.data` entre
 * `scene.start` sin data nueva, así que el contexto de una apertura en misión
 * reaparecía luego en el modo creativo (botón "Fabricar" llamando a una
 * `FloorplanScene` muerta → crash). Una variable de módulo que la escena
 * consume-y-limpia en `create()` evita ese leak: el modo creativo, que nunca la
 * setea, siempre entra sin contexto.
 */
let pendingMissionContext: MissionWorkbenchContext | undefined;

export function setPendingMissionWorkbenchContext(context: MissionWorkbenchContext): void {
  pendingMissionContext = context;
}

/**
 * Mesa de creación visual (Fase 9.5, punto 8) — grid real (`workbench-renderer.ts`)
 * sobre `engine/src/workbench/`. Simplificación deliberada frente al GDD
 * 10.1 dado el alcance de esta fase: colocar es "click en el catálogo, click
 * en el grid" en vez de arrastre continuo, y cada pieza recibe un único nodo
 * de señal por defecto (`conductor`) en vez de puertos declarados por pieza
 * — suficiente para probar el flujo completo colocar→cablear→nombrar→
 * guardar→instalar; un editor de puertos por pieza queda para iteración
 * posterior si el operador lo pide.
 */
export class CreativeWorkbenchScene extends Phaser.Scene {
  private workbench: WorkbenchState = createEmptyWorkbenchState();
  private renderContainer?: Phaser.GameObjects.Container;
  /** Zona de selección/resultado del modo química (11c.3) — ocupa el área del grid, que en este modo no se usa. */
  private chemistryContainer?: Phaser.GameObjects.Container;
  private statusText?: Phaser.GameObjects.Text;
  private armedComponentId?: ComponentId;
  private wireFirstNode?: SignalNodeId;
  private deleteMode = false;
  private pieceCounter = 0;
  /** Presente solo cuando la mesa se abre desde una misión en pausa (11c.2). */
  private missionContext?: MissionWorkbenchContext;
  /**
   * Modo de la mesa (11c.3): "fisica" compone piezas en el grid (comportamiento
   * de siempre); "quimica" combina elementos por proporción, sin grid espacial
   * (los elementos no tienen footprint en el modelo de datos — ver nota de
   * diseño del plan). Solo alternable en contexto de misión.
   */
  private mode: "fisica" | "quimica" = "fisica";
  private selectedElements: ChemicalSubstanceId[] = [];
  private palettePanel?: ScrollablePanel;
  private readonly componentRegistry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  private readonly factory = createPhysicalComponentFactory(this.componentRegistry);
  private readonly nameByComponentId = new Map(
    ATOMIC_COMPONENT_CATALOG.map((spec) => [spec.id as string, spec.name]),
  );
  private readonly elementSpecById = new Map(ELEMENT_CATALOG.map((spec) => [spec.id as string, spec]));

  constructor() {
    super(SCENE_KEYS.creativeWorkbench);
    // `buildComposite` (vía `nameAndRegisterCreation`) resuelve cada
    // ingrediente de la receta contra el registro — hay que sembrar los
    // atómicos del catálogo antes de poder nombrar ninguna creación.
    for (const spec of ATOMIC_COMPONENT_CATALOG) {
      const atomic = this.factory.buildAtomic({ id: spec.id, name: spec.name, data: spec.data });
      this.componentRegistry.register(atomic.id, atomic);
    }
  }

  preload(): void {
    preloadUiAssets(this);
    // Sprites de pieza para dibujar la mesa con arte real, no rectángulos
    // (cierre del pendiente #7); el que falte cae al placeholder por código.
    preloadComponentSprites(this);
  }

  create(): void {
    const self = this as unknown as SceneWithRexUI;
    this.workbench = createEmptyWorkbenchState();
    this.pieceCounter = 0;
    this.armedComponentId = undefined;
    this.wireFirstNode = undefined;
    this.deleteMode = false;
    this.mode = "fisica";
    this.selectedElements = [];

    // Consume-once: toma el contexto de misión si esta apertura vino de una
    // misión, y lo limpia enseguida para que no sobreviva al próximo ingreso
    // (ver `setPendingMissionWorkbenchContext`). En modo creativo queda undefined.
    this.missionContext = pendingMissionContext;
    pendingMissionContext = undefined;

    // En misión la mesa es un modal sobre el plano pausado: fondo opaco para
    // tapar la misión de atrás y bloquear su lectura visual (11c.2). En modo
    // creativo la escena ocupa toda la pantalla y no lo necesita.
    if (this.missionContext) {
      this.add.rectangle(640, 360, 1280, 720, 0x0b0f14, 1).setDepth(-10);
    }

    this.add
      .text(640, 30, t("ui.menu.workbench.header"), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "22px",
        color: HEADER_COLOR,
      })
      .setOrigin(0.5, 0);

    this.statusText = this.add.text(GRID_ORIGIN.x, 70, "", {
      fontSize: "12px",
      color: LABEL_COLOR,
    });
    this.setStatus(t("ui.menu.workbench.header"));

    this.renderPalette(self);
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handleGridClick(pointer));

    const missionContext = this.missionContext;
    createKenneyButton(self, 140, 620, t("ui.menu.workbench.back"), {
      width: 160,
      onClick: () => {
        if (missionContext) {
          missionContext.onClose();
          return;
        }
        metaGameStateMachine.transition("creative-hub");
      },
    });
    createKenneyButton(self, 330, 620, t("ui.menu.workbench.wire-mode"), {
      width: 150,
      onClick: () => {
        if (this.mode !== "fisica") return;
        this.armedComponentId = undefined;
        this.wireFirstNode = undefined;
        this.deleteMode = false;
        this.setStatus(t("ui.menu.workbench.wire-mode-hint"));
      },
    });
    createKenneyButton(self, 500, 620, t("ui.menu.workbench.delete-mode"), {
      width: 150,
      onClick: () => {
        if (this.mode !== "fisica") return;
        this.armedComponentId = undefined;
        this.wireFirstNode = undefined;
        this.deleteMode = true;
        this.setStatus(t("ui.menu.workbench.delete-mode-hint"));
      },
    });

    // Toggle Física/Química (11c.3, principio 7 — una sola mesa, no un editor
    // aparte): solo tiene sentido en misión, porque `queueSynthesis` vive en
    // `MissionRuntime` y el modo creativo todavía no tiene dónde guardar una
    // sustancia sintetizada (sin reservorio con sustancia propia todavía).
    if (missionContext) {
      createKenneyButton(
        self,
        920,
        70,
        this.mode === "fisica" ? t("ui.menu.workbench.mode-chemistry") : t("ui.menu.workbench.mode-physical"),
        {
          width: 200,
          onClick: () => {
            this.mode = this.mode === "fisica" ? "quimica" : "fisica";
            this.armedComponentId = undefined;
            this.wireFirstNode = undefined;
            this.deleteMode = false;
            this.selectedElements = [];
            this.renderPalette(self);
            this.setStatus(
              this.mode === "quimica"
                ? t("ui.menu.workbench.chemistry-hint")
                : t("ui.menu.workbench.header"),
            );
            this.redraw();
          },
        },
      );
    }

    createKenneyButton(self, 730, 620, this.actionButtonLabel(missionContext), {
      width: 240,
      onClick: () => this.handleActionButton(missionContext),
    });

    this.redraw();
  }

  private actionButtonLabel(missionContext: MissionWorkbenchContext | undefined): string {
    if (this.mode === "quimica") {
      return t("ui.menu.workbench.synthesize");
    }
    return missionContext ? t("ui.menu.workbench.fabricate") : t("ui.menu.workbench.name-and-save");
  }

  private handleActionButton(missionContext: MissionWorkbenchContext | undefined): void {
    if (this.mode === "quimica" && missionContext) {
      this.synthesize(missionContext);
      return;
    }
    if (missionContext) {
      this.nameAndFabricate(missionContext);
      return;
    }
    void this.nameSaveAndInstall();
  }

  /** Traduce un tag químico a texto legible, ej. "Corrosivo (M)" — mismo criterio de bullets que `install-picker-modal.ts`. */
  private chemicalTagLabel(tag: ChemicalTag): string {
    const base = t(`chemistry.tag.${tag.name}`);
    return "level" in tag && tag.level ? `${base} (${tag.level})` : base;
  }

  /** Reconstruye la paleta lateral según el modo (11c.3): catálogo de piezas o de elementos. */
  private renderPalette(self: SceneWithRexUI): void {
    // IMPORTANTE (bug de playtest 11c.3): `destroy(true)` en un objeto rexUI
    // (`ScrollablePanel` es un `ContainerLite`) NO es una destrucción profunda,
    // es "la Scene me destruye a mí" y por eso SALTEA destruir a sus hijos —
    // dejaba fantasmas visuales del panel viejo y un listener de `wheel` vivo
    // que crasheaba al scrollear el panel nuevo. Sin argumento sí cascada bien.
    this.palettePanel?.destroy();

    if (this.mode === "fisica") {
      const items = ATOMIC_COMPONENT_CATALOG.map((spec) => ({
        text: spec.name,
        onClick: () => {
          this.armedComponentId = spec.id;
          this.wireFirstNode = undefined;
          this.deleteMode = false;
          this.setStatus(`+ ${spec.name} — click en el grid para colocar`);
        },
      }));
      // `createKenneyList` ubica el panel por su CENTRO (ver su doc); para que
      // el tope de la paleta quede alineado con el grid (`GRID_ORIGIN.y = 110`)
      // hay que pasar el centro = tope + alto/2, no el tope directamente
      // (ajuste post-playtest #5).
      this.palettePanel = createKenneyList(
        self,
        1000,
        GRID_ORIGIN.y + (GRID_SIZE.height * CELL) / 2,
        260,
        GRID_SIZE.height * CELL,
        items,
      );
      return;
    }

    // Modo química (feedback de playtest 11c.3): tarjetas con color real
    // curado por elemento + todas sus propiedades químicas, no una lista de
    // texto plano — el jugador necesita ver con qué está combinando.
    const cards = ELEMENT_CATALOG.map((spec) => ({
      color: chemicalElementColor(spec.id),
      title: spec.name,
      detailLines: spec.data.tags.map((tag) => this.chemicalTagLabel(tag)),
      onClick: () => {
        this.selectedElements = [...this.selectedElements, spec.id];
        this.setStatus(`+ ${spec.name}`);
        this.redraw();
      },
    }));
    this.palettePanel = createKenneyCardList(
      self,
      1000,
      GRID_ORIGIN.y + (GRID_SIZE.height * CELL) / 2,
      260,
      GRID_SIZE.height * CELL,
      cards,
    );
  }

  /**
   * Zona de selección + preview de resultado del modo química (11c.3,
   * feedback de playtest): ocupa el área del grid físico, que este modo no
   * usa (los elementos se combinan por proporción, no por posición espacial
   * — ver nota de diseño del plan original). Chips por elemento elegido
   * (color curado + cantidad) y, con ≥2 elegidos, una tarjeta de "Resultado"
   * coloreada por el tag dominante de la sustancia que el motor va a
   * resolver — consulta de solo lectura (`onPreviewSynthesis`, no registra
   * nada), así que se puede llamar en cada click sin efectos acumulativos.
   */
  private renderChemistrySelection(): void {
    this.chemistryContainer?.destroy(true);
    this.chemistryContainer = undefined;
    if (this.mode !== "quimica" || !this.missionContext) {
      return;
    }
    const container = this.add.container(GRID_ORIGIN.x, GRID_ORIGIN.y);
    this.chemistryContainer = container;

    const counts = new Map<string, number>();
    for (const elementId of this.selectedElements) {
      counts.set(elementId, (counts.get(elementId) ?? 0) + 1);
    }

    const CHIP_WIDTH = 150;
    const CHIP_HEIGHT = 36;
    const CHIPS_PER_ROW = 3;
    let index = 0;
    for (const [elementId, count] of counts) {
      const spec = this.elementSpecById.get(elementId);
      const col = index % CHIPS_PER_ROW;
      const row = Math.floor(index / CHIPS_PER_ROW);
      const x = col * (CHIP_WIDTH + 8);
      const y = row * (CHIP_HEIGHT + 8);
      container.add(
        this.add.rectangle(x, y, CHIP_WIDTH, CHIP_HEIGHT, 0x1a2030, 0.7).setOrigin(0, 0).setStrokeStyle(1, chemicalElementColor(elementId), 0.9),
      );
      container.add(this.add.rectangle(x + 10, y + CHIP_HEIGHT / 2, 14, 14, chemicalElementColor(elementId), 1).setOrigin(0.5));
      container.add(
        this.add
          .text(x + 24, y + CHIP_HEIGHT / 2, `${spec?.name ?? elementId} ×${count}`, {
            fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
            fontSize: "11px",
            color: LABEL_COLOR,
          })
          .setOrigin(0, 0.5),
      );
      index += 1;
    }

    const rows = Math.ceil(counts.size / CHIPS_PER_ROW) || 1;
    const resultY = rows * (CHIP_HEIGHT + 8) + 16;

    if (this.selectedElements.length < 2) {
      container.add(
        this.add.text(0, resultY, t("ui.menu.workbench.chemistry-hint"), {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "12px",
          color: LABEL_COLOR,
          wordWrap: { width: GRID_SIZE.width * CELL },
        }),
      );
      return;
    }

    const outcome = this.missionContext.onPreviewSynthesis(this.selectedElements);
    if (!outcome) {
      return;
    }
    const resultColor = chemicalResultColor(outcome.tags);
    container.add(
      this.add
        .rectangle(0, resultY, GRID_SIZE.width * CELL * 0.6, 90, 0x1a2030, 0.85)
        .setOrigin(0, 0)
        .setStrokeStyle(2, resultColor, 1),
    );
    container.add(
      this.add.text(12, resultY + 8, t("ui.menu.workbench.result-label"), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "11px",
        color: LABEL_COLOR,
      }),
    );
    container.add(
      this.add.text(12, resultY + 26, outcome.name, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "16px",
        color: HEADER_COLOR,
      }),
    );
    container.add(
      this.add.text(12, resultY + 52, outcome.tags.map((tag) => this.chemicalTagLabel(tag)).join(" · "), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "11px",
        color: LABEL_COLOR,
        wordWrap: { width: GRID_SIZE.width * CELL * 0.6 - 24 },
      }),
    );
  }

  private setStatus(text: string): void {
    this.statusText?.setText(text);
  }

  private handleGridClick(pointer: Phaser.Input.Pointer): void {
    // Modo química (11c.3): no hay grid espacial, los elementos se eligen por
    // clic en la paleta (ver `renderPalette`) — el área del grid no tiene
    // comportamiento propio en este modo.
    if (this.mode === "quimica") return;

    const cellX = Math.floor((pointer.x - GRID_ORIGIN.x) / CELL);
    const cellY = Math.floor((pointer.y - GRID_ORIGIN.y) / CELL);
    if (cellX < 0 || cellY < 0 || cellX >= GRID_SIZE.width || cellY >= GRID_SIZE.height) {
      return;
    }

    if (this.deleteMode) {
      this.tryDeleteAtCell(cellX, cellY);
      return;
    }

    if (!this.armedComponentId) {
      this.tryWireAtCell(cellX, cellY);
      return;
    }

    const spec = ATOMIC_COMPONENT_CATALOG.find((entry) => entry.id === this.armedComponentId);
    if (!spec) return;

    this.pieceCounter += 1;
    const pieceId = `piece-${this.pieceCounter}` as WorkbenchPieceId;

    try {
      let next = addPiece(this.workbench, {
        id: pieceId,
        componentDefinitionId: spec.id,
        placement: { position: { x: cellX, y: cellY }, footprint: spec.data.footprint, rotation: 0 },
      });
      next = addSignalNode(
        next,
        `node-${pieceId}` as SignalNodeId,
        pieceId,
        "conductor",
        { x: cellX, y: cellY },
      );
      this.workbench = next;
      this.setStatus(`${spec.name} colocado en (${cellX}, ${cellY})`);
    } catch (error) {
      this.setStatus(`No se pudo colocar: ${(error as Error).message}`);
    }
    this.redraw();
  }

  /** Modo borrar: quita la pieza cuya huella cubre la celda clickeada (con sus nodos/cables, `removePiece`). */
  private tryDeleteAtCell(cellX: number, cellY: number): void {
    const target = this.workbench.pieces.find((piece) =>
      occupiedCells(piece.placement).some((cell) => cell.x === cellX && cell.y === cellY),
    );
    if (!target) return;
    this.workbench = removePiece(this.workbench, target.id);
    this.wireFirstNode = undefined;
    this.setStatus(t("ui.menu.workbench.delete-mode-hint"));
    this.redraw();
  }

  /** Cablear (simplificado, ver comentario de clase): click en dos piezas ya colocadas conecta sus nodos por defecto. */
  private tryWireAtCell(cellX: number, cellY: number): void {
    const node = this.workbench.signalGraph.nodes.find(
      (candidate) => candidate.position.x === cellX && candidate.position.y === cellY,
    );
    if (!node) return;

    if (!this.wireFirstNode) {
      this.wireFirstNode = node.id;
      this.setStatus(`Nodo origen seleccionado — click en otro nodo para cablear`);
      return;
    }

    try {
      this.workbench = connectNodes(
        this.workbench,
        `edge-${this.wireFirstNode}-${node.id}` as SignalEdgeId,
        this.wireFirstNode,
        node.id,
      );
      this.setStatus("Conectado.");
    } catch (error) {
      this.setStatus(`No se pudo conectar: ${(error as Error).message}`);
    }
    this.wireFirstNode = undefined;
    this.redraw();
  }

  private redraw(): void {
    // Modo química (feedback de playtest 11c.3): no hay nada que colocar en
    // grid (los elementos no tienen footprint), así que no se dibuja el grid
    // físico — antes quedaba visible de fondo detrás de la paleta. Esa área
    // se usa en su lugar para la selección/preview de resultado.
    if (this.mode === "quimica") {
      this.renderContainer?.destroy(true);
      this.renderContainer = undefined;
      this.renderChemistrySelection();
      return;
    }
    this.chemistryContainer?.destroy(true);
    this.chemistryContainer = undefined;
    this.renderContainer?.destroy(true);
    this.renderContainer = renderWorkbench(this, this.workbench, GRID_SIZE, this.nameByComponentId);
    this.renderContainer.setPosition(GRID_ORIGIN.x, GRID_ORIGIN.y);
  }

  /**
   * Fabricar en misión (11c.2): nombra la creación, la entrega a la misión para
   * que encole la tarea `combine` y cierra la mesa. No guarda en campaña ni
   * auto-instala (eso es el flujo creativo); instalar es un paso aparte tras la
   * fabricación (GDD 10.1, decisión del operador: 2 pasos).
   */
  private nameAndFabricate(context: MissionWorkbenchContext): void {
    if (this.workbench.pieces.length === 0) {
      this.setStatus("La mesa está vacía — colocá al menos una pieza antes de fabricar.");
      return;
    }
    this.promptCreationName((name) => {
      const creationComponentId = `creation-${Date.now()}` as ComponentId;
      const definition = nameAndRegisterCreation(this.factory, this.componentRegistry, this.workbench.pieces, {
        id: creationComponentId,
        name,
      });
      context.onFabricate(definition);
      context.onClose();
    });
  }

  /**
   * Sintetizar en misión (11c.3): antes de encolar, muestra un modal de
   * confirmación con el nombre y tags YA resueltos (feedback de playtest: la
   * mesa cerraba en silencio sin decir qué se había sintetizado). A
   * diferencia de una creación física, la sustancia resultante no se nombra a
   * mano — su nombre lo determina el motor (GDD 5.3) — así que el modal es de
   * solo confirmación, no de entrada de texto.
   */
  private synthesize(context: MissionWorkbenchContext): void {
    if (this.selectedElements.length < 2) {
      this.setStatus(t("ui.menu.workbench.synthesize-needs-two"));
      return;
    }
    const outcome = context.onPreviewSynthesis(this.selectedElements);
    if (!outcome) {
      this.setStatus(t("ui.menu.workbench.synthesize-needs-two"));
      return;
    }
    this.confirmSynthesis(context, outcome);
  }

  /** Modal de confirmación de síntesis (11c.3) — mismo patrón visual que `promptCreationName`, sin campo de texto. */
  private confirmSynthesis(context: MissionWorkbenchContext, outcome: ReactantSubstance): void {
    const self = this as unknown as SceneWithRexUI;
    const DEPTH = 1000;
    const backdrop = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.6).setDepth(DEPTH).setInteractive();
    const box = this.add
      .rectangle(640, 360, 520, 220, 0x141b26, 1)
      .setStrokeStyle(2, chemicalResultColor(outcome.tags), 1)
      .setDepth(DEPTH);
    const title = this.add
      .text(640, 288, t("ui.menu.workbench.confirm-synthesis-title"), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "16px",
        color: HEADER_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH);
    const nameText = this.add
      .text(640, 318, outcome.name, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "20px",
        color: HEADER_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH);
    const tagsText = this.add
      .text(640, 350, outcome.tags.map((tag) => this.chemicalTagLabel(tag)).join(" · "), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "12px",
        color: LABEL_COLOR,
        wordWrap: { width: 460 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH);

    // Los botones son `rexUI.add.label` (misma familia que `ScrollablePanel`,
    // ver `renderPalette`) — se destruyen con `.destroy()` sin `true` por la
    // misma razón: `destroy(true)` no cascada en objetos rexUI.
    const cleanup = (): void => {
      backdrop.destroy();
      box.destroy();
      title.destroy();
      nameText.destroy();
      tagsText.destroy();
      confirmButton.destroy();
      cancelButton.destroy();
    };
    const confirmButton = createKenneyButton(
      self,
      560,
      420,
      t("ui.menu.workbench.confirm-synthesis-confirm"),
      {
        width: 140,
        onClick: () => {
          cleanup();
          context.onSynthesize(this.selectedElements);
          context.onClose();
        },
      },
    ).setDepth(DEPTH);
    const cancelButton = createKenneyButton(self, 720, 420, t("ui.menu.workbench.confirm-synthesis-cancel"), {
      width: 140,
      onClick: cleanup,
    }).setDepth(DEPTH);
  }

  private nameSaveAndInstall(): void {
    if (this.workbench.pieces.length === 0) {
      this.setStatus("La mesa está vacía — colocá al menos una pieza antes de nombrar.");
      return;
    }
    this.promptCreationName((name) => void this.saveAndInstall(name));
  }

  /**
   * Diálogo de nombre in-scene (11c.2 fix): `window.prompt` NO existe en Electron
   * (devuelve vacío y el botón parecía no hacer nada). Captura el teclado sobre un
   * modal propio — Enter confirma, Esc cancela, Backspace borra —, así funciona
   * igual en Electron y en el browser.
   */
  private promptCreationName(onConfirm: (name: string) => void): void {
    const DEPTH = 1000;
    let value = "";
    const backdrop = this.add
      .rectangle(640, 360, 1280, 720, 0x000000, 0.6)
      .setDepth(DEPTH)
      .setInteractive();
    const box = this.add
      .rectangle(640, 360, 520, 150, 0x141b26, 1)
      .setStrokeStyle(2, 0x3a4658, 1)
      .setDepth(DEPTH);
    const title = this.add
      .text(640, 316, "Nombre de la creación:", {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "16px",
        color: HEADER_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH);
    const field = this.add
      .text(640, 356, "_", { fontFamily: "monospace", fontSize: "18px", color: HEADER_COLOR })
      .setOrigin(0.5)
      .setDepth(DEPTH);
    const hint = this.add
      .text(640, 394, "Enter = confirmar · Esc = cancelar", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: LABEL_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH);

    const cleanup = (): void => {
      this.input.keyboard?.off("keydown", onKey);
      backdrop.destroy();
      box.destroy();
      title.destroy();
      field.destroy();
      hint.destroy();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Enter") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          cleanup();
          onConfirm(trimmed);
        }
        return;
      }
      if (event.key === "Escape") {
        cleanup();
        return;
      }
      if (event.key === "Backspace") {
        value = value.slice(0, -1);
      } else if (event.key.length === 1 && value.length < 28) {
        value += event.key;
      }
      field.setText(`${value}_`);
    };
    this.input.keyboard?.on("keydown", onKey);
  }

  private async saveAndInstall(name: string): Promise<void> {
    // Un solo timestamp para el id del componente y el del guardado: usar dos
    // `Date.now()` distintos hacía que `definition.id` y `metadata.id` no
    // coincidieran (id de la pieza ≠ id del archivo guardado), confuso al listar.
    const stamp = Date.now();
    const creationComponentId = `creation-${stamp}` as ComponentId;
    const definition = nameAndRegisterCreation(this.factory, this.componentRegistry, this.workbench.pieces, {
      id: creationComponentId,
      name,
    });

    const now = new Date().toISOString();
    await saveCustomCreation({
      metadata: {
        schemaVersion: 1,
        id: `creation-${stamp}` as CustomCreationId,
        engineVersion: "0.0.0",
        createdAt: now,
        updatedAt: now,
      },
      definition,
    });

    const activeCampaign = campaignSession.current;
    if (activeCampaign && definition.level === "composite" && definition.data.footprint) {
      const section = CANONICAL_SHIP_FLOORPLANS[activeCampaign.metadata.archetype].sections[0];
      if (section) {
        const result = installCreationInFloorplan(
          activeCampaign.shipState,
          section,
          creationComponentId,
          definition.data.footprint,
          section.cells[0] ?? { x: 0, y: 0 },
          0,
          `${creationComponentId}-instance` as PlacedComponentInstanceId,
        );
        if (result.outcome === "installed") {
          campaignSession.load({ ...activeCampaign, shipState: result.blueprint });
          this.setStatus(`"${name}" guardada e instalada en ${t(section.nameKey)}.`);
          return;
        }
        this.setStatus(`"${name}" guardada. No se pudo instalar automáticamente (sin espacio libre).`);
        return;
      }
    }
    this.setStatus(`"${name}" guardada.`);
  }
}
