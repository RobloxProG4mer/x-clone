import { dlopen, FFIType, suffix } from "bun:ffi";
import { existsSync } from "node:fs";
import path from "node:path";

const libPath = path.join(import.meta.dir, `algorithm.${suffix}`);

let lib = null;

if (existsSync(libPath)) {
	// basic/core exports we always expect
	const coreExports = {
		calculate_score: {
			args: [
				FFIType.i64,
				FFIType.i32,
				FFIType.i32,
				FFIType.i32,
				FFIType.i32,
				FFIType.i32,
				FFIType.double,
				FFIType.i32,
				FFIType.i32,
				FFIType.double,
				FFIType.double,
				FFIType.i32,
				FFIType.i32,
				FFIType.i32,
				FFIType.i32,
				FFIType.i32,
				FFIType.i32,
				FFIType.double,
				FFIType.i32,
				FFIType.i32,
				FFIType.double,
				FFIType.double,
				FFIType.i32,
				FFIType.i32,
				FFIType.i32,
				FFIType.i32,
				FFIType.double,
				FFIType.double,
				FFIType.i32,
				FFIType.double,
				FFIType.double,
				FFIType.double,
				FFIType.i32,
			],
			returns: FFIType.double,
		},
	};

	// timeline exports are optional; try to load with them first
	const timelineExports = Object.assign({}, coreExports, {
		process_timeline: {
			args: [FFIType.cstring],
			returns: FFIType.cstring,
		},
		free_timeline_json: {
			args: [FFIType.ptr],
			returns: FFIType.void,
		},
	});

	try {
		lib = dlopen(libPath, timelineExports);
	} catch {
		// fall back to minimal/core symbols only
		try {
			lib = dlopen(libPath, coreExports);
		} catch (error) {
			console.warn("Failed to load C algorithm library");
			console.warn("Error:", error.message);
		}
	}
} else {
	console.error(
		`C algorithm library not found at ${libPath} (possibly not compiled?)`,
	);
	console.warn("-> run 'make' in src/algo/ to compile the C algorithm");
}

export const calculateScore = (
	created_at,
	like_count,
	rePOST_count,
	reply_count = 0,
	quote_count = 0,
	has_media = 0,
	hours_since_seen = -1,
	author_repeats = 0,
	content_repeats = 0,
	novelty_factor = 1,
	random_factor = Math.random(),
	is_all_seen = 0,
	position_in_feed = 0,
	user_verified = 0,
	user_gold = 0,
	follower_count = 0,
	has_community_note = 0,
	user_super_POSTer_boost = 0.0,
	blocked_by_count = 0,
	muted_by_count = 0,
	spam_score = 0.0,
	account_age_days = 0.0,
	url_count = 0,
	suspicious_url_count = 0,
	hashtag_count = 0,
	mention_count = 0,
	emoji_density = 0.0,
	author_timing_score = 0.0,
	cluster_size = 0,
	spam_keyword_score = 0.0,
	rePOST_like_ratio = 0.0,
	engagement_velocity = 0.0,
	is_video = 0,
) => {
	if (!lib) {
		return 0;
	}

	const timestamp =
		typeof created_at === "string"
			? Math.floor(new Date(created_at).getTime() / 1000)
			: created_at;

	return lib.symbols.calculate_score(
		BigInt(timestamp),
		like_count,
		rePOST_count,
		reply_count,
		quote_count,
		has_media,
		hours_since_seen,
		author_repeats,
		content_repeats,
		novelty_factor,
		random_factor,
		is_all_seen,
		position_in_feed,
		user_verified,
		user_gold,
		follower_count,
		has_community_note,
		user_super_POSTer_boost,
		blocked_by_count,
		muted_by_count,
		spam_score,
		account_age_days,
		url_count,
		suspicious_url_count,
		hashtag_count,
		mention_count,
		emoji_density,
		author_timing_score,
		cluster_size,
		spam_keyword_score,
		rePOST_like_ratio,
		engagement_velocity,
		is_video,
	);
};

const normalizeContent = (value) => {
	if (typeof value !== "string") return "";
	return value
		.toLowerCase()
		.replace(/https?:\/\/\S+/g, "")
		.replace(/\s+/g, " ")
		.trim();
};

const SUSPICIOUS_DOMAINS = new Set([
	"bit.ly",
	"tinyurl.com",
	"goo.gl",
	"ow.ly",
	"t.co",
	"is.gd",
	"cli.gs",
	"tiny.cc",
	"cutt.ly",
	"rb.gy",
	"shorturl.at",
	"adf.ly",
	"ouo.io",
	"linktr.ee",
]);

const extractUrlMetrics = (content) => {
	if (!content) return { urlCount: 0, suspiciousCount: 0 };
	const urls = content.match(/https?:\/\/[^\s]+/gi) || [];
	let suspiciousCount = 0;
	urls.forEach((url) => {
		try {
			const hostname = new URL(url).hostname.toLowerCase();
			if (
				SUSPICIOUS_DOMAINS.has(hostname) ||
				[...SUSPICIOUS_DOMAINS].some((d) => hostname.endsWith(`.${d}`))
			) {
				suspiciousCount++;
			}
		} catch {}
	});
	return { urlCount: urls.length, suspiciousCount };
};

const countHashtags = (content) => {
	if (!content) return 0;
	return (content.match(/#[a-zA-Z0-9_]+/g) || []).length;
};

const countMentions = (content) => {
	if (!content) return 0;
	return (content.match(/@[a-zA-Z0-9_]+/g) || []).length;
};

const calculateEmojiDensity = (content) => {
	if (!content) return 0;
	const emojiPattern =
		/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
	const emojis = content.match(emojiPattern) || [];
	const nonWhitespace = content.replace(/\s/g, "").length;
	if (nonWhitespace === 0) return 0;
	return Math.min(1.0, emojis.length / Math.max(15, nonWhitespace / 4));
};

const SPAM_KEYWORDS = new Set([
	"free money",
	"click here",
	"limited time",
	"act now",
	"buy now",
	"make money fast",
	"earn cash",
	"100% free",
	"no credit card",
	"winner",
	"you won",
	"congratulations",
	"exclusive offer",
	"special promotion",
	"dm for",
	"dm me",
	"check bio",
	"link in bio",
	"crypto giveaway",
	"airdrop",
	"nft drop",
	"whitelist",
	"presale",
	"pump",
	"moon",
	"lambo",
	"10x",
	"100x",
	"1000x",
	"guaranteed profit",
	"passive income",
	"work from home",
	"be your own boss",
	"financial freedom",
	"get rich",
	"s3x",
	"xxx",
	"onlyfans",
	"subscribe to my",
	"follow for follow",
	"f4f",
	"like4like",
	"rePOST to win",
	"rt to win",
	"cashapp",
	"paypal me",
	"venmo me",
	"send btc",
	"send eth",
]);

const calculateSpamKeywordScore = (content) => {
	if (!content) return 0;
	const lower = content.toLowerCase();
	let score = 0;
	for (const keyword of SPAM_KEYWORDS) {
		if (lower.includes(keyword)) {
			score += 0.15;
		}
	}
	return Math.min(1.0, score);
};

const calculaterePOSTLikeRatio = (rePOSTCount, likeCount) => {
	if (likeCount === 0 && rePOSTCount === 0) return 0;
	if (likeCount === 0) return Math.min(1.0, rePOSTCount * 0.1);
	return Math.min(1.0, rePOSTCount / (likeCount + 1));
};

const calculateEngagementVelocity = (likes, rePOSTS, replies, ageSeconds) => {
	if (ageSeconds <= 0) return 0;
	const total = likes + rePOSTS + replies;
	const hoursAge = Math.max(ageSeconds / 3600, 0.1);
	return Math.min(10.0, total / hoursAge);
};

const hasVideoAttachment = (attachments) => {
	if (!Array.isArray(attachments)) return 0;
	return attachments.some(
		(a) =>
			a.type === "video" ||
			a.mime_type?.startsWith("video/") ||
			a.url?.match(/\.(mp4|webm|mov|avi)$/i),
	)
		? 1
		: 0;
};

export const rankPOSTS = (
	POSTS,
	seenInput = new Map(),
	displayLimit = null,
) => {
	if (!lib) return POSTS;
	if (!Array.isArray(POSTS) || POSTS.length === 0) return [];

	let seenMap;
	if (seenInput instanceof Map) {
		seenMap = seenInput;
	} else if (seenInput instanceof Set) {
		seenMap = new Map();
		seenInput.forEach((id) => {
			seenMap.set(id, null);
		});
	} else {
		seenMap = new Map();
	}

	const nowMillis = Date.now();
	const nowSeconds = Math.floor(nowMillis / 1000);

	const authorCounts = new Map();
	const contentCounts = new Map();

	POSTS.forEach((POST) => {
		const authorKey =
			POST.user_id ||
			POST.author_id ||
			POST.author?.id ||
			POST.username ||
			POST.author?.username;
		if (authorKey) {
			authorCounts.set(authorKey, (authorCounts.get(authorKey) || 0) + 1);
		}

		const contentKey = normalizeContent(POST.content);
		if (contentKey) {
			contentCounts.set(contentKey, (contentCounts.get(contentKey) || 0) + 1);
		}
	});

	const allSeen = POSTS.every((POST) => seenMap.has(POST.id));

	const scored = POSTS.map((POST) => {
		let timestamp =
			typeof POST.created_at === "string"
				? Math.floor(new Date(POST.created_at).getTime() / 1000)
				: POST.created_at;
		if (!Number.isFinite(timestamp)) {
			timestamp = nowSeconds;
		}

		const attachments = Array.isArray(POST.attachments)
			? POST.attachments
			: [];
		const hasQuotedMedia =
			POST.quoted_POST &&
			Array.isArray(POST.quoted_POST.attachments) &&
			POST.quoted_POST.attachments.length > 0;
		const hasMedia = attachments.length > 0 || hasQuotedMedia ? 1 : 0;

		const authorKey =
			POST.user_id ||
			POST.author_id ||
			POST.author?.id ||
			POST.username ||
			POST.author?.username;
		const authorCount = authorKey ? authorCounts.get(authorKey) || 0 : 0;

		const contentKey = normalizeContent(POST.content);
		const contentCount = contentKey ? contentCounts.get(contentKey) || 0 : 0;

		const seenMeta = seenMap.get(POST.id);
		let hoursSinceSeen = -1;
		if (seenMeta !== undefined && seenMeta !== null) {
			const parsed = Date.parse(
				typeof seenMeta === "string" && !seenMeta.endsWith("Z")
					? `${seenMeta}Z`
					: seenMeta,
			);
			if (Number.isFinite(parsed)) {
				hoursSinceSeen = Math.max(0, (nowMillis - parsed) / 3600000);
			}
		}

		let noveltyFactor = 1.0;
		if (hoursSinceSeen < 0) {
			noveltyFactor = 1.2;
		} else if (hoursSinceSeen > 72) {
			noveltyFactor = 1.05;
		}

		const randomFactor = Math.random();

		const userVerified = POST.verified || POST.author?.verified ? 1 : 0;
		const userGold = POST.gold || POST.author?.gold ? 1 : 0;
		const followerCount =
			POST.follower_count || POST.author?.follower_count || 0;
		const hasCommunityNote =
			POST.has_community_note || POST.fact_check ? 1 : 0;
		const userBoost = POST.super_POSTer
			? POST.super_POSTer_boost || 50.0
			: 0.0;
		const postBoost = POST.super_POST ? POST.super_POST_boost || 50.0 : 0.0;
		const userSuperPOSTerBoost = Math.max(userBoost, postBoost);

		const blockedByCount =
			POST.blocked_by_count || POST.author?.blocked_by_count || 0;
		const mutedByCount =
			POST.muted_by_count || POST.author?.muted_by_count || 0;
		const spamScore = POST.spam_score || POST.author?.spam_score || 0.0;

		const accountCreatedAt = POST.author?.created_at || POST.user_created_at;
		let accountAgeDays = 0.0;
		if (accountCreatedAt) {
			const createdMs =
				typeof accountCreatedAt === "string"
					? new Date(accountCreatedAt).getTime()
					: accountCreatedAt;
			accountAgeDays = Math.max(0, (nowMillis - createdMs) / 86400000);
		}

		const POSTContent = POST.content || "";
		const { urlCount, suspiciousCount } = extractUrlMetrics(POSTContent);
		const hashtagCount = countHashtags(POSTContent);
		const mentionCount = countMentions(POSTContent);
		const emojiDensity = calculateEmojiDensity(POSTContent);
		const authorTimingScore =
			POST.author_timing_score || POST.author?.timing_score || 0.0;
		const clusterSize = POST.cluster_size || 0;

		const spamKeywordScore = calculateSpamKeywordScore(POSTContent);
		const likes = POST.like_count || 0;
		const rePOSTS = POST.rePOST_count || 0;
		const replies = POST.reply_count || 0;
		const rtLikeRatio = calculaterePOSTLikeRatio(rePOSTS, likes);
		const POSTAgeSeconds = nowSeconds - timestamp;
		const engagementVelocity = calculateEngagementVelocity(
			likes,
			rePOSTS,
			replies,
			POSTAgeSeconds,
		);
		const isVideo = hasVideoAttachment(attachments);

		const score = calculateScore(
			timestamp,
			likes,
			rePOSTS,
			replies,
			POST.quote_count || 0,
			hasMedia,
			hoursSinceSeen,
			Math.max(0, authorCount - 1),
			Math.max(0, contentCount - 1),
			noveltyFactor,
			randomFactor,
			allSeen ? 1 : 0,
			0,
			userVerified,
			userGold,
			followerCount,
			hasCommunityNote,
			userSuperPOSTerBoost,
			blockedByCount,
			mutedByCount,
			spamScore,
			accountAgeDays,
			urlCount,
			suspiciousCount,
			hashtagCount,
			mentionCount,
			emojiDensity,
			authorTimingScore,
			clusterSize,
			spamKeywordScore,
			rtLikeRatio,
			engagementVelocity,
			isVideo,
		);

		let adjustedScore = score;

		if (replies > 5 && replies > likes * 2) {
			adjustedScore *= 0.5;
		}

		if (followerCount > 0) {
			const boost = 1.0 + Math.log10(followerCount + 1) * 0.02;
			adjustedScore *= boost;
		}

		return { ...POST, _score: adjustedScore };
	});

	scored.sort((a, b) => b._score - a._score);

	// If displayLimit is not provided or invalid, use default: min(10, requested)
	if (!Number.isFinite(displayLimit) || displayLimit === null) {
		displayLimit = Math.min(10, scored.length);
	} else {
		displayLimit = Math.min(Math.max(parseInt(displayLimit, 10) || 10, 1), 60);
		if (displayLimit > scored.length) displayLimit = scored.length;
	}

	// Build topCandidates from which we'll select the final display set.
	const candidatePool = Math.min(scored.length, Math.max(displayLimit * 3, 20));
	const topCandidates = scored.slice(0, candidatePool);

	// Select displayLimit items while preventing repetition and limiting author dominance.
	const selected = [];
	const selectedAuthors = new Map();
	const selectedContent = new Set();

	// helper to normalize content key already available in posts
	const netScore = (t) => t._score * (1.0 + Math.random() * 0.05);

	for (
		let i = 0;
		i < topCandidates.length && selected.length < displayLimit;
		i++
	) {
		// pick the best available candidate each time while respecting constraints
		let bestIdx = -1;
		let bestVal = -Infinity;
		for (let j = 0; j < topCandidates.length; j++) {
			const c = topCandidates[j];
			if (!c) continue;
			if (selected.find((s) => s.id === c.id)) continue;
			// skip if same content already chosen for top slots (strict for first 2 slots)
			const contentKey = normalizeContent(c.content || "");
			const authorKey =
				c.user_id ||
				c.author_id ||
				c.username ||
				c.author?.id ||
				c.author?.username;
			const authorCount = selectedAuthors.get(authorKey) || 0;
			const contentUsed = selectedContent.has(contentKey);
			let penalty = 1.0;
			if (contentUsed && selected.length < 3) penalty *= 0.12; // be strict on content duplicates early
			if (authorCount >= 2) penalty *= 0.5; // limit author dominance
			// prefer fresher, unseen content slightly
			const seenPenalty =
				c.hours_since_seen >= 0
					? Math.max(0.6, 1 - c.hours_since_seen * 0.03)
					: 1.05;
			let val = netScore(c) * penalty * seenPenalty;
			if (contentUsed && selected.length >= 3) val *= 0.8; // lesser penalty later
			if (authorCount > 3) val *= 0.3;
			if (val > bestVal) {
				bestVal = val;
				bestIdx = j;
			}
		}
		if (bestIdx >= 0) {
			const chosen = topCandidates[bestIdx];
			selected.push(chosen);
			const ak =
				chosen.user_id ||
				chosen.author_id ||
				chosen.username ||
				chosen.author?.id ||
				chosen.author?.username;
			selectedAuthors.set(ak, (selectedAuthors.get(ak) || 0) + 1);
			const ck = normalizeContent(chosen.content || "");
			selectedContent.add(ck);
		}
	}

	// If we didn't fill top slots from topCandidates, append next best
	let idx = 0;
	while (selected.length < displayLimit && idx < scored.length) {
		const c = scored[idx];
		if (!selected.find((s) => s.id === c.id)) selected.push(c);
		idx++;
	}

	const remaining = scored.filter((s) => !selected.find((x) => x.id === s.id));

	// small jitter shuffle: stronger shuffle for first 4 slots
	const jitterWindow = Math.min(displayLimit, 4);
	for (let i = 0; i < jitterWindow; i++) {
		const j = i + Math.floor(Math.random() * (displayLimit - i));
		if (j !== i) {
			const tmp = selected[i];
			selected[i] = selected[j];
			selected[j] = tmp;
		}

		// Ensure top two are not from same author or identical content
		if (selected.length >= 2) {
			const a0 = selected[0];
			const a1 = selected[1];
			const c0 = normalizeContent(a0.content || "");
			const c1 = normalizeContent(a1.content || "");
			const ak0 =
				a0.user_id ||
				a0.author_id ||
				a0.username ||
				a0.author?.id ||
				a0.author?.username;
			const ak1 =
				a1.user_id ||
				a1.author_id ||
				a1.username ||
				a1.author?.id ||
				a1.author?.username;
			if (ak0 === ak1 || c0 === c1) {
				// find next candidate in remaining that doesn't conflict
				let foundIdx = -1;
				for (let r = 0; r < remaining.length; r++) {
					const cand = remaining[r];
					const cak =
						cand.user_id ||
						cand.author_id ||
						cand.username ||
						cand.author?.id ||
						cand.author?.username;
					const cc = normalizeContent(cand.content || "");
					if (cak !== ak0 && cc !== c0) {
						foundIdx = r;
						break;
					}
				}
				if (foundIdx >= 0) {
					const repl = remaining.splice(foundIdx, 1)[0];
					selected[1] = repl;
				}
			}
		}
	}

	const finalArray = [...selected, ...remaining];
	return finalArray.map(({ _score, ...rest }) => rest);
};

const EMPTY_TIMELINE = { timeline: [] };

const encodeTimelineInput = (options) => {
	if (!options) {
		return null;
	}
	if (typeof options === "string") {
		return options;
	}
	if (typeof options === "object" && Object.keys(options).length === 0) {
		return null;
	}
	try {
		return JSON.stringify(options);
	} catch {
		return null;
	}
};

const releaseTimelineBuffer = (result) => {
	if (!result) {
		return;
	}
	const ptr =
		typeof result === "object" && result !== null && "ptr" in result
			? result.ptr
			: result;
	if (ptr === undefined || ptr === null) {
		return;
	}
	try {
		lib?.symbols?.free_timeline_json?.(ptr);
	} catch {}
};

const parseTimelineResult = (result) => {
	if (!result) {
		return EMPTY_TIMELINE;
	}
	let payload = "";
	try {
		payload = result.toString();
	} catch {
		payload = "";
	}
	releaseTimelineBuffer(result);
	if (!payload) {
		return EMPTY_TIMELINE;
	}
	try {
		const parsed = JSON.parse(payload);
		if (parsed && typeof parsed === "object") {
			return parsed;
		}
	} catch {}
	return EMPTY_TIMELINE;
};

export const processTimeline = (options = null) => {
	if (!lib || !lib.symbols?.process_timeline) {
		return EMPTY_TIMELINE;
	}
	const input = encodeTimelineInput(options);
	const result = lib.symbols.process_timeline(input);
	return parseTimelineResult(result);
};

export const isAlgorithmAvailable = () => lib !== null;
