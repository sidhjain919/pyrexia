/**
 * The emails.
 *
 * Three decisions worth knowing about:
 *
 * **No QR image in the email.** Mail clients block and strip images by default,
 * and an image baked in at send time would still say "Basic" after someone
 * upgrades in October. The email carries a link to the pass page instead, where
 * the QR is generated fresh and always reflects what they actually hold.
 *
 * **Every email has a plain-text twin.** Some clients show it, spam filters
 * read it, and an HTML-only message scores worse for deliverability. It also
 * means the important information survives when the styling doesn't.
 *
 * **Inline styles, no external CSS.** Gmail strips `<style>` blocks. Anything
 * that must survive has to be an inline attribute.
 */

const BRAND = {
  ink: '#071318',
  raised: '#0c1f27',
  parchment: '#ede3ce',
  muted: '#93a2a5',
  brass: '#c89b3c',
  brassBright: '#e6c25e',
}

/**
 * Escape anything that came from a person.
 *
 * A student's name goes into HTML we send to their own inbox, the blast radius
 * is small, but a name containing a tag would still break the layout, and
 * escaping at the boundary is cheaper than remembering not to.
 */
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function shell(bodyHtml: string, preheader: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>PYREXIA 2026</title></head>
<body style="margin:0;padding:0;background:${BRAND.ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.ink};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:${BRAND.raised};border:1px solid #17323c;border-radius:12px;">
<tr><td style="padding:32px 32px 24px;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${BRAND.brass};padding-bottom:20px;">
PYREXIA 2026 &middot; AIIMS Rishikesh
</div>
${bodyHtml}
</td></tr>
</table>
<div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;color:#6b7d81;padding-top:20px;letter-spacing:1px;">
Pirates of the Lost Island &middot; 12&ndash;16 October 2026
</div>
</td></tr></table>
</body></html>`
}

const h1 = (t: string) =>
  `<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;color:${BRAND.parchment};padding-bottom:16px;">${t}</div>`

const p = (t: string) =>
  `<div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:${BRAND.muted};padding-bottom:16px;">${t}</div>`

const button = (href: string, label: string) =>
  `<div style="padding:8px 0 24px;"><a href="${esc(href)}" style="display:inline-block;background:${BRAND.brassBright};color:${BRAND.ink};font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:1px;text-decoration:none;padding:13px 28px;border-radius:99px;">${esc(label)}</a></div>`

/**
 * The crew's announcement channel.
 *
 * Its own block rather than a line in a paragraph, because it is an action
 * and the mute warning has to travel with it: a channel somebody joins and
 * never hears from is the same as one they never joined.
 */
const CHANNEL_URL = 'https://whatsapp.com/channel/0029VbCwmsD7Noa8sdKrYm32'

const channelBlock = () =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;">
     <tr><td style="border:1px solid ${BRAND.brass}55;border-radius:10px;padding:16px 18px;">
       <div style="font:600 15px/1.4 Georgia,serif;color:${BRAND.parchment};">Join the announcement channel</div>
       <div style="font:14px/1.6 Georgia,serif;color:${BRAND.muted};margin-top:5px;">
         Every schedule change and result goes here first.
       </div>
       <div style="margin-top:10px;">
         <a href="${CHANNEL_URL}" style="font:600 14px/1.4 Georgia,serif;color:${BRAND.brassBright};text-decoration:underline;">${CHANNEL_URL}</a>
       </div>
       <div style="font:13px/1.6 Georgia,serif;color:${BRAND.muted};margin-top:10px;">
         WhatsApp channels are muted by default, kindly unmute this channel manually to receive all the important updates on time.
       </div>
     </td></tr>
   </table>`

const CHANNEL_TEXT = `Join the announcement channel — every schedule change and result goes there first:
${CHANNEL_URL}

WhatsApp channels are muted by default, kindly unmute this channel manually to receive all the important updates on time.`

const codeBox = (label: string, value: string) =>
  `<div style="background:#050f13;border:1px solid #17323c;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
<div style="font-family:monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6b7d81;padding-bottom:6px;">${esc(label)}</div>
<div style="font-family:monospace;font-size:20px;letter-spacing:2px;color:${BRAND.brassBright};">${esc(value)}</div>
</div>`

/* ------------------------------------------------------------------ *
 * Registration confirmed
 * ------------------------------------------------------------------ */

export function registrationConfirmed(args: {
  name: string
  publicCode: string
  tierName: string
  amountPaise: number
  passUrl: string
}) {
  const first = args.name.split(' ')[0] || args.name
  const amount = `₹${(args.amountPaise / 100).toLocaleString('en-IN')}`

  const html = shell(
    h1(`You're aboard, ${esc(first)}.`) +
      p(
        `Your <strong style="color:${BRAND.parchment};">${esc(args.tierName)}</strong> is confirmed. ` +
          `We received ${esc(amount)}.`,
      ) +
      codeBox('Your registration number', args.publicCode) +
      p('Open your pass to show at the gate. Keep this email, the link signs you in.') +
      button(args.passUrl, 'View my pass') +
      channelBlock() +
      p(
        `Quote <strong style="color:${BRAND.parchment};">${esc(args.publicCode)}</strong> if you contact the crew. ` +
          `See you on the island, 12&ndash;16 October.`,
      ),
    `${args.tierName} confirmed · ${args.publicCode}`,
  )

  const text = `You're aboard, ${first}.

Your ${args.tierName} is confirmed. We received ${amount}.

Registration number: ${args.publicCode}

View your pass (this link signs you in):
${args.passUrl}

${CHANNEL_TEXT}

Keep this email. Quote your registration number if you contact the crew.

PYREXIA 2026 · Pirates of the Lost Island
12-16 October 2026 · AIIMS Rishikesh`

  return { subject: `You're aboard: ${args.publicCode}`, html, text }
}

/* ------------------------------------------------------------------ *
 * Sign-in link
 * ------------------------------------------------------------------ */

export function signInLink(args: { name: string; url: string; minutes: number }) {
  const first = args.name.split(' ')[0] || args.name

  const html = shell(
    h1('Sign in to your voyage') +
      p(`Hello ${esc(first)}: here's your way back in.`) +
      button(args.url, 'Open my account') +
      p(
        `This link works once and expires in ${args.minutes} minutes. ` +
          `If you didn't ask for it, you can ignore this email, nothing has changed.`,
      ),
    'Your PYREXIA sign-in link',
  )

  const text = `Sign in to your voyage

Hello ${first}: here's your way back in:

${args.url}

This link works once and expires in ${args.minutes} minutes.
If you didn't ask for it, ignore this email. Nothing has changed.

PYREXIA 2026 · AIIMS Rishikesh`

  return { subject: 'Your PYREXIA sign-in link', html, text }
}

/* ------------------------------------------------------------------ *
 * Payment didn't go through
 * ------------------------------------------------------------------ */

export function paymentFailed(args: {
  name: string
  amountPaise: number
  retryUrl: string
  reason?: string
}) {
  const first = args.name.split(' ')[0] || args.name
  const amount = `₹${(args.amountPaise / 100).toLocaleString('en-IN')}`

  const html = shell(
    h1('That payment didn’t go through') +
      p(
        `${esc(first)}, your ${esc(amount)} payment didn't complete, so your registration isn't confirmed yet. ` +
          `<strong style="color:${BRAND.parchment};">No money has left your account</strong>, and if your bank shows a deduction, it will reverse itself within a few days.`,
      ) +
      button(args.retryUrl, 'Try again') +
      p('If it keeps failing, try a different payment method, or reply to this email and the crew will sort it out.'),
    'Your payment did not complete',
  )

  const text = `That payment didn't go through

${first}, your ${amount} payment didn't complete, so your registration isn't confirmed yet.

No money has left your account. If your bank shows a deduction, it will reverse itself within a few days.

Try again:
${args.retryUrl}

If it keeps failing, try a different payment method or reply to this email.

PYREXIA 2026 · AIIMS Rishikesh`

  return { subject: 'Your PYREXIA payment didn’t go through', html, text }
}

/* ------------------------------------------------------------------ *
 * Upgrade confirmed
 * ------------------------------------------------------------------ */

/**
 * Someone who already had Basic and has just added the Festival Pass.
 *
 * They are already aboard, so greeting them as a new arrival reads as a system
 * that has forgotten them: and quoting the cumulative total makes it look like
 * they have been charged twice.
 */
export function upgradeConfirmed(args: {
  name: string
  publicCode: string
  amountPaise: number
  passUrl: string
}) {
  const first = args.name.split(' ')[0] || args.name
  const amount = `₹${(args.amountPaise / 100).toLocaleString('en-IN')}`

  const html = shell(
    h1('The full programme is yours') +
      p(
        `${esc(first)}, your <strong style="color:${BRAND.parchment};">Festival Pass</strong> is confirmed. ` +
          `We received ${esc(amount)} on top of your Basic Registration.`,
      ) +
      codeBox('Your registration number', args.publicCode) +
      p(
        'Your pass is the same one you already have: it now reads Delegate, ' +
          'so anything you have already printed still works at the gate.',
      ) +
      button(args.passUrl, 'View my pass') +
      p('Every event and every evening on the island is open to you. See you there.'),
    `Festival Pass confirmed · ${args.publicCode}`,
  )

  const text = `The full programme is yours

${first}, your Festival Pass is confirmed. We received ${amount} on top of your Basic Registration.

Registration number: ${args.publicCode}

Your pass is the same one you already have: it now reads Delegate, so anything
you have already printed still works at the gate.

View your pass (this link signs you in):
${args.passUrl}

PYREXIA 2026 · Pirates of the Lost Island
12-16 October 2026 · AIIMS Rishikesh`

  return { subject: `Festival Pass confirmed: ${args.publicCode}`, html, text }
}

/* ------------------------------------------------------------------ *
 * Password reset
 * ------------------------------------------------------------------ */

export function resetPassword(args: { name: string; url: string; minutes: number }) {
  const first = args.name?.split(' ')[0] || 'there'

  const html = shell(
    h1('Set a new password') +
      p(`Hello ${esc(first)}: use this to choose a new one.`) +
      button(args.url, 'Choose a new password') +
      p(
        `This link works once and expires in ${args.minutes} minutes. ` +
          `If you didn't ask for it, ignore this email: your password has not changed.`,
      ),
    'Reset your PYREXIA password',
  )

  const text = `Set a new password

Hello ${first}: use this to choose a new one:

${args.url}

This link works once and expires in ${args.minutes} minutes.
If you didn't ask for it, ignore this email. Your password has not changed.

PYREXIA 2026 · AIIMS Rishikesh`

  return { subject: 'Reset your PYREXIA password', html, text }
}

/* ------------------------------------------------------------------ *
 * Verification code
 * ------------------------------------------------------------------ */

export function verificationCode(args: { code: string; minutes: number }) {
  const html = shell(
    h1('Confirm your email') +
      p('Enter this code on the sign-up page to finish creating your account.') +
      codeBox('Your code', args.code) +
      p(
        `It expires in ${args.minutes} minutes. ` +
          `If you didn't try to sign up, you can ignore this email, no account has been created.`,
      ),
    `Your PYREXIA verification code: ${args.code}`,
  )

  // The code appears on its own line in the plain-text part too, because
  // phone mail apps offer to autofill from it.
  const text = `Confirm your email

Enter this code on the sign-up page to finish creating your account:

${args.code}

It expires in ${args.minutes} minutes.
If you didn't try to sign up, ignore this email. No account has been created.

PYREXIA 2026 · AIIMS Rishikesh`

  return { subject: 'Your PYREXIA verification code', html, text }
}
