# YourStand YSC2 / firmware aaaa_v1_1_1

C2盤（model `YSC2`, vendor `YourStand`）が firmware `aaaa_v1_1_1` で送信する
代表電文の例。OCPP 1.6-J の CALL ペイロード（配列の第4要素）を抜き出したもの。

| ファイル | OCPP Action | 備考 |
|---|---|---|
| `messages/BootNotification.json` | BootNotification | 起動時。model/vendor/serial/firmware を申告 |
| `messages/StatusNotification.json` | StatusNotification | コネクタ状態通知。例は `Preparing` |

> 値（serialNumber 等）は仕様提示用の代表値。実機ログを格納する場合は
> `sample-logs/` 配下にデータ扱いで置き、サニタイズすること。
