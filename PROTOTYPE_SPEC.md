# MediLink — Quick Prototype Spec (Phase 1)

Date: 2026-04-13

This document defines the **first working prototype** of MediLink.
It is intentionally scoped to ship fast, validate workflows, and keep later production hardening in mind.

---

## 1) Goal

Deliver a clickable + functional prototype with 3 portals:

- **Patient portal**: search doctor → select doctor → select files (optional) → share → view records library
- **Doctor portal**: see incoming requests → view basic patient info + attached files → add prescription
- **Hospital portal (UI only for now)**: input patient unique ID → view patient records

The prototype should demonstrate the end-to-end value: **paper records → digital share → doctor can access**.

---

## 2) Explicit Prototype Constraints

### What we WILL do now
- Use **Clerk** for sign up / login.
- Store uploaded medical files on **local disk** (a folder in this project).
- Provide a minimal database to track:
  - users / profiles
  - doctors directory
  - upload metadata
  - “share request” linking patient → doctor → selected files
  - prescriptions created by doctors
  - patient record organization (basic grouping/sorting + folders)

### What we will SKIP for the prototype
- No production-grade auth/authorization beyond Clerk UI gating.
- No RBAC/consent engine, no time-bound access, no advanced audit logs.
- No doctor license verification.
- No hospital biometric identification (only a patient-id input UI).
- No end-to-end encryption, KMS, HSM, etc. (to be added later).

> Note: even in prototype, we should avoid leaking data across users. We’ll keep access rules minimal but sensible.

---

## 3) Proposed Tech Stack (Prototype)

### Frontend
- **Next.js (TypeScript)**
- **Clerk** for auth UI and session
- 3 portal routes under one Next.js app:
  - `/patient/*`
  - `/doctor/*`
  - `/hospital/*`

### Backend
- **Node.js + Express (TypeScript)** API server
- File upload endpoints + metadata APIs

### Database (prototype-friendly)
- **SQLite + Prisma** for speed of setup (easy later switch to Postgres)

### Local file storage
- Files saved under:
  - `./storage/uploads/<patientId>/<uploadId>.<ext>`
- DB stores file metadata + path/key.

---

## 4) UX / Flows

### 4.1 Patient flow (core)
1. Patient logs in (Clerk)
2. Patient sets basic profile (name, age/DOB, gender)
3. Patient visits the doctor search page:
  - search bar at the top
  - below it, a list of **Past Doctors** (doctors patient has previously shared records with)
4. Patient searches doctors via typeahead:
  - as patient types a name, matching doctors appear live
  - list items show: doctor picture/avatar, name, specialty
5. Patient selects a doctor
5. Patient optionally selects files to share:
   - upload files (reports/prescriptions/scans)
   - choose from previously uploaded files
6. Patient adds a note for the doctor (optional) and clicks **Share**
7. System creates a **Share Request** visible in doctor portal

8. Patient can view a **Records Library** with:
  - grouping by category (Reports / Scans & Imaging / Prescriptions / Other)
  - grouping by doctor (based on share requests + prescriptions authored)
  - sorting by date (newest/oldest)
  - optional folders to organize uploads

**Acceptance criteria**
- Patient can search and select a doctor
- Patient can upload files successfully
- Patient can share selected file(s) to a doctor
- Patient can browse records with basic grouping/sorting
- Patient can create folders and place uploads into folders

### 4.2 Doctor flow
1. Doctor logs in (Clerk)
2. Doctor sees **Inbox** of share requests
3. Doctor opens a request and sees:
   - patient basic info: **name, age, gender**
   - list of shared files
  - patient note/message (if provided)
4. Doctor can download/view the files

5. Doctor can add a **new prescription** to the patient profile from the request:
  - uses a standard web form layout
  - medicines entered in a table-style list
  - saved to the patient’s system and appears in patient records

**Acceptance criteria**
- Doctor inbox shows requests addressed to that doctor
- Doctor request detail shows patient info + shared file list
- Files are downloadable via API
- Doctor can create a prescription for the patient from the request page
- Patient can see prescriptions in their records library

### 4.3 Hospital flow (UI-only, no biometrics)
1. Hospital staff logs in (Clerk)
2. Hospital page shows a single input: **Patient Unique ID**
3. On submit, hospital page shows the patient profile + record list

**Acceptance criteria**
- The UI exists and can fetch by patient ID
- No biometric logic implemented

---

## 5) Minimal Data Model

> Final schema will be implemented via Prisma. This section defines entities and relationships.

### Entities

**User**
- `id` (string; Clerk userId)
- `role` enum: `PATIENT | DOCTOR | HOSPITAL`

> Prototype note: any signed-in user can set their role for now.

**PatientProfile**
- `userId` (FK to User)
- `fullName`
- `dob` (or `age` for prototype; prefer DOB)
- `gender`
- `uniquePatientId` (human-shareable ID; generated; e.g. `ML-8CHAR`)

**DoctorProfile**
- `userId` (FK to User)
- `fullName`
- `specialty`
- `city` (optional)
- `licenseNumber` (public for prototype)
- `email` (public for prototype)
- `phone` (public for prototype)
- `gender` (public for prototype)
- `dob` (public for prototype)
- `avatarUrl` (optional; prefer Clerk imageUrl fallback)

**FileUpload**
- `id`
- `patientId` (FK -> User)
- `category` enum: `REPORT | SCAN_IMAGING | PRESCRIPTION | OTHER`
- `originalName`
- `mimeType`
- `sizeBytes`
- `storagePath` (local path/key)
- `createdAt`

**Folder**
- `id`
- `patientId` (FK -> User)
- `name`
- `createdAt`

**FolderItem** (join table)
- `folderId`
- `fileUploadId`

**ShareRequest**
- `id`
- `patientId` (FK -> User)
- `doctorId` (FK -> User)
- `message` (optional)
- `createdAt`

**ShareRequestFile** (join table)
- `shareRequestId`
- `fileUploadId`

**Prescription**
- `id`
- `patientId` (FK -> User)
- `doctorId` (FK -> User)
- `shareRequestId` (FK -> ShareRequest; nullable)
- `notes` (optional)
- `createdAt`

**PrescriptionItem**
- `id`
- `prescriptionId` (FK -> Prescription)
- `medicineName`
- `dosage` (text; e.g. "20mg" / "1 tablet")
- `frequency` (optional; e.g. "once daily")
- `duration` (optional; e.g. "7 days")

### Key rules (prototype)
- A doctor can only view share requests where `doctorId == currentUserId`.
- A patient can only view their own uploads.
- Hospital “lookup by patientId” is available (prototype), but we will add stronger controls later.
- A doctor can only create prescriptions for patients they can open via inbox request.

---

## 6) API Endpoints (Prototype Contract)

Base URL: `/api`

### Profiles
- `POST /profiles/patient` create/update patient profile
- `POST /profiles/doctor` create/update doctor profile
- `GET /profiles/me` get current user profile

### Doctors directory
- `GET /doctors/search?q=` list doctors by name/specialty
- `GET /doctors/:doctorId` doctor detail
- `GET /patients/me/recent-doctors` list doctors patient previously shared with

### Uploads
- `POST /uploads` multipart upload, returns `fileUploadId`
- `GET /uploads/mine` list patient’s uploads
- `GET /files/:fileUploadId/download` download the file (with minimal access checks)

### Record organization (patient)
- `POST /folders` body: `{ name }`
- `GET /folders` list folders
- `POST /folders/:folderId/items` body: `{ fileUploadId }`
- `DELETE /folders/:folderId/items/:fileUploadId`
- `GET /records` query: `groupBy=category|doctor|folder`, `sort=newest|oldest`

### Sharing
- `POST /share-requests` body: `{ doctorId, fileUploadIds[], message? }`
- `GET /doctor/inbox` list requests where `doctorId == me`
- `GET /doctor/inbox/:requestId` request detail (patient info + files)

### Prescriptions (doctor)
- `POST /doctor/inbox/:requestId/prescriptions` body: `{ notes?, items: [{ medicineName, dosage, frequency?, duration? }] }`
- `GET /patients/me/prescriptions` list prescriptions for logged-in patient

### Hospital (prototype)
- `GET /hospital/patients/:uniquePatientId` returns patient profile + uploads

---

## 7) Frontend Pages (Next.js)

### Common
- `/` landing with portal shortcuts
- Clerk sign-in / sign-up pages

### Patient
- `/patient/profile`
- `/patient/doctors` (typeahead search + past doctors list)
- `/patient/doctors/[doctorId]` (doctor detail + share form)
- `/patient/records` (records library: grouping/sorting + folders)

### Doctor
- `/doctor/profile`
- `/doctor/inbox`
- `/doctor/inbox/[requestId]`
  - includes prescription form with medicines table

### Hospital
- `/hospital/lookup` (unique patient id input + results)

---

## 8) Folder Structure (Target)

```txt
apps/
  web/                 # Next.js
  api/                 # Express
packages/
  shared/              # shared types + zod schemas
storage/
  uploads/             # local disk storage (gitignored)
```

---

## 9) Non-Goals (Strict)

- No consent expiry, no granular field scoping
- No biometric capture/matching
- No license verification
- No production audit trails
- No hosted object storage
- No PDF generation requirement (prescriptions are stored as structured data; printable UI can be added later)

---

## 10) Implementation Phases (Prototype)

### Milestone A — Project scaffold
- Create monorepo structure (apps/web, apps/api, packages/shared)
- Add Clerk to Next.js

### Milestone B — Data + APIs
- Prisma schema + SQLite DB
- Express endpoints for doctors search, uploads, share requests

### Milestone C — Patient portal flow
- Patient profile page
- Doctors search + share request form
- Uploads page

### Milestone D — Doctor portal flow
- Inbox list
- Request details + download files

### Milestone E — Hospital portal UI
- Lookup page by patient unique ID

---

## 11) Later (Post-Prototype Hardening)

When the prototype is validated, we will implement:
- RBAC + consent engine + expiry
- audit logs + anomaly alerts
- encryption at rest + signed URLs
- biometric integration (without storing raw biometrics)
- hosted storage (S3/Blob)
- multi-tenant hospitals + device attestation

---

## 12) Open Questions (to confirm before coding)

Decisions confirmed:
- Single Next.js app with `/patient`, `/doctor`, `/hospital` route groups.
- Any user can choose role=DOCTOR or role=HOSPITAL for now (verification later).
- `uniquePatientId` will be generated as `ML-` + 8 uppercase Crockford-base32 chars (collision-resistant, human-friendly).

Remaining small confirmation (optional): doctor search should match on (a) doctor name only, or (b) doctor name + specialty?
