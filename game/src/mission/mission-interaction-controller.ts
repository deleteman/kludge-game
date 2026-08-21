import type Phaser from "phaser";
import type ScrollablePanel from "phaser3-rex-plugins/templates/ui/scrollablepanel/ScrollablePanel.js";
import {
  effectiveResistance,
  ATOMIC_COMPONENT_CATALOG,
  assertSignalWiringReachable,
  findFittingInstallPlacement,
  isCompositeEntity,
  occupiedCells,
  sectionContainingCell,
  SignalWiringUnreachableError,
  validateInstallation,
  wireExternalPort,
} from "engine";
import type {
  ChemicalSubstanceId,
  ChemicalTag,
  CrewActorId,
  FunctionalProperty,
  GridPosition,
  PhysicalComponentDefinition,
  PlacedComponentInstance,
  PlacedComponentInstanceId,
  SignalEdgeId,
  SignalNodeId,
} from "engine";

import { EXTRACTION_BATCH_UNITS } from "engine";
import { t } from "../i18n/i18n.js";
import { CHEMICAL_TAG_COLORS, LABEL_COLOR, WIRE_HIGHLIGHT_COLOR } from "../render/palette.js";
import { RENDER_DEPTH } from "../render/render-depths.js";
import {
  ACTION_PANEL_HEIGHT_KEY,
  renderMissionActionPanel,
  type ActionPanelContent,
  type AvailableSubstanceEntry,
  type CompositionIngredient,
  type SubstanceDetailLine,
} from "../ui/widgets/mission-action-panel.js";
import { renderInstallPickerModal, type InstallPickerOption } from "../ui/widgets/install-picker-modal.js";
import type { ReservoirPanelInfo } from "../ui/widgets/mission-action-panel.js";
import type { TooltipContent } from "../ui/widgets/mission-tooltip.js";
import type { SceneWithRexUI } from "../ui/scene-with-rex-ui.types.js";
import type { MissionRuntime } from "./mission-runtime.js";
import { AUDIO_KEYS } from "../audio/audio-asset-registry.js";
import { pickSoundKey } from "../audio/audio-utils.js";

export interface MissionInteractionGeometry {
  /**
   * Tamaño del panel de acciones flotante (Subfase 11g: ya no docked en la
   * columna lateral, así que no tiene X/Y fijos — el llamador lo posiciona
   * cada frame vía `repositionActionPanel`, siguiendo la selección).
   */
  readonly actionPanelWidth: number;
  readonly actionPanelHeight: number;
  /**
   * Techo del panel (ronda 3 de fixes de 13e). `actionPanelHeight` es solo el
   * MÍNIMO: el contenido lo hace crecer, y sin techo un reservorio con avisos de
   * riesgo se pasaba del borde inferior de la pantalla dejando su último botón
   * ("Extraer") fuera de vista. Superado el techo, el panel hace scroll interno.
   */
  readonly actionPanelMaxHeight: number;
}

export const STRUCTURAL_RESISTANCE_LEVEL_KEY: Readonly<Record<"A" | "M" | "B", string>> = {
  A: "alta",
  M: "media",
  B: "baja",
};

export interface MissionInteractionCallbacks {
  readonly setStatus: (text: string) => void;
  /** Se llama tras encolar/cancelar una tarea — el llamador redibuja el panel de cola. */
  readonly onTaskQueued: () => void;
  /** Se llama al entrar/salir de modo cableado — el llamador reetiqueta su propio botón y redibuja los highlights de nodos. */
  readonly onWireModeChanged: () => void;
  /** Se llama cuando cambia el nodo origen elegido en modo cableado — el llamador reposiciona su highlight. */
  readonly onWireSelectionChanged: () => void;
  /** El panel de acciones se recrea en cada cambio — hay que re-registrarlo como objeto de HUD en la cámara de mundo cada vez (ver `floorplan-scene.ts`). */
  readonly markAsHudObject: (obj: Phaser.GameObjects.GameObject) => void;
  /** Se llama cuando cambia la celda seleccionada (click en el plano / vuelta a idle) — el llamador reposiciona el marcador persistente de celda. */
  readonly onSelectionChanged: () => void;
  /**
   * Abre la mesa de creación desde un aparato del plano (Subfase 13e). La mesa
   * dejó de tener botón global: el dominio (física/química) sale de la propia
   * pieza, así que la escena solo necesita el `instanceId`.
   */
  readonly onOpenFabricator: (instanceId: PlacedComponentInstanceId) => void;
  /**
   * Se llama al entrar/salir del modo de selección espacial de trasvase, y
   * cuando cambia el estado de sus candidatos (ronda 7) — el llamador
   * construye/destruye el overlay de oscurecido, los resaltados de reservorio
   * y fuerza la capa de conductos `fluido` visible mientras el modo esté
   * activo (mismo criterio que `onWireModeChanged`/`onWireSelectionChanged`).
   */
  readonly onTransferModeChanged: () => void;
}

/**
 * Estado y lógica de interacción de la misión (Fase 10d, rework en Subfase
 * 11g): selección de tripulante activo, click en una celda del plano YA
 * resuelta a coordenadas de mundo por la escena (la escena es la dueña de la
 * cámara/el paneo — este controller no conoce `pointer.x/y` de pantalla en
 * absoluto) y modo cableado. El panel de acciones (`mission-action-panel.ts`)
 * dejó de ser DOCKED permanente (Fase 10d) — ahora es CONTEXTUAL: solo existe
 * mientras `actionPanelContent.kind !== "idle"`, y la escena lo reposiciona
 * cada frame en coordenadas de pantalla (`repositionActionPanel`) siguiendo
 * la celda seleccionada o el botón que lo abrió (ej. "Sustancias" del HUD
 * permanente, `ship-status-hud.ts`), ya que puede flotar sobre el mapa.
 */
export class MissionInteractionController {
  private selectedActorIdValue?: CrewActorId;
  private wireModeValue = false;
  private wireFirstNodeId?: SignalNodeId;
  /**
   * Modo de selección espacial de destino de trasvase (ronda 7 de fixes de
   * playtest), hermano estructural de `wireModeValue`/`wireFirstNodeId`: el
   * jugador elige "Trasvasar" en el panel de una instancia, el panel se
   * cierra y el mapa entra en este modo hasta que se elige un destino válido
   * o se cancela. `FloorplanScene` lee `transferMode`/`transferModeCandidates`
   * cada frame para oscurecer el plano e iluminar los candidatos.
   */
  private transferModeState?: {
    readonly fromInstanceId: PlacedComponentInstanceId;
    readonly candidates: ReadonlyArray<{
      readonly instanceId: PlacedComponentInstanceId;
      readonly blocked?: "full" | "unreachable" | "different-substance";
    }>;
  };
  private actionPanelContent: ActionPanelContent = { kind: "idle" };
  private actionPanelContainer?: Phaser.GameObjects.Container;
  /**
   * Posición manual del panel tras un arrastre (ronda 5, pedido del operador).
   * Se limpia al cambiar el OBJETIVO del panel (nueva celda/instancia/sustancia
   * seleccionada, o cierre) — el arrastre es un ajuste de ESTA selección, no
   * una posición que persiga al jugador entre piezas distintas. Sobrevive a
   * los rebuilds por refresco de contenido vivo (`refreshActionPanel`), que no
   * tocan la selección.
   */
  private manualPanelPositionValue?: { readonly x: number; readonly y: number };
  /** Celda actualmente marcada (sobre la que se va a actuar); `undefined` sin selección. */
  private selectedCellValue?: GridPosition;
  private installPickerState?: {
    readonly position: GridPosition;
    /** Lista unificada (ronda 8): habilitados primero, bloqueados después con su motivo — ver `buildInstallOptions`. */
    readonly options: ReadonlyArray<InstallPickerOption>;
    readonly selectedIndex: number;
  };
  private installPickerContainer?: Phaser.GameObjects.Container;
  /** Panel scrolleable vivo de la lista del selector, para preservar su scroll entre rebuilds (deuda #2). */
  private installPickerList?: ScrollablePanel;
  /** Fracción de scroll (0..1) a restaurar en el próximo rebuild del selector. */
  private installPickerScrollT = 0;

  constructor(
    private readonly scene: SceneWithRexUI,
    private readonly mission: MissionRuntime,
    private readonly nameByComponentId: ReadonlyMap<string, string>,
    private readonly geometry: MissionInteractionGeometry,
    private readonly callbacks: MissionInteractionCallbacks,
  ) {
    this.redrawActionPanel();
  }

  get selectedActorId(): CrewActorId | undefined {
    return this.selectedActorIdValue;
  }

  /** Celda marcada actualmente (para el resaltado persistente de `FloorplanScene`), o `undefined`. */
  get selectedCell(): GridPosition | undefined {
    return this.selectedCellValue;
  }

  /**
   * Celdas que realmente ocuparía la instalación en curso (footprint completo
   * de la opción enfocada en el picker, en la posición donde de verdad
   * encajaría — `findFittingInstallPlacement`, motor, misma resolución que usa
   * `confirmInstall`), para que `FloorplanScene` resalte el footprint entero
   * en vez de una sola celda y así no tape overlaps sin querer (playtest,
   * Subfase 11h). `undefined` si no hay picker abierto o la opción enfocada no
   * encaja en ningún lado (sin resaltado, se mantiene el 1x1 de `selectedCell`).
   */
  get installPickerHighlightCells(): ReadonlyArray<GridPosition> | undefined {
    if (!this.installPickerState) return undefined;
    const state = this.installPickerState;
    const option = state.options[state.selectedIndex];
    if (!option) return undefined;
    const section = sectionContainingCell(this.mission.shipFloorplan, state.position);
    if (!section) return undefined;
    const fitPosition = findFittingInstallPlacement(
      section,
      this.mission.blueprint.placedComponents,
      option.footprint,
      state.position,
    );
    if (!fitPosition) return undefined;
    return occupiedCells({ position: fitPosition, footprint: option.footprint, rotation: 0 });
  }

  /**
   * `true` si hay contenido contextual que mostrar (Subfase 11g): la escena
   * lo usa para decidir si debe reposicionar/mostrar el panel flotante cada
   * frame, sin conocer los detalles de `ActionPanelContent`.
   */
  get hasContextualSelection(): boolean {
    return this.actionPanelContent.kind !== "idle";
  }

  /**
   * Alto REALMENTE ocupado por el panel montado (13d ronda 2): crece con los
   * avisos de riesgo y sus botones, así que el nominal de `geometry` es solo un
   * mínimo. La escena lo necesita para el clamp de borde y para los bounds que
   * bloquean el click al mapa.
   */
  get actionPanelHeight(): number {
    const measured = this.actionPanelContainer?.getData(ACTION_PANEL_HEIGHT_KEY) as number | undefined;
    return measured ?? this.geometry.actionPanelHeight;
  }

  /** Reposiciona el panel de acciones flotante (Subfase 11g) — no-op si no hay panel montado (`idle`). Llamado cada frame por la escena. */
  repositionActionPanel(point: { readonly x: number; readonly y: number }): void {
    this.actionPanelContainer?.setPosition(point.x, point.y);
  }

  /** Posición manual del panel tras un arrastre (ronda 5), o `undefined` si sigue anclado a la selección. */
  get manualPanelPosition(): { readonly x: number; readonly y: number } | undefined {
    return this.manualPanelPositionValue;
  }

  private setSelectedCell(cell: GridPosition | undefined): void {
    const changed =
      (this.selectedCellValue?.x !== cell?.x) || (this.selectedCellValue?.y !== cell?.y);
    this.selectedCellValue = cell;
    if (changed) this.callbacks.onSelectionChanged();
  }

  selectActor(actorId: CrewActorId): void {
    this.selectedActorIdValue = actorId;
    this.redrawActionPanel();
  }

  get wireMode(): boolean {
    return this.wireModeValue;
  }

  /** Nodo origen elegido en modo cableado (para el highlight de `FloorplanScene`), o `undefined`. */
  get wireFirstNode(): SignalNodeId | undefined {
    return this.wireFirstNodeId;
  }

  toggleWireMode(): void {
    this.wireModeValue = !this.wireModeValue;
    this.setWireFirstNode(undefined);
    // Guía paso a paso al activar: qué clickear primero (playtest #15).
    this.callbacks.setStatus(this.wireModeValue ? t("ui.floorplan.mission.wire-mode-hint-first") : "");
    this.callbacks.onWireModeChanged();
  }

  /** `true` mientras el jugador está eligiendo destino de trasvase en el mapa (ronda 7). */
  get transferMode(): boolean {
    return this.transferModeState !== undefined;
  }

  /** Instancia origen del trasvase en curso, o `undefined` fuera del modo. */
  get transferModeOrigin(): PlacedComponentInstanceId | undefined {
    return this.transferModeState?.fromInstanceId;
  }

  /** Candidatos vivos del trasvase en curso (con su motivo de bloqueo), o `[]` fuera del modo. */
  get transferModeCandidates(): ReadonlyArray<{
    readonly instanceId: PlacedComponentInstanceId;
    readonly blocked?: "full" | "unreachable" | "different-substance";
  }> {
    return this.transferModeState?.candidates ?? [];
  }

  /**
   * Abre el modo de selección espacial de destino (ronda 7, reemplaza el
   * auto-pick ciego del MVP y el picker en lista descartado en el mismo
   * playtest): cierra el panel de acciones (el foco pasa al mapa, mismo
   * criterio que el modo cableado) y calcula los candidatos vivos.
   */
  startTransferMode(fromInstanceId: PlacedComponentInstanceId): void {
    this.transferModeState = {
      fromInstanceId,
      candidates: this.mission.transferCandidatesFor(fromInstanceId),
    };
    this.setActionPanelContent({ kind: "idle" });
    this.callbacks.setStatus(t("ui.floorplan.mission.transfer-mode-hint"));
    this.callbacks.onTransferModeChanged();
  }

  cancelTransferMode(): void {
    if (!this.transferModeState) return;
    this.transferModeState = undefined;
    this.callbacks.setStatus("");
    this.callbacks.onTransferModeChanged();
  }

  /**
   * Click en el mapa mientras el modo de trasvase está activo (llamado desde
   * `handleMapClick`, mismo lugar donde ya se intercepta `wireModeValue`). Una
   * celda que no es ningún candidato no hace nada; un candidato bloqueado
   * explica el motivo sin salir del modo (mismo criterio de "nunca un botón
   * gris mudo" ya aplicado a los otros bloqueos de reservorio); uno disponible
   * encola el trasvase y cierra el modo.
   */
  handleTransferModeClick(position: GridPosition): void {
    if (!this.transferModeState) return;
    const instance = this.findInstanceAtCell(position);
    if (!instance) return;
    // Recalculado EN EL MOMENTO DEL CLICK (ronda 8), no leído de la lista
    // cacheada al abrir el modo: el estado del destino pudo cambiar mientras
    // el modo seguía abierto (otra tarea completándose), y un candidato
    // "verde" desactualizado es el mecanismo más plausible detrás del aviso
    // de pérdida reportado en playtest — ver plan de la ronda 8.
    const fromInstanceIdForRecalc = this.transferModeState.fromInstanceId;
    const freshCandidates = this.mission.transferCandidatesFor(fromInstanceIdForRecalc);
    const candidate = freshCandidates.find((entry) => entry.instanceId === instance.instanceId);
    if (!candidate) return;
    if (candidate.blocked) {
      this.callbacks.setStatus(t(`ui.floorplan.mission.transfer-mode-blocked.${candidate.blocked}`));
      return;
    }
    const fromInstanceId = this.transferModeState.fromInstanceId;
    const content = this.mission.reservoirContentOf(fromInstanceId);
    if (!this.selectedActorIdValue || !content) return;
    this.mission.queueTransferSubstance(
      this.selectedActorIdValue,
      fromInstanceId,
      instance.instanceId,
      content.amount,
    );
    this.cancelTransferMode();
    this.callbacks.onTaskQueued();
  }

  /** Cambia el nodo origen y notifica a la escena para reposicionar su highlight. */
  private setWireFirstNode(nodeId: SignalNodeId | undefined): void {
    this.wireFirstNodeId = nodeId;
    this.callbacks.onWireSelectionChanged();
  }

  /** El selector de instalación es un modal bloqueante — mientras está abierto, la escena no debe procesar paneo/click de mapa. */
  get installPickerOpen(): boolean {
    return this.installPickerState !== undefined;
  }

  /**
   * Fuerza un redibujo del panel de acciones (Fase 11e): la escena lo llama
   * en cada `task-completed` que no sea `go-to` — una síntesis (`combine`)
   * puede haber sumado una sustancia nueva a la lista idle, y un "Analizar
   * Sustancia" completado cambia el estado `analyzed` de la que ya se estaba
   * mostrando. Sin esto, el operador vería la ficha desactualizada hasta la
   * próxima interacción manual.
   */
  refreshActionPanel(): void {
    this.redrawActionPanel();
  }

  /**
   * ¿Un click en esta celda haría algo? Misma regla que `handleMapClick`: un
   * componente ya colocado siempre es interactuable; una celda vacía solo si
   * pertenece a una sección (ahí se podría instalar). Lo usa `FloorplanScene`
   * para el resaltado de hover — no duplicar la regla en la escena.
   */
  isCellInteractable(position: GridPosition): boolean {
    if (this.findInstanceAtCell(position)) return true;
    return sectionContainingCell(this.mission.shipFloorplan, position) !== undefined;
  }

  /**
   * Contenido del tooltip de la celda bajo el cursor (playtest de Fase 11d:
   * antes esto era solo un nombre y toda la ficha real —condición, propiedades,
   * composición— vivía detrás de un click; el operador pidió que el hover ya
   * muestre todo). El COMPONENTE colocado ahí tiene prioridad sobre la ZONA que
   * lo contiene. `undefined` si la celda no tiene ni componente ni sección.
   */
  tooltipContentAt(position: GridPosition): TooltipContent | undefined {
    const instance = this.findInstanceAtCell(position);
    if (instance) {
      const definition = this.mission.definitionOf(instance.componentDefinitionId);
      return {
        kind: "instance",
        // Prioriza el registry REAL de la misión (conoce compuestos de
        // cualquier catálogo y semillas Tiled) sobre el cache parcial
        // `nameByComponentId` de `floorplan-scene.ts` (playtest ronda 2: ese
        // cache nunca incluyó compuestos de catálogo ni semillas, caía al
        // ComponentId crudo como "valvula-simple").
        name: definition?.name ?? this.nameByComponentId.get(instance.componentDefinitionId) ?? instance.componentDefinitionId,
        condition: instance.condition,
        wear: instance.wear,
        functional: definition?.data.functional,
        material: definition?.data.material,
        // Fase 13c: la ficha muestra la resistencia REAL (catálogo + desgaste),
        // no la de catálogo. Antes mentía en cuanto la pieza se corroía o se
        // canibalizaba — decía "A" mientras el motor la trataba como "M".
        effectiveResistance:
          effectiveResistance(
            definition?.data.material?.RE,
            instance.wear,
            instance.structuralResistanceOverride,
          ) ?? undefined,
        composition: definition ? this.buildComposition(definition) : undefined,
      };
    }
    const section = sectionContainingCell(this.mission.shipFloorplan, position);
    return section ? { kind: "section", name: t(section.nameKey) } : undefined;
  }

  /** Click sobre una celda del plano, ya resuelta en coordenadas de mundo por `FloorplanScene`. */
  handleMapClick(position: GridPosition): void {
    if (this.installPickerOpen) return;
    if (this.wireModeValue) {
      this.handleWireModeClick(position);
      return;
    }
    if (this.transferModeState) {
      this.handleTransferModeClick(position);
      return;
    }

    // Un componente ya colocado siempre es inspeccionable, aunque su celda
    // caiga justo en el borde de la sección (ej. el anclaje del capítulo 1 en
    // Exploración, ver `chapter-01-primer-aviso.ts`) — la pertenencia a
    // sección solo importa para decidir si se puede INSTALAR algo nuevo ahí
    // (lo valida `validateInstallation` más abajo, con la sección real).
    const instance = this.findInstanceAtCell(position);
    if (!instance && !sectionContainingCell(this.mission.shipFloorplan, position)) {
      return;
    }

    // Marca la celda sobre la que se va a actuar (resaltado persistente, bug 6).
    this.scene.sound.play(pickSoundKey(AUDIO_KEYS.mapCellSelect), { volume: 0.4 });
    this.setSelectedCell(position);

    if (instance) {
      // El panel de acciones ya NO repite propiedades/composición — esa info
      // vive en el tooltip de hover (`tooltipContentAt`); acá solo queda lo
      // necesario para decidir/ejecutar la acción (nombre, condición, botón).
      this.setActionPanelContent({
        kind: "instance",
        instanceId: instance.instanceId,
        name: this.nameByComponentId.get(instance.componentDefinitionId) ?? instance.componentDefinitionId,
        condition: instance.condition,
        // El riesgo NO se hornea acá (fix de playtest ronda 1): `redrawActionPanel`
        // lo re-deriva contra el motor en cada dibujo, así que bajar el dial de
        // energía apaga el badge en el acto, sin reabrir el panel.
      });
    } else {
      this.setActionPanelContent({ kind: "empty", position });
    }
  }

  /** Etiqueta traducida de un tag químico (mismo criterio que `creative-workbench-scene.ts::chemicalTagLabel`). */
  private chemicalTagLabel(tag: ChemicalTag): string {
    return t(`chemistry.tag.${tag.name}`);
  }

  /** Convierte un color numérico de la paleta a la notación CSS que usan los widgets Phaser (mismo patrón que `CONDITION_COLOR` de `mission-tooltip.ts`). */
  private static hexColor(color: number): string {
    return `#${color.toString(16).padStart(6, "0")}`;
  }

  /** Glifo por tag químico (fix de playtest de Fase 11e: "iconografía básica" pedida por el operador) — mismo criterio liviano que `CONDITION_ICON` de `mission-tooltip.ts`, sin sprite nuevo. */
  private static readonly TAG_ICON: Readonly<Record<ChemicalTag["name"], string>> = {
    OXI: "🔆",
    COMB: "🔥",
    ACID: "•",
    BASE: "•",
    INERTE: "•",
    VOLAT: "💨",
    TOX: "☠",
    CORR: "🧪",
  };

  /** Línea de tag genérico: color curado de `CHEMICAL_TAG_COLORS` (mismo que la mesa/el plano, principio 6) + su glifo. */
  private chemicalTagDetailLine(tag: ChemicalTag): SubstanceDetailLine {
    return {
      text: this.chemicalTagLabel(tag),
      color: MissionInteractionController.hexColor(CHEMICAL_TAG_COLORS[tag.name]),
      icon: MissionInteractionController.TAG_ICON[tag.name],
    };
  }

  /**
   * Líneas de detalle de una sustancia para el panel de acciones (Fase 11e):
   * tags genéricos siempre; si ya fue analizada, además los valores exactos
   * de riesgo (`MissionRuntime.hazardPreviewFor`, recalculado en vivo contra
   * la sección ACTUAL del tripulante seleccionado — es quien tiene la muestra
   * en mano). Sin tripulante seleccionado, usa la primera sección del plano
   * como referencia neutra (no hay reservorio/ubicación propia para una
   * sustancia suelta todavía, ver PENDIENTES_OBSERVACIONES.md punto 9).
   *
   * Fix de playtest: las líneas de riesgo YA REVELADO (y el aviso de "sin
   * analizar") se pintan en el mismo ámbar de resaltado que ya usa
   * `composition-list.ts` para "esto es lo importante" — se distinguen a
   * simple vista de los tags genéricos de arriba, que quedan en su color de
   * tag normal.
   */
  private buildSubstanceDetailLines(substanceId: ChemicalSubstanceId): ReadonlyArray<SubstanceDetailLine> {
    const definition = this.mission.availableSubstances.find((entry) => entry.id === substanceId);
    if (!definition) return [];
    const amber = MissionInteractionController.hexColor(WIRE_HIGHLIGHT_COLOR);
    const tagLines = definition.data.tags.map((tag) => this.chemicalTagDetailLine(tag));
    if (!this.mission.isSubstanceAnalyzed(substanceId)) {
      return [...tagLines, { text: t("ui.floorplan.mission.hazard.not-analyzed"), color: LABEL_COLOR, icon: "❔" }];
    }
    const sectionId =
      (this.selectedActorIdValue && this.mission.plannedSectionFor(this.selectedActorIdValue)) ??
      this.mission.shipFloorplan.sections[0]?.id;
    if (!sectionId) return tagLines;
    const preview = this.mission.hazardPreviewFor(substanceId, sectionId);
    if (!preview) return tagLines;
    const hazardLines: SubstanceDetailLine[] = [];
    if (preview.combustible) {
      const radiusKey = preview.combustionRadius
        ? `ui.floorplan.mission.hazard.combustion-radius.${preview.combustionRadius}`
        : "ui.floorplan.mission.hazard.combustion-radius.none";
      hazardLines.push({
        text: t("ui.floorplan.mission.hazard.combustion-radius").replace("{value}", t(radiusKey)),
        color: amber,
        icon: "🔥",
      });
    }
    if (preview.corrosive && preview.corrosionSecondsPerLevel) {
      hazardLines.push({
        text: t("ui.floorplan.mission.hazard.corrosion-rate")
          .replace("{medium}", String(preview.corrosionSecondsPerLevel.medium))
          .replace("{high}", String(preview.corrosionSecondsPerLevel.high)),
        color: amber,
        icon: "🧪",
      });
    }
    return [...tagLines, ...hazardLines];
  }

  /**
   * Abre la lista de sustancias sintetizadas en el panel contextual (Subfase
   * 11g) — disparada desde el botón "Sustancias" del HUD permanente
   * (`ship-status-hud.ts`), reemplaza la lista que antes vivía embebida en el
   * estado `idle` del panel de acciones (Fase 11e).
   */
  openSubstancesList(): void {
    this.setSelectedCell(undefined);
    this.setActionPanelContent({
      kind: "substances-list",
      substances: this.mission.availableSubstances.map((definition): AvailableSubstanceEntry => ({
        substanceId: definition.id,
        name: definition.name,
        analyzed: this.mission.isSubstanceAnalyzed(definition.id),
      })),
    });
  }

  /** Selecciona una sustancia sintetizada de la lista (Subfase 11g, antes del panel idle en Fase 11e) — abre su ficha en el panel de acciones. */
  selectSubstance(substanceId: ChemicalSubstanceId): void {
    const definition = this.mission.availableSubstances.find((entry) => entry.id === substanceId);
    if (!definition) return;
    // No es una celda del plano — a diferencia de `handleMapClick`, no hay
    // resaltado de mundo que corresponda a esta selección.
    this.setSelectedCell(undefined);
    this.setActionPanelContent({
      kind: "substance",
      substanceId,
      name: definition.name,
      analyzed: this.mission.isSubstanceAnalyzed(substanceId),
      detailLines: this.buildSubstanceDetailLines(substanceId),
    });
  }

  /**
   * Tag funcional que la crisis activa necesita en su resolución principal
   * (rework "sin stock → inspeccionar → desarmar → reutilizar") — usado para
   * resaltar en la ficha/inspector qué ingrediente de un compuesto resuelve
   * la crisis. `undefined` si la crisis del capítulo no usa esa resolución
   * (ej. capítulo 2, puramente de señales).
   */
  private get requiredFunctionalTag(): FunctionalProperty["tag"] | undefined {
    const resolution = this.mission.crisisDefinition.resolutions.find(
      (candidate) => candidate.kind === "functional-tag-installed",
    );
    return resolution && "requiredTag" in resolution ? resolution.requiredTag : undefined;
  }

  /**
   * Desglose de composición de un compuesto (`definition.recipe.ingredients`
   * resuelto a nombre + si esa pieza tiene el tag funcional requerido) — el
   * motor ya expone la receta, esto es pura lectura sin mutar nada. `undefined`
   * para una definición atómica (nada que desglosar).
   */
  private buildComposition(
    definition: PhysicalComponentDefinition,
  ): ReadonlyArray<CompositionIngredient> | undefined {
    if (!isCompositeEntity(definition)) return undefined;
    const requiredTag = this.requiredFunctionalTag;
    return definition.recipe.ingredients.map((ingredient) => {
      const ingredientDefinition = this.mission.definitionOf(ingredient.ref);
      return {
        componentId: ingredient.ref,
        name: ingredientDefinition?.name ?? this.nameByComponentId.get(ingredient.ref) ?? ingredient.ref,
        quantity: ingredient.quantity,
        hasRequiredTag:
          requiredTag !== undefined &&
          (ingredientDefinition?.data.functional ?? []).some((prop) => prop.tag === requiredTag),
      };
    });
  }

  /**
   * Estado del reservorio para el panel (13e). Devuelve `undefined` si la pieza
   * no es un reservorio de sustancia — así el panel no pinta la sección de
   * contenido para una batería o un chip.
   */
  private buildReservoirInfo(
    instanceId: PlacedComponentInstanceId,
  ): ReservoirPanelInfo | undefined {
    const capacity = this.mission.reservoirCapacityOf(instanceId);
    if (capacity === undefined) {
      return undefined;
    }
    const content = this.mission.reservoirContentOf(instanceId);
    return {
      substanceName: content && this.mission.substanceNameOf(content.substanceId),
      amount: content?.amount ?? 0,
      capacity,
      extractionBlocked: this.mission.extractionBlockedFor(instanceId),
      canTransfer: this.mission.transferCandidatesFor(instanceId).length > 0,
      // 13e ronda 4: para poder ofrecer "Analizar" acá mismo y no obligar a
      // pasar por la lista de sustancias del HUD.
      substanceId: content?.substanceId,
      analyzed: content ? this.mission.isSubstanceAnalyzed(content.substanceId) : undefined,
    };
  }

  private findInstanceAtCell(position: GridPosition): PlacedComponentInstance | undefined {
    return this.mission.blueprint.placedComponents.find((instance) =>
      occupiedCells(instance.placement).some((cell) => cell.x === position.x && cell.y === position.y),
    );
  }

  private handleWireModeClick(position: GridPosition): void {
    const node = this.mission.blueprint.signalGraph.nodes.find(
      (candidate) => candidate.position.x === position.x && candidate.position.y === position.y,
    );
    if (!node) return;
    // Feedback sonoro al clickear un nodo en modo cableado (12c.7, PENDIENTES obs #6).
    this.scene.sound.play(pickSoundKey(AUDIO_KEYS.mapCellSelect), { volume: 0.4 });

    // Primer nodo: se elige como origen y se guía al segundo.
    if (!this.wireFirstNodeId) {
      this.setWireFirstNode(node.id);
      this.callbacks.setStatus(t("ui.floorplan.mission.wire-mode-hint-second"));
      return;
    }
    // Click sobre el mismo nodo: lo deselecciona (volvé a empezar).
    if (this.wireFirstNodeId === node.id) {
      this.setWireFirstNode(undefined);
      this.callbacks.setStatus(t("ui.floorplan.mission.wire-mode-hint-first"));
      return;
    }
    // Falta tripulante: NO se pierde el primer nodo — se pide seleccionar uno y
    // reintentar el destino (playtest #15, antes reseteaba y frustraba).
    if (!this.selectedActorIdValue) {
      this.callbacks.setStatus(t("ui.floorplan.mission.wire-mode-need-actor"));
      return;
    }

    try {
      // Validación descartable: confirma que el par de nodos es cableable
      // ANTES de encolar la tarea (mismo criterio que el resto del proyecto).
      // Primero la regla de conductos (Fase 11f): un cable de señal no cruza a
      // otra sección sin un conducto `senal` — mensaje localizado propio; el
      // resto de errores de cableado muestra su texto crudo, como antes.
      assertSignalWiringReachable(
        this.mission.shipFloorplan,
        this.mission.blueprint.signalGraph,
        this.wireFirstNodeId,
        node.id,
      );
      wireExternalPort(this.mission.blueprint, `preview-${Date.now()}` as SignalEdgeId, this.wireFirstNodeId, node.id);
    } catch (error) {
      this.callbacks.setStatus(
        error instanceof SignalWiringUnreachableError
          ? t("ui.floorplan.mission.wire-no-conduit")
          : `${(error as Error).message}`,
      );
      this.setWireFirstNode(undefined);
      return;
    }

    this.mission.queueConnect(this.selectedActorIdValue, this.wireFirstNodeId, node.id);
    this.setWireFirstNode(undefined);
    this.wireModeValue = false;
    this.callbacks.setStatus("");
    this.callbacks.onWireModeChanged();
    this.callbacks.onTaskQueued();
  }

  private setActionPanelContent(content: ActionPanelContent): void {
    this.actionPanelContent = content;
    // Nuevo objetivo de panel: el arrastre de la ronda 5 es un ajuste de ESTA
    // selección, no una posición que persiga al jugador entre piezas distintas.
    this.manualPanelPositionValue = undefined;
    // Volver a idle (tras desmontar/instalar) desmarca la celda seleccionada.
    if (content.kind === "idle") this.setSelectedCell(undefined);
    this.redrawActionPanel();
  }

  private redrawActionPanel(): void {
    this.actionPanelContainer?.destroy(true);
    this.actionPanelContainer = undefined;
    // `idle` significa "sin panel" (Subfase 11g) — el panel contextual solo
    // existe ante una selección/interacción válida, no se renderiza más.
    if (this.actionPanelContent.kind === "idle") return;
    // Riesgo de desmontaje re-evaluado en CADA dibujo contra el mundo vivo
    // (13d, fix de playtest ronda 1): antes se fijaba al seleccionar la pieza y
    // quedaba congelado, así que cortar la energía no apagaba el aviso.
    const content: ActionPanelContent =
      this.actionPanelContent.kind === "instance"
        ? {
            ...this.actionPanelContent,
            dismantleHazards: this.mission.dismantleHazardsFor(this.actionPanelContent.instanceId),
            canDischargeSource: this.mission.canDischargeSource(this.actionPanelContent.instanceId),
            // Subfase 13e: mismo criterio de "derivado del mundo vivo" — el
            // contenido de un reservorio cambia mientras el panel está abierto
            // (una extracción en curso lo vacía), y analizar una sustancia
            // desbloquea la extracción sin cerrar el panel.
            reservoir: this.buildReservoirInfo(this.actionPanelContent.instanceId),
            fabricatorDomain: this.mission.fabricatorDomainOfInstance(
              this.actionPanelContent.instanceId,
            ),
            // La mesa exige pausa (13e ronda 2). Se deriva acá, con el resto
            // del estado vivo, para que el botón se re-habilite solo al pausar
            // sin tener que cerrar y reabrir el panel.
            fabricatorBlocked:
              this.mission.coreLoop.mode === "planning" ? undefined : ("execution" as const),
          }
        : this.actionPanelContent;
    this.actionPanelContainer = renderMissionActionPanel(
      this.scene,
      this.geometry.actionPanelWidth,
      this.geometry.actionPanelHeight,
      this.geometry.actionPanelMaxHeight,
      content,
      this.selectedActorIdValue !== undefined,
      {
        idleTitle: t("ui.floorplan.mission.inspector.idle-title"),
        idleMessage: t("ui.floorplan.mission.inspector.idle-message"),
        instanceTitle: (name, condition) => `${name} — ${condition}`,
        emptyTitle: t("ui.floorplan.mission.inspector.empty-title"),
        emptyHint: t("ui.floorplan.mission.inspector.empty-hint"),
        dismantle: t("ui.floorplan.mission.inspector.dismantle"),
        hazardWarning: (kind) => t(`ui.floorplan.mission.inspector.hazard.${kind}`),
        cutPower: t("ui.floorplan.mission.inspector.cut-power"),
        purgeReservoir: t("ui.floorplan.mission.inspector.purge-reservoir"),
        dischargeSource: t("ui.floorplan.mission.inspector.discharge-source"),
        sourceChargeWarning: t("ui.floorplan.mission.inspector.hazard.source-charge"),
        installHere: t("ui.floorplan.mission.inspector.install-here"),
        noActorSelected: t("ui.floorplan.mission.no-actor-selected"),
        analyzeSubstance: (analyzed) =>
          analyzed
            ? t("ui.floorplan.mission.inspector.analyze-substance-done")
            : t("ui.floorplan.mission.inspector.analyze-substance"),
        substancesTitle: t("ui.floorplan.mission.inspector.substances-title"),
        substanceAnalyzedSuffix: t("ui.floorplan.mission.inspector.substance-analyzed-suffix"),
        reservoirEmpty: t("ui.floorplan.mission.inspector.reservoir-empty"),
        reservoirContents: (substanceName, amount, capacity) =>
          t("ui.floorplan.mission.inspector.reservoir-contents")
            .replace("{substance}", substanceName)
            .replace("{amount}", String(amount))
            .replace("{capacity}", String(capacity)),
        transferSubstance: t("ui.floorplan.mission.inspector.transfer-substance"),
        applySubstance: t("ui.floorplan.mission.inspector.apply-substance"),
        extractElements: t("ui.floorplan.mission.inspector.extract-elements").replace(
          "{amount}",
          String(EXTRACTION_BATCH_UNITS),
        ),
        extractionBlocked: (reason) =>
          t(`ui.floorplan.mission.inspector.extract-blocked.${reason}`),
        transferBlocked: (reason) =>
          t(`ui.floorplan.mission.inspector.transfer-blocked.${reason}`),
        applyBlocked: (reason) => t(`ui.floorplan.mission.inspector.apply-blocked.${reason}`),
        reservoirHint: (hasContents) =>
          hasContents
            ? t("ui.floorplan.mission.inspector.reservoir-hint").replace(
                "{amount}",
                String(EXTRACTION_BATCH_UNITS),
              )
            : t("ui.floorplan.mission.inspector.reservoir-hint-empty"),
        openFabricator: (domain) => t(`ui.floorplan.mission.inspector.fabricate.${domain}`),
        openFabricatorBlocked: (domain) =>
          t(`ui.floorplan.mission.inspector.fabricate-blocked.${domain}`),
        close: t("ui.floorplan.mission.inspector.close"),
      },
      {
        onDismantle: (instanceId) => {
          if (!this.selectedActorIdValue) return;
          this.mission.queueDismantle(this.selectedActorIdValue, instanceId);
          this.setActionPanelContent({ kind: "idle" });
          this.callbacks.onTaskQueued();
        },
        // Tareas de asegurado (13d): se encolan ANTES del desmontaje. Van al
        // mismo actor, cuya cola es FIFO, así que el orden de encolado ya
        // garantiza que corran primero — no hace falta `linkDependency`. El
        // panel se mantiene abierto para poder encolar el desmontaje después.
        onCutPower: (instanceId) => {
          const sectionId = this.mission.sectionIdOfInstance(instanceId);
          if (!this.selectedActorIdValue || !sectionId) return;
          this.mission.queueCutPower(this.selectedActorIdValue, sectionId);
          this.callbacks.onTaskQueued();
        },
        onPurgeReservoir: (instanceId) => {
          if (!this.selectedActorIdValue) return;
          this.mission.queuePurgeReservoir(this.selectedActorIdValue, instanceId);
          this.callbacks.onTaskQueued();
        },
        onDischargeSource: (instanceId) => {
          if (!this.selectedActorIdValue) return;
          this.mission.queueDischargeSource(this.selectedActorIdValue, instanceId);
          this.callbacks.onTaskQueued();
        },
        onOpenInstallPicker: (position) => {
          this.scene.sound.play(pickSoundKey(AUDIO_KEYS.modalOpen), { volume: 0.5 });
          this.installPickerScrollT = 0;
          this.installPickerState = {
            position,
            options: this.buildInstallOptions(),
            selectedIndex: 0,
          };
          this.redrawInstallPickerModal();
          this.callbacks.onSelectionChanged();
        },
        onAnalyzeSubstance: (substanceId) => {
          if (!this.selectedActorIdValue) return;
          this.mission.queueAnalyzeSubstance(this.selectedActorIdValue, substanceId);
          // Desde el panel de un RESERVORIO se mantiene abierto (13e ronda 4),
          // para ver cómo "Extraer (requiere análisis)" se desbloquea al
          // terminar — es el flujo que describe el comentario de abajo. Desde la
          // ficha de una sustancia suelta sí se cierra, porque esa ficha deja de
          // tener acción posible.
          if (this.actionPanelContent.kind !== "instance") {
            this.setActionPanelContent({ kind: "idle" });
          }
          this.callbacks.onTaskQueued();
        },
        // Subfase 13e — acciones de sustancias. Todas mantienen el panel
        // abierto: encadenar analizar → extraer → trasvasar es el flujo normal,
        // cerrarlo en cada paso obligaría a re-seleccionar la pieza cada vez.
        onApplySubstance: (instanceId) => {
          const sectionId = this.mission.sectionIdOfInstance(instanceId);
          const content = this.mission.reservoirContentOf(instanceId);
          if (!this.selectedActorIdValue || !sectionId || !content) return;
          this.mission.queueApplySubstance(
            this.selectedActorIdValue,
            instanceId,
            sectionId,
            content.amount,
          );
          this.callbacks.onTaskQueued();
        },
        // Ronda 7: ya no encola directo contra el primer alcanzable — abre el
        // modo de selección espacial (`startTransferMode`), que deja elegir
        // destino viendo todos los reservorios de la nave iluminados según
        // su estado real.
        onStartTransferMode: (instanceId) => this.startTransferMode(instanceId),
        onExtractElements: (instanceId) => {
          const content = this.mission.reservoirContentOf(instanceId);
          if (!this.selectedActorIdValue || !content) return;
          // Un LOTE por tarea, no el tanque entero (13e ronda 1): con los
          // reservorios sembrados llenos, vaciar uno de un saque daba materia
          // prima infinita. Vaciarlo cuesta varias tareas y varios viajes.
          this.mission.queueExtractElements(
            this.selectedActorIdValue,
            instanceId,
            Math.min(EXTRACTION_BATCH_UNITS, content.amount),
          );
          this.callbacks.onTaskQueued();
        },
        onOpenFabricator: (instanceId) => this.callbacks.onOpenFabricator(instanceId),
        onSelectSubstance: (substanceId) => this.selectSubstance(substanceId),
        markAsHudObject: (obj) => this.callbacks.markAsHudObject(obj),
        onClose: () => this.setActionPanelContent({ kind: "idle" }),
        onPanelDragged: (x, y) => {
          this.manualPanelPositionValue = { x, y };
        },
      },
    );
    // Depth propio, por encima de la tira de tripulación (ronda 3): con el
    // empate en `hudContent` la tira lo tapaba al re-crearse.
    this.actionPanelContainer.setDepth(RENDER_DEPTH.hudFloatingPanel);
    this.callbacks.markAsHudObject(this.actionPanelContainer);
  }

  /**
   * Lista única del selector de instalación (ronda 8 de fixes de playtest —
   * reemplaza las pestañas "Inventario"/"Catálogo" separadas): un compuesto
   * sin stock de receta debe seguir apareciendo, deshabilitado, explicando qué
   * falta — nunca un botón gris mudo (CLAUDE.md) ni una fila ausente sin
   * motivo. Habilitados primero, bloqueados después con su motivo.
   *
   * - Atómico con stock > 0: una fila por BUCKET de desgaste (Fase 13c) — si
   *   hay 2 sensores nuevos y 1 usado, el jugador ve las dos opciones y elige
   *   cuál gasta, en vez de colapsarlas en "Sensor ×3" y esconder que un
   *   tercio del stock está degradado.
   * - Atómico sin stock: UNA fila deshabilitada, motivo `"no-stock"`.
   * - Creación personalizada (11c.1): siempre habilitada — no se gatea por
   *   stock (ya se consumió al fabricarla).
   * - Compuesto de CATÁLOGO (ej. un segundo reservorio): habilitado +
   *   `consumesRecipe` si `hasRecipeStockFor`; si no, deshabilitado con motivo
   *   `"missing-ingredients"` y los nombres que faltan (`missingRecipeIngredients`).
   * - Una creación/compuesto sin footprint no es instalable (no se sabe cuánto ocupa).
   */
  private buildInstallOptions(): ReadonlyArray<InstallPickerOption> {
    const atomicAvailable: InstallPickerOption[] = ATOMIC_COMPONENT_CATALOG.flatMap((spec) =>
      this.mission.wearBucketsOf(spec.id).map((bucket) => ({
        id: spec.id,
        name: spec.name,
        footprint: spec.data.footprint,
        functional: spec.data.functional,
        material: spec.data.material,
        wear: bucket.wear,
        quantity: bucket.quantity,
      })),
    );
    const atomicMissing: InstallPickerOption[] = ATOMIC_COMPONENT_CATALOG.filter(
      (spec) => this.mission.stockOf(spec.id) <= 0,
    ).map((spec) => ({
      id: spec.id,
      name: spec.name,
      footprint: spec.data.footprint,
      functional: spec.data.functional,
      material: spec.data.material,
      blocked: "no-stock" as const,
    }));
    const creationOptions: InstallPickerOption[] = [];
    for (const def of this.mission.installableCreations) {
      const footprint = def.data.footprint;
      if (!footprint) continue;
      creationOptions.push({
        id: def.id,
        name: def.name,
        footprint,
        functional: def.data.functional,
        material: def.data.material,
      });
    }
    const compositeAvailable: InstallPickerOption[] = [];
    const compositeBlocked: InstallPickerOption[] = [];
    for (const def of this.mission.installableCatalogComposites) {
      const footprint = def.data.footprint;
      if (!footprint) continue;
      if (this.mission.hasRecipeStockFor(def)) {
        compositeAvailable.push({
          id: def.id,
          name: def.name,
          footprint,
          functional: def.data.functional,
          material: def.data.material,
          composition: this.buildComposition(def),
          consumesRecipe: true,
        });
      } else {
        compositeBlocked.push({
          id: def.id,
          name: def.name,
          footprint,
          functional: def.data.functional,
          material: def.data.material,
          composition: this.buildComposition(def),
          blocked: "missing-ingredients",
          missingIngredientNames: this.missingIngredientNames(def),
        });
      }
    }
    return [
      ...atomicAvailable,
      ...creationOptions,
      ...compositeAvailable,
      ...atomicMissing,
      ...compositeBlocked,
    ];
  }

  /** Nombres legibles de lo que falta para completar una receta — ver `MissionRuntime.missingRecipeIngredients`. */
  private missingIngredientNames(definition: PhysicalComponentDefinition): ReadonlyArray<string> {
    return this.mission.missingRecipeIngredients(definition).map(({ ref }) => {
      const ingredientDefinition = this.mission.definitionOf(ref);
      return ingredientDefinition?.name ?? this.nameByComponentId.get(ref) ?? ref;
    });
  }

  /**
   * Modal de selección de instalación (ajuste post-playtest #3): estado
   * separado del panel docked porque es un diálogo bloqueante que vive por
   * encima de TODO (`hudModal`), no un contenido más del panel lateral —
   * ver `install-picker-modal.ts` para el porqué de las dos columnas.
   */
  private redrawInstallPickerModal(): void {
    this.installPickerContainer?.destroy(true);
    if (!this.installPickerState) return;
    const state = this.installPickerState;
    this.installPickerContainer = renderInstallPickerModal(
      this.scene,
      state.options,
      state.selectedIndex,
      {
        title: t("ui.floorplan.mission.inspector.install-picker-title"),
        install: t("ui.floorplan.mission.install-modal.install"),
        cancel: t("ui.floorplan.mission.install-modal.cancel"),
        footprint: t("ui.floorplan.mission.install-modal.footprint"),
        selectHint: t("ui.floorplan.mission.install-modal.select-hint"),
        functionalDescription: (tag) => t(`component.functional.${tag}`),
        structuralResistance: (level) => t(`component.material.re.${STRUCTURAL_RESISTANCE_LEVEL_KEY[level]}`),
        wearTag: (wear) => t(`component.wear.${wear}`),
        compositionTitle: t("ui.floorplan.mission.composition-title"),
        blockedNoStock: t("ui.floorplan.mission.install-modal.blocked-no-stock"),
        blockedMissingIngredients: (names) =>
          t("ui.floorplan.mission.install-modal.blocked-missing-ingredients").replace("{names}", names.join(", ")),
      },
      {
        onSelect: (index) => {
          if (!this.installPickerState) return;
          // Misma lista, solo cambia la selección → preservar el scroll actual
          // antes de que el rebuild destruya el panel vivo (deuda #2).
          this.installPickerScrollT = this.installPickerList?.t ?? 0;
          this.installPickerState = { ...this.installPickerState, selectedIndex: index };
          this.redrawInstallPickerModal();
          this.callbacks.onSelectionChanged();
        },
        onInstall: (option) => this.confirmInstall(option, state.position),
        onCancel: () => this.closeInstallPicker(),
        markAsHudObject: (obj) => this.callbacks.markAsHudObject(obj),
        initialScrollT: this.installPickerScrollT,
        onListReady: (panel) => {
          this.installPickerList = panel;
        },
      },
    );
    this.installPickerContainer.setDepth(RENDER_DEPTH.hudModal);
    this.callbacks.markAsHudObject(this.installPickerContainer);
  }

  /**
   * Ubica dónde instalar la pieza elegida (playtest: `motor-pequeno` 2×2 no
   * entraba anclado exacto en la celda de la válvula 1×1 clickeada, por vecinos
   * fijos/otras piezas cerca). En vez de forzar el footprint anclado en la
   * celda clickeada, se busca la celda de la MISMA sección más cercana a ella
   * donde sí entra (`findFittingInstallPlacement`, motor) — si el footprint ya
   * entraba exacto en la celda clickeada (caso 1×1 de siempre), es la que se
   * devuelve primero, sin cambio de comportamiento.
   */
  private confirmInstall(option: InstallPickerOption, position: GridPosition): void {
    if (!this.selectedActorIdValue) return;
    const section = sectionContainingCell(this.mission.shipFloorplan, position);
    if (!section) return;
    const fitPosition = findFittingInstallPlacement(
      section,
      this.mission.blueprint.placedComponents,
      option.footprint,
      position,
    );
    if (!fitPosition) {
      const issues = validateInstallation(section, this.mission.blueprint.placedComponents, {
        position,
        footprint: option.footprint,
        rotation: 0,
      });
      this.callbacks.setStatus(issues.map((issue) => issue.detail).join(" / "));
      return;
    }
    this.mission.queueInstall(
      this.selectedActorIdValue,
      option.id,
      option.footprint,
      fitPosition,
      option.wear,
      option.consumesRecipe,
    );
    this.closeInstallPicker();
    this.setActionPanelContent({ kind: "idle" });
    this.callbacks.onTaskQueued();
  }

  private closeInstallPicker(): void {
    this.scene.sound.play(pickSoundKey(AUDIO_KEYS.modalClose), { volume: 0.5 });
    this.installPickerContainer?.destroy(true);
    this.installPickerContainer = undefined;
    this.installPickerList = undefined;
    this.installPickerScrollT = 0;
    this.installPickerState = undefined;
    this.callbacks.onSelectionChanged();
  }
}
