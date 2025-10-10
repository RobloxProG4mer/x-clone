import { createPopup as createPopupNew } from "./ui-utils.js";

export function createPopup(options) {
	const {
		onRetweet = () => {},
		onQuote = () => {},
		onCancel = () => {},
		triggerElement = null,
	} = options;

	return createPopupNew({
		triggerElement,
		onClose: onCancel,
		items: [
			{
				id: "retweet-option",
				icon: `<svg width="20" height="20" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M1.58333 7.125L3.95833 4.75L6.33333 7.125" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					<path d="M10.2917 14.25H5.54166C5.12174 14.25 4.71901 14.0832 4.42208 13.7863C4.12514 13.4893 3.95833 13.0866 3.95833 12.6667V4.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					<path d="M17.4167 11.875L15.0417 14.25L12.6667 11.875" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					<path d="M8.70833 4.75H13.4583C13.8783 4.75 14.281 4.91681 14.5779 5.21375C14.8748 5.51068 15.0417 5.91341 15.0417 6.33333V14.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>`,
				title: "Retweet",
				onClick: onRetweet,
			},
			{
				id: "quote-option",
				icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>
					<path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>
				</svg>`,
				title: "Quote",
				onClick: onQuote,
			},
		],
	});
}

export default createPopup;
