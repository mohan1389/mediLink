-- CreateTable
CREATE TABLE "FamilyLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FamilyLink_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FamilyLink_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShareRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "subjectPatientId" TEXT,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShareRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShareRequest_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShareRequest_subjectPatientId_fkey" FOREIGN KEY ("subjectPatientId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ShareRequest" ("createdAt", "doctorId", "id", "message", "patientId") SELECT "createdAt", "doctorId", "id", "message", "patientId" FROM "ShareRequest";
DROP TABLE "ShareRequest";
ALTER TABLE "new_ShareRequest" RENAME TO "ShareRequest";
CREATE INDEX "ShareRequest_doctorId_createdAt_idx" ON "ShareRequest"("doctorId", "createdAt");
CREATE INDEX "ShareRequest_patientId_createdAt_idx" ON "ShareRequest"("patientId", "createdAt");
CREATE INDEX "ShareRequest_subjectPatientId_createdAt_idx" ON "ShareRequest"("subjectPatientId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FamilyLink_memberId_status_idx" ON "FamilyLink"("memberId", "status");

-- CreateIndex
CREATE INDEX "FamilyLink_ownerId_status_idx" ON "FamilyLink"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyLink_ownerId_memberId_key" ON "FamilyLink"("ownerId", "memberId");
