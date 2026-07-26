import type { Locale } from "../i18n/i18n.js";

/**
 * Preferencias de Opciones (Fase 9.5, punto 7) — persisten entre sesiones vía
 * `kludgeSettings` (decisión confirmada con el operador), en un archivo
 * `settings.json` separado de `saves/`. Vive en `/game`, no en `/engine`:
 * son preferencias de presentación (Phaser/Scale), agnósticas de dominio.
 */
export interface GameSettings {
  readonly locale: Locale;
  readonly fullscreen: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  locale: "es",
  fullscreen: false,
};

export function serializeSettings(settings: GameSettings): string {
  return JSON.stringify(settings, null, 2);
}

export function deserializeSettings(json: string): GameSettings {
  const parsed = JSON.parse(json) as Partial<GameSettings>;
  return {
    locale: parsed.locale === "en" ? "en" : "es",
    fullscreen: parsed.fullscreen === true,
  };
}
