import { jwt } from "@elysiajs/jwt";
import { staticPlugin } from "@elysiajs/static";
import { Elysia, file } from "elysia";
import api from "./api.js";
import { compression } from "./compress.js";

const connectedUsers = new Map();

const sseConnections = new Map();

export function broadcastToUser(userId, message) {
  const userSockets = connectedUsers.get(userId);
  if (userSockets) {
    for (const socket of userSockets) {
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        console.error("Error sending WebSocket message:", error);
        userSockets.delete(socket);
      }
    }
  }

  const sseClients = sseConnections.get(userId);
  if (sseClients) {
    for (const client of sseClients) {
      try {
        client.controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
      } catch (error) {
        console.error("Error sending SSE message:", error);
        sseClients.delete(client);
      }
    }
  }
}

new Elysia()
  .use(compression)
  .use(staticPlugin())
  .use(jwt({ name: "jwt", secret: process.env.JWT_SECRET }))
  .get("/sse", async ({ jwt, query, set }) => {
    const { token } = query;

    if (!token) {
      set.status = 401;
      return { error: "Authentication required" };
    }

    const payload = await jwt.verify(token);
    if (!payload) {
      set.status = 401;
      return { error: "Invalid token" };
    }

    const userId = payload.userId;

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(`:ok\n\n`);

        if (!sseConnections.has(userId)) {
          sseConnections.set(userId, new Set());
        }
        const client = { controller };
        sseConnections.get(userId).add(client);

        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(`:ping\n\n`);
          } catch {
            clearInterval(keepAlive);
          }
        }, 30000);

        client.keepAlive = keepAlive;
      },
      cancel() {
        if (sseConnections.has(userId)) {
          const clients = sseConnections.get(userId);
          for (const client of clients) {
            if (client.keepAlive) clearInterval(client.keepAlive);
          }
          clients.clear();
          sseConnections.delete(userId);
        }
      },
    });

    set.headers = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };

    return new Response(stream, {
      headers: set.headers,
    });
  })
  .ws("/ws", {
    open: async (ws) => {
      const { token } = ws.data.query;

      if (!token) ws.close();

      const payload = await ws.data.jwt.verify(token);
      if (!payload) ws.close();

      ws.data.userId = payload.userId;
      ws.data.username = payload.username;
      if (!connectedUsers.has(payload.userId)) {
        connectedUsers.set(payload.userId, new Set());
      }
      connectedUsers.get(payload.userId).add(ws);
    },
    close: (ws) => {
      if (ws.data.userId && connectedUsers.has(ws.data.userId)) {
        connectedUsers.get(ws.data.userId).delete(ws);
        if (connectedUsers.get(ws.data.userId).size === 0) {
          connectedUsers.delete(ws.data.userId);
        }
      }
    },
  })
  .get("/account", () => file("./public/account/index.html"))
  .get("/admin", () => file("./public/admin/index.html"))
  .get("/profile/:username", () => file("./public/timeline/index.html"))
  .get("/settings", ({ redirect }) => redirect("/settings/account"))
  .get("/settings/:page", () => file("./public/account/index.html"))
  .get("/legal", () => file("./public/legal.html"))
  .get("*", ({ cookie, redirect }) => {
    return cookie.agree?.value === "yes"
      ? file("./public/timeline/index.html")
      : redirect("/account");
  })
  .use(api)
  .listen({ port: 3000, idleTimeout: 255 }, () => {
    console.log(
      "Happies tweetapus app is running on http://localhost:3000 ✅✅✅✅✅✅✅✅✅"
    );
  });
