export const DEV_HEARTBEAT_MESSAGE = {
  source: "pip-anywhere",
  type: "pip-anywhere.dev-heartbeat",
  build: "dev",
  version: 1,
} as const;

export const RUNTIME_COORDINATOR_TIMINGS = {
  initialGraceMs: 500,
  heartbeatMs: 1000,
  staleMs: 3500,
} as const;

type RuntimeTimer = number | ReturnType<typeof setTimeout>;

interface RuntimeWindow {
  postMessage(message: unknown, targetOrigin: string): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
  setTimeout(handler: () => void, timeout: number): RuntimeTimer;
  clearTimeout(timer: RuntimeTimer): void;
  setInterval(handler: () => void, timeout: number): RuntimeTimer;
  clearInterval(timer: RuntimeTimer): void;
}

export interface RuntimeCoordinatorOptions {
  isDev: boolean;
  startActive: () => void;
  stopActive: () => void;
  onResume?: () => void;
  onSuspend?: () => void;
  win?: RuntimeWindow;
  now?: () => number;
  timings?: Partial<typeof RUNTIME_COORDINATOR_TIMINGS>;
}

export interface RuntimeCoordinator {
  start(): void;
  stop(): void;
}

export function createRuntimeCoordinator({
  isDev,
  onResume,
  onSuspend,
  startActive,
  stopActive,
  win = window,
  now = () => Date.now(),
  timings: timingOverrides = {},
}: RuntimeCoordinatorOptions): RuntimeCoordinator {
  const timings = { ...RUNTIME_COORDINATOR_TIMINGS, ...timingOverrides };
  let stopped = true;
  let active = false;
  let heartbeatTimer: RuntimeTimer | null = null;
  let graceTimer: RuntimeTimer | null = null;
  let staleTimer: RuntimeTimer | null = null;
  let lastDevHeartbeat = Number.NEGATIVE_INFINITY;
  let suspended = false;

  function startRuntime(): void {
    if (active) return;
    if (suspended) {
      suspended = false;
      onResume?.();
    }
    active = true;
    startActive();
  }

  function stopRuntime(): void {
    if (!active) return;
    active = false;
    stopActive();
  }

  function announceDevPresence(): void {
    win.postMessage(DEV_HEARTBEAT_MESSAGE, "*");
  }

  function hasFreshDevHeartbeat(): boolean {
    return now() - lastDevHeartbeat < timings.staleMs;
  }

  function clearStaleTimer(): void {
    if (staleTimer === null) return;
    win.clearTimeout(staleTimer);
    staleTimer = null;
  }

  function scheduleStaleCheck(): void {
    clearStaleTimer();
    const delayMs = Math.max(0, timings.staleMs - (now() - lastDevHeartbeat));
    staleTimer = win.setTimeout(() => {
      staleTimer = null;
      if (stopped) return;
      if (hasFreshDevHeartbeat()) {
        scheduleStaleCheck();
        return;
      }
      startRuntime();
    }, delayMs);
  }

  function handleMessage(event: MessageEvent): void {
    if (event.source !== win || !isDevHeartbeat(event.data)) return;

    lastDevHeartbeat = now();
    if (!suspended) {
      suspended = true;
      onSuspend?.();
    }
    stopRuntime();
    scheduleStaleCheck();
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;

      if (isDev) {
        startRuntime();
        announceDevPresence();
        heartbeatTimer = win.setInterval(
          announceDevPresence,
          timings.heartbeatMs,
        );
        return;
      }

      win.addEventListener("message", handleMessage);
      graceTimer = win.setTimeout(() => {
        graceTimer = null;
        if (hasFreshDevHeartbeat()) {
          scheduleStaleCheck();
          return;
        }
        startRuntime();
      }, timings.initialGraceMs);
    },
    stop() {
      if (stopped) return;
      stopped = true;

      win.removeEventListener("message", handleMessage);
      if (heartbeatTimer !== null) win.clearInterval(heartbeatTimer);
      if (graceTimer !== null) win.clearTimeout(graceTimer);
      clearStaleTimer();
      heartbeatTimer = null;
      graceTimer = null;
      stopRuntime();
    },
  };
}

function isDevHeartbeat(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "source" in data &&
    data.source === DEV_HEARTBEAT_MESSAGE.source &&
    "type" in data &&
    data.type === DEV_HEARTBEAT_MESSAGE.type &&
    "build" in data &&
    data.build === DEV_HEARTBEAT_MESSAGE.build
  );
}
