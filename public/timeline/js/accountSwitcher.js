// Simple account switcher: stores accounts (name + jwt) in localStorage
// Provides functions to add/remove/switch accounts and renders a small modal UI

const STORAGE_KEY = "accounts";
const ACTIVE_KEY = "activeAccountId";

function loadAccounts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

function getActiveAccountId() {
  return localStorage.getItem(ACTIVE_KEY);
}

function setActiveAccountId(id) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

function getAccounts() {
  return loadAccounts();
}

function addAccount(name, token) {
  if (!token) return null;
  const accounts = loadAccounts();
  const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  accounts.push({ id, name: name || id, token });
  saveAccounts(accounts);
  setActive(id);
  renderUI();
  return id;
}

function removeAccount(id) {
  let accounts = loadAccounts();
  accounts = accounts.filter((a) => a.id !== id);
  saveAccounts(accounts);
  if (getActiveAccountId() === id) {
    if (accounts.length > 0) setActive(accounts[0].id);
    else setActive(null);
  }
  renderUI();
}

function setActive(id) {
  const accounts = loadAccounts();
  const acc = accounts.find((a) => a.id === id);
  if (acc) {
    setActiveAccountId(id);
    localStorage.setItem("authToken", acc.token);
  } else {
    setActiveAccountId(null);
    localStorage.removeItem("authToken");
  }
  renderUI();
}

function getActiveToken() {
  const id = getActiveAccountId();
  if (!id) return localStorage.getItem("authToken");
  const accounts = loadAccounts();
  const acc = accounts.find((a) => a.id === id);
  return acc ? acc.token : localStorage.getItem("authToken");
}

// Minimal UI: modal injected into body. Toggle with Ctrl+K+M or by calling openSwitcher()
let modalEl = null;

function createModal() {
  if (modalEl) return modalEl;

  const wrapper = document.createElement("div");
  wrapper.id = "account-switcher-modal";
  wrapper.style.position = "fixed";
  wrapper.style.left = "0";
  wrapper.style.top = "0";
  wrapper.style.width = "100%";
  wrapper.style.height = "100%";
  wrapper.style.display = "none";
  wrapper.style.alignItems = "center";
  wrapper.style.justifyContent = "center";
  wrapper.style.background = "rgba(0,0,0,0.35)";
  wrapper.style.zIndex = "9999";

  const box = document.createElement("div");
  box.style.width = "420px";
  box.style.maxWidth = "94%";
  box.style.background = "var(--bg, #fff)";
  box.style.borderRadius = "8px";
  box.style.padding = "14px";
  box.style.boxShadow = "0 6px 24px rgba(0,0,0,0.25)";
  box.style.color = "var(--text, #111)";

  const title = document.createElement("h3");
  title.textContent = "Account switcher";
  title.style.margin = "0 0 8px 0";
  box.appendChild(title);

  const list = document.createElement("div");
  list.id = "account-switcher-list";
  list.style.marginBottom = "12px";
  box.appendChild(list);

  const form = document.createElement("div");
  form.style.display = "grid";
  form.style.gridTemplateColumns = "1fr";
  form.style.gap = "8px";

  const nameInput = document.createElement("input");
  nameInput.placeholder = "Name (optional)";
  nameInput.style.padding = "8px";
  nameInput.style.border = "1px solid var(--border, #ddd)";
  nameInput.style.borderRadius = "6px";

  const tokenInput = document.createElement("textarea");
  tokenInput.placeholder = "Paste JWT here";
  tokenInput.rows = 3;
  tokenInput.style.padding = "8px";
  tokenInput.style.border = "1px solid var(--border, #ddd)";
  tokenInput.style.borderRadius = "6px";
  tokenInput.style.resize = "vertical";

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";

  const addBtn = document.createElement("button");
  addBtn.textContent = "Add account";
  addBtn.className = "profile-btn profile-btn-primary";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.className = "profile-btn";

  actions.appendChild(addBtn);
  actions.appendChild(closeBtn);

  form.appendChild(nameInput);
  form.appendChild(tokenInput);
  form.appendChild(actions);

  box.appendChild(form);
  wrapper.appendChild(box);

  closeBtn.addEventListener("click", () => {
    wrapper.style.display = "none";
  });

  addBtn.addEventListener("click", () => {
    const token = tokenInput.value.trim();
    const name = nameInput.value.trim();
    if (!token) return;
    addAccount(name || undefined, token);
    tokenInput.value = "";
    nameInput.value = "";
    wrapper.style.display = "none";
  });

  wrapper.addEventListener("click", (e) => {
    if (e.target === wrapper) wrapper.style.display = "none";
  });

  document.body.appendChild(wrapper);
  modalEl = wrapper;
  return modalEl;
}

function renderUI() {
  try {
    const modal = createModal();
    const list = modal.querySelector("#account-switcher-list");
    list.innerHTML = "";

    const accounts = loadAccounts();
    const activeId = getActiveAccountId();

    if (accounts.length === 0) {
      const p = document.createElement("p");
      p.style.margin = "6px 0 12px 0";
      p.style.color = "var(--text-secondary, #666)";
      p.textContent = "No accounts added yet. Paste a JWT to add one.";
      list.appendChild(p);
    }

    accounts.forEach((acc) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.gap = "8px";
      row.style.padding = "6px 0";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.gap = "8px";
      left.style.alignItems = "center";

      const name = document.createElement("div");
      name.textContent = acc.name || acc.id;
      name.style.fontWeight = acc.id === activeId ? "600" : "400";
      left.appendChild(name);

      row.appendChild(left);

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.gap = "6px";

      const switchBtn = document.createElement("button");
      switchBtn.textContent = acc.id === activeId ? "Active" : "Use";
      switchBtn.className = acc.id === activeId ? "profile-btn profile-btn-secondary" : "profile-btn";
      switchBtn.addEventListener("click", () => setActive(acc.id));

      const delBtn = document.createElement("button");
      delBtn.textContent = "Remove";
      delBtn.className = "profile-btn profile-btn-secondary";
      delBtn.addEventListener("click", () => removeAccount(acc.id));

      right.appendChild(switchBtn);
      right.appendChild(delBtn);
      row.appendChild(right);

      list.appendChild(row);
    });
  } catch {
    // ignore render errors
  }
}

function openSwitcher() {
  const modal = createModal();
  renderUI();
  modal.style.display = "flex";
}

// keyboard shortcut Ctrl+K+M to open
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === "m") {
    openSwitcher();
  }
});

// expose API
const AccountSwitcher = {
  getAccounts,
  addAccount,
  removeAccount,
  setActive,
  getActiveToken,
  openSwitcher,
  renderUI,
};

export default AccountSwitcher;
