import {
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeSettings,
  saveSettings,
  type PipSettings,
} from "@/core/settings";
import { getBrowserApi } from "@/core/browser";

const COMMAND_NAME = "toggle-picture-in-picture";
const api = getBrowserApi();
let saveTimer: number | null = null;
let statusTimer: number | null = null;
let initialized = false;
let currentSettings: PipSettings = { ...DEFAULT_SETTINGS };

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing options element #${id}`);
  return element as T;
}

function manifestShortcut(): string {
  const manifest = api.runtime.getManifest();
  const command = manifest.commands?.[COMMAND_NAME];
  return command?.suggested_key?.default ?? "Alt+Shift+P";
}

async function updateShortcutText(): Promise<void> {
  const shortcut = byId<HTMLInputElement>("shortcut");
  try {
    const commands = await api.commands.getAll();
    const command = commands.find((item) => item.name === COMMAND_NAME);
    shortcut.value = command?.shortcut || "Not set";
  } catch {
    shortcut.value = manifestShortcut();
  }
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
    void updateShortcutText();
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
    overlayPositionXPercent: Number(
      byId<HTMLInputElement>("overlay-position-x").value,
    ),
    overlayPositionYPercent: Number(
      byId<HTMLInputElement>("overlay-position-y").value,
    ),
    overlayOpacityPercent: Number(
      byId<HTMLInputElement>("overlay-opacity").value,
    ),
    overlaySizePx: Number(byId<HTMLInputElement>("overlay-size").value),
    overlayIdleHideMs: Number(
      byId<HTMLInputElement>("overlay-idle-hide").value,
    ),
    unblockVideoPiP: byId<HTMLInputElement>("unblock-video-pip").checked,
    disabledSitePatterns: byId<HTMLTextAreaElement>("disabled-site-patterns")
      .value.split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
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
  byId<HTMLInputElement>("overlay-position-x").value = String(
    settings.overlayPositionXPercent,
  );
  byId<HTMLInputElement>("overlay-position-y").value = String(
    settings.overlayPositionYPercent,
  );
  byId<HTMLInputElement>("overlay-opacity").value = String(
    settings.overlayOpacityPercent,
  );
  byId<HTMLOutputElement>("overlay-opacity-output").value =
    `${settings.overlayOpacityPercent}%`;
  byId<HTMLInputElement>("overlay-size").value = String(settings.overlaySizePx);
  byId<HTMLOutputElement>("overlay-size-output").value =
    `${settings.overlaySizePx}px`;
  byId<HTMLInputElement>("overlay-idle-hide").value = String(
    settings.overlayIdleHideMs,
  );
  byId<HTMLOutputElement>("overlay-idle-hide-output").value =
    settings.overlayIdleHideMs === 0
      ? "Off"
      : `${settings.overlayIdleHideMs} ms`;
  byId<HTMLTextAreaElement>("disabled-site-patterns").value =
    settings.disabledSitePatterns.join("\n");
  byId<HTMLInputElement>("unblock-video-pip").checked =
    settings.unblockVideoPiP;
  if (__DEV__) {
    byId<HTMLInputElement>("debug-logging").checked = settings.debugLogging;
  }
  syncPositionPicker(settings);
  currentSettings = normalizeSettings(settings);
}

function setStatus(text: string): void {
  const status = byId<HTMLElement>("status");
  status.textContent = text;

  if (statusTimer !== null) {
    window.clearTimeout(statusTimer);
  }
  statusTimer = window.setTimeout(() => {
    if (status.textContent === text) status.textContent = "";
    statusTimer = null;
  }, 2000);
}

function initStatusHover(): void {
  const status = byId<HTMLElement>("status");
  status.addEventListener("mouseenter", () => {
    if (statusTimer !== null) {
      window.clearTimeout(statusTimer);
      statusTimer = null;
    }
  });
  status.addEventListener("mouseleave", () => {
    if (!status.textContent || statusTimer !== null) return;
    const text = status.textContent;
    statusTimer = window.setTimeout(() => {
      if (status.textContent === text) status.textContent = "";
      statusTimer = null;
    }, 1200);
  });
}

function scheduleSave(): void {
  if (!initialized) return;
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
  }
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    currentSettings = normalizeSettings(readForm());
    void saveSettings(currentSettings).then(() => setStatus("Settings saved."));
  }, 250);
}

function bindAutoSave(): void {
  const form = byId<HTMLFormElement>("options-form");
  form.addEventListener("input", scheduleSave);
  form.addEventListener("change", scheduleSave);
}

function syncPositionPicker(settings: PipSettings): void {
  const handle = byId<HTMLButtonElement>("overlay-position-handle");
  handle.style.left = `${settings.overlayPositionXPercent}%`;
  handle.style.top = `${settings.overlayPositionYPercent}%`;
  handle.style.width = `${settings.overlaySizePx}px`;
  handle.style.height = `${settings.overlaySizePx}px`;
  handle.style.opacity = String(settings.overlayOpacityPercent / 100);
  byId<HTMLOutputElement>("overlay-position-x-output").value =
    `X ${settings.overlayPositionXPercent}%`;
  byId<HTMLOutputElement>("overlay-position-y-output").value =
    `Y ${settings.overlayPositionYPercent}%`;
}

function setPositionFromPointer(event: PointerEvent): void {
  const picker = byId<HTMLElement>("overlay-position-picker");
  const rect = picker.getBoundingClientRect();
  const x = Math.round(((event.clientX - rect.left) / rect.width) * 100);
  const y = Math.round(((event.clientY - rect.top) / rect.height) * 100);
  byId<HTMLInputElement>("overlay-position-x").value = String(
    Math.min(100, Math.max(0, x)),
  );
  byId<HTMLInputElement>("overlay-position-y").value = String(
    Math.min(100, Math.max(0, y)),
  );
  syncPositionPicker(normalizeSettings(readForm()));
  scheduleSave();
}

function initPositionPicker(): void {
  const picker = byId<HTMLElement>("overlay-position-picker");
  const handle = byId<HTMLButtonElement>("overlay-position-handle");
  const xInput = document.createElement("input");
  xInput.id = "overlay-position-x";
  xInput.type = "hidden";
  const yInput = document.createElement("input");
  yInput.id = "overlay-position-y";
  yInput.type = "hidden";
  picker.append(xInput, yInput);

  let dragging = false;
  picker.addEventListener("pointerdown", (event) => {
    dragging = true;
    picker.setPointerCapture(event.pointerId);
    setPositionFromPointer(event);
  });
  picker.addEventListener("pointermove", (event) => {
    if (dragging) setPositionFromPointer(event);
  });
  picker.addEventListener("pointerup", (event) => {
    dragging = false;
    picker.releasePointerCapture(event.pointerId);
  });
  picker.addEventListener("pointercancel", () => {
    dragging = false;
  });
  handle.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 10 : 2;
    const settings = normalizeSettings(readForm());
    if (event.key === "ArrowLeft") settings.overlayPositionXPercent -= step;
    else if (event.key === "ArrowRight")
      settings.overlayPositionXPercent += step;
    else if (event.key === "ArrowUp") settings.overlayPositionYPercent -= step;
    else if (event.key === "ArrowDown")
      settings.overlayPositionYPercent += step;
    else return;

    event.preventDefault();
    writeForm(normalizeSettings(settings));
    scheduleSave();
  });
}

function exportSettings(): void {
  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    settings: normalizeSettings(readForm()),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "pip-anywhere-settings.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importSettings(file: File): Promise<void> {
  const text = await file.text();
  const parsed = JSON.parse(text) as { settings?: unknown };
  const settings = normalizeSettings(parsed.settings ?? parsed);
  writeForm(settings);
  await saveSettings(settings);
  setStatus("Settings imported.");
}

async function init(): Promise<void> {
  await updateShortcutText();
  initShortcutButton();
  initStatusHover();
  initPositionPicker();
  byId<HTMLElement>("advanced-section").hidden = !__DEV__;
  writeForm(await loadSettings());
  bindAutoSave();
  initialized = true;

  const delay = byId<HTMLInputElement>("hover-delay-ms");
  delay.addEventListener("input", () => {
    byId<HTMLOutputElement>("hover-delay-output").value = `${delay.value} ms`;
  });

  const minimumDuration = byId<HTMLInputElement>("minimum-overlay-duration");
  minimumDuration.addEventListener("input", () => {
    byId<HTMLOutputElement>("minimum-overlay-duration-output").value =
      `${minimumDuration.value} s`;
  });

  const size = byId<HTMLInputElement>("overlay-size");
  size.addEventListener("input", () => {
    byId<HTMLOutputElement>("overlay-size-output").value = `${size.value}px`;
    syncPositionPicker(normalizeSettings(readForm()));
  });

  const opacity = byId<HTMLInputElement>("overlay-opacity");
  opacity.addEventListener("input", () => {
    byId<HTMLOutputElement>("overlay-opacity-output").value =
      `${opacity.value}%`;
    syncPositionPicker(normalizeSettings(readForm()));
  });

  const idleHide = byId<HTMLInputElement>("overlay-idle-hide");
  idleHide.addEventListener("input", () => {
    byId<HTMLOutputElement>("overlay-idle-hide-output").value =
      idleHide.value === "0" ? "Off" : `${idleHide.value} ms`;
  });

  byId<HTMLFormElement>("options-form").addEventListener("submit", (event) => {
    event.preventDefault();
  });

  byId<HTMLButtonElement>("reset").addEventListener("click", () => {
    writeForm(DEFAULT_SETTINGS);
    void saveSettings(DEFAULT_SETTINGS).then(() =>
      setStatus("Default settings restored."),
    );
  });

  byId<HTMLButtonElement>("export-settings").addEventListener(
    "click",
    exportSettings,
  );
  byId<HTMLInputElement>("import-settings").addEventListener(
    "change",
    (event) => {
      const input = event.currentTarget as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      void importSettings(file)
        .catch(() => setStatus("Settings import failed."))
        .finally(() => {
          input.value = "";
        });
    },
  );
}

void init();
