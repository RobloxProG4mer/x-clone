// https://github.com/rayriffy/elysia-rate-limit#generator

export default function (req, server) {
	if (process.env.NODE_ENV === "development") {
		return Math.random().toFixed(2);
	}
	if (req.method === "GET") {
		return Math.random().toString();
	}
	const url = new URL(req.url);
	if (url.pathname.includes("/cap/")) {
		return Math.random().toString();
	}
	const authHeader = req.headers.get("Authorization");
	const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
	if (token) return token;
	return (
		req.headers.get("CF-Connecting-IP") ??
		server?.requestIP(req)?.address ??
		"0.0.0.0"
	);
}
