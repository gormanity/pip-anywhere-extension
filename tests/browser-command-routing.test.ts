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
  let forwardedTabs: Array<chrome.tabs.Tab | undefined>;
  let forwardResult: boolean;

  beforeEach(() => {
    duplicateDisabled = false;
    dispatchedCommands = [];
    forwardedCommands = [];
    forwardedTabs = [];
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

  async function forwardCommand(
    command: BrowserCommandName,
    tab?: chrome.tabs.Tab,
  ): Promise<boolean> {
    forwardedCommands.push(command);
    forwardedTabs.push(tab);
    return forwardResult;
  }

  it("forwards prod commands only while duplicate-disabled", async () => {
    duplicateDisabled = true;
    const tab = { id: 123 } as chrome.tabs.Tab;

    await expect(
      routeBrowserCommand({
        command: TOGGLE_COMMAND,
        tab,
        isDev: false,
        duplicateRuntime,
        dispatchCommand,
        forwardCommand,
      }),
    ).resolves.toBe(true);

    expect(duplicateRuntime.probeDevBuildPresence).not.toHaveBeenCalled();
    expect(forwardedCommands).toEqual([TOGGLE_COMMAND]);
    expect(forwardedTabs).toEqual([tab]);
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

    expect(duplicateRuntime.probeDevBuildPresence).toHaveBeenCalledOnce();
    expect(forwardedCommands).toEqual([]);
    expect(dispatchedCommands).toEqual([
      { command: SELECT_COMMAND, tab: undefined },
    ]);
  });

  it("dispatches active prod toggles without waiting for a dev probe", async () => {
    duplicateRuntime.probeDevBuildPresence = vi.fn(
      () => new Promise<void>(() => undefined),
    );

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
    expect(forwardedCommands).toEqual([]);
    expect(dispatchedCommands).toEqual([
      { command: TOGGLE_COMMAND, tab: undefined },
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

    expect(duplicateRuntime.probeDevBuildPresence).not.toHaveBeenCalled();
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
