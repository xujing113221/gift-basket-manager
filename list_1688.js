const db = require('better-sqlite3')('inventory.db');
const rows = db.prepare("SELECT id, name, link, image FROM products WHERE link IS NOT NULL AND link LIKE '%1688%' ORDER BY id").all();
console.log(rows.length + ' products with 1688 links:');
rows.forEach(r => console.log(r.id + ' | ' + r.name + ' | img=' + (r.image||'NONE') + ' | ' + r.link.substring(0,80)));
