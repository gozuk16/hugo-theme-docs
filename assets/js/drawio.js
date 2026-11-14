// draw.io の図の「拡大表示」ボタン（drawio ショートコードが出力する .drawio-zoom）。
// ボタンを押したときに初めて同梱の draw.io ビューア（約 3.6MB）を読み込み、
// 元の図ファイルを取得して、ページの上に重ねて表示する（ビューアのライトボックス）。
// 図ファイルは同じサイトから取得してブラウザの中で描くので、図のデータは外部に送らない。
(function () {
  var viewerLoading = null; // ビューアの読み込み（1 回だけ）
  var viewers = {};         // 図ファイルの URL → 作成済みのビューア
  var OPEN_TIMEOUT = 15000; // ビューアが図を描き終えるのを待つ時間（ミリ秒）
  var CHECK_TIMEOUT = 5000; // スクリプトを読み込めなかった理由を調べる通信を待つ時間（ミリ秒）

  function loadViewer(url) {
    if (window.GraphViewer) return Promise.resolve();
    if (!viewerLoading) {
      viewerLoading = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = url;
        script.onload = function () { resolve(); };
        script.onerror = function () {
          script.remove();
          // 次に押したときは読み込みからやり直す。調べている間に押されても二重に読み込まないよう、調べ終えてから戻す
          var fail = function (reason) {
            viewerLoading = null;
            reject(new Error('draw.io ビューアのスクリプトを読み込めません（' + reason + '）: ' + url));
          };
          // <script> の失敗からは理由が分からないので、同じ URL を取得し直して状態を調べる
          explainLoadFailure(url).then(fail, function () { fail('理由は調べられませんでした'); });
        };
        document.head.appendChild(script);
      });
    }
    return viewerLoading;
  }

  // スクリプトを読み込めなかった理由を調べて、コンソールに出す文言にする。
  // 応答が無いままボタンが戻らなくならないよう、待つ時間を区切る
  function explainLoadFailure(url) {
    var options = { method: 'HEAD', cache: 'no-store' };
    var timer = null;
    if (window.AbortController) {
      var controller = new AbortController();
      options.signal = controller.signal;
      timer = setTimeout(function () { controller.abort(); }, CHECK_TIMEOUT);
    }
    return fetch(url, options).then(function (res) {
      clearTimeout(timer);
      if (res.status === 405 || res.status === 501) {
        return 'サーバーが HEAD に対応していないため、理由は調べられませんでした（HTTP ' + res.status + '）';
      }
      if (res.status === 404) {
        return 'HTTP 404。テーマの static/vendor/drawio/viewer-static.min.js がサイトに配置されていません。' +
          'hugo server を起動したあとにテーマを更新した場合は、hugo server を再起動してください';
      }
      if (!res.ok) return 'HTTP ' + res.status;
      return 'ファイルは取得できますが、スクリプトとして実行できません。Content-Type: ' + res.headers.get('Content-Type');
    }, function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') return 'サーバーが ' + (CHECK_TIMEOUT / 1000) + ' 秒たっても応答しません';
      return 'サーバーに接続できません: ' + (err && err.message ? err.message : err);
    });
  }

  function fetchDiagram(src) {
    return fetch(src).then(function (res) {
      if (!res.ok) throw new Error('図ファイルを取得できません（HTTP ' + res.status + '）: ' + src);
      return res.text();
    }, function (err) {
      throw new Error('図ファイルを取得できません（' + err.message + '）: ' + src);
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
        var timedOut = false;
        var timer = setTimeout(function () {
          timedOut = true;
          holder.remove();
          reject(new Error('draw.io ビューアが ' + (OPEN_TIMEOUT / 1000) + ' 秒たっても図を表示しません（図ファイルが壊れている可能性があります）: ' + src));
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
            // 打ち切ってエラーを出したあとに遅れて描き終えても、いきなり開かない
            if (timedOut) return;
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
      // 画面には短く出し、理由はコンソールに出す
      if (window.console) console.error('[drawio] 拡大表示を開けませんでした: ' + (err && err.message ? err.message : err));
      showError(button, '拡大表示を開けませんでした（理由はブラウザのコンソールに表示しています）');
      done();
    });
  });
})();
