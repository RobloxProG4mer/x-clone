import { authToken } from "./auth.js";

let queue = [];
let scheduled = false;

function processQueue() {
  const batch = queue;
  queue = [];
  scheduled = false;

  for (const { url, options, resolve, reject } of batch) {
    const opts = {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${authToken}`,
      },
    };

    console.log(
      `${options.method || "GET"}`,
      url,
      JSON.stringify(options).length === 2 ? "" : options
    );

    fetch(`/api${url}`, opts)
      .then((r) => r.json())
      .then(resolve)
      .catch(reject);
  }
}

export default (url, options = {}) =>
  new Promise((resolve, reject) => {
    queue.push({ url, options, resolve, reject });

    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(processQueue);
    }
  });
