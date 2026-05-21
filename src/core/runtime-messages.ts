export const RUNTIME_STATE_MESSAGE = "pip-anywhere.runtime-state";
export const DUPLICATE_STATUS_REQUEST_MESSAGE =
  "pip-anywhere.get-duplicate-status";
export const DUPLICATE_STATUS_CHANGED_MESSAGE =
  "pip-anywhere.duplicate-status-changed";
export const CONTENT_DUPLICATE_STATUS_REQUEST_MESSAGE =
  "pip-anywhere.get-content-duplicate-status";
export const DEV_BUILD_PRESENCE_MESSAGE = "pip-anywhere.dev-build-presence";
export const DEV_BUILD_PRESENCE_REQUEST_MESSAGE =
  "pip-anywhere.get-dev-build-presence";

export const DEV_BUILD_PING_INTERVAL_MS = 1000;
export const DEV_BUILD_STALE_MS = 3500;

export const CHROMIUM_LOCAL_PROD_EXTENSION_ID =
  "dakagfnbbijbflodaajdfgdiddgobjhl";
export const CHROMIUM_DEV_EXTENSION_ID = "cjodjanjoahbgiigloplfkiikoejgoge";
export const CHROMIUM_PROD_EXTENSION_IDS = [
  CHROMIUM_LOCAL_PROD_EXTENSION_ID,
] as const;

export type RuntimeStateMessage = {
  type: typeof RUNTIME_STATE_MESSAGE;
  disabledByDuplicate: boolean;
};

export type DuplicateStatusRequestMessage = {
  type: typeof DUPLICATE_STATUS_REQUEST_MESSAGE;
};

export type DuplicateStatusChangedMessage = {
  type: typeof DUPLICATE_STATUS_CHANGED_MESSAGE;
};

export type ContentDuplicateStatusRequestMessage = {
  type: typeof CONTENT_DUPLICATE_STATUS_REQUEST_MESSAGE;
};

export type DevBuildPresenceMessage = {
  type: typeof DEV_BUILD_PRESENCE_MESSAGE;
};

export type DevBuildPresenceRequestMessage = {
  type: typeof DEV_BUILD_PRESENCE_REQUEST_MESSAGE;
};

export type DuplicateStatusResponse = {
  ok: true;
  data: {
    duplicateDetected: boolean;
  };
};

export function isRuntimeStateMessage(
  message: unknown,
): message is RuntimeStateMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as Partial<RuntimeStateMessage>).type === RUNTIME_STATE_MESSAGE &&
    typeof (message as Partial<RuntimeStateMessage>).disabledByDuplicate ===
      "boolean"
  );
}

export function isDuplicateStatusRequestMessage(
  message: unknown,
): message is DuplicateStatusRequestMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as Partial<DuplicateStatusRequestMessage>).type ===
      DUPLICATE_STATUS_REQUEST_MESSAGE
  );
}

export function isContentDuplicateStatusRequestMessage(
  message: unknown,
): message is ContentDuplicateStatusRequestMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as Partial<ContentDuplicateStatusRequestMessage>).type ===
      CONTENT_DUPLICATE_STATUS_REQUEST_MESSAGE
  );
}

export function isDevBuildPresenceMessage(
  message: unknown,
): message is DevBuildPresenceMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as Partial<DevBuildPresenceMessage>).type ===
      DEV_BUILD_PRESENCE_MESSAGE
  );
}

export function isDevBuildPresenceRequestMessage(
  message: unknown,
): message is DevBuildPresenceRequestMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as Partial<DevBuildPresenceRequestMessage>).type ===
      DEV_BUILD_PRESENCE_REQUEST_MESSAGE
  );
}
