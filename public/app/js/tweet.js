import {
	createPOSTSkeleton,
	removeSkeletons,
	showSkeletons,
} from "../../shared/skeleton-utils.js";
import toastQueue from "../../shared/toasts.js";
import { createComposer } from "./composer.js";
import switchPage, { addRoute, updatePageTitle } from "./pages.js";
import { createPOSTElement } from "./POSTS.js";

export default async function openPOST(
	POST,
	{ repliesCache, threadPostsCache } = {},
) {
	const { default: query } = await import("./api.js");

	if (!POST?.id || !POST) return;

	let finalThread = null;
	let finalPOST = POST;

	const sourceThread = threadPostsCache || POST.parentsCache;

	if (sourceThread && sourceThread.length > 0) {
		const targetIndex = sourceThread.findIndex((t) => t.id === POST.id);

		if (targetIndex !== -1) {
			finalThread = sourceThread.slice(0, targetIndex + 1);
			finalPOST = sourceThread[targetIndex];
		} else {
			finalThread = [...sourceThread];
			if (POST.author) {
				finalThread.push(POST);
				finalPOST = POST;
			}
		}
	}

	if (!finalPOST.author && !finalThread) {
		const apiOutput = await query(`/POSTS/${POST.id}`);

		if (!apiOutput || !apiOutput.POST) {
			toastQueue.add(
				`<h1>POST not found</h1><p>It might have been deleted</p>`,
			);
			return;
		}

		finalPOST = apiOutput.POST;
		finalThread = apiOutput?.threadPosts || [];
		repliesCache = apiOutput?.replies || [];
	}

	let isLoadingMoreReplies = false;
	let hasMoreReplies = false;
	let currentOffset = 0;
	let scrollHandler = null;

	const renderedPOSTS = new Map();

	const authorName =
		finalPOST.author?.name || finalPOST.author?.username || "Post";
	const POSTContent = finalPOST.content?.slice(0, 30) || "";
	const pageTitle = `${authorName}: "${POSTContent}${POSTContent.length >= 30 ? "..." : ""}"`;

	switchPage("POST", {
		path: `/POST/${finalPOST.id}`,
		title: pageTitle,
		cleanup: () => {
			if (scrollHandler) {
				window.removeEventListener("scroll", scrollHandler);
				scrollHandler = null;
			}
			renderedPOSTS.clear();
		},
		recoverState: async (page) => {
			page.innerHTML = `<button class="back-button" onclick="history.back()"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-left-icon lucide-arrow-left"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg></button>`;

			page.querySelector(".back-button").addEventListener("click", (e) => {
				e.preventDefault();
				history.back();
			});

			const getPOSTElement = (POSTData, options = {}) => {
				if (renderedPOSTS.has(POSTData.id)) {
					return renderedPOSTS.get(POSTData.id);
				}

				const element = createPOSTElement(POSTData, options);
				renderedPOSTS.set(POSTData.id, element);
				return element;
			};

			if (finalThread && finalThread.length > 0) {
				finalThread.forEach((post) => {
					const postEl = getPOSTElement(post, {
						clickToOpen: post.id !== finalPOST.id,
					});

					if (post.id === finalPOST.id) {
						postEl.setAttribute("data-main-POST", "true");
					}

					page.appendChild(postEl);
				});
			} else if (finalPOST.author) {
				const POSTEl = getPOSTElement(finalPOST, {
					clickToOpen: false,
				});
				POSTEl.setAttribute("data-main-POST", "true");
				page.appendChild(POSTEl);
			}

			const composer = await createComposer({
				placeholder: `Add a reply…`,
				replyTo: finalPOST.id,
				callback: (newPOST) => {
					const replyEl = getPOSTElement(newPOST, {
						clickToOpen: true,
					});
					replyEl.classList.add("created");
					composer.insertAdjacentElement("afterend", replyEl);
				},
			});
			page.appendChild(composer);

			const repliesContainer = document.createElement("div");
			repliesContainer.className = "POST-replies-container";
			page.appendChild(repliesContainer);

			if (repliesCache && repliesCache.length > 0) {
				const threadForReplies = finalThread || [finalPOST];

				repliesCache.forEach((reply) => {
					if (!reply.parentsCache) {
						reply.parentsCache = [...threadForReplies, reply];
					}

					const replyEl = getPOSTElement(reply, {
						clickToOpen: true,
					});
					replyEl.setAttribute("data-reply-id", reply.id);
					repliesContainer.appendChild(replyEl);
				});
				currentOffset = repliesCache.length;
				hasMoreReplies = repliesCache.length >= 20;
			}

			const needsThreadData = !finalThread && finalPOST.author;
			const needsRepliesData = !repliesCache;

			if (needsThreadData || needsRepliesData || !finalPOST.author) {
				const skeletons = needsRepliesData
					? showSkeletons(
							repliesContainer,
							createPOSTSkeleton,
							typeof finalPOST?.reply_count === "number"
								? Math.min(finalPOST?.reply_count, 24)
								: 3,
						)
					: [];

				const apiOutput = await query(`/POSTS/${finalPOST.id}`);

				if (!apiOutput || !apiOutput.POST) {
					removeSkeletons(skeletons);
					toastQueue.add(
						`<h1>POST not found</h1><p>It might have been deleted</p>`,
					);
					return;
				}

				finalPOST = apiOutput.POST;
				hasMoreReplies = apiOutput?.hasMoreReplies || false;

				const loadedAuthorName =
					finalPOST.author?.name || finalPOST.author?.username || "Post";
				const loadedContent = finalPOST.content?.slice(0, 30) || "";
				updatePageTitle("POST", {
					title: loadedContent
						? `${loadedAuthorName}: "${loadedContent}${loadedContent.length >= 30 ? "..." : ""}"`
						: `POST by ${loadedAuthorName}`,
				});

				if ((needsThreadData || !finalThread) && apiOutput.threadPosts) {
					const newThreadPosts = apiOutput.threadPosts;

					if (newThreadPosts.length > 0) {
						const existingPOST = page.querySelector(
							'[data-main-POST="true"]',
						);
						if (
							existingPOST &&
							!existingPOST.closest(".POST-replies-container")
						) {
							existingPOST.remove();
						}

						newThreadPosts.forEach((post) => {
							const postEl = getPOSTElement(post, {
								clickToOpen: post.id !== finalPOST.id,
							});

							if (post.id === finalPOST.id) {
								postEl.setAttribute("data-main-POST", "true");
							}

							composer.insertAdjacentElement("beforebegin", postEl);
						});

						const mainPOST = page.querySelector('[data-main-POST="true"]');
						if (mainPOST) {
							mainPOST.scrollIntoView({ block: "start" });
							window.scrollBy(0, -200);
						}
					}
				}

				if (needsRepliesData && apiOutput.replies) {
					removeSkeletons(skeletons);
					repliesCache = apiOutput.replies;

					const threadForReplies =
						finalThread ||
						(apiOutput.threadPosts ? apiOutput.threadPosts : [finalPOST]);

					repliesCache.forEach((reply) => {
						reply.parentsCache = [...threadForReplies, reply];

						const replyEl = getPOSTElement(reply, {
							clickToOpen: true,
						});
						replyEl.setAttribute("data-reply-id", reply.id);
						repliesContainer.appendChild(replyEl);
					});
					currentOffset = repliesCache.length;
				} else if (needsRepliesData) {
					removeSkeletons(skeletons);
				}
			}

			const mainPOST = page.querySelector('[data-main-POST="true"]');
			if (mainPOST) {
				mainPOST.scrollIntoView({ block: "start" });
				window.scrollBy(0, -200);
			}

			if (scrollHandler) {
				window.removeEventListener("scroll", scrollHandler);
				scrollHandler = null;
			}

			let scrollTimeout = null;

			scrollHandler = () => {
				if (scrollTimeout) return;

				scrollTimeout = setTimeout(async () => {
					scrollTimeout = null;

					if (isLoadingMoreReplies || !hasMoreReplies) {
						return;
					}

					const scrollPosition = window.innerHeight + window.scrollY;
					const threshold = document.documentElement.scrollHeight - 800;

					if (scrollPosition >= threshold) {
						isLoadingMoreReplies = true;

						const loadMoreSkeletons = showSkeletons(
							repliesContainer,
							createPOSTSkeleton,
							3,
						);

						try {
							const apiOutput = await query(
								`/POSTS/${finalPOST.id}?offset=${currentOffset}&limit=20`,
							);

							removeSkeletons(loadMoreSkeletons);

							if (apiOutput?.replies && apiOutput.replies.length > 0) {
								const threadForReplies = finalThread || [finalPOST];

								apiOutput.replies.forEach((reply) => {
									if (!renderedPOSTS.has(reply.id)) {
										reply.parentsCache = [...threadForReplies, reply];
										const replyEl = getPOSTElement(reply, {
											clickToOpen: true,
										});
										replyEl.setAttribute("data-reply-id", reply.id);
										repliesContainer.appendChild(replyEl);
									}
								});

								currentOffset += apiOutput.replies.length;
								hasMoreReplies = apiOutput.hasMoreReplies || false;
							} else {
								hasMoreReplies = false;
							}
						} catch (e) {
							console.error("Error loading more replies:", e);
							removeSkeletons(loadMoreSkeletons);
						} finally {
							isLoadingMoreReplies = false;
						}
					}
				}, 200);
			};

			window.addEventListener("scroll", scrollHandler, { passive: true });
		},
	});
}

addRoute(
	(pathname) =>
		pathname.startsWith("/POST/") && pathname.split("/").length === 3,
	(pathname) => {
		const POSTId = pathname.split("/").pop();
		openPOST({ id: POSTId });
	},
);
