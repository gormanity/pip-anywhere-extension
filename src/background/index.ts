import { getBrowserApi } from "@/core/browser";
import { ensureDefaultSettings } from "@/core/settings";

const api = getBrowserApi();
const TOGGLE_MESSAGE = { type: "ultimate-pip.toggle" };

interface FrameVideoCandidate {
  hasVideo: boolean;
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
    const hasMetadata = video.readyState >= HTMLMediaElement.HAVE_METADATA;
    const hasCurrentData =
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

    const score =
      (isPlaying ? 10_000 : 0) +
      (hasCurrentData ? 2_000 : hasMetadata ? 1_000 : 0) +
      Math.min(visibleArea, 1_000_000) / 1_000;

    bestScore = Math.max(bestScore, score);
  }

  return { hasVideo: true, score: bestScore };
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

async function sendToggleToActiveTab(): Promise<void> {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

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

api.runtime.onInstalled.addListener(() => {
  void ensureDefaultSettings();
});

api.runtime.onStartup.addListener(() => {
  void ensureDefaultSettings();
});

api.commands.onCommand.addListener((command) => {
  if (command !== "toggle-picture-in-picture") return;
  void sendToggleToActiveTab();
});

api.action.onClicked.addListener(() => {
  void sendToggleToActiveTab();
});
