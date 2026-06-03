"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type FamilyAccessLink = {
  id: string; emergencyNotify: boolean;
  owner: { id: string; patientProfile: { fullName: string; uniquePatientId: string; email: string | null } | null };
};
type EmergencyContact = {
  id: string; kind: "USER" | "EMAIL"; label: string | null; email: string | null;
  contactUser: { id: string; patientProfile: { fullName: string; uniquePatientId: string; email: string | null } | null } | null;
};

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

export default function PatientEmergencyPage() {
  const { user } = useUser();
  const userId = user?.id;

  const [familyAccess, setFamilyAccess] = useState<FamilyAccessLink[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [patientIdToAdd, setPatientIdToAdd] = useState("");
  const [labelToAdd, setLabelToAdd] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    if (!userId) return;
    setLoading(true); setError(null);
    const res = await apiFetch<{ familyAccess: FamilyAccessLink[]; contacts: EmergencyContact[] }>("/emergency/contacts", { userId });
    if (!res.ok) { setError("Failed to load emergency contacts"); setLoading(false); return; }
    setFamilyAccess(res.familyAccess); setContacts(res.contacts); setLoading(false);
  }

  useEffect(() => { void load(); }, [userId]);

  async function onToggleFamily(linkId: string, enabled: boolean) {
    if (!userId) return;
    setSaving(true); setError(null); setSuccess(null);
    const res = await apiFetch<{ link: FamilyAccessLink }>(`/emergency/family-links/${encodeURIComponent(linkId)}`, {
      userId, method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }),
    });
    if (!res.ok) { setError("Failed to update"); setSaving(false); return; }
    setFamilyAccess((prev) => prev.map((l) => (l.id === linkId ? { ...l, emergencyNotify: enabled } : l)));
    setSuccess("Updated"); setSaving(false);
  }

  async function onAddContact() {
    if (!userId) return;
    setSaving(true); setError(null); setSuccess(null);
    const res = await apiFetch("/emergency/contacts", {
      userId, method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uniquePatientId: patientIdToAdd.trim(), label: labelToAdd.trim() || undefined }),
    });
    if (!res.ok) { setError("Failed to add — check the patient ID"); setSaving(false); return; }
    setPatientIdToAdd(""); setLabelToAdd(""); setSuccess("Added!"); setSaving(false); await load();
  }

  async function onRemoveContact(contactId: string) {
    if (!userId) return;
    setSaving(true); setError(null); setSuccess(null);
    await apiFetch(`/emergency/contacts/${encodeURIComponent(contactId)}`, { userId, method: "DELETE" });
    setSuccess("Removed"); setSaving(false); await load();
  }

  if (!userId) return <div className="text-sm text-slate-500">Sign in to manage emergency contacts.</div>;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Emergency Contacts</h1>
        <p className="mt-1 text-sm text-slate-500">When a hospital looks up your patient ID, these people will be notified by email.</p>
      </div>

      {/* Warning */}
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
        <div className="text-amber-500 flex-shrink-0 mt-0.5">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <p className="text-sm text-amber-700">Notifications are sent only if the contact has an email saved in their MediLink profile.</p>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">✓ {success}</div>}

      {/* Family with notify toggle */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Family with Record Access</CardTitle>
          <CardDescription>Toggle whether they receive emergency emails when your ID is looked up.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Loading…</div>
          ) : familyAccess.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-4">No family members with access yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
              {familyAccess.map((l) => {
                const name = l.owner.patientProfile?.fullName ?? "Patient";
                return (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold">{initials(name)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 truncate">{name}</div>
                      <div className="text-xs text-slate-400 truncate">{l.owner.patientProfile?.email ?? "No email on file"}</div>
                    </div>
                    <button
                      disabled={saving}
                      onClick={() => onToggleFamily(l.id, !l.emergencyNotify)}
                      className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${l.emergencyNotify ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${l.emergencyNotify ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {l.emergencyNotify ? "Notify: On" : "Notify: Off"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Add additional contacts */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Contacts</CardTitle>
          <CardDescription>Add family members by patient ID (they don&apos;t need record access).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Patient ID *</label>
              <Input value={patientIdToAdd} onChange={(e) => setPatientIdToAdd(e.target.value)} placeholder="ML-…" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Label (optional)</label>
              <Input value={labelToAdd} onChange={(e) => setLabelToAdd(e.target.value)} placeholder="e.g. Mom, Spouse" />
            </div>
          </div>
          <Button disabled={saving || !patientIdToAdd.trim()} onClick={onAddContact}>{saving ? "Adding…" : "Add Contact"}</Button>

          {contacts.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
              {contacts.map((c) => {
                const title = c.kind === "EMAIL" ? c.email ?? "Email" : c.contactUser?.patientProfile?.fullName ?? "Patient";
                const meta = c.kind !== "EMAIL" ? [c.contactUser?.patientProfile?.uniquePatientId ?? "", c.contactUser?.patientProfile?.email ?? ""].filter(Boolean).join(" · ") : null;
                return (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
                      {c.kind === "EMAIL" ? "✉" : initials(title)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 truncate">{c.label ? `${c.label} — ` : ""}{title}</div>
                      {meta && <div className="text-xs text-slate-400 truncate">{meta}</div>}
                    </div>
                    <button onClick={() => onRemoveContact(c.id)} disabled={saving} className="text-xs text-slate-400 hover:text-red-500 transition-colors">Remove</button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
