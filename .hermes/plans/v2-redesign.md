# 🎁 伴手礼管家 v2 — 实施方案

> **For Hermes:** 单页应用大改，直接逐任务执行，无需子代理分发。

**目标：** 将现有 Tab 式管理后台升级为侧边栏导航 + 比价采购 + 响应式设计的专业个体商户一站式管理平台。

**架构：** 保留 Express + SQLite 后端不变；前端从单文件 `index.html` (1394行) 重构为模块化结构，纯 HTML/CSS/JS，不引入框架。

**技术栈：** Vanilla JS + CSS Grid/Flexbox + Express + better-sqlite3

---

## 数据模型变更

### 新增表：`supplier_quotes`（供应商报价）

```sql
CREATE TABLE supplier_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  platform TEXT NOT NULL,       -- '1688' | '拼多多' | '其他'
  supplier_name TEXT,           -- 供应商名称
  unit_price REAL,              -- 单价
  min_order INTEGER,            -- 起批量
  shipping REAL,                -- 运费
  link TEXT,                    -- 商品链接
  is_preferred INTEGER DEFAULT 0, -- 是否首选
  notes TEXT,
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
```

### 修改表：`products` 新增字段

```sql
ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 5;       -- 最低库存预警
ALTER TABLE products ADD COLUMN tags TEXT;                          -- 标签(逗号分隔)
ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'active';       -- active|archived
ALTER TABLE products ADD COLUMN last_purchased_at TEXT;             -- 最近采购时间
```

---

## 任务清单

### Phase 1：数据库 + API 扩展

---

### Task 1：创建 supplier_quotes 表 + products 新字段

**目标：** 扩展数据库 schema

**文件：**
- 创建：`~/gift-basket-manager/migrate_v2.js`
- 修改：`~/gift-basket-manager/inventory.db`

**操作：**
```js
const db = require('better-sqlite3')('inventory.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS supplier_quotes (
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
  );
`);
db.exec(`ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 5`);
db.exec(`ALTER TABLE products ADD COLUMN tags TEXT`);
db.exec(`ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'active'`);
db.exec(`ALTER TABLE products ADD COLUMN last_purchased_at TEXT`);
// 迁移现有数据：为有 link 的商品创建默认 supplier_quote
const products = db.prepare("SELECT id, link, source, unit_price FROM products WHERE link IS NOT NULL AND link != ''").all();
const insert = db.prepare("INSERT INTO supplier_quotes (product_id, platform, unit_price, link, is_preferred) VALUES (?,?,?,?,1)");
for (const p of products) {
  insert.run(p.id, p.source || '1688', p.unit_price, p.link);
}
console.log('Migration done:', products.length, 'quotes created');
db.close();
```

**验证：** `node migrate_v2.js` → 输出 Migration done

---

### Task 2：新增 /api/quotes CRUD 路由

**目标：** 后端 API 支持供应商报价的增删改查

**文件：** 修改 `~/gift-basket-manager/server.js`

**操作：** 在 server.js 中添加路由：

```js
// GET /api/quotes?product_id=1
app.get('/api/quotes', (req, res) => {
  const { product_id } = req.query;
  let sql = 'SELECT * FROM supplier_quotes';
  let params = [];
  if (product_id) { sql += ' WHERE product_id = ?'; params.push(product_id); }
  sql += ' ORDER BY is_preferred DESC, unit_price ASC';
  const quotes = db.prepare(sql).all(...params);
  res.json({ ok: true, data: quotes });
});

// POST /api/quotes
app.post('/api/quotes', (req, res) => {
  const { product_id, platform, supplier_name, unit_price, min_order, shipping, link, notes } = req.body;
  const result = db.prepare(`INSERT INTO supplier_quotes (product_id, platform, supplier_name, unit_price, min_order, shipping, link, notes)
    VALUES (?,?,?,?,?,?,?,?)`).run(product_id, platform, supplier_name, unit_price, min_order||null, shipping||0, link||null, notes||null);
  res.json({ ok: true, data: { id: result.lastInsertRowid } });
});

// PUT /api/quotes/:id
app.put('/api/quotes/:id', (req, res) => {
  const { platform, supplier_name, unit_price, min_order, shipping, link, is_preferred, notes } = req.body;
  db.prepare(`UPDATE supplier_quotes SET platform=?, supplier_name=?, unit_price=?, min_order=?, shipping=?, link=?, is_preferred=?, notes=?, updated_at=datetime('now','localtime') WHERE id=?`)
    .run(platform, supplier_name, unit_price, min_order, shipping, link, is_preferred||0, notes, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/quotes/:id
app.delete('/api/quotes/:id', (req, res) => {
  db.prepare('DELETE FROM supplier_quotes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
```

**验证：** 重启 `node server.js`，`curl localhost:3000/api/quotes` → 返回报价列表

---

### Task 3：扩展 /api/products 支持 min_stock/tags/status 字段

**目标：** 产品 API 读写新字段

**文件：** 修改 `~/gift-basket-manager/server.js`

**操作：** 在 POST/PUT /api/products 路由中添加新字段处理：

```js
// POST 中添加
min_stock: req.body.min_stock || 5,
tags: req.body.tags || null,
status: req.body.status || 'active',

// PUT 中添加
min_stock: req.body.min_stock,
tags: req.body.tags,
status: req.body.status,
```

**验证：** `curl -X PUT localhost:3000/api/products/1 -H 'Content-Type: application/json' -d '{"min_stock":10}'` → 返回 ok

---

### Phase 2：前端重构

---

### Task 4：创建新 HTML 骨架（侧边栏 + 响应式布局）

**目标：** 新页面结构——侧边栏导航、主内容区、响应式断点

**文件：**
- 备份：`mv public/index.html public/index_old.html`
- 创建：`public/index.html`
- 创建：`public/css/style.css`
- 创建：`public/js/app.js`

**操作：** 创建 `public/index.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🎁 伴手礼管家</title>
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<!-- 侧边栏 -->
<aside class="sidebar" id="sidebar">
  <div class="sidebar-brand">🎁 伴手礼管家</div>
  <nav class="sidebar-nav" id="sidebar-nav">
    <a class="nav-item active" data-page="dashboard">📊 工作台</a>
    <a class="nav-item" data-page="products">📦 商品库</a>
    <a class="nav-item" data-page="sourcing">🏪 比价采购</a>
    <a class="nav-item" data-page="bundles">🧺 方案搭建</a>
    <a class="nav-item" data-page="analytics">📈 数据看板</a>
    <a class="nav-item" data-page="stock">📋 进出记录</a>
  </nav>
  <div class="sidebar-footer">
    <span class="version">v2.0</span>
  </div>
</aside>

<!-- 遮罩层（移动端用） -->
<div class="sidebar-overlay" id="sidebar-overlay"></div>

<!-- 主内容 -->
<main class="main-content" id="main-content">
  <header class="topbar">
    <button class="menu-toggle" id="menu-toggle">☰</button>
    <h1 class="page-title" id="page-title">📊 工作台</h1>
    <div class="topbar-actions">
      <button class="btn btn-primary btn-sm" id="btn-quick-add">＋ 快速添加</button>
    </div>
  </header>
  <div class="page-container" id="page-container"></div>
</main>

<!-- 底部 Tab（移动端） -->
<nav class="mobile-tabs" id="mobile-tabs">
  <button class="tab-item active" data-page="dashboard">📊</button>
  <button class="tab-item" data-page="products">📦</button>
  <button class="tab-item" data-page="sourcing">🏪</button>
  <button class="tab-item" data-page="bundles">🧺</button>
  <button class="tab-item" data-page="analytics">📈</button>
</nav>

<!-- Modal + Toast 占位 -->
<div class="modal-overlay" id="modal-overlay">
  <div class="modal" id="modal-content">
    <div class="modal-header"><h2 id="modal-title"></h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body" id="modal-body"></div>
    <div class="modal-footer" id="modal-footer"></div>
  </div>
</div>
<div class="toast" id="toast"></div>

<script src="/js/api.js"></script>
<script src="/js/app.js"></script>
<script src="/js/pages/dashboard.js"></script>
<script src="/js/pages/products.js"></script>
<script src="/js/pages/sourcing.js"></script>
<script src="/js/pages/bundles.js"></script>
<script src="/js/pages/analytics.js"></script>
<script src="/js/pages/stock.js"></script>
</body>
</html>
```

**验证：** 浏览器打开 `localhost:3000` → 看到侧边栏 + 空主内容区

---

### Task 5：创建全局 CSS（温暖活泼风 + 响应式）

**目标：** 完整样式系统

**文件：** 创建 `public/css/style.css`

**设计规范：**
- 主色：`#f472b6`（暖粉）/ `#fb923c`（暖橙）渐变
- 背景：`#fef7f2`（暖米白）
- 卡片：白色 + `box-shadow: 0 2px 12px rgba(251,146,60,0.08)`
- 圆角：`16px`（大卡片）/ `10px`（小元素）
- 字体：系统字体（PingFang SC 优先）

**响应式断点：**
```css
/* 桌面 >=1024px */  侧边栏 240px 常显
/* 平板 768-1023px */ 侧边栏折叠 + 汉堡菜单
/* 手机 <768px */    底部 Tab 栏 + 全宽内容
```

**关键 CSS 结构：**
```css
:root {
  --pink: #f472b6; --orange: #fb923c;
  --bg: #fef7f2; --card: #ffffff;
  --text: #4a3728; --text-secondary: #9a7b6b;
  --border: #f0e0d6; --radius: 16px; --radius-sm: 10px;
  --shadow: 0 2px 12px rgba(251,146,60,0.08);
  --gradient: linear-gradient(135deg, #f472b6, #fb923c);
  --sidebar-width: 240px;
}

/* 侧边栏 */
.sidebar { position: fixed; left:0; top:0; bottom:0; width: var(--sidebar-width);
  background: white; border-right: 1px solid var(--border); z-index: 200;
  display: flex; flex-direction: column; }

/* 移动端 */
@media (max-width: 1023px) {
  .sidebar { transform: translateX(-100%); transition: transform 0.3s; }
  .sidebar.open { transform: translateX(0); }
  .main-content { margin-left: 0 !important; }
}
@media (max-width: 767px) {
  .mobile-tabs { display: flex; }
  .topbar .menu-toggle { display: block; }
}
```

**验证：** 浏览器打开 → 看到暖色系侧边栏

---

### Task 6：创建 JS 框架（路由 + API + 工具函数）

**目标：** 页面路由、导航切换、公共 API 封装

**文件：**
- 创建：`public/js/api.js`
- 创建：`public/js/app.js`

**api.js：**
```js
const API = '/api';
async function get(path) { const r = await fetch(API+path); return r.json(); }
async function post(path, body) { const r = await fetch(API+path, {method:'POST',headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}); return r.json(); }
async function put(path, body) { const r = await fetch(API+path, {method:'PUT',headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}); return r.json(); }
async function del(path) { const r = await fetch(API+path, {method:'DELETE'}); return r.json(); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toast(msg, type='success') { const t=document.getElementById('toast'); t.textContent=msg; t.className='toast '+type+' show'; setTimeout(()=>t.classList.remove('show'),2500); }
```

**app.js（路由核心）：**
```js
let currentPage = 'dashboard';

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item, .tab-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  document.getElementById('page-title').textContent = 
    {dashboard:'📊 工作台', products:'📦 商品库', sourcing:'🏪 比价采购', bundles:'🧺 方案搭建', analytics:'📈 数据看板', stock:'📋 进出记录'}[page];
  loadPage(page);
  // 移动端关闭侧边栏
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

function loadPage(page) {
  const container = document.getElementById('page-container');
  const loaders = { dashboard: loadDashboard, products: loadProducts, sourcing: loadSourcing, bundles: loadBundles, analytics: loadAnalytics, stock: loadStockRecords };
  if (loaders[page]) loaders[page](container);
}

// 事件绑定
document.querySelectorAll('.nav-item, .tab-item').forEach(el => el.addEventListener('click', () => navigateTo(el.dataset.page)));
document.getElementById('menu-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('show');
});
document.getElementById('sidebar-overlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
});

// 初始加载
navigateTo('dashboard');
```

**验证：** 点击侧边栏导航 → 标题切换，URL 不变（SPA）

---

### Task 7：工作台页面（dashboard.js）

**目标：** 首页仪表盘——库存概览、待办、快捷入口

**文件：** 创建 `public/js/pages/dashboard.js`

**内容：**
```js
async function loadDashboard(container) {
  const d = await get('/dashboard');
  if (!d.ok) return;
  const data = d.data;
  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon">📦</div><div class="stat-value">${data.total_products}</div><div class="stat-label">商品总数</div></div>
      <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-value">${data.low_stock||0}</div><div class="stat-label">库存不足</div></div>
      <div class="stat-card"><div class="stat-icon">🧺</div><div class="stat-value">${data.total_bundles}</div><div class="stat-label">成品方案</div></div>
      <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-value">${data.pending_checklist}</div><div class="stat-label">待办事项</div></div>
    </div>
    <div class="dash-grid">
      <div class="card"><div class="card-title">🔔 库存预警</div><div id="dash-alerts">加载中...</div></div>
      <div class="card"><div class="card-title">🧺 最近方案</div><div id="dash-bundles">加载中...</div></div>
    </div>
    <div class="card"><div class="card-title">⚡ 快捷操作</div>
      <div class="quick-actions">
        <button class="btn" onclick="navigateTo('products')">📦 管理商品</button>
        <button class="btn" onclick="navigateTo('sourcing')">🏪 比价采购</button>
        <button class="btn" onclick="navigateTo('bundles')">🧺 新建方案</button>
      </div>
    </div>`;
  // 加载预警
  const lowStock = await get('/products?low_stock=1');
  document.getElementById('dash-alerts').innerHTML = lowStock.data?.length 
    ? lowStock.data.map(p => `<div class="alert-item">⚠️ ${esc(p.name)} 仅剩 ${p.stock} ${p.unit||'个'}</div>`).join('')
    : '<div class="empty-sm">✅ 库存充足</div>';
  // 加载方案
  const bundles = data.recent_bundles || [];
  document.getElementById('dash-bundles').innerHTML = bundles.length
    ? bundles.map(b => `<div class="mini-bundle">🧺 ${esc(b.name)} · ¥${b.sell_price?.toFixed(2)} · ${b.margin_rate}%</div>`).join('')
    : '<div class="empty-sm">暂无方案</div>';
}
```

**API 扩展（server.js）：**
```js
// 在 /api/dashboard 中添加 low_stock
app.get('/api/dashboard', (req, res) => {
  // ... existing code ...
  const lowStock = db.prepare("SELECT COUNT(*) as cnt FROM products WHERE stock > 0 AND stock <= min_stock AND status='active'").get();
  data.low_stock = lowStock.cnt;
  res.json({ ok: true, data });
});
```

**验证：** 点击「工作台」→ 看到统计卡片和预警

---

### Task 8：商品库页面（products.js）— 升级版

**目标：** 多视图、更强筛选、批量操作、多链接显示

**文件：** 创建 `public/js/pages/products.js`

**核心功能升级：**
1. 新增「库存状态」筛选（全部/充足/不足/缺货）
2. 新增「来源」筛选（1688/拼多多/无）
3. 表格中链接列改为「查看报价」按钮→滑出比价面板
4. 商品卡片 hover 显示关键信息
5. 响应式：桌面表格，手机卡片

**注意：** 复用现有 products.js 中的产品编辑 Modal 逻辑，不要重写。

---

### Task 9：比价采购页面（sourcing.js）— 🆕 核心模块

**目标：** 同一商品多供应商比价 + 管理报价

**文件：** 创建 `public/js/pages/sourcing.js`

**页面布局：**
```
┌────────────────────────────────────────┐
│ 商品列表（左）  │  报价详情（右）       │
│                │                       │
│ 🔍 搜索...     │  🏷️ 艾草锤养身锤      │
│                │                       │
│ ☐ 艾草锤      │  ┌─────────────────┐  │
│ ☐ 保温杯      │  │ 1688  ¥3.20/个  │  │
│ ☐ 香皂香薰    │  │ 起批100 运费¥8  │  │
│ ...           │  │ ⭐ 首选供应商    │  │
│                │  └─────────────────┘  │
│                │  ┌─────────────────┐  │
│                │  │ 拼多多 ¥3.80/个 │  │
│                │  │ 起批10  包邮    │  │
│                │  └─────────────────┘  │
│                │  [+ 添加报价]         │
└────────────────────────────────────────┘
```

**核心功能：**
- 左侧商品列表（可搜索、筛选）
- 右侧选中商品的报价卡片列表
- 每个报价卡片显示：平台、供应商、单价、起批量、运费、链接
- 比价结果高亮最优价（绿色边框）
- 可标记「首选供应商」
- 添加/编辑/删除报价

---

### Task 10：方案搭建页面（bundles.js）— 升级版

**目标：** 更直观的方案编辑器 + 拖拽排序（可选）

**升级：**
- 左右分栏：左侧商品池（可搜索）+ 右侧方案编辑器
- 实时利润率滑块
- 方案配图管理（保留现有逻辑）
- 响应式：手机端折叠为单向布局

---

### Task 11：数据看板页面（analytics.js）— 🆕

**目标：** 图表化展示关键数据

**文件：** 创建 `public/js/pages/analytics.js`

**内容（纯 CSS 图表，不引入 Chart.js）：**
- 采购金额趋势（按月份柱状图，CSS bar）
- 品类分布（环形图，CSS conic-gradient）
- 库存周转排行
- 近 30 天进货金额

---

### Task 12：进出记录页面（stock.js）— 小幅升级

**目标：** 关联供应商、更好筛选

**文件：** 创建 `public/js/pages/stock.js`（复用现有 stock 逻辑）

---

### Phase 3：整合测试

---

### Task 13：Express 静态文件路由更新 + 服务器测试

**目标：** 确保新的 CSS/JS 文件正确加载

**文件：** 修改 `~/gift-basket-manager/server.js`

```js
app.use(express.static('public'));
// 确保 /css/* 和 /js/* 能访问
```

---

### Task 14：全流程测试 + Commit

**目标：** 验证所有模块在桌面/平板/手机视图下正常工作

**操作：**
1. 重启服务器 `node server.js`
2. 桌面端：逐个点击侧边栏，检查 6 个页面加载
3. 平板端：缩小浏览器→侧边栏折叠→汉堡菜单→确认
4. 手机端：缩小→底部 Tab 栏→切换页面
5. 功能验证：新增商品→新增报价→新建方案→查看看板
6. `git add -A && git commit -m "feat: v2.0 侧边栏+比价采购+响应式 全新改版" && git push`

---

## 实施顺序

```
Task 1 (DB) → Task 2 (API) → Task 3 (API扩展)
    ↓
Task 4 (HTML骨架) → Task 5 (CSS) → Task 6 (JS框架)
    ↓
Task 7 (Dashboard) → Task 8 (Products) → Task 9 (Sourcing ⭐)
    ↓
Task 10 (Bundles) → Task 11 (Analytics) → Task 12 (Stock)
    ↓
Task 13 (静态路由) → Task 14 (测试+Commit)
```

---

## 注意事项

- 每次 commit 都在 `~/gift-basket-manager` 目录下操作
- 旧版 index.html 保留为 `index_old.html`，随时可回滚
- 所有新文件通过 `git add` 纳入版本控制
- 手机端优先保证库存管理 + 比价核心流程可用
