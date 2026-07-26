/**
 * Tipado del API expuesta por `electron/src/preload.ts` vía `contextBridge`.
 * Solo existe en `window` cuando `/game` corre dentro de Electron — en
 * `vite dev` suelto (sin `electron .`) es `undefined` (ver `save-adapter.ts`).
 */
export type SaveNamespace = "campaigns" | "creations";

export interface KludgeSaveApi {
  list(namespace: SaveNamespace): Promise<string[]>;
  load(namespace: SaveNamespace, id: string): Promise<string>;
  save(namespace: SaveNamespace, id: string, contents: string): Promise<void>;
  delete(namespace: SaveNamespace, id: string): Promise<void>;
}

export interface KludgeSettingsApi {
  load(): Promise<string | null>;
  save(contents: string): Promise<void>;
}

/**
 * Export/import de una creación como archivo `.kludge` vía diálogo nativo.
 * `export` devuelve `false` si el usuario cancela; `import` devuelve `null`.
 */
export interface KludgeBlueprintApi {
  export(contents: string): Promise<boolean>;
  import(): Promise<string | null>;
}

declare global {
  interface Window {
    kludgeSave?: KludgeSaveApi;
    kludgeSettings?: KludgeSettingsApi;
    kludgeBlueprint?: KludgeBlueprintApi;
  }
}
