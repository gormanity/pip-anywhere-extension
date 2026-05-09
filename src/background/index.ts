import { getBrowserApi } from "@/core/browser";
import { ensureDefaultSettings } from "@/core/settings";

const api = getBrowserApi();

async function sendToggleToActiveTab(): Promise<void> {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await api.tabs.sendMessage(tab.id, { type: "ultimate-pip.toggle" });
  } catch {
    try {
      await api.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["content.js"],
      });
      await api.tabs.sendMessage(tab.id, { type: "ultimate-pip.toggle" });
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
