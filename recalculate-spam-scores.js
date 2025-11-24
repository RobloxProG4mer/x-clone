import db from "./src/db.js";
import { calculateSpamScore } from "./src/helpers/spam-detection.js";

console.log("Recalculating spam scores for all users...");

const users = db.query("SELECT id, username FROM users").all();

let updated = 0;
for (const user of users) {
	try {
		const newScore = calculateSpamScore(user.id);
		console.log(`${user.username}: ${(newScore * 100).toFixed(1)}%`);
		updated++;
	} catch (error) {
		console.error(`Error updating ${user.username}:`, error.message);
	}
}

console.log(`\nUpdated ${updated} out of ${users.length} users.`);
