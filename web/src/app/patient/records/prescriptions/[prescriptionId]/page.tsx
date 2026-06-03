"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

type Prescription = {
  id: string; createdAt: string; notes: string | null;
  doctor: { id: string; doctorProfile: { fullName: string; specialty: string } | null };
  items: Array<{ id: string; medicineName: string; dosage: string; frequency: string | null; duration: string | null; slots?: string | null }>;
};

function fmt(dt: string) { try { return new Date(dt).toLocaleString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return dt; } }
function initials(name: string) { const p = name.trim().split(/\s+/); return (p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : ""); }

const SLOT_LABELS: Record<string, string> = { MORNING: "Morning", AFTERNOON: "Afternoon", EVENING: "Evening", NIGHT: "Night", BEDTIME: "Bedtime" };
const SLOT_COLOR: Record<string, string> = { MORNING: "bg-amber-50 text-amber-700 border-amber-200", AFTERNOON: "bg-orange-50 text-orange-700 border-orange-200", EVENING: "bg-violet-50 text-violet-700 border-violet-200", NIGHT: "bg-blue-50 text-blue-700 border-blue-200", BEDTIME: "bg-slate-100 text-slate-600 border-slate-200" };

export default function PatientPrescriptionViewPage() {
  const params = useParams();
  const prescriptionId = String((params as any)?.prescriptionId ?? "");
  const searchParams = useSearchParams();
  const { user } = useUser();
  const userId = user?.id;
  const [item, setItem] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !prescriptionId) return;
    const patientId = searchParams.get("patientId") || userId;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      const res = await apiFetch<{ prescription: Prescription }>(`/patients/${encodeURIComponent(patientId)}/prescriptions/${encodeURIComponent(prescriptionId)}`, { userId });
      if (cancelled) return;
      if (!res.ok) { setError("Failed to load prescription"); setLoading(false); return; }
      setItem(res.prescription); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, prescriptionId, searchParams]);

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-center justify-between gap-4">
        <Link href="/patient/records" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back to Records
        </Link>
        {item && (
          <button onClick={() => window.print()} className="no-print inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="6,9 6,2 18,2 18,9"/><path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print / Save as PDF
          </button>
        )}
      </div>

      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Prescription</h1>
        <p className="mt-1 text-sm text-slate-500">Doctor-added prescription details.</p>
      </div>

      {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Loading…</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {item && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Doctor header */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                {initials(item.doctor.doctorProfile?.fullName ?? "D")}
              </div>
              <div>
                <div className="font-semibold text-slate-900">{item.doctor.doctorProfile?.fullName ?? "Doctor"}</div>
                {item.doctor.doctorProfile?.specialty && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 mt-1">
                    {item.doctor.doctorProfile.specialty}
                  </span>
                )}
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs text-slate-400">Issued on</div>
                <div className="text-sm font-medium text-slate-700 mt-0.5">{fmt(item.createdAt)}</div>
              </div>
            </div>
          </div>

          <div className="p-6">
            {item.notes && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1.5">Doctor&apos;s Notes</div>
                <p className="text-sm text-slate-700 leading-relaxed">{item.notes}</p>
              </div>
            )}

            <div className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Medicines</div>
            <div className="space-y-3">
              {item.items.map((it, idx) => {
                let parsedSlots: string[] = [];
                try { parsedSlots = it.slots ? JSON.parse(it.slots) : []; } catch { parsedSlots = []; }
                return (
                  <div key={it.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                          <span className="font-semibold text-slate-900">{it.medicineName}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          {it.dosage && <span className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-1"><strong className="text-slate-700">Dose:</strong> {it.dosage}</span>}
                          {it.duration && <span className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-1"><strong className="text-slate-700">Duration:</strong> {it.duration}</span>}
                          {it.frequency && parsedSlots.length === 0 && <span className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-1"><strong className="text-slate-700">Frequency:</strong> {it.frequency}</span>}
                        </div>
                      </div>
                    </div>
                    {parsedSlots.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {parsedSlots.map((slot) => (
                          <span key={slot} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${SLOT_COLOR[slot] ?? "bg-slate-100 text-slate-600"}`}>
                            {SLOT_LABELS[slot] ?? slot}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
