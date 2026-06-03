"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

type VitalRecord = {
  id: string; recordedAt: string; createdAt: string;
  bpSystolic: number | null; bpDiastolic: number | null;
  bloodSugarFasting: number | null; bloodSugarPostMeal: number | null;
  heartRate: number | null; weight: number | null;
  temperature: number | null; oxygenSat: number | null;
  notes: string | null;
};

type Tab = "bp" | "sugar" | "heartRate" | "weight" | "all";
type Range = 7 | 30 | 90;

function fmt(dt: string) { try { return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); } catch { return dt; } }
function fmtFull(dt: string) { try { return new Date(dt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return dt; } }

const tabItems: { key: Tab; label: string }[] = [
  { key: "bp", label: "Blood Pressure" },
  { key: "sugar", label: "Blood Sugar" },
  { key: "heartRate", label: "Heart Rate" },
  { key: "weight", label: "Weight" },
  { key: "all", label: "Overview" },
];

const selectCls = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1";

function VitalChip({ label, value, unit, status }: { label: string; value: string; unit: string; status: "normal" | "warning" | "danger" | "unknown" }) {
  const colors = { normal: "bg-emerald-50 border-emerald-200 text-emerald-700", warning: "bg-amber-50 border-amber-200 text-amber-700", danger: "bg-red-50 border-red-200 text-red-700", unknown: "bg-slate-50 border-slate-200 text-slate-500" };
  return (
    <div className={`rounded-xl border p-3 ${colors[status]}`}>
      <div className="text-xs font-medium opacity-70 mb-1">{label}</div>
      <div className="text-lg font-bold leading-none">{value}<span className="text-xs font-normal ml-1 opacity-70">{unit}</span></div>
    </div>
  );
}

export default function PatientVitalsPage() {
  const { user } = useUser();
  const userId = user?.id;

  const [records, setRecords] = useState<VitalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("bp");
  const [range, setRange] = useState<Range>(30);
  const [showForm, setShowForm] = useState(false);

  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [bloodSugarFasting, setBloodSugarFasting] = useState("");
  const [bloodSugarPostMeal, setBloodSugarPostMeal] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [weight, setWeight] = useState("");
  const [temperature, setTemperature] = useState("");
  const [oxygenSat, setOxygenSat] = useState("");
  const [notes, setNotes] = useState("");
  const [recordedAt, setRecordedAt] = useState("");

  const loadVitals = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const res = await apiFetch<{ vitals: VitalRecord[] }>("/vitals", { userId });
    if (res.ok) setRecords(res.vitals);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void loadVitals(); }, [loadVitals]);

  const cutoff = new Date(Date.now() - range * 24 * 60 * 60 * 1000);
  const filtered = records.filter((r) => new Date(r.recordedAt) >= cutoff);
  const chartData = [...filtered].reverse().map((r) => ({
    date: fmt(r.recordedAt),
    systolic: r.bpSystolic, diastolic: r.bpDiastolic,
    fasting: r.bloodSugarFasting, postMeal: r.bloodSugarPostMeal,
    heartRate: r.heartRate, weight: r.weight,
  }));

  const latest = records[0];

  async function onSave() {
    if (!userId) return;
    setSaving(true); setError(null); setSuccess(null);
    const payload: Record<string, unknown> = {};
    if (recordedAt) payload.recordedAt = new Date(recordedAt).toISOString();
    if (bpSystolic) payload.bpSystolic = Number(bpSystolic);
    if (bpDiastolic) payload.bpDiastolic = Number(bpDiastolic);
    if (bloodSugarFasting) payload.bloodSugarFasting = Number(bloodSugarFasting);
    if (bloodSugarPostMeal) payload.bloodSugarPostMeal = Number(bloodSugarPostMeal);
    if (heartRate) payload.heartRate = Number(heartRate);
    if (weight) payload.weight = Number(weight);
    if (temperature) payload.temperature = Number(temperature);
    if (oxygenSat) payload.oxygenSat = Number(oxygenSat);
    if (notes) payload.notes = notes;

    const res = await apiFetch<{ vital: VitalRecord }>("/vitals", {
      userId, method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { setError("Failed to save"); setSaving(false); return; }
    setRecords((prev) => [res.vital, ...prev]);
    setBpSystolic(""); setBpDiastolic(""); setBloodSugarFasting(""); setBloodSugarPostMeal("");
    setHeartRate(""); setWeight(""); setTemperature(""); setOxygenSat(""); setNotes(""); setRecordedAt("");
    setSuccess("Vital logged!"); setShowForm(false); setSaving(false);
  }

  async function onDelete(id: string) {
    if (!userId || !confirm("Delete this reading?")) return;
    await apiFetch(`/vitals/${id}`, { userId, method: "DELETE" });
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Health Vitals</h1>
          <p className="mt-1 text-sm text-slate-500">Log and monitor your health metrics over time.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)} className="flex-shrink-0">
          {showForm ? "Cancel" : "+ Log Reading"}
        </Button>
      </div>

      {/* Log form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader><CardTitle>New Reading</CardTitle><CardDescription>Fill in one or more fields — all are optional.</CardDescription></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Date &amp; Time</label>
                <Input type="datetime-local" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">Leave blank to use current time</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">BP Systolic (mmHg)</label>
                <Input type="number" min={40} max={300} value={bpSystolic} onChange={(e) => setBpSystolic(e.target.value)} placeholder="e.g. 120" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">BP Diastolic (mmHg)</label>
                <Input type="number" min={20} max={200} value={bpDiastolic} onChange={(e) => setBpDiastolic(e.target.value)} placeholder="e.g. 80" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Blood Sugar — Fasting (mg/dL)</label>
                <Input type="number" min={0} max={2000} value={bloodSugarFasting} onChange={(e) => setBloodSugarFasting(e.target.value)} placeholder="e.g. 95" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Blood Sugar — Post-meal (mg/dL)</label>
                <Input type="number" min={0} max={2000} value={bloodSugarPostMeal} onChange={(e) => setBloodSugarPostMeal(e.target.value)} placeholder="e.g. 140" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Heart Rate (bpm)</label>
                <Input type="number" min={20} max={300} value={heartRate} onChange={(e) => setHeartRate(e.target.value)} placeholder="e.g. 72" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Weight (kg)</label>
                <Input type="number" min={0} max={500} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 65.5" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Temperature (°C)</label>
                <Input type="number" min={25} max={45} step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="e.g. 37.0" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">SpO2 (%)</label>
                <Input type="number" min={50} max={100} value={oxygenSat} onChange={(e) => setOxygenSat(e.target.value)} placeholder="e.g. 98" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Notes</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes about this reading…" />
              </div>
            </div>
            {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save Reading"}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {success && <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">✓ {success}</div>}

      {/* Latest readings chips */}
      {latest && (
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <VitalChip
            label="Blood Pressure" unit="mmHg"
            value={latest.bpSystolic && latest.bpDiastolic ? `${latest.bpSystolic}/${latest.bpDiastolic}` : "—"}
            status={latest.bpSystolic ? (latest.bpSystolic < 120 ? "normal" : latest.bpSystolic < 140 ? "warning" : "danger") : "unknown"}
          />
          <VitalChip
            label="Blood Sugar (F)" unit="mg/dL"
            value={latest.bloodSugarFasting ? String(latest.bloodSugarFasting) : "—"}
            status={latest.bloodSugarFasting ? (latest.bloodSugarFasting < 100 ? "normal" : latest.bloodSugarFasting < 126 ? "warning" : "danger") : "unknown"}
          />
          <VitalChip
            label="Heart Rate" unit="bpm"
            value={latest.heartRate ? String(latest.heartRate) : "—"}
            status={latest.heartRate ? (latest.heartRate >= 60 && latest.heartRate <= 100 ? "normal" : "warning") : "unknown"}
          />
          <VitalChip
            label="SpO2" unit="%"
            value={latest.oxygenSat ? String(latest.oxygenSat) : "—"}
            status={latest.oxygenSat ? (latest.oxygenSat >= 95 ? "normal" : latest.oxygenSat >= 90 ? "warning" : "danger") : "unknown"}
          />
        </div>
      )}

      {/* Charts */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap gap-1">
              {tabItems.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${tab === t.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Range:</span>
              {([7, 30, 90] as Range[]).map((r) => (
                <button key={r} onClick={() => setRange(r)} className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-all ${range === r ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200"}`}>{r}d</button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-48 text-sm text-slate-400">Loading chart…</div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-sm text-slate-400 gap-2">
              <span className="text-3xl">📊</span>
              No data for this range. Log a reading to see your trends.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              {tab === "bp" ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis domain={[40, 200]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={120} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "Normal", fontSize: 10, fill: "#22c55e" }} />
                  <ReferenceLine y={140} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "High", fontSize: 10, fill: "#f59e0b" }} />
                  <Line type="monotone" dataKey="systolic" name="Systolic" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="diastolic" name="Diastolic" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              ) : tab === "sugar" ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={100} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "Normal fast", fontSize: 10, fill: "#22c55e" }} />
                  <ReferenceLine y={140} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Normal post", fontSize: 10, fill: "#f59e0b" }} />
                  <Line type="monotone" dataKey="fasting" name="Fasting" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="postMeal" name="Post-meal" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              ) : tab === "heartRate" ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis domain={[40, 160]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <ReferenceLine y={60} stroke="#22c55e" strokeDasharray="4 4" />
                  <ReferenceLine y={100} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "Normal range", fontSize: 10, fill: "#22c55e" }} />
                  <Line type="monotone" dataKey="heartRate" name="Heart Rate (bpm)" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              ) : tab === "weight" ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Line type="monotone" dataKey="weight" name="Weight (kg)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="systolic" name="BP Systolic" stroke="#3b82f6" strokeWidth={1.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="heartRate" name="Heart Rate" stroke="#ef4444" strokeWidth={1.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="fasting" name="Sugar (F)" stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* History table */}
      <Card>
        <CardHeader><CardTitle>Reading History</CardTitle><CardDescription>All logged readings, most recent first.</CardDescription></CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">No readings yet. Click &ldquo;Log Reading&rdquo; to start.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">BP</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sugar (F/P)</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">HR</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Weight</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">SpO2</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Temp</th>
                    <th className="py-2.5 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, idx) => (
                    <tr key={r.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-50/50"}`}>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{fmtFull(r.recordedAt)}</td>
                      <td className="py-2.5 px-3 font-mono text-sm">{r.bpSystolic && r.bpDiastolic ? `${r.bpSystolic}/${r.bpDiastolic}` : "—"}</td>
                      <td className="py-2.5 px-3 font-mono text-sm">{r.bloodSugarFasting || r.bloodSugarPostMeal ? `${r.bloodSugarFasting ?? "—"} / ${r.bloodSugarPostMeal ?? "—"}` : "—"}</td>
                      <td className="py-2.5 px-3 font-mono text-sm">{r.heartRate ?? "—"}</td>
                      <td className="py-2.5 px-3 font-mono text-sm">{r.weight ? `${r.weight} kg` : "—"}</td>
                      <td className="py-2.5 px-3 font-mono text-sm">{r.oxygenSat ? `${r.oxygenSat}%` : "—"}</td>
                      <td className="py-2.5 px-3 font-mono text-sm">{r.temperature ? `${r.temperature}°C` : "—"}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button onClick={() => onDelete(r.id)} className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
