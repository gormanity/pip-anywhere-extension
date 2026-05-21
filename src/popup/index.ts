import { getBrowserApi } from "@/core/browser";
import {
  DUPLICATE_STATUS_CHANGED_MESSAGE,
  DUPLICATE_STATUS_REQUEST_MESSAGE,
  type DuplicateStatusChangedMessage,
  type DuplicateStatusResponse,
} from "@/core/runtime-messages";

const api = getBrowserApi();
const buildLabel = document.getElementById("build-label");
const duplicateBanner = document.getElementById("duplicate-banner");
const openOptions = document.getElementById("open-options");

if (buildLabel) {
  buildLabel.textContent = __DEV__ ? "Development build" : "Production build";
}

function setDuplicateBannerVisible(visible: boolean): void {
  if (duplicateBanner) duplicateBanner.hidden = !visible;
}

function refreshDuplicateStatus(): void {
  if (__DEV__) {
    setDuplicateBannerVisible(false);
    return;
  }

  try {
    api.runtime.sendMessage(
      { type: DUPLICATE_STATUS_REQUEST_MESSAGE },
      (response?: DuplicateStatusResponse) => {
        if (api.runtime.lastError) return;
        setDuplicateBannerVisible(
          response?.ok === true && response.data.duplicateDetected,
        );
      },
    );
  } catch {
    setDuplicateBannerVisible(false);
  }
}

api.runtime.onMessage.addListener((message: DuplicateStatusChangedMessage) => {
  if (message.type === DUPLICATE_STATUS_CHANGED_MESSAGE) {
    refreshDuplicateStatus();
  }
});

openOptions?.addEventListener("click", () => {
  void api.runtime.openOptionsPage();
});

refreshDuplicateStatus();
