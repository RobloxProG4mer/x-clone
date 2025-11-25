import { dlopen, FFIType, suffix } from "bun:ffi";
import { existsSync } from "node:fs";
import path from "node:path";

const libPath = path.join(import.meta.dir, `algorithm.${suffix}`);

let lib = null;

if (existsSync(libPath)) {
	try {
		lib = dlopen(libPath, {
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
		});
	} catch (error) {
		console.warn("Failed to load C algorithm library");
		console.warn("Error:", error.message);
	}
} else {
	console.error(
		`C algorithm library not found at ${libPath} (possibly not compiled?)`,
	);
	console.warn(
		"-> run 'make' in src/algo/ to compile the C algorithm",
	);
}

export const calculateScore = (
	created_at,
	like_count,
	retweet_count,
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
	user_super_tweeter_boost = 0.0,
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
	retweet_like_ratio = 0.0,
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
		retweet_count,
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
		user_super_tweeter_boost,
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
		retweet_like_ratio,
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
	"retweet to win",
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

const calculateRetweetLikeRatio = (retweetCount, likeCount) => {
	if (likeCount === 0 && retweetCount === 0) return 0;
	if (likeCount === 0) return Math.min(1.0, retweetCount * 0.1);
	return Math.min(1.0, retweetCount / (likeCount + 1));
};

const calculateEngagementVelocity = (likes, retweets, replies, ageSeconds) => {
	if (ageSeconds <= 0) return 0;
	const total = likes + retweets + replies;
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

export const rankTweets = (
	tweets,
	seenInput = new Map(),
	displayLimit = null,
) => {
	if (!lib) return tweets;
	if (!Array.isArray(tweets) || tweets.length === 0) return [];

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

	tweets.forEach((tweet) => {
		const authorKey =
			tweet.user_id ||
			tweet.author_id ||
			tweet.author?.id ||
			tweet.username ||
			tweet.author?.username;
		if (authorKey) {
			authorCounts.set(authorKey, (authorCounts.get(authorKey) || 0) + 1);
		}

		const contentKey = normalizeContent(tweet.content);
		if (contentKey) {
			contentCounts.set(contentKey, (contentCounts.get(contentKey) || 0) + 1);
		}
	});

	const allSeen = tweets.every((tweet) => seenMap.has(tweet.id));

	const scored = tweets.map((tweet) => {
		let timestamp =
			typeof tweet.created_at === "string"
				? Math.floor(new Date(tweet.created_at).getTime() / 1000)
				: tweet.created_at;
		if (!Number.isFinite(timestamp)) {
			timestamp = nowSeconds;
		}

		const attachments = Array.isArray(tweet.attachments)
			? tweet.attachments
			: [];
		const hasQuotedMedia =
			tweet.quoted_tweet &&
			Array.isArray(tweet.quoted_tweet.attachments) &&
			tweet.quoted_tweet.attachments.length > 0;
		const hasMedia = attachments.length > 0 || hasQuotedMedia ? 1 : 0;

		const authorKey =
			tweet.user_id ||
			tweet.author_id ||
			tweet.author?.id ||
			tweet.username ||
			tweet.author?.username;
		const authorCount = authorKey ? authorCounts.get(authorKey) || 0 : 0;

		const contentKey = normalizeContent(tweet.content);
		const contentCount = contentKey ? contentCounts.get(contentKey) || 0 : 0;

		const seenMeta = seenMap.get(tweet.id);
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

		const userVerified = tweet.verified || tweet.author?.verified ? 1 : 0;
		const userGold = tweet.gold || tweet.author?.gold ? 1 : 0;
		const followerCount =
			tweet.follower_count || tweet.author?.follower_count || 0;
		const hasCommunityNote =
			tweet.has_community_note || tweet.fact_check ? 1 : 0;
		const userBoost = tweet.super_tweeter
			? tweet.super_tweeter_boost || 50.0
			: 0.0;
		const postBoost = tweet.super_tweet ? tweet.super_tweet_boost || 50.0 : 0.0;
		const userSuperTweeterBoost = Math.max(userBoost, postBoost);

		const blockedByCount =
			tweet.blocked_by_count || tweet.author?.blocked_by_count || 0;
		const mutedByCount =
			tweet.muted_by_count || tweet.author?.muted_by_count || 0;
		const spamScore = tweet.spam_score || tweet.author?.spam_score || 0.0;

		const accountCreatedAt = tweet.author?.created_at || tweet.user_created_at;
		let accountAgeDays = 0.0;
		if (accountCreatedAt) {
			const createdMs =
				typeof accountCreatedAt === "string"
					? new Date(accountCreatedAt).getTime()
					: accountCreatedAt;
			accountAgeDays = Math.max(0, (nowMillis - createdMs) / 86400000);
		}

		const tweetContent = tweet.content || "";
		const { urlCount, suspiciousCount } = extractUrlMetrics(tweetContent);
		const hashtagCount = countHashtags(tweetContent);
		const mentionCount = countMentions(tweetContent);
		const emojiDensity = calculateEmojiDensity(tweetContent);
		const authorTimingScore =
			tweet.author_timing_score || tweet.author?.timing_score || 0.0;
		const clusterSize = tweet.cluster_size || 0;

		const spamKeywordScore = calculateSpamKeywordScore(tweetContent);
		const likes = tweet.like_count || 0;
		const retweets = tweet.retweet_count || 0;
		const replies = tweet.reply_count || 0;
		const rtLikeRatio = calculateRetweetLikeRatio(retweets, likes);
		const tweetAgeSeconds = nowSeconds - timestamp;
		const engagementVelocity = calculateEngagementVelocity(
			likes,
			retweets,
			replies,
			tweetAgeSeconds,
		);
		const isVideo = hasVideoAttachment(attachments);

		const score = calculateScore(
			timestamp,
			likes,
			retweets,
			replies,
			tweet.quote_count || 0,
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
			userSuperTweeterBoost,
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

		return { ...tweet, _score: adjustedScore };
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

export const isAlgorithmAvailable = () => lib !== null;
