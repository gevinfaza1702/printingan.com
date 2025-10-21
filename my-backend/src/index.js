// my-backend/src/index.js
const express = require("express");
const cors = require("cors");
const db = require("./db"); // <= sesuaikan path: "./db" kalau file-mu beda folder
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// paling atas:
const adminInvoiceRoutes = require("./routes/adminInvoice");
const paymentsApiRoutes = require("./routes/payments");
const paymentPageRoutes = require("./routes/paymentPage");
const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/payments", paymentsApiRoutes);
app.use("/pay", paymentPageRoutes);

const UPLOAD_ROOT = path.join(__dirname, "uploads", "client-designs");
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 50);
    cb(
      null,
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}${ext}`
    );
  },
});

const upload = multer({
  storage,
  limits: { files: 5, fileSize: 25 * 1024 * 1024 }, // maks 5 file, 25MB per file
  fileFilter: (_req, file, cb) => {
    const okExt = [
      ".pdf",
      ".ai",
      ".psd",
      ".cdr",
      ".svg",
      ".jpg",
      ".jpeg",
      ".png",
      ".zip",
      ".rar",
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      okExt.includes(ext) ||
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else cb(new Error("Tipe file tidak didukung"));
  },
});

// ===== Migrasi satu kali: tambah kolom 'design_files' di client_orders =====
db.all(`PRAGMA table_info(client_orders)`, (err, cols) => {
  if (err) {
    console.error("PRAGMA error:", err.message);
    return;
  }
  const hasDesignFiles =
    Array.isArray(cols) && cols.some((c) => c.name === "design_files");

  if (!hasDesignFiles) {
    db.run(
      `ALTER TABLE client_orders ADD COLUMN design_files TEXT DEFAULT '[]'`,
      (e) => {
        if (e) console.error("ALTER TABLE error:", e.message);
        else console.log("Added column client_orders.design_files");
      }
    );
  }
});

// ===== Migrasi satu kali: tambah kolom 'deleted_at' di clients =====
db.all(`PRAGMA table_info(clients)`, (err, cols) => {
  if (err) {
    console.error("PRAGMA clients error:", err.message);
    return;
  }
  const hasDeletedAt =
    Array.isArray(cols) && cols.some((c) => c.name === "deleted_at");
  if (!hasDeletedAt) {
    db.run(`ALTER TABLE clients ADD COLUMN deleted_at TEXT`, (e) => {
      if (e) console.error("ALTER TABLE clients error:", e.message);
      else console.log("Added column clients.deleted_at");
    });
  }
});

// ===== Migrasi satu kali: tambah kolom 'deleted_at' di customers =====
db.all(`PRAGMA table_info(customers)`, (err, cols) => {
  if (err) {
    console.error("PRAGMA customers error:", err.message);
    return;
  }
  const hasDeletedAt =
    Array.isArray(cols) && cols.some((c) => c.name === "deleted_at");
  if (!hasDeletedAt) {
    db.run(`ALTER TABLE customers ADD COLUMN deleted_at TEXT`, (e) => {
      if (e) console.error("ALTER TABLE customers error:", e.message);
      else console.log("Added column customers.deleted_at");
    });
  }
});

// === MATERIAL PURCHASES TABLE (Pembelian Bahan) ===
db.run(`
  CREATE TABLE IF NOT EXISTS material_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchased_at TEXT DEFAULT (datetime('now')),
    supplier_name TEXT NOT NULL,      -- contoh: "PT. Sahabat", "PT. Multi"
    supplier_code TEXT,               -- contoh: "SBH", "MLT"
    material_name TEXT NOT NULL,      -- contoh: "Flexi China 280", "Korcin410"
    material_code TEXT,               -- contoh: "FC280", "KOR410"
    unit TEXT NOT NULL,               -- roll | liter | pcs | cm
    qty REAL DEFAULT 1,               -- opsional, default 1
    price INTEGER NOT NULL,           -- harga per baris (boleh anggap total)
    notes TEXT
  )
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_orders_client_created
  ON client_orders (client_id, created_at)
`);

// setelah app.use(express.json())
app.use("/api/admin/invoice", adminInvoiceRoutes);

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const PORT = 4000; // dipakai juga untuk payment_url

// === Helpers: invoice-group (client + tanggal) ===
function decodeInvoiceGroupId(groupId) {
  const gid = Number(groupId);
  const client_id = gid % 1_000_000;
  const ymd = Math.floor(gid / 1_000_000); // YYYYMMDD
  const y = Math.floor(ymd / 10000);
  const m = Math.floor((ymd % 10000) / 100);
  const d = ymd % 100;
  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = `${y}-${pad(m)}-${pad(d)}`; // YYYY-MM-DD
  return { client_id, dateStr };
}

// ====== Helpers / Auth ======
function authenticateClient(req, res, next) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.client = { id: payload.id, email: payload.email };
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function mapInvoiceRow(o) {
  const invoice_status =
    String(o.status).toLowerCase() === "cancel"
      ? "cancel"
      : o.paid_at
      ? "paid"
      : "unpaid";

  return {
    id: o.id,
    invoice_number: `INV-${String(o.id).padStart(5, "0")}`,
    customer: { name: o.client_name || "" },
    issue_date: o.created_at,
    due_date: o.payment_deadline,
    total_amount: Number(o.amount_total) || 0,
    paid_at: o.paid_at || null,
    order_status: o.status, // status asli order (client_orders.status)
    invoice_status, // "paid" | "unpaid" | "cancel"
  };
}

// Helpers vendor (pakai tabel vendors)
function getVendorByName(name) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM vendors WHERE name = ?`,
      [String(name).toLowerCase()],
      (err, row) => (err ? reject(err) : resolve(row || null))
    );
  });
}

async function isVendorWhitelisted(name) {
  if (!name) return false;
  const v = await getVendorByName(name);
  return !!(v && v.is_whitelisted === 1);
}

// Ambil profil client singkat
function getClientProfile(id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id, full_name, email, phone, vendor_choice, vendor_other
       FROM clients WHERE id=?`,
      [id],
      (err, row) => (err ? reject(err) : resolve(row))
    );
  });
}

// ====== PRICING & TAX ======
const PRICING = {
  spanduk: {
    "Flexi China 280gsm": { per_cm2: 0.9 },
    "Flexi Korea 340gsm": { per_cm2: 1.2 },
    "Flexi Frontlit 440gsm": { per_cm2: 1.5 },
    "Vinyl Frontlit 510gsm": { per_cm2: 1.8 },
  },
  stiker: {
    "Stiker Vinyl Glossy": { per_cm2: 1.5 },
    "Stiker Vinyl Doff": { per_cm2: 1.5 },
    "Stiker HVS": { per_cm2: 0.7 },
    "Stiker Transparan": { per_cm2: 1.8 },
    "Stiker One Way": { per_cm2: 2.0 },
  },
  "x-banner": {
    "PVC 260gsm": { per_cm2: 1.4 },
    "PVC 300gsm": { per_cm2: 1.6 },
    "Luster Photo 230gsm": { per_cm2: 1.8 },
  },
  "roll-up": {
    "Polypropylene 200µ": { per_cm2: 1.8 },
    "PVC Grey Back 280gsm": { per_cm2: 2.1 },
  },
  "y-banner": {
    "PVC 260gsm": { per_cm2: 1.4 },
    "PVC 300gsm": { per_cm2: 1.6 },
  },
  "t-banner": {
    "PVC 260gsm": { per_cm2: 1.4 },
    "PVC 300gsm": { per_cm2: 1.6 },
  },
  baliho: {
    "Flexi Korea 340gsm": { per_cm2: 1.6 },
    "Flexi Frontlit 440gsm": { per_cm2: 1.9 },
  },
  brosur: {
    "Art Paper 120gsm": { per_item: 800 },
    "Art Paper 150gsm": { per_item: 1000 },
    "Art Carton 210gsm": { per_item: 1500 },
  },
  flyer: {
    "Art Paper 120gsm": { per_item: 700 },
    "HVS 100gsm": { per_item: 500 },
    "Ivory 210gsm": { per_item: 1200 },
  },
  kartu_nama: {
    "Art Carton 260gsm": { per_item: 350 },
    "Art Carton 310gsm": { per_item: 450 },
    "Ivory 260gsm": { per_item: 400 },
  },
};

const PURCHASE_PPN = 0.11; // untuk kebutuhan internal/admin (jika diperlukan)
const CLIENT_PPN = 0; // pesanan client: PPN = 0

function computeAmount(
  product_type,
  material,
  width_cm,
  height_cm,
  quantity,
  { ppn = CLIENT_PPN } = {} // default: 0 untuk client
) {
  const pt = (product_type || "").toLowerCase();
  const rate = PRICING[pt]?.[material] || null;

  const qty = Math.max(1, Number(quantity || 1));
  const w = Math.max(0, Number(width_cm || 0));
  const h = Math.max(0, Number(height_cm || 0));

  if (!rate) {
    return {
      unit_price: 0,
      pricing_basis: "item",
      subtotal: 0,
      tax: 0,
      total: 0,
    };
  }

  let unit_price = 0;
  let pricing_basis = "item";
  let subtotal = 0;

  if (rate.per_cm2 != null) {
    unit_price = Number(rate.per_cm2);
    pricing_basis = "cm2";
    const area = w * h; // cm^2
    subtotal = unit_price * area * qty;
  } else if (rate.per_item != null) {
    unit_price = Number(rate.per_item);
    pricing_basis = "item";
    subtotal = unit_price * qty;
  }

  subtotal = Math.round(subtotal);
  const tax = Math.round(subtotal * ppn); // ← pakai ppn dari argumen (default 0)
  const total = subtotal + tax;

  return { unit_price, pricing_basis, subtotal, tax, total };
}

// (opsional) turunan MATERIALS_MAP dari PRICING
const MATERIALS_MAP_FROM_PRICING = Object.fromEntries(
  Object.entries(PRICING).map(([ptype, mats]) => [ptype, Object.keys(mats)])
);

// Public: daftar vendor whitelisted untuk pilihan di form registrasi
app.get("/api/vendors", (req, res) => {
  db.all(
    `SELECT name FROM vendors WHERE is_whitelisted = 1 ORDER BY name ASC`,
    [],
    (err, rows) =>
      err
        ? res.status(500).json({ error: err.message })
        : res.json(rows.map((r) => r.name))
  );
});

// Katalog pricing untuk FE
app.get("/api/catalog/pricing", (_req, res) => {
  // kalau suatu saat mau lock harga via DB, cukup ganti implementasi sini
  res.json({
    materials: MATERIALS_MAP_FROM_PRICING, // { spanduk: ["Flexi ...", ...], ... }
    pricing: PRICING, // full rate table
    ppn: CLIENT_PPN,
    currency: "IDR",
    basis: { cm2: "per cm²", item: "per item" },
  });
});

// ===== Admin Auth =====
function authenticateAdmin(requiredRole /* optional */) {
  return (req, res, next) => {
    const auth = req.headers["authorization"] || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (!payload.admin) throw new Error("not admin");
      if (requiredRole && payload.role !== requiredRole)
        return res.status(403).json({ error: "Forbidden" });
      req.admin = { id: payload.id, email: payload.email, role: payload.role };
      next();
    } catch (e) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

// ========== 3A. Admin Invoice API (protected) ==========
function normCustomerRow(row = {}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email || null,
    phone: row.phone || null,
    address: row.address || null,
    created_at: row.created_at || new Date().toISOString(),
    deleted_at: row.deleted_at || null,
  };
}

function normInvoiceRow(row = {}) {
  // Backend lama mungkin pakai kolom "amount" dan "items" (JSON string)
  let items = [];
  try {
    items = Array.isArray(row.items)
      ? row.items
      : JSON.parse(row.items || "[]");
  } catch {}
  items = items.map((it) => ({
    description: it.description || it.name || "Item",
    quantity: Number(it.quantity ?? it.qty ?? 1),
    unit_price: Number(it.unit_price ?? it.price ?? 0),
    total_price: Number(
      it.total_price ??
        Number(it.unit_price ?? it.price ?? 0) *
          Number(it.quantity ?? it.qty ?? 1)
    ),
  }));

  const subtotal = Number(
    row.subtotal ?? row.amount ?? items.reduce((s, it) => s + it.total_price, 0)
  );
  const tax_rate = Number(row.tax_rate ?? 11);
  const tax_amount = Number(
    row.tax_amount ?? Math.round(subtotal * (tax_rate / 100))
  );
  const total_amount = Number(row.total_amount ?? subtotal + tax_amount);

  return {
    id: row.id,
    invoice_number: row.invoice_number || `INV-${row.id}`,
    status: row.status || "draft",
    issue_date: row.issue_date || row.created_at || new Date().toISOString(),
    due_date: row.due_date || row.created_at || new Date().toISOString(),
    notes: row.notes || "",
    items,
    subtotal,
    tax_rate,
    tax_amount,
    total_amount,
    customer:
      typeof row.customer === "string"
        ? { name: row.customer }
        : row.customer || null,
  };
}

// ---- Customers ----

// ===== Admin: kelola vendors =====
app.get("/api/admin/vendors", authenticateAdmin("verifier"), (req, res) => {
  db.all(
    `SELECT id, name, is_whitelisted, created_at FROM vendors ORDER BY name ASC`,
    [],
    (err, rows) =>
      err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.post("/api/admin/vendors", authenticateAdmin("verifier"), (req, res) => {
  const { name, is_whitelisted } = req.body || {};
  if (!name?.trim())
    return res.status(400).json({ error: "Nama vendor wajib" });
  db.run(
    `INSERT INTO vendors (name, is_whitelisted, created_by_admin_id)
     VALUES (?, ?, ?)`,
    [String(name).toLowerCase(), is_whitelisted ? 1 : 0, req.admin?.id || null],
    function (err) {
      if (err) {
        if (String(err.message).includes("UNIQUE")) {
          return res.status(409).json({ error: "Vendor sudah ada" });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({
        id: this.lastID,
        name,
        is_whitelisted: is_whitelisted ? 1 : 0,
      });
    }
  );
});

app.patch(
  "/api/admin/vendors/:id",
  authenticateAdmin("verifier"),
  (req, res) => {
    const id = Number(req.params.id);
    const { name, is_whitelisted } = req.body || {};
    if (!id) return res.status(400).json({ error: "Bad id" });

    db.run(
      `UPDATE vendors SET
       name = COALESCE(?, name),
       is_whitelisted = COALESCE(?, is_whitelisted)
     WHERE id = ?`,
      [
        name ? String(name).toLowerCase() : null,
        typeof is_whitelisted === "number" ? is_whitelisted : null,
        id,
      ],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
      }
    );
  }
);

// Hapus vendor dari whitelist (soft) atau hapus baris (hard bila tidak dipakai)
app.delete(
  "/api/admin/vendors/:id",
  authenticateAdmin("verifier"),
  (req, res) => {
    const id = Number(req.params.id);
    const hard = String(req.query.hard || "0") === "1";
    if (!id) return res.status(400).json({ error: "Bad id" });

    // ambil nama vendor dulu
    db.get(
      `SELECT id, name, is_whitelisted FROM vendors WHERE id=?`,
      [id],
      (e1, v) => {
        if (e1) return res.status(500).json({ error: e1.message });
        if (!v) return res.status(404).json({ error: "Vendor not found" });

        // cek sedang dipakai client atau tidak
        db.get(
          `SELECT COUNT(*) AS refs FROM clients WHERE LOWER(vendor_choice) = LOWER(?)`,
          [v.name],
          (e2, r) => {
            if (e2) return res.status(500).json({ error: e2.message });

            if (hard) {
              // hard delete: hanya boleh kalau tidak ada referensi
              if ((r?.refs || 0) > 0) {
                return res.status(409).json({
                  error:
                    "Tidak bisa hapus permanen: vendor sedang dipakai oleh client",
                  refs: r?.refs || 0,
                });
              }
              return db.run(
                `DELETE FROM vendors WHERE id=?`,
                [id],
                function (e3) {
                  if (e3) return res.status(500).json({ error: e3.message });
                  return res.json({ deleted: true });
                }
              );
            }

            // soft delete: cabut whitelist saja
            db.run(
              `UPDATE vendors SET is_whitelisted = 0 WHERE id = ?`,
              [id],
              function (e4) {
                if (e4) return res.status(500).json({ error: e4.message });
                return res.json({ whitelisted: false, updated: this.changes });
              }
            );
          }
        );
      }
    );
  }
);

// Admin: set vendor client, auto-upsert vendor & tandai whitelisted
app.patch(
  "/api/admin/clients/:id/vendor",
  authenticateAdmin("verifier"),
  (req, res) => {
    const clientId = Number(req.params.id);
    const { vendor_name } = req.body || {};
    if (!clientId || !vendor_name?.trim()) {
      return res.status(400).json({ error: "vendor_name wajib" });
    }
    const vname = String(vendor_name).toLowerCase();

    db.serialize(() => {
      // upsert vendor jadi whitelisted
      db.run(
        `INSERT INTO vendors (name, is_whitelisted, created_by_admin_id)
       VALUES (?, 1, ?)
       ON CONFLICT(name) DO UPDATE SET is_whitelisted = 1`,
        [vname, req.admin?.id || null],
        (e1) => {
          if (e1) return res.status(500).json({ error: e1.message });

          // update profil client
          db.run(
            `UPDATE clients
           SET vendor_choice = ?, vendor_other = NULL
           WHERE id = ?`,
            [vname, clientId],
            (e2) => {
              if (e2) return res.status(500).json({ error: e2.message });

              // update semua order client yg belum lunas: jadikan whitelist (tdk perlu bayar dulu)
              db.run(
                `UPDATE client_orders
               SET vendor_whitelisted = 1,
                   payment_required = 0,
                   payment_deadline = NULL
               WHERE client_id = ?
                 AND paid_at IS NULL
                 AND status IN ('pending','verifikasi')`,
                [clientId],
                (e3) => {
                  if (e3) return res.status(500).json({ error: e3.message });
                  res.json({ ok: true });
                }
              );
            }
          );
        }
      );
    });
  }
);

app.patch(
  "/api/admin/clients/:id/approval",
  authenticateAdmin("verifier"),
  (req, res) => {
    const id = Number(req.params.id);
    const approved = !!req.body.approved;
    const now = new Date().toISOString();
    const params = approved ? [1, now, req.admin.id, id] : [0, null, null, id];

    db.run(
      "UPDATE clients SET is_approved=?, approved_at=?, approved_by=? WHERE id=?",
      params,
      function (err) {
        if (err)
          return res
            .status(500)
            .json({ error: "db_error", detail: err.message });
        if (this.changes === 0)
          return res.status(404).json({ error: "not_found" });
        res.json({ ok: true, id, approved });
      }
    );
  }
);

// Admin login
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Email & password" });
  db.get(
    `SELECT * FROM admins WHERE email=?`,
    [email.toLowerCase()],
    async (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(401).json({ error: "Invalid credentials" });
      const ok = await bcrypt.compare(password, row.password_hash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });
      const token = jwt.sign(
        { admin: true, id: row.id, email: row.email, role: row.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      res.json({
        token,
        admin: {
          id: row.id,
          email: row.email,
          full_name: row.full_name,
          role: row.role,
        },
      });
    }
  );
});

app.get(
  "/api/admin/orders/pending",
  authenticateAdmin("verifier"),
  (req, res) => {
    db.all(
      `SELECT  co.*,
            c.full_name  AS client_name,
            c.email      AS client_email,
            COALESCE(c.vendor_choice,'none') AS vendor_choice
     FROM client_orders co
     LEFT JOIN clients c ON c.id = co.client_id
     WHERE co.status = 'pending'
     ORDER BY co.created_at ASC`,
      [],
      (err, rows) => {
        if (err) {
          console.error("[/api/admin/orders/pending]", err.message);
          return res.status(500).json({ error: err.message });
        }
        res.json(rows);
      }
    );
  }
);

app.patch(
  "/api/admin/orders/:id/status",
  authenticateAdmin("verifier"),
  (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    if (!id || !["verifikasi", "cancel"].includes(status))
      return res.status(400).json({ error: "Bad request" });

    db.get(
      `SELECT payment_required, paid_at, status, payment_deadline
     FROM client_orders WHERE id=?`,
      [id],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Not found" });

        // Kalau mau verifikasi tapi wajib bayar & belum bayar → tolak
        if (status === "verifikasi" && row.payment_required && !row.paid_at) {
          return res.status(400).json({ error: "Belum dibayar" });
        }

        db.run(
          `UPDATE client_orders
         SET status = ?
         WHERE id = ?
           AND status IN ('pending','verifikasi')`,
          [status, id],
          function (e2) {
            if (e2) return res.status(500).json({ error: e2.message });
            res.json({ updated: this.changes });
          }
        );
      }
    );
  }
);

// ===== Admin Verifikasi: list & aksi ACC/Cancel =====

// List order untuk diverifikasi.
// Query ?status=pending|verifikasi|cancel (default: pending)
app.get(
  "/api/admin/verify/orders",
  authenticateAdmin("verifier"),
  (req, res) => {
    const { status = "pending" } = req.query;
    db.all(
      `SELECT  co.*,
            c.full_name  AS client_name,
            c.email      AS client_email,
            COALESCE(c.vendor_choice,'none') AS vendor_choice
     FROM client_orders co
     LEFT JOIN clients c ON c.id = co.client_id
     WHERE co.status = ?
     ORDER BY co.created_at DESC`,
      [String(status)],
      (err, rows) => {
        if (err) {
          console.error("[/api/admin/verify/orders]", err.message);
          return res.status(500).json({ error: err.message });
        }
        res.json(rows);
      }
    );
  }
);

// List order yg sudah diverifikasi pembayaran & menunggu approval akhir
// Daftar order MENUNGGU APPROVAL (sudah verifikasi, belum approve final)
// FE memanggil: GET /api/admin/orders/for-approval
app.get(
  "/api/admin/orders/for-approval",
  authenticateAdmin("verifier"),
  (req, res) => {
    db.all(
      `SELECT  co.*,
            c.full_name  AS client_name,
            c.email      AS client_email,
            COALESCE(c.vendor_choice,'none') AS vendor_choice
     FROM client_orders co
     LEFT JOIN clients c ON c.id = co.client_id
     WHERE co.status = 'verifikasi'
     ORDER BY co.created_at ASC`,
      [],
      (err, rows) => {
        if (err) {
          console.error("[/api/admin/orders/for-approval]", err.message);
          return res.status(500).json({ error: err.message });
        }
        res.json(rows);
      }
    );
  }
);

// Approve final -> ubah status ke 'approved'
app.patch(
  "/api/admin/orders/:id/approve",
  authenticateAdmin("verifier"),
  (req, res) => {
    const id = Number(req.params.id);
    db.run(
      `UPDATE client_orders
     SET status='approved', approved_at=datetime('now'), approved_by=?
     WHERE id=? AND status='verifikasi'`,
      [req.admin?.id || null, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
      }
    );
  }
);

// Reject (balikkan ke cancel). Bisa tambahkan reason kalau mau.
app.patch(
  "/api/admin/orders/:id/reject",
  authenticateAdmin("verifier"),
  (req, res) => {
    const id = Number(req.params.id);
    db.run(
      `UPDATE client_orders
     SET status='cancel'
     WHERE id=? AND status='verifikasi'`,
      [id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
      }
    );
  }
);

// Selesai dikerjakan -> ubah status ke 'done'
app.patch(
  "/api/admin/orders/:id/complete",
  authenticateAdmin("verifier"),
  (req, res) => {
    const id = Number(req.params.id);
    db.get(
      `SELECT vendor_whitelisted, paid_at, payment_url FROM client_orders WHERE id=?`,
      [id],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Not found" });

        const realPayUrl = `http://localhost:${PORT}/pay/${id}`;

        db.run(
          `UPDATE client_orders
           SET status='done',
               completed_at = datetime('now'),
               completed_by = ?,
               /* untuk vendor whitelist & belum dibayar, siapkan link bayar */
               payment_url = CASE
                   WHEN ? = 1 AND paid_at IS NULL AND (payment_url IS NULL OR payment_url = '')
                   THEN ?
                   ELSE payment_url
               END
         WHERE id=? AND status='approved'`,
          [
            req.admin?.id || null,
            row.vendor_whitelisted ? 1 : 0,
            realPayUrl,
            id,
          ],
          function (e2) {
            if (e2) return res.status(500).json({ error: e2.message });
            res.json({ updated: this.changes });
          }
        );
      }
    );
  }
);

// Detail satu order (opsional, buat modal detail di FE)
app.get(
  "/api/admin/verify/orders/:id",
  authenticateAdmin("verifier"),
  (req, res) => {
    const id = Number(req.params.id);
    db.get(
      db.get(
        `SELECT  co.*,
              c.full_name  AS client_name,
              c.email      AS client_email,
              COALESCE(c.vendor_choice,'none') AS vendor_choice
       FROM client_orders co
       LEFT JOIN clients c ON c.id = co.client_id
       WHERE co.id=?`,
        [id],
        (err, row) =>
          err
            ? res.status(500).json({ error: err.message })
            : res.json(row || null)
      )
    );
  }
);

// ACC (set ke verifikasi)
app.post(
  "/api/admin/verify/orders/:id/accept",
  authenticateAdmin("verifier"),
  (req, res) => {
    const id = Number(req.params.id);
    db.run(
      `UPDATE client_orders
     SET status='verifikasi'
     WHERE id=? AND status IN ('pending','verifikasi')`,
      [id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
      }
    );
  }
);

// Cancel (hanya dari pending)
app.post(
  "/api/admin/verify/orders/:id/cancel",
  authenticateAdmin("verifier"),
  (req, res) => {
    const id = Number(req.params.id);
    db.run(
      `UPDATE client_orders
     SET status='cancel'
     WHERE id=? AND status='pending'`,
      [id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
      }
    );
  }
);

app.get("/api/admin/clients", authenticateAdmin("verifier"), (req, res) => {
  const includeDeleted = String(req.query.include_deleted || "0") === "1";
  const where = includeDeleted ? "" : "WHERE deleted_at IS NULL";
  db.all(
    `
    SELECT id, full_name, email, phone, vendor_choice, vendor_other,
           created_at, is_approved, deleted_at
    FROM clients
    ${where}
    ORDER BY created_at DESC
    `,
    [],
    (err, rows) =>
      err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.post(
  "/api/admin/clients",
  authenticateAdmin("verifier"),
  async (req, res) => {
    try {
      const {
        full_name,
        email,
        phone,
        vendor_choice = "none",
        vendor_other,
      } = req.body || {};
      if (!full_name?.trim() || !email?.trim()) {
        return res.status(400).json({ error: "Nama & email wajib" });
      }

      // vendor disimpan lowercase biar konsisten
      const vchoice = String(vendor_choice || "none").toLowerCase();
      const vother = vchoice === "lainnya" ? vendor_other || null : null;

      // buat password sementara (karena kolom password_hash dipakai saat login)
      const tempPassword = Math.random().toString(36).slice(2, 10);
      const hash = await bcrypt.hash(tempPassword, 10);

      db.run(
        `INSERT INTO clients (full_name, email, phone, vendor_choice, vendor_other, password_hash, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [full_name, email.toLowerCase(), phone || null, vchoice, vother, hash],
        function (err) {
          if (err) {
            if (String(err.message || "").includes("UNIQUE")) {
              return res.status(409).json({ error: "Email sudah terdaftar" });
            }
            return res.status(500).json({ error: err.message });
          }
          res.json({
            id: this.lastID,
            full_name,
            email: email.toLowerCase(),
            phone: phone || null,
            vendor_choice: vchoice,
            vendor_other: vother,
            is_approved: 0,
            // opsional: kirimkan password sementara untuk dicatat admin (hapus di production)
            temporary_password: tempPassword,
          });
        }
      );
    } catch (e) {
      res.status(500).json({ error: String(e.message || e) });
    }
  }
);

// Soft / Hard delete client
// - Soft (default, ?hard=0): boleh jika TIDAK ada order AKTIF (pending|verifikasi|approved)
//   → set deleted_at, riwayat order tetap ada.
// - Hard (?hard=1): HAPUS SEMUA order milik client lalu hapus baris client (tanpa syarat).
app.delete(
  "/api/admin/clients/:id",
  authenticateAdmin("verifier"),
  (req, res) => {
    const id = Number(req.params.id);
    const hard = String(req.query.hard || "0") === "1";
    if (!id) return res.status(400).json({ error: "Bad id" });

    // ---- HARD DELETE: hapus semua order + client dalam satu transaksi ----
    if (hard) {
      db.serialize(() => {
        db.run("BEGIN");
        db.run(
          `DELETE FROM client_orders WHERE client_id=?`,
          [id],
          function (e1) {
            if (e1) {
              db.run("ROLLBACK");
              return res.status(500).json({ error: e1.message });
            }
            const ordersDeleted = this.changes || 0;

            db.run(`DELETE FROM clients WHERE id=?`, [id], function (e2) {
              if (e2) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: e2.message });
              }
              if (this.changes === 0) {
                db.run("ROLLBACK");
                return res.status(404).json({ error: "not_found" });
              }
              db.run("COMMIT");
              return res.json({
                deleted: true,
                mode: "hard",
                orders_deleted: ordersDeleted,
              });
            });
          }
        );
      });
      return;
    }

    // ---- SOFT DELETE: tetap seperti sebelumnya (tidak boleh jika masih ada order AKTIF) ----
    const sql = `
    SELECT
      SUM(CASE WHEN status IN ('pending','verifikasi','approved') THEN 1 ELSE 0 END) AS active_refs
    FROM client_orders
    WHERE client_id = ?
  `;
    db.get(sql, [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });

      const active = Number(row?.active_refs || 0);
      if (active > 0) {
        return res.status(409).json({
          error: "Tidak bisa hapus: client masih punya order aktif",
          refs: active,
        });
      }

      db.run(
        `UPDATE clients SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`,
        [id],
        function (e3) {
          if (e3) return res.status(500).json({ error: e3.message });
          if (this.changes === 0)
            return res
              .status(404)
              .json({ error: "not_found_or_already_deleted" });
          return res.json({ deleted: true, mode: "soft" });
        }
      );
    });
  }
);

app.patch(
  "/api/admin/clients/:id",
  authenticateAdmin("verifier"),
  (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Bad id" });

    const { full_name, email, phone, vendor_choice, vendor_other } =
      req.body || {};

    // jika vendor_choice dikirim, kita tentukan vendor_other yang baru
    let setVendorOther = false;
    let newVendorOther = null;
    let vchoiceParam = null;

    if (vendor_choice !== undefined) {
      const vchoice = String(vendor_choice).toLowerCase();
      vchoiceParam = vchoice;
      setVendorOther = true;
      newVendorOther = vchoice === "lainnya" ? vendor_other || null : null;
    }

    db.run(
      `UPDATE clients SET
       full_name     = COALESCE(?, full_name),
       email         = COALESCE(?, email),
       phone         = COALESCE(?, phone),
       vendor_choice = COALESCE(?, vendor_choice)
     WHERE id = ?`,
      [
        full_name || null,
        email ? email.toLowerCase() : null,
        phone || null,
        vchoiceParam, // bisa null kalau tidak mengubah
        id,
      ],
      function (err) {
        if (err) {
          if (String(err.message || "").includes("UNIQUE")) {
            return res.status(409).json({ error: "Email sudah terpakai" });
          }
          return res.status(500).json({ error: err.message });
        }
        // jika perlu set vendor_other (termasuk menjadi NULL)
        if (!setVendorOther) return res.json({ updated: this.changes });

        db.run(
          `UPDATE clients SET vendor_other = ? WHERE id = ?`,
          [newVendorOther, id],
          function (e2) {
            if (e2) return res.status(500).json({ error: e2.message });
            return res.json({ updated: 1 });
          }
        );
      }
    );
  }
);

app.patch(
  "/api/admin/clients/:id/restore",
  authenticateAdmin("verifier"),
  (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Bad id" });
    db.run(
      `UPDATE clients SET deleted_at = NULL WHERE id = ?`,
      [id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0)
          return res.status(404).json({ error: "not_found" });
        res.json({ restored: true });
      }
    );
  }
);

// ===== Admin Invoice: Pembelian Bahan =====
app.get(
  "/api/admin/invoice/purchases",
  authenticateAdmin("invoice"),
  (req, res) => {
    const { supplier_code, material_code, q } = req.query;
    const conds = [];
    const params = [];

    if (supplier_code) {
      conds.push("LOWER(supplier_code) = LOWER(?)");
      params.push(String(supplier_code));
    }
    if (material_code) {
      conds.push("LOWER(material_code) = LOWER(?)");
      params.push(String(material_code));
    }
    if (q) {
      conds.push("(supplier_name LIKE ? OR material_name LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const sql = `
      SELECT id, purchased_at, supplier_name, supplier_code,
             material_name, material_code, unit, qty, price, notes
      FROM material_purchases
      ${where}
      ORDER BY datetime(purchased_at) DESC, id DESC
    `;
    db.all(sql, params, (err, rows) =>
      err ? res.status(500).json({ error: err.message }) : res.json(rows)
    );
  }
);

app.post(
  "/api/admin/invoice/purchases",
  authenticateAdmin("invoice"),
  (req, res) => {
    const {
      purchased_at, // optional
      supplier_name,
      supplier_code,
      material_name,
      material_code,
      unit,
      qty = 1,
      price,
      notes,
    } = req.body || {};

    if (!supplier_name?.trim() || !material_name?.trim() || !unit || !price) {
      return res.status(400).json({ error: "Data wajib belum lengkap" });
    }

    db.run(
      `INSERT INTO material_purchases
        (purchased_at, supplier_name, supplier_code, material_name, material_code, unit, qty, price, notes)
       VALUES (
         COALESCE(?, datetime('now')),?,?,?,?,?,?,?,?
       )`,
      [
        purchased_at || null,
        supplier_name,
        supplier_code || null,
        material_name,
        material_code || null,
        unit,
        Number(qty) || 1,
        Math.round(Number(price) || 0),
        notes || null,
      ],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get(
          `SELECT * FROM material_purchases WHERE id=?`,
          [this.lastID],
          (e2, row) =>
            e2 ? res.status(500).json({ error: e2.message }) : res.json(row)
        );
      }
    );
  }
);

app.put(
  "/api/admin/invoice/purchases/:id",
  authenticateAdmin("invoice"),
  (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Bad id" });

    const {
      purchased_at,
      supplier_name,
      supplier_code,
      material_name,
      material_code,
      unit,
      qty,
      price,
      notes,
    } = req.body || {};

    db.run(
      `UPDATE material_purchases SET
        purchased_at = COALESCE(?, purchased_at),
        supplier_name = COALESCE(?, supplier_name),
        supplier_code = COALESCE(?, supplier_code),
        material_name = COALESCE(?, material_name),
        material_code = COALESCE(?, material_code),
        unit = COALESCE(?, unit),
        qty = COALESCE(?, qty),
        price = COALESCE(?, price),
        notes = COALESCE(?, notes)
       WHERE id = ?`,
      [
        purchased_at || null,
        supplier_name || null,
        supplier_code || null,
        material_name || null,
        material_code || null,
        unit || null,
        qty != null ? Number(qty) : null,
        price != null ? Math.round(Number(price)) : null,
        notes || null,
        id,
      ],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get(`SELECT * FROM material_purchases WHERE id=?`, [id], (e2, row) =>
          e2 ? res.status(500).json({ error: e2.message }) : res.json(row)
        );
      }
    );
  }
);

app.delete(
  "/api/admin/invoice/purchases/:id",
  authenticateAdmin("invoice"),
  (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Bad id" });
    db.run(`DELETE FROM material_purchases WHERE id=?`, [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(204).end();
    });
  }
);

// Summary: total pengeluaran
app.get(
  "/api/admin/invoice/purchases/summary",
  authenticateAdmin("invoice"),
  (req, res) => {
    // total_spend = sum(price)
    db.get(
      `SELECT COUNT(*) as count, COALESCE(SUM(price),0) as total_spend
       FROM material_purchases`,
      [],
      (err, row) =>
        err ? res.status(500).json({ error: err.message }) : res.json(row)
    );
  }
);

// ===== Admin Invoice: Vendors list (untuk filter) =====
app.get(
  "/api/admin/invoice/vendors",
  authenticateAdmin("invoice"),
  (req, res) => {
    // Ambil daftar whitelist
    db.all(
      `SELECT name FROM vendors WHERE is_whitelisted = 1`,
      [],
      (e1, wrows) => {
        if (e1) return res.status(500).json({ error: e1.message });
        const wl = wrows.map((r) => r.name);

        // Tambahkan special values bila ada di clients
        db.all(
          `SELECT DISTINCT LOWER(COALESCE(vendor_choice,'none')) AS v
           FROM clients`,
          [],
          (_e2, crows = []) => {
            const special = crows
              .map((r) => r.v)
              .filter((v) => v === "none" || v === "lainnya");
            const result = Array.from(new Set([...wl, ...special])).sort(
              (a, b) => a.localeCompare(b)
            );
            res.json(result);
          }
        );
      }
    );
  }
);

/**
 * GET /api/admin/invoice/sales
 * Query:
 *   from=YYYY-MM-DD (wajib)
 *   to=YYYY-MM-DD   (wajib)
 *   vendor=<string> | "all" (opsional)
 *   date_field=paid|created  (default: paid)
 * Return:
 *   {
 *     rows: [{ id, issue_date, paid_at, status, total_amount, customer_name, vendor }],
 *     summary: { count, total, paid, unpaid },
 *     by_vendor: [{ vendor, count, total, paid }],
 *     by_day: [{ day, total, paid }]
 *   }
 */
app.get(
  "/api/admin/invoice/sales",
  authenticateAdmin("invoice"),
  (req, res) => {
    const { from, to, vendor, date_field } = req.query || {};
    if (!from || !to)
      return res.status(400).json({ error: "from & to (YYYY-MM-DD) wajib" });

    // status: all | paid | unpaid | cancelled
    const status = String(req.query.status || "all").toLowerCase();

    // NEW: tentukan date field efektif (kalau unpaid & user pilih 'paid' → pakai 'created')
    const dfRequested =
      String(date_field || "paid").toLowerCase() === "created"
        ? "created"
        : "paid"; // NEW
    const df =
      (status === "unpaid" || status === "cancelled") && dfRequested === "paid"
        ? "created"
        : dfRequested;

    const start = `${from} 00:00:00`;
    const end = `${to} 23:59:59`;

    // filter vendor opsional
    const vendorWhere =
      vendor && vendor !== "all"
        ? "AND LOWER(COALESCE(c.vendor_choice,'none')) = LOWER(?)"
        : "";
    const vendorParams = vendor && vendor !== "all" ? [vendor] : [];

    // pilih kolom tanggal yang dipakai
    const dateCol = df === "paid" ? "co.paid_at" : "co.created_at";
    const withDateColNotNull =
      df === "paid" ? "AND co.paid_at IS NOT NULL" : "";

    // NEW: filter status pembayaran
    const statusWhere =
      status === "paid"
        ? "AND co.paid_at IS NOT NULL AND LOWER(co.status) <> 'cancel'"
        : status === "unpaid"
        ? "AND co.paid_at IS NULL AND LOWER(co.status) <> 'cancel'"
        : status === "cancelled"
        ? "AND LOWER(co.status) = 'cancel'"
        : ""; // all → tampilkan semua

    // ------ rows detail ------
    const rowsSQL = `
      SELECT co.id,
             co.created_at       AS issue_date,
             co.paid_at,
             co.status           AS order_status,
             co.amount_total     AS total_amount,
             c.full_name         AS customer_name,
             COALESCE(c.vendor_choice,'none') AS vendor
      FROM client_orders co
      LEFT JOIN clients c ON c.id = co.client_id
      WHERE ${dateCol} BETWEEN ? AND ?
        ${withDateColNotNull}
        ${statusWhere}
        ${vendorWhere}
      ORDER BY ${dateCol} DESC, co.id DESC
    `;

    // ------ summary ------
    const summarySQL = `
      SELECT COUNT(*)                                       AS count,
         COALESCE(SUM(co.amount_total),0) AS total,
         COALESCE(SUM(CASE
           WHEN co.paid_at IS NOT NULL AND LOWER(co.status) <> 'cancel'
           THEN co.amount_total ELSE 0 END),0) AS paid,
        COALESCE(SUM(CASE
           WHEN co.paid_at IS NULL AND LOWER(co.status) <> 'cancel'
           THEN co.amount_total ELSE 0 END),0) AS unpaid
      FROM client_orders co
      LEFT JOIN clients c ON c.id = co.client_id
      WHERE ${dateCol} BETWEEN ? AND ?
        ${withDateColNotNull}
        ${statusWhere}                 -- NEW
        ${vendorWhere}
    `;

    // ------ group by vendor ------
    const byVendorSQL = `
      SELECT COALESCE(c.vendor_choice,'none') AS vendor,
             COUNT(*)                          AS count,
             COALESCE(SUM(co.amount_total),0)  AS total,
             COALESCE(SUM(CASE WHEN co.paid_at IS NOT NULL THEN co.amount_total ELSE 0 END),0) AS paid
      FROM client_orders co
      LEFT JOIN clients c ON c.id = co.client_id
      WHERE ${dateCol} BETWEEN ? AND ?
        ${withDateColNotNull}
        ${statusWhere}                 -- NEW
        ${vendorWhere}
      GROUP BY vendor
      ORDER BY total DESC
    `;

    // ------ group by day (untuk grafik) ------
    const byDaySQL = `
      SELECT strftime('%Y-%m-%d', ${dateCol}) AS day,
             COALESCE(SUM(co.amount_total),0)  AS total,
             COALESCE(SUM(CASE WHEN co.paid_at IS NOT NULL THEN co.amount_total ELSE 0 END),0) AS paid
      FROM client_orders co
      LEFT JOIN clients c ON c.id = co.client_id
      WHERE ${dateCol} BETWEEN ? AND ?
        ${withDateColNotNull}
        ${statusWhere}                 -- NEW
        ${vendorWhere}
      GROUP BY day
      ORDER BY day ASC
    `;

    const params = [start, end, ...vendorParams];

    db.all(rowsSQL, params, (e1, rows) => {
      if (e1) return res.status(500).json({ error: e1.message });
      db.get(summarySQL, params, (e2, summary) => {
        if (e2) return res.status(500).json({ error: e2.message });
        db.all(byVendorSQL, params, (e3, byVendor) => {
          if (e3) return res.status(500).json({ error: e3.message });
          db.all(byDaySQL, params, (e4, byDay) => {
            if (e4) return res.status(500).json({ error: e4.message });

            const mapStatus = (s) =>
              s && s.toString().toLowerCase() === "cancel"
                ? "cancelled"
                : s && ["approved", "verifikasi", "done"].includes(String(s))
                ? "sent"
                : "draft";

            const rowsMapped = rows.map((r) => ({
              id: r.id,
              invoice_number: `INV-${String(r.id).padStart(5, "0")}`,
              issue_date: r.issue_date,
              paid_at: r.paid_at,
              status: r.paid_at ? "paid" : mapStatus(r.order_status),
              total_amount: Number(r.total_amount) || 0,
              customer_name: r.customer_name,
              vendor: r.vendor || "none",
            }));

            res.json({
              rows: rowsMapped,
              summary: {
                count: Number(summary.count) || 0,
                total: Number(summary.total) || 0,
                paid: Number(summary.paid) || 0,
                unpaid: Number(summary.unpaid) || 0,
              },
              by_vendor: byVendor.map((v) => ({
                vendor: v.vendor || "none",
                count: Number(v.count) || 0,
                total: Number(v.total) || 0,
                paid: Number(v.paid) || 0,
              })),
              by_day: byDay.map((d) => ({
                day: d.day,
                total: Number(d.total) || 0,
                paid: Number(d.paid) || 0,
              })),
            });
          });
        });
      });
    });
  }
);

// ====== Auth (Clients) ======
app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      vendor_choice,
      vendor_other,
      password,
      confirm_password,
    } = req.body || {};

    if (
      !full_name ||
      !email ||
      !password ||
      !confirm_password ||
      !vendor_choice
    ) {
      return res.status(400).json({ error: "Data tidak lengkap" });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ error: "Konfirmasi password tidak cocok" });
    }
    // Ambil vendor whitelisted dari DB
    function getWhitelistedVendors() {
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT name FROM vendors WHERE is_whitelisted = 1`,
          [],
          (err, rows) => (err ? reject(err) : resolve(rows.map((r) => r.name)))
        );
      });
    }

    const publicVendors = await getWhitelistedVendors();
    const allowed = new Set([..."none lainnya".split(" "), ...publicVendors]);
    if (!allowed.has(String(vendor_choice))) {
      return res.status(400).json({ error: "Pilihan vendor tidak valid" });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    db.run(
      `INSERT INTO clients (full_name, email, phone, vendor_choice, vendor_other, password_hash, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [
        full_name,
        email.toLowerCase(),
        phone || null,
        vendor_choice,
        vendor_choice === "lainnya" ? vendor_other || null : null,
        hash,
      ],
      function (err) {
        if (err) {
          if (String(err.message || "").includes("UNIQUE")) {
            return res.status(409).json({ error: "Email sudah terdaftar" });
          }
          return res.status(500).json({ error: err.message });
        }
        const id = this.lastID;
        const token = jwt.sign({ id, email: email.toLowerCase() }, JWT_SECRET, {
          expiresIn: "7d",
        });
        res.json({
          token,
          client: {
            id,
            full_name,
            email: email.toLowerCase(),
            phone,
            vendor_choice,
            vendor_other:
              vendor_choice === "lainnya" ? vendor_other || null : null,
          },
        });
      }
    );
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Email dan password wajib" });

  db.get(
    `SELECT * FROM clients WHERE email = ? AND deleted_at IS NULL`,
    [String(email).toLowerCase()],
    async (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row)
        return res.status(401).json({ error: "Email atau password salah" });
      try {
        const ok = await bcrypt.compare(password, row.password_hash);
        if (!ok)
          return res.status(401).json({ error: "Email atau password salah" });
        const token = jwt.sign({ id: row.id, email: row.email }, JWT_SECRET, {
          expiresIn: "7d",
        });
        res.json({
          token,
          client: {
            id: row.id,
            full_name: row.full_name,
            email: row.email,
            phone: row.phone,
            vendor_choice: row.vendor_choice,
            vendor_other: row.vendor_other,
          },
        });
      } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
      }
    }
  );
});

// Profil client saat ini
app.get("/api/client/me", authenticateClient, (req, res) => {
  db.get(
    `SELECT id, full_name, email, phone, vendor_choice, vendor_other, created_at, is_approved
     FROM clients
     WHERE id = ? AND deleted_at IS NULL`,
    [req.client.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || null);
    }
  );
});

// ====== Client Orders ======

// List order milik client (kembalikan kolom lengkap untuk FE)
app.get("/api/client/orders", authenticateClient, (req, res) => {
  db.all(
    `SELECT id, client_id, title, notes,
            product_type, material, width_cm, height_cm, quantity,
            unit_price, pricing_basis, amount_subtotal, tax_ppn, amount_total,
            status, vendor_whitelisted, payment_required,
            payment_deadline, payment_url, paid_at, created_at,
            design_files
     FROM client_orders
     WHERE client_id = ?
     ORDER BY created_at DESC`,
    [req.client.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const mapped = rows.map((r) => {
        try {
          r.design_files = JSON.parse(r.design_files || "[]");
        } catch {}
        return r;
      });
      res.json(mapped);
    }
  );
});

// Create order: tentukan payment_required, deadline, payment_url, dan HITUNG TOTAL
// Create order: tentukan payment_required, deadline, payment_url, dan HITUNG TOTAL
app.post(
  "/api/client/orders",
  authenticateClient,
  upload.array("design_files", 5),
  async (req, res) => {
    try {
      // --- CEK APPROVAL (WAJIB di awal & disinkronkan) ---
      const approved = await new Promise((resolve, reject) => {
        db.get(
          "SELECT is_approved FROM clients WHERE id=?",
          [req.client.id],
          (err, row) => (err ? reject(err) : resolve(!!row?.is_approved))
        );
      });
      if (!approved) {
        return res.status(403).json({
          error: "not_approved",
          message: "Akun Anda belum di-ACC Admin Verifier.",
        });
      }

      // --- VALIDASI BODY ---
      const {
        title,
        notes,
        product_type,
        material,
        width_cm,
        height_cm,
        quantity,
      } = req.body || {};
      if (!title?.trim())
        return res.status(400).json({ error: "Judul pesanan wajib" });

      // --- CEK VENDOR & MODE BAYAR ---
      const me = await new Promise((resolve, reject) => {
        db.get(
          `SELECT id, vendor_choice FROM clients WHERE id=?`,
          [req.client.id],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });
      const vendor = String(me?.vendor_choice || "none").toLowerCase();
      const isWhitelisted = await isVendorWhitelisted(vendor);
      const paymentRequired = !isWhitelisted;

      // --- HITUNG HARGA ---
      const calc = computeAmount(
        product_type,
        material,
        width_cm,
        height_cm,
        quantity,
        { ppn: 0 }
      );

      // --- FILES META ---
      const filesMeta = (req.files || []).map((f) => ({
        name: f.originalname,
        url: `/uploads/client-designs/${path.basename(f.path)}`,
        size: f.size,
        mime: f.mimetype,
      }));
      const designFilesJson = JSON.stringify(filesMeta);

      // --- PAYMENT META ---
      const tempUrl = paymentRequired
        ? `http://localhost:${PORT}/pay/temp`
        : null;
      const deadlineSql = paymentRequired
        ? "datetime('now','+1 hour')"
        : "NULL";

      // --- INSERT ORDER ---
      db.run(
        `INSERT INTO client_orders
          (client_id, title, notes, product_type, material,
           width_cm, height_cm, quantity,
           unit_price, pricing_basis, amount_subtotal, tax_ppn, amount_total,
           status, vendor_whitelisted, payment_required, payment_deadline, payment_url,
           design_files)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ${deadlineSql}, ?, ?)`,
        [
          req.client.id,
          title,
          notes || null,
          product_type || null,
          material || null,
          Number(width_cm) || 0,
          Number(height_cm) || 0,
          Math.max(1, Number(quantity) || 1),
          calc.unit_price,
          calc.pricing_basis,
          calc.subtotal,
          calc.tax,
          calc.total,
          isWhitelisted ? 1 : 0,
          paymentRequired ? 1 : 0,
          tempUrl,
          designFilesJson,
        ],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          const realPayUrl = paymentRequired
            ? `http://localhost:${PORT}/pay/${this.lastID}`
            : null;
          db.run(
            `UPDATE client_orders SET payment_url=? WHERE id=?`,
            [realPayUrl, this.lastID],
            (uErr) => {
              if (uErr) return res.status(500).json({ error: uErr.message });
              db.get(
                `SELECT id, client_id, title, notes, product_type, material, width_cm, height_cm, quantity,
                      unit_price, pricing_basis, amount_subtotal, tax_ppn, amount_total,
                      status, vendor_whitelisted, payment_required, payment_deadline, payment_url, paid_at, created_at,
                      design_files
               FROM client_orders WHERE id = ?`,
                [this.lastID],
                (e2, row) => {
                  if (e2) return res.status(500).json({ error: e2.message });
                  try {
                    row.design_files = JSON.parse(row.design_files || "[]");
                  } catch {}
                  res.json(row);
                }
              );
            }
          );
        }
      );
    } catch (e) {
      res.status(500).json({ error: String(e.message) });
    }
  }
);

// ====== Payment Webhook (mock untuk dev) ======
app.post("/api/payments/mock-paid", (req, res) => {
  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: "orderId required" });

  db.get(
    `SELECT status, vendor_whitelisted FROM client_orders WHERE id=?`,
    [orderId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "Not found" });

      // Non-vendor: bayar di awal → dari 'pending' menjadi 'verifikasi'
      if (row.status === "pending") {
        return db.run(
          `UPDATE client_orders
           SET status='verifikasi', paid_at=datetime('now')
         WHERE id=?`,
          [orderId],
          function (e2) {
            if (e2) return res.status(500).json({ error: e2.message });
            res.json({ updated: this.changes, mode: "upfront" });
          }
        );
      }

      // Whitelist: bayar setelah selesai → tetap 'done', hanya set paid_at
      db.run(
        `UPDATE client_orders SET paid_at=datetime('now') WHERE id=?`,
        [orderId],
        function (e3) {
          if (e3) return res.status(500).json({ error: e3.message });
          res.json({ updated: this.changes, mode: "postpaid" });
        }
      );
    }
  );
});

// Halaman bayar sederhana: http://localhost:4000/pay/:orderId
app.get("/pay/:orderId", (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!orderId) return res.status(400).send("Invalid order id");
  res.send(`
    <html>
      <head><meta charset="utf-8"><title>Bayar Pesanan #${orderId}</title></head>
      <body style="font-family:ui-sans-serif,system-ui;margin:40px;">
        <h2>Bayar Pesanan #${orderId}</h2>
        <p>Simulasi pembayaran untuk development.</p>
        <button id="pay" style="padding:10px 16px;border-radius:8px;background:#10b981;color:white;border:none;cursor:pointer">
          Bayar Sekarang
        </button>
        <script>
          document.getElementById('pay').onclick = async () => {
            const resp = await fetch('/api/payments/mock-paid', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: ${orderId} })
            });
            if (resp.ok) {
              alert('Pembayaran berhasil. Status akan menjadi verifikasi.');
              window.close();
            } else {
              alert('Gagal membayar.');
            }
          };
        </script>
      </body>
    </html>
  `);
});

// ====== Auto-cancel job (SATU SAJA) ======
// Cancel semua order pending yg lewat deadline & belum dibayar (handle 2 format datetime)
function runExpiryJob() {
  db.run(
    `UPDATE client_orders
     SET status = 'cancel'
     WHERE status = 'pending'
       AND payment_required = 1
       AND paid_at IS NULL
       AND payment_deadline IS NOT NULL
       AND (
         (instr(payment_deadline, 'T') = 0 AND datetime('now') > payment_deadline)
         OR (instr(payment_deadline, 'T') > 0 AND datetime('now') > replace(replace(payment_deadline,'T',' '),'Z',''))
       )`,
    (err) => {
      if (err) console.error("expiry job error:", err.message);
    }
  );
}
runExpiryJob();
setInterval(runExpiryJob, 30 * 1000);

/* ====== Customers & Invoices (ADAPTER ke data Client) ====== */

// List "customers" = dari tabel clients (hanya admin role: invoice)
app.get("/api/customers", authenticateAdmin("invoice"), (req, res) => {
  db.all(
    `SELECT id, full_name AS name, email, phone, '' as address, created_at
     FROM clients
     ORDER BY created_at DESC`,
    [],
    (err, rows) =>
      err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

// List "invoices" = dari client_orders + join clients
// List "invoices" = dari client_orders + join clients
app.get("/api/invoices", authenticateAdmin("invoice"), (req, res) => {
  db.all(
    `SELECT
       co.id,
       co.status                AS order_status,
       co.created_at            AS issue_date,
       co.payment_deadline      AS due_date,
       co.amount_total          AS total_amount,
       co.paid_at,                                   -- <== penting
       c.full_name              AS customer_name,
       c.email                  AS customer_email,
       c.phone                  AS customer_phone
     FROM client_orders co
     LEFT JOIN clients c ON c.id = co.client_id
     ORDER BY co.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const mapOrderStatus = (s) => {
        switch (String(s)) {
          case "approved":
          case "verifikasi":
          case "done":
            return "sent";
          case "cancel":
            return "cancelled";
          default:
            return "draft";
        }
      };

      const mapped = (rows || []).map((r) => {
        const invoice_status =
          String(r.order_status).toLowerCase() === "cancel"
            ? "cancel"
            : r.paid_at
            ? "paid"
            : "unpaid";

        return {
          id: r.id,
          invoice_number: `INV-${String(r.id).padStart(5, "0")}`,
          status: r.paid_at ? "paid" : mapOrderStatus(r.order_status),
          invoice_status, // "paid" | "unpaid" | "cancel"
          issue_date: r.issue_date,
          due_date: r.due_date,
          total_amount: Number(r.total_amount) || 0,
          customer: {
            name: r.customer_name,
            email: r.customer_email,
            phone: r.customer_phone,
          },
          items: [],
          subtotal: Number(r.total_amount) || 0,
          tax_rate: 0,
          tax_amount: 0,
        };
      });

      res.json(mapped);
    }
  );
});

// Detail invoice (ambil satu order)
app.get("/api/invoices/:id", authenticateAdmin("invoice"), (req, res) => {
  const id = Number(req.params.id);
  db.get(
    `SELECT
       co.id, co.status AS order_status, co.created_at AS issue_date,
       co.payment_deadline AS due_date, co.amount_total AS total_amount,
       co.title, co.notes, co.paid_at,                      -- <== penting
       c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
     FROM client_orders co
     LEFT JOIN clients c ON c.id = co.client_id
     WHERE co.id = ?`,
    [id],
    (err, r) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!r) return res.status(404).json({ error: "Invoice not found" });

      const mapOrderStatus = (s) => {
        switch (String(s)) {
          case "approved":
          case "verifikasi":
          case "done":
            return "sent";
          case "cancel":
            return "cancelled";
          default:
            return "draft";
        }
      };

      const items = [
        {
          description: r.title || "Pemesanan",
          quantity: 1,
          unit_price: Number(r.total_amount) || 0,
          total_price: Number(r.total_amount) || 0,
        },
      ];

      const invoice_status =
        String(r.order_status).toLowerCase() === "cancel"
          ? "cancel"
          : r.paid_at
          ? "paid"
          : "unpaid";

      res.json({
        id: r.id,
        invoice_number: `INV-${String(r.id).padStart(5, "0")}`,
        status: r.paid_at ? "paid" : mapOrderStatus(r.order_status),
        invoice_status, // ← TAMBAHKAN INI
        issue_date: r.issue_date,
        due_date: r.due_date,
        total_amount: Number(r.total_amount) || 0,
        subtotal: Number(r.total_amount) || 0,
        tax_rate: 0,
        tax_amount: 0,
        notes: r.notes || "",
        items,
        customer: {
          name: r.customer_name,
          email: r.customer_email,
          phone: r.customer_phone,
        },
      });
    }
  );
});

// Ubah status (map ke status di client_orders sebisanya)
app.patch(
  "/api/invoices/:id/status",
  authenticateAdmin("invoice"),
  (req, res) => {
    const id = Number(req.params.id);
    db.get(
      `SELECT status, paid_at FROM client_orders WHERE id=?`,
      [id],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "not found" });

        const isCanceled = String(row.status).toLowerCase() === "cancel";
        const isPaid = !!row.paid_at;

        if (isCanceled)
          return res
            .status(403)
            .json({ error: "locked: canceled invoice cannot be changed" });
        if (isPaid)
          return res
            .status(403)
            .json({ error: "locked: already paid (controlled by system)" });

        // unpaid juga dikontrol sistem (via pembayaran atau auto-cancel)
        return res
          .status(403)
          .json({ error: "locked: unpaid status is controlled by system" });
      }
    );
  }
);

// === Admin Invoice: Login khusus role "invoice" ===
app.post("/api/admin/invoice/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email & password wajib" });
  }

  db.get(
    `SELECT * FROM admins WHERE email=? AND role='invoice'`,
    [String(email).toLowerCase()],
    async (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(401).json({ error: "Invalid credentials" });

      const ok = await bcrypt.compare(password, row.password_hash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { admin: true, id: row.id, email: row.email, role: row.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        token,
        admin: {
          id: row.id,
          email: row.email,
          full_name: row.full_name,
          role: row.role,
        },
      });
    }
  );
});

// ====== Start ======
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

// Export the app for Vercel
module.exports = app;
