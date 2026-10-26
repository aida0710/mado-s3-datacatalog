import type { z } from 'zod'
import { internalApiPermission } from '../lib/internal-api-permission-policy.js'
import { ApiErrorBody } from '../shared/schemas/system.js'
import { isNonJsonContent, routeError, type ApiRoute, type NonJsonContent, type RouteError } from './api-route.js'
import { JsonSchemaComponents, type JsonSchema } from './json-schema-components.js'
import { API_ROUTES } from './route-catalog.js'

export const OPENAPI_VERSION = '3.1.0'

const DESCRIPTION = [
  'mado S3 Data Catalog の API。api-internal (画面と連携用) と api-lineage (Pipeline の OpenLineage の受け付け) のルートを載せる。',
  'この文書は api/openapi/route-catalog.ts から作る (cd api && npm run openapi:generate)。ルートの一覧とのずれは api/openapi/openapi.test.ts が見つける。',
  'エラーは ApiErrorBody {error, code}。error は英語の文、code は理由の名前で、各 operation の x-mado-error-codes に挙げる。',
  '続きのある一覧は cursor / nextCursor で読む。cursor の中身は決まった形ではないので、応答の nextCursor をそのまま渡す。',
  '/api/internal は session cookie か、機能別の権限を持つアクセストークン (mado_dc_…) で呼ぶ。必要な権限は x-mado-permission に書く。',
].join('\n\n')

const TAGS: { name: string; description: string }[] = [
  { name: 'system', description: '稼働確認' },
  { name: 'auth', description: 'ログイン・SSO・自分のアカウント' },
  { name: 'connections', description: '接続 (S3 互換ストレージ) の登録と設定' },
  { name: 'storage', description: 'バケットとディレクトリの一覧、お気に入り' },
  { name: 'preview', description: 'ファイルとアーカイブの中身の表示・ダウンロード' },
  { name: 'media', description: '音声の解析 (波形・スペクトログラム)' },
  { name: 'readme', description: 'ディレクトリごとの README' },
  { name: 'notes', description: 'Team note' },
  { name: 'tags', description: 'タグの定義と割り当て' },
  { name: 'jobs', description: 'ジョブ (走査) の投入と進み具合' },
  { name: 'capacity', description: '容量メトリクス' },
  { name: 'estimate', description: '移送の見積もりと単価カタログ' },
  { name: 'settings', description: 'アプリ全体の設定' },
  { name: 'lineage', description: 'DataLineage (Registry と Marquez)' },
  { name: 'users', description: 'ユーザー管理' },
  { name: 'access-tokens', description: 'アクセストークンの管理' },
  { name: 'audit', description: '監査ログ' },
  { name: 'integration', description: '連携用の読み取り API (/api/mado/)。intranet 用の入口だけに置く' },
  { name: 'openlineage', description: 'Pipeline の OpenLineage イベントの受け付け (公開用の入口)' },
]

const SECURITY_SCHEMES = {
  sessionCookie: {
    type: 'apiKey',
    in: 'cookie',
    name: 'mado_session',
    description: 'ブラウザのログイン (HttpOnly)。MDC_AUTH_COOKIE_SECURE=true のときの名前は __Host-mado_session。GET 以外は Origin を確かめる (許可しない Origin は 403 invalid_origin)。',
  },
  bearerToken: {
    type: 'http',
    scheme: 'bearer',
    description: 'アクセストークン (mado_dc_<16桁>.<秘密>)。/api/internal は x-mado-permission の権限、連携用の API は operation の security に並ぶ scope を確かめる。',
  },
}

// ルートが使うパスの変数の説明。カタログの `:name` はどれもここに無ければならない。
const PATH_PARAMETERS: Record<string, { description: string; schema: JsonSchema }> = {
  connectionId: { description: '接続の ID', schema: { type: 'string' } },
  id: { description: '対象の ID', schema: { type: 'string' } },
  bucket: { description: 'バケット', schema: { type: 'string' } },
  key: { description: '設定の名前', schema: { type: 'string' } },
  slug: { description: 'Team note の名前', schema: { type: 'string' } },
  datasetId: { description: 'データセットの ID', schema: { type: 'string', format: 'uuid' } },
}

const SUCCESS_DESCRIPTIONS: Record<number, string> = {
  200: 'OK',
  201: '作成した',
  // アーカイブの索引を作っている途中。本文は archive_index_pending のエラーの形で、Retry-After 秒後にやり直す。
  202: '受け付けた (まだ用意できていない)',
  204: '本文なし',
  206: 'Range の部分',
  302: 'リダイレクト',
  303: 'リダイレクト',
}

// エラー応答の説明は状態だけ。理由は x-mado-error-codes に挙げる。
const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: '要求を読めない',
  401: '認証されていない',
  403: '権限がない、または接続で許可していない操作',
  404: '見つからない (見せない接続のものを含む)',
  409: '今の状態と衝突する',
  412: '読んでいる途中でオブジェクトが変わった',
  413: '大きすぎる',
  416: 'Range を読めない',
  422: '内容が受け付けられない',
  429: '試行回数の上限 (Retry-After 秒後にやり直す)',
  500: '想定外の失敗',
  502: '連携先 (S3・Registry・Marquez) から使える応答を得られない',
  503: '一時的に処理できない',
}

export interface OpenApiDocument {
  openapi: string
  info: { title: string; version: string; description: string }
  servers: { url: string }[]
  tags: { name: string; description: string }[]
  paths: Record<string, Record<string, unknown>>
  components: { schemas: Record<string, JsonSchema>; securitySchemes: typeof SECURITY_SCHEMES }
}

/** ルートの一覧から OpenAPI 3.1 の文書を作る。version はリリースの版 (リポジトリの VERSION)。 */
export function buildOpenApiDocument({ version, routes = API_ROUTES }: { version: string; routes?: readonly ApiRoute[] }): OpenApiDocument {
  const components = new JsonSchemaComponents()
  // エラー応答はどれも ApiErrorBody を参照する。
  components.convert(ApiErrorBody, 'output')
  const paths: Record<string, Record<string, unknown>> = {}
  for (const route of routes) {
    const path = openApiPath(route.path)
    paths[path] ??= {}
    if (paths[path][route.method]) throw new Error(`Duplicate route ${route.method} ${route.path}`)
    if (!TAGS.some(tag => tag.name === route.tag)) throw new Error(`Route ${route.method} ${route.path} has the undeclared tag ${route.tag}`)
    paths[path][route.method] = operation(route, components)
  }
  return {
    openapi: OPENAPI_VERSION,
    info: { title: 'mado S3 Data Catalog API', version, description: DESCRIPTION },
    servers: [{ url: '/' }],
    tags: TAGS,
    paths,
    components: { schemas: components.components(), securitySchemes: SECURITY_SCHEMES },
  }
}

/** `/api/internal/connections/:id` → `/api/internal/connections/{id}`。 */
export function openApiPath(honoPath: string): string {
  return honoPath.replace(/:([A-Za-z]+)/g, '{$1}')
}

/** 文書の本文。テストはコミットした docs/openapi.json とこれを比べる。 */
export function formatOpenApiDocument(document: OpenApiDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`
}

/** /api/internal のルートに必要なトークンの権限。権限表 (internal-api-permission-policy.ts) から引く。 */
export function internalRoutePermission(route: ApiRoute): string | null {
  if (route.access.kind !== 'internal') return null
  return internalApiPermission(route.method.toUpperCase(), route.path.replace(/:[A-Za-z]+/g, 'sample-id'))
}

function operation(route: ApiRoute, components: JsonSchemaComponents): Record<string, unknown> {
  const permission = internalRoutePermission(route)
  if (route.access.kind === 'internal' && !permission) throw new Error(`Route ${route.method} ${route.path} has no token permission`)
  return {
    operationId: operationId(route),
    tags: [route.tag],
    summary: route.summary,
    security: security(route),
    'x-mado-access': route.access.kind,
    ...(permission ? { 'x-mado-permission': permission } : {}),
    parameters: [...pathParameters(route), ...queryParameters(route.query, components)],
    ...(route.body ? { requestBody: requestBody(route.body, components) } : {}),
    responses: { ...successResponses(route, components), ...errorResponses(errorsOf(route)) },
  }
}

function operationId(route: ApiRoute): string {
  const words = route.path.split('/')
    .filter(segment => segment && segment !== 'api')
    .map(segment => segment.startsWith(':') ? `By${capitalize(segment.slice(1))}` : segment)
    .flatMap(segment => segment.split(/[^A-Za-z0-9]+/))
    .filter(Boolean)
    .map(capitalize)
  return `${route.method}${words.join('')}`
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function security(route: ApiRoute): Record<string, string[]>[] {
  const { access } = route
  if (access.kind === 'public') return []
  if (access.kind === 'session') return [{ sessionCookie: [] }]
  if (access.kind === 'internal') return [{ sessionCookie: [] }, { bearerToken: [] }]
  return [{ bearerToken: access.scope ? [access.scope] : [] }]
}

function pathParameters(route: ApiRoute): Record<string, unknown>[] {
  return [...route.path.matchAll(/:([A-Za-z]+)/g)].map(([, name]) => {
    const parameter = PATH_PARAMETERS[name!]
    if (!parameter) throw new Error(`Path parameter :${name} of ${route.path} has no description`)
    return { name, in: 'path', required: true, ...parameter }
  })
}

function queryParameters(schema: z.ZodType | undefined, components: JsonSchemaComponents): Record<string, unknown>[] {
  if (!schema) return []
  const converted = components.convert(schema, 'input')
  const properties = converted.properties as Record<string, JsonSchema> | undefined
  if (converted.type !== 'object' || !properties) throw new Error('The query schema must be an object of named values')
  const required = new Set((converted.required as string[] | undefined) ?? [])
  return Object.entries(properties).map(([name, property]) => {
    const { description, ...propertySchema } = property
    return {
      name,
      in: 'query',
      required: required.has(name),
      ...(typeof description === 'string' ? { description } : {}),
      schema: propertySchema,
    }
  })
}

function requestBody(body: z.ZodType | NonJsonContent, components: JsonSchemaComponents): Record<string, unknown> {
  if (isNonJsonContent(body)) return { required: true, description: body.description, content: rawContent(body) }
  return { required: true, content: { 'application/json': { schema: components.convert(body, 'input') } } }
}

function rawContent(content: NonJsonContent): Record<string, unknown> {
  return { [content.contentType]: { schema: { type: 'string', contentMediaType: content.contentType } } }
}

function successResponses(route: ApiRoute, components: JsonSchemaComponents): Record<string, unknown> {
  return Object.fromEntries(Object.entries(route.responses).map(([status, content]) => {
    const isRedirect = status === '302' || status === '303'
    const description = isNonJsonContent(content) ? content.description : SUCCESS_DESCRIPTIONS[Number(status)]!
    const response: Record<string, unknown> = { description }
    if (isRedirect) response.headers = { Location: { schema: { type: 'string' }, description: '移動先' } }
    else if (isNonJsonContent(content)) response.content = rawContent(content)
    else if (content) response.content = { 'application/json': { schema: components.convert(content, 'output') } }
    return [status, response]
  }))
}

/**
 * どのルートにもあるエラー。だれが呼べるか (access) と入力の有無、共通のミドルウェア
 * (internal-api-auth・internal-api-permission-policy・auth-middleware・originCheck・service-key-auth) から決める。
 */
function genericErrorsOf(route: ApiRoute): RouteError[] {
  const errors: RouteError[] = []
  const { access } = route
  if (route.query || route.body || route.path.includes(':')) errors.push(...routeError(400, 'invalid_request'))
  if (access.kind === 'session' || access.kind === 'internal') {
    errors.push(...routeError(401, 'authentication_required'))
    if (route.method !== 'get' && route.method !== 'head') errors.push(...routeError(403, 'invalid_origin'))
    // SSO の session は IdP の UserInfo で確かめ直す。IdP に届かなければ通さない。
    errors.push(...routeError(503, 'oidc_unavailable'))
  }
  if (access.kind === 'internal') {
    errors.push(...routeError(401, 'invalid_token'), ...routeError(403, 'forbidden', 'password_change_required'))
    errors.push(...routeError(503, 'authentication_unavailable'))
    // 接続を指すルートは、見せない接続を 404 にする。
    if (route.path.includes(':connectionId')) errors.push(...routeError(404, 'not_found'))
  }
  if (access.kind === 'integrationToken') {
    errors.push(...routeError(401, 'authentication_required', 'invalid_token'), ...routeError(503, 'authentication_unavailable'))
    if (access.scope) errors.push(...routeError(403, 'scope_required'))
  }
  errors.push(...routeError(500, 'internal_error'))
  return errors
}

/** ルートに特有のエラーを先に、どのルートにもあるものを後に、同じ状態と code を重ねずに並べる。 */
export function errorsOf(route: ApiRoute): RouteError[] {
  const seen = new Set<string>()
  return [...(route.errors ?? []), ...genericErrorsOf(route)].filter(error => {
    const key = `${error.status} ${error.code}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function errorResponses(errors: RouteError[]): Record<string, unknown> {
  const codesByStatus = new Map<number, string[]>()
  for (const { status, code } of errors) codesByStatus.set(status, [...(codesByStatus.get(status) ?? []), code])
  return Object.fromEntries([...codesByStatus]
    .sort(([left], [right]) => left - right)
    .map(([status, codes]) => {
      const description = ERROR_DESCRIPTIONS[status]
      if (!description) throw new Error(`HTTP ${status} has no error description`)
      return [String(status), {
        description,
        'x-mado-error-codes': codes,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorBody' } } },
      }]
    }))
}
