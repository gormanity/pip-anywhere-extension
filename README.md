# PiP Anywhere

PiP Anywhere is a Chrome, Firefox, and Edge extension for triggering native HTML5
picture-in-picture from a keyboard shortcut, the toolbar icon, or a hover
overlay on video elements.

## Features

- Browser command for toggling PiP on the active tab.
- Toolbar action that sends the same PiP toggle to the active tab.
- Hover overlay button for HTML5 video elements.
- Best-effort clearing of video-level `disablePictureInPicture` blocks.
- Options page for hover delay, minimum video length, overlay placement and
  offsets, PiP unblocking, shortcut management, and dev-only debug logging.

Browser-enforced site policies may still prevent PiP on some pages. The
extension removes blocks it can control at the video element level.

## Development

```bash
pnpm install
pnpm run dev:build
pnpm run check
```

Development builds are emitted to `dist-dev/{chrome,firefox,edge}`. Production
builds are emitted to `dist/{chrome,firefox,edge}`.

For a repeatable local smoke test, open
`fixtures/manual/pip-test.html` after loading a dev build. It includes a normal
video, a video that repeatedly tries to disable PiP, and an iframe video.

Automated e2e tests load the unpacked Chrome dev build in Chromium and exercise
the HTTP-served fixture in `fixtures/e2e/`.

Use `docs/manual-smoke.md` for the real-site smoke checklist before release.

## Commands

| Task                   | Command                        |
| ---------------------- | ------------------------------ |
| Dev build all browsers | `pnpm run dev:build`           |
| Build all browsers     | `pnpm run build`               |
| Type check             | `pnpm run typecheck`           |
| Unit test              | `pnpm run test`                |
| E2E test               | `pnpm run test:e2e`            |
| Headed E2E test        | `pnpm run test:e2e:headed`     |
| Full check             | `pnpm run check`               |
| Package zips           | `pnpm run package`             |
| Firefox add-on lint    | `pnpm run lint:addons:firefox` |
| Manual smoke checklist | `docs/manual-smoke.md`         |
