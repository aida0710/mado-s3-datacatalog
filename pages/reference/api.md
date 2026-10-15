---
description: アクセストークンの発行・再発行・無効化と、scope・Namespace、OpenLineageイベントの送信、Prometheus容量メトリクス。
---

# アクセストークンでAPIを使う

データセットの参照、PipelineからのOpenLineage送信、Prometheusからのメトリクス取得はアクセストークンを使います。人のログイン情報をスクリプトへ渡す必要はありません。

<Screenshot src="/screenshots/service-accounts.png" alt="アクセストークンの権限と有効状態を一覧する画面" caption="Settings → Access → Access Tokensで、トークンごとの権限と有効状態を管理します。" />

## トークンを作成する

Adminが**Settings → Access → Access Tokens**の**アクセストークンを作成**を開き、名前と許可する操作を指定します。アカウントを別に作る操作はありません。

**データセット参照**と**DataLineageの送信**は両方選べます。Namespaceはデータセットや処理のグループ名です。例えば、音声を`speech`、Podcastを`podcast`に分けられます。S3の接続やバケットとは別の分類です。**Namespaceを検索**で一覧を絞り、許可する名前にチェックを付けます。検索を変えても選択は保持します。一覧にない名前は検索欄へ入力して**追加**できます。全対象を許可する場合だけ**すべてのNamespaceを許可**を選びます。容量取得だけを選ぶ場合、Namespaceは不要です。

<Screenshot src="/screenshots/access-token-create.png" alt="Namespaceを検索しチェックボックスで選択するトークン作成画面" caption="検索で一覧を絞ってチェックします。選択済みの名前は検索を変えても保持されます。" />

値は発行時に一度だけ表示されます。連携先のシークレット管理へ保存してください。有効期限は任意です。

| Scope | 用途 | 入口 |
| --- | --- | --- |
| `lineage:read` | データセットとバージョンの参照 | `GET /api/mado/lineage/catalog`など |
| `lineage:write` | OpenLineageイベントの送信 | `POST /api/openlineage/v1/lineage` |
| `metrics:read` | 全接続の容量メトリクスの取得 | `GET /api/mado/metrics/capacity` |

mado自身のデータを返す `/api/mado/` はGETだけです。一つのトークンに必要なscopeを組み合わせられます。`metrics:read`はホワイトリストで利用者を限定した接続も含め、全接続のバケット名・容量を読み取れます。参照・送信と組み合わせた場合も、容量取得はNamespaceでは制限されません。

ML Trackingでデータセットを参照し、実験のDataLineageを送る場合は、参照と送信を許可した同じ値を参照用キーと送信用キーの両方に設定できます。

## OpenLineageイベントを送信する

送信先のURLとkeyを、Pipelineの環境変数やシークレット管理から渡します。次はイベントJSONを `event.json` に用意した場合の例です。

```bash
curl --fail-with-body \
  -X POST "$MADO_LINEAGE_URL/api/openlineage/v1/lineage" \
  -H "Authorization: Bearer $MADO_LINEAGE_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @event.json
```

`MADO_LINEAGE_URL` は公開API用hostnameのorigin、`MADO_LINEAGE_KEY` は `lineage:write` のkeyです。許可されたnamespaceのイベントを送信します。イベント形式と登録の扱いは[Lineageの仕様](https://github.com/aida0710/mado-s3-datacatalog/blob/main/docs/lineage.md)に記載しています。

## Prometheusで容量メトリクスを取得する

メトリクスはUI側のintranet用入口にあります。公開API用入口には載せていません。

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $MADO_METRICS_KEY" \
  "$MADO_URL/api/mado/metrics/capacity"
```

Prometheusの設定例です。Bearer tokenはファイルから読みます。

```yaml
scrape_configs:
  - job_name: mado-capacity
    scheme: https
    metrics_path: /api/mado/metrics/capacity
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/secrets/mado-metrics-key
    static_configs:
      - targets: ['mado.example.com']
```

`mado.example.com` を実際のUI用hostnameへ置き換えます。返すメトリクスの一覧は[容量メトリクスの仕様](https://github.com/aida0710/mado-s3-datacatalog/blob/main/deploy/mdx/README.md#prometheus-metrics)を参照してください。

## トークンを編集・再発行・無効化する

一覧の各トークンの**…**から操作します。

- **編集**: 名前・用途のメモ・権限・Namespace・有効期限を変更します。値は変わりません。
- **再発行**: 以前の値を直ちに失効し、新しい値を一度だけ表示します。権限・有効期限・無効状態は引き継ぎます。連携先の値も更新してください。
- **無効にする / 有効にする**: 同じ値の利用を一時停止・再開します。
- **削除**: 利用を終了し、一覧から取り除きます。元には戻せません。監査用の操作履歴は残ります。

既存のService Account keyも同じ一覧から管理できます。値と権限はそのまま引き継ぎます。
