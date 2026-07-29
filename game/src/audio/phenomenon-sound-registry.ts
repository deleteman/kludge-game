import type { DomainEvent } from "engine";
import type Phaser from "phaser";

import type { EventDrivenSound } from "./audio-effect.types.js";
import { combustionSound } from "./effects/combustion-sound.js";
import { corrosionSound } from "./effects/corrosion-sound.js";
import { overloadSound } from "./effects/overload-sound.js";

/**
 * Sonido gemelo de `particles/effect-registry.ts` (mismo patrón Factory,
 * CLAUDE.md): único punto de registro evento→sonido, vive en paralelo a
 * `EFFECTS_BY_KIND` sin tocarlo. Subfase 12b solo cubre los tres fenómenos
 * pedidos por `nuevo-orden.md` (sobrecarga, combustión, corrosión) — el resto
 * de `DomainEvent["kind"]` queda sin sonido puntual a propósito (fuera de
 * alcance de esta subfase), `fireEventSound` es un no-op silencioso para ellos.
 */
const SOUNDS_BY_KIND: {
  readonly [K in DomainEvent["kind"]]?: EventDrivenSound<K>;
} = {
  overload: overloadSound,
  combustion: combustionSound,
  "corrosive-exposure": corrosionSound,
};

export function fireEventSound(scene: Phaser.Scene, event: DomainEvent): void {
  const sound = SOUNDS_BY_KIND[event.kind] as EventDrivenSound | undefined;
  sound?.play(scene, event);
}
