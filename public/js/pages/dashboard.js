// ─── 工作台 ───
async function loadDashboard(container) {
  var d = await apiGet('/dashboard');
  if (!d.ok) { container.innerHTML = '<div class="empty">加载失败</div>'; return; }
  var data = d.data;

  // 预警商品
  var alertsHtml = '';
  try {
    var lowRes = await apiGet('/products?low_stock=1');
    if (lowRes.ok && lowRes.data && lowRes.data.length > 0) {
      alertsHtml = lowRes.data.map(function(p) {
        return '<div class="alert-item" style="cursor:pointer" onclick="navigateTo(\'products\')">⚠️ ' + esc(p.name) + ' 仅剩 <b>' + p.stock + '</b> ' + (p.unit || '个') + '</div>';
      }).join('');
    }
  } catch(e) {}
  if (!alertsHtml) alertsHtml = '<div class="empty-sm">✅ 库存充足，暂无预警</div>';

  // 最近方案
  var bundlesHtml = '';
  var bundles = data.recent_bundles || [];
  if (bundles.length > 0) {
    bundlesHtml = bundles.map(function(b) {
      return '<div class="mini-bundle" style="padding:8px 0;border-bottom:1px solid var(--border-light);font-size:13px;">' +
        '🧺 <strong>' + esc(b.name) + '</strong> · 成本 ¥' + (b.total_cost || 0).toFixed(2) +
        ' · 售价 ¥' + (b.sell_price || 0).toFixed(2) + ' · <span style="color:var(--orange)">' + (b.margin_rate || 0) + '%</span></div>';
    }).join('');
  } else {
    bundlesHtml = '<div class="empty-sm">暂无方案，<a style="color:var(--orange);cursor:pointer" onclick="navigateTo(\'bundles\')">去创建</a></div>';
  }

  container.innerHTML =
    '<div class="stats-grid">' +
      '<div class="stat-card"><div class="stat-icon">📦</div><div class="stat-value">' + data.total_products + '</div><div class="stat-label">商品总数</div></div>' +
      '<div class="stat-card" style="cursor:pointer" onclick="navigateTo(\'products\')"><div class="stat-icon">⚠️</div><div class="stat-value" style="color:' + (data.low_stock > 0 ? '#f59e0b' : '#10b981') + '">' + (data.low_stock || 0) + '</div><div class="stat-label">库存预警</div></div>' +
      '<div class="stat-card" style="cursor:pointer" onclick="navigateTo(\'bundles\')"><div class="stat-icon">🧺</div><div class="stat-value">' + data.total_bundles + '</div><div class="stat-label">成品方案</div></div>' +
      '<div class="stat-card"><div class="stat-icon">📋</div><div class="stat-value">' + data.pending_checklist + '</div><div class="stat-label">待办事项</div></div>' +
    '</div>' +
    '<div class="dash-grid">' +
      '<div class="card"><div class="card-title">🔔 库存预警</div>' + alertsHtml + '</div>' +
      '<div class="card"><div class="card-title">🧺 最近方案</div>' + bundlesHtml + '</div>' +
    '</div>' +
    '<div class="card"><div class="card-title">⚡ 快捷操作</div>' +
      '<div class="quick-actions">' +
        '<button class="btn" onclick="navigateTo(\'products\')">📦 管理商品</button>' +
        '<button class="btn" onclick="navigateTo(\'sourcing\')">🏪 比价采购</button>' +
        '<button class="btn" onclick="navigateTo(\'bundles\')">🧺 新建方案</button>' +
        '<button class="btn" onclick="navigateTo(\'analytics\')">📈 查看数据</button>' +
      '</div></div>';
}
