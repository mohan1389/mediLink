"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Gender = "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
type DoctorProfile = {
  userId: string; fullName: string; specialty: string; licenseNumber: string | null;
  email: string | null; phone: string | null; gender: Gender; dob: string | null; avatarUrl: string | null;
};

const selectCls = "mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:border-blue-400";

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

export default function DoctorProfilePage() {
  const { user } = useUser();
  const userId = user?.id;

  const [fullName, setFullName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Gender>("UNKNOWN");
  const [dob, setDob] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await apiFetch<{ user: { doctorProfile: DoctorProfile | null } | null }>("/profiles/me", { userId });
      if (cancelled) return;
      if (res.ok && res.user?.doctorProfile) {
        const p = res.user.doctorProfile;
        setFullName(p.fullName ?? ""); setSpecialty(p.specialty ?? "");
        setLicenseNumber(p.licenseNumber ?? ""); setEmail(p.email ?? "");
        setPhone(p.phone ?? ""); setGender(p.gender ?? "UNKNOWN");
        setDob(p.dob ? p.dob.slice(0, 10) : ""); setAvatarUrl(p.avatarUrl ?? "");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  async function onSave() {
    if (!userId) return;
    setSaving(true); setError(null); setSuccess(null);
    const dobIso = dob ? new Date(dob + "T00:00:00.000Z").toISOString() : undefined;
    const res = await apiFetch<{ doctor: DoctorProfile }>("/profiles/doctor", {
      userId, method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, specialty, licenseNumber: licenseNumber || undefined, email: email || undefined, phone: phone || undefined, gender, dob: dobIso, avatarUrl: avatarUrl || undefined }),
    });
    if (!res.ok) { setError("Failed to save profile"); setSaving(false); return; }
    setSuccess("Profile saved!"); setSaving(false);
  }

  if (!userId) return <div className="text-sm text-slate-500">Sign in to edit your profile.</div>;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Doctor Profile</h1>
        <p className="mt-1 text-sm text-slate-500">This information appears in patient search results and on your detail page.</p>
      </div>

      {/* Avatar preview */}
      {!loading && (
        <div className="mb-5 flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={fullName} className="h-16 w-16 rounded-full border-2 border-slate-200 object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold">
              {fullName ? initials(fullName) : "DR"}
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-slate-900">{fullName || "Your Name"}</div>
            <div className="text-xs text-slate-400 mt-0.5">{specialty || "Specialty"}</div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>Required: full name and specialty. All other fields are optional.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Loading…</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-900">Full name *</label>
                <Input className="mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. Arjun Mehta" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-900">Specialty *</label>
                <Input className="mt-1" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Cardiology" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-900">License number</label>
                <Input className="mt-1" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-900">Email</label>
                <Input className="mt-1" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-900">Phone</label>
                <Input className="mt-1" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-900">Gender</label>
                <select className={selectCls} value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                  <option value="UNKNOWN">Prefer not to say</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-900">Date of birth</label>
                <Input type="date" className="mt-1" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-900">Avatar URL</label>
                <Input className="mt-1" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://… (optional, used as your photo)" />
              </div>
            </div>
          )}

          {!loading && (
            <>
              {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
              {success && <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">✓ {success}</div>}
              <div className="mt-5 flex items-center gap-3">
                <Button onClick={onSave} disabled={saving || !fullName || !specialty}>
                  {saving ? "Saving…" : "Save Profile"}
                </Button>
                <span className="text-xs text-slate-400">* Required fields</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
