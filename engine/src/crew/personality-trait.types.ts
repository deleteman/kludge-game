/**
 * Rasgo único de personalidad por tripulante (GDD 6.7): determina el banco de
 * frases (`bark-bank.ts`, contenido en i18n de `/game`) y matices menores de
 * comportamiento. Los 5 rasgos base del GDD — no hay más hasta que un logro
 * (GDD 6.8, Fase 11) traiga un tripulante nombrado con rasgo fijo.
 */
export type PersonalityTrait =
  | "estoico"
  | "ansioso"
  | "sarcastico"
  | "temerario"
  | "disciplinado";
