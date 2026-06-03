"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type FamilyMember = {
  id: string;
  member: { id: string; patientProfile: { fullName: string; uniquePatientId: string } | null };
};
type AccessOwner = {
  id: string;
  owner: { id: string; patientProfile: { fullName: string; uniquePatientId: string } | null };
};
type IncomingRequest = {
  id: string;
  owner: { id: string; patientProfile: { fullName: string; uniquePatientId: string } | null };
};

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

export default function PatientFamilyPage() {
  const { user } = useUser();
  const userId = user?.id;

  const [familyLinks, setFamilyLinks] = useState<FamilyMember[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [accessLinks, setAccessLinks] = useState<AccessOwner[]>([]);
  const [familyIdToAdd, setFamilyIdToAdd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    if (!userId) return;
    const [mineRes, incomingRes, accessRes] = await Promise.all([
      apiFetch<{ links: FamilyMember[] }>("/family/mine", { userId }),
      apiFetch<{ links: IncomingRequest[] }>("/family/requests/incoming", { userId }),
      apiFetch<{ links: AccessOwner[] }>("/family/access", { userId }),
    ]);
    if (mineRes.ok) setFamilyLinks(mineRes.links);
    if (incomingRes.ok) setIncoming(incomingRes.links);
    if (accessRes.ok) setAccessLinks(accessRes.links);
  }

  useEffect(() => { void load(); }, [userId]);

  async function onSendRequest() {
    if (!userId) return;
    setSaving(true); setError(null); setSuccess(null);
    const res = await apiFetch<{ link: { status: string } }>("/family/requests", {
      userId, method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uniquePatientId: familyIdToAdd.trim() }),
    });
    if (!res.ok) { setError("Failed to send request — check the ID"); setSaving(false); return; }
    setFamilyIdToAdd("");
    setSuccess(res.link.status === "ACCEPTED" ? "Already connected" : "Request sent! They need to accept it.");
    setSaving(false); await load();
  }

  async function onAccept(linkId: string) {
    if (!userId) return;
    setSaving(true); setError(null); setSuccess(null);
    const res = await apiFetch("/family/requests/" + encodeURIComponent(linkId) + "/accept", { userId, method: "POST" });
    if (!res.ok) { setError("Failed to accept"); setSaving(false); return; }
    setSuccess("Accepted!"); setSaving(false); await load();
  }

  async function onRemove(linkId: string) {
    if (!userId) return;
    setSaving(true); setError(null); setSuccess(null);
    const res = await apiFetch("/family/links/" + encodeURIComponent(linkId), { userId, method: "DELETE" });
    if (!res.ok) { setError("Failed to remove"); setSaving(false); return; }
    setSuccess("Removed"); setSaving(false); await load();
  }

  if (!userId) return <div className="text-sm text-slate-500">Sign in to manage family links.</div>;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Family</h1>
        <p className="mt-1 text-sm text-slate-500">Link family accounts to view their records and share on their behalf.</p>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">✓ {success}</div>}

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <Card className="mb-4 border-blue-200 bg-blue-50/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <CardTitle>Pending Requests</CardTitle>
            </div>
            <CardDescription>These people want access to your records.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-blue-100 rounded-xl border border-blue-200 overflow-hidden bg-white">
              {incoming.map((r) => {
                const name = r.owner.patientProfile?.fullName ?? "Patient";
                return (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold">{initials(name)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 truncate">{name}</div>
                      <div className="text-xs text-slate-400 truncate">{r.owner.patientProfile?.uniquePatientId}</div>
                    </div>
                    <Button size="sm" disabled={saving} onClick={() => onAccept(r.id)}>Accept</Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Add family member */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Add Family Member</CardTitle>
          <CardDescription>Enter their unique patient ID. They must accept your request.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input value={familyIdToAdd} onChange={(e) => setFamilyIdToAdd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSendRequest()} placeholder="ML-…" className="flex-1" />
            <Button disabled={!familyIdToAdd.trim() || saving} onClick={onSendRequest}>{saving ? "Sending…" : "Send request"}</Button>
          </div>
          <p className="mt-2 text-xs text-slate-400">They can find their ID in <Link href="/patient/profile" className="text-blue-600 hover:underline">Profile</Link>. After you send, they accept from this page.</p>
        </CardContent>
      </Card>

      {/* My family */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>My Family ({familyLinks.length})</CardTitle>
          <CardDescription>You can view their records and share on their behalf.</CardDescription>
        </CardHeader>
        <CardContent>
          {familyLinks.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-6">No family members yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
              {familyLinks.map((l) => {
                const name = l.member.patientProfile?.fullName ?? "Patient";
                return (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-xs font-semibold">{initials(name)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 truncate">{name}</div>
                      <div className="text-xs text-slate-400 truncate">{l.member.patientProfile?.uniquePatientId}</div>
                    </div>
                    <button onClick={() => onRemove(l.id)} disabled={saving} className="text-xs text-slate-400 hover:text-red-500 transition-colors">Remove</button>
                  </li>
                );
              })}
            </ul>
          )}
          {familyLinks.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">You&apos;ll see their records as tabs in <Link href="/patient/records" className="text-blue-600 hover:underline">Records</Link>.</p>
          )}
        </CardContent>
      </Card>

      {/* Who can access my records */}
      <Card>
        <CardHeader>
          <CardTitle>Access to My Records ({accessLinks.length})</CardTitle>
          <CardDescription>People you&apos;ve granted access to your records.</CardDescription>
        </CardHeader>
        <CardContent>
          {accessLinks.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-6">No one has access yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
              {accessLinks.map((l) => {
                const name = l.owner.patientProfile?.fullName ?? "Patient";
                return (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-semibold">{initials(name)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 truncate">{name}</div>
                      <div className="text-xs text-slate-400 truncate">{l.owner.patientProfile?.uniquePatientId}</div>
                    </div>
                    <button onClick={() => onRemove(l.id)} disabled={saving} className="text-xs text-slate-400 hover:text-red-500 transition-colors">Revoke</button>
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
