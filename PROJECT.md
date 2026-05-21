# PiP Anywhere Project Notes

## Dev/Prod Coexistence Details

PiP Anywhere coordinates the browser-extension runtime and the page content
runtime so a local dev build can be installed beside a local prod build. When
both are active, dev wins and prod becomes duplicate-disabled.

The mechanism is deliberately local and permission-light:

- No `management` permission is used.
- Extension IDs come from build-time manifest keys.
- The only cross-extension surface is `externally_connectable`, restricted to
  the expected counterpart ID.
- Local prod accepts presence only from local dev.
- Local dev accepts presence probes only from local prod.

Chrome IDs:

| Build      | ID                                 | Folder loaded locally |
| ---------- | ---------------------------------- | --------------------- |
| Local prod | `dakagfnbbijbflodaajdfgdiddgobjhl` | `dist/chrome`         |
| Local dev  | `cjodjanjoahbgiigloplfkiikoejgoge` | `dist-dev/chrome`     |

Timing:

| Setting                    | Value    | Purpose                                     |
| -------------------------- | -------- | ------------------------------------------- |
| Prod content startup grace | `500ms`  | Let dev announce before prod starts on-page |
| Dev heartbeat interval     | `1000ms` | Keep page-local and external presence fresh |
| Dev stale timeout          | `3500ms` | Let prod resume after dev disappears        |

Runtime coordination happens in two places:

- The dev background announces presence to the known local prod ID with
  `chrome.runtime.sendMessage`.
- The dev content runtime posts a page-local heartbeat so prod content can
  suspend on already-open video pages.

When prod is duplicate-disabled, the action icon switches to an OFF state, the
badge reads `OFF`, and `popup.html` reports that production is disabled by the
dev build. Without dev, prod keeps its normal action behavior and the toolbar
click starts video selection.

On prod content suspension, teardown removes extension-owned DOM and runtime
hooks: document/window listeners, storage/runtime message listeners, mutation
observers, hover timers, toast timers, animation frames, hover overlays, picker
targets, toast UI, injected styles, observed-video markers, and the page-world
PiP unblocker bridge.

Local test flow:

```bash
pnpm run dev:build:chrome
pnpm run build:chrome
```

Then load both folders from `chrome://extensions`:

1. `dist/chrome` for local prod.
2. `dist-dev/chrome` for local dev.

Remaining risks:

- There is a short startup window before the first dev heartbeat or probe is
  observed. Prod waits `500ms` on-page before starting to reduce visible
  collisions.
- If a browser delays extension service worker startup, prod may briefly show
  as enabled until the dev background heartbeat or popup probe arrives.
- Page-level Permissions Policy, DRM behavior, and user-activation rules can
  still block native PiP; coexistence only chooses which extension runtime owns
  the attempt.
