"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Role = "PATIENT" | "DOCTOR" | "HOSPITAL";
type Gender = "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
const ROLE_KEY = "medilink.signupRole";

const roleLabels: Record<Role, string> = { PATIENT: "Patient", DOCTOR: "Doctor", HOSPITAL: "Hospital" };
const roleBadge: Record<Role, string> = {
  PATIENT: "bg-blue-50 text-blue-700 border-blue-200",
  DOCTOR: "bg-indigo-50 text-indigo-700 border-indigo-200",
  HOSPITAL: "bg-teal-50 text-teal-700 border-teal-200",
};

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-900">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const selectCls =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:border-blue-400";

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const userId = user?.id;
  const primaryEmail = user?.primaryEmailAddress?.emailAddress;

  const [role, setRole] = useState<Role | null>(null);
  const [pFullName, setPFullName] = useState("");
  const [pGender, setPGender] = useState<Gender>("UNKNOWN");
  const [pDob, setPDob] = useState("");
  const [pAge, setPAge] = useState("");
  const [dFullName, setDFullName] = useState("");
  const [dSpecialty, setDSpecialty] = useState("");
  const [dLicense, setDLicense] = useState("");
  const [dEmail, setDEmail] = useState("");
  const [dPhone, setDPhone] = useState("");
  const [dGender, setDGender] = useState<Gender>("UNKNOWN");
  const [dDob, setDDob] = useState("");
  const [dAvatarUrl, setDAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const existing = window.localStorage.getItem(ROLE_KEY) as Role | null;
      if (existing === "PATIENT" || existing === "DOCTOR" || existing === "HOSPITAL") setRole(existing);
    } catch { /* ignore */ }
  }, []);

  const canSave = useMemo(() => {
    if (!role) return false;
    if (role === "PATIENT") return !!pFullName.trim();
    if (role === "DOCTOR") return !!dFullName.trim() && !!dSpecialty.trim();
    return true;
  }, [role, pFullName, dFullName, dSpecialty]);

  async function onSave() {
    if (!userId || !role) return;
    setSaving(true); setError(null);
    try {
      if (role === "PATIENT") {
        const dobIso = pDob ? new Date(pDob + "T00:00:00.000Z").toISOString() : undefined;
        const res = await apiFetch("/profiles/patient", {
          userId, method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName: pFullName, email: primaryEmail || undefined, gender: pGender, dob: dobIso, age: pAge ? Number(pAge) : undefined }),
        });
        if (!res.ok) throw new Error("Failed to save");
        router.push("/patient");
      } else if (role === "DOCTOR") {
        const dobIso = dDob ? new Date(dDob + "T00:00:00.000Z").toISOString() : undefined;
        const res = await apiFetch("/profiles/doctor", {
          userId, method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName: dFullName, specialty: dSpecialty, licenseNumber: dLicense || undefined, email: dEmail || undefined, phone: dPhone || undefined, gender: dGender, dob: dobIso, avatarUrl: dAvatarUrl || undefined }),
        });
        if (!res.ok) throw new Error("Failed to save");
        router.push("/doctor");
      } else {
        const res = await apiFetch("/profiles/hospital", { userId, method: "POST" });
        if (!res.ok) throw new Error("Failed to save");
        router.push("/hospital/lookup");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally { setSaving(false); }
  }

  if (!userId) return (
    <div className="min-h-dvh bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg text-center">
        <p className="text-slate-600">Please sign in to continue.</p>
        <Link href="/sign-in" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">Sign in →</Link>
      </div>
    </div>
  );

  if (!role) return (
    <div className="min-h-dvh bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg text-center">
        <p className="text-slate-600">Please choose a role first.</p>
        <Link href="/signup" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">Go to role selection →</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
      <header className="px-6 py-4">
        <Link href="/" className="font-bold text-xl tracking-tight">
          <span className="text-slate-900">Medi</span><span className="text-blue-600">Link</span>
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 py-10">
        <div className="w-full max-w-lg">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-lg shadow-slate-200/50">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-100">Step 2 of 2 — Your profile</span>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${roleBadge[role]}`}>{roleLabels[role]}</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">Complete your profile</h1>
            <p className="mt-1.5 text-sm text-slate-500">A few details to personalise your portal.</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {role === "PATIENT" && (<>
                <div className="sm:col-span-2">
                  <FieldRow label="Full name *">
                    <Input value={pFullName} onChange={(e) => setPFullName(e.target.value)} placeholder="e.g. Anika Sharma" />
                  </FieldRow>
                </div>
                <FieldRow label="Gender">
                  <select className={selectCls} value={pGender} onChange={(e) => setPGender(e.target.value as Gender)}>
                    <option value="UNKNOWN">Prefer not to say</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </FieldRow>
                <FieldRow label="Date of birth" hint="Optional — or provide age below">
                  <Input type="date" value={pDob} onChange={(e) => setPDob(e.target.value)} />
                </FieldRow>
                <div className="sm:col-span-2">
                  <FieldRow label="Age" hint="If both DOB and age are provided, age is used as-is">
                    <Input inputMode="numeric" value={pAge} onChange={(e) => setPAge(e.target.value)} placeholder="e.g. 28" />
                  </FieldRow>
                </div>
              </>)}

              {role === "DOCTOR" && (<>
                <div className="sm:col-span-2">
                  <FieldRow label="Full name *">
                    <Input value={dFullName} onChange={(e) => setDFullName(e.target.value)} placeholder="Dr. Arjun Mehta" />
                  </FieldRow>
                </div>
                <FieldRow label="Specialty *">
                  <Input value={dSpecialty} onChange={(e) => setDSpecialty(e.target.value)} placeholder="e.g. Cardiology" />
                </FieldRow>
                <FieldRow label="License number">
                  <Input value={dLicense} onChange={(e) => setDLicense(e.target.value)} placeholder="Optional" />
                </FieldRow>
                <FieldRow label="Email">
                  <Input value={dEmail} onChange={(e) => setDEmail(e.target.value)} placeholder="Optional" />
                </FieldRow>
                <FieldRow label="Phone">
                  <Input value={dPhone} onChange={(e) => setDPhone(e.target.value)} placeholder="Optional" />
                </FieldRow>
                <FieldRow label="Gender">
                  <select className={selectCls} value={dGender} onChange={(e) => setDGender(e.target.value as Gender)}>
                    <option value="UNKNOWN">Prefer not to say</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </FieldRow>
                <FieldRow label="Date of birth">
                  <Input type="date" value={dDob} onChange={(e) => setDDob(e.target.value)} />
                </FieldRow>
                <div className="sm:col-span-2">
                  <FieldRow label="Avatar URL">
                    <Input value={dAvatarUrl} onChange={(e) => setDAvatarUrl(e.target.value)} placeholder="https://… (optional)" />
                  </FieldRow>
                </div>
              </>)}

              {role === "HOSPITAL" && (
                <div className="sm:col-span-2">
                  <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-700">
                    Hospital accounts require no extra details in the prototype. Click Continue to activate your hospital portal.
                  </div>
                </div>
              )}
            </div>

            {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

            <div className="mt-6 flex items-center gap-3">
              <Button onClick={onSave} disabled={!canSave || saving} className="flex-1">
                {saving ? "Saving…" : "Continue →"}
              </Button>
              <Link href="/signup" className="text-sm text-slate-500 hover:text-blue-600 transition-colors">Change role</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
