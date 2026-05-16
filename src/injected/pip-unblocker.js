(() => {
  const currentScript = document.currentScript;
  const scriptSrc =
    currentScript && "src" in currentScript ? currentScript.src : "";
  const runtime = /[?&]runtime=(dev|prod)\b/.exec(scriptSrc)?.[1];
  const runtimeKind = runtime === "dev" ? "dev" : "prod";
  const configEvent = `ultimate-pip.configure.${runtimeKind}`;
  const diagnosticEvent = `ultimate-pip.diagnostic.${runtimeKind}`;
  const state = {
    enabled: true,
    debug: false,
    installed: false,
    originalDescriptor: null,
  };

  function log(...args) {
    if (state.debug) {
      console.debug("[ultimate-pip:page]", ...args);
    }
  }

  function emitDiagnostic(type, detail = {}) {
    window.dispatchEvent(
      new CustomEvent(diagnosticEvent, {
        detail: { type, ...detail },
      }),
    );
  }

  function cleanVideo(video) {
    if (!(video instanceof HTMLVideoElement)) return;

    try {
      if (state.originalDescriptor?.set) {
        state.originalDescriptor.set.call(video, false);
      } else {
        video.disablePictureInPicture = false;
      }
    } catch {
      // Some browser/site combinations expose a read-only implementation.
    }

    video.removeAttribute("disablepictureinpicture");
    video.removeAttribute("controlslist");
    emitDiagnostic("video-cleaned");
  }

  function cleanAllVideos(root = document) {
    for (const video of root.querySelectorAll("video")) {
      cleanVideo(video);
    }
  }

  function installPropertyOverride() {
    if (state.installed) return;

    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLVideoElement.prototype,
      "disablePictureInPicture",
    );
    if (!descriptor?.configurable) {
      log("disablePictureInPicture descriptor is not configurable");
      return;
    }

    state.originalDescriptor = descriptor;
    Object.defineProperty(
      HTMLVideoElement.prototype,
      "disablePictureInPicture",
      {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
          if (state.enabled) return false;
          return descriptor.get ? descriptor.get.call(this) : false;
        },
        set(value) {
          if (state.enabled) {
            if (value) log("Blocked disablePictureInPicture setter", this);
            if (descriptor.set) descriptor.set.call(this, false);
            emitDiagnostic("setter-blocked", { requestedValue: value });
            this.removeAttribute("disablepictureinpicture");
            return;
          }
          if (descriptor.set) descriptor.set.call(this, value);
        },
      },
    );

    state.installed = true;
    emitDiagnostic("property-override-installed");
  }

  function observeDom() {
    const observer = new MutationObserver((mutations) => {
      if (!state.enabled) return;

      for (const mutation of mutations) {
        if (mutation.target instanceof HTMLVideoElement) {
          cleanVideo(mutation.target);
        }

        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLVideoElement) cleanVideo(node);
          if (node instanceof Element) cleanAllVideos(node);
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["disablepictureinpicture", "controlslist"],
      childList: true,
      subtree: true,
    });
  }

  window.addEventListener(configEvent, (event) => {
    const detail = event instanceof CustomEvent ? event.detail : {};
    state.enabled = detail?.enabled !== false;
    state.debug = detail?.debug === true;
    if (state.enabled) cleanAllVideos();
  });

  installPropertyOverride();
  observeDom();
  cleanAllVideos();
})();
