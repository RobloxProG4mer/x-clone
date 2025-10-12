import AccountSwitcher from "./accountSwitcher.js";

// this is mostly a foundation to build upon
// for easier further optimizations

function hash(str) {
  let h = 2166136261n;
  for (let i = 0; i < str.length; i++) {
    h ^= BigInt(str.charCodeAt(i));
    h *= 16777619n;
  }
  const hex = h.toString(16);

  if (hex.length > 32) return hex.slice(0, 32);
  return hex.padStart(32, "0");
}

export default (url, options = {}) =>
  new Promise((resolve) => {
    resolve(
      fetch(`/api${url}`, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${AccountSwitcher.getActiveToken() || ""}`,
          "X-Request-Token": hash(AccountSwitcher.getActiveToken() || "public"),
        },
      }).then((r) => r.json())
    );
  });
