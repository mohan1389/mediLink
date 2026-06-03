-- AlterTable
ALTER TABLE "PatientProfile" ADD COLUMN "email" TEXT;
ALTER TABLE "PatientProfile" ADD COLUMN "phone" TEXT;

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contactUserId" TEXT,
    "email" TEXT,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmergencyContact_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmergencyContact_contactUserId_fkey" FOREIGN KEY ("contactUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FamilyLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "emergencyNotify" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FamilyLink_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FamilyLink_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FamilyLink" ("createdAt", "id", "memberId", "ownerId", "status", "updatedAt") SELECT "createdAt", "id", "memberId", "ownerId", "status", "updatedAt" FROM "FamilyLink";
DROP TABLE "FamilyLink";
ALTER TABLE "new_FamilyLink" RENAME TO "FamilyLink";
CREATE INDEX "FamilyLink_memberId_status_idx" ON "FamilyLink"("memberId", "status");
CREATE INDEX "FamilyLink_ownerId_status_idx" ON "FamilyLink"("ownerId", "status");
CREATE UNIQUE INDEX "FamilyLink_ownerId_memberId_key" ON "FamilyLink"("ownerId", "memberId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EmergencyContact_patientId_idx" ON "EmergencyContact"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyContact_patientId_contactUserId_key" ON "EmergencyContact"("patientId", "contactUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyContact_patientId_email_key" ON "EmergencyContact"("patientId", "email");
