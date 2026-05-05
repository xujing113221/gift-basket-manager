// ─── 比价采购 ───
let sourcingProducts = [];
let sourcingSearch = '';
let selectedProductId = null;

async function loadSourcing(container) {
  var res = await apiGet('/products');
  if (!res.ok) { container.innerHTML = '<div class="empty">加载失败</div>'; return; }
  sourcingProducts = res.data;
  renderSourcing(container);
}

function renderSourcing(container) {
  var filtered = sourcingProducts;
  if (sourcingSearch) filtered = filtered.filter(function(p) { return p.name.indexOf(sourcingSearch) > -1; });

  container.innerHTML =
    '<div class="toolbar"><input class="search-input" id="sourcing-search" placeholder="搜索商品..." value="' + escAttr(sourcingSearch) + '"><div class="spacer"></div></div>' +
    '<div class="split-layout">' +
      '<div class="split-left"><div class="card" style="max-height:70vh;overflow-y:auto"><div class="card-title">📦 商品列表</div>' +
        filtered.map(function(p) {
          return '<div style="padding:8px 12px;margin:2px 0;cursor:pointer;border-radius:6px;' + (selectedProductId === p.id ? 'background:var(--orange-light);font-weight:600' : '') + '" onclick="selectProduct(' + p.id + ')">' +
            esc(p.name) + ' <span style="color:var(--text-muted);font-size:12px">' + (p.source||'') + '</span></div>';
        }).join('') +
      '</div></div>' +
      '<div class="split-right"><div class="card" id="quote-panel"><div class="card-title">🏷️ 报价详情</div><div class="empty-sm">← 选择商品查看比价</div></div></div>' +
    '</div>';

  document.getElementById('sourcing-search').addEventListener('input', function(e) {
    sourcingSearch = e.target.value;
    renderSourcing(container);
  });
}

async function selectProduct(id) {
  selectedProductId = id;
  var product = sourcingProducts.find(function(p) { return p.id === id; });
  if (!product) return;

  var res = await apiGet('/quotes?product_id=' + id);
  var quotes = res.ok ? res.data : [];

  var panel = document.getElementById('quote-panel');
  var html = '<div class="card-title">🏷️ ' + esc(product.name) + '</div>';

  if (quotes.length === 0) {
    html += '<div class="empty-sm">暂无报价</div>';
  } else {
    quotes.forEach(function(q) {
      html += '<div class="quote-card' + (q.is_preferred ? ' preferred' : '') + '">' +
        '<div class="quote-platform"><span class="badge ' + (q.platform === '1688' ? 'badge-primary' : q.platform === '拼多多' ? 'badge-warning' : 'badge-muted') + '">' + esc(q.platform) + '</span>' +
        (q.is_preferred ? ' ⭐首选' : '') + (q.supplier_name ? ' · ' + esc(q.supplier_name) : '') + '</div>' +
        '<div class="quote-price" style="color:' + (q.is_preferred ? 'var(--pink)' : 'var(--orange)') + '">¥' + (q.unit_price || 0).toFixed(2) + '<span style="font-size:12px;font-weight:400">/个</span></div>' +
        '<div class="quote-detail">' +
          '起批 ' + (q.min_order || '—') + '个 · 运费 ¥' + (q.shipping || 0).toFixed(2) +
          (q.link ? ' · <a href="' + escAttr(q.link) + '" target="_blank" style="color:var(--orange)">🔗 链接</a>' : '') +
        '</div>' +
        (q.notes ? '<div class="quote-detail">' + esc(q.notes) + '</div>' : '') +
        '<div class="quote-actions">' +
          '<button class="btn-icon" onclick="editQuote(' + q.id + ')" title="编辑">✏️</button>' +
          '<button class="btn-icon" onclick="deleteQuote(' + q.id + ', ' + id + ')" title="删除">🗑️</button>' +
        '</div></div>';
    });
  }

  html += '<button class="btn btn-gradient btn-sm" style="margin-top:12px;width:100%" onclick="openQuoteModal(' + id + ')">＋ 添加报价</button>';
  panel.innerHTML = html;

  // 更新左边高亮
  var leftItems = document.querySelectorAll('.split-left [onclick]');
  leftItems.forEach(function(el) {
    var match = el.getAttribute('onclick').match(/selectProduct\((\d+)\)/);
    if (match && parseInt(match[1]) === id) el.style.background = 'var(--orange-light)';
    else el.style.background = '';
  });
}

function openQuoteModal(productId, quoteId) {
  document.getElementById('modal-title').textContent = quoteId ? '✏️ 编辑报价' : '＋ 新增报价';
  document.getElementById('modal-body').innerHTML =
    '<div class="form-group"><label>平台 *</label><select id="q-platform"><option>1688</option><option>拼多多</option><option>其他</option></select></div>' +
    '<div class="form-group"><label>供应商</label><input id="q-supplier" placeholder="供应商名称"></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>单价</label><input type="number" step="0.01" id="q-price" value="0"></div>' +
      '<div class="form-group"><label>起批量</label><input type="number" id="q-min" value="1"></div>' +
    '</div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>运费</label><input type="number" step="0.01" id="q-shipping" value="0"></div>' +
      '<div class="form-group"><label>首选</label><select id="q-preferred"><option value="0">否</option><option value="1">是</option></select></div>' +
    '</div>' +
    '<div class="form-group"><label>链接</label><input id="q-link" placeholder="商品链接"></div>' +
    '<div class="form-group"><label>备注</label><input id="q-notes" placeholder="备注信息"></div>';
  document.getElementById('modal-footer').innerHTML =
    '<button class="btn" onclick="closeModal()">取消</button>' +
    '<button class="btn btn-gradient" onclick="saveQuote(' + productId + (quoteId ? ',' + quoteId : '') + ')">保存</button>';
  document.getElementById('modal-overlay').classList.add('active');

  // 如果是编辑，加载已有数据
  if (quoteId) {
    apiGet('/quotes?product_id=' + productId).then(function(res) {
      if (!res.ok) return;
      var q = res.data.find(function(qq) { return qq.id === quoteId; });
      if (!q) return;
      document.getElementById('q-platform').value = q.platform || '1688';
      document.getElementById('q-supplier').value = q.supplier_name || '';
      document.getElementById('q-price').value = q.unit_price || 0;
      document.getElementById('q-min').value = q.min_order || 1;
      document.getElementById('q-shipping').value = q.shipping || 0;
      document.getElementById('q-preferred').value = q.is_preferred ? '1' : '0';
      document.getElementById('q-link').value = q.link || '';
      document.getElementById('q-notes').value = q.notes || '';
    });
  }
}

async function saveQuote(productId, quoteId) {
  var body = {
    product_id: productId,
    platform: document.getElementById('q-platform').value,
    supplier_name: document.getElementById('q-supplier').value || null,
    unit_price: parseFloat(document.getElementById('q-price').value) || 0,
    min_order: parseInt(document.getElementById('q-min').value) || 1,
    shipping: parseFloat(document.getElementById('q-shipping').value) || 0,
    is_preferred: parseInt(document.getElementById('q-preferred').value) || 0,
    link: document.getElementById('q-link').value || null,
    notes: document.getElementById('q-notes').value || null
  };
  var res = quoteId ? await apiPut('/quotes/' + quoteId, body) : await apiPost('/quotes', body);
  if (res.ok) { toast(quoteId ? '报价已更新' : '报价已添加'); closeModal(); selectProduct(productId); }
  else toast(res.error || '操作失败', 'error');
}

async function deleteQuote(quoteId, productId) {
  if (!confirm('确定删除该报价？')) return;
  var res = await apiDelete('/quotes/' + quoteId);
  if (res.ok) { toast('已删除'); selectProduct(productId); }
  else toast(res.error || '删除失败', 'error');
}

async function editQuote(quoteId) {
  // 找到该 quote 的 product_id
  var all = await apiGet('/quotes');
  var q = all.data.find(function(qq) { return qq.id === quoteId; });
  if (q) openQuoteModal(q.product_id, quoteId);
}
