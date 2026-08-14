import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY
export const resend = resendApiKey ? new Resend(resendApiKey) : null

export function getWaitlistEmailHtml(email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Conductor Labs</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0f1210;
      color: #edf2ee;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0f1210;
      padding: 40px 20px;
    }
    .container {
      max-width: 540px;
      margin: 0 auto;
      background-color: #151a17;
      border: 1px solid #232d27;
      border-radius: 12px;
      padding: 36px 32px;
    }
    .badge {
      display: inline-block;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      letter-spacing: 0.1em;
      color: #3dd68c;
      background-color: rgba(61, 214, 140, 0.1);
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin: 0 0 16px 0;
      color: #f1f5f2;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #9ba89f;
      margin: 0 0 20px 0;
    }
    .card {
      background-color: #1b221e;
      border: 1px solid #28342c;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .rule-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: #d1ded5;
      margin-bottom: 8px;
    }
    .rule-item:last-child {
      margin-bottom: 0;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #3dd68c;
      display: inline-block;
    }
    .footer {
      border-top: 1px solid #232d27;
      padding-top: 20px;
      margin-top: 28px;
      font-size: 12px;
      color: #637367;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="badge">EARLY ACCESS WAITLIST</div>
      <h1>You're on the list.</h1>
      <p>
        Thanks for requesting early access to <strong>Conductor Labs</strong>. We're onboarding engineering teams in batches as we scale out the platform.
      </p>
      
      <div class="card">
        <p style="font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #7f8f84; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
          One screen. One question. One answer.
        </p>
        <div class="rule-item">
          <span class="dot"></span>
          <span>Rule 1: All open PRs targeting the release branch are merged</span>
        </div>
        <div class="rule-item" style="margin-top: 8px;">
          <span class="dot"></span>
          <span>Rule 2: All CI checks on the latest commit are passing</span>
        </div>
      </div>

      <p>
        We'll reach out to <code>${email}</code> the moment your access is ready. No action is required on your end.
      </p>

      <div class="footer">
        CONDUCTOR LABS · DEPLOYMENT READINESS FOR SMALL TEAMS
      </div>
    </div>
  </div>
</body>
</html>`
}

export async function sendWaitlistWelcomeEmail(email: string) {
  if (!resend) {
    console.log('[Resend] RESEND_API_KEY not found in environment. Email skipped:', email)
    return { success: false, reason: 'NO_API_KEY' }
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Conductor Labs <onboarding@resend.dev>'
  const audienceId = process.env.RESEND_AUDIENCE_ID

  try {
    // Optionally add contact to Audience if configured
    if (audienceId) {
      try {
        await resend.contacts.create({
          email,
          audienceId,
          unsubscribed: false,
        })
      } catch (err) {
        console.warn('[Resend] Could not add to audience:', err)
      }
    }

    // Send transactional welcome email
    const result = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "You're on the Conductor Labs waitlist",
      html: getWaitlistEmailHtml(email),
    })

    return { success: true, data: result }
  } catch (error) {
    console.error('[Resend] Failed to send waitlist welcome email:', error)
    return { success: false, error }
  }
}
