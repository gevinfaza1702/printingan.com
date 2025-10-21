const express = require("express");
const db = require("../db");
const router = express.Router();

/** DEV: tandai pesanan sebagai sudah dibayar */
router.post("/mock-paid", (req, res) => {
  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: "orderId required" });

  db.get(
    `SELECT status, vendor_whitelisted FROM client_orders WHERE id=?`,
    [orderId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "Not found" });

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

module.exports = router;
