// README (ディレクトリごと) と Team note の応答: 本文、保存の結果、編集履歴、README の全文検索。
import { z } from 'zod'

export const ReadmeAbsent = z.object({ exists: z.literal(false) })
export const ReadmePresent = z.object({
  exists: z.literal(true),
  body: z.string(),
  last_editor: z.string().nullable(),
  last_edited_at: z.string().nullable(),
  size_bytes: z.number(),
})
export const Readme = z.union([ReadmeAbsent, ReadmePresent])

export const PutReadmeOk = z.object({
  ok: z.literal(true),
  meta_stale: z.boolean().optional(),
  size_bytes: z.number(),
})

// 編集履歴の一覧 1 件。README と Team note で共通。body は重いので含めず、選択時だけ取りに行く。
export const HistoryListItem = z.object({
  id: z.number(),
  editor: z.string(),
  edited_at: z.string(),
  size_bytes: z.number(),
})
export type HistoryListItem = z.infer<typeof HistoryListItem>

// README 編集履歴 (一覧)
export const ReadmeHistoryList = z.object({
  versions: z.array(HistoryListItem),
})

// 1 件の履歴 (body 含む)
export const ReadmeHistoryVersion = z.object({
  id: z.number(),
  bucket: z.string(),
  prefix: z.string(),
  body: z.string(),
  editor: z.string(),
  edited_at: z.string(),
  size_bytes: z.number(),
})

// 接続内 README 全文検索
export const ReadmeSearchHit = z.object({
  bucket: z.string(),
  prefix: z.string(),
  editor: z.string(),
  edited_at: z.string(),
  size_bytes: z.number(),
})
export const ReadmeSearchResult = z.object({
  hits: z.array(ReadmeSearchHit),
})

// Team notes (postgres notes テーブル) の編集履歴 — slug 単位、S3 README 履歴と並列。
export const NoteHistoryList = z.object({
  versions: z.array(HistoryListItem),
})
export const NoteHistoryVersion = z.object({
  id: z.number(),
  slug: z.string(),
  body: z.string(),
  editor: z.string(),
  edited_at: z.string(),
  size_bytes: z.number(),
})

export const NoteAbsent  = z.object({ exists: z.literal(false) })
export const NotePresent = z.object({
  exists: z.literal(true),
  body: z.string(),
  last_editor: z.string().nullable(),
  last_edited_at: z.string(),
})
export const Note = z.union([NoteAbsent, NotePresent])

export const PutNoteOk = z.object({ ok: z.literal(true) })
