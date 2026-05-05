// ─── 进出记录 ───
let stockFilterPid = '';

async function loadStockRecords(container) {
  var resP = await apiGet('/products');
  var products = resP.ok ? resP.data : [];

  var res = await apiGet('/stock-records' + (stockFilterPid ? '?product_id=' + stockFilterPid : ''));
  var records = res.ok ? res.data : [];

  container.innerHTML =
    '<div class="toolbar">' +
      '<select id="stock-filter" style="max-width:300px" onchange="stockFilterPid=this.value;loadStockRecords()">' +
        '<option value="">全部商品</option>' +
        products.map(function(p) { return '<option value="' + p.id + '"' + (String(stockFilterPid) === String(p.id) ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') +
      '</select>' +
      '<div class="spacer"></div>' +
      '<button class="btn btn-gradient btn-sm" onclick="openStockRecordModal()">＋ 新增记录</button>' +
    '</div>' +
    '<div class="card"><div class="table-wrap"><table>' +
      '<thead><tr><th>时间</th><th>商品</th><th>类型</th><th class="text-center">数量</th><th class="text-right">单价</th><th class="text-right">金额</th><th>供应商</th><th>备注</th><th>操作</th></tr></thead>' +
      '<tbody>' + (records.length > 0 ? records.map(function(r) {
        return '<tr>' +
          '<td>' + (r.created_at || '').substr(0, 16) + '</td>' +
          '<td>' + esc(r.product_name) + '</td>' +
          '<td><span class="badge ' + (r.change_type === '入库' ? 'badge-success' : r.change_type === '出库' ? 'badge-danger' : 'badge-warning') + '">' + r.change_type + '</span></td>' +
          '<td class="text-center">' + r.quantity + '</td>' +
          '<td class="text-right money">¥' + (r.unit_price || 0).toFixed(2) + '</td>' +
          '<td class="text-right money">¥' + ((r.quantity || 0) * (r.unit_price || 0)).toFixed(2) + '</td>' +
          '<td>' + (r.supplier || '-') + '</td>' +
          '<td>' + (r.notes || '-') + '</td>' +
          '<td><button class="btn-icon" onclick="deleteStockRecord(' + r.id + ')">🗑️</button></td></tr>';
      }).join('') : '<tr><td colspan="9"><div class="empty">暂无记录</div></td></tr>') +
    '</tbody></table></div></div>';
}

function openStockRecordModal() {
  apiGet('/products').then(function(pres) {
    var products = (pres.data || []).filter(function(p) { return p.category !== '盒子' || p.unit_price > 0; });
    document.getElementById('modal-title').textContent = '＋ 进出记录';
    document.getElementById('modal-body').innerHTML =
      '<div class="form-group"><label>商品 *</label><select id="sr-product">' + products.map(function(p) { return '<option value="' + p.id + '">' + esc(p.name) + ' (库存:' + (p.stock||0) + ')</option>'; }).join('') + '</select></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label>类型</label><select id="sr-type"><option>入库</option><option>出库</option><option>盘点</option></select></div>' +
        '<div class="form-group"><label>数量</label><input type="number" id="sr-qty" value="1" min="1"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label>单价</label><input type="number" step="0.01" id="sr-price" value="0"></div>' +
        '<div class="form-group"><label>供应商</label><input id="sr-supplier"></div>' +
      '</div>' +
      '<div class="form-group"><label>备注</label><input id="sr-notes">';
    document.getElementById('modal-footer').innerHTML =
      '<button class="btn" onclick="closeModal()">取消</button>' +
      '<button class="btn btn-gradient" onclick="saveStockRecord()">保存</button>';
    document.getElementById('modal-overlay').classList.add('active');
  });
}

async function saveStockRecord() {
  var body = {
    product_id: parseInt(document.getElementById('sr-product').value),
    change_type: document.getElementById('sr-type').value,
    quantity: parseInt(document.getElementById('sr-qty').value),
    unit_price: parseFloat(document.getElementById('sr-price').value) || 0,
    supplier: document.getElementById('sr-supplier').value || null,
    notes: document.getElementById('sr-notes').value || null
  };
  var res = await apiPost('/stock-records', body);
  if (res.ok) { toast('记录已保存'); closeModal(); loadStockRecords(); }
  else toast(res.error || '保存失败', 'error');
}

async function deleteStockRecord(id) {
  if (!confirm('确定删除？')) return;
  var res = await apiDelete('/stock-records/' + id);
  if (res.ok) { toast('已删除'); loadStockRecords(); }
  else toast(res.error || '删除失败', 'error');
}
