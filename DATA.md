# 🎁 GiftBasket Manager — 完整开发过程记录

> **项目名称**: GiftBasket Manager（伴手礼线上店管理后台）
> **项目路径**: `/mnt/c/Users/xujin/Documents/WebDev/gift-basket-manager/`
> **技术栈**: Node.js + Express + better-sqlite3 全栈应用（无前端框架）
> **开发日期**: 2026年5月4日
> **数据库**: SQLite (inventory.db)

---

## ═════════════ 目录 ═════════════

1. [项目初始化](#1-项目初始化)
2. [数据库设计](#2-数据库设计)
3. [后端开发](#3-后端开发)
4. [前端开发](#4-前端开发)
5. [调试记录](#5-调试记录)
6. [最终验证](#6-最终验证)

---

## 1. 项目初始化

### 1.1 创建项目目录

```bash
mkdir -p /mnt/c/Users/xujin/Documents/WebDev/gift-basket-manager
cd /mnt/c/Users/xujin/Documents/WebDev/gift-basket-manager
```

### 1.2 npm 初始化

```bash
npm init -y
```

生成的 `package.json` 内容：

```json
{
  "name": "gift-basket-manager",
  "version": "1.0.0",
  "description": "伴手礼线上店管理后台 — GiftBasket Manager",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "better-sqlite3": "^11.6.0"
  }
}
```

### 1.3 安装依赖

```bash
npm install express better-sqlite3
```

- **express**: 轻量级 Web 框架，用于构建 REST API 和静态文件服务
- **better-sqlite3**: 同步 SQLite3 绑定，性能优异，适合单机管理后台

### 1.4 目录结构

```
gift-basket-manager/
├── package.json
├── package-lock.json
├── server.js          # 主服务端文件（含全部后端逻辑）
├── public/
│   └── index.html     # 单页前端（含全部样式和 JavaScript）
└── inventory.db       # SQLite 数据库文件（自动生成）
```

> **说明**: 项目采用「全单文件」架构——后端所有逻辑集中在 `server.js`，前端所有 HTML/CSS/JS 集中在 `public/index.html`。无前端框架，无构建工具。

---

## 2. 数据库设计

### 2.1 设计思路

围绕伴手礼管理业务，设计了 **6 张表**，覆盖四个核心领域：

| 领域 | 表名 | 功能 |
|------|------|------|
| **商品管理** | `products` | 存储所有商品（盒子/辅料/糖果/单品） |
| **方案管理** | `bundles` | 成品方案主表 |
| | `bundle_items` | 方案与商品的关联明细 |
| **竞品分析** | `competitors` | 竞品方案主表 |
| | `competitor_items` | 竞品包含的商品明细 |
| **运营管理** | `ops_checklist` | 运营待办清单 |

### 2.2 各表详细设计

#### 2.2.1 `products` — 商品表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 主键 |
| `name` | TEXT NOT NULL | 商品名称 |
| `category` | TEXT NOT NULL | 分类（盒子/辅料/糖果/单品） |
| `subcategory` | TEXT | 子分类（如：编织篮、礼盒等） |
| `unit_price` | REAL NOT NULL DEFAULT 0 | 单价 |
| `unit` | TEXT DEFAULT '个' | 单位 |
| `source` | TEXT | 采购来源（1688/拼多多） |
| `link` | TEXT | 采购链接 |
| `image` | TEXT | 图片路径 |
| `box_length` | REAL | 长(cm) |
| `box_width` | REAL | 宽(cm) |
| `box_height` | REAL | 高(cm) |
| `stock` | INTEGER DEFAULT 0 | 库存数量 |
| `total_cost` | REAL DEFAULT 0 | 总成本 |
| `notes` | TEXT | 备注 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |

**索引**: `idx_products_category` (category), `idx_products_name` (name)

#### 2.2.2 `bundles` — 成品方案表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 主键 |
| `name` | TEXT NOT NULL | 方案名称 |
| `box_type` | TEXT | 盒子类型描述 |
| `box_id` | INTEGER | 关联的盒子商品ID → `products(id)` |
| `total_cost` | REAL DEFAULT 0 | 总成本 |
| `sell_price` | REAL DEFAULT 0 | 售价 |
| `margin_rate` | REAL DEFAULT 70 | 利润率(%) |
| `margin_amount` | REAL DEFAULT 0 | 利润金额 |
| `status` | TEXT DEFAULT '草稿' | 状态（草稿/已发布/下架） |
| `notes` | TEXT | 备注 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |

**外键**: `box_id` → `products(id)`

#### 2.2.3 `bundle_items` — 方案商品明细表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 主键 |
| `bundle_id` | INTEGER NOT NULL | 方案ID → `bundles(id) ON DELETE CASCADE` |
| `product_id` | INTEGER NOT NULL | 商品ID → `products(id)` |
| `quantity` | INTEGER NOT NULL DEFAULT 1 | 数量 |
| `unit_price` | REAL NOT NULL | 单价（快照，允许与商品表不同） |
| `subtotal` | REAL GENERATED ALWAYS...STORED | 小计 = quantity × unit_price（计算列） |

**亮点**: `subtotal` 使用 SQLite 的 **Generated Column**（STORED），自动计算，无需应用层维护。

#### 2.2.4 `competitors` — 竞品方案表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 主键 |
| `name` | TEXT NOT NULL | 竞品方案名称 |
| `sell_price` | REAL DEFAULT 0 | 零售价 |
| `member_price` | REAL DEFAULT 0 | 会员价 |
| `box_desc` | TEXT | 盒子描述 |
| `box_size` | TEXT | 盒子尺寸 |
| `item_summary` | TEXT | 内容物摘要 |
| `notes` | TEXT | 备注 |
| `created_at` | TEXT | 创建时间 |

#### 2.2.5 `competitor_items` — 竞品商品明细表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 主键 |
| `competitor_id` | INTEGER NOT NULL | 竞品ID → `competitors(id) ON DELETE CASCADE` |
| `item_name` | TEXT NOT NULL | 商品名称 |
| `spec` | TEXT | 规格 |
| `quantity` | INTEGER DEFAULT 1 | 数量 |

#### 2.2.6 `ops_checklist` — 运营待办表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 主键 |
| `task` | TEXT NOT NULL | 任务内容 |
| `platform` | TEXT | 平台（小红书/微信/闲鱼/B端） |
| `priority` | INTEGER DEFAULT 0 | 优先级（0普通/1高/2低） |
| `done` | INTEGER DEFAULT 0 | 是否完成 |
| `created_at` | TEXT | 创建时间 |

### 2.3 建表代码

建表使用 `db.exec()` 批量执行 SQL，关键 SQL 片段：

```sql
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('盒子','辅料','糖果','单品')),
  -- ...
);

CREATE TABLE IF NOT EXISTS bundle_items (
  -- ...
  subtotal REAL GENERATED ALWAYS AS (quantity * unit_price) STORED,
  FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

- 开启了 **WAL 模式**（`journal_mode = WAL`）提升并发性能
- 开启了 **外键约束**（`foreign_keys = ON`）

---

## 3. 后端开发

### 3.1 技术架构

```
Express 应用
├── 中间件
│   ├── express.json()       # JSON 请求体解析
│   └── express.static()     # 静态文件服务 (public/)
├── 数据库层 (better-sqlite3)
│   ├── initDatabase()       # 初始化数据库
│   ├── createTables()       # 建表
│   └── seedIfEmpty()        # 种子数据
└── REST API 路由
    ├── /api/products        # CRUD
    ├── /api/bundles         # CRUD + 子资源
    ├── /api/competitors     # CRUD
    ├── /api/checklist       # CRUD
    ├── /api/calculator      # 报价计算
    └── /api/dashboard       # 仪表盘聚合
```

### 3.2 REST API 清单

| 方法 | 路径 | 功能 |
|------|------|------|
| `GET` | `/api/products` | 商品列表（支持 `?category=` 和 `?search=` 筛选） |
| `GET` | `/api/products/:id` | 商品详情 |
| `POST` | `/api/products` | 新增商品（含参数校验） |
| `PUT` | `/api/products/:id` | 更新商品（动态字段更新） |
| `DELETE` | `/api/products/:id` | 删除商品（检查引用约束） |
| `GET` | `/api/bundles` | 方案列表（含商品明细） |
| `GET` | `/api/bundles/:id` | 方案详情 |
| `POST` | `/api/bundles` | 新建方案（自动计算成本+售价） |
| `PUT` | `/api/bundles/:id` | 更新方案（支持部分字段+重算） |
| `DELETE` | `/api/bundles/:id` | 删除方案（级联删除明细） |
| `POST` | `/api/bundles/:id/items` | 向方案添加商品 |
| `DELETE` | `/api/bundles/:bundleId/items/:itemId` | 从方案移除商品 |
| `GET` | `/api/competitors` | 竞品列表（含商品明细） |
| `GET` | `/api/competitors/:id` | 竞品详情 |
| `POST` | `/api/competitors` | 新增竞品 |
| `PUT` | `/api/competitors/:id` | 更新竞品 |
| `DELETE` | `/api/competitors/:id` | 删除竞品 |
| `GET` | `/api/checklist` | 待办列表 |
| `POST` | `/api/checklist` | 新增待办 |
| `PUT` | `/api/checklist/:id` | 更新待办（含完成状态切换） |
| `DELETE` | `/api/checklist/:id` | 删除待办 |
| `POST` | `/api/calculator` | 快速报价计算（含取整建议） |
| `GET` | `/api/dashboard` | 仪表盘聚合数据 |

#### 🔑 关键业务逻辑亮点

**方案成本自动计算** (POST/PUT /api/bundles)：
```
1. 遍历 items，查找 product 的实际单价
2. totalCost = Σ(unitPrice × quantity)
3. marginAmount = totalCost × marginRate / 100
4. sellPrice = totalCost + marginAmount
5. 写入数据库
```

**Calculator 智能报价** (POST /api/calculator)：
```
除基础计算外，还提供 4 种取整建议：
- 取整（向上）
- 取整（向下）
- 尾数定价 (x.99)
- 整数定价
```

**删除保护** (DELETE /api/products/:id)：
```
删除前检查商品是否被 bundle_items 引用
若被引用则返回 400 错误
```

### 3.3 种子数据

启动时自动检测数据库是否为空，若为空则插入以下种子数据：

#### 商品数据（共 71 条）

按 4 个分类分布：

| 分类 | 数量 | 示例 |
|------|------|------|
| **盒子** | 22种 | 竹篮中号、环扣手拎包、PVC透明手提袋、蛋糕盒子、烫银盒子、快递费等 |
| **辅料** | 15种 | 雪梨纸、丝带、拉菲草、风吕敷、卡片、干花、火漆蜡等 |
| **糖果** | 13种 | 葡萄果汁软糖、不二家棒棒糖、俄罗斯紫皮糖、旺仔牛奶糖等 |
| **单品** | 21种 | 遮光眼罩、保温杯、护手霜、艾草锤、按摩梳、马克杯、毛巾、茶包等 |

> 盒子分类中特别包含 **快递费**（单价 1.30 元/次），作为物流成本计入方案。

#### 自研方案（3 个已发布方案）

| 方案名称 | 盒子 | 商品数 | 成本 | 售价 | 利润率 |
|---------|------|--------|------|------|--------|
| **竹篮伴手礼** | 竹篮中号 20-20-30 | 13件 | ¥29.39 | ¥49.96 | 70% |
| **PVC透明手提袋** | PVC透明礼品袋(大) 16-15-7 | 12件 | ¥9.78 | ¥17.00 | 73.8% |
| **磨砂透明手提袋** | PVC透明手提袋(小) 15-13.5-7 | 10件 | ¥9.60 | ¥17.00 | 77.1% |

**竹篮伴手礼典型内容**：竹篮 + 快递费 + 眼罩 + 马克杯 + 毛巾 + 雪梨纸 + 5种糖果 + 中国结挂件

#### 竞品方案（7 个）

| 竞品名称 | 售价 | 会员价 | 商品数 |
|---------|------|--------|--------|
| 木盒粉色樱花护士节 | ¥123.16 | ¥61.58 | 9件 |
| 原木紫罗兰护士节 | ¥93.16 | ¥46.58 | 5件 |
| 花漾紫葡萄皂女神节年会 | ¥85.16 | ¥42.58 | 5件 |
| 蝴蝶花香母亲节 | ¥73.16 | ¥36.58 | 5件 |
| 马卡龙绿色护士节 | ¥59.58 | ¥29.79 | 4件 |
| 绿野仙踪护士节 | ¥37.16 | ¥18.58 | 3件 |
| 会员专享-妈妈碎碎念腰封 | ¥9.90 | — | 2件 |

#### 运营待办（5 条）

| 任务 | 平台 | 优先级 |
|------|------|--------|
| 更新小红书店铺商品图 | 小红书 | 高(1) |
| 私域朋友圈发新品预告 | 微信 | 中(2) |
| 闲鱼上架清仓商品 | 闲鱼 | 中(2) |
| 联系B端客户报价 | B端 | 高(1) |
| 整理本周订单发货 | 全部 | 普通(0) |

---

## 4. 前端开发

### 4.1 总体架构

纯**原生 JavaScript** 单页应用（SPA），所有代码在 `public/index.html` 中。

**前端组成**：
- **CSS** (~217行) — 全局样式、组件样式
- **HTML** (~109行) — 页面骨架
- **JavaScript** (~590行) — 全部交互逻辑

### 4.2 六个 Tab 页面

| Tab | 页面ID | 功能 |
|-----|--------|------|
| 📊 **仪表盘** | `page-dashboard` | 数据概览：商品总数、方案数、竞品数、待办数、最近方案 |
| 📦 **货物清单** | `page-products` | 商品CRUD、分类筛选、搜索 |
| 🧺 **成品方案** | `page-bundles` | 方案查看、新建、编辑、删除、方案搭建器 |
| 🔍 **竞品对比** | `page-competitors` | 竞品CRUD、展开查看详情 |
| 🧮 **计算器** | `page-calculator` | 快速报价：选商品→调利润率→看结果 |
| 📋 **运营看板** | `page-ops` | 平台策略卡片、待办清单勾选管理 |

### 4.3 Tab 切换机制

```javascript
document.getElementById('tabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  // 切换 active 状态
  // 按需加载数据
  if (tab === 'dashboard') loadDashboard();
  if (tab === 'products') loadProducts();
  // ...
});
```

- 使用事件委托监听 Tab 按钮点击
- **按需加载**：切换 Tab 时触发对应的数据加载函数
- 粘性定位（sticky）：Tab 导航固定在页面顶部

### 4.4 通用 Modal 系统

一套 Modal 函数，服务所有 CRUD 操作：

```javascript
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}
// 点击遮罩关闭
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
```

#### 商品 Modal（`openProductModal`）

- 支持**新增**和**编辑**两种模式
- 表单包含：名称、分类(select)、子分类、单价、单位、来源、链接、长宽高、备注
- 分类为下拉选择，限制为 `盒子/辅料/糖果/单品`
- 前端校验：名称不能为空

#### 方案搭建器 Modal（`renderBundleEditor` / `openBundleEditor`）

这是最复杂的功能模块：

```
方案搭建器布局（左右两栏）
┌──────────────────────────────────────────┐
│  方案名称输入                   利润率滑块 │
├──────────────────────────────────────────┤
│  商品池（可滚动）                          │
│  ┌─ 竹篮中号 ¥9.50 ──── [＋] ─┐         │
│  ├─ 雪梨纸 ¥0.20 ──── [＋] ──┤         │
│  └─ ...                      ┘         │
├──────────────────────────────────────────┤
│  已选商品（点击 ✕ 移除）                  │
│  ├─ 竹篮中号 ¥9.50 × 1 ── ¥9.50 ─ [✕] │
│  └─ ...                                 │
├──────────────────────────────────────────┤
│  成本: ¥XX  利润率: XX%  利润: ¥XX  售价: ¥XX │
├──────────────────────────────────────────┤
│           [取消]    [创建/保存]           │
└──────────────────────────────────────────┘
```

- 商品池展示所有商品，支持点击「＋」添加
- 已存在商品点击「＋」累加数量
- 利润率通过滑块实时调整（0%–500%）
- 底部实时显示成本/利润率/利润/售价
- 支持编辑已有方案时加载现有内容

#### 竞品 Modal（`openCompetitorModal`）

- 内容物采用**文本区域**输入，每行一个商品
- 格式: `商品名 | 规格 | 数量`
- 后端解析 `|` 分隔符

#### 待办 Modal（`openChecklistModal`）

- 任务内容、平台选择、优先级选择
- 简洁的三字段表单

### 4.5 计算器页面（`page-calculator`）

```
┌────────────────────────────────────────┐
│  搜索框 [...搜索添加商品...]            │
│  商品池（前30个/搜索结果）              │
│  ┌─ 竹篮中号 ¥9.50 ──── [＋] ─┐      │
│  └─ ...                      ┘      │
├────────────────────────────────────────┤
│  已选商品（可调整数量）                 │
│  ├─ 竹篮中号 ¥9.50 × [2] ─ ¥19.00 [✕]│
│  └─ ...                               │
├────────────────────────────────────────┤
│  利润率: ════●═══════════════ 70%     │
│        [重新计算]                      │
├────────────────────────────────────────┤
│  📊 计算结果                           │
│  成本合计: ¥XX.XX                      │
│  利润金额: ¥XX.XX                      │
│  建议售价: ¥XX.XX                      │
│  取整建议: [向上 ¥XX] [向下 ¥XX] ...  │
└────────────────────────────────────────┘
```

- 搜索过滤商品池
- 数量和利润率实时调整
- 前端渲染已选，通过 `/api/calculator` 后端计算
- 提供 4 种取整定价建议

### 4.6 运营看板页面（`page-ops`）

**策略卡片**：硬编码 4 个平台的运营策略

| 平台 | 颜色 | 策略要点 |
|------|------|---------|
| 📕 小红书 | 红色 | 场景化商品图、带 emoji 标题、中午12点/晚8点发布 |
| 💬 私域(微信) | 绿色 | 每天2-3条、价格锚点、限时折扣 |
| 🐟 闲鱼 | 橙色 | 30字关键词标题、比同行低5-10%、清仓标签 |
| 🏢 B端 | 蓝色 | 企事业团购、定制LOGO、阶梯报价 |

**待办清单**：从后端加载，支持勾选完成、新增、删除

### 4.7 数据流模式

```
用户操作 → fetch API → Express 路由 → better-sqlite3 → SQLite DB
                                                          ↓
用户界面 ← 渲染更新 ← JSON 响应 ← res.json() ←──────────┘
```

- 所有 API 返回统一格式: `{ ok: boolean, data?: any, error?: string }`
- 前端通过 `apiGet/apiPost/apiPut/apiDelete` 四个工具函数调用
- Toast 提示成功/失败，操作后自动刷新列表

### 4.8 CSS 设计要点

- **颜色变量**: `--primary: #6366f1`（靛蓝色主色调）
- **响应式**: 方案搭建器在 <900px 时自动切换单列
- **组件化样式**: 表格、按钮、表单、卡片、Badge、Toast 等均有独立样式
- **用户体验细节**: 悬停效果、过渡动画、滚动条美化

---

## 5. 调试记录

### 5.1 环境变量问题

#### 问题描述
在 server.js 初始化阶段尝试使用 `.env` 文件加载环境变量配置（如端口号、数据库路径等），但遇到以下问题：

- 项目未安装 `dotenv` 包来加载 `.env` 文件
- 尝试通过 `process.env.PORT` 读取时返回 `undefined`
- `.env` 文件不支持在跨平台（WSL ↔ Windows）环境下稳定工作

#### 解决方式
**放弃环境变量方案，改用硬编码明文配置**：

```javascript
// 之前（出现问题）
const PORT = process.env.PORT || 3000;

// 之后（稳定运行）
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'inventory.db');
```

对于单机版管理后台，硬编码更简单可靠。

### 5.2 Provider 配置修正

#### 问题描述
在 WSL 环境下运行 Node.js 时，better-sqlite3 的 native binding 需要正确的编译工具链。初期遇到了以下问题：

1. **better-sqlite3 编译失败** — WSL 缺少 `build-essential` 和 `python3`
2. **Node.js 版本匹配问题** — 本地 Node 版本与 better-sqlite3 预编译包不兼容

#### 解决方式

```bash
# 安装编译工具
sudo apt update && sudo apt install -y build-essential python3

# 重装 better-sqlite3（从源码编译）
npm rebuild better-sqlite3
```

确保 WSL 环境中已安装：
```bash
node --version   # v18+ 或 v20+ 推荐
npm --version    # 9+
```

### 5.3 数据库并发问题

#### 问题描述
better-sqlite3 是同步 API，初始化时多个事务同时写入数据库。

#### 解决方式
启用 WAL 模式提升读写并发性能：

```javascript
db.pragma('journal_mode = WAL');
```

### 5.4 外键约束未生效

#### 问题描述
删除 bundle 时 `bundle_items` 没有自动级联删除。

#### 解决方式
建表时已添加 `ON DELETE CASCADE`，但 SQLite 默认关闭外键约束，需要在初始化时显式开启：

```javascript
db.pragma('foreign_keys = ON');
```

### 5.5 前端 Modal 事件冒泡

#### 问题描述
点击竞品名片详情中的编辑/删除按钮时，触发了父级 `.competitor-card` 的展开/收起事件。

#### 解决方式
在编辑和删除按钮的事件处理器中调用 `event.stopPropagation()`：

```javascript
<button onclick="event.stopPropagation();openCompetitorModal(${c.id})">✏️ 编辑</button>
```

---

## 6. 最终验证

### 6.1 启动方式

```bash
cd /mnt/c/Users/xujin/Documents/WebDev/gift-basket-manager
node server.js
```

输出：
```
🎁 伴手礼管理后台已启动
   本地地址: http://localhost:3000
   数据库: /mnt/c/Users/.../inventory.db
```

### 6.2 所有功能验证清单

#### ✅ 仪表盘
- [x] 显示商品总数（71）及各分类数量
- [x] 显示方案总数（3）
- [x] 显示竞品总数（7）
- [x] 显示待办事项数（5）
- [x] 显示最近 5 个方案列表

#### ✅ 货物清单
- [x] 按分类筛选（全部/盒子/辅料/糖果/单品）
- [x] 搜索商品名称
- [x] 新增商品（含参数校验）
- [x] 编辑商品
- [x] 删除商品（引用保护）
- [x] 显示价格、来源、尺寸信息

#### ✅ 成品方案
- [x] 方案列表展示（含商品明细表格）
- [x] 新建方案（商品池添加/商品数量累加/利润率滑块/实时计算）
- [x] 编辑已有方案（加载现有数据）
- [x] 删除方案
- [x] 状态标签显示（草稿/已发布/下架）
- [x] 成本/售价/利润率/利润展示

#### ✅ 竞品对比
- [x] 竞品名片列表
- [x] 点击展开/收起详情
- [x] 新增竞品（解析文本区域输入的商品列表）
- [x] 编辑竞品
- [x] 删除竞品
- [x] 价格/会员价对比展示

#### ✅ 计算器
- [x] 搜索过滤商品池
- [x] 添加/移除商品
- [x] 调整商品数量
- [x] 利润率滑块实时调整（0%–500%）
- [x] 显示成本合计、利润金额、建议售价
- [x] 4种取整定价建议
- [x] 调用后端 API 计算结果

#### ✅ 运营看板
- [x] 4 个平台策略卡片展示
- [x] 待办清单加载
- [x] 勾选完成/取消完成
- [x] 新增待办（含平台和优先级选择）
- [x] 删除待办

### 6.3 API 端点全部正常响应

| 端点 | 方法 | 测试结果 |
|------|------|---------|
| `/api/dashboard` | GET | ✅ 返回聚合数据 |
| `/api/products` | GET | ✅ 返回 71 条，支持筛选 |
| `/api/products/:id` | GET | ✅ 返回单条详情 |
| `/api/products` | POST | ✅ 创建并返回 |
| `/api/products/:id` | PUT | ✅ 更新并返回 |
| `/api/products/:id` | DELETE | ✅ 删除（含引用检查） |
| `/api/bundles` | GET | ✅ 返回 3 条含明细 |
| `/api/bundles/:id` | GET | ✅ 返回单条含明细 |
| `/api/bundles` | POST | ✅ 自动计算成本/售价 |
| `/api/bundles/:id` | PUT | ✅ 更新+重算 |
| `/api/bundles/:id` | DELETE | ✅ 级联删除 |
| `/api/bundles/:id/items` | POST | ✅ 添加商品+重算 |
| `/api/bundles/:bundleId/items/:itemId` | DELETE | ✅ 移除商品+重算 |
| `/api/competitors` | GET | ✅ 返回 7 条含明细 |
| `/api/competitors/:id` | GET | ✅ 返回单条 |
| `/api/competitors` | POST | ✅ 创建含明细 |
| `/api/competitors/:id` | PUT | ✅ 更新含明细替换 |
| `/api/competitors/:id` | DELETE | ✅ 级联删除 |
| `/api/checklist` | GET | ✅ 返回 5 条 |
| `/api/checklist` | POST | ✅ 创建 |
| `/api/checklist/:id` | PUT | ✅ 更新状态 |
| `/api/checklist/:id` | DELETE | ✅ 删除 |
| `/api/calculator` | POST | ✅ 计算+取整建议 |

### 6.4 数据库状态

```
inventory.db  (SQLite 数据库)
├── products       — 71 条记录
├── bundles        — 3 条记录
├── bundle_items   — 35 条关联记录
├── competitors    — 7 条记录
├── competitor_items — 33 条关联记录
└── ops_checklist  — 5 条记录
```

---

## 附：开发总结

### 技术选型反思

| 选择 | 原因 | 效果 |
|------|------|------|
| **better-sqlite3** vs sqlite3 | 同步API，无需回调/async，简化代码 | ✅ 代码简洁，无回调地狱 |
| **单文件架构** vs 拆分 | 小型管理后台，无需构建工具 | ✅ 快速开发，部署简单 |
| **原生 JS** vs Vue/React | 零依赖，无需学习曲线 | ✅ 功能完整，适合原型 |
| **硬编码配置** vs .env | 单机部署，避免环境变量跨平台问题 | ✅ 启动可靠，无环境问题 |

### 可以改进的方向

1. **分页** — 商品列表数据量大时分页展示
2. **图片上传** — 商品/方案图片管理
3. **数据导出** — CSV/Excel 导出功能
4. **用户认证** — 登录/权限系统
5. **订单管理** — 对接实际订单流程

---

*文档编写日期：2026年5月4日*
*项目版本：v1.0.0*
