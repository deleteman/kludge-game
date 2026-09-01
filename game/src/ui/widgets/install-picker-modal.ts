import Phaser from "phaser";
import type ScrollablePanel from "phaser3-rex-plugins/templates/ui/scrollablepanel/ScrollablePanel.js";
import type {
  ComponentId,
  ComponentWear,
  Footprint,
  FunctionalProperty,
  MaterialProperties,
} from "engine";
import { UI_FONT_FAMILY } from "../fonts.js";
import { CRISIS_WARNING_CSS, HEADER_COLOR, LABEL_COLOR, TAG_CATEGORY_CSS } from "../../render/palette.js";
import { RENDER_DEPTH } from "../../render/render-depths.js";
import { componentTextureKey, hasComponentSprite } from "../../render/component-sprite-registry.js";
import { createKenneyButton } from "./kenney-button.js";
import { createKenneyList } from "./kenney-list.js";
import { createKenneyPanel } from "./kenney-panel.js";
import { renderCompositionLines } from "./composition-list.js";
import type { CompositionIngredient } from "./mission-action-panel.js";
import type { SceneWithRexUI } from "../scene-with-rex-ui.types.js";

/**
 * Texto de una fila de la lista. Con buckets de desgaste (13c) la misma pieza
 * puede aparecer varias veces, así que la fila tiene que decir CUÁL es —
 * mostrar solo el nombre haría que dos filas idénticas fueran indistinguibles.
 * `nuevo` no se etiqueta: es el caso por defecto y ensuciaría toda la lista.
 *
 * Ronda 10: ya NO agrega el motivo de bloqueo al texto — el atenuado
 * (`muted`, ronda 9) ya distingue la fila, y el motivo completo vive en la
 * ficha de detalle (siempre seleccionable desde ronda 9). Repetirlo acá
 * volvía la lista casi ilegible, sobre todo en compuestos con varias piezas
 * faltantes.
 */
function optionRowLabel(option: InstallPickerOption, labels: InstallPickerLabels): string {
  const count = option.quantity !== undefined && option.quantity > 1 ? ` ×${option.quantity}` : "";
  const wear = option.wear && option.wear !== "nuevo" ? ` · ${labels.wearTag(option.wear)}` : "";
  return `${option.name}${count}${wear}`;
}

export interface InstallPickerOption {
  readonly id: ComponentId;
  readonly name: string;
  /**
   * Celdas que ocupa al instalarse. **Opcional desde la Subfase 14a-4**: este
   * mismo modal sirve ahora al selector de CABLEADO, y un cable no se coloca en
   * el plano — se gasta al tender una arista. Sin huella, la línea simplemente
   * no se dibuja; para el selector de instalación sigue siendo obligatoria de
   * hecho (`buildInstallOptions` descarta las definiciones que no la declaran).
   */
  readonly footprint?: Footprint;
  readonly functional?: ReadonlyArray<FunctionalProperty>;
  readonly material?: MaterialProperties;
  /** Solo para compuestos: desglose de sus piezas atómicas. Ver `CompositionIngredient`. */
  readonly composition?: ReadonlyArray<CompositionIngredient>;
  /**
   * Bucket de desgaste que representa esta fila (Fase 13c). Una misma pieza
   * aparece una vez por estado ("Sensor ×2 · NUEVO", "Sensor ×1 · USADO") para
   * que el jugador elija qué unidad gasta en vez de recibir la peor en
   * silencio. Ausente en el catálogo informativo y en las creaciones, que no
   * se sirven del stock por buckets.
   */
  readonly wear?: ComponentWear;
  /** Unidades disponibles en ese bucket, para el sufijo "×N". */
  readonly quantity?: number;
  /**
   * Compuesto de catálogo instalado directo desde "Inventario", gastando su
   * receta al completarse (ronda 7 de fixes de playtest) — a diferencia de
   * las creaciones personalizadas del jugador, que se instalan gratis.
   */
  readonly consumesRecipe?: boolean;
  /**
   * Motivo de bloqueo (ronda 8 de fixes de playtest, unificación de "Inventario"
   * y "Catálogo" en una sola lista): un atómico sin stock o un compuesto sin
   * receta completa siguen apareciendo en la lista, deshabilitados, con el
   * motivo — nunca un botón gris mudo (CLAUDE.md). `undefined` = instalable.
   */
  readonly blocked?: "no-stock" | "missing-ingredients";
  /**
   * Líneas extra de ficha, ya traducidas y con sus números (Subfase 14a-4). El
   * selector de cableado las usa para lo único que decide la elección de cable y
   * que `functionalDescription` no puede decir, porque solo recibe el tag:
   * capacidad EFECTIVA (ya con el desgaste aplicado) y tolerancia al calor.
   */
  readonly detailLines?: ReadonlyArray<string>;
}

export interface InstallPickerLabels {
  readonly title: string;
  readonly install: string;
  readonly cancel: string;
  readonly footprint: string;
  readonly selectHint: string;
  readonly functionalDescription: (tag: FunctionalProperty["tag"]) => string;
  readonly structuralResistance: (level: "A" | "M" | "B") => string;
  /** Etiqueta corta del desgaste para la fila de la lista (Fase 13c). */
  readonly wearTag: (wear: ComponentWear) => string;
  readonly compositionTitle: string;
  /** Motivo mostrado en la ficha cuando el ítem seleccionado está bloqueado (ronda 8). */
  readonly blockedNoStock: string;
  /**
   * Ronda 10: deja de ser función de nombres — el listado de qué falta ya lo
   * muestra `renderCompositionLines` ingrediente por ingrediente (`hasStock`,
   * ronda 9); repetirlo acá era ruido y además el texto podía envolver a
   * varias líneas y pisar la sección de Composición (fix de solape).
   */
  readonly blockedMissingIngredients: string;
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
// título largo se salía del modal e invadía el contenido, que quedaba a solo
// ~30px por debajo. Se deja aire (+66) para que el título ocupe dos líneas
// sin invadir la lista. Ronda 8: ya no hay fila de pestañas entre el título y
// el contenido (lista unificada), así que el contenido sube a donde antes
// arrancaba esa fila.
const CONTENT_TOP = MODAL_CENTER_Y - MODAL_HEIGHT / 2 + 66;
const CONTENT_BOTTOM = MODAL_CENTER_Y + MODAL_HEIGHT / 2 - 66;
const LIST_CENTER_X = MODAL_LEFT + 24 + LIST_WIDTH / 2;
const LIST_CENTER_Y = (CONTENT_TOP + CONTENT_BOTTOM) / 2;
const LIST_HEIGHT = CONTENT_BOTTOM - CONTENT_TOP;
const DESCRIPTION_X = MODAL_LEFT + 24 + LIST_WIDTH + 26;
const DESCRIPTION_WIDTH = MODAL_RIGHT - 24 - DESCRIPTION_X;
/**
 * Fondo de la columna de ficha (fix de playtest 13c ronda 1). Mismos valores
 * que el fondo del tooltip (`mission-tooltip.ts`), donde estos mismos colores
 * de tag ya se leen sin problema — no es un color nuevo, es el mismo recurso.
 */
const DESCRIPTION_BACKDROP_COLOR = 0x0a0a0f;
const DESCRIPTION_BACKDROP_ALPHA = 0.92;
const DESCRIPTION_BACKDROP_PADDING = 10;

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
  options: ReadonlyArray<InstallPickerOption>,
  selectedIndex: number,
  labels: InstallPickerLabels,
  callbacks: {
    readonly onSelect: (index: number) => void;
    readonly onInstall: (option: InstallPickerOption) => void;
    readonly onCancel: () => void;
    /** Registra un objeto como HUD (lo ignora la cámara de mundo) — ver `floorplan-scene.ts`. */
    readonly markAsHudObject: (obj: Phaser.GameObjects.GameObject) => void;
    /**
     * Fracción de scroll (0..1) con la que arrancar la lista. El modal se
     * recrea entero al seleccionar un ítem; sin esto la lista saltaba al inicio
     * al clickear un elemento scrolleado (deuda #2 de PENDIENTES).
     */
    readonly initialScrollT?: number;
    /** Devuelve el panel scrolleable recién creado para que el llamador lea su `t` antes del próximo rebuild. */
    readonly onListReady?: (panel: ScrollablePanel) => void;
  },
): Phaser.GameObjects.Container {
  const centerX = MODAL_CENTER_X;
  const centerY = MODAL_CENTER_Y;
  const container = scene.add.container(0, 0);

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
    options.map((option, index) => {
      const label = optionRowLabel(option, labels);
      return {
        text: index === selectedIndex ? `> ${label}` : label,
        onClick: () => callbacks.onSelect(index),
        // Ronda 9: una fila bloqueada sigue siendo SELECCIONABLE (para ver su
        // ficha completa — el operador reportó no poder ver el detalle de lo
        // que no se puede construir); `muted` la atenúa visualmente sin
        // impedir el click. El botón "Instalar" es el que queda deshabilitado
        // para un ítem bloqueado (ver `enabled` de ese botón más abajo).
        muted: !!option.blocked,
      };
    }),
  ).setDepth(RENDER_DEPTH.hudModal);
  callbacks.markAsHudObject(list);
  container.once(Phaser.GameObjects.Events.DESTROY, () => list.destroy());
  // Restaurar la posición de scroll previa (deuda #2): al recrear el modal por
  // una selección, la lista debe quedar donde estaba, no saltar al inicio.
  if (callbacks.initialScrollT !== undefined && Number.isFinite(callbacks.initialScrollT)) {
    list.setT(Phaser.Math.Clamp(callbacks.initialScrollT, 0, 1));
  }
  callbacks.onListReady?.(list);

  const selected = options[selectedIndex];
  const descriptionX = DESCRIPTION_X;
  const descriptionTop = CONTENT_TOP;

  // Fondo oscuro de la columna de ficha (fix de playtest 13c ronda 1): los tags
  // funcionales (#7fb4ff) y la resistencia estructural (#c0a080) del Eje B se
  // dibujaban directo sobre `panel_rectangle.png`, un gris medio (~#9496a5) —
  // contraste real de 1.4:1 y 1.2:1 respectivamente, ilegible (WCAG AA pide
  // 4.5:1). El tooltip usa esos MISMOS colores y sí se lee, porque tiene su
  // propio fondo oscuro; acá se replica ese fondo en vez de aclarar/oscurecer
  // los colores, que romperían el contrato de la paleta (Fase 12e) y el
  // `palette.contract.test.ts` que lo custodia. Mismo criterio que el badge de
  // la ronda 8 de 13b: poner un fondo detrás, no inventar un color nuevo.
  container.add(
    scene.add
      .rectangle(
        descriptionX - DESCRIPTION_BACKDROP_PADDING,
        descriptionTop - DESCRIPTION_BACKDROP_PADDING,
        DESCRIPTION_WIDTH + DESCRIPTION_BACKDROP_PADDING * 2,
        CONTENT_BOTTOM - CONTENT_TOP + DESCRIPTION_BACKDROP_PADDING * 2,
        DESCRIPTION_BACKDROP_COLOR,
        DESCRIPTION_BACKDROP_ALPHA,
      )
      .setOrigin(0, 0),
    // Sin `setDepth`: dentro de un `Container` el depth ORDENA entre hermanos,
    // así que fijarlo acá pondría el fondo por ENCIMA de la ficha (que se
    // inserta después con depth 0). El orden de inserción ya basta: el panel
    // Kenney va antes, este fondo después, y la ficha encima de los dos.
  );

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

  container.add(
    createKenneyButton(scene, centerX - 120, centerY + MODAL_HEIGHT / 2 - 32, labels.install, {
      width: 200,
      // Ronda 8: un ítem bloqueado no puede confirmarse aunque haya quedado
      // seleccionado (p. ej. el default `selectedIndex = 0` cuando no hay
      // NINGÚN ítem instalable) — mismo criterio, ahora sobre un solo campo.
      enabled: selected !== undefined && !selected.blocked,
      onClick: () => {
        if (selected && !selected.blocked) callbacks.onInstall(selected);
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

  const titleText = scene.add
    .text(x + PREVIEW_SIZE + 12, y, option.name, {
      fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
      fontSize: "16px",
      color: HEADER_COLOR,
      wordWrap: { width: DESCRIPTION_WIDTH - PREVIEW_SIZE - 12 },
    })
    .setOrigin(0, 0);
  sheet.add(titleText);
  // Ronda 9: la huella ya no va a un `y + 24` fijo — un nombre largo (ej.
  // "Reservorio de agua reciclada") envuelve a 2 líneas con `wordWrap`, y esa
  // segunda línea pisaba el texto de huella. `titleText.height` ya refleja el
  // alto real tras aplicar el wrap, así que la huella se ancla debajo de eso.
  // 14a-4: sin huella (un cable) no se dibuja la línea, en vez de mostrar un
  // "Huella: undefined×undefined".
  if (option.footprint) {
    sheet.add(
      scene.add
        .text(
          x + PREVIEW_SIZE + 12,
          titleText.y + titleText.height + 4,
          `${labels.footprint}: ${option.footprint.width}×${option.footprint.height}`,
          {
            fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
            fontSize: "12px",
            color: LABEL_COLOR,
          },
        )
        .setOrigin(0, 0),
    );
  }

  let lineY = y + PREVIEW_SIZE + 20;

  // Motivo de bloqueo (ronda 8): mismo ámbar de aviso que el resto de la UI
  // usa para "esto está bloqueado y por qué" — no un color nuevo.
  if (option.blocked) {
    const reason = option.blocked === "no-stock" ? labels.blockedNoStock : labels.blockedMissingIngredients;
    const warningText = scene.add
      .text(x, lineY, `⚠ ${reason}`, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "12px",
        color: CRISIS_WARNING_CSS,
        wordWrap: { width: DESCRIPTION_WIDTH },
      })
      .setOrigin(0, 0);
    sheet.add(warningText);
    // Ronda 10: mismo criterio que el título/huella de ronda 9 — medir el
    // alto real del texto tras `wordWrap` en vez de un `+= 26` fijo, para que
    // un warning largo no pise la sección de Composición que arranca debajo.
    lineY += warningText.height + 8;
  }

  // 14a-4: líneas ya formateadas por el llamador (capacidad efectiva, calor).
  // Van ANTES de las funcionales porque son el dato con el que se elige.
  for (const line of option.detailLines ?? []) {
    const detail = scene.add
      .text(x, lineY, line, {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "12px",
        color: LABEL_COLOR,
        wordWrap: { width: DESCRIPTION_WIDTH },
      })
      .setOrigin(0, 0);
    sheet.add(detail);
    // Se mide el alto real, no un `+= 26`: el largo cambia con el idioma.
    lineY += detail.height + 6;
  }

  for (const property of option.functional ?? []) {
    sheet.add(
      scene.add
        .text(x, lineY, `• ${labels.functionalDescription(property.tag)}`, {
          fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
          fontSize: "12px",
          color: TAG_CATEGORY_CSS.functional, // Eje B, categoría funcional (Fase 12e)
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
          color: TAG_CATEGORY_CSS.material, // Eje B, categoría material (Fase 12e)
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
