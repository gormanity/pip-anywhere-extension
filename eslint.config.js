import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["src/injected/**/*.js"],
    languageOptions: {
      globals: {
        console: "readonly",
        CustomEvent: "readonly",
        document: "readonly",
        Element: "readonly",
        HTMLVideoElement: "readonly",
        MutationObserver: "readonly",
        window: "readonly",
      },
    },
  },
  {
    ignores: ["dist/**", "dist-dev/**", "node_modules/**", "releases/**"],
  },
);
