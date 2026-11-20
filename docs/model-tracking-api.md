# ML Trackingの内蔵mado S3 Data Catalog連携から使うAPI

mado ML Trackingがmado S3 Data Catalogから使うのは、渡されたアクセストークン自身の情報、トークンに許可した接続の一覧、容量メトリクスの3つ。
データセットと処理の来歴（DataLineage）はmado ML Trackingが受け持ち、mado S3 Data Catalogには無い（v0.6.0で外した）。

| Method | Path | 内容 |
|---|---|---|
| GET | `/api/mado/access-token` | 呼び出したトークン自身の名前・scope・有効期限 |
| GET | `/api/mado/connections` | トークンに許可した接続のID・名前・種類 |
| GET | `/api/mado/metrics/capacity` | 許可した接続の容量メトリクス（Prometheusの形式） |

管理者がSettings → Access → Access Tokensでトークンを作成し、Capacityの「読み取り」（`capacity:read`）と、ML Trackingに見せる接続を選択する。接続の一覧は、選択した接続だけを返す。
発行された値を、ML Trackingの全体設定 → 全体管理 → 「Plugins」でmado S3 Data Catalogのアクセストークンとして保存する。読み取りの選択から`metrics:read`の許可をサーバーが導出するため、従来API用の権限を別に選ぶ操作は不要。値は発行・再発行時に一度だけ返され、再取得できない。

ML Tracking側ではmado S3 Data Catalogの画面のURLとアクセストークンを設定する（APIは同じURLの下の`/api/mado/`）。
`/api/mado/access-token`はscopeを問わず有効なトークンに答え、`{id,name,scopes,expiresAt}`だけを返す（`expiresAt`は無期限ならnull）。他のトークンの情報、内部の所有者ID、トークンの値は返さない。`Cache-Control: no-store`。
各requestは`Authorization: Bearer`でkeyを送る。ブラウザのsession cookieを使わず、ユーザーのSSO sessionが切れてもintegrationを継続できる。

`/api/mado/connections`は、scopeを問わず有効なトークンに`{items:[{id,name,provider}]}`を返す。返すのはトークンに許可した接続だけで、名前順。接続の設定を読む権限（`connections:read`）は要らない。`provider`はストレージの種類（`aws`・`wasabi`・`onprem`・`other`）で、接続の設定か、エンドポイントからの判定。エンドポイントと鍵は返さない。ML Trackingは、`s3://`の場所がどの接続のものかを利用者が選ぶために使い、IDから画面のURL（`/storage/<接続ID>/<バケット>/<パス>`）を作る。`Cache-Control: no-store`。

容量メトリクスが返す値と、接続・バケットの範囲の決まりは[容量メトリクス](capacity-metrics.md)を参照する。
未認証は401（`authentication_required`・`invalid_token`）、scope不足は403（`scope_required`）。括弧内はエラー応答の`code`。

Access Tokensで名前・権限・接続・有効期限を編集できる。無効化は元に戻せる。再発行すると旧値は直ちに使えなくなり、削除すると復帰できない。
