-- ============================================
-- SATU VENDING MACHINE - COMPLETE DATABASE SCHEMA
-- Cloudflare D1 (SQLite)
-- ============================================

-- ============================================
-- 1. USERS TABLE (Temple owners and admins)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',  -- 'user' or 'admin'
    created_at INTEGER NOT NULL  -- Unix timestamp
);

-- ============================================
-- 2. DEVICES TABLE (Machines)
-- ============================================
CREATE TABLE IF NOT EXISTS devices (
    mac TEXT PRIMARY KEY,  -- WiFi MAC address as unique ID
    device_id TEXT UNIQUE,  -- Format: SATU-XXXXXX
    owner_id INTEGER,
    status TEXT DEFAULT 'pending',  -- 'pending', 'active', 'disabled', 'stolen'
    temple_name TEXT,
    address TEXT,
    contact_phone TEXT,
    firmware_version TEXT,
    last_heartbeat INTEGER,  -- Unix timestamp
    first_seen INTEGER,  -- Unix timestamp
    free_heap INTEGER,  -- Available memory in bytes
    uptime INTEGER,  -- Seconds since last reboot
    wifi_rssi INTEGER,  -- Signal strength (negative number, closer to 0 = better)
    disable_reason TEXT,
    disabled_at INTEGER,
    ownership_locked INTEGER DEFAULT 1,  -- 1 = locked, 0 = transferable
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- ============================================
-- 3. SETUP CODES (One-time use, factory-generated)
-- ============================================
CREATE TABLE IF NOT EXISTS setup_codes (
    code TEXT PRIMARY KEY,  -- 6-digit number
    used INTEGER DEFAULT 0,  -- 0 = available, 1 = used
    assigned_mac TEXT,  -- MAC address of device waiting for claim
    generated_at INTEGER,  -- Unix timestamp
    used_at INTEGER  -- Unix timestamp
);

-- ============================================
-- 4. ORDERS (Purchase transactions)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,  -- Format: SATU-YYYYMMDD-XXXX
    device_id TEXT,
    product_id INTEGER,  -- 1-5 (product selection)
    amount INTEGER,  -- In satang (1000 = 10 THB)
    status TEXT DEFAULT 'pending',  -- 'pending', 'paid', 'expired', 'failed'
    omise_charge_id TEXT,
    qr_code_url TEXT,
    created_at INTEGER,  -- Unix timestamp
    paid_at INTEGER,  -- Unix timestamp
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

-- ============================================
-- 5. DONOR CONSENT (PDPA Compliant - For certificate with name)
-- ============================================
CREATE TABLE IF NOT EXISTS donor_consent (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE,
    encrypted_national_id TEXT,  -- Encrypted, not plain text (PDPA compliance)
    consent_signature TEXT,  -- Digital signature of consent
    consent_date INTEGER,  -- Unix timestamp
    purpose TEXT,  -- 'certificate', 'research', 'tax'
    data_retention_days INTEGER DEFAULT 90,  -- Auto-delete after 90 days
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- ============================================
-- 6. DATA ACCESS LOG (Court order audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS data_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT,
    court_order_number TEXT,
    accessed_by TEXT,  -- Admin email or ID
    accessed_at INTEGER,  -- Unix timestamp
    data_released TEXT,  -- JSON of what was released
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- ============================================
-- 7. DEVICE COMMANDS QUEUE (Polling model)
-- ============================================
CREATE TABLE IF NOT EXISTS device_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    command TEXT,  -- 'disable', 'enable', 'reboot', 'update', 'register', 'payment_confirmed', 'factory_reset'
    data TEXT,  -- JSON payload as string
    created_at INTEGER,  -- Unix timestamp
    executed INTEGER DEFAULT 0,  -- 0 = pending, 1 = executed
    executed_at INTEGER,  -- Unix timestamp
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

-- ============================================
-- 8. ADMIN ACTION LOG (Audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS admin_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    action TEXT,  -- 'disable', 'enable', 'reassign', 'firmware_update'
    target TEXT,  -- device_id or user_id
    details TEXT,  -- JSON payload
    ip_address TEXT,
    created_at INTEGER,  -- Unix timestamp
    FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- ============================================
-- 9. OWNERSHIP TRANSFER HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS ownership_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_mac TEXT,
    from_user_id INTEGER,
    to_user_id INTEGER,
    reason TEXT,
    changed_by INTEGER,  -- Admin ID who performed transfer
    changed_at INTEGER,  -- Unix timestamp
    FOREIGN KEY (device_mac) REFERENCES devices(mac),
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id)
);

-- ============================================
-- 10. CONNECTION LOGS (Health monitoring)
-- ============================================
CREATE TABLE IF NOT EXISTS connection_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    event_type TEXT,  -- 'heartbeat', 'command_fetched', 'command_executed', 'boot'
    details TEXT,  -- JSON with extra data (free_heap, uptime, wifi_rssi, etc.)
    created_at INTEGER,  -- Unix timestamp
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

-- ============================================
-- 11. FIRMWARE VERSIONS (For OTA updates)
-- ============================================
CREATE TABLE IF NOT EXISTS firmware_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT UNIQUE,  -- 'v1.0.0', 'v1.1.0'
    download_url TEXT,  -- R2 bucket URL
    release_notes TEXT,
    mandatory INTEGER DEFAULT 0,  -- 0 = optional, 1 = force update
    file_size INTEGER,  -- Bytes
    checksum TEXT,  -- SHA256 for verification
    created_at INTEGER,  -- Unix timestamp
    released_at INTEGER  -- When rollout started
);

-- ============================================
-- 12. TEST MODE PAYMENTS (Remove when Omise is live)
-- ============================================
CREATE TABLE IF NOT EXISTS test_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE,
    amount INTEGER,
    status TEXT DEFAULT 'pending',  -- 'pending', 'paid', 'expired'
    qr_code_url TEXT,
    created_at INTEGER,
    paid_at INTEGER,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_orders_device ON orders(device_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_commands_device ON device_commands(device_id, executed);
CREATE INDEX IF NOT EXISTS idx_commands_created ON device_commands(created_at);
CREATE INDEX IF NOT EXISTS idx_setup_codes_used ON setup_codes(used, generated_at);
CREATE INDEX IF NOT EXISTS idx_consent_order ON donor_consent(order_id);
CREATE INDEX IF NOT EXISTS idx_connection_logs_device ON connection_logs(device_id, created_at);
CREATE INDEX IF NOT EXISTS idx_connection_logs_time ON connection_logs(created_at);

-- ============================================
-- INITIAL DATA (Optional - for testing)
-- ============================================
-- Insert default admin (change password after first login)
-- Password is 'admin123' - CHANGE THIS IN PRODUCTION
INSERT OR IGNORE INTO users (email, name, password_hash, role, created_at)
VALUES ('admin@satu.com', 'System Administrator', '$2a$10$YourHashHere', 'admin', strftime('%s', 'now'));

-- Insert test machine (for development)
INSERT OR IGNORE INTO devices (mac, device_id, status, firmware_version, first_seen, ownership_locked)
VALUES ('TEST:00:00:00:00:01', 'SATU-TEST001', 'active', 'v1.0.0', strftime('%s', 'now'), 1);
