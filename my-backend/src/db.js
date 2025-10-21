// my-backend/src/js/db.js
// Simple SQLite setup
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "app.sqlite");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Customers table
  db.run(
    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      address TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  // Invoices table
  db.run(
    `CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer TEXT,
      amount REAL,
      status TEXT,
      items TEXT,
      issue_date DATETIME,
      due_date DATETIME
    )`
  );

  // Clients table
  db.run(
    `CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      vendor_choice TEXT NOT NULL, -- kubus | fma | lainnya | none
      vendor_other TEXT,           -- filled when vendor_choice == 'lainnya'
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_approved INTEGER NOT NULL DEFAULT 0,
      approved_at DATETIME,
      approved_by INTEGER
    )`
  );

  // Vendors master (untuk whitelist)
  db.run(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      is_whitelisted INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by_admin_id INTEGER
    )
  `);

  // Index opsional (cepat saat lookup)
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name)`);

  // Seed awal vendor whitelist (aman dipanggil berulang karena OR IGNORE)
  db.run(`
    INSERT OR IGNORE INTO vendors (name, is_whitelisted) VALUES
      ('kubus', 1),
      ('fma', 1)
  `);

  // Client orders table (+ spesifikasi produk, pembayaran, dan pricing)
  db.run(
    `CREATE TABLE IF NOT EXISTS client_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,

      -- spesifikasi produk
      product_type TEXT,                 -- spanduk | stiker | x-banner | ...
      material TEXT,                     -- contoh: Flexi Korea 340gsm
      width_cm REAL,                     -- lebar (cm)
      height_cm REAL,                    -- tinggi (cm)
      quantity INTEGER,                  -- jumlah (pcs)

      -- pricing yg dihitung server saat submit
      unit_price REAL,                   -- harga satuan (per cm2 / per item)
      pricing_basis TEXT,                -- 'cm2' | 'item'
      amount_subtotal REAL,              -- sebelum pajak
      tax_ppn REAL,                      -- pajak PPN 11%
      amount_total REAL,                 -- subtotal + pajak (dibulatkan)

      -- pembayaran
      status TEXT DEFAULT 'pending',
      vendor_whitelisted INTEGER NOT NULL DEFAULT 0,  -- 0/1
      payment_required INTEGER NOT NULL DEFAULT 0,    -- 0/1
      payment_deadline DATETIME,                      -- batas bayar
      payment_url TEXT,                               -- link pembayaran
      paid_at DATETIME,                               -- waktu lunas

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )`
  );

  // Admin accounts (role-based)
  db.run(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,             -- 'invoice' | 'verifier'
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

  // ---- BACKFILL untuk DB lama: tambah kolom jika belum ada
  const addCol = (table, name, typeAndDefault = "") =>
    db.run(
      `ALTER TABLE ${table} ADD COLUMN ${name} ${typeAndDefault}`,
      () => {} // abaikan error "duplicate column name"
    );

  // kolom spesifikasi/pembayaran existing
  addCol("client_orders", "product_type", "TEXT");
  addCol("client_orders", "material", "TEXT");
  addCol("client_orders", "vendor_whitelisted", "INTEGER NOT NULL DEFAULT 0");
  addCol("client_orders", "payment_required", "INTEGER NOT NULL DEFAULT 0");
  addCol("client_orders", "payment_deadline", "DATETIME");
  addCol("client_orders", "payment_url", "TEXT");
  addCol("client_orders", "paid_at", "DATETIME");

  // kolom ukuran & pricing (baru)
  addCol("client_orders", "width_cm", "REAL");
  addCol("client_orders", "height_cm", "REAL");
  addCol("client_orders", "quantity", "INTEGER");
  addCol("client_orders", "unit_price", "REAL");
  addCol("client_orders", "pricing_basis", "TEXT");
  addCol("client_orders", "amount_subtotal", "REAL");
  addCol("client_orders", "tax_ppn", "REAL");
  addCol("client_orders", "amount_total", "REAL");

  addCol("client_orders", "approved_at", "DATETIME");
  addCol("client_orders", "approved_by", "INTEGER");

  addCol("clients", "is_approved", "INTEGER NOT NULL DEFAULT 0");
  addCol("clients", "approved_at", "DATETIME");
  addCol("clients", "approved_by", "INTEGER");

  db.run(
    `CREATE INDEX IF NOT EXISTS idx_client_orders_status2 ON client_orders(status)`
  );

  // Index untuk performa (opsional)
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_client_orders_status
     ON client_orders(status)`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_client_orders_deadline
     ON client_orders(payment_deadline)`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_client_orders_client
     ON client_orders(client_id)`
  );
});

module.exports = db;
