export function createGradientPicker(options = {}) {
	const { onChange, initialValue = "", id = "" } = options;

	const container = document.createElement("div");
	container.className = "gradient-picker";
	if (id) container.id = id;

	const preview = document.createElement("div");
	preview.className = "gradient-picker-preview";
	const previewInner = document.createElement("div");
	previewInner.className = "gradient-picker-preview-inner";
	preview.appendChild(previewInner);

	const stopsTrack = document.createElement("div");
	stopsTrack.className = "gradient-picker-stops";
	preview.appendChild(stopsTrack);

	const controls = document.createElement("div");
	controls.className = "gradient-picker-controls";

	const modeSelector = document.createElement("div");
	modeSelector.className = "gradient-picker-mode";

	const solidBtn = document.createElement("button");
	solidBtn.type = "button";
	solidBtn.textContent = "Solid";
	solidBtn.className = "active";

	const gradientBtn = document.createElement("button");
	gradientBtn.type = "button";
	gradientBtn.textContent = "Gradient";

	modeSelector.appendChild(solidBtn);
	modeSelector.appendChild(gradientBtn);

	const colorInputs = document.createElement("div");
	colorInputs.className = "gradient-picker-color-inputs";

	const color1Container = document.createElement("div");
	color1Container.className = "gradient-picker-color-input";
	const color1Picker = document.createElement("input");
	color1Picker.type = "color";
	color1Picker.value = "#ff0000";
	const color1Hex = document.createElement("input");
	color1Hex.type = "text";
	color1Hex.className = "gradient-picker-hex-input";
	color1Hex.placeholder = "#ff0000";
	color1Hex.value = "#ff0000";
	color1Container.appendChild(color1Picker);
	color1Container.appendChild(color1Hex);

	const directionContainer = document.createElement("div");
	directionContainer.className = "gradient-picker-direction";
	directionContainer.style.display = "none";
	const directionSelect = document.createElement("select");
	const directions = [
		{ value: "to right", label: "→" },
		{ value: "to left", label: "←" },
		{ value: "to bottom", label: "↓" },
		{ value: "to top", label: "↑" },
		{ value: "to bottom right", label: "↘" },
		{ value: "to bottom left", label: "↙" },
		{ value: "to top right", label: "↗" },
		{ value: "to top left", label: "↖" },
	];
	for (const dir of directions) {
		const opt = document.createElement("option");
		opt.value = dir.value;
		opt.textContent = dir.label;
		directionSelect.appendChild(opt);
	}
	directionContainer.appendChild(directionSelect);

	const actionsRow = document.createElement("div");
	actionsRow.className = "gradient-picker-actions";

	const addStopBtn = document.createElement("button");
	addStopBtn.type = "button";
	addStopBtn.className = "gradient-picker-action";
	addStopBtn.textContent = "+ Stop";
	addStopBtn.style.display = "none";

	const clearBtn = document.createElement("button");
	clearBtn.type = "button";
	clearBtn.className = "gradient-picker-clear";
	clearBtn.textContent = "Clear";

	colorInputs.appendChild(color1Container);

	controls.appendChild(modeSelector);
	controls.appendChild(colorInputs);
	controls.appendChild(directionContainer);
	actionsRow.appendChild(addStopBtn);
	actionsRow.appendChild(clearBtn);
	controls.appendChild(actionsRow);

	container.appendChild(preview);
	container.appendChild(controls);

	let mode = "solid";
	let currentValue = "";
	let stops = [
		{ color: "#ff0000", position: 0 },
		{ color: "#0000ff", position: 100 },
	];
	let activeStop = 0;

	const toHexColor = (color) => {
		if (/^#[0-9A-Fa-f]{6}$/.test(color)) return color;
		if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
			return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
		}
		const namedColors = {
			red: "#ff0000",
			blue: "#0000ff",
			green: "#008000",
			yellow: "#ffff00",
			purple: "#800080",
			orange: "#ffa500",
			pink: "#ffc0cb",
			cyan: "#00ffff",
			magenta: "#ff00ff",
			white: "#ffffff",
			black: "#000000",
			gray: "#808080",
			grey: "#808080",
			gold: "#ffd700",
			silver: "#c0c0c0",
		};
		return namedColors[color.toLowerCase()] || "#ff0000";
	};

	const renderStops = () => {
		stopsTrack.innerHTML = "";
		if (mode === "solid") return;
		stops.forEach((stop, idx) => {
			const handle = document.createElement("div");
			handle.className = "gradient-picker-stop-handle";
			handle.style.left = `${stop.position}%`;
			handle.style.backgroundColor = stop.color;
			if (idx === activeStop) handle.classList.add("active");
			handle.addEventListener("mousedown", (e) => startDrag(e, idx));
			handle.addEventListener("dblclick", (e) => {
				e.stopPropagation();
				if (stops.length > 2) {
					stops.splice(idx, 1);
					if (activeStop >= stops.length) activeStop = stops.length - 1;
					syncInputs();
					emitChange();
				}
			});
			handle.addEventListener("click", (e) => {
				e.stopPropagation();
				activeStop = idx;
				syncInputs();
				renderStops();
			});
			stopsTrack.appendChild(handle);
		});
	};

	const startDrag = (e, idx) => {
		e.preventDefault();
		activeStop = idx;
		syncInputs();
		renderStops();
		const trackRect = stopsTrack.getBoundingClientRect();
		const onMove = (me) => {
			const x = me.clientX - trackRect.left;
			const pct = Math.max(0, Math.min(100, (x / trackRect.width) * 100));
			stops[idx].position = Math.round(pct);
			renderStops();
			emitChange();
		};
		const onUp = () => {
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
		};
		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
	};

	const syncInputs = () => {
		if (mode === "solid") {
			color1Picker.value = toHexColor(stops[0]?.color || "#ff0000");
			color1Hex.value = stops[0]?.color || "#ff0000";
		} else {
			const stop = stops[activeStop];
			if (stop) {
				color1Picker.value = toHexColor(stop.color);
				color1Hex.value = stop.color;
			}
		}
	};

	const updatePreview = () => {
		if (!currentValue) {
			previewInner.style.background = "var(--bg-tertiary)";
		} else {
			previewInner.style.background = currentValue;
		}
	};

	const getValue = () => {
		if (mode === "solid") {
			return stops[0]?.color || "";
		}
		const sorted = [...stops].sort((a, b) => a.position - b.position);
		const colorStops = sorted
			.map((s) => `${s.color} ${s.position}%`)
			.join(", ");
		const dir = directionSelect.value;
		return `linear-gradient(${dir}, ${colorStops})`;
	};

	const emitChange = () => {
		currentValue = getValue();
		updatePreview();
		renderStops();
		if (onChange) onChange(currentValue);
	};

	const setMode = (newMode) => {
		mode = newMode;
		if (mode === "solid") {
			solidBtn.className = "active";
			gradientBtn.className = "";
			directionContainer.style.display = "none";
			addStopBtn.style.display = "none";
			if (stops.length === 0) stops = [{ color: "#ff0000", position: 0 }];
		} else {
			solidBtn.className = "";
			gradientBtn.className = "active";
			directionContainer.style.display = "flex";
			addStopBtn.style.display = "inline-block";
			if (stops.length < 2) {
				stops = [
					{ color: "#ff0000", position: 0 },
					{ color: "#0000ff", position: 100 },
				];
			}
		}
		activeStop = 0;
		syncInputs();
		emitChange();
	};

	const parseValue = (val) => {
		if (!val) {
			stops = [{ color: "#ff0000", position: 0 }];
			setMode("solid");
			currentValue = "";
			updatePreview();
			return;
		}

		const gradientMatch = val.match(
			/linear-gradient\s*\(\s*([^,]+)\s*,\s*([\s\S]+)\)/i,
		);
		if (gradientMatch) {
			const direction = gradientMatch[1].trim();
			const stopsStr = gradientMatch[2].trim();

			for (const opt of directionSelect.options) {
				if (opt.value === direction) {
					directionSelect.value = direction;
					break;
				}
			}

			const parsed = [];
			const stopRegex =
				/(#[0-9A-Fa-f]{3,6}|rgba?\([^)]+\)|[a-zA-Z]+)\s*(\d+%)?/g;
			const matches = stopsStr.matchAll(stopRegex);
			let idx = 0;
			for (const match of matches) {
				const color = match[1];
				const pos = match[2] ? parseInt(match[2], 10) : idx === 0 ? 0 : 100;
				parsed.push({ color, position: pos });
				idx++;
			}

			if (parsed.length >= 2) {
				stops = parsed;
				mode = "gradient";
				solidBtn.className = "";
				gradientBtn.className = "active";
				directionContainer.style.display = "flex";
				addStopBtn.style.display = "inline-block";
				activeStop = 0;
				syncInputs();
				currentValue = val;
				updatePreview();
				renderStops();
				return;
			}
		}

		stops = [{ color: val, position: 0 }];
		setMode("solid");
		currentValue = val;
		updatePreview();
	};

	solidBtn.addEventListener("click", () => setMode("solid"));
	gradientBtn.addEventListener("click", () => setMode("gradient"));

	addStopBtn.addEventListener("click", () => {
		if (mode !== "gradient") return;
		const midPos = stops.length
			? Math.round(stops.reduce((sum, s) => sum + s.position, 0) / stops.length)
			: 50;
		stops.push({ color: "#888888", position: midPos });
		activeStop = stops.length - 1;
		syncInputs();
		emitChange();
	});

	color1Picker.addEventListener("input", () => {
		const idx = mode === "solid" ? 0 : activeStop;
		if (stops[idx]) {
			stops[idx].color = color1Picker.value;
			color1Hex.value = color1Picker.value;
			emitChange();
		}
	});

	color1Hex.addEventListener("input", () => {
		const idx = mode === "solid" ? 0 : activeStop;
		if (stops[idx]) {
			stops[idx].color = color1Hex.value;
			if (/^#[0-9A-Fa-f]{6}$/.test(color1Hex.value)) {
				color1Picker.value = color1Hex.value;
			}
			emitChange();
		}
	});

	directionSelect.addEventListener("change", emitChange);

	clearBtn.addEventListener("click", () => {
		parseValue("");
		emitChange();
	});

	preview.addEventListener("click", (e) => {
		if (mode !== "gradient") {
			setMode("gradient");
			return;
		}
		const rect = stopsTrack.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const pct = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
		stops.push({ color: "#888888", position: pct });
		activeStop = stops.length - 1;
		syncInputs();
		emitChange();
	});

	parseValue(initialValue);

	return {
		element: container,
		getValue: () => currentValue,
		setValue: parseValue,
	};
}
