// my-backend/src/routes/adminInvoice.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

/* ===== Middleware khusus role 'invoice' ===== */
function authenticateAdminInvoice(req, res, next) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.admin) throw new Error("not admin");
    if (payload.role !== "invoice") {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.admin = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* ===== Login admin invoice ===== */
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Email & password required" });

  db.get(
    `SELECT * FROM admins WHERE email=?`,
    [email.toLowerCase()],
    async (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row || row.role !== "invoice")
        return res.status(401).json({ error: "Invalid credentials" });

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

/* ===== Invoices (list) ===== */
// helper cuma buat nomor invoice "cantik"
const invNumberFor = (clientId, day) =>
  `INV-${day.replace(/-/g, "")}-${String(clientId).padStart(4, "0")}`;

router.get("/invoices", authenticateAdminInvoice, (req, res) => {
  const { group_by } = req.query || {};

  // === MODE TERKELOMPOK: per client per hari ===
  if (String(group_by) === "customer_day") {
    const sql = `
      SELECT
        co.client_id,
        c.full_name                    AS customer_name,
        DATE(co.created_at)            AS day,
        MIN(co.created_at)             AS issue_date,
        MAX(co.payment_deadline)       AS due_date,
        COUNT(*)                       AS order_count,
        SUM(co.amount_total)           AS total_amount,
        SUM(CASE WHEN co.paid_at IS NOT NULL THEN 1 ELSE 0 END)          AS paid_count,
        0 AS cancelled_count
      FROM client_orders co
      LEFT JOIN clients c ON c.id = co.client_id
      WHERE LOWER(co.status) <> 'cancel'
      GROUP BY co.client_id, DATE(co.created_at)
      ORDER BY day DESC, issue_date DESC
    `;
    return db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const mapped = rows.map((r) => {
        const allCancelled =
          Number(r.cancelled_count) === Number(r.order_count);
        const allPaid =
          Number(r.paid_count) === Number(r.order_count) && r.order_count > 0;
        const invoice_status = allCancelled
          ? "cancel"
          : allPaid
          ? "paid"
          : "unpaid";
        return {
          // ID virtual untuk routing FE
          virtual_id: `${r.client_id}-${r.day}`, // contoh: "12-2025-08-15"
          client_id: r.client_id,
          day: r.day,

          invoice_number: invNumberFor(r.client_id, r.day),
          customer: { name: r.customer_name || "" },
          issue_date: r.issue_date,
          due_date: r.due_date,
          total_amount: Number(r.total_amount) || 0,
          order_count: Number(r.order_count) || 0,
          paid_count: Number(r.paid_count) || 0,
          cancelled_count: Number(r.cancelled_count) || 0,
          invoice_status,
        };
      });
      res.json(mapped);
    });
  }

  // === MODE LAMA: satu invoice = satu order ===
  db.all(
    `SELECT
       co.id,
       co.status                AS order_status,
       co.created_at            AS issue_date,
       co.payment_deadline      AS due_date,
       co.amount_total          AS total_amount,
       co.paid_at,
       c.full_name              AS customer_name
     FROM client_orders co
     LEFT JOIN clients c ON c.id = co.client_id
     WHERE LOWER(co.status) <> 'cancel'
     ORDER BY co.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const mapped = rows.map((r) => ({
        id: r.id,
        invoice_number: `INV-${String(r.id).padStart(5, "0")}`,
        customer: { name: r.customer_name || "" },
        issue_date: r.issue_date,
        due_date: r.due_date,
        total_amount: Number(r.total_amount) || 0,
        paid_at: r.paid_at,
        order_status: r.order_status,
        invoice_status:
          r.order_status === "cancel"
            ? "cancel"
            : r.paid_at
            ? "paid"
            : "unpaid",
      }));

      res.json(mapped);
    }
  );
});

// GET /api/admin/invoice/invoices/grouped/:clientId/:day  (day = YYYY-MM-DD)
router.get(
  "/invoices/grouped/:clientId/:day",
  authenticateAdminInvoice,
  (req, res) => {
    const clientId = Number(req.params.clientId);
    const day = String(req.params.day);

    if (!clientId || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return res.status(400).json({ error: "bad params" });
    }

    const headerSQL = `SELECT full_name AS name, email, phone FROM clients WHERE id=?`;
    const rowsSQL = `
    SELECT id, title, amount_total, status, paid_at, created_at, payment_deadline
    FROM client_orders
    WHERE client_id=? AND DATE(created_at)=? AND LOWER(status) <> 'cancel'
    ORDER BY datetime(created_at) ASC, id ASC
  `;

    db.get(headerSQL, [clientId], (e1, cust) => {
      if (e1) return res.status(500).json({ error: e1.message });
      db.all(rowsSQL, [clientId, day], (e2, items) => {
        if (e2) return res.status(500).json({ error: e2.message });
        if (!items?.length) return res.status(404).json({ error: "not found" });

        const issue_date = items[0].created_at;
        const due_date = items.reduce(
          (acc, r) => acc || r.payment_deadline || acc,
          null
        );
        const subtotal = items.reduce(
          (s, it) => s + (Number(it.amount_total) || 0),
          0
        );

        const paidCount = items.filter((i) => i.paid_at).length;
        const cancelledCount = items.filter(
          (i) => String(i.status).toLowerCase() === "cancel"
        ).length;
        const allCancelled = cancelledCount === items.length;
        const allPaid = paidCount === items.length && items.length > 0;
        const invoice_status = allCancelled
          ? "cancel"
          : allPaid
          ? "paid"
          : "unpaid";

        res.json({
          virtual_id: `${clientId}-${day}`,
          client_id: clientId,
          day,
          invoice_number: `INV-${day.replace(/-/g, "")}-${String(
            clientId
          ).padStart(4, "0")}`,
          customer: {
            name: cust?.name || "",
            email: cust?.email || null,
            phone: cust?.phone || null,
          },
          issue_date,
          due_date,
          items: items.map((r) => ({
            order_id: r.id,
            description: r.title || "Pemesanan",
            quantity: 1,
            unit_price: Number(r.amount_total) || 0,
            total_price: Number(r.amount_total) || 0,
            status: r.status,
            paid_at: r.paid_at,
          })),
          subtotal,
          tax_rate: 0,
          tax_amount: 0,
          total_amount: subtotal,
          invoice_status,
        });
      });
    });
  }
);

/* ===== Update status invoice (paid|unpaid|cancel) ===== */
router.patch("/invoices/:id/status", authenticateAdminInvoice, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!["paid", "unpaid", "cancel"].includes(status)) {
    return res.status(400).json({ error: "invalid status" });
  }

  db.get(
    "SELECT status, paid_at FROM client_orders WHERE id = ?",
    [id],
    (err, o) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!o) return res.status(404).json({ error: "not found" });

      // sudah cancel → kunci
      if (o.status === "cancel") {
        return res
          .status(400)
          .json({ error: "invoice already canceled (locked)" });
      }

      let sql, params;
      if (status === "cancel") {
        sql = `UPDATE client_orders SET status='cancel', paid_at=NULL WHERE id=?`;
        params = [id];
      } else if (status === "paid") {
        sql = `UPDATE client_orders SET paid_at=COALESCE(paid_at, datetime('now')) WHERE id=?`;
        params = [id];
      } else {
        // unpaid
        sql = `UPDATE client_orders SET paid_at=NULL WHERE id=?`;
        params = [id];
      }

      db.run(sql, params, function (e1) {
        if (e1) return res.status(500).json({ error: e1.message });

        // kembalikan baris terkini agar FE bisa langsung refresh 1 kartu
        db.get(
          `SELECT co.*, c.full_name AS client_name
             FROM client_orders co
             LEFT JOIN clients c ON c.id = co.client_id
            WHERE co.id = ?`,
          [id],
          (e2, row) => {
            if (e2) return res.status(500).json({ error: e2.message });
            if (!row) return res.status(404).json({ error: "not found" });

            const invoice_status =
              row.status === "cancel"
                ? "cancel"
                : row.paid_at
                ? "paid"
                : "unpaid";

            res.json({
              id: row.id,
              invoice_number: `INV-${String(row.id).padStart(5, "0")}`,
              customer: { name: row.client_name || "" },
              issue_date: row.created_at,
              due_date: row.payment_deadline,
              total_amount: Number(row.amount_total) || 0,
              paid_at: row.paid_at,
              order_status: row.status,
              invoice_status,
            });
          }
        );
      });
    }
  );
});

/* ===== Customers (pakai tabel clients; role: invoice) ===== */

// List customers (ambil dari clients). ?include_deleted=1 untuk tampilkan soft-delete
router.get("/customers", authenticateAdminInvoice, (req, res) => {
  const includeDeleted = String(req.query.include_deleted || "0") === "1";
  const where = includeDeleted ? "" : "WHERE deleted_at IS NULL";
  db.all(
    `
    SELECT id, full_name AS name, email, phone, created_at, deleted_at
    FROM clients
    ${where}
    ORDER BY created_at DESC
    `,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      // FE kamu expect field address -> kirim null
      res.json({ customers: rows.map((r) => ({ ...r, address: null })) });
    }
  );
});

// Create customer -> buat baris di clients (vendor none, password sementara)
router.post("/customers", authenticateAdminInvoice, async (req, res) => {
  try {
    const { name, email, phone, address } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "Nama wajib" });
    if (!email?.trim()) return res.status(400).json({ error: "Email wajib" });

    const tempPassword = Math.random().toString(36).slice(2, 10);
    const hash = await bcrypt.hash(tempPassword, 10);

    db.run(
      `INSERT INTO clients (full_name, email, phone, vendor_choice, vendor_other, password_hash, is_approved)
       VALUES (?, ?, ?, 'none', NULL, ?, 0)`,
      [name, email.toLowerCase(), phone || null, hash],
      function (err) {
        if (err) {
          if (String(err.message || "").includes("UNIQUE")) {
            return res.status(409).json({ error: "Email sudah terdaftar" });
          }
          return res.status(500).json({ error: err.message });
        }
        res.json({
          id: this.lastID,
          name,
          email: email.toLowerCase(),
          phone: phone || null,
          address: address || null,
          created_at: new Date().toISOString(),
          deleted_at: null,
        });
      }
    );
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Update nama/email/phone
router.put("/customers/:id", authenticateAdminInvoice, (req, res) => {
  const id = Number(req.params.id);
  const { name, email, phone, address } = req.body || {};
  if (!id) return res.status(400).json({ error: "Bad id" });

  db.run(
    `UPDATE clients
       SET full_name = COALESCE(?, full_name),
           email     = COALESCE(?, email),
           phone     = COALESCE(?, phone)
     WHERE id = ?`,
    [name || null, email ? email.toLowerCase() : null, phone || null, id],
    function (err) {
      if (err) {
        if (String(err.message || "").includes("UNIQUE")) {
          return res.status(409).json({ error: "Email sudah terpakai" });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ updated: this.changes });
    }
  );
});

// Delete: soft default (?hard=1 untuk hard)
router.delete("/customers/:id", authenticateAdminInvoice, (req, res) => {
  const id = Number(req.params.id);
  const hard = String(req.query.hard || "0") === "1";
  if (!id) return res.status(400).json({ error: "Bad id" });

  if (hard) {
    // hapus semua order + client (tanpa syarat)
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
            return res.json({ deleted: true, mode: "hard" });
          });
        }
      );
    });
    return;
  }

  // soft: tolak jika masih ada order aktif
  db.get(
    `SELECT SUM(CASE WHEN status IN ('pending','verifikasi','approved') THEN 1 ELSE 0 END) AS active_refs
     FROM client_orders WHERE client_id=?`,
    [id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (Number(row?.active_refs || 0) > 0) {
        return res.status(409).json({
          error: "Tidak bisa hapus: client masih punya order aktif",
          refs: Number(row.active_refs) || 0,
        });
      }
      db.run(
        `UPDATE clients SET deleted_at = datetime('now') WHERE id=? AND deleted_at IS NULL`,
        [id],
        function (e2) {
          if (e2) return res.status(500).json({ error: e2.message });
          if (this.changes === 0)
            return res
              .status(404)
              .json({ error: "not_found_or_already_deleted" });
          return res.json({ deleted: true, mode: "soft" });
        }
      );
    }
  );
});

// Restore soft-deleted
router.patch("/customers/:id/restore", authenticateAdminInvoice, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Bad id" });
  db.run(
    `UPDATE clients SET deleted_at = NULL WHERE id=?`,
    [id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res.status(404).json({ error: "not_found" });
      res.json({ restored: true });
    }
  );
});

module.exports = router;
