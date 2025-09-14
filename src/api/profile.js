import { jwt } from "@elysiajs/jwt";
import { Elysia, file } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import db from "./../db.js";
import ratelimit from "../helpers/ratelimit.js";

const JWT_SECRET = process.env.JWT_SECRET;

const getUserByUsername = db.query("SELECT * FROM users WHERE username = ?");

const updateProfile = db.query(`
  UPDATE users
  SET name = ?, bio = ?, location = ?, website = ?
  WHERE id = ?
`);

const updateAvatar = db.query(`
  UPDATE users
  SET avatar = ?
  WHERE id = ?
`);

const getUserReplies = db.query(`
  SELECT posts.*, users.username, users.name, users.verified 
  FROM posts 
  JOIN users ON posts.user_id = users.id 
  WHERE posts.user_id = ? AND posts.reply_to IS NOT NULL
  ORDER BY posts.created_at DESC 
  LIMIT 20
`);

const getUserPosts = db.query(`
  SELECT posts.*, users.username, users.name, users.avatar, users.verified
  FROM posts 
  JOIN users ON posts.user_id = users.id 
  WHERE posts.user_id = ? AND posts.reply_to IS NULL
  ORDER BY posts.created_at DESC
`);

const getUserRetweets = db.query(`
  SELECT 
    original_posts.*,
    original_users.username, original_users.name, original_users.avatar, original_users.verified,
    retweets.created_at as retweet_created_at,
    retweets.post_id as original_post_id
  FROM retweets
  JOIN posts original_posts ON retweets.post_id = original_posts.id
  JOIN users original_users ON original_posts.user_id = original_users.id
  WHERE retweets.user_id = ?
  ORDER BY retweets.created_at DESC
`);

const getFollowStatus = db.query(`
  SELECT id FROM follows WHERE follower_id = ? AND following_id = ?
`);

const addFollow = db.query(`
  INSERT INTO follows (id, follower_id, following_id) VALUES (?, ?, ?)
`);

const removeFollow = db.query(`
	DELETE FROM follows WHERE follower_id = ? AND following_id = ?
`);

const getFollowCounts = db.query(`
	SELECT 
		(SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following_count,
		(SELECT COUNT(*) FROM follows WHERE following_id = ?) AS follower_count,
		(SELECT COUNT(*) FROM posts WHERE user_id = ? AND reply_to IS NULL) AS post_count
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

const getTotalPollVotes = db.query(`
  SELECT SUM(vote_count) as total FROM poll_options WHERE poll_id = ?
`);

const getPollVoters = db.query(`
  SELECT DISTINCT users.username, users.name, users.avatar, users.verified
  FROM poll_votes 
  JOIN users ON poll_votes.user_id = users.id 
  WHERE poll_votes.poll_id = ?
  ORDER BY poll_votes.created_at DESC
  LIMIT 10
`);

const getQuotedTweet = db.query(`
  SELECT posts.*, users.username, users.name, users.avatar, users.verified
  FROM posts
  JOIN users ON posts.user_id = users.id
  WHERE posts.id = ?
`);

const getAttachmentsByPostId = db.query(`
  SELECT * FROM attachments WHERE post_id = ?
`);

const getPollDataForTweet = (tweetId, userId) => {
	const poll = getPollByPostId.get(tweetId);
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

const getTweetAttachments = (tweetId) => {
	return getAttachmentsByPostId.all(tweetId);
};

const getQuotedTweetData = (quoteTweetId, userId) => {
	if (!quoteTweetId) return null;

	const quotedTweet = getQuotedTweet.get(quoteTweetId);
	if (!quotedTweet) return null;

	return {
		...quotedTweet,
		author: {
			username: quotedTweet.username,
			name: quotedTweet.name,
			avatar: quotedTweet.avatar,
			verified: quotedTweet.verified || false,
		},
		poll: getPollDataForTweet(quotedTweet.id, userId),
		attachments: getTweetAttachments(quotedTweet.id),
	};
};

export default new Elysia({ prefix: "/profile" })
	.use(jwt({ name: "jwt", secret: JWT_SECRET }))
	.use(
		rateLimit({
			duration: 15_000,
			max: 50,
			scoping: "scoped",
			generator: ratelimit,
		}),
	)
	.get("/:username", async ({ params, jwt, headers }) => {
		try {
			const { username } = params;

			const user = getUserByUsername.get(username);
			if (!user) {
				return { error: "User not found" };
			}

			const posts = getUserPostsAndRetweets.all(user.id, user.id);
			const counts = getFollowCounts.get(user.id, user.id, user.id);

			const profile = {
				...user,
				following_count: counts.following_count,
				follower_count: counts.follower_count,
				post_count: counts.post_count,
			};

			let isFollowing = false;
			let isOwnProfile = false;
			let currentUserId = null;

			const authorization = headers.authorization;
			if (authorization) {
				try {
					const payload = await jwt.verify(
						authorization.replace("Bearer ", ""),
					);
					if (payload) {
						const currentUser = getUserByUsername.get(payload.username);
						if (currentUser) {
							currentUserId = currentUser.id;
							isOwnProfile = currentUser.id === user.id;
							if (!isOwnProfile) {
								const followStatus = getFollowStatus.get(
									currentUser.id,
									user.id,
								);
								isFollowing = !!followStatus;
							}
						}
					}
				} catch {
					// Invalid token, continue as unauthenticated
				}
			}

			const postsWithPolls = posts.map((post) => ({
				...post,
				poll: getPollDataForTweet(post.id, currentUserId),
				quoted_tweet: getQuotedTweetData(post.quote_tweet_id, currentUserId),
				attachments: getTweetAttachments(post.id),
			}));

			return {
				profile,
				posts: postsWithPolls,
				isFollowing,
				isOwnProfile,
			};
		} catch (error) {
			console.error("Profile fetch error:", error);
			return { error: "Failed to fetch profile" };
		}
	})
	.get("/:username/replies", async ({ params }) => {
		try {
			const { username } = params;

			const user = getUserByUsername.get(username);
			if (!user) {
				return { error: "User not found" };
			}

			const replies = getUserReplies.all(user.id);

			return {
				replies,
			};
		} catch (error) {
			console.error("Replies fetch error:", error);
			return { error: "Failed to fetch replies" };
		}
	})
	.put("/:username", async ({ params, jwt, headers, body }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const currentUser = getUserByUsername.get(payload.username);
			if (!currentUser) return { error: "User not found" };

			const { username } = params;
			if (currentUser.username !== username) {
				return { error: "You can only edit your own profile" };
			}

			const { name, bio, location, website } = body;

			if (name && name.length > 50) {
				return { error: "Display name must be 50 characters or less" };
			}

			if (bio && bio.length > 160) {
				return { error: "Bio must be 160 characters or less" };
			}

			if (location && location.length > 30) {
				return { error: "Location must be 30 characters or less" };
			}

			if (website && website.length > 100) {
				return { error: "Website must be 100 characters or less" };
			}

			updateProfile.run(
				name || currentUser.name,
				bio !== undefined ? bio : currentUser.bio,
				location !== undefined ? location : currentUser.location,
				website !== undefined ? website : currentUser.website,
				currentUser.id,
			);

			const updatedUser = getUserByUsername.get(currentUser.username);
			return { success: true, profile: updatedUser };
		} catch (error) {
			console.error("Profile update error:", error);
			return { error: "Failed to update profile" };
		}
	})
	.post("/:username/follow", async ({ params, jwt, headers }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const currentUser = getUserByUsername.get(payload.username);
			if (!currentUser) return { error: "User not found" };

			const { username } = params;
			const targetUser = getUserByUsername.get(username);
			if (!targetUser) return { error: "User not found" };

			if (currentUser.id === targetUser.id) {
				return { error: "You cannot follow yourself" };
			}

			const existingFollow = getFollowStatus.get(currentUser.id, targetUser.id);
			if (existingFollow) {
				return { error: "Already following this user" };
			}

			const followId = Bun.randomUUIDv7();
			addFollow.run(followId, currentUser.id, targetUser.id);

			return { success: true };
		} catch (error) {
			console.error("Follow error:", error);
			return { error: "Failed to follow user" };
		}
	})
	.delete("/:username/follow", async ({ params, jwt, headers }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const currentUser = getUserByUsername.get(payload.username);
			if (!currentUser) return { error: "User not found" };

			const { username } = params;
			const targetUser = getUserByUsername.get(username);
			if (!targetUser) return { error: "User not found" };

			const existingFollow = getFollowStatus.get(currentUser.id, targetUser.id);
			if (!existingFollow) {
				return { error: "Not following this user" };
			}

			removeFollow.run(currentUser.id, targetUser.id);

			return { success: true };
		} catch (error) {
			console.error("Unfollow error:", error);
			return { error: "Failed to unfollow user" };
		}
	})
	.post("/:username/avatar", async ({ params, jwt, headers, body }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const currentUser = getUserByUsername.get(payload.username);
			if (!currentUser) return { error: "User not found" };

			const { username } = params;
			if (currentUser.username !== username) {
				return { error: "You can only update your own avatar" };
			}

			const { avatar } = body;
			if (!avatar || !avatar.stream) {
				return { error: "Avatar file is required" };
			}

			const allowedTypes = [
				"image/jpeg",
				"image/jpg",
				"image/png",
				"image/gif",
				"image/webp",
			];
			if (!allowedTypes.includes(avatar.type)) {
				return {
					error:
						"Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.",
				};
			}

			if (avatar.size > 5 * 1024 * 1024) {
				return {
					error: "File too large. Please upload an image smaller than 5MB.",
				};
			}

			const uploadsDir = "./.data/uploads/avatars";

			const fileExtension = avatar.name.split(".").pop();
			const fileName = `${currentUser.id}-${Date.now()}.${fileExtension}`;
			const filePath = `${uploadsDir}/${fileName}`;

			const arrayBuffer = await avatar.arrayBuffer();
			await Bun.write(filePath, arrayBuffer);

			const avatarUrl = `/api/avatars/${fileName}`;
			updateAvatar.run(avatarUrl, currentUser.id);

			const updatedUser = getUserByUsername.get(currentUser.username);
			return { success: true, avatar: updatedUser.avatar };
		} catch (error) {
			console.error("Avatar upload error:", error);
			return { error: "Failed to upload avatar" };
		}
	})
	.delete("/:username/avatar", async ({ params, jwt, headers }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const currentUser = getUserByUsername.get(payload.username);
			if (!currentUser) return { error: "User not found" };

			const { username } = params;
			if (currentUser.username !== username) {
				return { error: "You can only update your own avatar" };
			}

			// Remove avatar from database
			updateAvatar.run(null, currentUser.id);

			return { success: true };
		} catch (error) {
			console.error("Avatar removal error:", error);
			return { error: "Failed to remove avatar" };
		}
	});

export const avatarRoutes = new Elysia({ prefix: "/avatars" }).get(
	"/:filename",
	({ params }) => {
		const { filename } = params;

		if (!/^[a-zA-Z0-9\-.]+$/.test(filename)) {
			return new Response("Invalid filename", { status: 400 });
		}
		if (filename.includes("..")) {
			return new Response("Invalid filename", { status: 400 });
		}

		const filePath = `./.data/uploads/avatars/${filename}`;
		return file(filePath);
	},
);
