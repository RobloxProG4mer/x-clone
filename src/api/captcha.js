import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import db from "../db.js";

// Store captchas in memory with expiry
const captchaStore = new Map();

// Clean up old captchas every minute
setInterval(() => {
	const now = Date.now();
	for (const [id, data] of captchaStore.entries()) {
		if (now > data.expiresAt) {
			captchaStore.delete(id);
		}
	}
}, 60000);

export default new Elysia({ prefix: "/captcha", tags: ["Captcha"] })
	.use(jwt({ name: "jwt", secret: process.env.JWT_SECRET }))
	.get("/", () => {
		const num1 = Math.floor(Math.random() * 10);
		const num2 = Math.floor(Math.random() * 10);
		const id = Bun.randomUUIDv7();

		captchaStore.set(id, {
			answer: num1 + num2,
			expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
		});

		return {
			id,
			challenge: `What is ${num1} + ${num2}?`,
		};
	})
	.post(
		"/verify",
		async ({ body, jwt, headers }) => {
			const { id, answer } = body;
			const stored = captchaStore.get(id);

			if (!stored) return { error: "Invalid or expired captcha" };

			// One-time use
			captchaStore.delete(id);

			if (parseInt(answer) !== stored.answer) {
				return { error: "Incorrect answer" };
			}

			const token = headers.authorization?.replace("Bearer ", "");
			if (!token) return { success: true };

			try {
				const payload = await jwt.verify(token);
				if (payload) {
					const user = db
						.prepare("SELECT id, shadowbanned FROM users WHERE username = ?")
						.get(payload.username);
					if (user && user.shadowbanned) {
						// Check if shadowban is automated
						const suspension = db
							.prepare(
								"SELECT * FROM suspensions WHERE user_id = ? AND action = 'shadowban' AND status = 'active' AND reason LIKE 'Automated%'",
							)
							.get(user.id);

						if (suspension) {
							// Lift shadowban
							db.prepare(
								"UPDATE users SET shadowbanned = FALSE WHERE id = ?",
							).run(user.id);
							db.prepare(
								"UPDATE suspensions SET status = 'lifted' WHERE id = ?",
							).run(suspension.id);
							// Reset spam score
							db.prepare("UPDATE users SET spam_score = 0 WHERE id = ?").run(
								user.id,
							);

							// Log the lift
							db.prepare(`
                            INSERT INTO moderation_logs (id, moderator_id, action, target_type, target_id, details, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                         `).run(
								Bun.randomUUIDv7(),
								user.id, // User lifted it themselves
								"lift_shadowban",
								"user",
								user.id,
								JSON.stringify({ reason: "Captcha solved" }),
								new Date().toISOString(),
							);

							return { success: true, message: "Shadowban lifted" };
						}
					}
				}
			} catch (e) {
				console.error("Error verifying captcha user:", e);
			}

			return { success: true };
		},
		{
			body: t.Object({
				id: t.String(),
				answer: t.String(), // Accepting string to parse int later
			}),
		},
	);
