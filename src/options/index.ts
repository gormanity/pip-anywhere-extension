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
let editingSiteRuleIndex: number | null = null;

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
    disabledSitePatterns: readSiteRules(),
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
  renderSiteRules(settings.disabledSitePatterns);
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
  form.addEventListener("input", (event) => {
    if (event.target === byId<HTMLInputElement>("site-rule-input")) return;
    scheduleSave();
  });
  form.addEventListener("change", scheduleSave);
}

function readSiteRules(): string[] {
  return Array.from(
    byId<HTMLElement>("site-rule-list").querySelectorAll<HTMLElement>(
      ".site-rule-item",
    ),
    (element) => element.dataset.rule ?? "",
  ).filter(Boolean);
}

function renderSiteRules(patterns: string[]): void {
  const list = byId<HTMLElement>("site-rule-list");
  const normalized = normalizeSettings({
    ...currentSettings,
    disabledSitePatterns: patterns,
  }).disabledSitePatterns;
  list.replaceChildren();

  if (normalized.length === 0) {
    const empty = document.createElement("div");
    empty.className = "site-rule-empty";
    empty.textContent = "No disabled sites.";
    list.append(empty);
    resetSiteRuleDraft();
    return;
  }

  normalized.forEach((pattern, index) => {
    const item = document.createElement("div");
    item.className = "site-rule-item";
    item.dataset.rule = pattern;

    const label = document.createElement("span");
    label.className = "site-rule-pattern";
    label.textContent = pattern;
    label.title = pattern;

    const edit = document.createElement("button");
    edit.className = "secondary-button icon-button site-rule-edit";
    edit.type = "button";
    edit.textContent = "Edit";
    edit.title = `Edit ${pattern}`;
    edit.setAttribute("aria-label", `Edit ${pattern}`);
    edit.addEventListener("click", () => startEditingSiteRule(index, pattern));

    const remove = document.createElement("button");
    remove.className = "secondary-button icon-button";
    remove.type = "button";
    remove.textContent = "X";
    remove.title = `Remove ${pattern}`;
    remove.setAttribute("aria-label", `Remove ${pattern}`);
    remove.addEventListener("click", () => removeSiteRule(index));

    item.append(label, edit, remove);
    list.append(item);
  });
  resetSiteRuleDraft();
}

function initSiteRules(): void {
  const input = byId<HTMLInputElement>("site-rule-input");
  byId<HTMLButtonElement>("add-site-rule").addEventListener("click", () => {
    commitSiteRuleDraft();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitSiteRuleDraft();
    }
    if (event.key === "Escape") {
      resetSiteRuleDraft();
    }
  });
  input.addEventListener("input", () => {
    setSiteRuleError("");
  });
}

function startEditingSiteRule(index: number, pattern: string): void {
  editingSiteRuleIndex = index;
  const input = byId<HTMLInputElement>("site-rule-input");
  input.value = pattern;
  input.focus();
  input.select();
  const button = byId<HTMLButtonElement>("add-site-rule");
  button.textContent = "✓";
  button.title = "Save site rule";
  button.setAttribute("aria-label", "Save site rule");
  setSiteRuleError("");
}

function commitSiteRuleDraft(): void {
  const input = byId<HTMLInputElement>("site-rule-input");
  const pattern = input.value.trim();
  if (!pattern) {
    setSiteRuleError("Enter a hostname or /regex/ rule.");
    return;
  }

  const validation = validateSiteRule(pattern);
  if (!validation.ok) {
    setSiteRuleError(validation.message);
    return;
  }

  const rules = readSiteRules();
  if (editingSiteRuleIndex === null) {
    rules.push(pattern);
  } else {
    rules[editingSiteRuleIndex] = pattern;
  }
  renderSiteRules(rules);
  scheduleSave();
}

function removeSiteRule(index: number): void {
  const rules = readSiteRules();
  rules.splice(index, 1);
  renderSiteRules(rules);
  scheduleSave();
}

function resetSiteRuleDraft(): void {
  editingSiteRuleIndex = null;
  const input = byId<HTMLInputElement>("site-rule-input");
  input.value = "";
  const button = byId<HTMLButtonElement>("add-site-rule");
  button.textContent = "+";
  button.title = "Add site rule";
  button.setAttribute("aria-label", "Add site rule");
  setSiteRuleError("");
}

function setSiteRuleError(message: string): void {
  byId<HTMLElement>("site-rule-error").textContent = message;
}

function validateSiteRule(
  pattern: string,
): { ok: true } | { ok: false; message: string } {
  if (!isRegexSiteRule(pattern)) return { ok: true };

  const lastSlash = pattern.lastIndexOf("/");
  const source = pattern.slice(1, lastSlash);
  const flags = pattern.slice(lastSlash + 1);
  try {
    new RegExp(source, flags);
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Regex rules must use valid /pattern/flags syntax.",
    };
  }
}

function isRegexSiteRule(pattern: string): boolean {
  return pattern.startsWith("/") && pattern.lastIndexOf("/") > 0;
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
  initSiteRules();
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
