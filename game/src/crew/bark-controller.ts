import type Phaser from "phaser";
import { barkKey, pickBarkIndex } from "engine";
import type { BarkEventType, CrewActor, CrewActorId } from "engine";
import { t } from "../i18n/i18n.js";
import { RENDER_DEPTH } from "../render/render-depths.js";
import { showBarkBubble } from "./bark-bubble.js";
import { playBarkSound } from "../audio/bark-sound.js";

/** Silencio mínimo entre barks del MISMO tripulante, para que no se solapen. */
const PER_ACTOR_COOLDOWN_MS = 600;

/**
 * Orquesta los barks de personalidad (GDD 6.7.1) en la escena de misión: el
 * motor decide QUÉ evento ocurre; acá se elige la línea (i18n) y se muestra la
 * burbuja. Mantiene un contador de apariciones por `${trait}:${eventType}` para
 * rotar entre las líneas del banco (`pickBarkIndex`).
 *
 * Reutiliza `barkKey`/`pickBarkIndex` del motor (ya testeados) — no reimplementa
 * la construcción de claves ni la rotación.
 */
export class BarkController {
  private readonly occurrences = new Map<string, number>();
  private readonly lastFireAtByActor = new Map<CrewActorId, number>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly markAsWorldObject: (obj: Phaser.GameObjects.GameObject) => void,
  ) {}

  /**
   * Dispara una frase de `eventType` para `actor`, en coords de mundo (x, y).
   * Ignora el bark si el mismo tripulante habló hace muy poco (cooldown), para
   * que start/complete de acciones muy cortas no se solapen.
   */
  fire(actor: CrewActor, eventType: BarkEventType, x: number, y: number): void {
    const now = this.scene.time.now;
    const lastAt = this.lastFireAtByActor.get(actor.id);
    if (lastAt !== undefined && now - lastAt < PER_ACTOR_COOLDOWN_MS) return;
    this.lastFireAtByActor.set(actor.id, now);

    const counterKey = `${actor.trait}:${eventType}`;
    const count = this.occurrences.get(counterKey) ?? 0;
    const text = t(barkKey(actor.trait, eventType, pickBarkIndex(count)));
    this.occurrences.set(counterKey, count + 1);

    const bubble = showBarkBubble(this.scene, x, y, text);
    bubble.setDepth(RENDER_DEPTH.problemMarker);
    this.markAsWorldObject(bubble);
    playBarkSound(this.scene, eventType);
  }
}
