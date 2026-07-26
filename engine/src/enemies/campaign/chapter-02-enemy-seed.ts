import type { ComponentId } from "../../components/physical-component.types.js";
import type { CrisisDefinitionId } from "../../crisis/crisis-definition.types.js";
import { CHAPTER_02_BY_ARCHETYPE } from "../../crisis/campaign/chapter-02-ecos-en-el-pasillo.js";
import type { SectionId } from "../../atmosphere/section.types.js";
import type { EnemyActor, EnemyActorId } from "../enemy-actor.types.js";
import type { ScriptedRoute } from "../enemy-route.types.js";

/**
 * Contenido de enemigo del capítulo 2 "Ecos en el Pasillo" (Fase 11d.4) — un
 * intruso que avanza por el `pasillo-central` (mismo corredor donde viven los
 * dos sensores de movimiento del puzzle) hacia el puente, donde arranca la
 * tripulación. Solo el arquetipo `exploracion` (mismo criterio ya establecido
 * en `chapter-02-ecos-en-el-pasillo.ts`: "Solo Exploración se verifica jugable
 * de punta a punta"; el resto de arquetipos queda sin enemigo por ahora,
 * decisión explícita del operador para esta sub-fase).
 *
 * Arma: `garra-de-abordaje` (cuerpo a cuerpo, severidad "medium" —
 * `weaponDamageSeverity`), NO `torreta-automatizada` (severidad "high",
 * letal por sí sola vía `HP_LOSS_FRACTION.high === 1`). Decisión explícita
 * del operador: el capítulo 2 está diseñado como no letal (su propio hazard/
 * consecuencia declaran `lethal: false`, "el permadeath se reserva para
 * capítulos posteriores") y `resolveEnemyAttack` no tiene (todavía) un flag
 * de no-letalidad equivalente — así que la mitigación en ESTA sub-fase es de
 * contenido (elegir un arma sin severidad "high"), no de motor.
 */
export const CHAPTER_02_INTRUSO_ID = "capitulo-2-intruso" as EnemyActorId;

const PASILLO_CENTRAL = "pasillo-central" as SectionId;

/**
 * Ruta: entra por el extremo de propulsión del pasillo y avanza hacia el
 * puente en tres tramos, deteniéndose junto al panel combinador/sensor B del
 * puzzle (`CHAPTER_02_GATE_PANEL_INSTANCE_ID` está en x=14, `CHAPTER_02_SENSOR_B_INSTANCE_ID`
 * en x=16) — cerca de donde el jugador va a estar trabajando en el cableado.
 * `onComplete: "hold"`: se queda ahí, sigue pudiendo atacar mientras la
 * crisis siga activa.
 *
 * `arrivalSeconds` calibrado a ~0.33s/celda (fix post-11d.4, playtest del
 * operador: el ritmo original de 1.33s/celda se sentía "muy lento" comparado
 * con la cadencia normal de salto de la tripulación, ~170ms/salto). Ajustable
 * si un playtest futuro lo sigue viendo lento o rápido.
 */
const CHAPTER_02_INTRUSO_ROUTE: ScriptedRoute = {
  enemyId: CHAPTER_02_INTRUSO_ID,
  waypoints: [
    { cell: { x: 30, y: 9 }, sectionId: PASILLO_CENTRAL, arrivalSeconds: 0 },
    { cell: { x: 24, y: 9 }, sectionId: PASILLO_CENTRAL, arrivalSeconds: 2 },
    { cell: { x: 18, y: 9 }, sectionId: PASILLO_CENTRAL, arrivalSeconds: 4 },
    { cell: { x: 13, y: 9 }, sectionId: PASILLO_CENTRAL, arrivalSeconds: 6 },
  ],
  onComplete: "hold",
};

const CHAPTER_02_INTRUSO: EnemyActor = {
  id: CHAPTER_02_INTRUSO_ID,
  archetype: "agile",
  hp: 40,
  maxHp: 40,
  sectionId: PASILLO_CENTRAL,
  cell: { x: 30, y: 9 },
  weaponComponentId: "garra-de-abordaje" as ComponentId,
  status: "advancing",
};

export interface EnemySeed {
  readonly enemies: ReadonlyArray<EnemyActor>;
  readonly routes: ReadonlyMap<EnemyActorId, ScriptedRoute>;
}

/**
 * Contenido de enemigo por capítulo, análogo a `CHAPTER_SEED_BY_ID`
 * (`save/chapter-progression.ts`) para componentes/nodos: el consumidor
 * (`MissionRuntime`, `/game`) resuelve por `CrisisDefinitionId` sin conocer
 * qué capítulos tienen enemigos y cuáles no — un capítulo ausente de este
 * mapa simplemente arranca con `enemies`/`routes` vacíos (mismo criterio ya
 * usado en 11d.2 antes de que existiera contenido real).
 */
export const ENEMY_SEED_BY_CHAPTER_ID: ReadonlyMap<CrisisDefinitionId, EnemySeed> = new Map([
  [
    CHAPTER_02_BY_ARCHETYPE.exploracion.id,
    { enemies: [CHAPTER_02_INTRUSO], routes: new Map([[CHAPTER_02_INTRUSO_ID, CHAPTER_02_INTRUSO_ROUTE]]) },
  ],
]);
