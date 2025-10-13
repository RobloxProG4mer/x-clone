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

  // Positioning helpers
  const viewportWidth = () => window.innerWidth;
  const viewportHeight = () => window.innerHeight;

  let lastKnownRect = null;
  if (triggerElement && typeof triggerElement.getBoundingClientRect === "function") {
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
      if (triggerElement && typeof triggerElement.getBoundingClientRect === "function") {
        const r = triggerElement.getBoundingClientRect();
        if (r) {
          lastKnownRect = { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
          return lastKnownRect;
        }
      }

      if (triggerElement && typeof triggerElement.getClientRects === "function") {
        const rects = triggerElement.getClientRects();
        if (rects && rects.length > 0) {
          const rect = rects[0];
          lastKnownRect = { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
          return lastKnownRect;
        }
      }

      if (triggerElement && triggerElement.parentElement && typeof triggerElement.parentElement.getBoundingClientRect === "function") {
        const p = triggerElement.parentElement.getBoundingClientRect();
        if (p) {
          lastKnownRect = { top: p.top, left: p.left, right: p.right, bottom: p.bottom, width: p.width, height: p.height };
          return lastKnownRect;
        }
      }

      if (anchor) return { top: anchor.y, left: anchor.x, right: anchor.x, bottom: anchor.y, width: 0, height: 0 };
      if (lastKnownRect) return lastKnownRect;
    } catch (err) {
      console.warn("computeTriggerRect error", err);
    }
    if (lastKnownRect) return lastKnownRect;
    return null;
  };

  const reposition = () => {
    // Make sure popup is measurable
    popup.style.left = "-9999px";
    popup.style.top = "-9999px";

    const popupRect = popup.getBoundingClientRect();
    const triggerRect = computeTriggerRect();

    if (triggerRect && (triggerRect.width > 0 || triggerRect.height > 0)) {
      let left = triggerRect.left;
      let top = triggerRect.bottom + 8;
      let transformOriginX = "left";
      let transformOriginY = "top";

      if ((triggerRect.width === 0 && triggerRect.height === 0) && anchor) {
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

      popup.style.left = `${Math.round(left)}px`;
      popup.style.top = `${Math.round(top)}px`;
      popup.style.transformOrigin = `${transformOriginX} ${transformOriginY}`;

      // Debug: expose computed geometry for easier diagnosis
      try {
        if (typeof console !== "undefined" && console.debug) {
          console.debug("popup reposition", {
            triggerRect,
            popupRect,
            left: Math.round(left),
            top: Math.round(top),
            transformOriginX,
            transformOriginY,
          });
        }
      } catch (_) {}
    } else {
      // Center in viewport
      const left = Math.max(12, Math.min((viewportWidth() - popupRect.width) / 2, viewportWidth() - popupRect.width - 12));
      const top = Math.max(12, Math.min((viewportHeight() - popupRect.height) / 2, viewportHeight() - popupRect.height - 12));
      popup.style.left = `${Math.round(left)}px`;
      popup.style.top = `${Math.round(top)}px`;
      try {
        if (typeof console !== "undefined" && console.debug) {
          console.debug("popup reposition (center)", { popupRect, left: Math.round(left), top: Math.round(top) });
        }
      } catch (_) {}
      popup.style.transformOrigin = "center center";
    }
  };

  // Show + initial position
  popup.style.opacity = "0";
  requestAnimationFrame(() => {
    reposition();
    popup.style.opacity = "1";
    overlay.classList.add("visible");
    popup.classList.add("visible");
  });

  // Immediate synchronous attempt to position (helps in some layout timing cases)
  try {
    reposition();
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
    observer.observe(observeTarget, { attributes: true, childList: true, subtree: false });
  } catch (err) {
    // Fallback to body if observing offsetParent fails for some reason
    try {
      observer.observe(document.body, { attributes: true, childList: true, subtree: false });
    } catch (_) {
      // give up silently; reposition still runs on resize/scroll
    }
  }

  // Attach these objects so closePopup can clean them up
  overlay._reposition = reposition;
  overlay._handleResize = handleResize;
  overlay._handleScroll = handleScroll;
  overlay._observer = observer;
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
      if (overlay._handleResize) window.removeEventListener("resize", overlay._handleResize);
      if (overlay._handleScroll) window.removeEventListener("scroll", overlay._handleScroll);
      if (overlay._observer) overlay._observer.disconnect();
      if (overlay._fallbackTimer) clearTimeout(overlay._fallbackTimer);
    } catch (_) {}

    try { overlay.remove(); } catch (_) {}
    try { popup.remove(); } catch (_) {}
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

  if (closeOnOverlayClick) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
  }

  return {
    close: closeModal,
    element: overlay,
    modal,
  };
}
