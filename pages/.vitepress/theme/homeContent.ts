// トップページ (Home.vue) の文言・目的別の入口・機能の紹介。日本語と英語で同じ構成にする。

export interface Feature {
  label: string
  title: string
  description: string
  /** 画像名 (拡張子なし)。HomeContent.screenshotDirectory の中のファイル。 */
  image: string
  alt: string
  link: string
  action: string
}

export interface Entry {
  label: string
  title: string
  description: string
  link: string
}

export interface HomeContent {
  /** その言語の画面を撮った画像の置き場所。日本語は public/screenshots/、英語は public/screenshots/en/。 */
  screenshotDirectory: string
  eyebrow: string
  title: string
  lead: string
  primaryAction: { text: string; link: string }
  secondaryAction: { text: string; link: string }
  hero: { alt: string; caption: string }
  entriesLabel: string
  entries: Entry[]
  featuresHeading: string
  features: Feature[]
}

const ja: HomeContent = {
  screenshotDirectory: '/screenshots',
  eyebrow: 'S3互換ストレージのデータカタログ',
  title: 'S3を見て、データを辿る。',
  lead: '複数のS3互換ストレージを、ひとつの画面から。ファイルの中身、音声、容量、データの来歴を確認するWebツールです。',
  primaryAction: { text: '使い方を見る', link: '/guide/getting-started' },
  secondaryAction: { text: '導入する', link: '/setup/install' },
  hero: {
    alt: 'Storageの画面。ディレクトリのREADMEとファイル一覧',
    caption: '接続を切り替え、バケットとディレクトリを辿る。画面は公開用サンプルデータです。',
  },
  entriesLabel: '目的から探す',
  entries: [
    { label: 'Get started', title: '初めて使う', description: 'ログインから、最初のプレビューまで', link: '/guide/getting-started' },
    { label: 'Connections', title: 'ストレージを登録する', description: 'エンドポイントと操作権限を設定', link: '/setup/connections' },
    { label: 'Reference', title: '困ったときは', description: '接続、プレビュー、権限を確認', link: '/reference/troubleshooting' },
  ],
  featuresHeading: '画面で見る、madoの使い方',
  features: [
    { label: 'Preview', title: 'ファイルの中身を見る', description: 'テキスト、画像、動画、音声をその場で確認。tarの中のファイルも個別に開けます。テキストは形式に合わせて色が付きます。', image: 'text-preview', alt: 'ファイル一覧とJSONのプレビュー', link: '/guide/preview', action: 'プレビューの使い方' },
    { label: 'Audio', title: '音声を聴き比べる', description: '波形とスペクトログラムで音声を確認。同期プレイヤーに複数の音声を並べ、同じ位置から再生できます。', image: 'audio-deck', alt: '波形と複数トラックを並べた同期プレイヤー', link: '/guide/audio', action: '音声と同期プレイヤー' },
    { label: 'Capacity', title: '容量の変化を追う', description: 'バケットの容量と件数を定期計測。ディレクトリ別の内訳や推移を見て、移送先の費用と時間を比べられます。', image: 'capacity', alt: 'バケットの容量推移とディレクトリ別の内訳', link: '/guide/capacity', action: '容量と移送の見積もり' },
    { label: 'Dataset lineage', title: 'データの来歴を辿る', description: 'どのデータから、どの処理を経て作られたか。Dataset、Job、Runをグラフで確認し、保存先へ行き来できます。', image: 'lineage', alt: '元データから処理後のデータへつながるDataset Lineageのグラフ', link: '/guide/lineage', action: 'Dataset Lineageを見る' },
    { label: 'Team note & README', title: 'データのそばに説明を残す', description: 'ディレクトリごとのREADMEと、チームで共有するTeam note。Markdownで書いて、編集履歴から変更を確認できます。', image: 'home', alt: 'Markdownで書かれたTeam note', link: '/guide/notes', action: 'READMEとTeam note' },
  ],
}

const en: HomeContent = {
  screenshotDirectory: '/screenshots/en',
  eyebrow: 'A data catalog for S3-compatible storage',
  title: 'See your S3 data and trace where it came from.',
  lead: 'Browse several S3-compatible storages from one screen. A web tool for checking file contents, audio, capacity, and data lineage.',
  primaryAction: { text: 'Read the guide', link: '/en/guide/getting-started' },
  secondaryAction: { text: 'Install', link: '/en/setup/install' },
  hero: {
    alt: 'The Storage screen with a directory README and the file list',
    caption: 'Switch connections and move through buckets and directories. The screenshots use public sample data.',
  },
  entriesLabel: 'Find by goal',
  entries: [
    { label: 'Get started', title: 'First steps', description: 'From signing in to your first preview', link: '/en/guide/getting-started' },
    { label: 'Connections', title: 'Add a storage', description: 'Set the endpoint and allowed operations', link: '/en/setup/connections' },
    { label: 'Reference', title: 'Troubleshooting', description: 'Check connections, previews, and permissions', link: '/en/reference/troubleshooting' },
  ],
  featuresHeading: 'mado at a glance',
  features: [
    { label: 'Preview', title: 'View file contents', description: 'Check text, images, video, and audio in place. Files inside a tar open one by one, and text is colored by its format.', image: 'text-preview', alt: 'The file list with a JSON preview', link: '/en/guide/preview', action: 'Using previews' },
    { label: 'Audio', title: 'Compare audio side by side', description: 'Inspect audio with its waveform and spectrogram. Put several tracks in the synchronized player and play them from the same position.', image: 'audio-deck', alt: 'The synchronized player with waveforms of several tracks', link: '/en/guide/audio', action: 'Audio and the synchronized player' },
    { label: 'Capacity', title: 'Track capacity over time', description: 'Size and object counts of each bucket are measured on a schedule. See the breakdown by directory and the trend, and compare the cost and time of moving data.', image: 'capacity', alt: 'Bucket capacity over time and the breakdown by directory', link: '/en/guide/capacity', action: 'Capacity and transfer estimates' },
    { label: 'Dataset lineage', title: 'Trace data lineage', description: 'Which data was it made from, and by which processing? See Datasets, Jobs, and Runs as a graph and jump to where they are stored.', image: 'lineage', alt: 'A Dataset Lineage graph from source data to processed data', link: '/en/guide/lineage', action: 'Dataset Lineage' },
    { label: 'Team note & README', title: 'Keep notes next to the data', description: 'A README for each directory and one Team note shared across the team. Write them in Markdown and review changes in the edit history.', image: 'home', alt: 'A Team note written in Markdown', link: '/en/guide/notes', action: 'README and Team note' },
  ],
}

/** VitePress の言語 (useData().lang) に合わせた文言。英語以外は日本語にする。 */
export function homeContent(lang: string): HomeContent {
  return lang.startsWith('en') ? en : ja
}
