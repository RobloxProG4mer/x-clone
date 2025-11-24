import db from "../db.js";

const updateSpamScore = db.prepare(
	"UPDATE users SET spam_score = ? WHERE id = ?",
);

const getUserPosts = db.prepare(`
  SELECT id, content, created_at 
  FROM posts 
  WHERE user_id = ? 
  ORDER BY created_at DESC 
  LIMIT 50
`);

const normalizeContent = (text) => {
	if (!text) return "";
	return text
		.toLowerCase()
		.replace(/https?:\/\/\S+/g, "")
		.replace(/\s+/g, " ")
		.trim();
};

export const calculateSpamScore = (userId) => {
	try {
		const posts = getUserPosts.all(userId);

		if (posts.length < 5) {
			return 0.0;
		}

		let spamIndicators = 0;
		let totalChecks = 0;

		const recentPosts = posts.slice(0, 20);
		const contentMap = new Map();

		for (const post of recentPosts) {
			const normalized = normalizeContent(post.content);
			if (!normalized) continue;

			const count = contentMap.get(normalized) || 0;
			contentMap.set(normalized, count + 1);
		}

		let duplicateCount = 0;
		for (const count of contentMap.values()) {
			if (count > 1) {
				duplicateCount += count - 1;
			}
		}

		const duplicateRatio = duplicateCount / recentPosts.length;
		if (duplicateRatio > 0.3) spamIndicators++;
		if (duplicateRatio > 0.5) spamIndicators++;
		totalChecks += 2;

		const oneHourAgo = Date.now() - 3600000;
		const postsInLastHour = posts.filter(
			(p) => new Date(p.created_at).getTime() > oneHourAgo,
		).length;

		if (postsInLastHour > 20) spamIndicators += 2;
		else if (postsInLastHour > 10) spamIndicators++;
		totalChecks += 2;

		const urlPattern = /https?:\/\/\S+/g;
		const urlCounts = posts.slice(0, 10).map((p) => {
			const matches = p.content.match(urlPattern);
			return matches ? matches.length : 0;
		});
		const avgUrls =
			urlCounts.reduce((a, b) => a + b, 0) / Math.max(urlCounts.length, 1);

		if (avgUrls > 2) spamIndicators++;
		if (avgUrls > 3) spamIndicators++;
		totalChecks += 2;

		const shortPostCount = posts
			.slice(0, 20)
			.filter((p) => p.content.length < 10).length;
		const shortPostRatio = shortPostCount / Math.min(posts.length, 20);

		if (shortPostRatio > 0.7) spamIndicators++;
		totalChecks += 1;

		const spamScore = Math.min(1.0, spamIndicators / totalChecks);

		updateSpamScore.run(spamScore, userId);

		return spamScore;
	} catch (error) {
		console.error("Error calculating spam score:", error);
		return 0.0;
	}
};

export const updateUserSpamScore = (userId) => {
	return calculateSpamScore(userId);
};
