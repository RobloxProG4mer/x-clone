export function updateTabIndicator(container, activeTab) {
	const indicator = container;
	const tabs = Array.from(
		container
			.querySelectorAll(
				"a, button, .filter-btn, .profile-tab-btn, .communities-tab, .community-detail-tab",
			)
			.values(),
	).filter((el) => !el.classList.contains("hidden"));

	const activeIndex = tabs.indexOf(activeTab);
	if (activeIndex === -1) return;

	const tabWidth = activeTab.offsetWidth;
	const tabLeft = activeTab.offsetLeft;

	indicator.style.setProperty("--indicator-width", `${tabWidth}px`);
	indicator.style.setProperty("--indicator-left", `${tabLeft}px`);

	if (!indicator.style.getPropertyValue("--indicator-width")) {
		indicator.style.setProperty("--indicator-width", `${tabWidth}px`);
		indicator.style.setProperty("--indicator-left", `${tabLeft}px`);
	}

	const afterEl = window.getComputedStyle(indicator, "::after");
	if (afterEl) {
		const currentTransform = `translateX(${tabLeft}px)`;
		indicator.style.setProperty("--indicator-transform", currentTransform);

		if (indicator.getAttribute("data-indicator-init") !== "true") {
			indicator.style.setProperty("--indicator-width", `${tabWidth}px`);
			indicator.style.setProperty("--indicator-left", `${tabLeft}px`);
			indicator.setAttribute("data-indicator-init", "true");
		}
	}

	requestAnimationFrame(() => {
		if (indicator.parentElement?.style) {
			indicator.parentElement.style.setProperty(
				"--indicator-width",
				`${tabWidth}px`,
			);
			indicator.parentElement.style.setProperty(
				"--indicator-left",
				`${tabLeft}px`,
			);
		}

		const style = document.createElement("style");
		const existingStyle = document.getElementById("tab-indicator-animation");
		if (existingStyle) {
			existingStyle.remove();
		}
		style.id = "tab-indicator-animation";
		style.textContent = `
			${container.tagName.toLowerCase()}${container.className ? `.${container.className.split(" ").join(".")}` : ""}::after {
				width: ${tabWidth}px !important;
				transform: translateX(${tabLeft}px) !important;
			}
		`;
		document.head.appendChild(style);
	});
}

export function initTabIndicators() {
	const tabContainers = [
		document.querySelector(".timeline h1"),
		document.querySelector(".search-filters"),
		document.querySelector(".profile-tab-nav"),
		document.querySelector(".communities-tabs"),
		document.querySelector(".community-detail-tabs"),
	].filter(Boolean);

	tabContainers.forEach((container) => {
		const activeTab = container.querySelector(".active");
		if (activeTab) {
			updateTabIndicator(container, activeTab);
		}

		const resizeObserver = new ResizeObserver(() => {
			const active = container.querySelector(".active");
			if (active) {
				updateTabIndicator(container, active);
			}
		});
		resizeObserver.observe(container);

		container.addEventListener("click", (e) => {
			const target = e.target.closest(
				"a, button, .filter-btn, .profile-tab-btn, .communities-tab, .community-detail-tab",
			);
			if (target) {
				const tabs = Array.from(
					container.querySelectorAll(
						"a, button, .filter-btn, .profile-tab-btn, .communities-tab, .community-detail-tab",
					),
				);
				tabs.forEach((tab) => tab.classList.remove("active"));
				target.classList.add("active");
				updateTabIndicator(container, target);
			}
		});
	});
}
