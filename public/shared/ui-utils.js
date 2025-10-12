export function createPopup(options) {
  const { items = [], triggerElement = null, onClose = () => {} } = options;

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  const popup = document.createElement("div");
  popup.className = "popup";

  const popupContent = document.createElement("div");
  popupContent.className = "popup-content";

  items.forEach((item) => {
    const button = document.createElement("button");
    button.className = "popup-option";
    button.type = "button";

    if (item.id) button.id = item.id;

    const icon = document.createElement("div");
    icon.className = "popup-option-icon";
    icon.innerHTML = item.icon;

    const content = document.createElement("div");
    content.className = "popup-option-content";

    const title = document.createElement("div");
    title.className = "popup-option-title";
    title.textContent = item.title;

    const description = document.createElement("div");
    description.className = "popup-option-description";
    description.textContent = item.description;

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
    // compute after DOM render to get correct popup size
    const rect = triggerElement?.getBoundingClientRect?.();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    popup.style.position = "fixed";

    if (triggerElement) {
      // Robustly obtain a usable rect for the trigger element. Some elements (svg, virtual
      // nodes) may report zero sizes; try getClientRects as a fallback.
      let usableRect = rect;
      try {
        if (
          !usableRect ||
          (usableRect.width === 0 && usableRect.height === 0)
        ) {
          const clientRects = triggerElement.getClientRects?.();
          if (clientRects && clientRects.length > 0)
            usableRect = clientRects[0];
          else usableRect = triggerElement.getBoundingClientRect?.();
        }
      } catch (_) {
        usableRect = null;
      }

      if (usableRect) {
        // initial placement below the trigger (viewport coordinates)
        let top = usableRect.bottom + 8;
        let left = usableRect.left;
        let transformOriginX = "left";
        let transformOriginY = "top";

        // position off-screen first so popup can size itself, then adjust
        popup.style.left = "-9999px";
        popup.style.top = "-9999px";

        // force layout to get actual popup size
        const popupRect = popup.getBoundingClientRect();

        // If popup would overflow to the right, align to the right edge of trigger
        if (left + popupRect.width > viewportWidth - 12) {
          left = usableRect.right - popupRect.width;
          transformOriginX = "right";
        }

        // If popup would overflow bottom, place above the trigger
        if (top + popupRect.height > viewportHeight - 12) {
          top = usableRect.top - popupRect.height - 8;
          transformOriginY = "bottom";
        }

        // keep within viewport margins (allow fractional pixels)
        left = Math.min(
          Math.max(12, left),
          viewportWidth - popupRect.width - 12
        );
        top = Math.min(
          Math.max(12, top),
          viewportHeight - popupRect.height - 12
        );

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
        popup.style.transformOrigin = `${transformOriginX} ${transformOriginY}`;
      } else {
        // If we couldn't determine a rect, fall back to centering
        const vw = Math.max(
          document.documentElement.clientWidth || 0,
          window.innerWidth || 0
        );
        const vh = Math.max(
          document.documentElement.clientHeight || 0,
          window.innerHeight || 0
        );
        const left = Math.round(vw / 2 - popup.offsetWidth / 2);
        const top = Math.round(vh / 2 - popup.offsetHeight / 2);
        popup.style.left = `${Math.max(
          12,
          Math.min(left, vw - popup.offsetWidth - 12)
        )}px`;
        popup.style.top = `${Math.max(
          12,
          Math.min(top, vh - popup.offsetHeight - 12)
        )}px`;
        popup.style.transformOrigin = `center center`;
      }
    } else {
      // center fallback using precise pixel coordinates
      const vw = Math.max(
        document.documentElement.clientWidth || 0,
        window.innerWidth || 0
      );
      const vh = Math.max(
        document.documentElement.clientHeight || 0,
        window.innerHeight || 0
      );
      const left = Math.round(vw / 2 - popup.offsetWidth / 2);
      const top = Math.round(vh / 2 - popup.offsetHeight / 2);
      popup.style.left = `${Math.max(
        12,
        Math.min(left, vw - popup.offsetWidth - 12)
      )}px`;
      popup.style.top = `${Math.max(
        12,
        Math.min(top, vh - popup.offsetHeight - 12)
      )}px`;
      popup.style.transformOrigin = `center center`;
    }

    overlay.classList.add("visible");
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
