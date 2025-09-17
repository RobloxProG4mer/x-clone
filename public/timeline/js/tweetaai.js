import toastQueue from "../../shared/toasts.js";
import { authToken } from "./auth.js";
import switchPage from "./pages.js";

let isLoading = false;
let currentStreamElement = null;
let abortController = null;

function appendMessage(text, cls, isThinking = false, timestamp = null) {
	const messages = document.getElementById("tweetaai-messages");
	const emptyState = messages.querySelector(".tweetaai-empty-state");
	if (emptyState) {
		emptyState.remove();
	}

	const messageWrapper = document.createElement("div");
	messageWrapper.className = "message-wrapper";

	const div = document.createElement("div");
	div.className = `bubble ${cls}`;
	if (isThinking) {
		div.classList.add("thinking");
	}
	div.textContent = text;

	if (timestamp && cls === "ai") {
		const timeEl = document.createElement("div");
		timeEl.className = "message-timestamp";
		timeEl.textContent = new Date(timestamp).toLocaleString();
		messageWrapper.appendChild(timeEl);
	}

	messageWrapper.appendChild(div);
	messages.appendChild(messageWrapper);
	messages.scrollTop = messages.scrollHeight;
	return div;
}

async function clearChatHistory() {
	if (!authToken) return;

	if (
		!confirm(
			"Are you sure you want to clear all chat history? This cannot be undone.",
		)
	) {
		return;
	}

	try {
		const response = await fetch("/api/tweetaai/history", {
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${authToken}`,
			},
		});

		const data = await response.json();

		if (data.success) {
			const messages = document.getElementById("tweetaai-messages");
			messages.innerHTML = `
				<div class="tweetaai-empty-state">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386L8.46 15.54z" />
					</svg>
					<h3>Chat with TweetaAI</h3>
					<p>Ask me anything! I'll keep my responses concise and helpful.</p>
				</div>
			`;
			toastQueue.add(
				"<h1>Chat history cleared</h1><p>All previous conversations have been deleted</p>",
			);
		} else {
			toastQueue.add("<h1>Error</h1><p>Failed to clear chat history</p>");
		}
	} catch (error) {
		console.error("Failed to clear chat history:", error);
		toastQueue.add("<h1>Error</h1><p>Failed to clear chat history</p>");
	}
}

function createStreamingMessage() {
	const messages = document.getElementById("tweetaai-messages");
	const emptyState = messages.querySelector(".tweetaai-empty-state");
	if (emptyState) {
		emptyState.remove();
	}

	const div = document.createElement("div");
	div.className = "bubble ai streaming";
	div.textContent = "";
	messages.appendChild(div);
	messages.scrollTop = messages.scrollHeight;
	return div;
}

function autoResizeTextarea(textarea) {
	textarea.style.height = "auto";
	const newHeight = Math.min(textarea.scrollHeight, 120);
	textarea.style.height = newHeight + "px";

	if (textarea.scrollHeight > 44) {
		textarea.style.overflowY = "auto";
	} else {
		textarea.style.overflowY = "hidden";
	}
}

async function loadChatHistory() {
	if (!authToken) return;

	try {
		const response = await fetch("/api/tweetaai/history", {
			headers: {
				Authorization: `Bearer ${authToken}`,
			},
		});

		const data = await response.json();

		if (data.success && data.chats) {
			const messages = document.getElementById("tweetaai-messages");
			const emptyState = messages.querySelector(".tweetaai-empty-state");

			if (data.chats.length > 0 && emptyState) {
				emptyState.remove();
			}

			data.chats.forEach((chat) => {
				appendMessage(chat.prompt, "user");
				appendMessage(chat.response, "ai");
			});
		}
	} catch (error) {
		console.error("Failed to load chat history:", error);
	}
}

function updateSendButton() {
	const button = document.getElementById("tweetaaiSendButton");
	const textarea = document.getElementById("tweetaai-message");
	if (!button || !textarea) return;

	const hasText = textarea.value.trim().length > 0;
	button.disabled = isLoading || !hasText;
	button.textContent = isLoading ? "Sending..." : "Send";
}

async function streamChatResponse(message, token) {
	abortController = new AbortController();

	try {
		const response = await fetch("/api/tweetaai/chat", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ message, stream: true }),
			signal: abortController.signal,
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || "Network error");
		}

		if (!response.body) {
			const data = await response.json();
			return data.reply || "No response";
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let result = "";

		currentStreamElement = createStreamingMessage();

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value, { stream: true });
			const lines = chunk.split("\n");

			for (const line of lines) {
				if (line.startsWith("data: ")) {
					const data = line.slice(6);
					if (data === "[DONE]") {
						currentStreamElement.classList.remove("streaming");
						return result;
					}

					try {
						const parsed = JSON.parse(data);
						const content = parsed.choices?.[0]?.delta?.content;
						if (content) {
							result += content;
							currentStreamElement.textContent = result;
							const messages = document.getElementById("tweetaai-messages");
							messages.scrollTop = messages.scrollHeight;
						}
					} catch {
						console.warn("Failed to parse streaming chunk:", data);
					}
				}
			}
		}

		currentStreamElement.classList.remove("streaming");
		return result;
	} catch (error) {
		if (error.name === "AbortError") {
			throw new Error("Request cancelled");
		}
		throw error;
	}
}

function initializeTweetaAI() {
	const messageInput = document.getElementById("tweetaai-message");
	const chatForm = document.getElementById("tweetaaiChatForm");
	const clearBtn = document.getElementById("clearHistoryBtn");

	if (!messageInput || !chatForm) return;

	loadChatHistory();

	if (clearBtn) {
		clearBtn.addEventListener("click", clearChatHistory);
	}

	messageInput.addEventListener("input", () => {
		autoResizeTextarea(messageInput);
		updateSendButton();
	});

	messageInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			chatForm.dispatchEvent(new Event("submit"));
		}
	});

	chatForm.addEventListener("submit", async (e) => {
		e.preventDefault();

		if (isLoading) {
			if (abortController) {
				abortController.abort();
				if (currentStreamElement) {
					currentStreamElement.textContent += " (cancelled)";
					currentStreamElement.classList.remove("streaming");
				}
				isLoading = false;
				updateSendButton();
			}
			return;
		}

		const textarea = document.getElementById("tweetaai-message");
		const text = textarea.value.trim();
		if (!text) return;

		if (!authToken) {
			toastQueue.add("Please sign in to use TweetaAI");
			return;
		}

		isLoading = true;
		updateSendButton();

		appendMessage(text, "user");
		textarea.value = "";
		autoResizeTextarea(textarea);

		try {
			await streamChatResponse(text, authToken);
		} catch (error) {
			console.error("TweetaAI error:", error);

			if (currentStreamElement) {
				currentStreamElement.remove();
			}

			let errorMessage =
				"Network error communicating with TweetaAI. Please try again.";
			if (error.message.includes("token") || error.message.includes("auth")) {
				errorMessage = "Authentication error. Please sign in again.";
				toastQueue.add("Please sign in again to continue");
			} else if (error.message !== "Request cancelled") {
				errorMessage = `Error: ${error.message}`;
			}

			if (error.message !== "Request cancelled") {
				appendMessage(errorMessage, "ai");
			}
		} finally {
			isLoading = false;
			updateSendButton();
			textarea.focus();
			currentStreamElement = null;
			abortController = null;
		}
	});

	updateSendButton();
}

document.getElementById("aiBtn")?.addEventListener("click", () => {
	switchPage("tweetaai", {
		path: "/tweetaai",
		recoverState: () => {
			setTimeout(() => {
				initializeTweetaAI();
			}, 0);
		},
	});
});

document.getElementById("tweetaaiBackBtn")?.addEventListener("click", () => {
	switchPage("timeline", { path: "/" });
});

export { initializeTweetaAI };
