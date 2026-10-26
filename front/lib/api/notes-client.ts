import type { z } from 'zod'
import { Note, NoteHistoryList, NoteHistoryVersion, PutNoteOk } from './types'
import { jsonRequestInit } from '@mado/design-system/http'
import { API_BASE, buildUrl, requestApi } from './http'

const notePath = (slug: string) => `${API_BASE}/notes/${encodeURIComponent(slug)}`

// Team note (postgres notes テーブル)。mado S3 Data Catalog 全体で 1 つの共有 Markdown。
export const notesClient = {
  note: (slug: string) => requestApi(notePath(slug), Note),

  putNote: (slug: string, body: string): Promise<z.infer<typeof PutNoteOk>> =>
    requestApi(notePath(slug), PutNoteOk, jsonRequestInit('PUT', { body })),

  // 編集履歴 (新しい順)。
  noteHistory: (slug: string, limit?: number) =>
    requestApi(buildUrl(`${notePath(slug)}/history`, {
      limit: limit != null ? String(limit) : undefined,
    }), NoteHistoryList),

  noteHistoryVersion: (slug: string, id: number) =>
    requestApi(`${notePath(slug)}/history/${id}`, NoteHistoryVersion),
}
