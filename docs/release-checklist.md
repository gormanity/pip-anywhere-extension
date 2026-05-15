# Release Checklist

## Automated Checks

1. Run `pnpm run check`.
2. Run `pnpm run package`.
3. Run `pnpm run build:listings`.
4. Confirm release artifacts exist:
   - `releases/ultimate-pip-<version>-chrome.zip`
   - `releases/ultimate-pip-<version>-edge.zip`

## Manual Smoke

Run `docs/manual-smoke.md` before submitting store builds.

Required Chrome smoke targets:

- YouTube watch page
- YouTube homepage
- Netflix
- Twitch
- Vimeo
- one news site with inline video

Required Edge smoke targets:

- YouTube watch page
- YouTube homepage
- one streaming site

## Store Submission

1. Generate listing copy with `pnpm run build:listings`.
2. Use `dist/store/chrome.md` for Chrome Web Store fields.
3. Use `dist/store/edge.md` for Microsoft Edge Add-ons fields.
4. Use `store/privacy-policy.md` as the public privacy policy.
5. Upload screenshots and promo images from `store/screenshots/` and
   `store/promo/` once final assets are generated.

## Manual Browser-Managed Controls

Confirm these manually because they are browser-managed and not reliable in
headless automation:

- extension toolbar icon toggles PiP on an eligible video page
- configured keyboard shortcut toggles PiP on an eligible video page
- options page shortcut field reflects the assigned browser shortcut
