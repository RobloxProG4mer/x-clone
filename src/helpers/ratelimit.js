// https://github.com/rayriffy/elysia-rate-limit#generator
// elysia-rate-limit spamming the terminal is annoying
export default function (req, server) {
	return (
		req.headers.get("CF-Connecting-IP") ??
		server?.requestIP(req)?.address ??
		"0.0.0.0"
	);
}
