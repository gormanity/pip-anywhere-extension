import { getBrowserApi } from "./browser";

export interface PipSettings {
  hoverOverlayEnabled: boolean;
  hoverDelayMs: number;
  minimumOverlayDurationSeconds: number;
  overlayPositionXPercent: number;
  overlayPositionYPercent: number;
  overlayOpacityPercent: number;
  overlaySizePx: number;
  overlayIdleHideMs: number;
  unblockVideoPiP: boolean;
  disabledSitePatterns: string[];
  debugLogging: boolean;
}

export const SETTINGS_KEY = "ultimatePip.settings";
export const OVERLAY_CORNERS = [
  "top-right",
  "top-left",
  "bottom-right",
  "bottom-left",
] as const;

export type OverlayCorner = (typeof OVERLAY_CORNERS)[number];
const DEFAULT_LEGACY_OVERLAY_CORNER: OverlayCorner = "top-right";

type StoredPipSettings = Partial<PipSettings> & {
  overlayCorner?: unknown;
  overlayOffsetX?: unknown;
  overlayOffsetY?: unknown;
};

export const DEFAULT_SETTINGS: PipSettings = {
  hoverOverlayEnabled: true,
  hoverDelayMs: 250,
  minimumOverlayDurationSeconds: 45,
  overlayPositionXPercent: 92,
  overlayPositionYPercent: 12,
  overlayOpacityPercent: 86,
  overlaySizePx: 42,
  overlayIdleHideMs: 2500,
  unblockVideoPiP: true,
  disabledSitePatterns: [],
  debugLogging: false,
};

export function normalizeSettings(input: unknown): PipSettings {
  const stored = input && typeof input === "object" ? input : {};
  const candidate = stored as StoredPipSettings;
  return {
    hoverOverlayEnabled:
      typeof candidate.hoverOverlayEnabled === "boolean"
        ? candidate.hoverOverlayEnabled
        : DEFAULT_SETTINGS.hoverOverlayEnabled,
    hoverDelayMs: clampHoverDelay(candidate.hoverDelayMs),
    minimumOverlayDurationSeconds: clampMinimumOverlayDuration(
      candidate.minimumOverlayDurationSeconds,
    ),
    overlayPositionXPercent: normalizeOverlayPositionPercent(
      candidate.overlayPositionXPercent,
      candidate.overlayCorner,
      candidate.overlayOffsetX,
      "x",
    ),
    overlayPositionYPercent: normalizeOverlayPositionPercent(
      candidate.overlayPositionYPercent,
      candidate.overlayCorner,
      candidate.overlayOffsetY,
      "y",
    ),
    overlayOpacityPercent: clampOverlayOpacity(candidate.overlayOpacityPercent),
    overlaySizePx: clampOverlaySize(candidate.overlaySizePx),
    overlayIdleHideMs: clampOverlayIdleHide(candidate.overlayIdleHideMs),
    unblockVideoPiP:
      typeof candidate.unblockVideoPiP === "boolean"
        ? candidate.unblockVideoPiP
        : DEFAULT_SETTINGS.unblockVideoPiP,
    disabledSitePatterns: normalizeDisabledSitePatterns(
      candidate.disabledSitePatterns,
    ),
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

export function clampOverlayOffset(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 12;
  return Math.min(160, Math.max(0, Math.round(numeric)));
}

export function clampOverlayPositionPercent(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

export function clampOverlayOpacity(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SETTINGS.overlayOpacityPercent;
  return Math.min(100, Math.max(20, Math.round(numeric)));
}

export function clampOverlaySize(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SETTINGS.overlaySizePx;
  return Math.min(72, Math.max(28, Math.round(numeric)));
}

export function clampOverlayIdleHide(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SETTINGS.overlayIdleHideMs;
  return Math.min(10000, Math.max(0, Math.round(numeric)));
}

export function normalizeOverlayCorner(value: unknown): OverlayCorner {
  return OVERLAY_CORNERS.includes(value as OverlayCorner)
    ? (value as OverlayCorner)
    : DEFAULT_LEGACY_OVERLAY_CORNER;
}

export function normalizeOverlayPositionPercent(
  value: unknown,
  legacyCorner: unknown,
  legacyOffset: unknown,
  axis: "x" | "y",
): number {
  if (value !== undefined) return clampOverlayPositionPercent(value);
  if (legacyCorner === undefined && legacyOffset === undefined) {
    return axis === "x"
      ? DEFAULT_SETTINGS.overlayPositionXPercent
      : DEFAULT_SETTINGS.overlayPositionYPercent;
  }

  const corner = normalizeOverlayCorner(legacyCorner);
  const offset = clampOverlayOffset(legacyOffset);
  const insetPercent = Math.min(20, Math.round((offset / 160) * 20));

  if (axis === "x") {
    return corner.endsWith("left") ? insetPercent : 100 - insetPercent;
  }
  return corner.startsWith("top") ? insetPercent : 100 - insetPercent;
}

export function normalizeDisabledSitePatterns(value: unknown): string[] {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.disabledSitePatterns;

  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const pattern = item.trim();
    if (pattern) unique.add(pattern);
  }
  return Array.from(unique).slice(0, 100);
}

export function isSiteDisabled(
  settings: Pick<PipSettings, "disabledSitePatterns">,
  locationLike: Pick<Location, "hostname" | "href">,
): boolean {
  return settings.disabledSitePatterns.some((pattern) =>
    sitePatternMatches(pattern, locationLike),
  );
}

export function sitePatternMatches(
  pattern: string,
  locationLike: Pick<Location, "hostname" | "href">,
): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) return false;

  const normalized = trimmed.toLowerCase();
  const hostname = locationLike.hostname.toLowerCase();
  if (normalized.includes("*")) {
    return (
      wildcardPatternMatches(normalized, hostname) ||
      wildcardPatternMatches(normalized, locationLike.href.toLowerCase())
    );
  }

  return hostname === normalized || hostname.endsWith(`.${normalized}`);
}

function wildcardPatternMatches(pattern: string, value: string): boolean {
  const source = pattern.split("*").map(escapeRegExp).join(".*");
  return new RegExp(`^${source}$`).test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
