// API のエラー応答の本文はすべて `{ error, code }`。`error` はログや curl で人が読む英語の文、
// `code` はプログラムと画面が分岐に使う、変わらない理由の名前。文に入る値は横の項目に置く
// (`capability`、`permission` など)。画面は `code` で訳す (front/i18n/apiErrorMessage.ts) ので、
// 一度出した code の意味は変えない。文は直してよいが、新しい理由には新しい code を足す。
export const API_ERROR_CODES = [
  // 要求の形
  'invalid_request',
  'invalid_json',
  'body_too_large',
  'unknown_setting',
  'unsupported_archive',
  // 認証と認可
  'authentication_required',
  'invalid_token',
  'invalid_credentials',
  'authentication_unavailable',
  'authentication_busy',
  'rate_limited',
  'password_change_required',
  'incorrect_password',
  'local_credential_unavailable',
  'password_changed_concurrently',
  'local_login_disabled',
  'oidc_disabled',
  'oidc_authentication_failed',
  'oidc_unavailable',
  'invalid_logout_request',
  'invalid_logout_token',
  'invalid_origin',
  'forbidden',
  'scope_required',
  'token_endpoint_forbidden',
  'all_connections_token_required',
  'unrestricted_admin_required',
  'token_authority_exceeded',
  'token_actor_inactive',
  'token_conflict',
  'invalid_token_permissions',
  // ユーザー
  'unknown_role',
  'last_active_admin',
  'cannot_delete_self',
  'sso_password_managed',
  // 対象の有無と設定の整合
  'not_found',
  'already_exists',
  'unknown_connection',
  'unknown_allowlist_users',
  'readme_read_required',
  'scheduled_capacity_requires_scan',
  'scheduled_capacity_requires_metrics',
  // 接続で許可した操作とストレージ
  'capability_disabled',
  'scan_disabled',
  'bucket_metrics_disabled',
  'capacity_scan_running',
  'directory_not_scanned',
  'scan_result_unreadable',
  'blocked_endpoint',
  'storage_unavailable',
  'storage_request_failed',
  'object_changed',
  'range_not_satisfiable',
  'request_queue_full',
  'archive_index_pending',
  'archive_index_too_large',
  'archive_preview_failed',
  'entry_not_file',
  'preview_limit_exceeded',
  // 音声の解析
  'media_worker_unavailable',
  'analysis_failed',
  // Lineage
  'lineage_not_configured',
  'namespace_not_allowed',
  'namespace_not_writable',
  'invalid_openlineage_event',
  'invalid_dataset_id',
  'dataset_not_found',
  'dataset_conflict',
  'invalid_reference',
  'registry_not_linked',
  'registry_write_failed',
  'registry_conflict',
  'registry_rejected',
  'registry_unavailable',
  'marquez_unavailable',
  // Prometheus のメトリクス
  'metrics_unavailable',
  // 想定外の失敗。原因はサーバーのログにだけ書く。
  'internal_error',
] as const

export type ApiErrorCode = typeof API_ERROR_CODES[number]

export interface ApiErrorBody {
  error: string
  code: ApiErrorCode
}
