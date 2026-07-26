import Phaser from "phaser";
import type { ComponentId, Footprint, FunctionalProperty, MaterialProperties } from "engine";
import { UI_FONT_FAMILY } from "../fonts.js";
import { HEADER_COLOR, LABEL_COLOR } from "../../render/palette.js";
import { RENDER_DEPTH } from "../../render/render-depths.js";
import { componentTextureKey, hasComponentSprite } from "../../render/component-sprite-registry.js";
import { createKenneyButton } from "./kenney-button.js";
import { createKenneyList } from "./kenney-list.js";
import { createKenneyPanel } from "./kenney-panel.js";
import { renderTabStrip } from "./tab-strip.js";
import { renderCompositionLines } from "./composition-list.js";
import type { CompositionIngredient } from "./mission-action-panel.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";

export type InstallPickerTab = "inventory" | "catalog";

export interface InstallPickerOption {
  readonly id: ComponentId;
  readonly name: string;
  readonly footprint: Footprint;
  readonly functional?: ReadonlyArray<FunctionalProperty>;
  readonly material?: MaterialProperties;
  /** Solo para compuestos: desglose de sus piezas atómicas. Ver `CompositionIngredient`. */
  readonly composition?: ReadonlyArray<CompositionIngredient>;
}

export interface InstallPickerLabels {
  readonly title: string;
  readonly install: string;
  readonly cancel: string;
  readonly footprint: string;
  readonly selectHint: string;
  readonly functionalDescription: (tag: FunctionalProperty["tag"]) => string;
  readonly structuralResistance: (level: "A" | "M" | "B") => string;
  readonly compositionTitle: string;
  readonly inventoryTab: string;
  readonly catalogTab: string;
  /** Se muestra cuando se ve la pestaña "Catálogo" — no se puede instalar directo (solo informativo). */
  readonly catalogHint: string;
}

const MODAL_WIDTH = 720;
const MODAL_HEIGHT = 480;
const MODAL_CENTER_X = 640;
const MODAL_CENTER_Y = 360;
const LIST_WIDTH = 260;
const PREVIEW_SIZE = 64;

// Caja de contenido explícita DENTRO del modal (ajuste post-playtest #5): el
// bug de "la lista/el texto se salen del modal" era de posicionamiento —
// `scene.rexUI.add.scrollablePanel({x,y})` ubica el panel por su CENTRO, y el
// código anterior pasaba una `y` calculada como si fuera el borde superior, así
// que el panel quedaba centrado demasiado arriba y sobresalía. Acá se define
// la caja (bordes del modal, tope bajo el título, base sobre los botones) y
// todo se posiciona a partir de ella.
const MODAL_LEFT = MODAL_CENTER_X - MODAL_WIDTH / 2;
const MODAL_RIGHT = MODAL_CENTER_X + MODAL_WIDTH / 2;
// Título con `wordWrap` (ajuste post-playtest #2) — sin límite de ancho, un
// título largo se salía del modal e invadía la fila de pestañas, que quedaba
// a solo ~30px por debajo. Se separan más (+66/+100 en vez de +54/+88) para
// dar aire aunque el título ocupe dos líneas.
const TAB_ROW_Y = MODAL_CENTER_Y - MODAL_HEIGHT / 2 + 66;
const CONTENT_TOP = MODAL_CENTER_Y - MODAL_HEIGHT / 2 + 100;
const CONTENT_BOTTOM = MODAL_CENTER_Y + MODAL_HEIGHT / 2 - 66;
const LIST_CENTER_X = MODAL_LEFT + 24 + LIST_WIDTH / 2;
const LIST_CENTER_Y = (CONTENT_TOP + CONTENT_BOTTOM) / 2;
const LIST_HEIGHT = CONTENT_BOTTOM - CONTENT_TOP;
const DESCRIPTION_X = MODAL_LEFT + 24 + LIST_WIDTH + 26;
const DESCRIPTION_WIDTH = MODAL_RIGHT - 24 - DESCRIPTION_X;

/**
 * Selector de instalación como modal de dos columnas (Fase 10d, ajuste post-
 * playtest #3): a la izquierda la lista de componentes atómicos (click =
 * seleccionar y refrescar la ficha, NO confirma todavía — a diferencia del
 * resto de listas del proyecto); a la derecha la ficha del ítem seleccionado
 * (imagen placeholder + nombre + huella + una línea por propiedad funcional/
 * material, texto tomado literalmente de GDD §5.1/5.2). Sin esto, el
 * jugador solo veía 20 nombres sin ninguna pista de compatibilidad — rompía
 * el principio de "emergencia sobre recetas" (CLAUDE.md #1): la UI debe
 * exponer las propiedades para que el jugador razone, no ocultarlas.
 * Mismo patrón de `mission-briefing-modal.ts` (fondo oscuro + `createKenneyPanel`,
 * vive en `hudModal`, coordenadas de pantalla fijas).
 */
export function renderInstallPickerModal(
  scene: SceneWithRexUI,
  inventoryOptions: ReadonlyArray<InstallPickerOption>,
  catalogOptions: ReadonlyArray<InstallPickerOption>,
  activeTab: InstallPickerTab,
  selectedIndex: number,
  labels: InstallPickerLabels,
  callbacks: {
    readonly onTabChange: (tab: InstallPickerTab) => void;
    readonly onSelect: (index: number) => void;
    readonly onInstall: (option: InstallPickerOption) => void;
    readonly onCancel: () => void;
    /** Registra un objeto como HUD (lo ignora la cámara de mundo) — ver `floorplan-scene.ts`. */
    readonly markAsHudObject: (obj: Phaser.GameObjects.GameObject) => void;
  },
): Phaser.GameObjects.Container {
  const centerX = MODAL_CENTER_X;
  const centerY = MODAL_CENTER_Y;
  const container = scene.add.container(0, 0);
  const options = activeTab === "inventory" ? inventoryOptions : catalogOptions;

  container.add(scene.add.rectangle(centerX, centerY, 1280, 720, 0x000000, 0.55));

  const panel = createKenneyPanel(scene, centerX, centerY, MODAL_WIDTH, MODAL_HEIGHT);
  container.add(panel.panel);

  container.add(
    scene.add
      .text(centerX, centerY - MODAL_HEIGHT / 2 + 22, labels.title, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "18px",
        color: HEADER_COLOR,
        align: "center",
        wordWrap: { width: MODAL_WIDTH - 48 },
      })
      .setOrigin(0.5, 0),
  );

  // Pestañas (rework "sin stock → desarmar → reutilizar"): "Inventario" solo
  // lista lo que hay stock real para instalar ya mismo; "Catálogo" es
  // informativo (qué existe y qué requeriría fabricar), no instalable en esta
  // iteración. `renderTabStrip` (playtest ronda 2) calcula el ancho de cada
  // pestaña según su texto real — dos botones de ancho fijo se solapaban con
  // labels largos como "Catálogo — Requiere Síntesis".
  container.add(
    renderTabStrip(
      scene,
      centerX,
      TAB_ROW_Y,
      [
        { id: "inventory", label: labels.inventoryTab },
        { id: "catalog", label: labels.catalogTab },
      ],
      activeTab,
      (tab) => callbacks.onTabChange(tab as InstallPickerTab),
    ),
  );

  // La lista NO se agrega al Container nativo: el recorte de rexUI es una
  // geometry mask que asume que el contenido scrolleable vive directo en la
  // display list de la escena — anidarla en un `Phaser.Container` rompe el
  // recorte. Se crea como hijo directo de la escena, se registra en la cámara
  // de HUD por separado, y se ata su destrucción a la del Container para no
  // cambiar el contrato de "el llamador destruye un solo handle". `(x,y)` de
  // `createKenneyList` es el CENTRO del panel (ver su doc) — por eso se pasa
  // `LIST_CENTER_Y`, no el tope de la caja de contenido.
  const list = createKenneyList(
    scene,
    LIST_CENTER_X,
    LIST_CENTER_Y,
    LIST_WIDTH,
    LIST_HEIGHT,
    options.map((option, index) => ({
      text: index === selectedIndex ? `> ${option.name}` : option.name,
      onClick: () => callbacks.onSelect(index),
    })),
  ).setDepth(RENDER_DEPTH.hudModal);
  callbacks.markAsHudObject(list);
  container.once(Phaser.GameObjects.Events.DESTROY, () => list.destroy());

  const selected = options[selectedIndex];
  const descriptionX = DESCRIPTION_X;
  const descriptionTop = CONTENT_TOP;

  if (selected) {
    container.add(renderSelectedComponentSheet(scene, descriptionX, descriptionTop, selected, labels));
  } else {
    container.add(
      scene.add
        .text(descriptionX, descriptionTop, labels.selectHint, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "12px",
          color: LABEL_COLOR,
          wordWrap: { width: DESCRIPTION_WIDTH },
        })
        .setOrigin(0, 0),
    );
  }

  if (activeTab === "catalog") {
    // Encima de la fila de botones (`centerY + MODAL_HEIGHT/2 - 32`), con
    // margen para 2 líneas de texto sin invadirlos (ajuste post-playtest #2:
    // antes quedaba a solo 10px del botón, se solapaban con texto largo).
    container.add(
      scene.add
        .text(centerX, centerY + MODAL_HEIGHT / 2 - 76, labels.catalogHint, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "10px",
          color: LABEL_COLOR,
          align: "center",
          wordWrap: { width: MODAL_WIDTH - 48 },
        })
        .setOrigin(0.5, 0),
    );
  }

  container.add(
    createKenneyButton(scene, centerX - 120, centerY + MODAL_HEIGHT / 2 - 32, labels.install, {
      width: 200,
      // Pestaña "Catálogo": solo informativa en esta iteración, no dispara
      // fabricación — el botón queda deshabilitado aunque haya un ítem
      // seleccionado (decisión confirmada con el operador).
      enabled: activeTab === "inventory" && selected !== undefined,
      onClick: () => {
        if (selected) callbacks.onInstall(selected);
      },
    }),
  );
  container.add(
    createKenneyButton(scene, centerX + 120, centerY + MODAL_HEIGHT / 2 - 32, labels.cancel, {
      width: 200,
      onClick: callbacks.onCancel,
    }),
  );

  return container;
}

function renderSelectedComponentSheet(
  scene: SceneWithRexUI,
  x: number,
  y: number,
  option: InstallPickerOption,
  labels: InstallPickerLabels,
): Phaser.GameObjects.Container {
  const sheet = scene.add.container(0, 0);

  // Sprite real del componente si existe; si no, placeholder (CLAUDE.md:
  // rectángulo de color sólido + id como texto). Sprite esperado en
  // `game/assets/sprites/components/<id>.png`, un archivo por id del catálogo.
  if (hasComponentSprite(scene, option.id)) {
    sheet.add(
      scene.add
        .image(x + PREVIEW_SIZE / 2, y + PREVIEW_SIZE / 2, componentTextureKey(option.id))
        .setDisplaySize(PREVIEW_SIZE, PREVIEW_SIZE),
    );
  } else {
    sheet.add(scene.add.rectangle(x + PREVIEW_SIZE / 2, y + PREVIEW_SIZE / 2, PREVIEW_SIZE, PREVIEW_SIZE, 0x2c3c5a, 1));
    sheet.add(
      scene.add
        .text(x + PREVIEW_SIZE / 2, y + PREVIEW_SIZE / 2, option.id, {
          fontFamily: "monospace",
          fontSize: "9px",
          color: LABEL_COLOR,
          align: "center",
          wordWrap: { width: PREVIEW_SIZE - 8 },
        })
        .setOrigin(0.5, 0.5),
    );
  }

  sheet.add(
    scene.add
      .text(x + PREVIEW_SIZE + 12, y, option.name, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "16px",
        color: HEADER_COLOR,
        wordWrap: { width: DESCRIPTION_WIDTH - PREVIEW_SIZE - 12 },
      })
      .setOrigin(0, 0),
  );
  sheet.add(
    scene.add
      .text(x + PREVIEW_SIZE + 12, y + 24, `${labels.footprint}: ${option.footprint.width}×${option.footprint.height}`, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "12px",
        color: LABEL_COLOR,
      })
      .setOrigin(0, 0),
  );

  let lineY = y + PREVIEW_SIZE + 20;
  for (const property of option.functional ?? []) {
    sheet.add(
      scene.add
        .text(x, lineY, `• ${labels.functionalDescription(property.tag)}`, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "12px",
          color: LABEL_COLOR,
          wordWrap: { width: DESCRIPTION_WIDTH },
        })
        .setOrigin(0, 0),
    );
    lineY += 26;
  }

  if (option.material?.RE) {
    sheet.add(
      scene.add
        .text(x, lineY, `• ${labels.structuralResistance(option.material.RE)}`, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "12px",
          color: LABEL_COLOR,
          wordWrap: { width: DESCRIPTION_WIDTH },
        })
        .setOrigin(0, 0),
    );
    lineY += 26;
  }

  if (option.composition && option.composition.length > 0) {
    const { container: compositionContainer } = renderCompositionLines(
      scene,
      x,
      lineY,
      DESCRIPTION_WIDTH,
      labels.compositionTitle,
      option.composition,
    );
    sheet.add(compositionContainer);
  }

  return sheet;
}
