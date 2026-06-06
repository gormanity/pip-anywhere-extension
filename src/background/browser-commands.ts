export const TOGGLE_COMMAND = "_execute_action";
export const LEGACY_TOGGLE_COMMAND = "toggle-picture-in-picture";
export const SELECT_COMMAND = "select-picture-in-picture-video";

export type BrowserCommandName =
  | typeof TOGGLE_COMMAND
  | typeof LEGACY_TOGGLE_COMMAND
  | typeof SELECT_COMMAND;

export interface BrowserCommandDuplicateRuntime {
  isDuplicateDisabled(): boolean;
  probeDevBuildPresence(): Promise<void>;
}

export interface BrowserCommandRouteOptions {
  command: string;
  tab?: chrome.tabs.Tab;
  isDev: boolean;
  duplicateRuntime: BrowserCommandDuplicateRuntime;
  forwardCommand: (
    command: BrowserCommandName,
    tab?: chrome.tabs.Tab,
  ) => Promise<boolean>;
  dispatchCommand: (
    command: BrowserCommandName,
    tab?: chrome.tabs.Tab,
  ) => void | Promise<void>;
}

export function isBrowserCommandName(
  command: string,
): command is BrowserCommandName {
  return (
    command === TOGGLE_COMMAND ||
    command === LEGACY_TOGGLE_COMMAND ||
    command === SELECT_COMMAND
  );
}

function isToggleCommand(command: BrowserCommandName): boolean {
  return command === TOGGLE_COMMAND || command === LEGACY_TOGGLE_COMMAND;
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

  if (
    shouldForwardCommandToDevBuild(
      isDev,
      duplicateRuntime.isDuplicateDisabled(),
    )
  ) {
    try {
      return await forwardCommand(command, tab);
    } catch {
      return false;
    }
  }

  if (!isDev && !isToggleCommand(command)) {
    await duplicateRuntime.probeDevBuildPresence().catch(() => undefined);
    if (
      shouldForwardCommandToDevBuild(
        isDev,
        duplicateRuntime.isDuplicateDisabled(),
      )
    ) {
      try {
        return await forwardCommand(command, tab);
      } catch {
        return false;
      }
    }
  }

  if (!isDev && isToggleCommand(command)) {
    void duplicateRuntime.probeDevBuildPresence().catch(() => undefined);
  }

  await dispatchCommand(command, tab);
  return true;
}
