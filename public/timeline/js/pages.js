const pages = {
	timeline: document.querySelector(".timeline"),
	tweet: document.querySelector(".tweetPage"),
	profile: document.querySelector(".profile"),
	notifications: document.querySelector(".notifications"),
	search: document.querySelector(".search-page"),
	bookmarks: document.querySelector(".bookmarks-page"),
	"direct-messages": document.querySelector(".direct-messages"),
	"dm-conversation": document.querySelector(".dm-conversation"),
	communities: document.querySelector(".communities-page"),
	"community-detail": document.querySelector(".community-detail-page"),
	pastes: document.querySelector(".pastes-page"),
	settings: null,
};
const states = {};
const cleanups = {};
const lazyInitializers = {
	search: false,
	communities: false,
	pastes: false,
};

const updateNavbar = () => {
	requestAnimationFrame(() => {
		const currentPath = window.location.pathname;
		const currentPage = currentPath.split("/")[1];

		document.querySelectorAll("nav button.active").forEach((btn) => {
			btn.classList.remove("active");
		});

		if (!currentPage) {
			document.querySelector(".home-btn").classList.add("active");
		}

		if (currentPage === "search") {
			document.querySelector(".search-btn").classList.add("active");
		}

		if (currentPage === "notifications") {
			document.querySelector(".notifications-btn").classList.add("active");
		}

		if (currentPage === "dm") {
			document.querySelector(".dm-btn").classList.add("active");
		}

		if (currentPage === "communities") {
			document.querySelector(".communities-btn").classList.add("active");
		}
	});
};

function showPage(page, options = {}) {
	const { recoverState = () => {} } = options;

	if (history.state?.stateId && cleanups[history.state.stateId]) {
		try {
			cleanups[history.state.stateId]();
			delete cleanups[history.state.stateId];
		} catch (error) {
			console.error("Error in cleanup:", error);
		}
	}

	Object.values(pages).forEach((p) => {
		if (p) {
			p.style.display = "none";
			p.classList.remove("page-active");
		}
	});

	const settingsElement = document.querySelector(".settings");
	if (settingsElement) {
		settingsElement.style.display = "none";
		settingsElement.classList.remove("page-active");
	}

	if (pages[page]) {
		pages[page].style.display = "flex";
		pages[page].classList.add("page-active");

		requestAnimationFrame(() => {
			try {
				recoverState(pages[page]);
			} catch (error) {
				console.error(`Error in recoverState for page ${page}:`, error);
			}
		});

		if (page === "search" && !lazyInitializers.search) {
			lazyInitializers.search = true;
			import("./search.js")
				.then(({ initializeSearchPage }) => initializeSearchPage())
				.catch((error) =>
					console.error("Failed to initialize search page:", error),
				);
		}

		if (page === "communities" && !lazyInitializers.communities) {
			lazyInitializers.communities = true;
			import("./communities.js")
				.then(({ initializeCommunitiesPage }) => initializeCommunitiesPage())
				.catch((error) =>
					console.error("Failed to initialize communities page:", error),
				);
		}

		if (page === "pastes" && !lazyInitializers.pastes) {
			lazyInitializers.pastes = true;
			import("/public/timeline/js/pastes.js")
				.then(({ initializePastesPage }) => {
					const container = document.querySelector(".pastes-page");
					initializePastesPage(container);
				})
				.catch((error) => {
					console.error("Failed to initialize pastes page:", error);
					const container = document.querySelector(".pastes-page");
					if (container) {
						container.innerHTML =
							"<div class='error-text'>Failed to load Pastes UI. Please try again later.</div>";
					}
				});
		}
	} else if (page === "settings") {
		requestAnimationFrame(() => {
			try {
				recoverState();
			} catch (error) {
				console.error(`Error in recoverState for settings:`, error);
			}
		});
		const updatedSettingsElement = document.querySelector(".settings");
		if (updatedSettingsElement) {
			pages.settings = updatedSettingsElement;
		}
	}

	return pages[page];
}

export default function switchPage(
	page,
	{ recoverState = () => {}, path = "/", cleanup = () => {}, noScroll } = {},
) {
	if (history.state) {
		history.replaceState(
			{
				...history.state,
				scroll: window.scrollY,
			},
			"",
			window.location.pathname,
		);
	}

	showPage(page, { recoverState, path, cleanup });
	updateNavbar();

	const stateId = crypto.randomUUID();
	states[stateId] = recoverState;
	cleanups[stateId] = cleanup;

	history.pushState(
		{
			page,
			stateId,
			scroll: 0,
			noScroll,
		},
		"",
		path,
	);

	return pages[page];
}

export function addRoute(pathMatcher, onMatch) {
	const currentPath = window.location.pathname;

	if (pathMatcher(currentPath)) onMatch(currentPath);
}

window.addEventListener("popstate", (event) => {
	const { state } = event;
	const path = window.location.pathname || "";
	const pageFromPath = path.split("/")[1] || "timeline";
	const {
		page = pageFromPath,
		stateId = null,
		scroll = 0,
		noScroll = false,
	} = state || {};

	if (history.state?.stateId && cleanups[history.state.stateId]) {
		try {
			cleanups[history.state.stateId]();
			delete cleanups[history.state.stateId];
		} catch (e) {
			console.error("Error in cleanup:", e);
		}
	}

	const recoverState = (stateId && states[stateId]) || (() => {});

	showPage(page, { recoverState });
	updateNavbar();

	// Re-initialize pastes page if needed (handle back/forward navigation)
	if (page === "pastes" && lazyInitializers.pastes) {
		import("/public/timeline/js/pastes.js")
			.then(({ initializePastesPage }) => {
				const container = document.querySelector(".pastes-page");
				initializePastesPage(container);
			})
			.catch((error) =>
				console.error("Failed to re-initialize pastes on popstate:", error),
			);
	}

	setTimeout(() => {
		if (noScroll) return;
		window.scrollTo(0, scroll || 0);
	}, 0);
});

updateNavbar();

export { showPage };
