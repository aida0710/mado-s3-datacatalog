# アクセストークンの管理API

画面はSettings → Access → Access Tokens。ユーザーセッションとBearerトークンの両方から管理できる。一覧は`service_accounts:read`、作成・変更・再発行・削除は`service_accounts:manage`が必要。既存のAdminロールの権限は維持する。

トークンは既存の`/api/internal/*`のほぼ全機能にも利用できる。機能・操作・対象の対応は[内部APIの権限](internal-api-permissions.md)を参照する。

## 契約

| Method | `/api/internal`以下のPath | 内容 |
|---|---|---|
| GET | `/access-tokens` | 削除されていないトークンのメタデータを`tokens`に返す |
| GET | `/access-tokens/namespaces` | DataLineageと既存トークンのNamespace一覧 |
| POST | `/access-tokens` | 名前・説明・権限・Namespace・任意の有効期限を指定して作成 |
| PATCH | `/access-tokens/{id}` | 名前・説明・権限・Namespace・有効期限・状態を変更 |
| POST | `/access-tokens/{id}/regenerate` | 秘密の値を再発行。旧値は直ちに認証不可 |
| DELETE | `/access-tokens/{id}?expectedRevision={revision}` | 失効して一覧から除去。履歴は保持 |

作成の本文例:

```json
{
  "name": "ML Tracking",
  "description": "データセット参照と学習のDataLineage送信",
  "permissions": ["lineage:read", "lineage:send"],
  "connections": [],
  "namespaces": ["speech"],
  "expiresAt": null
}
```

`permissions`で機能ごとの操作を一つ以上指定する。DataLineageの`lineage:read`は内部APIと連携用の参照API、`lineage:send`はOpenLineage送信、`capacity:read`は内部の容量APIとPrometheusメトリクスを許可する。連携APIが確かめる`scopes`はサーバーが`permissions`から決める。入力には含めず、含めると400になる。DataLineageの参照・送信・登録/編集にはNamespaceが必須。DataLineageを使わない場合は空配列にする。

応答の`scopes`は`permissions`から決まった値で、連携API（`/api/mado/`、OpenLineage）が確かめるもの。PATCHで`permissions`を省略すると、既存の権限は変わらない。

`connections`は許可する接続IDの配列で、全接続は`["*"]`、省略は空配列。接続を使う内部権限には一つ以上の選択が必須。新規画面は空配列から始める。容量取得はNamespaceで制限されず、選んだ接続の範囲で制限する。

PATCHは省略した項目を保持し、`status`は`active`または`disabled`。PATCHと再発行の本文には一覧の`revision`を`expectedRevision`として渡す。古い値なら409 `token_conflict`となり、変更しない。削除済みのIDは404。

作成・再発行は`{ accessToken, token }`、変更・削除は`{ accessToken }`を返す。秘密の`token`は作成・再発行時の応答だけに含め、一覧・監査には含めない。応答には`Cache-Control: no-store`を付ける。

同じ内容を再保存した場合はrevisionを更新せず、操作監査も増やさない。Namespaceの重複は取り除く。

## Namespaceの選択

画面はNamespaceを検索し、絞り込んだ一覧をチェックして複数選択する。検索や取得の再試行では選択を消さない。まだ一覧にない名前も追加できる。追加はトークンの許可対象を指定する操作で、データセットや処理を登録する操作ではない。全対象の許可は明示的に選択し、保存時に`["*"]`へ変換する。

一覧APIは`{ namespaces: string[], sourceStatus }`を返す。取得元はMarquezの登録済みNamespaceと、削除されていない既存トークンのNamespace。Marquezの一覧は[0.50.0のNamespaceResource](https://github.com/MarquezProject/marquez/blob/0.50.0/api/src/main/java/marquez/api/NamespaceResource.java)の`GET /api/v1/namespaces?limit=&offset=`を使う。1,000件ずつ最大10ページで取得し、データセット全件の走査は行わない。

`sourceStatus`は`ready`・`unavailable`・`unconfigured`・`partial`。取得元の停止や上限で一覧が不完全でも、取得済みの名前と既存トークンの名前は返す。画面で不完全なことを伝え、名前の追加と既存の選択を利用できるようにする。一覧APIには`service_accounts:read`を要求する。

## 既存環境への適用

トークンの表は`038_access_tokens.sql`、内部API対応は`039_internal_api_tokens.sql`と`040_explicit_token_grants.sql`の移行で作る。移行は`api-internal`が起動時に番号順に当てる。040は既存トークンを新しい形へ変換する: 連携scopeだけのトークンには対応する機能別の権限（`lineage:read`→`lineage:read`、`lineage:write`→`lineage:send`、`metrics:read`→`capacity:read`）を付け、接続を指定していなかった容量トークンには全接続（`["*"]`）を明示する。持ち主のアカウントが無効だったトークンは、トークン自身を無効にする。トークンの値・IDは変わらない。アプリはこの変換後の形だけを読む。

`service_accounts`と`service_account_keys`は監査・Registryの主体IDとして保持し、新規作成では内部の持ち主を自動で用意する。再発行は権限・有効期限・無効状態を引き継ぐ。削除は`revoked_at`を保存し、監査・Registryの過去の参照を残す。

## ブラウザ検証

`api/scripts/serve-access-token-fixture.ts`は、スキーマを適用した空の専用DB`dashboard_access_tokens_verify`だけを使う。接続先はloopback限定。架空の管理者とトークンを作り、実際の管理APIとBearer認証を検証する。本番サーバーにはこのfixtureを組み込まない。

1. 専用DBの接続文字列を`MADO_ACCESS_TOKEN_DATABASE_URL`へ設定し、リポジトリ直下で`api/node_modules/.bin/tsx api/scripts/serve-access-token-fixture.ts`を起動する。
2. 別の端末で`node front/scripts/serve-access-token-verification.mjs`を起動する。
3. `MADO_PLAYWRIGHT_MODULE`にインストール済みPlaywrightの`index.mjs`の絶対パスを設定し、`node front/scripts/verify-access-tokens.mjs`を実行する。必要なら`MADO_CHROMIUM_PATH`を指定する。

`MADO_SCREENSHOT_DIR`を指定すると確認画像を保存する。秘密の値が表示されていれば撮影せずに失敗する。検証スクリプトは専用fixtureの応答を確認してから操作する。
