// ============================================================
// GiftBasket Manager — 伴手礼管理后台
// Express + better-sqlite3 全栈应用
// ============================================================

const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'inventory.db');
const IMAGES_DIR = path.join(__dirname, 'public', 'images');

// ─── 中间件 ───────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── 数据库初始化 ──────────────────────────────────────────────
let db;

function initDatabase() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createTables();
  seedIfEmpty();
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      category      TEXT NOT NULL CHECK(category IN ('盒子','辅料','糖果','单品')),
      subcategory   TEXT,
      unit_price    REAL NOT NULL DEFAULT 0,
      unit          TEXT DEFAULT '个',
      source        TEXT,
      link          TEXT,
      image         TEXT,
      box_length    REAL,
      box_width     REAL,
      box_height    REAL,
      stock         INTEGER DEFAULT 0,
      total_cost    REAL DEFAULT 0,
      notes         TEXT,
      created_at    TEXT DEFAULT (datetime('now','localtime')),
      updated_at    TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

    CREATE TABLE IF NOT EXISTS bundles (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      box_type      TEXT,
      box_id        INTEGER,
      total_cost    REAL DEFAULT 0,
      sell_price    REAL DEFAULT 0,
      margin_rate   REAL DEFAULT 70,
      margin_amount REAL DEFAULT 0,
      status        TEXT DEFAULT '草稿' CHECK(status IN ('草稿','已发布','下架')),
      notes         TEXT,
      created_at    TEXT DEFAULT (datetime('now','localtime')),
      updated_at    TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (box_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS bundle_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      bundle_id   INTEGER NOT NULL,
      product_id  INTEGER NOT NULL,
      quantity    INTEGER NOT NULL DEFAULT 1,
      unit_price  REAL NOT NULL,
      subtotal    REAL GENERATED ALWAYS AS (quantity * unit_price) STORED,
      FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS competitors (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      sell_price    REAL DEFAULT 0,
      member_price  REAL DEFAULT 0,
      box_desc      TEXT,
      box_size      TEXT,
      item_summary  TEXT,
      notes         TEXT,
      created_at    TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS competitor_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id INTEGER NOT NULL,
      item_name     TEXT NOT NULL,
      spec          TEXT,
      quantity      INTEGER DEFAULT 1,
      FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ops_checklist (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      task        TEXT NOT NULL,
      platform    TEXT,
      priority    INTEGER DEFAULT 0,
      done        INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
}

// ─── 种子数据 ─────────────────────────────────────────────────

const SEED_PRODUCTS = [
  // ===== 盒子 (22种) =====
  { name: '竹篮中号', category: '盒子', subcategory: '编织篮', unit_price: 9.50, source: '1688', link: 'https://qr.1688.com/s/4RMLygY6', box_length: 20, box_width: 20, box_height: 30 , image: 'product_竹篮中号.png'},
  { name: '环扣手拎包', category: '盒子', subcategory: '手提包', unit_price: 8.10, source: '1688', link: 'https://qr.1688.com/s/6FsO3Asd', box_length: 30, box_width: 16 , image: 'product_环扣手拎包.jpg'},
  { name: '拉链手拎包', category: '盒子', subcategory: '手提包', unit_price: 5.20, source: '1688', link: 'https://qr.1688.com/s/KsMRNdN7', box_length: 20, box_width: 10, box_height: 21 , image: 'product_拉链手拎包.jpg'},
  { name: '化妆包手拎(大号)', category: '盒子', subcategory: '化妆包', unit_price: 10.50, source: '1688', link: 'https://qr.1688.com/s/WAjAzvzc' , image: 'product_化妆包手拎大号.jpg'},
  { name: 'PVC透明手提袋(小)', category: '盒子', subcategory: '透明袋', unit_price: 1.10, source: '拼多多', link: 'https://mobile.yangkeduo.com/goods1.html?ps=dQvEGcB8s7', box_length: 15, box_width: 13.5, box_height: 7 , image: 'product_PVC透明手提袋小.png'},
  { name: 'PVC透明礼品袋(大)', category: '盒子', subcategory: '透明袋', unit_price: 0.68, source: '拼多多', link: 'https://mobile.yangkeduo.com/goods.html?ps=m10CrG1wdk', box_length: 16, box_width: 15, box_height: 7 , image: 'product_PVC透明礼品袋大.png'},
  { name: '蛋糕盒子', category: '盒子', subcategory: '蛋糕盒', unit_price: 0.38, source: '拼多多', link: 'https://mobile.yangkeduo.com/goods2.html?ps=6M9wwOjWLe', box_length: 6 , image: 'product_蛋糕盒子.png'},
  { name: '喜糖袋子中号', category: '盒子', subcategory: '喜糖袋', unit_price: 1.10, source: '拼多多', link: 'https://mobile.yangkeduo.com/goods.html?ps=qGVoY4DtJ8', box_length: 16, box_width: 16 , image: 'product_喜糖袋子中号.png'},
  { name: '烫银盒子', category: '盒子', subcategory: '礼盒', unit_price: 0.58, source: '拼多多', link: 'https://mobile.yangkeduo.com/goods2.html?ps=BxVjU7fFnL', box_length: 13, box_width: 7, box_height: 6.5 , image: 'product_烫银盒子.png'},
  { name: '白色方形盒子', category: '盒子', subcategory: '礼盒', unit_price: 6.84, source: '拼多多', link: 'https://mobile.yangkeduo.com/goods.html?ps=FPpDgYTbFX', box_length: 20, box_width: 18, box_height: 8 , image: 'product_白色方形盒子.png'},
  { name: '白色圆形盒子', category: '盒子', subcategory: '礼盒', unit_price: 4.67, source: '拼多多', link: 'https://mobile.yangkeduo.com/goods2.html?ps=J46wPgWvo3', box_length: 16, box_height: 7 , image: 'product_白色圆形盒子.png'},
  { name: '红色圆形盒子', category: '盒子', subcategory: '礼盒', unit_price: 6.90, source: '1688', link: 'https://qr.1688.com/s/hWDE3WEF', box_length: 19, box_width: 19, box_height: 11 , image: 'product_红色圆形盒子.png'},
  { name: '粉色圆形盒子', category: '盒子', subcategory: '礼盒', unit_price: 7.50 },
  { name: '信封式长方包装盒', category: '盒子', subcategory: '包装盒', unit_price: 0.55, source: '1688', link: 'https://qr.1688.com/s/3GjzYfYa', box_length: 19.5, box_width: 12.5 , image: 'product_信封式长方包装盒.png'},
  { name: '茶叶式长方包装盒(原木色)', category: '盒子', subcategory: '包装盒', unit_price: 1.30, source: '1688', link: 'https://qr.1688.com/s/MPbAtfJN', box_length: 18, box_width: 12, box_height: 5 , image: 'product_茶叶式长方包装盒原木色.png'},
  { name: '上下盖长方包装盒(白色)', category: '盒子', subcategory: '包装盒', unit_price: 0.63, source: '1688', link: 'https://qr.1688.com/s/t4tHQTHW', box_length: 17, box_width: 9, box_height: 3.8 , image: 'product_上下盖长方包装盒白色.png'},
  { name: '糖果礼盒', category: '盒子', subcategory: '礼盒', unit_price: 1.50, source: '拼多多', link: 'https://mobile.yangkeduo.com/goods.html?ps=RV5riTaOra', box_length: 20, box_width: 12, box_height: 16 , image: 'product_糖果礼盒.jpg'},
  { name: '喜糖沙袋中号', category: '盒子', subcategory: '喜糖袋', unit_price: 0.32, source: '拼多多', link: 'https://mobile.yangkeduo.com/goods.html?ps=NHED3LEeMD' , image: 'product_喜糖沙袋中号.jpg'},
  { name: '牛皮纸袋', category: '盒子', subcategory: '纸袋', unit_price: 0.00 },
  { name: '针织包', category: '盒子', subcategory: '包装', unit_price: 0.00 },
  { name: '纸盒子椭圆', category: '盒子', subcategory: '包装盒', unit_price: 0.00 },
  { name: '快递费', category: '盒子', subcategory: '物流', unit_price: 1.30, unit: '次' },

  // ===== 辅料 (15种) =====
  { name: '雪梨纸', category: '辅料', unit_price: 0.20, unit: '张', source: '1688' , image: 'product_雪梨纸.jpg'},
  { name: '丝带', category: '辅料', unit_price: 0.50, source: '1688' },
  { name: '拉菲草', category: '辅料', unit_price: 9.25, unit: '斤', source: '拼多多' , image: 'product_拉菲草.jpg'},
  { name: '风吕敷-花', category: '辅料', unit_price: 0.54, source: '拼多多' , image: 'product_风吕敷-花.jpg'},
  { name: '盒子包装敷布', category: '辅料', unit_price: 2.25, source: '1688' , image: 'product_盒子包装敷布.jpg'},
  { name: '卡片', category: '辅料', unit_price: 0.30 },
  { name: '干花多头小玫瑰', category: '辅料', unit_price: 0.40, source: '拼多多' , image: 'product_干花多头小玫瑰.jpg'},
  { name: '火漆蜡封口', category: '辅料', unit_price: 0.44, source: '拼多多' , image: 'product_火漆蜡封口.jpg'},
  { name: '中国结挂件流苏', category: '辅料', unit_price: 0.52, source: '拼多多' , image: 'product_中国结挂件流苏.jpg'},
  { name: '石纹包装纸-细纹', category: '辅料', unit_price: 1.20, unit: '张', source: '1688' , image: 'product_石纹包装纸-细纹.jpg'},
  { name: '小喜字贴纸', category: '辅料', unit_price: 0.20, source: '拼多多' , image: 'product_小喜字贴纸.jpg'},
  { name: '礼盒封口贴纸', category: '辅料', unit_price: 0.13, source: '拼多多' , image: 'product_礼盒封口贴纸.jpg'},
  { name: '绳子100米', category: '辅料', unit_price: 3.00, source: '拼多多' , image: 'product_绳子100米.jpg'},
  { name: '麻绳300米', category: '辅料', unit_price: 20.00, source: '拼多多' , image: 'product_麻绳300米.jpg'},
  { name: 'DIY编织线', category: '辅料', unit_price: 18.80, source: '拼多多' , image: 'product_DIY编织线.jpg'},

  // ===== 糖果 (13种) =====
  { name: '葡萄果汁软糖', category: '糖果', unit_price: 0.66 , image: 'product_葡萄果汁软糖.jpg'},
  { name: '福袋软糖', category: '糖果', unit_price: 0.40 , image: 'product_福袋软糖.jpg'},
  { name: '不二家棒棒糖', category: '糖果', unit_price: 0.60 , image: 'product_不二家棒棒糖.jpg'},
  { name: '俄罗斯紫皮糖', category: '糖果', unit_price: 0.40 , image: 'product_俄罗斯紫皮糖.jpg'},
  { name: '旺仔牛奶糖', category: '糖果', unit_price: 0.25 , image: 'product_旺仔牛奶糖.jpg'},
  { name: '星球杯巧克力', category: '糖果', unit_price: 0.76 , image: 'product_星球杯巧克力.jpg'},
  { name: '喜事花生脆', category: '糖果', unit_price: 0.31 , image: 'product_喜事花生脆.jpg'},
  { name: '薯愿薯片', category: '糖果', unit_price: 1.33 , image: 'product_薯愿薯片.jpg'},
  { name: '红枣香酥脆', category: '糖果', unit_price: 0.50 , image: 'product_红枣香酥脆.jpg'},
  { name: '恰恰瓜子', category: '糖果', unit_price: 0.56 , image: 'product_恰恰瓜子.jpg'},
  { name: '喜之郎果冻', category: '糖果', unit_price: 1.30 , image: 'product_喜之郎果冻.png'},
  { name: '徐福记酥糖', category: '糖果', unit_price: 0.30 , image: 'product_徐福记酥糖.jpg'},
  { name: '马大姐酥糖', category: '糖果', unit_price: 0.30 , image: 'product_马大姐酥糖.jpg'},

  // ===== 单品 (21种) =====
  { name: '遮光睡眠眼罩', category: '单品', unit_price: 2.20, source: '1688' , image: 'product_遮光睡眠眼罩.jpg'},
  { name: '保温杯', category: '单品', unit_price: 7.80, source: '1688' , image: 'product_保温杯.jpg'},
  { name: '润护手霜', category: '单品', unit_price: 0.45, source: '1688' , image: 'product_润护手霜.jpg'},
  { name: '艾草锤养身锤', category: '单品', unit_price: 1.50 },
  { name: '五齿粉色经络按摩梳', category: '单品', unit_price: 1.18, source: '1688' , image: 'product_五齿粉色经络按摩梳.jpg'},
  { name: '珍珠+爱心吊坠手串', category: '单品', unit_price: 2.00 },
  { name: '马克杯子', category: '单品', unit_price: 6.80, source: '1688' , image: 'product_马克杯子.jpg'},
  { name: '毛巾', category: '单品', unit_price: 0.89, source: '拼多多' , image: 'product_毛巾.jpg'},
  { name: '茶包-小盒', category: '单品', unit_price: 2.50, source: '1688' , image: 'product_茶包-小盒.jpg'},
  { name: '小罐茶大红袍', category: '单品', unit_price: 1.10, source: '拼多多' , image: 'product_小罐茶大红袍.png'},
  { name: '香皂香薰', category: '单品', unit_price: 5.50, source: '1688' , image: 'product_香皂香薰.jpg'},
  { name: '迷你小梳子', category: '单品', unit_price: 1.70, source: '1688' , image: 'product_迷你小梳子.jpg'},
  { name: '钥匙扣', category: '单品', unit_price: 1.90, source: '1688' , image: 'product_钥匙扣.jpg'},
  { name: '试管花茶', category: '单品', unit_price: 1.83, source: '拼多多' , image: 'product_试管花茶.jpg'},
  { name: '网红许愿兔', category: '单品', unit_price: 2.00, source: '拼多多' , image: 'product_网红许愿兔.jpg'},
  { name: '毛线仿真小花束', category: '单品', unit_price: 3.20, source: '1688' , image: 'product_毛线仿真小花束.jpg'},
  { name: '梅见小瓶酒', category: '单品', unit_price: 5.00 },
  { name: '香薰', category: '单品', unit_price: 3.00 },
  { name: '润唇膏', category: '单品', unit_price: 2.00 },
  { name: '山茶花香薰片', category: '单品', unit_price: 1.50 },
  { name: '风扇', category: '单品', unit_price: 3.00 },
];

// ─── 方案种子数据 ─────────────────────────────────────────────
// 需要 product_id 引用，在 seedIfEmpty 中通过名称查找

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  if (count > 0) return; // 已有数据，跳过

  const insertProduct = db.prepare(
    `INSERT INTO products (name, category, subcategory, unit_price, unit, source, link, image, box_length, box_width, box_height)
     VALUES (@name, @category, @subcategory, @unit_price, @unit, @source, @link, @image, @box_length, @box_width, @box_height)`
  );

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insertProduct.run({
        name: item.name,
        category: item.category,
        subcategory: item.subcategory || null,
        unit_price: item.unit_price,
        unit: item.unit || '个',
        source: item.source || null,
        link: item.link || null,
        image: item.image || null,
        box_length: item.box_length || null,
        box_width: item.box_width || null,
        box_height: item.box_height || null,
      });
    }
  });

  insertMany(SEED_PRODUCTS);

  // ── 创建自研方案 ──
  function findProductId(name) {
    const p = db.prepare('SELECT id FROM products WHERE name = ?').get(name);
    return p ? p.id : null;
  }

  // 方案1: 竹篮伴手礼
  const b1 = db.prepare(`INSERT INTO bundles (name, box_type, box_id, total_cost, sell_price, margin_rate, margin_amount, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, '已发布')`).run(
    '竹篮伴手礼', '竹篮中号 20-20-30', findProductId('竹篮中号'), 29.39, 49.96, 70, 20.57
  );
  const b1Id = b1.lastInsertRowid;
  const b1Items = [
    ['竹篮中号', 1, 9.50], ['快递费', 1, 1.30], ['遮光睡眠眼罩', 1, 2.20],
    ['马克杯子', 1, 9.80], ['毛巾', 1, 0.89], ['雪梨纸', 1, 0.20],
    ['不二家棒棒糖', 1, 0.60], ['福袋软糖', 1, 0.40], ['俄罗斯紫皮糖', 2, 0.40],
    ['旺仔牛奶糖', 5, 0.25], ['喜事花生脆', 1, 0.31], ['喜之郎果冻', 1, 1.30],
    ['中国结挂件流苏', 1, 0.52],
  ];
  for (const [name, qty, price] of b1Items) {
    const pid = findProductId(name);
    if (pid) {
      db.prepare('INSERT INTO bundle_items (bundle_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(b1Id, pid, qty, price);
    }
  }

  // 方案2: PVC透明手提袋
  const b2 = db.prepare(`INSERT INTO bundles (name, box_type, box_id, total_cost, sell_price, margin_rate, margin_amount, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, '已发布')`).run(
    'PVC透明手提袋', 'PVC透明礼品袋(大) 16-15-7', findProductId('PVC透明礼品袋(大)'), 9.78, 17.00, 73.8, 7.22
  );
  const b2Id = b2.lastInsertRowid;
  const b2Items = [
    ['PVC透明礼品袋(大)', 1, 0.68], ['润护手霜', 1, 0.45], ['茶包-小盒', 1, 2.50],
    ['毛巾', 1, 0.89], ['不二家棒棒糖', 1, 0.60], ['福袋软糖', 1, 0.40],
    ['俄罗斯紫皮糖', 2, 0.40], ['旺仔牛奶糖', 5, 0.25], ['喜事花生脆', 1, 0.31],
    ['徐福记酥糖', 1, 0.30], ['马大姐酥糖', 1, 0.30], ['喜之郎果冻', 1, 1.30],
  ];
  for (const [name, qty, price] of b2Items) {
    const pid = findProductId(name);
    if (pid) {
      db.prepare('INSERT INTO bundle_items (bundle_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(b2Id, pid, qty, price);
    }
  }

  // 方案3: 磨砂透明手提袋
  const b3 = db.prepare(`INSERT INTO bundles (name, box_type, box_id, total_cost, sell_price, margin_rate, margin_amount, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, '已发布')`).run(
    '磨砂透明手提袋', 'PVC透明手提袋(小) 15-13.5-7', findProductId('PVC透明手提袋(小)'), 9.60, 17.00, 77.1, 7.40
  );
  const b3Id = b3.lastInsertRowid;
  const b3Items = [
    ['PVC透明手提袋(小)', 1, 1.10], ['毛巾', 1, 0.89], ['不二家棒棒糖', 1, 0.60],
    ['恰恰瓜子', 1, 0.56], ['俄罗斯紫皮糖', 2, 0.40], ['旺仔牛奶糖', 5, 0.25],
    ['茶包-小盒', 1, 2.50], ['徐福记酥糖', 1, 0.30], ['马大姐酥糖', 1, 0.30],
    ['喜之郎果冻', 1, 1.30],
  ];
  for (const [name, qty, price] of b3Items) {
    const pid = findProductId(name);
    if (pid) {
      db.prepare('INSERT INTO bundle_items (bundle_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(b3Id, pid, qty, price);
    }
  }

  // ── 竞品方案 ──
  const competitorData = [
    {
      name: '木盒粉色樱花护士节', sell_price: 123.16, member_price: 61.58,
      box_desc: '复古抽拉盖深色木质木盒', box_size: '20*20*10',
      items: [{ item_name: '落樱Y3直筒保温杯200ml', spec: '粉色' }, { item_name: '玩偶', spec: '粉色樱花' }, { item_name: '日式樱花瓷碗套装' }, { item_name: '手机支架', spec: '粉色樱花' }, { item_name: '梳子镜子礼盒套装', spec: '粉色' }, { item_name: '护手霜', spec: '30g*2' }, { item_name: '樱花钥扣' }, { item_name: '香皂花', spec: '粉色樱花' }, { item_name: '粉色樱花丝带' }]
    },
    {
      name: '原木紫罗兰护士节', sell_price: 93.16, member_price: 46.58,
      box_desc: '复古抽拉盖深色木质木盒', box_size: '20*20*10',
      items: [{ item_name: '落樱紫罗兰直筒保温杯200ml' }, { item_name: '肥皂花', spec: '紫罗兰' }, { item_name: '玩偶', spec: '紫罗兰' }, { item_name: '紫罗兰护手霜' }, { item_name: '紫罗兰丝带' }]
    },
    {
      name: '花漾紫葡萄皂女神节年会', sell_price: 85.16, member_price: 42.58,
      box_desc: '木盒', box_size: '18*18*8',
      items: [{ item_name: '紫葡萄皂' }, { item_name: '玩偶', spec: '紫色系' }, { item_name: '紫葡萄护手霜' }, { item_name: '紫葡萄钥扣' }, { item_name: '粉紫色丝带' }]
    },
    {
      name: '蝴蝶花香母亲节', sell_price: 73.16, member_price: 36.58,
      box_desc: '白色皮质盒子', box_size: '20*18*8',
      items: [{ item_name: '护手霜套装' }, { item_name: '康乃馨' }, { item_name: '贺卡' }, { item_name: '梳子' }, { item_name: '玩偶' }]
    },
    {
      name: '马卡龙绿色护士节', sell_price: 59.58, member_price: 29.79,
      box_desc: '便携收纳包', box_size: '',
      items: [{ item_name: '马卡龙绿色保温杯' }, { item_name: '马卡龙绿色玩偶' }, { item_name: '马卡龙绿色护手霜' }, { item_name: '马卡龙绿色钥匙扣' }]
    },
    {
      name: '绿野仙踪护士节', sell_price: 37.16, member_price: 18.58,
      box_desc: '白色皮质盒子', box_size: '20*18*8',
      items: [{ item_name: '绿野仙踪护手霜' }, { item_name: '绿色玩偶' }, { item_name: '绿色丝带' }]
    },
    {
      name: '会员专享-妈妈碎碎念腰封', sell_price: 9.90, member_price: null,
      box_desc: '腰封', box_size: '8*72',
      items: [{ item_name: '腰封' }, { item_name: '卡片' }]
    }
  ];

  const insertCompetitor = db.prepare(
    `INSERT INTO competitors (name, sell_price, member_price, box_desc, box_size) VALUES (?, ?, ?, ?, ?)`
  );
  const insertCompItem = db.prepare(
    `INSERT INTO competitor_items (competitor_id, item_name, spec, quantity) VALUES (?, ?, ?, ?)`
  );

  const insertCompetitors = db.transaction((data) => {
    for (const comp of data) {
      const result = insertCompetitor.run(comp.name, comp.sell_price, comp.member_price, comp.box_desc, comp.box_size);
      const compId = result.lastInsertRowid;
      for (const item of comp.items) {
        insertCompItem.run(compId, item.item_name, item.spec || null, 1);
      }
    }
  });
  insertCompetitors(competitorData);

  // ── 运营待办 ──
  const opsTasks = [
    { task: '更新小红书店铺商品图', platform: '小红书', priority: 1 },
    { task: '私域朋友圈发新品预告', platform: '微信', priority: 2 },
    { task: '闲鱼上架清仓商品', platform: '闲鱼', priority: 2 },
    { task: '联系B端客户报价', platform: 'B端', priority: 1 },
    { task: '整理本周订单发货', platform: '全部', priority: 0 },
  ];
  const insertOps = db.prepare('INSERT INTO ops_checklist (task, platform, priority) VALUES (?, ?, ?)');
  for (const t of opsTasks) {
    insertOps.run(t.task, t.platform, t.priority);
  }
}

// ─── REST API 路由 ────────────────────────────────────────────

// ── 货物清单 API ──

// GET /api/products
app.get('/api/products', (req, res) => {
  const { category, search } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    sql += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }
  sql += ' ORDER BY category, name';
  const data = db.prepare(sql).all(...params);
  res.json({ ok: true, data, total: data.length });
});

// GET /api/products/:id
app.get('/api/products/:id', (req, res) => {
  const data = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!data) return res.status(404).json({ ok: false, error: '商品不存在' });
  res.json({ ok: true, data });
});

// POST /api/products
app.post('/api/products', (req, res) => {
  const { name, category, subcategory, unit_price, unit, source, link, box_length, box_width, box_height, notes } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: '商品名称不能为空' });
  if (!category || !['盒子','辅料','糖果','单品'].includes(category)) return res.status(400).json({ ok: false, error: '无效分类' });
  if (unit_price < 0) return res.status(400).json({ ok: false, error: '单价不能为负数' });

  const result = db.prepare(`INSERT INTO products (name, category, subcategory, unit_price, unit, source, link, box_length, box_width, box_height, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    name.trim(), category, subcategory || null, unit_price, unit || '个',
    source || null, link || null, box_length || null, box_width || null, box_height || null, notes || null
  );
  const data = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ok: true, data });
});

// PUT /api/products/:id
app.put('/api/products/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ ok: false, error: '商品不存在' });

  const fields = ['name','category','subcategory','unit_price','unit','source','link','box_length','box_width','box_height','notes'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  }
  if (updates.length === 0) return res.json({ ok: true, data: existing });

  updates.push("updated_at = datetime('now','localtime')");
  params.push(id);
  db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const data = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.json({ ok: true, data });
});

// DELETE /api/products/:id
app.delete('/api/products/:id', (req, res) => {
  const id = req.params.id;
  const ref = db.prepare('SELECT COUNT(*) as c FROM bundle_items WHERE product_id = ?').get(id);
  if (ref.c > 0) return res.status(400).json({ ok: false, error: '该商品已被方案引用，无法删除' });

  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ── 成品方案 API ──

// GET /api/bundles
app.get('/api/bundles', (req, res) => {
  const bundles = db.prepare('SELECT * FROM bundles ORDER BY updated_at DESC').all();
  const data = bundles.map(b => {
    const items = db.prepare(`
      SELECT bi.*, p.name as product_name, p.category, p.unit, p.image
      FROM bundle_items bi
      JOIN products p ON bi.product_id = p.id
      WHERE bi.bundle_id = ?
    `).all(b.id);
    return { ...b, items };
  });
  res.json({ ok: true, data });
});

// GET /api/bundles/:id
app.get('/api/bundles/:id', (req, res) => {
  const b = db.prepare('SELECT * FROM bundles WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ ok: false, error: '方案不存在' });
  const items = db.prepare(`
    SELECT bi.*, p.name as product_name, p.category, p.unit, p.image
    FROM bundle_items bi
    JOIN products p ON bi.product_id = p.id
    WHERE bi.bundle_id = ?
  `).all(b.id);
  res.json({ ok: true, data: { ...b, items } });
});

// POST /api/bundles
app.post('/api/bundles', (req, res) => {
  const { name, box_type, box_id, items, margin_rate, notes } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: '方案名称不能为空' });
  if (!items || items.length === 0) return res.status(400).json({ ok: false, error: '方案至少包含1个商品' });

  const rate = margin_rate !== undefined ? margin_rate : 70;

  // 计算总成本
  let totalCost = 0;
  const resolvedItems = [];
  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
    if (!product) return res.status(400).json({ ok: false, error: `商品ID ${item.product_id} 不存在` });
    const qty = item.quantity || 1;
    const unitPrice = item.unit_price || product.unit_price;
    totalCost += unitPrice * qty;
    resolvedItems.push({ product_id: product.id, quantity: qty, unit_price: unitPrice });
  }

  const marginAmount = totalCost * rate / 100;
  const sellPrice = totalCost + marginAmount;

  const result = db.prepare(`INSERT INTO bundles (name, box_type, box_id, total_cost, sell_price, margin_rate, margin_amount, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    name.trim(), box_type || null, box_id || null, totalCost, sellPrice, rate, marginAmount, notes || null
  );
  const bId = result.lastInsertRowid;

  const insertItem = db.prepare('INSERT INTO bundle_items (bundle_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)');
  for (const ri of resolvedItems) {
    insertItem.run(bId, ri.product_id, ri.quantity, ri.unit_price);
  }

  const data = db.prepare('SELECT * FROM bundles WHERE id = ?').get(bId);
  const dataItems = db.prepare(`
    SELECT bi.*, p.name as product_name, p.category, p.unit, p.image
    FROM bundle_items bi JOIN products p ON bi.product_id = p.id WHERE bi.bundle_id = ?
  `).all(bId);
  res.status(201).json({ ok: true, data: { ...data, items: dataItems } });
});

// PUT /api/bundles/:id
app.put('/api/bundles/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM bundles WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ ok: false, error: '方案不存在' });

  // 更新基本信息
  if (req.body.name) db.prepare('UPDATE bundles SET name = ? WHERE id = ?').run(req.body.name, id);
  if (req.body.box_type !== undefined) db.prepare('UPDATE bundles SET box_type = ? WHERE id = ?').run(req.body.box_type, id);
  if (req.body.box_id !== undefined) db.prepare('UPDATE bundles SET box_id = ? WHERE id = ?').run(req.body.box_id, id);
  if (req.body.status) db.prepare('UPDATE bundles SET status = ? WHERE id = ?').run(req.body.status, id);
  if (req.body.notes !== undefined) db.prepare('UPDATE bundles SET notes = ? WHERE id = ?').run(req.body.notes, id);

  // 如果传了 margin_rate 或 items，重新计算成本
  if (req.body.margin_rate !== undefined || req.body.items !== undefined) {
    const rate = req.body.margin_rate !== undefined ? req.body.margin_rate : existing.margin_rate;

    if (req.body.items !== undefined) {
      // 替换所有 items
      db.prepare('DELETE FROM bundle_items WHERE bundle_id = ?').run(id);
      let totalCost = 0;
      const insertItem = db.prepare('INSERT INTO bundle_items (bundle_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)');
      for (const item of req.body.items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
        if (!product) continue;
        const qty = item.quantity || 1;
        const unitPrice = item.unit_price || product.unit_price;
        totalCost += unitPrice * qty;
        insertItem.run(id, item.product_id, qty, unitPrice);
      }
      const marginAmount = totalCost * rate / 100;
      db.prepare('UPDATE bundles SET total_cost = ?, sell_price = ?, margin_rate = ?, margin_amount = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
        .run(totalCost, totalCost + marginAmount, rate, marginAmount, id);
    } else {
      // 只改利润率，用现有 items 重算
      const items = db.prepare('SELECT SUM(subtotal) as total FROM bundle_items WHERE bundle_id = ?').get(id);
      const totalCost = items.total || 0;
      const marginAmount = totalCost * rate / 100;
      db.prepare('UPDATE bundles SET total_cost = ?, sell_price = ?, margin_rate = ?, margin_amount = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
        .run(totalCost, totalCost + marginAmount, rate, marginAmount, id);
    }
  } else {
    db.prepare("UPDATE bundles SET updated_at = datetime('now','localtime') WHERE id = ?").run(id);
  }

  const data = db.prepare('SELECT * FROM bundles WHERE id = ?').get(id);
  const dataItems = db.prepare(`
    SELECT bi.*, p.name as product_name, p.category, p.unit, p.image
    FROM bundle_items bi JOIN products p ON bi.product_id = p.id WHERE bi.bundle_id = ?
  `).all(id);
  res.json({ ok: true, data: { ...data, items: dataItems } });
});

// DELETE /api/bundles/:id
app.delete('/api/bundles/:id', (req, res) => {
  db.prepare('DELETE FROM bundles WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/bundles/:id/items — 向已有方案添加商品
app.post('/api/bundles/:id/items', (req, res) => {
  const bundleId = req.params.id;
  const bundle = db.prepare('SELECT * FROM bundles WHERE id = ?').get(bundleId);
  if (!bundle) return res.status(404).json({ ok: false, error: '方案不存在' });

  const { product_id, quantity } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(400).json({ ok: false, error: '商品不存在' });

  const qty = quantity || 1;
  db.prepare('INSERT INTO bundle_items (bundle_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(bundleId, product_id, qty, product.unit_price);

  // 重算成本
  const items = db.prepare('SELECT SUM(subtotal) as total FROM bundle_items WHERE bundle_id = ?').get(bundleId);
  const totalCost = items.total || 0;
  const marginAmount = totalCost * bundle.margin_rate / 100;
  db.prepare('UPDATE bundles SET total_cost = ?, sell_price = ?, margin_amount = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
    .run(totalCost, totalCost + marginAmount, marginAmount, bundleId);

  const data = db.prepare('SELECT * FROM bundles WHERE id = ?').get(bundleId);
  const dataItems = db.prepare(`
    SELECT bi.*, p.name as product_name, p.category, p.unit, p.image
    FROM bundle_items bi JOIN products p ON bi.product_id = p.id WHERE bi.bundle_id = ?
  `).all(bundleId);
  res.status(201).json({ ok: true, data: { ...data, items: dataItems } });
});

// DELETE /api/bundles/:bundleId/items/:itemId — 从方案移除商品
app.delete('/api/bundles/:bundleId/items/:itemId', (req, res) => {
  const { bundleId, itemId } = req.params;
  const bundle = db.prepare('SELECT * FROM bundles WHERE id = ?').get(bundleId);
  if (!bundle) return res.status(404).json({ ok: false, error: '方案不存在' });

  db.prepare('DELETE FROM bundle_items WHERE id = ? AND bundle_id = ?').run(itemId, bundleId);

  const items = db.prepare('SELECT SUM(subtotal) as total FROM bundle_items WHERE bundle_id = ?').get(bundleId);
  const totalCost = items.total || 0;
  const marginAmount = totalCost * bundle.margin_rate / 100;
  db.prepare('UPDATE bundles SET total_cost = ?, sell_price = ?, margin_amount = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
    .run(totalCost, totalCost + marginAmount, marginAmount, bundleId);

  const data = db.prepare('SELECT * FROM bundles WHERE id = ?').get(bundleId);
  const dataItems = db.prepare(`
    SELECT bi.*, p.name as product_name, p.category, p.unit, p.image
    FROM bundle_items bi JOIN products p ON bi.product_id = p.id WHERE bi.bundle_id = ?
  `).all(bundleId);
  res.json({ ok: true, data: { ...data, items: dataItems } });
});

// ── 竞品对比 API ──

// GET /api/competitors
app.get('/api/competitors', (req, res) => {
  const competitors = db.prepare('SELECT * FROM competitors ORDER BY created_at DESC').all();
  const data = competitors.map(c => {
    const items = db.prepare('SELECT * FROM competitor_items WHERE competitor_id = ?').all(c.id);
    return { ...c, items };
  });
  res.json({ ok: true, data });
});

// GET /api/competitors/:id
app.get('/api/competitors/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM competitors WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ ok: false, error: '竞品不存在' });
  const items = db.prepare('SELECT * FROM competitor_items WHERE competitor_id = ?').all(c.id);
  res.json({ ok: true, data: { ...c, items } });
});

// POST /api/competitors
app.post('/api/competitors', (req, res) => {
  const { name, sell_price, member_price, box_desc, box_size, item_summary, notes, items } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: '竞品名称不能为空' });

  const result = db.prepare(`INSERT INTO competitors (name, sell_price, member_price, box_desc, box_size, item_summary, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    name.trim(), sell_price || 0, member_price || null, box_desc || null, box_size || null, item_summary || null, notes || null
  );
  const cId = result.lastInsertRowid;

  if (items && items.length > 0) {
    const insertItem = db.prepare('INSERT INTO competitor_items (competitor_id, item_name, spec, quantity) VALUES (?, ?, ?, ?)');
    for (const item of items) {
      insertItem.run(cId, item.item_name, item.spec || null, item.quantity || 1);
    }
  }

  const data = db.prepare('SELECT * FROM competitors WHERE id = ?').get(cId);
  const dataItems = db.prepare('SELECT * FROM competitor_items WHERE competitor_id = ?').all(cId);
  res.status(201).json({ ok: true, data: { ...data, items: dataItems } });
});

// PUT /api/competitors/:id
app.put('/api/competitors/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM competitors WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ ok: false, error: '竞品不存在' });

  const fields = ['name','sell_price','member_price','box_desc','box_size','item_summary','notes'];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      db.prepare(`UPDATE competitors SET ${f} = ? WHERE id = ?`).run(req.body[f], id);
    }
  }

  if (req.body.items !== undefined) {
    db.prepare('DELETE FROM competitor_items WHERE competitor_id = ?').run(id);
    const insertItem = db.prepare('INSERT INTO competitor_items (competitor_id, item_name, spec, quantity) VALUES (?, ?, ?, ?)');
    for (const item of req.body.items) {
      insertItem.run(id, item.item_name, item.spec || null, item.quantity || 1);
    }
  }

  const data = db.prepare('SELECT * FROM competitors WHERE id = ?').get(id);
  const dataItems = db.prepare('SELECT * FROM competitor_items WHERE competitor_id = ?').all(id);
  res.json({ ok: true, data: { ...data, items: dataItems } });
});

// DELETE /api/competitors/:id
app.delete('/api/competitors/:id', (req, res) => {
  db.prepare('DELETE FROM competitors WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── 运营看板 API ──

// GET /api/checklist
app.get('/api/checklist', (req, res) => {
  const data = db.prepare('SELECT * FROM ops_checklist ORDER BY priority ASC, created_at DESC').all();
  res.json({ ok: true, data });
});

// POST /api/checklist
app.post('/api/checklist', (req, res) => {
  const { task, platform, priority } = req.body;
  if (!task || !task.trim()) return res.status(400).json({ ok: false, error: '任务内容不能为空' });
  const result = db.prepare('INSERT INTO ops_checklist (task, platform, priority) VALUES (?, ?, ?)').run(task.trim(), platform || null, priority || 0);
  const data = db.prepare('SELECT * FROM ops_checklist WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ok: true, data });
});

// PUT /api/checklist/:id
app.put('/api/checklist/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM ops_checklist WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ ok: false, error: '任务不存在' });

  if (req.body.done !== undefined) db.prepare('UPDATE ops_checklist SET done = ? WHERE id = ?').run(req.body.done ? 1 : 0, id);
  if (req.body.task) db.prepare('UPDATE ops_checklist SET task = ? WHERE id = ?').run(req.body.task, id);
  if (req.body.platform !== undefined) db.prepare('UPDATE ops_checklist SET platform = ? WHERE id = ?').run(req.body.platform, id);
  if (req.body.priority !== undefined) db.prepare('UPDATE ops_checklist SET priority = ? WHERE id = ?').run(req.body.priority, id);

  const data = db.prepare('SELECT * FROM ops_checklist WHERE id = ?').get(id);
  res.json({ ok: true, data });
});

// DELETE /api/checklist/:id
app.delete('/api/checklist/:id', (req, res) => {
  db.prepare('DELETE FROM ops_checklist WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── 工具 API ──

// POST /api/calculator — 快速计算器
app.post('/api/calculator', (req, res) => {
  const { items, margin_rate } = req.body;
  const rate = margin_rate !== undefined ? margin_rate : 70;

  if (!items || items.length === 0) return res.status(400).json({ ok: false, error: '至少需要一个商品' });

  let totalCost = 0;
  const resolvedItems = [];
  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
    if (!product) return res.status(400).json({ ok: false, error: `商品ID ${item.product_id} 不存在` });
    const qty = item.quantity || 1;
    const unitPrice = product.unit_price;
    const subtotal = unitPrice * qty;
    totalCost += subtotal;
    resolvedItems.push({ name: product.name, unit_price: unitPrice, quantity: qty, subtotal });
  }

  const marginAmount = totalCost * rate / 100;
  const sellPrice = totalCost + marginAmount;

  // 取整建议
  const roundedUp = Math.ceil(sellPrice * 10) / 10;
  const roundedDown = Math.floor(sellPrice * 10) / 10;
  const rounded99 = Math.floor(sellPrice) + 0.99;

  res.json({
    ok: true,
    data: {
      items: resolvedItems,
      total_cost: Math.round(totalCost * 100) / 100,
      margin_rate: rate,
      margin_amount: Math.round(marginAmount * 100) / 100,
      sell_price: Math.round(sellPrice * 100) / 100,
      suggestions: [
        { label: '取整（向上）', price: roundedUp },
        { label: '取整（向下）', price: roundedDown },
        { label: '尾数定价', price: rounded99 },
        { label: '整数定价', price: Math.round(sellPrice) },
      ]
    }
  });
});

// GET /api/dashboard — 仪表盘
app.get('/api/dashboard', (req, res) => {
  const totalProducts = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  const productsByCategory = db.prepare('SELECT category, COUNT(*) as c FROM products GROUP BY category').all();
  const byCat = {};
  for (const row of productsByCategory) byCat[row.category] = row.c;

  const totalBundles = db.prepare('SELECT COUNT(*) as c FROM bundles').get().c;
  const totalCompetitors = db.prepare('SELECT COUNT(*) as c FROM competitors').get().c;
  const totalPurchaseCost = db.prepare('SELECT COALESCE(SUM(unit_price * stock), 0) as total FROM products').get().total;
  const pendingChecklist = db.prepare('SELECT COUNT(*) as c FROM ops_checklist WHERE done = 0').get().c;

  const recentBundles = db.prepare('SELECT * FROM bundles ORDER BY updated_at DESC LIMIT 5').all();

  res.json({
    ok: true,
    data: {
      total_products: totalProducts,
      products_by_category: byCat,
      total_bundles: totalBundles,
      total_competitors: totalCompetitors,
      total_purchase_cost: totalPurchaseCost,
      pending_checklist: pendingChecklist,
      recent_bundles: recentBundles,
    }
  });
});

// ─── 图片上传 API ─────────────────────────────────────────────

// POST /api/products/:id/image - 上传商品图片 (base64)
app.post('/api/products/:id/image', (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ ok: false, error: '缺少图片数据' });

  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: '商品不存在' });

  // 解析 base64 (支持 data:image/xxx;base64,xxx 或纯 base64)
  let ext = 'jpg';
  let data = image;
  const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
  if (matches) {
    ext = matches[1] === 'png' ? 'png' : 'jpg';
    data = matches[2];
  }

  // 删除旧图片
  if (existing.image) {
    const oldPath = path.join(IMAGES_DIR, existing.image);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const filename = `product_${req.params.id}_${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(IMAGES_DIR, filename), Buffer.from(data, 'base64'));

  db.prepare("UPDATE products SET image = ?, updated_at = datetime('now','localtime') WHERE id = ?")
    .run(filename, req.params.id);

  res.json({ ok: true, data: { image: filename } });
});

// DELETE /api/products/:id/image - 删除商品图片
app.delete('/api/products/:id/image', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: '商品不存在' });

  if (existing.image) {
    const filePath = path.join(IMAGES_DIR, existing.image);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare("UPDATE products SET image = NULL, updated_at = datetime('now','localtime') WHERE id = ?")
    .run(req.params.id);

  res.json({ ok: true });
});

// ─── 启动服务器 ───────────────────────────────────────────────

// 确保 images 目录存在
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

// ─── 图片上传 API ─────────────────────────────────────────────

// POST /api/products/:id/image - 上传商品图片 (base64)
app.post('/api/products/:id/image', (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ ok: false, error: '缺少图片数据' });

  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: '商品不存在' });

  let ext = 'jpg';
  let data = image;
  const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
  if (matches) { ext = matches[1] === 'png' ? 'png' : 'jpg'; data = matches[2]; }

  if (existing.image) {
    const oldPath = path.join(IMAGES_DIR, existing.image);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const filename = `product_${req.params.id}_${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(IMAGES_DIR, filename), Buffer.from(data, 'base64'));

  db.prepare("UPDATE products SET image = ?, updated_at = datetime('now','localtime') WHERE id = ?")
    .run(filename, req.params.id);

  res.json({ ok: true, data: { image: filename } });
});

// DELETE /api/products/:id/image - 删除商品图片
app.delete('/api/products/:id/image', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: '商品不存在' });

  if (existing.image) {
    const filePath = path.join(IMAGES_DIR, existing.image);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare("UPDATE products SET image = NULL, updated_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ─── 确保 images 目录存在 ─────────────────────────────────────
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

initDatabase();

app.listen(PORT, () => {
  console.log(`🎁 伴手礼管理后台已启动`);
  console.log(`   本地地址: http://localhost:${PORT}`);
  console.log(`   数据库: ${DB_PATH}`);
});
