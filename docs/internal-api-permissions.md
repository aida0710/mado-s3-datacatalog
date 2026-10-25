# 内部APIのアクセストークン権限

`/api/internal/*`はブラウザセッションに加え、`Authorization: Bearer <token>`で利用できる。既存のURL・入力・応答を使い、トークンに明示した操作と対象を毎回検証する。内部APIの公開範囲は変えない。公開OpenLineage専用入口の`:8081`には追加しない。

## 機能と操作

| 機能 | `permissions`の値 | 主な対象 |
|---|---|---|
| Storage | `storage:read` | バケット・一覧・プレビュー・メディア |
| Connections | `connections:read`, `connections:manage`, `connections:delete` | 接続一覧・作成/変更・削除 |
| README | `readmes:read`, `readmes:write` | 本文・履歴・検索・編集 |
| Notes | `notes:read`, `notes:write` | ノート・履歴・編集 |
| Tags | `tags:read`, `tags:write`, `tags:delete` | タグ定義・割り当て・検索 |
| Favorites | `favorites:read`, `favorites:write`, `favorites:delete` | 接続内のお気に入り |
| DataLineage | `lineage:read`, `lineage:send`, `lineage:curate` | 検索・詳細・グラフ・OpenLineage送信・手動登録/修正 |
| Jobs | `jobs:read`, `jobs:operate` | 実行状態・走査開始・キャンセル |
| Capacity | `capacity:read`, `capacity:operate` | 容量・計測開始 |
| Pricing | `pricing:read`, `pricing:refresh` | 単価・転送見積もり・単価更新 |
| Settings | `settings:read`, `settings:manage` | アプリ設定 |
| Users | `users:read`, `users:manage` | 一覧・作成/変更・ロール・パスワード・削除 |
| Access Tokens | `service_accounts:read`, `service_accounts:manage` | 一覧・発行・変更・再発行・削除 |
| Audit | `audit:read` | 操作履歴 |

読み取り・編集・削除は独立している。編集を選んでも読み取りは自動で付かない。ジョブの投入応答で得たIDを取得するには`jobs:read`も必要。権限カタログは`api/shared/access-token-permissions.ts`、ルート対応は`api/lib/internal-api-permission-policy.ts`。新しいルートは明示的な対応を追加するまでトークンに開放しない。

ブラウザの組み込みロールは従来の権限を維持する。例えば`content:write`はREADME・Notes・Tags・Favoritesの編集/削除、`connections:manage`は接続削除と容量計測を含む。トークンにこの互換展開は適用しない。

## 対象を選ぶ

`connections`は接続IDの配列、`namespaces`はNamespace名の配列。全対象はそれぞれ`["*"]`を明示する。新規画面ではすべて未選択。接続とNamespaceは検索した一覧をチェックして選ぶ。読み取りのみ・管理者・ML Tracking連携・容量監視のプリセットも用意する。管理者プリセットは全権限・全接続・全Namespaceを選ぶ。DataLineageの送信も同じ機能別一覧で選ぶ。

Storage・Connections・README・Tags・Favorites・Jobs・Capacity・Pricingの権限には接続の指定が必要。接続管理権限を持っていても、許可していない接続を操作できない。URL・クエリ・ジョブのpayload・手動登録の保存場所にも同じ制限を適用する。接続の新規作成・既定接続の変更・共有タグ定義の作成/変更/削除には全接続の許可が必要。接続を持たないジョブ(単価更新など)の参照・キャンセルも、全接続のトークンだけが行える。接続の公開設定は、このトークンの選択範囲を広げない。許可していない接続は404にする。

DataLineageにはNamespaceの指定が必要。限定トークンの検索・カタログは`namespace`クエリも必須。Dataset・Version・RunはRegistryの正本のIDとNamespaceを検証する。Runの入出力も範囲内でなければ返さない。グラフは範囲外のノードと辺を除き、Versionグラフが省略された場合は`truncated: true`にする。Namespaceをまたぐジョブの実行は一覧から除く。手動登録でもDataset・処理・入力Version・出力Versionを検証し、同値更新でも検証を省略しない。投影状態の件数・状態は全体の運用情報として返す。

DataLineageの保存先URIはNamespaceの権限で読める。接続の選択はStorage操作と保存先のmado S3 Data Catalog接続IDを制限し、URI自体を隠すものではない。これは従来のデータセット参照APIと同じ扱い。

## 管理権限の委譲

`service_accounts:manage`があっても、自分より強い操作権限・連携scope・接続・Namespaceを持つトークンや、自分の有効期限より後まで残るトークン(期限なしを含む)を作成・変更できない。既存トークンの再発行・有効化・無効化・削除にも、現在の権限範囲の検証を行う。強いトークンの再発行で秘密の値を取得する迂回を防ぐ。

この検証は対象の行を確保した後、同じトランザクションの中で行う。権限の外にあるトークンへの操作は、revisionが古くても409ではなく403を返す。呼び出し元のトークンがその時点で無効・失効・削除済みなら、書き込みを確定せず401を返す。

トークンの一覧には、呼び出し元のトークンが管理できるものだけを返す。Namespace候補の一覧も、呼び出し元が許可されたNamespaceに絞る(全Namespaceのトークンには全件)。

トークンの連携scopeは`permissions`から決まる。入力に`scopes`は含められない（400）。

ユーザー管理はロール・パスワードを変更できるため、トークンでは全機能の権限・全連携scope・全接続・全Namespaceを持つ場合だけ変更できる。`users:read`だけの閲覧は可能。ブラウザAdminの操作は従来どおり。

`audit:read`はブラウザのユーザーと同じく操作履歴の全体を読む権限で、トークンの接続・Namespaceの限定では絞られない。範囲を限定したいトークンには付けない。`audit:read`を持たない管理トークンは、それを他のトークンへ付けられない。

ログイン・ログアウト・SSO・自分のプロフィール/パスワード変更は`/api/auth/*`のブラウザセッション専用。トークンの管理は`/access-tokens/*`だけで行う。

## 認証と操作の記録

Authorizationヘッダーがある場合はBearer認証だけを使い、失敗時にCookieへ切り替えない。Cookieによる書き込みはOriginを検証し、セッションを確かめる(有効期限を延ばす)前に検証する。Authorizationヘッダーのある要求はブラウザOriginを要求しない。

トークンによる変更の操作履歴は`actor_type: service_account`と持ち主IDを記録し、`details.keyId`で個々のトークンを識別する。README・Notesの編集者はトークン名、ユーザーIDはnull。発行者のユーザーになりすますことはない。

`039_internal_api_tokens.sql`は内部権限と接続のテーブルを追加し、`040_explicit_token_grants.sql`は既存トークンを機能別の権限と明示した接続へ変換する（[アクセストークン](access-tokens.md)の「既存環境への適用」）。新しいAPIはこの形だけを読むので、本番では反映前に039・040の順で適用する。040は持ち主アカウントの状態の列と、接続の指定の有無の列を削除するため、旧版へは戻せない。接続の指定は容量メトリクスの接続名・バケット・prefix・計測設定のすべてに適用する。公開OpenLineage用のDBロールには新しいテーブルの権限を付けない。

DataLineageの読み取り・送信とCapacityの読み取りは、従来の参照API・OpenLineage送信・Prometheusも同じ選択で許可する。発行・変更では`lineage:read`→`lineage:read`、`lineage:send`→`lineage:write`、`capacity:read`→`metrics:read`のscopeをサーバーで保存する。画面に別の連携API権限欄は設けない。

内部APIは全環境で認証主体を必須にします。README・NotesのPUT本文は `editor` を受け付けず、含まれていれば400を返します。編集者名はユーザーの `signatureName` またはトークン名から決めます。DataLineageの論理グラフは `rootKind=dataset|job` を指定し、`kind` を含む要求は400になります。

## エラー応答

APIのエラー応答はすべて`{ "error": <英語の文>, "code": <snake_case> }`の形。`error`はログやcurlで人が読む説明で、文面は変わり得る。プログラムと画面は`code`で分岐し、訳す。文に入る値は横の項目に置く（権限不足の`permission`、接続で無効な操作の`capability`、scope不足の`scope`など）。`code`の一覧は`api/shared/api-error-codes.ts`。
