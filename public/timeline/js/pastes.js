import api from "./api.js";
import switchPage from "./pages.js";

const PUBLIC_PAGE_SIZE = 10;
const EXPIRY_OPTIONS = [
	{ label: "Never", minutes: "" },
	{ label: "10 minutes", minutes: "10" },
	{ label: "1 hour", minutes: "60" },
	{ label: "6 hours", minutes: "360" },
	{ label: "1 day", minutes: "1440" },
	{ label: "1 week", minutes: "10080" },
];

const state = {
	mode: "create",
	createStatus: {
		loading: false,
		error: "",
		result: null,
	},
	publicList: {
		items: [],
		page: 0,
		loading: false,
		done: false,
		error: "",
	},
	view: {
		slug: null,
		secret: "",
		loading: false,
		data: null,
		error: "",
	},
};

const createEl = (tag, options = {}) => {
	const el = document.createElement(tag);
	if (options.className) el.className = options.className;
	if (options.text !== undefined) el.textContent = options.text;
	if (options.type) el.type = options.type;
	if (options.value !== undefined) el.value = options.value;
	if (options.placeholder) el.placeholder = options.placeholder;
	if (options.htmlFor) el.htmlFor = options.htmlFor;
	if (options.id) el.id = options.id;
	if (options.name) el.name = options.name;
	if (options.rows) el.rows = options.rows;
	if (options.autocomplete) el.autocomplete = options.autocomplete;
	if (options.required) el.required = true;
	if (options.disabled !== undefined) el.disabled = options.disabled;
	if (options.href) el.href = options.href;
	if (options.rel) el.rel = options.rel;
	if (options.target) el.target = options.target;
	if (options.attrs) {
		Object.entries(options.attrs).forEach(([key, value]) => {
			el.setAttribute(key, value);
		});
	}
	return el;
};

const clearNode = (node) => {
	while (node.firstChild) {
		node.removeChild(node.firstChild);
	}
};

const readLocation = () => {
	const url = new URL(window.location.href);
	let slug = null;
	const parts = url.pathname.split("/").filter(Boolean);
	if (parts[0] === "pastes" && parts[1] === "p" && parts[2]) {
		slug = decodeURIComponent(parts[2]);
	}
	return {
		slug,
		secret: url.searchParams.get("secret") || "",
	};
};

const updateUrl = (slug, secret, replace = true) => {
	const path = slug ? `/pastes/p/${encodeURIComponent(slug)}` : "/pastes";
	const next = new URL(path, window.location.origin);
	if (secret) next.searchParams.set("secret", secret);
	const stateObj = {
		...(history.state || {}),
		page: "pastes",
		slug: slug || null,
		secret: secret || null,
	};
	if (replace) history.replaceState(stateObj, "", next);
	else history.pushState(stateObj, "", next);
};

const formatRelative = (iso) => {
	if (!iso) return "No expiry";
	const target = new Date(iso);
	if (Number.isNaN(target.getTime())) return "Unknown";
	const diff = target.getTime() - Date.now();
	if (diff <= 0) return "Expired";
	const minutes = Math.floor(diff / 60000);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d`;
	return target.toLocaleString();
};

const formatDate = (iso) => {
	if (!iso) return "Unknown";
	const dt = new Date(iso);
	if (Number.isNaN(dt.getTime())) return "Unknown";
	return dt.toLocaleString();
};

const buildPageLink = (slug, secret) => {
	const url = new URL(
		`/pastes/p/${encodeURIComponent(slug)}`,
		window.location.origin,
	);
	if (secret) url.searchParams.set("secret", secret);
	return url.toString();
};

const buildRawLink = (id, secret) => {
	const url = new URL(
		`/api/pastes/raw/${encodeURIComponent(id)}`,
		window.location.origin,
	);
	if (secret) {
		url.searchParams.set("secret", secret);
	}
	return url.toString();
};

const renderApp = (container) => {
	if (!container) return;
	if (!container.classList.contains("paste-app")) {
		container.classList.add("paste-app");
	}
	clearNode(container);
	const shell = createEl("div", { className: "paste-shell" });
	shell.append(renderNav());
	if (state.mode === "create") {
		shell.append(renderCreateCard());
	}
	if (state.mode === "explore") {
		shell.append(renderExploreCard());
	}
	if (state.mode === "view") {
		shell.append(renderViewCard());
	}
	container.append(shell);
};

const renderNav = () => {
	const nav = createEl("div", { className: "paste-nav" });
	const left = createEl("div", { className: "paste-nav-left" });
	const title = createEl("div", { className: "paste-title", text: "Pastes" });
	const subtitle = createEl("div", {
		className: "status-line",
		text: "Self-hosted snippets with privacy controls.",
	});
	left.append(title, subtitle);

	const actions = createEl("div", { className: "nav-actions" });
	const createBtn = createEl("button", {
		className: `nav-btn${state.mode === "create" ? " active" : ""}`,
		text: "Create",
		type: "button",
	});
	createBtn.addEventListener("click", () => {
		state.mode = "create";
		state.view.slug = null;
		state.view.data = null;
		state.view.error = "";
		updateUrl(null, null);
		renderApp(document.querySelector(".pastes-page"));
	});

	const exploreBtn = createEl("button", {
		className: `nav-btn${state.mode === "explore" ? " active" : ""}`,
		text: "Explore",
		type: "button",
	});
	exploreBtn.addEventListener("click", () => {
		state.mode = "explore";
		state.view.slug = null;
		state.view.data = null;
		state.view.error = "";
		updateUrl(null, null);
		if (!state.publicList.items.length && !state.publicList.loading) {
			loadPublicPastes(true);
		}
		renderApp(document.querySelector(".pastes-page"));
	});

	const viewBtn = createEl("button", {
		className: `nav-btn${state.mode === "view" ? " active" : ""}`,
		text: "View",
		type: "button",
		disabled: !state.view.slug,
	});
	viewBtn.addEventListener("click", () => {
		if (!state.view.slug) return;
		state.mode = "view";
		renderApp(document.querySelector(".pastes-page"));
	});

	const openForm = createEl("form", { className: "open-form" });
	const slugInput = createEl("input", {
		placeholder: "Enter slug",
		name: "slug",
		autocomplete: "off",
	});
	const openButton = createEl("button", {
		className: "btn secondary",
		text: "Open",
		type: "submit",
	});
	openForm.addEventListener("submit", (event) => {
		event.preventDefault();
		const targetSlug = slugInput.value.trim();
		if (targetSlug) {
			openPaste(targetSlug);
		}
	});
	openForm.append(slugInput, openButton);

	actions.append(createBtn, exploreBtn, viewBtn, openForm);
	nav.append(left, actions);
	return nav;
};

const renderCreateCard = () => {
	const form = createEl("form", { className: "card" });
	const titleRow = createEl("div", { className: "form-row" });
	const titleLabel = createEl("label", {
		text: "Title (optional)",
		htmlFor: "paste-title",
	});
	const titleInput = createEl("input", {
		id: "paste-title",
		name: "title",
		placeholder: "My snippet",
		autocomplete: "off",
	});
	titleRow.append(titleLabel, titleInput);

	const languageRow = createEl("div", { className: "form-row" });
	const languageLabel = createEl("label", {
		text: "Language (optional)",
		htmlFor: "paste-language",
	});
	const languageInput = createEl("input", {
		id: "paste-language",
		name: "language",
		placeholder: "javascript",
		autocomplete: "off",
	});
	languageRow.append(languageLabel, languageInput);

	const contentRow = createEl("div", { className: "form-row" });
	const contentLabel = createEl("label", {
		text: "Content",
		htmlFor: "paste-content",
	});
	const contentInput = createEl("textarea", {
		id: "paste-content",
		name: "content",
		placeholder: "Paste your snippet here...",
		rows: 14,
		required: true,
	});
	contentRow.append(contentLabel, contentInput);

	const controlsRow = createEl("div", { className: "form-row" });
	const expireLabel = createEl("label", {
		text: "Expires",
		htmlFor: "paste-expiry",
	});
	const expireSelect = createEl("select", {
		id: "paste-expiry",
		name: "expiry",
	});
	EXPIRY_OPTIONS.forEach((option) => {
		const opt = document.createElement("option");
		opt.value = option.minutes;
		opt.textContent = option.label;
		expireSelect.append(opt);
	});
	controlsRow.append(expireLabel, expireSelect);

	const toggleRow = createEl("div", { className: "toggle-row" });
	const privateLabel = createEl("label");
	const privateInput = createEl("input", {
		type: "checkbox",
		name: "private",
		id: "paste-private",
	});
	privateLabel.append(privateInput, createEl("span", { text: "Private" }));

	const burnLabel = createEl("label");
	const burnInput = createEl("input", {
		type: "checkbox",
		name: "burn",
		id: "paste-burn",
	});
	burnLabel.append(burnInput, createEl("span", { text: "Burn after reading" }));
	toggleRow.append(privateLabel, burnLabel);

	const submitRow = createEl("div", { className: "form-row" });
	const submitBtn = createEl("button", {
		className: "btn primary",
		text: state.createStatus.loading ? "Creating..." : "Publish paste",
		type: "submit",
		disabled: state.createStatus.loading,
	});
	const status = createEl("div", {
		className: state.createStatus.error ? "error-text" : "status-line",
		text: state.createStatus.error
			? state.createStatus.error
			: "Supports up to 200k characters.",
	});
	submitRow.append(submitBtn, status);

	form.append(
		titleRow,
		languageRow,
		contentRow,
		controlsRow,
		toggleRow,
		submitRow,
	);
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		await handleCreate(event.currentTarget);
	});

	if (state.createStatus.result) {
		form.append(renderResultCard(state.createStatus.result));
	}

	return form;
};

const renderResultCard = (result) => {
	const card = createEl("div", { className: "result-card" });
	card.append(createEl("strong", { text: "Paste ready" }));
	card.append(
		createEl("div", {
			className: "status-line",
			text: result.burn_after_reading
				? "This paste deletes itself after the next view."
				: "Share the link below.",
		}),
	);

	const linkRow = createEl("div", { className: "link-row" });
	const pageLink = buildPageLink(result.slug, result.secret_key || "");
	const rawLink = buildRawLink(
		result.slug || result.id,
		result.secret_key || "",
	);

	const pageBtn = createEl("button", {
		className: "btn secondary",
		text: "Copy share link",
		type: "button",
	});
	pageBtn.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(pageLink);
			pageBtn.textContent = "Copied";
			setTimeout(() => {
				pageBtn.textContent = "Copy share link";
			}, 1500);
		} catch {}
	});

	const rawBtn = createEl("button", {
		className: "btn secondary",
		text: "Copy raw link",
		type: "button",
	});
	rawBtn.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(rawLink);
			rawBtn.textContent = "Copied";
			setTimeout(() => {
				rawBtn.textContent = "Copy raw link";
			}, 1500);
		} catch {}
	});

	const viewBtn = createEl("button", {
		className: "btn secondary",
		text: "View paste",
		type: "button",
	});
	viewBtn.addEventListener("click", () => {
		openPaste(result.slug, result.secret_key || "");
	});

	linkRow.append(pageBtn, rawBtn, viewBtn);
	card.append(linkRow);

	if (result.secret_key) {
		card.append(
			createEl("div", {
				className: "status-line",
				text: `Secret key: ${result.secret_key}`,
			}),
		);
	}

	return card;
};

const renderExploreCard = () => {
	const card = createEl("div", { className: "card" });
	card.append(createEl("strong", { text: "Latest public pastes" }));

	if (state.publicList.error) {
		card.append(
			createEl("div", {
				className: "error-text",
				text: state.publicList.error,
			}),
		);
	}

	if (!state.publicList.items.length && state.publicList.loading) {
		card.append(
			createEl("div", { className: "status-line", text: "Loading..." }),
		);
		return card;
	}

	if (!state.publicList.items.length) {
		card.append(
			createEl("div", {
				className: "empty-state",
				text: "No public pastes yet.",
			}),
		);
	} else {
		const list = createEl("div", { className: "public-list" });
		state.publicList.items.forEach((item) => {
			list.append(renderPublicItem(item));
		});
		card.append(list);
	}

	const controls = createEl("div", { className: "command-bar" });
	const reloadBtn = createEl("button", {
		className: "btn secondary",
		text: "Refresh",
		type: "button",
		disabled: state.publicList.loading,
	});
	reloadBtn.addEventListener("click", () => loadPublicPastes(true));
	controls.append(reloadBtn);

	if (!state.publicList.done) {
		const moreBtn = createEl("button", {
			className: "btn secondary",
			text: state.publicList.loading ? "Loading..." : "Load more",
			type: "button",
			disabled: state.publicList.loading,
		});
		moreBtn.addEventListener("click", () => loadPublicPastes(false));
		controls.append(moreBtn);
	}

	card.append(controls);
	return card;
};

const renderPublicItem = (item) => {
	const entry = createEl("div", { className: "list-item" });
	entry.append(
		createEl("div", {
			className: "item-title",
			text: item.title || item.slug,
		}),
	);
	entry.append(
		createEl("div", {
			className: "item-meta",
			text: `Views ${item.view_count || 0} • ${formatDate(item.created_at)}`,
		}),
	);
	const lang = createEl("div", {
		className: "status-line",
		text: item.language ? `Language: ${item.language}` : "Language: Plain",
	});
	entry.append(lang);
	const openBtn = createEl("button", {
		className: "btn secondary",
		text: "Open",
		type: "button",
	});
	openBtn.addEventListener("click", () => openPaste(item.slug));
	entry.append(openBtn);
	return entry;
};

const renderViewCard = () => {
	const card = createEl("div", { className: "card" });
	card.append(createEl("strong", { text: "View paste" }));

	if (!state.view.slug) {
		card.append(
			createEl("div", {
				className: "empty-state",
				text: "Pick a paste from Explore or enter a slug.",
			}),
		);
		return card;
	}

	card.append(
		createEl("div", {
			className: "status-line",
			text: `Slug: ${state.view.slug}`,
		}),
	);

	if (state.view.loading) {
		card.append(
			createEl("div", { className: "status-line", text: "Loading..." }),
		);
		return card;
	}

	if (state.view.error) {
		card.append(
			createEl("div", { className: "error-text", text: state.view.error }),
		);
		card.append(renderSecretForm());
		return card;
	}

	if (!state.view.data) {
		card.append(
			createEl("div", { className: "status-line", text: "No data." }),
		);
		return card;
	}

	const paste = state.view.data;
	const chips = createEl("div", { className: "chip-row" });
	chips.append(
		createEl("div", {
			className: "chip",
			text: paste.language ? paste.language : "Plain text",
		}),
		createEl("div", {
			className: "chip",
			text: `Views ${paste.view_count || 0}`,
		}),
		createEl("div", {
			className: "chip",
			text: `Created ${formatDate(paste.created_at)}`,
		}),
	);
	chips.append(
		createEl("div", {
			className: "chip",
			text: formatRelative(paste.expires_at),
		}),
	);
	card.append(chips);

	const codeBlock = createEl("div", { className: "code-block" });
	const pre = createEl("pre");
	pre.textContent = paste.content || "";
	codeBlock.append(pre);
	card.append(codeBlock);

	const commands = createEl("div", { className: "command-bar" });
	const shareBtn = createEl("button", {
		className: "btn secondary",
		text: "Copy link",
		type: "button",
	});
	shareBtn.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(
				buildPageLink(paste.slug, state.view.secret || ""),
			);
			shareBtn.textContent = "Copied";
			setTimeout(() => {
				shareBtn.textContent = "Copy link";
			}, 1500);
		} catch {}
	});

	const rawBtn = createEl("button", {
		className: "btn secondary",
		text: "Open raw",
		type: "button",
	});
	rawBtn.addEventListener("click", () => {
		window.open(
			buildRawLink(paste.slug || paste.id, state.view.secret || ""),
			"_blank",
		);
	});

	const newBtn = createEl("button", {
		className: "btn secondary",
		text: "New paste",
		type: "button",
	});
	newBtn.addEventListener("click", () => {
		state.mode = "create";
		state.view.slug = null;
		state.view.data = null;
		state.view.error = "";
		updateUrl(null, null);
		renderApp(document.querySelector(".pastes-page"));
	});

	commands.append(shareBtn, rawBtn, newBtn);
	card.append(commands);

	if (paste.burn_after_reading) {
		card.append(
			createEl("div", {
				className: "error-text",
				text: "Heads up: this paste will be removed after this view.",
			}),
		);
	}

	return card;
};

const renderSecretForm = () => {
	const form = createEl("form", { className: "secret-form" });
	form.append(
		createEl("div", {
			className: "status-line",
			text: "Private paste. Provide the secret key to unlock.",
		}),
	);
	const input = createEl("input", {
		placeholder: "Secret key",
		value: state.view.secret,
		autocomplete: "off",
	});
	const submit = createEl("button", {
		className: "btn primary",
		text: "Unlock",
		type: "submit",
	});
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		state.view.secret = input.value.trim();
		if (!state.view.slug) return;
		loadPaste(state.view.slug, state.view.secret);
	});
	form.append(input, submit);
	return form;
};

const minutesToISO = (value) => {
	const amount = Number(value);
	if (!Number.isFinite(amount) || amount <= 0) return null;
	return new Date(Date.now() + amount * 60_000).toISOString();
};

const handleCreate = async (form) => {
	const formData = {
		title: form.title.value.trim() || null,
		language: form.language.value.trim() || null,
		content: form.content.value,
		is_public: !form.private.checked,
		burn_after_reading: form.burn.checked,
		expires_at: minutesToISO(form.expiry.value),
	};

	state.createStatus.loading = true;
	state.createStatus.error = "";
	renderApp(document.querySelector(".pastes-page"));

	const payload = {
		title: formData.title,
		language: formData.language,
		content: formData.content,
		is_public: formData.is_public,
		burn_after_reading: formData.burn_after_reading,
		expires_at: formData.expires_at,
	};

	const response = await api("/pastes", {
		method: "POST",
		body: JSON.stringify(payload),
	});

	state.createStatus.loading = false;
	if (!response || response.error) {
		state.createStatus.error = response?.error || "Failed to create paste";
		renderApp(document.querySelector(".pastes-page"));
		return;
	}

	state.createStatus.result = response.paste;
	form.reset();
	renderApp(document.querySelector(".pastes-page"));
};

const loadPublicPastes = async (reset) => {
	if (state.publicList.loading) return;
	if (reset) {
		state.publicList.items = [];
		state.publicList.page = 0;
		state.publicList.done = false;
		state.publicList.error = "";
	}
	state.publicList.loading = true;
	renderApp(document.querySelector(".pastes-page"));
	const response = await api(
		`/pastes/public?limit=${PUBLIC_PAGE_SIZE}&page=${state.publicList.page}`,
	);
	state.publicList.loading = false;
	if (!response || response.error) {
		state.publicList.error = response?.error || "Unable to load pastes";
		renderApp(document.querySelector(".pastes-page"));
		return;
	}
	const rows = response.pastes || [];
	state.publicList.items = reset ? rows : state.publicList.items.concat(rows);
	state.publicList.page += 1;
	if (rows.length < PUBLIC_PAGE_SIZE) {
		state.publicList.done = true;
	}
	renderApp(document.querySelector(".pastes-page"));
};

const openPaste = (slug, secret = "") => {
	const trimmedSlug = slug.trim();
	if (!trimmedSlug) return;
	state.mode = "view";
	state.view.slug = trimmedSlug;
	state.view.secret = secret.trim();
	state.view.data = null;
	state.view.error = "";
	updateUrl(trimmedSlug, state.view.secret || null, false);
	loadPaste(trimmedSlug, state.view.secret);
	renderApp(document.querySelector(".pastes-page"));
};

const loadPaste = async (slug, secret) => {
	if (!slug) return;
	state.view.loading = true;
	state.view.error = "";
	state.view.data = null;
	renderApp(document.querySelector(".pastes-page"));
	const secretQuery = secret ? `?secret=${encodeURIComponent(secret)}` : "";
	const response = await api(
		`/pastes/${encodeURIComponent(slug)}${secretQuery}`,
	);
	state.view.loading = false;
	if (!response || response.error) {
		state.view.error = response?.error || "Unable to load paste";
		renderApp(document.querySelector(".pastes-page"));
		return;
	}
	state.view.data = response.paste;
	renderApp(document.querySelector(".pastes-page"));
};

export function initializePastesPage(container) {
	const { slug, secret } = readLocation();
	if (slug) {
		state.mode = "view";
		state.view.slug = slug;
		state.view.secret = secret;
		state.view.data = null;
		state.view.error = "";
		loadPaste(slug, secret);
	} else {
		state.mode = "create";
		state.view.slug = null;
		state.view.data = null;
		state.view.error = "";
	}
	if (container && !container.classList.contains("paste-app")) {
		container.classList.add("paste-app");
	}
	renderApp(container);
}

export function openPastesPage() {
	const container = document.querySelector(".pastes-page");
	switchPage("pastes", {
		path: "/pastes",
		recoverState: () => {
			state.mode = "create";
			state.view.slug = null;
			state.view.data = null;
			state.view.error = "";
			state.createStatus.result = null;
			renderApp(container);
		},
	});
}

export function openPasteView(slug, secret = "") {
	const container = document.querySelector(".pastes-page");
	switchPage("pastes", {
		path: `/pastes/p/${encodeURIComponent(slug)}`,
		recoverState: () => {
			state.mode = "view";
			state.view.slug = slug;
			state.view.secret = secret;
			state.view.data = null;
			state.view.error = "";
			loadPaste(slug, secret);
		},
	});
}

// popstate is handled by pages.js, which calls recoverState
