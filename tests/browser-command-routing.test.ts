import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SELECT_COMMAND,
  TOGGLE_COMMAND,
  routeBrowserCommand,
  shouldForwardCommandToDevBuild,
  type BrowserCommandName,
  type BrowserCommandDuplicateRuntime,
} from "@/background/browser-commands";

describe("browser command routing", () => {
  let duplicateDisabled: boolean;
  let duplicateRuntime: BrowserCommandDuplicateRuntime;
  let dispatchedCommands: Array<{
    command: BrowserCommandName;
    tab?: chrome.tabs.Tab;
  }>;
  let forwardedCommands: BrowserCommandName[];
  let forwardResult: boolean;

  beforeEach(() => {
    duplicateDisabled = false;
    dispatchedCommands = [];
    forwardedCommands = [];
    forwardResult = true;
    duplicateRuntime = {
      isDuplicateDisabled: vi.fn(() => duplicateDisabled),
      probeDevBuildPresence: vi.fn(() => Promise.resolve()),
    };
  });

  async function dispatchCommand(
    command: BrowserCommandName,
    tab?: chrome.tabs.Tab,
  ): Promise<void> {
    dispatchedCommands.push({ command, tab });
  }

  async function forwardCommand(command: BrowserCommandName): Promise<boolean> {
    forwardedCommands.push(command);
    return forwardResult;
  }

  it("forwards prod commands only while duplicate-disabled", async () => {
    duplicateDisabled = true;

    await expect(
      routeBrowserCommand({
        command: TOGGLE_COMMAND,
        isDev: false,
        duplicateRuntime,
        dispatchCommand,
        forwardCommand,
      }),
    ).resolves.toBe(true);

    expect(duplicateRuntime.probeDevBuildPresence).toHaveBeenCalledOnce();
    expect(forwardedCommands).toEqual([TOGGLE_COMMAND]);
    expect(dispatchedCommands).toEqual([]);
  });

  it("does not forward prod commands while active", async () => {
    await expect(
      routeBrowserCommand({
        command: SELECT_COMMAND,
        isDev: false,
        duplicateRuntime,
        dispatchCommand,
        forwardCommand,
      }),
    ).resolves.toBe(true);

    expect(forwardedCommands).toEqual([]);
    expect(dispatchedCommands).toEqual([
      { command: SELECT_COMMAND, tab: undefined },
    ]);
  });

  it("does not execute locally when prod forwarding fails while off", async () => {
    duplicateDisabled = true;
    forwardResult = false;

    await expect(
      routeBrowserCommand({
        command: TOGGLE_COMMAND,
        isDev: false,
        duplicateRuntime,
        dispatchCommand,
        forwardCommand,
      }),
    ).resolves.toBe(false);

    expect(forwardedCommands).toEqual([TOGGLE_COMMAND]);
    expect(dispatchedCommands).toEqual([]);
  });

  it("never forwards from dev", async () => {
    duplicateDisabled = true;

    await expect(
      routeBrowserCommand({
        command: TOGGLE_COMMAND,
        isDev: true,
        duplicateRuntime,
        dispatchCommand,
        forwardCommand,
      }),
    ).resolves.toBe(true);

    expect(duplicateRuntime.probeDevBuildPresence).not.toHaveBeenCalled();
    expect(forwardedCommands).toEqual([]);
    expect(dispatchedCommands).toEqual([
      { command: TOGGLE_COMMAND, tab: undefined },
    ]);
  });

  it("rejects unknown commands", async () => {
    await expect(
      routeBrowserCommand({
        command: "unknown-command",
        isDev: false,
        duplicateRuntime,
        dispatchCommand,
        forwardCommand,
      }),
    ).resolves.toBe(false);

    expect(duplicateRuntime.probeDevBuildPresence).not.toHaveBeenCalled();
    expect(forwardedCommands).toEqual([]);
    expect(dispatchedCommands).toEqual([]);
  });

  it("keeps the forwarding rule tied to prod duplicate-disabled state", () => {
    expect(shouldForwardCommandToDevBuild(false, true)).toBe(true);
    expect(shouldForwardCommandToDevBuild(false, false)).toBe(false);
    expect(shouldForwardCommandToDevBuild(true, true)).toBe(false);
  });
});
