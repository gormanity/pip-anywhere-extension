export type PickerRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type PickerVideoCandidate<T> = {
  video: T;
  rect: PickerRect;
  visible: boolean;
  clippingRects: PickerRect[];
};

export type SelectablePickerVideo<T> = {
  video: T;
  rect: PickerRect;
};

export function selectPickerVideos<T>(
  candidates: Array<PickerVideoCandidate<T>>,
): Array<SelectablePickerVideo<T>> {
  return removeContainedVideoCandidates(
    candidates.flatMap((candidate) => {
      const rect = selectableVideoRect(candidate);
      return rect ? [{ video: candidate.video, rect }] : [];
    }),
  );
}

export function selectableVideoRect<T>(
  candidate: PickerVideoCandidate<T>,
): PickerRect | null {
  if (!candidate.visible || !hasPositiveArea(candidate.rect)) return null;

  let visibleRect: PickerRect | null = candidate.rect;
  for (const clippingRect of candidate.clippingRects) {
    visibleRect = intersectRects(visibleRect, clippingRect);
    if (!visibleRect) return null;
  }

  return visibleRect;
}

export function removeContainedVideoCandidates<T>(
  videos: Array<SelectablePickerVideo<T>>,
): Array<SelectablePickerVideo<T>> {
  return videos.filter((candidate) => {
    return !videos.some((other) => {
      if (Object.is(other.video, candidate.video)) return false;
      return (
        area(other.rect) > area(candidate.rect) &&
        candidate.rect.left >= other.rect.left &&
        candidate.rect.top >= other.rect.top &&
        candidate.rect.right <= other.rect.right &&
        candidate.rect.bottom <= other.rect.bottom
      );
    });
  });
}

export function intersectRects(
  a: PickerRect,
  b: PickerRect,
): PickerRect | null {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;
  return { left, top, right, bottom, width, height };
}

function hasPositiveArea(rect: PickerRect): boolean {
  return rect.width > 0 && rect.height > 0;
}

function area(rect: PickerRect): number {
  return rect.width * rect.height;
}
