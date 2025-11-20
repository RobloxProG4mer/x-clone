import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import db from "../db.js";
import { LRUCache } from "../helpers/cache.js";
import ratelimit from "../helpers/ratelimit.js";

const JWT_SECRET = process.env.JWT_SECRET;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const imageCache = new LRUCache(200, 600000);

const getUserByUsername = db.query(
	"SELECT id FROM users WHERE LOWER(username) = LOWER(?)",
);

export default new Elysia({ prefix: "/unsplash", tags: ["Unsplash"] })
	.use(jwt({ name: "jwt", secret: JWT_SECRET }))
	.use(
		rateLimit({
			duration: 10_000,
			max: 20,
			scoping: "scoped",
			generator: ratelimit,
		}),
	)
	.get(
		"/search",
		async ({ jwt, headers, query }) => {
			const authorization = headers.authorization;
			if (!authorization) return { error: "Authentication required" };

			try {
				const payload = await jwt.verify(authorization.replace("Bearer ", ""));
				if (!payload) return { error: "Invalid token" };

				const user = getUserByUsername.get(payload.username);
				if (!user) return { error: "User not found" };

				const { q = "", limit = 12, page = 1 } = query;

				if (!q || q.trim().length === 0) {
					return { error: "Search query is required" };
				}

				const cacheKey = `unsplash:${q}:${limit}:${page}`;
				const cached = imageCache.get(cacheKey);
				if (cached) {
					return cached;
				}

				const finalLimit = Math.min(parseInt(limit, 10) || 12, 30);
				const url = new URL("https://api.unsplash.com/search/photos");
				url.searchParams.set("query", q);
				url.searchParams.set("per_page", finalLimit.toString());
				url.searchParams.set("page", page.toString());

				const response = await fetch(url.toString(), {
					headers: {
						Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
					},
					signal: AbortSignal.timeout(5000),
				});

				if (!response.ok) {
					console.error("Unsplash API error:", response.status);
					return { error: "Failed to fetch images" };
				}

				const data = await response.json();

				const results = (data.results || []).map((img) => ({
					id: img.id,
					url: img.urls.regular,
					thumb: img.urls.small,
					description:
						img.alt_description || img.description || "Unsplash image",
					download_location: img.links.download_location,
					user: {
						name: img.user.name,
						username: img.user.username,
						link: img.user.links.html,
					},
				}));

				const result = {
					success: true,
					results: results,
					total: data.total,
					total_pages: data.total_pages,
				};

				imageCache.set(cacheKey, result);
				return result;
			} catch (error) {
				console.error("Unsplash search error:", error.message);
				return { error: "Failed to search images" };
			}
		},
		{
			detail: {
				description: "Searches for images using Unsplash API",
			},
			query: t.Object({
				q: t.String(),
				limit: t.Optional(t.String()),
				page: t.Optional(t.String()),
			}),
			response: t.Any(),
		},
	);
