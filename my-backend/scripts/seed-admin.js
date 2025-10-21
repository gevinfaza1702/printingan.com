// my-backend/scripts/seed-admin.js
const bcrypt = require("bcryptjs");
const db = require("../src/db"); // sesuaikan path kalau berbeda

async function seed(email, full_name, role, password) {
  const hash = await bcrypt.hash(password, 10);
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR IGNORE INTO admins (email, full_name, role, password_hash)
       VALUES (?, ?, ?, ?)`,
      [email.toLowerCase(), full_name, role, hash],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      }
    );
  });
}

(async () => {
  try {
    await seed(
      "verifier@admin.com",
      "Admin Verifikasi",
      "verifier",
      "admin123"
    );
    await seed("invoice@admin.com", "Admin Invoice", "invoice", "admin123");
    console.log("OK: admin seeded");
    process.exit(0);
  } catch (e) {
    console.error("Seed error:", e);
    process.exit(1);
  }
})();
