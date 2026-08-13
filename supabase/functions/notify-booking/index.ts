/* ============================================================================
   notify-booking — Supabase Edge Function (Deno).

   Sends the two transactional emails via Resend:
     • new request  → the owner   (a booking is waiting in the panel)
     • confirmed    → the guest   (stay details + deposit)
     • cancelled    → the guest   (courtesy note)

   Invoked by the `bookings_notify` trigger (see migration 0004) through
   pg_net, with a shared secret in the `x-notify-secret` header. It is inert
   until its secrets are set, so it can ship dark:

     supabase secrets set \
       RESEND_API_KEY=re_xxx \
       NOTIFY_SECRET=<random> \
       OWNER_EMAIL=bookings@villadolcevita.eu \
       FROM_EMAIL="Villa Dolce Vita <reservations@send.villadolcevita.eu>" \
       REPLY_TO=bookings@villadolcevita.eu \
       ADMIN_URL=https://villadolcevita.eu/admin

   Deploy: supabase functions deploy notify-booking --no-verify-jwt
   (auth is the shared secret; the trigger calls it server-side.)
   ============================================================================ */

interface BookingPayload {
  event: "requested" | "confirmed" | "cancelled";
  reference: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  unit: string;
  arrive: string;
  depart: string;
  guests: number;
  total: number;
  deposit_due: number;
  quote: {
    lines?: { label: string; detail?: string; amount: number }[];
    extrasLines?: { label: string; detail?: string; amount: number }[];
    taxLine?: { label: string; amount: number };
    depositPct?: number;
  } | null;
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const NOTIFY_SECRET = Deno.env.get("NOTIFY_SECRET");
const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL") ?? "bookings@villadolcevita.eu";
const FROM_EMAIL =
  Deno.env.get("FROM_EMAIL") ?? "Villa Dolce Vita <reservations@send.villadolcevita.eu>";
const REPLY_TO = Deno.env.get("REPLY_TO") ?? OWNER_EMAIL;
const ADMIN_URL = Deno.env.get("ADMIN_URL") ?? "https://villadolcevita.eu/admin";

const money = (n: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(n);
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
const unitName = (u: string) =>
  u === "estate" ? "The Entire Estate" : u.charAt(0).toUpperCase() + u.slice(1) + " Suite";

/* ---- Email shell — sober, Tuscan Editorial ---- */
function shell(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#161412;color:#f4f1ea;font-family:Georgia,'Times New Roman',serif;">
    <div style="max-width:560px;margin:0 auto;padding:40px 32px;">
      <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c08a58;margin:0 0 24px;">Villa Dolce Vita</p>
      <h1 style="font-size:26px;font-weight:400;letter-spacing:1px;margin:0 0 20px;">${title}</h1>
      ${body}
      <hr style="border:none;border-top:1px solid rgba(244,241,234,0.14);margin:32px 0 16px;">
      <p style="font-size:12px;color:#b6afa2;line-height:1.6;margin:0;">
        Villa Dolce Vita · SP441 56, Massa Marittima, Tuscany<br>
        Reply to this email to reach the concierge.
      </p>
    </div></body></html>`;
}

function lineRows(p: BookingPayload): string {
  const all = [
    ...(p.quote?.lines ?? []),
    ...(p.quote?.extrasLines ?? []),
    ...(p.quote?.taxLine ? [p.quote.taxLine] : []),
  ];
  return all
    .map(
      (l) =>
        `<tr><td style="padding:6px 0;color:#b6afa2;font-size:14px;">${l.label}</td>
         <td style="padding:6px 0;text-align:right;font-size:14px;">${
           l.amount < 0 ? "−" + money(-l.amount) : money(l.amount)
         }</td></tr>`,
    )
    .join("");
}

function ownerEmail(p: BookingPayload) {
  return {
    subject: `New booking request — ${p.guest_name} · ${unitName(p.unit)}`,
    html: shell(
      "A new request is waiting",
      `<p style="font-size:15px;line-height:1.7;color:#f4f1ea;margin:0 0 20px;">
        <strong>${p.guest_name}</strong> has requested <strong>${unitName(p.unit)}</strong>.</p>
       <table style="width:100%;border-collapse:collapse;font-size:14px;color:#f4f1ea;">
        <tr><td style="padding:4px 0;color:#b6afa2;">Reference</td><td style="text-align:right;">${p.reference}</td></tr>
        <tr><td style="padding:4px 0;color:#b6afa2;">Dates</td><td style="text-align:right;">${longDate(p.arrive)} → ${longDate(p.depart)}</td></tr>
        <tr><td style="padding:4px 0;color:#b6afa2;">Guests</td><td style="text-align:right;">${p.guests}</td></tr>
        <tr><td style="padding:4px 0;color:#b6afa2;">Email</td><td style="text-align:right;">${p.guest_email}</td></tr>
        ${p.guest_phone ? `<tr><td style="padding:4px 0;color:#b6afa2;">Phone</td><td style="text-align:right;">${p.guest_phone}</td></tr>` : ""}
        <tr><td style="padding:4px 0;color:#b6afa2;">Total</td><td style="text-align:right;">${money(p.total)}</td></tr>
       </table>
       <p style="margin:28px 0 0;"><a href="${ADMIN_URL}" style="display:inline-block;background:#f4f1ea;color:#161412;padding:12px 22px;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Open the Concierge Desk</a></p>`,
    ),
    to: OWNER_EMAIL,
  };
}

function guestConfirmedEmail(p: BookingPayload) {
  return {
    subject: `Your stay at Villa Dolce Vita is confirmed — ${p.reference}`,
    html: shell(
      "Your stay is confirmed",
      `<p style="font-size:15px;line-height:1.7;margin:0 0 20px;">
        Dear ${p.guest_name.split(" ")[0]}, we're delighted to confirm your stay in
        <strong>${unitName(p.unit)}</strong>.</p>
       <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:#b6afa2;font-size:14px;">Arrival</td><td style="text-align:right;font-size:14px;">${longDate(p.arrive)}</td></tr>
        <tr><td style="padding:4px 0;color:#b6afa2;font-size:14px;">Departure</td><td style="text-align:right;font-size:14px;">${longDate(p.depart)}</td></tr>
        <tr><td style="padding:4px 0;color:#b6afa2;font-size:14px;">Guests</td><td style="text-align:right;font-size:14px;">${p.guests}</td></tr>
       </table>
       <table style="width:100%;border-collapse:collapse;margin-top:16px;border-top:1px solid rgba(244,241,234,0.14);">
         ${lineRows(p)}
         <tr><td style="padding:10px 0 4px;border-top:1px solid rgba(244,241,234,0.3);font-size:16px;">Total</td>
             <td style="padding:10px 0 4px;border-top:1px solid rgba(244,241,234,0.3);text-align:right;font-size:16px;">${money(p.total)}</td></tr>
         <tr><td style="padding:2px 0;color:#b6afa2;font-size:13px;">Due at confirmation (${p.quote?.depositPct ?? 30}%)</td>
             <td style="padding:2px 0;text-align:right;color:#b6afa2;font-size:13px;">${money(p.deposit_due)}</td></tr>
       </table>
       <p style="font-size:14px;line-height:1.7;color:#b6afa2;margin:24px 0 0;">
        We'll be in touch shortly with payment and check-in details. Check-in is from 16:00;
        check-out by 12:00. Breakfast and three chef-cooked dinners a week are included.</p>`,
    ),
    to: p.guest_email,
  };
}

function guestCancelledEmail(p: BookingPayload) {
  return {
    subject: `Your booking request ${p.reference}`,
    html: shell(
      "About your request",
      `<p style="font-size:15px;line-height:1.7;margin:0 0 12px;">
        Dear ${p.guest_name.split(" ")[0]}, your request <strong>${p.reference}</strong>
        for ${unitName(p.unit)} (${longDate(p.arrive)} → ${longDate(p.depart)}) has been
        cancelled. If this was unexpected, simply reply and we'll set things right.</p>`,
    ),
    to: p.guest_email,
  };
}

Deno.serve(async (req) => {
  // Shared-secret gate (the trigger sets x-notify-secret).
  if (NOTIFY_SECRET && req.headers.get("x-notify-secret") !== NOTIFY_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!RESEND_API_KEY) {
    // Ship dark: acknowledge without sending until the key is configured.
    return new Response(JSON.stringify({ skipped: "RESEND_API_KEY not set" }), {
      headers: { "content-type": "application/json" },
    });
  }

  let payload: BookingPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const messages =
    payload.event === "requested"
      ? [ownerEmail(payload)]
      : payload.event === "confirmed"
        ? [guestConfirmedEmail(payload)]
        : payload.event === "cancelled"
          ? [guestCancelledEmail(payload)]
          : [];

  const results = await Promise.all(
    messages.map((m) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: m.to,
          reply_to: REPLY_TO,
          subject: m.subject,
          html: m.html,
        }),
      }).then((r) => r.ok),
    ),
  );

  return new Response(JSON.stringify({ sent: results.filter(Boolean).length }), {
    headers: { "content-type": "application/json" },
  });
});
