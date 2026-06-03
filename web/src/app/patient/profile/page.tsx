"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Gender = "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
type ProfileResponse = {
  user: {
    id: string; role: "PATIENT" | "DOCTOR" | "HOSPITAL";
    patientProfile: { fullName: string; email: string | null; phone: string | null; gender: Gender; dob: string | null; age: number | null; uniquePatientId: string } | null;
  } | null;
};

const selectCls = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:border-blue-400";

export default function PatientProfilePage() {
  const { user, isLoaded } = useUser();
  const userId = user?.id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Gender>("UNKNOWN");
  const [dob, setDob] = useState("");
  const [age, setAge] = useState("");
  const [uniquePatientId, setUniquePatientId] = useState("");

  const canUse = useMemo(() => isLoaded && !!userId, [isLoaded, userId]);

  useEffect(() => {
    if (!canUse) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await apiFetch<ProfileResponse>("/profiles/me", { userId });
      if (cancelled) return;
      if (!res.ok) { setError("Failed to load profile"); setLoading(false); return; }
      const p = res.user?.patientProfile;
      if (p) {
        setFullName(p.fullName ?? ""); setEmail(p.email ?? ""); setPhone(p.phone ?? "");
        setGender(p.gender ?? "UNKNOWN"); setDob(p.dob ? p.dob.slice(0, 10) : "");
        setAge(p.age ? String(p.age) : ""); setUniquePatientId(p.uniquePatientId);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [canUse, userId]);

  async function onSave() {
    if (!userId) return;
    setSaving(true); setError(null); setSuccess(null);
    const payload: Record<string, unknown> = { fullName, email: email.trim() || undefined, phone: phone.trim() || undefined, gender };
    if (dob) payload.dob = new Date(dob).toISOString();
    if (age) payload.age = Number(age);
    const res = await apiFetch<{ profile: { uniquePatientId: string } }>("/profiles/patient", {
      userId, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!res.ok) { setError("Failed to save"); setSaving(false); return; }
    setUniquePatientId(res.profile.uniquePatientId); setSuccess("Profile saved!"); setSaving(false);
  }

  async function copyId() {
    try { await navigator.clipboard.writeText(uniquePatientId); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Patient Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Basic information your doctor will see when you share records.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
          <CardDescription>Keep this accurate for smoother care and sharing.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Loading…</div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-slate-900">Full name *</label>
                <Input className="mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Anika Sharma" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Email</label>
                  <Input className="mt-1" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
                  <p className="mt-1 text-xs text-slate-400">Used for emergency notifications</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Phone</label>
                  <Input className="mt-1" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-900">Gender</label>
                  <select className={`mt-1 ${selectCls}`} value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                    <option value="UNKNOWN">Prefer not to say</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-900">Date of Birth</label>
                  <Input type="date" className="mt-1" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-900">Age</label>
                <Input inputMode="numeric" className="mt-1" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 28" />
                <p className="mt-1 text-xs text-slate-400">If both DOB and age provided, age is used as-is</p>
              </div>

              {uniquePatientId && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <div className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-1.5">Your Unique Patient ID</div>
                  <div className="flex items-center gap-3">
                    <code className="flex-1 font-mono text-sm font-semibold text-slate-900">{uniquePatientId}</code>
                    <button onClick={copyId} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors">
                      {copied ? "✓ Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-blue-500">Share this ID with hospitals or family members who need to look you up.</p>
                </div>
              )}

              {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
              {success && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">✓ {success}</div>}

              <Button onClick={onSave} disabled={!fullName || saving || !userId} className="w-fit">
                {saving ? "Saving…" : "Save profile"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
