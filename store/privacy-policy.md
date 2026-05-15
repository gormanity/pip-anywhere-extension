# Privacy Policy — PiP Anywhere

_Last updated: May 2026_

---

## Summary

PiP Anywhere does not collect, transmit, sell, or share personal data. It stores
only extension preferences in your browser's built-in sync storage.

---

## Data stored

The extension stores these preferences using the browser's `storage.sync` API:

| Key                             | Type    | Description                                           |
| ------------------------------- | ------- | ----------------------------------------------------- |
| `hoverOverlayEnabled`           | boolean | Whether the hover overlay button is enabled           |
| `hoverDelayMs`                  | number  | Delay before showing the hover overlay                |
| `minimumOverlayDurationSeconds` | number  | Minimum video length for hover overlay eligibility    |
| `overlayCorner`                 | string  | Preferred overlay corner                              |
| `overlayOffsetX`                | number  | Horizontal overlay offset                             |
| `overlayOffsetY`                | number  | Vertical overlay offset                               |
| `unblockVideoPiP`               | boolean | Whether to clear video-level PiP blocks when possible |
| `debugLogging`                  | boolean | Development-build-only diagnostic logging preference  |

These values are stored locally in your browser and may sync through your
browser account if browser sync is enabled. They are never sent to any server
operated by this extension.

---

## Data not collected

- No browsing history
- No page content
- No video content
- No personal information
- No analytics or telemetry
- No cookies
- No account information
- No communication with external servers

---

## Permissions

| Permission                    | Purpose                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `activeTab`                   | Target the active tab when the user invokes the toolbar action or keyboard command |
| `scripting`                   | Run user-triggered PiP logic in the active tab                                     |
| `storage`                     | Save extension preferences                                                         |
| Host permission: `<all_urls>` | Detect HTML5 videos and show the hover overlay wherever users encounter video      |

---

## Third-party services

None. The extension makes no network requests.

---

## Changes to this policy

Any future changes will be reflected in the extension's GitHub repository:
https://github.com/gormanity/ultimate-pip-extension

---

## Contact

To report a concern, open an issue at:
https://github.com/gormanity/ultimate-pip-extension/issues
