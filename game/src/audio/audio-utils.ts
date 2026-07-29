/** Análogo sonoro de `pickTexture` (`particles/particle-utils.ts`): variante al azar de una familia. */
export function pickSoundKey(key: string | readonly string[]): string {
  if (typeof key === "string") return key;
  return key[Math.floor(Math.random() * key.length)] ?? key[0]!;
}
