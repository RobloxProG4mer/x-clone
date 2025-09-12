import toastQueue from "../../shared/toasts.js";
import { authToken } from "./auth.js";
import { createComposer } from "./composer.js";
import switchPage, { addRoute } from "./pages.js";
import { createTweetElement } from "./tweets.js";

export default async function openTweet(
	tweet,
	{ repliesCache, threadPostsCache } = {},
) {
	if (!tweet?.author) {
		const apiOutput = await await (
			await fetch(`/api/tweets/${tweet.id}`, {
				headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
			})
		).json();
		tweet = apiOutput.tweet;
		threadPostsCache = apiOutput.threadPosts;
		repliesCache = apiOutput.replies;

		if (!tweet) {
			switchPage("timeline");
			toastQueue.add(
				`<h1>Tweet not found</h1><p>It might have been deleted</p>`,
			);
			return;
		}
	}

	switchPage("tweet", {
		path: `/tweet/${tweet.id}`,
		recoverState: async (page) => {
			page.innerHTML = `<a href="/" class="back-button">← Back</a>`;

			page.querySelector(".back-button").addEventListener("click", (e) => {
				e.preventDefault();
				history.back();
			});

			const tweetEl = createTweetElement(tweet, {
				clickToOpen: false,
			});
			page.appendChild(tweetEl);

			const composer = createComposer({
				placeholder: `Add a reply…`,
				replyTo: tweet.id,
				callback: (tweet) => {
					const replyEl = createTweetElement(tweet, {
						clickToOpen: true,
					});
					replyEl.classList.add("created");

					composer.insertAdjacentElement("afterend", replyEl);
				},
			});

			page.appendChild(composer);

			if (!threadPostsCache || !repliesCache) {
				const apiOutput = await await (
					await fetch(`/api/tweets/${tweet.id}`, {
						headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
					})
				).json();
				tweet = apiOutput.tweet;
				threadPostsCache = apiOutput.threadPosts;
				repliesCache = apiOutput.replies;
			}

			if (!tweet) {
				switchPage("timeline");
				toastQueue.add(
					`<h1>Tweet not found</h1><p>It might have been deleted</p>`,
				);
				return;
			}

			tweetEl.remove();

			threadPostsCache.forEach((reply) => {
				const postEl = createTweetElement(reply, {
					clickToOpen: true,
				});
				composer.insertAdjacentElement("beforebegin", postEl);
			});

			repliesCache.forEach((reply) => {
				const replyEl = createTweetElement(reply, {
					clickToOpen: true,
				});
				page.appendChild(replyEl);
			});
		},
	});
}

addRoute(
	(pathname) =>
		pathname.startsWith("/tweet/") && pathname.split("/").length === 3,
	(pathname) => {
		openTweet({
			id: pathname.split("/").pop(),
		});
	},
);
