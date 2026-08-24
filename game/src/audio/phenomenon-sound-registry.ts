import type { DomainEvent } from "engine";
import type Phaser from "phaser";

import type { EventDrivenSound } from "./audio-effect.types.js";
import { combustionSound } from "./effects/combustion-sound.js";
import { corrosionSound } from "./effects/corrosion-sound.js";
import { overloadSound } from "./effects/overload-sound.js";
import { dismantleSparkSound } from "./effects/dismantle-spark-sound.js";
import { sectionBreachedSound } from "./effects/section-breach-sound.js";

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
  // Subfase 13d: el chispazo de arrancar una pieza viva reutiliza el sonido de
  // sobrecarga (misma familia eléctrica) — no hay asset dedicado en el pack
  // (deuda #17), y el derrame/fuga quedan sin sonido puntual a propósito.
  "dismantle-spark": dismantleSparkSound,
  // Subfase 13f: el casco abriéndose al vacío. Sin asset propio (deuda #17),
  // reutiliza el banco de explosión grave.
  "section-breached": sectionBreachedSound,
};

export function fireEventSound(scene: Phaser.Scene, event: DomainEvent): void {
  const sound = SOUNDS_BY_KIND[event.kind] as EventDrivenSound | undefined;
  sound?.play(scene, event);
}
