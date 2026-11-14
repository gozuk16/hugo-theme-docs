# draw.io viewer

`drawio` ショートコードの「拡大表示」ボタンで使う、draw.io のビューア。

- ファイル: `viewer-static.min.js`
- 版: v26.2.2
- 取得元: https://github.com/jgraph/drawio/blob/v26.2.2/src/main/webapp/js/viewer-static.min.js
- SHA-256: `625d6e4f634439e9b5e8804cf8c6defd5f5c29be27e547c72922843fbfea76b2`
- ライセンス: Apache License 2.0（同じフォルダの `LICENSE`）。内容は変更していない

## 更新するとき

取得元の URL のタグ（`v26.2.2`）を新しい版に変えてファイルを差し替え、この README の版と SHA-256 を書き換える。

## 外部へのアクセス

図ファイルは同じサイトから取得してブラウザの中で描くので、図のデータは外部に送らない。
ただしビューアは、数式用のスクリプトと、特殊な図形ライブラリ（AWS のアイコンなど）の定義を
必要に応じて `viewer.diagrams.net` から読み込む。外部につながらない環境では、拡大表示の中で
それらの図形や数式が表示されないことがある（ページに埋め込んだ SVG には影響しない）。
