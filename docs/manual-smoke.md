# Manual Smoke Checklist

Use this checklist after the local automated checks pass and before cutting a
release candidate.

## Setup

1. Run `pnpm run dev:build:chrome`.
2. Load `dist-dev/chrome` as an unpacked extension in Chrome or Edge.
3. For Firefox, run `pnpm run dev:build:firefox` and load `dist-dev/firefox`
   through `about:debugging`.
4. Open the options page and confirm shortcut text, hover delay, placement,
   minimum duration, and unblocking settings render correctly.

## Local Fixture

Open `fixtures/manual/pip-test.html` and verify:

- Hover overlay appears on the normal video.
- Overlay click attempts PiP and shows useful feedback if the browser blocks it.
- The blocked-video case has `disablePictureInPicture` cleared.
- Toolbar click and keyboard shortcut target the best eligible video.
- Same-origin iframe video can be discovered.

## Real Sites

Check at least Chrome before release; include Firefox and Edge when touching
browser-specific manifest or background behavior.

- YouTube watch page: overlay appears on the main player, toolbar and shortcut
  work after page interaction.
- YouTube homepage: thumbnail preview overlays stay suppressed.
- Netflix: policy override still clears video-level PiP blocking where possible.
- Twitch: live stream remains eligible even without finite duration.
- Vimeo: normal player hover and toolbar flow work.
- A news site with inline videos: short preview/advertisement overlays are not
  too noisy.

Record browser, site, and result in the release notes or PR description.
