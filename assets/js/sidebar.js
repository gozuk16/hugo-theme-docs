// サイドバーの開閉とリサイズ。
// 保存済み状態の復元は head 内のインラインスクリプトが担当しており、
// このファイルは利用者の操作を扱う。
(function () {
  var config = window.sidebarConfig || {
    min: 160, max: 480, default: 240,
    widthKey: 'sidebar-width', collapsedKey: 'sidebar-collapsed'
  };

  var root = document.documentElement;
  var aside = document.getElementById('sidebar-left');
  var toggle = document.querySelector('.sidebar-toggle');
  var resizer = document.querySelector('.sidebar-resizer');

  // ホームページなどサイドバーが無いページでは何もしない
  if (!aside || !toggle || !resizer) {
    return;
  }

  function store(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // 保存できない環境ではページ内の操作だけ有効にする
    }
  }

  function currentWidth() {
    var value = parseInt(getComputedStyle(root).getPropertyValue('--sidebar-width'), 10);
    return isNaN(value) ? config.default : value;
  }

  function isCollapsed() {
    return root.getAttribute('data-sidebar') === 'collapsed';
  }

  function setCollapsed(collapsed) {
    root.setAttribute('data-sidebar', collapsed ? 'collapsed' : 'open');
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    resizer.setAttribute('tabindex', collapsed ? '-1' : '0');
    store(config.collapsedKey, collapsed ? '1' : '0');
  }

  // 読み込み時点の状態を支援技術向けの属性に反映する（保存はしない）
  toggle.setAttribute('aria-expanded', isCollapsed() ? 'false' : 'true');
  resizer.setAttribute('tabindex', isCollapsed() ? '-1' : '0');
  resizer.setAttribute('aria-valuenow', String(currentWidth()));

  toggle.addEventListener('click', function () {
    setCollapsed(!isCollapsed());
  });
})();
