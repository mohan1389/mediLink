import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

export default async function DoctorDashboardPage() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white shadow-md shadow-indigo-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-indigo-100 text-sm font-medium">Welcome, Doctor 👋</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Doctor Dashboard</h1>
            <p className="mt-1.5 text-indigo-100 text-sm max-w-md">
              Review patient-shared records and issue structured digital prescriptions from your inbox.
            </p>
          </div>
          <div className="hidden sm:flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 text-2xl flex-shrink-0">🩺</div>
        </div>
        <div className="mt-5 flex gap-2">
          <Link href="/doctor/inbox" className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
            Open inbox
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <Link href="/doctor/profile" className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
            Update profile
          </Link>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/doctor/inbox" className="flex items-center gap-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-5 hover:shadow-sm transition-shadow group">
          <div className="text-2xl">📬</div>
          <div>
            <div className="font-semibold text-slate-900 text-sm group-hover:text-indigo-700 transition-colors">Patient Inbox</div>
            <div className="text-xs text-slate-500 mt-0.5">Review files &amp; issue prescriptions</div>
          </div>
        </Link>
        <Link href="/doctor/profile" className="flex items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 hover:shadow-sm transition-shadow group">
          <div className="text-2xl">👤</div>
          <div>
            <div className="font-semibold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">Doctor Profile</div>
            <div className="text-xs text-slate-500 mt-0.5">Update specialty &amp; contact info</div>
          </div>
        </Link>
      </div>

      {/* Session info */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" strokeLinecap="round" /></svg>
          </div>
          <div>
            <p className="text-xs text-slate-400">Signed in as</p>
            <p className="font-mono text-xs text-slate-600">{userId}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
