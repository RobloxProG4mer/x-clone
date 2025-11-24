import db from "../db.js";

const updateSpamScore = db.prepare(
	"UPDATE users SET spam_score = ? WHERE id = ?",
);

const getUserPosts = db.prepare(`
  SELECT id, content, created_at, like_count, retweet_count, reply_count, reply_to
  FROM posts 
  WHERE user_id = ? 
  ORDER BY created_at DESC 
  LIMIT 200
`);

const getUserOriginalPosts = db.prepare(`
  SELECT id, content, created_at, like_count, retweet_count, reply_count
  FROM posts 
  WHERE user_id = ? AND reply_to IS NULL
  ORDER BY created_at DESC 
  LIMIT 200
`);

const getUserInfo = db.prepare(`
  SELECT 
    created_at,
    (SELECT COUNT(*) FROM follows WHERE following_id = users.id) as follower_count,
    (SELECT COUNT(*) FROM follows WHERE follower_id = users.id) as following_count,
    (SELECT COUNT(*) FROM posts WHERE user_id = users.id AND reply_to IS NULL) as total_posts,
    (SELECT COUNT(*) FROM posts WHERE user_id = users.id AND reply_to IS NOT NULL) as total_replies
  FROM users 
  WHERE id = ?
`);

const getUserReplies = db.prepare(`
  SELECT id, reply_to, content, created_at
  FROM posts 
  WHERE user_id = ? AND reply_to IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 60
`);

const SUSPICIOUS_DOMAINS = [
	"bit.ly",
	"tinyurl.com",
	"goo.gl",
	"ow.ly",
	"t.co",
	"is.gd",
	"cli.gs",
	"pic.gd",
	"DwarfURL.com",
	"yfrog.com",
	"migre.me",
	"ff.im",
	"tiny.cc",
	"url4.eu",
	"tr.im",
	"twit.ac",
	"su.pr",
	"twurl.nl",
	"snipurl.com",
	"short.to",
	"BudURL.com",
	"ping.fm",
	"post.ly",
	"Just.as",
	"bkite.com",
	"snipr.com",
	"fic.kr",
	"loopt.us",
	"doiop.com",
	"twitthis.com",
	"htxt.it",
	"AltURL.com",
	"linktr.ee",
	"cutt.ly",
	"rb.gy",
	"shorturl.at",
	"v.gd",
	"clck.ru",
	"shorte.st",
	"adf.ly",
	"bc.vc",
	"ouo.io",
	"za.gl",
];

const SPAM_KEYWORDS = [
	"crypto",
	"bitcoin",
	"btc",
	"eth",
	"ethereum",
	"forex",
	"investment",
	"profit",
	"giveaway",
	"prize",
	"winner",
	"congratulations",
	"click here",
	"link in bio",
	"dm me",
	"whatsapp",
	"telegram",
	"cash app",
	"paypal",
	"money",
	"income",
	"work from home",
	"passive income",
	"nft",
	"airdrop",
	"free money",
	"make money",
	"earn money",
	"limited time",
	"act now",
	"urgent",
	"verify your account",
	"account suspended",
	"confirm identity",
	"onlyfans",
	"leaked",
	"s3x",
	"xxx",
	"18+",
	"double your",
	"100% guaranteed",
	"risk free",
	"no risk",
	"mlm",
	"pyramid",
	"get rich",
	"millionaire",
	"binary options",
	"trading signals",
];

const normalizeContent = (text) => {
	if (!text) return "";
	// Remove URLs, normalize whitespace, remove punctuation, collapse accents stuck cursor
	return text
		.toLowerCase()
		.replace(/https?:\/\/\S+/g, "")
		.replace(/[\p{P}\p{S}]/gu, " ")
		.replace(/\s+/g, " ")
		.normalize("NFKD")
		.replace(/\p{M}/gu, "") // strip diacritics
		.trim();
};

const extractUrls = (text) => {
	if (!text) return [];
	const urlPattern = /https?:\/\/[^\s]+/gi;
	return text.match(urlPattern) || [];
};

const extractHashtags = (text) => {
	if (!text) return [];
	const hashtagPattern = /#[a-zA-Z0-9_]+/g;
	return text.match(hashtagPattern) || [];
};

const extractMentions = (text) => {
	if (!text) return [];
	const mentionPattern = /@[a-zA-Z0-9_]+/g;
	return text.match(mentionPattern) || [];
};

const hasSuspiciousDomain = (url) => {
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname.toLowerCase();
		return SUSPICIOUS_DOMAINS.some(
			(domain) => hostname === domain || hostname.endsWith("." + domain),
		);
	} catch {
		return false;
	}
};

const calculateRepeatedCharScore = (text) => {
	if (!text || text.length < 10) return 0;

	const repeatedPattern = /(.)\1{4,}/g;
	const matches = text.match(repeatedPattern);
	if (!matches) return 0;

	const totalRepeated = matches.reduce((sum, match) => sum + match.length, 0);
	return Math.min(1.0, totalRepeated / text.length);
};

const calculateCapitalizationScore = (text) => {
	if (!text || text.length < 10) return 0;

	const letters = text.replace(/[^a-zA-Z]/g, "");
	if (letters.length < 10) return 0;

	const uppercase = letters.replace(/[^A-Z]/g, "");
	const ratio = uppercase.length / letters.length;

	return ratio > 0.7 ? Math.min(1.0, (ratio - 0.7) / 0.3) : 0;
};

const calculateEmojiDensity = (text) => {
	if (!text) return 0;

	const emojiPattern =
		/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
	const emojis = text.match(emojiPattern) || [];

	const nonWhitespace = text.replace(/\s/g, "").length;
	if (nonWhitespace === 0) return 0;

	return Math.min(1.0, emojis.length / Math.max(20, nonWhitespace / 3));
};

const calculateKeywordSpamScore = (text) => {
	if (!text) return 0;
	const lower = ` ${text.toLowerCase()} `;
	let matches = 0;
	for (const keyword of SPAM_KEYWORDS) {
		const re = new RegExp(
			`\\b${keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`,
			"i",
		);
		if (re.test(lower)) matches++;
	}
	return Math.min(1.0, matches * 0.24);
};

// --- New helpers ---
const ngramSet = (text, n = 3) => {
	const normalized = normalizeContent(text);
	if (!normalized) return new Set();
	const padded = ` ${normalized} `;
	const s = new Set();
	for (let i = 0; i < padded.length - n + 1; i++) {
		s.add(padded.slice(i, i + n));
	}
	return s;
};

const jaccardSetSimilarity = (a, b) => {
	const inter = [...a].filter((v) => b.has(v)).length;
	const uni = new Set([...a, ...b]).size;
	return uni === 0 ? 0 : inter / uni;
};

const exponentialRecencyWeight = (
	createdAtMs,
	now = Date.now(),
	decayHours = 48,
) => {
	const ageMs = now - new Date(createdAtMs).getTime();
	const decayMs = decayHours * 60 * 60 * 1000;
	return Math.exp(-ageMs / decayMs);
};

const logistic = (x, k = 8, x0 = 0.5) => {
	// Map x in [0,1] into logistic value in (0,1)
	const xx = Math.min(1, Math.max(0, x));
	const val = 1 / (1 + Math.exp(-k * (xx - x0)));
	return val;
};

const getSpamAnalysis = (userId) => {
	try {
		const allPosts = getUserPosts.all(userId);
		const originalPosts = getUserOriginalPosts.all(userId);
		const userInfo = getUserInfo.get(userId);
		const replies = getUserReplies.all(userId);

		if (allPosts.length < 5) {
			return {
				score: 0.0,
				indicators: [],
				notEnoughData: true,
			};
		}

		const indicators = [];

		const recentPosts = originalPosts.slice(0, 60);
		const contentMap = new Map();
		const contentTexts = [];
		const duplicateTweets = [];

		for (const post of recentPosts) {
			const normalized = normalizeContent(post.content);
			if (!normalized) continue;
			const count = contentMap.get(normalized) || 0;
			contentMap.set(normalized, count + 1);
			contentTexts.push(normalized);
			if (count > 0) {
				duplicateTweets.push({
					id: post.id,
					content: post.content?.slice(0, 100),
					reason: "Exact duplicate",
				});
			}
		}

		let duplicateCount = 0;
		let maxDuplicates = 0;
		for (const count of contentMap.values()) {
			if (count > 1) {
				duplicateCount += count - 1;
				maxDuplicates = Math.max(maxDuplicates, count);
			}
		}

		const duplicateRatio = duplicateCount / Math.max(recentPosts.length, 1);
		let duplicateScore = 0;
		if (duplicateRatio > 0.4) duplicateScore = 0.3;
		if (duplicateRatio > 0.6) duplicateScore = 0.6;
		if (duplicateRatio > 0.75) duplicateScore = 1.0;
		if (maxDuplicates > 8) duplicateScore = Math.max(duplicateScore, 0.8);

		indicators.push({
			name: "duplicate_content",
			displayName: "Duplicate Content",
			score: duplicateScore,
			weight: 0.12,
			details: `${(duplicateRatio * 100).toFixed(1)}% duplicate posts, max ${maxDuplicates} repeats`,
			impactingTweets: duplicateTweets.slice(0, 10),
		});

		const nearDupPairs = [];
		const sets = contentTexts
			.slice(0, 40)
			.map((t, i) => ({ set: ngramSet(t, 3), idx: i }));
		let pairCount = 0;
		let nearDupCount = 0;
		for (let i = 0; i < sets.length; i++) {
			for (let j = i + 1; j < sets.length; j++) {
				pairCount++;
				const sim = jaccardSetSimilarity(sets[i].set, sets[j].set);
				if (sim >= 0.7) {
					nearDupCount++;
					if (nearDupPairs.length < 10 && recentPosts[i] && recentPosts[j]) {
						nearDupPairs.push({
							id: recentPosts[i].id,
							content: recentPosts[i].content?.slice(0, 80),
							reason: `${(sim * 100).toFixed(0)}% similar to another post`,
						});
					}
				}
			}
		}
		const nearDupRatio =
			pairCount === 0 ? 0 : Math.min(1.0, nearDupCount / pairCount);

		let nearDupScore = 0;
		if (nearDupRatio > 0.08) nearDupScore = 0.2;
		if (nearDupRatio > 0.2) nearDupScore = 0.5;
		if (nearDupRatio > 0.4) nearDupScore = 0.85;
		if (nearDupRatio > 0.6) nearDupScore = 1.0;

		indicators.push({
			name: "near_duplicate",
			displayName: "Near-Duplicate Content",
			score: nearDupScore,
			weight: 0.1,
			details: `${(nearDupRatio * 100).toFixed(1)}% post-pairs are near-duplicates`,
			impactingTweets: nearDupPairs,
		});

		const now = Date.now();
		const oneHourAgo = now - 3600000;
		const sixHoursAgo = now - 6 * 3600000;
		const oneDayAgo = now - 24 * 3600000;

		const postsInLastHour = originalPosts.filter(
			(p) => new Date(p.created_at).getTime() > oneHourAgo,
		);
		const postsInLast6Hours = originalPosts.filter(
			(p) => new Date(p.created_at).getTime() > sixHoursAgo,
		);
		const postsInLastDay = originalPosts.filter(
			(p) => new Date(p.created_at).getTime() > oneDayAgo,
		);

		const repliesInLastHour = replies.filter(
			(p) => new Date(p.created_at).getTime() > oneHourAgo,
		).length;
		const repliesInLastDay = replies.filter(
			(p) => new Date(p.created_at).getTime() > oneDayAgo,
		).length;

		const recencySum = originalPosts
			.slice(0, 100)
			.reduce(
				(sum, p) => sum + exponentialRecencyWeight(p.created_at, now, 24),
				0,
			);
		const recencyNormalized = Math.min(1.0, recencySum / 12);

		let frequencyScore = 0;
		if (postsInLastHour.length > 20) frequencyScore = 1.0;
		else if (postsInLastHour.length > 15) frequencyScore = 0.7;
		else if (postsInLastHour.length > 10) frequencyScore = 0.4;
		else if (postsInLast6Hours.length > 60)
			frequencyScore = Math.max(frequencyScore, 0.8);
		else if (postsInLast6Hours.length > 40)
			frequencyScore = Math.max(frequencyScore, 0.5);
		else if (postsInLastDay.length > 150)
			frequencyScore = Math.max(frequencyScore, 0.9);
		else if (postsInLastDay.length > 100)
			frequencyScore = Math.max(frequencyScore, 0.6);

		if (recencyNormalized > 0.85)
			frequencyScore = Math.max(frequencyScore, 0.9);
		else if (recencyNormalized > 0.6)
			frequencyScore = Math.max(frequencyScore, 0.6);

		indicators.push({
			name: "posting_frequency",
			displayName: "Posting Frequency",
			score: frequencyScore,
			weight: 0.11,
			details: `${postsInLastHour.length} posts/hour (${repliesInLastHour} replies), ${postsInLastDay.length} posts/day (${repliesInLastDay} replies)`,
			impactingTweets: postsInLastHour
				.slice(0, 10)
				.map((p) => ({
					id: p.id,
					content: p.content?.slice(0, 80),
					reason: "Posted in last hour",
				})),
		});

		const timestamps = originalPosts
			.slice(0, 50)
			.map((p) => new Date(p.created_at).getTime());
		const intervals = [];
		for (let i = 1; i < timestamps.length; i++) {
			intervals.push(timestamps[i - 1] - timestamps[i]);
		}
		let timingScore = 0;
		if (intervals.length > 5) {
			const meanInterval =
				intervals.reduce((a, b) => a + b, 0) / intervals.length;
			const variance =
				intervals.reduce((sum, v) => sum + (v - meanInterval) ** 2, 0) /
				intervals.length;
			const stdDev = Math.sqrt(variance);
			const coeffOfVariation = meanInterval > 0 ? stdDev / meanInterval : 0;
			if (coeffOfVariation < 0.15 && meanInterval < 120000) timingScore = 0.95;
			else if (coeffOfVariation < 0.25 && meanInterval < 180000)
				timingScore = 0.7;
			else if (coeffOfVariation < 0.35 && meanInterval < 300000)
				timingScore = 0.4;
		}

		indicators.push({
			name: "timing_regularity",
			displayName: "Bot-Like Timing",
			score: timingScore,
			weight: 0.09,
			details: `Timing regularity analysis (${intervals.length} intervals between posts)`,
			impactingTweets: [],
		});

		const urlTweets = [];
		const urlAnalysis = recentPosts.map((p) => {
			const urls = extractUrls(p.content);
			const suspiciousUrls = urls.filter(hasSuspiciousDomain);
			if (urls.length > 0) {
				urlTweets.push({
					id: p.id,
					content: p.content?.slice(0, 80),
					reason:
						suspiciousUrls.length > 0
							? `${suspiciousUrls.length} suspicious URL(s)`
							: `${urls.length} URL(s)`,
				});
			}
			return {
				urlCount: urls.length,
				suspiciousCount: suspiciousUrls.length,
				hasUrl: urls.length > 0,
			};
		});

		const avgUrls =
			urlAnalysis.reduce((sum, a) => sum + a.urlCount, 0) /
			Math.max(urlAnalysis.length, 1);
		const postsWithUrls = urlAnalysis.filter((a) => a.hasUrl).length;
		const urlRatio = postsWithUrls / Math.max(urlAnalysis.length, 1);
		const suspiciousUrlCount = urlAnalysis.reduce(
			(sum, a) => sum + a.suspiciousCount,
			0,
		);

		let urlScore = 0;
		if (avgUrls > 3) urlScore = 0.6;
		else if (avgUrls > 2) urlScore = 0.3;
		if (urlRatio > 0.8) urlScore = Math.max(urlScore, 0.7);
		if (suspiciousUrlCount > 5) urlScore = Math.max(urlScore, 0.9);
		else if (suspiciousUrlCount > 2) urlScore = Math.max(urlScore, 0.5);

		indicators.push({
			name: "url_spam",
			displayName: "URL Spam",
			score: urlScore,
			weight: 0.14,
			details: `${(urlRatio * 100).toFixed(1)}% posts with URLs, ${suspiciousUrlCount} suspicious`,
			impactingTweets: urlTweets.slice(0, 10),
		});

		const hashtagTweets = [];
		const hashtagAnalysis = recentPosts.map((p) => {
			const hashtags = extractHashtags(p.content);
			if (hashtags.length > 3) {
				hashtagTweets.push({
					id: p.id,
					content: p.content?.slice(0, 80),
					reason: `${hashtags.length} hashtags`,
				});
			}
			return {
				count: hashtags.length,
				unique: new Set(hashtags.map((h) => h.toLowerCase())).size,
			};
		});

		const avgHashtags =
			hashtagAnalysis.reduce((sum, a) => sum + a.count, 0) /
			Math.max(hashtagAnalysis.length, 1);
		const maxHashtags = Math.max(...hashtagAnalysis.map((a) => a.count), 0);
		const lowDiversityPosts = hashtagAnalysis.filter(
			(a) => a.count > 3 && a.unique / Math.max(a.count, 1) < 0.5,
		).length;

		let hashtagScore = 0;
		if (avgHashtags > 8) hashtagScore = 1.0;
		else if (avgHashtags > 5) hashtagScore = 0.6;
		else if (avgHashtags > 3) hashtagScore = 0.3;
		if (maxHashtags > 15) hashtagScore = Math.max(hashtagScore, 0.9);
		else if (maxHashtags > 10) hashtagScore = Math.max(hashtagScore, 0.6);
		if (lowDiversityPosts > 10) hashtagScore = Math.max(hashtagScore, 0.7);

		indicators.push({
			name: "hashtag_spam",
			displayName: "Hashtag Spam",
			score: hashtagScore,
			weight: 0.1,
			details: `Avg ${avgHashtags.toFixed(1)} hashtags/post, max ${maxHashtags}`,
			impactingTweets: hashtagTweets.slice(0, 10),
		});

		const mentionTweets = [];
		const mentionAnalysis = recentPosts.map((p) => {
			const mentions = extractMentions(p.content);
			const uniqueMentions = new Set(mentions.map((m) => m.toLowerCase()));
			if (mentions.length > 3) {
				mentionTweets.push({
					id: p.id,
					content: p.content?.slice(0, 80),
					reason: `${mentions.length} mentions`,
				});
			}
			return {
				count: mentions.length,
				unique: uniqueMentions.size,
			};
		});

		const avgMentions =
			mentionAnalysis.reduce((sum, a) => sum + a.count, 0) /
			Math.max(mentionAnalysis.length, 1);
		const maxMentions = Math.max(...mentionAnalysis.map((a) => a.count), 0);
		const repetitiveMentions = mentionAnalysis.filter(
			(a) => a.count > 5 && a.unique / Math.max(a.count, 1) < 0.4,
		).length;

		let mentionScore = 0;
		if (avgMentions > 6) mentionScore = 0.9;
		else if (avgMentions > 4) mentionScore = 0.5;
		else if (avgMentions > 3) mentionScore = 0.3;
		if (maxMentions > 15) mentionScore = Math.max(mentionScore, 1.0);
		else if (maxMentions > 10) mentionScore = Math.max(mentionScore, 0.7);
		if (repetitiveMentions > 8) mentionScore = Math.max(mentionScore, 0.8);

		indicators.push({
			name: "mention_spam",
			displayName: "Mention Spam",
			score: mentionScore,
			weight: 0.09,
			details: `Avg ${avgMentions.toFixed(1)} mentions/post, max ${maxMentions}`,
			impactingTweets: mentionTweets.slice(0, 10),
		});

		const qualityTweets = [];
		const qualityAnalysis = recentPosts.map((p) => {
			const content = p.content || "";
			const repeatedChars = calculateRepeatedCharScore(content);
			const capitalization = calculateCapitalizationScore(content);
			const emojiDensity = calculateEmojiDensity(content);
			const keywordScore = calculateKeywordSpamScore(content);
			const isLowQuality =
				repeatedChars > 0.3 ||
				capitalization > 0.5 ||
				emojiDensity > 0.5 ||
				keywordScore > 0.5;

			if (isLowQuality) {
				const reasons = [];
				if (repeatedChars > 0.3) reasons.push("repeated chars");
				if (capitalization > 0.5) reasons.push("excessive caps");
				if (emojiDensity > 0.5) reasons.push("too many emojis");
				if (keywordScore > 0.5) reasons.push("spam keywords");
				qualityTweets.push({
					id: p.id,
					content: content.slice(0, 80),
					reason: reasons.join(", "),
				});
			}

			return {
				length: content.length,
				repeatedChars,
				capitalization,
				emojiDensity,
				keywordScore,
				wordsCount: content.split(/\s+/).filter((w) => w.length > 0).length,
				isLowQuality,
			};
		});

		const veryShortPosts = qualityAnalysis.filter((a) => a.length < 10).length;
		const lowQualityPosts = qualityAnalysis.filter(
			(a) => a.isLowQuality,
		).length;
		const avgWords =
			qualityAnalysis.reduce((sum, a) => sum + a.wordsCount, 0) /
			Math.max(qualityAnalysis.length, 1);
		const avgKeywordScore =
			qualityAnalysis.reduce((sum, a) => sum + a.keywordScore, 0) /
			Math.max(qualityAnalysis.length, 1);

		let qualityScore = 0;
		if (veryShortPosts > 15) qualityScore = 0.7;
		else if (veryShortPosts > 10) qualityScore = 0.4;
		if (lowQualityPosts > 15) qualityScore = Math.max(qualityScore, 0.8);
		else if (lowQualityPosts > 10) qualityScore = Math.max(qualityScore, 0.5);
		if (avgWords < 3) qualityScore = Math.max(qualityScore, 0.6);
		if (avgKeywordScore > 0.3) qualityScore = Math.max(qualityScore, 0.8);

		indicators.push({
			name: "content_quality",
			displayName: "Content Quality",
			score: qualityScore,
			weight: 0.11,
			details: `${lowQualityPosts} low quality posts, avg keyword score ${(avgKeywordScore * 100).toFixed(1)}%`,
			impactingTweets: qualityTweets.slice(0, 10),
		});

		const replySpamTweets = [];
		if (replies.length > 0) {
			const replyTargets = replies.map((r) => r.reply_to);
			const uniqueTargets = new Set(replyTargets);
			const replyDiversity =
				uniqueTargets.size / Math.max(replyTargets.length, 1);

			const replyContentMap = new Map();
			for (const reply of replies) {
				const normalized = normalizeContent(reply.content);
				if (!normalized) continue;
				const count = replyContentMap.get(normalized) || 0;
				replyContentMap.set(normalized, count + 1);
				if (count > 0) {
					replySpamTweets.push({
						id: reply.id,
						content: reply.content?.slice(0, 80),
						reason: "Duplicate reply",
					});
				}
			}

			let replyDuplicates = 0;
			for (const count of replyContentMap.values()) {
				if (count > 1) replyDuplicates += count - 1;
			}
			const replyDuplicateRatio = replyDuplicates / Math.max(replies.length, 1);

			let replyScore = 0;
			if (replyDiversity < 0.3 && replies.length > 10) replyScore = 0.8;
			else if (replyDiversity < 0.5 && replies.length > 15) replyScore = 0.5;
			if (replyDuplicateRatio > 0.5) replyScore = Math.max(replyScore, 0.9);
			else if (replyDuplicateRatio > 0.3)
				replyScore = Math.max(replyScore, 0.6);

			indicators.push({
				name: "reply_spam",
				displayName: "Reply Spam",
				score: replyScore,
				weight: 0.08,
				details: `${(replyDuplicateRatio * 100).toFixed(1)}% duplicate replies, diversity ${(replyDiversity * 100).toFixed(1)}%`,
				impactingTweets: replySpamTweets.slice(0, 10),
			});
		} else {
			indicators.push({
				name: "reply_spam",
				displayName: "Reply Spam",
				score: 0,
				weight: 0.08,
				details: "No replies analyzed",
				impactingTweets: [],
			});
		}

		const noEngagementTweets = [];
		const engagementAnalysis = recentPosts.map((p) => {
			const totalEngagement =
				(p.like_count || 0) + (p.retweet_count || 0) + (p.reply_count || 0);
			if (totalEngagement === 0) {
				noEngagementTweets.push({
					id: p.id,
					content: p.content?.slice(0, 80),
					reason: "0 engagement",
				});
			}
			return {
				engagement: totalEngagement,
				length: p.content?.length || 0,
			};
		});

		const noEngagementCount = engagementAnalysis.filter(
			(a) => a.engagement === 0,
		).length;
		const noEngagementRatio =
			noEngagementCount / Math.max(engagementAnalysis.length, 1);

		let engagementScore = 0;
		if (
			postsInLastDay.length > 30 &&
			noEngagementRatio > 0.9 &&
			originalPosts.length > 20
		) {
			engagementScore = 0.8;
		} else if (
			postsInLastDay.length > 50 &&
			noEngagementRatio > 0.85 &&
			originalPosts.length > 30
		) {
			engagementScore = 0.9;
		} else if (
			postsInLast6Hours.length > 20 &&
			noEngagementRatio > 0.95 &&
			originalPosts.length > 15
		) {
			engagementScore = 0.7;
		}

		indicators.push({
			name: "engagement_manipulation",
			displayName: "Engagement Manipulation",
			score: engagementScore,
			weight: 0.09,
			details: `${(noEngagementRatio * 100).toFixed(1)}% posts with 0 engagement`,
			impactingTweets: noEngagementTweets.slice(0, 10),
		});

		let accountScore = 0;

		if (userInfo) {
			const accountAgeMs = Date.now() - new Date(userInfo.created_at).getTime();
			const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);

			const followersCount = userInfo.follower_count || 0;
			const followingCount = userInfo.following_count || 0;
			const totalPosts = userInfo.total_posts || 0;

			let followerBonus = 0;
			if (followersCount >= 100) followerBonus = 1.0;
			else if (followersCount >= 50) followerBonus = 0.8;
			else if (followersCount >= 20) followerBonus = 0.6;
			else if (followersCount >= 10) followerBonus = 0.4;
			else if (followersCount >= 5) followerBonus = 0.2;

			if (followersCount < 10) {
				if (accountAgeDays < 7 && totalPosts > 100) {
					accountScore = 0.6;
				} else if (accountAgeDays < 3 && totalPosts > 50) {
					accountScore = 0.7;
				} else if (accountAgeDays < 1 && totalPosts > 20) {
					accountScore = 0.9;
				}
			}

			if (followingCount > 0 && followersCount < 20) {
				const followRatio = followingCount / Math.max(followersCount, 1);
				if (followRatio > 20 && followingCount > 200)
					accountScore = Math.max(accountScore, 0.8);
				else if (followRatio > 10 && followingCount > 100)
					accountScore = Math.max(accountScore, 0.6);
				else if (followRatio > 5 && followingCount > 200)
					accountScore = Math.max(accountScore, 0.4);
			}

			if (followersCount === 0 && totalPosts > 50) {
				accountScore = Math.max(accountScore, 0.7);
			} else if (followersCount < 3 && totalPosts > 100) {
				accountScore = Math.max(accountScore, 0.6);
			}

			accountScore = accountScore * (1.0 - followerBonus);
			if (accountScore < 0) accountScore = 0;
		}

		indicators.push({
			name: "account_behavior",
			displayName: "Account Behavior",
			score: accountScore,
			weight: 0.1,
			details: userInfo
				? `${userInfo.follower_count} followers, ${userInfo.following_count} following, ${userInfo.total_posts} posts, ${userInfo.total_replies} replies`
				: "No info",
			impactingTweets: [],
		});

		const highSignals = [
			duplicateScore > 0.5,
			nearDupScore > 0.4,
			frequencyScore > 0.6,
			timingScore > 0.5,
			urlScore > 0.6,
			mentionScore > 0.6,
			engagementScore > 0.6,
			accountScore > 0.5,
			qualityScore > 0.5,
		].filter(Boolean).length;

		let compositeBotScore = 0;
		if (highSignals >= 5) compositeBotScore = 1.0;
		else if (highSignals >= 4) compositeBotScore = 0.85;
		else if (highSignals >= 3) compositeBotScore = 0.6;
		else if (highSignals >= 2) compositeBotScore = 0.3;

		indicators.push({
			name: "composite_bot_signal",
			displayName: "Bot Composite Signal",
			score: compositeBotScore,
			weight: 0.15,
			details: `${highSignals} strong indicators detected`,
			impactingTweets: [],
		});

		let spamScore = 0.0;
		let totalWeight = 0;
		for (const indicator of indicators) {
			spamScore += indicator.score * indicator.weight;
			totalWeight += indicator.weight;
		}

		spamScore = spamScore / Math.max(totalWeight, 0.001);
		spamScore = logistic(spamScore, 10, 0.45);
		spamScore = Math.min(1.0, Math.max(0.0, spamScore));
		spamScore = Math.round(spamScore * 1000) / 1000;

		return {
			score: spamScore,
			indicators,
			notEnoughData: false,
		};
	} catch (error) {
		console.error("Error in spam analysis:", error);
		return {
			score: 0.0,
			indicators: [],
			error: true,
		};
	}
};

export const calculateSpamScore = (userId) => {
	const analysis = getSpamAnalysis(userId);

	if (analysis.error || analysis.notEnoughData) {
		return 0.0;
	}

	const spamScore = analysis.score;

	updateSpamScore.run(spamScore, userId);

	if (spamScore > 0.95) {
		const user = db
			.prepare("SELECT shadowbanned FROM users WHERE id = ?")
			.get(userId);
		if (user && !user.shadowbanned) {
			const suspensionId = Bun.randomUUIDv7();
			const reportId = Bun.randomUUIDv7();
			const now = new Date().toISOString();

			db.prepare("UPDATE users SET shadowbanned = TRUE WHERE id = ?").run(
				userId,
			);

			db.prepare(`
				INSERT INTO suspensions (id, user_id, suspended_by, reason, action, status, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`).run(
				suspensionId,
				userId,
				"system",
				"Automated: High Spam Score",
				"shadowban",
				"active",
				now,
			);

			db.prepare(`
				INSERT INTO reports (id, reporter_id, reported_type, reported_id, reason, status, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`).run(
				reportId,
				"system",
				"user",
				userId,
				`Automated: High Spam Score (${spamScore.toFixed(3)})`,
				"pending",
				now,
			);

			db.prepare("DELETE FROM dm_messages WHERE sender_id = ?").run(userId);

			const logId = Bun.randomUUIDv7();
			db.prepare(`
				INSERT INTO moderation_logs (id, moderator_id, action, target_type, target_id, details, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`).run(
				logId,
				"system",
				"shadowban_user",
				"user",
				userId,
				JSON.stringify({
					reason: "Automated: High Spam Score",
					score: spamScore,
					auto: true,
				}),
				now,
			);

			console.log(
				`[Auto-Mod] Shadowbanned user ${userId} due to high spam score: ${spamScore}`,
			);
		}
	}

	return spamScore;
};

export const updateUserSpamScore = (userId) => {
	return calculateSpamScore(userId);
};

export const getSpamScoreBreakdown = (userId) => {
	try {
		const analysis = getSpamAnalysis(userId);

		if (analysis.notEnoughData) {
			return {
				spamScore: 0.0,
				indicators: [],
				message:
					"Not enough posts to calculate spam score (minimum 5 required)",
			};
		}

		const user = db
			.prepare("SELECT spam_score FROM users WHERE id = ?")
			.get(userId);

		return {
			spamScore: user?.spam_score || 0.0,
			message:
				(user?.spam_score || 0) > 0.5
					? "High spam score - account behavior is suspicious"
					: (user?.spam_score || 0) > 0.3
						? "Moderate spam score - some concerning patterns detected"
						: "Normal account behavior",
		};
	} catch (error) {
		console.error("Error getting spam score breakdown:", error);
		return {
			spamScore: 0.0,
			indicators: [],
			message: "Error calculating spam score",
		};
	}
};

export const calculateSpamScoreWithDetails = (userId) => {
	const analysis = getSpamAnalysis(userId);

	if (analysis.notEnoughData) {
		return {
			spamScore: 0.0,
			indicators: [],
			message: "Not enough posts to calculate spam score (minimum 5 required)",
		};
	}

	if (analysis.error) {
		return {
			spamScore: 0.0,
			indicators: [],
			message: "Error calculating spam score",
		};
	}

	const finalScore = analysis.score;

	return {
		spamScore: finalScore,
		indicators: analysis.indicators,
		message:
			finalScore > 0.5
				? "High spam score - account behavior is suspicious"
				: finalScore > 0.3
					? "Moderate spam score - some concerning patterns detected"
					: finalScore > 0.1
						? "Low spam score - normal account behavior"
						: "Excellent - no spam indicators detected",
	};
};
