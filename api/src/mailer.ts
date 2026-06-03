import nodemailer from "nodemailer";

type MailConfig = {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  secure: boolean;
  from: string;
};

type ParsedFrom = { name?: string; email: string };

function parseFrom(from: string): ParsedFrom | null {
  const raw = from.trim();
  if (!raw) return null;

  const angleMatch = raw.match(/^\s*(?:"?([^"<]*)"?\s*)?<\s*([^>\s]+)\s*>\s*$/);
  if (angleMatch) {
    const name = angleMatch[1]?.trim() || undefined;
    const email = angleMatch[2]?.trim();
    if (!email) return null;
    return { name, email };
  }

  // Fallback: treat it as an email address.
  return { email: raw };
}

function getBrevoApiKey(): string | null {
  let key = process.env.BREVO_API_KEY?.trim();
  if (!key) return null;

  // Tolerate accidental quoting in env vars (e.g. "abc" or 'abc').
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }

  return key ? key : null;
}

async function sendViaBrevoApi(args: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
}): Promise<void> {
  const sender = parseFrom(args.from);
  if (!sender) throw new Error("Invalid SMTP_FROM format");

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": args.apiKey,
    },
    body: JSON.stringify({
      sender: { email: sender.email, ...(sender.name ? { name: sender.name } : {}) },
      to: args.to.map((email) => ({ email })),
      subject: args.subject,
      textContent: args.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo API failed: ${res.status} ${res.statusText}${body ? ` - ${body.slice(0, 500)}` : ""}`);
  }
}

function getMailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const from = process.env.SMTP_FROM;

  if (!host || !portRaw || !from) return null;

  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) return null;

  const secure = String(process.env.SMTP_SECURE ?? "").toLowerCase() === "true";

  return {
    host,
    port,
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    secure,
    from,
  };
}

let cachedTransport: nodemailer.Transporter | null = null;
let cachedConfigKey: string | null = null;

function getTransport(config: MailConfig): nodemailer.Transporter {
  const key = `${config.host}:${config.port}:${config.secure}:${config.user ?? ""}`;
  if (cachedTransport && cachedConfigKey === key) return cachedTransport;

  cachedConfigKey = key;
  cachedTransport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
  });

  return cachedTransport;
}

export async function sendEmergencyLookupEmail(args: {
  to: string[];
  patientName: string;
  uniquePatientId: string;
  hospitalUserId: string;
  occurredAtIso: string;
}): Promise<{ sent: number; mode: "smtp" | "log" }> {
  const to = Array.from(new Set(args.to.map((e) => e.trim().toLowerCase()).filter(Boolean)));
  if (to.length === 0) {
    // eslint-disable-next-line no-console
    console.log("[mail:skip]", { reason: "no_recipients", patient: args.uniquePatientId });
    return { sent: 0, mode: "log" };
  }

  const subject = `MediLink alert: hospital accessed ${args.patientName}`;
  const text =
    `A hospital account accessed MediLink records for:\n` +
    `- Patient: ${args.patientName} (${args.uniquePatientId})\n` +
    `- Hospital userId: ${args.hospitalUserId}\n` +
    `- Time: ${args.occurredAtIso}\n\n` +
    `If this is unexpected, please contact the patient or their care provider.`;

  const config = getMailConfig();
  if (!config) {
    // eslint-disable-next-line no-console
    console.log("[mail:log]", { to, subject, text });
    return { sent: to.length, mode: "log" };
  }

  const brevoApiKey = getBrevoApiKey();
  if (brevoApiKey) {
    await sendViaBrevoApi({
      apiKey: brevoApiKey,
      from: config.from,
      to,
      subject,
      text,
    });
    return { sent: to.length, mode: "smtp" };
  }

  const transport = getTransport(config);
  await transport.sendMail({
    from: config.from,
    to,
    subject,
    text,
  });

  return { sent: to.length, mode: "smtp" };
}
