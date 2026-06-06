# Release Checklist

Cutting a release means publishing a new semantic version. Do not move or
rebuild an existing `v*` tag unless the user explicitly asks for a rebuild.

## Version Bump

1. Start from the intended release source commit, not from unrelated local
   working-copy changes.
2. Bump `package.json` to the new version. This is the source of truth for
   manifest versions at build time.
3. Keep the version bump in its own commit:

   ```bash
   jj describe -m "chore: bump version to <version>"
   ```

4. Push the version-bump commit and verify the GitHub Actions CI run succeeds
   before tagging:

   ```bash
   jj bookmark set main -r <version-bump-revision>
   jj git push --bookmark main
   ```

## Automated Checks

1. Run `pnpm run check`.
2. Run `pnpm run package`.
3. Run `pnpm run build:listings`.
4. Confirm release artifacts exist:
   - `releases/ultimate-pip-<version>-chrome.zip`
   - `releases/ultimate-pip-<version>-edge.zip`
5. If screenshots, promo images, or listing visuals changed, run
   `pnpm run render:store-assets`.

## GitHub Release

Pushing a `v*` tag runs `.github/workflows/release.yml`, reruns
`pnpm run check`, packages Chrome and Edge zips, and publishes a GitHub release
with generated notes. Push exactly the new tag; do not use `git push --tags`.
This repository uses a tag-only Git push because the installed `jj` can track
tags but does not create new remote tags through `jj git push`.

```bash
jj tag set v<version> -r <version-bump-revision>
jj git export
git push origin refs/tags/v<version>:refs/tags/v<version>
```

After the push, verify the `Release` workflow completes successfully and that
the release contains:

- `ultimate-pip-<version>-chrome.zip`
- `ultimate-pip-<version>-edge.zip`

After verification, give the user the direct GitHub release link:
`https://github.com/gormanity/pip-anywhere-extension/releases/tag/v<version>`.

Draft release notes from the end-user perspective for manual approval before
publishing or updating notes. Focus on user-visible changes and improvements,
not implementation details.

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

1. Generate listing copy and upload-ready store icons with
   `pnpm run build:listings`.
2. Use `dist/store/chrome.md` for Chrome Web Store fields.
3. Use `dist/store/edge.md` for Microsoft Edge Add-ons fields.
4. Upload the store icon PNGs from `dist/store/icons/`.
5. Use `store/privacy-policy.md` as the public privacy policy.
6. Upload screenshots and promo images from `store/screenshots/` and
   `store/promo/` once final assets are generated.
7. Review listing copy, screenshots, promo images, and privacy copy for release
   accuracy, browser-store fit, and end-user value before submitting.

## Manual Browser-Managed Controls

Confirm these manually because they are browser-managed and not reliable in
headless automation:

- extension toolbar icon toggles PiP for the best eligible video
- configured auto-select keyboard shortcut toggles PiP on an eligible video page
  before any page click
- configured choose-video keyboard shortcut highlights eligible videos
- options page shortcut fields reflect the assigned browser shortcuts
