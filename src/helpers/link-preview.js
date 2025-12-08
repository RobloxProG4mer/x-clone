import db from "../db.js";

const getLinkPreviewQuery = db.query(
	"SELECT * FROM link_previews WHERE post_id = ?",
);

const createLinkPreviewQuery = db.query(
	"INSERT INTO link_previews (id, post_id, url, title, description, image, site_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
);

export async function fetchLinkPreview(url) {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000);

		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				"User-Agent":
					"Mozilla/5.0 (compatible; TweetapusBot/1.0; +https://tweetapus.com)",
			},
		});
		clearTimeout(timeoutId);

		if (!response.ok) return null;

		const html = await response.text();

		const getMetaContent = (property, name) => {
			const propMatch = html.match(
				new RegExp(
					`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`,
					"i",
				),
			);
			const nameMatch = html.match(
				new RegExp(
					`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`,
					"i",
				),
			);
			return propMatch?.[1] || nameMatch?.[1] || null;
		};

		const title =
			getMetaContent("og:title", "title") ||
			html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
			null;

		const description =
			getMetaContent("og:description", "description") ||
			getMetaContent("twitter:description", "description") ||
			null;

		const image =
			getMetaContent("og:image", "image") ||
			getMetaContent("twitter:image", "image") ||
			null;

		const siteName = getMetaContent("og:site_name", "site_name") || null;

		return {
			url,
			title: title?.trim(),
			description: description?.trim(),
			image: image?.trim(),
			site_name: siteName?.trim(),
		};
	} catch (error) {
		console.error("Failed to fetch link preview:", error);
		return null;
	}
}

export async function getOrFetchLinkPreview(url, postId) {
	const existing = getLinkPreviewQuery.get(postId);

	if (existing) {
		return existing;
	}

	const preview = await fetchLinkPreview(url);
	if (!preview) return null;

	const previewId = Bun.randomUUIDv7();
	createLinkPreviewQuery.run(
		previewId,
		postId,
		preview.url,
		preview.title,
		preview.description,
		preview.image,
		preview.site_name,
	);

	return { ...preview, id: previewId, post_id: postId };
}

export function extractUrls(content) {
	const urlRegex =
		/(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/g;
	const urls = content.match(urlRegex) || [];
	return [...new Set(urls)].map((url) => {
		if (!url.startsWith("http://") && !url.startsWith("https://")) {
			return "https://" + url;
		}
		return url;
	});
}
