#!/usr/bin/env bun

import db from "../src/db.js";
import {
	calculateSpamScore,
	calculateSpamScoreWithDetails,
} from "../src/helpers/spam-detection.js";

const args = process.argv.slice(2);
const userId = args[0];

if (!userId) {
	console.error("Usage: bun scripts/check-spam.js <user_id>");
	console.log("\nAvailable users (sorted by spam score):");
	const users = db
		.prepare(
			"SELECT id, username, spam_score FROM users ORDER BY spam_score DESC LIMIT 15",
		)
		.all();
	users.forEach((u) => {
		const pct = ((u.spam_score || 0) * 100).toFixed(1);
		const bar = "█"
			.repeat(Math.round((u.spam_score || 0) * 20))
			.padEnd(20, "░");
		console.log(
			`  ${u.id.slice(0, 12).padEnd(14)} @${u.username.padEnd(18)} ${bar} ${pct}%`,
		);
	});
	process.exit(1);
}

console.log("\n" + "=".repeat(75));
console.log("  SPAM SCORE ANALYSIS");
console.log("=".repeat(75));

const userBefore = db
	.prepare("SELECT username, spam_score FROM users WHERE id = ?")
	.get(userId);
if (!userBefore) {
	console.error("User not found");
	process.exit(1);
}

console.log(`\n📊 User: @${userBefore.username}`);
console.log(
	`📈 Current spam score: ${((userBefore.spam_score || 0) * 100).toFixed(1)}%\n`,
);

console.log("🔄 Recalculating with improved algorithm...\n");
const newScore = calculateSpamScore(userId);

const details = calculateSpamScoreWithDetails(userId);

console.log("-".repeat(75));
console.log("  INDICATOR BREAKDOWN");
console.log("-".repeat(75));

if (details.indicators && details.indicators.length > 0) {
	details.indicators.sort((a, b) => b.score * b.weight - a.score * a.weight);
	for (const ind of details.indicators) {
		const contribution = (ind.score * ind.weight * 100).toFixed(1);
		const bar = "█".repeat(Math.round(ind.score * 15)).padEnd(15, "░");
		const emoji = ind.score > 0.6 ? "🔴" : ind.score > 0.3 ? "🟡" : "🟢";
		console.log(
			`${emoji} ${ind.displayName.padEnd(26)} ${bar} ${(ind.score * 100).toFixed(0).padStart(3)}% (w=${ind.weight.toFixed(2)}) +${contribution}%`,
		);
		console.log(`   └─ ${ind.details}`);
	}
}

console.log("-".repeat(75));

const userAfter = db
	.prepare("SELECT spam_score FROM users WHERE id = ?")
	.get(userId);
console.log(
	`\n✅ Final spam score: ${((userAfter.spam_score || 0) * 100).toFixed(1)}%`,
);
console.log(`   ${details.message}`);

const diff = ((userAfter.spam_score || 0) - (userBefore.spam_score || 0)) * 100;
if (diff > 0.1) {
	console.log(`   ⬆️  Increased by ${diff.toFixed(1)}%`);
} else if (diff < -0.1) {
	console.log(`   ⬇️  Decreased by ${Math.abs(diff).toFixed(1)}%`);
} else {
	console.log(`   ➡️  No significant change`);
}

if ((userAfter.spam_score || 0) > 0.95) {
	console.log("\n⚠️  HIGH SPAM SCORE - User will be shadowbanned automatically");
} else if ((userAfter.spam_score || 0) > 0.7) {
	console.log("\n⚠️  ELEVATED SPAM SCORE - Manual review recommended");
}

console.log("\n" + "=".repeat(75) + "\n");
