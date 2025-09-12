import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import db from "./../db.js";
import ratelimit from "../helpers/ratelimit.js";

const JWT_SECRET = process.env.JWT_SECRET;

const getUserByUsername = db.query("SELECT * FROM users WHERE username = ?");
const getTweetById = db.query(`
  SELECT *
  FROM posts 
  WHERE posts.id = ?
`);

const getTweetWithThread = db.query(`
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

const getTweetReplies = db.query(`
  SELECT *
  FROM posts
  WHERE reply_to = ?
  ORDER BY created_at ASC
`);

const createTweet = db.query(`
  INSERT INTO posts (id, user_id, content, reply_to, source) 
  VALUES (?, ?, ?, ?, ?)
	RETURNING *
`);

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

const checkRetweetExists = db.query(`
  SELECT id FROM retweets WHERE user_id = ? AND post_id = ?
`);

const addRetweet = db.query(`
  INSERT INTO retweets (id, user_id, post_id) VALUES (?, ?, ?)
`);

const removeRetweet = db.query(`
  DELETE FROM retweets WHERE user_id = ? AND post_id = ?
`);

const updateRetweetCount = db.query(`
  UPDATE posts SET retweet_count = retweet_count + ? WHERE id = ?
`);

export default new Elysia({ prefix: "/tweets" })
	.use(jwt({ name: "jwt", secret: JWT_SECRET }))
	.use(
		rateLimit({
			duration: 15_000,
			max: 50,
			scoping: "scoped",
			generator: ratelimit,
		}),
	)
	.post("/", async ({ jwt, headers, body }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const { content, reply_to, source } = body;
			const tweetContent = content;

			if (!tweetContent || tweetContent.trim().length === 0) {
				return { error: "Tweet content is required" };
			}

			if (tweetContent.length > 400) {
				return { error: "Tweet content must be 400 characters or less" };
			}

			const tweetId = Bun.randomUUIDv7();

			const tweet = createTweet.get(
				tweetId,
				user.id,
				tweetContent.trim(),
				reply_to || null,
				source || null,
			);

			if (reply_to) {
				updatePostCounts.run(reply_to);
			}

			return {
				success: true,
				tweet: {
					...tweet,
					author: user,
				},
			};
		} catch (error) {
			console.error("Tweet creation error:", error);
			return { error: "Failed to create tweet" };
		}
	})
	.get("/:id", async ({ params, jwt, headers }) => {
		const { id } = params;

		const tweet = getTweetById.get(id);
		if (!tweet) {
			return { error: "Tweet not found" };
		}

		const threadPosts = getTweetWithThread.all(id);
		const replies = getTweetReplies.all(id);

		let currentUser;
		const authorization = headers.authorization;
		if (!authorization) return { error: "Unauthorized" };

		try {
			currentUser = getUserByUsername.get(
				(await jwt.verify(authorization.replace("Bearer ", ""))).username,
			);
		} catch {
			return { error: "Invalid token" };
		}

		const allPostIds = [
			...threadPosts.map((p) => p.id),
			...replies.map((r) => r.id),
		];
		const postPlaceholders = allPostIds.map(() => "?").join(",");

		const getUserLikesQuery = db.query(
			`SELECT post_id FROM likes WHERE user_id = ? AND post_id IN (${postPlaceholders})`,
		);
		const getUserRetweetsQuery = db.query(
			`SELECT post_id FROM retweets WHERE user_id = ? AND post_id IN (${postPlaceholders})`,
		);

		const userLikes = getUserLikesQuery.all(currentUser.id, ...allPostIds);
		const userRetweets = getUserRetweetsQuery.all(
			currentUser.id,
			...allPostIds,
		);

		const likedPosts = new Set(userLikes.map((like) => like.post_id));
		const retweetedPosts = new Set(
			userRetweets.map((retweet) => retweet.post_id),
		);

		tweet.liked_by_user = likedPosts.has(tweet.id);
		tweet.retweeted_by_user = retweetedPosts.has(tweet.id);

		const allUserIds = [
			...new Set([
				tweet.user_id,
				...threadPosts.map((p) => p.user_id),
				...replies.map((r) => r.user_id),
			]),
		];

		const userPlaceholders = allUserIds.map(() => "?").join(",");
		const getUsersQuery = db.query(
			`SELECT * FROM users WHERE id IN (${userPlaceholders})`,
		);
		const users = getUsersQuery.all(...allUserIds);

		const userMap = new Map(users.map((user) => [user.id, user]));

		const processedThreadPosts = threadPosts.map((post) => ({
			...post,
			liked_by_user: likedPosts.has(post.id),
			retweeted_by_user: retweetedPosts.has(post.id),
			author: userMap.get(post.user_id),
		}));

		const processedReplies = replies.map((reply) => ({
			...reply,
			liked_by_user: likedPosts.has(reply.id),
			retweeted_by_user: retweetedPosts.has(reply.id),
			author: userMap.get(reply.user_id),
		}));

		return {
			tweet: {
				...tweet,
				author: userMap.get(tweet.user_id),
			},
			threadPosts: processedThreadPosts,
			replies: processedReplies,
		};
	})
	.post("/:id/like", async ({ jwt, headers, params }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const { id } = params;
			const existingLike = checkLikeExists.get(user.id, id);

			if (existingLike) {
				removeLike.run(user.id, id);
				updateLikeCount.run(-1, id);
				return { success: true, liked: false };
			} else {
				const likeId = Bun.randomUUIDv7();
				addLike.run(likeId, user.id, id);
				updateLikeCount.run(1, id);
				return { success: true, liked: true };
			}
		} catch (error) {
			console.error("Like toggle error:", error);
			return { error: "Failed to toggle like" };
		}
	})
	.post("/:id/retweet", async ({ jwt, headers, params }) => {
		const authorization = headers.authorization;
		if (!authorization) return { error: "Authentication required" };

		try {
			const payload = await jwt.verify(authorization.replace("Bearer ", ""));
			if (!payload) return { error: "Invalid token" };

			const user = getUserByUsername.get(payload.username);
			if (!user) return { error: "User not found" };

			const { id } = params;
			const tweet = getTweetById.get(id);
			if (!tweet) return { error: "Tweet not found" };

			const existingRetweet = checkRetweetExists.get(user.id, id);

			if (existingRetweet) {
				removeRetweet.run(user.id, id);
				updateRetweetCount.run(-1, id);
				return { success: true, retweeted: false };
			} else {
				const retweetId = Bun.randomUUIDv7();
				addRetweet.run(retweetId, user.id, id);
				updateRetweetCount.run(1, id);
				return { success: true, retweeted: true };
			}
		} catch (error) {
			console.error("Retweet toggle error:", error);
			return { error: "Failed to toggle retweet" };
		}
	});
