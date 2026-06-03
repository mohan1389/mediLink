"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DoseSlot = "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT" | "BEDTIME";
const ALL_SLOTS: DoseSlot[] = ["MORNING", "AFTERNOON", "EVENING", "NIGHT", "BEDTIME"];
const SLOT_LABELS: Record<DoseSlot, string> = { MORNING: "☀️ Morning", AFTERNOON: "🌤 Afternoon", EVENING: "🌆 Evening", NIGHT: "🌙 Night", BEDTIME: "😴 Bedtime" };

const DOSAGE_UNITS = ["mg", "ml", "mcg", "units", "tablets", "capsules", "drops", "puffs", "patch"];

type FileUpload = { id: string; category: string; originalName: string; mimeType: string; sizeBytes: number };
type PrescriptionItem = { id: string; medicineName: string; dosage: string; frequency: string | null; duration: string | null; slots?: string | null };
type Prescription = { id: string; createdAt: string; notes: string | null; items: PrescriptionItem[] };
type Request = {
  id: string; message: string | null; createdAt: string;
  patient: { id: string; patientProfile: { fullName: string; age: number | null; gender: string } | null };
  subjectPatient: { id: string; patientProfile: { fullName: string; age: number | null; gender: string } | null } | null;
  files: Array<{ fileUpload: FileUpload }>;
  prescriptions: Prescription[];
};

type RxRow = { medicineName: string; dosageAmount: string; dosageUnit: string; durationDays: string; slots: DoseSlot[] };

function newRow(): RxRow { return { medicineName: "", dosageAmount: "", dosageUnit: "mg", durationDays: "", slots: [] }; }
function bytes(n: number) { if (n < 1024) return `${n} B`; const kb = n / 1024; if (kb < 1024) return `${kb.toFixed(1)} KB`; return `${(kb / 1024).toFixed(1)} MB`; }
function fmt(dt: string) { try { return new Date(dt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return dt; } }
function initials(name: string) { const p = name.trim().split(/\s+/); return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase(); }

const SLOT_COLORS: Record<DoseSlot, string> = {
  MORNING: "bg-amber-50 text-amber-700 border-amber-200",
  AFTERNOON: "bg-orange-50 text-orange-700 border-orange-200",
  EVENING: "bg-violet-50 text-violet-700 border-violet-200",
  NIGHT: "bg-blue-50 text-blue-700 border-blue-200",
  BEDTIME: "bg-slate-100 text-slate-600 border-slate-200",
};

const selectCls = "h-10 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1";

export default function DoctorRequestDetailPage() {
  const { user } = useUser();
  const userId = user?.id;
  const params = useParams();
  const requestId = String((params as any)?.requestId ?? "");

  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rxRows, setRxRows] = useState<RxRow[]>([newRow()]);
  const [rxNotes, setRxNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [rxError, setRxError] = useState<string | null>(null);
  const [rxSuccess, setRxSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !requestId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await apiFetch<{ request: Request }>(`/doctor/inbox/${requestId}`, { userId });
      if (cancelled) return;
      if (!res.ok) { setError("Failed to load request"); setLoading(false); return; }
      setRequest(res.request); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, requestId]);

  function updateRow(idx: number, patch: Partial<RxRow>) {
    setRxRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }
  function toggleSlot(idx: number, slot: DoseSlot) {
    setRxRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const slots = r.slots.includes(slot) ? r.slots.filter((s) => s !== slot) : [...r.slots, slot];
      return { ...r, slots };
    }));
  }
  function addRow() { setRxRows((prev) => [...prev, newRow()]); }
  function removeRow(idx: number) { setRxRows((prev) => prev.filter((_, i) => i !== idx)); }

  async function onSubmitRx() {
    if (!userId || !requestId) return;
    const validRows = rxRows.filter((r) => r.medicineName.trim());
    if (validRows.length === 0) { setRxError("Add at least one medicine."); return; }
    setSaving(true); setRxError(null); setRxSuccess(null);

    const items = validRows.map((r) => {
      const dosageStr = r.dosageAmount ? `${r.dosageAmount} ${r.dosageUnit}` : r.dosageUnit;
      return {
        medicineName: r.medicineName,
        dosage: dosageStr,
        dosageAmount: r.dosageAmount ? Number(r.dosageAmount) : undefined,
        dosageUnit: r.dosageUnit,
        frequency: r.slots.join(", "),
        slots: r.slots,
        duration: r.durationDays ? `${r.durationDays} days` : undefined,
        durationDays: r.durationDays ? Number(r.durationDays) : undefined,
      };
    });

    const res = await apiFetch<{ prescription: Prescription }>(`/doctor/inbox/${requestId}/prescriptions`, {
      userId, method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: rxNotes || undefined, items }),
    });

    if (!res.ok) { setRxError("Failed to create prescription"); setSaving(false); return; }
    setRequest((prev) => prev ? { ...prev, prescriptions: [res.prescription, ...prev.prescriptions] } : prev);
    setRxRows([newRow()]); setRxNotes(""); setRxSuccess("Prescription added!"); setSaving(false);
  }

  if (!userId) return <div className="text-sm text-slate-500">Not signed in.</div>;
  if (loading) return <div className="flex items-center gap-2 text-sm text-slate-500"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Loading…</div>;
  if (error || !request) return <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error ?? "Not found"}</div>;

  const subject = request.subjectPatient ?? request.patient;
  const subjectName = subject.patientProfile?.fullName ?? "Patient";

  return (
    <div className="max-w-4xl">
      <Link href="/doctor/inbox" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-5">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back to Inbox
      </Link>

      {/* Patient header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-5">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white font-semibold">{initials(subjectName)}</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900">{subjectName}</h1>
            <div className="flex flex-wrap gap-2 mt-1">
              {subject.patientProfile?.gender && subject.patientProfile.gender !== "UNKNOWN" && (
                <Badge variant="secondary">{subject.patientProfile.gender.charAt(0) + subject.patientProfile.gender.slice(1).toLowerCase()}</Badge>
              )}
              {subject.patientProfile?.age && <Badge variant="blue">{subject.patientProfile.age} yrs</Badge>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Requested</div>
            <div className="text-sm font-medium text-slate-700">{fmt(request.createdAt)}</div>
          </div>
        </div>
        {request.message && (
          <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Message:</span> {request.message}
          </div>
        )}
      </div>

      {/* Shared files */}
      <Card className="mb-5">
        <CardHeader><CardTitle>Shared Files</CardTitle><CardDescription>{request.files.length} file{request.files.length !== 1 ? "s" : ""} attached</CardDescription></CardHeader>
        <CardContent>
          {request.files.length === 0 ? (
            <p className="text-sm text-slate-400">No files attached.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {request.files.map(({ fileUpload: f }) => (
                <li key={f.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-sm">
                    {f.mimeType.startsWith("image/") ? "🖼" : f.mimeType === "application/pdf" ? "📄" : f.mimeType === "text/html" ? "📋" : "📎"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 truncate">{f.originalName}</div>
                    <div className="text-xs text-slate-400">{bytes(f.sizeBytes)}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(f.mimeType === "application/pdf" || f.mimeType.startsWith("image/") || f.mimeType === "text/html") && (
                      <a href={`/api/files/${f.id}/view`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors">
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        View
                      </a>
                    )}
                    <a href={`/api/files/${f.id}/download`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors">
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Download
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* New Prescription Form */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Write a Prescription</CardTitle>
          <CardDescription>Add medicines with structured dosage, timing, and duration.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rxRows.map((row, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Medicine {idx + 1}</span>
                  {rxRows.length > 1 && (
                    <button type="button" onClick={() => removeRow(idx)} className="text-xs text-slate-400 hover:text-red-500 transition-colors">Remove</button>
                  )}
                </div>

                {/* Medicine name */}
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">Medicine name *</label>
                  <Input value={row.medicineName} onChange={(e) => updateRow(idx, { medicineName: e.target.value })} placeholder="e.g. Paracetamol" className="bg-white" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Dosage */}
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-1 block">Dosage</label>
                    <div className="flex gap-2">
                      <Input
                        type="number" min={0} step="any" className="bg-white min-w-0 flex-1"
                        value={row.dosageAmount} onChange={(e) => updateRow(idx, { dosageAmount: e.target.value })}
                        placeholder="e.g. 500"
                      />
                      <select className={`${selectCls} w-28 flex-shrink-0`} value={row.dosageUnit} onChange={(e) => updateRow(idx, { dosageUnit: e.target.value })}>
                        {DOSAGE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-1 block">Duration</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" min={1} className="bg-white min-w-0 flex-1"
                        value={row.durationDays} onChange={(e) => updateRow(idx, { durationDays: e.target.value })}
                        placeholder="e.g. 7"
                      />
                      <span className="text-sm text-slate-400 flex-shrink-0">days</span>
                    </div>
                  </div>
                </div>

                {/* Timing checkboxes */}
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-2 block">Timing (when to take)</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_SLOTS.map((slot) => {
                      const active = row.slots.includes(slot);
                      return (
                        <button
                          key={slot} type="button"
                          onClick={() => toggleSlot(idx, slot)}
                          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium border transition-all duration-100 cursor-pointer ${
                            active ? SLOT_COLORS[slot] + " shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {SLOT_LABELS[slot]}
                        </button>
                      );
                    })}
                  </div>
                  {row.slots.length === 0 && <p className="text-xs text-slate-400 mt-1">Select one or more timing slots.</p>}
                </div>
              </div>
            ))}

            <button type="button" onClick={addRow} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add another medicine
            </button>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Doctor&apos;s notes</label>
              <textarea
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm min-h-[70px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                value={rxNotes} onChange={(e) => setRxNotes(e.target.value)}
                placeholder="Any special instructions or notes for the patient…"
              />
            </div>

            {rxError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{rxError}</div>}
            {rxSuccess && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">✓ {rxSuccess}</div>}

            <Button onClick={onSubmitRx} disabled={saving} className="w-full sm:w-fit">
              {saving ? "Saving…" : "Create Prescription"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Past prescriptions */}
      {request.prescriptions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Previous Prescriptions</CardTitle><CardDescription>{request.prescriptions.length} prescription{request.prescriptions.length !== 1 ? "s" : ""} for this request</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {request.prescriptions.map((rx) => {
                let parsedSlots: string[] = [];
                return (
                  <div key={rx.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-slate-400">{fmt(rx.createdAt)}</span>
                      {rx.notes && <span className="text-xs text-slate-500 italic">"{rx.notes}"</span>}
                    </div>
                    <ul className="space-y-2">
                      {rx.items.map((it) => {
                        try { parsedSlots = it.slots ? JSON.parse(it.slots) : []; } catch { parsedSlots = []; }
                        return (
                          <li key={it.id} className="flex items-start gap-2.5">
                            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                            <div>
                              <span className="text-sm font-medium text-slate-900">{it.medicineName}</span>
                              <span className="text-xs text-slate-400 ml-2">{it.dosage}{it.duration ? ` · ${it.duration}` : ""}</span>
                              {parsedSlots.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {parsedSlots.map((s) => (
                                    <span key={s} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${SLOT_COLORS[s as DoseSlot] ?? "bg-slate-100 text-slate-600"}`}>
                                      {SLOT_LABELS[s as DoseSlot] ?? s}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
