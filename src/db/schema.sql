-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at INTEGER NOT NULL
);

-- Devices (machines)
CREATE TABLE IF NOT EXISTS devices (
    mac TEXT PRIMARY KEY,
    device_id TEXT UNIQUE,
    owner_id INTEGER,
    status TEXT DEFAULT 'pending',
    temple_name TEXT,
    address TEXT,
    contact_phone TEXT,
    firmware_version TEXT,
    last_heartbeat INTEGER,
    first_seen INTEGER,
    disable_reason TEXT,
    disabled_at INTEGER,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Setup codes
CREATE TABLE IF NOT EXISTS setup_codes (
    code TEXT PRIMARY KEY,
    used INTEGER DEFAULT 0,
    assigned_mac TEXT,
    generated_at INTEGER,
    used_at INTEGER
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    device_id TEXT,
    user_id TEXT,
    product_id INTEGER,
    amount INTEGER,
    status TEXT DEFAULT 'pending',
    omise_charge_id TEXT,
    qr_code_url TEXT,
    created_at INTEGER,
    paid_at INTEGER,
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

-- Device commands queue
CREATE TABLE IF NOT EXISTS device_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    command TEXT,
    data TEXT,
    created_at INTEGER,
    executed INTEGER DEFAULT 0,
    executed_at INTEGER
);

-- Admin action log
CREATE TABLE IF NOT EXISTS admin_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    action TEXT,
    target TEXT,
    details TEXT,
    ip_address TEXT,
    created_at INTEGER
);

-- Ownership transfer history
CREATE TABLE IF NOT EXISTS ownership_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_mac TEXT,
    from_user_id INTEGER,
    to_user_id INTEGER,
    reason TEXT,
    changed_by INTEGER,
    changed_at INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_orders_device ON orders(device_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_commands_device ON device_commands(device_id, executed);
