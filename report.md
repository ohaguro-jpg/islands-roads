# 変更レポート

## 2026-06-19 ダイス記録表示・カード使用キャンセル＋被り解消

### 要望
1. 1ターンずつ各プレイヤーが何の数字を引いたか表示
2. 騎士・発展カードを使った時に「やっぱりやめる」ボタン
3. （途中フィードバック）「開拓地を置こう」など UI が盤面に被るのが嫌 → 今後も何も被らせない

### 実装
- **ダイスの記録パネル**（`index.html` の `#rollLog` / `app.js` の `recordRoll` `renderRollLog`）
  - `distributeRoll` 冒頭で全員（人間・NPC）の出目を `state.rollLog` に記録（最新40件）。
  - 盤面右の余白に絶対配置（`.roll-log` top:80/right:14/width:170）。R番号・アバター・名前・合計を新しい順に7件表示。7は赤字。
- **カード使用キャンセル**（`app.js`）
  - `playDevelopment` で人間が使う瞬間に `cardActionSnapshot = cloneState()`（JSONディープコピー）を取り `state.pendingCard` をセット。
  - キャンセルで `state = snapshot` に完全復元（カードが手札に戻り `devPlayed=false`・盗賊位置・置いた無料街道なども元通り）。
  - 騎士・街道建設: アクションバー内の `#cancelCardBtn`「↩ やっぱりやめる」。発見・独占: モーダル内 `.cancel-card-link`。
  - 完了時（`confirmRobberPlacement` / 街道2本完了 / 発見確定 / 独占確定）と `advanceTurn`・`newGame` で `clearCardAction()`。
- **被り解消（`trade.css`）**: `.setup-guide` を中央上(top:24/left:50%)から左上余白(top:70/left:14/width:180)へ。ターン表示の下に積み、盤面右端より内側(右端194<盤面左198)に収めた。
- 新DOM id (`rollLog rollLogList cancelCardBtn`) を `offline-play-test.js` のモック一覧に追記。

### 検証
- `npm run test:all` → 3スイート PASS
- プレビュー(1440×820)で `getBoundingClientRect` 比較: setup-guide右194<盤面左198、roll-log左936>盤面右922、cancelBtn右余白 — いずれも盤面と非重複
- 騎士/独占/発見でキャンセル→カード復元・状態復元を確認。コンソールエラー無し

---

## 2026-06-19 オフライン版UIレイアウト改修

### 要望
1. プレイヤー情報を画面上部に移動
2. 「新しいゲーム」「ミュージック」ボタンを左下に縦並び
3. 「あなたの手札」も上部に移動し、数字を大きく表示。プレイヤー各情報の数字も大きく、2段にしない
4. 右側の交易・銀行との交易パネルをスクロールせずに見られるよう少し縮小
5. 左上のロゴを削除

### 重要な前提（修正した不具合）
- ディスク上の `index.html` は前回作業の途中状態で **壊れていた**。`app.js` が `#newGameBtn`(1525) / `#rulesBtn`(1536) / `#soundBtn` / `#bgmBtn` / `#fullscreenBtn`(1593-1598) を `.onclick` でバインドするのに、これらのボタンがHTMLから消えていた。
- そのためフレッシュにロードすると `app.js` がJSエラーで停止し、`newGame()` まで到達せずゲームが起動しない状態だった（ブラウザは旧版キャッシュを表示していた）。
- `offline-play-test.js` の DOM モックid一覧(33行)には既にこれら5つのidが含まれており、ボタンを復活させるのが正しい対応。

### 変更ファイル
- `index.html`: `.game-stage` 内に `.corner-controls`（新しいゲーム/遊び方/効果音♪/BGM♫/全画面⛶ボタン）を追加。app.jsが必要とする5要素を復活。
- `styles.css`: 末尾にレイアウトオーバーライドのブロックを追記（既存ルールは変更せず後置で上書き）。
  - 上部プレイヤー行: VP数字を大きく(21px)、1行表示（はみ出しによる切れを解消）
  - 上部手札バー: 資源カウントを大きく(23px丸/font13)、折り返し無し
  - `.corner-controls`: 左下に絶対配置の縦スタック
  - `@media(min-width:1051px)`: サイドバー(建設/交換/銀行)を縮小して縦スクロール無しで全表示（1440×820で超過6px≒0）
  - `@media(max-width:760px)`: モバイルではコントロールを通常フロー(横並び)にして盤面と重ならないように

### 検証
- `npm run test:all` → server-core / offline-play / online-smoke すべて PASS
- プレビュー(1440×820)で実測: プレイヤー行のはみ出し 0px、サイドバー超過 6px、コンソールエラー無し
- モバイル(375)でコントロールが盤面に重ならないことを確認

### バックアップ
- 変更前の `index.html` / `styles.css` を `.backups/*.20260619-142420` に保存（gitリポジトリではないためコピーでバックアップ）

### 未対応・今後
- オンライン版(online.html/online.js)へは未移植（オフライン優先方針のため）
