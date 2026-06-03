"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Prescription = {
  id: string;
  createdAt: string;
  notes: string | null;
  patient: {
    id: string;
    patientProfile: {
      fullName: string;
      uniquePatientId: string;
    } | null;
  };
  doctor: {
    id: string;
    doctorProfile: {
      fullName: string;
      specialty: string;
    } | null;
  };
  items: Array<{
    id: string;
    medicineName: string;
    dosage: string;
    frequency: string | null;
    duration: string | null;
  }>;
};

type PrescriptionResponse = { prescription: Prescription };

function fmt(dt: string): string {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export default function HospitalPrescriptionViewPage() {
  const params = useParams();
  const prescriptionId = String((params as any)?.prescriptionId ?? "");

  const { user } = useUser();
  const userId = user?.id;

  const [item, setItem] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !prescriptionId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const res = await apiFetch<PrescriptionResponse>(`/hospital/prescriptions/${prescriptionId}`, { userId });
      if (cancelled) return;

      if (!res.ok) {
        setError("Failed to load prescription");
        setLoading(false);
        return;
      }

      setItem(res.prescription);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, prescriptionId]);

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <Link
          href="/hospital/lookup"
          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          ← Back to lookup
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Prescription</h1>
      <p className="mt-2 text-sm text-slate-600">Prescription details (hospital demo view).</p>

      {!userId ? <div className="mt-6 text-sm text-slate-600">Sign in to view this prescription.</div> : null}
      {loading ? <div className="mt-6 text-sm text-slate-600">Loading…</div> : null}
      {error ? <div className="mt-6 text-sm text-red-600">{error}</div> : null}

      {item ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{item.patient.patientProfile?.fullName ?? "Patient"}</CardTitle>
            <CardDescription>
              {item.patient.patientProfile?.uniquePatientId
                ? `${item.patient.patientProfile.uniquePatientId} • `
                : ""}
              {fmt(item.createdAt)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-slate-700">
              Doctor: <span className="font-medium">{item.doctor.doctorProfile?.fullName ?? "Doctor"}</span>
              {item.doctor.doctorProfile?.specialty ? ` • ${item.doctor.doctorProfile.specialty}` : ""}
            </div>

            {item.notes ? (
              <div className="mt-3 rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">{item.notes}</div>
            ) : null}

            <div className="mt-4 overflow-x-auto rounded-lg border">
              <table className="w-full min-w-180 border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Medicine</th>
                    <th className="px-3 py-2">Dosage</th>
                    <th className="px-3 py-2">Frequency</th>
                    <th className="px-3 py-2">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {item.items.map((it) => (
                    <tr key={it.id} className="border-t">
                      <td className="px-3 py-2 text-slate-900">{it.medicineName}</td>
                      <td className="px-3 py-2 text-slate-900">{it.dosage}</td>
                      <td className="px-3 py-2 text-slate-900">{it.frequency ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-900">{it.duration ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
