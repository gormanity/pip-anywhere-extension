import {
  CHROMIUM_DEV_EXTENSION_ID,
  CHROMIUM_LOCAL_PROD_EXTENSION_ID,
  CHROMIUM_PROD_EXTENSION_IDS,
} from "./runtime-messages";

export const CHROMIUM_LOCAL_PROD_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqWrofqc0az2QIu7LylzTv3ZGyvNv5mP1G0+gn6Q9f/67KtYx+5RltFHs8ef0BThcNwgV3CFf+R9mjRU1iwuiu5UTHxQHXBK5Ft2XaVIzi82OiuQfgGGfIxmQSDkjBPnWaPkR1exB/3MFPrurJgPc61+DggL5iToRdDVYpeDZt3xRJWtn6KEuKOD9HEVahkRi3jttAazx84ygODWMa/MFDuFSsxMMAl1dwo1Lw292OnKnmxQ5jqQ4ih85esa4HW5RgtX7DRBXb7Yjif7n6PkC227X4JJctgYyaIuFxYdVegF5i8rW1sz43NLJpel6d6j4TrsGBPWOylVGHeQOuns60QIDAQAB";
export const CHROMIUM_DEV_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArQIV9aaSSmjULoCx5FoGrUgnGBSAGSD79jEjLk19FyCwPbEOH9zeK4DUEJCDzw+ZrjbuSv25lRBADdNvvpndrAWGtsmH8MIdo1mQr3QXjUJOhCwvNZBb5jSf+itIV/t4/GASMr2aALDsfFSFicfoD2Cnkm3soIJi4Yhda+2Cn3J81M/gLcwycUSxxgG33Ukfd2BRsEc/01qud+vpAOXjTeyBHN/pZ4xnm2E3W42nYLUb0QQZ+to3pHUv3e/Qli0CpgnIABW7GKJo+kRkHy871KJoXQDM/m8G/9npy/Y56Q79nQpvuhpWjsA85ppUE/ic04pO4vawVNJhswhvbhe/9wIDAQAB";

function removeSuggestedCommandShortcuts(manifest: Record<string, unknown>) {
  const commands = manifest.commands;
  if (!commands || typeof commands !== "object" || Array.isArray(commands)) {
    return;
  }

  for (const command of Object.values(commands)) {
    if (!command || typeof command !== "object" || Array.isArray(command)) {
      continue;
    }
    delete (command as { suggested_key?: unknown }).suggested_key;
  }
}

export function applyChromiumCoexistenceManifestFields(
  manifest: Record<string, unknown>,
  browser: string,
  isDev: boolean,
): void {
  if (browser !== "chrome" && browser !== "edge") return;

  manifest.key = isDev ? CHROMIUM_DEV_KEY : CHROMIUM_LOCAL_PROD_KEY;
  if (isDev) removeSuggestedCommandShortcuts(manifest);
  manifest.externally_connectable = {
    ids: isDev ? [...CHROMIUM_PROD_EXTENSION_IDS] : [CHROMIUM_DEV_EXTENSION_ID],
  };
}

export const CHROMIUM_LOCAL_EXTENSION_IDS = {
  prod: CHROMIUM_LOCAL_PROD_EXTENSION_ID,
  dev: CHROMIUM_DEV_EXTENSION_ID,
} as const;
