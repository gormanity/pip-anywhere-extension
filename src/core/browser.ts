export function getBrowserApi(): typeof chrome {
  const globals = globalThis as typeof globalThis & {
    browser?: unknown;
    chrome?: unknown;
  };
  if (isExtensionApi(globals.browser)) return globals.browser;
  if (isExtensionApi(globals.chrome)) return globals.chrome;
  throw new Error("Browser extension API is unavailable");
}

function isExtensionApi(value: unknown): value is typeof chrome {
  return Boolean(
    value &&
    typeof value === "object" &&
    "runtime" in value &&
    typeof (value as typeof chrome).runtime?.getURL === "function",
  );
}
