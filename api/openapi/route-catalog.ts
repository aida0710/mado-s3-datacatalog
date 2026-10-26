import { z } from 'zod'
import { routeError, type ApiRoute, type NonJsonContent } from './api-route.js'
import { OpenLineageEventSchema } from '../lib/openlineage-schema.js'
import { AccessTokenCreateBody, AccessTokenPatchBody, ExpectedRevision } from '../routes/access-tokens.js'
import { PasswordResetBody, UserCreateBody, UserPatchBody, UserRolesBody } from '../routes/admin-users.js'
import { AuditEventQuery } from '../routes/audit.js'
import { ChangePasswordBody, LocalLoginBody, ProfileBody } from '../routes/auth.js'
import { ConnectionCreateBody, ConnectionUpdateBody } from '../routes/connections.js'
import {
  DatasetRegistrationBody, DatasetUpdateBody, LineageRegistrationBody, LocationRegistrationBody,
} from '../routes/lineage-curation.js'
import { NotePutBody } from '../routes/notes.js'
import { IntegrationCatalogQuery } from '../routes/service-lineage.js'
import { CapacityPrefixHistoryQuery } from '../routes/storage-capacity.js'
import { ReadmePutBody } from '../routes/storage-readme.js'
import { TagAssignmentBody, TagCreateBody, TagUpdateBody } from '../routes/storage-tags.js'
import { AccessTokenList, AccessTokenNamespaces, ChangedAccessToken, IssuedAccessToken } from '../shared/schemas/access-tokens.js'
import { AuditEventPage } from '../shared/schemas/audit.js'
import { AuthConfig, AuthUserResponse, LogoutResult } from '../shared/schemas/auth.js'
import { CapacityOverview, CapacityPrefixHistory, CapacityScanResponse } from '../shared/schemas/capacity.js'
import { Connection, ConnectionAccessUsers, ConnectionList } from '../shared/schemas/connections.js'
import { PricingStatus, TransferEstimate } from '../shared/schemas/estimate.js'
import {
  IntegrationAccessToken, IntegrationCatalog, IntegrationDataset, IntegrationVersionDetail, OpenLineageIngestResult,
} from '../shared/schemas/integration.js'
import { Job, StartJobOk } from '../shared/schemas/jobs.js'
import {
  DatasetCatalogResponse, DatasetDetail, DatasetVersionDetail, LineageGraph, LineageProjectionStatus, LineageRunDetail,
  LineageSearchResponse, ManualLineageMutationResult, MarquezJobRuns, StorageLineageResolution,
} from '../shared/schemas/lineage.js'
import {
  Note, NoteHistoryList, NoteHistoryVersion, PutNoteOk, PutReadmeOk, Readme, ReadmeHistoryList, ReadmeHistoryVersion,
  ReadmeSearchResult,
} from '../shared/schemas/markdown-documents.js'
import { AppSettings } from '../shared/schemas/settings.js'
import { FavoriteBuckets, ListBuckets, MediaAnalyze, StorageList } from '../shared/schemas/storage.js'
import { ApiErrorBody, Health, OkResult } from '../shared/schemas/system.js'
import { Tag, TagAssignmentMap, TagList, TagSearchResult } from '../shared/schemas/tags.js'
import { PasswordResetResult, UserList, UserResponse } from '../shared/schemas/users.js'

// API の全ルート (api-internal と api-lineage)。media-worker の /analyze は Compose の中だけの入口なので載せない。
// 入力のスキーマは、ルートが検証に使うものがあればそれを使う。ルートが手で読むクエリは、ここで文書のために書く。

// ── 入力の部品 ──
// 1 つのオブジェクトを指す (?bucket=&key=)。
const ObjectQuery = z.object({
  bucket: z.string().min(1).describe('バケット'),
  key: z.string().min(1).describe('オブジェクトのキー'),
})
// ディレクトリを指す。prefix を省くとバケットの直下。
const DirectoryQuery = z.object({
  bucket: z.string().min(1).describe('バケット'),
  prefix: z.string().optional().describe('ディレクトリ (/ で終わる)。省くとバケットの直下'),
})
const HistoryLimit = z.coerce.number().int().min(1).max(200).optional().describe('件数 (1〜200、既定 50)')
const LineageLimit = z.coerce.number().int().min(1).max(100).optional()
const Cursor = z.string().min(1).optional().describe('前のページの応答の nextCursor。最初のページは省く')

// ── JSON でない本文 ──
function binary(contentType: string, description: string): NonJsonContent {
  return { contentType, description }
}
const OBJECT_BYTES = binary('application/octet-stream', 'オブジェクトの中身')
const TAR_ENTRY_ERRORS = [
  ...routeError(400, 'unsupported_archive', 'entry_not_file'),
  ...routeError(413, 'archive_index_too_large', 'preview_limit_exceeded'),
]
const STORAGE_READ_ERRORS = [
  ...routeError(403, 'capability_disabled', 'blocked_endpoint'),
  ...routeError(502, 'storage_request_failed', 'storage_unavailable'),
  ...routeError(503, 'request_queue_full'),
]
const OBJECT_READ_ERRORS = [
  ...STORAGE_READ_ERRORS,
  ...routeError(412, 'object_changed'),
  ...routeError(416, 'range_not_satisfiable'),
]
const LINEAGE_BACKEND_ERRORS = [...routeError(502, 'registry_unavailable', 'marquez_unavailable'), ...routeError(503, 'lineage_not_configured')]

export const API_ROUTES: readonly ApiRoute[] = [
  // ── system ──
  {
    method: 'get', path: '/healthz', tag: 'system', summary: '稼働確認 (DB に届くかまで確かめる)。api-internal・api-lineage・media-worker が持つ',
    access: { kind: 'public' }, responses: { 200: Health }, errors: routeError(503, 'database_unavailable'),
  },

  // ── auth ──
  {
    method: 'get', path: '/api/auth/config', tag: 'auth', summary: '使えるログインの方法',
    access: { kind: 'public' }, responses: { 200: AuthConfig },
  },
  {
    method: 'post', path: '/api/auth/local/login', tag: 'auth', summary: 'Local User でログインし、session cookie を受け取る',
    access: { kind: 'public' }, body: LocalLoginBody, responses: { 200: AuthUserResponse },
    errors: [...routeError(401, 'invalid_credentials'), ...routeError(404, 'local_login_disabled'), ...routeError(429, 'rate_limited', 'authentication_busy')],
  },
  {
    method: 'get', path: '/api/auth/oidc/start', tag: 'auth', summary: 'SSO のログインを始め、IdP へリダイレクトする',
    access: { kind: 'public' },
    query: z.object({ returnTo: z.string().optional().describe('ログイン後に戻る画面のパス') }),
    responses: { 302: binary('text/plain', 'IdP の認可画面へのリダイレクト') },
    errors: [...routeError(404, 'oidc_disabled'), ...routeError(429, 'rate_limited'), ...routeError(503, 'oidc_unavailable')],
  },
  {
    method: 'get', path: '/api/auth/oidc/callback', tag: 'auth', summary: 'IdP から戻ったときの受け口。session cookie を発行して画面へ戻す',
    access: { kind: 'public' },
    query: z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() }),
    responses: { 303: binary('text/plain', 'ログイン後の画面へのリダイレクト') },
    errors: [...routeError(401, 'oidc_authentication_failed'), ...routeError(404, 'oidc_disabled')],
  },
  {
    method: 'get', path: '/api/auth/oidc/frontchannel-logout', tag: 'auth', summary: 'IdP の Front-Channel Logout。その SSO の session を終える',
    access: { kind: 'public' },
    query: z.object({ iss: z.string(), sid: z.string() }),
    responses: { 204: null }, errors: [...routeError(400, 'invalid_logout_request'), ...routeError(404, 'oidc_disabled')],
  },
  {
    method: 'post', path: '/api/auth/oidc/backchannel-logout', tag: 'auth', summary: 'IdP の Back-Channel Logout。署名した logout_token で session を終える',
    access: { kind: 'public' },
    body: binary('application/x-www-form-urlencoded', 'logout_token=<IdP が署名した JWT>'),
    responses: { 204: null },
    errors: [...routeError(400, 'invalid_logout_token'), ...routeError(404, 'oidc_disabled'), ...routeError(413, 'body_too_large')],
  },
  {
    method: 'get', path: '/api/auth/me', tag: 'auth', summary: 'ログイン中のユーザー',
    access: { kind: 'session' }, responses: { 200: AuthUserResponse },
  },
  {
    method: 'put', path: '/api/auth/profile', tag: 'auth', summary: '自分の署名名・表示名・ユーザー名を変える',
    access: { kind: 'session' }, body: ProfileBody, responses: { 200: AuthUserResponse },
    errors: [...routeError(404, 'not_found'), ...routeError(409, 'already_exists')],
  },
  {
    method: 'post', path: '/api/auth/logout', tag: 'auth', summary: 'ログアウトする。SSO なら IdP のログアウトの URL も返す',
    access: { kind: 'session' }, responses: { 200: LogoutResult },
  },
  {
    method: 'post', path: '/api/auth/change-password', tag: 'auth', summary: '自分の Local User のパスワードを変える',
    access: { kind: 'session' }, body: ChangePasswordBody, responses: { 200: OkResult },
    errors: [...routeError(400, 'incorrect_password', 'local_credential_unavailable'), ...routeError(409, 'password_changed_concurrently')],
  },

  // ── connections ──
  {
    method: 'get', path: '/api/internal/connections', tag: 'connections', summary: '見える接続の一覧 (認証情報は伏せる)',
    access: { kind: 'internal' }, responses: { 200: ConnectionList },
  },
  {
    method: 'get', path: '/api/internal/connections/access-users', tag: 'connections', summary: '接続の許可リストに選べるユーザー',
    access: { kind: 'internal' }, responses: { 200: ConnectionAccessUsers },
  },
  {
    method: 'post', path: '/api/internal/connections', tag: 'connections', summary: '接続を登録する',
    access: { kind: 'internal' }, body: ConnectionCreateBody, responses: { 200: Connection },
    errors: [...routeError(400, 'unknown_allowlist_users', 'readme_read_required'), ...routeError(409, 'already_exists')],
  },
  {
    method: 'put', path: '/api/internal/connections/:id/default', tag: 'connections', summary: '既定の接続にする',
    access: { kind: 'internal' }, responses: { 200: OkResult }, errors: routeError(404, 'not_found'),
  },
  {
    method: 'put', path: '/api/internal/connections/:id', tag: 'connections', summary: '接続の設定を変える (送った項目だけ)',
    access: { kind: 'internal' }, body: ConnectionUpdateBody, responses: { 200: Connection },
    errors: [
      ...routeError(400, 'unknown_allowlist_users', 'readme_read_required', 'scheduled_capacity_requires_scan', 'scheduled_capacity_requires_metrics'),
      ...routeError(404, 'not_found'), ...routeError(409, 'already_exists'),
    ],
  },
  {
    method: 'delete', path: '/api/internal/connections/:id', tag: 'connections', summary: '接続を削除する',
    access: { kind: 'internal' }, responses: { 200: OkResult }, errors: routeError(404, 'not_found'),
  },

  // ── storage ──
  {
    method: 'get', path: '/api/internal/storage/:connectionId/buckets', tag: 'storage', summary: 'バケットの一覧 (サーバーのキャッシュあり)',
    access: { kind: 'internal' },
    query: z.object({ refresh: z.literal('1').optional().describe('1 ならキャッシュを使わず S3 から取り直す') }),
    responses: { 200: ListBuckets }, errors: STORAGE_READ_ERRORS,
  },
  {
    method: 'get', path: '/api/internal/storage/:connectionId/list', tag: 'storage', summary: 'ディレクトリの一覧 (100 件ずつ、cursor で続きを読む)',
    access: { kind: 'internal' },
    query: DirectoryQuery.extend({
      cursor: Cursor,
      recursive: z.literal('1').optional().describe('1 なら区切らずに配下を全部並べる'),
      refresh: z.literal('1').optional().describe('1 ならキャッシュを使わず S3 から取り直す'),
    }),
    responses: { 200: StorageList }, errors: [...STORAGE_READ_ERRORS, ...routeError(400, 'invalid_cursor')],
  },
  {
    method: 'get', path: '/api/internal/storage/:connectionId/favorites', tag: 'storage', summary: '接続で共有するお気に入りのバケット',
    access: { kind: 'internal' }, responses: { 200: FavoriteBuckets },
  },
  {
    method: 'put', path: '/api/internal/storage/:connectionId/favorites/:bucket', tag: 'storage', summary: 'バケットをお気に入りに足す',
    access: { kind: 'internal' }, responses: { 200: OkResult },
  },
  {
    method: 'delete', path: '/api/internal/storage/:connectionId/favorites/:bucket', tag: 'storage', summary: 'バケットをお気に入りから外す',
    access: { kind: 'internal' }, responses: { 200: OkResult },
  },

  // ── preview ──
  {
    method: 'get', path: '/api/internal/storage/:connectionId/preview/text', tag: 'preview', summary: 'テキストの先頭 (MDC_PREVIEW_TEXT_LIMIT バイトまで)',
    access: { kind: 'internal' }, query: ObjectQuery,
    responses: { 200: binary('text/plain; charset=utf-8', 'テキストの先頭') }, errors: OBJECT_READ_ERRORS,
  },
  {
    method: 'get', path: '/api/internal/storage/:connectionId/preview/raw', tag: 'preview', summary: 'オブジェクトをダウンロードする',
    access: { kind: 'internal' }, query: ObjectQuery, responses: { 200: OBJECT_BYTES }, errors: OBJECT_READ_ERRORS,
  },
  {
    method: 'get', path: '/api/internal/storage/:connectionId/preview/image', tag: 'preview', summary: '画像を表示する',
    access: { kind: 'internal' }, query: ObjectQuery,
    responses: { 200: binary('image/*', '画像 (拡張子から決めた形式)') }, errors: OBJECT_READ_ERRORS,
  },
  {
    method: 'get', path: '/api/internal/storage/:connectionId/preview/audio', tag: 'preview', summary: '音声を再生する (Range で途中から)',
    access: { kind: 'internal' }, query: ObjectQuery,
    responses: { 200: binary('audio/*', '音声'), 206: binary('audio/*', 'Range で求めた部分') }, errors: OBJECT_READ_ERRORS,
  },
  {
    method: 'get', path: '/api/internal/storage/:connectionId/preview/video', tag: 'preview', summary: '動画を再生する (Range で途中から)',
    access: { kind: 'internal' }, query: ObjectQuery,
    responses: { 200: binary('video/*', '動画'), 206: binary('video/*', 'Range で求めた部分') }, errors: OBJECT_READ_ERRORS,
  },
  {
    method: 'get', path: '/api/internal/storage/:connectionId/preview/tar', tag: 'preview', summary: 'tar・tar.gz・tar.xz の中身の一覧を NDJSON で流す',
    access: { kind: 'internal' },
    query: ObjectQuery.extend({
      limit: z.coerce.number().int().min(1).optional().describe('1 ページのエントリ数 (既定 MDC_PREVIEW_TAR_ENTRY_LIMIT)'),
      offset: z.coerce.number().int().min(0).optional().describe('読み飛ばすエントリ数。アーカイブを先頭から読み直すときの位置'),
    }),
    responses: {
      200: binary('application/x-ndjson; charset=utf-8',
        '1 行 1 つの JSON。{"mode"} → {"entry"} の並び → {"done":{truncated,hasMore,offset,limit}}。途中の失敗は {"error"}'),
    },
    errors: [...OBJECT_READ_ERRORS, ...routeError(400, 'unsupported_archive')],
  },
  {
    method: 'get', path: '/api/internal/storage/:connectionId/preview/tar-entry', tag: 'preview', summary: 'アーカイブの中の 1 ファイルを取り出す',
    access: { kind: 'internal' },
    query: ObjectQuery.extend({
      entry: z.string().min(1).describe('アーカイブの中のパス'),
      maxBytes: z.coerce.number().int().min(1).optional().describe('先頭だけを読むときのバイト数'),
    }),
    responses: {
      200: binary('application/octet-stream', 'エントリの中身'), 202: ApiErrorBody,
      206: binary('application/octet-stream', 'Range で求めた部分'),
    },
    errors: [...OBJECT_READ_ERRORS, ...TAR_ENTRY_ERRORS],
  },
  {
    method: 'head', path: '/api/internal/storage/:connectionId/preview/tar-entry', tag: 'preview', summary: 'アーカイブの中の 1 ファイルの大きさと形式',
    access: { kind: 'internal' },
    query: ObjectQuery.extend({ entry: z.string().min(1).describe('アーカイブの中のパス') }),
    responses: { 200: null, 202: ApiErrorBody }, errors: [...OBJECT_READ_ERRORS, ...TAR_ENTRY_ERRORS],
  },

  // ── media ──
  {
    method: 'get', path: '/api/internal/storage/:connectionId/media/analyze', tag: 'media', summary: '音声の波形と情報 (media-worker が解析し、結果はキャッシュする)',
    access: { kind: 'internal' },
    query: ObjectQuery.extend({ entryPath: z.string().optional().describe('アーカイブの中の音声を解析するときのパス') }),
    responses: { 200: MediaAnalyze },
    errors: [...OBJECT_READ_ERRORS, ...routeError(422, 'analysis_failed'), ...routeError(503, 'media_worker_unavailable')],
  },
  {
    method: 'get', path: '/api/internal/storage/:connectionId/media/spectrogram', tag: 'media', summary: '解析済みの音声のスペクトログラム',
    access: { kind: 'internal' },
    query: z.object({ cacheKey: z.string().min(1).describe('analyze の応答の cacheKey') }),
    responses: { 200: binary('image/png', 'スペクトログラムの画像') }, errors: routeError(404, 'not_found'),
  },

  // ── readme ──
  {
    method: 'get', path: '/api/internal/storage/:connectionId/readme', tag: 'readme', summary: 'ディレクトリの README.md',
    access: { kind: 'internal' }, query: DirectoryQuery, responses: { 200: Readme }, errors: STORAGE_READ_ERRORS,
  },
  {
    method: 'put', path: '/api/internal/storage/:connectionId/readme', tag: 'readme', summary: 'ディレクトリの README.md を保存する (編集者はログイン中の人かトークン)',
    access: { kind: 'internal' }, body: ReadmePutBody, responses: { 200: PutReadmeOk }, errors: STORAGE_READ_ERRORS,
  },
  {
    method: 'get', path: '/api/internal/storage/:connectionId/readme/history', tag: 'readme', summary: 'README の編集履歴 (本文は含めない)',
    access: { kind: 'internal' }, query: DirectoryQuery.extend({ limit: HistoryLimit }), responses: { 200: ReadmeHistoryList },
  },
  {
    method: 'get', path: '/api/internal/storage/:connectionId/readme/history/:id', tag: 'readme', summary: 'README の編集履歴の 1 件 (本文つき)',
    access: { kind: 'internal' }, responses: { 200: ReadmeHistoryVersion }, errors: routeError(404, 'not_found'),
  },
  {
    method: 'get', path: '/api/internal/storage/:connectionId/readmes/search', tag: 'readme', summary: '接続の中の README を全文で探す',
    access: { kind: 'internal' },
    query: z.object({ q: z.string().describe('探す語'), limit: HistoryLimit }), responses: { 200: ReadmeSearchResult },
  },

  // ── notes ──
  {
    method: 'get', path: '/api/internal/notes/:slug', tag: 'notes', summary: 'Team note',
    access: { kind: 'internal' }, responses: { 200: Note },
  },
  {
    method: 'put', path: '/api/internal/notes/:slug', tag: 'notes', summary: 'Team note を保存する (編集者はログイン中の人かトークン)',
    access: { kind: 'internal' }, body: NotePutBody, responses: { 200: PutNoteOk },
  },
  {
    method: 'get', path: '/api/internal/notes/:slug/history', tag: 'notes', summary: 'Team note の編集履歴 (本文は含めない)',
    access: { kind: 'internal' }, query: z.object({ limit: HistoryLimit }), responses: { 200: NoteHistoryList },
  },
  {
    method: 'get', path: '/api/internal/notes/:slug/history/:id', tag: 'notes', summary: 'Team note の編集履歴の 1 件 (本文つき)',
    access: { kind: 'internal' }, responses: { 200: NoteHistoryVersion }, errors: routeError(404, 'not_found'),
  },

  // ── tags ──
  {
    method: 'get', path: '/api/internal/tags', tag: 'tags', summary: 'タグの定義 (全接続で共有)',
    access: { kind: 'internal' }, responses: { 200: TagList },
  },
  {
    method: 'post', path: '/api/internal/tags', tag: 'tags', summary: 'タグを定義する',
    access: { kind: 'internal' }, body: TagCreateBody, responses: { 200: Tag }, errors: routeError(409, 'already_exists'),
  },
  {
    method: 'put', path: '/api/internal/tags/:id', tag: 'tags', summary: 'タグの名前・色を変える',
    access: { kind: 'internal' }, body: TagUpdateBody, responses: { 200: Tag },
    errors: [...routeError(404, 'not_found'), ...routeError(409, 'already_exists')],
  },
  {
    method: 'delete', path: '/api/internal/tags/:id', tag: 'tags', summary: 'タグを消す (割り当ても消える)',
    access: { kind: 'internal' }, responses: { 200: OkResult }, errors: routeError(404, 'not_found'),
  },
  {
    method: 'get', path: '/api/internal/storage/:connectionId/tags', tag: 'tags', summary: 'バケット・ディレクトリ・ファイルに割り当てたタグ (path ごと)',
    access: { kind: 'internal' },
    query: z.object({
      bucket: z.string().min(1),
      kind: z.enum(['bucket', 'prefix', 'file']),
      paths: z.array(z.string()).optional().describe('割り当てを読む path (繰り返して複数)'),
    }),
    responses: { 200: TagAssignmentMap },
  },
  {
    method: 'put', path: '/api/internal/storage/:connectionId/tags', tag: 'tags', summary: 'タグを割り当てる',
    access: { kind: 'internal' }, body: TagAssignmentBody, responses: { 200: OkResult }, errors: routeError(404, 'not_found'),
  },
  {
    method: 'delete', path: '/api/internal/storage/:connectionId/tags', tag: 'tags', summary: 'タグの割り当てを外す',
    access: { kind: 'internal' }, body: TagAssignmentBody, responses: { 200: OkResult },
  },
  {
    method: 'get', path: '/api/internal/storage/:connectionId/tags/search', tag: 'tags', summary: 'タグを割り当てた場所を接続の中で探す',
    access: { kind: 'internal' },
    query: z.object({ tagId: z.array(z.string()).optional().describe('探すタグ (繰り返して複数)') }),
    responses: { 200: TagSearchResult },
  },

  // ── jobs ──
  {
    method: 'get', path: '/api/internal/jobs/latest', tag: 'jobs', summary: '実行中か最後のジョブ (画面を開き直したときにつなぎ直すため)',
    access: { kind: 'internal' },
    query: z.object({ kind: z.string().min(1).describe('ジョブの種類 (storage.scan など)'), dedupKey: z.string().min(1) }),
    responses: { 200: Job }, errors: routeError(404, 'not_found'),
  },
  {
    method: 'get', path: '/api/internal/jobs/:id', tag: 'jobs', summary: 'ジョブの進み具合と結果',
    access: { kind: 'internal' }, responses: { 200: Job }, errors: routeError(404, 'not_found'),
  },
  {
    method: 'post', path: '/api/internal/jobs/:id/cancel', tag: 'jobs', summary: 'ジョブを止める',
    access: { kind: 'internal' }, responses: { 200: OkResult }, errors: routeError(404, 'not_found'),
  },
  {
    method: 'post', path: '/api/internal/storage/:connectionId/scan', tag: 'jobs', summary: 'ディレクトリの配下を走査するジョブを入れる',
    access: { kind: 'internal' }, query: DirectoryQuery, responses: { 200: StartJobOk }, errors: routeError(403, 'scan_disabled'),
  },

  // ── capacity ──
  {
    method: 'get', path: '/api/internal/storage/:connectionId/capacity', tag: 'capacity', summary: 'バケットごとの容量の推移と、直下のディレクトリの内訳',
    access: { kind: 'internal' },
    query: z.object({ days: z.enum(['7', '30', '90', '400']).optional().describe('期間の日数 (既定 90)') }),
    responses: { 200: CapacityOverview }, errors: STORAGE_READ_ERRORS,
  },
  {
    method: 'get', path: '/api/internal/storage/:connectionId/capacity/prefix', tag: 'capacity', summary: '直下の 1 ディレクトリの容量の推移',
    access: { kind: 'internal' }, query: CapacityPrefixHistoryQuery, responses: { 200: CapacityPrefixHistory },
  },
  {
    method: 'post', path: '/api/internal/storage/:connectionId/capacity/scan', tag: 'capacity', summary: '接続の全バケットの容量を計測するジョブを入れる',
    access: { kind: 'internal' }, responses: { 200: CapacityScanResponse },
    errors: [...routeError(403, 'scan_disabled', 'bucket_metrics_disabled'), ...routeError(409, 'capacity_scan_running'), ...STORAGE_READ_ERRORS],
  },

  // ── estimate ──
  {
    method: 'get', path: '/api/internal/storage/:connectionId/estimate', tag: 'estimate', summary: '走査済みのディレクトリを各接続へ移したときの費用と所要時間',
    access: { kind: 'internal' }, query: DirectoryQuery, responses: { 200: TransferEstimate },
    errors: [...routeError(404, 'not_found'), ...routeError(409, 'directory_not_scanned', 'scan_result_unreadable')],
  },
  {
    method: 'get', path: '/api/internal/pricing', tag: 'estimate', summary: '見積もりに使っている単価カタログの出所',
    access: { kind: 'internal' }, responses: { 200: PricingStatus },
  },
  {
    method: 'post', path: '/api/internal/pricing/refresh', tag: 'estimate', summary: 'AWS の料金 API から単価を取り直すジョブを入れる',
    access: { kind: 'internal' }, responses: { 200: StartJobOk },
  },

  // ── settings ──
  {
    method: 'get', path: '/api/internal/settings', tag: 'settings', summary: 'アプリ全体の設定',
    access: { kind: 'internal' }, responses: { 200: AppSettings },
  },
  {
    method: 'put', path: '/api/internal/settings/:key', tag: 'settings', summary: 'アプリ全体の設定を 1 つ変える',
    access: { kind: 'internal' }, body: z.object({ value: z.string() }), responses: { 200: OkResult },
    errors: routeError(400, 'unknown_setting'),
  },

  // ── lineage ──
  {
    method: 'get', path: '/api/internal/lineage/graph', tag: 'lineage', summary: 'DataLineage のグラフ (論理: データセットと処理、versions: 版の入出力)',
    access: { kind: 'internal' },
    query: z.object({
      mode: z.enum(['logical', 'versions']).optional().describe('既定 logical'),
      rootKind: z.enum(['dataset', 'job']).optional().describe('logical の起点の種類'),
      namespace: z.string().optional().describe('logical の起点の Namespace'),
      name: z.string().optional().describe('logical の起点の名前'),
      versionId: z.string().uuid().optional().describe('versions の起点の版'),
      direction: z.enum(['upstream', 'downstream', 'both']).optional().describe('versions の向き (既定 both)'),
      depth: z.coerce.number().int().min(1).max(10).optional().describe('たどる深さ (既定 3)'),
    }),
    responses: { 200: LineageGraph }, errors: [...LINEAGE_BACKEND_ERRORS, ...routeError(403, 'namespace_not_allowed')],
  },
  {
    method: 'get', path: '/api/internal/lineage/search', tag: 'lineage', summary: 'Registry と Marquez を合わせて探す',
    access: { kind: 'internal' },
    query: z.object({ q: z.string().optional(), namespace: z.string().optional(), limit: LineageLimit }),
    responses: { 200: LineageSearchResponse }, errors: [...LINEAGE_BACKEND_ERRORS, ...routeError(403, 'namespace_not_allowed')],
  },
  {
    method: 'get', path: '/api/internal/lineage/catalog', tag: 'lineage', summary: 'Registry の登録一覧 (cursor で続きを読む)',
    access: { kind: 'internal' },
    query: z.object({ q: z.string().optional(), namespace: z.string().optional(), limit: LineageLimit, cursor: Cursor }),
    responses: { 200: DatasetCatalogResponse },
    errors: [...LINEAGE_BACKEND_ERRORS, ...routeError(400, 'invalid_cursor'), ...routeError(403, 'namespace_not_allowed')],
  },
  {
    method: 'get', path: '/api/internal/lineage/resolve-location', tag: 'lineage', summary: 'S3 の場所から、そこに置いたデータセットの版を引く',
    access: { kind: 'internal' },
    query: z.object({
      connectionId: z.string().min(1), bucket: z.string().min(1), key: z.string().optional(), limit: LineageLimit,
    }),
    responses: { 200: StorageLineageResolution }, errors: LINEAGE_BACKEND_ERRORS,
  },
  {
    method: 'get', path: '/api/internal/lineage/projection-status', tag: 'lineage', summary: 'Registry から Marquez へのグラフの反映の状態',
    access: { kind: 'internal' }, responses: { 200: LineageProjectionStatus }, errors: LINEAGE_BACKEND_ERRORS,
  },
  {
    method: 'get', path: '/api/internal/lineage/datasets/:id', tag: 'lineage', summary: 'データセットの詳細と版',
    access: { kind: 'internal' }, responses: { 200: DatasetDetail },
    errors: [...LINEAGE_BACKEND_ERRORS, ...routeError(404, 'not_found')],
  },
  {
    method: 'get', path: '/api/internal/lineage/versions/:id', tag: 'lineage', summary: '版の詳細と保存場所',
    access: { kind: 'internal' }, responses: { 200: DatasetVersionDetail },
    errors: [...LINEAGE_BACKEND_ERRORS, ...routeError(404, 'not_found')],
  },
  {
    method: 'get', path: '/api/internal/lineage/runs/:id', tag: 'lineage', summary: '処理の実行 (run) の詳細',
    access: { kind: 'internal' }, responses: { 200: LineageRunDetail },
    errors: [...LINEAGE_BACKEND_ERRORS, ...routeError(404, 'not_found')],
  },
  {
    method: 'get', path: '/api/internal/lineage/job-runs', tag: 'lineage', summary: 'Marquez の job の実行の一覧',
    access: { kind: 'internal' },
    query: z.object({ namespace: z.string().min(1), name: z.string().min(1), limit: LineageLimit }),
    responses: { 200: MarquezJobRuns }, errors: LINEAGE_BACKEND_ERRORS,
  },
  {
    method: 'patch', path: '/api/internal/lineage/curation/datasets/:datasetId', tag: 'lineage', summary: 'データセットの表示名・別名・説明などを変える',
    access: { kind: 'internal' }, body: DatasetUpdateBody, responses: { 200: DatasetDetail },
    errors: [...routeError(400, 'invalid_dataset_id'), ...routeError(404, 'dataset_not_found'), ...routeError(502, 'registry_write_failed')],
  },
  {
    method: 'post', path: '/api/internal/lineage/curation/datasets', tag: 'lineage', summary: 'データセットと版を手で登録する',
    access: { kind: 'internal' }, body: DatasetRegistrationBody, responses: { 201: ManualLineageMutationResult },
    errors: [
      ...routeError(409, 'dataset_conflict'), ...routeError(422, 'invalid_reference', 'registry_not_linked'),
      ...routeError(502, 'registry_write_failed'),
    ],
  },
  {
    method: 'post', path: '/api/internal/lineage/curation/locations', tag: 'lineage', summary: '版の保存場所を手で登録する',
    access: { kind: 'internal' }, body: LocationRegistrationBody, responses: { 201: ManualLineageMutationResult },
    errors: [...routeError(409, 'dataset_conflict'), ...routeError(422, 'invalid_reference', 'registry_not_linked'), ...routeError(502, 'registry_write_failed')],
  },
  {
    method: 'post', path: '/api/internal/lineage/curation/runs', tag: 'lineage', summary: '版の入出力 (処理) を手で登録する',
    access: { kind: 'internal' }, body: LineageRegistrationBody, responses: { 201: ManualLineageMutationResult },
    errors: [...routeError(422, 'invalid_reference'), ...routeError(502, 'registry_write_failed')],
  },

  // ── users ──
  {
    method: 'get', path: '/api/internal/users', tag: 'users', summary: 'ユーザーの一覧',
    access: { kind: 'internal' }, responses: { 200: UserList },
  },
  {
    method: 'post', path: '/api/internal/users', tag: 'users', summary: 'Local User を作る',
    access: { kind: 'internal' }, body: UserCreateBody, responses: { 201: UserResponse },
    errors: [...routeError(400, 'unknown_role'), ...routeError(403, 'unrestricted_admin_required'), ...routeError(409, 'already_exists')],
  },
  {
    method: 'patch', path: '/api/internal/users/:id', tag: 'users', summary: 'ユーザーの名前・メール・状態を変える',
    access: { kind: 'internal' }, body: UserPatchBody, responses: { 200: UserResponse },
    errors: [
      ...routeError(403, 'unrestricted_admin_required'), ...routeError(404, 'not_found'),
      ...routeError(409, 'already_exists', 'last_active_admin'),
    ],
  },
  {
    method: 'put', path: '/api/internal/users/:id/roles', tag: 'users', summary: 'ユーザーの role を置き換える',
    access: { kind: 'internal' }, body: UserRolesBody, responses: { 200: UserResponse },
    errors: [
      ...routeError(400, 'unknown_role'), ...routeError(403, 'unrestricted_admin_required'), ...routeError(404, 'not_found'),
      ...routeError(409, 'last_active_admin'),
    ],
  },
  {
    method: 'post', path: '/api/internal/users/:id/reset-password', tag: 'users', summary: 'Local User のパスワードを再設定する',
    access: { kind: 'internal' }, body: PasswordResetBody, responses: { 200: PasswordResetResult },
    errors: [...routeError(403, 'unrestricted_admin_required'), ...routeError(404, 'not_found'), ...routeError(409, 'sso_password_managed')],
  },
  {
    method: 'delete', path: '/api/internal/users/:id', tag: 'users', summary: 'ユーザーを消す (記録のために行は残す)',
    access: { kind: 'internal' }, responses: { 200: OkResult },
    errors: [
      ...routeError(403, 'unrestricted_admin_required'), ...routeError(404, 'not_found'),
      ...routeError(409, 'cannot_delete_self', 'last_active_admin'),
    ],
  },

  // ── access-tokens ──
  {
    method: 'get', path: '/api/internal/access-tokens', tag: 'access-tokens', summary: 'アクセストークンの一覧 (値は含めない)',
    access: { kind: 'internal' }, responses: { 200: AccessTokenList },
  },
  {
    method: 'get', path: '/api/internal/access-tokens/namespaces', tag: 'access-tokens', summary: 'トークンに許可できる Namespace の候補',
    access: { kind: 'internal' }, responses: { 200: AccessTokenNamespaces },
  },
  {
    method: 'post', path: '/api/internal/access-tokens', tag: 'access-tokens', summary: 'アクセストークンを作る。値 (mado_dc_…) はこの応答にだけ含める',
    access: { kind: 'internal' }, body: AccessTokenCreateBody, responses: { 201: IssuedAccessToken },
    errors: [
      ...routeError(400, 'invalid_token_permissions', 'unknown_connection'), ...routeError(401, 'token_actor_inactive'),
      ...routeError(403, 'token_authority_exceeded'),
    ],
  },
  {
    method: 'patch', path: '/api/internal/access-tokens/:id', tag: 'access-tokens', summary: '名前・権限・Namespace・期限・状態を変える (値は変わらない)',
    access: { kind: 'internal' }, body: AccessTokenPatchBody, responses: { 200: ChangedAccessToken },
    errors: [
      ...routeError(400, 'invalid_token_permissions', 'unknown_connection'), ...routeError(401, 'token_actor_inactive'),
      ...routeError(403, 'token_authority_exceeded'), ...routeError(404, 'not_found'), ...routeError(409, 'token_conflict'),
    ],
  },
  {
    method: 'post', path: '/api/internal/access-tokens/:id/regenerate', tag: 'access-tokens', summary: '値を出し直す。前の値はすぐ使えなくなる',
    access: { kind: 'internal' }, body: ExpectedRevision, responses: { 200: IssuedAccessToken },
    errors: [
      ...routeError(401, 'token_actor_inactive'), ...routeError(403, 'token_authority_exceeded'), ...routeError(404, 'not_found'),
      ...routeError(409, 'token_conflict'),
    ],
  },
  {
    method: 'delete', path: '/api/internal/access-tokens/:id', tag: 'access-tokens', summary: 'アクセストークンを失効させ、一覧から外す',
    access: { kind: 'internal' },
    query: z.object({ expectedRevision: z.coerce.number().int().positive().describe('一覧の revision') }),
    responses: { 200: ChangedAccessToken },
    errors: [
      ...routeError(401, 'token_actor_inactive'), ...routeError(403, 'token_authority_exceeded'), ...routeError(404, 'not_found'),
      ...routeError(409, 'token_conflict'),
    ],
  },

  // ── audit ──
  {
    method: 'get', path: '/api/internal/audit-events', tag: 'audit', summary: '成功した変更の監査ログ (新しい順、cursor で続きを読む)',
    access: { kind: 'internal' }, query: AuditEventQuery, responses: { 200: AuditEventPage }, errors: routeError(400, 'invalid_cursor'),
  },

  // ── integration (/api/mado/) ──
  {
    method: 'get', path: '/api/mado/access-token', tag: 'integration', summary: '呼び出したトークン自身の名前・scope・Namespace・期限',
    access: { kind: 'integrationToken' }, responses: { 200: IntegrationAccessToken },
  },
  {
    method: 'get', path: '/api/mado/metrics/capacity', tag: 'integration', summary: '容量メトリクス (Prometheus のテキスト形式)',
    access: { kind: 'integrationToken', scope: 'metrics:read' },
    responses: { 200: binary('text/plain; version=0.0.4; charset=utf-8', 'Prometheus のテキスト形式') },
    errors: routeError(503, 'metrics_unavailable'),
  },
  {
    method: 'get', path: '/api/mado/lineage/catalog', tag: 'integration', summary: '許可した Namespace のデータセットを探す',
    access: { kind: 'integrationToken', scope: 'lineage:read' }, query: IntegrationCatalogQuery, responses: { 200: IntegrationCatalog },
    errors: [...routeError(403, 'namespace_not_allowed'), ...routeError(502, 'registry_unavailable'), ...routeError(503, 'registry_unavailable')],
  },
  {
    method: 'get', path: '/api/mado/lineage/datasets/:id', tag: 'integration', summary: 'データセットと版 (保存場所の URI まで)',
    access: { kind: 'integrationToken', scope: 'lineage:read' }, responses: { 200: IntegrationDataset },
    errors: [...routeError(404, 'not_found'), ...routeError(502, 'registry_unavailable'), ...routeError(503, 'registry_unavailable')],
  },
  {
    method: 'get', path: '/api/mado/lineage/versions/:id', tag: 'integration', summary: '版と、そのデータセットの Namespace・名前',
    access: { kind: 'integrationToken', scope: 'lineage:read' }, responses: { 200: IntegrationVersionDetail },
    errors: [...routeError(404, 'not_found'), ...routeError(502, 'registry_unavailable'), ...routeError(503, 'registry_unavailable')],
  },

  // ── openlineage (api-lineage) ──
  {
    method: 'post', path: '/api/openlineage/v1/lineage', tag: 'openlineage', summary: 'Pipeline から OpenLineage のイベントを受け取り、Registry へ渡す',
    access: { kind: 'integrationToken', scope: 'lineage:write' }, body: OpenLineageEventSchema, responses: { 200: OpenLineageIngestResult },
    errors: [
      ...routeError(400, 'invalid_json'), ...routeError(403, 'namespace_not_writable'),
      ...routeError(409, 'registry_conflict'), ...routeError(413, 'body_too_large'), ...routeError(422, 'invalid_openlineage_event', 'registry_rejected'),
      ...routeError(503, 'registry_unavailable'),
    ],
  },
]
