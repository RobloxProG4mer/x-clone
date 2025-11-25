import { Database } from "bun:sqlite";

const db = new Database("./.data/db.sqlite");

console.log("Running migration...");

try {
    // Add ip_address column to users table
    try {
        db.query("ALTER TABLE users ADD COLUMN ip_address TEXT DEFAULT NULL").run();
        console.log("Added ip_address column to users table.");
    } catch (e) {
        if (e.message.includes("duplicate column name")) {
            console.log("ip_address column already exists in users table.");
        } else {
            console.error("Error adding ip_address column:", e);
        }
    }

    // Create ip_bans table
    db.query(`
        CREATE TABLE IF NOT EXISTS ip_bans (
            ip_address TEXT PRIMARY KEY,
            banned_by TEXT NOT NULL,
            reason TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT (datetime('now', 'utc')),
            FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `).run();
    console.log("Created ip_bans table.");

    // Create user_ips table for history
    db.query(`
        CREATE TABLE IF NOT EXISTS user_ips (
            user_id TEXT NOT NULL,
            ip_address TEXT NOT NULL,
            use_count INTEGER DEFAULT 1,
            last_used_at TIMESTAMP DEFAULT (datetime('now', 'utc')),
            PRIMARY KEY (user_id, ip_address),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `).run();
    console.log("Created user_ips table.");

    // Create indexes for user_ips
    db.query("CREATE INDEX IF NOT EXISTS idx_user_ips_user_id ON user_ips(user_id)").run();
    db.query("CREATE INDEX IF NOT EXISTS idx_user_ips_ip_address ON user_ips(ip_address)").run();
    console.log("Created indexes for user_ips.");

    // Create index for users(ip_address)
    db.query("CREATE INDEX IF NOT EXISTS idx_users_ip_address ON users(ip_address)").run();
    console.log("Created index for users(ip_address).");

} catch (error) {
    console.error("Migration failed:", error);
}

console.log("Migration complete.");
