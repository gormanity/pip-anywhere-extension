import { describe, expect, it } from "vitest";
import {
  clampOverlayOffset,
  clampOverlayOpacity,
  clampOverlayPositionPercent,
  clampOverlaySize,
  clampHoverDelay,
  clampMinimumOverlayDuration,
  DEFAULT_SETTINGS,
  isSiteDisabled,
  normalizeOverlayCorner,
  normalizeSettings,
  sitePatternMatches,
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
    expect(normalizeOverlayCorner("center")).toBe("top-right");
    expect(clampOverlayOffset(-1)).toBe(0);
    expect(clampOverlayOffset(200)).toBe(160);
    expect(clampOverlayOffset("24.4")).toBe(24);
    expect(clampOverlayPositionPercent(-1)).toBe(0);
    expect(clampOverlayPositionPercent(101)).toBe(100);
    expect(clampOverlayOpacity(10)).toBe(20);
    expect(clampOverlayOpacity(101)).toBe(100);
    expect(clampOverlaySize(20)).toBe(28);
    expect(clampOverlaySize(90)).toBe(72);
  });

  it("preserves valid boolean settings", () => {
    expect(
      normalizeSettings({
        hoverOverlayEnabled: false,
        hoverDelayMs: 100,
        minimumOverlayDurationSeconds: 30,
        overlayPositionXPercent: 25,
        overlayPositionYPercent: 75,
        overlayOpacityPercent: 60,
        overlaySizePx: 52,
        overlayIdleHideMs: 3000,
        unblockVideoPiP: false,
        disabledSitePatterns: ["example.com", "*player*"],
        debugLogging: true,
      }),
    ).toEqual({
      hoverOverlayEnabled: false,
      hoverDelayMs: 100,
      minimumOverlayDurationSeconds: 30,
      overlayPositionXPercent: 25,
      overlayPositionYPercent: 75,
      overlayOpacityPercent: 60,
      overlaySizePx: 52,
      overlayIdleHideMs: 3000,
      unblockVideoPiP: false,
      disabledSitePatterns: ["example.com", "*player*"],
      debugLogging: __DEV__,
    });
  });

  it("migrates legacy overlay corner and offset settings", () => {
    expect(
      normalizeSettings({
        overlayCorner: "bottom-left",
        overlayOffsetX: 80,
        overlayOffsetY: 40,
      }),
    ).toMatchObject({
      overlayPositionXPercent: 10,
      overlayPositionYPercent: 95,
    });
  });

  it("matches exact hosts, subdomains, and wildcard site patterns", () => {
    const location = {
      hostname: "video.example.com",
      href: "https://video.example.com/watch/123",
    } as Location;

    expect(sitePatternMatches("example.com", location)).toBe(true);
    expect(sitePatternMatches("other.example", location)).toBe(false);
    expect(sitePatternMatches("*.example.com", location)).toBe(true);
    expect(sitePatternMatches("*watch/123", location)).toBe(true);
    expect(sitePatternMatches("*.other.example", location)).toBe(false);
    expect(
      isSiteDisabled(
        { disabledSitePatterns: ["other.example", "example.com"] },
        location,
      ),
    ).toBe(true);
  });
});
