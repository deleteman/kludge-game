import type {
  ChemicalSubstanceId,
  ChemicalTag,
  ComponentCondition,
  ComponentWear,
  ConduitKind,
  CoreLoopMode,
  ShipStatusLevel,
  SignalNodeRole,
} from "engine";

/**
 * Paleta placeholder de Fase 5, data-driven. Cuando se elija el pack de
 * pixel art (GDD §17) estos valores se sustituyen por el código de color por
 * tipo de recurso del GDD §10 + tint en runtime (GDD 11.0) — el renderer no
 * cambia, solo esta tabla.
 */
/**
 * ─────────────────────────────────────────────────────────────────────────
 * Eje A — Contrato de semántica de color de crisis/diagnóstico (Fase 12e).
 * ─────────────────────────────────────────────────────────────────────────
 * Fuente CANÓNICA del lenguaje de color de estado (deuda #15 de
 * `PENDIENTES_OBSERVACIONES.md`, comparativa FTL/Barotrauma). Todo lo que
 * comunique salud/urgencia deriva de estas cuatro constantes — no se hardcodea
 * un hex de estado suelto en ningún otro sitio. Antes de 12e el "rojo fatal"
 * vivía en 3 hex distintos y el ámbar se reusaba para 7+ significados; acá se
 * consolida.
 *
 * Ortogonal al Eje B (categoría de propiedad, `TAG_CATEGORY_COLORS`) y al eje
 * de identidad de recurso/rol (`CONDUIT_COLORS`/`SIGNAL_NODE_COLORS`): que el
 * conducto `senal` sea verde es identidad de recurso, NO "estado seguro".
 *
 * Decisión de diseño 12e: el verde sigue siendo "seguro/nominal" (no se adopta
 * el cian/blanco literal de FTL, que sería un recolor invasivo de toda la UI ya
 * entregada). Cian/blanco queda como canal INFORMATIVO frío, no de seguridad.
 */
export const CRISIS_FATAL_COLOR = 0xe0483f; // rojo: crítico / sin O2 / muerte
export const CRISIS_WARNING_COLOR = 0xe0a33f; // ámbar: escalable / degradado
export const CRISIS_SAFE_COLOR = 0x64dc78; // verde: nominal / todo bien
export const INFO_NEUTRAL_COLOR = 0x9fd8ff; // cian/blanco: dato frío, no-estado

/** Convierte un color numérico (0xRRGGBB) a string CSS `#rrggbb` para `Phaser.Text`. */
export function hexToCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** Espejos CSS del contrato (Phaser.Text toma string, no número). */
export const CRISIS_FATAL_CSS = hexToCss(CRISIS_FATAL_COLOR);
export const CRISIS_WARNING_CSS = hexToCss(CRISIS_WARNING_COLOR);
export const CRISIS_SAFE_CSS = hexToCss(CRISIS_SAFE_COLOR);
export const INFO_NEUTRAL_CSS = hexToCss(INFO_NEUTRAL_COLOR);

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Eje B — Color por categoría de propiedad (tags) (Fase 12e).
 * ─────────────────────────────────────────────────────────────────────────
 * Identidad de QUÉ TIPO de propiedad es un tag, no su estado. Hues elegidos
 * para NO colisionar con el Eje A (rojo/ámbar/verde) ni entre sí. El químico ya
 * vive en `CHEMICAL_TAG_COLORS` (por tag individual); acá se suman las dos
 * categorías que hasta 12e se pintaban como texto plano.
 */
export const TAG_CATEGORY_COLORS: Readonly<Record<"functional" | "material", number>> = {
  functional: 0x7fb4ff, // azul acero
  material: 0xc0a080, // bronce/tierra
};
export const TAG_CATEGORY_CSS = {
  functional: hexToCss(TAG_CATEGORY_COLORS.functional),
  material: hexToCss(TAG_CATEGORY_COLORS.material),
} as const;

export const CONDUIT_COLORS: Readonly<Record<ConduitKind, number>> = {
  ventilacion: 0x3fd4e0,
  electrico: 0xf2d24b,
  fluido: 0x4a7bd4,
  senal: 0x64dc78,
};

/**
 * Marca de válvula sellada (apertura 0) — debe distinguirse de una abierta
 * (principio 6). Reusa `CRISIS_FATAL_COLOR` a propósito (Fase 12e): una válvula
 * bloqueada es un estado de riesgo/bloqueo, coherente con el rojo del contrato.
 */
export const SEALED_VALVE_COLOR = CRISIS_FATAL_COLOR;

/**
 * Destello del slider de energía al rechazar un arrastre que se pasa del
 * presupuesto libre (Fase 13b, ronda 6). Mismo criterio que
 * `SEALED_VALVE_COLOR`: el rojo del contrato marca bloqueo. Es un color de
 * EVENTO (destello puntual), no de estado — el tramo bloqueado en reposo se
 * pinta con un gris neutro, porque aparece casi siempre y en rojo permanente
 * sería alarma falsa.
 */
export const POWER_BLOCKED_FLASH_COLOR = CRISIS_FATAL_COLOR;

/**
 * Marcador persistente sobre una brecha de casco abierta (13f, ronda 1 de
 * playtest). Rojo del contrato de 12e: es lo más grave que le puede pasar a una
 * sección. Al sellarla pasa a `BREACH_SEALED_MARKER_COLOR` — el agujero sigue
 * ahí (el casco no se repara, principio 5) pero deja de ser una emergencia, y
 * dos estados distintos no pueden verse igual (principio 6).
 */
export const BREACH_MARKER_COLOR = CRISIS_FATAL_COLOR;
export const BREACH_SEALED_MARKER_COLOR = CRISIS_SAFE_COLOR;

/** Opacidad de una capa del plano desactivada por el toggle de HUD (Fase 11f) — atenuada, nunca oculta del todo. */
export const CONDUIT_LAYER_INACTIVE_ALPHA = 0.25;

/** Rellenos tenues por sección, asignados cíclicamente. */
export const SECTION_FILL_COLORS: readonly number[] = [
  0x24365c, 0x2c4a44, 0x4a3a2c, 0x3c2c4a, 0x2c3c5a, 0x44502e, 0x50372e, 0x2e5046,
];

export const SECTION_FILL_ALPHA = 0.55;
export const WALL_COLOR = 0x9aa4bc;
export const GRID_LINE_COLOR = 0x1a2030;
export const ANCHOR_COLOR = 0x8890a8;
export const LABEL_COLOR = "#d8dce8";
export const HEADER_COLOR = "#f0f2f8";
/** Texto de un objetivo ya cumplido en el checklist (verde, playtest #15) — `CRISIS_SAFE` (Fase 12e). */
export const OBJECTIVE_DONE_COLOR = CRISIS_SAFE_CSS;

/**
 * Color de nodo de señal por rol — mismos valores que usaba
 * `workbench-renderer.ts` en solitario (Fase 9.5), factorizados acá (Fase
 * 10d) para que el plano real de una misión los reutilice sin duplicar la
 * tabla.
 */
export const SIGNAL_NODE_COLORS: Readonly<Record<SignalNodeRole, number>> = {
  emitter: 0xf2d24b,
  receptor: 0x4a7bd4,
  conductor: 0x64dc78,
};

/**
 * Tinte por `condition` de una instancia colocada (Fase 10d, principio 6 de
 * CLAUDE.md: un actuador atascado nunca debe lucer igual que uno operativo).
 * `ok` no tiñe — usa el color de sección normal ya asignado por índice.
 */
export const COMPONENT_CONDITION_TINT: Readonly<Partial<Record<ComponentCondition, number>>> = {
  jammed: CRISIS_WARNING_COLOR, // ámbar del contrato (Fase 12e)
  destroyed: 0x4a4a52,
};

/**
 * Tinte por DESGASTE de una instancia (Subfase 13c). Eje ortogonal a
 * `COMPONENT_CONDITION_TINT`: aquel dice si la pieza responde, este dice cuánta
 * historia arrastra. Una pieza desgastada funciona con normalidad, así que su
 * señal visual es más apagada que la de `jammed` — no es una alarma, es una
 * advertencia de fragilidad.
 *
 * `nuevo` no tiñe (usa el color de sección normal). Los tres niveles restantes
 * no inventan hues fuera del contrato de 12e: `usado` es un desaturado neutro
 * (todavía no es un problema), `degradado` es el ámbar del contrato y `critico`
 * el rojo — el mismo lenguaje rojo/ámbar/seguro que el resto de la UI.
 *
 * Prioridad al pintar (`mission-overlay-renderer.ts`): `condition` gana sobre
 * `wear`. Una pieza destruida se ve destruida aunque además esté degradada; el
 * dato más grave manda, para no colapsar dos estados en un color intermedio.
 */
export const COMPONENT_WEAR_TINT: Readonly<Partial<Record<ComponentWear, number>>> = {
  usado: 0xb9a98f, // bronce apagado: se nota, no alarma
  degradado: CRISIS_WARNING_COLOR,
  critico: CRISIS_FATAL_COLOR,
};

/** Color de texto del tag de desgaste en el inspector, por nivel. */
export const COMPONENT_WEAR_CSS: Readonly<Partial<Record<ComponentWear, string>>> = {
  usado: hexToCss(0xb9a98f),
  degradado: CRISIS_WARNING_CSS,
  critico: CRISIS_FATAL_CSS,
};

/**
 * Indicador LED (Subfase 11h): binario, resuelto por tinte en runtime (GDD
 * 11.0), sin sistema de luces nuevo. Ámbar de alerta encendido / gris
 * apagado — mismo criterio de "dos fenómenos nunca deben verse igual" que el
 * resto de la paleta (principio 6). Distinto de `COMPONENT_CONDITION_TINT`
 * (ese es por `condition` de la instancia, este es por estado de señal
 * ON/OFF). Fase 12e: apunta a `CRISIS_WARNING_COLOR` del contrato — el verde
 * queda reservado para "todo bien", usarlo para una alarma sería semánticamente
 * al revés (regresión original de la deuda #15). El LED sigue binario ON/OFF;
 * su estado rojo / lectura de umbral es configurabilidad por instancia, diferida
 * a la deuda #15 (ciclo propio), NO parte de 12e.
 */
export const LED_ACTIVE_TINT = CRISIS_WARNING_COLOR;
export const LED_INACTIVE_TINT = 0x3a3f4a;

/**
 * Luz que emite un LED encendido (Fase 12d): un halo suave que apenas rebasa el
 * sprite para leerse como "encendido" sin quemar (feedback de playtest: antes
 * quedaba centrado en la esquina y demasiado fuerte). Radio un poco mayor que
 * la celda para que el halo salga del sprite; intensidad baja y estable (un LED
 * de estado no titila).
 */
export const LED_LIGHT_RADIUS_PX = 52;
export const LED_LIGHT_INTENSITY = 0.35;

/** Colores de token de tripulante (Fase 10d), asignados cíclicamente por índice de actor activo. */
export const CREW_TOKEN_COLORS: readonly number[] = [
  0xf0f2f8, 0x64dc78, 0x4a7bd4, 0xf2d24b, 0xe0483f, 0xb47bd4,
];

/** Resaltado de la celda bajo el cursor (Fase 10d, ajuste post-playtest #4). */
export const HOVER_HIGHLIGHT_COLOR = 0xf0f2f8;

/** Resaltado PERSISTENTE de la celda seleccionada (sobre la que se va a actuar) — color distinto del hover (playtest #8); verde `CRISIS_SAFE` del contrato (Fase 12e). */
export const SELECTED_CELL_COLOR = CRISIS_SAFE_COLOR;

/** Anillos de nodos de señal clickeables en modo cableado (playtest #15) — ámbar, distinto del verde de selección. */
export const WIRE_HIGHLIGHT_COLOR = 0xffc24d;

/**
 * Color por modo del core loop (Fase 10d, ajuste post-playtest #4): el estado
 * pausa/ejecución debe notarse de un vistazo (principio 6 de CLAUDE.md, dos
 * estados nunca deben verse igual). Verde = corriendo, ámbar = congelado.
 */
export const CORE_LOOP_MODE_COLORS: Readonly<Record<CoreLoopMode, number>> = {
  execution: CRISIS_SAFE_COLOR, // verde = corriendo (Fase 12e)
  planning: CRISIS_WARNING_COLOR, // ámbar = congelado
};

/**
 * Color del texto del temporizador de crisis (cap. 2) por urgencia: calmo
 * mientras hay margen, ámbar cuando empieza el castigo progresivo, rojo cuando
 * queda poco (principio 6: la urgencia debe verse de un vistazo). Strings CSS
 * porque el color de un `Phaser.Text` es una cadena, no un número.
 */
export const TIMER_TEXT_COLORS = {
  calm: "#d8dce8",
  warning: CRISIS_WARNING_CSS, // ámbar del contrato (Fase 12e)
  danger: CRISIS_FATAL_CSS, // rojo del contrato
} as const;

/**
 * Trayectoria fantasma en pausa táctica (Fase 11a.3, ASA 3). Mismo tono cian
 * que la estela de aceleración magnética (`kinetics-effect.ts`, doc §4,
 * principio 6): el fantasma es la promesa de esa estela, no un color
 * arbitrario nuevo.
 */
export const TRAJECTORY_GHOST_COLOR = 0x9fd8ff;

/**
 * Cicatriz de "sección sin energía" (Fase 11b). Color EXCLUSIVO — no
 * reutilizado por `SECTION_FILL_COLORS` ni `COMPONENT_CONDITION_TINT` — para
 * que no se confunda con un simple "todavía no cableado" (principio 6: dos
 * fenómenos distintos nunca deben verse igual). El parpadeo (no solo el
 * tinte) es lo que lo hace inconfundible: ver `sectionScarFlickerAlpha`.
 */
export const UNPOWERED_SECTION_TINT = 0x050810;
export const UNPOWERED_SECTION_MIN_ALPHA = 0.35;
export const UNPOWERED_SECTION_MAX_ALPHA = 0.7;
/** Un ciclo de parpadeo completo cada 1.6s — lento, para no distraer del resto de la lectura del plano. */
export const UNPOWERED_SECTION_FLICKER_PERIOD_SECONDS = 1.6;

/**
 * Luz ambiental de "sección sin energía" (Fase 12a, corrección post-playtest — el texto original de la
 * fase la pedía como ejemplo de "estados de daño de fondo" y había quedado sin implementar). Violeta
 * apagado, no ámbar/rojo: es AUSENCIA de energía, no una alarma activa como la sobrecarga o el overlay
 * global.
 *
 * 2ª corrección del mismo playtest: la primera versión reusaba `sectionScarFlickerAlpha` (seno suave,
 * período fijo de 1.6s) — se leía como un pulso predecible, no como una falla real. `flickeringLightIntensity`
 * (abajo) es un patrón nuevo, no reutilizado de ningún otro parpadeo del proyecto a propósito: mayormente
 * OSCURA, con chispazos breves e irregulares — "luz de emergencia que quiere prender y no puede", no un
 * "todo bien pero atenuado".
 */
export const UNPOWERED_SECTION_LIGHT_COLOR = 0x2a1f4a;
export const UNPOWERED_SECTION_LIGHT_RADIUS_PX = 96;
const UNPOWERED_SECTION_LIGHT_MIN_INTENSITY = 0.02;
const UNPOWERED_SECTION_LIGHT_MAX_INTENSITY = 0.22;

/**
 * Parpadeo errático genérico (Fase 12a, corrección post-playtest): suma de senos a frecuencias
 * inconmensurables entre sí (sin múltiplos enteros comunes) para que el resultado no se perciba
 * periódico a simple vista, más un umbral que recorta casi todo a 0 — la luz pasa la mayor parte del
 * tiempo prácticamente apagada, con chispazos cortos que rompen el silencio en vez de una onda continua.
 * Determinístico (sin `Math.random()`): mismo criterio de testeabilidad que el resto del motor de
 * partículas, y evita que dos lecturas del mismo instante dentro de un frame den valores distintos.
 */
function flickeringLightIntensity(elapsedSeconds: number, seed: number, minIntensity: number, maxIntensity: number): number {
  const n1 = Math.sin(elapsedSeconds * 13.7 + seed);
  const n2 = Math.sin(elapsedSeconds * 5.3 + seed * 2.1 + 1.7);
  const n3 = Math.sin(elapsedSeconds * 27.1 + seed * 0.6 + 4.2);
  const noise = (n1 + n2 * 0.6 + n3 * 0.3) / 1.9; // aproximadamente [-1, 1]
  // Recorta todo por debajo del umbral a 0 — sin esto, la suma de senos sigue
  // pareciendo una onda continua; con el umbral, se leen chispazos aislados.
  const spike = Math.max(0, noise - 0.5) / 0.5;
  return minIntensity + spike * (maxIntensity - minIntensity);
}

/**
 * Intensidad de la luz ambiental de una sección sin energía en un instante dado — ver
 * `flickeringLightIntensity`. `seed` (opcional, default 0) desincroniza el parpadeo entre secciones
 * distintas si algún día hay más de una sin energía a la vez — sin él, todas titilarían al unísono.
 */
export function unpoweredSectionLightIntensity(elapsedSeconds: number, seed = 0): number {
  return flickeringLightIntensity(
    elapsedSeconds,
    seed,
    UNPOWERED_SECTION_LIGHT_MIN_INTENSITY,
    UNPOWERED_SECTION_LIGHT_MAX_INTENSITY,
  );
}

/**
 * Color curado por elemento base (GDD 5.4.1, mesa de creación modo química,
 * Fase 11c.3) — inspirado en color de llama/estado real (ej. sodio amarillo
 * de flama, cobre cobrizo, azufre amarillo), no en física exacta, mismo
 * criterio de simplificación de gameplay que el resto del catálogo químico.
 * Data-driven: un color por `ChemicalSubstanceId` de `ELEMENT_CATALOG`, no
 * lógica embebida en el renderer.
 */
export const CHEMICAL_ELEMENT_COLORS: Readonly<Record<string, number>> = {
  hidrogeno: 0xdff3ff,
  oxigeno: 0x8ec8ff,
  nitrogeno: 0xb9c9d6,
  carbono: 0x2b2b2b,
  cloro: 0xb7d436,
  sodio: 0xffd35c,
  potasio: 0xc98bd9,
  hierro: 0xa6664c,
  cobre: 0xc77a45,
  aluminio: 0xc8ccd0,
  azufre: 0xf2e04c,
  fosforo: 0xe0703f,
  fluor: 0xd9e86a,
  helio: 0xffd6e8,
  neon: 0xff6b4a,
  argon: 0x9b6bd9,
  silicio: 0x4a4f57,
  calcio: 0xff8a4c,
  magnesio: 0xf5f5f0,
  plomo: 0x6b7280,
  zinc: 0x9fb0c3,
  niquel: 0xc9c0a0,
  platino: 0xd9d4c8,
  litio: 0xe0435c,
  yodo: 0x8b3aa0,
  bromo: 0x8b2e1f,
  xenon: 0x5b8fd9,
  titanio: 0x8a949e,
  "nitrogeno-liquido": 0xc3e8ff,
};

/**
 * Colores curados de los COMPUESTOS del catálogo (13e ronda 4). La tabla de
 * arriba solo cubre los 29 elementos, así que un compuesto caía al color de su
 * primer tag — y el agua (`INERTE`) terminaba pintada con el mismo gris que las
 * paredes, los anclajes y "sustancia desconocida". Un charco de agua era
 * literalmente invisible sobre el suelo del plano.
 */
export const CHEMICAL_COMPOUND_COLORS: Readonly<Record<string, number>> = {
  agua: 0x4aa8e8,
  "sal-comun": 0xe8e4d8,
  "acido-de-laboratorio": 0xc9e04c,
  "dioxido-de-carbono": 0x7a8494,
  amoniaco: 0x9ee06a,
  "oxido-de-hierro": 0xb0553a,
  peroxido: 0xd8f0ff,
  "oxido-de-magnesio": 0xf0f0e4,
  acero: 0x9aa4b4,
  laton: 0xd0a44c,
  "refrigerante-sintetico": 0x6fd8d0,
  "combustible-de-motor": 0xff9a3c,
  "acido-de-bateria": 0xd4e04c,
  "base-de-laboratorio": 0x5c9ce8,
  "disolvente-volatil": 0xe86ac0,
  "anestesico-medico": 0xc8a8e8,
  desinfectante: 0x8ce0d0,
  "propelente-oxidante-municion": 0xffcb4a,
  "fluido-biologico": 0xd0604c,
  "sustancia-medica-generica": 0xe0f0f8,
};

/**
 * Color neutro para una sustancia sin entrada curada. Tiene que ser DISTINTO de
 * `CHEMICAL_TAG_COLORS.INERTE` y de `ANCHOR_COLOR`: hasta 13e ronda 4 los tres
 * valían `0x8a949e`, o sea tres significados con un mismo color — exactamente
 * lo que el principio 6 prohíbe, y la razón de que "no identificada", "inerte" y
 * "anclaje" fueran indistinguibles en pantalla.
 */
export const CHEMICAL_ELEMENT_FALLBACK_COLOR = 0xb07acc;

export function chemicalElementColor(id: ChemicalSubstanceId | string): number {
  return CHEMICAL_ELEMENT_COLORS[id as string] ?? CHEMICAL_ELEMENT_FALLBACK_COLOR;
}

/**
 * Color por tag químico (GDD 5.3) — usado para el resultado de una síntesis,
 * cuya identidad es la que el motor resuelve (receta/regla/fallback), no una
 * sustancia curada individualmente. TOX/CORR reutilizan los mismos valores
 * que `CLOUD_TINT` (`game/src/particles/effects/hazard-effect.ts`) para que
 * un mismo fenómeno se vea igual en la mesa y en el plano (principio 6).
 */
export const CHEMICAL_TAG_COLORS: Readonly<Record<ChemicalTag["name"], number>> = {
  OXI: 0x4fd8e0,
  COMB: 0xff8c42,
  ACID: 0xc9e04c,
  BASE: 0x4c8ce0,
  // Distinto del neutro de "desconocida" y del de anclaje (ver
  // `CHEMICAL_ELEMENT_FALLBACK_COLOR`), y alejado de `WALL_COLOR` para que un
  // charco no se confunda con una pared.
  INERTE: 0x6f8fa8,
  VOLAT: 0xe04ca0,
  TOX: 0x6adc7a,
  CORR: 0xd4a83f,
};

export function chemicalResultColor(tags: ReadonlyArray<ChemicalTag>): number {
  return tags[0] ? CHEMICAL_TAG_COLORS[tags[0].name] : CHEMICAL_ELEMENT_FALLBACK_COLOR;
}

/**
 * Color de CUALQUIER sustancia (elemento o compuesto), 13e ronda 2. Un charco
 * de agua y uno de ácido no pueden verse iguales (principio 6), y hasta acá
 * todo derrame se pintaba con un verde-agua fijo y toda nube de sección con uno
 * de dos colores por tag.
 *
 * Prioriza el color CURADO del elemento sobre el genérico del tag: si la
 * sustancia está en `CHEMICAL_ELEMENT_COLORS` esa entrada es más específica
 * que "es tóxica". Un compuesto (agua, ácido) cae al color de su primer tag, y
 * lo que no tenga ni una cosa ni la otra, al neutro.
 */
export function chemicalSubstanceColor(
  id: ChemicalSubstanceId | string,
  tags: ReadonlyArray<ChemicalTag> = [],
): number {
  const curated = CHEMICAL_ELEMENT_COLORS[id as string] ?? CHEMICAL_COMPOUND_COLORS[id as string];
  return curated ?? chemicalResultColor(tags);
}

/**
 * Color por fracción [0,1] de un valor "de salud" genérico (verde → ámbar →
 * rojo) — extraído de `crew-strip.ts` (Fase 9) a la paleta compartida en
 * Subfase 11g para que `ship-status-hud.ts` use el mismo corte de 3 niveles
 * sin duplicar la función. Mismo corte que `fractionToLevel` del motor
 * (`engine/src/ship-status/ship-status-aggregation.ts`): >0.5 / >0.25 / resto.
 */
export function healthFractionColor(fraction: number): number {
  if (fraction > 0.5) return CRISIS_SAFE_COLOR;
  if (fraction > 0.25) return CRISIS_WARNING_COLOR;
  return CRISIS_FATAL_COLOR;
}

/** Alpha del tinte de cicatriz de energía en un instante dado (Fase 11b) — parpadeo sinusoidal continuo, no un toggle discreto. */
export function sectionScarFlickerAlpha(elapsedSeconds: number): number {
  const phase = (elapsedSeconds / UNPOWERED_SECTION_FLICKER_PERIOD_SECONDS) * Math.PI * 2;
  const wave = (Math.sin(phase) + 1) / 2;
  return UNPOWERED_SECTION_MIN_ALPHA + wave * (UNPOWERED_SECTION_MAX_ALPHA - UNPOWERED_SECTION_MIN_ALPHA);
}

/**
 * Cicatriz de "conductor/reservorio en cortocircuito" (Fase 12a,
 * `Blueprint.overloadedRefs`, `MissionOverloadRuntime`). Mismo tono ámbar que
 * `SPARK_COLOR_BY_RESOURCE.E` en `overload-effect.ts` (el burst inicial y la
 * cicatriz persistente son el mismo fenómeno, deben leerse como continuación
 * uno del otro) para la luz aditiva; color exclusivo distinto de
 * `UNPOWERED_SECTION_TINT` para el tinte de superficie (principio 6: no debe
 * confundirse con la cicatriz de sección sin energía).
 */
export const OVERLOADED_CONDUCTOR_LIGHT_COLOR = 0xf2d24b;
// Radio ampliado (feedback de playtest): con 36px la luz apenas rebasaba las
// chispas y no se leía como "campo de luz"; con más radio ilumina el entorno y
// proyecta sombras de lo cercano.
export const OVERLOADED_CONDUCTOR_LIGHT_RADIUS_PX = 64;
export const OVERLOADED_CONDUCTOR_LIGHT_MIN_INTENSITY = 0.25;
export const OVERLOADED_CONDUCTOR_LIGHT_MAX_INTENSITY = 0.65;
/** Parpadeo errático de chispa, mucho más rápido que la cicatriz de energía (0.35s vs. 1.6s) — un cortocircuito no respira, titila. */
export const OVERLOADED_CONDUCTOR_FLICKER_PERIOD_SECONDS = 0.35;

/** Intensidad de luz de un conductor sobrecargado en un instante dado — parpadeo rápido, no sinusoidal suave (a diferencia de `sectionScarFlickerAlpha`), para leerse como chispazo errático. */
export function overloadedConductorFlickerIntensity(elapsedSeconds: number): number {
  const phase = (elapsedSeconds / OVERLOADED_CONDUCTOR_FLICKER_PERIOD_SECONDS) * Math.PI * 2;
  // Onda cuadrada suavizada (seno elevado a potencia impar) en vez de seno puro: transiciones más bruscas, "titileo" en vez de "respiración".
  const wave = Math.abs(Math.sin(phase)) ** 3;
  return (
    OVERLOADED_CONDUCTOR_LIGHT_MIN_INTENSITY +
    wave * (OVERLOADED_CONDUCTOR_LIGHT_MAX_INTENSITY - OVERLOADED_CONDUCTOR_LIGHT_MIN_INTENSITY)
  );
}

/**
 * Capa "estructural" del HUD del plano (Fase 12a): tiñe cada sección según su
 * peor RE agregado (`aggregateSectionHullIntegrity`) — `nominal` no se
 * dibuja (nada que remarcar), `warning`/`critical` usan el mismo par
 * ámbar/rojo que `healthFractionColor`, para que el jugador ya asocie esos
 * colores a "degradado"/"crítico" en el resto de la UI (principio 6: mismo
 * fenómeno, mismo color, en vez de inventar una paleta nueva por overlay).
 */
export const STRUCTURAL_LAYER_COLOR: Readonly<Partial<Record<ShipStatusLevel, number>>> = {
  warning: CRISIS_WARNING_COLOR, // ámbar/rojo del contrato (Fase 12e)
  critical: CRISIS_FATAL_COLOR,
};
export const STRUCTURAL_LAYER_ALPHA = 0.35;

/**
 * Capa "energia" del HUD del plano (Fase 13b): heatmap de demanda vs.
 * suministro por sección. `"dark"` = sección sin ninguna unidad asignada
 * (fuera de la grilla, `Blueprint.unpoweredSectionIds`) — mismo rojo fatal
 * que el resto del contrato. `"deficit"` = con suministro pero insuficiente
 * para todos sus componentes (triaje interno en curso) — mismo ámbar de
 * "escalable/degradado". Sección con superávit/exacto no se dibuja (principio
 * 6: nominal no compite visualmente). NO reusa `CONDUIT_COLORS.electrico`
 * (identidad de recurso, no estado) — deriva del Eje A como `STRUCTURAL_LAYER_COLOR`.
 */
export const ENERGY_LAYER_COLOR: Readonly<Partial<Record<"dark" | "deficit", number>>> = {
  dark: CRISIS_FATAL_COLOR,
  deficit: CRISIS_WARNING_COLOR,
};
export const ENERGY_LAYER_ALPHA = 0.35;

/**
 * Capa "puertas" del HUD del plano (Subfase 13h). Estado de la hoja, no
 * identidad de recurso: deriva del Eje A como `STRUCTURAL_LAYER_COLOR` y
 * `ENERGY_LAYER_COLOR`, y NO reusa `CONDUIT_COLORS.ventilacion`.
 *
 * Cinco estados con cinco lecturas distintas (principio 6 de CLAUDE.md — dos
 * fenómenos distintos nunca deben verse igual): abierta (verde tenue, se
 * puede pasar), cerrada (el color base de casco, compartimentando), trabada
 * (ámbar del contrato de 12e: no responde y el jugador tiene que saber por
 * qué), sin energía (gris apagado, misma familia que la zona oscura de 13b) y
 * destruida (rojo fatal — hueco permanente).
 */
export const DOOR_STATE_COLOR = {
  open: 0x4fd08a,
  closed: 0x8fa3b8,
  jammed: CRISIS_WARNING_COLOR,
  unpowered: 0x5a6570,
  destroyed: CRISIS_FATAL_COLOR,
} as const;
export const DOOR_LAYER_ALPHA = 0.9;

/**
 * Capa "presion" del HUD del plano (Subfase 13h): heatmap de presión por
 * sección, para ver de un vistazo qué sala se está vaciando. Molde exacto de
 * `ENERGY_LAYER_COLOR` — una sección a presión nominal no se dibuja
 * (principio 6), solo las que están por debajo.
 */
export const PRESSURE_LAYER_COLOR: Readonly<Record<"low" | "vacuum", number>> = {
  low: CRISIS_WARNING_COLOR,
  vacuum: CRISIS_FATAL_COLOR,
};
export const PRESSURE_LAYER_ALPHA = 0.35;

/**
 * Overlay de alerta de pantalla completa (Fase 12a): crisis crítica en curso
 * (dominio del HUD de estado de nave en `"critical"`, o un evento violento de
 * `overload`/`combustion`/fuga). Fase 12e: variante OSCURA de `CRISIS_FATAL`
 * para un tinte de relleno de viñeta (no un foreground) — el tono profundo evita
 * quemar la pantalla a alpha alto; sigue leyéndose como el rojo fatal del
 * contrato. Distinto de `UNPOWERED_SECTION_TINT` (casi negro) y de
 * `OVERLOADED_CONDUCTOR_LIGHT_COLOR` (ámbar) — principio 6.
 */
export const SCREEN_ALERT_TINT = 0x8a0f0f;
export const SCREEN_ALERT_MIN_ALPHA = 0;
export const SCREEN_ALERT_MAX_ALPHA = 0.22;
/** Más rápido que la cicatriz de sección pero más lento que el chispazo de sobrecarga — urgente sin llegar a epilepsia. */
export const SCREEN_ALERT_FLICKER_PERIOD_SECONDS = 0.9;

/** Alpha del overlay de alerta global en un instante dado — mismo criterio sinusoidal que `sectionScarFlickerAlpha`, período propio para no verse igual. */
export function screenAlertFlickerAlpha(elapsedSeconds: number): number {
  const phase = (elapsedSeconds / SCREEN_ALERT_FLICKER_PERIOD_SECONDS) * Math.PI * 2;
  const wave = (Math.sin(phase) + 1) / 2;
  return SCREEN_ALERT_MIN_ALPHA + wave * (SCREEN_ALERT_MAX_ALPHA - SCREEN_ALERT_MIN_ALPHA);
}
