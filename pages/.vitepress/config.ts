import { createCssVariablesTheme } from 'shiki'
import { defineConfig } from 'vitepress'

const repository = 'https://github.com/aida0710/mado-s3-datacatalog'
const base = '/mado-s3-datacatalog/'
const siteUrl = 'https://aida0710.github.io/mado-s3-datacatalog/'

const jaDescription = '複数のS3互換ストレージを横断して、ファイルの中身・容量・DataLineageを確認するWebツール。'
const enDescription = 'A web tool for browsing several S3-compatible storages and checking file contents, capacity, and data lineage.'

type Language = 'ja' | 'en'

// サイドバーの並び。日本語と英語で同じ構成にし、見出しの文言とリンクの前置き (/en) だけを替える。
const sidebarSections: Array<{ text: Record<Language, string>; items: Array<{ text: Record<Language, string>; link: string }> }> = [
  { text: { ja: 'はじめる', en: 'Get started' }, items: [
    { text: { ja: 'madoの使い方', en: 'Using mado' }, link: '/guide/getting-started' },
    { text: { ja: 'バケットとファイルを探す', en: 'Browse buckets and files' }, link: '/guide/storage' },
  ] },
  { text: { ja: 'ファイルの中身を見る', en: 'View file contents' }, items: [
    { text: { ja: 'テキスト・画像・動画', en: 'Text, images, and video' }, link: '/guide/preview' },
    { text: { ja: 'tarの中身を開く', en: 'Open tar archives' }, link: '/guide/archives' },
    { text: { ja: '音声と同期プレイヤー', en: 'Audio and the synchronized player' }, link: '/guide/audio' },
  ] },
  { text: { ja: 'データを整理する', en: 'Organize data' }, items: [
    { text: { ja: 'READMEとTeam note', en: 'README and Team note' }, link: '/guide/notes' },
    { text: { ja: '容量と移送の見積もり', en: 'Capacity and transfer estimates' }, link: '/guide/capacity' },
    { text: { ja: 'Dataset Lineage', en: 'Dataset Lineage' }, link: '/guide/lineage' },
  ] },
  { text: { ja: '管理者向け', en: 'For administrators' }, items: [
    { text: { ja: '導入と起動', en: 'Install and start' }, link: '/setup/install' },
    { text: { ja: 'ストレージ接続の設定', en: 'Storage connections' }, link: '/setup/connections' },
    { text: { ja: '認証とアクセス権限', en: 'Authentication and access' }, link: '/setup/auth' },
  ] },
  { text: { ja: 'リファレンス', en: 'Reference' }, items: [
    { text: { ja: 'アクセストークンとAPI', en: 'Access tokens and API' }, link: '/reference/api' },
    { text: { ja: '困ったときは', en: 'Troubleshooting' }, link: '/reference/troubleshooting' },
    { text: { ja: '構成と開発', en: 'Architecture and development' }, link: '/reference/development' },
  ] },
]

const linkPrefix: Record<Language, string> = { ja: '', en: '/en' }

function sidebarFor(language: Language) {
  return sidebarSections.map(section => ({
    text: section.text[language],
    items: section.items.map(item => ({ text: item.text[language], link: `${linkPrefix[language]}${item.link}` })),
  }))
}

function navFor(language: Language) {
  const prefix = linkPrefix[language]
  return [
    { text: 'Guide', link: `${prefix}/guide/getting-started`, activeMatch: `^${prefix}/guide/` },
    { text: 'Setup', link: `${prefix}/setup/install`, activeMatch: `^${prefix}/setup/` },
    { text: 'Reference', link: `${prefix}/reference/troubleshooting`, activeMatch: `^${prefix}/reference/` },
  ]
}

export default defineConfig({
  title: 'mado S3 Data Catalog',
  titleTemplate: ':title · mado S3 Data Catalog',
  description: jaDescription,
  lang: 'ja',
  base,
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: siteUrl },
  head: [
    ['link', { rel: 'icon', href: `${base}mado-icon.svg`, type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#151515' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:image', content: `${siteUrl}screenshots/storage-directory.png` }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],
  locales: {
    root: {
      label: '日本語',
      lang: 'ja',
      head: [['meta', { property: 'og:locale', content: 'ja_JP' }]],
      themeConfig: {
        nav: navFor('ja'),
        sidebar: sidebarFor('ja'),
        editLink: { pattern: `${repository}/edit/main/pages/:path`, text: 'このページを編集' },
        outline: { level: [2, 3], label: 'このページの内容' },
        lastUpdated: { text: '最終更新', formatOptions: { dateStyle: 'medium' } },
        docFooter: { prev: '前のページ', next: '次のページ' },
        langMenuLabel: '言語を切り替える',
        darkModeSwitchLabel: 'テーマ',
        sidebarMenuLabel: '目次',
        returnToTopLabel: 'ページの先頭へ',
      },
    },
    en: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      description: enDescription,
      head: [
        ['meta', { property: 'og:locale', content: 'en_US' }],
        ['meta', { property: 'og:description', content: enDescription }],
      ],
      themeConfig: {
        nav: navFor('en'),
        sidebar: sidebarFor('en'),
        editLink: { pattern: `${repository}/edit/main/pages/:path`, text: 'Edit this page' },
        outline: { level: [2, 3], label: 'On this page' },
        lastUpdated: { text: 'Last updated', formatOptions: { dateStyle: 'medium' } },
        docFooter: { prev: 'Previous page', next: 'Next page' },
        langMenuLabel: 'Change language',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Return to top',
      },
    },
  },
  themeConfig: {
    // 名前はテーマの ProductLogo.vue で、印と太さを付けて組む。
    siteTitle: false,
    search: {
      provider: 'local',
      // 英語は VitePress の既定の文言のまま。日本語だけ訳を渡す。
      options: { locales: { root: { translations: {
        button: { buttonText: '検索', buttonAriaLabel: 'ドキュメントを検索' },
        modal: { displayDetails: '詳細を表示', resetButtonTitle: '検索をクリア', backButtonTitle: '閉じる', noResultsText: '見つかりませんでした', footer: { selectText: '選択', navigateText: '移動', closeText: '閉じる' } },
      } } } },
    },
    socialLinks: [{ icon: 'github', link: repository }],
    footer: {
      message: 'Apache License 2.0',
      copyright: 'mado S3 Data Catalog',
    },
  },
  appearance: false,
  srcExclude: ['README.md'],
  markdown: {
    // コードの色はアプリと同じデザインシステムの --code-* で塗る。色そのものはデザインシステムの docs.css で
    // --shiki-* の変数に割り当てる (暗い地に対して、どの色も 4.5:1 以上)。
    theme: createCssVariablesTheme({ name: 'mado-code', variablePrefix: '--shiki-', fontStyle: true }),
    config(md) {
      // 表は、はみ出すときだけ表の枠の中で横にスクロールさせる (スマホで本文全体が横にずれないように)。
      md.renderer.rules.table_open = (tokens, index, options, _env, self) =>
        `<div class="table-scroll">${self.renderToken(tokens, index, options)}`
      md.renderer.rules.table_close = (tokens, index, options, _env, self) =>
        `${self.renderToken(tokens, index, options)}</div>\n`
    },
  },
})
