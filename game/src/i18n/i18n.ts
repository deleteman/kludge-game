import { EN } from "./en.js";
import { ES } from "./es.js";

/**
 * Sistema de claves de traducción (CLAUDE.md: localización ES/EN desde el
 * MVP, nunca strings de UI hardcodeados). Seed mínimo de Fase 5 — crecerá
 * con cada fase que añada UI. Fallback: ES → EN → la propia clave (visible
 * en pantalla, para que una clave sin traducir se detecte a simple vista).
 */
export type Locale = "es" | "en";

const TABLES: Readonly<Record<Locale, Readonly<Record<string, string>>>> = { es: ES, en: EN };

let currentLocale: Locale = "es";

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string): string {
  return TABLES[currentLocale][key] ?? TABLES.en[key] ?? key;
}
