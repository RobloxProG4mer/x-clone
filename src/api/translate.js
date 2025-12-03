import { Elysia, t } from "elysia";

export default new Elysia({ prefix: "/translate" }).post(
	"/",
	async ({ body, headers, set }) => {
		const { text, source, target } = body;

		if (!text || text.trim().length === 0) {
			set.status = 400;
			return { error: "Text is required" };
		}

		const token = headers.authorization?.split(" ")[1];
		if (!token) {
			set.status = 401;
			return { error: "Unauthorized" };
		}

		try {
			const sourceLang = source || "auto";
			const targetLang = target || "en";

			const url = new URL("https://translate.google.com/translate_a/single");
			url.searchParams.set("client", "gtx");
			url.searchParams.set("sl", sourceLang);
			url.searchParams.set("tl", targetLang);
			url.searchParams.set("dt", "t");
			url.searchParams.set("q", text);

			const response = await fetch(url.toString(), {
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				},
			});

			if (!response.ok) {
				const errorData = await response.text();
				console.error("Google Translate error:", errorData);
				set.status = 500;
				return { error: "Translation service unavailable" };
			}

			const data = await response.json();

			let translatedText = "";
			if (Array.isArray(data) && Array.isArray(data[0])) {
				for (const segment of data[0]) {
					if (Array.isArray(segment) && segment[0]) {
						translatedText += segment[0];
					}
				}
			}

			const detectedLanguage =
				Array.isArray(data) && data[2] ? data[2] : sourceLang;

			return {
				success: true,
				translatedText: translatedText,
				detectedLanguage: detectedLanguage,
			};
		} catch (err) {
			console.error("Translation error:", err);
			set.status = 500;
			return { error: "Translation failed" };
		}
	},
	{
		body: t.Object({
			text: t.String(),
			source: t.String(),
			target: t.String(),
		}),
		detail: {
			description: "Translate text using Google Translate",
			tags: ["Translation"],
		},
	},
);
