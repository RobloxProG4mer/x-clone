import { Database } from "bun:sqlite";

const db = new Database("./.data/db.sqlite");

// TODO: indexes for performance

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username VARCHAR,
  created_at TIMESTAMP DEFAULT (datetime('now')),
  name TEXT DEFAULT NULL, 
  avatar TEXT DEFAULT NULL, 
  verified BOOLEAN DEFAULT FALSE,
  bio TEXT DEFAULT NULL,
  location TEXT DEFAULT NULL,
  website TEXT DEFAULT NULL,
  post_count INTEGER DEFAULT 0,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS passkeys (
  cred_id TEXT PRIMARY KEY,
  cred_public_key BLOB,
  internal_user_id TEXT,
  webauthn_user_id TEXT UNIQUE,
  counter INTEGER,
  backup_eligible BOOLEAN,
  backup_status BOOLEAN,
  transports TEXT,
  created_at TIMESTAMP DEFAULT (datetime('now')),
  last_used TIMESTAMP, name TEXT DEFAULT NULL,
  FOREIGN KEY (internal_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS follows (
  id TEXT PRIMARY KEY,
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT (datetime('now')),
  FOREIGN KEY (follower_id) REFERENCES users(id),
  FOREIGN KEY (following_id) REFERENCES users(id),
  UNIQUE(follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  reply_to TEXT,
  poll_id TEXT,
  created_at TIMESTAMP DEFAULT (datetime('now')),
  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  retweet_count INTEGER DEFAULT 0,
  source TEXT DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (poll_id) REFERENCES polls(id)
);

CREATE TABLE IF NOT EXISTS likes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS retweets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT (datetime('now')),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  UNIQUE(post_id)
);

CREATE TABLE IF NOT EXISTS poll_options (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  option_text TEXT NOT NULL,
  vote_count INTEGER DEFAULT 0,
  option_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT (datetime('now')),
  FOREIGN KEY (poll_id) REFERENCES polls(id)
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  poll_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (poll_id) REFERENCES polls(id),
  FOREIGN KEY (option_id) REFERENCES poll_options(id),
  UNIQUE(user_id, poll_id)
);`);

export default db;
