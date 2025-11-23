import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import db from "./../db.js";
import ratelimit from "../helpers/ratelimit.js";

const JWT_SECRET = process.env.JWT_SECRET;

const getUserByUsername = db.prepare(
	"SELECT id FROM users WHERE LOWER(username) = LOWER(?)",
);
const getUserById = db.prepare("SELECT id FROM users WHERE id = ?");
const checkBlockExists = db.prepare(
	"SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?",
);
const addBlock = db.prepare(
	"INSERT INTO blocks (id, blocker_id, blocked_id, source_tweet_id) VALUES (?, ?, ?, ?)",
);
const removeBlock = db.prepare(
	"DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?",
);
const removeFollows = db.prepare(
	"DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)",
);
const removeFollowRequests = db.prepare(
	"DELETE FROM follow_requests WHERE (requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)",
);
const incrementBlockedByCount = db.prepare(
	"UPDATE users SET blocked_by_count = blocked_by_count + 1 WHERE id = ?",
);
const decrementBlockedByCount = db.prepare(
	"UPDATE users SET blocked_by_count = MAX(0, blocked_by_count - 1) WHERE id = ?",
);
const checkMuteExists = db.prepare(
	"SELECT 1 FROM mutes WHERE muter_id = ? AND muted_id = ?",
);
const addMute = db.prepare(
	"INSERT INTO mutes (id, muter_id, muted_id) VALUES (?, ?, ?)",
);
const removeMute = db.prepare(
	"DELETE FROM mutes WHERE muter_id = ? AND muted_id = ?",
);
const incrementMutedByCount = db.prepare(
	"UPDATE users SET muted_by_count = muted_by_count + 1 WHERE id = ?",
);
const decrementMutedByCount = db.prepare(
	"UPDATE users SET muted_by_count = MAX(0, muted_by_count - 1) WHERE id = ?",
);

export default new Elysia({ prefix: "/blocking", tags: ["Blocking"] })
	.use(jwt({ name: "jwt", secret: JWT_SECRET }))
	.use(
		rateLimit({
			duration: 10_000,
			max: 30,
			scoping: "scoped",
			generator: ratelimit,
		}),
	)
	.post(
		"/block",
		async ({ jwt, headers, body }) => {
			const authorization = headers.authorization;
			if (!authorization) return { error: "Authentication required" };

			try {
				const payload = await jwt.verify(authorization.replace("Bearer ", ""));
				if (!payload) return { error: "Invalid token" };

				const user = getUserByUsername.get(payload.username);
				if (!user) return { error: "User not found" };

				const { userId } = body;
				if (!userId) return { error: "User ID is required" };

				if (userId === user.id) {
					return { error: "You cannot block yourself" };
				}

				const targetUser = getUserById.get(userId);
				if (!targetUser) return { error: "Target user not found" };

				const existingBlock = checkBlockExists.get(user.id, userId);
				if (existingBlock) {
					return { error: "User is already blocked" };
				}

				addBlock.run(Bun.randomUUIDv7(), user.id, userId, body.sourceTweetId || null);
				removeFollows.run(user.id, userId, userId, user.id);
				removeFollowRequests.run(user.id, userId, userId, user.id);
				incrementBlockedByCount.run(userId);

				return { success: true, blocked: true };
			} catch (error) {
				console.error("Block user error:", error);
				return { error: "Failed to block user" };
			}
		},
		{
			detail: {
				description: "Blocks a user",
			},
			body: t.Object({
				userId: t.String(),
				sourceTweetId: t.Optional(t.String()),
			}),
			response: t.Object({
				success: t.Optional(t.Boolean()),
				error: t.Optional(t.String()),
				blocked: t.Optional(t.Boolean()),
			}),
		},
	)
	.post(
		"/unblock",
		async ({ jwt, headers, body }) => {
			const authorization = headers.authorization;
			if (!authorization) return { error: "Authentication required" };

			try {
				const payload = await jwt.verify(authorization.replace("Bearer ", ""));
				if (!payload) return { error: "Invalid token" };

				const user = getUserByUsername.get(payload.username);
				if (!user) return { error: "User not found" };

				const { userId } = body;
				if (!userId) return { error: "User ID is required" };

				const existingBlock = checkBlockExists.get(user.id, userId);
				if (!existingBlock) {
					return { error: "User is not blocked" };
				}

				removeBlock.run(user.id, userId);
				decrementBlockedByCount.run(userId);

				return { success: true, blocked: false };
			} catch (error) {
				console.error("Unblock user error:", error);
				return { error: "Failed to unblock user" };
			}
		},
		{
			detail: {
				description: "Unblocks a user",
			},
			body: t.Object({
				userId: t.String(),
			}),
			response: t.Object({
				success: t.Optional(t.Boolean()),
				error: t.Optional(t.String()),
				blocked: t.Optional(t.Boolean()),
			}),
		},
	)
	.get(
		"/check/:userId",
		async ({ jwt, headers, params }) => {
			const authorization = headers.authorization;
			if (!authorization) return { error: "Authentication required" };

			try {
				const payload = await jwt.verify(authorization.replace("Bearer ", ""));
				if (!payload) return { error: "Invalid token" };

				const user = getUserByUsername.get(payload.username);
				if (!user) return { error: "User not found" };

				const isBlocked = checkBlockExists.get(user.id, params.userId);

				return {
					success: true,
					blocked: !!isBlocked,
				};
			} catch (error) {
				console.error("Check block status error:", error);
				return { error: "Failed to check block status" };
			}
		},
		{
			detail: {
				description: "Checks if a user is blocked",
			},
			params: t.Object({
				userId: t.String(),
			}),
			response: t.Object({
				success: t.Optional(t.Boolean()),
				error: t.Optional(t.String()),
				blocked: t.Optional(t.Boolean()),
			}),
		},
	)
	.post(
		"/mute",
		async ({ jwt, headers, body }) => {
			const authorization = headers.authorization;
			if (!authorization) return { error: "Authentication required" };

			try {
				const payload = await jwt.verify(authorization.replace("Bearer ", ""));
				if (!payload) return { error: "Invalid token" };

				const user = getUserByUsername.get(payload.username);
				if (!user) return { error: "User not found" };

				const { userId } = body;
				if (!userId) return { error: "User ID is required" };

				if (userId === user.id) {
					return { error: "You cannot mute yourself" };
				}

				const targetUser = getUserById.get(userId);
				if (!targetUser) return { error: "Target user not found" };

				const existingMute = checkMuteExists.get(user.id, userId);
				if (existingMute) {
					return { error: "User is already muted" };
				}

				addMute.run(Bun.randomUUIDv7(), user.id, userId);
				incrementMutedByCount.run(userId);

				return { success: true, muted: true };
			} catch (error) {
				console.error("Mute user error:", error);
				return { error: "Failed to mute user" };
			}
		},
		{
			detail: {
				description: "Mutes a user",
			},
			body: t.Object({
				userId: t.String(),
			}),
			response: t.Object({
				success: t.Optional(t.Boolean()),
				error: t.Optional(t.String()),
				muted: t.Optional(t.Boolean()),
			}),
		},
	)
	.post(
		"/unmute",
		async ({ jwt, headers, body }) => {
			const authorization = headers.authorization;
			if (!authorization) return { error: "Authentication required" };

			try {
				const payload = await jwt.verify(authorization.replace("Bearer ", ""));
				if (!payload) return { error: "Invalid token" };

				const user = getUserByUsername.get(payload.username);
				if (!user) return { error: "User not found" };

				const { userId } = body;
				if (!userId) return { error: "User ID is required" };

				const existingMute = checkMuteExists.get(user.id, userId);
				if (!existingMute) {
					return { error: "User is not muted" };
				}

				removeMute.run(user.id, userId);
				decrementMutedByCount.run(userId);

				return { success: true, muted: false };
			} catch (error) {
				console.error("Unmute user error:", error);
				return { error: "Failed to unmute user" };
			}
		},
		{
			detail: {
				description: "Unmutes a user",
			},
			body: t.Object({
				userId: t.String(),
			}),
			response: t.Object({
				success: t.Optional(t.Boolean()),
				error: t.Optional(t.String()),
				muted: t.Optional(t.Boolean()),
			}),
		},
	)
	.get(
		"/check-mute/:userId",
		async ({ jwt, headers, params }) => {
			const authorization = headers.authorization;
			if (!authorization) return { error: "Authentication required" };

			try {
				const payload = await jwt.verify(authorization.replace("Bearer ", ""));
				if (!payload) return { error: "Invalid token" };

				const user = getUserByUsername.get(payload.username);
				if (!user) return { error: "User not found" };

				const isMuted = checkMuteExists.get(user.id, params.userId);

				return {
					success: true,
					muted: !!isMuted,
				};
			} catch (error) {
				console.error("Check mute status error:", error);
				return { error: "Failed to check mute status" };
			}
		},
		{
			detail: {
				description: "Checks if a user is muted",
			},
			params: t.Object({
				userId: t.String(),
			}),
			response: t.Object({
				success: t.Optional(t.Boolean()),
				error: t.Optional(t.String()),
				muted: t.Optional(t.Boolean()),
			}),
		},
	)
	.get(
		"/causes",
		async ({ jwt, headers }) => {
			const authorization = headers.authorization;
			if (!authorization) return { error: "Authentication required" };

			try {
				const payload = await jwt.verify(authorization.replace("Bearer ", ""));
				if (!payload) return { error: "Invalid token" };

				const user = getUserByUsername.get(payload.username);
				if (!user) return { error: "User not found" };

				const blocks = db
					.query(
						`
					SELECT 
						b.source_tweet_id, 
						COUNT(*) as count,
						p.content,
						p.created_at
					FROM blocks b
					LEFT JOIN posts p ON b.source_tweet_id = p.id
					WHERE b.blocked_id = ? AND b.source_tweet_id IS NOT NULL
					GROUP BY b.source_tweet_id
					ORDER BY count DESC
					LIMIT 50
				`,
					)
					.all(user.id);

				return {
					success: true,
					causes: blocks,
				};
			} catch (error) {
				console.error("Get block causes error:", error);
				return { error: "Failed to get block causes" };
			}
		},
		{
			detail: {
				description: "Gets tweets that caused the user to be blocked",
			},
			response: t.Object({
				success: t.Optional(t.Boolean()),
				error: t.Optional(t.String()),
				causes: t.Optional(t.Any()),
			}),
		},
	);
