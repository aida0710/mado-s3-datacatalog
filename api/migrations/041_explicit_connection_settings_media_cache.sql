-- Preserve the effective connection settings before requiring explicit boolean values.
INSERT INTO connection_settings (connection_id, key, value)
SELECT c.id, expected.key, CASE WHEN s.value = 'false' THEN 'false' ELSE 'true' END
  FROM storage_connections c
 CROSS JOIN unnest(ARRAY[
   'cap.list', 'cap.preview', 'cap.download', 'cap.archive',
   'cap.audioInfo', 'cap.audioSpectrogram', 'cap.readmeRead', 'cap.readmeWrite',
   'scan_enabled', 'capacity_metrics_enabled'
 ]::text[]) AS expected(key)
  LEFT JOIN connection_settings s ON s.connection_id = c.id AND s.key = expected.key
 WHERE s.value IS NULL OR s.value NOT IN ('true', 'false')
ON CONFLICT (connection_id, key) DO UPDATE
   SET value = EXCLUDED.value, updated_at = now();

ALTER TABLE connection_settings ADD CONSTRAINT connection_settings_boolean_values CHECK (
  key NOT IN (
    'cap.list', 'cap.preview', 'cap.download', 'cap.archive',
    'cap.audioInfo', 'cap.audioSpectrogram', 'cap.readmeRead', 'cap.readmeWrite',
    'scan_enabled', 'capacity_metrics_enabled'
  ) OR value IN ('true', 'false')
);

-- Cache entries without metadata or an owning connection must be recalculated from the object.
DELETE FROM media_cache WHERE meta IS NULL OR meta = 'null'::jsonb OR connection_id IS NULL;
ALTER TABLE media_cache ALTER COLUMN meta SET NOT NULL;
ALTER TABLE media_cache ALTER COLUMN connection_id SET NOT NULL;
ALTER TABLE media_cache ADD CONSTRAINT media_cache_meta_object CHECK (jsonb_typeof(meta) = 'object');
