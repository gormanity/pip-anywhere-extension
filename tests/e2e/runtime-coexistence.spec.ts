import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { DEV_HEARTBEAT_MESSAGE } from "../../src/core/runtime-coordinator";
import {
  closePage,
  launchCoexistingExtensionContext,
  launchProductionExtensionContext,
  startFixtureServer,
  type FixtureServer,
} from "./extension-fixture";

let server: FixtureServer;

test.beforeAll(async () => {
  server = await startFixtureServer();
});

test.afterAll(async () => {
  await server?.close();
});

test("local prod only preserves normal target-site behavior", async () => {
  const launched = await launchProductionExtensionContext();
  const context = launched.context;
  let page: Page | undefined;
  try {
    page = await context.newPage();
    await page.goto(`${server.origin}/pip-fixture.html`);
    await expectVideoDuration(page, "#eligible-video", 45);
    await page.waitForTimeout(600);
    await hoverCenter(page, "#eligible-video");

    await expect(page.locator("#ultimate-pip-overlay-prod")).toBeVisible();
  } finally {
    await closePage(page);
    await context.close();
  }
});

test("local dev wins when prod and dev are installed together", async () => {
  const launched = await launchCoexistingExtensionContext();
  const context = launched.context;
  let page: Page | undefined;
  try {
    page = await context.newPage();
    await page.goto(`${server.origin}/pip-fixture.html`);
    await expectVideoDuration(page, "#eligible-video", 45);
    await hoverCenter(page, "#eligible-video");

    await expect(page.locator("#ultimate-pip-overlay-dev")).toBeVisible();
    await expect(page.locator("#ultimate-pip-overlay-prod")).toHaveCount(0);
  } finally {
    await closePage(page);
    await context.close();
  }
});

test("prod duplicate state uses badge without an action popup", async () => {
  const launched = await launchCoexistingExtensionContext();
  const context = launched.context;
  try {
    await expect
      .poll(() => readActionState(context, launched.prodExtensionId))
      .toEqual({ badgeText: "OFF", popup: "" });
  } finally {
    await context.close();
  }
});

test("prod resumes after page-local dev heartbeat staleness", async () => {
  const launched = await launchProductionExtensionContext();
  const context = launched.context;
  let page: Page | undefined;
  try {
    page = await context.newPage();
    await page.addInitScript((message) => {
      window.postMessage(message, "*");
    }, DEV_HEARTBEAT_MESSAGE);
    await page.goto(`${server.origin}/pip-fixture.html`);
    await expectVideoDuration(page, "#eligible-video", 45);
    await hoverCenter(page, "#eligible-video");

    await expect(page.locator("#ultimate-pip-overlay-prod")).toHaveCount(0);
    await page.waitForTimeout(3600);
    await hoverCenter(page, "#eligible-video");
    await expect(page.locator("#ultimate-pip-overlay-prod")).toBeVisible();
  } finally {
    await closePage(page);
    await context.close();
  }
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

async function expectVideoDuration(
  page: Page,
  selector: string,
  duration: number,
): Promise<void> {
  await expect
    .poll(() =>
      page.locator(selector).evaluate((video) => {
        return (video as HTMLVideoElement).duration;
      }),
    )
    .toBeGreaterThanOrEqual(duration);
}

async function readActionState(
  context: BrowserContext,
  extensionId: string,
): Promise<{ badgeText: string; popup: string }> {
  const worker = context
    .serviceWorkers()
    .find((candidate) =>
      candidate.url().startsWith(`chrome-extension://${extensionId}/`),
    );
  if (!worker) throw new Error(`Missing service worker for ${extensionId}`);

  return await worker.evaluate(
    () =>
      new Promise<{ badgeText: string; popup: string }>((resolve) => {
        chrome.action.getBadgeText({}, (badgeText) => {
          chrome.action.getPopup({}, (popup) => {
            resolve({ badgeText, popup });
          });
        });
      }),
  );
}
