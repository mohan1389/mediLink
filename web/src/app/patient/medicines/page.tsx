"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DoseSlot = "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT" | "BEDTIME";

type PatientMedicine = {
  id: string;
  medicineName: string;
  dosageText: string;
  frequencyText: string | null;
  durationText: string | null;
  slotsJson: unknown;
  unitsPerDose: number;
  inventoryCount: number;
  active: boolean;
  updatedAt: string;
};

const SLOTS: { slot: DoseSlot; label: string; color: string; icon: string }[] = [
  { slot: "MORNING", label: "Morning", color: "bg-amber-50 border-amber-200 text-amber-700", icon: "☀️" },
  { slot: "AFTERNOON", label: "Afternoon", color: "bg-orange-50 border-orange-200 text-orange-700", icon: "🌤" },
  { slot: "EVENING", label: "Evening", color: "bg-violet-50 border-violet-200 text-violet-700", icon: "🌆" },
  { slot: "NIGHT", label: "Night", color: "bg-blue-50 border-blue-200 text-blue-700", icon: "🌙" },
  { slot: "BEDTIME", label: "Bedtime", color: "bg-slate-100 border-slate-200 text-slate-600", icon: "😴" },
];

const ALL_SLOTS = new Set<DoseSlot>(["MORNING", "AFTERNOON", "EVENING", "NIGHT", "BEDTIME"]);
function asSlots(v: unknown): DoseSlot[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x) as DoseSlot).filter((x) => ALL_SLOTS.has(x));
}

function startOfWeekLocal(d: Date): Date {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - diff);
  return out;
}
function addDaysLocal(d: Date, days: number): Date {
  const out = new Date(d); out.setDate(out.getDate() + days); return out;
}
function fmtDay(d: Date): string { return d.toLocaleDateString(undefined, { weekday: "short" }); }
function fmtMd(d: Date): string { return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }

const isToday = (d: Date) => {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

export default function PatientMedicinesPage() {
  const { user } = useUser();
  const userId = user?.id;

  const [medicines, setMedicines] = useState<PatientMedicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function reconcileAndLoad() {
    if (!userId) return;
    setError(null);
    const rec = await apiFetch<{ medicines: PatientMedicine[] }>("/medicines/reconcile", { userId, method: "POST" });
    if (!rec.ok) { setError("Failed to load medicines"); setLoading(false); return; }
    setMedicines(rec.medicines); setLoading(false);
  }

  useEffect(() => { void reconcileAndLoad(); }, [userId]);
  useEffect(() => {
    if (!userId) return;
    const id = window.setInterval(() => { void reconcileAndLoad(); }, 60_000);
    return () => window.clearInterval(id);
  }, [userId]);

  const weekDays = useMemo(() => {
    const start = startOfWeekLocal(new Date());
    return Array.from({ length: 7 }, (_, i) => addDaysLocal(start, i));
  }, []);

  const medsForSlot = useMemo(() => {
    const bySlot = new Map<DoseSlot, PatientMedicine[]>();
    for (const s of SLOTS) bySlot.set(s.slot, []);
    for (const m of medicines.filter((x) => x.active)) {
      const slots = asSlots(m.slotsJson);
      for (const s of slots) bySlot.get(s)?.push(m);
    }
    for (const s of SLOTS) bySlot.get(s.slot)?.sort((a, b) => a.medicineName.localeCompare(b.medicineName));
    return bySlot;
  }, [medicines]);

  async function adjust(medicineId: string, delta: number) {
    if (!userId) return;
    setSaving(true); setError(null); setSuccess(null);
    const res = await apiFetch<{ medicine: PatientMedicine }>(`/medicines/${encodeURIComponent(medicineId)}/adjust`, {
      userId, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delta }),
    });
    if (!res.ok) { setError("Failed to update inventory"); setSaving(false); return; }
    setMedicines((prev) => prev.map((m) => (m.id === medicineId ? res.medicine : m)));
    setSuccess("Updated"); setSaving(false);
  }

  if (!userId) return <div className="text-sm text-slate-500">Sign in to view medicines.</div>;

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Medicines</h1>
        <p className="mt-1 text-sm text-slate-500">Auto-populated from doctor prescriptions. Inventory decreases at scheduled dose times.</p>
      </div>

      {/* Weekly Schedule */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Weekly Schedule</CardTitle>
          <CardDescription>Medicines by time of day for this week. Today is highlighted.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Loading…</div>
          ) : medicines.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">
              <div className="text-3xl mb-2">💊</div>
              No medicines yet. Ask a doctor to add a prescription.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <div className="min-w-[800px]">
                {/* Header */}
                <div className="grid grid-cols-8 border-b border-slate-100 bg-slate-50">
                  <div className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</div>
                  {weekDays.map((d) => (
                    <div key={d.toISOString()} className={`px-3 py-2.5 ${isToday(d) ? "bg-blue-50" : ""}`}>
                      <div className={`text-xs font-semibold ${isToday(d) ? "text-blue-700" : "text-slate-700"}`}>{fmtDay(d)}</div>
                      <div className={`text-xs ${isToday(d) ? "text-blue-500" : "text-slate-400"}`}>{fmtMd(d)}</div>
                    </div>
                  ))}
                </div>
                {SLOTS.map((s) => {
                  const meds = medsForSlot.get(s.slot) ?? [];
                  return (
                    <div key={s.slot} className="grid grid-cols-8 border-b border-slate-50 last:border-0">
                      <div className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-r border-slate-100`}>
                        <span>{s.icon}</span>
                        <span className="text-slate-600">{s.label}</span>
                      </div>
                      {weekDays.map((d) => (
                        <div key={d.toISOString()} className={`px-2 py-2 ${isToday(d) ? "bg-blue-50/40" : ""}`}>
                          {meds.length === 0 ? (
                            <span className="text-xs text-slate-200">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {meds.map((m) => (
                                <span key={m.id} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium max-w-full truncate ${s.color}`}>
                                  {m.medicineName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventory */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>Adjust counts manually. Auto-decrements at dose times.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Loading…</div>
          ) : medicines.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-6">No medicines yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {medicines.map((m) => {
                const slots = asSlots(m.slotsJson);
                const low = m.inventoryCount <= 5;
                return (
                  <li key={m.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{m.medicineName}</span>
                        <Badge variant="blue" className="text-xs">{m.dosageText}</Badge>
                        {m.durationText && <Badge variant="secondary" className="text-xs">{m.durationText}</Badge>}
                      </div>
                      {slots.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {slots.map((s) => {
                            const si = SLOTS.find((sl) => sl.slot === s);
                            return si ? (
                              <span key={s} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${si.color}`}>
                                {si.icon} {si.label}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className={`min-w-[2rem] text-center text-sm font-bold ${low ? "text-red-600" : "text-slate-900"}`}>
                        {m.inventoryCount}
                        {low && <span className="ml-1 text-xs font-normal">(low)</span>}
                      </div>
                      <button onClick={() => adjust(m.id, -1)} disabled={saving} className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors text-sm">−</button>
                      <button onClick={() => adjust(m.id, +1)} disabled={saving} className="w-7 h-7 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 disabled:opacity-50 transition-colors text-sm">+</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
          {success && <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">✓ {success}</div>}

          <div className="mt-4 text-xs text-slate-400">
            Dose times: Morning 8:00 · Afternoon 13:00 · Evening 19:00 · Night 22:00 · Bedtime 23:00 UTC
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
