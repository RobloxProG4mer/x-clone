import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import ratelimit from "../helpers/ratelimit.js";

const JWT_SECRET = process.env.JWT_SECRET;

const DATA_DIR = ".data";
const DATA_FILE = join(DATA_DIR, ".trends.json");
const TRENDS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

await mkdir(DATA_DIR, { recursive: true });

const currentTrends = {
	updated: 0,
	eventsHtml: "",
};

const loadTrends = async () => {
	try {
		const raw = await readFile(DATA_FILE, "utf8");
		const data = JSON.parse(raw);

		if (data && typeof data === "object") {
			currentTrends.updated = data.updated ?? 0;
			currentTrends.eventsHtml = data.eventsHtml ?? "";
		}
	} catch {}
};

const updateTrends = async () => {
	currentTrends.updated = Date.now();

	try {
		currentTrends.eventsHtml = await (
			await fetch(
				`https://api.wikimedia.org/core/v1/wikipedia/en/page/Portal:Current_events/html`,
			)
		).text();
	} catch {}

	try {
		await writeFile(DATA_FILE, JSON.stringify(currentTrends, null, 2));
	} catch {}
};

await loadTrends();

if (Date.now() - currentTrends.updated >= TRENDS_UPDATE_INTERVAL_MS) {
	updateTrends();
}

setInterval(updateTrends, TRENDS_UPDATE_INTERVAL_MS);

export default new Elysia({ prefix: "/trends", tags: ["Trends"] })
	.use(jwt({ name: "jwt", secret: JWT_SECRET }))
	.use(
		rateLimit({
			duration: 10_000,
			max: 20,
			scoping: "scoped",
			generator: ratelimit,
		}),
	)
	.get("/", () => currentTrends, {
		detail: {
			description: "Gets current cached trends",
		},
		response: t.Object({
			updated: t.Number(),
			eventsHtml: t.String(),
		}),
	});
