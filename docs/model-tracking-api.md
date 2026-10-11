# ML Trackingの内蔵Mado連携からデータセットを参照する

Service Accountの`lineage:read` keyを使い、指定したNamespaceのデータセットとバージョンを参照する。
既存の`metrics:read`（容量メトリクス）と`lineage:write`（OpenLineage送信）は別用途のkeyとして維持する。

| Method | Path | 内容 |
|---|---|---|
| GET | `/api/mado/lineage/catalog?namespace=speech&q=&limit=50&offset=0` | 指定Namespaceのデータセット検索 |
| GET | `/api/mado/lineage/datasets/{datasetId}` | データセットとバージョンの一覧 |
| GET | `/api/mado/lineage/versions/{versionId}` | 固定したバージョンのID、ハッシュ、保存先URI |

管理者がSettings → Access → Service Accountsで専用Accountを作り、用途「データセット参照（lineage:read）」を選択する。
許可するNamespaceを入力し、発行されたkeyをML Trackingの「連携」画面にあるMadoの参照用キーへ保存する。
keyは表示時に一度だけ返され、再取得できない。lineage:readもNamespace指定を必須とする。
`*`は全Namespaceを読む権限になるため、必要なNamespace名を列挙する。

ML Tracking側でMadoのAPI URLと検索するNamespaceを設定する。新規連携は無効の状態から始め、設定と接続確認を済ませて有効にする。
各requestは`Authorization: Bearer`でkeyを送る。ブラウザのsession cookieを使わず、ユーザーのSSO sessionが切れてもintegrationを継続できる。
この入口はapi-internalにだけ搭載し、公開OpenLineageサーバーには追加しない。

返すのはバージョンの識別情報と保存先URIであり、接続の鍵・endpoint設定・任意のmetadata・オブジェクト本文は含めない。
Namespaceの許可には、そのNamespaceにある限定公開のStorage URIも含まれる。keyを渡す相手とNamespaceを管理者が選ぶ。
未認証は401、scope不足は403、許可外の詳細IDは404、Registry未設定は503。

ML Trackingの内蔵Mado連携はこの検索APIでバージョンを選択する。取り込み時に指定IDを再取得し、実験が参照するバージョンを固定する。
実験開始・完了・失敗・中止は、別途発行した`lineage:write`キーで既存のOpenLineage入口へ送る。MadoのAPI URLと公開OpenLineage送信先は別に設定できる。
容量メトリクスが必要なら、別の`metrics:read`キーを設定して既存の`/api/mado/metrics/capacity`を使う。
RegistryのDB/APIへML Trackingから直接接続しない。
