const db = require('better-sqlite3')('inventory.db');

db.exec(`CREATE TABLE IF NOT EXISTS supplier_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  platform TEXT NOT NULL,
  supplier_name TEXT,
  unit_price REAL,
  min_order INTEGER,
  shipping REAL DEFAULT 0,
  link TEXT,
  is_preferred INTEGER DEFAULT 0,
  notes TEXT,
  updated_at TEXT DEFAULT (datetime('now','localtime'))
)`);

db.exec(`ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 5`);
db.exec(`ALTER TABLE products ADD COLUMN tags TEXT`);
db.exec(`ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'active'`);
db.exec(`ALTER TABLE products ADD COLUMN last_purchased_at TEXT`);

// 迁移现有数据：为有 link 的商品创建默认 supplier_quote
const products = db.prepare("SELECT id, name, link, source, unit_price FROM products WHERE link IS NOT NULL AND link != ''").all();
const insert = db.prepare("INSERT OR IGNORE INTO supplier_quotes (product_id, platform, unit_price, link, is_preferred) VALUES (?,?,?,?,1)");
let count = 0;
for (const p of products) {
  const result = insert.run(p.id, p.source || '1688', p.unit_price, p.link);
  if (result.changes > 0) count++;
}
console.log('Migration done:', count, 'quotes created from', products.length, 'linked products');
db.close();
