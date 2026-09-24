import type Phaser from "phaser";
import type {
  ComponentCondition,
  ComponentWear,
  FunctionalProperty,
  InstanceState,
  MaterialProperties,
} from "engine";
import { HAZARD_PARAMETERS } from "engine";
import { UI_FONT_FAMILY } from "../fonts.js";
import { HEADER_COLOR, OBJECTIVE_DONE_COLOR, TIMER_TEXT_COLORS, TAG_CATEGORY_CSS } from "../../render/palette.js";
import {
  COMPONENT_CONDITION_TINT,
  COMPONENT_WEAR_CSS,
  CRISIS_FATAL_CSS,
  CRISIS_SAFE_CSS,
  CRISIS_WARNING_CSS,
  LABEL_COLOR,
  WIRE_LOAD_WARNING_RATIO,
} from "../../render/palette.js";
import { WIRE_HEAT_VISIBLE_CELSIUS_PER_SECOND } from "../../particles/effects/wire-heat-effect.js";
import { stateNoticeCss, visualForState } from "../../render/component-state-visuals.js";
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
      /**
       * Estado de la sala donde está la pieza, solo cuando es NOTICIA (13f
       * ronda 4). Después de tapar una brecha el jugador mira el parche, no el
       * suelo de al lado: si el estado de la sección solo se leyera sobre suelo
       * vacío, la pregunta que este bloque vino a responder se quedaría sin
       * responder justo en la celda donde se la hace.
       */
      readonly atmosphere?: SectionAtmosphereTooltip;
      /** Brecha de casco bajo esta pieza: dice si lo instalado la está tapando de verdad. */
      readonly breach?: { readonly sealed: boolean };
      /**
       * Estados notables derivados del mundo (13h ronda 3), ej. "sin energía".
       * Van como DATOS y no como texto ya compuesto: el aviso útil lleva
       * números ("pide 2, la sección otorga 1") y `t()` no interpola, así que
       * el widget arma la línea con la tabla de estados y el detalle numérico.
       */
      readonly states?: ReadonlyArray<InstanceState>;
      /**
       * Qué gobierna esta pieza y quién la gobierna (14a-4, ronda 1 de
       * playtest). El operador cableó siete consumidores a un fotorreceptor y
       * reportó: "el emisor que tiene 7 receptores no dice nada, los receptores
       * no dicen nada". Sin esto, un cable que vira a ámbar es un color sin
       * causa visible en ninguna parte de la UI.
       */
      readonly signal?: SignalTooltipInfo;
    }
  | {
      /**
       * Un CABLE de señal bajo el cursor (14a-4, ronda 1 de playtest). Hasta acá
       * un cable no tenía tooltip: era el único elemento del plano con estado
       * propio —carga, capacidad, desgaste, quemado— y ninguna forma de leerlo.
       */
      readonly kind: "wire";
      /** Nombre del conductor con el que se tendió, ej. "Cable de cobre". */
      readonly name: string;
      readonly wear: ComponentWear;
      /** Demanda que atraviesa el cable, en unidades de `powerDraw`. */
      readonly load: number;
      /** Capacidad EFECTIVA (catálogo × desgaste × factor térmico), la que usa el motor. */
      readonly capacity: number;
      /** El cable ya se quemó: no conduce y hay que retirarlo. */
      readonly burned: boolean;
      /** La sección lo está degradando por frío o calor ahora mismo. */
      readonly thermallyDerated: boolean;
      /**
       * °C/s que este cable le aporta a ESTA sala (ronda 2 de playtest de 14a-3).
       * Es la otra mitad de la lectura de la carga: el jugador ve las partículas
       * de calor sobre el recorrido y necesita el número para saber cuánto está
       * calentando y por qué.
       *
       * Un tronco que cruza dos secciones reparte su disipación entre ellas, así
       * que este número es menor que el total del cable — y es el que suma el
       * tooltip de la sección.
       */
      readonly heatCelsiusPerSecond: number;
      /**
       * °C/s que disipa el cable ENTERO. No se muestra: decide si la línea de
       * calor aparece, para que use exactamente la misma magnitud que las
       * partículas del recorrido (que son del cable, no de una sala).
       *
       * Sin esto, un cable que cruza varias salas podía brillar sin número al
       * lado: el efecto miraba el total y el umbral de la línea, el reparto.
       */
      readonly heatTotalCelsiusPerSecond: number;
    }
  | {
      /**
       * Nodo de señal bajo el cursor, SOLO en modo cableado (ronda 1 de
       * playtest de 14b-2). Gana a la ficha de la pieza mientras dure el modo:
       * ahí la pregunta del jugador no es "qué pieza hay acá" sino "qué voy a
       * cablear si hago click", y con 9 piezas del catálogo apilando entrada y
       * salida en una celda, el nombre del componente no la responde.
       */
      readonly kind: "signal-node";
      /** "emite" / "salida" / "entrada" / "paso", ya traducido. */
      readonly roleLabel: string;
      /**
       * Frase corta que distingue el rol (ronda 2 de playtest de 14b-2): "emite"
       * y "salida" suenan parecidos aunque uno mide el mundo y el otro reporta
       * lo que un actuador ya hizo, distinción real en piezas EM+ACT.
       */
      readonly roleDetail: string;
      /** Pieza dueña del nodo, para ubicarlo cuando hay varias juntas. */
      readonly ownerName?: string;
      /** Hay más de un nodo a tiro: este click va a abrir el menú de elección. */
      readonly ambiguous: boolean;
    }
  | {
      readonly kind: "section";
      readonly name: string;
      /**
       * Atmósfera viva de la sección (13f ronda 4). El hover sobre suelo vacío
       * era hasta ahora solo el nombre de la sala; ahora es el único sitio
       * donde se lee la presión, y el que explica por qué una sección recién
       * parchada sigue mordiendo: el parche detiene la fuga, el aire tarda.
       */
      readonly atmosphere?: SectionAtmosphereTooltip;
      /** Brecha de casco EN ESTA CELDA. Heredado del panel de celda vacía, que dejó de existir en la ronda 4. */
      readonly breach?: { readonly sealed: boolean };
    };

/**
 * El papel de una pieza en el montaje de señal (14a-4, ronda 1 de playtest).
 * Todo derivado en el momento del hover, como el resto del tooltip.
 */
export interface SignalTooltipInfo {
  /**
   * Cuántas piezas cuelgan DIRECTAMENTE de sus salidas, cuánta demanda suman y
   * cuánto puede sostener.
   *
   * `capacity` llegó en la ronda 2 de playtest de 14a-4 y es el arreglo del
   * reporte "no entiendo los dos números": `Gobierna: 7 · 8 de demanda` era un
   * número sin denominador, correcto y sin significado. Con el tercero, la
   * línea dice si el montaje entra o no.
   */
  readonly drives?: { readonly count: number; readonly load: number; readonly capacity: number };
  /** Quién la gobierna y si la señal está llegando AHORA. `undefined` = sin cable. */
  readonly governedBy?: { readonly name: string; readonly active: boolean };
  /** Esta pieza EMITE su estado hacia la cadena (un actuador cableado como origen). */
  readonly emitting?: boolean;
  /**
   * Cuántos cables quemados tocan esta pieza — entrantes Y salientes (14a-4,
   * ronda 3 de playtest). Ausente o 0 = su cableado está sano.
   *
   * La pieza NO está rota, y por eso no gana glifo ni tinte: gana una línea.
   * El operador quemó el tronco `fotorreceptor → chip`, vio la cicatriz encima
   * del chip y no tuvo desde dónde confirmar qué se había roto — "el tooltip
   * del fotorreceptor no muestra nada mal con él", que era correcto y aun así
   * lo dejaba sin camino hacia la causa.
   */
  readonly burnedWires?: number;
}

export interface SectionAtmosphereTooltip {
  readonly pressureKpa: number;
  readonly trend: "draining" | "recovering" | "stable";
  /** La sala mata por vacío AHORA MISMO. Es un eje distinto de `trend`: se puede estar recuperando y seguir siendo letal. */
  readonly vacuum: boolean;
  /** Temperatura de la sección (Subfase 14a-1). */
  readonly temperatureCelsius: number;
  /** Algún evento está aportando calor AHORA. Eje distinto de "está caliente", igual que `vacuum` lo es de `trend`. */
  readonly heating: boolean;
  /**
   * La sala está tan caliente que enciende sola lo que sea inflamable
   * (Subfase 14a-3, `AUTOIGNITION_CELSIUS`). Eje aparte de `heating` y de la
   * propia temperatura: el número ya está en pantalla, pero un umbral necesita
   * su CONSECUENCIA en palabras — "126 °C" no le dice al jugador que el
   * disolvente que acaba de evaporar ahí va a prenderse solo.
   */
  readonly selfIgniting: boolean;
  /**
   * La contaminación de la sala supera el umbral del sensor químico
   * (Subfase 14b-1; desde 14b-3 con el umbral de cada escáner, `sectionChemicalAlarm`). Mismo criterio
   * que `selfIgniting`: las concentraciones por sustancia ya están más abajo en
   * el tooltip, pero un porcentaje suelto no le dice al jugador dónde está la
   * línea que hace disparar al escáner que acaba de instalar. El umbral
   * necesita su consecuencia en palabras.
   */
  readonly chemicalAlarm: boolean;
  /**
   * Oxígeno de la sala: el porcentaje y el bucket de combustión ya traducido
   * (ronda 1 de playtest de 14a-3, "no veo los niveles de O2"). Es el dato que
   * decide si algo puede arder, y el que explica por qué inundar una sala de
   * vapor apaga un fuego en vez de alimentarlo.
   */
  readonly oxygen?: { readonly percent: number; readonly bucket: string };
  /** °C/s que el cableado de la sala está aportando (14a-3 ronda 1). */
  readonly wiringHeatCelsiusPerSecond?: number;
  /**
   * Sustancias en el aire de la sección, su estado AHÍ y su concentración
   * (14a-3). Es la mitad visible del cambio de estado: sin esto, el jugador ve
   * que su charco desapareció y no tiene dónde leer que ahora es un gas
   * inflamable flotando en la sala.
   */
  readonly substanceStates?: ReadonlyArray<{
    readonly name: string;
    readonly state: string;
    readonly percent: number;
  }>;
}

export interface MissionTooltipLabels {
  readonly functionalDescription: (tag: FunctionalProperty["tag"]) => string;
  readonly structuralResistance: (level: "A" | "M" | "B") => string;
  /** Etiqueta del tag de desgaste, ej. `[DEGRADADO]` (Fase 13c). */
  readonly wearTag: (wear: ComponentWear) => string;
  /** "Resistencia estructural: FALLO" cuando el desgaste consumió todos los escalones. */
  readonly structuralFailure: string;
  readonly compositionTitle: string;
  /** "Presión: 12 kPa" (13f ronda 4). */
  readonly sectionPressure: (kpa: number) => string;
  /** "Perdiendo presión" / "Represurizando"; `stable` no imprime línea. */
  readonly sectionPressureTrend: (trend: SectionAtmosphereTooltip["trend"]) => string;
  /** "Vacío: letal para la tripulación". */
  readonly sectionVacuum: string;
  /** "Temperatura: 84 °C" (Subfase 14a-1). */
  readonly sectionTemperature: (celsius: number) => string;
  /** "Calentándose": hay una fuente de calor activa en la sección ahora mismo. */
  readonly sectionHeating: string;
  /** "Enciende sola: cualquier inflamable arde acá" (14a-3). */
  readonly sectionSelfIgniting: string;
  /** "Hay otro nodo acá: al hacer click vas a poder elegir" (14b-2 ronda 1). */
  readonly signalNodeAmbiguous: string;
  /** "Contaminación sobre el umbral: un sensor químico acá dispara" (14b-1). */
  readonly sectionChemicalAlarm: string;
  /** "Disolvente en el aire (gas, 18%)" — sustancia presente, estado efectivo y concentración (14a-3). */
  readonly substanceState: (name: string, state: string, percent: number) => string;
  /** "Oxígeno: 12% (bajo)" (14a-3 ronda 1). */
  readonly sectionOxygen: (percent: number, bucket: string) => string;
  /** "El cableado aporta +3 °C/s" (14a-3 ronda 1). */
  readonly sectionWiringHeat: (celsiusPerSecond: number) => string;
  /** Brecha de casco en la celda bajo el cursor. */
  readonly sectionBreach: (sealed: boolean) => string;
  /**
   * Aviso de un estado notable de la pieza (13h ronda 3). Recibe el estado
   * COMPLETO, con su detalle numérico, porque "sin energía" a secas describe el
   * síntoma sin dar la salida: lo que le sirve al jugador es cuánto le falta.
   */
  readonly instanceState: (state: InstanceState) => string;
  /** "Gobierna 7 piezas · 9 de demanda" (14a-4 ronda 1). */
  readonly signalDrives: (drives: {
    readonly count: number;
    readonly load: number;
    readonly capacity: number;
  }) => string;
  /** Qué pasa cuando la demanda supera lo que el emisor sostiene. */
  readonly signalOverloadedEmitter: string;
  /** "1 cable quemado conectado a esta pieza" — la pieza está sana, su cableado no. */
  readonly signalBurnedWires: (count: number) => string;
  /** "Gobernada por: Fotorreceptor (señal activa)". */
  readonly signalGovernedBy: (governedBy: { readonly name: string; readonly active: boolean }) => string;
  /** "Emite señal: sí/no" — la salida de un actuador hacia la cadena. */
  readonly signalEmitting: (emitting: boolean) => string;
  /** "Carga: 5 / 6". */
  readonly wireLoad: (load: number, capacity: number) => string;
  /** "Disipa +0.8 °C/s en esta sala" (14a-3 ronda 1). */
  readonly wireHeat: (celsiusPerSecond: number) => string;
  /** Qué pasa si la carga supera la capacidad. */
  readonly wireOverloadWarning: string;
  /** Por qué la carga es la que es: un cable lleva lo que cuelga aguas abajo. */
  readonly wireLoadExplained: string;
  /** "Quemado: no conduce. Retiralo para recuperar el hueco." */
  readonly wireBurned: string;
  /** "La temperatura de la sala le baja la capacidad a la mitad." */
  readonly wireThermallyDerated: string;
}

/**
 * ¿Esta temperatura mata a un tripulante? Los DOS lados del eje (ronda 1 de
 * playtest de 14a-2): el lado caliente coincide con el disparo del sensor
 * térmico y con el vapor por la decisión de 14a-1, y el frío se agrega ahora
 * con el mismo criterio. Se importan los umbrales en vez de repetir los
 * números, para que un rebalanceo no deje al tooltip afirmando un límite que el
 * motor ya movió.
 */
function isLethalTemperature(celsius: number): boolean {
  return (
    celsius >= HAZARD_PARAMETERS.thermal.hotOnsetCelsius || celsius <= HAZARD_PARAMETERS.thermal.coldOnsetCelsius
  );
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

  // Ronda 1 de playtest de 14b-2: el tooltip de NODO sale antes que todo lo
  // demás y devuelve temprano. No comparte el encabezado de nombre porque su
  // sujeto no es una pieza ni una sala: es una de las caras de una pieza, y
  // mezclarlo con la ficha del componente es exactamente lo que dejaba al
  // jugador sin saber cuál de los dos puntos iba a cablear.
  if (content.kind === "signal-node") {
    const header = scene.add
      .text(PADDING, y, content.roleLabel.toUpperCase(), {
        fontFamily: `${UI_FONT_FAMILY}, sans-serif`,
        fontSize: "13px",
        color: HEADER_COLOR,
        fontStyle: "bold",
        wordWrap: { width: TOOLTIP_WIDTH - PADDING * 2 },
      })
      .setOrigin(0, 0);
    container.add(header);
    y += header.height + 2;
    // Detalle del rol (ronda 2 de 14b-2): atenuado y en fuente chica porque es
    // la aclaración para quien la necesita, no compite con el rótulo corto.
    const detail = scene.add
      .text(PADDING, y, content.roleDetail, {
        fontFamily: "sans-serif",
        fontSize: "10px",
        color: LABEL_COLOR,
        wordWrap: { width: TOOLTIP_WIDTH - PADDING * 2 },
      })
      .setOrigin(0, 0)
      .setAlpha(0.75);
    container.add(detail);
    y += detail.height + 4;
    for (const { text, color } of [
      ...(content.ownerName ? [{ text: `• ${content.ownerName}`, color: LABEL_COLOR }] : []),
      // El aviso de ambigüedad es el ANUNCIO del menú, no una queja: sin él, el
      // menú circular aparecía por sorpresa y el jugador no sabía qué lo abría.
      ...(content.ambiguous
        ? [{ text: `• ${labels.signalNodeAmbiguous}`, color: CRISIS_WARNING_CSS }]
        : []),
    ]) {
      const line = scene.add
        .text(PADDING, y, text, {
          fontFamily: "sans-serif",
          fontSize: "11px",
          color,
          wordWrap: { width: TOOLTIP_WIDTH - PADDING * 2 },
        })
        .setOrigin(0, 0);
      container.add(line);
      y += line.height + 4;
    }
    container.addAt(
      scene.add
        .rectangle(0, 0, TOOLTIP_WIDTH, y + PADDING, 0x0a0a0f, 0.92)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x2a3040, 1),
      0,
    );
    return container;
  }

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

  {
    // Estado de la sala bajo el cursor (13f ronda 4), para los DOS tipos de
    // contenido. Es la respuesta a "tapé la brecha, ¿por qué sigue muriéndose
    // mi gente?": la presión dice cuánto falta, la tendencia hacia dónde va, el
    // vacío si mata ahora mismo, y la brecha si el agujero sigue abierto. Un
    // fenómeno, una lectura (principio 6).
    const lines: Array<{ readonly text: string; readonly color: string }> = [];
    // Estados de la PIEZA (13h ronda 3) antes que los de la sala: el jugador
    // está preguntando por esta pieza. El ícono y el color salen de la misma
    // tabla que el tinte del sprite, así que lo que ve en el plano y lo que lee
    // acá no pueden divergir.
    if (content.kind === "instance") {
      for (const state of content.states ?? []) {
        const visual = visualForState(state.flag);
        lines.push({
          text: `${visual.icon ?? "•"} ${labels.instanceState(state)}`,
          color: stateNoticeCss(visual),
        });
      }
      // Papel en el montaje de señal (14a-4 ronda 1). Va junto a los estados y
      // antes de la atmósfera: el jugador que pasa el mouse por el
      // fotorreceptor está preguntando por el cableado, no por el aire.
      const signal = content.signal;
      if (signal?.drives) {
        // Mismo semáforo que el cable (ronda 2 de playtest): la demanda contra
        // la capacidad de la salida. Que el emisor y sus cables hablen el mismo
        // color es lo que hace que el jugador conecte una cosa con la otra.
        const ratio = signal.drives.capacity > 0 ? signal.drives.load / signal.drives.capacity : 0;
        lines.push({
          text: `⌁ ${labels.signalDrives(signal.drives)}`,
          color:
            ratio > 1
              ? CRISIS_FATAL_CSS
              : ratio >= WIRE_LOAD_WARNING_RATIO
                ? CRISIS_WARNING_CSS
                : LABEL_COLOR,
        });
        // Y qué implica pasarse, en palabras. El operador vio el ámbar sin
        // ninguna forma de saber qué significaba.
        if (ratio > 1) {
          lines.push({ text: `• ${labels.signalOverloadedEmitter}`, color: CRISIS_FATAL_CSS });
        }
      }
      if (signal?.governedBy) {
        lines.push({
          text: `⌁ ${labels.signalGovernedBy(signal.governedBy)}`,
          // Verde solo cuando la señal está LLEGANDO: es un estado activo, no
          // una etiqueta. Sin esa distinción, "gobernada por el sensor" se lee
          // igual con la puerta abierta que cerrada.
          color: signal.governedBy.active ? CRISIS_SAFE_CSS : LABEL_COLOR,
        });
      }
      // El cableado roto de una pieza SANA. Va en rojo de fallo y en último
      // lugar entre las líneas de señal: es lo más grave que se puede decir de
      // su montaje, y lo que el jugador está buscando cuando mira una pieza que
      // dejó de responder.
      if (signal?.burnedWires) {
        lines.push({
          text: `✖ ${labels.signalBurnedWires(signal.burnedWires)}`,
          color: CRISIS_FATAL_CSS,
        });
      }
      if (signal?.emitting !== undefined) {
        lines.push({
          text: `⌁ ${labels.signalEmitting(signal.emitting)}`,
          color: signal.emitting ? CRISIS_SAFE_CSS : LABEL_COLOR,
        });
      }
    }

    // Cable de señal (14a-4 ronda 1). Es el elemento del plano con más estado
    // propio y el último que no tenía forma de leerse: el operador vio un cable
    // virar a ámbar sin ninguna manera de saber por qué ni qué implicaba.
    if (content.kind === "wire") {
      if (content.burned) {
        lines.push({ text: `✖ ${labels.wireBurned}`, color: CRISIS_FATAL_CSS });
      } else {
        // El número exacto, no solo el color: en una topología en estrella el
        // color puede quedarse quieto para siempre y aun así el jugador
        // necesita saber cuánto margen le queda.
        const ratio = content.capacity > 0 ? content.load / content.capacity : 0;
        lines.push({
          text: `⌁ ${labels.wireLoad(content.load, content.capacity)}`,
          color: ratio >= WIRE_LOAD_WARNING_RATIO ? CRISIS_WARNING_CSS : LABEL_COLOR,
        });
        // La consecuencia EN PALABRAS: un umbral sin su consecuencia es un
        // número que no significa nada.
        lines.push({ text: `• ${labels.wireOverloadWarning}`, color: LABEL_COLOR });
        // De DÓNDE sale ese número. Ronda 2 de playtest: el operador vio siete
        // cables diciendo `1 / 6` y no tenía cómo saber que un cable lleva lo
        // que cuelga aguas abajo de él, ni por qué entonces la carga nunca
        // subía. Es la frase que convierte siete cifras iguales en una regla.
        lines.push({ text: `• ${labels.wireLoadExplained}`, color: LABEL_COLOR });
        // 14a-3: cuánto calor está metiendo en la sala. Va SOLO cuando el efecto
        // de partículas también se ve, con el mismo umbral Y sobre la misma
        // magnitud (el total del cable): si el jugador ve el shimmer tiene que
        // encontrar acá el número, y si no lo ve, esta línea sería ruido sobre un
        // aporte que no cambia nada.
        if (content.heatTotalCelsiusPerSecond >= WIRE_HEAT_VISIBLE_CELSIUS_PER_SECOND) {
          lines.push({
            text: `≈ ${labels.wireHeat(content.heatCelsiusPerSecond)}`,
            color: CRISIS_WARNING_CSS,
          });
        }
      }
      if (content.wear !== "nuevo") {
        lines.push({
          text: `• ${labels.wearTag(content.wear)}`,
          color: COMPONENT_WEAR_CSS[content.wear] ?? TAG_CATEGORY_CSS.material,
        });
      }
      // Por qué la capacidad es más baja de lo que dice el catálogo: sin esta
      // línea, un cable degradado por la temperatura parece un bug de números.
      if (content.thermallyDerated) {
        lines.push({ text: `• ${labels.wireThermallyDerated}`, color: CRISIS_WARNING_CSS });
      }
    }
    if (content.kind !== "wire" && content.atmosphere) {
      lines.push({
        text: `• ${labels.sectionPressure(content.atmosphere.pressureKpa)}`,
        color: LABEL_COLOR,
      });
      if (content.atmosphere.trend !== "stable") {
        lines.push({
          text: `• ${labels.sectionPressureTrend(content.atmosphere.trend)}`,
          // Rojo = se está vaciando (Eje A, crítico); ámbar = se está
          // recuperando, que es buena noticia pero todavía no es "listo".
          // Mismo contrato de color de 12e, sin inventar tonos nuevos.
          color: content.atmosphere.trend === "draining" ? CRISIS_FATAL_CSS : CRISIS_WARNING_CSS,
        });
      }
      // Eje aparte de la tendencia a propósito: una sala puede estar
      // recuperando presión y seguir matando. Es LA línea que responde el
      // reporte del playtest ("tapé la brecha y todavía le hizo daño"), así que
      // dice el hecho crudo en vez de mezclarlo con el texto de tendencia.
      if (content.atmosphere.vacuum) {
        lines.push({ text: `☠ ${labels.sectionVacuum}`, color: CRISIS_FATAL_CSS });
      }
      // Subfase 14a-1: la temperatura va SIEMPRE, como la presión — es la
      // lectura que hace diagnosticable todo el eje térmico. El color la marca
      // solo cuando cruza un umbral, para que a 21 °C no compita con lo que de
      // verdad está mal.
      //
      // Ronda 1 de playtest de 14a-2: hasta acá SOLO se coloreaba el lado
      // caliente, o sea que una sala a -50 °C —letal, y con la escarcha
      // pintándose encima— se leía en el mismo gris neutro que una a 21. El eje
      // tiene dos lados y la UI mostraba uno; es el hermano exacto del cable que
      // no decía su estado. Los dos umbrales salen de `HAZARD_PARAMETERS.thermal`
      // (la vida del TRIPULANTE, no la estructura de la sección): si el tooltip
      // se pone rojo, esa sala mata a quien esté adentro — la misma promesa que
      // hace la escarcha.
      lines.push({
        text: `• ${labels.sectionTemperature(content.atmosphere.temperatureCelsius)}`,
        color: isLethalTemperature(content.atmosphere.temperatureCelsius) ? CRISIS_FATAL_CSS : LABEL_COLOR,
      });
      // Y el aviso de fuente activa aparte, mismo criterio y mismo ámbar que
      // `pressure-recovering`: "esto todavía está pasando".
      if (content.atmosphere.heating) {
        lines.push({ text: `• ${labels.sectionHeating}`, color: CRISIS_WARNING_CSS });
      }
      // 14a-3: la consecuencia del umbral, en palabras. Va en rojo y no en
      // ámbar porque no es "esto está pasando" sino "cualquier cosa inflamable
      // que entre acá arde", que es del mismo orden que el vacío.
      if (content.atmosphere.selfIgniting) {
        lines.push({ text: `⚠ ${labels.sectionSelfIgniting}`, color: CRISIS_FATAL_CSS });
      }
      // 14b-1: la consecuencia del umbral químico. Ámbar y no rojo porque el
      // peligro real de la sustancia ya lo dicen sus propias líneas más abajo
      // (y la toxicidad letal vive en otro umbral); esto informa dónde está la
      // línea de disparo del sensor, que es lo que el jugador cablea.
      if (content.atmosphere.chemicalAlarm) {
        lines.push({ text: `• ${labels.sectionChemicalAlarm}`, color: CRISIS_WARNING_CSS });
      }
      // El oxígeno va junto a la temperatura y la presión: son las tres lecturas
      // de "¿qué le pasa a este aire?", y la de O2 es la que faltaba.
      const oxygen = content.atmosphere.oxygen;
      if (oxygen) {
        lines.push({
          text: `• ${labels.sectionOxygen(oxygen.percent, oxygen.bucket)}`,
          // Rojo cuando ya no se puede respirar ni arder nada: es del mismo
          // orden que el vacío. Ámbar cuando está enriquecida, que es un peligro
          // de signo contrario (todo arde más fácil).
          color:
            oxygen.bucket === "none" || oxygen.bucket === "low"
              ? CRISIS_FATAL_CSS
              : oxygen.bucket === "high"
                ? CRISIS_WARNING_CSS
                : LABEL_COLOR,
        });
      }
      for (const substance of content.atmosphere.substanceStates ?? []) {
        lines.push({
          text: `• ${labels.substanceState(substance.name, substance.state, substance.percent)}`,
          color: LABEL_COLOR,
        });
      }
      // De dónde sale el calor, si sale del cableado: es la causa que el jugador
      // busca mirando la sala y que hasta acá solo se podía leer cable por cable.
      const wiringHeat = content.atmosphere.wiringHeatCelsiusPerSecond ?? 0;
      if (wiringHeat >= WIRE_HEAT_VISIBLE_CELSIUS_PER_SECOND) {
        lines.push({ text: `≈ ${labels.sectionWiringHeat(wiringHeat)}`, color: CRISIS_WARNING_CSS });
      }
    }
    const breach = content.kind === "wire" ? undefined : content.breach;
    if (breach) {
      lines.push({
        text: `${breach.sealed ? "✔" : "⚠"} ${labels.sectionBreach(breach.sealed)}`,
        color: breach.sealed ? LABEL_COLOR : CRISIS_FATAL_CSS,
      });
    }
    for (const { text, color } of lines) {
      const line = scene.add
        .text(PADDING, y, text, {
          fontFamily: "sans-serif",
          fontSize: "11px",
          color,
          wordWrap: { width: TOOLTIP_WIDTH - PADDING * 2 },
        })
        .setOrigin(0, 0);
      container.add(line);
      y += line.height + 4;
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
