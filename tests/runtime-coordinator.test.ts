import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEV_HEARTBEAT_MESSAGE,
  createRuntimeCoordinator,
} from "@/core/runtime-coordinator";

describe("runtime coordinator", () => {
  let win: FakeRuntimeWindow;
  let nowMs: number;
  let started: number;
  let stopped: number;

  beforeEach(() => {
    vi.useFakeTimers();
    win = new FakeRuntimeWindow();
    nowMs = 0;
    started = 0;
    stopped = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts dev immediately and announces presence", () => {
    createRuntimeCoordinator({
      isDev: true,
      startActive: () => {
        started += 1;
      },
      stopActive: () => {
        stopped += 1;
      },
      win,
      now: () => nowMs,
    }).start();

    expect(started).toBe(1);
    expect(stopped).toBe(0);
    expect(win.messages).toEqual([DEV_HEARTBEAT_MESSAGE]);

    advance(1000);
    expect(win.messages).toHaveLength(2);
  });

  it("starts prod after the grace window when no dev build appears", () => {
    createRuntimeCoordinator({
      isDev: false,
      startActive: () => {
        started += 1;
      },
      stopActive: () => {
        stopped += 1;
      },
      win,
      now: () => nowMs,
    }).start();

    advance(499);
    expect(started).toBe(0);

    advance(1);
    expect(started).toBe(1);
    expect(stopped).toBe(0);
  });

  it("keeps prod suspended while dev heartbeat is fresh", () => {
    createRuntimeCoordinator({
      isDev: false,
      startActive: () => {
        started += 1;
      },
      stopActive: () => {
        stopped += 1;
      },
      win,
      now: () => nowMs,
    }).start();

    win.emitDevHeartbeat();
    advance(500);
    expect(started).toBe(0);

    advance(2500);
    win.emitDevHeartbeat();
    advance(500);
    expect(started).toBe(0);
  });

  it("suspends prod if dev appears after prod already started", () => {
    createRuntimeCoordinator({
      isDev: false,
      startActive: () => {
        started += 1;
      },
      stopActive: () => {
        stopped += 1;
      },
      win,
      now: () => nowMs,
    }).start();

    advance(500);
    expect(started).toBe(1);

    win.emitDevHeartbeat();
    expect(stopped).toBe(1);
  });

  it("resumes prod after dev heartbeat staleness", () => {
    createRuntimeCoordinator({
      isDev: false,
      startActive: () => {
        started += 1;
      },
      stopActive: () => {
        stopped += 1;
      },
      win,
      now: () => nowMs,
    }).start();

    win.emitDevHeartbeat();
    advance(500);
    expect(started).toBe(0);

    advance(2999);
    expect(started).toBe(0);

    advance(1);
    expect(started).toBe(1);
  });

  function advance(delayMs: number): void {
    nowMs += delayMs;
    vi.advanceTimersByTime(delayMs);
  }
});

class FakeRuntimeWindow {
  readonly messages: unknown[] = [];
  private readonly listeners = new Set<(event: MessageEvent) => void>();

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void {
    if (type === "message") this.listeners.delete(listener);
  }

  setTimeout(
    handler: () => void,
    timeout: number,
  ): ReturnType<typeof setTimeout> {
    return setTimeout(handler, timeout);
  }

  clearTimeout(timer: ReturnType<typeof setTimeout>): void {
    clearTimeout(timer);
  }

  setInterval(
    handler: () => void,
    timeout: number,
  ): ReturnType<typeof setInterval> {
    return setInterval(handler, timeout);
  }

  clearInterval(timer: ReturnType<typeof setInterval>): void {
    clearInterval(timer);
  }

  emitDevHeartbeat(): void {
    const event = {
      source: this,
      data: DEV_HEARTBEAT_MESSAGE,
    } as unknown as MessageEvent;
    for (const listener of this.listeners) listener(event);
  }
}
