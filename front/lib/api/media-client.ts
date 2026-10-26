import { MediaAnalyze } from './types'
import { buildUrl, requestApi, storagePath } from './http'

// 音声解析 (波形ピーク + スペクトログラム有無)。サーバー側でキャッシュされる
// ため TTLCache には入れない。長尺ファイルはレスポンスまで数十秒かかりうる —
// 呼び出し側は AbortSignal でアンマウント時に中断すること。
export const mediaClient = {
  mediaAnalyze: ({ connectionId, bucket, key, entryPath, signal }: {
    connectionId: string; bucket: string; key: string; entryPath?: string; signal?: AbortSignal
  }) => requestApi(
    buildUrl(storagePath(connectionId, '/media/analyze'), { bucket, key, entryPath }),
    MediaAnalyze,
    { signal },
  ),

  spectrogramUrl: (connectionId: string, cacheKey: string): string =>
    buildUrl(storagePath(connectionId, '/media/spectrogram'), { cacheKey }),
}
