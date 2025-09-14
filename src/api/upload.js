import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import db from "../db.js";
import ratelimit from "../helpers/ratelimit.js";

const JWT_SECRET = process.env.JWT_SECRET;

const getUserByUsername = db.query("SELECT * FROM users WHERE username = ?");

// Ensure uploads directory exists
const uploadsDir = join(process.cwd(), "public", "uploads");
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

// Allowed file types
const ALLOWED_TYPES = {
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default new Elysia({ prefix: "/upload" })
  .use(jwt({ name: "jwt", secret: JWT_SECRET }))
  .use(
    rateLimit({
      duration: 60_000,
      max: 20,
      scoping: "scoped",
      generator: ratelimit,
    }),
  )
  .post("/", async ({ jwt, headers, body }) => {
    const authorization = headers.authorization;
    if (!authorization) return { error: "Authentication required" };

    try {
      const payload = await jwt.verify(authorization.replace("Bearer ", ""));
      if (!payload) return { error: "Invalid token" };

      const user = getUserByUsername.get(payload.username);
      if (!user) return { error: "User not found" };

      if (!body.file) {
        return { error: "No file provided" };
      }

      const file = body.file;

      // Validate file type
      if (!ALLOWED_TYPES[file.type]) {
        return { error: "Unsupported file type. Allowed: PNG, WEBP, AVIF, JPEG, JPG, GIF, MP4" };
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return { error: "File too large. Maximum size is 10MB" };
      }

      // Calculate SHA256 hash
      const arrayBuffer = await file.arrayBuffer();
      const hasher = new Bun.CryptoHasher("sha256");
      hasher.update(arrayBuffer);
      const fileHash = hasher.digest("hex");

      // Save file with hash as filename
      const fileExtension = ALLOWED_TYPES[file.type];
      const fileName = fileHash + fileExtension;
      const filePath = join(uploadsDir, fileName);
      const fileUrl = `/public/uploads/${fileName}`;

      // Write file to disk
      await Bun.write(filePath, arrayBuffer);

      // Return file data for client to include in tweet creation
      return {
        success: true,
        file: {
          hash: fileHash,
          name: file.name,
          type: file.type,
          size: file.size,
          url: fileUrl
        }
      };

    } catch (error) {
      console.error("Upload error:", error);
      return { error: "Failed to upload file" };
    }
  });