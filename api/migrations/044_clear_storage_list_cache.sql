-- ディレクトリ一覧の応答の続きの項目を nextContinuation・nextStartAfter から nextCursor に替えた。
-- 応答キャッシュに残る古い形の一覧は続きを読めないので消す (次に開いたときに S3 から取り直す)。
-- バケット一覧の行 (bucket = '') は形が変わらないので残す。
DELETE FROM storage_response_cache WHERE bucket <> '';
