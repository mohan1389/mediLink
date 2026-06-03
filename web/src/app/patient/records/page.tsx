"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Upload = { id: string; category: "REPORT" | "SCAN_IMAGING" | "PRESCRIPTION" | "OTHER"; originalName: string; mimeType: string; sizeBytes: number; createdAt: string };
type Prescription = { id: string; createdAt: string; notes: string | null; doctor: { id: string; doctorProfile: { fullName: string; specialty: string } | null }; items: Array<{ id: string; medicineName: string; dosage: string; frequency: string | null; duration: string | null }> };
type FamilyLink = { id: string; member: { id: string; patientProfile: { fullName: string; uniquePatientId: string } | null } };

function bytes(n: number) { if (n < 1024) return `${n} B`; const kb = n / 1024; if (kb < 1024) return `${kb.toFixed(1)} KB`; return `${(kb / 1024).toFixed(1)} MB`; }
function fmt(dt: string) { try { return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return dt; } }

const categoryIcon: Record<string, string> = { REPORT: "📄", SCAN_IMAGING: "🔬", PRESCRIPTION: "💊", OTHER: "📎" };
const categoryBadge: Record<string, "blue" | "purple" | "green" | "secondary"> = { REPORT: "blue", SCAN_IMAGING: "purple", PRESCRIPTION: "green", OTHER: "secondary" };

export default function PatientRecordsPage() {
  const { user } = useUser();
  const userId = user?.id;

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [familyLinks, setFamilyLinks] = useState<FamilyLink[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [category, setCategory] = useState<Upload["category"]>("REPORT");
  const [file, setFile] = useState<File | null>(null);
  const [filter, setFilter] = useState<"ALL" | Upload["category"]>("ALL");
  const [sortOrder, setSortOrder] = useState<"NEWEST" | "OLDEST">("NEWEST");

  async function loadFamily() { if (!userId) return; const res = await apiFetch<{ links: FamilyLink[] }>("/family/mine", { userId }); if (res.ok) setFamilyLinks(res.links); }

  async function loadRecords(patientId: string) {
    if (!userId) return;
    setLoading(true); setError(null);
    const [ur, pr] = await Promise.all([
      apiFetch<{ uploads: Upload[] }>(`/patients/${encodeURIComponent(patientId)}/uploads`, { userId }),
      apiFetch<{ prescriptions: Prescription[] }>(`/patients/${encodeURIComponent(patientId)}/prescriptions`, { userId }),
    ]);
    if (!ur.ok || !pr.ok) { setError("Failed to load records"); setLoading(false); return; }
    setUploads(ur.uploads); setPrescriptions(pr.prescriptions); setLoading(false);
  }

  useEffect(() => { if (!userId) return; setSelectedPatientId((p) => p ?? userId); void loadFamily(); void loadRecords(userId); }, [userId]);
  useEffect(() => { if (!userId) return; void loadRecords(selectedPatientId ?? userId); }, [selectedPatientId]);

  async function onUpload() {
    if (!userId || !file) return;
    setSaving(true); setError(null); setSuccess(null);
    const fd = new FormData(); fd.append("file", file); fd.append("category", category);
    const res = await apiFetch<{ upload: Upload }>("/uploads", { userId, method: "POST", body: fd });
    if (!res.ok) { setError("Upload failed"); setSaving(false); return; }
    setUploads((p) => [res.upload, ...p]); setFile(null); setSuccess("Uploaded successfully!"); setSaving(false);
  }

  const profileTabs = useMemo(() => {
    if (!userId) return [];
    const tabs = [{ id: userId, label: "My records" }];
    for (const l of familyLinks) tabs.push({ id: l.member.id, label: l.member.patientProfile?.fullName ?? "Family" });
    return tabs;
  }, [familyLinks, userId]);

  const isMe = (selectedPatientId ?? userId) === userId;

  if (!userId) return <div className="text-sm text-slate-500">Sign in to manage records.</div>;
  if (loading) return <div className="flex items-center gap-2 text-sm text-slate-500"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Loading records…</div>;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Records</h1>
        <p className="mt-1 text-sm text-slate-500">Your reports, scans, and doctor-added prescriptions.</p>
      </div>

      {profileTabs.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {profileTabs.map((t) => {
            const active = (selectedPatientId ?? userId) === t.id;
            return <button key={t.id} type="button" onClick={() => setSelectedPatientId(t.id)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all border ${active ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}>{t.label}</button>;
          })}
        </div>
      )}

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Upload card */}
      <Card className="mb-5">
        <CardHeader><CardTitle>Upload a Record</CardTitle><CardDescription>Add a new file to your records library.</CardDescription></CardHeader>
        <CardContent>
          {!isMe ? (
            <p className="text-sm text-slate-500">Switch to &ldquo;My records&rdquo; to upload.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {(["REPORT", "SCAN_IMAGING", "PRESCRIPTION", "OTHER"] as const).map((c) => (
                    <button key={c} type="button" onClick={() => setCategory(c)} className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${category === c ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}>
                      {categoryIcon[c]} {c.charAt(0) + c.slice(1).toLowerCase().replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-300 transition-colors">
                <div className="text-2xl mb-2">📎</div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Choose file</label>
                <input type="file" className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 transition-colors" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                {file && <p className="mt-2 text-xs text-blue-600 font-medium">{file.name}</p>}
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={onUpload} disabled={!file || saving}>{saving ? "Uploading…" : "Upload"}</Button>
                {success && <span className="text-sm text-emerald-600 font-medium">✓ {success}</span>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Records list */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle>Your Items</CardTitle><CardDescription>Uploads and doctor-added prescriptions.</CardDescription></div>
            <div className="flex flex-wrap items-center gap-2">
              {(["ALL", "REPORT", "SCAN_IMAGING", "PRESCRIPTION", "OTHER"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${filter === f ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"}`}>
                  {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase().replace("_", " ")}
                </button>
              ))}
              <select className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "NEWEST" | "OLDEST")}>
                <option value="NEWEST">Newest</option>
                <option value="OLDEST">Oldest</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const generatedIds = new Set(uploads.filter((u) => u.category === "PRESCRIPTION" && u.mimeType === "text/html" && u.originalName.startsWith("Prescription_")).map((u) => { const parts = u.originalName.split("_"); return (parts[parts.length - 1] ?? "").replace(".html", ""); }));
            const prescriptionItems = prescriptions.filter((p) => !generatedIds.has(p.id)).map((p) => ({ kind: "prescription" as const, id: p.id, category: "PRESCRIPTION" as const, title: `Prescription · ${p.doctor.doctorProfile?.fullName ?? "Doctor"}`, meta: `${p.doctor.doctorProfile?.specialty ?? ""} · ${fmt(p.createdAt)}`, createdAt: p.createdAt }));
            const uploadItems = uploads.map((u) => ({ kind: "upload" as const, id: u.id, upload: u, category: u.category, title: u.category === "PRESCRIPTION" && u.mimeType === "text/html" && u.originalName.startsWith("Prescription_") ? "Prescription (doctor-added)" : u.originalName, meta: `${bytes(u.sizeBytes)} · ${fmt(u.createdAt)}`, createdAt: u.createdAt }));
            const filtered = [...uploadItems, ...prescriptionItems].filter((it) => filter === "ALL" || it.category === filter).sort((a, b) => { const d = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); return sortOrder === "NEWEST" ? d : -d; });

            if (filtered.length === 0) return <div className="text-center py-10 text-sm text-slate-400">No items yet. Upload your first record above.</div>;

            return (
              <ul className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <li key={`${item.kind}:${item.id}`} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-base">
                      {categoryIcon[item.category]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900 truncate">{item.title}</span>
                        <Badge variant={categoryBadge[item.category] ?? "secondary"} className="text-xs">{item.category.replace("_", " ")}</Badge>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{item.meta}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.kind === "prescription" ? (
                        <Link href={`/patient/records/prescriptions/${item.id}?patientId=${encodeURIComponent(selectedPatientId ?? userId)}`} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors">
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          View
                        </Link>
                      ) : (
                        <>
                          {(item.upload.mimeType === "text/html" || item.upload.mimeType === "application/pdf" || item.upload.mimeType.startsWith("image/")) && (
                            <a href={`/api/files/${item.upload.id}/view`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors">
                              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              View
                            </a>
                          )}
                          <a href={`/api/files/${item.upload.id}/download`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors">
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Download
                          </a>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
