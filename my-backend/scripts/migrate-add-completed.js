// my-backend/scripts/migrate-add-completed.js
const db = require("../src/db");

db.all(`PRAGMA table_info('client_orders')`, (err, cols) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  const names = cols.map((c) => c.name);

  const queries = [];
  if (!names.includes("completed_at")) {
    queries.push(`ALTER TABLE client_orders ADD COLUMN completed_at TEXT`);
  }
  if (!names.includes("completed_by")) {
    queries.push(`ALTER TABLE client_orders ADD COLUMN completed_by INTEGER`);
  }

  if (queries.length === 0) {
    console.log("Nothing to migrate. Columns already exist.");
    return db.close();
  }

  db.serialize(() => {
    queries.forEach((q) =>
      db.run(q, (e) => e && console.warn("WARN:", e.message))
    );
  });

  db.close(() => console.log("Migration done."));
});
