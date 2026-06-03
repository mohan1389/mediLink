"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Doctor = {
  userId: string; fullName: string; specialty: string;
  licenseNumber: string | null; email: string | null; phone: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN"; dob: string | null; avatarUrl: string | null;
};
type Upload = {
  id: string; category: "REPORT" | "SCAN_IMAGING" | "PRESCRIPTION" | "OTHER";
  originalName: string; mimeType: string; sizeBytes: number; createdAt: string;
};
type FamilyLink = { id: string; member: { id: string; patientProfile: { fullName: string; uniquePatientId: string } | null } };

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

const CATEGORY_ICON: Record<string, string> = { REPORT: "📄", SCAN_IMAGING: "🔬", PRESCRIPTION: "💊", OTHER: "📎" };
const CATEGORY_BADGE: Record<string, "blue" | "purple" | "green" | "secondary"> = {
  REPORT: "blue", SCAN_IMAGING: "purple", PRESCRIPTION: "green", OTHER: "secondary",
};

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

export default function DoctorDetailPage() {
  const params = useParams<{ doctorId: string }>();
  const doctorId = String(params.doctorId ?? "");
  const { user } = useUser();
  const userId = user?.id;

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [familyLinks, setFamilyLinks] = useState<FamilyLink[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);
  const profileTabs = useMemo(() => {
    if (!userId) return [];
    const tabs: { id: string; label: string }[] = [{ id: userId, label: "My records" }];
    for (const l of familyLinks) tabs.push({ id: l.member.id, label: l.member.patientProfile?.fullName ?? "Family" });
    return tabs;
  }, [familyLinks, userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await apiFetch<{ doctor: Doctor }>(`/doctors/${encodeURIComponent(doctorId)}`);
      if (cancelled) return;
      if (!res.ok) { setError("Doctor not found"); setLoading(false); return; }
      setDoctor(res.doctor); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [doctorId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setSelectedPatientId((prev) => prev ?? userId);
      const mineRes = await apiFetch<{ links: FamilyLink[] }>("/family/mine", { userId });
      if (!cancelled && mineRes.ok) setFamilyLinks(mineRes.links);
      const patientId = selectedPatientId ?? userId;
      const res = await apiFetch<{ uploads: Upload[] }>(`/patients/${encodeURIComponent(patientId)}/uploads`, { userId });
      if (cancelled) return;
      if (res.ok) setUploads(res.uploads);
    })();
    return () => { cancelled = true; };
  }, [userId, selectedPatientId]);

  useEffect(() => { setSelected({}); }, [selectedPatientId]);

  async function onShare() {
    if (!userId) return;
    setSaving(true); setError(null); setSuccess(null);
    const subjectPatientId = (selectedPatientId ?? userId) !== userId ? (selectedPatientId ?? undefined) : undefined;
    const res = await apiFetch<{ request: { id: string } }>("/share-requests", {
      userId, method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId, fileUploadIds: selectedIds, message: message || undefined, subjectPatientId }),
    });
    if (!res.ok) { setError("Failed to share"); setSaving(false); return; }
    setSuccess("✓ Shared with doctor! They'll see it in their inbox."); setSaving(false); setSelected({});
  }

  const toggleAll = () => {
    if (selectedIds.length === uploads.length) { setSelected({}); }
    else { setSelected(Object.fromEntries(uploads.map((u) => [u.id, true]))); }
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-slate-500"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Loading doctor…</div>;
  if (!doctor) return <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">Doctor not found.</div>;

  return (
    <div className="max-w-3xl">
      <Link href="/patient/doctors" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-5">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back to search
      </Link>

      {/* Doctor profile card */}
      <Card className="mb-5">
        <CardHeader>
          <div className="flex items-start gap-4">
            {doctor.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={doctor.avatarUrl} alt={doctor.fullName} className="h-16 w-16 rounded-full border-2 border-slate-200 object-cover flex-shrink-0" />
            ) : (
              <div className="flex-shrink-0 h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-lg font-bold">
                {initials(doctor.fullName)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl">{doctor.fullName}</CardTitle>
              <div className="mt-1.5">
                <Badge variant="blue">{doctor.specialty}</Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "License", value: doctor.licenseNumber ?? "—" },
              { label: "Phone", value: doctor.phone ?? "—" },
              { label: "Email", value: doctor.email ?? "—" },
              { label: "Gender", value: doctor.gender === "UNKNOWN" ? "—" : doctor.gender.charAt(0) + doctor.gender.slice(1).toLowerCase() },
            ].map((f) => (
              <div key={f.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{f.label}</div>
                <div className="text-sm font-medium text-slate-900">{f.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Share request card */}
      <Card>
        <CardHeader>
          <CardTitle>Share Records</CardTitle>
          <CardDescription>Select files to share with {doctor.fullName}. They&apos;ll appear in the doctor&apos;s inbox.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Profile tabs */}
          {profileTabs.length > 1 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sharing records for</div>
              <div className="flex flex-wrap gap-2">
                {profileTabs.map((t) => {
                  const active = (selectedPatientId ?? userId) === t.id;
                  return (
                    <button key={t.id} type="button" onClick={() => setSelectedPatientId(t.id)}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-medium border transition-all ${active ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Message */}
          <div className="mb-4">
            <label className="text-sm font-medium text-slate-900 block mb-1.5">Message (optional)</label>
            <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your symptoms or reason for sharing…" />
          </div>

          {/* File list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-slate-900">Select files to share</div>
              <div className="flex items-center gap-3">
                {uploads.length > 0 && (
                  <button type="button" onClick={toggleAll} className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
                    {selectedIds.length === uploads.length ? "Deselect all" : "Select all"}
                  </button>
                )}
                <Link href="/patient/records" className="text-xs text-slate-400 hover:text-blue-600 transition-colors">Upload more →</Link>
              </div>
            </div>

            {uploads.length === 0 ? (
              <div className="text-center rounded-xl border border-dashed border-slate-200 py-8 text-sm text-slate-400">
                No records yet. <Link href="/patient/records" className="text-blue-600 hover:underline">Upload records</Link> first.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                {uploads.map((u) => {
                  const isChecked = !!selected[u.id];
                  return (
                    <li key={u.id}
                      onClick={() => setSelected((prev) => ({ ...prev, [u.id]: !prev[u.id] }))}
                      className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors ${isChecked ? "bg-blue-50/70" : "hover:bg-slate-50"}`}
                    >
                      <div className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isChecked ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white"}`}>
                        {isChecked && <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-sm">
                        {CATEGORY_ICON[u.category] ?? "📎"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900 truncate">{u.originalName}</span>
                          <Badge variant={CATEGORY_BADGE[u.category] ?? "secondary"} className="text-xs flex-shrink-0">{u.category.replace("_", " ")}</Badge>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{bytes(u.sizeBytes)}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="mt-3 text-xs text-slate-500">{selectedIds.length} file{selectedIds.length !== 1 ? "s" : ""} selected</div>
          )}

          {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
          {success && <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">{success}</div>}

          <div className="mt-5">
            <Button onClick={onShare} disabled={saving || !userId || selectedIds.length === 0} className="w-full sm:w-auto">
              {saving ? "Sending…" : `Share ${selectedIds.length > 0 ? `${selectedIds.length} file${selectedIds.length !== 1 ? "s" : ""}` : "records"} with ${doctor.fullName}`}
            </Button>
          </div>

          {!userId && <p className="mt-2 text-xs text-slate-400">Sign in to share records.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
