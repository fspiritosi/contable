UPDATE "_prisma_migrations"
SET
  finished_at = NOW(),
  applied_steps_count = 1,
  checksum = checksum,
  logs = '',
  rolled_back_at = NULL
WHERE migration_name = '20251209_dynamic_retention_settings_manual';
