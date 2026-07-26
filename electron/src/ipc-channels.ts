/**
 * Nombres de canal IPC compartidos entre `main.ts` y `preload.ts` — un solo
 * lugar de verdad para no duplicar strings literales entre ambos procesos
 * (CLAUDE.md: nada de datos/identificadores repetidos "a mano" en dos sitios).
 */
export const IPC_CHANNELS = {
  saveList: "kludge:save:list",
  saveLoad: "kludge:save:load",
  saveWrite: "kludge:save:write",
  saveDelete: "kludge:save:delete",
  settingsLoad: "kludge:settings:load",
  settingsSave: "kludge:settings:save",
  // Export/import de una creación del modo creativo como archivo `.kludge` vía
  // diálogo nativo (hito de demo) — distinto del guardado interno por namespace.
  blueprintExport: "kludge:blueprint:export",
  blueprintImport: "kludge:blueprint:import",
} as const;

/** Extensión + filtro del diálogo nativo para compartir creaciones del modo creativo. */
export const BLUEPRINT_FILE_EXTENSION = "kludge";

/** Los dos namespaces de guardado separados (riesgo 1 del plan de Fase 9.5): partidas de campaña vs. creaciones custom de la mesa. */
export const SAVE_NAMESPACES = ["campaigns", "creations"] as const;
export type SaveNamespace = (typeof SAVE_NAMESPACES)[number];
