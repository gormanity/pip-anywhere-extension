// Source of truth for store listings.
// Consumed by scripts/build-listings.js to generate per-store copy in dist/store/.

export default {
  meta: {
    name: "PiP Anywhere",
    officialUrl: "https://github.com/gormanity/ultimate-pip-extension",
    homepageUrl: "https://github.com/gormanity/ultimate-pip-extension",
    supportUrl: "https://github.com/gormanity/ultimate-pip-extension/issues",
    privacyPolicyUrl:
      "https://github.com/gormanity/ultimate-pip-extension/blob/main/store/privacy-policy.md",
    language: "English (en-US)",
    supportEmail: null,
    license: "MIT",
  },

  copy: {
    shortDescription:
      "Keyboard, toolbar, and hover picture-in-picture controls for HTML5 video.",

    detailedDescription: `PiP Anywhere gives you faster, more reliable picture-in-picture controls for HTML5 video in Chrome and Edge.

Native browser PiP is useful, but the controls can be hidden, inconsistent, or blocked by video sites. PiP Anywhere adds a consistent command layer so you can pop videos out from the keyboard, toolbar, or an on-video hover button.

FEATURES

• Hover overlay — show a PiP button directly over eligible videos
• Browser shortcut — toggle PiP from a configurable extension command
• Toolbar action — click the extension icon to toggle PiP for the best video on the page
• Best-effort unblocking — clears video-level PiP blocks such as disablePictureInPicture when possible
• Smarter preview handling — suppresses noisy overlays on short videos and YouTube homepage previews
• Configurable behavior — set hover delay, minimum video length, overlay corner, and X/Y offsets
• Useful feedback — shows clear messages when the browser requires page interaction or no eligible video exists

WHY IT EXISTS

Some sites make picture-in-picture harder than it needs to be. PiP Anywhere focuses on native HTML5 video and uses the browser's built-in PiP implementation, while giving you better ways to trigger it.

LIMITATIONS

PiP Anywhere cannot bypass every browser-level restriction. In particular, browser-enforced Permissions Policy, DRM behavior, and user-activation requirements may still prevent PiP on some pages. When that happens, the extension reports the limitation honestly instead of claiming a guaranteed bypass.

PRIVACY

No personal data is collected or transmitted. The extension stores only your preferences in your browser's built-in sync storage. No analytics, tracking, accounts, or external services are used. Full privacy policy: https://github.com/gormanity/ultimate-pip-extension/blob/main/store/privacy-policy.md

OPEN SOURCE

Source code: https://github.com/gormanity/ultimate-pip-extension`,

    versionNotes: `Initial release candidate. Adds keyboard, toolbar, and hover-overlay picture-in-picture controls for HTML5 video, configurable overlay behavior, and best-effort video-level PiP unblocking.`,
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
      "Click the extension toolbar icon on a video page to toggle PiP for the best eligible video.",
      "Open the options page to adjust hover delay, minimum video length, overlay corner, X/Y offsets, and video-level unblocking.",
      "The extension uses `chrome.storage.sync` only for user preferences.",
      "The extension does not use remote code, external services, analytics, tracking, accounts, or network requests.",
      "Browser-level user activation, Permissions Policy, and DRM restrictions may still prevent PiP on some pages.",
    ],

    closingNote:
      "No extension-specific accounts, authentication, or test credentials are required.",
  },

  chrome: {
    singlePurpose:
      "Adds keyboard, toolbar, and hover-overlay controls for triggering native picture-in-picture on HTML5 video pages in Chrome and Edge.",

    remoteCodeJustification:
      "This extension does not use remote code. All scripts, styles, and resources are bundled into the extension package at build time via Vite and shipped inside the .zip submitted to the store.",

    permissionJustifications: [
      {
        permission: "`activeTab`",
        justification:
          "Allows the toolbar action and keyboard command to target the currently active tab when the user explicitly invokes PiP.",
      },
      {
        permission: "`scripting`",
        justification:
          "Used after a user action to execute PiP trigger logic in the active tab and preserve the browser user gesture required by `requestPictureInPicture()`.",
      },
      {
        permission: "`storage`",
        justification:
          "Stores user preferences such as hover delay, overlay placement, minimum video length, and PiP unblocking behavior using browser sync storage.",
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
