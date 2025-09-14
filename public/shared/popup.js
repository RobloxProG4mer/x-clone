export function createPopup(options) {
	const { 
		onRetweet = () => {}, 
		onQuote = () => {}, 
		onCancel = () => {},
		tweet = null,
		triggerElement = null
	} = options;

	const overlay = document.createElement("div");
	overlay.className = "popup-overlay";
	
	const popup = document.createElement("div");
	popup.className = "popup";
	
	popup.innerHTML = `
		<div class="popup-content">
			<button class="popup-option" id="retweet-option" type="button">
				<div class="popup-option-icon">
					<svg width="20" height="20" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M1.58333 7.125L3.95833 4.75L6.33333 7.125" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M10.2917 14.25H5.54166C5.12174 14.25 4.71901 14.0832 4.42208 13.7863C4.12514 13.4893 3.95833 13.0866 3.95833 12.6667V4.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M17.4167 11.875L15.0417 14.25L12.6667 11.875" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M8.70833 4.75H13.4583C13.8783 4.75 14.281 4.91681 14.5779 5.21375C14.8748 5.51068 15.0417 5.91341 15.0417 6.33333V14.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</div>
				<div class="popup-option-content">
					<div class="popup-option-title">Retweet</div>
					<div class="popup-option-description">Share instantly</div>
				</div>
			</button>
			<button class="popup-option" id="quote-option" type="button">
				<div class="popup-option-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>
						<path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>
					</svg>
				</div>
				<div class="popup-option-content">
					<div class="popup-option-title">Quote</div>
					<div class="popup-option-description">Add your thoughts</div>
				</div>
			</button>
		</div>
	`;

	// Position popup relative to trigger element if provided
	if (triggerElement) {
		const rect = triggerElement.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		
		// Default positioning (below and to the right of trigger)
		let top = rect.bottom + 8;
		let left = rect.left;
		
		// Adjust if popup would go off screen
		const popupWidth = 320; // max-width from CSS
		const popupHeight = 200; // estimated height
		
		if (left + popupWidth > viewportWidth) {
			left = rect.right - popupWidth;
		}
		
		if (top + popupHeight > viewportHeight) {
			top = rect.top - popupHeight - 8;
		}
		
		popup.style.position = 'fixed';
		popup.style.top = `${top}px`;
		popup.style.left = `${left}px`;
		popup.style.transform = 'none';
		
		// Remove centering styles from overlay
		overlay.style.alignItems = 'flex-start';
		overlay.style.justifyContent = 'flex-start';
		overlay.style.background = 'transparent';
	}

	const retweetBtn = popup.querySelector("#retweet-option");
	const quoteBtn = popup.querySelector("#quote-option");

	const closePopup = () => {
		overlay.remove();
		onCancel();
	};

	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) {
			closePopup();
		}
	});

	retweetBtn.addEventListener("click", () => {
		overlay.remove();
		onRetweet();
	});

	quoteBtn.addEventListener("click", () => {
		overlay.remove();
		onQuote();
	});

	overlay.appendChild(popup);
	document.body.appendChild(overlay);

	return {
		close: closePopup,
		element: overlay
	};
}

export default createPopup;