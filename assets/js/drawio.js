// draw.io の図の「拡大表示」ボタン（drawio ショートコードが出力する .drawio-zoom）。
// ボタンを押したときに初めて同梱の draw.io ビューア（約 3.6MB）を読み込み、
// 元の図ファイルを取得して、ページの上に重ねて表示する（ビューアのライトボックス）。
// 図ファイルは同じサイトから取得してブラウザの中で描くので、図のデータは外部に送らない。
(function () {
  var viewerLoading = null; // ビューアの読み込み（1 回だけ）
  var viewers = {};         // 図ファイルの URL → 作成済みのビューア
  var OPEN_TIMEOUT = 15000; // ビューアが図を描き終えるのを待つ時間（ミリ秒）

  function loadViewer(url) {
    if (window.GraphViewer) return Promise.resolve();
    if (!viewerLoading) {
      viewerLoading = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = url;
        script.onload = function () { resolve(); };
        script.onerror = function () {
          viewerLoading = null;
          reject(new Error('draw.io ビューアを読み込めません: ' + url));
        };
        document.head.appendChild(script);
      });
    }
    return viewerLoading;
  }

  function fetchDiagram(src) {
    return fetch(src).then(function (res) {
      if (!res.ok) throw new Error('図ファイルを取得できません（' + res.status + '）: ' + src);
      return res.text();
    });
  }

  function openLightbox(button) {
    var src = button.getAttribute('data-drawio-src');
    if (viewers[src]) {
      viewers[src].showLocalLightbox();
      return Promise.resolve();
    }
    return Promise.all([
      loadViewer(button.getAttribute('data-drawio-viewer')),
      fetchDiagram(src)
    ]).then(function (results) {
      return new Promise(function (resolve, reject) {
        // ビューアは要素に図を描いてから拡大表示を開く作りなので、描く先を画面の外に置く
        var holder = document.createElement('div');
        // 図ファイルが壊れているとビューアが何も知らせずに終わることがあるので、待つ時間を区切る
        var timer = setTimeout(function () {
          holder.remove();
          reject(new Error('draw.io ビューアが図を表示できません: ' + src));
        }, OPEN_TIMEOUT);
        holder.className = 'drawio-viewer-holder';
        holder.setAttribute('aria-hidden', 'true');
        holder.setAttribute('data-mxgraph', JSON.stringify({
          xml: results[1],
          nav: true,
          lightbox: false,
          editable: false, // 編集ボタン（外部の draw.io を開く）は出さない
          toolbar: 'pages zoom layers'
        }));
        document.body.appendChild(holder);
        try {
          window.GraphViewer.createViewerForElement(holder, function (viewer) {
            clearTimeout(timer);
            viewers[src] = viewer;
            viewer.showLocalLightbox();
            resolve();
          });
        } catch (err) {
          clearTimeout(timer);
          holder.remove();
          reject(err);
        }
      });
    });
  }

  // ボタンの隣にエラーを表示する。message が空なら、出ているエラーを消す
  function showError(button, message) {
    var note = button.nextElementSibling;
    var exists = note && note.classList.contains('drawio-error');
    if (!message) {
      if (exists) note.remove();
      return;
    }
    if (!exists) {
      note = document.createElement('span');
      note.className = 'drawio-error';
      note.setAttribute('role', 'alert');
      button.insertAdjacentElement('afterend', note);
    }
    note.textContent = message;
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('.drawio-zoom') : null;
    if (!button || button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    var done = function () {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    };
    openLightbox(button).then(function () {
      showError(button, '');
      done();
    }, function (err) {
      if (window.console) console.error(err);
      showError(button, '拡大表示を開けませんでした');
      done();
    });
  });
})();
