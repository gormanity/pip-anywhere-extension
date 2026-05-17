# PiP Anywhere

PiP Anywhere is a Chrome and Edge extension for triggering native HTML5
picture-in-picture from a keyboard shortcut, the toolbar icon, or a hover
overlay on video elements.

## Features

- Browser command for toggling PiP on the active tab.
- Toolbar action that highlights page videos so you can choose the PiP target.
- Hover overlay button for HTML5 video elements, with configurable placement,
  size, opacity, delay, idle hiding, and minimum video length.
- Best-effort clearing of video-level `disablePictureInPicture` blocks.
- Options page for shortcut management, import/export, per-site disable rules
  with regex support, PiP unblocking, and dev-only debug logging.

Browser-enforced site policies may still prevent PiP on some pages. The
extension removes blocks it can control at the video element level.

## Development

```bash
pnpm install
pnpm run dev:build
pnpm run check
```

Development builds are emitted to `dist-dev/{chrome,edge}`. Production builds
are emitted to `dist/{chrome,edge}`.

For a repeatable local smoke test, open
`fixtures/manual/pip-test.html` after loading a dev build. It includes a normal
video, a video that repeatedly tries to disable PiP, and an iframe video.

Automated e2e tests load the unpacked Chrome dev build in Chromium and exercise
the HTTP-served fixture in `fixtures/e2e/`.

Use `docs/manual-smoke.md` for the real-site smoke checklist before release.

## Commands

| Task                   | Command                        |
| ---------------------- | ------------------------------ |
| Dev build Chrome/Edge  | `pnpm run dev:build`           |
| Build Chrome/Edge      | `pnpm run build`               |
| Build store listings   | `pnpm run build:listings`      |
| Render store assets    | `pnpm run render:store-assets` |
| Type check             | `pnpm run typecheck`           |
| Unit test              | `pnpm run test`                |
| E2E test               | `pnpm run test:e2e`            |
| Headed E2E test        | `pnpm run test:e2e:headed`     |
| Full check             | `pnpm run check`               |
| Package zips           | `pnpm run package`             |
| Release checklist      | `docs/release-checklist.md`    |
| Manual smoke checklist | `docs/manual-smoke.md`         |

Firefox is not an MVP release target. Native Firefox PiP already covers much of
the product value, including its own override flow for video-level PiP opt-outs.
Firefox build scripts remain available for experiments, but they are not part of
the default build, package, or CI path.
