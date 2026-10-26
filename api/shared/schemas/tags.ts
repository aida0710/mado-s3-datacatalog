// タグの応答: 全接続で共有する定義、バケット・ディレクトリ・ファイルへの割り当て、横断検索。
import { z } from 'zod'

// タグ (事前定義、全接続共通レジストリ)
export const Tag = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
})
export type Tag = z.infer<typeof Tag>
export const TagList = z.array(Tag)

// bucket 自体 / ディレクトリ (prefix) / ファイル (key) — タグ割り当ての対象種別
export const TargetKind = z.enum(['bucket', 'prefix', 'file'])
export type TargetKind = z.infer<typeof TargetKind>

// バッチ取得: path → 割り当て済み tagId[]
export const TagAssignmentMap = z.record(z.string(), z.array(z.string()))

// 接続内横断検索のヒット 1 件
export const TagSearchHit = z.object({
  tagId: z.string(),
  bucket: z.string(),
  kind: TargetKind,
  path: z.string(),
})
export const TagSearchResult = z.array(TagSearchHit)
export type TagSearchResult = z.infer<typeof TagSearchResult>
