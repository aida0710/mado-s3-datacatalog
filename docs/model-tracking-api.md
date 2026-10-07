# Model TrackingからMadoのデータセットを参照する

Service Accountの`lineage:read` keyを使い、指定したNamespaceのデータセットと版を参照する。
既存の`metrics:read`（容量メトリクス）と`lineage:write`（OpenLineage送信）は別用途のkeyとして維持する。

| Method | Path | 内容 |
|---|---|---|
| GET | `/api/mado/lineage/catalog?namespace=speech&q=&limit=50&offset=0` | 指定Namespaceのデータセット検索 |
| GET | `/api/mado/lineage/datasets/{datasetId}` | データセットと版の一覧 |
| GET | `/api/mado/lineage/versions/{versionId}` | 固定した版のID、ハッシュ、保存先URI |

管理者がSettings → Access → Service Accountsで専用Accountを作り、用途「データセット参照（lineage:read）」を選択する。
許可するNamespaceを入力し、発行されたkeyをpluginの環境変数`MADO_READ_TOKEN`に保存する。
keyは表示時に一度だけ返され、再取得できない。lineage:readもNamespace指定を必須とする。
`*`は全Namespaceを読む権限になるため、必要なNamespace名を列挙する。

pluginは`MADO_BASE_URL`にMado UI/APIのoriginを設定し、`MADO_NAMESPACES`に検索するNamespaceを指定する。
各requestは`Authorization: Bearer`でkeyを送る。ブラウザのsession cookieを使わず、ユーザーのSSO sessionが切れてもintegrationを継続できる。
この入口はapi-internalにだけ搭載し、公開OpenLineageサーバーには追加しない。

返すのは版の識別情報と保存先URIであり、接続の鍵・endpoint設定・任意のmetadata・オブジェクト本文は含めない。
Namespaceの許可には、そのNamespaceにある限定公開のStorage URIも含まれる。keyを渡す相手とNamespaceを管理者が選ぶ。
未認証は401、scope不足は403、許可外の詳細IDは404、Registry未設定は503。

Mado Model Trackingのpluginはこの検索APIで版を選択し、実験開始・完了・失敗を既存のOpenLineage入口へ別の`MADO_LINEAGE_TOKEN`で送る。
容量メトリクスが必要なintegrationは別の`MADO_METRICS_TOKEN`を発行し、既存の`/api/mado/metrics/capacity`を使う。
RegistryのDB/APIへpluginから直接接続しない。
