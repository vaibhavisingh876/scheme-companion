-- The previous migration introduced SchemeEligibility as a generic cache.
-- This migration makes the Groq-owned boundary explicit and adds the missing
-- foreign key so AI rules can never outlive their scheme.

ALTER TABLE IF EXISTS "SchemeEligibility" RENAME TO "GroqEligibilityRules";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'GroqEligibilityRules' AND column_name = 'extractedRules'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'GroqEligibilityRules' AND column_name = 'eligibilityRules'
  ) THEN
    ALTER TABLE "GroqEligibilityRules" RENAME COLUMN "extractedRules" TO "eligibilityRules";
  END IF;
END $$;

ALTER TABLE "GroqEligibilityRules" ADD COLUMN IF NOT EXISTS "extractedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SchemeEligibility_pkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GroqEligibilityRules_pkey'
  ) THEN
    ALTER TABLE "GroqEligibilityRules"
      RENAME CONSTRAINT "SchemeEligibility_pkey" TO "GroqEligibilityRules_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'SchemeEligibility_schemeId_key')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'GroqEligibilityRules_schemeId_key') THEN
    ALTER INDEX "SchemeEligibility_schemeId_key" RENAME TO "GroqEligibilityRules_schemeId_key";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'SchemeEligibility_status_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'GroqEligibilityRules_status_idx') THEN
    ALTER INDEX "SchemeEligibility_status_idx" RENAME TO "GroqEligibilityRules_status_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'SchemeEligibility_sourceHash_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'GroqEligibilityRules_sourceHash_idx') THEN
    ALTER INDEX "SchemeEligibility_sourceHash_idx" RENAME TO "GroqEligibilityRules_sourceHash_idx";
  END IF;
END $$;

-- A foreign key cannot be added while orphans exist. Any orphan is stale by
-- definition because there is no scheme left to explain it.
DELETE FROM "GroqEligibilityRules" AS g
WHERE NOT EXISTS (SELECT 1 FROM "Scheme" AS s WHERE s."id" = g."schemeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GroqEligibilityRules_schemeId_fkey'
  ) THEN
    ALTER TABLE "GroqEligibilityRules"
      ADD CONSTRAINT "GroqEligibilityRules_schemeId_fkey"
      FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
