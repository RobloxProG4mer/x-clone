import { initializePresence } from "../../shared/presence.js";
import toastQueue from "../../shared/toasts.js";
import query from "./api.js";
import { authToken } from "./auth.js";
import { createComposer } from "./composer.js";
import dm from "./dm.js";
import switchPage, { addRoute, showPage } from "./pages.js";
import { addTweetToTimeline } from "./tweets.js";
import "./profile.js";
import "./notifications.js";
import "./settings.js";
import "./search.js";

window.onerror = (message, source, lineno, colno) => {
  toastQueue.add(
    `<h1>${message}</h1><p>at ${lineno || "?"}:${colno || "?"} in ${
      source || "?"
    }</p>`
  );

  return false;
};

window.onunhandledrejection = (event) => {
  const reason = event.reason;

  if (reason instanceof Error) {
    toastQueue.add(
      `<h1>${reason.message}</h1><p>at ${reason.lineNumber || "?"}:${
        reason.columnNumber || "?"
      } in ${reason.fileName || "?"}</p>`
    );
  } else {
    toastQueue.add(`<h1>${String(reason)}</h1><p>Error</p>`);
  }
};

(async () => {
  if (!authToken) return;

  initializePresence();

  let currentTimeline = "home";

  if (
    window.location.pathname === "/settings" ||
    window.location.pathname === "/settings/"
  ) {
    window.location.replace("/settings/account");
    return;
  }

  const loadTimeline = async (type = "home") => {
    const endpoint =
      type === "following" ? "/timeline/following" : "/timeline/";

    try {
      const { timeline } = await query(endpoint);

      document.querySelector(".tweets").innerHTML = "";

      if (timeline.length === 0 && type === "following") {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "empty-timeline";
        emptyMessage.innerHTML = `
					<h3>Welcome to your Following timeline!</h3>
					<p>Follow some accounts to see their tweets here.</p>
				`;
        document.querySelector(".tweets").appendChild(emptyMessage);
      } else {
        timeline.forEach((tweet) => {
          addTweetToTimeline(tweet, false);
        });
      }
    } catch (error) {
      console.error("Error loading timeline:", error);
      toastQueue.add(`<h1>Error loading timeline</h1><p>Please try again</p>`);
    }
  };

  const feedLinks = document.querySelectorAll("h1 a");
  feedLinks.forEach((link, index) => {
    link.addEventListener("click", async (e) => {
      e.preventDefault();

      feedLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");

      const timelineType = index === 0 ? "home" : "following";
      currentTimeline = timelineType;

      document.querySelector("#composer-container").style.display = "block";
      document.querySelector(".tweets").style.display = "flex";
      await loadTimeline(timelineType);
    });
  });

  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      switchPage("search", { path: "/search" });
    });
  }

  const handleUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tweetId = urlParams.get("tweet");
    const profileUsername = urlParams.get("profile");

    if (tweetId) {
      window.history.replaceState(null, "", `/tweet/${tweetId}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else if (profileUsername) {
      window.history.replaceState(null, "", `/@${profileUsername}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  await loadTimeline("home");
  handleUrlParams();

  dm.connectSSE();

  const composer = await createComposer({
    callback: (tweet) => {
      if (currentTimeline === "home") {
        addTweetToTimeline(tweet, true).classList.add("created");
      }
    },
  });

  document.querySelector("#composer-container").appendChild(composer);

  document
    .getElementById("notificationsBtn")
    ?.addEventListener("click", async () => {
      const { openNotifications } = await import("./notifications.js");
      openNotifications();
    });
})();

addRoute(
  (pathname) => pathname === "/",
  () => showPage("timeline")
);

addRoute(
  (pathname) => pathname === "/search",
  () => showPage("search")
);

addRoute(
  (pathname) => pathname.startsWith("/settings"),
  (pathname) => {
    if (pathname === "/settings" || pathname === "/settings/") {
      window.location.replace("/settings/account");
      return;
    }

    (async () => {
      const pathParts = pathname.split("/");
      const section = pathParts[2] || "account";

      const { openSettings } = await import("./settings.js");
      openSettings(section);
    })();
  }
);

addRoute(
  (pathname) => pathname.startsWith("/@"),
  (pathname) => {
    const username = pathname.slice(2);
    (async () => {
      const { loadProfile } = await import("./profile.js");
      loadProfile(username);
    })();
  }
);

addRoute(
  (pathname) => pathname.startsWith("/tweet/"),
  (pathname) => {
    const tweetId = pathname.split("/tweet/")[1];
    (async () => {
      const openTweet = await import("./tweet.js");
      openTweet.default(tweetId);
    })();
  }
);
