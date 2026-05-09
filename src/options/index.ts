import { loadSettings, saveSettings, type PipSettings } from "@/core/settings";
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

function readForm(): PipSettings {
  return {
    hoverOverlayEnabled: byId<HTMLInputElement>("hover-overlay-enabled")
      .checked,
    hoverDelayMs: Number(byId<HTMLInputElement>("hover-delay-ms").value),
    unblockVideoPiP: byId<HTMLInputElement>("unblock-video-pip").checked,
    debugLogging: byId<HTMLInputElement>("debug-logging").checked,
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
  byId<HTMLInputElement>("unblock-video-pip").checked =
    settings.unblockVideoPiP;
  byId<HTMLInputElement>("debug-logging").checked = settings.debugLogging;
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
  writeForm(await loadSettings());

  const delay = byId<HTMLInputElement>("hover-delay-ms");
  delay.addEventListener("input", () => {
    byId<HTMLOutputElement>("hover-delay-output").value = `${delay.value} ms`;
  });

  byId<HTMLFormElement>("options-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void saveSettings(readForm()).then(() => setStatus("Settings saved."));
  });

  byId<HTMLButtonElement>("reset").addEventListener("click", () => {
    void loadSettings().then(writeForm);
  });
}

void init();
