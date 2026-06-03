import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Sidebar, IconLookup, IconPrescriptions } from "@/components/ui/sidebar";

type MeResponse = {
  user: { role: "PATIENT" | "DOCTOR" | "HOSPITAL" } | null;
};

export default async function HospitalLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const me = await apiFetch<MeResponse>("/profiles/me", { userId });
  if (!me.ok || !me.user || me.user.role !== "HOSPITAL") {
    redirect("/onboarding");
  }

  const navItems = [
    { href: "/hospital/lookup", label: "Patient Lookup", icon: <IconLookup /> },
    { href: "/hospital/prescriptions", label: "Prescriptions", icon: <IconPrescriptions /> },
  ];

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <div className="fixed inset-y-0 left-0 z-30 flex">
        <Sidebar items={navItems} portalLabel="Hospital Portal" />
      </div>
      <main className="flex-1 min-w-0 ml-64">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
