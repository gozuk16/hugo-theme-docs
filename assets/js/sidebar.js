// サイドバーの開閉・リサイズと、ツリーの開閉状態の保存。
// 保存済み状態の復元は head 内（幅・開閉）と sidebar-left.html 内（ツリー）の
// インラインスクリプトが担当しており、このファイルは利用者の操作を扱う。
(function () {
  var config = window.sidebarConfig || {
    min: 160, max: 480, default: 240,
    widthKey: 'sidebar-width', collapsedKey: 'sidebar-collapsed', treeKey: 'sidebar-tree-open'
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

  function clamp(width) {
    return Math.min(config.max, Math.max(config.min, width));
  }

  // CSSの clamp() は範囲外の値を丸めてくれないことを実機で確認済みのため、
  // 幅の制限は必ずここで行う。
  function applyWidth(width) {
    var value = clamp(Math.round(width));
    root.style.setProperty('--sidebar-width', value + 'px');
    resizer.setAttribute('aria-valuenow', String(value));
    return value;
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

  var dragging = false;

  resizer.addEventListener('pointerdown', function (event) {
    if (isCollapsed()) {
      return;
    }
    dragging = true;
    try {
      resizer.setPointerCapture(event.pointerId);
    } catch (e) {
      // ポインタキャプチャが利用できない環境では無視する
    }
    root.classList.add('sidebar-dragging');
    event.preventDefault();
  });

  resizer.addEventListener('pointermove', function (event) {
    if (!dragging) {
      return;
    }
    // ビューポート左端ではなくサイドバー左端からの距離を使う
    // （将来レイアウトに余白が入ってもずれないようにするため）
    applyWidth(event.clientX - aside.getBoundingClientRect().left);
  });

  function endDrag(event) {
    if (!dragging) {
      return;
    }
    dragging = false;
    try {
      resizer.releasePointerCapture(event.pointerId);
    } catch (e) {
      // ポインタが既に解放されている場合は無視する
    }
    root.classList.remove('sidebar-dragging');
    // 保存はドラッグ終了時だけ行う（移動中に書き込むと負荷が高いため）
    store(config.widthKey, String(currentWidth()));
  }

  resizer.addEventListener('pointerup', endDrag);
  resizer.addEventListener('pointercancel', endDrag);
  resizer.addEventListener('lostpointercapture', endDrag);

  // キーボード操作とダブルクリックでのリセット
  var KEYBOARD_STEP = 16;

  resizer.addEventListener('keydown', function (event) {
    if (isCollapsed()) {
      return;
    }
    var width = currentWidth();
    if (event.key === 'ArrowLeft') {
      applyWidth(width - KEYBOARD_STEP);
    } else if (event.key === 'ArrowRight') {
      applyWidth(width + KEYBOARD_STEP);
    } else if (event.key === 'Home') {
      applyWidth(config.default);
    } else {
      return;
    }
    event.preventDefault();
    store(config.widthKey, String(currentWidth()));
  });

  resizer.addEventListener('dblclick', function () {
    if (isCollapsed()) {
      return;
    }
    applyWidth(config.default);
    store(config.widthKey, String(currentWidth()));
  });

  // ツリーの開閉状態の保存。
  // 「開いているノードのID」の一覧だけを持つ。閉じたノードは一覧から外すだけで、
  // 復元時は Hugo が描画した状態に「開く」を上乗せするため、閉じる方向の記録は不要。
  function readOpenIds() {
    try {
      var ids = JSON.parse(localStorage.getItem(config.treeKey));
      return Array.isArray(ids) ? ids.filter(function (id) { return typeof id === 'string'; }) : [];
    } catch (e) {
      return [];
    }
  }

  var tree = aside.querySelector('.page-tree');
  if (tree) {
    // 読み込み時点で開いているノード（現在ページの祖先として Hugo が開いたもの）も記録する。
    // これで別のページへ移動しても、直前に表示されていた開閉状態がそのまま残る。
    // ブラウザによっては open 付きで描画された details に読み込み時 toggle イベントが飛ぶが、
    // 下のリスナーが付く前に飛ぶこともあるため、イベントには頼らずここで明示的に記録する。
    var ids = readOpenIds();
    var changed = false;
    var openNodes = tree.querySelectorAll('details[data-page-id][open]');
    for (var i = 0; i < openNodes.length; i++) {
      var openId = openNodes[i].getAttribute('data-page-id');
      if (ids.indexOf(openId) < 0) {
        ids.push(openId);
        changed = true;
      }
    }
    if (changed) {
      store(config.treeKey, JSON.stringify(ids));
    }

    // toggle イベントはバブリングしないため、キャプチャで受ける
    tree.addEventListener('toggle', function (event) {
      var node = event.target;
      var id = node.getAttribute && node.getAttribute('data-page-id');
      if (!id) {
        return;
      }
      var ids = readOpenIds();
      var index = ids.indexOf(id);
      if (node.open && index < 0) {
        ids.push(id);
      } else if (!node.open && index >= 0) {
        ids.splice(index, 1);
      } else {
        return;
      }
      store(config.treeKey, JSON.stringify(ids));
    }, true);
  }
})();
