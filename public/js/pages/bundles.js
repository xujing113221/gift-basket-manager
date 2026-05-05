// ─── 方案搭建 ───
let bundleEditor = { bundleId: null, name: '', marginRate: 70, items: [], nested: [], existingImages: [], newImages: [], allProducts: [], allBundles: [] };

async function loadBundles(container) {
  var [bRes, pRes] = await Promise.all([apiGet('/bundles'), apiGet('/products')]);
  if (!bRes.ok) { container.innerHTML = '<div class="empty">加载失败</div>'; return; }
  var bundles = bRes.data;
  if (bundles.length === 0) {
    container.innerHTML = '<div class="toolbar"><button class="btn btn-gradient" onclick="openBundleModal()">＋ 新建方案</button></div><div class="empty">暂无方案，<a style="color:var(--orange);cursor:pointer" onclick="openBundleModal()">去创建第一个</a></div>';
    return;
  }
  container.innerHTML = '<div class="toolbar"><button class="btn btn-gradient" onclick="openBundleModal()">＋ 新建方案</button></div>' +
    bundles.map(function(b) { return renderBundleCard(b); }).join('');
}

function renderBundleCard(b) {
  var hasImgs = b.images && b.images.length > 0;
  var hasNested = b.nested && b.nested.length > 0;
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
    (hasNested ? '<div style="margin-top:8px;font-size:13px;color:var(--text-secondary)">📎 包含子方案: ' + b.nested.map(function(n) { return '<strong>' + esc(n.bundle_name) + '</strong> ×' + n.quantity; }).join(', ') + '</div>' : '') +
    '<div class="table-wrap" style="margin-top:10px"><table>' +
      '<tr><th>商品</th><th class="text-right">单价</th><th class="text-center">数量</th><th class="text-right">小计</th></tr>' +
      (b.items || []).map(function(i) {
        return '<tr><td>' + esc(i.product_name) + '</td><td class="text-right money">¥' + (i.unit_price || 0).toFixed(2) + '</td><td class="text-center">' + (i.quantity || 1) + '</td><td class="text-right money">¥' + ((i.quantity || 1) * (i.unit_price || 0)).toFixed(2) + '</td></tr>';
      }).join('') +
      '<tr style="font-weight:700;background:#fef7f2"><td colspan="3" class="text-right">合计</td><td class="text-right money">¥' + (b.total_cost || 0).toFixed(2) + '</td></tr>' +
    '</table></div></div>';
}

// ── 方案编辑 Modal ──

async function openBundleModal() {
  var [pRes, bRes] = await Promise.all([apiGet('/products'), apiGet('/bundles')]);
  bundleEditor = { bundleId: null, name: '', marginRate: 70, items: [], nested: [], existingImages: [], newImages: [], allProducts: pRes.data || [], allBundles: bRes.data || [] };
  renderBundleModal();
}

async function editBundle(id) {
  var [bRes, pRes, abRes] = await Promise.all([apiGet('/bundles/' + id), apiGet('/products'), apiGet('/bundles')]);
  if (!bRes.ok) { toast('加载方案失败', 'error'); return; }
  var b = bRes.data;
  bundleEditor = {
    bundleId: b.id, name: b.name, marginRate: b.margin_rate,
    items: (b.items || []).map(function(i) { return { product_id: i.product_id, product_name: i.product_name, unit_price: i.unit_price, quantity: i.quantity || 1, image: i.image }; }),
    nested: b.nested || [],
    existingImages: b.images || [], newImages: [],
    allProducts: pRes.data || [],
    allBundles: (abRes.data || []).filter(function(bb) { return bb.id !== b.id; })
  };
  renderBundleModal();
}

function renderBundleModal() {
  var totalCost = bundleEditor.items.reduce(function(sum, i) { return sum + i.unit_price * i.quantity; }, 0);
  // 加上子方案成本
  bundleEditor.nested.forEach(function(n) {
    var child = bundleEditor.allBundles.find(function(bb) { return bb.id === n.bundle_id; }) || n;
    totalCost += (child.total_cost || n.total_cost || 0) * (n.quantity || 1);
  });
  var sellPrice = totalCost * (1 + bundleEditor.marginRate / 100);
  var productsHtml = bundleEditor.allProducts.map(function(p) {
    return '<option value="' + p.id + '">' + p.name + ' (¥' + (p.unit_price || 0).toFixed(2) + ')</option>';
  }).join('');

  // 可选子方案（排除自身和已有嵌套）
  var existingNestedIds = bundleEditor.nested.map(function(n) { return n.bundle_id; });
  var availableBundles = bundleEditor.allBundles.filter(function(bb) {
    return bb.id !== bundleEditor.bundleId && existingNestedIds.indexOf(bb.id) === -1;
  });
  var bundlesHtml = availableBundles.map(function(bb) {
    return '<option value="' + bb.id + '">' + bb.name + ' (¥' + (bb.total_cost || 0).toFixed(2) + ')</option>';
  }).join('');

  document.getElementById('modal-title').textContent = bundleEditor.bundleId ? '✏️ 编辑方案' : '＋ 新建方案';
  document.getElementById('modal-body').innerHTML =
    '<div class="form-group"><label>方案名称 *</label><input id="b-name" value="' + escAttr(bundleEditor.name) + '"></div>' +
    // ─── 图片上传区 ───
    '<div class="form-group"><label>方案展示图</label>' +
      '<div style="border:2px dashed var(--border);border-radius:8px;padding:12px;text-align:center;cursor:pointer" onclick="this.querySelector(\'input\').click()">' +
        '<input type="file" accept="image/*" capture="environment" onchange="handleBundleImageSelect(this)" style="display:none">' +
        '<div id="b-img-preview">' +
          (bundleEditor.existingImages.length > 0
            ? '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">' + bundleEditor.existingImages.map(function(img, idx) {
                return '<div style="position:relative"><img src="/images/bundles/' + esc(img.image) + '" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--border)"><button style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:white;border:none;border-radius:50%;width:20px;height:20px;font-size:12px;line-height:1;cursor:pointer" onclick="event.stopPropagation();removeBundleImage(' + idx + ')">✕</button></div>';
              }).join('') + '</div><br><small style="color:var(--text-secondary)">📸 点击添加照片</small>'
            : '📸 点击拍照或选图') +
          (bundleEditor.newImages.length > 0 ? '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;justify-content:center">' + bundleEditor.newImages.map(function(img, idx) {
            return '<div style="position:relative"><img src="' + img.data + '" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:2px solid #10b981"><button style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:white;border:none;border-radius:50%;width:20px;height:20px;font-size:12px;line-height:1;cursor:pointer" onclick="event.stopPropagation();bundleEditor.newImages.splice(' + idx + ',1);renderBundleModal()">✕</button></div>';
          }).join('') + '</div>' : '') +
        '</div>' +
      '</div></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>利润率 %</label><input type="number" id="b-margin" value="' + bundleEditor.marginRate + '" oninput="updateBundlePreview()"></div>' +
      '<div class="form-group"><label>预览</label><div style="padding:8px;background:#fef7f2;border-radius:6px">成本: <strong id="b-preview-cost">¥' + totalCost.toFixed(2) + '</strong> → 售价: <strong style="color:var(--orange)" id="b-preview-sell">¥' + sellPrice.toFixed(2) + '</strong></div></div>' +
    '</div>' +
    // ─── 添加商品 ───
    '<div class="form-row">' +
      '<div class="form-group"><label>添加商品</label><select id="b-product">' + productsHtml + '</select></div>' +
      '<div class="form-group"><label>数量</label><input type="number" id="b-qty" value="1" min="1" style="max-width:80px"></div>' +
    '</div>' +
    '<button class="btn btn-sm" onclick="addBundleItem()" style="margin-bottom:12px">＋ 加入方案</button>' +
    // ─── 添加子方案 ───
    (availableBundles.length > 0 ? '<div class="form-row">' +
      '<div class="form-group"><label>嵌套子方案</label><select id="b-nested-bundle"><option value="">— 选择 —</option>' + bundlesHtml + '</select></div>' +
      '<div class="form-group"><label>数量</label><input type="number" id="b-nested-qty" value="1" min="1" style="max-width:80px"></div>' +
    '</div>' +
    '<button class="btn btn-sm" onclick="addNestedBundle()" style="margin-bottom:12px;background:#fef7f2;border:1px dashed var(--orange);color:var(--orange)">📎 嵌套方案</button>' : '') +
    // ─── 商品列表 ───
    '<div id="b-items">' + bundleEditor.items.map(function(i, idx) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border-light)">' +
        '<span style="flex:1">📦 ' + esc(i.product_name) + '</span>' +
        '<span style="min-width:60px;text-align:right">¥' + i.unit_price.toFixed(2) + '</span>' +
        '<span>×</span><input type="number" value="' + i.quantity + '" min="1" style="width:50px" onchange="bundleEditor.items[' + idx + '].quantity=parseInt(this.value)||1;updateBundlePreview()">' +
        '<button class="btn-icon" onclick="bundleEditor.items.splice(' + idx + ',1);renderBundleModal()">✕</button></div>';
    }).join('') + '</div>' +
    // ─── 子方案列表 ───
    (bundleEditor.nested.length > 0 ? '<div style="margin-top:8px;font-size:13px;color:var(--text-secondary)">📎 嵌套子方案:</div>' + bundleEditor.nested.map(function(n, idx) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border-light)">' +
        '<span style="flex:1">📎 ' + esc(n.bundle_name || '方案#' + n.bundle_id) + '</span>' +
        '<span style="min-width:60px;text-align:right">¥' + (n.total_cost || 0).toFixed(2) + '</span>' +
        '<span>×</span><input type="number" value="' + (n.quantity || 1) + '" min="1" style="width:50px" onchange="bundleEditor.nested[' + idx + '].quantity=parseInt(this.value)||1;updateBundlePreview()">' +
        '<button class="btn-icon" onclick="bundleEditor.nested.splice(' + idx + ',1);renderBundleModal()">✕</button></div>';
    }).join('') : '');
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

function addNestedBundle() {
  var bid = parseInt(document.getElementById('b-nested-bundle').value);
  if (!bid) return;
  var qty = parseInt(document.getElementById('b-nested-qty').value) || 1;
  var bundle = bundleEditor.allBundles.find(function(b) { return b.id === bid; });
  if (!bundle) return;
  bundleEditor.nested.push({ bundle_id: bid, bundle_name: bundle.name, total_cost: bundle.total_cost, quantity: qty });
  renderBundleModal();
}

function updateBundlePreview() {
  var rate = parseFloat(document.getElementById('b-margin').value) || 70;
  var totalCost = bundleEditor.items.reduce(function(sum, i) { return sum + i.unit_price * i.quantity; }, 0);
  bundleEditor.nested.forEach(function(n) {
    var child = bundleEditor.allBundles.find(function(bb) { return bb.id === n.bundle_id; }) || n;
    totalCost += (child.total_cost || n.total_cost || 0) * (n.quantity || 1);
  });
  document.getElementById('b-preview-cost').textContent = '¥' + totalCost.toFixed(2);
  document.getElementById('b-preview-sell').textContent = '¥' + (totalCost * (1 + rate / 100)).toFixed(2);
}

// ─── 图片处理 ───
function handleBundleImageSelect(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    bundleEditor.newImages.push({ data: e.target.result, name: file.name });
    renderBundleModal();
  };
  reader.readAsDataURL(file);
}

function removeBundleImage(idx) {
  bundleEditor.existingImages.splice(idx, 1);
  renderBundleModal();
}

async function saveBundle() {
  var name = document.getElementById('b-name').value;
  if (!name) { toast('请输入方案名称', 'error'); return; }
  var marginRate = parseFloat(document.getElementById('b-margin').value) || 70;
  var items = bundleEditor.items.map(function(i) { return { product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price }; });
  var nested = bundleEditor.nested.map(function(n) { return { bundle_id: n.bundle_id, quantity: n.quantity || 1 }; });
  if (items.length === 0 && nested.length === 0) { toast('方案至少包含1个商品或子方案', 'error'); return; }
  var body = { name: name, margin_rate: marginRate, items: items, nested: nested };
  var res = bundleEditor.bundleId ? await apiPut('/bundles/' + bundleEditor.bundleId, body) : await apiPost('/bundles', body);
  if (res.ok) {
    // 上传新图片
    if (bundleEditor.newImages.length > 0 && res.data && res.data.id) {
      var images = bundleEditor.newImages.map(function(img) { return { image: img.data }; });
      await apiPost('/bundles/' + res.data.id + '/images', { images: images });
    }
    // 删除已移除的旧图（通过对比 existingImages 和原始数据）
    toast(bundleEditor.bundleId ? '方案已更新' : '方案已创建'); closeModal(); loadBundles(document.getElementById('page-container'));
  } else toast(res.error || '操作失败', 'error');
}

async function deleteBundle(id) {
  if (!confirm('确定删除该方案？')) return;
  var res = await apiDelete('/bundles/' + id);
  if (res.ok) { toast('已删除'); loadBundles(document.getElementById('page-container')); }
  else toast(res.error || '删除失败', 'error');
}
