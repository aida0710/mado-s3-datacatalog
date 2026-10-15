# アクセストークンの管理API

画面はSettings → Access → Access Tokens。トークンの作成と操作に`service_accounts:manage`のユーザーセッションが必要。Bearerトークン自身には管理権限を与えない。

## 契約

| Method | `/api/internal`以下のPath | 内容 |
|---|---|---|
| GET | `/access-tokens` | 削除されていないトークンのメタデータを`tokens`に返す |
| POST | `/access-tokens` | 名前・説明・権限・Namespace・任意の有効期限を指定して作成 |
| PATCH | `/access-tokens/{id}` | 名前・説明・権限・Namespace・有効期限・状態を変更 |
| POST | `/access-tokens/{id}/regenerate` | 秘密の値を再発行。旧値は直ちに認証不可 |
| DELETE | `/access-tokens/{id}?expectedRevision={revision}` | 失効して一覧から除去。履歴は保持 |

作成の本文例:

```json
{
  "name": "ML Tracking",
  "description": "データセット参照と学習のDataLineage送信",
  "scopes": ["lineage:read", "lineage:write"],
  "namespaces": ["speech"],
  "expiresAt": null
}
```

`scopes`には`lineage:read`・`lineage:write`・`metrics:read`を重複なしで一つ以上指定する。参照または送信を含む場合はNamespaceが必須。容量取得だけの場合は空配列。容量取得の範囲は、組み合わせたDataLineageのNamespaceでは制限されない。

PATCHは省略した項目を保持し、`status`は`active`または`disabled`。PATCHと再発行の本文には一覧の`revision`を`expectedRevision`として渡す。古い値なら409 `token_conflict`となり、変更しない。削除済みのIDは404。

作成・再発行は`{ accessToken, token }`、変更・削除は`{ accessToken }`を返す。秘密の`token`は作成・再発行時の応答だけに含め、一覧・監査には含めない。応答には`Cache-Control: no-store`を付ける。

同じ内容を再保存した場合はrevisionを更新せず、操作監査も増やさない。Namespaceの重複は取り除く。

## 既存環境への適用

`038_access_tokens.sql`を新APIより先に適用する。既存の`service_accounts`と`service_account_keys`は内部の識別・監査・Registryの互換性のため保持し、新規作成では内部の持ち主を自動で用意する。既存トークンの値・ID・scope・Namespaceは変えない。

旧管理APIも維持する。無効化された旧アカウントのキーを一つ有効化しても、同じアカウントのほかのキーは無効のまま。再発行は権限・有効期限・無効状態を引き継ぐ。削除は`revoked_at`を保存し、監査・Registryの過去の参照を残す。

## ブラウザ検証

`api/scripts/serve-access-token-fixture.ts`は、スキーマを適用した空の専用DB`dashboard_access_tokens_verify`だけを使う。接続先はloopback限定。架空の管理者とトークンを作り、実際の管理APIとBearer認証を検証する。本番サーバーにはこのfixtureを組み込まない。

1. 専用DBの接続文字列を`MADO_ACCESS_TOKEN_DATABASE_URL`へ設定し、リポジトリ直下で`api/node_modules/.bin/tsx api/scripts/serve-access-token-fixture.ts`を起動する。
2. 別の端末で`node front/scripts/serve-access-token-verification.mjs`を起動する。
3. `MADO_PLAYWRIGHT_MODULE`にインストール済みPlaywrightの`index.mjs`の絶対パスを設定し、`node front/scripts/verify-access-tokens.mjs`を実行する。必要なら`MADO_CHROMIUM_PATH`を指定する。

`MADO_SCREENSHOT_DIR`を指定すると確認画像を保存する。秘密の値が表示されていれば撮影せずに失敗する。検証スクリプトは専用fixtureの応答を確認してから操作する。
