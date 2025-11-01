export function createPopup(options) {
  const {
    items = [],
    triggerElement = null,
    anchorPoint = null,
    onClose = () => {},
  } = options;
  const anchor = anchorPoint
    ? { x: anchorPoint.x ?? 0, y: anchorPoint.y ?? 0 }
    : null;

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  const popup = document.createElement("div");
  popup.className = "popup";

  const popupContent = document.createElement("div");
  popupContent.className = "popup-content";

  // Build options
  items.forEach((item) => {
    const button = document.createElement("button");
    button.className = "popup-option";
    button.type = "button";

    if (item.id) button.id = item.id;

    const icon = document.createElement("div");
    icon.className = "popup-option-icon";
    icon.innerHTML = item.icon || "";

    const content = document.createElement("div");
    content.className = "popup-option-content";

    const title = document.createElement("div");
    title.className = "popup-option-title";
    title.textContent = item.title || "";

    const description = document.createElement("div");
    description.className = "popup-option-description";
    description.textContent = item.description || "";

    content.appendChild(title);
    if (item.description) content.appendChild(description);

    button.appendChild(icon);
    button.appendChild(content);

    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        if (typeof item.onClick === "function") item.onClick(e);
      } catch (err) {
        console.error(err);
      }
      // Close after action
      closePopup();
    });

    popupContent.appendChild(button);
  });

  popup.appendChild(popupContent);

  // Append overlay (covers viewport) and add popup inside overlay so overlay
  // can correctly capture outside clicks and stacking order is predictable.
  // Append overlay and popup as siblings on body. Overlay sits below the
  // popup and captures outside clicks while the popup is visually on top.
  document.body.appendChild(overlay);
  document.body.appendChild(popup);
  // Ensure overlay and popup sit above most page content
  try {
    overlay.style.zIndex = "9999";
    popup.style.zIndex = "10000";
  } catch (_) {}
  // Use fixed positioning so coordinates are in viewport space
  popup.style.position = "fixed";
  // Start at viewport origin; final placement will use CSS variables and transform
  popup.style.left = "0px";
  popup.style.top = "0px";

  // Positioning helpers
  const viewportWidth = () => window.innerWidth;
  const viewportHeight = () => window.innerHeight;

  let lastKnownRect = null;
  if (
    triggerElement &&
    typeof triggerElement.getBoundingClientRect === "function"
  ) {
    try {
      const initialRect = triggerElement.getBoundingClientRect();
      if (initialRect) {
        lastKnownRect = {
          top: initialRect.top,
          left: initialRect.left,
          right: initialRect.right,
          bottom: initialRect.bottom,
          width: initialRect.width,
          height: initialRect.height,
        };
      }
    } catch (_) {}
  }

  const computeTriggerRect = () => {
    try {
      if (
        triggerElement &&
        typeof triggerElement.getBoundingClientRect === "function"
      ) {
        const r = triggerElement.getBoundingClientRect();
        // debug logging removed
        // Special-case: when the profile dropdown button is clicked some layout
        // changes may cause its rect to be transient/invalid. If that happens,
        // try to use the closest .profile-dropdown container or parent element
        // as a more stable anchor.
        if (
          triggerElement.id === "profileDropdownBtn" &&
          (r.width === 0 || r.height === 0 || Number.isNaN(r.top))
        ) {
          try {
            // debug logging removed
            const container = triggerElement.closest
              ? triggerElement.closest(".profile-dropdown")
              : triggerElement.parentElement;
            if (
              container &&
              typeof container.getBoundingClientRect === "function"
            ) {
              const cr = container.getBoundingClientRect();
              if (cr && (cr.width > 0 || cr.height > 0)) {
                // debug logging removed
                lastKnownRect = {
                  top: cr.top,
                  left: cr.left,
                  right: cr.right,
                  bottom: cr.bottom,
                  width: cr.width,
                  height: cr.height,
                };
                return lastKnownRect;
              }
            }
          } catch (_) {}
        }
        if (r) {
          lastKnownRect = {
            top: r.top,
            left: r.left,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          };
          return lastKnownRect;
        }
      }

      if (
        triggerElement &&
        typeof triggerElement.getClientRects === "function"
      ) {
        const rects = triggerElement.getClientRects();
        if (rects && rects.length > 0) {
          const rect = rects[0];
          lastKnownRect = {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          };
          return lastKnownRect;
        }
      }

      if (
        triggerElement?.parentElement &&
        typeof triggerElement.parentElement.getBoundingClientRect === "function"
      ) {
        const p = triggerElement.parentElement.getBoundingClientRect();
        if (p) {
          lastKnownRect = {
            top: p.top,
            left: p.left,
            right: p.right,
            bottom: p.bottom,
            width: p.width,
            height: p.height,
          };
          return lastKnownRect;
        }
      }

      if (anchor)
        return {
          top: anchor.y,
          left: anchor.x,
          right: anchor.x,
          bottom: anchor.y,
          width: 0,
          height: 0,
        };
      if (lastKnownRect) return lastKnownRect;
    } catch (err) {
      console.warn("computeTriggerRect error", err);
    }
    if (lastKnownRect) return lastKnownRect;
    return null;
  };
  // firstPositioning removed; measuring always runs synchronously now

  const reposition = () => {
    // Make sure popup is measurable: move offscreen briefly so layout stabilizes
    popup.style.left = "-9999px";
    popup.style.top = "-9999px";

    // debug logging removed

    const doMeasure = () => {
      const popupRect = popup.getBoundingClientRect();
      const triggerRect = computeTriggerRect();

      // debug logging removed

      if (triggerRect && (triggerRect.width > 0 || triggerRect.height > 0)) {
        let left = triggerRect.left;
        let top = triggerRect.bottom + 8;
        let transformOriginX = "left";
        let transformOriginY = "top";

        if (triggerRect.width === 0 && triggerRect.height === 0 && anchor) {
          left = anchor.x - popupRect.width / 2;
          top = anchor.y + 10;
          transformOriginX = "center";
        }

        const minLeft = 12;
        const maxLeft = viewportWidth() - popupRect.width - 12;

        if (left + popupRect.width > viewportWidth() - 12) {
          left = triggerRect.right - popupRect.width;
          transformOriginX = "right";
        }

        if (left < minLeft) {
          left = minLeft;
          transformOriginX = "left";
        }

        if (left > maxLeft) {
          left = maxLeft;
          transformOriginX = "right";
        }

        const minTop = 12;
        const maxTop = viewportHeight() - popupRect.height - 12;
        if (top > maxTop) {
          // flip above the trigger
          top = triggerRect.top - popupRect.height - 8;
          transformOriginY = "bottom";
        }

        if (top < minTop) {
          top = minTop;
          transformOriginY = "top";
        }

        // Apply final placement using CSS variables (translate) instead of inline left/top
        popup.style.left = "0px";
        popup.style.top = "0px";
        popup.style.setProperty("--popup-translate-x", `${Math.round(left)}px`);
        popup.style.setProperty("--popup-translate-y", `${Math.round(top)}px`);
        popup.style.transformOrigin = `${transformOriginX} ${transformOriginY}`;
        try {
          popupContent.style.transformOrigin = `${transformOriginX} ${transformOriginY}`;
        } catch (_) {}

        // debug logging removed

        // removed reposition debug log
      } else {
        // Center in viewport
        const left = Math.max(
          12,
          Math.min(
            (viewportWidth() - popupRect.width) / 2,
            viewportWidth() - popupRect.width - 12
          )
        );
        const top = Math.max(
          12,
          Math.min(
            (viewportHeight() - popupRect.height) / 2,
            viewportHeight() - popupRect.height - 12
          )
        );
        popup.style.left = "0px";
        popup.style.top = "0px";
        popup.style.setProperty("--popup-translate-x", `${Math.round(left)}px`);
        popup.style.setProperty("--popup-translate-y", `${Math.round(top)}px`);
        // removed center reposition debug log
        popup.style.transformOrigin = "center center";
        try {
          popupContent.style.transformOrigin = "center center";
        } catch (_) {}
        // debug logging removed
      }
    };

    // Always measure immediately; avoid special-case RAF delays which introduce
    // a perceptible lag on open. Keeping measurements synchronous here keeps
    // the popup appearing instantly at the computed location.
    try {
      firstPositioning = false;
    } catch (_) {}
    doMeasure();
  };

  // Show + initial position
  popup.style.opacity = "0";
  // Make visible immediately so CSS rules apply while we position
  overlay.classList.add("visible");
  popup.classList.add("visible");
  // Sanity: if some other code moved or removed nodes, make sure overlay
  // and popup are present and popupContent is a child of popup so CSS
  // selectors like `.popup.visible .popup-content` can apply.
  try {
    if (popupContent.parentElement !== popup) popup.appendChild(popupContent);
  } catch (_) {}
  try {
    if (popup.parentElement !== document.body) document.body.appendChild(popup);
  } catch (_) {}
  try {
    if (overlay.parentElement !== document.body)
      document.body.appendChild(overlay);
  } catch (_) {}

  // Position synchronously to avoid a 1-frame delay on show
  reposition();
  popup.style.opacity = "1";
  // Ensure inner content becomes visible even if CSS load is delayed
  try {
    popupContent.style.transform = "";
    popupContent.style.opacity = "";
  } catch (_) {}

  // Schedule a fallback reposition shortly after (fonts/images or layout may change)
  const fallbackTimer = setTimeout(() => {
    try {
      reposition();
    } catch (_) {}
  }, 50);
  overlay._fallbackTimer = fallbackTimer;

  // Keep popup positioned while it's open (scroll/resize/mutations)
  // Debounced reposition to avoid layout thrash when many mutations/scrolls occur
  let scheduled = false;
  const scheduleReposition = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      try {
        reposition();
      } finally {
        scheduled = false;
      }
    });
  };

  const handleResize = () => scheduleReposition();
  const handleScroll = () => scheduleReposition();
  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("scroll", handleScroll, { passive: true });

  // Limit observation scope to document.body (overlay covers viewport). Observing
  // body is cheaper now because subtree:false is used and reposition is debounced.
  const observeTarget = document.body;
  const observer = new MutationObserver(() => scheduleReposition());
  try {
    observer.observe(observeTarget, {
      attributes: true,
      childList: true,
      subtree: false,
    });
  } catch (_) {
    // Fallback to body if observing offsetParent fails for some reason
    try {
      observer.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: false,
      });
    } catch (_) {
      // give up silently; reposition still runs on resize/scroll
    }
  }

  // Attach these objects so closePopup can clean them up
  overlay._reposition = reposition;
  overlay._handleResize = handleResize;
  overlay._handleScroll = handleScroll;
  overlay._observer = observer;
  // Watch the popup element for child changes and re-attach popupContent if
  // some other code moves it elsewhere. This keeps `.popup .popup-content`
  // selectors working and avoids inconsistent animations.
  const popupContentObserver = new MutationObserver(() => {
    try {
      if (popupContent.parentElement !== popup) popup.appendChild(popupContent);
    } catch (_) {}
  });
  try {
    popupContentObserver.observe(popup, { childList: true });
  } catch (_) {}
  overlay._popupContentObserver = popupContentObserver;
  // expose popup element for external callers/debugging
  overlay._popup = popup;

  let isClosing = false;

  const closePopup = () => {
    if (isClosing) return;
    isClosing = true;
    // Start closing both overlay and popup so CSS transitions run on both.
    overlay.classList.remove("visible");
    overlay.classList.add("closing");
    popup.classList.remove("visible");
    popup.classList.add("closing");
    document.removeEventListener("keydown", handleKeyDown);
    // cleanup listeners and observer
    try {
      if (overlay._handleResize)
        window.removeEventListener("resize", overlay._handleResize);
      if (overlay._handleScroll)
        window.removeEventListener("scroll", overlay._handleScroll);
      if (overlay._observer) overlay._observer.disconnect();
      if (overlay._popupContentObserver)
        overlay._popupContentObserver.disconnect();
      if (overlay._fallbackTimer) clearTimeout(overlay._fallbackTimer);
    } catch (_) {}

    try {
      overlay.remove();
    } catch (_) {}
    try {
      popup.remove();
    } catch (_) {}
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") closePopup();
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePopup();
  });

  document.addEventListener("keydown", handleKeyDown);

  return {
    close: closePopup,
    element: overlay,
  };
}

export function createModal(options) {
  const {
    title = "",
    content = null,
    className = "",
    onClose = () => {},
    closeOnOverlayClick = true,
  } = options;

  const overlay = document.createElement("div");
  overlay.className = "composer-overlay";

  const modal = document.createElement("div");
  modal.className = `modal${className ? ` ${className}` : ""}`;

  const closeButton = document.createElement("button");
  closeButton.className = "modal-close";
  closeButton.type = "button";
  closeButton.innerHTML = `
		<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<line x1="18" y1="6" x2="6" y2="18"></line>
			<line x1="6" y1="6" x2="18" y2="18"></line>
		</svg>
	`;

  const closeModal = () => {
    overlay.remove();
    document.removeEventListener("keydown", handleKeyDown);
    onClose();
  };

  closeButton.addEventListener("click", closeModal);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  };

  document.addEventListener("keydown", handleKeyDown);

  if (title) {
    const modalHeader = document.createElement("div");
    modalHeader.className = "modal-header";
    const h2 = document.createElement("h2");
    h2.textContent = title;
    modalHeader.appendChild(h2);
    modal.appendChild(closeButton);
    modal.appendChild(modalHeader);
  } else {
    modal.appendChild(closeButton);
  }

  if (content) {
    modal.appendChild(content);
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // If this modal is the settings modal, enforce a stable wide size inline
  // so it can't be constrained by other generic modal rules elsewhere.
  if (className?.includes("settings-modal")) {
    try {
      modal.style.boxSizing = "border-box";
      // Use !important via setProperty to override ALL other CSS rules
      modal.style.setProperty(
        "width",
        "min(1400px, calc(100vw - 32px))",
        "important"
      );
      modal.style.setProperty("max-width", "1400px", "important");
      modal.style.setProperty("height", "min(90vh, 900px)", "important");
      modal.style.setProperty("max-height", "90vh", "important");
      modal.style.setProperty("overflow", "hidden", "important");
    } catch (_) {}
  }

  if (closeOnOverlayClick) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
  }

  // Prevent clicks inside modal from closing it
  modal.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  return {
    close: closeModal,
    element: overlay,
    modal,
  };
}
