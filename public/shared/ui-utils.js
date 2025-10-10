export function createPopup(options) {
	const {
		items = [],
		triggerElement = null,
		onClose = () => {},
	} = options;

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
			if (item.onClick) item.onClick();
		});

		popupContent.appendChild(button);
	});

	popup.appendChild(popupContent);

	if (triggerElement) {
		const rect = triggerElement.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		let top = rect.bottom + 8;
		let left = rect.left;

		const popupWidth = 320;
		const popupHeight = 200;

		if (left + popupWidth > viewportWidth) {
			left = rect.right - popupWidth;
		}

		if (top + popupHeight > viewportHeight) {
			top = rect.top - popupHeight - 8;
		}

		popup.style.position = "fixed";
		popup.style.top = `${top}px`;
		popup.style.left = `${left}px`;
		popup.style.transform = "none";

		overlay.style.alignItems = "flex-start";
		overlay.style.justifyContent = "flex-start";
		overlay.style.background = "transparent";
	}

	const closePopup = () => {
		overlay.remove();
		document.removeEventListener("keydown", handleKeyDown);
		onClose();
	};

	const handleKeyDown = (e) => {
		if (e.key === "Escape") {
			closePopup();
		}
	};

	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) {
			closePopup();
		}
	});

	document.addEventListener("keydown", handleKeyDown);

	overlay.appendChild(popup);
	document.body.appendChild(overlay);

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
