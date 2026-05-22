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
      "Upgrade picture-in-picture across HTML5 video with smart controls, deep customization, and site restriction unblocking.",

    detailedDescription: `PiP Anywhere makes picture-in-picture feel like a real browser feature in Chrome and Edge.

Pop videos out from more places with customizable controls, and unblock PiP on popular streaming sites including Netflix and Disney+. Whether a site's native controls are hidden, inconsistent, or intentionally restricted, PiP Anywhere gives you a consistent set of tools for getting video into a floating window and keeping it there.

FEATURES

• Works on popular streaming sites — unblock PiP on sites like Netflix and Disney+
• Click the video — add a PiP button directly over eligible videos
• Use the keyboard — trigger PiP with a configurable browser shortcut
• Pick the right video — use the toolbar picker to highlight page videos and choose the one you want
• Customize the experience — adjust hover delay, button size, opacity, placement, idle hiding, preview suppression, and minimum video length
• Control where it runs — disable PiP Anywhere on matching hosts or wildcard patterns

WHY IT EXISTS

Chrome and Edge ship with limited picture-in-picture controls, and some sites try to stop PiP from working at all. PiP Anywhere improves the browser's native PiP with better triggers, deeper customization, and unblocking for sites that get in the way.

PRIVACY

No personal data is collected or transmitted. The extension stores only your preferences in your browser's built-in sync storage. No analytics, tracking, accounts, or external services are used. Full privacy policy: https://github.com/gormanity/pip-anywhere-extension/blob/main/store/privacy-policy.md

OPEN SOURCE

Source code: https://github.com/gormanity/pip-anywhere-extension`,

    versionNotes: `Initial release candidate. Adds keyboard, toolbar video picker, and hover-overlay picture-in-picture controls for HTML5 video, configurable overlay behavior, per-site disabling, settings import/export, and best-effort video-level PiP unblocking.`,
  },

  categories: {
    chrome: "Productivity",
    edge: "Productivity",
  },

  reviewerNotes: {
    intro: `PiP Anywhere runs on pages with HTML5 video and provides user-triggered native picture-in-picture controls through the extension command, toolbar action, and injected hover overlay.`,

    verification: [
      "Load any page with an HTML5 video, such as a normal YouTube watch page, then hover the video to see the PiP overlay button.",
      "Click the hover overlay button to request native picture-in-picture for that video.",
      "Click the extension toolbar icon on a video page to highlight videos, then click a highlighted video to request PiP.",
      "Open the options page to adjust hover delay, minimum video length, drag-based overlay placement, hover icon size, hover icon opacity, idle hiding, per-site disable rules, settings import/export, and video-level unblocking.",
      "The extension uses `chrome.storage.sync` only for user preferences.",
      "The extension does not use remote code, external services, analytics, tracking, accounts, or network requests.",
      "Browser-level user activation, Permissions Policy, and DRM restrictions may still prevent PiP on some pages.",
    ],

    closingNote:
      "No extension-specific accounts, authentication, or test credentials are required.",
  },

  chrome: {
    singlePurpose:
      "Adds keyboard, toolbar video picker, and hover-overlay controls for triggering native picture-in-picture on HTML5 video pages in Chrome and Edge.",

    remoteCodeJustification:
      "This extension does not use remote code. All scripts, styles, and resources are bundled into the extension package at build time via Vite and shipped inside the .zip submitted to the store.",

    permissionJustifications: [
      {
        permission: "`activeTab`",
        justification:
          "Allows the toolbar video picker and keyboard command to target the currently active tab when the user explicitly invokes PiP.",
      },
      {
        permission: "`scripting`",
        justification:
          "Used after a user action to execute PiP trigger logic in the active tab and preserve the browser user gesture required by `requestPictureInPicture()`.",
      },
      {
        permission: "`storage`",
        justification:
          "Stores user preferences such as hover delay, overlay placement, hover icon size, hover icon opacity, minimum video length, site disable rules, and PiP unblocking behavior using browser sync storage.",
      },
      {
        permission: "Host permission: `<all_urls>`",
        justification:
          "The extension must detect HTML5 video elements and show the hover overlay on pages where videos appear. Broad host access is needed because users may want PiP on video embedded across arbitrary websites. The extension does not collect, transmit, or store page content.",
      },
    ],
  },

  edge: {
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
