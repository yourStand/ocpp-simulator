# ocpp-vendor-reference

OCPP電文のオープン化・FWUP連動・マルチベンダー対応を目的とした
リファレンス仕様 & 充電器側シミュレーター基盤のモノレポ。

## ゴール

1. **ローカルで任意のOCPP電文を検査できること。**
   実機やクラウドに依存せず、手元で電文を投げて挙動・準拠性を確認できる。
2. **それがオープンであること。**
   仕様・電文・参照実装を公開し、CPO・各メーカー・関係者が
   **全員が同じ情報を参照**できる状態にする。

CSMS（OCPP の中央システム＝サーバー）の接続・互換性回帰テストを
ローカル / CI / クラウドで再現可能にすることは、このゴールの具体的な達成手段。

## 使い方（クイックスタート）

充電器シミュレーター（`simulate.js` = WSクライアント）と
モックCSMS（`csms.js` = 一般的なOCPPサーバーのサンプル）の2つを使う。
Node.js 20以上が必要。詳細は [`simulator/README.md`](simulator/README.md)。

### セットアップ（初回のみ）

```bash
cd simulator
npm install
```

### 1. モックCSMS（OCPPサーバー）を起動 — ターミナル1

```bash
cd simulator
node csms.js --port 9000          # = npm run csms
```

`[CSMS] listening ws://0.0.0.0:9000 ...` が出れば待受中。`Ctrl+C` で停止。
オプション: `--port <番号>` / `--host <host>`（既定 9000 / 0.0.0.0）。

### 2. 充電器シミュレーターで電文送信 — ターミナル2

`simulate.js` は **プロファイルに定義された電文だけ**を送る（電文は
`vendors/<vendor>/.../messages/*.json` 由来）。3モードがある。

```bash
cd simulator

# (a) batch（既定）: 定義済み電文を順に一通り送って終了
node simulate.js --profile ysc2

# (b) interactive: 接続を保ち、対話的にオンデマンド送信（番号/電文名を入力、quitで終了）
node simulate.js --profile ysc2 --interactive

# (c) send: 指定した電文を1つだけ送って終了
node simulate.js --profile ysc2 --send StatusNotification
```

共通オプション: `--id <充電器ID>`（既定 CP-001） / `--url <CSMS URL>`（既定 ws://localhost:9000）。
`node simulate.js --help` で一覧表示。現在のプロファイル: `ysc2`（YourStand C2盤）。

## ガバナンスモデル

- **現在: モデルA（CPO主導ホスト）** — ユアスタンドが本リポジトリを単独運営。
  まずは社内のみで構築している。
- **現在の参加メーカー: ユアスタンドのみ**（`vendors/yourstand/`）。
- **メーカーの参加方法・運営体制は今後議論していく。**
  どのような形で各メーカーに参加してもらうか（ディレクトリ単位のPR、別リポ連携、
  中立団体ホストへの移行など）は確定しておらず、関係者と相談しながら決める。
  どの方向にも動けるよう、移行コストを抑えた構造にしてある（選択肢の整理は
  `docs/governance.md` 参照）。

## ライセンス（複数ライセンス混在 / REUSE準拠）

ファイル単位のライセンスは各 `REUSE.toml` と SPDX識別子で宣言。

| 領域 | ライセンス | 備考 |
|---|---|---|
| `simulator/`, `tools/` | Apache-2.0 | 実行コード。特許条項ありで採用側を保護 |
| `samples/` | CC-BY-4.0 | 解説のみ。OCA配布スキーマ原本は取り込まない |
| `docs/`, `.github/`, `README` | CC-BY-4.0 | ドキュメント・設定 |
| `vendors/<vendor>/` | 各ベンダーが決定 | メーカー参加までは**暫定**リファレンス（自社製は除く） |

### 検査

    pipx install reuse   # または: pip install reuse
    reuse lint           # 通過すれば準拠
