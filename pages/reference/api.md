---
description: アクセストークンの発行・再発行・無効化と、権限・接続の選び方、Prometheus容量メトリクス。
---

# アクセストークンでAPIを使う

スクリプトから画面と同じ操作をするときや、Prometheusからメトリクスを取得するときは、アクセストークンを使います。人のログイン情報をスクリプトへ渡す必要はありません。

<Screenshot src="/screenshots/service-accounts.png" alt="アクセストークンの権限と有効状態を一覧する画面" caption="Settings → Access → Access Tokensで、トークンごとの権限と有効状態を管理します。" />

## トークンを作成する

Adminが**Settings → Access → Access Tokens**の**アクセストークンを作成**を開き、名前と許可する操作を指定します。アカウントを別に作る操作はありません。

機能ごとの一覧で、許可する操作にチェックを付けます。プリセットから選ぶこともできます。Storageや容量など接続を使う操作を選んだら、許可する接続も選びます。接続は検索で一覧を絞ってチェックし、検索を変えても選択は保持します。全接続を許可する場合だけ、すべての接続を選びます。

<Screenshot src="/screenshots/access-token-create.png" alt="名前・権限・有効期限を指定するトークン作成画面" caption="名前と許可する操作、有効期限を指定して作成します。" />

値は発行時に一度だけ表示されます。連携先のシークレット管理へ保存してください。**有効期限**は既定で90日です。7・30・90・365日、無期限、**期間を指定**（分・時間・日）、**カレンダーで指定**から選べます。値は`mado_dc_`で始まります（mado ML Trackingのトークンは`mado_mt_`で始まります）。

| 機能・操作 | 用途 | 入口 |
| --- | --- | --- |
| Capacity: 読み取り | 許可した接続の容量メトリクスの取得 | `GET /api/mado/metrics/capacity` |

連携用の `/api/mado/` はGETだけです。連携APIのscopeは、選択した操作から決まります。容量取得は選択した接続が対象です。

`GET /api/mado/access-token`は、scopeを問わず、呼び出したトークン自身の名前・scope・有効期限を返します。ほかのトークンの情報や、トークンの値は返しません。連携先が、渡されたトークンで何ができるかを確かめるための入口です。

`GET /api/mado/connections`は、scopeを問わず、呼び出したトークンに許可した接続のID・名前・種類を返します。エンドポイントや鍵は返しません。連携先が、S3の場所がどの接続のものかを選ぶための入口です。

データセットと処理の来歴（DataLineage）はmado ML Trackingが受け持ちます。madoにDataLineageのAPIはありません（v0.6.0で外しました）。ML Trackingから容量メトリクスを読む場合は、Capacityの**読み取り**を許可したトークンを、ML Trackingの［連携］の「アクセストークン」に設定します。

## 内部APIを使う

Storage・README・Notes・ジョブ・接続・設定など、画面と同じ内部APIをトークンで利用できます。新規作成は権限未選択から始まり、機能ごとに読み取り・編集・削除・実行・管理を選びます。必要ならプリセットを使い、対象の接続を検索してチェックします。

<Screenshot src="/screenshots/token-permissions.png" alt="機能ごとの操作権限と接続を選ぶ画面" caption="機能ごとに操作を選び、許可する接続をチェックします。" />

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $MDC_API_TOKEN" \
  "$MDC_URL/api/internal/connections"
```

この例には`permissions: ["connections:read"]`と接続の選択が必要です。トークン管理も許可できますが、自分より強いトークンの発行・再発行はできません。ユーザーの変更には管理者プリセットの全権限・全対象が必要です。ログイン・SSO・自分のパスワード変更はブラウザ専用です。[権限の一覧と対象制限](https://github.com/aida0710/mado-s3-datacatalog/blob/main/docs/internal-api-permissions.md)を参照してください。

続きのある一覧（監査ログ、ディレクトリ一覧）は`limit`と`cursor`で読みます。応答の`nextCursor`を次の要求の`cursor`へそのまま渡し、`nextCursor`が`null`なら最後のページです。`cursor`の中身は決まった形ではないので、組み立てたり解釈したりしないでください。読めない値は400 `invalid_cursor`になります。

## Prometheusで容量メトリクスを取得する

メトリクスはUIと同じintranet用の入口にあります。

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $MDC_METRICS_KEY" \
  "$MDC_URL/api/mado/metrics/capacity"
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

`mado.example.com` を実際のUI用hostnameへ置き換えます。返すメトリクスの一覧は[容量メトリクスの仕様](https://github.com/aida0710/mado-s3-datacatalog/blob/main/docs/capacity-metrics.md)を参照してください。

## トークンを編集・再発行・無効化する

一覧の各トークンの**…**から操作します。

- **編集**: 名前・用途のメモ・権限・接続・有効期限を変更します。値は変わりません。
- **再発行**: 以前の値を直ちに失効し、新しい値を一度だけ表示します。権限・有効期限・無効状態は引き継ぎます。連携先の値も更新してください。
- **無効にする / 有効にする**: 同じ値の利用を一時停止・再開します。
- **削除**: 利用を終了し、一覧から取り除きます。元には戻せません。監査用の操作履歴は残ります。

v0.4.0までに発行した`mado_lin_`で始まる値は、v0.5.0への更新で使えなくなります。名前・権限・有効期限はそのまま残るので、**再発行**して新しい値を連携先へ配り直してください。

内部APIはブラウザセッションまたはアクセストークンで認証します。Notes・READMEの編集者はアカウント署名またはトークン名から決まります。PUT本文の `editor` は400の検証エラーになります。
