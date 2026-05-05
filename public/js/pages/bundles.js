// ─── 方案搭建 ───
async function loadBundles(container) {
  var res = await apiGet('/bundles');
  if (!res.ok) { container.innerHTML = '<div class="empty">加载失败</div>'; return; }
  var bundles = res.data;
  if (bundles.length === 0) {
    container.innerHTML = '<div class="toolbar"><button class="btn btn-gradient" onclick="openBundleModal()">＋ 新建方案</button></div><div class="empty">暂无方案，<a style="color:var(--orange);cursor:pointer" onclick="openBundleModal()">去创建第一个</a></div>';
    return;
  }
  container.innerHTML = '<div class="toolbar"><button class="btn btn-gradient" onclick="openBundleModal()">＋ 新建方案</button></div>' +
    bundles.map(function(b) { return renderBundleCard(b); }).join('');
}

function renderBundleCard(b) {
  var hasImgs = b.images && b.images.length > 0;
  return '<div class="card" style="padding:16px 20px">' +
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">' +
      '<strong style="font-size:16px">' + esc(b.name) + '</strong>' +
      '<span class="badge ' + (b.status === '已发布' ? 'badge-success' : 'badge-muted') + '">' + (b.status || '草稿') + '</span>' +
      (b.box_type ? '<span style="color:var(--text-secondary);font-size:13px">📦 ' + esc(b.box_type) + '</span>' : '') +
      '<div style="flex:1"></div>' +
      '<button class="btn btn-sm" onclick="editBundle(' + b.id + ')">✏️ 编辑</button>' +
      '<button class="btn btn-sm btn-danger" onclick="deleteBundle(' + b.id + ')">🗑️ 删除</button>' +
    '</div>' +
    '<div style="display:flex;gap:16px;font-size:13px;color:var(--text-secondary);margin-bottom:10px">' +
      '<span>成本: <strong>¥' + (b.total_cost || 0).toFixed(2) + '</strong></span>' +
      '<span>售价: <strong style="color:var(--orange)">¥' + (b.sell_price || 0).toFixed(2) + '</strong></span>' +
      '<span>利润率: <strong>' + (b.margin_rate || 0) + '%</strong></span>' +
      '<span>利润: <strong style="color:#10b981">¥' + (b.margin_amount || 0).toFixed(2) + '</strong></span>' +
    '</div>' +
    (hasImgs ? '<div style="display:flex;gap:8px;flex-wrap:wrap">' + b.images.map(function(img) {
      return '<img src="/images/bundles/' + esc(img.image) + '" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer" onclick="window.open(this.src)">';
    }).join('') + '</div>' : '') +
    '<div class="table-wrap" style="margin-top:10px"><table>' +
      '<tr><th>商品</th><th class="text-right">单价</th><th class="text-center">数量</th><th class="text-right">小计</th></tr>' +
      (b.items || []).map(function(i) {
        return '<tr><td>' + esc(i.product_name) + '</td><td class="text-right money">¥' + (i.unit_price || 0).toFixed(2) + '</td><td class="text-center">' + (i.quantity || 1) + '</td><td class="text-right money">¥' + ((i.quantity || 1) * (i.unit_price || 0)).toFixed(2) + '</td></tr>';
      }).join('') +
      '<tr style="font-weight:700;background:#fef7f2"><td colspan="3" class="text-right">合计</td><td class="text-right money">¥' + (b.total_cost || 0).toFixed(2) + '</td></tr>' +
    '</table></div></div>';
}

// ── 方案编辑 Modal ──
let bundleEditor = { bundleId: null, name: '', marginRate: 70, items: [], existingImages: [], newImages: [], allProducts: [] };

async function openBundleModal() {
  bundleEditor = { bundleId: null, name: '', marginRate: 70, items: [], existingImages: [], newImages: [], allProducts: [] };
  var res = await apiGet('/products');
  bundleEditor.allProducts = res.data || [];
  renderBundleModal();
}

async function editBundle(id) {
  var res = await apiGet('/bundles/' + id);
  if (!res.ok) { toast('加载方案失败', 'error'); return; }
  var b = res.data;
  bundleEditor = {
    bundleId: b.id, name: b.name, marginRate: b.margin_rate,
    items: (b.items || []).map(function(i) { return { product_id: i.product_id, product_name: i.product_name, unit_price: i.unit_price, quantity: i.quantity || 1, image: i.image }; }),
    existingImages: b.images || [], newImages: [], allProducts: []
  };
  var pres = await apiGet('/products');
  bundleEditor.allProducts = pres.data || [];
  renderBundleModal();
}

function renderBundleModal() {
  document.getElementById('modal-title').textContent = bundleEditor.bundleId ? '✏️ 编辑方案' : '＋ 新建方案';
  var totalCost = bundleEditor.items.reduce(function(sum, i) { return sum + i.unit_price * i.quantity; }, 0);
  var sellPrice = totalCost * (1 + bundleEditor.marginRate / 100);
  var productsHtml = bundleEditor.allProducts.map(function(p) {
    return '<option value="' + p.id + '">' + p.name + ' (¥' + (p.unit_price || 0).toFixed(2) + ')</option>';
  }).join('');

  document.getElementById('modal-body').innerHTML =
    '<div class="form-group"><label>方案名称 *</label><input id="b-name" value="' + escAttr(bundleEditor.name) + '"></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>利润率 %</label><input type="number" id="b-margin" value="' + bundleEditor.marginRate + '" oninput="updateBundlePreview()"></div>' +
      '<div class="form-group"><label>预览</label><div style="padding:8px;background:#fef7f2;border-radius:6px">成本: <strong id="b-preview-cost">¥' + totalCost.toFixed(2) + '</strong> → 售价: <strong style="color:var(--orange)" id="b-preview-sell">¥' + sellPrice.toFixed(2) + '</strong></div></div>' +
    '</div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>添加商品</label><select id="b-product">' + productsHtml + '</select></div>' +
      '<div class="form-group"><label>数量</label><input type="number" id="b-qty" value="1" min="1" style="max-width:80px"></div>' +
    '</div>' +
    '<button class="btn btn-sm" onclick="addBundleItem()" style="margin-bottom:12px">＋ 加入方案</button>' +
    '<div id="b-items">' + bundleEditor.items.map(function(i, idx) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border-light)">' +
        '<span style="flex:1">' + esc(i.product_name) + '</span>' +
        '<span style="min-width:60px;text-align:right">¥' + i.unit_price.toFixed(2) + '</span>' +
        '<span>×</span><input type="number" value="' + i.quantity + '" min="1" style="width:50px" onchange="bundleEditor.items[' + idx + '].quantity=parseInt(this.value)||1;updateBundlePreview()">' +
        '<button class="btn-icon" onclick="bundleEditor.items.splice(' + idx + ',1);renderBundleModal()">✕</button></div>';
    }).join('') + '</div>';
  document.getElementById('modal-footer').innerHTML =
    '<button class="btn" onclick="closeModal()">取消</button>' +
    '<button class="btn btn-gradient" onclick="saveBundle()">' + (bundleEditor.bundleId ? '保存' : '创建') + '</button>';
  document.getElementById('modal-overlay').classList.add('active');
}

function addBundleItem() {
  var pid = parseInt(document.getElementById('b-product').value);
  var qty = parseInt(document.getElementById('b-qty').value) || 1;
  var product = bundleEditor.allProducts.find(function(p) { return p.id === pid; });
  if (!product) return;
  var existing = bundleEditor.items.find(function(i) { return i.product_id === pid; });
  if (existing) { existing.quantity += qty; }
  else { bundleEditor.items.push({ product_id: pid, product_name: product.name, unit_price: product.unit_price, quantity: qty, image: product.image }); }
  renderBundleModal();
}

function updateBundlePreview() {
  var rate = parseFloat(document.getElementById('b-margin').value) || 70;
  var totalCost = bundleEditor.items.reduce(function(sum, i) { return sum + i.unit_price * i.quantity; }, 0);
  document.getElementById('b-preview-cost').textContent = '¥' + totalCost.toFixed(2);
  document.getElementById('b-preview-sell').textContent = '¥' + (totalCost * (1 + rate / 100)).toFixed(2);
}

async function saveBundle() {
  var name = document.getElementById('b-name').value;
  if (!name) { toast('请输入方案名称', 'error'); return; }
  var marginRate = parseFloat(document.getElementById('b-margin').value) || 70;
  var items = bundleEditor.items.map(function(i) { return { product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price }; });
  if (items.length === 0) { toast('方案至少包含1个商品', 'error'); return; }
  var body = { name: name, margin_rate: marginRate, items: items };
  var res = bundleEditor.bundleId ? await apiPut('/bundles/' + bundleEditor.bundleId, body) : await apiPost('/bundles', body);
  if (res.ok) { toast(bundleEditor.bundleId ? '方案已更新' : '方案已创建'); closeModal(); loadBundles(document.getElementById('page-container')); }
  else toast(res.error || '操作失败', 'error');
}

async function deleteBundle(id) {
  if (!confirm('确定删除该方案？')) return;
  var res = await apiDelete('/bundles/' + id);
  if (res.ok) { toast('已删除'); loadBundles(document.getElementById('page-container')); }
  else toast(res.error || '删除失败', 'error');
}
