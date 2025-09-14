import showPage, { addRoute } from "./pages.js";

// Create settings page elements dynamically
const createSettingsPage = () => {
	const settingsContainer = document.createElement("div");
	settingsContainer.className = "settings";
	settingsContainer.style.display = "none";

	settingsContainer.innerHTML = `
		<div class="settings-header">
			<a href="/" class="back-button">
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
					<path d="m12 19-7-7 7-7"/>
					<path d="M19 12H5"/>
				</svg>
			</a>
			<div class="settings-header-info">
				<h1>Settings</h1>
			</div>
		</div>

		<div class="settings-body">
			<div class="settings-sidebar">
				<button class="settings-tab-btn active" data-tab="main">Main</button>
				<button class="settings-tab-btn" data-tab="other">Other</button>
			</div>
			<div class="settings-content" id="settings-content">
				<!-- Content will be dynamically populated -->
			</div>
		</div>
	`;

	// Add CSS styles
	const style = document.createElement("style");
	style.textContent = `
		.settings {
			flex-direction: column;
			min-height: 100vh;
		}

		.settings-header {
			display: flex;
			align-items: center;
			padding: 20px 0;
			border-bottom: 1px solid var(--border-primary);
			margin-bottom: 20px;
		}

		.back-button {
			background: none;
			border: none;
			color: var(--text-primary);
			cursor: pointer;
			padding: 8px;
			margin-right: 20px;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: background-color 0.2s;
		}

		.back-button:hover {
			background-color: var(--surface-hover);
		}

		.settings-header-info h1 {
			margin: 0;
			font-size: 24px;
			font-weight: 700;
			color: var(--text-primary);
		}

		.settings-body {
			display: flex;
			gap: 20px;
			flex: 1;
		}

		.settings-sidebar {
			background-color: var(--bg-secondary);
			border-radius: 8px;
			padding: 8px;
			width: 200px;
			height: fit-content;
		}

		.settings-tab-btn {
			width: 100%;
			background: transparent;
			border: none;
			color: var(--text-primary);
			text-align: left;
			padding: 12px 16px;
			font-size: 16px;
			cursor: pointer;
			border-radius: 6px;
			margin-bottom: 4px;
			font-family: inherit;
			font-weight: 400;
			transition: background-color 0.2s;
		}

		.settings-tab-btn:hover {
			background-color: var(--surface-hover);
		}

		.settings-tab-btn.active {
			background-color: var(--primary);
			color: white;
			font-weight: 500;
		}

		.settings-content {
			background-color: var(--bg-secondary);
			border-radius: 8px;
			padding: 24px;
			flex: 1;
		}

		.settings-section {
			margin-bottom: 32px;
		}

		.settings-section h2 {
			margin: 0 0 16px 0;
			font-size: 20px;
			font-weight: 600;
			color: var(--text-primary);
		}

		.settings-section p {
			margin: 0 0 16px 0;
			color: var(--text-secondary);
			line-height: 1.5;
		}

		.setting-item {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 16px 0;
			border-bottom: 1px solid var(--border-primary);
		}

		.setting-item:last-child {
			border-bottom: none;
		}

		.setting-info {
			flex: 1;
		}

		.setting-title {
			font-weight: 500;
			color: var(--text-primary);
			margin: 0 0 4px 0;
		}

		.setting-description {
			font-size: 14px;
			color: var(--text-secondary);
			margin: 0;
		}

		.setting-control {
			margin-left: 16px;
		}

		.switch {
			position: relative;
			display: inline-block;
			width: 44px;
			height: 24px;
		}

		.switch input {
			opacity: 0;
			width: 0;
			height: 0;
		}

		.slider {
			position: absolute;
			cursor: pointer;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background-color: var(--border-primary);
			transition: .4s;
			border-radius: 24px;
		}

		.slider:before {
			position: absolute;
			content: "";
			height: 18px;
			width: 18px;
			left: 3px;
			bottom: 3px;
			background-color: white;
			transition: .4s;
			border-radius: 50%;
		}

		input:checked + .slider {
			background-color: var(--primary);
		}

		input:checked + .slider:before {
			transform: translateX(20px);
		}

		@media (max-width: 768px) {
			.settings-body {
				flex-direction: column;
			}
			
			.settings-sidebar {
				width: 100%;
				display: flex;
				overflow-x: auto;
				gap: 8px;
			}
			
			.settings-tab-btn {
				white-space: nowrap;
				margin-bottom: 0;
			}
		}
	`;

	document.head.appendChild(style);
	document.body.appendChild(settingsContainer);

	return settingsContainer;
};

// Settings tab content
const settingsTabs = {
	main: {
		title: "Main Settings",
		content: () => `
			<div class="settings-section">
				<h2>Appearance</h2>
				<div class="setting-item">
					<div class="setting-info">
						<div class="setting-title">Dark mode</div>
						<div class="setting-description">Switch between light and dark themes</div>
					</div>
					<div class="setting-control">
						<label class="switch">
							<input type="checkbox" id="dark-mode-toggle">
							<span class="slider"></span>
						</label>
					</div>
				</div>
			</div>

			<div class="settings-section">
				<h2>Privacy</h2>
				<div class="setting-item">
					<div class="setting-info">
						<div class="setting-title">Private account</div>
						<div class="setting-description">Only approved followers can see your tweets</div>
					</div>
					<div class="setting-control">
						<label class="switch">
							<input type="checkbox" id="private-account-toggle">
							<span class="slider"></span>
						</label>
					</div>
				</div>
				<div class="setting-item">
					<div class="setting-info">
						<div class="setting-title">Show activity status</div>
						<div class="setting-description">Let others see when you're active</div>
					</div>
					<div class="setting-control">
						<label class="switch">
							<input type="checkbox" id="activity-status-toggle" checked>
							<span class="slider"></span>
						</label>
					</div>
				</div>
			</div>

			<div class="settings-section">
				<h2>Notifications</h2>
				<div class="setting-item">
					<div class="setting-info">
						<div class="setting-title">Push notifications</div>
						<div class="setting-description">Receive notifications for new activity</div>
					</div>
					<div class="setting-control">
						<label class="switch">
							<input type="checkbox" id="push-notifications-toggle" checked>
							<span class="slider"></span>
						</label>
					</div>
				</div>
				<div class="setting-item">
					<div class="setting-info">
						<div class="setting-title">Email notifications</div>
						<div class="setting-description">Receive email updates about your account</div>
					</div>
					<div class="setting-control">
						<label class="switch">
							<input type="checkbox" id="email-notifications-toggle">
							<span class="slider"></span>
						</label>
					</div>
				</div>
			</div>
		`,
	},
	other: {
		title: "Other Settings",
		content: () => `
			<div class="settings-section">
				<h2>Account</h2>
				<div class="setting-item">
					<div class="setting-info">
						<div class="setting-title">Two-factor authentication</div>
						<div class="setting-description">Add an extra layer of security to your account</div>
					</div>
					<div class="setting-control">
						<button class="btn secondary">Enable</button>
					</div>
				</div>
				<div class="setting-item">
					<div class="setting-info">
						<div class="setting-title">Download data</div>
						<div class="setting-description">Download a copy of your tweetapus data</div>
					</div>
					<div class="setting-control">
						<button class="btn secondary">Download</button>
					</div>
				</div>
			</div>

			<div class="settings-section">
				<h2>Danger Zone</h2>
				<div class="setting-item">
					<div class="setting-info">
						<div class="setting-title">Deactivate account</div>
						<div class="setting-description">Temporarily disable your account</div>
					</div>
					<div class="setting-control">
						<button class="btn secondary" style="color: #dc3545; border-color: #dc3545;">Deactivate</button>
					</div>
				</div>
			</div>
		`,
	},
};

let settingsPage;

// Initialize settings page
const initializeSettings = () => {
	if (!settingsPage) {
		settingsPage = createSettingsPage();
	}

	const contentArea = settingsPage.querySelector("#settings-content");
	const tabButtons = settingsPage.querySelectorAll(".settings-tab-btn");

	// Tab switching functionality
	const switchTab = (tabKey) => {
		// Update active tab button
		tabButtons.forEach((btn) => {
			if (btn.dataset.tab === tabKey) {
				btn.classList.add("active");
			} else {
				btn.classList.remove("active");
			}
		});

		// Update content
		const tab = settingsTabs[tabKey];
		if (tab) {
			contentArea.innerHTML = tab.content();

			// Initialize any interactive elements
			initializeSettingsControls();
		}

		// Update URL
		const newPath = `/settings/${tabKey}`;
		if (window.location.pathname !== newPath) {
			window.history.pushState(null, null, newPath);
		}
	};

	// Add click listeners to tab buttons
	tabButtons.forEach((btn) => {
		btn.addEventListener("click", () => {
			switchTab(btn.dataset.tab);
		});
	});

	// Back button functionality
	const backButton = settingsPage.querySelector(".back-button");
	backButton.addEventListener("click", (e) => {
		e.preventDefault();
		showPage("timeline", { path: "/" });
	});

	// Handle initial tab based on URL
	const pathParts = window.location.pathname.split("/");
	let initialTab = pathParts[2];
	if (!initialTab || !settingsTabs[initialTab]) {
		initialTab = "main";
	}
	switchTab(initialTab);
};

// Initialize interactive controls
const initializeSettingsControls = () => {
	// Dark mode toggle
	const darkModeToggle = document.getElementById("dark-mode-toggle");
	if (darkModeToggle) {
		// Set initial state based on current theme
		darkModeToggle.checked =
			document.body.classList.contains("dark-mode") ||
			document.documentElement.getAttribute("data-theme") === "dark";

		darkModeToggle.addEventListener("change", (e) => {
			// This would integrate with the existing dark mode system
			if (e.target.checked) {
				document.documentElement.setAttribute("data-theme", "dark");
			} else {
				document.documentElement.setAttribute("data-theme", "light");
			}
		});
	}

	// Other setting controls could be initialized here
	// For now, they're just UI elements without backend integration
};

// Export function to open settings
export const openSettings = (section = "main") => {
	const page = showPage("settings", {
		path: `/settings/${section}`,
		recoverState: () => initializeSettings(),
	});

	if (!page) {
		initializeSettings();
		showPage("settings", { path: `/settings/${section}` });
	}

	return settingsPage;
};

// Add route handlers
addRoute(
	(pathname) => pathname.startsWith("/settings"),
	(pathname) => {
		const pathParts = pathname.split("/");
		const section = pathParts[2] || "main";
		openSettings(section);
	},
);

// Make sure the settings page is available in the pages object
if (typeof window !== "undefined") {
	// This will be handled by the pages.js module
}
