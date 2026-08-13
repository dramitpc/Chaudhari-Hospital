/**
 * WhatsApp notification service — Meta Cloud API
 *
 * Required environment variables:
 *   WHATSAPP_PHONE_NUMBER_ID  — Phone Number ID from Meta Developer Console
 *   WHATSAPP_ACCESS_TOKEN     — Permanent / long-lived access token from Meta
 *
 * If either variable is missing, all send calls are silently skipped so the
 * app works normally without WhatsApp configured.
 */

const API_VERSION = "v19.0";

function getConfig(): { phoneNumberId: string; accessToken: string } | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return null;
  return { phoneNumberId, accessToken };
}

/**
 * Normalise a phone number to the format WhatsApp expects:
 * digits only, with country code, no leading +.
 * If the number has no country code prefix (≤10 digits) we prepend India's 91.
 */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null;
  // Already has country code (>10 digits)
  if (digits.length > 10) return digits;
  // Assume India (+91) for 10-digit numbers
  return `91${digits}`;
}

async function sendTextMessage(to: string, body: string): Promise<void> {
  const config = getConfig();
  if (!config) return; // WhatsApp not configured — skip silently

  const phone = normalisePhone(to);
  if (!phone) {
    console.warn(`[WhatsApp] Skipping invalid phone number: ${to}`);
    return;
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${config.phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[WhatsApp] Failed to send message to ${phone}: ${err}`);
    } else {
      console.info(`[WhatsApp] Message sent to ${phone}`);
    }
  } catch (err) {
    console.error(`[WhatsApp] Network error sending to ${phone}:`, err);
  }
}

// ─── Public helpers ────────────────────────────────────────────────────────────

export async function notifyTokenGenerated(opts: {
  phone: string | null;
  patientName: string;
  tokenNumber: number;
  doctorName: string;
  queueDate: string;
}): Promise<void> {
  if (!opts.phone) return;
  const message =
    `Hello ${opts.patientName},\n\n` +
    `Your queue token has been generated:\n` +
    `🔢 *Token No: ${opts.tokenNumber}*\n` +
    `👨‍⚕️ Doctor: ${opts.doctorName}\n` +
    `📅 Date: ${opts.queueDate}\n\n` +
    `Please wait for your number to be called. Thank you for visiting us!`;
  await sendTextMessage(opts.phone, message);
}

export async function notifyPrescriptionSaved(opts: {
  phone: string | null;
  patientName: string;
  doctorName: string;
  visitDate: string;
  medicineCount: number;
}): Promise<void> {
  if (!opts.phone) return;
  const message =
    `Hello ${opts.patientName},\n\n` +
    `Your prescription has been saved.\n` +
    `👨‍⚕️ Doctor: ${opts.doctorName}\n` +
    `📅 Date: ${opts.visitDate}\n` +
    `💊 Medicines: ${opts.medicineCount} item${opts.medicineCount !== 1 ? "s" : ""}\n\n` +
    `Please collect your printed prescription at the clinic counter. Thank you!`;
  await sendTextMessage(opts.phone, message);
}

export async function notifyPaymentReceived(opts: {
  phone: string | null;
  patientName: string;
  invoiceNumber: string;
  amount: number;
  balance: number;
  paymentMode: string;
}): Promise<void> {
  if (!opts.phone) return;
  const balanceLine =
    opts.balance > 0
      ? `\n⚠️ Remaining balance: ₹${opts.balance.toFixed(2)}`
      : `\n✅ Invoice fully paid`;
  const message =
    `Hello ${opts.patientName},\n\n` +
    `Payment received successfully!\n` +
    `🧾 Invoice: #${opts.invoiceNumber}\n` +
    `💳 Amount paid: ₹${opts.amount.toFixed(2)}\n` +
    `💰 Mode: ${opts.paymentMode}` +
    balanceLine +
    `\n\nThank you for your payment!`;
  await sendTextMessage(opts.phone, message);
}
