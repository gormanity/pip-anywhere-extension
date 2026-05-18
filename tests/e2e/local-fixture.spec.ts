import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  closePage,
  launchExtensionContext,
  startFixtureServer,
  type FixtureServer,
} from "./extension-fixture";

let server: FixtureServer;
let context: BrowserContext;
let extensionId: string;
let page: Page | undefined;

test.beforeAll(async () => {
  server = await startFixtureServer();
  const launched = await launchExtensionContext();
  context = launched.context;
  extensionId = launched.extensionId;
  await closeExtensionPages();
  await wait(500);
  await closeExtensionPages();
});

test.afterAll(async () => {
  await closePage(page);
  await context?.close();
  await server?.close();
});

test.beforeEach(async () => {
  await closePage(page);
  await closeExtensionPages();
  await setSettings();
  page = await context.newPage();
});

test("shows the hover overlay for eligible videos", async () => {
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#eligible-video", 45);
  await hoverCenter(page!, "#eligible-video");

  await expect(page!.locator(".ultimate-pip-overlay")).toBeVisible();
});

test("detects videos covered by custom player layers", async () => {
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#covered-video", 45);
  await hoverCenter(page!, "#covered-player");

  await expect(page!.locator(".ultimate-pip-overlay")).toBeVisible();
});

test("keeps the hover overlay off short and muted preview videos", async () => {
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#short-video", 1);

  await hoverCenter(page!, "#short-video");
  await expect(page!.locator(".ultimate-pip-overlay")).toBeHidden();

  await hoverCenter(page!, "#muted-preview");
  await expect(page!.locator(".ultimate-pip-overlay")).toBeHidden();
});

test("observes dynamically inserted videos", async () => {
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await page!.locator("#insert-video").click();
  await expect(page!.locator("#dynamic-video")).toBeVisible();
  await expectVideoDuration("#dynamic-video", 45);
  await hoverCenter(page!, "#dynamic-video");

  await expect(page!.locator(".ultimate-pip-overlay")).toBeVisible();
});

test("injects overlay behavior into same-origin iframes", async () => {
  await page!.goto(`${server.origin}/pip-fixture.html`);
  const frame = page!.frameLocator("#same-origin-frame");
  await expect
    .poll(() =>
      frame.locator("#iframe-video").evaluate((video) => {
        return (video as HTMLVideoElement).duration;
      }),
    )
    .toBeGreaterThanOrEqual(45);

  await page!.locator("#same-origin-frame").scrollIntoViewIfNeeded();
  await frame.locator("#iframe-video").hover();

  await expect(frame.locator(".ultimate-pip-overlay")).toBeVisible();
});

test("clears video-level PiP blocking attributes", async () => {
  await page!.goto(`${server.origin}/pip-fixture.html`);
  const blocked = page!.locator("#blocked-video");

  await expect
    .poll(async () =>
      blocked.evaluate((video) => ({
        attribute: video.hasAttribute("disablepictureinpicture"),
        property: (video as HTMLVideoElement).disablePictureInPicture,
      })),
    )
    .toEqual({ attribute: false, property: false });
});

test("leaves video-level PiP blocks alone when unblocking is disabled", async () => {
  await setSettings({ unblockVideoPiP: false });
  await page!.goto(`${server.origin}/pip-fixture.html`);
  const blocked = page!.locator("#blocked-video");

  await expect
    .poll(async () =>
      blocked.evaluate((video) => ({
        attribute: video.hasAttribute("disablepictureinpicture"),
        property: (video as HTMLVideoElement).disablePictureInPicture,
      })),
    )
    .toEqual({ attribute: true, property: true });
});

test("suppresses youtube homepage thumbnail previews", async () => {
  await page!.goto(`${server.youtubeOrigin}/youtube-fixture.html`);
  await expectVideoDuration("#youtube-thumbnail-video", 45);
  await hoverCenter(page!, "#youtube-thumbnail-video");

  await expect(page!.locator(".ultimate-pip-overlay")).toBeHidden();
});

test("keeps youtube watch page videos eligible", async () => {
  await page!.goto(`${server.youtubeOrigin}/watch`);
  await expectVideoDuration("#youtube-watch-video", 45);
  await hoverCenter(page!, "#youtube-watch-video");

  await expect(page!.locator(".ultimate-pip-overlay")).toBeVisible();
});

test("includes youtube watch page videos in explicit selection mode", async () => {
  await page!.goto(`${server.youtubeOrigin}/watch`);
  await expectVideoDuration("#youtube-watch-video", 45);
  await sendSelectMessageToPage(`${server.youtubeOrigin}/watch`);

  await expect(page!.locator(".ultimate-pip-video-target")).toHaveCount(1);
  await expectSelectionTargetToMatchVideo(0, "#youtube-watch-video");
  await page!.locator(".ultimate-pip-video-target").hover();
  await expect(page!.locator(".ultimate-pip-video-target")).toHaveCount(1);
  await expect(page!.locator(".ultimate-pip-video-target")).toBeVisible();
  await expectSelectionTargetToMatchVideo(0, "#youtube-watch-video");
});

test("disables the hover overlay when configured", async () => {
  await setSettings({ hoverOverlayEnabled: false });
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#eligible-video", 45);
  await hoverCenter(page!, "#eligible-video");

  await expect(page!.locator(".ultimate-pip-overlay")).toBeHidden();
});

test("applies minimum duration changes to an open page", async () => {
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#short-video", 1);
  await setSettings({ minimumOverlayDurationSeconds: 0 });
  await hoverCenter(page!, "#short-video");

  await expect(page!.locator(".ultimate-pip-overlay")).toBeVisible();
});

test("honors configured hover delay before showing the overlay", async () => {
  await setSettings({ hoverDelayMs: 1000 });
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#eligible-video", 45);
  await hoverCenter(page!, "#eligible-video");

  await expect(page!.locator(".ultimate-pip-overlay")).toBeHidden({
    timeout: 300,
  });
  await expect(page!.locator(".ultimate-pip-overlay")).toBeVisible({
    timeout: 1200,
  });
});

test("positions the overlay from configured percentage placement", async () => {
  await setSettings({
    overlayPositionXPercent: 20,
    overlayPositionYPercent: 80,
    overlaySizePx: 48,
  });
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#eligible-video", 45);
  await hoverCenter(page!, "#eligible-video");
  await expect(page!.locator(".ultimate-pip-overlay")).toBeVisible();

  const videoBox = await page!.locator("#eligible-video").boundingBox();
  const overlayBox = await page!.locator(".ultimate-pip-overlay").boundingBox();
  if (!videoBox || !overlayBox) {
    throw new Error("Missing overlay or video bounding box");
  }

  expect(
    Math.abs(
      Math.round(overlayBox.x + overlayBox.width / 2) -
        Math.round(videoBox.x + videoBox.width * 0.2),
    ),
  ).toBeLessThanOrEqual(4);
  expect(
    Math.abs(
      Math.round(overlayBox.y + overlayBox.height / 2) -
        Math.round(videoBox.y + videoBox.height * 0.8),
    ),
  ).toBeLessThanOrEqual(4);
  expect(Math.round(overlayBox.width)).toBe(48);
});

test("removes stale duplicate hover overlays after settings changes", async () => {
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#eligible-video", 45);
  await hoverCenter(page!, "#eligible-video");
  await expect(page!.locator(".ultimate-pip-overlay")).toHaveCount(1);

  await page!.evaluate(() => {
    const stale = document.createElement("button");
    stale.className = "ultimate-pip-overlay";
    stale.dataset.visible = "true";
    stale.style.left = "10px";
    stale.style.top = "10px";
    document.documentElement.appendChild(stale);
  });
  await expect(page!.locator(".ultimate-pip-overlay")).toHaveCount(2);

  await setSettings({
    overlayPositionXPercent: 20,
    overlayPositionYPercent: 80,
  });
  await expect(page!.locator(".ultimate-pip-overlay")).toHaveCount(1);
});

test("applies configured hover icon opacity and hides after idle", async () => {
  await setSettings({
    overlayOpacityPercent: 45,
    overlayIdleHideMs: 500,
  });
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#eligible-video", 45);
  await hoverCenter(page!, "#eligible-video");

  const overlay = page!.locator(".ultimate-pip-overlay");
  await expect(overlay).toBeVisible();
  await expect
    .poll(() =>
      overlay.evaluate((element) => getComputedStyle(element).opacity),
    )
    .toBe("0.45");
  await expect(overlay).not.toHaveAttribute("data-visible", "true", {
    timeout: 900,
  });
});

test("disables extension behavior on matching sites", async () => {
  await setSettings({ disabledSitePatterns: ["127.0.0.1"] });
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#eligible-video", 45);
  await hoverCenter(page!, "#eligible-video");

  await expect(page!.locator(".ultimate-pip-overlay")).toBeHidden();
  await sendToggleMessageToPage(`${server.origin}/pip-fixture.html`);
  await expect(page!.locator(".ultimate-pip-toast")).toHaveText(
    "PiP Anywhere is disabled on this site.",
  );
});

test("enters native PiP from the hover overlay click", async () => {
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#eligible-video", 45);
  await hoverCenter(page!, "#eligible-video");
  await page!.locator(".ultimate-pip-overlay").click();

  await expect
    .poll(() =>
      page!.evaluate(() => {
        return document.pictureInPictureElement?.id ?? null;
      }),
    )
    .toBe("eligible-video");
});

test("enters native PiP from the default page hotkey", async () => {
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#eligible-video", 45);
  await page!.locator("#eligible-video").click();
  await page!.keyboard.press("Alt+Shift+P");

  await expect
    .poll(() =>
      page!.evaluate(() => {
        return document.pictureInPictureElement?.id ?? null;
      }),
    )
    .toBe("eligible-video");
});

test("re-enters native PiP from the page hotkey without another click", async () => {
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#eligible-video", 45);
  await page!.locator("#eligible-video").click();
  await page!.keyboard.press("Alt+Shift+P");
  await expect
    .poll(() =>
      page!.evaluate(() => document.pictureInPictureElement?.id ?? null),
    )
    .toBe("eligible-video");

  await page!.evaluate(async () => {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    }
  });
  await expect
    .poll(() =>
      page!.evaluate(() => document.pictureInPictureElement?.id ?? null),
    )
    .toBeNull();

  await page!.keyboard.press("Alt+Shift+P");
  await expect
    .poll(() =>
      page!.evaluate(() => document.pictureInPictureElement?.id ?? null),
    )
    .toBe("eligible-video");
});

test("shows no-video feedback from an extension toggle message", async () => {
  await page!.goto(`${server.origin}/empty-fixture.html`);
  await sendToggleMessageToPage(`${server.origin}/empty-fixture.html`);

  await expect(page!.locator(".ultimate-pip-toast")).toHaveText(
    "No eligible video found on this page.",
  );
});

test("highlights videos for explicit selection mode", async () => {
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#eligible-video", 45);
  await sendSelectMessageToPage(`${server.origin}/pip-fixture.html`);

  await expect(page!.locator(".ultimate-pip-video-target")).toHaveCount(6);
  await expect(
    page!.locator(".ultimate-pip-video-target").first(),
  ).not.toHaveCSS("box-shadow", /9999px/);
  await expectSelectionTargetToMatchVideo(0, "#eligible-video");
  await page!.locator(".ultimate-pip-video-target").first().hover();
  await expect(page!.locator(".ultimate-pip-video-target")).toHaveCount(6);
  await expect(
    page!.locator(".ultimate-pip-video-target").first(),
  ).toBeVisible();
  await expect(page!.locator(".ultimate-pip-overlay")).toBeHidden();
  await page!.locator("#eligible-video").evaluate((video) => {
    (video as HTMLVideoElement).style.opacity = "0";
  });
  await expect(
    page!.locator(".ultimate-pip-video-target").first(),
  ).toBeVisible();
  await page!.locator("#eligible-video").evaluate((video) => {
    (video as HTMLVideoElement).style.display = "none";
  });
  await expect(
    page!.locator(".ultimate-pip-video-target").first(),
  ).toBeVisible();
  await page!.locator("#eligible-video").evaluate((video) => {
    const element = video as HTMLVideoElement;
    element.style.display = "";
    element.style.opacity = "";
  });
  await page!.locator("#eligible-video").evaluate((video) => {
    const replacement = video.cloneNode(true) as HTMLVideoElement;
    replacement.id = "replacement-video";
    video.replaceWith(replacement);
  });
  await expect(
    page!.locator(".ultimate-pip-video-target").first(),
  ).toBeVisible();
  await page!.evaluate(() => window.scrollBy(0, 80));
  await expectSelectionTargetToMatchVideo(0, "#replacement-video");
  await page!.locator(".ultimate-pip-video-target").first().click();

  await expect
    .poll(() =>
      page!.evaluate(() => {
        return document.pictureInPictureElement?.id ?? null;
      }),
    )
    .not.toBeNull();
});

test("cancels explicit video selection from outside click and escape", async () => {
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#eligible-video", 45);

  await sendSelectMessageToPage(`${server.origin}/pip-fixture.html`);
  await expect(page!.locator(".ultimate-pip-video-target")).toHaveCount(6);
  await page!.mouse.click(4, 4);
  await expect(page!.locator(".ultimate-pip-video-target")).toHaveCount(0);

  await sendSelectMessageToPage(`${server.origin}/pip-fixture.html`);
  await expect(page!.locator(".ultimate-pip-video-target")).toHaveCount(6);
  await page!.keyboard.press("Escape");
  await expect(page!.locator(".ultimate-pip-video-target")).toHaveCount(0);
});

test("autosaves options page changes and shows status text", async () => {
  await page!.goto(`chrome-extension://${extensionId}/options.html`);
  await page!.locator("#hover-delay-ms").fill("400");

  await expect(page!.locator("#status")).toHaveText("Settings saved.");
  await expect(page!.locator("#status")).toBeInViewport();
  await expect
    .poll(() =>
      page!.evaluate(
        async (settingsKey) =>
          new Promise<number>((resolve) => {
            chrome.storage.sync.get([settingsKey], (result) => {
              const settings = result[settingsKey] as { hoverDelayMs: number };
              resolve(settings.hoverDelayMs);
            });
          }),
        "ultimatePip.settings",
      ),
    )
    .toBe(400);
});

test("manages disabled site rules with wildcard validation", async () => {
  await page!.goto(`chrome-extension://${extensionId}/options.html`);

  await page!.locator("#site-rule-input").fill("bad rule");
  await page!.locator("#add-site-rule").click();
  await expect(page!.locator("#site-rule-error")).toHaveText(
    "Site rules cannot contain spaces.",
  );
  await expect(page!.locator(".site-rule-item")).toHaveCount(0);

  await page!.locator("#site-rule-input").fill("example.com");
  await page!.locator("#add-site-rule").click();
  await expect(page!.locator(".site-rule-item")).toHaveCount(1);
  await expect(page!.locator(".site-rule-pattern")).toHaveText("example.com");
  await expect
    .poll(() => readStoredSettings())
    .toMatchObject({ disabledSitePatterns: ["example.com"] });

  await page!.getByRole("button", { name: "Edit example.com" }).click();
  await expect(page!.locator("#site-rule-input")).toHaveValue("example.com");
  await page!.locator("#site-rule-input").fill("*watch*");
  await page!.locator("#add-site-rule").click();
  await expect(page!.locator(".site-rule-pattern")).toHaveText("*watch*");
  await expect
    .poll(() => readStoredSettings())
    .toMatchObject({ disabledSitePatterns: ["*watch*"] });

  await page!.getByRole("button", { name: "Remove *watch*" }).click();
  await expect(page!.locator(".site-rule-empty")).toHaveText(
    "No disabled sites.",
  );
  await expect
    .poll(() => readStoredSettings())
    .toMatchObject({ disabledSitePatterns: [] });
});

test("keeps overlay placement preview fully visible at picker edges", async () => {
  await setSettings({
    overlayPositionXPercent: 100,
    overlayPositionYPercent: 0,
    overlaySizePx: 42,
  });
  await page!.goto(`chrome-extension://${extensionId}/options.html`);

  const pickerBox = await page!
    .locator("#overlay-position-picker")
    .boundingBox();
  const handleBox = await page!
    .locator("#overlay-position-handle")
    .boundingBox();
  if (!pickerBox || !handleBox) {
    throw new Error("Missing position picker or handle box");
  }

  expect(handleBox.x).toBeGreaterThanOrEqual(pickerBox.x);
  expect(handleBox.y).toBeGreaterThanOrEqual(pickerBox.y);
  expect(handleBox.x + handleBox.width).toBeLessThanOrEqual(
    pickerBox.x + pickerBox.width,
  );
  expect(handleBox.y + handleBox.height).toBeLessThanOrEqual(
    pickerBox.y + pickerBox.height,
  );
  await expect(page!.locator("#overlay-position-x-output")).toHaveText(
    "X 100%",
  );
  await expect(page!.locator("#overlay-position-y-output")).toHaveText("Y 0%");
});

test("restores default options and persists them", async () => {
  await setSettings({
    hoverOverlayEnabled: false,
    hoverDelayMs: 900,
    minimumOverlayDurationSeconds: 0,
    overlayPositionXPercent: 20,
    overlayPositionYPercent: 80,
    overlayOpacityPercent: 55,
    overlaySizePx: 60,
    overlayIdleHideMs: 1000,
    unblockVideoPiP: false,
  });

  await page!.goto(`chrome-extension://${extensionId}/options.html`);
  await page!.locator("#reset").click();

  await expect(page!.locator("#status")).toHaveText(
    "Default settings restored.",
  );
  await expect(page!.locator("#hover-delay-ms")).toHaveValue("250");
  await expect(page!.locator("#minimum-overlay-duration")).toHaveValue("45");
  await expect(page!.locator("#overlay-position-x")).toHaveValue("92");
  await expect(page!.locator("#overlay-position-y")).toHaveValue("12");
  await expect(page!.locator("#overlay-opacity")).toHaveValue("86");
  await expect(page!.locator("#overlay-size")).toHaveValue("42");
  await expect(page!.locator("#overlay-idle-hide")).toHaveValue("2500");
  await expect(page!.locator("#hover-overlay-enabled")).toBeChecked();
  await expect(page!.locator("#unblock-video-pip")).toBeChecked();

  await expect
    .poll(() => readStoredSettings())
    .toMatchObject({
      hoverOverlayEnabled: true,
      hoverDelayMs: 250,
      minimumOverlayDurationSeconds: 45,
      overlayPositionXPercent: 92,
      overlayPositionYPercent: 12,
      overlayOpacityPercent: 86,
      overlaySizePx: 42,
      overlayIdleHideMs: 2500,
      unblockVideoPiP: true,
    });
});

test("shows shortcut text and opens browser shortcut management", async () => {
  await page!.goto(`chrome-extension://${extensionId}/options.html`);

  await expect(page!.locator("#shortcut")).not.toHaveValue("");
  await expect(page!.locator("#shortcut")).toHaveAttribute("readonly", "");

  const shortcutsPagePromise = context.waitForEvent("page");
  await page!.locator("#manage-shortcut").click();
  const shortcutsPage = await shortcutsPagePromise;
  await expect(shortcutsPage).toHaveURL("chrome://extensions/shortcuts");
  await shortcutsPage.close();
});

async function hoverCenter(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error(`Missing bounding box for ${selector}`);
  await target.hover({
    position: {
      x: box.width / 2,
      y: box.height / 2,
    },
  });
}

async function expectSelectionTargetToMatchVideo(
  targetIndex: number,
  videoSelector: string,
): Promise<void> {
  await expect
    .poll(async () => {
      const targetBox = await page!
        .locator(".ultimate-pip-video-target")
        .nth(targetIndex)
        .boundingBox();
      const videoBox = await page!.locator(videoSelector).boundingBox();
      if (!targetBox || !videoBox) return null;
      return {
        x: Math.round(targetBox.x - videoBox.x),
        y: Math.round(targetBox.y - videoBox.y),
        width: Math.round(targetBox.width - videoBox.width),
        height: Math.round(targetBox.height - videoBox.height),
      };
    })
    .toEqual({ x: 0, y: 0, width: 0, height: 0 });
}

async function closeExtensionPages(): Promise<void> {
  await Promise.all(
    context
      .pages()
      .filter((openPage) =>
        openPage.url().startsWith(`chrome-extension://${extensionId}/`),
      )
      .map((openPage) => closePage(openPage)),
  );
}

async function setSettings(
  overrides: Partial<TestSettings> = {},
): Promise<void> {
  const settingsPage = await context.newPage();
  await settingsPage.goto(`chrome-extension://${extensionId}/options.html`);
  await settingsPage.evaluate(
    async ({ key, settings }) =>
      new Promise<void>((resolve) => {
        chrome.storage.sync.set({ [key]: settings }, () => resolve());
      }),
    {
      key: "ultimatePip.settings",
      settings: {
        hoverOverlayEnabled: true,
        hoverDelayMs: 250,
        minimumOverlayDurationSeconds: 45,
        overlayPositionXPercent: 92,
        overlayPositionYPercent: 12,
        overlayOpacityPercent: 86,
        overlaySizePx: 42,
        overlayIdleHideMs: 2500,
        unblockVideoPiP: true,
        disabledSitePatterns: [],
        debugLogging: false,
        ...overrides,
      },
    },
  );
  await settingsPage.close();
}

async function sendToggleMessageToPage(url: string): Promise<void> {
  await sendMessageToPage(url, { type: "ultimate-pip.toggle" });
}

async function sendSelectMessageToPage(url: string): Promise<void> {
  await sendMessageToPage(url, { type: "ultimate-pip.select-video" });
}

async function sendMessageToPage(
  url: string,
  message: { type: string },
): Promise<void> {
  const worker = context.serviceWorkers()[0];
  if (!worker) throw new Error("Missing extension service worker");
  await worker.evaluate(
    async ({ targetUrl, message }) =>
      new Promise<void>((resolve, reject) => {
        chrome.tabs.query({}, (tabs) => {
          const tab = tabs.find((candidate) =>
            candidate.url?.startsWith(targetUrl),
          );
          if (!tab?.id) {
            reject(new Error(`Missing tab for ${targetUrl}`));
            return;
          }

          chrome.tabs.sendMessage(tab.id, message, () => {
            const error = chrome.runtime.lastError;
            if (error) reject(new Error(error.message));
            else resolve();
          });
        });
      }),
    { targetUrl: url, message },
  );
}

async function readStoredSettings(): Promise<TestSettings> {
  const worker = context.serviceWorkers()[0];
  if (!worker) throw new Error("Missing extension service worker");
  return await worker.evaluate(
    async (key) =>
      new Promise<TestSettings>((resolve) => {
        chrome.storage.sync.get([key], (result) => {
          resolve(result[key] as TestSettings);
        });
      }),
    "ultimatePip.settings",
  );
}

async function expectVideoDuration(
  selector: string,
  minimumSeconds: number,
): Promise<void> {
  await expect
    .poll(() =>
      page!.locator(selector).evaluate((video) => {
        return (video as HTMLVideoElement).duration;
      }),
    )
    .toBeGreaterThanOrEqual(minimumSeconds);
}

async function wait(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

interface TestSettings {
  hoverOverlayEnabled: boolean;
  hoverDelayMs: number;
  minimumOverlayDurationSeconds: number;
  overlayPositionXPercent: number;
  overlayPositionYPercent: number;
  overlayOpacityPercent: number;
  overlaySizePx: number;
  overlayIdleHideMs: number;
  unblockVideoPiP: boolean;
  disabledSitePatterns: string[];
  debugLogging: boolean;
}
