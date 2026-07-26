import dirt01Url from "../../assets/sprites/particles/dirt_01.png";
import dirt02Url from "../../assets/sprites/particles/dirt_02.png";
import dirt03Url from "../../assets/sprites/particles/dirt_03.png";
import scorch01Url from "../../assets/sprites/particles/scorch_01.png";
import spark01Url from "../../assets/sprites/particles/spark_01.png";
import spark02Url from "../../assets/sprites/particles/spark_02.png";
import spark03Url from "../../assets/sprites/particles/spark_03.png";
import flame01Url from "../../assets/sprites/particles/flame_01.png";
import flame02Url from "../../assets/sprites/particles/flame_02.png";
import flame03Url from "../../assets/sprites/particles/flame_03.png";
import fire01Url from "../../assets/sprites/particles/fire_01.png";
import fire02Url from "../../assets/sprites/particles/fire_02.png";
import smoke01Url from "../../assets/sprites/particles/smoke_01.png";
import smoke02Url from "../../assets/sprites/particles/smoke_02.png";
import smoke03Url from "../../assets/sprites/particles/smoke_03.png";
import circle01Url from "../../assets/sprites/particles/circle_01.png";
import circle02Url from "../../assets/sprites/particles/circle_02.png";
import trace02Url from "../../assets/sprites/particles/trace_02.png";
import flare01Url from "../../assets/sprites/particles/flare_01.png";

/**
 * Registro de texturas reales de partículas (pack añadido por el operador en
 * `game/assets/sprites/particles/`, imágenes de un solo color con alpha,
 * pensadas para tintar en runtime — mismo principio que `__WHITE`, con formas
 * reales en vez de un cuadrado). Mismo patrón que `tile-layer-registry.ts`:
 * import de PNG vía Vite (URL) + tabla key→URL para precargar una sola vez
 * en `FloorplanScene.preload()`.
 *
 * Se importan 2-3 variantes por familia (no las ~10 de cada carpeta): variedad
 * visual suficiente sin inflar el preload. Los emisores pueden recibir un
 * array de keys (`ParticleEmitterConfig.texture`) para que cada partícula
 * nueva elija una al azar — variedad orgánica sin trabajo extra.
 *
 * Sin encaje claro en los efectos ya implementados hoy (reservadas para
 * Fase 10+, armas/UI): scratch, muzzle, star, twirl, magic, symbol, window.
 */
export const PARTICLE_TEXTURE_URLS: Readonly<Record<string, string>> = {
  "dirt-01": dirt01Url,
  "dirt-02": dirt02Url,
  "dirt-03": dirt03Url,
  "scorch-01": scorch01Url,
  "spark-01": spark01Url,
  "spark-02": spark02Url,
  "spark-03": spark03Url,
  "flame-01": flame01Url,
  "flame-02": flame02Url,
  "flame-03": flame03Url,
  "fire-01": fire01Url,
  "fire-02": fire02Url,
  "smoke-01": smoke01Url,
  "smoke-02": smoke02Url,
  "smoke-03": smoke03Url,
  "circle-01": circle01Url,
  "circle-02": circle02Url,
  "trace-02": trace02Url,
  "flare-01": flare01Url,
};

/** Manchas de salpicadura irregulares — mismas texturas, dos alias semánticos según el llamador. */
export const DIRT_TEXTURES = ["dirt-01", "dirt-02"] as const;
/** Sangre en el aire (bursts) y gotas del decal — `dirt-03` (punto 3 del plan) queda para el charco. */
export const BLOOD_TEXTURES = DIRT_TEXTURES;
export const BLOOD_POOL_TEXTURE = "dirt-03";
export const SCORCH_TEXTURE = "scorch-01";
export const SPARK_TEXTURES = ["spark-01", "spark-02", "spark-03"] as const;
export const FLAME_TEXTURES = ["flame-01", "flame-02", "flame-03"] as const;
export const FIRE_TEXTURES = ["fire-01", "fire-02"] as const;
export const SMOKE_TEXTURES = ["smoke-01", "smoke-02", "smoke-03"] as const;
export const CIRCLE_TEXTURES = ["circle-01", "circle-02"] as const;
export const TRACE_TEXTURE = "trace-02";
export const FLARE_TEXTURE = "flare-01";

/** Tamaño real de la fuente (512×512, ver investigación del plan) — referencia para calcular `scale`. */
export const PARTICLE_TEXTURE_SIZE_PX = 512;
