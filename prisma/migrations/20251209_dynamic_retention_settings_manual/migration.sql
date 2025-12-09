-- Manual migration to move from fixed RetentionTaxType enum to dynamic retention settings.
-- Run with: npx prisma db execute --file prisma/migrations/20251209_dynamic_retention_settings_manual/migration.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'RetentionSetting'
      AND column_name = 'name'
  ) THEN
    ALTER TABLE "RetentionSetting" ADD COLUMN "name" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'RetentionSetting'
      AND column_name = 'code'
  ) THEN
    ALTER TABLE "RetentionSetting" ADD COLUMN "code" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'RetentionSetting'
      AND column_name = 'description'
  ) THEN
    ALTER TABLE "RetentionSetting" ADD COLUMN "description" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'RetentionSetting'
      AND column_name = 'appliesTo'
  ) THEN
    ALTER TABLE "RetentionSetting" ADD COLUMN "appliesTo" "InvoiceFlow";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'RetentionSetting'
      AND column_name = 'defaultRate'
  ) THEN
    ALTER TABLE "RetentionSetting" ADD COLUMN "defaultRate" DECIMAL(65,30) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Retention'
      AND column_name = 'retentionSettingId'
  ) THEN
    ALTER TABLE "Retention" ADD COLUMN "retentionSettingId" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Retention'
      AND column_name = 'typeName'
  ) THEN
    ALTER TABLE "Retention" ADD COLUMN "typeName" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Retention'
      AND column_name = 'typeCode'
  ) THEN
    ALTER TABLE "Retention" ADD COLUMN "typeCode" TEXT;
  END IF;
END $$;

DO $$
DECLARE
  has_tax_column BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'retentionsetting'
      AND column_name = 'taxType'
  ) INTO has_tax_column;

  IF has_tax_column THEN
    EXECUTE 'UPDATE "RetentionSetting"
      SET name = COALESCE(name, CASE taxType WHEN ''VAT'' THEN ''IVA'' WHEN ''INCOME_TAX'' THEN ''Ganancias'' WHEN ''GROSS_INCOME'' THEN ''Ingresos Brutos'' ELSE taxType::text END),
          code = COALESCE(code, taxType::text)
      WHERE taxType IS NOT NULL';
  END IF;
END $$;

UPDATE "RetentionSetting"
SET name = COALESCE(name, code, 'Retención')
WHERE name IS NULL;

DO $$
DECLARE
  has_tax_column BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'retention'
      AND column_name = 'taxType'
  ) INTO has_tax_column;

  IF has_tax_column THEN
    EXECUTE 'UPDATE "Retention" r
      SET
          "retentionSettingId" = COALESCE(r."retentionSettingId", rs.id),
          "typeName" = COALESCE(r."typeName", rs.name, CASE r."taxType" WHEN ''VAT'' THEN ''IVA'' WHEN ''INCOME_TAX'' THEN ''Ganancias'' WHEN ''GROSS_INCOME'' THEN ''Ingresos Brutos'' ELSE r."taxType"::text END),
          "typeCode" = COALESCE(r."typeCode", r."taxType"::text)
      FROM "RetentionSetting" rs
      WHERE rs."organizationId" = r."organizationId" AND rs."taxType" = r."taxType"';
  END IF;
END $$;

UPDATE "Retention"
SET
    "typeName" = COALESCE("typeName", 'Retención'),
    "typeCode" = COALESCE("typeCode", 'CUSTOM')
WHERE "typeName" IS NULL OR "typeCode" IS NULL;

-- Enforce required columns now that data is populated
ALTER TABLE "RetentionSetting" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "RetentionSetting" ALTER COLUMN "defaultRate" SET DEFAULT 0;
ALTER TABLE "Retention" ALTER COLUMN "typeName" SET NOT NULL;
ALTER TABLE "Retention" ALTER COLUMN "retentionSettingId" SET NOT NULL;

-- Drop legacy constraints / columns tied to RetentionTaxType
DROP INDEX IF EXISTS "RetentionSetting_organizationId_taxType_key";

ALTER TABLE "Retention" DROP CONSTRAINT IF EXISTS "Retention_retentionSettingId_fkey";
ALTER TABLE "Retention" DROP CONSTRAINT IF EXISTS "Retention_taxType_check";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Retention'
      AND column_name IN ('taxType', 'taxtype')
  ) THEN
    ALTER TABLE "Retention" DROP COLUMN "taxType";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'RetentionSetting'
      AND column_name IN ('taxType', 'taxtype')
  ) THEN
    ALTER TABLE "RetentionSetting" DROP COLUMN "taxType";
  END IF;
END $$;

DROP INDEX IF EXISTS "RetentionSetting_org_name_key";
CREATE UNIQUE INDEX "RetentionSetting_org_name_key"
  ON "RetentionSetting" ("organizationId", "name");

DROP INDEX IF EXISTS "RetentionSetting_org_code_key";
CREATE UNIQUE INDEX "RetentionSetting_org_code_key"
  ON "RetentionSetting" ("organizationId", "code")
  WHERE code IS NOT NULL;

ALTER TABLE "Retention" DROP CONSTRAINT IF EXISTS "Retention_retentionSettingId_fkey_new";
ALTER TABLE "Retention" ADD CONSTRAINT "Retention_retentionSettingId_fkey_new"
  FOREIGN KEY ("retentionSettingId") REFERENCES "RetentionSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Retention_retentionSettingId_idx";
CREATE INDEX "Retention_retentionSettingId_idx" ON "Retention"("retentionSettingId");

DROP TYPE IF EXISTS "RetentionTaxType";

DROP INDEX IF EXISTS "RetentionSetting_org_code_idx";
CREATE INDEX "RetentionSetting_org_code_idx" ON "RetentionSetting"("organizationId", "code");
