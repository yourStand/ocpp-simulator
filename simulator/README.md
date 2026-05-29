# simulator/ — 充電器側スタブ + モックCSMS（OCPP 1.6-J / NodeJS）

CSMS（OCPP の中央システム＝サーバー）の接続・互換性回帰テスト用の最小基盤。
本フェーズでは NodeJS 製で以下2つを提供する。

- **モックCSMSサーバー**（`base/csms-server.js`）: 充電器の接続先となる WebSocket サーバー。
  特定事業者に依存しない**一般的な OCPP サーバーのサンプル**で、代表的な CALL
  （BootNotification / Heartbeat / Authorize / StartTransaction /
  MeterValues / StopTransaction 等）に最小応答を返す。
- **充電器シミュレーター**（`base/charge-point.js`）: CSMS へ接続する WebSocket クライアント。
  CALL 送信と CALLRESULT/CALLERROR 待ち、ハートビートを行う。

完全な標準準拠実装ではなく、接続・電文往復・回帰テストの「土台」。
電気的タイミング・エラー注入・通信断・シナリオDSL 等は後続フェーズ（別レシピ）で拡張する。

## 構成

```
simulator/
├── package.json
├── csms.js              # モックCSMS起動エントリ
├── simulate.js          # 充電器1台で代表セッションを1回流すエントリ
└── base/
    ├── ocpp-frame.js    # OCPP-J メッセージ枠組み (CALL/CALLRESULT/CALLERROR)
    ├── csms-server.js   # モックCSMS (WebSocketServer)
    └── charge-point.js  # 充電器スタブ (WebSocket client)
```

## セットアップ

```bash
cd simulator
npm install
```

## 使い方

ターミナル1: モックCSMSを起動

```bash
node csms.js --port 9000
# または: npm run csms
```

ターミナル2: 充電器シミュレーターで電文送信

`simulate.js` は **プロファイルに明記された電文だけ**を送る。送信電文は
`vendors/<vendor>/.../messages/*.json` 由来で、ハートビート等の暗黙電文は送らない。
プロファイル `ysc2` の定義済み電文は現状 `BootNotification` と `StatusNotification`。

3つのモードがある。

```bash
# 1) batch（既定）: 定義済み電文を順に一通り送って終了
node simulate.js --profile ysc2

# 2) interactive: 接続を保ち、対話的に選んだ電文をオンデマンド送信
node simulate.js --profile ysc2 --interactive
#    → 番号 or 電文名を入力して送信。list で一覧、quit で終了。

# 3) send: 指定電文を1つだけ送って終了（スクリプト向け）
node simulate.js --profile ysc2 --send StatusNotification
```

共通オプション: `--id`（充電器ID）/ `--url`（CSMS URL）。`--help` で一覧表示。

### プロファイルの増やし方

`PROFILES`（`simulate.js`）にエントリを足し、対象 version ディレクトリの
`messages/<Action>.json` に電文を置くだけ。ファイル名(=OCPP Action)が
そのまま送信メニューに並ぶ。送信順は `simulate.js` の `ORDER` で制御。

## ライセンス

`simulator/**` は Apache-2.0（ルート `REUSE.toml` で宣言）。
