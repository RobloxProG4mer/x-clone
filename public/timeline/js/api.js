import { authToken } from "./auth.js";

// this is mostly a foundation to build upon
// for easier further optimizations

export default (url, options = {}) =>
  new Promise((resolve) => {
    resolve(
      fetch(`/api${url}`, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${authToken}`,
        },
      }).then((r) => r.json())
    );
  });
