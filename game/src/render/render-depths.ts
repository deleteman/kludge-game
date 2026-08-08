/**
 * Convención explícita de profundidad por nombre de capa (reemplaza la
 * dependencia implícita en el orden de inserción de `floorplan-renderer.ts`).
 * Las claves `background`/`objects`/`walls` coinciden literalmente con los
 * nombres de las tile layers de Tiled en `engine/src/floorplan/maps/*.json`
 * (`tile-layers.ts` las usa para anclar cada `TilemapLayer` a su depth).
 * `"secciones"` (capa de objetos de Tiled) NO aparece aquí — es geometría
 * lógica que solo lee el parser de `/engine`, nunca se renderiza como objeto
 * de Phaser, así que no tiene profundidad visual que fijar.
 *
 * ORDEN CLAVE (post-playtest #7): la tripulación y los componentes que coloca
 * en el plano van POR ENCIMA del suelo pero POR DEBAJO de las paredes. Por eso
 * `walls` (5) es mayor que `objects`/`crewEntity` (2/4). Para que esto funcione,
 * la capa de paredes debe renderizarse como objeto top-level a `walls`, no
 * dentro del container base del plano (un container aplana la profundidad de
 * sus hijos — ver `floorplan-renderer.ts`).
 */
export const RENDER_DEPTH = {
  /** Tile layer "background" (o el fallback `Graphics` de Fase 5, mientras la nave no tenga arte). */
  background: 0,
  /** Manchas persistentes (sangre, quemaduras): encima del suelo, debajo de objetos/paredes/tripulantes. */
  bloodDecal: 1,
  /** Tinte parpadeante de sección sin energía (Fase 11b, cicatriz) — encima del suelo, debajo de objetos/paredes/tripulantes, igual que `bloodDecal`: es una marca de superficie, no un objeto. */
  sectionScar: 1.5,
  /** RenderTexture de sombras dinámicas con oclusión (Fase 12d) — sobre el suelo/decals, DEBAJO de objetos/componentes/tripulación/paredes: oscurece el suelo, no los sprites que la proyectan (criterio de sombra top-down). */
  dynamicShadows: 1.7,
  /** Tile layer "objects" (containerizada en el base) y overlay de componentes colocados (top-level): encima del suelo, debajo de paredes. */
  objects: 2,
  /**
   * Charco de sustancia derramada/vertida (13e ronda 4). No comparte depth con
   * `bloodDecal` (1): ahí quedaba DEBAJO de las sombras dinámicas (1.7) y del
   * overlay de componentes (2), o sea tapado por la propia pieza en cuya celda
   * se derrama — por eso no se veía. Va sobre los objetos pero por debajo de la
   * tripulación, que tiene que poder pisarlo.
   */
  substanceSpill: 2.5,
  /** Resaltado de la celda bajo el cursor (post-playtest #4) — objeto de MUNDO, encima del suelo/objetos, debajo de tripulación y paredes. */
  hoverHighlight: 3,
  /** Sprites/tokens de tripulantes (Fase 10d: círculo placeholder, sin sprite todavía — GDD §17) — encima de los objetos colocados, debajo de las paredes. */
  crewEntity: 4,
  /** Tokens de enemigo (Fase 11d.3: rectángulo placeholder por archetipo, sin sprite todavía — ver `enemy-tokens.ts`) — junto a `crewEntity`, ligeramente por encima para que un enemigo nunca quede tapado por un tripulante en la misma celda. */
  enemyEntity: 4.2,
  /** Tile layer "walls" (o `Graphics` de paredes fallback) — POR ENCIMA de tripulación y objetos colocados (post-playtest #7). Debe ser objeto top-level, no hijo del container base. */
  walls: 5,
  /** Token del proyectil ferromagnético en vuelo (Fase 11a.3) — por encima de las paredes: un proyectil dentro de un conducto/pared debe seguir viéndose, igual que `problemMarker`. */
  projectileEntity: 5.5,
  /** Trayectoria fantasma en pausa táctica (Fase 11a.3, ASA 3) — justo debajo del token real, por encima de las paredes, siempre visible. */
  trajectoryGhost: 5.6,
  /** Marcador pulsante del problema de la crisis activa (Fase 10d) — objeto de MUNDO (panea con el mapa), por encima de las paredes para que siempre se vea. */
  problemMarker: 6,
  /** Bursts de partículas de acciones de tripulación (instalar/desmontar, playtest #11) — objeto de MUNDO, por encima de todo el plano para que el fenómeno siempre se lea (principio 6 CLAUDE.md). */
  effect: 7,
  /**
   * Chrome de HUD de misión (Fase 10d): barra de header, panel lateral fijo
   * (cola de tripulación + acciones) — SIEMPRE por encima del plano/overlay/
   * tripulación (0-6), nunca mezclado con esos valores. `hudBackground` son
   * los rectángulos/paneles semitransparentes que dan legibilidad de fondo;
   * `hudContent` es el texto/botones que van ENCIMA de ese fondo — los
   * widgets de `ui/widgets/` (`createKenneyButton` y afines) no fijan depth
   * propio, así que cualquier código que los use sobre un fondo con depth
   * explícito debe subirlos a `hudContent` a mano o quedan tapados.
   * `hudModal` es para diálogos bloqueantes (briefing de crisis) — por
   * encima de TODO el resto de HUD, incluido el panel lateral.
   */
  hudBackground: 20,
  hudContent: 21,
  /**
   * Paneles FLOTANTES que se posicionan sobre el mapa (el panel de acciones de
   * misión). Necesitan depth propio por encima de `hudContent` (ronda 3 de
   * fixes de 13e): compartían el 21 con la tira de tripulación, y como
   * `redrawCrewStrip` destruye y re-crea la tira, cada reconstrucción la
   * reinsertaba al final de la display list y quedaba TAPANDO el panel —
   * escondiendo sus últimos botones y haciendo difícil clickearlos.
   */
  hudFloatingPanel: 25,
  /** Pila de notificaciones transitorias (12c.7) — por encima del HUD normal, por debajo de los diálogos bloqueantes. */
  notification: 29,
  hudModal: 30,
  /** Overlay de alerta de pantalla completa (Fase 12a) — por encima incluso de `hudModal`, para que el parpadeo de crisis crítica nunca quede tapado por un diálogo bloqueante. */
  screenAlert: 31,
} as const;

export type RenderDepthName = keyof typeof RENDER_DEPTH;
