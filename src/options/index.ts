import {
  DEFAULT_SETTINGS,
  OVERLAY_CORNERS,
  loadSettings,
  normalizeOverlayCorner,
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
    overlayCorner: normalizeOverlayCorner(
      byId<HTMLSelectElement>("overlay-corner").value,
    ),
    overlayOffsetX: Number(byId<HTMLInputElement>("overlay-offset-x").value),
    overlayOffsetY: Number(byId<HTMLInputElement>("overlay-offset-y").value),
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
  byId<HTMLSelectElement>("overlay-corner").value = settings.overlayCorner;
  byId<HTMLInputElement>("overlay-offset-x").value = String(
    settings.overlayOffsetX,
  );
  byId<HTMLOutputElement>("overlay-offset-x-output").value =
    `${settings.overlayOffsetX} px`;
  byId<HTMLInputElement>("overlay-offset-y").value = String(
    settings.overlayOffsetY,
  );
  byId<HTMLOutputElement>("overlay-offset-y-output").value =
    `${settings.overlayOffsetY} px`;
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
  for (const corner of OVERLAY_CORNERS) {
    const option = document.createElement("option");
    option.value = corner;
    option.textContent = corner
      .split("-")
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(" ");
    byId<HTMLSelectElement>("overlay-corner").appendChild(option);
  }
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

  const offsetX = byId<HTMLInputElement>("overlay-offset-x");
  offsetX.addEventListener("input", () => {
    byId<HTMLOutputElement>("overlay-offset-x-output").value =
      `${offsetX.value} px`;
  });

  const offsetY = byId<HTMLInputElement>("overlay-offset-y");
  offsetY.addEventListener("input", () => {
    byId<HTMLOutputElement>("overlay-offset-y-output").value =
      `${offsetY.value} px`;
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
