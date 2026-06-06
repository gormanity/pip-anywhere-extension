# Agent Guidelines

Read `README.md` for product context. This file covers how to work on the
codebase.

## Project Overview

PiP Anywhere is a Chrome and Edge MV3 extension that triggers native HTML5
picture-in-picture from:

- a browser-managed hotkey command,
- the extension toolbar icon,
- and a hover overlay injected over video elements.

It also makes a best-effort attempt to remove website-level video element PiP
blocks such as `disablePictureInPicture`. Browser-enforced Permissions Policy
blocks may still win and should be reported honestly.

## Repository Layout

```text
src/
  background/       # command/action routing to the active tab
  content/          # video discovery, overlay UI, and PiP triggering
  core/             # shared browser, settings, and PiP helpers
  injected/         # page-world scripts copied into extension builds
  manifests/        # per-browser MV3 manifests
  options/          # options page HTML/CSS/TS
  assets/           # source SVG icon
  types/            # extension globals
tests/              # Vitest unit tests for pure helpers
tests/e2e/          # Playwright local fixture smoke tests
fixtures/           # manual and automated local video fixtures
docs/               # manual release smoke checklists and project notes
store/              # listing source, privacy policy, screenshots, and promo plans
scripts/            # packaging scripts
dist/               # production build output, git-ignored
dist-dev/           # development build output, git-ignored
```

`CLAUDE.md` is a symlink to this file.

## VCS

- Use `jj` exclusively for version-control operations, except for the final
  tag-only `git push origin refs/tags/v<version>:refs/tags/v<version>` release
  step. This `jj` version can track tags but refuses to create new remote tags.
- Make changes atomic and tightly scoped.
- Run `jj status` before starting a new unit of work.
- If the current change already has unrelated content, create a new change with
  `jj new` before editing.
- Describe finished changes with `jj describe -m "message"`.
- Use commit messages in the form `type: summary`. For breaking changes, use
  `type!: summary`.
- Do not push until the feature is complete and checks pass.
- Before every push, run the CI-equivalent local checks for the work being
  published.
- After every push, verify the corresponding GitHub Actions run completed
  successfully.

## Commands

| Task                 | Command                        |
| -------------------- | ------------------------------ |
| Install deps         | `pnpm install`                 |
| Format               | `pnpm run format`              |
| Format check         | `pnpm run format:check`        |
| Lint                 | `pnpm run lint`                |
| Type check           | `pnpm run typecheck`           |
| Test                 | `pnpm run test`                |
| E2E test             | `pnpm run test:e2e`            |
| Headed E2E test      | `pnpm run test:e2e:headed`     |
| Dev build            | `pnpm run dev:build`           |
| Production build     | `pnpm run build`               |
| Build store listings | `pnpm run build:listings`      |
| Render store assets  | `pnpm run render:store-assets` |
| Full local check     | `pnpm run check`               |
| Package store zips   | `pnpm run package`             |
| Release checklist    | `docs/release-checklist.md`    |

## Build

The project uses Vite with one config per browser and shared build logic in
`vite.config.shared.ts`.

- Background and options scripts are bundled as ES modules.
- The content script is bundled as an IIFE so it does not rely on runtime module
  imports.
- Page-world scripts in `src/injected/` are copied as assets and exposed through
  `web_accessible_resources`.
- Manifests live in `src/manifests/` and receive `package.json` version during
  build.
- Icons are generated from `src/assets/icon.svg`.
- Store listing source lives in `store/listing.data.js`; generated per-store
  copy is written to `dist/store/` by `pnpm run build:listings`.
- Store screenshots and promo images are HTML-authored under `store/` and
  rendered to PNG with `pnpm run render:store-assets`.
- Firefox is not an MVP release target. Keep Firefox build scripts available for
  experiments, but do not let Firefox shape MVP product decisions unless the
  target browser scope changes.
- CI runs the same checks, packages Chrome and Edge zips, and uploads the zip
  files as workflow artifacts.
- Do not commit `dist/`, `dist-dev/`, `releases/`, or `node_modules/`.

## Code Conventions

- Use American English in code, comments, docs, and commit messages.
- Keep injected content-script behavior deterministic and small.
- Avoid runtime dependencies unless they are clearly justified.
- Prefer pure helpers in `src/core/` for testable behavior.
- Do not use inline scripts in extension HTML.
- Use the browser compatibility guard from `src/core/browser.ts` instead of
  referencing `browser` directly.
- Keep settings schema changes backward-compatible through
  `normalizeSettings()`.

## Testing

- Use Vitest for pure logic and small DOM units.
- Use Playwright for local unpacked-extension fixture smoke tests when browser
  behavior matters. Keep those tests on local fixtures, not third-party sites.
- Keep third-party site coverage in `docs/manual-smoke.md`.
- Run `pnpm run check` before considering a feature complete.

## Release Process

- In this repo, "cut a release" means creating a new semantic version. Do not
  move or rebuild an existing `v*` tag unless the user explicitly asks for a
  rebuild.
- Bump the version in `package.json`; manifest versions are injected from that
  value at build time.
- Keep the version bump in its own commit, normally as a child of the release
  source commit. If the current working copy has unrelated changes, create a
  separate jj change or workspace before editing.
- Run `pnpm run check`, `pnpm run package`, and `pnpm run build:listings`
  locally before tagging. Confirm the generated zip filenames use the new
  version.
- If screenshots, promo images, or listing visuals changed, run
  `pnpm run render:store-assets` and review the generated store assets.
- Push the version-bump commit first with
  `jj bookmark set main -r <version-bump-revision>` and
  `jj git push --bookmark main`; verify CI is green before tagging.
- Create the release tag on the version-bump commit:
  `jj tag set v<version> -r <revision>`.
- Export refs if needed, then push exactly the new tag:
  `git push origin refs/tags/v<version>:refs/tags/v<version>`. Do not use
  `git push --tags`.
- Verify the `Release` workflow completes successfully and that the GitHub
  release contains Chrome and Edge zip assets for the new version.
- After verification, give the user the direct GitHub release link:
  `https://github.com/gormanity/pip-anywhere-extension/releases/tag/v<version>`.
- Review `store/` listing copy, generated listing files, screenshots, promo
  images, and `store/privacy-policy.md` for release accuracy, browser-store
  fit, and user value before store submission.
- Draft release notes from the end-user perspective for manual approval before
  publishing or updating release notes. Focus on user-visible changes and
  improvements; avoid internal implementation details and known-limitations
  boilerplate unless the user asks for it.

## Pitfalls

- `requestPictureInPicture()` usually requires user activation. Toolbar clicks,
  command shortcuts, and overlay clicks preserve the best chance of activation;
  deferred or background-only calls can fail.
- Firefox and Chromium differ in MV3 background behavior. Firefox support is
  non-MVP; keep any Firefox-specific work isolated in `src/manifests/`.
- Content scripts may run in iframes. Avoid global state that assumes a single
  top-level document.
- Page-level browser policy can still block PiP. Do not claim that every block
  is bypassable.
