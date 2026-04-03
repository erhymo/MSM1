import "server-only";

import { writeSystemLog } from "@/lib/firebase/firestore-system-log-service";

type SendGridEmailInput = {
  subject: string;
  html: string;
  text: string;
  categories?: string[];
};

function getRecipients() {
  return (process.env.ALERT_TO_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getSendGridConfig() {
  return {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.ALERT_FROM_EMAIL,
    replyTo: process.env.ALERT_REPLY_TO,
    recipients: getRecipients(),
  };
}

export async function sendOilAlertEmail(input: SendGridEmailInput) {
  const config = getSendGridConfig();

  if (!config.apiKey) {
    throw new Error("SENDGRID_API_KEY is not configured");
  }

  if (!config.fromEmail) {
    throw new Error("ALERT_FROM_EMAIL is not configured");
  }

  if (!config.recipients.length) {
    throw new Error("ALERT_TO_EMAILS is not configured");
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: config.recipients.map((email) => ({ email })) }],
      from: { email: config.fromEmail },
      ...(config.replyTo ? { reply_to: { email: config.replyTo } } : {}),
      subject: input.subject,
      content: [
        { type: "text/plain", value: input.text },
        { type: "text/html", value: input.html },
      ],
      ...(input.categories?.length ? { categories: input.categories.slice(0, 10) } : {}),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();

    await writeSystemLog({
      level: "error",
      scope: "email",
      message: "SendGrid mail send failed",
      details: {
        status: response.status,
        recipients: config.recipients.length,
        reason: errorBody.slice(0, 900),
      },
    }).catch(() => undefined);

    throw new Error(`SendGrid returned HTTP ${response.status}`);
  }

  await writeSystemLog({
    level: "info",
    scope: "email",
    message: "Oil alert email sent via SendGrid",
    details: {
      recipients: config.recipients.length,
      subject: input.subject,
    },
  }).catch(() => undefined);

  return {
    recipients: config.recipients,
    provider: "sendgrid",
  };
}