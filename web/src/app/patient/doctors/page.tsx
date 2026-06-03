"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";

type Doctor = { userId: string; fullName: string; specialty: string; avatarUrl: string | null };

function initials(name: string) { const p = name.trim().split(/\s+/); return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase(); }

export default function PatientDoctorsPage() {
  const { user } = useUser();
  const userId = user?.id;
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [recentDoctors, setRecentDoctors] = useState<Doctor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const trimmed = query.trim();
  const showResults = trimmed.length > 0;
  const debouncedQuery = useMemo(() => trimmed, [trimmed]);

  useEffect(() => {
    if (!userId) return;
    (async () => { const res = await apiFetch<{ doctors: Doctor[] }>("/patients/me/recent-doctors", { userId }); if (res.ok) setRecentDoctors(res.doctors); })();
  }, [userId]);

  useEffect(() => {
    if (!showResults) { setDoctors([]); setError(null); abortRef.current?.abort(); return; }
    const controller = new AbortController(); abortRef.current?.abort(); abortRef.current = controller;
    const t = setTimeout(async () => {
      setLoading(true); setError(null);
      const res = await apiFetch<{ doctors: Doctor[] }>(`/doctors/search?q=${encodeURIComponent(debouncedQuery)}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!res.ok) { setError("Search failed"); setDoctors([]); setLoading(false); return; }
      setDoctors(res.doctors); setLoading(false);
    }, 250);
    return () => { clearTimeout(t); controller.abort(); };
  }, [debouncedQuery, showResults]);

  function DoctorCard({ d }: { d: Doctor }) {
    return (
      <Link href={`/patient/doctors/${d.userId}`} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50 transition-colors group">
        {d.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.avatarUrl} alt={d.fullName} className="h-10 w-10 rounded-full border border-slate-200 object-cover flex-shrink-0" />
        ) : (
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-semibold">
            {initials(d.fullName)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium text-slate-900 text-sm group-hover:text-blue-700 transition-colors truncate">{d.fullName}</div>
          <div className="text-xs text-slate-500 truncate">{d.specialty}</div>
        </div>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="flex-shrink-0 text-slate-300 group-hover:text-blue-500 transition-colors">
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Find a Doctor</h1>
        <p className="mt-1 text-sm text-slate-500">Search by name or specialty. Results appear instantly.</p>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-slate-400"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" /></svg>
          </div>
          <Input
            className="pl-9 pr-16"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search doctors by name or specialty…"
          />
          {query.trim() && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 transition-colors">Clear</button>
          )}
        </div>

        <div className="mt-4">
          {!showResults ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recent Doctors</div>
              </div>
              {recentDoctors.length === 0 ? (
                <p className="text-sm text-slate-400 py-3">No history yet. Search for a doctor above.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                  {recentDoctors.map((d) => <li key={d.userId}><DoctorCard d={d} /></li>)}
                </ul>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Results{!loading ? ` (${doctors.length})` : ""}
                </div>
                {loading && <div className="flex items-center gap-1.5 text-xs text-slate-400"><div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> Searching…</div>}
              </div>
              {error && <div className="text-sm text-red-500 py-2">{error}</div>}
              {doctors.length === 0 && !loading ? (
                <p className="text-sm text-slate-400 py-3">No doctors match &ldquo;{trimmed}&rdquo;.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                  {doctors.map((d) => <li key={d.userId}><DoctorCard d={d} /></li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-400 text-center">
        Tip: To appear in search, create a doctor account at{" "}
        <Link className="text-blue-500 hover:underline" href="/doctor/profile">Doctor &rsaquo; Profile</Link>
      </p>
    </div>
  );
}
