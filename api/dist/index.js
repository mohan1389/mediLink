import "dotenv/config";
import "express-async-errors";
import cors from "cors";
import express from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "./db.js";
import { asHttpError, HttpError } from "./httpErrors.js";
import { getUserId } from "./requestContext.js";
import { generateUniquePatientId } from "./patientId.js";
import { sendEmergencyLookupEmail } from "./mailer.js";
import { storePatientFile } from "./fileStorage.js";
import { cloudinarySignedDownloadUrl, cloudinarySignedViewUrl } from "./cloudinary.js";
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
const upload = multer({ storage: multer.memoryStorage() });
app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "medilink-api" });
});
function computeAgeFromDob(dob) {
    const today = new Date();
    let age = today.getUTCFullYear() - dob.getUTCFullYear();
    const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate())) {
        age -= 1;
    }
    return Math.max(0, age);
}
// -----------------
// Medicine tracker (prototype)
// -----------------
const doseSlotEnum = z.enum(["MORNING", "AFTERNOON", "EVENING", "NIGHT"]);
const SLOT_HOURS_UTC = {
    MORNING: 8,
    AFTERNOON: 13,
    EVENING: 19,
    NIGHT: 22,
};
function defaultSlotsFromFrequency(frequency) {
    const f = (frequency ?? "").toLowerCase();
    // Try common numeric patterns first.
    const numMatch = f.match(/\b([1-4])\b/);
    const n = numMatch ? Number(numMatch[1]) : null;
    if (n === 4)
        return ["MORNING", "AFTERNOON", "EVENING", "NIGHT"];
    if (n === 3)
        return ["MORNING", "AFTERNOON", "EVENING"];
    if (n === 2)
        return ["MORNING", "EVENING"];
    if (n === 1)
        return ["MORNING"];
    // Keyword-based fallback.
    const slots = [];
    if (f.includes("morning"))
        slots.push("MORNING");
    if (f.includes("afternoon"))
        slots.push("AFTERNOON");
    if (f.includes("evening"))
        slots.push("EVENING");
    if (f.includes("night") || f.includes("bed"))
        slots.push("NIGHT");
    return slots.length > 0 ? slots : ["MORNING"];
}
function isPrismaUniqueConstraintError(e) {
    return typeof e === "object" && e !== null && "code" in e && e.code === "P2002";
}
function startOfDayUtc(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}
function addDaysUtc(d, days) {
    return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
function listDueDoseTimes(args) {
    const { last, now, slots } = args;
    if (now.getTime() <= last.getTime())
        return [];
    if (slots.length === 0)
        return [];
    const times = [];
    const dayStart = startOfDayUtc(last);
    const endDayStart = startOfDayUtc(now);
    for (let d = dayStart; d.getTime() <= endDayStart.getTime(); d = addDaysUtc(d, 1)) {
        for (const slot of slots) {
            const hour = SLOT_HOURS_UTC[slot];
            const scheduledAt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 0, 0, 0));
            if (scheduledAt.getTime() > last.getTime() && scheduledAt.getTime() <= now.getTime()) {
                times.push(scheduledAt);
            }
        }
    }
    times.sort((a, b) => a.getTime() - b.getTime());
    return times;
}
async function reconcileMedicinesForPatient(patientId, now) {
    const medicines = await prisma.patientMedicine.findMany({
        where: { patientId, active: true },
        select: {
            id: true,
            inventoryCount: true,
            unitsPerDose: true,
            slotsJson: true,
            lastReconciledAt: true,
        },
    });
    for (const m of medicines) {
        const slotsRaw = m.slotsJson;
        const slots = (Array.isArray(slotsRaw) ? slotsRaw : [])
            .map((s) => String(s))
            .filter((s) => doseSlotEnum.options.includes(s));
        const due = listDueDoseTimes({ last: m.lastReconciledAt, now, slots });
        if (due.length === 0) {
            await prisma.patientMedicine.update({ where: { id: m.id }, data: { lastReconciledAt: now } });
            continue;
        }
        const unitsPerDose = Math.max(1, m.unitsPerDose);
        await prisma.$transaction(async (tx) => {
            let createdCount = 0;
            for (const scheduledAt of due) {
                try {
                    await tx.medicineDoseLog.create({
                        data: {
                            medicineId: m.id,
                            scheduledAt,
                            consumedUnits: unitsPerDose,
                        },
                    });
                    createdCount += 1;
                }
                catch (e) {
                    // Idempotency: the (medicineId, scheduledAt) pair is unique.
                    if (isPrismaUniqueConstraintError(e)) {
                        continue;
                    }
                    throw e;
                }
            }
            const decrementUnits = createdCount * unitsPerDose;
            if (decrementUnits > 0) {
                const updated = await tx.patientMedicine.update({
                    where: { id: m.id },
                    data: {
                        inventoryCount: { decrement: decrementUnits },
                        lastReconciledAt: now,
                    },
                    select: { inventoryCount: true },
                });
                if (updated.inventoryCount < 0) {
                    await tx.patientMedicine.update({ where: { id: m.id }, data: { inventoryCount: 0 } });
                }
            }
            else {
                await tx.patientMedicine.update({ where: { id: m.id }, data: { lastReconciledAt: now } });
            }
        });
    }
}
// -----------------
// Profiles
// -----------------
const patientProfileUpsertSchema = z.object({
    fullName: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().min(5).max(20).optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).optional(),
    dob: z.string().datetime().optional(),
    age: z.number().int().positive().max(130).optional(),
});
app.post("/profiles/patient", async (req, res) => {
    const userId = getUserId(req);
    const body = patientProfileUpsertSchema.parse(req.body);
    await prisma.user.upsert({
        where: { id: userId },
        update: { role: "PATIENT" },
        create: { id: userId, role: "PATIENT" },
    });
    const dob = body.dob ? new Date(body.dob) : null;
    const age = body.age ?? (dob ? computeAgeFromDob(dob) : null);
    const gender = body.gender ?? "UNKNOWN";
    // If profile exists, keep uniquePatientId stable.
    const existing = await prisma.patientProfile.findUnique({ where: { userId } });
    const uniquePatientId = existing?.uniquePatientId ?? generateUniquePatientId();
    const profile = await prisma.patientProfile.upsert({
        where: { userId },
        update: { fullName: body.fullName, email: body.email, phone: body.phone, gender, dob, age },
        create: { userId, fullName: body.fullName, email: body.email, phone: body.phone, gender, dob, age, uniquePatientId },
    });
    res.json({ ok: true, profile });
});
const doctorProfileUpsertSchema = z.object({
    fullName: z.string().min(1),
    specialty: z.string().min(1),
    licenseNumber: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(5).max(20).optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).optional(),
    dob: z.string().datetime().optional(),
    avatarUrl: z.string().url().optional(),
});
app.post("/profiles/doctor", async (req, res) => {
    const userId = getUserId(req);
    const body = doctorProfileUpsertSchema.parse(req.body);
    await prisma.user.upsert({
        where: { id: userId },
        update: { role: "DOCTOR" },
        create: { id: userId, role: "DOCTOR" },
    });
    const doctor = await prisma.doctorProfile.upsert({
        where: { userId },
        update: {
            fullName: body.fullName,
            specialty: body.specialty,
            licenseNumber: body.licenseNumber,
            email: body.email,
            phone: body.phone,
            gender: body.gender ?? "UNKNOWN",
            dob: body.dob ? new Date(body.dob) : null,
            avatarUrl: body.avatarUrl,
        },
        create: {
            userId,
            fullName: body.fullName,
            specialty: body.specialty,
            licenseNumber: body.licenseNumber,
            email: body.email,
            phone: body.phone,
            gender: body.gender ?? "UNKNOWN",
            dob: body.dob ? new Date(body.dob) : null,
            avatarUrl: body.avatarUrl,
        },
    });
    res.json({ ok: true, doctor });
});
app.post("/profiles/hospital", async (req, res) => {
    const userId = getUserId(req);
    await prisma.user.upsert({
        where: { id: userId },
        update: { role: "HOSPITAL" },
        create: { id: userId, role: "HOSPITAL" },
    });
    res.json({ ok: true });
});
app.get("/profiles/me", async (req, res) => {
    const userId = getUserId(req);
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { patientProfile: true, doctorProfile: true },
    });
    res.json({ ok: true, user });
});
async function assertCanAccessPatientData(actorId, targetPatientId) {
    if (actorId === targetPatientId)
        return;
    const link = await prisma.familyLink.findFirst({
        where: {
            ownerId: actorId,
            memberId: targetPatientId,
            status: "ACCEPTED",
        },
    });
    if (!link)
        throw new HttpError(403, "Not authorized");
}
// -----------------
// Family members (prototype)
// -----------------
const familyRequestCreateSchema = z.object({
    uniquePatientId: z.string().min(1),
});
app.post("/family/requests", async (req, res) => {
    const ownerId = getUserId(req);
    const body = familyRequestCreateSchema.parse(req.body);
    const memberProfile = await prisma.patientProfile.findUnique({
        where: { uniquePatientId: body.uniquePatientId },
    });
    if (!memberProfile)
        throw new HttpError(404, "Patient not found");
    const memberId = memberProfile.userId;
    if (memberId === ownerId)
        throw new HttpError(400, "Cannot add yourself");
    const existing = await prisma.familyLink.findUnique({
        where: { ownerId_memberId: { ownerId, memberId } },
    });
    if (existing) {
        res.json({ ok: true, link: existing });
        return;
    }
    const link = await prisma.familyLink.create({
        data: {
            ownerId,
            memberId,
            status: "PENDING",
        },
    });
    res.json({ ok: true, link });
});
app.get("/family/mine", async (req, res) => {
    const ownerId = getUserId(req);
    const links = await prisma.familyLink.findMany({
        where: { ownerId, status: "ACCEPTED" },
        orderBy: { updatedAt: "desc" },
        include: { member: { include: { patientProfile: true } } },
    });
    res.json({ ok: true, links });
});
// Links where the current user is the member (i.e., who can access my records)
app.get("/family/access", async (req, res) => {
    const memberId = getUserId(req);
    const links = await prisma.familyLink.findMany({
        where: { memberId, status: "ACCEPTED" },
        orderBy: { updatedAt: "desc" },
        include: { owner: { include: { patientProfile: true } } },
    });
    res.json({ ok: true, links });
});
// -----------------
// Emergency contacts (prototype)
// -----------------
app.get("/emergency/contacts", async (req, res) => {
    const patientId = getUserId(req);
    const familyAccess = await prisma.familyLink.findMany({
        where: { memberId: patientId, status: "ACCEPTED" },
        orderBy: { updatedAt: "desc" },
        include: { owner: { include: { patientProfile: true } } },
    });
    const contacts = await prisma.emergencyContact.findMany({
        where: { patientId },
        orderBy: { updatedAt: "desc" },
        include: { contactUser: { include: { patientProfile: true } } },
    });
    res.json({ ok: true, familyAccess, contacts });
});
const emergencyContactCreateSchema = z
    .object({
    uniquePatientId: z.string().min(1).optional(),
    email: z.string().email().optional(),
    label: z.string().min(1).max(60).optional(),
})
    .refine((v) => Boolean(v.uniquePatientId) !== Boolean(v.email), {
    message: "Provide either uniquePatientId or email",
});
app.post("/emergency/contacts", async (req, res) => {
    const patientId = getUserId(req);
    const body = emergencyContactCreateSchema.parse(req.body);
    if (body.uniquePatientId) {
        const profile = await prisma.patientProfile.findUnique({ where: { uniquePatientId: body.uniquePatientId } });
        if (!profile)
            throw new HttpError(404, "Patient not found");
        if (profile.userId === patientId)
            throw new HttpError(400, "Cannot add yourself");
        const existing = await prisma.emergencyContact.findFirst({
            where: { patientId, kind: "USER", contactUserId: profile.userId },
            include: { contactUser: { include: { patientProfile: true } } },
        });
        if (existing) {
            res.json({ ok: true, contact: existing });
            return;
        }
        const contact = await prisma.emergencyContact.create({
            data: {
                patientId,
                kind: "USER",
                contactUserId: profile.userId,
                label: body.label,
            },
            include: { contactUser: { include: { patientProfile: true } } },
        });
        res.json({ ok: true, contact });
        return;
    }
    const existing = await prisma.emergencyContact.findFirst({
        where: { patientId, kind: "EMAIL", email: body.email },
    });
    if (existing) {
        res.json({ ok: true, contact: existing });
        return;
    }
    const contact = await prisma.emergencyContact.create({
        data: {
            patientId,
            kind: "EMAIL",
            email: body.email,
            label: body.label,
        },
    });
    res.json({ ok: true, contact });
});
app.delete("/emergency/contacts/:contactId", async (req, res) => {
    const patientId = getUserId(req);
    const contactId = req.params.contactId;
    const result = await prisma.emergencyContact.deleteMany({ where: { id: contactId, patientId } });
    if (result.count === 0)
        throw new HttpError(404, "Contact not found");
    res.json({ ok: true });
});
const emergencyToggleSchema = z.object({ enabled: z.boolean() });
// Toggle notifications for a family member who has access to my records.
app.patch("/emergency/family-links/:linkId", async (req, res) => {
    const memberId = getUserId(req);
    const linkId = req.params.linkId;
    const body = emergencyToggleSchema.parse(req.body);
    const link = await prisma.familyLink.findUnique({ where: { id: linkId } });
    if (!link)
        throw new HttpError(404, "Link not found");
    if (link.memberId !== memberId)
        throw new HttpError(403, "Not authorized");
    if (link.status !== "ACCEPTED")
        throw new HttpError(400, "Link not accepted");
    const updated = await prisma.familyLink.update({
        where: { id: linkId },
        data: { emergencyNotify: body.enabled },
        include: { owner: { include: { patientProfile: true } } },
    });
    res.json({ ok: true, link: updated });
});
app.get("/family/requests/incoming", async (req, res) => {
    const memberId = getUserId(req);
    const links = await prisma.familyLink.findMany({
        where: { memberId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        include: { owner: { include: { patientProfile: true } } },
    });
    res.json({ ok: true, links });
});
app.post("/family/requests/:linkId/accept", async (req, res) => {
    const memberId = getUserId(req);
    const linkId = req.params.linkId;
    const link = await prisma.familyLink.findUnique({ where: { id: linkId } });
    if (!link)
        throw new HttpError(404, "Request not found");
    if (link.memberId !== memberId)
        throw new HttpError(403, "Not authorized");
    const updated = await prisma.familyLink.update({
        where: { id: linkId },
        data: { status: "ACCEPTED" },
    });
    res.json({ ok: true, link: updated });
});
app.delete("/family/links/:linkId", async (req, res) => {
    const userId = getUserId(req);
    const linkId = req.params.linkId;
    const link = await prisma.familyLink.findUnique({ where: { id: linkId } });
    if (!link)
        throw new HttpError(404, "Link not found");
    if (link.ownerId !== userId && link.memberId !== userId)
        throw new HttpError(403, "Not authorized");
    await prisma.familyLink.delete({ where: { id: linkId } });
    res.json({ ok: true });
});
// -----------------
// Doctors directory
// -----------------
app.get("/doctors/search", async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const doctors = await prisma.doctorProfile.findMany({
        where: q
            ? {
                OR: [
                    { fullName: { contains: q } },
                    { specialty: { contains: q } },
                ],
            }
            : undefined,
        orderBy: { updatedAt: "desc" },
        take: 20,
    });
    res.json({ ok: true, doctors });
});
app.get("/doctors/:doctorId", async (req, res) => {
    const doctorId = req.params.doctorId;
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: doctorId } });
    if (!doctor)
        throw new HttpError(404, "Doctor not found");
    res.json({ ok: true, doctor });
});
app.get("/patients/me/recent-doctors", async (req, res) => {
    const patientId = getUserId(req);
    const recent = await prisma.shareRequest.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { doctorId: true },
    });
    const doctorIds = Array.from(new Set(recent.map((r) => r.doctorId)));
    const doctors = await prisma.doctorProfile.findMany({ where: { userId: { in: doctorIds } } });
    res.json({ ok: true, doctors });
});
// -----------------
// Uploads
// -----------------
const uploadMetaSchema = z.object({
    category: z.enum(["REPORT", "SCAN_IMAGING", "PRESCRIPTION", "OTHER"]).optional(),
});
app.post("/uploads", upload.single("file"), async (req, res) => {
    const patientId = getUserId(req);
    if (!req.file)
        throw new HttpError(400, "Missing file");
    const meta = uploadMetaSchema.parse(req.body);
    const stored = await storePatientFile({
        patientId,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        buffer: req.file.buffer,
    });
    await prisma.user.upsert({
        where: { id: patientId },
        update: { role: "PATIENT" },
        create: { id: patientId, role: "PATIENT" },
    });
    const record = await prisma.fileUpload.create({
        data: {
            patientId,
            category: meta.category ?? "OTHER",
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
            storagePath: stored.storagePath,
            storageProvider: stored.provider,
            storagePublicId: stored.provider === "CLOUDINARY" ? stored.publicId : null,
            storageResourceType: stored.provider === "CLOUDINARY" ? stored.resourceType : null,
        },
    });
    res.json({ ok: true, upload: record });
});
app.get("/uploads/mine", async (req, res) => {
    const patientId = getUserId(req);
    const uploads = await prisma.fileUpload.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
    });
    res.json({ ok: true, uploads });
});
app.get("/patients/:patientId/uploads", async (req, res) => {
    const actorId = getUserId(req);
    const patientId = req.params.patientId;
    await assertCanAccessPatientData(actorId, patientId);
    const uploads = await prisma.fileUpload.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
    });
    res.json({ ok: true, uploads });
});
app.get("/files/:fileUploadId/download", async (req, res) => {
    const userId = getUserId(req);
    const fileUploadId = req.params.fileUploadId;
    const uploadRecord = await prisma.fileUpload.findUnique({ where: { id: fileUploadId } });
    if (!uploadRecord)
        throw new HttpError(404, "File not found");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isHospital = user?.role === "HOSPITAL";
    const isDoctor = user?.role === "DOCTOR";
    // Minimal access rules for prototype:
    // - patient owner can download
    // - doctor can download if included in a request addressed to them
    // - hospital can download (lookup portal)
    if (!isHospital && uploadRecord.patientId !== userId) {
        if (isDoctor) {
            const share = await prisma.shareRequestFile.findFirst({
                where: {
                    fileUploadId,
                    shareRequest: { doctorId: userId },
                },
            });
            if (!share)
                throw new HttpError(403, "Not authorized to download this file");
        }
        else {
            await assertCanAccessPatientData(userId, uploadRecord.patientId);
        }
    }
    res.setHeader("Content-Type", uploadRecord.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(uploadRecord.originalName)}"`);
    if (uploadRecord.storageProvider === "CLOUDINARY" && uploadRecord.storagePublicId && uploadRecord.storageResourceType) {
        const url = cloudinarySignedDownloadUrl({
            publicId: uploadRecord.storagePublicId,
            resourceType: uploadRecord.storageResourceType,
            filename: uploadRecord.originalName,
        });
        return res.redirect(302, url);
    }
    if (uploadRecord.storagePath.startsWith("http://") || uploadRecord.storagePath.startsWith("https://")) {
        return res.redirect(302, uploadRecord.storagePath);
    }
    return res.sendFile(uploadRecord.storagePath);
});
app.get("/files/:fileUploadId/view", async (req, res) => {
    const userId = getUserId(req);
    const fileUploadId = req.params.fileUploadId;
    const uploadRecord = await prisma.fileUpload.findUnique({ where: { id: fileUploadId } });
    if (!uploadRecord)
        throw new HttpError(404, "File not found");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isHospital = user?.role === "HOSPITAL";
    const isDoctor = user?.role === "DOCTOR";
    // Same minimal access rules as download.
    if (!isHospital && uploadRecord.patientId !== userId) {
        if (isDoctor) {
            const share = await prisma.shareRequestFile.findFirst({
                where: {
                    fileUploadId,
                    shareRequest: { doctorId: userId },
                },
            });
            if (!share)
                throw new HttpError(403, "Not authorized to view this file");
        }
        else {
            await assertCanAccessPatientData(userId, uploadRecord.patientId);
        }
    }
    res.setHeader("Content-Type", uploadRecord.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(uploadRecord.originalName)}"`);
    if (uploadRecord.storageProvider === "CLOUDINARY" && uploadRecord.storagePublicId && uploadRecord.storageResourceType) {
        const url = cloudinarySignedViewUrl({
            publicId: uploadRecord.storagePublicId,
            resourceType: uploadRecord.storageResourceType,
        });
        return res.redirect(302, url);
    }
    if (uploadRecord.storagePath.startsWith("http://") || uploadRecord.storagePath.startsWith("https://")) {
        return res.redirect(302, uploadRecord.storagePath);
    }
    return res.sendFile(uploadRecord.storagePath);
});
// -----------------
// Share requests
// -----------------
const shareRequestSchema = z.object({
    doctorId: z.string().min(1),
    subjectPatientId: z.string().min(1).optional(),
    fileUploadIds: z.array(z.string()).default([]),
    message: z.string().optional(),
});
app.post("/share-requests", async (req, res) => {
    const patientId = getUserId(req);
    const body = shareRequestSchema.parse(req.body);
    const subjectPatientId = body.subjectPatientId ?? patientId;
    if (subjectPatientId !== patientId) {
        await assertCanAccessPatientData(patientId, subjectPatientId);
    }
    // Validate patient owns the referenced uploads
    if (body.fileUploadIds.length > 0) {
        const count = await prisma.fileUpload.count({
            where: { id: { in: body.fileUploadIds }, patientId: subjectPatientId },
        });
        if (count !== body.fileUploadIds.length)
            throw new HttpError(400, "One or more files do not belong to patient");
    }
    const request = await prisma.shareRequest.create({
        data: {
            patientId,
            doctorId: body.doctorId,
            subjectPatientId,
            message: body.message,
            files: {
                createMany: {
                    data: body.fileUploadIds.map((id) => ({ fileUploadId: id })),
                },
            },
        },
        include: {
            files: { include: { fileUpload: true } },
        },
    });
    res.json({ ok: true, request });
});
// -----------------
// Doctor inbox
// -----------------
app.get("/doctor/inbox", async (req, res) => {
    const doctorId = getUserId(req);
    const inbox = await prisma.shareRequest.findMany({
        where: { doctorId },
        orderBy: { createdAt: "desc" },
        include: {
            patient: { include: { patientProfile: true } },
            subjectPatient: { include: { patientProfile: true } },
            files: { include: { fileUpload: true } },
        },
    });
    res.json({ ok: true, inbox });
});
app.get("/doctor/inbox/:requestId", async (req, res) => {
    const doctorId = getUserId(req);
    const requestId = req.params.requestId;
    const request = await prisma.shareRequest.findUnique({
        where: { id: requestId },
        include: {
            patient: { include: { patientProfile: true } },
            subjectPatient: { include: { patientProfile: true } },
            files: { include: { fileUpload: true } },
            prescriptions: { include: { items: true } },
        },
    });
    if (!request)
        throw new HttpError(404, "Request not found");
    if (request.doctorId !== doctorId)
        throw new HttpError(403, "Not authorized");
    res.json({ ok: true, request });
});
const prescriptionCreateSchema = z.object({
    notes: z.string().optional(),
    items: z
        .array(z.object({
        medicineName: z.string().min(1),
        dosage: z.string().min(1),
        frequency: z.string().optional(),
        duration: z.string().optional(),
    }))
        .min(1),
});
app.post("/doctor/inbox/:requestId/prescriptions", async (req, res) => {
    const doctorId = getUserId(req);
    const requestId = req.params.requestId;
    const body = prescriptionCreateSchema.parse(req.body);
    const request = await prisma.shareRequest.findUnique({ where: { id: requestId } });
    if (!request)
        throw new HttpError(404, "Request not found");
    if (request.doctorId !== doctorId)
        throw new HttpError(403, "Not authorized");
    const targetPatientId = request.subjectPatientId ?? request.patientId;
    const prescription = await prisma.prescription.create({
        data: {
            patientId: targetPatientId,
            doctorId,
            shareRequestId: requestId,
            notes: body.notes,
            items: {
                createMany: {
                    data: body.items.map((it) => ({
                        medicineName: it.medicineName,
                        dosage: it.dosage,
                        frequency: it.frequency,
                        duration: it.duration,
                    })),
                },
            },
        },
        include: { items: true },
    });
    // Auto-create medicine tracker entries for the patient.
    const now = new Date();
    for (const it of prescription.items) {
        await prisma.patientMedicine.create({
            data: {
                patientId: targetPatientId,
                prescriptionItemId: it.id,
                medicineName: it.medicineName,
                dosageText: it.dosage,
                frequencyText: it.frequency,
                durationText: it.duration,
                slotsJson: defaultSlotsFromFrequency(it.frequency),
                unitsPerDose: 1,
                inventoryCount: 0,
                lastReconciledAt: now,
            },
        });
    }
    // Prototype UX: also store the prescription as a file record so it appears in the
    // patient's unified Records list (viewable in-browser).
    const safeFileName = `Prescription_${new Date().toISOString().slice(0, 10)}_${prescription.id}.html`;
    const escapedNotes = (body.notes ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;");
    const rows = body.items
        .map((it) => {
        const medicineName = it.medicineName.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        const dosage = it.dosage.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        const frequency = (it.frequency ?? "—").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        const duration = (it.duration ?? "—").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        return `<tr><td>${medicineName}</td><td>${dosage}</td><td>${frequency}</td><td>${duration}</td></tr>`;
    })
        .join("");
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Prescription</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; color: #0f172a; }
      h1 { font-size: 18px; margin: 0 0 6px; }
      .meta { font-size: 12px; color: #475569; margin-bottom: 16px; }
      .notes { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 12px; margin: 12px 0 16px; white-space: pre-wrap; }
      table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
      th, td { text-align: left; padding: 10px 12px; border-top: 1px solid #e2e8f0; font-size: 14px; }
      th { background: #f8fafc; font-size: 12px; color: #475569; border-top: none; }
    </style>
  </head>
  <body>
    <h1>Prescription</h1>
    <div class="meta">Created: ${new Date(prescription.createdAt).toLocaleString()}</div>
    ${escapedNotes ? `<div class="notes">${escapedNotes}</div>` : ""}
    <table>
      <thead>
        <tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </body>
</html>`;
    const buf = Buffer.from(html, "utf8");
    const stored = await storePatientFile({
        patientId: targetPatientId,
        originalName: safeFileName,
        mimeType: "text/html",
        buffer: buf,
        preferredResourceType: "raw",
    });
    await prisma.fileUpload.create({
        data: {
            patientId: targetPatientId,
            category: "PRESCRIPTION",
            originalName: safeFileName,
            mimeType: "text/html",
            sizeBytes: buf.length,
            storagePath: stored.storagePath,
            storageProvider: stored.provider,
            storagePublicId: stored.provider === "CLOUDINARY" ? stored.publicId : null,
            storageResourceType: stored.provider === "CLOUDINARY" ? stored.resourceType : null,
        },
    });
    res.json({ ok: true, prescription });
});
// Patient: current medicines + inventory
app.get("/medicines/current", async (req, res) => {
    const patientId = getUserId(req);
    const user = await prisma.user.findUnique({ where: { id: patientId } });
    if (user?.role !== "PATIENT")
        throw new HttpError(403, "Not authorized");
    const medicines = await prisma.patientMedicine.findMany({
        where: { patientId, active: true },
        orderBy: { updatedAt: "desc" },
    });
    res.json({ ok: true, medicines });
});
app.post("/medicines/reconcile", async (req, res) => {
    const patientId = getUserId(req);
    const user = await prisma.user.findUnique({ where: { id: patientId } });
    if (user?.role !== "PATIENT")
        throw new HttpError(403, "Not authorized");
    const now = new Date();
    await reconcileMedicinesForPatient(patientId, now);
    const medicines = await prisma.patientMedicine.findMany({
        where: { patientId, active: true },
        orderBy: { updatedAt: "desc" },
    });
    res.json({ ok: true, medicines });
});
const inventoryAdjustSchema = z.object({ delta: z.number().int().min(-9999).max(9999) });
app.post("/medicines/:medicineId/adjust", async (req, res) => {
    const patientId = getUserId(req);
    const medicineId = req.params.medicineId;
    const body = inventoryAdjustSchema.parse(req.body);
    const med = await prisma.patientMedicine.findUnique({ where: { id: medicineId } });
    if (!med || med.patientId !== patientId)
        throw new HttpError(404, "Medicine not found");
    const next = Math.max(0, med.inventoryCount + body.delta);
    const updated = await prisma.patientMedicine.update({ where: { id: medicineId }, data: { inventoryCount: next } });
    res.json({ ok: true, medicine: updated });
});
// -----------------
// Patient prescriptions
// -----------------
app.get("/patients/me/prescriptions", async (req, res) => {
    const patientId = getUserId(req);
    const prescriptions = await prisma.prescription.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
        include: {
            items: true,
            doctor: { include: { doctorProfile: true } },
        },
    });
    res.json({ ok: true, prescriptions });
});
app.get("/patients/:patientId/prescriptions", async (req, res) => {
    const actorId = getUserId(req);
    const patientId = req.params.patientId;
    await assertCanAccessPatientData(actorId, patientId);
    const prescriptions = await prisma.prescription.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
        include: {
            items: true,
            doctor: { include: { doctorProfile: true } },
        },
    });
    res.json({ ok: true, prescriptions });
});
app.get("/patients/me/prescriptions/:prescriptionId", async (req, res) => {
    const patientId = getUserId(req);
    const prescriptionId = req.params.prescriptionId;
    const prescription = await prisma.prescription.findUnique({
        where: { id: prescriptionId },
        include: {
            items: true,
            doctor: { include: { doctorProfile: true } },
        },
    });
    if (!prescription)
        throw new HttpError(404, "Prescription not found");
    if (prescription.patientId !== patientId)
        throw new HttpError(403, "Not authorized");
    res.json({ ok: true, prescription });
});
app.get("/patients/:patientId/prescriptions/:prescriptionId", async (req, res) => {
    const actorId = getUserId(req);
    const patientId = req.params.patientId;
    const prescriptionId = req.params.prescriptionId;
    await assertCanAccessPatientData(actorId, patientId);
    const prescription = await prisma.prescription.findUnique({
        where: { id: prescriptionId },
        include: {
            items: true,
            doctor: { include: { doctorProfile: true } },
        },
    });
    if (!prescription)
        throw new HttpError(404, "Prescription not found");
    if (prescription.patientId !== patientId)
        throw new HttpError(404, "Prescription not found");
    res.json({ ok: true, prescription });
});
// -----------------
// Hospital lookup (prototype)
// -----------------
app.get("/hospital/patients/:uniquePatientId", async (req, res) => {
    const userId = getUserId(req);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== "HOSPITAL")
        throw new HttpError(403, "Not authorized");
    const uniquePatientId = req.params.uniquePatientId;
    const profile = await prisma.patientProfile.findUnique({ where: { uniquePatientId } });
    if (!profile)
        throw new HttpError(404, "Patient not found");
    const uploads = await prisma.fileUpload.findMany({
        where: { patientId: profile.userId },
        orderBy: { createdAt: "desc" },
    });
    const prescriptions = await prisma.prescription.findMany({
        where: { patientId: profile.userId },
        orderBy: { createdAt: "desc" },
        include: {
            items: true,
            doctor: { include: { doctorProfile: true } },
        },
    });
    // Fire-and-forget notification (does not block the lookup response).
    void (async () => {
        try {
            const occurredAtIso = new Date().toISOString();
            const [links, contacts] = await Promise.all([
                prisma.familyLink.findMany({
                    where: {
                        memberId: profile.userId,
                        status: "ACCEPTED",
                        emergencyNotify: true,
                    },
                    include: { owner: { include: { patientProfile: true } } },
                }),
                prisma.emergencyContact.findMany({
                    where: { patientId: profile.userId },
                    include: { contactUser: { include: { patientProfile: true } } },
                }),
            ]);
            const emails = [];
            // Notify the patient directly if they have an email on file.
            if (profile.email)
                emails.push(profile.email);
            for (const l of links) {
                const email = l.owner.patientProfile?.email;
                if (email)
                    emails.push(email);
            }
            for (const c of contacts) {
                if (c.kind === "EMAIL" && c.email)
                    emails.push(c.email);
                if (c.kind === "USER") {
                    const email = c.contactUser?.patientProfile?.email;
                    if (email)
                        emails.push(email);
                }
            }
            await sendEmergencyLookupEmail({
                to: emails,
                patientName: profile.fullName,
                uniquePatientId: profile.uniquePatientId,
                hospitalUserId: userId,
                occurredAtIso,
            });
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error("Failed to send emergency lookup email", e);
        }
    })();
    res.json({ ok: true, profile, uploads, prescriptions });
});
app.get("/hospital/prescriptions/:prescriptionId", async (req, res) => {
    const userId = getUserId(req);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== "HOSPITAL")
        throw new HttpError(403, "Not authorized");
    const prescriptionId = req.params.prescriptionId;
    const prescription = await prisma.prescription.findUnique({
        where: { id: prescriptionId },
        include: {
            items: true,
            doctor: { include: { doctorProfile: true } },
            patient: { include: { patientProfile: true } },
        },
    });
    if (!prescription)
        throw new HttpError(404, "Prescription not found");
    res.json({ ok: true, prescription });
});
// -----------------
// Error handling
// -----------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    if (!(err instanceof HttpError) && !(err instanceof z.ZodError)) {
        // eslint-disable-next-line no-console
        console.error("Unhandled error:", err);
    }
    const httpError = asHttpError(err);
    const message = err instanceof z.ZodError ? err.flatten() : httpError.message;
    res.status(err instanceof HttpError ? err.status : httpError.status).json({ ok: false, error: message });
});
// Background reconciliation (prototype): decrements inventory at scheduled dose times.
// Runs only while the API process is running.
setInterval(() => {
    void (async () => {
        try {
            const now = new Date();
            const patients = await prisma.patientMedicine.findMany({
                where: { active: true },
                distinct: ["patientId"],
                select: { patientId: true },
            });
            for (const p of patients) {
                await reconcileMedicinesForPatient(p.patientId, now);
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error("Medicine reconcile loop failed", e);
        }
    })();
}, 60_000);
const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`MediLink API listening on http://localhost:${port}`);
});
