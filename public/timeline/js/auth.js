export const authToken = localStorage.getItem("authToken");

let _user;

const closeDropdown = (dropdown) => {
	if (!dropdown) return;
	dropdown.classList.remove("open");
	const onTransitionEnd = (ev) => {
		if (ev.propertyName === "opacity") {
			dropdown.style.display = "none";
			dropdown.removeEventListener("transitionend", onTransitionEnd);
		}
	};
	const fallback = setTimeout(() => {
		if (getComputedStyle(dropdown).opacity === "0") {
			dropdown.style.display = "none";
		}
		clearTimeout(fallback);
	}, 300);
	dropdown.addEventListener("transitionend", onTransitionEnd);
};

(async () => {
	const urlParams = new URLSearchParams(window.location.search);
	const impersonateToken = urlParams.get("impersonate");

	if (impersonateToken) {
		localStorage.setItem("authToken", decodeURIComponent(impersonateToken));
		window.history.replaceState({}, document.title, window.location.pathname);
	}

	if (!authToken && !impersonateToken) {
		cookieStore.delete("agree");
		window.location.href = "/";
		return;
	}

	const currentToken = impersonateToken
		? decodeURIComponent(impersonateToken)
		: authToken;
	const response = await fetch("/api/auth/me", {
		headers: { Authorization: `Bearer ${currentToken}` },
	});

	const { user, error, suspension } = await response.json();

	if (error && suspension) {
		document.body.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-monitor-x-icon lucide-monitor-x"><path d="m14.5 12.5-5-5"/><path d="m9.5 12.5 5-5"/><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>
		
		<h1 style="font-weight: 500;">Your account has been suspended</h1>
		<p>Your account has been ${suspension.expires_at ? "temporarily" : `permanently`} suspended by a moderator due to a violation of our policies.</p>

		<p><b>Reason:</b> ${suspension.reason}</p>

		${suspension.expires_at ? `<p>This suspension will expire on ${new Date(suspension.expires_at).toLocaleString()}</p>` : ""}

		<p>Note that if you attempt to evade a suspension by creating new accounts, we will suspend your new accounts. If you wish to appeal this suspension, please contact our support team.</p>
		
		<p>You may also pursue alternative forms of redress, including out-of-court dispute settlement or judicial redress.</p>
		
		<p><a href="javascript:" onclick="localStorage.removeItem("authToken");window.location.href = "/";">Log out</a></p>`;
		return;
	}

	if (error || !user) {
		localStorage.removeItem("authToken");
		window.location.href = "/";
		return;
	}
	_user = user;
	document.querySelector(".account img").src =
		user.avatar || `https://unavatar.io/${user.username}`;
	const outsideClickHandler = (e) => {
		const accountBtn = document.querySelector(".account");
		const dropdown = document.getElementById("accountDropdown");
		if (!dropdown) return;
		if (!accountBtn.contains(e.target) && !dropdown.contains(e.target)) {
			closeDropdown(dropdown);
			document.removeEventListener("click", outsideClickHandler);
		}
	};

	document.querySelector(".account").addEventListener("click", (e) => {
		e.stopPropagation();
		e.preventDefault();
		const dropdown = document.getElementById("accountDropdown");
		if (!dropdown.classList.contains("open")) {
			dropdown.style.display = "block";
			void dropdown.offsetHeight;
			dropdown.classList.add("open");
			document.addEventListener("click", outsideClickHandler);
		} else {
			closeDropdown(dropdown);
			document.removeEventListener("click", outsideClickHandler);
		}
	});

	document.getElementById("myProfileLink").addEventListener("click", (e) => {
		e.preventDefault();
		const dropdown = document.getElementById("accountDropdown");
		closeDropdown(dropdown);
		import("./profile.js").then(({ default: openProfile }) => {
			openProfile(_user.username);
		});
	});

	document.getElementById("settingsLink").addEventListener("click", (e) => {
		e.preventDefault();
		const dropdown = document.getElementById("accountDropdown");
		closeDropdown(dropdown);
		import("./settings.js").then(({ openSettings }) => {
			openSettings("main");
		});
	});

	document.getElementById("signOutLink").addEventListener("click", (e) => {
		e.preventDefault();
		const dropdown = document.getElementById("accountDropdown");
		closeDropdown(dropdown);
		localStorage.removeItem("authToken");
		window.location.href = "/";
	});

	document.querySelector(".loader").style.opacity = "0";
	setTimeout(() => {
		document.querySelector(".loader").style.display = "none";
	}, 150);
})();

export default function getUser() {
	return new Promise((resolve) => {
		if (_user) resolve(_user);

		const interval = setInterval(() => {
			if (!_user) return;
			resolve(_user);
			clearInterval(interval);
		}, 1);
	});
}
