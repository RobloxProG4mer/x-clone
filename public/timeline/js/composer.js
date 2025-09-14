import confetti from "../../shared/confetti.js";
import toastQueue from "../../shared/toasts.js";
import getUser, { authToken } from "./auth.js";

export const useComposer = (element, callback, { replyTo = null } = {}) => {
	const textarea = element.querySelector("#tweet-textarea");
	const charCount = element.querySelector("#char-count");
	const tweetButton = element.querySelector("#tweet-button");
	const pollToggle = element.querySelector("#poll-toggle");
	const pollContainer = element.querySelector("#poll-container");
	const addPollOptionBtn = element.querySelector("#add-poll-option");
	const pollDuration = element.querySelector("#poll-duration");

	let pollEnabled = false;

	const updateCharacterCount = () => {
		const length = textarea.value.length;
		charCount.textContent = length;

		if (length > 400) {
			charCount.parentElement.id = "over-limit";
			tweetButton.disabled = true;
		} else {
			charCount.parentElement.id = "";
			tweetButton.disabled = length === 0;
		}
	};

	const addPollOption = (text = "") => {
		if (!pollContainer) return;
		const optionIndex = pollContainer.querySelectorAll(".poll-option").length;
		if (optionIndex >= 4) return;

		const optionDiv = document.createElement("div");
		optionDiv.className = "poll-option";
		optionDiv.innerHTML = `
			<input type="text" placeholder="Choice ${optionIndex + 1}" maxlength="100" value="${text}">
			${optionIndex >= 2 ? '<button type="button" class="remove-option">×</button>' : ""}
		`;

		pollContainer.querySelector(".poll-options").appendChild(optionDiv);

		if (optionDiv.querySelector(".remove-option")) {
			optionDiv
				.querySelector(".remove-option")
				.addEventListener("click", () => {
					optionDiv.remove();
					updateAddOptionButton();
				});
		}

		updateAddOptionButton();
	};

	const updateAddOptionButton = () => {
		if (!pollContainer || !addPollOptionBtn) return;
		const optionCount = pollContainer.querySelectorAll(".poll-option").length;
		addPollOptionBtn.style.display = optionCount >= 4 ? "none" : "block";
	};

	const togglePoll = () => {
		if (!pollContainer || !pollToggle) return;
		pollEnabled = !pollEnabled;
		pollContainer.style.display = pollEnabled ? "block" : "none";
		pollToggle.textContent = pollEnabled ? "Remove poll" : "Add poll";

		if (
			pollEnabled &&
			pollContainer.querySelectorAll(".poll-option").length === 0
		) {
			addPollOption();
			addPollOption();
		}
	};

	textarea.addEventListener("input", updateCharacterCount);

	textarea.addEventListener("input", () => {
		textarea.style.height = `${Math.max(textarea.scrollHeight, 25)}px`;

		if (textarea.scrollHeight < 250) {
			textarea.style.overflow = "hidden";
		} else {
			textarea.style.overflow = "auto";
		}
	});

	if (pollToggle) {
		pollToggle.addEventListener("click", togglePoll);
	}

	if (addPollOptionBtn) {
		addPollOptionBtn.addEventListener("click", () => addPollOption());
	}

	tweetButton.addEventListener("click", async () => {
		const content = textarea.value.trim();

		if (!content || content.length > 400) {
			toastQueue.add(
				`<h1>Invalid tweet</h1><p>Make sure your tweet is 1 to 400 characters long.</p>`,
			);
			return;
		}

		let poll = null;
		if (pollEnabled && pollContainer && pollDuration) {
			const pollOptions = Array.from(
				pollContainer.querySelectorAll(".poll-option input"),
			)
				.map((input) => input.value.trim())
				.filter((value) => value.length > 0);

			if (pollOptions.length < 2) {
				toastQueue.add(
					`<h1>Invalid poll</h1><p>Please provide at least 2 poll options.</p>`,
				);
				return;
			}

			poll = {
				options: pollOptions,
				duration: parseInt(pollDuration.value),
			};
		}

		tweetButton.disabled = true;

		try {
			const requestBody = {
				content,
				reply_to: replyTo,
				source: /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
					? "mobile_web"
					: "desktop_web",
			};

			if (poll) {
				requestBody.poll = poll;
			}

			const { error, tweet } = await (
				await fetch("/api/tweets/", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${authToken}`,
					},
					body: JSON.stringify(requestBody),
				})
			).json();

			if (!tweet) {
				toastQueue.add(`<h1>${error || "Failed to post tweet"}</h1>`);
				return;
			}

			textarea.value = "";
			charCount.textContent = "0";
			textarea.style.height = "25px";

			if (pollEnabled && pollContainer) {
				pollContainer
					.querySelectorAll(".poll-option")
					.forEach((option) => option.remove());
				togglePoll();
			}

			callback(tweet);

			if (!replyTo) {
				confetti(tweetButton, {
					count: 40,
					fade: true,
				});
			}

			toastQueue.add(`<h1>Tweet posted successfully!</h1>`);
		} catch (e) {
			console.log(e);
			toastQueue.add(`<h1>Network error. Please try again.</h1>`);
		} finally {
			tweetButton.disabled = false;
		}
	});

	textarea.addEventListener("keydown", (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			e.preventDefault();
			if (!tweetButton.disabled) {
				tweetButton.click();
			}
		}
	});
};

export const createComposer = async ({
	callback = () => {},
	placeholder = "What's happening?",
	replyTo = null,
}) => {
	const el = document.createElement("div");
	el.classList.add("compose-tweet");
	el.innerHTML = `
        <div class="compose-header">
          <img src="" alt="Your avatar" id="compose-avatar">
          <div class="compose-input">
            <textarea placeholder="What's happening?" maxlength="400" id="tweet-textarea"></textarea>
            <div id="poll-container" style="display: none;">
              <div class="poll-options"></div>
              <button type="button" id="add-poll-option">Add another option</button>
              <div class="poll-settings">
                <label for="poll-duration">Poll duration:</label>
                <select id="poll-duration">
                  <option value="5">5 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="360">6 hours</option>
                  <option value="720">12 hours</option>
                  <option value="1440" selected>1 day</option>
                  <option value="4320">3 days</option>
                  <option value="10080">7 days</option>
                </select>
              </div>
            </div>
            <div class="compose-footer">
              <div class="compose-actions">
                <button type="button" id="poll-toggle">Add poll</button>
              </div>
              <div class="compose-submit">
                <div class="character-counter" id="">
                  <span id="char-count">0</span>/400
                </div>
                <button id="tweet-button" disabled="">Tweet</button>
              </div>
            </div>
          </div>
        </div>`;
	el.querySelector("#tweet-textarea").placeholder = placeholder;
	el.querySelector(".compose-header img").src = (await getUser()).avatar;
	useComposer(el, callback, { replyTo });

	return el;
};
