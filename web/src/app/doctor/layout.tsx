import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Sidebar, IconDashboard, IconProfile, IconInbox } from "@/components/ui/sidebar";

type MeResponse = {
  user: { role: "PATIENT" | "DOCTOR" | "HOSPITAL"; doctorProfile: unknown | null } | null;
};

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const me = await apiFetch<MeResponse>("/profiles/me", { userId });
  if (!me.ok || !me.user || me.user.role !== "DOCTOR" || !me.user.doctorProfile) {
    redirect("/onboarding");
  }

  const navItems = [
    { href: "/doctor", label: "Dashboard", icon: <IconDashboard /> },
    { href: "/doctor/profile", label: "Profile", icon: <IconProfile /> },
    { href: "/doctor/inbox", label: "Inbox", icon: <IconInbox /> },
  ];

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <div className="fixed inset-y-0 left-0 z-30 flex">
        <Sidebar items={navItems} portalLabel="Doctor Portal" />
      </div>
      <main className="flex-1 min-w-0 ml-64">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
