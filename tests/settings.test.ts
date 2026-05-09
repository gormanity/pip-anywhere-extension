import { describe, expect, it } from "vitest";
import {
  clampHoverDelay,
  DEFAULT_SETTINGS,
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

  it("preserves valid boolean settings", () => {
    expect(
      normalizeSettings({
        hoverOverlayEnabled: false,
        hoverDelayMs: 100,
        unblockVideoPiP: false,
        debugLogging: true,
      }),
    ).toEqual({
      hoverOverlayEnabled: false,
      hoverDelayMs: 100,
      unblockVideoPiP: false,
      debugLogging: __DEV__,
    });
  });
});
