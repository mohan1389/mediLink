"use client";

import Link from "next/link";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Upload = { id: string; category: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: string };
type PrescriptionItem = { id: string; medicineName: string; dosage: string; frequency: string | null; duration: string | null; slots?: string | null };
type Prescription = { id: string; createdAt: string; notes: string | null; items: PrescriptionItem[]; doctor: { doctorProfile: { fullName: string; specialty: string } | null } };
type PatientResult = {
  profile: { userId: string; fullName: string; age: number | null; gender: string; uniquePatientId: string; email: string | null; phone: string | null };
  uploads: Upload[];
  prescriptions: Prescription[];
};

const SLOT_LABELS: Record<string, string> = { MORNING: "☀️ Morning", AFTERNOON: "🌤 Afternoon", EVENING: "🌆 Evening", NIGHT: "🌙 Night", BEDTIME: "😴 Bedtime" };
const SLOT_COLORS: Record<string, string> = { MORNING: "bg-amber-50 text-amber-700 border-amber-200", AFTERNOON: "bg-orange-50 text-orange-700 border-orange-200", EVENING: "bg-violet-50 text-violet-700 border-violet-200", NIGHT: "bg-blue-50 text-blue-700 border-blue-200", BEDTIME: "bg-slate-100 text-slate-600 border-slate-200" };

const CATEGORY_ICON: Record<string, string> = { REPORT: "📄", SCAN_IMAGING: "🔬", PRESCRIPTION: "💊", OTHER: "📎" };
const CATEGORY_BADGE: Record<string, "blue" | "purple" | "green" | "secondary"> = { REPORT: "blue", SCAN_IMAGING: "purple", PRESCRIPTION: "green", OTHER: "secondary" };

function bytes(n: number) { if (n < 1024) return `${n} B`; const kb = n / 1024; if (kb < 1024) return `${kb.toFixed(1)} KB`; return `${(kb / 1024).toFixed(1)} MB`; }
function fmt(dt: string) { try { return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return dt; } }

export default function HospitalLookupPage() {
  const { user } = useUser();
  const userId = user?.id;
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PatientResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function onSearch() {
    const q = query.trim();
    if (!userId || !q) return;
    setLoading(true); setError(null); setResult(null); setSearched(true);
    const res = await apiFetch<PatientResult>(`/hospital/patients/${encodeURIComponent(q)}`, { userId });
    if (!res.ok) { setError((res as any).error ?? "Patient not found"); setLoading(false); return; }
    setResult(res as PatientResult); setLoading(false);
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Patient Lookup</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter a patient&apos;s unique ID to access their records. An emergency notification will be sent to their contacts.
        </p>
      </div>

      {/* Warning banner */}
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
        <div className="flex-shrink-0 text-amber-500 mt-0.5">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <p className="text-sm text-amber-700">
          <strong>Emergency lookup:</strong> Using this lookup will automatically notify the patient and their emergency contacts.
        </p>
      </div>

      {/* Search card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm mb-5">
        <label className="text-sm font-semibold text-slate-900 block mb-2">Patient Unique ID</label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-slate-400"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>
            </div>
            <Input
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="e.g. ML-A1B2C3D4"
            />
          </div>
          <Button onClick={onSearch} disabled={!query.trim() || loading}>
            {loading ? "Searching…" : "Lookup"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Ask the patient or their family for their unique MediLink Patient ID.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-5">
          <strong>Not found:</strong> {error}
        </div>
      )}

      {searched && !result && !error && !loading && (
        <div className="text-center py-10 text-sm text-slate-400">No patient found for that ID.</div>
      )}

      {result && (
        <div className="space-y-5">
          {/* Patient profile card */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-teal-50 to-blue-50 p-5">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
                  {result.profile.fullName.trim().charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-slate-900">{result.profile.fullName}</h2>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {result.profile.gender && result.profile.gender !== "UNKNOWN" && (
                      <Badge variant="secondary">{result.profile.gender.charAt(0) + result.profile.gender.slice(1).toLowerCase()}</Badge>
                    )}
                    {result.profile.age && <Badge variant="blue">{result.profile.age} yrs</Badge>}
                    <Badge variant="green">ID: {result.profile.uniquePatientId}</Badge>
                  </div>
                </div>
                <div className="text-right text-sm text-slate-500 flex-shrink-0">
                  {result.profile.email && <div className="text-xs">{result.profile.email}</div>}
                  {result.profile.phone && <div className="text-xs mt-0.5">{result.profile.phone}</div>}
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-50/50 border-b border-amber-100">
              <div className="flex items-center gap-2 text-xs text-amber-700">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.26 12 19.8 19.8 0 0 1 1.08 3.2 2 2 0 0 1 3.05 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Emergency contacts &amp; patient have been notified of this lookup.
              </div>
            </div>
          </div>

          {/* Files */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Medical Records</h3>
              <p className="text-xs text-slate-400 mt-0.5">{result.uploads.length} file{result.uploads.length !== 1 ? "s" : ""}</p>
            </div>
            {result.uploads.length === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-400 text-center">No files uploaded yet.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {result.uploads.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-base">
                      {CATEGORY_ICON[f.category] ?? "📎"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">{f.originalName}</span>
                        <Badge variant={CATEGORY_BADGE[f.category] ?? "secondary"} className="text-xs flex-shrink-0">{f.category.replace("_", " ")}</Badge>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{bytes(f.sizeBytes)} · {fmt(f.createdAt)}</div>
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
          </div>

          {/* Prescriptions */}
          {result.prescriptions.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="font-semibold text-slate-900">Prescriptions</h3>
                <p className="text-xs text-slate-400 mt-0.5">{result.prescriptions.length} prescription{result.prescriptions.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="divide-y divide-slate-100">
                {result.prescriptions.map((rx) => (
                  <div key={rx.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{rx.doctor.doctorProfile?.fullName ?? "Doctor"}</div>
                        {rx.doctor.doctorProfile?.specialty && <div className="text-xs text-slate-400">{rx.doctor.doctorProfile.specialty}</div>}
                      </div>
                      <span className="text-xs text-slate-400">{fmt(rx.createdAt)}</span>
                    </div>
                    {rx.notes && <div className="mb-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">{rx.notes}</div>}
                    <ul className="space-y-2">
                      {rx.items.map((it) => {
                        let parsedSlots: string[] = [];
                        try { parsedSlots = it.slots ? JSON.parse(it.slots) : []; } catch { parsedSlots = []; }
                        return (
                          <li key={it.id} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-900">{it.medicineName}</span>
                              {it.dosage && <Badge variant="blue" className="text-xs">{it.dosage}</Badge>}
                              {it.duration && <Badge variant="secondary" className="text-xs">{it.duration}</Badge>}
                            </div>
                            {parsedSlots.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {parsedSlots.map((s) => (
                                  <span key={s} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${SLOT_COLORS[s] ?? "bg-slate-100 text-slate-600"}`}>
                                    {SLOT_LABELS[s] ?? s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
