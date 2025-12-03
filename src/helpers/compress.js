import { Elysia } from "elysia";

const skipPaths = /^\/(public|sw\.js|admin|legal)/;
const staticExtensions = /\.(js|css|html|json|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|eot|mp4|webm|mp3|wav)$/i;

export const compression = new Elysia({ name: "compressResponses" })
  .mapResponse(({ request, response, set }) => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (skipPaths.test(pathname) || staticExtensions.test(pathname)) {
      return response;
    }

    const isJson = typeof response === "object";
    const compressionRequested = request.headers
      .get("Accept-Encoding")
      ?.includes("gzip");

    const text = isJson ? JSON.stringify(response) : response?.toString() ?? "";

    if (!compressionRequested || text.length < 2048) {
      return response;
    }

    set.headers["Content-Encoding"] = "gzip";

    return new Response(Bun.gzipSync(new TextEncoder().encode(text)), {
      headers: {
        "Content-Type": `${
          isJson ? "application/json" : "text/plain"
        }; charset=utf-8`,
      },
    });
  })
  .as("plugin");
