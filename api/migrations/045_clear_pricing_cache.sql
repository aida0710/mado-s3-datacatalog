-- 単価カタログの「手で持っている値」の注記を、日本語の文から code (awsMinimumRetention など) に替えた。
-- 文で持っている取得済みのカタログを消す。取り直すまでは同梱のカタログで見積もり、
-- 次に見積もりを開いたときに古い単価として裏で取り直す (pricing_refresh_days の扱いと同じ)。
DELETE FROM pricing_cache;
