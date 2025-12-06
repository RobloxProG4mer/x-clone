const rateLimitStore = new Map();
const violationStore = new Map();
const capBypassStore = new Map();

const FOUR_MINUTES = 240000;

const RATE_LIMITS = {
	default: { max: 500, duration: FOUR_MINUTES },
	auth: { max: 20, duration: FOUR_MINUTES },
	upload: { max: 50, duration: FOUR_MINUTES },
	dm: { max: 200, duration: FOUR_MINUTES },
	post: { max: 100, duration: FOUR_MINUTES },
	rapid_post: { max: 3, duration: 3000 },
	sensitive: { max: 15, duration: FOUR_MINUTES },
	search: { max: 150, duration: FOUR_MINUTES },
	timeline: { max: 300, duration: FOUR_MINUTES },
	like: { max: 200, duration: FOUR_MINUTES },
	rapid_like: { max: 10, duration: 5000 },
	reply: { max: 100, duration: FOUR_MINUTES },
	rapid_reply: { max: 5, duration: 5000 },
	retweet: { max: 150, duration: FOUR_MINUTES },
	rapid_retweet: { max: 2, duration: 5000 },
	follow: { max: 100, duration: FOUR_MINUTES },
	rapid_follow: { max: 10, duration: 5000 },
	block: { max: 50, duration: FOUR_MINUTES },
	mute: { max: 50, duration: FOUR_MINUTES },
};

function cleanupExpired() {
	const now = Date.now();
	for (const [key, data] of rateLimitStore.entries()) {
		if (now - data.resetTime > data.duration + 5000) {
			rateLimitStore.delete(key);
		}
	}
	for (const [key, data] of violationStore.entries()) {
		if (now - data.lastViolation > 3600000) {
			violationStore.delete(key);
		}
	}
	for (const [key, expiry] of capBypassStore.entries()) {
		if (now > expiry) {
			capBypassStore.delete(key);
		}
	}
}

setInterval(cleanupExpired, 60000);

export function grantCapBypass(identifier) {
	capBypassStore.set(identifier, Date.now() + 30000);
	for (const [key] of rateLimitStore.entries()) {
		if (key.endsWith(`:${identifier}`)) {
			rateLimitStore.delete(key);
		}
	}
	violationStore.delete(identifier);
}

export function hasCapBypass(identifier) {
	const expiry = capBypassStore.get(identifier);
	if (expiry && Date.now() < expiry) {
		capBypassStore.delete(identifier);
		return true;
	}
	return false;
}

export function checkRateLimit(identifier, limitType = "default") {
	if (hasCapBypass(identifier)) {
		const config = RATE_LIMITS[limitType] || RATE_LIMITS.default;
		return {
			isLimited: false,
			remaining: config.max,
			resetIn: 0,
			limit: config.max,
			violations: 0,
		};
	}

	const config = RATE_LIMITS[limitType] || RATE_LIMITS.default;
	const key = `${limitType}:${identifier}`;
	const now = Date.now();

	let data = rateLimitStore.get(key);
	const violations = violationStore.get(identifier) || {
		count: 0,
		lastViolation: 0,
	};

	if (!data || now - data.resetTime > config.duration) {
		data = {
			count: 0,
			resetTime: now,
			duration: config.duration,
		};
		rateLimitStore.set(key, data);
	}

	data.count++;

	const remaining = Math.max(0, config.max - data.count);
	const isLimited = data.count > config.max;

	if (isLimited) {
		violations.count++;
		violations.lastViolation = now;
		violationStore.set(identifier, violations);
	}

	return {
		isLimited,
		remaining,
		resetIn: Math.ceil((data.resetTime + config.duration - now) / 1000),
		limit: config.max,
		violations: violations.count,
	};
}

export function checkMultipleRateLimits(identifier, limitTypes) {
	for (const limitType of limitTypes) {
		const result = checkRateLimit(identifier, limitType);
		if (result.isLimited) {
			result.limitType = limitType;
			return result;
		}
	}
	return { isLimited: false };
}

export function getRateLimitMiddleware(limitType = "default") {
	const limitTypes = Array.isArray(limitType) ? limitType : [limitType];
	return ({ headers, request, set }) => {
		if (request.method === "GET") return;
		const token = headers.authorization?.split(" ")[1];
		if (!token) return;
		const result = checkMultipleRateLimits(token, limitTypes);

		set.headers["X-RateLimit-Limit"] = result.limit?.toString() || "0";
		set.headers["X-RateLimit-Remaining"] = result.remaining?.toString() || "0";
		set.headers["X-RateLimit-Reset"] = result.resetIn?.toString() || "0";

		if (result.isLimited) {
			set.status = 429;
			const backoffMs = Math.min(result.violations * 1000, 30000);
			return {
				error: "Too many requests",
				resetIn: result.resetIn,
				retryAfter: Math.ceil(backoffMs / 1000),
				limitType: result.limitType,
			};
		}
	};
}

export function getActionRateLimiter(shortLimit, burstLimit) {
	return (identifier) => {
		const shortResult = checkRateLimit(identifier, shortLimit);
		if (shortResult.isLimited) return shortResult;
		const burstResult = checkRateLimit(identifier, burstLimit);
		return burstResult;
	};
}

export default {
	checkRateLimit,
	checkMultipleRateLimits,
	getRateLimitMiddleware,
	getActionRateLimiter,
	grantCapBypass,
	hasCapBypass,
	RATE_LIMITS,
};
