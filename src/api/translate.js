import { Elysia, t } from "elysia";

const LIBRETRANSLATE_URL =
	process.env.LIBRETRANSLATE_URL || "https://libretranslate.com";
const LIBRETRANSLATE_API_KEY = process.env.LIBRETRANSLATE_API_KEY || "";

export default new Elysia({ prefix: "/translate" })
	.post(
		"/",
		async ({ body, headers, set }) => {
			const { text, source, target } = body;

			if (!text || text.trim().length === 0) {
				set.status = 400;
				return { error: "Text is required" };
			}

			if (!source || !target) {
				set.status = 400;
				return { error: "Source and target languages are required" };
			}

			const token = headers.authorization?.split(" ")[1];
			if (!token) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			try {
				const requestBody = {
					q: text,
					source: source,
					target: target,
					format: "text",
				};

				if (LIBRETRANSLATE_API_KEY) {
					requestBody.api_key = LIBRETRANSLATE_API_KEY;
				}

				const response = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				});

				if (!response.ok) {
					const errorData = await response.text();
					console.error("LibreTranslate error:", errorData);
					set.status = 500;
					return { error: "Translation service unavailable" };
				}

				const data = await response.json();

				return {
					success: true,
					translatedText: data.translatedText,
					detectedLanguage: data.detectedLanguage || source,
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
				description: "Translate text using LibreTranslate",
				tags: ["Translation"],
			},
		},
	)
	.get(
		"/languages",
		async ({ set }) => {
			try {
				const response = await fetch(`${LIBRETRANSLATE_URL}/languages`);

				if (!response.ok) {
					set.status = 500;
					return { error: "Failed to fetch languages" };
				}

				const languages = await response.json();
				return { languages };
			} catch (err) {
				console.error("Languages fetch error:", err);
				set.status = 500;
				return { error: "Failed to fetch languages" };
			}
		},
		{
			detail: {
				description: "Get supported languages from LibreTranslate",
				tags: ["Translation"],
			},
		},
	);
