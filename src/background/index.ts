import { getBrowserApi } from "@/core/browser";
import { ensureDefaultSettings } from "@/core/settings";

const api = getBrowserApi();
const TOGGLE_MESSAGE = { type: "ultimate-pip.toggle" };
const SELECT_MESSAGE = { type: "ultimate-pip.select-video" };
const UNSCRIPTABLE_URL_PATTERN =
  /^(about|chrome|chrome-extension|edge|moz-extension):/i;

interface FrameVideoCandidate {
  hasVideo: boolean;
  score: number;
}

interface DirectPipResult {
  ok: boolean;
  reason?:
    | "no-video"
    | "unsupported"
    | "disabled"
    | "not-ready"
    | "request-failed";
  message?: string;
  score: number;
}

function scoreVideosInFrame(): FrameVideoCandidate {
  const videos = Array.from(document.querySelectorAll("video"));
  if (videos.length === 0) return { hasVideo: false, score: 0 };

  let bestScore = 0;
  for (const video of videos) {
    const rect = video.getBoundingClientRect();
    const visibleArea = Math.max(0, rect.width) * Math.max(0, rect.height);
    const isPlaying = !video.paused && !video.ended;
    const mutedPenalty = video.muted ? -8_000 : 0;
    const hasMetadata = video.readyState >= HTMLMediaElement.HAVE_METADATA;
    const hasCurrentData =
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

    const score =
      (isPlaying ? 10_000 : 0) +
      mutedPenalty +
      (hasCurrentData ? 2_000 : hasMetadata ? 1_000 : 0) +
      Math.min(visibleArea, 1_000_000) / 1_000;

    bestScore = Math.max(bestScore, score);
  }

  return { hasVideo: true, score: bestScore };
}

async function directTogglePiPInFrame(): Promise<DirectPipResult> {
  const localHotkeyHandledAt = (globalThis as Record<string, unknown>)[
    "__pipAnywhereLastLocalHotkeyAt"
  ];
  if (
    typeof localHotkeyHandledAt === "number" &&
    Date.now() - localHotkeyHandledAt < 1200
  ) {
    return { ok: true, score: Number.MAX_SAFE_INTEGER };
  }

  function scoreVideo(video: HTMLVideoElement): number {
    const rect = video.getBoundingClientRect();
    const visibleArea = Math.max(0, rect.width) * Math.max(0, rect.height);
    const isPlaying = !video.paused && !video.ended;
    const mutedPenalty = video.muted ? -8_000 : 0;
    const hasMetadata = video.readyState >= HTMLMediaElement.HAVE_METADATA;
    const hasCurrentData =
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

    return (
      (isPlaying ? 10_000 : 0) +
      mutedPenalty +
      (hasCurrentData ? 2_000 : hasMetadata ? 1_000 : 0) +
      Math.min(visibleArea, 1_000_000) / 1_000
    );
  }

  const videos = Array.from(document.querySelectorAll("video"));
  const scored = videos
    .map((video) => ({ video, score: scoreVideo(video) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return { ok: false, reason: "no-video", score: 0 };

  const { video, score } = best;
  if (!document.pictureInPictureEnabled) {
    return { ok: false, reason: "unsupported", score };
  }

  video.disablePictureInPicture = false;
  video.removeAttribute("disablepictureinpicture");
  video.removeAttribute("controlslist");

  if (video.disablePictureInPicture) {
    return { ok: false, reason: "disabled", score };
  }
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
    return { ok: false, reason: "not-ready", score };
  }

  try {
    if (document.pictureInPictureElement === video) {
      await document.exitPictureInPicture();
    } else {
      await video.requestPictureInPicture();
    }
    return { ok: true, score };
  } catch (error) {
    return {
      ok: false,
      reason: "request-failed",
      message: error instanceof Error ? error.message : String(error),
      score,
    };
  }
}

async function findBestFrameId(tabId: number): Promise<number | undefined> {
  const results = await api.scripting.executeScript<[], FrameVideoCandidate>({
    target: { tabId, allFrames: true },
    func: scoreVideosInFrame,
  });

  const best = results
    .filter((result) => result.result?.hasVideo)
    .sort((a, b) => (b.result?.score ?? 0) - (a.result?.score ?? 0))[0];

  return best?.frameId;
}

async function directToggleInBestFrame(tabId: number): Promise<boolean> {
  const results = (await api.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: directTogglePiPInFrame,
  })) as chrome.scripting.InjectionResult<DirectPipResult>[];

  return results.some((result) => result.result?.ok);
}

async function sendToggleToFrame(
  tabId: number,
  frameId?: number,
): Promise<void> {
  if (frameId === undefined) {
    await api.tabs.sendMessage(tabId, TOGGLE_MESSAGE);
    return;
  }
  await api.tabs.sendMessage(tabId, TOGGLE_MESSAGE, { frameId });
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToggleToTab(tab?: chrome.tabs.Tab): Promise<void> {
  tab ??= await getActiveTab();
  if (!tab?.id) return;

  if (await directToggleInBestFrame(tab.id).catch(() => false)) {
    return;
  }

  const frameId = await findBestFrameId(tab.id).catch(() => undefined);

  try {
    await sendToggleToFrame(tab.id, frameId);
  } catch {
    try {
      await api.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["content.js"],
      });
      await sendToggleToFrame(tab.id, frameId);
    } catch {
      // Pages like browser internals and extension stores cannot be scripted.
    }
  }
}

async function sendSelectToTab(tab?: chrome.tabs.Tab): Promise<void> {
  tab ??= await getActiveTab();
  if (!tab?.id) return;

  try {
    await api.tabs.sendMessage(tab.id, SELECT_MESSAGE);
  } catch {
    try {
      await api.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["content.js"],
      });
      await api.tabs.sendMessage(tab.id, SELECT_MESSAGE);
    } catch {
      // Pages like browser internals and extension stores cannot be scripted.
    }
  }
}

function isScriptableTab(tab: chrome.tabs.Tab): tab is chrome.tabs.Tab & {
  id: number;
} {
  if (typeof tab.id !== "number") return false;
  if (!tab.url) return true;
  return !UNSCRIPTABLE_URL_PATTERN.test(tab.url);
}

async function injectContentIntoTab(tabId: number): Promise<void> {
  await api.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["content.js"],
  });
}

async function injectContentIntoOpenTabs(): Promise<void> {
  const tabs = await api.tabs.query({});
  await Promise.allSettled(
    tabs.filter(isScriptableTab).map((tab) => injectContentIntoTab(tab.id)),
  );
}

api.runtime.onInstalled.addListener((details) => {
  void ensureDefaultSettings();
  void injectContentIntoOpenTabs();
  if (details.reason === "install") {
    void api.runtime.openOptionsPage();
  }
});

api.runtime.onStartup.addListener(() => {
  void ensureDefaultSettings();
  void injectContentIntoOpenTabs();
});

api.commands.onCommand.addListener((command, tab) => {
  if (command !== "toggle-picture-in-picture") return;
  void sendToggleToTab(tab);
});

api.action.onClicked.addListener((tab) => {
  void sendSelectToTab(tab);
});
