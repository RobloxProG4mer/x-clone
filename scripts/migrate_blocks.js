import { Database } from "bun:sqlite";

const db = new Database("./.data/db.sqlite");

try {
  console.log("Checking if source_tweet_id column exists in blocks table...");
  const tableInfo = db.query("PRAGMA table_info(blocks)").all();
  const hasColumn = tableInfo.some(col => col.name === "source_tweet_id");

  if (!hasColumn) {
    console.log("Adding source_tweet_id column to blocks table...");
    db.query("ALTER TABLE blocks ADD COLUMN source_tweet_id TEXT DEFAULT NULL").run();
    console.log("Column added successfully.");
  } else {
    console.log("Column already exists.");
  }
} catch (error) {
  console.error("Error migrating database:", error);
}
