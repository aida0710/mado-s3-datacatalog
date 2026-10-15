# ML Trackingの内蔵Mado連携からデータセットを参照する

アクセストークンの`lineage:read`を使い、指定したNamespaceのデータセットとバージョンを参照する。
一つのトークンに`lineage:read`と`lineage:write`（OpenLineage送信）を同時に許可できる。

| Method | Path | 内容 |
|---|---|---|
| GET | `/api/mado/lineage/catalog?namespace=speech&q=&limit=50&offset=0` | 指定Namespaceのデータセット検索 |
| GET | `/api/mado/lineage/datasets/{datasetId}` | データセットとバージョンの一覧 |
| GET | `/api/mado/lineage/versions/{versionId}` | 固定したバージョンのID、ハッシュ、保存先URI |

管理者がSettings → Access → Access Tokensでトークンを作成し、「データセット参照」を選択する。
実験のDataLineageも送る場合は「DataLineageの送信」も選ぶ。許可するNamespaceを検索して一覧でチェックし、発行された値をML Trackingの「連携」画面にあるMadoの参照用キーへ保存する。
同じトークンに送信も許可した場合は、その値を送信用キーにも設定できる。値は発行・再発行時に一度だけ返され、再取得できない。lineage:readもNamespace指定を必須とする。
`*`は全Namespaceを読む権限になるため、必要なNamespace名を列挙する。

ML Tracking側でMadoのAPI URLと検索するNamespaceを設定する。新規連携は無効の状態から始め、設定と接続確認を済ませて有効にする。
各requestは`Authorization: Bearer`でkeyを送る。ブラウザのsession cookieを使わず、ユーザーのSSO sessionが切れてもintegrationを継続できる。
この入口はapi-internalにだけ搭載し、公開OpenLineageサーバーには追加しない。

返すのはバージョンの識別情報と保存先URIであり、接続の鍵・endpoint設定・任意のmetadata・オブジェクト本文は含めない。
Namespaceの許可には、そのNamespaceにある限定公開のStorage URIも含まれる。keyを渡す相手とNamespaceを管理者が選ぶ。
未認証は401、scope不足は403、許可外の詳細IDは404、Registry未設定は503。

ML Trackingの内蔵Mado連携はこの検索APIでバージョンを選択する。取り込み時に指定IDを再取得し、実験が参照するバージョンを固定する。
実験開始・完了・失敗・中止は、`lineage:write`を許可したトークンで既存のOpenLineage入口へ送る。MadoのAPI URLと公開OpenLineage送信先は別に設定できる。
容量メトリクスが必要なら、`metrics:read`を許可したトークンで既存の`/api/mado/metrics/capacity`を使う。
Access Tokensで名前・権限・Namespace・有効期限を編集できる。無効化は元に戻せる。再発行すると旧値は直ちに使えなくなり、削除すると復帰できない。
RegistryのDB/APIへML Trackingから直接接続しない。
