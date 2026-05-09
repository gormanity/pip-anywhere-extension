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
const STYLE_ID = "ultimate-pip-style";
const VIDEO_ATTRIBUTE = "data-ultimate-pip-observed";
const INJECTED_SCRIPT_ID = "ultimate-pip-unblocker";
const CONFIG_EVENT = "ultimate-pip.configure";

let settings: PipSettings = { ...DEFAULT_SETTINGS };
let overlay: HTMLButtonElement | null = null;
let overlayVideo: HTMLVideoElement | null = null;
let hoverTimer: number | null = null;
let pageUnblockerInjected = false;
const api = getBrowserApi();

function log(...args: unknown[]): void {
  if (settings.debugLogging) {
    console.debug("[ultimate-pip]", ...args);
  }
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

function positionOverlay(video: HTMLVideoElement): void {
  const button = getOverlay();
  const rect = video.getBoundingClientRect();
  const top = Math.max(8, rect.top + 12);
  const left = Math.max(8, rect.right - 54);
  button.style.top = `${top}px`;
  button.style.left = `${left}px`;
}

function showOverlay(video: HTMLVideoElement): void {
  if (!settings.hoverOverlayEnabled) return;
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
}

function scheduleOverlay(video: HTMLVideoElement): void {
  clearHoverTimer();
  hoverTimer = window.setTimeout(
    () => showOverlay(video),
    settings.hoverDelayMs,
  );
}

function observeVideo(video: HTMLVideoElement): void {
  if (video.dataset.ultimatePipObserved === "true") return;
  video.dataset.ultimatePipObserved = "true";
  video.setAttribute(VIDEO_ATTRIBUTE, "true");

  if (settings.unblockVideoPiP) enableVideoPiP(video);

  video.addEventListener("mouseenter", () => scheduleOverlay(video));
  video.addEventListener("mouseleave", () => {
    clearHoverTimer();
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
  const script = document.createElement("script");
  script.id = INJECTED_SCRIPT_ID;
  script.src = api.runtime.getURL("pip-unblocker.js");
  script.onload = () => {
    script.remove();
    dispatchUnblockerConfig();
  };
  script.onerror = () => {
    pageUnblockerInjected = false;
    log("Failed to inject page-world PiP unblocker");
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
  const result = await togglePictureInPicture(video);
  if (!result.ok) log("PiP request failed", result);
  return result;
}

async function init(): Promise<void> {
  try {
    settings = await loadSettings();
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }

  if (settings.unblockVideoPiP) injectPageUnblocker();
  observeVideos();
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
