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

test("positions the overlay from the configured corner and offsets", async () => {
  await setSettings({
    overlayCorner: "bottom-left",
    overlayOffsetX: 24,
    overlayOffsetY: 32,
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

  expect(Math.round(overlayBox.x - videoBox.x)).toBe(24);
  const bottomDistance = Math.round(
    videoBox.y + videoBox.height - overlayBox.y,
  );
  expect(bottomDistance).toBeGreaterThanOrEqual(
    Math.round(overlayBox.height + 28),
  );
  expect(bottomDistance).toBeLessThanOrEqual(
    Math.round(overlayBox.height + 32),
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

test("shows no-video feedback from an extension toggle message", async () => {
  await page!.goto(`${server.origin}/empty-fixture.html`);
  await sendToggleMessageToPage(`${server.origin}/empty-fixture.html`);

  await expect(page!.locator(".ultimate-pip-toast")).toHaveText(
    "No eligible video found on this page.",
  );
});

test("autosaves options page changes and shows status text", async () => {
  await page!.goto(`chrome-extension://${extensionId}/options.html`);
  await page!.locator("#hover-delay-ms").fill("400");

  await expect(page!.locator("#status")).toHaveText("Settings saved.");
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
        overlayCorner: "top-right",
        overlayOffsetX: 12,
        overlayOffsetY: 12,
        unblockVideoPiP: true,
        debugLogging: false,
        ...overrides,
      },
    },
  );
  await settingsPage.close();
}

async function sendToggleMessageToPage(url: string): Promise<void> {
  const worker = context.serviceWorkers()[0];
  if (!worker) throw new Error("Missing extension service worker");
  await worker.evaluate(
    async ({ targetUrl }) =>
      new Promise<void>((resolve, reject) => {
        chrome.tabs.query({}, (tabs) => {
          const tab = tabs.find((candidate) =>
            candidate.url?.startsWith(targetUrl),
          );
          if (!tab?.id) {
            reject(new Error(`Missing tab for ${targetUrl}`));
            return;
          }

          chrome.tabs.sendMessage(
            tab.id,
            { type: "ultimate-pip.toggle" },
            () => {
              const error = chrome.runtime.lastError;
              if (error) reject(new Error(error.message));
              else resolve();
            },
          );
        });
      }),
    { targetUrl: url },
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
  overlayCorner: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  overlayOffsetX: number;
  overlayOffsetY: number;
  unblockVideoPiP: boolean;
  debugLogging: boolean;
}
