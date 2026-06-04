export const TOGGLE_COMMAND = "toggle-picture-in-picture";
export const SELECT_COMMAND = "select-picture-in-picture-video";

export type BrowserCommandName = typeof TOGGLE_COMMAND | typeof SELECT_COMMAND;

export interface BrowserCommandDuplicateRuntime {
  isDuplicateDisabled(): boolean;
  probeDevBuildPresence(): Promise<void>;
}

export interface BrowserCommandRouteOptions {
  command: string;
  tab?: chrome.tabs.Tab;
  isDev: boolean;
  duplicateRuntime: BrowserCommandDuplicateRuntime;
  forwardCommand: (command: BrowserCommandName) => Promise<boolean>;
  dispatchCommand: (
    command: BrowserCommandName,
    tab?: chrome.tabs.Tab,
  ) => void | Promise<void>;
}

export function isBrowserCommandName(
  command: string,
): command is BrowserCommandName {
  return command === TOGGLE_COMMAND || command === SELECT_COMMAND;
}

export function shouldForwardCommandToDevBuild(
  isDev: boolean,
  duplicateDisabled: boolean,
): boolean {
  return !isDev && duplicateDisabled;
}

export async function routeBrowserCommand({
  command,
  tab,
  isDev,
  duplicateRuntime,
  forwardCommand,
  dispatchCommand,
}: BrowserCommandRouteOptions): Promise<boolean> {
  if (!isBrowserCommandName(command)) return false;

  if (!isDev) {
    await duplicateRuntime.probeDevBuildPresence().catch(() => undefined);
  }

  if (
    shouldForwardCommandToDevBuild(
      isDev,
      duplicateRuntime.isDuplicateDisabled(),
    )
  ) {
    try {
      return await forwardCommand(command);
    } catch {
      return false;
    }
  }

  await dispatchCommand(command, tab);
  return true;
}
