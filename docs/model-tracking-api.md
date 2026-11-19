# ML Trackingの内蔵mado S3 Data Catalog連携から使うAPI

mado ML Trackingがmado S3 Data Catalogから使うのは、渡されたアクセストークン自身の情報と、容量メトリクスの2つ。
データセットと処理の来歴（DataLineage）はmado ML Trackingが受け持ち、mado S3 Data Catalogには無い（v0.6.0で外した）。

| Method | Path | 内容 |
|---|---|---|
| GET | `/api/mado/access-token` | 呼び出したトークン自身の名前・scope・有効期限 |
| GET | `/api/mado/metrics/capacity` | 許可した接続の容量メトリクス（Prometheusの形式） |

管理者がSettings → Access → Access Tokensでトークンを作成し、Capacityの「読み取り」（`capacity:read`）と、読ませる接続を選択する。
発行された値をML Trackingの「連携」画面にあるmado S3 Data Catalogのアクセストークンへ保存する。読み取りの選択から`metrics:read`の許可をサーバーが導出するため、従来API用の権限を別に選ぶ操作は不要。値は発行・再発行時に一度だけ返され、再取得できない。

ML Tracking側ではmado S3 Data CatalogのAPI URLとアクセストークンを設定する。
`/api/mado/access-token`はscopeを問わず有効なトークンに答え、`{id,name,scopes,expiresAt}`だけを返す（`expiresAt`は無期限ならnull）。他のトークンの情報、内部の所有者ID、トークンの値は返さない。`Cache-Control: no-store`。
各requestは`Authorization: Bearer`でkeyを送る。ブラウザのsession cookieを使わず、ユーザーのSSO sessionが切れてもintegrationを継続できる。

容量メトリクスが返す値と、接続・バケットの範囲の決まりは[容量メトリクス](capacity-metrics.md)を参照する。
未認証は401（`authentication_required`・`invalid_token`）、scope不足は403（`scope_required`）。括弧内はエラー応答の`code`。

Access Tokensで名前・権限・接続・有効期限を編集できる。無効化は元に戻せる。再発行すると旧値は直ちに使えなくなり、削除すると復帰できない。
