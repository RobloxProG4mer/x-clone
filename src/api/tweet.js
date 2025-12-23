import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import db from "./../db.js";
import { generateAIResponse } from "../helpers/ai-assistant.js";
import { checkMultipleRateLimits } from "../helpers/customRateLimit.js";
import { extractUrls, getOrFetchLinkPreview } from "../helpers/link-preview.js";
import ratelimit from "../helpers/ratelimit.js";
import { updateUserSpamScore } from "../helpers/spam-detection.js";
import { addNotification } from "./notifications.js";

const JWT_SECRET = process.env.JWT_SECRET;

const getIdentifier = (headers) => {
	const token = headers.authorization?.split(" ")[1];
	const ip =
		headers["cf-connecting-ip"] ||
		headers["x-forwarded-for"]?.split(",")[0] ||
		"0.0.0.0";
	return token || ip;
};

const getUserByUsername = db.query(
	"SELECT id, username, name, avatar, verified, gold, gray, admin, avatar_radius, character_limit, restricted, suspended, affiliate, affiliate_with, checkmark_outline, avatar_outline, selected_community_tag FROM users WHERE LOWER(username) = LOWER(?)",
);

const checkReplyPermission = async (replier, originalAuthor, restriction) => {
	if (replier.id === originalAuthor.id) {
		return true;
	}

	switch (restriction) {
		case "followers": {
			const isFollower = db
				.query(
					"SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?",
				)
				.get(replier.id, originalAuthor.id);
			return !!isFollower;
		}

		case "following": {
			const isFollowing = db
				.query(
					"SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?",
				)
				.get(originalAuthor.id, replier.id);
			return !!isFollowing;
		}

		case "verified":
			return !!replier.verified || !!replier.gold;

		default:
			return true;
	}
};

const getPOSTById = db.query(`
  SELECT *
  FROM posts 
  WHERE posts.id = ?
`);

const countBulkDeletablePOSTS = db.query(`
	SELECT COUNT(*) as total
	FROM posts
	WHERE user_id = ?
		AND datetime(created_at) >= datetime(?)
		AND datetime(created_at) <= datetime(?)
		AND (? = 1 OR reply_to IS NULL)
		AND (? = 0 OR pinned = 0)
`);

const getBulkDeletablePOSTIds = db.query(`
	SELECT id
	FROM posts
	WHERE user_id = ?
		AND datetime(created_at) >= datetime(?)
		AND datetime(created_at) <= datetime(?)
		AND (? = 1 OR reply_to IS NULL)
		AND (? = 0 OR pinned = 0)
	ORDER BY created_at ASC
	LIMIT ?
`);

const isSuspendedQuery = db.query(`
  SELECT * FROM suspensions WHERE user_id = ? AND status = 'active' AND action = 'suspend' AND (expires_at IS NULL OR expires_at > datetime('now'))
`);

const getUserSuspendedFlag = db.query(`
  SELECT suspended FROM users WHERE id = ?
`);
const getUserShadowbannedFlag = db.query(`
	SELECT shadowbanned FROM users WHERE id = ?
`);
const isShadowbannedQuery = db.query(`
	SELECT * FROM suspensions WHERE user_id = ? AND status = 'active' AND action = 'shadowban' AND (expires_at IS NULL OR expires_at > datetime('now'))
`);

const isUserSuspendedById = (userId) => {
	const suspensionRow = isSuspendedQuery.get(userId);
	const userSuspFlag = getUserSuspendedFlag.get(userId);
	return !!suspensionRow || !!userSuspFlag?.suspended;
};

const isUserShadowbannedById = (userId) => {
	const row = isShadowbannedQuery.get(userId);
	const flag = getUserShadowbannedFlag.get(userId);
	return !!row || !!flag?.shadowbanned;
};

const getArticlePreviewById = db.query(`
	SELECT *
	FROM posts
	WHERE id = ? AND is_article = TRUE
`);

const getUserById = db.query(
	"SELECT id, username, name, avatar, verified, gold, gray, avatar_radius, affiliate, affiliate_with, selected_community_tag, checkmark_outline, avatar_outline FROM users WHERE id = ?",
);

const getPOSTWithThread = db.query(`
  WITH RECURSIVE thread_posts AS (
    SELECT *, 0 AS level
    FROM posts
    WHERE id = ?

    UNION ALL

    SELECT p.*, tp.level + 1
    FROM posts p
    JOIN thread_posts tp ON tp.reply_to = p.id
    WHERE tp.level < 10
)
SELECT *
FROM thread_posts
ORDER BY level DESC, created_at ASC;
`);

const createPOST = db.query(`
	INSERT INTO posts (id, user_id, content, reply_to, source, poll_id, quote_POST_id, reply_restriction, article_id, community_id, community_only, outline) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	RETURNING *
`);

const saveAttachment = db.query(`
  INSERT INTO attachments (id, post_id, file_hash, file_name, file_type, file_size, file_url, is_spoiler)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  RETURNING *
`);

const getAttachmentsByPostId = db.query(`
  SELECT * FROM attachments WHERE post_id = ?
`);

const updateQuoteCount = db.query(`
  UPDATE posts SET quote_count = quote_count + ? WHERE id = ?
`);

const getQuotedPOST = db.query(`
  SELECT posts.*, users.username, users.name, users.avatar, users.verified, users.gold, users.gray, users.avatar_radius, users.affiliate, users.affiliate_with, users.checkmark_outline, users.avatar_outline, users.label_type
  FROM posts
  JOIN users ON posts.user_id = users.id
  WHERE posts.id = ?
`);

const createPoll = db.query(`
  INSERT INTO polls (id, post_id, expires_at)
  VALUES (?, ?, ?)
  RETURNING *
`);

const createPollOption = db.query(`
  INSERT INTO poll_options (id, poll_id, option_text, option_order)
  VALUES (?, ?, ?, ?)
  RETURNING *
`);

const getPollByPostId = db.query(`
  SELECT * FROM polls WHERE post_id = ?
`);

const getPollOptions = db.query(`
  SELECT * FROM poll_options WHERE poll_id = ? ORDER BY option_order ASC
`);

const getUserPollVote = db.query(`
  SELECT option_id FROM poll_votes WHERE user_id = ? AND poll_id = ?
`);

const castPollVote = db.query(`
  INSERT OR REPLACE INTO poll_votes (id, user_id, poll_id, option_id)
  VALUES (?, ?, ?, ?)
`);

const updateOptionVoteCount = db.query(`
  UPDATE poll_options SET vote_count = vote_count + ? WHERE id = ?
`);

const getTotalPollVotes = db.query(`
  SELECT SUM(vote_count) as total FROM poll_options WHERE poll_id = ?
`);

const getPollVoters = db.query(`
  SELECT DISTINCT users.username, users.name, users.avatar, users.verified, users.gold, users.avatar_radius, users.label_type
  FROM poll_votes 
  JOIN users ON poll_votes.user_id = users.id 
  WHERE poll_votes.poll_id = ?
  ORDER BY poll_votes.created_at DESC
  LIMIT 10
`);

const getPollDataForPOST = (POSTId, userId) => {
	const poll = getPollByPostId.get(POSTId);
	if (!poll) return null;

	const options = getPollOptions.all(poll.id);
	const totalVotes = getTotalPollVotes.get(poll.id)?.total || 0;
	const userVote = userId ? getUserPollVote.get(userId, poll.id) : null;
	const isExpired = new Date() > new Date(poll.expires_at);
	const voters = getPollVoters.all(poll.id);

	return {
		...poll,
		options: options.map((option) => ({
			...option,
			percentage:
				totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0,
		})),
		totalVotes,
		userVote: userVote?.option_id || null,
		isExpired,
		voters,
	};
};

const getPOSTAttachments = (POSTId) => {
	return getAttachmentsByPostId.all(POSTId);
};

const getFactCheckForPost = db.query(`
  SELECT fc.*, u.username as admin_username, u.name as admin_name
  FROM fact_checks fc
  JOIN users u ON fc.created_by = u.id
  WHERE fc.post_id = ?
  LIMIT 1
`);

const summarizeArticle = (article) => {
	if (!article) return "";
	const trimmedContent = article.content?.trim();
	if (trimmedContent) {
		return trimmedContent;
	}
	if (!article.article_body_markdown) {
		return "";
	}
	const stripped = article.article_body_markdown
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`[^`]*`/g, " ")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/[>#*_~]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (stripped.length <= 260) {
		return stripped;
	}
	return `${stripped.slice(0, 257)}…`;
};

const getQuotedPOSTData = (quotePOSTId, userId) => {
	if (!quotePOSTId) return null;

	const quotedPOST = getQuotedPOST.get(quotePOSTId);
	if (!quotedPOST) return null;

	const authorSuspended = isUserSuspendedById(quotedPOST.user_id);
	const authorShadowbanned = isUserShadowbannedById(quotedPOST.user_id);
	if (authorSuspended) {
		return {
			id: quotedPOST.id,
			unavailable_reason: "suspended",
			created_at: quotedPOST.created_at,
		};
	}
	if (authorShadowbanned) {
		const viewer = userId ? getUserById.get(userId) : null;
		if (!(viewer && (viewer.id === quotedPOST.user_id || viewer.admin))) {
			return {
				id: quotedPOST.id,
				unavailable_reason: "shadowbanned",
				created_at: quotedPOST.created_at,
			};
		}
	}

	const author = {
		username: quotedPOST.username,
		name: quotedPOST.name,
		avatar: quotedPOST.avatar,
		verified: quotedPOST.verified || false,
		gold: quotedPOST.gold || false,
		gray: quotedPOST.gray || false,
		avatar_radius: quotedPOST.avatar_radius || null,
		checkmark_outline: quotedPOST.checkmark_outline || null,
		avatar_outline: quotedPOST.avatar_outline || null,
		affiliate: quotedPOST.affiliate || false,
		affiliate_with: quotedPOST.affiliate_with || null,
	};

	if (author.affiliate && author.affiliate_with) {
		const affiliateProfile = getUserById.get(author.affiliate_with);
		if (affiliateProfile) {
			author.affiliate_with_profile = affiliateProfile;
		}
	}

	return {
		...quotedPOST,
		author,
		poll: getPollDataForPOST(quotedPOST.id, userId),
		attachments: getPOSTAttachments(quotedPOST.id),
		interactive_card: getCardDataForPOST(quotedPOST.id),
	};
};

const updatePostCounts = db.query(`
  UPDATE posts SET reply_count = reply_count + 1 WHERE id = ?
`);

const checkLikeExists = db.query(`
  SELECT id FROM likes WHERE user_id = ? AND post_id = ?
`);

const addLike = db.query(`
  INSERT INTO likes (id, user_id, post_id) VALUES (?, ?, ?)
`);

const removeLike = db.query(`
  DELETE FROM likes WHERE user_id = ? AND post_id = ?
`);

const updateLikeCount = db.query(`
  UPDATE posts SET like_count = like_count + ? WHERE id = ?
`);

const checkrePOSTExists = db.query(`
  SELECT id FROM rePOSTS WHERE user_id = ? AND post_id = ?
`);

const addrePOST = db.query(`
  INSERT INTO rePOSTS (id, user_id, post_id) VALUES (?, ?, ?)
`);

const removerePOST = db.query(`
  DELETE FROM rePOSTS WHERE user_id = ? AND post_id = ?
`);

const updaterePOSTCount = db.query(`
  UPDATE posts SET rePOST_count = rePOST_count + ? WHERE id = ?
`);

const getPOSTLikers = db.query(`
  SELECT u.id, u.username, u.name, u.avatar, u.verified, l.created_at as liked_at
  FROM likes l
  JOIN users u ON l.user_id = u.id
  WHERE l.post_id = ?
  ORDER BY l.created_at DESC
  LIMIT ?
`);

const getPOSTrePOSTers = db.query(`
  SELECT u.id, u.username, u.name, u.avatar, u.verified, r.created_at as rePOSTed_at
  FROM rePOSTS r
  JOIN users u ON r.user_id = u.id
  WHERE r.post_id = ?
  ORDER BY r.created_at DESC
  LIMIT ?
`);

const getPOSTQuoters = db.query(`
  SELECT u.id, u.username, u.name, u.avatar, u.verified, p.created_at as quoted_at, p.id as quote_POST_id, p.content as quote_content
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE p.quote_POST_id = ?
  ORDER BY p.created_at DESC
  LIMIT ?
`);

const checkReactionExists = db.query(`
  SELECT id FROM post_reactions WHERE user_id = ? AND post_id = ? AND emoji = ?
`);

const addReaction = db.query(`
  INSERT INTO post_reactions (id, post_id, user_id, emoji) VALUES (?, ?, ?, ?)
`);

const removeReaction = db.query(`
  DELETE FROM post_reactions WHERE user_id = ? AND post_id = ? AND emoji = ?
`);

const countReactionsForPost = db.query(`
  SELECT COUNT(*) as total FROM post_reactions WHERE post_id = ?
`);

const listReactionsForPost = db.query(`
  SELECT pr.emoji, u.id as user_id, u.username, u.name, u.avatar
  FROM post_reactions pr
  JOIN users u ON pr.user_id = u.id
  WHERE pr.post_id = ?
  ORDER BY pr.created_at DESC
  LIMIT ?
`);

const getTopReactionsForPost = db.query(`
  SELECT emoji, COUNT(*) as count
  FROM post_reactions
  WHERE post_id = ?
  GROUP BY emoji
  ORDER BY count DESC
  LIMIT 2
`);

const createInteractiveCard = db.query(`
  INSERT INTO interactive_cards (id, post_id, media_type, media_url)
  VALUES (?, ?, ?, ?)
  RETURNING *
`);

const createCardOption = db.query(`
  INSERT INTO interactive_card_options (id, card_id, description, POST_text, option_order)
  VALUES (?, ?, ?, ?, ?)
  RETURNING *
`);

const getCardByPostId = db.query(`
  SELECT * FROM interactive_cards WHERE post_id = ?
`);

const getCardOptions = db.query(`
  SELECT * FROM interactive_card_options WHERE card_id = ? ORDER BY option_order ASC
`);

const getCardDataForPOST = (POSTId) => {
	const card = getCardByPostId.get(POSTId);
	if (!card) return null;

	const options = getCardOptions.all(card.id);
	return {
		...card,
		options,
	};
};

const getLinkPreviewsByPostIds = (postIds) => {
	if (!postIds.length) return [];
	const placeholders = postIds.map(() => "?").join(",");
	return db
		.query(`SELECT * FROM link_previews WHERE post_id IN (${placeholders})`)
		.all(...postIds);
};

export default new Elysia({ prefix: "/POSTS", tags: ["POSTS"] })
	.use(jwt({ name: "jwt", secret: JWT_SECRET }))
	.use(
		rateLimit({
			duration: 240_000,
			max: 150,
			scoping: "scoped",
			generator: ratelimit,
		}),
	)
	.post("/", async ({ jwt, headers, body, set }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		const identifier = getIdentifier(headers);
		const isReply = !!body.reply_to;
		if (isReply) {
			const rateCheck = checkMultipleRateLimits(identifier, [
				"reply",
				"rapid_reply",
			]);
			if (rateCheck.isLimited) {
				set.status = 429;
				if (rateCheck.limitType === "rapid_reply") {
					return {
						error: "Please solve the captcha to continue",
						captcha_required: true,
						resetIn: rateCheck.resetIn,
					};
				}
				return { error: "Too many requests", resetIn: rateCheck.resetIn };
			}
		} else {
			const rateCheck = checkMultipleRateLimits(identifier, [
				"post",
				"rapid_post",
			]);
			if (rateCheck.isLimited) {
				set.status = 429;
				if (rateCheck.limitType === "rapid_post") {
					return {
						error: "Please solve the captcha to continue",
						captcha_required: true,
						resetIn: rateCheck.resetIn,
					};
				}
				return { error: "Too many requests", resetIn: rateCheck.resetIn };
			}
		}

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const {
				content,
				reply_to,
				source,
				poll,
				quote_POST_id,
				files,
				reply_restriction,
				gif_url,
				article_id,
				community_id,
				community_only,
				spoiler_flags,
				interactive_card,
				ai_vibe,
				unsplash,
				unsplash_images,
				emoji_kitchen_url,
				outline,
			} = body;
			const POSTContent = typeof content === "string" ? content : "";
			const trimmedContent = POSTContent.trim();
			const hasAttachments = Array.isArray(files) && files.length > 0;
			const hasBody = trimmedContent.length > 0;
			const targetArticleId = article_id ? String(article_id) : null;

			const effectiveUserId = user.id;

			if (community_id) {
				const isMember = db
					.query(
						"SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ? AND banned = FALSE",
					)
					.get(community_id, effectiveUserId);

				if (!isMember) {
					return { error: "You must be a community member to post here" };
				}
			}

			if (interactive_card && !user.verified && !user.gold) {
				return { error: "Only verified users can create interactive cards" };
			}

			if (interactive_card) {
				if (!interactive_card.media_url || !interactive_card.media_type) {
					return { error: "Card media is required" };
				}
				if (!["image", "video", "gif"].includes(interactive_card.media_type)) {
					return { error: "Invalid media type for card" };
				}
				if (
					!interactive_card.options ||
					!Array.isArray(interactive_card.options) ||
					interactive_card.options.length < 2 ||
					interactive_card.options.length > 4
				) {
					return { error: "Card must have 2-4 options" };
				}
				for (const option of interactive_card.options) {
					if (!option.description || !option.POST_text) {
						return {
							error: "Each option must have description and POST text",
						};
					}
					if (option.description.length > 100) {
						return {
							error: "Option description must be 100 characters or less",
						};
					}
					if (option.POST_text.length > 280) {
						return {
							error: "Option POST text must be 280 characters or less",
						};
					}
				}
			}

			const hasUnsplashImages =
				Array.isArray(unsplash_images) && unsplash_images.length > 0;

			if (files && Array.isArray(files)) {
				const totalSize = files.reduce(
					(sum, file) => sum + (file.size || 0),
					0,
				);
				const maxTotalSize = 30 * 1024 * 1024;
				if (totalSize > maxTotalSize) {
					const totalSizeMB = (totalSize / 1024 / 1024).toFixed(1);
					return {
						error: `Total upload size is ${totalSizeMB}MB. Maximum total size is 30MB`,
					};
				}
			}

			if (
				!hasBody &&
				!hasAttachments &&
				!gif_url &&
				!poll &&
				!interactive_card &&
				!targetArticleId &&
				!unsplash &&
				!hasUnsplashImages &&
				!emoji_kitchen_url
			) {
				return { error: "POST content is required" };
			}

			let referencedArticle = null;
			if (targetArticleId) {
				referencedArticle = getArticlePreviewById.get(targetArticleId);
				if (!referencedArticle) {
					return { error: "Article not found" };
				}
			}

			let maxPOSTLength = user.character_limit || 400;
			if (!user.character_limit) {
				maxPOSTLength = user.gray
					? 37500
					: user.gold
						? 16500
						: user.verified
							? 5500
							: 400;
			}
			if (trimmedContent.length > maxPOSTLength) {
				return {
					error: `POST content must be ${maxPOSTLength} characters or less`,
				};
			}

			if (gif_url) {
				if (
					typeof gif_url !== "string" ||
					!gif_url.startsWith(
						process.env.TENOR_MEDIA_HOST || "https://media.tenor.com/",
					)
				) {
					return { error: "Invalid GIF URL" };
				}
			}

			if (emoji_kitchen_url) {
				if (
					typeof emoji_kitchen_url !== "string" ||
					!emoji_kitchen_url.startsWith("https://emojik.vercel.app/s/")
				) {
					return { error: "Invalid emoji kitchen URL" };
				}
			}

			const validRestrictions = [
				"everyone",
				"followers",
				"following",
				"verified",
			];
			const replyRestriction =
				reply_restriction && validRestrictions.includes(reply_restriction)
					? reply_restriction
					: "everyone";

			if (
				poll &&
				(!poll.options || poll.options.length < 2 || poll.options.length > 4)
			) {
				return { error: "Poll must have between 2 and 4 options" };
			}

			if (
				poll?.options?.some((option) => !option.trim() || option.length > 100)
			) {
				return { error: "Poll options must be 1-100 characters long" };
			}

			if (
				poll &&
				(!poll.duration || poll.duration < 5 || poll.duration > 10080)
			) {
				return { error: "Poll duration must be between 5 minutes and 7 days" };
			}

			if (reply_to) {
				const originalPOST = getPOSTById.get(reply_to);
				if (!originalPOST) {
					return { error: "Original POST not found" };
				}
				// If the original POST's author is suspended, do not allow replies.
				if (isUserSuspendedById(originalPOST.user_id)) {
					return { error: "POST not found" };
				}
				const originalAuthor = db
					.query("SELECT id, username, verified, gold FROM users WHERE id = ?")
					.get(originalPOST.user_id);

				const isBlocked = db
					.query(
						"SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)",
					)
					.get(user.id, originalAuthor.id, originalAuthor.id, user.id);

				if (isBlocked) {
					return { error: "You cannot reply to this POST" };
				}

				if (
					originalPOST.reply_restriction &&
					originalPOST.reply_restriction !== "everyone"
				) {
					// Check if user can reply based on restriction
					const canReply = await checkReplyPermission(
						user,
						originalAuthor,
						originalPOST.reply_restriction,
					);
					if (!canReply) {
						return {
							error: "You don't have permission to reply to this POST",
						};
					}
				}
			}

			const POSTId = Bun.randomUUIDv7().split("-").pop();
			let pollId = null;

			if (poll) {
				pollId = Bun.randomUUIDv7();
				const expiresAt = new Date(
					Date.now() + poll.duration * 60 * 1000,
				).toISOString();

				createPoll.run(pollId, POSTId, expiresAt);

				poll.options.forEach((option, index) => {
					const optionId = Bun.randomUUIDv7();
					createPollOption.run(optionId, pollId, option.trim(), index);
				});
			}

			const POSTOutline = user.gray && outline ? outline : null;

			const POST = createPOST.get(
				POSTId,
				effectiveUserId,
				trimmedContent,
				reply_to || null,
				source || null,
				pollId,
				quote_POST_id || null,
				replyRestriction,
				targetArticleId,
				community_id || null,
				community_only || false,
				POSTOutline,
			);

			if (reply_to) {
				updatePostCounts.run(reply_to);
				const originalPOST = getPOSTById.get(reply_to);
				if (originalPOST && originalPOST.user_id !== user.id) {
					addNotification(
						originalPOST.user_id,
						"reply",
						`${user.name || user.username} replied to your POST`,
						POSTId,
						user.id,
						user.username,
						user.name || user.username,
					);
				}
			}
			if (quote_POST_id) {
				const quotedPOST = getPOSTById.get(quote_POST_id);
				if (quotedPOST && !isUserSuspendedById(quotedPOST.user_id)) {
					updateQuoteCount.run(1, quote_POST_id);
					if (quotedPOST.user_id !== user.id) {
						addNotification(
							quotedPOST.user_id,
							"quote",
							`${user.name || user.username} quoted your POST`,
							POSTId,
							user.id,
							user.username,
							user.name || user.username,
						);
					}
				}
			}

			const mentionRegex = /@(\w+)/g;
			const mentions = new Set();
			if (POSTContent && typeof POSTContent === "string") {
				let match;
				mentionRegex.lastIndex = 0;
				match = mentionRegex.exec(POSTContent);
				while (match !== null) {
					mentions.add(match[1]);
					match = mentionRegex.exec(POSTContent);
				}
			}

			for (const mentionedUsername of mentions) {
				if (mentionedUsername.toLowerCase() === user.username.toLowerCase())
					continue;

				const mentionedUser = getUserByUsername.get(mentionedUsername);
				if (mentionedUser) {
					addNotification(
						mentionedUser.id,
						"mention",
						`${user.name || user.username} mentioned you in a POST`,
						POSTId,
						user.id,
						user.username,
						user.name || user.username,
					);
				}
			}

			const shouldTriggerAI = mentions.has("h") || mentions.has("H");
			let isReplyToAIThread = false;

			if (!shouldTriggerAI && reply_to) {
				const aiUser = getUserByUsername.get("h");
				if (aiUser) {
					const threadPosts = getPOSTWithThread.all(reply_to);
					isReplyToAIThread = threadPosts.some(
						(post) => post.user_id === aiUser.id,
					);
				}
			}

			if (shouldTriggerAI || isReplyToAIThread) {
				const aiUser = getUserByUsername.get("h");
				if (aiUser) {
					(async () => {
						try {
							const vibe = ai_vibe || "normal";
							const aiResponse = await generateAIResponse(
								POSTId,
								trimmedContent,
								db,
								vibe,
							);
							if (aiResponse) {
								const aiPOSTId = Bun.randomUUIDv7().split("-").pop();
								createPOST.get(
									aiPOSTId,
									aiUser.id,
									aiResponse,
									POSTId,
									null,
									null,
									null,
									"everyone",
									null,
									null,
									false,
									null,
								);
								updatePostCounts.run(POSTId);
								addNotification(
									user.id,
									"reply",
									`${aiUser.name || aiUser.username} replied to your POST`,
									aiPOSTId,
									aiUser.id,
									aiUser.username,
									aiUser.name || aiUser.username,
								);
							}
						} catch (error) {
							console.error("Failed to generate AI response:", error);
						}
					})();
				}
			}

			const attachments = [];
			if (files && Array.isArray(files)) {
				files.forEach((file, index) => {
					const attachmentId = Bun.randomUUIDv7();
					const isSpoiler =
						Array.isArray(spoiler_flags) && spoiler_flags.includes(index);
					const attachment = saveAttachment.get(
						attachmentId,
						POSTId,
						file.hash,
						file.name,
						file.type,
						file.size,
						file.url,
						isSpoiler,
					);
					attachments.push(attachment);
				});
			}

			if (gif_url) {
				const attachmentId = Bun.randomUUIDv7();
				const attachment = saveAttachment.get(
					attachmentId,
					POSTId,
					null,
					"tenor.gif",
					"image/gif",
					0,
					gif_url,
					false,
				);
				attachments.push(attachment);
			}

			if (unsplash) {
				const attachmentId = Bun.randomUUIDv7();
				const attributionData = JSON.stringify({
					user_name: unsplash.photographer_name,
					user_username: unsplash.photographer_username,
					user_link: unsplash.photographer_url,
					download_location: unsplash.download_location,
				});

				const attachment = saveAttachment.get(
					attachmentId,
					POSTId,
					attributionData,
					"unsplash.jpg",
					"image/jpeg",
					0,
					unsplash.url,
					false,
				);
				attachments.push(attachment);

				if (unsplash.download_location) {
					fetch(unsplash.download_location, {
						headers: {
							Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
						},
					}).catch((err) =>
						console.error("Failed to track unsplash download on post:", err),
					);
				}
			}

			if (hasUnsplashImages) {
				for (const unsplashImg of unsplash_images) {
					const attachmentId = Bun.randomUUIDv7();
					const attributionData = JSON.stringify({
						user_name: unsplashImg.photographer_name,
						user_username: unsplashImg.photographer_username,
						user_link: unsplashImg.photographer_url,
						download_location: unsplashImg.download_location,
					});

					const attachment = saveAttachment.get(
						attachmentId,
						POSTId,
						attributionData,
						"unsplash.jpg",
						"image/jpeg",
						0,
						unsplashImg.url,
						false,
					);
					attachments.push(attachment);

					if (unsplashImg.download_location) {
						fetch(unsplashImg.download_location, {
							headers: {
								Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
							},
						}).catch((err) =>
							console.error("Failed to track unsplash download on post:", err),
						);
					}
				}
			}

			if (emoji_kitchen_url) {
				const attachmentId = Bun.randomUUIDv7();
				const attachment = saveAttachment.get(
					attachmentId,
					POSTId,
					null,
					"emoji_kitchen.webp",
					"image/webp",
					0,
					emoji_kitchen_url,
					false,
				);
				attachments.push(attachment);
			}

			let articlePreview = null;
			if (targetArticleId) {
				if (!referencedArticle) {
					referencedArticle = getArticlePreviewById.get(targetArticleId);
				}
				if (referencedArticle) {
					const articleAuthor = getUserById.get(referencedArticle.user_id);
					const articleAttachments = getPOSTAttachments(referencedArticle.id);
					articlePreview = {
						...referencedArticle,
						author: articleAuthor || null,
						attachments: articleAttachments,
						cover:
							articleAttachments.find((item) =>
								item.file_type.startsWith("image/"),
							) || null,
						excerpt: summarizeArticle(referencedArticle),
					};
				}
			}

			let cardData = null;
			if (interactive_card) {
				const cardId = Bun.randomUUIDv7();
				const card = createInteractiveCard.get(
					cardId,
					POSTId,
					interactive_card.media_type,
					interactive_card.media_url,
				);

				const cardOptions = [];
				interactive_card.options.forEach((option, index) => {
					const optionId = Bun.randomUUIDv7();
					const savedOption = createCardOption.get(
						optionId,
						cardId,
						option.description.trim(),
						option.POST_text.trim(),
						index,
					);
					cardOptions.push(savedOption);
				});

				cardData = {
					...card,
					options: cardOptions,
				};
			}

			let linkPreview = null;
			if (
				!quote_POST_id &&
				attachments.length === 0 &&
				!interactive_card &&
				!targetArticleId
			) {
				const urls = extractUrls(trimmedContent);
				const externalUrls = urls.filter(
					(url) =>
						!url.includes(process.env.BASE_URL || "localhost") &&
						!url.includes("tenor.com") &&
						!url.includes("unsplash.com"),
				);

				if (externalUrls.length > 0) {
					linkPreview = await getOrFetchLinkPreview(externalUrls[0], POSTId);
				}
			}

			const effectiveUser =
				effectiveUserId !== user.id ? getUserById.get(effectiveUserId) : user;

			let affiliateWithProfile = null;
			if (effectiveUser.affiliate && effectiveUser.affiliate_with) {
				affiliateWithProfile = getUserById.get(effectiveUser.affiliate_with);
			}

			let communityTag = null;
			if (effectiveUser.selected_community_tag) {
				const community = db
					.query(
						"SELECT id, name, tag_enabled, tag_emoji, tag_text FROM communities WHERE id = ?",
					)
					.get(effectiveUser.selected_community_tag);
				if (community?.tag_enabled) {
					communityTag = {
						community_id: community.id,
						community_name: community.name,
						emoji: community.tag_emoji,
						text: community.tag_text,
					};
				}
			}

			setTimeout(() => {
				try {
					updateUserSpamScore(effectiveUserId);
				} catch (err) {
					console.error("Failed to update spam score:", err);
				}
			}, 0);

			return {
				success: true,
				POST: {
					...POST,
					author: {
						...effectiveUser,
						affiliate_with_profile: affiliateWithProfile,
						community_tag: communityTag,
					},
					liked_by_user: false,
					rePOSTed_by_user: false,
					poll: getPollDataForPOST(POST.id, user.id),
					attachments: attachments,
					article_preview: articlePreview,
					interactive_card: cardData,
					link_preview: linkPreview,
				},
			};
		} catch (error) {
			console.error("POST creation error:", error);
			return { error: "Failed to create POST" };
		}
	})
	.post("/:id/reaction", async ({ jwt, headers, params, body }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const { id: POSTId } = params;
			const { emoji } = body || {};
			if (!emoji || typeof emoji !== "string")
				return { error: "Emoji is required" };

			const POST = getPOSTById.get(POSTId);
			if (!POST) return { error: "POST not found" };
			if (isUserSuspendedById(POST.user_id)) {
				return { error: "POST not found" };
			}

			const blockCheck = db
				.query(
					"SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) ",
				)
				.get(user.id, POST.user_id, POST.user_id, user.id);
			if (blockCheck) {
				return { error: "You cannot interact with this user" };
			}

			const existing = checkReactionExists.get(user.id, POSTId, emoji);

			if (existing) {
				removeReaction.run(user.id, POSTId, emoji);
				const total = countReactionsForPost.get(POSTId)?.total || 0;
				const topReactions = getTopReactionsForPost.all(POSTId);
				return {
					success: true,
					reacted: false,
					total_reactions: total,
					top_reactions: topReactions,
				};
			} else {
				const reactionId = Bun.randomUUIDv7();
				addReaction.run(reactionId, POSTId, user.id, emoji);
				const total = countReactionsForPost.get(POSTId)?.total || 0;
				const topReactions = getTopReactionsForPost.all(POSTId);

				if (POST.user_id !== user.id) {
					addNotification(
						POST.user_id,
						"reaction",
						`${user.name || user.username} reacted to your POST`,
						POSTId,
						user.id,
						user.username,
						user.name || user.username,
					);
				}

				return {
					success: true,
					reacted: true,
					total_reactions: total,
					top_reactions: topReactions,
				};
			}
		} catch (err) {
			console.error("Reaction toggle error:", err);
			return { error: "Failed to toggle reaction" };
		}
	})
	.get("/:id/reactions", async ({ jwt, headers, params, query }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const { id } = params;
			const { limit = 50 } = query;

			const POST = getPOSTById.get(id);
			if (!POST) return { error: "POST not found" };

			const reactions = listReactionsForPost.all(id, parseInt(limit, 10));
			const total = countReactionsForPost.get(id)?.total || 0;
			const topReactions = getTopReactionsForPost.all(id);

			return {
				success: true,
				reactions,
				total_reactions: total,
				top_reactions: topReactions,
			};
		} catch (err) {
			console.error("Get reactions error:", err);
			return { error: "Failed to get reactions" };
		}
	})
	.get("/:id", async ({ params, jwt, headers, query }) => {
		const { id } = params;
		const { offset = 0, limit = 20 } = query;

		const authorization = headers.authorization;
		if (!authorization) return { error: "Unauthorized" };

		let currentUser = null;
		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (payload) {
				currentUser = getUserByUsername.get(payload.username);
			}
		} catch {
			return { error: "Invalid token" };
		}

		const POST = getPOSTById.get(id);
		if (!POST) {
			return { error: "POST not found" };
		}

		if (isUserSuspendedById(POST.user_id)) {
			return { error: "POST not found" };
		}

		if (currentUser) {
			setTimeout(() => {
				db.query(
					"UPDATE posts SET view_count = view_count + 1 WHERE id = ?",
				).run(id);
			}, 100);
		}

		const threadPosts = getPOSTWithThread.all(id);
		let replies = limit
			? db
					.query(`
		SELECT posts.*,
			CASE WHEN posts.user_id = ? THEN 0 ELSE 1 END as is_not_author,
			CASE WHEN EXISTS(SELECT 1 FROM follows WHERE follows.follower_id = ? AND follows.following_id = posts.user_id) THEN 0 ELSE 1 END as is_not_following,
			(posts.like_count + posts.reply_count + posts.rePOST_count) as engagement
		FROM posts
		JOIN users ON posts.user_id = users.id
		WHERE reply_to = ?
		AND (users.suspended = 0)
		AND (users.shadowbanned = 0 OR posts.user_id = ?)
		ORDER BY is_not_author ASC, is_not_following ASC, engagement DESC, posts.created_at ASC
		LIMIT ? OFFSET ?
	`)
					.all(
						POST.user_id,
						currentUser?.id || "0",
						id,
						currentUser?.id || "0",
						parseInt(limit, 10),
						parseInt(offset, 10),
					)
			: [];

		const allPostIds = [
			...threadPosts.map((p) => p.id),
			...replies.map((r) => r.id),
		];
		const postPlaceholders = allPostIds.map(() => "?").join(",");

		const getUserLikesQuery = db.query(
			`SELECT post_id FROM likes WHERE user_id = ? AND post_id IN (${postPlaceholders})`,
		);
		const getUserRePOSTSQuery = db.query(
			`SELECT post_id FROM rePOSTS WHERE user_id = ? AND post_id IN (${postPlaceholders})`,
		);

		const userLikes = currentUser
			? getUserLikesQuery.all(currentUser.id, ...allPostIds)
			: [];
		const userRePOSTS = currentUser
			? getUserRePOSTSQuery.all(currentUser.id, ...allPostIds)
			: [];

		const likedPosts = new Set(userLikes.map((like) => like.post_id));
		const rePOSTedPosts = new Set(
			userRePOSTS.map((rePOST) => rePOST.post_id),
		);

		POST.liked_by_user = likedPosts.has(POST.id);
		POST.rePOSTed_by_user = rePOSTedPosts.has(POST.id);

		const allUserIds = [
			...new Set([
				POST.user_id,
				...threadPosts.map((p) => p.user_id),
				...replies.map((r) => r.user_id),
			]),
		];

		const userPlaceholders = allUserIds.map(() => "?").join(",");
		const getUsersQuery = db.query(
			`SELECT id, username, name, avatar, verified, gold, gray, avatar_radius, checkmark_outline, avatar_outline, affiliate, affiliate_with, selected_community_tag FROM users WHERE id IN (${userPlaceholders})`,
		);
		const users = getUsersQuery.all(...allUserIds);

		users.forEach((user) => {
			if (user.affiliate && user.affiliate_with) {
				const affiliateProfile = getUserById.get(user.affiliate_with);
				if (affiliateProfile) {
					user.affiliate_with_profile = affiliateProfile;
				}
			}

			if (user.selected_community_tag) {
				const community = db
					.query(
						"SELECT id, name, tag_enabled, tag_emoji, tag_text FROM communities WHERE id = ?",
					)
					.get(user.selected_community_tag);
				if (community?.tag_enabled) {
					user.community_tag = {
						community_id: community.id,
						community_name: community.name,
						emoji: community.tag_emoji,
						text: community.tag_text,
					};
				}
			}
		});

		const userMap = new Map(users.map((user) => [user.id, user]));

		if (
			!(currentUser && (currentUser.admin || currentUser.id === POST.user_id))
		) {
			replies = replies.filter((p) => {
				const u = userMap.get(p.user_id);
				return !u || !u.shadowbanned;
			});
		}

		const allPOSTIds = [POST.id, ...allPostIds];
		const POSTIdsPlaceholders = allPOSTIds.map(() => "?").join(",");

		const allAttachments = db
			.query(
				`SELECT * FROM attachments WHERE post_id IN (${POSTIdsPlaceholders})`,
			)
			.all(...allPOSTIds);
		const attachmentMap = new Map();
		allAttachments.forEach((att) => {
			if (!attachmentMap.has(att.post_id)) {
				attachmentMap.set(att.post_id, []);
			}
			attachmentMap.get(att.post_id).push(att);
		});

		const allLinkPreviews = getLinkPreviewsByPostIds(allPOSTIds);
		const linkPreviewMap = new Map(
			allLinkPreviews.map((lp) => [lp.post_id, lp]),
		);

		const allFactChecks = db
			.query(
				`SELECT fc.*, u.username as admin_username, u.name as admin_name
				FROM fact_checks fc
				JOIN users u ON fc.created_by = u.id
				WHERE fc.post_id IN (${POSTIdsPlaceholders})`,
			)
			.all(...allPOSTIds);
		const factCheckMap = new Map(allFactChecks.map((fc) => [fc.post_id, fc]));

		const allInteractiveCards = db
			.query(
				`SELECT * FROM interactive_cards WHERE post_id IN (${POSTIdsPlaceholders})`,
			)
			.all(...allPOSTIds);
		const cardMap = new Map(allInteractiveCards.map((c) => [c.post_id, c]));
		const cardIds = allInteractiveCards.map((c) => c.id);
		const cardOptionsMap = new Map();
		if (cardIds.length > 0) {
			const cardIdPlaceholders = cardIds.map(() => "?").join(",");
			const allCardOptions = db
				.query(
					`SELECT * FROM interactive_card_options WHERE card_id IN (${cardIdPlaceholders}) ORDER BY option_order ASC`,
				)
				.all(...cardIds);
			allCardOptions.forEach((opt) => {
				if (!cardOptionsMap.has(opt.card_id)) {
					cardOptionsMap.set(opt.card_id, []);
				}
				cardOptionsMap.get(opt.card_id).push(opt);
			});
		}

		const articleIds = new Set();
		if (POST.article_id) {
			articleIds.add(POST.article_id);
		}
		threadPosts.forEach((post) => {
			if (post.article_id) {
				articleIds.add(post.article_id);
			}
		});
		replies.forEach((reply) => {
			if (reply.article_id) {
				articleIds.add(reply.article_id);
			}
		});

		let articleMap = new Map();
		if (articleIds.size > 0) {
			const ids = [...articleIds];
			const placeholders = ids.map(() => "?").join(",");
			const articles = db
				.query(
					`SELECT * FROM posts WHERE id IN (${placeholders}) AND is_article = TRUE`,
				)
				.all(...ids);
			const articleUserIds = [
				...new Set(articles.map((article) => article.user_id)),
			];
			const articleUsers = articleUserIds.length
				? db
						.query(
							`SELECT id, username, name, avatar, verified, gold, avatar_radius FROM users WHERE id IN (${articleUserIds
								.map(() => "?")
								.join(",")})`,
						)
						.all(...articleUserIds)
				: [];
			const articleUserMap = new Map(articleUsers.map((u) => [u.id, u]));
			const attachmentPlaceholders = ids.map(() => "?").join(",");
			const articleAttachments = db
				.query(
					`SELECT * FROM attachments WHERE post_id IN (${attachmentPlaceholders})`,
				)
				.all(...ids);
			const attachmentMap = new Map();
			articleAttachments.forEach((attachment) => {
				if (!attachmentMap.has(attachment.post_id)) {
					attachmentMap.set(attachment.post_id, []);
				}
				attachmentMap.get(attachment.post_id).push(attachment);
			});
			articleMap = new Map(
				articles.map((article) => {
					const attachmentsForArticle = attachmentMap.get(article.id) || [];
					return [
						article.id,
						{
							...article,
							author: articleUserMap.get(article.user_id) || null,
							attachments: attachmentsForArticle,
							cover:
								attachmentsForArticle.find((item) =>
									item.file_type.startsWith("image/"),
								) || null,
							excerpt: summarizeArticle(article),
						},
					];
				}),
			);
		}

		const processedThreadPosts = threadPosts
			.filter((post) => {
				const author = userMap.get(post.user_id);

				return author && !author.suspended;
			})
			.map((post) => {
				const card = cardMap.get(post.id);
				return {
					...post,
					liked_by_user: likedPosts.has(post.id),
					rePOSTed_by_user: rePOSTedPosts.has(post.id),
					author: userMap.get(post.user_id),
					poll: getPollDataForPOST(post.id, currentUser?.id || "0"),
					quoted_POST: getQuotedPOSTData(
						post.quote_POST_id,
						currentUser?.id || "0",
					),
					attachments: attachmentMap.get(post.id) || [],
					article_preview: post.article_id
						? articleMap.get(post.article_id) || null
						: null,
					reaction_count: countReactionsForPost.get(post.id)?.total || 0,
					top_reactions: getTopReactionsForPost.all(post.id),
					fact_check: factCheckMap.get(post.id) || null,
					interactive_card: card
						? { ...card, options: cardOptionsMap.get(card.id) || [] }
						: null,
					link_preview: linkPreviewMap.get(post.id) || null,
				};
			});

		const processedReplies = replies
			.filter((reply) => {
				const author = userMap.get(reply.user_id);
				if (!author) return false;
				if (author.suspended) return false;
				if (author.shadowbanned) {
					if (currentUser && currentUser?.id === author.id) return true;
					return false;
				}
				return true;
			})
			.map((reply) => {
				const card = cardMap.get(reply.id);
				return {
					...reply,
					liked_by_user: likedPosts.has(reply.id),
					rePOSTed_by_user: rePOSTedPosts.has(reply.id),
					author: userMap.get(reply.user_id),
					poll: getPollDataForPOST(reply.id, currentUser?.id || "0"),
					quoted_POST: getQuotedPOSTData(
						reply.quote_POST_id,
						currentUser?.id || "0",
					),
					attachments: attachmentMap.get(reply.id) || [],
					article_preview: reply.article_id
						? articleMap.get(reply.article_id) || null
						: null,
					fact_check: factCheckMap.get(reply.id) || null,
					interactive_card: card
						? { ...card, options: cardOptionsMap.get(card.id) || [] }
						: null,
					link_preview: linkPreviewMap.get(reply.id) || null,
				};
			});

		const hasMoreReplies = processedReplies.length >= parseInt(limit, 10);

		const POSTReactionCount = countReactionsForPost.get(POST.id)?.total || 0;
		const POSTTopReactions = getTopReactionsForPost.all(POST.id);
		const POSTCard = cardMap.get(POST.id);

		return {
			POST: {
				...POST,
				author: userMap.get(POST.user_id),
				poll: getPollDataForPOST(POST.id, currentUser?.id || "0"),
				quoted_POST: getQuotedPOSTData(
					POST.quote_POST_id,
					currentUser?.id || "0",
				),
				attachments: attachmentMap.get(POST.id) || [],
				article_preview: POST.article_id
					? articleMap.get(POST.article_id) || null
					: null,
				reaction_count: POSTReactionCount,
				top_reactions: POSTTopReactions,
				fact_check: factCheckMap.get(POST.id) || null,
				interactive_card: POSTCard
					? { ...POSTCard, options: cardOptionsMap.get(POSTCard.id) || [] }
					: null,
				link_preview: linkPreviewMap.get(POST.id) || null,
			},
			threadPosts: processedThreadPosts,
			replies: processedReplies,
			hasMoreReplies,
		};
	})
	.post("/:id/like", async ({ jwt, headers, params, set }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		const identifier = getIdentifier(headers);
		const rateCheck = checkMultipleRateLimits(identifier, [
			"like",
			"rapid_like",
		]);
		if (rateCheck.isLimited) {
			set.status = 429;
			if (rateCheck.limitType === "rapid_like") {
				return {
					error: "Please solve the captcha to continue",
					captcha_required: true,
					resetIn: rateCheck.resetIn,
				};
			}
			return { error: "Too many requests", resetIn: rateCheck.resetIn };
		}

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const { id } = params;
			const POST = getPOSTById.get(id);
			if (!POST) return { error: "POST not found" };

			if (isUserSuspendedById(POST.user_id)) {
				return { error: "POST not found" };
			}

			const blockCheck = db
				.query(
					"SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) ",
				)
				.get(user.id, POST.user_id, POST.user_id, user.id);
			if (blockCheck) {
				return { error: "You cannot interact with this user" };
			}

			const existingLike = checkLikeExists.get(user.id, id);

			if (existingLike) {
				removeLike.run(user.id, id);
				updateLikeCount.run(-1, id);
				return { success: true, liked: false };
			} else {
				const likeId = Bun.randomUUIDv7();
				addLike.run(likeId, user.id, id);
				updateLikeCount.run(1, id);

				const POST = getPOSTById.get(id);
				if (POST && POST.user_id !== user.id) {
					addNotification(
						POST.user_id,
						"like",
						`${user.name || user.username} liked your POST`,
						id,
						user.id,
						user.username,
						user.name || user.username,
					);
				}

				return { success: true, liked: true };
			}
		} catch (error) {
			console.error("Like toggle error:", error);
			return { error: "Failed to toggle like" };
		}
	})
	.post("/:id/rePOST", async ({ jwt, headers, params, set }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		const identifier = getIdentifier(headers);
		const rateCheck = checkMultipleRateLimits(identifier, [
			"rePOST",
			"rapid_rePOST",
		]);
		if (rateCheck.isLimited) {
			set.status = 429;
			if (rateCheck.limitType === "rapid_rePOST") {
				return {
					error: "Please solve the captcha to continue",
					captcha_required: true,
					resetIn: rateCheck.resetIn,
				};
			}
			return { error: "Too many requests", resetIn: rateCheck.resetIn };
		}

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const { id } = params;
			const POST = getPOSTById.get(id);
			if (!POST) return { error: "POST not found" };

			if (isUserSuspendedById(POST.user_id)) {
				return { error: "POST not found" };
			}

			const blockCheck = db
				.query(
					"SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) ",
				)
				.get(user.id, POST.user_id, POST.user_id, user.id);
			if (blockCheck) {
				return { error: "You cannot interact with this user" };
			}

			const existingrePOST = checkrePOSTExists.get(user.id, id);

			if (existingrePOST) {
				removerePOST.run(user.id, id);
				updaterePOSTCount.run(-1, id);
				return { success: true, rePOSTed: false };
			} else {
				const rePOSTId = Bun.randomUUIDv7();
				addrePOST.run(rePOSTId, user.id, id);
				updaterePOSTCount.run(1, id);

				if (POST.user_id !== user.id) {
					addNotification(
						POST.user_id,
						"rePOST",
						`${user.name || user.username} rePOSTed your POST`,
						id,
						user.id,
						user.username,
						user.name || user.username,
					);
				}

				return { success: true, rePOSTed: true };
			}
		} catch (error) {
			console.error("rePOST toggle error:", error);
			return { error: "Failed to toggle rePOST" };
		}
	})
	.post("/:id/poll/vote", async ({ jwt, headers, params, body }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const { id: POSTId } = params;
			const { optionId } = body;

			if (!optionId) {
				return { error: "Option ID is required" };
			}

			const poll = getPollByPostId.get(POSTId);
			if (!poll) {
				return { error: "Poll not found" };
			}

			const POST = getPOSTById.get(POSTId);
			if (!POST) return { error: "POST not found" };
			if (isUserSuspendedById(POST.user_id)) {
				return { error: "POST not found" };
			}
			const blockCheck = db
				.query(
					"SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) ",
				)
				.get(user.id, POST.user_id, POST.user_id, user.id);
			if (blockCheck) {
				return { error: "You cannot interact with this user" };
			}

			if (new Date() > new Date(poll.expires_at)) {
				return { error: "Poll has expired" };
			}

			const existingVote = getUserPollVote.get(user.id, poll.id);
			const voteId = Bun.randomUUIDv7();

			if (existingVote?.option_id) {
				updateOptionVoteCount.run(-1, existingVote.option_id);
			}

			castPollVote.run(voteId, user.id, poll.id, optionId);
			updateOptionVoteCount.run(1, optionId);

			const options = getPollOptions.all(poll.id);
			const totalVotes = getTotalPollVotes.get(poll.id)?.total || 0;
			const voters = getPollVoters.all(poll.id);

			return {
				success: true,
				poll: {
					...poll,
					options: options.map((option) => ({
						...option,
						percentage:
							totalVotes > 0
								? Math.round((option.vote_count / totalVotes) * 100)
								: 0,
					})),
					totalVotes,
					userVote: optionId,
					voters,
				},
			};
		} catch (error) {
			console.error("Poll vote error:", error);
			return { error: "Failed to vote on poll" };
		}
	})
	.get("/:id/likes", async ({ jwt, headers, params, query }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const { id } = params;
			const { limit = 20 } = query;

			const POST = getPOSTById.get(id);
			if (!POST) return { error: "POST not found" };

			if (isUserSuspendedById(POST.user_id)) {
				return { canReply: false, error: "POST not found" };
			}

			const likers = getPOSTLikers.all(id, parseInt(limit, 10));

			return {
				success: true,
				users: likers,
				type: "likes",
			};
		} catch (error) {
			console.error("Get likers error:", error);
			return { error: "Failed to get likers" };
		}
	})
	.get("/:id/rePOSTS", async ({ jwt, headers, params, query }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const { id } = params;
			const { limit = 20 } = query;

			const POST = getPOSTById.get(id);
			if (!POST) return { error: "POST not found" };

			const rePOSTers = getPOSTrePOSTers.all(id, parseInt(limit, 10));

			return {
				success: true,
				users: rePOSTers,
				type: "rePOSTS",
			};
		} catch (error) {
			console.error("Get rePOSTers error:", error);
			return { error: "Failed to get rePOSTers" };
		}
	})
	.get("/:id/quotes", async ({ jwt, headers, params, query }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const { id } = params;
			const { limit = 20 } = query;

			const POST = getPOSTById.get(id);
			if (!POST) return { error: "POST not found" };

			const quoters = getPOSTQuoters.all(id, parseInt(limit, 10));

			const quotePOSTS = quoters
				.map((quoter) => {
					const quotePOST = getPOSTById.get(quoter.quote_POST_id);
					if (!quotePOST) return null;

					const author = db
						.query(
							"SELECT id, username, name, avatar, verified FROM users WHERE id = ?",
						)
						.get(quotePOST.user_id);
					const attachments = db
						.query("SELECT * FROM attachments WHERE post_id = ?")
						.all(quotePOST.id);
					const liked = db
						.query("SELECT * FROM likes WHERE user_id = ? AND post_id = ?")
						.get(user.id, quotePOST.id);
					const rePOSTed = db
						.query("SELECT * FROM rePOSTS WHERE user_id = ? AND post_id = ?")
						.get(user.id, quotePOST.id);
					const bookmarked = db
						.query("SELECT * FROM bookmarks WHERE user_id = ? AND post_id = ?")
						.get(user.id, quotePOST.id);

					return {
						id: quotePOST.id,
						content: quotePOST.content,
						created_at: quotePOST.created_at,
						author,
						like_count: quotePOST.like_count || 0,
						rePOST_count: quotePOST.rePOST_count || 0,
						reply_count: quotePOST.reply_count || 0,
						quote_count: quotePOST.quote_count || 0,
						liked_by_user: !!liked,
						rePOSTed_by_user: !!rePOSTed,
						bookmarked_by_user: !!bookmarked,
						attachments: attachments || [],
						source: quotePOST.source,
						reply_to: quotePOST.reply_to,
						quote_POST_id: quotePOST.quote_POST_id,
						pinned: quotePOST.pinned || 0,
					};
				})
				.filter((POST) => POST !== null);

			return {
				success: true,
				POSTS: quotePOSTS,
				type: "quotes",
			};
		} catch (error) {
			console.error("Get quoters error:", error);
			return { error: "Failed to get quoters" };
		}
	})
	.get("/can-reply/:id", async ({ jwt, headers, params }) => {
		const authorization = headers.authorization;
		if (!authorization)
			return { canReply: false, error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { canReply: false, error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { canReply: false, error: "User not found" };

			const { id } = params;
			const POST = getPOSTById.get(id);
			if (!POST) return { canReply: false, error: "POST not found" };

			const POSTAuthor = db
				.query("SELECT id, username, verified, gold FROM users WHERE id = ?")
				.get(POST.user_id);
			if (!POSTAuthor)
				return { canReply: false, error: "POST author not found" };

			const isBlocked = db
				.query("SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?")
				.get(POSTAuthor.id, user.id);

			if (isBlocked) {
				return { canReply: false, reason: "blocked" };
			}

			const replyRestriction = POST.reply_restriction || "everyone";

			if (replyRestriction === "everyone") {
				return { canReply: true };
			}

			const canReply = await checkReplyPermission(
				user,
				POSTAuthor,
				replyRestriction,
			);

			return {
				canReply,
				restriction: replyRestriction,
				reason: canReply ? null : "restriction",
			};
		} catch (error) {
			console.error("Check reply permission error:", error);
			return { canReply: false, error: "Failed to check reply permission" };
		}
	})
	.post("/bulk-delete", async ({ jwt, headers, body }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const options = body && typeof body === "object" ? body : {};
			const includeReplies =
				options.includeReplies === undefined ? true : !!options.includeReplies;
			const keepPinned =
				options.keepPinned === undefined ? true : !!options.keepPinned;
			const dryRun = !!options.dryRun;
			const MAX_LIMIT = 500;
			const DEFAULT_LIMIT = 100;
			const parsedLimit = Number(options.limit);
			const deleteLimit = Number.isFinite(parsedLimit)
				? Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsedLimit)))
				: DEFAULT_LIMIT;
			const now = new Date();
			const afterDateRaw = options.after;
			const beforeDateRaw = options.before;
			// If both missing, we don't allow an unbounded range for safety
			if (!afterDateRaw && !beforeDateRaw) {
				return { error: "At least one bound (after or before) is required" };
			}

			let afterDate = new Date("1970-01-01T00:00:00Z");
			if (afterDateRaw) {
				afterDate = new Date(afterDateRaw);
				if (Number.isNaN(afterDate.getTime())) {
					return { error: "Invalid start date" };
				}
			}
			let beforeDate = new Date();
			if (beforeDateRaw) {
				beforeDate = new Date(beforeDateRaw);
				if (Number.isNaN(beforeDate.getTime())) {
					return { error: "Invalid end date" };
				}
			}

			// Enforce sensible bounds
			if (afterDate > beforeDate) {
				return { error: "Start date must be before end date" };
			}

			// Ensure beforeDate is not in the future
			if (beforeDate > now) beforeDate = now;

			const afterIso = afterDate.toISOString();
			const beforeIso = beforeDate.toISOString();
			const includeRepliesFlag = includeReplies ? 1 : 0;
			const keepPinnedFlag = keepPinned ? 1 : 0;

			const totalRow = countBulkDeletablePOSTS.get(
				user.id,
				afterIso,
				beforeIso,
				includeRepliesFlag,
				keepPinnedFlag,
			);
			const totalMatching = Number(totalRow?.total) || 0;

			if (dryRun) {
				return {
					success: true,
					preview: {
						total: totalMatching,
						before: beforeIso,
						includeReplies,
						keepPinned,
						limit: deleteLimit,
					},
				};
			}

			if (totalMatching === 0) {
				return { success: true, deleted: 0, remaining: 0 };
			}

			const batchRows = getBulkDeletablePOSTIds.all(
				user.id,
				afterIso,
				beforeIso,
				includeRepliesFlag,
				keepPinnedFlag,
				deleteLimit,
			);
			if (!batchRows.length) {
				return {
					success: true,
					deleted: 0,
					remaining: totalMatching,
				};
			}

			const ids = batchRows.map((row) => row.id);
			const placeholders = ids.map(() => "?").join(",");
			const deleteStatement = db.query(
				`DELETE FROM posts WHERE id IN (${placeholders})`,
			);
			deleteStatement.run(...ids);

			const deletedCount = ids.length;
			const remaining = Math.max(totalMatching - deletedCount, 0);

			return {
				success: true,
				deleted: deletedCount,
				remaining,
				nextBatchAvailable: remaining > 0,
			};
		} catch (error) {
			console.error("Bulk delete POSTS error:", error);
			return { error: "Failed to bulk delete POSTS" };
		}
	})
	.delete("/:id", async ({ jwt, headers, params }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const { id } = params;
			const POST = getPOSTById.get(id);
			if (!POST) return { error: "POST not found" };

			if (POST.user_id !== user.id && !user.admin) {
				return { error: "You can only delete your own POSTS" };
			}

			db.query("DELETE FROM posts WHERE id = ?").run(id);

			return { success: true };
		} catch (error) {
			console.error("Delete POST error:", error);
			return { error: "Failed to delete POST" };
		}
	})
	.patch("/:id/reply-restriction", async ({ jwt, headers, params, body }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const { id } = params;
			const { reply_restriction } = body;

			const POST = getPOSTById.get(id);
			if (!POST) return { error: "POST not found" };

			if (POST.user_id !== user.id) {
				return { error: "You can only modify your own POSTS" };
			}

			const validRestrictions = [
				"everyone",
				"followers",
				"following",
				"verified",
			];
			if (!validRestrictions.includes(reply_restriction)) {
				return { error: "Invalid reply restriction" };
			}

			db.query("UPDATE posts SET reply_restriction = ? WHERE id = ?").run(
				reply_restriction,
				id,
			);

			return { success: true };
		} catch (error) {
			console.error("Update reply restriction error:", error);
			return { error: "Failed to update reply restriction" };
		}
	})
	.put("/:id", async ({ jwt, headers, params, body }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const { id } = params;
			const { content } = body;

			const POST = getPOSTById.get(id);
			if (!POST) return { error: "POST not found" };

			if (POST.user_id !== user.id) {
				return { error: "You can only edit your own POSTS" };
			}

			if (POST.poll_id) {
				return { error: "Cannot edit POSTS with polls" };
			}

			if (!content || typeof content !== "string") {
				return { error: "Content is required" };
			}

			const trimmedContent = content.trim();
			if (trimmedContent.length === 0) {
				return { error: "POST content cannot be empty" };
			}

			let maxPOSTLength = user.character_limit || 400;
			if (!user.character_limit) {
				maxPOSTLength = user.gold ? 16500 : user.verified ? 5500 : 400;
			}
			if (trimmedContent.length > maxPOSTLength) {
				return {
					error: `POST content must be ${maxPOSTLength} characters or less`,
				};
			}

			const historyId = Bun.randomUUIDv7();
			db.query(
				"INSERT INTO POST_edit_history (id, post_id, content, edited_at) VALUES (?, ?, ?, datetime('now', 'utc'))",
			).run(historyId, id, POST.content);

			db.query(
				"UPDATE posts SET content = ?, edited_at = datetime('now', 'utc') WHERE id = ?",
			).run(trimmedContent, id);

			const updatedPOST = getPOSTById.get(id);

			return {
				success: true,
				POST: {
					...updatedPOST,
					author: user,
					poll: getPollDataForPOST(updatedPOST.id, user.id),
					quoted_POST: getQuotedPOSTData(
						updatedPOST.quote_POST_id,
						user.id,
					),
					attachments: getPOSTAttachments(updatedPOST.id),
					fact_check: getFactCheckForPost.get(updatedPOST.id) || null,
					interactive_card: getCardDataForPOST(updatedPOST.id),
				},
			};
		} catch (error) {
			console.error("Edit POST error:", error);
			return { error: "Failed to edit POST" };
		}
	})
	.patch("/:id/outline", async ({ jwt, headers, params, body }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			if (!user.gray) {
				return { error: "Only gray check users can set post outlines" };
			}

			const { id } = params;
			const POST = getPOSTById.get(id);
			if (!POST) return { error: "POST not found" };

			if (POST.user_id !== user.id) {
				return { error: "You can only update your own POSTS" };
			}

			const outline = body.outline !== undefined ? body.outline || null : null;
			db.query("UPDATE posts SET outline = ? WHERE id = ?").run(outline, id);

			return { success: true };
		} catch (error) {
			console.error("Update outline error:", error);
			return { error: "Failed to update outline" };
		}
	})
	.get("/:id/edit-history", async ({ jwt, headers, params }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const { id } = params;

			const POST = getPOSTById.get(id);
			if (!POST) return { error: "POST not found" };

			const history = db
				.query(
					"SELECT content, edited_at FROM POST_edit_history WHERE post_id = ? ORDER BY edited_at DESC",
				)
				.all(id);

			const currentVersion = {
				content: POST.content,
				edited_at: POST.edited_at || POST.created_at,
				is_current: true,
			};

			return {
				success: true,
				history: [
					currentVersion,
					...history.map((h) => ({ ...h, is_current: false })),
				],
			};
		} catch (error) {
			console.error("Get edit history error:", error);
			return { error: "Failed to get edit history" };
		}
	});
