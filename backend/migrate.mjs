// migrate.mjs — run once to add new columns to existing SQLite DB
import Database from 'better-sqlite3';

const db = new Database('worknova.db');

const migrations = [
  `ALTER TABLE users ADD COLUMN portfolio_link TEXT`,
  `ALTER TABLE orders ADD COLUMN razorpay_order_id TEXT`,
];

for (const sql of migrations) {
  try {
    db.exec(sql);
    console.log('OK:', sql);
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      console.log('SKIP (already exists):', sql);
    } else {
      console.error('FAIL:', sql, e.message);
    }
  }
}

db.close();
console.log('Migration complete.');
