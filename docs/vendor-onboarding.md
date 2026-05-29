# 新規ベンダー参加手順（A運用下）

1. `vendors/_template/` を `vendors/<vendor>/` にコピーする。
2. `vendors/<vendor>/REUSE.toml` を当該メーカーが決めたライセンスへ書き換える
   （暫定の `LicenseRef-Provisional-VendorReference` を正式ライセンスに置換）。
   - 仕様・ドキュメント: メーカー指定（例: CC-BY-4.0 / 独自 `LicenseRef-<Vendor>-...`）。
   - サンプルログ: サニタイズ後、データ用ライセンス（CC-BY-4.0 / CDLA-Permissive-2.0）。
3. `.github/CODEOWNERS` の当該行を `@<vendor>/maintainers` に差し替え、
   そのディレクトリの変更承認をメーカーへ委譲する。
4. 拡張電文は必ずベンダーprefixを付与（例: `<vendor>:DiagnosticsLevel`）。
   `tools/vendor-extension-linter/` で衝突を自動検査。
5. `reuse lint` が通ることを確認してマージ。
