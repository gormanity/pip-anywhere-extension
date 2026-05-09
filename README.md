# Ultimate PiP

Ultimate PiP is a Chrome, Firefox, and Edge extension for triggering native
HTML5 picture-in-picture from a keyboard shortcut, the toolbar icon, or a hover
overlay on video elements.

## Features

- Browser command for toggling PiP on the active tab.
- Toolbar action that sends the same PiP toggle to the active tab.
- Hover overlay button for HTML5 video elements.
- Best-effort clearing of video-level `disablePictureInPicture` blocks.
- Options page for hover delay, overlay behavior, PiP unblocking, shortcut
  management, and debug logging.

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

## Commands

| Task                   | Command              |
| ---------------------- | -------------------- |
| Dev build all browsers | `pnpm run dev:build` |
| Build all browsers     | `pnpm run build`     |
| Type check             | `pnpm run typecheck` |
| Test                   | `pnpm run test`      |
| Full check             | `pnpm run check`     |
| Package zips           | `pnpm run package`   |
