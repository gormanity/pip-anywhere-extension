import { getBrowserApi } from "./browser";

export interface PipSettings {
  hoverOverlayEnabled: boolean;
  hoverDelayMs: number;
  minimumOverlayDurationSeconds: number;
  unblockVideoPiP: boolean;
  debugLogging: boolean;
}

export const SETTINGS_KEY = "ultimatePip.settings";

export const DEFAULT_SETTINGS: PipSettings = {
  hoverOverlayEnabled: true,
  hoverDelayMs: 250,
  minimumOverlayDurationSeconds: 45,
  unblockVideoPiP: true,
  debugLogging: false,
};

export function normalizeSettings(input: unknown): PipSettings {
  const stored = input && typeof input === "object" ? input : {};
  const candidate = stored as Partial<PipSettings>;
  return {
    hoverOverlayEnabled:
      typeof candidate.hoverOverlayEnabled === "boolean"
        ? candidate.hoverOverlayEnabled
        : DEFAULT_SETTINGS.hoverOverlayEnabled,
    hoverDelayMs: clampHoverDelay(candidate.hoverDelayMs),
    minimumOverlayDurationSeconds: clampMinimumOverlayDuration(
      candidate.minimumOverlayDurationSeconds,
    ),
    unblockVideoPiP:
      typeof candidate.unblockVideoPiP === "boolean"
        ? candidate.unblockVideoPiP
        : DEFAULT_SETTINGS.unblockVideoPiP,
    debugLogging: __DEV__
      ? typeof candidate.debugLogging === "boolean"
        ? candidate.debugLogging
        : DEFAULT_SETTINGS.debugLogging
      : false,
  };
}

export function clampHoverDelay(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SETTINGS.hoverDelayMs;
  return Math.min(2000, Math.max(0, Math.round(numeric)));
}

export function clampMinimumOverlayDuration(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_SETTINGS.minimumOverlayDurationSeconds;
  }
  return Math.min(600, Math.max(0, Math.round(numeric)));
}

export async function loadSettings(): Promise<PipSettings> {
  const api = getBrowserApi();
  const result = await api.storage.sync.get([SETTINGS_KEY]);
  return normalizeSettings(result[SETTINGS_KEY]);
}

export async function saveSettings(settings: PipSettings): Promise<void> {
  const api = getBrowserApi();
  await api.storage.sync.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
}

export async function ensureDefaultSettings(): Promise<void> {
  const api = getBrowserApi();
  const result = await api.storage.sync.get([SETTINGS_KEY]);
  if (result[SETTINGS_KEY] === undefined) {
    await saveSettings(DEFAULT_SETTINGS);
  }
}
