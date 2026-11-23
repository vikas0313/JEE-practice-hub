/**
 * JEE Practice Hub — Branded Email Templates (Module E10)
 *
 * Clean, high-contrast, distraction-free HTML email templates.
 * Enforces HTML escaping on all dynamic inputs to eliminate injection vectors.
 * Adheres strictly to the calm, neutral tone policy.
 */

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const BASE_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
  line-height: 1.6;
  max-width: 600px;
  margin: 0 auto;
  padding: 24px;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
`;

const HEADER_HTML = `
  <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: #1e3a8a; font-size: 20px; font-weight: 700;">JEE Practice Hub</h2>
    <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Class 12 JEE Preparation & Monitoring Portal</p>
  </div>
`;

const FOOTER_HTML = `
  <div style="border-top: 1px solid #e2e8f0; margin-top: 32px; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
    <p style="margin: 0;">This is an automated notification from your private JEE Practice Hub installation.</p>
    <p style="margin: 4px 0 0 0;">Zero third-party trackers. Hosted securely in India (ap-south-1).</p>
  </div>
`;

export function renderAuthWelcomeEmail(
  recipientName: string,
  role: string,
  appUrl: string
): { subject: string; html: string; text: string } {
  const safeName = escapeHtml(recipientName);
  const safeRole = escapeHtml(role);
  const safeUrl = escapeHtml(appUrl);

  const subject = 'Welcome to JEE Practice Hub';
  const html = `
    <div style="${BASE_STYLES}">
      ${HEADER_HTML}
      <h3 style="color: #0f172a; margin-top: 0;">Welcome, ${safeName}</h3>
      <p>Your account on JEE Practice Hub has been provisioned with the <strong>${safeRole}</strong> role.</p>
      <p>You can access the portal directly using the link below:</p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="${safeUrl}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
          Open JEE Practice Hub
        </a>
      </div>
      <p style="font-size: 13px; color: #64748b;">If you did not request this invitation, please contact your system administrator.</p>
      ${FOOTER_HTML}
    </div>
  `;

  const text = `Welcome to JEE Practice Hub!\n\nHello ${recipientName},\nYour account has been provisioned with the ${role} role.\nAccess the portal here: ${appUrl}\n\nJEE Practice Hub`;
  return { subject, html, text };
}

export function renderPasswordResetEmail(
  recipientName: string,
  resetLink: string
): { subject: string; html: string; text: string } {
  const safeName = escapeHtml(recipientName);
  const safeLink = escapeHtml(resetLink);

  const subject = 'Password Reset Request — JEE Practice Hub';
  const html = `
    <div style="${BASE_STYLES}">
      ${HEADER_HTML}
      <h3 style="color: #0f172a; margin-top: 0;">Password Reset</h3>
      <p>Hello ${safeName},</p>
      <p>A request was received to reset your password for JEE Practice Hub. Click the button below to set a new password:</p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="${safeLink}" style="background-color: #0284c7; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
          Reset My Password
        </a>
      </div>
      <p style="font-size: 13px; color: #64748b;">This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
      ${FOOTER_HTML}
    </div>
  `;

  const text = `Hello ${recipientName},\n\nA password reset was requested for your JEE Practice Hub account.\nReset link: ${resetLink}\n\nValid for 1 hour.`;
  return { subject, html, text };
}

export function renderMonitorAlertEmail(
  title: string,
  summary: string,
  details: string[],
  reviewLink: string
): { subject: string; html: string; text: string } {
  const safeTitle = escapeHtml(title);
  const safeSummary = escapeHtml(summary);
  const safeLink = escapeHtml(reviewLink);
  const safeDetails = details.map((d) => `<li>${escapeHtml(d)}</li>`).join('');

  const subject = `[Alert] ${title} — JEE Practice Hub`;
  const html = `
    <div style="${BASE_STYLES}">
      ${HEADER_HTML}
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
        <h3 style="color: #991b1b; margin: 0 0 6px 0; font-size: 16px;">${safeTitle}</h3>
        <p style="color: #7f1d1d; margin: 0; font-size: 14px;">${safeSummary}</p>
      </div>
      <h4 style="color: #334155; margin: 16px 0 8px 0; font-size: 14px;">Event Details:</h4>
      <ul style="color: #475569; font-size: 13px; padding-left: 20px; margin: 0 0 20px 0;">
        ${safeDetails}
      </ul>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${safeLink}" style="background-color: #1e293b; color: #ffffff; padding: 9px 18px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block;">
          View in Monitor Dashboard
        </a>
      </div>
      ${FOOTER_HTML}
    </div>
  `;

  const text = `[Alert] ${title}\n\n${summary}\n\nDetails:\n${details.join('\n')}\n\nReview link: ${reviewLink}\n\nJEE Practice Hub`;
  return { subject, html, text };
}

export function renderMonthlySummaryEmail(
  monthName: string,
  metrics: { examsTaken: number; practiceCount: number; avgAccuracy: number }
): { subject: string; html: string; text: string } {
  const safeMonth = escapeHtml(monthName);

  const subject = `${monthName} Monthly Summary — JEE Practice Hub`;
  const html = `
    <div style="${BASE_STYLES}">
      ${HEADER_HTML}
      <h3 style="color: #0f172a; margin-top: 0;">${safeMonth} Performance & Activity Digest</h3>
      <p style="color: #475569; font-size: 14px;">Below is the verified monthly aggregate report for Class 12 preparation:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 0; color: #64748b; font-size: 14px;">Exams Completed</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 700; color: #0f172a;">${metrics.examsTaken}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 0; color: #64748b; font-size: 14px;">Questions Practiced</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 700; color: #0f172a;">${metrics.practiceCount}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 0; color: #64748b; font-size: 14px;">Average First-Attempt Accuracy</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 700; color: #16a34a;">${metrics.avgAccuracy}%</td>
        </tr>
      </table>

      <p style="font-size: 13px; color: #64748b;">Detailed chapter-level breakdowns and topic heatmaps are available in your Monitor Dashboard.</p>
      ${FOOTER_HTML}
    </div>
  `;

  const text = `${monthName} Monthly Summary\n\n- Exams Completed: ${metrics.examsTaken}\n- Questions Practiced: ${metrics.practiceCount}\n- First-Attempt Accuracy: ${metrics.avgAccuracy}%\n\nJEE Practice Hub`;
  return { subject, html, text };
}
