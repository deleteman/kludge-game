import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "./event-emitter.js";
import type { DomainEventBase } from "./domain-event.types.js";

// Eventos sintéticos: el emisor es genérico y no depende de ningún subsistema.
interface AlphaEvent extends DomainEventBase {
  readonly kind: "alpha";
  readonly value: number;
}
interface BetaEvent extends DomainEventBase {
  readonly kind: "beta";
  readonly label: string;
}
type TestEvent = AlphaEvent | BetaEvent;

describe("simulation: EventEmitter (Observer seam motor→/game)", () => {
  it("delivers an event only to handlers of its kind", () => {
    const emitter = new EventEmitter<TestEvent>();
    const onAlpha = vi.fn();
    const onBeta = vi.fn();
    emitter.on("alpha", onAlpha);
    emitter.on("beta", onBeta);

    emitter.emit({ kind: "alpha", value: 42, elapsedSeconds: 1 });

    expect(onAlpha).toHaveBeenCalledOnce();
    expect(onAlpha).toHaveBeenCalledWith({ kind: "alpha", value: 42, elapsedSeconds: 1 });
    expect(onBeta).not.toHaveBeenCalled();
  });

  it("narrows the payload type per kind (compile-time)", () => {
    const emitter = new EventEmitter<TestEvent>();
    emitter.on("alpha", (event) => {
      // `event` está estrechado a AlphaEvent: `value` existe, `label` no.
      expect(typeof event.value).toBe("number");
    });
    emitter.emit({ kind: "alpha", value: 7, elapsedSeconds: 0 });
  });

  it("onAny receives every event regardless of kind", () => {
    const emitter = new EventEmitter<TestEvent>();
    const spy = vi.fn();
    emitter.onAny(spy);

    emitter.emit({ kind: "alpha", value: 1, elapsedSeconds: 0 });
    emitter.emit({ kind: "beta", label: "x", elapsedSeconds: 0 });

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("stops delivering after unsubscribe", () => {
    const emitter = new EventEmitter<TestEvent>();
    const spy = vi.fn();
    const unsubscribe = emitter.on("alpha", spy);

    emitter.emit({ kind: "alpha", value: 1, elapsedSeconds: 0 });
    unsubscribe();
    emitter.emit({ kind: "alpha", value: 2, elapsedSeconds: 0 });

    expect(spy).toHaveBeenCalledOnce();
  });

  it("tolerates a handler unsubscribing during dispatch", () => {
    const emitter = new EventEmitter<TestEvent>();
    const calls: string[] = [];
    const unsubscribeSelf = emitter.on("alpha", () => {
      calls.push("first");
      unsubscribeSelf();
    });
    emitter.on("alpha", () => {
      calls.push("second");
    });

    expect(() => emitter.emit({ kind: "alpha", value: 1, elapsedSeconds: 0 })).not.toThrow();
    expect(calls).toEqual(["first", "second"]);
  });
});
