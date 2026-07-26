// GDD 9 (extensión), caso 17 — "El Cañón de Riel Improvisado": docs/Extension_aceleracion_magnetica.md §5 — decaimiento por distancia + inercia acumulada de la aceleración magnética, y daño por impacto cinético (velocidad × masa virtual).
//
// Reescrito en Fase 11a: hasta entonces este caso simulaba el avance del
// proyectil A MANO (un contador `coilsSoFar` y distancias escalares literales),
// porque `kinetics/` no tenía noción de posición. Ahora pilota la simulación
// real (`ProjectileSimulation`), que es lo que corre en misión — el caso valida
// el sistema, no una maqueta del sistema.
import { describe, expect, it } from "vitest";
import {
  applyKineticDamage,
  ATOMIC_COMPONENT_CATALOG,
  EventEmitter,
  previewTrajectory,
  ProjectileSimulation,
  SignalEvaluator,
  type ActiveCoil,
  type CellOccupant,
  type CrewActor,
  type CrewActorId,
  type GridPosition,
  type KineticDomainEvent,
  type KineticImpactEvent,
  type ProjectileBody,
  type ProjectileWorld,
  type SignalEdge,
  type SignalEdgeId,
  type SignalEmitterInputs,
  type SignalGraph,
  type SignalNode,
  type SignalNodeId,
  type SignalNodeRole,
  type SignalGraphState,
} from "../index.js";

const id = (value: string): SignalNodeId => value as SignalNodeId;

function node(raw: string, role: SignalNodeRole, behavior?: SignalNode["behavior"]): SignalNode {
  return { id: id(raw), role, position: { x: 0, y: 0 }, ownerRef: raw, behavior };
}
function edge(from: string, to: string): SignalEdge {
  return { id: `${from}->${to}` as SignalEdgeId, from: id(from), to: id(to) };
}

/**
 * El jugador no tiene un "componente pulsador": construye el pulso temporizado
 * de cada bobina combinando lo que el GDD 5.6 ya ofrece —
 * `bobina = delay(encender) AND NOT delay(apagar)`. Esto es el caso 17 tal como
 * lo describe el documento §5 ("cada una con su propio receptor de señal
 * temporizado"), y es lo que obliga a que el campo caiga a "N" entre bobinas:
 * una bobina que se queda energizada sigue tirando del proyectil y no produce
 * un flanco de subida nuevo.
 */
function timedPulse(coil: string, onAt: number, offAt: number): SignalGraph {
  return {
    nodes: [
      node(`${coil}-on`, "receptor", { kind: "delay", delaySeconds: onAt }),
      node(`${coil}-off`, "receptor", { kind: "delay", delaySeconds: offAt }),
      node(`${coil}-not-off`, "receptor", { kind: "gate", mode: "NOT" }),
      node(coil, "receptor", { kind: "gate", mode: "AND" }),
    ],
    edges: [
      edge("disparo", `${coil}-on`),
      edge("disparo", `${coil}-off`),
      edge(`${coil}-off`, `${coil}-not-off`),
      edge(`${coil}-on`, coil),
      edge(`${coil}-not-off`, coil),
    ],
  };
}

interface RailCoil {
  readonly ref: string;
  readonly position: GridPosition;
}

/**
 * Adaptador del puerto `ProjectileWorld` para este caso: traduce el estado del
 * grafo de señales a "qué bobinas están energizadas ahora" y expone los
 * obstáculos del riel. En misión este papel lo cumple `MissionRuntime` leyendo
 * el blueprint; aquí basta el riel.
 */
class RailWorld implements ProjectileWorld {
  readonly occupants = new Map<string, CellOccupant>();

  constructor(
    private readonly state: SignalGraphState,
    private readonly coils: ReadonlyArray<RailCoil>,
  ) {}

  activeCoils(): ReadonlyArray<ActiveCoil> {
    return this.coils
      .filter((coil) => this.state.get(id(coil.ref))?.output === true)
      .map((coil) => ({ ref: coil.ref, position: coil.position, current: "A" as const }));
  }

  occupantAt(cell: GridPosition): CellOccupant | null {
    return this.occupants.get(`${cell.x},${cell.y}`) ?? null;
  }

  put(cell: GridPosition, ref: string): void {
    this.occupants.set(`${cell.x},${cell.y}`, { ref });
  }
}

/**
 * Proyectil ferromagnético (`MAG`-Sí, GDD 7.0) construido desde el catálogo
 * real, no inventado por el test: hasta la Fase 11a.1 este cuerpo era una
 * ficción (`pieza-hierro` no existía como pieza) y el caso validaba con datos
 * que ningún jugador podía tener. El documento §5 nombra las dos opciones
 * ("un imán permanente o pieza de hierro") — ambas están ahora en el catálogo,
 * y ASA 1 hace que la elección entre ellas decida el desenlace.
 */
function projectileFromCatalog(componentId: string): ProjectileBody {
  const spec = ATOMIC_COMPONENT_CATALOG.find((entry) => (entry.id as string) === componentId);
  if (!spec) {
    throw new Error(`caso 17: no existe la pieza "${componentId}" en el catálogo atómico`);
  }
  return { ref: componentId, footprint: spec.data.footprint, re: spec.data.material?.RE };
}

/** Pesado: hierro macizo, `RE` alta -> masa virtual media (ASA 1). */
const IRON_SLUG = projectileFromCatalog("pieza-hierro");
/** Ligero: imán chico, `RE` media pero 1×1 -> masa virtual baja (ASA 1). */
const MAGNET_SLUG = projectileFromCatalog("iman-permanente");

const DT = 0.1;

/**
 * Monta el riel completo: emisor de disparo + un pulso temporizado por bobina,
 * la simulación de proyectiles y el mundo que las conecta.
 */
function buildRail(plan: ReadonlyArray<{ coil: RailCoil; onAt: number; offAt: number }>) {
  const pulses = plan.map((entry) => timedPulse(entry.coil.ref, entry.onAt, entry.offAt));
  const graph: SignalGraph = {
    nodes: [node("disparo", "emitter"), ...pulses.flatMap((pulse) => pulse.nodes)],
    edges: pulses.flatMap((pulse) => pulse.edges),
  };
  const evaluator = new SignalEvaluator(graph);
  const state = evaluator.createState();
  const world = new RailWorld(
    state,
    plan.map((entry) => entry.coil),
  );
  const events = new EventEmitter<KineticDomainEvent>();
  const impacts: KineticImpactEvent[] = [];
  events.on("kinetic-impact", (event) => impacts.push(event));
  const sim = new ProjectileSimulation(world, events);

  function run(seconds: number): void {
    const inputs: SignalEmitterInputs = new Map([[id("disparo"), true]]);
    for (let t = 0; t < seconds / DT; t += 1) {
      const elapsed = (t + 1) * DT;
      evaluator.tick(state, inputs, { dtSeconds: DT, elapsedSeconds: elapsed });
      sim.tick({ dtSeconds: DT, elapsedSeconds: elapsed });
    }
  }

  return { sim, world, impacts, run };
}

describe("case 17 — El Cañón de Riel Improvisado", () => {
  it("bien espaciadas y temporizadas, 3 bobinas en secuencia acumulan inercia hasta velocidad alta e impacto grave", () => {
    // El jugador calculó el espaciado: cada bobina se enciende justo cuando el
    // proyectil entra en su rango efectivo (3 celdas) y se apaga antes de que
    // la siguiente dispare — si se quedara encendida, el campo no caería a "N"
    // y no habría flanco de subida (= pulso) nuevo.
    const rail = buildRail([
      { coil: { ref: "bobina-1", position: { x: 3, y: 0 } }, onAt: 0.1, offAt: 1 },
      { coil: { ref: "bobina-2", position: { x: 10, y: 0 } }, onAt: 3.6, offAt: 4.5 },
      { coil: { ref: "bobina-3", position: { x: 17, y: 0 } }, onAt: 5.1, offAt: 6 },
    ]);
    rail.sim.register(IRON_SLUG, { x: 0, y: 0 });
    rail.world.put({ x: 24, y: 0 }, "puerta-bloqueada");

    rail.run(8);

    // 3 pulsos efectivos de campo "M" (peso 2 cada uno) = 6 → umbral de "A".
    expect(rail.impacts).toHaveLength(1);
    expect(rail.impacts[0]).toMatchObject({
      kind: "kinetic-impact",
      targetRef: "puerta-bloqueada",
      velocity: "A",
      severity: "high",
    });
  });

  it("una bobina mal ubicada deja su campo fuera de alcance, se pierde el pulso y el impacto baja de grave a medio", () => {
    // Mismo riel, pero el jugador montó la bobina 2 a 8 celdas del riel: su
    // campo decae a "N" antes de llegar al proyectil (documento §2) y el pulso
    // se pierde entero. Consecuencia encadenada y buscada: al perder ese
    // empujón el proyectil llega más lento y más tarde, así que la
    // temporización de la bobina 3 también hay que rehacerla — un error de
    // colocación no se paga solo con velocidad, se paga con todo el cálculo.
    const rail = buildRail([
      { coil: { ref: "bobina-1", position: { x: 3, y: 0 } }, onAt: 0.1, offAt: 1 },
      { coil: { ref: "bobina-2", position: { x: 10, y: 8 } }, onAt: 3.6, offAt: 4.5 },
      { coil: { ref: "bobina-3", position: { x: 17, y: 0 } }, onAt: 8.1, offAt: 9 },
    ]);
    rail.sim.register(IRON_SLUG, { x: 0, y: 0 });
    rail.world.put({ x: 24, y: 0 }, "puerta-bloqueada");

    rail.run(14);

    // Solo 2 pulsos efectivos (peso 4) → "M", no alcanza el umbral de "A" (6).
    expect(rail.impacts).toHaveLength(1);
    expect(rail.impacts[0]).toMatchObject({ velocity: "M", severity: "medium" });
  });

  it("daño cinético a un tripulante en la trayectoria (documento §3, distinto del daño a estructura de arriba)", () => {
    const tripulante: CrewActor = {
      id: "tripulante-en-riel" as CrewActorId,
      name: "Tripulante de prueba",
      specialty: "seguridad",
      tier: "novato",
      trait: "temerario",
      hp: 100,
      maxHp: 100,
      status: "idle",
    };

    // Mismo riel bien calculado, pero esta vez quien está en la trayectoria es
    // un tripulante y no la puerta bloqueada.
    const rail = buildRail([
      { coil: { ref: "bobina-1", position: { x: 3, y: 0 } }, onAt: 0.1, offAt: 1 },
      { coil: { ref: "bobina-2", position: { x: 10, y: 0 } }, onAt: 3.6, offAt: 4.5 },
      { coil: { ref: "bobina-3", position: { x: 17, y: 0 } }, onAt: 5.1, offAt: 6 },
    ]);
    rail.sim.register(IRON_SLUG, { x: 0, y: 0 });
    rail.world.put({ x: 24, y: 0 }, tripulante.id);

    rail.run(8);

    const impact = rail.impacts[0];
    expect(impact?.severity).toBe("high");

    const { actor: herido, event } = applyKineticDamage(tripulante, impact as KineticImpactEvent);
    expect(herido.hp).toBe(0);
    expect(event).toMatchObject({
      kind: "crew-death",
      cause: "kinetic-impact",
      actorId: tripulante.id,
    });
  });

  it("ASA 1: el mismo riel con un proyectil ligero hiere pero no mata — la masa decide el desenlace", () => {
    // Riel idéntico al del test anterior, misma temporización, misma velocidad
    // alta acumulada: lo ÚNICO que cambia es qué pieza cargó el jugador. Antes
    // de ASA 1 el imán y el hierro eran indistinguibles al impactar (el daño
    // salía solo de velocidad × footprint, y ambos son 1×1), así que esta
    // elección no tenía consecuencias. Ahora el imán es masa baja: a velocidad
    // alta hace daño medio, no grave.
    const tripulante: CrewActor = {
      id: "tripulante-en-riel" as CrewActorId,
      name: "Tripulante de prueba",
      specialty: "seguridad",
      tier: "novato",
      trait: "temerario",
      hp: 100,
      maxHp: 100,
      status: "idle",
    };

    const rail = buildRail([
      { coil: { ref: "bobina-1", position: { x: 3, y: 0 } }, onAt: 0.1, offAt: 1 },
      { coil: { ref: "bobina-2", position: { x: 10, y: 0 } }, onAt: 3.6, offAt: 4.5 },
      { coil: { ref: "bobina-3", position: { x: 17, y: 0 } }, onAt: 5.1, offAt: 6 },
    ]);
    rail.sim.register(MAGNET_SLUG, { x: 0, y: 0 });
    rail.world.put({ x: 24, y: 0 }, tripulante.id);

    rail.run(8);

    const impact = rail.impacts[0];
    expect(impact?.velocity).toBe("A");
    expect(impact?.severity).toBe("medium");

    const { actor: herido, event } = applyKineticDamage(tripulante, impact as KineticImpactEvent);
    expect(herido.hp).toBeGreaterThan(0);
    expect(event?.kind).not.toBe("crew-death");
  });

  it("ASA 2: una bobina bien ubicada pero encendida demasiado tarde deja al proyectil derivando sin pulso — el drag borra el impulso antes de que llegue la siguiente", () => {
    // Bobina 1 igual que el riel bien calculado (mismo lugar, mismo pulso "M").
    // La diferencia es puramente de TEMPORIZACIÓN: bobina 2, aunque está bien
    // ubicada, tarda tanto en encenderse que el proyectil recorre, sin ningún
    // pulso, más celdas que el umbral de drag — a diferencia del 2° test (una
    // bobina fuera de rango), acá ninguna bobina está mal puesta, el riel
    // simplemente es demasiado largo para una sola bobina inicial sin refuerzo
    // a tiempo. El riel se extiende (bobina y puerta más lejos) porque dentro
    // de las 24 celdas del riel original el drag nunca llega a activarse (el
    // hueco más largo del riel bien calculado es de solo ~7 celdas).
    const rail = buildRail([
      { coil: { ref: "bobina-1", position: { x: 3, y: 0 } }, onAt: 0.1, offAt: 1 },
      { coil: { ref: "bobina-2", position: { x: 30, y: 0 } }, onAt: 15, offAt: 15.9 },
    ]);
    rail.sim.register(IRON_SLUG, { x: 0, y: 0 });
    rail.world.put({ x: 44, y: 0 }, "puerta-bloqueada");

    rail.run(25);

    // Sin drag, el pulso de bobina-1 (peso 2, "B") se conservaría intacto hasta
    // que bobina-2 lo reforzara (peso 2+2=4 -> "M"). Con ASA 2, el proyectil
    // recorre más de `dragThresholdCells` celdas sin ninguna bobina activa
    // entre bobina-1 y bobina-2, así que el impulso decae por completo a "N"
    // antes de que bobina-2 llegue a pulsarlo: bobina-2 reconstruye el
    // impulso DESDE CERO (peso 2 -> "B"), no lo refuerza. El impacto final es
    // más débil que el que daría la suma de los dos pulsos sin drag.
    expect(rail.impacts).toHaveLength(1);
    expect(rail.impacts[0]).toMatchObject({
      kind: "kinetic-impact",
      targetRef: "puerta-bloqueada",
      velocity: "B",
      severity: "low",
    });
  });

  it("Fase 11a.3 (ASA 3): la trayectoria predicha a mitad de vuelo coincide con el impacto real final — el fantasma no miente", () => {
    // Mismo riel bien calculado que el 1er test de este archivo. Esta vez se
    // captura el estado VIVO del proyectil a mitad de vuelo (4s: ya pasó la
    // bobina 2, todavía no llegó a la bobina 3) y se predice desde ahí sobre
    // una copia congelada del estado de señales — nunca desde cero. Si la
    // predicción y la simulación real terminan en el mismo lugar con la misma
    // severidad, el contrato central de ASA 3 ("si predice sin drag, miente")
    // queda probado de punta a punta, no solo por partes sueltas.
    const plan = [
      { coil: { ref: "bobina-1", position: { x: 3, y: 0 } }, onAt: 0.1, offAt: 1 },
      { coil: { ref: "bobina-2", position: { x: 10, y: 0 } }, onAt: 3.6, offAt: 4.5 },
      { coil: { ref: "bobina-3", position: { x: 17, y: 0 } }, onAt: 5.1, offAt: 6 },
    ];
    const pulses = plan.map((entry) => timedPulse(entry.coil.ref, entry.onAt, entry.offAt));
    const graph: SignalGraph = {
      nodes: [node("disparo", "emitter"), ...pulses.flatMap((pulse) => pulse.nodes)],
      edges: pulses.flatMap((pulse) => pulse.edges),
    };
    const evaluator = new SignalEvaluator(graph);
    const state = evaluator.createState();
    const world = new RailWorld(state, plan.map((entry) => entry.coil));
    const events = new EventEmitter<KineticDomainEvent>();
    const impacts: KineticImpactEvent[] = [];
    events.on("kinetic-impact", (event) => impacts.push(event));
    const sim = new ProjectileSimulation(world, events);
    sim.register(IRON_SLUG, { x: 0, y: 0 });
    world.put({ x: 24, y: 0 }, "puerta-bloqueada");

    const inputs: SignalEmitterInputs = new Map([[id("disparo"), true]]);
    const midFlightTicks = 40; // 4.0s: pasó la bobina 2, la bobina 3 todavía no pulsó (5.1s).
    let elapsed = 0;
    for (let t = 0; t < midFlightTicks; t += 1) {
      elapsed += DT;
      evaluator.tick(state, inputs, { dtSeconds: DT, elapsedSeconds: elapsed });
      sim.tick({ dtSeconds: DT, elapsedSeconds: elapsed });
    }
    expect(impacts).toHaveLength(0); // todavía en vuelo — no llegó a la puerta

    // Predicción a mitad de vuelo: clona el estado de señales (nunca el real)
    // y arranca desde el `ProjectileState`/acumulador VIVOS de este instante,
    // no desde reposo — es justo lo que `registerFrom`/`previewTrajectory`
    // existen para permitir.
    const liveState = sim.stateOf(IRON_SLUG.ref)!;
    const liveSnapshot = sim.accumulatorSnapshotOf(IRON_SLUG.ref)!;
    const clonedSignalState: SignalGraphState = new Map(
      [...state].map(([nodeId, nodeState]) => [nodeId, { ...nodeState }]),
    );
    const dryRunWorld = new RailWorld(clonedSignalState, plan.map((entry) => entry.coil));
    dryRunWorld.put({ x: 24, y: 0 }, "puerta-bloqueada");
    const dryRunEvaluator = new SignalEvaluator(graph);

    const predicted = previewTrajectory({
      world: dryRunWorld,
      body: IRON_SLUG,
      initialState: liveState,
      initialAccumulatorSnapshot: liveSnapshot,
      ticks: 100,
      dtSeconds: DT,
      beforeEachTick: (ctx) => dryRunEvaluator.tick(clonedSignalState, inputs, ctx),
    });

    // La simulación REAL sigue corriendo hasta el final, sin tocar la copia.
    for (let t = midFlightTicks; t < 80; t += 1) {
      elapsed += DT;
      evaluator.tick(state, inputs, { dtSeconds: DT, elapsedSeconds: elapsed });
      sim.tick({ dtSeconds: DT, elapsedSeconds: elapsed });
    }

    expect(impacts).toHaveLength(1);
    expect(impacts[0]).toMatchObject({
      targetRef: "puerta-bloqueada",
      velocity: "A",
      severity: "high",
    });

    const predictedFinal = predicted[predicted.length - 1];
    expect(predictedFinal?.position).toEqual(sim.stateOf(IRON_SLUG.ref)?.position);
    expect(predictedFinal?.velocity).toBe("N"); // se detiene tras el impacto predicho, igual que el real
  });
});
