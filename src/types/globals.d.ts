declare const browser: typeof chrome | undefined;
declare const __BROWSER__: "chrome" | "firefox" | "edge";
declare const __DEV__: boolean;
declare const __BUILD_DATE__: string;

declare module "*.svg?raw" {
  const content: string;
  export default content;
}
