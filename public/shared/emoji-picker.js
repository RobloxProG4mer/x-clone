const EMOJI_CATEGORIES = {
  smileys: {
    name: "Smileys",
    icon: "😀",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😌", "😔", "😑", "😐", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤑", "🤠", "🥳", "😎", "🤓", "🧐", "😕", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾"],
  },
  gestures: {
    name: "Gestures",
    icon: "👋",
    emojis: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👍", "👎", "👊", "👏", "🙌", "👐", "🤲", "🤝", "🤜", "🤛", "🦵", "🦶", "👂", "👃", "🧠", "🦷", "🦴", "👀", "👁️", "👅", "👄"],
  },
  hearts: {
    name: "Hearts & Love",
    icon: "❤️",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💌", "💜"],
  },
  celebration: {
    name: "Celebration",
    icon: "🎉",
    emojis: ["🎉", "🎊", "🎈", "🎀", "🎁", "🏆", "🥇", "🥈", "🥉", "⭐", "🌟", "✨", "⚡", "🔥", "💥", "✅", "❌", "⚠️", "🚫", "📢", "📣"],
  },
  animals: {
    name: "Animals",
    icon: "🐶",
    emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌", "🐞", "🐜", "🪰", "🪲", "🦟", "🦗", "🕷️", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🧐", "🐐", "🦌", "🐕", "🐩", "🦮", "🐈", "🐓", "🦃", "🦚", "🦜", "🦢", "🦩", "🕸️", "🐇", "🦝", "🦨", "🦡", "🦦", "🦥", "🐁", "🐀", "🐿️", "🦔"],
  },
  food: {
    name: "Food",
    icon: "🍕",
    emojis: ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🌽", "🥕", "🥔", "🍠", "🥐", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🥓", "🥞", "🍖", "🍗", "🥩", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🍰", "🎂", "🧁", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🍯", "🥜", "🍼", "☕", "🍵", "🍶", "🍾", "🍷", "🍸", "🍹", "🍺", "🍻", "🥂", "🥃"],
  },
  travel: {
    name: "Travel",
    icon: "✈️",
    emojis: ["✈️", "🚁", "🚂", "🚃", "🚄", "🚅", "🚆", "🚇", "🚈", "🚉", "🚊", "🚝", "🚞", "🚋", "🚌", "🚍", "🚎", "🚐", "🚑", "🚒", "🚓", "🚔", "🚕", "🚖", "🚗", "🚘", "🚙", "🚚", "🚛", "🚜", "🏎️", "🏍️", "🛵", "🦯", "🦽", "🦼", "🛺", "🚲", "🛴", "🛹", "🛼", "🚏", "⛽", "🚨", "🚥", "🚦", "🛑", "🚧", "⚓", "⛵", "🚤", "🛳️", "🛥️", "🛩️", "💈", "🛶", "⛴️", "🚀", "🛸", "🌍", "🌎", "🌏"],
  },
  objects: {
    name: "Objects",
    icon: "⚽",
    emojis: ["⚽", "⚾", "🥎", "🎾", "🏐", "🏈", "🏉", "🥏", "🎳", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "⛸️", "🎣", "🎽", "🎿", "⛷️", "🏂", "🪂", "🛷", "🥌", "🎯", "🪀", "🪁", "🎮", "🎲", "🧩", "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🏍️", "🏎️", "🛵", "🦯", "🦽", "🦼", "🛺", "🚲", "🛴", "🛹", "🛼", "🛴", "🚨", "🚔", "🚍", "🚘", "🚖", "🚡", "🚠", "🚟", "🚃", "🚋", "🚞", "🚝", "🚄", "🚅", "🚈", "🚂", "🚆", "🚇", "🚊", "🚉", "✈️", "🛫", "🛬", "🛰️", "💺", "🛶", "⛵", "🚤", "🛳️", "🛥️", "🛩️", "🚁", "🛸", "⛴️", "🚀", "⚓"],
  },
  symbols: {
    name: "Symbols",
    icon: "❤️",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💌", "✨", "⭐", "🌟", "✍️", "📝", "📋", "📄", "📃", "📑", "🧾", "📊", "📈", "📉", "📇", "🗃️", "🗳️", "🗂️", "🗞️", "📰", "📓", "📔", "📒", "📕", "📗", "📘", "📙", "📚", "📖", "🧷", "🔖", "🧷", "💰", "💴", "💵", "💶", "💷", "💸", "✉️", "📩", "📨", "📤", "📥", "📦", "🏷️", "🧧", "📪", "📫", "📬", "📭", "📮", "✏️", "✒️", "🖋️", "🖊️", "🖌️", "🖍️", "📝"],
  },
};

export function createEmojiPicker(onEmojiSelect) {
  const pickerContainer = document.createElement("div");
  pickerContainer.className = "emoji-picker";

  const tabsContainer = document.createElement("div");
  tabsContainer.className = "emoji-picker-tabs";

  const contentContainer = document.createElement("div");
  contentContainer.className = "emoji-picker-content";

  const searchContainer = document.createElement("div");
  searchContainer.className = "emoji-picker-search";
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search emojis...";
  searchInput.className = "emoji-picker-search-input";
  searchContainer.appendChild(searchInput);

  const emojisGrid = document.createElement("div");
  emojisGrid.className = "emoji-picker-grid";

  let currentCategory = null;

  const renderCategory = (categoryKey) => {
    currentCategory = categoryKey;
    const category = EMOJI_CATEGORIES[categoryKey];
    emojisGrid.innerHTML = "";

    category.emojis.forEach((emoji) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "emoji-button";
      button.textContent = emoji;
      button.addEventListener("click", () => {
        onEmojiSelect(emoji);
        pickerContainer.remove();
      });
      emojisGrid.appendChild(button);
    });
  };

  const renderSearchResults = (query) => {
    emojisGrid.innerHTML = "";

    if (!query.trim()) {
      if (currentCategory) {
        renderCategory(currentCategory);
      }
      return;
    }

    const lowerQuery = query.toLowerCase();
    const results = [];

    Object.values(EMOJI_CATEGORIES).forEach((category) => {
      category.emojis.forEach((emoji) => {
        if (category.name.toLowerCase().includes(lowerQuery)) {
          results.push(emoji);
        }
      });
    });

    if (results.length === 0) {
      emojisGrid.innerHTML = '<div class="emoji-no-results">No emojis found</div>';
      return;
    }

    results.forEach((emoji) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "emoji-button";
      button.textContent = emoji;
      button.addEventListener("click", () => {
        onEmojiSelect(emoji);
        pickerContainer.remove();
      });
      emojisGrid.appendChild(button);
    });
  };

  searchInput.addEventListener("input", (e) => {
    renderSearchResults(e.target.value);
  });

  Object.entries(EMOJI_CATEGORIES).forEach(([key, category]) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "emoji-picker-tab";
    tab.textContent = category.icon;
    tab.title = category.name;
    tab.addEventListener("click", () => {
      document.querySelectorAll(".emoji-picker-tab").forEach((t) => {
        t.classList.remove("active");
      });
      tab.classList.add("active");
      searchInput.value = "";
      renderCategory(key);
    });
    tabsContainer.appendChild(tab);

    if (!currentCategory) {
      tab.click();
    }
  });

  contentContainer.appendChild(searchContainer);
  contentContainer.appendChild(tabsContainer);
  contentContainer.appendChild(emojisGrid);
  pickerContainer.appendChild(contentContainer);

  return pickerContainer;
}

export function showEmojiPickerPopup(onEmojiSelect, position = {}) {
  const picker = createEmojiPicker(onEmojiSelect);
  picker.className = "emoji-picker emoji-picker-popup";

  if (position.x !== undefined && position.y !== undefined) {
    picker.style.position = "fixed";
    picker.style.left = `${position.x}px`;
    picker.style.top = `${position.y}px`;
  }

  document.body.appendChild(picker);

  const closeOnClickOutside = (e) => {
    if (!picker.contains(e.target)) {
      picker.remove();
      document.removeEventListener("click", closeOnClickOutside);
    }
  };

  setTimeout(() => {
    document.addEventListener("click", closeOnClickOutside);
  }, 10);

  return picker;
}
