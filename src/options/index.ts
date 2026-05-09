import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type PipSettings,
} from "@/core/settings";
import { getBrowserApi } from "@/core/browser";

const COMMAND_NAME = "toggle-picture-in-picture";
const api = getBrowserApi();

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing options element #${id}`);
  return element as T;
}

function updateShortcutText(): void {
  const shortcut = byId<HTMLInputElement>("shortcut");
  const manifest = api.runtime.getManifest();
  const command = manifest.commands?.[COMMAND_NAME];
  const suggested = command?.suggested_key?.default ?? "Alt+Shift+P";
  shortcut.value = suggested;
}

function shortcutManagementUrl(): string | null {
  if (__BROWSER__ === "chrome") return "chrome://extensions/shortcuts";
  if (__BROWSER__ === "edge") return "edge://extensions/shortcuts";
  if (__BROWSER__ === "firefox") return "about:addons";
  return null;
}

function initShortcutButton(): void {
  const button = byId<HTMLButtonElement>("manage-shortcut");
  const url = shortcutManagementUrl();
  if (!url) {
    button.hidden = true;
    return;
  }

  button.addEventListener("click", () => {
    void api.tabs.create({ url });
  });
}

function readForm(): PipSettings {
  return {
    hoverOverlayEnabled: byId<HTMLInputElement>("hover-overlay-enabled")
      .checked,
    hoverDelayMs: Number(byId<HTMLInputElement>("hover-delay-ms").value),
    minimumOverlayDurationSeconds: Number(
      byId<HTMLInputElement>("minimum-overlay-duration").value,
    ),
    unblockVideoPiP: byId<HTMLInputElement>("unblock-video-pip").checked,
    debugLogging: __DEV__
      ? byId<HTMLInputElement>("debug-logging").checked
      : false,
  };
}

function writeForm(settings: PipSettings): void {
  byId<HTMLInputElement>("hover-overlay-enabled").checked =
    settings.hoverOverlayEnabled;
  byId<HTMLInputElement>("hover-delay-ms").value = String(
    settings.hoverDelayMs,
  );
  byId<HTMLOutputElement>("hover-delay-output").value =
    `${settings.hoverDelayMs} ms`;
  byId<HTMLInputElement>("minimum-overlay-duration").value = String(
    settings.minimumOverlayDurationSeconds,
  );
  byId<HTMLOutputElement>("minimum-overlay-duration-output").value =
    `${settings.minimumOverlayDurationSeconds} s`;
  byId<HTMLInputElement>("unblock-video-pip").checked =
    settings.unblockVideoPiP;
  if (__DEV__) {
    byId<HTMLInputElement>("debug-logging").checked = settings.debugLogging;
  }
}

function setStatus(text: string): void {
  const status = byId<HTMLElement>("status");
  status.textContent = text;
  window.setTimeout(() => {
    if (status.textContent === text) status.textContent = "";
  }, 2000);
}

async function init(): Promise<void> {
  updateShortcutText();
  initShortcutButton();
  byId<HTMLElement>("advanced-section").hidden = !__DEV__;
  writeForm(await loadSettings());

  const delay = byId<HTMLInputElement>("hover-delay-ms");
  delay.addEventListener("input", () => {
    byId<HTMLOutputElement>("hover-delay-output").value = `${delay.value} ms`;
  });

  const minimumDuration = byId<HTMLInputElement>("minimum-overlay-duration");
  minimumDuration.addEventListener("input", () => {
    byId<HTMLOutputElement>("minimum-overlay-duration-output").value =
      `${minimumDuration.value} s`;
  });

  byId<HTMLFormElement>("options-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void saveSettings(readForm()).then(() => setStatus("Settings saved."));
  });

  byId<HTMLButtonElement>("reset").addEventListener("click", () => {
    writeForm(DEFAULT_SETTINGS);
    void saveSettings(DEFAULT_SETTINGS).then(() =>
      setStatus("Default settings restored."),
    );
  });
}

void init();
