async function createEmojiPicker() {
  if (!customElements.get("emoji-picker")) {
    await import("https://unpkg.com/emoji-picker-element");
  }

  const picker = document.createElement("emoji-picker");
  return picker;
}

export async function showEmojiPickerPopup(onEmojiSelect, position = {}) {
  const picker = await createEmojiPicker(onEmojiSelect);
  picker.className = "emoji-picker emoji-picker-popup";

  document
    .querySelectorAll("emoji-picker")
    .forEach((pickerEl) => pickerEl.remove());
  document.body.appendChild(picker);

  const rect = picker.getBoundingClientRect();
  let x = position.x ?? window.innerWidth / 2 - rect.width / 2;
  let y = position.y ?? window.innerHeight / 2 - rect.height / 2;

  if (x + rect.width > window.innerWidth)
    x = window.innerWidth - rect.width - 10;
  if (y + rect.height > window.innerHeight)
    y = window.innerHeight - rect.height - 10;
  if (x < 10) x = 10;
  if (y < 10) y = 10;

  picker.style.position = "fixed";
  picker.style.left = `${x}px`;
  picker.style.top = `${y}px`;

  // cleanup function removes picker, custom container and click handler
  let customContainer = null;
  const cleanup = () => {
    try {
      picker.parentNode?.removeChild(picker);
    } catch (_e) {}
    try {
      customContainer?.parentNode?.removeChild(customContainer);
    } catch (_e) {}
    try {
      document.removeEventListener("click", closeOnClickOutside);
    } catch (_e) {}
  };

  picker.addEventListener("emoji-click", (event) => {
    if (onEmojiSelect) {
      onEmojiSelect(event.detail.unicode);
    }
    cleanup();
  });

  // Load custom emojis (public endpoint)
  try {
    const resp = await fetch("/api/emojis");
    if (resp.ok) {
      const data = await resp.json();
      const custom = data.emojis || [];
      if (custom.length) {
        customContainer = document.createElement("div");
        customContainer.className = "emoji-picker-custom";
        customContainer.style.position = "fixed";
        customContainer.style.left = `${x}px`;
        const pickerRectNow = picker.getBoundingClientRect();
        const pickerHeight = pickerRectNow.height;
        const pickerWidthNow = pickerRectNow.width;
        customContainer.style.top = `${y + pickerHeight + 8}px`;
        customContainer.style.width = `${pickerWidthNow}px`;
        customContainer.style.boxSizing = "border-box";
        // ensure custom container does not overflow the viewport
        if (x + pickerWidthNow > window.innerWidth) {
          const newLeft = Math.max(10, window.innerWidth - pickerWidthNow - 10);
          customContainer.style.left = `${newLeft}px`;
        }
        customContainer.style.zIndex = 10001;

        const title = document.createElement("div");
        title.className = "emoji-picker-custom-title";
        title.textContent = "Custom";
        customContainer.appendChild(title);

        const grid = document.createElement("div");
        grid.className = "emoji-picker-custom-grid";

        for (const e of custom) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "emoji-picker-custom-item";

          const img = document.createElement("img");
          img.src = e.file_url;
          img.alt = e.name;
          img.title = `:${e.name}:`;
          button.appendChild(img);

          button.addEventListener("click", (ev) => {
            ev.stopPropagation();
            try {
              const customEvent = new CustomEvent("emoji-click", {
                detail: { unicode: `:${e.name}:` },
                bubbles: true,
                cancelable: true,
              });
              picker.dispatchEvent(customEvent);
            } catch (_err) {}

            if (onEmojiSelect) {
              onEmojiSelect(`:${e.name}:`);
            }

            cleanup();
          });

          grid.appendChild(button);
        }

        customContainer.appendChild(grid);
        document.body.appendChild(customContainer);
      }
    }
  } catch (_err) {
    // ignore failures to load custom emojis
  }

  const closeOnClickOutside = (e) => {
    const clickedInsidePicker = picker.contains(e.target);
    const clickedInsideCustom = customContainer?.contains(e.target);
    if (!clickedInsidePicker && !clickedInsideCustom) {
      cleanup();
    }
  };

  setTimeout(() => document.addEventListener("click", closeOnClickOutside), 10);

  return picker;
}
