import { z } from 'zod'
import * as accessTokens from '../shared/schemas/access-tokens.js'
import * as audit from '../shared/schemas/audit.js'
import * as auth from '../shared/schemas/auth.js'
import * as capacity from '../shared/schemas/capacity.js'
import * as connections from '../shared/schemas/connections.js'
import * as estimate from '../shared/schemas/estimate.js'
import * as integration from '../shared/schemas/integration.js'
import * as jobs from '../shared/schemas/jobs.js'
import * as lineage from '../shared/schemas/lineage.js'
import * as markdownDocuments from '../shared/schemas/markdown-documents.js'
import * as settings from '../shared/schemas/settings.js'
import * as storage from '../shared/schemas/storage.js'
import * as system from '../shared/schemas/system.js'
import * as tags from '../shared/schemas/tags.js'
import * as users from '../shared/schemas/users.js'

export type JsonSchema = Record<string, unknown>

const COMPONENT_REF_PREFIX = '#/components/schemas/'
const LOCAL_DEF_REF_PREFIX = '#/$defs/'
// zod は名前の無い定義を変換ごとに __schema0, __schema1… と名付けるので、同じ名前でも変換ごとに中身が違う。
const UNNAMED_DEFINITION = /^__schema\d+$/
const UNNAMED_COMPONENT_PREFIX = 'Inline'
// uuid などは format だけで分かるので、zod が添える長い正規表現は落とす。
const SELF_DESCRIBING_FORMATS = new Set(['uuid', 'date-time', 'email'])

const SHARED_SCHEMA_MODULES = [
  system, auth, users, audit, accessTokens, connections, storage, capacity, markdownDocuments, tags, settings, jobs,
  estimate, lineage, integration,
]

// api/shared/schemas の応答のスキーマを、export の名前で文書の components にする。
// .describe() の説明と同じく zod の globalRegistry に id を書く。文書を作るプロセス (生成のスクリプトとテスト) だけが読み込む。
for (const module of SHARED_SCHEMA_MODULES) {
  for (const [name, value] of Object.entries(module)) {
    // 別名の export (StartScanOk = StartJobOk) は先に付けた名前のままにする。
    if (!(value instanceof z.ZodType) || z.globalRegistry.get(value)?.id) continue
    z.globalRegistry.add(value, { ...z.globalRegistry.get(value), id: name })
  }
}

/**
 * zod のスキーマを OpenAPI 3.1 (JSON Schema 2020-12) に変え、共有の定義を components.schemas に集める。
 * api/shared/schemas の export は、その名前の component への $ref になる。
 * 名前の無い定義 (入れ子の繰り返しなど) は中身で同じものをまとめる。mado ML Tracking の同名の仕組みと同じ。
 */
export class JsonSchemaComponents {
  private readonly schemas = new Map<string, JsonSchema>()
  private readonly namesByContent = new Map<string, string>()
  private unnamedCount = 0

  convert(schema: z.ZodType, io: 'input' | 'output'): JsonSchema {
    const converted = z.toJSONSchema(schema, {
      target: 'draft-2020-12',
      io,
      // クエリの数を文字列から読む変換などは JSON Schema で書けないので、入力の形を残す。
      unrepresentable: 'any',
    }) as JsonSchema
    const { $defs: definitions = {}, ...root } = withoutFormatPatterns(converted) as JsonSchema
    // 文書の中の 1 つのスキーマなので、方言の宣言 ($schema) は持たせない。
    delete root.$schema
    const renames = this.addDefinitions(definitions as Record<string, JsonSchema>)
    return rewriteRefs(root, renames) as JsonSchema
  }

  /** 名前の順に並べ、ルートの並びに文書が左右されないようにする。 */
  components(): Record<string, JsonSchema> {
    return Object.fromEntries([...this.schemas].sort(([left], [right]) => left.localeCompare(right)))
  }

  private addDefinitions(definitions: Record<string, JsonSchema>): Map<string, string> {
    const renames = new Map<string, string>()
    for (const name of Object.keys(definitions)) if (!UNNAMED_DEFINITION.test(name)) renames.set(name, name)
    for (const [name, definition] of Object.entries(definitions)) {
      if (!UNNAMED_DEFINITION.test(name)) continue
      const content = contentKey(definition, name, renames)
      let component = this.namesByContent.get(content)
      if (!component) {
        component = `${UNNAMED_COMPONENT_PREFIX}${++this.unnamedCount}`
        this.namesByContent.set(content, component)
      }
      renames.set(name, component)
    }
    for (const [name, definition] of Object.entries(definitions)) {
      const component = renames.get(name)!
      const rewritten = rewriteRefs(definition, renames) as JsonSchema
      const existing = this.schemas.get(component)
      if (existing && JSON.stringify(existing) !== JSON.stringify(rewritten)) {
        throw new Error(`OpenAPI component ${component} has two different definitions`)
      }
      this.schemas.set(component, rewritten)
      const content = contentKey(definition, name, renames)
      if (!this.namesByContent.has(content)) this.namesByContent.set(content, component)
    }
    return renames
  }
}

function withoutFormatPatterns(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutFormatPatterns)
  if (!value || typeof value !== 'object') return value
  const node = value as JsonSchema
  const dropPattern = typeof node.format === 'string' && SELF_DESCRIBING_FORMATS.has(node.format)
  return Object.fromEntries(Object.entries(node)
    .filter(([key]) => !(dropPattern && key === 'pattern'))
    .map(([key, item]) => [key, withoutFormatPatterns(item)]))
}

// 自分への参照は '' にして、名前が違っても同じ形なら同じ鍵になるようにする。
function contentKey(definition: JsonSchema, name: string, renames: Map<string, string>): string {
  return JSON.stringify(rewriteRefs(definition, new Map([...renames, [name, '']]), false))
}

function rewriteRefs(value: unknown, renames: Map<string, string>, strict = true): unknown {
  if (Array.isArray(value)) return value.map(item => rewriteRefs(item, renames, strict))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (key === '$ref' && typeof item === 'string' && item.startsWith(LOCAL_DEF_REF_PREFIX)) {
      const target = renames.get(item.slice(LOCAL_DEF_REF_PREFIX.length))
      if (target !== undefined) return [key, `${COMPONENT_REF_PREFIX}${target}`]
      if (strict) throw new Error(`Unresolved JSON Schema reference ${item}`)
      return [key, item]
    }
    return [key, rewriteRefs(item, renames, strict)]
  }))
}
