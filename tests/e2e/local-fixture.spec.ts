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
  page = await context.newPage();
});

test("shows the hover overlay for eligible videos", async () => {
  await page!.goto(`${server.origin}/pip-fixture.html`);
  await expectVideoDuration("#eligible-video", 45);
  await hoverCenter(page!, "#eligible-video");

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
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Missing bounding box for ${selector}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
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
