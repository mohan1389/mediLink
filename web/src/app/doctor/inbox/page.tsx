"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

type InboxItem = {
  id: string; message: string | null; createdAt: string;
  patient: { id: string; patientProfile: { fullName: string } | null };
  subjectPatient: { id: string; patientProfile: { fullName: string } | null } | null;
  files: Array<{ fileUpload: { id: string; originalName: string } }>;
};

function fmt(dt: string) { try { return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return dt; } }
function initials(name: string) { const p = name.trim().split(/\s+/); return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase(); }

export default function DoctorInboxPage() {
  const { user } = useUser();
  const userId = user?.id;
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const res = await apiFetch<{ inbox: InboxItem[] }>("/doctor/inbox", { userId });
      if (!res.ok) { setError("Failed to load inbox"); setLoading(false); return; }
      setInbox(res.inbox); setLoading(false);
    })();
  }, [userId]);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Patient Inbox</h1>
        <p className="mt-1 text-sm text-slate-500">Share requests from patients. Review their files and issue prescriptions.</p>
      </div>

      {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Loading inbox…</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!loading && inbox.length === 0 && (
        <div className="text-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 px-8">
          <div className="text-4xl mb-3">📬</div>
          <div className="font-semibold text-slate-700">No requests yet</div>
          <div className="text-sm text-slate-400 mt-1">When patients share records with you, they&apos;ll appear here.</div>
        </div>
      )}

      {inbox.length > 0 && (
        <ul className="space-y-3">
          {inbox.map((item) => {
            const subjectName = item.subjectPatient?.patientProfile?.fullName ?? item.patient.patientProfile?.fullName ?? "Patient";
            const senderName = item.patient.patientProfile?.fullName;
            const isOnBehalf = !!item.subjectPatient?.id && item.subjectPatient.id !== item.patient.id;
            return (
              <li key={item.id}>
                <Link href={`/doctor/inbox/${item.id}`} className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-150 group">
                  <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                    {initials(subjectName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{subjectName}</span>
                      {isOnBehalf && senderName && (
                        <span className="text-xs text-slate-400">via {senderName}</span>
                      )}
                    </div>
                    {item.message && (
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">{item.message}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                        {item.files.length} file{item.files.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-slate-400">{fmt(item.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-1.5 text-xs font-medium text-indigo-700 group-hover:bg-indigo-100 transition-colors">
                    Open
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
