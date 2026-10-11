# madoのGitHub Pages

公開先: https://aida0710.github.io/mado-s3-datacatalog/

VitePressで日本語と英語の利用ガイド・管理設定・リファレンスを生成する。日本語は`pages/`直下、英語は`pages/en/`に同じファイル名で置き、片方を変えたらもう片方も同じ構成に直す。サイドバーの並びは`.vitepress/config.ts`の`sidebarSections`で両方の言語をまとめて決める。トップページの文言は`homeContent.ts`の`homeContent(lang)`で言語ごとに返す。本文で太字にする画面の名前は、その言語の画面の表記（`front/i18n/ja.ts`・`en.ts`）どおりに書く。Home・Storage・DataLineage・Settingsなどの区分の名前は、日本語の画面でも英語のまま（辞書の`section.*`）なので、日本語の本文でも英語で書く。画像は日本語のページが`public/screenshots/`、英語のページが`public/screenshots/en/`の、それぞれの言語の画面を撮ったものを使う。色・書体はアプリと同じ`@mado/design-system`の変数を使い、上部バーとサイドバーはアプリと同じ暗い枠にする（`.vitepress/theme/style.css`）。本文はMarkdown、トップページは`.vitepress/theme/Home.vue`、紹介する機能と入口は`.vitepress/theme/homeContent.ts`に置く。タブのアイコン`public/mado-icon.svg`はアプリの`front/public/mado-icon.svg`と同じファイルで、変えるときは両方を替える。

## 起動・ビルド

Node.js 22を使い、リポジトリのルートで実行する。

```bash
npm ci --prefix pages
npm run dev --prefix pages
npm run build --prefix pages
npm run preview --prefix pages
```

プレビューのURLは `http://127.0.0.1:4173/mado-s3-datacatalog/`。再ビルド後はpreviewを再起動して、新しいassetsを読み込ませる。`pages/.vitepress/dist/`が静的サイトの出力。`main`の`pages/**`または公開workflowの変更で、GitHub Actionsが公開する。Pull Requestではビルドだけ実行する。

## スクリーンショットを撮り直す

ffmpegとPlaywright Chromiumが必要。ffmpegはmacOSで`brew install ffmpeg`、Ubuntuで`sudo apt-get install ffmpeg`から用意できる。

```bash
npm ci --prefix front
npm ci --prefix pages
cd pages
npx playwright install chromium
cd ..
npm run dev --prefix front -- --host 127.0.0.1 --port 15378 --strictPort
```

別のターミナルから、日本語と英語の画面をそれぞれ撮る。

```bash
npm run screenshots --prefix pages
MADO_SCREENSHOT_LANGUAGE=en npm run screenshots --prefix pages
```

撮影は現行の`front/`を使用し、APIの応答を`scripts/screenshot-fixtures.mjs`の架空データへ置き換える。実際のAPI・DB・S3へは接続しない。READMEやTeam noteなどの見本の文は、同じファイルの`SAMPLE_TEXT`で言語ごとに持つ。撮影中に押すボタンの名前は`scripts/capture-screenshots.mjs`の`LABELS`にあり、画面の文言を変えたらここも合わせる。撮影用の音声・動画はローカルで生成し、`artifacts/docs/<JST日付>/`へ置く。公開するPNGは日本語が`pages/public/screenshots/`、英語が`pages/public/screenshots/en/`、撮影の記録はartifactsの`screenshot-manifest-<言語>.json`へ保存する。

別のURLで起動した場合は`MADO_SCREENSHOT_URL`を指定する。画面ごとの撮影は`scripts/capture-screenshots.mjs`で定義している。一部だけ撮り直す場合は、`MADO_SCREENSHOT_FILTER=capacity,audio-deck`のように画像名をカンマで区切る。

## 画像と文章の確認

画像は現行のUIを使ったサンプル画面であり、実運用のデータや性能の証拠ではない。価格・所要時間の画面も撮影用の値を使う。新しい画像を公開するときは、認証情報や実環境の接続先が入っていないことを確認する。

リンクと画像の検査、デスクトップとモバイルの表示、検索、画像拡大を公開前に確認する。VitePressのビルドはページへのリンク切れがあると失敗する。見出しへのリンクは別途確認する。手動で参照する見出しには`{#video-playback}`のようなASCIIのIDを付け、日本語の濁点の正規化による不一致を避ける。

公開方法は[VitePressの公式手順](https://vitepress.dev/guide/deploy#github-pages)と[GitHub Pagesのカスタムworkflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)に従う。
