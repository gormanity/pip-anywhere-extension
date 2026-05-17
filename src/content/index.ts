import {
  enableVideoPiP,
  findBestVideo,
  togglePictureInPicture,
} from "@/core/pip";
import { getBrowserApi } from "@/core/browser";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  isSiteDisabled,
  loadSettings,
  normalizeSettings,
  type PipSettings,
} from "@/core/settings";
import { createRuntimeCoordinator } from "@/core/runtime-coordinator";

const OVERLAY_CLASS = "ultimate-pip-overlay";
const TOAST_CLASS = "ultimate-pip-toast";
const VIDEO_TARGET_CLASS = "ultimate-pip-video-target";
const RUNTIME_KIND = __DEV__ ? "dev" : "prod";
const STYLE_ID = `ultimate-pip-style-${RUNTIME_KIND}`;
const LEGACY_STYLE_ID = "ultimate-pip-style";
const OVERLAY_ID = `ultimate-pip-overlay-${RUNTIME_KIND}`;
const TOAST_ID = `ultimate-pip-toast-${RUNTIME_KIND}`;
const VIDEO_ATTRIBUTE = `data-ultimate-pip-observed-${RUNTIME_KIND}`;
const INJECTED_SCRIPT_ID = `ultimate-pip-unblocker-${RUNTIME_KIND}`;
const CONFIG_EVENT = `ultimate-pip.configure.${RUNTIME_KIND}`;
const DIAGNOSTIC_EVENT = `ultimate-pip.diagnostic.${RUNTIME_KIND}`;
const GLOBAL_RUNTIME_KEY = `__pipAnywhereContentRuntime_${RUNTIME_KIND}`;

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
let overlayIdleTimer: number | null = null;
let hoverTargetVideo: HTMLVideoElement | null = null;
let pointerVideo: HTMLVideoElement | null = null;
let overlayUpdateFrame: number | null = null;
let selectionUpdateFrame: number | null = null;
let selectionTargets: Array<{
  video: HTMLVideoElement;
  element: HTMLButtonElement;
}> = [];
let pageUnblockerInjected = false;
const api = getBrowserApi();
let runtimeStarted = false;
let runtimeGeneration = 0;
let runtimeAbort: AbortController | null = null;
let mutationObserver: MutationObserver | null = null;
let storageChangeListener:
  | Parameters<typeof api.storage.onChanged.addListener>[0]
  | null = null;
let runtimeMessageListener:
  | Parameters<typeof api.runtime.onMessage.addListener>[0]
  | null = null;
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

function getRuntimeSignal(): AbortSignal {
  if (!runtimeAbort) {
    throw new Error("PiP Anywhere content runtime is not active");
  }
  return runtimeAbort.signal;
}

function pruneStaleUiElements(): void {
  for (const element of document.querySelectorAll(`.${OVERLAY_CLASS}`)) {
    if (element !== overlay) element.remove();
  }
  for (const element of document.querySelectorAll(`.${TOAST_CLASS}`)) {
    if (element !== toast) element.remove();
  }

  const activeSelectionElements = new Set(
    selectionTargets.map((target) => target.element),
  );
  for (const element of document.querySelectorAll(`.${VIDEO_TARGET_CLASS}`)) {
    if (!activeSelectionElements.has(element as HTMLButtonElement)) {
      element.remove();
    }
  }

  document.getElementById(LEGACY_STYLE_ID)?.remove();
}

function ensureStyle(): void {
  pruneStaleUiElements();
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${OVERLAY_CLASS} {
      position: fixed;
      z-index: 2147483647;
      width: var(--pip-overlay-size, 42px);
      height: var(--pip-overlay-size, 42px);
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
      opacity: var(--pip-overlay-opacity, 0.86);
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
    .${VIDEO_TARGET_CLASS} {
      position: fixed;
      z-index: 2147483646;
      border: 3px solid #f59f00;
      border-radius: 10px;
      background: rgba(245, 159, 0, 0.14);
      box-shadow:
        0 0 0 9999px rgba(15, 23, 42, 0.18),
        0 14px 36px rgba(15, 23, 42, 0.22);
      color: white;
      cursor: pointer;
      padding: 0;
    }
    .${VIDEO_TARGET_CLASS}::after {
      content: "Open in PiP";
      position: absolute;
      top: 12px;
      right: 12px;
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      padding: 0 12px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.92);
      font: 700 14px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
  `;
  document.documentElement.appendChild(style);
}

function createOverlay(): HTMLButtonElement {
  pruneStaleUiElements();
  const button = document.createElement("button");
  button.id = OVERLAY_ID;
  button.type = "button";
  button.className = OVERLAY_CLASS;
  button.setAttribute("aria-label", "Open picture-in-picture");
  button.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
      <rect x="12" y="11" width="7" height="5" rx="1" fill="currentColor"/>
    </svg>
  `;
  button.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      void triggerPiP(overlayVideo ?? findBestVideo());
    },
    { signal: getRuntimeSignal() },
  );
  button.addEventListener("mousemove", noteOverlayActivity, {
    signal: getRuntimeSignal(),
  });
  document.documentElement.appendChild(button);
  return button;
}

function getOverlay(): HTMLButtonElement {
  ensureStyle();
  if (overlay && !overlay.isConnected) overlay = null;
  overlay ??= createOverlay();
  return overlay;
}

function getToast(): HTMLDivElement {
  ensureStyle();
  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = TOAST_CLASS;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.addEventListener(
      "mouseenter",
      () => {
        if (toastTimer !== null) {
          window.clearTimeout(toastTimer);
          toastTimer = null;
        }
      },
      { signal: getRuntimeSignal() },
    );
    toast.addEventListener(
      "mouseleave",
      () => {
        if (!toastText || toastTimer !== null) return;
        scheduleToastHide(1200);
      },
      { signal: getRuntimeSignal() },
    );
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

function isCurrentSiteDisabled(): boolean {
  return isSiteDisabled(settings, window.location);
}

function clearOverlayIdleTimer(): void {
  if (overlayIdleTimer !== null) {
    window.clearTimeout(overlayIdleTimer);
    overlayIdleTimer = null;
  }
}

function hideOverlay(): void {
  overlay?.removeAttribute("data-visible");
  overlayVideo = null;
  clearOverlayIdleTimer();
}

function scheduleOverlayIdleHide(): void {
  clearOverlayIdleTimer();
  if (settings.overlayIdleHideMs <= 0) return;

  overlayIdleTimer = window.setTimeout(() => {
    hideOverlay();
  }, settings.overlayIdleHideMs);
}

function noteOverlayActivity(): void {
  if (overlay?.dataset.visible === "true") scheduleOverlayIdleHide();
}

function positionOverlay(video: HTMLVideoElement): void {
  const button = getOverlay();
  const rect = video.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    button.removeAttribute("data-visible");
    return;
  }
  const buttonSize = settings.overlaySizePx;
  const top =
    rect.top +
    (rect.height * settings.overlayPositionYPercent) / 100 -
    buttonSize / 2;
  const left =
    rect.left +
    (rect.width * settings.overlayPositionXPercent) / 100 -
    buttonSize / 2;

  const maxTop = window.innerHeight - buttonSize - 8;
  const maxLeft = window.innerWidth - buttonSize - 8;
  button.style.top = `${Math.min(maxTop, Math.max(8, top))}px`;
  button.style.left = `${Math.min(maxLeft, Math.max(8, left))}px`;
  button.style.setProperty("--pip-overlay-size", `${buttonSize}px`);
  button.style.setProperty(
    "--pip-overlay-opacity",
    String(settings.overlayOpacityPercent / 100),
  );
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

function updateSelectionTargetPositions(): void {
  selectionUpdateFrame = null;
  for (const target of selectionTargets) {
    if (!target.video.isConnected) {
      target.element.remove();
      continue;
    }
    const rect = target.video.getBoundingClientRect();
    target.element.style.left = `${Math.max(0, rect.left)}px`;
    target.element.style.top = `${Math.max(0, rect.top)}px`;
    target.element.style.width = `${Math.max(0, rect.width)}px`;
    target.element.style.height = `${Math.max(0, rect.height)}px`;
    target.element.hidden = rect.width <= 0 || rect.height <= 0;
  }
  selectionTargets = selectionTargets.filter(
    (target) => target.video.isConnected,
  );
}

function scheduleSelectionPositionUpdate(): void {
  if (selectionUpdateFrame !== null) return;
  selectionUpdateFrame = window.requestAnimationFrame(
    updateSelectionTargetPositions,
  );
}

function scheduleOverlayPositionUpdate(): void {
  if (overlayUpdateFrame !== null) return;
  overlayUpdateFrame = window.requestAnimationFrame(
    updateVisibleOverlayPosition,
  );
}

function isVideoEligibleForOverlay(video: HTMLVideoElement): boolean {
  if (isCurrentSiteDisabled()) return false;
  const minimumSeconds = settings.minimumOverlayDurationSeconds;
  if (isYouTubeThumbnailPreview(video)) {
    recordDiagnostic("overlay-skipped-youtube-thumbnail", {
      duration: video.duration,
      muted: video.muted,
    });
    return false;
  }
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

function isYouTubeThumbnailPreview(video: HTMLVideoElement): boolean {
  if (location.hostname !== "www.youtube.com") return false;
  if (location.pathname === "/watch") return false;
  return Boolean(
    video.closest(
      [
        "ytd-thumbnail",
        "ytd-rich-item-renderer",
        "ytd-video-renderer",
        "ytd-grid-video-renderer",
        "ytd-compact-video-renderer",
        "ytd-reel-item-renderer",
        "ytd-video-preview",
      ].join(","),
    ),
  );
}

function showOverlay(video: HTMLVideoElement): void {
  if (!settings.hoverOverlayEnabled || !isVideoEligibleForOverlay(video)) {
    return;
  }
  overlayVideo = video;
  positionOverlay(video);
  getOverlay().dataset.visible = "true";
  scheduleOverlayIdleHide();
}

function hideOverlaySoon(): void {
  window.setTimeout(() => {
    if (!overlay?.matches(":hover")) {
      hideOverlay();
    }
  }, 100);
}

function selectableVideos(): HTMLVideoElement[] {
  return Array.from(document.querySelectorAll("video")).filter((video) => {
    const rect = video.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function clearVideoSelection(): void {
  for (const target of selectionTargets) target.element.remove();
  selectionTargets = [];
  if (selectionUpdateFrame !== null) {
    window.cancelAnimationFrame(selectionUpdateFrame);
    selectionUpdateFrame = null;
  }
}

function startVideoSelection(): void {
  if (isCurrentSiteDisabled()) {
    showToast("PiP Anywhere is disabled on this site.");
    return;
  }

  clearVideoSelection();
  hideOverlay();
  ensureStyle();

  const videos = selectableVideos();
  if (videos.length === 0) {
    showToast("No eligible video found on this page.");
    return;
  }

  for (const video of videos) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = VIDEO_TARGET_CLASS;
    element.setAttribute("aria-label", "Open this video in picture-in-picture");
    element.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearVideoSelection();
        void triggerPiP(video);
      },
      { signal: getRuntimeSignal() },
    );
    document.documentElement.appendChild(element);
    selectionTargets.push({ video, element });
  }

  updateSelectionTargetPositions();
  showToast("Click a highlighted video to open picture-in-picture.");
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
  if (isCurrentSiteDisabled()) {
    hideOverlay();
    return;
  }
  if (overlay?.matches(":hover")) {
    noteOverlayActivity();
    return;
  }

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

function handleDocumentKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") clearVideoSelection();
}

function observeVideo(video: HTMLVideoElement): void {
  if (isCurrentSiteDisabled()) return;
  if (video.getAttribute(VIDEO_ATTRIBUTE) === "true") return;
  diagnostics.videosObserved += 1;
  video.setAttribute(VIDEO_ATTRIBUTE, "true");
  recordDiagnostic("video-observed", {
    readyState: video.readyState,
    duration: video.duration,
    disablePictureInPicture: video.disablePictureInPicture,
  });

  if (settings.unblockVideoPiP) enableVideoPiP(video);

  video.addEventListener("mouseenter", () => scheduleOverlay(video), {
    signal: getRuntimeSignal(),
  });
  video.addEventListener("mousemove", scheduleOverlayPositionUpdate, {
    signal: getRuntimeSignal(),
  });
  video.addEventListener(
    "loadedmetadata",
    () => {
      if (overlayVideo === video || pointerVideo === video) showOverlay(video);
    },
    { signal: getRuntimeSignal() },
  );
  video.addEventListener(
    "mouseleave",
    () => {
      clearHoverTimer();
      if (pointerVideo === video) pointerVideo = null;
      hideOverlaySoon();
    },
    { signal: getRuntimeSignal() },
  );
}

function observeVideos(root: ParentNode = document): void {
  if (isCurrentSiteDisabled()) return;
  for (const video of root.querySelectorAll("video")) {
    observeVideo(video);
  }
}

function dispatchUnblockerConfig(): void {
  window.dispatchEvent(
    new CustomEvent(CONFIG_EVENT, {
      detail: {
        enabled: settings.unblockVideoPiP && !isCurrentSiteDisabled(),
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
  script.src = `${api.runtime.getURL("pip-unblocker.js")}?runtime=${RUNTIME_KIND}`;
  script.onload = () => {
    script.remove();
    if (!runtimeStarted) return;
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
  if (isCurrentSiteDisabled()) return;
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
  if (isCurrentSiteDisabled()) {
    showToast("PiP Anywhere is disabled on this site.");
    return {
      ok: false,
      reason: "disabled",
      message: "Site disabled by PiP Anywhere settings.",
    } as const;
  }
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

async function startContentRuntime(): Promise<void> {
  if (runtimeStarted) return;
  runtimeStarted = true;
  runtimeAbort = new AbortController();
  const generation = ++runtimeGeneration;

  try {
    settings = await loadSettings();
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
  if (!runtimeStarted || generation !== runtimeGeneration) return;
  pruneStaleUiElements();

  if (settings.unblockVideoPiP && !isCurrentSiteDisabled())
    injectPageUnblocker();
  window.addEventListener(
    DIAGNOSTIC_EVENT,
    (event) => {
      if (!__DEV__ || !(event instanceof CustomEvent)) return;
      const type =
        typeof event.detail?.type === "string" ? event.detail.type : "unknown";
      diagnostics.pageUnblockerEvents[type] =
        (diagnostics.pageUnblockerEvents[type] ?? 0) + 1;
      recordDiagnostic("page-unblocker-event", event.detail);
    },
    { signal: getRuntimeSignal() },
  );
  observeVideos();
  document.addEventListener("mousemove", handleDocumentMouseMove, {
    capture: true,
    signal: getRuntimeSignal(),
  });
  window.addEventListener("scroll", scheduleOverlayPositionUpdate, {
    capture: true,
    signal: getRuntimeSignal(),
  });
  window.addEventListener("resize", scheduleOverlayPositionUpdate, {
    signal: getRuntimeSignal(),
  });
  window.addEventListener("scroll", scheduleSelectionPositionUpdate, {
    capture: true,
    signal: getRuntimeSignal(),
  });
  window.addEventListener("resize", scheduleSelectionPositionUpdate, {
    signal: getRuntimeSignal(),
  });
  document.addEventListener("keydown", handleDocumentKeyDown, {
    capture: true,
    signal: getRuntimeSignal(),
  });

  mutationObserver = new MutationObserver(handleMutations);
  mutationObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["disablepictureinpicture", "controlslist"],
    childList: true,
    subtree: true,
  });

  storageChangeListener = (changes, areaName) => {
    const next = changes[SETTINGS_KEY];
    if (areaName === "sync" && next) {
      settings = normalizeSettings(next.newValue);
      pruneStaleUiElements();
      scheduleOverlayPositionUpdate();
      if (isCurrentSiteDisabled()) {
        hideOverlay();
        if (pageUnblockerInjected) dispatchUnblockerConfig();
        return;
      }
      if (settings.unblockVideoPiP && !pageUnblockerInjected) {
        injectPageUnblocker();
      } else if (pageUnblockerInjected) {
        dispatchUnblockerConfig();
      }
      observeVideos();
    }
  };
  api.storage.onChanged.addListener(storageChangeListener);

  runtimeMessageListener = (message, _sender, sendResponse) => {
    if (message?.type === "ultimate-pip.select-video") {
      startVideoSelection();
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type !== "ultimate-pip.toggle") return false;
    void triggerPiP(findBestVideo()).then(sendResponse);
    return true;
  };
  api.runtime.onMessage.addListener(runtimeMessageListener);
}

function stopContentRuntime(): void {
  if (!runtimeStarted) return;
  runtimeStarted = false;
  runtimeGeneration += 1;

  if (pageUnblockerInjected) {
    window.dispatchEvent(
      new CustomEvent(CONFIG_EVENT, {
        detail: {
          enabled: false,
          debug: false,
        },
      }),
    );
  }

  runtimeAbort?.abort();
  runtimeAbort = null;
  mutationObserver?.disconnect();
  mutationObserver = null;

  if (storageChangeListener) {
    api.storage.onChanged.removeListener(storageChangeListener);
    storageChangeListener = null;
  }
  if (runtimeMessageListener) {
    api.runtime.onMessage.removeListener(runtimeMessageListener);
    runtimeMessageListener = null;
  }

  clearHoverTimer();
  clearOverlayIdleTimer();
  if (toastTimer !== null) {
    window.clearTimeout(toastTimer);
    toastTimer = null;
  }
  if (overlayUpdateFrame !== null) {
    window.cancelAnimationFrame(overlayUpdateFrame);
    overlayUpdateFrame = null;
  }
  clearVideoSelection();

  overlay?.remove();
  toast?.remove();
  document.getElementById(STYLE_ID)?.remove();
  for (const video of document.querySelectorAll(`[${VIDEO_ATTRIBUTE}]`)) {
    video.removeAttribute(VIDEO_ATTRIBUTE);
  }

  overlay = null;
  overlayVideo = null;
  toast = null;
  toastText = null;
  hoverTargetVideo = null;
  pointerVideo = null;
}

const runtimeGlobals = globalThis as unknown as Record<
  string,
  ReturnType<typeof createRuntimeCoordinator>
>;
const existingRuntime = runtimeGlobals[GLOBAL_RUNTIME_KEY];
existingRuntime?.stop();

runtimeGlobals[GLOBAL_RUNTIME_KEY] = createRuntimeCoordinator({
  isDev: __DEV__,
  startActive: () => {
    void startContentRuntime();
  },
  stopActive: stopContentRuntime,
});

runtimeGlobals[GLOBAL_RUNTIME_KEY].start();
