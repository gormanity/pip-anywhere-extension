export function getBrowserApi(): typeof chrome {
  return typeof browser !== "undefined" ? browser : chrome;
}
