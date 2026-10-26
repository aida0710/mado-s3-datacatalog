# Authentik連携

mado S3 Data CatalogはOIDC Authorization Code Flow + PKCEを使います。MFA、password policy、recovery、
login flowはAuthentikを正本とし、mado S3 Data CatalogはUser、Role、browser session、操作監査を管理します。

## Authentikに登録する値

`https://mado.example`は実際のHTTPS URLへ置き換えます。

| 項目 | 値 |
|---|---|
| Redirect URI | `https://mado.example/api/auth/oidc/callback` |
| Post logout redirect URI | `https://mado.example/` |
| Front-channel logout URI | `https://mado.example/api/auth/oidc/frontchannel-logout` |
| Back-channel logout URI | `https://mado.example/api/auth/oidc/backchannel-logout` |

AuthentikではApplicationとOAuth2/OIDC Providerを作り、issuerにはapplication単位のURL
（例: `https://auth.example/application/o/mado/`）を使います。Scopeは`openid email profile offline_access`です。
`profile` scopeに`preferred_username`、`name`、`groups`を含め、emailを既存Userとの連携に
使う場合は信頼できる`email_verified` claimも返します。

Providerのscope mappingで`offline_access`を有効にし、mado S3 Data Catalogの`MDC_OIDC_SCOPES`にも含めます。
mado S3 Data Catalogはaccess/refresh tokenを暗号化してsessionに保存し、UserInfoの現在のgroupを1分ごとに
確認します。groupの除外やRoleの変更を検出したら同じidentityのsessionを失効させます。
UserInfoには現在のgroupを返すmappingが必要です。IdP停止時は確認が必要な操作へ503を返し、
未確認の権限を通しません。失効したtokenや更新手段のない期限切れtokenは再ログインが必要です。
refresh tokenを発行しない構成ではaccess tokenの有効期限ごとに再ログインになります。
Authentikの[OAuth2/OIDC Providerの手順](https://docs.goauthentik.io/add-secure-apps/providers/oauth2/)も参照してください。

7日保持するには、［Applications］→［Providers］でmado S3 Data CatalogのProviderを編集し、
［Advanced protocol settings］の［Scopes］に標準の
「authentik default OAuth Mapping: OpenID 'offline_access'」を追加します。
［Refresh Token Validity］は`days=7`以上にします。既に`days=30`なら変更不要です。
［Access Token Validity］は`minutes=5`のままで更新できます。

migration 037より前に作ったSSO sessionはtokenを保持していないため、更新後に一度だけ
ログインし直します。Local sessionはそのまま使えます。

Back-channel logoutを有効にすると、AuthentikでUserやsessionを無効化した時点でmado S3 Data Catalogの
server-side sessionも失効します。mado S3 Data Catalogは署名、issuer、audience、発行時刻、event、jtiを検証し、
同じlogout tokenの再利用を拒否します。

## mado S3 Data Catalogの設定例

導入時はLocal Adminを緊急経路として残すため`hybrid`を推奨します。SSOの確認後、必要なら
`oidc`へ変更します。本番ではHTTPSとSecure Cookieが必須です。

```dotenv
MDC_AUTH_MODE=hybrid
MDC_AUTH_COOKIE_SECURE=true
MDC_AUTH_SESSION_IDLE_SECONDS=604800
MDC_AUTH_SESSION_ABSOLUTE_SECONDS=604800
MDC_OIDC_ISSUER_URL=https://auth.example/application/o/mado/
MDC_OIDC_CLIENT_ID=...
MDC_OIDC_CLIENT_SECRET=...
MDC_OIDC_REDIRECT_URI=https://mado.example/api/auth/oidc/callback
MDC_OIDC_POST_LOGOUT_REDIRECT_URI=https://mado.example/
MDC_OIDC_LABEL=Authentik
MDC_OIDC_SCOPES=openid email profile offline_access
MDC_OIDC_AUTO_LINK_VERIFIED_EMAIL=false
MDC_OIDC_ALLOWED_GROUPS=mado-users,mado-admins,mado-curators,mado-operators
MDC_OIDC_ROLE_MAPPING_JSON={"mado-admins":"admin","mado-curators":"curator","mado-operators":"operator","mado-users":"viewer"}
MDC_OIDC_DEFAULT_ROLE=viewer
```

この設定では、操作しない期間を含め、ログインから7日保持します。既存の`.env`も更新し、
APIを再起動してください。設定例や既定値を変えても、既存の値は自動で変わりません。
反映後、一度ログインし直してrefresh tokenを取得します。

## UserとRoleの同期規則

- 初回SSOでUserをJIT作成します。self-signup用のmado S3 Data Catalog画面はありません。
- 既存Local Userへのemail自動連携は既定で無効です。有効化した場合も`email_verified=true`かつemail一致が必要で、Admin等の特権Local Userは自動連携しません。
- 未検証emailはUserのemailにも既存Userとの連携にも使いません。
- `MDC_OIDC_ALLOWED_GROUPS`は必須です。いずれかのgroupに所属しないUserを拒否し、空の設定ではmado S3 Data Catalogが起動しません。
- role mappingが設定されている場合、SSOログインのたびにmado S3 Data Catalog RoleをAuthentik groupへ同期します。
- 複数groupから複数Roleを付与できます。該当groupが無い場合は`MDC_OIDC_DEFAULT_ROLE`になります。
- `MDC_OIDC_ROLE_MAPPING_JSON`を空（`{}`）にすると、AuthentikはログインできるかどうかだけをAuthentik groupで決め、RoleはSettings > Access > Usersで管理します。ログインと再確認でRoleを変えず、初回SSOのUserは`MDC_OIDC_DEFAULT_ROLE`で作ります。社内全員が入るgroupを1つだけ`MDC_OIDC_ALLOWED_GROUPS`に入れる運用に向きます。
- SSO由来の表示名と検証済みemailはログイン時に更新します。mado S3 Data Catalogの署名は上書きしません。
- Local UserのユーザーIDは連携後も維持します。JIT Userは`preferred_username`が未使用なら採用します。

Role同期を使う環境では、SSO UserのRoleをmado S3 Data Catalog画面から一時的に変えても次回ログインで
Authentik側の状態へ戻ります。恒久変更はAuthentik groupで行います。

groupの判定とRoleの同期はログイン時と、使用中のSSO sessionの再確認（1分ごと）で行います。
Authentik側で許可groupから外したりRoleを変えたりすると、次の再確認でsessionが失効します。
すぐに止めたいときは、mado S3 Data CatalogのSettings > Access > UsersでそのUserを無効にしてください。
無効にするとsessionはその場で失効します。

## Login transactionの防御

mado S3 Data CatalogはAuthorization Code Flowの`state`とPKCEに加え、OIDC開始時に短命のHttpOnly cookieを発行します。callbackは同じbrowser cookieを提示した場合だけ受理するため、別browserで開始した認証transactionや古いtransactionを流用できません。`returnTo`もmado S3 Data Catalog内の相対pathだけを許可します。

Local loginとOIDC開始には、送信元IPごとの回数制限があります。Local loginとパスワード変更には、
同時に行うArgon2の処理数の制限もあります。パスワード変更の「現在のパスワード」の確認には、
User単位の回数制限（15分に10回）もあります。
上限時は`429`を返すため、reverse proxyで追加制限する場合もこの応答を維持してください。

## SSOで入れないときの切り分け

callbackで断ったときは、利用者には理由を区別せず`401`を返し、api-internalのlogに
`oidc login failed`と理由（`reason`）を残します。tokenやcodeは出しません。

| `reason` | 意味 | 直し方 |
| --- | --- | --- |
| `group_not_allowed` | `MDC_OIDC_ALLOWED_GROUPS`のどのgroupにも入っていない | Authentikでgroupに入れる |
| `user_disabled` | mado S3 Data CatalogでそのUserが無効になっている、または削除されている | 無効ならSettings > Access > Usersで有効にする。削除したUserは有効に戻せず、そのSSOのUserは今は入れ直せない（SSOとの結び付きを外す機能は無い） |
| `last_admin` | groupの同期で、最後のactiveなAdminを降格しようとした | 別のAdminを先に用意する |
| `privileged_link_required` | 検証済みemailが、特権を持つLocal Userと一致した | 乗っ取りを防ぐため自動では連携しない。連携するなら、`MDC_OIDC_AUTO_LINK_VERIFIED_EMAIL`が有効な状態で、そのLocal UserのRoleを一時的にviewerだけにしてSSOで1度入ってもらい、Roleを戻す |
| `deleted_user_email` | 検証済みemailが、削除したUserと一致した | 別のemailにするか、管理者が対応する |

これ以外の`reason`（IdPに届かない、stateが古い、開始したbrowserと違う、など）は、
IdPとの通信やbrowser側の問題です。
