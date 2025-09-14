import confetti from "../../shared/confetti.js";
import toastQueue from "../../shared/toasts.js";
import getUser, { authToken } from "./auth.js";

export const useComposer = (
	element,
	callback,
	{ replyTo = null, quoteTweet = null } = {},
) => {
	const textarea = element.querySelector("#tweet-textarea");
	const charCount = element.querySelector("#char-count");
	const tweetButton = element.querySelector("#tweet-button");
	const pollToggle = element.querySelector("#poll-toggle");
	const pollContainer = element.querySelector("#poll-container");
	const addPollOptionBtn = element.querySelector("#add-poll-option");
	const pollDuration = element.querySelector("#poll-duration");
	const fileInput = element.querySelector("#file-input");
	const fileUploadBtn = element.querySelector("#file-upload-btn");
	const attachmentPreview = element.querySelector("#attachment-preview");

	let pollEnabled = false;
	let pendingFiles = [];	const updateCharacterCount = () => {
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

	const convertToWebP = (file, quality = 0.8) => {
		return new Promise((resolve, reject) => {
			// Only convert image files, skip videos
			if (!file.type.startsWith('image/')) {
				resolve(file);
				return;
			}

			// Skip if already WebP
			if (file.type === 'image/webp') {
				resolve(file);
				return;
			}

			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			const img = new Image();

			img.onload = () => {
				// Set canvas dimensions to image dimensions
				canvas.width = img.width;
				canvas.height = img.height;

				// Draw image to canvas
				ctx.drawImage(img, 0, 0);

				// Convert to WebP blob
				canvas.toBlob((blob) => {
					if (blob) {
						// Create new file with WebP blob
						const webpFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
							type: 'image/webp',
							lastModified: Date.now()
						});
						resolve(webpFile);
					} else {
						// Fallback to original file if conversion fails
						resolve(file);
					}
				}, 'image/webp', quality);
			};

			img.onerror = () => {
				// Fallback to original file if loading fails
				resolve(file);
			};

			// Load image from file
			img.src = URL.createObjectURL(file);
		});
	};

	const processFileForUpload = async (file) => {
		try {
			// Convert to WebP if it's an image
			const processedFile = await convertToWebP(file);
			
			// Calculate SHA256 hash on client side
			const arrayBuffer = await processedFile.arrayBuffer();
			const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

			// Determine file extension
			const typeMap = {
				'image/png': '.png',
				'image/webp': '.webp',
				'image/avif': '.avif',
				'image/jpeg': '.jpg',
				'image/jpg': '.jpg',
				'image/gif': '.gif',
				'video/mp4': '.mp4'
			};

			const fileExtension = typeMap[processedFile.type];
			if (!fileExtension) {
				toastQueue.add(`<h1>Unsupported file type</h1><p>Please use PNG, WEBP, AVIF, JPEG, GIF, or MP4</p>`);
				return null;
			}

			const fileData = {
				hash: hashHex,
				name: processedFile.name,
				type: processedFile.type,
				size: processedFile.size,
				url: `/public/uploads/${hashHex}${fileExtension}`,
				file: processedFile // Keep the processed file for upload
			};

			pendingFiles.push(fileData);
			displayAttachmentPreview(fileData);
			return fileData;
		} catch (error) {
			console.error('File processing error:', error);
			toastQueue.add(`<h1>File processing failed</h1><p>Please try again</p>`);
			return null;
		}
	};

	const displayAttachmentPreview = (fileData) => {
		const previewEl = document.createElement("div");
		previewEl.className = "attachment-preview-item";
		previewEl.dataset.fileHash = fileData.hash;

		if (fileData.type.startsWith("image/")) {
			const objectUrl = URL.createObjectURL(fileData.file);
			previewEl.innerHTML = `
				<img src="${objectUrl}" alt="${fileData.name}" />
				<button type="button" class="remove-attachment">×</button>
			`;
		} else if (fileData.type === "video/mp4") {
			const objectUrl = URL.createObjectURL(fileData.file);
			previewEl.innerHTML = `
				<video src="${objectUrl}" controls></video>
				<button type="button" class="remove-attachment">×</button>
			`;
		}

		previewEl.querySelector(".remove-attachment")?.addEventListener("click", () => {
			pendingFiles = pendingFiles.filter(f => f.hash !== fileData.hash);
			previewEl.remove();
		});

		attachmentPreview.appendChild(previewEl);
	};

	if (fileUploadBtn && fileInput) {
		fileUploadBtn.addEventListener("click", () => {
			fileInput.click();
		});

		fileInput.addEventListener("change", async (e) => {
			const files = Array.from(e.target.files);
			for (const file of files) {
				await processFileForUpload(file);
			}
			e.target.value = ""; // Reset input
		});
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
			// Upload files first if any
			const uploadedFiles = [];
			for (const fileData of pendingFiles) {
				const formData = new FormData();
				formData.append("file", fileData.file);

				const uploadResponse = await fetch("/api/upload/", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${authToken}`,
					},
					body: formData,
				});

				const uploadResult = await uploadResponse.json();
				if (uploadResult.success) {
					uploadedFiles.push(uploadResult.file);
				} else {
					toastQueue.add(`<h1>Upload failed</h1><p>${uploadResult.error}</p>`);
					return;
				}
			}

			const requestBody = {
				content,
				reply_to: replyTo,
				quote_tweet_id: quoteTweet?.id || null,
				source: /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
					? "mobile_web"
					: "desktop_web",
				files: uploadedFiles,
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

			// Clear attachments
			pendingFiles = [];
			attachmentPreview.innerHTML = "";

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
	quoteTweet = null,
}) => {
	const el = document.createElement("div");
	el.classList.add("compose-tweet");
	el.innerHTML = `
        <div class="compose-header">
          <img src="" alt="Your avatar" id="compose-avatar">
          <div class="compose-input">
            <textarea placeholder="What's happening?" maxlength="400" id="tweet-textarea"></textarea>
            <div id="quoted-tweet-container"></div>
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
                <button type="button" id="file-upload-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                  Add media
                </button>
                <input type="file" id="file-input" multiple accept="image/png,image/webp,image/avif,image/jpeg,image/jpg,image/gif,video/mp4" style="display: none;">
              </div>
              <div class="compose-submit">
                <div class="character-counter" id="">
                  <span id="char-count">0</span>/400
                </div>
                <button id="tweet-button" disabled="">Tweet</button>
              </div>
            </div>
            <div id="attachment-preview"></div>
          </div>
        </div>`;
	el.querySelector("#tweet-textarea").placeholder = placeholder;

	if (quoteTweet) {
		const { createTweetElement } = await import("./tweets.js");
		const quotedTweetEl = createTweetElement(quoteTweet, {
			clickToOpen: false,
			showTopReply: false,
			isTopReply: false,
			size: "preview"
		});
		el.querySelector("#quoted-tweet-container").appendChild(quotedTweetEl);
	}

	try {
		const user = await getUser();
		el.querySelector(".compose-header img").src =
			user?.avatar || "/public/shared/default-avatar.png";
	} catch (error) {
		console.error("Error loading user avatar:", error);
		el.querySelector(".compose-header img").src =
			"/public/shared/default-avatar.png";
	}

	useComposer(el, callback, { replyTo, quoteTweet });

	return el;
};
