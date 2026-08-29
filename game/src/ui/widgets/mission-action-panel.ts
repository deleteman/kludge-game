import Phaser from "phaser";
import type {
  ChemicalSubstanceId,
  ComponentCondition,
  ComponentId,
  DismantleHazardKind,
  FabricatorDomain,
  Footprint,
  FunctionalProperty,
  MaterialProperties,
  PlacedComponentInstanceId,
  ConduitId,
  DoorId,
  DoorMode,
  DoorOverrideSource,
  DoorState,
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
  /**
   * `true` si esta pieza tiene el tag funcional que la crisis activa necesita
   * (resaltado ámbar, solo color) — SOLO tiene sentido en el tooltip de
   * desmontar (ronda 9: `buildComposition` lo fuerza a `false` cuando se llama
   * desde el selector de instalación, donde el objetivo de misión es
   * irrelevante para lo que se está construyendo).
   */
  readonly hasRequiredTag: boolean;
  /**
   * `false` si falta stock de ESTE ingrediente puntual para completar la
   * receta (13e ronda 9) — `undefined`/`true` en cualquier otro contexto
   * (dismantle tooltip, o cuando la receta ya está completa).
   */
  readonly hasStock?: boolean;
}

/**
 * Estado de una puerta tal como lo necesita el panel (Subfase 13h), ya resuelto
 * por el llamador contra el motor. El panel solo pinta: no conoce
 * `MissionDoorRuntime` ni las reglas de gobierno, mismo criterio que con los
 * hazards de 13d y el reservorio de 13e.
 *
 * `overrideSource` es el MOTIVO por el que no responde y viaja hasta acá
 * precisamente para que el botón gris se explique en vez de solo no funcionar.
 */
export interface DoorPanelInfo {
  readonly doorId: DoorId;
  readonly state: DoorState;
  readonly mode: DoorMode;
  readonly overrideSource?: DoorOverrideSource;
  /** Fracción de vida restante [0,1] — el jugador no ve el número, igual que con el casco. */
  readonly integrity: number;
}

/** Un estado notable de la pieza, listo para pintar. */
export interface ComponentStatePanelInfo {
  readonly icon: string;
  readonly text: string;
  readonly color: string;
}

/**
 * Motivo tipado por el que la mesa de creación no se abre. Mismo molde que
 * `extractionBlocked`/`transferBlocked`: el label recibe el MOTIVO, no un
 * booleano, para que el botón gris pueda nombrarlo.
 */
export type FabricatorBlockedReason = "execution" | "unpowered";

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
      /**
       * Contenido del reservorio (Subfase 13e), ya resuelto por el llamador:
       * qué sustancia, cuánta y de qué capacidad. `undefined` = la pieza no es
       * un reservorio de sustancia. El panel solo pinta — no conoce el catálogo
       * ni `ReservoirProperty`, mismo criterio que con los hazards de 13d.
       */
      readonly reservoir?: ReservoirPanelInfo;
      /**
       * Dominio de mesa que habilita esta pieza (13e): la mesa dejó de ser un
       * botón global y se abre desde el aparato. `undefined` = no es un aparato.
       */
      readonly fabricatorDomain?: FabricatorDomain;
      /**
       * Por qué la mesa no se puede abrir. El guard real vive en
       * `FloorplanScene.openWorkbench`; esto es lo que hace que el botón lo
       * DIGA en vez de aceptar el clic y rebotar con un texto discreto en el
       * header que el jugador no ve.
       *
       * - `"execution"` (13e ronda 2): la mesa exige pausa táctica.
       * - `"unpowered"` (13g): la mesa declara `powerDraw` y su sección no le
       *   otorga lo que pide. Nombra la causa a propósito (patrón 42): un botón
       *   gris sin motivo convierte un problema de gestión de energía en un bug
       *   aparente.
       */
      readonly fabricatorBlocked?: FabricatorBlockedReason;
      /** Ver `BreachPanelInfo` — la pieza está tapando (o no) una brecha de casco. */
      readonly breach?: BreachPanelInfo;
      /**
       * La pieza ES una puerta (Subfase 13h): un `ACT`+`EST` instalado sobre un
       * umbral. El bloque de puerta se pinta dentro de la variante `instance`
       * porque desmontarla, cortarle la energía o repararla son acciones sobre
       * la misma pieza — no un panel aparte.
       */
      readonly door?: DoorPanelInfo;
      /**
       * Estados notables ya resueltos a texto/color por el llamador (13h ronda
       * 3). El panel solo pinta — no conoce la tabla de estados ni la i18n,
       * mismo criterio que con los hazards de 13d.
       */
      readonly states?: ReadonlyArray<ComponentStatePanelInfo>;
    }
  /**
   * Un CONDUCTO de ventilación seleccionado (Subfase 13h). Variante propia y no
   * un caso de `instance` porque un conducto no es una pieza instalada: no se
   * desmonta, no se repara, no tiene condición. Lo único que se hace con él es
   * abrir o cerrar su válvula.
   */
  | {
      readonly kind: "conduit";
      readonly conduitId: ConduitId;
      readonly name: string;
      /** Apertura viva en [0,1]. */
      readonly aperture: number;
      /** Presión de cada lado, ya resuelta por el llamador — es lo que dice hacia dónde va el aire. */
      readonly pressureA: number;
      readonly pressureB: number;
    }
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

/**
 * Estado de un reservorio tal como lo pinta el panel (Subfase 13e). Todo ya
 * resuelto por el llamador, incluido el MOTIVO por el que no se puede extraer
 * — para que el botón deshabilitado explique por qué en vez de quedar gris y
 * mudo.
 */
export interface ReservoirPanelInfo {
  readonly substanceName?: string;
  readonly amount: number;
  readonly capacity: number;
  /** `undefined` = se puede extraer. */
  readonly extractionBlocked?: "empty" | "unanalyzed" | "unknown-composition";
  /** Hay al menos un reservorio alcanzable al que trasvasar (conducto `fluido` mediante). */
  readonly canTransfer: boolean;
  /**
   * Sustancia contenida y si ya fue analizada (13e ronda 4). El panel decía
   * "Extraer (requiere análisis)" sin ofrecer NINGUNA forma de analizarla: el
   * único camino era el botón "Sustancias (N)" del HUD, que el jugador no tiene
   * por qué relacionar con el reservorio que está mirando.
   */
  readonly substanceId?: ChemicalSubstanceId;
  readonly analyzed?: boolean;
}

/**
 * Brecha de casco sobre la celda seleccionada (13f, ronda 1 de playtest).
 *
 * El operador intentó sellar una brecha con una junta hermética y "parece no
 * funcionar": el motor la rechazaba (una junta no tiene la propiedad `EST`),
 * pero el juego no lo decía en ningún lado — la tarea se completaba, la pieza
 * quedaba puesta y la fuga seguía. Una acción que no sirve tiene que
 * distinguirse de una que sí. `sealed` ya viene resuelto por el llamador contra
 * el motor (`isBreachSealed`), igual que los hazards de 13d: el panel pinta, no
 * decide qué tapa un agujero.
 */
export interface BreachPanelInfo {
  readonly sealed: boolean;
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
  readonly dismantle: string;
  /** Aviso de riesgo al desmontar (13d), una línea por hazard vivo. */
  readonly hazardWarning: (kind: DismantleHazardKind) => string;
  /** Brecha de casco sobre esta celda (13f ronda 1): qué es y qué hace falta para sellarla. */
  readonly breachWarning: (sealed: boolean) => string;
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
  /** Subfase 13e — contenido del reservorio y sus acciones. */
  readonly reservoirEmpty: string;
  readonly reservoirContents: (substanceName: string, amount: number, capacity: number) => string;
  readonly transferSubstance: string;
  readonly applySubstance: string;
  readonly extractElements: string;
  /**
   * Motivo por el que cada acción está bloqueada, para que el botón gris se
   * explique. Los tres siguen el mismo molde que `extractionBlocked`, que ya
   * existía desde 13e: en la ronda 2 el operador reportó que tras purgar "las
   * opciones del reservorio desaparecen" — no desaparecían, quedaban grises sin
   * decir por qué, que es lo mismo de cara al jugador.
   */
  readonly extractionBlocked: (reason: "empty" | "unanalyzed" | "unknown-composition") => string;
  readonly transferBlocked: (reason: "empty" | "no-target") => string;
  readonly applyBlocked: (reason: "empty") => string;
  /** Línea de contexto del bloque de reservorio: qué hace cada acción y cómo se rellena si está vacío. */
  readonly reservoirHint: (hasContents: boolean) => string;
  /** Abre la mesa desde el aparato: "Fabricar" (física) / "Fabricar sustancias" (química). */
  readonly openFabricator: (domain: FabricatorDomain) => string;
  /**
   * Mismo botón, deshabilitado, nombrando POR QUÉ: pausa pendiente (13e ronda
   * 2) o sección sin energía (13g). Recibe el motivo además del dominio,
   * siguiendo el molde de `extractionBlocked`.
   */
  readonly openFabricatorBlocked: (domain: FabricatorDomain, reason: FabricatorBlockedReason) => string;
  /** Subfase 13h — puertas y válvulas. */
  readonly doorState: (state: DoorState) => string;
  /** Motivo por el que la puerta no responde, para que el botón gris lo diga. */
  readonly doorBlocked: (source: DoorOverrideSource) => string;
  /** Qué hace una puerta que NO está gobernada por nada (ronda 2 de playtest). */
  readonly doorAuto: string;
  readonly forceDoor: string;
  readonly repairDoor: string;
  /** Estado de la válvula y su acción, con el verbo que corresponde a lo que va a pasar. */
  readonly valveState: (aperture: number) => string;
  readonly setValve: (opening: boolean) => string;
  /** Diferencia de presión entre los dos lados — es lo que dice si vale la pena cerrar. */
  readonly conduitPressure: (a: number, b: number) => string;
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
  /** Subfase 13e — acciones sobre un reservorio y apertura de la mesa desde el aparato. */
  /** Abre el modo de selección espacial de destino de trasvase (ronda 7) sobre esta pieza. */
  readonly onStartTransferMode: (instanceId: PlacedComponentInstanceId) => void;
  readonly onApplySubstance: (instanceId: PlacedComponentInstanceId) => void;
  readonly onExtractElements: (instanceId: PlacedComponentInstanceId) => void;
  readonly onOpenFabricator: (instanceId: PlacedComponentInstanceId) => void;
  readonly onAnalyzeSubstance: (substanceId: ChemicalSubstanceId) => void;
  readonly onSelectSubstance: (substanceId: ChemicalSubstanceId) => void;
  /** La lista de sustancias es un widget rexUI aparte de la display list de la escena (ver `kenney-list.ts`) — necesita su propio registro de HUD. */
  readonly markAsHudObject: (obj: Phaser.GameObjects.GameObject) => void;
  /** Deselección manual (fix de playtest 11e): vuelve el panel a `idle` sin tener que encolar ninguna acción. */
  readonly onClose: () => void;
  /**
   * Arrastre del panel por su backdrop (pedido del operador, ronda 5): se
   * llama en vivo con la posición absoluta de PANTALLA mientras se arrastra
   * (mismo criterio que `onChange` de `kenney-slider.ts`) — el llamador
   * decide si esa posición sobrevive a un rebuild o se resetea.
   */
  readonly onPanelDragged?: (x: number, y: number) => void;
  /** Subfase 13h — encolan las tres tareas nuevas sobre la puerta/conducto seleccionado. */
  readonly onForceDoor: (doorId: DoorId) => void;
  readonly onRepairDoor: (doorId: DoorId) => void;
  readonly onSetValve: (conduitId: ConduitId, targetAperture: number) => void;
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
/**
 * Bloque de acciones de una puerta (Subfase 13h). Compartido entre la variante
 * `instance` (puerta construida por el jugador) y `door` (autorada en el
 * plano): las dos ofrecen lo mismo — decir en qué estado está, por qué no
 * responde si no responde, forzarla y repararla.
 *
 * Devuelve el nuevo cursor vertical, mismo contrato que el resto del flujo
 * apilado del panel (13d ronda 2: se mide la altura REAL, no se suman
 * constantes, porque el alto de un texto envuelto depende del idioma).
 */
function renderDoorBlock(
  scene: SceneWithRexUI,
  container: Phaser.GameObjects.Container,
  door: DoorPanelInfo,
  layout: { readonly width: number; readonly cursorY: number; readonly hasSelectedActor: boolean },
  labels: ActionPanelLabels,
  callbacks: ActionPanelCallbacks,
): number {
  const { width, hasSelectedActor } = layout;
  let cursorY = layout.cursorY;
  const broken = door.state === "destroyed";
  const stuck = door.state === "jammed" || door.overrideSource === "unpowered";

  const stateText = scene.add
    .text(width / 2, cursorY, labels.doorState(door.state), {
      fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
      fontSize: "11px",
      color: broken || stuck ? CRISIS_WARNING_CSS : LABEL_COLOR,
      align: "center",
      wordWrap: { width: width - 20, useAdvancedWrap: true },
    })
    .setOrigin(0.5, 0);
  container.add(stateText);
  cursorY += stateText.height + 4;

  // El MOTIVO, no solo el hecho. Una puerta que no responde y no dice por qué
  // se lee como un bug; con el motivo se lee como un problema que el jugador
  // puede ir a resolver (devolverle la energía, apagar el electroimán).
  if (door.mode === "override" && door.overrideSource) {
    const reasonText = scene.add
      .text(width / 2, cursorY, `⚠ ${labels.doorBlocked(door.overrideSource)}`, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "10px",
        color: CRISIS_WARNING_CSS,
        align: "center",
        wordWrap: { width: width - 20, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    container.add(reasonText);
    cursorY += reasonText.height + 6;
  } else if (!broken) {
    // El caso `auto` también necesita decirse (ronda 2 de playtest). Sin esta
    // línea, la puerta que SÍ funciona es la única que no explica nada, y el
    // jugador no tiene forma de distinguir "automática" de "cableada pero el
    // sensor está apagado" — que se ven casi igual y se resuelven distinto.
    const autoText = scene.add
      .text(width / 2, cursorY, labels.doorAuto, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "10px",
        color: LABEL_COLOR,
        align: "center",
        wordWrap: { width: width - 20, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    container.add(autoText);
    cursorY += autoText.height + 6;
  }

  const stack = (label: string, enabled: boolean, onClick: () => void): void => {
    container.add(
      createKenneyButton(scene, width / 2, cursorY + 15, label, {
        width: width - 40,
        height: 30,
        fontSize: "11px",
        enabled,
        onClick,
      }),
    );
    cursorY += 36;
  };

  // Forzar solo tiene sentido con la hoja quieta y entera: una puerta rota ya
  // está abierta de par en par, y una que funciona se abre sola al acercarse.
  stack(labels.forceDoor, hasSelectedActor && stuck && !broken, () => callbacks.onForceDoor(door.doorId));
  stack(
    labels.repairDoor,
    hasSelectedActor && (broken || door.integrity < 1),
    () => callbacks.onRepairDoor(door.doorId),
  );

  return cursorY;
}

/** Clave de `container.getData()` con el alto realmente ocupado por el panel. */
export const ACTION_PANEL_HEIGHT_KEY = "panelHeight";

export function renderMissionActionPanel(
  scene: SceneWithRexUI,
  width: number,
  height: number,
  maxHeight: number,
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
    .setStrokeStyle(1, 0x2a3040, 1)
    // Ronda 5: interactivo para que el hit-test lo tome como candidato — sin
    // esto el click sobre el área vacía del panel atravesaba directo a los
    // controles de mundo debajo (`installTopmostOnlyInput` solo desempata
    // entre objetos que YA compiten por el puntero). Sin handler propio de
    // click: solo necesita estar en carrera para ganarle al mundo y perder
    // frente a los botones (ver comentario de `attachPanelScroll` más abajo).
    .setInteractive({ cursor: UI_POINTER_CURSOR_CSS, draggable: false });
  container.add(backdrop);
  attachPanelDrag(scene, container, backdrop, callbacks);

  /** Punto más bajo ocupado por el contenido, para dimensionar el fondo al final. */
  let contentBottom = 0;
  const claim = (bottom: number): void => {
    contentBottom = Math.max(contentBottom, bottom);
  };

  const title =
    content.kind === "instance"
      ? labels.instanceTitle(content.name, content.condition)
      : // Subfase 13h: conducto y puerta autorada ya traen su nombre resuelto.
        content.kind === "conduit" || content.kind === "substance"
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

  // Brecha de casco bajo la pieza seleccionada (13f ronda 1): si el jugador
  // instaló algo que no sirve de parche, el panel tiene que decirlo. Va ANTES
  // del bloque por tipo de contenido porque es lo primero que necesita saber.
  // Solo aplica a `instance` desde la ronda 4: la celda vacía ya no abre panel,
  // su brecha se lee en el marcador del mapa y en el tooltip de hover.
  const breach = content.kind === "instance" ? content.breach : undefined;
  if (breach) {
    const breachText = scene.add
      .text(width / 2, flowY, `${breach.sealed ? "✔" : "⚠"} ${labels.breachWarning(breach.sealed)}`, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "10px",
        color: breach.sealed ? LABEL_COLOR : CRISIS_WARNING_CSS,
        align: "center",
        wordWrap: { width: width - 20, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    container.add(breachText);
    flowY += breachText.height + 6;
    claim(flowY);
  }

  if (content.kind === "instance") {
    // Propiedades/composición ya NO se repiten acá (playtest): esa ficha
    // completa vive en el tooltip de hover (`mission-tooltip.ts`) — este
    // panel solo ofrece la acción sobre la pieza seleccionada.
    const hazards = content.dismantleHazards ?? [];
    let cursorY = flowY;

    // Estados notables de la pieza (13h ronda 3), ANTES de los riesgos de
    // desmontaje: primero por qué la pieza no está haciendo su trabajo, después
    // qué pasa si la arrancás. Misma tabla que el tinte del plano y que el
    // tooltip, así que las tres lecturas no pueden divergir.
    //
    // Es también lo que desactiva la contradicción que reportó el operador
    // ("Pieza energizada" junto a "Sin energía"): con el número delante —pide 2,
    // la sección otorga 1— las dos frases dejan de sonar opuestas y se leen como
    // lo que son, la sección tiene corriente pero no le alcanza a esta pieza.
    for (const state of content.states ?? []) {
      const stateText = scene.add
        .text(width / 2, cursorY, `${state.icon} ${state.text}`, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "10px",
          color: state.color,
          align: "center",
          wordWrap: { width: width - 20, useAdvancedWrap: true },
        })
        .setOrigin(0.5, 0);
      container.add(stateText);
      cursorY += stateText.height + 6;
      claim(cursorY);
    }

    // Badge de riesgo (13d): el jugador tiene que poder decidir ANTES de
    // encolar, no descubrirlo con el chispazo (pilar de legibilidad total).
    // Ámbar del contrato de color único de 12e — es escalable, no fatal.
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
    /** Igual que `stackButton` pero con `enabled` explícito (13e: botones que se explican deshabilitados). */
    const stackButtonEnabled = (label: string, enabled: boolean, onClick: () => void): void => {
      container.add(
        createKenneyButton(scene, width / 2, cursorY + 15, label, {
          width: width - 40,
          height: 30,
          fontSize: "11px",
          enabled,
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

    // Subfase 13e — aparato de fabricación: la mesa se abre desde acá, no desde
    // un botón global del header.
    if (content.fabricatorDomain) {
      const blocked = content.fabricatorBlocked;
      stackButtonEnabled(
        blocked
          ? labels.openFabricatorBlocked(content.fabricatorDomain, blocked)
          : labels.openFabricator(content.fabricatorDomain),
        hasSelectedActor && blocked === undefined,
        () => callbacks.onOpenFabricator(content.instanceId),
      );
    }

    // Subfase 13e — reservorio: qué contiene y qué se puede hacer con eso.
    const reservoir = content.reservoir;
    if (reservoir) {
      const contentsText =
        reservoir.substanceName && reservoir.amount > 0
          ? labels.reservoirContents(reservoir.substanceName, reservoir.amount, reservoir.capacity)
          : labels.reservoirEmpty;
      const contentsLabel = scene.add
        .text(20, cursorY, contentsText, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "11px",
          color: LABEL_COLOR,
          wordWrap: { width: width - 40, useAdvancedWrap: true },
        })
        .setOrigin(0, 0);
      container.add(contentsLabel);
      cursorY += contentsLabel.height + 8;
      claim(cursorY);

      // Los TRES botones llevan el MOTIVO en el propio label cuando están
      // bloqueados: un botón gris sin explicación es exactamente lo que hace
      // que el jugador no descubra que primero tiene que analizar, y lo que
      // hizo que tras purgar el panel pareciera haberse quedado sin opciones.
      const hasContents = reservoir.amount > 0;
      stackButtonEnabled(
        hasContents ? labels.applySubstance : labels.applyBlocked("empty"),
        hasSelectedActor && hasContents,
        () => callbacks.onApplySubstance(content.instanceId),
      );
      const transferBlocked = !hasContents
        ? "empty"
        : !reservoir.canTransfer
          ? "no-target"
          : undefined;
      stackButtonEnabled(
        transferBlocked ? labels.transferBlocked(transferBlocked) : labels.transferSubstance,
        hasSelectedActor && !transferBlocked,
        () => callbacks.onStartTransferMode(content.instanceId),
      );
      // ANTES de "Extraer", porque es su paso previo: analizar es lo que
      // desbloquea la extracción, y leerlo en ese orden lo enseña solo.
      if (reservoir.substanceId) {
        const substanceId = reservoir.substanceId;
        stackButtonEnabled(
          labels.analyzeSubstance(reservoir.analyzed === true),
          hasSelectedActor && hasContents && !reservoir.analyzed,
          () => callbacks.onAnalyzeSubstance(substanceId),
        );
      }
      stackButtonEnabled(
        reservoir.extractionBlocked
          ? labels.extractionBlocked(reservoir.extractionBlocked)
          : labels.extractElements,
        hasSelectedActor && !reservoir.extractionBlocked,
        () => callbacks.onExtractElements(content.instanceId),
      );

      // Línea de contexto: sin ella "Verter en la sección" y "Purgar" se leen
      // como sinónimos, y un reservorio vacío es un callejón sin salida sin
      // pista de cómo rellenarlo. Mismo patrón que el `emptyHint` de una celda
      // libre, que ya resolvió este problema en el playtest de la Fase 11d.
      const hint = scene.add
        .text(20, cursorY, labels.reservoirHint(hasContents), {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "10px",
          color: LABEL_COLOR,
          wordWrap: { width: width - 40, useAdvancedWrap: true },
        })
        .setOrigin(0, 0);
      container.add(hint);
      cursorY += hint.height + 6;
      claim(cursorY);
    }

    // Subfase 13h — la pieza es una puerta (un `ACT`+`EST` sobre un umbral).
    // Va al final del bloque de instancia: primero lo que se hace con la pieza
    // como pieza, después lo que se hace con ella como puerta.
    if (content.door) {
      cursorY = renderDoorBlock(
        scene,
        container,
        content.door,
        { width, cursorY, hasSelectedActor },
        labels,
        callbacks,
      );
      claim(cursorY);
    }
  } else if (content.kind === "conduit") {
    const conduit = content;
    const openness = conduit.aperture;
    const stateText = scene.add
      .text(width / 2, flowY, labels.valveState(openness), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "11px",
        color: openness <= 0 ? CRISIS_WARNING_CSS : LABEL_COLOR,
        align: "center",
        wordWrap: { width: width - 20, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    container.add(stateText);
    flowY += stateText.height + 4;

    // El delta de presión es lo que dice si vale la pena cerrar: sin él, el
    // jugador tiene que ir sala por sala con el tooltip para descubrir por
    // dónde se le está yendo el aire.
    const pressureText = scene.add
      .text(width / 2, flowY, labels.conduitPressure(conduit.pressureA, conduit.pressureB), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "10px",
        color: LABEL_COLOR,
        align: "center",
        wordWrap: { width: width - 20, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    container.add(pressureText);
    flowY += pressureText.height + 8;

    const opening = openness <= 0;
    container.add(
      createKenneyButton(scene, width / 2, flowY + 15, labels.setValve(opening), {
        width: width - 40,
        height: 30,
        fontSize: "11px",
        enabled: hasSelectedActor,
        onClick: () => callbacks.onSetValve(conduit.conduitId, opening ? 1 : 0),
      }),
    );
    flowY += 36;
    claim(flowY);
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

  // El alto que pidió el llamador es un MÍNIMO (13d ronda 2): con dos o tres
  // avisos de riesgo y sus botones, el contenido pasa de largo y el fondo tiene
  // que acompañar. Pero `maxHeight` sí es un techo (13e ronda 3): sin él el
  // panel crecía hasta salirse de la pantalla y su último botón —"Extraer"—
  // quedaba fuera de vista, sin scroll ni recorte que lo delataran.
  const naturalHeight = Math.max(height, contentBottom + 16);
  const renderedHeight = Math.min(naturalHeight, maxHeight);
  backdrop.setSize(width + 20, renderedHeight);

  if (naturalHeight > renderedHeight) {
    attachPanelScroll(scene, container, backdrop, width, renderedHeight, naturalHeight);
  }

  // El alto REAL, para que la escena pueda mantener el panel dentro de pantalla
  // y bloquear los clicks sobre toda su superficie (si el clamp siguiera usando
  // el alto nominal, la parte que sobresale dejaría pasar el click al mapa).
  container.setData(ACTION_PANEL_HEIGHT_KEY, renderedHeight);

  return container;
}

/**
 * Arrastre del panel por click&hold sobre su backdrop (ronda 5, pedido del
 * operador). Mismo patrón que `kenney-slider.ts`/`power-allocation-slider.ts`:
 * `pointerdown` en la hit-zone local arranca el drag, `pointermove`/`pointerup`
 * se enganchan GLOBALES en `scene.input` (el puntero se sale del backdrop
 * durante el arrastre) y se desenganchan por referencia al destruirse el
 * container — mismo criterio que `attachPanelScroll` con su listener de
 * `wheel`. El container vive en la cámara HUD, así que sus coordenadas ya son
 * de pantalla y se comparan/asignan directo con las del puntero.
 */
function attachPanelDrag(
  scene: SceneWithRexUI,
  container: Phaser.GameObjects.Container,
  backdrop: Phaser.GameObjects.Rectangle,
  callbacks: ActionPanelCallbacks,
): void {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onDown = (pointer: Phaser.Input.Pointer): void => {
    dragging = true;
    offsetX = container.x - pointer.x;
    offsetY = container.y - pointer.y;
  };
  backdrop.on("pointerdown", onDown);

  const onMove = (pointer: Phaser.Input.Pointer): void => {
    if (!dragging) return;
    const x = pointer.x + offsetX;
    const y = pointer.y + offsetY;
    container.setPosition(x, y);
    callbacks.onPanelDragged?.(x, y);
  };
  const onUp = (): void => {
    dragging = false;
  };
  scene.input.on("pointermove", onMove);
  scene.input.on("pointerup", onUp);
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.off("pointermove", onMove);
    scene.input.off("pointerup", onUp);
  });
}

/**
 * Convierte el panel en una ventana con scroll cuando su contenido no entra en
 * `maxHeight` (13e ronda 3).
 *
 * Se implementa moviendo el contenido ya apilado a un sub-container enmascarado
 * en vez de reconstruirlo dentro de un `ScrollablePanel` de rexUI: todo el
 * cuerpo de `renderMissionActionPanel` posiciona sus hijos en coordenadas
 * ABSOLUTAS respecto del origen del panel, y rexUI re-centra a sus hijos — la
 * conversión habría obligado a reescribir el apilado entero y a romper el
 * anclaje que `updateActionPanelAnchor` calcula cada frame.
 *
 * La máscara es un `Graphics` DENTRO del container, así que hereda su transform
 * y sigue al panel mientras la escena lo reposiciona, sin sincronización manual.
 */
function attachPanelScroll(
  scene: SceneWithRexUI,
  container: Phaser.GameObjects.Container,
  backdrop: Phaser.GameObjects.Rectangle,
  width: number,
  viewportHeight: number,
  contentHeight: number,
): void {
  const scrollable = container.list.filter((child) => child !== backdrop);
  container.remove(scrollable);
  const viewport = scene.add.container(0, 0);
  viewport.add(scrollable);
  container.add(viewport);

  const maskShape = scene.make.graphics({}, false);
  maskShape.fillStyle(0xffffff);
  maskShape.fillRect(-10, -8, width + 20, viewportHeight);
  container.add(maskShape);
  viewport.setMask(maskShape.createGeometryMask());

  // Recorrido disponible: lo que sobra por debajo del viewport.
  const maxScroll = contentHeight - viewportHeight;
  let scroll = 0;
  const applyScroll = (delta: number): void => {
    scroll = Phaser.Math.Clamp(scroll + delta, 0, maxScroll);
    viewport.setY(-scroll);
  };

  // Rueda del mouse sobre el área del panel. Se engancha a la escena y no al
  // backdrop porque `wheel` no es un evento de puntero por objeto en Phaser
  // (no hay "wheel sobre este game object" nativo) — el chequeo de bounds de
  // abajo hace ese trabajo a mano. (Ronda 5: el backdrop SÍ es interactivo
  // desde hace unas líneas para el click/drag; eso ya no roba los clicks de
  // los botones — ver `installTopmostOnlyInput` en `floorplan-scene.ts`, que
  // desde la ronda 4 desempata por profundidad efectiva y orden de display
  // list, así que un botón añadido después del backdrop siempre gana.)
  const onWheel = (
    pointer: Phaser.Input.Pointer,
    _over: unknown,
    _dx: number,
    dy: number,
  ): void => {
    // El panel vive en la cámara HUD, así que su `x`/`y` YA son coordenadas de
    // pantalla y se comparan directo con las del puntero.
    const originX = container.x - 10;
    const originY = container.y - 8;
    if (
      pointer.x < originX ||
      pointer.x > originX + width + 20 ||
      pointer.y < originY ||
      pointer.y > originY + viewportHeight
    ) {
      return;
    }
    applyScroll(dy);
  };
  scene.input.on("wheel", onWheel);
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.off("wheel", onWheel);
    maskShape.destroy();
  });

  // Indicador de que hay más contenido: sin esto el recorte es indistinguible
  // de "no hay más acciones", que es justo el problema que se está corrigiendo.
  const moreHint = scene.add
    .text(width / 2 - 10, viewportHeight - 20, "▾", {
      fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
      fontSize: "12px",
      color: LABEL_COLOR,
    })
    .setOrigin(0.5, 0);
  container.add(moreHint);
}
