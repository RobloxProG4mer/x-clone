import query from "./api.js";

const LANGUAGE_NAMES = {
	eng: "English",
	spa: "Spanish",
	fra: "French",
	deu: "German",
	ita: "Italian",
	por: "Portuguese",
	nld: "Dutch",
	pol: "Polish",
	rus: "Russian",
	jpn: "Japanese",
	zho: "Chinese",
	kor: "Korean",
	ara: "Arabic",
	hin: "Hindi",
	tur: "Turkish",
	vie: "Vietnamese",
	tha: "Thai",
	ind: "Indonesian",
	ces: "Czech",
	ukr: "Ukrainian",
	ron: "Romanian",
	hun: "Hungarian",
	ell: "Greek",
	heb: "Hebrew",
	swe: "Swedish",
	dan: "Danish",
	fin: "Finnish",
	nor: "Norwegian",
	cat: "Catalan",
	bul: "Bulgarian",
	hrv: "Croatian",
	slk: "Slovak",
	lit: "Lithuanian",
	lav: "Latvian",
	est: "Estonian",
	slv: "Slovenian",
	fas: "Persian",
	und: "Unknown",
};

const ISO639_3_TO_1 = {
	eng: "en",
	spa: "es",
	fra: "fr",
	deu: "de",
	ita: "it",
	por: "pt",
	nld: "nl",
	pol: "pl",
	rus: "ru",
	jpn: "ja",
	zho: "zh",
	kor: "ko",
	ara: "ar",
	hin: "hi",
	tur: "tr",
	vie: "vi",
	tha: "th",
	ind: "id",
	ces: "cs",
	ukr: "uk",
	ron: "ro",
	hun: "hu",
	ell: "el",
	heb: "he",
	swe: "sv",
	dan: "da",
	fin: "fi",
	nor: "no",
	cat: "ca",
	bul: "bg",
	hrv: "hr",
	slk: "sk",
	lit: "lt",
	lav: "lv",
	est: "et",
	slv: "sl",
	fas: "fa",
};

let francModule = null;
let francLoadPromise = null;

async function loadFranc() {
	if (francModule) return francModule;
	if (francLoadPromise) return francLoadPromise;
	
	francLoadPromise = new Promise((resolve) => {
		const script = document.createElement("script");
		script.src = "https://cdn.jsdelivr.net/npm/franc-min@6.2.0/+esm";
		script.type = "module";
		
		const moduleScript = document.createElement("script");
		moduleScript.type = "module";
		moduleScript.textContent = `
			import { franc } from "https://cdn.jsdelivr.net/npm/franc-min@6.2.0/+esm";
			window.__francMin = { franc };
			window.dispatchEvent(new Event("franc-loaded"));
		`;
		
		window.addEventListener("franc-loaded", () => {
			francModule = window.__francMin;
			resolve(francModule);
		}, { once: true });
		
		document.head.appendChild(moduleScript);
	});
	
	return francLoadPromise;
}

export async function detectLanguage(text) {
	if (!text || text.trim().length < 50) {
		return { lang: "und", confidence: 0 };
	}

	const cleanText = text
		.replace(/@\w+/g, "")
		.replace(/#\w+/g, "")
		.replace(/https?:\/\/[^\s]+/g, "")
		.replace(/:\w+:/g, "")
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.trim();

	if (cleanText.length < 50) {
		return { lang: "und", confidence: 0 };
	}

	const franc = await loadFranc();
	if (!franc) {
		return { lang: "und", confidence: 0 };
	}

	const detected = franc.franc(cleanText, { minLength: 30, only: ["eng", "spa", "fra", "deu", "ita", "por", "nld", "pol", "rus", "jpn", "zho", "kor", "ara", "hin", "tur", "vie", "ind", "ukr"] });
	return { lang: detected, confidence: detected !== "und" ? 0.8 : 0 };
}

export function getLanguageName(langCode) {
	return LANGUAGE_NAMES[langCode] || langCode;
}

export function getIso1Code(iso3Code) {
	return ISO639_3_TO_1[iso3Code] || iso3Code;
}

export function isNonEnglish(langCode) {
	return langCode !== "eng" && langCode !== "und";
}

export async function translateText(text, sourceLang, targetLang = "en") {
	const sourceIso1 = getIso1Code(sourceLang);
	
	const result = await query("/translate", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			text: text,
			source: sourceIso1,
			target: targetLang,
		}),
	});

	if (result.error) {
		throw new Error(result.error);
	}

	return result.translatedText;
}

export function createTranslateButton(tweet, contentElement) {
	const translateContainer = document.createElement("div");
	translateContainer.className = "tweet-translate-container";

	const translateBtn = document.createElement("button");
	translateBtn.type = "button";
	translateBtn.className = "tweet-translate-btn";
	translateBtn.textContent = "Translate tweet";

	let isTranslated = false;
	let originalContent = null;
	let detectedLang = null;

	translateBtn.addEventListener("click", async (e) => {
		e.preventDefault();
		e.stopPropagation();

		if (isTranslated) {
			contentElement.innerHTML = originalContent;
			translateBtn.textContent = `Translate tweet`;
			isTranslated = false;
			return;
		}

		translateBtn.disabled = true;
		translateBtn.textContent = "Translating…";

		try {
			const textToTranslate = tweet.content || "";
			
			if (!detectedLang) {
				const detection = await detectLanguage(textToTranslate);
				detectedLang = detection.lang;
			}

			const translated = await translateText(textToTranslate, detectedLang, "en");
			
			originalContent = contentElement.innerHTML;
			
			const translatedDiv = document.createElement("div");
			translatedDiv.className = "tweet-translated-content";
			translatedDiv.textContent = translated;
			
			contentElement.innerHTML = "";
			contentElement.appendChild(translatedDiv);
			
			translateBtn.textContent = `Show original (${getLanguageName(detectedLang)})`;
			isTranslated = true;
		} catch (err) {
			console.error("Translation error:", err);
			translateBtn.textContent = "Translation failed. Try again";
		}

		translateBtn.disabled = false;
	});

	translateContainer.appendChild(translateBtn);
	return translateContainer;
}

export async function maybeAddTranslation(tweet, tweetElement, contentElement) {
	if (!tweet.content || tweet.content.trim().length < 15) {
		return;
	}

	const detection = await detectLanguage(tweet.content);
	
	if (!isNonEnglish(detection.lang)) {
		return;
	}

	const translateContainer = createTranslateButton(tweet, contentElement);
	
	const factCheck = tweetElement.querySelector(".fact-check-banner");
	if (factCheck) {
		factCheck.insertAdjacentElement("beforebegin", translateContainer);
	} else {
		contentElement.insertAdjacentElement("afterend", translateContainer);
	}
}
