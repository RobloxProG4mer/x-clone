export function createPopup(options) {
  const {
    items = [],
    triggerElement = null,
    anchorPoint = null,
    onClose = () => {},
  } = options;

  const storedTriggerRect = (() => {
    if (!triggerElement || typeof triggerElement.getBoundingClientRect !== "function") {
      return null;
    }
    const rect = triggerElement.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
      return null;
    }
    return {
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  })();

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
    content.appendChild(description);

    button.appendChild(icon);
    button.appendChild(content);

    button.addEventListener("click", () => {
      closePopup();
      item.onClick?.();
    });

    popupContent.appendChild(button);
  });

  popup.appendChild(popupContent);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    popup.style.position = "fixed";
    popup.style.left = "-9999px";
    popup.style.top = "-9999px";

    requestAnimationFrame(() => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const popupRect = popup.getBoundingClientRect();

      let triggerRect = storedTriggerRect;
      if ((!triggerRect || triggerRect.width === 0 || triggerRect.height === 0) && triggerElement) {
        const liveRect = triggerElement.getBoundingClientRect?.();
        if (liveRect && liveRect.width > 0 && liveRect.height > 0) {
          triggerRect = {
            top: liveRect.top,
            left: liveRect.left,
            right: liveRect.right,
            bottom: liveRect.bottom,
            width: liveRect.width,
            height: liveRect.height,
          };
        }
      }

      if ((!triggerRect || triggerRect.width === 0 || triggerRect.height === 0) && triggerElement) {
        const rects = triggerElement.getClientRects?.();
        if (rects && rects.length > 0) {
          const rect = rects[0];
          triggerRect = {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          };
        }
      }

      if ((!triggerRect || (triggerRect.width === 0 && triggerRect.height === 0)) && triggerElement?.parentElement) {
        const parentRect = triggerElement.parentElement.getBoundingClientRect?.();
        if (parentRect && parentRect.width > 0 && parentRect.height > 0) {
          triggerRect = {
            top: parentRect.top,
            left: parentRect.left,
            right: parentRect.right,
            bottom: parentRect.bottom,
            width: parentRect.width,
            height: parentRect.height,
          };
        }
      }

      if (!triggerRect && anchor) {
        triggerRect = {
          top: anchor.y,
          left: anchor.x,
          right: anchor.x,
          bottom: anchor.y,
          width: 0,
          height: 0,
        };
      }

      if (triggerRect && (triggerRect.width > 0 || triggerRect.height > 0)) {
        let left = triggerRect.right - popupRect.width;
        let top = triggerRect.bottom + 8;
        let transformOriginX = "right";
        let transformOriginY = "top";

        if (triggerRect.width === 0 && triggerRect.height === 0 && anchor) {
          left = anchor.x - popupRect.width / 2;
          top = anchor.y + 10;
          transformOriginX = "center";
        }

        if (left < 12) {
          left = Math.max(12, triggerRect.left);
          transformOriginX = left === triggerRect.left ? "left" : transformOriginX;
        }

        if (left + popupRect.width > viewportWidth - 12) {
          left = viewportWidth - popupRect.width - 12;
          transformOriginX = "right";
        }

        if (top + popupRect.height > viewportHeight - 12) {
          top = triggerRect.top - popupRect.height - 8;
          transformOriginY = "bottom";
        }

        if (top < 12) {
          top = 12;
          transformOriginY = "top";
        }

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
        popup.style.transformOrigin = `${transformOriginX} ${transformOriginY}`;
      } else {
        const left = Math.max(
          12,
          Math.min(
            (viewportWidth - popupRect.width) / 2,
            viewportWidth - popupRect.width - 12
          )
        );
        const top = Math.max(
          12,
          Math.min(
            (viewportHeight - popupRect.height) / 2,
            viewportHeight - popupRect.height - 12
          )
        );
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
        popup.style.transformOrigin = "center center";
      }

      overlay.classList.add("visible");
    });
  });

  const closePopup = () => {
    overlay.classList.remove("visible");
    overlay.classList.add("closing");
    document.removeEventListener("keydown", handleKeyDown);

    overlay.addEventListener(
      "transitionend",
      () => {
        overlay.remove();
        onClose();
      },
      { once: true }
    );
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
