import { Elysia } from "elysia";
import db from "../db.js";

const stripHtml = (html) => {
	return html.replace(/<[^>]*>?/gm, "");
};

const esc = (str) =>
	str
		?.replaceAll('"', "&quot;")
		?.replaceAll("<", "&lt;")
		?.replaceAll(">", "&gt;");

const getTweetById = db.query(`SELECT * FROM posts WHERE id = ?`);
const getUserById = db.query(`SELECT * FROM users WHERE id = ?`);

export const embeds = new Elysia({ name: "generateEmbeds" })
	.mapResponse(({ request, response, set }) => {
		if (request.url.endsWith("?rb=1")) return response;
		const userAgent = request.headers.get("user-agent")?.toLowerCase() || "";
		if (!userAgent) return response;
		const goodMatches = ["applewebkit", "chrome/", "firefox/", "safari/"];
		if (
			goodMatches.some((match) => userAgent.includes(match)) &&
			!userAgent.includes("discord")
		) {
			return response;
		}

		const pathname = new URL(request.url).pathname;
		if (!pathname?.startsWith("/tweet/")) return response;

		set.headers["Content-Type"] = "text/html; charset=utf-8";

		const tweetId = pathname.replaceAll("/tweet/", "").split("/")[0];
		const tweet = getTweetById.get(tweetId);

		if (!tweet) {
			return `<!DOCTYPE html><html><head><meta property="og:title" content="Tweetapus"/><meta property="og:description" content="Tweet not found"/></head><body>Tweet not found.</body></html>`;
		}

		const author = getUserById.get(tweet.user_id);
		const authorName = author ? author.name || author.username : "Unknown";
		const authorHandle = author ? author.username : "unknown";

		let cleanContent = stripHtml(tweet.content || "");
		if (cleanContent.length > 350) {
			cleanContent = `${cleanContent.substring(0, 350)}…`;
		}

		const imageUrl = tweet.image_url || tweet.attachment_url || null;

		let imageMeta = "";
		if (imageUrl) {
			imageMeta = `
                <meta property="twitter:image" content="${imageUrl}" />
                <meta property="og:image" content="${imageUrl}" />
            `;
		}

		const statsString = `💬 ${tweet.reply_count || 0}   🔁 ${tweet.retweet_count || 0}   ❤️ ${tweet.like_count || 0}   👁️ ${tweet.view_count || 0}`;

		return `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta name="application-title" content="Tweetapus" />
                <link rel="canonical" href="${process.env.BASE_URL}/tweet/${tweetId}"/>
                <meta property="og:url" content="${process.env.BASE_URL}/tweet/${tweetId}"/>
                <meta property="theme-color" content="#AC97FF"/>
                
                <meta property="og:title" content="${esc(authorName)} (@${authorHandle})"/>
                <meta property="og:description" content="${esc(cleanContent)}"/>
                <meta property="og:site_name" content="Tweetapus"/>
                
                <meta property="twitter:card" content="summary_large_image"/>
                <meta property="twitter:title" content="${esc(authorName)} (@${authorHandle})"/>
                <meta property="twitter:description" content="${esc(cleanContent)}"/>
                ${imageMeta}
                
                <meta http-equiv="refresh" content="0;url=${process.env.BASE_URL}/tweet/${tweetId}?rb=1"/>
                
                <link rel="alternate" 
                    href="${process.env.BASE_URL}/api/owooembed?author=${encodeURIComponent(authorName)}&handle=${encodeURIComponent(authorHandle)}&stats=${encodeURIComponent(statsString)}" 
                    type="application/json+oembed" 
                    title="${esc(authorName)} (@${authorHandle})"
                >
            </head>
            <body></body>
        </html>`;
	})
	.as("plugin");
