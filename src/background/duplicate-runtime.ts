import {
  CHROMIUM_DEV_EXTENSION_ID,
  CHROMIUM_PROD_EXTENSION_IDS,
  CONTENT_DUPLICATE_STATUS_REQUEST_MESSAGE,
  DEV_BUILD_PING_INTERVAL_MS,
  DEV_BUILD_PRESENCE_MESSAGE,
  DEV_BUILD_PRESENCE_REQUEST_MESSAGE,
  DEV_BUILD_STALE_MS,
  DUPLICATE_STATUS_CHANGED_MESSAGE,
  type DuplicateStatusResponse,
  isDevBuildPresenceMessage,
  isDevBuildPresenceRequestMessage,
  isDuplicateStatusRequestMessage,
  isRuntimeStateMessage,
} from "@/core/runtime-messages";

const NORMAL_ICON_PATHS = {
  16: "icon16.png",
  32: "icon32.png",
  48: "icon48.png",
  128: "icon128.png",
};

const OFF_ICON_PATHS = {
  16: "icon-off16.png",
  32: "icon-off32.png",
  48: "icon-off48.png",
  128: "icon-off128.png",
};

const NORMAL_TITLE = "PiP Anywhere";
const DUPLICATE_DISABLED_TITLE =
  "PiP Anywhere disabled while the dev build is active";

export interface DuplicateRuntimeApi {
  action: Pick<
    typeof chrome.action,
    | "setBadgeBackgroundColor"
    | "setBadgeText"
    | "setIcon"
    | "setPopup"
    | "setTitle"
  >;
  runtime: {
    readonly lastError?: chrome.runtime.LastError;
    sendMessage(...args: unknown[]): unknown;
    onMessage: ListenerTarget<
      (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void,
      ) => boolean | void
    >;
    onMessageExternal: ListenerTarget<
      (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void,
      ) => boolean | void
    >;
  };
  tabs: {
    query(
      queryInfo: chrome.tabs.QueryInfo,
      callback: (result: chrome.tabs.Tab[]) => void,
    ): unknown;
    sendMessage(...args: unknown[]): unknown;
    onRemoved: ListenerTarget<(tabId: number) => void>;
    onUpdated: ListenerTarget<
      (tabId: number, changeInfo: { status?: string }) => void
    >;
  };
}

interface ListenerTarget<T> {
  addListener(listener: T): void;
}

export interface DuplicateRuntimeController {
  isDuplicateDisabled(): boolean;
  probeDevBuildPresence(callback?: () => void): void;
  startDevBuildHeartbeat(): void;
}

export function installDuplicateRuntime({
  api,
  isDev,
}: {
  api: DuplicateRuntimeApi;
  isDev: boolean;
}): DuplicateRuntimeController {
  const suspendedFramesByTab = new Map<number, Set<number>>();
  let currentActionState: boolean | null = null;
  let externalDevBuildPresent = false;
  let externalDevBuildStaleTimer: ReturnType<typeof setTimeout> | undefined;
  let devHeartbeatTimer: ReturnType<typeof setInterval> | undefined;

  function isDuplicateDisabled(): boolean {
    return externalDevBuildPresent || suspendedFramesByTab.size > 0;
  }

  function setFrameState(
    tabId: number,
    frameId: number,
    disabledByDuplicate: boolean,
  ): void {
    if (disabledByDuplicate) {
      const frames = suspendedFramesByTab.get(tabId) ?? new Set<number>();
      frames.add(frameId);
      suspendedFramesByTab.set(tabId, frames);
      return;
    }

    const frames = suspendedFramesByTab.get(tabId);
    if (!frames) return;
    frames.delete(frameId);
    if (frames.size === 0) suspendedFramesByTab.delete(tabId);
  }

  function notifyDuplicateStatusChanged(): void {
    try {
      api.runtime.sendMessage(
        { type: DUPLICATE_STATUS_CHANGED_MESSAGE },
        () => {
          void api.runtime.lastError;
        },
      );
    } catch {
      // Popup/options contexts are short-lived.
    }
  }

  function setActionState(disabledByDuplicate: boolean): void {
    if (currentActionState === disabledByDuplicate) return;
    currentActionState = disabledByDuplicate;

    void api.action.setIcon({
      path: disabledByDuplicate ? OFF_ICON_PATHS : NORMAL_ICON_PATHS,
    });
    void api.action.setTitle({
      title: disabledByDuplicate ? DUPLICATE_DISABLED_TITLE : NORMAL_TITLE,
    });
    void api.action.setBadgeText({
      text: disabledByDuplicate ? "OFF" : isDev ? "DEV" : "",
    });
    void api.action.setBadgeBackgroundColor({
      color: disabledByDuplicate ? "#555555" : "#1f6feb",
    });
    void api.action.setPopup({
      popup: disabledByDuplicate || isDev ? "popup.html" : "",
    });
  }

  function updateDuplicateState(wasDisabledByDuplicate: boolean): void {
    const disabledByDuplicate = isDuplicateDisabled();
    setActionState(disabledByDuplicate);
    if (disabledByDuplicate !== wasDisabledByDuplicate) {
      notifyDuplicateStatusChanged();
    }
  }

  function setExternalDevBuildPresent(present: boolean): void {
    const wasDisabledByDuplicate = isDuplicateDisabled();
    externalDevBuildPresent = present;
    updateDuplicateState(wasDisabledByDuplicate);
  }

  function markExternalDevBuildPresent(): void {
    setExternalDevBuildPresent(true);
    if (externalDevBuildStaleTimer !== undefined) {
      clearTimeout(externalDevBuildStaleTimer);
    }
    externalDevBuildStaleTimer = setTimeout(() => {
      externalDevBuildStaleTimer = undefined;
      setExternalDevBuildPresent(false);
    }, DEV_BUILD_STALE_MS);
  }

  function startDevBuildHeartbeat(): void {
    if (!isDev || devHeartbeatTimer !== undefined) return;

    const pingProd = (): void => {
      for (const extensionId of CHROMIUM_PROD_EXTENSION_IDS) {
        api.runtime.sendMessage(
          extensionId,
          { type: DEV_BUILD_PRESENCE_MESSAGE },
          () => {
            void api.runtime.lastError;
          },
        );
      }
    };

    pingProd();
    devHeartbeatTimer = setInterval(pingProd, DEV_BUILD_PING_INTERVAL_MS);
  }

  function probeDevBuildPresence(callback?: () => void): void {
    if (isDev) {
      callback?.();
      return;
    }

    api.runtime.sendMessage(
      CHROMIUM_DEV_EXTENSION_ID,
      { type: DEV_BUILD_PRESENCE_REQUEST_MESSAGE },
      (response?: { ok?: boolean }) => {
        if (!api.runtime.lastError && response?.ok === true) {
          markExternalDevBuildPresent();
        }
        setTimeout(() => callback?.(), 0);
      },
    );
  }

  function sendDuplicateStatusResponse(
    sendResponse: (response: DuplicateStatusResponse) => void,
  ): void {
    sendResponse({
      ok: true,
      data: { duplicateDetected: isDuplicateDisabled() },
    });
  }

  function refreshDuplicateStatus(
    sendResponse: (response: DuplicateStatusResponse) => void,
  ): boolean {
    probeDevBuildPresence(() => {
      if (isDuplicateDisabled()) {
        sendDuplicateStatusResponse(sendResponse);
        return;
      }

      api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (tabId === undefined) {
          sendDuplicateStatusResponse(sendResponse);
          return;
        }

        api.tabs.sendMessage(
          tabId,
          { type: CONTENT_DUPLICATE_STATUS_REQUEST_MESSAGE },
          (response?: DuplicateStatusResponse) => {
            if (api.runtime.lastError || response?.ok !== true) {
              sendDuplicateStatusResponse(sendResponse);
              return;
            }

            const wasDisabledByDuplicate = isDuplicateDisabled();
            setFrameState(tabId, 0, response.data.duplicateDetected);
            updateDuplicateState(wasDisabledByDuplicate);
            sendDuplicateStatusResponse(sendResponse);
          },
        );
      });
    });
    return true;
  }

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isDuplicateStatusRequestMessage(message)) {
      return refreshDuplicateStatus(sendResponse);
    }

    if (!isRuntimeStateMessage(message)) return false;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return false;

    const wasDisabledByDuplicate = isDuplicateDisabled();
    setFrameState(tabId, sender.frameId ?? 0, message.disabledByDuplicate);
    updateDuplicateState(wasDisabledByDuplicate);
    return false;
  });

  api.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (isDev) {
      if (
        !CHROMIUM_PROD_EXTENSION_IDS.some(
          (extensionId) => extensionId === sender.id,
        )
      ) {
        return false;
      }
      if (!isDevBuildPresenceRequestMessage(message)) return false;
      sendResponse({ ok: true });
      return false;
    }

    if (sender.id !== CHROMIUM_DEV_EXTENSION_ID) return false;
    if (!isDevBuildPresenceMessage(message)) return false;

    markExternalDevBuildPresent();
    sendResponse({ ok: true });
    return false;
  });

  api.tabs.onRemoved.addListener((tabId) => {
    const wasDisabledByDuplicate = isDuplicateDisabled();
    suspendedFramesByTab.delete(tabId);
    updateDuplicateState(wasDisabledByDuplicate);
  });

  api.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== "loading") return;

    const wasDisabledByDuplicate = isDuplicateDisabled();
    suspendedFramesByTab.delete(tabId);
    updateDuplicateState(wasDisabledByDuplicate);
  });

  setActionState(false);
  startDevBuildHeartbeat();
  probeDevBuildPresence();

  return {
    isDuplicateDisabled,
    probeDevBuildPresence,
    startDevBuildHeartbeat,
  };
}
