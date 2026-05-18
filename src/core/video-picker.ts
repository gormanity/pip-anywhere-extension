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
  clippingAncestors: PickerClippingAncestor[];
};

export type SelectablePickerVideo<T> = {
  video: T;
  rect: PickerRect;
};

export type PickerClippingAncestor = {
  rect: PickerRect;
  clipX: boolean;
  clipY: boolean;
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
  for (const clippingAncestor of candidate.clippingAncestors) {
    visibleRect = clipRectToAncestor(visibleRect, clippingAncestor);
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
  return clipRectToAncestor(a, { rect: b, clipX: true, clipY: true });
}

export function clipRectToAncestor(
  rect: PickerRect,
  ancestor: PickerClippingAncestor,
): PickerRect | null {
  const left = ancestor.clipX
    ? Math.max(rect.left, ancestor.rect.left)
    : rect.left;
  const right = ancestor.clipX
    ? Math.min(rect.right, ancestor.rect.right)
    : rect.right;
  const top = ancestor.clipY ? Math.max(rect.top, ancestor.rect.top) : rect.top;
  const bottom = ancestor.clipY
    ? Math.min(rect.bottom, ancestor.rect.bottom)
    : rect.bottom;
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
