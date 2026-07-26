import { MetaGameStateMachine } from "./meta-game-state.js";
import { campaignSession } from "./campaign-session.js";

/**
 * Instancia única del flujo de meta-juego, compartida por todas las escenas
 * (mismo criterio que `campaignSession`). `SceneFlowManager` se instancia en
 * `main.ts`, una vez que existe el `Phaser.Game`.
 */
export const metaGameStateMachine = new MetaGameStateMachine();

export { campaignSession };
