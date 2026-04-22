-- ============================================================================
-- SATU VENDING MACHINE — COMPLETE DATABASE SCHEMA
-- Database: Cloudflare D1 (SQLite)
-- Last verified: 2026-04-22 (matched against live D1 output)
-- Maintained by: Update this file every time schema changes are made to D1
--
-- HOW TO USE THIS FILE:
--   Full reconstruction (new DB):
--     1. Cloudflare Dashboard → D1 → satu_db → Console
--     2. Paste and run this entire file
--     3. All 14 tables + indexes + seed data will be created
--
--   After any schema change to D1:
--     1. Run the 4 verification queries at the bottom of this file
--     2. Update this file to match
--     3. Commit to repo — this is the source of truth
--
-- CURRENT TABLE COUNT: 14 (excluding _cf_KV which is Cloudflare internal)
--   1.  users
--   2.  devices
--   3.  setup_codes
--   4.  orders
--   5.  donor_consent
--   6.  data_access_log
--   7.  device_commands
--   8.  admin_log
--   9.  ownership_log
--   10. connection_logs
--   11. firmware_versions
--   12. test_payments
--   13. rate_limit_counters   ← added 2026-04-22 (fixes broken in-memory limiter)
--   14. cron_log              ← added 2026-04-22 (audit trail for scheduled jobs)
--
-- KNOWN QUIRKS:
--   - idx_commands_device and idx_device_commands_pending are identical
--     (both cover device_commands(device_id, executed)) — duplicate kept
--     intentionally to avoid accidental breakage from dropping either
--   - _cf_KV is a Cloudflare-internal table, never touch it
--   - test_payments table stays until Omise goes fully live (Phase 1 complete)
-- ============================================================================


-- ============================================================================
-- 1. USERS
--    Temple owners and system admins.
--    password_hash: bcrypt. Never store plain text.
--    role: 'user' (temple owner) or 'admin' (Satu staff)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    UNIQUE NOT NULL,
    name          TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    DEFAULT 'user',   -- 'user' | 'admin'
    created_at    INTEGER NOT NULL           -- Unix timestamp
);


-- ============================================================================
-- 2. DEVICES
--    One row per physical Satu machine.
--    mac: WiFi MAC address — permanent unique ID burned into hardware
--    device_id: human-readable format SATU-XXXXXX, generated on first claim
--    device_secret: set during registration, required in X-Device-Secret
--                   header for all machine API calls in LIVE mode
--    ownership_locked: 1 = cannot be transferred without admin action
-- ============================================================================
CREATE TABLE IF NOT EXISTS devices (
    mac               TEXT    PRIMARY KEY,  -- WiFi MAC, e.g. 94:B5:5D:A1:B2:C3
    device_id         TEXT    UNIQUE,       -- SATU-XXXXXX (null until claimed)
    owner_id          INTEGER,
    status            TEXT    DEFAULT 'pending',  -- 'pending'|'active'|'disabled'|'stolen'
    temple_name       TEXT,
    address           TEXT,
    contact_phone     TEXT,
    firmware_version  TEXT,
    last_heartbeat    INTEGER,              -- Unix timestamp
    first_seen        INTEGER,              -- Unix timestamp
    free_heap         INTEGER,              -- ESP32 free RAM in bytes
    uptime            INTEGER,              -- Seconds since last reboot
    wifi_rssi         INTEGER,              -- Signal strength (negative, closer to 0 = better)
    disable_reason    TEXT,
    disabled_at       INTEGER,              -- Unix timestamp
    ownership_locked  INTEGER DEFAULT 1,   -- 1 = locked, 0 = transferable
    device_secret     TEXT,                 -- Auth secret for X-Device-Secret header (LIVE mode)
    FOREIGN KEY (owner_id) REFERENCES users(id)
);


-- ============================================================================
-- 3. SETUP CODES
--    6-digit one-time codes. Generated when machine first calls /v1/machine/hello.
--    Temple owner enters this code in the dashboard to claim the machine.
--    Codes expire after 1 hour (enforced in machine.js, not by DB constraint).
-- ============================================================================
CREATE TABLE IF NOT EXISTS setup_codes (
    code          TEXT    PRIMARY KEY,  -- 6-digit string e.g. '371492'
    used          INTEGER DEFAULT 0,   -- 0 = available, 1 = used
    assigned_mac  TEXT,                -- MAC of the device waiting to be claimed
    generated_at  INTEGER,             -- Unix timestamp
    used_at       INTEGER              -- Unix timestamp (null until claimed)
);


-- ============================================================================
-- 4. ORDERS
--    One row per donor transaction.
--    amount: stored in satang (Thai cents). 1000 = 10 THB.
--    donor_name: optional, only if donor consents (PDPA). See donor_consent table.
--    failure_code / failure_message: populated if Omise payment fails.
--    omise_charge_id: null in fake/test mode, populated in live mode.
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
    order_id         TEXT PRIMARY KEY,   -- Format: SATU-YYYYMMDD-XXXX
    device_id        TEXT,
    product_id       INTEGER,            -- 1–5 (maps to product catalog)
    amount           INTEGER,            -- In satang (1000 = 10 THB)
    status           TEXT DEFAULT 'pending',  -- 'pending'|'paid'|'expired'|'failed'
    omise_charge_id  TEXT,               -- Omise charge ID (null in fake mode)
    qr_code_url      TEXT,               -- PromptPay QR code URL shown on screen
    created_at       INTEGER,            -- Unix timestamp
    paid_at          INTEGER,            -- Unix timestamp (null until paid)
    donor_name       TEXT,               -- Optional, PDPA consent required
    failure_code     TEXT,               -- Omise failure code if status='failed'
    failure_message  TEXT,               -- Human-readable failure reason
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);


-- ============================================================================
-- 5. DONOR CONSENT (PDPA)
--    Required by Thai PDPA law before collecting any personal data.
--    National ID is encrypted — never stored in plain text.
--    Data auto-deleted after data_retention_days (enforced by cron job).
--    A court order is required to access this data — see data_access_log.
-- ============================================================================
CREATE TABLE IF NOT EXISTS donor_consent (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id             TEXT    UNIQUE,
    encrypted_national_id TEXT,          -- AES encrypted, not plain text
    consent_signature    TEXT,           -- Digital signature of consent event
    consent_date         INTEGER,        -- Unix timestamp
    purpose              TEXT,           -- 'certificate' | 'research' | 'tax'
    data_retention_days  INTEGER DEFAULT 90,  -- Auto-delete after N days
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);


-- ============================================================================
-- 6. DATA ACCESS LOG
--    Immutable audit trail. Every time donor personal data is accessed,
--    a row is written here. Court order number required for legal compliance.
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_access_log (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id            TEXT,
    court_order_number  TEXT,
    accessed_by         TEXT,    -- Admin email or user ID
    accessed_at         INTEGER, -- Unix timestamp
    data_released       TEXT,    -- JSON describing what data was released
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);


-- ============================================================================
-- 7. DEVICE COMMANDS QUEUE
--    Polling model: machines call GET /v1/machine/commands every 30 seconds.
--    Backend inserts rows here; machine picks them up and marks executed=1.
--    Valid commands: 'disable', 'enable', 'reboot', 'update', 'register',
--                   'payment_confirmed', 'factory_reset'
-- ============================================================================
CREATE TABLE IF NOT EXISTS device_commands (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   TEXT,
    command     TEXT,            -- See valid commands above
    data        TEXT,            -- JSON payload (command-specific)
    created_at  INTEGER,         -- Unix timestamp
    executed    INTEGER DEFAULT 0,  -- 0 = pending, 1 = executed
    executed_at INTEGER,         -- Unix timestamp (null until executed)
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);


-- ============================================================================
-- 8. ADMIN ACTION LOG
--    Every admin action is logged here. Who did what, to which device, when.
--    Required for accountability — this system handles real money at temples.
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id   INTEGER,
    action     TEXT,    -- 'disable' | 'enable' | 'reassign' | 'firmware_update'
    target     TEXT,    -- device_id or user_id that was acted on
    details    TEXT,    -- JSON payload of the action
    ip_address TEXT,
    created_at INTEGER, -- Unix timestamp
    FOREIGN KEY (admin_id) REFERENCES users(id)
);


-- ============================================================================
-- 9. OWNERSHIP LOG
--    Every time a device changes hands, a row is written here.
--    Provides full chain of custody for every machine.
-- ============================================================================
CREATE TABLE IF NOT EXISTS ownership_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    device_mac   TEXT,
    from_user_id INTEGER,
    to_user_id   INTEGER,
    reason       TEXT,
    changed_by   INTEGER,  -- Admin ID who performed the transfer
    changed_at   INTEGER,  -- Unix timestamp
    FOREIGN KEY (device_mac)   REFERENCES devices(mac),
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id)   REFERENCES users(id)
);


-- ============================================================================
-- 10. CONNECTION LOGS
--     Health monitoring. Every heartbeat, boot, and command event is logged.
--     Used to detect offline machines and diagnose hardware issues.
--     High volume table — prune regularly if storage becomes a concern.
-- ============================================================================
CREATE TABLE IF NOT EXISTS connection_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   TEXT,
    event_type  TEXT,    -- 'heartbeat' | 'command_fetched' | 'command_executed' | 'boot'
    details     TEXT,    -- JSON: free_heap, uptime, wifi_rssi, etc.
    created_at  INTEGER, -- Unix timestamp
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);


-- ============================================================================
-- 11. FIRMWARE VERSIONS
--     Registry of all firmware releases. When a new version is published,
--     insert a row here. Machines check this via the 'update' command.
--     download_url: points to Cloudflare R2 bucket (signed URL).
--     checksum: SHA256 of the .bin file for integrity verification on device.
-- ============================================================================
CREATE TABLE IF NOT EXISTS firmware_versions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    version       TEXT    UNIQUE,   -- Semver: 'v1.0.0', 'v1.1.0'
    download_url  TEXT,             -- R2 signed URL
    release_notes TEXT,
    mandatory     INTEGER DEFAULT 0,  -- 0 = optional, 1 = force update
    file_size     INTEGER,           -- Bytes
    checksum      TEXT,              -- SHA256 for on-device verification
    created_at    INTEGER,           -- Unix timestamp
    released_at   INTEGER            -- Unix timestamp (when rollout started)
);


-- ============================================================================
-- 12. TEST PAYMENTS
--     Used in PAYMENT_MODE=fake only. Mirrors the orders table for fake QR
--     payment simulation without hitting the real Omise API.
--     TODO: Delete this table when Omise goes fully live (Phase 1 complete).
-- ============================================================================
CREATE TABLE IF NOT EXISTS test_payments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     TEXT    UNIQUE,
    amount       INTEGER,
    status       TEXT    DEFAULT 'pending',  -- 'pending' | 'paid' | 'expired'
    qr_code_url  TEXT,
    created_at   INTEGER,
    paid_at      INTEGER,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);


-- ============================================================================
-- 13. RATE LIMIT COUNTERS
--     Added: 2026-04-22. Replaces broken in-memory Map in rateLimit.js.
--     One row per (ip, window_key). window_key = floor(unix_seconds / 60).
--     Stale rows (>5 min old) are pruned by the cron job every 30 minutes.
--     See: src/middleware/rateLimit.js
-- ============================================================================
CREATE TABLE IF NOT EXISTS rate_limit_counters (
    ip         TEXT    NOT NULL,
    window_key INTEGER NOT NULL,  -- floor(unix_seconds / 60)
    count      INTEGER DEFAULT 0,
    PRIMARY KEY (ip, window_key)
);


-- ============================================================================
-- 14. CRON LOG
--     Added: 2026-04-22. Audit trail for all scheduled job runs.
--     Jobs: 'expire_orders', 'cleanup_rate_limits'
--     Fires every 30 minutes via Cloudflare Cron Trigger.
--     See: wrangler.toml [triggers] and index.js scheduled() handler.
-- ============================================================================
CREATE TABLE IF NOT EXISTS cron_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    job_name      TEXT    NOT NULL,
    started_at    INTEGER NOT NULL,  -- Unix timestamp
    finished_at   INTEGER,           -- Unix timestamp (null while running)
    status        TEXT    DEFAULT 'running',  -- 'running' | 'ok' | 'error'
    rows_affected INTEGER DEFAULT 0,
    error_msg     TEXT,              -- Null on success
    details       TEXT               -- JSON for extra context
);


-- ============================================================================
-- INDEXES
-- ============================================================================

-- devices
CREATE INDEX IF NOT EXISTS idx_devices_owner     ON devices(owner_id);
CREATE INDEX IF NOT EXISTS idx_devices_status    ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);

-- orders
CREATE INDEX IF NOT EXISTS idx_orders_device  ON orders(device_id);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_charge  ON orders(omise_charge_id);

-- device_commands
-- NOTE: idx_commands_device and idx_device_commands_pending are identical
-- (both cover device_id, executed). Duplicate exists in live DB — kept as-is.
CREATE INDEX IF NOT EXISTS idx_commands_device          ON device_commands(device_id, executed);
CREATE INDEX IF NOT EXISTS idx_device_commands_pending  ON device_commands(device_id, executed);
CREATE INDEX IF NOT EXISTS idx_commands_created         ON device_commands(created_at);

-- setup_codes
CREATE INDEX IF NOT EXISTS idx_setup_codes_used ON setup_codes(used, generated_at);

-- donor_consent
CREATE INDEX IF NOT EXISTS idx_consent_order ON donor_consent(order_id);

-- connection_logs
CREATE INDEX IF NOT EXISTS idx_connection_logs_device ON connection_logs(device_id, created_at);
CREATE INDEX IF NOT EXISTS idx_connection_logs_time   ON connection_logs(created_at);

-- rate_limit_counters
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_counters(window_key);

-- cron_log
-- NOTE: These indexes were not created in the initial migration (D1 console
-- truncated the SQL). Run these manually if not present:
--   SELECT name FROM sqlite_master WHERE name LIKE 'idx_cron%';
CREATE INDEX IF NOT EXISTS idx_cron_log_job  ON cron_log(job_name, started_at);
CREATE INDEX IF NOT EXISTS idx_cron_log_time ON cron_log(started_at);


-- ============================================================================
-- SEED DATA
--    Only clean, permanent seed rows. Test garbage (TEST:MAC:* devices) is
--    NOT included — those are dev artifacts and should be cleaned from live DB.
-- ============================================================================

-- Default admin user
-- IMPORTANT: password_hash '$2a$10$YourHashHere' is a placeholder.
--            Generate a real bcrypt hash before any real login is possible.
--            Use: https://bcrypt-generator.com or `npx bcryptjs 'yourpassword'`
INSERT OR IGNORE INTO users (email, name, password_hash, role, created_at)
VALUES ('admin@satu.com', 'System Administrator', '$2a$10$YourHashHere', 'admin', 1776603721);

-- Permanent test machine (used by system tester — do not delete)
INSERT OR IGNORE INTO devices (mac, device_id, status, firmware_version, first_seen, ownership_locked)
VALUES ('TEST:00:00:00:00:01', 'SATU-TEST001', 'active', 'v1.0.0', strftime('%s', 'now'), 1);


-- ============================================================================
-- VERIFICATION QUERIES
-- Run these after reconstruction to confirm everything is correct.
-- All 4 should return the expected results shown in comments.
-- ============================================================================

-- 1. Count tables (expect 14, plus _cf_KV = 15 total)
-- SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';

-- 2. List all tables
-- SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;

-- 3. Count indexes (expect 17)
-- SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';

-- 4. Confirm seed data
-- SELECT id, email, role FROM users;
-- SELECT mac, device_id, status FROM devices WHERE mac = 'TEST:00:00:00:00:01';
