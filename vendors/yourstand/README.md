# YourStand C2盤（YSC2）

ユアスタンド自社製の充電器制御基板「C2盤」の OCPP リファレンス。

- `chargePointVendor`: `YourStand`
- `chargePointModel`: `YSC2`

自社製品のため、ライセンスは YourStand が直接決定する（CC-BY-4.0）。
暫定マーカー `LicenseRef-Provisional-VendorReference` は使わない。

## モデル / 版

- `models/ysc2/versions/aaaa_v1_1_1/` — firmwareVersion `aaaa_v1_1_1`
  - `messages/` — C2盤が送信する代表電文の例（OCPP 1.6-J ペイロード）
  - `sample-logs/` — 代表セッションログ（データ扱い・サニタイズ後に格納）
