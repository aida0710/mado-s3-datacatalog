// Storage の応答: バケットとディレクトリの一覧、お気に入り、音声の解析。
import { z } from 'zod'

export const Bucket = z.object({
  name: z.string(),
  creationDate: z.string().nullable(),
})
// サーバーキャッシュを受け取ってもS3取得時刻と有効期限を更新しない。
const StorageResponseCache = z.object({
  fetchedAt: z.string(),
  expiresAt: z.string(),
  hit: z.boolean(),
})
export const ListBuckets = z.object({
  buckets: z.array(Bucket),
  cache: StorageResponseCache,
})
export type ListBuckets = z.infer<typeof ListBuckets>

export const StorageFile = z.object({
  key: z.string(),
  size: z.number(),
  lastModified: z.string().nullable(),
})
export type StorageFileEntry = z.infer<typeof StorageFile>
// nextCursor: 次のページを指す中身の見えない文字列。続きが無ければ null。
// 同じ位置からは同じ文字列が返るので、前のページと同じなら S3 が続きを進めていない。
export const StorageList = z.object({
  directories: z.array(z.string()),
  files: z.array(StorageFile),
  nextCursor: z.string().nullable(),
  // ブラウザがAPI応答を受け取った時刻ではなく、一覧を実際にS3から取得した時刻。
  // 二層cacheでも古いserver cacheを「たった今」と誤表示しないために保持する。
  cache: StorageResponseCache,
})

export const FavoriteBuckets = z.array(z.string())

// 音声解析 (波形 / スペクトログラム)。GET /storage/:connectionId/media/analyze
// meta: ffprobe/ffmpeg の解析情報。取得できない個別項目は null。
export const MediaAnalyze = z.object({
  cacheKey: z.string(),
  peaks: z.array(z.tuple([z.number(), z.number()])),
  durationSec: z.number().nullable(),
  sampleRate: z.number().nullable(),
  hasSpectrogram: z.boolean(),
  meta: z.object({
    codec: z.string().nullable(),
    container: z.string().nullable(),
    channels: z.number().nullable(),
    bitsPerSample: z.number().nullable(),
    bitRate: z.number().nullable(),
    sizeBytes: z.number().nullable(),
    peakDb: z.number().nullable(),
    rmsDb: z.number().nullable(),
  }),
})
