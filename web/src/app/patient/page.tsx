import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

const quickActions = [
  { href: "/patient/profile", label: "Profile", desc: "Update your personal info", icon: "👤", bg: "bg-blue-50", border: "border-blue-100", icon_color: "text-blue-600" },
  { href: "/patient/doctors", label: "Find a Doctor", desc: "Search & share records", icon: "🩺", bg: "bg-indigo-50", border: "border-indigo-100", icon_color: "text-indigo-600" },
  { href: "/patient/records", label: "Records", desc: "Upload & view your files", icon: "📁", bg: "bg-violet-50", border: "border-violet-100", icon_color: "text-violet-600" },
  { href: "/patient/vitals", label: "Vitals", desc: "Log & track your health", icon: "📈", bg: "bg-emerald-50", border: "border-emerald-100", icon_color: "text-emerald-600" },
  { href: "/patient/medicines", label: "Medicines", desc: "Current prescriptions", icon: "💊", bg: "bg-amber-50", border: "border-amber-100", icon_color: "text-amber-600" },
  { href: "/patient/family", label: "Family", desc: "Manage family members", icon: "👨‍👩‍👦", bg: "bg-pink-50", border: "border-pink-100", icon_color: "text-pink-600" },
];

export default async function PatientDashboardPage() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col gap-6">
      {/* Hero welcome card */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-md shadow-blue-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-blue-100 text-sm font-medium">Welcome back 👋</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Patient Dashboard</h1>
            <p className="mt-1.5 text-blue-100 text-sm max-w-md">
              Manage your medical records, track your health vitals, and stay connected with your care team.
            </p>
          </div>
          <div className="hidden sm:flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm text-2xl flex-shrink-0">
            🏥
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/patient/records"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 text-sm font-medium text-white backdrop-blur-sm"
          >
            Upload record
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <Link
            href="/patient/vitals"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 text-sm font-medium text-white backdrop-blur-sm"
          >
            Log vitals
          </Link>
        </div>
      </div>

      {/* Quick actions grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick access</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`flex items-center gap-4 rounded-xl border ${a.border} ${a.bg} p-4 hover:shadow-sm transition-shadow duration-150 group`}
            >
              <div className={`flex-shrink-0 w-11 h-11 rounded-xl bg-white flex items-center justify-center text-xl shadow-sm`}>
                {a.icon}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">{a.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{a.desc}</div>
              </div>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="ml-auto flex-shrink-0 text-slate-300 group-hover:text-blue-500 transition-colors">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" strokeLinecap="round" /></svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Signed in as</p>
            <p className="font-mono text-xs text-slate-600 truncate">{userId}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
