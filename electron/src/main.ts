import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BLUEPRINT_FILE_EXTENSION, IPC_CHANNELS } from "./ipc-channels.js";
import type { SaveNamespace } from "./ipc-channels.js";
import { SaveFileStore } from "./save-file-store.js";

export const ELECTRON_SHELL_VERSION = "0.1.0";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * En dev, `npm run dev -w electron` apunta al dev server de Vite de `/game`
 * (variable de entorno, ver `electron/package.json`); en producción carga el
 * build empaquetado (`game/dist/index.html`, que requiere `base: './'` en
 * `game/vite.config.ts` para resolver rutas bajo `file://`).
 */
const DEV_SERVER_URL = process.env.KLUDGE_DEV_SERVER_URL;

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    // `useContentSize`: 1280×720 es el ÁREA DE CONTENIDO (el canvas del juego),
    // no el tamaño exterior con barra de título/marco — sin esto, el alto útil
    // quedaba por debajo de 720 y la tira de tripulación (barras de vida al pie)
    // se cortaba hasta agrandar la ventana a mano.
    useContentSize: true,
    width: 1280,
    height: 720,
    backgroundColor: "#0a0a0f",
    webPreferences: {
      // `.cjs` bundle (no el `preload.js` ESM que emite tsc): el preload
      // sandboxed de Electron solo admite CommonJS — con ESM fallaba al cargar
      // ("Cannot use import statement outside a module") y `window.kludgeSave`
      // nunca se inyectaba, dejando toda la persistencia en el fallback en memoria.
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (DEV_SERVER_URL) {
    void window.loadURL(DEV_SERVER_URL);
    // En dev, abrir DevTools para ver errores de runtime (una excepción no
    // capturada en una escena de Phaser deja el canvas en negro sin más pista).
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    void window.loadFile(join(__dirname, "../../game/dist/index.html"));
  }

  return window;
}

function registerIpcHandlers(store: SaveFileStore): void {
  ipcMain.handle(IPC_CHANNELS.saveList, (_event, namespace: SaveNamespace) => store.list(namespace));
  ipcMain.handle(IPC_CHANNELS.saveLoad, (_event, namespace: SaveNamespace, id: string) =>
    store.load(namespace, id),
  );
  ipcMain.handle(
    IPC_CHANNELS.saveWrite,
    (_event, namespace: SaveNamespace, id: string, contents: string) =>
      store.write(namespace, id, contents),
  );
  ipcMain.handle(IPC_CHANNELS.saveDelete, (_event, namespace: SaveNamespace, id: string) =>
    store.delete(namespace, id),
  );
  ipcMain.handle(IPC_CHANNELS.settingsLoad, () => store.loadSettings());
  ipcMain.handle(IPC_CHANNELS.settingsSave, (_event, contents: string) => store.saveSettings(contents));
}

/**
 * Export/import de una creación como archivo `.kludge` vía diálogo nativo (hito
 * de demo). Electron trata el contenido como texto opaco (el JSON lo serializa/
 * valida `/engine` del lado del renderer, mismo criterio que `SaveFileStore`).
 * `export` devuelve `false` si el usuario cancela; `import` devuelve `null`.
 */
function registerBlueprintHandlers(): void {
  const filters = [{ name: "Kludge blueprint", extensions: [BLUEPRINT_FILE_EXTENSION] }];

  ipcMain.handle(IPC_CHANNELS.blueprintExport, async (_event, contents: string): Promise<boolean> => {
    const parent = BrowserWindow.getFocusedWindow();
    const options = {
      title: "Exportar creación",
      defaultPath: `creacion.${BLUEPRINT_FILE_EXTENSION}`,
      filters,
    };
    const result = parent
      ? await dialog.showSaveDialog(parent, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) {
      return false;
    }
    await writeFile(result.filePath, contents, "utf-8");
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.blueprintImport, async (): Promise<string | null> => {
    const parent = BrowserWindow.getFocusedWindow();
    const options = {
      title: "Importar creación",
      filters,
      properties: ["openFile" as const],
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return readFile(result.filePaths[0]!, "utf-8");
  });
}

async function bootstrap(): Promise<void> {
  await app.whenReady();

  const store = new SaveFileStore(app.getPath("userData"));
  await store.ensureDirs();
  registerIpcHandlers(store);
  registerBlueprintHandlers();

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

void bootstrap();
