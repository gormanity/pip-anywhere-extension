import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CHROMIUM_CHROME_STORE_EXTENSION_ID,
  CHROMIUM_DEV_EXTENSION_ID,
  CHROMIUM_LOCAL_PROD_EXTENSION_ID,
} from "@/core/runtime-messages";
import {
  CHROMIUM_DEV_KEY,
  CHROMIUM_LOCAL_PROD_KEY,
  applyChromiumCoexistenceManifestFields,
} from "@/core/manifest-coexistence";

function extensionIdFromKey(key: string): string {
  const hash = createHash("sha256").update(Buffer.from(key, "base64")).digest();
  return [...hash.subarray(0, 16)]
    .map((byte) =>
      [byte >> 4, byte & 0x0f]
        .map((nibble) => String.fromCharCode("a".charCodeAt(0) + nibble))
        .join(""),
    )
    .join("");
}

function manifestWithCommands(): Record<string, unknown> {
  return {
    commands: {
      _execute_action: {
        suggested_key: {
          default: "Alt+Shift+P",
        },
      },
      "select-picture-in-picture-video": {
        suggested_key: {
          default: "Alt+Shift+V",
        },
        description: "Choose a picture-in-picture video",
      },
    },
  };
}

describe("Chromium coexistence manifest fields", () => {
  it("derives different fixed IDs for local prod and local dev", () => {
    expect(extensionIdFromKey(CHROMIUM_LOCAL_PROD_KEY)).toBe(
      CHROMIUM_LOCAL_PROD_EXTENSION_ID,
    );
    expect(extensionIdFromKey(CHROMIUM_DEV_KEY)).toBe(
      CHROMIUM_DEV_EXTENSION_ID,
    );
    expect(CHROMIUM_LOCAL_PROD_EXTENSION_ID).not.toBe(
      CHROMIUM_DEV_EXTENSION_ID,
    );
  });

  it("restricts externally connectable IDs to expected counterparts", () => {
    const prodManifest: Record<string, unknown> = {};
    const devManifest: Record<string, unknown> = {};

    applyChromiumCoexistenceManifestFields(prodManifest, "chrome", false);
    applyChromiumCoexistenceManifestFields(devManifest, "chrome", true);

    expect(prodManifest).toMatchObject({
      key: CHROMIUM_LOCAL_PROD_KEY,
      externally_connectable: {
        ids: [CHROMIUM_DEV_EXTENSION_ID],
      },
    });
    expect(devManifest).toMatchObject({
      key: CHROMIUM_DEV_KEY,
      externally_connectable: {
        ids: [
          CHROMIUM_LOCAL_PROD_EXTENSION_ID,
          CHROMIUM_CHROME_STORE_EXTENSION_ID,
        ],
      },
    });
  });

  it("removes suggested command shortcuts from Chromium dev manifests", () => {
    const chromeManifest = manifestWithCommands();
    const edgeManifest = manifestWithCommands();

    applyChromiumCoexistenceManifestFields(chromeManifest, "chrome", true);
    applyChromiumCoexistenceManifestFields(edgeManifest, "edge", true);

    expect(chromeManifest.commands).not.toMatchObject({
      _execute_action: {
        suggested_key: expect.anything(),
      },
      "select-picture-in-picture-video": {
        suggested_key: expect.anything(),
      },
    });
    expect(edgeManifest.commands).not.toMatchObject({
      _execute_action: {
        suggested_key: expect.anything(),
      },
      "select-picture-in-picture-video": {
        suggested_key: expect.anything(),
      },
    });
  });

  it("keeps suggested command shortcuts for Chromium prod manifests", () => {
    const manifest = manifestWithCommands();

    applyChromiumCoexistenceManifestFields(manifest, "chrome", false);

    expect(manifest.commands).toMatchObject({
      _execute_action: {
        suggested_key: {
          default: "Alt+Shift+P",
        },
      },
      "select-picture-in-picture-video": {
        suggested_key: {
          default: "Alt+Shift+V",
        },
      },
    });
  });

  it("leaves Firefox manifests unchanged", () => {
    const manifest = manifestWithCommands();

    applyChromiumCoexistenceManifestFields(manifest, "firefox", true);

    expect(manifest).toMatchObject(manifestWithCommands());
    expect(manifest).not.toHaveProperty("key");
    expect(manifest).not.toHaveProperty("externally_connectable");
  });
});
