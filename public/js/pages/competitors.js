// ─── 竞品对比 ───
async function loadCompetitors(container) {
  var res = await apiGet('/competitors');
  if (!res.ok) { container.innerHTML = '<div class="empty">加载失败</div>'; return; }
  var competitors = res.data;
  if (competitors.length === 0) {
    container.innerHTML = '<div class="toolbar"><button class="btn btn-gradient" onclick="openCompetitorModal()">＋ 新增竞品</button></div><div class="empty">暂无竞品数据</div>';
    return;
  }
  container.innerHTML =
    '<div class="toolbar"><div class="spacer"></div><button class="btn btn-gradient" onclick="openCompetitorModal()">＋ 新增竞品</button></div>' +
    competitors.map(function(c) {
      return '<div class="card" style="cursor:pointer" onclick="toggleCompetitor(this)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<strong>' + esc(c.name) + '</strong>' +
          '<div><span style="font-weight:600;font-size:16px">¥' + (c.sell_price || 0).toFixed(2) + '</span>' +
          (c.member_price ? ' <span style="color:var(--text-muted);font-size:13px">会员 ¥' + c.member_price.toFixed(2) + '</span>' : '') + '</div>' +
        '</div>' +
        (c.box_desc ? '<div style="font-size:13px;color:var(--text-secondary);margin-top:4px">📦 ' + esc(c.box_desc) + (c.box_size ? ' · ' + c.box_size : '') + '</div>' : '') +
        '<div class="competitor-details" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border-light)">' +
          (c.items && c.items.length > 0 ? c.items.map(function(i) {
            return '<div style="padding:4px 0;font-size:13px">· ' + esc(i.item_name) + (i.spec ? ' (' + i.spec + ')' : '') + '</div>';
          }).join('') : '<div class="empty-sm">无明细</div>') +
          '<div style="margin-top:8px;display:flex;gap:6px">' +
            '<button class="btn btn-sm" onclick="event.stopPropagation();editCompetitor(' + c.id + ')">✏️ 编辑</button>' +
            '<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteCompetitor(' + c.id + ')">🗑️ 删除</button>' +
          '</div>' +
        '</div></div>';
    }).join('');
}

function toggleCompetitor(el) {
  var details = el.querySelector('.competitor-details');
  if (details) details.style.display = details.style.display === 'none' ? 'block' : 'none';
}

function openCompetitorModal(id) {
  document.getElementById('modal-title').textContent = id ? '✏️ 编辑竞品' : '＋ 新增竞品';
  document.getElementById('modal-body').innerHTML =
    '<div class="form-group"><label>名称 *</label><input id="comp-name"></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>售价</label><input type="number" step="0.01" id="comp-price" value="0"></div>' +
      '<div class="form-group"><label>会员价</label><input type="number" step="0.01" id="comp-mprice"></div>' +
    '</div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>盒子描述</label><input id="comp-box"></div>' +
      '<div class="form-group"><label>盒子尺寸</label><input id="comp-size"></div>' +
    '</div>' +
    '<div class="form-group"><label>备注</label><textarea id="comp-notes"></textarea></div>';
  document.getElementById('modal-footer').innerHTML =
    '<button class="btn" onclick="closeModal()">取消</button>' +
    '<button class="btn btn-gradient" onclick="saveCompetitor(' + (id || '') + ')">保存</button>';
  document.getElementById('modal-overlay').classList.add('active');
}

async function saveCompetitor(id) {
  var body = {
    name: document.getElementById('comp-name').value,
    sell_price: parseFloat(document.getElementById('comp-price').value) || 0,
    member_price: parseFloat(document.getElementById('comp-mprice').value) || null,
    box_desc: document.getElementById('comp-box').value,
    box_size: document.getElementById('comp-size').value,
    notes: document.getElementById('comp-notes').value
  };
  if (!body.name) { toast('请输入名称', 'error'); return; }
  var res = id ? await apiPut('/competitors/' + id, body) : await apiPost('/competitors', body);
  if (res.ok) { toast(id ? '已更新' : '已创建'); closeModal(); loadCompetitors(document.getElementById('page-container')); }
  else toast(res.error || '操作失败', 'error');
}

async function deleteCompetitor(id) {
  if (!confirm('确定删除？')) return;
  var res = await apiDelete('/competitors/' + id);
  if (res.ok) { toast('已删除'); loadCompetitors(document.getElementById('page-container')); }
  else toast(res.error || '删除失败', 'error');
}
