import {
  enableVideoPiP,
  findBestVideo,
  togglePictureInPicture,
} from "@/core/pip";
import { getBrowserApi } from "@/core/browser";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadSettings,
  normalizeSettings,
  type PipSettings,
} from "@/core/settings";

const OVERLAY_CLASS = "ultimate-pip-overlay";
const TOAST_CLASS = "ultimate-pip-toast";
const STYLE_ID = "ultimate-pip-style";
const VIDEO_ATTRIBUTE = "data-ultimate-pip-observed";
const INJECTED_SCRIPT_ID = "ultimate-pip-unblocker";
const CONFIG_EVENT = "ultimate-pip.configure";
const DIAGNOSTIC_EVENT = "ultimate-pip.diagnostic";

interface DiagnosticsState {
  videosObserved: number;
  overlaySkippedShortVideo: number;
  overlaySkippedUnknownDuration: number;
  pipRequests: number;
  pipFailures: number;
  pageUnblockerEvents: Record<string, number>;
  lastFailureReason: string | null;
}

let settings: PipSettings = { ...DEFAULT_SETTINGS };
let overlay: HTMLButtonElement | null = null;
let overlayVideo: HTMLVideoElement | null = null;
let toast: HTMLDivElement | null = null;
let toastTimer: number | null = null;
let toastText: string | null = null;
let hoverTimer: number | null = null;
let hoverTargetVideo: HTMLVideoElement | null = null;
let pointerVideo: HTMLVideoElement | null = null;
let overlayUpdateFrame: number | null = null;
let pageUnblockerInjected = false;
const api = getBrowserApi();
const diagnostics: DiagnosticsState = {
  videosObserved: 0,
  overlaySkippedShortVideo: 0,
  overlaySkippedUnknownDuration: 0,
  pipRequests: 0,
  pipFailures: 0,
  pageUnblockerEvents: {},
  lastFailureReason: null,
};

function log(...args: unknown[]): void {
  if (__DEV__ && settings.debugLogging) {
    console.debug("[ultimate-pip]", ...args);
  }
}

function recordDiagnostic(
  event: string,
  details: Record<string, unknown> | unknown = {},
): void {
  if (!__DEV__) return;
  log("diagnostic", event, { details, state: diagnostics });
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${OVERLAY_CLASS} {
      position: fixed;
      z-index: 2147483647;
      width: 42px;
      height: 42px;
      border: 0;
      border-radius: 999px;
      color: white;
      background: rgba(15, 23, 42, 0.86);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
      display: grid;
      place-items: center;
      padding: 0;
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: opacity 120ms ease, transform 120ms ease;
      transform: translateY(4px);
    }
    .${OVERLAY_CLASS}[data-visible="true"] {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }
    .${OVERLAY_CLASS}:hover {
      background: rgba(15, 23, 42, 0.96);
    }
    .${OVERLAY_CLASS} svg {
      width: 24px;
      height: 24px;
      display: block;
    }
    .${TOAST_CLASS} {
      position: fixed;
      z-index: 2147483647;
      left: 50%;
      bottom: 24px;
      max-width: min(420px, calc(100vw - 32px));
      transform: translate(-50%, 12px);
      padding: 10px 14px;
      border-radius: 8px;
      color: white;
      background: rgba(15, 23, 42, 0.94);
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.28);
      font: 500 14px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      opacity: 0;
      pointer-events: none;
      transition: opacity 140ms ease, transform 140ms ease;
    }
    .${TOAST_CLASS}[data-visible="true"] {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  `;
  document.documentElement.appendChild(style);
}

function createOverlay(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = OVERLAY_CLASS;
  button.setAttribute("aria-label", "Open picture-in-picture");
  button.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
      <rect x="12" y="11" width="7" height="5" rx="1" fill="currentColor"/>
    </svg>
  `;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void triggerPiP(overlayVideo ?? findBestVideo());
  });
  document.documentElement.appendChild(button);
  return button;
}

function getOverlay(): HTMLButtonElement {
  ensureStyle();
  overlay ??= createOverlay();
  return overlay;
}

function getToast(): HTMLDivElement {
  ensureStyle();
  if (!toast) {
    toast = document.createElement("div");
    toast.className = TOAST_CLASS;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.addEventListener("mouseenter", () => {
      if (toastTimer !== null) {
        window.clearTimeout(toastTimer);
        toastTimer = null;
      }
    });
    toast.addEventListener("mouseleave", () => {
      if (!toastText || toastTimer !== null) return;
      scheduleToastHide(1200);
    });
    document.documentElement.appendChild(toast);
  }
  return toast;
}

function scheduleToastHide(delayMs: number): void {
  const element = getToast();
  const text = toastText;
  toastTimer = window.setTimeout(() => {
    if (toastText === text) {
      element.removeAttribute("data-visible");
      toastText = null;
    }
    toastTimer = null;
  }, delayMs);
}

function failureMessage(
  result: Awaited<ReturnType<typeof togglePictureInPicture>>,
) {
  const message = result.message ?? "";
  switch (result.reason) {
    case "no-video":
      return "No eligible video found on this page.";
    case "unsupported":
      return "Picture-in-picture is not available on this page.";
    case "disabled":
      return "This video is blocking picture-in-picture.";
    case "not-ready":
      return "The video is not ready for picture-in-picture yet.";
    case "request-failed":
      if (/user gesture|user activation/i.test(message)) {
        return "Click the video or page once, then try picture-in-picture again.";
      }
      return message
        ? `Picture-in-picture failed: ${message}`
        : "Picture-in-picture failed.";
    default:
      return "Picture-in-picture failed.";
  }
}

function showToast(message: string): void {
  const element = getToast();
  toastText = message;
  element.textContent = message;
  element.dataset.visible = "true";

  if (toastTimer !== null) {
    window.clearTimeout(toastTimer);
    toastTimer = null;
  }
  scheduleToastHide(3200);
}

function positionOverlay(video: HTMLVideoElement): void {
  const button = getOverlay();
  const rect = video.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    button.removeAttribute("data-visible");
    return;
  }
  const buttonSize = 42;
  const adaptiveOffsetX = Math.min(settings.overlayOffsetX, rect.width * 0.15);
  const adaptiveOffsetY = Math.min(settings.overlayOffsetY, rect.height * 0.15);
  const fromRight = settings.overlayCorner.endsWith("right");
  const fromBottom = settings.overlayCorner.startsWith("bottom");
  const top = fromBottom
    ? rect.bottom - buttonSize - adaptiveOffsetY
    : rect.top + adaptiveOffsetY;
  const left = fromRight
    ? rect.right - buttonSize - adaptiveOffsetX
    : rect.left + adaptiveOffsetX;

  const maxTop = window.innerHeight - buttonSize - 8;
  const maxLeft = window.innerWidth - buttonSize - 8;
  button.style.top = `${Math.min(maxTop, Math.max(8, top))}px`;
  button.style.left = `${Math.min(maxLeft, Math.max(8, left))}px`;
}

function updateVisibleOverlayPosition(): void {
  overlayUpdateFrame = null;
  if (!overlayVideo || overlay?.dataset.visible !== "true") return;
  if (!overlayVideo.isConnected) {
    overlay?.removeAttribute("data-visible");
    overlayVideo = null;
    return;
  }
  positionOverlay(overlayVideo);
}

function scheduleOverlayPositionUpdate(): void {
  if (overlayUpdateFrame !== null) return;
  overlayUpdateFrame = window.requestAnimationFrame(
    updateVisibleOverlayPosition,
  );
}

function isVideoEligibleForOverlay(video: HTMLVideoElement): boolean {
  const minimumSeconds = settings.minimumOverlayDurationSeconds;
  if (video.muted && !Number.isFinite(video.duration)) {
    recordDiagnostic("overlay-skipped-muted-preview", {
      readyState: video.readyState,
      paused: video.paused,
    });
    return false;
  }
  if (minimumSeconds <= 0) return true;
  if (video.duration === Infinity) return true;
  if (
    !Number.isFinite(video.duration) &&
    !video.paused &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
  ) {
    return true;
  }
  if (!Number.isFinite(video.duration)) {
    diagnostics.overlaySkippedUnknownDuration += 1;
    recordDiagnostic("overlay-skipped-unknown-duration", {
      minimumSeconds,
    });
    return false;
  }
  if (video.duration < minimumSeconds) {
    diagnostics.overlaySkippedShortVideo += 1;
    recordDiagnostic("overlay-skipped-short-video", {
      duration: video.duration,
      minimumSeconds,
    });
    return false;
  }
  return true;
}

function showOverlay(video: HTMLVideoElement): void {
  if (!settings.hoverOverlayEnabled || !isVideoEligibleForOverlay(video)) {
    return;
  }
  overlayVideo = video;
  positionOverlay(video);
  getOverlay().dataset.visible = "true";
}

function hideOverlaySoon(): void {
  window.setTimeout(() => {
    if (!overlay?.matches(":hover")) {
      overlay?.removeAttribute("data-visible");
    }
  }, 100);
}

function clearHoverTimer(): void {
  if (hoverTimer !== null) {
    window.clearTimeout(hoverTimer);
    hoverTimer = null;
  }
  hoverTargetVideo = null;
}

function scheduleOverlay(video: HTMLVideoElement): void {
  if (hoverTargetVideo === video && hoverTimer !== null) return;
  clearHoverTimer();
  hoverTargetVideo = video;
  hoverTimer = window.setTimeout(
    () => showOverlay(video),
    settings.hoverDelayMs,
  );
}

function findVideoAtPoint(x: number, y: number): HTMLVideoElement | null {
  const candidates = Array.from(document.querySelectorAll("video"))
    .map((video) => {
      const rect = video.getBoundingClientRect();
      const contains =
        rect.width > 0 &&
        rect.height > 0 &&
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom;
      const area = rect.width * rect.height;
      const playingScore = !video.paused && !video.ended ? 1_000_000 : 0;
      return { video, contains, score: playingScore + area };
    })
    .filter((candidate) => candidate.contains)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.video ?? null;
}

function handleDocumentMouseMove(event: MouseEvent): void {
  if (overlay?.matches(":hover")) return;

  const video = findVideoAtPoint(event.clientX, event.clientY);
  if (!video) {
    pointerVideo = null;
    clearHoverTimer();
    hideOverlaySoon();
    return;
  }

  if (pointerVideo === video) {
    if (overlay?.dataset.visible === "true") {
      scheduleOverlayPositionUpdate();
    } else {
      scheduleOverlay(video);
    }
    return;
  }

  pointerVideo = video;
  observeVideo(video);
  scheduleOverlay(video);
}

function observeVideo(video: HTMLVideoElement): void {
  if (video.dataset.ultimatePipObserved === "true") return;
  diagnostics.videosObserved += 1;
  video.dataset.ultimatePipObserved = "true";
  video.setAttribute(VIDEO_ATTRIBUTE, "true");
  recordDiagnostic("video-observed", {
    readyState: video.readyState,
    duration: video.duration,
    disablePictureInPicture: video.disablePictureInPicture,
  });

  if (settings.unblockVideoPiP) enableVideoPiP(video);

  video.addEventListener("mouseenter", () => scheduleOverlay(video));
  video.addEventListener("mousemove", scheduleOverlayPositionUpdate);
  video.addEventListener("loadedmetadata", () => {
    if (overlayVideo === video || pointerVideo === video) showOverlay(video);
  });
  video.addEventListener("mouseleave", () => {
    clearHoverTimer();
    if (pointerVideo === video) pointerVideo = null;
    hideOverlaySoon();
  });
}

function observeVideos(root: ParentNode = document): void {
  for (const video of root.querySelectorAll("video")) {
    observeVideo(video);
  }
}

function dispatchUnblockerConfig(): void {
  window.dispatchEvent(
    new CustomEvent(CONFIG_EVENT, {
      detail: {
        enabled: settings.unblockVideoPiP,
        debug: settings.debugLogging,
      },
    }),
  );
}

function injectPageUnblocker(): void {
  if (pageUnblockerInjected || document.getElementById(INJECTED_SCRIPT_ID)) {
    dispatchUnblockerConfig();
    return;
  }

  pageUnblockerInjected = true;
  recordDiagnostic("page-unblocker-injecting");
  const script = document.createElement("script");
  script.id = INJECTED_SCRIPT_ID;
  script.src = api.runtime.getURL("pip-unblocker.js");
  script.onload = () => {
    script.remove();
    recordDiagnostic("page-unblocker-injected");
    dispatchUnblockerConfig();
  };
  script.onerror = () => {
    pageUnblockerInjected = false;
    recordDiagnostic("page-unblocker-injection-failed");
  };
  (document.head ?? document.documentElement).appendChild(script);
}

function handleMutations(mutations: MutationRecord[]): void {
  for (const mutation of mutations) {
    if (
      mutation.type === "attributes" &&
      mutation.target instanceof HTMLVideoElement
    ) {
      if (settings.unblockVideoPiP) enableVideoPiP(mutation.target);
      continue;
    }

    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLVideoElement) observeVideo(node);
      if (node instanceof Element) observeVideos(node);
    }
  }
}

async function triggerPiP(video: HTMLVideoElement | null) {
  diagnostics.pipRequests += 1;
  const result = await togglePictureInPicture(video);
  if (!result.ok) {
    diagnostics.pipFailures += 1;
    diagnostics.lastFailureReason = result.reason ?? "unknown";
    recordDiagnostic("pip-request-failed", result);
    showToast(failureMessage(result));
  } else {
    recordDiagnostic("pip-request-succeeded");
  }
  return result;
}

async function init(): Promise<void> {
  try {
    settings = await loadSettings();
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }

  if (settings.unblockVideoPiP) injectPageUnblocker();
  window.addEventListener(DIAGNOSTIC_EVENT, (event) => {
    if (!__DEV__ || !(event instanceof CustomEvent)) return;
    const type =
      typeof event.detail?.type === "string" ? event.detail.type : "unknown";
    diagnostics.pageUnblockerEvents[type] =
      (diagnostics.pageUnblockerEvents[type] ?? 0) + 1;
    recordDiagnostic("page-unblocker-event", event.detail);
  });
  observeVideos();
  document.addEventListener("mousemove", handleDocumentMouseMove, true);
  window.addEventListener("scroll", scheduleOverlayPositionUpdate, true);
  window.addEventListener("resize", scheduleOverlayPositionUpdate);

  const observer = new MutationObserver(handleMutations);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["disablepictureinpicture", "controlslist"],
    childList: true,
    subtree: true,
  });

  api.storage.onChanged.addListener((changes, areaName) => {
    const next = changes[SETTINGS_KEY];
    if (areaName === "sync" && next) {
      settings = normalizeSettings(next.newValue);
      if (settings.unblockVideoPiP && !pageUnblockerInjected) {
        injectPageUnblocker();
      } else if (pageUnblockerInjected) {
        dispatchUnblockerConfig();
      }
      observeVideos();
    }
  });

  api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "ultimate-pip.toggle") return false;
    void triggerPiP(findBestVideo()).then(sendResponse);
    return true;
  });
}

void init();
