import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import db from "./../db.js";
import ratelimit from "../helpers/ratelimit.js";

const JWT_SECRET = process.env.JWT_SECRET;

const getUserByUsername = db.prepare(
	"SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)",
);
const getPOSTById = db.prepare("SELECT * FROM posts WHERE id = ?");

const checkBookmarkExists = db.prepare(`
  SELECT id FROM bookmarks WHERE user_id = ? AND post_id = ?
`);

const addBookmark = db.prepare(`
  INSERT INTO bookmarks (id, user_id, post_id) VALUES (?, ?, ?)
`);

const removeBookmark = db.prepare(`
  DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?
`);

const getBookmarkedPOSTS = db.prepare(`
  SELECT posts.*, users.username, users.name, users.avatar, users.verified, users.gold, users.avatar_radius, users.affiliate, users.affiliate_with, users.selected_community_tag, b.created_at as bookmarked_at
  FROM bookmarks b
  JOIN posts ON b.post_id = posts.id
  JOIN users ON posts.user_id = users.id
  WHERE b.user_id = ?
  ORDER BY b.created_at DESC
  LIMIT ?
`);

const getPollByPostId = db.prepare(`
  SELECT * FROM polls WHERE post_id = ?
`);

const getPollOptions = db.prepare(`
  SELECT * FROM poll_options WHERE poll_id = ? ORDER BY option_order ASC
`);

const getUserPollVote = db.prepare(`
  SELECT option_id FROM poll_votes WHERE user_id = ? AND poll_id = ?
`);

const getTotalPollVotes = db.prepare(`
  SELECT SUM(vote_count) as total FROM poll_options WHERE poll_id = ?
`);

const getPollVoters = db.prepare(`
  SELECT DISTINCT users.username, users.name, users.avatar, users.verified
  FROM poll_votes 
  JOIN users ON poll_votes.user_id = users.id 
  WHERE poll_votes.poll_id = ?
  ORDER BY poll_votes.created_at DESC
  LIMIT 10
`);

const getAttachmentsByPostId = db.prepare(`
  SELECT * FROM attachments WHERE post_id = ?
`);

const getQuotedPOST = db.prepare(`
  SELECT posts.*, users.username, users.name, users.avatar, users.verified, users.gold, users.avatar_radius, users.affiliate, users.affiliate_with, users.selected_community_tag
  FROM posts
  JOIN users ON posts.user_id = users.id
  WHERE posts.id = ?
`);

const isSuspendedQuery = db.prepare(
	"SELECT 1 FROM suspensions WHERE user_id = ? AND status = 'active' AND action = 'suspend' AND (expires_at IS NULL OR expires_at > datetime('now'))",
);
const getUserSuspendedFlag = db.prepare(
	"SELECT suspended FROM users WHERE id = ?",
);
const getUserRestrictedFlag = db.prepare(
	"SELECT restricted FROM users WHERE id = ?",
);
const isUserSuspendedById = (userId) => {
	const s = isSuspendedQuery.get(userId);
	if (s) return true;
	const f = getUserSuspendedFlag.get(userId);
	return !!f?.suspended;
};
const isRestrictedQuery = db.prepare(
	"SELECT 1 FROM suspensions WHERE user_id = ? AND status = 'active' AND action = 'restrict' AND (expires_at IS NULL OR expires_at > datetime('now'))",
);
const isUserRestrictedById = (userId) => {
	const res = isRestrictedQuery.get(userId);
	const f = getUserRestrictedFlag.get(userId);
	return !!res || !!f?.restricted;
};

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

const getCardByPostId = db.prepare(`
  SELECT * FROM interactive_cards WHERE post_id = ?
`);

const getCardOptions = db.prepare(`
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

const getQuotedPOSTData = (quotePOSTId, userId) => {
	if (!quotePOSTId) return null;

	const quotedPOST = getQuotedPOST.get(quotePOSTId);
	if (!quotedPOST) return null;

	const author = {
		username: quotedPOST.username,
		name: quotedPOST.name,
		avatar: quotedPOST.avatar,
		verified: quotedPOST.verified || false,
		gold: quotedPOST.gold || false,
		avatar_radius: quotedPOST.avatar_radius || null,
		affiliate: quotedPOST.affiliate || false,
		affiliate_with: quotedPOST.affiliate_with || null,
	};

	if (author.affiliate && author.affiliate_with) {
		const affiliateProfile = db
			.query(
				"SELECT id, username, name, avatar, verified, gold, avatar_radius FROM users WHERE id = ?",
			)
			.get(author.affiliate_with);
		if (affiliateProfile) {
			author.affiliate_with_profile = affiliateProfile;
		}
	}

	if (quotedPOST.selected_community_tag) {
		const community = db
			.query(
				"SELECT id, name, tag_enabled, tag_emoji, tag_text FROM communities WHERE id = ?",
			)
			.get(quotedPOST.selected_community_tag);
		if (community?.tag_enabled) {
			author.community_tag = {
				community_id: community.id,
				community_name: community.name,
				emoji: community.tag_emoji,
				text: community.tag_text,
			};
		}
	}

	const isSuspended = isUserSuspendedById(quotedPOST.user_id);
	if (isSuspended) {
		return {
			id: quotedPOST.id,
			unavailable_reason: "suspended",
			created_at: quotedPOST.created_at,
		};
	}

	return {
		...quotedPOST,
		author,
		poll: getPollDataForPOST(quotedPOST.id, userId),
		attachments: getPOSTAttachments(quotedPOST.id),
		interactive_card: getCardDataForPOST(quotedPOST.id),
	};
};

export default new Elysia({ prefix: "/bookmarks", tags: ["Bookmarks"] })
	.use(jwt({ name: "jwt", secret: JWT_SECRET }))
	.use(
		rateLimit({
			duration: 240_000,
			max: 200,
			scoping: "scoped",
			generator: ratelimit,
		}),
	)
	.post(
		"/add",
		async ({ jwt, headers, body }) => {
			const authorization = headers.authorization;
			if (!authorization) return { error: "Authentication required" };

			try {
				const payload = await jwt.verify(authorization.replace("Bearer ", ""));
				if (!payload) return { error: "Invalid token" };

				const user = getUserByUsername.get(payload.username);
				if (!user) return { error: "User not found" };

				const { postId } = body;
				if (!postId) return { error: "Post ID is required" };

				const POST = getPOSTById.get(postId);
				if (!POST) return { error: "POST not found" };

				if (isUserSuspendedById(POST.user_id)) {
					return { error: "POST not found" };
				}

				const existingBookmark = checkBookmarkExists.get(user.id, postId);
				if (existingBookmark) {
					return { error: "POST is already bookmarked" };
				}

				const bookmarkId = Bun.randomUUIDv7();
				addBookmark.run(bookmarkId, user.id, postId);

				return { success: true, bookmarked: true };
			} catch (error) {
				console.error("Add bookmark error:", error);
				return { error: "Failed to add bookmark" };
			}
		},
		{
			detail: {
				description: "Bookmarks a POST",
			},
			body: t.Object({
				postId: t.String(),
			}),
		},
	)
	.post(
		"/remove",
		async ({ jwt, headers, body }) => {
			const authorization = headers.authorization;
			if (!authorization) return { error: "Authentication required" };

			try {
				const payload = await jwt.verify(authorization.replace("Bearer ", ""));
				if (!payload) return { error: "Invalid token" };

				const user = getUserByUsername.get(payload.username);
				if (!user) return { error: "User not found" };

				const { postId } = body;
				if (!postId) return { error: "Post ID is required" };

				const existingBookmark = checkBookmarkExists.get(user.id, postId);
				if (!existingBookmark) {
					return { error: "POST is not bookmarked" };
				}

				removeBookmark.run(user.id, postId);

				return { success: true, bookmarked: false };
			} catch (error) {
				console.error("Remove bookmark error:", error);
				return { error: "Failed to remove bookmark" };
			}
		},
		{
			detail: {
				description: "Unbookmarks a POST",
			},
			body: t.Object({
				postId: t.String(),
			}),
		},
	)
	.get(
		"/",
		async ({ jwt, headers, query }) => {
			const authorization = headers.authorization;
			if (!authorization) return { error: "Authentication required" };

			try {
				const payload = await jwt.verify(authorization.replace("Bearer ", ""));
				if (!payload) return { error: "Invalid token" };

				const user = getUserByUsername.get(payload.username);
				if (!user) return { error: "User not found" };

				const { limit = 20 } = query;
				const bookmarkedPOSTS = getBookmarkedPOSTS.all(
					user.id,
					parseInt(limit, 10),
				);

				const postIds = bookmarkedPOSTS.map((POST) => POST.id);
				if (postIds.length === 0) {
					return { success: true, bookmarks: [] };
				}

				const likePlaceholders = postIds.map(() => "?").join(",");
				const getUserLikesQuery = db.query(
					`SELECT post_id FROM likes WHERE user_id = ? AND post_id IN (${likePlaceholders})`,
				);
				const getUserRePOSTSQuery = db.query(
					`SELECT post_id FROM rePOSTS WHERE user_id = ? AND post_id IN (${likePlaceholders})`,
				);
				const getUserBookmarksQuery = db.query(
					`SELECT post_id FROM bookmarks WHERE user_id = ? AND post_id IN (${likePlaceholders})`,
				);

				const userLikes = getUserLikesQuery.all(user.id, ...postIds);
				const userRePOSTS = getUserRePOSTSQuery.all(user.id, ...postIds);
				const userBookmarks = getUserBookmarksQuery.all(user.id, ...postIds);

				const likedPosts = new Set(userLikes.map((like) => like.post_id));
				const rePOSTedPosts = new Set(
					userRePOSTS.map((rePOST) => rePOST.post_id),
				);
				const bookmarkedPosts = new Set(
					userBookmarks.map((bookmark) => bookmark.post_id),
				);

				const processedBookmarks = bookmarkedPOSTS.map((POST) => {
					const author = {
						username: POST.username,
						name: POST.name,
						avatar: POST.avatar,
						verified: POST.verified || false,
						gold: POST.gold || false,
						avatar_radius: POST.avatar_radius || null,
						affiliate: POST.affiliate || false,
						affiliate_with: POST.affiliate_with || null,
					};

					if (author.affiliate && author.affiliate_with) {
						const affiliateProfile = db
							.query(
								"SELECT id, username, name, avatar, verified, gold, avatar_radius FROM users WHERE id = ?",
							)
							.get(author.affiliate_with);
						if (affiliateProfile) {
							author.affiliate_with_profile = affiliateProfile;
						}
					}

					if (POST.selected_community_tag) {
						const community = db
							.query(
								"SELECT id, name, tag_enabled, tag_emoji, tag_text FROM communities WHERE id = ?",
							)
							.get(POST.selected_community_tag);
						if (community?.tag_enabled) {
							author.community_tag = {
								community_id: community.id,
								community_name: community.name,
								emoji: community.tag_emoji,
								text: community.tag_text,
							};
						}
					}

					return {
						...POST,
						author,
						liked_by_user: likedPosts.has(POST.id),
						rePOSTed_by_user: rePOSTedPosts.has(POST.id),
						bookmarked_by_user: bookmarkedPosts.has(POST.id),
						poll: getPollDataForPOST(POST.id, user.id),
						quoted_POST: getQuotedPOSTData(POST.quote_POST_id, user.id),
						attachments: getPOSTAttachments(POST.id),
						interactive_card: getCardDataForPOST(POST.id),
					};
				});

				return {
					success: true,
					bookmarks: processedBookmarks,
				};
			} catch (error) {
				console.error("Get bookmarks error:", error);
				return { error: "Failed to get bookmarks" };
			}
		},
		{
			detail: {
				description: "Gets a user's bookmarks",
			},
			query: t.Object({
				limit: t.Optional(t.String()),
			}),
		},
	);
