---
description: Local UserとOIDC SSO、組み込みロール、接続のホワイトリスト、ユーザーの無効化。
---

# 認証とアクセス権限を設定する

madoはLocal UserとOIDC SSOに対応しています。ユーザーの役割を決めるRBACと、接続ごとの操作制限・ホワイトリストを組み合わせて使います。

## Local UserとSSOを選ぶ

| `AUTH_MODE` | ログイン方法 |
| --- | --- |
| `local` | 管理者が作成したLocal User |
| `oidc` | OIDC SSO |
| `hybrid` | Local UserとOIDC SSO |

Local Userの自己登録はありません。初期Adminは[導入手順](./install.md#initial-admin)のコマンドで作成します。

SSOではissuer、client ID、client secret、redirect URIを設定します。Authentikを使う場合の登録値、groupとroleの対応、logout設定は[OIDC連携の手順](https://github.com/aida0710/mado-s3-datacatalog/blob/main/docs/authentik.md)を参照してください。

## ログインを7日保持する

sessionの未使用期限`AUTH_SESSION_IDLE_SECONDS`と、ログインからの期限`AUTH_SESSION_ABSOLUTE_SECONDS`は、どちらも既定604800秒（7日）です。操作しない期間を含め、ログインから7日保持します。既存の`.env`で短い期限を設定している場合は、両方を`604800`にしてAPIを再起動してください。

SSOでは`OIDC_SCOPES=openid email profile offline_access`にします。Authentikの［Applications］→［Providers］でMadoのProviderを編集し、［Advanced protocol settings］の［Scopes］に標準の`offline_access` mappingを追加してください。［Refresh Token Validity］は`days=7`以上にします。既に`days=30`なら変更不要です。［Access Token Validity］は`minutes=5`のままで更新できます。反映後、一度ログインし直してrefresh tokenを取得します。

## ロールを割り当てる

**Settings → Access → Users** でユーザーを管理します。

<Screenshot src="/screenshots/access-users.png" alt="AdminとViewerを登録したユーザー管理画面" caption="ユーザーの追加、ロールの変更、無効化はAccessから行います。" />

| ロール | 主な権限 |
| --- | --- |
| Viewer | StorageとLineageの閲覧 |
| Curator | 閲覧、README・ノートの編集、Lineageの登録・修正 |
| Operator | 閲覧、ジョブの操作 |
| Admin | 接続・設定・ユーザー・アクセストークンの管理、監査ログの閲覧を含む全権限 |

複数のロールを付けた場合は、それぞれの権限を合わせて使えます。接続側で禁止した操作や、ユーザーに見せない接続へのアクセスは、別途制限されます。

## SSOの利用停止はmado側の状態も確認する

SSOのgroupから外しても、既存のmadoセッションが直ちに失効するとは限りません。すぐに利用を止める場合は、mado側のUserを無効化してください。

運用環境ではHTTPSを使い、`AUTH_COOKIE_SECURE=true` にします。認証無効モードは既存の開発・LAN環境向けで、本番モードでは起動できません。

## Pipelineにはアクセストークンを使う

人のブラウザセッションと、PipelineやPrometheusの認証を分けます。**Settings → Access → Access Tokens**で必要な権限を選んで発行します。一つのトークンに参照と送信の両方を許可できます。[APIの手順](../reference/api.md)に従って利用してください。
