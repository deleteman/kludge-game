import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SaveNamespace } from "./ipc-channels.js";
import { SAVE_NAMESPACES } from "./ipc-channels.js";

/**
 * Única responsabilidad: leer/escribir/listar/borrar archivos `.json` bajo
 * `<userData>/saves/<namespace>/` y `<userData>/settings.json`. Trata todo
 * contenido como texto opaco — no conoce `CampaignSaveState`/`CustomCreation`,
 * mantiene a Electron desacoplado de `/engine` (la validación de estructura
 * corre en el renderer, que sí importa `/engine`).
 */
export class SaveFileStore {
  private readonly savesRoot: string;
  private readonly settingsPath: string;

  constructor(userDataDir: string) {
    this.savesRoot = join(userDataDir, "saves");
    this.settingsPath = join(userDataDir, "settings.json");
  }

  async ensureDirs(): Promise<void> {
    for (const namespace of SAVE_NAMESPACES) {
      await mkdir(this.dirFor(namespace), { recursive: true });
    }
  }

  private dirFor(namespace: SaveNamespace): string {
    return join(this.savesRoot, namespace);
  }

  private pathFor(namespace: SaveNamespace, id: string): string {
    return join(this.dirFor(namespace), `${safeFileId(id)}.json`);
  }

  async list(namespace: SaveNamespace): Promise<string[]> {
    await mkdir(this.dirFor(namespace), { recursive: true });
    const entries = await readdir(this.dirFor(namespace));
    return entries.filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5));
  }

  async load(namespace: SaveNamespace, id: string): Promise<string> {
    return readFile(this.pathFor(namespace, id), "utf-8");
  }

  async write(namespace: SaveNamespace, id: string, contents: string): Promise<void> {
    await mkdir(this.dirFor(namespace), { recursive: true });
    await writeFile(this.pathFor(namespace, id), contents, "utf-8");
  }

  async delete(namespace: SaveNamespace, id: string): Promise<void> {
    await rm(this.pathFor(namespace, id), { force: true });
  }

  async loadSettings(): Promise<string | null> {
    try {
      return await readFile(this.settingsPath, "utf-8");
    } catch {
      return null;
    }
  }

  async saveSettings(contents: string): Promise<void> {
    await writeFile(this.settingsPath, contents, "utf-8");
  }
}

/** Evita path traversal: solo caracteres seguros de id sobreviven al nombre de archivo. */
function safeFileId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}
