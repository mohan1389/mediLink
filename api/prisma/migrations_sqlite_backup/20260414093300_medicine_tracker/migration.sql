-- CreateTable
CREATE TABLE "PatientMedicine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "prescriptionItemId" TEXT,
    "medicineName" TEXT NOT NULL,
    "dosageText" TEXT NOT NULL,
    "frequencyText" TEXT,
    "durationText" TEXT,
    "slotsJson" JSONB NOT NULL,
    "unitsPerDose" INTEGER NOT NULL DEFAULT 1,
    "inventoryCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastReconciledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatientMedicine_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatientMedicine_prescriptionItemId_fkey" FOREIGN KEY ("prescriptionItemId") REFERENCES "PrescriptionItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicineDoseLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "medicineId" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "consumedUnits" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MedicineDoseLog_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "PatientMedicine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PatientMedicine_patientId_active_idx" ON "PatientMedicine"("patientId", "active");

-- CreateIndex
CREATE INDEX "PatientMedicine_prescriptionItemId_idx" ON "PatientMedicine"("prescriptionItemId");

-- CreateIndex
CREATE INDEX "MedicineDoseLog_medicineId_scheduledAt_idx" ON "MedicineDoseLog"("medicineId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "MedicineDoseLog_medicineId_scheduledAt_key" ON "MedicineDoseLog"("medicineId", "scheduledAt");
