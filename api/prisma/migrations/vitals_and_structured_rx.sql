-- ============================================================
-- MediLink incremental migration: vitals_and_structured_rx
-- Paste this entire script into the Supabase SQL Editor and click Run.
-- All statements use IF NOT EXISTS / IF EXISTS guards so it is safe
-- to run multiple times.
-- ============================================================

-- 1. Add BEDTIME to DoseSlot enum (no-op if already present)
ALTER TYPE "DoseSlot" ADD VALUE IF NOT EXISTS 'BEDTIME';

-- 2. Add new structured columns to PrescriptionItem (safe if columns exist)
ALTER TABLE "PrescriptionItem"
  ADD COLUMN IF NOT EXISTS "dosageAmount"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "dosageUnit"    TEXT,
  ADD COLUMN IF NOT EXISTS "durationDays"  INTEGER,
  ADD COLUMN IF NOT EXISTS "slots"         TEXT;

-- 3. Create VitalRecord table (no-op if already exists)
CREATE TABLE IF NOT EXISTS "VitalRecord" (
    "id"                  TEXT             NOT NULL,
    "patientId"           TEXT             NOT NULL,
    "recordedAt"          TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bpSystolic"          INTEGER,
    "bpDiastolic"         INTEGER,
    "bloodSugarFasting"   DOUBLE PRECISION,
    "bloodSugarPostMeal"  DOUBLE PRECISION,
    "heartRate"           INTEGER,
    "weight"              DOUBLE PRECISION,
    "temperature"         DOUBLE PRECISION,
    "oxygenSat"           INTEGER,
    "notes"               TEXT,
    "createdAt"           TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VitalRecord_pkey" PRIMARY KEY ("id")
);

-- 4. Index for efficient patient + date lookups
CREATE INDEX IF NOT EXISTS "VitalRecord_patientId_recordedAt_idx"
    ON "VitalRecord"("patientId", "recordedAt");

-- 5. Foreign key to User (wrapped in a DO block so it's idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'VitalRecord_patientId_fkey'
  ) THEN
    ALTER TABLE "VitalRecord"
      ADD CONSTRAINT "VitalRecord_patientId_fkey"
        FOREIGN KEY ("patientId")
        REFERENCES "User"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
  END IF;
END $$;
