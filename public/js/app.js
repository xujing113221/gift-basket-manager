// ─── 路由 & 导航 ───
let currentPage = 'dashboard';

const PAGE_TITLES = {
  dashboard: '📊 工作台', products: '📦 商品库', sourcing: '🏪 比价采购',
  bundles: '🧺 方案搭建', analytics: '📈 数据看板', stock: '📋 进出记录',
  competitors: '🔍 竞品对比'
};

function navigateTo(page) {
  currentPage = page;
  // 所有导航链接
  document.querySelectorAll('.nav-item[data-page], .tab-item[data-page]').forEach(function(el) {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
  loadPage(page);
  // 移动端关闭侧边栏
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

function loadPage(page) {
  var container = document.getElementById('page-container');
  var loaders = {
    dashboard: loadDashboard, products: loadProducts, sourcing: loadSourcing,
    bundles: loadBundles, analytics: loadAnalytics, stock: loadStockRecords,
    competitors: loadCompetitors
  };
  if (loaders[page]) {
    loaders[page](container);
  } else {
    container.innerHTML = '<div class="empty">页面加载中...</div>';
  }
}

// 事件绑定
document.getElementById('menu-toggle').addEventListener('click', function() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('show');
});
document.getElementById('sidebar-overlay').addEventListener('click', function() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
});

// 导航点击
document.querySelectorAll('.nav-item[data-page], .tab-item[data-page]').forEach(function(el) {
  el.addEventListener('click', function() { navigateTo(el.dataset.page); });
});

// 快速添加按钮
document.getElementById('btn-quick-add').addEventListener('click', function() {
  var pageLoaders = {
    dashboard: function() { navigateTo('products'); setTimeout(function() { if (typeof openProductModal === 'function') openProductModal(); }, 200); },
    products: function() { if (typeof openProductModal === 'function') openProductModal(); },
    sourcing: function() { if (typeof openQuoteModal === 'function') openQuoteModal(); },
    bundles: function() { if (typeof openBundleModal === 'function') openBundleModal(); },
    stock: function() { if (typeof openStockRecordModal === 'function') openStockRecordModal(); }
  };
  if (pageLoaders[currentPage]) { pageLoaders[currentPage](); }
  else { navigateTo('products'); setTimeout(function() { if (typeof openProductModal === 'function') openProductModal(); }, 200); }
});

// Modal 点击遮罩关闭
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// 初始加载
navigateTo('dashboard');
