// ─── 数据看板 ───
async function loadAnalytics(container) {
  var pRes = await apiGet('/products');
  var bRes = await apiGet('/bundles');
  var sRes = await apiGet('/stock-records');

  var products = pRes.ok ? pRes.data : [];
  var bundles = bRes.ok ? bRes.data : [];
  var records = sRes.ok ? sRes.data : [];

  // 品类分布
  var catCount = {};
  products.forEach(function(p) {
    catCount[p.category] = (catCount[p.category] || 0) + 1;
  });

  // 总成本
  var totalCost = products.reduce(function(sum, p) { return sum + p.unit_price * p.stock; }, 0);

  // 近30天进货金额
  var now = new Date();
  var monthAgo = new Date(now - 30 * 86400 * 1000);
  var monthCost = 0;
  records.forEach(function(r) {
    if (r.change_type === '入库' && new Date(r.created_at) > monthAgo) {
      monthCost += r.quantity * r.unit_price;
    }
  });

  // 库存TOP
  var topStock = products.slice().sort(function(a, b) { return b.stock - a.stock; }).slice(0, 5);

  container.innerHTML =
    '<div class="stats-grid">' +
      '<div class="stat-card"><div class="stat-icon">📦</div><div class="stat-value">' + products.length + '</div><div class="stat-label">商品总数</div></div>' +
      '<div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">¥' + totalCost.toFixed(0) + '</div><div class="stat-label">库存总成本</div></div>' +
      '<div class="stat-card"><div class="stat-icon">🛒</div><div class="stat-value">¥' + monthCost.toFixed(0) + '</div><div class="stat-label">近30天采购</div></div>' +
      '<div class="stat-card"><div class="stat-icon">📊</div><div class="stat-value">' + bundles.length + '</div><div class="stat-label">方案总数</div></div>' +
    '</div>' +
    '<div class="dash-grid">' +
      '<div class="card"><div class="card-title">📂 品类分布</div>' +
        Object.keys(catCount).map(function(cat) {
          var pct = Math.round(catCount[cat] / products.length * 100);
          return '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px"><span>' + cat + '</span><span>' + catCount[cat] + '个</span></div>' +
            '<div style="background:#f0e0d6;border-radius:4px;height:8px"><div style="background:var(--gradient);width:' + pct + '%;height:100%;border-radius:4px"></div></div></div>';
        }).join('') +
      '</div>' +
      '<div class="card"><div class="card-title">🏆 库存最多</div>' +
        (topStock.length > 0 ? topStock.map(function(p) {
          return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-light);font-size:13px"><span>' + esc(p.name) + '</span><strong>' + p.stock + ' ' + (p.unit||'个') + '</strong></div>';
        }).join('') : '<div class="empty-sm">暂无数据</div>') +
      '</div>' +
    '</div>' +
    '<div class="card"><div class="card-title">📋 方案利润一览</div>' +
      (bundles.length > 0 ? '<div class="table-wrap"><table>' +
        '<tr><th>方案名称</th><th class="text-right">成本</th><th class="text-right">售价</th><th class="text-right">利润</th><th class="text-center">利润率</th></tr>' +
        bundles.map(function(b) {
          return '<tr><td>' + esc(b.name) + '</td><td class="text-right money">¥' + (b.total_cost||0).toFixed(2) + '</td><td class="text-right money">¥' + (b.sell_price||0).toFixed(2) + '</td><td class="text-right money" style="color:#10b981">¥' + (b.margin_amount||0).toFixed(2) + '</td><td class="text-center">' + (b.margin_rate||0) + '%</td></tr>';
        }).join('') +
      '</table></div>' : '<div class="empty-sm">暂无方案</div>') +
    '</div>';
}
