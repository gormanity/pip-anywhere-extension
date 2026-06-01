// Source of truth for store listings.
// Consumed by scripts/build-listings.js to generate per-store copy in dist/store/.

export default {
  meta: {
    name: "PiP Anywhere",
    officialUrl: "https://github.com/gormanity/pip-anywhere-extension",
    homepageUrl: "https://github.com/gormanity/pip-anywhere-extension",
    supportUrl: "https://github.com/gormanity/pip-anywhere-extension/issues",
    privacyPolicyUrl:
      "https://github.com/gormanity/pip-anywhere-extension/blob/main/store/privacy-policy.md",
    language: "English (en-US)",
    supportEmail: null,
    license: "MIT",
  },

  copy: {
    shortDescription:
      "Add hover, hotkey, toolbar, and custom PiP controls for HTML5 video, with best-effort site unblocking.",

    detailedDescription: `PiP Anywhere gives Chrome and Edge the picture-in-picture controls they leave out and helps restore PiP where sites hide or disable it.

Use it as the one PiP extension for opening and customizing HTML5 video. Trigger native picture-in-picture from a hover button, browser-managed shortcuts, the extension toolbar icon, or highlighted video selection. When sites hide PiP controls or disable video-level PiP, PiP Anywhere also makes a best-effort attempt to clear those blocks when the browser allows, including on popular streaming sites like Netflix and Disney+.

FEATURES

• Open PiP your way — use the hover button, browser-managed auto-select shortcut, highlighted-selection shortcut, or extension toolbar action
• Pick the right video — highlight page videos and choose the exact target
• Tune the controls — adjust hover delay, button size, opacity, placement, idle hiding, preview suppression, and minimum video length
• Best-effort unblocking — helps when sites hide or disable video-level PiP and browser policy allows
• Works on key streaming sites — helps on sites like Netflix and Disney+
• Control where it runs — disable PiP Anywhere on matching hosts or wildcard patterns
• Stay private — no tracking, no analytics, no accounts, no external servers

WHY IT EXISTS

Chrome and Edge support native picture-in-picture, but the built-in controls are limited and sites can still get in the way. PiP Anywhere fills that gap with stronger activation paths, practical customization, and honest best-effort unblocking for browser-controlled video restrictions.

PRIVACY

No personal data is collected or transmitted. The extension stores only your preferences in your browser's built-in sync storage. No analytics, tracking, accounts, or external services are used. Full privacy policy: https://github.com/gormanity/pip-anywhere-extension/blob/main/store/privacy-policy.md

OPEN SOURCE

Source code: https://github.com/gormanity/pip-anywhere-extension`,

    versionNotes: `Initial release candidate. Adds keyboard, toolbar, highlighted selection, and hover-overlay picture-in-picture controls for HTML5 video, configurable overlay behavior, per-site disabling, settings import/export, and best-effort video-level PiP unblocking.`,
  },

  categories: {
    chrome: "Functionality & UI",
    edge: "Productivity",
  },

  reviewerNotes: {
    intro: `PiP Anywhere runs on pages with HTML5 video and provides native picture-in-picture controls through the extension command, toolbar action, and injected hover overlay. Broad host access is required for the always-available hover overlay and video-level PiP unblocking; activeTab alone would limit the extension to pages after a toolbar or shortcut gesture and would remove the core hover-button behavior.`,

    verification: [
      "Load any page with an HTML5 video, such as a normal YouTube watch page, then hover the video to see the PiP overlay button.",
      "Click the hover overlay button to request native picture-in-picture for that video.",
      "Click the extension toolbar icon on a video page to highlight eligible videos; enable toolbar auto-select in options to target the best video instead.",
      "Open the options page to adjust toolbar auto-select, browser-managed shortcuts, hover delay, minimum video length, drag-based overlay placement, hover icon size, hover icon opacity, idle hiding, per-site disable rules, settings import/export, and video-level unblocking.",
      "The extension uses `chrome.storage.sync` only for user preferences.",
      "The extension does not use remote code, external services, analytics, tracking, accounts, or network requests.",
      "The content script only detects and modifies local HTML5 video elements needed for PiP controls; it does not collect page text, video content, browsing history, form data, cookies, or account information.",
      "Browser-level user activation, Permissions Policy, and DRM restrictions may still prevent PiP on some pages.",
    ],

    closingNote:
      "No extension-specific accounts, authentication, or test credentials are required.",
  },

  chrome: {
    singlePurpose:
      "Adds hover, auto-select shortcut, highlighted selection, toolbar, customization controls, and best-effort video-level PiP unblocking for HTML5 video in Chrome and Edge.",

    remoteCodeJustification:
      "This extension does not use remote code. All scripts, styles, and resources are bundled into the extension package at build time via Vite and shipped inside the .zip submitted to the store.",

    permissionJustifications: [
      {
        permission: "`activeTab`",
        justification:
          "Allows toolbar actions and keyboard commands to target the currently active tab when the user explicitly invokes PiP.",
      },
      {
        permission: "`scripting`",
        justification:
          "Used after a user action to execute PiP trigger logic in the active tab and preserve the browser user gesture required by `requestPictureInPicture()`.",
      },
      {
        permission: "`storage`",
        justification:
          "Stores user preferences such as toolbar auto-select behavior, hover delay, overlay placement, hover icon size, hover icon opacity, minimum video length, site disable rules, and PiP unblocking behavior using browser sync storage.",
      },
      {
        permission: "Host permission: `<all_urls>`",
        justification:
          "Required for the core hover overlay and video-level PiP unblocking. HTML5 video can appear on arbitrary sites and in same-origin iframes, so the content script must run where users encounter video before they click the toolbar icon. `activeTab` is already used for explicit toolbar/shortcut actions, but activeTab-only access would remove the always-available hover button. The extension only inspects local video elements and does not collect, transmit, or store page content.",
      },
    ],
  },

  edge: {
    singlePurpose:
      "Adds hover, keyboard shortcut, toolbar, and customization controls for opening HTML5 videos in native picture-in-picture, with best-effort video-level PiP unblocking.",

    // Edge Add-ons constraints: max 7 terms, 30 chars per term, 21 words total.
    searchTerms: [
      "picture in picture",
      "PiP video",
      "video popout",
      "HTML5 video",
      "floating video",
      "YouTube PiP",
      "video multitasking",
    ],
  },
};
