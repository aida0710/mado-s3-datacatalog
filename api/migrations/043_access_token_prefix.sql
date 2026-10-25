-- アクセストークンの前置きを mado_lin_ から mado_dc_ に替える (mado ML Tracking の mado_mt_ とそろえる)。
-- 発行済みの値は使えなくする。秘密の照合値をだれも知らない乱数に置き換え、画面の「再発行」で新しい値を出してもらう。
-- 名前・権限・期限・無効の状態は残す。行も消さない (監査ログと Registry の主体 ID が参照する)。
ALTER TABLE service_account_keys DROP CONSTRAINT service_account_keys_token_prefix_check;

UPDATE service_account_keys
   SET token_prefix = 'mado_dc_' || substr(token_prefix, length('mado_lin_') + 1),
       secret_hash = sha256(convert_to(gen_random_uuid()::text, 'UTF8')),
       revision = revision + 1
 WHERE token_prefix LIKE 'mado\_lin\_%';

ALTER TABLE service_account_keys ADD CONSTRAINT service_account_keys_token_prefix_check
  CHECK (token_prefix ~ '^mado_dc_[A-Za-z0-9_-]{8,32}$');
