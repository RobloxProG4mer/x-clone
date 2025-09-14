import toastQueue from "../../shared/toasts.js";
import { authToken } from "./auth.js";
import { createComposer } from "./composer.js";
import showPage, { addRoute } from "./pages.js";
import { addTweetToTimeline } from "./tweets.js";
import "./profile.js"; // Import to register profile routes

window.onerror = (message, source, lineno, colno) => {
	toastQueue.add(
		`<h1>${message}</h1><p>at ${lineno || "?"}:${colno || "?"} in ${source || "?"}</p>`,
	);

	return false;
};

window.onunhandledrejection = (event) => {
	const reason = event.reason;

	if (reason instanceof Error) {
		toastQueue.add(
			`<h1>${reason.message}</h1><p>at ${reason.lineNumber || "?"}:${reason.columnNumber || "?"} in ${reason.fileName || "?"}</p>`,
		);
	} else {
		toastQueue.add(`<h1>${String(reason)}</h1><p>Error</p>`);
	}
};

(async () => {
	if (!authToken) return;

	const { timeline } = await (
		await fetch("/api/timeline/", {
			headers: { Authorization: `Bearer ${authToken}` },
		})
	).json();

	document.querySelector(".tweets").innerText = "";

	timeline.forEach((tweet) => {
		addTweetToTimeline(tweet, false);
	});

	// Create and add the composer
	const composer = await createComposer({
		callback: (tweet) => {
			addTweetToTimeline(tweet, true).classList.add("created");
		},
	});

	document.querySelector("#composer-container").appendChild(composer);
})();

addRoute(
	(pathname) => pathname === "/",
	() => showPage("timeline"),
);
