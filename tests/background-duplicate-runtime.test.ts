import { beforeEach, describe, expect, it, vi } from "vitest";
import { installDuplicateRuntime } from "@/background/duplicate-runtime";
import {
  CHROMIUM_DEV_EXTENSION_ID,
  CHROMIUM_LOCAL_PROD_EXTENSION_ID,
  DEV_BUILD_PRESENCE_MESSAGE,
  DEV_BUILD_PRESENCE_REQUEST_MESSAGE,
  DUPLICATE_STATUS_REQUEST_MESSAGE,
  RUNTIME_STATE_MESSAGE,
} from "@/core/runtime-messages";

describe("background duplicate runtime", () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(() => {
    vi.useFakeTimers();
    harness = createHarness();
  });

  it("dev announces presence to local prod", () => {
    installDuplicateRuntime({ api: harness.api, isDev: true });

    expect(harness.sentMessages).toContainEqual({
      extensionId: CHROMIUM_LOCAL_PROD_EXTENSION_ID,
      message: { type: DEV_BUILD_PRESENCE_MESSAGE },
    });
  });

  it("prod probes dev before reporting status", async () => {
    harness.externalDevResponds = true;
    installDuplicateRuntime({ api: harness.api, isDev: false });
    harness.sentMessages = [];

    await expect(harness.requestDuplicateStatus()).resolves.toEqual({
      ok: true,
      data: { duplicateDetected: true },
    });
    expect(harness.sentMessages).toContainEqual({
      extensionId: CHROMIUM_DEV_EXTENSION_ID,
      message: { type: DEV_BUILD_PRESENCE_REQUEST_MESSAGE },
    });
  });

  it("prod reports enabled when no dev build exists", async () => {
    installDuplicateRuntime({ api: harness.api, isDev: false });

    await expect(harness.requestDuplicateStatus()).resolves.toEqual({
      ok: true,
      data: { duplicateDetected: false },
    });
    expect(harness.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" });
  });

  it("prod marks duplicate-disabled when dev responds or sends heartbeat", async () => {
    installDuplicateRuntime({ api: harness.api, isDev: false });

    harness.externalMessageListener(
      { type: DEV_BUILD_PRESENCE_MESSAGE },
      { id: CHROMIUM_DEV_EXTENSION_ID },
      () => {},
    );
    await expect(harness.requestDuplicateStatus()).resolves.toEqual({
      ok: true,
      data: { duplicateDetected: true },
    });
    expect(harness.action.setBadgeText).toHaveBeenLastCalledWith({
      text: "OFF",
    });
    expect(harness.action.setPopup).toHaveBeenLastCalledWith({
      popup: "popup.html",
    });
  });

  it("prod clears duplicate-disabled after the dev heartbeat becomes stale", async () => {
    installDuplicateRuntime({ api: harness.api, isDev: false });

    harness.externalMessageListener(
      { type: DEV_BUILD_PRESENCE_MESSAGE },
      { id: CHROMIUM_DEV_EXTENSION_ID },
      () => {},
    );
    expect(harness.action.setBadgeText).toHaveBeenLastCalledWith({
      text: "OFF",
    });

    vi.advanceTimersByTime(3499);
    expect(harness.action.setBadgeText).toHaveBeenLastCalledWith({
      text: "OFF",
    });

    vi.advanceTimersByTime(1);
    expect(harness.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" });
    expect(harness.action.setPopup).toHaveBeenLastCalledWith({ popup: "" });
  });

  it("tracks prod content frame suspension state", async () => {
    installDuplicateRuntime({ api: harness.api, isDev: false });

    harness.messageListener(
      { type: RUNTIME_STATE_MESSAGE, disabledByDuplicate: true },
      { tab: { id: 7 } as chrome.tabs.Tab, frameId: 0 },
      () => {},
    );

    await expect(harness.requestDuplicateStatus()).resolves.toEqual({
      ok: true,
      data: { duplicateDetected: true },
    });
  });
});

function createHarness() {
  type MessageListener = Parameters<
    typeof chrome.runtime.onMessage.addListener
  >[0];
  type ExternalMessageListener = Parameters<
    typeof chrome.runtime.onMessageExternal.addListener
  >[0];

  let messageListener: MessageListener = () => false;
  let externalMessageListener: ExternalMessageListener = () => false;
  let tabRemovedListener: Parameters<
    typeof chrome.tabs.onRemoved.addListener
  >[0] = () => {};
  let tabUpdatedListener: Parameters<
    typeof chrome.tabs.onUpdated.addListener
  >[0] = () => {};
  let lastError: chrome.runtime.LastError | undefined;
  let externalDevResponds = false;
  let sentMessages: Array<{ extensionId?: string; message: unknown }> = [];

  const action = {
    setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
    setBadgeText: vi.fn(() => Promise.resolve()),
    setIcon: vi.fn(() => Promise.resolve()),
    setPopup: vi.fn(() => Promise.resolve()),
    setTitle: vi.fn(() => Promise.resolve()),
  };

  const api = {
    action,
    runtime: {
      get lastError() {
        return lastError;
      },
      onMessage: {
        addListener: vi.fn((listener) => {
          messageListener = listener;
        }),
      },
      onMessageExternal: {
        addListener: vi.fn((listener) => {
          externalMessageListener = listener;
        }),
      },
      sendMessage: vi.fn((...args: unknown[]) => {
        if (typeof args[0] === "string") {
          const [extensionId, message, callback] = args as [
            string,
            unknown,
            ((response?: { ok?: boolean }) => void) | undefined,
          ];
          sentMessages.push({ extensionId, message });
          lastError = externalDevResponds ? undefined : { message: "missing" };
          callback?.(externalDevResponds ? { ok: true } : undefined);
          lastError = undefined;
          return;
        }

        const [message, callback] = args as [unknown, (() => void) | undefined];
        sentMessages.push({ message });
        callback?.();
      }),
    },
    tabs: {
      onRemoved: {
        addListener: vi.fn((listener) => {
          tabRemovedListener = listener;
        }),
      },
      onUpdated: {
        addListener: vi.fn((listener) => {
          tabUpdatedListener = listener;
        }),
      },
      query: vi.fn((_, callback) => callback([])),
      sendMessage: vi.fn(),
    },
  };

  async function requestDuplicateStatus() {
    return new Promise((resolve) => {
      messageListener(
        { type: DUPLICATE_STATUS_REQUEST_MESSAGE },
        {},
        (response) => resolve(response),
      );
      vi.advanceTimersByTime(0);
    });
  }

  return {
    action,
    api,
    get externalDevResponds() {
      return externalDevResponds;
    },
    set externalDevResponds(value: boolean) {
      externalDevResponds = value;
    },
    get externalMessageListener() {
      return externalMessageListener;
    },
    get messageListener() {
      return messageListener;
    },
    requestDuplicateStatus,
    get sentMessages() {
      return sentMessages;
    },
    set sentMessages(value) {
      sentMessages = value;
    },
    tabRemovedListener,
    tabUpdatedListener,
  };
}
