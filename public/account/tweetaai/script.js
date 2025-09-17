async function getToken() {
	return localStorage.getItem("token");
}

function appendMessage(text, cls) {
	const messages = document.getElementById("messages");
	const div = document.createElement("div");
	div.className = `bubble ${cls}`;
	div.textContent = text;
	messages.appendChild(div);
	messages.scrollTop = messages.scrollHeight;
}

document.getElementById("input").addEventListener("submit", async (e) => {
	e.preventDefault();
	const ta = document.getElementById("message");
	const text = ta.value.trim();
	if (!text) return;

	appendMessage(text, "user");
	ta.value = "";

	const token = await getToken();
	if (!token) {
		showToast("Please sign in to use TweetaAI");
		return;
	}

	appendMessage("…thinking…", "ai");
	const thinkingEl = document.getElementById("messages").lastChild;

	try {
		const res = await (
			await fetch("/api/tweetaai/chat", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ message: text }),
			})
		).json();

		thinkingEl.remove();

		if (res.error) {
			appendMessage(`Error: ${res.error}`, "ai");
			return;
		}

		appendMessage(res.reply || "(no reply)", "ai");
	} catch {
		thinkingEl.remove();
		appendMessage("Network error communicating with TweetaAI", "ai");
	}
});
