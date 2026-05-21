import { mkdtemp, readFile, stat } from "node:fs/promises";
import { mkdtempSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  createServer,
  type RequestListener,
  type Server as HttpServer,
} from "node:http";
import {
  createServer as createHttpsServer,
  type Server as HttpsServer,
} from "node:https";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import {
  CHROMIUM_DEV_EXTENSION_ID,
  CHROMIUM_LOCAL_PROD_EXTENSION_ID,
} from "../../src/core/runtime-messages";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
};

export interface FixtureServer {
  origin: string;
  youtubeOrigin: string;
  close: () => Promise<void>;
}

export async function startFixtureServer(): Promise<FixtureServer> {
  const root = resolve("fixtures/e2e");
  const handler: RequestListener = async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const pathname = fixturePathFor(url.pathname);
      const filePath = resolve(root, `.${pathname}`);

      if (!filePath.startsWith(root)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      await stat(filePath);
      response.writeHead(200, {
        "content-type":
          CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
      });
      response.end(await readFile(filePath));
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  };
  const server = createServer(handler);
  const youtubeServer = createHttpsServer(
    createSelfSignedCertificate(),
    handler,
  );

  await listen(server);
  await listen(youtubeServer);

  const address = server.address();
  const youtubeAddress = youtubeServer.address();
  if (
    !address ||
    typeof address === "string" ||
    !youtubeAddress ||
    typeof youtubeAddress === "string"
  ) {
    throw new Error("Fixture server did not start with a TCP address");
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    youtubeOrigin: `https://www.youtube.com:${youtubeAddress.port}`,
    close: async () => {
      await closeServer(server);
      await closeServer(youtubeServer);
    },
  };
}

function fixturePathFor(pathname: string): string {
  if (pathname === "/") return "/pip-fixture.html";
  if (pathname === "/watch") return "/youtube-fixture.html";
  return pathname;
}

export async function launchExtensionContext(): Promise<{
  context: BrowserContext;
  extensionId: string;
}> {
  const extensionPath = resolve("dist-dev/chrome");
  const context = await launchContextWithExtensions([extensionPath]);

  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent("serviceworker");
  const extensionId = worker.url().split("/")[2];
  return { context, extensionId };
}

export async function launchProductionExtensionContext(): Promise<{
  context: BrowserContext;
  extensionId: string;
}> {
  const extensionPath = resolve("dist/chrome");
  const context = await launchContextWithExtensions([extensionPath]);

  await expectServiceWorker(context, CHROMIUM_LOCAL_PROD_EXTENSION_ID);
  return { context, extensionId: CHROMIUM_LOCAL_PROD_EXTENSION_ID };
}

export async function launchCoexistingExtensionContext(): Promise<{
  context: BrowserContext;
  prodExtensionId: string;
  devExtensionId: string;
}> {
  const prodExtensionPath = resolve("dist/chrome");
  const devExtensionPath = resolve("dist-dev/chrome");
  const context = await launchContextWithExtensions([
    prodExtensionPath,
    devExtensionPath,
  ]);

  await expectServiceWorker(context, CHROMIUM_LOCAL_PROD_EXTENSION_ID);
  await expectServiceWorker(context, CHROMIUM_DEV_EXTENSION_ID);
  return {
    context,
    prodExtensionId: CHROMIUM_LOCAL_PROD_EXTENSION_ID,
    devExtensionId: CHROMIUM_DEV_EXTENSION_ID,
  };
}

async function launchContextWithExtensions(
  extensionPaths: string[],
): Promise<BrowserContext> {
  const userDataDir = await mkdtemp(join(tmpdir(), "pip-anywhere-e2e-"));
  return chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: process.env.HEADED !== "1",
    ignoreHTTPSErrors: true,
    args: [
      `--disable-extensions-except=${extensionPaths.join(",")}`,
      `--load-extension=${extensionPaths.join(",")}`,
      "--host-resolver-rules=MAP www.youtube.com 127.0.0.1",
      "--ignore-certificate-errors",
    ],
  });
}

async function expectServiceWorker(
  context: BrowserContext,
  extensionId: string,
): Promise<void> {
  if (
    context
      .serviceWorkers()
      .some((worker) =>
        worker.url().startsWith(`chrome-extension://${extensionId}/`),
      )
  ) {
    return;
  }

  await context.waitForEvent("serviceworker", {
    predicate: (worker) =>
      worker.url().startsWith(`chrome-extension://${extensionId}/`),
  });
}

export async function closePage(page: Page | undefined): Promise<void> {
  if (page && !page.isClosed()) await page.close();
}

type FixtureNodeServer = HttpServer | HttpsServer;

async function listen(server: FixtureNodeServer): Promise<void> {
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
}

async function closeServer(server: FixtureNodeServer): Promise<void> {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) rejectClose(error);
      else resolveClose();
    });
  });
}

function createSelfSignedCertificate(): { key: Buffer; cert: Buffer } {
  const dir = mkdtempSync(join(tmpdir(), "pip-anywhere-cert-"));
  const keyPath = join(dir, "key.pem");
  const certPath = join(dir, "cert.pem");
  const result = spawnSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-days",
      "1",
      "-subj",
      "/CN=www.youtube.com",
      "-addext",
      "subjectAltName=DNS:www.youtube.com",
    ],
    { stdio: "ignore" },
  );

  if (result.status !== 0) {
    throw new Error("Unable to create self-signed HTTPS fixture certificate");
  }

  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  };
}
