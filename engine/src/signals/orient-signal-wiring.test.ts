import { describe, expect, it } from "vitest";
import { orientSignalWiring, SignalWiringDirectionError } from "./orient-signal-wiring.js";
import type { SignalGraph } from "./signal-graph.types.js";
import type { SignalNodeId } from "./signal-node.types.js";

const SENSOR = "sensor" as SignalNodeId;
const PUERTA = "puerta" as SignalNodeId;
const OTRA_PUERTA = "otra-puerta" as SignalNodeId;
const OTRO_SENSOR = "otro-sensor" as SignalNodeId;
const CABLE = "cable" as SignalNodeId;

const GRAPH: SignalGraph<string> = {
  nodes: [
    { id: SENSOR, role: "emitter", position: { x: 0, y: 0 }, ownerRef: "sensor-instance" },
    { id: OTRO_SENSOR, role: "emitter", position: { x: 0, y: 1 }, ownerRef: "sensor-b" },
    { id: PUERTA, role: "receptor", position: { x: 1, y: 0 }, ownerRef: "puerta-instance" },
    { id: OTRA_PUERTA, role: "receptor", position: { x: 1, y: 1 }, ownerRef: "puerta-b" },
    { id: CABLE, role: "conductor", position: { x: 2, y: 0 }, ownerRef: "cable-instance" },
  ],
  edges: [],
};

describe("orientSignalWiring (13h, ronda 2 de playtest)", () => {
  it("respeta el orden cuando ya va de emisor a receptor", () => {
    expect(orientSignalWiring(GRAPH, SENSOR, PUERTA)).toEqual({ from: SENSOR, to: PUERTA });
  });

  it("da vuelta el cable cuando se clickeó primero la puerta", () => {
    // El reporte #3 del playtest podía ser exactamente esto: el orden de clicks
    // ERA la dirección, y `validateSignalGraphIntegrity` no valida roles, así
    // que la arista se escribía apuntando al revés, la tarea se completaba, el
    // tripulante caminaba hasta allá — y nada volvía a leerla nunca. Un no-op
    // perfecto: cuesta tiempo de juego y no falla.
    expect(orientSignalWiring(GRAPH, PUERTA, SENSOR)).toEqual({ from: SENSOR, to: PUERTA });
  });

  it("rechaza dos emisores: la salida de un sensor la fija el mundo, no un cable", () => {
    expect(() => orientSignalWiring(GRAPH, SENSOR, OTRO_SENSOR)).toThrow(SignalWiringDirectionError);
  });

  it("con un conductor de por medio respeta el orden de clicks (puede ser cualquiera de los dos extremos)", () => {
    expect(orientSignalWiring(GRAPH, SENSOR, CABLE)).toEqual({ from: SENSOR, to: CABLE });
    expect(orientSignalWiring(GRAPH, CABLE, PUERTA)).toEqual({ from: CABLE, to: PUERTA });
  });
});

describe("orientSignalWiring (14a-4, ronda 2 de playtest)", () => {
  it("acepta receptor→receptor y respeta el orden de clicks", () => {
    // El relé. Un `chip-circuito-generico` solo declara `REC`, pero el
    // evaluador calcula la salida de todo nodo que no sea emisor: cablear
    // `chip → LED` siempre fue propagable y solo lo prohibía esta guarda. Sin
    // este caso no existe ninguna topología en tronco, y la carga de un cable
    // no puede pasar nunca de la pieza única que cuelga de él.
    expect(orientSignalWiring(GRAPH, PUERTA, OTRA_PUERTA)).toEqual({ from: PUERTA, to: OTRA_PUERTA });
    expect(orientSignalWiring(GRAPH, OTRA_PUERTA, PUERTA)).toEqual({ from: OTRA_PUERTA, to: PUERTA });
  });

  it("da vuelta conductor→emisor en vez de escribir una arista que entra a un emisor", () => {
    // Regresión de un no-op silencioso preexistente: la guarda vieja miraba si
    // el PRIMER extremo era receptor, así que un conductor clickeado primero y
    // un sensor después pasaba tal cual. La arista quedaba entrando al emisor,
    // cuya salida fija el mundo — nadie la leía nunca.
    expect(orientSignalWiring(GRAPH, CABLE, SENSOR)).toEqual({ from: SENSOR, to: CABLE });
  });

  it("un nodo que no existe es un error, no una arista colgante", () => {
    expect(() => orientSignalWiring(GRAPH, "fantasma" as SignalNodeId, PUERTA)).toThrow(
      SignalWiringDirectionError,
    );
  });
});
