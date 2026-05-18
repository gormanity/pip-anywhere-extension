import { describe, expect, it } from "vitest";
import {
  intersectRects,
  selectPickerVideos,
  selectableVideoRect,
  type PickerRect,
  type PickerVideoCandidate,
} from "@/core/video-picker";

function rect(
  left: number,
  top: number,
  width: number,
  height: number,
): PickerRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

function candidate(
  video: string,
  sourceRect: PickerRect,
  options: {
    visible?: boolean;
    clippingRects?: PickerRect[];
  } = {},
): PickerVideoCandidate<string> {
  return {
    video,
    rect: sourceRect,
    visible: options.visible ?? true,
    clippingRects: options.clippingRects ?? [],
  };
}

describe("video picker geometry", () => {
  it("keeps ordinary visible videos selectable", () => {
    expect(
      selectPickerVideos([candidate("hero", rect(20, 30, 640, 360))]),
    ).toEqual([{ video: "hero", rect: rect(20, 30, 640, 360) }]);
  });

  it("skips hidden and zero-area videos", () => {
    expect(
      selectPickerVideos([
        candidate("hidden", rect(20, 30, 640, 360), { visible: false }),
        candidate("zero-width", rect(20, 30, 0, 360)),
        candidate("zero-height", rect(20, 30, 640, 0)),
      ]),
    ).toEqual([]);
  });

  it("keeps videos below the fold because picker mode can scroll to them", () => {
    expect(
      selectPickerVideos([candidate("below-fold", rect(20, 5_000, 640, 360))]),
    ).toEqual([{ video: "below-fold", rect: rect(20, 5_000, 640, 360) }]);
  });

  it("uses the visible clipped rect for partially clipped videos", () => {
    expect(
      selectableVideoRect(
        candidate("partial", rect(20, 30, 640, 360), {
          clippingRects: [rect(0, 0, 700, 160)],
        }),
      ),
    ).toEqual(rect(20, 30, 640, 130));
  });

  it("skips videos fully clipped by an overflow ancestor", () => {
    expect(
      selectableVideoRect(
        candidate("clipped", rect(20, 200, 640, 360), {
          clippingRects: [rect(0, 0, 700, 80)],
        }),
      ),
    ).toBeNull();
  });

  it("removes smaller candidates fully contained by a larger video", () => {
    expect(
      selectPickerVideos([
        candidate("outer", rect(20, 30, 640, 360)),
        candidate("inner", rect(220, 150, 180, 100)),
      ]),
    ).toEqual([{ video: "outer", rect: rect(20, 30, 640, 360) }]);
  });

  it("keeps distinct non-overlapping videos", () => {
    expect(
      selectPickerVideos([
        candidate("hero", rect(20, 30, 640, 360)),
        candidate("promo", rect(20, 440, 320, 180)),
      ]),
    ).toEqual([
      { video: "hero", rect: rect(20, 30, 640, 360) },
      { video: "promo", rect: rect(20, 440, 320, 180) },
    ]);
  });

  it("intersects rectangles by visible area", () => {
    expect(
      intersectRects(rect(10, 20, 100, 80), rect(50, 10, 120, 40)),
    ).toEqual(rect(50, 20, 60, 30));
    expect(
      intersectRects(rect(10, 20, 100, 80), rect(200, 20, 20, 20)),
    ).toBeNull();
  });
});
