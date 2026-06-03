import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  Sidebar,
  IconDashboard, IconProfile, IconDoctors, IconRecords,
  IconMedicines, IconVitals, IconFamily, IconEmergency,
} from "@/components/ui/sidebar";

type MeResponse = {
  user: { role: "PATIENT" | "DOCTOR" | "HOSPITAL"; patientProfile: unknown | null } | null;
};

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const me = await apiFetch<MeResponse>("/profiles/me", { userId });
  if (!me.ok || !me.user || me.user.role !== "PATIENT" || !me.user.patientProfile) {
    redirect("/onboarding");
  }

  const navItems = [
    { href: "/patient", label: "Dashboard", icon: <IconDashboard /> },
    { href: "/patient/profile", label: "Profile", icon: <IconProfile /> },
    { href: "/patient/doctors", label: "Doctors", icon: <IconDoctors /> },
    { href: "/patient/records", label: "Records", icon: <IconRecords /> },
    { href: "/patient/medicines", label: "Medicines", icon: <IconMedicines /> },
    { href: "/patient/vitals", label: "Vitals", icon: <IconVitals /> },
    { href: "/patient/family", label: "Family", icon: <IconFamily /> },
    { href: "/patient/emergency", label: "Emergency", icon: <IconEmergency /> },
  ];

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <div className="fixed inset-y-0 left-0 z-30 flex">
        <Sidebar items={navItems} portalLabel="Patient Portal" />
      </div>
      <main className="flex-1 min-w-0 ml-64">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
