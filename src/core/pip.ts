export type PipFailureReason =
  | "no-video"
  | "unsupported"
  | "disabled"
  | "not-ready"
  | "request-failed";

export interface PipResult {
  ok: boolean;
  reason?: PipFailureReason;
  message?: string;
}

export function findBestVideo(
  root: ParentNode = document,
): HTMLVideoElement | null {
  const videos = Array.from(root.querySelectorAll("video"));
  return (
    videos.find(isActiveVideo) ??
    videos.find(
      (video) => video.readyState >= HTMLMediaElement.HAVE_METADATA,
    ) ??
    videos.find((video) => video.videoWidth > 0 || video.videoHeight > 0) ??
    videos[0] ??
    null
  );
}

export function isActiveVideo(video: HTMLVideoElement): boolean {
  return (
    !video.paused &&
    !video.ended &&
    !video.muted &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
  );
}

export function enableVideoPiP(video: HTMLVideoElement): void {
  video.disablePictureInPicture = false;
  video.removeAttribute("disablepictureinpicture");
  video.removeAttribute("controlslist");
}

export async function togglePictureInPicture(
  video = findBestVideo(),
): Promise<PipResult> {
  if (!video) return { ok: false, reason: "no-video" };
  if (!document.pictureInPictureEnabled) {
    return { ok: false, reason: "unsupported" };
  }

  enableVideoPiP(video);

  if (video.disablePictureInPicture) {
    return { ok: false, reason: "disabled" };
  }
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
    return { ok: false, reason: "not-ready" };
  }

  try {
    if (document.pictureInPictureElement === video) {
      await document.exitPictureInPicture();
    } else {
      await video.requestPictureInPicture();
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: "request-failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
