"use client";

import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { Button } from "@/components/ui/button";

const _ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: _ease } },
};

const stagger: Variants = {
  show: { transition: { staggerChildren: 0.1 } },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5 } },
};

const features = [
  {
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="8" y1="13" x2="16" y2="13" strokeLinecap="round" />
        <line x1="8" y1="17" x2="12" y2="17" strokeLinecap="round" />
      </svg>
    ),
    color: "bg-blue-50 text-blue-600",
    title: "Unified Records",
    desc: "Upload scans, lab reports, and prescriptions into one secure library. Everything in one place, always accessible.",
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    ),
    color: "bg-indigo-50 text-indigo-600",
    title: "Controlled Sharing",
    desc: "Share exactly the files you choose with your doctor. You decide what gets shared and when.",
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: "bg-emerald-50 text-emerald-600",
    title: "Health Monitoring",
    desc: "Log BP, blood sugar, heart rate, and more. Visualize trends with beautiful charts over time.",
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <line x1="9" y1="12" x2="15" y2="12" strokeLinecap="round" />
        <line x1="9" y1="16" x2="12" y2="16" strokeLinecap="round" />
      </svg>
    ),
    color: "bg-violet-50 text-violet-600",
    title: "Smart Prescriptions",
    desc: "Doctors issue structured prescriptions with dosage, timing, and duration. Patients track them automatically.",
  },
];

const steps = [
  { n: "01", title: "Create your profile", desc: "Sign up as a patient, doctor, or hospital. Set up your identity in under a minute." },
  { n: "02", title: "Upload & organise", desc: "Add reports, scans, and test results to your personal records library." },
  { n: "03", title: "Share with care teams", desc: "Send selected records to your doctor. They review files and add prescriptions." },
  { n: "04", title: "Monitor your health", desc: "Log vitals over time. Watch your BP and blood sugar trends on beautiful charts." },
];

const portals = [
  {
    role: "Patient",
    color: "from-blue-500 to-blue-700",
    badge: "bg-blue-100 text-blue-700",
    desc: "Your health, your control. Upload records, share with doctors, track vitals, and manage family members.",
    href: "/patient",
    items: ["Upload medical records", "Share with doctors", "Track vitals & history", "Manage family links"],
  },
  {
    role: "Doctor",
    color: "from-indigo-500 to-indigo-700",
    badge: "bg-indigo-100 text-indigo-700",
    desc: "Receive patient share requests, review files, and issue structured digital prescriptions.",
    href: "/doctor/inbox",
    items: ["View patient files", "Create prescriptions", "Structured medicine details", "Manage your profile"],
  },
  {
    role: "Hospital",
    color: "from-teal-500 to-teal-700",
    badge: "bg-teal-100 text-teal-700",
    desc: "Emergency patient lookup by unique ID. View records and prescriptions for immediate care.",
    href: "/hospital/lookup",
    items: ["Lookup by patient ID", "View records instantly", "Access prescriptions", "Emergency notifications"],
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-white">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-1 font-bold text-xl tracking-tight">
            <span className="text-slate-900">Medi</span>
            <span className="text-blue-600">Link</span>
          </Link>

          <div className="flex items-center gap-2">
            <Show when="signed-out">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Get started</Button>
              </Link>
            </Show>
            <Show when="signed-in">
              <Link href="/patient"><Button variant="ghost" size="sm">Patient</Button></Link>
              <Link href="/doctor/inbox"><Button variant="ghost" size="sm">Doctor</Button></Link>
              <Link href="/hospital/lookup"><Button variant="ghost" size="sm">Hospital</Button></Link>
              <div className="ml-1">
                <UserButton />
              </div>
            </Show>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden pt-20 pb-24 px-6">
          {/* Background gradient blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-blue-50 opacity-60 blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-50 opacity-50 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-4xl text-center">
            {/* Pill badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
              </span>
              Built for patients, doctors &amp; hospitals
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={stagger}
              initial="hidden"
              animate="show"
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.08]"
            >
              <motion.span variants={fadeUp} className="block">
                Your health history,
              </motion.span>
              <motion.span variants={fadeUp} className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                always in the right hands.
              </motion.span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.25 }}
              className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed"
            >
              MediLink is a secure medical records platform where patients control their data, doctors issue digital prescriptions, and care teams access what they need — instantly.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.35 }}
              className="mt-8 flex flex-col sm:flex-row justify-center gap-3"
            >
              <Show when="signed-out">
                <Link href="/signup">
                  <Button size="lg" className="px-8 text-base shadow-lg shadow-blue-200">
                    Create free account
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button size="lg" variant="outline" className="px-8 text-base">Sign in</Button>
                </Link>
              </Show>
              <Show when="signed-in">
                <Link href="/patient">
                  <Button size="lg" className="px-8 text-base shadow-lg shadow-blue-200">Go to your portal</Button>
                </Link>
              </Show>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={fadeIn}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.5 }}
              className="mt-14 flex flex-wrap justify-center gap-8"
            >
              {[
                { value: "3", label: "Portals" },
                { value: "100%", label: "Private & secure" },
                { value: "∞", label: "Records" },
                { value: "0", label: "Paperwork" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-3xl font-bold text-slate-900">{s.value}</div>
                  <div className="text-sm text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="py-20 px-6 bg-slate-50">
          <div className="mx-auto max-w-6xl">
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="text-center mb-14"
            >
              <motion.p variants={fadeUp} className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">
                Everything you need
              </motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
                Healthcare management, reimagined
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-4 text-slate-500 text-lg max-w-2xl mx-auto">
                From uploading a lab report to tracking your blood pressure daily — MediLink covers your entire health journey.
              </motion.p>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {features.map((f) => (
                <motion.div
                  key={f.title}
                  variants={fadeUp}
                  className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${f.color}`}>
                    {f.icon}
                  </div>
                  <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="py-20 px-6">
          <div className="mx-auto max-w-5xl">
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="text-center mb-14"
            >
              <motion.p variants={fadeUp} className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">
                Simple workflow
              </motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
                Up and running in minutes
              </motion.h2>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {steps.map((s) => (
                <motion.div
                  key={s.n}
                  variants={fadeUp}
                  className="relative text-center px-4"
                >
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-md shadow-blue-200">
                    {s.n}
                  </div>
                  <h3 className="font-semibold text-slate-900 text-base">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Portals ── */}
        <section className="py-20 px-6 bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="mx-auto max-w-6xl">
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="text-center mb-14"
            >
              <motion.p variants={fadeUp} className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-3">
                Three portals, one platform
              </motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Designed for everyone in the care chain
              </motion.h2>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="grid gap-6 lg:grid-cols-3"
            >
              {portals.map((p) => (
                <motion.div
                  key={p.role}
                  variants={fadeUp}
                  className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm hover:bg-white/10 transition-colors duration-200"
                >
                  <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold mb-4 ${p.badge}`}>
                    {p.role} Portal
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-5">{p.desc}</p>
                  <ul className="space-y-2.5 mb-6">
                    {p.items.map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-sm text-slate-200">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-blue-400 flex-shrink-0">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link href={p.href}>
                    <Button variant="outline" size="sm" className="w-full border-white/20 text-white bg-white/10 hover:bg-white/20">
                      Open {p.role} portal
                    </Button>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Vitals teaser ── */}
        <section className="py-20 px-6">
          <div className="mx-auto max-w-5xl">
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="flex flex-col lg:flex-row items-center gap-12"
            >
              <motion.div variants={fadeUp} className="flex-1">
                <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">Health monitoring</p>
                <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
                  Watch your vitals trend over time
                </h2>
                <p className="mt-4 text-slate-500 text-lg leading-relaxed">
                  Log your blood pressure, blood sugar, heart rate, and more. Our charts show you how your health evolves — so you can have informed conversations with your doctor.
                </p>
                <ul className="mt-6 space-y-3">
                  {["Blood pressure (systolic + diastolic)", "Blood sugar (fasting + post-meal)", "Heart rate, weight, SpO2", "Normal range reference zones on charts"].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-600">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="text-blue-600"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="flex-1 w-full max-w-sm lg:max-w-none"
              >
                {/* Decorative mock chart */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Blood Pressure</div>
                      <div className="text-xs text-slate-400">Last 7 days</div>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded-full" /> Systolic</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-400 inline-block rounded-full" /> Diastolic</span>
                    </div>
                  </div>
                  {/* Mock bars */}
                  <div className="flex items-end gap-2 h-28">
                    {[80, 65, 90, 70, 85, 60, 75].map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full rounded-t-sm bg-blue-500 opacity-80" style={{ height: `${h}%` }} />
                        <div className="w-full rounded-t-sm bg-indigo-400 opacity-60" style={{ height: `${h * 0.6}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-slate-400">
                    <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { label: "Latest BP", value: "118/76", color: "text-emerald-600" },
                      { label: "Heart rate", value: "72 bpm", color: "text-blue-600" },
                      { label: "SpO2", value: "98%", color: "text-indigo-600" },
                    ].map((m) => (
                      <div key={m.label} className="rounded-xl bg-slate-50 p-2.5 text-center">
                        <div className={`text-base font-bold ${m.color}`}>{m.value}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-indigo-600">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mx-auto max-w-3xl text-center"
          >
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Your health data, always ready
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-blue-100 text-lg leading-relaxed">
              Join MediLink today and take control of your medical records. It&apos;s free, secure, and designed for you.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Show when="signed-out">
                <Link href="/signup">
                  <Button size="lg" className="px-8 bg-white text-blue-700 hover:bg-blue-50 hover:from-white hover:to-white shadow-lg">
                    Create your account
                  </Button>
                </Link>
              </Show>
              <Show when="signed-in">
                <Link href="/patient">
                  <Button size="lg" className="px-8 bg-white text-blue-700 hover:bg-blue-50 hover:from-white hover:to-white shadow-lg">
                    Go to patient portal
                  </Button>
                </Link>
              </Show>
            </motion.div>
          </motion.div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 bg-white px-6 py-8">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="font-bold text-lg tracking-tight">
            <span className="text-slate-900">Medi</span>
            <span className="text-blue-600">Link</span>
          </Link>
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} MediLink · Prototype · Built for demonstration
          </p>
          <div className="flex gap-4 text-sm text-slate-500">
            <Link href="/signup" className="hover:text-blue-600 transition-colors">Sign up</Link>
            <Link href="/sign-in" className="hover:text-blue-600 transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
