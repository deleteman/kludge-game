import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "./ipc-channels.js";
import type { SaveNamespace } from "./ipc-channels.js";

/**
 * `contextIsolation: true` + `nodeIntegration: false` en `main.ts` — sin
 * `contextBridge` el renderer no tendría forma segura de hablar con `fs`.
 * API mínima: todo string crudo (JSON serializado por `/engine` del lado
 * `/game`), Electron nunca parsea el contenido.
 */
contextBridge.exposeInMainWorld("kludgeSave", {
  list: (namespace: SaveNamespace): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.saveList, namespace),
  load: (namespace: SaveNamespace, id: string): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.saveLoad, namespace, id),
  save: (namespace: SaveNamespace, id: string, contents: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.saveWrite, namespace, id, contents),
  delete: (namespace: SaveNamespace, id: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.saveDelete, namespace, id),
});

contextBridge.exposeInMainWorld("kludgeSettings", {
  load: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.settingsLoad),
  save: (contents: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.settingsSave, contents),
});

contextBridge.exposeInMainWorld("kludgeBlueprint", {
  // `export` → false si el usuario cancela el diálogo; `import` → null si cancela.
  export: (contents: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.blueprintExport, contents),
  import: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.blueprintImport),
});
