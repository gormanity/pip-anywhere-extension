import { describe, expect, it } from "vitest";
import {
  clampOverlayOffset,
  clampHoverDelay,
  clampMinimumOverlayDuration,
  DEFAULT_SETTINGS,
  normalizeOverlayCorner,
  normalizeSettings,
} from "@/core/settings";

describe("settings normalization", () => {
  it("returns defaults for invalid input", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("clamps hover delay to the supported range", () => {
    expect(clampHoverDelay(-1)).toBe(0);
    expect(clampHoverDelay(2010)).toBe(2000);
    expect(clampHoverDelay("375.4")).toBe(375);
  });

  it("clamps minimum overlay duration to the supported range", () => {
    expect(clampMinimumOverlayDuration(-1)).toBe(0);
    expect(clampMinimumOverlayDuration(605)).toBe(600);
    expect(clampMinimumOverlayDuration("44.6")).toBe(45);
  });

  it("normalizes overlay placement settings", () => {
    expect(normalizeOverlayCorner("bottom-left")).toBe("bottom-left");
    expect(normalizeOverlayCorner("center")).toBe(
      DEFAULT_SETTINGS.overlayCorner,
    );
    expect(clampOverlayOffset(-1)).toBe(0);
    expect(clampOverlayOffset(200)).toBe(160);
    expect(clampOverlayOffset("24.4")).toBe(24);
  });

  it("preserves valid boolean settings", () => {
    expect(
      normalizeSettings({
        hoverOverlayEnabled: false,
        hoverDelayMs: 100,
        minimumOverlayDurationSeconds: 30,
        overlayCorner: "bottom-left",
        overlayOffsetX: 24,
        overlayOffsetY: 32,
        unblockVideoPiP: false,
        debugLogging: true,
      }),
    ).toEqual({
      hoverOverlayEnabled: false,
      hoverDelayMs: 100,
      minimumOverlayDurationSeconds: 30,
      overlayCorner: "bottom-left",
      overlayOffsetX: 24,
      overlayOffsetY: 32,
      unblockVideoPiP: false,
      debugLogging: __DEV__,
    });
  });
});
