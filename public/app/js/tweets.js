import DOMPurify from "../../shared/assets/js/dompurify.js";
import { marked } from "../../shared/assets/js/marked.js";
import {
	applyAvatarOutline,
	createVerificationBadge,
} from "../../shared/badge-utils.js";
import { attachHoverCard } from "../../shared/hover-card.js";
import toastQueue from "../../shared/toasts.js";
import {
	createConfirmModal,
	createModal,
	createPopup,
} from "../../shared/ui-utils.js";
import query from "./api.js";
import getUser from "./auth.js";
import switchPage from "./pages.js";
import { searchQuery } from "./search.js";
import { maybeAddTranslation } from "./translate.js";
import openPOST from "./POST.js";

const POSTStateStore = new Map();

export function updatePOSTState(POSTId, updates) {
	if (!POSTStateStore.has(POSTId)) {
		POSTStateStore.set(POSTId, {});
	}
	const state = POSTStateStore.get(POSTId);
	Object.assign(state, updates);

	document.querySelectorAll(`[data-POST-id="${POSTId}"]`).forEach((el) => {
		if (updates.liked_by_user !== undefined) {
			const likeBtn = el.querySelector(".engagement[data-liked]");
			if (likeBtn) {
				const svg = likeBtn.querySelector("svg path");
				const likeCountSpan = likeBtn.querySelector(".like-count");
				likeBtn.dataset.liked = updates.liked_by_user;

				if (updates.liked_by_user) {
					svg.setAttribute("fill", "#F91980");
					svg.setAttribute("stroke", "#F91980");
				} else {
					svg.setAttribute("fill", "none");
					svg.setAttribute("stroke", "currentColor");
				}

				if (updates.like_count !== undefined) {
					likeBtn.dataset.likeCount = updates.like_count;
					likeCountSpan.textContent =
						updates.like_count === 0 ? "" : formatNumber(updates.like_count);
				}
			}
		}

		if (updates.rePOSTed_by_user !== undefined) {
			const rePOSTBtn = el.querySelector(".engagement[data-rePOSTed]");
			if (rePOSTBtn) {
				const svgPaths = rePOSTBtn.querySelectorAll("svg path");
				const rePOSTCountSpan = rePOSTBtn.querySelector(".rePOST-count");
				rePOSTBtn.dataset.rePOSTed = updates.rePOSTed_by_user;

				const color = updates.rePOSTed_by_user ? "#00BA7C" : "currentColor";
				svgPaths.forEach((path) => {
					path.setAttribute("stroke", color);
				});

				if (updates.rePOST_count !== undefined) {
					rePOSTBtn.dataset.rePOSTCount = updates.rePOST_count;
					rePOSTCountSpan.textContent =
						updates.rePOST_count === 0
							? ""
							: formatNumber(updates.rePOST_count);
				}
			}
		}
	});
}

export function getPOSTState(POSTId) {
	return POSTStateStore.get(POSTId) || {};
}

function formatNumber(num) {
	if (num >= 1_000_000_000_000) {
		return `${(num / 1_000_000_000_000).toFixed(2).replace(/\.?0+$/, "")}T`;
	} else if (num >= 1_000_000_000) {
		return `${(num / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "")}B`;
	} else if (num >= 1_000_000) {
		return `${(num / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
	} else if (num >= 10_000) {
		return `${(num / 1_000).toFixed(1).replace(/\.?0+$/, "")}k`;
	}
	return num;
}

const DOMPURIFY_CONFIG = {
	ALLOWED_TAGS: [
		"b",
		"i",
		"u",
		"s",
		"a",
		"p",
		"br",
		"marquee",
		"strong",
		"em",
		"code",
		"pre",
		"blockquote",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
		"ul",
		"ol",
		"li",
		"span",
		"big",
		"sub",
		"sup",
		"del",
	],
	ALLOWED_ATTR: ["href", "target", "rel", "class"],
};

const attachCheckmarkPopup = (badgeEl, type) => {
	if (!badgeEl) return;
	const message =
		type === "gold"
			? "This account is verified because it's an official organization on Xeetapus."
			: type === "gray"
				? "This account is verified because it is a government or multilateral organization account."
				: "This account is verified.";
	const showPopup = (evt) => {
		evt.preventDefault();
		evt.stopPropagation();
		createPopup({
			items: [
				{
					icon: badgeEl.innerHTML,
					title: message,
					onClick: () => {},
				},
			],
			triggerElement: badgeEl,
		});
	};
	badgeEl.addEventListener("click", showPopup);
	badgeEl.addEventListener("keydown", (e) => {
		if (e.key === "Enter" || e.key === " ") showPopup(e);
	});
};

const handleCustomBadgeAction = (badge, badgeEl, userId, username) => {
	const type = badge?.action_type || "none";
	if (type === "url") {
		const url = badge?.action_value || "";
		if (url && /^https?:\/\//i.test(url)) {
			window.open(url, "_blank", "noopener,noreferrer");
		}
		return;
	}
	if (type === "modal") {
		let config = {};
		try {
			config = JSON.parse(badge?.action_value || "{}");
		} catch {
			config = { content: badge?.action_value || "" };
		}
		const wrapper = document.createElement("div");
		wrapper.className = "badge-modal-content";
		if (config.css) {
			const styleEl = document.createElement("style");
			styleEl.textContent = config.css;
			wrapper.appendChild(styleEl);
		}
		const contentDiv = document.createElement("div");
		if (config.content) {
			if (badge?.allow_raw_html) {
				if (typeof marked !== "undefined") {
					contentDiv.innerHTML = marked.parse(config.content);
				} else {
					contentDiv.innerHTML = config.content;
				}
			} else if (typeof marked !== "undefined") {
				contentDiv.innerHTML = DOMPurify.sanitize(
					marked.parse(config.content),
					DOMPURIFY_CONFIG,
				);
			} else {
				contentDiv.innerHTML = DOMPurify.sanitize(
					config.content.replace(/\n/g, "<br>"),
					DOMPURIFY_CONFIG,
				);
			}
		}
		wrapper.appendChild(contentDiv);
		const { modal: modalEl, close } = createModal({
			title: config.title || badge?.name || "Badge",
			content: wrapper,
		});
		if (config.js) {
			try {
				const fn = new Function(
					"modalEl",
					"badge",
					"userId",
					"username",
					"closeModal",
					config.js,
				);
				fn(modalEl, badge, userId, username, close);
			} catch (err) {
				console.error("Badge modal JS error:", err);
			}
		}
		return;
	}
	if (type === "popup") {
		let config = {};
		try {
			config = JSON.parse(badge?.action_value || "{}");
		} catch {
			config = { entries: [] };
		}
		const entries = config.entries || [];
		if (entries.length === 0) return;
		const popupEl = document.createElement("div");
		popupEl.className = "badge-popup-menu";
		if (config.title) {
			const titleEl = document.createElement("div");
			titleEl.className = "badge-popup-title";
			titleEl.textContent = config.title;
			popupEl.appendChild(titleEl);
		}
		entries.forEach((entry) => {
			const item = document.createElement("button");
			item.className = "badge-popup-item";
			item.type = "button";
			if (entry.icon) {
				const icon = document.createElement("i");
				icon.className = entry.icon.startsWith("bi-")
					? `bi ${entry.icon}`
					: entry.icon;
				item.appendChild(icon);
			}
			const labelSpan = document.createElement("span");
			labelSpan.textContent = entry.label || "";
			item.appendChild(labelSpan);
			item.addEventListener("click", () => {
				popupEl.remove();
				if (entry.type === "js" && entry.value) {
					try {
						const fn = new Function("badge", "userId", "username", entry.value);
						fn(badge, userId, username);
					} catch (err) {
						console.error("Badge popup JS error:", err);
					}
				} else if (entry.type === "url" && entry.value) {
					if (/^https?:\/\//i.test(entry.value)) {
						window.open(entry.value, "_blank", "noopener,noreferrer");
					}
				}
			});
			popupEl.appendChild(item);
		});
		document.body.appendChild(popupEl);
		const rect = badgeEl.getBoundingClientRect();
		popupEl.style.position = "fixed";
		popupEl.style.top = `${rect.bottom + 4}px`;
		popupEl.style.left = `${rect.left}px`;
		popupEl.style.zIndex = "10000";
		const closePopup = (e) => {
			if (!popupEl.contains(e.target) && e.target !== badgeEl) {
				popupEl.remove();
				document.removeEventListener("click", closePopup);
			}
		};
		setTimeout(() => document.addEventListener("click", closePopup), 0);
		return;
	}
	if (type === "client_js") {
		try {
			const fn = new Function(
				"badge",
				"badgeEl",
				"userId",
				"username",
				badge?.action_value || "",
			);
			fn(badge, badgeEl, userId, username);
		} catch (err) {
			console.error("Badge JS failed", err);
		}
	}
};

const renderCustomBadge = (badge, userId, username) => {
	const badgeEl = document.createElement("span");
	badgeEl.className = "custom-badge";
	badgeEl.title = badge?.name || "Custom Badge";
	badgeEl.tabIndex = 0;

	if (badge?.svg_content) {
		badgeEl.innerHTML = badge.svg_content;
		const svg = badgeEl.querySelector("svg");
		if (svg) {
			svg.setAttribute("width", "16");
			svg.setAttribute("height", "16");
			svg.style.verticalAlign = "middle";
		}
	} else if (badge?.image_url) {
		const img = document.createElement("img");
		img.src = badge.image_url;
		img.alt = badge?.name || "Badge";
		img.width = 16;
		img.height = 16;
		img.style.verticalAlign = "middle";
		img.draggable = false;
		badgeEl.appendChild(img);
	}

	if ((badge?.action_type || "none") !== "none") {
		badgeEl.addEventListener("click", (e) => {
			e.stopPropagation();
			e.preventDefault();
			handleCustomBadgeAction(badge, badgeEl, userId, username);
		});
		badgeEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				handleCustomBadgeAction(badge, badgeEl, userId, username);
			}
		});
	}

	return badgeEl;
};

const createBlockedModal = () => {
	createModal({
		content: `<div style="padding: 24px; text-align: center;">
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--error-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-ban-icon lucide-shield-ban" style="margin-top: 1em;margin-bottom: 0.5em;"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m4.243 5.21 14.39 12.472"></path></svg>
<h2 style="margin: 3px 0 15px; font-size: 20px;color:var(--error-color)">This user has blocked you</h2>
<p style="margin: 0; color: var(--text-secondary); line-height: 1.5;text-align:left">
<strong>What this means for you:</strong></p>
<ul style="margin-top:6px;text-align:left;display:flex;gap:6px;flex-direction: column;    padding-left: 18px;">
<li>You will not be able to interact with POSTS from this user</li>
<li>You will not be able to follow or DM this user</li>
<li>This may impact your engagement and algorithm score negatively. You can learn more about your score in "Algorithm Impact" in Settings.</li>
</ul>
<p style="margin: 0; color: var(--text-secondary); line-height: 1.5;text-align:left">
<strong>What this means for the user:</strong></p>
<ul style="margin-top:6px;text-align:left;display:flex;gap:6px;flex-direction: column;    padding-left: 18px;">
<li>They will not be able to see your POSTS in their timeline</li>
<li>They won't be able to interact with your profile either</li>
<li>They won't get notifications for your POSTS</li>
</ul>
<p style="margin: 0; color: var(--text-secondary); line-height: 1.5;text-align:left">If you believe this is part of an algorithm manipulation campaign, please contact us.</p>
</div>`,
	});
};

const createFactCheck = (fact_check) => {
	const factCheckEl = document.createElement("div");
	factCheckEl.className = "fact-check-banner";
	factCheckEl.dataset.severity = fact_check.severity || "warning";

	const icon = document.createElement("span");
	icon.className = "fact-check-icon";
	icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;

	const content = document.createElement("div");
	content.className = "fact-check-content";

	const title = document.createElement("strong");
	title.textContent =
		fact_check.severity === "danger"
			? "Misleading or misinformation"
			: fact_check.severity === "warning"
				? "Potentially misleading post"
				: "Additional context";

	const note = document.createElement("p");

	const linkRegex = /https?:\/\/[^\s<>"']+/g;
	const htmlString = fact_check.note
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("\n", "<br>")
		.replace(
			linkRegex,
			(url) =>
				`<a href="${
					url.startsWith("http") ? url : `https://${url}`
				}" target="_blank" rel="noopener noreferrer">${
					url.length > 60 ? `${url.slice(0, 50)}…` : url
				}</a>`,
		);
	note.innerHTML = DOMPurify.sanitize(htmlString, DOMPURIFY_CONFIG);

	content.appendChild(title);
	content.appendChild(note);

	factCheckEl.appendChild(icon);
	factCheckEl.appendChild(content);

	return factCheckEl;
};

const emojiMapPromise = (async () => {
	try {
		const resp = await fetch("/api/emojis");
		if (!resp.ok) return {};
		const data = await resp.json();
		const map = {};
		for (const e of data.emojis || []) map[e.name] = e.file_url;
		return map;
	} catch (_err) {
		return {};
	}
})();

async function replaceEmojiShortcodesInElement(container) {
	try {
		const map = await emojiMapPromise;
		if (!map || Object.keys(map).length === 0) return;

		const regex = /:([a-zA-Z0-9_+-]+):/g;

		const walker = document.createTreeWalker(
			container,
			NodeFilter.SHOW_TEXT,
			{
				acceptNode(node) {
					if (!node.nodeValue || !node.nodeValue.includes(":"))
						return NodeFilter.FILTER_REJECT;
					const parentTag = node.parentNode?.nodeName?.toLowerCase();
					if (
						["code", "pre", "a", "textarea", "script", "style"].includes(
							parentTag,
						)
					)
						return NodeFilter.FILTER_REJECT;
					return NodeFilter.FILTER_ACCEPT;
				},
			},
			false,
		);

		const nodes = [];
		while (walker.nextNode()) nodes.push(walker.currentNode);

		for (const textNode of nodes) {
			const text = textNode.nodeValue;
			regex.lastIndex = 0;
			if (!regex.test(text)) continue;

			regex.lastIndex = 0;
			const frag = document.createDocumentFragment();
			let lastIndex = 0;
			for (;;) {
				const m = regex.exec(text);
				if (!m) break;
				const [full, name] = m;
				const idx = m.index;
				if (idx > lastIndex) {
					frag.appendChild(document.createTextNode(text.slice(lastIndex, idx)));
				}
				const url = map[name];
				if (url) {
					const img = document.createElement("img");
					img.src = url;
					img.alt = `:${name}:`;
					img.className = "inline-emoji";
					img.width = 20;
					img.height = 20;
					img.setAttribute("loading", "lazy");
					img.style.verticalAlign = "middle";
					img.style.margin = "0 2px";
					frag.appendChild(img);
				} else {
					frag.appendChild(document.createTextNode(full));
				}
				lastIndex = idx + full.length;
			}
			if (lastIndex < text.length) {
				frag.appendChild(document.createTextNode(text.slice(lastIndex)));
			}

			textNode.parentNode.replaceChild(frag, textNode);
		}
	} catch {}
}

const PROFILE_AVATAR_PX = 100;
function avatarPxToPercent(px) {
	const n = Number(px) || 0;
	const pct = (n / PROFILE_AVATAR_PX) * 100;

	const clamped = Math.max(0, Math.min(100, pct));
	return `${clamped}%`;
}

async function checkReplyPermissions(POST, replyRestriction) {
	try {
		const data = await query(`/POSTS/can-reply/${POST.id}`);

		if (data.error) {
			return {
				canReply: false,
				restrictionText: "Unable to check reply permissions",
			};
		}

		let restrictionText = "";
		switch (replyRestriction) {
			case "following":
				restrictionText = `Only people @${POST.author.username} follows can reply`;
				break;
			case "followers":
				restrictionText = `Only people who follow @${POST.author.username} can reply`;
				break;
			case "verified":
				restrictionText = "Only verified users can reply";
				break;
			default:
				restrictionText = data.canReply
					? "You can reply"
					: "You cannot reply to this POST";
		}

		return { canReply: data.canReply, restrictionText };
	} catch (error) {
		console.error("Error checking reply permissions:", error);
		return {
			canReply: false,
			restrictionText: "Error checking reply permissions",
		};
	}
}

function formatInteractionTime(date) {
	const now = new Date();
	const diff = now - date;
	const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));

	if (daysDiff === 0) {
		const hoursDiff = Math.floor(diff / (1000 * 60 * 60));
		if (hoursDiff === 0) {
			const minutesDiff = Math.floor(diff / (1000 * 60));
			return minutesDiff <= 1 ? "now" : `${minutesDiff}m ago`;
		}
		return `${hoursDiff}h ago`;
	} else if (daysDiff === 1) {
		return "yesterday";
	} else if (daysDiff < 7) {
		return `${daysDiff}d ago`;
	} else {
		return date.toLocaleDateString([], { month: "short", day: "numeric" });
	}
}

DOMPurify.addHook("uponSanitizeElement", (node, data) => {
	if (!data.allowedTags || data.allowedTags[data.tagName]) {
		return;
	}

	const textNode = document.createTextNode(node.outerHTML);
	node.parentNode.replaceChild(textNode, node);
});

const linkifyText = (text) => {
	const normalizeListMarkers = (md) => {
		const lines = md.split("\n");
		let inFence = false;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (/^```/.test(line)) {
				inFence = !inFence;
				continue;
			}
			if (inFence) continue;
			if (/^[ \t]{4,}/.test(line)) continue;
			const mDash = line.match(/^([ \t]{0,3})(-)(\s+)(.*)$/);
			if (mDash) {
				lines[i] = `${mDash[1]}\\-${mDash[3]}${mDash[4]}`;
			}
			const mPlus = line.match(/^([ \t]{0,3})([+])(\s+)(.*)$/);
			if (mPlus) {
				lines[i] = `${mPlus[1]}*${mPlus[3]}${mPlus[4]}`;
			}
		}
		return lines.join("\n");
	};

	const processCustomMarkdown = (text) => {
		return text
			.replace(/~([^~\n]+)~/g, "<sub>$1</sub>")
			.replace(/\^([^^\n]+)\^/g, "<sup>$1</sup>");
	};

	let processedText = text.replace(
		/(^|[\s])@([a-zA-Z0-9_]+)/g,
		'$1<span data-mention="$2">@$2</span>',
	);
	processedText = processedText.replace(
		/(^|[\s])#([a-zA-Z0-9_]+)/g,
		'$1<span data-hashtag="$2">#$2</span>',
	);

	const html = marked.parse(normalizeListMarkers(processedText.trim()), {
		breaks: true,
		gfm: true,
		html: true,
		headerIds: false,
		mangle: false,
	});

	let processedHtml = html.replace(
		/<span data-mention="([^"]+)">@\1<\/span>/g,
		'<a href="javascript:" class="POST-mention" data-username="$1">@$1</a>',
	);
	processedHtml = processedHtml.replace(
		/<span data-hashtag="([^"]+)">#\1<\/span>/g,
		'<a href="javascript:" class="POST-hashtag" data-hashtag="$1">#$1</a>',
	);

	processedHtml = processCustomMarkdown(processedHtml);

	const el = document.createElement("div");
	el.innerHTML = DOMPurify.sanitize(processedHtml, DOMPURIFY_CONFIG);

	el.querySelectorAll("a").forEach((a) => {
		a.setAttribute("target", "_blank");
		a.setAttribute("rel", "noopener noreferrer");
		if (a.innerText.length > 60) {
			a.innerText = `${a.innerText.slice(0, 60)}…`;
		}
		if (a.href.startsWith("javascript:") || a.href.startsWith("data:")) {
			a.removeAttribute("href");
		}
		if (a.href.startsWith("http://") || a.href.startsWith("https://")) {
			a.innerText = a.href.startsWith("http://")
				? a.innerText.replace("http://", "")
				: a.innerText.replace("https://", "");
		}
	});

	return el.innerHTML;
};

const timeAgo = (date) => {
	const now = new Date();
	let dateObj;

	if (typeof date === "string" && !date.endsWith("Z") && !date.includes("+")) {
		dateObj = new Date(`${date}Z`);
	} else {
		dateObj = new Date(date);
	}

	const seconds = Math.floor((now - dateObj) / 1000);

	if (seconds === -1 || seconds === 0) return "just now";

	if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""} ago`;
	if (seconds < 3600) {
		const mins = Math.floor(seconds / 60);
		return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
	}
	if (seconds < 86400) {
		const hours = Math.floor(seconds / 3600);
		return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
	}
	if (seconds < 604800) {
		const days = Math.floor(seconds / 86400);
		return `${days} day${days !== 1 ? "s" : ""} ago`;
	}

	const monthNames = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];
	const day = dateObj.getDate();
	const year = dateObj.getFullYear();
	const month = monthNames[dateObj.getMonth()];

	const daySuffix = (d) => {
		if (d >= 11 && d <= 13) return "th";
		switch (d % 10) {
			case 1:
				return "st";
			case 2:
				return "nd";
			case 3:
				return "rd";
			default:
				return "th";
		}
	};

	if (year === now.getFullYear()) return `${month} ${day}${daySuffix(day)}`;
	return `${month} ${day}${daySuffix(day)} ${year}`;
};

const formatTimeRemaining = (expiresAt) => {
	const now = new Date();
	const expires = new Date(expiresAt);
	const diff = expires - now;

	if (diff <= 0) return "Ended";

	const minutes = Math.floor(diff / (1000 * 60));
	const hours = Math.floor(diff / (1000 * 60 * 60));
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));

	if (days > 0) return `${days}d left`;
	if (hours > 0) return `${hours}h left`;
	return `${minutes}m left`;
};

const createPollElement = (poll, POST) => {
	if (!poll) return null;

	const pollEl = document.createElement("div");
	pollEl.className = "POST-poll";

	const pollOptionsEl = document.createElement("div");
	pollOptionsEl.className = "poll-options";

	poll.options.forEach((option) => {
		const optionEl = document.createElement("div");
		optionEl.className = `poll-option ${
			poll.userVote === option.id ? "voted" : ""
		} ${poll.isExpired ? "expired" : ""}`;

		if (poll.isExpired || poll.userVote) {
			optionEl.innerHTML = `
				<div class="poll-option-bar" style="width: ${option.percentage}%"></div>
				<div class="poll-option-content">
					<span class="poll-option-text">${option.option_text
						.replaceAll("<", "&lt;")
						.replaceAll(
							">",
							"&gt;",
						)}${poll.userVote === option.id ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-check-icon lucide-circle-check"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>` : ""}</span>
					<span class="poll-option-percentage">${option.percentage}%</span>
				</div>
			`;
		} else {
			optionEl.classList.add("poll-option-clickable");
			optionEl.innerHTML = `
				<div class="poll-option-content">
					<span class="poll-option-text">${option.option_text
						.replaceAll("<", "&lt;")
						.replaceAll(
							">",
							"&gt;",
						)}${poll.userVote === option.id ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-check-icon lucide-circle-check"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>` : ""}</span>
				</div>
			`;
			optionEl.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				votePoll(POST.id, option.id, pollEl);
			});
		}

		pollOptionsEl.appendChild(optionEl);
	});

	const pollMetaEl = document.createElement("div");
	pollMetaEl.className = "poll-meta";

	const pollVotesEl = document.createElement("div");
	pollVotesEl.className = "poll-votes-container";

	if (poll.voters && poll.voters.length > 0) {
		const voterAvatarsEl = document.createElement("div");
		voterAvatarsEl.className = "voter-avatars";

		poll.voters.slice(0, 3).forEach((voter, index) => {
			const avatarEl = document.createElement("img");
			avatarEl.className = "voter-avatar";
			avatarEl.src = voter.avatar || `/public/shared/assets/default-avatar.svg`;
			avatarEl.alt = voter.name || voter.username;
			avatarEl.title = voter.name || voter.username;
			avatarEl.setAttribute("loading", "lazy");
			const voterRadius =
				voter.avatar_radius !== null && voter.avatar_radius !== undefined
					? avatarPxToPercent(voter.avatar_radius)
					: voter.gold || voter.gray
						? "4px"
						: "50px";
			avatarEl.style.borderRadius = voterRadius;
			avatarEl.style.zIndex = poll.voters.length - index;
			voterAvatarsEl.appendChild(avatarEl);
		});

		pollVotesEl.appendChild(voterAvatarsEl);
	}

	const votesTextEl = document.createElement("span");
	votesTextEl.className = "poll-votes-text";
	votesTextEl.textContent = `${poll.totalVotes} vote${
		poll.totalVotes !== 1 ? "s" : ""
	}`;
	pollVotesEl.appendChild(votesTextEl);

	const pollTimeEl = document.createElement("span");
	pollTimeEl.className = "poll-time";
	pollTimeEl.textContent = formatTimeRemaining(poll.expires_at);

	pollMetaEl.appendChild(pollVotesEl);
	pollMetaEl.appendChild(pollTimeEl);

	pollEl.appendChild(pollOptionsEl);
	pollEl.appendChild(pollMetaEl);

	return pollEl;
};

const votePoll = async (POSTId, optionId, pollElement) => {
	try {
		const result = await query(`/POSTS/${POSTId}/poll/vote`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ optionId }),
		});

		if (result.success) {
			updatePollDisplay(pollElement, result.poll);
		} else {
			toastQueue.add(`<h1>${result.error || "Failed to vote"}</h1>`);
		}
	} catch (error) {
		console.error("Vote error:", error);
		toastQueue.add(`<h1>Network error. Please try again.</h1>`);
	}
};

const updatePollDisplay = (pollElement, poll) => {
	const optionsContainer = pollElement.querySelector(".poll-options");
	const metaContainer = pollElement.querySelector(".poll-meta");

	optionsContainer.innerHTML = "";

	poll.options.forEach((option) => {
		const optionEl = document.createElement("div");
		optionEl.className = `poll-option voted ${poll.isExpired ? "expired" : ""}`;
		optionEl.innerHTML = `
			<div class="poll-option-bar" style="width: ${option.percentage}%"></div>
			<div class="poll-option-content">
				<span class="poll-option-text">${option.option_text
					.replaceAll("<", "&lt;")
					.replaceAll(
						">",
						"&gt;",
					)} <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-check-icon lucide-circle-check"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg></span>
				<span class="poll-option-percentage">${option.percentage}%</span>
			</div>
		`;

		if (option.id === poll.userVote) {
			optionEl.classList.add("user-voted");
		}

		optionsContainer.appendChild(optionEl);
	});

	metaContainer.innerHTML = "";

	const pollVotesEl = document.createElement("div");
	pollVotesEl.className = "poll-votes-container";

	if (poll.voters && poll.voters.length > 0) {
		const voterAvatarsEl = document.createElement("div");
		voterAvatarsEl.className = "voter-avatars";

		poll.voters.slice(0, 3).forEach((voter, index) => {
			const avatarEl = document.createElement("img");
			avatarEl.className = "voter-avatar";
			avatarEl.src = voter.avatar || `/public/shared/assets/default-avatar.svg`;
			avatarEl.alt = voter.name || voter.username;
			avatarEl.title = voter.name || voter.username;
			avatarEl.setAttribute("loading", "lazy");
			const voterRadius2 =
				voter.avatar_radius !== null && voter.avatar_radius !== undefined
					? avatarPxToPercent(voter.avatar_radius)
					: voter.gold || voter.gray
						? "4px"
						: "50px";
			avatarEl.style.borderRadius = voterRadius2;
			avatarEl.style.zIndex = poll.voters.length - index;
			voterAvatarsEl.appendChild(avatarEl);
		});

		pollVotesEl.appendChild(voterAvatarsEl);
	}

	const votesTextEl = document.createElement("span");
	votesTextEl.className = "poll-votes-text";
	votesTextEl.textContent = `${poll.totalVotes} vote${
		poll.totalVotes !== 1 ? "s" : ""
	}`;
	pollVotesEl.appendChild(votesTextEl);

	const pollTimeEl = document.createElement("span");
	pollTimeEl.className = "poll-time";
	pollTimeEl.textContent = formatTimeRemaining(poll.expires_at);

	metaContainer.appendChild(pollVotesEl);
	metaContainer.appendChild(pollTimeEl);
};

async function showInteractionsModal(POSTId, initialTab = "likes") {
	const { observeTabContainer, updateTabIndicator } = await import(
		"../../shared/tab-indicator.js"
	);
	const {
		createPOSTSkeleton,
		createUserSkeleton,
		removeSkeletons,
		showSkeletons,
	} = await import("../../shared/skeleton-utils.js");

	const modalContent = document.createElement("div");
	modalContent.className = "interactions-modal-content";

	const tabsContainer = document.createElement("div");
	tabsContainer.className = "interactions-tabs tab-nav";

	const tabs = [
		{ id: "likes", label: "Likes" },
		{ id: "rePOSTS", label: "RePOSTS" },
		{ id: "quotes", label: "Quotes" },
	];

	const contentContainer = document.createElement("div");
	contentContainer.className = "interactions-content";

	let activeTab = initialTab;
	let modal = null;
	let currentSkeletons = [];

	const loadTabContent = async (tabId) => {
		contentContainer.innerHTML = "";
		if (currentSkeletons.length) removeSkeletons(currentSkeletons);

		const isQuotes = tabId === "quotes";
		const skeletonCreator = isQuotes ? createPOSTSkeleton : createUserSkeleton;

		currentSkeletons = showSkeletons(contentContainer, skeletonCreator, 3);

		try {
			const data = await query(`/POSTS/${POSTId}/${tabId}`);

			contentContainer.innerHTML = "";
			currentSkeletons = [];

			if (isQuotes) {
				if (!data.POSTS || data.POSTS.length === 0) {
					contentContainer.innerHTML = `<div class="empty-state">No quotes yet</div>`;
					return;
				}

				data.POSTS.forEach((POST) => {
					const POSTEl = createPOSTElement(POST, {
						clickToOpen: true,
						showTopReply: false,
						isTopReply: false,
						size: "normal",
					});
					contentContainer.appendChild(POSTEl);
				});
			} else {
				if (!data.users || data.users.length === 0) {
					contentContainer.innerHTML = `<div class="empty-state">No ${tabId} yet</div>`;
					return;
				}

				const usersList = document.createElement("div");
				usersList.className = "users-list";

				data.users.forEach((user) => {
					const userItem = document.createElement("div");
					userItem.className = "user-item";

					const timeText =
						tabId === "likes"
							? `liked ${formatInteractionTime(new Date(user.liked_at))}`
							: `rePOSTed ${formatInteractionTime(
									new Date(user.rePOSTed_at),
								)}`;

					userItem.innerHTML = `
            <div class="user-avatar">
              <img src="${
								user.avatar || "/public/shared/assets/default-avatar.svg"
							}" alt="${user.name || user.username}" />
            </div>
            <div class="user-info">
              <div class="user-name">${user.name || user.username}</div>
              <div class="user-username">@${user.username}</div>
              <div class="user-time">${timeText}</div>
            </div>
          `;

					userItem.addEventListener("click", async () => {
						modal?.close();
						const { default: openProfile } = await import("./profile.js");
						openProfile(user.username);
					});

					usersList.appendChild(userItem);
				});

				contentContainer.appendChild(usersList);
			}
		} catch (error) {
			console.error("Error loading interactions:", error);
			removeSkeletons(currentSkeletons);
			currentSkeletons = [];
			contentContainer.innerHTML = `<div class="empty-state">Failed to load ${tabId}</div>`;
		}
	};

	tabs.forEach((tab) => {
		const tabButton = document.createElement("button");
		tabButton.className = "tab-button";
		tabButton.dataset.tab = tab.id;
		tabButton.textContent = tab.label;

		if (tab.id === activeTab) {
			tabButton.classList.add("active");
		}

		tabButton.addEventListener("click", () => {
			tabsContainer.querySelectorAll(".tab-button").forEach((btn) => {
				btn.classList.remove("active");
			});
			tabButton.classList.add("active");
			activeTab = tab.id;
			updateTabIndicator(tabsContainer, tabButton);
			loadTabContent(tab.id);
		});

		tabsContainer.appendChild(tabButton);
	});

	modalContent.appendChild(tabsContainer);
	modalContent.appendChild(contentContainer);

	modal = createModal({
		title: "Interactions",
		content: modalContent,
		className: "interactions-tabbed-modal",
	});

	setTimeout(() => {
		observeTabContainer(tabsContainer);
		const activeButton = tabsContainer.querySelector(".tab-button.active");
		if (activeButton) {
			updateTabIndicator(tabsContainer, activeButton);
		}
	}, 50);

	await loadTabContent(activeTab);
}

export const createPOSTElement = (POST, config = {}) => {
	if (!POST || !POST.author) {
		console.error("Invalid POST object provided to createPOSTElement");
		return document.createElement("div");
	}

	const {
		clickToOpen = true,
		showTopReply = false,
		isTopReply = false,
		size = "normal",
	} = config;

	if (POST.author.blocked_by_user) {
		const blockedEl = document.createElement("div");
		blockedEl.className = "POST blocked-POST";
		blockedEl.style.cssText =
			"display: flex; align-items: center; justify-content: space-between; padding: 16px; color: var(--text-secondary); background: var(--bg-secondary); border-radius: 12px; margin-bottom: 1px;";
		blockedEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                <span>You blocked this user.</span>
            </div>
            <button class="unblock-btn" style="background: transparent; border: 1px solid var(--border); color: var(--text-primary); padding: 4px 12px; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 600;">Unblock</button>
        `;

		blockedEl
			.querySelector(".unblock-btn")
			.addEventListener("click", async (e) => {
				e.stopPropagation();
				e.preventDefault();
				try {
					const result = await query("/blocking/unblock", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ userId: POST.author.id }),
					});
					if (result.success) {
						toastQueue.add("<h1>Unblocked user</h1>");
						POST.author.blocked_by_user = false;
						const newEl = createPOSTElement(POST, config);
						blockedEl.replaceWith(newEl);
					} else {
						toastQueue.add(`<h1>${result.error || "Failed to unblock"}</h1>`);
					}
				} catch (err) {
					console.error(err);
					toastQueue.add("<h1>Error unblocking user</h1>");
				}
			});
		return blockedEl;
	}

	if (!POST.reaction_count) {
		if (typeof POST.total_reactions === "number") {
			POST.reaction_count = POST.total_reactions;
		} else if (typeof POST.reactions_count === "number") {
			POST.reaction_count = POST.reactions_count;
		} else if (Array.isArray(POST.reactions)) {
			POST.reaction_count = POST.reactions.length;
		}
	}

	const POSTEl = document.createElement("div");
	POSTEl.className = isTopReply ? "POST top-reply" : "POST";
	POSTEl.setAttribute("data-POST-id", POST.id);

	if (size === "preview") {
		POSTEl.classList.add("POST-preview");
		POSTEl.classList.add("clickable");
	}

	if (POST.outline && POST.author.gray) {
		if (POST.outline.includes("gradient")) {
			POSTEl.style.setProperty("border", "2px solid transparent", "important");
			POSTEl.style.setProperty(
				"border-image",
				`${POST.outline} 1`,
				"important",
			);
		} else {
			POSTEl.style.setProperty(
				"border",
				`2px solid ${POST.outline}`,
				"important",
			);
		}
		POSTEl.style.setProperty("border-radius", "12px", "important");
	}

	const POSTHeaderEl = document.createElement("div");
	POSTHeaderEl.className = "POST-header";

	const POSTHeaderAvatarEl = document.createElement("img");
	POSTHeaderAvatarEl.src =
		POST.author.avatar || `/public/shared/assets/default-avatar.svg`;
	POSTHeaderAvatarEl.alt = POST.author.name || POST.author.username;
	POSTHeaderAvatarEl.classList.add("POST-header-avatar");
	POSTHeaderAvatarEl.setAttribute("loading", "lazy");
	POSTHeaderAvatarEl.loading = "lazy";
	POSTHeaderAvatarEl.width = 48;
	POSTHeaderAvatarEl.height = 48;
	POSTHeaderAvatarEl.draggable = false;

	let avatarRadiusValue;
	if (
		POST.author.avatar_radius !== null &&
		POST.author.avatar_radius !== undefined
	) {
		avatarRadiusValue = avatarPxToPercent(POST.author.avatar_radius);
	} else if (POST.author.gold || POST.author.gray) {
		avatarRadiusValue = "4px";
	} else {
		avatarRadiusValue = "50px";
	}

	POSTHeaderAvatarEl.style.setProperty(
		"border-radius",
		avatarRadiusValue,
		"important",
	);

	if (POST.author.gray) {
		applyAvatarOutline(
			POSTHeaderAvatarEl,
			POST.author.avatar_outline || "",
			avatarRadiusValue,
			2,
		);
	} else {
		applyAvatarOutline(POSTHeaderAvatarEl, "", avatarRadiusValue, 2);
	}
	POSTHeaderAvatarEl.setAttribute("loading", "lazy");
	POSTHeaderAvatarEl.addEventListener("click", (e) => {
		e.stopPropagation();

		if (POST.author?.suspended) {
			switchPage("timeline", { path: "/" });
			return;
		}
		import("./profile.js").then(({ default: openProfile }) => {
			openProfile(POST.author.username);
		});
	});

	attachHoverCard(POSTHeaderAvatarEl, POST.author.username);

	POSTHeaderEl.appendChild(POSTHeaderAvatarEl);

	const POSTHeaderInfoEl = document.createElement("div");
	POSTHeaderInfoEl.className = "POST-header-info";

	const POSTHeaderNameEl = document.createElement("p");
	POSTHeaderNameEl.className = "name";
	POSTHeaderNameEl.textContent =
		POST.author.name || `@${POST.author.username}`;
	POSTHeaderNameEl.classList.add("POST-header-name");
	POSTHeaderNameEl.addEventListener("click", (e) => {
		const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
		const isExpandedView = clickToOpen === false && size !== "preview";
		if (isMobile && isExpandedView) {
			return;
		}
		e.stopPropagation();
		if (POST.author?.suspended) {
			switchPage("timeline", { path: "/" });
			return;
		}
		import("./profile.js").then(({ default: openProfile }) => {
			openProfile(POST.author.username);
		});
	});

	attachHoverCard(POSTHeaderNameEl, POST.author.username);

	if (POST.author.gold) {
		const badge = createVerificationBadge({ type: "gold" });
		POSTHeaderNameEl.appendChild(badge);
		attachCheckmarkPopup(badge, "gold");
	} else if (POST.author.gray) {
		const badge = createVerificationBadge({
			type: "gray",
			checkmarkOutline: POST.author.checkmark_outline || "",
		});
		POSTHeaderNameEl.appendChild(badge);
		attachCheckmarkPopup(badge, "gray");
	} else if (POST.author.verified) {
		const badge = createVerificationBadge({ type: "verified" });
		POSTHeaderNameEl.appendChild(badge);
		attachCheckmarkPopup(badge, "verified");
	}

	if (Array.isArray(POST.author.custom_badges)) {
		for (const badge of POST.author.custom_badges) {
			const badgeEl = renderCustomBadge(
				badge,
				POST.author.id,
				POST.author.username,
			);
			POSTHeaderNameEl.appendChild(badgeEl);
		}
	}

	if (POST.author.affiliate && POST.author.affiliate_with_profile) {
		const affiliateEl = document.createElement("a");
		affiliateEl.href = `/@${POST.author.affiliate_with_profile.username}`;
		affiliateEl.className = "role-badge affiliate-with";
		affiliateEl.title = `Affiliated with @${POST.author.affiliate_with_profile.username}`;

		affiliateEl.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			import("./profile.js").then(({ default: openProfile }) => {
				openProfile(POST.author.affiliate_with_profile.username);
			});
		});

		const affiliateImg = document.createElement("img");
		affiliateImg.src =
			POST.author.affiliate_with_profile.avatar ||
			"/public/shared/assets/default-avatar.svg";
		affiliateImg.alt =
			POST.author.affiliate_with_profile.name ||
			POST.author.affiliate_with_profile.username;
		affiliateImg.className = "affiliate-with-avatar";
		affiliateImg.draggable = false;

		if (
			POST.author.affiliate_with_profile.avatar_radius !== null &&
			POST.author.affiliate_with_profile.avatar_radius !== undefined
		) {
			affiliateImg.style.setProperty(
				"border-radius",
				`${POST.author.affiliate_with_profile.avatar_radius}px`,
			);
		} else if (
			POST.author.affiliate_with_profile.gold ||
			POST.author.affiliate_with_profile.gray
		) {
			affiliateImg.style.setProperty("border-radius", "4px");
		} else {
			affiliateImg.style.setProperty("border-radius", "50%");
		}

		affiliateEl.appendChild(affiliateImg);
		POSTHeaderNameEl.appendChild(affiliateEl);
	}

	if (POST.author.label_type) {
		const labelEl = document.createElement("span");
		labelEl.className = `POST-label label-${POST.author.label_type}`;
		const labelText =
			POST.author.label_type.charAt(0).toUpperCase() +
			POST.author.label_type.slice(1);
		labelEl.textContent = labelText;
		POSTHeaderNameEl.appendChild(labelEl);
	}

	if (POST.author.community_tag) {
		const communityTagEl = document.createElement("a");
		communityTagEl.href = `/communities/${POST.author.community_tag.community_id}`;
		communityTagEl.className = "community-tag";
		communityTagEl.title = `Member of ${POST.author.community_tag.community_name}`;
		communityTagEl.textContent = [
			POST.author.community_tag.emoji || "",
			POST.author.community_tag.text,
		]
			.join(" ")
			.trim();

		communityTagEl.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			import("./communities.js").then(({ loadCommunityDetail }) => {
				loadCommunityDetail(POST.author.community_tag.community_id);
			});
		});

		POSTHeaderNameEl.appendChild(communityTagEl);
	}

	if (POST.author.username !== POST.author.name && POST.author.name) {
		const usernameEl = document.createElement("span");
		usernameEl.textContent = `@${POST.author.username}`;
		usernameEl.classList.add("POST-header-username-span");
		POSTHeaderNameEl.appendChild(usernameEl);
	}

	const source_icons = {
		desktop_web: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="POST-source-icon lucide lucide-monitor-icon lucide-monitor"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>`,
		mobile_web: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="POST-source-icon lucide lucide-smartphone-icon lucide-smartphone"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`,
		scheduled: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock-icon lucide-clock"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/></svg>`,
		articles: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-newspaper-icon lucide-newspaper"><path d="M15 18h-5"/><path d="M18 14h-8"/><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2"/><rect width="8" height="4" x="10" y="6" rx="1"/></svg>`,
	};

	const POSTHeaderUsernameEl = document.createElement("p");
	POSTHeaderUsernameEl.className = "username";
	POSTHeaderUsernameEl.textContent = timeAgo(POST.created_at);
	POSTHeaderUsernameEl.classList.add("POST-header-username");
	POSTHeaderUsernameEl.addEventListener("click", (e) => {
		e.stopPropagation();
		if (POST.author?.suspended) {
			switchPage("timeline", { path: "/" });
			return;
		}
		import("./profile.js").then(({ default: openProfile }) => {
			openProfile(POST.author.username);
		});
	});

	if (POST.source && source_icons[POST.source]) {
		const sourceIconEl = document.createElement("span");
		sourceIconEl.className = "POST-source-icon-wrapper";
		sourceIconEl.innerHTML = `${source_icons[POST.source]}`;
		POSTHeaderUsernameEl.appendChild(sourceIconEl);
	} else if (POST.source) {
		POSTHeaderUsernameEl.textContent += ` · ${POST.source}`;
	}

	if (POST.edited_at) {
		const editedIndicator = document.createElement("span");
		editedIndicator.className = "POST-edited-indicator";
		editedIndicator.textContent = " (edited)";
		editedIndicator.title = "Click to view edit history";
		editedIndicator.addEventListener("click", async (e) => {
			e.stopPropagation();
			try {
				const history = await query(`/POSTS/${POST.id}/edit-history`);

				if (history.error) {
					toastQueue.add(`<h1>${history.error}</h1>`);
					return;
				}

				const historyContainer = document.createElement("div");
				historyContainer.className = "edit-history-list";
				historyContainer.style.cssText = `
					max-height: 500px;
					overflow-y: auto;
					padding: 16px;
				`;

				if (history.history && history.history.length > 0) {
					history.history.forEach((version) => {
						const versionEl = document.createElement("div");
						versionEl.className = "edit-history-item";
						versionEl.style.cssText = `
							padding: 16px;
							border-radius: 8px;
							background: ${version.is_current ? "var(--secondary-bg)" : "var(--primary-bg)"};
							margin-bottom: 12px;
							border: ${version.is_current ? "2px solid var(--primary)" : "1px solid var(--border)"};
						`;

						const headerEl = document.createElement("div");
						headerEl.style.cssText = `
							display: flex;
							justify-content: space-between;
							align-items: center;
							margin-bottom: 8px;
						`;

						const timeEl = document.createElement("span");
						timeEl.style.cssText = `
							font-size: 13px;
							color: var(--text-secondary);
							font-weight: 600;
						`;
						timeEl.textContent = timeAgo(version.edited_at);

						headerEl.appendChild(timeEl);

						if (version.is_current) {
							const badge = document.createElement("span");
							badge.textContent = "Current";
							badge.style.cssText = `
								background: var(--primary);
								color: var(--primary-fg);
								padding: 4px 8px;
								border-radius: 4px;
								font-size: 11px;
								font-weight: 600;
							`;
							headerEl.appendChild(badge);
						}

						const contentEl = document.createElement("div");
						contentEl.style.cssText = `
							color: var(--text-primary);
							line-height: 1.5;
							word-wrap: break-word;
						`;
						contentEl.textContent = version.content;

						versionEl.appendChild(headerEl);
						versionEl.appendChild(contentEl);
						historyContainer.appendChild(versionEl);
					});
				} else {
					historyContainer.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">No edit history available</p>`;
				}

				createModal({
					title: "Edit history",
					content: historyContainer,
					className: "edit-history-modal",
				});
			} catch (error) {
				console.error("Error fetching edit history:", error);
				toastQueue.add(`<h1>Failed to load edit history</h1>`);
			}
		});
		POSTHeaderUsernameEl.appendChild(editedIndicator);
	}

	POSTHeaderInfoEl.appendChild(POSTHeaderNameEl);
	POSTHeaderInfoEl.appendChild(POSTHeaderUsernameEl);

	POSTHeaderEl.appendChild(POSTHeaderInfoEl);

	if (POST.pinned) {
		const pinnedIndicatorEl = document.createElement("div");
		pinnedIndicatorEl.className = "pinned-indicator";
		pinnedIndicatorEl.innerHTML = `
			<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 17v5"></path>
				<path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 7.89 17H16.1a2 2 0 0 0 1.78-2.55l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 0-1-1H10a1 1 0 0 0-1 1z"></path>
			</svg>
			<span>Pinned</span>
		`;
		POSTEl.appendChild(pinnedIndicatorEl);
	}

	POSTEl.appendChild(POSTHeaderEl);

	const isArticlePost = Boolean(
		POST.is_article && POST.article_body_markdown,
	);
	const showFullArticle = isArticlePost && clickToOpen === false;

	if (isArticlePost) {
		const articleContainer = document.createElement("div");
		articleContainer.className = "POST-content POST-article";

		if (POST.article_title) {
			const titleEl = document.createElement("h2");
			titleEl.textContent = POST.article_title;
			articleContainer.appendChild(titleEl);
		}

		const coverAttachment = Array.isArray(POST.attachments)
			? POST.attachments.find((item) => item.file_type?.startsWith("image/"))
			: null;

		if (coverAttachment) {
			const coverEl = document.createElement("div");
			coverEl.classList.add("article-cover");
			coverEl.innerHTML = `<img src="${coverAttachment.file_url}" alt="${coverAttachment.file_name}" loading="lazy" />`;

			const coverImg = coverEl.querySelector("img");
			if (coverImg) {
				coverEl.appendChild(coverImg);
			}
			articleContainer.appendChild(coverEl);
		}

		if (showFullArticle) {
			const articleBody = document.createElement("div");
			articleBody.className = "POST-article-body";
			articleBody.innerHTML = DOMPurify.sanitize(
				marked.parse(POST.article_body_markdown, {
					breaks: true,
					gfm: true,
					headerIds: false,
					mangle: false,
				}),
				DOMPURIFY_CONFIG,
			);

			articleBody.querySelectorAll("a").forEach((anchor) => {
				anchor.setAttribute("target", "_blank");
				anchor.setAttribute("rel", "noopener noreferrer");
			});

			articleBody.querySelectorAll("img").forEach((img) => {
				if (!img.hasAttribute("loading")) {
					img.setAttribute("loading", "lazy");
				}
			});

			articleContainer.appendChild(articleBody);
		} else {
			const previewBody = document.createElement("div");
			previewBody.className = "POST-article-preview";
			const previewSource =
				POST.article_preview?.excerpt ||
				POST.article_title ||
				POST.content ||
				"";
			let previewText = previewSource.trim();
			if (previewText.length > 260) {
				previewText = `${previewText.slice(0, 257)}…`;
			}
			previewBody.innerHTML = linkifyText(previewText);
			replaceEmojiShortcodesInElement(previewBody);

			previewBody.querySelectorAll("a.POST-hashtag").forEach((tag) => {
				const hashtag = tag.getAttribute("data-hashtag");

				tag.addEventListener("click", (e) => {
					e.preventDefault();
					e.stopPropagation();

					searchQuery(`#${hashtag}`);
				});
			});

			articleContainer.appendChild(previewBody);

			const readMoreButton = document.createElement("button");
			readMoreButton.type = "button";
			readMoreButton.textContent = "Read article";
			readMoreButton.className = "POST-article-read-more";
			readMoreButton.addEventListener("click", async (event) => {
				event.preventDefault();
				event.stopPropagation();
				await openPOST(POST);
			});
			articleContainer.appendChild(readMoreButton);
		}

		POSTEl.appendChild(articleContainer);

		if (POST.fact_check) {
			POSTEl.appendChild(createFactCheck(POST.fact_check));
		}
	} else {
		const POSTContentEl = document.createElement("div");
		POSTContentEl.className = "POST-content";

		const rawContent = POST.content ? POST.content.trim() : "";

		const POSTLinkRegex = new RegExp(
			`https?://(?:www\\.)?(?:${location.host.replace(".", "\\.")})/POST/([a-zA-Z0-9_-]+)`,
			"g",
		);
		let contentWithoutLinks = rawContent;
		const extractedPOSTIds = [];
		let match = POSTLinkRegex.exec(rawContent);

		while (match !== null) {
			extractedPOSTIds.push(match[1]);
			contentWithoutLinks = contentWithoutLinks.replace(match[0], "").trim();
			match = POSTLinkRegex.exec(rawContent);
		}

		const isExpandedView = clickToOpen === false && size !== "preview";
		const shouldTrim =
			contentWithoutLinks.length > 300 &&
			!isExpandedView &&
			!POST.extended &&
			!POST.isExpanded;

		const applyLinkified = (text) => {
			POSTContentEl.innerHTML = linkifyText(text);
			replaceEmojiShortcodesInElement(POSTContentEl);

			POSTContentEl.querySelectorAll("a.POST-hashtag").forEach((tag) => {
				const hashtag = tag.getAttribute("data-hashtag");

				tag.addEventListener("click", (e) => {
					e.preventDefault();
					e.stopPropagation();

					searchQuery(`#${hashtag}`);
				});
			});
		};

		if (shouldTrim) {
			let trimmed = contentWithoutLinks.slice(0, 300);
			const lastSpace = Math.max(
				trimmed.lastIndexOf(" "),
				trimmed.lastIndexOf("\n"),
			);
			if (lastSpace > 0) trimmed = trimmed.slice(0, lastSpace);

			applyLinkified(trimmed);

			const ellipsis = document.createElement("span");
			ellipsis.className = "POST-ellipsis";
			ellipsis.innerText = "Show more…";
			ellipsis.title = "Show more";
			ellipsis.setAttribute("role", "button");
			ellipsis.tabIndex = 0;

			const expand = () => {
				applyLinkified(contentWithoutLinks);
				ellipsis.remove();

				const collapse = document.createElement("span");
				collapse.className = "POST-ellipsis";
				collapse.innerText = "Show less";
				collapse.addEventListener("click", (ev) => {
					ev.preventDefault();
					ev.stopPropagation();
					applyLinkified(trimmed);
					POSTContentEl.appendChild(ellipsis);
					collapse.remove();
				});

				POSTContentEl.appendChild(collapse);
			};

			ellipsis.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				expand();
			});
			ellipsis.addEventListener("keydown", (e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					expand();
				}
			});

			POSTContentEl.appendChild(ellipsis);
		} else {
			applyLinkified(contentWithoutLinks);
		}

		POSTContentEl.addEventListener("click", (e) => {
			if (e.target.classList.contains("POST-mention")) {
				e.preventDefault();
				e.stopPropagation();
				const username = e.target.dataset.username;
				import("./profile.js").then(({ default: openProfile }) => {
					openProfile(username);
				});
			}
		});

		POSTEl.appendChild(POSTContentEl);

		if (POST.fact_check) {
			POSTEl.appendChild(createFactCheck(POST.fact_check));
		}

		maybeAddTranslation(POST, POSTEl, POSTContentEl);

		if (extractedPOSTIds.length > 0 && !POST.quoted_POST) {
			const POSTId = extractedPOSTIds[0];
			query(`/POSTS/${POSTId}`)
				.then((response) => {
					if (response?.POST) {
						const quotedPOSTEl = createPOSTElement(response.POST, {
							size: "preview",
							clickToOpen: true,
						});
						quotedPOSTEl.classList.add("POST-preview");

						const existingQuote = POSTEl.querySelector(".POST-preview");
						if (!existingQuote) {
							const pollEl = POSTEl.querySelector(".poll-container");
							const attachmentsEl = POSTEl.querySelector(".POST-attachments");

							if (pollEl) {
								POSTEl.insertBefore(quotedPOSTEl, pollEl);
							} else if (attachmentsEl) {
								POSTEl.insertBefore(quotedPOSTEl, attachmentsEl);
							} else {
								POSTEl.appendChild(quotedPOSTEl);
							}
						}
					}
				})
				.catch((err) => {
					console.error("Failed to load embedded POST:", err);
				});
		}

		POSTContentEl.querySelectorAll("a").forEach((a) => {
			const url = new URL(a.href, location.origin);

			if (url.host === "youtube.com" || url.host === "www.youtube.com") {
				const videoId = url.searchParams.get("v");
				if (videoId) {
					const videoFrame = document.createElement("iframe");

					videoFrame.src = `https://www.youtube-nocookie.com/embed/${videoId}`;
					videoFrame.width = "200";
					videoFrame.height = "113";
					videoFrame.classList.add("POST-youtube-iframe");
					videoFrame.setAttribute("frameborder", "0");
					videoFrame.setAttribute(
						"allow",
						"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
					);
					videoFrame.setAttribute(
						"referrerpolicy",
						"strict-origin-when-cross-origin",
					);
					videoFrame.setAttribute("allowfullscreen", "true");
					videoFrame.title = "YouTube video player";
					videoFrame.setAttribute("loading", "lazy");

					POSTContentEl.appendChild(videoFrame);
				}
			}
		});
	}

	if (POST.poll) {
		const pollEl = createPollElement(POST.poll, POST);
		if (pollEl) {
			POSTEl.appendChild(pollEl);
		}
	}

	if (POST.interactive_card?.options) {
		const cardEl = document.createElement("div");
		cardEl.className = "interactive-card";

		const mediaEl = document.createElement("div");
		mediaEl.className = "card-media";

		if (
			POST.interactive_card.media_type === "image" ||
			POST.interactive_card.media_type === "gif"
		) {
			const img = document.createElement("img");
			img.src = POST.interactive_card.media_url;
			img.alt = "Card media";
			img.setAttribute("loading", "lazy");
			mediaEl.appendChild(img);
		} else if (POST.interactive_card.media_type === "video") {
			const video = document.createElement("video");
			video.src = POST.interactive_card.media_url;
			video.controls = true;
			video.setAttribute("loading", "lazy");
			mediaEl.appendChild(video);
		}

		cardEl.appendChild(mediaEl);

		const optionsEl = document.createElement("div");
		optionsEl.className = "card-options";

		POST.interactive_card.options.forEach((option) => {
			const optionBtn = document.createElement("button");
			optionBtn.type = "button";
			optionBtn.className = "card-option-button";
			optionBtn.textContent = `POST ${option.description}`;

			optionBtn.addEventListener("click", async (e) => {
				e.preventDefault();
				e.stopPropagation();

				const { createComposer } = await import("./composer.js");
				const composer = await createComposer({
					placeholder: "Confirm your POST...",
					autofocus: true,
					interactiveCard: POST.interactive_card,
					callback: async () => {
						modal.close();
						toastQueue.add(`<h1>POST posted!</h1>`);
					},
				});

				const textarea = composer.querySelector("#POST-textarea");
				if (textarea) {
					textarea.value = option.POST_text;
					textarea.dispatchEvent(new Event("input"));
				}

				const modal = createModal({
					title: "Confirm POST",
					content: composer,
				});
			});

			optionsEl.appendChild(optionBtn);
		});

		cardEl.appendChild(optionsEl);
		POSTEl.appendChild(cardEl);
	}

	if (!isArticlePost && POST.attachments && POST.attachments.length > 0) {
		const attachmentsEl = document.createElement("div");
		attachmentsEl.className = "POST-attachments";

		POST.attachments.forEach((attachment) => {
			const attachmentEl = document.createElement("div");
			attachmentEl.className = "POST-attachment";

			if (attachment.file_type.startsWith("image/")) {
				const img = document.createElement("img");
				img.src = attachment.file_url;
				img.alt = attachment.file_name;
				img.setAttribute("loading", "lazy");

				if (attachment.file_name === "unsplash.jpg" && attachment.file_hash) {
					try {
						const attribution = JSON.parse(attachment.file_hash);
						if (attribution?.user_name) {
							const attributionEl = document.createElement("div");
							attributionEl.className = "unsplash-attribution-badge";
							attributionEl.innerHTML = `
								via <a href="${attribution.user_link}?utm_source=Xeetapus&utm_medium=referral" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">${attribution.user_name}</a> / <a href="https://unsplash.com/?utm_source=Xeetapus&utm_medium=referral" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">Unsplash</a>
							`;
							attachmentEl.appendChild(attributionEl);
						}
					} catch (e) {
						console.error("Failed to parse Unsplash attribution", e);
					}
				}

				if (attachment.is_spoiler) {
					attachmentEl.classList.add("spoiler");
					const spoilerOverlay = document.createElement("div");
					spoilerOverlay.className = "spoiler-overlay";
					spoilerOverlay.innerHTML = `
            <div class="spoiler-content">
              <span>Spoiler</span>
            </div>
          `;
					spoilerOverlay.addEventListener("click", (e) => {
						e.preventDefault();
						e.stopPropagation();
						attachmentEl.classList.toggle("spoiler-revealed");
					});
					attachmentEl.appendChild(spoilerOverlay);
				}

				img.addEventListener("click", async (e) => {
					if (
						attachment.is_spoiler &&
						!attachmentEl.classList.contains("spoiler-revealed")
					) {
						e.preventDefault();
						e.stopPropagation();
						return;
					}
					e.preventDefault();
					e.stopPropagation();

					const { openImageFullscreen } = await import(
						"../../shared/image-viewer.js"
					);
					openImageFullscreen(attachment.file_url, attachment.file_name);
				});

				if (attachment.file_url.startsWith("https://emojik.vercel.app/s/")) {
					const imgWrapper = document.createElement("div");
					imgWrapper.classList.add("emojik-wrapper");

					img.draggable = false;
					img.loading = "lazy";
					img.src = `${attachment.file_url}?size=260`;

					imgWrapper.appendChild(img);

					const labelEl = document.createElement("div");
					labelEl.className = "emojik-label";

					const url = new URL(attachment.file_url);
					labelEl.textContent = url.pathname
						.replace("/s/", "")
						.split("_")
						.map(decodeURIComponent)
						.join(" + ");

					imgWrapper.appendChild(labelEl);
					POSTEl.appendChild(imgWrapper);
				} else {
					attachmentEl.appendChild(img);
				}
			} else if (attachment.file_type === "video/mp4") {
				const video = document.createElement("video");
				video.src = attachment.file_url;
				video.controls = true;
				attachmentEl.appendChild(video);
			}

			attachmentsEl.appendChild(attachmentEl);
		});

		if (attachmentsEl.querySelectorAll("img, video").length)
			POSTEl.appendChild(attachmentsEl);
	}

	if (POST.link_preview && !POST.attachments?.length && !POST.quoted_POST) {
		const linkPreviewEl = document.createElement("a");
		linkPreviewEl.className = "link-preview";
		linkPreviewEl.href = POST.link_preview.url;
		linkPreviewEl.target = "_blank";
		linkPreviewEl.rel = "noopener noreferrer";
		linkPreviewEl.addEventListener("click", (e) => {
			e.stopPropagation();
		});

		if (POST.link_preview.image) {
			const previewImg = document.createElement("img");
			previewImg.src = POST.link_preview.image;
			previewImg.alt = POST.link_preview.title || "Link preview";
			previewImg.className = "link-preview-image";
			previewImg.loading = "lazy";
			linkPreviewEl.appendChild(previewImg);
		}

		const previewContent = document.createElement("div");
		previewContent.className = "link-preview-content";

		if (POST.link_preview.site_name) {
			const siteName = document.createElement("div");
			siteName.className = "link-preview-site";
			siteName.textContent = POST.link_preview.site_name;
			previewContent.appendChild(siteName);
		}

		if (POST.link_preview.title) {
			const title = document.createElement("div");
			title.className = "link-preview-title";
			title.textContent = POST.link_preview.title;
			previewContent.appendChild(title);
		}

		if (POST.link_preview.description) {
			const description = document.createElement("div");
			description.className = "link-preview-description";
			const truncated = POST.link_preview.description.slice(0, 150);
			description.textContent =
				truncated.length < POST.link_preview.description.length
					? `${truncated}…`
					: truncated;
			previewContent.appendChild(description);
		}

		linkPreviewEl.appendChild(previewContent);
		POSTEl.appendChild(linkPreviewEl);
	}

	if (POST.quoted_POST) {
		if (POST.quoted_POST.unavailable_reason === "suspended") {
			const suspendedQuoteEl = document.createElement("div");
			suspendedQuoteEl.className =
				"POST-preview unavailable-quote suspended-quote";
			suspendedQuoteEl.textContent = "This POST is from a suspended account.";

			suspendedQuoteEl.addEventListener("click", (ev) => {
				ev.preventDefault();
				ev.stopPropagation();
			});
			suspendedQuoteEl.style.cursor = "default";
			POSTEl.appendChild(suspendedQuoteEl);
		} else if (!POST.quoted_POST.author) {
			const unavailableQuoteEl = document.createElement("div");
			unavailableQuoteEl.className = "POST-preview unavailable-quote";
			unavailableQuoteEl.textContent = "Quote POST unavailable";
			unavailableQuoteEl.addEventListener("click", (ev) => {
				ev.preventDefault();
				ev.stopPropagation();
			});
			unavailableQuoteEl.style.cursor = "default";
			POSTEl.appendChild(unavailableQuoteEl);
		} else {
			const quotedPOSTEl = createPOSTElement(POST.quoted_POST, {
				clickToOpen: true,
				showTopReply: false,
				isTopReply: false,
				size: "preview",
			});
			POSTEl.appendChild(quotedPOSTEl);
		}
	}

	const POSTInteractionsEl = document.createElement("div");
	POSTInteractionsEl.className = "POST-interactions";

	const POSTInteractionsLikeEl = document.createElement("button");
	POSTInteractionsLikeEl.className = "engagement";
	POSTInteractionsLikeEl.dataset.liked = POST.liked_by_user;
	POSTInteractionsLikeEl.dataset.likeCount = POST.like_count || 0;
	POSTInteractionsLikeEl.style.setProperty("--color", "249, 25, 128");

	POSTInteractionsLikeEl.innerHTML = `<svg
          width="19"
          height="19"
          viewBox="0 0 20 20"
          fill="${POST.liked_by_user ? "#F91980" : "none"}"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5.00002 2.54822C8.00003 2.09722 9.58337 4.93428 10 5.87387C10.4167 4.93428 12 2.09722 15 2.54822C18 2.99923 18.75 5.66154 18.75 7.05826C18.75 9.28572 18.1249 10.9821 16.2499 13.244C14.3749 15.506 10 18.3333 10 18.3333C10 18.3333 5.62498 15.506 3.74999 13.244C1.875 10.9821 1.25 9.28572 1.25 7.05826C1.25 5.66154 2 2.99923 5.00002 2.54822Z"
            stroke="${POST.liked_by_user ? "#F91980" : "currentColor"}"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg> <span class="like-count">${
					POST.like_count ? formatNumber(POST.like_count) : ""
				}</span>`;

	POSTInteractionsLikeEl.addEventListener("click", async (e) => {
		e.preventDefault();
		e.stopPropagation();

		const wasLiked = POSTInteractionsLikeEl.dataset.liked === "true";
		const newIsLiked = !wasLiked;
		POSTInteractionsLikeEl.dataset.liked = newIsLiked;

		const svg = POSTInteractionsLikeEl.querySelector("svg path");
		const likeCountSpan = POSTInteractionsLikeEl.querySelector(".like-count");
		const currentCount = parseInt(
			POSTInteractionsLikeEl.dataset.likeCount || "0",
			10,
		);

		POST.liked_by_user = newIsLiked;
		POST.like_count = newIsLiked
			? currentCount + 1
			: Math.max(0, currentCount - 1);

		if (newIsLiked) {
			svg.setAttribute("fill", "#F91980");
			svg.setAttribute("stroke", "#F91980");
			POSTInteractionsLikeEl.dataset.likeCount = currentCount + 1;
			likeCountSpan.textContent =
				currentCount + 1 === 0 ? "" : formatNumber(currentCount + 1);

			POSTInteractionsLikeEl.querySelector("svg").classList.add("like-bump");

			setTimeout(() => {
				POSTInteractionsLikeEl
					.querySelector("svg")
					.classList.remove("like-bump");
			}, 500);
		} else {
			svg.setAttribute("fill", "none");
			svg.setAttribute("stroke", "currentColor");
			POSTInteractionsLikeEl.dataset.likeCount = Math.max(0, currentCount - 1);
			likeCountSpan.textContent =
				Math.max(0, currentCount - 1) === 0
					? ""
					: formatNumber(Math.max(0, currentCount - 1));
		}

		updatePOSTState(POST.id, {
			liked_by_user: newIsLiked,
			like_count: POST.like_count,
		});

		const result = await query(`/POSTS/${POST.id}/like`, {
			method: "POST",
		});

		if (!result.success) {
			if (result.error === "You cannot interact with this user") {
				POSTInteractionsLikeEl.dataset.liked = wasLiked;
				POSTInteractionsLikeEl.dataset.likeCount = currentCount;

				if (wasLiked) {
					svg.setAttribute("fill", "#F91980");
					svg.setAttribute("stroke", "#F91980");
				} else {
					svg.setAttribute("fill", "none");
					svg.setAttribute("stroke", "currentColor");
				}
				likeCountSpan.textContent =
					currentCount === 0 ? "" : formatNumber(currentCount);

				createBlockedModal();
			} else {
				toastQueue.add(`<h1>${result.error || "Failed to like POST"}</h1>`);
			}
		}
	});

	const POSTInteractionsReplyEl = document.createElement("button");
	POSTInteractionsReplyEl.className = "engagement";
	POSTInteractionsReplyEl.style.setProperty("--color", "17, 133, 254");
	POSTInteractionsReplyEl.innerHTML = `<svg
          width="19"
          height="19"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M18.7502 11V7.50097C18.7502 4.73917 16.5131 2.50033 13.7513 2.50042L6.25021 2.50044C3.48848 2.5004 1.25017 4.73875 1.2502 7.50048L1.25021 10.9971C1.2502 13.749 3.47395 15.9836 6.22586 15.9971L6.82888 16V19.0182L12.1067 16H13.7502C16.5116 16 18.7502 13.7614 18.7502 11Z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg> ${POST.reply_count ? formatNumber(POST.reply_count) : ""}`;

	POSTInteractionsReplyEl.addEventListener("click", async (e) => {
		if (!clickToOpen) return;

		e.stopPropagation();
		e.preventDefault();

		await openPOST(POST);

		requestAnimationFrame(() => {
			if (document.querySelector(".POSTPage #POST-textarea")) {
				document.querySelector(".POSTPage #POST-textarea").focus();
			}
		});
	});

	const POSTInteractionsrePOSTEl = document.createElement("button");
	POSTInteractionsrePOSTEl.className = "engagement";
	POSTInteractionsrePOSTEl.dataset.rePOSTed = POST.rePOSTed_by_user;
	POSTInteractionsrePOSTEl.dataset.rePOSTCount = POST.rePOST_count || 0;
	POSTInteractionsrePOSTEl.style.setProperty("--color", "0, 186, 124");

	const rePOSTColor = POST.rePOSTed_by_user ? "#00BA7C" : "currentColor";

	POSTInteractionsrePOSTEl.innerHTML = `
            <svg
              width="19"
              height="19"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2.53001 7.81595C3.49179 4.73911 6.43281 2.5 9.91173 2.5C13.1684 2.5 15.9537 4.46214 17.0852 7.23684L17.6179 8.67647M17.6179 8.67647L18.5002 4.26471M17.6179 8.67647L13.6473 6.91176M17.4995 12.1841C16.5378 15.2609 13.5967 17.5 10.1178 17.5C6.86118 17.5 4.07589 15.5379 2.94432 12.7632L2.41165 11.3235M2.41165 11.3235L1.5293 15.7353M2.41165 11.3235L6.38224 13.0882"
                stroke="${rePOSTColor}"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg> <span class="rePOST-count">${
							POST.rePOST_count ? formatNumber(POST.rePOST_count) : ""
						}</span>`;

	POSTInteractionsrePOSTEl.addEventListener("click", async (e) => {
		e.preventDefault();
		e.stopPropagation();

		const menuItems = [
			{
				id: "rePOST-option",
				icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.53001 7.81595C3.49179 4.73911 6.43281 2.5 9.91173 2.5C13.1684 2.5 15.9537 4.46214 17.0852 7.23684L17.6179 8.67647M17.6179 8.67647L18.5002 4.26471M17.6179 8.67647L13.6473 6.91176M17.4995 12.1841C16.5378 15.2609 13.5967 17.5 10.1178 17.5C6.86118 17.5 4.07589 15.5379 2.94432 12.7632L2.41165 11.3235M2.41165 11.3235L1.5293 15.7353M2.41165 11.3235L6.38224 13.0882" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
				title: "rePOST",
				onClick: async () => {
					try {
						const svgPaths =
							POSTInteractionsrePOSTEl.querySelectorAll("svg path");
						const rePOSTCountSpan =
							POSTInteractionsrePOSTEl.querySelector(".rePOST-count");
						const currentCount = parseInt(
							POSTInteractionsrePOSTEl.dataset.rePOSTCount || "0",
							10,
						);

						const result = await query(`/POSTS/${POST.id}/rePOST`, {
							method: "POST",
						});

						if (result.success) {
							const newIsrePOSTed = result.rePOSTed;
							POST.rePOSTed_by_user = newIsrePOSTed;
							POST.rePOST_count = newIsrePOSTed
								? POST.rePOST_count + 1
								: POST.rePOST_count - 1;
							POSTInteractionsrePOSTEl.dataset.rePOSTed = newIsrePOSTed;

							if (newIsrePOSTed) {
								svgPaths.forEach((path) => {
									path.setAttribute("stroke", "#00BA7C");
								});
								POSTInteractionsrePOSTEl.dataset.rePOSTCount =
									currentCount + 1;
								rePOSTCountSpan.textContent =
									currentCount + 1 === 0 ? "" : formatNumber(currentCount + 1);
							} else {
								svgPaths.forEach((path) => {
									path.setAttribute("stroke", "currentColor");
								});
								const newCount = Math.max(0, currentCount - 1);
								POSTInteractionsrePOSTEl.dataset.rePOSTCount = newCount;
								rePOSTCountSpan.textContent =
									newCount === 0 ? "" : formatNumber(newCount);
							}

							updatePOSTState(POST.id, {
								rePOSTed_by_user: newIsrePOSTed,
								rePOST_count: POST.rePOST_count,
							});
						} else {
							if (result.error === "You cannot interact with this user") {
								createBlockedModal();
							} else {
								toastQueue.add(
									`<h1>${result.error || "Failed to rePOST"}</h1>`,
								);
							}
						}
					} catch (error) {
						console.error("Error rePOSTing:", error);
						toastQueue.add(`<h1>Network error. Please try again.</h1>`);
					}
				},
			},
			{
				id: "quote-option",
				icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>
          <path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>
        </svg>`,
				title: "Quote",
				onClick: async () => {
					const { createComposer } = await import("./composer.js");
					let quoteModal = null;

					const composer = await createComposer({
						placeholder: "Add your thoughts about this POST...",
						quotePOST: POST,
						autofocus: true,
						callback: async (newPOST) => {
							addPOSTToTimeline(newPOST, true).classList.add("created");
							setTimeout(() => {
								if (quoteModal?.close) quoteModal.close();
							}, 10);
						},
					});

					quoteModal = createModal({
						content: composer,
					});

					quoteModal.modal.querySelector("textarea")?.focus();
				},
			},
		];

		if (POST.quote_count && POST.quote_count > 0) {
			menuItems.push({
				id: "view-quotes-option",
				icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>`,
				title: "View quotes",
				onClick: async () => {
					await showInteractionsModal(POST.id, "quotes");
				},
			});
		}

		createPopup({
			triggerElement: POSTInteractionsrePOSTEl,
			items: menuItems,
		});
	});

	const POSTInteractionsOptionsEl = document.createElement("button");
	POSTInteractionsOptionsEl.className = "engagement";
	POSTInteractionsOptionsEl.style.setProperty("--color", "17, 133, 254");

	POSTInteractionsOptionsEl.innerHTML = `<svg width="19" height="19" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="icon"><path d="M15.498 8.50159C16.3254 8.50159 16.9959 9.17228 16.9961 9.99963C16.9961 10.8271 16.3256 11.4987 15.498 11.4987C14.6705 11.4987 14 10.8271 14 9.99963C14.0002 9.17228 14.6706 8.50159 15.498 8.50159Z"></path><path d="M4.49805 8.50159C5.32544 8.50159 5.99689 9.17228 5.99707 9.99963C5.99707 10.8271 5.32555 11.4987 4.49805 11.4987C3.67069 11.4985 3 10.827 3 9.99963C3.00018 9.17239 3.6708 8.50176 4.49805 8.50159Z"></path><path d="M10.0003 8.50159C10.8276 8.50176 11.4982 9.17239 11.4984 9.99963C11.4984 10.827 10.8277 11.4985 10.0003 11.4987C9.17283 11.4987 8.50131 10.8271 8.50131 9.99963C8.50149 9.17228 9.17294 8.50159 10.0003 8.50159Z"></path></svg>`;

	POSTInteractionsOptionsEl.addEventListener("click", async (e) => {
		e.preventDefault();
		e.stopPropagation();

		const defaultItems = [
			{
				id: "bookmark",
				icon: `
        <svg
          width="19"
          height="19"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5.625 3.125H14.375C14.9963 3.125 15.5 3.62868 15.5 4.25V16.5073C15.5 16.959 15.0134 17.2422 14.6301 17.011L10 14.2222L5.36986 17.011C4.98664 17.2422 4.5 16.959 4.5 16.5073V4.25C4.5 3.62868 5.00368 3.125 5.625 3.125Z"
            stroke="${POST.bookmarked_by_user ? "#FFA900" : "currentColor"}"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="${POST.bookmarked_by_user ? "#FFA900" : "none"}"
          />
        </svg>`,
				title: `${POST.bookmarked_by_user ? "Un-b" : "B"}ookmark ${
					POST.bookmark_count ? `(${POST.bookmark_count || "0"})` : ""
				}`,
				onClick: async () => {
					e.preventDefault();
					e.stopPropagation();

					const isBookmarked = POST.bookmarked_by_user;

					const result = await query(
						isBookmarked ? "/bookmarks/remove" : "/bookmarks/add",
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({ postId: POST.id }),
						},
					);

					if (result.success) {
						POST.bookmarked_by_user = result.bookmarked;
					} else {
						toastQueue.add(
							`<h1>${result.error || "Failed to bookmark POST"}</h1>`,
						);
					}
				},
			},

			{
				id: "share",
				icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.2171 2.2793L10.2171 12.9745M10.2171 2.2793L13.333 4.99984M10.2171 2.2793L7.08301 4.99984M2.49967 10.9925L2.49967 14.1592C2.49967 16.011 4.00084 17.5121 5.85261 17.5121L14.9801 17.5121C16.8318 17.5121 18.333 16.011 18.333 14.1592L18.333 10.9925" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
				title: "Share",
				onClick: async () => {
					await new Promise((resolve) => setTimeout(resolve, 20));
					createPopup({
						triggerElement: POSTInteractionsOptionsEl,
						items: [
							{
								title: "Share",
								icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.2171 2.2793L10.2171 12.9745M10.2171 2.2793L13.333 4.99984M10.2171 2.2793L7.08301 4.99984M2.49967 10.9925L2.49967 14.1592C2.49967 16.011 4.00084 17.5121 5.85261 17.5121L14.9801 17.5121C16.8318 17.5121 18.333 16.011 18.333 14.1592L18.333 10.9925" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
								onClick: async () => {
									const POSTUrl = `${window.location.origin}/POST/${POST.id}?ref=share`;
									const shareData = {
										title: `${POST.author.name || POST.author.username} on Xeetapus`,
										text: POST.content,
										url: POSTUrl,
									};

									try {
										if (
											navigator.share &&
											navigator.canShare &&
											navigator.canShare(shareData)
										) {
											await navigator.share(shareData);
										} else {
											await navigator.clipboard.writeText(POSTUrl);
											toastQueue.add(`<h1>Link copied to clipboard!</h1>`);
										}
									} catch {
										toastQueue.add(`<h1>Unable to share POST</h1>`);
									}
								},
							},
							{
								title: "Share image",
								icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`,
								onClick: async () => {
									const POSTElClone = document.createElement("div");
									POSTElClone.innerHTML = POSTEl.outerHTML;

									POSTElClone
										.querySelectorAll(".POST-actions")
										.forEach((el) => {
											el.remove();
										});
									POSTElClone
										.querySelectorAll(".POST-menu-btn")
										.forEach((el) => {
											el.remove();
										});
									POSTElClone
										.querySelectorAll(".spoiler-overlay")
										.forEach((el) => {
											el.remove();
										});

									const computedPrimary = getComputedStyle(
										document.documentElement,
									)
										.getPropertyValue("--primary")
										.trim();
									const computedPrimaryFg =
										getComputedStyle(document.documentElement)
											.getPropertyValue("--primary-fg")
											.trim() || "#ffffff";
									const computedBgPrimary =
										getComputedStyle(document.documentElement)
											.getPropertyValue("--bg-primary")
											.trim() || "#ffffff";
									const computedTextPrimary =
										getComputedStyle(document.documentElement)
											.getPropertyValue("--text-primary")
											.trim() || "#0f1419";

									POSTElClone
										.querySelectorAll(".verification-badge svg path")
										.forEach((path) => {
											const fill = path.getAttribute("fill");
											const stroke = path.getAttribute("stroke");
											if (fill === "var(--primary)")
												path.setAttribute("fill", computedPrimary);
											if (stroke === "var(--primary-fg)")
												path.setAttribute("stroke", computedPrimaryFg);
										});

									const wrapper = document.createElement("div");
									wrapper.className = "POST-share-wrapper";
									wrapper.style.backgroundColor = computedPrimary;

									const attribution = document.createElement("div");
									attribution.className = "POST-share-attribution";
									attribution.innerHTML = `Xeetapus`;
									attribution.style.color = computedPrimaryFg;
									wrapper.appendChild(attribution);

									const POSTContainer = document.createElement("div");
									POSTContainer.className = "POST-share-container";
									POSTContainer.style.backgroundColor = computedBgPrimary;
									POSTContainer.style.color = computedTextPrimary;

									POSTContainer.appendChild(POSTElClone);
									wrapper.appendChild(POSTContainer);

									document.body.appendChild(wrapper);

									const allImages = wrapper.querySelectorAll("img");
									const imagePromises = Array.from(allImages).map((img) => {
										return new Promise((resolve) => {
											if (img.complete && img.naturalHeight !== 0) {
												resolve();
											} else {
												img.onload = resolve;
												img.onerror = resolve;
											}
										});
									});

									await Promise.all(imagePromises);

									const runCapture = () => {
										window
											.html2canvas(wrapper, {
												backgroundColor: computedPrimary,
												scale: 3,
												width: wrapper.offsetWidth,
												useCORS: true,
												allowTaint: true,
												logging: false,
											})
											.then((canvas) => {
												canvas.toBlob((blob) => {
													const url = URL.createObjectURL(blob);
													const a = document.createElement("a");
													a.href = url;
													a.download = `Xeetapus_${POST.id}.png`;
													a.click();
													wrapper.remove();
												});
											});
									};

									if (window.html2canvas) {
										runCapture();
									} else {
										const script = document.createElement("script");
										script.src = "/public/shared/assets/js/html2canvas.min.js";
										script.onload = runCapture;
										document.head.appendChild(script);
									}
								},
							},
							{
								id: "copy-link",
								icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
								title: "Copy link",
								onClick: () => {
									const POSTUrl = `${window.location.origin}/POST/${POST.id}`;

									navigator.clipboard.writeText(POSTUrl);
								},
							},

							{
								icon: `<svg fill="none" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M14.242 3.03a1 1 0 0 1 .728 1.213l-4 16a1 1 0 1 1-1.94-.485l4-16a1 1 0 0 1 1.213-.728ZM6.707 7.293a1 1 0 0 1 0 1.414L3.414 12l3.293 3.293a1 1 0 1 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 0 1 1.414 0Zm10.586 0a1 1 0 0 1 1.414 0l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 1 1-1.414-1.414L20.586 12l-3.293-3.293a1 1 0 0 1 0-1.414Z"></path></svg>`,
								title: "Embed POST",
								onClick: () => {
									const content = document.createElement("div");
									content.innerHTML = `<p style="margin: 15px;font-size: 15px;line-height: 23px;color: var(--text-secondary);">Embed this post in your website. Simply copy the following snippet and paste it into the HTML code of your website.</p>
									<div class="embed-code">
									<div class="input">
									<svg fill="none" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M14.242 3.03a1 1 0 0 1 .728 1.213l-4 16a1 1 0 1 1-1.94-.485l4-16a1 1 0 0 1 1.213-.728ZM6.707 7.293a1 1 0 0 1 0 1.414L3.414 12l3.293 3.293a1 1 0 1 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 0 1 1.414 0Zm10.586 0a1 1 0 0 1 1.414 0l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 1 1-1.414-1.414L20.586 12l-3.293-3.293a1 1 0 0 1 0-1.414Z"></path></svg>
									<input value="" autocomplete="off" autocorrect="off" readonly rows="1" spellcheck="false">
									</div>
									<button>Copy code</button>
									</div>`;

									content.querySelector("input").value =
										`<script src="${window.location.origin}/embed/${POST.id}.js" async charset="utf-8"></script>`;

									content
										.querySelector("button")
										.addEventListener("click", () => {
											navigator.clipboard.writeText(
												content.querySelector("input").value,
											);

											content.querySelector("button").style.minWidth =
												`${content.querySelector("button").offsetWidth}px`;
											content.querySelector("button").disabled = true;
											content.querySelector("button").innerText = "Copied!";

											setTimeout(() => {
												content.querySelector("button").disabled = false;
												content.querySelector("button").innerText = "Copy code";
											}, 1500);
										});

									createModal({
										title: "Embed POST",
										content,
									});
								},
							},
						],
					});
				},
			},

			{
				id: "see-interactions",
				icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
				title: "See interactions",
				onClick: async () => {
					await showInteractionsModal(POST.id);
				},
			},
		];

		const userItems = [
			{
				id: POST.pinned ? "unpin-option" : "pin-option",
				icon: POST.pinned
					? `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 17v5"></path>
                  <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 7.89 17H16.1a2 2 0 0 0 1.78-2.55l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 0-1-1H10a1 1 0 0 0-1 1z"></path>
                </svg>`
					: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 17v5"></path>
                  <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 7.89 17H16.1a2 2 0 0 0 1.78-2.55l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 0-1-1H10a1 1 0 0 0-1 1z"></path>
                </svg>`,
				title: POST.pinned ? "Unpin from profile" : "Pin to profile",
				onClick: async () => {
					try {
						const method = POST.pinned ? "DELETE" : "POST";
						const result = await query(`/profile/pin/${POST.id}`, {
							method,
						});

						if (result.success) {
							POST.pinned = !POST.pinned;
							toastQueue.add(
								`<h1>POST ${
									POST.pinned ? "pinned" : "unpinned"
								} successfully</h1>`,
							);

							if (POST.pinned) {
								const pinnedIndicatorEl = document.createElement("div");
								pinnedIndicatorEl.className = "pinned-indicator";
								pinnedIndicatorEl.innerHTML = `
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 17v5"></path>
                        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 7.89 17H16.1a2 2 0 0 0 1.78-2.55l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 0-1-1H10a1 1 0 0 0-1 1z"></path>
                      </svg>
                      <span>Pinned</span>
                    `;
								const existingIndicator =
									POSTEl.querySelector(".pinned-indicator");
								if (!existingIndicator) {
									POSTEl.insertBefore(pinnedIndicatorEl, POSTEl.firstChild);
								}
							} else {
								const pinnedIndicator =
									POSTEl.querySelector(".pinned-indicator");
								if (pinnedIndicator) {
									pinnedIndicator.remove();
								}
							}
						} else {
							toastQueue.add(
								`<h1>${result.error || "Failed to update pin status"}</h1>`,
							);
						}
					} catch (error) {
						console.error("Error updating pin status:", error);
						toastQueue.add(`<h1>Network error. Please try again.</h1>`);
					}
				},
			},
			{
				id: "change-reply-restriction",
				icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>`,
				title: "Change who can reply",
				onClick: async () => {
					const currentRestriction = POST.reply_restriction || "everyone";

					const restrictionMenu = document.createElement("div");
					restrictionMenu.className = "reply-restriction-modal";
					restrictionMenu.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--bg-primary);
            border: 1px solid var(--border-primary);
            border-radius: 12px;
            padding: 20px;
            z-index: 10000;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 90%;
          `;

					const title = document.createElement("h2");
					title.textContent = "Who can reply?";
					title.style.cssText = "margin: 0 0 16px; font-size: 18px;";
					restrictionMenu.appendChild(title);

					const modalOverlay = document.createElement("div");
					modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
          `;

					const closeModal = () => {
						if (modalOverlay.parentNode === document.body) {
							document.body.removeChild(modalOverlay);
						}
						if (restrictionMenu.parentNode === document.body) {
							document.body.removeChild(restrictionMenu);
						}
					};

					modalOverlay.addEventListener("click", closeModal);

					const options = [
						{ value: "everyone", label: "Everyone" },
						{ value: "following", label: "People you follow" },
						{ value: "followers", label: "Your followers" },
						{ value: "verified", label: "Verified accounts" },
					];

					options.forEach((option) => {
						const optionBtn = document.createElement("button");
						optionBtn.type = "button";
						optionBtn.style.cssText = `
              display: block;
              width: 100%;
              padding: 12px;
              margin-bottom: 8px;
              text-align: left;
              border: 1px solid ${
								option.value === currentRestriction
									? "var(--primary)"
									: "var(--border-primary)"
							};
              background: ${
								option.value === currentRestriction
									? "rgba(var(--primary-rgb), 0.1)"
									: "transparent"
							};
              border-radius: 8px;
              cursor: pointer;
              color: var(--text-primary);
              font-size: 14px;
              transition: all 0.2s ease;
            `;

						if (option.value === currentRestriction) {
							optionBtn.innerHTML = `<strong>✓ ${option.label}</strong>`;
						} else {
							optionBtn.textContent = option.label;
						}

						optionBtn.addEventListener("click", async () => {
							try {
								const result = await query(
									`/POSTS/${POST.id}/reply-restriction`,
									{
										method: "PATCH",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ reply_restriction: option.value }),
									},
								);

								if (result.success) {
									POST.reply_restriction = option.value;
									closeModal();
									toastQueue.add(`<h1>Reply restriction updated</h1>`);
								} else {
									toastQueue.add(
										`<h1>${
											result.error || "Failed to update reply restriction"
										}</h1>`,
									);
								}
							} catch (err) {
								console.error("Error updating reply restriction:", err);
								toastQueue.add(`<h1>Network error. Please try again.</h1>`);
							}
						});

						restrictionMenu.appendChild(optionBtn);
					});

					const cancelBtn = document.createElement("button");
					cancelBtn.type = "button";
					cancelBtn.textContent = "Cancel";
					cancelBtn.style.cssText = `
            display: block;
            width: 100%;
            padding: 12px;
            margin-top: 12px;
            border: 1px solid var(--border-primary);
            background: transparent;
            border-radius: 8px;
            cursor: pointer;
            color: var(--text-primary);
            font-size: 14px;
          `;
					cancelBtn.addEventListener("click", closeModal);
					restrictionMenu.appendChild(cancelBtn);

					document.body.appendChild(modalOverlay);
					document.body.appendChild(restrictionMenu);
				},
			},
			{
				id: "edit-option",
				icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>`,
				title: "Edit POST",
				onClick: async () => {
					if (POST.poll_id) {
						toastQueue.add(`<h1>Cannot edit POSTS with polls</h1>`);
						return;
					}

					const currentUser = await getUser();
					let maxPOSTLength = currentUser.character_limit || 400;
					if (!currentUser.character_limit) {
						maxPOSTLength = currentUser.gray
							? 37500
							: currentUser.gold
								? 16500
								: currentUser.verified
									? 5500
									: 400;
					}

					const editForm = document.createElement("form");
					editForm.className = "edit-POST-form";

					const textarea = document.createElement("textarea");
					textarea.className = "edit-POST-textarea";
					textarea.value = POST.content || "";
					textarea.placeholder = "What's happening?";

					const charCounter = document.createElement("div");
					charCounter.className = "edit-POST-char-counter";

					const updateCharCounter = () => {
						const remaining = maxPOSTLength - textarea.value.length;
						charCounter.textContent = `${remaining}`;
						charCounter.classList.toggle(
							"warning",
							remaining < 50 && remaining >= 0,
						);
						charCounter.classList.toggle("error", remaining < 0);
					};

					textarea.addEventListener("input", updateCharCounter);
					updateCharCounter();

					const buttonContainer = document.createElement("div");
					buttonContainer.className = "edit-POST-buttons";

					const cancelButton = document.createElement("button");
					cancelButton.type = "button";
					cancelButton.className = "edit-POST-cancel";
					cancelButton.textContent = "Cancel";

					const saveButton = document.createElement("button");
					saveButton.type = "submit";
					saveButton.className = "edit-POST-save";
					saveButton.textContent = "Save";

					buttonContainer.appendChild(cancelButton);
					buttonContainer.appendChild(saveButton);

					editForm.appendChild(textarea);
					editForm.appendChild(charCounter);
					editForm.appendChild(buttonContainer);

					const { createModal } = await import("../../shared/ui-utils.js");
					const editModal = createModal({
						title: "Edit POST",
						content: editForm,
						className: "edit-POST-modal",
					});

					cancelButton.addEventListener("click", () => editModal.close());

					editForm.addEventListener("submit", async (e) => {
						e.preventDefault();

						const newContent = textarea.value.trim();
						if (!newContent) {
							toastQueue.add(`<h1>POST content cannot be empty</h1>`);
							return;
						}

						if (newContent.length > maxPOSTLength) {
							toastQueue.add(`<h1>POST content is too long</h1>`);
							return;
						}

						saveButton.disabled = true;
						saveButton.textContent = "Saving...";

						const result = await query(`/POSTS/${POST.id}`, {
							method: "PUT",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ content: newContent }),
						});

						if (result.success) {
							POST.content = newContent;
							POST.edited_at = result.POST.edited_at;

							const contentEl = POSTEl.querySelector(".POST-content");
							if (contentEl) {
								contentEl.innerHTML = linkifyText(newContent);
								replaceEmojiShortcodesInElement(contentEl);

								const editedIndicator = document.createElement("span");
								editedIndicator.className = "POST-edited-indicator";
								editedIndicator.textContent = " (edited)";
								const usernameEl = POSTEl.querySelector(
									".POST-header-username",
								);
								if (
									usernameEl &&
									!usernameEl.querySelector(".POST-edited-indicator")
								) {
									usernameEl.appendChild(editedIndicator);
								}
							}

							editModal.close();
							toastQueue.add(`<h1>POST updated successfully</h1>`);
						} else {
							toastQueue.add(
								`<h1>${result.error || "Failed to update POST"}</h1>`,
							);
							saveButton.disabled = false;
							saveButton.textContent = "Save";
						}
					});

					textarea.focus();
				},
			},
			{
				id: "change-outline",
				icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 2a7 7 0 0 1 7 7"></path>
              <path d="M12 22a7 7 0 0 0 7-7"></path>
            </svg>`,
				title: "Change POST outline",
				requiresGray: true,
				onClick: async () => {
					const { createModal } = await import("../../shared/ui-utils.js");

					const formContainer = document.createElement("div");
					formContainer.style.cssText =
						"display: flex; flex-direction: column; gap: 12px;";

					const label = document.createElement("label");
					label.textContent = "Outline (CSS color or gradient)";
					label.style.cssText =
						"font-size: 14px; color: var(--text-secondary);";

					const input = document.createElement("input");
					input.type = "text";
					input.placeholder = "e.g. red, #ff0000, linear-gradient(...)";
					input.value = POST.outline || "";
					input.style.cssText =
						"padding: 10px; border: 1px solid var(--border-primary); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;";

					const hint = document.createElement("p");
					hint.textContent =
						"Leave empty to remove outline. Supports solid colors and gradients.";
					hint.style.cssText =
						"font-size: 12px; color: var(--text-tertiary); margin: 0;";

					const buttonContainer = document.createElement("div");
					buttonContainer.style.cssText =
						"display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;";

					const cancelBtn = document.createElement("button");
					cancelBtn.type = "button";
					cancelBtn.textContent = "Cancel";
					cancelBtn.style.cssText =
						"padding: 8px 16px; border: 1px solid var(--border-primary); background: transparent; border-radius: 8px; cursor: pointer; color: var(--text-primary);";

					const saveBtn = document.createElement("button");
					saveBtn.type = "button";
					saveBtn.textContent = "Save";
					saveBtn.style.cssText =
						"padding: 8px 16px; border: none; background: var(--primary); border-radius: 8px; cursor: pointer; color: white;";

					buttonContainer.appendChild(cancelBtn);
					buttonContainer.appendChild(saveBtn);

					formContainer.appendChild(label);
					formContainer.appendChild(input);
					formContainer.appendChild(hint);
					formContainer.appendChild(buttonContainer);

					const modal = createModal({
						title: "Change POST Outline",
						content: formContainer,
						className: "change-outline-modal",
					});

					cancelBtn.addEventListener("click", () => modal.close());

					saveBtn.addEventListener("click", async () => {
						const outline = input.value.trim() || null;
						saveBtn.disabled = true;
						saveBtn.textContent = "Saving...";

						const result = await query(`/POSTS/${POST.id}/outline`, {
							method: "PATCH",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ outline }),
						});

						if (result.success) {
							POST.outline = outline;
							if (outline) {
								POSTEl.style.border = `2px solid transparent`;
								POSTEl.style.borderImage = outline.includes("gradient")
									? `${outline} 1`
									: `linear-gradient(${outline}, ${outline}) 1`;
								POSTEl.style.borderRadius = "16px";
							} else {
								POSTEl.style.border = "";
								POSTEl.style.borderImage = "";
							}
							modal.close();
							toastQueue.add(`<h1>POST outline updated</h1>`);
						} else {
							toastQueue.add(
								`<h1>${result.error || "Failed to update outline"}</h1>`,
							);
							saveBtn.disabled = false;
							saveBtn.textContent = "Save";
						}
					});
				},
			},
			{
				id: "delete-option",
				icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3,6 5,6 21,6"></polyline>
              <path d="m19,6v14a2,2 0,0 1,-2,2H7a2,2 0,0 1,-2,-2V6m3,0V4a2,2 0,0 1,2,-2h4a2,2 0,0 1,2,2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>`,
				title: "Delete POST",
				onClick: async () => {
					createConfirmModal({
						title: "Delete POST",
						message:
							"Are you sure you want to delete this POST? This action cannot be undone.",
						confirmText: "Delete",
						cancelText: "Cancel",
						danger: true,
						onConfirm: async () => {
							POSTEl.remove();

							const result = await query(`/POSTS/${POST.id}`, {
								method: "DELETE",
							});

							if (!result.success) {
								toastQueue.add(
									`<h1>${result.error || "Failed to delete POST"}</h1>`,
								);
							}
						},
					});
				},
			},
		];

		getUser().then(async (currentUser) => {
			const isOwnPOST =
				currentUser && String(currentUser.id) === String(POST.author?.id);

			let filteredUserItems = [];
			if (isOwnPOST) {
				filteredUserItems = userItems.filter((item) => {
					if (item.requiresGray && !currentUser.gray) return false;
					return true;
				});
			}

			const items = isOwnPOST
				? [...defaultItems, ...filteredUserItems]
				: [...defaultItems];

			if (currentUser && POST.author && !isOwnPOST) {
				const checkResp = await query(`/blocking/check/${POST.author.id}`);
				const isBlocked = checkResp?.blocked || false;

				const blockItem = {
					id: isBlocked ? "unblock-user" : "block-user",
					icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
					title: isBlocked
						? `Unblock @${POST.author.username}`
						: `Block @${POST.author.username}`,
					onClick: async () => {
						try {
							if (
								!confirm(
									`${isBlocked ? "Unblock" : "Block"} @${
										POST.author.username
									}?`,
								)
							)
								return;
							const endpoint = isBlocked
								? "/blocking/unblock"
								: "/blocking/block";
							const result = await query(endpoint, {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									userId: POST.author.id,
									sourcePOSTId: isBlocked ? undefined : POST.id,
								}),
							});

							if (result.success) {
								toastQueue.add(
									`<h1>${isBlocked ? "User unblocked" : "User blocked"}</h1>`,
								);
							} else {
								toastQueue.add(
									`<h1>${result.error || "Failed to update block status"}</h1>`,
								);
							}
						} catch (err) {
							console.error("Block/unblock error:", err);
							toastQueue.add(`<h1>Network error. Please try again.</h1>`);
						}
					},
				};

				items.push(blockItem);
			}

			const reportItem = {
				id: "report-POST",
				icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flag-icon lucide-flag"><path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/></svg>`,
				title: "Report POST",
				onClick: async () => {
					const { showReportModal } = await import(
						"../../shared/report-modal.js"
					);
					showReportModal({
						type: "post",
						id: POST.id,
						username: POST.author.username,
						content: POST.content,
					});
				},
			};

			items.push(reportItem);

			createPopup({
				triggerElement: POSTInteractionsOptionsEl,
				items,
			});
		});
	});

	const replyRestriction = POST.reply_restriction || "everyone";
	let restrictionEl = null;

	const createRestrictionElement = () => {
		if (replyRestriction !== "everyone") {
			import("./auth.js").then(async ({ authToken }) => {
				if (authToken) {
					const getUser = (await import("./auth.js")).default;
					const currentUser = await getUser();

					if (currentUser && currentUser.id === POST.author.id) {
						if (!restrictionEl) {
							restrictionEl = document.createElement("div");
							restrictionEl.className = "reply-restriction-info";
							const existingRestriction = POSTEl.querySelector(
								".reply-restriction-info",
							);
							if (!existingRestriction && POSTInteractionsEl.parentNode) {
								POSTEl.insertBefore(restrictionEl, POSTInteractionsEl);
							}
						}
						restrictionEl.innerHTML = `<svg width="19" height="19" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18.7502 11V7.50097C18.7502 4.73917 16.5131 2.50033 13.7513 2.50042L6.25021 2.50044C3.48848 2.5004 1.25017 4.73875 1.2502 7.50048L1.25021 10.9971C1.2502 13.749 3.47395 15.9836 6.22586 15.9971L6.82888 16V19.0182L12.1067 16H13.7502C16.5116 16 18.7502 13.7614 18.7502 11Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg> You can reply to your own POST`;
						return;
					}

					checkReplyPermissions(POST, replyRestriction).then(
						({ canReply: allowed, restrictionText }) => {
							if (!allowed) {
								POSTInteractionsReplyEl.disabled = true;
								POSTInteractionsReplyEl.classList.add("reply-restricted");
								POSTInteractionsReplyEl.title =
									"You cannot reply to this POST";
							}

							if (restrictionText) {
								if (!restrictionEl) {
									restrictionEl = document.createElement("div");
									restrictionEl.className = "reply-restriction-info";
									const existingRestriction = POSTEl.querySelector(
										".reply-restriction-info",
									);
									if (!existingRestriction && POSTInteractionsEl.parentNode) {
										POSTEl.insertBefore(restrictionEl, POSTInteractionsEl);
									}
								}
								restrictionEl.innerHTML = `<svg width="19" height="19" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18.7502 11V7.50097C18.7502 4.73917 16.5131 2.50033 13.7513 2.50042L6.25021 2.50044C3.48848 2.5004 1.25017 4.73875 1.2502 7.50048L1.25021 10.9971C1.2502 13.749 3.47395 15.9836 6.22586 15.9971L6.82888 16V19.0182L12.1067 16H13.7502C16.5116 16 18.7502 13.7614 18.7502 11Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg> ${restrictionText}`;
							}
						},
					);
				}
			});
		}
	};

	POSTInteractionsEl.appendChild(POSTInteractionsLikeEl);
	POSTInteractionsEl.appendChild(POSTInteractionsrePOSTEl);
	POSTInteractionsEl.appendChild(POSTInteractionsReplyEl);

	const POSTInteractionsRightEl = document.createElement("div");
	POSTInteractionsRightEl.className = "POST-interactions-right";

	const POSTInteractionsViewsEl = document.createElement("span");
	POSTInteractionsViewsEl.className = "engagement views-count";
	POSTInteractionsViewsEl.innerHTML = `
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 5C5 5 2 10 2 10s3 5 8 5 8-5 8-5-3-5-8-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
    </svg>
    <span>${POST.view_count > 0 ? formatNumber(POST.view_count) : "1"}</span>`;
	POSTInteractionsViewsEl.style.setProperty("--color", "119, 119, 119");
	POSTInteractionsViewsEl.title = `${POST.view_count || 0} views`;

	const reactionCountSpan = document.createElement("span");
	reactionCountSpan.className = "reaction-count";

	const topReactionsSpan = document.createElement("span");
	topReactionsSpan.className = "top-reactions";

	const POSTInteractionsReactionEl = document.createElement("button");
	POSTInteractionsReactionEl.className = "engagement reaction-btn";
	POSTInteractionsReactionEl.dataset.bookmarked = "false";
	POSTInteractionsReactionEl.title = "React";
	POSTInteractionsReactionEl.style.setProperty("--color", "255, 180, 0");
	POSTInteractionsReactionEl.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-smile-plus-icon lucide-smile-plus"><path d="M22 11v1a10 10 0 1 1-9-10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/><path d="M16 5h6"/><path d="M19 2v6"/></svg>`;

	const updateReactionDisplay = () => {
		const topReactions = POST.top_reactions || [];

		if (topReactions.length > 0) {
			topReactionsSpan.innerHTML = topReactions.map((r) => r.emoji).join("");
			// Replace any :shortcode: text inside the top reactions with image elements
			replaceEmojiShortcodesInElement(topReactionsSpan);
			topReactionsSpan.style.display = "inline";
		} else {
			topReactionsSpan.innerHTML = "";
			topReactionsSpan.style.display = "none";
		}

		if (POST.reaction_count > 0) {
			reactionCountSpan.textContent = String(POST.reaction_count);
			reactionCountSpan.style.display = "inline";
		} else {
			reactionCountSpan.textContent = "";
			reactionCountSpan.style.display = "none";
		}
	};

	updateReactionDisplay();

	POSTInteractionsReactionEl.addEventListener("click", async (e) => {
		e.preventDefault();
		e.stopPropagation();

		try {
			const { showEmojiPickerPopup } = await import(
				"../../shared/emoji-picker.js"
			);
			const { triggerReactionBurst } = await import(
				"../../shared/reactions.js"
			);

			const rect = POSTInteractionsReactionEl.getBoundingClientRect();
			await showEmojiPickerPopup(
				async (emoji) => {
					try {
						triggerReactionBurst(POSTInteractionsReactionEl, emoji, 6);
						console.debug("React: sending", { POSTId: POST.id, emoji });

						const result = await query(`/POSTS/${POST.id}/reaction`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ emoji }),
						});

						console.debug("React: response", result);

						if (result?.success) {
							// Only update counts if the server returned numeric totals
							if (typeof result.total_reactions === "number") {
								POST.reaction_count = result.total_reactions;
							}
							if (Array.isArray(result.top_reactions)) {
								POST.top_reactions = result.top_reactions;
							}
							updateReactionDisplay();
						} else {
							// Keep the UI stable and surface the server error
							console.warn("Reaction failed:", result);
							toastQueue.add(`<h1>${result?.error || "Failed to react"}</h1>`);
						}
					} catch (err) {
						console.error("Reaction error:", err);
						toastQueue.add(`<h1>Network error. Please try again.</h1>`);
					}
				},
				{ x: rect.left, y: rect.bottom + 8 },
			);
		} catch (err) {
			console.error("Failed to open emoji picker:", err);
		}
	});

	POSTInteractionsRightEl.appendChild(POSTInteractionsViewsEl);

	const reactionWrapper = document.createElement("div");
	reactionWrapper.className = "reaction-wrapper";

	reactionWrapper.appendChild(POSTInteractionsReactionEl);
	reactionWrapper.appendChild(topReactionsSpan);
	reactionWrapper.appendChild(reactionCountSpan);

	const showReactionsModal = async () => {
		const reactionsData = await query(`/POSTS/${POST.id}/reactions`);
		const container = document.createElement("div");
		container.className = "reactions-list";

		if (
			!reactionsData ||
			!reactionsData.reactions ||
			reactionsData.reactions.length === 0
		) {
			container.innerHTML = `<p>No reactions yet.</p>`;
		} else {
			const currentUser = await getUser();

			reactionsData.reactions.forEach((r) => {
				const item = document.createElement("div");
				item.className = "reaction-item";
				const avatarSrc =
					r.avatar || "/public/shared/assets/default-avatar.svg";
				const displayName = r.name || r.username || "Unknown";
				const usernameText = r.username || "";
				const isOwnReaction = currentUser && r.user_id === currentUser.id;

				item.innerHTML = `
          <div class="reaction-user-avatar"><img src="${avatarSrc}" alt="${displayName
						.replaceAll("<", "&lt;")
						.replaceAll(">", "&gt;")}" loading="lazy"/></div>
          <div class="reaction-content">
            <div class="reaction-emoji">${r.emoji}</div>
            <div class="reaction-user-info">
              <div class="reaction-user-name">${displayName
								.replaceAll("<", "&lt;")
								.replaceAll(">", "&gt;")}</div>
              <div class="reaction-user-username">${
								usernameText
									? `@${usernameText
											.replaceAll("<", "&lt;")
											.replaceAll(">", "&gt;")}`
									: ""
							}</div>
            </div>
          </div>
          ${
						isOwnReaction
							? `<button class="reaction-remove-btn" title="Remove reaction"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash2-icon lucide-trash-2"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`
							: ""
					}
        `;

				if (isOwnReaction) {
					const removeBtn = item.querySelector(".reaction-remove-btn");
					const emoji = r.emoji;
					removeBtn.addEventListener("click", async (e) => {
						e.stopPropagation();

						try {
							const result = await query(`/POSTS/${POST.id}/reaction`, {
								method: "POST",
								body: { emoji },
							});

							if (result.success) {
								item.style.transition = "opacity 0.2s, transform 0.2s";
								item.style.opacity = "0";
								item.style.transform = "scale(0.95)";
								setTimeout(() => {
									item.remove();
									if (
										container.querySelectorAll(".reaction-item").length === 0
									) {
										container.innerHTML = `<p>No reactions yet.</p>`;
									}
								}, 200);

								if (result.total_reactions !== undefined) {
									reactionCountSpan.textContent = result.total_reactions || "";
								}

								if (result.top_reactions) {
									topReactionsSpan.innerHTML = result.top_reactions
										.map((tr) => tr.emoji)
										.join("");
									replaceEmojiShortcodesInElement(topReactionsSpan);
								}
							}
						} catch (err) {
							console.error("Error removing reaction:", err);
						}
					});
				}

				container.appendChild(item);
			});
			replaceEmojiShortcodesInElement(container);
		}

		createModal({
			title: "Reactions",
			content: container,
			className: "reactions-modal",
		});
	};

	topReactionsSpan.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		showReactionsModal();
	});

	reactionCountSpan.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		showReactionsModal();
	});

	POSTInteractionsRightEl.appendChild(reactionWrapper);
	POSTInteractionsRightEl.appendChild(POSTInteractionsOptionsEl);

	POSTInteractionsEl.appendChild(POSTInteractionsRightEl);

	if (size !== "preview") {
		(async () => {
			try {
				const getUser = (await import("./auth.js")).default;
				const currentUser = await getUser();

				if (currentUser?.restricted) {
					const disableButton = (btn) => {
						if (btn) {
							btn.disabled = true;
							btn.setAttribute("aria-disabled", "true");
							btn.classList.add("reply-restricted");
							btn.style.opacity = "0.5";
							btn.style.cursor = "not-allowed";
						}
					};
					disableButton(POSTInteractionsLikeEl);
					disableButton(POSTInteractionsrePOSTEl);
					disableButton(POSTInteractionsReplyEl);
					disableButton(POSTInteractionsReactionEl);
					disableButton(POSTInteractionsOptionsEl);
				}
			} catch {}
		})();

		POSTEl.appendChild(POSTInteractionsEl);
		createRestrictionElement();
	}
	if (POST.top_reply && showTopReply) {
		const topReplyEl = createPOSTElement(POST.top_reply, {
			clickToOpen: true,
			showTopReply: false,
			isTopReply: true,
		});
		topReplyEl.style.marginTop = "4px";

		if (!POST.top_reply.parentsCache) {
			POST.top_reply.parentsCache = [POST, POST.top_reply];
		}

		POSTEl.appendChild(topReplyEl);

		if (POST.top_reply.author_response) {
			const authorResponseEl = createPOSTElement(
				POST.top_reply.author_response,
				{
					clickToOpen: true,
					showTopReply: false,
					isTopReply: true,
				},
			);

			if (!POST.top_reply.author_response.parentsCache) {
				POST.top_reply.author_response.parentsCache = [
					POST,
					POST.top_reply,
					POST.top_reply.author_response,
				];
			}

			POSTEl.appendChild(authorResponseEl);
		}
	}

	if (clickToOpen) {
		POSTEl.classList.add("clickable");

		POSTEl.addEventListener("click", (e) => {
			if (e.target.closest("button, a, .engagement")) {
				return;
			}
			if (size === "preview") {
				e.stopPropagation();
			}

			openPOST(POST, { threadPostsCache: POST.parentsCache });
		});
	}

	return POSTEl;
};

export const addPOSTToTimeline = (POST, prepend = false) => {
	if (!POST) {
		console.error("No POST provided to addPOSTToTimeline");
		return null;
	}

	// Handle POSTS without author property (fallback)
	if (!POST.author && POST.user) {
		POST.author = POST.user;
	}

	if (!POST.author) {
		console.error(
			"Invalid POST object provided to addPOSTToTimeline - missing author",
			POST,
		);
		return null;
	}

	const POSTEl = createPOSTElement(POST, {
		clickToOpen: true,
		showTopReply: true,
	});

	const POSTSContainer = document.querySelector(".POSTS");
	if (!POSTSContainer) {
		console.error("POSTS container not found");
		return null;
	}

	if (prepend) {
		POSTSContainer.insertBefore(POSTEl, POSTSContainer.firstChild);
	} else {
		POSTSContainer.appendChild(POSTEl);
	}

	(async () => {
		try {
			if (POST.reaction_count === undefined) {
				const resp = await query(`/POSTS/${POST.id}/reactions`);
				if (
					resp &&
					Array.isArray(resp.reactions) &&
					resp.reactions.length > 0
				) {
					POST.reaction_count = resp.reactions.length;
					const reactionWrapper = POSTEl.querySelector(".reaction-wrapper");
					const reactionCountSpan = reactionWrapper
						? reactionWrapper.querySelector(".reaction-count")
						: null;
					if (reactionWrapper && reactionCountSpan) {
						reactionCountSpan.textContent = String(POST.reaction_count);
						if (!reactionCountSpan.parentNode)
							reactionWrapper.appendChild(reactionCountSpan);
					}
				}
			}
		} catch {}
	})();

	return POSTEl;
};
