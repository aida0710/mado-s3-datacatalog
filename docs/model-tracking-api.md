# ML Trackingの内蔵Mado連携からデータセットを参照する

アクセストークンの`lineage:read`を使い、許可したNamespaceのデータセットとバージョンを参照する。
一つのトークンにDataLineageの読み取り（scope `lineage:read`）と送信（`lineage:send`、scope `lineage:write`）、必要ならCapacityの読み取り（`capacity:read`、scope `metrics:read`）を同時に許可できる。
ML Trackingはこのトークン1本で参照・送信・容量取得を行う。

| Method | Path | 内容 |
|---|---|---|
| GET | `/api/mado/access-token` | 呼び出したトークン自身の名前・scope・Namespace・有効期限 |
| GET | `/api/mado/lineage/catalog?namespace=speech&q=&limit=50&offset=0` | 指定Namespaceのデータセット検索 |
| GET | `/api/mado/lineage/datasets/{datasetId}` | データセットとバージョンの一覧 |
| GET | `/api/mado/lineage/versions/{versionId}` | 固定したバージョンのID、ハッシュ、保存先URI |

管理者がSettings → Access → Access Tokensでトークンを作成し、DataLineageの「読み取り」と「送信」を選択する（「ML Tracking連携」プリセットでも両方を選べる）。
許可するNamespaceを検索して一覧でチェックする。取り込むデータセットのNamespaceと、ML TrackingがRunの記録を送るNamespace（既定は`mado-model-tracking`）を含める。
発行された値をML Trackingの「連携」画面にあるMadoのアクセストークンへ保存する。読み取り・送信の選択から`lineage:read`・`lineage:write`の許可をサーバーが導出するため、従来API用の権限を別に選ぶ操作は不要。値は発行・再発行時に一度だけ返され、再取得できない。lineage:readもNamespace指定を必須とする。
`*`は全Namespaceを読む権限になるため、必要なNamespace名を列挙する。

ML Tracking側ではMadoのAPI URLとアクセストークンを設定する。検索するNamespaceは入力せず、`/api/mado/access-token`でトークン自身の許可範囲を読んで決める。
この入口はscopeを問わず有効なトークンに答え、`{id,name,scopes,namespaces,expiresAt}`だけを返す（`namespaces`の`["*"]`は全Namespace、`expiresAt`は無期限ならnull）。他のトークンの情報、内部の所有者ID、トークンの値は返さない。`Cache-Control: no-store`。
新規連携は無効の状態から始め、設定と接続確認を済ませて有効にする。
各requestは`Authorization: Bearer`でkeyを送る。ブラウザのsession cookieを使わず、ユーザーのSSO sessionが切れてもintegrationを継続できる。
この入口はapi-internalにだけ搭載し、公開OpenLineageサーバーには追加しない。

返すのはバージョンの識別情報と保存先URIであり、接続の鍵・endpoint設定・任意のmetadata・オブジェクト本文は含めない。
Namespaceの許可には、そのNamespaceにある限定公開のStorage URIも含まれる。keyを渡す相手とNamespaceを管理者が選ぶ。
未認証は401、scope不足は403、許可外の詳細IDは404、Registry未設定は503。

ML Trackingの内蔵Mado連携はこの検索APIでバージョンを選択する。取り込み時に指定IDを再取得し、実験が参照するバージョンを固定する。
実験開始・完了・失敗・中止は、`lineage:write`を許可したトークンで既存のOpenLineage入口へ送る。MadoのAPI URLと公開OpenLineage送信先は別に設定できる。
容量メトリクスが必要なら、同じトークンでCapacityの「読み取り」と接続を選び、`metrics:read`が許可された状態で既存の`/api/mado/metrics/capacity`を使う。
Access Tokensで名前・権限・Namespace・有効期限を編集できる。ML Trackingは検索・取り込みのたびに許可範囲を読み直すため、Namespaceの変更に連携の再設定は要らない。無効化は元に戻せる。再発行すると旧値は直ちに使えなくなり、削除すると復帰できない。
RegistryのDB/APIへML Trackingから直接接続しない。
