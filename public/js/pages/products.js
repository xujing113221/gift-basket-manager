// ─── 商品库 ───
let productsCache = [];
let productFilter = '';
let productSearch = '';
let productViewMode = 'grid';
let productSortField = null;
let productSortDir = 'asc';

function setProductView(mode) {
  productViewMode = mode;
  renderProducts();
}

async function loadProducts(container) {
  var res = await apiGet('/products');
  if (res.ok) { productsCache = res.data; renderProducts(); }
}

function renderProducts() {
  var list = productsCache;
  if (productFilter) list = list.filter(function(p) { return p.category === productFilter; });
  if (productSearch) list = list.filter(function(p) { return p.name.indexOf(productSearch) > -1; });

  if (productSortField) {
    var dir = productSortDir === 'asc' ? 1 : -1;
    var field = productSortField;
    list = list.slice().sort(function(a, b) {
      var va = a[field], vb = b[field];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'zh-CN') * dir;
    });
  }

  var container = document.getElementById('page-container');
  container.innerHTML =
    '<div class="toolbar">' +
      '<div class="filter-chips" id="product-filters">' +
        '<span class="chip active" data-category="">全部</span>' +
        '<span class="chip" data-category="盒子">📦 盒子</span>' +
        '<span class="chip" data-category="辅料">🎀 辅料</span>' +
        '<span class="chip" data-category="糖果">🍬 糖果</span>' +
        '<span class="chip" data-category="单品">🎁 单品</span>' +
      '</div>' +
      '<input class="search-input" id="product-search-input" placeholder="搜索商品..." value="' + escAttr(productSearch) + '">' +
      '<div class="spacer"></div>' +
      '<button class="btn btn-sm" onclick="setProductView(\'grid\')" style="' + (productViewMode==='grid'?'background:var(--gradient);color:white;border:none;':'') + '">⊞</button>' +
      '<button class="btn btn-sm" onclick="setProductView(\'list\')" style="' + (productViewMode==='list'?'background:var(--gradient);color:white;border:none;':'') + '">☰</button>' +
      '<button class="btn btn-gradient btn-sm" onclick="openProductModal()">＋ 新增</button>' +
      '<button class="btn btn-sm" style="background:var(--gradient-warm);color:white;border:none" onclick="openAIImport()">🤖 AI导入</button>' +
    '</div>' +
    '<div id="product-render-area"></div>';

  // 绑定筛选事件
  document.getElementById('product-filters').addEventListener('click', function(e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('#product-filters .chip').forEach(function(c) { c.classList.remove('active'); });
    chip.classList.add('active');
    productFilter = chip.dataset.category;
    renderProducts();
  });
  document.getElementById('product-search-input').addEventListener('input', function(e) {
    productSearch = e.target.value;
    renderProducts();
  });

  if (productViewMode === 'list') renderProductsTable(list);
  else renderProductsGrid(list);
}

// ─── 列表模式（表格） ───
function renderProductsTable(list) {
  var area = document.getElementById('product-render-area');
  if (!list.length) { area.innerHTML = '<div class="card"><div class="empty">暂无商品</div></div>'; return; }

  var ascArrow = ' <span class="sort-arrow"></span>';
  function sortTh(field, label) {
    var cls = (field === productSortField) ? (' sorted sorted-' + productSortDir) : '';
    return '<th class="sortable' + cls + '" data-sort="' + field + '">' + label + '<span class="sort-arrow"></span></th>';
  }

  area.innerHTML =
    '<div class="card" style="padding:0"><div class="table-wrap"><table>' +
      '<thead><tr>' +
        '<th style="width:56px">图片</th>' +
        sortTh('name', '名称') +
        sortTh('category', '分类') +
        '<th class="sortable text-right' + (productSortField==='unit_price'?' sorted sorted-'+productSortDir:'') + '" data-sort="unit_price">单价<span class="sort-arrow"></span></th>' +
        '<th class="sortable text-center' + (productSortField==='stock'?' sorted sorted-'+productSortDir:'') + '" data-sort="stock">库存<span class="sort-arrow"></span></th>' +
        sortTh('source', '来源') +
        '<th class="sortable' + (productSortField==='box_length'?' sorted sorted-'+productSortDir:'') + '" data-sort="box_length">尺寸<span class="sort-arrow"></span></th>' +
        '<th style="width:100px">操作</th>' +
      '</tr></thead>' +
      '<tbody>' + list.map(function(p) {
        return '<tr>' +
          '<td>' + (p.image
            ? '<img src="/images/' + esc(p.image) + '" class="thumb-img" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';"><div class="thumb-placeholder" style="display:none">📷</div>'
            : '<div class="thumb-placeholder">📷</div>') + '</td>' +
          '<td><a style="color:var(--orange);cursor:pointer;font-weight:600" onclick="productDetail(' + p.id + ')">' + esc(p.name) + '</a></td>' +
          '<td><span class="badge badge-primary">' + p.category + '</span></td>' +
          '<td class="text-right money">¥' + (p.unit_price || 0).toFixed(2) +
            ((p.unit_price > 10 && p.category !== '盒子') ? ' <span class="price-warn" title="价格偏高，可能是总价？点击编辑修正">⚠️</span>' : '') + '</td>' +
          '<td class="text-center">' + (p.stock || 0) + '</td>' +
          '<td>' + (p.source || '-') + '</td>' +
          '<td>' + (p.box_length ? p.box_length + '×' + (p.box_width||'-') + '×' + (p.box_height||'-') : '-') + '</td>' +
          '<td><div class="btn-group">' +
            '<button class="btn-icon" onclick="productDetail(' + p.id + ')" title="详情">📋</button>' +
            '<button class="btn-icon" onclick="openProductModal(' + p.id + ')" title="编辑">✏️</button>' +
            '<button class="btn-icon" onclick="deleteProduct(' + p.id + ')" title="删除">🗑️</button>' +
          '</div></td></tr>';
      }).join('') + '</tbody>' +
    '</table></div></div>';

  // 表头排序事件
  area.querySelector('thead').addEventListener('click', function(e) {
    var th = e.target.closest('th.sortable');
    if (!th) return;
    var field = th.dataset.sort;
    if (productSortField === field) productSortDir = productSortDir === 'asc' ? 'desc' : 'asc';
    else { productSortField = field; productSortDir = 'asc'; }
    renderProducts();
  });
}

// ─── 网格模式 ───
function renderProductsGrid(list) {
  var el = document.getElementById('product-render-area');
  if (!list.length) { el.innerHTML = '<div class="empty">暂无商品</div>'; return; }
  el.innerHTML = '<div class="card-grid">' + list.map(function(p) {
    return '<div class="card stat-card" style="cursor:pointer;text-align:left;padding:0;overflow:hidden" onclick="productDetail(' + p.id + ')">' +
      '<div style="aspect-ratio:1;background:#fef7f2;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative">' +
        (p.image ? '<img src="/images/' + esc(p.image) + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">' : '<div style="font-size:48px;opacity:0.3">📦</div>') +
        '<span class="badge badge-primary" style="position:absolute;top:8px;right:8px">' + p.category + '</span>' +
      '</div>' +
      '<div style="padding:12px 14px 14px">' +
        '<div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.name) + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:4px;font-size:13px">' +
          '<strong style="color:var(--orange)">¥' + (p.unit_price || 0).toFixed(2) + '</strong>' +
          ((p.unit_price > 10 && p.category !== '盒子') ? ' <span class="price-warn" title="可能为总价">⚠️</span>' : '') +
          '<span style="color:var(--text-secondary)">库存: ' + (p.stock || 0) + '</span>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);margin-top:3px">' + (p.source || '') + (p.box_length ? ' · ' + p.box_length + '×' + (p.box_width||'') + 'cm' : '') + '</div>' +
      '</div></div>';
  }).join('') + '</div>';
}

// ── 商品详情弹窗 ──
function productDetail(id) {
  var product = productsCache.find(function(p) { return p.id === id; });
  if (!product) return;
  document.getElementById('modal-title').textContent = '📋 商品详情';
  document.getElementById('modal-body').innerHTML =
    '<div style="display:flex;gap:20px;flex-wrap:wrap">' +
      '<div style="flex-shrink:0;width:160px;text-align:center">' +
        (product.image ? '<img src="/images/' + esc(product.image) + '" style="width:100%;border-radius:8px;border:1px solid var(--border)">' : '<div style="width:160px;height:160px;display:flex;align-items:center;justify-content:center;background:#fef7f2;border-radius:8px;font-size:48px">📷</div>') +
      '</div>' +
      '<div style="flex:1;min-width:240px">' +
        '<h3 style="margin:0 0 12px 0">' + esc(product.name) + '</h3>' +
        '<div class="form-row" style="grid-template-columns:1fr 1fr;gap:8px;font-size:14px">' +
          '<div><span style="color:var(--text-secondary)">分类:</span> <span class="badge badge-primary">' + product.category + '</span></div>' +
          '<div><span style="color:var(--text-secondary)">子分类:</span> ' + (product.subcategory || '-') + '</div>' +
          '<div><span style="color:var(--text-secondary)">单价:</span> <strong>¥' + (product.unit_price || 0).toFixed(2) + '</strong> / ' + (product.unit || '个') + '</div>' +
          '<div><span style="color:var(--text-secondary)">来源:</span> ' + (product.source || '-') + '</div>' +
          '<div><span style="color:var(--text-secondary)">尺寸:</span> ' + (product.box_length ? product.box_length + '×' + (product.box_width||'-') + '×' + (product.box_height||'-') + ' cm' : '-') + '</div>' +
          '<div><span style="color:var(--text-secondary)">库存:</span> ' + (product.stock || 0) + '</div>' +
        '</div>' +
        (product.link ? '<div style="margin-top:8px"><span style="color:var(--text-secondary)">链接:</span> <a href="' + escAttr(product.link) + '" target="_blank" style="color:var(--orange);word-break:break-all">' + esc(product.link) + '</a></div>' : '') +
        (product.notes ? '<div style="margin-top:8px"><span style="color:var(--text-secondary)">备注:</span> ' + esc(product.notes) + '</div>' : '') +
      '</div></div>';
  document.getElementById('modal-footer').innerHTML =
    '<button class="btn" onclick="closeModal()">关闭</button>' +
    '<button class="btn btn-gradient" onclick="closeModal();openProductModal(' + product.id + ')">✏️ 编辑</button>';
  document.getElementById('modal-overlay').classList.add('active');
}

// ── 商品编辑 Modal（支持总价/单价双模式） ──
let pendingImage = null;
let priceMode = 'unit'; // 'unit' | 'total'

function openProductModal(id) {
  var isEdit = !!id;
  var product = isEdit ? productsCache.find(function(p) { return p.id === id; }) : null;
  pendingImage = null;
  priceMode = 'unit';

  document.getElementById('modal-title').textContent = isEdit ? '✏️ 编辑商品' : '＋ 新增商品';
  document.getElementById('modal-body').innerHTML =
    '<div class="form-group"><label>名称 *</label><input id="pf-name" value="' + escAttr(product ? product.name : '') + '"></div>' +
    '<div class="form-group"><label>商品图片</label>' +
      '<div style="border:2px dashed var(--border);border-radius:8px;padding:12px;text-align:center;cursor:pointer" onclick="this.querySelector(\'input\').click()">' +
        '<input type="file" accept="image/*" capture="environment" onchange="handleImageSelect(this)" style="display:none">' +
        '<div id="pf-img-preview">' + (product && product.image ? '<img src="/images/' + esc(product.image) + '" style="max-width:160px;max-height:160px;border-radius:8px"><br><small style="color:var(--text-secondary)">📸 点击更换照片</small>' : '📸 点击拍照或选图') + '</div>' +
      '</div></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>分类 *</label><select id="pf-category">' + ['盒子','辅料','糖果','单品'].map(function(c) { return '<option' + (product && product.category === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label>子分类</label><input id="pf-sub" value="' + escAttr(product ? product.subcategory || '' : '') + '"></div>' +
    '</div>' +
    // ─── 价格模式切换 ───
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
      '<span style="font-size:13px;color:var(--text-secondary)">计价方式:</span>' +
      '<button class="btn btn-sm" id="pm-unit" style="' + (priceMode==='unit'?'background:var(--gradient);color:white;border:none':'') + '" onclick="switchPriceMode(\'unit\')">按单价</button>' +
      '<button class="btn btn-sm" id="pm-total" style="' + (priceMode==='total'?'background:var(--gradient);color:white;border:none':'') + '" onclick="switchPriceMode(\'total\')">按总价</button>' +
    '</div>' +
    // 单价模式
    '<div id="price-unit-block" style="display:' + (priceMode==='unit'?'block':'none') + '">' +
      '<div class="form-row">' +
        '<div class="form-group"><label>单价 (¥)</label><input type="number" step="0.01" id="pf-unitprice" value="' + (product ? product.unit_price || 0 : 0) + '" oninput="calcTotalFromUnit()"></div>' +
        '<div class="form-group"><label>数量</label><input type="number" id="pf-qty-unit" value="1" min="1" oninput="calcTotalFromUnit()"></div>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">总价: <strong id="pf-total-display">¥0.00</strong></div>' +
    '</div>' +
    // 总价模式
    '<div id="price-total-block" style="display:' + (priceMode==='total'?'block':'none') + '">' +
      '<div class="form-row">' +
        '<div class="form-group"><label>总价 (¥)</label><input type="number" step="0.01" id="pf-total" value="0" oninput="calcUnitFromTotal()"></div>' +
        '<div class="form-group"><label>数量</label><input type="number" id="pf-qty-total" value="1" min="1" oninput="calcUnitFromTotal()"></div>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">单价: <strong id="pf-unit-display">¥0.00</strong> / 个</div>' +
    '</div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>库存</label><input type="number" id="pf-stock" value="' + (product ? product.stock || 0 : 0) + '"></div>' +
      '<div class="form-group"><label>单位</label><input id="pf-unit" value="' + escAttr(product ? product.unit || '个' : '个') + '"></div>' +
    '</div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>来源</label><input id="pf-source" value="' + escAttr(product ? product.source || '' : '') + '"></div>' +
      '<div class="form-group"><label>最低库存预警</label><input type="number" id="pf-minstock" value="' + (product ? product.min_stock || 5 : 5) + '"></div>' +
    '</div>' +
    '<div class="form-group"><label>链接</label><input id="pf-link" value="' + escAttr(product ? product.link || '' : '') + '"></div>' +
    '<div class="form-row-3">' +
      '<div class="form-group"><label>长(cm)</label><input type="number" step="0.1" id="pf-len" value="' + (product ? product.box_length || '' : '') + '"></div>' +
      '<div class="form-group"><label>宽(cm)</label><input type="number" step="0.1" id="pf-wid" value="' + (product ? product.box_width || '' : '') + '"></div>' +
      '<div class="form-group"><label>高(cm)</label><input type="number" step="0.1" id="pf-hei" value="' + (product ? product.box_height || '' : '') + '"></div>' +
    '</div>' +
    '<div class="form-group"><label>备注</label><textarea id="pf-notes">' + escAttr(product ? product.notes || '' : '') + '</textarea></div>';

  document.getElementById('modal-footer').innerHTML =
    '<button class="btn" onclick="closeModal()">取消</button>' +
    '<button class="btn btn-gradient" onclick="saveProduct(' + (id || '') + ')">' + (isEdit ? '保存修改' : '创建') + '</button>';
  document.getElementById('modal-overlay').classList.add('active');

  // 初始计算
  if (priceMode === 'unit') calcTotalFromUnit();
  else calcUnitFromTotal();
}

function switchPriceMode(mode) {
  priceMode = mode;
  document.getElementById('pm-unit').style.background = mode === 'unit' ? 'var(--gradient)' : '';
  document.getElementById('pm-unit').style.color = mode === 'unit' ? 'white' : '';
  document.getElementById('pm-unit').style.border = mode === 'unit' ? 'none' : '';
  document.getElementById('pm-total').style.background = mode === 'total' ? 'var(--gradient)' : '';
  document.getElementById('pm-total').style.color = mode === 'total' ? 'white' : '';
  document.getElementById('pm-total').style.border = mode === 'total' ? 'none' : '';
  document.getElementById('price-unit-block').style.display = mode === 'unit' ? 'block' : 'none';
  document.getElementById('price-total-block').style.display = mode === 'total' ? 'block' : 'none';
  if (mode === 'unit') calcTotalFromUnit();
  else calcUnitFromTotal();
}

function calcTotalFromUnit() {
  var up = parseFloat(document.getElementById('pf-unitprice').value) || 0;
  var qty = parseInt(document.getElementById('pf-qty-unit').value) || 1;
  document.getElementById('pf-total-display').textContent = '¥' + (up * qty).toFixed(2);
}

function calcUnitFromTotal() {
  var total = parseFloat(document.getElementById('pf-total').value) || 0;
  var qty = parseInt(document.getElementById('pf-qty-total').value) || 1;
  var up = qty > 0 ? total / qty : 0;
  document.getElementById('pf-unit-display').textContent = '¥' + up.toFixed(2) + ' / 个';
}

function handleImageSelect(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    pendingImage = e.target.result;
    document.getElementById('pf-img-preview').innerHTML = '<img src="' + e.target.result + '" style="max-width:160px;max-height:160px;border-radius:8px"><br><small style="color:#10b981">已选择: ' + file.name + '</small>';
  };
  reader.readAsDataURL(file);
}

async function saveProduct(id) {
  var unit_price;
  if (priceMode === 'total') {
    var total = parseFloat(document.getElementById('pf-total').value) || 0;
    var qty = parseInt(document.getElementById('pf-qty-total').value) || 1;
    unit_price = total / qty;
  } else {
    unit_price = parseFloat(document.getElementById('pf-unitprice').value) || 0;
  }

  var body = {
    name: document.getElementById('pf-name').value,
    category: document.getElementById('pf-category').value,
    subcategory: document.getElementById('pf-sub').value,
    unit_price: unit_price,
    stock: parseInt(document.getElementById('pf-stock').value) || 0,
    unit: document.getElementById('pf-unit').value || '个',
    source: document.getElementById('pf-source').value,
    link: document.getElementById('pf-link').value,
    box_length: parseFloat(document.getElementById('pf-len').value) || null,
    box_width: parseFloat(document.getElementById('pf-wid').value) || null,
    box_height: parseFloat(document.getElementById('pf-hei').value) || null,
    min_stock: parseInt(document.getElementById('pf-minstock').value) || 5,
    notes: document.getElementById('pf-notes').value
  };
  if (!body.name) { toast('请输入商品名称', 'error'); return; }
  var res = id ? await apiPut('/products/' + id, body) : await apiPost('/products', body);
  if (res.ok) {
    if (pendingImage && res.data && res.data.id) {
      await apiPost('/products/' + res.data.id + '/image', { image: pendingImage });
    }
    toast(id ? '保存成功' : '创建成功'); closeModal(); loadProducts();
  } else { toast(res.error || '操作失败', 'error'); }
}

async function deleteProduct(id) {
  if (!confirm('确定删除该商品？')) return;
  var res = await apiDelete('/products/' + id);
  if (res.ok) { toast('已删除'); loadProducts(); }
  else toast(res.error || '删除失败', 'error');
}

// ─── AI 智能导入 ───
let aiImageData = null;

function openAIImport() {
  aiImageData = null;
  document.getElementById('modal-title').textContent = '🤖 AI 智能导入';
  document.getElementById('modal-body').innerHTML =
    '<div style="text-align:center;padding:10px 0 20px;color:var(--text-secondary);font-size:13px">拍照/截图 或 粘贴链接，AI 自动识别商品信息</div>' +
    // ── 图片上传 ──
    '<div style="border:2px dashed var(--orange);border-radius:12px;padding:20px;text-align:center;cursor:pointer;margin-bottom:12px" onclick="this.querySelector(\'input\').click()">' +
      '<input type="file" accept="image/*" capture="environment" onchange="handleAIImageSelect(this)" style="display:none">' +
      '<div id="ai-img-preview">📸 点击拍照或选择截图</div>' +
    '</div>' +
    // ── 链接输入 ──
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
      '<span style="color:var(--text-secondary);white-space:nowrap">🔗 或贴链接:</span>' +
      '<input id="ai-url" placeholder="粘贴 1688/拼多多 商品链接" style="flex:1">' +
    '</div>' +
    '<div id="ai-result"></div>';
  document.getElementById('modal-footer').innerHTML =
    '<button class="btn" onclick="closeModal()">取消</button>' +
    '<button class="btn btn-gradient" id="btn-ai-import" onclick="doAIImport()">🔍 开始识别</button>';
  document.getElementById('modal-overlay').classList.add('active');
}

function handleAIImageSelect(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    aiImageData = e.target.result;
    document.getElementById('ai-img-preview').innerHTML = '<img src="' + e.target.result + '" style="max-width:200px;max-height:200px;border-radius:8px"><br><small style="color:#10b981">已选择: ' + file.name + '</small>';
  };
  reader.readAsDataURL(file);
}

async function doAIImport() {
  var url = document.getElementById('ai-url').value.trim();
  if (!aiImageData && !url) { toast('请拍照/截图 或 输入商品链接', 'error'); return; }

  var btn = document.getElementById('btn-ai-import');
  btn.disabled = true; btn.textContent = '⏳ AI 识别中...';
  document.getElementById('ai-result').innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">⏳ 正在调用 AI 识别...</div>';

  var body = {};
  if (aiImageData) body.image = aiImageData;
  else body.url = url;

  var res = await apiPost('/ai-import', body);
  if (res.ok) {
    document.getElementById('ai-result').innerHTML = renderAIResult(res.data);
  } else {
    document.getElementById('ai-result').innerHTML = '<div style="color:#ef4444;padding:12px;background:#fef2f2;border-radius:8px">❌ ' + esc(res.error) + '</div>';
  }
  btn.disabled = false; btn.textContent = '🔍 开始识别';
}

var aiExtractedData = null;

function renderAIResult(data) {
  aiExtractedData = data;
  return '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px;margin-top:12px">' +
    '<div style="font-weight:600;color:#166534;margin-bottom:8px">✅ AI 识别结果</div>' +
    '<div class="form-row" style="grid-template-columns:1fr 1fr">' +
      '<div><span style="color:var(--text-secondary)">名称:</span> ' + esc(data.name || '') + '</div>' +
      '<div><span style="color:var(--text-secondary)">分类:</span> ' + esc(data.category || '') + '</div>' +
      '<div><span style="color:var(--text-secondary)">单价:</span> ¥' + (data.unit_price || 0).toFixed(2) + ' / ' + esc(data.unit || '个') + '</div>' +
      '<div><span style="color:var(--text-secondary)">来源:</span> ' + esc(data.source || '') + '</div>' +
    '</div>' +
    (data.notes ? '<div style="margin-top:6px"><span style="color:var(--text-secondary)">备注:</span> ' + esc(data.notes) + '</div>' : '') +
    '<div style="margin-top:12px;display:flex;gap:8px">' +
      '<button class="btn btn-gradient btn-sm" onclick="fillFromAI()">📋 填入表单</button>' +
      '<button class="btn btn-sm" onclick="aiImageData=null;openAIImport()">🔄 重新识别</button>' +
    '</div>' +
  '</div>';
}

function fillFromAI() {
  if (!aiExtractedData) return;
  closeModal();
  openProductModal();
  // 延迟填入（等 DOM 渲染完成）
  setTimeout(function() {
    var d = aiExtractedData;
    document.getElementById('pf-name').value = d.name || '';
    document.getElementById('pf-category').value = ['盒子','辅料','糖果','单品'].indexOf(d.category) >= 0 ? d.category : '单品';
    document.getElementById('pf-unitprice').value = d.unit_price || 0;
    document.getElementById('pf-unit').value = d.unit || '个';
    document.getElementById('pf-source').value = d.source || '';
    document.getElementById('pf-link').value = document.getElementById('ai-url') ? document.getElementById('ai-url').value : '';
    document.getElementById('pf-notes').value = d.notes || '';
    if (d.box_length) document.getElementById('pf-len').value = d.box_length;
    if (d.box_width) document.getElementById('pf-wid').value = d.box_width;
    if (d.box_height) document.getElementById('pf-hei').value = d.box_height;
    calcTotalFromUnit();
    toast('AI 信息已填入，请核对后保存');
  }, 300);
}
