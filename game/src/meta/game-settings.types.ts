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
  /**
   * Intensidad estética del filtro CRT (0..1): scanlines, aberración cromática
   * base, curvatura y glow. 0 = CRT apagado (dirección de arte off). Tope del
   * shader `crt-pipeline.ts`.
   */
  readonly crtIntensity: number;
  /**
   * Intensidad del parpadeo/aberración de la capa "System Failure" (0..1).
   * Independiente de `crtIntensity` a propósito: un jugador fotosensible puede
   * ponerlo a 0 (sin parpadeo ni estática localizada) sin perder la estética
   * CRT base.
   */
  readonly flickerIntensity: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  locale: "es",
  fullscreen: false,
  crtIntensity: 0.7,
  flickerIntensity: 1,
};

/** Recorta un valor a [0,1]; NaN/ausente cae al default dado. */
function clamp01(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

export function serializeSettings(settings: GameSettings): string {
  return JSON.stringify(settings, null, 2);
}

export function deserializeSettings(json: string): GameSettings {
  const parsed = JSON.parse(json) as Partial<GameSettings>;
  return {
    locale: parsed.locale === "en" ? "en" : "es",
    fullscreen: parsed.fullscreen === true,
    crtIntensity: clamp01(parsed.crtIntensity, DEFAULT_SETTINGS.crtIntensity),
    flickerIntensity: clamp01(parsed.flickerIntensity, DEFAULT_SETTINGS.flickerIntensity),
  };
}
